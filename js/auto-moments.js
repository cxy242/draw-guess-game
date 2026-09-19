/* auto-moments.js — 微信朋友圈自动发帖模块 v3 */
/* 功能：自动发帖、MCP评论、配图、有感而发、用户手动触发 */
/* v3: 补回系统重写，确保朋友圈出现在UI中 */
(function () {
'use strict';
try {

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

/* ── showToastLong 兜底（x-page.js 可能还没加载）── */
if (typeof window.showToastLong !== 'function') {
  window.showToastLong = function (msg, duration) {
    duration = duration || 3000;
    var old = document.getElementById('x-toast-long');
    if (old) old.remove();
    var toast = document.createElement('div');
    toast.id = 'x-toast-long';
    toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(30,30,30,0.92);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);color:#fff;padding:12px 20px;border-radius:14px;font-size:14px;z-index:100001;max-width:min(320px,80vw);max-height:50vh;overflow-y:auto;opacity:0;transition:opacity 0.3s ease;pointer-events:none;text-align:center;line-height:1.5';
    toast.innerHTML = msg.replace(/\n/g, '<br>');
    document.body.appendChild(toast);
    setTimeout(function(){ toast.style.opacity = '1'; }, 10);
    setTimeout(function(){ toast.style.opacity = '0'; setTimeout(function(){ toast.remove(); }, 300); }, duration);
  };
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
   v3: 补回逻辑重写，确保 ownerUid 正确
   ══════════════════════════════════════════════════ */
var _LAST_MOMENT_KEY = 'autoMomentsLastPost';

async function startScheduler() {
  stopScheduler();
  var enabled = await getCfg(AM.enabled);
  console.log('[AutoMoments] startScheduler enabled=' + enabled);
  if (!enabled) return;
  var hours = await getCfg(AM.interval) || 4;
  var intervalMs = hours * 3600000;
  var now = Date.now();

  // 补回逻辑：始终检查，不管lastPost是否为0
  var lastPost = parseInt(localStorage.getItem(_LAST_MOMENT_KEY)) || 0;
  if (lastPost === 0) {
    // 首次启用，记录当前时间，不补回
    localStorage.setItem(_LAST_MOMENT_KEY, String(now));
    console.log('[AutoMoments] 首次启用，记录时间');
  } else {
    var elapsed = now - lastPost;
    var missed = Math.floor(elapsed / intervalMs);
    if (missed > 0) {
      missed = Math.min(missed, 10);
      console.log('[AutoMoments] 需补回' + missed + '条，距上次' + Math.round(elapsed/60000) + '分钟');
      window.showToastLong('正在补回 ' + missed + ' 条朋友圈...', 4000);
      try {
        var ok = await catchUpMoments(missed);
        localStorage.setItem(_LAST_MOMENT_KEY, String(Date.now()));
        window.showToastLong('补回完成 ' + ok + ' 条朋友圈', 3000);
        console.log('[AutoMoments] 补回完成: ' + ok + '条');
      } catch(e) {
        console.warn('[AutoMoments] 补回失败:', e);
        localStorage.setItem(_LAST_MOMENT_KEY, String(Date.now()));
        window.showToastLong('补回失败：' + (e.message || '未知错误'), 3000);
      }
    } else {
      console.log('[AutoMoments] 无需补回，下次发帖在' + Math.round((intervalMs - elapsed) / 60000) + '分钟后');
    }
  }

  // 启动定时器
  _timer = setTimeout(async function tick() {
    console.log('[AutoMoments] 定时发帖触发');
    try {
      var result = await postMoment();
      if (result) console.log('[AutoMoments] 发帖成功:', result.content ? result.content.slice(0, 20) : '');
    } catch (e) { console.warn('[AutoMoments] 发帖失败:', e); }
    localStorage.setItem(_LAST_MOMENT_KEY, String(Date.now()));
    var h = await getCfg(AM.interval) || 4;
    _timer = setTimeout(tick, h * 3600000);
  }, intervalMs);
  console.log('[AutoMoments] 定时器已启动，间隔' + hours + '小时');
}

function stopScheduler() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

/* ══════════════════════════════════════════════════
   核心：生成并发布朋友圈
   v3: ownerUid 始终使用 window._wechatUid，不降级到 getCfg
   ══════════════════════════════════════════════════ */

/* 补回：一次API生成N条朋友圈（省API！） */
async function catchUpMoments(count) {
  console.log('[AutoMoments] catchUpMoments count=' + count);
  if (!window.callAI) { console.warn('[AutoMoments] callAI不可用'); return 0; }

  // 记忆联通：加载角色记忆
  var memCtx = '';
  try {
    if (window.WanWanMemory && window.WanWanMemory.getMemoryContext) {
      memCtx = await window.WanWanMemory.getMemoryContext(null, char.id, window._wechatUid, []);
    }
  } catch(e) {}
  var charIds = await getCfg(AM.chars) || [];
  if (!charIds.length) { console.warn('[AutoMoments] 未配置发帖角色'); return 0; }
  var mode = await getCfg(AM.mode) || 'daily';
  var chars = [];
  for (var ci = 0; ci < charIds.length; ci++) {
    var c = await window.db.characters.get(charIds[ci]);
    if (c) chars.push(c);
  }
  if (!chars.length) return 0;
  var picked = [];
  for (var i = 0; i < count; i++) picked.push(chars[Math.floor(Math.random() * chars.length)]);
  var charDescs = picked.map(function(c, i) { return (i+1) + '. ' + c.name; }).join(', ');
  var modeDesc = mode === 'daily' ? '80%日常+20%提到用户' : '50%日常+50%提到用户';
  // 获取其他AI角色
    var otherAI = [];
  try { otherAI = (await window.db.characters.where('type').equals('char').toArray()).filter(function(c) { return picked.indexOf(c) === -1; }); } catch(_) {}
  var aiNames = otherAI.map(function(c) { return c.name; }).join('\u3001') || '\u5c0f\u7f8e\u3001\u963f\u6770';

  var prompt = '\u4e3a\u4ee5\u4e0b' + count + '\u4e2a\u89d2\u8272\u5404\u751f\u62101\u6761\u670b\u53cb\u5708\u3002\u89d2\u8272\uff1a' + charDescs + '\u3002\u65b9\u5411\uff1a' + modeDesc + '\u3002\u6bcf\u67611-3\u53e5\u4e0d\u8d85\u8fc780\u5b57\uff0c\u53e3\u8bed\u5316\u81ea\u7136\u3002\n\n' +
    '\u3010\u8bc4\u8bba\u89c4\u5219\u3011\n' +
    '- \u6bcf\u6761\u914d5\u6761\u8bc4\u8bba\n' +
    '- \u8bc4\u8bba\u4eba\u5fc5\u987b\u7528\u771f\u5b9e\u540d\u5b57\uff1a' + aiNames + '\n' +
    '- \u53d1\u5e16\u89d2\u8272\u5fc5\u987b\u56de\u590d\u5176\u4e2d2-3\u6761\u8bc4\u8bba\n' +
    '- \u88ab\u56de\u590d\u7684\u4eba\u53ef\u4ee5\u518d\u56de\u590d\uff0c\u5f62\u6210\u5bf9\u8bdd\n\n' +
    '\u8fd4\u56deJSON\uff1a{posts:[{text:\u6587\u6848,likes:[\u4eba\u540d],comments:[{from:\u4eba,to:null,text:\u8bc4\u8bba}]}]}';

try {
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object' });
  if (memCtx) prompt += '\u89d2\u8272\u8bb0\u5fc6\uff1a\n' + memCtx.slice(0, 500) + '\n\n';
    var data = parseJSON(raw);
    if (!data || !Array.isArray(data.posts)) {
      console.warn('[AutoMoments] AI返回格式错误:', raw ? raw.slice(0, 100) : 'null');
      return 0;
    }
    var ok = 0;
    var ownerUid = window._wechatUid || null;
    console.log('[AutoMoments] catchUp ownerUid=' + ownerUid + ' (window._wechatUid=' + window._wechatUid + ')');
    for (var pi = 0; pi < data.posts.length; pi++) {
      var p = data.posts[pi];
      if (!p || !p.text) continue;
      var char = picked[pi] || picked[0];
      var ts = Date.now();
      var moment = {
        charId: char.id,
        ownerUid: ownerUid || String(char.id),
        content: p.text,
        images: [],
        likes: Array.isArray(p.likes) ? p.likes.map(function(n, li) { return { uid: 'npc_' + li, name: String(n), createdAt: ts }; }) : [{uid:'npc_0',name:'点赞人',createdAt:ts}],
        comments: normalizeComments(p.comments, char.name).map(function(c, ci) {
          return { id: 'cmt_' + ts + '_' + ci + '_' + pi, uid: c.from === char.name ? 'char_' + char.id : 'npc_' + ci, name: c.from, replyToId: c.to ? 'cmt_prev' : '', replyToName: c.to || '', text: c.text, createdAt: ts + ci * 1000 };
        }),
        createdAt: ts - (count - pi) * 60000
      };
      // 确保至少有一条评论
      if (!moment.comments.length) {
        moment.comments = [{id:'cmt_'+ts+'_d_'+pi, uid:'npc_0', name:(otherAI[0] && otherAI[0].name) || '小美', replyToId:'', replyToName:'', text:'哈哈', createdAt:ts}];
      }
      await window.db.moments.put(moment);
      ok++;
      console.log('[AutoMoments] 补回成功:', char.name, p.text.slice(0, 30));
    }
    if (ok > 0) refreshMomentsPage();
    return ok;
  } catch(e) { console.warn('[AutoMoments] catchUpMoments失败:', e); return 0; }
}

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
  var sys = await buildPrompt(char, mode, commentsOn, relations, opts.manual);
  var msgs = [{ role: 'system', content: sys }];
  var userMsg = opts.userMsg || '请生成一条朋友圈动态。';
  if (chatCtx) userMsg += '\n\n最近聊天参考：\n' + chatCtx;
  msgs.push({ role: 'user', content: userMsg });

  try {
    var raw = await window.callAI(msgs, { responseFormat: 'json_object', charAntiDrift: true });
    var data = parseJSON(raw);
    if (!data || !data.text) return null;

    /* 配图 */
    if (imagesOn && data.imagesDesc && data.imagesDesc.length) {
      await genImages(char, data);
    }

    /* 构造 moment 并持久化（格式匹配 buildMomentCardHTML） */
    var ownerUid = window._wechatUid || null;
    console.log('[AutoMoments] postMoment ownerUid=' + ownerUid);
    var ts = Date.now();
    var moment = {
      charId:    charId,
      ownerUid:  ownerUid || String(charId),
      content:   data.text,
      images:    (data.imagesDesc || []).map(function(desc) {
        return { src: '', desc: desc };
      }),
      likes:     Array.isArray(data.likes) ? data.likes.map(function(name, i) {
        return { uid: 'npc_' + i, name: name, createdAt: ts };
      }) : [{uid:'npc_0',name:'点赞人',createdAt:ts}],
      comments:  normalizeComments(data.comments, char.name).map(function(c, i) {
        return {
          id:        'cmt_' + ts + '_' + i,
          uid:       c.from === char.name ? 'char_' + charId : 'npc_' + i,
          name:      c.from,
          replyToId: c.to ? 'cmt_prev' : '',
          replyToName: c.to || '',
          text:      c.text,
          createdAt: ts + i * 1000
        };
      }),
      createdAt: ts
    };
    // 确保至少有一条评论
    if (!moment.comments.length) {
      moment.comments = [{id:'cmt_'+ts+'_d', uid:'npc_0', name:'小美', replyToId:'', replyToName:'', text:'哈哈', createdAt:ts}];
    }
    await window.db.moments.put(moment);

    // 批量记忆：记录朋友圈互动
    if (window.addToBatchMemory && window.checkAndFlushBatchMemory) {
      var commentSummary = (moment.comments || []).map(function(c) {
        return c.name + (c.replyToName ? '回复' + c.replyToName : '') + '：' + c.text;
      }).slice(0, 3).join('；');
      var likeSummary = (moment.likes || []).map(function(l) { return l.name; }).slice(0, 5).join('、');
      addToBatchMemory('moments', charId, {
        title: char.name + '发了朋友圈',
        content: char.name + '发了一条朋友圈："' + data.text.slice(0, 60) + '"' +
          (commentSummary ? '。评论：' + commentSummary : '') +
          (likeSummary ? '。点赞：' + likeSummary : ''),
        keywords: ['朋友圈', char.name]
      });
      checkAndFlushBatchMemory('moments', charId);
    }

    console.log('[AutoMoments] 已发布:', char.name, data.text.slice(0, 30));
    window.toast && window.toast('[朋友圈] 已发布: ' + char.name);
    // 写入记忆：发帖角色记住自己发了朋友圈，评论的角色也记住
    try {
      var posterName = char.nick || char.name;
      var commentNames = (moment.comments || []).map(function(c) { return c.name; }).filter(function(n) { return n && n !== posterName; });
      // 发帖角色的记忆
      if (db.memories && window._wechatUid) {
        await db.memories.add({
          ownerUid: window._wechatUid, charId: char.id, chatId: 'moments_' + char.id,
          title: posterName + '发了朋友圈',
          content: posterName + '发了一条朋友圈："' + data.text.slice(0, 60) + '"' + (commentNames.length ? '。' + commentNames.join('、') + '来评论了。' : ''),
          keywords: ['朋友圈', posterName], valence: 0.3, arousal: 0.2, importance: 4,
          sourceType: 'moments', status: 'active', decayPercent: 80, injectionLayer: 2,
          createdAt: Date.now(), updatedAt: Date.now()
        });
        // 评论的AI角色也记住
        var uniqueCommenters = [];
        (moment.comments || []).forEach(function(c) {
          if (c.uid && c.uid.indexOf('char_') === 0 && uniqueCommenters.indexOf(c.name) === -1) {
            uniqueCommenters.push(c.name);
          }
        });
      }
    } catch(memErr) { console.warn('[AutoMoments] 记忆写入失败:', memErr); }

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
    var from = c.from;
    // If this is a reply (has 'to'), force from to be the poster
    if (c.to && from !== charName) {
      from = charName;
    }
    return {
      from: from,
      to:   c.to || null,
      text: String(c.text).slice(0, 120)
    };
  });
}

async function buildPrompt(char, mode, commentsOn, relations, isManual) {
  var p = '你是一个真实的人，正在发朋友圈。你的朋友圈必须有真人感、活人感。\n\n';
  p += '【你的信息】\n';
  p += '名字：' + char.name + '\n';
  if (char.description) p += '人设：' + char.description.slice(0, 500) + '\n';
  if (char.personality) p += '性格：' + char.personality.slice(0, 150) + '\n';

  // 从人设中提取有名字的人物
  var personaPeople = [];
  try {
    var desc = char.description || '';
    var namePatterns = desc.match(/(?:闺蜜|朋友|同学|同事|室友|兄弟|姐妹|哥哥|姐姐|弟弟|妹妹|妈妈|爸爸|老师|师傅|老板|上司|邻居|青梅竹马|男朋友|女朋友|老公|老婆|前任|暗恋对象|死党|好友)[叫是名为]?\s*([\u4e00-\u9fa5]{2,4})/g);
    if (namePatterns) {
      namePatterns.forEach(function(m) {
        var name = m.replace(/^[^\u4e00-\u9fa5]+/, '').trim();
        if (name && name.length >= 2 && personaPeople.indexOf(name) === -1) personaPeople.push(name);
      });
    }
  } catch(_) {}

  // 获取其他AI角色
  var otherChars = [];
  try {
    var allChars = await window.db.characters.where('type').equals('char').toArray();
    otherChars = allChars.filter(function(c) { return c.id !== char.id; }).slice(0, 5);
  } catch(_) {}

  // 从relations中获取关系角色
  var relChars = [];
  if (char.relations && char.relations.length) {
    for (var ri = 0; ri < char.relations.length; ri++) {
      var r = char.relations[ri];
      if (r.charId) {
        try {
          var rc = await window.db.characters.get(parseInt(r.charId));
          if (rc && rc.name && relChars.indexOf(rc.name) === -1) relChars.push(rc.name);
        } catch(_) {}
      }
    }
  }

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

  p += '\n【评论规则】\n';
  p += '- 生成5条评论\n';

  var allCommenters = personaPeople.concat(relChars.filter(function(n) { return personaPeople.indexOf(n) === -1; }));
  if (allCommenters.length) {
    p += '- 【评论人必须从以下人设中的真实人物中选取】：' + allCommenters.join('、') + '\n';
    p += '- 这些人都是' + char.name + '人设里提到的真实存在的人\n';
    p += '- 根据他们与' + char.name + '的关系写评论（闺蜜→亲密调侃，同事→吐槽，家人→关心）\n';
  }
  if (otherChars.length) {
    var otherInfo = otherChars.map(function(oc) {
      var rel = (char.relations || []).find(function(r) { return parseInt(r.charId) === oc.id; });
      return oc.name + (rel && rel.type ? '（' + rel.type + '）' : '');
    }).join('、');
    p += '- 其他AI角色也会来评论：' + otherInfo + '\n';
  }
  p += '- 【极其重要】回复别人的评论，from必须是' + char.name + '（发帖人本人）\n';
  p += '- ' + char.name + '必须回复其中2-3条评论\n';
  p += '- 被回复的人可以再回复' + char.name + '，形成2层对话\n';

  if (isManual) {
    p += '\n- 这是用户主动让你发的，内容可以更丰富一点\n';
  }

  p += '\n【输出JSON格式】\n';
  p += '{"text":"文案","imagesDesc":["配图描述"],"likes":["点赞人"],"comments":[{"from":"人名","to":null,"text":"评论"},{"from":"' + char.name + '","to":"人名","text":"回复"}]}';

  return p;
}

function refreshMomentsPage() {
  console.log('[AutoMoments] refreshMomentsPage 调用');
  try {
    var mp = document.querySelector('.wechat-moments-page');
    if (!mp) {
      console.log('[AutoMoments] 未找到 .wechat-moments-page，可能不在朋友圈页面');
      return;
    }
    if (typeof window.renderMomentsList === 'function') {
      var wp = mp._wechatPage || document.querySelector('.wechat-page');
      console.log('[AutoMoments] 调用 renderMomentsList, wp=' + !!wp);
      window.renderMomentsList(mp, wp);
    } else {
      console.warn('[AutoMoments] renderMomentsList 不可用，尝试滚动触发');
      // 降级：滚动到顶部触发可能的IntersectionObserver刷新
      var list = mp.querySelector('#moments-list');
      if (list) list.scrollTop = 0;
      mp.scrollTop = 0;
    }
  } catch (e) {
    console.warn('[AutoMoments] refreshMomentsPage失败:', e);
  }
}

/* ══════════════════════════════════════════════════
   公开接口
   ══════════════════════════════════════════════════ */

// === AI批量发帖（一次API生成多条）===
async function batchPostMoments(charIds, countPerChar) {
  if (!window.callAI) { window.toast && window.toast('AI服务未配置'); return 0; }
  if (!charIds || !charIds.length) { window.toast && window.toast('请选择角色'); return 0; }

  var chars = [];
  for (var i = 0; i < charIds.length; i++) {
    var c = await window.db.characters.get(charIds[i]);
    if (c) chars.push(c);
  }
  if (!chars.length) { window.toast && window.toast('未找到角色'); return 0; }

  var totalCount = chars.length * countPerChar;
  var charDescs = chars.map(function(c, i) {
    return (i+1) + '. ' + c.name + ' (' + (c.description || (c.identity && c.identity.bio) || '').slice(0, 50) + ')';
  }).join('\n');

  var relations = [];
  chars.forEach(function(c) {
    (c.relations || []).forEach(function(r) {
      if (r.desc || r.type) relations.push(r.desc || r.type);
    });
  });
  var relStr = relations.length ? relations.slice(0, 5).join('、') : '小美';

  // 获取所有AI角色信息
  var allAIChars = [];
  try { allAIChars = await window.db.characters.where('type').equals('char').toArray(); } catch(_) {}

  var prompt = '为以下' + chars.length + '个角色各生成' + countPerChar + '条朋友圈。\n\n' +
    '角色：\n' + charDescs + '\n\n' +
    '评论人可选（各有独特人设）：' + relStr + "\n\n" +
    '评论人人设：\n' + allAIChars.map(function(c){return c.name+"："+((c.description||c.persona||"").slice(0,50))}).join("\n") + "\n\n" +
     + '\n\n' +
    '要求：\n' +
    '1. 每条1-3句，不超过80字，口语化自然\n' +
    '2. 每条配5条评论。评论人来源：角色的关系人 + 其他AI角色（' + allAIChars.map(function(c) { return c.name; }).filter(function(n) { return n; }).join('、') + '）\n' +
    '3. 角色回复其中1-2条评论\n' +
    '4. 不同角色的朋友圈风格要不同\n\n' +
    '返回JSON：\n' +
    '{"posts":[{"charIndex":0,"text":"文案","likes":["点赞人"],"comments":[{"from":"人","to":null,"text":"评论"}]}]}';

  window.toast && window.toast('正在生成' + totalCount + '条朋友圈...');
  try {
    var raw = await window.callAI([{role:'user',content:prompt}], {responseFormat:'json_object', charAntiDrift:true});
  if (memCtx) prompt += '\u89d2\u8272\u8bb0\u5fc6\uff1a\n' + memCtx.slice(0, 500) + '\n\n';
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g,'').replace(/```/g,'').trim()) : raw;
    if (!data || !data.posts || !data.posts.length) { window.toast && window.toast('AI未返回内容'); return 0; }

    var ownerUid = window._wechatUid || null;
    var ok = 0;
    for (var pi = 0; pi < data.posts.length; pi++) {
      var p = data.posts[pi];
      if (!p || !p.text) continue;
      var charIdx = (typeof p.charIndex === 'number') ? p.charIndex : (pi % chars.length);
      var char = chars[charIdx] || chars[0];
      var ts = Date.now();
      var moment = {
        charId: char.id,
        ownerUid: ownerUid || String(char.id),
        content: p.text,
        images: [],
        likes: Array.isArray(p.likes) ? p.likes.map(function(n, li) { return {uid:'npc_'+li, name:String(n), createdAt:ts}; }) : [{uid:'npc_0',name:'点赞人',createdAt:ts}],
        comments: normalizeComments(p.comments, char.name).map(function(c, ci) {
          return {id:'cmt_'+ts+'_'+ci+'_'+pi, uid:c.from===char.name?'char_'+char.id:'npc_'+ci, name:c.from, replyToId:c.to?'cmt_prev':'', replyToName:c.to||'', text:c.text, createdAt:ts+ci*1000};
        }),
        createdAt: ts - (data.posts.length - pi) * 60000
      };
      if (!moment.comments.length) {
        moment.comments = [{id:'cmt_'+ts+'_d_'+pi, uid:'npc_0', name:(otherAI[0] && otherAI[0].name) || '小美', replyToId:'', replyToName:'', text:'哈哈', createdAt:ts}];
      }
      await window.db.moments.put(moment);
      ok++;
    }
    window.toast && window.toast('已生成' + ok + '条朋友圈');
    if (ok > 0) refreshMomentsPage();
    return ok;
  } catch(e) {
    console.warn('[AutoMoments] batchPostMoments失败:', e);
    window.toast && window.toast('生成失败：' + (e.message || '未知错误'));
    return 0;
  }
}

// === AI发帖弹窗 ===
window.showMomentsBatchDialog = async function() {
  var old = document.getElementById('am-batch-dialog');
  if (old) { old.remove(); return; }

  var chars = [];
  try { chars = await window.db.characters.where('type').equals('char').toArray(); } catch(e) {}

  var overlay = document.createElement('div');
  overlay.id = 'am-batch-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:100001;display:flex;align-items:flex-end;justify-content:center;';

  var backdrop = document.createElement('div');
  backdrop.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);';
  backdrop.onclick = function() { overlay.remove(); };
  overlay.appendChild(backdrop);

  var card = document.createElement('div');
  card.style.cssText = 'position:relative;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;background:#f7f5f4;border-radius:20px 20px 0 0;animation:am-slide-up 280ms cubic-bezier(0.23,1,0.32,1);';

  var selectedCount = 1;

  card.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px 12px;border-bottom:1px solid rgba(0,0,0,0.06)">' +
      '<div style="font-size:16px;font-weight:600;color:#2d2b2e">AI发朋友圈</div>' +
      '<button class="am-batch-close" style="background:none;border:none;font-size:18px;color:#8b8589;cursor:pointer;padding:4px 8px">关闭</button>' +
    '</div>' +
    '<div style="padding:14px 20px">' +
      '<div style="font-size:13px;font-weight:500;color:#8b8589;margin-bottom:10px">选择角色</div>' +
      '<div class="am-batch-chars" style="display:flex;flex-wrap:wrap;gap:8px">' +
        chars.map(function(c) {
          return '<label class="am-batch-pill" data-id="' + c.id + '" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;border-radius:20px;border:1px solid rgba(0,0,0,0.12);background:#8b8589;color:#fff;cursor:pointer;font-size:13px;transition:all 150ms ease-out"><input type="checkbox" checked style="display:none"><span>' + esc(c.nick || c.name) + '</span></label>';
        }).join('') +
      '</div>' +
    '</div>' +
    '<div style="padding:0 20px 14px">' +
      '<div style="font-size:13px;font-weight:500;color:#8b8589;margin-bottom:10px">每人发几条</div>' +
      '<div class="am-batch-counts" style="display:flex;gap:8px">' +
        '<button class="am-count-btn active" data-val="1" style="padding:6px 16px;border-radius:16px;border:1px solid #8b8589;background:#8b8589;color:#fff;font-size:13px;cursor:pointer">1条</button>' +
        '<button class="am-count-btn" data-val="2" style="padding:6px 16px;border-radius:16px;border:1px solid rgba(0,0,0,0.12);background:transparent;color:#2d2b2e;font-size:13px;cursor:pointer">2条</button>' +
        '<button class="am-count-btn" data-val="3" style="padding:6px 16px;border-radius:16px;border:1px solid rgba(0,0,0,0.12);background:transparent;color:#2d2b2e;font-size:13px;cursor:pointer">3条</button>' +
        '<button class="am-count-btn" data-val="5" style="padding:6px 16px;border-radius:16px;border:1px solid rgba(0,0,0,0.12);background:transparent;color:#2d2b2e;font-size:13px;cursor:pointer">5条</button>' +
      '</div>' +
    '</div>' +
    '<div style="padding:0 20px 24px">' +
      '<button class="am-batch-confirm" style="width:100%;padding:12px;border:none;border-radius:12px;background:#8b8589;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:transform 150ms ease-out">立即生成</button>' +
    '</div>';

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Close
  card.querySelector('.am-batch-close').onclick = function() { overlay.remove(); };

  // Count selection
  card.querySelectorAll('.am-count-btn').forEach(function(btn) {
    btn.onclick = function() {
      selectedCount = parseInt(btn.dataset.val) || 1;
      card.querySelectorAll('.am-count-btn').forEach(function(b) {
        var isActive = b === btn;
        b.style.background = isActive ? '#8b8589' : 'transparent';
        b.style.color = isActive ? '#fff' : '#2d2b2e';
        b.style.borderColor = isActive ? '#8b8589' : 'rgba(0,0,0,0.12)';
      });
    };
  });

  // Character pill toggle
  card.querySelectorAll('.am-batch-pill').forEach(function(label) {
    var cb = label.querySelector('input');
    label.onclick = function(e) {
      e.preventDefault();
      cb.checked = !cb.checked;
      label.style.background = cb.checked ? '#8b8589' : 'transparent';
      label.style.color = cb.checked ? '#fff' : '#2d2b2e';
      label.style.borderColor = cb.checked ? '#8b8589' : 'rgba(0,0,0,0.12)';
    };
  });

  // Confirm
  card.querySelector('.am-batch-confirm').onclick = async function() {
    var selectedIds = [];
    card.querySelectorAll('.am-batch-pill input:checked').forEach(function(cb) {
      selectedIds.push(parseInt(cb.closest('.am-batch-pill').dataset.id));
    });
    if (!selectedIds.length) { window.toast && window.toast('请至少选一个角色'); return; }

    var btn = card.querySelector('.am-batch-confirm');
    btn.disabled = true;
    btn.textContent = '生成中...';

    await batchPostMoments(selectedIds, selectedCount);
    overlay.remove();
  };
};


window.AutoMoments = {
  post:       postMoment,

  checkChat:  async function (charId) {
    if (!await getCfg(AM.enabled)) return;
    // 有感而发对所有角色都生效，不限于自动发帖角色
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

// === 打开设置面板 ===
function openSettingsPanel() {
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
}

// === 自动注入按钮到朋友圈页面 ===
function injectMomentsButton() {
  // 找到朋友圈header中的发帖按钮
  var postBtn = document.querySelector('#btn-post-moment-top');
  if (!postBtn) return;
  // 检查是否已经注入过
  if (document.querySelector('#am-settings-btn')) return;
  // 创建按钮
  var btn = document.createElement('button');
  btn.id = 'am-settings-btn';
  btn.className = 'moments-nav-btn';
  btn.style.marginRight = '4px';
  btn.setAttribute('aria-label', '自动朋友圈设置');
  btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>';
  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    openSettingsPanel();
  });
  // AI批量发帖按钮
  var batchBtn = document.createElement('button');
  batchBtn.id = 'am-batch-btn';
  batchBtn.className = 'moments-nav-btn';
  batchBtn.style.marginRight = '4px';
  batchBtn.setAttribute('aria-label', 'AI发帖');
  batchBtn.innerHTML = '<i class="fa-solid fa-robot"></i>';
  batchBtn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (window.showMomentsBatchDialog) window.showMomentsBatchDialog();
  });
  // 插入到发帖按钮前面
  postBtn.parentNode.insertBefore(btn, postBtn);
  postBtn.parentNode.insertBefore(batchBtn, postBtn);
  console.log('[AutoMoments] 按钮已注入');
}

// === 用MutationObserver监听页面变化 ===
var _injectTimer = null;
var observer = new MutationObserver(function() {
  if (_injectTimer) clearTimeout(_injectTimer);
  _injectTimer = setTimeout(injectMomentsButton, 300);
});
observer.observe(document.body, { childList: true, subtree: true });

async function initScheduler() {
  try {
    if (await getCfg(AM.enabled)) {
      console.log('[AutoMoments] 启动调度器');
      startScheduler();
    }
  } catch (e) {
    console.error('[AutoMoments] 初始化失败:', e);
  }
}
setTimeout(initScheduler, 2000);

// === Service Worker 注册 ===
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    console.log('[AutoMoments] SW registered');
    // 发送启动消息
    if (reg.active) {
      reg.active.postMessage('start');
    }
    reg.addEventListener('updatefound', function() {
      var newWorker = reg.installing;
      newWorker.addEventListener('statechange', function() {
        if (newWorker.state === 'activated') {
          newWorker.postMessage('start');
        }
      });
    });
  }).catch(function(e) {
    console.error('[AutoMoments] SW注册失败:', e);
  });

  // 监听SW消息
  navigator.serviceWorker.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'auto-moments-check') {
      console.log('[AutoMoments] 收到SW唤醒信号，检查发帖');
      if (typeof startScheduler === 'function') {
        startScheduler();
      }
    }
  });
}


// 初始尝试注入
setTimeout(injectMomentsButton, 1000);


} catch(amErr) {
  console.error('[AutoMoments] 加载错误:', amErr);
  // 屏幕显示错误
  window._amLastError = amErr;
}
})();