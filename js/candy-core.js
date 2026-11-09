window.CandyCore = {
  storageKey: 'candyGameState.v1',
  configKey: 'candyGameConfig',
  version: '6.7.1+catalog.sha1',
  data: null,
  state: null,
  ticker: null,
  listeners: [],
  configWriteTimer: null,

  async init() {
    if (!this.data) {
      this.data = await this.fetchJson('data/candy-catalog.json');
    }
    if (!this.state) {
      this.state = this.readState();
      await this.readConfig();
    }
    this.refreshDaily();
    this.refreshEffects();
    this.startTicker();
    return this.getState();
  },

  async fetchJson(path) {
    const response = await fetch(path + '?v=' + this.version, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(path + ' 加载失败');
    }
    return response.json();
  },

  dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  },

  defaultState() {
    return {
      version: 1,
      updatedAt: Date.now(),
      coins: 28,
      dailyEarned: 0,
      today: {
        dateKey: '',
        jarId: '1',
        openJarIds: [],
        mysteryPurchases: []
      },
      candyStates: [],
      dex: [],
      ledger: [],
      mineCandyIds: [],
      purchases: []
    };
  },

  normalizeState(saved) {
    const fallback = this.defaultState();
    if (!saved || typeof saved !== 'object') {
      return fallback;
    }
    const state = Object.assign(fallback, saved);
    state.today = Object.assign(fallback.today, saved.today || {});
    state.today.openJarIds = Array.isArray(state.today.openJarIds) ? state.today.openJarIds : [];
    state.today.mysteryPurchases = Array.isArray(state.today.mysteryPurchases) ? state.today.mysteryPurchases : [];
    state.candyStates = Array.isArray(saved.candyStates) ? saved.candyStates :
      (Array.isArray(saved.effects) ? saved.effects : []);
    state.dex = Array.isArray(saved.dex) ? saved.dex : [];
    state.ledger = Array.isArray(saved.ledger) ? saved.ledger : [];
    state.mineCandyIds = Array.isArray(saved.mineCandyIds) ? saved.mineCandyIds : [];
    state.purchases = Array.isArray(saved.purchases) ? saved.purchases : [];
    return state;
  },

  readState() {
    try {
      return this.normalizeState(JSON.parse(localStorage.getItem(this.storageKey) || 'null'));
    } catch (error) {
      return this.defaultState();
    }
  },

  async readConfig() {
    try {
      const table = window.db && window.db.config;
      if (!table || typeof table.get !== 'function') return;
      const record = await table.get(this.configKey);
      const configState = record && (record.value || record.state || record.data);
      if (!configState || typeof configState !== 'object') return;
      const normalized = this.normalizeState(configState);
      const localStamp = Number(this.state.updatedAt || 0);
      const configStamp = Number(normalized.updatedAt || 0);
      if (configStamp >= localStamp) this.state = normalized;
    } catch (error) {
      this.notify('config-read-error', { error });
    }
  },

  saveState(immediate = false) {
    this.state.updatedAt = Date.now();
    const serialized = JSON.stringify(this.state);
    try {
      localStorage.setItem(this.storageKey, serialized);
      localStorage.setItem(this.configKey, serialized);
    } catch (error) {
      this.notify('storage-error', { error });
    }
    if (immediate) {
      this.writeConfig(serialized);
    } else {
      clearTimeout(this.configWriteTimer);
      this.configWriteTimer = setTimeout(() => this.writeConfig(serialized), 120);
    }
    this.notify('state', this.getState());
  },

  async writeConfig(serialized) {
    try {
      const table = window.db && window.db.config;
      if (!table || typeof table.put !== 'function') return;
      const value = JSON.parse(serialized);
      if (typeof table.put === 'function') {
        await table.put({ key: this.configKey, value });
      }
    } catch (error) {
      this.notify('config-write-error', { error });
    }
  },

  getState() {
    return this.state ? JSON.parse(JSON.stringify(this.state)) : this.defaultState();
  },

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  },

  notify(type, payload) {
    this.listeners.slice().forEach((listener) => {
      try {
        listener(type, payload);
      } catch (error) {
        this.notifyError(error);
      }
    });
  },

  notifyError(error) {
    if (window.console && typeof window.console.error === 'function') {
      window.console.error(error);
    }
  },

  startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => {
      this.refreshDaily();
      this.refreshEffects();
    }, 1000);
  },

  stopTicker() {
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
  },

  hashText(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  },

  dailyJarId(dateKey) {
    return String((this.hashText(dateKey) % 5) + 1);
  },

  refreshDaily() {
    const key = this.dateKey();
    if (!this.state) return;
    if (this.state.today.dateKey === key) return;
    const previous = this.state.today;
    if (previous.dateKey) {
      const jar = this.getJar(previous.jarId);
      this.addLedger('jar-close', '昨日罐封存：' + (jar ? jar.name : '未知罐'), 0, {
        jarId: previous.jarId,
        dateKey: previous.dateKey
      });
    }
    this.state.today = {
      dateKey: key,
      jarId: this.dailyJarId(key),
      openJarIds: [],
      mysteryPurchases: []
    };
    this.state.dailyEarned = 0;
    this.saveState(true);
    this.notify('daily', this.getState().today);
  },

  getCatalog() {
    return this.data || { jars: [], candies: [], notes: [], source: '', version: '' };
  },

  getJars() {
    return this.getCatalog().jars.filter((jar) => jar.id !== 'mine');
  },

  getJar(jarId) {
    return this.getCatalog().jars.find((jar) => jar.id === String(jarId)) || null;
  },

  getCandy(candyId) {
    return this.getCatalog().candies.find((candy) => candy.id === String(candyId)) || null;
  },

  getCandiesForJar(jarId) {
    const id = String(jarId);
    if (id === '5') return this.getCatalog().candies.slice();
    return this.getCatalog().candies.filter((candy) => candy.jar === id);
  },

  getJarCandySelection(jarId, count = 8) {
    const candies = this.getCandiesForJar(jarId);
    if (!candies.length) return [];
    const seed = this.hashText((this.state.today.dateKey || this.dateKey()) + ':' + jarId);
    const shuffled = candies.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const offset = (seed + index * 9301) % (index + 1);
      [shuffled[index], shuffled[offset]] = [shuffled[offset], shuffled[index]];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length));
  },

  getTodayJar() {
    return this.getJar(this.state.today.jarId) || this.getJars()[0];
  },

  selectJar(jarId) {
    const jar = this.getJar(jarId);
    if (!jar || jar.id === 'mine') return null;
    this.state.today.jarId = jar.id;
    this.addLedger('jar-switch', '今日罐换成了：' + jar.name, 0, { jarId: jar.id });
    this.saveState(true);
    return jar;
  },

  openJar(jarId = this.state.today.jarId) {
    const jar = this.getJar(jarId);
    if (!jar || jar.id === 'mine') return { jar: null, reward: 0, firstOpen: false };
    this.refreshDaily();
    if (this.state.today.jarId !== jar.id) this.state.today.jarId = jar.id;
    const firstOpen = !this.state.today.openJarIds.includes(jar.id);
    if (firstOpen) this.state.today.openJarIds.push(jar.id);
    const reward = this.addCoins(5, '开罐奖励：' + jar.name, 'reward', { jarId: jar.id });
    this.addLedger('jar-open', '开罐：' + jar.name, reward, {
      jarId: jar.id,
      firstOpen
    });
    this.saveState(true);
    return { jar, reward, firstOpen };
  },

  addLedger(type, text, delta = 0, meta = {}) {
    const entry = {
      id: 'ledger-' + Date.now() + '-' + Math.random().toString(16).slice(2),
      type,
      text,
      delta,
      balanceAt: this.state.coins,
      at: Date.now(),
      meta
    };
    this.state.ledger.unshift(entry);
    this.state.ledger = this.state.ledger.slice(0, 200);
    return entry;
  },

  addCoins(delta, reason, type = 'reward', meta = {}) {
    const amount = Number(delta) || 0;
    let applied = amount;
    if (amount > 0) {
      const remaining = Math.max(0, 50 - this.state.dailyEarned);
      applied = Math.min(amount, remaining);
      this.state.dailyEarned += applied;
    } else {
      applied = -Math.min(Math.abs(amount), this.state.coins);
    }
    this.state.coins += applied;
    if (applied !== 0) {
      this.addLedger(type, reason, applied, Object.assign({ dailyEarned: this.state.dailyEarned }, meta));
    }
    return applied;
  },

  unlockDex(candyId) {
    const candy = this.getCandy(candyId);
    if (!candy) return null;
    let entry = this.state.dex.find((item) => item.candyId === candy.id);
    if (!entry) {
      entry = { candyId: candy.id, firstSeenAt: Date.now() };
      this.state.dex.push(entry);
      this.addLedger('dex-unlock', '图鉴收录：' + candy.name, 0, { candyId: candy.id });
      this.saveState();
    }
    return entry;
  },

  getDexEntry(candyId) {
    return this.state.dex.find((item) => item.candyId === String(candyId)) || null;
  },

  getEffect(effectId) {
    return this.state.candyStates.find((state) => state.id === String(effectId)) || null;
  },

  getActiveEffects() {
    return this.state.candyStates.filter((state) => state.active && state.endsAt > Date.now());
  },

  activateEffect(candyId, target, source = 'eaten') {
    const candy = this.getCandy(candyId);
    if (!candy || !target) return null;
    const stateSeconds = 1200 + Math.floor(Math.random() * 601);
    const now = Date.now();
    const effect = {
      id: 'state-' + now + '-' + Math.random().toString(16).slice(2),
      candyId: candy.id,
      target: Object.assign({}, target),
      source,
      startedAt: now,
      endsAt: now + stateSeconds * 1000,
      durationSeconds: stateSeconds,
      active: true
    };
    this.state.candyStates.push(effect);
    this.unlockDex(candy.id);
    this.addCoins(2, '吃糖奖励：' + candy.name, 'reward', { candyId: candy.id });
    this.addLedger('state-start', candy.label + '开始生效', 0, {
      candyId: candy.id,
      stateId: effect.id
    });
    this.saveState(true);
    return effect;
  },

  refreshEffects() {
    if (!this.state) return [];
    const now = Date.now();
    let changed = false;
    this.state.candyStates.forEach((effect) => {
      if (effect.active && effect.endsAt <= now) {
        effect.active = false;
        effect.expiredAt = effect.endsAt;
        changed = true;
        const candy = this.getCandy(effect.candyId);
        this.addLedger('state-end', (candy ? candy.label : '药效') + '已失效', 0, {
          candyId: effect.candyId,
          stateId: effect.id
        });
      }
    });
    if (changed) this.saveState(true);
    return this.getActiveEffects();
  },

  releaseEffect(effectId) {
    const effect = this.getEffect(effectId);
    if (!effect || !effect.active) return false;
    effect.active = false;
    effect.releasedAt = Date.now();
    const candy = this.getCandy(effect.candyId);
    this.addLedger('state-release', '手动解除：' + (candy ? candy.label : '药效'), 0, {
      candyId: effect.candyId,
      stateId: effect.id
    });
    this.saveState(true);
    return true;
  },

  getEffectRemaining(effect) {
    return Math.max(0, Number(effect.endsAt) - Date.now());
  },

  formatRemaining(milliseconds) {
    const total = Math.max(0, Math.ceil(Number(milliseconds || 0) / 1000));
    const minutes = String(Math.floor(total / 60)).padStart(2, '0');
    const seconds = String(total % 60).padStart(2, '0');
    return minutes + ':' + seconds;
  },

  presentCandyState(item) {
    if (!item) return null;
    return Object.assign({}, item, {
      totalSeconds: Number(item.durationSeconds) || 0,
      remainingSeconds: Math.max(0, Math.ceil(this.getEffectRemaining(item) / 1000)),
      remainingRatio: item.durationSeconds ? this.getEffectRemaining(item) / (item.durationSeconds * 1000) : 0
    });
  },

  getActiveViews() {
    this.refreshEffects();
    return this.state.candyStates
      .filter((item) => item.active && item.endsAt > Date.now())
      .map((item) => this.presentCandyState(item));
  },

  getCandyStateView(stateId) {
    return this.presentCandyState(this.getEffect(stateId));
  },

  startCandyState(candyId, target, source) {
    return this.presentCandyState(this.activateEffect(candyId, target, source));
  },

  endCandyState(stateId) {
    return this.releaseEffect(stateId);
  },

  getRevealContent(candyId) {
    const candy = this.getCandy(candyId);
    if (!candy) return null;
    return {
      id: candy.id,
      name: candy.name,
      label: candy.label,
      reveal: candy.reveal,
      instruction: Array.isArray(candy.instruction) ? candy.instruction : [],
      examples: Array.isArray(candy.examples) ? candy.examples : []
    };
  },

  mysteryPrice(position) {
    return [3, 3, 4, 4, 5, 5][Math.max(0, Math.min(5, position))] || 5;
  },

  getShopSelection() {
    return this.getJarCandySelection(this.state.today.jarId, 6);
  },

  buyNamedCandy(candyId) {
    const candy = this.getCandy(candyId);
    if (!candy || this.state.coins < 5) return { ok: false, reason: '星币不足' };
    this.addCoins(-5, '购入：' + candy.name, 'shop', { candyId: candy.id, price: 5 });
    this.state.mineCandyIds.push(candy.id);
    this.state.purchases.push({ candyId: candy.id, price: 5, at: Date.now(), source: 'named' });
    this.unlockDex(candy.id);
    this.saveState(true);
    return { ok: true, candy, price: 5 };
  },

  buyMysteryCandy() {
    this.refreshDaily();
    const position = this.state.today.mysteryPurchases.length;
    const price = this.mysteryPrice(position);
    if (this.state.coins < price) return { ok: false, reason: '星币不足' };
    const available = this.getCandiesForJar(this.state.today.jarId)
      .filter((candy) => !this.state.today.mysteryPurchases.includes(candy.id));
    const pool = available.length ? available : this.getCandiesForJar(this.state.today.jarId);
    const candy = pool[Math.floor(Math.random() * pool.length)];
    this.addCoins(-price, '神秘柜：' + candy.name, 'shop', { candyId: candy.id, price, position: position + 1 });
    this.state.today.mysteryPurchases.push(candy.id);
    this.state.mineCandyIds.push(candy.id);
    this.state.purchases.push({ candyId: candy.id, price, at: Date.now(), source: 'mystery' });
    this.unlockDex(candy.id);
    this.saveState(true);
    return { ok: true, candy, price, position: position + 1 };
  },

  async getCharacters() {
    if (!window.db || !window.db.characters || typeof window.db.characters.toArray !== 'function') return [];
    const characters = await window.db.characters.toArray();
    return characters.filter((character) => String(character.id) !== 'user');
  },

  getUserProfile() {
    return {
      id: 'user',
      name: localStorage.getItem('userName') || localStorage.getItem('nickname') || '你',
      avatar: localStorage.getItem('userAvatar') || ''
    };
  }
};
