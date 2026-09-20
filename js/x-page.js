// x-page.js — X (Twitter clone) Module · Complete Rewrite
// All functions wrapped in try-catch for crash protection

// ===== Error Catchers =====
try {
  window.addEventListener('error', function(e) {
    console.error('[X-PAGE-ERROR]', e.message, e.filename, e.lineno);
    try { window.toast && window.toast('[X] ' + (e.message || 'error')); } catch(_) {}
  });
  window.addEventListener('unhandledrejection', function(e) {
    console.error('[X-PAGE-REJECTION]', e.reason);
    try { window.toast && window.toast('[X] ' + String(e.reason || 'async error')); } catch(_) {}
  });
} catch(_) {}

// ===== Constants =====
var X_SESSION_UID_KEY = 'wanwan_x_uid';
var X_PROFILE_PREFIX = 'wanwan_x_profile_';
var X_POSTS_KEY = 'wanwan_x_posts';
var X_COMMENTS_PREFIX = 'wanwan_x_comments_';
var X_NOTIFY_KEY = 'wanwan_x_notifications';
var X_FOLLOWS_PREFIX = 'wanwan_x_follows_';
var X_SETTINGS_KEY = 'wanwan_x_settings';
var X_LAST_AUTOPOST_KEY = 'wanwan_x_lastAutoPost';

var X_CATEGORIES = [
  { id: 1, name: '情侣情感日常' },
  { id: 2, name: '现实琐事发泄' },
  { id: 3, name: '隐秘心事倾诉' },
  { id: 4, name: '个人生活记录' },
  { id: 5, name: '疑问求助类' },
  { id: 6, name: '观点感慨类' },
  { id: 7, name: '哲学思考随笔' }
];

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
];

var X_XX_CHARACTER = {
  id: 'xx_laopo',
  name: 'XX',
  handle: 'xx_love',
  type: 'char',
  bio: '表面吐槽老婆，实际全世界最爱老婆。谁敢说我老婆一句坏话，我弄死你。',
  signature: '有老婆就是了不起',
  avatar: null,
  isSystem: true
};

var X_NPC_NAMES = [
  '路人甲', '吃瓜群众', '键盘侠', '温柔姐姐', '暴躁老哥',
  '理智网友', '感性小妹', '过来人', '旁观者', '热心市民',
  '冷漠路人', '鸡汤大师', '毒舌达人', '浪漫诗人', '现实主义者',
  '小透明', '潜水党', '话痨王', '杠精本精', '佛系青年'
];

// ===== SVG Icons =====
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
  reply: '<svg viewBox="0 0 24 24"><g><path d="M1.751 10c0-4.42 3.584-8.005 8.005-8.005h4.366c4.49 0 8.129 3.64 8.129 8.13 0 2.96-1.607 5.68-4.196 7.11l-8.054 4.46v-3.69h-.067c-4.49.1-8.183-3.51-8.183-8.005zm8.005-6.005c-3.317 0-6.005 2.69-6.005 6.005 0 3.37 2.77 6.08 6.138 6.01l.351-.01h1.761v2.3l5.087-2.81c1.951-1.08 3.163-3.13 3.163-5.36 0-3.39-2.744-6.13-6.129-6.13H9.756z"></path></g></svg>',
  heart: '<svg viewBox="0 0 24 24"><g><path d="M20.884 13.19c-1.351 2.48-4.001 5.12-8.379 7.67l-.503.3-.504-.3c-4.379-2.55-7.029-5.19-8.382-7.67-1.36-2.5-1.41-4.86-.514-6.67.887-1.79 2.647-2.91 4.601-3.01 1.651-.09 3.368.56 4.798 2.01 1.429-1.45 3.146-2.1 4.796-2.01 1.954.1 3.714 1.22 4.601 3.01.896 1.81.846 4.17-.514 6.67z"></path></g></svg>'
};

// ===== Utility Functions =====
function xEscape(str) {
  try {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  } catch(e) { return ''; }
}

function formatXNumber(n) {
  try {
    if (typeof n === 'string') return n;
    if (n == null || isNaN(n)) return '0';
    n = Math.floor(Number(n));
    if (n >= 10000) return (n / 10000).toFixed(2).replace(/\.?0+$/, '') + '万';
    return n.toLocaleString('en-US');
  } catch(e) { return '0'; }
}

