// x-page.js — 仿 X (Twitter) 页面 · 完全重写
// 依赖：db.js, settings.js (window.callAI)

// ===== 常量 =====
var X_SESSION_UID_KEY = 'wanwan_x_uid'
var X_PROFILE_PREFIX = 'wanwan_x_profile_'
var X_POSTS_KEY = 'wanwan_x_posts'
var X_COMMENTS_PREFIX = 'wanwan_x_comments_'
var X_NOTIFY_KEY = 'wanwan_x_notifications'
var X_FOLLOWS_PREFIX = 'wanwan_x_follows_'
var X_SETTINGS_KEY = 'wanwan_x_settings'

// 帖子分类
var X_CATEGORIES = [
  { id: 1, name: '情侣情感日常' },
  { id: 2, name: '现实琐事发泄' },
  { id: 3, name: '隐秘心事倾诉' },
  { id: 4, name: '个人生活记录' },
  { id: 5, name: '疑问求助类' },
  { id: 6, name: '观点感慨类' },
  { id: 7, name: '哲学思考随笔' }
]

// NPC人设池
var X_NPC_TYPES = [
  { id: 2, name: '极端占有欲型', style: '偏执控制欲强、霸道、情绪化' },
  { id: 3, name: '极端暴躁威胁型', style: '冲动易怒、放狠话、暴力式发言' },
  { id: 4, name: '反向挑衅摆烂型', style: '不怕被骂、反向调侃、阴阳怪气' },
  { id: 5, name: '理性清醒劝分型', style: '理智现实、直接劝分、及时止损' },
  { id: 6, name: '刻薄批判吐槽型', style: '嘴毒直白、嘲讽恋爱脑' },
  { id: 7, name: '纯吃瓜围观型', style: '看热闹、不站队、蹲后续' },
  { id: 8, name: '温柔共情理解型', style: '包容理解、不随便指责' },
  { id: 9, name: '极简路人沉默型', style: '评论极短、简单一句就划走' },
  { id: 10, name: '多愁善感感性型', style: '容易代入、感慨伤感' },
  { id: 11, name: '极度现实利弊型', style: '只看利弊物质、清醒现实' },
  { id: 12, name: '好为人师说教型', style: '喜欢讲道理、指点别人' },
  { id: 13, name: '温柔乐观祝福型', style: '阳光善良、祝福别人' },
  { id: 14, name: '断章取义敷衍型', style: '不看全文就乱评论、带节奏' },
  { id: 15, name: '浪漫理想纯情型', style: '向往纯粹浪漫爱情、感性' }
]

// XX 老婆奴常驻角色
var X_XX_CHARACTER = {
  id: 'xx_laopo',
  name: 'XX',
  handle: 'xx_love',
  type: 'char',
  bio: '表面吐槽老婆，实际全世界最爱老婆。谁敢说我老婆一句坏话，我弄死你。',
  signature: '有老婆就是了不起',
  avatar: null, // 灰色默认头像
  isSystem: true
}

// NPC名字池
var X_NPC_NAMES = [
  '路人甲', '吃瓜群众', '键盘侠', '温柔姐姐', '暴躁老哥',
  '理智网友', '感性小妹', '过来人', '旁观者', '热心市民',
  '冷漠路人', '鸡汤大师', '毒舌达人', '浪漫诗人', '现实主义者',
  '小透明', '潜水党', '话痨王', '杠精本精', '佛系青年'
]

// ===== SVG图标 =====
var X_SVG = {
  comment: '<svg viewBox="0 0 24 24"><g><path d="M1.751 10c0-4.42 3.584-8.005 8.005-8.005h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.005zm8.005-6.005c-3.317 0-6.005 2.69-6.005 6.005 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>',
  retweet: '<svg viewBox="0 0 24 24"><g><path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.791-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.791 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46 2.068 1.93V8c0-1.1-.896-2-2-2z"></path></g></svg>',
  like_empty: '<svg viewBox="0 0 24 24"><g><path d="M16.697 5.5c-1.222-.06-2.679.51-3.89 2.16l-.805 1.09-.806-1.09C9.984 6.01 8.526 5.44 7.304 5.5c-1.243.07-2.349.78-2.91 1.91-.552 1.12-.633 2.78.479 4.82 1.074 1.97 3.257 4.27 7.129 6.61 3.87-2.34 6.052-4.64 7.126-6.61 1.111-2.04 1.03-3.7.477-4.82-.561-1.13-1.666-1.84-2.908-1.91zm4.187 7.69c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>',
  like_solid: '<svg viewBox="0 0 24 24"><g><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>',
  share: '<svg viewBox="0 0 24 24"><g><path d="M12 2.59l5.7 5.7-1.41 1.42L13 6.41V16h-2V6.41l-3.29 3.3-1.42-1.42L12 2.59zM21 15l-.02 3.51c0 1.38-1.12 2.49-2.5 2.49H5.5C4.11 21 3 19.88 3 18.5V15h2v3.5c0 .28.22.5.5.5h12.98c.28 0 .5-.22.5-.5L19 15h2z"></path></g></svg>',
  more: '<svg viewBox="0 0 24 24"><g><path d="M3 12c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2zm9 2c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm7 0c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"></path></g></svg>',
  home: '<svg viewBox="0 0 24 24"><g><path d="M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913v-7.075h3.008v7.075c0 .502.418.913.929.913h6.638c.511 0 .929-.41.929-.913V7.904c0-.301-.158-.584-.408-.758zM20 20l-4.5.01v-7.09c0-.5-.418-.91-.929-.91H9.43c-.511 0-.929.41-.929.91L8.5 20H4V8.773l8-5.27 8 5.271V20z"></path></g></svg>',
  home_filled: '<svg viewBox="0 0 24 24"><g><path d="M21.591 7.146L12.52 1.157c-.316-.21-.724-.21-1.04 0l-9.071 5.99c-.26.173-.409.456-.409.757v13.183c0 .502.418.913.929.913H9.14c.511 0 .929-.41.929-.913v-7.075h3.862v7.075c0 .502.418.913.929.913h6.141c.511 0 .929-.41.929-.913V7.904c0-.301-.158-.584-.408-.758z"></path></g></svg>',
  search: '<svg viewBox="0 0 24 24"><g><path d="M10.25 3.75c-3.59 0-6.5 2.91-6.5 6.5s2.91 6.5 6.5 6.5c1.795 0 3.419-.726 4.596-1.904 1.178-1.177 1.904-2.801 1.904-4.596 0-3.59-2.91-6.5-6.5-6.5zm-8.5 6.5c0-4.694 3.806-8.5 8.5-8.5s8.5 3.806 8.5 8.5c0 1.986-.682 3.815-1.824 5.262l4.781 4.781-1.414 1.414-4.781-4.781c-1.447 1.142-3.276 1.824-5.262 1.824-4.694 0-8.5-3.806-8.5-8.5z"></path></g></svg>',
  bell: '<svg viewBox="0 0 24 24"><g><path d="M19.993 9.042C19.48 5.017 16.054 2 11.996 2s-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.435-1.718 4.9-4h4.236l-1.143-8.958zM12 20c-1.306 0-2.417-.835-2.829-2h5.658c-.412 1.165-1.523 2-2.829 2zm-6.866-4l.847-6.698C6.364 6.272 8.941 4 11.996 4s5.627 2.268 6.013 5.295L18.858 16H5.134z"></path></g></svg>',
  bell_filled: '<svg viewBox="0 0 24 24"><g><path d="M11.996 2c-4.062 0-7.49 3.021-7.999 7.051L2.866 18H7.1c.463 2.282 2.481 4 4.9 4s4.435-1.718 4.9-4h4.236l-1.143-8.958C19.48 5.017 16.054 2 11.996 2zM9.171 18h5.658c-.412 1.165-1.523 2-2.829 2s-2.417-.835-2.829-2z"></path></g></svg>',
  mail: '<svg viewBox="0 0 24 24"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.333 8-5.333V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 5.334-8-5.334V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"></path></g></svg>',
  mail_filled: '<svg viewBox="0 0 24 24"><g><path d="M1.998 5.5c0-1.381 1.119-2.5 2.5-2.5h15c1.381 0 2.5 1.119 2.5 2.5v13c0 1.381-1.119 2.5-2.5 2.5h-15c-1.381 0-2.5-1.119-2.5-2.5v-13zm2.5-.5c-.276 0-.5.224-.5.5v2.764l8 5.333 8-5.333V5.5c0-.276-.224-.5-.5-.5h-15zm15.5 5.463l-8 5.334-8-5.334V18.5c0 .276.224.5.5.5h15c.276 0 .5-.224.5-.5v-8.037z"></path></g></svg>',
  chart: '<svg viewBox="0 0 24 24"><g><path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10H6v10H4zm9.248 0v-7h2v7h-2z"></path></g></svg>',
  verified: '<svg viewBox="0 0 24 24"><g><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"></path></g></svg>',
  x_logo: '<svg viewBox="0 0 24 24"><g><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></g></svg>',
  back: '<svg viewBox="0 0 24 24"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z"></path></g></svg>',
  heart: '<svg viewBox="0 0 24 24"><g><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>',
  reply: '<svg viewBox="0 0 24 24"><g><path d="M1.751 10c0-4.42 3.584-8.005 8.005-8.005h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.005zm8.005-6.005c-3.317 0-6.005 2.69-6.005 6.005 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>'
}

// ===== 工具函数 =====
function xEscape(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  })
}

function formatXNumber(n) {
  if (typeof n === 'string') return n
  if (n == null || isNaN(n)) return '0'
  n = Math.floor(Number(n))
  if (n >= 10000) return (n / 10000).toFixed(2).replace(/\.?0+$/, '') + '万'
  return n.toLocaleString('en-US')
}

