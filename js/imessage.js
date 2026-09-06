// imessage.js — iMessage 短信模块
// 依赖：db.js 必须先加载

var _smsActivePhone = null
var _smsUserPhones = []

var SMS_WELCOME_REMOTE = '106908968258'
var SMS_WELCOME_TEXT = '【月月AI】欢迎您的加入！您的手机号已注册成功，立即体验AI助手，让工作更高效。如有问题请联系客服。退订回TD'
var SMS_DEFAULT_AVATAR = 'https://img2.tofaka.com/autoupload/WyM1lZ85VwHzLwMUY9JmtdiO_OyvX7mIgxFBfDMDErs/20260530/dPVE/242X242/iMessage_deflaut.png'

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

// ===== 入口 =====
window.showMessagePage = async function() {
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
}

// ===== 无手机号页面 =====
function buildNoPhonePage() {
  var page = document.createElement('div')
  page.id = 'imessage-no-phone-page'
  page.className = 'full-page imessage-main'
  page.innerHTML =
    '<div class="imessage-header">' +
      '<button class="imessage-back" onclick="window.closePage(\'imessage-no-phone-page\')">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<span class="imessage-phone-title" style="cursor:default">信息</span>' +
      '<span style="width:32px"></span>' +
    '</div>' +
    '<div class="imessage-no-phone-body">' +
      '<div class="imessage-no-phone-icon"><i class="fa-brands fa-facebook-messenger"></i></div>' +
      '<div class="imessage-no-phone-text">用户暂未开通手机短信功能</div>' +
      '<button class="imessage-register-btn" id="imessage-register-btn">注册手机</button>' +
    '</div>'
  page.querySelector('#imessage-register-btn').addEventListener('click', function() {
    window.closePage('imessage-no-phone-page')
    setTimeout(function() {
      window.showCharacterPage && showCharacterPage()
    }, 100)
  })
  return page
}

// ===== 短信列表页 =====
function buildSmsListPage() {
  var page = document.createElement('div')
  page.id = 'imessage-page'
  page.className = 'full-page imessage-main'

  var activeUser = _smsUserPhones.find(function(p) { return p.phone === _smsActivePhone }) || _smsUserPhones[0]

  page.innerHTML =
    '<div class="imessage-header">' +
      '<button class="imessage-back" id="imessage-list-back">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<span class="imessage-phone-title" id="imessage-phone-title">' +
        '<span class="imessage-phone-title-text">' + escSmsHtml(activeUser.phone) + '</span>' +
        (_smsUserPhones.length > 1 ? ' <i class="fa fa-chevron-down imessage-chevron"></i>' : '') +
      '</span>' +
      '<button class="imessage-new-btn" id="imessage-new-btn">' +
        '<i class="fa fa-plus"></i>' +
      '</button>' +
      '<button class="imessage-new-btn" id="imessage-anon-settings" style="margin-left:6px">' +
        '<i class="fa-solid fa-user-secret"></i>' +
      '</button>' +
      (_smsUserPhones.length > 1 ? buildPhoneDropdownHTML() : '') +
    '</div>' +
    '<div class="imessage-list" id="imessage-list"></div>'

  bindSmsListEvents(page)
  return page
}

