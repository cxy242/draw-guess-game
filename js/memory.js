// memory.js — 长期记忆 / 轻量海马体
// 依赖：db.js, settings.js, wechat.js 可选

(function() {
  var DEFAULT_SETTINGS = {
    enabled: true,
    summarizeEvery: 10,
    injectLimit: 12,
    embeddingEnabled: false,
    decayStrength: 'medium',
    lastSummarizedMessageId: 0
  }
  var LAMBDA_MAP = { low: 0.02, medium: 0.04, high: 0.08 }
  var STATUS_LABEL = { active: '活跃', sleeping: '沉睡', archived: '归档' }
  var LAYER_LABEL = { 1: '第一层', 2: '第二层', 3: '第三层', 4: '第四层' }
  var SOURCE_TYPE_LABEL = { wechat: '微信', x: 'X', sms: '短信', moments: '朋友圈', offline: '线下', manual: '手动', offlineMeet: '见面' }
  var ROLE_SUBTITLE_DEFAULT = '于是我们建立羁绊'
  var _launchFilter = null

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function clamp(n, min, max, fallback) {
    var v = parseFloat(n)
    if (!Number.isFinite(v)) return fallback
    return Math.max(min, Math.min(max, v))
  }

  function normalizeSettings(value) {
    return Object.assign({}, DEFAULT_SETTINGS, value || {}, {
      enabled: value?.enabled !== false,
      summarizeEvery: Math.max(1, parseInt(value?.summarizeEvery || DEFAULT_SETTINGS.summarizeEvery, 10) || DEFAULT_SETTINGS.summarizeEvery),
      injectLimit: Math.max(1, parseInt(value?.injectLimit || DEFAULT_SETTINGS.injectLimit, 10) || DEFAULT_SETTINGS.injectLimit),
      embeddingEnabled: !!value?.embeddingEnabled,
      decayStrength: LAMBDA_MAP[value?.decayStrength] ? value.decayStrength : DEFAULT_SETTINGS.decayStrength,
      lastSummarizedMessageId: parseInt(value?.lastSummarizedMessageId || 0, 10) || 0
    })
  }

  async function getSettings(chatId) {
    var row = await db.config.get('chatLongMemory_' + chatId)
    return normalizeSettings(row && row.value)
  }

  async function saveSettings(chatId, patch) {
    var current = await getSettings(chatId)
    var next = normalizeSettings(Object.assign({}, current, patch || {}))
    await db.config.put({ key: 'chatLongMemory_' + chatId, value: next })
    return next
  }

  function formatTime(ts) {
    if (!ts) return '从未'
    var d = new Date(ts)
    if (isNaN(d.getTime())) return '未知'
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  function isValidTimestamp(value) {
    var timestamp = Number(value)
    return Number.isFinite(timestamp) && timestamp > 0
  }

  function formatDateTimeLocal(ts) {
    if (!isValidTimestamp(ts)) return ''
    var d = new Date(Number(ts))
    var pad = function(value) { return String(value).padStart(2, '0') }
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  }

  function getInitial(name) {
    var text = String(name || '').trim()
    return text ? Array.from(text)[0] : '?'
  }

  function getCharName(c, fallback) {
    return (c && (c.wechatName || c.nick || c.name)) || fallback || '未知'
  }

  function getCharAvatar(c) {
    return (c && (c.wechatAvatar || c.avatar)) || ''
  }

  function buildRoundAvatar(avatar, name, className) {
    var safeName = esc(name || '')
    var inner = avatar
      ? '<img src="' + esc(avatar) + '" alt="' + safeName + '">'
      : '<span class="memory-avatar-placeholder">' + esc(getInitial(name)) + '</span>'
    return '<span class="' + (className || 'memory-avatar') + '">' + inner + '</span>'
  }

  async function getMemorySelfProfile(uid) {
    if (!uid) return { avatar: '' }
    var row = await db.config.get('wechatSelfProfile_' + uid)
    return Object.assign({ avatar: '' }, row && row.value || {})
  }

  function tokenize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\u4e00-\u9fa5]+/gu, ' ')
      .split(/\s+/)
      .filter(function(w) { return w && w.length > 1 })
  }

  function cosineSimilarity(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || a.length !== b.length) return 0
    var dot = 0, an = 0, bn = 0
    for (var i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      an += a[i] * a[i]
      bn += b[i] * b[i]
    }
    if (!an || !bn) return 0
    return dot / (Math.sqrt(an) * Math.sqrt(bn))
  }

  function getDecayScore(memory, settings) {
    if (memory.status === 'archived') return 0
    // 长期记忆锁定100%
    if (memory.isLongTerm) return 100
    // 使用decayPercent字段（80%起步，每天-1%）
    if (typeof memory.decayPercent === 'number') {
      var now = Date.now()
      var last = memory.lastRecalledAt || memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now
      var days = Math.max(0, Math.floor((now - last) / 86400000))
      var current = Math.max(0, memory.decayPercent - days)
      return current
    }
    // 旧版兼容：用原公式计算
    var now = Date.now()
    var last = memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now
    var days = Math.max(0, (now - last) / 86400000)
    var lambda = LAMBDA_MAP[settings?.decayStrength] || LAMBDA_MAP.medium
    var importance = clamp(memory.importance, 1, 10, 5)
    var accessCount = parseInt(memory.accessCount || 0, 10) || 0
    var arousal = clamp(memory.arousal, 0, 1, 0)
    return importance * Math.pow(accessCount + 1, 0.3) * Math.exp(-lambda * days) * (1 + arousal * 0.5)
  }

  // 获取衰减百分比（新版：直接返回decayPercent经过天数衰减后的值）
  function getDecayPercent(memory) {
    if (memory.status === 'archived') return 0
    if (memory.isLongTerm) return 100
    if (typeof memory.decayPercent === 'number') {
      var now = Date.now()
      var last = memory.lastRecalledAt || memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now
      var days = Math.max(0, Math.floor((now - last) / 86400000))
      return Math.max(0, memory.decayPercent - days)
    }
    return 80 // 默认值
  }

  // 回忆：将记忆恢复到80%
  function recallMemory(memory) {
    memory.decayPercent = 80
    memory.lastRecalledAt = Date.now()
    if (memory.status === 'sleeping') memory.status = 'active'
    return memory
  }

  function getKeywordScore(memory, queryText) {
    var text = String(queryText || '').toLowerCase()
    var keywords = Array.isArray(memory.keywords) ? memory.keywords : []
    // 关键词精确匹配
    var keywordHits = keywords.filter(function(k) { return k && text.includes(String(k).toLowerCase()) }).length
    // 分词匹配
    var queryTokens = tokenize(queryText)
    var memoryTokens = new Set(tokenize([memory.title, memory.content, keywords.join(' ')].join(' ')))
    var tokenHits = queryTokens.filter(function(t) { return memoryTokens.has(t) }).length
    // 中文字符bigram匹配（提升语义相关性）
    var chineseQuery = text.replace(/[^\u4e00-\u9fa5]/g, '')
    var chineseMemory = [memory.title, memory.content].join('').replace(/[^\u4e00-\u9fa5]/g, '')
    var bigramHits = 0
    for (var i = 0; i < chineseQuery.length - 1; i++) {
      var bigram = chineseQuery.slice(i, i + 2)
      if (chineseMemory.includes(bigram)) bigramHits++
    }
    var bigramScore = Math.min(1, bigramHits * 0.1)
    return Math.min(1, keywordHits * 0.35 + tokenHits * 0.12 + bigramScore)
  }

  // 自动回忆：AI回复后检查是否引用了记忆内容
  async function autoRecallMemories(chatId, charId, ownerUid, aiReplyText) {
    if (!db.memories || !aiReplyText) return
    try {
      var rows = await db.memories.where('chatId').equals(chatId).filter(function(m) {
        return m.ownerUid === ownerUid && m.charId === charId && m.status !== 'archived'
      }).toArray()
      if (!rows.length) return
      var now = Date.now()
      rows.forEach(function(m) {
        var score = getKeywordScore(m, aiReplyText)
        if (score > 0.25) {
          recallMemory(m)
          db.memories.update(m.id, {
            decayPercent: m.decayPercent,
            lastRecalledAt: now,
            status: m.status
          }).catch(function() {})
        }
      })
    } catch(e) {}
  }

  function getEmotionScore(memory) {
    var valence = Math.abs(clamp(memory.valence, -1, 1, 0))
    var arousal = clamp(memory.arousal, 0, 1, 0)
    return Math.min(1, valence * 0.4 + arousal * 0.6)
  }

  async function getEmbeddingConfig() {
    var rows = await Promise.all([
      db.config.get('subapiBaseUrl'), db.config.get('subapiKey'), db.config.get('subapiModel'),
      db.config.get('apiBaseUrl'), db.config.get('apiKey'), db.config.get('apiModel')
    ])
    var sub = { url: rows[0]?.value || '', key: rows[1]?.value || '', model: rows[2]?.value || '' }
    var primary = { url: rows[3]?.value || '', key: rows[4]?.value || '', model: rows[5]?.value || '' }
    return (sub.url && sub.key && sub.model) ? sub : primary
  }

  async function createEmbedding(input) {
    var cfg = await getEmbeddingConfig()
    if (!cfg.url || !cfg.key || !cfg.model) throw new Error('向量 API 未配置')
    var res = await fetch(String(cfg.url).replace(/\/$/, '') + '/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.key },
      body: JSON.stringify({ model: cfg.model, input: input })
    })
    var text = await res.text()
    var json = text ? JSON.parse(text) : {}
    if (!res.ok) throw new Error(json?.error?.message || json?.message || ('向量接口失败：HTTP ' + res.status))
    var embedding = json?.data?.[0]?.embedding
    if (!Array.isArray(embedding)) throw new Error('向量接口未返回 embedding 数组')
    await db.config.put({ key: 'memoryEmbeddingStatus', value: { ok: true, testedAt: Date.now(), dim: embedding.length, error: '' } })
    return embedding
  }

  async function testEmbedding() {
    try {
      var embedding = await createEmbedding('月月长期记忆向量测试')
      window.toast && window.toast('向量接口可用：' + embedding.length + ' 维')
      return true
    } catch (e) {
      await db.config.put({ key: 'memoryEmbeddingStatus', value: { ok: false, testedAt: Date.now(), error: e.message || String(e) } })
      window.toast && window.toast('向量不可用，已使用基础检索')
      return false
    }
  }

  function normalizeMemoryApiUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '')
  }

  function readMemoryApiForm(page) {
    var get = function(id) {
      var el = page.querySelector('#' + id)
      return el ? String(el.value || '').trim() : ''
    }
    var cfg = {
      url: normalizeMemoryApiUrl(get('memory-api-base-url')),
      key: get('memory-api-key'),
      model: get('memory-api-model-input')
    }
    cfg.complete = !!(cfg.url && cfg.key && cfg.model)
    return cfg
  }

  function validateMemoryApiForm(cfg) {
    var missing = []
    if (!cfg.url) missing.push('Base URL')
    if (!cfg.key) missing.push('API Key')
    if (!cfg.model) missing.push('模型')
    if (missing.length) throw new Error('请填写：' + missing.join('、'))
  }

  async function refreshMemoryApiStatus(page) {
    if (!page || !page.isConnected) return
    await renderMemoryPage(page)
  }

  async function openMemoryApiConfigPage(memoryPage) {
    var oldPage = document.getElementById('memory-api-config-page')
    if (oldPage) oldPage.remove()
    var cfg = window.loadMemoryApiConfig
      ? await window.loadMemoryApiConfig()
      : { url: '', key: '', model: '', complete: false }
    var html = `
      <div class="setting-section">
        <div class="api-form memory-api-form">
          <div class="memory-api-desc">
            专属记忆总结 API，仅用于微信聊天记忆总结、线下见面记忆总结。
          </div>
          <label class="form-label">Base URL</label>
          <input class="input-field" id="memory-api-base-url" placeholder="https://api.openai.com/v1" value="${esc(cfg.url)}">
          <label class="form-label">API Key</label>
          <div class="input-with-toggle">
            <input class="input-field" id="memory-api-key" type="password" autocomplete="off" placeholder="sk-..." value="${esc(cfg.key)}">
            <button class="btn-text-toggle" id="memory-api-key-toggle" type="button">显示</button>
          </div>
          <label class="form-label">模型</label>
          <input class="input-field" id="memory-api-model-input" placeholder="手动输入模型名，例如 gpt-4o-mini" value="${esc(cfg.model)}">
          <div class="model-row">
            <select class="input-field" id="memory-api-model">
              <option value="">拉取后选择模型</option>
              ${cfg.model ? `<option value="${esc(cfg.model)}" selected>${esc(cfg.model)}</option>` : ''}
            </select>
            <button class="btn-ghost btn-sm" id="memory-api-load-models" type="button">获取</button>
          </div>
          <div class="api-test-row">
            <button class="btn-ghost" id="memory-api-test" type="button">连接测试</button>
          </div>
          <button class="btn-pill btn-full" id="memory-api-save" type="button">保存记忆 API</button>
          <button class="btn-ghost btn-full btn-text-danger memory-api-clear" id="memory-api-clear" type="button">清除配置并使用默认 API</button>
        </div>
      </div>`
    var page = buildSubPage('memory-api-config-page', '记忆 API', html)
    openSubPage(page)

    var keyInput = page.querySelector('#memory-api-key')
    var keyToggle = page.querySelector('#memory-api-key-toggle')
    keyToggle.addEventListener('click', function() {
      var hidden = keyInput.type === 'password'
      keyInput.type = hidden ? 'text' : 'password'
      keyToggle.textContent = hidden ? '隐藏' : '显示'
    })
    page.querySelector('#memory-api-model').addEventListener('change', function(e) {
      if (e.target.value) page.querySelector('#memory-api-model-input').value = e.target.value
    })
    page.querySelector('#memory-api-load-models').addEventListener('click', async function(e) {
      var btn = e.currentTarget
      var formCfg = readMemoryApiForm(page)
      if (!formCfg.url) { window.toast && window.toast('请先填写 Base URL'); return }
      btn.disabled = true
      btn.textContent = '获取中...'
      try {
        var res = await fetch(formCfg.url + '/models', {
          headers: { Authorization: 'Bearer ' + formCfg.key }
        })
        var text = await res.text()
        var json = text ? JSON.parse(text) : {}
        if (!res.ok) throw new Error(json?.error?.message || json?.message || ('HTTP ' + res.status))
        var models = Array.isArray(json.data)
          ? json.data.map(function(item) { return item && item.id }).filter(Boolean)
          : []
        var current = page.querySelector('#memory-api-model-input').value.trim()
        var select = page.querySelector('#memory-api-model')
        var options = ['<option value="">拉取后选择模型</option>']
        models.forEach(function(model) {
          options.push(`<option value="${esc(model)}" ${model === current ? 'selected' : ''}>${esc(model)}</option>`)
        })
        if (current && models.indexOf(current) < 0) {
          options.push(`<option value="${esc(current)}" selected>${esc(current)}</option>`)
        }
        select.innerHTML = options.join('')
        window.toast && window.toast('已加载 ' + models.length + ' 个模型')
      } catch (e2) {
        window.toast && window.toast('获取模型失败：' + (e2.message || String(e2)))
      } finally {
        btn.disabled = false
        btn.textContent = '获取'
      }
    })
    page.querySelector('#memory-api-test').addEventListener('click', async function(e) {
      var btn = e.currentTarget
      var oldText = btn.textContent
      btn.disabled = true
      btn.textContent = '测试中...'
      try {
        var formCfg = readMemoryApiForm(page)
        validateMemoryApiForm(formCfg)
        var json = await window.runTrackedChatCompletion(formCfg, {
          model: formCfg.model,
          messages: [{ role: 'user', content: '请只回复：连接成功' }]
        }, '记忆专属 API 连接测试')
        var message = json?.choices?.[0]?.message
        if (!message || (message.content == null && !message.reasoning_content)) {
          throw new Error('接口已响应，但没有返回有效的聊天内容')
        }
        window.toast && window.toast('记忆 API 连接成功')
      } catch (e2) {
        window.toast && window.toast('连接测试失败：' + (e2.message || String(e2)))
      } finally {
        btn.disabled = false
        btn.textContent = oldText
      }
    })
    page.querySelector('#memory-api-save').addEventListener('click', async function(e) {
      var btn = e.currentTarget
      try {
        var formCfg = readMemoryApiForm(page)
        validateMemoryApiForm(formCfg)
        btn.disabled = true
        await Promise.all([
          db.config.put({ key: 'memoryApiBaseUrl', value: formCfg.url }),
          db.config.put({ key: 'memoryApiKey', value: formCfg.key }),
          db.config.put({ key: 'memoryApiModel', value: formCfg.model })
        ])
        window._memoryApiConfigCache = null
        window.toast && window.toast('记忆 API 已保存')
        await refreshMemoryApiStatus(memoryPage)
      } catch (e2) {
        window.toast && window.toast('保存失败：' + (e2.message || String(e2)))
      } finally {
        btn.disabled = false
      }
    })
    page.querySelector('#memory-api-clear').addEventListener('click', async function(e) {
      if (!confirm('清除记忆专属 API 配置并恢复使用默认 API？')) return
      var btn = e.currentTarget
      btn.disabled = true
      try {
        await Promise.all([
          db.config.delete('memoryApiBaseUrl'),
          db.config.delete('memoryApiKey'),
          db.config.delete('memoryApiModel')
        ])
        window._memoryApiConfigCache = null
        page.querySelector('#memory-api-base-url').value = ''
        page.querySelector('#memory-api-key').value = ''
        page.querySelector('#memory-api-model-input').value = ''
        page.querySelector('#memory-api-model').innerHTML = '<option value="">拉取后选择模型</option>'
        window.toast && window.toast('已恢复使用默认 API')
        await refreshMemoryApiStatus(memoryPage)
      } catch (e2) {
        window.toast && window.toast('清除失败：' + (e2.message || String(e2)))
      } finally {
        btn.disabled = false
      }
    })
  }

  function getMemoryApiStatusText(cfg) {
    return cfg && cfg.complete
      ? '专属 API · ' + cfg.model
      : '未配置专属 API'
  }

  function buildSummaryPrompt(messages, charName, userName) {
    charName = charName || '角色'
    userName = userName || '用户'
    var lines = messages.map(function(m) {
      var speaker = m.role === 'assistant' ? charName : userName
      return speaker + '：' + String(m.content || '').replace(/\s+/g, ' ').slice(0, 800)
    }).join('\n')
    return `你是一个长期记忆整理器。请根据下面的聊天记录，提取适合长期保存的记忆。

要求：
1. 使用第三人称叙述。
2. 客观平实：只陈述发生了什么、谁表达了什么、双方形成了什么关系信息或偏好信息。
3. 禁止使用强烈情绪词汇，例如“极度愤怒”“痛彻心扉”“欣喜若狂”等。
4. 不要价值升华，不要写感悟，不要总结人生意义。
5. 禁止加入聊天记录中没有出现的信息。
6. 标题应尽量简短；内容应控制在150字以内，适合未来${charName}回复时参考。

请返回合法 JSON，不要输出 Markdown，不要输出 JSON 以外的文字。

JSON 格式：
{
  "memories": [
    {
      "title": "简短标题",
      "content": "第三人称、客观平实的记忆内容，150字以内",
      "keywords": ["关键词1", "关键词2"],
      "valence": 0,
      "arousal": 0.3,
      "importance": 5
    }
  ]
}

字段说明：
- title：尽量简短，用于快速识别这条记忆。
- content：第三人称客观陈述，150字以内，禁止夸张、抒情、升华。
- keywords：用于后续检索的关键词。
- valence：情感效价，-1 到 1。负数表示负向，0 表示中性，正数表示正向。
- arousal：唤醒度，0 到 1。越接近平静越低，越涉及冲突、紧张、强烈偏好越高。
- importance：重要度，1 到 10。长期关系事实、稳定偏好、身份背景更高；临时闲聊更低。

聊天记录：
${lines}`
  }

  function buildMeetingSummaryPrompt(messages, charName, userName) {
    charName = charName || '角色'
    userName = userName || '用户'
    var lines = messages.map(function(m) {
      var speaker = m.role === 'assistant' ? charName : userName
      return speaker + '：' + String(m.content || '').replace(/\s+/g, ' ').slice(0, 800)
    }).join('\n')
    return `你是一个线下见面记忆整理器。请根据下面的见面记录，提取适合长期保存的记忆。

要求：
1. 使用第三人称叙述。
2. 每条记忆的内容必须按以下5个板块结构化：
   【当前状态】时间、地点、氛围，各角色的状态（情绪、身体等）
   【认知与变动】对话中获得的新认知，关系的变化
   【物品与伏笔】出现的重要物品，对话中暗示的未来事件
   【未完成的悬念】答应但还没做的事，未解决的问题
   【剧情总结】3-5句话概括核心事件和情感变化
3. 区分已经发生的事件和尚未完成的计划，不要将计划写成事实。
4. 禁止使用强烈情绪词汇，不要进行文学化描写。
5. 禁止加入见面记录中没有出现的信息。
6. 标题应尽量简短；内容按5板块格式，每板块2-3句话。

请返回合法 JSON，不要输出 Markdown，不要输出 JSON 以外的文字。

JSON 格式：
{
  "memories": [
    {
      "title": "简短标题",
      "content": "【当前状态】...【认知与变动】...【物品与伏笔】...【未完成的悬念】...【剧情总结】...",
      "keywords": ["关键词1", "关键词2"],
      "valence": 0,
      "arousal": 0.3,
      "importance": 5
    }
  ]
}

字段说明：
- title：尽量简短，用于快速识别。
- content：按5板块格式书写，每板块2-3句话。板块之间用换行分隔。
- keywords：用于后续检索的关键词。
- valence：情感效价，-1到1。
- arousal：唤醒度，0到1。
- importance：重要度，1到10。

见面记录：
${lines}`
  }

  function extractJson(text) {
    var s = String(text || '').trim()
    var match = s.match(/\{[\s\S]*\}/)
    if (match) s = match[0]
    return JSON.parse(s)
  }

  function normalizeMemory(raw, meta) {
    var title = String(raw?.title || '').trim().slice(0, 30) || '未命名记忆'
    var content = String(raw?.content || '').trim().slice(0, 150)
    if (!content) return null
    var now = isValidTimestamp(meta.createdAt) ? Number(meta.createdAt) : Date.now()
    return {
      ownerUid: meta.ownerUid,
      charId: meta.charId,
      chatId: meta.chatId,
      title: title,
      content: content,
      keywords: Array.isArray(raw.keywords) ? raw.keywords.map(function(k) { return String(k).trim() }).filter(Boolean).slice(0, 8) : [],
      valence: clamp(raw.valence, -1, 1, 0),
      arousal: clamp(raw.arousal, 0, 1, 0.3),
      importance: clamp(raw.importance, 1, 10, 5),
      embedding: null,
      status: 'active',
      sourceMsgStartId: meta.fromMsgId,
      sourceMsgEndId: meta.toMsgId,
      sourceAt: isValidTimestamp(meta.sourceAt) ? Number(meta.sourceAt) : null,
      // 新增字段：衰减、层级、长期记忆、参与人物
      decayPercent: 80,
      isLongTerm: false,
      injectionLayer: clamp(raw.injectionLayer, 1, 4, 2),
      participants: Array.isArray(raw.participants) ? raw.participants : [],
      lastRecalledAt: null,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null,
      accessCount: 0
    }
  }

  async function runSummary(chatId, charId, ownerUid, options) {
    options = options || {}
    if (!window.callMemoryAI || !db.memories || !ownerUid || !chatId || !charId) {
      return { ok: false, skipped: true, reason: '记忆系统未就绪', memoryCount: 0, messageCount: 0 }
    }
    // 查找角色和用户的真实名字
    var charName = 'AI'
    var userName = '用户'
    try {
      var char = await db.characters.get(charId)
      if (char) charName = getCharName(char, 'AI')
      var user = await db.characters.get(ownerUid)
      if (user) userName = getCharName(user, '用户')
    } catch(e) {}
    var settings = await getSettings(chatId)
    if (!options.force && !settings.enabled) {
      return { ok: false, skipped: true, reason: '自动总结未开启', memoryCount: 0, messageCount: 0 }
    }
    var msgs = await db.messages.where('chatId').equals(chatId).sortBy('createdAt')
    var fresh = msgs.filter(function(m) { return m.id > settings.lastSummarizedMessageId })
    if (!fresh.length) {
      return { ok: false, skipped: true, reason: '没有可总结的新消息', memoryCount: 0, messageCount: 0 }
    }
    if (!options.force && fresh.length < settings.summarizeEvery) {
      return { ok: false, skipped: true, reason: '未达到自动总结条数', memoryCount: 0, messageCount: fresh.length }
    }
    var fromMsgId = fresh[0].id
    var toMsgId = fresh[fresh.length - 1].id
    var sourceAt = isValidTimestamp(fresh[fresh.length - 1].createdAt) ? Number(fresh[fresh.length - 1].createdAt) : null

    // 存储完整原文（用于重新总结）
    var originalText = fresh.map(function(m) {
      var time = isValidTimestamp(m.createdAt) ? formatMemoryDateTime(Number(m.createdAt)) : ''
      var role = m.role === 'user' ? userName : charName
      return '[' + time + '] ' + role + '：' + (m.content || '')
    }).join('\n')

    var prompt = buildSummaryPrompt(fresh, charName, userName)

    // 自动重试逻辑：最多尝试2次
    var lastError = null
    var parsed = null
    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        var raw = await window.callMemoryAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', temperature: await window.getAITemperaturePreset('summaryMode') })
        parsed = extractJson(raw)
        if (parsed && Array.isArray(parsed.memories) && parsed.memories.length > 0) break
        lastError = 'AI返回为空或格式错误'
      } catch(e) {
        lastError = e.message || String(e)
        console.warn('[memory] 总结第' + attempt + '次失败：', lastError)
      }
    }

    // 2次都失败 → 记录失败，不标记为已总结
    if (!parsed || !Array.isArray(parsed.memories) || parsed.memories.length === 0) {
      await db.memoryRuns.add({
        ownerUid: ownerUid,
        charId: charId,
        chatId: chatId,
        fromMsgId: fromMsgId,
        toMsgId: toMsgId,
        sourceType: 'wechat',
        sourceAt: sourceAt,
        createdAt: Date.now(),
        memoryCount: 0,
        mode: options.force ? 'manual' : 'auto',
        status: 'failed',
        failReason: lastError || '未知错误',
        originalText: originalText,
        messageCount: fresh.length
      })
      // 不更新lastSummarizedMessageId → 下次会重新尝试
      return { ok: false, skipped: false, reason: lastError || '总结失败', memoryCount: 0, messageCount: fresh.length, failed: true, originalText: originalText }
    }

    var memories = parsed.memories
    var rows = []
    var embeddingFailed = false
    for (var i = 0; i < memories.length; i++) {
      var row = normalizeMemory(memories[i], {
        ownerUid: ownerUid, charId: charId, chatId: chatId,
        fromMsgId: fromMsgId, toMsgId: toMsgId,
        sourceAt: sourceAt
      })
      if (!row) continue
      row.sourceType = 'wechat'
      if (settings.embeddingEnabled) {
        try { row.embedding = await createEmbedding(row.title + '\n' + row.content) }
        catch (e) {
          embeddingFailed = true
          console.warn('[memory] 生成向量失败，降级保存：', e)
        }
      }
      rows.push(row)
    }
    if (rows.length) await db.memories.bulkAdd(rows)
    await db.memoryRuns.add({
      ownerUid: ownerUid,
      charId: charId,
      chatId: chatId,
      fromMsgId: fromMsgId,
      toMsgId: toMsgId,
      sourceType: 'wechat',
      sourceAt: sourceAt,
      createdAt: Date.now(),
      memoryCount: rows.length,
      mode: options.force ? 'manual' : 'auto',
      status: 'success',
      originalText: originalText,
      messageCount: fresh.length
    })
    await saveSettings(chatId, { lastSummarizedMessageId: toMsgId })
    await db.config.put({ key: 'memoryLastSummaryAt', value: Date.now() })
    return { ok: true, skipped: false, memoryCount: rows.length, messageCount: fresh.length, embeddingFailed: embeddingFailed }
  }

  async function summarizeIfNeeded(chatId, charId, ownerUid) {
    try {
      var result = await runSummary(chatId, charId, ownerUid, { force: false })
      // 如果失败，弹窗提示
      if (result.failed && window.toast) {
        window.toast('记忆总结失败：' + (result.reason || '未知错误'))
      }
      return result
    } catch (e) {
      console.warn('[memory] 自动总结失败：', e)
      await db.config.put({ key: 'memoryLastError', value: e.message || String(e) })
      if (window.toast) window.toast('记忆总结异常：' + (e.message || '未知错误'))
      return { ok: false, skipped: false, error: e.message || String(e), memoryCount: 0, messageCount: 0, failed: true }
    }
  }

  async function summarizeNow(chatId, charId, ownerUid) {
    return await runSummary(chatId, charId, ownerUid, { force: true })
  }

  async function summarizeMeeting(chatId, charId, ownerUid, sessionId, messages, endedAt) {
    if (!window.callMemoryAI || !db.memories || !db.memoryRuns || !ownerUid || !chatId || !charId || !sessionId) {
      throw new Error('记忆系统未就绪')
    }
    // 查找角色和用户的真实名字
    var charName = 'AI'
    var userName = '用户'
    try {
      var char = await db.characters.get(charId)
      if (char) charName = getCharName(char, 'AI')
      var user = await db.characters.get(ownerUid)
      if (user) userName = getCharName(user, '用户')
    } catch(e) {}
    var source = Array.isArray(messages) ? messages.filter(function(m) { return String(m.content || '').trim() }) : []
    if (!source.length) throw new Error('没有可总结的见面记录')

    // 存储完整原文
    var originalText = source.map(function(m) {
      var time = isValidTimestamp(m.createdAt) ? formatMemoryDateTime(Number(m.createdAt)) : ''
      var role = m.role === 'user' ? userName : charName
      return '[' + time + '] ' + role + '：' + (m.content || '')
    }).join('\n')

    // 检查已有的成功总结（失败的不算）
    var existingRun = await db.memoryRuns.where('chatId').equals(chatId).filter(function(run) {
      return run.ownerUid === ownerUid && run.charId === charId && run.sourceSessionId === sessionId && run.mode === 'meet' && run.status !== 'failed'
    }).first()
    if (existingRun) {
      return { ok: true, skipped: true, alreadySummarized: true, memoryCount: existingRun.memoryCount || 0, messageCount: source.length }
    }
    var existingMemories = await db.memories.where('chatId').equals(chatId).filter(function(memory) {
      return memory.ownerUid === ownerUid && memory.charId === charId && memory.sourceSessionId === sessionId
    }).toArray()
    if (existingMemories.length) {
      return { ok: true, skipped: true, alreadySummarized: true, memoryCount: existingMemories.length, messageCount: source.length }
    }

    var settings = await getSettings(chatId)
    var fromMsgId = source[0].id || 0
    var toMsgId = source[source.length - 1].id || fromMsgId
    var prompt = buildMeetingSummaryPrompt(source, charName, userName)

    // 自动重试逻辑：最多尝试2次
    var lastError = null
    var parsed = null
    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        var raw = await window.callMemoryAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', temperature: await window.getAITemperaturePreset('summaryMode') })
        parsed = extractJson(raw)
        if (parsed && Array.isArray(parsed.memories) && parsed.memories.length > 0) break
        lastError = 'AI返回为空或格式错误'
      } catch(e) {
        lastError = e.message || String(e)
        console.warn('[memory] 见面总结第' + attempt + '次失败：', lastError)
      }
    }

    // 2次都失败 → 记录失败
    if (!parsed || !Array.isArray(parsed.memories) || parsed.memories.length === 0) {
      await db.memoryRuns.add({
        ownerUid: ownerUid,
        charId: charId,
        chatId: chatId,
        fromMsgId: fromMsgId,
        toMsgId: toMsgId,
        sourceSessionId: sessionId,
        sourceEndedAt: Number(endedAt) || null,
        sourceType: 'offlineMeet',
        sourceAt: Number(endedAt) || null,
        createdAt: Date.now(),
        memoryCount: 0,
        mode: 'meet',
        status: 'failed',
        failReason: lastError || '未知错误',
        originalText: originalText,
        messageCount: source.length
      })
      return { ok: false, skipped: false, reason: lastError || '总结失败', memoryCount: 0, messageCount: source.length, failed: true, originalText: originalText }
    }

    var memories = parsed.memories
    var rows = []
    var embeddingFailed = false
    for (var i = 0; i < memories.length; i++) {
      var row = normalizeMemory(memories[i], {
        ownerUid: ownerUid, charId: charId, chatId: chatId,
        fromMsgId: fromMsgId, toMsgId: toMsgId,
        sourceAt: Number(endedAt) || null
      })
      if (!row) continue
      row.sourceSessionId = sessionId
      row.sourceType = 'offlineMeet'
      row.sourceEndedAt = Number(endedAt) || null
      if (settings.embeddingEnabled) {
        try { row.embedding = await createEmbedding(row.title + '\n' + row.content) }
        catch (e) {
          embeddingFailed = true
          console.warn('[memory] 见面记忆生成向量失败，降级保存：', e)
        }
      }
      rows.push(row)
    }
    if (rows.length) await db.memories.bulkAdd(rows)
    await db.memoryRuns.add({
      ownerUid: ownerUid,
      charId: charId,
      chatId: chatId,
      fromMsgId: fromMsgId,
      toMsgId: toMsgId,
      sourceSessionId: sessionId,
      sourceEndedAt: Number(endedAt) || null,
      sourceType: 'offlineMeet',
      sourceAt: Number(endedAt) || null,
      createdAt: Date.now(),
      memoryCount: rows.length,
      mode: 'meet',
      status: 'success',
      originalText: originalText,
      messageCount: source.length
    })
    await db.config.put({ key: 'memoryLastSummaryAt', value: Date.now() })
    return { ok: true, skipped: false, memoryCount: rows.length, messageCount: source.length, embeddingFailed: embeddingFailed }
  }

  function getMemoryInjectionSourceAt(memory) {
    var sourceAt = Number(memory && memory.sourceAt)
    return isValidTimestamp(sourceAt) ? sourceAt : null
  }

  async function getMemoryContext(chatId, charId, ownerUid, recentMessages) {
    if (!db.memories || !ownerUid || !chatId || !charId) return ''
    var settings = await getSettings(chatId)
    if (!settings.enabled) return ''
    var rows = await db.memories.where('chatId').equals(chatId).filter(function(m) {
      return m.ownerUid === ownerUid && m.charId === charId && m.status !== 'archived'
    }).toArray()
    if (!rows.length) return ''
    var queryText = (recentMessages || []).map(function(m) { return m.content || '' }).join(' ')
    var queryEmbedding = null
    if (settings.embeddingEnabled && rows.some(function(m) { return Array.isArray(m.embedding) })) {
      try { queryEmbedding = await createEmbedding(queryText || '当前聊天') }
      catch (e) { console.warn('[memory] 查询向量失败，降级检索：', e) }
    }
    var scored = rows.map(function(m) {
      var semanticScore = queryEmbedding ? Math.max(0, cosineSimilarity(queryEmbedding, m.embedding)) : 0
      var keywordScore = getKeywordScore(m, queryText)
      var importanceScore = clamp(m.importance, 1, 10, 5) / 10
      var emotionScore = getEmotionScore(m)
      var decayPercent = getDecayPercent(m)
      var decayScore = Math.min(1, decayPercent / 100)
      // 层级越高（数字越小）分数越高
      var layerScore = (5 - (m.injectionLayer || 2)) / 4
      return {
        memory: m,
        score: semanticScore * 4 + keywordScore * 3 + importanceScore * 2 + emotionScore * 1.5 + decayScore + layerScore * 2
      }
    }).sort(function(a, b) { return b.score - a.score })
    var selected = scored.slice(0, settings.injectLimit).filter(function(x) { return x.score > 0.15 || x.memory.status === 'active' })
    var now = Date.now()
    await Promise.all(selected.map(function(x) {
      return db.memories.update(x.memory.id, {
        lastAccessedAt: now,
        accessCount: (parseInt(x.memory.accessCount || 0, 10) || 0) + 1,
        status: x.memory.status === 'sleeping' ? 'active' : x.memory.status
      })
    }))
    var sleepUpdates = []
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].status === 'active' && getDecayPercent(rows[i]) < 20 && !rows[i].isLongTerm) {
        sleepUpdates.push(db.memories.update(rows[i].id, { status: 'sleeping' }))
      }
    }
    if (sleepUpdates.length) await Promise.all(sleepUpdates)
    if (!selected.length) return ''
    // 按注入层级排序：第一层最前面，第四层最后面
    var orderedForInjection = selected.map(function(x, index) {
      return {
        item: x,
        originalIndex: index,
        layer: x.memory.injectionLayer || 2,
        sourceAt: getMemoryInjectionSourceAt(x.memory)
      }
    }).sort(function(a, b) {
      // 先按层级排（数字小的在前）
      if (a.layer !== b.layer) return a.layer - b.layer
      // 同层级内按时间排
      var aHasSourceAt = a.sourceAt != null
      var bHasSourceAt = b.sourceAt != null
      if (aHasSourceAt !== bHasSourceAt) return aHasSourceAt ? 1 : -1
      if (!aHasSourceAt) return a.originalIndex - b.originalIndex
      if (a.sourceAt !== b.sourceAt) return a.sourceAt - b.sourceAt
      return a.originalIndex - b.originalIndex
    }).map(function(entry) {
      return entry.item
    })
    var result = orderedForInjection.map(function(x, i) {
      var m = x.memory
      var sourceLabel = SOURCE_TYPE_LABEL[m.sourceType] || '微信'
      var memoryTime = getMemoryInjectionSourceAt(m)
      var timeStr = memoryTime ? formatMemoryDateTime(memoryTime) : '未知时间'
      var relativeStr = memoryTime ? '（' + formatRelativeTime(memoryTime) + '）' : ''
      var layerTag = '【' + (LAYER_LABEL[m.injectionLayer] || '第二层') + '】'
      var keywordsTag = (m.keywords && m.keywords.length) ? ' 关键词：' + m.keywords.join('、') : ''
      return `${i + 1}. ${layerTag}【${sourceLabel}｜${timeStr}${relativeStr}】${m.title}：${m.content}${keywordsTag}`
    }).join('\n')

    // 追加未总结的近期动态（X帖子+朋友圈）
    var recentActivity = []
    try {
      // X帖子（从localStorage读取）
      var xPosts = JSON.parse(localStorage.getItem('wanwan_x_posts') || '[]')
      var charXPosts = xPosts.filter(function(p) { return String(p.authorId) === String(charId) })
        .sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
        .slice(0, 3)
      charXPosts.forEach(function(p) {
        var time = p.createdAt ? formatRelativeTime(p.createdAt) : '最近'
        recentActivity.push('【X帖子｜' + time + '】' + (p.content || '').slice(0, 100))
      })
    } catch(e) {}

    try {
      // 朋友圈（从db读取）
      if (db.moments) {
        var moments = await db.moments.where('charId').equals(charId).toArray()
        moments.sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
        moments.slice(0, 3).forEach(function(m) {
          var time = m.createdAt ? formatRelativeTime(m.createdAt) : '最近'
          recentActivity.push('【朋友圈｜' + time + '】' + (m.text || '').slice(0, 100))
        })
      }
    } catch(e) {}

    if (recentActivity.length) {
      result += '\n\n【近期动态（未总结）】\n' + recentActivity.join('\n')
    }

    return result
  }

  function formatMemoryDateTime(ts) {
    if (!isValidTimestamp(ts)) return '未知时间'
    var d = new Date(Number(ts))
    if (isNaN(d.getTime())) return '未知时间'
    return d.toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    })
  }

  // 相对时间（让AI知道这是多久前的事）
  function formatRelativeTime(ts) {
    if (!isValidTimestamp(ts)) return ''
    var diff = Date.now() - Number(ts)
    if (diff < 0) return '刚刚'
    var mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return mins + '分钟前'
    var hours = Math.floor(mins / 60)
    if (hours < 24) return hours + '小时前'
    var days = Math.floor(hours / 24)
    if (days < 30) return days + '天前'
    var months = Math.floor(days / 30)
    return months + '个月前'
  }

  async function listMemories(filter) {
    filter = filter || {}
    var ownerUid = filter.ownerUid ? parseInt(filter.ownerUid, 10) : 0
    var charId = filter.charId ? parseInt(filter.charId, 10) : 0
    var chatId = filter.chatId ? parseInt(filter.chatId, 10) : 0
    var rows = await db.memories.toArray()
    return rows.filter(function(m) {
      if (ownerUid && parseInt(m.ownerUid, 10) !== ownerUid) return false
      if (charId && parseInt(m.charId, 10) !== charId) return false
      if (chatId && parseInt(m.chatId, 10) !== chatId) return false
      if (filter.status && m.status !== filter.status) return false
      if (filter.q) {
        var q = String(filter.q).toLowerCase()
        var hay = [m.title, m.content, (m.keywords || []).join(' ')].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    }).sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0) })
  }

  async function openEditor(memory, page, identity) {
    var isNew = !memory
    var m = memory || {
      title: '', content: '', keywords: [], valence: 0, arousal: 0.3, importance: 5,
      status: 'active', sourceType: 'wechat', sourceAt: Date.now(),
      decayPercent: 80, isLongTerm: false, injectionLayer: 2,
      participants: [], lastRecalledAt: null
    }
    var overlay = document.createElement('div')
    overlay.className = 'sheet-overlay'
    var modal = document.createElement('div')
    modal.className = 'center-modal memory-edit-modal'
    modal.innerHTML = `
      <div class="sheet-title">${isNew ? '新增记忆' : '编辑记忆'}</div>
      <div class="memory-edit-form">
        <input class="input-field" id="mem-edit-title" placeholder="标题" value="${esc(m.title)}">
        <textarea class="input-field" id="mem-edit-content" placeholder="内容，150字以内">${esc(m.content)}</textarea>
        <input class="input-field" id="mem-edit-keywords" placeholder="关键词，用逗号分隔" value="${esc((m.keywords || []).join(','))}">

        <div class="memory-edit-field">
          <span class="mem-pill-label">来源</span>
          <div class="mem-pill-group" id="mem-pills-source">
            ${Object.keys(SOURCE_TYPE_LABEL).map(function(k) {
              return '<span class="mem-pill' + (m.sourceType === k ? ' active' : '') + '" data-val="' + k + '">' + SOURCE_TYPE_LABEL[k] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">注入层级</span>
          <div class="mem-pill-group" id="mem-pills-layer">
            ${[1,2,3,4].map(function(l) {
              return '<span class="mem-pill' + ((m.injectionLayer || 2) === l ? ' active' : '') + '" data-val="' + l + '">' + LAYER_LABEL[l] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">情绪方向</span>
          <div class="mem-pill-group" id="mem-pills-valence">
            ${[['-1','很消极'],['-0.5','消极'],['0','中性'],['0.5','积极'],['1','很积极']].map(function(v) {
              var cur = m.valence || 0
              var isActive = Math.abs(cur - parseFloat(v[0])) < 0.3
              return '<span class="mem-pill' + (isActive ? ' active' : '') + '" data-val="' + v[0] + '">' + v[1] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">情绪强度</span>
          <div class="mem-pill-group" id="mem-pills-arousal">
            ${[['0.1','平静'],['0.3','轻微'],['0.5','中等'],['0.7','强烈'],['0.9','非常强烈']].map(function(v) {
              var cur = m.arousal || 0.3
              var isActive = Math.abs(cur - parseFloat(v[0])) < 0.2
              return '<span class="mem-pill' + (isActive ? ' active' : '') + '" data-val="' + v[0] + '">' + v[1] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">重要程度</span>
          <div class="mem-pill-group" id="mem-pills-importance">
            ${[['2','不重要'],['4','一般'],['6','重要'],['8','非常重要'],['10','至关重要']].map(function(v) {
              var cur = m.importance || 5
              var isActive = Math.abs(cur - parseInt(v[0])) <= 1
              return '<span class="mem-pill' + (isActive ? ' active' : '') + '" data-val="' + v[0] + '">' + v[1] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">衰减起始</span>
          <div class="mem-pill-group" id="mem-pills-decay">
            ${[['80','80%'],['60','60%'],['40','40%'],['20','20%'],['0','0%']].map(function(v) {
              var cur = m.decayPercent != null ? m.decayPercent : 80
              var isActive = Math.abs(cur - parseInt(v[0])) <= 5
              return '<span class="mem-pill' + (isActive ? ' active' : '') + '" data-val="' + v[0] + '">' + v[1] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">状态</span>
          <div class="mem-pill-group" id="mem-pills-status">
            ${['active','sleeping','archived'].map(function(s) {
              return '<span class="mem-pill' + (m.status === s ? ' active' : '') + '" data-val="' + s + '">' + STATUS_LABEL[s] + '</span>'
            }).join('')}
          </div>
        </div>

        <div class="memory-edit-row">
          <div>
            <div class="memory-edit-row-label">长期记忆</div>
            <div class="memory-edit-row-desc">锁定100%，永不衰减</div>
          </div>
          <div class="mem-toggle${m.isLongTerm ? ' on' : ''}" id="mem-edit-longterm-toggle"></div>
        </div>

        <div class="memory-edit-field">
          <span class="mem-pill-label">参与人物</span>
          <div class="memory-participant-list" id="mem-edit-participants"></div>
        </div>
      </div>
      <div class="sheet-actions">
        <button class="btn-pill btn-full" id="mem-edit-save">保存</button>
        <button class="btn-ghost btn-full" id="mem-edit-cancel">取消</button>
      </div>`
    document.getElementById('app').appendChild(overlay)
    document.getElementById('app').appendChild(modal)
    requestAnimationFrame(function() { overlay.classList.add('show'); modal.classList.add('show') })

    // Pill按钮点击事件（单选）
    function bindPillGroup(groupId) {
      var group = modal.querySelector('#' + groupId)
      if (!group) return
      group.addEventListener('click', function(e) {
        var pill = e.target.closest('.mem-pill')
        if (!pill) return
        group.querySelectorAll('.mem-pill').forEach(function(p) { p.classList.remove('active') })
        pill.classList.add('active')
      })
    }
    ;['mem-pills-source','mem-pills-layer','mem-pills-valence','mem-pills-arousal',
      'mem-pills-importance','mem-pills-decay','mem-pills-status'].forEach(bindPillGroup)

    // 开关点击
    var toggleEl = modal.querySelector('#mem-edit-longterm-toggle')
    if (toggleEl) {
      toggleEl.addEventListener('click', function() { toggleEl.classList.toggle('on') })
    }

    // 读取pill选中值
    function getPillVal(groupId, fallback) {
      var active = modal.querySelector('#' + groupId + ' .mem-pill.active')
      return active ? active.dataset.val : fallback
    }

    // 加载参与人物列表
    var participantContainer = modal.querySelector('#mem-edit-participants')
    var selectedParticipants = Array.isArray(m.participants) ? m.participants.map(String) : []
    if (participantContainer && db.characters) {
      db.characters.where('type').equals('char').toArray().then(function(chars) {
        if (!chars.length) { participantContainer.innerHTML = '<span style="font-size:12px;color:var(--c-hint)">暂无角色</span>'; return }
        participantContainer.innerHTML = chars.map(function(c) {
          var checked = selectedParticipants.indexOf(String(c.id)) !== -1 ? 'checked' : ''
          var name = c.nick || c.name || '未知'
          return '<label class="memory-participant-item"><input type="checkbox" class="memory-participant-cb" data-id="' + c.id + '"' + checked + '><span>' + esc(name) + '</span></label>'
        }).join('')
      })
    }

    var close = function() {
      overlay.classList.remove('show'); modal.classList.remove('show')
      setTimeout(function() { overlay.remove(); modal.remove() }, 200)
    }
    overlay.addEventListener('click', close)
    modal.querySelector('#mem-edit-cancel').addEventListener('click', close)
    modal.querySelector('#mem-edit-save').addEventListener('click', async function() {
      var patch = {
        title: modal.querySelector('#mem-edit-title').value.trim().slice(0, 30) || '未命名记忆',
        content: modal.querySelector('#mem-edit-content').value.trim().slice(0, 150),
        keywords: modal.querySelector('#mem-edit-keywords').value.split(/[,，]/).map(function(k) { return k.trim() }).filter(Boolean),
        valence: parseFloat(getPillVal('mem-pills-valence', '0')) || 0,
        arousal: parseFloat(getPillVal('mem-pills-arousal', '0.3')) || 0.3,
        importance: parseInt(getPillVal('mem-pills-importance', '5')) || 5,
        sourceAt: m.sourceAt || Date.now(),
        sourceType: getPillVal('mem-pills-source', 'wechat'),
        status: getPillVal('mem-pills-status', 'active'),
        decayPercent: parseInt(getPillVal('mem-pills-decay', '80')) || 80,
        isLongTerm: toggleEl ? toggleEl.classList.contains('on') : false,
        injectionLayer: parseInt(getPillVal('mem-pills-layer', '2')) || 2,
        participants: (function() {
          var selected = []
          modal.querySelectorAll('.memory-participant-cb:checked').forEach(function(cb) { selected.push(parseInt(cb.dataset.id)) })
          return selected
        })(),
        updatedAt: Date.now()
      }
      if (!patch.content) { window.toast && window.toast('请填写内容'); return }
      if (m.id) {
        await db.memories.update(m.id, patch)
      } else {
        var now = Date.now()
        await db.memories.add(Object.assign({
          ownerUid: identity.ownerUid,
          charId: identity.charId,
          chatId: identity.chatId,
          embedding: null,
          sourceMsgStartId: null,
          sourceMsgEndId: null,
          createdAt: now,
          lastAccessedAt: null,
          accessCount: 0
        }, patch))
      }
      close()
      await renderMemoryPage(page)
    })
  }

  async function buildNameMaps() {
    var chars = await db.characters.toArray()
    var map = {}
    chars.forEach(function(c) { map[c.id] = c })
    return map
  }

  function getUserAccountAtText(user) {
    var account = user && user.identity && user.identity.account
    return account ? '@' + account : '@未设置微信号'
  }

  async function getMemoryUsers(chars, allRows) {
    var users = Object.values(chars).filter(function(c) { return c.type === 'user' })
    var latestByOwner = {}
    allRows.forEach(function(m) {
      if (!m.ownerUid) return
      latestByOwner[m.ownerUid] = Math.max(latestByOwner[m.ownerUid] || 0, m.updatedAt || m.createdAt || 0)
    })
    var enriched = []
    for (var i = 0; i < users.length; i++) {
      var profile = await getMemorySelfProfile(users[i].id)
      enriched.push(Object.assign({}, users[i], {
        _memoryAvatar: profile.avatar || users[i].avatar || '',
        _memoryLatestAt: latestByOwner[users[i].id] || 0,
        _memoryCount: allRows.filter(function(m) { return parseInt(m.ownerUid, 10) === users[i].id }).length
      }))
    }
    return enriched.sort(function(a, b) {
      return (b._memoryLatestAt || 0) - (a._memoryLatestAt || 0) ||
        getCharName(a).localeCompare(getCharName(b), 'zh-CN')
    })
  }

  async function getMemoryRoleItems(ownerUid, chars, ownerRows) {
    var user = chars[ownerUid]
    var profile = await getMemorySelfProfile(ownerUid)
    var selfName = getCharName(user, '我')
    var items = [{
      type: 'self',
      name: 'Memories',
      fallbackName: selfName,
      avatar: profile.avatar || getCharAvatar(user),
      time: ownerRows.reduce(function(max, m) { return Math.max(max, m.updatedAt || m.createdAt || 0) }, 0),
      count: ownerRows.length
    }]
    var latestByChar = {}
    var countByChar = {}
    ownerRows.forEach(function(m) {
      if (!m.charId) return
      latestByChar[m.charId] = Math.max(latestByChar[m.charId] || 0, m.updatedAt || m.createdAt || 0)
      countByChar[m.charId] = (countByChar[m.charId] || 0) + 1
    })
    var chatTimeByChar = {}
    var chats = (await db.chats.toArray()).filter(function(chat) {
      return parseInt(chat.ownerUid, 10) === parseInt(ownerUid, 10)
    })
    for (var c = 0; c < chats.length; c++) {
      var chat = chats[c]
      var lastMsg = await db.messages.where('chatId').equals(chat.id).last()
      if (!lastMsg) continue
      var cid = parseInt(chat.charId, 10)
      if (!cid) continue
      chatTimeByChar[cid] = Math.max(chatTimeByChar[cid] || 0, lastMsg.createdAt || chat.createdAt || 0)
    }
    var charIds = Array.from(new Set(Object.keys(chatTimeByChar).concat(Object.keys(latestByChar))
      .map(function(id) { return parseInt(id, 10) })
      .filter(Boolean)))
    for (var i = 0; i < charIds.length; i++) {
      var base = chars[charIds[i]]
      if (!base || base.type === 'user') continue
      var display = base
      if (window.getWechatDisplayCharacter) {
        try { display = await window.getWechatDisplayCharacter(charIds[i], ownerUid) || base }
        catch (e) { display = base }
      } else if (window.getWechatProfile) {
        try {
          var wxProfile = await window.getWechatProfile(ownerUid, charIds[i])
          display = Object.assign({}, base, {
            wechatName: (wxProfile.remark || '').trim() || base.nick || base.name,
            wechatAvatar: wxProfile.avatar || base.avatar || ''
          })
        } catch (e) {}
      }
      items.push({
        type: 'role',
        charId: charIds[i],
        name: getCharName(display),
        fallbackName: base.nick || base.name || '',
        avatar: getCharAvatar(display),
        time: latestByChar[charIds[i]] || chatTimeByChar[charIds[i]] || 0,
        count: countByChar[charIds[i]] || 0
      })
    }
    return items.sort(function(a, b) {
      if (a.type === 'self') return -1
      if (b.type === 'self') return 1
      return (b.time || 0) - (a.time || 0) || a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  async function renderAccountPicker(page) {
    var chars = await buildNameMaps()
    var allRows = await db.memories.toArray()
    var users = await getMemoryUsers(chars, allRows)
    var memoryApi = window.loadMemoryApiConfig ? await window.loadMemoryApiConfig() : null
    page.querySelector('.header-title').textContent = 'Memories'
    page.querySelector('#memory-content').innerHTML = `
      <div class="memory-account-hero">
        <div class="memory-account-title">选择登录账号</div>
        <div class="memory-account-sub">选择账号查看记忆长廊</div>
      </div>
      <div class="memory-account-list">
        ${users.length ? users.map(buildMemoryAccountHTML).join('') : '<div class="memory-empty">暂无可登录的微信账号</div>'}
      </div>
      <div class="memory-panel memory-api-status-panel">
        <div>
          <div class="memory-panel-title">记忆设置</div>
          <div class="memory-panel-sub">总结 API：${esc(getMemoryApiStatusText(memoryApi))}</div>
        </div>
        <button class="btn-ghost btn-sm" id="btn-memory-api-config-empty" type="button">配置</button>
      </div>`
    page.querySelector('#btn-memory-api-config-empty')?.addEventListener('click', function() {
      openMemoryApiConfigPage(page)
    })
    page.querySelectorAll('.memory-account-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var ownerUid = parseInt(row.dataset.ownerUid, 10)
        page._memoryState = { ownerUid: ownerUid, charId: 0, status: '', q: '' }
        renderMemoryPage(page)
      })
    })
  }

  function buildMemoryAccountHTML(user) {
    var name = getCharName(user, '微信用户')
    var countText = (user._memoryCount || 0) + ' 条记忆'
    var latestText = user._memoryLatestAt ? '最近总结 ' + formatTime(user._memoryLatestAt) : '暂无总结'
    return `
      <button class="memory-account-row" type="button" data-owner-uid="${user.id}">
        ${buildRoundAvatar(user._memoryAvatar, name, 'memory-account-avatar')}
        <span class="memory-account-info">
          <span class="memory-account-name">${esc(name)}</span>
          <span class="memory-account-id">${esc(getUserAccountAtText(user))}</span>
        </span>
        <span class="memory-account-meta">
          <span>${esc(countText)}</span>
          <small>${esc(latestText)}</small>
        </span>
        <i class="fa fa-angle-right"></i>
      </button>`
  }

  function buildMemoryStoryRail(items, activeCharId) {
    return `
      <div class="memory-story-rail" id="memory-story-rail">
        ${items.map(function(item) {
          var isSelf = item.type === 'self'
          var active = isSelf ? !activeCharId : activeCharId === item.charId
          var name = item.name || item.fallbackName || ''
          return `
            <button class="memory-story-item${isSelf ? ' is-self' : ''}${active ? ' active' : ''}" type="button" data-type="${item.type}" data-char-id="${item.charId || ''}">
              <span class="memory-story-avatar-shell">
                ${buildRoundAvatar(item.avatar, item.fallbackName || name, 'memory-story-avatar')}
                ${isSelf ? '<span class="memory-story-add"><i class="fa fa-plus"></i></span>' : ''}
              </span>
              <span class="memory-story-name">${esc(name)}</span>
            </button>`
        }).join('')}
      </div>`
  }

  async function renderMemoryPage(page) {
    if (!page) return
    var state = page._memoryState || {}
    if (!state.ownerUid) return renderAccountPicker(page)
    var chars = await buildNameMaps()
    var rows = await listMemories(state)
    var allRows = await db.memories.toArray()
    var ownerRows = allRows.filter(function(m) { return parseInt(m.ownerUid, 10) === parseInt(state.ownerUid, 10) })
    var statRows = ownerRows.filter(function(m) {
      return !state.charId || parseInt(m.charId, 10) === parseInt(state.charId, 10)
    })
    var roleItems = await getMemoryRoleItems(state.ownerUid, chars, ownerRows)
    var owner = chars[state.ownerUid]
    var status = (await db.config.get('memoryEmbeddingStatus'))?.value || null
    var lastSummary = (await db.config.get('memoryLastSummaryAt'))?.value || ''
    var memoryApi = window.loadMemoryApiConfig ? await window.loadMemoryApiConfig() : null
    var embeddingText = !status ? '未测试' : (status.ok ? '可用' : '不可用')
    var activeRole = state.charId ? chars[state.charId] : null
    var listTitle = activeRole ? getCharName(activeRole) + '的回忆' : '全部回忆'
    var roleSubtitle = (await db.config.get('memoryRoleSubtitle'))?.value || ROLE_SUBTITLE_DEFAULT
    // 加载失败的总结记录
    var failedRuns = await getFailedRuns(state.ownerUid, state.charId)
    var subtitleHtml = activeRole
      ? `<button class="memory-corridor-subtitle memory-role-subtitle" id="btn-memory-role-subtitle" type="button">${esc(roleSubtitle)}</button>`
      : `<div class="memory-corridor-subtitle">${esc(getUserAccountAtText(owner))}</div>`
    page.querySelector('.header-title').textContent = '记忆长廊'
    page.querySelector('#memory-content').innerHTML = `
      ${buildMemoryStoryRail(roleItems, state.charId)}
      <div class="memory-corridor-head">
        <div>
          <div class="memory-corridor-title">${esc(listTitle)}</div>
          ${subtitleHtml}
        </div>
        ${activeRole ? '' : '<button class="btn-ghost btn-sm memory-switch-owner-btn" id="btn-memory-switch-owner">切换账号</button>'}
      </div>
      <div class="memory-overview">
        ${buildMemoryStats(statRows)}
      </div>
      <div class="memory-panel">
        <div class="memory-panel-head">
          <div>
            <div class="memory-panel-title">搜索与状态</div>
            <div class="memory-panel-sub">向量状态：${esc(embeddingText)} · 最近总结：${esc(formatTime(lastSummary))}</div>
          </div>
          <button class="btn-ghost btn-sm" id="btn-memory-test-embedding">测试向量</button>
        </div>
        <div class="memory-filter-grid memory-filter-grid-compact">
          <select class="input-field" id="memory-filter-status">
            <option value="">全部状态</option>
            ${['active','sleeping','archived'].map(function(s) { return `<option value="${s}" ${state.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>` }).join('')}
          </select>
          <input class="input-field" id="memory-filter-q" placeholder="搜索记忆" value="${esc(state.q || '')}">
        </div>
      </div>
      <div class="memory-panel">
        <div class="memory-panel-head">
          <div class="memory-panel-title">记忆列表</div>
          <div class="memory-panel-actions">
            <span class="memory-panel-sub">${rows.length} 条</span>
            ${activeRole ? '<button class="btn-ghost btn-sm" id="btn-memory-add" type="button"><i class="fa fa-plus"></i> 新增记忆</button>' : ''}
          </div>
        </div>
        <div class="memory-list">
          ${rows.length ? rows.map(function(m) { return buildMemoryCard(m, chars) }).join('') : '<div class="memory-empty">暂无记忆</div>'}
        </div>
      </div>
      ${failedRuns.length ? buildFailedRunsSection(failedRuns) : ''}
      <div class="memory-panel memory-api-status-panel">
        <div>
          <div class="memory-panel-title">记忆设置</div>
          <div class="memory-panel-sub">总结 API：${esc(getMemoryApiStatusText(memoryApi))}</div>
          <div class="memory-panel-sub">每个聊天可在聊天设置中单独调整总结阈值和读取数量。</div>
        </div>
        <button class="btn-ghost btn-sm" id="btn-memory-api-config" type="button">配置</button>
      </div>`
    bindPageEvents(page)
  }

  // 构建失败总结区域
  function buildFailedRunsSection(runs) {
    var sourceLabels = { wechat: '微信', x: 'X', sms: '短信', offlineMeet: '线下', moments: '朋友圈' }
    return `
      <div class="memory-panel memory-failed-panel">
        <div class="memory-panel-head">
          <div class="memory-panel-title" style="color:#e88070"><i class="fa-solid fa-triangle-exclamation"></i> 总结失败</div>
          <span class="memory-panel-sub">${runs.length} 条待处理</span>
        </div>
        <div class="memory-failed-list">
          ${runs.map(function(run) {
            var sourceLabel = sourceLabels[run.sourceType] || '未知'
            var timeStr = formatTime(run.createdAt)
            var msgCount = run.messageCount || 0
            return `<div class="memory-failed-card" data-run-id="${run.id}">
              <div class="memory-failed-header">
                <span class="memory-source-badge is-${run.sourceType || 'wechat'}">${esc(sourceLabel)}</span>
                <span class="memory-failed-time">${esc(timeStr)}</span>
                <span class="memory-failed-count">${msgCount} 条消息</span>
              </div>
              <div class="memory-failed-reason">${esc(run.failReason || '未知错误')}</div>
              <div class="memory-failed-actions">
                <button class="btn-ghost btn-sm memory-failed-view-btn" data-run-id="${run.id}"><i class="fa-solid fa-eye"></i> 查看原文</button>
                <button class="btn-ghost btn-sm memory-failed-retry-btn" data-run-id="${run.id}"><i class="fa-solid fa-rotate-right"></i> 重新总结</button>
              </div>
            </div>`
          }).join('')}
        </div>
      </div>`
  }

  function buildMemoryStats(rows) {
    rows = rows || []
    var items = [
      { label: 'TOTAL', value: rows.length },
      { label: 'ACTIVE', value: rows.filter(function(m) { return m.status === 'active' }).length },
      { label: 'SLEEP', value: rows.filter(function(m) { return m.status === 'sleeping' }).length }
    ]
    return items.map(function(item) {
      return `<div class="memory-metric"><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`
    }).join('')
  }

  function buildMemoryCard(m, chars) {
    var owner = chars[m.ownerUid]
    var role = chars[m.charId]
    var decay = getDecayPercent(m)
    var isMeet = m.sourceType ? m.sourceType === 'offlineMeet' : !!m.sourceSessionId
    var sourceLabel = SOURCE_TYPE_LABEL[m.sourceType] || (isMeet ? '见面' : '微信')
    var sourceClass = 'is-' + (m.sourceType || 'wechat')
    var layerLabel = LAYER_LABEL[m.injectionLayer] || '第二层'
    var isLongTerm = !!m.isLongTerm
    // 衰减进度条颜色：绿(>60) → 黄(30-60) → 红(<30)
    var barColor = decay > 60 ? '#70c880' : (decay > 30 ? '#e8c070' : '#e88070')
    var recallText = m.lastRecalledAt ? formatRecallTime(m.lastRecalledAt) : '从未回忆'
    return `
      <div class="memory-card" data-id="${m.id}">
        <div class="memory-card-top">
          <div>
            <div class="memory-title-row">
              <div class="memory-title">${esc(m.title)}</div>
              <span class="memory-source-badge ${sourceClass}">${esc(sourceLabel)}</span>
              <span class="memory-layer-badge">${esc(layerLabel)}</span>
              ${isLongTerm ? '<span class="memory-longterm-badge" title="长期记忆"><i class="fa-solid fa-lock"></i></span>' : ''}
            </div>
            <div class="memory-meta">${esc(owner?.nick || owner?.name || '未知账号')} · ${esc(role?.nick || role?.name || '未知角色')} · ${STATUS_LABEL[m.status] || m.status}</div>
          </div>
        </div>
        <div class="memory-decay-bar">
          <div class="memory-decay-fill" style="width:${decay}%;background:${barColor}"></div>
          <span class="memory-decay-text">${isLongTerm ? '长期100%' : decay + '%'}</span>
        </div>
        <div class="memory-content-text">${esc(m.content)}</div>
        <div class="memory-tags">
          <span>重要度 ${esc(m.importance || 5)}</span>
          <span>发生时间 ${esc(isValidTimestamp(m.sourceAt) ? formatMemoryDateTime(m.sourceAt) : '未知')}</span>
          <span>上次回忆 ${esc(recallText)}</span>
        </div>
        ${(m.keywords && m.keywords.length) ? '<div class="memory-keywords">' + m.keywords.map(function(k) { return '<span class="memory-keyword-tag">' + esc(k) + '</span>' }).join('') + '</div>' : ''}
        <div class="memory-actions">
          <button class="btn-ghost btn-sm" data-action="edit">编辑</button>
          <button class="btn-ghost btn-sm" data-action="recall">回忆</button>
          <button class="btn-ghost btn-sm" data-action="toggle">${m.status === 'archived' ? '恢复' : '归档'}</button>
          <button class="btn-ghost btn-sm btn-text-danger" data-action="delete">删除</button>
        </div>
      </div>`
  }

  function formatRecallTime(ts) {
    if (!ts) return '从未'
    var now = Date.now()
    var diff = now - ts
    if (diff < 600000) return '刚刚想起来' // 10分钟内
    return formatMemoryDateTime(ts) + '想起来'
  }

  function bindPageEvents(page) {
    page.querySelector('#btn-memory-api-config')?.addEventListener('click', function() {
      openMemoryApiConfigPage(page)
    })
    page.querySelector('#btn-memory-switch-owner')?.addEventListener('click', function() {
      page._memoryState = {}
      renderAccountPicker(page)
    })
    page.querySelector('#btn-memory-role-subtitle')?.addEventListener('click', async function() {
      var current = (await db.config.get('memoryRoleSubtitle'))?.value || ROLE_SUBTITLE_DEFAULT
      var next = prompt('修改角色回忆文案', current)
      if (next == null) return
      next = next.trim().slice(0, 30) || ROLE_SUBTITLE_DEFAULT
      await db.config.put({ key: 'memoryRoleSubtitle', value: next })
      await renderMemoryPage(page)
    })
    page.querySelectorAll('.memory-story-item').forEach(function(item) {
      item.addEventListener('click', function() {
        delete page._memoryState.chatId
        if (item.dataset.type === 'self') page._memoryState.charId = 0
        else page._memoryState.charId = parseInt(item.dataset.charId, 10) || 0
        renderMemoryPage(page)
      })
    })
    page.querySelector('#btn-memory-test-embedding')?.addEventListener('click', async function() {
      await testEmbedding()
      await renderMemoryPage(page)
    })
    page.querySelector('#btn-memory-add')?.addEventListener('click', async function() {
      var state = page._memoryState || {}
      if (!state.ownerUid || !state.charId) return
      var chat = await db.chats.where('[ownerUid+charId]').equals([state.ownerUid, state.charId]).first()
      if (!chat) { window.toast && window.toast('未找到对应聊天，无法新增记忆'); return }
      await openEditor(null, page, { ownerUid: state.ownerUid, charId: state.charId, chatId: chat.id })
    })
    ;['status'].forEach(function(k) {
      page.querySelector('#memory-filter-' + k)?.addEventListener('change', function(e) {
        var key = 'status'
        var value = e.target.value
        page._memoryState[key] = value
        renderMemoryPage(page)
      })
    })
    page.querySelector('#memory-filter-q')?.addEventListener('input', function(e) {
      clearTimeout(page._memorySearchTimer)
      page._memorySearchTimer = setTimeout(function() {
        page._memoryState.q = e.target.value.trim()
        renderMemoryPage(page)
      }, 200)
    })
    page.querySelectorAll('.memory-card').forEach(function(card) {
      card.querySelectorAll('[data-action]').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var id = parseInt(card.dataset.id, 10)
          var m = await db.memories.get(id)
          if (!m) return
          var action = btn.dataset.action
          if (action === 'edit') return openEditor(m, page)
          if (action === 'recall') {
            // 回忆：将衰减恢复到80%，更新上次回忆时间
            await db.memories.update(id, { decayPercent: 80, lastRecalledAt: Date.now(), status: m.status === 'sleeping' ? 'active' : m.status, updatedAt: Date.now() })
            window.toast && window.toast('已回忆，记忆恢复到80%')
          }
          if (action === 'toggle') await db.memories.update(id, { status: m.status === 'archived' ? 'active' : 'archived', updatedAt: Date.now() })
          if (action === 'delete') await db.memories.delete(id)
          await renderMemoryPage(page)
        })
      })
    })
    // 失败总结按钮事件
    page.querySelectorAll('.memory-failed-view-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var runId = parseInt(btn.dataset.runId, 10)
        var run = await db.memoryRuns.get(runId)
        if (!run || !run.originalText) { window.toast && window.toast('找不到原始记录'); return }
        showOriginalTextModal(run)
      })
    })
    page.querySelectorAll('.memory-failed-retry-btn').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var runId = parseInt(btn.dataset.runId, 10)
        btn.disabled = true
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 总结中...'
        var result = await retrySummary(runId)
        await renderMemoryPage(page)
      })
    })
  }

  // 显示原文弹窗
  function showOriginalTextModal(run) {
    var sourceLabels = { wechat: '微信聊天', x: 'X软件', sms: '短信', offlineMeet: '线下见面', moments: '朋友圈' }
    var sourceLabel = sourceLabels[run.sourceType] || '未知'
    var overlay = document.createElement('div')
    overlay.className = 'sheet-overlay'
    var modal = document.createElement('div')
    modal.className = 'center-modal memory-original-modal'
    modal.innerHTML = `
      <div class="sheet-title">${esc(sourceLabel)}原文</div>
      <div class="memory-original-info">
        <span>${run.messageCount || 0} 条消息</span>
        <span>${formatTime(run.createdAt)}</span>
        ${run.failReason ? '<span style="color:#e88070">失败原因：' + esc(run.failReason) + '</span>' : ''}
      </div>
      <div class="memory-original-text">${esc(run.originalText || '无原文')}</div>
      <div class="sheet-actions">
        <button class="btn-pill btn-full" id="btn-original-retry"><i class="fa-solid fa-rotate-right"></i> 重新总结</button>
        <button class="btn-ghost btn-full" id="btn-original-close">关闭</button>
      </div>`
    document.getElementById('app').appendChild(overlay)
    document.getElementById('app').appendChild(modal)
    requestAnimationFrame(function() { overlay.classList.add('show'); modal.classList.add('show') })
    var close = function() {
      overlay.classList.remove('show'); modal.classList.remove('show')
      setTimeout(function() { overlay.remove(); modal.remove() }, 200)
    }
    overlay.addEventListener('click', close)
    modal.querySelector('#btn-original-close').addEventListener('click', close)
    modal.querySelector('#btn-original-retry').addEventListener('click', async function() {
      close()
      var result = await retrySummary(run.id)
      var page = document.getElementById('memory-page')
      if (page) await renderMemoryPage(page)
    })
  }

  window.showMemoryPage = function(filter) {
    _launchFilter = filter || _launchFilter || {}
    var page = document.createElement('div')
    page.id = 'memory-page'
    page.className = 'full-page memory-page'
    page._memoryState = Object.assign({}, _launchFilter)
    _launchFilter = null
    page.innerHTML = `
      <div class="page-header">
        <button class="header-back" id="btn-memory-back"><i class="fa fa-angle-left"></i></button>
        <span class="header-title">记忆</span>
      </div>
      <div class="memory-scroll" id="memory-content"><div class="list-loading"><i class="fa fa-spinner fa-spin"></i></div></div>`
    window.openPage(page)
    page.querySelector('#btn-memory-back').addEventListener('click', function() { window.closePage('memory-page') })
    renderMemoryPage(page)
  }

  // 生成记忆面板文本（注入prompt用）
  async function getMemoryPanelContext(chatId, charId, ownerUid) {
    if (!db.memories || !charId) return ''
    try {
      var rows = await db.memories.where('charId').equals(charId).filter(function(m) {
        return m.status !== 'archived' && getDecayPercent(m) > 0
      }).toArray()
      if (!rows.length) return ''

      var now = new Date()
      var today = formatDateStr(now)
      var yesterday = formatDateStr(new Date(now - 86400000))
      var dayBefore = formatDateStr(new Date(now - 172800000))

      // 按日期分组
      var grouped = { before: [], yesterday: [], today: [], future: [] }
      var todayTime = new Date(today).getTime()

      rows.forEach(function(m) {
        var memDate = formatDateStr(new Date(m.sourceAt || m.createdAt))
        if (memDate === today) grouped.today.push(m)
        else if (memDate === yesterday) grouped.yesterday.push(m)
        else if (new Date(memDate).getTime() < todayTime) grouped.before.push(m)
        else grouped.future.push(m)
      })

      // 从config加载记忆面板数据（用户配置的）
      var panelKey = 'memoryPanel_' + charId
      var panelStored = await db.config.get(panelKey)
      var panel = (panelStored && panelStored.value) || {}

      var lines = []
      lines.push('【记忆面板 — 截至' + (now.getMonth() + 1) + '月' + now.getDate() + '日】')
      lines.push('')

      // 前天
      if (grouped.before.length) {
        lines.push('━━ 前天（' + dayBefore + '）━━')
        grouped.before.slice(-5).forEach(function(m) {
          var time = m.sourceAt ? formatTimeShort(m.sourceAt) : ''
          lines.push('• ' + time + ' ' + m.title + '：' + m.content)
        })
        lines.push('')
      }

      // 昨天
      if (grouped.yesterday.length) {
        lines.push('━━ 昨天（' + yesterday + '）━━')
        grouped.yesterday.slice(-5).forEach(function(m) {
          var time = m.sourceAt ? formatTimeShort(m.sourceAt) : ''
          lines.push('• ' + time + ' ' + m.title + '：' + m.content)
        })
        lines.push('')
      }

      // 今天
      if (grouped.today.length) {
        lines.push('━━ 今天（' + today + '）━━')
        grouped.today.slice(-5).forEach(function(m) {
          var time = m.sourceAt ? formatTimeShort(m.sourceAt) : ''
          lines.push('• ' + time + ' ' + m.title + '：' + m.content)
        })
        lines.push('')
      }

      // 将要做的事
      if (grouped.future.length) {
        lines.push('━━ 将要做的事 ━━')
        grouped.future.forEach(function(m) {
          var time = m.sourceAt ? formatTimeShort(m.sourceAt) : ''
          lines.push('• ' + time + ' ' + m.title + '：' + m.content)
        })
        lines.push('')
      }

      // 用户配置的面板数据
      if (panel.health || panel.mood) {
        lines.push('━━ 当前状态 ━━')
        if (panel.health) lines.push('• 身体：' + panel.health)
        if (panel.mood) lines.push('• 情绪：' + panel.mood)
        lines.push('')
      }

      if (panel.belongings && panel.belongings.length) {
        lines.push('━━ 随身物品/信物 ━━')
        panel.belongings.forEach(function(b) {
          var typeLabel = b.type === 'keepsake' ? '信物' : (b.type === 'borrowed' ? '借物' : '日常')
          lines.push('• ' + b.name + (b.source ? '（' + b.source + '）' : '') + ' [' + typeLabel + ']')
        })
        lines.push('')
      }

      if (panel.promises && panel.promises.length) {
        lines.push('━━ 约定 ━━')
        panel.promises.forEach(function(p) {
          var statusLabel = p.status === 'done' ? '已完成' : (p.status === 'pending' ? '待定' : '进行中')
          lines.push('• ' + p.title + (p.date ? '（' + p.date + '）' : '') + ' [' + statusLabel + ']')
        })
        lines.push('')
      }

      if (panel.togetherDate) {
        var startDate = new Date(panel.togetherDate)
        var diffDays = Math.floor((now - startDate) / 86400000)
        lines.push('━━ 在一起天数 ━━')
        lines.push('在一起第 ' + diffDays + ' 天（自' + (startDate.getMonth() + 1) + '月' + startDate.getDate() + '日起）')
        lines.push('')
      }

      return lines.join('\n')
    } catch(e) {
      console.warn('[memory] 生成记忆面板失败:', e)
      return ''
    }
  }

  function formatDateStr(date) {
    var d = new Date(date)
    var y = d.getFullYear()
    var m = String(d.getMonth() + 1).padStart(2, '0')
    var day = String(d.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + day
  }

  function formatTimeShort(ts) {
    if (!ts) return ''
    var d = new Date(Number(ts))
    if (isNaN(d.getTime())) return ''
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }

  // 获取失败的总结记录
  async function getFailedRuns(ownerUid, charId) {
    if (!db.memoryRuns) return []
    var all = await db.memoryRuns.toArray()
    return all.filter(function(r) {
      if (r.status !== 'failed') return false
      if (ownerUid && String(r.ownerUid) !== String(ownerUid)) return false
      if (charId && parseInt(r.charId) !== parseInt(charId)) return false
      return true
    }).sort(function(a, b) { return (b.createdAt || 0) - (a.createdAt || 0) })
  }

  // 重新总结（从失败记录的原文重新调用API）
  async function retrySummary(runId) {
    var run = await db.memoryRuns.get(runId)
    if (!run || !run.originalText) { window.toast && window.toast('找不到原始记录'); return { ok: false } }

    window.toast && window.toast('正在重新总结...')

    var prompt = '请总结以下对话，提取关键记忆信息。\n\n对话内容：\n' + run.originalText + '\n\n' +
      '返回JSON格式：\n' +
      '{"memories":[{"title":"标题(10字以内)","content":"内容(50字以内)","keywords":["关键词"],"importance":5,"valence":0,"arousal":0.3}]}'

    var lastError = null
    var parsed = null
    for (var attempt = 1; attempt <= 2; attempt++) {
      try {
        var callFn = window.callMemoryAI || window.callAI
        if (!callFn) { lastError = 'AI不可用'; break }
        var raw = await callFn([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
        parsed = extractJson(raw)
        if (parsed && Array.isArray(parsed.memories) && parsed.memories.length > 0) break
        lastError = 'AI返回为空或格式错误'
      } catch(e) {
        lastError = e.message || String(e)
      }
    }

    if (!parsed || !Array.isArray(parsed.memories) || parsed.memories.length === 0) {
      // 更新失败记录
      await db.memoryRuns.update(runId, { failReason: lastError || '重新总结仍失败', updatedAt: Date.now() })
      window.toast && window.toast('重新总结失败：' + (lastError || '未知错误'))
      return { ok: false, reason: lastError }
    }

    // 保存成功的记忆
    var rows = []
    for (var i = 0; i < parsed.memories.length; i++) {
      var row = normalizeMemory(parsed.memories[i], {
        ownerUid: run.ownerUid, charId: run.charId, chatId: run.chatId,
        fromMsgId: run.fromMsgId, toMsgId: run.toMsgId,
        sourceAt: run.sourceAt
      })
      if (!row) continue
      row.sourceType = run.sourceType || 'wechat'
      rows.push(row)
    }
    if (rows.length) await db.memories.bulkAdd(rows)

    // 更新原来的失败记录为成功
    await db.memoryRuns.update(runId, { status: 'success', memoryCount: rows.length, failReason: null, updatedAt: Date.now() })

    window.toast && window.toast('重新总结成功，生成 ' + rows.length + ' 条记忆')
    return { ok: true, memoryCount: rows.length }
  }

  window.WanWanMemory = {
    getSettings: getSettings,
    saveSettings: saveSettings,
    summarizeIfNeeded: summarizeIfNeeded,
    summarizeNow: summarizeNow,
    summarizeMeeting: summarizeMeeting,
    getMemoryContext: getMemoryContext,
    getMemoryPanelContext: getMemoryPanelContext,
    listMemories: listMemories,
    testEmbedding: testEmbedding,
    getDecayScore: getDecayScore,
    getDecayPercent: getDecayPercent,
    recallMemory: recallMemory,
    autoRecallMemories: autoRecallMemories,
    getFailedRuns: getFailedRuns,
    retrySummary: retrySummary
  }
})()