function formatXContent(str) {
  return xEscape(str)
    .replace(/(#[A-Za-z0-9_\u4e00-\u9fa5]+)/g, '<span class="x-hashtag">$1</span>')
    .replace(/\n/g, '<br>')
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateEngagement() {
  return {
    views: randomInt(800, 250000),
    likes: randomInt(50, 100000),
    retweets: randomInt(10, 12000),
    quotes: randomInt(0, 3000)
  }
}

function generateCommentStats() {
  return {
    comments: randomInt(0, 500),
    retweets: randomInt(0, 200),
    likes: randomInt(0, 1000),
    views: randomInt(0, 500)
  }
}

function formatXTime(date) {
  var d = date instanceof Date ? date : new Date(date)
  var h = d.getHours()
  var m = d.getMinutes()
  var ampm = h >= 12 ? '下午' : '上午'
  var h12 = h % 12 || 12
  var timeStr = String(h12).padStart(2, '0') + ':' + String(m).padStart(2,0) + ' ' + ampm
  var months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
  return timeStr + ' · ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)
}

function timeAgo(date) {
  var ts = date instanceof Date ? date.getTime() : new Date(date).getTime()
  if (isNaN(ts)) return '刚刚'
  var diff = Date.now() - ts
  if (diff < 0) return '刚刚'
  var mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return mins + 'm'
  var hours = Math.floor(mins / 60)
  if (hours < 24) return hours + 'h'
  var days = Math.floor(hours / 24)
  if (days < 30) return days + 'd'
  return Math.floor(days / 30) + '月'
}

// 生成灰色默认头像HTML
function buildXDefaultAvatar(name) {
  var letter = (name || '匿').slice(0, 1)
  return '<span class="x-avatar-placeholder">' + xEscape(letter) + '</span>'
}

function getXAvatarHTML(char) {
  if (char && char.avatar) return '<img src="' + xEscape(char.avatar) + '" alt="">'
  return buildXDefaultAvatar(char ? (char.name || char.nick) : '')
}

// ===== 数据层（localStorage）=====
function xLoadPosts() {
  try { return JSON.parse(localStorage.getItem(X_POSTS_KEY)) || [] } catch(e) { return [] }
}

function xSavePosts(posts) {
  try { localStorage.setItem(X_POSTS_KEY, JSON.stringify(posts)) } catch(e) {}
}

// ===== 图片存储（头像/封面）=====
function xSaveImage(key, dataUrl) {
  try { localStorage.setItem('wanwan_x_img_' + key, dataUrl) } catch(e) {}
}
function xLoadImage(key) {
  try { return localStorage.getItem('wanwan_x_img_' + key) || null } catch(e) { return null }
}
function xPickImage(callback, maxSize) {
  maxSize = maxSize || 400
  var input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.style.display = 'none'
  document.body.appendChild(input)
  input.addEventListener('change', function() {
    if (!input.files || !input.files[0]) { input.remove(); return }
    var reader = new FileReader()
    reader.onload = function(e) {
      var img = new Image()
      img.onload = function() {
        var canvas = document.createElement('canvas')
        var ratio = Math.min(maxSize / img.width, maxSize / img.height, 1)
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        var ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        callback(canvas.toDataURL('image/jpeg', 0.8))
        input.remove()
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(input.files[0])
  })
  input.click()
}

function xLoadComments(postId) {
  try {
    var comments = JSON.parse(localStorage.getItem(X_COMMENTS_PREFIX + postId)) || []
    // 修复旧数据：replyTo可能是authorId而不是comment.id
    var dirty = false
    comments.forEach(function(c) {
      if (c.isReply && c.replyTo) {
        var target = comments.find(function(t) { return t.id === c.replyTo })
        if (!target) {
          // replyTo没匹配到id，尝试用authorId匹配
          var byAuthor = comments.find(function(t) { return t.authorId === c.replyTo })
          if (byAuthor) { c.replyTo = byAuthor.id; c.replyToName = byAuthor.authorName; dirty = true }
          else { c.isReply = false; dirty = true }
        }
      }
    })
    if (dirty) localStorage.setItem(X_COMMENTS_PREFIX + postId, JSON.stringify(comments))
    return comments
  } catch(e) { return [] }
}

function xSaveComments(postId, comments) {
  try { localStorage.setItem(X_COMMENTS_PREFIX + postId, JSON.stringify(comments)) } catch(e) {}
}

function xLoadNotifications() {
  try { return JSON.parse(localStorage.getItem(X_NOTIFY_KEY)) || [] } catch(e) { return [] }
}

function xSaveNotifications(notifs) {
  try { localStorage.setItem(X_NOTIFY_KEY, JSON.stringify(notifs)) } catch(e) {}
}

function xLoadFollows(userId) {
  try {
    var f = JSON.parse(localStorage.getItem(X_FOLLOWS_PREFIX + userId)) || []
    // 确保XX在关注列表中
    if (f.indexOf(X_XX_CHARACTER.id) === -1) {
      f.unshift(X_XX_CHARACTER.id)
      xSaveFollows(userId, f)
    }
    return f
  } catch(e) {
    xSaveFollows(userId, [X_XX_CHARACTER.id])
    return [X_XX_CHARACTER.id]
  }
}

function xSaveFollows(userId, follows) {
  try { localStorage.setItem(X_FOLLOWS_PREFIX + userId, JSON.stringify(follows)) } catch(e) {}
}

function xIsFollowing(userId, targetId) {
  var follows = xLoadFollows(userId)
  return follows.indexOf(targetId) !== -1
}

function xToggleFollow(userId, targetId) {
  var follows = xLoadFollows(userId)
  var idx = follows.indexOf(targetId)
  if (idx === -1) {
    follows.push(targetId)
  } else {
    follows.splice(idx, 1)
  }
  xSaveFollows(userId, follows)
  return idx === -1 // true = now following
}

function xLoadSettings() {
  try {
    return JSON.parse(localStorage.getItem(X_SETTINGS_KEY)) || { theme: 'dark', autoPost: false, autoPostInterval: 240, commentCount: 5 }
  } catch(e) {
    return { theme: 'dark', autoPost: false, autoPostInterval: 240, commentCount: 5 }
  }
}

function xSaveSettings(settings) {
  localStorage.setItem(X_SETTINGS_KEY, JSON.stringify(settings))
}

// 生成唯一ID
function xGenId() {
  return 'x_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8)
}

// 生成NPC评论者信息
function xGenNpcCommenter() {
  var npcType = randomPick(X_NPC_TYPES)
  var name = randomPick(X_NPC_NAMES)
  return {
    id: 'npc_' + xGenId(),
    name: name,
    handle: '@' + name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 10),
    avatar: null,
    npcType: npcType,
    isNpc: true,
    isAnonymous: Math.random() < 0.3
  }
}

// ===== 用户会话 =====
window.showXPage = async function() {
  var user = await getXSessionUser()
  if (!user) { showXLoginPage(); return }
  renderXMainPage(user)
}

async function getXSessionUser() {
  var stored = localStorage.getItem(X_SESSION_UID_KEY)
  if (!stored) return null
  var uid = parseInt(stored)
  if (!Number.isFinite(uid)) { localStorage.removeItem(X_SESSION_UID_KEY); return null }
  var user = window.getCharacter ? await window.getCharacter(uid) : await db.characters.get(uid)
  if (!user || user.type !== 'user') { localStorage.removeItem(X_SESSION_UID_KEY); return null }
  return user
}

function setXSessionUser(user) {
  if (!user || user.type !== 'user') return
  localStorage.setItem(X_SESSION_UID_KEY, user.id)
}

async function getXUserList() {
  if (!window.db || !db.characters) return []
  try { return await db.characters.where('type').equals('user').toArray() }
  catch(e) { return (await db.characters.toArray()).filter(function(u) { return u.type === 'user' }) }
}

function getXUserName(user) {
  if (user && user.id) {
    try {
      var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id))
      if (p && p.name) return p.name
    } catch(e) {}
  }
  return (user && (user.nick || user.name)) || '微信用户'
}
function getXUserHandle(user) {
  if (user && user.id) {
    try {
      var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id))
      if (p && p.handle) return '@' + p.handle
    } catch(e) {}
  }
  if (user && user.identity && user.identity.account) return '@' + user.identity.account

  var acc = user && user.identity && user.identity.account
  return '@' + (acc ? String(acc).replace(/^@+/, '') : getXUserName(user).replace(/\s+/g, '_'))
}

// ===== 登录页 =====
function showXLoginPage(opts) {
  opts = opts || {}
  var existing = document.getElementById('x-login-page')
  if (existing) existing.remove()
  var page = document.createElement('div')
  page.id = 'x-login-page'
  page.className = 'x-login-page'
  page.innerHTML =
    '<button class="x-login-close" type="button"><i class="fa fa-angle-left"></i></button>' +
    '<div class="x-login-shell">' +
      '<div class="x-login-logo">' + X_SVG.x_logo + '</div>' +
      '<div class="x-login-title">登录 X</div>' +
      '<div class="x-login-subtitle">选择微信账号继续</div>' +
      '<button class="x-login-wechat" id="x-login-wechat" type="button">' +
        '<svg class="x-login-wechat-svg" viewBox="0 0 576 512"><path d="M385.2 167.6c6.4 0 12.6.3 18.8 1.1C387.4 90.3 303.3 32 207.7 32 100.5 32 13 104.8 13 197.4c0 53.4 29.3 97.5 77.9 131.6l-19.3 58.6 68.1-34.1c24.4 4.8 43.8 9.7 68.2 9.7 6.2 0 12.1-.3 18.3-.8-3.9-12.9-6.2-26.6-6.2-40.8-.1-84.9 72.9-154 165.2-154zM280.7 114.7c14.5 0 24.2 9.7 24.2 24.4 0 14.5-9.7 24.2-24.2 24.2-14.8 0-29.3-9.7-29.3-24.2.1-14.7 14.6-24.4 29.3-24.4zm-136.4 48.6c-14.5 0-29.3-9.7-29.3-24.2 0-14.8 14.8-24.4 29.3-24.4 14.8 0 24.4 9.7 24.4 24.4 0 14.6-9.6 24.2-24.4 24.2zM563 319.4c0-77.9-77.9-141.3-165.4-141.3-92.7 0-165.4 63.4-165.4 141.3s72.8 141.3 165.4 141.3c19.3 0 38.9-5.1 58.6-9.9l53.4 29.3-14.8-48.6C534 402.1 563 363.2 563 319.4zM343.9 294.9c-9.7 0-19.3-9.7-19.3-19.4 0-9.9 9.7-19.6 19.3-19.6 14.8 0 24.4 9.7 24.4 19.6 0 9.7-9.6 19.4-24.4 19.4zm107.1 0c-9.7 0-19.3-9.7-19.3-19.4 0-9.9 9.7-19.6 19.3-19.6 14.8 0 24.4 9.7 24.4 19.6.1 9.7-9.5 19.4-24.4 19.4z"></path></svg>' +
        '<span>通过微信登录</span>' +
      '</button>' +
      '<div class="x-login-users" id="x-login-users" hidden></div>' +
    '</div>'
  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  page.querySelector('.x-login-close').addEventListener('click', function() { closePage('x-login-page') })
  page.querySelector('#x-login-wechat').addEventListener('click', function() {
    var list = page.querySelector('#x-login-users')
    list.hidden = false
    list.innerHTML = '<div class="x-loading"><i class="fa fa-spinner fa-spin"></i></div>'
    getXUserList().then(function(users) {
      if (!users.length) { list.innerHTML = '<div class="x-login-empty"><div>暂无账号</div><span>请先在角色档案里创建 USER 类型角色</span></div>'; return }
      list.innerHTML = users.map(function(u) {
        return '<button class="x-login-user" type="button" data-uid="' + u.id + '">' +
          '<span class="x-login-user-avatar">' + getXAvatarHTML(u) + '</span>' +
          '<span class="x-login-user-main"><span class="x-login-user-name">' + xEscape(getXUserName(u)) + '</span>' +
          '<span class="x-login-user-account">' + xEscape(u.identity && u.identity.account ? '@' + u.identity.account : '微信用户') + '</span></span>' +
          '<i class="fa fa-angle-right"></i></button>'
      }).join('')
      list.querySelectorAll('.x-login-user').forEach(function(row) {
        row.addEventListener('click', function() {
          var user = users.find(function(u) { return u.id === parseInt(row.dataset.uid) })
          if (!user) return
          setXSessionUser(user)
          closePage('x-login-page')
          renderXMainPage(user)
        })
      })
    })
  })
}

function closePage(id) {
  var el = document.getElementById(id)
  if (!el) return
  if (window.closePage) { try { window.closePage(id) } catch(e) { el.remove() } }
  else el.remove()
}

// ===== 主页（4个Tab）=====
function renderXMainPage(user) {
  var existing = document.getElementById('x-page')
  if (existing) existing.remove()

  var page = document.createElement('div')
  page.id = 'x-page'
  page.dataset.uid = user.id

  page.innerHTML =
    '<div class="x-topbar">' +
      '<div class="x-topbar-main">' +
        '<button class="x-topbar-back" type="button">' + X_SVG.back + '</button>' +
        '<div class="x-topbar-logo">' + X_SVG.x_logo + '</div>' +
        '<button class="x-topbar-right" type="button"><i class="fa-solid fa-gear"></i></button>' +
        '<button class="x-topbar-gen" type="button"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' +
      '</div>' +
    '</div>' +
    '<div class="x-feed" id="x-feed">' +
      '<div class="x-tab-panel active" id="x-tab-home"></div>' +
      '<div class="x-tab-panel" id="x-tab-search"></div>' +
      '<div class="x-tab-panel" id="x-tab-notify"></div>' +
      '<div class="x-tab-panel" id="x-tab-profile"></div>' +
    '</div>' +
    '<button class="x-fab" id="x-fab"><i class="fi fi-rr-plus"></i></button>' +
    '<div class="x-bottombar" id="x-bottombar">' +
      buildXBottomBar() +
    '</div>'

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  // 渲染各Tab内容
  renderXHomeTab(page, user)
  renderXSearchTab(page, user)
  renderXNotifyTab(page, user)
  renderXProfileTab(page, user)

  // Tab切换
  var items = page.querySelectorAll('.x-bottombar-item')
  items.forEach(function(item) {
    item.addEventListener('click', function() {
      items.forEach(function(i) { i.classList.remove('active') })
      item.classList.add('active')
      var tabId = item.dataset.tab
      page.querySelectorAll('.x-tab-panel').forEach(function(p) { p.classList.remove('active') })
      var panel = page.querySelector('#x-tab-' + tabId)
      if (panel) panel.classList.add('active')
      // 通知tab清除红点
      if (tabId === 'notify') {
        var dot = page.querySelector('.x-bottombar-dot')
        if (dot) dot.classList.remove('show')
      }
      // FAB只在首页显示
      var fab = page.querySelector('#x-fab')
      if (fab) fab.style.display = tabId === 'home' ? '' : 'none'
    })
  })

  // FAB发帖
  page.querySelector('#x-fab').addEventListener('click', function() { showXCompose(user) })

  // 设置按钮
  page.querySelector('.x-topbar-right').addEventListener('click', function() { showXSettingsPage(user) })

  // 生成帖子按钮
  var genBtn = page.querySelector('.x-topbar-gen')
  if (genBtn) {
    genBtn.addEventListener('click', function() {
      showXGenPostsDialog(user, genBtn, page)
    })
  }

  // 返回按钮
  page.querySelector('.x-topbar-back').addEventListener('click', function() {
    var el = document.getElementById('x-page')
    if (el) el.remove()
  })

  // 启动自动发帖定时器
  startXAutoPostScheduler(user)
}

