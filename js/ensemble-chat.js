// ensemble-chat.js - 群像聊天引擎、卡片渲染、掏出手机
// 依赖：ensemble.js, settings.js (callAI)

window.EnsembleChat = (function() {
  'use strict';

  var _page = null;
  var _ownerUid = null;
  var _characters = [];
  var _mode = 'meet';
  var _scriptConfig = null;
  var _history = [];
  var _pending = false;

  // ===== 工具函数 =====
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function charName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  function avatarHTML(src, name) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(name) + '">'
      : '<span>' + esc((name || '?').charAt(0)) + '</span>';
  }

  // ===== 初始化 =====
  function start(page, ownerUid, characters, mode, scriptConfig) {
    _page = page;
    _ownerUid = ownerUid;
    _characters = characters.slice();
    _mode = mode || 'meet';
    _scriptConfig = scriptConfig || null;
    _history = [];
    _pending = false;

    var body = page.querySelector('#ens-body');
    if (!body) return;

    body.innerHTML = '<div class="ens-chat">' +
      '<div class="ens-chat-log" id="ens-chat-log"></div>' +
      '<div class="ens-compose">' +
      '<button class="ens-compose-btn" id="ens-phone" title="掏出手机"><i class="fa fa-mobile-screen"></i></button>' +
      '<textarea class="ens-input" id="ens-input" placeholder="说点什么..." rows="1"></textarea>' +
      '<button class="ens-send" id="ens-send">发送</button>' +
      '</div>' +
      '<div class="ens-toolbar">' +
      '<button class="ens-tool-btn" id="ens-personnel"><i class="fa-solid fa-users"></i> 现场人员</button>' +
      (_mode === 'script' ? '<button class="ens-tool-btn" id="ens-pause"><i class="fa-solid fa-pause"></i> 暂停</button>' +
        '<button class="ens-tool-btn" id="ens-export"><i class="fa-solid fa-download"></i> 导出</button>' : '') +
      '</div>' +
      '</div>';

    bindEvents(body);
    refreshChat();

    // Add info card
    var log = page.querySelector('#ens-chat-log');
    if (log) {
      var names = _characters.map(function(c) { return charName(c); }).join('、');
      var infoHtml = '<div class="ens-chat-info">' +
        '<div class="ens-chat-info-avatar"><i class="fa-solid fa-' + (_mode === 'script' ? 'book-open' : 'people-group') + '"></i></div>' +
        '<div class="ens-chat-info-text">' +
        '<div class="ens-chat-info-name">' + esc(names) + '</div>' +
        '<div class="ens-chat-info-status">' + (_mode === 'script' ? '剧本模式' : '见面模式') + ' · ' + _characters.length + '人在线</div>' +
        '</div></div>';
      log.innerHTML = infoHtml;
    }

    if (_mode === 'script' && _scriptConfig) {
      addSystemMessage(page, '剧本「' + (_scriptConfig.title || '未命名') + '」开始');
      if (_scriptConfig.preview) {
        addSystemMessage(page, _scriptConfig.preview);
      }
    }
  }

  // ===== 绑定事件 =====
  function bindEvents(body) {
    var input = body.querySelector('#ens-input');
    var sendBtn = body.querySelector('#ens-send');
    var phoneBtn = body.querySelector('#ens-phone');
    var personnelBtn = body.querySelector('#ens-personnel');

    if (phoneBtn) {
      phoneBtn.addEventListener('click', function() {
        if (window.showWechatPage) {
          window.showWechatPage();
        }
      });
    }

    if (personnelBtn) {
      personnelBtn.addEventListener('click', function() {
        if (window.EnsembleCore) {
          window.EnsembleCore.showPersonnelModal(_page);
        }
      });
    }

    if (input) {
      input.addEventListener('input', function() {
        syncInputHeight(input);
      });
      input.addEventListener('keydown', function(e) {
        var isSend = window.isWanWanSendKeyEvent
          ? window.isWanWanSendKeyEvent(e)
          : e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229;
        if (!isSend) return;
        e.preventDefault();
        sendMessage();
      });
    }

    if (sendBtn) {
      if (window.bindWanWanMobileAction) {
        window.bindWanWanMobileAction(sendBtn, sendMessage);
      } else {
        sendBtn.addEventListener('click', sendMessage);
      }
    }

    var pauseBtn = body.querySelector('#ens-pause');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', function() {
        window.toast && window.toast('剧本已暂停');
      });
    }

    var exportBtn = body.querySelector('#ens-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', exportScript);
    }
  }

  function syncInputHeight(input) {
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  // ===== 发送消息 =====
  async function sendMessage() {
    if (_pending) return;
    var input = _page.querySelector('#ens-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    syncInputHeight(input);

    await addOfflineMessage('user', text);
    _history.push({ role: 'user', content: text });
    await refreshChat();

    _pending = true;
    showTyping();

    try {
      var systemPrompt = await buildSystemPrompt();
      var messages = [{ role: 'system', content: systemPrompt }];

      var recent = _history.slice(-20);
      messages = messages.concat(recent);

      var reply = await window.callAI(messages, { charAntiDrift: true });

      _history.push({ role: 'assistant', content: reply });
      await addOfflineMessage('assistant', reply);
      await refreshChat();
    } catch (e) {
      console.error('[ensemble-chat] AI error:', e);
      window.toast && window.toast('AI回复失败：' + (e.message || e));
    } finally {
      _pending = false;
      hideTyping();
    }
  }

  // ===== 系统提示词 =====
  async function buildSystemPrompt() {
    var prompt = '';

    if (_mode === 'script' && _scriptConfig) {
      prompt = buildScriptPrompt();
    } else {
      prompt = '你是一个多人场景的故事叙述者和角色扮演者。当前场景中有以下角色在场：\n\n';
      _characters.forEach(function(ch, idx) {
        prompt += '## 角色' + (idx + 1) + '：' + charName(ch) + '\n';
        if (ch.description) prompt += ch.description + '\n';
        if (ch.persona) prompt += ch.persona + '\n';
        prompt += '\n';
      });
      prompt += '## 用户\n用户（我）正在与这些角色互动。\n\n';
    }

    prompt += '## 回复格式要求\n' +
      '你的每次回复必须是一张卡片的内容，包含以下类型的文字（可以混合使用）：\n\n' +
      '1. **环境/旁白**：描述场景、环境、氛围。不需要角色名前缀。\n' +
      '2. **角色动作**：格式为「角色名 动作描述」，例如「林夕 轻轻放下杯子」。\n' +
      '3. **角色对白**：用中文引号包裹，例如「今天的天气真好。」\n\n' +
      '请让角色自然互动，每次回复包含多个角色的内容。\n' +
      '回复字数控制在200-500字之间。\n' +
      '不要使用emoji。不要使用markdown格式。\n';

    // 注入防油腻世界书
    if (typeof _BUILTIN_ANTI_DRIFT_LORE !== 'undefined' && _BUILTIN_ANTI_DRIFT_LORE) {
      prompt += '\n\n' + _BUILTIN_ANTI_DRIFT_LORE;
    }

    // 注入剧情推进世界书
    if (typeof _BUILTIN_PLOT_FIRST_LORE !== 'undefined' && _BUILTIN_PLOT_FIRST_LORE) {
      prompt += '\n\n' + _BUILTIN_PLOT_FIRST_LORE;
    }

    // Apollo Protocol（剧本模式可选）
    if (_mode === 'script' && _scriptConfig && _scriptConfig.worldBook) {
      prompt += '\n\n' + getApolloProtocol();
    }

    return prompt;
  }

  function buildScriptPrompt() {
    var cfg = _scriptConfig;
    var prompt = '你是一个剧本创作和角色扮演引擎。当前正在演绎以下剧本：\n\n';
    prompt += '## 剧本：' + (cfg.title || '未命名') + '\n';
    prompt += '前提：' + (cfg.premise || '') + '\n\n';
    prompt += '## 叙事视角：' + (cfg.perspective === 'first' ? '第一人称' : '第三人称') + '\n';
    prompt += '## 写作风格：' + (cfg.styleDesc || cfg.style || '日常') + '\n';
    if (cfg.theme) prompt += '## 故事主题：' + cfg.theme + '\n';
    if (cfg.extra) prompt += '## 额外设定：' + cfg.extra + '\n';

    prompt += '\n## 角色设定\n';
    _characters.forEach(function(ch) {
      prompt += '- ' + charName(ch) + '：' + (ch.description || '') + '\n';
    });

    prompt += '\n请以剧本形式回复，包含环境描写、角色动作和对白。\n';
    return prompt;
  }

  function getApolloProtocol() {
    if (typeof window._APOLLO_PROTOCOL !== 'undefined') {
      return window._APOLLO_PROTOCOL;
    }
    return '[SYSTEM ABSOLUTE: APOLLO PROTOCOL INITIATED...]';
  }

  // ===== 消息渲染 =====
  function refreshChat() {
    return new Promise(async function(resolve) {
      var log = _page.querySelector('#ens-chat-log');
      if (!log) { resolve(); return; }

      try {
        var rows = await db.offlineChats
          .where('ownerUid').equals(_ownerUid)
          .and(function(m) { return m.mode === 'ensemble'; })
          .sortBy('createdAt');

        if (!rows.length) {
          log.innerHTML = '<div class="ens-empty">' +
            '<i class="fa fa-comments"></i>' +
            '<div>开始聊天吧</div>' +
            '</div>';
        } else {
          var html = '';
          rows.forEach(function(m) {
            html += buildMessageHTML(m);
          });
          log.innerHTML = html;
        }

        log.scrollTop = log.scrollHeight;
      } catch (e) {
        console.error('[ensemble-chat] refreshChat error:', e);
      }
      resolve();
    });
  }

  function buildMessageHTML(msg) {
    if (msg.role === 'system') {
      return '<div class="ens-system-msg">' + esc(msg.content) + '</div>';
    }

    if (msg.role === 'user') {
      return '<div class="ens-msg is-user">' +
        '<div class="ens-msg-card ens-card-user">' +
        '<div class="ens-msg-text">' + esc(msg.content) + '</div>' +
        '</div>' +
        '</div>';
    }

    // AI回复 - ONE card with style differentiation
    return '<div class="ens-msg is-ai">' +
      '<div class="ens-msg-card ens-card-ai">' +
      parseAIToCard(msg.content) +
      '</div>' +
      '</div>';
  }

  function parseAIToCard(text) {
    if (!text) return '';
    var lines = text.split('\n').filter(function(l) { return l.trim(); });
    var html = '';

    lines.forEach(function(line) {
      var trimmed = line.trim();
      if (!trimmed) return;

      if (isDialogue(trimmed)) {
        html += '<div class="dialogue-text">' + esc(trimmed) + '</div>';
      } else if (isAction(trimmed)) {
        html += '<div class="action-text">' + esc(trimmed) + '</div>';
      } else {
        html += '<div class="env-text">' + esc(trimmed) + '</div>';
      }
    });

    return html;
  }

  function isDialogue(line) {
    return line.indexOf('「') !== -1 && line.indexOf('」') !== -1;
  }

  function isAction(line) {
    var actionKeywords = ['轻轻', '缓缓', '看向', '站起', '坐下', '转身', '微笑', '皱眉', '点头', '摇头', '叹了口气', '伸出手'];
    for (var i = 0; i < actionKeywords.length; i++) {
      if (line.indexOf(actionKeywords[i]) !== -1) return true;
    }
    for (var j = 0; j < _characters.length; j++) {
      var name = charName(_characters[j]);
      if (line.indexOf(name) === 0 && line.indexOf('「') === -1) return true;
    }
    return false;
  }

  // ===== 数据存储 =====
  async function addOfflineMessage(role, content) {
    try {
      await db.offlineChats.add({
        ownerUid: _ownerUid,
        chatId: 0,
        charId: _characters.length > 0 ? _characters[0].id : 0,
        mode: 'ensemble',
        role: role,
        content: content,
        createdAt: Date.now()
      });
    } catch (e) {
      console.error('[ensemble-chat] addOfflineMessage error:', e);
    }
  }

  async function addSystemMessage(page, content) {
    if (!page) page = _page;
    await addOfflineMessage('system', content);
    await refreshChat();
  }

  // ===== Typing指示器 =====
  function showTyping() {
    var log = _page.querySelector('#ens-chat-log');
    if (!log) return;
    var el = document.createElement('div');
    el.className = 'ens-typing';
    el.id = 'ens-typing-indicator';
    el.innerHTML = '<span></span><span></span><span></span>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('ens-typing-indicator');
    if (el) el.remove();
  }

  // ===== 导出剧本 =====
  function exportScript() {
    var text = '群像剧本导出\n\n';
    _history.forEach(function(m) {
      text += (m.role === 'user' ? '用户：' : 'AI：') + m.content + '\n\n';
    });

    var blob = new Blob([text], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '群像剧本_' + new Date().toISOString().slice(0, 10) + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    window.toast && window.toast('剧本已导出');
  }

  // ===== 设置页 =====
  function openSettings(page) {
    var state = window.EnsembleCore ? window.EnsembleCore.getState(page) : {};
    var body = page.querySelector('#ens-body');
    if (!body) return;

    var html = '<div class="ens-settings-page">' +
      '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">当前模式</div>' +
      '<div class="ens-settings-value">' + (_mode === 'script' ? '剧本模式' : '见面模式') + '</div>' +
      '</div>' +
      '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">在场角色</div>' +
      '<div class="ens-settings-chars">';

    _characters.forEach(function(ch) {
      html += '<span class="ens-settings-char-tag">' + esc(charName(ch)) + '</span>';
    });

    html += '</div></div>' +
      '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">操作</div>' +
      '<button class="btn-ghost" id="ens-settings-clear" style="width:100%;margin-top:8px;">清空聊天记录</button>' +
      '</div></div>';

    body.innerHTML = html;

    var clearBtn = body.querySelector('#ens-settings-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function() {
        if (confirm('确定要清空聊天记录吗？')) {
          try {
            await db.offlineChats.where('ownerUid').equals(_ownerUid).and(function(m) { return m.mode === 'ensemble'; }).delete();
            _history = [];
            await refreshChat();
            window.toast && window.toast('聊天记录已清空');
          } catch (e) {
            window.toast && window.toast('清空失败');
          }
        }
      });
    }
  }

  // ===== 暴露公共接口 =====
  return {
    start: start,
    addSystemMessage: addSystemMessage,
    openSettings: openSettings,
    refreshChat: refreshChat
  };

})();
