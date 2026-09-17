# 群像模块 - Codex精确技术规范

> 本规范基于 miss-you.js 2056行代码逐行分析
> 必须严格按此规范实现，不可自由发挥

---

## 一、核心架构（必须遵守）

### 1.1 页面结构（完全复用miss-you.js模式）

```javascript
// 页面创建 - 和miss-you.js完全一致
window.showEnsemblePage = async function() {
  window.toast && window.toast('群像正在打开...')
  const page = document.createElement('div')
  page.id = 'ensemble-page'
  page.className = 'full-page miss-page'  // 复用miss-you的CSS类
  page.innerHTML = `
    <div class="page-header miss-header">
      <button class="header-back" id="ensemble-back"><i class="fa fa-angle-left"></i></button>
      <span class="header-title" id="ensemble-title">群像</span>
      <button class="btn-icon miss-settings-btn" id="ensemble-settings" title="设置" style="display:none">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>
    </div>
    <div class="miss-body" id="ensemble-body"></div>
  `
  // 状态管理 - 复用miss-you模式
  setEnsembleState(page, { view: 'accounts' })
  page.querySelector('#ensemble-back').addEventListener('click', () => handleEnsembleBack(page))
  page.querySelector('#ensemble-settings').addEventListener('click', () => {
    const state = page._ensembleState || {}
    if (state.view === 'chat') openEnsembleSettingsPage(page, state)
  })
  window.openPage(page)
  await renderAccountPicker(page)
}
```

### 1.2 状态管理（和miss-you完全一致）

```javascript
function setEnsembleState(page, newState) {
  page._ensembleState = Object.assign({}, page._ensembleState || {}, newState)
  updateHeaderActions(page)
}

function updateHeaderActions(page) {
  const btn = page.querySelector('#ensemble-settings')
  if (!btn) return
  const state = page._ensembleState || {}
  btn.style.display = state.view === 'chat' ? 'flex' : 'none'
}
```

### 1.3 返回逻辑（必须按此实现）

```javascript
async function handleEnsembleBack(page) {
  const state = page._ensembleState || {}
  if (state.view === 'chat') {
    // 从聊天 → 模式选择
    await renderModePicker(page, state.ownerUid, state.chat)
  } else if (state.view === 'modes') {
    // 从模式选择 → 角色选择
    await renderRoomPicker(page, state.ownerUid)
  } else if (state.view === 'rooms') {
    // 从角色选择 → 账号选择
    await renderAccountPicker(page)
  } else {
    // 从账号选择 → 关闭页面
    window.closePage('ensemble-page')
  }
}
```

---

## 二、页面渲染函数（必须完整实现）

### 2.1 账号选择页（完全复用miss-you模式）

```javascript
async function renderAccountPicker(page) {
  setEnsembleState(page, { view: 'accounts' })
  setEnsembleTitle(page, '群像')
  const body = page.querySelector('#ensemble-body')
  
  // 加载状态
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>'
  
  // 获取所有用户账号
  const users = (await db.characters.where('type').equals('user').toArray())
    .sort((a, b) => (b.id || 0) - (a.id || 0))
  
  if (!users.length) {
    body.innerHTML = `
      <div class="miss-empty">
        <i class="fa fa-user"></i>
        <div>暂无微信账号</div>
        <span>请先在微信里登录或创建 USER 角色</span>
      </div>`
    return
  }
  
  // 渲染账号列表
  body.innerHTML = `
    <div class="miss-section-title">选择微信账号</div>
    <div class="miss-list">
      ${users.map(user => `
        <button class="miss-row" data-owner-uid="${user.id}">
          <div class="miss-avatar">${avatarHTML(user.avatar || '', user.name || '')}</div>
          <div class="miss-row-main">
            <div class="miss-row-title">${escapeMainHtml(user.name || '')}</div>
            <div class="miss-row-sub">${escapeMainHtml(user.description || '微信账号')}</div>
          </div>
          <i class="fa fa-angle-right"></i>
        </button>
      `).join('')}
    </div>`
  
  // 绑定点击事件
  body.querySelectorAll('.miss-row').forEach(row => {
    row.addEventListener('click', () => renderRoomPicker(page, parseInt(row.dataset.ownerUid)))
  })
}
```

### 2.2 角色选择页（多选模式）

