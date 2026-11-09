window.BarAI = {
  fallbacks: {
    drink: [
      { drink: true, reply: '这杯来得正好，我接下。' },
      { drink: true, reply: '先放在这里，我陪你慢慢喝。' },
      { drink: true, reply: '好，这一杯我记下了。' },
      { drink: false, reply: '今晚先到这里，我把清醒留给改天。' }
    ],
    dice: [
      { me: 3, reply: '这局就看骰子肯不肯给我面子。' },
      { me: 5, reply: '我押这一口，点数别让我失望。' },
      { me: 2, reply: '小一点，留着清醒看你笑。' }
    ],
    rps: [
      { me: 0, reply: '先出石头，看看你这次会不会猜我。' },
      { me: 1, reply: '这张纸，刚好包住你的心思。' },
      { me: 2, reply: '我出剪刀，输赢都算今晚的。' }
    ],
    wheel: [
      { accept: true, reply: '停在哪里都算数，我认这一格。' },
      { accept: true, reply: '轮盘落定，今晚不耍赖。' },
      { accept: true, reply: '好，就按它说的来。' },
      { accept: false, reply: '这一格我不接，换个轻一点的来。' }
    ],
    flightPick: [
      { pick: 1, reply: '我先拿最左边那杯，凭第一眼。' },
      { pick: 3, reply: '中间那杯像藏着话，我选它。' },
      { pick: 6, reply: '最后一杯留到最后，反而像答案。' }
    ]
  },
  randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  },
  randomPick(values) {
    return values[Math.floor(Math.random() * values.length)];
  },
  safeText(value, limit = 180) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, limit);
  },
  parseCharacterId(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  },
  parseResult(raw) {
    let candidate = raw;
    if (candidate && typeof candidate === 'object') {
      candidate = candidate.result || candidate.data || candidate.content || candidate.text || candidate.reply;
    }
    if (candidate && typeof candidate === 'object') return candidate;
    const text = this.safeText(candidate, 8000).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (error) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch (nestedError) {
        return null;
      }
    }
  },

  async getSelectedCharacter() {
    const state = window.BarCore && typeof window.BarCore.getState === 'function'
      ? window.BarCore.getState()
      : null;
    const characterId = this.parseCharacterId(state && state.companionId);
    if (characterId === null) return null;
    const table = window.db && window.db.characters;
    if (!table) return null;
    try {
      if (typeof table.get === 'function') {
        const direct = await table.get(characterId);
        if (direct) return direct;
      }
      const rows = await table.toArray();
      return rows.find((row) => this.parseCharacterId(row.id) === characterId) || null;
    } catch (error) {
      return null;
    }
  },

  async getRecentMessages(character) {
    const table = window.db && window.db.messages;
    const characterId = character && this.parseCharacterId(character.id);
    if (!table || characterId === null || typeof table.where !== 'function') return [];
    const fields = ['charId', 'characterId', 'peerId', 'contactId'];
    for (const field of fields) {
      try {
        let collection = table.where(field).equals(characterId);
        if (collection.reverse && collection.limit) collection = collection.reverse().limit(20);
        const rows = await collection.toArray();
        if (rows.length) return rows.slice(-20);
      } catch (error) {
        continue;
      }
    }
    return [];
  },
  messageText(message) {
    return this.safeText(
      message && (message.content || message.text || message.message || message.body || message.value),
      180
    );
  },

  async buildTempContext(options = {}) {
    const character = options.character || await this.getSelectedCharacter();
    const characterName = character && character.name ? character.name : 'Ta';
    const recentMessages = await this.getRecentMessages(character);
    const chatSummary = recentMessages.length
      ? recentMessages.map((message) => {
        const speaker = message.role === 'user' || message.isUser ? '你' : characterName;
        return speaker + '：' + this.messageText(message);
      }).filter((line) => !line.endsWith('：')).join('；')
      : '暂无可见的最近聊天。';
    const relationSummary = await this.getRelationSummary(character);
    const lastGame = this.getLastGameSummary();
    return [
      '最近聊天摘要（只读）：' + this.safeText(chatSummary, 2200),
      '关系现状（只读）：' + relationSummary,
      '上次游戏摘要（只读）：' + lastGame
    ].join('\n');
  },

  async getRelationSummary(character) {
    const characterId = character && this.parseCharacterId(character.id);
    const userId = this.parseCharacterId(window._wechatUid);
    let relation = null;
    try {
      if (characterId !== null && typeof window.getRelationshipContext === 'function') {
        relation = await window.getRelationshipContext(characterId);
      } else if (characterId !== null && userId !== null && typeof window.getRelationBetween === 'function') {
        relation = await window.getRelationBetween(userId, characterId);
      }
    } catch (error) {
      relation = null;
    }
    if (!relation || typeof relation !== 'object') return '暂无可见的关系数据。';
    const relationName = relation.relationship || relation.relationName || relation.relation || relation.name;
    const intimacy = relation.intimacy ?? relation.closeness ?? relation.level;
    const parts = [];
    if (relationName) parts.push('关系为' + this.safeText(relationName, 40));
    if (intimacy !== undefined && intimacy !== null) parts.push('亲密度/等级为' + this.safeText(intimacy, 24));
    return parts.length ? parts.join('，') + '。' : '暂无可见的关系数据。';
  },
  getLastGameSummary() {
    const state = window.BarCore && typeof window.BarCore.getState === 'function'
      ? window.BarCore.getState()
      : null;
    const history = state && Array.isArray(state.history) ? state.history : [];
    const ledger = state && Array.isArray(state.ledger) ? state.ledger : [];
    const last = history[history.length - 1] || ledger[ledger.length - 1];
    if (!last) return '今晚还没有上一次游戏记录。';
    const summary = last.summary || last.description || last.result || last.text || last.type;
    return this.safeText(summary || JSON.stringify(last), 280);
  },
  getDrunkPersona() {
    const state = window.BarCore && typeof window.BarCore.getState === 'function'
      ? window.BarCore.getState()
      : null;
    const data = window.BarCore && window.BarCore.data;
    const tiers = data && Array.isArray(data.tiers && data.tiers.tiers) ? data.tiers.tiers : [];
    const drunkness = Number(state && state.drunkness) || 0;
    let tier = tiers[tiers.length - 1] || {
      name: '微醺',
      style: '说话比平时更直接，句子更松，会绕远再绕回来。'
    };
    for (const item of tiers) {
      if (drunkness >= Number(item.threshold || 0)) tier = item;
    }
    const drinks = state && Array.isArray(state.ledger)
      ? state.ledger.filter((item) => item.kind === 'drink' && item.drinkName).slice(-8)
      : [];
    const drinkList = drinks.length
      ? drinks.map((item) => item.drinkName).join('、')
      : '今晚暂时没有记录到酒单';
    return {
      name: tier.name,
      style: tier.style,
      drinks: drinkList,
      text: '你现在是「' + tier.name + '」。说话风格：' + tier.style +
        '。刚才你喝了：' + drinkList + '。记住规矩三：醉话不作为日后吵架证据。'
    };
  },
  normalizeDecision(kind, raw, context) {
    const result = this.parseResult(raw);
    if (!result || typeof result !== 'object') return null;
    const reply = this.safeText(result.reply, 240);
    if (!reply) return null;
    if (kind === 'dice') {
      const value = parseInt(result.me, 10);
      return value >= 1 && value <= 6 ? { me: value, reply } : null;
    }
    if (kind === 'rps') {
      const value = parseInt(result.me, 10);
      return value >= 0 && value <= 2 ? { me: value, reply } : null;
    }
    if (kind === 'wheel') return typeof result.accept === 'boolean' ? { accept: result.accept, reply } : null;
    if (kind === 'flightPick') {
      const available = Array.isArray(context.available) && context.available.length ? context.available : [1, 2, 3, 4, 5, 6];
      const pick = parseInt(result.pick, 10);
      return available.map(Number).includes(pick) ? { pick, reply } : null;
    }
    return typeof result.drink === 'boolean' ? { drink: result.drink, reply } : null;
  },
  fallback(kind, context = {}) {
    const pool = this.fallbacks[kind] || this.fallbacks.wheel;
    if (kind === 'flightPick') {
      const available = Array.isArray(context.available) && context.available.length ? context.available : [1, 2, 3, 4, 5, 6];
      return { pick: this.randomPick(available.map(Number)), reply: this.randomItem(pool).reply };
    }
    return Object.assign({}, this.randomItem(pool));
  },
  showFallbackToast() {
    if (typeof window.toast === 'function') window.toast('Ta 想了想');
    else if (typeof window.barGameToast === 'function') window.barGameToast('Ta 想了想');
  },

  async gameDecision(messages, options = {}) {
    const context = options.context || {};
    const kind = options.decision || context.kind || 'drink';
    try {
      const character = await this.getSelectedCharacter();
      const tempContext = await this.buildTempContext({ character });
      const system = '你正在「和小机喝一杯」游戏内。' + this.getDrunkPersona().text +
        '\n游戏内临时知情：\n' + tempContext +
        '\n只输出一个 JSON 对象。骰子用 me=1..6，猜拳用 me=0..2，轮盘用 accept=true/false，盲品用 pick，递酒用 drink=true/false；所有结果都带 reply。';
      const raw = await window.callGameAI(messages, {
        system,
        temperature: 0.9,
        charAntiDrift: true
      });
      const normalized = this.normalizeDecision(kind, raw, context);
      if (normalized) return normalized;
    } catch (error) {
      this.showFallbackToast();
    }
    this.showFallbackToast();
    return this.fallback(kind, context);
  },

  async onDrinkOffered(payload = {}) {
    const messages = [{ role: 'user', content: JSON.stringify(Object.assign({ kind: 'drink' }, payload)) }];
    return this.gameDecision(messages, { decision: 'drink', context: payload, charAntiDrift: true, temperature: 0.9 });
  }
};
