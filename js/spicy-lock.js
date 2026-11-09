window.SpicyLock = {
  PASSWORD_PARTS: ['2', '1', '1', '1', '3', '0'],
  UNLOCK_KEY: 'spicy_lock_ok',

  isUnlocked: function () {
    try {
      if (localStorage.getItem(this.UNLOCK_KEY) === '1') return true;
    } catch (e) {}
    return false;
  },

  markUnlocked: function () {
    try {
      localStorage.setItem(this.UNLOCK_KEY, '1');
    } catch (e) {}
    try {
      if (window.db && window.db.config) {
        window.db.config.put({ key: 'spicyLockUnlocked', value: true });
      }
    } catch (e) {}
  },

  checkPassword: function (input) {
    return String(input || '').trim() === this.PASSWORD_PARTS.join('');
  },

  renderLock: function (onPass) {
    var old = document.querySelector('.spicy-lock-page');
    if (old) old.remove();
    var page = document.createElement('div');
    page.className = 'spicy-lock-page';
    page.innerHTML =
      '<div class="spicy-lock-stars" aria-hidden="true"></div>' +
      '<div class="spicy-lock-card">' +
        '<div class="spicy-lock-art" aria-hidden="true">' +
          '<span class="spicy-lock-art-shackle"></span>' +
          '<span class="spicy-lock-art-body"></span>' +
          '<span class="spicy-lock-art-keyhole"></span>' +
          '<span class="spicy-lock-art-shine"></span>' +
        '</div>' +
        '<p class="spicy-lock-eyebrow">星途财弈</p>' +
        '<h1 class="spicy-lock-title">这局牌桌有门槛</h1>' +
        '<p class="spicy-lock-subtitle">输对密码才能入座</p>' +
        '<div class="miss-compose spicy-lock-compose">' +
          '<input class="miss-input spicy-lock-input" type="password" inputmode="numeric" maxlength="12" ' +
            'autocomplete="off" placeholder="输入密码" aria-label="游戏密码">' +
          '<button class="miss-send spicy-lock-send" type="button" aria-label="确认入座">入</button>' +
        '</div>' +
        '<p class="spicy-lock-error" data-lock-error hidden>密码不对哦，再想一想</p>' +
        '<p class="spicy-lock-hint">只需输对一次，之后一直可以入座</p>' +
      '</div>';
    document.body.appendChild(page);

    var input = page.querySelector('.spicy-lock-input');
    var sendBtn = page.querySelector('.spicy-lock-send');
    var errorEl = page.querySelector('[data-lock-error]');

    function tryPass() {
      if (window.SpicyLock.checkPassword(input.value)) {
        errorEl.hidden = true;
        page.classList.add('spicy-lock-open');
        window.SpicyLock.markUnlocked();
        window.setTimeout(function () {
          page.remove();
          if (typeof onPass === 'function') onPass();
        }, 480);
      } else {
        errorEl.hidden = false;
        page.classList.remove('spicy-lock-shake');
        void page.offsetWidth;
        page.classList.add('spicy-lock-shake');
        input.focus();
      }
    }

    sendBtn.addEventListener('click', tryPass);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tryPass();
    });
    window.setTimeout(function () {
      try {
        input.focus();
      } catch (e) {}
    }, 260);
  },

  open: function (originalShow) {
    var self = this;
    if (self.isUnlocked()) {
      if (typeof originalShow === 'function') originalShow();
      return;
    }
    self.renderLock(function () {
      if (typeof originalShow === 'function') originalShow();
    });
  }
};

if (typeof window.showSpicyMonopoly === 'function') {
  window.__spicyOrigShow = window.showSpicyMonopoly;
  window.showSpicyMonopoly = function () {
    window.SpicyLock.open(window.__spicyOrigShow);
  };
}
