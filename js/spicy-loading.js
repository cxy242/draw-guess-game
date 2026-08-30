// spicy-loading.js — 星途财弈 · 中转加载页面（2.5s纯动画模拟）
(function () {
  'use strict'

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  // ── 显示加载页面 ──
  // onComplete: 加载完成后的回调
  // onError: 加载失败的回调
  window.SpicyLoading = {
    show: function(onComplete, onError, playerNames) {
      var p1 = (playerNames && playerNames.p1) || '玩家'
      var p2 = (playerNames && playerNames.p2) || '对手'
      var page = document.createElement('div')
      page.id = 'spicy-loading-page'
      page.className = 'full-page'
      page.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:hidden;'

      var phase = 0
      var phases = [
        '建立对局会话',
        '加载20格环形棋盘资源',
        '绑定AI角色记忆上下文',
        '初始化完成'
      ]

      page.innerHTML =
        '<div class="spicy-root" style="justify-content:center;min-height:100vh;">' +
          '<div style="width:100%;max-width:340px;padding:20px;text-align:center;">' +
            // 返回按钮
            '<div style="text-align:left;margin-bottom:24px;">' +
              '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-load-back">返回</button>' +
            '</div>' +

            // 双人对峙
            '<div style="display:flex;justify-content:center;align-items:center;gap:40px;margin-bottom:32px;">' +
              '<div style="text-align:center;">' +
                '<div class="spicy-player-avatar-sm spicy-p1-avatar" style="width:48px;height:48px;font-size:18px;margin:0 auto 6px;">你</div>' +
                '<div style="font-size:11px;color:#888;">玩家</div>' +
              '</div>' +
              '<div style="font-size:24px;font-weight:900;background:linear-gradient(90deg,#ff6b6b,#ffd700);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">VS</div>' +
              '<div style="text-align:center;">' +
                '<div class="spicy-player-avatar-sm spicy-p2-avatar" style="width:48px;height:48px;font-size:18px;margin:0 auto 6px;">AI</div>' +
                '<div style="font-size:11px;color:#888;">对手</div>' +
              '</div>' +
            '</div>' +

            // 静态骰子+棋子预览
            '<div style="display:flex;justify-content:center;gap:20px;margin-bottom:28px;">' +
              '<div style="width:36px;height:36px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);">' +
                '<div style="width:8px;height:8px;border-radius:50%;background:#1a1a2e;"></div>' +
              '</div>' +
              '<div class="spicy-token spicy-token-p1" style="position:static;width:28px;height:28px;"></div>' +
              '<div class="spicy-token spicy-token-p2" style="position:static;width:28px;height:28px;"></div>' +
              '<div style="width:36px;height:36px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.2);">' +
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:6px;">' +
                  '<div style="width:5px;height:5px;border-radius:50%;background:#1a1a2e;"></div>' +
                  '<div></div>' +
                  '<div style="width:5px;height:5px;border-radius:50%;background:#1a1a2e;"></div>' +
                  '<div></div>' +
                  '<div style="width:5px;height:5px;border-radius:50%;background:#1a1a2e;"></div>' +
                  '<div></div>' +
                  '<div style="width:5px;height:5px;border-radius:50%;background:#1a1a2e;"></div>' +
                  '<div></div>' +
                  '<div style="width:5px;height:5px;border-radius:50%;background:#1a1a2e;"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +

            // 状态文字
            '<div id="sp-load-status" style="font-size:13px;color:#aaa;margin-bottom:16px;min-height:20px;">' + phases[0] + '</div>' +

            // 进度条
            '<div style="width:100%;height:6px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;margin-bottom:8px;">' +
              '<div id="sp-load-bar" style="width:0%;height:100%;border-radius:3px;background:linear-gradient(90deg,#667eea,#00f5d4);transition:width 0.3s;"></div>' +
            '</div>' +
            '<div id="sp-load-percent" style="font-size:12px;color:#666;">0%</div>' +

            // 失败状态（隐藏）
            '<div id="sp-load-error" style="display:none;margin-top:20px;">' +
              '<div style="width:32px;height:32px;margin:0 auto 10px;position:relative;">' +
                '<div style="width:32px;height:32px;border-radius:50%;background:rgba(255,60,60,0.2);display:flex;align-items:center;justify-content:center;">' +
                  '<div style="font-size:18px;color:#f44;font-weight:900;">!</div>' +
                '</div>' +
              '</div>' +
              '<div style="font-size:13px;color:#f88;margin-bottom:12px;">API连接异常</div>' +
              '<button class="spicy-btn spicy-btn-primary spicy-btn-sm" id="sp-load-retry">重试加载</button>' +
              '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-load-back-chat" style="margin-left:8px;">返回聊天</button>' +
            '</div>' +
          '</div>' +
        '</div>'

      if (window.openPage) window.openPage(page)
      else document.body.appendChild(page)

      var bar = page.querySelector('#sp-load-bar')
      var percent = page.querySelector('#sp-load-percent')
      var statusEl = page.querySelector('#sp-load-status')
      var errorEl = page.querySelector('#sp-load-error')

      // 返回按钮
      page.querySelector('#sp-load-back').onclick = function() {
        page.remove()
        if (onError) onError('cancelled')
      }

      // 模拟加载进度
      var progress = 0
      var interval = setInterval(function() {
        progress += Math.random() * 15 + 5
        if (progress > 100) progress = 100

        bar.style.width = Math.round(progress) + '%'
        percent.textContent = Math.round(progress) + '%'

        // 更新阶段文字
        var newPhase = Math.min(Math.floor(progress / 25), 3)
        if (newPhase !== phase) {
          phase = newPhase
          statusEl.textContent = phases[phase]
        }

        if (progress >= 100) {
          clearInterval(interval)
          statusEl.textContent = '初始化完成'
          statusEl.style.color = '#ffd700'

          // 金色星光粒子效果（简化版）
          setTimeout(function() {
            page.remove()
            if (onComplete) onComplete()
          }, 800)
        }
      }, 200)

      // 重试按钮
      page.querySelector('#sp-load-retry').onclick = function() {
        errorEl.style.display = 'none'
        progress = 0
        bar.style.width = '0%'
        percent.textContent = '0%'
        phase = 0
        statusEl.textContent = phases[0]
        statusEl.style.color = '#aaa'
        interval = setInterval(arguments.callee, 200) // 简化，实际应重新模拟
      }

      // 返回聊天
      page.querySelector('#sp-load-back-chat').onclick = function() {
        page.remove()
        if (onError) onError('back')
      }

      // 模拟失败测试入口（长按状态文字3秒触发）
      var pressTimer = null
      statusEl.addEventListener('mousedown', function() {
        pressTimer = setTimeout(function() {
          clearInterval(interval)
          errorEl.style.display = 'block'
          bar.style.width = '0%'
          percent.textContent = '0%'
          statusEl.textContent = ''
        }, 3000)
      })
      statusEl.addEventListener('mouseup', function() { clearTimeout(pressTimer) })
      statusEl.addEventListener('touchstart', function() {
        pressTimer = setTimeout(function() {
          clearInterval(interval)
          errorEl.style.display = 'block'
          bar.style.width = '0%'
          percent.textContent = '0%'
          statusEl.textContent = ''
        }, 3000)
      })
      statusEl.addEventListener('touchend', function() { clearTimeout(pressTimer) })
    }
  }

})()
