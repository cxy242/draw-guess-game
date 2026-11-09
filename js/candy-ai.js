window.CandyAI = {
  fallbacks: {
    eat: [
      { reply: '这一口落在什么味道上，我想听你形容。' },
      { reply: '先别急着说，我等舌头把答案慢慢交出来。' },
      { reply: '你吃下的这颗，像把今晚的语气换了个频道。' }
    ],
    feed: [
      { reply: '好，我接住了。你先看我怎么把它演完。' },
      { reply: '这颗来得巧，我正好需要一点不一样的声音。' },
      { reply: '我吃下了，接下来如果话说得奇怪，你要负责。' }
    ],
    status: [
      { reply: '这个频道开着，我会顺着它的规矩说话。' },
      { reply: '我正把这股劲演到刚好三分，剩下的留给你猜。' },
      { reply: '药效没写完我这句，我替它把停顿补上。' }
    ]
  },
  randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
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
    if (candidate && typeof candidate === 'object') candidate = candidate.result || candidate.data || candidate.content || candidate.text || candidate.reply;
    if (candidate && typeof candidate === 'object') return candidate;
    const text = this.safeText(candidate, 8000).replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    if (!text) return null;
    try { return JSON.parse(text); } catch (error) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try { return JSON.parse(match[0]); } catch (nestedError) { return null; }
    }
  },
  async getBuddyId() {
    if (window._candyBuddyId != null) return this.parseCharacterId(window._candyBuddyId);
    try {
      const record = await window.db.config.get('candyBuddyId');
      return this.parseCharacterId(record && (record.value ?? record.candyBuddyId ?? record.id));
    } catch (error) {
      return null;
    }
  },
  async getSelectedCharacter() {
    const characterId = await this.getBuddyId();
    if (characterId === null) return null;
    const table = window.db && window.db.characters;
    if (!table) return null;
    try {
      const direct = await table.get(characterId);
      if (direct) return direct;
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
    for (const field of ['charId', 'characterId', 'peerId', 'contactId']) {
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
    return this.safeText(message && (message.content || message.text || message.message || message.body || message.value), 180);
  },
  async getRelationSummary(character) {
    const characterId = character && this.parseCharacterId(character.id);
    const userId = this.parseCharacterId(window._wechatUid);
    let relation = null;
    try {
      if (characterId !== null && typeof window.getRelationshipContext === 'function') relation = await window.getRelationshipContext(characterId);
      else if (characterId !== null && userId !== null && typeof window.getRelationBetween === 'function') relation = await window.getRelationBetween(userId, characterId);
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
    const state = window.CandyCore && typeof window.CandyCore.getState === 'function' ? window.CandyCore.getState() : null;
    const ledger = state && Array.isArray(state.ledger) ? state.ledger : [];
    const last = ledger.find((item) => item.type !== 'jar-switch' && item.type !== 'jar-open') || ledger[0];
    return last ? this.safeText(last.text || JSON.stringify(last), 280) : '上一次还没留下糖罐账本。';
  },
  getCandyForEffect(effect) {
    return window.CandyCore && typeof window.CandyCore.getCandy === 'function' ? window.CandyCore.getCandy(effect.candyId) : null;
  },
  getCandyPersona() {
    const core = window.CandyCore;
    const effects = core && typeof core.getActiveEffects === 'function' ? core.getActiveEffects() : [];
    if (!effects.length) return '当前没有进行中的药效，保持角色平时的语气。';
    return effects.map((effect) => {
      const candy = this.getCandyForEffect(effect);
      const instructions = Array.isArray(candy && candy.instruction) ? candy.instruction.slice(0, 3).join('；') : '';
      const examples = Array.isArray(candy && candy.examples) ? candy.examples.slice(0, 3).join('；') : '';
      return '药效「' + this.safeText(candy && (candy.label || candy.name), 60) + '」生效中，演法：' +
        this.safeText(candy && candy.reveal, 180) + '。指令：' + this.safeText(instructions, 360) +
        '。例句话风：' + this.safeText(examples, 360) + '。';
    }).join('\n');
  },
  async buildTempContext(options = {}) {
    const character = options.character || await this.getSelectedCharacter();
    const characterName = character && character.name ? character.name : 'Ta';
    const messages = await this.getRecentMessages(character);
    const chat = messages.length ? messages.map((message) => {
      const speaker = message.role === 'user' || message.isUser ? '你' : characterName;
      return speaker + '：' + this.messageText(message);
    }).filter((line) => !line.endsWith('：')).join('；') : '暂无可见的最近聊天。';
    return [
      '最近聊天摘要（只读）：' + this.safeText(chat, 2200),
      '关系现状（只读）：' + await this.getRelationSummary(character),
      '上次游戏摘要（只读）：' + this.getLastGameSummary()
    ].join('\n');
  },
  normalizeDecision(raw) {
    const result = this.parseResult(raw);
    const reply = result && this.safeText(result.reply, 260);
    return reply ? { reply } : null;
  },
  showFallbackToast() {
    if (typeof window.toast === 'function') window.toast('Ta 想了想');
  },
  async decision(input = {}) {
    const event = input.event || input.kind || 'status';
    const type = event === 'effect' ? 'status' : event;
    try {
      const character = await this.getSelectedCharacter();
      const tempContext = await this.buildTempContext({ character });
      const system = '你正在「因果律软糖罐」游戏内。' + this.getCandyPersona() +
        '\n游戏内临时知情：\n' + tempContext +
        '\n根据事件' + this.safeText(type, 24) + '，只输出 JSON：{"reply":"角色反应"}。';
      const raw = await window.callGameAI([{ role: 'user', content: JSON.stringify(input) }], {
        system,
        temperature: 0.9,
        charAntiDrift: true
      });
      const normalized = this.normalizeDecision(raw);
      if (normalized) return normalized;
    } catch (error) {
      this.showFallbackToast();
    }
    this.showFallbackToast();
    return { reply: this.randomItem(this.fallbacks[type] || this.fallbacks.status).reply };
  }
};
