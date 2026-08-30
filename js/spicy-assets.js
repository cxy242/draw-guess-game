// spicy-assets.js — 星途财弈 · 资产侧边抽屉面板（仅星币余额，无地产）
(function () {
  'use strict'

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  window.SpicyAssets = {
    show: function(gs) {
      // 移除旧的
      var old = document.querySelector('.spicy-assets-overlay')
      if (old) old.remove()

      var overlay = document.createElement('div')
      overlay.className = 'spicy-assets-overlay'
      overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);display:flex;justify-content:flex-end;animation:spicy-fadeIn 0.2s ease;'

      var drawer = document.createElement('div')
      drawer.style.cssText = 'width:280px;height:100%;background:linear-gradient(180deg,#1a1033,#0d0d1a);padding:20px;overflow-y:auto;animation:spicy-slideIn 0.3s ease;'

      drawer.innerHTML =
        '<div style="display:flex;align-items:center;margin-bottom:20px;">' +
          '<div style="font-size:16px;font-weight:700;color:#fff;">资产面板</div>' +
          '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-assets-close" style="margin-left:auto;">关闭</button>' +
        '</div>' +

        // 玩家1
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<div class="spicy-player-avatar-sm spicy-p1-avatar" style="width:36px;height:36px;font-size:14px;">' + esc(gs.p1Name.charAt(0)) + '</div>' +
            '<div>' +
              '<div style="font-size:14px;font-weight:600;color:#e0e0f0;">' + esc(gs.p1Name) + '</div>' +
              '<div style="font-size:11px;color:#888;">玩家</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div class="spicy-gold-icon"></div>' +
            '<span style="font-size:20px;font-weight:700;color:#ffd700;">' + gs.p1Gold + '</span>' +
            '<span style="font-size:12px;color:#888;margin-left:4px;">星币</span>' +
          '</div>' +
        '</div>' +

        // 玩家2
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:12px;">' +
          '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">' +
            '<div class="spicy-player-avatar-sm spicy-p2-avatar" style="width:36px;height:36px;font-size:14px;">' + esc(gs.p2Name.charAt(0)) + '</div>' +
            '<div>' +
              '<div style="font-size:14px;font-weight:600;color:#e0e0f0;">' + esc(gs.p2Name) + '</div>' +
              '<div style="font-size:11px;color:#888;">对手</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:6px;">' +
            '<div class="spicy-gold-icon"></div>' +
            '<span style="font-size:20px;font-weight:700;color:#ffd700;">' + gs.p2Gold + '</span>' +
            '<span style="font-size:12px;color:#888;margin-left:4px;">星币</span>' +
          '</div>' +
        '</div>' +

        // 对局信息
        '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;">' +
          '<div style="font-size:12px;color:#888;margin-bottom:8px;">对局信息</div>' +
          '<div style="font-size:13px;color:#ccc;line-height:1.8;">' +
            '回合：' + gs.round + ' / ' + gs.totalRounds + '<br>' +
            '强度档：' + ({light:'轻',medium:'中',heavy:'重'}[gs.flavor]) + '<br>' +
            '轮到：' + (gs.currentPlayer === 1 ? esc(gs.p1Name) : esc(gs.p2Name)) +
          '</div>' +
        '</div>'

      overlay.appendChild(drawer)
      document.body.appendChild(overlay)

      // 关闭
      overlay.querySelector('#sp-assets-close').onclick = function() { overlay.remove() }
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove()
      })
    }
  }

  // 添加滑入动画
  var style = document.createElement('style')
  style.textContent = '@keyframes spicy-slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}'
  document.head.appendChild(style)

})()
