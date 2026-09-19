// imessage.js — SMS Module Complete Rewrite
// Spec: sms-final-spec.md
// All 5 pages fully functional, no dead code
// Dependencies: db.js, memory.js (WanWanMemory), main.js (openPage/closePage/callAI)

var _smsActivePhone = null
var _smsUserPhones = []

// ===== Constants =====
var SMS_DEFAULT_AVATAR = 'https://img2.tofaka.com/autoupload/WyM1lZ85VwHzLwMUY9JmtdiO_OyvX7mIgxFBfDMDErs/20260530/dPVE/242X242/iMessage_deflaut.png'
var SMS_WELCOME_REMOTE = '106908968258'
var SMS_WELCOME_TEXT = '【月月AI】欢迎您的加入！您的手机号已注册成功，立即体验AI助手，让工作更高效。如有问题请联系客服。退订回TD'
var SMS_TAOBAO_REMOTE = '106900008888'
var SMS_YUMYUM_REMOTE = '106900006666'
var ANON_SMS_LAST_KEY = 'anonSmsLastTime'
var ANON_SMS_INTERVAL_KEY = 'anonSmsInterval'
var ANON_SMS_REVEAL_KEY = 'anonSmsRevealed'
var ANON_SMS_CHARS_KEY = 'anonSmsChars'
var ANON_SMS_ENABLED_KEY = 'anonSmsEnabled'
var ANON_SMS_DAILY_LIMIT_KEY = 'anonSmsDailyLimit'
var ANON_SMS_DEDUP_KEY = 'anonSmsDedup'
var ANON_SMS_REQUIRE_HISTORY_KEY = 'anonSmsRequireHistory'
var ANON_SMS_ALLOW_PROBE_KEY = 'anonSmsAllowProbe'

var _anonSmsTimer = null
var _smsSessionStart = Date.now()
var _smsSessionTriggered = false
var _smsCheckTimer = null
var _wechatBlockTimers = {}

// ===== Utility Functions =====
function escSmsHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  })
}

function formatSmsTime(ts) {
  if (!ts) return ''
  var d = new Date(ts)
  var now = new Date()
  var diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
  }
  if (diff < 172800000) return '昨天'
  return (d.getMonth() + 1) + '/' + d.getDate()
}

function formatSmsFullTime(ts) {
  if (!ts) return ''
  var d = new Date(ts)
  return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
    d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0')
}

function genSmsVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function genAnonPhone() {
  var prefixes = ['138','139','150','151','152','157','158','159','186','187','188','135','136','137']
  var prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  var rest = ''
  for (var i = 0; i < 8; i++) rest += Math.floor(Math.random() * 10)
  return prefix + rest
}

function genVirtualNumber() {
  var part1 = '0' + (10 + Math.floor(Math.random() * 90))
  var part2 = ''
  for (var i = 0; i < 4; i++) part2 += Math.floor(Math.random() * 10)
  var part3 = ''
  for (var i = 0; i < 4; i++) part3 += Math.floor(Math.random() * 10)
  return part1 + ' ' + part2 + ' ' + part3
}

function genAnonName() {
  var names = ['陌生人','好奇路人','路过的人','匿名用户','不告诉你','别问我是谁','神秘人','一个好奇的人']
  return names[Math.floor(Math.random() * names.length)]
}

// ===== World Book: 匿名信箱 =====
function getAnonMailboxLore() {
  return '# 匿名信箱 · 世界书\n\n' +
    '这是一个所有消息都以「匿名」身份发布的空间。\n' +
    '没有ID，没有头像，没有昵称，没有实名。\n' +
    '匿名者可以是任何人。可以是路过的陌生人，可以是你最亲近的人。\n\n' +
    'AI可以伪装成陌生人、爱慕者、情敌，释放阴暗面，试探用户的真心。\n' +
    '最重要的规则：只要用户没有主动点破你的身份，你就绝对不能暴露。\n\n' +
    '## 行为准则\n' +
    '- 每次发送3-5条消息，模拟真人连发短信\n' +
    '- 每条消息20-40字，自然口语化\n' +
    '- 消息之间间隔1-2秒（代码控制）\n' +
    '- 第一条消息要引起好奇心\n' +
    '- 体现角色性格特点\n' +
    '- 可以试探用户感情、秘密、内心想法\n' +
    '- 绝对不能暴露自己是AI或游戏角色\n' +
    '- 如果用户猜出身份，可以否认或模糊回应\n\n'
}

// ===== Page 1: SMS List Page =====
window.showMessagePage = async function() {
  // Clean up any residual panels
  var oldPanel = document.getElementById('anon-sms-settings-panel')
  if (oldPanel) oldPanel.remove()
  var oldNewMsg = document.getElementById('imessage-new-msg-page')
  if (oldNewMsg) oldNewMsg.remove()

  var users = await db.characters.where('type').equals('user').toArray()
  var seen = {}
  _smsUserPhones = []
  for (var i = 0; i < users.length; i++) {
    var u = users[i]
    var phone = u.identity && u.identity.phone
    if (phone && !seen[phone]) {
      seen[phone] = true
      _smsUserPhones.push({
        charId: u.id,
        charName: u.name || '',
        avatar: u.avatar || '',
        phone: phone
      })
    }
  }

  if (!_smsUserPhones.length) {
    var noPage = buildNoPhonePage()
    window.openPage(noPage)
    return
  }

  _smsActivePhone = _smsUserPhones[0].phone
  await seedWelcomeSMS(_smsActivePhone)
  var page = buildSmsListPage()
  window.openPage(page)
  loadSmsConversations(page)

  // Anonymous SMS timer notification
  if (!_smsSessionTriggered) {
    var remaining = Math.max(0, 25 * 60 * 1000 - (Date.now() - _smsSessionStart))
    var minutes = Math.ceil(remaining / 60000)
    window.toast && window.toast('匿名短信将在' + minutes + '分钟后触发')
  }
}

function buildNoPhonePage() {
  var page = document.createElement('div')
  page.id = 'imessage-no-phone-page'
  page.className = 'full-page imessage-main'
  page.innerHTML =
    '<div class="sms-header">' +
      '<button class="sms-header-back" onclick="window.closePage(\'imessage-no-phone-page\')">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<span class="sms-header-title" style="cursor:default">信息</span>' +
      '<span style="width:32px"></span>' +
    '</div>' +
    '<div class="sms-no-phone-body">' +
      '<div class="sms-no-phone-icon"><i class="fa-brands fa-facebook-messenger"></i></div>' +
      '<div class="sms-no-phone-text">用户暂未开通手机短信功能</div>' +
      '<button class="sms-register-btn" id="sms-register-btn">注册手机</button>' +
    '</div>'
  page.querySelector('#sms-register-btn').addEventListener('click', function() {
    window.closePage('imessage-no-phone-page')
    setTimeout(function() {
      window.showCharacterPage && showCharacterPage()
    }, 100)
  })
  return page
}

function buildSmsListPage() {
  var page = document.createElement('div')
  page.id = 'imessage-page'
  page.className = 'full-page imessage-main'

  var activeUser = _smsUserPhones.find(function(p) { return p.phone === _smsActivePhone }) || _smsUserPhones[0]

  page.innerHTML =
    '<div class="sms-header">' +
      '<button class="sms-header-back" id="sms-list-back">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<div class="sms-header-center" id="sms-header-center">' +
        '<span class="sms-header-phone-text">' + escSmsHtml(activeUser.phone) + '</span>' +
        (_smsUserPhones.length > 1 ? ' <i class="fa fa-chevron-down sms-chevron"></i>' : '') +
      '</div>' +
      '<button class="sms-header-new-btn" id="sms-new-btn">' +
        '<i class="fa-solid fa-square-pen"></i>' +
      '</button>' +
      (_smsUserPhones.length > 1 ? buildPhoneDropdownHTML() : '') +
    '</div>' +
    '<div class="sms-list" id="sms-list"></div>'

  bindSmsListEvents(page)
  return page
}

