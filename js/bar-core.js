window.BarCore = {
  storageKey: 'barGameState.v1',
  configKey: 'barGameConfig',
  data: {
    menu: null,
    tiers: null,
    questions: null,
    candy: null
  },
  state: null,
  listeners: [],
  eventSequence: 0,

  async init() {
    if (this.state) {
      this.applyDecay();
      return this.getState();
    }
    const [menu, tiers, questions, candy] = await Promise.all([
      this.fetchJson('data/bar-menu.json'),
      this.fetchJson('data/bar-tiers.json'),
      this.fetchJson('data/bar-questions.json'),
      this.fetchJson('data/candy-catalog.json')
    ]);
    this.data = { menu, tiers, questions, candy };
    this.state = this.readState();
    await this.readConfig();
    this.applyDecay();
    return this.getState();
  },

  async fetchJson(path) {
    const response = await fetch(path + '?v=6.7.0', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(path + ' 加载失败');
    }
    return response.json();
  },

  defaultState() {
    return {
      version: 1,
      companionId: null,
      nickname: '对方',
      drunkness: 0,
      drinksTonight: 0,
      ledger: [],
      history: [],
      startedAt: null,
      lastDecayAt: Date.now(),
      soberPillUnlocked: false
    };
  },

  readState() {
    const fallback = this.defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (!saved || typeof saved !== 'object') {
        return fallback;
      }
      return Object.assign(fallback, saved, {
        ledger: Array.isArray(saved.ledger) ? saved.ledger : [],
        history: Array.isArray(saved.history) ? saved.history : []
      });
    } catch (error) {
      return fallback;
    }
  },

  async readConfig() {
    try {
      const table = window.db && window.db.config;
      if (!table || typeof table.get !== 'function') {
        return;
      }
      const record = await table.get(this.configKey);
      const config = record && (record.value || record);
      if (config && typeof config === 'object') {
        if (config.companionId !== undefined) {
          this.state.companionId = this.parseCharacterId(config.companionId);
        }
        if (typeof config.nickname === 'string') {
          this.state.nickname = config.nickname.trim() || '对方';
        }
        this.saveState();
      }
    } catch (error) {
      return;
    }
  },

  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
    this.emit();
  },

  async saveConfig() {
    const config = {
      companionId: this.state.companionId,
      nickname: this.state.nickname
    };
    localStorage.setItem(this.configKey, JSON.stringify(config));
    try {
      const table = window.db && window.db.config;
      if (table && typeof table.put === 'function') {
        await table.put({ key: this.configKey, value: config });
      }
    } catch (error) {
      return;
    }
  },

  parseCharacterId(value) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  },

  async getCharacters() {
    const table = window.db && window.db.characters;
    if (!table) {
      return [];
    }
    let records = [];
    try {
      if (typeof table.where === 'function') {
        records = await table.where('id').notEqual('user').toArray();
      } else if (typeof table.toArray === 'function') {
        records = await table.toArray();
      } else if (Array.isArray(table)) {
        records = table.slice();
      }
    } catch (error) {
      try {
        records = await table.toArray();
      } catch (fallbackError) {
        return [];
      }
    }
    return records
      .filter((character) => {
        const identity = String(character.charId ?? character.id ?? '');
        return identity !== 'user';
      })
      .map((character) => Object.assign({}, character, {
        charId: this.parseCharacterId(character.charId ?? character.id)
      }))
      .filter((character) => Number.isFinite(character.charId));
  },

  async getCompanion() {
    if (this.state.companionId === null) {
      return null;
    }
    const characters = await this.getCharacters();
    return characters.find((character) => character.charId === this.state.companionId) || null;
  },

  async selectCompanion(charId) {
    const parsed = this.parseCharacterId(charId);
    if (parsed === null) {
      return false;
    }
    this.state.companionId = parsed;
    this.state.startedAt = this.state.startedAt || Date.now();
    this.saveState();
    await this.saveConfig();
    return true;
  },

  async setNickname(nickname) {
    this.state.nickname = String(nickname || '').trim() || '对方';
    this.saveState();
    await this.saveConfig();
  },

  applyDecay() {
    if (!this.state) {
      return 0;
    }
    const now = Date.now();
    const elapsedHours = Math.max(0, (now - Number(this.state.lastDecayAt || now)) / 3600000);
    const decayPerHour = Number(this.data.tiers && this.data.tiers.decayPerHour || 1);
    const decay = Math.min(this.state.drunkness, elapsedHours * decayPerHour);
    if (decay > 0.0001) {
      this.state.drunkness = Math.max(0, Math.round((this.state.drunkness - decay) * 1000) / 1000);
      this.state.lastDecayAt = now;
      this.saveState();
    }
    return decay;
  },

  getState() {
    this.applyDecay();
    return Object.assign({}, this.state, {
      ledger: this.state.ledger.slice(),
      history: this.state.history.slice()
    });
  },

  getTier() {
    const tiers = this.data.tiers && this.data.tiers.tiers || [];
    const value = this.state ? this.state.drunkness : 0;
    return tiers.slice().reverse().find((tier) => value >= tier.threshold) || tiers[0] || null;
  },

  getTierIndex() {
    const tiers = this.data.tiers && this.data.tiers.tiers || [];
    const current = this.getTier();
    return current ? tiers.findIndex((tier) => tier.id === current.id) : 0;
  },

  canServeDrink() {
    return this.state.drinksTonight < 8;
  },

  recordEvent(type, text, delta, meta) {
    const event = {
      id: 'bar-' + Date.now() + '-' + (++this.eventSequence),
      timestamp: Date.now(),
      type: String(type || 'system'),
      text: String(text || ''),
      delta: Number(delta || 0),
      meta: meta || {}
    };
    this.state.ledger.push(event);
    this.saveState();
    return event;
  },

  offerDrink(drink, message) {
    return this.recordEvent('offer', '递上' + drink.name, 0, {
      drinkId: drink.id,
      message: String(message || '')
    });
  },

  async addDrink(drink, note) {
    if (!this.canServeDrink()) {
      return false;
    }
    this.state.drinksTonight += 1;
    this.state.startedAt = this.state.startedAt || Date.now();
    const delta = Number(drink.drunkness || 0);
    this.state.drunkness = Math.max(0, Math.min(10, this.state.drunkness + delta));
    this.state.lastDecayAt = Date.now();
    this.recordEvent('drink', note || ('喝下' + drink.name), delta, { drinkId: drink.id });
    return true;
  },

  rejectDrink(drink, note) {
    return this.recordEvent('reject', note || ('没有喝' + drink.name), 0, { drinkId: drink.id });
  },

  changeDrunkness(delta, text, meta) {
    const value = Number(delta || 0);
    this.state.drunkness = Math.max(0, Math.min(10, this.state.drunkness + value));
    this.state.lastDecayAt = Date.now();
    return this.recordEvent(value >= 0 ? 'drink' : 'sober', text || '醉意变化', value, meta);
  },

  unlockSoberPill() {
    this.state.soberPillUnlocked = true;
    this.saveState();
  },

  takeSoberPill() {
    if (!this.state.soberPillUnlocked) {
      return false;
    }
    this.state.soberPillUnlocked = false;
    this.changeDrunkness(-3, '吃下醒酒丸', { source: 'sober-pill' });
    return true;
  },

  makeNightSummary() {
    const state = this.getState();
    const ledger = state.ledger;
    const drinks = ledger.filter((event) => event.type === 'drink').length;
    const biggest = ledger.reduce((total, event) => total + Math.max(0, Number(event.delta || 0)), 0);
    return {
      date: new Date().toISOString(),
      drinks,
      peakDrunkness: Math.round(Math.max(state.drunkness, biggest) * 10) / 10,
      text: '今晚共记下 ' + ledger.length + ' 个片段，喝下 ' + drinks + ' 杯。'
    };
  },

  endTonight() {
    const summary = this.makeNightSummary();
    this.state.history.push(summary);
    this.clearTonight(false);
    return summary;
  },

  clearTonight(shouldSave) {
    this.state.drunkness = 0;
    this.state.drinksTonight = 0;
    this.state.ledger = [];
    this.state.startedAt = null;
    this.state.lastDecayAt = Date.now();
    this.state.soberPillUnlocked = false;
    if (shouldSave !== false) {
      this.saveState();
    }
  },

  async clearAll() {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem(this.configKey);
    try {
      const table = window.db && window.db.config;
      if (table && typeof table.delete === 'function') {
        await table.delete(this.configKey);
      }
    } catch (error) {
      return;
    } finally {
      this.state = this.defaultState();
      this.saveState();
    }
  },

  getUserProfile() {
    const localName = localStorage.getItem('username') || localStorage.getItem('userName');
    return {
      id: window._wechatUid || localStorage.getItem('userId') || '',
      name: localName || window._wechatUid || '对方'
    };
  },

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
    }
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  },

  emit() {
    const state = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        return;
      }
    });
  }
};
