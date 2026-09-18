// ensemble.js - 群像模块（一体化）
// 参考：SillyTavern group-chats.js 架构
// 功能：账号选择、角色多选、见面模式、剧本模式、动态人员

window.showEnsemblePage = async function() {
  window.toast && window.toast('群像打开中...');
  try {
    var old = document.getElementById('ens-page');
    if (old) old.remove();

    var page = document.createElement('div');
    page.id = 'ens-page';
    page.className = 'full-page ens-page';
    page.innerHTML =
      '<div class="page-header ens-header">' +
        '<button class="header-back" id="ens-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="header-title" id="ens-title">群像</span>' +
        '<button class="btn-icon" id="ens-settings-btn" style="display:none"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
      '</div>' +
      '<div class="ens-body" id="ens-body"></div>';

    page.querySelector('#ens-back').onclick = function() { handleBack(page); };
    window.openPage(page);
    await renderAccounts(page);
  } catch(e) {
    console.error('[ensemble] open error:', e);
    window.toast && window.toast('群像打开失败');
  }
};

// ===== 状态 =====
var _state = {};

function setState(page, s) {
  _state = Object.assign({}, _state, s);
  var btn = page.querySelector('#ens-settings-btn');
  if (btn) btn.style.display = _state.view === 'chat' ? 'flex' : 'none';
}

function setTitle(page, t) {
  var el = page.querySelector('#ens-title');
  if (el) el.textContent = t;
}

// ===== 返回 =====
function handleBack(page) {
  if (_state.view === 'chat') {
    renderModes(page, _state.uid, _state.chars);
  } else if (_state.view === 'modes') {
    renderChars(page, _state.uid);
  } else if (_state.view === 'chars') {
    renderAccounts(page);
  } else if (_state.view === 'script-settings' || _state.view === 'script-preview' || _state.view === 'script-history') {
    renderModes(page, _state.uid, _state.chars);
  } else {
    window.closePage('ens-page');
  }
}