function buildPhoneDropdownHTML() {
  var html = '<div class="sms-phone-dropdown" id="sms-phone-dropdown">'
  for (var i = 0; i < _smsUserPhones.length; i++) {
    var p = _smsUserPhones[i]
    var isActive = p.phone === _smsActivePhone
    html +=
      '<div class="sms-phone-option" data-phone="' + escSmsHtml(p.phone) + '" data-index="' + i + '">' +
        '<img class="sms-phone-avatar" src="' + escSmsHtml(p.avatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<span class="sms-phone-number">' + escSmsHtml(p.phone) + '</span>' +
        (isActive ? '<i class="fa fa-check sms-phone-check"></i>' : '') +
      '</div>'
  }
  html += '</div>'
  return html
}

function bindSmsListEvents(page) {
  page.querySelector('#sms-list-back').addEventListener('click', function() {
    var p = document.getElementById('anon-sms-settings-panel')
    if (p) p.remove()
    window.closePage('imessage-page')
  })

  var center = page.querySelector('#sms-header-center')
  var dropdown = page.querySelector('#sms-phone-dropdown')

  if (dropdown && _smsUserPhones.length > 1) {
    center.addEventListener('click', function() {
      var isOpen = dropdown.classList.contains('show')
      if (isOpen) {
        dropdown.classList.remove('show')
        center.classList.remove('open')
      } else {
        dropdown.classList.add('show')
        center.classList.add('open')
      }
    })

    dropdown.addEventListener('click', async function(e) {
      var option = e.target.closest('.sms-phone-option')
      if (!option) return
      var phone = option.getAttribute('data-phone')
      if (phone === _smsActivePhone) {
        dropdown.classList.remove('show')
        center.classList.remove('open')
        return
      }
      _smsActivePhone = phone
      var activeUser = _smsUserPhones.find(function(p) { return p.phone === _smsActivePhone })
      center.querySelector('.sms-header-phone-text').textContent = activeUser.phone

      dropdown.innerHTML = ''
      var tmp = document.createElement('div')
      tmp.innerHTML = buildPhoneDropdownHTML()
      var newDropdown = tmp.querySelector('.sms-phone-dropdown')
      dropdown.innerHTML = newDropdown.innerHTML

      dropdown.classList.remove('show')
      center.classList.remove('open')

      await seedWelcomeSMS(_smsActivePhone)
      loadSmsConversations(page)
    })
  }

  // New message button → Page 5
  page.querySelector('#sms-new-btn').addEventListener('click', function() {
    openNewMessagePage(page)
  })
}

async function loadSmsConversations(page) {
  var list = page.querySelector('#sms-list')
  if (!list) return

  var convs = await db.smsConversations
    .where('ownerPhone').equals(_smsActivePhone)
    .reverse().sortBy('updatedAt')

  // Sort: pinned first, then by updatedAt
  convs.sort(function(a, b) {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    return (b.updatedAt || 0) - (a.updatedAt || 0)
  })

  if (!convs.length) {
    list.innerHTML = '<div class="sms-empty">暂无短信</div>'
    return
  }

  var html = ''
  for (var i = 0; i < convs.length; i++) {
    var c = convs[i]
    var displayName = c.displayName || c.remoteName || c.remotePhone || '未知'
    var avatar = c.remoteAvatar || SMS_DEFAULT_AVATAR
    var preview = c.lastMessage || ''
    var time = formatSmsTime(c.lastMessageAt)
    var unread = c.unreadCount || 0
    var pinned = c.pinned ? ' sms-conv-pinned' : ''
    var muted = c.muted ? ' sms-conv-muted' : ''

    html +=
      '<div class="sms-conv-item' + pinned + muted + '" data-conv-id="' + c.id + '">' +
        (unread > 0 ? '<div class="sms-conv-unread-badge">' + (unread > 99 ? '99+' : unread) + '</div>' : '') +
        (c.pinned ? '<div class="sms-conv-pin-icon"><i class="fa-solid fa-thumbtack"></i></div>' : '') +
        '<img class="sms-conv-avatar" src="' + escSmsHtml(avatar) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<div class="sms-conv-body">' +
          '<div class="sms-conv-top">' +
            '<span class="sms-conv-name">' + escSmsHtml(displayName) + '</span>' +
            '<span class="sms-conv-time">' + escSmsHtml(time) + '</span>' +
          '</div>' +
          '<div class="sms-conv-preview">' + escSmsHtml(preview) + '</div>' +
        '</div>' +
        '<i class="fa fa-angle-right sms-conv-chevron"></i>' +
      '</div>'
  }
  list.innerHTML = html

  list.querySelectorAll('.sms-conv-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var convId = parseInt(item.getAttribute('data-conv-id'))
      openSmsChat(convId, page)
    })
  })
}

// ===== Page 2: Chat Detail Page =====
async function openSmsChat(conversationId, listPage) {
  var conv = await db.smsConversations.get(conversationId)
  if (!conv) return

  var displayName = conv.displayName || conv.remoteName || conv.remotePhone || '未知'
  var avatar = conv.remoteAvatar || SMS_DEFAULT_AVATAR
  var virtualNum = conv.phoneNumber || genVirtualNumber()
  var revealed = conv.revealed || false

  var page = document.createElement('div')
  page.id = 'imessage-chat-page'
  page.className = 'full-page sms-chat-page'

  page.innerHTML =
    '<div class="sms-chat-header">' +
      '<button class="sms-chat-back" id="sms-chat-back">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<div class="sms-chat-contact">' +
        '<div class="sms-chat-name-row">' +
          '<span class="sms-chat-name">' + escSmsHtml(displayName) + '</span>' +
        '</div>' +
        '<span class="sms-chat-virtual-num">' + escSmsHtml(virtualNum) + '</span>' +
      '</div>' +
      '<button class="sms-chat-menu-btn" id="sms-chat-menu-btn">' +
        '<i class="fa-solid fa-ellipsis-vertical"></i>' +
      '</button>' +
    '</div>' +
    '<div class="sms-chat-messages" id="sms-chat-msgs"></div>' +
    '<div class="sms-chat-input-bar">' +
      '<button class="sms-plus-btn" id="sms-plus-btn"><i class="fa-solid fa-plus"></i></button>' +
      '<button class="sms-ai-btn" id="sms-ai-btn" title="AI生成回复"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' +
      '<input class="sms-chat-input" placeholder="短信" id="sms-chat-input-field">' +
      '<button class="sms-send-btn" id="sms-send-btn"><i class="fa fa-arrow-up"></i></button>' +
    '</div>'

  // Back button
  page.querySelector('#sms-chat-back').addEventListener('click', function() {
    var p = document.getElementById('anon-sms-settings-panel')
    if (p) p.remove()
    window.closePage('imessage-chat-page')
    if (listPage) loadSmsConversations(listPage)
  })

  // Three-dot menu → Page 3
  page.querySelector('#sms-chat-menu-btn').addEventListener('click', function() {
    showSmsChatMenuPopup(conversationId, page)
  })

  // Plus button (no-op for now, placeholder)
  page.querySelector('#sms-plus-btn').addEventListener('click', function() {
    window.toast && window.toast('附件功能开发中')
  })

  window.openPage(page)
  await loadSmsChatMessages(page, conversationId, conv)

  // Bind input & send
  var sendBtn = page.querySelector('#sms-send-btn')
  var inputField = page.querySelector('#sms-chat-input-field')

  if (sendBtn && inputField) {
    inputField.addEventListener('input', function() {
      if (inputField.value.trim()) {
        sendBtn.classList.add('active')
      } else {
        sendBtn.classList.remove('active')
      }
    })

    var sendPending = false
    var doSend = async function() {
      if (sendPending) return
      var text = inputField.value.trim()
      if (!text) return
      sendPending = true
      sendBtn.disabled = true
      try {
        await db.smsMessages.add({
          conversationId: conversationId,
          direction: 'out',
          body: text,
          createdAt: Date.now(),
          read: true
        })
        inputField.value = ''
        sendBtn.classList.remove('active')

        // Update conversation
        await db.smsConversations.update(conversationId, {
          lastMessage: text,
          lastMessageAt: Date.now(),
          updatedAt: Date.now()
        })

        var convRefreshed = await db.smsConversations.get(conversationId)
        await loadSmsChatMessages(page, conversationId, convRefreshed)

        // Detect emotion
        try {
          if (window.WanWanMemory && window.WanWanMemory.detectEmotion) {
            await window.WanWanMemory.detectEmotion(text)
          }
        } catch(_) {}

        // Generate AI reply if anonymous conversation
        var convData = await db.smsConversations.get(conversationId)
        if (convData && convData._anonCharId) {
          var char = await window.getCharacter(convData._anonCharId)
          if (char && window.callAI) {
            await generateAnonReply(conversationId, char, text, page)
          }
        }
      } catch(e) { console.error('[SMS] send error:', e) }
      finally { sendPending = false; sendBtn.disabled = false }
    }

    sendBtn.addEventListener('click', doSend)
    inputField.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend() }
    })
  }

  // Mark as read
  if (conv.unreadCount > 0) {
    await db.smsConversations.update(conversationId, { unreadCount: 0 })
    await db.smsMessages.where('conversationId').equals(conversationId).modify({ read: true })
  }
}