function formatXContent(str) {
  try {
    return xEscape(str)
      .replace(/(#[A-Za-z0-9_\u4e00-\u9fa5]+)/g, '<span class="x-hashtag">$1</span>')
      .replace(/\n/g, '<br>');
  } catch(e) { return xEscape(str); }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateEngagement() {
  return {
    views: randomInt(800, 250000),
    likes: randomInt(50, 100000),
    retweets: randomInt(10, 12000),
    quotes: randomInt(0, 3000)
  };
}

function generateCommentStats() {
  return {
    comments: randomInt(0, 500),
    retweets: randomInt(0, 200),
    likes: randomInt(0, 1000),
    views: randomInt(0, 500)
  };
}

function formatXTime(date) {
  try {
    var d = date instanceof Date ? date : new Date(date);
    var h = d.getHours();
    var m = d.getMinutes();
    var ampm = h >= 12 ? '下午' : '上午';
    var h12 = h % 12 || 12;
    var timeStr = String(h12).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ' ' + ampm;
    var months = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    return timeStr + ' · ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
  } catch(e) { return ''; }
}

function timeAgo(date) {
  try {
    var ts = date instanceof Date ? date.getTime() : new Date(date).getTime();
    if (isNaN(ts)) return '刚刚';
    var diff = Date.now() - ts;
    if (diff < 0) return '刚刚';
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + 'm';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + 'd';
    return Math.floor(days / 30) + '月';
  } catch(e) { return '刚刚'; }
}

function buildXDefaultAvatar(name) {
  try {
    var letter = (name || '匿').slice(0, 1);
    return '<span class="x-avatar-placeholder">' + xEscape(letter) + '</span>';
  } catch(e) { return '<span class="x-avatar-placeholder">?</span>'; }
}

function getXAvatarHTML(char) {
  try {
    if (char && char.avatar) return '<img src="' + xEscape(char.avatar) + '" alt="">';
    return buildXDefaultAvatar(char ? (char.name || char.nick) : '');
  } catch(e) { return buildXDefaultAvatar(''); }
}

// ===== Data Layer (IndexedDB + Memory Cache) =====
var _xPostsCache = null;
var _xCommentsCache = {};
var _xCacheLoaded = false;

// Load from IndexedDB into memory cache (once)
async function _xInitCache() {
  if (_xCacheLoaded) return;
  _xCacheLoaded = true;
  try {
    // Migrate old localStorage posts
    var oldPosts = localStorage.getItem(X_POSTS_KEY);
    if (oldPosts) {
      var arr = JSON.parse(oldPosts);
      if (arr && arr.length) {
        for (var i = 0; i < arr.length; i++) {
          try { await db.xPosts.put(arr[i]); } catch(_) {}
        }
        console.log('[X] Migrated ' + arr.length + ' posts to IndexedDB');
      }
      localStorage.removeItem(X_POSTS_KEY);
    }
    // Migrate old localStorage comments
    var keysToRemove = [];
    for (var j = 0; j < localStorage.length; j++) {
      var k = localStorage.key(j);
      if (k && k.indexOf(X_COMMENTS_PREFIX) === 0) keysToRemove.push(k);
    }
    for (var ki = 0; ki < keysToRemove.length; ki++) {
      var pk = keysToRemove[ki];
      var postId = pk.replace(X_COMMENTS_PREFIX, '');
      try {
        var cmts = JSON.parse(localStorage.getItem(pk));
        if (cmts && cmts.length) {
          for (var ci = 0; ci < cmts.length; ci++) {
            cmts[ci].postId = postId;
            try { await db.xComments.put(cmts[ci]); } catch(_) {}
          }
        }
      } catch(_) {}
      localStorage.removeItem(pk);
    }
    // Load all into memory
    _xPostsCache = await db.xPosts.toArray();
    _xPostsCache.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    var allComments = await db.xComments.toArray();
    _xCommentsCache = {};
    allComments.forEach(function(c) {
      if (!c.postId) return;
      if (!_xCommentsCache[c.postId]) _xCommentsCache[c.postId] = [];
      _xCommentsCache[c.postId].push(c);
    });
    console.log('[X] Cache loaded: ' + _xPostsCache.length + ' posts');
  } catch(e) { console.warn('[X] Cache init error:', e); _xPostsCache = []; }
}

// Initialize on load
_xInitCache();

function xLoadPosts() {
  return _xPostsCache || [];
}

function xSavePost(post) {
  if (!_xPostsCache) _xPostsCache = [];
  var idx = _xPostsCache.findIndex(function(p) { return p.id === post.id; });
  if (idx >= 0) _xPostsCache[idx] = post; else _xPostsCache.unshift(post);
  try { db.xPosts.put(post).catch(function() {}); } catch(_) {}
}

function xSavePosts(posts) {
  if (!_xPostsCache) _xPostsCache = [];
  for (var i = 0; i < posts.length; i++) {
    var idx = _xPostsCache.findIndex(function(p) { return p.id === posts[i].id; });
    if (idx >= 0) _xPostsCache[idx] = posts[i]; else _xPostsCache.push(posts[i]);
    try { db.xPosts.put(posts[i]).catch(function() {}); } catch(_) {}
  }
  _xPostsCache.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
}

function xDeletePost(postId) {
  if (_xPostsCache) {
    _xPostsCache = _xPostsCache.filter(function(p) { return p.id !== postId; });
  }
  delete _xCommentsCache[postId];
  try { db.xPosts.delete(postId).catch(function() {}); } catch(_) {}
  try { db.xComments.where('postId').equals(postId).delete().catch(function() {}); } catch(_) {}
}

function xSaveImage(key, dataUrl) {
  try { localStorage.setItem('wanwan_x_img_' + key, dataUrl); } catch(e) {}
}

function xLoadImage(key) {
  try { return localStorage.getItem('wanwan_x_img_' + key) || null; } catch(e) { return null; }
}

function xPickImage(callback, maxSize) {
  try {
    maxSize = maxSize || 400;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function() {
      try {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function() {
          try {
            var img = new Image();
            img.onload = function() {
              try {
                var canvas = document.createElement('canvas');
                var ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
                canvas.width = Math.round(img.width * ratio);
                canvas.height = Math.round(img.height * ratio);
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                callback(canvas.toDataURL('image/jpeg', 0.8));
              } catch(e) { try { window.toast && window.toast('图片处理失败'); } catch(_) {} }
            };
            img.onerror = function() { try { window.toast && window.toast('图片加载失败'); } catch(_) {} };
            img.src = reader.result;
          } catch(e) {}
        };
        reader.readAsDataURL(file);
      } catch(e) {}
    };
    input.click();
  } catch(e) { try { window.toast && window.toast('无法选择图片'); } catch(_) {} }
}

function xLoadComments(postId) {
  return (_xCommentsCache[postId] || []).slice().sort(function(a, b) {
    return new Date(a.createdAt) - new Date(b.createdAt);
  });
}

function xSaveComment(comment) {
  if (!comment.postId) return;
  if (!_xCommentsCache[comment.postId]) _xCommentsCache[comment.postId] = [];
  var arr = _xCommentsCache[comment.postId];
  var idx = arr.findIndex(function(c) { return c.id === comment.id; });
  if (idx >= 0) arr[idx] = comment; else arr.push(comment);
  try { db.xComments.put(comment).catch(function() {}); } catch(_) {}
}

function xSaveComments(postId, comments) {
  // Replace entire cache for this post (not merge)
  _xCommentsCache[postId] = [];
  for (var i = 0; i < comments.length; i++) {
    comments[i].postId = postId;
    _xCommentsCache[postId].push(comments[i]);
    try { db.xComments.put(comments[i]).catch(function() {}); } catch(_) {}
  }
  // Remove old comments from IndexedDB that are no longer in the list
  try {
    var ids = comments.map(function(c) { return c.id; });
    db.xComments.where('postId').equals(postId).each(function(c) {
      if (ids.indexOf(c.id) === -1) db.xComments.delete(c.id).catch(function() {});
    }).catch(function() {});
  } catch(_) {}
}

function xLoadNotifications() {
  try { return JSON.parse(localStorage.getItem(X_NOTIFY_KEY)) || []; } catch(e) { return []; }
}

function xSaveNotifications(notifs) {
  try { localStorage.setItem(X_NOTIFY_KEY, JSON.stringify(notifs)); } catch(e) {}
}

function xLoadFollows(userId) {
  try { return JSON.parse(localStorage.getItem(X_FOLLOWS_PREFIX + userId)) || []; } catch(e) { return []; }
}

function xSaveFollows(userId, follows) {
  try { localStorage.setItem(X_FOLLOWS_PREFIX + userId, JSON.stringify(follows)); } catch(e) {}
}

function xIsFollowing(userId, targetId) {
  try {
    var follows = xLoadFollows(userId);
    return follows.indexOf(String(targetId)) !== -1;
  } catch(e) { return false; }
}

function xToggleFollow(userId, targetId) {
  try {
    var follows = xLoadFollows(userId);
    var idx = follows.indexOf(String(targetId));
    if (idx !== -1) {
      follows.splice(idx, 1);
      xSaveFollows(userId, follows);
      return false;
    } else {
      follows.push(String(targetId));
      xSaveFollows(userId, follows);
      return true;
    }
  } catch(e) { return false; }
}

function xLoadSettings() {
  try {
    var s = JSON.parse(localStorage.getItem(X_SETTINGS_KEY));
    return s || { theme: 'dark', autoPost: false, autoPostInterval: 240, commentCount: 5, enabledChars: [] };
  } catch(e) {
    return { theme: 'dark', autoPost: false, autoPostInterval: 240, commentCount: 5, enabledChars: [] };
  }
}

function xSaveSettings(settings) {
  try { localStorage.setItem(X_SETTINGS_KEY, JSON.stringify(settings)); } catch(e) {}
}

function xGenId() {
  try {
    return 'x' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  } catch(e) { return 'x' + Math.random().toString(36).substr(2, 10); }
}

function xGenNpcCommenter() {
  try {
    var npc = randomPick(X_NPC_TYPES);
    return {
      id: 'npc_' + xGenId(),
      name: randomPick(X_NPC_NAMES),
      handle: '@npc-' + npc.id,
      npcType: npc
    };
  } catch(e) { return { id: 'npc_' + xGenId(), name: '路人', handle: '@npc', npcType: X_NPC_TYPES[0] }; }
}

// ===== Batch Memory System =====
window.addToBatchMemory = function(source, charId, entry) {
  try {
    var key = source + 'PendingMemories_' + charId;
    var buffer = [];
    try { buffer = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
    buffer.push(Object.assign({ _ts: Date.now() }, entry));
    try { localStorage.setItem(key, JSON.stringify(buffer)); } catch(e) {}
    console.log('[BatchMemory] ' + source + ' +' + (entry.title || '') + ' (total ' + buffer.length + ')');
  } catch(e) { console.warn('[BatchMemory] addToBatchMemory error:', e); }
};

window.checkAndFlushBatchMemory = async function(source, charId) {
  try {
    var key = source + 'PendingMemories_' + charId;
    var buffer = [];
    try { buffer = JSON.parse(localStorage.getItem(key)) || []; } catch(e) {}
    if (buffer.length < 10) return;

    console.log('[BatchMemory] ' + source + ' reached 10, flushing...');
    var callFn = window.callMemoryAI || window.callAI;
    if (!callFn || !window.db || !db.memories) return;

    var lines = buffer.map(function(e, i) {
      var time = '';
      try { time = new Date(e._ts).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_) {}
      return (i+1) + '. [' + time + '] ' + e.title + '：' + e.content;
    }).join('\n');

    var sourceLabel = source === 'x' ? 'X社交平台' : '朋友圈';
    var prompt = '你是一个长期记忆整理器。请将以下' + buffer.length + '条' + sourceLabel + '互动记录，合并为1-3条精炼的长期记忆。\n\n' +
      '要求：\n' +
      '1. 使用第三人称叙述，客观平实\n' +
      '2. 合并相似事件，保留时间线\n' +
      '3. 每条记忆包含时间范围\n' +
      '4. 标题简短，内容150字以内\n' +
      '5. 禁止夸张情绪词汇\n\n' +
      '互动记录：\n' + lines + '\n\n' +
      '返回JSON格式：\n' +
      '{"memories":[{"title":"简短标题","content":"记忆内容","keywords":["关键词"],"valence":0,"arousal":0.3,"importance":5}]}';

    var raw = await callFn([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var parsed = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    if (parsed && Array.isArray(parsed.memories) && parsed.memories.length > 0) {
      var ownerUid = null;
      try {
        var users = await db.characters.where('type').equals('user').toArray();
        if (users.length) ownerUid = String(users[0].id);
      } catch(_) {}

      var rows = [];
      parsed.memories.forEach(function(m) {
        var title = String(m.title || '').trim().slice(0, 30) || '未命名记忆';
        var content = String(m.content || '').trim().slice(0, 150);
        if (!content) return;
        rows.push({
          ownerUid: ownerUid || 'default',
          charId: charId || 0,
          chatId: source + '_' + charId,
          title: title,
          content: content,
          keywords: Array.isArray(m.keywords) ? m.keywords.slice(0, 8) : [],
          valence: 0, arousal: 0.3, importance: 5,
          embedding: null, status: 'active',
          sourceMsgStartId: null, sourceMsgEndId: null,
          sourceAt: Date.now(),
          sourceType: source,
          decayPercent: 80, isLongTerm: false, injectionLayer: 2,
          participants: [], lastRecalledAt: null,
          createdAt: Date.now(), updatedAt: Date.now(),
          lastAccessedAt: null, accessCount: 0
        });
      });

      if (rows.length) {
        await db.memories.bulkAdd(rows);
        console.log('[BatchMemory] ' + source + ' flushed ' + rows.length + ' memories');
      }
      try { localStorage.removeItem(key); } catch(_) {}
    }
  } catch(e) {
    console.warn('[BatchMemory] flush failed:', e);
  }
};

// ===== Memory helper =====
function formatMemoryTime(ts) {
  try {
    return new Date(ts).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
  } catch(e) { return ''; }
}

// ===== Toast Functions =====
window.showToast = function(msg) {
  try {
    var old = document.getElementById('x-toast');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'x-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 2500);
  } catch(e) {}
};

window.showToastLong = function(msg, duration) {
  try {
    duration = duration || 3000;
    var old = document.getElementById('x-toast-long');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'x-toast-long';
    toast.className = 'x-toast-long';
    toast.innerHTML = msg.replace(/\n/g, '<br>');
    document.body.appendChild(toast);
    setTimeout(function() { toast.classList.add('show'); }, 10);
    setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, duration);
  } catch(e) {}
};

// ===== Entry Point =====
window.showXPage = async function() {
  try {
    var user = await getXSessionUser();
    if (!user) { showXLoginPage(); return; }
    renderXMainPage(user);
  } catch(e) {
    console.error('[X] showXPage error:', e);
    try { window.toast && window.toast('X页面加载失败'); } catch(_) {}
  }
};

// ===== Session User =====
async function getXSessionUser() {
  try {
    var stored = localStorage.getItem(X_SESSION_UID_KEY);
    if (!stored) return null;
    var uid = parseInt(stored);
    if (!Number.isFinite(uid)) { localStorage.removeItem(X_SESSION_UID_KEY); return null; }
    var user = window.getCharacter ? await window.getCharacter(uid) : await db.characters.get(uid);
    if (!user || user.type !== 'user') { localStorage.removeItem(X_SESSION_UID_KEY); return null; }
    return user;
  } catch(e) { return null; }
}

function setXSessionUser(user) {
  try {
    if (!user || user.type !== 'user') return;
    localStorage.setItem(X_SESSION_UID_KEY, String(user.id));
  } catch(e) {}
}

async function getXUserList() {
  try {
    if (!window.db || !db.characters) return [];
    return await db.characters.where('type').equals('user').toArray();
  } catch(e) {
    try { return (await db.characters.toArray()).filter(function(u) { return u.type === 'user'; }); } catch(e2) { return []; }
  }
}

function getXUserName(user) {
  try {
    if (user && user.id) {
      var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id));
      if (p && p.name) return p.name;
    }
    return (user && (user.nick || user.name)) || '微信用户';
  } catch(e) { return '微信用户'; }
}

function getXUserHandle(user) {
  try {
    if (user && user.id) {
      var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id));
      if (p && p.handle) return '@' + p.handle;
    }
    if (user && user.identity && user.identity.account) return '@' + user.identity.account;
    var acc = user && user.identity && user.identity.account;
    return '@' + (acc ? String(acc).replace(/^@+/, '') : getXUserName(user).replace(/\s+/g, '_'));
  } catch(e) { return '@user'; }
}

// ===== Login Page =====
function showXLoginPage(opts) {
  try {
    opts = opts || {};
    var existing = document.getElementById('x-login-page');
    if (existing) existing.remove();
    var page = document.createElement('div');
    page.id = 'x-login-page';
    page.className = 'x-login-page';
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
      '</div>';
    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    page.querySelector('.x-login-close').onclick = function() { closeXPage('x-login-page'); };
    page.querySelector('#x-login-wechat').onclick = function() {
      var list = page.querySelector('#x-login-users');
      list.hidden = false;
      list.innerHTML = '<div class="x-loading"><i class="fa fa-spinner fa-spin"></i></div>';
      getXUserList().then(function(users) {
        try {
          if (!users.length) {
            list.innerHTML = '<div class="x-login-empty"><div>暂无账号</div><span>请先在角色档案里创建 USER 类型角色</span></div>';
            return;
          }
          list.innerHTML = users.map(function(u) {
            return '<button class="x-login-user" type="button" data-uid="' + u.id + '">' +
              '<span class="x-login-user-avatar">' + getXAvatarHTML(u) + '</span>' +
              '<span class="x-login-user-main"><span class="x-login-user-name">' + xEscape(getXUserName(u)) + '</span>' +
              '<span class="x-login-user-account">' + xEscape(u.identity && u.identity.account ? '@' + u.identity.account : '微信用户') + '</span></span>' +
              '<i class="fa fa-angle-right"></i></button>';
          }).join('');
          list.querySelectorAll('.x-login-user').forEach(function(row) {
            row.onclick = function() {
              var user = users.find(function(u) { return u.id === parseInt(row.dataset.uid); });
              if (!user) return;
              setXSessionUser(user);
              closeXPage('x-login-page');
              renderXMainPage(user);
            };
          });
        } catch(e) { console.error('[X] login list error:', e); }
      });
    };
  } catch(e) { console.error('[X] showXLoginPage error:', e); }
}

// ===== Close Page Helper =====
function closeXPage(id) {
  try {
    var el = document.getElementById(id);
    if (!el) return;
    if (window.closePage) { try { window.closePage(id); } catch(e) { el.remove(); } }
    else el.remove();
  } catch(e) {
    try { var el2 = document.getElementById(id); if (el2) el2.remove(); } catch(_) {}
  }
}

// ===== Main Page (4 Tabs) =====
async function renderXMainPage(user) {
  try {
    await _xInitCache();
    var existing = document.getElementById('x-page');
    if (existing) existing.remove();

    var page = document.createElement('div');
    page.id = 'x-page';
    page.dataset.uid = user.id;

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
      '</div>';

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    // Apply theme
    var _xSettings = xLoadSettings();
    applyXTheme(_xSettings.theme);

    // Render tabs
    renderXHomeTab(page, user);
    renderXSearchTab(page, user);
    renderXNotifyTab(page, user);
    renderXProfileTab(page, user);

    // Tab switching (onclick)
    var items = page.querySelectorAll('.x-bottombar-item');
    items.forEach(function(item) {
      item.onclick = function() {
        try {
          items.forEach(function(i) { i.classList.remove('active'); });
          item.classList.add('active');
          var tabId = item.dataset.tab;
          page.querySelectorAll('.x-tab-panel').forEach(function(p) { p.classList.remove('active'); });
          var panel = page.querySelector('#x-tab-' + tabId);
          if (panel) panel.classList.add('active');
          if (tabId === 'notify') {
            var dot = page.querySelector('.x-bottombar-dot');
            if (dot) dot.classList.remove('show');
          }
          var fab = page.querySelector('#x-fab');
          if (fab) fab.style.display = tabId === 'home' ? '' : 'none';
        } catch(e) {}
      };
    });

    // FAB compose
    page.querySelector('#x-fab').onclick = function() { showXCompose(user); };

    // Settings
    page.querySelector('.x-topbar-right').onclick = function() { showXSettingsPage(user); };

    // Generate posts
    page.querySelector('.x-topbar-gen').onclick = function() { showXGenPostsDialog(user, page.querySelector('.x-topbar-gen'), page); };

    // Back
    page.querySelector('.x-topbar-back').onclick = function() {
      var el = document.getElementById('x-page');
      if (el) el.remove();
    };

    // Auto-post scheduler
    startXAutoPostScheduler(user);
  } catch(e) { console.error('[X] renderXMainPage error:', e); }
}

function buildXBottomBar() {
  try {
    var items = [
      { id: 'home', icon: X_SVG.home, activeIcon: X_SVG.home_filled },
      { id: 'search', icon: X_SVG.search, activeIcon: X_SVG.search },
      { id: 'notify', icon: X_SVG.bell, activeIcon: X_SVG.bell_filled },
      { id: 'profile', icon: X_SVG.mail, activeIcon: X_SVG.mail_filled }
    ];
    return items.map(function(item, i) {
      return '<div class="x-bottombar-item' + (i === 0 ? ' active' : '') + '" data-tab="' + item.id + '">' +
        '<span class="icon-default">' + item.icon + '</span>' +
        '<span class="icon-active">' + item.activeIcon + '</span>' +
        (item.id === 'notify' ? '<span class="x-bottombar-dot" id="x-notify-dot"></span>' : '') +
      '</div>';
    }).join('');
  } catch(e) { return ''; }
}

// ===== Home Tab =====
function renderXHomeTab(page, user) {
  try {
    if (!page) page = document.getElementById('x-page');
    if (!page) return;
    var panel = page.querySelector('#x-tab-home');
    if (!panel) return;
    var posts = xLoadPosts();
    posts.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });

    if (!posts.length) {
      panel.innerHTML = '<div class="x-loading"><i class="fa fa-spinner fa-spin"></i></div>';
      generateInitialPosts(user).then(function() {
        renderXHomeTab(page, user);
      }).catch(function(e) { console.error('[X] generateInitialPosts error:', e); });
      return;
    }

    var _html = posts.slice(0, 20).map(function(post) { return buildXPostCard(post); }).join('');
    panel.innerHTML = _html;
    bindPostCardEvents(panel, user);
  } catch(e) { console.error('[X] renderXHomeTab error:', e); }
}

