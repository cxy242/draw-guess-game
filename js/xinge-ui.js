/* ============================================================
   xinge-ui.js · B13 交互卷
   S2 权限（开关+频率签）/ S3 定时（总开关+频率展开+时间盘+写信人）/
   S5 分段器 / S6 静默时段 / S7 存储+导出+清空 /
   P0 搜索筛选 / P5 失败重试 / 表单校验 / toast 变体 / 长按全接线
   挂载：window.Xinge.ui（xinge.js 与 xinge-effects.js 之后加载）
   ============================================================ */
(function () {
  'use strict';
  if (!window.Xinge) {
    console.warn('[xinge-ui] xinge.js 未加载，交互卷放弃挂载');
    return;
  }
  var Xinge = window.Xinge;
  var F = Xinge.effects || {};
  var ui = {};

  /* ============================================================
     U1. toast 变体（成功/警告/错误/信息；优先用 window.toast 兜底）
     ============================================================ */
  ui.toast = function (text, kind) {
    kind = kind || 'info';
    if (window.toast && kind === 'info') {
      window.toast(text);
      return;
    }
    var old = document.querySelector('.xg-toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'xg-toast t-' + kind + ' xg-toast-in';
    el.innerHTML = '<span class="xg-toast-ic"></span><span>' + text + '</span>';
    document.body.appendChild(el);
    setTimeout(function () {
      el.classList.remove('xg-toast-in');
      el.classList.add('xg-toast-out');
      setTimeout(function () { el.remove(); }, 320);
    }, 2400);
  };

  /* ============================================================
     U2. 表单校验（逐字段 + 汇总条）
     ============================================================ */
  ui.validate = function (formEl, rules) {
    // rules: [{name, selector, required, max, label}]
    if (!formEl) return { ok: false, errors: ['表单缺失'] };
    var errors = [];
    rules.forEach(function (r) {
      var field = formEl.querySelector(r.selector);
      if (!field) return;
      var wrap = field.closest('.xg-field');
      var val = String(field.value || '').trim();
      var bad = false;
      if (r.required && !val) {
        errors.push((r.label || '必填项') + ' 没填');
        bad = true;
      } else if (r.max && val.length > r.max) {
        errors.push((r.label || '内容') + ' 超长（' + val.length + '/' + r.max + '）');
        bad = true;
      }
      if (wrap) wrap.classList.toggle('is-invalid', bad);
      field.classList.toggle('xg-input-err', bad);
    });
    var banner = formEl.querySelector('.xg-form-banner');
    if (banner) {
      if (errors.length) {
        banner.style.display = '';
        banner.textContent = '还差一点：' + errors[0];
      } else {
        banner.style.display = 'none';
      }
    }
    return { ok: errors.length === 0, errors: errors };
  };

  /* ============================================================
     U3. 分段器接线（S5 阅读偏好）
     ============================================================ */
  /* 分段器接线（S5 阅读偏好）
     深检 2026-10-24：原实现只认 .xg-seg-opt / data-xg-seg-val，
     而 xinge.js 的阅读偏好页用的是 .xg-segment / .xg-segment-item / data-xg-pref-opt
     → 两者对不上，本函数成了死代码。现改为两套命名都认，接线即可用。 */
  function segItems(wrap) {
    return wrap.querySelectorAll('.xg-seg-opt, .xg-segment-item');
  }
  function segValue(opt) {
    return opt.getAttribute('data-xg-seg-val') || opt.getAttribute('data-xg-pref-opt');
  }
  ui.bindSeg = function (wrap, onChange) {
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var opt = e.target.closest('.xg-seg-opt, .xg-segment-item');
      if (!opt || !wrap.contains(opt)) return;
      var all = segItems(wrap);
      for (var i = 0; i < all.length; i++) {
        all[i].classList.remove('is-active', 'is-selected');
      }
      opt.classList.add('is-active', 'is-selected');
      if (onChange) onChange(segValue(opt));
    });
    return {
      get: function () {
        var a = wrap.querySelector('.xg-seg-opt.is-active, .xg-segment-item.is-selected, .xg-segment-item.is-active');
        return a ? segValue(a) : null;
      },
      set: function (v) {
        var all = segItems(wrap);
        for (var i = 0; i < all.length; i++) {
          all[i].classList.toggle('is-active', segValue(all[i]) === v);
          all[i].classList.toggle('is-selected', segValue(all[i]) === v);
        }
      }
    };
  };

  /* ============================================================
     U4. S3 定时页：频率签展开（每天/每周/每月/随机）
     深检 2026-10-24：原实现只认 .xg-chip[data-xg-freq]，
     而 xinge.js 的定时页用 data-xg-sfreq → 对不上，成了死代码。
     现两套命名都认，接线即可用。
     ============================================================ */
  ui.bindFreqExpand = function (wrap) {
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var chip = e.target.closest('.xg-chip[data-xg-freq], [data-xg-sfreq]');
      if (!chip || !wrap.contains(chip)) return;
      var chips = wrap.querySelectorAll('.xg-chip[data-xg-freq], [data-xg-sfreq]');
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-sel');
      chip.classList.add('is-sel');
      chip.classList.add('is-pulse');
      setTimeout(function () { chip.classList.remove('is-pulse'); }, 380);
      var freq = chip.getAttribute('data-xg-freq') || chip.getAttribute('data-xg-sfreq');
      // 展开区切换
      var zones = wrap.querySelectorAll('.xg-freq-expand');
      for (var j = 0; j < zones.length; j++) {
        zones[j].style.display = zones[j].getAttribute('data-xg-for') === freq ? '' : 'none';
      }
    });
  };

  /* 星期七签 / 日期签 多选
     兼容 xinge.js 的 .xg-week-cell / .xg-date-chip 命名 */
  ui.bindMultiPick = function (wrap, onChange) {
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var cell = e.target.closest('.xg-week-dot, .xg-date-cell, .xg-week-cell, .xg-date-chip');
      if (!cell || !wrap.contains(cell)) return;
      cell.classList.toggle('is-sel');
      if (onChange) {
        var picked = [];
        var all = wrap.querySelectorAll('.is-sel');
        for (var i = 0; i < all.length; i++) picked.push(all[i].getAttribute('data-xg-val'));
        onChange(picked);
      }
    });
  };

  /* 写信人三选签
     兼容 xinge.js 的 [data-xg-sendermode] 命名 */
  ui.bindRadioPills = function (wrap, onChange) {
    if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var pill = e.target.closest('.xg-radio-pill, [data-xg-sendermode]');
      if (!pill || !wrap.contains(pill)) return;
      var all = wrap.querySelectorAll('.xg-radio-pill, [data-xg-sendermode]');
      for (var i = 0; i < all.length; i++) all[i].classList.remove('is-sel');
      pill.classList.add('is-sel');
      if (onChange) onChange(pill.getAttribute('data-xg-pill-val') || pill.getAttribute('data-xg-sendermode'));
    });
  };

  /* ============================================================
     U5. P0 搜索 + 筛选（全部/未读/收藏 + 关键词）
     ============================================================ */
  ui.bindInboxSearch = function (pageEl, applyFn) {
    if (!pageEl) return;
    var input = pageEl.querySelector('.xg-search-wrap input');
    var clearBtn = pageEl.querySelector('.xg-search-clear');
    var state = { filter: 'all', keyword: '' };
    var timer = null;
    function fire() {
      if (applyFn) applyFn(state.filter, state.keyword);
    }
    if (input) {
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          state.keyword = String(input.value || '').trim();
          if (clearBtn) clearBtn.style.display = state.keyword ? '' : 'none';
          fire();
        }, 220);
      });
    }
    if (clearBtn) {
      clearBtn.style.display = 'none';
      clearBtn.addEventListener('click', function () {
        if (input) input.value = '';
        state.keyword = '';
        clearBtn.style.display = 'none';
        fire();
      });
    }
    // 筛选 chip（全部/未读/收藏）
    var chipRow = pageEl.querySelector('.xg-chip-row[data-xg-inbox-filter]');
    if (chipRow) {
      chipRow.addEventListener('click', function (e) {
        var chip = e.target.closest('.xg-chip[data-xg-filter]');
        if (!chip) return;
        var chips = chipRow.querySelectorAll('.xg-chip[data-xg-filter]');
        for (var i = 0; i < chips.length; i++) chips[i].classList.remove('is-sel');
        chip.classList.add('is-sel');
        state.filter = chip.getAttribute('data-xg-filter');
        fire();
      });
    }
    return {
      setFilter: function (f) { state.filter = f; fire(); }
    };
  };

  /* ============================================================
     U6. P5 失败态（墨瓶倾倒 + 重试/返回）
     ============================================================ */
  ui.showComposeFail = function (pageEl, err, onRetry) {
    if (!pageEl) return;
    var stage = pageEl.querySelector('.xg-compose-wrap') || pageEl.querySelector('.xg-page-body');
    if (!stage) return;
    var msg = (err && err.message) ? err.message : String(err || '生成失败');
    stage.innerHTML =
      '<div class="xg-p5-fail">' +
      '<div class="xg-p5-fail-art"><img src="img/xinge/cut-inkpot.webp" alt=""></div>' +
      '<div class="xg-p5-fail-text">墨水洒了……这封信没写成</div>' +
      '<div class="xg-err-detail">' + msg.replace(/</g, '&lt;') + '</div>' +
      '<div class="xg-btn-row">' +
      '<button class="xg-btn-on-dark is-solid" data-xg-act="compose-retry">再写一次</button>' +
      '<button class="xg-btn-on-dark" data-xg-act="back">先回去</button>' +
      '</div></div>';
    var retryBtn = stage.querySelector('[data-xg-act="compose-retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', function () {
        if (onRetry) onRetry();
      });
    }
    var backBtn = stage.querySelector('[data-xg-act="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (Xinge.nav && Xinge.nav.back) Xinge.nav.back();
      });
    }
  };

  /* ============================================================
     U7. S7 数据管理：存储条 / 导出 / 清空（纹章弹窗确认）
     ============================================================ */
  ui.bindDataPage = function (pageEl) {
    if (!pageEl) return;
    // 存储占用条
    var bar = pageEl.querySelector('.xg-storage-fill');
    var legend = pageEl.querySelector('.xg-storage-legend');
    Xinge.data.loadLetters().then(function (list) {
      var approx = 0;
      try {
        approx = JSON.stringify(list).length;
      } catch (e) { approx = 0; }
      var kb = Math.round(approx / 1024);
      if (bar) bar.style.width = Math.min(100, kb / 5120 * 100) + '%'; // 5MB 为满
      if (legend) {
        legend.children[0].textContent = kb + ' KB';
        legend.children[1].textContent = list.length + ' 封信';
      }
    });
    // 导出
    var exportBtn = pageEl.querySelector('[data-xg-act="export-letters"]');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (F.exportLetters) {
          F.exportLetters().then(function (n) {
            ui.toast('已导出 ' + n + ' 封信', 'ok');
          }).catch(function () {
            ui.toast('导出失败', 'err');
          });
        }
      });
    }
  };

  /* ============================================================
     U8. 长按菜单全接线（收藏盖章 / 删除折纸确认）
     ============================================================ */
  ui.attachCardLongPress = function (cardEl, letterId) {
    if (!cardEl || cardEl._xgLongPress) return;
    cardEl._xgLongPress = true;
    var timer = null;
    var startPt = null;
    function open(x, y) {
      if (!F.openFloatMenu) return;
      F.openFloatMenu(x, y, [
        {
          label: Xinge.data.isFavorite ? '收藏' : '收藏',
          iconHtml: '<img src="img/xinge/icon-seal.svg" alt="">',
          onPick: function () {
            Xinge.data.toggleFavorite ? Xinge.data.toggleFavorite(letterId) : null;
            F.sealStampOn(cardEl);
            ui.toast('已盖「藏」章', 'ok');
          }
        },
        {
          label: '删除',
          danger: true,
          sep: true,
          iconHtml: '<img src="img/xinge/icon-heart.svg" alt="">',
          onPick: function () {
            ui.confirmDelete(cardEl, letterId);
          }
        }
      ]);
    }
    cardEl.addEventListener('pointerdown', function (e) {
      startPt = { x: e.clientX, y: e.clientY };
      timer = setTimeout(function () {
        open(startPt.x, startPt.y);
        if (navigator.vibrate) { try { navigator.vibrate(10); } catch (err) {} }
      }, 520);
    });
    function cancel() {
      if (timer) { clearTimeout(timer); timer = null; }
    }
    cardEl.addEventListener('pointerup', cancel);
    cardEl.addEventListener('pointercancel', cancel);
    cardEl.addEventListener('pointermove', function (e) {
      if (startPt && (Math.abs(e.clientX - startPt.x) > 8 || Math.abs(e.clientY - startPt.y) > 8)) {
        cancel();
      }
    });
    cardEl.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      open(e.clientX, e.clientY);
    });
  };

  /* 删除确认（折纸飞机动画后落库） */
  ui.confirmDelete = function (cardEl, letterId) {
    var scrim = document.createElement('div');
    scrim.className = 'xg-modal-scrim xg-scrim';
    scrim.innerHTML =
      '<div class="xg-modal xg-modal-card">' +
      '<div class="xg-modal-head"><div class="xg-modal-title">删除这封信？</div></div>' +
      '<div class="xg-modal-body">' +
      '<div class="xg-plane-confirm-art"><div class="xg-plane-body"></div></div>' +
      '<div class="xg-confirm-text">折成纸飞机飞走后<br>就再也找不回来了</div>' +
      '</div>' +
      '<div class="xg-modal-foot">' +
      '<button class="xg-btn xg-btn-danger" data-xg-act="del-yes">删除</button>' +
      '<button class="xg-btn" data-xg-act="del-no">再想想</button>' +
      '</div></div>';
    document.body.appendChild(scrim);
    scrim.addEventListener('click', function (e) {
      if (e.target === scrim || e.target.closest('[data-xg-act="del-no"]')) {
        scrim.classList.add('is-closing');
        setTimeout(function () { scrim.remove(); }, 260);
      }
      if (e.target.closest('[data-xg-act="del-yes"]')) {
        var art = scrim.querySelector('.xg-plane-confirm-art');
        if (art) art.classList.add('is-flying');
        setTimeout(function () {
          scrim.classList.add('is-closing');
          setTimeout(function () { scrim.remove(); }, 260);
          Xinge.data.deleteLetter ? Xinge.data.deleteLetter(letterId).then(function () {
            if (cardEl) {
              cardEl.classList.add('xg-plane-fly');
              setTimeout(function () {
                if (Xinge.nav && Xinge.nav.refreshInbox) Xinge.nav.refreshInbox();
                else if (window.showXingePage) { /* 保底：不重进，留待手动 */ }
              }, 440);
            }
            ui.toast('信已折成纸飞机', 'ok');
          }) : null;
        }, 480);
      }
    });
  };

  /* ============================================================
     U9. 蜡丸开关批量绑定（页面内所有 [data-xg-switch]）
     ============================================================ */
  ui.bindSwitches = function (pageEl, onChange) {
    if (!pageEl || !F.bindWax) return;
    var btns = pageEl.querySelectorAll('.xg-wax-switch');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        F.bindWax(btn, function (on) {
          var key = btn.getAttribute('data-xg-key');
          if (onChange) onChange(key, on);
        });
      })(btns[i]);
    }
  };

  /* 挂载（合并而非覆盖：保留 xinge.js 的 ui.renderInbox / ui.renderWrite，
     深检 2026-10-24 修：原来直接 Xinge.ui = ui 把那两个成员抹掉了） */
  if (typeof window.__xingeMergeUI === 'function') window.__xingeMergeUI(ui);
  else Xinge.ui = Object.assign({}, Xinge.ui || {}, ui);
})();