function buildPhoneDropdownHTML() {
  var html = '<div class="imessage-phone-dropdown" id="imessage-phone-dropdown">'
  for (var i = 0; i < _smsUserPhones.length; i++) {
    var p = _smsUserPhones[i]
    var isActive = p.phone === _smsActivePhone
    html +=
      '<div class="imessage-phone-option" data-phone="' + escSmsHtml(p.phone) + '" data-index="' + i + '">' +
        '<img class="imessage-phone-avatar" src="' + escSmsHtml(p.avatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<span class="imessage-phone-number">' + escSmsHtml(p.phone) + '</span>' +
        (isActive ? '<i class="fa fa-check imessage-phone-check"></i>' : '') +
      '</div>'
  }
  html += '</div>'
  return html
}

function bindSmsListEvents(page) {
  page.querySelector('#imessage-list-back').addEventListener('click', function() {
    window.closePage('imessage-page')
  })

  var title = page.querySelector('#imessage-phone-title')
  var dropdown = page.querySelector('#imessage-phone-dropdown')

  if (dropdown && _smsUserPhones.length > 1) {
    title.addEventListener('click', function() {
      var isOpen = dropdown.classList.contains('show')
      if (isOpen) {
        dropdown.classList.remove('show')
        title.classList.remove('open')
      } else {
        dropdown.classList.add('show')
        title.classList.add('open')
      }
    })

    dropdown.addEventListener('click', async function(e) {
      var option = e.target.closest('.imessage-phone-option')
      if (!option) return
      var phone = option.getAttribute('data-phone')
      if (phone === _smsActivePhone) {
        dropdown.classList.remove('show')
        title.classList.remove('open')
        return
      }
      _smsActivePhone = phone
      var activeUser = _smsUserPhones.find(function(p) { return p.phone === _smsActivePhone })
      title.querySelector('.imessage-phone-title-text').textContent = activeUser.phone

      dropdown.innerHTML = ''
      var tmp = document.createElement('div')
      tmp.innerHTML = buildPhoneDropdownHTML()
      var newDropdown = tmp.querySelector('.imessage-phone-dropdown')
      dropdown.innerHTML = newDropdown.innerHTML

      dropdown.classList.remove('show')
      title.classList.remove('open')

      await seedWelcomeSMS(_smsActivePhone)
      loadSmsConversations(page)
    })
  }

  page.querySelector('#imessage-new-btn').addEventListener('click', function() {
    window.toast && window.toast('暂不支持新建短信')
  })
  var anonBtn = page.querySelector('#imessage-anon-settings')
  if (anonBtn) anonBtn.addEventListener('click', function() { window.showAnonSmsSettings() })
}

async function loadSmsConversations(page) {
  var list = page.querySelector('#imessage-list')
  if (!list) return
  var convs = await db.smsConversations
    .where('ownerPhone').equals(_smsActivePhone)
    .reverse().sortBy('updatedAt')

  if (!convs.length) {
    list.innerHTML = '<div class="imessage-empty">暂无短信</div>'
    return
  }

  var html = ''
  for (var i = 0; i < convs.length; i++) {
    var c = convs[i]
    html +=
      '<div class="imessage-conv-item" data-conv-id="' + c.id + '">' +
        (c.unreadCount > 0 ? '<div class="imessage-conv-unread"></div>' : '') +
        '<img class="imessage-conv-avatar" src="' + escSmsHtml(c.remoteAvatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<div class="imessage-conv-body">' +
          '<div class="imessage-conv-top">' +
            '<span class="imessage-conv-name">' + escSmsHtml(c.remoteName || c.remotePhone) + '</span>' +
            '<span class="imessage-conv-time">' + formatSmsTime(c.lastMessageAt) + '</span>' +
          '</div>' +
          '<div class="imessage-conv-preview">' + escSmsHtml(c.lastMessage || '') + '</div>' +
        '</div>' +
        '<i class="fa fa-angle-right imessage-conv-chevron"></i>' +
      '</div>'
  }
  list.innerHTML = html

  list.querySelectorAll('.imessage-conv-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var convId = parseInt(item.getAttribute('data-conv-id'))
      openSmsChat(convId, page)
    })
  })
}