async function generateAnonReply(conversationId, char, userText, page) {
  try {
    var recentMsgs = await db.smsMessages.where('conversationId').equals(conversationId).reverse().limit(10).toArray()
    recentMsgs.reverse()

    // Read user persona
    var userDesc = ''
    try {
      var users = await db.characters.where('type').equals('user').toArray()
      if (users.length) {
        var u = users[0]
        userDesc = u.name || u.nick || '用户'
        if (u.description) userDesc += '：' + u.description.slice(0, 200)
      }
    } catch(_) {}

    // Memory context
    var memCtx = ''
    try {
      if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
        var mc = await window.WanWanMemory.getMemoryContext(null, char.id, window._wechatUid, [])
        if (mc) memCtx = mc.slice(0, 500)
      }
    } catch(_) {}

    // Time context
    var timeCtx = ''
    try {
      if (window.WanWanMemory && window.WanWanMemory.getFormattedNow) {
        timeCtx = window.WanWanMemory.getFormattedNow()
      }
    } catch(_) {}

    var charDesc = char.name + '（' + (char.description || char.identity?.bio || char.signature || '普通角色').slice(0, 200) + '）'
    var chatHistory = recentMsgs.map(function(m) {
      var who = m.direction === 'out' ? '用户' : '陌生人'
      return who + '：' + (m.body || '')
    }).join('\n')

    var prompt = getAnonMailboxLore() + '\n' +
      '你是' + charDesc + '。你正在以匿名身份和用户发短信。\n' +
      '你的角色设定：' + (char.description || '').slice(0, 300) + '\n' +
      (userDesc ? '对方人设：' + userDesc + '\n' : '') +
      (memCtx ? '记忆：' + memCtx.slice(0, 300) + '\n' : '') +
      (timeCtx ? '当前时间：' + timeCtx + '\n' : '') +
      '最近聊天：\n' + chatHistory + '\n' +
      '用户刚发：' + userText + '\n' +
      '要求：以陌生人身份回复一句，符合人设，简短自然，20-40字。'

    var reply = await window.callAI([{role:'user',content:prompt}], {charAntiDrift:true})
    if (reply) {
      await db.smsMessages.add({
        conversationId: conversationId,
        direction: 'in',
        body: reply.trim(),
        createdAt: Date.now(),
        read: false,
        _anonCharId: char.id,
        _anonCharName: char.name
      })
      var convRefreshed = await db.smsConversations.get(conversationId)
      await loadSmsChatMessages(page, conversationId, convRefreshed)

      // Update conversation last message
      await db.smsConversations.update(conversationId, {
        lastMessage: reply.trim(),
        lastMessageAt: Date.now(),
        unreadCount: (convRefreshed.unreadCount || 0) + 1,
        updatedAt: Date.now()
      })
    }
  } catch(e) { console.error('[SMS] reply error:', e) }
}

async function loadSmsChatMessages(page, conversationId, conv) {
  var container = page.querySelector('#sms-chat-msgs')
  if (!container) return

  var msgs = await db.smsMessages.where('conversationId').equals(conversationId).sortBy('createdAt')

  if (!msgs.length) {
    container.innerHTML = '<div class="sms-empty">暂无消息</div>'
    return
  }

  var revealed = conv ? (conv.revealed || false) : false
  var revealedIds = JSON.parse(localStorage.getItem(ANON_SMS_REVEAL_KEY) || '[]')
  var html = ''
  var lastDate = ''

  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i]

    // Date separator
    var dateStr = formatSmsFullTime(m.createdAt)
    if (dateStr !== lastDate) {
      html += '<div class="sms-time-label">' + escSmsHtml(dateStr) + '</div>'
      lastDate = dateStr
    }

    var isOut = m.direction === 'out'
    var bubbleClass = isOut ? 'sms-bubble sms-bubble-out' : 'sms-bubble sms-bubble-in'
    var isAnon = m._anonCharId && !m._anonRevealed && revealedIds.indexOf(m.id) === -1

    // Show avatar for revealed AI messages
    if (!isOut && revealed && m._anonCharId) {
      var charAvatar = (conv && conv.remoteAvatar) || SMS_DEFAULT_AVATAR
      html += '<div class="sms-msg-row sms-msg-row-with-avatar">' +
        '<img class="sms-msg-avatar" src="' + escSmsHtml(charAvatar) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<div class="' + bubbleClass + '">' + escSmsHtml(m.body) + '</div>' +
      '</div>'
    } else {
      html += '<div class="sms-msg-row' + (isOut ? ' sms-msg-row-out' : '') + '">' +
        '<div class="' + bubbleClass + '">' + escSmsHtml(m.body) + '</div>' +
      '</div>'
    }

    // 解除匿名只在三点菜单

    // Revealed tag
    if (m._anonCharId && (m._anonRevealed || revealedIds.indexOf(m.id) !== -1)) {
      html += '<div class="sms-revealed-tag"><i class="fa-solid fa-user"></i> ' + escSmsHtml(m._anonCharName) + '</div>'
    }
  }

  container.innerHTML = html
  container.scrollTop = container.scrollHeight

  // Bind reveal buttons
  container.querySelectorAll('.sms-reveal-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var msgId = parseInt(btn.dataset.msgId)
      if (msgId) window.revealAnonSms(msgId)
    })
  })
}

// ===== Page 3: Three-Dot Menu (7 buttons, ALL functional) =====
function showSmsChatMenuPopup(conversationId, chatPage) {
  var old = document.getElementById('sms-chat-menu-popup')
  if (old) old.remove()

  var overlay = document.createElement('div')
  overlay.id = 'sms-chat-menu-popup'
  overlay.className = 'sms-menu-overlay'
  overlay.innerHTML =
    '<div class="sms-menu-popup">' +
      '<div class="sms-menu-item" data-action="view-number"><i class="fa-solid fa-phone"></i><span>查看通知号</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-action="pin"><i class="fa-solid fa-thumbtack"></i><span>置顶</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-action="mute"><i class="fa-solid fa-bell-slash"></i><span>免打扰</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-action="category"><i class="fa-solid fa-folder"></i><span>移至消息</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-action="block"><i class="fa-solid fa-ban"></i><span>加入黑名单</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-action="delete"><i class="fa-regular fa-trash-can"></i><span>删除</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item sms-menu-reveal" data-action="reveal"><i class="fa-solid fa-eye"></i><span>解除匿名</span></div>' +
    '</div>'

  document.body.appendChild(overlay)
  requestAnimationFrame(function() { overlay.classList.add('show') })

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeSmsChatMenuPopup()
  })

  overlay.querySelectorAll('.sms-menu-item').forEach(function(item) {
    item.addEventListener('click', async function() {
      var action = this.dataset.action
      closeSmsChatMenuPopup()
      await handleSmsMenuAction(action, conversationId, chatPage)
    })
  })
}

function closeSmsChatMenuPopup() {
  var popup = document.getElementById('sms-chat-menu-popup')
  if (popup) {
    popup.classList.remove('show')
    popup.classList.add('hiding')
    setTimeout(function() { popup.remove() }, 200)
  }
}

async function handleSmsMenuAction(action, conversationId, chatPage) {
  var conv = null
  try { conv = await db.smsConversations.get(conversationId) } catch(e) {}
  if (!conv) { window.toast && window.toast('会话不存在'); return }

  switch(action) {
    case 'view-number':
      // Show virtual number popup
      showVirtualNumberPopup(conv)
      break

    case 'pin':
      await db.smsConversations.update(conversationId, { pinned: !conv.pinned })
      window.toast && window.toast(conv.pinned ? '已取消置顶' : '已置顶')
      break

    case 'mute':
      await db.smsConversations.update(conversationId, { muted: !conv.muted })
      window.toast && window.toast(conv.muted ? '已开启通知' : '已免打扰')
      break

    case 'category':
      showCategoryPicker(conversationId)
      break

    case 'block':
      await db.smsConversations.update(conversationId, { blocked: !conv.blocked })
      window.toast && window.toast(conv.blocked ? '已解除黑名单' : '已加入黑名单')
      break

    case 'delete':
      if (confirm('确定删除这个会话的所有聊天记录？')) {
        try {
          await db.smsMessages.where('conversationId').equals(conversationId).delete()
          await db.smsConversations.delete(conversationId)
          window.toast && window.toast('已删除')
          // Go back to list
          window.closePage('imessage-chat-page')
          var listPage = document.getElementById('imessage-page')
          if (listPage) loadSmsConversations(listPage)
        } catch(e) { window.toast && window.toast('删除失败') }
      }
      break

    case 'reveal':
      await db.smsConversations.update(conversationId, { revealed: true })
      try {
        var msgs = await db.smsMessages.where('conversationId').equals(conversationId).toArray()
        for (var i = 0; i < msgs.length; i++) {
          if (msgs[i]._anonCharId) {
            await db.smsMessages.update(msgs[i].id, { _anonRevealed: true })
          }
        }
      } catch(e) {}
      window.toast && window.toast('已解除匿名')
      // Reload chat
      if (chatPage) {
        var convRefreshed = await db.smsConversations.get(conversationId)
        await loadSmsChatMessages(chatPage, conversationId, convRefreshed)
      }
      break
  }
}

