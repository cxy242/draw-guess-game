/* memory-panel.js — 记忆整理面板 */

// ===== 数据结构 =====
// 每个角色的记忆面板存储在IndexedDB的config表中
// key: 'memoryPanel_{charId}'
// value: { items: [...], promises: [...], belongings: [...], importantDates: [...], togetherDate: '...', lastUpdated: timestamp }

function getMemoryPanelKey(charId) {
  return 'memoryPanel_' + charId
}

async function loadMemoryPanel(charId) {
  try {
    const stored = await db.config.get(getMemoryPanelKey(charId))
    const panel = stored && stored.value ? stored.value : createEmptyPanel()

    // 从记忆库(db.memories)加载该角色的记忆
    if (db.memories) {
      try {
        const memories = await db.memories.where('charId').equals(charId).toArray()
        panel.memories = memories.filter(m => m.status !== 'archived').map(m => ({
          id: m.id,
          title: m.title || '',
          content: m.content || '',
          keywords: m.keywords || [],
          sourceType: m.sourceType || 'wechat',
          createdAt: m.createdAt || m.sourceAt || Date.now(),
          importance: m.importance || 5,
          status: m.status || 'active'
        })).sort((a, b) => b.createdAt - a.createdAt)
      } catch(e) {
        console.warn('[MemoryPanel] 加载记忆库失败:', e)
        panel.memories = []
      }
    }

    return panel
  } catch(e) {
    console.warn('[MemoryPanel] 加载失败:', e)
    return createEmptyPanel()
  }
}

async function saveMemoryPanel(charId, panel) {
  panel.lastUpdated = Date.now()
  try {
    await db.config.put({ key: getMemoryPanelKey(charId), value: panel })
  } catch(e) {
    console.warn('[MemoryPanel] 保存失败:', e)
  }
}

function createEmptyPanel() {
  return {
    items: [],       // 记忆条目 { id, date, time, content, tags:[] }
    promises: [],    // 约定 { id, title, date, status:'active'|'done'|'pending' }
    belongings: [],  // 随身物品 { id, name, source, type:'keepsake'|'borrowed'|'daily' }
    importantDates: [], // 重要日期 { id, name, date }
    togetherDate: '',   // 在一起日期 'YYYY-MM-DD'
    health: '',     // 当前身体状态
    mood: '',       // 当前情绪
    memories: [],   // 来自db.memories的记忆（只读，不存入config）
    lastUpdated: 0
  }
}

