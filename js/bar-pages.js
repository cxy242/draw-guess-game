window.showBarPage = async function () {
  if (!window._wechatUid) {
    window.barShowLoginPage(window.showBarPage);
    return;
  }
  const previous = document.querySelector('.bar-page');
  if (previous) {
    previous.remove();
  }
  const root = document.createElement('section');
  root.className = 'bar-page';
  root.innerHTML = barLoadingView();
  document.body.appendChild(root);
  barRuntime.root = root;
  barRuntime.stack = ['barHome'];
  root.addEventListener('click', barHandleClick);
  root.addEventListener('input', barHandleInput);
  try {
    await window.BarCore.init();
    await barEnsureBuddyConfig();
    barRuntime.characters = await window.BarCore.getCharacters();
    barRuntime.companion = await window.BarCore.getCompanion();
    if (window._barBuddyPickerPending || !barRuntime.companion) {
      window._barBuddyPickerPending = false;
      barShowBuddyPicker(root, barRuntime.characters);
      return;
    }
    await barRenderCurrent();
  } catch (error) {
    root.innerHTML = barErrorView(error);
  }
};

const barRuntime = {
  root: null,
  stack: ['barHome'],
  characters: [],
  companion: null,
  menuCategory: 'house',
  settingsOpen: false,
  renderSequence: 0
};

function barAvatarImage(character, className) {
  const source = character && (character.avatar || character.avatarUrl || character.photo || character.image);
  return source
    ? '<img class="' + className + '" src="' + barEscape(source) + '" alt="' + barEscape(character && character.name || '酒伴') + '">'
    : '<span class="' + className + ' ' + className + '-empty">' + barEscape((character && character.name || '?').slice(0, 1)) + '</span>';
}

async function barGetUserAccounts() {
  try {
    if (typeof window.getXUserList === 'function') {
      const result = await window.getXUserList();
      const rows = Array.isArray(result) ? result : (result && (result.users || result.characters || result.list));
      if (Array.isArray(rows) && rows.length) return rows;
    }
  } catch (error) {
  }
  const table = window.db && window.db.characters;
  if (!table) return [];
  try {
    return await table.where('type').equals('user').toArray();
  } catch (error) {
    const rows = await table.toArray();
    return rows.filter((row) => row.type === 'user' || row.role === 'user');
  }
}

async function barGetBuddyCharacters() {
  const table = window.db && window.db.characters;
  if (!table) return [];
  try {
    return await table.where('type').notEqual('user').toArray();
  } catch (error) {
    const rows = await table.toArray();
    return rows.filter((row) => row.type !== 'user' && row.role !== 'user');
  }
}

function barLoginMarkup() {
  return '<div class="bar-buddy-login-page">' +
    '<button class="bar-buddy-login-close" type="button" data-bar-login-close>返回</button>' +
    '<div class="bar-buddy-login-shell"><div class="bar-buddy-login-mark"><span class="candy-icon candy-icon-person" aria-hidden="true"></span></div>' +
    '<h1 class="bar-buddy-login-title">登录微信</h1><p class="bar-buddy-login-subtitle">选择微信账号继续</p>' +
    '<button class="bar-buddy-login-wechat" type="button" data-bar-login-users>通过微信登录</button>' +
    '<div class="bar-buddy-login-accounts" data-bar-login-accounts hidden></div></div></div>';
}

function barShowLoginPage(callback) {
  const old = document.querySelector('.bar-buddy-login-page');
  if (old) old.remove();
  const page = document.createElement('div');
  page.innerHTML = barLoginMarkup();
  const login = page.firstElementChild;
  document.body.appendChild(login);
  login.querySelector('[data-bar-login-close]').addEventListener('click', () => login.remove());
  login.querySelector('[data-bar-login-users]').addEventListener('click', async () => {
    const accounts = await barGetUserAccounts();
    const container = login.querySelector('[data-bar-login-accounts]');
    container.hidden = false;
    container.innerHTML = accounts.length
      ? accounts.map((account) => '<button class="bar-buddy-login-account" type="button" data-bar-user-id="' + barEscape(account.id) + '">' +
        barAvatarImage(account, 'bar-buddy-login-avatar') + '<strong>' + barEscape(account.name) + '</strong></button>').join('')
      : '<p class="bar-buddy-login-empty">没有找到微信账号，请先在微信里登录。</p>';
    container.querySelectorAll('[data-bar-user-id]').forEach((button) => {
      button.addEventListener('click', () => {
        window._wechatUid = String(button.dataset.barUserId);
        window._barBuddyPickerPending = true;
        login.remove();
        if (typeof callback === 'function') callback();
      });
    });
  });
}