```javascript
async function renderRoomPicker(page, ownerUid) {
  setEnsembleState(page, { view: 'rooms', ownerUid })
  const user = await db.characters.get(ownerUid)
  setEnsembleTitle(page, getUserBaseName(user))
  const body = page.querySelector('#ensemble-body')
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div>'
  
  // 获取该账号下的所有角色
  const chats = (await db.chats.toArray()).filter(c => c.ownerUid === ownerUid)
  const items = []
  for (const chat of chats) {
    const char = await window.getCharacter(chat.charId)
    if (!char) continue
    items.push({ chat, char, name: char.name || '', avatar: char.avatar || '' })
  }
  
  if (!items.length) {
    body.innerHTML = `
      <div class="miss-empty">
        <i class="fa fa-user-group"></i>
        <div>暂无角色</div>
        <span>请先用这个微信账号和角色建立私聊</span>
      </div>`
    return
  }
  
  // 多选模式 - 存储选中的角色
  const selectedChars = new Set()
  
  body.innerHTML = `
    <div class="miss-section-title">选择角色（可多选）</div>
    <div class="miss-list">
      ${items.map(item => `
        <button class="miss-row ensemble-char-row" data-char-id="${item.char.id}" data-chat-id="${item.chat.id}">
          <div class="miss-avatar">${avatarHTML(item.avatar, item.name)}</div>
          <div class="miss-row-main">
            <div class="miss-row-title">${escapeMainHtml(item.name)}</div>
            <div class="miss-row-sub">${escapeMainHtml(item.char.description || '')}</div>
          </div>
          <div class="ensemble-check-icon"><i class="fa fa-check" style="display:none"></i></div>
        </button>
      `).join('')}
    </div>
    <div class="ensemble-confirm-bar">
      <button class="btn-pill" id="ensemble-confirm-chars" disabled>确认选择</button>
    </div>`
  
  // 绑定多选事件
  body.querySelectorAll('.ensemble-char-row').forEach(row => {
    row.addEventListener('click', () => {
      const charId = parseInt(row.dataset.charId)
      const checkIcon = row.querySelector('.ensemble-check-icon i')
      if (selectedChars.has(charId)) {
        selectedChars.delete(charId)
        checkIcon.style.display = 'none'
        row.classList.remove('selected')
      } else {
        selectedChars.add(charId)
        checkIcon.style.display = 'inline'
        row.classList.add('selected')
      }
      // 更新确认按钮状态
      const confirmBtn = body.querySelector('#ensemble-confirm-chars')
      if (confirmBtn) confirmBtn.disabled = selectedChars.size === 0
    })
  })
  
  // 确认按钮
  body.querySelector('#ensemble-confirm-chars').addEventListener('click', () => {
    if (selectedChars.size === 0) return
    const selectedItems = items.filter(item => selectedChars.has(item.char.id))
    renderModePicker(page, ownerUid, selectedItems)
  })
}
```

### 2.3 模式选择页（见面/剧本）

```javascript
async function renderModePicker(page, ownerUid, selectedItems) {
  setEnsembleState(page, { view: 'modes', ownerUid, selectedItems })
  setEnsembleTitle(page, '选择模式')
  const body = page.querySelector('#ensemble-body')
  
  body.innerHTML = `
    <div class="miss-section-title">选择线下模式</div>
    <div class="ensemble-mode-grid">
      <button class="ensemble-mode-card" data-mode="meet">
        <div class="ensemble-mode-icon"><i class="fa-solid fa-people-group"></i></div>
        <div class="ensemble-mode-title">见面模式</div>
        <div class="ensemble-mode-desc">直接与选中角色聊天，支持动态增删人员</div>
      </button>
      <button class="ensemble-mode-card" data-mode="script">
        <div class="ensemble-mode-icon"><i class="fa-solid fa-book-open"></i></div>
        <div class="ensemble-mode-title">剧本模式</div>
        <div class="ensemble-mode-desc">AI生成剧本框架，进入隔离的剧本世界</div>
      </button>
    </div>`
  
  // 绑定模式选择
  body.querySelectorAll('.ensemble-mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode
      if (mode === 'meet') {
        enterMeetMode(page, ownerUid, selectedItems)
      } else if (mode === 'script') {
        renderScriptSettings(page, ownerUid, selectedItems)
      }
    })
  })
}
```

---

## 三、见面模式（完整实现）

### 3.1 进入见面模式

```javascript
async function enterMeetMode(page, ownerUid, selectedItems) {
  setEnsembleState(page, { 
    view: 'chat', 
    mode: 'meet', 
    ownerUid, 
    selectedItems,
    currentChars: [...selectedItems]  // 当前在场角色，可动态增删
  })
  
  const charNames = selectedItems.map(c => c.name).join('、')
  setEnsembleTitle(page, `群像 · ${selectedItems.length}人在线`)
  
  const body = page.querySelector('#ensemble-body')
  body.innerHTML = `
    <div class="miss-chat">
      <div class="miss-chat-log" id="ensemble-chat-log"></div>
      <div class="miss-compose">
        <button class="miss-end-meet" id="ensemble-phone">掏出手机</button>
        <textarea class="miss-input" id="ensemble-input" placeholder="说点什么..." rows="1"></textarea>
        <button class="miss-send" id="ensemble-send">发送</button>
      </div>
      <div class="ensemble-toolbar">
        <button class="ensemble-tool-btn" id="ensemble-personnel"><i class="fa-solid fa-users"></i> 现场人员</button>
        <button class="ensemble-tool-btn" id="ensemble-history"><i class="fa-solid fa-clock-rotate-left"></i> 历史剧情</button>
      </div>
    </div>`
  
  // 绑定事件
  bindChatEvents(page, ownerUid, selectedItems)
  await refreshEnsembleChat(page)
}
```

### 3.2 掏出手机功能（必须直接跳转微信）