// ===== 生成记忆面板HTML =====
function buildMemoryPanelHTML(panel) {
  const now = new Date()
  const today = formatDate(now)
  const yesterday = formatDate(new Date(now - 86400000))
  const dayBefore = formatDate(new Date(now - 172800000))

  // 按日期分组记忆条目
  const grouped = { before: [], yesterday: [], today: [], future: [] }
  const todayTime = new Date(today).getTime()

  panel.items.forEach(item => {
    if (!item.date) return
    const itemTime = new Date(item.date).getTime()
    if (item.date === today) grouped.today.push(item)
    else if (item.date === yesterday) grouped.yesterday.push(item)
    else if (itemTime < todayTime) grouped.before.push(item)
    else grouped.future.push(item)
  })

  let html = ''

  // 当前状态
  html += '<div class="mem-status-section">'
  html += '<div class="mem-status-card">'
  html += '<div class="mem-status-row">'
  html += '<div class="mem-status-icon health"><i class="fa-solid fa-heart-pulse"></i></div>'
  html += '<span class="mem-status-label">身体</span>'
  html += '<span class="mem-status-value">' + (panel.health || '良好') + '</span>'
  html += '</div>'
  html += '<div class="mem-status-row">'
  html += '<div class="mem-status-icon mood"><i class="fa-solid fa-face-smile"></i></div>'
  html += '<span class="mem-status-label">情绪</span>'
  html += '<span class="mem-status-value">' + (panel.mood || '平静') + '</span>'
  html += '</div>'
  html += '</div></div>'

  // 前天
  if (grouped.before.length) {
    html += buildDateDivider(dayBefore, '前天')
    grouped.before.forEach(item => { html += buildMemoryItem(item) })
  }

  // 昨天
  if (grouped.yesterday.length) {
    html += buildDateDivider(yesterday, '昨天')
    grouped.yesterday.forEach(item => { html += buildMemoryItem(item) })
  }

  // 今天
  if (grouped.today.length) {
    html += buildDateDivider(today, '今天')
    grouped.today.forEach(item => { html += buildMemoryItem(item) })
  }

  // 将要做的事
  if (grouped.future.length) {
    html += '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">将要做的事</span><span class="mem-date-line"></span></div>'
    grouped.future.forEach(item => { html += buildMemoryItem(item) })
  }

  // 约定卡片
  if (panel.promises.length) {
    html += '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">约定</span><span class="mem-date-line"></span></div>'
    panel.promises.forEach(p => { html += buildPromiseCard(p) })
  }

  // 随身物品
  if (panel.belongings.length) {
    html += '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">随身物品</span><span class="mem-date-line"></span></div>'
    html += '<div class="mem-items-grid">'
    panel.belongings.forEach(b => { html += buildBelongingCard(b) })
    html += '</div>'
  }

  // 重要日期
  if (panel.importantDates.length) {
    html += '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">重要日期</span><span class="mem-date-line"></span></div>'
    html += '<div class="mem-dates-list">'
    panel.importantDates.forEach(d => { html += buildImportantDateCard(d) })
    html += '</div>'
  }

  // 在一起天数
  if (panel.togetherDate) {
    html += buildTogetherCard(panel.togetherDate)
  }

  // 记忆库（来自db.memories）
  if (panel.memories && panel.memories.length) {
    html += '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">记忆库</span><span class="mem-date-line"></span></div>'
    panel.memories.slice(0, 20).forEach(m => {
      const sourceLabel = m.sourceType === 'offlineMeet' ? '线下' : (m.sourceType === 'sms' ? '短信' : (m.sourceType === 'x' ? 'X' : '微信'))
      const dateStr = formatTimestamp(m.createdAt)
      html += '<div class="mem-item" data-memory-id="' + m.id + '">' +
        '<span class="mem-item-time">' + dateStr + '</span>' +
        '<span class="mem-item-content">' +
          '<span class="mem-item-tag mem-tag-' + (m.sourceType || 'wechat') + '" style="font-size:9px">' + sourceLabel + '</span> ' +
          escMemHtml(m.title ? (m.title + '：' + m.content) : m.content) +
        '</span>' +
        '</div>'
    })
  }

  // 空状态
  if (!panel.items.length && !panel.promises.length && !panel.belongings.length && !(panel.memories && panel.memories.length)) {
    html += '<div class="mem-empty"><div class="mem-empty-icon"><i class="fa-solid fa-brain"></i></div><div class="mem-empty-text">暂无记忆，点击下方按钮添加</div></div>'
  }

  return html
}

function formatDate(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  return parseInt(parts[1]) + '月' + parseInt(parts[2]) + '日'
}

function formatTimestamp(ts) {
  if (!ts) return ''
  const d = new Date(Number(ts))
  if (isNaN(d.getTime())) return ''
  const m = d.getMonth() + 1
  const day = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return m + '/' + day + ' ' + h + ':' + min
}

function buildDateDivider(dateStr, label) {
  const display = label ? (label + '（' + formatDateDisplay(dateStr) + '）') : formatDateDisplay(dateStr)
  return '<div class="mem-date-divider"><span class="mem-date-line"></span><span class="mem-date-text">' + display + '</span><span class="mem-date-line"></span></div>'
}

function buildMemoryItem(item) {
  const tagHTML = (item.tags || []).map(tag => {
    return '<span class="mem-item-tag mem-tag-' + tag + '">' + getTagLabel(tag) + '</span>'
  }).join('')

  return '<div class="mem-item" data-id="' + item.id + '">' +
    '<span class="mem-item-time">' + (item.time || '') + '</span>' +
    '<span class="mem-item-content">' + escMemHtml(item.content) + tagHTML + '</span>' +
    '</div>'
}

function getTagLabel(tag) {
  const labels = {
    'injury': '受伤',
    'recovering': '恢复中',
    'healed': '基本康复',
    'promise': '约定',
    'done': '已完成',
    'emotion': '情绪',
    'item': '物品',
    'keepsake': '信物'
  }
  return labels[tag] || tag
}

