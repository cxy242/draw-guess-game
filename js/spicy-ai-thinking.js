;(function () {
  'use strict';

  var STYLE_ID = 'spicy-ai-thinking-style';
  var overlay = null;
  var textEl = null;
  var avatarEl = null;
  var rotationTimer = null;
  var timeoutTimer = null;
  var graceTimer = null;
  var resolvePromise = null;
  var rejectPromise = null;
  var isActive = false;
  var timedOut = false;
  var currentAiName = '';

  var TEXTS = [
    '正在查看格子…',
    '正在处理事件…',
    '正在判断行动…',
    '正在结算奖惩…',
    '正在整理本局行动…'
  ];

  var TIMEOUT_TEXT = '处理超时，执行默认行动…';

  function injectStyles () {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      /* ── overlay ── */
      '.spicy-overlay {',
      '  position: fixed; top: 0; left: 0; right: 0; bottom: 0;',
      '  z-index: 999999;',
      '  background: rgba(10, 8, 28, 0.55);',
      '  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);',
      '  display: flex; align-items: center; justify-content: center;',
      '  pointer-events: all;',
      '  opacity: 1; transform: scale(1);',
      '  transition: opacity .35s ease, transform .35s ease;',
      '}',
      '.spicy-overlay.spicy-closing {',
      '  opacity: 0; transform: scale(0.85);',
      '}',

      /* ── card ── */
      '.spicy-card {',
      '  width: 260px;',
      '  padding: 28px 24px 24px;',
      '  border-radius: 18px;',
      '  background: rgba(30, 24, 60, 0.82);',
      '  backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);',
      '  border: 1px solid rgba(168, 130, 255, 0.22);',
      '  box-shadow: 0 8px 32px rgba(80, 40, 160, 0.35);',
      '  display: flex; flex-direction: column; align-items: center;',
      '  gap: 16px;',
      '}',

      /* ── avatar with breathing glow ── */
      '.spicy-avatar {',
      '  width: 64px; height: 64px; border-radius: 50%;',
      '  background: linear-gradient(135deg, #7c3aed, #a78bfa);',
      '  display: flex; align-items: center; justify-content: center;',
      '  position: relative;',
      '  animation: spicy-breathe 2.4s ease-in-out infinite;',
      '}',
      /* CSS-drawn robot face */
      '.spicy-avatar::before {',
      '  content: "";',
      '  width: 28px; height: 20px; border-radius: 10px 10px 6px 6px;',
      '  background: rgba(255,255,255,0.9);',
      '  position: absolute; top: 20px; left: 50%; transform: translateX(-50%);',
      '}',
      '.spicy-avatar::after {',
      '  content: "";',
      '  width: 6px; height: 6px; border-radius: 50%;',
      '  background: #7c3aed; box-shadow: -8px 0 0 #7c3aed, 8px 0 0 #7c3aed;',
      '  position: absolute; top: 25px; left: 50%; transform: translateX(-50%);',
      '}',
      '@keyframes spicy-breathe {',
      '  0%, 100% { box-shadow: 0 0 8px 2px rgba(124,58,237,0.4); }',
      '  50%      { box-shadow: 0 0 22px 8px rgba(167,139,250,0.7); }',
      '}',

      /* ── thinking text ── */
      '.spicy-text {',
      '  color: #e2d9f3; font-size: 15px; text-align: center;',
      '  min-height: 22px; line-height: 1.4;',
      '  opacity: 1; transition: opacity .3s ease;',
      '}',
      '.spicy-text.spicy-fade { opacity: 0; }',

      /* ── bouncing dots ── */
      '.spicy-dots {',
      '  display: flex; gap: 6px; height: 18px; align-items: flex-end;',
      '}',
      '.spicy-dot {',
      '  width: 8px; height: 8px; border-radius: 50%;',
      '  background: #a78bfa;',
      '  animation: spicy-bounce 1.2s ease-in-out infinite;',
      '}',
      '.spicy-dot:nth-child(2) { animation-delay: 0.15s; }',
      '.spicy-dot:nth-child(3) { animation-delay: 0.30s; }',
      '@keyframes spicy-bounce {',
      '  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }',
      '  30%            { transform: translateY(-10px); opacity: 1; }',
      '}'
    ].join('\n');
    document.head.appendChild(s);
  }

  function createOverlay () {
    overlay = document.createElement('div');
    overlay.className = 'spicy-overlay';

    var card = document.createElement('div');
    card.className = 'spicy-card';

    avatarEl = document.createElement('div');
    avatarEl.className = 'spicy-avatar';

    textEl = document.createElement('div');
    textEl.className = 'spicy-text';

    var dots = document.createElement('div');
    dots.className = 'spicy-dots';
    for (var i = 0; i < 3; i++) {
      var d = document.createElement('div');
      d.className = 'spicy-dot';
      dots.appendChild(d);
    }

    card.appendChild(avatarEl);
    card.appendChild(textEl);
    card.appendChild(dots);
    overlay.appendChild(card);

    /* block all pointer events */
    overlay.addEventListener('click', stop, true);
    overlay.addEventListener('touchstart', stop, true);
    overlay.addEventListener('touchmove', stop, true);
    overlay.addEventListener('mousedown', stop, true);
    overlay.addEventListener('pointerdown', stop, true);

    return overlay;
  }

  function stop (e) { e.preventDefault(); e.stopPropagation(); }

  var textIndex = 0;
  function rotateText () {
    if (!isActive) return;
    textEl.classList.add('spicy-fade');
    setTimeout(function () {
      if (!isActive) return;
      textIndex = (textIndex + 1) % TEXTS.length;
      textEl.textContent = currentAiName + TEXTS[textIndex];
      textEl.classList.remove('spicy-fade');
    }, 300);
    rotationTimer = setTimeout(rotateText, 1500);
  }

  function clearTimeouts () {
    clearTimeout(rotationTimer); rotationTimer = null;
    clearTimeout(timeoutTimer); timeoutTimer = null;
    clearTimeout(graceTimer);   graceTimer = null;
  }

  function removeOverlay () {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    overlay = null;
    textEl = null;
    avatarEl = null;
  }

  /* ── public API ── */
  window.SpicyAIThinking = {

    /**
     * Show thinking overlay.
     * @param {string} aiName – display name of the AI player
     * @returns {Promise} resolves on hide(), rejects on timeout
     */
    show: function (aiName) {
      /* if already active, hide first */
      if (isActive) {
        this.hide();
      }

      currentAiName = aiName || 'AI';
      injectStyles();
      createOverlay();
      document.body.appendChild(overlay);

      textIndex = 0;
      textEl.textContent = currentAiName + TEXTS[0];
      isActive = true;
      timedOut = false;

      /* start text rotation */
      rotationTimer = setTimeout(rotateText, 1500);

      /* 8-second timeout */
      timeoutTimer = setTimeout(function () {
        if (!isActive) return;
        timedOut = true;
        textEl.classList.add('spicy-fade');
        setTimeout(function () {
          if (!isActive) return;
          textEl.textContent = currentAiName + TIMEOUT_TEXT;
          textEl.classList.remove('spicy-fade');
        }, 300);

        /* wait 2s then force close */
        graceTimer = setTimeout(function () {
          if (!isActive) return;
          isActive = false;
          clearTimeouts();
          /* close animation */
          overlay.classList.add('spicy-closing');
          setTimeout(function () {
            removeOverlay();
            if (rejectPromise) rejectPromise(new Error('AI thinking timeout'));
            resolvePromise = null;
            rejectPromise = null;
          }, 360);
        }, 2000);
      }, 8000);

      return new Promise(function (res, rej) {
        resolvePromise = res;
        rejectPromise = rej;
      });
    },

    /**
     * Hide the overlay. Resolves the promise from show().
     */
    hide: function () {
      if (!isActive && !overlay) return;
      isActive = false;
      clearTimeouts();

      if (!overlay) {
        if (resolvePromise) { resolvePromise(); resolvePromise = null; rejectPromise = null; }
        return;
      }

      overlay.classList.add('spicy-closing');
      setTimeout(function () {
        removeOverlay();
        if (resolvePromise) { resolvePromise(); resolvePromise = null; rejectPromise = null; }
      }, 360);
    }
  };
})();
