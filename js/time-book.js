/**
 * time-book.js — 《拾光》绘本手账风五章 App v1.0
 * 按 time-book-spec.md 施工（图纸唯一依据，类名前缀 tb-）
 * ============================================================
 * 文件：总页面（封面+目录）+五章分页全交互。样式 css/time-book.css。
 * 五章：时间工具间/时光传记/记忆穿越/未来信/世界线徽章
 * 依赖：time.js (TimeWorld)、db.js、callAI（传记生成）
 * 铁律：退出只回上层（合书回目录）；时间一律 TimeWorld；类名 tb- 前缀
 */
window.showTimeBook = async function () {          // 入口函数铁律（第一行）
  'use strict';
  if (document.getElementById('tb-root')) return;
  if (window.TimeBook && typeof window.TimeBook.open === 'function') { window.TimeBook.open(); return; }
  if (window.toast) window.toast('拾光未就绪，请刷新重试');
};

(function () {
  'use strict';

  var TW = null;
  var _currentPage = 'cover';   // cover | ch1..ch5

  /* ================= 工具 ================= */
  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function _p2(n) { return (n < 10 ? '0' : '') + n; }

  function _fmtClock(ts) {
    var d = new Date(ts);
    return _p2(d.getHours()) + ':' + _p2(d.getMinutes()) + ':' + _p2(d.getSeconds());
  }

  function _toast(msg) {
    if (window.toast) window.toast(msg);
    else console.log('[TimeBook] ' + msg);
  }

  /* 就绪守卫（P1-3 同款） */
  function _guard() {
    TW = TW || window.TimeWorld;
    if (!TW || typeof TW.getNow !== 'function') {
      _toast('时间引擎未就绪，请刷新重试');
      return false;
    }
    return true;
  }

  /* ================= 总页面（封面+目录） ================= */
  function _renderCover(root) {
    var cover = _el('div', 'tb-cover');

    /* 封面区：皮革底+烫金标题+缎带+火漆角 */
    var hero = _el('div', 'tb-hero');
    hero.appendChild(_el('div', 'tb-hero-leather'));
    hero.appendChild(_el('div', 'tb-hero-title', '拾光'));
    hero.appendChild(_el('div', 'tb-hero-ribbon'));
    hero.appendChild(_el('div', 'tb-hero-wax'));
    /* 世界线徽章位（§5 全局徽章） */
    var badge = _el('div', 'tb-worldline-badge');
    badge.id = 'tb-worldline-badge';
    _updateBadge(badge);
    hero.appendChild(badge);
    cover.appendChild(hero);

    /* 扉页题词 */
    var title = _el('div', 'tb-dedication');
    var bigClock = _el('div', 'tb-dedication-clock', _fmtClock(TW.getNow()));
    title.appendChild(bigClock);
    var vToday = _el('div', 'tb-dedication-today', '虚拟今天 ' + TW.getDayString());
    title.appendChild(vToday);
    title.appendChild(_el('div', 'tb-dedication-hand', '欢迎回到你的时间'));
    cover.appendChild(title);
    /* 跳秒 */
    var tick = setInterval(function () {
      if (document.hidden) return;
      bigClock.textContent = _fmtClock(TW.getNow());
      vToday.textContent = (TW.isEnabled() ? '虚拟今天 ' : '今天 ') + TW.getDayString();
      _updateBadge(badge);
    }, 1000);
    root._tick = tick;   /* 挂 book 上：翻页/关书才清得掉（原 cover._tick 清不到=时钟泄漏） */

    /* 目录区：五章节 */
    var toc = _el('div', 'tb-toc');
    [
      ['ch1', '第一章', '时间工具间', '怀表', '#7a9e7e'],
      ['ch2', '第二章', '时光传记', '钢笔', '#8b2635'],
      ['ch3', '第三章', '记忆穿越', '拍立得', '#3d5a80'],
      ['ch4', '第四章', '未来信', '信封', '#c9884e'],
      ['ch5', '第五章', '倒计时驿站', '沙漏', '#6b5b95']
    ].forEach(function (ch, i) {
      var row = _el('div', 'tb-toc-row');
      row.style.setProperty('--tb-tape-color', ch[4]);
      row.style.setProperty('--tb-tape-rotate', ((i % 2 ? 1 : -1) * (1 + (i * 0.3))) + 'deg');
      var tocIcon = _el('div', 'tb-toc-icon tb-icon-' + ch[0], '');
      tocIcon.appendChild(_el('div', 'tb-icon-face', ''));
      row.appendChild(tocIcon);
      var mid = _el('div', 'tb-toc-mid');
      mid.appendChild(_el('div', 'tb-toc-chapter', ch[1]));
      mid.appendChild(_el('div', 'tb-toc-name', ch[2]));
      row.appendChild(mid);
      row.appendChild(_el('div', 'tb-toc-dots', ''));
      row.appendChild(_el('div', 'tb-toc-page', '第 ' + (i + 1) + ' 页'));
      row.addEventListener('click', function () { _flipTo(ch[0]); });
      toc.appendChild(row);
    });
    cover.appendChild(toc);
    return cover;
  }

  /* 世界线徽章更新（§5） */
  function _updateBadge(badge) {
    if (!badge) return;
    if (TW.isEnabled()) {
      var d = new Date(TW.getNow());
      badge.textContent = '虚拟 ' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
      badge.classList.add('tb-badge-on');
    } else {
      badge.textContent = '现实世界';
      badge.classList.remove('tb-badge-on');
    }
  }

  /* ================= 翻页路由（3D 翻页） ================= */
  var _flipLock = false;   /* 边界4：翻页防抖（大会互查） */
  function _flipTo(page) {
    var root = document.getElementById('tb-root');
    if (!root) return;
    var book = root.querySelector('.tb-book');
    if (!book) return;
    if (_flipLock) return;   /* 翻页动画中连点忽略 */
    _flipLock = true;
    book.classList.add('tb-flipping');
    setTimeout(function () {
      _currentPage = page;
      /* ✕退出整个软件只留主界面（主人令：章节页不许出现整软件叉叉，防误触） */
      var _closeEl = root.querySelector('.tb-close');
      if (_closeEl) _closeEl.style.display = (page === 'cover') ? '' : 'none';
      /* Codex查bug#1#3：翻页先清封面时钟+打字机timer，防泄漏/幽灵写DOM */
      if (book._tick) { clearInterval(book._tick); book._tick = null; }
      if (window._tbTypeTimer) { clearInterval(window._tbTypeTimer); window._tbTypeTimer = null; }
      book.innerHTML = '';
      if (page === 'cover') {
        if (book._tick) clearInterval(book._tick);
        book.appendChild(_renderCover(book));
      } else {
        var fn = _renderPage[page];
        if (fn) book.appendChild(fn(book));
        else book.appendChild(_el('div', 'tb-page-empty', '章节建设中'));
      }
      book.classList.remove('tb-flipping');
      book.classList.add('tb-flipped');
      setTimeout(function () { book.classList.remove('tb-flipped'); _flipLock = false; }, 300);
    }, 150);
  }

  /* 合书回目录（退出铁律：只回上层） */
  function _closeToCover() {
    if (_currentPage === 'cover') {
      _closeBook();
    } else {
      _flipTo('cover');
    }
  }

  function _closeBook() {
    var root = document.getElementById('tb-root');
    if (!root) return;
    root.classList.add('tb-closing');
    setTimeout(function () {
      if (root._tick) clearInterval(root._tick);
      var bk = root.querySelector('.tb-book');
      if (bk && bk._tick) clearInterval(bk._tick);
      root.remove();
    }, 300);
  }

  /* ================= 五章分页渲染器（分件实现） ================= */
  var _renderPage = {
    /* ch1-ch5 各章渲染函数在后续段落定义 */
    ch1: function () {
      return _chapterShell('ch1', '第一章 · 时间工具间', function (body) {
        if (window._tbCh1) window._tbCh1(body);
        else body.appendChild(_el('div', 'tb-page-empty', '章节模块加载中'));
      });
    },
    ch2: function () {
      return _chapterShell('ch2', '第二章 · 时光传记', function (body) {
        if (window._tbCh2) window._tbCh2(body);
        else body.appendChild(_el('div', 'tb-page-empty', '章节模块加载中'));
      });
    },
    ch3: function () {
      return _chapterShell('ch3', '第三章 · 记忆穿越', function (body) {
        if (window._tbCh3) window._tbCh3(body);
        else body.appendChild(_el('div', 'tb-page-empty', '章节模块加载中'));
      });
    },
    ch4: function () {
      return _chapterShell('ch4', '第四章 · 未来信', function (body) {
        if (window._tbCh4) window._tbCh4(body);
        else body.appendChild(_el('div', 'tb-page-empty', '章节模块加载中'));
      });
    },
    ch5: function () {
      return _chapterShell('ch5', '第五章 · 倒计时驿站 · 年龄时钟', function (body) {
        if (window._tbCh5) window._tbCh5(body);
        else body.appendChild(_el('div', 'tb-page-empty', '章节模块加载中'));
      });
    }
  };

  /* 每章公共壳：标题栏（返回=合书回目录） */
  function _chapterShell(id, titleText, bodyBuilder) {
    var page = _el('div', 'tb-page tb-page-' + id);
    var head = _el('div', 'tb-page-head');
    var back = _el('button', 'tb-page-back', '‹');
    back.addEventListener('click', _closeToCover);
    head.appendChild(back);
    head.appendChild(_el('div', 'tb-page-title', titleText));
    head.appendChild(_el('div', 'tb-page-spacer'));
    page.appendChild(head);
    var body = _el('div', 'tb-page-body');
    bodyBuilder(body);
    page.appendChild(body);
    return page;
  }

  /* ================= 主入口 ================= */
  function _openBook() {
    if (!_guard()) return;
    var root = _el('div', 'tb-root');
    root.id = 'tb-root';
    var book = _el('div', 'tb-book');
    book.appendChild(_renderCover(book));
    root.appendChild(book);
    var closeBtn = _el('button', 'tb-close', '');
    closeBtn.setAttribute('aria-label', '关闭');
    /* Codex查bug#2：统一走 _closeBook，timer 才清得干净 */
    closeBtn.addEventListener('click', function (e) { e.stopPropagation(); _closeBook(); });
    root.appendChild(closeBtn);
    /* 铁律防误触：点空白一律不退出、不回目录（只留 ‹ 返回与 ✕ 关闭） */
    root.addEventListener('click', function (e) {
      e.stopPropagation();
    });
    document.body.appendChild(root);
    requestAnimationFrame(function () { root.classList.add('open'); });
  }

  /* ================= 导出 ================= */
  window.TimeBook = {
    open: _openBook,
    close: _closeBook,
    flipTo: _flipTo,
    chapterShell: _chapterShell
    /* 各章 builder 后续段落挂载 */
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { TW = window.TimeWorld; }, 500); });
  } else {
    setTimeout(function () { TW = window.TimeWorld; }, 500);
  }
})();