// ===== 聊天详情页 =====
async function openSmsChat(conversationId, listPage) {
  var conv = await db.smsConversations.get(conversationId)
  if (!conv) return

  var page = document.createElement('div')
  page.id = 'imessage-chat-page'
  page.className = 'full-page imessage-chat'
  page.innerHTML =
    '<div class="imessage-chat-header">' +
      '<button class="imessage-chat-back" id="imessage-chat-back">' +
        '<i class="fa fa-angle-left"></i>' +
      '</button>' +
      '<div class="imessage-chat-contact">' +
        '<img class="imessage-chat-avatar" src="' + escSmsHtml(conv.remoteAvatar || SMS_DEFAULT_AVATAR) + '" onerror="this.src=\'' + SMS_DEFAULT_AVATAR + '\'">' +
        '<span class="imessage-chat-name">' + escSmsHtml(conv.remoteName || conv.remotePhone) + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="imessage-chat-messages" id="imessage-chat-msgs"></div>' +
    '<div class="imessage-chat-input">' +
      '<input class="imessage-input" placeholder="短信" id="imessage-chat-input-field">' +
      '<button class="imessage-send-btn" id="imessage-send-btn"><i class="fa fa-arrow-up"></i></button>' +
    '</div>'

  page.querySelector('#imessage-chat-back').addEventListener('click', function() {
    window.closePage('imessage-chat-page')
    if (listPage) loadSmsConversations(listPage)
  })

  window.openPage(page)
  await loadSmsChatMessages(page, conversationId)

  if (conv.unreadCount > 0) {
    await db.smsConversations.update(conversationId, { unreadCount: 0 })
    await db.smsMessages.where('conversationId').equals(conversationId).modify({ read: true })
  }
}

async function loadSmsChatMessages(page, conversationId) {
  var container = page.querySelector('#imessage-chat-msgs')
  if (!container) return
  var msgs = await db.smsMessages.where('conversationId').equals(conversationId).sortBy('createdAt')

  if (!msgs.length) {
    container.innerHTML = '<div class="imessage-empty">暂无消息</div>'
    return
  }

  var html = ''
  var lastDate = ''
  var revealedIds = JSON.parse(localStorage.getItem('anonSmsRevealed') || '[]')
  for (var i = 0; i < msgs.length; i++) {
    var m = msgs[i]
    var dateStr = formatSmsFullTime(m.createdAt)
    if (dateStr !== lastDate) {
      html += '<div class="sms-time-label">' + escSmsHtml(dateStr) + '</div>'
      lastDate = dateStr
    }
    var cls = m.direction === 'out' ? 'sms-out' : 'sms-in'
    var isAnon = m._anonCharId && !m._anonRevealed && revealedIds.indexOf(m.id) === -1
    html += '<div class="sms-bubble ' + cls + '">' + escSmsHtml(m.body) + '</div>'
    // 匿名消息显示解除匿名按钮
    if (isAnon && m.direction === 'in') {
      html += '<div class="sms-reveal-row"><button class="sms-reveal-btn" data-msg-id="' + m.id + '"><i class="fa-solid fa-eye"></i> 解除匿名</button></div>'
    }
    // 已解除匿名的消息显示真实身份
    if (m._anonCharId && (m._anonRevealed || revealedIds.indexOf(m.id) !== -1)) {
      html += '<div class="sms-revealed-tag"><i class="fa-solid fa-user"></i> ' + escSmsHtml(m._anonCharName) + '</div>'
    }
  }
  container.innerHTML = html
  container.scrollTop = container.scrollHeight

  // 绑定解除匿名按钮
  container.querySelectorAll('.sms-reveal-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var msgId = parseInt(btn.dataset.msgId)
      if (msgId) window.revealAnonSms(msgId)
    })
  })
}

// ===== 欢迎短信 =====
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
    remoteName: '',
    lastMessage: SMS_WELCOME_TEXT,
    lastMessageAt: now,
    unreadCount: 1,
    updatedAt: now
  })
  await db.smsMessages.add({
    conversationId: convId,
    direction: 'in',
    body: SMS_WELCOME_TEXT,
    createdAt: now,
    read: false
  })
}

// ===== 验证码短信投递 + 信息推送 =====
var SMS_TAOBAO_REMOTE = '106900008888'
var SMS_YUMYUM_REMOTE = '106900006666'

// 根据手机号查找已注册 User（identity.phone 绑定）
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

function genSmsVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 生成随机六位验证码，写入对应手机号短信会话并弹出信息推送，返回验证码
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
      lastMessage: body,
      lastMessageAt: now,
      unreadCount: 1,
      updatedAt: now
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

// ===== 信息顶部新消息推送（视觉与微信顶部推送一致，仅 svg 换成信息原本 svg）=====
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

