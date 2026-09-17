// ensemble-script.js - 剧本模式：设置页、AI生成剧本、剧本聊天
// 依赖：ensemble.js, ensemble-chat.js, settings.js (callAI)

window.EnsembleScript = (function() {
  'use strict';

  var SCRIPT_CONFIG_KEY = 'ensemble_script_config';

  // --- Helpers ---
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function charName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  // --- Script templates ---
  var SCRIPT_TEMPLATES = [
    {
      name: '咖啡馆偶遇',
      desc: '在一个雨天的咖啡馆里，几个陌生人因一场意外相识',
      theme: '雨天咖啡馆偶遇',
      style: 'daily',
      extra: '故事发生在一个安静的午后，窗外下着小雨'
    },
    {
      name: '悬疑之夜',
      desc: '一桩离奇的案件，真相隐藏在每个人的谎言之中',
      theme: '离奇失踪案件',
      style: 'mystery',
      extra: '每个人都有不在场证明，但每个人都在隐瞒什么'
    },
    {
      name: '奇幻旅程',
      desc: '穿越到异世界的冒险，寻找回家的路',
      theme: '异世界冒险',
      style: 'fantasy',
      extra: '一个神秘的传送门将所有人带到了未知的世界'
    },
    {
      name: '虐心重逢',
      desc: '多年后的重逢，往事如潮水般涌来',
      theme: '多年后重逢',
      style: 'romance',
      extra: '曾经亲密的人，在时间的洪流中走散，如今再次相遇'
    }
  ];

  var STYLE_MAP = {
    daily: '轻松日常',
    mystery: '悬疑推理',
    fantasy: '奇幻冒险',
    romance: '虐心言情',
    custom: '自定义'
  };

  // --- Load/Save config ---
  async function loadConfig() {
    try {
      var row = await db.config.get(SCRIPT_CONFIG_KEY);
      return row ? row.value || getDefaultConfig() : getDefaultConfig();
    } catch(_) {
      return getDefaultConfig();
    }
  }

  async function saveConfig(cfg) {
    try {
      await db.config.put({ key: SCRIPT_CONFIG_KEY, value: cfg });
    } catch(e) {
      console.error('[EnsembleScript] save config error:', e);
    }
  }

  function getDefaultConfig() {
    return {
      perspective: 'third',
      style: 'daily',
      styleCustom: '',
      worldBook: false,
      theme: '',
      extra: '',
      lastGenerated: null,
      pausedScript: null
    };
  }

  // ===== Render Settings Page =====
  async function renderSettings(page, ownerUid, characters) {
    var body = page.querySelector('#ens-body');
    if (!body) return;

    var cfg = await loadConfig();

    body.innerHTML =
      '<div class="ens-settings-scroll">' +
        '<div class="ens-section">' +
          '<div class="ens-section-label">叙事视角</div>' +
          '<div class="ens-section-desc">设置故事的叙述人称</div>' +
          '<select class="ens-select" id="ens-cfg-perspective">' +
            '<option value="first"' + (cfg.perspective === 'first' ? ' selected' : '') + '>第一人称（我）</option>' +
            '<option value="third"' + (cfg.perspective === 'third' ? ' selected' : '') + '>第三人称</option>' +
          '</select>' +
        '</div>' +

        '<div class="ens-section">' +
          '<div class="ens-section-label">写作风格</div>' +
          '<div class="ens-section-desc">选择剧本的基调和风格</div>' +
          '<select class="ens-select" id="ens-cfg-style">' +
            Object.keys(STYLE_MAP).map(function(key) {
              return '<option value="' + key + '"' + (cfg.style === key ? ' selected' : '') + '>' + STYLE_MAP[key] + '</option>';
            }).join('') +
          '</select>' +
          '<div id="ens-custom-style-wrap" style="margin-top:10px;display:' + (cfg.style === 'custom' ? 'block' : 'none') + '">' +
            '<textarea class="ens-textarea" id="ens-cfg-style-custom" rows="3" placeholder="描述你想要的写作风格...">' + esc(cfg.styleCustom) + '</textarea>' +
          '</div>' +
        '</div>' +

        '<div class="ens-section">' +
          '<div class="ens-section-label">世界书</div>' +
          '<div class="ens-section-desc">开启 Apollo Protocol 世界观注入</div>' +
          '<div class="ens-toggle-row">' +
            '<span class="ens-toggle-label">启用世界书</span>' +
            '<label class="ens-toggle">' +
              '<input type="checkbox" id="ens-cfg-worldbook"' + (cfg.worldBook ? ' checked' : '') + '>' +
              '<span class="ens-toggle-track"></span>' +
            '</label>' +
          '</div>' +
        '</div>' +

        '<div class="ens-section">' +
          '<div class="ens-section-label">故事主题</div>' +
          '<div class="ens-section-desc">输入关键词或描述你想演绎的故事</div>' +
          '<input class="ens-input" id="ens-cfg-theme" value="' + esc(cfg.theme) + '" placeholder="例如：雨天咖啡馆偶遇">' +
        '</div>' +

        '<div class="ens-section">' +
          '<div class="ens-section-label">额外设定</div>' +
          '<div class="ens-section-desc">补充任何你想要的设定或要求</div>' +
          '<textarea class="ens-textarea" id="ens-cfg-extra" rows="3" placeholder="例如：故事发生在一个安静的午后...">' + esc(cfg.extra) + '</textarea>' +
        '</div>' +

        '<div class="ens-section">' +
          '<div class="ens-section-label">剧本模板</div>' +
          '<div class="ens-section-desc">快速使用预设剧本框架</div>' +
          '<div class="ens-template-list" id="ens-template-list">' +
            SCRIPT_TEMPLATES.map(function(t, i) {
              return '<div class="ens-template-card" data-idx="' + i + '">' +
                '<div class="ens-template-name">' + esc(t.name) + '</div>' +
                '<div class="ens-template-desc">' + esc(t.desc) + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>' +

        '<button class="ens-gen-btn" id="ens-gen-script">生成剧本</button>' +
      '</div>';

    // Toggle custom style visibility
    var styleSelect = body.querySelector('#ens-cfg-style');
    var customWrap = body.querySelector('#ens-custom-style-wrap');
    if (styleSelect && customWrap) {
      styleSelect.addEventListener('change', function() {
        customWrap.style.display = styleSelect.value === 'custom' ? 'block' : 'none';
      });
    }

    // Template click
    body.querySelectorAll('.ens-template-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var idx = parseInt(card.dataset.idx, 10);
        var tmpl = SCRIPT_TEMPLATES[idx];
        if (!tmpl) return;
        var themeInput = body.querySelector('#ens-cfg-theme');
        var extraInput = body.querySelector('#ens-cfg-extra');
        var styleSelectEl = body.querySelector('#ens-cfg-style');
        if (themeInput) themeInput.value = tmpl.theme;
        if (extraInput) extraInput.value = tmpl.extra;
        if (styleSelectEl) {
          styleSelectEl.value = tmpl.style;
          if (customWrap) customWrap.style.display = tmpl.style === 'custom' ? 'block' : 'none';
        }
      });
    });

    // Generate button
    var genBtn = body.querySelector('#ens-gen-script');
    if (genBtn) {
      genBtn.addEventListener('click', function() {
        handleGenerate(page, ownerUid, characters, body);
      });
    }
  }

  // ===== Generate Script =====
  async function handleGenerate(page, ownerUid, characters, body) {
    var genBtn = body.querySelector('#ens-gen-script');
    if (!genBtn || genBtn.disabled) return;

    // Collect config
    var cfg = {
      perspective: (body.querySelector('#ens-cfg-perspective') || {}).value || 'third',
      style: (body.querySelector('#ens-cfg-style') || {}).value || 'daily',
      styleCustom: (body.querySelector('#ens-cfg-style-custom') || {}).value || '',
      worldBook: (body.querySelector('#ens-cfg-worldbook') || {}).checked || false,
      theme: (body.querySelector('#ens-cfg-theme') || {}).value || '',
      extra: (body.querySelector('#ens-cfg-extra') || {}).value || ''
    };
    cfg.styleDesc = cfg.style === 'custom' ? cfg.styleCustom : (STYLE_MAP[cfg.style] || cfg.style);

    await saveConfig(cfg);

    genBtn.disabled = true;
    genBtn.textContent = '正在生成...';

    try {
      var charNames = characters.map(charName);
      var prompt = '请根据以下设定生成一个剧本框架，返回JSON格式：\n\n';
      prompt += '角色：' + charNames.join('、') + '\n';
      prompt += '叙事视角：' + (cfg.perspective === 'first' ? '第一人称' : '第三人称') + '\n';
      prompt += '写作风格：' + cfg.styleDesc + '\n';
      if (cfg.theme) prompt += '故事主题：' + cfg.theme + '\n';
      if (cfg.extra) prompt += '额外设定：' + cfg.extra + '\n';

      prompt += '\n请返回如下JSON格式（不要添加其他文字）：\n';
      prompt += '{\n';
      prompt += '  "title": "剧本标题",\n';
      prompt += '  "premise": "故事前提（2-3句话）",\n';
      prompt += '  "characters": [\n';
      prompt += '    { "name": "角色名", "role": "主角/配角", "setting": "在这个剧本中的设定" }\n';
      prompt += '  ],\n';
      prompt += '  "preview": "故事预览（第一幕内容，100-200字）",\n';
      prompt += '  "keywords": ["关键词1", "关键词2", "关键词3"]\n';
      prompt += '}';

      var messages = [{ role: 'user', content: prompt }];
      var reply = '';

      if (window.callAI) {
        reply = await window.callAI(messages, { responseFormat: 'json_object', charAntiDrift: true });
      } else {
        reply = '{"title":"未知","premise":"暂无","characters":[],"preview":"暂无","keywords":[]}';
      }

      // Parse JSON
      var scriptData;
      try {
        scriptData = JSON.parse(reply);
      } catch(_) {
        // Try to extract JSON from reply
        var jsonMatch = reply.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          scriptData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析AI返回的剧本');
        }
      }

      // Save generated script to config
      cfg.lastGenerated = scriptData;
      await saveConfig(cfg);

      // Merge character settings
      if (scriptData.characters && scriptData.characters.length) {
        scriptData.characters.forEach(function(sc, idx) {
          if (!sc.name && characters[idx]) {
            sc.name = charName(characters[idx]);
          }
        });
      }

      // Go to preview
      renderPreview(page, ownerUid, characters, cfg, scriptData);
    } catch(e) {
      console.error('[EnsembleScript] generate error:', e);
      window.toast && window.toast('生成失败: ' + (e.message || String(e)));
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = '生成剧本';
    }
  }

  // ===== Render Preview / Confirmation =====
  function renderPreview(page, ownerUid, characters, cfg, scriptData) {
    var viewState = page._ensState || {};
    page._ensState = Object.assign({}, viewState, {
      view: 'script-preview',
      ownerUid: ownerUid,
      characters: viewState.characters || characters,
      mode: 'script'
    });

    var body = page.querySelector('#ens-body');
    if (!body) return;

    var html =
      '<div class="ens-preview-scroll">' +
        '<div class="ens-preview-card">' +
          '<div class="ens-preview-title">' + esc(scriptData.title || '未命名剧本') + '</div>' +
          '<div class="ens-preview-premise">' + esc(scriptData.premise || '') + '</div>';

    if (scriptData.characters && scriptData.characters.length) {
      html += '<div class="ens-preview-section-head">角色设定</div>';
      scriptData.characters.forEach(function(sc) {
        html +=
          '<div class="ens-preview-char-card">' +
            '<div class="ens-preview-char-name">' + esc(sc.name) + '</div>' +
            '<div class="ens-preview-char-role">' + esc(sc.role || '角色') + '</div>' +
            '<div class="ens-preview-char-setting">' + esc(sc.setting || '') + '</div>' +
          '</div>';
      });
    }

    if (scriptData.preview) {
      html += '<div class="ens-preview-section-head">故事预览</div>';
      html += '<div class="ens-preview-text">' + esc(scriptData.preview) + '</div>';
    }

    if (scriptData.keywords && scriptData.keywords.length) {
      html += '<div class="ens-preview-section-head">关键词</div>';
      html += '<div class="ens-preview-keywords">';
      scriptData.keywords.forEach(function(kw) {
        html += '<span class="ens-keyword-tag">' + esc(kw) + '</span>';
      });
      html += '</div>';
    }

    html +=
        '</div>' +
        '<div class="ens-preview-actions">' +
          '<button class="ens-pill-btn" id="ens-preview-regen">重新生成</button>' +
          '<button class="ens-pill-btn primary" id="ens-preview-start">开始剧本</button>' +
        '</div>' +
      '</div>';

    body.innerHTML = html;

    // Regenerate
    body.querySelector('#ens-preview-regen').addEventListener('click', function() {
      renderSettings(page, ownerUid, characters);
    });

    // Start script
    body.querySelector('#ens-preview-start').addEventListener('click', function() {
      var fullConfig = Object.assign({}, cfg, {
        title: scriptData.title,
        premise: scriptData.premise,
        preview: scriptData.preview,
        scriptCharacters: scriptData.characters,
        keywords: scriptData.keywords
      });

      // Enter script chat
      if (window._ensEnterScriptChat) {
        window._ensEnterScriptChat(page, ownerUid, characters, fullConfig);
      }
    });
  }

  // --- Public API ---
  return {
    renderSettings: renderSettings,
    loadConfig: loadConfig,
    saveConfig: saveConfig,
    SCRIPT_TEMPLATES: SCRIPT_TEMPLATES
  };

})();
