// memory.js — 长期记忆 / 轻量海马体
// 依赖：db.js, settings.js, wechat.js 可选

(function() {
  try {
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
  var SOURCE_TYPE_LABEL = { wechat: '微信', x: 'X', sms: '短信', moments: '朋友圈', offline: '线下', manual: '手动', offlineMeet: '见面', ensemble: '群像' }
  var ROLE_SUBTITLE_DEFAULT = '于是我们建立羁绊'
  var _launchFilter = null

  // --- imprint-memory dual-write helper ---
  var IMPRINT_SOURCE_MAP = { wechat: 'events', x: 'events', sms: 'events', moments: 'events', offline: 'events', manual: 'facts', offlineMeet: 'events', ensemble: 'events' }
  function syncToImprintMemory(memory) {
    try {
      var content = (memory.title || '') + '\n' + (memory.content || '')
      var category = IMPRINT_SOURCE_MAP[memory.sourceType] || 'facts'
      fetch('/api/memory/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: content.trim(),
          category: category,
          source: 'wanwan-' + (memory.sourceType || 'manual'),
          importance: memory.importance || 5
        })
      }).catch(function() {})
    } catch(e) {}
  }


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
    // 使用decayPercent字段
    // Feature 1: 情感坐标 — arousal越高衰减越慢（80%起步，每天-1%）
    if (typeof memory.decayPercent === 'number') {
      var now = Date.now()
      var last = memory.lastRecalledAt || memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now
      var arousal = clamp(memory.arousal, 0, 1, 0.3)
      var decayRate = 1 / (1 + arousal * 2)  // arousal=0→1天/点, arousal=1→0.33天/点
      var days = Math.max(0, (now - last) / 86400000)
      var current = Math.max(0, memory.decayPercent - days * decayRate)
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
  // Feature 1: 情感坐标 — arousal越高衰减越慢
  function getDecayPercent(memory) {
    if (memory.status === 'archived') return 0
    if (memory.isLongTerm) return 100
    if (typeof memory.decayPercent === 'number') {
      var now = Date.now()
      var last = memory.lastRecalledAt || memory.lastAccessedAt || memory.updatedAt || memory.createdAt || now
      var arousal = clamp(memory.arousal, 0, 1, 0.3)
      var decayRate = 1 / (1 + arousal * 2)
      var days = Math.max(0, (now - last) / 86400000)
      return Math.max(0, memory.decayPercent - days * decayRate)
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
      // 搜索该角色的所有记忆（不限chatId）
      var rows = await db.memories.where('charId').equals(charId).filter(function(m) {
        return m.ownerUid === ownerUid && m.status !== 'archived'
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
      var ts = m.createdAt || m.timestamp || m.ts || 0
      var timeStr = ''
      if (ts) {
        var d = new Date(Number(ts))
        if (!isNaN(d.getTime())) {
          var h = d.getHours()
          var period = h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'
          var min = d.getMinutes()
          timeStr = '[' + d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日' + period + h + '点' + (min > 0 ? min + '分' : '') + '] '
        }
      }
      return timeStr + speaker + '：' + String(m.content || '').replace(/\s+/g, ' ').slice(0, 800)
    }).join('\n')
    return `你是一个长期记忆整理器。请根据下面的聊天记录，提取适合长期保存的记忆。每条记录前面有时间戳。

要求：
1. 使用第三人称叙述。
2. 客观平实：只陈述发生了什么、谁表达了什么、双方形成了什么关系信息或偏好信息。
3. 禁止使用强烈情绪词汇，例如"极度愤怒""痛彻心扉""欣喜若狂"等。
4. 不要价值升华，不要写感悟，不要总结人生意义。
5. 禁止加入聊天记录中没有出现的信息。
6. 标题应尽量简短；内容应控制在，适合未来${charName}回复时参考。
7. 【强制】content必须写明时间范围：开始时间到结束时间。格式为"YYYY年M月D日下午X点XX分到下午X点XX分"。例如："2026年9月12日下午3点15分到下午4点30分 用户和${charName}在咖啡店聊天，讨论了周末计划"。绝对不能只写事件不写时间。必须使用聊天记录中的精确时间戳（包含分钟），不能自己编造时间。
8. 【强制】content必须详细描述，至少10-20句话。说清楚谁做了什么、说了什么、怎么发展的、结果是什么。禁止用"任务""事情""活动"等模糊词代替具体内容。例如：不要写"用户完成了任务"，要写"用户花了半小时帮${charName}修改了简历，把工作经历部分重新排版，${charName}看完后觉得很好但希望把自我评价也改一下"。

请返回合法 JSON，不要输出 Markdown，不要输出 JSON 以外的文字。

JSON 格式：
{
  "memories": [
    {
      "title": "简短标题",
      "content": "2026年9月12日下午3点15分到4点30分 用户和${charName}聊天。\n【做的事情】\n1. 下午3点15分 用户提到想吃火锅，${charName}说可以一起去\n2. 下午3点40分 两人讨论了去哪家店，${charName}推荐了海底捞\n3. 下午4点10分 约好周六晚上7点去吃",
      "keywords": ["关键词1", "关键词2"],
      "valence": 0,
      "arousal": 0.3,
      "importance": 5
    }
  ]
}

字段说明：
- title：尽量简短，用于快速识别这条记忆。
- content：第三人称客观陈述，必须包含"YYYY年M月D日上午/中午/下午X点XX分"格式的时间。禁止只有事件没有时间。
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
2. 每条记忆的内容必须按以下6个板块结构化：
   【当前状态】时间、地点、氛围，各角色的状态（情绪、身体等）
   【认知与变动】对话中获得的新认知，关系的变化
   【物品与伏笔】出现的重要物品，对话中暗示的未来事件
   【未完成的悬念】答应但还没做的事，未解决的问题
   【剧情总结】10-20句话，开头必须写明精确时间（年月日几点到几点），然后精确描述每一步发生了什么、谁说了什么、怎么发展的、结果如何。禁止用任务事情活动等模糊词，必须写具体
   【做的事情】用序号列出用户和角色在这次见面中做的每件事，每件事必须有精确时间（带分钟），例如：1. 下午3点15分 用户和角色A一起到了咖啡馆 2. 下午3点30分 角色A点了拿铁 3. 下午4点 两人讨论了周末计划
3. 区分已经发生的事件和尚未完成的计划，不要将计划写成事实。
4. 禁止使用强烈情绪词汇，不要进行文学化描写。
5. 禁止加入见面记录中没有出现的信息。
6. 标题应尽量简短；内容按6板块格式，每板块2-3句话。
7. 【强制】content开头必须写明时间范围："YYYY年M月D日下午X点XX分到下午X点XX分"。例如："2026年9月12日下午3点到下午5点"。

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

  // 检查记忆内容是否包含时间引用
  function hasTimeReference(text) {
    if (!text) return false
    // 匹配：X点、X时、上午/下午/晚上/中午/凌晨/深夜 + 时间、YYYY年、X月X日
    return /\d+[点时分秒]|上午|下午|晚上|中午|凌晨|深夜|\d{4}年|\d+月\d+[日号]/.test(text)
  }

  function normalizeMemory(raw, meta) {
    var title = String(raw?.title || '').trim().slice(0, 30) || '未命名记忆'
    var content = String(raw?.content || '').trim()
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
      sourceStartTime: isValidTimestamp(meta.sourceStartTime) ? Number(meta.sourceStartTime) : null,
      sourceEndTime: isValidTimestamp(meta.sourceEndTime) ? Number(meta.sourceEndTime) : null,
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
    var sourceStartTime = isValidTimestamp(fresh[0].createdAt) ? Number(fresh[0].createdAt) : null

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
        var raw = await window.callMemoryAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', temperature: await window.getAITemperaturePreset('summaryMode'),  })
        parsed = extractJson(raw)
        if (parsed && Array.isArray(parsed.memories) && parsed.memories.length > 0) {
          // 校验每条记忆是否有时间引用
          var allHaveTime = parsed.memories.every(function(m) { return hasTimeReference(m.content || '') })
          if (allHaveTime) break
          // 如果有记忆没有时间，让AI重写（只重试一次）
          if (attempt === 1) {
            console.warn('[memory] 部分记忆缺少时间引用，重试...')
            lastError = '记忆内容缺少时间'
            continue
          }
          // 第二次就算了，接受结果
          break
        }
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
        sourceAt: sourceAt,
        sourceStartTime: sourceStartTime,
        sourceEndTime: sourceAt
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
        var raw = await window.callMemoryAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', temperature: await window.getAITemperaturePreset('summaryMode'),  })
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
    // 搜索该角色的所有记忆（不限chatId），让记忆跨聊天联通
    var rows = await db.memories.where('charId').equals(charId).filter(function(m) {
      return m.ownerUid === ownerUid && m.status !== 'archived'
    }).toArray()
    if (!rows.length) return ''
    var queryText = (recentMessages || []).map(function(m) { return m.content || '' }).join(' ')
    var queryEmbedding = null
    if (settings.embeddingEnabled && rows.some(function(m) { return Array.isArray(m.embedding) })) {
      try { queryEmbedding = await createEmbedding(queryText || '当前聊天') }
      catch (e) { console.warn('[memory] 查询向量失败，降级检索：', e) }
    }
    // Feature 2: 浮现机制 — relevance(0.4) + recency(0.3) + importance(0.2) + emotion(0.1)
    var scored = rows.map(function(m) {
      var semanticScore = queryEmbedding ? Math.max(0, cosineSimilarity(queryEmbedding, m.embedding)) : 0
      var keywordScore = getKeywordScore(m, queryText)
      var relevance = Math.min(1, semanticScore * 0.5 + keywordScore)
      var decayPercent = getDecayPercent(m)
      var recency = Math.min(1, decayPercent / 100)
      var importanceScore = clamp(m.importance, 1, 10, 5) / 10
      var emotionScore = getEmotionScore(m)
      var compositeScore = relevance * 0.4 + recency * 0.3 + importanceScore * 0.2 + emotionScore * 0.1
      return {
        memory: m,
        score: compositeScore
      }
    }).sort(function(a, b) { return b.score - a.score })
    // 返回 top 5-8 条
    var surfacelimit = Math.max(5, Math.min(8, settings.injectLimit))
    var selected = scored.slice(0, surfacelimit).filter(function(x) { return x.score > 0.05 || x.memory.status === 'active' })
    var now = Date.now()
    await Promise.all(selected.map(function(x) {
      return db.memories.update(x.memory.id, {
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
      // 使用起止时间段
      var startTime = m.sourceStartTime || null
      var endTime = m.sourceEndTime || m.sourceAt || memoryTime
      var timeStr = ''
      if (startTime && endTime && startTime !== endTime) {
        timeStr = formatTimePeriod(startTime) + ' 到 ' + formatTimePeriod(endTime)
      } else if (endTime) {
        timeStr = formatTimePeriod(endTime)
      } else {
        timeStr = '未知时间'
      }
      var relativeStr = memoryTime ? '（' + formatRelativeTime(memoryTime) + '）' : ''
      var layerTag = '【' + (LAYER_LABEL[m.injectionLayer] || '第二层') + '】'
      var keywordsTag = (m.keywords && m.keywords.length) ? ' 关键词：' + m.keywords.join('、') : ''
      return `${i + 1}. ${layerTag}【${sourceLabel}｜${timeStr}${relativeStr}】${m.title}：${m.content}${keywordsTag}`
    }).join('\n')

    // 追加回忆指引
    result += '\n\n【回忆指引】当你在聊天中发现用户提到的内容与上面某条记忆相关时，在回复开头自然地提及，例如：刚刚想起来了，之前（时间段）你说过/做过... 这样用户知道你记得。'

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

    // 追加结构化事件日志（时间100%准确）
    var eventCtx = getStructuredEventContext(charId)
    if (eventCtx) result += eventCtx

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
  // 时间段格式：2026年9月12日下午3:14
  function formatTimePeriod(ts) {
    if (!isValidTimestamp(ts)) return '未知时间'
    var d = new Date(Number(ts))
    if (isNaN(d.getTime())) return '未知时间'
    var h = d.getHours()
    var period = h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'
    var min = d.getMinutes()
    return d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日' + period + h + ':' + (min < 10 ? '0' : '') + min
  }

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
        <textarea class="input-field" id="mem-edit-content" placeholder="内容，">${esc(m.content)}</textarea>
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
        syncToImprintMemory(Object.assign({ createdAt: now }, patch))
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
    var sourceLabels = { wechat: '微信', x: 'X', sms: '短信', offlineMeet: '线下', ensemble: '群像', moments: '朋友圈' }
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
        <div class="memory-source-actions">
          <button class="memory-link-btn" data-action="viewOriginal"><i class="fa-solid fa-file-lines"></i> 查看原文</button>
          <button class="memory-link-btn" data-action="resummarize"><i class="fa-solid fa-rotate-right"></i> 重新总结</button>
        </div>
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
          if (action === 'viewOriginal') {
            // 精确匹配：用记忆的sourceMsgStartId/sourceMsgEndId匹配memoryRuns的fromMsgId/toMsgId
            var allRuns = await db.memoryRuns.toArray()
            var matchingRun = allRuns.find(function(r) {
              if (!r.originalText) return false
              // 精确匹配：记忆的sourceMsg在run的范围内
              if (m.sourceMsgStartId && r.fromMsgId && r.toMsgId) {
                return m.sourceMsgStartId >= r.fromMsgId && m.sourceMsgEndId <= r.toMsgId
              }
              // 退而求其次：chatId匹配
              return String(r.chatId) === String(m.chatId || '')
            })
            if (matchingRun && matchingRun.originalText) { showOriginalTextModal(matchingRun) }
            else { window.toast && window.toast('暂无原始记录') }
            return
          }
          if (action === 'resummarize') {
            // 精确匹配：找对应原始总结记录
            var allRuns2 = await db.memoryRuns.toArray()
            var run2 = allRuns2.find(function(r) {
              if (!r.originalText) return false
              if (m.sourceMsgStartId && r.fromMsgId && r.toMsgId) {
                return m.sourceMsgStartId >= r.fromMsgId && m.sourceMsgEndId <= r.toMsgId
              }
              return String(r.chatId) === String(m.chatId || '')
            })
            if (!run2) { window.toast && window.toast('暂无原始记录，无法重新总结'); return }
            // 允许重新总结成功记忆
            btn.disabled = true
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'
            try {
              await retrySummary(run2.id, m.id)
              window.toast && window.toast('重新总结成功')
              await renderMemoryPage(page)
            } catch(e) { window.toast && window.toast('重新总结失败'); btn.disabled = false; btn.textContent = '重新总结' }
            return
          }
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
    var sourceLabels = { wechat: '微信聊天', x: 'X软件', sms: '短信', offlineMeet: '线下见面', ensemble: '群像', moments: '朋友圈' }
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

  // 重新总结单条记忆（覆盖原内容）
  async function resummarizeMemory(memoryId) {
    var m = await db.memories.get(memoryId)
    if (!m) { window.toast && window.toast('\u8bb0\u5fc6\u4e0d\u5b58\u5728'); return { ok: false } }

    var allRuns = await db.memoryRuns.toArray()
    var matchingRun = allRuns.find(function(r) {
      if (!r.originalText) return false
      if (m.sourceMsgStartId && r.fromMsgId && r.toMsgId) {
        return m.sourceMsgStartId >= r.fromMsgId && m.sourceMsgEndId <= r.toMsgId
      }
      return String(r.chatId) === String(m.chatId || '')
    })
    if (!matchingRun || !matchingRun.originalText) { window.toast && window.toast('\u627e\u4e0d\u5230\u539f\u59cb\u8bb0\u5f55'); return { ok: false } }

    window.toast && window.toast('\u6b63\u5728\u91cd\u65b0\u603b\u7ed3...')

    var isOffline = m.sourceType === 'offlineMeet'
    var prompt = ''
    if (isOffline) {
      prompt = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u7ebf\u4e0b\u89c1\u9762\u8bb0\u5f55\uff0c\u63d0\u53d61\u6761\u8bb0\u5fc6\u3002\n\n' +
        '\u89c1\u9762\u5185\u5bb9\uff1a\n' + matchingRun.originalText.slice(0, 3000) + '\n\n' +
        '\u8981\u6c42\uff1a\n' +
        '1. \u4f7f\u7528\u7b2c\u4e09\u4eba\u79f0\u53d9\u8ff0\u3002\n' +
        '2. \u5185\u5bb9\u5fc5\u987b\u6309\u4ee5\u4e0b5\u4e2a\u677f\u5757\u7ed3\u6784\u5316\uff1a\n' +
        '   \u3010\u5f53\u524d\u72b6\u6001\u3011\u65f6\u95f4\u3001\u5730\u70b9\u3001\u6c1b\u56f4\uff0c\u5404\u89d2\u8272\u7684\u72b6\u6001\n' +
        '   \u3010\u8ba4\u77e5\u4e0e\u53d8\u52a8\u3011\u5bf9\u8bdd\u4e2d\u83b7\u5f97\u7684\u65b0\u8ba4\u77e5\uff0c\u5173\u7cfb\u7684\u53d8\u5316\n' +
        '   \u3010\u7269\u54c1\u4e0e\u4f0f\u7b14\u3011\u91cd\u8981\u7269\u54c1\uff0c\u6697\u793a\u7684\u672a\u6765\u4e8b\u4ef6\n' +
        '   \u3010\u672a\u5b8c\u6210\u7684\u60ac\u5ff5\u3011\u7b54\u5e94\u4f46\u8fd8\u6ca1\u505a\u7684\u4e8b\uff0c\u672a\u89e3\u51b3\u7684\u95ee\u9898\n' +
        '   \u3010\u5267\u60c5\u603b\u7ed3\u30113-5\u53e5\u8bdd\u6982\u62ec\u6838\u5fc3\u4e8b\u4ef6\u548c\u60c5\u611f\u53d8\u5316\n' +
        '3. \u7981\u6b62\u4f7f\u7528\u5f3a\u70c8\u60c5\u7eea\u8bcd\u6c47\u3002\n' +
        '4. \u6807\u9898\u5c3d\u91cf\u7b80\u77ed\uff1b\u5185\u5bb9\u63095\u677f\u5757\u683c\u5f0f\uff0c\u6bcf\u677f\u57572-3\u53e5\u8bdd\u3002\n\n' +
        '\u8fd4\u56deJSON\u683c\u5f0f\uff1a\n' +
        '{"memories":[{"title":"\u6807\u9898","content":"\u3010\u5f53\u524d\u72b6\u6001\u3011...\u3010\u8ba4\u77e5\u4e0e\u53d8\u52a8\u3011...\u3010\u7269\u54c1\u4e0e\u4f0f\u7b14\u3011...\u3010\u672a\u5b8c\u6210\u7684\u60ac\u5ff5\u3011...\u3010\u5267\u60c5\u603b\u7ed3\u3011...","keywords":["\u5173\u952e\u8bcd"],"importance":7,"valence":0.5,"arousal":0.4}]}'
    } else {
prompt = '\u8bf7\u6839\u636e\u4ee5\u4e0b\u804a\u5929\u8bb0\u5f55\uff0c\u63d0\u53d61\u6761\u8bb0\u5fc6\u3002\u6bcf\u6761\u804a\u5929\u8bb0\u5f55\u524d\u9762\u6709\u65f6\u95f4\u6233\u3002\n\n' +
        '\u804a\u5929\u5185\u5bb9\uff1a\n' + matchingRun.originalText.slice(0, 3000) + '\n\n' +
        '\u8981\u6c42\uff1a\n' +
        '1. \u4f7f\u7528\u7b2c\u4e09\u4eba\u79f0\u53d9\u8ff0\u3002\n' +
        '2. content\u91cc\u5fc5\u987b\u5199\u660e\u65f6\u95f4\uff0c\u683c\u5f0f\u4e3a\"YYYY\u5e74M\u6708D\u65e5\u4e0b\u5348X\u70b9\u505a\u4e86\u4ec0\u4e48\"\u3002\u4f8b\u5982\uff1a\"2026\u5e749\u670812\u65e5\u4e0b\u53483\u70b9 \u7528\u6237\u8bf4\u60f3\u53bb\u5496\u5561\u5e97\"\u3002\n' +
        '3. \u7edd\u5bf9\u4e0d\u80fd\u53ea\u5199\u4e8b\u4ef6\u4e0d\u5199\u65f6\u95f4\u3002\n\n' +
        '\u8fd4\u56deJSON\u683c\u5f0f\uff1a\n' +
        '{"memories":[{"title":"\u6807\u9898","content":"2026\u5e749\u670812\u65e5\u4e0b\u53483\u70b9 \u7528\u6237\u63d0\u5230...","keywords":["\u5173\u952e\u8bcd"],"importance":5,"valence":0,"arousal":0.3}]}'
    }

    var parsed = null
    try {
      var callFn = window.callMemoryAI || window.callAI
      var raw = await callFn([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
      parsed = extractJson(raw)
    } catch(e) { window.toast && window.toast('\u91cd\u65b0\u603b\u7ed3\u5931\u8d25'); return { ok: false } }

    if (!parsed || !Array.isArray(parsed.memories) || !parsed.memories.length) {
      window.toast && window.toast('\u91cd\u65b0\u603b\u7ed3\u5931\u8d25')
      return { ok: false }
    }

    var newMem = parsed.memories[0]
    await db.memories.update(memoryId, {
      title: newMem.title || m.title,
      content: newMem.content || m.content,
      keywords: newMem.keywords || m.keywords,
      importance: newMem.importance || m.importance,
      updatedAt: Date.now()
    })
    window.toast && window.toast('\u91cd\u65b0\u603b\u7ed3\u6210\u529f')
    return { ok: true }
  }  // 重新总结（从失败记录的原文重新调用API）
  async function retrySummary(runId, overwriteMemoryId) {
    var run = await db.memoryRuns.get(runId)
    if (!run || !run.originalText) { window.toast && window.toast('找不到原始记录'); return { ok: false } }

    window.toast && window.toast('正在重新总结...')

    var isOffline = run.sourceType === 'offlineMeet'
    var prompt
    if (isOffline) {
      prompt = '你是一个线下见面记忆整理器。请根据见面记录，提取1条记忆。\n\n' +
        '内容必须按6板块结构化：\n' +
        '【当前状态】时间、地点、氛围、各角色状态\n' +
        '【认知与变动】新认知、关系变化\n' +
        '【物品与伏笔】重要物品、暗示的未来事件\n' +
        '【未完成的悬念】未完成的承诺、未解决的问题\n' +
        '【剧情总结】10-20句话，开头必须写明精确时间（年月日几点到几点），然后精确描述每一步发生了什么、谁说了什么、怎么发展的、结果如何。禁止用任务事情活动等模糊词\n' +
        '【做的事情】用序号列出每件事，每件必须有精确时间（带分钟）\n' +
        '禁止强烈情绪词汇。只生成1条记忆。\n\n' +
        '见面记录：\n' + run.originalText + '\n\n' +
        '返回JSON：{"memories":[{"title":"标题","content":"【当前状态】...\n【认知与变动】...\n【物品与伏笔】...\n【未完成的悬念】...\n【剧情总结】...","keywords":["关键词"],"importance":5,"valence":0,"arousal":0.3}]}'
    } else {
      prompt = '请总结以下对话，提取关键记忆信息。\n\n对话内容：\n' + run.originalText + '\n\n' +
        '返回JSON格式：\n' +
        '{"memories":[{"title":"标题","content":"内容","keywords":["关键词"],"importance":5,"valence":0,"arousal":0.3}]}'
    }

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
    var newMem = parsed.memories[0]
    var row = normalizeMemory(newMem, {
      ownerUid: run.ownerUid, charId: run.charId, chatId: run.chatId,
      fromMsgId: run.fromMsgId, toMsgId: run.toMsgId, sourceAt: run.sourceAt
    })
    if (!row) { window.toast && window.toast('总结内容为空'); return { ok: false } }
    row.sourceType = run.sourceType || 'wechat'
    if (overwriteMemoryId) {
      await db.memories.update(overwriteMemoryId, {
        title: row.title, content: row.content, keywords: row.keywords,
        importance: row.importance, valence: row.valence, arousal: row.arousal,
        updatedAt: Date.now()
      })
    } else {
      await db.memories.add(row)
      syncToImprintMemory(row)
    }
    await db.memoryRuns.update(runId, { status: 'success', memoryCount: 1, failReason: null, updatedAt: Date.now() })
    window.toast && window.toast('重新总结成功')
    return { ok: true, memoryCount: 1 }
  }

  // ===== 结构化事件日志（双层记忆第一层）=====
  // 时间100%准确，系统自动记录，不依赖AI回忆
  var EVENT_LOG_KEY = 'memoryEventLog_'

  function logStructuredEvent(charId, eventData) {
    if (!charId || !eventData || !eventData.event) return
    var key = EVENT_LOG_KEY + charId
    var events = []
    try { events = JSON.parse(localStorage.getItem(key) || '[]') } catch(e) {}
    var now = Date.now()
    var d = new Date(now)
    var h = d.getHours()
    var period = h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'
    events.push({
      timestamp: now,
      timeStr: d.getFullYear() + '年' + (d.getMonth()+1) + '月' + d.getDate() + '日' + period + h + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(),
      event: String(eventData.event).slice(0, 200),
      location: eventData.location || '',
      participants: eventData.participants || [],
      source: eventData.source || 'chat'
    })
    // 只保留最近200条
    if (events.length > 200) events = events.slice(-200)
    try { localStorage.setItem(key, JSON.stringify(events)) } catch(e) {}
  }

  function getStructuredEvents(charId, limit) {
    if (!charId) return []
    var key = EVENT_LOG_KEY + charId
    try {
      var events = JSON.parse(localStorage.getItem(key) || '[]')
      return events.slice(-(limit || 50))
    } catch(e) { return [] }
  }

  function getStructuredEventContext(charId) {
    var events = getStructuredEvents(charId, 20)
    if (!events.length) return ''
    return '\n\n【近期事件日志（系统自动记录，时间精确）】\n' + events.map(function(e) {
      return e.timeStr + ' ' + e.event + (e.location ? '，在' + e.location : '')
    }).join('\n')
  }

  // 事件检测：从用户消息中自动提取事件
  var EVENT_PATTERNS = [
    /(?:我|我们|刚|刚才|刚刚|昨天|前天|今天|上周|这周).{0,5}(?:去了|到了|去了|在|吃了|买了|看了|做了|玩了|学了|写了|画了|唱了|跑了|跳了|打了|修了|搬了|去了|回来了|出发了|到达了|开始了|结束了|完成了|考了|试了|面试了|见了|遇到|碰到了|约了|订了|预约了|下载了|安装了|更新了|升级了|注册了|登录了)/,
    /(?:下午|上午|晚上|中午|凌晨|深夜|早上).{0,20}(?:去|到|在|吃|买|看|做|玩|学|写|画|唱|跑|跳|打|修|搬)/
  ]

  function detectAndLogEvent(charId, userMessage, aiName) {
    if (!charId || !userMessage) return
    var msg = String(userMessage).trim()
    // 检查是否匹配事件模式
    var isEvent = EVENT_PATTERNS.some(function(p) { return p.test(msg) })
    if (!isEvent) return
    // 提取事件描述（取前100字）
    var eventDesc = msg.slice(0, 100)
    logStructuredEvent(charId, {
      event: eventDesc,
      source: 'chat',
      participants: [aiName || 'AI']
    })
  }

  
  // ===== Feature 3: 自动提取事实 (Auto Fact Extraction) =====
  var _extractFactsCallCount = {}

  async function extractFacts(messages, charName, userName) {
    if (!messages || !messages.length) return []
    if (!window.callMemoryAI && !window.callAI) return []
    charName = charName || '角色'
    userName = userName || '用户'
    var recentMsgs = messages.slice(-10).map(function(m) {
      var speaker = m.role === 'assistant' ? charName : userName
      return speaker + '：' + String(m.content || '').slice(0, 200)
    }).join('\n')
    var prompt = '从以下聊天中提取关键事实信息。只提取用户明确提到的事实，不要推测。\n\n' +
      '聊天内容：\n' + recentMsgs + '\n\n' +
      '提取这5类信息：\n' +
      '1. 人物：提到的人物名字和关系\n' +
      '2. 事件：发生或计划的事情\n' +
      '3. 时间：具体时间点或时间段\n' +
      '4. 地点：提到的地点\n' +
      '5. 偏好：用户的喜欢/不喜欢、习惯变化\n\n' +
      '返回JSON：{"facts":[{"type":"person|event|time|location|preference","content":"...","importance":1-10}]}\n' +
      '如果没有发现事实，返回 {"facts":[]}'
    try {
      var callFn = window.callMemoryAI || window.callAI
      var raw = await callFn([{ role: 'user', content: prompt }], { responseFormat: 'json_object' })
      var parsed = extractJson(raw)
      if (!parsed || !Array.isArray(parsed.facts) || !parsed.facts.length) return []
      var facts = parsed.facts.filter(function(f) {
        return f && f.content && (f.importance || 5) >= 4
      })
      return facts
    } catch(e) {
      console.warn('[memory] extractFacts error:', e)
      return []
    }
  }

  async function autoExtractAndStore(chatId, charId, ownerUid, messages, charName, userName) {
    if (!chatId || !charId || !ownerUid) return
    if (!db.memories) return
    var callKey = chatId + '_' + charId
    var count = (_extractFactsCallCount[callKey] || 0) + 1
    _extractFactsCallCount[callKey] = count
    if (count % 10 !== 0) return
    var facts = await extractFacts(messages, charName, userName)
    if (!facts.length) return
    var now = Date.now()
    for (var i = 0; i < facts.length; i++) {
      var f = facts[i]
      var row = {
        ownerUid: ownerUid, charId: charId, chatId: chatId,
        title: '[' + (f.type || '事实') + '] ' + String(f.content || '').slice(0, 20),
        content: f.content, keywords: [f.type || '事实'],
        valence: 0, arousal: 0.2, importance: clamp(f.importance, 1, 10, 5),
        embedding: null, status: 'active', sourceType: 'auto_extract',
        sourceMsgStartId: null, sourceMsgEndId: null, sourceAt: now,
        decayPercent: 80, isLongTerm: false, injectionLayer: 3,
        participants: [], lastRecalledAt: null,
        createdAt: now, updatedAt: now, lastAccessedAt: null, accessCount: 0
      }
      await db.memories.add(row)
      syncToImprintMemory(row)
    }
    console.log('[memory] autoExtracted ' + facts.length + ' facts for charId=' + charId)
  }

  
  // ===== Feature 4: 时间感知 (Time Awareness) =====
  function getFormattedNow() {
    var now = new Date()
    var y = now.getFullYear()
    var m = now.getMonth() + 1
    var d = now.getDate()
    var h = now.getHours()
    var min = now.getMinutes()
    var period = h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜'
    var hour12 = h === 0 ? 12 : (h > 12 ? h - 12 : h)
    return y + '\u5e74' + m + '\u6708' + d + '\u65e5' + period + hour12 + '\u70b9' + (min > 0 ? min + '\u5206' : '')
  }

  async function getTimeSinceLastChat(charId) {
    if (!charId || !db.chats) return ''
    try {
      var allChats = await db.chats.toArray()
      var charChats = allChats.filter(function(c) { return c.charId === charId })
      if (!charChats.length) return ''
      var lastChat = charChats.sort(function(a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0) })[0]
      if (!lastChat || !lastChat.updatedAt) return ''
      var diff = Date.now() - lastChat.updatedAt
      if (diff < 60000) return '\u521a\u521a'
      var mins = Math.floor(diff / 60000)
      if (mins < 60) return mins + '\u5206\u949f\u524d'
      var hours = Math.floor(mins / 60)
      if (hours < 24) return hours + '\u5c0f\u65f6\u524d'
      var days = Math.floor(hours / 24)
      if (days < 30) return days + '\u5929\u524d'
      return Math.floor(days / 30) + '\u4e2a\u6708\u524d'
    } catch(e) { return '' }
  }

  async function buildTimeAwarenessContext(charId) {
    var parts = []
    parts.push('\u73b0\u5728\u662f' + getFormattedNow())
    if (charId) {
      var timeSince = await getTimeSinceLastChat(charId)
      if (timeSince) parts.push('\u4e0a\u6b21\u804a\u5929\u662f' + timeSince + '\u524d')
    }
    return parts.join('\uff0c')
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
    retrySummary: retrySummary,
    logStructuredEvent: logStructuredEvent,
    getStructuredEvents: getStructuredEvents,
    getStructuredEventContext: getStructuredEventContext,
    detectAndLogEvent: detectAndLogEvent,
    extractFacts: extractFacts,
    autoExtractAndStore: autoExtractAndStore,
    getFormattedNow: getFormattedNow,
    getTimeSinceLastChat: getTimeSinceLastChat,
    buildTimeAwarenessContext: buildTimeAwarenessContext,
    saveConversationProgress: saveConversationProgress,
    getConversationProgress: getConversationProgress,
    getConversationProgressContext: getConversationProgressContext,
    dreamConsolidate: dreamConsolidate,
    detectEmotion: detectEmotion,
    resolveConflict: resolveConflict
  }
  } catch(e) { console.error('[Memory] IIFE error:', e); }
})()