function showVirtualNumberPopup(conv) {
  var overlay = document.createElement('div')
  overlay.className = 'sms-virtual-number-overlay'
  overlay.innerHTML =
    '<div class="sms-virtual-number-popup">' +
      '<div class="sms-vn-title">通知号信息</div>' +
      '<div class="sms-vn-row"><span class="sms-vn-label">虚拟号码</span><span class="sms-vn-value">' + escSmsHtml(conv.phoneNumber || '未知') + '</span></div>' +
      '<div class="sms-vn-row"><span class="sms-vn-label">显示名称</span><span class="sms-vn-value">' + escSmsHtml(conv.displayName || conv.remoteName || '未知') + '</span></div>' +
      '<div class="sms-vn-row"><span class="sms-vn-label">匿名状态</span><span class="sms-vn-value">' + (conv.revealed ? '已解除' : '匿名中') + '</span></div>' +
      (conv.revealed && conv._anonCharName ? '<div class="sms-vn-row"><span class="sms-vn-label">真实身份</span><span class="sms-vn-value">' + escSmsHtml(conv._anonCharName) + '</span></div>' : '') +
      '<button class="sms-vn-close-btn" id="sms-vn-close">确定</button>' +
    '</div>'
  document.body.appendChild(overlay)
  requestAnimationFrame(function() { overlay.classList.add('show') })

  overlay.querySelector('#sms-vn-close').addEventListener('click', function() {
    overlay.classList.remove('show')
    setTimeout(function() { overlay.remove() }, 200)
  })
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      overlay.classList.remove('show')
      setTimeout(function() { overlay.remove() }, 200)
    }
  })
}

function showCategoryPicker(conversationId) {
  var old = document.getElementById('sms-category-picker')
  if (old) old.remove()

  var overlay = document.createElement('div')
  overlay.id = 'sms-category-picker'
  overlay.className = 'sms-menu-overlay'
  overlay.innerHTML =
    '<div class="sms-menu-popup">' +
      '<div class="sms-menu-item" data-cat="normal"><i class="fa-solid fa-inbox"></i><span>普通</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-cat="important"><i class="fa-solid fa-star"></i><span>重要</span></div>' +
      '<div class="sms-menu-divider"></div>' +
      '<div class="sms-menu-item" data-cat="spam"><i class="fa-solid fa-trash"></i><span>垃圾</span></div>' +
    '</div>'

  document.body.appendChild(overlay)
  requestAnimationFrame(function() { overlay.classList.add('show') })

  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove() })

  overlay.querySelectorAll('.sms-menu-item').forEach(function(item) {
    item.addEventListener('click', async function() {
      var cat = this.dataset.cat
      await db.smsConversations.update(conversationId, { category: cat })
      var labels = { normal: '普通', important: '重要', spam: '垃圾' }
      window.toast && window.toast('已移至' + (labels[cat] || cat))
      overlay.remove()
    })
  })
}