function buildXBottomBar() {
  var items = [
    { id: 'home', icon: X_SVG.home, activeIcon: X_SVG.home_filled },
    { id: 'search', icon: X_SVG.search, activeIcon: X_SVG.search },
    { id: 'notify', icon: X_SVG.bell, activeIcon: X_SVG.bell_filled },
    { id: 'profile', icon: X_SVG.mail, activeIcon: X_SVG.mail_filled }
  ]
  return items.map(function(item, i) {
    return '<div class="x-bottombar-item' + (i === 0 ? ' active' : '') + '" data-tab="' + item.id + '">' +
      '<span class="icon-default">' + item.icon + '</span>' +
      '<span class="icon-active">' + item.activeIcon + '</span>' +
      (item.id === 'notify' ? '<span class="x-bottombar-dot" id="x-notify-dot"></span>' : '') +
    '</div>'
  }).join('')
}

// ===== 首页Tab =====
function renderXHomeTab(page, user) {
  var panel = page.querySelector('#x-tab-home')
  var posts = xLoadPosts()
  // 按时间倒序
  posts.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt) })

  if (!posts.length) {
    // 生成一些初始帖子
    panel.innerHTML = '<div class="x-loading"><i class="fa fa-spinner fa-spin"></i></div>'
    generateInitialPosts(user).then(function() {
      renderXHomeTab(page, user)
    })
    return
  }

  panel.innerHTML = posts.map(function(post) { return buildXPostCard(post) }).join('')
  bindPostCardEvents(panel, user)
}

// 生成初始帖子
async function generateInitialPosts(user) {
  var posts = xLoadPosts()
  if (posts.length >= 3) return

  // XX的帖子
  var xxPost = {
    id: xGenId(),
    authorId: X_XX_CHARACTER.id,
    authorName: X_XX_CHARACTER.name,
    authorHandle: '@' + X_XX_CHARACTER.handle,
    authorAvatar: null,
    content: '我老婆今天居然主动给我做饭了，虽然把盐当成了糖，但是我还是全部吃完了。你们这些单身的懂什么，这就是爱情的味道。',
    tags: ['秀恩爱','老婆奴','做饭','甜'],
    category: 1,
    isAnonymous: false,
    engagement: { views: 12500, likes: 3400, retweets: 890, quotes: 156 },
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    comments: []
  }
  posts.push(xxPost)
  xSavePosts(posts)

  // XX帖子的评论
  var npc1 = { id: xGenId(), authorId: 'npc1', authorName: '吃瓜群众', authorHandle: '@chigua', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[6], content: '哈哈哈哈哈这什么黑暗料理，但是好甜啊', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3500000).toISOString(), replies: [] }
  var npc2 = { id: xGenId(), authorId: 'npc2', authorName: '毒舌达人', authorHandle: '@dushe', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[5], content: '盐和糖都分不清？你确定这不是在养女儿？', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3400000).toISOString(), replies: [] }
  var npc3 = { id: xGenId(), authorId: 'npc3', authorName: '温柔姐姐', authorHandle: '@wenrou', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[7], content: '愿意吃完就是最大的浪漫了，祝福你们', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3300000).toISOString(), replies: [] }
  var xxReply = { id: xGenId(), authorId: X_XX_CHARACTER.id, authorName: X_XX_CHARACTER.name, authorHandle: '@' + X_XX_CHARACTER.handle, authorAvatar: null, isSystem: true, content: '你管得着吗？我老婆做的就是最好吃的，你肯定是嫉妒我有老婆', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3200000).toISOString(), replies: [], isReply: true, replyTo: npc2.id, replyToName: npc2.authorName }
  var xxComments = [npc1, npc2, npc3, xxReply]
  xSaveComments(xxPost.id, xxComments)
}

// ===== 帖子卡片构建 =====
function buildXPostCard(post) {
  var isAnon = post.isAnonymous
  var name = isAnon ? '匿名用户' : (post.authorName || '未知')
  var handle = isAnon ? '' : (post.authorHandle || '')
  var avatarHTML = isAnon ? buildXDefaultAvatar('匿名') : (post.authorAvatar ? '<img src="' + xEscape(post.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name))
  var e = post.engagement || {}
  var comments = xLoadComments(post.id)

  return '<div class="x-post" data-post-id="' + post.id + '">' +
    '<div class="x-post-avatar" data-char-id="' + xEscape(post.authorId) + '">' + avatarHTML + '</div>' +
    '<div class="x-post-body">' +
      '<div class="x-post-header">' +
        '<span class="x-post-name">' + xEscape(name) + '</span>' +
        (handle ? '<span class="x-post-handle">' + xEscape(handle) + '</span>' : '') +
        '<span class="x-post-dot">·</span>' +
        '<span class="x-post-time">' + timeAgo(post.createdAt) + '</span>' +
        '<span class="x-post-more">' + X_SVG.more + '</span>' +
        '<button class="x-post-gen-comments" data-post-id="' + post.id + '" title="生成评论"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' +
      '</div>' +
      '<div class="x-post-content">' + formatXContent(post.content) + '</div>' +
      (post.tags && post.tags.length ? '<div class="x-post-tags">' + post.tags.map(function(t) { return '<span class="x-post-tag">#' + xEscape(t) + '</span>' }).join(' ') + '</div>' : '') +
      '<div class="x-post-actions">' +
        '<button class="x-post-action comment" data-post-id="' + post.id + '">' + X_SVG.comment + '<span>' + comments.length + '</span></button>' +
        '<button class="x-post-action retweet">' + X_SVG.retweet + '<span>' + formatXNumber(e.retweets || 0) + '</span></button>' +
        '<button class="x-post-action like" data-liked="0" data-count="' + (e.likes || 0) + '">' + X_SVG.like_empty + '<span>' + formatXNumber(e.likes || 0) + '</span></button>' +
        '<button class="x-post-action share">' + X_SVG.share + '</button>' +
      '</div>' +
      (isAnon && post.authorId && post.authorId.indexOf('npc_') !== 0 ?
        '<button class="x-reveal-anon" data-post-id="' + post.id + '" style="margin-top:8px;padding:4px 12px;border-radius:999px;border:1px solid var(--x-border-strong);background:transparent;color:var(--x-accent);font-size:12px;cursor:pointer;">解除匿名</button>' : '') +
    '</div>' +
  '</div>'
}

// 绑定帖子卡片事件
function bindPostCardEvents(container, user) {
  // 点赞
  container.querySelectorAll('.x-post-action.like').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      var liked = btn.dataset.liked === '1'
      var count = parseInt(btn.dataset.count || 0) + (liked ? -1 : 1)
      btn.dataset.count = String(count)
      btn.dataset.liked = liked ? '0' : '1'
      btn.classList.toggle('liked', !liked)
      btn.innerHTML = (liked ? X_SVG.like_empty : X_SVG.like_solid) + '<span>' + formatXNumber(count) + '</span>'
    })
  })

  // 帖子点击进入详情
  container.querySelectorAll('.x-post').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.x-post-action') || e.target.closest('.x-reveal-anon') || e.target.closest('.x-post-avatar')) return
      showXPostDetail(card.dataset.postId, user)
    })
  })

  // 评论按钮点击进入详情
  container.querySelectorAll('.x-post-action.comment').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      showXPostDetail(btn.dataset.postId, user)
    })
  })

  // 头像点击进入角色主页
  container.querySelectorAll('.x-post-avatar').forEach(function(avatar) {
    avatar.addEventListener('click', function(e) {
      e.stopPropagation()
      var charId = avatar.dataset.charId
      if (charId && charId.indexOf('npc_') !== 0) showXCharacterProfile(charId, user)
    })
  })

  // 解除匿名
  container.querySelectorAll('.x-reveal-anon').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation()
      revealAnonymous(btn.dataset.postId, user)
    })
  })
}

// 解除匿名
function revealAnonymous(postId, user) {
  var posts = xLoadPosts()
  var post = posts.find(function(p) { return p.id === postId })
  if (!post || !post.isAnonymous) return

  // 检查是否是自建AI（NPC无法解除）
  if (post.authorId && post.authorId.indexOf('npc_') === 0) {
    if (window.toast) window.toast('无法解除此匿名用户的身份')
    return
  }

  post.isAnonymous = false
  // 恢复真实作者信息
  if (post.realAuthorId) {
    post.authorId = post.realAuthorId
    post.authorName = post.realAuthorName || '微信用户'
    post.authorHandle = post.realAuthorHandle || ''
    post.authorAvatar = post.realAuthorAvatar || null
  }
  xSavePosts(posts)

  // 刷新页面
  var page = document.getElementById('x-page')
  if (page) renderXHomeTab(page, user)
}