// Generate initial posts
async function generateInitialPosts(user) {
  try {
    var posts = xLoadPosts();
    if (posts.length >= 3) return;

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
      createdAt: new Date(Date.now() - 3600000).toISOString()
    };
    posts.push(xxPost);
    xSavePosts(posts);

    var npc1 = { id: xGenId(), authorId: 'npc1', authorName: '吃瓜群众', authorHandle: '@chigua', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[6], content: '哈哈哈哈哈这什么黑暗料理，但是好甜啊', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3500000).toISOString(), replies: [] };
    var npc2 = { id: xGenId(), authorId: 'npc2', authorName: '毒舌达人', authorHandle: '@dushe', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[5], content: '盐和糖都分不清？你确定这不是在养女儿？', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3400000).toISOString(), replies: [] };
    var npc3 = { id: xGenId(), authorId: 'npc3', authorName: '温柔姐姐', authorHandle: '@wenrou', authorAvatar: null, isNpc: true, npcType: X_NPC_TYPES[7], content: '愿意吃完就是最大的浪漫了，祝福你们', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3300000).toISOString(), replies: [] };
    var xxReply = { id: xGenId(), authorId: X_XX_CHARACTER.id, authorName: X_XX_CHARACTER.name, authorHandle: '@' + X_XX_CHARACTER.handle, authorAvatar: null, isSystem: true, content: '你管得着吗？我老婆做的就是最好吃的，你肯定是嫉妒我有老婆', stats: generateCommentStats(), createdAt: new Date(Date.now() - 3200000).toISOString(), replies: [], isReply: true, replyTo: npc2.id, replyToName: npc2.authorName };
    xSaveComments(xxPost.id, [npc1, npc2, npc3, xxReply]);
  } catch(e) { console.error('[X] generateInitialPosts error:', e); }
}

// ===== Post Card =====
function buildXPostCard(post) {
  try {
    var isAnon = post.isAnonymous;
    var name = isAnon ? '匿名用户' : (post.authorName || '未知');
    var handle = isAnon ? '' : (post.authorHandle || '');
    var avatarHTML = isAnon ? buildXDefaultAvatar('匿') : (post.authorAvatar ? '<img src="' + xEscape(post.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name));
    var e = post.engagement || {};
    var comments = xLoadComments(post.id);

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
        (post.tags && post.tags.length ? '<div class="x-post-tags">' + post.tags.map(function(t) { return '<span class="x-post-tag">#' + xEscape(t) + '</span>'; }).join(' ') + '</div>' : '') +
        '<div class="x-post-actions">' +
          '<button class="x-post-action comment" data-post-id="' + post.id + '">' + X_SVG.comment + '<span>' + comments.length + '</span></button>' +
          '<button class="x-post-action retweet">' + X_SVG.retweet + '<span>' + formatXNumber(e.retweets || 0) + '</span></button>' +
          '<button class="x-post-action like" data-liked="0" data-count="' + (e.likes || 0) + '">' + X_SVG.like_empty + '<span>' + formatXNumber(e.likes || 0) + '</span></button>' +
          '<button class="x-post-action share">' + X_SVG.share + '</button>' +
        '</div>' +
        (isAnon && post.authorId && post.authorId.indexOf('npc_') !== 0 ?
          '<button class="x-reveal-anon" data-post-id="' + post.id + '">解除匿名</button>' : '') +
      '</div>' +
    '</div>';
  } catch(e) { return ''; }
}

// Bind post card events
function bindPostCardEvents(container, user) {
  try {
    // Like
    container.querySelectorAll('.x-post-action.like').forEach(function(btn) {
      btn.onclick = function(e) {
        try {
          e.stopPropagation();
          var liked = btn.dataset.liked === '1';
          var count = parseInt(btn.dataset.count || 0) + (liked ? -1 : 1);
          btn.dataset.count = String(count);
          btn.dataset.liked = liked ? '0' : '1';
          btn.classList.toggle('liked', !liked);
          btn.innerHTML = (liked ? X_SVG.like_empty : X_SVG.like_solid) + '<span>' + formatXNumber(count) + '</span>';
          btn.classList.add('animate');
          setTimeout(function() { btn.classList.remove('animate'); }, 400);
        } catch(err) {}
      };
    });

    // Post click -> detail
    container.querySelectorAll('.x-post').forEach(function(card) {
      card.onclick = function(e) {
        try {
          if (e.target.closest('.x-post-action') || e.target.closest('.x-reveal-anon') || e.target.closest('.x-post-avatar')) return;
          showXPostDetail(card.dataset.postId, user);
        } catch(err) {}
      };
    });

    // Comment button -> detail
    container.querySelectorAll('.x-post-action.comment').forEach(function(btn) {
      btn.onclick = function(e) {
        try {
          e.stopPropagation();
          showXPostDetail(btn.dataset.postId, user);
        } catch(err) {}
      };
    });

    // Avatar click -> profile
    container.querySelectorAll('.x-post-avatar').forEach(function(avatar) {
      avatar.onclick = function(e) {
        try {
          e.stopPropagation();
          var charId = avatar.dataset.charId;
          if (charId && charId.indexOf('npc_') !== 0) showXCharacterProfile(charId, user);
        } catch(err) {}
      };
    });

    // Long-press handled by NPC post handler below

    // Reveal anonymous
    container.querySelectorAll('.x-reveal-anon').forEach(function(btn) {
      btn.onclick = function(e) {
        try {
          e.stopPropagation();
          revealAnonymous(btn.dataset.postId, user);
        } catch(err) {}
      };
    });

    // Long press to delete posts
    var _longPressTimer = null;
    container.querySelectorAll('.x-post').forEach(function(postEl) {
      var postId = postEl.dataset.postId;
      if (!postId) return;
      var posts = xLoadPosts();
      var post = posts.find(function(p) { return p.id === postId; });
      

      postEl.addEventListener('touchstart', function(e) {
        _longPressTimer = setTimeout(function() {
          try {
            var overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:10001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);opacity:0;transition:opacity 200ms cubic-bezier(0.23,1,0.32,1)';
            var box = document.createElement('div');
            box.style.cssText = 'background:var(--x-surface,#fff);border-radius:16px;padding:24px;max-width:280px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,0.12);transform:scale(0.95);transition:transform 200ms cubic-bezier(0.23,1,0.32,1)';
            box.innerHTML = '<div style="font-size:16px;font-weight:600;color:var(--x-text,#1a1a1a);margin-bottom:8px">删除帖子</div>' +
              '<div style="font-size:13px;color:var(--x-text-muted,#999);margin-bottom:20px;line-height:1.4">删除后将无法恢复，确定要删除吗？</div>' +
              '<div style="display:flex;gap:10px">' +
              '<button id="x-del-cancel" style="flex:1;padding:10px 0;border-radius:10px;border:1px solid var(--x-border,#e0e0e0);background:transparent;color:var(--x-text,#1a1a1a);font-size:14px;font-weight:500;cursor:pointer;transition:background 150ms">取消</button>' +
              '<button id="x-del-confirm" style="flex:1;padding:10px 0;border-radius:10px;border:none;background:#e05555;color:#fff;font-size:14px;font-weight:500;cursor:pointer;transition:opacity 150ms">删除</button>' +
              '</div>';
            overlay.appendChild(box);
            document.body.appendChild(overlay);
            requestAnimationFrame(function() {
              overlay.style.opacity = '1';
              box.style.transform = 'scale(1)';
            });
            function closePopup() {
              overlay.style.opacity = '0';
              box.style.transform = 'scale(0.95)';
              setTimeout(function() { overlay.remove(); }, 200);
            }
            box.querySelector('#x-del-cancel').onclick = closePopup;
            box.querySelector('#x-del-confirm').onclick = function() {
              xDeletePost(postId);
              closePopup();
              window.toast && window.toast('已删除');
              var _xp = document.getElementById('x-page');
              if (_xp) renderXHomeTab(_xp, user);
            };
            overlay.onclick = function(e) { if (e.target === overlay) closePopup(); };
          } catch(err) {}
        }, 600);
      });
      postEl.addEventListener('touchend', function() { clearTimeout(_longPressTimer); });
      postEl.addEventListener('touchmove', function() { clearTimeout(_longPressTimer); });
    });

    // Generate comments button on post card
    container.querySelectorAll('.x-post-gen-comments').forEach(function(btn) {
      btn.onclick = function(e) {
        try {
          e.stopPropagation();
          btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
          var postId = btn.dataset.postId;
          var posts = xLoadPosts();
          var post = posts.find(function(p) { return p.id === postId; });
          if (post && window.callAI) {
            generateAIComments(post, user).then(function() {
              btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
              var _xp = document.getElementById('x-page');
              if (_xp) renderXHomeTab(_xp, user);
            }).catch(function() {
              btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
            });
          } else {
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
          }
        } catch(err) {}
      };
    });
  } catch(e) { console.error('[X] bindPostCardEvents error:', e); }
}

// Reveal anonymous
function revealAnonymous(postId, user) {
  try {
    var posts = xLoadPosts();
    var post = posts.find(function(p) { return p.id === postId; });
    if (!post || !post.isAnonymous) return;

    if (post.authorId && post.authorId.indexOf('npc_') === 0) {
      if (window.toast) window.toast('无法解除此匿名用户的身份');
      return;
    }

    post.isAnonymous = false;
    if (post.realAuthorId) {
      post.authorId = post.realAuthorId;
      post.authorName = post.realAuthorName || '微信用户';
      post.authorHandle = post.realAuthorHandle || '';
      post.authorAvatar = post.realAuthorAvatar || null;
    }
    xSavePosts(posts);

    var page = document.getElementById('x-page');
    if (page) renderXHomeTab(page, user);
  } catch(e) { console.error('[X] revealAnonymous error:', e); }
}

// ===== Post Detail =====
function showXPostDetail(postId, user) {
  try {
    var posts = xLoadPosts();
    var post = posts.find(function(p) { return p.id === postId; });
    if (!post) return;
    var comments = xLoadComments(postId);
    var isAnon = post.isAnonymous;
    var name = isAnon ? '匿名用户' : (post.authorName || '未知');
    var handle = isAnon ? '' : (post.authorHandle || '');
    var avatarHTML = isAnon ? buildXDefaultAvatar('匿') : (post.authorAvatar ? '<img src="' + xEscape(post.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name));
    var e = post.engagement || {};

    var page = document.createElement('div');
    page.id = 'x-detail-page';
    page.className = 'x-detail-page';
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
          (post.tags && post.tags.length ? '<div class="x-post-tags">' + post.tags.map(function(t) { return '<span class="x-post-tag">#' + xEscape(t) + '</span>'; }).join(' ') + '</div>' : '') +
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
      '</div>';

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    // Apply theme
    var settings = xLoadSettings();
    page.classList.toggle('theme-dark', settings.theme === 'dark');

    // Back
    page.querySelector('.x-detail-back').onclick = function() { closeXPage('x-detail-page'); };

    // Like
    var likeBtn = page.querySelector('.x-detail-action.like');
    likeBtn.onclick = function() {
      try {
        var liked = likeBtn.dataset.liked === '1';
        var count = parseInt(likeBtn.dataset.count || 0) + (liked ? -1 : 1);
        likeBtn.dataset.count = String(count);
        likeBtn.dataset.liked = liked ? '0' : '1';
        likeBtn.classList.toggle('liked', !liked);
        likeBtn.innerHTML = (liked ? X_SVG.like_empty : X_SVG.like_solid);
        likeBtn.classList.add('animate');
        setTimeout(function() { likeBtn.classList.remove('animate'); }, 400);
      } catch(err) {}
    };

    // Comment input
    var input = page.querySelector('.x-comment-input');
    var sendBtn = page.querySelector('.x-comment-send');
    input.oninput = function() {
      sendBtn.classList.toggle('active', input.value.trim().length > 0);
    };
    sendBtn.onclick = function() {
      try {
        var text = input.value.trim();
        if (!text) return;
        var quoteContent = input.dataset.quoteContent || '';
        var quoteName = input.dataset.quoteName || '';
        addXComment(postId, user, text, quoteContent, quoteName);
        input.value = '';
        input.placeholder = '发表评论...';
        delete input.dataset.replyTo;
        delete input.dataset.replyToName;
        delete input.dataset.quoteContent;
        delete input.dataset.quoteName;
        sendBtn.classList.remove('active');
        page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(xLoadComments(postId));
        bindCommentEvents(page, postId, user, input, sendBtn);
      } catch(err) {}
    };

    // Generate comments button
    var genBtn = page.querySelector('.x-comment-gen-btn');
    if (genBtn) {
      genBtn.onclick = function() {
        try {
          genBtn.classList.add('loading');
          var posts2 = xLoadPosts();
          var post2 = posts2.find(function(p) { return p.id === postId; });
          if (post2 && window.callAI) {
            generateAIComments(post2, user).then(function() {
              genBtn.classList.remove('loading');
              page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(xLoadComments(postId));
              bindCommentEvents(page, postId, user, input, sendBtn);
            }).catch(function() { genBtn.classList.remove('loading'); });
          } else {
            genBtn.classList.remove('loading');
          }
        } catch(err) {}
      };
    }

    bindCommentEvents(page, postId, user, input, sendBtn);
  } catch(e) { console.error('[X] showXPostDetail error:', e); }
}

