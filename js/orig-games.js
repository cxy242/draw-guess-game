window.OrigGames = {
  BAR_PORT: 8766,
  CANDY_PORT: 8765,
  BAR_API: '/bar-api/',
  CANDY_API: '/candy-api/',
  UNLOCK_NOTE: '番外小游戏：游戏内知情，游戏外零记忆',

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

  avatarHtml: function (ch, cls) {
    var src = ch && (ch.avatar || ch.avatarUrl || ch.photo || ch.image || '');
    var name = this.esc(ch && ch.name);
    return src
      ? '<img class="' + cls + '" src="' + this.esc(src) + '" alt="' + name + '">'
      : '<span class="' + cls + ' ' + cls + '-empty">' + this.esc((ch && ch.name || '?').slice(0, 1)) + '</span>';
  },

  getBuddies: async function () {
    var table = window.db && window.db.characters;
    if (!table) return [];
    var rows = [];
    try {
      rows = await table.where('type').notEqual('user').toArray();
    } catch (e) {
      try {
        rows = await table.toArray();
      } catch (e2) {
        return [];
      }
    }
    return rows.filter(function (r) {
      return r && r.id !== 'user' && String(r.id) !== 'user' &&
        r.type !== 'user' && r.role !== 'user' && !r.isUser;
    });
  },

  getUserAccounts: async function () {
    var table = window.db && window.db.characters;
    if (!table) return [];
    var rows = [];
    try {
      rows = await table.where('type').equals('user').toArray();
    } catch (e) {
      try {
        rows = await table.toArray();
      } catch (e2) {
        return [];
      }
    }
    return rows.filter(function (r) {
      return r && (r.type === 'user' || r.role === 'user');
    });
  },

  getBuddy: async function (kind) {
    try {
      var rec = await window.db.config.get(kind === 'bar' ? 'barBuddyId' : 'candyBuddyId');
      var id = rec && rec.value;
      if (id != null) {
        var rows = await this.getBuddies();
        for (var i = 0; i < rows.length; i++) {
          if (String(rows[i].id) === String(id)) return rows[i];
        }
      }
    } catch (e) {}
    return null;
  },

  saveBuddy: async function (kind, ch) {
    try {
      await window.db.config.put({ key: kind === 'bar' ? 'barBuddyId' : 'candyBuddyId', value: ch.id });
    } catch (e) {}
  },

  tempContext: async function (ch) {
    var parts = [];
    try {
      if (window.db && window.db.messages && ch) {
        var msgs = await window.db.messages.toArray();
        var mine = msgs.filter(function (m) {
          return m && (String(m.charId) === String(ch.id) || String(m.senderId) === String(ch.id) ||
            (m.chatId && String(m.chatId).indexOf(String(ch.id)) >= 0));
        }).slice(-20);
        if (mine.length) {
          var lines = mine.map(function (m) {
            var who = m.role === 'user' || m.from === 'user' ? '用户' : (ch.name || 'Ta');
            return who + '：' + String(m.text || m.content || '').slice(0, 60);
          });
          parts.push('【最近聊天（只读）】\n' + lines.join('\n'));
        }
      }
    } catch (e) {}
    try {
      if (window.getRelationshipContext && ch) {
        var rel = await window.getRelationshipContext(ch.id);
        if (rel) parts.push('【关系现状（只读）】\n' + String(rel).slice(0, 300));
      }
    } catch (e) {}
    if (!parts.length) parts.push('【最近聊天】（暂无记录）');
    parts.push('【番外提示】这是游戏时间，游戏结束后你不会保留这里的记忆。');
    return parts.join('\n\n');
  },

  parseJson: function (text) {
    var s = String(text || '');
    var attempts = [];
    var depth = 0;
    var start = -1;
    for (var i = 0; i < s.length; i++) {
      if (s.charAt(i) === '{') {
        if (depth === 0) start = i;
        depth++;
      } else if (s.charAt(i) === '}') {
        depth--;
        if (depth === 0 && start >= 0) attempts.push(s.slice(start, i + 1));
      }
    }
    for (var j = attempts.length - 1; j >= 0; j--) {
      try {
        return JSON.parse(attempts[j]);
      } catch (e) {}
    }
    try {
      return JSON.parse(s);
    } catch (e) {}
    return null;
  },

  askBuddy: async function (kind, ch, system, prompt) {
    var ctx = await this.tempContext(ch);
    var persona = (ch && (ch.description || (ch.identity && ch.identity.bio) || ch.signature)) || '';
    var sys = '你是「' + this.esc(ch && ch.name) + '」。' + this.esc(persona) + '\n\n' + ctx +
      '\n\n只输出 JSON，不要多余文字。';
    try {
      var raw = await window.callGameAI([{ role: 'user', content: prompt }], {
        system: sys,
        temperature: 0.9,
        charAntiDrift: true
      });
      return this.parseJson(raw) || { say: String(raw || '').slice(0, 120) };
    } catch (e) {
      return { say: '（' + (ch && ch.name || 'Ta') + '想了想，没说话）' };
    }
  },

  refreshFrame: function (page) {
    var f = page && page.querySelector('.og-frame');
    if (f) f.src = f.src;
  },

  logLine: function (page, html) {
    var strip = page && page.querySelector('.og-bubble');
    if (strip) strip.innerHTML = html;
  },

  letTaLook: async function (kind, ch, page) {
    var self = this;
    self.logLine(page, '<span class="og-bubble-pending">' + self.esc(ch.name) + '看了看周围……</span>');
    var lookText = '';
    try {
      if (kind === 'bar') {
        var r = await fetch(this.BAR_API + 'bar/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'bar_look', input: {} })
        });
        if (!r.ok) throw new Error('http ' + r.status);
        var d = await r.json();
        lookText = d && d.result ? String(d.result) : '';
      } else {
        var r2 = await fetch(this.CANDY_API + 'candyjar/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'look' })
        });
        if (!r2.ok) throw new Error('http ' + r2.status);
        lookText = await r2.text();
      }
    } catch (e) {
      lookText = '';
    }
    var prompt = '你正在游戏里看眼前的场景。游戏视角描述：\n' + (lookText || '（看不到特别的）') +
      '\n\n以你的性格自然地说一句话（可以吐槽、可以心动、可以撒娇），并顺手看一眼。' +
      '\n输出 JSON：{"say":"你的话","tool":"bar_look"}（糖果罐写 "tool":"candy_look"）';
    var ans = await this.askBuddy(kind, ch, null, prompt);
    self.logLine(page, this.avatarHtml(ch, 'og-bubble-avatar') +
      '<div class="og-bubble-copy"><strong>' + this.esc(ch.name) + '</strong><span>' +
      this.esc(ans.say || '……') + '</span></div>');
    self.refreshFrame(page);
  },

  letTaAct: async function (kind, ch, page) {
    var self = this;
    self.logLine(page, '<span class="og-bubble-pending">' + self.esc(ch.name) + '想了想……</span>');
    var stateText = '';
    try {
      var url = kind === 'bar' ? this.BAR_API + 'bar/context' : this.CANDY_API + 'candyjar/look';
      var r = await fetch(url);
      if (!r.ok) throw new Error('http ' + r.status);
      stateText = await r.text();
    } catch (e) {}
    var prompt = kind === 'bar'
      ? '游戏现状：\n' + String(stateText).slice(0, 1200) +
        '\n\n你决定做一个动作并说一句话。工具三选一：' +
        '\n- bar_drink：给自己点一杯喝（input: {"drink":"真实酒名"}）' +
        '\n- bar_game：发起一局游戏（input: {"kind":"dice"或"hands"或"wheel","round_id":"唯一串"}）' +
        '\n- bar_look：只是看看' +
        '\n输出 JSON：{"say":"你的话","tool":"bar_drink|bar_game|bar_look","input":{...}}'
      : '软糖罐现状：\n' + String(stateText).slice(0, 1200) +
        '\n\n你决定做一个动作并说一句话。动作四选一：' +
        '\n- eat：吃一颗糖（input: {"action":"eat","index":糖的编号}）' +
        '\n- feed：喂用户一颗糖（input: {"action":"feed","index":编号,"message":"附言"}）' +
        '\n- dex：翻图鉴（input: {"action":"dex"}）' +
        '\n- look：只是看看（input: {"action":"look"}）' +
        '\n输出 JSON：{"say":"你的话","tool":"eat|feed|dex|look","input":{...}}';
    var ans = await this.askBuddy(kind, ch, null, prompt);
    var resultText = '';
    try {
      if (kind === 'bar') {
        var tool = ['bar_drink', 'bar_game', 'bar_look'].indexOf(ans.tool) >= 0 ? ans.tool : 'bar_look';
        var r1 = await fetch(this.BAR_API + 'bar/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: tool, input: ans.input || {} })
        });
        if (!r1.ok) throw new Error('http ' + r1.status);
        var d1 = await r1.json();
        resultText = d1 && d1.result ? String(d1.result) : '';
      } else {
        var act = ['eat', 'feed', 'dex', 'look'].indexOf(ans.tool) >= 0 ? ans.tool : 'look';
        var body = Object.assign({}, ans.input || {}, { action: act });
        var r2 = await fetch(this.CANDY_API + 'candyjar/ai', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!r2.ok) throw new Error('http ' + r2.status);
        resultText = await r2.text();
      }
    } catch (e) {
      resultText = '';
    }
    self.logLine(page, this.avatarHtml(ch, 'og-bubble-avatar') +
      '<div class="og-bubble-copy"><strong>' + this.esc(ch.name) + '</strong><span>' +
      this.esc(ans.say || '……') + '</span></div>');
    if (resultText) {
      var note = page.querySelector('.og-note');
      if (note) note.textContent = resultText.slice(0, 200);
    }
    self.refreshFrame(page);
  },

  renderLogin: function (kind, next) {
    var self = this;
    var old = document.querySelector('.og-gate-page');
    if (old) old.remove();
    var page = document.createElement('div');
    page.className = 'og-gate-page og-' + kind;
    page.innerHTML =
      '<div class="og-gate-shell">' +
        '<div class="og-gate-mark"><span class="og-gate-lock" aria-hidden="true"></span></div>' +
        '<h1 class="og-gate-title">登录微信</h1>' +
        '<p class="og-gate-subtitle">选择微信账号继续</p>' +
        '<button class="og-gate-wechat" type="button" data-og-login>通过微信登录</button>' +
        '<div class="og-gate-accounts" data-og-accounts hidden></div>' +
      '</div>';
    document.body.appendChild(page);
    page.querySelector('[data-og-login]').addEventListener('click', async function () {
      var box = page.querySelector('[data-og-accounts]');
      if (window._wechatUid) {
        next();
        return;
      }
      if (window.showWechatLoginModal) {
        window.showWechatLoginModal();
        var wait = window.setInterval(function () {
          if (window._wechatUid) {
            window.clearInterval(wait);
            next();
          }
        }, 800);
        return;
      }
      var users = await self.getUserAccounts();
      box.hidden = false;
      box.innerHTML = users.length
        ? users.map(function (u) {
            return '<button class="og-gate-account" type="button" data-og-user="' + self.esc(u.id) + '">' +
              self.avatarHtml(u, 'og-gate-avatar') + '<span>' + self.esc(u.name || '我') + '</span></button>';
          }).join('')
        : '<p class="og-gate-empty">还没有微信账号，先去微信登录一下</p>';
      box.querySelectorAll('[data-og-user]').forEach(function (b) {
        b.addEventListener('click', function () {
          window._wechatUid = b.getAttribute('data-og-user');
          next();
        });
      });
    });
  },

  renderBuddyPick: function (kind, next) {
    var self = this;
    var old = document.querySelector('.og-gate-page');
    if (old) old.remove();
    var page = document.createElement('div');
    page.className = 'og-gate-page og-' + kind;
    document.body.appendChild(page);
    this.getBuddies().then(function (buddies) {
      page.innerHTML =
        '<div class="og-gate-shell og-gate-wide">' +
          '<h1 class="og-gate-title">选一位玩伴</h1>' +
          '<p class="og-gate-subtitle">' + (kind === 'bar' ? '今晚谁陪你喝酒' : '谁来跟你开糖罐') + '</p>' +
          (buddies.length
            ? '<div class="og-buddy-grid">' + buddies.map(function (ch) {
                return '<button class="og-buddy-card" type="button" data-og-buddy="' + self.esc(ch.id) + '">' +
                  self.avatarHtml(ch, 'og-buddy-avatar') +
                  '<span class="og-buddy-name">' + self.esc(ch.name || '？') + '</span></button>';
              }).join('') + '</div>'
            : '<p class="og-gate-empty">还没有聊天角色，先去微信聊几句再回来</p>');
      page.querySelectorAll('[data-og-buddy]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-og-buddy');
          var ch = buddies.filter(function (x) { return String(x.id) === String(id); })[0];
          if (ch) {
            self.saveBuddy(kind, ch).then(function () {
              page.remove();
              next(ch);
            });
          }
        });
      });
    });
  },

  mountGame: function (kind, ch) {
    var self = this;
    var old = document.querySelector('.og-game-page');
    if (old) old.remove();
    var page = document.createElement('div');
    page.className = 'og-game-page og-' + kind;
    page.innerHTML =
      '<div class="og-topbar">' +
        '<button class="og-back" type="button" data-og-back>返回</button>' +
        '<div class="og-who">' + this.avatarHtml(ch, 'og-who-avatar') +
          '<span>' + this.esc(ch.name || '玩伴') + '</span></div>' +
        '<div class="og-actions">' +
          '<button class="og-act" type="button" data-og-act="look">看看</button>' +
          '<button class="og-act og-act-primary" type="button" data-og-act="act">让Ta行动</button>' +
          '<button class="og-act" type="button" data-og-act="refresh">刷新</button>' +
        '</div>' +
      '</div>' +
      '<div class="og-bubble" data-og-bubble>' +
        '<span class="og-bubble-pending">游戏开始了，点「让Ta行动」让 ' + this.esc(ch.name || 'Ta') + ' 开口</span>' +
      '</div>' +
      '<iframe class="og-frame" src="' + this.esc(this.gameUrl(kind)) + '" title="游戏"></iframe>' +
      '<div class="og-note" data-og-note hidden></div>';
    document.body.appendChild(page);

    page.querySelector('[data-og-back]').addEventListener('click', function () {
      page.remove();
    });
    page.querySelector('[data-og-act="refresh"]').addEventListener('click', function () {
      self.refreshFrame(page);
    });
    page.querySelector('[data-og-act="look"]').addEventListener('click', function () {
      self.letTaLook(kind, ch, page);
    });
    page.querySelector('[data-og-act="act"]').addEventListener('click', function () {
      self.letTaAct(kind, ch, page);
    });
  },

  open: async function (kind) {
    var self = this;
    if (!window._wechatUid) {
      self.renderLogin(kind, function () {
        self.open(kind);
      });
      return;
    }
    var ch = await this.getBuddy(kind);
    if (ch) {
      this.mountGame(kind, ch);
      return;
    }
    this.renderBuddyPick(kind, function (picked) {
      self.mountGame(kind, picked);
    });
  }
};

window.showBarOrigPage = function () {
  window.OrigGames.open('bar');
};

window.showCandyOrigPage = function () {
  window.OrigGames.open('candy');
};