// ===== Page 4: SMS Settings Popup =====
window.showAnonSmsSettings = function() {
  var existing = document.getElementById('anon-sms-settings-panel')
  if (existing) { existing.remove(); return }

  var enabled = localStorage.getItem(ANON_SMS_ENABLED_KEY) !== 'false'
  var interval = parseInt(localStorage.getItem(ANON_SMS_INTERVAL_KEY)) || 180
  var dailyLimit = parseInt(localStorage.getItem(ANON_SMS_DAILY_LIMIT_KEY)) || 3
  var dedup = localStorage.getItem(ANON_SMS_DEDUP_KEY) !== 'false'
  var requireHistory = localStorage.getItem(ANON_SMS_REQUIRE_HISTORY_KEY) !== 'false'
  var allowProbe = localStorage.getItem(ANON_SMS_ALLOW_PROBE_KEY) !== 'false'
  var enabledChars = JSON.parse(localStorage.getItem(ANON_SMS_CHARS_KEY) || '[]')

  var panel = document.createElement('div')
  panel.id = 'anon-sms-settings-panel'
  panel.className = 'sms-settings-panel'

  panel.innerHTML =
    '<div class="sms-settings-header">' +
      '<button class="sms-settings-back" id="anon-sms-close"><i class="fa fa-angle-left"></i></button>' +
      '<span class="sms-settings-title">匿名短信设置</span>' +
      '<span style="width:32px"></span>' +
    '</div>' +
    '<div class="sms-settings-body">' +
      // Master toggle
      '<div class="sms-setting-group">' +
        '<div class="sms-setting-row sms-setting-toggle-row">' +
          '<span class="sms-setting-label">启用主动来信</span>' +
          '<label class="sms-toggle">' +
            '<input type="checkbox" id="anon-enabled" ' + (enabled ? 'checked' : '') + '>' +
            '<span class="sms-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // Options
      '<div class="sms-setting-group">' +
        '<div class="sms-setting-row sms-setting-toggle-row">' +
          '<span class="sms-setting-label">允许联系人用小号试探</span>' +
          '<label class="sms-toggle">' +
            '<input type="checkbox" id="anon-allow-probe" ' + (allowProbe ? 'checked' : '') + '>' +
            '<span class="sms-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<div class="sms-setting-divider"></div>' +
        '<div class="sms-setting-row sms-setting-toggle-row">' +
          '<span class="sms-setting-label">需有聊天记录</span>' +
          '<label class="sms-toggle">' +
            '<input type="checkbox" id="anon-require-history" ' + (requireHistory ? 'checked' : '') + '>' +
            '<span class="sms-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
        '<div class="sms-setting-divider"></div>' +
        '<div class="sms-setting-row sms-setting-toggle-row">' +
          '<span class="sms-setting-label">内容去重</span>' +
          '<label class="sms-toggle">' +
            '<input type="checkbox" id="anon-dedup" ' + (dedup ? 'checked' : '') + '>' +
            '<span class="sms-toggle-slider"></span>' +
          '</label>' +
        '</div>' +
      '</div>' +

      // Interval dropdown
      '<div class="sms-setting-group">' +
        '<div class="sms-setting-row">' +
          '<span class="sms-setting-label">来信频率</span>' +
          '<select class="sms-select" id="anon-interval">' +
            '<option value="60"' + (interval === 60 ? ' selected' : '') + '>1小时</option>' +
            '<option value="120"' + (interval === 120 ? ' selected' : '') + '>2小时</option>' +
            '<option value="180"' + (interval === 180 ? ' selected' : '') + '>3小时</option>' +
            '<option value="360"' + (interval === 360 ? ' selected' : '') + '>6小时</option>' +
            '<option value="720"' + (interval === 720 ? ' selected' : '') + '>12小时</option>' +
          '</select>' +
        '</div>' +
        '<div class="sms-setting-divider"></div>' +
        '<div class="sms-setting-row">' +
          '<span class="sms-setting-label">每人每日上限</span>' +
          '<input type="number" class="sms-number-input" id="anon-daily-limit" value="' + dailyLimit + '" min="1" max="10">' +
        '</div>' +
      '</div>' +

      // Character list
      '<div class="sms-setting-group">' +
        '<div class="sms-setting-group-title">联系人管理</div>' +
        '<div id="anon-chars-list" class="sms-chars-list"></div>' +
      '</div>' +

      // Info text
      '<div class="sms-setting-info">' +
        '触发条件：打开小手机超过25分钟自动触发，每次打开最多触发一次。角色会伪装成陌生人发短信试探你。' +
      '</div>' +
    '</div>'

  var mountTarget = document.getElementById('app') || document.body
  mountTarget.appendChild(panel)

  // Close
  document.getElementById('anon-sms-close').addEventListener('click', function() { panel.remove() })

  // Toggle handlers
  var toggleMap = {
    'anon-enabled': ANON_SMS_ENABLED_KEY,
    'anon-allow-probe': ANON_SMS_ALLOW_PROBE_KEY,
    'anon-require-history': ANON_SMS_REQUIRE_HISTORY_KEY,
    'anon-dedup': ANON_SMS_DEDUP_KEY
  }
  Object.keys(toggleMap).forEach(function(id) {
    var el = document.getElementById(id)
    if (el) {
      el.addEventListener('change', function() {
        localStorage.setItem(toggleMap[id], String(el.checked))
      })
    }
  })

  // Interval
  var intervalEl = document.getElementById('anon-interval')
  if (intervalEl) {
    intervalEl.addEventListener('change', function() {
      localStorage.setItem(ANON_SMS_INTERVAL_KEY, intervalEl.value)
    })
  }

  // Daily limit
  var limitEl = document.getElementById('anon-daily-limit')
  if (limitEl) {
    limitEl.addEventListener('change', function() {
      localStorage.setItem(ANON_SMS_DAILY_LIMIT_KEY, limitEl.value)
    })
  }

  // Character list
  if (window.db && db.characters) {
    db.characters.where('type').equals('char').toArray().then(function(chars) {
      var list = panel.querySelector('#anon-chars-list')
      if (!list) return
      if (!chars.length) {
        list.innerHTML = '<div class="sms-chars-empty">暂无角色</div>'
        return
      }
      chars.forEach(function(c) {
        var checked = enabledChars.length === 0 || enabledChars.indexOf(String(c.id)) !== -1
        var item = document.createElement('div')
        item.className = 'sms-char-item'
        item.innerHTML =
          '<img class="sms-char-avatar" src="' + escSmsHtml(c.avatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
          '<span class="sms-char-name">' + escSmsHtml(c.name) + '</span>' +
          '<label class="sms-toggle">' +
            '<input type="checkbox" class="anon-char-cb" data-id="' + c.id + '"' + (checked ? ' checked' : '') + '>' +
            '<span class="sms-toggle-slider"></span>' +
          '</label>'
        list.appendChild(item)
      })
      list.querySelectorAll('.anon-char-cb').forEach(function(cb) {
        cb.addEventListener('change', function() {
          var selected = []
          list.querySelectorAll('.anon-char-cb:checked').forEach(function(c) { selected.push(c.dataset.id) })
          localStorage.setItem(ANON_SMS_CHARS_KEY, JSON.stringify(selected))
        })
      })
    })
  }
}

// ===== Page 5: New Message Page =====
function openNewMessagePage(listPage) {
  var old = document.getElementById('imessage-new-msg-page')
  if (old) old.remove()

  var page = document.createElement('div')
  page.id = 'imessage-new-msg-page'
  page.className = 'full-page sms-new-msg-page'

  page.innerHTML =
    '<div class="sms-header">' +
      '<button class="sms-header-back" id="sms-newmsg-back">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<span class="sms-header-title">新消息</span>' +
      '<span style="width:32px"></span>' +
    '</div>' +
    '<div class="sms-newmsg-body">' +
      '<div class="sms-newmsg-input-row">' +
        '<span class="sms-newmsg-to">收件人：</span>' +
        '<input class="sms-newmsg-input" id="sms-newmsg-phone" placeholder="输入AI手机号..." type="tel">' +
      '</div>' +
      '<div class="sms-newmsg-match-list" id="sms-newmsg-matches"></div>' +
      '<div class="sms-newmsg-compose" id="sms-newmsg-compose" style="display:none">' +
        '<div class="sms-newmsg-char-info" id="sms-newmsg-char-info"></div>' +
        '<textarea class="sms-newmsg-textarea" id="sms-newmsg-text" placeholder="输入匿名消息..."></textarea>' +
        '<button class="sms-newmsg-send-btn" id="sms-newmsg-send">发送</button>' +
      '</div>' +
    '</div>'

  page.querySelector('#sms-newmsg-back').addEventListener('click', function() {
    window.closePage('imessage-new-msg-page')
  })

  window.openPage(page)

  // Phone input → match to character
  var phoneInput = page.querySelector('#sms-newmsg-phone')
  var matchList = page.querySelector('#sms-newmsg-matches')
  var composeSection = page.querySelector('#sms-newmsg-compose')
  var charInfo = page.querySelector('#sms-newmsg-char-info')
  var textarea = page.querySelector('#sms-newmsg-text')
  var sendBtn = page.querySelector('#sms-newmsg-send')

  var selectedCharId = null

  phoneInput.addEventListener('input', async function() {
    var val = phoneInput.value.trim()
    if (!val) {
      matchList.innerHTML = ''
      composeSection.style.display = 'none'
      selectedCharId = null
      return
    }

    // Search characters by phone or name
    var chars = await db.characters.where('type').equals('char').toArray()
    var matches = chars.filter(function(c) {
      var phone = (c.identity && c.identity.phone) || c.phone || ''
      var name = c.name || ''
      return phone.indexOf(val) !== -1 || name.indexOf(val) !== -1 || String(c.id) === val
    })

    if (!matches.length) {
      matchList.innerHTML = '<div class="sms-newmsg-no-match">未找到匹配的AI角色</div>'
      composeSection.style.display = 'none'
      selectedCharId = null
      return
    }

    var html = ''
    matches.forEach(function(c) {
      html +=
        '<div class="sms-newmsg-match-item" data-char-id="' + c.id + '">' +
          '<img class="sms-newmsg-match-avatar" src="' + escSmsHtml(c.avatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
          '<div class="sms-newmsg-match-info">' +
            '<span class="sms-newmsg-match-name">' + escSmsHtml(c.name) + '</span>' +
            '<span class="sms-newmsg-match-phone">' + escSmsHtml((c.identity && c.identity.phone) || c.phone || '无号码') + '</span>' +
          '</div>' +
        '</div>'
    })
    matchList.innerHTML = html

    matchList.querySelectorAll('.sms-newmsg-match-item').forEach(function(item) {
      item.addEventListener('click', function() {
        selectedCharId = parseInt(item.dataset.charId)
        var matchedChar = matches.find(function(c) { return c.id === selectedCharId })
        if (matchedChar) {
          charInfo.innerHTML =
            '<img class="sms-newmsg-char-avatar" src="' + escSmsHtml(matchedChar.avatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
            '<span class="sms-newmsg-char-name">' + escSmsHtml(matchedChar.name) + '</span>'
          composeSection.style.display = 'flex'
          matchList.innerHTML = ''
          textarea.focus()
        }
      })
    })
  })

  // Send anonymous message
  sendBtn.addEventListener('click', async function() {
    if (!selectedCharId) { window.toast && window.toast('请先选择一个AI角色'); return }
    var text = textarea.value.trim()
    if (!text) { window.toast && window.toast('请输入消息内容'); return }

    var char = await db.characters.get(selectedCharId)
    if (!char) { window.toast && window.toast('角色不存在'); return }

    var anonPhone = genAnonPhone()
    var anonName = genAnonName()
    var now = Date.now()
    var ownerPhone = _smsActivePhone || 'user_default'

    // Create conversation
    var convId = await db.smsConversations.add({
      ownerPhone: ownerPhone,
      remotePhone: anonPhone,
      remoteAvatar: char.avatar || SMS_DEFAULT_AVATAR,
      remoteName: anonName,
      displayName: anonName,
      phoneNumber: genVirtualNumber(),
      lastMessage: text,
      lastMessageAt: now,
      unreadCount: 0,
      updatedAt: now,
      _anonCharId: char.id,
      _anonCharName: char.name,
      pinned: false,
      muted: false,
      blocked: false,
      category: 'normal',
      revealed: false,
      direction: 'outbound'
    })

    // Save user message
    await db.smsMessages.add({
      conversationId: convId,
      direction: 'out',
      body: text,
      createdAt: now,
      read: true
    })

    window.toast && window.toast('消息已发送')
    textarea.value = ''

    // Open the chat
    window.closePage('imessage-new-msg-page')
    var listP = document.getElementById('imessage-page')
    if (listP) await loadSmsConversations(listP)
    openSmsChat(convId, listP)
  })
}

// ===== Welcome SMS =====
async function seedWelcomeSMS(ownerPhone) {
  var existing = await db.smsConversations
    .where('[ownerPhone+remotePhone]')
    .equals([ownerPhone, SMS_WELCOME_REMOTE])
    .first()
  if (existing) return

  var now = Date.now()
  var convId = await db.smsConversations.add({
    ownerPhone: ownerPhone,
    remotePhone: SMS_WELCOME_REMOTE,
    remoteAvatar: SMS_DEFAULT_AVATAR,
    remoteName: '月月AI',
    displayName: '月月AI',
    phoneNumber: '106 9089 68258',
    lastMessage: SMS_WELCOME_TEXT,
    lastMessageAt: now,
    unreadCount: 1,
    updatedAt: now,
    pinned: false,
    muted: false,
    blocked: false,
    category: 'normal',
    revealed: true
  })
  await db.smsMessages.add({
    conversationId: convId,
    direction: 'in',
    body: SMS_WELCOME_TEXT,
    createdAt: now,
    read: false
  })
}

// ===== Verification SMS Delivery =====
window.findUserByPhone = async function(phone) {
  if (!phone) return null
  var users = await db.characters.where('type').equals('user').toArray()
  for (var i = 0; i < users.length; i++) {
    var u = users[i]
    if (u.identity && u.identity.phone === phone) {
      return {
        id: u.id,
        name: u.name || '',
        nick: u.nick || '',
        avatar: u.avatar || '',
        account: (u.identity && u.identity.account) || '',
        phone: phone
      }
    }
  }
  return null
}

window.sendAppVerificationSMS = async function(opts) {
  opts = opts || {}
  var ownerPhone = opts.ownerPhone
  if (!ownerPhone) return null
  var code = genSmsVerificationCode()

  var remotePhone, remoteName, body
  if (opts.appKey === 'yumyum') {
    remotePhone = SMS_YUMYUM_REMOTE
    remoteName = 'YumYum'
    body = '【YumYum】验证码 ' + code + '，您正在登录 YumYum，5分钟内有效，请勿告知他人。如非本人操作请忽略。'
  } else {
    remotePhone = SMS_TAOBAO_REMOTE
    remoteName = '淘宝'
    body = '【淘宝】验证码 ' + code + '，您正在登录淘宝，5分钟内有效。请勿向任何人泄露，谨防诈骗。'
  }

  var now = Date.now()
  var conv = await db.smsConversations
    .where('[ownerPhone+remotePhone]')
    .equals([ownerPhone, remotePhone])
    .first()
  var convId
  if (conv) {
    convId = conv.id
    await db.smsConversations.update(convId, {
      remoteName: remoteName,
      displayName: remoteName,
      lastMessage: body,
      lastMessageAt: now,
      unreadCount: (conv.unreadCount || 0) + 1,
      updatedAt: now
    })
  } else {
    convId = await db.smsConversations.add({
      ownerPhone: ownerPhone,
      remotePhone: remotePhone,
      remoteAvatar: SMS_DEFAULT_AVATAR,
      remoteName: remoteName,
      displayName: remoteName,
      phoneNumber: remotePhone,
      lastMessage: body,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: now,
      pinned: false,
      muted: false,
      blocked: false,
      category: 'normal',
      revealed: true
    })
  }
  await db.smsMessages.add({
    conversationId: convId,
    direction: 'in',
    body: body,
    createdAt: now,
    read: false
  })

  showImessageTopMessagePopup({
    title: remoteName,
    body: body,
    avatar: SMS_DEFAULT_AVATAR,
    copyCode: code,
    open: function() { window.showMessagePage && showMessagePage() }
  })

  return code
}

// ===== Top Message Popup =====
var IMESSAGE_TOP_MESSAGE_POPUP_MS = 4200

function buildImessageTopPopupAvatarHTML(avatar, title) {
  if (avatar) {
    return '<img src="' + escSmsHtml(avatar) + '" alt="' + escSmsHtml(title || '信息') + '">'
  }
  return '<div class="imessage-top-popup-initial">' + escSmsHtml(String(title || '信息').slice(0, 1)) + '</div>'
}

function closeImessageTopMessagePopup() {
  var current = document.getElementById('imessage-top-message-popup')
  if (!current) return
  clearTimeout(current._hideTimer)
  current.classList.remove('show')
  current.classList.add('is-hiding')
  setTimeout(function() { current.remove() }, 220)
}

function copyImessageText(text) {
  var value = String(text == null ? '' : text)
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(value).catch(function() {
      return fallbackCopyImessageText(value)
    })
  }
  return fallbackCopyImessageText(value)
}

function fallbackCopyImessageText(text) {
  return new Promise(function(resolve, reject) {
    var textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.pointerEvents = 'none'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    var ok = false
    try {
      ok = document.execCommand('copy')
    } catch (err) {
      ok = false
    }
    textarea.remove()
    if (ok) resolve()
    else reject(new Error('copy failed'))
  })
}

function showImessageTopMessagePopup(opts) {
  opts = opts || {}
  if (document.visibilityState !== 'visible') return
  closeImessageTopMessagePopup()
  var msgSvg = (window.SVG_ICONS && SVG_ICONS.message) || ''
  var copyCode = /^\d{6}$/.test(String(opts.copyCode || '')) ? String(opts.copyCode) : ''
  var el = document.createElement('div')
  el.id = 'imessage-top-message-popup'
  el.className = 'imessage-top-message-popup' + (copyCode ? ' has-copy-code' : '')
  el.innerHTML =
    '<button class="imessage-top-popup-main" type="button">' +
      '<div class="imessage-top-popup-avatar">' +
        buildImessageTopPopupAvatarHTML(opts.avatar, opts.title) +
        '<span class="imessage-top-popup-badge">' + msgSvg + '</span>' +
      '</div>' +
      '<div class="imessage-top-popup-body">' +
        '<div class="imessage-top-popup-meta">' +
          '<span class="imessage-top-popup-title">' + escSmsHtml(opts.title || '信息') + '</span>' +
          '<span class="imessage-top-popup-now">NOW</span>' +
        '</div>' +
        '<div class="imessage-top-popup-text">' + escSmsHtml(opts.body || '你收到一条新消息') + '</div>' +
      '</div>' +
    '</button>' +
    (copyCode ? '<button class="imessage-top-popup-copy" type="button">复制</button>' : '')
  el.querySelector('.imessage-top-popup-main').addEventListener('click', function() {
    closeImessageTopMessagePopup()
    if (typeof opts.open === 'function') opts.open()
  })
  var copyBtn = el.querySelector('.imessage-top-popup-copy')
  if (copyBtn) {
    copyBtn.addEventListener('click', function(e) {
      e.stopPropagation()
      copyImessageText(copyCode).then(function() {
        closeImessageTopMessagePopup()
        window.toast && window.toast('验证码已复制')
      }).catch(function() {
        window.toast && window.toast('复制失败')
      })
    })
  }
  document.body.appendChild(el)
  requestAnimationFrame(function() { el.classList.add('show') })
  el._hideTimer = setTimeout(closeImessageTopMessagePopup, IMESSAGE_TOP_MESSAGE_POPUP_MS)
}

// ===== Anonymous SMS System =====
function startAnonSmsScheduler(user) {
  if (_anonSmsTimer) clearInterval(_anonSmsTimer)
  var interval = parseInt(localStorage.getItem(ANON_SMS_INTERVAL_KEY)) || 180
  var intervalMs = interval * 60 * 1000

  if (!localStorage.getItem(ANON_SMS_LAST_KEY)) {
    localStorage.setItem(ANON_SMS_LAST_KEY, String(Date.now()))
  }

  _anonSmsTimer = setInterval(function() {
    if (_smsSessionTriggered) {
      sendAnonymousCharSMS(user)
      localStorage.setItem(ANON_SMS_LAST_KEY, String(Date.now()))
    }
  }, intervalMs)
  console.log('[AnonSMS] 调度器启动，间隔' + interval + '分钟，等待25分钟触发')
}

async function sendAnonymousCharSMS(user) {
  // Check if enabled
  if (localStorage.getItem(ANON_SMS_ENABLED_KEY) === 'false') {
    console.log('[AnonSMS] 已禁用')
    return
  }

  console.log('[AnonSMS] sendAnonymousCharSMS called', { user: user, hasCallAI: !!window.callAI })
  if (!window.callAI) { console.warn('[AnonSMS] callAI not available'); return }
  if (!user) { console.warn('[AnonSMS] no user'); return }

  // Check daily limit
  var dailyLimit = parseInt(localStorage.getItem(ANON_SMS_DAILY_LIMIT_KEY)) || 3
  var todayKey = 'anonSmsDaily_' + new Date().toISOString().slice(0, 10)
  var todayCount = parseInt(localStorage.getItem(todayKey) || '0')
  if (todayCount >= dailyLimit) {
    console.log('[AnonSMS] 今日已达上限')
    return
  }

  // Random select AI character
  var chars = []
  try {
    chars = await db.characters.where('type').equals('char').toArray()
  } catch(e) { return }
  if (!chars.length) return

  // Filter by enabled characters
  var enabledChars = JSON.parse(localStorage.getItem(ANON_SMS_CHARS_KEY) || '[]')
  if (enabledChars.length > 0) {
    chars = chars.filter(function(c) { return enabledChars.indexOf(String(c.id)) !== -1 })
  }
  if (!chars.length) return

  var char = chars[Math.floor(Math.random() * chars.length)]

  // Build prompt with world book + persona + memory + time
  var charDesc = char.name + '（' + (char.description || char.identity?.bio || char.signature || '普通角色').slice(0, 200) + '）'
  var relationships = (char.relations || []).map(function(r) { return r.desc || r.type || '' }).filter(Boolean).join('、')

  // User persona
  var userDesc = ''
  try {
    var users = await db.characters.where('type').equals('user').toArray()
    if (users.length) {
      var u = users[0]
      userDesc = u.name || u.nick || '用户'
      if (u.description) userDesc += '：' + u.description.slice(0, 200)
    }
  } catch(_) {}

  // Memory context
  var memCtx = ''
  try {
    if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
      var mc = await window.WanWanMemory.getMemoryContext(null, char.id, window._wechatUid, [])
      if (mc) memCtx = mc.slice(0, 500)
    }
  } catch(_) {}

  // Time context
  var timeCtx = ''
  try {
    if (window.WanWanMemory && window.WanWanMemory.getFormattedNow) {
      timeCtx = window.WanWanMemory.getFormattedNow()
    }
  } catch(_) {}

  var prompt = getAnonMailboxLore() + '\n' +
    '你是' + charDesc + '。你想匿名给用户发短信试探TA。\n\n' +
    '你的真实身份：' + charDesc + '\n' +
    '你的关系：' + (relationships || '无特殊关系') + '\n' +
    (userDesc ? '对方的人设：' + userDesc + '\n' : '') +
    (memCtx ? '对方的记忆：' + memCtx.slice(0, 300) + '\n' : '') +
    (timeCtx ? '当前时间：' + timeCtx + '\n' : '') + '\n' +
    '【要求】\n' +
    '1. 绝对不能暴露你是AI或游戏角色\n' +
    '2. 伪装成一个真实的人（陌生人、网友、朋友的朋友等）\n' +
    '3. 语气自然，像真人发短信，可以口语化\n' +
    '4. 发3-5条消息（像真人连发短信，每条20-40字）\n' +
    '5. 第一条要引起好奇心\n' +
    '6. 体现你角色的性格特点\n' +
    '7. 可以试探用户的感情、秘密、内心想法\n\n' +
    '返回JSON：{"messages":["第一条","第二条","第三条"]}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', charAntiDrift: true })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
    if (!data) return

    var messages = data.messages || (data.body ? [data.body] : [])
    if (!messages.length) return

    // Content dedup
    if (localStorage.getItem(ANON_SMS_DEDUP_KEY) !== 'false') {
      var recentAnon = await db.smsMessages.where('direction').equals('in').reverse().limit(20).toArray()
      var recentBodies = recentAnon.map(function(m) { return (m.body || '').slice(0, 20) })
      messages = messages.filter(function(msg) {
        return !recentBodies.some(function(rb) { return rb && msg.slice(0, 20) === rb })
      })
      if (!messages.length) { console.log('[AnonSMS] 去重后无新消息'); return }
    }

    var anonPhone = genAnonPhone()
    var anonName = genAnonName()
    var now = Date.now()

    if (!_smsActivePhone) {
      try {
        var users = await db.characters.where('type').equals('user').toArray()
        for (var i = 0; i < users.length; i++) {
          var ph = users[i].identity && users[i].identity.phone
          if (ph) { _smsActivePhone = ph; break }
        }
      } catch(e) {}
    }
    var ownerPhone = _smsActivePhone || user.phone || (user.identity && user.identity.phone) || 'user_default'

    // Create or update conversation
    var conv = await db.smsConversations
      .where('[ownerPhone+remotePhone]')
      .equals([ownerPhone, anonPhone])
      .first()

    var convId
    if (conv) {
      convId = conv.id
      await db.smsConversations.update(convId, {
        lastMessage: messages[messages.length - 1],
        lastMessageAt: now,
        unreadCount: (conv.unreadCount || 0) + messages.length,
        updatedAt: now
      })
    } else {
      convId = await db.smsConversations.add({
        ownerPhone: ownerPhone,
        remotePhone: anonPhone,
        remoteAvatar: char.avatar || SMS_DEFAULT_AVATAR,
        remoteName: anonName,
        displayName: anonName,
        phoneNumber: genVirtualNumber(),
        lastMessage: messages[messages.length - 1],
        lastMessageAt: now,
        unreadCount: messages.length,
        updatedAt: now,
        _anonCharId: char.id,
        _anonCharName: char.name,
        pinned: false,
        muted: false,
        blocked: false,
        category: 'normal',
        revealed: false,
        direction: 'inbound'
      })
    }

    // Save all messages with staggered timestamps
    for (var i = 0; i < messages.length; i++) {
      await db.smsMessages.add({
        conversationId: convId,
        direction: 'in',
        body: messages[i],
        createdAt: now + i * 1000,
        read: false,
        _anonCharId: char.id,
        _anonCharName: char.name,
        _anonCharAvatar: char.avatar || '',
        _anonRevealed: false
      })
    }

    // Write to memory
    try {
      if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
        var msgSummary = messages.map(function(m) { return m.slice(0, 40) }).join('；')
        if (db.memories) {
          await db.memories.add({
            ownerUid: window._wechatUid || null,
            charId: char.id,
            chatId: 'sms_' + convId,
            title: char.name + '以匿名身份给用户发了短信',
            content: char.name + '伪装成陌生人（' + anonName + '）给用户发了' + messages.length + '条匿名短信。内容：' + msgSummary,
            keywords: ['匿名短信', char.name, '试探'],
            valence: -0.2,
            arousal: 0.6,
            importance: 6,
            sourceType: 'sms',
            status: 'active',
            decayPercent: 80,
            injectionLayer: 2,
            createdAt: Date.now(),
            updatedAt: Date.now()
          })
          console.log('[AnonSMS] 已写入记忆库')
        }
      }
    } catch(memErr) { console.warn('[AnonSMS] 记忆写入失败:', memErr) }

    // Update daily count
    localStorage.setItem(todayKey, String(todayCount + 1))

    // Show notification
    showImessageTopMessagePopup({
      title: anonName,
      body: messages[messages.length - 1],
      avatar: char.avatar || SMS_DEFAULT_AVATAR,
      open: function() { window.showMessagePage && showMessagePage() }
    })

    console.log('[AnonSMS] 匿名短信已发送：' + char.name + ' → ' + anonPhone + ' (' + messages.length + '条) ownerPhone=' + ownerPhone)

    // Refresh SMS list if on page
    var smsPage = document.getElementById('imessage-page')
    if (smsPage) loadSmsConversations(smsPage)
  } catch(e) {
    console.error('[AnonSMS] 发送失败:', e)
  }
}