// Bind comment events
function bindCommentEvents(page, postId, user, input, sendBtn) {
  try {
    var oldMenu = page.querySelector('.x-comment-menu-popup');
    if (oldMenu) oldMenu.remove();

    page.querySelectorAll('#x-comments-list .x-comment').forEach(function(el) {
      el.onclick = function(e) {
        try {
          if (e.target.closest('.x-comment-action') || e.target.closest('.x-comment-more')) return;
          var name = el.querySelector('.x-comment-name');
          if (name) {
            input.placeholder = '回复 @' + name.textContent + '...';
            input.dataset.replyTo = el.dataset.commentId;
            input.dataset.replyToName = name.textContent;
            input.focus();
          }
        } catch(err) {}
      };

      var moreBtn = el.querySelector('.x-comment-more');
      if (moreBtn) {
        moreBtn.onclick = function(e) {
          try {
            e.stopPropagation();
            var existMenu = page.querySelector('.x-comment-menu-popup');
            if (existMenu) { existMenu.remove(); return; }

            var commentId = el.dataset.commentId;
            var rect = moreBtn.getBoundingClientRect();
            var menu = document.createElement('div');
            menu.className = 'x-comment-menu-popup';
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            menu.innerHTML =
              '<div class="x-comment-menu-item" data-action="quote"><i class="fa-solid fa-quote-left"></i> 引用</div>' +
              '<div class="x-comment-menu-item" data-action="edit"><i class="fa-solid fa-pen"></i> 编辑</div>' +
              '<div class="x-comment-menu-item x-comment-menu-delete" data-action="delete"><i class="fa-solid fa-trash"></i> 删除</div>';

            page.appendChild(menu);

            menu.querySelectorAll('.x-comment-menu-item').forEach(function(item) {
              item.onclick = function(e2) {
                try {
                  e2.stopPropagation();
                  var action = item.dataset.action;
                  menu.remove();

                  if (action === 'delete') {
                    var comments = xLoadComments(postId);
                    comments = comments.filter(function(c) { return c.id !== commentId; });
                    xSaveComments(postId, comments);
                    page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(comments);
                    bindCommentEvents(page, postId, user, input, sendBtn);
                  } else if (action === 'quote') {
                    var content = el.querySelector('.x-comment-content');
                    var nameEl = el.querySelector('.x-comment-name');
                    if (content && nameEl) {
                      input.dataset.replyTo = commentId;
                      input.dataset.replyToName = nameEl.textContent;
                      input.dataset.quoteContent = content.textContent;
                      input.dataset.quoteName = nameEl.textContent;
                      input.placeholder = '回复 @' + nameEl.textContent + '...';
                      input.focus();
                      sendBtn.classList.add('active');
                    }
                  } else if (action === 'edit') {
                    var comments2 = xLoadComments(postId);
                    var comment = comments2.find(function(c) { return c.id === commentId; });
                    if (comment) showEditCommentPopup(page, postId, comment, user, input, sendBtn);
                  }
                } catch(err) {}
              };
            });

            setTimeout(function() {
              document.addEventListener('click', function closeMenu() {
                try { menu.remove(); } catch(_) {}
                document.removeEventListener('click', closeMenu);
              }, { once: true });
            }, 10);
          } catch(err) {}
        };
      }
    });
  } catch(e) { console.error('[X] bindCommentEvents error:', e); }
}

// Edit comment popup
function showEditCommentPopup(page, postId, comment, user, input, sendBtn) {
  try {
    var overlay = document.createElement('div');
    overlay.className = 'x-edit-comment-overlay';
    overlay.innerHTML =
      '<div class="x-edit-comment-card">' +
        '<div class="x-edit-comment-title">编辑评论</div>' +
        '<textarea class="x-edit-comment-input" id="x-edit-comment-textarea">' + xEscape(comment.content) + '</textarea>' +
        '<div class="x-edit-comment-btns">' +
          '<button class="x-edit-comment-cancel" id="x-edit-cancel">取消</button>' +
          '<button class="x-edit-comment-save" id="x-edit-save">保存</button>' +
        '</div>' +
      '</div>';
    page.appendChild(overlay);

    var textarea = overlay.querySelector('#x-edit-comment-textarea');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    overlay.querySelector('#x-edit-cancel').onclick = function() { overlay.remove(); };
    overlay.querySelector('#x-edit-save').onclick = function() {
      try {
        var newText = textarea.value.trim();
        if (!newText) return;
        var comments = xLoadComments(postId);
        var target = comments.find(function(c) { return c.id === comment.id; });
        if (target) {
          target.content = newText;
          xSaveComments(postId, comments);
          page.querySelector('#x-comments-list').innerHTML = buildXCommentsList(comments);
          bindCommentEvents(page, postId, user, input, sendBtn);
        }
        overlay.remove();
      } catch(err) {}
    };
  } catch(e) {}
}

function buildXCommentsList(comments) {
  try {
    if (!comments || !comments.length) return '<div style="padding:32px;text-align:center;color:var(--x-text-muted);font-size:14px">暂无评论</div>';

    var html = '';
    comments.forEach(function(c) {
      if (c.isReply) return;
      html += buildXCommentItem(c, false);
      var replies = comments.filter(function(r) { return r.isReply && r.replyTo === c.id; });
      replies.forEach(function(r) {
        html += buildXCommentItem(r, true);
      });
    });
    return html;
  } catch(e) { return ''; }
}

function buildXCommentItem(comment, isNested) {
  try {
    var isAnon = comment.isAnonymous;
    var name = isAnon ? '匿名用户' : (comment.authorName || '未知');
    var handle = isAnon ? '' : (comment.authorHandle || '');
    var avatarHTML = isAnon ? buildXDefaultAvatar('匿') : (comment.authorAvatar ? '<img src="' + xEscape(comment.authorAvatar) + '" alt="">' : buildXDefaultAvatar(name));
    var stats = comment.stats || {};

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
        (comment.quoteContent ? '<div class="x-comment-quote"><span class="x-quote-name">@' + xEscape(comment.quoteName || '') + '</span> ' + xEscape(comment.quoteContent) + '</div>' : '') +
        '<div class="x-comment-content">' + formatXContent(comment.content) + '</div>' +
        '<div class="x-comment-actions">' +
          '<button class="x-comment-action comment">' + X_SVG.reply + '<span>' + (stats.comments || 0) + '</span></button>' +
          '<button class="x-comment-action retweet">' + X_SVG.retweet + '<span>' + formatXNumber(stats.retweets || 0) + '</span></button>' +
          '<button class="x-comment-action like">' + X_SVG.like_empty + '<span>' + formatXNumber(stats.likes || 0) + '</span></button>' +
          '<button class="x-comment-action chart">' + X_SVG.chart + '<span>' + formatXNumber(stats.views || 0) + '</span></button>' +
          '<button class="x-comment-action share">' + X_SVG.share + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  } catch(e) { return ''; }
}

// Add comment
function addXComment(postId, user, text, quoteContent, quoteName) {
  try {
    var comments = xLoadComments(postId);
    var replyToId = null;
    var replyToName = '';
    var input = document.querySelector('.x-comment-input');
    if (input && input.dataset.replyTo) {
      replyToId = input.dataset.replyTo;
      replyToName = input.dataset.replyToName || '';
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
    };
    if (replyToId) {
      obj.replyTo = replyToId;
      obj.replyToName = replyToName;
      obj.isReply = true;
    }
    if (quoteContent) {
      obj.quoteContent = quoteContent;
      obj.quoteName = quoteName || '';
    }
    comments.push(obj);
    xSaveComments(postId, comments);

    // Notification
    var posts = xLoadPosts();
    var post = posts.find(function(p) { return p.id === postId; });
    if (post) {
      var notifs = xLoadNotifications();
      notifs.unshift({
        id: xGenId(),
        type: 'comment',
        userId: user.id,
        userName: getXUserName(user),
        postId: postId,
        postPreview: text.slice(0, 30),
        createdAt: new Date().toISOString()
      });
      xSaveNotifications(notifs);
      showNotifyDot();

      // Memory: user comments on AI post
      if (post.authorId && String(post.authorId) !== String(user.id)) {
        var postPreview = (post.content || '').slice(0, 30);
        addToBatchMemory('x', post.authorId, {
          title: '用户评论了我的帖子',
          content: '我发了一条帖子"' + postPreview + '"，用户"' + getXUserName(user) + '"评论说："' + text.slice(0, 40) + '"',
          keywords: ['评论', '互动', postPreview.slice(0, 10)]
        });
        checkAndFlushBatchMemory('x', post.authorId);
      }

      // Memory: user replies to AI comment
      if (replyToId) {
        var targetComment = comments.find(function(c) { return c.id === replyToId; });
        if (targetComment && targetComment.authorId && String(targetComment.authorId) !== String(user.id)) {
          addToBatchMemory('x', targetComment.authorId, {
            title: '用户回复了我的评论',
            content: '我说了"' + (targetComment.content || '').slice(0, 30) + '"，用户"' + getXUserName(user) + '"回复我说："' + text.slice(0, 40) + '"',
            keywords: ['回复', '互动']
          });
          checkAndFlushBatchMemory('x', targetComment.authorId);
        }
      }
    }
  } catch(e) { console.error('[X] addXComment error:', e); }
}

// ===== Compose Page =====
function showXCompose(user) {
  try {
    var existing = document.getElementById('x-compose');
    if (existing) existing.remove();
    var page = document.createElement('div');
    page.id = 'x-compose';
    page.className = 'x-compose-page';
    var isAnonymous = false;

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
        '<div class="x-compose-input" contenteditable="true" data-placeholder="有什么新鲜事?"></div>' +
      '</div>' +
      '<div class="x-compose-footer">' +
        '<div class="x-compose-tools">' +
          '<button class="x-compose-tool"><i class="fa-solid fa-image"></i></button>' +
          '<button class="x-compose-tool"><i class="fa-solid fa-hashtag"></i></button>' +
        '</div>' +
      '</div>';

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    // Apply theme
    var settings = xLoadSettings();
    page.classList.toggle('theme-dark', settings.theme === 'dark');

    var input = page.querySelector('.x-compose-input');
    var publishBtn = page.querySelector('.x-compose-publish');
    var anonToggle = page.querySelector('#x-anon-toggle');
    var avatarEl = page.querySelector('#x-compose-avatar');

    input.oninput = function() {
      publishBtn.classList.toggle('active', input.textContent.trim().length > 0);
    };

    anonToggle.onclick = function() {
      isAnonymous = !isAnonymous;
      anonToggle.classList.toggle('on', isAnonymous);
      avatarEl.innerHTML = isAnonymous ? buildXDefaultAvatar('匿') : getXAvatarHTML(user);
    };

    page.querySelector('.x-compose-cancel').onclick = function() { closeXPage('x-compose'); };

    publishBtn.onclick = function() {
      try {
        var text = input.textContent.trim();
        if (!text) return;
        publishXPost(user, text, isAnonymous);
        closeXPage('x-compose');
      } catch(err) {}
    };
  } catch(e) { console.error('[X] showXCompose error:', e); }
}

// Publish post
async function publishXPost(user, content, isAnonymous) {
  try {
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
    };

    var posts = xLoadPosts();
    posts.unshift(post);
    xSavePosts(posts);

    var page = document.getElementById('x-page');
    if (page) renderXHomeTab(page, user);

    generateAIComments(post, user);

    // Delayed notification
    setTimeout(function() {
      try {
        var notifs = xLoadNotifications();
        notifs.unshift({
          id: xGenId(),
          type: 'like',
          userName: randomPick(X_NPC_NAMES),
          postId: post.id,
          postPreview: content.slice(0, 30),
          createdAt: new Date().toISOString()
        });
        xSaveNotifications(notifs);
        showNotifyDot();
      } catch(e) {}
    }, randomInt(5000, 30000));
  } catch(e) { console.error('[X] publishXPost error:', e); }
}