async function barEnsureBuddyConfig() {
  try {
    const record = await window.db.config.get('barBuddyId');
    const value = record && (record.value ?? record.barBuddyId);
    const characterId = parseInt(value, 10);
    if (Number.isFinite(characterId) && !window.BarCore.getState().companionId) await window.BarCore.selectCompanion(characterId);
  } catch (error) {
  }
}

async function barSaveBuddyId(characterId) {
  const id = parseInt(characterId, 10);
  if (!Number.isFinite(id)) return;
  window._barBuddyId = id;
  await window.BarCore.selectCompanion(id);
  try {
    await window.db.config.put({ key: 'barBuddyId', value: id });
  } catch (error) {
  }
}

function barShowBuddyPicker(root, characters) {
  const old = root.querySelector('.bar-buddy-picker-layer');
  if (old) old.remove();
  const layer = document.createElement('div');
  layer.className = 'bar-buddy-picker-layer';
  const cards = characters.map((character) => '<button class="bar-buddy-card" type="button" data-bar-buddy-id="' + character.id + '">' +
    barAvatarImage(character, 'bar-buddy-avatar') + '<span class="bar-buddy-copy"><strong class="bar-buddy-name">' + barEscape(character.name) + '</strong><small class="bar-buddy-prompt">点这里确认</small></span></button>').join('');
  layer.innerHTML = '<section class="bar-buddy-picker-panel">' +
    '<div class="bar-buddy-picker-head"><p class="bar-buddy-picker-kicker">一人一问</p><h2 class="bar-buddy-picker-title">今晚想和谁喝？</h2><p class="bar-buddy-picker-copy">选中一位后，只再确认一次。</p></div>' +
    (characters.length ? '<div class="bar-buddy-list">' + cards + '</div><div class="bar-buddy-question" data-bar-buddy-question></div>' : '<div class="bar-buddy-empty"><h3 class="bar-buddy-empty-title">先去微信聊几句再回来</h3><p class="bar-buddy-empty-copy">角色档案会出现在这里。</p></div>') +
    '</section>';
  root.appendChild(layer);
  layer.querySelectorAll('[data-bar-buddy-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const character = characters.find((item) => String(item.id) === button.dataset.barBuddyId);
      const question = layer.querySelector('[data-bar-buddy-question]');
      question.innerHTML = '<h3 class="bar-buddy-question-title">就是「' + barEscape(character.name) + '」吗？</h3>' +
        '<div class="bar-buddy-question-actions"><button class="bar-buddy-secondary" type="button" data-bar-buddy-cancel>再看看</button><button class="bar-buddy-primary" type="button" data-bar-buddy-confirm>就是 Ta</button></div>';
      question.querySelector('[data-bar-buddy-cancel]').addEventListener('click', () => { question.innerHTML = ''; });
      question.querySelector('[data-bar-buddy-confirm]').addEventListener('click', async () => {
        await barSaveBuddyId(character.id);
        layer.remove();
        window._barBuddyPickerPending = false;
        await window.showBarPage();
      });
    });
  });
}

function barEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[character];
  });
}

function barLoadingView() {
  return '<div class="bar-state-card">' +
    '<div class="bar-state-mark bar-state-mark-loading"></div>' +
    '<h2 class="bar-state-title">正在准备吧台</h2>' +
    '<p class="bar-state-copy">酒单、规矩和今晚的状态正在就位。</p>' +
    '</div>';
}

function barErrorView(error) {
  return '<div class="bar-state-card">' +
    '<div class="bar-state-mark bar-state-mark-error"></div>' +
    '<h2 class="bar-state-title">吧台暂时没有响应</h2>' +
    '<p class="bar-state-copy">' + barEscape(error && error.message || '本地数据加载失败') + '</p>' +
    '<button class="bar-btn bar-btn-primary" type="button" data-action="retry">重新加载</button>' +
    '</div>';
}

function barTopbar(title, options) {
  const settings = options && options.settings
    ? '<button class="bar-icon-button" type="button" data-action="settings" aria-label="打开设置"><span class="bar-settings-glyph"></span></button>'
    : '';
  return '<header class="bar-topbar">' +
    '<button class="bar-back-button" type="button" data-action="back" aria-label="返回"><span class="bar-back-icon"></span></button>' +
    '<h1 class="bar-topbar-title">' + barEscape(title) + '</h1>' +
    '<div class="bar-topbar-actions">' + settings + '</div>' +
    '</header>';
}