// ===== AI匿名短信系统 =====
var _anonSmsTimer = null
var ANON_SMS_LAST_KEY = 'anonSmsLastTime'
var ANON_SMS_INTERVAL_KEY = 'anonSmsInterval'
var ANON_SMS_REVEAL_KEY = 'anonSmsRevealed' // 存已解除匿名的消息ID

// 生成随机手机号
function genAnonPhone() {
  var prefixes = ['138','139','150','151','152','157','158','159','186','187','188','135','136','137']
  var prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
  var rest = ''
  for (var i = 0; i < 8; i++) rest += Math.floor(Math.random() * 10)
  return prefix + rest
}

// 生成匿名名字
function genAnonName() {
  var names = ['陌生人','好奇路人','路过的人','匿名用户','不告诉你','别问我是谁','神秘人','一个好奇的人']
  return names[Math.floor(Math.random() * names.length)]
}

// 启动匿名短信调度器
function startAnonSmsScheduler(user) {
  if (_anonSmsTimer) clearInterval(_anonSmsTimer)
  var interval = parseInt(localStorage.getItem(ANON_SMS_INTERVAL_KEY)) || 180 // 默认3小时
  var intervalMs = interval * 60 * 1000

  // 补回逻辑
  var lastTime = parseInt(localStorage.getItem(ANON_SMS_LAST_KEY)) || 0
  var now = Date.now()
  if (lastTime > 0) {
    var elapsed = now - lastTime
    var missed = Math.floor(elapsed / intervalMs)
    if (missed > 0) {
      missed = Math.min(missed, 3) // 最多补3条
      console.log('[AnonSMS] 补回：需补' + missed + '条匿名短信')
      for (var i = 0; i < missed; i++) {
        sendAnonymousCharSMS(user)
      }
      localStorage.setItem(ANON_SMS_LAST_KEY, String(now))
    }
  }
  if (!lastTime) localStorage.setItem(ANON_SMS_LAST_KEY, String(now))

  _anonSmsTimer = setInterval(function() {
    sendAnonymousCharSMS(user)
    localStorage.setItem(ANON_SMS_LAST_KEY, String(Date.now()))
  }, intervalMs)
  console.log('[AnonSMS] 调度器启动，间隔' + interval + '分钟')
}

// 核心：AI角色匿名发短信
async function sendAnonymousCharSMS(user) {
  if (!window.callAI) return
  if (!user || !user.identity || !user.identity.phone) return

  // 随机选一个AI角色
  var chars = []
  try {
    chars = await db.characters.where('type').equals('char').toArray()
  } catch(e) { return }
  if (!chars.length) return
  var char = chars[Math.floor(Math.random() * chars.length)]

  // 构建prompt，要求隐藏身份
  var charDesc = char.name + '（' + (char.identity?.bio || char.signature || '普通角色') + '）'
  var relationships = (char.relations || []).map(function(r) { return r.desc || r.type || '' }).filter(Boolean).join('、')

  var prompt = '你是' + charDesc + '。你想给用户发一条短信，但必须隐藏你的真实身份。\n\n' +
    '你的性格和关系：' + (relationships || '普通朋友') + '\n\n' +
    '要求：\n' +
    '1. 绝对不能暴露你是AI或游戏角色\n' +
    '2. 伪装成一个真实的人（陌生人、网友、朋友的朋友等）\n' +
    '3. 可以试探用户、问问题、聊天、表达关心\n' +
    '4. 语气自然，像真人发短信\n' +
    '5. 内容20-60字\n' +
    '6. 你的目的是了解用户、试探用户对某些事情的态度\n\n' +
    '返回JSON：{"body":"短信内容"}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
    if (!data || !data.body) return

    var anonPhone = genAnonPhone()
    var anonName = genAnonName()
    var now = Date.now()
    var ownerPhone = user.identity.phone

    // 查找或创建对话
    var conv = await db.smsConversations
      .where('[ownerPhone+remotePhone]')
      .equals([ownerPhone, anonPhone])
      .first()

    var convId
    if (conv) {
      convId = conv.id
      await db.smsConversations.update(convId, {
        lastMessage: data.body,
        lastMessageAt: now,
        unreadCount: (conv.unreadCount || 0) + 1,
        updatedAt: now
      })
    } else {
      convId = await db.smsConversations.add({
        ownerPhone: ownerPhone,
        remotePhone: anonPhone,
        remoteAvatar: SMS_DEFAULT_AVATAR,
        remoteName: anonName,
        lastMessage: data.body,
        lastMessageAt: now,
        unreadCount: 1,
        updatedAt: now
      })
    }

    // 保存消息（带角色真实信息，用于解除匿名）
    await db.smsMessages.add({
      conversationId: convId,
      direction: 'in',
      body: data.body,
      createdAt: now,
      read: false,
      // 匿名信息（解除前不显示）
      _anonCharId: char.id,
      _anonCharName: char.name,
      _anonCharAvatar: char.avatar || '',
      _anonRevealed: false
    })

    // 弹出通知
    showImessageTopMessagePopup({
      title: anonName,
      body: data.body,
      avatar: SMS_DEFAULT_AVATAR
    })

    console.log('[AnonSMS] 匿名短信已发送：' + char.name + ' → ' + anonPhone)
  } catch(e) {
    console.error('[AnonSMS] 发送失败:', e)
  }
}

