// spicy-offline.js — 星途财弈 · 游戏线下模式
// 完全复用 miss-you.js 的UI结构和CSS类名
(function () {
  'use strict'

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  var _chatHistory = []
  var _currentPage = null

  // ── 构建系统提示词（和miss-you.js格式一致）──
  async function buildSystemPrompt(charId, gameContext) {
    var char = null
    try { char = await window.getCharacter(charId) } catch(e){}
    var charName = char ? (char.name || '对手') : (gameContext.aiName || '对手')
    var persona = char ? (char.description || char.persona || '') : ''
    var userName = gameContext.playerName || '你'

    var loreCtx = ''
    try {
      if (window.getLorebookContextSegments) {
        var seg = await window.getLorebookContextSegments(charId, [])
        loreCtx = typeof seg === 'object' ? (seg.middle || '') : (seg || '')
      }
    } catch(e){}

    var memoryCtx = ''
    try {
      if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
        memoryCtx = await window.WanWanMemory.getMemoryContext(null, charId, null, [])
      }
    } catch(e){}

    // 和miss-you.js一样的system prompt格式
    var system = '# 星途财弈 · 游戏线下模式\n\n'
    system += '你扮演【' + charName + '】，正在和【' + userName + '】玩星途财弈棋盘游戏。\n'
    system += '你不是' + userName + '，也不是语言模型；你有自己的性格、情绪、边界和判断。\n\n'

    if (persona) system += '## 人物档案\n\n1. 你的身份：' + charName + '\n人设细节：\n' + persona + '\n\n'
    if (gameContext.aiIdentity) {
      system += '## 你的本局身份\n你现在的身份是「' + gameContext.aiIdentity.name + '」。\n身份设定：' + gameContext.aiIdentity.behavior + '\n你必须严格按这个身份的风格来回复。\n\n'
    }
    system += '2. 互动对象：' + userName + '\n\n'
    if (loreCtx) system += '## 世界书设定\n' + loreCtx + '\n\n'
    if (memoryCtx) system += '## 记忆\n' + memoryCtx + '\n\n'

    system += '## 当前游戏状态\n'
    system += '- 回合：第' + gameContext.round + '/' + gameContext.totalRounds + '回合\n'
    system += '- ' + userName + '的星币：' + gameContext.playerGold + '\n'
    system += '- ' + charName + '的星币：' + gameContext.aiGold + '\n'

    system += '\n## 规则\n'
    system += '1. 用' + charName + '的语气回复，保持角色一致性\n'
    system += '2. 回复简洁自然，控制在' + (gameContext.wordLimit || 200) + '字以内\n'
    system += '3. 你在游戏中，要对游戏事件做出角色化的反应\n'
    system += '4. 不要跳出角色，不要提到你是AI\n'
    return system
  }

  // ── 调用AI（和miss-you.js一样的调用方式）──
  async function callAI(charId, userMessage, gameContext) {
    var system = await buildSystemPrompt(charId, gameContext)
    _chatHistory.push({ role: 'user', content: userMessage })
    var recentHistory = _chatHistory.slice(-10)

    try {
      var reply = await window.callAI(recentHistory, { system: system, temperature: 0.85 })
      _chatHistory.push({ role: 'assistant', content: reply })
      return reply
    } catch(e) { return null }
  }

  // ── 渲染单条消息（完全复用miss-you.js的HTML结构）──
  function renderMessage(msg, charName, userName) {
    var isUser = msg.role === 'user'
    var isSystem = msg.role === 'system'
    var name = isUser ? userName : charName
    var avatar = name ? name.charAt(0) : '?'

    if (isSystem) {
      return '<div style="text-align:center;padding:8px 0;"><span style="font-size:11px;color:#888;">' + esc(msg.content) + '</span></div>'
    }

    var subtitle = isUser ? '此刻最好' : '星途财弈对局中'
    var now = new Date()
    var timeStr = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0')

    return '<article class="miss-entry ' + (isUser ? 'is-user' : 'is-char') + '">' +
      '<button class="miss-entry-head" type="button">' +
        '<div class="miss-entry-person">' +
          '<div class="miss-msg-avatar">' + esc(avatar) + '</div>' +
          '<div class="miss-entry-nameblock">' +
            '<div class="miss-msg-name">' + esc(name) + '</div>' +
            '<div class="miss-entry-subtitle">' + esc(subtitle) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="miss-entry-floor">#' + (_chatHistory.length) + '</div>' +
      '</button>' +
      '<div class="miss-entry-card">' +
        '<div class="miss-msg-text"><p>' + esc(msg.content) + '</p></div>' +
        '<div class="miss-entry-footer">' +
          '<span>' + timeStr + '</span>' +
        '</div>' +
      '</div>' +
    '</article>'
  }

  // ── 显示游戏线下页面（复用miss-you.js的页面结构）──
  function showOfflinePage(gameContext, onBack) {
    _chatHistory = []
    _currentPage = null
    gameContext.wordLimit = gameContext.wordLimit || 200

    var charName = gameContext.aiName || '对手'
    var userName = gameContext.playerName || '你'

    var page = document.createElement('div')
    page.id = 'spicy-offline-page'
    page.className = 'full-page'
    page.style.cssText = 'position:fixed;inset:0;z-index:9999;'
    _currentPage = page

    // 完全复用miss-you.js的页面结构
    page.innerHTML =
      '<div class="page-header">' +
        '<button class="header-back" id="sp-offline-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="header-title">' + esc(charName) + ' · 星途财弈</span>' +
        '<button class="btn-icon miss-settings-btn" id="sp-offline-settings" title="设置"><i class="fa-solid fa-gear"></i></button>' +
      '</div>' +
      '<div class="miss-body" id="miss-body">' +
        '<div class="miss-chat">' +
          '<div class="miss-chat-log" id="miss-chat-log"></div>' +
          '<div class="miss-compose">' +
            '<button class="miss-end-meet" id="sp-offline-end" type="button">返回棋盘</button>' +
            '<textarea class="miss-input" id="sp-offline-input" rows="1" placeholder="说点什么..."></textarea>' +
            '<button class="miss-send" id="sp-offline-send" type="button"><i class="fa-solid fa-paper-plane"></i></button>' +
          '</div>' +
        '</div>' +
      '</div>'

    if (window.openPage) window.openPage(page)
    else document.body.appendChild(page)

    // 返回按钮
    page.querySelector('#sp-offline-back').onclick = function() {
      page.remove(); _currentPage = null
      if (onBack) onBack()
    }
    page.querySelector('#sp-offline-end').onclick = function() {
      page.remove(); _currentPage = null
      if (onBack) onBack()
    }

    // 发送消息
    var input = page.querySelector('#sp-offline-input')
    var sendBtn = page.querySelector('#sp-offline-send')
    var sendPending = false

    async function sendUserMessage() {
      if (sendPending) return
      var text = input.value.trim()
      if (!text) return
      sendPending = true
      sendBtn.disabled = true
      input.value = ''

      // 添加用户消息到聊天记录
      addMessageToLog(page, { role: 'user', content: text }, charName, userName)

      // 显示AI正在输入
      var typingId = addTypingIndicator(page, charName)

      // 调用AI
      var reply = await callAI(gameContext.charId, text, gameContext)

      removeTypingIndicator(page, typingId)
      if (reply) {
        addMessageToLog(page, { role: 'assistant', content: reply }, charName, userName)
      } else {
        addMessageToLog(page, { role: 'system', content: 'AI 回复失败，请重试' }, charName, userName)
      }

      sendPending = false
      sendBtn.disabled = false
    }

    // 设置按钮
    var wordLimit = 200
    page.querySelector('#sp-offline-settings').onclick = function() {
      var overlay = document.createElement('div')
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;'
      overlay.innerHTML =
        '<div style="background:#fff;border-radius:12px;padding:20px;width:280px;">' +
          '<div style="font-size:16px;font-weight:700;margin-bottom:16px;">设置</div>' +
          '<div style="margin-bottom:12px;">' +
            '<div style="font-size:13px;color:#666;margin-bottom:6px;">AI回复字数限制</div>' +
            '<input type="range" id="sp-word-limit" min="50" max="500" value="' + wordLimit + '" style="width:100%;">' +
            '<div style="text-align:center;font-size:12px;color:#888;" id="sp-word-display">' + wordLimit + ' 字</div>' +
          '</div>' +
          '<button class="spicy-btn spicy-btn-primary spicy-btn-full" id="sp-settings-close" style="background:#5e6570;color:#fff;border:none;padding:8px;border-radius:8px;width:100%;">确定</button>' +
        '</div>'
      document.body.appendChild(overlay)
      var slider = overlay.querySelector('#sp-word-limit')
      var display = overlay.querySelector('#sp-word-display')
      slider.oninput = function() { display.textContent = slider.value + ' 字' }
      overlay.querySelector('#sp-settings-close').onclick = function() {
        wordLimit = parseInt(slider.value)
        overlay.remove()
      }
      overlay.onclick = function(e) { if(e.target === overlay) overlay.remove() }
    }

    sendBtn.onclick = sendUserMessage
    input.onkeydown = function(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage() } }
  }

  // ── 添加消息到聊天记录 ──
  function addMessageToLog(page, msg, charName, userName) {
    var log = page.querySelector('#miss-chat-log')
    if (!log) return
    var html = renderMessage(msg, charName, userName)
    log.insertAdjacentHTML('beforeend', html)
    log.scrollTop = log.scrollHeight
  }

  // ── 输入中指示器 ──
  function addTypingIndicator(page, charName) {
    var log = page.querySelector('#miss-chat-log')
    if (!log) return null
    var id = 'typing-' + Date.now()
    var div = document.createElement('div')
    div.id = id
    div.className = 'miss-entry is-char'
    div.innerHTML =
      '<button class="miss-entry-head" type="button">' +
        '<div class="miss-entry-person">' +
          '<div class="miss-msg-avatar">' + esc(charName.charAt(0)) + '</div>' +
          '<div class="miss-entry-nameblock">' +
            '<div class="miss-msg-name">' + esc(charName) + '</div>' +
          '</div>' +
        '</div>' +
      '</button>' +
      '<div class="miss-entry-card">' +
        '<div class="miss-msg-text"><div class="miss-typing-dots"><span></span><span></span><span></span></div></div>' +
      '</div>'
    log.appendChild(div)
    log.scrollTop = log.scrollHeight
    return id
  }

  function removeTypingIndicator(page, id) {
    if (!id) return
    var el = page.querySelector('#' + id)
    if (el) el.remove()
  }

  // ── 暴露全局接口 ──
  window.SpicyOffline = {
    open: function(gameContext, onBack) {
      showOfflinePage(gameContext, onBack)
    },

    getAIResponse: async function(charId, eventMessage, gameContext) {
      return await callAI(charId, eventMessage, gameContext)
    },

    addSystemMessage: function(text) {
      if (_currentPage) addMessageToLog(_currentPage, { role: 'system', content: text }, '', '')
    },

    addAIMessage: function(name, text) {
      if (_currentPage) addMessageToLog(_currentPage, { role: 'assistant', content: text }, name, '')
    },

    getPage: function() { return _currentPage },

    close: function() {
      if (_currentPage) { _currentPage.remove(); _currentPage = null }
      _chatHistory = []
    },

    resetHistory: function() { _chatHistory = [] }
  }

})()
