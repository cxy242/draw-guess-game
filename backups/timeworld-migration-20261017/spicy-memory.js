// spicy-memory.js — 星途财弈 · 记忆总结（带加载页面）
(function () {
  'use strict'

  var UNFINISHED_KEY = 'spicyUnfinished'
  var MAX_RETRIES = 3

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  // ── 显示加载页面 ──
  function showLoadingPage(text) {
    var page = document.createElement('div')
    page.id = 'spicy-memory-page'
    page.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0a0a1a;'
    page.innerHTML =
      '<div class="spicy-root" style="justify-content:center;min-height:100vh;">' +
        '<div style="width:100%;max-width:340px;padding:20px;text-align:center;">' +
          '<div style="width:56px;height:56px;border-radius:50%;background:rgba(102,126,234,0.15);margin:0 auto 20px;display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:24px;height:24px;border:3px solid rgba(102,126,234,0.3);border-top-color:#667eea;border-radius:50%;animation:spin 1s linear infinite;"></div>' +
          '</div>' +
          '<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;" id="sp-mem-title">' + esc(text || '总结记忆中...') + '</div>' +
          '<div style="font-size:13px;color:#aaa;" id="sp-mem-sub">正在调用AI生成对局总结</div>' +
          '<div style="margin-top:24px;">' +
            '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-mem-cancel">跳过总结</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    // 加旋转动画CSS
    var style = document.createElement('style')
    style.textContent = '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
    page.appendChild(style)

    if (window.openPage) window.openPage(page)
    else document.body.appendChild(page)

    return page
  }

  function updateLoadingText(page, title, sub) {
    if (!page) return
    var t = page.querySelector('#sp-mem-title')
    var s = page.querySelector('#sp-mem-sub')
    if (t) t.textContent = title
    if (s) s.textContent = sub
  }

  function removePage(page) {
    if (page) page.remove()
  }

  // ── 调用API生成总结 ──
  async function generateSummary(gs, page) {
    var prompt = '用2-3句话总结这场星途财弈对局：\n' +
      gs.p1Name + '(金币:' + gs.p1Gold + ') vs ' + gs.p2Name + '(金币:' + gs.p2Gold + ')\n' +
      '共' + gs.round + '回合，胜者：' + (gs.winner === 0 ? '平局' : (gs.winner === 1 ? gs.p1Name : gs.p2Name)) + '\n' +
      '请用角色的语气来总结。'

    for (var i = 0; i < MAX_RETRIES; i++) {
      updateLoadingText(page, '总结记忆中...', '正在生成对局总结 (' + (i+1) + '/' + MAX_RETRIES + ')')

      try {
        var summary = await window.callGameAI([{ role: 'user', content: prompt }], {
          system: '你是星途财弈的对局记录员。用2-3句话简短总结对局结果和亮点。',
          temperature: 0.7
        })
        if (summary && summary.length > 5) {
          return { success: true, text: summary }
        }
      } catch(e) {
        console.log('[SpicyMemory] 总结失败:', e.message)
      }

      // 等1秒再重试
      await new Promise(function(r) { setTimeout(r, 1000) })
    }
    return { success: false, text: '' }
  }

  // ── 写入lorebook ──
  async function writeToLorebook(gs, summary) {
    try {
      if (!window.db) return false

      var books = []
      try {
        var row = await window.db.config.get('lorebooks')
        books = row && row.value ? row.value.slice() : []
      } catch(e) {}

      // 找到或创建星途财弈专属记忆本
      var gameBook = books.find(function(b) { return b.name === '星途财弈对局记录' })
      if (!gameBook) {
        gameBook = {
          id: 'spicy_book_' + Date.now().toString(36),
          name: '星途财弈对局记录',
          entries: [],
          createdAt: Date.now()
        }
        books.push(gameBook)
      }

      // 创建记忆条目（符合lorebook标准格式）
      var entry = {
        id: 'sp_entry_' + Date.now().toString(36),
        title: gs.p1Name + ' vs ' + gs.p2Name + ' 第' + gs.round + '回合',
        content: summary,
        keywords: ['星途财弈', gs.p2Name, gs.aiCharId ? String(gs.aiCharId) : ''],
        enabled: true,
        position: 'after',
        createdAt: Date.now()
      }
      // 关联角色ID
      if (gs.aiCharId) entry.charIds = [gs.aiCharId]

      gameBook.entries.push(entry)

      await window.db.config.put({ key: 'lorebooks', value: books })
      return true
    } catch(e) {
      console.log('[SpicyMemory] 写入lorebook失败:', e.message)
      return false
    }
  }

  // ── 缓存未完成的总结 ──
  function cacheUnfinished(gs, summary) {
    try {
      var cache = JSON.parse(localStorage.getItem(UNFINISHED_KEY) || '[]')
      cache.push({ gs: gs, summary: summary, time: Date.now() })
      localStorage.setItem(UNFINISHED_KEY, JSON.stringify(cache))
    } catch(e) {}
  }

  // ── 显示成功页面 ──
  function showSuccess(summaryText, onDone) {
    var page = document.createElement('div')
    page.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0a0a1a;'
    page.innerHTML =
      '<div class="spicy-root" style="justify-content:center;min-height:100vh;">' +
        '<div style="width:100%;max-width:340px;padding:20px;text-align:center;">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:rgba(0,245,160,0.15);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">' +
            '<div style="width:20px;height:12px;border-left:3px solid #00f5a0;border-bottom:3px solid #00f5a0;transform:rotate(-45deg);margin:4px auto;"></div>' +
          '</div>' +
          '<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;">总结完成</div>' +
          '<div style="font-size:13px;color:#ccc;line-height:1.6;margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;text-align:left;">' + esc(summaryText) + '</div>' +
          '<div style="font-size:12px;color:#888;margin-bottom:20px;">对局记忆已写入记忆库</div>' +
          '<button class="spicy-btn spicy-btn-primary spicy-btn-full" id="sp-mem-done">返回聊天</button>' +
        '</div>' +
      '</div>'

    if (window.openPage) window.openPage(page)
    else document.body.appendChild(page)

    page.querySelector('#sp-mem-done').onclick = function() {
      page.remove()
      if (onDone) onDone()
    }
  }

  // ── 显示失败页面 ──
  function showFailure(gs, retries, onRetry, onSkip) {
    var page = document.createElement('div')
    page.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#0a0a1a;'
    page.innerHTML =
      '<div class="spicy-root" style="justify-content:center;min-height:100vh;">' +
        '<div style="width:100%;max-width:340px;padding:20px;text-align:center;">' +
          '<div style="width:48px;height:48px;border-radius:50%;background:rgba(255,60,60,0.15);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">' +
            '<div style="font-size:24px;color:#f44;font-weight:900;">!</div>' +
          '</div>' +
          '<div style="font-size:17px;font-weight:700;color:#fff;margin-bottom:8px;">总结失败</div>' +
          '<div style="font-size:13px;color:#aaa;margin-bottom:6px;">已重试 ' + retries + ' 次</div>' +
          '<div style="font-size:12px;color:#888;margin-bottom:24px;">对局原始记录已缓存，可稍后再试</div>' +
          '<button class="spicy-btn spicy-btn-primary spicy-btn-full" id="sp-mem-retry" style="margin-bottom:10px;">重新尝试总结</button>' +
          '<button class="spicy-btn spicy-btn-ghost spicy-btn-full" id="sp-mem-skip">保存原始记录直接退出</button>' +
        '</div>' +
      '</div>'

    if (window.openPage) window.openPage(page)
    else document.body.appendChild(page)

    page.querySelector('#sp-mem-retry').onclick = function() { page.remove(); if (onRetry) onRetry() }
    page.querySelector('#sp-mem-skip').onclick = function() {
      cacheUnfinished(gs, null)
      page.remove()
      if (onSkip) onSkip()
    }
  }

  // ── 主流程 ──
  window.SpicyMemory = {
    process: async function(gs, onDone) {
      // 1. 显示加载页面
      var loadingPage = showLoadingPage('总结记忆中...')

      // 2. 绑定跳过按钮
      var cancelled = false
      var cancelBtn = loadingPage.querySelector('#sp-mem-cancel')
      if (cancelBtn) {
        cancelBtn.onclick = function() {
          cancelled = true
          removePage(loadingPage)
          if (onDone) onDone()
        }
      }

      // 3. 生成总结
      var result = await generateSummary(gs, loadingPage)

      if (cancelled) return

      if (result.success) {
        // 4. 写入lorebook
        updateLoadingText(loadingPage, '写入记忆中...', '正在写入记忆库...')
        var writeOk = await writeToLorebook(gs, result.text)

        removePage(loadingPage)

        if (writeOk) {
          showSuccess(result.text, onDone)
        } else {
          cacheUnfinished(gs, result.text)
          showFailure(gs, MAX_RETRIES,
            function() { window.SpicyMemory.process(gs, onDone) },
            onDone
          )
        }
      } else {
        removePage(loadingPage)
        cacheUnfinished(gs, null)
        showFailure(gs, MAX_RETRIES,
          function() { window.SpicyMemory.process(gs, onDone) },
          onDone
        )
      }
    },

    hasPending: function() {
      try { return (JSON.parse(localStorage.getItem(UNFINISHED_KEY) || '[]')).length > 0 }
      catch(e) { return false }
    },

    processPending: async function(onDone) {
      try {
        var cache = JSON.parse(localStorage.getItem(UNFINISHED_KEY) || '[]')
        if (!cache.length) return
        var item = cache[0]
        var result = await generateSummary(item.gs, null)
        if (result.success) {
          var writeOk = await writeToLorebook(item.gs, result.text)
          if (writeOk) {
            cache.shift()
            localStorage.setItem(UNFINISHED_KEY, JSON.stringify(cache))
            if (window.toast) window.toast('缓存的对局总结已写入')
          }
        }
      } catch(e) {}
      if (onDone) onDone()
    }
  }

})()
