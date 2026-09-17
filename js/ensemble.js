// ensemble.js - 群像模块入口、模式选择、角色选择、动态人员管理
// 依赖：db.js, main.js, settings.js, wechat.js, ensemble-chat.js, ensemble-script.js

;(function() {
  'use strict';

  // ===== 常量 =====
  var PAGE_ID = 'ensemble-page';

  // ===== 工具函数 =====
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

  // ===== 状态管理 =====
  function setState(page, newState) {
    page._ensState = Object.assign({}, page._ensState || {}, newState);
    updateHeader(page);
  }

  function getState(page) {
    return page._ensState || {};
  }

  function updateHeader(page) {
    var btn = page.querySelector('#ens-settings');
    if (!btn) return;
    var state = getState(page);
    btn.style.display = state.view === 'chat' ? 'flex' : 'none';
  }

  function setTitle(page, title) {
    var el = page.querySelector('#ens-title');
    if (el) el.textContent = title;
  }

  // ===== 返回逻辑 =====
  async function handleBack(page) {
    var state = getState(page);
    if (state.view === 'chat') {
      await renderModePicker(page, state.ownerUid, state.selectedItems);
    } else if (state.view === 'modes') {
      await renderCharPicker(page, state.ownerUid);
    } else if (state.view === 'chars') {
      await renderAccountPicker(page);
    } else {
      window.closePage(PAGE_ID);
    }
  }

  // ===== 账号选择页 =====
  async function renderAccountPicker(page) {
    setState(page, { view: 'accounts' });
    setTitle(page, '群像');
    var body = page.querySelector('#ens-body');
    if (!body) return;

    body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

    try {
      var users = await db.characters.where('type').equals('user').toArray();
      users.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });

      if (!users.length) {
        body.innerHTML = '<div class="miss-empty">' +
          '<i class="fa fa-user"></i>' +
          '<div>暂无微信账号</div>' +
          '<span>请先在微信里登录或创建 USER 角色</span>' +
          '</div>';
        return;
      }

      var html = '<div class="miss-section-title">选择微信账号</div>' +
        '<div class="miss-list">';
      users.forEach(function(user) {
        html += '<button class="miss-row ens-account-row" data-owner-uid="' + user.id + '">' +
          '<div class="miss-avatar">' + avatarHTML(user.avatar || '', user.name || '') + '</div>' +
          '<div class="miss-row-main">' +
          '<div class="miss-row-title">' + esc(user.name || '') + '</div>' +
          '<div class="miss-row-sub">' + esc(user.description || '微信账号') + '</div>' +
          '</div>' +
          '<i class="fa fa-angle-right"></i>' +
          '</button>';
      });
      html += '</div>';
      body.innerHTML = html;

      body.querySelectorAll('.ens-account-row').forEach(function(row) {
        row.addEventListener('click', function() {
          renderCharPicker(page, parseInt(row.dataset.ownerUid));
        });
      });
    } catch (e) {
      console.error('[ensemble] renderAccountPicker error:', e);
      body.innerHTML = '<div class="miss-empty"><div>加载失败</div></div>';
    }
  }

  // ===== 角色选择页（多选） =====
  async function renderCharPicker(page, ownerUid) {
    setState(page, { view: 'chars', ownerUid: ownerUid });
    setTitle(page, '选择角色');
    var body = page.querySelector('#ens-body');
    if (!body) return;

    body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>';

    try {
      var chats = await db.chats.toArray();
      chats = chats.filter(function(c) { return c.ownerUid === ownerUid; });
      var items = [];
      for (var i = 0; i < chats.length; i++) {
        var chat = chats[i];
        var char = await window.getCharacter(chat.charId);
        if (!char) continue;
        items.push({ chat: chat, char: char, name: charName(char), avatar: char.avatar || '' });
      }

      if (!items.length) {
        body.innerHTML = '<div class="miss-empty">' +
          '<i class="fa fa-users"></i>' +
          '<div>暂无角色</div>' +
          '<span>请先在微信里和角色建立私聊</span>' +
          '</div>';
        return;
      }

      var selected = {};
      var html = '<div class="miss-section-title">选择角色（可多选）</div>' +
        '<div class="miss-list ens-char-list">';
      items.forEach(function(item) {
        html += '<button class="miss-row ens-char-row" data-char-id="' + item.char.id + '" data-chat-id="' + item.chat.id + '">' +
          '<div class="miss-avatar">' + avatarHTML(item.avatar, item.name) + '</div>' +
          '<div class="miss-row-main">' +
          '<div class="miss-row-title">' + esc(item.name) + '</div>' +
          '<div class="miss-row-sub">' + esc(item.char.description || '') + '</div>' +
          '</div>' +
          '<div class="ens-check"><i class="fa fa-check" style="display:none"></i></div>' +
          '</button>';
      });
      html += '</div>';
      html += '<div class="ens-confirm-bar">' +
        '<button class="btn-pill" id="ens-confirm-chars" disabled>确认选择</button>' +
        '</div>';
      body.innerHTML = html;

      body.querySelectorAll('.ens-char-row').forEach(function(row) {
        row.addEventListener('click', function() {
          var charId = parseInt(row.dataset.charId);
          var check = row.querySelector('.ens-check i');
          if (selected[charId]) {
            delete selected[charId];
            if (check) check.style.display = 'none';
            row.classList.remove('selected');
          } else {
            selected[charId] = {
              id: charId,
              chatId: parseInt(row.dataset.chatId),
              name: row.querySelector('.miss-row-title').textContent,
              avatar: '',
              description: row.querySelector('.miss-row-sub').textContent
            };
            if (check) check.style.display = 'inline';
            row.classList.add('selected');
          }
          var btn = body.querySelector('#ens-confirm-chars');
          if (btn) btn.disabled = Object.keys(selected).length === 0;
        });
      });

      body.querySelector('#ens-confirm-chars').addEventListener('click', function() {
        var selectedItems = Object.values(selected);
        if (selectedItems.length === 0) return;
        renderModePicker(page, ownerUid, selectedItems);
      });
    } catch (e) {
      console.error('[ensemble] renderCharPicker error:', e);
      body.innerHTML = '<div class="miss-empty"><div>加载失败</div></div>';
    }
  }

  // ===== 模式选择页 =====
  async function renderModePicker(page, ownerUid, selectedItems) {
    setState(page, { view: 'modes', ownerUid: ownerUid, selectedItems: selectedItems });
    setTitle(page, '选择模式');
    var body = page.querySelector('#ens-body');
    if (!body) return;

    var names = selectedItems.map(function(c) { return c.name; }).join('、');
    body.innerHTML = '<div class="miss-section-title">已选角色：' + esc(names) + '</div>' +
      '<div class="ens-mode-grid">' +
      '<button class="ens-mode-card" data-mode="meet">' +
      '<div class="ens-mode-icon"><i class="fa-solid fa-people-group"></i></div>' +
      '<div class="ens-mode-title">见面模式</div>' +
      '<div class="ens-mode-desc">直接与选中角色聊天，支持动态增删人员</div>' +
      '</button>' +
      '<button class="ens-mode-card" data-mode="script">' +
      '<div class="ens-mode-icon"><i class="fa-solid fa-book-open"></i></div>' +
      '<div class="ens-mode-title">剧本模式</div>' +
      '<div class="ens-mode-desc">AI生成剧本框架，进入隔离的剧本世界</div>' +
      '</button>' +
      '</div>';

    body.querySelectorAll('.ens-mode-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var mode = card.dataset.mode;
        if (mode === 'meet') {
          enterMeetMode(page, ownerUid, selectedItems);
        } else if (mode === 'script') {
          if (window.EnsembleScript) {
            window.EnsembleScript.openSettings(page, ownerUid, selectedItems);
          } else {
            window.toast('剧本模块未加载');
          }
        }
      });
    });
  }

  // ===== 进入见面模式 =====
  function enterMeetMode(page, ownerUid, selectedItems) {
    setState(page, {
      view: 'chat',
      mode: 'meet',
      ownerUid: ownerUid,
      selectedItems: selectedItems,
      currentChars: selectedItems.slice()
    });
    setTitle(page, '群像 · ' + selectedItems.length + '人在线');

    if (window.EnsembleChat) {
      window.EnsembleChat.start(page, ownerUid, selectedItems, 'meet');
    } else {
      window.toast('聊天模块未加载');
    }
  }

  // ===== 人员管理弹窗 =====
  function showPersonnelModal(page) {
    var state = getState(page);
    var allChars = state.selectedItems || [];
    var currentChars = state.currentChars || [];

    var overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    var modal = document.createElement('div');
    modal.className = 'center-modal ens-personnel-modal';

    var html = '<div class="sheet-title">现场人员管理</div>' +
      '<div class="ens-personnel-list">' +
      '<div class="ens-section-label">在场角色</div>';

    currentChars.forEach(function(ch) {
      html += '<div class="ens-person-row">' +
        '<div class="miss-avatar">' + avatarHTML(ch.avatar || '', ch.name) + '</div>' +
        '<div class="ens-person-name">' + esc(ch.name) + '</div>' +
        '<button class="ens-remove-btn" data-char-id="' + ch.id + '">移除</button>' +
        '</div>';
    });

    html += '<div class="ens-section-label">不在场角色</div>';
    allChars.filter(function(c) {
      return !currentChars.find(function(cc) { return cc.id === c.id; });
    }).forEach(function(ch) {
      html += '<div class="ens-person-row">' +
        '<div class="miss-avatar">' + avatarHTML(ch.avatar || '', ch.name) + '</div>' +
        '<div class="ens-person-name">' + esc(ch.name) + '</div>' +
        '<button class="ens-add-btn" data-char-id="' + ch.id + '">加入</button>' +
        '</div>';
    });

    html += '</div>' +
      '<div class="sheet-actions">' +
      '<button class="btn-pill btn-full" id="ens-personnel-close">关闭</button>' +
      '</div>';
    modal.innerHTML = html;

    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    requestAnimationFrame(function() {
      overlay.classList.add('show');
      modal.classList.add('show');
    });

    function close() {
      overlay.classList.remove('show');
      modal.classList.remove('show');
      setTimeout(function() {
        overlay.remove();
        modal.remove();
      }, 300);
    }

    modal.querySelectorAll('.ens-remove-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var charId = parseInt(btn.dataset.charId);
        var ch = currentChars.find(function(c) { return c.id === charId; });
        if (ch) {
          state.currentChars = currentChars.filter(function(c) { return c.id !== charId; });
          if (window.EnsembleChat) {
            await window.EnsembleChat.addSystemMessage(page, ch.name + ' 离开了聊天');
          }
          close();
          showPersonnelModal(page);
          setTitle(page, '群像 · ' + state.currentChars.length + '人在线');
        }
      });
    });

    modal.querySelectorAll('.ens-add-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var charId = parseInt(btn.dataset.charId);
        var ch = allChars.find(function(c) { return c.id === charId; });
        if (ch) {
          state.currentChars.push(ch);
          if (window.EnsembleChat) {
            await window.EnsembleChat.addSystemMessage(page, ch.name + ' 加入了聊天');
          }
          close();
          showPersonnelModal(page);
          setTitle(page, '群像 · ' + state.currentChars.length + '人在线');
        }
      });
    });

    modal.querySelector('#ens-personnel-close').addEventListener('click', close);
    overlay.addEventListener('click', close);
  }

  // ===== 暴露全局函数 =====
  window.showEnsemblePage = async function() {
    window.toast && window.toast('群像正在打开...');
    try {
      var existing = document.getElementById(PAGE_ID);
      if (existing) existing.remove();

      var page = document.createElement('div');
      page.id = PAGE_ID;
      page.className = 'full-page ens-page';
      page.innerHTML = '<div class="page-header ens-header">' +
        '<button class="header-back" id="ens-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="header-title" id="ens-title">群像</span>' +
        '<button class="btn-icon ens-settings-btn" id="ens-settings" title="设置" style="display:none">' +
        '<i class="fa-solid fa-ellipsis-vertical"></i>' +
        '</button>' +
        '</div>' +
        '<div class="ens-body" id="ens-body"></div>';

      page.querySelector('#ens-back').addEventListener('click', function() { handleBack(page); });
      page.querySelector('#ens-settings').addEventListener('click', function() {
        var state = getState(page);
        if (state.view === 'chat' && window.EnsembleChat) {
          window.EnsembleChat.openSettings(page);
        }
      });

      window.openPage(page);
      await renderAccountPicker(page);
    } catch (e) {
      console.error('[ensemble] showEnsemblePage error:', e);
      window.toast && window.toast('群像打开失败：' + (e.message || e));
    }
  };

  // 暴露给其他模块
  window.EnsembleCore = {
    getState: getState,
    setState: setState,
    setTitle: setTitle,
    showPersonnelModal: showPersonnelModal,
    esc: esc,
    avatarHTML: avatarHTML,
    charName: charName
  };

})();