function barDateBadge() {
  const date = new Date();
  return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日 晚';
}

function barDrunkBadge(state, tier) {
  const value = Number(state.drunkness || 0).toFixed(1);
  return '<button class="bar-drunk-badge" type="button" data-action="drunk" data-tier="' + barEscape(tier && tier.id) + '">' +
    '<span class="bar-drunk-icon"></span>' +
    '<span class="bar-drunk-copy"><strong class="bar-tier-name">' + barEscape(tier && tier.name || '正常') + '</strong>' +
    '<span class="bar-drunk-value">' + value + ' / 10</span></span>' +
    '</button>';
}

function barAvatar(character, className) {
  const source = character && (character.avatar || character.avatarUrl || character.photo || character.image);
  if (source) {
    return '<img class="' + className + '" src="' + barEscape(source) + '" alt="' + barEscape(character.name || '酒伴') + '头像">';
  }
  return '<span class="' + className + ' bar-avatar-placeholder ' + className + '-empty">' + barEscape(character && character.name ? character.name.slice(0, 1) : '伴') + '</span>';
}

function barEntryCard(action, iconClass, title, copy, disabled) {
  return '<button class="bar-entry-card" type="button" data-action="' + action + '" ' + (disabled ? 'disabled' : '') + '>' +
    '<span class="bar-entry-icon ' + iconClass + '"><span></span></span>' +
    '<span class="bar-entry-copy"><strong class="bar-entry-title">' + barEscape(title) + '</strong>' +
    '<span class="bar-entry-note">' + barEscape(copy) + '</span></span>' +
    '<span class="bar-entry-arrow"></span>' +
    '</button>';
}

function barEmptyView(title, copy) {
  return '<div class="bar-empty-state">' +
    '<div class="bar-empty-glass"><span class="bar-empty-stem"></span><span class="bar-empty-base"></span><span class="bar-empty-drop"></span></div>' +
    '<h2 class="bar-state-title">' + barEscape(title) + '</h2>' +
    '<p class="bar-state-copy">' + barEscape(copy) + '</p>' +
    '</div>';
}

function barDrinkGlass(drink) {
  return '<div class="bar-drink-glass" data-glass="' + barEscape(drink.glass) + '" data-hue="' + barEscape(drink.hue) + '">' +
    '<span class="bar-glass-rim"></span>' +
    '<span class="bar-glass-bowl"></span>' +
    '<span class="bar-glass-liquid"></span>' +
    '<span class="bar-glass-stem"></span>' +
    '<span class="bar-glass-foot"></span>' +
    '<span class="bar-glass-ice"></span>' +
    '<span class="bar-glass-handle"></span>' +
    '</div>';
}

function barDrinkCard(drink) {
  return '<article class="bar-drink-card" data-drink-id="' + barEscape(drink.id) + '">' +
    barDrinkGlass(drink) +
    '<div class="bar-drink-info">' +
    '<div class="bar-drink-title-row"><h3 class="bar-drink-name">' + barEscape(drink.name) + '</h3>' +
    '<span class="bar-effect-badge" data-effect="' + barEscape(drink.effectType) + '">' + barEscape(drink.effectLabel) + '</span></div>' +
    '<p class="bar-drink-en">' + barEscape(drink.englishName) + '</p>' +
    '<p class="bar-drink-preparation">' + barEscape(drink.preparation) + '</p>' +
    '<p class="bar-drink-story">' + barEscape(drink.story) + '</p>' +
    '<button class="bar-send-button" type="button" data-action="send-drink" data-drink-id="' + barEscape(drink.id) + '">递到 Ta 面前</button>' +
    '</div>' +
    '</article>';
}

function barTimelineEvent(event) {
  const delta = Number(event.delta || 0);
  return '<article class="bar-timeline-item">' +
    '<span class="bar-timeline-node" data-event-type="' + barEscape(event.type) + '"></span>' +
    '<div class="bar-timeline-content">' +
    '<time class="bar-timeline-time">' + barFormatTime(event.timestamp) + '</time>' +
    '<p class="bar-timeline-text">' + barEscape(event.text) + '</p>' +
    '</div>' +
    '<span class="bar-event-delta" data-direction="' + (delta < 0 ? 'down' : 'up') + '">' + (delta > 0 ? '+' : '') + delta.toFixed(1) + '</span>' +
    '</article>';
}

