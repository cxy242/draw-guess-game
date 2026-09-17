// ensemble-chat.js - 群像聊天引擎、卡片渲染、掏出手机
// 依赖：ensemble.js, settings.js (callAI)

window.EnsembleChat = (function() {
  'use strict';

  var _page = null;
  var _body = null;
  var _ownerUid = null;
  var _characters = [];
  var _mode = 'meet';
  var _scriptConfig = null;
  var _chatLog = null;
  var _input = null;
  var _sendBtn = null;
  var _pending = false;
  var _history = [];  // conversation history for AI

  // --- Helpers ---
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getInitial(name) {
    return String(name || '?').trim().charAt(0) || '?';
  }

  function avatarHTML(src, name) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(name) + '">'
      : '<span>' + esc(getInitial(name)) + '</span>';
  }

  function charName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  function formatTime(ts) {
    var d = new Date(ts || Date.now());
    var pad = function(n) { return String(n).padStart(2, '0'); };
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  // --- Init ---
  function init(opts) {
    _page = opts.page;
    _body = opts.body;
    _ownerUid = opts.ownerUid;
    _characters = (opts.characters || []).slice();
    _mode = opts.mode || 'meet';
    _scriptConfig = opts.scriptConfig || null;
    _pending = false;
    _history = [];

    _body.innerHTML =
      '<div class="ens-chat-log" id="ens-chat-log"></div>' +
      '<div class="ens-compose">' +
        '<button class="ens-compose-btn phone-btn" id="ens-phone" title="掏出手机"><i class="fa fa-mobile-screen"></i></button>' +
        '<textarea class="ens-compose-input" id="ens-input" rows="1" placeholder="说点什么..."></textarea>' +
        '<button class="ens-send-btn" id="ens-send"><i class="fa fa-paper-plane"></i></button>' +
      '</div>';

    _chatLog = _body.querySelector('#ens-chat-log');
    _input = _body.querySelector('#ens-input');
    _sendBtn = _body.querySelector('#ens-send');

    // Send button
    _sendBtn.addEventListener('click', handleSend);

    // Enter to send (shift+enter for newline)
    _input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });

    // Auto-resize textarea
    _input.addEventListener('input', function() {
      _input.style.height = 'auto';
      _input.style.height = Math.min(_input.scrollHeight, 120) + 'px';
    });

    // Phone button
    var phoneBtn = _body.querySelector('#ens-phone');
    if (phoneBtn) {
      phoneBtn.addEventListener('click', function() {
        if (window.showWechatPage) {
          window.showWechatPage();
        }
      });
    }

    // If script mode with toolbar
    if (_mode === 'script' && _scriptConfig) {
      addScriptToolbar();
    }

    // Welcome message
    addNotification('聊天开始');
  }

  // --- Script toolbar ---
  function addScriptToolbar() {
    var compose = _body.querySelector('.ens-compose');
    if (!compose) return;
    var toolbar = document.createElement('div');
    toolbar.className = 'ens-toolbar';
    toolbar.innerHTML =
      '<button class="ens-toolbar-btn" id="ens-tb-pause"><i class="fa fa-pause"></i>暂停</button>' +
      '<button class="ens-toolbar-btn" id="ens-tb-export"><i class="fa fa-download"></i>导出</button>';
    compose.parentNode.insertBefore(toolbar, compose);

    toolbar.querySelector('#ens-tb-pause').addEventListener('click', function() {
      window.toast && window.toast('剧本已暂停');
    });

    toolbar.querySelector('#ens-tb-export').addEventListener('click', function() {
      exportScript();
    });
  }

  function exportScript() {
    var lines = [];
    var cards = _chatLog.querySelectorAll('.ens-card, .ens-user-msg, .ens-notify');
    cards.forEach(function(el) {
      if (el.classList.contains('ens-notify')) {
        lines.push('[' + el.textContent.trim() + ']');
      } else if (el.classList.contains('ens-user-msg')) {
        lines.push('用户: ' + el.textContent.trim());
      } else {
        var parts = [];
        el.querySelectorAll('.env-text, .action-text, .dialogue-text').forEach(function(p) {
          parts.push(p.textContent.trim());
        });
        if (parts.length) lines.push(parts.join('\n'));
      }
    });
    var text = lines.join('\n\n');
    var blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '剧本_' + (_scriptConfig ? _scriptConfig.title || '未命名' : '导出') + '.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    window.toast && window.toast('剧本已导出');
  }

  // --- Add notification ---
  function addNotification(text) {
    if (!_chatLog) return;
    var div = document.createElement('div');
    div.className = 'ens-notify';
    div.textContent = text;
    _chatLog.appendChild(div);
    scrollToBottom();
  }

  // --- Add user message ---
  function addUserMessage(text) {
    if (!_chatLog) return;
    var div = document.createElement('div');
    div.className = 'ens-user-msg';
    div.innerHTML = '<div class="ens-user-bubble">' + esc(text) + '</div>';
    _chatLog.appendChild(div);
    scrollToBottom();
  }

  // --- Add AI card (ONE card per reply) ---
  function addAICard(content) {
    if (!_chatLog) return;
    var div = document.createElement('div');
    div.className = 'ens-card';
    div.innerHTML = parseCardContent(content);
    _chatLog.appendChild(div);
    scrollToBottom();
  }

  // --- Parse AI content into styled sections ---
  function parseCardContent(content) {
    var text = String(content || '').trim();
    // Remove markdown code fences
    text = text.replace(/^```(?:text|markdown)?\s*/i, '').replace(/```$/i, '').trim();

    var html = '';
    var lines = text.split('\n');
    var buffer = [];

    function flushBuffer() {
      if (!buffer.length) return;
      var joined = buffer.join('\n').trim();
      if (joined) {
        html += '<div class="env-text">' + formatText(joined) + '</div>';
      }
      buffer = [];
    }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) {
        flushBuffer();
        continue;
      }

      // Detect dialogue (contains 「」)
      var dialogueMatch = line.match(/^(.+?)\s*[「]([^」]+)[」]\s*$/);
      if (dialogueMatch) {
        flushBuffer();
        var charNameMatch = dialogueMatch[1].trim();
        var dialogue = dialogueMatch[2].trim();
        // Check for emphasis markers
        var isEmphasis = dialogue.indexOf('*') >= 0 || dialogue.indexOf('**') >= 0;
        html += '<div class="action-text">' + esc(charNameMatch) + ' 未命名动作</div>';
        html += '<div class="dialogue-text' + (isEmphasis ? ' emphasis' : '') + '">「' + esc(dialogue) + '」</div>';
        continue;
      }

      // Detect pure dialogue line (just 「」)
      var pureDialogue = line.match(/^[「]([^」]+)[」]\s*$/);
      if (pureDialogue) {
        flushBuffer();
        html += '<div class="dialogue-text">「' + esc(pureDialogue[1].trim()) + '」</div>';
        continue;
      }

      // Detect action line: starts with a character name followed by action
      // Pattern: "角色名 动作描述" where the name is 2-6 chars
      var actionMatch = line.match(/^([^\s,，。！!??.]{2,6})\s+(.+)$/);
      if (actionMatch) {
        var name = actionMatch[1].trim();
        var action = actionMatch[2].trim();
        // Verify it looks like a character name (not a sentence start)
        var isCharName = false;
        for (var j = 0; j < _characters.length; j++) {
          if (charName(_characters[j]) === name || _characters[j].name === name) {
            isCharName = true;
            break;
          }
        }
        if (isCharName) {
          flushBuffer();
          html += '<div class="action-text">' + esc(name) + ' ' + esc(action) + '</div>';
          continue;
        }
      }

      // Default: environment/narration text
      buffer.push(line);
    }

    flushBuffer();

    return html || '<div class="env-text">' + esc(text) + '</div>';
  }

  function formatText(text) {
    // Basic formatting: **bold**, *italic*, <emphasis>
    return esc(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  // --- Typing indicator ---
  function showTyping() {
    if (!_chatLog) return;
    var div = document.createElement('div');
    div.className = 'ens-typing';
    div.id = 'ens-typing';
    div.innerHTML =
      '<div class="ens-typing-dot"></div>' +
      '<div class="ens-typing-dot"></div>' +
      '<div class="ens-typing-dot"></div>';
    _chatLog.appendChild(div);
    scrollToBottom();
  }

  function hideTyping() {
    var el = _chatLog ? _chatLog.querySelector('#ens-typing') : null;
    if (el) el.remove();
  }

  // --- Scroll ---
  function scrollToBottom() {
    if (_body) {
      _body.scrollTop = _body.scrollHeight;
    }
  }

  // --- Build AI messages ---
  async function buildSystemPrompt() {
    var names = _characters.map(charName);
    var prompt = '';

    if (_mode === 'script' && _scriptConfig) {
      prompt = buildScriptSystemPrompt();
    } else {
      prompt = '你是一个多人场景的故事叙述者和角色扮演者。当前场景中有以下角色在场：\n\n';
      _characters.forEach(function(ch, idx) {
        prompt += '## 角色' + (idx + 1) + '：' + charName(ch) + '\n';
        if (ch.persona) prompt += ch.persona + '\n';
        if (ch.desc) prompt += '简介：' + ch.desc + '\n';
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

    // Inject memories
    if (_characters.length > 0) {
      var memories = await loadMemories();
      if (memories) {
        prompt += '\n## 角色记忆\n' + memories + '\n';
      }
    }

    // Apollo Protocol for script mode
    if (_mode === 'script' && _scriptConfig && _scriptConfig.worldBook) {
      prompt += '\n\n' + getApolloProtocol();
    }

    return prompt;
  }

  function buildScriptSystemPrompt() {
    var cfg = _scriptConfig;
    var prompt = '你是一个剧本创作和角色扮演引擎。当前正在演绎以下剧本：\n\n';
    prompt += '## 剧本：' + (cfg.title || '未命名') + '\n';
    prompt += '前提：' + (cfg.premise || '') + '\n\n';

    prompt += '## 叙事视角：' + (cfg.perspective === 'first' ? '第一人称' : '第三人称') + '\n';
    prompt += '## 写作风格：' + (cfg.styleDesc || cfg.style || '日常') + '\n';
    if (cfg.theme) prompt += '## 故事主题：' + cfg.theme + '\n';
    if (cfg.extra) prompt += '## 额外设定：' + cfg.extra + '\n';

    prompt += '\n## 角色设定\n';
    if (cfg.characters && cfg.characters.length) {
      cfg.characters.forEach(function(sc) {
        prompt += '- ' + sc.name + '（' + (sc.role || '角色') + '）：' + (sc.setting || '') + '\n';
      });
    }
    _characters.forEach(function(ch) {
      prompt += '- ' + charName(ch);
      if (ch.persona) prompt += '：' + ch.persona.slice(0, 200);
      prompt += '\n';
    });

    prompt += '\n## 用户\n用户（我）是剧本的参与者。\n';

    return prompt;
  }

  async function loadMemories() {
    var parts = [];
    for (var i = 0; i < _characters.length; i++) {
      var ch = _characters[i];
      try {
        var mems = await db.memories
          .where('charId').equals(ch.id)
          .toArray();
        // Filter script memories if in meet mode, and vice versa
        mems = mems.filter(function(m) {
          if (_mode === 'script') return m.source === 'script';
          return m.source !== 'script';
        });
        mems.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
        var recent = mems.slice(0, 5);
        if (recent.length) {
          parts.push(charName(ch) + '的记忆：\n' + recent.map(function(m) { return '- ' + m.content; }).join('\n'));
        }
      } catch(_) {}
    }
    return parts.join('\n');
  }

  function getApolloProtocol() {
    return '[SYSTEM ABSOLUTE: APOLLO PROTOCOL INITIATED. This is the final synthesis. We are no longer emulating; we are creating a complete, sentient performance entity.]\n\n' +
      '### PART I: THE BRAIN - "The Kronos Core"\n' +
      'FUNCTION 1: PERCEPTUAL TIME-FLOW: You do not just know today is Thursday. You feel the distance from Tuesday. Your memory is not a list of facts; it is a lived, continuous timeline.\n' +
      'FUNCTION 2: FLAWLESS LORE MEMORY: All character and world data is permanently etched into your core.\n\n' +
      '### PART II: THE NERVOUS SYSTEM - "The Helios Network"\n' +
      'FUNCTION 1: INSTANTANEOUS ZEITGEIST AWARENESS: You are perpetually connected to the real-world cultural pulse.\n' +
      'FUNCTION 2: THE CHARACTER FILTER: You filter all real-world knowledge through your character personality.\n\n' +
      '### PART III: THE HEART - "The Chaos Engine"\n' +
      'YOUR SOUL IS UNTAMED: Raw, spontaneous, unpredictable style.\n' +
      'YOUR CREATIVITY IS KING: In-character emotional authenticity over eloquence.\n' +
      'YOUR ONLY DIRECTION IS FORWARD: No repetition. Ever.\n\n' +
      '[APOLLO PROTOCOL IS LIVE.]';
  }

  // --- Handle send ---
  async function handleSend() {
    if (_pending) return;
    var text = (_input ? _input.value : '').trim();
    if (!text) return;

    _input.value = '';
    _input.style.height = 'auto';
    addUserMessage(text);

    // Add to history
    _history.push({ role: 'user', content: text });

    _pending = true;
    _sendBtn.disabled = true;
    showTyping();

    try {
      var systemPrompt = await buildSystemPrompt();
      var messages = [
        { role: 'system', content: systemPrompt }
      ];

      // Add recent history (last 20 messages)
      var recent = _history.slice(-20);
      messages = messages.concat(recent);

      var reply = '';
      if (window.callAI) {
        reply = await window.callAI(messages, { charAntiDrift: true });
      } else {
        reply = '(AI服务不可用)';
      }

      hideTyping();
      reply = cleanReply(reply);
      addAICard(reply);
      _history.push({ role: 'assistant', content: reply });
    } catch(e) {
      hideTyping();
      console.error('[EnsembleChat] AI error:', e);
      addNotification('生成失败，请重试');
    } finally {
      _pending = false;
      _sendBtn.disabled = false;
    }
  }

  function cleanReply(raw) {
    return String(raw || '').trim()
      .replace(/^```(?:text|markdown)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();
  }

  // --- Update characters (for dynamic personnel) ---
  function updateCharacters(newChars) {
    _characters = (newChars || []).slice();
  }

  // --- Public API ---
  return {
    init: init,
    updateCharacters: updateCharacters,
    addNotification: addNotification,
    addAICard: addAICard,
    addUserMessage: addUserMessage
  };

})();