// 解除匿名
window.revealAnonSms = async function(msgId) {
  var msg = await db.smsMessages.get(msgId)
  if (!msg || !msg._anonCharId) return

  // 标记已解除
  await db.smsMessages.update(msgId, { _anonRevealed: true })

  // 记录已解除的ID
  var revealed = JSON.parse(localStorage.getItem(ANON_SMS_REVEAL_KEY) || '[]')
  if (revealed.indexOf(msgId) === -1) revealed.push(msgId)
  localStorage.setItem(ANON_SMS_REVEAL_KEY, JSON.stringify(revealed))

  // 更新对话的头像和名字
  var conv = await db.smsConversations.get(msg.conversationId)
  if (conv) {
    var char = await db.characters.get(msg._anonCharId)
    if (char) {
      await db.smsConversations.update(conv.id, {
        remoteName: char.name,
        remoteAvatar: char.avatar || SMS_DEFAULT_AVATAR
      })
    }
  }

  // 刷新当前页面
  var chatPage = document.getElementById('imessage-chat-page')
  if (chatPage) {
    var convId = msg.conversationId
    var listPage = document.getElementById('imessage-page')
    window.closePage('imessage-chat-page')
    setTimeout(function() {
      if (listPage) loadSmsConversations(listPage)
      // 重新打开聊天
      openSmsChat(convId, listPage)
    }, 200)
  } else {
    var listPage = document.getElementById('imessage-page')
    if (listPage) loadSmsConversations(listPage)
  }

  window.toast && window.toast('已解除匿名')
}

// 设置匿名短信间隔
window.setAnonSmsInterval = function(minutes) {
  localStorage.setItem(ANON_SMS_INTERVAL_KEY, String(minutes))
  window.toast && window.toast('匿名短信间隔已设为' + minutes + '分钟')
}

// 导出给外部调用
window.startAnonSmsScheduler = startAnonSmsScheduler
window.sendAnonymousCharSMS = sendAnonymousCharSMS

// ===== SMS记忆联通 + 聊天总结 + 设置 =====

// 会话计时（25分钟触发匿名短信）
var _smsSessionStart = Date.now()
var _smsSessionTriggered = false
var _smsCheckTimer = setInterval(function() {
  var elapsed = Date.now() - _smsSessionStart
  if (elapsed > 25 * 60 * 1000 && !_smsSessionTriggered) {
    _smsSessionTriggered = true
    console.log('[AnonSMS] 25分钟触发条件达成')
    // 延迟1-3分钟再发，更自然
    var delay = (60 + Math.random() * 120) * 1000
    setTimeout(function() {
      var user = _smsUserPhones[0]
      if (user && window.sendAnonymousCharSMS) {
        window.sendAnonymousCharSMS(user)
        localStorage.setItem('anonSmsLastTime', String(Date.now()))
      }
    }, delay)
  }
}, 60000)

