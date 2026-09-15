// tarot-page.js — 星轨塔罗 Mobile Tarot Reading (self-contained, no iframe)
;(function() {
  'use strict'

  // ===================================================================
  // TAROT DATA — 78 cards
  // ===================================================================
  var MAJOR = [
    { id:'M00', num:'0',  cn:'愚者',     en:'The Fool',          up:'新的开始 / 纯真 / 冒险', rev:'鲁莽 / 欠考虑 / 恐惧改变' },
    { id:'M01', num:'I',  cn:'魔术师',   en:'The Magician',      up:'显化 / 意志 / 资源在握', rev:'操纵 / 才能误用 / 意志涣散' },
    { id:'M02', num:'II', cn:'女祭司',   en:'The High Priestess', up:'直觉 / 潜意识 / 内在智慧', rev:'忽视直觉 / 隐秘泄露' },
    { id:'M03', num:'III',cn:'皇后',     en:'The Empress',       up:'丰盛 / 滋养 / 感官之美', rev:'依赖 / 过度保护 / 创造阻塞' },
    { id:'M04', num:'IV', cn:'皇帝',     en:'The Emperor',       up:'秩序 / 权威 / 稳固 / 守护', rev:'僵化 / 控制欲 / 滥用权力' },
    { id:'M05', num:'V',  cn:'教皇',     en:'The Hierophant',    up:'传统 / 信仰 / 导师 / 教育', rev:'教条 / 叛逆 / 挑战权威' },
    { id:'M06', num:'VI', cn:'恋人',     en:'The Lovers',        up:'选择 / 关系 / 价值观 / 和谐', rev:'不协调 / 错误选择 / 价值观冲突' },
    { id:'M07', num:'VII',cn:'战车',     en:'The Chariot',       up:'胜利 / 意志 / 决心 / 前进', rev:'失控 / 方向迷失 / 挫败' },
    { id:'M08', num:'VIII',cn:'力量',    en:'Strength',          up:'内在力量 / 勇气 / 耐心 / 慈悲', rev:'自我怀疑 / 软弱 / 恐惧' },
    { id:'M09', num:'IX', cn:'隐士',     en:'The Hermit',        up:'内省 / 孤独 / 智慧 / 指引', rev:'孤僻 / 逃避 / 固执' },
    { id:'M10', num:'X',  cn:'命运之轮', en:'Wheel of Fortune',  up:'转变 / 命运 / 机遇 / 周期', rev:'抵抗改变 / 坏运气 / 停滞' },
    { id:'M11', num:'XI', cn:'正义',     en:'Justice',           up:'公平 / 真相 / 因果 / 责任', rev:'不公正 / 逃避责任 / 偏见' },
    { id:'M12', num:'XII',cn:'倒吊人',   en:'The Hanged Man',    up:'牺牲 / 新视角 / 等待 / 放下', rev:'拖延 / 抗拒 / 无谓牺牲' },
    { id:'M13', num:'XIII',cn:'死神',    en:'Death',             up:'结束 / 转变 / 重生 / 释放', rev:'抵抗改变 / 恐惧结束 / 停滞' },
    { id:'M14', num:'XIV',cn:'节制',     en:'Temperance',        up:'平衡 / 耐心 / 调和 / 中庸', rev:'极端 / 失衡 / 过度' },
    { id:'M15', num:'XV', cn:'恶魔',     en:'The Devil',         up:'束缚 / 欲望 / 物质主义 / 阴影', rev:'解脱 / 觉醒 / 打破束缚' },
    { id:'M16', num:'XVI',cn:'塔',       en:'The Tower',         up:'突变 / 崩塌 / 启示 / 重建', rev:'恐惧改变 / 逃避灾难' },
    { id:'M17', num:'XVII',cn:'星星',    en:'The Star',          up:'希望 / 灵感 / 宁静 / 治愈', rev:'绝望 / 失去信心 / 断连' },
    { id:'M18', num:'XVIII',cn:'月亮',   en:'The Moon',          up:'幻象 / 恐惧 / 潜意识 / 直觉', rev:'释放恐惧 / 真相浮现' },
    { id:'M19', num:'XIX',cn:'太阳',     en:'The Sun',           up:'快乐 / 成功 / 活力 / 真相', rev:'暂时的困难 / 延迟满足' },
    { id:'M20', num:'XX', cn:'审判',     en:'Judgement',         up:'觉醒 / 重生 / 召唤 / 反思', rev:'自我怀疑 / 逃避召唤' },
    { id:'M21', num:'XXI',cn:'世界',     en:'The World',         up:'完成 / 整合 / 成就 / 圆满', rev:'未完成 / 缺乏收尾' }
  ]

  var SUITS = [
    { suit:'权杖', symbol:'\u2660', element:'火', theme:'意志 / 行动 / 创造' },
    { suit:'圣杯', symbol:'\u2665', element:'水', theme:'情感 / 关系 / 直觉' },
    { suit:'宝剑', symbol:'\u2666', element:'风', theme:'思维 / 真相 / 冲突' },
    { suit:'星币', symbol:'\u2663', element:'土', theme:'物质 / 身体 / 资源' }
  ]

  var NUMBERS = ['Ace','2','3','4','5','6','7','8','9','10']
  var NUM_CN  = ['A','二','三','四','五','六','七','八','九','十']
  var COURTS  = [
    { name:'侍从', en:'Page',  kw:'好奇 / 学习 / 消息' },
    { name:'骑士', en:'Knight',kw:'行动 / 冲劲 / 追求' },
    { name:'王后', en:'Queen', kw:'滋养 / 直觉 / 成熟' },
    { name:'国王', en:'King',  kw:'权威 / 掌控 / 成就' }
  ]

  // Build full 78-card deck
  var ALL_CARDS = []
  MAJOR.forEach(function(c) {
    ALL_CARDS.push({ id:c.id, num:c.num, cn:c.cn, en:c.en, up:c.up, rev:c.rev, type:'major' })
  })
  var suitLetters = ['W','C','S','P'] // wands, cups, swords, pentacles
  SUITS.forEach(function(s, si) {
    NUMBERS.forEach(function(num, ni) {
      ALL_CARDS.push({
        id: suitLetters[si] + (ni + 1),
        num: NUM_CN[ni],
        cn: s.suit + NUM_CN[ni],
        en: s.suit + ' ' + num,
        up: s.element + '元素 · ' + s.theme,
        rev: s.element + '元素逆位 · ' + s.theme + '受阻',
        type: 'minor'
      })
    })
    COURTS.forEach(function(c, ci) {
      ALL_CARDS.push({
        id: suitLetters[si] + (ci + 11),
        num: c.name[0],
        cn: s.suit + c.name,
        en: s.suit + ' ' + c.en,
        up: s.element + ' · ' + c.kw,
        rev: s.element + '逆位 · ' + c.kw + '失衡',
        type: 'court'
      })
    })
  })

  var SPREADS = [
    { id:'single',  name:'每日一牌',   desc:'抽取一张牌，获得今日指引', count:1, positions:['指引'] },
    { id:'three',   name:'时间之流',   desc:'过去 / 现在 / 未来的三牌展开', count:3, positions:['过去','现在','未来'] },
    { id:'celtic',  name:'凯尔特十字', desc:'十张牌的深度全面解读', count:10, positions:['现况','挑战','根源','过去','可能','近未来','自我','环境','希望','结局'] }
  ]

  // ===================================================================
  // STATE
  // ===================================================================
  var state = {
    screen: 'home',
    spread: null,
    question: '',
    deck: [],
    selected: [],  // { card, reversed, position }
    reading: null,
    aiText: ''
  }

  // ===================================================================
  // HELPERS
  // ===================================================================
  function esc(s) {
    var d = document.createElement('div')
    d.textContent = s
    return d.innerHTML
  }

  function shuffle(arr) {
    var a = arr.slice()
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp
    }
    return a
  }

  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem('tarot_history') || '[]')
    } catch (_) { return [] }
  }

  function saveHistory(item) {
    var list = getHistory()
    list.unshift(item)
    if (list.length > 20) list.length = 20
    try { localStorage.setItem('tarot_history', JSON.stringify(list)) } catch (_) {}
  }

  function formatDate(ts) {
    var d = new Date(ts)
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
      String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
  }

  // ===================================================================
  // RENDER — SCREEN 1: HOME
  // ===================================================================
  function renderHome(root) {
    var history = getHistory().slice(0, 5)
    var historyHTML = ''
    if (history.length === 0) {
      historyHTML = '<div class="tarot-empty-history">\u2605 暂无占卜记录</div>'
    } else {
      historyHTML = history.map(function(h) {
        var cardTags = (h.cards || []).map(function(c) {
          return '<span class="tarot-history-card-mini">' + esc(c.cn) + (c.reversed ? '(逆)' : '') + '</span>'
        }).join('')
        return '<div class="tarot-history-item" data-ts="' + h.ts + '">' +
          '<div class="tarot-history-meta">' +
            '<span class="tarot-history-date">' + esc(formatDate(h.ts)) + '</span>' +
            '<span class="tarot-history-spread">' + esc(h.spreadName || '') + '</span>' +
          '</div>' +
          '<div class="tarot-history-question">' + esc(h.question || '每日指引') + '</div>' +
          '<div class="tarot-history-cards">' + cardTags + '</div>' +
        '</div>'
      }).join('')
    }

    var spreadHTML = SPREADS.map(function(s, i) {
      return '<button class="tarot-spread-btn" data-spread="' + i + '">' +
        '<div class="tarot-spread-icon"><span>' + (s.count === 1 ? 'I' : s.count === 3 ? 'III' : 'X') + '</span></div>' +
        '<div class="tarot-spread-info">' +
          '<div class="tarot-spread-name">' + esc(s.name) + '</div>' +
          '<div class="tarot-spread-desc">' + esc(s.desc) + '</div>' +
        '</div>' +
        '<span class="tarot-spread-count">' + s.count + '\u5F20</span>' +
      '</button>'
    }).join('')

    var html =
      '<div class="tarot-screen tarot-active" id="tarot-screen-home">' +
        '<div class="tarot-home-header">' +
          '<div class="tarot-title-wrap">' +
            '<span class="tarot-star-deco"></span>' +
            '<h1 class="tarot-title">\u661F\u8F68\u5854\u7F57</h1>' +
            '<span class="tarot-star-deco tarot-right"></span>' +
          '</div>' +
          '<div class="tarot-subtitle">STAR TRAIL TAROT</div>' +
        '</div>' +
        '<div class="tarot-question-section">' +
          '<textarea class="tarot-question-input" id="tarot-question" rows="2" placeholder="\u5728\u5FC3\u4E2D\u9ED8\u5FF5\u4F60\u7684\u95EE\u9898\uFF08\u53EF\u9009\uFF09"></textarea>' +
        '</div>' +
        '<div class="tarot-spread-section">' +
          '<div class="tarot-spread-label">\u9009\u62E9\u5C55\u5F00\u65B9\u5F0F</div>' +
          '<div class="tarot-spread-options">' + spreadHTML + '</div>' +
        '</div>' +
        '<div class="tarot-start-section">' +
          '<button class="tarot-start-btn" id="tarot-start">\u5F00\u59CB\u5360\u535C</button>' +
        '</div>' +
        '<div class="tarot-history-section">' +
          '<div class="tarot-history-title">\u5360\u535C\u8BB0\u5F55</div>' +
          '<div class="tarot-history-list">' + historyHTML + '</div>' +
        '</div>' +
      '</div>'

    root.querySelector('.tarot-screens').innerHTML = html
    bindHomeEvents(root)
  }

  function bindHomeEvents(root) {
    var screen = root.querySelector('#tarot-screen-home')
    if (!screen) return

    // Spread selection
    var spreadBtns = screen.querySelectorAll('.tarot-spread-btn')
    var selectedIdx = state.spread != null ? state.spread : 0
    spreadBtns.forEach(function(btn, i) {
      if (i === selectedIdx) btn.classList.add('tarot-selected')
      btn.addEventListener('click', function() {
        spreadBtns.forEach(function(b) { b.classList.remove('tarot-selected') })
        btn.classList.add('tarot-selected')
        state.spread = i
      })
    })
    state.spread = selectedIdx

    // Start button
    screen.querySelector('#tarot-start').addEventListener('click', function() {
      state.question = (screen.querySelector('#tarot-question').value || '').trim()
      state.spread = state.spread || 0
      state.deck = shuffle(ALL_CARDS)
      state.selected = []
      state.reading = null
      state.aiText = ''
      renderDraw(root)
    })

    // History items
    screen.querySelectorAll('.tarot-history-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var ts = Number(item.dataset.ts)
        var hist = getHistory().find(function(h) { return h.ts === ts })
        if (hist) {
          state.question = hist.question || ''
          state.spread = SPREADS.findIndex(function(s) { return s.id === hist.spreadId })
          if (state.spread < 0) state.spread = 0
          state.selected = hist.cards || []
          state.reading = hist.reading || null
          state.aiText = hist.aiText || ''
          renderResult(root)
        }
      })
    })
  }

  // ===================================================================
  // RENDER — SCREEN 2: CARD DRAWING
  // ===================================================================
  function renderDraw(root) {
    var sp = SPREADS[state.spread]
    var need = sp.count

    var html =
      '<div class="tarot-screen tarot-active" id="tarot-screen-draw">' +
        '<div class="tarot-draw-header">' +
          '<div class="tarot-draw-title">' + esc(sp.name) + '</div>' +
          '<div class="tarot-draw-hint">\u70B9\u51FB\u724C\u9762\u62BD\u53D6' + need + '\u5F20\u724C</div>' +
        '</div>' +
        '<div class="tarot-draw-progress" id="tarot-progress">0 / ' + need + '</div>' +
        '<div class="tarot-shuffle-wrap" id="tarot-shuffle">' +
          '<div class="tarot-card-back" style="width:70px;height:100px;position:absolute;border-radius:8px;background:linear-gradient(145deg,#2a1f3d,#1a1228);border:1.5px solid #8a7433;display:flex;align-items:center;justify-content:center;animation:tarotShuffle 1.5s ease-in-out infinite">' +
            '<div class="tarot-card-pattern"></div>' +
            '<span style="font-size:28px;color:#c9a84c;opacity:0.7">\u2726</span>' +
          '</div>' +
          '<div class="tarot-card-back" style="width:70px;height:100px;position:absolute;border-radius:8px;background:linear-gradient(145deg,#2a1f3d,#1a1228);border:1.5px solid #8a7433;display:flex;align-items:center;justify-content:center;animation:tarotShuffle 1.5s ease-in-out 0.2s infinite">' +
            '<div class="tarot-card-pattern"></div>' +
            '<span style="font-size:28px;color:#c9a84c;opacity:0.7">\u2726</span>' +
          '</div>' +
          '<div class="tarot-card-back" style="width:70px;height:100px;position:absolute;border-radius:8px;background:linear-gradient(145deg,#2a1f3d,#1a1228);border:1.5px solid #8a7433;display:flex;align-items:center;justify-content:center;animation:tarotShuffle 1.5s ease-in-out 0.4s infinite">' +
            '<div class="tarot-card-pattern"></div>' +
            '<span style="font-size:28px;color:#c9a84c;opacity:0.7">\u2726</span>' +
          '</div>' +
        '</div>' +
        '<div class="tarot-card-grid" id="tarot-grid"></div>' +
        '<div class="tarot-view-btn-wrap" id="tarot-view-wrap">' +
          '<button class="tarot-view-btn" id="tarot-view-btn">\u67E5\u770B\u89E3\u8BFB</button>' +
        '</div>' +
      '</div>'

    root.querySelector('.tarot-screens').innerHTML = html

    // After a short shuffle animation, show the grid
    var shuffleWrap = root.querySelector('#tarot-shuffle')
    var grid = root.querySelector('#tarot-grid')
    grid.style.display = 'none'

    setTimeout(function() {
      shuffleWrap.style.display = 'none'
      grid.style.display = ''
      renderCardGrid(root, need)
    }, 1200)

    // Back button: return to home
    bindDrawBack(root)
  }

  function renderCardGrid(root, need) {
    var grid = root.querySelector('#tarot-grid')
    var sp = SPREADS[state.spread]
    var cards = state.deck.slice(0, Math.max(need * 3, 21)) // show enough face-down cards

    grid.innerHTML = cards.map(function(card, i) {
      return '<div class="tarot-card" data-idx="' + i + '">' +
        '<div class="tarot-card-inner">' +
          '<div class="tarot-card-back">' +
            '<div class="tarot-card-pattern"></div>' +
          '</div>' +
          '<div class="tarot-card-front">' +
            '<div class="tarot-card-numeral">' + esc(card.num) + '</div>' +
            '<div class="tarot-card-name-cn">' + esc(card.cn) + '</div>' +
            '<div class="tarot-card-name-en">' + esc(card.en) + '</div>' +
            '<div class="tarot-card-orientation"></div>' +
          '</div>' +
        '</div>' +
      '</div>'
    }).join('')

    bindCardGridEvents(root, need)
  }

  function bindCardGridEvents(root, need) {
    var grid = root.querySelector('#tarot-grid')
    var progress = root.querySelector('#tarot-progress')
    var viewWrap = root.querySelector('#tarot-view-wrap')
    var allCards = grid.querySelectorAll('.tarot-card')

    allCards.forEach(function(el) {
      el.addEventListener('click', function() {
        if (state.selected.length >= need) return
        if (el.classList.contains('tarot-flipped')) return

        var idx = Number(el.dataset.idx)
        var card = state.deck[idx]
        var reversed = Math.random() < 0.35 // 35% chance reversed

        // Flip the card
        el.classList.add('tarot-flipped', 'tarot-selected')

        // Set orientation indicator
        var orient = el.querySelector('.tarot-card-orientation')
        if (reversed) {
          orient.className = 'tarot-card-orientation tarot-reversed'
          orient.textContent = '\u2191 \u9006\u4F4D'
          // Rotate the front content for reversed cards
          el.querySelector('.tarot-card-front').querySelector('.tarot-card-numeral').style.transform = 'rotate(180deg)'
        } else {
          orient.className = 'tarot-card-orientation tarot-upright'
          orient.textContent = '\u2191 \u6B63\u4F4D'
        }

        var sp = SPREADS[state.spread]
        state.selected.push({
          card: card,
          reversed: reversed,
          position: sp.positions[state.selected.length] || ''
        })

        progress.textContent = state.selected.length + ' / ' + need

        // Disable remaining unselected cards once we have enough
        if (state.selected.length >= need) {
          allCards.forEach(function(c) {
            if (!c.classList.contains('tarot-flipped')) {
              c.classList.add('tarot-disabled')
            }
          })
          viewWrap.classList.add('tarot-show')
        }
      })
    })

    // View reading button
    root.querySelector('#tarot-view-btn').addEventListener('click', function() {
      renderResult(root)
    })
  }

  function bindDrawBack(root) {
    // Use close button to go back to home
    var closeBtn = root.querySelector('.tarot-close')
    if (closeBtn) {
      closeBtn.onclick = function() {
        renderHome(root)
      }
    }
  }

  // ===================================================================
  // RENDER — SCREEN 3: READING RESULT
  // ===================================================================
  function renderResult(root) {
    var sp = SPREADS[state.spread]
    var question = state.question || '\u6BCF\u65E5\u6307\u5F15'

    var cardsHTML = state.selected.map(function(sel, i) {
      var c = sel.card
      var orient = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D'
      var orientClass = sel.reversed ? 'tarot-reversed' : 'tarot-upright'
      var keywords = sel.reversed ? c.rev : c.up
      return '<div class="tarot-result-card" data-position="' + esc(sel.position || sp.positions[i] || '') + '">' +
        '<div class="tarot-result-card-numeral">' + esc(c.num) + '</div>' +
        '<div class="tarot-result-card-name">' + esc(c.cn) + '</div>' +
        '<div class="tarot-result-card-keywords">' + esc(keywords) + '</div>' +
        '<div class="tarot-result-card-orient ' + orientClass + '">' + orient + '</div>' +
      '</div>'
    }).join('')

    var html =
      '<div class="tarot-screen tarot-active" id="tarot-screen-result">' +
        '<div class="tarot-result-header">' +
          '<div class="tarot-result-title">\u724C\u9635\u89E3\u8BFB</div>' +
          '<div class="tarot-result-question">\u201C' + esc(question) + '\u201D</div>' +
        '</div>' +
        '<div class="tarot-result-cards">' + cardsHTML + '</div>' +
        '<div class="tarot-ai-section">' +
          '<div class="tarot-ai-title">\u667A\u80FD\u89E3\u8BFB</div>' +
          '<div class="tarot-ai-content" id="tarot-ai-content">' +
            '<div class="tarot-ai-loading">\u6B63\u5728\u8FDE\u63A5\u661F\u8F68\u2026</div>' +
          '</div>' +
        '</div>' +
        '<div class="tarot-result-actions">' +
          '<button class="tarot-action-btn tarot-action-save" id="tarot-save">\u4FDD\u5B58\u5230\u5386\u53F2</button>' +
          '<button class="tarot-action-btn tarot-action-retry" id="tarot-retry">\u91CD\u65B0\u5360\u535C</button>' +
        '</div>' +
      '</div>'

    root.querySelector('.tarot-screens').innerHTML = html
    bindResultEvents(root)

    // Start AI reading
    if (state.aiText) {
      root.querySelector('#tarot-ai-content').innerHTML = esc(state.aiText)
    } else {
      fetchAIReading(root)
    }
  }

  function bindResultEvents(root) {
    var screen = root.querySelector('#tarot-screen-result')

    // Save button
    screen.querySelector('#tarot-save').addEventListener('click', function() {
      var sp = SPREADS[state.spread]
      var item = {
        ts: Date.now(),
        question: state.question,
        spreadId: sp.id,
        spreadName: sp.name,
        cards: state.selected.map(function(sel) {
          return { cn: sel.card.cn, en: sel.card.en, reversed: sel.reversed, position: sel.position }
        }),
        aiText: state.aiText
      }
      saveHistory(item)

      // Show toast
      var toast = document.createElement('div')
      toast.className = 'tarot-saved-toast'
      toast.textContent = '\u2605 \u5DF2\u4FDD\u5B58'
      root.appendChild(toast)
      setTimeout(function() { toast.remove() }, 1600)
    })

    // Retry button
    screen.querySelector('#tarot-retry').addEventListener('click', function() {
      state.deck = shuffle(ALL_CARDS)
      state.selected = []
      state.reading = null
      state.aiText = ''
      renderHome(root)
    })

    // Close button -> back to home
    var closeBtn = root.querySelector('.tarot-close')
    if (closeBtn) {
      closeBtn.onclick = function() {
        renderHome(root)
      }
    }
  }

  // ===================================================================
  // AI READING — calls game API
  // ===================================================================
  async function fetchAIReading(root) {
    var el = root.querySelector('#tarot-ai-content')
    if (!el) return

    try {
      if (!window.loadGameApiConfig) {
        el.innerHTML = '<div class="tarot-ai-error">\u672A\u627E\u5230 API \u914D\u7F6E\u63A5\u53E3\uFF0C\u8BF7\u5148\u914D\u7F6E\u6E38\u620F API</div>'
        return
      }

      var cfg = await window.loadGameApiConfig()
      if (!cfg.url || !cfg.key || !cfg.model) {
        el.innerHTML = '<div class="tarot-ai-error">\u8BF7\u5148\u5728\u6E38\u620F\u5927\u5385\u4E2D\u914D\u7F6E API\uFF08Base URL / Key / Model\uFF09</div>'
        return
      }

      var sp = SPREADS[state.spread]
      var cardDesc = state.selected.map(function(sel, i) {
        var pos = sel.position || sp.positions[i] || ''
        var orient = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D'
        var meaning = sel.reversed ? sel.card.rev : sel.card.up
        return (i + 1) + '. [' + pos + '] ' + sel.card.cn + '(' + orient + ')\u2014\u2014' + meaning
      }).join('\n')

      var userQ = state.question || '\u60F3\u4E86\u89E3\u5F53\u524D\u7684\u72B6\u51B5\u548C\u65B9\u5411'

      var prompt = '\u4F60\u662F\u5854\u7F57\u724C\u89E3\u8BFB\u5E08\u3002\u7528\u6237\u95EE\uFF1A' + userQ +
        '\u3002\u62BD\u5230\u4E86\u4EE5\u4E0B\u724C\uFF1A\n' + cardDesc +
        '\n\u8BF7\u6839\u636E\u6BCF\u5F20\u724C\u7684\u4F20\u7EDF\u542B\u4E49\u548C\u4F4D\u7F6E\uFF0C\u7ED9\u51FA\u8BE6\u7EC6\u89E3\u8BFB\u3002\u89E3\u8BFB\u8981\u6E29\u6696\u3001\u6709\u6D1E\u5BDF\u529B\uFF0C\u4E0D\u8981\u8FC7\u4E8E\u7384\u5B66\u3002\u4F7F\u7528\u4E2D\u6587\u56DE\u7B54\u3002'

      var body = {
        model: cfg.model,
        messages: [
          { role: 'system', content: '\u4F60\u662F\u4E00\u4F4D\u6E29\u67D4\u800C\u6709\u667A\u6167\u7684\u5854\u7F57\u724C\u89E3\u8BFB\u5E08\u3002\u4F60\u7684\u89E3\u8BFB\u6E29\u6696\u3001\u5177\u6709\u6D1E\u5BDF\u529B\uFF0C\u4E0D\u5938\u5F20\u4E0D\u7384\u5B66\u3002' },
          { role: 'user', content: prompt }
        ],
        temperature: cfg.temp || 0.7,
        max_tokens: 1500
      }

      var response = await fetch(cfg.url + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + cfg.key
        },
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        var errText = ''
        try { errText = await response.text() } catch (_) {}
        throw new Error('API \u8BF7\u6C42\u5931\u8D25 (' + response.status + ')' + (errText ? ': ' + errText.slice(0, 100) : ''))
      }

      var json = await response.json()
      var text = ''
      var msg = json && json.choices && json.choices[0] && json.choices[0].message
      if (msg) {
        text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(function(p) { return typeof p === 'string' ? p : (p.text || '') }).join('') : '')
      }

      if (!text) text = '\u672A\u80FD\u83B7\u53D6\u89E3\u8BFB\u5185\u5BB9'

      state.aiText = text
      if (el) el.textContent = text

    } catch (e) {
      console.error('[tarot] AI reading error:', e)
      if (el) el.innerHTML = '<div class="tarot-ai-error">\u89E3\u8BFB\u5931\u8D25\uFF1A' + esc(e.message || '\u672A\u77E5\u9519\u8BEF') + '</div>'
    }
  }

  // ===================================================================
  // MAIN ENTRY — window.showTarotPage()
  // ===================================================================
  window.showTarotPage = function() {
    // Remove existing
    var existing = document.getElementById('tarot-page')
    if (existing) existing.remove()

    // Create root
    var root = document.createElement('div')
    root.id = 'tarot-page'
    root.className = 'tarot-root'

    // Close button
    var closeBtn = document.createElement('button')
    closeBtn.className = 'tarot-close'
    closeBtn.innerHTML = '<span class="tarot-close-x"></span>'
    closeBtn.addEventListener('click', function() { root.remove() })
    root.appendChild(closeBtn)

    // Screen container
    var screens = document.createElement('div')
    screens.className = 'tarot-screens'
    root.appendChild(screens)

    // Append to app
    var app = document.getElementById('app') || document.body
    app.appendChild(root)

    // Reset state
    state = { screen: 'home', spread: 0, question: '', deck: [], selected: [], reading: null, aiText: '' }

    // Render home
    renderHome(root)
  }
})()
