/* ============================================================
   xinge-tab.js · B14 补丁卷（三 tab + 未读角标 + P3c 必填校验）
   依功能设计 v2 §1.1（三 tab 各自保留栈）/ §2.1（未读角标）/ §P3c（必填校验）
   挂载：window.Xinge.tabs（xinge.js / xinge-effects.js / xinge-ui.js 之后）
   ============================================================ */
(function () {
  'use strict';
  if (!window.Xinge || !window.Xinge.nav) {
    console.warn('[xinge-tab] 前置未加载，补丁卷放弃挂载');
    return;
  }
  var Xinge = window.Xinge;
  var nav = Xinge.nav;

  /* 页面 → tab 归属（每 tab 各自保留栈的记忆维度） */
  var PAGE_TAB = {
    inbox: 'inbox', recall: 'inbox',
    write: 'write', recipient: 'write', target: 'write', age: 'write',
    custom: 'write', preset: 'write', composing: 'write', envelope: 'write',
    fan: 'write', reading: 'write',
    settings: 'settings', perm: 'settings', timer: 'settings',
    presetmgr: 'settings', prefs: 'settings', notify: 'settings', data: 'settings'
  };
  var ROOT_PAGE = { inbox: 'inbox', write: 'write', settings: 'settings' };

  var curTab = 'inbox';
  var tabMemory = { inbox: 'inbox', write: 'write', settings: 'settings' }; // 每 tab 最后所在页

  /* ============================================================
     T1. tabbar 模板 + 注入
     ============================================================ */
  function tabbarHtml(active) {
    function item(key, icon, label) {
      return '<button class="xg-tabbar-item' + (active === key ? ' is-active' : '') + '" data-xg-tab="' + key + '">' +
        '<span class="xg-tab-ic"><img src="img/xinge/' + icon + '" alt=""></span>' +
        '<span class="xg-tab-label">' + label + '</span>' +
        (key === 'inbox' ? '<span class="xg-count-badge" id="xg-tab-unread" style="display:none"></span>' : '') +
        '</button>';
    }
    return '<div class="xg-tabbar">' +
      item('inbox', 'icon-seal.svg', '信箱') +
      item('write', 'icon-heart.svg', '写信') +
      item('settings', 'icon-clock.svg', '设置') +
      '</div>';
  }

  function injectTabbar(pageId, active) {
    var el = document.getElementById(pageId);
    if (!el) return;
    if (el.querySelector('.xg-tabbar')) {
      // 刷新激活态
      var items = el.querySelectorAll('.xg-tabbar-item');
      for (var i = 0; i < items.length; i++) {
        items[i].classList.toggle('is-active', items[i].getAttribute('data-xg-tab') === active);
      }
      return;
    }
    el.insertAdjacentHTML('beforeend', tabbarHtml(active));
  }

  /* tabbar 点击（捕获阶段，避免与页面委托冲突） */
  document.addEventListener('click', function (e) {
    var t = e.target.closest && e.target.closest('.xg-tabbar-item');
    if (!t) return;
    e.stopPropagation();
    var key = t.getAttribute('data-xg-tab');
    if (key === curTab) {
      // 再点当前 tab：回该 tab 根页
      if (nav[ROOT_PAGE[key]]) nav[ROOT_PAGE[key]]();
      return;
    }
    tabMemory[curTab] = currentPageName() || ROOT_PAGE[curTab];
    curTab = key;
    var target = tabMemory[key] || ROOT_PAGE[key];
    if (nav[target]) nav[target]();
  }, true);

  function currentPageName() {
    var pages = document.querySelectorAll('[id^="xg-page-"]');
    if (!pages.length) return null;
    var top = pages[pages.length - 1];
    return top.id.replace('xg-page-', '');
  }

  /* ============================================================
     T2. wrap 根 tab 页：注入 tabbar + 记忆
     ============================================================ */
  ['inbox', 'write', 'settings'].forEach(function (key) {
    var orig = nav[key];
    if (typeof orig !== 'function') return;
    nav[key] = function () {
      curTab = key;
      tabMemory[key] = key;
      var r = orig.apply(this, arguments);
      injectTabbar('xg-page-' + key, key);
      refreshBadge();
      return r;
    };
  });

  /* wrap 子页：记忆所在 tab（保留各自栈的近似实现） */
  Object.keys(nav).forEach(function (key) {
    if (ROOT_PAGE[key]) return;
    var orig = nav[key];
    if (typeof orig !== 'function') return;
    nav[key] = function () {
      var tab = PAGE_TAB[key];
      if (tab) { curTab = tab; tabMemory[tab] = key; }
      return orig.apply(this, arguments);
    };
  });

  /* ============================================================
     T3. 未读角标（tab 内 + 桌面全局通知角标）
     ============================================================ */
  function refreshBadge() {
    if (!Xinge.data || !Xinge.data.loadLetters) return;
    Xinge.data.loadLetters().then(function (list) {
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        if (!list[i].readAt) n++;
      }
      var b = document.getElementById('xg-tab-unread');
      if (b) {
        b.textContent = n > 99 ? '99+' : String(n);
        b.style.display = n > 0 ? '' : 'none';
      }
      if (typeof window.updateBadge === 'function') {
        try { window.updateBadge(n); } catch (e) { /* 桌面角标失败不阻塞 */ }
      }
    }).catch(function () { /* 静默 */ });
  }
  Xinge.tabs = { refreshBadge: refreshBadge };

  /* ============================================================
     T4. P3c 必填校验接线（写给谁 / 关系倾向）
     ============================================================ */
  var origCustom = nav.custom;
  if (typeof origCustom === 'function') {
    nav.custom = function () {
      var r = origCustom.apply(this, arguments);
      setTimeout(function () {
        var el = document.getElementById('xg-page-custom');
        if (!el) return;
        el.addEventListener('click', function (e) {
          if (!e.target.closest('[data-xg-act="custom-next"]')) return;
          var to = el.querySelector('#xg-c-to');
          var rel = el.querySelector('#xg-c-rel');
          var errors = [];
          if (to && !String(to.value || '').trim()) {
            to.classList.add('xg-input-err');
            errors.push('写给谁还没填');
          } else if (to) { to.classList.remove('xg-input-err'); }
          if (rel && !String(rel.value || '').trim()) {
            rel.classList.add('xg-input-err');
            errors.push('关系倾向还没填');
          } else if (rel) { rel.classList.remove('xg-input-err'); }
          if (errors.length) {
            e.stopPropagation();
            e.preventDefault();
            if (Xinge.ui && Xinge.ui.toast) Xinge.ui.toast(errors[0], 'warn');
            else if (window.toast) window.toast(errors[0]);
          }
        }, true); // 捕获阶段拦截
      }, 0);
      return r;
    };
  }
})();