/* ================= §1 第一章 · 时间工具间（手账风壳·逻辑复用七分区） ================= */
(function () {
  'use strict';
  var TW = null;

  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function _p2(n) { return (n < 10 ? '0' : '') + n; }
  function _fmtClock(ts) { var d = new Date(ts); return _p2(d.getHours()) + ':' + _p2(d.getMinutes()) + ':' + _p2(d.getSeconds()); }
  function _toast(msg) { if (window.toast) window.toast(msg); }

  /* 撕页日历（§1：撕页动画选日期） */
  function _tearCalendar(onPick) {
    var wrap = _el('div', 'tb-cal');
    var cursor = new Date(window.TimeWorld.getNow());
    function render() {
      wrap.innerHTML = '';
      var head = _el('div', 'tb-cal-head');
      var prev = _el('button', 'tb-cal-nav', '‹');
      var title = _el('div', 'tb-cal-title', cursor.getFullYear() + '年' + (cursor.getMonth() + 1) + '月');
      /* 点顶部日期=快速选择（主人令：不许一页一页翻） */
      title.addEventListener('click', function () {
        if (!window._tbQuickJump) return;
        window._tbQuickJump(cursor, function (y, m) {
          cursor = new Date(y, m - 1, 1);
          render();
        });
      });
      var next = _el('button', 'tb-cal-nav', '›');
      head.appendChild(prev); head.appendChild(title); head.appendChild(next);
      wrap.appendChild(head);
      var grid = _el('div', 'tb-cal-grid');
      ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w) { grid.appendChild(_el('div', 'tb-cal-week', w)); });
      var startDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
      var days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      var today = new Date(window.TimeWorld.getNow());
      for (var i = 0; i < startDow; i++) grid.appendChild(_el('div', 'tb-cal-day tb-cal-blank', ''));
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var cell = _el('div', 'tb-cal-day', String(day));
          if (today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === day) {
            cell.classList.add('tb-cal-today');
          }
          cell.addEventListener('click', function () {
            cell.classList.add('tb-cal-torn');   // 撕页动画
            var pickTs = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0).getTime();   // 点击瞬间快照（防200ms内翻月跳错）
            setTimeout(function () {
              onPick(pickTs);
              render();   // 撕页后重建日历（防格子永久消失）
            }, 200);
          });
          grid.appendChild(cell);
        })(d);
      }
      wrap.appendChild(grid);
      prev.addEventListener('click', function () { cursor.setDate(1); cursor.setMonth(cursor.getMonth() - 1); render(); });
      next.addEventListener('click', function () { cursor.setDate(1); cursor.setMonth(cursor.getMonth() + 1); render(); });
    }
    render();
    return wrap;
  }

  /* 怀表表冠 stepper（§1：圆形表冠±，长按连拨） */
  function _crownStepper(label, stepMs, onChange) {
    var g = _el('div', 'tb-crown-group');
    var minus = _el('button', 'tb-crown', '−');
    var val = _el('div', 'tb-crown-label', label);
    var plus = _el('button', 'tb-crown', '+');
    g.appendChild(minus); g.appendChild(val); g.appendChild(plus);
    var holdT = null, repT = null;
    function start(dir) {
      if (holdT || repT) return;
      onChange(dir * stepMs);
      holdT = setTimeout(function () {
        repT = setInterval(function () { onChange(dir * stepMs); }, 120);
      }, 500);
    }
    function stop() { clearTimeout(holdT); clearInterval(repT); holdT = repT = null; }
    minus.addEventListener('mousedown', function () { start(-1); });
    plus.addEventListener('mousedown', function () { start(1); });
    minus.addEventListener('touchstart', function () { start(-1); }, { passive: true });
    plus.addEventListener('touchstart', function () { start(1); }, { passive: true });
    ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) {
      minus.addEventListener(ev, stop); plus.addEventListener(ev, stop);
    });
    return g;
  }

  /* 收音机旋钮流速（§1：四档刻度灯） */
  function _radioDial(current, onPick) {
    var dial = _el('div', 'tb-radio');
    [[1, '1x'], [2, '2x'], [10, '10x'], [0, '⏸']].forEach(function (sp) {
      var b = _el('button', 'tb-radio-notch' + (current === sp[0] ? ' tb-radio-on' : ''), sp[1]);
      b.addEventListener('click', function () {
        onPick(sp[0]);
        dial.querySelectorAll('.tb-radio-notch').forEach(function (x) { x.classList.remove('tb-radio-on'); });
        b.classList.add('tb-radio-on');
      });
      dial.appendChild(b);
    });
    return dial;
  }

  /* §1 主体 */
  function buildCh1(body) {
    TW = window.TimeWorld;

    /* 黄铜拨杆总开关 */
    var swCard = _el('div', 'tb-card');
    swCard.appendChild(_el('div', 'tb-card-title', '虚拟时间总开关'));
    var swRow = _el('div', 'tb-switch-row');
    swRow.appendChild(_el('div', 'tb-switch-label', TW.isEnabled() ? '世界已换钟' : '现实时间'));
    var lever = _el('button', 'tb-brass-lever' + (TW.isEnabled() ? ' tb-lever-on' : ''));
    lever.addEventListener('click', function () {
      var next = !TW.isEnabled();
      TW.setEnabled(next);
      lever.classList.toggle('tb-lever-on', next);
      swRow.querySelector('.tb-switch-label').textContent = next ? '世界已换钟' : '现实时间';
      _toast(next ? '虚拟时间已开启' : '虚拟时间已关闭');
    });
    swRow.appendChild(lever);
    swCard.appendChild(swRow);
    body.appendChild(swCard);

    /* 撕页日历跳转 */
    var calCard = _el('div', 'tb-card');
    calCard.appendChild(_el('div', 'tb-card-title', '撕页日历 · 跳转'));
    calCard.appendChild(_tearCalendar(function (ts) {
      if (!TW.isEnabled()) { _toast('请先开启虚拟时间，才能跳转'); return; }
      TW.addOffset(ts - TW.getNow());
      _toast('已跳到 ' + TW.getFormattedNow());
    }));
    body.appendChild(calCard);

    /* 表冠精确调整 */
    var adjCard = _el('div', 'tb-card');
    adjCard.appendChild(_el('div', 'tb-card-title', '怀表表冠 · 精确调整'));
    var crowns = _el('div', 'tb-crowns');
    crowns.appendChild(_crownStepper('时', 3600000, function (ms) { TW.addOffset(ms); }));
    crowns.appendChild(_crownStepper('分', 60000, function (ms) { TW.addOffset(ms); }));
    crowns.appendChild(_crownStepper('秒', 1000, function (ms) { TW.addOffset(ms); }));
    adjCard.appendChild(crowns);
    body.appendChild(adjCard);

    /* 收音机旋钮流速 */
    var speedCard = _el('div', 'tb-card');
    speedCard.appendChild(_el('div', 'tb-card-title', '时间流速'));
    speedCard.appendChild(_radioDial(TW.getSpeed(), function (s) {
      TW.setSpeed(s);
      _toast('流速 ' + (s === 0 ? '暂停' : s + 'x'));
    }));
    body.appendChild(speedCard);

    /* 罗盘·回到现在 */
    var compass = _el('button', 'tb-compass', '回到现在');
    compass.addEventListener('click', function () {
      TW.reset();
      _toast('已回到现实时间');
    });
    body.appendChild(compass);

    /* 火漆·重置全部 */
    var resetBtn = _el('button', 'tb-wax-btn', '重置全部设置');
    resetBtn.addEventListener('click', function () {
      TW.setEnabled(false); TW.setSpeed(1); TW.reset(); TW.clearAudit();
      _toast('已全部重置');
    });
    body.appendChild(resetBtn);
  }

  /* 挂载到主文件的 _renderPage */
  if (window.TimeBook) {
    window.TimeBook._renderPage = window.TimeBook._renderPage || {};
  }
  window._tbCh1 = buildCh1;
})();