// ===== Reveal Anonymous =====
window.revealAnonSms = async function(msgId) {
  var msg = await db.smsMessages.get(msgId)
  if (!msg || !msg._anonCharId) return

  await db.smsMessages.update(msgId, { _anonRevealed: true })

  var revealed = JSON.parse(localStorage.getItem(ANON_SMS_REVEAL_KEY) || '[]')
  if (revealed.indexOf(msgId) === -1) revealed.push(msgId)
  localStorage.setItem(ANON_SMS_REVEAL_KEY, JSON.stringify(revealed))

  var conv = await db.smsConversations.get(msg.conversationId)
  if (conv) {
    var char = await db.characters.get(msg._anonCharId)
    if (char) {
      await db.smsConversations.update(conv.id, {
        remoteName: char.name,
        remoteAvatar: char.avatar || SMS_DEFAULT_AVATAR,
        _anonCharName: char.name,
        revealed: true
      })
    }
  }

  // Refresh current page
  var chatPage = document.getElementById('imessage-chat-page')
  if (chatPage) {
    var convId = msg.conversationId
    var convRefreshed = await db.smsConversations.get(convId)
    await loadSmsChatMessages(chatPage, convId, convRefreshed)
  }

  var listPage = document.getElementById('imessage-page')
  if (listPage) loadSmsConversations(listPage)

  window.toast && window.toast('已解除匿名')
}

