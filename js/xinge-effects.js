/* ============================================================
   xinge-effects.js · B11 效果编排卷
   打字机 / 情绪滑杆 / 时间滚轮 / 蜡丸开关 / 邮戳盖章 /
   划掉收线 / 涟漪 / 长按浮菜单 / 文案轮播 / 进度线 /
   字体加载 / 信件导出导入
   挂载：window.Xinge.effects（须在 xinge.js 之后加载）
   铁律：时间走 TimeWorld；定时器入 later/after 登记；双降级尊重 xg-motion-low
   ============================================================ */
(function () {
  'use strict';

  if (!window.Xinge) {
    console.warn('[xinge-effects] xinge.js 未加载，效果卷放弃挂载');
    return;
  }
  var Xinge = window.Xinge;
  var effects = {};

  var MOTION_OFF = function () {
    return document.body.classList.contains('xg-motion-low') ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  /* ============================================================
     E1. 打字机（逐字 + 光标；文案轮播共用）
     ============================================================ */
  effects.typewriter = function (el, text, opts) {
    opts = opts || {};
    var speed = opts.speed || 65;          // 每字 ms
    var done = opts.done || function () {};
    if (!el) { done(); return { stop: function () {} }; }
    var stopped = false;
    el.innerHTML = '<span class="xg-type-text"></span><span class="xg-caret"></span>';
    var box = el.querySelector('.xg-type-text');
    if (MOTION_OFF()) {
      box.textContent = text;
      done();
      return { stop: function () {} };
    }
    var chars = Array.from(String(text));
    var i = 0;
    (function step() {
      if (stopped) return;
      if (i >= chars.length) {
        done();
        return;
      }
      box.textContent += chars[i++];
      setTimeout(step, speed);
    })();
    return {
      stop: function () { stopped = true; }
    };
  };

  /* 文案轮播（P5：打字→停留→上移淡出→下一句） */
  effects.lineLoop = function (el, lines, opts) {
    opts = opts || {};
    var hold = opts.hold || 1900;   // 每句停留
    var idx = 0;
    var current = null;
    var stopped = false;
    function next() {
      if (stopped || !el || !el.isConnected) return;
      var line = lines[idx % lines.length];
      idx++;
      current = effects.typewriter(el, line, {
        speed: opts.speed || 65,
        done: function () {
          if (stopped) return;
          setTimeout(function () {
            if (stopped || !el || !el.isConnected) return;
            if (MOTION_OFF()) {
              el.innerHTML = '';
              next();
              return;
            }
            el.classList.add('is-leaving');
            setTimeout(function () {
              el.classList.remove('is-leaving');
              el.innerHTML = '';
              next();
            }, 500);
          }, hold);
        }
      });
    }
    next();
    return {
      stop: function () {
        stopped = true;
        if (current) current.stop();
        if (el) el.innerHTML = '';
      }
    };
  };

  /* ============================================================
     E2. 情绪滑杆（pointer 拖拽 + 键盘步进）
     ============================================================ */
  effects.bindMood = function (wrap, onChange) {
    if (!wrap) return;
    var track = wrap.querySelector('.xg-mood-track-wrap');
    var knob = wrap.querySelector('.xg-mood-knob');
    var valEl = wrap.querySelector('.xg-mood-val');
    if (!track || !knob) return;
    var value = 50; // 0-100
    function render() {
      knob.style.left = value + '%';
      if (valEl) valEl.textContent = value;
      if (onChange) onChange(value);
    }
    function posToValue(clientX) {
      var r = track.getBoundingClientRect();
      var v = Math.round(((clientX - r.left) / r.width) * 100);
      return Math.max(0, Math.min(100, v));
    }
    var dragging = false;
    track.addEventListener('pointerdown', function (e) {
      dragging = true;
      knob.classList.add('is-drag');
      track.setPointerCapture && track.setPointerCapture(e.pointerId);
      value = posToValue(e.clientX);
      render();
      e.preventDefault();
    });
    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      value = posToValue(e.clientX);
      render();
    });
    function endDrag() {
      dragging = false;
      knob.classList.remove('is-drag');
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.setAttribute('tabindex', '0');
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        value = Math.max(0, value - 5); render(); e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        value = Math.min(100, value + 5); render(); e.preventDefault();
      }
    });
    render();
  };

  /* ============================================================
     E3. 时间滚轮（滚动吸附 + 拖拽 + 选中回调）
     ============================================================ */
  effects.bindWheel = function (wheelEl, values, onChange) {
    if (!wheelEl || !values || !values.length) return;
    var listEl = wheelEl.querySelector('.xg-wheel-list');
    if (!listEl) return;
    var ITEM_H = 32;
    var sel = 0;
    // 渲染项
    listEl.innerHTML = values.map(function (v) {
      return '<div class="xg-wheel-item">' + v + '</div>';
    }).join('');
    var items = listEl.querySelectorAll('.xg-wheel-item');
    function render(anim) {
      listEl.style.transition = (anim && !MOTION_OFF()) ? 'transform 0.22s var(--xg-ease-out)' : 'none';
      listEl.style.transform = 'translateY(' + (-sel * ITEM_H) + 'px)';
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-sel', i === sel);
      }
      if (onChange) onChange(values[sel], sel);
    }
    // 滚轮 / 拖拽
    var startY = null;
    wheelEl.addEventListener('pointerdown', function (e) {
      startY = e.clientY;
      wheelEl.setPointerCapture && wheelEl.setPointerCapture(e.pointerId);
    });
    wheelEl.addEventListener('pointermove', function (e) {
      if (startY === null) return;
      var dy = e.clientY - startY;
      if (Math.abs(dy) >= ITEM_H) {
        var steps = Math.trunc(dy / ITEM_H);
        sel = Math.max(0, Math.min(values.length - 1, sel - steps));
        startY += steps * ITEM_H;
        render(false);
      }
    });
    function endDrag() {
      if (startY !== null) render(true);
      startY = null;
    }
    wheelEl.addEventListener('pointerup', endDrag);
    wheelEl.addEventListener('pointercancel', endDrag);
    wheelEl.addEventListener('wheel', function (e) {
      sel = Math.max(0, Math.min(values.length - 1, sel + (e.deltaY > 0 ? 1 : -1)));
      render(true);
      e.preventDefault();
    }, { passive: false });
    // 点选
    listEl.addEventListener('click', function (e) {
      var t = e.target.closest('.xg-wheel-item');
      if (!t) return;
      sel = Array.prototype.indexOf.call(items, t);
      render(true);
    });
    render(false);
    return {
      setValue: function (v) {
        var i = values.indexOf(v);
        if (i >= 0) { sel = i; render(true); }
      },
      getValue: function () { return values[sel]; }
    };
  };

  /* ============================================================
     E4. 蜡丸开关（状态 + 振动反馈 + 双态回调）
     ============================================================ */
  effects.bindWax = function (btn, onToggle) {
    if (!btn) return;
    btn.setAttribute('role', 'switch');
    function sync() {
      btn.setAttribute('aria-checked', btn.classList.contains('is-on') ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      btn.classList.toggle('is-on');
      sync();
      if (navigator.vibrate && !MOTION_OFF()) {
        try { navigator.vibrate(8); } catch (e) { /* 忽略 */ }
      }
      if (onToggle) onToggle(btn.classList.contains('is-on'));
    });
    sync();
    return {
      set: function (on) {
        btn.classList.toggle('is-on', !!on);
        sync();
      },
      get: function () { return btn.classList.contains('is-on'); }
    };
  };

  /* ============================================================
     E5. 邮戳盖章（咚盖 + 墨洇；R1 顶区）
     ============================================================ */
  effects.stampPostmark = function (zoneEl) {
    if (!zoneEl) return;
    var stamp = zoneEl.querySelector('.xg-postmark-stamp');
    if (!stamp) return;
    stamp.classList.remove('is-stamping');
    // 重启动画
    void stamp.offsetWidth;
    stamp.classList.add('is-stamping');
    setTimeout(function () { stamp.classList.remove('is-stamping'); }, 900);
  };

  /* ============================================================
     E6. 划掉收线（段落级：点段收线/恢复；全局：多米诺）
     ============================================================ */
  effects.bindStrikethrough = function (pageEl) {
    if (!pageEl) return;
    pageEl.addEventListener('click', function (e) {
      var para = e.target.closest('.xg-letter-para.is-struck');
      if (!para) return;
      para.classList.add('is-unstriking');
      setTimeout(function () {
        para.classList.remove('is-struck', 'is-unstriking', 'is-unsure');
        para.classList.add('is-restored');
      }, MOTION_OFF() ? 10 : 420);
    });
  };
  effects.toggleStrikesGlobal = function (pageEl) {
    if (!pageEl) return;
    var hidden = pageEl.classList.toggle('is-hidden-strike');
    return hidden; // true=横线已隐藏
  };

  /* ============================================================
     E7. 涟漪（给按钮/卡片挂水波）
     ============================================================ */
  effects.bindRipple = function (hostEl) {
    if (!hostEl) return;
    hostEl.classList.add('xg-ripple-host');
    hostEl.addEventListener('pointerdown', function (e) {
      if (MOTION_OFF()) return;
      var r = hostEl.getBoundingClientRect();
      var d = Math.max(r.width, r.height);
      var rip = document.createElement('span');
      rip.className = 'xg-ripple';
      rip.style.width = rip.style.height = d + 'px';
      rip.style.left = (e.clientX - r.left - d / 2) + 'px';
      rip.style.top = (e.clientY - r.top - d / 2) + 'px';
      hostEl.appendChild(rip);
      setTimeout(function () { rip.remove(); }, 600);
    });
  };

  /* ============================================================
     E8. 长按浮操作菜单（收藏盖章 / 删除折纸）
     ============================================================ */
  var _floatMenu = null;
  effects.closeFloatMenu = function () {
    if (_floatMenu) {
      _floatMenu.remove();
      _floatMenu = null;
    }
  };
  effects.openFloatMenu = function (x, y, actions) {
    effects.closeFloatMenu();
    var menu = document.createElement('div');
    menu.className = 'xg-float-menu';
    menu.innerHTML = actions.map(function (a, i) {
      return (a.sep ? '<div class="xg-float-sep"></div>' : '') +
        '<button class="xg-float-item' + (a.danger ? ' is-danger' : '') + '" data-xg-fi="' + i + '">' +
        '<span class="xg-float-ic">' + (a.iconHtml || '') + '</span>' +
        '<span>' + a.label + '</span></button>';
    }).join('');
    document.body.appendChild(menu);
    // 视口内定位
    var mw = menu.offsetWidth, mh = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - mw - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - mh - 8)) + 'px';
    menu.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-xg-fi]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-xg-fi'), 10);
      effects.closeFloatMenu();
      if (actions[idx] && actions[idx].onPick) actions[idx].onPick();
    });
    _floatMenu = menu;
    setTimeout(function () {
      document.addEventListener('click', function off(ev) {
        if (_floatMenu && !_floatMenu.contains(ev.target)) {
          effects.closeFloatMenu();
        }
        document.removeEventListener('click', off);
      });
    }, 0);
    return menu;
  };
  /* 收藏盖章小动作 */
  effects.sealStampOn = function (hostEl) {
    if (!hostEl || MOTION_OFF()) return;
    var s = document.createElement('div');
    s.className = 'xg-seal-stamp-anim';
    hostEl.appendChild(s);
    setTimeout(function () { s.remove(); }, 800);
  };

  /* ============================================================
     E9. 进度线（定值/不定值）
     ============================================================ */
  effects.setProgress = function (wrapEl, pct) {
    if (!wrapEl) return;
    var fill = wrapEl.querySelector('.xg-progress-fill');
    if (!fill) return;
    wrapEl.classList.remove('is-indet');
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
  };
  effects.setIndeterminate = function (wrapEl) {
    if (!wrapEl) return;
    wrapEl.classList.add('is-indet');
    var fill = wrapEl.querySelector('.xg-progress-fill');
    if (fill) fill.style.width = '';
  };

  /* ============================================================
     E10. 字体加载就绪检查（题字未到不闪宋体）
     ============================================================ */
  effects.fontsReady = function (cb) {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { cb(true); });
    } else {
      setTimeout(function () { cb(false); }, 120);
    }
  };

  /* ============================================================
     E11. 信件导出 / 导入（S7 数据管理）
     ============================================================ */
  effects.exportLetters = function () {
    return Xinge.data.loadLetters().then(function (list) {
      var payload = {
        app: 'xinge',
        version: 1,
        exportedAt: Xinge.data.nowTs(),
        realExportedAt: Date.now(),
        letters: list
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'xinge-letters-' + Xinge.data.nowTs() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 400);
      return list.length;
    });
  };
  effects.importLetters = function (file, onProgress) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var data = JSON.parse(String(reader.result));
          if (!data || data.app !== 'xinge' || !Array.isArray(data.letters)) {
            reject(new Error('不是信格导出文件'));
            return;
          }
          var list = data.letters;
          var done = 0;
          (function next() {
            if (done >= list.length) { resolve(list.length); return; }
            var l = list[done++];
            // 导入件保留原 createdAt；补 fresh realCreatedAt（INSERT 语义）
            delete l.id;
            l.realCreatedAt = Date.now();
            Xinge.data.saveLetter(l).then(function () {
              if (onProgress) onProgress(done, list.length);
              next();
            }).catch(function () { next(); }); // 单条失败不断全批
          })();
        } catch (e) {
          reject(e);
        }
      };
      reader.onerror = function () { reject(reader.error || new Error('读文件失败')); };
      reader.readAsText(file);
    });
  };

  /* ============================================================
     E12. 生成舞台编排（P5：打字机轮播 + 进度 + 写字描边）
     ============================================================ */
  effects.runComposeStage = function (pageEl) {
    if (!pageEl) return { stop: function () {} };
    var lineEl = pageEl.querySelector('.xg-p5-line');
    var writeSvg = pageEl.querySelector('.xg-p5-write-svg');
    var progressEl = pageEl.querySelector('.xg-progress');
    var lines = [
      '正在斟酌字句…',
      '翻了翻记忆…',
      '墨迹未干…',
      '封缄中…'
    ];
    if (writeSvg) {
      writeSvg.classList.remove('is-writing');
      void writeSvg.offsetWidth;
      writeSvg.classList.add('is-writing');
    }
    var loop = effects.lineLoop(lineEl, lines, { speed: 62, hold: 1750 });
    var pct = 6;
    var timer = setInterval(function () {
      pct = Math.min(92, pct + 4 + Math.random() * 6);
      effects.setProgress(progressEl, pct);
    }, 620);
    return {
      stop: function () {
        loop.stop();
        clearInterval(timer);
        if (writeSvg) writeSvg.classList.remove('is-writing');
      },
      finish: function () {
        effects.setProgress(progressEl, 100);
      }
    };
  };

  /* ============================================================
     E13. 拆信分拍驱动（A0–A9 编排；供 xinge.js 的 driveUnseal 调用）
     ============================================================ */
  effects.playUnseal = function (root, onDone) {
    if (!root) { if (onDone) onDone(); return; }
    if (MOTION_OFF()) {
      if (onDone) setTimeout(onDone, 10);
      return;
    }
    var beats = [
      ['xg-p0-press', 550],
      ['xg-p1-lift', 950],
      ['xg-p2-pull', 1050],
      ['xg-p3-spread', 850],
      ['xg-p4-flatten', 700]
    ];
    var i = 0;
    (function beat() {
      if (i >= beats.length) {
        if (onDone) onDone();
        return;
      }
      var b = beats[i++];
      root.classList.add(b[0]);
      setTimeout(function () {
        root.classList.remove(b[0]);
        beat();
      }, b[1]);
    })();
  };

  /* 挂载 */
  Xinge.effects = effects;
})();