/* ================= §2 第二章 · 时光传记（生成器） ================= */
(function () {
  'use strict';

  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  var _form = { char: null, year: null, age: null, theme: null, words: null, style: null };
  var THEMES = ['事业', '爱情', '成长', '冒险', '旅行', '日常'];
  var WORDS = [['800-2000', 800], ['2000-4000', 2000], ['4000-8000', 4000]];
  var STYLES = [['温暖奶茶', '#d4a574'], ['诗意墨蓝', '#3d5a80'], ['幽默柠檬', '#e8b84b'], ['清冷月白', '#a8b8c8']];

  /* 拍立得照片墙·选人 */
  function _photoWall(onPick) {
    var wall = _el('div', 'tb-photos');
    var chars = [];
    try { chars = (window.db && window.db.characters) ? [] : []; } catch (e) {}
    /* 取角色列表（db.characters 或全局） */
    (async function () {
      try {
        if (window.db && window.db.characters) chars = await window.db.characters.toArray();
        else if (window._characters) chars = window._characters;
      } catch (e) {}
      if (!chars.length) {
        wall.appendChild(_el('div', 'tb-empty-hint', '角色档案还是空的'));
        return;
      }
      chars.forEach(function (ch, i) {
        var card = _el('div', 'tb-polaroid');
        card.style.setProperty('--tb-rotate', ((i % 2 ? 1 : -1) * 2) + 'deg');
        var img = _el('div', 'tb-polaroid-img');
        if (ch.avatar) { img.style.backgroundImage = 'url(' + ch.avatar + ')'; img.style.backgroundSize = 'contain'; img.style.backgroundRepeat = 'no-repeat'; img.style.backgroundPosition = 'center'; }
        card.appendChild(img);
        card.appendChild(_el('div', 'tb-polaroid-name', ch.name || '角色' + (i + 1)));
        card.addEventListener('click', function () {
          wall.querySelectorAll('.tb-polaroid').forEach(function (x) { x.classList.remove('tb-picked'); });
          card.classList.add('tb-picked');
          _form.char = ch;
          onPick(ch);
        });
        wall.appendChild(card);
      });
    })();
    return wall;
  }

  /* 撕页车票·选时间/年龄 */
  function _ticketForm(onChange) {
    var ticket = _el('div', 'tb-ticket');
    ticket.appendChild(_el('div', 'tb-ticket-title', '开往'));
    var yearInput = _el('input', 'tb-ticket-year');
    yearInput.type = 'number'; yearInput.placeholder = '2030';
    yearInput.min = '2024'; yearInput.max = '2124';
    ticket.appendChild(yearInput);
    ticket.appendChild(_el('div', 'tb-ticket-unit', '年'));
    var ageInput = _el('input', 'tb-ticket-age');
    ageInput.type = 'number'; ageInput.placeholder = '年龄 10-100';
    ageInput.min = '10'; ageInput.max = '100';
    ticket.appendChild(ageInput);
    ticket.appendChild(_el('div', 'tb-ticket-punch', ''));
    function sync() {
      _form.year = parseInt(yearInput.value, 10) || null;
      _form.age = parseInt(ageInput.value, 10) || null;
      onChange(_form);
    }
    /* readonly：绝不弹系统数字键盘（键盘弹出会把版面挤没 = 模块'消失'） */
    yearInput.readOnly = true;
    ageInput.readOnly = true;
    /* 滚轮选时间（点输入弹居中大拨盘，选完只填值） */
    yearInput.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      _openWheelPicker('选年份', _wheelRange(2024, 2124, parseInt(yearInput.value, 10) || 2030), function (v) { yearInput.value = v; sync(); });
    });
    ageInput.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      _openWheelPicker('选年龄', _wheelRange(10, 100, parseInt(ageInput.value, 10) || 30), function (v) { ageInput.value = v; sync(); });
    });
    return ticket;
  }

  /* 内置滚轮拨盘（居中弹出、点选高亮、确定只填值——不弹键盘、不动页面、不退出） */
  function _wheelRange(lo, hi, cur) {
    var list = [];
    for (var v = lo; v <= hi; v++) list.push(v);
    return { list: list, cur: cur };
  }
  function _closePicker(mask) {
    mask.classList.remove('open');
    setTimeout(function () { if (mask && mask.remove) mask.remove(); }, 220);
  }
  function _openWheelPicker(title, range, onPick) {
    /* 防重复弹出：旧拨盘先清掉 */
    try {
      var stale = document.querySelectorAll('.tb-dialog-mask');
      stale.forEach(function (s) { s.remove(); });
    } catch (e) {}
    var mask = _el('div', 'tb-dialog-mask');
    /* 全链路掐断冒泡：点拨盘绝不会触到 tb-root 的任何全局点击（防'点了就退出'） */
    mask.addEventListener('click', function (e) { e.stopPropagation(); });
    var dlg = _el('div', 'tb-dialog tb-wheel-dlg');
    dlg.addEventListener('click', function (e) { e.stopPropagation(); });
    dlg.appendChild(_el('div', 'tb-dialog-title', title));
    var scroll = _el('div', 'tb-dialog-scroll tb-wheel');
    var curVal = range.cur;
    (range.list || []).forEach(function (v) {
      var item = _el('button', 'tb-wheel-item' + (v === range.cur ? ' tb-wheel-cur' : ''), String(v));
      item.addEventListener('click', function (e) {
        e.stopPropagation();
        scroll.querySelectorAll('.tb-wheel-item').forEach(function (x) { x.classList.remove('tb-wheel-cur'); });
        item.classList.add('tb-wheel-cur');
        curVal = v;
      });
      scroll.appendChild(item);
    });
    dlg.appendChild(scroll);
    var btns = _el('div', 'tb-dialog-btns');
    var cancel = _el('button', 'tb-dialog-cancel', '取消');
    cancel.addEventListener('click', function (e) { e.stopPropagation(); _closePicker(mask); });
    var ok = _el('button', 'tb-dialog-ok', '确定');
    ok.addEventListener('click', function (e) {
      e.stopPropagation();
      try { onPick(curVal); } catch (err) {}
      _closePicker(mask);
    });
    btns.appendChild(cancel);
    btns.appendChild(ok);
    dlg.appendChild(btns);
    mask.appendChild(dlg);
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('open'); });
    /* 居中当前项：只改容器自身 scrollTop——禁用 scrollIntoView（会连带滚动整个视口） */
    try {
      var curItem = scroll.querySelector('.tb-wheel-cur');
      if (curItem) scroll.scrollTop = curItem.offsetTop - scroll.clientHeight / 2 + curItem.offsetHeight / 2;
    } catch (e) {}
  }

  /* 邮票贴纸墙·选主题 */
  function _stampWall(onPick) {
    var wall = _el('div', 'tb-stamps');
    THEMES.forEach(function (t) {
      var stamp = _el('button', 'tb-stamp', t);
      stamp.addEventListener('click', function () {
        wall.querySelectorAll('.tb-stamp').forEach(function (x) { x.classList.remove('tb-stamp-picked'); });
        stamp.classList.add('tb-stamp-picked');
        _form.theme = t;
        onPick(t);
      });
      wall.appendChild(stamp);
    });
    return wall;
  }

  /* 文具尺滑块·选字数 */
  function _rulerSlider(onPick) {
    var wrap = _el('div', 'tb-ruler');
    WORDS.forEach(function (w) {
      var notch = _el('button', 'tb-ruler-notch', w[0]);
      notch.addEventListener('click', function () {
        wrap.querySelectorAll('.tb-ruler-notch').forEach(function (x) { x.classList.remove('tb-ruler-on'); });
        notch.classList.add('tb-ruler-on');
        _form.words = w;
        onPick(w);
      });
      wrap.appendChild(notch);
    });
    return wrap;
  }

  /* 墨水瓶色卡·选文风 */
  function _inkPalette(onPick) {
    var pal = _el('div', 'tb-inks');
    STYLES.forEach(function (s) {
      var bottle = _el('button', 'tb-ink');
      var drop = _el('div', 'tb-ink-drop');
      drop.style.background = s[1];
      bottle.appendChild(drop);
      bottle.appendChild(_el('div', 'tb-ink-name', s[0]));
      bottle.addEventListener('click', function () {
        pal.querySelectorAll('.tb-ink').forEach(function (x) { x.classList.remove('tb-ink-picked'); });
        bottle.classList.add('tb-ink-picked');
        _form.style = s;
        onPick(s);
      });
      pal.appendChild(bottle);
    });
    return pal;
  }

  /* 传记 prompt 构造（过去/未来自动判） */
  function _buildPrompt() {
    var ch = _form.char || {};
    var targetYear = _form.year || (new Date(window.TimeWorld.getNow()).getFullYear() + 5);
    var nowYear = new Date(window.TimeWorld.getNow()).getFullYear();
    var isPast = targetYear < nowYear;
    var timeWord = isPast ? '他当时的经历' : '未来的景象';
    return '你是传记作家。为角色「' + (ch.name || '他') + '」写一篇' + (isPast ? '回忆传记' : '未来传记') + '。\n' +
      '角色人设：' + (ch.description || ch.persona || '（未设定）') + '\n' +
      '目标年份：' + targetYear + ' 年（' + (_form.age || 25) + ' 岁）\n' +
      '主题：' + (_form.theme || '成长') + '。描写' + timeWord + '。\n' +
      '文风：' + ((_form.style && _form.style[0]) || '温暖奶茶') + '。\n' +
      '字数：' + ((_form.words && _form.words[0]) || '800-2000') + ' 字。\n' +
      '要求：叙事散文体，有画面感和细节，不要分点列表。';
  }

  /* 结果页=打开的书（跨页） */
  function _resultBook(text, onBack) {
    /* ①接线：tb-book3d 双面页结构（封面→翻开，卷十深化件挂载） */
    var book = _el('div', 'tb-book3d');
    var cover = _el('div', 'tb-book3d-cover');
    cover.appendChild(_el('div', 'tb-b3-title', (_form.char && _form.char.name ? _form.char.name + ' · ' : '') + (_form.theme || '传记')));
    book.appendChild(cover);
    var left = _el('div', 'tb-book3d-face tb-face-left');
    left.appendChild(_el('div', 'tb-book-photo'));
    var stampDate = new Date(window.TimeWorld.getNow());
    left.appendChild(_el('div', 'tb-book-postmark', (_form.year || stampDate.getFullYear()) + '.' + _p2(stampDate.getMonth() + 1) + '.' + _p2(stampDate.getDate())));
    left.appendChild(_el('div', 'tb-book-note', _form.year && _form.year < new Date(window.TimeWorld.getNow()).getFullYear() ? '这是他最勇敢的一年' : '未来可期'));
    left.appendChild(_el('div', 'tb-book3d-bookmark'));
    book.appendChild(left);
    var right = _el('div', 'tb-book3d-face tb-face-back');
    right.appendChild(_el('div', 'tb-book-title', (_form.char && _form.char.name ? _form.char.name + ' · ' : '') + (_form.theme || '传记')));
    var para = _el('div', 'tb-book-text');
    right.appendChild(para);
    right.appendChild(_el('div', 'tb-book-footer', '第 1 页 · 拾光'));
    book.appendChild(right);
    /* 打字机效果（tb-rise-in 段落渐显挂载） */
    para.classList.add('tb-rise-in');
    var idx = 0;
    var typeTimer = setInterval(function () {
      if (idx >= text.length) { clearInterval(typeTimer); return; }
      para.textContent += text.charAt(idx);
      idx++;
    }, 30);
    book._typeTimer = typeTimer;
    window._tbTypeTimer = typeTimer;   /* Codex查bug#3：翻页/关书统一清理 */

    var back = _el('button', 'tb-book-back', '‹ 合书返回');
    back.addEventListener('click', function () {
      clearInterval(typeTimer);
      if (window._tbTypeTimer === typeTimer) window._tbTypeTimer = null;
      onBack();
    });
    return book;
  }
  function _p2(n) { return (n < 10 ? '0' : '') + n; }

  /* §2 主体 */
  function buildCh2(body, shell) {
    /* Codex查bug#5：重建表单必清旧选择，防'空表单却按旧配置生成' */
    _form.char = null; _form.year = null; _form.age = null;
    _form.theme = null; _form.words = null; _form.style = null;
    var formBox = _el('div', 'tb-bio-form');
    formBox.appendChild(_el('div', 'tb-card-title', '一 · 选人物（拍立得）'));
    formBox.appendChild(_photoWall(function () {}));
    formBox.appendChild(_el('div', 'tb-card-title', '二 · 选时间（撕页车票）'));
    formBox.appendChild(_ticketForm(function () {}));
    formBox.appendChild(_el('div', 'tb-card-title', '三 · 选主题（邮票）'));
    formBox.appendChild(_stampWall(function () {}));
    formBox.appendChild(_el('div', 'tb-card-title', '四 · 选字数（尺子）'));
    formBox.appendChild(_rulerSlider(function () {}));
    formBox.appendChild(_el('div', 'tb-card-title', '五 · 选文风（墨水瓶）'));
    formBox.appendChild(_inkPalette(function () {}));
    body.appendChild(formBox);
    /* 贴纸挂章角（克劳德逮的两悬补接·tb-clip/tb-tape-roll/tb-daisy 族） */
    try {
      ['tb-clip', 'tb-tape-roll', 'tb-daisy'].slice(0, 2).forEach(function (cls, i) {
        var st = _el('div', cls);
        body.appendChild(st);
      });
    } catch (e) {}

    /* 火漆生成按钮 */
    var genBtn = _el('button', 'tb-wax-seal', '盖章生成传记');
    genBtn.addEventListener('click', async function () {
      /* Codex查bug#4：防重复点击并发生成 */
      if (genBtn.disabled) return;
      if (!_form.char) { window.toast && window.toast('先选一位角色'); return; }
      genBtn.disabled = true;
      genBtn.classList.add('tb-shine-btn', 'tb-stamp-slam-in');
      /* 骨架挂加载（克劳德逮的两悬补接·tb-skeleton 族） */
      try {
        var skel = _el('div', 'tb-skeleton tb-breathe');
        skel.appendChild(_el('div', 'tb-skeleton-line tb-long'));
        skel.appendChild(_el('div', 'tb-skeleton-line tb-mid'));
        skel.appendChild(_el('div', 'tb-skeleton-line tb-short'));
        body.appendChild(skel);
        genBtn._skel = skel;
      } catch (e2) {}
      try {
        var prompt = _buildPrompt();
        var text = '';
        if (window.callAI) {
          /* callAI 要消息数组：传字符串会被当成空消息列表，接口必 400 */
          text = await window.callAI([{ role: 'user', content: prompt }]);
        } else {
          text = '（AI 接口未就绪）';
        }
        genBtn.classList.remove('tb-shine-btn', 'tb-stamp-slam-in');
        if (genBtn._skel && genBtn._skel.remove) { genBtn._skel.remove(); genBtn._skel = null; }
        if (!text || !String(text).trim()) throw new Error('AI 返回为空');
        /* 先构建结果页，构建成功才换页——失败绝不把表单清成空壳 */
        var result = _resultBook(String(text), function () {
          body.innerHTML = '';
          buildCh2(body);
        });
        body.innerHTML = '';
        body.appendChild(result);
      } catch (e) {
        genBtn.disabled = false;
        genBtn.classList.remove('tb-shine-btn', 'tb-stamp-slam-in');
        if (genBtn._skel && genBtn._skel.remove) { genBtn._skel.remove(); genBtn._skel = null; }
        window.toast && window.toast('生成失败：' + (e.message || e));
      }
    });
    body.appendChild(genBtn);
  }

  /* ===== 多列拨盘（年/月/日）：点选高亮、确定只填值、全链路掐冒泡 ===== */
  function _openColsPicker(title, cols, onPick) {
    try {
      document.querySelectorAll('.tb-dialog-mask').forEach(function (s) { s.remove(); });
    } catch (e) {}
    var mask = _el('div', 'tb-dialog-mask');
    mask.addEventListener('click', function (e) { e.stopPropagation(); });
    var dlg = _el('div', 'tb-dialog tb-wheel-dlg');
    dlg.addEventListener('click', function (e) { e.stopPropagation(); });
    dlg.appendChild(_el('div', 'tb-dialog-title', title));
    var wrap = _el('div', 'tb-wheel-cols');
    var picked = {};
    cols.forEach(function (col) {
      picked[col.key] = col.cur;
      var sc = _el('div', 'tb-dialog-scroll tb-wheel');
      (col.list || []).forEach(function (v) {
        var item = _el('button', 'tb-wheel-item' + (v === col.cur ? ' tb-wheel-cur' : ''), col.fmt ? col.fmt(v) : String(v));
        item.addEventListener('click', function (e) {
          e.stopPropagation();
          sc.querySelectorAll('.tb-wheel-item').forEach(function (x) { x.classList.remove('tb-wheel-cur'); });
          item.classList.add('tb-wheel-cur');
          picked[col.key] = v;
        });
        sc.appendChild(item);
      });
      wrap.appendChild(sc);
    });
    dlg.appendChild(wrap);
    var btns = _el('div', 'tb-dialog-btns');
    var cancel = _el('button', 'tb-dialog-cancel', '取消');
    cancel.addEventListener('click', function (e) { e.stopPropagation(); _closePicker(mask); });
    var ok = _el('button', 'tb-dialog-ok', '确定');
    ok.addEventListener('click', function (e) {
      e.stopPropagation();
      try { onPick(picked); } catch (err) {}
      _closePicker(mask);
    });
    btns.appendChild(cancel);
    btns.appendChild(ok);
    dlg.appendChild(btns);
    mask.appendChild(dlg);
    document.body.appendChild(mask);
    requestAnimationFrame(function () { mask.classList.add('open'); });
    try {
      wrap.querySelectorAll('.tb-wheel').forEach(function (sc) {
        var curItem = sc.querySelector('.tb-wheel-cur');
        if (curItem) sc.scrollTop = curItem.offsetTop - sc.clientHeight / 2 + curItem.offsetHeight / 2;
      });
    } catch (e) {}
  }

  /* 日历标题快选（年+月两级拨盘，替掉一页页翻） */
  function _quickJump(curDate, onPick) {
    var y0 = Math.min(2024, curDate.getFullYear()), y1 = Math.max(2124, curDate.getFullYear());   /* 当前年不在区间就扩进来（Codex#7） */
    var yList = []; for (var v = y0; v <= y1; v++) yList.push(v);
    var mList = []; for (var i2 = 1; i2 <= 12; i2++) mList.push(i2);
    _openColsPicker('跳到哪年哪月', [
      { key: 'y', list: yList, cur: curDate.getFullYear(), fmt: function (v) { return v + '年'; } },
      { key: 'm', list: mList, cur: curDate.getMonth() + 1, fmt: function (v) { return v + '月'; } }
    ], function (p) { onPick(p.y, p.m); });
  }

  /* 日期拨盘（年月日）：替掉系统 date 弹层（它只能一页页翻） */
  function _openDateWheel(curStr, onPick) {
    var cur = curStr ? new Date(String(curStr) + 'T00:00:00') : new Date(window.TimeWorld.getNow());
    if (isNaN(cur.getTime())) cur = new Date(window.TimeWorld.getNow());
    var y0 = Math.min(2024, cur.getFullYear()), y1 = Math.max(2124, cur.getFullYear());   /* Codex#7 */
    var yList = []; for (var v = y0; v <= y1; v++) yList.push(v);
    var mList = []; for (var i2 = 1; i2 <= 12; i2++) mList.push(i2);
    var dList = []; for (var j = 1; j <= 31; j++) dList.push(j);
    _openColsPicker('选个日子', [
      { key: 'y', list: yList, cur: cur.getFullYear(), fmt: function (v) { return v + '年'; } },
      { key: 'm', list: mList, cur: cur.getMonth() + 1, fmt: function (v) { return v + '月'; } },
      { key: 'd', list: dList, cur: cur.getDate(), fmt: function (v) { return v + '日'; } }
    ], function (p) {
      var maxD = new Date(p.y, p.m, 0).getDate();   /* 2月31这类自动校正月末 */
      var d = Math.min(p.d, maxD);
      onPick(p.y + '-' + (p.m < 10 ? '0' : '') + p.m + '-' + (d < 10 ? '0' : '') + d);
    });
  }

  /* 导出给 ch1/ch3/ch4/ch5 用（事件回调运行时调用，早赋值安全） */
  window._tbOpenWheel = _openWheelPicker;
  window._tbOpenCols = _openColsPicker;
  window._tbQuickJump = _quickJump;
  window._tbOpenDateWheel = _openDateWheel;

  window._tbCh2 = buildCh2;
})();

