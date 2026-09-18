// ensemble-script.js - 剧本模式：设置、生成、预览、聊天、历史
// 依赖：ensemble.js, ensemble-chat.js

window.EnsembleScript = (function() {
  'use strict';

  var CFG_KEY = 'ens_script_cfg';
  var HIST_KEY = 'ens_script_hist';

  // ===== helpers =====
  function esc(s) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(s);
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function chName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  // ===== config =====
  async function getCfg(uid) {
    try { var r = await db.config.get(CFG_KEY + '_' + uid); return r ? r.value : null; }
    catch(e) { return null; }
  }

  async function saveCfg(uid, c) {
    try { await db.config.put({ key: CFG_KEY + '_' + uid, value: c }); }
    catch(e) { console.error('[ens-script] saveCfg', e); }
  }

  async function getHist(uid) {
    try { var r = await db.config.get(HIST_KEY + '_' + uid); return r ? r.value : []; }
    catch(e) { return []; }
  }

  async function saveHist(uid, d) {
    try {
      var h = await getHist(uid);
      h.unshift(Object.assign({}, d, { savedAt: Date.now() }));
      if (h.length > 20) h.length = 20;
      await db.config.put({ key: HIST_KEY + '_' + uid, value: h });
    } catch(e) { console.error('[ens-script] saveHist', e); }
  }

  // ===== 设置页 =====
  function openSettings(page, uid, chars) {
    var C = window.EnsembleCore;
    if (!C) return;
    C.setState(page, { view: 'script-settings', ownerUid: uid, selectedItems: chars });
    C.setTitle(page, '剧本设置');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    body.innerHTML =
      '<div class="ens-page-header">' +
        '<div class="ens-page-icon"><i class="fa-solid fa-book-open"></i></div>' +
        '<div class="ens-page-title">剧本设置</div>' +
        '<div class="ens-page-desc">选择参数，AI为你生成专属剧本</div>' +
      '</div>' +
      '<div class="ens-script-settings">' +
        '<div class="miss-section-title">叙事视角</div>' +
        '<div class="ens-radio-group">' +
          '<label class="ens-radio-item"><input type="radio" name="ens-persp" value="first"><span>第一人称</span></label>' +
          '<label class="ens-radio-item"><input type="radio" name="ens-persp" value="third" checked><span>第三人称</span></label>' +
        '</div>' +
        '<div class="miss-section-title">写作风格</div>' +
        '<div class="ens-radio-group">' +
          '<label class="ens-radio-item"><input type="radio" name="ens-style" value="daily" checked><span>轻松日常</span></label>' +
          '<label class="ens-radio-item"><input type="radio" name="ens-style" value="mystery"><span>悬疑推理</span></label>' +
          '<label class="ens-radio-item"><input type="radio" name="ens-style" value="fantasy"><span>奇幻冒险</span></label>' +
          '<label class="ens-radio-item"><input type="radio" name="ens-style" value="romance"><span>虐心言情</span></label>' +
        '</div>' +
        '<div class="miss-section-title">世界书</div>' +
        '<div class="ens-toggle-row">' +
          '<span>注入Apollo Protocol</span>' +
          '<label class="ens-toggle"><input type="checkbox" id="ens-wb"><span class="ens-toggle-slider"></span></label>' +
        '</div>' +
        '<div class="miss-section-title">故事主题</div>' +
        '<input type="text" class="ens-input-field" id="ens-theme" placeholder="如：校园恋爱、末日求生">' +
        '<div class="miss-section-title">额外设定</div>' +
        '<textarea class="ens-textarea-field" id="ens-extra" placeholder="输入额外要求"></textarea>' +
        '<div class="ens-settings-actions">' +
          '<button class="btn-pill" id="ens-gen">生成剧本</button>' +
          '<button class="btn-ghost" id="ens-hist">历史剧本</button>' +
        '</div>' +
      '</div>';

    var genBtn = body.querySelector('#ens-gen');
    var histBtn = body.querySelector('#ens-hist');
    if (genBtn) genBtn.onclick = function() { generate(page, uid, chars); };
    if (histBtn) histBtn.onclick = function() { showHistory(page, uid, chars); };
  }

  // ===== 生成 =====
  async function generate(page, uid, chars) {
    var body = page.querySelector('#ens-body');
    if (!body) return;

    var pEl = body.querySelector('input[name="ens-persp"]:checked');
    var sEl = body.querySelector('input[name="ens-style"]:checked');
    var wbEl = body.querySelector('#ens-wb');
    var thEl = body.querySelector('#ens-theme');
    var exEl = body.querySelector('#ens-extra');

    var cfg = {
      persp: pEl ? pEl.value : 'third',
      style: sEl ? sEl.value : 'daily',
      wb: wbEl ? wbEl.checked : false,
      theme: thEl ? thEl.value.trim() : '',
      extra: exEl ? exEl.value.trim() : ''
    };
    await saveCfg(uid, cfg);

    body.innerHTML =
      '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>' +
      '<div style="text-align:center;color:#8a8a8a;margin-top:12px;">AI正在生成剧本...</div>';

    try {
      var descs = chars.map(function(c) { return c.name + '：' + (c.description || '无'); }).join('\n');
      var sn = { daily:'轻松日常', mystery:'悬疑推理', fantasy:'奇幻冒险', romance:'虐心言情' };

      var prompt = '为以下角色生成剧本框架：\n\n角色：\n' + descs + '\n\n要求：\n';
      prompt += '- 视角：' + (cfg.persp === 'first' ? '第一人称' : '第三人称') + '\n';
      prompt += '- 风格：' + (sn[cfg.style] || cfg.style) + '\n';
      if (cfg.theme) prompt += '- 主题：' + cfg.theme + '\n';
      if (cfg.extra) prompt += '- 额外：' + cfg.extra + '\n';
      prompt += '\n返回JSON：{"title":"","premise":"","characters":[{"name":"","role":"","setting":""}],"preview":"","keywords":[""]}';

      var sys = '你是剧本创作AI，严格返回JSON。';
      try { if (_BUILTIN_ANTI_DRIFT_LORE) sys += '\n\n' + _BUILTIN_ANTI_DRIFT_LORE; } catch(e){}
      try { if (_BUILTIN_PLOT_FIRST_LORE) sys += '\n\n' + _BUILTIN_PLOT_FIRST_LORE; } catch(e){}
      if (cfg.wb && window._APOLLO_PROTOCOL) sys += '\n\n' + window._APOLLO_PROTOCOL;

      var reply = await window.callAI(
        [{ role:'system', content:sys }, { role:'user', content:prompt }],
        { responseFormat:'json_object', charAntiDrift:true }
      );

      var clean = reply.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      var data = JSON.parse(clean);
      await saveHist(uid, data);
      showPreview(page, uid, chars, cfg, data);
    } catch(e) {
      console.error('[ens-script] generate', e);
      window.toast && window.toast('生成失败：' + (e.message || e));
      openSettings(page, uid, chars);
    }
  }

  // ===== 预览 =====
  function showPreview(page, uid, chars, cfg, data) {
    var C = window.EnsembleCore;
    if (!C) return;
    C.setState(page, { view:'script-preview', ownerUid:uid, selectedItems:chars, cfg:cfg, scriptData:data });
    C.setTitle(page, '剧本预览');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    var h = '<div class="ens-script-preview">' +
      '<div class="ens-script-title">' + esc(data.title || '未命名') + '</div>' +
      '<div class="ens-script-section"><div class="ens-script-label">故事前提</div>' +
      '<div class="ens-script-text">' + esc(data.premise || '') + '</div></div>' +
      '<div class="ens-script-section"><div class="ens-script-label">角色设定</div>';

    (data.characters || []).forEach(function(c) {
      h += '<div class="ens-script-char"><strong>' + esc(c.name) + '</strong> - ' + esc(c.role || '') +
        '<div class="ens-script-char-desc">' + esc(c.setting || '') + '</div></div>';
    });

    h += '</div><div class="ens-script-section"><div class="ens-script-label">预览</div>' +
      '<div class="ens-script-text">' + esc(data.preview || '') + '</div></div>' +
      '<div class="ens-script-section"><div class="ens-script-label">关键词</div><div class="ens-keywords">';

    (data.keywords || []).forEach(function(k) { h += '<span class="ens-keyword">#' + esc(k) + '</span>'; });

    h += '</div></div><div class="ens-script-actions">' +
      '<button class="btn-pill" id="ens-start">开始剧本</button>' +
      '<button class="btn-ghost" id="ens-regen">重新生成</button></div></div>';

    body.innerHTML = h;

    var sBtn = body.querySelector('#ens-start');
    var rBtn = body.querySelector('#ens-regen');
    if (sBtn) sBtn.onclick = function() { enterScript(page, uid, chars, cfg, data); };
    if (rBtn) rBtn.onclick = function() { openSettings(page, uid, chars); };
  }

  // ===== 进入剧本聊天 =====
  function enterScript(page, uid, chars, cfg, data) {
    var C = window.EnsembleCore;
    if (!C) return;

    var fullCfg = {
      title: data.title, premise: data.premise,
      characters: data.characters, preview: data.preview,
      keywords: data.keywords, persp: cfg.persp,
      style: cfg.style, wb: cfg.wb, theme: cfg.theme, extra: cfg.extra
    };

    C.setState(page, { view:'chat', mode:'script', ownerUid:uid, selectedItems:chars, currentChars:chars.slice() });
    C.setTitle(page, data.title || '剧本');

    if (window.EnsembleChat) {
      window.EnsembleChat.start(page, uid, chars, 'script', fullCfg);
    }
  }

  // ===== 历史 =====
  async function showHistory(page, uid, chars) {
    var C = window.EnsembleCore;
    if (!C) return;
    C.setState(page, { view:'script-history', ownerUid:uid, selectedItems:chars });
    C.setTitle(page, '历史剧本');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    var list = await getHist(uid);

    if (!list.length) {
      body.innerHTML =
        '<div class="ens-empty-state">' +
          '<div class="ens-empty-icon"><i class="fa fa-clock-rotate-left"></i></div>' +
          '<div class="ens-empty-title">暂无历史剧本</div>' +
          '<div class="ens-empty-desc">生成的剧本会保存在这里</div>' +
        '</div>';
      return;
    }

    var h = '<div class="miss-section-title">历史剧本</div><div class="miss-list">';
    list.forEach(function(s, i) {
      var d = s.savedAt ? new Date(s.savedAt).toLocaleDateString() : '';
      h += '<button class="miss-row ens-history-row" data-i="' + i + '">' +
        '<div class="miss-row-main"><div class="miss-row-title">' + esc(s.title || '未命名') + '</div>' +
        '<div class="miss-row-sub">' + esc(s.preview || '').substring(0,60) + '</div></div>' +
        '<div class="ens-history-date">' + esc(d) + '</div></button>';
    });
    h += '</div>';
    body.innerHTML = h;

    body.querySelectorAll('.ens-history-row').forEach(function(row) {
      row.onclick = function() {
        var i = parseInt(row.dataset.i);
        if (list[i]) showPreview(page, uid, chars, {}, list[i]);
      };
    });
  }

  // ===== public =====
  return {
    openSettings: openSettings,
    getHistory: getHist,
    saveToHistory: saveHist
  };

})();