// ===== 帖子详情页 =====
function showXPostDetail(postId, user) {
  var posts = xLoadPosts()
  var post = posts.find(function(p) { return p.id === postId })
  if (!post) return
  var comments = xLoadComments(postId)
  var isAnon = post.isAnonymous
  var name = isAnon ? '匿名用户' : (post.authorName || '未知')
  var handle = isAnon ? '' : (post.authorHandle || '')
  var avatarHTML = isAnon ? buildXDefaultAvatar('匿名') : (post.authorAvatar ? '<img src="' + xEscape(post.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name))
  var e = post.engagement || {}

  var page = document.createElement('div')
  page.id = 'x-detail-page'
  page.className = 'x-detail-page'
  page.innerHTML =
    '<div class="x-detail-header">' +
      '<button class="x-detail-back" type="button">' + X_SVG.back + '</button>' +
      '<div class="x-detail-title">帖子</div>' +
    '</div>' +
    '<div class="x-detail-scroll">' +
      '<div class="x-detail-post">' +
        '<div style="display:flex">' +
          '<div class="x-post-avatar" data-char-id="' + xEscape(post.authorId) + '" style="cursor:pointer">' + avatarHTML + '</div>' +
          '<div class="x-post-body">' +
            '<div class="x-post-header">' +
              '<span class="x-post-name">' + xEscape(name) + '</span>' +
              (handle ? '<span class="x-post-handle">' + xEscape(handle) + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="x-post-content" style="font-size:17px;line-height:1.5;margin-top:12px">' + formatXContent(post.content) + '</div>' +
        (post.tags && post.tags.length ? '<div class="x-post-tags">' + post.tags.map(function(t) { return '<span class="x-post-tag">#' + xEscape(t) + '</span>' }).join(' ') + '</div>' : '') +
        '</div>' +
        '<div class="x-detail-meta">' +
        '<div class="x-detail-time">' + formatXTime(post.createdAt) + ' · <strong>' + formatXNumber(e.views || 0) + '</strong> 次查看</div>' +
        '<div class="x-detail-stats">' +
          '<span><strong>' + formatXNumber(e.retweets || 0) + '</strong> 转推</span>' +
          '<span><strong>' + formatXNumber(e.quotes || 0) + '</strong> 引用推文</span>' +
          '<span><strong>' + formatXNumber(e.likes || 0) + '</strong> 喜欢</span>' +
        '</div>' +
      '</div>' +
      '<div class="x-detail-actions">' +
        '<button class="x-detail-action comment">' + X_SVG.comment + '</button>' +
        '<button class="x-detail-action retweet">' + X_SVG.retweet + '</button>' +
        '<button class="x-detail-action like" data-liked="0" data-count="' + (e.likes || 0) + '">' + X_SVG.like_empty + '</button>' +
        '<button class="x-detail-action share">' + X_SVG.share + '</button>' +
      '</div>' +
      '<div class="x-comments-section" id="x-comments-list">' +
        buildXCommentsList(comments) +
      '</div>' +
    '</div>' +
    '<div class="x-comment-input-wrap">' +
      '<button class="x-comment-gen-btn" data-post-id="' + postId + '" title="AI生成评论"><i class="fa-solid fa-wand-magic-sparkles"></i></button>' +
      '<input class="x-comment-input" placeholder="发表评论..." maxlength="500">' +
      '<button class="x-comment-send">回复</button>' +
    '</div>'

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  // 返回按钮
  page.querySelector('.x-detail-back').addEventListener('click', function() { closePage('x-detail-page') })

  // 点赞
  var likeBtn = page.querySelector('.x-detail-action.like')
  likeBtn.addEventListener('click', function() {
    var liked = likeBtn.dataset.liked === '1'
    var count = parseInt(likeBtn.dataset.count || 0) + (liked ? -1 : 1)
    likeBtn.dataset.count = String(count)
    likeBtn.dataset.liked = liked ? '0' : '1'
    likeBtn.classList.toggle('liked', !liked)
    likeBtn.innerHTML = (liked ? X_SVG.like_empty : X_SVG.like_solid)
  })

  // 评论输入
  var input = page.querySelector('.x-comment-input')
  var sendBtn = page.querySelector('.x-comment-send')
  input.addEventListener('input', function() {
    sendBtn.classList.toggle('active', input.value.trim().length > 0)
  })
  sendBtn.addEventListener('click', function() {
    var text = input.value.trim()
    if (!text) return
    var quoteContent = input.dataset.quoteContent || ''
    var quoteName = input.dataset.quoteName || ''
    addXComment(postId, user, text, quoteContent, quoteName)
    input.value = ''
    input.placeholder = '发表评论...'
    delete input.dataset.replyTo
    delete input.dataset.replyToName
    delete input.dataset.quoteContent
    delete input.dataset.quoteName
    sendBtn.classList.remove('active')
    page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(xLoadComments(postId))
    bindCommentEvents(page, postId, user, input, sendBtn)
  })

  // 生成评论按钮
  var genBtn = page.querySelector('.x-comment-gen-btn')
  if (genBtn) {
    genBtn.addEventListener('click', function() {
      genBtn.classList.add('loading')
      var posts = xLoadPosts()
      var post = posts.find(function(p) { return p.id === postId })
      if (post && window.callAI) {
        generateAIComments(post).then(function() {
          genBtn.classList.remove('loading')
          page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(xLoadComments(postId))
          bindCommentEvents(page, postId, user, input, sendBtn)
        })
      } else {
        genBtn.classList.remove('loading')
      }
    })
  }

  // 绑定评论点击事件
  bindCommentEvents(page, postId, user, input, sendBtn)
}

// 绑定评论交互事件
function bindCommentEvents(page, postId, user, input, sendBtn) {
  // 移除旧的弹窗
  var oldMenu = page.querySelector('.x-comment-menu-popup')
  if (oldMenu) oldMenu.remove()

  var commentEls = page.querySelectorAll('#x-comments-list .x-comment')
  commentEls.forEach(function(el) {
    // 点击评论回复
    el.addEventListener('click', function(e) {
      if (e.target.closest('.x-comment-action') || e.target.closest('.x-comment-more')) return
      var commentId = el.dataset.commentId
      var name = el.querySelector('.x-comment-name')
      if (name) {
        input.placeholder = '回复 @' + name.textContent + '...'
        input.dataset.replyTo = commentId
        input.dataset.replyToName = name.textContent
        input.focus()
      }
    })

    // 三个点菜单
    var moreBtn = el.querySelector('.x-comment-more')
    if (moreBtn) {
      moreBtn.addEventListener('click', function(e) {
        e.stopPropagation()
        // 关闭已有弹窗
        var existMenu = page.querySelector('.x-comment-menu-popup')
        if (existMenu) { existMenu.remove(); return }

        var commentId = el.dataset.commentId
        var rect = moreBtn.getBoundingClientRect()
        var menu = document.createElement('div')
        menu.className = 'x-comment-menu-popup'
        menu.style.top = (rect.bottom + 4) + 'px'
        menu.style.right = (window.innerWidth - rect.right) + 'px'
        menu.innerHTML =
          '<div class="x-comment-menu-item" data-action="quote"><i class="fa-solid fa-quote-left"></i> 引用</div>' +
          '<div class="x-comment-menu-item" data-action="edit"><i class="fa-solid fa-pen"></i> 编辑</div>' +
          '<div class="x-comment-menu-item x-comment-menu-delete" data-action="delete"><i class="fa-solid fa-trash"></i> 删除</div>'

        page.appendChild(menu)

        // 点击菜单项
        menu.querySelectorAll('.x-comment-menu-item').forEach(function(item) {
          item.addEventListener('click', function(e) {
            e.stopPropagation()
            var action = item.dataset.action
            menu.remove()

            if (action === 'delete') {
              // 删除评论
              var comments = xLoadComments(postId)
              comments = comments.filter(function(c) { return c.id !== commentId })
              xSaveComments(postId, comments)
              page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(comments)
              bindCommentEvents(page, postId, user, input, sendBtn)
            }
            else if (action === 'quote') {
              // 引用评论
              var content = el.querySelector('.x-comment-content')
              var nameEl = el.querySelector('.x-comment-name')
              if (content && nameEl) {
                input.dataset.replyTo = commentId
                input.dataset.replyToName = nameEl.textContent
                input.dataset.quoteContent = content.textContent
                input.dataset.quoteName = nameEl.textContent
                input.placeholder = '回复 @' + nameEl.textContent + '...'
                input.focus()
                sendBtn.classList.add('active')
              }
            }
            else if (action === 'edit') {
              // 编辑评论
              var comments2 = xLoadComments(postId)
              var comment = comments2.find(function(c) { return c.id === commentId })
              if (!comment) return
              showEditCommentPopup(page, postId, comment, user, input, sendBtn)
            }
          })
        })

        // 点击其他地方关闭
        setTimeout(function() {
          document.addEventListener('click', function closeMenu() {
            menu.remove()
            document.removeEventListener('click', closeMenu)
          }, { once: true })
        }, 10)
      })
    }
  })
}

// 编辑评论弹窗
function showEditCommentPopup(page, postId, comment, user, input, sendBtn) {
  var overlay = document.createElement('div')
  overlay.className = 'x-edit-comment-overlay'
  overlay.innerHTML =
    '<div class="x-edit-comment-card">' +
      '<div class="x-edit-comment-title">编辑评论</div>' +
      '<textarea class="x-edit-comment-input" id="x-edit-comment-textarea">' + xEscape(comment.content) + '</textarea>' +
      '<div class="x-edit-comment-btns">' +
        '<button class="x-edit-comment-cancel" id="x-edit-cancel">取消</button>' +
        '<button class="x-edit-comment-save" id="x-edit-save">保存</button>' +
      '</div>' +
    '</div>'
  page.appendChild(overlay)

  var textarea = overlay.querySelector('#x-edit-comment-textarea')
  textarea.focus()
  textarea.setSelectionRange(textarea.value.length, textarea.value.length)

  overlay.querySelector('#x-edit-cancel').addEventListener('click', function() { overlay.remove() })
  overlay.querySelector('#x-edit-save').addEventListener('click', function() {
    var newText = textarea.value.trim()
    if (!newText) return
    var comments = xLoadComments(postId)
    var target = comments.find(function(c) { return c.id === comment.id })
    if (target) {
      target.content = newText
      xSaveComments(postId, comments)
      page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(comments)
      bindCommentEvents(page, postId, user, input, sendBtn)
    }
    overlay.remove()
  })
}

function buildXCommentsList(comments) {
  if (!comments.length) return '<div style="padding:32px;text-align:center;color:var(--x-text-muted);font-size:14px">暂无评论</div>'

  var html = ''
  // 一级评论
  comments.forEach(function(c) {
    if (c.isReply) return // 二级回复单独渲染
    html += buildXCommentItem(c, false)
    // 查找该评论的回复
    var replies = comments.filter(function(r) { return r.isReply && r.replyTo === c.id })
    replies.forEach(function(r) {
      html += buildXCommentItem(r, true)
    })
  })
  return html
}

function buildXCommentItem(comment, isNested) {
  var isAnon = comment.isAnonymous
  
  var replyTarget = comment.replyToName || comment.replyToHandle || ''
var name = isAnon ? '匿名用户' : (comment.authorName || '未知')
  var handle = isAnon ? '' : (comment.authorHandle || '')
  var avatarHTML = isAnon ? buildXDefaultAvatar('匿') : (comment.authorAvatar ? '<img src="' + xEscape(comment.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name))
  var stats = comment.stats || {}

  return '<div class="x-comment' + (isNested ? ' x-comment-reply' : '') + '" data-comment-id="' + comment.id + '">' +
    '<div class="x-comment-avatar">' + avatarHTML + '</div>' +
    '<div class="x-comment-body">' +
      '<div class="x-comment-header">' +
        '<span class="x-comment-name">' + xEscape(name) + '</span>' +
        (handle ? '<span class="x-comment-handle">' + xEscape(handle) + '</span>' : '') +
        '<span class="x-comment-dot">·</span>' +
        '<span class="x-comment-time">' + timeAgo(comment.createdAt) + '</span>' +
        '<span class="x-comment-more">' + X_SVG.more + '</span>' +
      '</div>' +
      (comment.replyToName ? '<div class="x-comment-reply-to">回复 <span class="x-mention">@' + xEscape(comment.replyToName) + '</span></div>' : '') +
      (comment.quoteContent ? '<div class="x-comment-quote"><span class="x-quote-name">@' + xEscape(comment.quoteName || '') + '</span>' + xEscape(comment.quoteContent) + '</div>' : '') +
      '<div class="x-comment-content">' + formatXContent(comment.content) + '</div>' +
      '<div class="x-comment-actions">' +
        '<button class="x-comment-action comment">' + X_SVG.reply + '<span>' + (stats.comments || 0) + '</span></button>' +
        '<button class="x-comment-action retweet">' + X_SVG.retweet + '<span>' + formatXNumber(stats.retweets || 0) + '</span></button>' +
        '<button class="x-comment-action like">' + X_SVG.like_empty + '<span>' + formatXNumber(stats.likes || 0) + '</span></button>' +
        '<button class="x-comment-action chart">' + X_SVG.chart + '<span>' + formatXNumber(stats.views || 0) + '</span></button>' +
        '<button class="x-comment-action share">' + X_SVG.share + '</button>' +
      '</div>' +
    '</div>' +
  '</div>'
}

// 添加评论
function addXComment(postId, user, text, quoteContent, quoteName) {
  var comments = xLoadComments(postId)
  var replyToId = null
  var replyToName = ''
  // 从输入框获取回复目标
  var input = document.querySelector('.x-comment-input')
  if (input && input.dataset.replyTo) {
    replyToId = input.dataset.replyTo
    replyToName = input.dataset.replyToName || ''
  }
  var obj = {
    id: xGenId(),
    authorId: user.id,
    authorName: getXUserName(user),
    authorHandle: getXUserHandle(user),
    authorAvatar: xLoadImage('avatar_' + user.id) || user.avatar || null,
    content: text,
    stats: generateCommentStats(),
    createdAt: new Date().toISOString(),
    replies: []
  }
  if (replyToId) {
    obj.replyTo = replyToId
    obj.replyToName = replyToName
    obj.isReply = true
  }
  if (quoteContent) {
    obj.quoteContent = quoteContent
    obj.quoteName = quoteName || ''
  }
  comments.push(obj)
  xSaveComments(postId, comments)

  // 添加通知
  var posts = xLoadPosts()
  var post = posts.find(function(p) { return p.id === postId })
  if (post) {
    var notifs = xLoadNotifications()
    notifs.unshift({
      id: xGenId(),
      type: 'comment',
      userId: user.id,
      userName: getXUserName(user),
      postId: postId,
      postPreview: text.slice(0, 30),
      createdAt: new Date().toISOString()
    })
    xSaveNotifications(notifs)
    showNotifyDot()
  }
}

// ===== 发帖页面 =====
function showXCompose(user) {
  var existing = document.getElementById('x-compose')
  if (existing) existing.remove()
  var page = document.createElement('div')
  page.id = 'x-compose'
  page.className = 'x-compose-page'
  var isAnonymous = false

  page.innerHTML =
    '<div class="x-compose-header">' +
      '<button class="x-compose-cancel">取消</button>' +
      '<button class="x-compose-publish">发布</button>' +
    '</div>' +
    '<div class="x-compose-anon-row">' +
      '<span class="x-compose-anon-label">匿名发帖</span>' +
      '<button class="x-compose-anon-toggle" id="x-anon-toggle" type="button"></button>' +
    '</div>' +
    '<div class="x-compose-body">' +
      '<div class="x-compose-avatar" id="x-compose-avatar">' + getXAvatarHTML(user) + '</div>' +
      '<div class="x-compose-input" contenteditable="true" data-placeholder="有什么新鲜事？"></div>' +
    '</div>' +
    '<div class="x-compose-footer">' +
      '<div class="x-compose-tools">' +
        '<button class="x-compose-tool"><i class="fa-solid fa-image"></i></button>' +
        '<button class="x-compose-tool"><i class="fa-solid fa-hashtag"></i></button>' +
      '</div>' +
    '</div>'

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  var input = page.querySelector('.x-compose-input')
  var publishBtn = page.querySelector('.x-compose-publish')
  var anonToggle = page.querySelector('#x-anon-toggle')
  var avatarEl = page.querySelector('#x-compose-avatar')

  // 输入监听
  input.addEventListener('input', function() {
    publishBtn.classList.toggle('active', input.textContent.trim().length > 0)
  })

  // 匿名切换
  anonToggle.addEventListener('click', function() {
    isAnonymous = !isAnonymous
    anonToggle.classList.toggle('on', isAnonymous)
    avatarEl.innerHTML = isAnonymous ? buildXDefaultAvatar('匿名') : getXAvatarHTML(user)
  })

  // 取消
  page.querySelector('.x-compose-cancel').addEventListener('click', function() { closePage('x-compose') })

  // 发布
  publishBtn.addEventListener('click', function() {
    var text = input.textContent.trim()
    if (!text) return
    publishXPost(user, text, isAnonymous)
    closePage('x-compose')
  })
}

// 发布帖子
async function publishXPost(user, content, isAnonymous) {
  var post = {
    id: xGenId(),
    authorId: isAnonymous ? 'anon_' + xGenId() : String(user.id),
    authorName: isAnonymous ? '匿名用户' : getXUserName(user),
    authorHandle: isAnonymous ? '' : getXUserHandle(user),
    authorAvatar: isAnonymous ? null : (user.avatar || null),
    realAuthorId: isAnonymous ? String(user.id) : null,
    realAuthorName: isAnonymous ? getXUserName(user) : null,
    realAuthorHandle: isAnonymous ? getXUserHandle(user) : null,
    realAuthorAvatar: isAnonymous ? (user.avatar || null) : null,
    content: content,
    category: randomPick(X_CATEGORIES).id,
    isAnonymous: isAnonymous,
    engagement: generateEngagement(),
    createdAt: new Date().toISOString()
  }

  var posts = xLoadPosts()
  posts.unshift(post)
  xSavePosts(posts)

  // 刷新首页
  var page = document.getElementById('x-page')
  if (page) renderXHomeTab(page, user)

  // AI生成评论（1次API调用）
  generateAIComments(post, user)

  // 添加通知：有人点赞了你的帖子
  setTimeout(function() {
    var notifs = xLoadNotifications()
    notifs.unshift({
      id: xGenId(),
      type: 'like',
      userName: randomPick(X_NPC_NAMES),
      postId: post.id,
      postPreview: content.slice(0, 30),
      createdAt: new Date().toISOString()
    })
    xSaveNotifications(notifs)
    showNotifyDot()
  }, randomInt(5000, 30000))
}

// AI生成评论（1次API调用，生成评论+回复+追评）
async function generateAIComments(post, user) {
  if (!window.callAI) return

  var charList = ''
  try {
    var chars = await db.characters.where('type').equals('char').toArray()
    charList = chars.slice(0, 5).map(function(c) { return c.name + '(' + (c.signature || c.identity?.bio || '').slice(0, 20) + ')' }).join('、')
  } catch(e) {}

  var npcSample = X_NPC_TYPES.slice(0, 5).map(function(n) { return n.id + '.' + n.name + '(' + n.style + ')' }).join('\n')

  var prompt = '你是一个社交媒体评论生成器。根据以下帖子内容，生成5-6条评论。\n\n' +
    '帖子内容："' + post.content.slice(0, 200) + '"\n\n' +
    '可用NPC人设（随机选择5种）：\n' + npcSample + '\n\n' +
    '可用自建AI角色（可选1个参与评论）：' + (charList || '无') + '\n\n' +
    '要求：\n' +
    '1. 每条评论风格完全不同，体现NPC人设特点\n' +
    '2. 评论真实自然，像真人网友\n' +
    '3. 发帖AI（' + (post.authorName || '楼主') + '）必须回复每条评论\n' +
    '4. 根据上下文判断是否有追评，话题结束则停止\n\n' +
    '返回JSON格式：\n' +
    '{"comments":[{"name":"xxx","content":"评论内容","npcType":5,"isNpc":true}],"replies":[{"replyToIndex":0,"name":"' + (post.authorName || '楼主') + '","content":"回复内容"}],"replies2":[{"replyToCommentIndex":0,"replyToReplyIndex":0,"name":"xxx","content":"追评内容"}]}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw

    var comments = xLoadComments(post.id)

    // XX老婆奴评论
    comments.push({
      id: xGenId(), authorId: X_XX_CHARACTER.id, authorName: X_XX_CHARACTER.name,
      authorHandle: '@xx_love', authorAvatar: null, isSystem: true,
      content: ['你们懂什么！楼主说得对！','别听他们的，我挺你！','又来指指点点，楼主爱怎样怎样','我老婆看到这帖子都说楼主没错'][Math.floor(Math.random()*4)],
      stats: generateCommentStats(), createdAt: new Date().toISOString(), replies: []
    })

    // 添加一级评论
    if (data.comments) {
      data.comments.forEach(function(c) {
        var npcType = X_NPC_TYPES.find(function(n) { return n.id === c.npcType }) || randomPick(X_NPC_TYPES)
        comments.push({
          id: xGenId(),
          authorId: c.isNpc ? 'npc_' + xGenId() : (post.authorId || 'anon'),
          authorName: c.name || randomPick(X_NPC_NAMES),
          authorHandle: '@user-' + String(c.id).slice(-4),
          authorAvatar: null,
          isNpc: !!c.isNpc,
          npcType: npcType,
          content: c.content,
          stats: generateCommentStats(),
          createdAt: new Date().toISOString(),
          isReply: false
        })
      })
    }

    // 添加发帖AI的回复（二级）
    if (data.replies) {
      data.replies.forEach(function(r) {
        var targetComment = data.comments[r.replyToIndex]
        if (!targetComment) return
        var targetInStore = comments.find(function(c) { return c.content === targetComment.content && !c.isReply })
        comments.push({
          id: xGenId(),
          authorId: post.authorId,
          authorName: post.authorName,
          authorHandle: post.authorHandle,
          authorAvatar: post.authorAvatar,
          content: r.content,
          stats: generateCommentStats(),
          createdAt: new Date(Date.now() + 60000).toISOString(),
          isReply: true,
          replyTo: targetInStore ? targetInStore.id : null,
          replyToName: targetComment.name
        })
      })
    }

    // 追评
    if (data.replies2) {
      data.replies2.forEach(function(r2) {
        comments.push({
          id: xGenId(),
          authorId: 'npc_' + xGenId(),
          authorName: r2.name || randomPick(X_NPC_NAMES),
          authorHandle: '@' + (r2.name || 'user').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '').slice(0, 10),
          authorAvatar: null,
          isNpc: true,
          npcType: randomPick(X_NPC_TYPES),
          content: r2.content,
          stats: generateCommentStats(),
          createdAt: new Date(Date.now() + 120000).toISOString(),
          isReply: true,
          replyToName: post.authorName
        })
      })
    }

    xSaveComments(post.id, comments)

    // 添加评论通知
    var notifs = xLoadNotifications()
    comments.forEach(function(c) {
      if (!c.isReply) {
        notifs.unshift({
          id: xGenId(),
          type: 'comment',
          userName: c.authorName,
          postId: post.id,
          postPreview: c.content.slice(0, 30),
          createdAt: new Date().toISOString()
        })
      }
    })
    xSaveNotifications(notifs)
    showNotifyDot()

    // 刷新首页
    var page = document.getElementById('x-page')
    if (page) renderXHomeTab(page, user)

  } catch(e) {
    console.error('[X] AI评论生成失败:', e)
  }
}