/* ================= §3 第三章 · 记忆穿越（④） ================= */
(function () {
  'use strict';
  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function _toast(msg) { if (window.toast) window.toast(msg); else console.log('[TimeBook] ' + msg); }

  function buildCh3(body) {
    var TW = window.TimeWorld || { getNow: function () { return Date.now(); }, isEnabled: function () { return false; } };
    body.appendChild(_el('div', 'tb-card-title', '撕页日历 · 穿越到某天'));
    /* 撕页日历（复用 ch1 同款，这里独立一份精简版） */
    var cursor = new Date(TW.getNow());
    var cal = _el('div', 'tb-cal');
    function render() {
      cal.innerHTML = '';
      var head = _el('div', 'tb-cal-head');
      var prev = _el('button', 'tb-cal-nav', '‹');
      var title = _el('div', 'tb-cal-title', cursor.getFullYear() + '年' + (cursor.getMonth() + 1) + '月');
      /* 点顶部日期=快速选择（主人令：不许一页一页翻） */
      title.addEventListener('click', function () {
        if (!window._tbQuickJump) return;
        window._tbQuickJump(cursor, function (y, m) {
          cursor = new Date(y, m - 1, 1);
          render();
        });
      });
      var next = _el('button', 'tb-cal-nav', '›');
      head.appendChild(prev); head.appendChild(title); head.appendChild(next);
      cal.appendChild(head);
      var grid = _el('div', 'tb-cal-grid');
      ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w) { grid.appendChild(_el('div', 'tb-cal-week', w)); });
      var startDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
      var days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      var today = new Date(TW.getNow());
      for (var i = 0; i < startDow; i++) grid.appendChild(_el('div', 'tb-cal-day tb-cal-blank', ''));
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var cell = _el('div', 'tb-cal-day', String(day));
          cell.addEventListener('click', function () {
            var y = cursor.getFullYear(), m = cursor.getMonth() + 1;
            var targetTs = new Date(y, m - 1, day, 12, 0, 0).getTime();
            if (TW && TW.isEnabled()) {
              /* 跳时间+dispatch tw-jump（记忆面板联动契约） */
              TW.addOffset(targetTs - TW.getNow());
              window.dispatchEvent(new CustomEvent('tw-jump', { detail: { virtualTs: targetTs, y: y, m: m, d: day } }));
              _toast('已穿越到 ' + y + '年' + m + '月' + day + '日');
            } else {
              /* 点了必须有反应：没开虚拟时间也照样翻这天的记忆 */
              _toast('虚拟时间未开启，只翻这天的记忆');
            }
            _showDayMemories(body, y, m, day);
          });
          grid.appendChild(cell);
        })(d);
      }
      cal.appendChild(grid);
      prev.addEventListener('click', function () { cursor.setDate(1); cursor.setMonth(cursor.getMonth() - 1); render(); });
      next.addEventListener('click', function () { cursor.setDate(1); cursor.setMonth(cursor.getMonth() + 1); render(); });
    }
    render();
    body.appendChild(cal);
    body.appendChild(_el('div', 'tb-empty-hint', '点日期穿越到那天'));
  }

  /* 某天记忆=拍立得胶片展开 */
  var _dayReq = 0;
  function _showDayMemories(body, y, m, d) {
    var req = ++_dayReq;
    var old = body.querySelector('.tb-day-memories');
    if (old) old.remove();
    var box = _el('div', 'tb-day-memories');
    box.appendChild(_el('div', 'tb-card-title', y + '年' + m + '月' + d + '日 · 当天故事'));
    (async function () {
      var rows = [];
      try {
        if (window.db && window.db.memories) {
          var all = await window.db.memories.toArray();
          rows = all.filter(function (x) {
            var t = new Date(x.createdAt || x.sourceAt || 0);
            return t.getFullYear() === y && (t.getMonth() + 1) === m && t.getDate() === d;
          });
        }
      } catch (e) {}
      /* Codex查bug#6：快速连点日期防乱序回填 */
      if (req !== _dayReq) return;
      if (!rows.length) {
        box.appendChild(_el('div', 'tb-empty-photo', '这天还没有故事'));
        body.appendChild(box);
        return;
      }
      rows.slice(0, 10).forEach(function (mem, i) {
        var film = _el('div', 'tb-film');
        film.style.setProperty('--tb-rotate', ((i % 2 ? 1 : -1) * 1.5) + 'deg');
        film.appendChild(_el('div', 'tb-film-img'));
        film.appendChild(_el('div', 'tb-film-title', mem.title || '记忆'));
        film.appendChild(_el('div', 'tb-film-note', (mem.content || '').slice(0, 60)));
        box.appendChild(film);
      });
      body.appendChild(box);
    })();
  }

  window._tbCh3 = buildCh3;
})();

