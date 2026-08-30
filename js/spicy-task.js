// spicy-task.js — 星途财弈 · 任务线下页面（同意/拒绝/对话）
(function () {
  'use strict'

  function esc(s) { return window.escapeMainHtml ? window.escapeMainHtml(s) : String(s||'').replace(/[&<>"']/g, function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]}) }

  // ── 构建任务系统提示词 ──
  function buildSystemPrompt(aiChar, task, gs) {
    var persona = aiChar.persona || aiChar.description || aiChar.bio || ''
    var aiName = aiChar.name || aiChar.nickname || '对手'
    var p1Name = gs.p1Name

    return '你是「' + aiName + '」，以下是你的人设：\n' + persona + '\n\n' +
      '你正在和「' + p1Name + '」玩「星途财弈」棋盘游戏。\n' +
      '当前是第 ' + gs.round + ' 回合，你的金币：' + gs.p2Gold + '，对手金币：' + gs.p1Gold + '。\n\n' +
      '【当前任务】\n' +
      (task.内容 || '').replace(/行动方/g, p1Name).replace(/对方/g, aiName) + '\n\n' +
      '【任务奖励】同意完成可获得 ' + Math.min(task.强度 || 1, 3) + ' 星币\n' +
      '【拒绝惩罚】拒绝将失去 2 星币\n\n' +
      '【你的工作】\n' +
      '用「' + aiName + '」的口吻和性格，对这个任务做出回应：\n' +
      '1. 先用角色语气回应任务（带动作描写，2-4句话）\n' +
      '2. 然后给出任务执行的具体表现（3-5句话）\n' +
      '3. 最后用一句话总结完成效果\n\n' +
      '完全代入角色，语气自然。只输出纯文本。'
  }

  // ── AI踩到任务时的自动处理 ──
  async function aiAutoTask(aiChar, task, gs) {
    var aiName = aiChar.name || aiChar.nickname || '对手'
    var systemPrompt = buildSystemPrompt(aiChar, task, gs)

    try {
      var reply = await window.callGameAI([{ role: 'user', content: '请对这个任务做出回应。' }], {
        system: systemPrompt,
        temperature: 0.85
      })
      // AI默认同意任务
      return { agree: true, response: reply || aiName + ' 默默接受了任务' }
    } catch(e) {
      return { agree: true, response: aiName + ' 微微一笑，接受了任务。' }
    }
  }

  // ── 显示任务页面（玩家踩到任务时）──
  function showTaskPage(task, aiChar, gs, onAgree, onRefuse, onTempExit) {
    var aiName = aiChar.name || aiChar.nickname || '对手'
    var p1Name = gs.p1Name
    var reward = Math.min(task.强度 || 1, 3)
    var penalty = 2

    var page = document.createElement('div')
    page.id = 'spicy-task-page'
    page.className = 'full-page'
    page.style.cssText = 'position:fixed;inset:0;z-index:9999;overflow:auto;background:#0a0a1a;'

    var taskContent = (task.内容 || '').replace(/行动方/g, esc(p1Name)).replace(/对方/g, esc(aiName))
    var systemPrompt = buildSystemPrompt(aiChar, task, gs)
    var chatHistory = []

    page.innerHTML =
      '<div class="spicy-root">' +
        '<div style="width:100%;max-width:400px;padding:16px;">' +
          // 顶部导航
          '<div style="display:flex;align-items:center;margin-bottom:16px;">' +
            '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-task-back">返回棋盘</button>' +
            '<div style="font-size:14px;font-weight:700;color:#fff;margin-left:auto;margin-right:auto;">任务事件</div>' +
            '<button class="spicy-btn spicy-btn-ghost spicy-btn-sm" id="sp-task-temp-exit">临时退出</button>' +
          '</div>' +

          // 任务卡
          '<div class="spicy-event-card" style="margin-bottom:12px;">' +
            '<div class="spicy-event-type">' +
              '<span class="spicy-event-type-dot" style="background:#667eea;"></span>' +
              '<span>任务 · 强度 ' + (task.强度 || 1) + '</span>' +
            '</div>' +
            '<div class="spicy-event-msg">' + esc(taskContent) + '</div>' +
          '</div>' +

          // 奖惩说明
          '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
            '<div style="flex:1;background:rgba(0,245,160,0.08);border:1px solid rgba(0,245,160,0.2);border-radius:10px;padding:10px;text-align:center;">' +
              '<div style="font-size:11px;color:#00f5a0;margin-bottom:4px;">同意奖励</div>' +
              '<div style="font-size:18px;font-weight:700;color:#ffd700;">+' + reward + ' 星币</div>' +
            '</div>' +
            '<div style="flex:1;background:rgba(255,60,60,0.08);border:1px solid rgba(255,60,60,0.2);border-radius:10px;padding:10px;text-align:center;">' +
              '<div style="font-size:11px;color:#f66;margin-bottom:4px;">拒绝惩罚</div>' +
              '<div style="font-size:18px;font-weight:700;color:#f66;">-' + penalty + ' 星币</div>' +
            '</div>' +
          '</div>' +

          // AI回应区
          '<div style="margin-bottom:16px;">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
              '<div class="spicy-player-avatar-sm spicy-p2-avatar" style="width:28px;height:28px;font-size:12px;">' + esc(aiName.charAt(0)) + '</div>' +
              '<span style="font-size:13px;font-weight:600;color:#e0e0f0;">' + esc(aiName) + '</span>' +
              '<span style="font-size:11px;color:#888;">的回应</span>' +
            '</div>' +
            '<div class="spicy-event-card" id="sp-task-ai-response" style="min-height:60px;">' +
              '<div style="text-align:center;padding:16px;">' +
                '<div style="font-size:12px;color:#888;">' + esc(aiName) + ' 正在思考中</div>' +
                '<div style="margin-top:6px;">' +
                  '<div style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#667eea;animation:spicy-dot 1.4s infinite;"></div> ' +
                  '<div style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#667eea;animation:spicy-dot 1.4s 0.2s infinite;"></div> ' +
                  '<div style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#667eea;animation:spicy-dot 1.4s 0.4s infinite;"></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +

          // 操作按钮
          '<div id="sp-task-actions" style="display:flex;gap:10px;margin-bottom:16px;">' +
            '<button class="spicy-btn spicy-btn-primary" id="sp-task-agree" disabled style="flex:2;">同意任务 (+' + reward + '星币)</button>' +
            '<button class="spicy-btn spicy-btn-ghost" id="sp-task-refuse" disabled style="flex:1;">拒绝 (-' + penalty + '星币)</button>' +
          '</div>' +

          // 对话区
          '<div id="sp-task-chat" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:12px;">' +
            '<div style="display:flex;gap:8px;">' +
              '<input type="text" id="sp-task-input" placeholder="跟' + esc(aiName) + '说点什么..." ' +
                'style="flex:1;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.06);color:#e0e0f0;font-size:13px;outline:none;">' +
              '<button class="spicy-btn spicy-btn-primary spicy-btn-sm" id="sp-task-send">发送</button>' +
            '</div>' +
            '<div id="sp-task-messages" style="margin-top:10px;max-height:200px;overflow-y:auto;"></div>' +
          '</div>' +
        '</div>' +
      '</div>'

    // 加载动画CSS
    var style = document.createElement('style')
    style.textContent = '@keyframes spicy-dot{0%,80%,100%{opacity:0.3;transform:scale(0.8)}40%{opacity:1;transform:scale(1.2)}}'
    page.appendChild(style)

    if (window.openPage) window.openPage(page)
    else document.body.appendChild(page)

    var agreeBtn = page.querySelector('#sp-task-agree')
    var refuseBtn = page.querySelector('#sp-task-refuse')
    var responseEl = page.querySelector('#sp-task-ai-response')

    // 返回棋盘（视为拒绝）
    page.querySelector('#sp-task-back').onclick = function() {
      page.remove()
      if (onRefuse) onRefuse()
    }

    // 临时退出
    page.querySelector('#sp-task-temp-exit').onclick = function() {
      if (window.SpicyModals) {
        window.SpicyModals.showSaveExitModal().then(function(result) {
          if (result.saveAndExit) {
            page.remove()
            if (onTempExit) onTempExit()
          }
        })
      }
    }

    // 同意任务
    agreeBtn.onclick = function() {
      if (agreeBtn.disabled) return
      page.remove()
      if (onAgree) onAgree()
    }

    // 拒绝任务
    refuseBtn.onclick = function() {
      if (refuseBtn.disabled) return
      page.remove()
      if (onRefuse) onRefuse()
    }

    // 调用AI生成回应
    async function loadAIResponse() {
      try {
        var reply = await window.callGameAI([{ role: 'user', content: '请对这个任务做出回应。' }], {
          system: systemPrompt,
          temperature: 0.85
        })

        if (responseEl) {
          responseEl.innerHTML = '<div style="font-size:14px;color:#e0e0f0;line-height:1.7;white-space:pre-wrap;">' + esc(reply || aiName + ' 默默接受了任务') + '</div>'
        }

        chatHistory = [
          { role: 'user', content: '请对这个任务做出回应。' },
          { role: 'assistant', content: reply }
        ]

        // 启用按钮
        agreeBtn.disabled = false
        refuseBtn.disabled = false
      } catch(e) {
        if (responseEl) {
          responseEl.innerHTML = '<div style="font-size:14px;color:#e0e0f0;">' + esc(aiName) + ' 微微一笑：「这个任务...有点意思呢。」</div>'
        }
        agreeBtn.disabled = false
        refuseBtn.disabled = false
      }
    }

    loadAIResponse()

    // 对话功能
    var input = page.querySelector('#sp-task-input')
    var sendBtn = page.querySelector('#sp-task-send')
    var msgArea = page.querySelector('#sp-task-messages')

    async function sendChatMsg() {
      var text = input.value.trim()
      if (!text) return
      input.value = ''

      msgArea.innerHTML += '<div style="text-align:right;margin-bottom:8px;">' +
        '<div style="display:inline-block;background:rgba(102,126,234,0.2);padding:6px 10px;border-radius:10px;font-size:13px;color:#ccc;max-width:80%;">' +
          esc(text) + '</div></div>'

      chatHistory.push({ role: 'user', content: text })

      try {
        var reply = await window.callGameAI(chatHistory.slice(-8), {
          system: systemPrompt,
          temperature: 0.85
        })
        chatHistory.push({ role: 'assistant', content: reply })

        msgArea.innerHTML += '<div style="margin-bottom:8px;display:flex;gap:6px;align-items:flex-start;">' +
          '<div class="spicy-player-avatar-sm spicy-p2-avatar" style="width:22px;height:22px;font-size:10px;flex-shrink:0;">' + esc(aiName.charAt(0)) + '</div>' +
          '<div style="background:rgba(255,255,255,0.06);padding:6px 10px;border-radius:10px;font-size:13px;color:#ccc;max-width:80%;">' +
            esc(reply) + '</div></div>'
      } catch(e) {
        msgArea.innerHTML += '<div style="margin-bottom:8px;font-size:12px;color:#888;text-align:center;">发送失败</div>'
      }

      msgArea.scrollTop = msgArea.scrollHeight
    }

    sendBtn.onclick = sendChatMsg
    input.onkeydown = function(e) { if (e.key === 'Enter') sendChatMsg() }
  }

  // ── 全局暴露 ──
  window.SpicyTask = {
    show: showTaskPage,
    aiAuto: aiAutoTask,
    buildPrompt: buildSystemPrompt
  }

})()
