/* auto-moments.js — 微信朋友圈自动发帖模块 v2 */
/* 功能：自动发帖、MCP评论、配图、有感而发、用户手动触发 */
(function () {
'use strict';

/* ── 配置Key ────────────────────────────────────── */
var AM = {
  enabled:   'autoMomentsEnabled',
  chars:     'autoMomentsChars',
  interval:  'autoMomentsInterval',
  mode:      'autoMomentsMode',
  commentsOn:'autoMomentsComments',
  imagesOn:  'autoMomentsImages'
};

var INTERVALS = [
  { v: 2,  l: '2小时' },
  { v: 4,  l: '4小时' },
  { v: 6,  l: '6小时' },
  { v: 10, l: '10小时' }
];

var MODES = [
  { v: 'daily', l: '角色日常为主', d: '80%日常 + 20%用户相关' },
  { v: 'mixed', l: '日常+用户一半', d: '50%日常 + 50%用户相关' }
];

var _timer = null;
var _lastChatPost = 0;

/* ── DB工具 ─────────────────────────────────────── */
function getCfg(k) {
  return window.db.config.get(k).then(function (r) { return r ? r.value : null; }).catch(function () { return null; });
}
function setCfg(k, v) {
  return window.db.config.put({ key: k, value: v }).catch(function () {});
}

function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function parseJSON(text) {
  if (!text) return null;
  try { return JSON.parse(text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()); } catch (_) {}
  try { var m = text.match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (_) {}
  return null;
}

/* ══════════════════════════════════════════════════
   设置面板（嵌入朋友圈页面）
   ══════════════════════════════════════════════════ */
window.renderAutoMomentsPanel = async function (container) {
  var enabled    = await getCfg(AM.enabled);
  var chars      = await getCfg(AM.chars) || [];
  var interval   = await getCfg(AM.interval) || 4;
  var mode       = await getCfg(AM.mode) || 'daily';
  var commentsOn = await getCfg(AM.commentsOn);
  var imagesOn   = await getCfg(AM.imagesOn);

  var allChars = [];
  try { allChars = await window.db.characters.toArray(); } catch (_) {}

  var h = '<div class="am-panel">';
  h += '<div class="am-panel-title"><i class="fa-solid fa-wand-magic-sparkles"></i> 自动朋友圈</div>';

  /* 总开关 */
  h += makeRow('自动发帖', makeSwitch('am-enabled', enabled));

  h += '<div class="am-detail"' + (enabled ? '' : ' style="display:none"') + '>';

  /* 发帖角色 */
  h += '<div class="am-section-label">发帖角色</div>';
  h += '<div class="am-chars">';
  allChars.forEach(function (c) {
    h += '<label class="am-chip"><input type="checkbox" class="am-char-cb" data-id="' + c.id + '"' +
        (chars.indexOf(c.id) >= 0 ? ' checked' : '') + '><span>' + esc(c.name) + '</span></label>';
  });
  if (!allChars.length) h += '<div class="am-hint">暂无角色，请先创建角色</div>';
  h += '</div>';

  /* 频率 */
  h += '<div class="am-section-label">发帖频率</div>';
  h += '<div class="am-pills">';
  INTERVALS.forEach(function (item) {
    h += '<label class="am-pill"><input type="radio" name="am-interval" value="' + item.v + '"' +
        (interval === item.v ? ' checked' : '') + '><span>' + item.l + '</span></label>';
  });
  h += '</div>';

  /* 内容模式 */
  h += '<div class="am-section-label">内容模式</div>';
  h += '<div class="am-pills">';
  MODES.forEach(function (item) {
    h += '<label class="am-pill am-pill-wide"><input type="radio" name="am-mode" value="' + item.v + '"' +
        (mode === item.v ? ' checked' : '') + '><span>' + item.l + '<small>' + item.d + '</small></span></label>';
  });
  h += '</div>';

  /* 评论 */
  h += makeRow('MCP评论', makeSwitch('am-comments', commentsOn));
  h += '<div class="am-hint" id="am-comments-hint"' +
      (commentsOn ? '' : ' style="display:none"') + '>角色关系人自动评论，增加互动真实感</div>';

  /* 配图 */
  h += makeRow('随机配图', makeSwitch('am-images', imagesOn));
  h += '<div class="am-hint">调用图片生成API，失败则纯文案</div>';

  h += '</div>'; /* am-detail */
  h += '</div>'; /* am-panel */

  container.innerHTML = h;
  bindPanelEvents(container);
};

/* ── HTML helpers ───────────────────────────────── */
function makeRow(label, rightHTML) {
  return '<div class="am-row"><span class="am-row-label">' + label + '</span>' + rightHTML + '</div>';
}

function makeSwitch(id, checked) {
  return '<label class="am-sw"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '><span class="am-sw-slider"></span></label>';
}

function bindPanelEvents(panel) {
  /* 总开关 */
  var enCb = panel.querySelector('#am-enabled');
  var detail = panel.querySelector('.am-detail');
  if (enCb) {
    enCb.addEventListener('change', function () {
      var on = this.checked;
      if (detail) detail.style.display = on ? '' : 'none';
      setCfg(AM.enabled, on);
      if (on) startScheduler(); else stopScheduler();
    });
  }

  /* 角色勾选 */
  panel.querySelectorAll('.am-char-cb').forEach(function (cb) {
    cb.addEventListener('change', function () {
      var sel = [];
      panel.querySelectorAll('.am-char-cb:checked').forEach(function (c) { sel.push(parseInt(c.dataset.id)); });
      setCfg(AM.chars, sel);
    });
  });

  /* 频率：修改后重启调度器 */
  panel.querySelectorAll('input[name="am-interval"]').forEach(function (r) {
    r.addEventListener('change', function () {
      setCfg(AM.interval, parseInt(this.value));
      if (enCb && enCb.checked) startScheduler();
    });
  });

  /* 内容模式 */
  panel.querySelectorAll('input[name="am-mode"]').forEach(function (r) {
    r.addEventListener('change', function () { setCfg(AM.mode, this.value); });
  });

  /* 评论开关 */
  var cmCb = panel.querySelector('#am-comments');
  var cmHint = panel.querySelector('#am-comments-hint');
  if (cmCb) {
    cmCb.addEventListener('change', function () {
      if (cmHint) cmHint.style.display = this.checked ? '' : 'none';
      setCfg(AM.commentsOn, this.checked);
    });
  }

  /* 配图开关 */
  var imCb = panel.querySelector('#am-images');
  if (imCb) {
    imCb.addEventListener('change', function () { setCfg(AM.imagesOn, this.checked); });
  }
}

/* ══════════════════════════════════════════════════
   自动发帖调度（递归 setTimeout，比 setInterval 可靠）
   ══════════════════════════════════════════════════ */
async function startScheduler() {
  stopScheduler();
  if (!await getCfg(AM.enabled)) return;
  var hours = await getCfg(AM.interval) || 4;
  _timer = setTimeout(async function tick() {
    try { await postMoment(); } catch (_) {}
    var h = await getCfg(AM.interval) || 4;
    _timer = setTimeout(tick, h * 3600000);
  }, hours * 3600000);
}

function stopScheduler() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

/* ══════════════════════════════════════════════════
   核心：生成并发布朋友圈
   ══════════════════════════════════════════════════ */
async function postMoment(opts) {
  opts = opts || {};
  var charIds = await getCfg(AM.chars) || [];
  if (!charIds.length && opts.charId) charIds = [opts.charId];
  if (!charIds.length) return null;

  var charId = opts.charId || charIds[Math.floor(Math.random() * charIds.length)];
  var char = await window.db.characters.get(charId);
  if (!char) return null;

  var mode       = await getCfg(AM.mode) || 'daily';
  var commentsOn = await getCfg(AM.commentsOn);
  var imagesOn   = await getCfg(AM.imagesOn);

  /* 获取关系人 */
  var relations = (char.relations || []).map(function (r) {
    return r.desc || r.type || '';
  }).filter(Boolean);

  /* 获取最近聊天 */
  var chatCtx = await getRecentChat(charId, char.name);

  /* 构建 prompt */
  var sys = buildPrompt(char, mode, commentsOn, relations, opts.manual);
  var msgs = [{ role: 'system', content: sys }];
  var userMsg = opts.userMsg || '请生成一条朋友圈动态。';
  if (chatCtx) userMsg += '\n\n最近聊天参考：\n' + chatCtx;
  msgs.push({ role: 'user', content: userMsg });

  try {
    var raw = await window.callAI(msgs, { responseFormat: 'json_object' });
    var data = parseJSON(raw);
    if (!data || !data.text) return null;

    /* 配图 */
    if (imagesOn && data.imagesDesc && data.imagesDesc.length) {
      await genImages(char, data);
    }

    /* 构造 moment 并持久化 */
    var moment = {
      charId:      charId,
      author:      char.name,
      text:        data.text,
      imagesDesc:  data.imagesDesc || [],
      images:      data._imgKeys || [],
      likes:       Array.isArray(data.likes) ? data.likes : [],
      comments:    normalizeComments(data.comments, char.name),
      time:        '刚刚',
      createdAt:   Date.now()
    };
    await window.db.moments.put(moment);

    console.log('[AutoMoments] 已发布:', char.name, data.text.slice(0, 30));
    refreshMomentsPage();
    return moment;
  } catch (e) {
    console.warn('[AutoMoments] 发帖失败:', e);
    return null;
  }
}

/* ── 校验评论结构 ───────────────────────────────── */
function normalizeComments(raw, charName) {
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (c) {
    return c && typeof c.from === 'string' && typeof c.text === 'string';
  }).map(function (c) {
    return {
      from: c.from,
      to:   c.to || null,
      text: String(c.text).slice(0, 120)
    };
  });
}

function buildPrompt(char, mode, commentsOn, relations, isManual) {
  var p = '你是一个真实的人，正在发朋友圈。你的朋友圈必须有真人感、活人感。\n\n';
  p += '【你的信息】\n';
  p += '名字：' + char.name + '\n';
  if (char.description) p += '人设：' + char.description.slice(0, 300) + '\n';
  if (char.personality) p += '性格：' + char.personality.slice(0, 150) + '\n';

  p += '\n【发朋友圈规则】\n';
  if (mode === 'daily') {
    p += '- 80%发你自己的日常（吃饭、逛街、工作、心情、吐槽）\n';
    p += '- 20%提到用户（想TA、和TA的事、提到TA）\n';
  } else {
    p += '- 50%发你自己的日常\n';
    p += '- 50%提到用户\n';
  }
  p += '- 必须像真人发的！口语化、随意、有时候打错字也正常\n';
  p += '- 不要哲理、不要总结、不要AI味\n';
  p += '- 长度1-3句话，不超过80字\n';
  p += '- 可以有emoji但自然使用不要堆砌\n';
  p += '- 配图描述要具体（"今天的拿铁拉花"而不是"咖啡"）\n';

  if (commentsOn && relations.length) {
    p += '\n【评论规则】\n';
    p += '- 生成3-5条评论\n';
    p += '- 评论人从这些人中选：' + relations.join('、') + '\n';
    p += '- 评论像真人朋友互动（调侃、关心、吐槽）\n';
    p += '- 你回复其中1-2条评论\n';
    p += '- 绝对不要生成"用户"的评论\n';
  }

  if (isManual) {
    p += '\n- 这是用户主动让你发的，内容可以更丰富一点\n';
  }

  p += '\n【输出JSON格式】\n';
  p += '{"text":"文案","imagesDesc":["配图描述"],"likes":["点赞人"],"comments":[{"from":"人","to":null,"text":"评论"},{"from":"' + char.name + '","to":"人","text":"回复"}]}';

  return p;
}

async function getRecentChat(charId, charName) {
  try {
    var uid = await getCfg('currentUserId');
    if (!uid) return '';
    var chat = await window.db.chats.where({ charId: charId, ownerUid: uid }).first();
    if (!chat) return '';
    var msgs = await window.db.messages.where('chatId').equals(chat.id).reverse().limit(8).toArray();
    return msgs.reverse().map(function (m) {
      return (m.role === 'user' ? '用户' : charName) + '：' + (m.content || '').slice(0, 60);
    }).join('\n');
  } catch (_) { return ''; }
}

/* ── 配图 ───────────────────────────────────────── */
async function genImages(char, data) {
  try {
    var url   = await getCfg('imageGenApiUrl');
    var key   = await getCfg('imageGenApiKey');
    var model = await getCfg('imageGenModel');
    if (!url || !key) return;

    var descs = (data.imagesDesc || []).slice(0, 3); /* 最多3张 */
    if (!descs.length) return;

    var imgKeys = [];
    for (var i = 0; i < descs.length; i++) {
      try {
        var prompt = '生活照片风格，' + descs[i] + '，手机拍摄，自然光';
        var resp = await fetch(url.replace(/\/+$/, '') + '/images/generations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({
            model: model || 'dall-e-3',
            prompt: prompt,
            n: 1,
            size: '1024x1024',
            response_format: 'b64_json'
          })
        });
        if (!resp.ok) continue;
        var r = await resp.json();
        if (r.data && r.data[0] && r.data[0].b64_json) {
          var imgKey = 'am_img_' + Date.now() + '_' + i;
          localStorage.setItem(imgKey, 'data:image/png;base64,' + r.data[0].b64_json);
          imgKeys.push(imgKey);
        }
      } catch (_) {}
    }
    /* 把图片key列表挂到 data 上，postMoment 会持久化到 DB */
    if (imgKeys.length) data._imgKeys = imgKeys;
  } catch (e) { console.warn('[AutoMoments] 配图失败:', e); }
}