// 聊天总结按钮（写入记忆库）
window.summarizeSmsToMemory = async function(conversationId) {
  var conv = await db.smsConversations.get(conversationId)
  if (!conv) return
  var msgs = await db.smsMessages.where('conversationId').equals(conversationId).sortBy('createdAt')
  if (!msgs.length) { window.toast && window.toast('没有消息可总结'); return }

  window.toast && window.toast('正在总结聊天...')

  // 构建对话文本
  var chatText = msgs.map(function(m) {
    var role = m.direction === 'out' ? '用户' : '对方'
    return role + '：' + m.body
  }).join('\n')

  // 找到对应的角色
  var charId = null
  var charName = '匿名用户'
  // 找最近的匿名消息获取角色ID
  for (var i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]._anonCharId) {
      charId = msgs[i]._anonCharId
      charName = msgs[i]._anonCharName || '未知'
      break
    }
  }

  var prompt = '请总结以下短信对话，提取关键信息。\n\n' +
    '对话内容：\n' + chatText + '\n\n' +
    '返回JSON格式：\n' +
    '{"title":"记忆标题(10字以内)","content":"记忆内容(50字以内)","keywords":["关键词1","关键词2"],"importance":5,"valence":0,"arousal":0.3}'

  try {
    if (!window.callAI) { window.toast && window.toast('AI不可用'); return }
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
    if (!data || !data.content) { window.toast && window.toast('总结失败'); return }

    // 写入记忆库
    var ownerUid = null
    try {
      var users = await db.characters.where('type').equals('user').toArray()
      if (users.length) ownerUid = String(users[0].id)
    } catch(e) {}

    var memoryRow = {
      ownerUid: ownerUid || 'default',
      charId: charId || 0,
      chatId: 'sms_' + conversationId,
      title: String(data.title || '短信对话').slice(0, 30),
      content: String(data.content).slice(0, 150),
      keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 8) : [],
      valence: typeof data.valence === 'number' ? data.valence : 0,
      arousal: typeof data.arousal === 'number' ? data.arousal : 0.3,
      importance: typeof data.importance === 'number' ? data.importance : 5,
      embedding: null,
      status: 'active',
      sourceMsgStartId: msgs[0] ? msgs[0].id : null,
      sourceMsgEndId: msgs[msgs.length - 1] ? msgs[msgs.length - 1].id : null,
      sourceAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: null,
      accessCount: 0
    }

    await db.memories.add(memoryRow)
    window.toast && window.toast('已写入记忆库：' + data.title)
    console.log('[AnonSMS] 记忆已保存：', data.title)
  } catch(e) {
    console.error('[AnonSMS] 总结失败:', e)
    window.toast && window.toast('总结失败：' + (e.message || '未知错误'))
  }
}