function barFormatTime(timestamp) {
  const date = new Date(timestamp);
  return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

function barFormatTierValue(value) {
  return Number(value || 0).toFixed(1);
}

async function barRenderCurrent() {
  const sequence = ++barRuntime.renderSequence;
  const root = barRuntime.root;
  if (!root) {
    return;
  }
  try {
    await window.BarCore.init();
    barRuntime.companion = await window.BarCore.getCompanion();
    if (sequence !== barRuntime.renderSequence) {
      return;
    }
    const page = barRuntime.stack[barRuntime.stack.length - 1] || 'barHome';
    if (page === 'barMenu') {
      root.innerHTML = barRenderMenu();
    } else if (page === 'barDrunk') {
      root.innerHTML = barRenderDrunk();
    } else if (page === 'barLedger') {
      root.innerHTML = barRenderLedger();
    } else {
      root.innerHTML = barRenderHome();
    }
  } catch (error) {
    root.innerHTML = barErrorView(error);
  }
}

function barRenderHome() {
  const state = window.BarCore.getState();
  const tier = window.BarCore.getTier();
  const companion = barRuntime.companion;
  const disabled = companion ? '' : ' disabled';
  const host = companion
    ? '<article class="bar-hostcard">' +
      '<div class="bar-host-main">' + barAvatar(companion, 'bar-host-avatar') +
      '<div class="bar-host-copy"><h2 class="bar-host-name">' + barEscape(companion.name) + '</h2>' +
      '<p class="bar-host-label">你的酒伴 · 叫你「' + barEscape(state.nickname) + '」</p></div></div>' +
      barDrunkBadge(state, tier) +
      '<div class="bar-progress-track"><span class="bar-progress-fill" style="width:' + Math.min(100, Number(state.drunkness) * 10) + '%"></span></div>' +
      '</article>'
    : '<button class="bar-hostcard bar-select-host" type="button" data-action="settings">' +
      '<span class="bar-select-avatar"></span><span class="bar-select-copy"><strong>选一位酒伴</strong><small>先把人叫到吧台边</small></span><span class="bar-entry-arrow"></span></button>';
  return barTopbar('吧台', { settings: true }) +
    '<main class="bar-home">' +
    '<section class="bar-scene">' +
    '<div class="bar-scene-glow"></div><div class="bar-light-cord"></div><div class="bar-light-shade"></div>' +
    '<div class="bar-bottle bar-bottle-one"><span class="bar-bottle-neck"></span></div>' +
    '<div class="bar-bottle bar-bottle-two"><span class="bar-bottle-neck"></span></div>' +
    '<div class="bar-bottle bar-bottle-three"><span class="bar-bottle-neck"></span></div>' +
    '<div class="bar-glass-silhouette"><span class="bar-glass-silhouette-bowl"></span><span class="bar-glass-silhouette-stem"></span></div>' +
    '<div class="bar-counter"></div><div class="bar-date-badge">' + barDateBadge() + '</div>' +
    '</section>' +
    host +
    '<section class="bar-grid">' +
    barEntryCard('menu', 'bar-entry-icon-menu', '酒单', '给 Ta 点一杯', !companion) +
    barEntryCard('table', 'bar-entry-icon-table', '赌桌', '骰子 · 猜拳 · 轮盘', !companion) +
    barEntryCard('flight', 'bar-entry-icon-flight', '盲品', '六杯见真章', !companion) +
    barEntryCard('ledger', 'bar-entry-icon-ledger', '今晚的记录', '赖不掉的账', !companion) +
    '</section>' +
    '<button class="bar-rules-teaser" type="button" data-action="open-rules">' +
    '<span>吧台规矩 · 赌注认账 / 上限 8 杯 / 醉话保护</span><span class="bar-entry-arrow"></span></button>' +
    '<div class="bar-bottom-actions"><button class="bar-btn bar-btn-ghost" type="button" data-action="settings">换酒伴</button>' +
    '<button class="bar-btn bar-btn-danger" type="button" data-action="end-tonight">今晚结束</button></div>' +
    '</main>';
}

function barRenderMenu() {
  const menu = window.BarCore.data.menu;
  const categories = menu.categories;
  const drinks = menu.drinks.filter((drink) => drink.category === barRuntime.menuCategory);
  const tabs = categories.map((category) => {
    return '<button class="bar-tab ' + (category.id === barRuntime.menuCategory ? 'bar-active' : '') + '" type="button" data-action="menu-tab" data-category="' + barEscape(category.id) + '">' + barEscape(category.label) + '</button>';
  }).join('');
  return barTopbar('酒单') +
    '<main class="bar-menu-page">' +
    '<div class="bar-section-intro"><p class="bar-eyebrow">给 Ta 的今晚</p><h2>挑一杯，看 Ta 怎么接。</h2></div>' +
    '<nav class="bar-tabs">' + tabs + '</nav>' +
    '<section class="bar-drink-list">' + drinks.map(barDrinkCard).join('') + '</section>' +
    '</main>';
}

function barRenderDrunk() {
  const state = window.BarCore.getState();
  const tierData = window.BarCore.data.tiers;
  const current = window.BarCore.getTier();
  const currentIndex = window.BarCore.getTierIndex();
  const meter = tierData.tiers.map((tier, index) => {
    return '<span class="bar-meter-segment ' + (index <= currentIndex ? 'bar-active' : '') + '" data-tier-id="' + barEscape(tier.id) + '"></span>';
  }).join('');
  const labels = tierData.tiers.map((tier) => {
    return '<span>' + tier.marker + '</span>';
  }).join('');
  const tierList = tierData.tiers.map((tier, index) => {
    return '<article class="bar-tier-item ' + (index === currentIndex ? 'bar-active' : '') + '">' +
      '<button class="bar-tier-trigger" type="button" data-action="toggle-tier" data-tier-id="' + barEscape(tier.id) + '">' +
      '<span class="bar-tier-dot" data-tier-id="' + barEscape(tier.id) + '"></span><strong>' + barEscape(tier.name) + '</strong><span class="bar-tier-chevron"></span></button>' +
      '<div class="bar-tier-detail"><p>' + barEscape(tier.fullStyle) + '</p></div>' +
      '</article>';
  }).join('');
  return barTopbar('醉意') +
    '<main class="bar-drunk-page">' +
    '<section class="bar-tier-meter"><div class="bar-meter-heading"><span>今晚的醉意</span><strong>' + barFormatTierValue(state.drunkness) + ' / 10</strong></div>' +
    '<div class="bar-meter-segments">' + meter + '<span class="bar-meter-marker" style="left:' + Math.min(100, Number(state.drunkness) * 10) + '%"></span></div>' +
    '<div class="bar-meter-labels">' + labels + '</div></section>' +
    '<section class="bar-current-tier-card"><div><p class="bar-eyebrow">现在的状态</p><h2>' + barEscape(current.name) + '</h2><p>' + barEscape(current.description) + '</p></div><span class="bar-tier-orb" data-tier-id="' + barEscape(current.id) + '"></span></section>' +
    '<section class="bar-tier-list">' + tierList + '</section>' +
    '<section class="bar-data-card"><div class="bar-data-row"><span>最高醉意</span><strong>10.0</strong></div><div class="bar-data-row"><span>每小时自然醒酒</span><strong>-' + barFormatTierValue(tierData.decayPerHour) + '</strong></div><div class="bar-data-row"><span>今晚已喝</span><strong>' + state.drinksTonight + ' / 8 杯</strong></div></section>' +
    '<button class="bar-sober-pill ' + (state.soberPillUnlocked ? '' : 'bar-disabled') + '" type="button" data-action="sober-pill" ' + (state.soberPillUnlocked ? '' : 'disabled') + '><span class="bar-pill-icon"></span><span><strong>吃一粒醒酒丸</strong><small>需先让 Ta 说一句平时绝不说的话</small></span></button>' +
    '</main>';
}

function barRenderLedger() {
  const state = window.BarCore.getState();
  const timeline = state.ledger.length
    ? '<section class="bar-timeline">' + state.ledger.map(barTimelineEvent).join('') + '</section>'
    : barEmptyView('今晚还没开始', '递出第一杯，或者去赌桌坐一会儿。');
  return barTopbar('今晚的记录', { settings: true }) +
    '<main class="bar-ledger-page">' +
    '<div class="bar-section-intro"><p class="bar-eyebrow">今晚的账</p><h2>每一杯、每一次赖账，都记在这里。</h2></div>' +
    timeline +
    '<button class="bar-btn bar-btn-danger bar-end-button" type="button" data-action="end-tonight">今晚结束</button>' +
    '</main>';
}

function barCharacterCard(character, selected) {
  return '<button class="bar-character-card ' + (selected ? 'bar-active' : '') + '" type="button" data-action="select-character" data-char-id="' + character.charId + '">' +
    barAvatar(character, 'bar-character-avatar') +
    '<span class="bar-character-copy"><strong>' + barEscape(character.name) + '</strong><small>点选即定</small></span>' +
    '<span class="bar-radio-mark"></span></button>';
}

function barSettingsView() {
  const state = window.BarCore.getState();
  const characters = barRuntime.characters;
  const cards = characters.length
    ? characters.map((character) => barCharacterCard(character, character.charId === state.companionId)).join('')
    : barEmptyView('还没有可选角色', '角色数据来自你的 app，稍后再试。');
  return '<div class="bar-layer bar-settings-layer">' +
    '<div class="bar-layer-backdrop" data-action="close-layer"></div>' +
    '<section class="bar-modal bar-settings-modal">' +
    '<header class="bar-modal-header"><div><p class="bar-eyebrow">吧台设置</p><h2>今晚的规矩</h2></div><button class="bar-icon-button" type="button" data-action="close-layer" aria-label="关闭设置"><span class="bar-close-glyph"></span></button></header>' +
    '<div class="bar-settings-scroll">' +
    '<section class="bar-settings-section"><h3>换酒伴</h3><div class="bar-character-list">' + cards + '</div></section>' +
    '<section class="bar-settings-section"><h3>称呼设置</h3><p class="bar-setting-copy">小机怎么称呼你</p><div class="miss-compose"><input class="miss-input" data-input="nickname" value="' + barEscape(state.nickname) + '" maxlength="24"><button class="miss-send" type="button" data-action="save-nickname" aria-label="保存称呼"><span></span></button></div></section>' +
    '<section class="bar-settings-section" data-section="rules"><h3>吧台规矩</h3><div class="bar-rules-card">' + window.BarCore.data.menu.rules.map((rule) => '<article class="bar-rule"><strong>' + barEscape(rule.number) + '、' + barEscape(rule.title) + '</strong><p>' + barEscape(rule.text) + '</p></article>').join('') + '</div></section>' +
    '<section class="bar-settings-section"><h3>致谢与许可</h3><div class="bar-attribution">灵感与改编内容来自 mamo《和小机喝一杯》https://github.com/mamo0521/drink-with-your-ai 与《因果律软糖罐》https://github.com/mamo0521/causality-candy-jar。<br><br>改编内容以 CC BY-NC-SA 4.0 共享（https://creativecommons.org/licenses/by-nc-sa/4.0/），原作为 © mamo。</div></section>' +
    '<section class="bar-settings-section"><h3>数据</h3><div class="bar-data-actions"><button class="bar-btn bar-btn-danger" type="button" data-action="clear-tonight">清空今晚</button><button class="bar-btn bar-btn-danger" type="button" data-action="clear-all">清空全部记录</button></div></section>' +
    '</div></section></div>';
}

function barChoiceView(candidates) {
  return '<div class="bar-layer bar-choice-layer"><div class="bar-layer-backdrop" data-action="close-choice"></div><section class="bar-modal bar-choice-modal"><header class="bar-modal-header"><div><p class="bar-eyebrow">一人一问</p><h2>你说的是哪一位？</h2></div><button class="bar-icon-button" type="button" data-action="close-choice" aria-label="关闭选择"><span class="bar-close-glyph"></span></button></header><div class="bar-choice-list">' +
    candidates.map((character) => barCharacterCard(character, false)).join('') +
    '</div></section></div>';
}

function barDrinkModal(drink) {
  return '<div class="bar-layer bar-drink-layer"><div class="bar-layer-backdrop" data-action="close-layer"></div><section class="bar-modal bar-drink-modal"><header class="bar-modal-header"><div><p class="bar-eyebrow">递给 Ta</p><h2>' + barEscape(drink.name) + '</h2></div><button class="bar-icon-button" type="button" data-action="close-layer" aria-label="关闭"><span class="bar-close-glyph"></span></button></header><div class="bar-drink-modal-body">' + barDrinkGlass(drink) + '<div><p class="bar-modal-copy">要不要附上一句话？</p><div class="miss-compose"><input class="miss-input" data-input="drink-message" placeholder="例如：今天辛苦了。"><button class="miss-send" type="button" data-action="save-message" aria-label="记下留言"><span></span></button></div></div></div><div class="bar-modal-actions"><button class="bar-btn bar-btn-ghost" type="button" data-action="close-layer">再看看</button><button class="bar-btn bar-btn-primary" type="button" data-action="confirm-drink" data-drink-id="' + barEscape(drink.id) + '">递到 Ta 面前</button></div></section></div>';
}

function barConfirmView(title, copy, action) {
  return '<div class="bar-layer bar-confirm-layer"><div class="bar-layer-backdrop" data-action="close-confirm"></div><section class="bar-modal bar-confirm-modal"><h2>' + barEscape(title) + '</h2><p class="bar-modal-copy">' + barEscape(copy) + '</p><div class="bar-modal-actions"><button class="bar-btn bar-btn-ghost" type="button" data-action="close-confirm">先不了</button><button class="bar-btn bar-btn-danger" type="button" data-action="' + action + '">确定</button></div></section></div>';
}

function barMountLayer(html, selector) {
  const root = barRuntime.root;
  const old = root.querySelector(selector);
  if (old) {
    old.remove();
  }
  const holder = document.createElement('div');
  holder.innerHTML = html;
  const layer = holder.firstElementChild;
  root.appendChild(layer);
  const panel = layer.querySelector('.bar-modal');
  if (panel) {
    panel.style.transform = 'scale(0.96)';
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
    requestAnimationFrame(function () {
      panel.style.transform = 'scale(1)';
      panel.style.opacity = '1';
      panel.style.pointerEvents = 'auto';
      setTimeout(function () {
        panel.style.transform = '';
        panel.style.opacity = '';
        panel.style.transition = '';
        panel.style.pointerEvents = '';
      }, 220);
    });
  }
  return layer;
}

function barCloseLayer(selector) {
  const layer = barRuntime.root && barRuntime.root.querySelector(selector);
  if (layer) {
    layer.remove();
  }
}

function barToast(message, tone) {
  const root = barRuntime.root || document.body;
  const toast = document.createElement('div');
  toast.className = 'bar-toast ' + (tone === 'danger' ? 'bar-toast-danger' : '');
  toast.textContent = message;
  root.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 2800);
}

