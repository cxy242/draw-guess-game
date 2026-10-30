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
var _inflight = false; /* [v1.1修复·竞态] tick 在途标志 */

async function startScheduler(){
  stopScheduler();if(!await getCfg(AM.enabled))return;
  try{await catchUpMoments(10)}catch(e){console.warn('[AutoMoments] 积压保留待重试',e);window.toast&&toast('朋友圈补回未完成，稍后重试')}
  _timer=setTimeout(async function tick(){
    if(!await getCfg(AM.enabled))return;
    try{await catchUpMoments(10)}catch(e){console.warn('[AutoMoments] 待重试',e)}
    _timer=setTimeout(tick,60000);
  },60000);
}

function stopScheduler() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}

/* ══════════════════════════════════════════════════
   核心：生成并发布朋友圈
   v3: ownerUid 始终使用 window._wechatUid，不降级到 getCfg
   ══════════════════════════════════════════════════ */

/* 补回：一次API生成N条朋友圈（省API！） */
/* [v1.3修复·P0] getRecentChat 幽灵函数复活（.bak 原文完整搬回，单发三路救命）
   祖传病：某次合并把定义弄丢，L366 裸调用 → postMoment 一进就 ReferenceError */
/* [v1.3修复·P0] genImages 幽灵函数复活（同 getRecentChat 祖传合并事故，配图路径救命）
   L404 裸调用，无定义时 imagesOn 开启必 ReferenceError */
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

async function getRecentChat(charId, charName) {
  try {
    var uid = (window._wechatUid || await getCfg('currentUserId'));
    if (!uid) return '';
    var chat = await window.db.chats.where({ charId: charId, ownerUid: uid }).first();
    if (!chat) return '';
    var msgs = await window.db.messages.where('chatId').equals(chat.id).reverse().limit(8).toArray();
    return msgs.reverse().map(function (m) {
      return (m.role === 'user' ? '用户' : charName) + '：' + (m.content || '').slice(0, 60);
    }).join('\n');
  } catch (_) { return ''; }
}

async function catchUpMoments(count){
  var user=await WanWanIdentity.currentUser();
  return WanWanRuntime.withLock('moments-schedule:'+user.id,async function(){
    var ids=await getCfg(AM.chars)||[];var chars=[];
    for(var id of ids){var c=await db.characters.get(Number(id)||id);if(c&&c.type!=='user')chars.push(c)}
    if(!chars.length)return 0;
    var interval=Math.max(1,Number(await getCfg(AM.interval))||4)*3600000;
    var key='schedule:moments:'+user.id;var state=await WanWanRuntime.config(key,null),now=WanWanRuntime.now();
    if(!state){var old=Number(localStorage.getItem(_LAST_MOMENT_KEY));state={lastPlan:old?old+(now-Date.now()):now};await WanWanRuntime.put(key,state)}
    var n=0;_inflight=true;
    try{
      while(state.lastPlan+interval<=now&&n<Math.min(10,count||10)){
        var slot=state.lastPlan+interval;var c=chars[Math.floor(slot/interval)%chars.length];
        await postMoment({charId:c.id,slot:slot,ownerUid:user.id,jobId:'am_'+user.id+'_'+slot});
        state={lastPlan:slot};await WanWanRuntime.put(key,state);n++;
      }
    }finally{_inflight=false}
    if(n)refreshMomentsPage();return n;
  });
}
async function postMoment(opts){
  opts=opts||{};
  var user=await WanWanIdentity.currentUser(opts.ownerUid?{id:opts.ownerUid}:null);
  var ids=await getCfg(AM.chars)||[];var id=opts.charId||ids[Math.floor(Math.random()*ids.length)];
  var char=await db.characters.get(Number(id)||id);if(!char)throw new Error('请先选择发帖角色');
  var slot=opts.slot==null?WanWanRuntime.now():opts.slot;
  var jobId=opts.jobId||'manual_'+user.id+'_'+Date.now()+'_'+Math.random();
  var existing=await WanWanRuntime.config('job:'+jobId,null);if(existing)return db.moments.get(existing);
  var data=await WanWanSocial.generate(char,slot,(opts.userMsg||'朋友圈：自然日常与用户相关经历皆可，不要重复学校等单一话题'),user.id);
  var rows=await WanWanSocial.comments(data.comments||[],char,jobId,slot);
  var moment={ownerUid:user.id,charId:char.id,content:data.content,images:[],likes:[],comments:rows.map(function(c){return{id:c.id,uid:/^\d+$/.test(c.authorId)?Number(c.authorId):c.authorId,name:c.authorName,avatar:c.authorAvatar,replyToId:c.replyTo,replyToName:c.replyToName,text:c.content,createdAt:new Date(c.createdAt).getTime()}}),createdAt:slot,realCreatedAt:Date.now(),jobId:jobId};
  await db.transaction('rw',db.moments,db.memories,db.config,async function(){
    var done=await db.config.get('job:'+jobId);if(done){moment=await db.moments.get(done.value);return;}
    moment.id=await db.moments.add(moment);
    var participants=new Set([char.id]);rows.filter(function(c){return !c.isNpc}).forEach(function(c){participants.add(Number(c.authorId)||c.authorId)});
    for(var participant of participants)await db.memories.add({ownerUid:user.id,charId:participant,chatId:'moments_'+moment.id,title:char.name+'的朋友圈',content:data.content,sourceType:'moments',sourceAt:slot,createdAt:slot,realCreatedAt:Date.now(),updatedAt:slot,status:'active',decayPercent:80,importance:4,arousal:0.2,injectionLayer:2,keywords:['朋友圈'],participants:Array.from(participants)});
    await db.config.put({key:'job:'+jobId,value:moment.id});
  });
  refreshMomentsPage();return moment;
}

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
async function batchPostMoments(charIds,countPerChar){
  var count=0;
  for(var id of charIds||[])for(var i=0;i<Math.max(1,Number(countPerChar)||1);i++){await postMoment({charId:Number(id)||id,manual:true});count++}
  window.toast&&toast('已保存'+count+'条朋友圈');return count;
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

    try { await batchPostMoments(selectedIds, selectedCount); overlay.remove(); } catch(e) { btn.disabled=false;btn.textContent="重试生成";window.toast&&toast(e.message); }
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
  (window.registerWanWanServiceWorker ? window.registerWanWanServiceWorker() : navigator.serviceWorker.register('service.js')).then(function(reg) {
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
    /* [死链修复v1·A方案] sw.js 从不发 auto-moments-check（死链实锤 2026-10-04），
       改为复用现成 keepalive-ping 心跳（sw.js 每 2 分钟发一次）顺带查发帖时机。
       与 tick 共用 _LAST_MOMENT_KEY 的 elapsed 判断，天然防重：
       页面开着时 tick 定时器管，页面重开/后台场景由心跳兜底。 */
    if (e.data && e.data.type === 'keepalive-ping') {
      (async function () {
        try {
          if (!await getCfg(AM.enabled)) return;
          if (_inflight) { return; } /* [v1.1修复·竞态] 发帖在途，跳过防双发 */
          var now = Date.now();
          var last = parseInt(localStorage.getItem(_LAST_MOMENT_KEY) || '0');
          var h = await getCfg(AM.interval) || 4;
          var intervalMs = h * 3600000;
          if (last && now - last >= intervalMs) {
            console.log('[AutoMoments] keepalive 兜底检查：已到发帖时机，补发');
            startScheduler(); /* 内部自带补回+tick，会更新 _LAST_MOMENT_KEY 防重 */
          }
        } catch (e) { console.warn('[AutoMoments] keepalive 兜底检查失败:', e); }
      })();
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