// AI generate comments
async function generateAIComments(post, user) {
  try {
    if (!window.callAI) return;

    var charList = '';
    try {
      var chars = await db.characters.where('type').equals('char').toArray();
      charList = chars.slice(0, 5).map(function(c) { return c.name + '（' + (c.description || (c.identity && c.identity.bio) || c.signature || '') + '）'; }).join('、');
    } catch(e) {}

    var npcSample = X_NPC_TYPES.slice(0, 5).map(function(n) { return n.id + '.' + n.name + '(' + n.style + ')'; }).join('\n');
    var isAnon = post.isAnonymous || (post.authorId && post.authorId.indexOf('anon_') === 0);

    var prompt = '你是一个社交媒体评论生成器。根据以下帖子内容，生成评论互动。\n\n' +
      '帖子内容："' + post.content.slice(0, 200) + '"\n\n' +
      '可用NPC人设：\n' + npcSample + '\n\n' +
      '可用自建AI角色：' + (charList || '无') + '\n\n' +
      '要求：\n' +
      '1. 先生成5条一级评论，每条来自不同NPC人设\n' +
      (isAnon ? '' : '2. 发帖人（' + (post.authorName || '楼主') + '）选择性回复其中2-3条评论\n') +
      '3. 被回复的NPC可以再回复发帖人\n' +
      '4. NPC之间可以互评\n' +
      '5. 形成3层对话链\n' +
      '6. 评论真实自然\n\n' +
      '返回JSON：\n' +
      '{"comments":[{"name":"NPC名","content":"评论内容","npcType":5,"isNpc":true}]' +
      (isAnon ? '' : ',"replies":[{"replyToIndex":0,"name":"' + (post.authorName || '楼主') + '","content":"发帖人回复"}]') +
      ',"replies2":[{"replyToCommentIndex":0,"replyToReplyIndex":-1,"name":"NPC名","content":"NPC回复"}]}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    var comments = xLoadComments(post.id);

    // XX comment
    try {
      var xxPrompt = '你是XX，人设：' + X_XX_CHARACTER.bio + '\n\n帖子内容："' + post.content.slice(0, 200) + '"\n\n请以XX的身份评论。直接返回文字。';
      var xxContent = await window.callAI([{ role: 'user', content: xxPrompt }]);
      var xxText = typeof xxContent === 'string' ? xxContent.trim().replace(/^["'"「]|["'"」]$/g, '') : '';
      comments.push({
        id: xGenId(), authorId: X_XX_CHARACTER.id, authorName: X_XX_CHARACTER.name,
        authorHandle: '@xx_love', authorAvatar: null, isSystem: true,
        content: xxText || '我老婆说得对！',
        stats: generateCommentStats(), createdAt: new Date().toISOString(), replies: []
      });
    } catch(e) {
      comments.push({
        id: xGenId(), authorId: X_XX_CHARACTER.id, authorName: X_XX_CHARACTER.name,
        authorHandle: '@xx_love', authorAvatar: null, isSystem: true,
        content: '我老婆说得对！',
        stats: generateCommentStats(), createdAt: new Date().toISOString(), replies: []
      });
    }

    // Add comments
    if (data.comments) {
      data.comments.forEach(function(c) {
        var npcType = X_NPC_TYPES.find(function(n) { return n.id === c.npcType; }) || randomPick(X_NPC_TYPES);
        comments.push({
          id: xGenId(),
          authorId: c.isNpc ? 'npc_' + xGenId() : (post.authorId || 'anon'),
          authorName: c.name || randomPick(X_NPC_NAMES),
          authorHandle: '@user-' + String(c.id || '').slice(-4),
          authorAvatar: null,
          isNpc: !!c.isNpc,
          npcType: npcType,
          content: c.content,
          stats: generateCommentStats(),
          createdAt: new Date().toISOString(),
          isReply: false
        });
      });
    }

    // Add author replies (level 2)
    if (!isAnon && data.replies) {
      data.replies.forEach(function(r) {
        var targetComment = data.comments[r.replyToIndex];
        if (!targetComment) return;
        var targetInStore = comments.find(function(c) { return c.content === targetComment.content && !c.isReply; });
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
        });
      });
    }

    // Level 3 replies
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
        });
      });
    }

    xSaveComments(post.id, comments);

    // Memory: AI comments on user post
    comments.forEach(function(c) {
      if (c.authorId && !c.isReply) {
        var postAuthor = post.authorName || '用户';
        var postPreview = (post.content || '').slice(0, 25);
        addToBatchMemory('x', c.authorId, {
          title: '我在X上评论了帖子',
          content: postAuthor + '发了一条帖子"' + postPreview + '"，我评论说："' + c.content.slice(0, 40) + '"',
          keywords: ['X评论', '互动']
        });
        checkAndFlushBatchMemory('x', c.authorId);
      }
    });

    // Notifications
    var notifs = xLoadNotifications();
    comments.forEach(function(c) {
      if (!c.isReply) {
        notifs.unshift({
          id: xGenId(),
          type: 'comment',
          userName: c.authorName,
          postId: post.id,
          postPreview: c.content.slice(0, 30),
          createdAt: new Date().toISOString()
        });
      }
    });
    xSaveNotifications(notifs);
    showNotifyDot();

    // Refresh feed
    var page = document.getElementById('x-page');
    if (page) renderXHomeTab(page, user);

  } catch(e) { console.error('[X] AI评论生成失败:', e); }
}

function showNotifyDot() {
  try {
    var dot = document.getElementById('x-notify-dot');
    if (dot) dot.classList.add('show');
  } catch(e) {}
}

// ===== Search Tab =====
function renderXSearchTab(page, user) {
  try {
    var panel = page.querySelector('#x-tab-search');
    if (!panel) return;
    panel.innerHTML =
      '<div class="x-search-page">' +
        '<div class="x-search-box">' +
          '<i class="fa fa-search"></i>' +
          '<input type="text" placeholder="搜索帖子或用户..." id="x-search-input">' +
        '</div>' +
        '<div class="x-search-results" id="x-search-results"></div>' +
      '</div>';

    var input = panel.querySelector('#x-search-input');
    var results = panel.querySelector('#x-search-results');
    var debounce = null;
    input.oninput = function() {
      clearTimeout(debounce);
      debounce = setTimeout(function() { doXSearch(input.value.trim(), results, user); }, 300);
    };
  } catch(e) {}
}

function doXSearch(query, resultsEl, user) {
  try {
    if (!query) { resultsEl.innerHTML = ''; return; }
    var posts = xLoadPosts();
    var q = query.toLowerCase();
    var matched = posts.filter(function(p) {
      return (p.content && p.content.toLowerCase().indexOf(q) !== -1) ||
             (p.authorName && p.authorName.toLowerCase().indexOf(q) !== -1) ||
             (p.tags && p.tags.some(function(t) { return t.toLowerCase().indexOf(q) !== -1; }));
    });
    if (!matched.length) {
      resultsEl.innerHTML = '<div class="x-empty-state"><div class="x-empty-state-title">未找到结果</div><div class="x-empty-state-desc">试试其他关键词</div></div>';
      return;
    }
    resultsEl.innerHTML = matched.slice(0, 20).map(function(post) { return buildXPostCard(post); }).join('');
    bindPostCardEvents(resultsEl, user);
  } catch(e) {}
}

// ===== Notifications Tab =====
function renderXNotifyTab(page, user) {
  try {
    var panel = page.querySelector('#x-tab-notify');
    if (!panel) return;
    var notifs = xLoadNotifications();

    if (!notifs.length) {
      panel.innerHTML = '<div class="x-empty-state"><div class="x-empty-state-title">暂无通知</div><div class="x-empty-state-desc">当有人互动时会通知你</div></div>';
      return;
    }

    panel.innerHTML = '<div class="x-notify-page">' +
      notifs.slice(0, 50).map(function(n) {
        var iconClass = n.type === 'like' ? 'like-icon' : 'comment-icon';
        var iconName = n.type === 'like' ? 'fa-heart' : 'fa-comment';
        var text = n.type === 'like'
          ? '<strong>' + xEscape(n.userName) + '</strong> 点赞了你的帖子'
          : '<strong>' + xEscape(n.userName) + '</strong> 评论了你的帖子：' + xEscape(n.postPreview);
        return '<div class="x-notify-item">' +
          '<div class="x-notify-icon ' + iconClass + '"><i class="fa ' + iconName + '"></i></div>' +
          '<div><div class="x-notify-text">' + text + '</div>' +
          '<div class="x-notify-time">' + timeAgo(n.createdAt) + '</div></div>' +
        '</div>';
      }).join('') +
    '</div>';
  } catch(e) {}
}

// ===== Profile Tab =====
function renderXProfileTab(page, user) {
  try {
    var panel = page.querySelector('#x-tab-profile');
    if (!panel) return;
    renderXProfileContent(panel, user, true);
  } catch(e) {}
}

function buildXProfileHTML(opts) {
  try {
    var coverStyle = opts.coverImg ? 'background-image:url(' + xEscape(opts.coverImg) + ')' : '';
    var avatarHTML = opts.avatarHTML || '';
    var actions = '';

    if (opts.showEdit) {
      actions += '<button class="xh-edit-btn" id="x-edit-profile-btn"><i class="fa-solid fa-pen"></i> 编辑个人资料</button>';
    }
    if (opts.showFollow) {
      actions += '<button class="xh-edit-btn' + (opts.isFollowing ? ' following' : '') + '" id="x-char-follow-btn">' + (opts.isFollowing ? '已关注' : '+ 关注') + '</button>';
    }
    if (opts.showGenBtn) {
      actions += '<button class="xh-gen-btn" id="x-gen-5-posts"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子</button>';
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
    '</div>';
  } catch(e) { return ''; }
}

function renderXProfileContent(container, user, isOwnProfile) {
  try {
    var follows = xLoadFollows(user.id);
    var posts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(user.id); });
    var comments = [];
    xLoadPosts().forEach(function(p) {
      var pc = xLoadComments(p.id);
      pc.forEach(function(c) {
        if (String(c.authorId) === String(user.id)) comments.push({ comment: c, post: p });
      });
    });
    var savedAvatar = xLoadImage('avatar_' + user.id);
    var savedCover = xLoadImage('cover_' + user.id);
    var avatarSrc = savedAvatar || user.avatar || '';
    var avatarHTML = avatarSrc ? '<img src="' + xEscape(avatarSrc) + '" alt="">' : getXAvatarHTML(user);

    var bio = '';
    try { var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id)); if (p && p.signature) bio = p.signature; } catch(e) {}
    if (!bio) bio = user.signature || user.bio || '';
    var ipLocation = '';
    try { var p2 = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id)); if (p2 && p2.ipLocation) ipLocation = p2.ipLocation; } catch(e) {}

    container.innerHTML = buildXProfileHTML({
      coverImg: savedCover || '',
      avatarHTML: avatarHTML,
      name: getXUserName(user),
      handle: getXUserHandle(user),
      bio: bio,
      ipLocation: ipLocation,
      postCount: posts.length,
      followingCount: follows.length,
      followerCount: randomInt(10, 500),
      likeCount: randomInt(50, 2000),
      showBack: isOwnProfile ? false : undefined,
      showEdit: isOwnProfile,
      postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p); }).join('') : '<div class="xh-empty">还没有帖子</div>',
      commentsHTML: comments.length ? comments.map(function(item) {
        return '<div class="xh-comment-item"><div class="xh-comment-post-title">回复了 ' + xEscape(item.post.authorName || '匿名') + ' 的帖子</div><div class="xh-comment-text">' + xEscape(item.comment.content) + '</div><div class="xh-comment-time">' + timeAgo(item.comment.createdAt) + '</div></div>';
      }).join('') : '<div class="xh-empty">还没有评论</div>',
      likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
    });

    // Tab switching
    container.querySelectorAll('.xh-tab').forEach(function(tab) {
      tab.onclick = function() {
        try {
          container.querySelectorAll('.xh-tab').forEach(function(t) { t.classList.remove('active'); });
          container.querySelectorAll('.xh-tab-panel').forEach(function(c) { c.classList.remove('active'); });
          tab.classList.add('active');
          container.querySelector('#xh-tab-' + tab.dataset.tab).classList.add('active');
        } catch(e) {}
      };
    });

    // Avatar/cover
    container.querySelector('#xh-avatar-wrap').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('avatar_' + user.id, dataUrl);
        container.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
      }, 400);
    };
    container.querySelector('#xh-cover-btn').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('cover_' + user.id, dataUrl);
        container.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')';
      }, 800);
    };

    if (isOwnProfile) {
      var editBtn = container.querySelector('#x-edit-profile-btn');
      if (editBtn) editBtn.onclick = function() { showXProfileEdit(user); };
    }

    var backBtn = container.querySelector('.xh-back-btn');
    if (backBtn) backBtn.onclick = function() { closeXPage('x-page'); };

    // Follow count click -> follow list
    var followStat = container.querySelectorAll('.xh-stat-item')[1];
    if (followStat) {
      followStat.style.cursor = 'pointer';
      followStat.onclick = function() { showFollowListPanel(user); };
    }

    bindPostCardEvents(container, user);
  } catch(e) { console.error('[X] renderXProfileContent error:', e); }
}

