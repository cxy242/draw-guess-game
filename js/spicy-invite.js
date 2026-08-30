// spicy-invite.js — 星途财弈 · 聊天邀请卡片（精致重制版）
(function () {
  'use strict'

  var INVITE_KEY = 'spicyInviteState'
  var INVITE_DURATION = 600000

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>\"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  function createInviteData(p1Name, p2Name, chatId, charId) {
    return {
      id: 'sp_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,6),
      status: 'waiting', p1Name: p1Name, p2Name: p2Name,
      chatId: chatId, charId: charId,
      createdAt: Date.now(), expiresAt: Date.now() + INVITE_DURATION
    }
  }

  function saveInviteState(data) { try { localStorage.setItem(INVITE_KEY, JSON.stringify(data)) } catch(e){} }
  function loadInviteState() { try { return JSON.parse(localStorage.getItem(INVITE_KEY) || 'null') } catch(e){ return null } }
  function clearInviteState() { try { localStorage.removeItem(INVITE_KEY) } catch(e){} }

  // ── 渲染邀请卡片（4种状态）──
  function renderInviteCard(data) {
    var st = data.status || 'waiting'
    var sender = esc(data.p1Name || '未知')
    var id = esc(data.id)

    // 检查是否过期
    if (st === 'waiting' && Date.now() > data.expiresAt) st = 'expired'

    var tipText, btnHtml, stateClass, statusIcon
    switch (st) {
      case 'waiting':
        stateClass = 'invite-card-state-pending'
        tipText = '等待你加入对局'
        statusIcon = 'waiting'
        btnHtml =
          '<button class="invite-btn btn-enter" data-invite-action="enter" data-invite-id="' + id + '">进入对局</button>' +
          '<button class="invite-btn btn-reject" data-invite-action="reject" data-invite-id="' + id + '">拒绝邀请</button>'
        break
      case 'playing':
        stateClass = 'invite-card-state-playing'
        tipText = '对局正在进行'
        statusIcon = 'playing'
        btnHtml = '<button class="invite-btn btn-view" data-invite-action="view" data-invite-id="' + id + '">查看对局</button>'
        break
      case 'finished':
        stateClass = 'invite-card-state-finished'
        tipText = '对局已结束'
        statusIcon = 'finished'
        btnHtml = '<button class="invite-btn btn-disabled btn-disabled-normal" disabled>对局已结束</button>'
        break
      case 'expired':
        stateClass = 'invite-card-state-expired'
        tipText = '邀请已过期'
        statusIcon = 'expired'
        btnHtml = '<button class="invite-btn btn-disabled btn-disabled-expire" disabled>邀请已过期</button>'
        break
      case 'rejected':
        stateClass = 'invite-card-state-finished'
        tipText = '对方拒绝了邀请'
        statusIcon = 'rejected'
        btnHtml = '<button class="invite-btn btn-disabled btn-disabled-normal" disabled>邀请被拒绝</button>'
        break
      default:
        stateClass = 'invite-card-state-expired'
        tipText = '邀请已过期'
        statusIcon = 'expired'
        btnHtml = '<button class="invite-btn btn-disabled btn-disabled-expire" disabled>邀请已过期</button>'
    }

    var footerNote = st === 'finished' ? '本局游戏已经完结，请发起新对局'
      : st === 'expired' ? '邀请时效失效，请重新发送对局邀请'
      : st === 'playing' ? '点击跳转游戏页面继续桌游对局'
      : '点击跳转游戏页面进行桌游对局'

    return '<div class="invite-card ' + stateClass + '">' +
      '<div class="invite-header">' +
        '<div class="invite-icon-wrap">' +
          '<div class="invite-icon"></div>' +
          '<div class="invite-icon-glow"></div>' +
        '</div>' +
        '<div class="invite-title-wrap">' +
          '<div class="invite-title">星途财弈</div>' +
          '<div class="invite-subtitle">对局邀请</div>' +
        '</div>' +
        '<div class="invite-status-icon invite-status-' + statusIcon + '"></div>' +
      '</div>' +
      '<div class="invite-divider"></div>' +
      '<div class="invite-meta">' +
        '<div class="invite-sender">' +
          '<span class="invite-sender-label">发起者</span>' +
          '<span class="invite-sender-name">' + sender + '</span>' +
        '</div>' +
        '<div class="invite-tip">' +
          '<span class="invite-tip-label">状态</span>' +
          '<span class="invite-tip-text">' + tipText + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="invite-btn-area">' + btnHtml + '</div>' +
      '<div class="invite-footer">' +
        '<div class="invite-note">' + footerNote + '</div>' +
      '</div>' +
    '</div>'
  }

  // ── 注入CSS ──
  function injectCSS() {
    if (document.getElementById('spicy-invite-css')) return
    var s = document.createElement('style')
    s.id = 'spicy-invite-css'
    s.textContent = `
      .invite-card {
        max-width: 340px;
        min-width: 280px;
        border-radius: 20px;
        background: linear-gradient(145deg, #2d2640 0%, #1f1a2e 50%, #2d2640 100%);
        border: 1px solid rgba(180, 160, 220, 0.2);
        box-shadow: 
          0 8px 32px rgba(0, 0, 0, 0.3),
          0 2px 8px rgba(0, 0, 0, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.05);
        padding: 20px;
        font-family: system-ui, -apple-system, sans-serif;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }

      .invite-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(180, 160, 220, 0.3), transparent);
      }

      .invite-card::after {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: radial-gradient(circle at 30% 20%, rgba(180, 160, 220, 0.05) 0%, transparent 50%);
        pointer-events: none;
      }

      .invite-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 16px;
        position: relative;
        z-index: 1;
      }

      .invite-icon-wrap {
        position: relative;
        width: 44px;
        height: 44px;
      }

      .invite-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        background: linear-gradient(135deg, #4a3f6b 0%, #3d345c 100%);
        border: 1.5px solid rgba(180, 160, 220, 0.3);
        position: relative;
        overflow: hidden;
      }

      .invite-icon::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 18px;
        height: 18px;
        background: linear-gradient(135deg, #ffd888 0%, #ffb347 100%);
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(255, 216, 136, 0.4);
      }

      .invite-icon::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 8px;
        height: 8px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 50%;
      }

      .invite-icon-glow {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 60px;
        background: radial-gradient(circle, rgba(255, 216, 136, 0.15) 0%, transparent 70%);
        border-radius: 50%;
        animation: invite-glow-pulse 2s ease-in-out infinite;
      }

      @keyframes invite-glow-pulse {
        0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
      }

      .invite-title-wrap {
        flex: 1;
      }

      .invite-title {
        font-size: 18px;
        font-weight: 700;
        color: #e8e2f4;
        letter-spacing: 0.5px;
        line-height: 1.2;
      }

      .invite-subtitle {
        font-size: 12px;
        color: #a89bc4;
        font-weight: 500;
        margin-top: 2px;
        letter-spacing: 0.3px;
      }

      .invite-status-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        position: relative;
        flex-shrink: 0;
      }

      .invite-status-icon::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 10px;
        height: 10px;
        border-radius: 50%;
      }

      .invite-status-waiting {
        background: rgba(255, 216, 136, 0.15);
        border: 1.5px solid rgba(255, 216, 136, 0.3);
      }
      .invite-status-waiting::before {
        background: #ffd888;
        box-shadow: 0 0 8px rgba(255, 216, 136, 0.5);
        animation: invite-status-blink 1.5s ease-in-out infinite;
      }

      .invite-status-playing {
        background: rgba(0, 245, 212, 0.15);
        border: 1.5px solid rgba(0, 245, 212, 0.3);
      }
      .invite-status-playing::before {
        background: #00f5d4;
        box-shadow: 0 0 8px rgba(0, 245, 212, 0.5);
      }

      .invite-status-finished, .invite-status-rejected {
        background: rgba(160, 150, 180, 0.15);
        border: 1.5px solid rgba(160, 150, 180, 0.3);
      }
      .invite-status-finished::before, .invite-status-rejected::before {
        background: #a096b4;
      }

      .invite-status-expired {
        background: rgba(255, 136, 153, 0.15);
        border: 1.5px solid rgba(255, 136, 153, 0.3);
      }
      .invite-status-expired::before {
        background: #ff8899;
      }

      @keyframes invite-status-blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }

      .invite-divider {
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(180, 160, 220, 0.2), transparent);
        margin: 0 -20px 16px;
        position: relative;
        z-index: 1;
      }

      .invite-meta {
        margin-bottom: 20px;
        position: relative;
        z-index: 1;
      }

      .invite-sender, .invite-tip {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }

      .invite-sender:last-child, .invite-tip:last-child {
        margin-bottom: 0;
      }

      .invite-sender-label, .invite-tip-label {
        font-size: 11px;
        color: #8a7fa0;
        font-weight: 500;
        min-width: 40px;
        letter-spacing: 0.3px;
      }

      .invite-sender-name {
        font-size: 14px;
        color: #d4cce4;
        font-weight: 600;
      }

      .invite-tip-text {
        font-size: 14px;
        color: #e8e2f4;
        font-weight: 500;
      }

      .invite-btn-area {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        position: relative;
        z-index: 1;
      }

      .invite-btn {
        height: 44px;
        min-width: 110px;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        border: none;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
        padding: 0 18px;
        position: relative;
        overflow: hidden;
        letter-spacing: 0.3px;
      }

      .invite-btn:hover {
        transform: translateY(-1px);
      }

      .invite-btn:active {
        transform: scale(0.97) translateY(0);
      }

      .btn-enter {
        background: linear-gradient(135deg, #7b5ea7 0%, #6b4e97 100%);
        color: #fff;
        border: 1px solid rgba(180, 160, 220, 0.3);
        box-shadow: 0 4px 16px rgba(123, 94, 167, 0.3);
      }

      .btn-enter:hover {
        background: linear-gradient(135deg, #8b6eb7 0%, #7b5ea7 100%);
        box-shadow: 0 6px 20px rgba(123, 94, 167, 0.4);
      }

      .btn-enter::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
        transition: left 0.5s ease;
      }

      .btn-enter:hover::before {
        left: 100%;
      }

      .btn-reject {
        background: rgba(60, 50, 80, 0.5);
        color: #b8a8d8;
        border: 1px solid rgba(180, 160, 220, 0.15);
      }

      .btn-reject:hover {
        background: rgba(70, 60, 90, 0.6);
        border-color: rgba(180, 160, 220, 0.25);
      }

      .btn-view {
        background: linear-gradient(135deg, #4a7a6b 0%, #3a6a5b 100%);
        color: #fff;
        border: 1px solid rgba(0, 245, 212, 0.2);
        box-shadow: 0 4px 16px rgba(74, 122, 107, 0.3);
      }

      .btn-view:hover {
        background: linear-gradient(135deg, #5a8a7b 0%, #4a7a6b 100%);
        box-shadow: 0 6px 20px rgba(74, 122, 107, 0.4);
      }

      .btn-disabled {
        background: rgba(40, 35, 60, 0.5);
        cursor: not-allowed;
        transform: none !important;
      }

      .btn-disabled-normal {
        color: #7a7090;
        border: 1px solid rgba(120, 110, 150, 0.2);
      }

      .btn-disabled-expire {
        color: #ff8899;
        border: 1px solid rgba(255, 136, 153, 0.2);
      }

      .invite-footer {
        margin-top: 16px;
        position: relative;
        z-index: 1;
      }

      .invite-note {
        font-size: 11px;
        color: #8a7fa0;
        line-height: 1.4;
        letter-spacing: 0.2px;
      }

      @media (prefers-reduced-motion: reduce) {
        .invite-icon-glow, .invite-status-waiting::before {
          animation: none;
        }
        .invite-btn {
          transition: none;
        }
      }
    `
    document.head.appendChild(s)
  }

  // ── 发送邀请到聊天 ──
  async function sendInviteToChat(chatId, charId, p1Name, p2Name) {
    if (!window.db) return null
    var data = createInviteData(p1Name, p2Name, chatId, charId)
    saveInviteState(data)
    var content = '__SPICY_INVITE__' + JSON.stringify(data)
    try {
      var msgId = await window.db.messages.add({
        chatId: chatId, charId: charId, role: 'user',
        content: content, createdAt: Date.now()
      })
      data.msgId = msgId
      saveInviteState(data)
      return msgId
    } catch(e) { return null }
  }

  // ── 更新邀请状态 ──
  async function updateInviteStatus(msgId, newStatus, extra) {
    if (!window.db || !msgId) return
    try {
      var msg = await window.db.messages.get(msgId)
      if (!msg || !msg.content.startsWith('__SPICY_INVITE__')) return
      var data = JSON.parse(msg.content.slice(16))
      data.status = newStatus
      if (extra) Object.assign(data, extra)
      msg.content = '__SPICY_INVITE__' + JSON.stringify(data)
      await window.db.messages.put(msg)
      saveInviteState(data)
    } catch(e) {}
  }

  // ── 暴露接口 ──
  window.SpicyInvite = {
    create: createInviteData,
    render: renderInviteCard,
    sendToChat: sendInviteToChat,
    updateStatus: updateInviteStatus,
    load: loadInviteState,
    save: saveInviteState,
    clear: clearInviteState,
    injectCSS: injectCSS
  }

  injectCSS()

  // ── 按钮点击委托 ──
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-invite-action]')
    if (!btn) return
    var action = btn.getAttribute('data-invite-action')
    var id = btn.getAttribute('data-invite-id')
    var state = loadInviteState()
    if (!state || state.id !== id) return

    if (action === 'enter' || action === 'view') {
      if (window.SpicyLoading) {
        window.SpicyLoading.show(function() {
          if (window.SpicyMonopoly) window.SpicyMonopoly.open()
        })
      } else {
        if (window.SpicyMonopoly) window.SpicyMonopoly.open()
      }
    } else if (action === 'reject') {
      updateInviteStatus(state.msgId, 'rejected')
      var card = btn.closest('.invite-card')
      if (card) card.outerHTML = renderInviteCard(Object.assign({}, state, { status: 'rejected' }))
    }
  })

})()