/* ================= §4 第四章 · 未来信（⑤） ================= */
(function () {
  'use strict';
  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  var LKEY = 'tb_letters';

  /* T1.7：存储切 db.config 单 key 数组（裁决二，localStorage 兜底） */
  function _loadLetters(cb) {
    try {
      if (window.db && window.db.config) {
        window.db.config.get(LKEY).then(function (r) {
          cb(r && Array.isArray(r.value) ? r.value : []);
        }).catch(function () {
          cb(JSON.parse(localStorage.getItem(LKEY) || '[]'));
        });
      } else {
        cb(JSON.parse(localStorage.getItem(LKEY) || '[]'));
      }
    } catch (e) { cb([]); }
  }
  function _saveLetters(list) {
    try {
      if (window.db && window.db.config) window.db.config.put({ key: LKEY, value: list });
      else localStorage.setItem(LKEY, JSON.stringify(list));
    } catch (e) {}
  }

  function buildCh4(body) {
    body.appendChild(_el('div', 'tb-card-title', '写一封给未来的信'));
    var paper = _el('textarea', 'tb-letter-paper');
    paper.placeholder = '亲爱的未来的我……';
    paper.rows = 6;
    body.appendChild(paper);
    var counter = _el('div', 'tb-letter-count', '0 字');
    paper.addEventListener('input', function () { counter.textContent = paper.value.length + ' 字'; });
    body.appendChild(counter);

    /* 收信时间（撕页车票复用精简版·v6.5.0 换年月日拨盘，替掉系统日历） */
    var dateInput = _el('input', 'tb-ticket-year tb-date-pick');
    dateInput.readOnly = true;
    dateInput.placeholder = '点我选收信日子';
    dateInput.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (window._tbOpenDateWheel) window._tbOpenDateWheel(dateInput.value || '', function (ds) {
        dateInput.value = ds;
      });
    });
    body.appendChild(dateInput);

    var sealBtn = _el('button', 'tb-wax-seal', '封缄');
    sealBtn.addEventListener('click', function () {
      if (!paper.value.trim()) { window.toast && window.toast('信还是空的'); return; }
      if (!dateInput.value) { window.toast && window.toast('选个收信日期'); return; }
      sealBtn.classList.add('tb-sealing');
      setTimeout(function () {
        _loadLetters(function (list) {
          list.push({ text: paper.value, targetDate: dateInput.value, createdAt: Date.now(), opened: false });
          _saveLetters(list);
        });
        sealBtn.classList.remove('tb-shine-btn', 'tb-stamp-slam-in');
        paper.value = ''; counter.textContent = '0 字'; dateInput.value = '';
        window.toast && window.toast('信已封缄，等待启封');
        _renderMailbox(body);
      }, 600);
    });
    body.appendChild(sealBtn);

    _renderMailbox(body);

    /* 到点拆封检测（onChange 挂钩） */
    if (window.TimeWorld && window.TimeWorld.onChange) {
      window.TimeWorld.onChange(function () {
        var today = new Date(window.TimeWorld.getNow()).toISOString().slice(0, 10);
        _loadLetters(function (list) {
          var opened = false;
          list.forEach(function (l) {
            if (!l.opened && l.targetDate <= today) { l.opened = true; opened = true; }
          });
          if (opened) {
            _saveLetters(list);
            _renderMailbox(body);
            window.toast && window.toast('有信到了启封时刻');
          }
        });
      });
    }
  }

  function _renderMailbox(body) {
    var old = body.querySelector('.tb-mailbox');
    if (old) old.remove();
    var box = _el('div', 'tb-mailbox');
    box.appendChild(_el('div', 'tb-card-title', '信箱 · 集信册'));
    _loadLetters(function (list) {
    if (!list.length) {
      box.appendChild(_el('div', 'tb-empty-hint', '信箱还空着'));
      body.appendChild(box);
      return;
    }
    list.forEach(function (l, i) {
      var env = _el('div', 'tb-envelope' + (l.opened ? ' tb-envelope-open' : ''));
      env.appendChild(_el('div', 'tb-envelope-icon', ''));
      env.appendChild(_el('div', 'tb-envelope-date', l.targetDate));
      env.appendChild(_el('div', 'tb-envelope-status', l.opened ? '已启封' : '待启封'));
      env.addEventListener('click', function () {
        if (!l.opened) { window.toast && window.toast('还没到启封时刻'); return; }
        window.toast && window.toast('信：' + l.text.slice(0, 50));
      });
      box.appendChild(env);
    });
    body.appendChild(box);
    });
  }

  window._tbCh4 = buildCh4;
})();