// 匿名短信设置页面
window.showAnonSmsSettings = function() {
  var existing = document.getElementById('anon-sms-settings')
  if (existing) { existing.remove(); return }

  var page = document.createElement('div')
  page.id = 'anon-sms-settings'
  page.className = 'full-page imessage-main'

  var interval = parseInt(localStorage.getItem('anonSmsInterval')) || 180
  var enabledChars = JSON.parse(localStorage.getItem('anonSmsChars') || '[]')

  page.innerHTML =
    '<div class="imessage-header">' +
      '<button class="imessage-back" id="anon-sms-back"><i class="fa fa-angle-left"></i></button>' +
      '<span class="imessage-phone-title">匿名短信设置</span>' +
      '<span style="width:32px"></span>' +
    '</div>' +
    '<div style="padding:16px;overflow-y:auto;flex:1">' +
      '<div style="margin-bottom:20px">' +
        '<div style="font-size:14px;font-weight:600;color:#e5e5ea;margin-bottom:8px">发送间隔</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap" id="anon-interval-btns">' +
          [60,120,180,360,720].map(function(v) {
            return '<button class="anon-interval-btn' + (interval === v ? ' active' : '') + '" data-val="' + v + '" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.15);background:' + (interval === v ? 'var(--x-accent,#1d9bf0)' : 'transparent') + ';color:' + (interval === v ? '#fff' : '#8e8e93') + ';font-size:13px;cursor:pointer">' + (v >= 60 ? (v/60) + '小时' : v + '分钟') + '</button>'
          }).join('') +
        '</div>' +
      '</div>' +
      '<div style="margin-bottom:20px">' +
        '<div style="font-size:14px;font-weight:600;color:#e5e5ea;margin-bottom:8px">可发送匿名短信的角色</div>' +
        '<div id="anon-chars-list" style="display:flex;flex-direction:column;gap:8px"></div>' +
      '</div>' +
      '<div style="font-size:12px;color:#636366;line-height:1.5;padding:12px 0;border-top:1px solid rgba(255,255,255,0.08)">' +
        '触发条件：打开小手机超过25分钟自动触发，每次打开最多触发一次。' +
        '角色会伪装成陌生人发短信试探你。' +
      '</div>' +
    '</div>'

  window.openPage(page)

  // 返回按钮
  page.querySelector('#anon-sms-back').addEventListener('click', function() {
    window.closePage('anon-sms-settings')
  })

  // 间隔按钮
  page.querySelectorAll('.anon-interval-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var val = parseInt(btn.dataset.val)
      localStorage.setItem('anonSmsInterval', String(val))
      page.querySelectorAll('.anon-interval-btn').forEach(function(b) {
        b.style.background = b === btn ? 'var(--x-accent,#1d9bf0)' : 'transparent'
        b.style.color = b === btn ? '#fff' : '#8e8e93'
      })
      window.toast && window.toast('间隔已设为' + (val >= 60 ? (val/60) + '小时' : val + '分钟'))
    })
  })

  // 角色列表
  db.characters.where('type').equals('char').toArray().then(function(chars) {
    var list = page.querySelector('#anon-chars-list')
    if (!chars.length) { list.innerHTML = '<div style="color:#636366;font-size:13px">暂无角色</div>'; return }
    var html = ''
    chars.forEach(function(c) {
      var checked = enabledChars.length === 0 || enabledChars.indexOf(String(c.id)) !== -1
      html += '<label style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(255,255,255,0.04);border-radius:10px;cursor:pointer">' +
        '<input type="checkbox" class="anon-char-cb" data-id="' + c.id + '"' + (checked ? ' checked' : '') + ' style="width:18px;height:18px">' +
        '<span style="font-size:14px;color:#e5e5ea">' + escSmsHtml(c.name) + '</span>' +
      '</label>'
    })
    list.innerHTML = html

    list.querySelectorAll('.anon-char-cb').forEach(function(cb) {
      cb.addEventListener('change', function() {
        var selected = []
        list.querySelectorAll('.anon-char-cb:checked').forEach(function(c) { selected.push(c.dataset.id) })
        localStorage.setItem('anonSmsChars', JSON.stringify(selected))
      })
    })
  })
}

// 在短信列表页添加设置按钮和总结按钮
(function enhanceSmsPages() {
  var origBuildSmsListPage = window.buildSmsListPage || buildSmsListPage
  if (typeof origBuildSmsListPage !== 'function') return

  // 增强聊天页：加总结按钮
  var origOpenSmsChat = window.openSmsChat || openSmsChat
  if (typeof origOpenSmsChat === 'function') {
    var enhanced = async function(conversationId, listPage) {
      await origOpenSmsChat(conversationId, listPage)
      // 在聊天页顶部加总结按钮
      var header = document.querySelector('.imessage-chat-header')
      if (header) {
        var summaryBtn = document.createElement('button')
        summaryBtn.className = 'imessage-chat-summary-btn'
        summaryBtn.innerHTML = '<i class="fa-solid fa-brain"></i>'
        summaryBtn.title = '总结并记忆'
        summaryBtn.style.cssText = 'background:none;border:none;color:#8e8e93;font-size:16px;cursor:pointer;padding:8px;margin-left:auto'
        summaryBtn.addEventListener('click', function() { window.summarizeSmsToMemory(conversationId) })
        header.appendChild(summaryBtn)
      }
    }
    window.openSmsChat = enhanced
  }
})()