// ===== 工具 =====
function esc(s) {
  if (typeof wcEscHtml === 'function') return wcEscHtml(s);
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function chName(ch) { return ch ? (ch.nick || ch.name || '?') : '?'; }

function avatar(src, name) {
  return src ? '<img src="' + esc(src) + '" alt="">' : '<span>' + esc((name||'?').charAt(0)) + '</span>';
}

// ===== 账号选择 =====
async function renderAccounts(page) {
  setState(page, { view: 'accounts' });
  setTitle(page, '群像');
  var body = page.querySelector('#ens-body');
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

  var users = await db.characters.where('type').equals('user').toArray();
  users.sort(function(a,b) { return (b.id||0)-(a.id||0); });

  if (!users.length) {
    body.innerHTML = '<div class="ens-empty"><div class="ens-empty-icon"><i class="fa fa-user-plus"></i></div><div class="ens-empty-title">还没有微信账号</div><div class="ens-empty-desc">请先在微信里创建账号</div></div>';
    return;
  }

  var h = '<div class="ens-page-header"><div class="ens-page-icon"><i class="fa-solid fa-users-viewfinder"></i></div><div class="ens-page-title">选择身份</div><div class="ens-page-desc">选择微信账号开始群像</div></div><div class="miss-list">';
  users.forEach(function(u) {
    h += '<button class="miss-row" data-uid="' + u.id + '">' +
      '<div class="miss-avatar">' + avatar(u.avatar, u.name) + '</div>' +
      '<div class="miss-row-main"><div class="miss-row-title">' + esc(u.name) + '</div><div class="miss-row-sub">' + esc(u.description || '微信账号') + '</div></div>' +
      '<i class="fa fa-angle-right"></i></button>';
  });
  h += '</div>';
  body.innerHTML = h;
  body.querySelectorAll('.miss-row').forEach(function(r) {
    r.onclick = function() { renderChars(page, parseInt(r.dataset.uid)); };
  });
}

// ===== 角色选择 =====
async function renderChars(page, uid) {
  setState(page, { view: 'chars', uid: uid });
  setTitle(page, '选择角色');
  var body = page.querySelector('#ens-body');
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

  var chats = (await db.chats.toArray()).filter(function(c) { return c.ownerUid === uid; });
  var items = [];
  for (var i = 0; i < chats.length; i++) {
    var ch = await window.getCharacter(chats[i].charId);
    if (ch) items.push({ chat: chats[i], char: ch });
  }

  if (!items.length) {
    body.innerHTML = '<div class="ens-empty"><div class="ens-empty-icon"><i class="fa fa-user-group"></i></div><div class="ens-empty-title">还没有角色</div><div class="ens-empty-desc">请先在微信里和角色建立私聊</div></div>';
    return;
  }

  var sel = {};
  var h = '<div class="ens-page-header"><div class="ens-empty-icon"><i class="fa-solid fa-user-group"></i></div><div class="ens-page-title">选择角色</div><div class="ens-page-desc">可多选，至少选一个</div></div><div class="miss-list">';
  items.forEach(function(it) {
    h += '<button class="miss-row ens-char-row" data-cid="' + it.char.id + '">' +
      '<div class="miss-avatar">' + avatar(it.char.avatar, chName(it.char)) + '</div>' +
      '<div class="miss-row-main"><div class="miss-row-title">' + esc(chName(it.char)) + '</div><div class="miss-row-sub">' + esc((it.char.description || '').slice(0, 40)) + '</div></div>' +
      '<div class="ens-check"><i class="fa fa-check" style="display:none"></i></div></button>';
  });
  h += '</div><div class="ens-confirm-bar"><button class="btn-pill" id="ens-confirm" disabled>确认选择</button></div>';
  body.innerHTML = h;

  body.querySelectorAll('.ens-char-row').forEach(function(r) {
    r.onclick = function() {
      var cid = parseInt(r.dataset.cid);
      var ci = r.querySelector('.ens-check i');
      if (sel[cid]) { delete sel[cid]; ci.style.display = 'none'; r.classList.remove('selected'); }
      else {
        var it = items.find(function(x) { return x.char.id === cid; });
        sel[cid] = it;
        ci.style.display = 'inline'; r.classList.add('selected');
      }
      body.querySelector('#ens-confirm').disabled = Object.keys(sel).length === 0;
    };
  });

  body.querySelector('#ens-confirm').onclick = function() {
    var chars = Object.values(sel);
    if (chars.length) renderModes(page, uid, chars);
  };
}

// ===== 模式选择 =====
async function renderModes(page, uid, chars) {
  setState(page, { view: 'modes', uid: uid, chars: chars });
  setTitle(page, '选择模式');
  var body = page.querySelector('#ens-body');
  var names = chars.map(function(c) { return chName(c.char); }).join('、');

  body.innerHTML =
    '<div class="ens-page-header"><div class="ens-page-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div><div class="ens-page-title">选择模式</div><div class="ens-page-desc">和 ' + esc(names) + ' 一起开始</div></div>' +
    '<div class="ens-mode-grid">' +
      '<button class="ens-mode-card" data-mode="meet"><div class="ens-mode-icon"><i class="fa-solid fa-people-group"></i></div><div class="ens-mode-title">见面模式</div><div class="ens-mode-desc">多人实时聊天，支持动态增删</div></button>' +
      '<button class="ens-mode-card" data-mode="script"><div class="ens-mode-icon"><i class="fa-solid fa-book-open"></i></div><div class="ens-mode-title">剧本模式</div><div class="ens-mode-desc">AI生成剧本，进入故事世界</div></button>' +
    '</div>';

  body.querySelectorAll('.ens-mode-card').forEach(function(c) {
    c.onclick = function() {
      if (c.dataset.mode === 'meet') enterMeet(page, uid, chars);
      else openScriptSettings(page, uid, chars);
    };
  });
}

// ===== 见面模式 =====
function enterMeet(page, uid, chars) {
  setState(page, { view: 'chat', mode: 'meet', uid: uid, chars: chars, current: chars.slice() });
  setTitle(page, '群像 · ' + chars.length + '人在线');
  renderChat(page);
}

// ===== 聊天渲染 =====
function renderChat(page) {
  var body = page.querySelector('#ens-body');
  body.innerHTML =
    '<div class="ens-chat">' +
      '<div class="ens-chat-log" id="ens-log"></div>' +
      '<div class="ens-compose">' +
        '<button class="ens-compose-btn" id="ens-phone" title="掏出手机"><i class="fa fa-mobile-screen"></i></button>' +
        '<textarea class="ens-input" id="ens-input" placeholder="说点什么..." rows="1"></textarea>' +
        '<button class="ens-send" id="ens-send">发送</button>' +
      '</div>' +
      '<div class="ens-toolbar">' +
        '<button class="ens-tool-btn" id="ens-cast"><i class="fa-solid fa-users"></i> 现场人员</button>' +
      '</div>' +
    '</div>';

  // Info card
  var log = body.querySelector('#ens-log');
  var names = _state.current.map(function(c) { return chName(c.char); }).join('、');
  log.innerHTML = '<div class="ens-chat-info"><div class="ens-chat-info-avatar"><i class="fa-solid fa-' + (_state.mode === 'script' ? 'book-open' : 'people-group') + '"></i></div><div class="ens-chat-info-text"><div class="ens-chat-info-name">' + esc(names) + '</div><div class="ens-chat-info-status">' + (_state.mode === 'script' ? '剧本模式' : '见面模式') + ' · ' + _state.current.length + '人</div></div></div>';

  // 加载历史聊天
  loadChatHistory(page);

  if (_state.mode === 'script' && _state.scriptData) {
    addSysMsg(page, '剧本「' + (_state.scriptData.title || '未命名') + '」开始');
    if (_state.scriptData.preview) addSysMsg(page, _state.scriptData.preview);
  }

  // Events
  var phone = body.querySelector('#ens-phone');
  if (phone) phone.onclick = function() { if (window.showWechatPage) window.showWechatPage(); };

  var cast = body.querySelector('#ens-cast');
  if (cast) cast.onclick = function() { showCastModal(page); };

  var input = body.querySelector('#ens-input');
  var sendBtn = body.querySelector('#ens-send');
  if (input) {
    input.oninput = function() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 100) + 'px'; };
    input.onkeydown = function(e) {
      var isSend = window.isWanWanSendKeyEvent ? window.isWanWanSendKeyEvent(e) : (e.key === 'Enter' && !e.shiftKey && !e.isComposing);
      if (isSend) { e.preventDefault(); doSend(page); }
    };
  }
  if (sendBtn) sendBtn.onclick = function() { doSend(page); };
}