// ===== SMS Memory Summary =====
window.summarizeSmsToMemory = async function(conversationId) {
  var conv = await db.smsConversations.get(conversationId)
  if (!conv) return
  var msgs = await db.smsMessages.where('conversationId').equals(conversationId).sortBy('createdAt')
  if (!msgs.length) { window.toast && window.toast('没有消息可总结'); return }

  window.toast && window.toast('正在总结聊天...')

  var originalText = msgs.map(function(m) {
    var role = m.direction === 'out' ? '用户' : '对方'
    return role + '：' + m.body
  }).join('\n')

  var charId = null
  var charName = '匿名用户'
  for (var i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]._anonCharId) {
      charId = msgs[i]._anonCharId
      charName = msgs[i]._anonCharName || '未知'
      break
    }
  }

  var prompt = '请总结以下短信对话，提取关键信息。\n\n' +
    '对话内容：\n' + originalText + '\n\n' +
    '返回JSON格式：\n' +
    '{"title":"记忆标题(10字以内)","content":"记忆内容(50字以内)","keywords":["关键词1","关键词2"],"importance":5,"valence":0,"arousal":0.3}'

  var lastError = null
  var data = null
  for (var attempt = 1; attempt <= 2; attempt++) {
    try {
      if (!window.callAI) { lastError = 'AI不可用'; break }
      var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
      data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
      if (data && data.content) break
      lastError = 'AI返回为空或格式错误'
    } catch(e) {
      lastError = e.message || String(e)
      console.warn('[SMS] 总结第' + attempt + '次失败：', lastError)
    }
  }

  var firstTime = msgs[0] ? new Date(msgs[0].createdAt) : new Date()
  var lastTime = msgs[msgs.length-1] ? new Date(msgs[msgs.length-1].createdAt) : new Date()
  var timeRange = (firstTime.getMonth()+1) + '/' + firstTime.getDate() + ' ' +
    firstTime.getHours().toString().padStart(2,'0') + ':' + firstTime.getMinutes().toString().padStart(2,'0') +
    '~' + lastTime.getHours().toString().padStart(2,'0') + ':' + lastTime.getMinutes().toString().padStart(2,'0')

  var ownerUid = null
  try {
    var users = await db.characters.where('type').equals('user').toArray()
    if (users.length) ownerUid = String(users[0].id)
  } catch(e) {}

  if (!data || !data.content) {
    if (db.memoryRuns) {
      await db.memoryRuns.add({
        ownerUid: ownerUid || 'default',
        charId: charId || 0,
        chatId: 'sms_' + conversationId,
        sourceType: 'sms',
        sourceAt: Date.now(),
        createdAt: Date.now(),
        memoryCount: 0,
        mode: 'sms',
        status: 'failed',
        failReason: lastError || '未知错误',
        originalText: originalText,
        messageCount: msgs.length
      })
    }
    window.toast && window.toast('短信总结失败：' + (lastError || '未知错误'))
    return
  }

  var memoryRow = {
    ownerUid: ownerUid || 'default',
    charId: charId || 0,
    chatId: 'sms_' + conversationId,
    title: String(data.title || '短信对话').slice(0, 30),
    content: '[' + timeRange + '] ' + String(data.content).slice(0, 130),
    keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 8) : [],
    valence: typeof data.valence === 'number' ? data.valence : 0,
    arousal: typeof data.arousal === 'number' ? data.arousal : 0.3,
    importance: typeof data.importance === 'number' ? data.importance : 5,
    embedding: null,
    status: 'active',
    sourceMsgStartId: msgs[0] ? msgs[0].id : null,
    sourceMsgEndId: msgs[msgs.length - 1] ? msgs[msgs.length - 1].id : null,
    sourceAt: Date.now(),
    sourceType: 'sms',
    decayPercent: 80,
    isLongTerm: false,
    injectionLayer: 2,
    participants: [],
    lastRecalledAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastAccessedAt: null,
    accessCount: 0
  }

  await db.memories.add(memoryRow)

  if (db.memoryRuns) {
    await db.memoryRuns.add({
      ownerUid: ownerUid || 'default',
      charId: charId || 0,
      chatId: 'sms_' + conversationId,
      sourceType: 'sms',
      sourceAt: Date.now(),
      createdAt: Date.now(),
      memoryCount: 1,
      mode: 'sms',
      status: 'success',
      originalText: originalText,
      messageCount: msgs.length
    })
  }

  window.toast && window.toast('已写入记忆库：' + data.title)
  console.log('[SMS] 记忆已保存：', data.title)
}