```javascript
// 掏出手机 - 直接打开微信页面
body.querySelector('#ensemble-phone').addEventListener('click', () => {
  // 直接调用showWechatPage，不创建新页面
  if (window.showWechatPage) {
    window.showWechatPage()
  }
})

// 微信页面关闭后自动返回群像（在wechat.js中处理）
// 或者用visibilitychange事件监听页面可见性
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // 页面重新可见时，刷新群像聊天
    const ensemblePage = document.getElementById('ensemble-page')
    if (ensemblePage) {
      refreshEnsembleChat(ensemblePage)
    }
  }
})
```

### 3.3 现场人员管理（动态增删）

```javascript
// 打开人员管理弹窗
body.querySelector('#ensemble-personnel').addEventListener('click', () => {
  showPersonnelModal(page)
})

async function showPersonnelModal(page) {
  const state = page._ensembleState
  const allChars = state.selectedItems  // 所有可选角色
  const currentChars = state.currentChars  // 当前在场角色
  
  const overlay = document.createElement('div')
  overlay.className = 'sheet-overlay'
  const modal = document.createElement('div')
  modal.className = 'center-modal ensemble-personnel-modal'
  modal.innerHTML = `
    <div class="sheet-title">现场人员管理</div>
    <div class="ensemble-personnel-list">
      <div class="ensemble-section-label">在场角色</div>
      ${currentChars.map(char => `
        <div class="ensemble-person-row">
          <div class="miss-avatar">${avatarHTML(char.avatar || '', char.name)}</div>
          <div class="ensemble-person-name">${escapeMainHtml(char.name)}</div>
          <button class="ensemble-remove-btn" data-char-id="${char.id}">移除</button>
        </div>
      `).join('')}
      <div class="ensemble-section-label">不在场角色</div>
      ${allChars.filter(c => !currentChars.find(cc => cc.id === c.id)).map(char => `
        <div class="ensemble-person-row">
          <div class="miss-avatar">${avatarHTML(char.avatar || '', char.name)}</div>
          <div class="ensemble-person-name">${escapeMainHtml(char.name)}</div>
          <button class="ensemble-add-btn" data-char-id="${char.id}">加入</button>
        </div>
      `).join('')}
    </div>
    <div class="sheet-actions">
      <button class="btn-pill btn-full" id="ensemble-personnel-close">关闭</button>
    </div>`
  
  document.body.appendChild(overlay)
  document.body.appendChild(modal)
  requestAnimationFrame(() => { overlay.classList.add('show'); modal.classList.add('show') })
  
  // 移除角色
  modal.querySelectorAll('.ensemble-remove-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const charId = parseInt(btn.dataset.charId)
      const char = currentChars.find(c => c.id === charId)
      if (char) {
        state.currentChars = currentChars.filter(c => c.id !== charId)
        // 添加离开通知
        await addSystemMessage(page, `${char.name} 离开了聊天`)
        closeModal(overlay, modal)
        showPersonnelModal(page)  // 刷新弹窗
        updateEnsembleTitle(page)
      }
    })
  })
  
  // 添加角色
  modal.querySelectorAll('.ensemble-add-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const charId = parseInt(btn.dataset.charId)
      const char = allChars.find(c => c.id === charId)
      if (char) {
        state.currentChars.push(char)
        // 添加加入通知
        await addSystemMessage(page, `${char.name} 加入了聊天`)
        closeModal(overlay, modal)
        showPersonnelModal(page)  // 刷新弹窗
        updateEnsembleTitle(page)
      }
    })
  })
  
  // 关闭按钮
  modal.querySelector('#ensemble-personnel-close').addEventListener('click', () => {
    closeModal(overlay, modal)
  })
}
```

### 3.4 卡片格式（ONE card with style differentiation）

```javascript
// AI回复解析 - 一张卡片包含所有内容
function parseAIReplyToCard(replyText, chars) {
  // 解析AI回复，按段落分类
  const lines = replyText.split('\n').filter(l => l.trim())
  let html = '<div class="ensemble-card">'
  
  for (const line of lines) {
    const trimmed = line.trim()
    
    // 判断类型
    if (isDialogue(trimmed, chars)) {
      // 对白：黑色粗体，「」包裹
      html += `<div class="dialogue-text">${escapeMainHtml(trimmed)}</div>`
    } else if (isAction(trimmed, chars)) {
      // 动作：灰色斜体
      html += `<div class="action-text">${escapeMainHtml(trimmed)}</div>`
    } else {
      // 环境/旁白：灰色
      html += `<div class="env-text">${escapeMainHtml(trimmed)}</div>`
    }
  }
  
  html += '</div>'
  return html
}

function isDialogue(line, chars) {
  // 检查是否包含「」引号
  if (line.includes('「') && line.includes('」')) return true
  // 检查是否以角色名开头且包含说话内容
  for (const char of chars) {
    if (line.startsWith(char.name + '：') || line.startsWith(char.name + ':')) {
      return true
    }
  }
  return false
}

function isAction(line, chars) {
  // 检查是否包含动作描述（如"轻轻"、"看向"、"站起"等动词）
  const actionKeywords = ['轻轻', '缓缓', '看向', '站起', '坐下', '转身', '微笑', '皱眉', '点头', '摇头']
  for (const keyword of actionKeywords) {
    if (line.includes(keyword)) return true
  }
  // 检查是否以角色名开头但不是对白
  for (const char of chars) {
    if (line.startsWith(char.name) && !line.includes('「')) return true
  }
  return false
}
```

