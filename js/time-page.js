/**
 * time-page.js — 虚拟时间 UI 全交互层 v2.0
 * 按 task4-design-spec.md §1/§2/§4 施工（图纸为唯一施工依据，类名前缀 tw-）
 * ============================================================
 * 文件定位：悬浮球+快捷抽屉+全屏页全部交互。样式在 css/time-page.css。
 * 依赖：time.js (window.TimeWorld)、db.js（可无）
 * 铁律：交互里的时间一律走 TimeWorld；机制节流（长按连拨/拖拽/跳秒定时器）用真实时间
 */
window.showTimePage = async function () {          // 入口函数铁律（第一行）
  'use strict';
  if (document.getElementById('tw-page')) return;
  // P0-1 修：入口在 IIFE 外解析不到 _openFullPage，改走导出面（闭包链断点）
  if (window.TimePage && window.TimePage.openFullPage) window.TimePage.openFullPage();
  else console.warn('[TimePage] TimePage 未就绪');
};

(function () {
  'use strict';

  var TW = null;
  var BALL_POS_KEY = 'tw_ball_pos';

  /* ================= 工具 ================= */
  function _el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function _p2(n) { return (n < 10 ? '0' : '') + n; }

  function _fmtClock(ts) {   // HH:MM:SS 跳秒大字
    var d = new Date(ts);
    return _p2(d.getHours()) + ':' + _p2(d.getMinutes()) + ':' + _p2(d.getSeconds());
  }

  /* 行数令⑦：逐位翻牌——数字位变化时挂滚动类（CSS 配合 keyframes） */
  function _flipTo(el, newText) {
    var oldText = el.textContent;
    if (oldText === newText) return;
    var oldChars = oldText.split('');
    var newChars = newText.split('');
    var html = '';
    for (var i = 0; i < newChars.length; i++) {
      if (oldChars[i] !== newChars[i]) {
        html += '<span class="tw-clock-flip-digit roll">' + newChars[i] + '</span>';
      } else {
        html += '<span class="tw-clock-flip-digit">' + newChars[i] + '</span>';
      }
    }
    el.innerHTML = html;
  }

  function _fmtRealLine(ts) {   // "现实 2026年10月4日 14:35"
    var d = new Date(ts);
    return '现实 ' + d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + _p2(d.getHours()) + ':' + _p2(d.getMinutes());
  }

  /* 行数令⑨：防抖护栏 */
  var _toastTimer = null;
  function _toast(msg) {
    if (_toastTimer) clearTimeout(_toastTimer);
    var old = document.getElementById('tw-toast');
    if (old) old.remove();
    var t = _el('div', 'tw-toast show', msg);   // CSS 契约：.tw-toast.show
    t.id = 'tw-toast';
    document.body.appendChild(t);
    _toastTimer = setTimeout(function () { t.classList.add('tw-fade-out'); }, 1200);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 1500);
  }

  /* 二次确认弹窗（毛玻璃，图纸 §4 危险区） */
  function _confirm(msg, onOk) {
    var mask = _el('div', 'tw-dialog-mask');
    var box = _el('div', 'tw-dialog');
    box.appendChild(_el('div', 'tw-dialog-text', msg));
    var btns = _el('div', 'tw-dialog-btns');
    var cancel = _el('button', 'tw-dialog-cancel', '取消');
    var ok = _el('button', 'tw-dialog-ok', '确定');
    cancel.addEventListener('click', function () { mask.remove(); });
    ok.addEventListener('click', function () { mask.remove(); onOk(); });
    btns.appendChild(cancel); btns.appendChild(ok);
    box.appendChild(btns);
    mask.appendChild(box);
    mask.addEventListener('click', function (e) { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
  }

  /* 跳秒时钟控制器（页面隐藏时暂停——机制节流） */
  function _startTicks(render) {
    var timer = setInterval(function () {
      if (document.hidden) return;
      render();
    }, 1000);
    return function () { clearInterval(timer); };
  }

  /* ================= §1 球状悬浮球 ================= */
  function _mountBall() {
    TW = TW || window.TimeWorld;   // P1-3 修：就绪守卫
    if (!TW || typeof TW.getNow !== 'function') {
      _toast('时间引擎未就绪，请刷新重试');
      return;
    }
    if (document.getElementById('tw-ball')) return;
    var ball = _el('div', 'tw-ball' + (TW.isEnabled() ? '' : ' is-off'));   // CSS 契约：.tw-ball.is-off
    ball.id = 'tw-ball';
    /* 图案子件（图纸§1：纯 CSS 绘制件）[v6.2.4] */
    var _art = _el('div', 'tw-ball-art');
    _art.appendChild(_el('div', 'tw-ball-dial'));
    _art.appendChild(_el('div', 'tw-ball-moon'));
    _art.appendChild(_el('div', 'tw-ball-star'));
    ball.appendChild(_el('div', 'tw-ball-glow'));
    ball.appendChild(_el('div', 'tw-ball-sweep'));
    ball.appendChild(_art);
    ball.appendChild(_el('div', 'tw-ball-dot'));
    ball.appendChild(_el('div', 'tw-ball-ripple'));
    /* 行数令⑥：无障碍 */
    ball.setAttribute('role', 'button');
    ball.setAttribute('aria-label', '虚拟时间快捷面板');
    document.body.appendChild(ball);

    /* 位置恢复（图纸：localStorage tw_ball_pos） */
    try {
      /* P3-② 通道统一 db.config（回调式，_mountBall 非 async） */
      function _applyPos(saved) {
        if (saved && saved.left != null) {
          ball.style.left = saved.left + 'px';
          ball.style.top = saved.top + 'px';
          ball.style.right = 'auto';
          ball.style.bottom = 'auto';
        }
      }
      try {
        if (window.db && window.db.config) {
          window.db.config.get('tw_ball_pos').then(function (r) {
            // P2-9 修：miss 也落兜底（旧 localStorage 位置迁移不丢）
            if (r && r.value != null) _applyPos(r.value);
            else { try { _applyPos(JSON.parse(localStorage.getItem(BALL_POS_KEY) || 'null')); } catch (e2) {} }
          }).catch(function () {
            try { _applyPos(JSON.parse(localStorage.getItem(BALL_POS_KEY) || 'null')); } catch (e2) {}
          });
        } else {
          try { _applyPos(JSON.parse(localStorage.getItem(BALL_POS_KEY) || 'null')); } catch (e2) {}
        }
      } catch (e) {}
    } catch (e) {}

    /* 拖拽（阈值 8px 区分点击 vs 拖拽；松手贴边吸附 260ms ease-out） */
    var startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false, moved = false;
    function _down(x, y) {
      var rect = ball.getBoundingClientRect();
      startX = x; startY = y; startLeft = rect.left; startTop = rect.top;
      dragging = true; moved = false;
      ball.style.transition = 'none';
    }
    function _move(x, y) {
      if (!dragging) return;
      var dx = x - startX, dy = y - startY;
      if (!moved && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      moved = true;
      ball.style.left = (startLeft + dx) + 'px';
      ball.style.top = (startTop + dy) + 'px';
      ball.style.right = 'auto';
      ball.style.bottom = 'auto';
    }
    function _up() {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        /* 贴边吸附：左/右最近边 */
        var rect = ball.getBoundingClientRect();
        var toLeft = rect.left < window.innerWidth / 2;
        ball.style.transition = 'left .26s ease-out, top .26s ease-out';
        ball.style.left = toLeft ? '18px' : (window.innerWidth - 56 - 18) + 'px';
        try {
          var pos = { left: toLeft ? 18 : window.innerWidth - 56 - 18, top: rect.top };
          if (window.db && window.db.config) window.db.config.put({ key: 'tw_ball_pos', value: pos });   // P3-②
          else localStorage.setItem(BALL_POS_KEY, JSON.stringify(pos));
        } catch (e) {}
      }
    }
    ball.addEventListener('touchstart', function (e) { _down(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    ball.addEventListener('touchmove', function (e) { _move(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    ball.addEventListener('touchend', function () {
      _up();
      if (moved) return;
      _lastTouchTs = Date.now();   // P1-4：记触屏时刻防合成 click 互踩
      if (_dblTimer) { clearTimeout(_dblTimer); _dblTimer = null; return; }
      _dblTimer = setTimeout(function () { _dblTimer = null; _openSheet(); }, 260);
    });
    ball.addEventListener('mousedown', function (e) { _down(e.clientX, e.clientY); });
    var _docMove = function (e) { _move(e.clientX, e.clientY); };
    var _docUp = function () { _up(); };
    document.addEventListener('mousemove', _docMove);
    document.addEventListener('mouseup', _docUp);
    ball._docCleanup = function () {   // P3-⑥ unmount 清理
      document.removeEventListener('mousemove', _docMove);
      document.removeEventListener('mouseup', _docUp);
    };
    var _dblTimer = null;
    var _lastTouchTs = 0;
    ball.addEventListener('click', function () {
      if (moved) return;
      if (Date.now() - _lastTouchTs < 500) return;   // P1-4：触屏后合成 click 直接让位
      if (_dblTimer) { clearTimeout(_dblTimer); _dblTimer = null; return; }
      _dblTimer = setTimeout(function () { _dblTimer = null; _openSheet(); }, 260);
    });
    /* 行数令①：双击=一键回到现在 */
    ball.addEventListener('dblclick', function (e) {
      e.preventDefault();
      if (_dblTimer) { clearTimeout(_dblTimer); _dblTimer = null; }
      TW.reset();
      _toast('已回到现实时间');
    });

    /* 球体开关（engine 变化同步外观）——P2-7 挂 _onChangeOff 回收 */
    ball._onChangeOff = TW.onChange(function (snap) {
      ball.classList.toggle('on', snap.enabled);
    });
  }

  function _unmountBall() {
    var b = document.getElementById('tw-ball');
    if (b) {
      if (b._docCleanup) b._docCleanup();   // P3-⑥
      if (b._onChangeOff) b._onChangeOff();   // P2-7
      b.classList.add('hiding');
      setTimeout(function () { b.remove(); }, 180);   // 180ms 缩小淡出（图纸 §1）
    }
  }

  /* ================= §2 快捷抽屉（tw-sheet） ================= */
  function _openSheet() {
    TW = TW || window.TimeWorld;   // P1-3 修：就绪守卫
    if (!TW || typeof TW.getNow !== 'function') {
      _toast('时间引擎未就绪，请刷新重试');
      return;
    }
    if (document.getElementById('tw-sheet')) return;
    var mask = _el('div', 'tw-sheet-mask');
    var sheet = _el('div', 'tw-sheet');
    sheet.id = 'tw-sheet';

    /* 1 把手条 */
    sheet.appendChild(_el('div', 'tw-sheet-handle'));

    /* 2 标题行 */
    var titleRow = _el('div', 'tw-sheet-title');
    titleRow.appendChild(_el('div', 'tw-sheet-title', '虚拟时间'));
    var closeBtn = _el('button', 'tw-sheet-close', '×');
    closeBtn.addEventListener('click', function () { stopTicks(); mask.remove(); });
    titleRow.appendChild(closeBtn);
    sheet.appendChild(titleRow);

    /* 3 大字时钟 */
    var clockBox = _el('div', 'tw-flip-wrap');
    var clock = _el('div', 'tw-clock-big', TW && TW.getNow ? _fmtClock(TW.getNow()) : '--:--:--');   // P3-⑦
    clockBox.appendChild(clock);
    var realTag = _el('div', 'tw-reality-tag', '现实时间');
    realTag.style.display = TW.isEnabled() ? 'none' : '';
    clockBox.appendChild(realTag);
    sheet.appendChild(clockBox);

    /* 4 现实对照小字 */
    var realLine = _el('div', 'tw-reality-line', _fmtRealLine(Date.now()));
    sheet.appendChild(realLine);
    var vDayLine = _el('div', 'tw-virtual-today', '虚拟今天 ' + TW.getDayString());
    vDayLine.style.display = TW.isEnabled() ? '' : 'none';
    sheet.appendChild(vDayLine);

    /* 5 总开关行 */
    var swRow = _el('div', 'tw-switch-row');
    var swTexts = _el('div', 'tw-switch-info');
    swTexts.appendChild(_el('div', 'tw-switch-title', '启用虚拟时间'));
    swTexts.appendChild(_el('div', 'tw-switch-sub', '记忆·朋友圈·短信·日程全部跟随虚拟时间'));
    swRow.appendChild(swTexts);
    var sw = _el('button', 'tw-switch' + (TW.isEnabled() ? ' on' : ''));
    sw.addEventListener('click', function () {
      var next = !TW.isEnabled();
      TW.setEnabled(next);
      sw.classList.toggle('on', next);
      realTag.style.display = next ? 'none' : '';
      vDayLine.style.display = next ? '' : 'none';
      if (next) vDayLine.textContent = '虚拟今天 ' + TW.getDayString();
      clock.classList.add('tw-flip-wrap');   // 翻牌动画 300ms
      setTimeout(function () { clock.classList.remove('tw-flip-wrap'); }, 300);
      _toast(next ? '虚拟时间已开启' : '虚拟时间已关闭（偏移保留）');
    });
    swRow.appendChild(sw);
    sheet.appendChild(swRow);

    /* 6 快捷四宫格（2×2，56px 格） */
    var grid = _el('div', 'tw-grid4');
    [['+1小时', 3600000, ''], ['+2小时', 7200000, ''], ['+1天', 86400000, ''], ['回到现在', 0, 'tw-danger-btn']].forEach(function (item) {
      var b = _el('button', 'tw-quick-btn ' + item[2], item[0]);
      b.addEventListener('click', function () {
        if (item[1] === 0) {
          TW.reset();
          _toast('已回到现实时间');
        } else {
          TW.addOffset(item[1]);
          _toast('虚拟时间已前进' + item[0].replace('+', ''));
        }
        clock.textContent = _fmtClock(TW.getNow());
        vDayLine.textContent = '虚拟今天 ' + TW.getDayString();
      });
      grid.appendChild(b);
    });
    sheet.appendChild(grid);

    /* 空态引导 */
    if (!TW.getAudit().length) {
      sheet.appendChild(_el('div', 'tw-empty-hint', '试试 +1 小时，看看世界的变化'));
    }

    /* 7 高级设置按钮 */
    var adv = _el('button', 'tw-adv-btn', '高级设置 →');
    adv.addEventListener('click', function () { stopTicks(); mask.remove(); _openFullPage(); });
    sheet.appendChild(adv);

    /* 跳秒 + 现实对照刷新（页面隐藏暂停） */
    var stopTicks = _startTicks(function () {
      _flipTo(clock, _fmtClock(TW.getNow()));
      realLine.textContent = _fmtRealLine(Date.now());
      if (TW.isEnabled()) vDayLine.textContent = '虚拟今天 ' + TW.getDayString();
    });

    /* 下滑关闭（把手条拖拽≥80px 或速度≥0.5px/ms；点遮罩关闭） */
    var dragStartY = 0, dragStartT = 0, sheetDragging = false;
    var handle = sheet.querySelector('.tw-sheet-handle');
    handle.addEventListener('touchstart', function (e) {
      dragStartY = e.touches[0].clientY; dragStartT = Date.now(); sheetDragging = true;
      sheet.style.transition = 'none';
    }, { passive: true });
    handle.addEventListener('touchmove', function (e) {
      if (!sheetDragging) return;
      var dy = e.touches[0].clientY - dragStartY;
      if (dy > 0) sheet.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    handle.addEventListener('touchend', function (e) {
      if (!sheetDragging) return;
      sheetDragging = false;
      var dy = e.changedTouches[0].clientY - dragStartY;
      var v = dy / Math.max(1, Date.now() - dragStartT);
      sheet.style.transition = 'transform .22s ease-out';
      if (dy >= 80 || v >= 0.5) {
        sheet.style.transform = 'translateY(100%)';
        setTimeout(function () { stopTicks(); mask.remove(); }, 220);
      } else {
        sheet.style.transform = '';
      }
    });

    mask.addEventListener('click', function (e) { if (e.target === mask) { stopTicks(); mask.remove(); } });
    mask.appendChild(sheet);
    document.body.appendChild(mask);
  }

  /* ================= §4 全屏高级页（tw-page，七分区） ================= */
  function _openFullPage() {
    TW = TW || window.TimeWorld;   // P1-3 修：就绪守卫
    if (!TW || typeof TW.getNow !== 'function') {
      _toast('时间引擎未就绪，请刷新重试');
      return;
    }
    if (document.getElementById('tw-page')) return;
    var page = _el('div', 'tw-page');
    page.id = 'tw-page';

    /* 导航栏 52px */
    var nav = _el('div', 'tw-nav');
    var back = _el('button', 'tw-nav-back', '‹');
    back.addEventListener('click', function () {
      if (page._stopTicks) page._stopTicks();   // P1-2 修：关页停表
      if (window.closePage) window.closePage('tw-page');
      else page.remove();
    });
    nav.appendChild(back);
    nav.appendChild(_el('div', 'tw-nav-title', '虚拟世界 · 时间设置'));
    nav.appendChild(_el('div', 'tw-hidden'));
    page.appendChild(nav);

    var body = _el('div', 'tw-scroll');

    /* ① 状态头卡片 */
    var s1 = _el('div', 'tw-card');
    var s1row = _el('div', 'tw-status-row');
    s1row.appendChild(_el('div', 'tw-card-title', '虚拟时间引擎'));
    var mainSw = _el('button', 'tw-switch' + (TW.isEnabled() ? ' on' : ''));
    s1row.appendChild(mainSw);
    s1.appendChild(s1row);
    var chips = _el('div', 'tw-badges');
    ['记忆', '朋友圈', '短信', '日程'].forEach(function (name) {
      chips.appendChild(_el('div', 'tw-badge' + (TW.isEnabled() ? ' active' : ''), name));
    });
    s1.appendChild(chips);
    s1.appendChild(_el('div', 'tw-card-sub', '开启后，整个世界的时间以虚拟时钟为准'));
    body.appendChild(s1);

    /* ② 双卡对照 */
    var dual = _el('div', 'tw-dual-wrap');
    var vCard = _el('div', 'tw-dual-card' + (TW.isEnabled() ? '' : ' disabled'));
    vCard.appendChild(_el('div', 'tw-dual-label', '虚拟现在'));
    var vClock = _el('div', 'tw-dual-value', TW && TW.getNow ? _fmtClock(TW.getNow()) : '--:--:--');   // P3-⑦
    vCard.appendChild(vClock);
    var vDate = _el('div', 'tw-dual-sub', TW.getDayString());
    vCard.appendChild(vDate);
    if (!TW.isEnabled()) vCard.appendChild(_el('div', 'tw-dual-off-tag', '已停用'));
    var rCard = _el('div', 'tw-dual-card');
    rCard.appendChild(_el('div', 'tw-dual-label', '现实现在'));
    var rClock = _el('div', 'tw-dual-main', _fmtClock(Date.now()));
    rCard.appendChild(rClock);
    var rDate = _el('div', 'tw-dual-sub', TW.getDayString(Date.now()));
    rCard.appendChild(rDate);
    dual.appendChild(vCard); dual.appendChild(rCard);
    body.appendChild(dual);

    function _refreshDual() {
      vClock.textContent = _fmtClock(TW.getNow());
      vDate.textContent = TW.getDayString();
      vCard.classList.toggle('disabled', !TW.isEnabled());
      rClock.textContent = _fmtClock(Date.now());
      rDate.textContent = TW.getDayString(Date.now());
      chips.querySelectorAll('.tw-badge').forEach(function (c) { c.classList.toggle('active', TW.isEnabled()); });
    }

    /* ③ 日历跳转 */
    var s3 = _el('div', 'tw-card');
    s3.appendChild(_el('div', 'tw-card-title', '跳转到日期'));
    var calHead = _el('div', 'tw-cal-head');
    var prev = _el('button', 'tw-cal-arrow', '‹');
    var calTitle = _el('div', 'tw-cal-title', '');
    var next = _el('button', 'tw-cal-arrow', '›');
    var minusDay = _el('button', 'tw-cal-step', '−1天');
    var plusDay = _el('button', 'tw-cal-step', '+1天');
    calHead.appendChild(prev); calHead.appendChild(minusDay); calHead.appendChild(calTitle); calHead.appendChild(plusDay); calHead.appendChild(next);
    s3.appendChild(calHead);
    var calGrid = _el('div', 'tw-cal-grid');
    s3.appendChild(calGrid);
    var todayBtn = _el('button', 'tw-link-btn', '回到今天');
    s3.appendChild(todayBtn);
    body.appendChild(s3);

    var cursor = new Date(TW.getNow());
    function _renderCal() {
      calGrid.innerHTML = '';
      if (calMode === 'year') {
        calTitle.textContent = cursor.getFullYear() + '年';
        for (var m = 1; m <= 12; m++) {
          (function (month) {
            var cell = _el('div', 'tw-cal-day tw-cal-month-cell', month + '月');
            cell.addEventListener('click', function () {
              cursor.setDate(1);   // P2-1 修：防 31 号选 2 月溢出
              cursor.setMonth(month - 1);
              calMode = 'month';
              _renderCal();
            });
            calGrid.appendChild(cell);
          })(m);
        }
        return;
      }
      calTitle.textContent = cursor.getFullYear() + '年' + (cursor.getMonth() + 1) + '月';
      ['日', '一', '二', '三', '四', '五', '六'].forEach(function (w) {
        calGrid.appendChild(_el('div', 'tw-cal-weekday', w));
      });
      var startDow = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay();
      var days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
      var today = new Date(TW.getNow());
      for (var i = 0; i < startDow; i++) calGrid.appendChild(_el('div', 'tw-cal-day blank', ''));
      for (var d = 1; d <= days; d++) {
        (function (day) {
          var cell = _el('div', 'tw-cal-day', String(day));
          var isToday = today.getFullYear() === cursor.getFullYear() && today.getMonth() === cursor.getMonth() && today.getDate() === day;
          if (isToday) cell.classList.add('today');
          var cellTs = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0).getTime();
          if (Math.abs(cellTs - TW.getNow()) / 86400000 > 30) cell.classList.add('far-future');   // P3-① 未来30天外淡灰
          cell.addEventListener('click', function () {
            var target = new Date(cursor.getFullYear(), cursor.getMonth(), day, 12, 0, 0).getTime();
            /* 未来 30 天外弹确认（图纸 §4③） */
            var diffDays = (target - TW.getNow()) / 86400000;
            var doJump = function () {
              TW.setOffset(target - Date.now());
              TW.audit('jumpTo', '跳到 ' + TW.getFormattedNow());
              _refreshDual();
              _toast('已跳到 ' + TW.getFormattedNow());
            };
            if (diffDays > 30) _confirm('未来日期？确定跳转吗', doJump);
            else if (diffDays < -30) _confirm('很久以前的日期？确定跳转吗', doJump);
            else doJump();
          });
          calGrid.appendChild(cell);
        })(d);
      }
    }
    _renderCal();
    /* 行数令②：年视图切换（点标题月↔年两级） */
    var calMode = 'month';
    calTitle.addEventListener('click', function () {
      calMode = calMode === 'month' ? 'year' : 'month';
      _renderCal();
    });
    prev.addEventListener('click', function () {
      cursor.setDate(1);   // P2-1 修：防 29-31 号溢出串月
      if (calMode === 'year') cursor.setFullYear(cursor.getFullYear() - 1);
      else cursor.setMonth(cursor.getMonth() - 1);
      _renderCal();
    });
    next.addEventListener('click', function () {
      cursor.setDate(1);   // P2-1 修
      if (calMode === 'year') cursor.setFullYear(cursor.getFullYear() + 1);
      else cursor.setMonth(cursor.getMonth() + 1);
      _renderCal();
    });
    minusDay.addEventListener('click', function () { TW.addOffset(-86400000); _refreshDual(); _toast('虚拟时间-1天'); });
    plusDay.addEventListener('click', function () { TW.addOffset(86400000); _refreshDual(); _toast('虚拟时间+1天'); });
    todayBtn.addEventListener('click', function () { TW.reset(); _refreshDual(); _toast('已回到现实时间'); });

    /* ④ 精确调整（时/分/秒 stepper，长按 500ms 后 120ms 连拨） */
    var s4 = _el('div', 'tw-card');
    s4.appendChild(_el('div', 'tw-card-title', '精确调整'));
    var steppers = _el('div', 'tw-step-row');
    [['时', 3600000], ['分', 60000], ['秒', 1000]].forEach(function (cfg) {
      var g = _el('div', 'tw-step-group');
      var minus = _el('button', 'tw-step-btn', '−');
      var val = _el('div', 'tw-step-val', cfg[0]);
      var plus = _el('button', 'tw-step-btn', '+');
      g.appendChild(minus); g.appendChild(val); g.appendChild(plus);
      var holdT = null, repT = null;
      function start(dir) {
        if (holdT || repT) return;   // P1-1 修：防重入（touch+mouse 双入口二连）
        TW.addOffset(dir * cfg[1]); _refreshDual();
        holdT = setTimeout(function () {
          repT = setInterval(function () { TW.addOffset(dir * cfg[1]); _refreshDual(); }, 120);
        }, 500);
      }
      function stop() {
        clearTimeout(holdT); clearInterval(repT);
        holdT = repT = null;   // 句柄归零防孤儿
      }
      minus.addEventListener('mousedown', function () { start(-1); });
      plus.addEventListener('mousedown', function () { start(1); });
      minus.addEventListener('touchstart', function () { start(-1); }, { passive: true });
      plus.addEventListener('touchstart', function () { start(1); }, { passive: true });
      ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(function (ev) {
        minus.addEventListener(ev, stop); plus.addEventListener(ev, stop);
      });
      steppers.appendChild(g);
    });
    s4.appendChild(steppers);
    var presets = _el('div', 'tw-presets');
    [['+5分', 300000], ['+30分', 1800000], ['+1时', 3600000], ['-1时', -3600000]].forEach(function (p) {
      var b = _el('button', 'tw-preset-btn', p[0]);
      b.addEventListener('click', function () { TW.addOffset(p[1]); _refreshDual(); _toast('虚拟时间' + p[0]); });
      presets.appendChild(b);
    });
    s4.appendChild(presets);
    body.appendChild(s4);

    /* 行数令③：虚拟时刻收藏点（常去时刻存3个，一键跳） */
    var s3b = _el('div', 'tw-card');
    s3b.appendChild(_el('div', 'tw-card-title', '收藏的虚拟时刻'));
    var favRow = _el('div', 'tw-presets');
    function _renderFavs() {
      favRow.innerHTML = '';
      var favs = [];
      try { favs = JSON.parse(localStorage.getItem('tw_favs') || '[]'); } catch (e) {}
      for (var i = 0; i < 3; i++) {
        (function (idx) {
          var fav = favs[idx];
          var b = _el('button', 'tw-preset-btn', fav ? fav.label : '收藏 ' + (idx + 1) + '（空）');
          if (fav) {
            b.addEventListener('click', function () {
              TW.setOffset(fav.ts - Date.now());
              TW.audit('jumpFav', '跳到收藏：' + fav.label);
              _refreshDual();
              _toast('已跳到 ' + fav.label);
            });
          } else {
            b.addEventListener('click', function () {
              favs[idx] = { label: TW.getFormattedNow(), ts: TW.getNow() };
              localStorage.setItem('tw_favs', JSON.stringify(favs));
              _renderFavs();
              _toast('已收藏当前虚拟时刻');
            });
          }
          favRow.appendChild(b);
        })(i);
      }
    }
    _renderFavs();
    s3b.appendChild(favRow);
    body.appendChild(s3b);

    /* ⑤ 时间流速（segmented control 四档） */
    var s5 = _el('div', 'tw-card');
    s5.appendChild(_el('div', 'tw-card-title', '时间流速'));
    var seg = _el('div', 'tw-seg');
    [[1, '1x（正常）'], [2, '2x'], [10, '10x'], [0, '⏸暂停']].forEach(function (sp) {
      var b = _el('button', 'tw-seg-item' + (TW.getSpeed() === sp[0] ? ' active' : ''), sp[1]);
      b.addEventListener('click', function () {
        TW.setSpeed(sp[0]);
        seg.querySelectorAll('.tw-seg-item').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        _toast('流速 ' + sp[1]);
      });
      seg.appendChild(b);
    });
    s5.appendChild(seg);
    s5.appendChild(_el('div', 'tw-card-sub tw-card-sub',
      '流速影响虚拟时钟推进速度。语义时间（记忆、发帖）跟随虚拟钟；系统节流（防刷屏间隔）按现实时间，不会因快进烧API。'));
    body.appendChild(s5);

    /* ⑥ 生效范围明细 */
    var s6 = _el('div', 'tw-card');
    s6.appendChild(_el('div', 'tw-card-title', '谁跟着虚拟时间'));
    [['记忆系统', '总结、日程、回忆都按虚拟时间记档'],
     ['朋友圈', '自动发帖时间戳'],
     ['匿名短信', '来信时间显示'],
     ['日程提醒', '日程日期计算'],
     ['塔罗', '每日运势日期']].forEach(function (row) {
      var r = _el('div', 'tw-scope-row');
      var left = _el('div', 'tw-scope-text');
      left.appendChild(_el('div', 'tw-scope-name', row[0]));
      left.appendChild(_el('div', 'tw-scope-desc', row[1]));
      r.appendChild(left);
      r.appendChild(_el('div', 'tw-scope-dot' + (TW.isEnabled() ? ' on' : ''), TW.isEnabled() ? '跟随中' : '跟随现实'));
      s6.appendChild(r);
    });
    /* 行数令⑤：时区说明卡 */
    var tzNote = _el('div', 'tw-card-sub tw-card-sub');
    var tzName = '本地时区';
    try { tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || '本地时区'; } catch (e) {}
    tzNote.textContent = '时区说明：所有时间按设备时区（' + tzName + '）显示。虚拟时间在时区内的含义与真实时间一致——切换设备时区时，虚拟时刻保持绝对值不变，仅显示随区调整。';
    s6.appendChild(tzNote);
    body.appendChild(s6);

    /* ⑦ 调整历史（审计链，最大高 260px） */
    var s7 = _el('div', 'tw-card');
    var s7head = _el('div', 'tw-status-row');
    s7head.appendChild(_el('div', 'tw-card-title', '调整历史'));
    var clearBtn = _el('button', 'tw-audit-clear', '清空');
    clearBtn.addEventListener('click', function () {
      _confirm('确定清空调整历史吗', function () {
        TW.clearAudit();
        _renderAudit();
        _toast('调整历史已清空');
      });
    });
    s7head.appendChild(clearBtn);
    /* 行数令④：审计链导出文本 */
    var exportBtn = _el('button', 'tw-audit-clear', '导出');
    exportBtn.addEventListener('click', function () {
      var log = TW.getAudit();
      var text = log.map(function (item) {
        return _fmtClock(item.realTs) + ' [' + item.action + '] ' + (item.detail || '') + ' → 虚拟 ' + TW.getFormattedNow(item.virtualTs);
      }).join('\n');
      try {
        localStorage.setItem('tw_audit_export', text);
        if (navigator.clipboard) navigator.clipboard.writeText(text);
        _toast('审计链已导出（剪贴板+localStorage）');
      } catch (e) { _toast('导出失败：' + e.message); }
    });
    s7head.appendChild(exportBtn);
    s7.appendChild(s7head);
    var auditBox = _el('div', 'tw-audit-list');
    s7.appendChild(auditBox);
    body.appendChild(s7);

    function _renderAudit() {
      auditBox.innerHTML = '';
      var log = TW.getAudit();
      if (!log.length) {
        auditBox.appendChild(_el('div', 'tw-audit-empty', '暂无调整记录'));
        return;
      }
      log.slice().reverse().slice(0, 50).forEach(function (item) {
        var row = _el('div', 'tw-audit-item');
        row.appendChild(_el('div', 'tw-audit-dot'));
        var lines = _el('div', 'tw-audit-body');
        lines.appendChild(_el('div', 'tw-audit-line1', _fmtClock(item.realTs) + ' ' + (item.detail || item.action)));
        lines.appendChild(_el('div', 'tw-audit-line2', '虚拟现在 → ' + TW.getFormattedNow(item.virtualTs)));
        row.appendChild(lines);
        auditBox.appendChild(row);
      });
    }
    _renderAudit();

    /* 底部固定按钮区 */
    var footer = _el('div', 'tw-bottom-bar');
    var backNow = _el('button', 'tw-now-btn', '一键回到现在');
    backNow.addEventListener('click', function () {
      TW.reset();
      _refreshDual();
      _toast('已回到现实时间');
    });
    footer.appendChild(backNow);
    var danger = _el('button', 'tw-danger-btn', '重置全部设置（清空历史·恢复默认）');
    danger.addEventListener('click', function () {
      _confirm('确定重置全部设置吗', function () {
        TW.setEnabled(false);
        TW.setSpeed(1);
        TW.reset();
        TW.clearAudit();
        try {
          localStorage.removeItem('tw_favs'); localStorage.removeItem(BALL_POS_KEY);
          if (window.db && window.db.config) window.db.config.put({ key: 'tw_ball_pos', value: null });   // P2-8 主通道同清
        } catch (e) {}
        mainSw.classList.remove('on');
        seg.querySelectorAll('.tw-seg-item').forEach(function (x, i) { x.classList.toggle('active', i === 0); });
        _refreshDual();
        _renderAudit();
        _toast('虚拟时间已全部重置');
      });
    });
    footer.appendChild(danger);

    /* 总开关联动 */
    mainSw.addEventListener('click', function () {
      var next = !TW.isEnabled();
      TW.setEnabled(next);
      mainSw.classList.toggle('on', next);
      _refreshDual();
      _renderAudit();
      _toast(next ? '虚拟时间已开启' : '虚拟时间已关闭（偏移保留）');
    });

    /* 跳秒（页面隐藏暂停） */
    var stopPageTicks = _startTicks(_refreshDual);
    page._stopTicks = stopPageTicks;

    body.appendChild(footer);   // footer 也进滚动区尾部（sticky 由 CSS 定）
    page.appendChild(body);

    /* 审计链随变更实时追加（offChange 反注册——挂账②） */
    var _offChange = TW.onChange(function () { _renderAudit(); _refreshDual(); });
    back.addEventListener('click', function () {
      if (typeof _offChange === 'function') _offChange();
      if (page._stopTicks) page._stopTicks();
    });

    if (window.openPage) window.openPage(page);
    else document.body.appendChild(page);
  }

  /* ================= 设置页开关行（图纸 §3，挂设置页用） ================= */
  async function getBallVisible() {
    try {
      if (window.db && window.db.config) {
        var r = await window.db.config.get('tw_ball_visible');
        return r ? r.value !== false : true;
      }
      return localStorage.getItem('tw_ball_visible') !== 'false';
    } catch (e) { return true; }
  }

  async function setBallVisible(on) {
    try {
      if (window.db && window.db.config) await window.db.config.put({ key: 'tw_ball_visible', value: !!on });
      else localStorage.setItem('tw_ball_visible', String(!!on));
    } catch (e) {}
    if (on) _mountBall(); else _unmountBall();
  }

  /* ================= 初始化 ================= */
  /* 行数令⑧：主题跟随系统（主人默认亮色，暗色仅跟随不强制） */
  function _syncTheme() {
    try {
      var dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('tw-theme-dark', !!dark);
    } catch (e) {}
  }

  async function init() {
    /* 行数令⑩：空态/错误态全覆盖 */
    _syncTheme();
    try {
      if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _syncTheme);
      }
    } catch (e) {}
    TW = window.TimeWorld;
    if (!TW || typeof TW.getNow !== 'function') {
      console.warn('[TimePage] TimeWorld 未加载或接口异常——降级隐藏球，功能不可用');
      _toast('时间引擎未就绪，请刷新重试');
      return;
    }
    try {
      if (await getBallVisible()) _mountBall();
      console.log('[TimePage] 就绪');
    } catch (e) {
      console.warn('[TimePage] init 异常（db 挂/存储满）:', e);
      _toast('设置读取失败，虚拟时间球暂不可用');
    }
  }

  window.TimePage = {
    openQuickPanel: _openSheet,
    openFullPage: _openFullPage,
    mountBall: _mountBall,
    unmountBall: _unmountBall,
    getBallVisible: getBallVisible,
    setBallVisible: setBallVisible
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 800); });
  } else {
    setTimeout(init, 800);
  }
})();
