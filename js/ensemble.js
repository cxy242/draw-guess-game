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
      '<div class="ens-header">' +
        '<button class="ens-header-back" id="ens-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="ens-header-title" id="ens-title">群像</span>' +
      '</div>' +
      '<div class="ens-body" id="ens-body"></div>';

    var backBtn = page.querySelector('#ens-back');
    if (backBtn) backBtn.onclick = function() { handleBack(page); };
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
}

function setTitle(page, t) {
  var el = page.querySelector('.ens-header-title');
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

function chName(ch) {
  return ch ? (ch.nick || ch.name || '?') : '?';
}

function avatarHtml(src, name) {
  if (src) {
    return '<img src="' + esc(src) + '" alt="' + esc(name || '') + '">';
  }
  return '<span>' + esc((name || '?').charAt(0)) + '</span>';
}

function userAvatarHtml(user) {
  var av = _state.userAvatar || (user && user.avatar) || '';
  if (av) {
    return '<img src="' + esc(av) + '" alt="">';
  }
  return '<span>' + esc((_state.userName || '我').charAt(0)) + '</span>';
}

// ===== 账号选择 =====
async function renderAccounts(page) {
  setState(page, { view: 'accounts' });
  setTitle(page, '群像');
  var body = page.querySelector('#ens-body');
  if (!body) return;
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

  var users = await db.characters.where('type').equals('user').toArray();
  users.sort(function(a,b) { return (b.id||0)-(a.id||0); });

  if (!users.length) {
    body.innerHTML =
      '<div class="ens-empty">' +
        '<div class="ens-empty-icon"><i class="fa fa-user-plus"></i></div>' +
        '<div class="ens-empty-title">还没有微信账号</div>' +
        '<div class="ens-empty-desc">请先在微信里创建账号</div>' +
      '</div>';
    return;
  }

  var h =
    '<div class="ens-page-header">' +
      '<div class="ens-page-icon"><i class="fa-solid fa-users-viewfinder"></i></div>' +
      '<div class="ens-page-title">选择身份</div>' +
      '<div class="ens-page-desc">选择微信账号开始群像</div>' +
    '</div>' +
    '<div class="miss-list">';
  users.forEach(function(u) {
    h +=
      '<button class="miss-row" data-uid="' + u.id + '">' +
        '<div class="miss-avatar">' + avatarHtml(u.avatar, u.name) + '</div>' +
        '<div class="miss-row-main">' +
          '<div class="miss-row-title">' + esc(u.name) + '</div>' +
          '<div class="miss-row-sub">' + esc(u.description || '微信账号') + '</div>' +
        '</div>' +
        '<i class="fa fa-angle-right"></i>' +
      '</button>';
  });
  h += '</div>';
  body.innerHTML = h;

  body.querySelectorAll('.miss-row').forEach(function(r) {
    r.onclick = function() {
      var uid = parseInt(r.dataset.uid);
      var u = users.find(function(x) { return x.id === uid; });
      _state.userName = u ? (u.name || '我') : '我';
      _state.userAvatar = u ? (u.avatar || '') : '';
      _state.userAvatar = u ? u.avatar : null;
      renderChars(page, uid);
    };
  });
}

// ===== 角色选择 =====
async function renderChars(page, uid) {
  setState(page, { view: 'chars', uid: uid });
  setTitle(page, '选择角色');
  var body = page.querySelector('#ens-body');
  if (!body) return;
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

  var chats = (await db.chats.toArray()).filter(function(c) { return c.ownerUid === uid; });
  var items = [];
  for (var i = 0; i < chats.length; i++) {
    var ch = await window.getCharacter(chats[i].charId);
    if (ch) items.push({ chat: chats[i], char: ch });
  }

  if (!items.length) {
    body.innerHTML =
      '<div class="ens-empty">' +
        '<div class="ens-empty-icon"><i class="fa fa-user-group"></i></div>' +
        '<div class="ens-empty-title">还没有角色</div>' +
        '<div class="ens-empty-desc">请先在微信里和角色建立私聊</div>' +
      '</div>';
    return;
  }

  var sel = {};
  var h =
    '<div class="ens-page-header">' +
      '<div class="ens-page-icon"><i class="fa-solid fa-user-group"></i></div>' +
      '<div class="ens-page-title">选择角色</div>' +
      '<div class="ens-page-desc">可多选，至少选一个</div>' +
    '</div>' +
    '<div class="miss-list">';
  items.forEach(function(it) {
    h +=
      '<button class="miss-row ens-char-row" data-cid="' + it.char.id + '">' +
        '<div class="miss-avatar">' + avatarHtml(it.char.avatar, chName(it.char)) + '</div>' +
        '<div class="miss-row-main">' +
          '<div class="miss-row-title">' + esc(chName(it.char)) + '</div>' +
          '<div class="miss-row-sub">' + esc((it.char.description || '').slice(0, 40)) + '</div>' +
        '</div>' +
        '<div class="ens-check"><i class="fa fa-check" style="display:none"></i></div>' +
      '</button>';
  });
  h +=
    '</div>' +
    '<div class="ens-confirm-bar"><button class="btn-pill" id="ens-confirm" disabled>确认选择</button></div>';
  body.innerHTML = h;

  body.querySelectorAll('.ens-char-row').forEach(function(r) {
    r.onclick = function() {
      var cid = parseInt(r.dataset.cid);
      var ci = r.querySelector('.ens-check i');
      if (sel[cid]) {
        delete sel[cid];
        if (ci) ci.style.display = 'none';
        r.classList.remove('selected');
      } else {
        var it = items.find(function(x) { return x.char.id === cid; });
        sel[cid] = it;
        if (ci) ci.style.display = 'inline';
        r.classList.add('selected');
      }
      var confirmBtn = body.querySelector('#ens-confirm');
      if (confirmBtn) confirmBtn.disabled = Object.keys(sel).length === 0;
    };
  });

  var confirmBtn = body.querySelector('#ens-confirm');
  if (confirmBtn) {
    confirmBtn.onclick = function() {
      var chars = Object.values(sel);
      if (chars.length) renderModes(page, uid, chars);
    };
  }
}

// ===== 模式选择 =====
async function renderModes(page, uid, chars) {
  setState(page, { view: 'modes', uid: uid, chars: chars });
  setTitle(page, '选择模式');
  var body = page.querySelector('#ens-body');
  if (!body) return;
  var names = chars.map(function(c) { return chName(c.char); }).join('、');

  body.innerHTML =
    '<div class="ens-page-header">' +
      '<div class="ens-page-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>' +
      '<div class="ens-page-title">选择模式</div>' +
      '<div class="ens-page-desc">和 ' + esc(names) + ' 一起开始</div>' +
    '</div>' +
    '<div class="ens-mode-grid">' +
      '<button class="ens-mode-card" data-mode="meet">' +
        '<div class="ens-mode-icon"><i class="fa-solid fa-people-group"></i></div>' +
        '<div class="ens-mode-title">见面模式</div>' +
        '<div class="ens-mode-desc">多人实时聊天，支持动态增删</div>' +
      '</button>' +
      '<button class="ens-mode-card" data-mode="script">' +
        '<div class="ens-mode-icon"><i class="fa-solid fa-book-open"></i></div>' +
        '<div class="ens-mode-title">剧本模式</div>' +
        '<div class="ens-mode-desc">AI生成剧本，进入故事世界</div>' +
      '</button>' +
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
  if (!body) return;
  var chars = _state.current || [];

  // CAST头像组HTML
  var castAvatars = chars.map(function(c) {
    var ch = c.char;
    return '<div class="ens-header-cast-avatar">' + avatarHtml(ch.avatar, chName(ch)) + '</div>';
  }).join('');

  body.innerHTML =
    '<div class="ens-chat">' +
      '<div class="ens-chat-log" id="ens-log"></div>' +
      '<div class="miss-compose">' +
        '<button class="miss-end-meet" id="ens-phone" type="button" title="\u624b\u673a"><i class="fa fa-mobile-screen"></i></button>' +
        '<button class="miss-end-meet" id="ens-cast" type="button" title="\u73b0\u573a\u4eba\u5458"><i class="fa-solid fa-users"></i></button>' +
        '<textarea class="miss-input" id="ens-input" rows="1" placeholder="\u8bf4\u70b9\u4ec0\u4e48..."></textarea>' +
        '<button class="miss-send" id="ens-send" type="button" title="\u53d1\u9001"><i class="fa-solid fa-paper-plane"></i></button>' +
      '</div>' +
    '</div>';

  // 更新header的CAST头像和更多按钮
  var header = page.querySelector('.ens-header');
  if (header) {
    var titleEl = header.querySelector('.ens-header-title');
    if (titleEl) {
      titleEl.outerHTML =
        '<span class="ens-header-title">' + esc(chars.map(function(c) { return chName(c.char); }).join('、')) + '</span>' +
        '<div class="ens-header-cast">' + castAvatars + '</div>' +
        '<button class="ens-header-more" id="ens-settings-btn"><i class="fa-solid fa-ellipsis"></i></button>';
    }
    var settingsBtn = header.querySelector('#ens-settings-btn');
    if (settingsBtn) {
      settingsBtn.onclick = function() { openEnsembleSettings(page, _state.uid, chars); };
    }
  }

  // 加载历史（标记去重）
  _state._historyLoaded = false;
  loadChatHistory(page);

  // 事件绑定
  var phone = body.querySelector('#ens-phone');
  if (phone) phone.onclick = function() { if (window.showWechatPage) window.showWechatPage(); };

  var cast = body.querySelector('#ens-cast');
  if (cast) cast.onclick = function() { showCastModal(page); };

  var input = body.querySelector('#ens-input');
  var sendBtn = body.querySelector('#ens-send');
  if (input) {
    input.oninput = function() {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    };
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
    var sys = await buildGroupPrompt(_state.current, _state.mode, _state.scriptData);
    var msgs = [{ role: 'system', content: sys }];
    var hist = (_state.history || []).slice(-20);
    msgs = msgs.concat(hist);
    msgs.push({ role: 'user', content: text });

    var reply = await window.callAI(msgs, { charAntiDrift: true });
    _state.history = (_state.history || []).concat([
      { role: 'user', content: text },
      { role: 'assistant', content: reply }
    ]);
    hideTyping(page);
    addMsg(page, 'ai', reply);
  } catch(e) {
    console.error('[ensemble] send error:', e);
    window.toast && window.toast('回复失败');
    hideTyping(page);
  } finally {
    _state.sending = false;
  }
}

// ===== 构建群聊提示词（参考SillyTavern） =====
async function buildGroupPrompt(chars, mode, scriptData) {
  var p = '';
  var narrative = _state.narrative || 'third';

  if (mode === 'script' && scriptData) {
    p += '你是剧本演绎引擎。当前剧本：「' + (scriptData.title || '') + '」\n';
    p += '前提：' + (scriptData.premise || '') + '\n';
    if (scriptData.theme) p += '主题：' + scriptData.theme + '\n';
    p += '\n';
  } else {
    p += '你是多人场景的故事叙述者和角色扮演者。\n\n';
  }

  // Narrative perspective
  var narrText = { first: '第一人称（以"我"的视角叙述）', second: '第二人称（以"你"的视角叙述）', third: '第三人称' };
  p += '## 叙述视角：' + (narrText[narrative] || '第三人称') + '\n\n';

  // Load memories
  var memCtx = '';
  try { memCtx = await loadMemoriesForChars(chars, _state.uid); } catch(e) { /* ignore */ }
  if (memCtx) {
    p += '## 角色记忆（线上+线下历史）\n' + memCtx + '\n\n';
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

  p += '## \u56de\u590d\u683c\u5f0f\uff08\u4e25\u683c\u9075\u5b88\uff09\n';
  p += '\u6bcf\u6b21\u56de\u590d\u5fc5\u987b\u6309\u4ee5\u4e0b\u683c\u5f0f\u5199\uff0c\u6bcf\u4e2a\u89d2\u8272\u5355\u72ec\u4e00\u6bb5\uff0c\u6bb5\u9996\u5199\u89d2\u8272\u540d\uff1a\n';
  p += '\n';
  p += '\u683c\u5f0f\u793a\u4f8b\uff1a\n';
  p += '\u6e29\u666f\u7136\n';
  p += '\u4ed6\u8d70\u5230\u7a97\u8fb9\uff0c\u770b\u7740\u5916\u9762\u7684\u96e8\uff0c\u8f7b\u8f7b\u53f9\u4e86\u53e3\u6c14\u3002\n';
  p += '\u201c\u4eca\u5929\u7684\u5929\u6c14\u771f\u4e0d\u9519\u3002\u201d\u4ed6\u8f6c\u8fc7\u5934\uff0c\u5634\u89d2\u5fae\u5fae\u4e0a\u626c\u3002\n';
  p += '\n';
  p += '\u827e\u56e0\n';
  p += '\u4ed6\u4ece\u6c99\u53d1\u4e0a\u7ad9\u8d77\u6765\uff0c\u4f38\u4e86\u4e2a\u61d2\u8170\u3002\n';
  p += '\u201c\u662f\u554a\uff0c\u4e0d\u8fc7\u6211\u66f4\u559c\u6b22\u6674\u5929\u3002\u201d\u4ed6\u8d70\u5230\u6e29\u666f\u7136\u8eab\u8fb9\u3002\n';
  p += '\n';
  p += '\u89c4\u5219\uff1a\n';
  p += '1. \u6bcf\u4e2a\u89d2\u8272\u7684\u540d\u5b57\u5355\u72ec\u4e00\u884c\uff0c\u540e\u9762\u8ddf\u8be5\u89d2\u8272\u7684\u52a8\u4f5c\u548c\u53f0\u8bcd\n';
  p += '2. \u52a8\u4f5c\u63cf\u5199\u76f4\u63a5\u5199\u6587\u5b57\uff0c\u4e0d\u8981\u4efb\u4f55\u6807\u8bb0\u7b26\u53f7\n';
  p += '3. \u53f0\u8bcd\u7528\u4e2d\u6587\u53cc\u5f15\u53f7\u201c\u201d\u5305\u88f9\n';
  p += '4. \u7981\u6b62\u4f7f\u7528\u661f\u53f7*\u3001\u52a0\u7c97**\u3001\u659c\u4f53_\u3001\u6ce2\u6d6a\u7ebf~\u7b49\u4efb\u4f55markdown\u6807\u8bb0\n';
  p += '5. \u6bcf\u6b21\u56de\u590d\u5fc5\u987b\u8ba9\u6240\u6709\u5728\u573a\u89d2\u8272\u90fd\u51fa\u573a\n';
  p += '6. ' + minW + '-' + maxW + '\u5b57\n';

  // 世界书注入
  try { if (window._BUILTIN_ANTI_DRIFT_LORE) p += '\n\n' + window._BUILTIN_ANTI_DRIFT_LORE; } catch(e) { /* ignore */ }
  try { if (window._BUILTIN_PLOT_FIRST_LORE) p += '\n\n' + window._BUILTIN_PLOT_FIRST_LORE; } catch(e) { /* ignore */ }

  return p;
}

// ===== 消息渲染 =====
function stripMarkdown(text) {
  if (!text) return '';
  // Remove **bold** markers
  text = text.replace(/\*\*(.+?)\*\*/g, '');
  // Remove *italic* markers
  text = text.replace(/\*(.+?)\*/g, '');
  // Remove __underline__ markers
  text = text.replace(/__(.+?)__/g, '');
  // Remove ~~strikethrough~~ markers
  text = text.replace(/~~(.+?)~~/g, '');
  // Remove markdown headers
  text = text.replace(/^#{1,6}\s+/gm, '');
  return text;
}

function addMsg(page, role, text) {
  var log = page.querySelector('#ens-log');
  if (!log) return;
  var div = document.createElement('div');
  var chars = _state.current || [];

  if (role === 'user') {
    // 用户消息 - 浅灰气泡，带头像
    var userName = _state.userName || '我';
    div.className = 'ens-user-msg';
    div.innerHTML =
      '<div class="ens-user-card">' +
        '<div class="ens-user-head">' +
          '<div class="ens-user-avatar">' + userAvatarHtml(null) + '</div>' +
          '<div class="ens-user-name">' + esc(userName) + '</div>' +
        '</div>' +
        '<div class="ens-user-body">' + esc(text) + '</div>' +
        '<div class="ens-user-footer"><span>' + formatTime(Date.now()) + '</span></div>' +
      '</div>';
  } else {
    // AI叙事 - 白色NARRATION大卡片
    div.className = 'ens-narr-msg';

    // 解析文本，按角色分段
    var segments = parseNarrationSegments(text, chars);
    var charsHTML = '';
    segments.forEach(function(seg) {
      charsHTML +=
        '<div class="ens-char-unit">' +
          '<div class="ens-char-head">' +
            '<div class="ens-char-avatar">' + seg.avatarHtml + '</div>' +
            '<div class="ens-char-name">' + esc(seg.name) + '</div>' +
          '</div>' +
          seg.bodyHtml +
        '</div>';
    });

    // 如果没有解析出段落，显示原始文本
    if (!charsHTML) {
      charsHTML = '<div class="ens-text-env">' + esc(text) + '</div>';
    }

    div.innerHTML =
      '<div class="ens-narr-card">' +
        '<div class="ens-narr-header">' +
          '<span class="ens-narr-icon"><i class="fa-solid fa-play"></i></span>' +
          '<span class="ens-narr-label">NARRATION</span>' +
          '<span class="ens-narr-mode">Multi</span>' +
        '</div>' +
        '<div class="ens-narr-body">' + charsHTML + '</div>' +
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

// ===== 叙事文本解析 =====
function parseNarrationSegments(text, chars) {
  if (!text) return [];
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  var segments = [];
  var currentChar = null;
  var currentLines = [];

  function flushSegment() {
    if (currentLines.length === 0) return;
    var bodyHtml = currentLines.map(function(line) {
      var t = line.trim();
      if (!t) return '';
      if (isDialogue(t)) return '<div class="ens-text-dialogue">' + esc(t) + '</div>';
      if (isAction(t)) return '<div class="ens-text-action">' + esc(t) + '</div>';
      return '<div class="ens-text-env">' + esc(t) + '</div>';
    }).filter(Boolean).join('');

    var ch = currentChar || (chars.length > 0 ? chars[0].char : null);
    if (ch) {
      segments.push({
        name: chName(ch),
        avatarHtml: avatarHtml(ch.avatar, chName(ch)),
        bodyHtml: bodyHtml
      });
    }
    currentLines = [];
  }

  // Build name->char map
  var nameMap = {};
  chars.forEach(function(c) {
    var name = chName(c.char);
    if (name) nameMap[name] = c.char;
  });
  var nameList = Object.keys(nameMap).sort(function(a,b) { return b.length - a.length; });

  function findCharInLine(t) {
    for (var i = 0; i < nameList.length; i++) {
      var name = nameList[i];
      var idx = t.indexOf(name);
      if (idx !== -1) {
        var after = t.charAt(idx + name.length);
        if (!after || after === ' ' || after === '\u3001' || after === ',' || after === '\uff0c' || after === '\u3002' || after === '\uff1a' || after === '\uff01' || after === '\uff1f' || after === '\u201c' || after === '\u201d') {
          return nameMap[name];
        }
      }
    }
    return null;
  }

  lines.forEach(function(line) {
    var t = line.trim();
    var matchedChar = findCharInLine(t);
    if (matchedChar && matchedChar !== currentChar) {
      flushSegment();
      currentChar = matchedChar;
      var name = chName(matchedChar);
      var idx = t.indexOf(name);
      if (idx === 0) {
        t = t.substring(name.length).replace(/^\\s*[\\u3001,\\uff0c]?\\s*/, '');
      }
      if (t) currentLines.push(t);
    } else {
      currentLines.push(line);
    }
  });
  flushSegment();
  if (segments.length === 0 && currentLines.length > 0) {
    var ch = chars.length > 0 ? chars[0].char : null;
    if (ch) {
      var bodyHtml = currentLines.map(function(line) {
        var t = line.trim();
        if (isDialogue(t)) return '<div class="ens-text-dialogue">' + esc(t) + '</div>';
        if (isAction(t)) return '<div class="ens-text-action">' + esc(t) + '</div>';
        return '<div class="ens-text-env">' + esc(t) + '</div>';
      }).filter(Boolean).join('');
      segments.push({
        name: chName(ch),
        avatarHtml: avatarHtml(ch.avatar, chName(ch)),
        bodyHtml: bodyHtml
      });
    }
  }

  return segments;
}

function isDialogue(line) {
  if (line.indexOf('\u201c') !== -1 && line.indexOf('\u201d') !== -1) return true;
  if (line.indexOf('\u300c') !== -1 && line.indexOf('\u300d') !== -1) return true;
  if (line.indexOf('"') !== -1 && line.indexOf('"') !== -1) return true;
  return false;
}

function isAction(line) {
  var kw = ['轻轻','缓缓','看向','站起','坐下','转身','微笑','皱眉','点头','摇头','叹了口气','伸出手','低下头','抬起','走来','离开','说道','开口','沉默','注视'];
  for (var i = 0; i < kw.length; i++) {
    if (line.indexOf(kw[i]) !== -1) return true;
  }
  var chars = _state.current || [];
  for (var j = 0; j < chars.length; j++) {
    var n = chName(chars[j].char);
    if (line.indexOf(n) === 0 && line.indexOf('「') === -1 && line.indexOf('\u201c') === -1) return true;
  }
  return false;
}

function formatTime(ts) {
  var d = new Date(ts);
  var h = d.getHours().toString().padStart(2, '0');
  var m = d.getMinutes().toString().padStart(2, '0');
  return h + ':' + m;
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

  var h =
    '<div class="sheet-title">现场人员</div>' +
    '<div class="ens-personnel-list">' +
    '<div class="ens-section-label">在场</div>';
  cur.forEach(function(c) {
    h +=
      '<div class="ens-person-row">' +
        '<div class="miss-avatar">' + avatarHtml(c.char.avatar, chName(c.char)) + '</div>' +
        '<div class="ens-person-name">' + esc(chName(c.char)) + '</div>' +
        '<button class="ens-remove-btn" data-cid="' + c.char.id + '">移除</button>' +
      '</div>';
  });
  h += '<div class="ens-section-label">不在场</div>';
  all.filter(function(c) {
    return !cur.find(function(x) { return x.char.id === c.char.id; });
  }).forEach(function(c) {
    h +=
      '<div class="ens-person-row">' +
        '<div class="miss-avatar">' + avatarHtml(c.char.avatar, chName(c.char)) + '</div>' +
        '<div class="ens-person-name">' + esc(chName(c.char)) + '</div>' +
        '<button class="ens-add-btn" data-cid="' + c.char.id + '">加入</button>' +
      '</div>';
  });
  h +=
    '</div>' +
    '<div class="sheet-actions"><button class="btn-pill btn-full" id="ens-cast-close">关闭</button></div>';
  modal.innerHTML = h;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  requestAnimationFrame(function() {
    overlay.classList.add('show');
    modal.classList.add('show');
  });

  function close() {
    overlay.classList.remove('show');
    modal.classList.remove('show');
    setTimeout(function() { overlay.remove(); modal.remove(); }, 300);
  }

  modal.querySelectorAll('.ens-remove-btn').forEach(function(b) {
    b.onclick = function() {
      var cid = parseInt(b.dataset.cid);
      var ch = cur.find(function(x) { return x.char.id === cid; });
      _state.current = cur.filter(function(x) { return x.char.id !== cid; });
      if (ch) addSysMsg(page, chName(ch.char) + ' 离开了聊天');
      close();
      showCastModal(page);
      setTitle(page, '群像 · ' + _state.current.length + '人在线');
    };
  });

  modal.querySelectorAll('.ens-add-btn').forEach(function(b) {
    b.onclick = function() {
      var cid = parseInt(b.dataset.cid);
      var ch = all.find(function(x) { return x.char.id === cid; });
      if (ch) {
        _state.current.push(ch);
        addSysMsg(page, chName(ch.char) + ' 加入了聊天');
      }
      close();
      showCastModal(page);
      setTitle(page, '群像 · ' + _state.current.length + '人在线');
    };
  });

  var closeBtn = modal.querySelector('#ens-cast-close');
  if (closeBtn) closeBtn.onclick = close;
  overlay.onclick = close;
}

// ===== 剧本设置 =====
var SCRIPT_CFG = 'ens_script_cfg';
var SCRIPT_HIST = 'ens_script_hist';

async function getScriptCfg(uid) {
  try { var r = await db.config.get(SCRIPT_CFG + '_' + uid); return r ? r.value : null; }
  catch(e) { return null; }
}
async function saveScriptCfg(uid, c) {
  try { await db.config.put({ key: SCRIPT_CFG + '_' + uid, value: c }); }
  catch(e) { /* ignore */ }
}
async function getScriptHist(uid) {
  try { var r = await db.config.get(SCRIPT_HIST + '_' + uid); return r ? r.value : []; }
  catch(e) { return []; }
}
async function saveScriptHist(uid, d) {
  try {
    var h = await getScriptHist(uid);
    h.unshift(Object.assign({}, d, { savedAt: Date.now() }));
    if (h.length > 20) h.length = 20;
    await db.config.put({ key: SCRIPT_HIST + '_' + uid, value: h });
  } catch(e) { /* ignore */ }
}

function openScriptSettings(page, uid, chars) {
  setState(page, { view: 'script-settings', uid: uid, chars: chars });
  setTitle(page, '剧本设置');
  var body = page.querySelector('#ens-body');
  if (!body) return;

  body.innerHTML =
    '<div class="ens-page-header">' +
      '<div class="ens-page-icon"><i class="fa-solid fa-book-open"></i></div>' +
      '<div class="ens-page-title">剧本设置</div>' +
      '<div class="ens-page-desc">设置参数，AI生成剧本</div>' +
    '</div>' +
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
      '<div class="ens-toggle-row">' +
        '<span>Apollo Protocol</span>' +
        '<label class="ens-toggle"><input type="checkbox" id="ens-wb"><span class="ens-toggle-slider"></span></label>' +
      '</div>' +
      '<div class="miss-section-title">故事主题</div>' +
      '<input type="text" class="ens-input-field" id="ens-theme" placeholder="如：校园恋爱">' +
      '<div class="miss-section-title">额外设定</div>' +
      '<textarea class="ens-textarea-field" id="ens-extra" placeholder="额外要求"></textarea>' +
      '<div class="ens-settings-actions">' +
        '<button class="btn-pill" id="ens-gen">生成剧本</button>' +
        '<button class="btn-ghost" id="ens-hist">历史剧本</button>' +
      '</div>' +
    '</div>';

  var genBtn = body.querySelector('#ens-gen');
  if (genBtn) genBtn.onclick = function() { generateScript(page, uid, chars); };
  var histBtn = body.querySelector('#ens-hist');
  if (histBtn) histBtn.onclick = function() { showHistory(page, uid, chars); };
}

async function generateScript(page, uid, chars) {
  var body = page.querySelector('#ens-body');
  if (!body) return;
  var p = body.querySelector('input[name="ens-p"]:checked');
  var s = body.querySelector('input[name="ens-s"]:checked');
  var wb = body.querySelector('#ens-wb');
  var th = body.querySelector('#ens-theme');
  var ex = body.querySelector('#ens-extra');
  var cfg = {
    p: p ? p.value : 'third',
    s: s ? s.value : 'daily',
    wb: wb ? wb.checked : false,
    theme: th ? th.value.trim() : '',
    extra: ex ? ex.value.trim() : ''
  };
  await saveScriptCfg(uid, cfg);

  body.innerHTML =
    '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>' +
    '<div style="text-align:center;color:#8a8a8a;margin-top:12px;">AI生成剧本中...</div>';

  try {
    var descs = chars.map(function(c) { return c.char.name + '：' + (c.char.description || '无'); }).join('\n');
    var sn = { daily:'轻松日常', mystery:'悬疑推理', fantasy:'奇幻冒险', romance:'虐心言情' };
    var prompt = '为以下角色生成剧本框架：\n\n角色：\n' + descs + '\n\n视角：' + (cfg.p==='first'?'第一人称':'第三人称') + '\n风格：' + (sn[cfg.s]||cfg.s) + '\n';
    if (cfg.theme) prompt += '主题：' + cfg.theme + '\n';
    if (cfg.extra) prompt += '额外：' + cfg.extra + '\n';
    prompt += '\n返回JSON：{"title":"","premise":"","characters":[{"name":"","role":"","setting":""}],"preview":"","keywords":[""]}';

    var sys = '你是剧本创作AI，严格返回JSON。';
    try { if (window._BUILTIN_ANTI_DRIFT_LORE) sys += '\n\n' + window._BUILTIN_ANTI_DRIFT_LORE; } catch(e) { /* ignore */ }
    try { if (window._BUILTIN_PLOT_FIRST_LORE) sys += '\n\n' + window._BUILTIN_PLOT_FIRST_LORE; } catch(e) { /* ignore */ }
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
  if (!body) return;

  var h =
    '<div class="ens-script-preview">' +
    '<div class="ens-script-title">' + esc(data.title || '未命名') + '</div>';

  h += '<div class="ens-script-section"><div class="ens-script-label">前提</div><div class="ens-script-text">' + esc(data.premise || '') + '</div></div>';

  h += '<div class="ens-script-section"><div class="ens-script-label">角色</div>';
  (data.characters || []).forEach(function(c) {
    h += '<div class="ens-script-char"><strong>' + esc(c.name) + '</strong> - ' + esc(c.role || '') +
      '<div class="ens-script-char-desc">' + esc(c.setting || '') + '</div></div>';
  });
  h += '</div>';

  h += '<div class="ens-script-section"><div class="ens-script-label">预览</div><div class="ens-script-text">' + esc(data.preview || '') + '</div></div>';

  h += '<div class="ens-script-section"><div class="ens-script-label">关键词</div><div class="ens-keywords">';
  (data.keywords || []).forEach(function(k) { h += '<span class="ens-keyword">#' + esc(k) + '</span>'; });
  h += '</div></div>';

  h += '<div class="ens-script-actions">' +
    '<button class="btn-pill" id="ens-start">开始剧本</button>' +
    '<button class="btn-ghost" id="ens-retry">重新生成</button>' +
  '</div></div>';
  body.innerHTML = h;

  var startBtn = body.querySelector('#ens-start');
  if (startBtn) {
    startBtn.onclick = function() {
      _state.scriptData = data;
      _state.mode = 'script';
      enterMeet(page, uid, chars);
    };
  }
  var retryBtn = body.querySelector('#ens-retry');
  if (retryBtn) retryBtn.onclick = function() { openScriptSettings(page, uid, chars); };
}

async function showHistory(page, uid, chars) {
  setState(page, { view: 'script-history', uid: uid, chars: chars });
  setTitle(page, '历史剧本');
  var body = page.querySelector('#ens-body');
  if (!body) return;
  var list = await getScriptHist(uid);

  if (!list.length) {
    body.innerHTML =
      '<div class="ens-empty">' +
        '<div class="ens-empty-icon"><i class="fa fa-clock-rotate-left"></i></div>' +
        '<div class="ens-empty-title">暂无历史剧本</div>' +
      '</div>';
    return;
  }

  var h = '<div class="miss-section-title">历史剧本</div><div class="miss-list">';
  list.forEach(function(s, i) {
    var d = s.savedAt ? new Date(s.savedAt).toLocaleDateString() : '';
    h +=
      '<button class="miss-row" data-i="' + i + '">' +
        '<div class="miss-row-main">' +
          '<div class="miss-row-title">' + esc(s.title || '未命名') + '</div>' +
          '<div class="miss-row-sub">' + esc(s.preview || '').slice(0, 50) + '</div>' +
        '</div>' +
        '<div class="ens-history-date">' + esc(d) + '</div>' +
      '</button>';
  });
  h += '</div>';
  body.innerHTML = h;

  body.querySelectorAll('.miss-row').forEach(function(r) {
    r.onclick = function() {
      var i = parseInt(r.dataset.i);
      if (list[i]) showScriptPreview(page, uid, chars, {}, list[i]);
    };
  });
}

// ===== 聊天保存/加载 =====
async function saveChatMsg(role, text) {
  try {
    if (!_state.uid || !db.offlineChats || _state._loading) return;
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
    if (_state._historyLoaded) return;
    _state._loading = true;
    _state._historyLoaded = true;

    var log = page.querySelector('#ens-log');
    if (!log) { _state._loading = false; return; }

    var charId = _state.current && _state.current[0] ? _state.current[0].char.id : 0;
    var all = await db.offlineChats.toArray();
    var rows = all.filter(function(m) {
      return m.ownerUid === _state.uid && m.mode === 'ensemble' && m.charId === charId;
    }).sort(function(a, b) { return (a.createdAt||0) - (b.createdAt||0); });

    if (!rows.length) { _state._loading = false; return; }

    _state.history = [];
    var userName = _state.userName || '\u6211';
    var chars = _state.current || [];
    var charNames = chars.map(function(c) { return chName(c.char); }).join('\u3001');

    log.innerHTML = rows.map(function(m, i) {
      var isUser = m.role === 'user';
      var name = isUser ? userName : charNames;
      var avHtml = '';
      if (isUser) {
        avHtml = userAvatarHtml(null);
      } else if (chars.length > 0) {
        var ch = chars[0].char;
        avHtml = ch.avatar ? '<img src="' + esc(ch.avatar) + '" alt="">' : '<span>' + esc(chName(ch).charAt(0)) + '</span>';
      }
      var time = formatTime(m.createdAt || 0);
      var rank = '#' + (i + 1);

      if (!isUser) {
        var segments = parseNarrationSegments(m.content || '', chars);
        var charsHTML = '';
        segments.forEach(function(seg) {
          charsHTML += '<div class="ens-char-unit">' +
            '<div class="ens-char-head">' +
              '<div class="ens-char-avatar">' + seg.avatarHtml + '</div>' +
              '<div class="ens-char-name">' + esc(seg.name) + '</div>' +
            '</div>' +
            seg.bodyHtml +
          '</div>';
        });
        if (!charsHTML) charsHTML = '<div class="ens-text-env">' + esc(m.content || '') + '</div>';
        return '<article class="miss-entry is-char" data-msg-idx="' + i + '">' +
          '<button class="miss-entry-head" type="button">' +
            '<div class="miss-entry-person">' +
              '<div class="miss-msg-avatar">' + avHtml + '</div>' +
              '<div class="miss-entry-nameblock">' +
                '<div class="miss-msg-name">' + esc(name) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="miss-entry-floor">' + esc(rank) + '</div>' +
          '</button>' +
          '<div class="miss-entry-card">' +
            '<div class="ens-narr-body">' + charsHTML + '</div>' +
            '<div class="miss-entry-footer">' +
              '<span>' + esc(time) + '</span>' +
            '</div>' +
          '</div>' +
        '</article>';
      }

      return '<article class="miss-entry is-user" data-msg-idx="' + i + '">' +
        '<button class="miss-entry-head" type="button">' +
          '<div class="miss-entry-person">' +
            '<div class="miss-msg-avatar">' + avHtml + '</div>' +
            '<div class="miss-entry-nameblock">' +
              '<div class="miss-msg-name">' + esc(name) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="miss-entry-floor">' + esc(rank) + '</div>' +
        '</button>' +
        '<div class="miss-entry-card">' +
          '<div class="miss-msg-text">' + esc(m.content || '') + '</div>' +
          '<div class="miss-entry-footer">' +
            '<span>' + esc(time) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');

    log.scrollTop = log.scrollHeight;

    rows.forEach(function(m) {
      if (m.role === 'user') {
        _state.history.push({ role: 'user', content: m.content });
      } else if (m.role === 'assistant' || m.role === 'ai') {
        _state.history.push({ role: 'assistant', content: m.content });
      }
    });

    _state._loading = false;
  } catch(e) {
    _state._loading = false;
    console.error('[ensemble] load:', e);
  }
}

async function clearChatHistory() {
  try {
    if (!_state.uid || !db.offlineChats) return;
    var all = await db.offlineChats.toArray();
    var ids = all.filter(function(m) {
      return m.ownerUid === _state.uid && m.mode === 'ensemble';
    }).map(function(m) { return m.id; });
    if (ids.length) await db.offlineChats.bulkDelete(ids);
    _state.history = [];
    _state._historyLoaded = false;
  } catch(e) { console.error('[ensemble] clear:', e); }
}

// ===== 设置页 =====
async function openEnsembleSettings(page, uid, chars) {
  var body = page.querySelector('#ens-body');
  if (!body) return;

  setState(page, { view: 'settings', uid: uid, chars: chars });

  // 加载历史
  var history = [];
  try {
    if (db.offlineChats) {
      var all = await db.offlineChats.toArray();
      history = all.filter(function(m) {
        return m.ownerUid === uid && m.mode === 'ensemble';
      }).sort(function(a,b) { return (b.createdAt||0)-(a.createdAt||0); });
    }
  } catch(e) { /* ignore */ }

  var charNames = (chars || []).map(function(c) { return chName(c.char); }).join('\u3001');
  var firstChar = chars && chars.length > 0 ? chars[0].char : null;

  var h =
    '<div class="ens-settings-page">' +

    // 目标角色
    '<div class="ens-settings-target">' +
      '<div class="miss-avatar">' + (firstChar ? avatarHtml(firstChar.avatar, chName(firstChar)) : '<span>?</span>') + '</div>' +
      '<div>' +
        '<div class="ens-settings-target-name">' + esc(charNames) + '</div>' +
        '<div class="ens-settings-target-sub">' + (_state.mode === 'script' ? '剧本模式' : '见面模式') + '</div>' +
      '</div>' +
    '</div>' +

    // 回复字数
    '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">回复字数</div>' +
      '<div class="ens-word-grid">' +
        '<label class="ens-field-label"><span>最少</span><input class="input-field" id="ens-min-words" type="number" min="50" value="' + (_state.minWords || 200) + '"></label>' +
        '<label class="ens-field-label"><span>最多</span><input class="input-field" id="ens-max-words" type="number" min="100" value="' + (_state.maxWords || 600) + '"></label>' +
      '</div>' +
    '</div>' +

    // 叙述人称
    '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">叙述人称</div>' +
      '<select class="input-field" id="ens-narrative">' +
        '<option value="first"' + ((_state.narrative || 'third') === 'first' ? ' selected' : '') + '>第一人称</option>' +
        '<option value="second"' + ((_state.narrative || 'third') === 'second' ? ' selected' : '') + '>第二人称</option>' +
        '<option value="third"' + ((_state.narrative || 'third') === 'third' ? ' selected' : '') + '>第三人称</option>' +
      '</select>' +
    '</div>' +

    // 会话管理
    '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">会话管理</div>' +
      '<button class="btn-ghost" id="ens-summary" style="width:100%;margin:8px 0 0;">总结并结束此次见面</button>' +
      '<button class="btn-ghost" id="ens-clear" style="width:100%;margin:8px 0 0;">清空聊天记录</button>' +
    '</div>' +

    // 过往见面记录
    '<div class="ens-settings-section">' +
      '<div class="ens-settings-label">过往见面记录</div>';

  if (history.length) {
    var days = {};
    history.forEach(function(m) {
      var d = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '';
      if (d) {
        if (!days[d]) days[d] = 0;
        days[d]++;
      }
    });
    Object.keys(days).slice(0, 10).forEach(function(d) {
      h += '<div class="ens-history-item"><span>' + esc(d) + '</span><span class="ens-history-count">' + days[d] + '条</span></div>';
    });
  } else {
    h += '<div style="color:#8a8a8a;font-size:13px;padding:8px 0;">暂无记录</div>';
  }

  h += '</div>' +
    '<button class="btn-pill" id="ens-settings-save" style="width:100%;margin-top:16px;">保存设置</button>' +
    '</div>';

  body.innerHTML = h;

  var saveBtn = body.querySelector('#ens-settings-save');
  if (saveBtn) {
    saveBtn.onclick = function() {
      var minEl = body.querySelector('#ens-min-words');
      var maxEl = body.querySelector('#ens-max-words');
      var narrEl = body.querySelector('#ens-narrative');
      _state.minWords = minEl ? (parseInt(minEl.value) || 200) : 200;
      _state.maxWords = maxEl ? (parseInt(maxEl.value) || 600) : 600;
      _state.narrative = narrEl ? (narrEl.value || 'third') : 'third';
      window.toast && window.toast('设置已保存');
      renderChat(page);
    };
  }

  var clearBtn = body.querySelector('#ens-clear');
  if (clearBtn) {
    clearBtn.onclick = function() {
      if (confirm('清空聊天记录？')) {
        clearChatHistory().then(function() {
          window.toast && window.toast('已清空');
          renderChat(page);
        });
      }
    };
  }

  var summaryBtn = body.querySelector('#ens-summary');
  if (summaryBtn) {
    summaryBtn.onclick = function() { summarizeAndEnd(page); };
  }
}

// ===== 见面总结 =====
async function summarizeAndEnd(page) {
  if (!window.WanWanMemory || !window.WanWanMemory.summarizeMeeting) {
    window.toast && window.toast('记忆系统未加载');
    return;
  }
  window.toast && window.toast('正在总结...');
  try {
    var uid = _state.uid;
    var chars = _state.current || [];
    var history = _state.history || [];
    if (!history.length) { window.toast && window.toast('没有聊天内容'); return; }

    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i].char;
      var sessionId = 'ensemble_' + uid + '_' + ch.id + '_' + Date.now();
      var summaryMsgs = history.map(function(m) { return { role: m.role, content: m.content }; });
      try {
        await window.WanWanMemory.summarizeMeeting(ch.id, ch.id, uid, sessionId, summaryMsgs, Date.now());
      } catch(e) { console.error('[ensemble] summarize ' + ch.name, e); }
    }

    if (db.offlineChats) {
      await db.offlineChats.add({
        ownerUid: uid, chatId: 0, charId: 0,
        mode: 'ensemble', role: 'system',
        content: '见面结束 · ' + new Date().toLocaleString(),
        createdAt: Date.now()
      });
    }

    await clearChatHistory();
    window.toast && window.toast('已总结并保存');
    renderChat(page);
  } catch(e) {
    console.error('[ensemble] summarize error:', e);
    window.toast && window.toast('总结失败');
  }
}

// ===== 记忆读取 =====
async function loadMemoriesForChars(chars, uid) {
  var parts = [];
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i].char;
    try {
      if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
        var ctx = await window.WanWanMemory.getMemoryContext(null, ch.id, uid, []);
        if (ctx) parts.push(ch.name + '的记忆：\n' + ctx);
      }
    } catch(e) { /* ignore */ }
  }
  return parts.join('\n\n');
}