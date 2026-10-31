// ============================================================
// shili.js — 拾礼：礼物收送 · 拆封 · 珍藏柜 · 纪念日
// 入口：window.showShiliPage()
// 数据：localStorage（shili_ 前缀）；角色/消息联动 Dexie WanWanDB
// ============================================================
(function () {
  'use strict'

  // ================= 样式（sl- 前缀，防类名撞车） =================
  var SL_CSS = '\
#shili-page{position:absolute;inset:0;z-index:600;display:flex;flex-direction:column;\
  background:linear-gradient(160deg,#f6f0ff 0%,#fdf1f6 55%,#fff6ef 100%);color:#3a3344;\
  font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}\
#shili-page *{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}\
.sl-top{flex-shrink:0;padding:14px 14px 10px;display:flex;align-items:center;gap:10px;\
  background:linear-gradient(135deg,#a78bfa,#f472b6);color:#fff;}\
.sl-top .sl-back{background:rgba(255,255,255,.18);border:none;color:#fff;width:34px;height:34px;\
  border-radius:50%;font-size:18px;cursor:pointer;flex-shrink:0;}\
.sl-top h1{font-size:19px;letter-spacing:2px;}\
.sl-top .sl-sub{font-size:10px;opacity:.85;margin-left:auto;text-align:right;line-height:1.5;}\
.sl-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px 14px 84px;}\
.sl-page{display:none;animation:slFade .22s ease;}\
.sl-page.sl-active{display:block;}\
@keyframes slFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}\
.sl-h2{font-size:17px;margin:14px 0 8px;color:#7c3aed;display:flex;align-items:center;gap:6px;}\
.sl-h3{font-size:13px;margin:12px 0 6px;color:#be185d;}\
.sl-card{background:#fff;border-radius:16px;padding:13px;margin:9px 0;\
  box-shadow:0 4px 16px rgba(160,120,220,.10);}\
.sl-gitem{display:flex;gap:11px;align-items:center;cursor:pointer;}\
.sl-gitem img{width:60px;height:60px;border-radius:12px;object-fit:cover;background:#f3e8ff;flex-shrink:0;}\
.sl-gitem .sl-gph{width:60px;height:60px;border-radius:12px;background:#f3e8ff;flex-shrink:0;\
  display:flex;align-items:center;justify-content:center;font-size:26px;}\
.sl-gitem .sl-gname{font-size:14px;font-weight:600;}\
.sl-gitem .sl-gmeta{font-size:11px;color:#9a86b8;margin-top:3px;}\
.sl-gitem .sl-gtag{display:inline-block;font-size:10px;padding:2px 8px;border-radius:99px;\
  background:#ede9fe;color:#7c3aed;margin-top:4px;}\
.sl-empty{text-align:center;color:#b9a8d4;font-size:12px;padding:20px 0;}\
.sl-stats{display:flex;gap:9px;}\
.sl-stat{flex:1;background:linear-gradient(135deg,#a78bfa,#c084fc);color:#fff;\
  border-radius:16px;padding:12px 8px;text-align:center;box-shadow:0 6px 16px rgba(140,90,220,.25);}\
.sl-stat.sl-pink{background:linear-gradient(135deg,#f472b6,#fb7185);}\
.sl-stat .sl-num{font-size:23px;font-weight:800;}\
.sl-stat .sl-lbl{font-size:10px;opacity:.9;margin-top:2px;}\
.sl-label{display:block;font-size:12px;color:#8b5cf6;margin:11px 0 4px;font-weight:600;}\
.sl-input,.sl-select,.sl-textarea{width:100%;border:2px solid #ece2fb;border-radius:12px;\
  padding:10px 11px;font-size:13px;background:#fff;color:#3a3344;outline:none;\
  font-family:inherit;}\
.sl-input:focus,.sl-select:focus,.sl-textarea:focus{border-color:#c084fc;}\
.sl-textarea{min-height:64px;resize:vertical;}\
.sl-row2{display:flex;gap:9px;}\
.sl-row2>*{flex:1;}\
.sl-btn{border:none;border-radius:99px;padding:11px 20px;font-size:14px;font-weight:600;\
  cursor:pointer;background:linear-gradient(135deg,#a78bfa,#f472b6);color:#fff;\
  box-shadow:0 6px 16px rgba(160,110,220,.30);transition:transform .12s;font-family:inherit;}\
.sl-btn:active{transform:scale(.95);}\
.sl-btn.sl-big{width:100%;padding:14px;font-size:16px;margin-top:15px;}\
.sl-btn.sl-ghost{background:#fff;color:#8b5cf6;border:2px solid #ddd0f8;box-shadow:none;}\
.sl-btn.sl-danger{background:linear-gradient(135deg,#fb7185,#f43f5e);}\
.sl-btn.sl-off{opacity:.55;pointer-events:none;}\
.sl-btnrow{display:flex;gap:9px;margin-top:10px;flex-wrap:wrap;}\
.sl-btnrow .sl-btn{flex:1;min-width:100px;}\
.sl-upload{border:2px dashed #d8b4fe;border-radius:14px;padding:15px;text-align:center;\
  color:#a78bfa;font-size:12px;background:#fbf7ff;cursor:pointer;}\
.sl-upload img{max-width:100%;max-height:160px;border-radius:12px;margin-top:9px;}\
.sl-tabbar{position:absolute;bottom:0;left:0;right:0;display:flex;background:#fff;\
  border-radius:18px 18px 0 0;padding:7px 3px 10px;box-shadow:0 -6px 24px rgba(140,90,220,.15);z-index:20;}\
.sl-tab{flex:1;text-align:center;font-size:9px;color:#b49ede;cursor:pointer;padding:3px 0;}\
.sl-tab .sl-ti{font-size:20px;display:block;transition:transform .15s;}\
.sl-tab.sl-cur{color:#8b5cf6;font-weight:700;}\
.sl-tab.sl-cur .sl-ti{transform:scale(1.12);}\
.sl-calhead{display:flex;align-items:center;justify-content:space-between;margin:6px 0;}\
.sl-caltitle{font-size:15px;font-weight:700;color:#7c3aed;}\
.sl-calnav{background:#fff;border:none;width:34px;height:34px;border-radius:50%;\
  font-size:15px;color:#8b5cf6;box-shadow:0 3px 8px rgba(140,90,220,.15);cursor:pointer;}\
.sl-calgrid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}\
.sl-calcell{aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;\
  background:#fff;border-radius:9px;font-size:12px;cursor:pointer;position:relative;}\
.sl-calcell.sl-dim{opacity:.32;}\
.sl-calcell.sl-today{background:linear-gradient(135deg,#a78bfa,#f472b6);color:#fff;font-weight:700;}\
.sl-calcell.sl-sel{outline:2px solid #c084fc;}\
.sl-calcell .sl-dot{width:5px;height:5px;border-radius:50%;background:#f472b6;position:absolute;bottom:4px;}\
.sl-calweek{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;\
  font-size:10px;color:#b49ede;margin:5px 0;}\
.sl-wrappv{height:160px;border-radius:18px;position:relative;overflow:hidden;\
  background:linear-gradient(135deg,#c084fc,#f472b6);display:flex;align-items:center;justify-content:center;}\
.sl-wrappv .sl-rh{position:absolute;top:0;bottom:0;width:22px;background:rgba(255,214,102,.85);left:calc(50% - 11px);}\
.sl-wrappv .sl-rv{position:absolute;left:0;right:0;height:22px;background:rgba(255,214,102,.85);top:calc(50% - 11px);}\
.sl-wrappv .sl-bow{position:relative;z-index:2;font-size:40px;}\
.sl-wrappv .sl-plabel{position:absolute;bottom:9px;right:13px;color:#fff;font-size:10px;opacity:.9;}\
.sl-stage{text-align:center;padding:20px 0 6px;}\
.sl-gift\boxed{width:158px;height:138px;margin:18px auto 6px;position:relative;cursor:pointer;}\
.sl-giftbox .sl-b\boxed{position:absolute;bottom:0;width:100%;height:96px;border-radius:13px;\
  background:linear-gradient(135deg,#c084fc,#a78bfa);box-shadow:0 12px 26px rgba(140,90,220,.35);}\
.sl-giftbox .sl-blid{position:absolute;top:20px;width:112%;left:-6%;height:34px;border-radius:11px;\
  background:linear-gradient(135deg,#e9d5ff,#c084fc);transition:transform .65s ease,opacity .65s;transform-origin:50% 100%;}\
.sl-giftbox .sl-brib{position:absolute;bottom:0;width:21px;height:96px;left:calc(50% - 10px);\
  background:rgba(255,214,102,.9);z-index:2;border-radius:4px;}\
.sl-giftbox.sl-open .sl-blid{transform:translateY(-62px) rotate(-16deg);opacity:0;}\
.sl-giftbox .sl-bheart{position:absolute;top:70px;left:0;right:0;text-align:center;font-size:27px;opacity:0;transition:opacity .45s .25s;}\
.sl-giftbox.sl-open .sl-bheart{opacity:1;}\
.sl-hint{color:#a78bfa;font-size:12px;animation:slPulse 1.5s infinite;}\
@keyframes slPulse{0%,100%{opacity:.5}50%{opacity:1}}\
.sl-wxsim{background:#ededed;border-radius:13px;padding:12px;}\
.sl-wxbubble{background:#fff;border-radius:10px;padding:11px;max-width:84%;box-shadow:0 2px 6px rgba(0,0,0,.06);}\
.sl-wxcard{background:linear-gradient(135deg,#fde8f0,#ede4ff);border-radius:9px;padding:11px;text-align:center;}\
.sl-wxcard .sl-wce{font-size:30px;}\
.sl-wxcard .sl-wcn{font-size:13px;font-weight:700;margin-top:5px;}\
.sl-wxcard .sl-wcs{font-size:10px;color:#a06cae;margin-top:3px;}\
.sl-wxcard .sl-wcb{display:inline-block;margin-top:8px;font-size:10px;color:#fff;\
  background:linear-gradient(135deg,#a78bfa,#f472b6);padding:4px 16px;border-radius:99px;}\
.sl-mask{position:absolute;inset:0;background:rgba(60,30,90,.45);z-index:80;display:none;\
  align-items:flex-end;justify-content:center;}\
.sl-mask.sl-show{display:flex;}\
.sl-sheet{background:#fff;width:100%;border-radius:20px 20px 0 0;padding:18px 16px 26px;\
  animation:slUp .26s ease;max-height:80%;overflow-y:auto;}\
@keyframes slUp{from{transform:translateY(56px);opacity:.4}to{transform:none;opacity:1}}\
.sl-closex{float:right;font-size:19px;color:#b49ede;cursor:pointer;line-height:1;}\
.sl-dimg{width:100%;max-height:210px;object-fit:cover;border-radius:15px;background:#f3e8ff;}\
.sl-msg\boxed{background:linear-gradient(135deg,#fdf2f8,#f5f0ff);border-radius:13px;padding:12px;\
  font-size:13px;color:#9d3f8f;font-style:italic;margin:10px 0;line-height:1.7;}\
.sl-kv{display:flex;font-size:12px;padding:6px 0;border-bottom:1px dashed #eee;}\
.sl-kv .sl-k{width:74px;color:#a78bfa;flex-shrink:0;}\
.sl-kv .sl-v{color:#555;word-break:break-all;}\
.sl-switchrow{display:flex;align-items:center;justify-content:space-between;padding:10px 0;\
  border-bottom:1px solid #f3ecff;font-size:13px;}\
.sl-switch{width:43px;height:24px;border-radius:99px;background:#ddd0f8;position:relative;\
  cursor:pointer;transition:background .2s;flex-shrink:0;}\
.sl-switch.sl-on{background:linear-gradient(135deg,#a78bfa,#f472b6);}\
.sl-switch::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;\
  border-radius:50%;background:#fff;transition:left .2s;box-shadow:0 2px 5px rgba(0,0,0,.2);}\
.sl-switch.sl-on::after{left:22px;}\
.sl-chip{display:inline-block;background:#f3e8ff;color:#7c3aed;border-radius:99px;\
  padding:5px 13px;font-size:11px;margin:3px 3px 0 0;}\
.sl-chip .sl-cdel{margin-left:5px;color:#f43f5e;cursor:pointer;}\
.sl-toast{position:absolute;top:20%;left:50%;transform:translateX(-50%);background:rgba(60,30,90,.86);\
  color:#fff;padding:10px 20px;border-radius:99px;font-size:12px;z-index:120;display:none;white-space:nowrap;}'

  function ensureCss() {
    if (document.getElementById('shili-style')) return
    var st = document.createElement('style')
    st.id = 'shili-style'
    st.textContent = SL_CSS
    document.head.appendChild(st)
  }

  // ================= 数据层（localStorage，shili_ 独立键） =================
  var KEY = {
    gifts: 'shili_gifts',
    annivs: 'shili_annivs',
    cats: 'shili_cats',
    settings: 'shili_settings',
    draft: 'shili_draft'
  }
  var DEFAULT_CATS = ['鲜花', '美食', '饰品', '数码', '手作', '其他']

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key)
      if (raw == null) return fallback
      var v = JSON.parse(raw)
      return v == null ? fallback : v
    } catch (e) {
      console.warn('[shili] 数据读取失败 ' + key, e)
      return fallback
    }
  }
  function save(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val))
    } catch (e) {
      console.warn('[shili] 数据写入失败 ' + key, e)
    }
  }

  var gifts = load(KEY.gifts, [])
  var annivs = load(KEY.annivs, [])
  var cats = load(KEY.cats, DEFAULT_CATS.slice())
  var settings = load(KEY.settings, {})
  var editingId = null
  var wrapConf = { type: 'box', paper: 'star', ribbon: 'gold', card: 'birth', cardText: '' }
  var pendingGift = null
  var ubGift = null
  var unboxBusy = false
  var sendBusy = false

  function persistAll() {
    save(KEY.gifts, gifts)
    save(KEY.annivs, annivs)
    save(KEY.cats, cats)
    save(KEY.settings, settings)
  }

  // ================= 月月机联动：角色 / 微信 =================
  var charCache = null

  async function loadCharacters() {
    // 从月月机 Dexie 角色库读真实角色；未就绪则降级占位
    if (charCache && charCache.length) return charCache
    var list = []
    try {
      if (window.db && window.db.characters) {
        var chars = await window.db.characters.where('type').equals('char').toArray()
        for (var i = 0; i < chars.length; i++) {
          list.push({ id: chars[i].id, name: chars[i].name || '神秘人', avatar: chars[i].avatar || '' })
        }
      }
    } catch (e) {
      console.warn('[shili] 角色库读取失败，用占位角色', e)
    }
    if (!list.length) {
      list = [
        { id: null, name: '月月', avatar: '' },
        { id: null, name: '小艾', avatar: '' },
        { id: null, name: '克劳德', avatar: '' }
      ]
    }
    charCache = list
    return list
  }

  function findCharByName(name) {
    if (!charCache) return null
    for (var i = 0; i < charCache.length; i++) {
      if (charCache[i].name === name) return charCache[i]
    }
    return null
  }

  // 往微信聊天插入一条礼物消息（不触发 AI 回复）
  async function pushWechatGiftMsg(gift) {
    try {
      if (!window.db || !window.db.messages || !window.db.chats) return false
      var ch = findCharByName(gift.to)
      if (!ch || ch.id == null) return false
      var chat = await window.db.chats.where('charId').equals(ch.id).first()
      var chatId
      if (chat && chat.id != null) {
        chatId = chat.id
      } else {
        chatId = await window.db.chats.add({
          charId: ch.id,
          ownerUid: chat && chat.ownerUid != null ? chat.ownerUid : 'main',
          createdAt: Date.now()
        })
      }
      await window.db.messages.add({
        chatId: chatId,
        role: 'user',
        content: '🎁［拾礼］我送了你一份礼物：「' + gift.name + '」' + (gift.msg ? '，寄语：' + gift.msg : '') + '。来拾礼拆开看看吧～',
        createdAt: Date.now(),
        clientMessageId: 'shili-' + Date.now() + '-' + Math.floor(Math.random() * 1e6),
        isRead: 1
      })
      return true
    } catch (e) {
      console.warn('[shili] 微信礼物消息写入失败', e)
      return false
    }
  }

  // 从拾礼跳转到对应微信聊天
  function jumpWechat(charName) {
    var ch = findCharByName(charName)
    if (ch && ch.id != null && window.openPrivateChatDirect) {
      window.openPrivateChatDirect(ch.id)
    } else if (window.showWechatPage) {
      window.showWechatPage()
    }
  }

  // ================= 工具 =================
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }
  function fmtDate(ts) {
    var d = new Date(ts)
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
  }
  function toast(root, t) {
    var el = root.querySelector('.sl-toast')
    if (!el) return
    el.textContent = t
    el.style.display = 'block'
    clearTimeout(el._tm)
    el._tm = setTimeout(function () { el.style.display = 'none' }, 1600)
  }

  // ================= 外部接线口：收到礼物 =================
  // 微信/AI 侧产生收礼记录时调用：window.shiliReceiveGift({...})
  // 生成 in/unopened 记录落库；拾礼开着则即时刷新
  window.shiliReceiveGift = function (partial) {
    var p = partial || {}
    var g = {
      id: p.id || ('gin' + Date.now()),
      name: p.name || '神秘礼物',
      desc: p.desc || '',
      msg: p.msg || '',
      cat: p.cat && cats.indexOf(p.cat) >= 0 ? p.cat : '其他',
      to: p.to || '你',
      from: p.from || '月月',
      img: p.img || '',
      dir: 'in',
      status: 'unopened',
      fav: false,
      note: '',
      wrapped: p.wrapped !== false,
      wrap: p.wrap || { type: 'box', paper: 'star', ribbon: 'gold', card: 'blank', cardText: p.msg || '' },
      when: 'now',
      date: '',
      sendAt: p.sendAt || Date.now(),
      unboxAt: null
    }
    gifts.push(g)
    save(KEY.gifts, gifts)
    var root = document.getElementById('shili-page')
    if (root) renderHome(root)
    return g.id
  }

  // ================= 入口 =================
  window.showShiliPage = function () {
    if (document.getElementById('shili-page')) return
    ensureCss()
    var page = document.createElement('div')
    page.id = 'shili-page'
    page.innerHTML = buildShell()
    if (window.openPage) {
      window.openPage(page)
    } else {
      document.getElementById('app').appendChild(page)
    }
    bindShell(page)
    renderHome(page)
    renderCal(page)
    renderWrapPv(page)
    loadCharacters().then(function () { renderSendForm(page) })
  }

  function buildShell() {
    return '' +
      '<div class="sl-top">' +
      '<button class="sl-back" id="sl-back">‹</button>' +
      '<h1>🎁 拾礼</h1>' +
      '<div class="sl-sub">把每一份心意<br>都好好珍藏</div>' +
      '</div>' +
      '<div class="sl-body" id="sl-body">' +
      '<div class="sl-page sl-active" id="sl-p-home">' + homeHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-send">' + sendHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-calendar">' + calendarHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-cabinet">' + cabinetHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-settings">' + settingsHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-preview">' + previewHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-wrap">' + wrapHtml() + '</div>' +
      '<div class="sl-page" id="sl-p-unbox">' + unboxHtml() + '</div>' +
      '</div>' +
      '<div class="sl-tabbar">' +
      '<div class="sl-tab sl-cur" data-p="home"><span class="sl-ti">🏠</span>首页</div>' +
      '<div class="sl-tab" data-p="send"><span class="sl-ti">🎁</span>送礼</div>' +
      '<div class="sl-tab" data-p="calendar"><span class="sl-ti">📅</span>日历</div>' +
      '<div class="sl-tab" data-p="cabinet"><span class="sl-ti">🗄️</span>珍藏柜</div>' +
      '<div class="sl-tab" data-p="settings"><span class="sl-ti">⚙️</span>设置</div>' +
      '</div>' +
      '<div class="sl-mask" id="sl-mask"><div class="sl-sheet" id="sl-sheet"></div></div>' +
      '<div class="sl-toast"></div>'
  }

  // ---------- 各页静态骨架 ----------
  function homeHtml() {
    return '' +
      '<div class="sl-stats">' +
      '<div class="sl-stat"><div class="sl-num" id="sl-stat-got">0</div><div class="sl-lbl">收到礼物</div></div>' +
      '<div class="sl-stat sl-pink"><div class="sl-num" id="sl-stat-sent">0</div><div class="sl-lbl">送出礼物</div></div>' +
      '<div class="sl-stat"><div class="sl-num" id="sl-stat-fav">0</div><div class="sl-lbl">特别珍藏</div></div>' +
      '</div>' +
      '<div class="sl-card"><h3 class="sl-h3" style="margin-top:0">📅 即将到来</h3><div id="sl-upcoming"></div></div>' +
      '<h2 class="sl-h2">🎁 最近收到</h2><div id="sl-home-received"></div>' +
      '<h2 class="sl-h2">💝 最近送出</h2><div id="sl-home-sent"></div>' +
      '<h2 class="sl-h2">✨ 今日</h2>' +
      '<div class="sl-card"><div id="sl-today-text"></div></div>' +
      '<div class="sl-btnrow">' +
      '<button class="sl-btn" data-go="send">🎁 送礼</button>' +
      '<button class="sl-btn sl-ghost" data-go="calendar">📅 日历</button>' +
      '<button class="sl-btn sl-ghost" data-go="cabinet">🗄️ 珍藏柜</button>' +
      '<button class="sl-btn sl-ghost" data-go="settings">⚙️ 设置</button>' +
      '</div>'
  }

  function sendHtml() {
    return '' +
      '<h2 class="sl-h2">🎁 挑一份礼物</h2>' +
      '<div class="sl-card">' +
      '<label class="sl-label">送给谁</label><select class="sl-select" id="sl-f-to"></select>' +
      '<label class="sl-label">礼物分类</label><select class="sl-select" id="sl-f-cat"></select>' +
      '<label class="sl-label">礼物名称</label><input class="sl-input" id="sl-f-name" placeholder="比如：一束樱花">' +
      '<label class="sl-label">礼物描述</label><textarea class="sl-textarea" id="sl-f-desc" placeholder="描述一下这份礼物的故事……"></textarea>' +
      '<label class="sl-label">礼物图片</label>' +
      '<div class="sl-upload" id="sl-upload"><div id="sl-img-tip">📷 点击上传图片</div><img id="sl-img-pv" style="display:none"></div>' +
      '<label class="sl-label">赠礼寄语</label><textarea class="sl-textarea" id="sl-f-msg" placeholder="写下想对 TA 说的话……"></textarea>' +
      '<div class="sl-row2">' +
      '<div><label class="sl-label">赠送时间</label>' +
      '<select class="sl-select" id="sl-f-when"><option value="now">立即赠送</option><option value="date">指定日期</option></select></div>' +
      '<div><label class="sl-label">&nbsp;</label><input class="sl-input" type="date" id="sl-f-date" style="display:none"></div>' +
      '</div>' +
      '<div class="sl-switchrow" style="margin-top:7px"><span>🎀 包装礼物</span><div class="sl-switch sl-on" id="sl-f-wrap"></div></div>' +
      '<div class="sl-btnrow">' +
      '<button class="sl-btn sl-ghost" id="sl-save-draft">📝 存草稿</button>' +
      '<button class="sl-btn sl-ghost" id="sl-clear-form">🧹 清空</button>' +
      '</div>' +
      '<button class="sl-btn sl-big" id="sl-to-pv">下一步：预览礼物 →</button>' +
      '</div>'
  }

  function calendarHtml() {
    return '' +
      '<h2 class="sl-h2">📅 礼物日历</h2>' +
      '<div class="sl-card">' +
      '<div class="sl-calhead"><button class="sl-calnav" id="sl-cal-prev">‹</button>' +
      '<div class="sl-caltitle" id="sl-cal-title"></div>' +
      '<button class="sl-calnav" id="sl-cal-next">›</button></div>' +
      '<div class="sl-calweek"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>' +
      '<div class="sl-calgrid" id="sl-cal-grid"></div></div>' +
      '<h3 class="sl-h3" id="sl-day-title">点击日期查看当天事件</h3>' +
      '<div id="sl-day-events"></div>' +
      '<button class="sl-btn sl-big" id="sl-add-anniv">➕ 添加纪念日 / 生日</button>' +
      '<h2 class="sl-h2">🔔 提醒设置</h2>' +
      '<div class="sl-card">' +
      '<div class="sl-switchrow"><span>当天提醒</span><div class="sl-switch sl-on" data-sw="1"></div></div>' +
      '<div class="sl-switchrow"><span>提前提醒</span><div class="sl-switch sl-on" data-sw="1"></div></div>' +
      '<div class="sl-row2" style="margin-top:9px">' +
      '<div><label class="sl-label">提前几天</label><input class="sl-input" type="number" id="sl-adv-days" value="3" min="0" max="30"></div>' +
      '<div><label class="sl-label">重复规则</label><select class="sl-select" id="sl-repeat">' +
      '<option value="year">每年</option><option value="month">每月</option><option value="none">不重复</option></select></div>' +
      '</div></div>'
  }

  function cabinetHtml() {
    return '' +
      '<h2 class="sl-h2">🗄️ 珍藏柜</h2>' +
      '<div class="sl-card">' +
      '<input class="sl-input" id="sl-cab-kw" placeholder="🔍 搜索礼物名称、描述、寄语">' +
      '<div class="sl-row2" style="margin-top:9px">' +
      '<select class="sl-select" id="sl-cab-who"><option value="">全部对象</option><option value="in">只看收到</option><option value="out">只看送出</option></select>' +
      '<select class="sl-select" id="sl-cab-cat"><option value="">全部分类</option></select></div>' +
      '<div class="sl-row2" style="margin-top:9px">' +
      '<select class="sl-select" id="sl-cab-sort"><option value="new">按时间：新→旧</option><option value="old">按时间：旧→新</option></select>' +
      '<select class="sl-select" id="sl-cab-status"><option value="">全部状态</option><option value="unopened">未拆封</option><option value="opened">已拆封</option></select>' +
      '</div></div>' +
      '<div id="sl-cab-list"></div>'
  }

  function settingsHtml() {
    return '' +
      '<h2 class="sl-h2">⚙️ 设置</h2>' +
      '<h3 class="sl-h3">🎁 礼物分类管理</h3>' +
      '<div class="sl-card"><div id="sl-cat-chips"></div>' +
      '<div class="sl-row2" style="margin-top:9px"><input class="sl-input" id="sl-new-cat" placeholder="新分类名称">' +
      '<button class="sl-btn" id="sl-add-cat" style="flex:0 0 82px">添加</button></div></div>' +
      '<h3 class="sl-h3">🎀 默认包装</h3>' +
      '<div class="sl-card"><select class="sl-select" id="sl-def-wrap">' +
      '<option value="ribbon">蝴蝶结礼盒</option><option value="bag">礼品袋</option><option value="none">不包装</option></select></div>' +
      '<h3 class="sl-h3">🔔 通知</h3>' +
      '<div class="sl-card">' +
      '<div class="sl-switchrow"><span>礼物通知</span><div class="sl-switch sl-on" data-sw="1"></div></div>' +
      '<div class="sl-switchrow"><span>生日 / 纪念日提醒</span><div class="sl-switch sl-on" data-sw="1"></div></div>' +
      '<div class="sl-switchrow"><span>自动识别剧情中的礼物</span><div class="sl-switch" data-sw="1"></div></div>' +
      '</div>' +
      '<h3 class="sl-h3">🤖 AI 主动送礼</h3>' +
      '<div class="sl-card"><label class="sl-label">主动送礼频率</label>' +
      '<select class="sl-select" id="sl-ai-freq"><option value="high">热情（常常送）</option>' +
      '<option value="mid" selected>自然（偶尔送）</option><option value="low">佛系（很少送）</option></select></div>' +
      '<h3 class="sl-h3">💾 数据</h3>' +
      '<div class="sl-card">' +
      '<div class="sl-kv"><div class="sl-k">存储</div><div class="sl-v" id="sl-data-size">计算中……</div></div>' +
      '<div class="sl-btnrow"><button class="sl-btn sl-ghost" id="sl-export">📤 导出备份</button>' +
      '<button class="sl-btn sl-ghost" id="sl-import">📥 导入备份</button></div>' +
      '<button class="sl-btn sl-danger sl-big" id="sl-reset">⚠️ 清空所有数据</button></div>'
  }

  function previewHtml() {
    return '' +
      '<h2 class="sl-h2">👀 礼物预览</h2>' +
      '<h3 class="sl-h3">微信里的礼物卡片</h3>' +
      '<div class="sl-wxsim"><div class="sl-wxbubble"><div class="sl-wxcard">' +
      '<div class="sl-wce">🎁</div><div class="sl-wcn" id="sl-pv-cname">礼物名称</div>' +
      '<div class="sl-wcs" id="sl-pv-csub">来自 你 的一份心意</div>' +
      '<div class="sl-wcb">点击查收礼物</div></div></div></div>' +
      '<h3 class="sl-h3">礼物信息</h3>' +
      '<div class="sl-card"><img class="sl-dimg" id="sl-pv-img" style="display:none">' +
      '<div class="sl-kv"><div class="sl-k">名称</div><div class="sl-v" id="sl-pv-name"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">分类</div><div class="sl-v" id="sl-pv-cat"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">收礼人</div><div class="sl-v" id="sl-pv-to"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">赠送时间</div><div class="sl-v" id="sl-pv-when"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">包装</div><div class="sl-v" id="sl-pv-wrap"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">描述</div><div class="sl-v" id="sl-pv-desc"></div></div>' +
      '<div class="sl-msgbox" id="sl-pv-msg"></div></div>' +
      '<div class="sl-btnrow"><button class="sl-btn sl-ghost" id="sl-pv-edit">✏️ 改礼物</button>' +
      '<button class="sl-btn sl-ghost" id="sl-pv-wrapedit">🎀 改包装</button></div>' +
      '<button class="sl-btn sl-big" id="sl-pv-confirm">确认赠送 💝</button>' +
      '<button class="sl-btn sl-ghost sl-big" id="sl-pv-draft">先存为草稿</button>'
  }

  function wrapHtml() {
    return '' +
      '<h2 class="sl-h2">🎀 礼物包装</h2>' +
      '<div class="sl-wrappv" id="sl-wrap-pv">' +
      '<div class="sl-rh"></div><div class="sl-rv"></div><div class="sl-bow" id="sl-wrap-bow">🎀</div>' +
      '<div class="sl-plabel" id="sl-wrap-label">星空包装纸</div></div>' +
      '<div class="sl-card">' +
      '<label class="sl-label">包装类型</label><select class="sl-select" id="sl-w-type">' +
      '<option value="box">礼盒</option><option value="bag">礼品袋</option><option value="tube">圆筒</option></select>' +
      '<label class="sl-label">包装纸</label><select class="sl-select" id="sl-w-paper">' +
      '<option value="star">星空紫</option><option value="sakura">樱花粉</option><option value="gold">鎏金</option><option value="kraft">牛皮纸</option></select>' +
      '<label class="sl-label">丝带</label><select class="sl-select" id="sl-w-ribbon">' +
      '<option value="gold">金丝带</option><option value="red">红丝带</option><option value="white">白丝带</option></select>' +
      '<label class="sl-label">贺卡</label><select class="sl-select" id="sl-w-card">' +
      '<option value="birth">生日卡</option><option value="love">纪念卡</option><option value="blank">空白卡</option></select>' +
      '<label class="sl-label">贺卡文字</label><textarea class="sl-textarea" id="sl-w-cardtext" placeholder="写在贺卡上的话……"></textarea>' +
      '</div>' +
      '<div class="sl-btnrow"><button class="sl-btn sl-ghost" id="sl-w-back">↩️ 返回修改</button>' +
      '<button class="sl-btn sl-ghost" id="sl-w-skip">跳过包装</button></div>' +
      '<button class="sl-btn sl-big" id="sl-w-next">保存包装，去预览 →</button>'
  }

  function unboxHtml() {
    return '' +
      '<h2 class="sl-h2">🎁 有一份礼物等你拆开</h2>' +
      '<div class="sl-stage">' +
      '<div style="font-size:13px;color:#8b5cf6" id="sl-ub-from"></div>' +
      '<div class="sl-giftbox" id="sl-giftbox">' +
      '<div class="sl-bbox"></div><div class="sl-brib"></div><div class="sl-blid"></div>' +
      '<div class="sl-bheart">💖</div></div>' +
      '<div class="sl-hint" id="sl-ub-hint">轻点礼盒拆开它</div></div>' +
      '<div class="sl-card" id="sl-ub-card" style="display:none">' +
      '<div class="sl-msgbox" id="sl-ub-msg"></div>' +
      '<img class="sl-dimg" id="sl-ub-img" style="display:none">' +
      '<div class="sl-kv"><div class="sl-k">礼物</div><div class="sl-v" id="sl-ub-name"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">描述</div><div class="sl-v" id="sl-ub-desc"></div></div>' +
      '<div class="sl-kv"><div class="sl-k">贺卡</div><div class="sl-v" id="sl-ub-cardtext"></div></div></div>' +
      '<div id="sl-ub-actions" style="display:none">' +
      '<button class="sl-btn sl-big" id="sl-ub-accept">开心收下 💝</button>' +
      '<div class="sl-btnrow"><button class="sl-btn sl-ghost" id="sl-ub-thanks">💌 发感谢</button>' +
      '<button class="sl-btn sl-ghost" id="sl-ub-tocabinet">🗄️ 去珍藏柜</button></div></div>' +
      '<button class="sl-btn sl-ghost sl-big" id="sl-ub-home" style="display:none">返回首页</button>'
  }

  // ================= 路由 =================
  function go(root, name) {
    var pages = root.querySelectorAll('.sl-page')
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('sl-active')
    var target = root.querySelector('#sl-p-' + name)
    if (target) target.classList.add('sl-active')
    var tabs = root.querySelectorAll('.sl-tab')
    for (var j = 0; j < tabs.length; j++) {
      tabs[j].classList.remove('sl-cur')
      if (tabs[j].getAttribute('data-p') === name) tabs[j].classList.add('sl-cur')
    }
    if (name === 'home') renderHome(root)
    if (name === 'cabinet') renderCabinet(root)
    if (name === 'calendar') renderCal(root)
    if (name === 'settings') renderSettings(root)
    var body = root.querySelector('#sl-body')
    if (body) body.scrollTop = 0
  }

  // ================= 事件绑定 =================
  function bindShell(root) {
    root.querySelector('#sl-back').addEventListener('click', function () {
      if (window.closePage) window.closePage('shili-page')
      else root.remove()
    })
    // tab 与页面内跳转
    root.addEventListener('click', function (e) {
      var tab = e.target.closest ? e.target.closest('.sl-tab') : null
      if (tab) { go(root, tab.getAttribute('data-p')); return }
      var goBtn = e.target.closest ? e.target.closest('[data-go]') : null
      if (goBtn) { go(root, goBtn.getAttribute('data-go')); return }
      var sw = e.target.closest ? e.target.closest('.sl-switch') : null
      if (sw) { sw.classList.toggle('sl-on'); return }
      var gitem = e.target.closest ? e.target.closest('[data-gift-id]') : null
      if (gitem) { openDetail(root, gitem.getAttribute('data-gift-id')); return }
    })
    // 弹层关闭
    root.querySelector('#sl-mask').addEventListener('click', function (e) {
      if (e.target.id === 'sl-mask') root.querySelector('#sl-mask').classList.remove('sl-show')
    })

    // ---- 送礼页 ----
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-upload').addEventListener('click', function () {
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = function (ev) {
        if (!ev.target.files || !ev.target.files[0]) return
        var reader = new FileReader()
        reader.onload = function (r) {
          q('#sl-img-pv').src = r.target.result
          q('#sl-img-pv').style.display = 'block'
          q('#sl-img-tip').style.display = 'none'
        }
        reader.readAsDataURL(ev.target.files[0])
      }
      input.click()
    })
    q('#sl-f-when').addEventListener('change', function () {
      q('#sl-f-date').style.display = this.value === 'date' ? 'block' : 'none'
    })
    q('#sl-save-draft').addEventListener('click', function () {
      save(KEY.draft, {
        name: q('#sl-f-name').value,
        desc: q('#sl-f-desc').value,
        msg: q('#sl-f-msg').value
      })
      toast(root, '草稿已保存 📝')
    })
    q('#sl-clear-form').addEventListener('click', function () {
      clearForm(root)
      toast(root, '已清空')
    })
    q('#sl-to-pv').addEventListener('click', function () { toPreview(root) })

    // ---- 日历 ----
    q('#sl-cal-prev').addEventListener('click', function () { calMove(root, -1) })
    q('#sl-cal-next').addEventListener('click', function () { calMove(root, 1) })
    q('#sl-add-anniv').addEventListener('click', function () { addAnniv(root) })

    // ---- 珍藏柜筛选 ----
    ;['#sl-cab-kw', '#sl-cab-who', '#sl-cab-cat', '#sl-cab-sort', '#sl-cab-status'].forEach(function (sel) {
      q(sel).addEventListener('input', function () { renderCabinet(root) })
    })

    // ---- 设置 ----
    q('#sl-add-cat').addEventListener('click', function () {
      var v = q('#sl-new-cat').value.trim()
      if (!v) { toast(root, '请输入分类名称'); return }
      cats.push(v)
      q('#sl-new-cat').value = ''
      save(KEY.cats, cats)
      renderSettings(root)
    })
    q('#sl-export').addEventListener('click', function () {
      var data = JSON.stringify({ gifts: gifts, annivs: annivs, cats: cats, settings: settings })
      try {
        var blob = new Blob([data], { type: 'application/json' })
        var a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'shili-backup.json'
        a.click()
        toast(root, '备份已导出 📤')
      } catch (e) {
        console.warn('[shili] 导出失败', e)
        toast(root, '导出失败')
      }
    })
    q('#sl-import').addEventListener('click', function () {
      var input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = function (ev) {
        if (!ev.target.files || !ev.target.files[0]) return
        var reader = new FileReader()
        reader.onload = function (r) {
          try {
            var d = JSON.parse(r.target.result)
            gifts = d.gifts || []
            annivs = d.annivs || []
            cats = d.cats && d.cats.length ? d.cats : cats
            settings = d.settings || settings
            persistAll()
            toast(root, '备份已恢复 📥')
          } catch (err) {
            console.warn('[shili] 备份解析失败', err)
            toast(root, '备份文件解析失败')
          }
        }
        reader.readAsText(ev.target.files[0])
      }
      input.click()
    })
    q('#sl-reset').addEventListener('click', function () {
      if (!window.confirm('确定清空拾礼的所有数据吗？（只清拾礼，不影响其他模块）')) return
      gifts = []
      annivs = []
      persistAll()
      toast(root, '数据已清空')
    })

    // ---- 预览 ----
    q('#sl-pv-edit').addEventListener('click', function () { go(root, 'send') })
    q('#sl-pv-wrapedit').addEventListener('click', function () { go(root, 'wrap') })
    q('#sl-pv-draft').addEventListener('click', function () {
      save(KEY.draft, {
        name: q('#sl-f-name').value,
        desc: q('#sl-f-desc').value,
        msg: q('#sl-f-msg').value
      })
      toast(root, '草稿已保存 📝')
    })
    q('#sl-pv-confirm').addEventListener('click', function () { confirmSend(root) })

    // ---- 包装 ----
    ;['#sl-w-type', '#sl-w-paper', '#sl-w-ribbon', '#sl-w-card'].forEach(function (sel) {
      q(sel).addEventListener('change', function () { renderWrapPv(root) })
    })
    q('#sl-w-back').addEventListener('click', function () { go(root, 'send') })
    q('#sl-w-skip').addEventListener('click', function () {
      q('#sl-f-wrap').classList.remove('sl-on')
      if (pendingGift) pendingGift.wrapped = false
      toast(root, '已跳过包装')
      toPreview(root)
    })
    q('#sl-w-next').addEventListener('click', function () {
      renderWrapPv(root)
      if (pendingGift) {
        pendingGift.wrap = JSON.parse(JSON.stringify(wrapConf))
        pendingGift.wrapped = true
      }
      toast(root, '包装已保存 🎀')
      toPreview(root)
    })

    // ---- 拆封 ----
    q('#sl-giftbox').addEventListener('click', function () { doUnbox(root) })
    q('#sl-ub-accept').addEventListener('click', function () {
      toast(root, '已收入珍藏柜 💖')
      go(root, 'cabinet')
    })
    q('#sl-ub-thanks').addEventListener('click', function () {
      if (!ubGift) return
      jumpWechat(ubGift.from)
    })
    q('#sl-ub-tocabinet').addEventListener('click', function () { go(root, 'cabinet') })
    q('#sl-ub-home').addEventListener('click', function () { go(root, 'home') })
  }

  // ================= 主页渲染 =================
  function renderHome(root) {
    var got = [], sent = []
    for (var i = 0; i < gifts.length; i++) {
      if (gifts[i].dir === 'in') got.push(gifts[i]); else sent.push(gifts[i])
    }
    got.sort(function (a, b) { return b.sendAt - a.sendAt })
    sent.sort(function (a, b) { return b.sendAt - a.sendAt })
    var fav = 0
    for (var f = 0; f < gifts.length; f++) if (gifts[f].fav) fav++
    root.querySelector('#sl-stat-got').textContent = got.length
    root.querySelector('#sl-stat-sent').textContent = sent.length
    root.querySelector('#sl-stat-fav').textContent = fav

    root.querySelector('#sl-home-received').innerHTML =
      got.length ? got.slice(0, 4).map(giftItemHtml).join('') : '<div class="sl-empty">还没有收到礼物</div>'
    root.querySelector('#sl-home-sent').innerHTML =
      sent.length ? sent.slice(0, 4).map(giftItemHtml).join('') : '<div class="sl-empty">还没有送出礼物</div>'

    // 即将到来（生日/纪念日按年重复推算）
    var now = new Date()
    var upRows = []
    for (var a = 0; a < annivs.length; a++) {
      var an = annivs[a]
      var d = new Date(an.date)
      if (isNaN(d.getTime())) continue
      var next = new Date(now.getFullYear(), d.getMonth(), d.getDate())
      if (next < now) next = new Date(now.getFullYear() + 1, d.getMonth(), d.getDate())
      var days = Math.ceil((next - now) / 86400000)
      upRows.push({ days: days, an: an, d: d })
    }
    upRows.sort(function (x, y) { return x.days - y.days })
    root.querySelector('#sl-upcoming').innerHTML = upRows.length
      ? upRows.slice(0, 4).map(function (r) {
          return '<div class="sl-kv"><div class="sl-k">' + r.days + '天后</div><div class="sl-v">' +
            esc(r.an.name) + '（' + fmtDate(r.d.getTime()) + '）</div></div>'
        }).join('')
      : '<div class="sl-empty">还没有纪念日，去日历添加吧</div>'

    // 今日事件
    var tStr = fmtDate(Date.now())
    var evs = []
    for (var k = 0; k < annivs.length; k++) {
      if (fmtDate(new Date(annivs[k].date).getTime()) === tStr) evs.push('🎉 今天是「' + esc(annivs[k].name) + '」')
    }
    for (var m = 0; m < gifts.length; m++) {
      if (fmtDate(gifts[m].sendAt) === tStr) {
        evs.push('🎁 今天 ' + (gifts[m].dir === 'in' ? '收到' : '送出') + '了「' + esc(gifts[m].name) + '」')
      }
    }
    root.querySelector('#sl-today-text').innerHTML =
      evs.join('<br>') || '<div class="sl-empty" style="padding:8px 0">今天没有特别的事件，适合送一份小礼物</div>'
  }

  function giftItemHtml(g) {
    var img = g.img
      ? '<img src="' + esc(g.img) + '">'
      : '<div class="sl-gph">🎁</div>'
    return '<div class="sl-card sl-gitem" data-gift-id="' + esc(g.id) + '">' + img +
      '<div><div class="sl-gname">' + esc(g.name) + (g.fav ? ' 💖' : '') + '</div>' +
      '<div class="sl-gmeta">' + (g.dir === 'in' ? '来自 ' + esc(g.from) : '送给 ' + esc(g.to)) +
      ' · ' + fmtDate(g.sendAt) + '</div>' +
      '<div class="sl-gtag">' + esc(g.cat) + (g.status === 'unopened' ? ' · 未拆封' : '') + '</div></div></div>'
  }

  // ================= 送礼 =================
  function renderSendForm(root) {
    var q = function (sel) { return root.querySelector(sel) }
    var list = charCache || [{ name: '月月' }]
    q('#sl-f-to').innerHTML = list.map(function (c) {
      return '<option>' + esc(c.name) + '</option>'
    }).join('')
    q('#sl-f-cat').innerHTML = cats.map(function (c) {
      return '<option>' + esc(c) + '</option>'
    }).join('')
    var draft = load(KEY.draft, null)
    if (draft) {
      q('#sl-f-name').value = draft.name || ''
      q('#sl-f-desc').value = draft.desc || ''
      q('#sl-f-msg').value = draft.msg || ''
    }
  }

  function clearForm(root) {
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-f-name').value = ''
    q('#sl-f-desc').value = ''
    q('#sl-f-msg').value = ''
    q('#sl-img-pv').style.display = 'none'
    q('#sl-img-pv').src = ''
    q('#sl-img-tip').style.display = 'block'
    localStorage.removeItem(KEY.draft)
  }

  function readForm(root) {
    var q = function (sel) { return root.querySelector(sel) }
    return {
      id: editingId || ('g' + Date.now()),
      name: q('#sl-f-name').value.trim(),
      desc: q('#sl-f-desc').value.trim(),
      msg: q('#sl-f-msg').value.trim(),
      cat: q('#sl-f-cat').value,
      to: q('#sl-f-to').value,
      from: '你',
      img: q('#sl-img-pv').style.display === 'block' ? q('#sl-img-pv').src : '',
      dir: 'out',
      status: 'sent',
      fav: false,
      note: '',
      wrapped: q('#sl-f-wrap').classList.contains('sl-on'),
      wrap: JSON.parse(JSON.stringify(wrapConf)),
      when: q('#sl-f-when').value,
      date: q('#sl-f-date').value,
      sendAt: Date.now(),
      unboxAt: null
    }
  }

  function toPreview(root) {
    var g = pendingGift || readForm(root)
    if (!g.name) { toast(root, '先给礼物起个名字吧'); return }
    pendingGift = g
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-pv-name').textContent = g.name
    q('#sl-pv-cat').textContent = g.cat
    q('#sl-pv-to').textContent = g.to
    q('#sl-pv-when').textContent = g.when === 'now' ? '立即赠送' : ('指定日期 ' + (g.date || '未选'))
    q('#sl-pv-wrap').textContent = g.wrapped ? '精美包装' : '无包装'
    q('#sl-pv-desc').textContent = g.desc || '（未填）'
    q('#sl-pv-msg').textContent = g.msg ? '「' + g.msg + '」' : ''
    q('#sl-pv-cname').textContent = g.name
    q('#sl-pv-csub').textContent = '来自 你 送给 ' + g.to + ' 的一份心意'
    if (g.img) {
      q('#sl-pv-img').src = g.img
      q('#sl-pv-img').style.display = 'block'
    } else {
      q('#sl-pv-img').style.display = 'none'
    }
    go(root, 'preview')
  }

  function confirmSend(root) {
    if (sendBusy) return // 防重复点击重复送礼
    var g = pendingGift
    if (!g) { toast(root, '请先填写礼物信息'); return }
    sendBusy = true
    var btn = root.querySelector('#sl-pv-confirm')
    btn.classList.add('sl-off')
    btn.textContent = '赠送中……'
    // 同步落库 + 异步联动微信，互不阻塞
    if (editingId) {
      for (var i = 0; i < gifts.length; i++) {
        if (gifts[i].id === editingId) {
          g.id = editingId
          gifts[i] = g
        }
      }
      editingId = null
    } else {
      gifts.push(g)
    }
    save(KEY.gifts, gifts)
    pushWechatGiftMsg(g)
    setTimeout(function () {
      sendBusy = false
      btn.classList.remove('sl-off')
      btn.textContent = '确认赠送 💝'
      pendingGift = null
      toast(root, '已赠送给 ' + g.to + ' 🎉')
      go(root, 'home')
    }, 500)
  }

  // ================= 包装 =================
  function renderWrapPv(root) {
    var q = function (sel) { return root.querySelector(sel) }
    wrapConf.type = q('#sl-w-type').value
    wrapConf.paper = q('#sl-w-paper').value
    wrapConf.ribbon = q('#sl-w-ribbon').value
    wrapConf.card = q('#sl-w-card').value
    wrapConf.cardText = q('#sl-w-cardtext').value
    var paperMap = {
      star: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
      sakura: 'linear-gradient(135deg,#f9a8d4,#fda4af)',
      gold: 'linear-gradient(135deg,#fbbf24,#f59e0b)',
      kraft: 'linear-gradient(135deg,#d6b98c,#c19a6b)'
    }
    var ribbonMap = { gold: 'rgba(255,214,102,.9)', red: 'rgba(244,63,94,.85)', white: 'rgba(255,255,255,.9)' }
    var bowMap = { gold: '🎀', red: '🎗️', white: '🤍' }
    var paperName = { star: '星空紫', sakura: '樱花粉', gold: '鎏金', kraft: '牛皮纸' }
    q('#sl-wrap-pv').style.background = paperMap[wrapConf.paper] || paperMap.star
    var rh = q('.sl-rh'), rv = q('.sl-rv')
    if (rh) rh.style.background = ribbonMap[wrapConf.ribbon] || ribbonMap.gold
    if (rv) rv.style.background = ribbonMap[wrapConf.ribbon] || ribbonMap.gold
    q('#sl-wrap-bow').textContent = bowMap[wrapConf.ribbon] || '🎀'
    q('#sl-wrap-label').textContent = (paperName[wrapConf.paper] || '星空紫') + '包装'
  }

  // ================= 日历 =================
  var calY, calM, selDay

  function renderCal(root) {
    var now = new Date()
    if (calY === undefined) {
      calY = now.getFullYear()
      calM = now.getMonth()
    }
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-cal-title').textContent = calY + '年' + (calM + 1) + '月'
    var first = new Date(calY, calM, 1).getDay()
    var days = new Date(calY, calM + 1, 0).getDate()
    var html = ''
    for (var b = 0; b < first; b++) html += '<div></div>'
    for (var d = 1; d <= days; d++) {
      var isToday = (calY === now.getFullYear() && calM === now.getMonth() && d === now.getDate())
      var hasEv = dayHasEvent(calY, calM, d)
      html += '<div class="sl-calcell' + (isToday ? ' sl-today' : '') + (selDay === d ? ' sl-sel' : '') +
        '" data-day="' + d + '">' + d + (hasEv ? '<span class="sl-dot"></span>' : '') + '</div>'
    }
    q('#sl-cal-grid').innerHTML = html
    // 日期格点击（网格重建，事件委托挂网格本身）
    q('#sl-cal-grid').onclick = function (e) {
      var cell = e.target.closest ? e.target.closest('[data-day]') : null
      if (!cell) return
      selDay = parseInt(cell.getAttribute('data-day'), 10)
      renderCal(root)
      selCalDay(root, selDay)
    }
  }

  function dayHasEvent(y, m, d) {
    var tStr = fmtDate(new Date(y, m, d).getTime())
    for (var i = 0; i < annivs.length; i++) {
      if (fmtDate(new Date(annivs[i].date).getTime()) === tStr) return true
    }
    for (var j = 0; j < gifts.length; j++) {
      if (fmtDate(gifts[j].sendAt) === tStr) return true
    }
    return false
  }

  function calMove(root, delta) {
    // 先归位 1 号再加月，防 29-31 号溢出串月
    var base = new Date(calY, calM, 1)
    base.setMonth(base.getMonth() + delta)
    calY = base.getFullYear()
    calM = base.getMonth()
    selDay = undefined
    renderCal(root)
  }

  function selCalDay(root, d) {
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-day-title').textContent = calY + '年' + (calM + 1) + '月' + d + '日 的事件'
    var tStr = fmtDate(new Date(calY, calM, d).getTime())
    var evs = []
    for (var i = 0; i < annivs.length; i++) {
      if (fmtDate(new Date(annivs[i].date).getTime()) === tStr) {
        evs.push({ t: '🎉 纪念日：' + esc(annivs[i].name), id: null })
      }
    }
    for (var j = 0; j < gifts.length; j++) {
      if (fmtDate(gifts[j].sendAt) === tStr) {
        evs.push({
          t: '🎁 ' + (gifts[j].dir === 'in' ? '收到' : '送出') + '：' + esc(gifts[j].name),
          id: gifts[j].id
        })
      }
    }
    q('#sl-day-events').innerHTML = evs.length
      ? evs.map(function (e) {
          return '<div class="sl-card" style="padding:9px 12px"' +
            (e.id ? ' data-gift-id="' + esc(e.id) + '"' : '') + '>' + e.t + '</div>'
        }).join('')
      : '<div class="sl-empty">这一天没有事件</div>'
  }

  function addAnniv(root) {
    var name = window.prompt('纪念日 / 生日名称：')
    if (!name) return
    var date = window.prompt('日期（格式 2026-11-05）：')
    if (!date) return
    var d = new Date(date)
    if (isNaN(d.getTime())) {
      toast(root, '日期格式不对')
      return
    }
    annivs.push({
      id: 'a' + Date.now(),
      name: name,
      date: date,
      repeat: root.querySelector('#sl-repeat').value
    })
    save(KEY.annivs, annivs)
    renderCal(root)
    toast(root, '已添加「' + name + '」🎉')
  }

  // ================= 珍藏柜 =================
  function renderCabinet(root) {
    var q = function (sel) { return root.querySelector(sel) }
    var kw = q('#sl-cab-kw').value.trim()
    var who = q('#sl-cab-who').value
    var cat = q('#sl-cab-cat').value
    var status = q('#sl-cab-status').value
    var sort = q('#sl-cab-sort').value

    q('#sl-cab-cat').innerHTML = '<option value="">全部分类</option>' +
      cats.map(function (c) {
        return '<option' + (cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'
      }).join('')

    var list = gifts.slice()
    if (who) list = list.filter(function (g) { return who === 'in' ? g.dir === 'in' : g.dir === 'out' })
    if (cat) list = list.filter(function (g) { return g.cat === cat })
    if (status) list = list.filter(function (g) { return g.status === status })
    if (kw) {
      list = list.filter(function (g) {
        return (g.name + ' ' + (g.desc || '') + ' ' + (g.msg || '')).indexOf(kw) >= 0
      })
    }
    list.sort(function (a, b) { return sort === 'new' ? b.sendAt - a.sendAt : a.sendAt - b.sendAt })
    q('#sl-cab-list').innerHTML = list.length
      ? list.map(giftItemHtml).join('')
      : '<div class="sl-empty">没有符合条件的礼物</div>'
  }

  // ================= 详情弹层 =================
  function openDetail(root, id) {
    var g = null
    for (var i = 0; i < gifts.length; i++) if (gifts[i].id === id) g = gifts[i]
    if (!g) return
    // 未拆封的收到礼物 → 直接进拆封页
    if (g.status === 'unopened' && g.dir === 'in') {
      openUnbox(root, g)
      return
    }
    var html = '<div class="sl-closex" id="sl-sheet-close">✕</div>' +
      '<h2 class="sl-h2" style="margin-top:0">🎁 礼物详情</h2>'
    if (g.img) html += '<img class="sl-dimg" src="' + esc(g.img) + '">'
    html += '<div class="sl-kv"><div class="sl-k">名称</div><div class="sl-v">' + esc(g.name) + '</div></div>'
    html += '<div class="sl-kv"><div class="sl-k">分类</div><div class="sl-v">' + esc(g.cat) + '</div></div>'
    html += '<div class="sl-kv"><div class="sl-k">' + (g.dir === 'in' ? '赠送者' : '收礼人') +
      '</div><div class="sl-v">' + esc(g.dir === 'in' ? g.from : g.to) + '</div></div>'
    html += '<div class="sl-kv"><div class="sl-k">赠送时间</div><div class="sl-v">' + fmtDate(g.sendAt) + '</div></div>'
    if (g.unboxAt) html += '<div class="sl-kv"><div class="sl-k">拆封时间</div><div class="sl-v">' + fmtDate(g.unboxAt) + '</div></div>'
    html += '<div class="sl-kv"><div class="sl-k">包装</div><div class="sl-v">' + (g.wrapped ? '精美包装' : '无包装') + '</div></div>'
    if (g.desc) html += '<div class="sl-kv"><div class="sl-k">描述</div><div class="sl-v">' + esc(g.desc) + '</div></div>'
    if (g.msg) html += '<div class="sl-msgbox">「' + esc(g.msg) + '」</div>'
    if (g.note) html += '<div class="sl-kv"><div class="sl-k">备注</div><div class="sl-v">' + esc(g.note) + '</div></div>'
    html += '<div class="sl-btnrow">' +
      '<button class="sl-btn sl-ghost" id="sl-d-fav">' + (g.fav ? '💖 已珍藏' : '🤍 特别珍藏') + '</button>' +
      '<button class="sl-btn sl-ghost" id="sl-d-note">✏️ 备注</button></div>' +
      '<div class="sl-btnrow">' +
      '<button class="sl-btn sl-ghost" id="sl-d-chat">💬 查看聊天</button>' +
      '<button class="sl-btn sl-ghost" id="sl-d-edit">📝 编辑</button>' +
      '<button class="sl-btn sl-danger" id="sl-d-del">🗑️ 删除</button></div>'
    var sheet = root.querySelector('#sl-sheet')
    sheet.innerHTML = html
    root.querySelector('#sl-mask').classList.add('sl-show')
    // 弹层内事件
    sheet.querySelector('#sl-sheet-close').addEventListener('click', function () {
      root.querySelector('#sl-mask').classList.remove('sl-show')
    })
    sheet.querySelector('#sl-d-fav').addEventListener('click', function () {
      g.fav = !g.fav
      save(KEY.gifts, gifts)
      root.querySelector('#sl-mask').classList.remove('sl-show')
      renderCabinet(root)
      toast(root, g.fav ? '已标记特别珍藏 💖' : '已取消珍藏')
    })
    sheet.querySelector('#sl-d-note').addEventListener('click', function () {
      var note = window.prompt('备注：', g.note || '')
      if (note === null) return
      g.note = note
      save(KEY.gifts, gifts)
      root.querySelector('#sl-mask').classList.remove('sl-show')
      toast(root, '备注已保存')
    })
    sheet.querySelector('#sl-d-chat').addEventListener('click', function () {
      jumpWechat(g.dir === 'in' ? g.from : g.to)
    })
    sheet.querySelector('#sl-d-edit').addEventListener('click', function () {
      editingId = g.id
      var q = function (sel) { return root.querySelector(sel) }
      q('#sl-f-name').value = g.name
      q('#sl-f-desc').value = g.desc || ''
      q('#sl-f-msg').value = g.msg || ''
      q('#sl-f-to').value = g.to
      q('#sl-f-cat').value = g.cat
      if (g.img) {
        q('#sl-img-pv').src = g.img
        q('#sl-img-pv').style.display = 'block'
        q('#sl-img-tip').style.display = 'none'
      }
      root.querySelector('#sl-mask').classList.remove('sl-show')
      go(root, 'send')
    })
    sheet.querySelector('#sl-d-del').addEventListener('click', function () {
      // 二次确认防手滑
      if (!window.confirm('确定删除这份礼物记录吗？删除后不可恢复。')) return
      gifts = gifts.filter(function (x) { return x.id !== g.id })
      save(KEY.gifts, gifts)
      root.querySelector('#sl-mask').classList.remove('sl-show')
      renderCabinet(root)
      toast(root, '已删除')
    })
  }

  // ================= 拆封 =================
  function openUnbox(root, g) {
    ubGift = g
    unboxBusy = false
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-ub-from').textContent = '来自 ' + g.from + ' 的礼物'
    q('#sl-giftbox').classList.remove('sl-open')
    q('#sl-ub-card').style.display = 'none'
    q('#sl-ub-actions').style.display = 'none'
    q('#sl-ub-home').style.display = 'none'
    q('#sl-ub-hint').style.display = 'block'
    q('#sl-ub-hint').textContent = '轻点礼盒拆开它'
    go(root, 'unbox')
  }

  function doUnbox(root) {
    if (unboxBusy) return // 防重复拆封重复记录
    if (!ubGift) return
    if (ubGift.status === 'opened') {
      // 已拆封再打开：只展示不重复记录
      showUnboxResult(root)
      return
    }
    unboxBusy = true
    ubGift.status = 'opened'
    ubGift.unboxAt = Date.now()
    save(KEY.gifts, gifts)
    showUnboxResult(root)
  }

  function showUnboxResult(root) {
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-giftbox').classList.add('sl-open')
    q('#sl-ub-hint').style.display = 'none'
    q('#sl-ub-card').style.display = 'block'
    q('#sl-ub-actions').style.display = 'block'
    q('#sl-ub-home').style.display = 'block'
    q('#sl-ub-msg').textContent = ubGift.msg ? '「' + ubGift.msg + '」' : ''
    q('#sl-ub-name').textContent = ubGift.name
    q('#sl-ub-desc').textContent = ubGift.desc || '（无描述）'
    q('#sl-ub-cardtext').textContent = (ubGift.wrap && ubGift.wrap.cardText) ? ubGift.wrap.cardText : '（无贺卡）'
    if (ubGift.img) {
      q('#sl-ub-img').src = ubGift.img
      q('#sl-ub-img').style.display = 'block'
    } else {
      q('#sl-ub-img').style.display = 'none'
    }
  }

  // ================= 设置渲染 =================
  function renderSettings(root) {
    var q = function (sel) { return root.querySelector(sel) }
    q('#sl-cat-chips').innerHTML = cats.map(function (c) {
      return '<span class="sl-chip">' + esc(c) + '<span class="sl-cdel" data-cat="' + esc(c) + '">✕</span></span>'
    }).join('')
    q('#sl-cat-chips').onclick = function (e) {
      var del = e.target.closest ? e.target.closest('[data-cat]') : null
      if (!del) return
      var c = del.getAttribute('data-cat')
      cats = cats.filter(function (x) { return x !== c })
      save(KEY.cats, cats)
      renderSettings(root)
    }
    var kb = 0
    try { kb = JSON.stringify(gifts).length / 1024 } catch (e) { kb = 0 }
    q('#sl-data-size').textContent = '礼物 ' + gifts.length + ' 件 · 约 ' + kb.toFixed(1) + ' KB（含图片）'
    q('#sl-def-wrap').value = settings.defWrap || 'ribbon'
    q('#sl-ai-freq').value = settings.aiFreq || 'mid'
    q('#sl-def-wrap').onchange = function () {
      settings.defWrap = this.value
      save(KEY.settings, settings)
    }
    q('#sl-ai-freq').onchange = function () {
      settings.aiFreq = this.value
      save(KEY.settings, settings)
    }
  }
})()