function buildPromiseCard(p) {
  const now = new Date()
  const promiseDate = new Date(p.date)
  const diffDays = Math.ceil((promiseDate - now) / 86400000)
  const countdownText = diffDays > 0 ? ('倒计时' + diffDays + '天') : (diffDays === 0 ? '今天' : '已过' + Math.abs(diffDays) + '天')
  const statusClass = p.status === 'done' ? 'done' : (p.status === 'pending' ? 'pending' : 'active')

  return '<div class="mem-promise-card" data-id="' + p.id + '">' +
    '<div class="mem-promise-title">' + escMemHtml(p.title) + '</div>' +
    '<div class="mem-promise-meta">' +
    '<span>' + formatDateDisplay(p.date) + '</span>' +
    (p.status !== 'done' ? '<span class="mem-promise-countdown">' + countdownText + '</span>' : '') +
    '<span class="mem-promise-status ' + statusClass + '">' + (p.status === 'done' ? '已完成' : (p.status === 'pending' ? '待定' : '进行中')) + '</span>' +
    '</div></div>'
}

function buildBelongingCard(b) {
  const iconClass = b.type === 'keepsake' ? 'keepsake' : (b.type === 'borrowed' ? 'borrowed' : 'daily')
  const icon = b.type === 'keepsake' ? 'fa-gem' : (b.type === 'borrowed' ? 'fa-hand-holding' : 'fa-suitcase')

  return '<div class="mem-item-card" data-id="' + b.id + '">' +
    '<div class="mem-item-icon ' + iconClass + '"><i class="fa-solid ' + icon + '"></i></div>' +
    '<div class="mem-item-info">' +
    '<div class="mem-item-name">' + escMemHtml(b.name) + '</div>' +
    '<div class="mem-item-source">' + escMemHtml(b.source || '') + '</div>' +
    '</div></div>'
}

function buildImportantDateCard(d) {
  const now = new Date()
  const targetDate = new Date(d.date)
  const thisYear = new Date(now.getFullYear(), targetDate.getMonth(), targetDate.getDate())
  let nextDate = thisYear
  if (thisYear < now) {
    nextDate = new Date(now.getFullYear() + 1, targetDate.getMonth(), targetDate.getDate())
  }
  const diffDays = Math.ceil((nextDate - now) / 86400000)

  return '<div class="mem-date-item" data-id="' + d.id + '">' +
    '<div class="mem-date-info">' +
    '<div class="mem-date-icon"><i class="fa-solid fa-cake-candles"></i></div>' +
    '<span class="mem-date-name">' + escMemHtml(d.name) + '：' + formatDateDisplay(d.date) + '</span>' +
    '</div>' +
    '<span class="mem-date-countdown">倒计时' + diffDays + '天</span>' +
    '</div>'
}

function buildTogetherCard(dateStr) {
  const startDate = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now - startDate) / 86400000)

  return '<div class="mem-together-card">' +
    '<div class="mem-together-days">' + diffDays + '</div>' +
    '<div class="mem-together-label">在一起的天数</div>' +
    '<div class="mem-together-since">自' + formatDateDisplay(dateStr) + '起</div>' +
    '</div>'
}

function escMemHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ===== 打开面板 =====
async function openMemoryPanel(charId, charName) {
  // 移除已有面板
  const existing = document.getElementById('mem-panel-overlay')
  if (existing) existing.remove()

  const panel = await loadMemoryPanel(charId)

  const overlay = document.createElement('div')
  overlay.id = 'mem-panel-overlay'
  overlay.className = 'mem-panel-overlay'

  overlay.innerHTML =
    '<div class="mem-panel">' +
      '<div class="mem-panel-header">' +
        '<span class="mem-panel-title">' + escMemHtml(charName) + ' 的记忆</span>' +
        '<button class="mem-panel-close" id="mem-panel-close"><i class="fa-solid fa-xmark"></i></button>' +
      '</div>' +
      '<div class="mem-panel-body" id="mem-panel-body">' +
        buildMemoryPanelHTML(panel) +
      '</div>' +
      '<div class="mem-panel-footer">' +
        '<button class="mem-btn mem-btn-primary" id="mem-btn-add"><i class="fa-solid fa-plus"></i> 添加记忆</button>' +
        '<button class="mem-btn mem-btn-ghost" id="mem-btn-settings"><i class="fa-solid fa-gear"></i> 设置</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(overlay)

  // 动画入场
  requestAnimationFrame(() => {
    overlay.classList.add('open')
  })

  // 关闭按钮
  overlay.querySelector('#mem-panel-close').addEventListener('click', () => {
    overlay.classList.remove('open')
    setTimeout(() => overlay.remove(), 300)
  })

  // 点击遮罩关闭
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('open')
      setTimeout(() => overlay.remove(), 300)
    }
  })

  // 添加记忆按钮
  overlay.querySelector('#mem-btn-add').addEventListener('click', () => {
    showAddMemoryModal(charId, panel, overlay)
  })

  // 设置按钮
  overlay.querySelector('#mem-btn-settings').addEventListener('click', () => {
    showMemorySettingsModal(charId, panel, overlay)
  })

  // 记忆条目点击编辑
  overlay.querySelectorAll('.mem-item').forEach(el => {
    el.addEventListener('click', () => {
      const itemId = el.dataset.id
      const item = panel.items.find(i => i.id === itemId)
      if (item) showEditMemoryItem(charId, panel, item, overlay)
    })
  })

  // 约定卡片点击编辑
  overlay.querySelectorAll('.mem-promise-card').forEach(el => {
    el.addEventListener('click', () => {
      const promiseId = el.dataset.id
      const promise = panel.promises.find(p => p.id === promiseId)
      if (promise) showEditPromise(charId, panel, promise, overlay)
    })
  })

  // 物品卡片点击编辑
  overlay.querySelectorAll('.mem-item-card').forEach(el => {
    el.addEventListener('click', () => {
      const itemId = el.dataset.id
      const item = panel.belongings.find(b => b.id === itemId)
      if (item) showEditBelonging(charId, panel, item, overlay)
    })
  })

  // 重要日期点击编辑
  overlay.querySelectorAll('.mem-date-item').forEach(el => {
    el.addEventListener('click', () => {
      const dateId = el.dataset.id
      const date = panel.importantDates.find(d => d.id === dateId)
      if (date) showEditImportantDate(charId, panel, date, overlay)
    })
  })
}