function barFindDrink(id) {
  return window.BarCore.data.menu.drinks.find((drink) => drink.id === id);
}

function barFindCharacter(id) {
  return barRuntime.characters.find((character) => character.charId === Number(id));
}

async function barSendDrink(drink, message) {
  window.BarCore.offerDrink(drink, message);
  barCloseLayer('.bar-drink-layer');
  const glass = document.createElement('div');
  glass.className = 'bar-flying-cup';
  glass.innerHTML = barDrinkGlass(drink);
  barRuntime.root.appendChild(glass);
  requestAnimationFrame(function () {
    glass.classList.add('bar-flying');
  });
  setTimeout(function () {
    glass.remove();
  }, 520);
  const payload = { drink, message };
  window.dispatchEvent(new CustomEvent('bar-drink-offered', { detail: payload }));
  if (window.BarAI && typeof window.BarAI.onDrinkOffered === 'function') {
    window.BarAI.onDrinkOffered(payload);
  }
  barToast('已递到 Ta 面前，喝不喝由 Ta。');
  await barRenderCurrent();
}

async function barSelectCharacter(character) {
  const sameName = barRuntime.characters.filter((item) => item.name === character.name);
  if (sameName.length > 1) {
    barMountLayer(barChoiceView(sameName), '.bar-choice-layer');
    return;
  }
  await barSaveBuddyId(character.charId);
  barCloseLayer('.bar-settings-layer');
  barRuntime.stack = ['barHome'];
  await barRenderCurrent();
  barToast('今晚的酒伴已定。');
}