/* ================= §5 第五章 · 倒计时驿站 + 年龄时钟（v6.5.0） =================
 * 主人定的倒数规则：
 *   不循环：未来=每天减一天（还有N天）；之前的日子=每天加一天（已过N天）；当天=就是今天
 *   每年循环祭日：到日子数字归零，第二天起"只过了N天"，明年自动重新倒数
 *   周期循环（N天一轮）：满一个周期那天归零，第二天重新倒数（100天一轮→满100天次日99天）
 * 设置时可选相关人/知道的人（人物全部来自角色档案）；年龄时钟+倒计时驿站对每个角色可见（AI认知注入）
 * ============================================================ */
(function () {
  'use strict';
  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function _toast(msg) { if (window.toast) window.toast(msg); else console.log('[TimeBook] ' + msg); }

  var CDKEY = 'tb_countdowns';
  var BDKEY = 'tb_birthdays';

  /* 存储：db.config 单 key 数组（localStorage 兜底，同未来信） */
  function _loadCfg(key, cb) {
    try {
      if (window.db && window.db.config) {
        window.db.config.get(key).then(function (r) {
          cb(r && Array.isArray(r.value) ? r.value : []);
        }).catch(function () {
          try { cb(JSON.parse(localStorage.getItem(key) || '[]')); } catch (e) { cb([]); }
        });
      } else {
        cb(JSON.parse(localStorage.getItem(key) || '[]'));
      }
    } catch (e) { cb([]); }
  }
  function _saveCfg(key, list) {
    _briefVer++;   /* 存档变更→AI认知缓存立即失效（Codex#3） */
    try {
      if (window.db && window.db.config) {
        window.db.config.put({ key: key, value: list }).catch(function () {
          try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {}
        });
      } else localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {}
  }
  function _loadCfgP(key) {
    return new Promise(function (res) { _loadCfg(key, res); });
  }

  /* 虚拟今天 → 目标日期的整天数差 */
  function _dayDiff(nowTs, dateStr) {
    var now = new Date(nowTs);
    var t = new Date(String(dateStr) + 'T00:00:00');
    if (isNaN(t.getTime())) return null;
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.round((t.getTime() - a) / 86400000);
  }

  /* 'YYYY-MM-DD' → 'YYYY年M月D日' */
  function _fmtDate(str) {
    var pd = _parseDate(str);
    if (!pd) return String(str || '');
    return pd.y + '年' + pd.m + '月' + pd.d + '日';
  }

  /* 严格日期解析：2月30/2月29(平年写死29)这类非法值返回 null（Codex#1） */
  function _parseDate(str) {
    var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(str || '').trim());
    if (!m) {
      var t0 = new Date(String(str) + 'T00:00:00');
      if (isNaN(t0.getTime())) return null;
      return { y: t0.getFullYear(), m: t0.getMonth() + 1, d: t0.getDate() };
    }
    var y = +m[1], mo = +m[2], d = +m[3];
    var t = new Date(y, mo - 1, d);
    if (t.getFullYear() !== y || t.getMonth() !== mo - 1 || t.getDate() !== d) return null;
    return { y: y, m: mo, d: d };
  }

  /* 周年目标日：2月29生日/祭日在平年落到2月最后一天（Codex#1） */
  function _annivTarget(pd, year) {
    var lastDay = new Date(year, pd.m, 0).getDate();
    return new Date(year, pd.m - 1, Math.min(pd.d, lastDay)).getTime();
  }

  /* ===== 倒数日子状态机（主人定的三种规则） ===== */
  function _cdState(it, nowTs) {
    var now = new Date(nowTs);
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var pd = _parseDate(it.date);
    if (!pd) return { kind: 'invalid' };
    if (it.mode === 'cycle' && it.period >= 2) {
      /* 周期循环：到满那天归零，第二天重新倒数（100天一轮→满100天，次日99天） */
      var period = Math.floor(it.period);
      var diffC = _dayDiff(nowTs, it.date);
      if (diffC === null) return { kind: 'invalid' };
      if (diffC > 0) return { kind: 'future', days: diffC, note: '首个周期还没开始' };
      var elapsed = -diffC;
      var pos = elapsed % period;
      if (pos === 0) return { kind: 'full', days: period, note: '满一个周期' };
      return { kind: 'cycle', days: period - pos, note: '第 ' + (Math.floor(elapsed / period) + 1) + ' 轮' };
    }
    if (it.mode === 'yearly') {
      /* 每年循环祭日：只看今年的月日，到日子归零，过后"只过了N天"，明年自动重新倒数 */
      var targetY = _annivTarget(pd, now.getFullYear());
      var diffY = Math.round((targetY - today) / 86400000);
      if (diffY > 0) return { kind: 'future', days: diffY, note: '今年' };
      if (diffY === 0) return { kind: 'today', days: 0, note: '纪念日' };
      return { kind: 'past', days: -diffY, note: '周年已过' };
    }
    /* 不循环：未来减一天，之前的日子加一天 */
    var diff = _dayDiff(nowTs, it.date);
    if (diff === null) return { kind: 'invalid' };
    if (diff > 0) return { kind: 'future', days: diff };
    if (diff === 0) return { kind: 'today', days: 0 };
    return { kind: 'past', days: -diff };
  }

  /* ===== 年龄计算（年龄时钟同源·虚拟时间口径） ===== */
  function _ageOf(bdStr, nowTs) {
    var pd = _parseDate(bdStr);
    if (!pd) return null;
    var now = new Date(nowTs);
    var years = now.getFullYear() - pd.y;
    var months = now.getMonth() - (pd.m - 1);
    if (now.getDate() < pd.d) months--;
    if (months < 0) { years--; months += 12; }
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    /* 2月29生日：平年按2月最后一天算（Codex#1） */
    var nb = _annivTarget(pd, now.getFullYear());
    var nextDays = Math.round((nb - today) / 86400000);
    if (nextDays < 0) nextDays = Math.round((_annivTarget(pd, now.getFullYear() + 1) - today) / 86400000);
    return { years: years, months: months, nextDays: nextDays, birthYear: pd.y };
  }

  /* ===== AI 认知导出：年龄时钟+倒计时驿站，每个角色都知道（callAI 注入用） ===== */
  var _briefVer = 0;   /* 数据版本号：存档一变立即失效缓存（Codex#3） */
  var _briefCache = { ts: 0, key: '', text: '' };
  async function getAIBrief(charHint) {
    try {
      var hint = String(charHint || '');
      var TW = window.TimeWorld;
      var nowTs = (TW && TW.getNow) ? TW.getNow() : Date.now();
      var cacheKey = hint + '|' + _briefVer + '|' + new Date(nowTs).toDateString();
      if (_briefCache.text && _briefCache.key === cacheKey && Date.now() - _briefCache.ts < 60000) return _briefCache.text;
      var chars = [];
      try {
        if (window.db && window.db.characters) chars = await window.db.characters.toArray();
        else if (window._characters) chars = window._characters;
      } catch (e) {}
      var bds = await _loadCfgP(BDKEY);
      var cds = await _loadCfgP(CDKEY);
      var out = '';
      /* 年龄时钟：每个AI都知道每个人的年龄（以年龄时钟为准） */
      var ageLine = [];
      chars.forEach(function (ch) {
        var key = ch.id != null ? String(ch.id) : (ch.name || '');
        var rec = null;
        bds.forEach(function (x) {
          if (String(x.charId) === key || (x.name && ch.name && x.name === ch.name)) rec = x;
        });
        var bd = (rec && rec.birthday) || ch.birthday || '';
        if (!bd) return;
        var a = _ageOf(bd, nowTs);
        if (a && a.years >= 0) ageLine.push((ch.name || '角色') + ' ' + a.years + '岁（生日' + _fmtDate(bd) + '）');
      });
      if (ageLine.length) {
        out += '【年龄时钟·所有人的年龄】（大家都知道，可自然提及）：' + ageLine.join('；') + '。\n';
      }
      /* 倒计时驿站：按"知道的人/相关人"过滤（Codex#2：没名单=大家都知道；有名单=必须在名单里，认不出谁在说话就不出） */
      var cdLine = [];
      cds.forEach(function (it) {
        var hasList = (it.knowers && it.knowers.length) || (it.related && it.related.length);
        if (hasList) {
          if (!hint) return;
          if ((it.knowers || []).indexOf(hint) === -1 && (it.related || []).indexOf(hint) === -1) return;
        }
        var st = _cdState(it, nowTs);
        if (st.kind === 'invalid') return;
        var word = st.kind === 'future' ? ('还有' + st.days + '天')
          : st.kind === 'today' ? '就是今天'
          : st.kind === 'past' ? ('已过' + st.days + '天')
          : st.kind === 'full' ? ('今天满' + (it.period || 100) + '天')
          : ('还有' + st.days + '天');
        var tag = it.mode === 'yearly' ? '每年循环祭日' : it.mode === 'cycle' ? ((it.period || 100) + '天一轮') : '';
        cdLine.push('「' + (it.title || '倒数的日子') + '」' + word + '（' + _fmtDate(it.date) + (tag ? '·' + tag : '') + '）');
      });
      if (cdLine.length) {
        out += '【倒计时驿站·你知道的重要日子】：' + cdLine.join('；') + '。\n';
      }
      if (out) {
        out += '（以上来自拾光手账，心里有数即可，聊天时自然运用，不要机械复读。）';
      }
      _briefCache = { ts: Date.now(), key: cacheKey, text: out };
      return out;
    } catch (e) {
      console.warn('[TimeDiary] getAIBrief 异常:', e);
      return '';
    }
  }

  function buildCh5(body) {
    var TW = window.TimeWorld;
    var charsCache = [];
    var draft = { mode: 'none', period: 100, related: [], knowers: [], relatedNames: [], knowerNames: [] };

    /* ============ 上半 · 倒计时驿站 ============ */
    body.appendChild(_el('div', 'tb-card-title', '倒计时驿站 · 寄往未来的日子'));
    var addRow = _el('div', 'tb-cd-add');
    var cdTitle = _el('input', 'tb-cd-input');
    cdTitle.placeholder = '想倒数的事（生日/旅行/考试…）';
    cdTitle.maxLength = 16;
    cdTitle.setAttribute('enterkeyhint', 'done');
    var cdDate = _el('input', 'tb-ticket-year tb-cd-date tb-date-pick');
    cdDate.readOnly = true;
    cdDate.placeholder = '选日子';
    cdDate.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (window._tbOpenDateWheel) window._tbOpenDateWheel(cdDate.value || '', function (ds) {
        cdDate.value = ds;
      });
    });
    var cdBtn = _el('button', 'tb-cd-btn', '贴上车票');
    addRow.appendChild(cdTitle);
    addRow.appendChild(cdDate);
    addRow.appendChild(cdBtn);
    body.appendChild(addRow);

    /* 循环模式：不循环 / 每年循环祭日 / 周期循环 */
    var modeRow = _el('div', 'tb-cd-modes');
    [['不循环', 'none'], ['每年循环祭日', 'yearly'], ['周期循环', 'cycle']].forEach(function (mm) {
      var b = _el('button', 'tb-cd-chip' + (draft.mode === mm[1] ? ' tb-cd-chip-on' : ''), mm[0]);
      b.addEventListener('click', function () {
        draft.mode = mm[1];
        modeRow.querySelectorAll('.tb-cd-chip').forEach(function (x) { x.classList.remove('tb-cd-chip-on'); });
        b.classList.add('tb-cd-chip-on');
        cycleRow.style.display = draft.mode === 'cycle' ? '' : 'none';
      });
      modeRow.appendChild(b);
    });
    body.appendChild(modeRow);
    var cycleRow = _el('div', 'tb-cd-cycle-row');
    cycleRow.style.display = 'none';
    cycleRow.appendChild(_el('div', 'tb-cd-cycle-label', '周期天数'));
    var periodInput = _el('input', 'tb-cd-input tb-cd-period');
    periodInput.readOnly = true;
    periodInput.value = '100';
    periodInput.addEventListener('click', function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      if (window._tbOpenWheel) {
        var plist = []; for (var v = 2; v <= 365; v++) plist.push(v);
        window._tbOpenWheel('周期几天一轮', { list: plist, cur: draft.period }, function (v) {
          draft.period = v;
          periodInput.value = String(v);
        });
      }
    });
    cycleRow.appendChild(periodInput);
    cycleRow.appendChild(_el('div', 'tb-cd-cycle-label', '天一轮'));
    body.appendChild(cycleRow);

    /* 相关人 / 知道的人（人物全部来自角色档案） */
    function _peopleRow(label, keysName, namesName) {
      var row = _el('div', 'tb-cd-people');
      row.appendChild(_el('div', 'tb-cd-people-title', label));
      var wrap = _el('div', 'tb-cd-people-list');
      function render() {
        wrap.innerHTML = '';
        if (!charsCache.length) {
          wrap.appendChild(_el('div', 'tb-empty-hint', '角色档案还是空的'));
          return;
        }
        charsCache.forEach(function (ch) {
          var key = ch.id != null ? String(ch.id) : (ch.name || '');
          var on = draft[keysName].indexOf(key) !== -1;
          var chip = _el('button', 'tb-cd-person' + (on ? ' tb-cd-person-on' : ''));
          var av = _el('div', 'tb-cd-person-av');
          if (ch.avatar) {
            av.style.backgroundImage = 'url(' + ch.avatar + ')';
            av.style.backgroundSize = 'cover';
            av.style.backgroundPosition = 'center';
          }
          chip.appendChild(av);
          chip.appendChild(_el('div', 'tb-cd-person-name', ch.name || '角色'));
          chip.addEventListener('click', function () {
            var idx = draft[keysName].indexOf(key);
            if (idx >= 0) {
              draft[keysName].splice(idx, 1);
              draft[namesName].splice(idx, 1);
            } else {
              draft[keysName].push(key);
              draft[namesName].push(ch.name || '角色');
            }
            render();
          });
          wrap.appendChild(chip);
        });
      }
      row.appendChild(wrap);
      row._renderPeople = render;
      return row;
    }
    var relRow = _peopleRow('相关人', 'related', 'relatedNames');
    var knRow = _peopleRow('知道的人', 'knowers', 'knowerNames');
    body.appendChild(relRow);
    body.appendChild(knRow);

    var cdList = _el('div', 'tb-cd-list');
    body.appendChild(cdList);

    var _cdsReq = 0;   /* 连点防乱序回填（Codex#5） */
    function renderCds() {
      var req = ++_cdsReq;
      cdList.innerHTML = '';
      _loadCfg(CDKEY, function (list) {
        if (req !== _cdsReq) return;
        if (!list.length) {
          cdList.appendChild(_el('div', 'tb-empty-hint', '还没有倒数的日子，贴一张车票吧'));
          return;
        }
        list.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
        list.forEach(function (it) {
          var st = _cdState(it, TW && TW.getNow ? TW.getNow() : Date.now());
          var card = _el('div', 'tb-cd-card' + (st.kind === 'today' || st.kind === 'full' ? ' tb-cd-today' : ''));
          var left = _el('div', 'tb-cd-main');
          left.appendChild(_el('div', 'tb-cd-name', it.title || '倒数的日子'));
          var stampText = String(it.date).replace(/-/g, '.');
          if (it.mode === 'yearly') stampText += ' · 每年循环';
          else if (it.mode === 'cycle') stampText += ' · ' + (it.period || 100) + '天一轮';
          left.appendChild(_el('div', 'tb-cd-stamp', stampText));
          var rel = (it.relatedNames || []).join('、');
          var kn = (it.knowerNames || []).join('、');
          if (rel || kn) {
            left.appendChild(_el('div', 'tb-cd-meta',
              (rel ? '相关人：' + rel : '') + (rel && kn ? ' · ' : '') + (kn ? '知道的人：' + kn : '')));
          }
          card.appendChild(left);
          var days = _el('div', 'tb-cd-days');
          if (st.kind === 'invalid') {
            days.appendChild(_el('div', 'tb-cd-num tb-cd-num-past', '?'));
            days.appendChild(_el('div', 'tb-cd-unit', '日期无效'));
          } else if (st.kind === 'future') {
            days.appendChild(_el('div', 'tb-cd-num', String(st.days)));
            days.appendChild(_el('div', 'tb-cd-unit', '天后'));
          } else if (st.kind === 'today') {
            days.appendChild(_el('div', 'tb-cd-num tb-cd-num-fire', '今'));
            days.appendChild(_el('div', 'tb-cd-unit', '就是今天'));
          } else if (st.kind === 'past') {
            days.appendChild(_el('div', 'tb-cd-num tb-cd-num-past', String(st.days)));
            days.appendChild(_el('div', 'tb-cd-unit', '天前'));
          } else if (st.kind === 'full') {
            days.appendChild(_el('div', 'tb-cd-num tb-cd-num-fire', '满'));
            days.appendChild(_el('div', 'tb-cd-unit', (it.period || 100) + '天'));
          } else if (st.kind === 'cycle') {
            days.appendChild(_el('div', 'tb-cd-num', String(st.days)));
            days.appendChild(_el('div', 'tb-cd-unit', '天后'));
          }
          if (st.note) days.appendChild(_el('div', 'tb-cd-note', st.note));
          card.appendChild(days);
          var del = _el('button', 'tb-cd-del', '');
          del.setAttribute('aria-label', '撕下车票');
          del.addEventListener('click', function (e) {
            e.stopPropagation();
            _loadCfg(CDKEY, function (l2) {
              _saveCfg(CDKEY, l2.filter(function (x) {
                return (x.id || ('cd_' + x.createdAt)) !== (it.id || ('cd_' + it.createdAt));
              }));
              renderCds();
              _toast('车票已撕下');
            });
          });
          card.appendChild(del);
          cdList.appendChild(card);
        });
      });
    }
    cdBtn.addEventListener('click', function () {
      var t = cdTitle.value.trim();
      var d = cdDate.value;
      if (!t) { _toast('先写一句想倒数的事'); return; }
      if (!d) { _toast('选个目标日子'); return; }
      if (draft.mode === 'cycle' && !(draft.period >= 2)) { _toast('周期天数至少2天'); return; }
      _loadCfg(CDKEY, function (list) {
        /* Codex查bug#11：唯一 id，防同毫秒 createdAt 撞车误删 */
        list.push({
          id: 'cd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          title: t,
          date: d,
          mode: draft.mode,
          period: draft.mode === 'cycle' ? draft.period : 0,
          related: draft.related.slice(),
          relatedNames: draft.relatedNames.slice(),
          knowers: draft.knowers.slice(),
          knowerNames: draft.knowerNames.slice(),
          createdAt: Date.now()
        });
        _saveCfg(CDKEY, list);
        cdTitle.value = '';
        cdDate.value = '';
        /* 车票贴完清空草稿：下一张不继承上一张的模式/人物（Codex#4） */
        draft = { mode: 'none', period: 100, related: [], knowers: [], relatedNames: [], knowerNames: [] };
        modeRow.querySelectorAll('.tb-cd-chip').forEach(function (x, i) { x.classList.toggle('tb-cd-chip-on', i === 0); });
        cycleRow.style.display = 'none';
        periodInput.value = '100';
        if (relRow._renderPeople) relRow._renderPeople();
        if (knRow._renderPeople) knRow._renderPeople();
        renderCds();
        _toast('车票贴好啦');
      });
    });
    renderCds();

    /* ============ 下半 · 年龄时钟 ============ */
    body.appendChild(_el('div', 'tb-card-title', '年龄时钟 · 此刻的TA几岁'));
    var chipRow = _el('div', 'tb-age-chips');
    var ageBox = _el('div', 'tb-age-clock');
    body.appendChild(chipRow);
    body.appendChild(ageBox);

    var picked = null;
    var _ageReq = 0;   /* 连点防乱序回填（Codex#5） */

    function renderAge() {
      var req = ++_ageReq;
      ageBox.innerHTML = '';
      if (!picked) {
        ageBox.appendChild(_el('div', 'tb-empty-hint', '选一位角色，看看TA此刻的年龄'));
        return;
      }
      _loadCfg(BDKEY, function (list) {
        if (req !== _ageReq) return;
        var key = picked.id != null ? String(picked.id) : (picked.name || '');
        var rec = null;
        list.forEach(function (x) { if (String(x.charId) === key) rec = x; });
        var face = _el('div', 'tb-age-face');
        var num = _el('div', 'tb-age-num', '--');
        var unit = _el('div', 'tb-age-unit', '');
        var sub = _el('div', 'tb-age-sub', '');
        if (rec && rec.birthday) {
          var nowTs = TW && TW.getNow ? TW.getNow() : Date.now();
          var a = _ageOf(rec.birthday, nowTs);
          if (!a) {
            num.textContent = '--';
            unit.textContent = '生日无效';
            sub.textContent = '重新贴一张生日车票';
          } else if (a.years < 0) {
            num.textContent = '--';
            unit.textContent = '还没出生';
            sub.textContent = 'TA 在 ' + a.birthYear + ' 年来到这个世界';
          } else {
            num.textContent = String(a.years);
            unit.textContent = '岁 ' + a.months + ' 个月';
            sub.textContent = a.nextDays === 0 ? '今天就是TA的生日' : '距离生日还有 ' + a.nextDays + ' 天';
          }
        } else {
          num.textContent = '--';
          unit.textContent = '未设生日';
          sub.textContent = '在下面贴上TA的生日车票';
        }
        face.appendChild(num);
        face.appendChild(unit);
        ageBox.appendChild(face);
        ageBox.appendChild(sub);
        var bdRow = _el('div', 'tb-age-bd-row');
        var bdInput = _el('input', 'tb-ticket-year tb-cd-date tb-date-pick');
        bdInput.readOnly = true;
        bdInput.placeholder = '选生日';
        if (rec && rec.birthday) bdInput.value = rec.birthday;
        bdInput.addEventListener('click', function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          if (window._tbOpenDateWheel) window._tbOpenDateWheel(bdInput.value || '', function (ds) {
            bdInput.value = ds;
          });
        });
        var bdBtn = _el('button', 'tb-cd-btn', '记住生日');
        bdBtn.addEventListener('click', function () {
          if (!bdInput.value) { _toast('选个生日日期'); return; }
          _loadCfg(BDKEY, function (l2) {
            var item = { charId: key, name: picked.name || '角色', birthday: bdInput.value };
            var idx = -1;
            l2.forEach(function (x, i) { if (String(x.charId) === key) idx = i; });
            if (idx >= 0) l2[idx] = item; else l2.push(item);
            _saveCfg(BDKEY, l2);
            _toast('记住啦，年龄时钟开始走');
            renderAge();
          });
        });
        bdRow.appendChild(bdInput);
        bdRow.appendChild(bdBtn);
        ageBox.appendChild(bdRow);
      });
    }

    (async function () {
      var chars = [];
      try {
        if (window.db && window.db.characters) chars = await window.db.characters.toArray();
        else if (window._characters) chars = window._characters;
      } catch (e) {}
      charsCache = chars || [];
      /* 相关人/知道的人 + 年龄时钟共用同一份角色档案 */
      if (relRow._renderPeople) relRow._renderPeople();
      if (knRow._renderPeople) knRow._renderPeople();
      if (!charsCache.length) {
        chipRow.appendChild(_el('div', 'tb-empty-hint', '角色档案还是空的'));
        renderAge();
        return;
      }
      charsCache.slice(0, 12).forEach(function (ch) {
        var chip = _el('button', 'tb-age-chip');
        var av = _el('div', 'tb-age-chip-av');
        if (ch.avatar) {
          av.style.backgroundImage = 'url(' + ch.avatar + ')';
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
        }
        chip.appendChild(av);
        chip.appendChild(_el('div', 'tb-age-chip-name', ch.name || '角色'));
        chip.addEventListener('click', function () {
          chipRow.querySelectorAll('.tb-age-chip').forEach(function (x) { x.classList.remove('tb-age-chip-on'); });
          chip.classList.add('tb-age-chip-on');
          picked = ch;
          renderAge();
        });
        chipRow.appendChild(chip);
      });
      renderAge();
    })();
  }

  window._tbCh5 = buildCh5;
  /* AI 认知导出（callAI 注入用）——晚赋值防幽灵函数 */
  window.TimeDiary = {
    getAIBrief: getAIBrief,
    cdState: _cdState,
    ageOf: _ageOf
  };
})();