// Follow list panel
function showFollowListPanel(user) {
  try {
    var existing = document.getElementById('x-follow-list-panel');
    if (existing) { existing.remove(); return; }

    var follows = xLoadFollows(user.id);
    var panel = document.createElement('div');
    panel.id = 'x-follow-list-panel';
    panel.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:999;background:var(--x-bg,#000);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:env(safe-area-inset-top) 0 0 0';

    var listHTML = '';
    if (!follows.length) {
      listHTML = '<div class="x-empty-state"><div class="x-empty-state-desc">还没有关注任何人</div></div>';
    } else {
      follows.forEach(function(fid) {
        var char = null;
        if (fid === X_XX_CHARACTER.id) char = X_XX_CHARACTER;
        if (char) {
          var avatar = xLoadImage('avatar_' + char.id) || char.avatar || '';
          var avatarHTML = avatar ? '<img src="' + xEscape(avatar) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover">' : buildXDefaultAvatar(char.name);
          listHTML += '<div class="x-follow-item" data-char-id="' + char.id + '" style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--x-border)">' +
            '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0">' + avatarHTML + '</div>' +
            '<div><div style="font-size:15px;font-weight:600;color:var(--x-text)">' + xEscape(char.name) + '</div>' +
            '<div style="font-size:13px;color:var(--x-text-muted)">@' + xEscape(char.handle || '') + '</div></div></div>';
        } else if (window.db && db.characters) {
          db.characters.get(parseInt(fid) || fid).then(function(c) {
            try {
              if (!c) return;
              var avatar = xLoadImage('avatar_' + c.id) || c.avatar || '';
              var avatarHTML = avatar ? '<img src="' + xEscape(avatar) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover">' : buildXDefaultAvatar(c.name);
              var item = document.createElement('div');
              item.className = 'x-follow-item';
              item.dataset.charId = c.id;
              item.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--x-border)';
              item.innerHTML = '<div style="width:44px;height:44px;border-radius:50%;overflow:hidden;flex-shrink:0">' + avatarHTML + '</div>' +
                '<div><div style="font-size:15px;font-weight:600;color:var(--x-text)">' + xEscape(c.name) + '</div>' +
                '<div style="font-size:13px;color:var(--x-text-muted)">@' + xEscape((c.identity && c.identity.account) || c.handle || '') + '</div></div>';
              var list = panel.querySelector('#x-follow-list-body');
              if (list) list.appendChild(item);
              bindFollowItemClick(panel, user);
            } catch(e2) {}
          });
        }
      });
    }

    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--x-border)">' +
        '<button id="x-follow-close" style="background:none;border:none;color:var(--x-text);font-size:18px;cursor:pointer;padding:8px"><i class="fa fa-angle-left"></i></button>' +
        '<span style="font-size:16px;font-weight:600;color:var(--x-text)">关注的人</span>' +
        '<span style="width:32px"></span>' +
      '</div>' +
      '<div id="x-follow-list-body">' + listHTML + '</div>';

    document.body.appendChild(panel);
    document.getElementById('x-follow-close').onclick = function() { panel.remove(); };
    bindFollowItemClick(panel, user);
  } catch(e) { console.error('[X] showFollowListPanel error:', e); }
}

function bindFollowItemClick(panel, user) {
  try {
    panel.querySelectorAll('.x-follow-item').forEach(function(item) {
      item.onclick = function() {
        try {
          var charId = item.dataset.charId;
          if (charId) {
            panel.remove();
            showXCharacterProfile(charId, user);
          }
        } catch(e) {}
      };
    });
  } catch(e) {}
}

// ===== Character Profile =====
function showXCharacterProfile(charId, user) {
  try {
    if (charId === X_XX_CHARACTER.id || charId === 'xx_laopo') {
      showXXProfile(user);
      return;
    }
    if (!window.db || !db.characters) return;
    var lookupId = parseInt(charId) || charId;
    db.characters.get(lookupId).then(function(char) {
      if (!char) return;
      renderXCharProfilePage(char, user);
    }).catch(function(e) { console.error('[X] find char failed:', e); });
  } catch(e) { console.error('[X] showXCharacterProfile error:', e); }
}

function renderXCharProfilePage(char, user) {
  try {
    var existing = document.getElementById('x-char-profile');
    if (existing) existing.remove();

    var posts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(char.id); });
    var isFollowing = xIsFollowing(user.id, char.id);
    var isSelf = String(char.id) === String(user.id);
    var savedAvatar = xLoadImage('avatar_' + char.id);
    var savedCover = xLoadImage('cover_' + char.id);
    var avatarSrc = savedAvatar || char.avatar || '';
    var avatarHTML = avatarSrc ? '<img src="' + xEscape(avatarSrc) + '" alt="">' : getXAvatarHTML(char);

    var profileKey = 'x_ai_profile_' + char.id;
    var cachedProfile = null;
    try { cachedProfile = JSON.parse(localStorage.getItem(profileKey)); } catch(e) {}

    var charComments = [];
    xLoadPosts().forEach(function(p) {
      var pc = xLoadComments(p.id);
      pc.forEach(function(c) {
        if (String(c.authorId) === String(char.id)) charComments.push({ comment: c, post: p });
      });
    });

    var bio = cachedProfile ? cachedProfile.bio : (char.signature || (char.identity && char.identity.bio) || '');
    var ipLocation = cachedProfile ? cachedProfile.ipLocation : '';
    var handle = cachedProfile ? cachedProfile.handle : ('@' + ((char.identity && char.identity.account) || char.handle || char.name));

    var page = document.createElement('div');
    page.id = 'x-char-profile';
    page.className = 'x-profile-page';

    page.innerHTML = buildXProfileHTML({
      coverImg: savedCover || char.coverImage || '',
      avatarHTML: avatarHTML,
      name: char.nick || char.name,
      handle: handle,
      bio: bio,
      ipLocation: ipLocation,
      postCount: posts.length,
      followingCount: randomInt(5, 200),
      followerCount: randomInt(50, 5000),
      likeCount: randomInt(100, 10000),
      showFollow: !isSelf,
      isFollowing: isFollowing,
      showGenBtn: char.type === 'char',
      postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p); }).join('') : '<div class="xh-empty">还没有帖子</div>',
      commentsHTML: charComments.length ? charComments.map(function(item) {
        return '<div class="xh-comment-item"><div class="xh-comment-post-title">回复了 ' + xEscape(item.post.authorName || '匿名') + ' 的帖子</div><div class="xh-comment-text">' + xEscape(item.comment.content) + '</div><div class="xh-comment-time">' + timeAgo(item.comment.createdAt) + '</div></div>';
      }).join('') : '<div class="xh-empty">还没有评论</div>',
      likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
    });

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    // Apply theme
    var settings = xLoadSettings();
    page.classList.toggle('theme-dark', settings.theme === 'dark');

    page.querySelector('.xh-back-btn').onclick = function() { closeXPage('x-char-profile'); };

    if (!cachedProfile && window.callAI) generateAIProfile(char, page);

    page.querySelector('#xh-avatar-wrap').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('avatar_' + char.id, dataUrl);
        page.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
      }, 400);
    };
    page.querySelector('#xh-cover-btn').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('cover_' + char.id, dataUrl);
        page.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')';
      }, 800);
    };

    var followBtn = page.querySelector('#x-char-follow-btn');
    if (followBtn) {
      followBtn.onclick = function() {
        try {
          var nowFollowing = xToggleFollow(user.id, char.id);
          followBtn.textContent = nowFollowing ? '已关注' : '+ 关注';
          followBtn.classList.toggle('following', nowFollowing);
        } catch(e) {}
      };
    }

    var genBtn = page.querySelector('#x-gen-5-posts');
    if (genBtn) {
      genBtn.onclick = function() {
        try {
          genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';
          genBtn.disabled = true;
          generate5PostsForChar(char).then(function() {
            genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子';
            genBtn.disabled = false;
            var postsEl = page.querySelector('#xh-tab-posts');
            var newPosts = xLoadPosts().filter(function(p) { return String(p.authorId) === String(char.id); });
            postsEl.innerHTML = newPosts.map(function(p) { return buildXPostCard(p); }).join('');
            bindPostCardEvents(postsEl, user);
          }).catch(function() {
            genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子';
            genBtn.disabled = false;
          });
        } catch(e) {}
      };
    }

    // Tab switching
    page.querySelectorAll('.xh-tab').forEach(function(tab) {
      tab.onclick = function() {
        try {
          page.querySelectorAll('.xh-tab').forEach(function(t) { t.classList.remove('active'); });
          page.querySelectorAll('.xh-tab-panel').forEach(function(c) { c.classList.remove('active'); });
          tab.classList.add('active');
          page.querySelector('#xh-tab-' + tab.dataset.tab).classList.add('active');
        } catch(e) {}
      };
    });

    bindPostCardEvents(page.querySelector('#xh-tab-posts'), user);
  } catch(e) { console.error('[X] renderXCharProfilePage error:', e); }
}

// AI profile generation
async function generateAIProfile(char, page) {
  try {
    if (!window.callAI) return;
    var profileKey = 'x_ai_profile_' + char.id;

    var prompt = '你是' + char.name + '。' + ((char.identity && char.identity.bio) || char.signature || '') + '\n\n' +
      '请为自己填写社交媒体个人资料。\n\n' +
      '返回JSON：\n' +
      '{"bio":"一句话简介(20字以内)","ipLocation":"省份或城市","handle":"@英文账号"}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;
    if (!data) return;

    var profile = {
      bio: String(data.bio || '').slice(0, 30),
      ipLocation: String(data.ipLocation || '').slice(0, 10),
      handle: String(data.handle || '@' + char.name).slice(0, 20)
    };
    localStorage.setItem(profileKey, JSON.stringify(profile));

    if (page) {
      var bioEl = page.querySelector('.xh-bio');
      var handleEl = page.querySelector('.xh-handle');
      var ipEl = page.querySelector('.xh-ip');
      if (bioEl && profile.bio) bioEl.textContent = profile.bio;
      if (handleEl && profile.handle) handleEl.textContent = profile.handle;
      if (ipEl && profile.ipLocation) ipEl.innerHTML = '<i class="fa-solid fa-location-dot"></i> IP属地：' + profile.ipLocation;
    }
  } catch(e) { console.warn('[X] AI profile gen failed:', e); }
}

// XX profile
function showXXProfile(user) {
  try {
    var existing = document.getElementById('x-char-profile');
    if (existing) existing.remove();

    var char = X_XX_CHARACTER;
    var posts = xLoadPosts().filter(function(p) { return p.authorId === char.id; });
    var savedAvatar = xLoadImage('avatar_' + char.id);
    var savedCover = xLoadImage('cover_' + char.id);
    var avatarHTML = savedAvatar ? '<img src="' + xEscape(savedAvatar) + '" alt="">' : buildXDefaultAvatar('X');

    var page = document.createElement('div');
    page.id = 'x-char-profile';
    page.className = 'x-profile-page';

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
      postsHTML: posts.length ? posts.map(function(p) { return buildXPostCard(p); }).join('') : '<div class="xh-empty">还没有帖子</div>',
      commentsHTML: '<div class="xh-empty">还没有评论</div>',
      likesHTML: '<div class="xh-empty">还没有点赞的帖子</div>'
    });

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    var settings = xLoadSettings();
    page.classList.toggle('theme-dark', settings.theme === 'dark');

    page.querySelector('.xh-back-btn').onclick = function() { closeXPage('x-char-profile'); };

    page.querySelector('#xh-avatar-wrap').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('avatar_' + char.id, dataUrl);
        page.querySelector('#xh-avatar-wrap').innerHTML = '<img src="' + dataUrl + '" alt=""><div class="xh-avatar-badge"><i class="fa-solid fa-camera"></i></div>';
      }, 400);
    };
    page.querySelector('#xh-cover-btn').onclick = function() {
      xPickImage(function(dataUrl) {
        xSaveImage('cover_' + char.id, dataUrl);
        page.querySelector('#xh-cover').style.backgroundImage = 'url(' + dataUrl + ')';
      }, 800);
    };

    var genBtn = page.querySelector('#x-gen-5-posts');
    if (genBtn) {
      genBtn.onclick = function() {
        try {
          genBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';
          genBtn.disabled = true;
          generate5PostsForChar(char).then(function() {
            genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子';
            genBtn.disabled = false;
            var postsEl = page.querySelector('#xh-tab-posts');
            var newPosts = xLoadPosts().filter(function(p) { return p.authorId === char.id; });
            postsEl.innerHTML = newPosts.map(function(p) { return buildXPostCard(p); }).join('');
            bindPostCardEvents(postsEl, user);
          }).catch(function() {
            genBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成5篇帖子';
            genBtn.disabled = false;
          });
        } catch(e) {}
      };
    }

    page.querySelectorAll('.xh-tab').forEach(function(tab) {
      tab.onclick = function() {
        try {
          page.querySelectorAll('.xh-tab').forEach(function(t) { t.classList.remove('active'); });
          page.querySelectorAll('.xh-tab-panel').forEach(function(c) { c.classList.remove('active'); });
          tab.classList.add('active');
          page.querySelector('#xh-tab-' + tab.dataset.tab).classList.add('active');
        } catch(e) {}
      };
    });

    bindPostCardEvents(page.querySelector('#xh-tab-posts'), user);
  } catch(e) { console.error('[X] showXXProfile error:', e); }
}

