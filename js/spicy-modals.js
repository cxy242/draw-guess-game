/**
 * spicy-modals.js — Modal dialogs for Star Fortune Chess (星途财弈)
 * IIFE pattern, exposes window.SpicyModals
 * All modals: glass morphism, CSS-drawn icons, Promise-based
 */
;(function() {
  'use strict';

  // --- Helper: HTML escaping ---
  function esc(str) {
    if (typeof window.escapeMainHtml === 'function') return window.escapeMainHtml(String(str));
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // --- Inject CSS once ---
  function ensureStyles() {
    if (document.getElementById('spicy-modal-styles')) return;
    var style = document.createElement('style');
    style.id = 'spicy-modal-styles';
    style.textContent = [
      /* Overlay */
      '.spicy-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:0;animation:spicy-fade-in .3s ease forwards;}',
      '@keyframes spicy-fade-in{from{opacity:0}to{opacity:1}}',
      /* Glass card */
      '.spicy-card{background:rgba(255,255,255,0.08);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:16px;padding:28px 24px 24px;max-width:340px;width:88%;text-align:center;color:#fff;font-family:-apple-system,system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.4);transform:scale(0.92);animation:spicy-scale-in .3s ease forwards;}',
      '@keyframes spicy-scale-in{from{transform:scale(0.92);opacity:0}to{transform:scale(1);opacity:1}}',
      /* Title */
      '.spicy-title{font-size:18px;font-weight:700;margin-bottom:12px;line-height:1.3;}',
      /* Description text */
      '.spicy-desc{font-size:14px;color:rgba(255,255,255,0.75);line-height:1.6;margin-bottom:20px;word-break:break-word;}',
      /* Icon containers */
      '.spicy-icon{width:64px;height:64px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;}',
      /* ---- CSS-drawn icons ---- */
      /* Chance: exclamation in gradient card */
      '.spicy-icon-chance{position:relative;width:52px;height:64px;background:linear-gradient(135deg,#f59e0b,#f97316);border-radius:6px;box-shadow:0 2px 8px rgba(245,158,11,0.4);display:flex;align-items:center;justify-content:center;}',
      '.spicy-icon-chance::before{content:"!";font-size:32px;font-weight:900;color:#fff;line-height:1;}',
      /* Fate: question mark in purple circle */
      '.spicy-icon-fate{width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#a855f7,#7c3aed);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 12px rgba(168,85,247,0.45);}',
      '.spicy-icon-fate::before{content:"?";font-size:30px;font-weight:900;color:#fff;line-height:1;}',
      /* Tax: gold coin */
      '.spicy-icon-coin{width:52px;height:52px;border-radius:50%;background:linear-gradient(145deg,#fbbf24,#d97706);border:3px solid #f59e0b;box-shadow:0 2px 10px rgba(217,119,6,0.5);display:flex;align-items:center;justify-content:center;}',
      '.spicy-icon-coin::before{content:"¥";font-size:24px;font-weight:800;color:#78350f;line-height:1;}',
      /* Jail: bars */
      '.spicy-icon-jail{width:54px;height:54px;position:relative;display:flex;align-items:center;justify-content:center;gap:4px;}',
      '.spicy-icon-jail .spicy-bar{width:4px;height:48px;background:rgba(255,255,255,0.7);border-radius:2px;}',
      '.spicy-icon-jail::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.85);border-radius:2px;}',
      '.spicy-icon-jail::after{content:"";position:absolute;bottom:0;left:0;right:0;height:4px;background:rgba(255,255,255,0.85);border-radius:2px;}',
      /* Bankrupt: red warning triangle */
      '.spicy-icon-warn{width:0;height:0;border-left:30px solid transparent;border-right:30px solid transparent;border-bottom:52px solid #ef4444;position:relative;filter:drop-shadow(0 2px 8px rgba(239,68,68,0.5));}',
      '.spicy-icon-warn::before{content:"!";position:absolute;top:28px;left:50%;transform:translateX(-50%);font-size:22px;font-weight:900;color:#fff;line-height:1;}',
      /* Buttons row */
      '.spicy-btns{display:flex;gap:10px;margin-top:6px;}',
      '.spicy-btns-col{flex-direction:column;}',
      '.spicy-btn{flex:1;padding:12px 0;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;transition:all .15s ease;line-height:1.2;}',
      '.spicy-btn:active{transform:scale(0.97);}',
      '.spicy-btn-primary{background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;box-shadow:0 2px 10px rgba(99,102,241,0.4);}',
      '.spicy-btn-secondary{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.9);border:1px solid rgba(255,255,255,0.15);}',
      '.spicy-btn-danger{background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;box-shadow:0 2px 10px rgba(239,68,68,0.4);}',
      '.spicy-btn-success{background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 2px 10px rgba(34,197,94,0.4);}',
      /* Radio options */
      '.spicy-radio-group{text-align:left;margin-bottom:18px;}',
      '.spicy-radio-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;margin-bottom:6px;cursor:pointer;transition:background .15s ease;}',
      '.spicy-radio-item:hover{background:rgba(255,255,255,0.05);}',
      '.spicy-radio-item input[type=radio]{display:none;}',
      '.spicy-radio-dot{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,255,255,0.4);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:border-color .15s ease;}',
      '.spicy-radio-item input:checked ~ .spicy-radio-dot{border-color:#8b5cf6;}',
      '.spicy-radio-item input:checked ~ .spicy-radio-dot::after{content:"";width:8px;height:8px;border-radius:50%;background:#8b5cf6;}',
      '.spicy-radio-label{font-size:14px;color:rgba(255,255,255,0.85);line-height:1.4;}',
      /* Asset summary */
      '.spicy-asset-summary{background:rgba(0,0,0,0.2);border-radius:8px;padding:10px 14px;margin-bottom:16px;text-align:left;font-size:13px;color:rgba(255,255,255,0.7);line-height:1.7;}',
      /* Amount highlight */
      '.spicy-amount{font-size:28px;font-weight:800;background:linear-gradient(135deg,#fbbf24,#f59e0b);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin:4px 0 8px;}',
      '.spicy-balance{font-size:13px;color:rgba(255,255,255,0.55);margin-bottom:16px;}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // --- Generic modal builder ---
  function createModal(contentHTML) {
    ensureStyles();
    var overlay = document.createElement('div');
    overlay.className = 'spicy-overlay';
    overlay.innerHTML = '<div class="spicy-card">' + contentHTML + '</div>';
    // Prevent click-outside-to-close
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) e.stopPropagation();
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  function closeModal(overlay) {
    if (!overlay || !overlay.parentNode) return;
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity .2s ease';
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 200);
  }

  // Bind click on elements with data-spicy-action
  function bindActions(overlay, handler) {
    var buttons = overlay.querySelectorAll('[data-spicy-action]');
    for (var i = 0; i < buttons.length; i++) {
      (function(btn) {
        btn.addEventListener('click', function(e) {
          e.stopPropagation();
          handler(btn.getAttribute('data-spicy-action'), btn);
        });
      })(buttons[i]);
    }
  }

  // ============================================================
  // A) showChanceCard(cardData) — 机会格弹窗
  // ============================================================
  function showChanceCard(cardData) {
    var name = cardData && cardData.name ? esc(cardData.name) : '机会卡';
    var desc = cardData && cardData.description ? esc(cardData.description) : '';
    var html = ''
      + '<div class="spicy-icon"><div class="spicy-icon-chance"></div></div>'
      + '<div class="spicy-title">' + name + '</div>'
      + '<div class="spicy-desc">' + desc + '</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-primary" data-spicy-action="confirm">确认</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ confirmed: true });
      });
    });
  }

  // ============================================================
  // B) showFateCard(fateData) — 命运格弹窗
  // ============================================================
  function showFateCard(fateData) {
    var name = fateData && fateData.name ? esc(fateData.name) : '命运卡';
    var desc = fateData && fateData.description ? esc(fateData.description) : '';
    var html = ''
      + '<div class="spicy-icon"><div class="spicy-icon-fate"></div></div>'
      + '<div class="spicy-title">' + name + '</div>'
      + '<div class="spicy-desc">' + desc + '</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-primary" data-spicy-action="confirm">确认</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ confirmed: true });
      });
    });
  }

  // ============================================================
  // C) showTaxModal(amount, playerName) — 缴税弹窗
  // ============================================================
  function showTaxModal(amount, playerName) {
    var amt = typeof amount === 'number' ? amount : parseInt(amount) || 0;
    var name = esc(playerName || '玩家');
    var html = ''
      + '<div class="spicy-icon"><div class="spicy-icon-coin"></div></div>'
      + '<div class="spicy-title">缴税通知</div>'
      + '<div class="spicy-desc">' + name + ' 需要缴纳税款</div>'
      + '<div class="spicy-amount">' + amt + ' 星币</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-primary" data-spicy-action="pay">缴纳 ' + amt + ' 币</button>'
      + '  <button class="spicy-btn spicy-btn-ghost" data-spicy-action="serve">差遣（做任务代替）</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ paid: action === 'pay', serve: action === 'serve' });
      });
    });
  }

  // ============================================================
  // D) showJailModal(playerName) — 监狱弹窗
  // ============================================================
  function showJailModal(playerName) {
    var name = esc(playerName || '玩家');
    var html = ''
      + '<div class="spicy-icon">'
      + '  <div class="spicy-icon-jail">'
      + '    <div class="spicy-bar"></div>'
      + '    <div class="spicy-bar"></div>'
      + '    <div class="spicy-bar"></div>'
      + '    <div class="spicy-bar"></div>'
      + '    <div class="spicy-bar"></div>'
      + '  </div>'
      + '</div>'
      + '<div class="spicy-title">入狱！</div>'
      + '<div class="spicy-desc">' + name + ' 进了监狱！跳过下一回合</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-primary" data-spicy-action="confirm">确定</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ confirmed: true });
      });
    });
  }

  // ============================================================
  // E) showBankruptModal(playerName, assets) — 破产弹窗
  // ============================================================
  function showBankruptModal(playerName, assets) {
    var name = esc(playerName || '玩家');
    var assetLines = '';
    if (assets && typeof assets === 'object') {
      var keys = Object.keys(assets);
      for (var i = 0; i < keys.length; i++) {
        assetLines += '<div>' + esc(keys[i]) + '：' + esc(String(assets[keys[i]])) + '</div>';
      }
    }
    var html = ''
      + '<div class="spicy-icon"><div class="spicy-icon-warn"></div></div>'
      + '<div class="spicy-title" style="color:#ef4444;">破产</div>'
      + '<div class="spicy-desc">' + name + ' 已经破产！</div>'
      + (assetLines ? '<div class="spicy-asset-summary">' + assetLines + '</div>' : '')
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-danger" data-spicy-action="confirm">查看对局结算</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ confirmed: true });
      });
    });
  }

  // ============================================================
  // F) showExitConfirmModal() — 退出确认弹窗 (FORMAL exit)
  // ============================================================
  function showExitConfirmModal() {
    var html = ''
      + '<div class="spicy-title">退出对局</div>'
      + '<div class="spicy-radio-group">'
      + '  <label class="spicy-radio-item">'
      + '    <input type="radio" name="spicy-exit-opt" value="memory" checked>'
      + '    <span class="spicy-radio-dot"></span>'
      + '    <span class="spicy-radio-label">需要把对局总结写入记忆库</span>'
      + '  </label>'
      + '  <label class="spicy-radio-item">'
      + '    <input type="radio" name="spicy-exit-opt" value="direct">'
      + '    <span class="spicy-radio-dot"></span>'
      + '    <span class="spicy-radio-label">直接退出不保存记忆</span>'
      + '  </label>'
      + '</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-danger" data-spicy-action="exit">确认退出</button>'
      + '  <button class="spicy-btn spicy-btn-secondary" data-spicy-action="back">返回游戏</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        if (action === 'back') {
          closeModal(overlay);
          resolve({ exit: false });
        } else {
          var checked = overlay.querySelector('input[name="spicy-exit-opt"]:checked');
          var saveMemory = checked && checked.value === 'memory';
          closeModal(overlay);
          resolve({ exit: true, saveMemory: saveMemory });
        }
      });
    });
  }

  // ============================================================
  // G) showSaveExitModal() — 临时退出弹窗
  // ============================================================
  function showSaveExitModal() {
    var html = ''
      + '<div class="spicy-title">临时退出</div>'
      + '<div class="spicy-desc">当前对局进度将保存，下次可继续</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-primary" data-spicy-action="save">保存并退出</button>'
      + '  <button class="spicy-btn spicy-btn-secondary" data-spicy-action="back">返回游戏</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ saveAndExit: action === 'save' });
      });
    });
  }

  // ============================================================
  // H) showResumeModal() — 恢复对局弹窗
  // ============================================================
  function showResumeModal() {
    var html = ''
      + '<div class="spicy-title">检测到未完成对局</div>'
      + '<div class="spicy-desc">是否继续上次的游戏？</div>'
      + '<div class="spicy-btns">'
      + '  <button class="spicy-btn spicy-btn-success" data-spicy-action="resume">继续对局</button>'
      + '  <button class="spicy-btn spicy-btn-secondary" data-spicy-action="restart">重新开始</button>'
      + '</div>';
    return new Promise(function(resolve) {
      var overlay = createModal(html);
      bindActions(overlay, function(action) {
        closeModal(overlay);
        resolve({ resume: action === 'resume' });
      });
    });
  }

  // --- Expose public API ---
  window.SpicyModals = {
    showChanceCard: showChanceCard,
    showFateCard: showFateCard,
    showTaxModal: showTaxModal,
    showJailModal: showJailModal,
    showBankruptModal: showBankruptModal,
    showExitConfirmModal: showExitConfirmModal,
    showSaveExitModal: showSaveExitModal,
    showResumeModal: showResumeModal
  };

})();
