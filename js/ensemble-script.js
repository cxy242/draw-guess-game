// ensemble-script.js - 剧本模式：设置页、AI生成剧本、剧本聊天
// 依赖：ensemble.js, ensemble-chat.js, settings.js (callAI)

window.EnsembleScript = (function() {
  'use strict';

  var SCRIPT_CONFIG_KEY = 'ensemble_script_config';
  var SCRIPT_HISTORY_KEY = 'ensemble_script_history';

  // ===== 工具函数 =====
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function charName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  // ===== 配置读写 =====
  async function getConfig(ownerUid) {
    try {
      var row = await db.config.get(SCRIPT_CONFIG_KEY + '_' + ownerUid);
      return row ? row.value : null;
    } catch (e) {
      return null;
    }
  }

  async function saveConfig(ownerUid, cfg) {
    try {
      await db.config.put({ key: SCRIPT_CONFIG_KEY + '_' + ownerUid, value: cfg });
    } catch (e) {
      console.error('[ensemble-script] saveConfig error:', e);
    }
  }

  async function getHistory(ownerUid) {
    try {
      var row = await db.config.get(SCRIPT_HISTORY_KEY + '_' + ownerUid);
      return row ? row.value : [];
    } catch (e) {
      return [];
    }
  }

  async function saveToHistory(ownerUid, scriptData) {
    try {
      var history = await getHistory(ownerUid);
      history.unshift(Object.assign({}, scriptData, { savedAt: Date.now() }));
      if (history.length > 20) history.length = 20;
      await db.config.put({ key: SCRIPT_HISTORY_KEY + '_' + ownerUid, value: history });
    } catch (e) {
      console.error('[ensemble-script] saveToHistory error:', e);
    }
  }

  // ===== 设置页 =====
  function openSettings(page, ownerUid, selectedItems) {
    var Core = window.EnsembleCore;
    if (!Core) return;

    Core.setState(page, { view: 'script-settings', ownerUid: ownerUid, selectedItems: selectedItems });
    Core.setTitle(page, '剧本设置');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    body.innerHTML = '<div class="ens-script-settings">' +
      '<div class="miss-section-title">叙事视角</div>' +
      '<div class="ens-radio-group">' +
      '<label class="ens-radio-item"><input type="radio" name="ens-perspective" class="ens-radio-perspective" value="first"><span>第一人称</span></label>' +
      '<label class="ens-radio-item"><input type="radio" name="ens-perspective" class="ens-radio-perspective" value="third" checked><span>第三人称</span></label>' +
      '</div>' +

      '<div class="miss-section-title">写作风格</div>' +
      '<div class="ens-radio-group">' +
      '<label class="ens-radio-item"><input type="radio" name="ens-style" class="ens-radio-style" value="daily" checked><span>轻松日常</span></label>' +
      '<label class="ens-radio-item"><input type="radio" name="ens-style" class="ens-radio-style" value="mystery"><span>悬疑推理</span></label>' +
      '<label class="ens-radio-item"><input type="radio" name="ens-style" class="ens-radio-style" value="fantasy"><span>奇幻冒险</span></label>' +
      '<label class="ens-radio-item"><input type="radio" name="ens-style" class="ens-radio-style" value="romance"><span>虐心言情</span></label>' +
      '</div>' +

      '<div class="miss-section-title">世界书（Apollo Protocol）</div>' +
      '<div class="ens-toggle-row">' +
      '<span>注入Apollo Protocol世界书</span>' +
      '<label class="ens-toggle"><input type="checkbox" id="ens-worldbook"><span class="ens-toggle-slider"></span></label>' +
      '</div>' +

      '<div class="miss-section-title">故事主题</div>' +
      '<input type="text" class="ens-input-field" id="ens-theme" placeholder="输入主题关键词，如：校园恋爱、末日求生">' +

      '<div class="miss-section-title">额外设定</div>' +
      '<textarea class="ens-textarea-field" id="ens-extra" placeholder="输入额外要求"></textarea>' +

      '<div class="ens-settings-actions">' +
      '<button class="btn-pill" id="ens-generate">生成剧本</button>' +
      '<button class="btn-ghost" id="ens-history-btn">历史剧本</button>' +
      '</div>' +
      '</div>';

    // 绑定事件
    body.querySelector('#ens-generate').addEventListener('click', function() {
      generateScript(page, ownerUid, selectedItems);
    });

    body.querySelector('#ens-history-btn').addEventListener('click', function() {
      showHistory(page, ownerUid, selectedItems);
    });
  }

  // ===== 生成剧本 =====
  async function generateScript(page, ownerUid, selectedItems) {
    var body = page.querySelector('#ens-body');
    if (!body) return;

    var perspective = body.querySelector('input.ens-radio-perspective:checked');
    var style = body.querySelector('input.ens-radio-style:checked');
    var worldBook = body.querySelector('#ens-worldbook');
    var theme = body.querySelector('#ens-theme');
    var extra = body.querySelector('#ens-extra');

    var cfg = {
      perspective: perspective ? perspective.value : 'third',
      style: style ? style.value : 'daily',
      worldBook: worldBook ? worldBook.checked : false,
      theme: theme ? theme.value.trim() : '',
      extra: extra ? extra.value.trim() : ''
    };

    await saveConfig(ownerUid, cfg);

    body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>' +
      '<div style="text-align:center;color:#888;margin-top:12px;">AI正在生成剧本...</div>';

    try {
      var charNames = selectedItems.map(function(c) { return c.name; }).join('、');
      var charDescs = selectedItems.map(function(c) {
        return c.name + '：' + (c.description || '无描述');
      }).join('\n');

      var styleNames = { daily: '轻松日常', mystery: '悬疑推理', fantasy: '奇幻冒险', romance: '虐心言情' };

      var prompt = '请为以下角色生成一个剧本框架：\n\n角色：\n' + charDescs + '\n\n要求：\n';
      prompt += '- 叙事视角：' + (cfg.perspective === 'first' ? '第一人称' : '第三人称') + '\n';
      prompt += '- 写作风格：' + (styleNames[cfg.style] || cfg.style) + '\n';
      if (cfg.theme) prompt += '- 故事主题：' + cfg.theme + '\n';
      if (cfg.extra) prompt += '- 额外设定：' + cfg.extra + '\n';

      prompt += '\n请返回JSON格式：\n{\n';
      prompt += '  "title": "剧本标题",\n';
      prompt += '  "premise": "故事前提（2-3句话）",\n';
      prompt += '  "characters": [\n    {"name": "角色名", "role": "主角/配角", "setting": "在这个剧本中的设定"}\n  ],\n';
      prompt += '  "preview": "故事预览（第一幕内容，100-200字）",\n';
      prompt += '  "keywords": ["关键词1", "关键词2", "关键词3"]\n}';

      var systemPrompt = '你是一个专业的剧本创作AI。请严格按照JSON格式返回。';

      // 注入世界书
      if (typeof _BUILTIN_ANTI_DRIFT_LORE !== 'undefined' && _BUILTIN_ANTI_DRIFT_LORE) {
        systemPrompt += '\n\n' + _BUILTIN_ANTI_DRIFT_LORE;
      }
      if (typeof _BUILTIN_PLOT_FIRST_LORE !== 'undefined' && _BUILTIN_PLOT_FIRST_LORE) {
        systemPrompt += '\n\n' + _BUILTIN_PLOT_FIRST_LORE;
      }
      if (cfg.worldBook && typeof window._APOLLO_PROTOCOL !== 'undefined') {
        systemPrompt += '\n\n' + window._APOLLO_PROTOCOL;
      }

      var messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      var reply = await window.callAI(messages, { responseFormat: 'json_object', charAntiDrift: true });

      // 解析JSON
      var scriptData;
      try {
        var cleanReply = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        scriptData = JSON.parse(cleanReply);
      } catch (e) {
        throw new Error('AI返回的JSON格式错误');
      }

      await saveToHistory(ownerUid, scriptData);
      showPreview(page, ownerUid, selectedItems, cfg, scriptData);

    } catch (e) {
      console.error('[ensemble-script] generate error:', e);
      window.toast && window.toast('剧本生成失败：' + (e.message || e));
      openSettings(page, ownerUid, selectedItems);
    }
  }

  // ===== 剧本预览 =====
  function showPreview(page, ownerUid, selectedItems, cfg, scriptData) {
    var Core = window.EnsembleCore;
    if (!Core) return;

    Core.setState(page, { view: 'script-preview', ownerUid: ownerUid, selectedItems: selectedItems, cfg: cfg, scriptData: scriptData });
    Core.setTitle(page, '剧本预览');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    var html = '<div class="ens-script-preview">' +
      '<div class="ens-script-title">' + esc(scriptData.title || '未命名剧本') + '</div>' +

      '<div class="ens-script-section">' +
      '<div class="ens-script-label">故事前提</div>' +
      '<div class="ens-script-text">' + esc(scriptData.premise || '') + '</div>' +
      '</div>';

    html += '<div class="ens-script-section">' +
      '<div class="ens-script-label">角色设定</div>';

    (scriptData.characters || []).forEach(function(ch) {
      html += '<div class="ens-script-char">' +
        '<strong>' + esc(ch.name) + '</strong> - ' + esc(ch.role || '') +
        '<div class="ens-script-char-desc">' + esc(ch.setting || '') + '</div>' +
        '</div>';
    });
    html += '</div>';

    html += '<div class="ens-script-section">' +
      '<div class="ens-script-label">故事预览</div>' +
      '<div class="ens-script-text">' + esc(scriptData.preview || '') + '</div>' +
      '</div>';

    html += '<div class="ens-script-section">' +
      '<div class="ens-script-label">关键词</div>' +
      '<div class="ens-keywords">';
    (scriptData.keywords || []).forEach(function(kw) {
      html += '<span class="ens-keyword">#' + esc(kw) + '</span>';
    });
    html += '</div></div>';

    html += '<div class="ens-script-actions">' +
      '<button class="btn-pill" id="ens-start-script">开始剧本</button>' +
      '<button class="btn-ghost" id="ens-regenerate">重新生成</button>' +
      '</div></div>';

    body.innerHTML = html;

    body.querySelector('#ens-start-script').addEventListener('click', function() {
      enterScriptMode(page, ownerUid, selectedItems, cfg, scriptData);
    });

    body.querySelector('#ens-regenerate').addEventListener('click', function() {
      openSettings(page, ownerUid, selectedItems);
    });
  }

  // ===== 进入剧本聊天 =====
  function enterScriptMode(page, ownerUid, selectedItems, cfg, scriptData) {
    var Core = window.EnsembleCore;
    if (!Core) return;

    var fullConfig = Object.assign({}, cfg, {
      title: scriptData.title,
      premise: scriptData.premise,
      characters: scriptData.characters,
      preview: scriptData.preview,
      keywords: scriptData.keywords
    });

    Core.setState(page, {
      view: 'chat',
      mode: 'script',
      ownerUid: ownerUid,
      selectedItems: selectedItems,
      currentChars: selectedItems.slice()
    });
    Core.setTitle(page, scriptData.title || '剧本模式');

    if (window.EnsembleChat) {
      window.EnsembleChat.start(page, ownerUid, selectedItems, 'script', fullConfig);
    }
  }

  // ===== 历史剧本 =====
  async function showHistory(page, ownerUid, selectedItems) {
    var Core = window.EnsembleCore;
    if (!Core) return;

    Core.setState(page, { view: 'script-history', ownerUid: ownerUid, selectedItems: selectedItems });
    Core.setTitle(page, '历史剧本');

    var body = page.querySelector('#ens-body');
    if (!body) return;

    var history = await getHistory(ownerUid);

    if (!history.length) {
      body.innerHTML = '<div class="miss-empty">' +
        '<i class="fa fa-clock-rotate-left"></i>' +
        '<div>暂无历史剧本</div>' +
        '</div>';
      return;
    }

    var html = '<div class="miss-section-title">历史剧本</div>' +
      '<div class="miss-list">';
    history.forEach(function(script, idx) {
      var date = script.savedAt ? new Date(script.savedAt).toLocaleDateString() : '';
      html += '<button class="miss-row ens-history-row" data-idx="' + idx + '">' +
        '<div class="miss-row-main">' +
        '<div class="miss-row-title">' + esc(script.title || '未命名剧本') + '</div>' +
        '<div class="miss-row-sub">' + esc(script.premise || '').substring(0, 50) + '...</div>' +
        '</div>' +
        '<div class="ens-history-date">' + esc(date) + '</div>' +
        '</button>';
    });
    html += '</div>';
    body.innerHTML = html;

    body.querySelectorAll('.ens-history-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var idx = parseInt(row.dataset.idx);
        var scriptData = history[idx];
        if (scriptData) {
          showPreview(page, ownerUid, selectedItems, {}, scriptData);
        }
      });
    });
  }

  // ===== 暴露公共接口 =====
  return {
    openSettings: openSettings,
    getHistory: getHistory,
    saveToHistory: saveToHistory
  };

})();
