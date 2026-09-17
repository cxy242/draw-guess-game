// ensemble.js - 群像模块入口、模式选择、角色选择、动态人员管理
// 依赖：db.js, main.js, settings.js, wechat.js, ensemble-chat.js, ensemble-script.js

;(function() {
  'use strict';

  var _ensPageId = 'ensemble-page';
  var _ensState = null;

  // --- Utility helpers ---
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getInitial(name) {
    return String(name || '?').trim().charAt(0) || '?';
  }

  function avatarHTML(src, name) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(name) + '">'
      : '<span>' + esc(getInitial(name)) + '</span>';
  }

  function charName(ch) {
    return ch ? (ch.nick || ch.name || '未命名') : '未命名';
  }

  // --- State management ---
  function setState(page, state) {
    _ensState = state;
    page._ensState = state;
  }

  function getState() {
    return _ensState;
  }

  // --- Page creation ---
  function createPage() {
    var existing = document.getElementById(_ensPageId);
    if (existing) existing.remove();
    var page = document.createElement('div');
    page.id = _ensPageId;
    page.className = 'full-page ens-page';
    page.innerHTML =
      '<div class="ens-header">' +
        '<button class="ens-header-back" id="ens-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="ens-header-title" id="ens-title">群像</span>' +
        '<div id="ens-header-right"></div>' +
      '</div>' +
      '<div class="ens-body" id="ens-body"></div>';

    page.querySelector('#ens-back').addEventListener('click', function() {
      handleBack(page);
    });

    window.openPage(page);
    return page;
  }

  function setTitle(page, title) {
    var el = page.querySelector('#ens-title');
    if (el) el.textContent = title;
  }

  function setHeaderRight(page, html) {
    var el = page.querySelector('#ens-header-right');
    if (el) el.innerHTML = html;
  }

  function handleBack(page) {
    var state = page._ensState || {};
    if (state.view === 'chat') {
      // Exit chat
      window.closePage(_ensPageId);
    } else if (state.view === 'script-settings') {
      renderCharPicker(page, state.ownerUid, state.mode);
    } else if (state.view === 'script-preview') {
      renderScriptSettings(page, state.ownerUid, state.characters, state.mode);
    } else if (state.view === 'chars') {
      renderModePicker(page, state.ownerUid);
    } else if (state.view === 'modes') {
      renderAccountPicker(page);
    } else {
      window.closePage(_ensPageId);
    }
  }

  // ===== Step 1: Account Picker =====
  async function renderAccountPicker(page) {
    setState(page, { view: 'accounts' });
    setTitle(page, '群像');
    setHeaderRight(page, '');
    var body = page.querySelector('#ens-body');
    body.innerHTML = '<div class="ens-loading">加载中</div>';

    try {
      var users = await db.characters.where('type').equals('user').toArray();
      users.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });

      if (!users.length) {
        body.innerHTML =
          '<div class="ens-empty">' +
            '<div class="ens-empty-icon"><i class="fa fa-user"></i></div>' +
            '<div class="ens-empty-title">暂无微信账号</div>' +
            '<div class="ens-empty-sub">请先在微信里登录或创建 USER 角色</div>' +
          '</div>';
        return;
      }

      var html = '<div class="ens-account-list">';
      for (var i = 0; i < users.length; i++) {
        var user = users[i];
        var profile = {};
        try {
          var row = await db.config.get('wechatSelfProfile_' + user.id);
          profile = row ? row.value || {} : {};
        } catch(_) {}
        var name = (profile.name || user.nick || user.name || '未命名');
        var avatar = profile.avatar || user.avatar || '';
        // Count characters for this user
        var chars = await getCharsForUser(user.id);
        html +=
          '<div class="ens-account-card" data-uid="' + user.id + '">' +
            '<div class="ens-account-avatar">' + avatarHTML(avatar, name) + '</div>' +
            '<div class="ens-account-info">' +
              '<div class="ens-account-name">' + esc(name) + '</div>' +
              '<div class="ens-account-count">' + chars.length + ' 个角色</div>' +
            '</div>' +
            '<div class="ens-account-arrow"><i class="fa fa-angle-right"></i></div>' +
          '</div>';
      }
      html += '</div>';
      body.innerHTML = html;

      body.querySelectorAll('.ens-account-card').forEach(function(card) {
        card.addEventListener('click', function() {
          var uid = parseInt(card.dataset.uid, 10);
          renderModePicker(page, uid);
        });
      });
    } catch(e) {
      console.error('[Ensemble] account picker error:', e);
      body.innerHTML = '<div class="ens-empty"><div class="ens-empty-title">加载失败</div></div>';
    }
  }

  // Get characters belonging to a user's WeChat
  async function getCharsForUser(ownerUid) {
    try {
      var chars = await db.characters.where('type').notEqual('user').toArray();
      // Filter by WeChat owner
      return chars.filter(function(ch) {
        return !ch.ownerUid || ch.ownerUid === ownerUid;
      });
    } catch(_) {
      return [];
    }
  }

  // ===== Step 2: Mode Picker =====
  async function renderModePicker(page, ownerUid) {
    setState(page, { view: 'modes', ownerUid: ownerUid });
    setTitle(page, '选择模式');
    setHeaderRight(page, '');
    var body = page.querySelector('#ens-body');
    body.innerHTML =
      '<div class="ens-mode-list">' +
        '<div class="ens-mode-card" data-mode="meet">' +
          '<div class="ens-mode-icon"><i class="fa fa-handshake"></i></div>' +
          '<div class="ens-mode-title">见面模式</div>' +
          '<div class="ens-mode-desc">与选中的角色直接聊天，支持动态增减人员</div>' +
        '</div>' +
        '<div class="ens-mode-card" data-mode="script">' +
          '<div class="ens-mode-icon"><i class="fa fa-book-open"></i></div>' +
          '<div class="ens-mode-title">剧本模式</div>' +
          '<div class="ens-mode-desc">AI 生成剧本框架，进入隔离的剧本世界</div>' +
        '</div>' +
      '</div>';

    body.querySelectorAll('.ens-mode-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var mode = card.dataset.mode;
        renderCharPicker(page, ownerUid, mode);
      });
    });
  }

  // ===== Step 3: Character Picker =====
  async function renderCharPicker(page, ownerUid, mode) {
    setState(page, { view: 'chars', ownerUid: ownerUid, mode: mode });
    setTitle(page, '选择角色');
    setHeaderRight(page, '');
    var body = page.querySelector('#ens-body');

    body.innerHTML = '<div class="ens-loading">加载中</div>';

    try {
      var chars = await getCharsForUser(ownerUid);
      if (!chars.length) {
        body.innerHTML =
          '<div class="ens-empty">' +
            '<div class="ens-empty-icon"><i class="fa fa-users"></i></div>' +
            '<div class="ens-empty-title">暂无角色</div>' +
            '<div class="ens-empty-sub">请先创建角色</div>' +
          '</div>';
        return;
      }

      var selected = {};

      function renderList() {
        var html = '<div class="ens-char-list" id="ens-char-list">';
        for (var i = 0; i < chars.length; i++) {
          var ch = chars[i];
          var isSelected = !!selected[ch.id];
          html +=
            '<div class="ens-char-item' + (isSelected ? ' selected' : '') + '" data-cid="' + ch.id + '">' +
              '<div class="ens-char-check"></div>' +
              '<div class="ens-char-avatar">' + avatarHTML(ch.avatar, charName(ch)) + '</div>' +
              '<div class="ens-char-info">' +
                '<div class="ens-char-name">' + esc(charName(ch)) + '</div>' +
                '<div class="ens-char-brief">' + esc(ch.desc || ch.persona || '') + '</div>' +
              '</div>' +
            '</div>';
        }
        html += '</div>';
        html +=
          '<div class="ens-footer">' +
            '<button class="ens-confirm-btn" id="ens-confirm-chars"' +
              (Object.keys(selected).length === 0 ? ' disabled' : '') +
            '>确认 (' + Object.keys(selected).length + ' 人)</button>' +
          '</div>';
        body.innerHTML = html;

        body.querySelectorAll('.ens-char-item').forEach(function(item) {
          item.addEventListener('click', function() {
            var cid = parseInt(item.dataset.cid, 10);
            if (selected[cid]) {
              delete selected[cid];
            } else {
              selected[cid] = true;
            }
            renderList();
          });
        });

        var confirmBtn = body.querySelector('#ens-confirm-chars');
        if (confirmBtn) {
          confirmBtn.addEventListener('click', function() {
            var selectedChars = chars.filter(function(ch) { return !!selected[ch.id]; });
            if (mode === 'meet') {
              enterMeetChat(page, ownerUid, selectedChars);
            } else {
              renderScriptSettings(page, ownerUid, selectedChars, mode);
            }
          });
        }
      }

      renderList();
    } catch(e) {
      console.error('[Ensemble] char picker error:', e);
      body.innerHTML = '<div class="ens-empty"><div class="ens-empty-title">加载失败</div></div>';
    }
  }

  // ===== Enter Meet Chat =====
  function enterMeetChat(page, ownerUid, characters) {
    setState(page, { view: 'chat', ownerUid: ownerUid, mode: 'meet', characters: characters });
    setTitle(page, '群像 - ' + characters.length + '人在线');
    setHeaderRight(page,
      '<button class="ens-header-action" id="ens-personnel" title="现场人员">' +
        '<i class="fa fa-users"></i>' +
      '</button>'
    );
    var body = page.querySelector('#ens-body');
    body.innerHTML = '';

    // Initialize chat engine
    if (window.EnsembleChat) {
      window.EnsembleChat.init({
        page: page,
        body: body,
        ownerUid: ownerUid,
        characters: characters,
        mode: 'meet',
        onPersonnelChange: function(newChars) {
          characters = newChars;
          page._ensState.characters = newChars;
          setTitle(page, '群像 - ' + newChars.length + '人在线');
        }
      });
    }

    // Personnel button
    var personnelBtn = page.querySelector('#ens-personnel');
    if (personnelBtn) {
      personnelBtn.addEventListener('click', function() {
        openPersonnelModal(page, ownerUid, characters, function(newChars) {
          characters = newChars;
          page._ensState.characters = newChars;
          setTitle(page, '群像 - ' + newChars.length + '人在线');
          if (window.EnsembleChat) {
            window.EnsembleChat.updateCharacters(newChars);
          }
        });
      });
    }
  }

  // ===== Enter Script Chat =====
  window._ensEnterScriptChat = function(page, ownerUid, characters, scriptConfig) {
    setState(page, { view: 'chat', ownerUid: ownerUid, mode: 'script', characters: characters });
    setTitle(page, scriptConfig.title || '剧本');
    setHeaderRight(page,
      '<button class="ens-header-action" id="ens-personnel" title="现场人员">' +
        '<i class="fa fa-users"></i>' +
      '</button>'
    );
    var body = page.querySelector('#ens-body');
    body.innerHTML = '';

    if (window.EnsembleChat) {
      window.EnsembleChat.init({
        page: page,
        body: body,
        ownerUid: ownerUid,
        characters: characters,
        mode: 'script',
        scriptConfig: scriptConfig,
        onPersonnelChange: function(newChars) {
          characters = newChars;
          page._ensState.characters = newChars;
        }
      });
    }

    var personnelBtn = page.querySelector('#ens-personnel');
    if (personnelBtn) {
      personnelBtn.addEventListener('click', function() {
        openPersonnelModal(page, ownerUid, characters, function(newChars) {
          characters = newChars;
          page._ensState.characters = newChars;
          if (window.EnsembleChat) {
            window.EnsembleChat.updateCharacters(newChars);
          }
        });
      });
    }
  };

  // ===== Personnel Modal (dynamic add/remove) =====
  async function openPersonnelModal(page, ownerUid, currentChars, onChange) {
    var allChars = await getCharsForUser(ownerUid);
    var currentIds = {};
    currentChars.forEach(function(ch) { currentIds[ch.id] = true; });

    // Create overlay
    var overlay = document.createElement('div');
    overlay.className = 'ens-modal-overlay';
    overlay.innerHTML =
      '<div class="ens-modal">' +
        '<div class="ens-modal-header">' +
          '<span class="ens-modal-title">现场人员</span>' +
          '<button class="ens-modal-close" id="ens-modal-close"><i class="fa fa-xmark"></i></button>' +
        '</div>' +
        '<div class="ens-modal-body" id="ens-modal-body"></div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function() {
      overlay.classList.add('open');
    });

    function closeModal() {
      overlay.classList.remove('open');
      setTimeout(function() { overlay.remove(); }, 300);
    }

    overlay.querySelector('#ens-modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) closeModal();
    });

    function renderModalList() {
      var modalBody = overlay.querySelector('#ens-modal-body');
      var inScene = allChars.filter(function(ch) { return currentIds[ch.id]; });
      var outScene = allChars.filter(function(ch) { return !currentIds[ch.id]; });

      var html = '';
      if (inScene.length) {
        html += '<div class="ens-modal-section-label">在场</div>';
        inScene.forEach(function(ch) {
          html +=
            '<div class="ens-person-row">' +
              '<div class="ens-person-avatar">' + avatarHTML(ch.avatar, charName(ch)) + '</div>' +
              '<div class="ens-person-name">' + esc(charName(ch)) + '</div>' +
              '<button class="ens-person-btn remove" data-cid="' + ch.id + '" data-action="remove">移除</button>' +
            '</div>';
        });
      }
      if (outScene.length) {
        html += '<div class="ens-modal-section-label">不在场</div>';
        outScene.forEach(function(ch) {
          html +=
            '<div class="ens-person-row">' +
              '<div class="ens-person-avatar">' + avatarHTML(ch.avatar, charName(ch)) + '</div>' +
              '<div class="ens-person-name">' + esc(charName(ch)) + '</div>' +
              '<button class="ens-person-btn add" data-cid="' + ch.id + '" data-action="add">加入</button>' +
            '</div>';
        });
      }

      modalBody.innerHTML = html;

      modalBody.querySelectorAll('.ens-person-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var cid = parseInt(btn.dataset.cid, 10);
          var action = btn.dataset.action;
          if (action === 'remove') {
            delete currentIds[cid];
            // Notify chat
            var removed = allChars.find(function(c) { return c.id === cid; });
            if (removed && window.EnsembleChat) {
              window.EnsembleChat.addNotification(charName(removed) + ' 离开了聊天');
            }
          } else if (action === 'add') {
            currentIds[cid] = true;
            var added = allChars.find(function(c) { return c.id === cid; });
            if (added && window.EnsembleChat) {
              window.EnsembleChat.addNotification(charName(added) + ' 加入了聊天');
            }
          }
          var newChars = allChars.filter(function(ch) { return currentIds[ch.id]; });
          onChange(newChars);
          renderModalList();
        });
      });
    }

    renderModalList();
  }

  // ===== Script Settings (rendered by ensemble-script.js) =====
  function renderScriptSettings(page, ownerUid, characters, mode) {
    setState(page, { view: 'script-settings', ownerUid: ownerUid, mode: mode, characters: characters });
    if (window.EnsembleScript) {
      window.EnsembleScript.renderSettings(page, ownerUid, characters);
    }
  }

  // ===== Public API =====
  window.showEnsemblePage = function() {
    window.toast && window.toast('群像正在打开...');
    try {
      var page = createPage();
      renderAccountPicker(page);
    } catch(e) {
      console.error('[Ensemble] open error:', e);
      window.toast && window.toast('群像错误: ' + String(e));
    }
  };

})();
