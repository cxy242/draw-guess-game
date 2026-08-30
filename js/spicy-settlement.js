// spicy-settlement.js — 星途财弈 · 终局结算页
(function () {
  'use strict'

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  window.SpicySettlement = {
    show: function(gs, onSummary, onReplay, onExit) {
      var page = document.createElement('div')
      page.id = 'spicy-settlement-page'
      page.className = 'full-page'
      page.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;'

      var isWin = gs.winner === 1
      var winName = gs.winner === 0 ? '平局' : (gs.winner === 1 ? gs.p1Name : gs.p2Name) + ' 获胜！'

      page.innerHTML =
        '<div class="spicy-root" style="justify-content:center;min-height:100vh;">' +
          '<div style="width:100%;max-width:360px;padding:20px;">' +

            // 胜负标题
            '<div style="text-align:center;margin-bottom:24px;">' +
              '<div style="font-size:12px;color:#888;margin-bottom:8px;">GAME OVER</div>' +
              '<div style="font-size:28px;font-weight:900;' +
                (isWin ? 'background:linear-gradient(90deg,#ffd700,#ffaa00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;' : 'color:#888;') +
              '">' + esc(winName) + '</div>' +
            '</div>' +

            // 双方资产对比
            '<div style="display:flex;gap:12px;margin-bottom:20px;">' +
              // 玩家1
              '<div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid ' + (gs.winner===1?'rgba(255,215,0,0.3)':'rgba(255,255,255,0.08)') + ';border-radius:12px;padding:14px;text-align:center;">' +
                '<div class="spicy-player-avatar-sm spicy-p1-avatar" style="width:40px;height:40px;font-size:16px;margin:0 auto 8px;">' + esc(gs.p1Name.charAt(0)) + '</div>' +
                '<div style="font-size:13px;font-weight:600;color:#e0e0f0;margin-bottom:6px;">' + esc(gs.p1Name) + '</div>' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">' +
                  '<div class="spicy-gold-icon"></div>' +
                  '<span style="font-size:22px;font-weight:700;color:#ffd700;">' + gs.p1Gold + '</span>' +
                '</div>' +
                '<div style="font-size:11px;color:#888;margin-top:4px;">星币</div>' +
              '</div>' +
              // 玩家2
              '<div style="flex:1;background:rgba(255,255,255,0.04);border:1px solid ' + (gs.winner===2?'rgba(255,215,0,0.3)':'rgba(255,255,255,0.08)') + ';border-radius:12px;padding:14px;text-align:center;">' +
                '<div class="spicy-player-avatar-sm spicy-p2-avatar" style="width:40px;height:40px;font-size:16px;margin:0 auto 8px;">' + esc(gs.p2Name.charAt(0)) + '</div>' +
                '<div style="font-size:13px;font-weight:600;color:#e0e0f0;margin-bottom:6px;">' + esc(gs.p2Name) + '</div>' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:4px;">' +
                  '<div class="spicy-gold-icon"></div>' +
                  '<span style="font-size:22px;font-weight:700;color:#ffd700;">' + gs.p2Gold + '</span>' +
                '</div>' +
                '<div style="font-size:11px;color:#888;margin-top:4px;">星币</div>' +
              '</div>' +
            '</div>' +

            // 对局统计
            '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:14px;margin-bottom:24px;">' +
              '<div style="font-size:12px;color:#888;margin-bottom:8px;">对局统计</div>' +
              '<div style="font-size:13px;color:#ccc;line-height:1.8;">' +
                '总回合：' + gs.round + '<br>' +
                '强度档：' + ({light:'轻',medium:'中',heavy:'重'}[gs.flavor]) +
              '</div>' +
            '</div>' +

            // 按钮
            '<div style="display:flex;flex-direction:column;gap:10px;">' +
              '<button class="spicy-btn spicy-btn-primary spicy-btn-full" id="sp-settle-summary">生成对局记忆总结</button>' +
              '<button class="spicy-btn spicy-btn-ghost spicy-btn-full" id="sp-settle-replay">再来一局</button>' +
              '<button class="spicy-btn spicy-btn-ghost spicy-btn-full" id="sp-settle-exit">返回聊天</button>' +
            '</div>' +
          '</div>' +
        '</div>'

      if (window.openPage) window.openPage(page)
      else document.body.appendChild(page)

      page.querySelector('#sp-settle-summary').onclick = function() {
        page.remove()
        if (onSummary) onSummary()
      }
      page.querySelector('#sp-settle-replay').onclick = function() {
        page.remove()
        if (onReplay) onReplay()
      }
      page.querySelector('#sp-settle-exit').onclick = function() {
        page.remove()
        if (onExit) onExit()
      }
    }
  }

})()