// ===== 添加记忆弹窗 =====
function showAddMemoryModal(charId, panel, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">添加记忆</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">类型</label>' +
        '<select class="mem-add-select" id="mem-add-type">' +
          '<option value="item">记忆条目</option>' +
          '<option value="promise">约定</option>' +
          '<option value="belonging">随身物品</option>' +
          '<option value="date">重要日期</option>' +
        '</select>' +
      '</div>' +
      '<div class="mem-add-field" id="mem-add-date-field">' +
        '<label class="mem-add-label">日期</label>' +
        '<input type="date" class="mem-edit-input" id="mem-add-date" value="' + formatDate(new Date()) + '">' +
      '</div>' +
      '<div class="mem-add-field" id="mem-add-time-field">' +
        '<label class="mem-add-label">时间</label>' +
        '<input type="time" class="mem-edit-input" id="mem-add-time">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">内容</label>' +
        '<textarea class="mem-add-textarea" id="mem-add-content" placeholder="记录发生了什么..."></textarea>' +
      '</div>' +
      '<div class="mem-add-field" id="mem-add-tags-field">' +
        '<label class="mem-add-label">标签</label>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' +
          '<label><input type="checkbox" value="injury"> 受伤</label>' +
          '<label><input type="checkbox" value="recovering"> 恢复中</label>' +
          '<label><input type="checkbox" value="promise"> 约定</label>' +
          '<label><input type="checkbox" value="emotion"> 情绪</label>' +
          '<label><input type="checkbox" value="keepsake"> 信物</label>' +
        '</div>' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-add-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-add-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  // 关闭
  modal.querySelector('#mem-add-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  // 类型切换时显示/隐藏字段
  modal.querySelector('#mem-add-type').addEventListener('change', (e) => {
    const type = e.target.value
    modal.querySelector('#mem-add-date-field').style.display = (type === 'item' || type === 'date') ? '' : 'none'
    modal.querySelector('#mem-add-time-field').style.display = type === 'item' ? '' : 'none'
    modal.querySelector('#mem-add-tags-field').style.display = type === 'item' ? '' : 'none'
  })

  // 保存
  modal.querySelector('#mem-add-save').addEventListener('click', async () => {
    const type = modal.querySelector('#mem-add-type').value
    const content = modal.querySelector('#mem-add-content').value.trim()
    if (!content) return

    if (type === 'item') {
      const date = modal.querySelector('#mem-add-date').value
      const time = modal.querySelector('#mem-add-time').value
      const tags = []
      modal.querySelectorAll('#mem-add-tags-field input:checked').forEach(cb => tags.push(cb.value))
      panel.items.push({ id: 'mem_' + Date.now(), date, time, content, tags })
    } else if (type === 'promise') {
      panel.promises.push({ id: 'prom_' + Date.now(), title: content, date: modal.querySelector('#mem-add-date').value, status: 'active' })
    } else if (type === 'belonging') {
      panel.belongings.push({ id: 'bel_' + Date.now(), name: content, source: '', type: 'daily' })
    } else if (type === 'date') {
      panel.importantDates.push({ id: 'date_' + Date.now(), name: content, date: modal.querySelector('#mem-add-date').value })
    }

    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 编辑记忆条目 =====
function showEditMemoryItem(charId, panel, item, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">编辑记忆</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">日期</label>' +
        '<input type="date" class="mem-edit-input" id="mem-edit-date" value="' + (item.date || '') + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">时间</label>' +
        '<input type="time" class="mem-edit-input" id="mem-edit-time" value="' + (item.time || '') + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">内容</label>' +
        '<textarea class="mem-add-textarea" id="mem-edit-content">' + escMemHtml(item.content) + '</textarea>' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost" id="mem-edit-delete" style="color:#e88070">删除</button>' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-edit-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-edit-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  modal.querySelector('#mem-edit-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  // 删除
  modal.querySelector('#mem-edit-delete').addEventListener('click', async () => {
    panel.items = panel.items.filter(i => i.id !== item.id)
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  // 保存
  modal.querySelector('#mem-edit-save').addEventListener('click', async () => {
    item.date = modal.querySelector('#mem-edit-date').value
    item.time = modal.querySelector('#mem-edit-time').value
    item.content = modal.querySelector('#mem-edit-content').value.trim()
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 编辑约定 =====
function showEditPromise(charId, panel, promise, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">编辑约定</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">约定内容</label>' +
        '<input type="text" class="mem-edit-input" id="mem-edit-promise-title" value="' + escMemHtml(promise.title) + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">日期</label>' +
        '<input type="date" class="mem-edit-input" id="mem-edit-promise-date" value="' + (promise.date || '') + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">状态</label>' +
        '<select class="mem-add-select" id="mem-edit-promise-status">' +
          '<option value="active"' + (promise.status === 'active' ? ' selected' : '') + '>进行中</option>' +
          '<option value="done"' + (promise.status === 'done' ? ' selected' : '') + '>已完成</option>' +
          '<option value="pending"' + (promise.status === 'pending' ? ' selected' : '') + '>待定</option>' +
        '</select>' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost" id="mem-promise-delete" style="color:#e88070">删除</button>' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-promise-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-promise-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  modal.querySelector('#mem-promise-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  modal.querySelector('#mem-promise-delete').addEventListener('click', async () => {
    panel.promises = panel.promises.filter(p => p.id !== promise.id)
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.querySelector('#mem-promise-save').addEventListener('click', async () => {
    promise.title = modal.querySelector('#mem-edit-promise-title').value.trim()
    promise.date = modal.querySelector('#mem-edit-promise-date').value
    promise.status = modal.querySelector('#mem-edit-promise-status').value
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 编辑物品 =====
function showEditBelonging(charId, panel, belonging, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">编辑物品</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">物品名称</label>' +
        '<input type="text" class="mem-edit-input" id="mem-edit-bel-name" value="' + escMemHtml(belonging.name) + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">来源（谁送的/什么时候）</label>' +
        '<input type="text" class="mem-edit-input" id="mem-edit-bel-source" value="' + escMemHtml(belonging.source || '') + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">类型</label>' +
        '<select class="mem-add-select" id="mem-edit-bel-type">' +
          '<option value="keepsake"' + (belonging.type === 'keepsake' ? ' selected' : '') + '>信物（有情感意义）</option>' +
          '<option value="borrowed"' + (belonging.type === 'borrowed' ? ' selected' : '') + '>借物（需要归还）</option>' +
          '<option value="daily"' + (belonging.type === 'daily' ? ' selected' : '') + '>日常物品</option>' +
        '</select>' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost" id="mem-bel-delete" style="color:#e88070">删除</button>' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-bel-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-bel-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  modal.querySelector('#mem-bel-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  modal.querySelector('#mem-bel-delete').addEventListener('click', async () => {
    panel.belongings = panel.belongings.filter(b => b.id !== belonging.id)
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.querySelector('#mem-bel-save').addEventListener('click', async () => {
    belonging.name = modal.querySelector('#mem-edit-bel-name').value.trim()
    belonging.source = modal.querySelector('#mem-edit-bel-source').value.trim()
    belonging.type = modal.querySelector('#mem-edit-bel-type').value
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 编辑重要日期 =====
function showEditImportantDate(charId, panel, dateItem, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">编辑重要日期</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">名称</label>' +
        '<input type="text" class="mem-edit-input" id="mem-edit-date-name" value="' + escMemHtml(dateItem.name) + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">日期</label>' +
        '<input type="date" class="mem-edit-input" id="mem-edit-date-date" value="' + (dateItem.date || '') + '">' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost" id="mem-date-delete" style="color:#e88070">删除</button>' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-date-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-date-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  modal.querySelector('#mem-date-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  modal.querySelector('#mem-date-delete').addEventListener('click', async () => {
    panel.importantDates = panel.importantDates.filter(d => d.id !== dateItem.id)
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.querySelector('#mem-date-save').addEventListener('click', async () => {
    dateItem.name = modal.querySelector('#mem-edit-date-name').value.trim()
    dateItem.date = modal.querySelector('#mem-edit-date-date').value
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 设置弹窗（在一起日期、状态等） =====
function showMemorySettingsModal(charId, panel, parentOverlay) {
  const modal = document.createElement('div')
  modal.className = 'mem-add-modal'
  modal.innerHTML =
    '<div class="mem-add-card">' +
      '<div class="mem-add-title">记忆设置</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">在一起日期</label>' +
        '<input type="date" class="mem-edit-input" id="mem-set-together" value="' + (panel.togetherDate || '') + '">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">当前身体状态</label>' +
        '<input type="text" class="mem-edit-input" id="mem-set-health" value="' + escMemHtml(panel.health || '') + '" placeholder="如：膝盖基本好了">' +
      '</div>' +
      '<div class="mem-add-field">' +
        '<label class="mem-add-label">当前情绪</label>' +
        '<input type="text" class="mem-edit-input" id="mem-set-mood" value="' + escMemHtml(panel.mood || '') + '" placeholder="如：心情不错">' +
      '</div>' +
      '<div class="mem-add-actions">' +
        '<button class="mem-btn mem-btn-ghost mem-edit-cancel" id="mem-set-cancel">取消</button>' +
        '<button class="mem-btn mem-btn-primary mem-edit-save" id="mem-set-save">保存</button>' +
      '</div>' +
    '</div>'

  document.body.appendChild(modal)
  requestAnimationFrame(() => modal.classList.add('open'))

  modal.querySelector('#mem-set-cancel').addEventListener('click', () => {
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open')
      setTimeout(() => modal.remove(), 200)
    }
  })

  modal.querySelector('#mem-set-save').addEventListener('click', async () => {
    panel.togetherDate = modal.querySelector('#mem-set-together').value
    panel.health = modal.querySelector('#mem-set-health').value.trim()
    panel.mood = modal.querySelector('#mem-set-mood').value.trim()
    await saveMemoryPanel(charId, panel)
    refreshMemoryPanel(panel, parentOverlay)
    modal.classList.remove('open')
    setTimeout(() => modal.remove(), 200)
  })
}

// ===== 刷新面板内容 =====
function refreshMemoryPanel(panel, overlay) {
  const body = overlay.querySelector('#mem-panel-body')
  if (body) {
    body.innerHTML = buildMemoryPanelHTML(panel)
    // 重新绑定点击事件
    body.querySelectorAll('.mem-item').forEach(el => {
      el.addEventListener('click', async () => {
        const charId = parseInt(overlay.querySelector('.mem-panel')?.dataset?.charId)
        if (!charId) return
        const freshPanel = await loadMemoryPanel(charId)
        const item = freshPanel.items.find(i => i.id === el.dataset.id)
        if (item) showEditMemoryItem(charId, freshPanel, item, overlay)
      })
    })
  }
}

// ===== 暴露到全局 =====
window.openMemoryPanel = openMemoryPanel
window.loadMemoryPanel = loadMemoryPanel
window.saveMemoryPanel = saveMemoryPanel