/* ── 刷新朋友圈页面 ─────────────────────────────── */
function refreshMomentsPage() {
  try {
    var mp = document.querySelector('.wechat-moments-page');
    if (mp && typeof window.renderMomentsList === 'function') {
      var wp = mp._wechatPage || document.querySelector('.wechat-page');
      window.renderMomentsList(mp, wp);
    }
  } catch (_) {}
}

/* ══════════════════════════════════════════════════
   公开接口
   ══════════════════════════════════════════════════ */
window.AutoMoments = {
  post:       postMoment,

  checkChat:  async function (charId) {
    if (!await getCfg(AM.enabled)) return;
    var chars = await getCfg(AM.chars) || [];
    if (chars.indexOf(charId) < 0) return;
    if (Date.now() - _lastChatPost < 7200000) return;
    if (Math.random() > 0.03) return;
    _lastChatPost = Date.now();
    await postMoment({ charId: charId });
  },

  postManual: async function (charId, userMsg) {
    return await postMoment({
      charId: charId,
      manual: true,
      userMsg: userMsg || '用户让你发一条朋友圈，请发一条自然的动态。'
    });
  },

  start:      startScheduler,
  stop:       stopScheduler,

  /* 用 getter 保证始终引用最新函数 */
  get renderPanel() { return window.renderAutoMomentsPanel; }
};

// === 事件委托：朋友圈设置按钮 ===
document.addEventListener('click', function(e) {
  var btn = e.target.closest('#btn-auto-moments-settings');
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  var exist = document.getElementById('am-settings-panel');
  if (exist) { exist.remove(); return; }
  var panel = document.createElement('div');
  panel.id = 'am-settings-panel';
  panel.className = 'am-settings-overlay';
  var content = document.createElement('div');
  content.className = 'am-settings-content';
  panel.appendChild(content);
  document.body.appendChild(panel);
  if (window.renderAutoMomentsPanel) {
    window.renderAutoMomentsPanel(content);
  }
  panel.addEventListener('click', function(ev) {
    if (ev.target === panel) panel.remove();
  });
});

})();