### 3.5 AI调用（完整实现）

```javascript
async function startEnsembleAIReply(page) {
  const state = page._ensembleState
  if (!state || state.view !== 'chat') return
  
  const ownerUid = state.ownerUid
  const currentChars = state.currentChars
  const input = page.querySelector('#ensemble-input')
  const text = input.value.trim()
  if (!text) return
  
  // 添加用户消息
  await addOfflineMessage(ownerUid, null, null, 'ensemble', 'user', text)
  input.value = ''
  syncInputHeight(input)
  await refreshEnsembleChat(page)
  
  // 显示typing状态
  showTypingIndicator(page)
  
  try {
    // 构建系统提示词
    const systemPrompt = await buildEnsembleSystemPrompt(ownerUid, currentChars)
    
    // 获取最近历史
    const history = await getRecentHistory(ownerUid, 20)
    
    // 调用AI
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: text }
    ]
    
    const reply = await window.callAI(messages, { charAntiDrift: true })
    
    // 解析回复为卡片格式
    const cardHTML = parseAIReplyToCard(reply, currentChars)
    
    // 添加AI回复
    await addOfflineMessage(ownerUid, null, null, 'ensemble', 'assistant', reply)
    
    // 刷新聊天
    await refreshEnsembleChat(page)
    
  } catch (error) {
    console.error('[ensemble] AI回复失败:', error)
    window.toast('AI回复失败：' + (error?.message || String(error)))
  } finally {
    hideTypingIndicator(page)
  }
}
```

---

## 四、剧本模式（完整实现）

### 4.1 剧本设置页

```javascript
async function renderScriptSettings(page, ownerUid, selectedItems) {
  setEnsembleState(page, { view: 'script-settings', ownerUid, selectedItems })
  setEnsembleTitle(page, '剧本设置')
  const body = page.querySelector('#ensemble-body')
  
  // 读取保存的设置
  const config = await getScriptConfig(ownerUid)
  
  body.innerHTML = `
    <div class="ensemble-script-settings">
      <div class="miss-section-title">叙事视角</div>
      <div class="ensemble-radio-group">
        <label class="ensemble-radio-item">
          <input type="radio" name="perspective" value="first" ${config.perspective === 'first' ? 'checked' : ''}>
          <span>第一人称</span>
        </label>
        <label class="ensemble-radio-item">
          <input type="radio" name="perspective" value="third" ${config.perspective === 'third' ? 'checked' : ''}>
          <span>第三人称</span>
        </label>
      </div>
      
      <div class="miss-section-title">写作风格</div>
      <div class="ensemble-radio-group">
        <label class="ensemble-radio-item">
          <input type="radio" name="style" value="daily" ${config.style === 'daily' ? 'checked' : ''}>
          <span>轻松日常</span>
        </label>
        <label class="ensemble-radio-item">
          <input type="radio" name="style" value="mystery" ${config.style === 'mystery' ? 'checked' : ''}>
          <span>悬疑推理</span>
        </label>
        <label class="ensemble-radio-item">
          <input type="radio" name="style" value="fantasy" ${config.style === 'fantasy' ? 'checked' : ''}>
          <span>奇幻冒险</span>
        </label>
        <label class="ensemble-radio-item">
          <input type="radio" name="style" value="romance" ${config.style === 'romance' ? 'checked' : ''}>
          <span>虐心言情</span>
        </label>
      </div>
      
      <div class="miss-section-title">世界书（Apollo Protocol）</div>
      <div class="ensemble-toggle-row">
        <span>注入Apollo Protocol世界书</span>
        <label class="ensemble-toggle">
          <input type="checkbox" id="ensemble-worldbook" ${config.worldBook ? 'checked' : ''}>
          <span class="ensemble-toggle-slider"></span>
        </label>
      </div>
      
      <div class="miss-section-title">故事主题</div>
      <input type="text" class="ensemble-input" id="ensemble-theme" 
        placeholder="输入主题关键词，如：校园恋爱、末日求生" 
        value="${escapeMainHtml(config.theme || '')}">
      
      <div class="miss-section-title">额外设定</div>
      <textarea class="ensemble-textarea" id="ensemble-extra" 
        placeholder="输入额外要求，如：要有反转结局、角色A是卧底">${escapeMainHtml(config.extra || '')}</textarea>
      
      <div class="ensemble-settings-actions">
        <button class="btn-pill" id="ensemble-generate-script">生成剧本</button>
        <button class="btn-ghost" id="ensemble-use-template">使用模板</button>
      </div>
    </div>`
  
  // 绑定事件
  body.querySelector('#ensemble-generate-script').addEventListener('click', () => {
    generateScript(page, ownerUid, selectedItems)
  })
  body.querySelector('#ensemble-use-template').addEventListener('click', () => {
    showTemplatePicker(page, ownerUid, selectedItems)
  })
}
```

### 4.2 AI生成剧本框架