// 显示通知红点
function showNotifyDot() {
  var dot = document.getElementById('x-notify-dot')
  if (dot) dot.classList.add('show')
}

// ===== 搜索Tab =====
function renderXSearchTab(page, user) {
  var panel = page.querySelector('#x-tab-search')
  panel.innerHTML =
    '<div class="x-search-page">' +
      '<div class="x-search-box">' +
        '<i class="fa fa-search"></i>' +
        '<input type="text" placeholder="搜索帖子或用户..." id="x-search-input">' +
      '</div>' +
      '<div class="x-search-results" id="x-search-results"></div>' +
    '</div>'

  var input = panel.querySelector('#x-search-input')
  var results = panel.querySelector('#x-search-results')
  var debounce = null

  input.addEventListener('input', function() {
    clearTimeout(debounce)
    debounce = setTimeout(function() { doXSearch(input.value.trim(), results, user) }, 300)
  })
}

function doXSearch(query, resultsEl, user) {
  if (!query) { resultsEl.innerHTML = ''; return }

  var posts = xLoadPosts()
  var q = query.toLowerCase()
  var matched = posts.filter(function(p) {
    return (p.content && p.content.toLowerCase().indexOf(q) !== -1) ||
           (p.authorName && p.authorName.toLowerCase().indexOf(q) !== -1)
  })

  if (!matched.length) {
    resultsEl.innerHTML = '<div style="padding:32px;text-align:center;color:var(--x-text-muted)">未找到相关结果</div>'
    return
  }

  resultsEl.innerHTML = matched.map(function(post) { return buildXPostCard(post) }).join('')
  bindPostCardEvents(resultsEl, user)
}

// ===== 通知Tab =====
function renderXNotifyTab(page, user) {
  var panel = page.querySelector('#x-tab-notify')
  var notifs = xLoadNotifications()

  if (!notifs.length) {
    panel.innerHTML = '<div class="x-notify-page"><div style="padding:32px;text-align:center;color:var(--x-text-muted)">暂无通知</div></div>'
    return
  }

  panel.innerHTML = '<div class="x-notify-page">' +
    notifs.slice(0, 50).map(function(n) {
      var iconClass = n.type === 'like' ? 'like-icon' : 'comment-icon'
      var iconName = n.type === 'like' ? 'fa-heart' : 'fa-comment'
      var text = n.type === 'like'
        ? '<strong>' + xEscape(n.userName) + '</strong> 点赞了你的帖子'
        : '<strong>' + xEscape(n.userName) + '</strong> 评论了你的帖子：' + xEscape(n.postPreview)

      return '<div class="x-notify-item">' +
        '<div class="x-notify-icon ' + iconClass + '"><i class="fa ' + iconName + '"></i></div>' +
        '<div>' +
          '<div class="x-notify-text">' + text + '</div>' +
          '<div class="x-notify-time">' + timeAgo(n.createdAt) + '</div>' +
        '</div>' +
      '</div>'
    }).join('') +
  '</div>'
}

// ===== 消息/个人主页Tab =====
function renderXProfileTab(page, user) {
  var panel = page.querySelector('#x-tab-profile')
  renderXProfileContent(panel, user, true)
}

// ===== 共享主页模板（抖音/TikTok风格）=====
function buildXProfileHTML(opts) {
  var coverStyle = opts.coverImg ? 'background-image:url(' + xEscape(opts.coverImg) + ')' : ''
  var avatarHTML = opts.avatarHTML || ''
  var actions = ''

  if (opts.showEdit) {
    actions += '<button class="xh-edit-btn" id="x-edit-profile-btn"><i class="fa-solid fa-pen"></i> 编辑个人资料</button>'
  }
  if (opts.showFollow) {
    actions += '<button class="xh-edit-btn' + (opts.isFollowing ? ' following' : '') + '" id="x-char-follow-btn">' + (opts.isFollowing ? '已关注' : '+ 关注') + '</button>'
  }
  if (opts.showGenBtn) {
    actions += '<button class="xh-gen-btn" id="x-gen-5-posts"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子</button>'
  }

  return '<div class="xh-page">' +
    '<div class="xh-cover" id="xh-cover" style="' + coverStyle + '">' +
      (opts.showBack !== false ? '<button class="xh-back-btn" type="button"><i class="fa-solid fa-chevron-left"></i></button>' : '') +
      '<button class="xh-cover-cam" id="xh-cover-btn" type="button"><i class="fa-solid fa-camera"></i></button>' +
    '</div>' +
    '<div class="xh-body">' +
      '<div class="xh-avatar-area">' +
        '<div class="xh-avatar" id="xh-avatar-wrap">' + avatarHTML +
          '<div class="xh-avatar-cam"><i class="fa-solid fa-camera"></i></div>' +
        '</div>' +
        '<div class="xh-user-meta">' +
          '<div class="xh-name">' + xEscape(opts.name || '') + '</div>' +
          '<div class="xh-handle">' + xEscape(opts.handle || '') + '</div>' +
        '</div>' +
      '</div>' +
      (opts.bio ? '<div class="xh-bio">' + xEscape(opts.bio) + '</div>' : '') +
      (opts.bio2 ? '<div class="xh-bio">' + xEscape(opts.bio2) + '</div>' : '') +
      '<div class="xh-ip"><i class="fa-solid fa-location-dot"></i> IP属地：' + xEscape(opts.ipLocation || '未设置') + '</div>' +
      '<div class="xh-stats">' +
        '<div class="xh-stat-item"><div class="xh-stat-num">' + (opts.postCount || 0) + '</div><div class="xh-stat-label">帖子</div></div>' +
        '<div class="xh-stat-item"><div class="xh-stat-num">' + (opts.followingCount || 0) + '</div><div class="xh-stat-label">关注</div></div>' +
        '<div class="xh-stat-item"><div class="xh-stat-num">' + (opts.followerCount || 0) + '</div><div class="xh-stat-label">粉丝</div></div>' +
        '<div class="xh-stat-item"><div class="xh-stat-num">' + (opts.likeCount || 0) + '</div><div class="xh-stat-label">获赞</div></div>' +
      '</div>' +
      (actions ? '<div class="xh-actions">' + actions + '</div>' : '') +
      '<div class="xh-tabs">' +
        '<div class="xh-tab active" data-tab="posts"><i class="fa-solid fa-table-cells-large"></i></div>' +
        '<div class="xh-tab" data-tab="comments"><i class="fa-solid fa-bookmark"></i></div>' +
        '<div class="xh-tab" data-tab="likes"><i class="fa-solid fa-heart"></i></div>' +
      '</div>' +
      '<div class="xh-tab-panel active" id="xh-tab-posts">' + (opts.postsHTML || '') + '</div>' +
      '<div class="xh-tab-panel" id="xh-tab-comments">' + (opts.commentsHTML || '') + '</div>' +
      '<div class="xh-tab-panel" id="xh-tab-likes">' + (opts.likesHTML || '') + '</div>' +
    '</div>' +
  '</div>'
}

