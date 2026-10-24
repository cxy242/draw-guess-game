/* ============================================================
   信格 xinge.js — B5a：壳 / 页面栈 / 数据层 / 时间层 / P0 / P1
   施工图契约：入口 window.showXingePage()（首行铁律）
   导出面 window.Xinge；内部函数不裸挂
   降级链：TimeWorld / WanWanMemory / callAI / runWanWanDBRead
   写档双戳：createdAt(虚拟) + realCreatedAt(现实裸值，仅 INSERT)
   ============================================================ */
(function () {
  'use strict';

  /* ===== 0. 常量 ===== */
  var Xinge; // 本地引用（导出时双写 window.Xinge，eslint 归零）
  var XG_VER = '1.0.0';
  var XG_IMG = 'img/xinge/';
  var DEFAULT_PRESETS = [
    { key: 'friend',  name: '朋友', tone: '插科打诨里藏真心', icon: 'icon-heart',  prompt: '以相识多年的老友口吻写信：语气轻松、可以互相打趣，但字里行间藏着真挚的关心。可以提旧事、开小玩笑，落款随意。' },
    { key: 'family',  name: '亲人', tone: '絮叨里全是惦记',   icon: 'icon-laurel', prompt: '以家人的口吻写信：絮絮叨叨讲些家长里短，反复叮嘱，克制而深沉的爱，不说漂亮话但处处是惦记。' },
    { key: 'lover',   name: '情侣', tone: '克制又汹涌的想念', icon: 'icon-seal',   prompt: '以恋人的口吻写信：温柔、亲密，带一点克制的汹涌想念。可以写细节里的心动，语气缱绻不轻浮。' },
    { key: 'crush',   name: '暗恋', tone: '欲言又止的心事',   icon: 'icon-star',   prompt: '以暗恋者的口吻写信：欲言又止、小心翼翼，很多话写了一半又咽回去（用划掉的方式表现），字里行间是藏不住又不敢说的心事。' },
    { key: 'mentor',  name: '师长', tone: '严厉背后是期许',   icon: 'icon-gear',   prompt: '以师长的口吻写信：沉稳、有分寸，偶尔严厉但背后是期许与关怀，像一封值得反复读的信。' },
    { key: 'stranger',name: '陌生人', tone: '温和的善意',     icon: 'icon-person', prompt: '以一个萍水相逢的陌生人的口吻写信：克制、礼貌、温和，带着不冒犯的善意与一点点好奇。' },
    { key: 'self',    name: '自己', tone: '与自己坦诚相见',   icon: 'icon-quill',  prompt: '以自己写给自己的口吻：坦诚、不自欺，可以安慰、可以责备、可以只是说说话，像深夜给自己写的一封信。' }
  ];
  var COMPOSE_CAPTIONS = ['正在斟酌字句…', '翻了翻记忆…', '墨迹未干…', '慢慢写着…', '封缄中…'];

  /* ===== 1. 降级包装 ===== */
  function nowTs() {
    try { return (window.TimeWorld && window.TimeWorld.getNow) ? window.TimeWorld.getNow() : Date.now(); }
    catch (e) { console.warn('[xinge] TimeWorld 降级', e); return Date.now(); }
  }
  function nowReal() { return Date.now(); } // 审计锚：永远裸现实时间
  function fmtTime(ts) {
    try { return (window.TimeWorld && window.TimeWorld.getFormattedNow) ? window.TimeWorld.getFormattedNow(ts) : new Date(ts).toLocaleString(); }
    catch (e) { return new Date(ts).toLocaleString(); }
  }
  function dayString() {
    try { return (window.TimeWorld && window.TimeWorld.getDayString) ? window.TimeWorld.getDayString() : '今天'; }
    catch (e) { return '今天'; }
  }
  function daysSinceChat(charId) {
    try {
      if (window.TimeWorld && window.TimeWorld.getTimeSinceLastChat) {
        var last = window.TimeWorld.getTimeSinceLastChat(charId);
        return (last && last > 0) ? Math.floor((nowTs() - last) / 86400000) : null;
      }
    } catch (e) { console.warn('[xinge] getTimeSinceLastChat 降级', e); }
    return null;
  }
  function toast(msg) {
    try { window.toast ? window.toast(msg) : console.log('[xinge toast]', msg); }
    catch (e) { console.log('[xinge toast]', msg); }
  }
  function dbRead(fn) {
    return (window.runWanWanDBRead) ? window.runWanWanDBRead(fn) : fn();
  }
  function dbWrite(fn) {
    return (window.runWanWanDBIdempotentWrite) ? window.runWanWanDBIdempotentWrite(fn) : fn();
  }

  /* ===== 2. 数据层 ===== */
  function hasLettersTable() {
    return !!(window.db && window.db.xingeLetters);
  }
  function hasPresetsTable() {
    return !!(window.db && window.db.xingePresets);
  }
  // 设置读写（config 键）
  function getConfig(key, fallback) {
    return dbRead(function () {
      return window.db.config.get(key).then(function (row) {
        return row ? row.value : fallback;
      });
    }).catch(function (e) {
      console.warn('[xinge] getConfig 失败', key, e);
      return fallback;
    });
  }
  function setConfig(key, value) {
    return dbWrite(function () {
      return window.db.config.put({ key: key, value: value });
    }).catch(function (e) {
      console.warn('[xinge] setConfig 失败', key, e);
    });
  }
  // 信件读写（表缺失时降级到 config JSON 暂存，不炸页面）
  function loadLetters() {
    return dbRead(function () {
      if (hasLettersTable()) return window.db.xingeLetters.orderBy('createdAt').reverse().toArray();
      return getConfig('xinge:lettersFallback', []);
    }).catch(function (e) {
      console.warn('[xinge] loadLetters 失败', e);
      return [];
    });
  }
  function saveLetter(letter) {
    // 双时间戳：createdAt=虚拟语义锚；realCreatedAt=现实审计锚（仅 INSERT）
    letter.createdAt = letter.createdAt || nowTs();
    if (!letter.realCreatedAt) letter.realCreatedAt = nowReal();
    return dbWrite(function () {
      if (hasLettersTable()) return window.db.xingeLetters.add(letter);
      return getConfig('xinge:lettersFallback', []).then(function (arr) {
        // fallback 必须自带 id（否则后续"信不见了"）
        if (letter.id === undefined || letter.id === null) {
          letter.id = 'xl_' + nowReal() + '_' + Math.random().toString(36).slice(2, 7);
        }
        arr.unshift(letter);
        return setConfig('xinge:lettersFallback', arr).then(function () { return letter.id; });
      });
    });
  }
  function deleteLetter(id) {
    return dbWrite(function () {
      if (hasLettersTable()) return window.db.xingeLetters.delete(id);
      return getConfig('xinge:lettersFallback', []).then(function (arr) {
        var next = arr.filter(function (x) { return x.id !== id; });
        return setConfig('xinge:lettersFallback', next);
      });
    });
  }
  function markRead(id) {
    return dbWrite(function () {
      if (hasLettersTable()) return window.db.xingeLetters.update(id, { readAt: nowTs() });
      return getConfig('xinge:lettersFallback', []).then(function (arr) {
        arr.forEach(function (x) { if (x.id === id) x.readAt = nowTs(); });
        return setConfig('xinge:lettersFallback', arr);
      });
    });
  }
  function toggleFavorite(id, fav) {
    return dbWrite(function () {
      if (hasLettersTable()) return window.db.xingeLetters.update(id, { favorite: fav });
      return getConfig('xinge:lettersFallback', []).then(function (arr) {
        arr.forEach(function (x) { if (x.id === id) x.favorite = fav; });
        return setConfig('xinge:lettersFallback', arr);
      });
    });
  }
  // 预设读写（种子迁移）
  function loadPresets() {
    return dbRead(function () {
      if (hasPresetsTable()) return window.db.xingePresets.toArray();
      return getConfig('xinge:presetsFallback', DEFAULT_PRESETS.slice());
    }).catch(function () { return DEFAULT_PRESETS.slice(); });
  }
  function ensureSeedPresets() {
    return loadPresets().then(function (list) {
      if (list && list.length) return list;
      return dbWrite(function () {
        if (hasPresetsTable()) {
          return window.db.xingePresets.bulkAdd(DEFAULT_PRESETS.map(function (p) {
            return Object.assign({}, p, { createdAt: nowTs(), realCreatedAt: nowReal() });
          })).then(function () { return DEFAULT_PRESETS.slice(); });
        }
        return setConfig('xinge:presetsFallback', DEFAULT_PRESETS.slice()).then(function () { return DEFAULT_PRESETS.slice(); });
      });
    });
  }

  /* ===== 3. 页面栈 ===== */
  var _stack = [];        // 页面 id 栈
  var _timers = [];       // 本页定时器登记（关闭路径全清）
  var _inFlight = null;   // 生成请求 in-flight 守卫

  function later(fn, ms) {
    var h = setTimeout(fn, ms);
    _timers.push(h);
    return h;
  }
  function clearTimers() {
    _timers.forEach(function (h) { clearTimeout(h); clearInterval(h); });
    _timers = [];
  }
  function every(fn, ms) {
    var h = setInterval(fn, ms);
    _timers.push(h);
    return h;
  }

  /* 背景动效活动件配置（一景一动；injectDrift 按页 id 自动配景） */
  var DRIFT_SPECS = {}; // 主人令：背景纯静态原图，图片动效全砍（只留写信+拆信两个动画）

  function injectDrift(el) {
    var key = String(el.id || '').replace('xg-page-', '');
    var spec = DRIFT_SPECS[key];
    // age 页：四时光影挂背景自身
    if (key === 'age') {
      var bgSelf = el.querySelector('.xg-bg');
      if (bgSelf) bgSelf.classList.add('xg-dusk-cycle');
    }
    if (!spec) return;
    var layer = '<div class="xg-drift-layer">' + spec + '</div>';
    var bg = el.querySelector('.xg-bg');
    if (bg) bg.insertAdjacentHTML('afterend', layer);
    else el.insertAdjacentHTML('afterbegin', layer);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 打开一页（挂 full-page，进栈，页面渐入）
  function openPage(id, html, opts) {
    opts = opts || {};
    var el = document.getElementById(id);
    if (el) el.remove();
    el = document.createElement('div');
    el.id = id;
    el.className = 'full-page xg-page' + (opts.dark ? ' xg-dark' : '');
    el.innerHTML = html;
    (window.XG_PAGE_ROOT || document.body).appendChild(el);
    _stack.push(id);
    // 背景动效配景（一景一动，按页 id 自动注入）
    injectDrift(el);
    // 渐入钩子
    el.classList.add('is-entering');
    setTimeout(function () { el.classList.remove('is-entering'); }, 700);
    return el;
  }
  // 退一层（主人规格：只退到上一页）
  function popPage() {
    clearTimers();
    if (_inFlight && _inFlight.cancel) { try { _inFlight.cancel(); } catch (e) {} _inFlight = null; }
    var id = _stack.pop();
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('is-closing');
    setTimeout(function () { if (el.parentNode) el.remove(); }, 400);
  }

  /* ===== 4. 顶栏模板 ===== */
  function topbar(title, opts) {
    opts = opts || {};
    return '<div class="xg-topbar' + (opts.dark ? ' xg-topbar-dark' : '') + '">' +
      '<button class="xg-topbar-back" data-xg-act="back" aria-label="返回"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>' +
      '<div class="xg-topbar-title">' + esc(title) + '</div>' +
      '<div style="min-width:44px">' + (opts.right || '') + '</div>' +
    '</div>';
  }

  /* ===== 5. P0 信箱 ===== */
  function renderInbox() {
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('信格', { right: '<button class="xg-topbar-back" data-xg-act="go-settings" aria-label="设置"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008 19.4a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 110-4h.1A1.7 1.7 0 004.6 8a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V2a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/></svg></button>' }) +
      '<div class="xg-scroll">' +
        '<div class="xg-inbox-wrap xg-content-fade">' +
          '<div class="xg-inbox-head">' +
            '<div class="xg-headline"><div class="xg-headline-en xg-script">Post Box</div><div class="xg-headline-cn xg-script-cn">信格</div></div>' +
            '<div class="xg-inbox-unread" id="xg-inbox-count"></div>' +
          '</div>' +
          '<div class="xg-meander-bar xg-inbox-bar"></div>' +
          '<div class="xg-filter-row" id="xg-inbox-filters">' +
            '<button class="xg-chip is-selected" data-xg-filter="all">全部</button>' +
            '<button class="xg-chip" data-xg-filter="unread">未读</button>' +
            '<button class="xg-chip" data-xg-filter="fav">收藏</button>' +
          '</div>' +
          '<div class="xg-inbox-list" id="xg-inbox-list"></div>' +
        '</div>' +
      '</div>' +
      '<button class="xg-fab xg-fab-seal" data-xg-act="go-write" aria-label="让 AI 写封信"><span class="xg-fab-img"><img src="' + XG_IMG + 'xg-crest-laurel.svg" alt=""></span></button>';

    var el = openPage('xg-page-inbox', html);
    fillInbox(el, 'all');

    el.addEventListener('click', function (e) {
      var back = e.target.closest('[data-xg-act="back"]');
      if (back) { window.showXingePage._goHome ? window.showXingePage._goHome() : popPage(); return; }
      var goWrite = e.target.closest('[data-xg-act="go-write"]');
      if (goWrite) { clearTimers(); Xinge.nav.write(); return; }
      var goSet = e.target.closest('[data-xg-act="go-settings"]');
      if (goSet) { clearTimers(); Xinge.nav.settings(); return; }
      var filter = e.target.closest('[data-xg-filter]');
      if (filter) {
        el.querySelectorAll('[data-xg-filter]').forEach(function (c) { c.classList.remove('is-selected'); });
        filter.classList.add('is-selected');
        fillInbox(el, filter.getAttribute('data-xg-filter'));
        return;
      }
      var card = e.target.closest('[data-xg-letter-id]');
      if (card && !card.classList.contains('is-flying')) {
        clearTimers();
        Xinge.nav.recall(card.getAttribute('data-xg-letter-id'));
      }
    });
    // 长按菜单（8px 阈值区分点击/拖拽）
    attachLongPress(el, '[data-xg-letter-id]', function (card) {
      openLetterSheet(el, card.getAttribute('data-xg-letter-id'));
    });
  }

  function fillInbox(el, filter) {
    var listBox = el.querySelector('#xg-inbox-list');
    if (listBox) {
      listBox.innerHTML = '<div class="xg-skeleton xg-skeleton-card"></div>' +
        '<div class="xg-skeleton xg-skeleton-card"></div>' +
        '<div class="xg-skeleton xg-skeleton-card"></div>';
    }
    loadLetters().then(function (list) {
      var filtered = list.filter(function (x) {
        if (filter === 'unread') return !x.readAt;
        if (filter === 'fav') return !!x.favorite;
        return true;
      });
      var unread = list.filter(function (x) { return !x.readAt; }).length;
      var countEl = el.querySelector('#xg-inbox-count');
      if (countEl) countEl.textContent = unread ? (unread + ' 封未读') : '';
      var listBox = el.querySelector('#xg-inbox-list');
      if (!listBox) return;
      if (!filtered.length) {
        listBox.innerHTML =
          '<div class="xg-empty is-entering">' +
            '<img class="xg-empty-art" src="' + XG_IMG + 'asset-emptybox.webp" alt="">' +
            '<div class="xg-empty-text">' + (filter === 'all' ? '信箱还空着，让 AI 写一封？' : '这里还没有信') + '</div>' +
            (filter === 'all' ? '<button class="xg-btn xg-btn-primary" data-xg-act="go-write">让 AI 写一封</button>' : '') +
          '</div>';
        return;
      }
      listBox.innerHTML = filtered.map(function (x, i) {
        return '<div class="xg-en-card xg-stagger-item' + (x.readAt ? '' : ' is-unread') + '" data-xg-letter-id="' + esc(x.id) + '">' +
          '<div class="xg-en-stamp"><img src="' + XG_IMG + 'asset-stamp.webp" alt=""></div>' +
          '<div class="xg-env-post-faint"><img src="' + XG_IMG + 'xg-postmark.svg" alt=""></div>' +
          '<div class="xg-en-main">' +
            '<div class="xg-en-to">致 ' + esc((x.params && x.params.toName) || '你') + '</div>' +
            '<div class="xg-en-summary">' + esc(summarize(x)) + '</div>' +
          '</div>' +
          '<div class="xg-en-time">' + esc(fmtTime(x.scheduledAt || x.createdAt)) + '</div>' +
        '</div>';
      }).join('');
    });
  }

  function summarize(letter) {
    try {
      var p = letter.papers && letter.papers[0];
      if (!p || !p.body) return '一封刚写好的信';
      return String(p.body).replace(/~~/g, '').slice(0, 40);
    } catch (e) { return '一封信'; }
  }

  function openLetterSheet(pageEl, id) {
    var sheet = document.createElement('div');
    sheet.className = 'xg-sheet';
    sheet.innerHTML =
      '<button class="xg-sheet-item" data-xg-sheet="fav">收藏</button>' +
      '<div class="xg-sheet-divider"></div>' +
      '<button class="xg-sheet-item is-danger" data-xg-sheet="del">删除</button>';
    document.body.appendChild(sheet);
    requestAnimationFrame(function () { sheet.classList.add('is-on'); });
    function close() {
      sheet.classList.remove('is-on');
      setTimeout(function () { if (sheet.parentNode) sheet.remove(); }, 320);
    }
    sheet.addEventListener('click', function (e) {
      var act = e.target.closest('[data-xg-sheet]');
      if (!act) return;
      var kind = act.getAttribute('data-xg-sheet');
      close();
      if (kind === 'fav') {
        toggleFavorite(id, true).then(function () { toast('已收藏'); fillInbox(pageEl, 'all'); });
      } else if (kind === 'del') {
        if (!window.confirm('删除这封信？删除后无法恢复')) return;
        var card = pageEl.querySelector('[data-xg-letter-id="' + id + '"]');
        if (card) card.classList.add('is-flying'); // 折纸飞机飞走（视觉）
        deleteLetter(id).then(function () {        // 立即落库，不依赖动画定时器
          later(function () { fillInbox(pageEl, 'all'); }, 420);
        });
      }
    });
    // 点空白关
    setTimeout(function () {
      document.addEventListener('click', function once(ev) {
        if (!sheet.contains(ev.target)) { close(); document.removeEventListener('click', once); }
        else document.addEventListener('click', once, { once: true });
      }, { once: true });
    }, 0);
  }

  /* 长按（8px 阈值区分点击/拖拽；_lastTouchTs 让合成事件让位） */
  function attachLongPress(root, selector, onLong) {
    var startX = 0, startY = 0, timer = null, moved = false, lastTouchTs = 0;
    root.addEventListener('touchstart', function (e) {
      var t = e.target.closest(selector);
      if (!t) return;
      lastTouchTs = Date.now();
      moved = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      timer = setTimeout(function () {
        if (!moved) { onLong(t); timer = null; }
      }, 480);
    }, { passive: true });
    root.addEventListener('touchmove', function (e) {
      if (!timer) return;
      var dx = Math.abs(e.touches[0].clientX - startX);
      var dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 8 || dy > 8) { moved = true; clearTimeout(timer); timer = null; }
    }, { passive: true });
    root.addEventListener('touchend', function () {
      if (timer) { clearTimeout(timer); timer = null; }
    });
    root.addEventListener('click', function (e) {
      if (Date.now() - lastTouchTs < 400) return; // 合成 click 让位
      var t = e.target.closest(selector);
      if (!t) return;
      startX = 0; startY = 0;
    }, true);
  }

  /* ===== 6. P1 写信首页 ===== */
  function renderWrite() {
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('写信') +
      '<div class="xg-scroll"><div class="xg-write-wrap xg-content-fade">' +
        '<div class="xg-write-stage">' +
          '<div class="xg-write-crest xg-crest"></div>' +
          '<div class="xg-write-motto">With Love</div>' +
          '<button class="xg-btn xg-btn-primary xg-btn-hero xg-btn-shine" data-xg-act="compose">' +
            '<span class="xg-btn-seal xg-wax"></span><span>让 AI 写封信</span>' +
          '</button>' +
        '</div>' +
        '<div id="xg-resume-slot"></div>' +
        '<div class="xg-recent-row" id="xg-recent-row"></div>' +
        '<div class="xg-timer-strip" data-xg-act="go-timer" id="xg-timer-strip"></div>' +
      '</div></div>';

    var el = openPage('xg-page-write', html);
    fillWriteHome(el);

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      if (e.target.closest('[data-xg-act="compose"]')) { clearTimers(); Xinge.nav.recipient(); return; }
      if (e.target.closest('[data-xg-act="go-timer"]')) { clearTimers(); Xinge.nav.timer(); return; }
      if (e.target.closest('[data-xg-act="resume"]')) { clearTimers(); Xinge.nav.recipient(); return; }
      var recent = e.target.closest('[data-xg-letter-id]');
      if (recent) { clearTimers(); Xinge.nav.recall(recent.getAttribute('data-xg-letter-id')); }
    });
  }

  function fillWriteHome(el) {
    loadLetters().then(function (list) {
      var recentBox = el.querySelector('#xg-recent-row');
      if (recentBox && list.length) {
        recentBox.innerHTML = list.slice(0, 3).map(function (x) {
          return '<div class="xg-recent-card xg-hoverable" data-xg-letter-id="' + esc(x.id) + '"></div>';
        }).join('');
      }
      var resumeSlot = el.querySelector('#xg-resume-slot');
      var settings = getConfig('xinge:settings', null);
      return settings.then(function (s) {
        if (resumeSlot && s && s.lastParams) {
          resumeSlot.innerHTML =
            '<div class="xg-resume-card" data-xg-act="resume">' +
              '<span class="xg-resume-tag">继续上次</span>' +
              '<span class="xg-en-to">写给 ' + esc((s.lastParams && s.lastParams.toName) || '你') + ' 的一封信</span>' +
            '</div>';
        }
        var strip = el.querySelector('#xg-timer-strip');
        if (strip) {
          strip.textContent = (s && s.scheduleOn)
            ? ('定时来信 · ' + (s.freq || '每周') + ' ' + (s.timeHHMM || '21:00') + ' · 已开启')
            : '定时来信 · 未开启';
        }
      });
    });
  }

  /* ===== 6.5 写信链 P2–P4（B5b） ===== */
  var _draft = {};        // 本次写信草稿参数
  var _lastDraft = null;  // 生成失败重试用

  /* ===== 6.x P2b 谁给我写信（从角色档案提取选择） ===== */
  function renderSender() {
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('谁给我写信') +
      '<div class="xg-scroll"><div class="xg-recipient-wrap xg-content-fade">' +
        '<div class="xg-question-title">这封信，让谁写给你？</div>' +
        '<div class="xg-guide-bar" data-xg-act="goto-chars"><span class="xg-guide-text">角色档案里的人（AI 角色）会以自己的身份给你写信</span><span class="xg-guide-arrow">›</span></div>' +
        '<div class="xg-group-card" id="xg-sender-list"></div>' +
        '<div class="xg-orn-divider"><span class="xg-orn-leaf"><img src="' + XG_IMG + '12-laurel.webp" alt=""></span></div>' +
        '<div class="xg-arch-card xg-hoverable" data-xg-sender="none">' +
          '<div class="xg-arch-icon xg-crest"></div>' +
          '<div class="xg-arch-title">不指定</div>' +
          '<div class="xg-arch-sub">按下一步的关系口吻直接写</div>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-sender', html);
    // 填角色列表
    var listBox = el.querySelector('#xg-sender-list');
    if (listBox) listBox.innerHTML = '<div class="xg-skel-row"></div><div class="xg-skel-row"></div>';
    var charsPromise = (window.db && window.db.characters)
      ? window.db.characters.toArray().catch(function () { return []; })
      : Promise.resolve([]);
    charsPromise.then(function (chars) {
      if (!listBox || !listBox.isConnected) return;
      var list = (chars || []).filter(function (c) { return c && c.name; });
      if (!list.length) {
        listBox.innerHTML = '<div class="xg-state-mini"><div class="xg-state-mini-text">角色档案里还没有人，先去添加？</div></div>';
        return;
      }
      listBox.innerHTML = list.map(function (c) {
        return '<div class="xg-avatar-row" data-xg-sender-id="' + esc(c.id) + '">' +
          '<div class="xg-avatar">' + (c.avatar
            ? '<img class="xg-avatar-img" src="' + esc(c.avatar) + '" alt="">'
            : '<div class="xg-avatar-img xg-crest"></div>') +
          '<div class="xg-avatar-ring"></div></div>' +
          '<div><div class="xg-avatar-name">' + esc(c.name) + '</div>' +
          (c.description ? '<div class="xg-avatar-tag">' + esc(String(c.description).slice(0, 18)) + '</div>' : '') +
          '</div><div class="xg-avatar-arrow">›</div></div>';
      }).join('');
    });

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      if (e.target.closest('[data-xg-act="goto-chars"]')) {
        toast('到桌面打开「角色档案」添加人物');
        return;
      }
      var none = e.target.closest('[data-xg-sender="none"]');
      if (none) {
        delete _draft.senderName; delete _draft.senderDesc; delete _draft.senderCharId;
        clearTimers(); Xinge.nav.preset();
        return;
      }
      var row = e.target.closest('[data-xg-sender-id]');
      if (row) {
        var sid = row.getAttribute('data-xg-sender-id');
        charsPromise.then(function (chars) {
          var picked = null;
          (chars || []).forEach(function (c) { if (String(c.id) === String(sid)) picked = c; });
          if (picked) {
            _draft.senderCharId = picked.id;
            _draft.senderName = picked.name;
            _draft.senderDesc = String(picked.description || picked.persona || '').slice(0, 200);
          }
          clearTimers(); Xinge.nav.preset();
        });
      }
    });
  }

  function renderRecipient() {
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('收信人') +
      '<div class="xg-scroll"><div class="xg-recipient-wrap xg-content-fade">' +
        '<div class="xg-question-title"><span class="xg-laurel-side xg-crest"></span>这封信，写给谁？<span class="xg-laurel-side xg-crest"></span></div>' +
        '<div class="xg-arch-card xg-hoverable" data-xg-rec="me">' +
          '<div class="xg-arch-icon xg-crest"></div>' +
          '<div class="xg-arch-title">给我写的</div>' +
          '<div class="xg-arch-sub">写给此刻的自己</div>' +
        '</div>' +
        '<div class="xg-arch-card xg-hoverable" data-xg-rec="other">' +
          '<div class="xg-arch-icon xg-crest"></div>' +
          '<div class="xg-arch-title">给其他人写的</div>' +
          '<div class="xg-arch-sub">联系人 / 不同年纪的自己 / 心里的某个人</div>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-recipient', html);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var me = e.target.closest('[data-xg-rec="me"]');
      if (me) {
        _draft = { recipientType: 'me', toName: '我', relationKey: 'self' };
        clearTimers(); Xinge.nav.sender(); // 先选谁给我写信
        return;
      }
      if (e.target.closest('[data-xg-rec="other"]')) { clearTimers(); Xinge.nav.target(); }
    });
  }

  function renderTarget() {
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('写给谁') +
      '<div class="xg-scroll"><div class="xg-target-wrap xg-content-fade">' +
        '<div class="xg-question-title">写给谁？</div>' +
        '<div class="xg-target-card" id="xg-card-contacts">' +
          '<div class="xg-target-head" data-xg-toggle="contacts">' +
            '<div class="xg-row-icon xg-crest"></div>' +
            '<div class="xg-target-title">联系人<div class="xg-target-sub">角色档案里的 TA 们</div></div>' +
            '<div class="xg-row-arrow">▾</div>' +
          '</div>' +
          '<div class="xg-contact-list" id="xg-contact-list"></div>' +
        '</div>' +
        '<div class="xg-target-card">' +
          '<div class="xg-target-head" data-xg-act="go-age">' +
            '<div class="xg-row-icon xg-crest"></div>' +
            '<div class="xg-target-title">给自己<div class="xg-target-sub">写给不同时候的自己</div></div>' +
            '<div class="xg-row-arrow">›</div>' +
          '</div>' +
        '</div>' +
        '<div class="xg-target-card">' +
          '<div class="xg-target-head" data-xg-act="go-custom">' +
            '<div class="xg-row-icon xg-crest"></div>' +
            '<div class="xg-target-title">自定义<div class="xg-target-sub">写给心里的某个人</div></div>' +
            '<div class="xg-row-arrow">›</div>' +
          '</div>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-target', html);
    fillContacts(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var toggle = e.target.closest('[data-xg-toggle="contacts"]');
      if (toggle) {
        el.querySelector('#xg-card-contacts').classList.toggle('is-on');
        return;
      }
      if (e.target.closest('[data-xg-act="go-age"]')) {
        _draft = Object.assign({}, _draft, { recipientType: 'self' });
        clearTimers(); Xinge.nav.age();
        return;
      }
      if (e.target.closest('[data-xg-act="go-custom"]')) {
        _draft = Object.assign({}, _draft, { recipientType: 'custom' });
        clearTimers(); Xinge.nav.custom();
        return;
      }
      var row = e.target.closest('[data-xg-char-id]');
      if (row) {
        _draft = Object.assign({}, _draft, {
          recipientType: 'contact',
          charId: row.getAttribute('data-xg-char-id'),
          toName: row.getAttribute('data-xg-char-name') || 'TA'
        });
        clearTimers(); Xinge.nav.preset();
      }
    });
  }

  function fillContacts(el) {
    var box = el.querySelector('#xg-contact-list');
    if (!box || !window.db || !window.db.characters) {
      if (box) box.innerHTML = '<div class="xg-contact-row"><div class="xg-target-sub">角色档案未加载</div></div>';
      return;
    }
    dbRead(function () {
      return window.db.characters.where('type').anyOf(['char', 'npc']).toArray();
    }).then(function (chars) {
      if (!chars || !chars.length) {
        box.innerHTML = '<div class="xg-contact-row"><div class="xg-target-sub">角色档案里还没有联系人，去添加？</div></div>';
        return;
      }
      box.innerHTML = chars.map(function (c) {
        var rel = (c.relations && c.relations[0] && (c.relations[0].label || c.relations[0].type)) || '';
        return '<div class="xg-contact-row xg-hoverable" data-xg-char-id="' + esc(c.id) + '" data-xg-char-name="' + esc(c.name) + '">' +
          '<div class="xg-crest-frame"><img src="' + esc(c.avatar || (XG_IMG + 'icon-person.svg')) + '" alt=""></div>' +
          '<div class="xg-contact-name">' + esc(c.name) + '</div>' +
          (rel ? '<div class="xg-tag">' + esc(rel) + '</div>' : '') +
        '</div>';
      }).join('');
    }).catch(function (e) {
      console.warn('[xinge] 联系人读取失败', e);
      box.innerHTML = '<div class="xg-contact-row"><div class="xg-target-sub">联系人读取失败</div></div>';
    });
  }

  function renderAge() {
    var ages = [
      { key: 'kid',   name: '小时候', range: '0–12 岁', art: 'age-kid.svg' },
      { key: 'teen',  name: '少年',   range: '13–18 岁', art: 'age-teen.svg' },
      { key: 'now',   name: '现在',   range: '此刻的自己', art: 'age-now.svg' },
      { key: 'future',name: '未来',   range: '将来的自己', art: 'age-future.svg' }
    ];
    var html =
      '<div class="xg-bg xg-bg-veil-top"></div>' +
      topbar('年龄段') +
      '<div class="xg-scroll"><div class="xg-age-wrap xg-content-fade">' +
        '<div class="xg-question-title">给哪个年纪的自己？</div>' +
        '<div class="xg-age-grid">' +
          ages.map(function (a) {
            return '<div class="xg-age-card xg-hoverable" data-xg-age="' + a.key + '">' +
              '<div class="xg-age-art" style="background-image:url(\'' + XG_IMG + a.art + '\')"></div>' +
              '<div class="xg-age-name">' + a.name + '</div>' +
              '<div class="xg-age-range">' + a.range + '</div>' +
              (a.key === 'future'
                ? '<div class="xg-future-tags"><button class="xg-chip" data-xg-future="1">1 年后</button><button class="xg-chip" data-xg-future="5">5 年后</button><button class="xg-chip" data-xg-future="10">10 年后</button></div>'
                : '') +
            '</div>';
          }).join('') +
        '</div>' +
        '<div class="xg-field" style="margin-top:18px">' +
          '<div class="xg-field-label">想对这个年纪的自己说点什么<span style="opacity:.6">(选填)</span></div>' +
          '<input class="xg-input" id="xg-age-note" placeholder="有句话，一定写进去">' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-age', html);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var futureTag = e.target.closest('[data-xg-future]');
      if (futureTag) {
        e.stopPropagation();
        el.querySelectorAll('[data-xg-future]').forEach(function (c) { c.classList.remove('is-selected'); });
        futureTag.classList.add('is-selected');
        _draft.ageYears = futureTag.getAttribute('data-xg-future');
        return;
      }
      var card = e.target.closest('[data-xg-age]');
      if (card) {
        el.querySelectorAll('[data-xg-age]').forEach(function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        var key = card.getAttribute('data-xg-age');
        if (key === 'future' && !_draft.ageYears) return; // 未来要先选年限
        _draft.ageKey = key;
        _draft.toName = key === 'now' ? '现在的我' : (key === 'future' ? (_draft.ageYears || '') + '年后的我' : (key === 'kid' ? '小时候的我' : '少年时的我'));
        _draft.relationKey = 'self';
        _draft.ageNote = (el.querySelector('#xg-age-note') || {}).value || '';
        clearTimers(); Xinge.nav.preset();
      }
    });
  }

  function renderCustom() {
    var html =
      '<div class="xg-bg xg-bg-veil-soft"></div>' +
      topbar('自定义') +
      '<div class="xg-scroll"><div class="xg-custom-wrap xg-content-fade">' +
        '<div class="xg-ribbon-head"><div class="xg-headline-en">Ink & Words</div></div>' +
        '<div class="xg-form-card xg-corner-box">' +
          '<div class="xg-field">' +
            '<div class="xg-field-label">写给谁<span class="xg-must">*</span></div>' +
            '<input class="xg-input" id="xg-c-to" placeholder="TA 的称呼">' +
          '</div>' +
          '<div class="xg-field">' +
            '<div class="xg-field-label">关系倾向<span class="xg-must">*</span></div>' +
            '<input class="xg-input" id="xg-c-rel" placeholder="我们之间的关系">' +
            '<div class="xg-field-chips">' +
              ['老友', '恋人', '家人', '师长', '陌生人', '前任'].map(function (c) {
                return '<button class="xg-chip" data-xg-relchip="' + c + '">' + c + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="xg-field">' +
            '<div class="xg-field-label">背景<span style="opacity:.6">(选填)</span></div>' +
            '<textarea class="xg-textarea" id="xg-c-bg" placeholder="我们曾是……"></textarea>' +
          '</div>' +
          '<div class="xg-field">' +
            '<div class="xg-field-label">信的调性</div>' +
            '<div class="xg-field-chips" id="xg-c-tone">' +
              ['温柔', '平静', '热烈', '苦涩', '调皮'].map(function (c) {
                return '<button class="xg-chip" data-xg-tonechip="' + c + '">' + c + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="xg-field">' +
            '<div class="xg-field-label">想聊的话题<span style="opacity:.6">(选填)</span></div>' +
            '<input class="xg-input" id="xg-c-topic" placeholder="有件事，想写进去">' +
          '</div>' +
          '<div class="xg-form-actions">' +
            '<button class="xg-btn xg-btn-primary xg-btn-full" data-xg-act="custom-next">开始写信</button>' +
          '</div>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-custom', html);
    var tone = '';
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var relChip = e.target.closest('[data-xg-relchip]');
      if (relChip) {
        var relInput = el.querySelector('#xg-c-rel');
        if (relInput) relInput.value = relChip.getAttribute('data-xg-relchip');
        return;
      }
      var toneChip = e.target.closest('[data-xg-tonechip]');
      if (toneChip) {
        el.querySelectorAll('[data-xg-tonechip]').forEach(function (c) { c.classList.remove('is-selected'); });
        toneChip.classList.add('is-selected');
        tone = toneChip.getAttribute('data-xg-tonechip');
        return;
      }
      if (e.target.closest('[data-xg-act="custom-next"]')) {
        var to = (el.querySelector('#xg-c-to') || {}).value || '';
        var rel = (el.querySelector('#xg-c-rel') || {}).value || '';
        if (!to.trim() || !rel.trim()) {
          toast('称呼和关系都要填哦');
          el.querySelector(!to.trim() ? '#xg-c-to' : '#xg-c-rel').classList.add('xg-shake');
          return;
        }
        _draft = Object.assign({}, _draft, {
          recipientType: 'custom',
          toName: to.trim(),
          customRel: rel.trim(),
          background: (el.querySelector('#xg-c-bg') || {}).value || '',
          tone: tone || '温柔',
          topic: (el.querySelector('#xg-c-topic') || {}).value || ''
        });
        clearTimers(); Xinge.nav.preset();
      }
    });
  }

  function renderPreset() {
    loadPresets().then(function (presets) {
      var html =
        '<div class="xg-bg xg-bg-veil-soft"></div>' +
        topbar('以谁的口吻') +
        '<div class="xg-scroll"><div class="xg-preset-wrap xg-content-fade">' +
          '<div class="xg-headline"><div class="xg-headline-en">In Their Voice</div><div class="xg-headline-zh">以谁的口吻写这封信</div></div>' +
          '<div class="xg-rel-row" id="xg-rel-row">' +
            presets.map(function (p) {
              return '<div class="xg-rel-card xg-hoverable" data-xg-preset="' + esc(p.key || p.id) + '">' +
                '<div class="xg-rel-crest xg-crest"></div>' +
                '<div class="xg-rel-name">' + esc(p.name) + '</div>' +
                '<div class="xg-rel-tone">' + esc(p.tone || '') + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div class="xg-link-row"><button class="xg-link" data-xg-act="manage-presets">管理预设</button></div>' +
          '<div class="xg-preset-fields">' +
            '<div class="xg-field">' +
              '<div class="xg-field-label">这封信的倾向<span style="opacity:.6">(选填)</span></div>' +
              '<textarea class="xg-textarea" id="xg-p-tendency" placeholder="想让 TA 怎么写这封信……"></textarea>' +
            '</div>' +
            '<div class="xg-field">' +
              '<div class="xg-field-label">最近想提的事<span style="opacity:.6">(选填)</span></div>' +
              '<input class="xg-input" id="xg-p-mention" placeholder="有件事，一定写进去">' +
            '</div>' +
          '</div>' +
          '<div class="xg-mood-block">' +
            '<div class="xg-mood-head"><div class="xg-field-label">情绪浓度</div><div class="xg-mood-value" id="xg-mood-val">50</div></div>' +
            '<div class="xg-slider"><input type="range" min="0" max="100" value="50" id="xg-mood"></div>' +
            '<div class="xg-slider-ends"><span>淡</span><span>浓</span></div>' +
          '</div>' +
          '<div class="xg-generate-block">' +
            '<button class="xg-btn xg-btn-primary xg-btn-full xg-btn-shine" data-xg-act="generate">生成</button>' +
          '</div>' +
        '</div></div>';
      var el = openPage('xg-page-preset', html);
      var moodEl = el.querySelector('#xg-mood');
      moodEl.addEventListener('input', function () {
        el.querySelector('#xg-mood-val').textContent = moodEl.value;
      });
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
        if (e.target.closest('[data-xg-act="manage-presets"]')) { clearTimers(); Xinge.nav.presetManager(); return; }
        var card = e.target.closest('[data-xg-preset]');
        if (card) {
          el.querySelectorAll('[data-xg-preset]').forEach(function (c) { c.classList.remove('is-selected'); });
          card.classList.add('is-selected');
          _draft.presetKey = card.getAttribute('data-xg-preset');
          return;
        }
        if (e.target.closest('[data-xg-act="generate"]')) {
          if (!_draft.presetKey) { toast('先选一个口吻'); return; }
          _draft.tendency = (el.querySelector('#xg-p-tendency') || {}).value || '';
          _draft.mention = (el.querySelector('#xg-p-mention') || {}).value || '';
          _draft.mood = parseInt(moodEl.value, 10) || 50;
          clearTimers();
          Xinge.compose.run(_draft);
        }
      });
    });
  }

  /* ===== 6.6 生成管线（callAI + 记忆喂料 + 动态日期） ===== */
  var XG_SYS_BASE = '你是\"信格\"——一台希腊复古风格的手写信装置、代笔人。现在替写信人写一封信，务必严格满足：\n1.【结构】一次输出三张纸（2+1）：前两张是正常信文（寒暄、近况、想说的话），第三张是隐藏的心里话（更真、更私密、平时说不出口的）。\n2.【划掉标注】不好意思说的、真实感受、内心阴暗面，用 ~~...~~ 包住（段落级整段划）。每张信文 1-2 处；心里话纸划掉密度最高，可整段整段划。\n3.【篇幅】第一、二张信文每张 250 字左右（3-5 个自然段，写具体的事、细节、场景，不许空洞抒情）；心里话 200 字左右（2-4 段）。写实打实的内容。\n4.【输出格式】只输出 JSON，不输出任何多余文字：\n{\"papers\":[{\"kind\":\"letter\",\"title\":\"\",\"body\":\"正文，自然段用\\n分隔，划掉段用 ~~...~~\"},{\"kind\":\"letter\",\"title\":\"\",\"body\":\"...\"},{\"kind\":\"heart\",\"title\":\"\",\"body\":\"...\"}],\"envelopeNote\":\"信封上的一句话（8 字以内）\"}\n5.【日期】使用给定的当前日期语境，不写死具体年份也可，落款日期格式自然。' +
    '1. 输出严格 JSON（无 markdown 包裹），结构：{"papers":[{"kind":"letter","title":"…","body":"…"},{"kind":"letter","title":"…","body":"…"},{"kind":"heart","title":"…","body":"…"}],"envelopeNote":"…"}\n' +
    '2. 三张信=2+1 结构：前两张是正常的信文（寒暄、近况、想说的话），第三张 kind="heart" 是隐藏的心里话（最真、划掉最多）。\n' +
    '3. 划掉的字用 ~~…~~ 标注**整段**（表示不好意思说/真实感受/阴暗面）：第 1 张偶尔一句，第 2 张若干段，第 3 张整段整段划。\n' +
    '4. 语言用简体中文，书信体，有真情实感，禁止空洞套话。\n' +
    '5. envelopeNote 是信封上的一句话（10 字内）。\n';

  function buildUserPrompt(draft, memoryCtx, presets) {
    var preset = null;
    presets.forEach(function (p) { if ((p.key || String(p.id)) === draft.presetKey) preset = p; });
    var lines = [];
    lines.push('【当前日期】' + dayString());
    if (draft.senderName) {
      lines.push('【写信人】你是「' + draft.senderName + '」' + (draft.senderDesc ? '——' + draft.senderDesc : '') + '，这封信以你自己的身份、口吻和与收信人的关系来写，落款用你的名字。');
    }
    lines.push('【口吻】' + (preset ? preset.name + '——' + (preset.prompt || '') : '朋友'));
    lines.push('【收信人】' + (draft.toName || '你') + (draft.customRel ? '（关系：' + draft.customRel + '）' : ''));
    if (draft.background) lines.push('【背景】' + draft.background);
    if (draft.tone) lines.push('【调性】' + draft.tone);
    if (draft.ageKey) lines.push('【写给】' + (draft.ageKey === 'kid' ? '小时候的自己（0-12 岁）' : draft.ageKey === 'teen' ? '少年时的自己（13-18 岁）' : draft.ageKey === 'now' ? '现在的自己' : (draft.ageYears || '若干') + '年后的自己'));
    if (draft.ageNote) lines.push('【想说】' + draft.ageNote);
    if (draft.topic) lines.push('【想聊】' + draft.topic);
    if (draft.mention) lines.push('【必须写进去的事】' + draft.mention);
    if (draft.tendency) lines.push('【写信倾向】' + draft.tendency);
    lines.push('【情绪浓度】' + draft.mood + '/100（越高越浓烈，越低越克制）');
    var since = draft.charId ? daysSinceChat(draft.charId) : null;
    if (since != null && since > 30) lines.push('【提示】两人已经很久没见面了（约 ' + since + ' 天），信的主调应是想念。');
    if (memoryCtx) lines.push('【共同记忆】\n' + String(memoryCtx).slice(0, 2400));
    return lines.join('\n');
  }

  function runCompose(draft) {
    if (_inFlight) { toast('上一封还在写呢'); return; }
    Xinge.nav.composing();
    var composeStart = nowTs(); // A1：生成动画最短 2.5s 不闪切
    _lastDraft = draft;         // 失败重试用
    var userPrompt = '';
    var memPromise;
    try {
      memPromise = (window.WanWanMemory && window.WanWanMemory.getMemoryContext && draft.charId)
        ? window.WanWanMemory.getMemoryContext(null, draft.charId, window._wechatUid || '', [draft.tendency || draft.topic || '写信']).catch(function () { return ''; })
        : Promise.resolve('');
    } catch (e) { memPromise = Promise.resolve(''); }

    var cancelled = false;
    _inFlight = {
      cancel: function () { cancelled = true; }
    };

    memPromise.then(function (memCtx) {
      return loadPresets().then(function (presets) {
        if (cancelled) return null;
        userPrompt = buildUserPrompt(draft, memCtx, presets);
        if (!window.callAI) throw new Error('callAI 未加载');
        return window.callAI([{ role: 'user', content: userPrompt }], { system: XG_SYS_BASE });
      });
    }).then(function (result) {
      if (cancelled || !result) return;
      var text = (typeof result === 'string') ? result : (result.content || result.text || result.message || '');
      var parsed = parseLetterJSON(text);
      if (!parsed) throw new Error('信件 JSON 解析失败');
      return saveLetter({
        senderKey: draft.presetKey || 'friend',
        recipientType: draft.recipientType || 'me',
        charId: draft.charId || null,
        status: 'done',
        scheduledAt: draft.scheduledAt || null,
        papers: parsed.papers,
        envelopeNote: parsed.envelopeNote || '',
        params: {
          toName: draft.toName || '你',
          presetKey: draft.presetKey,
          mood: draft.mood,
          tendency: draft.tendency || '',
          mention: draft.mention || ''
        }
      });
    }).then(function () {
      _inFlight = null;
      if (cancelled) return;
      return loadLetters().then(function (list) {
        var newest = list[0];
        // 记住"继续上次"
        getConfig('xinge:settings', {}).then(function (s) {
          s = s || {};
          s.lastParams = { toName: draft.toName, presetKey: draft.presetKey };
          return setConfig('xinge:settings', s);
        });
        // A1：动画最短 2.5s，不足则补足再进 P6（不闪切）
        var elapsed = nowTs() - composeStart;
        var waitMs = Math.max(0, 2500 - elapsed);
        if (waitMs > 0) later(function () { Xinge.nav.envelope(newest && newest.id); }, waitMs);
        else Xinge.nav.envelope(newest && newest.id);
      });
    }).catch(function (err) {
      _inFlight = null;
      console.error('[xinge] 生成失败', err);
      if (!cancelled) Xinge.compose.fail();
    });
  }

  function parseLetterJSON(text) {
    try {
      var cleaned = String(text).trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      var start = cleaned.indexOf('{');
      var end = cleaned.lastIndexOf('}');
      if (start < 0 || end <= start) return null;
      var obj = JSON.parse(cleaned.slice(start, end + 1));
      if (!obj.papers || !Array.isArray(obj.papers) || obj.papers.length < 2) return null;
      // 容错：不足 3 张补空心里话（2+1 结构兜底）
      while (obj.papers.length < 3) {
        obj.papers.push({ kind: 'heart', title: '', body: '（这封信的心里话没写成，下次再写）' });
      }
      obj.papers = obj.papers.slice(0, 3).map(function (p, i) {
        return {
          kind: i === 2 ? 'heart' : (p.kind === 'heart' ? 'heart' : 'letter'),
          title: p.title || '',
          body: p.body || ''
        };
      });
      return obj;
    } catch (e) {
      console.warn('[xinge] JSON 解析失败', e);
      return null;
    }
  }

  /* ===== 6.7 P5 生成动画页（B5c） ===== */
  function renderComposing() {
    var html =
      '<div class="xg-bg xg-bg-veil-dark"></div>' +
      '<div class="xg-compose-wrap">' +
        '<div class="xg-c2-stage">' +
          '<div class="xg-c2-paper">' +
            '<div class="xg-c2-frame"><i class="f-tl"></i><i class="f-tr"></i><i class="f-bl"></i><i class="f-br"></i></div>' +
            '<svg class="xg-c2-orn" viewBox="0 0 220 160" preserveAspectRatio="none">' +
            '<g stroke="rgba(137,109,89,0.5)" fill="none" stroke-width="1.2" stroke-linecap="round">' +
            '<path d="M82 14c8-5 16-7 28-7s20 2 28 7"/>' +
            '</g>' +
            '<g fill="rgba(158,169,141,0.6)">' +
            '<ellipse cx="92" cy="11" rx="4" ry="2" transform="rotate(-22 92 11)"/>' +
            '<ellipse cx="110" cy="7" rx="4" ry="2"/>' +
            '<ellipse cx="128" cy="11" rx="4" ry="2" transform="rotate(22 128 11)"/>' +
            '</g>' +
            '<g stroke="rgba(137,109,89,0.45)" fill="none" stroke-width="1.1" stroke-linecap="round">' +
            '<path d="M30 146c8 3 16 3 22-2M168 146c8 3 16 3 22-2"/>' +
            '</g>' +
            '</svg>' +
            '<svg class="xg-c2-ink" viewBox="0 0 220 160">' +
            '<circle class="xg-c2-dot" cx="14" cy="26" r="3"/>' +
            '<circle class="xg-c2-dot" cx="16" cy="64" r="3"/>' +
            '<circle class="xg-c2-dot" cx="20" cy="102" r="3"/>' +
            '<path d="M26 28 C 52 18, 78 36, 106 26 S 156 16, 196 30"/>' +
            '<path d="M28 66 C 58 56, 84 74, 114 64 S 162 54, 198 68"/>' +
            '<path d="M32 104 C 60 96, 88 112, 120 102 S 166 94, 198 106"/>' +
            '<path class="xg-c2-flourish" d="M170 118 c 10 4 18 3 24-3 M186 112 l 8-3 -3 8"/>' +
            '</svg>' +
            '<div class="xg-c2-blot"></div>' +
          '</div>' +
          '<div class="xg-c2-dip"></div>' +
          '<div class="xg-c2-pen"><svg viewBox="0 0 90 140"><path d="M78 8 C 60 20, 44 44, 32 76 L 26 96" fill="none" stroke="#EDE5D6" stroke-width="5" stroke-linecap="round"/><path d="M78 8 C 66 6, 52 12, 46 24 C 56 22, 68 18, 78 8 Z" fill="rgba(238,232,218,0.85)"/><path d="M70 12 C 58 18, 50 30, 46 42" fill="none" stroke="rgba(137,109,89,0.5)" stroke-width="1.6"/><path d="M62 18 C 52 26, 46 38, 42 50" fill="none" stroke="rgba(137,109,89,0.4)" stroke-width="1.3"/><path d="M26 96 L 22 118 L 28 112 Z" fill="#896D59"/><path d="M22 118 L 20 128" stroke="rgba(47,53,39,0.8)" stroke-width="2" stroke-linecap="round"/></svg></div>' +
          '<div class="xg-c2-inkpot"><svg viewBox="0 0 80 90"><path d="M18 34 L 22 78 C 22 82, 26 84, 32 84 L 48 84 C 54 84, 58 82, 58 78 L 62 34 Z" fill="rgba(70,95,120,0.85)" stroke="#896D59" stroke-width="2"/><rect x="14" y="26" width="52" height="10" rx="3" fill="#B9D2E2" stroke="#896D59" stroke-width="2"/><ellipse cx="40" cy="30" rx="14" ry="4" fill="rgba(47,53,39,0.8)"/><path d="M28 44 L 30 72" stroke="rgba(255,255,255,0.4)" stroke-width="3" stroke-linecap="round"/></svg></div>' +
          '<div class="xg-c2-sealdrop"></div>' +
        '</div>' +
        '<div class="xg-p5-line" id="xg-caption"></div>' +
        '<div class="xg-progress" id="xg-progress"><div class="xg-progress-fill"></div></div>' +
        '<button class="xg-p5-skip" data-xg-act="compose-skip">跳过</button>' +
      '</div>';
    var el = openPage('xg-page-composing', html, { dark: true });

    // 文案轮播（每 2.2s 换句）
    var ci = 0;
    var captionEl = el.querySelector('#xg-caption');
    every(function () {
      ci = (ci + 1) % COMPOSE_CAPTIONS.length;
      if (captionEl) captionEl.textContent = COMPOSE_CAPTIONS[ci];
    }, 2200);

    // 假进度：到 90% 封顶（真完成由 compose.finish 推 100）
    var pct = 0;
    var progressEl = el.querySelector('#xg-progress');
    every(function () {
      if (pct < 90) {
        pct += Math.max(2, (90 - pct) * 0.12);
        if (progressEl) progressEl.style.width = pct.toFixed(0) + '%';
      }
    }, 600);

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="skip"]')) {
        clearTimers();
        Xinge.compose.skipToResult();
        return;
      }
      if (e.target.closest('[data-xg-act="retry"]')) {
        clearTimers();
        el.classList.remove('is-error');
        Xinge.compose.run(_draft);
      }
    });
  }

  /* ===== 6.8 P6 信封页 + 拆信动画驱动 ===== */
  var _currentLetterId = null;
  var _revealLetterId = null;   // 刚拆开的信：必走显字动画
  var _readModePref = '直接全文'; // S5 偏好缓存（renderPrefs 同步）

  function renderEnvelope(letterId) {
    _currentLetterId = letterId;
    var html =
      '<div class="xg-bg"></div>' +
      topbar('一封信') +
      '<div class="xg-scroll"><div class="xg-content-fade" style="padding-top:3vh">' +
        '<div class="xg-env4-stage is-arriving" id="xg-env2-stage">' +
          '<div class="xg-env4">' +
            '<div class="xg-env4-back"></div>' +
            '<div class="xg-env4-letter" id="xg-env2-letters"></div>' +
            '<div class="xg-env4-pocket">' +
              '<div class="xg-env4-vine"><svg viewBox="0 0 460 310" preserveAspectRatio="none"><g stroke="rgba(137,109,89,0.6)" fill="none" stroke-width="1.3" stroke-linecap="round"><path d="M60 292c26-5 46-16 56-32 7-12 6-24-2-31-7-6-17-5-21 2-4 5-1 12 5 13 4 1 8-2 7-6"/><path d="M400 292c-26-5-46-16-56-32-7-12-6-24 2-31 7-6 17-5 21 2 4 5 1 12-5 13-4 1-8-2-7-6"/><path d="M180 28c12 5 28 5 40 0M240 28c12 5 28 5 40 0"/></g><g fill="none" stroke="rgba(137,109,89,0.55)" stroke-width="1.1"><path d="M76 262c-4-7-3-14 3-19M96 246c-5-6-5-13-1-18M384 262c4-7 3-14-3-19M364 246c5-6 5-13 1-18"/><path d="M212 40c-5-7-4-15 2-20M226 48c-6-5-8-13-5-19M248 48c6-5 8-13 5-19M262 40c5-7 4-15-2-20"/></g></svg></div>' +
            '</div>' +
            '<div class="xg-env4-hinge">' +
              '<div class="xg-env4-flap">' +
                '<div class="xg-env4-flap-out"></div>' +
                '<div class="xg-env4-flap-in"></div>' +
              '</div>' +
              
            '</div>' +
          '</div>' +
            '<div class="xg-env4-seal-hinge">' +
              '<div class="xg-env4-seal">' +
                '<div class="xg-seal-overflow"></div><div class="xg-seal-overflow b"></div>' +
                '<div class="xg-seal-wax"></div>' +
                '<svg class="xg-seal-wreath" viewBox="0 0 62 62">' +
                '<g fill="rgba(70,95,120,0.32)">' +
                '<ellipse cx="31" cy="8.5" rx="3.4" ry="2"/><ellipse cx="46.8" cy="15.2" rx="3.4" ry="2" transform="rotate(45 46.8 15.2)"/>' +
                '<ellipse cx="53.5" cy="31" rx="2" ry="3.4"/><ellipse cx="46.8" cy="46.8" rx="3.4" ry="2" transform="rotate(-45 46.8 46.8)"/>' +
                '<ellipse cx="31" cy="53.5" rx="3.4" ry="2"/><ellipse cx="15.2" cy="46.8" rx="3.4" ry="2" transform="rotate(45 15.2 46.8)"/>' +
                '<ellipse cx="8.5" cy="31" rx="2" ry="3.4"/><ellipse cx="15.2" cy="15.2" rx="3.4" ry="2" transform="rotate(-45 15.2 15.2)"/>' +
                '</g></svg>' +
                '<div class="xg-seal-swan"><svg viewBox="0 0 40 40">' +
                '<path d="M26.6 11.4c-.8-4-4.3-6.7-8.1-6.2-3.7.5-6.2 3.6-5.9 7.2.2 2.9 2.1 5.2 4.7 6.2l-7.7 3.7c-1.3.6-1.8 2.2-1.1 3.4.6 1.3 2.2 1.8 3.5 1.1l19.6-9.4c2.6-1.2 4-4 3.4-6.8-.35-1.6-1.2-2.8-2.3-3.5z" fill="rgba(238,232,218,0.94)"/>' +
                '<path d="M16.8 15.8c2.5.35 4.8-.5 6.6-2.2" fill="none" stroke="rgba(70,95,120,0.55)" stroke-width="1.1" stroke-linecap="round"/>' +
                '<path d="M15.2 18.6c2.9.5 5.6-.2 7.8-2" fill="none" stroke="rgba(70,95,120,0.4)" stroke-width="1" stroke-linecap="round"/>' +
                '<path d="M13.6 21.2c3.3.65 6.4-.05 9-1.8" fill="none" stroke="rgba(70,95,120,0.32)" stroke-width="0.9" stroke-linecap="round"/>' +
                '<path d="M12.3 27c-2.6 2.4-3 6-.7 8 2.2-1.3 3.2-3.4 2.7-5.4M27.7 27c2.6 2.4 3 6 .7 8-2.2-1.3-3.2-3.4-2.7-5.4" fill="none" stroke="rgba(70,95,120,0.5)" stroke-width="1" stroke-linecap="round"/>' +
                '<circle cx="22.9" cy="10.1" r="0.95" fill="rgba(70,95,120,0.9)"/>' +
                '<path d="M25.1 10.4l2.9-.9-2.5 2.1z" fill="rgba(206,155,105,0.95)"/>' +
                '</svg></div>' +
                '<div class="xg-seal-gloss"></div>' +
              '</div>' +
        '</div>' +
        '<div class="xg-env4-hint">拆开看看</div>' +
      '</div></div>';
    var el = openPage('xg-page-envelope', html);
    // 信封背景注入（bg-P6）
    var bg = el.querySelector('.xg-bg');
    if (bg) bg.style.backgroundImage = 'url(' + XG_IMG + 'bg-P6-vx.webp)';

    var stage = el.querySelector('#xg-env2-stage');
    var opened = false;
    // S0 出现动画播完 → 静置微晃（等待拆信）
    later(function () {
      if (stage) { stage.classList.remove('is-arriving'); stage.classList.add('is-waiting'); }
    }, 1180);
    function doDone() {
      markRead(letterId);
      _revealLetterId = letterId; // 本次会话刚拆：阅读页必走显字
      clearTimers();
      Xinge.nav.fan(letterId, 0);
    }
    function playUnseal() {
      if (!stage) { doDone(); return; }
      if (document.body.classList.contains('xg-motion-low')) { doDone(); return; }
      stage.classList.remove('is-arriving', 'is-waiting');
      stage.classList.add('is-p1-press');           // S1 火漆按压 0.5s
      later(function () {
        stage.classList.remove('is-p1-press');
        stage.classList.add('is-p2-open');          // S2 翻盖绕铰链 0.95s
        later(function () {
          stage.classList.add('is-p3-rising');      // S3 三纸升出 1.05s
          later(function () {
            stage.classList.remove('is-p3-rising');
            stage.classList.add('is-p4-fanning');   // S4 扇形飞散 0.95s
            later(function () {
              stage.classList.add('is-p5-away');    // S5 信封淡出
              later(doDone, 480);
            }, 950);
          }, 1080);
        }, 980);
      }, 520);
    }
    // 点击信封任意处拆信
    el.addEventListener('click', function (ev) {
      if (ev.target.closest('[data-xg-act="back"]')) {
        if (opened) return; // 动画中禁止返回（防半截状态）
        clearTimers(); popPage();
        return;
      }
      if (opened) return;
      opened = true;
      playUnseal();
    });
  }

  // 分拍驱动：p0 160ms → p1 620ms → p2 850ms → p3 450ms → done
  function driveUnseal(el, done) {
    var stage = el.querySelector('#xg-env-stage');
    var flap = el.querySelector('#xg-env-flap');
    var body = el.querySelector('#xg-env-body');
    var pull = el.querySelector('#xg-letters-pull');
    if (!stage || !flap) { done(); return; }
    stage.classList.add('xg-p0-press');
    later(function () {
      stage.classList.remove('xg-p0-press');
      flap.classList.add('xg-p1-unseal');
      body.classList.add('xg-p1-unseal');
      later(function () {
        if (pull) pull.classList.add('xg-p2-pull');
        body.classList.add('xg-p2-pull');
        later(function () {
          stage.classList.add('xg-p3-exit');
          later(done, 430);
        }, 850);
      }, 640);
    }, 170);
  }

  /* ===== 6.9 P7 扇形三张（顺序锁） ===== */
  function renderFan(letterId, readIndex) {
    _currentLetterId = letterId;
    loadLetters().then(function (list) {
      var letter = null;
      list.forEach(function (x) { if (String(x.id) === String(letterId)) letter = x; });
      if (!letter) { toast('信不见了'); popPage(); return; }
      var readIdx = readIndex || 0;
      var papers = letter.papers || [];
      var html =
        '<div class="xg-bg"></div>' +
        topbar('三封 · 按顺序拆读') +
        '<svg width="0" height="0" style="position:absolute"><defs>' +
        '<filter id="xg-wavy-paper"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="3" seed="7" result="n"/>' +
        '<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>' +
        '</defs></svg>' +
        '<div class="xg-fan-wrap xg-content-fade">' +
          '<div class="xg-fan2-stage is-fanned" id="xg-fan-stage">' +
            '<div class="xg-fan2-paper fp-1" data-xg-idx="0"><div class="xg-fan2-sheet">' +
              '<div class="xg-fan2-first">' + esc(((papers[0] && papers[0].body) || '').slice(0, 24)) + '</div></div></div>' +
            '<div class="xg-fan2-paper fp-2" data-xg-idx="1"><div class="xg-fan2-sheet">' +
              '<div class="xg-fan2-first">' + esc(((papers[1] && papers[1].body) || '').slice(0, 24)) + '</div></div></div>' +
            '<div class="xg-fan2-paper fp-3" data-xg-idx="2"><div class="xg-fan2-sheet"></div></div>' +
          '</div>' +
          '<div class="xg-fan2-foot">共三封 · 按顺序拆读</div>' +
          '<div class="xg-fan-finale" id="xg-finale">' +
            '<button class="xg-btn xg-btn-ghost" data-xg-act="fav">收藏</button>' +
            '<button class="xg-btn xg-btn-primary" data-xg-act="again">再来一封</button>' +
            '<button class="xg-btn xg-btn-ghost" data-xg-act="inbox">回信箱</button>' +
          '</div>' +
        '</div>';
      var el = openPage('xg-page-fan', html);
      var stage = el.querySelector('#xg-fan-stage');
      var papers2 = Array.prototype.slice.call(el.querySelectorAll('.xg-fan2-paper'));

      function syncLocks() {
        papers2.forEach(function (pp, idx) {
          pp.classList.remove('is-next', 'is-locked');
          if (idx === readIdx) pp.classList.add('is-next');
          else if (idx > readIdx) pp.classList.add('is-locked');
        });
        var finale = el.querySelector('#xg-finale');
        if (finale && readIdx >= 3) finale.style.display = '';
        else if (finale) finale.style.display = 'none';
      }
      syncLocks();

      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-xg-act="back"]')) {
          clearTimers();
          if (_revealLetterId === null) popPage();
          else Xinge.nav.envelope(letterId);
          return;
        }
        if (e.target.closest('[data-xg-act="fav"]')) {
          toggleFavorite(letterId, true).then(function () { toast('已盖「藏」章'); });
          return;
        }
        if (e.target.closest('[data-xg-act="again"]')) {
          clearTimers();
          Xinge.nav.write();
          return;
        }
        if (e.target.closest('[data-xg-act="inbox"]')) {
          clearTimers();
          while (_stack.length > 1) popPage();
          return;
        }
        var paper = e.target.closest('.xg-fan2-paper');
        if (!paper) return;
        var idx = parseInt(paper.getAttribute('data-xg-idx'), 10) || 0;
        if (idx > readIdx) {
          // A9 顺序锁：nudge + toast
          paper.classList.remove('is-nudge');
          void paper.offsetWidth;
          paper.classList.add('is-nudge');
          toast('先从第一封看起');
          return;
        }
        if (idx < readIdx) {
          // 已读过：可回看
          clearTimers();
          Xinge.nav.reading(letterId, idx);
          return;
        }
        // A5 点开转场：当前张前移放大，其余虚影，然后进 P8
        clearTimers();
        paper.classList.add('is-open');
        stage.classList.add('is-opening');
        var wait = document.body.classList.contains('xg-motion-low') ? 10 : 520;
        later(function () {
          Xinge.nav.reading(letterId, idx);
        }, wait);
      });

      // 读完三封显示收尾卡
      if (readIdx >= 3) {
        var finale2 = el.querySelector('#xg-finale');
        if (finale2) finale2.style.display = '';
      }
    });
  }

  function renderReading(letterId, paperIndex) {
    _currentLetterId = letterId;
    loadLetters().then(function (list) {
      var letter = null;
      list.forEach(function (x) { if (String(x.id) === String(letterId)) letter = x; });
      if (!letter || !letter.papers || !letter.papers[paperIndex]) { toast('信不见了'); popPage(); return; }
      var paper = letter.papers[paperIndex];
      var isHeart = paper.kind === 'heart';
      var paras = String(paper.body || '').split(/\n+/).filter(function (s) { return s.trim(); });
      // 显字判定：刚拆的信必走显现；S5"重放动画"时已读也走；其余已读直接全文
      var fresh = String(letterId) === String(_revealLetterId);
      if (fresh) _revealLetterId = null;
      var readMode = fresh ? false : (_readModePref === '重放动画' ? false : !!letter.readAt);

      var html =
        '<div class="xg-bg"></div>' +
        '<div class="xg-read-wrap">' +
          '<div class="xg-letter xg-paper-sheet' + (isHeart ? ' is-heart xg-heart-paper ps-heart' : ' ps-letter') + '" id="xg-letter">' +
            '<div class="xg-letter-postmark xg-postmark-stamp is-stamping"></div>' +
            (isHeart ? '<div class="xg-heart-label">from the heart</div><div class="xg-heart-rose"><img src="' + XG_IMG + '13-rose-branch.webp" alt=""></div>' : '') +
            '<div class="xg-letter-to xg-letter-head"><span class="xg-letter-hi">亲爱的 ' + esc((letter.params && letter.params.toName) || '你') + '：</span><div class="xg-letter-vine"></div></div>' +
            '<div class="xg-letter-body" id="xg-letter-body">' +
              paras.map(function (t) {
                var isStrike = /^~~[\s\S]*~~$/.test(t.trim());
                var inner = isStrike ? t.trim().slice(2, -2) : t;
                var chars = Array.from(inner).map(function (ch) {
                  return '<span class="xg-w">' + esc(ch) + '</span>';
                }).join('');
                if (isStrike) {
                  return '<p class="xg-letter-p xg-letter-para is-struck is-unsure xg-strike-soft"><span class="xg-strike"><span class="xg-strike-line">' + chars + '</span></span></p>';
                }
                return '<p class="xg-letter-p xg-letter-para">' + esc(inner) + '</p>';
              }).join('') +
            '</div>' +
            '<div class="xg-letter-wish"><span class="xg-wish-word">愿你一切都好。</span>' +
              '<span class="xg-wish-cursive">Yours,</span></div>' +
            '<div class="xg-letter-sign xg-sign-zone">' +
              '<div class="xg-sign-vine"><img src="' + XG_IMG + 'xg-meander.svg" alt=""></div>' +
              '<div class="xg-letter-sign-name xg-sign-script">' + esc((letter.params && letter.params.toName) || '') + '</div>' +
              '<div class="xg-letter-sign-date">' + esc(fmtTime(letter.scheduledAt || letter.createdAt)) + '</div>' +
              '<div class="xg-sign-seal"><img src="' + XG_IMG + 'xg-crest-laurel.svg" alt=""></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="xg-read-foot"><button class="xg-icon-btn xg-strike-toggle" data-xg-act="toggle-strikes" aria-label="切换划线"><img src="' + XG_IMG + 'icon-heart.svg" alt=""></button></div>';

      var el = openPage('xg-page-reading', html);
      var parasEls = Array.prototype.slice.call(el.querySelectorAll('.xg-letter-p'));

      // 显字驱动（快于默读：段间 400–700ms）
      var allShown = false;
      if (readMode) {
        parasEls.forEach(function (p) { p.classList.add('is-shown'); });
        el.querySelectorAll('.xg-strike').forEach(function (s) { s.classList.add('is-swept'); });
        allShown = true;
      } else {
        parasEls.forEach(function (p, i) {
          later(function () {
            p.classList.add('is-shown');
            var strike = p.querySelector('.xg-strike');
            if (strike) later(function () { strike.classList.add('is-swept'); }, 240);
            if (i === parasEls.length - 1) allShown = true;
          }, 300 + i * 520);
        });
      }

      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-xg-act="back"]')) {
          clearTimers();
          Xinge.nav.fan(letterId, nextReadIndex(paperIndex));
          return;
        }
        // 划线切换（全局多米诺）
        if (e.target.closest('[data-xg-act="toggle-strikes"]')) {
          var strikes = Array.prototype.slice.call(el.querySelectorAll('.xg-strike'));
          var anyVisible = strikes.some(function (s) { return !s.classList.contains('is-undone'); });
          strikes.forEach(function (s, i) {
            s.style.setProperty('--xg-domino-delay', (i * 30) + 'ms');
            s.classList.add('is-domino');
            if (anyVisible) s.classList.add('is-undone');
            else s.classList.remove('is-undone');
          });
          return;
        }
        // 单段划线：点击横线消失/恢复
        var strike = e.target.closest('.xg-strike');
        if (strike) {
          strike.classList.toggle('is-undone');
          return;
        }
        // 点空白：显现中→立即全文；全显后→回扇形页（主人拍板）
        if (!allShown) {
          parasEls.forEach(function (p) { p.classList.remove('is-shown'); p.classList.add('is-shown-fast'); });
          el.querySelectorAll('.xg-strike').forEach(function (s) { s.classList.add('is-swept'); });
          allShown = true;
          return;
        }
        if (!e.target.closest('.xg-strike-toggle')) {
          clearTimers();
          Xinge.nav.fan(letterId, nextReadIndex(paperIndex));
        }
      });
    });
  }

  function nextReadIndex(paperIndex) {
    // 读完第 i 张后扇形页应看第 i+1 张（顺序锁推进）
    return Math.min(3, (parseInt(paperIndex, 10) || 0) + 1);
  }

  /* ===== 6.11 回看（R1） ===== */
  function renderRecall(letterId) {
    loadLetters().then(function (list) {
      var letter = null;
      list.forEach(function (x) { if (String(x.id) === String(letterId)) letter = x; });
      if (!letter) { toast('信不见了'); popPage(); return; }
      if (!letter.readAt) {
        // 未读：完整拆信仪式
        Xinge.nav.envelope(letterId);
      } else {
        // 已读：扇形页全解锁可任点
        Xinge.nav.fan(letterId, 3);
      }
    });
  }

  /* ===== 6.12 S1–S7 设置组（B5d） ===== */
  function renderSettings() {
    var rows = [
      { key: 'perm',    icon: 'icon-person',  title: '谁能给我写信' },
      { key: 'timer',   icon: 'icon-clock',   title: '定时写信' },
      { key: 'presets', icon: 'icon-laurel',  title: '关系提示词' },
      { key: 'prefs',   icon: 'icon-heart',   title: '阅读偏好' },
      { key: 'notify',  icon: 'icon-bell',    title: '通知' },
      { key: 'data',    icon: 'icon-seal',    title: '数据管理' }
    ];
    var html =
      topbar('设置', { dark: true, right: '' }) +
      '<div class="xg-settings-wrap xg-content-fade">' +
        '<div class="xg-group-title">信格设置</div>' +
        '<div class="xg-group-card">' +
          rows.map(function (r) {
            return '<div class="xg-row-item" data-xg-set="' + r.key + '">' +
              '<div class="xg-row-icon"><img src="' + XG_IMG + r.icon + '.svg" width="24" height="24" alt=""></div>' +
              '<div class="xg-row-title">' + r.title + '</div>' +
              '<div class="xg-row-arrow">›</div>' +
            '</div>';
          }).join('') +
        '</div>' +
      '</div>';
    var el = openPage('xg-page-settings', html);
    el.querySelector('.xg-topbar').insertAdjacentHTML('afterend', '');
    el.querySelector('.xg-settings-wrap').insertAdjacentHTML('beforebegin', '');
    el.classList.add('xg-settings-page');
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var row = e.target.closest('[data-xg-set]');
      if (!row) return;
      clearTimers();
      var k = row.getAttribute('data-xg-set');
      if (k === 'perm') renderPerm();
      else if (k === 'timer') renderTimer();
      else if (k === 'presets') renderPresetManager();
      else if (k === 'prefs') renderPrefs();
      else if (k === 'notify') renderNotify();
      else if (k === 'data') renderData();
    });
  }

  /* S2 谁能给我写信 */
  function renderPerm() {
    var html =
      topbar('谁能给我写信', { dark: true }) +
      '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
        '<div class="xg-group-title">允许主动来信的人</div>' +
        '<div class="xg-selectall-row"><span class="xg-selectall-label">全选 / 全不选</span>' +
        '<button class="xg-wax-switch" data-xg-perm-all aria-label="全选"></button></div>' +
        '<div class="xg-group-card" id="xg-perm-list"></div>' +
      '</div></div>';
    var el = openPage('xg-page-perm', html);
    el.classList.add('xg-settings-page');
    fillPerm(el);
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var allBtn = e.target.closest('[data-xg-perm-all]');
      if (allBtn) {
        var turnOn = !allBtn.classList.contains('is-on');
        allBtn.classList.toggle('is-on', turnOn);
        getConfig('xinge:pool', { allow: {}, all: false }).then(function (pool) {
          pool.all = turnOn;
          pool.allow = pool.allow || {};
          if (turnOn) {
            el.querySelectorAll('[data-xg-perm-switch]').forEach(function (sw) {
              sw.classList.add('is-on');
              var cid = sw.getAttribute('data-xg-perm-switch');
              pool.allow[cid] = pool.allow[cid] || '偶尔';
            });
          } else {
            pool.allow = {};
            el.querySelectorAll('[data-xg-perm-switch]').forEach(function (sw) { sw.classList.remove('is-on'); });
          }
          return setConfig('xinge:pool', pool);
        });
        return;
      }
      var sw = e.target.closest('[data-xg-perm-switch]');
      if (sw) {
        var charId = sw.getAttribute('data-xg-perm-switch');
        getConfig('xinge:pool', { allow: {}, all: false }).then(function (pool) {
          pool.allow = pool.allow || {};
          var on = !sw.classList.contains('is-on');
          sw.classList.toggle('is-on', on);
          if (on) pool.allow[charId] = pool.allow[charId] || '偶尔';
          else delete pool.allow[charId];
          return setConfig('xinge:pool', pool);
        });
        return;
      }
      var freq = e.target.closest('[data-xg-freq]');
      if (freq) {
        var fid = freq.getAttribute('data-xg-freq-id');
        var fval = freq.getAttribute('data-xg-freq');
        getConfig('xinge:pool', { allow: {} }).then(function (pool) {
          pool.allow = pool.allow || {};
          pool.allow[fid] = fval;
          freq.parentNode.querySelectorAll('.xg-chip').forEach(function (c) { c.classList.remove('is-selected'); });
          freq.classList.add('is-selected');
          return setConfig('xinge:pool', pool);
        });
      }
    });
  }

  function fillPerm(el) {
    var box = el.querySelector('#xg-perm-list');
    dbRead(function () {
      return (window.db && window.db.characters)
        ? window.db.characters.where('type').anyOf(['char', 'npc']).toArray()
        : Promise.resolve([]);
    }).then(function (chars) {
      return getConfig('xinge:pool', { allow: {}, all: false }).then(function (pool) {
        pool.allow = pool.allow || {};
        if (!chars || !chars.length) {
          box.innerHTML = '<div class="xg-perm-row"><div class="xg-target-sub">角色档案里还没有联系人，去添加？</div></div>';
          return;
        }
        box.innerHTML = chars.map(function (c) {
          var on = !!pool.allow[c.id];
          var freq = pool.allow[c.id] || '偶尔';
          return '<div class="xg-perm-row">' +
            '<div class="xg-crest-frame"><img src="' + esc(c.avatar || (XG_IMG + 'icon-person.svg')) + '" alt=""></div>' +
            '<div class="xg-perm-main">' +
              '<div class="xg-perm-name">' + esc(c.name) + '</div>' +
              '<div class="xg-freq-tags">' +
                ['常来', '偶尔', '很少'].map(function (f) {
                  return '<button class="xg-chip' + (f === freq ? ' is-selected' : '') + '" data-xg-freq="' + f + '" data-xg-freq-id="' + esc(c.id) + '">' + f + '</button>';
                }).join('') +
              '</div>' +
            '</div>' +
            '<button class="xg-switch' + (on ? ' is-on' : '') + '" data-xg-perm-switch="' + esc(c.id) + '" aria-label="允许来信"></button>' +
          '</div>';
        }).join('');
      });
    }).catch(function (e) {
      console.warn('[xinge] S2 渲染失败', e);
      box.innerHTML = '<div class="xg-perm-row"><div class="xg-target-sub">读取失败</div></div>';
    });
  }

  /* S3 定时写信 */
  function renderTimer() {
    var html =
      topbar('定时写信', { dark: true }) +
      '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
        '<div class="xg-timer-hero">' +
          '<div><div class="xg-timer-hero-title">定时来信</div><div class="xg-timer-hero-sub">到点自动写，下次打开时寄达</div></div>' +
          '<button class="xg-switch xg-switch-lg" id="xg-schedule-switch" aria-label="定时开关"></button>' +
        '</div>' +
        '<div class="xg-group-card">' +
          '<div class="xg-timer-line"><div class="xg-timer-label">频率</div><div class="xg-freq-tags" id="xg-freq-pick">' +
            ['每天', '每周', '每月', '随机惊喜'].map(function (f) {
              return '<button class="xg-chip" data-xg-sfreq="' + f + '">' + f + '</button>';
            }).join('') +
          '</div></div>' +
          '<div class="xg-timer-line"><div class="xg-timer-label">时间</div><div class="xg-time-pick"><input class="xg-input" id="xg-time-hh" maxlength="2" value="21"> : <input class="xg-input" id="xg-time-mm" maxlength="2" value="00"></div></div>' +
          '<div class="xg-timer-line"><div class="xg-timer-label">写信人</div><div class="xg-freq-tags" id="xg-sender-pick">' +
            ['指定', '轮换', '随机'].map(function (m) {
              return '<button class="xg-chip" data-xg-sendermode="' + m + '">' + m + '</button>';
            }).join('') +
          '</div></div>' +
        '</div>' +
        '<div class="xg-next-strip" id="xg-next-strip"></div>' +
      '</div></div>';
    var el = openPage('xg-page-timer', html);
    el.classList.add('xg-settings-page');

    getConfig('xinge:settings', {}).then(function (s) {
      s = s || {};
      var sw = el.querySelector('#xg-schedule-switch');
      if (s.scheduleOn) sw.classList.add('is-on');
      var hh = el.querySelector('#xg-time-hh'), mm = el.querySelector('#xg-time-mm');
      if (s.timeHHMM) {
        var parts = String(s.timeHHMM).split(':');
        hh.value = parts[0] || '21';
        mm.value = parts[1] || '00';
      }
      el.querySelectorAll('[data-xg-sfreq]').forEach(function (c) {
        if (c.getAttribute('data-xg-sfreq') === (s.freq || '每周')) c.classList.add('is-selected');
      });
      el.querySelectorAll('[data-xg-sendermode]').forEach(function (c) {
        if (c.getAttribute('data-xg-sendermode') === (s.senderMode || '随机')) c.classList.add('is-selected');
      });
      updateNextStrip(el, s);
    });

    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var sw = e.target.closest('#xg-schedule-switch');
      if (sw) {
        getConfig('xinge:settings', {}).then(function (s) {
          s = s || {};
          s.scheduleOn = !sw.classList.contains('is-on');
          sw.classList.toggle('is-on', s.scheduleOn);
          return setConfig('xinge:settings', s);
        }).then(function () { return getConfig('xinge:settings', {}); }).then(function (s) { updateNextStrip(el, s || {}); });
        return;
      }
      var sfreq = e.target.closest('[data-xg-sfreq]');
      if (sfreq) {
        el.querySelectorAll('[data-xg-sfreq]').forEach(function (c) { c.classList.remove('is-selected'); });
        sfreq.classList.add('is-selected');
        saveTimerFields(el, { freq: sfreq.getAttribute('data-xg-sfreq') });
        return;
      }
      var smode = e.target.closest('[data-xg-sendermode]');
      if (smode) {
        el.querySelectorAll('[data-xg-sendermode]').forEach(function (c) { c.classList.remove('is-selected'); });
        smode.classList.add('is-selected');
        saveTimerFields(el, { senderMode: smode.getAttribute('data-xg-sendermode') });
      }
    });
    // 时间输入即时存
    ['xg-time-hh', 'xg-time-mm'].forEach(function (id) {
      var input = el.querySelector('#' + id);
      input.addEventListener('change', function () { saveTimerFields(el, {}); });
    });
  }

  function saveTimerFields(el, patchObj) {
    getConfig('xinge:settings', {}).then(function (s) {
      s = s || {};
      var hh = (el.querySelector('#xg-time-hh') || {}).value || '21';
      var mm = (el.querySelector('#xg-time-mm') || {}).value || '00';
      s.timeHHMM = hh.padStart(2, '0') + ':' + mm.padStart(2, '0');
      Object.assign(s, patchObj || {});
      return setConfig('xinge:settings', s);
    }).then(function () { return getConfig('xinge:settings', {}); }).then(function (s) { updateNextStrip(el, s || {}); });
  }

  function updateNextStrip(el, s) {
    var strip = el.querySelector('#xg-next-strip');
    if (!strip) return;
    if (!s.scheduleOn) {
      strip.textContent = '定时来信未开启';
      return;
    }
    var plan = nextSlotTs(s, nowTs());
    strip.textContent = '下一封：' + fmtTime(plan) + ' 前后寄达';
  }

  /* S5 阅读偏好 */
  function renderPrefs() {
    var prefs = [
      { key: 'speed',      label: '文字显现速度', opts: ['慢', '标准', '快'], def: '标准' },
      { key: 'readMode',   label: '已读信默认呈现', opts: ['直接全文', '重放动画'], def: '直接全文' },
      { key: 'strikeDefault', label: '划掉横线默认', opts: ['显示', '隐藏'], def: '显示' },
      { key: 'motionLevel', label: '动效档位', opts: ['全量', '简化'], def: '全量' }
    ];
    var html =
      topbar('阅读偏好', { dark: true }) +
      '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
        '<div class="xg-group-title">阅读</div>' +
        '<div class="xg-group-card">' +
          prefs.map(function (p) {
            return '<div class="xg-pref-row"><div class="xg-pref-label">' + p.label + '</div>' +
              '<div class="xg-segment" data-xg-pref="' + p.key + '">' +
                p.opts.map(function (o) {
                  return '<button class="xg-segment-item" data-xg-pref-opt="' + o + '">' + o + '</button>';
                }).join('') +
              '</div></div>';
          }).join('') +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-prefs', html);
    el.classList.add('xg-settings-page');
    getConfig('xinge:settings', {}).then(function (s) {
      s = s || {};
      prefs.forEach(function (p) {
        var cur = s[p.key] || p.def;
        el.querySelectorAll('[data-xg-pref="' + p.key + '"] [data-xg-pref-opt]').forEach(function (b) {
          if (b.getAttribute('data-xg-pref-opt') === cur) b.classList.add('is-selected');
        });
      });
    });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var opt = e.target.closest('[data-xg-pref-opt]');
      if (!opt) return;
      var group = opt.closest('[data-xg-pref]');
      var key = group.getAttribute('data-xg-pref');
      group.querySelectorAll('.xg-segment-item').forEach(function (b) { b.classList.remove('is-selected'); });
      opt.classList.add('is-selected');
      getConfig('xinge:settings', {}).then(function (s) {
        s = s || {};
        s[key] = opt.getAttribute('data-xg-pref-opt');
        if (key === 'motionLevel') {
          document.body.classList.toggle('xg-motion-low', s.motionLevel === '简化');
        }
        if (key === 'readMode') _readModePref = s[key];
        return setConfig('xinge:settings', s);
      });
    });
  }

  /* S6 通知 */
  function renderNotify() {
    var html =
      topbar('通知', { dark: true }) +
      '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
        '<div class="xg-group-title">提醒</div>' +
        '<div class="xg-group-card">' +
          '<div class="xg-quiet-row"><div class="xg-pref-label">新信提醒</div><button class="xg-switch" id="xg-notify-switch"></button></div>' +
          '<div class="xg-quiet-row"><div class="xg-pref-label">静默时段（不弹提醒）</div><div class="xg-time-pick"><input class="xg-input" id="xg-quiet-hh" maxlength="2" value="22"> : <input class="xg-input" id="xg-quiet-mm" maxlength="2" value="00"></div></div>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-notify', html);
    el.classList.add('xg-settings-page');
    getConfig('xinge:settings', {}).then(function (s) {
      s = s || {};
      if (s.notifyOn !== false) el.querySelector('#xg-notify-switch').classList.add('is-on');
      if (s.quietRange) {
        var p = String(s.quietRange).split(':');
        el.querySelector('#xg-quiet-hh').value = p[0] || '22';
        el.querySelector('#xg-quiet-mm').value = p[1] || '00';
      }
    });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      var sw = e.target.closest('#xg-notify-switch');
      if (sw) {
        getConfig('xinge:settings', {}).then(function (s) {
          s = s || {};
          s.notifyOn = !sw.classList.contains('is-on');
          sw.classList.toggle('is-on', s.notifyOn);
          return setConfig('xinge:settings', s);
        });
      }
    });
    el.querySelectorAll('#xg-quiet-hh, #xg-quiet-mm').forEach(function (input) {
      input.addEventListener('change', function () {
        getConfig('xinge:settings', {}).then(function (s) {
          s = s || {};
          s.quietRange = (el.querySelector('#xg-quiet-hh').value || '22') + ':' + (el.querySelector('#xg-quiet-mm').value || '00');
          s.quietOn = true;
          return setConfig('xinge:settings', s);
        });
      });
    });
  }

  /* S7 数据管理 */
  function renderData() {
    var html =
      topbar('数据管理', { dark: true }) +
      '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
        '<div class="xg-group-title">存储</div>' +
        '<div class="xg-group-card"><div class="xg-storage-block">' +
          '<div class="xg-storage-text" id="xg-storage-text">统计中…</div>' +
          '<div class="xg-storage-bar"><div class="xg-storage-fill" id="xg-storage-fill"></div></div>' +
        '</div></div>' +
        '<div class="xg-danger-block">' +
          '<button class="xg-btn xg-btn-danger xg-btn-full" data-xg-act="clear-all">清空信箱（不可恢复）</button>' +
        '</div>' +
      '</div></div>';
    var el = openPage('xg-page-data', html);
    el.classList.add('xg-settings-page');
    loadLetters().then(function (list) {
      var textEl = el.querySelector('#xg-storage-text');
      var fill = el.querySelector('#xg-storage-fill');
      var n = list.length;
      if (textEl) textEl.textContent = '信箱里有 ' + n + ' 封信';
      if (fill) fill.style.width = Math.min(100, n * 2) + '%';
    });
    el.addEventListener('click', function (e) {
      if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
      if (e.target.closest('[data-xg-act="clear-all"]')) {
        if (!window.confirm('清空信箱？所有信件将永久删除，无法恢复')) return;
        dbWrite(function () {
          if (hasLettersTable()) return window.db.xingeLetters.clear();
          return setConfig('xinge:lettersFallback', []);
        }).then(function () { toast('信箱已清空'); popPage(); renderData(); });
      }
    });
  }

  /* S4 关系提示词管理 */
  function renderPresetManager() {
    loadPresets().then(function (presets) {
      var html =
        topbar('关系提示词', { dark: true, right: '<button class="xg-topbar-back" data-xg-act="restore-default" style="width:auto;padding:0 8px;font-size:12px">恢复默认</button>' }) +
        '<div class="xg-settings-wrap"><div class="xg-content-fade">' +
          '<div class="xg-group-title">预设（' + presets.length + '）</div>' +
          '<div class="xg-preset-list">' +
            presets.map(function (p, i) {
              return '<div class="xg-preset-row" data-xg-edit-preset="' + i + '">' +
                '<div class="xg-preset-crest xg-crest"></div>' +
                '<div class="xg-preset-main">' +
                  '<div class="xg-preset-name">' + esc(p.name) + '</div>' +
                  '<div class="xg-preset-tone">' + esc(p.tone || '') + '</div>' +
                '</div>' +
                '<button class="xg-preset-edit">✎</button>' +
              '</div>';
            }).join('') +
          '</div>' +
          '<div class="xg-danger-block"><button class="xg-btn xg-btn-ghost xg-btn-full" data-xg-act="add-preset">新增预设</button></div>' +
        '</div></div>';
      var el = openPage('xg-page-presets', html);
      el.classList.add('xg-settings-page');
      el._presets = presets;
      el.addEventListener('click', function (e) {
        if (e.target.closest('[data-xg-act="back"]')) { clearTimers(); popPage(); return; }
        if (e.target.closest('[data-xg-act="restore-default"]')) {
          setConfig('xinge:presetsFallback', DEFAULT_PRESETS.slice()).then(function () {
            if (hasPresetsTable()) return dbWrite(function () { return window.db.xingePresets.clear(); }).then(function () { return ensureSeedPresets(); });
            return null;
          }).then(function () { toast('已恢复默认'); clearTimers(); popPage(); renderPresetManager(); });
          return;
        }
        if (e.target.closest('[data-xg-act="add-preset"]')) {
          openPresetEditor(el, null);
          return;
        }
        var row = e.target.closest('[data-xg-edit-preset]');
        if (row) openPresetEditor(el, presets[parseInt(row.getAttribute('data-xg-edit-preset'), 10)]);
      });
    });
  }

  function openPresetEditor(pageEl, preset) {
    var overlay = document.createElement('div');
    overlay.className = 'xg-modal-overlay';
    overlay.innerHTML =
      '<div class="xg-modal">' +
        '<div class="xg-modal-title">' + (preset ? '编辑预设' : '新增预设') + '</div>' +
        '<div class="xg-field"><div class="xg-field-label">名字</div><input class="xg-input" id="xg-pe-name" value="' + esc(preset ? preset.name : '') + '"></div>' +
        '<div class="xg-field"><div class="xg-field-label">口吻例句</div><input class="xg-input" id="xg-pe-tone" value="' + esc(preset ? (preset.tone || '') : '') + '"></div>' +
        '<div class="xg-field"><div class="xg-field-label">提示词</div><textarea class="xg-textarea" id="xg-pe-prompt">' + esc(preset ? (preset.prompt || '') : '') + '</textarea></div>' +
        '<div class="xg-field-chips" style="justify-content:flex-end">' +
          (preset ? '<button class="xg-btn xg-btn-danger" data-xg-pe="del">删除</button>' : '') +
          '<button class="xg-btn xg-btn-ghost" data-xg-pe="cancel">取消</button>' +
          '<button class="xg-btn xg-btn-primary" data-xg-pe="save">保存</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.classList.add('is-on'); });
    function close() {
      overlay.classList.remove('is-on');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 260);
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) { close(); return; }
      var act = e.target.closest('[data-xg-pe]');
      if (!act) return;
      var kind = act.getAttribute('data-xg-pe');
      if (kind === 'cancel') { close(); return; }
      if (kind === 'del') {
        if (!window.confirm('删除这个预设？')) return;
        loadPresets().then(function (list) {
          var next = list.filter(function (x) { return (x.key || x.id) !== (preset.key || preset.id); });
          return setConfig('xinge:presetsFallback', next);
        }).then(function () { close(); toast('已删除'); clearTimers(); popPage(); renderPresetManager(); });
        return;
      }
      if (kind === 'save') {
        var name = overlay.querySelector('#xg-pe-name').value.trim();
        if (!name) { toast('名字要填'); return; }
        loadPresets().then(function (list) {
          list = list || [];
          if (preset) {
            list.forEach(function (x) {
              if ((x.key || x.id) === (preset.key || preset.id)) {
                x.name = name;
                x.tone = overlay.querySelector('#xg-pe-tone').value.trim();
                x.prompt = overlay.querySelector('#xg-pe-prompt').value.trim();
              }
            });
          } else {
            list.push({
              key: 'custom_' + Date.now(),
              name: name,
              tone: overlay.querySelector('#xg-pe-tone').value.trim(),
              prompt: overlay.querySelector('#xg-pe-prompt').value.trim(),
              icon: 'icon-heart'
            });
          }
          return setConfig('xinge:presetsFallback', list);
        }).then(function () { close(); toast('已保存'); clearTimers(); popPage(); renderPresetManager(); });
      }
    });
  }

  /* ===== 6.13 定时补信（打开 App 补生成，主人拍板方案 a） ===== */
  function nextSlotTs(s, fromTs) {
    // 从 fromTs 起算下一个计划寄达点（时:分 落在今天/未来）
    var base = new Date(fromTs);
    var parts = String(s.timeHHMM || '21:00').split(':');
    var h = parseInt(parts[0], 10) || 21;
    var m = parseInt(parts[1], 10) || 0;
    var slot = new Date(base);
    slot.setHours(h, m, 0, 0);
    if (slot.getTime() <= fromTs) slot.setDate(slot.getDate() + 1);
    return slot.getTime();
  }

  function checkSchedule() {
    if (!hasLettersTable() && !window.db) return Promise.resolve();
    return getConfig('xinge:settings', {}).then(function (s) {
      if (!s || !s.scheduleOn) return null;
      return getConfig('xinge:lastRun', {}).then(function (last) {
        var now = nowTs();
        var periodDays = s.freq === '每天' ? 1 : s.freq === '每月' ? 30 : s.freq === '随机惊喜' ? 3 : 7;
        var lastPlan = (last && last.scheduledFor) || 0;
        var due = lastPlan ? (lastPlan + periodDays * 86400000) : nextSlotTs(s, now - periodDays * 86400000);
        if (now < due) return null;
        // 补生成（静默：不弹页面）
        return getConfig('xinge:pool', { allow: {} }).then(function (pool) {
          return pickScheduledSender(s, pool).then(function (sender) {
            return generateScheduledLetter(s, sender, due).then(function () {
              return setConfig('xinge:lastRun', { ts: now, scheduledFor: due });
            });
          });
        });
      });
    }).catch(function (e) {
      console.warn('[xinge] 定时补信检查失败', e);
    });
  }

  function pickScheduledSender(s, pool) {
    // senderMode: 指定 / 轮换 / 随机；从允许池出
    return loadPresets().then(function (presets) {
      var allowIds = Object.keys((pool && pool.allow) || {});
      var presetList = presets && presets.length ? presets : DEFAULT_PRESETS;
      var pick = null;
      if (s.senderMode === '指定' && s.senderId) {
        presetList.forEach(function (p) { if ((p.key || String(p.id)) === s.senderId) pick = p; });
      }
      if (!pick) {
        // 轮换：按已发封数取模；随机：random
        if (s.senderMode === '轮换') {
          pick = presetList[(s._rotateIndex || 0) % presetList.length];
        } else {
          pick = presetList[Math.floor(Math.random() * presetList.length)];
        }
      }
      return { preset: pick, allowIds: allowIds };
    });
  }

  function generateScheduledLetter(s, sender, planTs) {
    // 静默生成：不 nav.composing、不跳页，只落库+提醒
    var draft = {
      recipientType: 'me',
      toName: '我',
      presetKey: sender.preset && (sender.preset.key || String(sender.preset.id)),
      mood: 50,
      tendency: '按最近的记忆写一封定时来信',
      scheduledAt: planTs
    };
    var memPromise;
    try {
      memPromise = (window.WanWanMemory && window.WanWanMemory.getMemoryContext)
        ? window.WanWanMemory.getMemoryContext(null, sender.allowIds[0] || null, window._wechatUid || '', ['定时来信']).catch(function () { return ''; })
        : Promise.resolve('');
    } catch (e) { memPromise = Promise.resolve(''); }

    return memPromise.then(function (memCtx) {
      return loadPresets().then(function (presets) {
        if (!window.callAI) throw new Error('callAI 未加载');
        var prompt = buildUserPrompt(draft, memCtx, presets);
        return window.callAI([{ role: 'user', content: prompt }], { system: XG_SYS_BASE });
      });
    }).then(function (result) {
      if (!result) return null;
      var text = (typeof result === 'string') ? result : (result.content || result.text || result.message || '');
      var parsed = parseLetterJSON(text);
      if (!parsed) throw new Error('定时信 JSON 解析失败');
      return saveLetter({
        senderKey: draft.presetKey || 'friend',
        recipientType: 'me',
        charId: sender.allowIds[0] || null,
        status: 'done',
        scheduledAt: planTs,
        papers: parsed.papers,
        envelopeNote: parsed.envelopeNote || '',
        params: { toName: '我', presetKey: draft.presetKey, mood: 50, tendency: draft.tendency, mention: '' }
      });
    }).then(function (saved) {
      if (saved) {
        // 静默时段外才提醒（S6）
        if (s.notifyOn !== false) toast('有一封新的信到了');
      }
      return saved;
    });
  }

  /* ===== 7. 导出面 & 入口 ===== */
  Xinge = window.Xinge = {
    ver: XG_VER,
    nav: {
      write: renderWrite,
      inbox: renderInbox,
      sender: renderSender,
      recipient: renderRecipient,
      target: renderTarget,
      age: renderAge,
      custom: renderCustom,
      preset: renderPreset,
      composing: renderComposing,
      envelope: renderEnvelope,
      fan: renderFan,
      reading: renderReading,
      recall: renderRecall,
      settings: function () { if (typeof renderSettings === 'function') renderSettings(); else toast('设置页马上就位'); },
      timer: function () { if (typeof renderTimer === 'function') renderTimer(); else toast('设置页马上就位'); },
      presetManager: function () { if (typeof renderPresetManager === 'function') renderPresetManager(); else toast('设置页马上就位'); }
    },
    compose: {
      run: runCompose,
      fail: function (err) {
        _inFlight = null;
        var el = document.getElementById('xg-page-composing');
        if (!el) return;
        if (Xinge.ui && Xinge.ui.showComposeFail) {
          Xinge.ui.showComposeFail(el, err || new Error('生成失败'), function () {
            if (_lastDraft) { clearTimers(); runCompose(_lastDraft); }
            else popPage();
          });
        } else {
          el.classList.add('is-error');
          var cap = el.querySelector('#xg-caption');
          if (cap) cap.textContent = '墨水洒了……返回后重来一次';
        }
      },
      skipToResult: function () {
        clearTimers();
        if (!_inFlight) {
          loadLetters().then(function (list) {
            Xinge.nav.envelope(list[0] && list[0].id);
          });
        } else {
          var el = document.getElementById('xg-page-composing');
          var cap = el && el.querySelector('#xg-caption');
          if (cap) { cap.textContent = '马上就好…'; cap.classList.remove('xg-typing'); }
          var prog = el && el.querySelector('#xg-progress');
          if (prog) prog.style.width = '95%';
        }
      },
      get inFlight() { return !!_inFlight; }
    },
    data: {
      loadLetters: loadLetters,
      saveLetter: saveLetter,
      deleteLetter: deleteLetter,
      markRead: markRead,
      toggleFavorite: toggleFavorite,
      loadPresets: loadPresets,
      ensureSeedPresets: ensureSeedPresets,
      getConfig: getConfig,
      setConfig: setConfig,
      DEFAULT_PRESETS: DEFAULT_PRESETS
    },
    util: {
      nowTs: nowTs, nowReal: nowReal, fmtTime: fmtTime, dayString: dayString,
      daysSinceChat: daysSinceChat, toast: toast, esc: esc,
      later: later, every: every, clearTimers: clearTimers,
      openPage: openPage, popPage: popPage, topbar: topbar,
      attachLongPress: attachLongPress
    },
    ui: { renderInbox: renderInbox, renderWrite: renderWrite }
  };

  // 入口首行铁律
  window.showXingePage = function () {
    // 重入清栈（桌面临布点开不叠页）
    while (_stack.length) {
      var old = document.getElementById(_stack.pop());
      if (old) old.remove();
    }
    Xinge.data.ensureSeedPresets().then(function () {
      renderInbox();
    }).catch(function (e) {
      console.error('[xinge] 入口失败', e);
      renderInbox(); // 兜底也要进页
    });
    // 定时补信检查（静默，不阻塞进页；方案 a：打开 App 补生成）
    checkSchedule();
    // S5 偏好缓存初始化
    getConfig('xinge:settings', {}).then(function (s) {
      if (s && s.readMode) _readModePref = s.readMode;
      if (s && s.motionLevel === '简化') document.body.classList.add('xg-motion-low');
    });
  };

  console.log('[xinge] xinge.js ' + XG_VER + ' 就绪');
})();