// Generate 5 posts for character
async function generate5PostsForChar(char) {
  try {
    if (!window.callAI) return;

    var npcSample = X_NPC_TYPES.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 6).map(function(n) { return n.id + '.' + n.name + '(' + n.style + ')'; }).join('\n');

    var prompt = '你是社交媒体内容生成器。为以下角色生成5条帖子，每条帖子都要有完整的评论互动。\n\n' +
      '发帖人：' + char.name + '（' + ((char.description || (char.identity && char.identity.bio) || char.signature || '普通用户')) + '）\n\n' +
      '帖子分类：\n' +
      X_CATEGORIES.map(function(c) { return c.id + '.' + c.name; }).join('\n') + '\n\n' +
      '可用NPC人设：\n' + npcSample + '\n\n' +
      '要求：\n' +
      '1. 每条帖子30-80字，真实自然\n' +
      '2. 每条帖子5条评论，来自不同NPC\n' +
      '3. 发帖人回复2-3条评论\n' +
      '4. 形成3层对话链\n\n' +
      '返回JSON：\n' +
      '{"posts":[{"content":"帖子","tags":["标签"],"category":1,"comments":[{"name":"NPC","content":"评论","replyToIndex":-1},{"name":"' + char.name + '","content":"回复","replyToIndex":0,"isAuthorReply":true}]}]}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    var allPosts = xLoadPosts();
    var savedCount = 0;
    if (data.posts) {
      data.posts.forEach(function(p, i) {
        if (!p || !p.content) return;
        var postId = xGenId();
        allPosts.push({
          id: postId,
          authorId: String(char.id),
          authorName: char.nick || char.name,
          authorHandle: '@' + ((char.identity && char.identity.account) || char.name),
          authorAvatar: char.avatar || null,
          content: p.content,
          tags: p.tags || [],
          category: p.category || randomPick(X_CATEGORIES).id,
          isAnonymous: false,
          engagement: generateEngagement(),
          createdAt: new Date(Date.now() - i * 3600000).toISOString()
        });
        savedCount++;

        if (p.comments && p.comments.length) {
          var comments = [];
          p.comments.forEach(function(c, ci) {
            var isAuthorReply = c.isAuthorReply || false;
            var npcType = randomPick(X_NPC_TYPES);
            var commentObj = {
              id: xGenId(),
              authorId: isAuthorReply ? String(char.id) : ('npc_' + xGenId()),
              authorName: isAuthorReply ? (char.nick || char.name) : (c.name || npcType.name),
              authorHandle: isAuthorReply ? ('@' + ((char.identity && char.identity.account) || char.name)) : ('@user-' + String(ci).slice(-4)),
              authorAvatar: isAuthorReply ? (char.avatar || null) : null,
              isNpc: !isAuthorReply,
              npcType: isAuthorReply ? null : npcType,
              content: c.content,
              stats: generateCommentStats(),
              createdAt: new Date(Date.now() - i * 3600000 + ci * 60000).toISOString(),
              isReply: false
            };
            if (c.replyToIndex >= 0 && c.replyToIndex < comments.length) {
              commentObj.replyTo = comments[c.replyToIndex].id;
              commentObj.replyToName = comments[c.replyToIndex].authorName;
              commentObj.isReply = true;
            }
            comments.push(commentObj);
          });
          xSaveComments(postId, comments);
        }
      });
      xSavePosts(allPosts);
    }
    showToastLong('已生成 ' + savedCount + ' 条帖子', 3000);
  } catch(e) {
    console.error('[X] generate5PostsForChar error:', e);
    showToastLong('生成失败：' + (e.message || '未知错误'), 3000);
  }
}

// ===== Settings Page =====
function showXSettingsPage(user) {
  try {
    var existing = document.getElementById('x-settings-page');
    if (existing) existing.remove();
    var settings = xLoadSettings();

    var page = document.createElement('div');
    page.id = 'x-settings-page';
    page.className = 'x-settings-page';

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
            '<div class="x-interval-options">' +
              '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===120?' active':'') + '" data-val="120">2小时</button>' +
              '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===240?' active':'') + '" data-val="240">4小时</button>' +
              '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===360?' active':'') + '" data-val="360">6小时</button>' +
              '<button class="x-interval-btn' + ((settings.autoPostInterval||240)===600?' active':'') + '" data-val="600">10小时</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="x-settings-section">' +
          '<div class="x-settings-section-title">评论设置</div>' +
          '<div class="x-settings-row">' +
            '<div><div class="x-settings-row-label">每帖评论数量</div><div class="x-settings-row-desc">4~5条</div></div>' +
            '<input class="input-field" type="number" id="x-comment-count-input" value="' + (settings.commentCount || 5) + '" min="4" max="5" style="width:60px;min-height:36px;text-align:center">' +
          '</div>' +
        '</div>' +
        '<div class="x-settings-section">' +
          '<div class="x-settings-section-title">AI角色管理</div>' +
          '<div class="x-char-checklist" id="x-char-checklist"></div>' +
        '</div>' +
      '</div>';

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    page.classList.toggle('theme-dark', settings.theme === 'dark');

    page.querySelector('.x-settings-back').onclick = function() { closeXPage('x-settings-page'); };

    page.querySelectorAll('.x-theme-btn').forEach(function(btn) {
      btn.onclick = function() {
        try {
          settings.theme = btn.dataset.theme;
          xSaveSettings(settings);
          applyXTheme(settings.theme);
          page.querySelectorAll('.x-theme-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
        } catch(e) {}
      };
    });

    page.querySelector('#x-auto-post-toggle').onclick = function() {
      try {
        settings.autoPost = !settings.autoPost;
        xSaveSettings(settings);
        this.classList.toggle('on', settings.autoPost);
      } catch(e) {}
    };

    page.querySelectorAll('.x-interval-btn').forEach(function(btn) {
      btn.onclick = function() {
        try {
          page.querySelectorAll('.x-interval-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          settings.autoPostInterval = parseInt(btn.dataset.val);
          xSaveSettings(settings);
        } catch(e) {}
      };
    });

    page.querySelector('#x-comment-count-input').onchange = function() {
      try {
        settings.commentCount = Math.max(4, Math.min(5, parseInt(this.value) || 5));
        xSaveSettings(settings);
      } catch(e) {}
    };

    loadXCharChecklist(page, settings);
  } catch(e) { console.error('[X] showXSettingsPage error:', e); }
}

function loadXCharChecklist(page, settings) {
  try {
    var container = page.querySelector('#x-char-checklist');
    if (!window.db || !db.characters) return;
    var enabledChars = settings.enabledChars || [];

    db.characters.where('type').equals('char').toArray().then(function(chars) {
      try {
        container.innerHTML = chars.map(function(c) {
          var checked = enabledChars.indexOf(String(c.id)) !== -1 || enabledChars.length === 0;
          return '<div class="x-char-check-item" data-char-id="' + c.id + '">' +
            '<div class="x-char-check-avatar">' + getXAvatarHTML(c) + '</div>' +
            '<div class="x-char-check-name">' + xEscape(c.nick || c.name) + '</div>' +
            '<div class="x-char-check-box' + (checked ? ' checked' : '') + '"></div>' +
          '</div>';
        }).join('');

        container.querySelectorAll('.x-char-check-item').forEach(function(item) {
          item.onclick = function() {
            try {
              var box = item.querySelector('.x-char-check-box');
              var cid = item.dataset.charId;
              box.classList.toggle('checked');
              if (box.classList.contains('checked')) {
                if (enabledChars.indexOf(cid) === -1) enabledChars.push(cid);
              } else {
                enabledChars = enabledChars.filter(function(id) { return id !== cid; });
              }
              settings.enabledChars = enabledChars;
              xSaveSettings(settings);
            } catch(e) {}
          };
        });
      } catch(e) {}
    });
  } catch(e) {}
}

// Apply theme
function applyXTheme(theme) {
  try {
    var isDark = theme === 'dark';
    var xIds = ['x-page','x-settings-page','x-detail-page','x-compose',
      'x-login-page','x-char-profile','x-profile-edit-page','x-gen-dialog','x-follow-list-panel'];
    xIds.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('theme-dark', isDark);
    });
  } catch(e) {}
}

// Theme observer for new X pages
try {
  var _xThemeObserver = new MutationObserver(function(mutations) {
    try {
      var settings = xLoadSettings();
      var isDark = settings.theme === 'dark';
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          try {
            if (node.nodeType !== 1) return;
            if (node.id && node.id.indexOf('x-') === 0) {
              node.classList.toggle('theme-dark', isDark);
            }
            if (node.querySelectorAll) {
              node.querySelectorAll('[id^="x-"]').forEach(function(el) {
                el.classList.toggle('theme-dark', isDark);
              });
            }
          } catch(e) {}
        });
      });
    } catch(e) {}
  });
  var _xThemeTarget = document.getElementById('app') || document.body;
  _xThemeObserver.observe(_xThemeTarget, { childList: true, subtree: true });
} catch(e) {}

// ===== Profile Edit =====
function showXProfileEdit(user) {
  try {
    var existing = document.getElementById('x-profile-edit-page');
    if (existing) existing.remove();

    var page = document.createElement('div');
    page.id = 'x-profile-edit-page';
    page.className = 'x-profile-edit-page';

    var sig = '';
    try { var p = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id)); if (p && p.signature) sig = p.signature; } catch(e) {}
    var ip = '';
    try { var p2 = JSON.parse(localStorage.getItem(X_PROFILE_PREFIX + user.id)); if (p2 && p2.ipLocation) ip = p2.ipLocation; } catch(e) {}

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
        '<label class="x-profile-edit-field">个性签名<input class="input-field" id="x-edit-sig" value="' + xEscape(sig) + '" placeholder="写一句话介绍自己"></label>' +
        '<label class="x-profile-edit-field">IP属地<input class="input-field" id="x-edit-ip" value="' + xEscape(ip) + '" placeholder="例如: 浙江、广东、北京"></label>' +
      '</div>';

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);

    var settings = xLoadSettings();
    page.classList.toggle('theme-dark', settings.theme === 'dark');

    page.querySelector('.x-profile-edit-back').onclick = function() { closeXPage('x-profile-edit-page'); };
    page.querySelector('.x-profile-edit-save').onclick = function() {
      try {
        var profileKey = X_PROFILE_PREFIX + user.id;
        var profile = {
          name: page.querySelector('#x-edit-name').value.trim() || getXUserName(user),
          handle: page.querySelector('#x-edit-handle').value.trim(),
          signature: page.querySelector('#x-edit-sig').value.trim(),
          ipLocation: page.querySelector('#x-edit-ip').value.trim()
        };
        localStorage.setItem(profileKey, JSON.stringify(profile));
        closeXPage('x-profile-edit-page');
        var mainPage = document.getElementById('x-page');
        if (mainPage) renderXProfileTab(mainPage, user);
      } catch(e) {}
    };
  } catch(e) { console.error('[X] showXProfileEdit error:', e); }
}