function renderXProfileContent(container, user, isOwnProfile) {
  var follows = xLoadFollows(user.id)
  var posts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(user.id) })
  var comments = []
  xLoadPosts().forEach(function(p) {
    var pc = xLoadComments(p.id)
    pc.forEach(function(c) {
      if (String(c.authorId) === String(user.id)) comments.push({ comment: c, post: p })
    })
  })
  var savedAvatar = xLoadImage('avatar_' + user.id)
  var savedCover = xLoadImage('cover_' + user.id)
  var avatarSrc = savedAvatar || user.avatar || ''
  var avatarHTML = avatarSrc ? '<img src="' + xEscape(avatarSrc) + '" alt="">' : getXAvatarHTML(user)

  container.innerHTML = buildXProfileHTML({
    coverImg: savedCover || '',
    avatarHTML: avatarHTML,
    name: getXUserName(user),
    handle: getXUserHandle(user),
    bio: function(){try{var p=JSON.parse(localStorage.getItem(X_PROFILE_PREFIX+user.id));if(p&&p.signature)return p.signature}catch(e){} return user.signature || user.bio || ''}(),
    ipLocation: function(){try{var p=JSON.parse(localStorage.getItem(X_PROFILE_PREFIX+user.id));if(p&&p.ipLocation)return p.ipLocation}catch(e){} return ''}(),
    postCount: posts.length,
    followingCount: follows.length,
    followerCount: randomInt(10, 500),
    likeCount: randomInt(50, 2000),
    
    showBack: isOwnProfile ? false : undefined,
    showEdit: isOwnProfile,
    postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p) }).join('') : '<div class="xh-empty">还没有帖子</div>',
    commentsHTML: comments.length ? comments.map(function(item) {
      return '<div class="xh-comment-item"><div class="xh-comment-post-title">回复了 ' + xEscape(item.post.authorName || '匿名') + ' 的帖子</div><div class="xh-comment-text">' + xEscape(item.comment.content) + '</div><div class="xh-comment-time">' + timeAgo(item.comment.createdAt) + '</div></div>'
    }).join('') : '<div class="xh-empty">还没有评论</div>',
    likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
  })

  // Tab切换
  container.querySelectorAll('.xh-tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      container.querySelectorAll('.xh-tab').forEach(function(t) { t.classList.remove('active') })
      container.querySelectorAll('.xh-tab-panel').forEach(function(c) { c.classList.remove('active') })
      tab.classList.add('active')
      container.querySelector('#xh-tab-' + tab.dataset.tab).classList.add('active')
    })
  })

  // 换头像/封面
  container.querySelector('#xh-avatar-wrap').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('avatar_' + user.id, dataUrl)
      container.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>'
    }, 400)
  })
  container.querySelector('#xh-cover-btn').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('cover_' + user.id, dataUrl)
      container.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')'
    }, 800)
  })

  if (isOwnProfile) {
    var editBtn = container.querySelector('#x-edit-profile-btn')
    if (editBtn) editBtn.addEventListener('click', function() { showXProfileEdit(user) })
  }
  var backBtn = container.querySelector('.xh-back-btn')
  if (backBtn) backBtn.addEventListener('click', function() { closePage('x-page') })
  bindPostCardEvents(container, user)
}

// ===== 角色主页 =====
function showXCharacterProfile(charId, user) {
  // 特殊处理XX
  if (charId === X_XX_CHARACTER.id || charId === 'xx_laopo') {
    showXXProfile(user)
    return
  }

  if (!window.db || !db.characters) return
  db.characters.get(parseInt(charId) || charId).then(function(char) {
    if (!char) return
    renderXCharProfilePage(char, user)
  })
}

function renderXCharProfilePage(char, user) {
  var existing = document.getElementById('x-char-profile')
  if (existing) existing.remove()

  var posts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(char.id) })
  var isFollowing = xIsFollowing(user.id, char.id)
  var isSelf = String(char.id) === String(user.id)
  var savedAvatar = xLoadImage('avatar_' + char.id)
  var savedCover = xLoadImage('cover_' + char.id)
  var avatarSrc = savedAvatar || char.avatar || ''
  var avatarHTML = avatarSrc ? '<img src="' + xEscape(avatarSrc) + '" alt="">' : getXAvatarHTML(char)

  var page = document.createElement('div')
  page.id = 'x-char-profile'
  page.className = 'x-profile-page'

  page.innerHTML = buildXProfileHTML({
    coverImg: savedCover || char.coverImage || '',
    avatarHTML: avatarHTML,
    name: char.nick || char.name,
    handle: '@' + (char.identity?.account || char.handle || char.name),
    bio: char.signature || '',
    ipLocation: function(){try{var p=JSON.parse(localStorage.getItem(X_PROFILE_PREFIX+char.id));if(p&&p.ipLocation)return p.ipLocation}catch(e){} return ''}(),
    bio2: char.identity?.bio || '',
    postCount: posts.length,
    followingCount: randomInt(5, 200),
    followerCount: randomInt(50, 5000),
    likeCount: randomInt(100, 10000),
    showFollow: !isSelf,
    isFollowing: isFollowing,
    showGenBtn: char.type === 'char',
    postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p) }).join('') : '<div class="xh-empty">还没有帖子</div>',
    commentsHTML: '<div class="xh-empty">还没有评论</div>',
    likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
  })

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  page.querySelector('.xh-back-btn').addEventListener('click', function() { closePage('x-char-profile') })

  // 换头像/封面
  page.querySelector('#xh-avatar-wrap').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('avatar_' + char.id, dataUrl)
      page.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>'
    }, 400)
  })
  page.querySelector('#xh-cover-btn').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('cover_' + char.id, dataUrl)
      page.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')'
    }, 800)
  })

  // 关注
  var followBtn = page.querySelector('#x-char-follow-btn')
  if (followBtn) {
    followBtn.addEventListener('click', function() {
      var nowFollowing = xToggleFollow(user.id, char.id)
      followBtn.textContent = nowFollowing ? '正在关注' : '关注'
      followBtn.classList.toggle('following', nowFollowing)
    })
  }

  // 一键生成5篇
  var genBtn = page.querySelector('#x-gen-5-posts')
  if (genBtn) {
    genBtn.addEventListener('click', function() {
      genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...'
      genBtn.disabled = true
      generate5PostsForChar(char).then(function() {
        genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子'
        genBtn.disabled = false
        var postsEl = page.querySelector('#xh-tab-posts')
        var newPosts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(char.id) })
        postsEl.innerHTML = newPosts.map(function(p) { return buildXPostCard(p) }).join('')
        bindPostCardEvents(postsEl, user)
      })
    })
  }

  bindPostCardEvents(page.querySelector('#xh-tab-posts'), user)
}

// XX角色主页（统一模板）
function showXXProfile(user) {
  var existing = document.getElementById('x-char-profile')
  if (existing) existing.remove()

  var char = X_XX_CHARACTER
  var posts = xLoadPosts().filter(function(p) { return p.authorId === char.id })
  var savedAvatar = xLoadImage('avatar_' + char.id)
  var savedCover = xLoadImage('cover_' + char.id)
  var avatarHTML = savedAvatar ? '<img src="' + xEscape(savedAvatar) + '" alt="">' : buildXDefaultAvatar('X')

  var page = document.createElement('div')
  page.id = 'x-char-profile'
  page.className = 'x-profile-page'

  page.innerHTML = buildXProfileHTML({
    coverImg: savedCover || '',
    avatarHTML: avatarHTML,
    name: 'XX',
    handle: '@xx_love',
    bio: '有老婆就是了不起',
    bio2: '表面吐槽老婆，实际全世界最爱老婆。谁敢说我老婆一句坏话，我弄死你。老婆做什么都是对的，老婆永远是最好的。',
    postCount: posts.length,
    followingCount: 1,
    followerCount: randomInt(1000, 99999),
    likeCount: randomInt(5000, 99999),
    showFollow: true,
    isFollowing: true,
    showGenBtn: true,
    postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p) }).join('') : '<div class="xh-empty">还没有帖子</div>',
    commentsHTML: '<div class="xh-empty">还没有评论</div>',
    likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
  })

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  page.querySelector('.xh-back-btn').addEventListener('click', function() { closePage('x-char-profile') })

  // 换头像/封面
  page.querySelector('#xh-avatar-wrap').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('avatar_' + char.id, dataUrl)
      page.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>'
    }, 400)
  })
  page.querySelector('#xh-cover-btn').addEventListener('click', function() {
    xPickImage(function(dataUrl) {
      xSaveImage('cover_' + char.id, dataUrl)
      page.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')'
    }, 800)
  })

  // 一键生成5篇
  var genBtn = page.querySelector('#x-gen-5-posts')
  if (genBtn) {
    genBtn.addEventListener('click', function() {
      genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...'
      genBtn.disabled = true
      generate5PostsForChar(char).then(function() {
        genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子'
        genBtn.disabled = false
        var postsEl = page.querySelector('#xh-tab-posts')
        var newPosts = xLoadPosts().filter(function(p) { return p.authorId === char.id })
        postsEl.innerHTML = newPosts.map(function(p) { return buildXPostCard(p) }).join('')
        bindPostCardEvents(postsEl, user)
      })
    })
  }

  bindPostCardEvents(page.querySelector('#xh-tab-posts'), user)
}

// AI一键生成5篇帖子（含评论+发帖人回复+路人互评）
async function generate5PostsForChar(char) {
  if (!window.callAI) return

  var npcSample = X_NPC_TYPES.sort(function(){return Math.random()-0.5}).slice(0,6).map(function(n) { return n.id + '.' + n.name + '(' + n.style + ')' }).join('\n')

  var prompt = '你是社交媒体内容生成器。为以下角色生成5条帖子，每条帖子都要有完整的评论互动。\n\n' +
    '发帖人：' + char.name + '（' + (char.identity?.bio || char.signature || '普通用户') + '）\n\n' +
    '帖子分类（每条选一个不同的）：\n' +
    X_CATEGORIES.map(function(c) { return c.id + '.' + c.name }).join('\n') + '\n\n' +
    '可用NPC人设（每条评论从这些中随机选，每条帖子的评论要用不同人设）：\n' + npcSample + '\n\n' +
    '要求：\n' +
    '1. 每条帖子30-80字，真实自然，可包含hashtag\n' +
    '2. 每条帖子生成5条评论，来自不同的NPC人设（30字以内）\n' +
    '3. 发帖人（' + char.name + '）必须回复其中一条NPC评论（体现发帖人性格）\n' +
    '4. 再生成2条NPC回复其他人的评论（路人互评，形成对话链）\n' +
    '5. 每条评论用replyToIndex指向被回复评论的序号（顶级评论为-1），isAuthorReply标记发帖人回复\n\n' +
    '返回JSON格式：\n' +
    '{"posts":[{"content":"帖子内容","tags":["标签"],"category":1,"comments":[{"name":"NPC名","content":"评论内容","replyToIndex":-1},{"name":"' + char.name + '","content":"发帖人回复","replyToIndex":0,"isAuthorReply":true},{"name":"另一个NPC","content":"路人互评","replyToIndex":0}]}]}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw

    var allPosts = xLoadPosts()
    if (data.posts) {
      data.posts.forEach(function(p, i) {
        var postId = xGenId()
        allPosts.push({
          id: postId,
          authorId: String(char.id),
          authorName: char.nick || char.name,
          authorHandle: '@' + (char.identity?.account || char.name),
          authorAvatar: char.avatar || null,
          content: p.content,
          tags: p.tags || [],
          category: p.category || randomPick(X_CATEGORIES).id,
          isAnonymous: false,
          engagement: generateEngagement(),
          createdAt: new Date(Date.now() - i * 3600000).toISOString()
        })

        // 生成评论（含发帖人回复+路人互评）
        if (p.comments && p.comments.length) {
          var comments = []
          p.comments.forEach(function(c, ci) {
            var isAuthorReply = c.isAuthorReply || false
            var npcType = randomPick(X_NPC_TYPES)
            var commentId = xGenId()
            var commentObj = {
              id: commentId,
              authorId: isAuthorReply ? String(char.id) : ('npc_' + xGenId()),
              authorName: isAuthorReply ? (char.nick || char.name) : (c.name || npcType.name),
              authorHandle: isAuthorReply ? ('@' + (char.identity?.account || char.name)) : ('@user-' + String(ci).slice(-4)),
              authorAvatar: isAuthorReply ? (char.avatar || null) : null,
              isNpc: !isAuthorReply,
              npcType: isAuthorReply ? null : npcType,
              content: c.content,
              stats: generateCommentStats(),
              createdAt: new Date(Date.now() - i * 3600000 + ci * 60000).toISOString(),
              isReply: false
            }
            // 处理回复关系（楼中楼）
            if (c.replyToIndex >= 0 && c.replyToIndex < comments.length) {
              commentObj.replyTo = comments[c.replyToIndex].id
              commentObj.replyToName = comments[c.replyToIndex].authorName
              commentObj.isReply = true
            }
            comments.push(commentObj)
          })
          xSaveComments(postId, comments)
        }
      })
      xSavePosts(allPosts)
    }
  } catch(e) {
    console.error('[X] 一键生成帖子失败:', e)
  }
}