```javascript
async function generateScript(page, ownerUid, selectedItems) {
  const body = page.querySelector('#ensemble-body')
  const perspective = body.querySelector('input[name="perspective"]:checked')?.value || 'third'
  const style = body.querySelector('input[name="style"]:checked')?.value || 'daily'
  const worldBook = body.querySelector('#ensemble-worldbook')?.checked || false
  const theme = body.querySelector('#ensemble-theme')?.value?.trim() || ''
  const extra = body.querySelector('#ensemble-extra')?.value?.trim() || ''
  
  // 保存设置
  await saveScriptConfig(ownerUid, { perspective, style, worldBook, theme, extra })
  
  // 显示加载
  body.innerHTML = '<div class="miss-loading"><i class="fa fa-spinner fa-spin"></i></div><div style="text-align:center;color:#888;">AI正在生成剧本...</div>'
  
  try {
    // 构建提示词
    const charNames = selectedItems.map(c => c.name).join('、')
    const charDescs = selectedItems.map(c => `${c.name}：${c.description || '无描述'}`).join('\n')
    
    let prompt = `请为以下角色生成一个剧本框架：

角色：
${charDescs}

要求：
- 叙事视角：${perspective === 'first' ? '第一人称' : perspective === 'second' ? '第二人称' : '第三人称'}
- 写作风格：${getStyleName(style)}`
    
    if (theme) prompt += `\n- 故事主题：${theme}`
    if (extra) prompt += `\n- 额外设定：${extra}`
    
    prompt += `\n\n请返回JSON格式：
{
  "title": "剧本标题",
  "premise": "故事前提（2-3句话）",
  "characters": [
    {"name": "角色名", "role": "主角/配角", "setting": "在这个剧本中的设定"}
  ],
  "preview": "故事预览（第一幕内容，100-200字）",
  "keywords": ["关键词1", "关键词2", "关键词3"]
}`
    
    // 注入世界书
    let systemPrompt = '你是一个专业的剧本创作AI。'
    if (worldBook) {
      systemPrompt += '\n\n' + await getApolloProtocolLore()
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ]
    
    const reply = await window.callAI(messages, { responseFormat: 'json_object', charAntiDrift: true })
    
    // 解析JSON
    let scriptData
    try {
      const cleanReply = reply.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      scriptData = JSON.parse(cleanReply)
    } catch (e) {
      throw new Error('AI返回的JSON格式错误')
    }
    
    // 保存剧本数据
    await saveScriptData(ownerUid, scriptData)
    
    // 显示剧本预览
    renderScriptPreview(page, ownerUid, selectedItems, scriptData)
    
  } catch (error) {
    console.error('[ensemble] 剧本生成失败:', error)
    window.toast('剧本生成失败：' + (error?.message || String(error)))
    // 返回设置页
    renderScriptSettings(page, ownerUid, selectedItems)
  }
}
```

### 4.3 剧本预览页