// ===== 发送 =====
async function doSend(page) {
  if (_state.sending) return;
  var input = page.querySelector('#ens-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  input.value = '';
  input.style.height = 'auto';

  addMsg(page, 'user', text);
  _state.sending = true;
  showTyping(page);

  try {
    var sys = buildGroupPrompt(_state.current, _state.mode, _state.scriptData);
    var msgs = [{ role: 'system', content: sys }];
    var hist = (_state.history || []).slice(-20);
    msgs = msgs.concat(hist);
    msgs.push({ role: 'user', content: text });

    var reply = await window.callAI(msgs, { charAntiDrift: true });
    _state.history = (_state.history || []).concat([
      { role: 'user', content: text },
      { role: 'assistant', content: reply }
    ]);
    addMsg(page, 'ai', reply);
  } catch(e) {
    console.error('[ensemble] send error:', e);
    window.toast && window.toast('回复失败');
  } finally {
    _state.sending = false;
    hideTyping(page);
  }
}

// ===== 构建群聊提示词（参考SillyTavern） =====
function buildGroupPrompt(chars, mode, scriptData) {
  var p = '';

  if (mode === 'script' && scriptData) {
    p += '你是剧本演绎引擎。当前剧本：「' + (scriptData.title || '') + '」\n';
    p += '前提：' + (scriptData.premise || '') + '\n';
    if (scriptData.theme) p += '主题：' + scriptData.theme + '\n';
    p += '\n';
  } else {
    p += '你是多人场景的故事叙述者和角色扮演者。\n\n';
  }

  // SillyTavern风格：收集所有角色信息
  p += '## 当前在场角色\n\n';
  chars.forEach(function(c, i) {
    var ch = c.char;
    p += '### 角色' + (i+1) + '：' + chName(ch) + '\n';
    if (ch.description) p += '人设：' + ch.description.slice(0, 300) + '\n';
    if (ch.personality) p += '性格：' + ch.personality.slice(0, 150) + '\n';
    if (ch.first_mes) p += '第一句话风格参考：' + ch.first_mes.slice(0, 100) + '\n';
    p += '\n';
  });

  p += '## 用户\n用户（我）正在与这些角色互动。\n\n';

  p += '## 回复格式\n';
  p += '每次回复是一张卡片，混合以下内容：\n';
  p += '- 环境/旁白：灰色描述\n';
  p += '- 角色动作：「角色名 动作」，灰色斜体\n';
  p += '- 角色对白：「"对话内容"」，黑色粗体\n';
  p += '让角色自然互动，每次回复包含多个角色。200-500字。\n';

  // 世界书注入
  try { if (window._BUILTIN_ANTI_DRIFT_LORE) p += '\n\n' + window._BUILTIN_ANTI_DRIFT_LORE; } catch(e){}
  try { if (window._BUILTIN_PLOT_FIRST_LORE) p += '\n\n' + window._BUILTIN_PLOT_FIRST_LORE; } catch(e){}

  return p;
}

// ===== 消息渲染 =====
function addMsg(page, role, text) {
  var log = page.querySelector('#ens-log');
  if (!log) return;
  var div = document.createElement('div');
  div.className = 'ens-msg ' + (role === 'user' ? 'is-user' : 'is-ai');
  if (role === 'user') {
    div.innerHTML = '<div class=ens-msg-card><div class=ens-msg-text>' + esc(text) + '</div></div>';
  } else {
    var chars = _state.current || [];
    var firstChar = chars.length > 0 ? chars[0].char : null;
    var ch = firstChar || {};
    var avatarHtml = ch.avatar ? '<img src= + esc(ch.avatar) +  alt=>' : '<span>' + esc(chName(ch).charAt(0)) + '</span>';
    div.innerHTML =
      '<div class=ens-msg-card ens-card-ai>' +
        '<div class=ens-card-head>' +
          '<div class=ens-card-avatar>' + avatarHtml + '</div>' +
          '<div class=ens-card-name>' + esc(chName(ch)) + '</div>' +
          '<div class=ens-card-role>群像</div>' +
        '</div>' +
        '<div class=ens-card-body>' + parseCard(text) + '</div>' +
      '</div>';
  }
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  saveChatMsg(role, text);
}


function addSysMsg(page, text) {
  var log = page.querySelector('#ens-log');
  if (!log) return;
  var div = document.createElement('div');
  div.className = 'ens-system-msg';
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function parseCard(text) {
  if (!text) return '';
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  var h = '';
  lines.forEach(function(line) {
    var t = line.trim();
    if (!t) return;
    if (t.indexOf('「') !== -1 && t.indexOf('」') !== -1) {
      h += '<div class="dialogue-text">' + esc(t) + '</div>';
    } else if (isAction(t)) {
      h += '<div class="action-text">' + esc(t) + '</div>';
    } else {
      h += '<div class="env-text">' + esc(t) + '</div>';
    }
  });
  return h;
}

function isAction(line) {
  var kw = ['轻轻','缓缓','看向','站起','坐下','转身','微笑','皱眉','点头','摇头','叹了口气','伸出手','低下头','抬起'];
  for (var i = 0; i < kw.length; i++) { if (line.indexOf(kw[i]) !== -1) return true; }
  var chars = _state.current || [];
  for (var j = 0; j < chars.length; j++) {
    var n = chName(chars[j].char);
    if (line.indexOf(n) === 0 && line.indexOf('「') === -1) return true;
  }
  return false;
}

function showTyping(page) {
  var log = page.querySelector('#ens-log');
  if (!log) return;
  var el = document.createElement('div');
  el.className = 'ens-typing';
  el.id = 'ens-typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  log.appendChild(el);
  log.scrollTop = log.scrollHeight;
}

function hideTyping(page) {
  var el = page.querySelector('#ens-typing');
  if (el) el.remove();
}

// ===== 人员管理 =====
function showCastModal(page) {
  var all = _state.chars || [];
  var cur = _state.current || [];

  var overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  var modal = document.createElement('div');
  modal.className = 'center-modal ens-personnel-modal';

  var h = '<div class="sheet-title">现场人员</div><div class="ens-personnel-list">';
  h += '<div class="ens-section-label">在场</div>';
  cur.forEach(function(c) {
    h += '<div class="ens-person-row"><div class="miss-avatar">' + avatar(c.char.avatar, chName(c.char)) + '</div><div class="ens-person-name">' + esc(chName(c.char)) + '</div><button class="ens-remove-btn" data-cid="' + c.char.id + '">移除</button></div>';
  });
  h += '<div class="ens-section-label">不在场</div>';
  all.filter(function(c) { return !cur.find(function(x) { return x.char.id === c.char.id; }); }).forEach(function(c) {
    h += '<div class="ens-person-row"><div class="miss-avatar">' + avatar(c.char.avatar, chName(c.char)) + '</div><div class="ens-person-name">' + esc(chName(c.char)) + '</div><button class="ens-add-btn" data-cid="' + c.char.id + '">加入</button></div>';
  });
  h += '</div><div class="sheet-actions"><button class="btn-pill btn-full" id="ens-cast-close">关闭</button></div>';
  modal.innerHTML = h;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  requestAnimationFrame(function() { overlay.classList.add('show'); modal.classList.add('show'); });

  function close() {
    overlay.classList.remove('show'); modal.classList.remove('show');
    setTimeout(function() { overlay.remove(); modal.remove(); }, 300);
  }

  modal.querySelectorAll('.ens-remove-btn').forEach(function(b) {
    b.onclick = function() {
      var cid = parseInt(b.dataset.cid);
      var ch = cur.find(function(x) { return x.char.id === cid; });
      _state.current = cur.filter(function(x) { return x.char.id !== cid; });
      if (ch) addSysMsg(page, chName(ch.char) + ' 离开了聊天');
      close(); showCastModal(page);
      setTitle(page, '群像 · ' + _state.current.length + '人在线');
    };
  });

  modal.querySelectorAll('.ens-add-btn').forEach(function(b) {
    b.onclick = function() {
      var cid = parseInt(b.dataset.cid);
      var ch = all.find(function(x) { return x.char.id === cid; });
      if (ch) { _state.current.push(ch); addSysMsg(page, chName(ch.char) + ' 加入了聊天'); }
      close(); showCastModal(page);
      setTitle(page, '群像 · ' + _state.current.length + '人在线');
    };
  });

  modal.querySelector('#ens-cast-close').onclick = close;
  overlay.onclick = close;
}

// ===== 剧本设置 =====
var SCRIPT_CFG = 'ens_script_cfg';
var SCRIPT_HIST = 'ens_script_hist';

async function getScriptCfg(uid) { try { var r = await db.config.get(SCRIPT_CFG + '_' + uid); return r ? r.value : null; } catch(e) { return null; } }
async function saveScriptCfg(uid, c) { try { await db.config.put({ key: SCRIPT_CFG + '_' + uid, value: c }); } catch(e) {} }
async function getScriptHist(uid) { try { var r = await db.config.get(SCRIPT_HIST + '_' + uid); return r ? r.value : []; } catch(e) { return []; } }
async function saveScriptHist(uid, d) { try { var h = await getScriptHist(uid); h.unshift(Object.assign({}, d, { savedAt: Date.now() })); if (h.length > 20) h.length = 20; await db.config.put({ key: SCRIPT_HIST + '_' + uid, value: h }); } catch(e) {} }

function openScriptSettings(page, uid, chars) {
  setState(page, { view: 'script-settings', uid: uid, chars: chars });
  setTitle(page, '剧本设置');
  var body = page.querySelector('#ens-body');

  body.innerHTML =
    '<div class="ens-page-header"><div class="ens-page-icon"><i class="fa-solid fa-book-open"></i></div><div class="ens-page-title">剧本设置</div><div class="ens-page-desc">设置参数，AI生成剧本</div></div>' +
    '<div class="ens-script-settings">' +
      '<div class="miss-section-title">叙事视角</div>' +
      '<div class="ens-radio-group">' +
        '<label class="ens-radio-item"><input type="radio" name="ens-p" value="first"><span>第一人称</span></label>' +
        '<label class="ens-radio-item"><input type="radio" name="ens-p" value="third" checked><span>第三人称</span></label>' +
      '</div>' +
      '<div class="miss-section-title">写作风格</div>' +
      '<div class="ens-radio-group">' +
        '<label class="ens-radio-item"><input type="radio" name="ens-s" value="daily" checked><span>轻松日常</span></label>' +
        '<label class="ens-radio-item"><input type="radio" name="ens-s" value="mystery"><span>悬疑推理</span></label>' +
        '<label class="ens-radio-item"><input type="radio" name="ens-s" value="fantasy"><span>奇幻冒险</span></label>' +
        '<label class="ens-radio-item"><input type="radio" name="ens-s" value="romance"><span>虐心言情</span></label>' +
      '</div>' +
      '<div class="miss-section-title">世界书</div>' +
      '<div class="ens-toggle-row"><span>Apollo Protocol</span><label class="ens-toggle"><input type="checkbox" id="ens-wb"><span class="ens-toggle-slider"></span></label></div>' +
      '<div class="miss-section-title">故事主题</div>' +
      '<input type="text" class="ens-input-field" id="ens-theme" placeholder="如：校园恋爱">' +
      '<div class="miss-section-title">额外设定</div>' +
      '<textarea class="ens-textarea-field" id="ens-extra" placeholder="额外要求"></textarea>' +
      '<div class="ens-settings-actions">' +
        '<button class="btn-pill" id="ens-gen">生成剧本</button>' +
        '<button class="btn-ghost" id="ens-hist">历史剧本</button>' +
      '</div>' +
    '</div>';

  body.querySelector('#ens-gen').onclick = function() { generateScript(page, uid, chars); };
  body.querySelector('#ens-hist').onclick = function() { showHistory(page, uid, chars); };
}

async function generateScript(page, uid, chars) {
  var body = page.querySelector('#ens-body');
  var p = body.querySelector('input[name="ens-p"]:checked');
  var s = body.querySelector('input[name="ens-s"]:checked');
  var wb = body.querySelector('#ens-wb');
  var th = body.querySelector('#ens-theme');
  var ex = body.querySelector('#ens-extra');
  var cfg = { p: p ? p.value : 'third', s: s ? s.value : 'daily', wb: wb ? wb.checked : false, theme: th ? th.value.trim() : '', extra: ex ? ex.value.trim() : '' };
  await saveScriptCfg(uid, cfg);

  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div><div style="text-align:center;color:#8a8a8a;margin-top:12px;">AI生成剧本中...</div>';

  try {
    var descs = chars.map(function(c) { return c.char.name + '：' + (c.char.description || '无'); }).join('\n');
    var sn = { daily:'轻松日常', mystery:'悬疑推理', fantasy:'奇幻冒险', romance:'虐心言情' };
    var prompt = '为以下角色生成剧本框架：\n\n角色：\n' + descs + '\n\n视角：' + (cfg.p==='first'?'第一人称':'第三人称') + '\n风格：' + (sn[cfg.s]||cfg.s) + '\n';
    if (cfg.theme) prompt += '主题：' + cfg.theme + '\n';
    if (cfg.extra) prompt += '额外：' + cfg.extra + '\n';
    prompt += '\n返回JSON：{"title":"","premise":"","characters":[{"name":"","role":"","setting":""}],"preview":"","keywords":[""]}';

    var sys = '你是剧本创作AI，严格返回JSON。';
    try { if (_BUILTIN_ANTI_DRIFT_LORE) sys += '\n\n' + _BUILTIN_ANTI_DRIFT_LORE; } catch(e){}
    try { if (_BUILTIN_PLOT_FIRST_LORE) sys += '\n\n' + _BUILTIN_PLOT_FIRST_LORE; } catch(e){}
    if (cfg.wb && window._APOLLO_PROTOCOL) sys += '\n\n' + window._APOLLO_PROTOCOL;

    var reply = await window.callAI([{ role:'system', content:sys }, { role:'user', content:prompt }], { responseFormat:'json_object', charAntiDrift:true });
    var data = JSON.parse(reply.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim());
    await saveScriptHist(uid, data);
    showScriptPreview(page, uid, chars, cfg, data);
  } catch(e) {
    console.error('[ensemble] generate error:', e);
    window.toast && window.toast('生成失败');
    openScriptSettings(page, uid, chars);
  }
}

function showScriptPreview(page, uid, chars, cfg, data) {
  setState(page, { view: 'script-preview', uid: uid, chars: chars, cfg: cfg, scriptData: data });
  setTitle(page, '剧本预览');
  var body = page.querySelector('#ens-body');

  var h = '<div class="ens-script-preview"><div class="ens-script-title">' + esc(data.title || '未命名') + '</div>';
  h += '<div class="ens-script-section"><div class="ens-script-label">前提</div><div class="ens-script-text">' + esc(data.premise || '') + '</div></div>';
  h += '<div class="ens-script-section"><div class="ens-script-label">角色</div>';
  (data.characters || []).forEach(function(c) { h += '<div class="ens-script-char"><strong>' + esc(c.name) + '</strong> - ' + esc(c.role || '') + '<div class="ens-script-char-desc">' + esc(c.setting || '') + '</div></div>'; });
  h += '</div>';
  h += '<div class="ens-script-section"><div class="ens-script-label">预览</div><div class="ens-script-text">' + esc(data.preview || '') + '</div></div>';
  h += '<div class="ens-script-section"><div class="ens-script-label">关键词</div><div class="ens-keywords">';
  (data.keywords || []).forEach(function(k) { h += '<span class="ens-keyword">#' + esc(k) + '</span>'; });
  h += '</div></div>';
  h += '<div class="ens-script-actions"><button class="btn-pill" id="ens-start">开始剧本</button><button class="btn-ghost" id="ens-retry">重新生成</button></div></div>';
  body.innerHTML = h;

  body.querySelector('#ens-start').onclick = function() {
    _state.scriptData = data;
    _state.mode = 'script';
    enterMeet(page, uid, chars);
  };
  body.querySelector('#ens-retry').onclick = function() { openScriptSettings(page, uid, chars); };
}

async function showHistory(page, uid, chars) {
  setState(page, { view: 'script-history', uid: uid, chars: chars });
  setTitle(page, '历史剧本');
  var body = page.querySelector('#ens-body');
  var list = await getScriptHist(uid);

  if (!list.length) {
    body.innerHTML = '<div class="ens-empty"><div class="ens-empty-icon"><i class="fa fa-clock-rotate-left"></i></div><div class="ens-empty-title">暂无历史剧本</div></div>';
    return;
  }

  var h = '<div class="miss-section-title">历史剧本</div><div class="miss-list">';
  list.forEach(function(s, i) {
    var d = s.savedAt ? new Date(s.savedAt).toLocaleDateString() : '';
    h += '<button class="miss-row" data-i="' + i + '"><div class="miss-row-main"><div class="miss-row-title">' + esc(s.title || '未命名') + '</div><div class="miss-row-sub">' + esc(s.preview || '').slice(0, 50) + '</div></div><div class="ens-history-date">' + esc(d) + '</div></button>';
  });
  h += '</div>';
  body.innerHTML = h;
  body.querySelectorAll('.miss-row').forEach(function(r) {
    r.onclick = function() { var i = parseInt(r.dataset.i); if (list[i]) showScriptPreview(page, uid, chars, {}, list[i]); };
  });
}
// ===== 聊天保存/加载 =====
async function saveChatMsg(role, text) {
  try {
    if (!_state.uid || !db.offlineChats) return;
    await db.offlineChats.add({
      ownerUid: _state.uid,
      chatId: 0,
      charId: _state.current && _state.current[0] ? _state.current[0].char.id : 0,
      mode: 'ensemble',
      role: role,
      content: text,
      createdAt: Date.now()
    });
  } catch(e) { console.error('[ensemble] save:', e); }
}

async function loadChatHistory(page) {
  try {
    if (!_state.uid || !db.offlineChats) return;
    var all = await db.offlineChats.toArray();
    var rows = all.filter(function(m) {
      return m.ownerUid === _state.uid && m.mode === 'ensemble';
    }).sort(function(a, b) { return (a.createdAt||0) - (b.createdAt||0); });
    rows.forEach(function(m) {
      if (m.role === 'user') addMsg(page, 'user', m.content);
      else if (m.role === 'assistant') addMsg(page, 'ai', m.content);
      else if (m.role === 'system') addSysMsg(page, m.content);
    });
  } catch(e) { console.error('[ensemble] load:', e); }
}

async function clearChatHistory() {
  try {
    if (!_state.uid || !db.offlineChats) return;
    var all = await db.offlineChats.toArray();
    var ids = all.filter(function(m) { return m.ownerUid === _state.uid && m.mode === 'ensemble'; }).map(function(m) { return m.id; });
    if (ids.length) await db.offlineChats.bulkDelete(ids);
    _state.history = [];
  } catch(e) { console.error('[ensemble] clear:', e); }
}