// ===== 设置页面 =====
function showXSettingsPage(user) {
  var existing = document.getElementById('x-settings-page')
  if (existing) existing.remove()
  var settings = xLoadSettings()

  var page = document.createElement('div')
  page.id = 'x-settings-page'
  page.className = 'x-settings-page'

  page.innerHTML =
    '<div class="x-settings-header">' +
      '<button class="x-settings-back" type="button">' + X_SVG.back + '</button>' +
      '<div class="x-settings-title">设置</div>' +
    '</div>' +
    '<div class="x-settings-scroll">' +
      '<div class="x-settings-section">' +
        '<div class="x-settings-section-title">主题</div>' +
        '<div class="x-settings-row">' +
          '<div><div class="x-settings-row-label">界面主题</div><div class="x-settings-row-desc">切换亮色/暗色模式</div></div>' +
          '<div class="x-theme-toggle">' +
            '<button class="x-theme-btn' + (settings.theme === 'dark' ? ' active' : '') + '" data-theme="dark">暗色</button>' +
            '<button class="x-theme-btn' + (settings.theme === 'light' ? ' active' : '') + '" data-theme="light">亮色</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="x-settings-section">' +
        '<div class="x-settings-section-title">定时发帖</div>' +
        '<div class="x-settings-row">' +
          '<div><div class="x-settings-row-label">自动定时发帖</div><div class="x-settings-row-desc">开启后AI角色会定时发帖</div></div>' +
          '<button class="x-compose-anon-toggle' + (settings.autoPost ? ' on' : '') + '" id="x-auto-post-toggle"></button>' +
        '</div>' +
        '<div class="x-settings-row">' +
          '<div><div class="x-settings-row-label">发帖间隔</div></div>' +
          '<div class="x-interval-options" style="display:flex;gap:8px">' +
            '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===120?' active':'') + '" data-val="120" style="padding:4px 10px;border-radius:8px;border:1px solid var(--x-border);background:transparent;color:var(--x-text);font-size:13px;cursor:pointer">2小时</button>' +
            '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===240?' active':'') + '" data-val="240" style="padding:4px 10px;border-radius:8px;border:1px solid var(--x-border);background:transparent;color:var(--x-text);font-size:13px;cursor:pointer">4小时</button>' +
            '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===360?' active':'') + '" data-val="360" style="padding:4px 10px;border-radius:8px;border:1px solid var(--x-border);background:transparent;color:var(--x-text);font-size:13px;cursor:pointer">6小时</button>' +
            '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===600?' active':'') + '" data-val="600" style="padding:4px 10px;border-radius:8px;border:1px solid var(--x-border);background:transparent;color:var(--x-text);font-size:13px;cursor:pointer">10小时</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="x-settings-section">' +
        '<div class="x-settings-section-title">评论设置</div>' +
        '<div class="x-settings-row">' +
          '<div><div class="x-settings-row-label">每帖评论数量</div><div class="x-settings-row-desc">4~5条</div></div>' +
          '<input class="input-field" type="number" id="x-comment-count-input" value="' + (settings.commentCount || 5) + '" min="4" max="5" style="width:60px;min-height:36px;border:1px solid var(--x-border);border-radius:8px;padding:0 8px;background:var(--x-bg);color:var(--x-text);font-size:14px;text-align:center">' +
        '</div>' +
      '</div>' +
      '<div class="x-settings-section">' +
        '<div class="x-settings-section-title">AI角色管理</div>' +
        '<div class="x-char-checklist" id="x-char-checklist"></div>' +
      '</div>' +
    '</div>'

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  // 返回
  page.querySelector('.x-settings-back').addEventListener('click', function() { closePage('x-settings-page') })

  // 主题切换
  page.querySelectorAll('.x-theme-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      settings.theme = btn.dataset.theme
      xSaveSettings(settings)
      applyXTheme(settings.theme)
      page.querySelectorAll('.x-theme-btn').forEach(function(b) { b.classList.remove('active') })
      btn.classList.add('active')
    })
  })

  // 定时发帖开关
  page.querySelector('#x-auto-post-toggle').addEventListener('click', function() {
    settings.autoPost = !settings.autoPost
    xSaveSettings(settings)
    this.classList.toggle('on', settings.autoPost)
  })

  // 间隔选择
  page.querySelectorAll('.x-interval-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      page.querySelectorAll('.x-interval-btn').forEach(function(b){b.classList.remove('active');b.style.background='transparent';b.style.color='var(--x-text)'})
      btn.classList.add('active')
      btn.style.background='var(--x-accent)'
      btn.style.color='#fff'
      settings.autoPostInterval = parseInt(btn.dataset.val)
      xSaveSettings(settings)
    })
  })
  // 初始化选中状态
  var activeBtn = page.querySelector('.x-interval-btn.active')
  if(activeBtn){activeBtn.style.background='var(--x-accent)';activeBtn.style.color='#fff'}

  // 评论数量
  page.querySelector('#x-comment-count-input').addEventListener('change', function() {
    settings.commentCount = Math.max(4, Math.min(5, parseInt(this.value) || 5))
    xSaveSettings(settings)
  })

  // 角色管理列表
  loadXCharChecklist(page, settings)
}

function loadXCharChecklist(page, settings) {
  var container = page.querySelector('#x-char-checklist')
  if (!window.db || !db.characters) return
  var enabledChars = settings.enabledChars || []

  db.characters.where('type').equals('char').toArray().then(function(chars) {
    container.innerHTML = chars.map(function(c) {
      var checked = enabledChars.indexOf(String(c.id)) !== -1 || enabledChars.length === 0
      return '<div class="x-char-check-item" data-char-id="' + c.id + '">' +
        '<div class="x-char-check-avatar">' + getXAvatarHTML(c) + '</div>' +
        '<div class="x-char-check-name">' + xEscape(c.nick || c.name) + '</div>' +
        '<div class="x-char-check-box' + (checked ? ' checked' : '') + '"></div>' +
      '</div>'
    }).join('')

    container.querySelectorAll('.x-char-check-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var box = item.querySelector('.x-char-check-box')
        var cid = item.dataset.charId
        box.classList.toggle('checked')
        if (box.classList.contains('checked')) {
          if (enabledChars.indexOf(cid) === -1) enabledChars.push(cid)
        } else {
          enabledChars = enabledChars.filter(function(id) { return id !== cid })
        }
        settings.enabledChars = enabledChars
        xSaveSettings(settings)
      })
    })
  })
}

// 应用主题
function applyXTheme(theme) {
  document.documentElement.classList.toggle('theme-dark', theme === 'dark')
}

// ===== 编辑个人资料 =====
function showXProfileEdit(user) {
  var existing = document.getElementById('x-profile-edit-page')
  if (existing) existing.remove()

  var page = document.createElement('div')
  page.id = 'x-profile-edit-page'
  page.className = 'x-profile-edit-page'

  page.innerHTML =
    '<div class="x-profile-edit-header">' +
      '<button class="x-profile-edit-back" type="button"><i class="fa fa-chevron-left"></i></button>' +
      '<div class="x-profile-edit-title">编辑个人资料</div>' +
      '<button class="x-profile-edit-save" type="button">保存</button>' +
    '</div>' +
    '<div class="x-profile-edit-scroll">' +
      '<div class="x-profile-edit-cover"><span><i class="fa fa-image"></i> 背景图</span></div>' +
      '<div class="x-profile-edit-avatar">' + getXAvatarHTML(user) + '</div>' +
      '<label class="x-profile-edit-field">昵称<input class="input-field" id="x-edit-name" value="' + xEscape(getXUserName(user)) + '"></label>' +
      '<label class="x-profile-edit-field">用户名<input class="input-field" id="x-edit-handle" value="' + xEscape(getXUserHandle(user).replace('@', '')) + '"></label>' +
      '<label class="x-profile-edit-field">个性签名<input class="input-field" id="x-edit-sig" value="' + xEscape(function(){try{var p=JSON.parse(localStorage.getItem(X_PROFILE_PREFIX+user.id));return p&&p.signature||''}catch(e){return ''}}()) + '" placeholder="写一句话介绍自己"></label>' +
      '<label class="x-profile-edit-field">IP属地<input class="input-field" id="x-edit-ip" value="' + xEscape(function(){try{var p=JSON.parse(localStorage.getItem(X_PROFILE_PREFIX+user.id));return p&&p.ipLocation||''}catch(e){return ''}}()) + '" placeholder="例如：浙江、广东、北京"></label>' +
    '</div>'

  if (window.openPage) window.openPage(page)
  else document.body.appendChild(page)

  page.querySelector('.x-profile-edit-back').addEventListener('click', function() { closePage('x-profile-edit-page') })
  page.querySelector('.x-profile-edit-save').addEventListener('click', function() {
    // 保存个人资料（localStorage）
    var profileKey = X_PROFILE_PREFIX + user.id
    var profile = {
      name: page.querySelector('#x-edit-name').value.trim() || getXUserName(user),
      handle: page.querySelector('#x-edit-handle').value.trim(),
      signature: page.querySelector('#x-edit-sig').value.trim(),
      ipLocation: page.querySelector('#x-edit-ip').value.trim()
    }
    localStorage.setItem(profileKey, JSON.stringify(profile))
    closePage('x-profile-edit-page')
    // 刷新个人Tab
    var mainPage = document.getElementById('x-page')
    if (mainPage) renderXProfileTab(mainPage, user)
  })
}

// ===== 生成帖子弹窗 =====
function showXGenPostsDialog(user, genBtn, page) {
  // 移除旧弹窗
  var old = document.getElementById('x-gen-dialog')
  if (old) old.remove()

  var dialog = document.createElement('div')
  dialog.id = 'x-gen-dialog'
  dialog.innerHTML =
    '<div class="x-gen-overlay"></div>' +
    '<div class="x-gen-card">' +
      '<div class="x-gen-title">生成帖子</div>' +
      '<div class="x-gen-desc">描述你想生成的帖子风格和倾向</div>' +
      '<textarea class="x-gen-input" id="x-gen-pref" placeholder="例如：甜蜜恋爱日常、深夜emo感想、搞笑吐槽..." rows="3"></textarea>' +
      '<div class="x-gen-tags">' +
        '<span class="x-gen-tag" data-v="甜蜜恋爱">甜蜜恋爱</span>' +
        '<span class="x-gen-tag" data-v="深夜emo">深夜emo</span>' +
        '<span class="x-gen-tag" data-v="搞笑吐槽">搞笑吐槽</span>' +
        '<span class="x-gen-tag" data-v="生活记录">生活记录</span>' +
        '<span class="x-gen-tag" data-v="哲思感悟">哲思感悟</span>' +
      '</div>' +
      '<div class="x-gen-actions">' +
        '<button class="x-gen-cancel" type="button">取消</button>' +
        '<button class="x-gen-confirm" type="button">生成5篇帖子</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(dialog)

  // 快捷标签点击
  dialog.querySelectorAll('.x-gen-tag').forEach(function(tag) {
    tag.addEventListener('click', function() {
      var input = dialog.querySelector('#x-gen-pref')
      input.value = tag.dataset.v
      dialog.querySelectorAll('.x-gen-tag').forEach(function(t){t.classList.remove('active')})
      tag.classList.add('active')
    })
  })

  // 取消
  dialog.querySelector('.x-gen-cancel').addEventListener('click', function() {
    dialog.classList.add('closing')
    setTimeout(function(){ dialog.remove() }, 200)
  })

  // 确认生成
  dialog.querySelector('.x-gen-confirm').addEventListener('click', function() {
    var pref = dialog.querySelector('#x-gen-pref').value.trim()
    dialog.querySelector('.x-gen-card').innerHTML =
      '<div class="x-gen-loading">' +
        '<div class="x-gen-spinner"></div>' +
        '<div class="x-gen-loading-text">正在生成5篇帖子...</div>' +
        '<div class="x-gen-loading-desc">AI正在创作中，请稍候</div>' +
      '</div>'

    generateBatchPosts(user, pref).then(function() {
      dialog.classList.add('closing')
      setTimeout(function(){ dialog.remove() }, 200)
      renderXHomeTab(page, user)
      showToast('5篇帖子已生成！')
    }).catch(function() {
      dialog.classList.add('closing')
      setTimeout(function(){ dialog.remove() }, 200)
      showToast('生成失败，请重试')
    })
  })
}