```javascript
async function renderScriptPreview(page, ownerUid, selectedItems, scriptData) {
  setEnsembleState(page, { view: 'script-preview', ownerUid, selectedItems, scriptData })
  setEnsembleTitle(page, '剧本预览')
  const body = page.querySelector('#ensemble-body')
  
  body.innerHTML = `
    <div class="ensemble-script-preview">
      <div class="ensemble-script-title">${escapeMainHtml(scriptData.title || '未命名剧本')}</div>
      
      <div class="ensemble-script-section">
        <div class="ensemble-script-label">故事前提</div>
        <div class="ensemble-script-text">${escapeMainHtml(scriptData.premise || '')}</div>
      </div>
      
      <div class="ensemble-script-section">
        <div class="ensemble-script-label">角色设定</div>
        ${(scriptData.characters || []).map(char => `
          <div class="ensemble-script-char">
            <strong>${escapeMainHtml(char.name)}</strong> - ${escapeMainHtml(char.role || '')}
            <div class="ensemble-script-char-desc">${escapeMainHtml(char.setting || '')}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="ensemble-script-section">
        <div class="ensemble-script-label">故事预览</div>
        <div class="ensemble-script-text">${escapeMainHtml(scriptData.preview || '')}</div>
      </div>
      
      <div class="ensemble-script-section">
        <div class="ensemble-script-label">关键词</div>
        <div class="ensemble-keywords">
          ${(scriptData.keywords || []).map(kw => `<span class="ensemble-keyword">#${escapeMainHtml(kw)}</span>`).join('')}
        </div>
      </div>
      
      <div class="ensemble-script-actions">
        <button class="btn-pill" id="ensemble-start-script">开始剧本</button>
        <button class="btn-ghost" id="ensemble-regenerate">重新生成</button>
      </div>
    </div>`
  
  // 绑定事件
  body.querySelector('#ensemble-start-script').addEventListener('click', () => {
    enterScriptMode(page, ownerUid, selectedItems, scriptData)
  })
  body.querySelector('#ensemble-regenerate').addEventListener('click', () => {
    renderScriptSettings(page, ownerUid, selectedItems)
  })
}
```

### 4.4 剧本聊天模式

```javascript
async function enterScriptMode(page, ownerUid, selectedItems, scriptData) {
  setEnsembleState(page, { 
    view: 'chat', 
    mode: 'script', 
    ownerUid, 
    selectedItems,
    currentChars: [...selectedItems],
    scriptData
  })
  
  setEnsembleTitle(page, scriptData.title || '剧本模式')
  
  const body = page.querySelector('#ensemble-body')
  body.innerHTML = `
    <div class="miss-chat">
      <div class="miss-chat-log" id="ensemble-chat-log"></div>
      <div class="miss-compose">
        <button class="miss-end-meet" id="ensemble-phone">掏出手机</button>
        <textarea class="miss-input" id="ensemble-input" placeholder="说点什么..." rows="1"></textarea>
        <button class="miss-send" id="ensemble-send">发送</button>
      </div>
      <div class="ensemble-toolbar">
        <button class="ensemble-tool-btn" id="ensemble-personnel"><i class="fa-solid fa-users"></i> 现场人员</button>
        <button class="ensemble-tool-btn" id="ensemble-pause"><i class="fa-solid fa-pause"></i> 暂停剧本</button>
        <button class="ensemble-tool-btn" id="ensemble-export"><i class="fa-solid fa-download"></i> 导出剧本</button>
      </div>
    </div>`
  
  // 绑定事件
  bindChatEvents(page, ownerUid, selectedItems)
  
  // 添加剧本开场白
  await addSystemMessage(page, `剧本「${scriptData.title}」开始`)
  await addSystemMessage(page, scriptData.preview || '')
  
  await refreshEnsembleChat(page)
}
```

---

## 五、CSS样式（必须严格按此实现）

### 5.1 CSS变量（复用miss-you的变量系统）

```css
/* 群像模块CSS - 严格复用miss-you的变量系统 */
#ensemble-page {
  /* 复用miss-you的颜色变量 */
  --c-bg: #ffffff;
  --c-surface: #fbfbfb;
  --c-surface-2: #f3f3f3;
  --c-border: rgba(0, 0, 0, 0.05);
  --c-border-m: rgba(0, 0, 0, 0.09);
  --c-accent: #8a8a8a;
  --c-accent-light: #f3f3f3;
  --c-accent-dark: #787878;
  --c-text: #3a3a3a;
  --c-sub: #888888;
  --c-hint: #b8b8b8;
  --c-red: #b05a5a;
  
  /* 群像特有变量 */
  --ensemble-env-color: #888888;
  --ensemble-action-color: #666666;
  --ensemble-dialogue-color: #2a2a2a;
}
```

### 5.2 卡片样式

```css
/* 一张卡片包含所有内容 */
.ensemble-card {
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
}

/* 环境/旁白 - 灰色 */
.ensemble-card .env-text {
  color: var(--ensemble-env-color);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}

/* 角色动作 - 灰色斜体 */
.ensemble-card .action-text {
  color: var(--ensemble-action-color);
  font-style: italic;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
  padding-left: 12px;
  border-left: 3px solid var(--c-border-m);
}

/* 角色对白 - 黑色粗体 */
.ensemble-card .dialogue-text {
  color: var(--ensemble-dialogue-color);
  font-weight: 600;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 8px;
}

/* 着重强调 */
.ensemble-card .emphasis {
  color: var(--c-accent-dark);
  font-weight: 700;
}
```

### 5.3 工具栏样式

```css
.ensemble-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  background: var(--c-surface);
  border-top: 1px solid var(--c-border);
}

.ensemble-tool-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 12px;
  background: var(--c-surface-2);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  color: var(--c-text);
  font-size: 13px;
  cursor: pointer;
  transition: all 160ms ease-out;
  min-height: 44px;
}

.ensemble-tool-btn:hover {
  background: var(--c-accent-light);
}

.ensemble-tool-btn:active {
  transform: scale(0.97);
}
```

### 5.4 模式选择卡片

```css
.ensemble-mode-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 16px;
}

.ensemble-mode-card {
  background: var(--c-surface);
  border: 2px solid var(--c-border);
  border-radius: 16px;
  padding: 24px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 200ms ease-out;
}

.ensemble-mode-card:hover {
  border-color: var(--c-accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.ensemble-mode-card:active {
  transform: scale(0.98);
}

.ensemble-mode-icon {
  font-size: 32px;
  margin-bottom: 12px;
  color: var(--c-accent-dark);
}

.ensemble-mode-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--c-text);
  margin-bottom: 8px;
}

.ensemble-mode-desc {
  font-size: 13px;
  color: var(--c-sub);
  line-height: 1.4;
}
```

### 5.5 人员管理弹窗

```css
.ensemble-personnel-modal {
  max-width: 360px;
  width: 90%;
}

.ensemble-personnel-list {
  max-height: 400px;
  overflow-y: auto;
  padding: 12px 0;
}

.ensemble-section-label {
  font-size: 12px;
  color: var(--c-sub);
  text-transform: uppercase;
  letter-spacing: 1px;
  padding: 8px 16px;
  margin-top: 8px;
}

.ensemble-person-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
}

.ensemble-person-name {
  flex: 1;
  font-size: 14px;
  color: var(--c-text);
}

.ensemble-remove-btn,
.ensemble-add-btn {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 160ms ease-out;
  min-height: 32px;
}

.ensemble-remove-btn {
  background: var(--c-red);
  color: white;
  border: none;
}

.ensemble-add-btn {
  background: var(--c-accent);
  color: white;
  border: none;
}
```

### 5.6 多选角色样式

```css
.ensemble-char-row {
  position: relative;
}

.ensemble-char-row.selected {
  background: var(--c-accent-light);
}

.ensemble-check-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-accent-dark);
}

.ensemble-confirm-bar {
  padding: 16px;
  position: sticky;
  bottom: 0;
  background: var(--c-bg);
  border-top: 1px solid var(--c-border);
}
```

### 5.7 剧本设置样式

```css
.ensemble-script-settings {
  padding: 16px;
}

.ensemble-radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.ensemble-radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--c-surface);
  border: 1px solid var(--c-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 160ms ease-out;
  min-height: 44px;
}

.ensemble-radio-item:has(input:checked) {
  border-color: var(--c-accent);
  background: var(--c-accent-light);
}

.ensemble-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 16px;
}

.ensemble-toggle {
  position: relative;
  width: 48px;
  height: 28px;
}

.ensemble-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.ensemble-toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--c-hint);
  transition: 300ms;
  border-radius: 28px;
}

.ensemble-toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: 300ms;
  border-radius: 50%;
}

.ensemble-toggle input:checked + .ensemble-toggle-slider {
  background-color: var(--c-accent);
}

.ensemble-toggle input:checked + .ensemble-toggle-slider:before {
  transform: translateX(20px);
}

.ensemble-input,
.ensemble-textarea {
  width: 100%;
  padding: 12px;
  font-size: 16px; /* 防iOS自动放大 */
  border: 1px solid var(--c-border);
  border-radius: 8px;
  background: var(--c-surface);
  color: var(--c-text);
  margin-bottom: 16px;
  transition: border-color 160ms ease-out;
}

.ensemble-input:focus,
.ensemble-textarea:focus {
  outline: none;
  border-color: var(--c-accent);
}

.ensemble-textarea {
  min-height: 80px;
  resize: vertical;
}

.ensemble-settings-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
```

### 5.8 剧本预览样式

```css
.ensemble-script-preview {
  padding: 16px;
}

.ensemble-script-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--c-text);
  margin-bottom: 24px;
  text-align: center;
}

.ensemble-script-section {
  margin-bottom: 20px;
}

.ensemble-script-label {
  font-size: 12px;
  color: var(--c-sub);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}

.ensemble-script-text {
  font-size: 14px;
  color: var(--c-text);
  line-height: 1.6;
  padding: 12px;
  background: var(--c-surface);
  border-radius: 8px;
}

.ensemble-script-char {
  padding: 12px;
  background: var(--c-surface);
  border-radius: 8px;
  margin-bottom: 8px;
}

.ensemble-script-char strong {
  color: var(--c-text);
}

.ensemble-script-char-desc {
  font-size: 13px;
  color: var(--c-sub);
  margin-top: 4px;
}

.ensemble-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ensemble-keyword {
  padding: 4px 10px;
  background: var(--c-accent-light);
  color: var(--c-accent-dark);
  border-radius: 12px;
  font-size: 13px;
}

.ensemble-script-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
```

---

## 六、数据存储（必须按此实现）

### 6.1 使用db.offlineChats存储（和miss-you完全一致）

```javascript
// 添加离线消息
async function addOfflineMessage(ownerUid, chatId, charId, mode, role, content) {
  return await db.offlineChats.add({
    ownerUid,
    chatId: chatId || 0,
    charId: charId || 0,
    mode,  // 'ensemble' 或 'script'
    role,  // 'user', 'assistant', 'system'
    content,
    createdAt: Date.now()
  })
}

// 获取离线消息
async function getOfflineMessages(ownerUid, mode) {
  const rows = await db.offlineChats.where('mode').equals(mode).toArray()
  return rows
    .filter(m => m.ownerUid === ownerUid)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
}
```

### 6.2 剧本配置存储

```javascript
const SCRIPT_CONFIG_KEY = 'ensemble_script_config'

async function getScriptConfig(ownerUid) {
  const row = await db.config.get(`${SCRIPT_CONFIG_KEY}_${ownerUid}`)
  return row?.value || {
    perspective: 'third',
    style: 'daily',
    worldBook: false,
    theme: '',
    extra: ''
  }
}

async function saveScriptConfig(ownerUid, config) {
  await db.config.put({ 
    key: `${SCRIPT_CONFIG_KEY}_${ownerUid}`, 
    value: config 
  })
}
```

### 6.3 剧本历史存储

```javascript
const SCRIPT_HISTORY_KEY = 'ensemble_script_history'

async function getScriptHistory(ownerUid) {
  const row = await db.config.get(`${SCRIPT_HISTORY_KEY}_${ownerUid}`)
  return row?.value || []
}

async function saveScriptToHistory(ownerUid, scriptData) {
  const history = await getScriptHistory(ownerUid)
  history.unshift({
    ...scriptData,
    savedAt: Date.now()
  })
  // 只保留最近20个
  if (history.length > 20) history.length = 20
  await db.config.put({ 
    key: `${SCRIPT_HISTORY_KEY}_${ownerUid}`, 
    value: history 
  })
}
```

---

## 七、世界书注入（必须实现）

### 7.1 防油腻世界书（所有模式都注入）

```javascript
// 从wechat.js读取防油腻世界书
function getAntiDriftLore() {
  // 这个变量在wechat.js顶部定义
  return window._BUILTIN_ANTI_DRIFT_LORE || ''
}
```

### 7.2 剧情推进世界书（线下模式注入）

```javascript
// 从miss-you.js读取剧情推进世界书
function getPlotFirstLore() {
  // 这个变量在miss-you.js顶部定义
  return window._BUILTIN_PLOT_FIRST_LORE || ''
}
```

### 7.3 Apollo Protocol世界书（剧本模式可选注入）

```javascript
// 读取Apollo Protocol
async function getApolloProtocolLore() {
  try {
    const response = await fetch('/docs/apollo-protocol.md')
    return await response.text()
  } catch (e) {
    console.error('[ensemble] 读取Apollo Protocol失败:', e)
    return ''
  }
}
```

### 7.4 系统提示词构建

```javascript
async function buildEnsembleSystemPrompt(ownerUid, chars) {
  const charDescs = chars.map(c => {
    let desc = `【${c.name}】\n${c.description || ''}`
    if (c.identity) {
      desc += `\n身份：${c.identity}`
    }
    return desc
  }).join('\n\n')
  
  let prompt = `你是群像线下模式的AI，需要同时扮演多个角色进行对话。

当前在场角色：
${charDescs}

规则：
1. 每次回复包含所有在场角色的内容
2. 格式：环境描写 + 角色动作 + 角色对白混合
3. 角色对白用「」包裹
4. 保持每个角色的独特性格和说话风格
5. 推进剧情发展，不要重复

${getAntiDriftLore()}
${getPlotFirstLore()}`
  
  return prompt
}
```

---

## 八、集成点（必须完成）

### 8.1 记忆系统集成（memory.js）

```javascript
// 在memory.js的SOURCE_TYPE_LABEL中添加
var SOURCE_TYPE_LABEL = { 
  wechat: '微信', 
  x: 'X', 
  sms: '短信', 
  moments: '朋友圈', 
  offline: '线下', 
  manual: '手动', 
  offlineMeet: '见面',
  ensemble: '群像'  // 新增
}
```

### 8.2 数据管理集成（data.js）

```javascript
// 在data.js的placeholder中添加ensemble
var placeholder = { 
  wechat: 0, 
  characters: 0, 
  lorebook: 0, 
  missyou: 0, 
  ensemble: 0,  // 新增
  social: 0, 
  other: 0 
}

// 在sizes中添加ensemble计算
sizes.ensemble += await sumTableSize(db.offlineChats, 100, function(row) {
  return row.mode === 'ensemble' || row.mode === 'script'
})
```

### 8.3 角色删除集成（character.js）

```javascript
// 删除角色时，同步删除群像数据
if (db.offlineChats) {
  await db.offlineChats.where('charId').equals(charId).delete()
}
```

### 8.4 桌面图标集成（home.js）

```javascript
// 在DESKTOP_ICONS中添加（替换或保留miss-you）
{ 
  id: 'ensemble', 
  fa: 'fa-solid fa-users', 
  label: '群像', 
  action: function() { 
    window.showEnsemblePage && showEnsemblePage() 
  } 
}
```

---

## 九、自检清单（Codex完成后必须检查）

- [ ] 所有函数都有完整实现（不是空函数）
- [ ] 所有CSS类都在CSS文件中有对应样式
- [ ] 所有按钮都绑定了事件
- [ ] 所有AI调用都有try-catch
- [ ] 所有DOM操作都判空
- [ ] 所有异步操作都有await
- [ ] 所有数据存储都用db.offlineChats
- [ ] 世界书注入正确（防油腻+剧情推进+Apollo）
- [ ] 掏出手机直接调用showWechatPage
- [ ] 退出按钮返回上一页（不是关闭整个页面）
- [ ] 动态增删角色有通知
- [ ] 剧本历史可以保存和查看
- [ ] 记忆按角色视角分别生成
- [ ] node --check语法检查通过

---

## 十、文件清单

### 必须创建的文件：
1. `/opt/wanwan/js/ensemble.js` - 主入口（400-500行）
2. `/opt/wanwan/js/ensemble-chat.js` - 聊天引擎（400-500行）
3. `/opt/wanwan/js/ensemble-script.js` - 剧本模式（300-400行）
4. `/opt/wanwan/css/ensemble.css` - 所有样式（800-1000行）

### 必须修改的文件：
1. `/opt/wanwan/js/memory.js` - 添加SOURCE_TYPE_LABEL
2. `/opt/wanwan/js/data.js` - 添加ensemble数据计算
3. `/opt/wanwan/js/home.js` - 添加桌面图标
4. `/opt/wanwan/index.html` - 添加script/css引用

### 参考文件（必须读取）：
1. `/opt/wanwan/js/miss-you.js` - 2056行，完整读取
2. `/opt/wanwan/js/wechat.js` - 读取showWechatPage函数
3. `/opt/wanwan/docs/ensemble-requirements.md` - 需求文档
4. `/opt/wanwan/docs/apollo-protocol.md` - 世界书