async function barEndTonight() {
  const summary = window.BarCore.endTonight();
  barCloseLayer('.bar-confirm-layer');
  barRuntime.stack = ['barHome'];
  await barRenderCurrent();
  barToast(summary.text);
}

async function barHandleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) {
    return;
  }
  const action = target.dataset.action;
  if (action === 'retry') {
    window.showBarPage();
    return;
  }
  if (action === 'back') {
    if (barRuntime.stack.length > 1) {
      barRuntime.stack.pop();
      await barRenderCurrent();
    } else {
      barRuntime.root.remove();
    }
    return;
  }
  if (action === 'close-layer') {
    barCloseLayer('.bar-drink-layer');
    barCloseLayer('.bar-settings-layer');
    return;
  }
  if (action === 'close-choice') {
    barCloseLayer('.bar-choice-layer');
    return;
  }
  if (action === 'close-confirm') {
    barCloseLayer('.bar-confirm-layer');
    return;
  }
  if (action === 'settings' || action === 'open-rules') {
    barMountLayer(barSettingsView(), '.bar-settings-layer');
    if (action === 'open-rules') {
      setTimeout(function () {
        const section = barRuntime.root.querySelector('[data-section="rules"]');
        if (section) {
          section.scrollIntoView({ block: 'start' });
        }
      }, 30);
    }
    return;
  }
  if (action === 'menu') {
    barRuntime.stack.push('barMenu');
    await barRenderCurrent();
    return;
  }
  if (action === 'drunk') {
    barRuntime.stack.push('barDrunk');
    await barRenderCurrent();
    return;
  }
  if (action === 'ledger') {
    barRuntime.stack.push('barLedger');
    await barRenderCurrent();
    return;
  }
  if (action === 'table' || action === 'wheel' || action === 'flight') {
    const moduleName = action === 'flight' ? '盲品' : (action === 'wheel' ? '轮盘' : '赌桌');
    const handler = action === 'table' ? window.showBarTable : (action === 'wheel' ? window.showBarWheel : window.showBarFlight);
    if (typeof handler === 'function') {
      handler();
    } else {
      barToast(moduleName + '将在 Phase 2 开放。');
    }
    return;
  }
  if (action === 'menu-tab') {
    barRuntime.menuCategory = target.dataset.category;
    await barRenderCurrent();
    return;
  }
  if (action === 'send-drink') {
    const drink = barFindDrink(target.dataset.drinkId);
    if (drink) {
      barMountLayer(barDrinkModal(drink), '.bar-drink-layer');
    }
    return;
  }
  if (action === 'save-message') {
    barToast('留言已记下。');
    return;
  }
  if (action === 'confirm-drink') {
    const drink = barFindDrink(target.dataset.drinkId);
    const input = barRuntime.root.querySelector('[data-input="drink-message"]');
    if (drink) {
      await barSendDrink(drink, input ? input.value : '');
    }
    return;
  }
  if (action === 'toggle-tier') {
    const item = target.closest('.bar-tier-item');
    if (item) {
      item.classList.toggle('bar-active');
    }
    return;
  }
  if (action === 'sober-pill') {
    if (window.BarCore.takeSoberPill()) {
      barToast('醒酒丸生效，醉意退了三杯。');
      await barRenderCurrent();
    } else {
      barToast('先等 Ta 说一句平时绝不说的话。', 'danger');
    }
    return;
  }
  if (action === 'end-tonight') {
    barMountLayer(barConfirmView('今晚的账就留在这里？', '醉意会归零，今晚的片段会收进记忆总结。', 'confirm-end'), '.bar-confirm-layer');
    return;
  }
  if (action === 'confirm-end') {
    await barEndTonight();
    return;
  }
  if (action === 'save-nickname') {
    const input = barRuntime.root.querySelector('[data-input="nickname"]');
    await window.BarCore.setNickname(input ? input.value : '');
    barToast('称呼已保存。');
    await barRenderCurrent();
    return;
  }
  if (action === 'select-character') {
    const character = barFindCharacter(target.dataset.charId);
    if (character) {
      await barSelectCharacter(character);
    }
    return;
  }
  if (action === 'choose-character') {
    const character = barFindCharacter(target.dataset.charId);
    if (character) {
      await barSaveBuddyId(character.charId);
      barCloseLayer('.bar-choice-layer');
      barCloseLayer('.bar-settings-layer');
      barRuntime.stack = ['barHome'];
      await barRenderCurrent();
      barToast('今晚的酒伴已定。');
    }
    return;
  }
  if (action === 'clear-tonight') {
    barMountLayer(barConfirmView('清空今晚的记录？', '今晚的醉意、杯数和记录都会清空。', 'confirm-clear-tonight'), '.bar-confirm-layer');
    return;
  }
  if (action === 'confirm-clear-tonight') {
    window.BarCore.clearTonight();
    barCloseLayer('.bar-confirm-layer');
    barToast('今晚已清空。');
    await barRenderCurrent();
    return;
  }
  if (action === 'clear-all') {
    barMountLayer(barConfirmView('清空全部记录？', '今晚和历史记录都会被删除，无法恢复。', 'confirm-clear-all'), '.bar-confirm-layer');
    return;
  }
  if (action === 'confirm-clear-all') {
    await window.BarCore.clearAll();
    barCloseLayer('.bar-confirm-layer');
    barCloseLayer('.bar-settings-layer');
    barRuntime.stack = ['barHome'];
    await barRenderCurrent();
    barToast('全部记录已清空。');
  }
}

function barHandleInput(event) {
  const input = event.target.closest('[data-input]');
  if (!input) {
    return;
  }
  if (input.dataset.input === 'nickname') {
    input.setAttribute('aria-label', '小机称呼你');
  }
  if (input.dataset.input === 'drink-message') {
    input.setAttribute('aria-label', '给这杯酒附一句话');
  }
}