// Toast通知
function showToast(msg) {
  var old = document.getElementById('x-toast')
  if (old) old.remove()
  var toast = document.createElement('div')
  toast.id = 'x-toast'
  toast.textContent = msg
  document.body.appendChild(toast)
  setTimeout(function(){ toast.classList.add('show') }, 10)
  setTimeout(function(){ toast.classList.remove('show'); setTimeout(function(){ toast.remove() }, 300) }, 2500)
}

// 长时间Toast（多行，自定义时长）
function showToastLong(msg, duration) {
  duration = duration || 3000
  var old = document.getElementById('x-toast-long')
  if (old) old.remove()
  var toast = document.createElement('div')
  toast.id = 'x-toast-long'
  toast.className = 'x-toast-long'
  toast.innerHTML = msg.replace(/\n/g, '<br>')
  document.body.appendChild(toast)
  setTimeout(function(){ toast.classList.add('show') }, 10)
  setTimeout(function(){ toast.classList.remove('show'); setTimeout(function(){ toast.remove() }, 300) }, duration)
}

// ===== 批量生成帖子 =====
async function generateBatchPosts(user, preference) {
  if (!window.callAI) return

  var npcTypes = X_NPC_TYPES.sort(function(){return Math.random()-0.5}).slice(0,4)
  var cats = X_CATEGORIES.sort(function(){return Math.random()-0.5}).slice(0,5)
  var anonIdx = Math.floor(Math.random()*5)

  var posterDescs = ['1. XX（老婆奴：表面吐槽老婆实则炫耀，极度宠溺，自豪是老婆奴）']
  npcTypes.forEach(function(npc, i){
    posterDescs.push((i+2)+'. '+npc.name+'（'+npc.style+'）')
  })

  var commentTypes = X_NPC_TYPES.sort(function(){return Math.random()-0.5}).slice(0,6)
  var commentDescs = commentTypes.map(function(npc,i){
    return (i+1)+'. '+npc.name+'（'+npc.style+'）'
  }).join('|')

  var catsDesc = cats.map(function(c,i){return (i+1)+'. '+c.name}).join('，')

  var prompt = '请完成以下任务：\n\n' +
    '【任务1：生成5篇帖子】\n' +
    '为以下5个人各写一条社交帖子(30-80字)，真实自然体现各自性格：\n' +
    posterDescs.join('\n') + '\n' +
    '分类方向：' + catsDesc + '\n' +
    (preference ? '整体倾向：' + preference + '\n' : '') +
    '第' + (anonIdx+1) + '个人匿名发帖(isAnonymous:true)，内容可以更大胆私密。\n' +
    'XX的帖子必须是炫耀老婆的内容。\n\n' +
    '【任务2：为每篇帖子生成评论】\n' +
    '每篇帖子生成3条评论，从以下NPC人设中随机选择：\n' +
    commentDescs + '\n' +
    '评论要体现NPC各自的性格特点，30字以内。\n\n' +
    '返回JSON：\n' +
    '{"posts":[{"content":"帖子内容","tags":["标签"],"isAnonymous":false,"comments":[{"npcType":"人设名","content":"评论内容"},{"npcType":"人设名","content":"评论内容"},{"npcType":"人设名","content":"评论内容"]}]}'

  try {
    var raw = await window.callAI([{role:'user',content:prompt}], {responseFormat:'json_object'})
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g,'').replace(/```/g,'').trim()) : raw
    var items = data.posts || (Array.isArray(data) ? data : [])

    var posts = xLoadPosts()
    var posterNames = ['XX'].concat(npcTypes.map(function(n){return n.name}))
    var posterHandles = ['@xx-love'].concat(npcTypes.map(function(n){return '@npc-'+n.id}))
    var posterIds = [X_XX_CHARACTER.id].concat(npcTypes.map(function(n){return 'npc_'+n.id}))

    for (var i = 0; i < Math.min(5, items.length); i++) {
      var item = items[i]
      var cat = cats[i] || cats[0]
      var isAnon = item.isAnonymous || false
      var postId = xGenId()

      posts.unshift({
        id: postId,
        authorId: isAnon ? 'anon_'+xGenId() : (i===0 ? X_XX_CHARACTER.id : 'npc_'+npcTypes[i-1].id),
        authorName: isAnon ? '匿名用户' : posterNames[i],
        authorHandle: isAnon ? '' : posterHandles[i],
        authorAvatar: null,
        content: item.content || '',
        category: cat.id,
        isAnonymous: isAnon,
        engagement: generateEngagement(),
        createdAt: new Date(Date.now() - i*600000).toISOString(),
        tags: Array.isArray(item.tags) ? item.tags : []
      })

      if (item.comments && item.comments.length) {
        var comments = []
        item.comments.forEach(function(c, ci) {
          var isAuthorReply = c.isAuthor || false
          var npc = commentTypes.find(function(n){return n.name === c.npcType}) || commentTypes[ci % commentTypes.length]
          var commentObj = {
            id: xGenId(),
            authorId: isAuthorReply ? posterIds[i] : ('npc_'+npc.id),
            authorName: isAuthorReply ? posterNames[i] : npc.name,
            authorHandle: isAuthorReply ? posterHandles[i] : ('@npc-'+npc.id),
            authorAvatar: null,
            isNpc: !isAuthorReply,
            isSystem: isAuthorReply && i===0,
            npcType: isAuthorReply ? null : npc,
            content: c.content || '',
            stats: generateCommentStats(),
            createdAt: new Date(Date.now() - (i*600000 + ci*60000)).toISOString(),
            replies: []
          }
          // 处理replyTo（楼中楼）
          if (c.replyTo >= 0 && c.replyTo < comments.length) {
            commentObj.replyTo = comments[c.replyTo].id
            commentObj.replyToName = comments[c.replyTo].authorName
            commentObj.isReply = true
          }
          comments.push(commentObj)
        })
        xSaveComments(postId, comments)
      }
    }
    xSavePosts(posts)
    console.log('[X] 批量生成完成: '+items.length+'篇帖子+评论')
  } catch(e) { console.error('[X] batch gen err', e) }
}


// ===== 自动发帖调度器（支持补回）=====
var xAutoPostTimer = null
var X_LAST_AUTOPOST_KEY = 'wanwan_x_lastAutoPost'

function startXAutoPostScheduler(user) {
  if (xAutoPostTimer) clearInterval(xAutoPostTimer)
  var settings = xLoadSettings()
  console.log('[X] 自动发帖调度器启动, autoPost=', settings.autoPost, 'interval=', settings.autoPostInterval)
  if (!settings.autoPost) return

  var intervalMin = settings.autoPostInterval || 240
  var intervalMs = intervalMin * 60 * 1000

  // 补回逻辑：检查距离上次发帖过了多久
  var lastPost = parseInt(localStorage.getItem(X_LAST_AUTOPOST_KEY)) || 0
  var now = Date.now()
  if (lastPost > 0) {
    var elapsed = now - lastPost
    var missed = Math.floor(elapsed / intervalMs)
    if (missed > 0) {
      missed = Math.min(missed, 10) // 最多补10条，防止疯狂补帖
      console.log('[X] 补回：距上次' + Math.round(elapsed/60000) + '分钟，需补' + missed + '条')
      xAutoPostCatchUp(user, missed)
    }
  }

  // 记录当前时间（如果从未记录过）
  if (!lastPost) localStorage.setItem(X_LAST_AUTOPOST_KEY, String(now))

  // 启动定时器
  xAutoPostTimer = setInterval(function() { autoPostTick(user) }, intervalMs)
}

// 补回：一次API生成N条帖子
async function xAutoPostCatchUp(user, count) {
  if (!window.callAI) return
  showToastLong('正在补回 ' + count + ' 条帖子...', 4000)
  var settings = xLoadSettings()
  var enabledChars = settings.enabledChars || []
  var chars = []
  try {
    var all = await db.characters.where('type').equals('char').toArray()
    chars = enabledChars.length ? all.filter(function(c) { return enabledChars.indexOf(String(c.id)) !== -1 }) : all
  } catch(e) { showToastLong('补回失败：无法加载角色', 3000); return }
  if (!chars.length) { showToastLong('补回失败：没有可用角色', 3000); return }

  // 随机选角色
  var pickedChars = []
  for (var i = 0; i < count; i++) pickedChars.push(randomPick(chars))

  var charDescs = pickedChars.map(function(c, i) { return (i+1) + '. ' + c.name }).join('\n')
  var categories = X_CATEGORIES.map(function(c) { return c.id + '.' + c.name }).join('\n')

  var prompt = '你是社交媒体内容生成器。请为以下' + count + '个角色各生成1条帖子。\n\n' +
    '发帖人：\n' + charDescs + '\n\n' +
    '帖子分类：\n' + categories + '\n\n' +
    '要求：\n1. 每条帖子30-80字，真实自然，体现角色性格\n2. 可包含hashtag\n\n' +
    '返回JSON：{"posts":[{"content":"帖子内容","tags":["标签"],"category":1}]}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw
    if (!data.posts) { showToastLong('补回失败：AI未返回内容', 3000); return }

    var allPosts = xLoadPosts()
    var newPosts = []
    data.posts.forEach(function(p, i) {
      var char = pickedChars[i] || pickedChars[0]
      var post = {
        id: xGenId(),
        authorId: String(char.id),
        authorName: char.nick || char.name,
        authorHandle: '@' + (char.identity?.account || char.name),
        authorAvatar: char.avatar || null,
        content: p.content,
        tags: p.tags || [],
        category: p.category || randomPick(X_CATEGORIES).id,
        isAnonymous: false,
        engagement: generateEngagement(),
        createdAt: new Date(Date.now() - (count - i) * 60000).toISOString()
      }
      allPosts.unshift(post)
      newPosts.push(post)
    })
    xSavePosts(allPosts)
    localStorage.setItem(X_LAST_AUTOPOST_KEY, String(Date.now()))

    // 成功提示：显示每条帖子的作者和摘要
    var details = newPosts.map(function(p) {
      return '✓ ' + p.authorName + '：' + p.content.slice(0, 20) + (p.content.length > 20 ? '...' : '')
    }).join('\n')
    showToastLong('补回成功 ' + newPosts.length + ' 条\n' + details, 5000)
    console.log('[X] 补回完成：' + newPosts.length + '条帖子')

    // 为每条帖子生成评论
    newPosts.forEach(function(post) { generateAIComments(post, user) })

    // 刷新首页
    var page = document.getElementById('x-page')
    if (page) renderXHomeTab(page, user)
  } catch(e) {
    showToastLong('补回失败：' + (e.message || 'API调用出错'), 4000)
    console.error('[X] 补回失败:', e)
  }
}

// 单次自动发帖
async function autoPostTick(user) {
  console.log('[X] autoPostTick触发')
  if (!window.callAI) { console.log('[X] callAI不可用'); return }
  var settings = xLoadSettings()
  if (!settings.autoPost) return

  var enabledChars = settings.enabledChars || []
  var chars = []
  try {
    var all = await db.characters.where('type').equals('char').toArray()
    chars = enabledChars.length ? all.filter(function(c) { return enabledChars.indexOf(String(c.id)) !== -1 }) : all
  } catch(e) { return }

  if (!chars.length) return
  var char = randomPick(chars)
  var category = randomPick(X_CATEGORIES)

  var prompt = '你是' + char.name + '。' + (char.identity?.bio || char.signature || '') + '\n\n' +
    '请发一条社交媒体帖子，分类：' + category.name + '\n' +
    '要求：30-80字，真实自然，体现角色性格。\n' +
    '返回JSON：{"content":"帖子内容"}'

  try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw

    var post = {
      id: xGenId(),
      authorId: String(char.id),
      authorName: char.nick || char.name,
      authorHandle: '@' + (char.identity?.account || char.name),
      authorAvatar: char.avatar || null,
      content: data.content,
      category: category.id,
      isAnonymous: false,
      engagement: generateEngagement(),
      createdAt: new Date().toISOString()
    }

    var posts = xLoadPosts()
    posts.unshift(post)
    xSavePosts(posts)
    localStorage.setItem(X_LAST_AUTOPOST_KEY, String(Date.now()))

    // 生成评论
    generateAIComments(post, user)

    // 刷新首页
    var page = document.getElementById('x-page')
    if (page) renderXHomeTab(page, user)
  } catch(e) {
    console.error('[X] 自动发帖失败:', e)
  }
}

// ===== 初始化 =====
// 确保应用正确的主题
(function() {
  var settings = xLoadSettings()
  applyXTheme(settings.theme)
})()