// ===== Generate Posts Dialog =====
async function showXGenPostsDialog(user, genBtn, page) {
  try {
    var old = document.getElementById('x-gen-dialog');
    if (old) old.remove();

    var chars = [];
    try { chars = await db.characters.where('type').equals('char').toArray(); } catch(e) {}

    var dialog = document.createElement('div');
    dialog.id = 'x-gen-dialog';
    dialog.innerHTML =
      '<div class="x-gen-overlay"></div>' +
      '<div class="x-gen-card">' +
        '<div class="x-gen-header">' +
          '<div class="x-gen-title">生成帖子</div>' +
          '<button class="x-gen-close" type="button">' + X_SVG.back + '</button>' +
        '</div>' +
        '<div class="x-gen-section">' +
          '<div class="x-gen-label">选择发帖角色</div>' +
          '<div class="x-gen-chars" id="x-gen-chars">' +
            chars.map(function(c) {
              return '<label class="x-gen-char-pill"><input type="checkbox" data-id="' + c.id + '" checked><span>' + xEscape(c.nick || c.name) + '</span></label>';
            }).join('') +
            (chars.length === 0 ? '<div class="x-gen-hint">暂无角色</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="x-gen-section">' +
          '<div class="x-gen-label">帖子风格</div>' +
          '<textarea class="x-gen-input" id="x-gen-pref" placeholder="例如: 甜蜜恋爱日常、深夜emo感想..." rows="2"></textarea>' +
          '<div class="x-gen-tags">' +
            '<span class="x-gen-tag" data-v="甜蜜恋爱">甜蜜恋爱</span>' +
            '<span class="x-gen-tag" data-v="深夜emo">深夜emo</span>' +
            '<span class="x-gen-tag" data-v="搞笑吐槽">搞笑吐槽</span>' +
            '<span class="x-gen-tag" data-v="生活记录">生活记录</span>' +
          '</div>' +
        '</div>' +
        '<div class="x-gen-actions">' +
          '<button class="x-gen-confirm" type="button">立即生成</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(dialog);

    dialog.querySelectorAll('.x-gen-tag').forEach(function(tag) {
      tag.onclick = function() {
        var input = dialog.querySelector('#x-gen-pref');
        input.value = tag.dataset.v;
        dialog.querySelectorAll('.x-gen-tag').forEach(function(t) { t.classList.remove('active'); });
        tag.classList.add('active');
      };
    });

    dialog.querySelector('.x-gen-close').onclick = function() {
      dialog.classList.add('closing');
      setTimeout(function() { dialog.remove(); }, 200);
    };
    dialog.querySelector('.x-gen-overlay').onclick = function() {
      dialog.classList.add('closing');
      setTimeout(function() { dialog.remove(); }, 200);
    };

    dialog.querySelector('.x-gen-confirm').onclick = async function() {
      try {
        var pref = dialog.querySelector('#x-gen-pref').value.trim();
        var selectedIds = [];
        dialog.querySelectorAll('#x-gen-chars input:checked').forEach(function(cb) {
          selectedIds.push(parseInt(cb.dataset.id));
        });

        // If no character selected, generate from all characters + anonymous
        if (!selectedIds.length) {
          selectedIds = chars.map(function(c) { return c.id; });
        }

        var btn = dialog.querySelector('.x-gen-confirm');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中...';

        try {
          var selectedChars = selectedIds.map(function(id) { return chars.find(function(c) { return c.id === id; }); }).filter(Boolean);
          await generatePostsForChar(selectedChars, pref);
          dialog.classList.add('closing');
          setTimeout(function() { dialog.remove(); }, 200);
          renderXHomeTab(page, user);
          showToast('5条帖子已生成！');
        } catch(err) {
          console.error('[X] post gen failed:', err);
          btn.disabled = false;
          btn.innerHTML = '生成5条帖子';
          showToast('生成失败：' + (err.message || '未知错误'));
        }
      } catch(err) {}
    };
  } catch(e) { console.error('[X] showXGenPostsDialog error:', e); }
}

async function generatePostsForChar(chars, preference) {
  try {
    if (!window.callAI) throw new Error('AI服务未配置');
    if (!Array.isArray(chars)) chars = [chars];

    // Build character info
    var charInfos = chars.map(function(char) {
      var desc = (char.description || (char.identity && char.identity.bio) || char.signature || '').slice(0, 100);
      var rels = (char.relations || []).map(function(r) { return r.desc || r.type || ''; }).filter(Boolean).join('、');
      var personaPeople = [];
      try {
        var m = (char.description || '').match(/(?:闺蜜|朋友|同学|同事|室友|兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|妈妈|爸爸|老师|师傅|老板|上司|邻居|青梅竹马|男朋友|女朋友|老公|老婆|前任|暗恋对象|死党|好友)[叫是名为]?\s*([\u4e00-\u9fa5]{2,4})/g);
        if (m) m.forEach(function(s) { var n = s.replace(/^[^\u4e00-\u9fa5]+/, '').trim(); if (n && n.length >= 2 && personaPeople.indexOf(n) === -1) personaPeople.push(n); });
      } catch(_) {}
      return { id: char.id, name: char.name, nick: char.nick, desc: desc, rels: rels, people: personaPeople, avatar: char.avatar, identity: char.identity };
    });

    var charListStr = charInfos.map(function(c, i) {
      return (i+1) + '. ' + c.name + (c.desc ? '（' + c.desc + '）' : '') + (c.rels ? ' 关系：' + c.rels : '') + (c.people.length ? ' 人设中人物：' + c.people.join('、') : '');
    }).join('\n');

    var prompt = '你是社交媒体内容生成器。请生成5条帖子，每条来自不同的角色，每条都要有完整评论互动。\n\n' +
      '发帖角色列表：\n' + charListStr + '\n\n' +
      (preference ? '风格倾向：' + preference + '\n\n' : '') +
      '要求：\n' +
      '1. 每条帖子30-80字，体现该角色的性格特点\n' +
      '2. 每条帖子5条评论，评论人优先从该角色人设中提到的真实人物中选\n' +
      '3. 每条帖子的发帖人必须回复其中2-3条评论（from字段必须是发帖人名字）\n' +
      '4. 被回复的评论人可以再回复，形成2层对话\n' +
      '5. 如果角色人设中没有提到人物，可以用NPC类型评论\n' +
      '6. 其中1条可以是匿名帖子（isAnonymous:true）\n\n' +
      '返回JSON：\n' +
      '{"posts":[{"authorIndex":0,"content":"帖子","tags":["标签"],"isAnonymous":false,"comments":[{"from":"人名","to":null,"text":"评论"},{"from":"发帖人名","to":"人名","text":"回复"}]}]}';

    var raw = await window.callAI([{role:'user',content:prompt}], {responseFormat:'json_object', charAntiDrift:true});
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g,'').replace(/```/g,'').trim()) : raw;

    if (!data.posts || !data.posts.length) throw new Error('AI未返回帖子');

    var savedCount = 0;
    data.posts.forEach(function(p) {
      if (!p || !p.content) return;
      var ci = (typeof p.authorIndex === 'number' && p.authorIndex >= 0 && p.authorIndex < charInfos.length) ? p.authorIndex : 0;
      var cInfo = charInfos[ci];
      var postId = xGenId();
      var isAnon = !!p.isAnonymous;

      var newPost = {
        id: postId,
        authorId: isAnon ? ('anon_' + xGenId()) : String(cInfo.id),
        authorName: isAnon ? '匿名用户' : (cInfo.nick || cInfo.name),
        authorHandle: isAnon ? '' : ('@' + ((cInfo.identity && cInfo.identity.account) || cInfo.name)),
        authorAvatar: isAnon ? null : (cInfo.avatar || null),
        content: p.content || '',
        tags: p.tags || [],
        category: p.category || randomPick(X_CATEGORIES).id,
        isAnonymous: isAnon,
        engagement: generateEngagement(),
        createdAt: new Date().toISOString()
      };
      xSavePost(newPost);
      savedCount++;

      if (p.comments && p.comments.length) {
        var comments = [];
        p.comments.forEach(function(c, ci2) {
          var isAuthorReply = !isAnon && c.from === cInfo.name;
          var commentObj = {
            id: xGenId(),
            authorId: isAuthorReply ? String(cInfo.id) : ('npc_' + xGenId()),
            authorName: c.from || '路人',
            authorHandle: isAuthorReply ? ('@' + ((cInfo.identity && cInfo.identity.account) || cInfo.name)) : ('@user-' + String(ci2).slice(-4)),
            authorAvatar: isAuthorReply ? (cInfo.avatar || null) : null,
            isNpc: !isAuthorReply,
            npcType: isAuthorReply ? null : randomPick(X_NPC_TYPES),
            content: c.text || c.content || '',
            stats: generateCommentStats(),
            createdAt: new Date(Date.now() + ci2 * 60000).toISOString(),
            isReply: false
          };
          if (c.to && comments.length > 0) {
            var parent = comments.find(function(pc) { return pc.authorName === c.to; });
            if (parent) {
              commentObj.replyTo = parent.id;
              commentObj.replyToName = parent.authorName;
              commentObj.isReply = true;
            }
          }
          comments.push(commentObj);
        });
        xSaveComments(postId, comments);
      }
    });

    console.log('[X] Generated ' + savedCount + ' posts, total in cache:', xLoadPosts().length);
  } catch(e) { console.error('[X] generatePostsForChar error:', e); throw e; }
}

// ===== Auto-Post Scheduler =====
var xAutoPostTimer = null;

function startXAutoPostScheduler(user) {
  try {
    if (xAutoPostTimer) clearInterval(xAutoPostTimer);
    var settings = xLoadSettings();
    if (!settings.autoPost) return;

    var intervalMin = settings.autoPostInterval || 240;
    var intervalMs = intervalMin * 60 * 1000;

    // Catch-up logic
    var lastPost = parseInt(localStorage.getItem(X_LAST_AUTOPOST_KEY)) || 0;
    var now = Date.now();
    if (lastPost > 0) {
      var elapsed = now - lastPost;
      var missed = Math.floor(elapsed / intervalMs);
      if (missed > 0) {
        missed = Math.min(missed, 10);
        if (document.getElementById('x-page')) {
        xAutoPostCatchUp(user, missed, lastPost, intervalMs);
      }
      }
    }

    if (!lastPost) localStorage.setItem(X_LAST_AUTOPOST_KEY, String(now));

    xAutoPostTimer = setInterval(function() { autoPostTick(user); }, intervalMs);
  } catch(e) { console.error('[X] startXAutoPostScheduler error:', e); }
}

async function xAutoPostCatchUp(user, count, baseTime, intervalMs) {
  try {
    if (!window.callAI) return;
    showToastLong('正在补回 ' + count + ' 条帖子...', 4000);
    var settings = xLoadSettings();
    var enabledChars = settings.enabledChars || [];
    var chars = [];
    try {
      var all = await db.characters.where('type').equals('char').toArray();
      chars = enabledChars.length ? all.filter(function(c) { return enabledChars.indexOf(String(c.id)) !== -1; }) : all;
    } catch(e) { showToastLong('补回失败：无法加载角色', 3000); return; }
    if (!chars.length) { showToastLong('补回失败：没有可用角色', 3000); return; }

    var pickedChars = [];
    for (var i = 0; i < count; i++) pickedChars.push(randomPick(chars));

    var npcSample = X_NPC_TYPES.slice().sort(function() { return Math.random() - 0.5; }).slice(0, 6).map(function(n) { return n.id + '.' + n.name + '(' + n.style + ')'; }).join('\n');
    var charDescs = pickedChars.map(function(c, i) { return (i+1) + '. ' + c.name + '（' + (((c.identity && c.identity.bio) || c.signature || '普通用户')).slice(0, 30) + '）'; }).join('\n');
    var categories = X_CATEGORIES.map(function(c) { return c.id + '.' + c.name; }).join('\n');

    var prompt = '你是社交媒体内容生成器。请为以下' + count + '个角色各生成1条帖子，每条帖子都要有完整的评论互动。\n\n' +
      '发帖人：\n' + charDescs + '\n\n' +
      '帖子分类：\n' + categories + '\n\n' +
      '可用NPC人设：\n' + npcSample + '\n\n' +
      '要求：\n' +
      '1. 每条帖子30-80字，真实自然\n' +
      '2. 每条帖子5条评论\n' +
      '3. 发帖人回复1条评论\n' +
      '4. 生成2条NPC互评\n' +
      '5. replyToIndex标记回复关系\n\n' +
      '返回JSON：\n' +
      '{"posts":[{"content":"帖子","tags":["标签"],"category":1,"comments":[{"name":"NPC","content":"评论","replyToIndex":-1},{"name":"发帖人","content":"回复","replyToIndex":0,"isAuthorReply":true}]}]}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;
    if (!data.posts) { showToastLong('补回失败：AI未返回内容', 3000); return; }

    var allPosts = xLoadPosts();
    var newPosts = [];
    data.posts.forEach(function(p, i) {
      if (!p || !p.content) return;
      var char = pickedChars[i] || pickedChars[0];
      var postId = xGenId();
      var post = {
        id: postId,
        authorId: String(char.id),
        authorName: char.nick || char.name,
        authorHandle: '@' + ((char.identity && char.identity.account) || char.name),
        authorAvatar: char.avatar || null,
        content: p.content,
        tags: p.tags || [],
        category: p.category || randomPick(X_CATEGORIES).id,
        isAnonymous: false,
        engagement: generateEngagement(),
        createdAt: new Date(baseTime + (i + 1) * intervalMs).toISOString()
      };
      allPosts.unshift(post);
      newPosts.push(post);

      if (p.comments && p.comments.length) {
        var comments = [];
        p.comments.forEach(function(c, ci) {
          var isAuthorReply = c.isAuthorReply || false;
          var npcType = randomPick(X_NPC_TYPES);
          var commentObj = {
            id: xGenId(),
            authorId: isAuthorReply ? String(char.id) : ('npc_' + xGenId()),
            authorName: isAuthorReply ? (char.nick || char.name) : (c.name || npcType.name),
            authorHandle: isAuthorReply ? ('@' + ((char.identity && char.identity.account) || char.name)) : ('@user-' + String(ci).slice(-4)),
            authorAvatar: isAuthorReply ? (char.avatar || null) : null,
            isNpc: !isAuthorReply,
            npcType: isAuthorReply ? null : npcType,
            content: c.content,
            stats: generateCommentStats(),
            createdAt: new Date(baseTime + (i + 1) * intervalMs + ci * 60000).toISOString(),
            isReply: false
          };
          if (c.replyToIndex >= 0 && c.replyToIndex < comments.length) {
            commentObj.replyTo = comments[c.replyToIndex].id;
            commentObj.replyToName = comments[c.replyToIndex].authorName;
            commentObj.isReply = true;
          }
          comments.push(commentObj);
        });
        xSaveComments(postId, comments);
      }
    });
    xSavePosts(allPosts);
    localStorage.setItem(X_LAST_AUTOPOST_KEY, String(Date.now()));

    showToastLong('补回成功 ' + newPosts.length + ' 条帖子', 3000);

    var page = document.getElementById('x-page');
    if (page) renderXHomeTab(page, user);
  } catch(e) {
    showToastLong('补回失败：' + (e.message || 'API调用出错'), 4000);
    console.error('[X] xAutoPostCatchUp error:', e);
  }
}

async function autoPostTick(user) {
  try {
    if (!window.callAI) return;
    var settings = xLoadSettings();
    if (!settings.autoPost) return;

    var enabledChars = settings.enabledChars || [];
    var chars = [];
    try {
      var all = await db.characters.where('type').equals('char').toArray();
      chars = enabledChars.length ? all.filter(function(c) { return enabledChars.indexOf(String(c.id)) !== -1; }) : all;
    } catch(e) { return; }
    if (!chars.length) return;

    var char = randomPick(chars);
    var category = randomPick(X_CATEGORIES);

    var prompt = '你是' + char.name + '。' + (((char.identity && char.identity.bio) || char.signature || '')) + '\n\n' +
      '请发一条社交媒体帖子，分类：' + category.name + '\n' +
      '要求：30-80字，真实自然。\n' +
      '返回JSON：{"content":"帖子内容"}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    var post = {
      id: xGenId(),
      authorId: String(char.id),
      authorName: char.nick || char.name,
      authorHandle: '@' + ((char.identity && char.identity.account) || char.name),
      authorAvatar: char.avatar || null,
      content: data.content,
      category: category.id,
      isAnonymous: false,
      engagement: generateEngagement(),
      createdAt: new Date().toISOString()
    };

    var posts = xLoadPosts();
    posts.unshift(post);
    xSavePosts(posts);
    localStorage.setItem(X_LAST_AUTOPOST_KEY, String(Date.now()));

    generateAIComments(post, user);

    var page = document.getElementById('x-page');
    if (page) renderXHomeTab(page, user);
  } catch(e) { console.error('[X] autoPostTick error:', e); }
}