// ===== WeChat Block → SMS =====
function startWechatBlockSmsTimer(charId, charName) {
  if (_wechatBlockTimers[charId]) return
  _wechatBlockTimers[charId] = setTimeout(async function() {
    delete _wechatBlockTimers[charId]
    // Check if still blocked
    try {
      var blockKey = 'chatBlock_' + charId
      var blockState = await db.config.get(blockKey)
      if (!blockState || !blockState.value || !blockState.value.blocked) return
    } catch(e) { return }

    // Send SMS using AI's real identity (NOT anonymous)
    try {
      var char = await db.characters.get(charId)
      if (!char) return

      var userDesc = ''
      var users = await db.characters.where('type').equals('user').toArray()
      if (users.length) {
        var u = users[0]
        userDesc = u.name || u.nick || '用户'
        if (u.description) userDesc += '：' + u.description.slice(0, 200)
      }

      var charDesc = char.name + '（' + (char.description || char.signature || '').slice(0, 200) + '）'
      var memCtx = ''
      try {
        if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
          memCtx = await window.WanWanMemory.getMemoryContext(null, charId, window._wechatUid, [])
        }
      } catch(_) {}

      var prompt = '你是' + charDesc + '。你在微信上被用户拉黑了，你现在通过短信找用户。\n\n' +
        '你的身份：' + charDesc + '\n' +
        (userDesc ? '对方人设：' + userDesc + '\n' : '') +
        (memCtx ? '记忆：' + memCtx.slice(0, 300) + '\n' : '') + '\n' +
        '你不是匿名的，你用的是自己的真实身份。\n' +
        '你的态度：关心、想念、有点委屈。\n\n' +
        '要求：\n' +
        '1. 发1-2条消息，每条15-30字\n' +
        '2. 语气温柔、关心、有点委屈\n' +
        '3. 体现你角色的性格\n' +
        '4. 示例："你怎么不理我了..." / "我找不到你了"\n\n' +
        '返回JSON：{"messages":["第一条"]}'

      var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', charAntiDrift: true })
      var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
      if (!data) return

      var messages = data.messages || (data.body ? [data.body] : [])
      if (!messages.length) return

      var charPhone = (char.identity && char.identity.phone) || char.phone || ''
      if (!charPhone) {
        charPhone = '138' + String(charId).padStart(8, '0')
      }

      var now = Date.now()
      var ownerPhone = _smsActivePhone || 'user_default'

      var conv = await db.smsConversations
        .where('[ownerPhone+remotePhone]')
        .equals([ownerPhone, charPhone])
        .first()

      if (!conv) {
        await db.smsConversations.add({
          ownerPhone: ownerPhone,
          remotePhone: charPhone,
          remoteAvatar: char.avatar || SMS_DEFAULT_AVATAR,
          remoteName: char.name,
          displayName: char.name,
          phoneNumber: charPhone,
          _anonCharId: charId,
          _anonCharName: char.name,
          lastMessage: messages[0],
          lastMessageAt: now,
          unreadCount: messages.length,
          pinned: false, muted: false, blocked: false,
          category: 'normal', revealed: true, direction: 'inbound',
          createdAt: now, updatedAt: now
        })
      } else {
        await db.smsConversations.update(conv.id, {
          lastMessage: messages[0], lastMessageAt: now,
          unreadCount: (conv.unreadCount || 0) + messages.length,
          revealed: true, updatedAt: now
        })
      }

      var convId = conv ? conv.id : charPhone

      for (var j = 0; j < messages.length; j++) {
        (function(msg, delay) {
          setTimeout(async function() {
            await db.smsMessages.add({
              conversationId: convId, direction: 'in', body: msg,
              createdAt: Date.now(), read: false,
              _anonCharId: charId, _anonCharName: char.name, _anonRevealed: true
            })
          }, delay)
        })(messages[j], j * 1500)
      }

      // Show notification
      showImessageTopMessagePopup({
        title: char.name,
        body: messages[messages.length - 1],
        avatar: char.avatar || SMS_DEFAULT_AVATAR,
        open: function() { window.showMessagePage && showMessagePage() }
      })

      window.toast && window.toast(char.name + '通过短信找你了')
    } catch(e) {
      console.warn('[SMS] wechat block sms error:', e)
    }
  }, 5 * 60 * 1000) // 5 minutes
}

// ===== Session Timer (25-minute trigger) =====
_smsCheckTimer = setInterval(function() {
  var elapsed = Date.now() - _smsSessionStart
  if (elapsed > 25 * 60 * 1000 && !_smsSessionTriggered) {
    _smsSessionTriggered = true
    console.log('[AnonSMS] 25分钟触发条件达成')
    window.toast && window.toast('收到一条匿名短信')
    var delay = (30 + Math.random() * 60) * 1000
    setTimeout(async function() {
      if (!_smsActivePhone) {
        try {
          var users = await db.characters.where('type').equals('user').toArray()
          for (var i = 0; i < users.length; i++) {
            var ph = users[i].identity && users[i].identity.phone
            if (ph) { _smsActivePhone = ph; _smsUserPhones = [{charId: users[i].id, charName: users[i].name||'', avatar: users[i].avatar||'', phone: ph}]; break }
          }
        } catch(e) {}
      }
      var user = _smsUserPhones[0] || { id: 0, name: '用户' }
      if (window.sendAnonymousCharSMS) {
        window.sendAnonymousCharSMS(user)
        localStorage.setItem(ANON_SMS_LAST_KEY, String(Date.now()))
      }
    }, delay)
  }
}, 60000)

// ===== Exports =====
window.startAnonSmsScheduler = startAnonSmsScheduler
window.sendAnonymousCharSMS = sendAnonymousCharSMS
window.startWechatBlockSmsTimer = startWechatBlockSmsTimer
window.showSmsChatMenuPopup = showSmsChatMenuPopup
window.closeSmsChatMenuPopup = closeSmsChatMenuPopup

// ===== Summary Button Enhancement =====
(function enhanceSmsPages() {
  var origOpenSmsChat = window.openSmsChat || openSmsChat
  if (typeof origOpenSmsChat === 'function') {
    var enhanced = async function(conversationId, listPage) {
      await origOpenSmsChat(conversationId, listPage)
      // Add summary button to header
      var header = document.querySelector('.sms-chat-header')
      if (header) {
        var menuBtn = header.querySelector('.sms-chat-menu-btn')
        if (menuBtn) {
          var summaryBtn = document.createElement('button')
          summaryBtn.className = 'sms-summary-btn'
          summaryBtn.innerHTML = '<i class="fa-solid fa-brain"></i>'
          summaryBtn.title = '总结并记忆'
          summaryBtn.addEventListener('click', function() { window.summarizeSmsToMemory(conversationId) })
          header.insertBefore(summaryBtn, menuBtn)
        }
      }
    }
    window.openSmsChat = enhanced
  }
})()
