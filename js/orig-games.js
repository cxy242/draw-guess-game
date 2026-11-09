// orig-games.js - 月月机双游戏（微醺酒吧 & 因果律软糖罐）薄接入层 v6.8.3
// 架构原则：原版 UI iframe 直连 + 顶栏换人 + 玩一局面板 + 线上(微信)/线下(想见你)双模对话抽屉 + 手动刷新

window.OrigGames = {
  BAR_PORT: 8766,
  CANDY_PORT: 8765,
  BAR_API: '/bar-api/',
  CANDY_API: '/candy-api/',
  UNLOCK_NOTE: '番外小游戏：游戏内知情，游戏外零记忆',

  // 真实酒单 25 款（严格对齐原版酒单）
  BAR_DRINKS: [
    '威士忌', '清酒', '梅子酒', '啤酒', '金汤力',
    '白兰地', '黑朗姆', '龙舌兰', '伏特加', '长岛冰茶',
    '葡萄架', '「3:47 AM」', '墨绿', '莫斯科骡子', '红糖姜茶',
    '热托蒂', '热可可', '白水', '绿茶', '红茶',
    '普洱', '气泡水', '可乐', '十全大补酒', '醒酒丸'
  ],

  // 轮盘默认盘面预设（3~12 格，双方约定盘面）
  WHEEL_PRESETS: [
    {
      label: '微醺经典局（6格）',
      entries: ['喝半杯', '真心话一题', '指定对方喝一口', '安全过关', '大冒险一次', '两人同饮一口']
    },
    {
      label: '心跳提问局（6格）',
      entries: ['说出此刻最想做的事', '喝一口酒', '夸对方三个优点', '回答一个秘密', '安全过关', '对视十秒不许笑']
    },
    {
      label: '酒神挑战局（4格）',
      entries: ['输家干杯', '指定对方喝一杯', '免罚安全', '再来一转']
    }
  ],

  // 运行时内存状态（番外铁律：仅存本页内存，换人或关页即失，绝不写 聊天表与记忆表）
  _state: {
    kind: null,
    buddy: null,
    chatMode: 'online', // 'online' (微信线上气泡模式) | 'offline' (想见你线下叙事模式)
    chatLog: [],        // [{ role: 'user'|'char', text: '...', time: 'HH:MM' }]
    chatSending: false,
    playBusy: false,
    aiBusy: false,
    barExpanded: false,
    activeSheet: null,  // 'play' | 'chat' | null
    playForm: {
      tab: 'table',     // 'table' (赌桌) | 'flight' (盲品揭杯) | 'candy' (糖果操作)
      game: 'dice',     // 'dice' | 'hands' | 'wheel'
      mode: 1,          // 1 | 3
      wager: 'drink',   // 'drink' | 'truth' | 'dare' | 'custom'
      drink: '梅子酒',
      text: '',
      wheelPresetIdx: 0,
      entriesText: '喝半杯\n真心话一题\n指定对方喝一口\n安全过关\n大冒险一次\n两人同饮一口',
      cup: 1,           // 1..6
      candyAction: 'eat', // 'eat' | 'feed' | 'dex' | 'look'
      candyIndex: 1,    // 1..5
      candyMessage: ''
    }
  },

  resetRuntimeState: function (kind, ch) {
    this._state.kind = kind || null;
    this._state.buddy = ch || null;
    this._state.chatLog = [];
    this._state.chatSending = false;
    this._state.playBusy = false;
    this._state.aiBusy = false;
    this._state.barExpanded = false;
    this._state.activeSheet = null;
    this._state.playForm.tab = kind === 'candy' ? 'candy' : 'table';
  },

  gameUrl: function (kind) {
    var host = window.location && window.location.hostname ? window.location.hostname : '103.153.36.142';
    return 'http://' + host + ':' + (kind === 'bar' ? this.BAR_PORT : this.CANDY_PORT) + '/';
  },

  apiBase: function (kind) {
    return kind === 'bar' ? this.BAR_API : this.CANDY_API;
  },

  esc: function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  },

  nowTimeStr: function () {
    var d = new Date();
    var hh = String(d.getHours());
    var mm = String(d.getMinutes());
    if (hh.length < 2) hh = '0' + hh;
    if (mm.length < 2) mm = '0' + mm;
    return hh + ':' + mm;
  },

  makeRoundId: function () {
    var d = new Date();
    var yyyy = String(d.getFullYear());
    var mm = String(d.getMonth() + 1);
    var dd = String(d.getDate());
    if (mm.length < 2) mm = '0' + mm;
    if (dd.length < 2) dd = '0' + dd;
    var rand = Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
    return yyyy + mm + dd + '-' + rand;
  },

  isUserRecord: function (c) {
    if (!c || typeof c !== 'object') return true;
    var id = String(c.id == null ? '' : c.id).toLowerCase();
    var type = String(c.type == null ? '' : c.type).toLowerCase();
    var role = String(c.role == null ? '' : c.role).toLowerCase();
    if (id === 'user' || type === 'user' || role === 'user') return true;
    if (c.isUser === true || c.is_user === true) return true;
    return false;
  },

  avatarHtml: function (ch, cls) {
    var src = ch && (ch.avatar || ch.avatarUrl || ch.photo || ch.image || '');
    var name = this.esc(ch && ch.name);
    return src
      ? '<img class="' + cls + '" src="' + this.esc(src) + '" alt="' + name + '">'
      : '<span class="' + cls + ' ' + cls + '-empty">' + this.esc((ch && ch.name || '?').slice(0, 1)) + '</span>';
  },

  getUserAvatarHtml: function (cls) {
    var u = window._wechatUser || null;
    if (u && (u.avatar || u.avatarUrl || u.photo || u.image || u.name)) {
      return this.avatarHtml(u, cls);
    }
    return '<span class="' + cls + ' ' + cls + '-empty">我</span>';
  },

  getUserDisplayName: function () {
    var u = window._wechatUser || null;
    if (u && u.name) return String(u.name);
    return '我';
  },

  // 严格过滤用户本人（type==='user' || role==='user' || id==='user' 全排）
  getBuddies: async function () {
    var self = this;
    var list = [];
    try {
      if (window.db && window.db.characters) {
        try {
          list = await window.db.characters.where('type').notEqual('user').toArray();
        } catch (e1) {
          list = await window.db.characters.toArray();
        }
      } else if (window.DB && typeof window.DB.getCharacters === 'function') {
        list = (await window.DB.getCharacters()) || [];
      } else if (window.state && Array.isArray(window.state.characters)) {
        list = window.state.characters;
      }
    } catch (e) {
      list = [];
    }
    return (list || []).filter(function (c) {
      return !self.isUserRecord(c) && Boolean(c && (c.name || c.id));
    });
  },

  getUserAccounts: async function () {
    var list = [];
    try {
      if (window.db && window.db.characters) {
        var all = await window.db.characters.toArray();
        list = (all || []).filter(function (c) {
          if (!c) return false;
          var id = String(c.id == null ? '' : c.id).toLowerCase();
          var type = String(c.type == null ? '' : c.type).toLowerCase();
          var role = String(c.role == null ? '' : c.role).toLowerCase();
          return id === 'user' || type === 'user' || role === 'user' || c.isUser === true;
        });
      }
    } catch (e) {
      list = [];
    }
    return list;
  },

  getBuddy: async function (kind) {
    var key = kind === 'bar' ? 'barBuddyId' : 'candyBuddyId';
    var savedId = null;
    try {
      if (window.db && window.db.config) {
        var rec = await window.db.config.get(key);
        if (rec && rec.value != null) savedId = rec.value;
      }
    } catch (e) {}
    if (savedId == null) {
      try {
        savedId = localStorage.getItem('orig_buddy_' + kind);
      } catch (e2) {}
    }
    if (savedId == null) return null;
    var buddies = await this.getBuddies();
    for (var i = 0; i < buddies.length; i++) {
      if (String(buddies[i].id) === String(savedId)) {
        return buddies[i];
      }
    }
    return null;
  },

  saveBuddy: async function (kind, ch) {
    if (!ch || ch.id == null) return;
    var key = kind === 'bar' ? 'barBuddyId' : 'candyBuddyId';
    try {
      if (window.db && window.db.config) {
        await window.db.config.put({ key: key, value: ch.id });
      }
    } catch (e) {}
    try {
      localStorage.setItem('orig_buddy_' + kind, String(ch.id));
    } catch (e2) {}
  },

  // 番外只读上下文：只读最近聊天与关系现状，绝不写回数据库
  tempContext: async function (ch) {
    var parts = [];
    try {
      if (window.db && window.db.messages && ch && ch.id != null) {
        var allMsgs = await window.db.messages.toArray();
        var related = (allMsgs || []).filter(function (m) {
          return m && (String(m.charId) === String(ch.id) || String(m.characterId) === String(ch.id) || String(m.chatId) === String(ch.id));
        });
        var recent = related.slice(-20);
        if (recent.length > 0) {
          var lines = recent.map(function (m) {
            var who = (m.role === 'user' || m.sender === 'user' || m.isUser) ? '我' : (ch.name || 'Ta');
            var txt = String(m.content || m.text || '').replace(/\s+/g, ' ').slice(0, 60);
            return who + ': ' + txt;
          });
          parts.push('【最近聊天 (只读)】\n' + lines.join('\n'));
        } else {
          parts.push('【最近聊天】(暂无记录)');
        }
      }
    } catch (e) {
      parts.push('【最近聊天】(暂无记录)');
    }
    try {
      if (typeof window.getRelationshipContext === 'function' && ch && ch.id != null) {
        var rel = await window.getRelationshipContext(ch.id);
        if (rel) {
          parts.push('【关系现状 (只读)】\n' + String(rel).slice(0, 300));
        }
      }
    } catch (e2) {}
    parts.push('【番外提示】这是游戏时间，游戏结束后你不会保留这里的记忆。');
    return parts.join('\n\n');
  },

  // JSON 容错解析：大括号配对扫描 + 整串兜底
  parseJson: function (text) {
    if (text == null) return null;
    if (typeof text === 'object') return text;
    var raw = String(text).trim();
    if (!raw) return null;
    var cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch (e1) {}

    // 大括号配对扫描（忽略字符串内部的大括号）
    var start = -1;
    var depth = 0;
    var inStr = false;
    var escNext = false;
    for (var i = 0; i < cleaned.length; i++) {
      var ch = cleaned[i];
      if (escNext) {
        escNext = false;
        continue;
      }
      if (ch === '\\') {
        escNext = true;
        continue;
      }
      if (ch === '"') {
        inStr = !inStr;
        continue;
      }
      if (inStr) continue;
      if (ch === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          var candidate = cleaned.slice(start, i + 1);
          try {
            return JSON.parse(candidate);
          } catch (e2) {
            start = -1;
          }
        }
      }
    }

    var first = cleaned.indexOf('{');
    var last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch (e3) {}
    }
    return { say: cleaned.slice(0, 160) };
  },

  // 抓取游戏实况文本（bar 用 GET /bar-api/bar/context；candy 用 GET /candy-api/candyjar/look）
  fetchGameContext: async function (kind) {
    var url = kind === 'bar'
      ? (this.BAR_API + 'bar/context')
      : (this.CANDY_API + 'candyjar/look');
    try {
      var res = await fetch(url, { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        return '（暂未获取到实况，HTTP ' + res.status + '）';
      }
      var ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.indexOf('application/json') !== -1) {
        try {
          var data = await res.json();
          if (typeof data === 'string') return data;
          return data.context || data.result || data.text || data.look || JSON.stringify(data);
        } catch (je) {
          return '（实况解析完成）';
        }
      }
      var txt = await res.text();
      try {
        var parsed = JSON.parse(txt);
        if (parsed && typeof parsed === 'object') {
          return parsed.context || parsed.result || parsed.text || parsed.look || txt;
        }
      } catch (e2) {}
      return txt || '（场景安静）';
    } catch (err) {
      return '（网络繁忙，暂时无法读取场景实况）';
    }
  },

  // 更新顶部紧凑台词条（1行就绪条，可点箭头展开/折叠详情，绝不挤占 iframe 高度）
  logLine: function (page, html, speakerCh) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var textEl = page.querySelector('[data-og-bubble-text]');
    var avaEl = page.querySelector('[data-og-bubble-avatar]');
    if (avaEl && speakerCh) {
      avaEl.innerHTML = this.avatarHtml(speakerCh, 'og-status-ava');
    }
    if (textEl) {
      textEl.innerHTML = html;
    } else {
      var b = page.querySelector('[data-og-bubble]');
      if (b) b.innerHTML = html;
    }
  },

  // 更新紧凑结果条（.og-note）
  showNote: function (page, text) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var noteEl = page.querySelector('[data-og-note]');
    var noteTextEl = page.querySelector('[data-og-note-text]');
    if (!noteEl) return;
    var clean = String(text == null ? '' : text).trim();
    if (!clean) {
      noteEl.hidden = true;
      return;
    }
    noteEl.hidden = false;
    if (noteTextEl) {
      noteTextEl.textContent = clean;
    } else {
      noteEl.textContent = clean;
    }
  },

  // 1.3 性能修复：仅手动触发刷新 iframe，严禁 AI 行动后自动调用
  refreshFrame: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var f = page.querySelector('.og-frame');
    if (f) {
      var targetUrl = this.gameUrl(this._state.kind || 'bar');
      f.src = targetUrl;
    }
  },

  askBuddy: async function (kind, ch, system, prompt) {
    var ctx = await this.tempContext(ch);
    var persona = (ch && (ch.description || (ch.identity && ch.identity.bio) || ch.persona || ch.signature)) || '';
    var sys = '你是「' + (ch && ch.name || '玩伴') + '」。' + persona + '\n\n' + ctx + '\n\n' + (system || '只输出 JSON，不要多余文字。');
    if (typeof window.callGameAI !== 'function') {
      return { say: '（AI 接口未就绪，请检查设置）' };
    }
    try {
      var raw = await window.callGameAI(
        [{ role: 'user', content: prompt }],
        {
          system: sys,
          temperature: 0.9,
          charAntiDrift: true
        }
      );
      return this.parseJson(raw) || { say: String(raw || '').slice(0, 120) };
    } catch (e) {
      return { say: '（刚刚走神了一下，我们继续吧）' };
    }
  },

  // 「看看」按钮：观察当前场景 + 开口说一句话（不自动刷新 iframe）
  letTaLook: async function (kind, ch, page) {
    if (this._state.aiBusy) return;
    this._state.aiBusy = true;
    var self = this;
    this.logLine(page, '<span class="og-bubble-pending">' + this.esc(ch && ch.name || 'Ta') + ' 正在打量眼前的场景...</span>', ch);
    try {
      var lookText = '';
      if (kind === 'bar') {
        var res = await fetch(this.BAR_API + 'bar/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'bar_look', input: {} })
        });
        if (res.ok) {
          var j = null;
          try { j = await res.json(); } catch (e1) {}
          lookText = (j && (j.result || j.context || j.text)) || '';
        } else {
          lookText = await this.fetchGameContext('bar');
        }
      } else {
        var resC = await fetch(this.CANDY_API + 'candyjar/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'look' })
        });
        if (resC.ok) {
          var txtC = await resC.text();
          var parsedC = this.parseJson(txtC);
          lookText = (parsedC && (parsedC.result || parsedC.text || parsedC.look)) || txtC;
        } else {
          lookText = await this.fetchGameContext('candy');
        }
      }

      var prompt = '你正在游戏里看眼前的场景。游戏视角描述：\n' +
        String(lookText || '（看不到特别的）').slice(0, 1000) + '\n\n' +
        '以你的性格自然地说一句话（可以吐槽、可以心动、可以撒娇），并顺手看一眼。\n' +
        '输出 JSON：{"say":"你的话","tool":"' + (kind === 'bar' ? 'bar_look' : 'look') + '"}';

      var ans = await this.askBuddy(kind, ch, '只输出 JSON，不要多余文字。', prompt);
      var sayText = (ans && ans.say) ? String(ans.say) : '这里气氛刚刚好。';
      this.logLine(page, '<span class="og-bubble-say">' + this.esc(sayText) + '</span>', ch);
      if (lookText) {
        this.showNote(page, String(lookText).replace(/\s+/g, ' ').slice(0, 140));
      }
      // 同步记入本页临时对话列表，方便打开对话抽屉时看到上下文
      this._state.chatLog.push({
        role: 'char',
        text: sayText,
        time: this.nowTimeStr(),
        tag: '看了看场景'
      });
      this.renderChatMessages(page);
    } catch (err) {
      self.logLine(page, '<span class="og-bubble-say">刚才灯光晃了一下，没看清呢。</span>', ch);
    } finally {
      this._state.aiBusy = false;
    }
  },

  // 「让Ta行动」按钮：根据实况选择动作并调后端 API（严格按 bar_game input_schema 协议，不自动刷新 iframe）
  letTaAct: async function (kind, ch, page) {
    if (this._state.aiBusy) return;
    this._state.aiBusy = true;
    this.logLine(page, '<span class="og-bubble-pending">' + this.esc(ch && ch.name || 'Ta') + ' 正在思考下一步动作...</span>', ch);
    try {
      var stateText = await this.fetchGameContext(kind);
      var prompt = '';
      if (kind === 'bar') {
        prompt = '酒馆现状：\n' + String(stateText).slice(0, 1200) + '\n\n' +
          '可选真实酒单：' + this.BAR_DRINKS.join('、') + '\n' +
          '你决定做一个动作并说一句话。工具三选一：\n' +
          '- bar_drink: 给自己点一杯喝 (input: {"drink":"真实酒单中的名称"})\n' +
          '- bar_game: 发起一局酒桌游戏 (input: {"round_id":"' + this.makeRoundId() + '","game":"dice|hands|wheel","mode":1,"wager":"drink|truth|dare|custom","drink":"梅子酒","text":"赌注内容","entries":["格子1","格子2","格子3"]})\n' +
          '- bar_look: 只是看看 (input: {})\n' +
          '只输出 JSON：{"say":"你的话","tool":"bar_drink|bar_game|bar_look","input":{...}}';
      } else {
        prompt = '软糖罐现状：\n' + String(stateText).slice(0, 1200) + '\n\n' +
          '你决定做一个动作并说一句话。动作四选一：\n' +
          '- eat: 吃一颗糖 (input: {"action":"eat","index":1})\n' +
          '- feed: 喂用户一颗糖 (input: {"action":"feed","index":1,"message":"喂糖附言"})\n' +
          '- dex: 翻图鉴 (input: {"action":"dex"})\n' +
          '- look: 只是看看 (input: {"action":"look"})\n' +
          '只输出 JSON：{"say":"你的话","tool":"eat|feed|dex|look","input":{...}}';
      }

      var ans = await this.askBuddy(kind, ch, '只输出 JSON，不要多余文字。', prompt);
      var sayText = (ans && ans.say) ? String(ans.say) : '来，看我这一下。';
      var resultText = '';

      if (kind === 'bar') {
        var tool = (ans && ans.tool) || 'bar_look';
        if (tool !== 'bar_drink' && tool !== 'bar_game' && tool !== 'bar_look') {
          tool = 'bar_look';
        }
        var inputObj = Object.assign({}, (ans && ans.input) || {});
        if (tool === 'bar_drink') {
          if (!inputObj.drink || this.BAR_DRINKS.indexOf(inputObj.drink) === -1) {
            inputObj.drink = '梅子酒';
          }
        } else if (tool === 'bar_game') {
          // 兼容旧字段名 kind -> game
          if (!inputObj.game && inputObj.kind) {
            inputObj.game = inputObj.kind;
            delete inputObj.kind;
          }
          if (inputObj.game !== 'dice' && inputObj.game !== 'hands' && inputObj.game !== 'wheel' && inputObj.game !== 'flight') {
            inputObj.game = 'dice';
          }
          if (inputObj.game !== 'flight') {
            if (!inputObj.round_id) inputObj.round_id = this.makeRoundId();
            inputObj.mode = Number(inputObj.mode) === 3 ? 3 : 1;
            if (!inputObj.wager || ['truth', 'dare', 'drink', 'custom'].indexOf(inputObj.wager) === -1) {
              inputObj.wager = 'drink';
            }
            if (inputObj.wager === 'drink' && (!inputObj.drink || this.BAR_DRINKS.indexOf(inputObj.drink) === -1)) {
              inputObj.drink = '梅子酒';
            }
            if (inputObj.game === 'wheel' && (!Array.isArray(inputObj.entries) || inputObj.entries.length < 3)) {
              inputObj.entries = this.WHEEL_PRESETS[0].entries.slice();
            }
          }
        }

        var resBar = await fetch(this.BAR_API + 'bar/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: tool, input: inputObj })
        });
        if (resBar.ok) {
          try {
            var dataBar = await resBar.json();
            resultText = (dataBar && (dataBar.result || dataBar.message || dataBar.text)) || '';
          } catch (eBar) {}
        } else {
          resultText = '行动请求未成功（HTTP ' + resBar.status + '）';
        }
      } else {
        var act = (ans && (ans.tool || (ans.input && ans.input.action))) || 'look';
        if (['eat', 'feed', 'dex', 'look'].indexOf(act) === -1) act = 'look';
        var payload = Object.assign({}, (ans && ans.input) || {}, { action: act });
        if ((act === 'eat' || act === 'feed') && payload.index == null) {
          payload.index = 1;
        }
        var resCandy = await fetch(this.CANDY_API + 'candyjar/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (resCandy.ok) {
          var rawCandy = await resCandy.text();
          var parsedCandy = this.parseJson(rawCandy);
          resultText = (parsedCandy && (parsedCandy.result || parsedCandy.message || parsedCandy.text)) || rawCandy;
        } else {
          resultText = '糖果罐操作未成功（HTTP ' + resCandy.status + '）';
        }
      }

      this.logLine(page, '<span class="og-bubble-say">' + this.esc(sayText) + '</span>', ch);
      if (resultText) {
        this.showNote(page, resultText);
      }
      this._state.chatLog.push({
        role: 'char',
        text: sayText + (resultText ? '（' + String(resultText).replace(/\s+/g, ' ').slice(0, 80) + '）' : ''),
        time: this.nowTimeStr(),
        tag: '主动行动'
      });
      this.renderChatMessages(page);
    } catch (err) {
      this.logLine(page, '<span class="og-bubble-say">刚刚手滑了一下，再来一次吧。</span>', ch);
    } finally {
      this._state.aiBusy = false;
    }
  },

  // 1.2 「玩一局」面板：玩家主动发起骰子/猜拳/轮盘、盲品揭杯或操作糖果罐
  openPlaySheet: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    this.closeSheets(page);
    this._state.activeSheet = 'play';
    var sheet = page.querySelector('[data-og-sheet="play"]');
    var mask = page.querySelector('[data-og-mask]');
    if (mask) mask.hidden = false;
    if (sheet) {
      sheet.hidden = false;
      this.renderPlaySheetBody(page);
    }
  },

  // 1.5 「对话」抽屉：支持微信线上气泡模式 ↔ 想见你线下叙事模式切换
  openChatSheet: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    this.closeSheets(page);
    this._state.activeSheet = 'chat';
    var sheet = page.querySelector('[data-og-sheet="chat"]');
    var mask = page.querySelector('[data-og-mask]');
    if (mask) mask.hidden = false;
    if (sheet) {
      sheet.hidden = false;
      this.syncChatSheetMode(page);
      this.renderChatMessages(page);
      var inp = sheet.querySelector('.miss-input');
      if (inp) {
        setTimeout(function () { inp.focus(); }, 60);
      }
    }
  },

  closeSheets: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    this._state.activeSheet = null;
    var mask = page.querySelector('[data-og-mask]');
    if (mask) mask.hidden = true;
    var sheets = page.querySelectorAll('[data-og-sheet]');
    for (var i = 0; i < sheets.length; i++) {
      sheets[i].hidden = true;
    }
  },

  renderPlaySheetBody: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var body = page.querySelector('[data-og-play-body]');
    if (!body) return;
    var kind = this._state.kind || 'bar';
    var f = this._state.playForm;

    if (kind === 'candy') {
      body.innerHTML =
        '<div class="og-form-group">' +
          '<div class="og-form-label">选择糖果罐动作</div>' +
          '<div class="og-seg-row">' +
            '<button type="button" class="og-seg-btn' + (f.candyAction === 'eat' ? ' is-active' : '') + '" data-og-candy-act="eat">自己吃糖</button>' +
            '<button type="button" class="og-seg-btn' + (f.candyAction === 'feed' ? ' is-active' : '') + '" data-og-candy-act="feed">喂Ta吃糖</button>' +
            '<button type="button" class="og-seg-btn' + (f.candyAction === 'look' ? ' is-active' : '') + '" data-og-candy-act="look">观察罐内</button>' +
            '<button type="button" class="og-seg-btn' + (f.candyAction === 'dex' ? ' is-active' : '') + '" data-og-candy-act="dex">查看图鉴</button>' +
          '</div>' +
        '</div>' +
        ((f.candyAction === 'eat' || f.candyAction === 'feed') ? (
          '<div class="og-form-group">' +
            '<div class="og-form-label">选择罐内糖果编号（1 ~ 5 号）</div>' +
            '<div class="og-seg-row">' +
              [1, 2, 3, 4, 5].map(function (n) {
                return '<button type="button" class="og-seg-btn' + (Number(f.candyIndex) === n ? ' is-active' : '') + '" data-og-candy-idx="' + n + '">第 ' + n + ' 颗</button>';
              }).join('') +
            '</div>' +
          '</div>'
        ) : '') +
        (f.candyAction === 'feed' ? (
          '<div class="og-form-group">' +
            '<div class="og-form-label">喂糖附言（选填）</div>' +
            '<input type="text" class="og-text-field" data-og-candy-msg maxlength="80" placeholder="写一句喂糖时对Ta说的话..." value="' + this.esc(f.candyMessage) + '">' +
          '</div>'
        ) : '') +
        '<div class="og-sheet-foot">' +
          '<button type="button" class="og-submit-btn" data-og-play-submit>' +
            (this._state.playBusy ? '正在执行...' : '确认执行') +
          '</button>' +
        '</div>';
      return;
    }

    // 酒馆游戏面板：顶部切换「赌桌对局」与「盲品揭杯」
    var tabHtml =
      '<div class="og-subtabs">' +
        '<button type="button" class="og-subtab' + (f.tab !== 'flight' ? ' is-active' : '') + '" data-og-play-tab="table">赌桌对局（骰子/猜拳/轮盘）</button>' +
        '<button type="button" class="og-subtab' + (f.tab === 'flight' ? ' is-active' : '') + '" data-og-play-tab="flight">盲品揭杯（1~6号杯）</button>' +
      '</div>';

    if (f.tab === 'flight') {
      body.innerHTML = tabHtml +
        '<div class="og-form-group">' +
          '<div class="og-form-label">选择要揭开的盲品酒杯（1 ~ 6 号杯）</div>' +
          '<div class="og-cup-grid">' +
            [1, 2, 3, 4, 5, 6].map(function (cNum) {
              return '<button type="button" class="og-cup-btn' + (Number(f.cup) === cNum ? ' is-active' : '') + '" data-og-cup="' + cNum + '">' +
                '<span class="og-cup-num">NO.' + cNum + '</span>' +
                '<span class="og-cup-name">揭开第 ' + cNum + ' 杯</span>' +
              '</button>';
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="og-form-hint">盲品规则：直接揭开对应编号的酒杯查看酒水与品鉴结果。</div>' +
        '<div class="og-sheet-foot">' +
          '<button type="button" class="og-submit-btn" data-og-play-submit>' +
            (this._state.playBusy ? '正在揭杯...' : '立即揭开第 ' + f.cup + ' 杯') +
          '</button>' +
        '</div>';
      return;
    }

    var self = this;
    var modeDesc = f.game === 'dice'
      ? (Number(f.mode) === 3 ? '三掷点数累计比大小' : '单局一掷定胜负')
      : (Number(f.mode) === 3 ? '三局两胜制' : '单局一锤定音');

    var html = tabHtml +
      '<div class="og-form-group">' +
        '<div class="og-form-label">1. 选择玩法模式</div>' +
        '<div class="og-seg-row">' +
          '<button type="button" class="og-seg-btn' + (f.game === 'dice' ? ' is-active' : '') + '" data-og-game="dice">骰子对决</button>' +
          '<button type="button" class="og-seg-btn' + (f.game === 'hands' ? ' is-active' : '') + '" data-og-game="hands">猜拳博弈</button>' +
          '<button type="button" class="og-seg-btn' + (f.game === 'wheel' ? ' is-active' : '') + '" data-og-game="wheel">幸运轮盘</button>' +
        '</div>' +
      '</div>';

    if (f.game === 'dice' || f.game === 'hands') {
      html +=
        '<div class="og-form-group">' +
          '<div class="og-form-label">2. 赛制局数（' + this.esc(modeDesc) + '）</div>' +
          '<div class="og-seg-row">' +
            '<button type="button" class="og-seg-btn' + (Number(f.mode) === 1 ? ' is-active' : '') + '" data-og-mode="1">' +
              (f.game === 'dice' ? '1 局（单掷）' : '1 局（一局定胜负）') +
            '</button>' +
            '<button type="button" class="og-seg-btn' + (Number(f.mode) === 3 ? ' is-active' : '') + '" data-og-mode="3">' +
              (f.game === 'dice' ? '3 局（三掷累计）' : '3 局（三局两胜）') +
            '</button>' +
          '</div>' +
        '</div>';
    } else if (f.game === 'wheel') {
      html +=
        '<div class="og-form-group">' +
          '<div class="og-form-label">2. 轮盘盘面（3~12 格，每行一格，可点预设或自由修改）</div>' +
          '<div class="og-preset-row">' +
            this.WHEEL_PRESETS.map(function (p, idx) {
              return '<button type="button" class="og-chip-btn' + (f.wheelPresetIdx === idx ? ' is-active' : '') + '" data-og-wheel-preset="' + idx + '">' + self.esc(p.label) + '</button>';
            }).join('') +
          '</div>' +
          '<textarea class="og-textarea-field" data-og-wheel-entries rows="4" placeholder="每行输入一个格子内容（3~12格）">' + this.esc(f.entriesText) + '</textarea>' +
        '</div>';
    }

    html +=
      '<div class="og-form-group">' +
        '<div class="og-form-label">3. 本局赌注（四选一，平局不兑现）</div>' +
        '<div class="og-seg-row">' +
          '<button type="button" class="og-seg-btn' + (f.wager === 'drink' ? ' is-active' : '') + '" data-og-wager="drink">罚酒一杯</button>' +
          '<button type="button" class="og-seg-btn' + (f.wager === 'truth' ? ' is-active' : '') + '" data-og-wager="truth">真心话</button>' +
          '<button type="button" class="og-seg-btn' + (f.wager === 'dare' ? ' is-active' : '') + '" data-og-wager="dare">大冒险</button>' +
          '<button type="button" class="og-seg-btn' + (f.wager === 'custom' ? ' is-active' : '') + '" data-og-wager="custom">自写赌注</button>' +
        '</div>' +
      '</div>';

    if (f.wager === 'drink') {
      html +=
        '<div class="og-form-group">' +
          '<div class="og-form-label">选择输家罚酒（25 款真实酒单，系统自动记一次输家醉意）</div>' +
          '<div class="og-drink-grid">' +
            this.BAR_DRINKS.map(function (dName) {
              return '<button type="button" class="og-drink-chip' + (f.drink === dName ? ' is-active' : '') + '" data-og-drink="' + self.esc(dName) + '">' + self.esc(dName) + '</button>';
            }).join('') +
          '</div>' +
        '</div>';
    } else if (f.wager === 'custom') {
      html +=
        '<div class="og-form-group">' +
          '<div class="og-form-label">填写双方约定的赌注/题目</div>' +
          '<input type="text" class="og-text-field" data-og-custom-text maxlength="80" placeholder="例如：输的人模仿小猫叫三声 / 回答对方一个问题" value="' + this.esc(f.text) + '">' +
        '</div>';
    }

    html +=
      '<div class="og-sheet-foot">' +
        '<button type="button" class="og-submit-btn" data-og-play-submit>' +
          (this._state.playBusy ? '正在开局...' : '立即开局') +
        '</button>' +
      '</div>';

    body.innerHTML = html;
  },

  // 提交「玩一局」请求并让玩伴即时反应（严格遵循 bar_game 协议：drink 赌注绝不重复调 bar_drink）
  submitPlayForm: async function (page) {
    if (this._state.playBusy) return;
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var kind = this._state.kind || 'bar';
    var ch = this._state.buddy;
    var f = this._state.playForm;

    // 同步输入框中的最新文本
    var entriesArea = page.querySelector('[data-og-wheel-entries]');
    if (entriesArea) f.entriesText = entriesArea.value;
    var customInp = page.querySelector('[data-og-custom-text]');
    if (customInp) f.text = customInp.value;
    var candyMsgInp = page.querySelector('[data-og-candy-msg]');
    if (candyMsgInp) f.candyMessage = candyMsgInp.value;

    var payload = null;
    var apiEndpoint = '';

    if (kind === 'candy') {
      apiEndpoint = this.CANDY_API + 'candyjar/ai';
      payload = { action: f.candyAction || 'eat' };
      if (payload.action === 'eat' || payload.action === 'feed') {
        payload.index = Number(f.candyIndex) || 1;
      }
      if (payload.action === 'feed' && f.candyMessage && f.candyMessage.trim()) {
        payload.message = f.candyMessage.trim();
      }
    } else if (f.tab === 'flight') {
      // 盲品揭杯协议：{"tool":"bar_game","input":{"game":"flight","cup":1..6}}
      apiEndpoint = this.BAR_API + 'bar/ai';
      var cupNum = Math.min(6, Math.max(1, Number(f.cup) || 1));
      payload = {
        tool: 'bar_game',
        input: {
          game: 'flight',
          cup: cupNum
        }
      };
    } else {
      apiEndpoint = this.BAR_API + 'bar/ai';
      var gameType = f.game || 'dice';
      var modeNum = Number(f.mode) === 3 ? 3 : 1;
      var wagerType = f.wager || 'drink';
      var inputData = {
        round_id: this.makeRoundId(),
        game: gameType,
        mode: modeNum,
        wager: wagerType
      };
      if (wagerType === 'drink') {
        inputData.drink = (f.drink && this.BAR_DRINKS.indexOf(f.drink) !== -1) ? f.drink : '梅子酒';
      } else if (wagerType === 'custom') {
        var customTxt = (f.text || '').trim();
        if (!customTxt) {
          if (window.toast) window.toast('请先填写自定义赌注内容');
          return;
        }
        inputData.text = customTxt;
      }
      if (gameType === 'wheel') {
        var rawLines = String(f.entriesText || '').split(/[\r\n,，、]+/).map(function (s) {
          return s.trim();
        }).filter(Boolean);
        if (rawLines.length < 3 || rawLines.length > 12) {
          if (window.toast) window.toast('轮盘盘面需要 3 ~ 12 个格子，当前为 ' + rawLines.length + ' 格');
          return;
        }
        inputData.entries = rawLines;
      }
      payload = {
        tool: 'bar_game',
        input: inputData
      };
    }

    this._state.playBusy = true;
    this.renderPlaySheetBody(page);

    try {
      var res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      var resultText = '';
      if (res.ok) {
        var rawText = await res.text();
        var parsed = this.parseJson(rawText);
        resultText = (parsed && (parsed.result || parsed.message || parsed.text)) || rawText;
      } else {
        resultText = '请求返回异常（HTTP ' + res.status + '）';
      }
      resultText = String(resultText || '对局已完成').trim();

      // 关闭抽屉并在结果条 (.og-note) 显示完整结果（点数/输赢/该谁喝）
      this.closeSheets(page);
      this.showNote(page, resultText);
      this.logLine(page, '<span class="og-bubble-pending">本局结算完成，' + this.esc(ch && ch.name || 'Ta') + ' 正在看结果...</span>', ch);

      // 记录到本页对话内存并让玩伴针对本局结果自然回应一句（绝不重复调 bar_drink）
      this._state.chatLog.push({
        role: 'user',
        text: '【发起对局】' + resultText,
        time: this.nowTimeStr(),
        isSystemEvent: true
      });

      var reactPrompt = '刚刚玩家在游戏里发起了一局操作，系统结算结果如下：\n' +
        resultText + '\n\n' +
        '请以你的性格和当下状态，直接对这个结果做出自然反应（如果触发真心话/大冒险或罚酒，可以直接回应或调侃对方）。只输出 JSON：{"say":"你的反应台词"}';
      var ans = await this.askBuddy(kind, ch, '只输出 JSON：{"say":"你的话"}，不要多余文字。', reactPrompt);
      var sayLine = (ans && ans.say) ? String(ans.say) : '这局有意思，我们继续！';
      this.logLine(page, '<span class="og-bubble-say">' + this.esc(sayLine) + '</span>', ch);
      this._state.chatLog.push({
        role: 'char',
        text: sayLine,
        time: this.nowTimeStr(),
        tag: '对局回应'
      });
      this.renderChatMessages(page);
    } catch (err) {
      this.showNote(page, '开局请求失败，请检查服务是否在线');
    } finally {
      this._state.playBusy = false;
      if (this._state.activeSheet === 'play') {
        this.renderPlaySheetBody(page);
      }
    }
  },

  // 同步对话抽屉的线上(微信)/线下(想见你)模式视觉与按钮激活态
  syncChatSheetMode: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var sheet = page.querySelector('[data-og-sheet="chat"]');
    if (!sheet) return;
    var mode = this._state.chatMode === 'offline' ? 'offline' : 'online';
    sheet.setAttribute('data-chat-mode', mode);
    var btns = sheet.querySelectorAll('[data-og-chat-mode]');
    for (var i = 0; i < btns.length; i++) {
      var m = btns[i].getAttribute('data-og-chat-mode');
      if (m === mode) {
        btns[i].classList.add('is-active');
      } else {
        btns[i].classList.remove('is-active');
      }
    }
    var subEl = sheet.querySelector('[data-og-chat-mode-hint]');
    if (subEl) {
      subEl.textContent = mode === 'offline'
        ? '线下 · 想见你面对面叙事模式（番外零记忆）'
        : '线上 · 微信气泡即时聊天模式（番外零记忆）';
    }
  },

  // 渲染对话抽屉消息列表（支持微信线上气泡模式 & 想见你线下叙事卡片模式）
  renderChatMessages: function (page) {
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var logEl = page.querySelector('[data-og-chat-log]');
    if (!logEl) return;

    var ch = this._state.buddy || { name: '玩伴' };
    var mode = this._state.chatMode === 'offline' ? 'offline' : 'online';
    var list = this._state.chatLog || [];
    var self = this;

    if (list.length === 0 && !this._state.chatSending) {
      if (mode === 'offline') {
        logEl.innerHTML =
          '<div class="miss-empty-chat og-chat-empty">' +
            '<div class="og-empty-badge">OFFLINE · 面对面番外</div>' +
            '<div class="og-empty-title">光影微晃，' + this.esc(ch.name || 'Ta') + ' 就在你面前</div>' +
            '<div class="og-empty-desc">在这里说的话只属于今晚的酒馆与糖果屋，不会写进日常聊天记录与记忆。</div>' +
          '</div>';
      } else {
        logEl.innerHTML =
          '<div class="og-chat-empty">' +
            '<div class="og-empty-badge">ONLINE · 微信模式</div>' +
            '<div class="og-empty-title">向 ' + this.esc(ch.name || 'Ta') + ' 发条消息吧</div>' +
            '<div class="og-empty-desc">可随时在上方切换「线上微信 / 线下想见你」模式，番外对话关页即失。</div>' +
          '</div>';
      }
      return;
    }

    var html = '';
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var isUser = item.role === 'user';
      var speakerName = isUser ? this.getUserDisplayName() : (ch.name || '玩伴');
      var avaHtml = isUser
        ? this.getUserAvatarHtml('miss-msg-avatar og-chat-ava')
        : this.avatarHtml(ch, 'miss-msg-avatar og-chat-ava');

      if (mode === 'offline') {
        // 「想见你」线下叙事模式：温暖纸感卡片、楼层编号、神态与台词交织排版
        html +=
          '<div class="miss-entry ' + (isUser ? 'is-user' : 'is-char') + '">' +
            '<div class="miss-entry-head">' +
              '<div class="miss-entry-person">' +
                avaHtml +
                '<div class="miss-entry-nameblock">' +
                  '<span class="miss-msg-name">' + self.esc(speakerName) + '</span>' +
                  '<span class="miss-entry-subtitle">' + self.esc(item.tag || (isUser ? '面对面开口' : '近距离回应')) + ' · ' + self.esc(item.time || '') + '</span>' +
                '</div>' +
              '</div>' +
              '<span class="miss-entry-floor">#' + (i + 1) + '</span>' +
            '</div>' +
            '<div class="miss-entry-card">' +
              '<div class="miss-msg-text"><p>' + self.formatOfflineText(item.text) + '</p></div>' +
            '</div>' +
          '</div>';
      } else {
        // 微信线上气泡模式：左右分列、翡翠绿用户气泡 + 纯白玩伴气泡
        html +=
          '<div class="og-wx-row ' + (isUser ? 'is-user' : 'is-char') + '">' +
            avaHtml +
            '<div class="og-wx-main">' +
              '<div class="og-wx-meta">' +
                '<span class="og-wx-name">' + self.esc(speakerName) + '</span>' +
                '<span class="og-wx-time">' + self.esc(item.time || '') + '</span>' +
              '</div>' +
              '<div class="og-wx-bubble">' + self.esc(item.text) + '</div>' +
            '</div>' +
          '</div>';
      }
    }

    if (this._state.chatSending) {
      if (mode === 'offline') {
        html +=
          '<div class="miss-entry is-char is-typing">' +
            '<div class="miss-status-card">' +
              '<div class="miss-status-row">' +
                '<span class="miss-status-card-title">' + this.esc(ch.name || 'Ta') + ' 正在看着你欲言又止</span>' +
                '<span class="miss-typing-dots"><span></span><span></span><span></span></span>' +
              '</div>' +
            '</div>' +
          '</div>';
      } else {
        html +=
          '<div class="og-wx-row is-char is-typing">' +
            this.avatarHtml(ch, 'miss-msg-avatar og-chat-ava') +
            '<div class="og-wx-main">' +
              '<div class="og-wx-bubble og-wx-typing">' +
                '<span class="miss-typing-dots"><span></span><span></span><span></span></span>' +
              '</div>' +
            '</div>' +
          '</div>';
      }
    }

    logEl.innerHTML = html;
    logEl.scrollTop = logEl.scrollHeight;
  },

  // 线下模式文本高亮格式化（对引号台词做细腻高亮，其余神态动作自然展示）
  formatOfflineText: function (text) {
    var safe = this.esc(text || '');
    return safe
      .replace(/（([^）]+)）/g, '<span class="og-offline-stage">（$1）</span>')
      .replace(/\(([^)]+)\)/g, '<span class="og-offline-stage">($1)</span>')
      .replace(/「([^」]+)」/g, '<span class="miss-quote-highlight">「$1」</span>')
      .replace(/“([^”]+)”/g, '<span class="miss-quote-highlight">“$1”</span>')
      .replace(/\n/g, '</p><p>');
  },

  // 1.5 发送番外对话消息（严格使用 miss-compose / miss-input / miss-send，严禁写入 聊天表与记忆表）
  sendChatMessage: async function (page) {
    if (this._state.chatSending) return;
    if (!page) page = document.querySelector('.og-game-page');
    if (!page) return;
    var inp = page.querySelector('.miss-input');
    if (!inp) return;
    var userText = String(inp.value || '').trim();
    if (!userText) return;

    inp.value = '';
    var kind = this._state.kind || 'bar';
    var ch = this._state.buddy || { name: '玩伴' };
    var mode = this._state.chatMode === 'offline' ? 'offline' : 'online';

    // 1. 仅写入本页内存列表
    this._state.chatLog.push({
      role: 'user',
      text: userText,
      time: this.nowTimeStr(),
      tag: mode === 'offline' ? '面对面低语' : '线上消息'
    });
    this._state.chatSending = true;
    this.renderChatMessages(page);

    try {
      // 2. 拉取实时游戏现状（bar: GET /bar-api/bar/context；candy: GET /candy-api/candyjar/look）
      var liveState = await this.fetchGameContext(kind);
      var roContext = await this.tempContext(ch);
      var persona = (ch && (ch.description || (ch.identity && ch.identity.bio) || ch.persona || ch.signature)) || '';

      var recentTurns = this._state.chatLog.slice(-10).map(function (m) {
        return (m.role === 'user' ? '用户' : (ch.name || '你')) + '：' + m.text;
      }).join('\n');

      var styleRule = mode === 'offline'
        ? '当前为【线下·想见你面对面模式】：你们正面对面坐在同一张桌前，请在回复中自然融入细腻的微表情、眼神、肢体动作描写（可用括号或自然叙述）与口语台词，像真实线下约会相处一样有呼吸感与氛围感，80~180字左右。'
        : '当前为【线上·微信气泡聊天模式】：请用自然鲜活的口语气泡风格回复对方，简短灵动、贴合你的人设性格，20~80字左右。';

      var systemPrompt =
        '你是「' + (ch.name || '玩伴') + '」。\n' +
        persona + '\n\n' +
        roContext + '\n\n' +
        '【当前所在番外场景】：' + (kind === 'bar' ? '微醺酒馆（和小机喝一杯）' : '因果律软糖罐') + '\n' +
        '【当前游戏实时现状】：\n' + String(liveState).slice(0, 1000) + '\n\n' +
        styleRule + '\n' +
        '直接输出你的回复内容，不要输出 JSON 外壳或多余解释。';

      var userPrompt =
        (recentTurns ? '【本场番外对话上下文】\n' + recentTurns + '\n\n' : '') +
        '刚刚用户对你说：' + userText + '\n请直接回应：';

      var replyText = '';
      if (typeof window.callGameAI === 'function') {
        var raw = await window.callGameAI(
          [{ role: 'user', content: userPrompt }],
          {
            system: systemPrompt,
            temperature: 0.9,
            charAntiDrift: true
          }
        );
        replyText = String(raw == null ? '' : raw).trim();
        // 如果模型不小心包了 JSON {"say":"..."}，自动剥离提取
        if (replyText.charAt(0) === '{' && replyText.indexOf('"say"') !== -1) {
          var parsed = this.parseJson(replyText);
          if (parsed && parsed.say) replyText = String(parsed.say).trim();
        }
      } else {
        replyText = '（听见你的话，抬头冲你笑了笑）我在听呢。';
      }

      if (!replyText) {
        replyText = '（轻轻晃了晃杯子，目光落在你身上）嗯，我在听。';
      }

      this._state.chatLog.push({
        role: 'char',
        text: replyText,
        time: this.nowTimeStr(),
        tag: mode === 'offline' ? '近距离回应' : '即时回复'
      });
      // 同步更新顶部紧凑台词条
      this.logLine(page, '<span class="og-bubble-say">' + this.esc(replyText) + '</span>', ch);
    } catch (err) {
      this._state.chatLog.push({
        role: 'char',
        text: '（周围微光晃动了一下）刚刚信号有点飘，你再跟我说一遍好不好？',
        time: this.nowTimeStr(),
        tag: '提示'
      });
    } finally {
      this._state.chatSending = false;
      this.renderChatMessages(page);
    }
  },

  // 微信登录门
  renderLogin: function (kind, onDone) {
    var self = this;
    var oldGate = document.querySelector('.og-gate-page');
    if (oldGate) oldGate.remove();

    var page = document.createElement('div');
    page.className = 'og-gate-page og-' + kind;
    var title = kind === 'bar' ? '和小机喝一杯' : '因果律软糖罐';
    page.innerHTML =
      '<button class="og-gate-close" type="button" data-og-close>返回</button>' +
      '<div class="og-gate-shell">' +
        '<div class="og-gate-mark"><span class="og-gate-lock"></span></div>' +
        '<h2 class="og-gate-title">' + this.esc(title) + '</h2>' +
        '<p class="og-gate-subtitle">' + this.esc(this.UNLOCK_NOTE) + '</p>' +
        '<button class="og-gate-wechat" type="button" data-og-login>微信登录进入番外</button>' +
        '<div class="og-gate-accounts" data-og-accounts hidden></div>' +
      '</div>';

    document.body.appendChild(page);

    var closeBtn = page.querySelector('[data-og-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        page.remove();
      });
    }

    var loginBtn = page.querySelector('[data-og-login]');
    var accBox = page.querySelector('[data-og-accounts]');
    if (loginBtn) {
      loginBtn.addEventListener('click', async function () {
        if (window._wechatUid) {
          page.remove();
          if (typeof onDone === 'function') onDone();
          return;
        }
        if (!accBox) return;
        accBox.hidden = false;
        accBox.innerHTML = '<div class="og-gate-empty">正在读取账号...</div>';
        var users = await self.getUserAccounts();
        if (!users || users.length === 0) {
          // 若未建独立 USER 档案，也允许以默认身份直接进入，防止卡死
          accBox.innerHTML =
            '<div class="og-gate-empty">未检测到独立 USER 档案，可直接以当前玩家身份登录</div>' +
            '<button class="og-gate-account" type="button" data-og-uid="default_user">' +
              '<span class="og-gate-avatar og-gate-avatar-empty">我</span>' +
              '<span>以当前身份进入</span>' +
            '</button>';
        } else {
          accBox.innerHTML = users.map(function (u) {
            return '<button class="og-gate-account" type="button" data-og-uid="' + self.esc(u.id) + '">' +
              self.avatarHtml(u, 'og-gate-avatar') +
              '<span>' + self.esc(u.name || '我') + '</span>' +
            '</button>';
          }).join('');
        }
        var accBtns = accBox.querySelectorAll('[data-og-uid]');
        for (var i = 0; i < accBtns.length; i++) {
          accBtns[i].addEventListener('click', function () {
            var uid = this.getAttribute('data-og-uid');
            var pickedUser = null;
            for (var j = 0; j < (users || []).length; j++) {
              if (String(users[j].id) === String(uid)) {
                pickedUser = users[j];
                break;
              }
            }
            try {
              window._wechatUid = uid;
              if (pickedUser) window._wechatUser = pickedUser;
              if (window.db && window.db.config) {
                window.db.config.put({ key: 'wechatUid', value: uid });
              }
            } catch (e) {}
            page.remove();
            if (typeof onDone === 'function') onDone();
          });
        }
      });
    }
  },

  // 选玩伴门（排除所有 user 标识）
  renderBuddyPick: async function (kind, onDone) {
    var self = this;
    var oldGate = document.querySelector('.og-gate-page');
    if (oldGate) oldGate.remove();

    var page = document.createElement('div');
    page.className = 'og-gate-page og-' + kind;
    var subText = kind === 'bar' ? '今晚谁陪你喝酒' : '谁来跟你开糖罐';
    page.innerHTML =
      '<button class="og-gate-close" type="button" data-og-close>返回</button>' +
      '<div class="og-gate-shell og-gate-wide">' +
        '<h2 class="og-gate-title">选择陪伴角色</h2>' +
        '<p class="og-gate-subtitle">' + this.esc(subText) + ' · ' + this.esc(this.UNLOCK_NOTE) + '</p>' +
        '<div class="og-buddy-grid" data-og-grid>' +
          '<div class="og-gate-empty">正在读取角色档案...</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(page);

    var closeBtn = page.querySelector('[data-og-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        page.remove();
      });
    }

    var buddies = await this.getBuddies();
    var grid = page.querySelector('[data-og-grid]');
    if (!grid) return;

    if (!buddies || buddies.length === 0) {
      grid.innerHTML = '<div class="og-gate-empty">还没有聊天角色，先去微信创建角色聊几句再回来</div>';
      return;
    }

    var currentBuddy = this._state.buddy;
    grid.innerHTML = buddies.map(function (c) {
      var isCur = currentBuddy && String(c.id) === String(currentBuddy.id);
      return '<button class="og-buddy-card' + (isCur ? ' is-current' : '') + '" type="button" data-og-buddy="' + self.esc(c.id) + '">' +
        self.avatarHtml(c, 'og-buddy-avatar') +
        '<span class="og-buddy-name">' + self.esc(c.name || '未命名') + '</span>' +
      '</button>';
    }).join('');

    var cards = grid.querySelectorAll('[data-og-buddy]');
    for (var i = 0; i < cards.length; i++) {
      cards[i].addEventListener('click', async function () {
        var cid = this.getAttribute('data-og-buddy');
        var chosen = null;
        for (var j = 0; j < buddies.length; j++) {
          if (String(buddies[j].id) === String(cid)) {
            chosen = buddies[j];
            break;
          }
        }
        if (!chosen) return;
        await self.saveBuddy(kind, chosen);
        page.remove();
        if (typeof onDone === 'function') onDone(chosen);
      });
    }
  },

  // 挂载游戏主界面（1.1 顶栏 .og-who 换人按钮 + 1.2 玩一局 + 1.3 仅手动刷新 + 1.4 紧凑折叠条 + 1.5 双模对话抽屉）
  mountGame: function (kind, ch) {
    var self = this;
    // 先彻底移除旧 .og-game-page（确保换人时旧 iframe 与抽屉状态彻底销毁重建）
    var oldPages = document.querySelectorAll('.og-game-page');
    for (var i = 0; i < oldPages.length; i++) {
      oldPages[i].remove();
    }
    this.resetRuntimeState(kind, ch);

    var page = document.createElement('div');
    page.className = 'og-game-page og-' + kind;

    var playBtnLabel = kind === 'bar' ? '玩一局' : '开罐操作';
    var playSheetTitle = kind === 'bar' ? '酒馆赌桌 · 玩一局' : '因果律软糖罐 · 交互面板';

    page.innerHTML =
      '<div class="og-topbar">' +
        '<button class="og-back" type="button" data-og-back>' +
          '<span class="og-icon-back"></span>' +
          '<span>返回</span>' +
        '</button>' +
        '<button class="og-who" type="button" data-og-switch-buddy title="点击切换陪伴角色">' +
          this.avatarHtml(ch, 'og-who-avatar') +
          '<span class="og-who-name">' + this.esc(ch && ch.name || '玩伴') + '</span>' +
          '<span class="og-who-switch">换人</span>' +
        '</button>' +
        '<div class="og-actions">' +
          '<button class="og-act" type="button" data-og-act="look">看看</button>' +
          '<button class="og-act og-act-primary" type="button" data-og-act="act">让Ta行动</button>' +
          '<button class="og-act og-act-accent" type="button" data-og-act="play">' + playBtnLabel + '</button>' +
          '<button class="og-act og-act-chat" type="button" data-og-act="chat">对话</button>' +
          '<button class="og-act og-act-icon" type="button" data-og-act="refresh" title="手动刷新画面">刷新</button>' +
        '</div>' +
      '</div>' +
      '<div class="og-status-strip" data-og-strip>' +
        '<div class="og-bubble" data-og-bubble>' +
          '<span class="og-bubble-ava-wrap" data-og-bubble-avatar>' + this.avatarHtml(ch, 'og-status-ava') + '</span>' +
          '<span class="og-bubble-text" data-og-bubble-text>' +
            '<span class="og-bubble-pending">已就绪，点「玩一局」「对话」或「让Ta行动」与 ' + this.esc(ch && ch.name || 'Ta') + ' 互动</span>' +
          '</span>' +
          '<button class="og-strip-toggle" type="button" data-og-strip-toggle aria-label="展开或折叠详情">' +
            '<span class="og-chevron"></span>' +
          '</button>' +
        '</div>' +
        '<div class="og-note" data-og-note hidden>' +
          '<span class="og-note-badge">结算</span>' +
          '<span class="og-note-text" data-og-note-text></span>' +
        '</div>' +
      '</div>' +
      '<iframe class="og-frame" src="' + this.esc(this.gameUrl(kind)) + '" title="游戏"></iframe>' +
      '<div class="og-sheet-mask" data-og-mask hidden></div>' +
      '<section class="og-sheet og-play-sheet" data-og-sheet="play" hidden>' +
        '<header class="og-sheet-head">' +
          '<div class="og-sheet-title-wrap">' +
            '<span class="og-sheet-handle"></span>' +
            '<h3 class="og-sheet-title">' + this.esc(playSheetTitle) + '</h3>' +
          '</div>' +
          '<button class="og-sheet-close" type="button" data-og-sheet-close>关闭</button>' +
        '</header>' +
        '<div class="og-sheet-body" data-og-play-body></div>' +
      '</section>' +
      '<section class="og-sheet og-chat-sheet" data-og-sheet="chat" data-chat-mode="online" hidden>' +
        '<header class="og-sheet-head og-chat-head">' +
          '<div class="og-chat-partner">' +
            this.avatarHtml(ch, 'og-chat-head-ava') +
            '<div class="og-chat-partner-meta">' +
              '<div class="og-chat-partner-name">' + this.esc(ch && ch.name || '玩伴') + '</div>' +
              '<div class="og-chat-partner-sub" data-og-chat-mode-hint>线上 · 微信气泡即时聊天模式（番外零记忆）</div>' +
            '</div>' +
          '</div>' +
          '<div class="og-chat-head-right">' +
            '<div class="og-mode-switch" role="group" aria-label="切换线上或线下对话模式">' +
              '<button type="button" class="og-mode-btn is-active" data-og-chat-mode="online">线上微信</button>' +
              '<button type="button" class="og-mode-btn" data-og-chat-mode="offline">线下想见你</button>' +
            '</div>' +
            '<button class="og-sheet-close" type="button" data-og-sheet-close>收起</button>' +
          '</div>' +
        '</header>' +
        '<div class="miss-body og-chat-body">' +
          '<div class="miss-chat og-chat-view">' +
            '<div class="miss-chat-log og-chat-log" data-og-chat-log></div>' +
          '</div>' +
        '</div>' +
        '<div class="miss-compose og-miss-compose">' +
          '<input type="text" class="miss-input" maxlength="300" placeholder="和 ' + this.esc(ch && ch.name || 'Ta') + ' 说点什么...">' +
          '<button type="button" class="miss-send">发送</button>' +
        '</div>' +
      '</section>';

    document.body.appendChild(page);
    this.bindGamePageEvents(page, kind, ch);
  },

  bindGamePageEvents: function (page, kind, ch) {
    var self = this;

    // 返回大厅
    var backBtn = page.querySelector('[data-og-back]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        self.resetRuntimeState(null, null);
        page.remove();
      });
    }

    // 1.1 顶栏点击角色 (.og-who) 切换陪伴角色：先移除旧 .og-game-page 并重选后重建
    var whoBtn = page.querySelector('[data-og-switch-buddy]');
    if (whoBtn) {
      whoBtn.addEventListener('click', function () {
        self.renderBuddyPick(kind, function (newCh) {
          var existing = document.querySelector('.og-game-page');
          if (existing) existing.remove();
          self.mountGame(kind, newCh);
        });
      });
    }

    // 1.4 就绪条 1 行折叠/展开切换
    var stripEl = page.querySelector('[data-og-strip]');
    var stripToggle = page.querySelector('[data-og-strip-toggle]');
    if (stripToggle && stripEl) {
      stripToggle.addEventListener('click', function () {
        self._state.barExpanded = !self._state.barExpanded;
        if (self._state.barExpanded) {
          stripEl.classList.add('is-expanded');
        } else {
          stripEl.classList.remove('is-expanded');
        }
      });
    }

    // 顶栏功能按钮：看看 / 让Ta行动 / 玩一局 / 对话 / 刷新
    var actBtns = page.querySelectorAll('[data-og-act]');
    for (var i = 0; i < actBtns.length; i++) {
      actBtns[i].addEventListener('click', function () {
        var actType = this.getAttribute('data-og-act');
        if (actType === 'look') {
          self.letTaLook(kind, ch, page);
        } else if (actType === 'act') {
          self.letTaAct(kind, ch, page);
        } else if (actType === 'play') {
          self.openPlaySheet(page);
        } else if (actType === 'chat') {
          self.openChatSheet(page);
        } else if (actType === 'refresh') {
          self.refreshFrame(page);
        }
      });
    }

    // 遮罩与抽屉关闭按钮
    var mask = page.querySelector('[data-og-mask]');
    if (mask) {
      mask.addEventListener('click', function () {
        self.closeSheets(page);
      });
    }
    var closeBtns = page.querySelectorAll('[data-og-sheet-close]');
    for (var j = 0; j < closeBtns.length; j++) {
      closeBtns[j].addEventListener('click', function () {
        self.closeSheets(page);
      });
    }

    // 「玩一局」面板内事件委托
    var playBody = page.querySelector('[data-og-play-body]');
    if (playBody) {
      playBody.addEventListener('click', function (ev) {
        var target = ev.target.closest('button');
        if (!target) return;
        var f = self._state.playForm;

        // 切换输入前先保存可能已输入的文本
        var entriesArea = playBody.querySelector('[data-og-wheel-entries]');
        if (entriesArea) f.entriesText = entriesArea.value;
        var customInp = playBody.querySelector('[data-og-custom-text]');
        if (customInp) f.text = customInp.value;
        var candyMsgInp = playBody.querySelector('[data-og-candy-msg]');
        if (candyMsgInp) f.candyMessage = candyMsgInp.value;

        if (target.hasAttribute('data-og-play-tab')) {
          f.tab = target.getAttribute('data-og-play-tab');
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-game')) {
          f.game = target.getAttribute('data-og-game');
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-mode')) {
          f.mode = Number(target.getAttribute('data-og-mode')) === 3 ? 3 : 1;
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-wager')) {
          f.wager = target.getAttribute('data-og-wager');
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-drink')) {
          f.drink = target.getAttribute('data-og-drink');
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-wheel-preset')) {
          var pIdx = Number(target.getAttribute('data-og-wheel-preset')) || 0;
          f.wheelPresetIdx = pIdx;
          if (self.WHEEL_PRESETS[pIdx]) {
            f.entriesText = self.WHEEL_PRESETS[pIdx].entries.join('\n');
          }
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-cup')) {
          f.cup = Number(target.getAttribute('data-og-cup')) || 1;
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-candy-act')) {
          f.candyAction = target.getAttribute('data-og-candy-act');
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-candy-idx')) {
          f.candyIndex = Number(target.getAttribute('data-og-candy-idx')) || 1;
          self.renderPlaySheetBody(page);
        } else if (target.hasAttribute('data-og-play-submit')) {
          self.submitPlayForm(page);
        }
      });
    }

    // 「对话」抽屉：切换线上微信模式 ↔ 线下想见你模式
    var modeBtns = page.querySelectorAll('[data-og-chat-mode]');
    for (var k = 0; k < modeBtns.length; k++) {
      modeBtns[k].addEventListener('click', function () {
        var nextMode = this.getAttribute('data-og-chat-mode');
        self._state.chatMode = nextMode === 'offline' ? 'offline' : 'online';
        self.syncChatSheetMode(page);
        self.renderChatMessages(page);
      });
    }

    // 「对话」抽屉：发送按钮 (.miss-send) 与回车发送 (.miss-input)
    var sendBtn = page.querySelector('.miss-send');
    var chatInput = page.querySelector('.miss-input');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        self.sendChatMessage(page);
      });
    }
    if (chatInput) {
      chatInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          self.sendChatMessage(page);
        }
      });
    }
  },

  open: async function (kind, opts) {
    var self = this;
    opts = opts || {};
    if (!window._wechatUid && !opts.loggedIn) {
      try {
        if (window.db && window.db.config) {
          var savedUid = await window.db.config.get('wechatUid');
          if (savedUid && savedUid.value) {
            window._wechatUid = savedUid.value;
          }
        }
      } catch (e) {}
    }
    if (!window._wechatUid && !opts.loggedIn) {
      this.renderLogin(kind, function () {
        self.open(kind, { loggedIn: true });
      });
      return;
    }
    var ch = await this.getBuddy(kind);
    if (ch) {
      this.mountGame(kind, ch);
    } else {
      this.renderBuddyPick(kind, function (picked) {
        self.mountGame(kind, picked);
      });
    }
  }
};

window.showBarOrigPage = function (opts) {
  window.OrigGames.open('bar', opts);
};

window.showCandyOrigPage = function (opts) {
  window.OrigGames.open('candy', opts);
};
