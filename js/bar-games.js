window.showBarTable = async function () {
  await window.BarCore.init();
  const root = barRuntime.root;
  if (!root) {
    return;
  }
  barGamesRuntime.page = 'table';
  barGamesRuntime.user = window.BarCore.getUserProfile();
  barGamesRuntime.companion = barRuntime.companion || await window.BarCore.getCompanion();
  if (!barGamesRuntime.stake) {
    barGamesRuntime.stake = barGamesMakeDrinkStake();
  }
  barGamesEnsureMatch();
  barGamesRender(root);
  barGamesBind(root);
};

window.showBarWheel = async function () {
  await window.BarCore.init();
  const root = barRuntime.root;
  if (!root) {
    return;
  }
  barGamesRuntime.page = 'wheel';
  barGamesRuntime.user = window.BarCore.getUserProfile();
  barGamesRuntime.companion = barRuntime.companion || await window.BarCore.getCompanion();
  if (!barGamesRuntime.stake) {
    barGamesRuntime.stake = barGamesMakeDrinkStake();
  }
  barGamesRuntime.wheelSegments = barGamesMakeWheelSegments();
  barGamesRuntime.wheelRotation = 0;
  barGamesRuntime.wheelResult = null;
  barGamesRuntime.wheelBusy = false;
  barGamesRender(root);
  barGamesBind(root);
};

const barGamesRuntime = {
  page: 'table',
  user: null,
  companion: null,
  stake: null,
  match: null,
  wheelSegments: [],
  wheelRotation: 0,
  wheelResult: null,
  wheelBusy: false,
  pointerSpinTimer: null,
  pointerSpinStarted: false,
  consecutiveLosses: 0,
  toastTimer: null
};

const barGamesDialogues = {
  dice: ['这局我手热。', '点数会替我说话。', '先落定，再看谁嘴硬。'],
  rps: ['我已经出好了。', '别盯着我的手看。', '这一下不算临时改。'],
  wheel: ['轮盘说什么，今晚就做什么。', '这个格子不算偏心。', '落定了，我陪你认账。'],
  flightPick: ['我就闻着这杯像酒。', '这杯看起来最会说谎。', '先揭开这杯看看。'],
  flightDrink: ['这杯我记住了。', '整杯喝下，今晚认账。', '入口比闻起来直接。']
};

function barGamesRandom(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function barGamesShuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[target];
    copy[target] = current;
  }
  return copy;
}

function barGamesDrinkPool() {
  const menu = window.BarCore.data.menu || {};
  return (menu.drinks || []).filter(function (drink) {
    return Number(drink.drunkness || 0) > 0 && drink.id !== 'sober-pill';
  });
}

function barGamesQuestionPool(kind) {
  const questions = window.BarCore.data.questions || {};
  const source = questions[kind] || questions[kind + 's'] || [];
  const pool = Array.isArray(source) ? source : source.general || [];
  return Array.isArray(pool) ? pool : [];
}

function barGamesPickQuestion(kind) {
  const pool = barGamesQuestionPool(kind);
  return pool.length ? pool[barGamesRandom(0, pool.length - 1)] : '';
}

function barGamesMakeDrinkStake() {
  const drinks = barGamesDrinkPool();
  const drink = drinks.length ? drinks[barGamesRandom(0, drinks.length - 1)] : null;
  return {
    type: 'drink',
    label: '一杯酒',
    detail: drink ? drink.name : '吧台特调',
    drink: drink
  };
}

function barGamesMakeTruthStake() {
  return { type: 'truth', label: '真心话', detail: barGamesPickQuestion('truth') };
}

function barGamesMakeDareStake() {
  return { type: 'dare', label: '大冒险', detail: barGamesPickQuestion('dare') };
}

function barGamesStakeText(stake) {
  if (!stake) {
    return '尚未选择';
  }
  return stake.label + (stake.detail ? '：' + stake.detail : '');
}

function barGamesEnsureMatch() {
  if (barGamesRuntime.match) {
    return;
  }
  barGamesRuntime.match = {
    game: 'dice',
    rounds: 1,
    currentRound: 1,
    userScore: 0,
    aiScore: 0,
    userTotal: 0,
    aiTotal: 0,
    selectedRps: null,
    busy: false,
    complete: false,
    result: null
  };
}

function barGamesResetMatch(game) {
  const rounds = game === 'rps' && barGamesRuntime.match && barGamesRuntime.match.mode3
    ? 3
    : barGamesRuntime.match ? barGamesRuntime.match.rounds : 1;
  barGamesRuntime.match = {
    game: game,
    rounds: rounds,
    currentRound: 1,
    userScore: 0,
    aiScore: 0,
    userTotal: 0,
    aiTotal: 0,
    selectedRps: null,
    busy: false,
    complete: false,
    mode3: rounds === 3,
    result: null
  };
}

function barGamesDiceMarkup(value, owner) {
  const positions = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };
  const active = positions[value] || positions[1];
  let markup = '<div class="bar-dice bar-dice-' + owner + '" data-dice-value="' + value + '">';
  for (let index = 1; index <= 9; index += 1) {
    markup += '<span class="bar-dice-pip' + (active.indexOf(index) >= 0 ? ' bar-active' : '') + '"></span>';
  }
  return markup + '</div>';
}

function barGamesGestureMarkup(value) {
  const names = ['bar-rock-glyph', 'bar-scissors-glyph', 'bar-paper-glyph'];
  return '<span class="bar-gesture-glyph ' + names[value] + '"></span>';
}

function barGamesStakeMarkup() {
  const stake = barGamesRuntime.stake;
  const selected = stake && stake.type;
  return '<section class="bar-game-section">' +
    '<div class="bar-section-heading"><h2>本局赌注</h2><span class="bar-section-note">输家认账</span></div>' +
    '<div class="bar-stake-row">' +
      barGamesStakeCard('drink', '一杯酒', stake && stake.type === 'drink' ? stake.detail : '从酒单抽一杯', selected) +
      barGamesStakeCard('truth', '真心话', '题库随机一题', selected) +
      barGamesStakeCard('dare', '大冒险', '题库随机一题', selected) +
      barGamesStakeCard('custom', '自己写', '写一句认账内容', selected) +
    '</div>' +
    '<div class="bar-stake-summary">' + barEscape(barGamesStakeText(stake)) + '</div>' +
  '</section>';
}

function barGamesStakeCard(type, label, detail, selected) {
  return '<button class="bar-bet-option' + (selected === type ? ' bar-active' : '') + '" type="button" data-game-action="select-stake" data-stake="' + type + '">' +
    '<strong>' + barEscape(label) + '</strong><span>' + barEscape(detail) + '</span></button>';
}

function barGamesRender(root) {
  root.innerHTML = barGamesRuntime.page === 'wheel'
    ? barGamesRenderWheel()
    : barGamesRenderTable();
}

function barGamesRenderTable() {
  const match = barGamesRuntime.match;
  const companion = barGamesRuntime.companion || { name: '小机', avatar: '' };
  const user = barGamesRuntime.user || {};
  const modeLabel = match.game === 'dice'
    ? (match.mode3 ? '三轮累计' : '一局定胜负')
    : (match.mode3 ? '三局两胜' : '一局');
  return barTopbar('赌桌', { settings: true }) +
    '<main class="bar-game-page bar-table-page">' +
      '<div class="bar-game-intro"><span class="bar-game-kicker">TABLE 04</span><h2>把运气放在桌面上</h2><p>选好赌注和玩法，愿赌服输。</p></div>' +
      barGamesStakeMarkup() +
      '<section class="bar-game-section">' +
        '<div class="bar-section-heading"><h2>玩法</h2><span class="bar-section-note">' + barEscape(modeLabel) + '</span></div>' +
        '<div class="bar-mode-groups">' +
          '<div class="bar-mode-group"><span class="bar-mode-label">骰子</span>' +
            '<button class="bar-mode-pill' + (match.game === 'dice' && !match.mode3 ? ' bar-active' : '') + '" type="button" data-game-action="set-mode" data-game="dice" data-rounds="1">一局定胜负</button>' +
            '<button class="bar-mode-pill' + (match.game === 'dice' && match.mode3 ? ' bar-active' : '') + '" type="button" data-game-action="set-mode" data-game="dice" data-rounds="3">三轮累计</button>' +
          '</div>' +
          '<div class="bar-mode-group"><span class="bar-mode-label">猜拳</span>' +
            '<button class="bar-mode-pill' + (match.game === 'rps' && !match.mode3 ? ' bar-active' : '') + '" type="button" data-game-action="set-mode" data-game="rps" data-rounds="1">一局</button>' +
            '<button class="bar-mode-pill' + (match.game === 'rps' && match.mode3 ? ' bar-active' : '') + '" type="button" data-game-action="set-mode" data-game="rps" data-rounds="3">三局两胜</button>' +
          '</div>' +
        '</div>' +
      '</section>' +
      '<section class="bar-table-card bar-game-duel">' +
        '<div class="bar-duel-head">' +
          '<div class="bar-fighter">' + barAvatar(user, 'bar-fighter-avatar') + '<strong>' + barEscape(user.name || '你') + '</strong><span class="bar-game-score">' + barGamesScoreText(match, 'user') + '</span></div>' +
          '<div class="bar-vs-mark">VS</div>' +
          '<div class="bar-fighter">' + barAvatar(companion, 'bar-fighter-avatar') + '<strong>' + barEscape(companion.name || '小机') + '</strong><span class="bar-game-score">' + barGamesScoreText(match, 'ai') + '</span></div>' +
        '</div>' +
        (match.game === 'dice' ? barGamesDiceStage(match) : barGamesRpsStage(match)) +
        '<div class="bar-duel-footer"><button class="bar-btn bar-btn-primary bar-game-primary" type="button" data-game-action="' + (match.game === 'dice' ? 'roll' : 'play-rps') + '"' + (match.busy || (match.game === 'rps' && match.selectedRps == null) ? ' disabled' : '') + '>' + (match.game === 'dice' ? '掷！' : '出拳！') + '</button>' +
        '<button class="bar-text-button" type="button" data-game-action="open-wheel">去转轮盘</button></div>' +
      '</section>' +
    '</main>';
}

function barGamesScoreText(match, owner) {
  if (match.game === 'dice' && match.mode3) {
    return String(owner === 'user' ? match.userTotal : match.aiTotal) + ' 点';
  }
  return String(owner === 'user' ? match.userScore : match.aiScore) + ' 胜';
}

function barGamesDiceStage(match) {
  return '<div class="bar-dice-board">' +
    '<div class="bar-die-wrap"><span class="bar-die-owner">你的点数</span>' + barGamesDiceMarkup(match.userDice || 1, 'user') + '</div>' +
    '<div class="bar-dice-divider"></div>' +
    '<div class="bar-die-wrap"><span class="bar-die-owner">' + barEscape((barGamesRuntime.companion && barGamesRuntime.companion.name) || '小机') + ' 的点数</span>' + barGamesDiceMarkup(match.aiDice || 1, 'ai') + '</div>' +
  '</div><div class="bar-game-status">' + barEscape(match.status || '骰子已经放好，等你开局。') + '</div>';
}

function barGamesRpsStage(match) {
  const choices = ['石头', '剪刀', '布'];
  const selected = match.selectedRps;
  return '<div class="bar-rps-board">' +
    '<div class="bar-rps-side"><span class="bar-rps-side-label">你的手势</span><div class="bar-rps-choice-row">' +
      choices.map(function (label, index) {
        return '<button class="bar-gesture-button' + (selected === index ? ' bar-active' : '') + '" type="button" data-game-action="choose-rps" data-value="' + index + '"' + (match.busy ? ' disabled' : '') + '>' + barGamesGestureMarkup(index) + '<span>' + label + '</span></button>';
      }).join('') +
    '</div></div>' +
    '<div class="bar-rps-side"><span class="bar-rps-side-label">小机手势</span><div class="bar-rps-ai-slot' + (match.aiRpsHidden ? ' bar-rps-mask' : '') + '">' + (match.aiRps == null ? '<span class="bar-rps-mask-mark">?</span>' : barGamesGestureMarkup(match.aiRps)) + '</div></div>' +
  '</div><div class="bar-game-status">' + barEscape(match.status || '先选石头、剪刀或布。') + '</div>';
}

function barGamesRenderWheel() {
  const stake = barGamesRuntime.stake;
  const segments = barGamesRuntime.wheelSegments;
  const labels = segments.map(function (segment) {
    return '<span class="bar-wheel-label" style="--bar-wheel-angle:' + segment.angle + 'deg">' + barEscape(segment.label) + '</span>';
  }).join('');
  return barTopbar('轮盘', { settings: true }) +
    '<main class="bar-game-page">' +
      '<div class="bar-game-intro"><span class="bar-game-kicker">TABLE 05</span><h2>让轮盘替你做决定</h2><p>今晚这一格，落定后就照做。</p></div>' +
      '<section class="bar-wheel-panel">' +
        '<div class="bar-wheel-stage"><div class="bar-wheel" data-wheel style="transform: rotate(' + barGamesRuntime.wheelRotation + 'deg)"><div class="bar-wheel-ring"></div><div class="bar-wheel-ticks">' + new Array(13).join('<i></i>') + '</div>' + labels + '</div><div class="bar-wheel-pointer"></div></div>' +
        '<div class="bar-wheel-stake"><span class="bar-wheel-stake-label">本局赌注</span><strong>' + barEscape(barGamesStakeText(stake)) + '</strong></div>' +
        '<div class="bar-wheel-action"><button class="bar-btn bar-btn-primary bar-game-primary" type="button" data-game-action="spin-wheel"' + (barGamesRuntime.wheelBusy ? ' disabled' : '') + '>转！</button><span class="bar-wheel-hint">长按或点按，轮盘会转 2.5 至 3.5 圈</span></div>' +
      '</section>' +
      '<div class="bar-game-bottom-actions"><button class="bar-btn bar-btn-secondary" type="button" data-action="ledger">今晚的记录</button><button class="bar-btn bar-btn-secondary" type="button" data-action="back">回吧台</button></div>' +
    '</main>';
}

function barGamesBind(root) {
  if (root._barGamesBound) {
    return;
  }
  root._barGamesBound = true;
  root.addEventListener('click', barGamesHandleClick);
  root.addEventListener('pointerdown', barGamesHandlePointerDown);
  root.addEventListener('pointerup', barGamesHandlePointerUp);
  root.addEventListener('pointercancel', barGamesHandlePointerUp);
}

function barGamesHandleClick(event) {
  const actionNode = event.target.closest && event.target.closest('[data-game-action]');
  if (!actionNode) {
    return;
  }
  const action = actionNode.getAttribute('data-game-action');
  if (action === 'select-stake') {
    const type = actionNode.getAttribute('data-stake');
    if (type === 'custom') {
      barGamesOpenCustomStake();
    } else if (type === 'truth') {
      barGamesRuntime.stake = barGamesMakeTruthStake();
      barGamesRender(barRuntime.root);
    } else if (type === 'dare') {
      barGamesRuntime.stake = barGamesMakeDareStake();
      barGamesRender(barRuntime.root);
    } else {
      barGamesRuntime.stake = barGamesMakeDrinkStake();
      barGamesRender(barRuntime.root);
    }
    return;
  }
  if (action === 'set-mode') {
    barGamesRuntime.match = {
      game: actionNode.getAttribute('data-game'),
      rounds: Number(actionNode.getAttribute('data-rounds')) === 3 ? 3 : 1,
      mode3: Number(actionNode.getAttribute('data-rounds')) === 3,
      currentRound: 1,
      userScore: 0,
      aiScore: 0,
      userTotal: 0,
      aiTotal: 0,
      userDice: 1,
      aiDice: 1,
      selectedRps: null,
      aiRps: null,
      aiRpsHidden: false,
      busy: false,
      complete: false,
      result: null,
      status: ''
    };
    barGamesRender(barRuntime.root);
    return;
  }
  if (action === 'choose-rps') {
    if (barGamesRuntime.match && !barGamesRuntime.match.busy) {
      barGamesRuntime.match.selectedRps = Number(actionNode.getAttribute('data-value'));
      barGamesRuntime.match.status = '手势已选好，按「出拳！」开这一轮。';
      barGamesRender(barRuntime.root);
    }
    return;
  }
  if (action === 'roll') {
    barGamesPlayDice();
    return;
  }
  if (action === 'play-rps') {
    barGamesPlayRps();
    return;
  }
  if (action === 'open-wheel') {
    window.showBarWheel();
    return;
  }
  if (action === 'spin-wheel') {
    if (barGamesRuntime.pointerSpinStarted) {
      barGamesRuntime.pointerSpinStarted = false;
      return;
    }
    if (!barGamesRuntime.wheelBusy) {
      barGamesSpinWheel();
    }
    return;
  }
  if (action === 'settle-game') {
    barGamesSettleResult();
    return;
  }
  if (action === 'close-game-layer') {
    barGamesCloseLayer();
    return;
  }
  if (action === 'save-custom-stake') {
    const input = document.querySelector('[data-custom-stake-input]');
    const value = input && input.value.trim();
    if (!value) {
      return;
    }
    barGamesRuntime.stake = { type: 'custom', label: '自己写', detail: value };
    barGamesCloseLayer();
    barGamesRender(barRuntime.root);
    return;
  }
}

function barGamesHandlePointerDown(event) {
  const button = event.target.closest && event.target.closest('[data-game-action="spin-wheel"]');
  if (!button || barGamesRuntime.wheelBusy) {
    return;
  }
  barGamesRuntime.pointerSpinStarted = false;
  barGamesRuntime.pointerSpinTimer = setTimeout(function () {
    barGamesRuntime.pointerSpinStarted = true;
    barGamesSpinWheel();
  }, 550);
}

function barGamesHandlePointerUp() {
  if (barGamesRuntime.pointerSpinTimer) {
    clearTimeout(barGamesRuntime.pointerSpinTimer);
    barGamesRuntime.pointerSpinTimer = null;
  }
}

function barGamesOpenCustomStake() {
  barGamesCloseLayer();
  const layer = document.createElement('div');
  layer.className = 'bar-game-confirm-layer';
  layer.innerHTML = '<div class="bar-game-modal">' +
    '<button class="bar-icon-button bar-game-close" type="button" data-game-action="close-game-layer" aria-label="关闭"><span class="bar-close-glyph"></span></button>' +
    '<span class="bar-game-kicker">CUSTOM STAKE</span><h2>自己写一句</h2>' +
    '<p>写清楚输家要认下的内容，桌面上的账会照这句记。</p>' +
    '<div class="miss-compose"><input class="miss-input" data-custom-stake-input type="text" maxlength="60" placeholder="例如：给对方唱一首歌" /><button class="miss-send" type="button" data-game-action="save-custom-stake">记下</button></div>' +
  '</div>';
  barRuntime.root.appendChild(layer);
  setTimeout(function () {
    const input = layer.querySelector('input');
    if (input) {
      input.focus();
    }
    layer.classList.add('bar-visible');
  }, 16);
}

function barGamesCloseLayer() {
  const layer = barRuntime.root.querySelector('.bar-game-layer, .bar-game-confirm-layer');
  if (layer) {
    layer.remove();
  }
}

function barGameToast(message, tone) {
  const oldToast = barRuntime.root.querySelector('.bar-game-toast');
  if (oldToast) {
    oldToast.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'bar-game-toast' + (tone === 'danger' ? ' bar-game-toast-danger' : '');
  toast.textContent = message;
  barRuntime.root.appendChild(toast);
  requestAnimationFrame(function () {
    toast.classList.add('bar-visible');
  });
  clearTimeout(barGamesRuntime.toastTimer);
  barGamesRuntime.toastTimer = setTimeout(function () {
    toast.remove();
  }, 2600);
}

function barGamesDelay(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

async function barGamesAskAI(kind, payload) {
  const fallback = barGamesFallbackDecision(kind, payload);
  try {
    if (window.BarAI && typeof window.BarAI.gameDecision === 'function') {
      const messages = [{ role: 'user', content: JSON.stringify(Object.assign({ kind: kind }, payload)) }];
      const output = await window.BarAI.gameDecision(messages, {
        decision: kind,
        context: payload,
        charAntiDrift: true,
        temperature: 0.9
      });
      if (output && typeof output === 'object') {
        return Object.assign({}, fallback, output, {
          reply: String(output.reply || fallback.reply)
        });
      }
    }
  } catch (error) {
    return fallback;
  }
  return fallback;
}

function barGamesFallbackDecision(kind, payload) {
  const pool = barGamesDialogues[kind] || barGamesDialogues.wheel;
  const reply = pool[barGamesRandom(0, pool.length - 1)];
  if (kind === 'dice') {
    return { me: barGamesRandom(1, 6), reply: reply };
  }
  if (kind === 'rps') {
    return { me: barGamesRandom(0, 2), reply: reply };
  }
  if (kind === 'flightPick') {
    const available = payload && Array.isArray(payload.available) ? payload.available : [1, 2, 3, 4, 5, 6];
    return { pick: available[barGamesRandom(0, available.length - 1)], reply: reply };
  }
  return { accept: true, reply: reply };
}

async function barGamesPlayDice() {
  const match = barGamesRuntime.match;
  if (!match || match.busy || match.complete) {
    return;
  }
  match.busy = true;
  match.status = '骰子正在桌面上翻滚。';
  barGamesRender(barRuntime.root);
  const diceNodes = barRuntime.root.querySelectorAll('.bar-dice');
  diceNodes.forEach(function (node) {
    node.classList.add('rolling');
  });
  const decisionPromise = barGamesAskAI('dice', {
    game: 'dice',
    stake: barGamesStakeText(barGamesRuntime.stake),
    drunkness: window.BarCore.getState().drunkness
  });
  const valuesPromise = barGamesDelay(700).then(function () {
    return { user: barGamesRandom(1, 6), ai: barGamesRandom(1, 6) };
  });
  const results = await Promise.all([decisionPromise, valuesPromise]);
  const decision = results[0];
  const values = results[1];
  const aiValue = Number(decision.me);
  match.userDice = values.user;
  match.aiDice = aiValue >= 1 && aiValue <= 6 ? aiValue : values.ai;
  diceNodes.forEach(function (node) {
    node.classList.remove('rolling');
  });
  if (match.userDice === match.aiDice) {
    match.status = '平局，这一轮重掷。';
    match.busy = false;
    barGamesRender(barRuntime.root);
    return;
  }
  const userWon = match.userDice > match.aiDice;
  match.userTotal += match.userDice;
  match.aiTotal += match.aiDice;
  match.userScore += userWon ? 1 : 0;
  match.aiScore += userWon ? 0 : 1;
  if (match.mode3 && match.currentRound < match.rounds) {
    match.currentRound += 1;
    match.status = (userWon ? '你拿下这一轮。' : '小机拿下这一轮。') + '继续掷下一轮。';
    match.busy = false;
    barGamesRender(barRuntime.root);
    return;
  }
  match.complete = true;
  match.status = userWon ? '你赢下这场。' : '小机赢下这场。';
  barGamesRender(barRuntime.root);
  barGamesOpenResult({
    title: userWon ? '你赢了' : '你输了',
    tone: userWon ? 'win' : 'loss',
    summary: match.mode3
      ? '三轮累计：你 ' + match.userTotal + ' 点，小机 ' + match.aiTotal + ' 点。'
      : '这一局：你 ' + match.userDice + ' 点，小机 ' + match.aiDice + ' 点。',
    stake: barGamesStakeText(barGamesRuntime.stake),
    aiReply: decision.reply,
    game: 'dice',
    recordable: true,
    loser: userWon ? 'ai' : 'user'
  });
}

async function barGamesPlayRps() {
  const match = barGamesRuntime.match;
  if (!match || match.busy || match.complete || match.selectedRps == null) {
    return;
  }
  match.busy = true;
  match.aiRps = null;
  match.aiRpsHidden = true;
  match.status = '小机正在遮住手势。';
  barGamesRender(barRuntime.root);
  const decisionPromise = barGamesAskAI('rps', {
    game: 'rps',
    stake: barGamesStakeText(barGamesRuntime.stake),
    drunkness: window.BarCore.getState().drunkness
  });
  await barGamesDelay(420);
  const decision = await decisionPromise;
  const aiValue = Number(decision.me);
  match.aiRps = aiValue >= 0 && aiValue <= 2 ? aiValue : barGamesRandom(0, 2);
  match.aiRpsHidden = false;
  const comparison = (match.selectedRps - match.aiRps + 3) % 3;
  if (comparison === 0) {
    match.status = '平局，这一轮重掷。';
    match.busy = false;
    barGamesRender(barRuntime.root);
    return;
  }
  const userWon = comparison === 1;
  match.userScore += userWon ? 1 : 0;
  match.aiScore += userWon ? 0 : 1;
  const finished = !match.mode3 || match.userScore >= 2 || match.aiScore >= 2;
  if (!finished) {
    match.currentRound += 1;
    match.status = (userWon ? '你拿下这一局。' : '小机拿下这一局。') + '下一局继续。';
    match.busy = false;
    barGamesRender(barRuntime.root);
    return;
  }
  match.complete = true;
  match.status = userWon ? '你赢下这场。' : '小机赢下这场。';
  barGamesRender(barRuntime.root);
  barGamesOpenResult({
    title: userWon ? '你赢了' : '你输了',
    tone: userWon ? 'win' : 'loss',
    summary: '猜拳比分：你 ' + match.userScore + ' 胜，小机 ' + match.aiScore + ' 胜。',
    stake: barGamesStakeText(barGamesRuntime.stake),
    aiReply: decision.reply,
    game: 'rps',
    recordable: true,
    loser: userWon ? 'ai' : 'user'
  });
}

function barGamesOpenResult(result) {
  barGamesRuntime.result = result;
  barGamesCloseLayer();
  const layer = document.createElement('div');
  layer.className = 'bar-game-layer';
  const action = result.recordable ? 'settle-game' : 'close-game-layer';
  layer.innerHTML = '<div class="bar-game-modal bar-game-result-modal">' +
    '<span class="bar-game-kicker">SETTLEMENT</span>' +
    '<h2 class="' + (result.tone === 'win' ? 'bar-result-win' : result.tone === 'neutral' ? 'bar-result-neutral' : 'bar-result-loss') + '">' + barEscape(result.title) + '</h2>' +
    '<p class="bar-result-summary">' + barEscape(result.summary) + '</p>' +
    '<div class="bar-result-stake"><span>认账条</span><strong>' + barEscape(result.stake) + '</strong><em>' + (result.recordable ? '输家会认账' : '今晚无事发生') + '</em></div>' +
    '<p class="bar-result-reply">' + barEscape(result.aiReply || '') + '</p>' +
    '<button class="bar-btn bar-btn-primary" type="button" data-game-action="' + action + '">' + (result.recordable ? '记在账上' : '知道了') + '</button>' +
  '</div>';
  barRuntime.root.appendChild(layer);
  requestAnimationFrame(function () {
    layer.classList.add('bar-visible');
  });
}

function barGamesSettleResult() {
  const result = barGamesRuntime.result;
  if (!result || !result.recordable) {
    barGamesCloseLayer();
    return;
  }
  const state = window.BarCore.getState();
  const loserText = result.loser === 'ai' ? 'Ta 认账：' : '你认账：';
  window.BarCore.recordEvent('game-settlement', loserText + result.stake, 0, {
    game: result.game,
    loser: result.loser,
    stake: result.stake
  });
  if (result.loser === 'user' && result.stake.indexOf('一杯酒') === 0 && barGamesRuntime.consecutiveLosses != null) {
    barGamesRuntime.consecutiveLosses += 1;
    if (barGamesRuntime.consecutiveLosses >= 3) {
      barGameToast('按规矩，该换茶了。');
    }
  } else {
    barGamesRuntime.consecutiveLosses = result.loser === 'user' ? 1 : 0;
  }
  barGamesCloseLayer();
  barGameToast('已记在账上，当前醉意 ' + Number(state.drunkness).toFixed(1) + ' / 10。');
}

function barGamesMakeWheelSegments() {
  const drinks = barGamesShuffle(barGamesDrinkPool()).slice(0, 4).map(function (drink) {
    return { type: 'drink', label: drink.name, detail: drink.name, drink: drink };
  });
  return drinks.concat([
    { type: 'truth', label: '真心话', detail: barGamesPickQuestion('truth') },
    { type: 'dare', label: '大冒险', detail: barGamesPickQuestion('dare') },
    { type: 'nothing', label: '无事发生', detail: '这一格放过今晚' },
    { type: 'double', label: '双倍', detail: '本局赌注按两份认账' }
  ]).map(function (segment, index) {
    segment.angle = index * 45;
    return segment;
  });
}

async function barGamesSpinWheel() {
  if (barGamesRuntime.wheelBusy || !barGamesRuntime.wheelSegments.length) {
    return;
  }
  barGamesRuntime.wheelBusy = true;
  barGamesRender(barRuntime.root);
  const wheel = barRuntime.root.querySelector('[data-wheel]');
  const pointer = barRuntime.root.querySelector('.bar-wheel-pointer');
  const targetIndex = barGamesRandom(0, barGamesRuntime.wheelSegments.length - 1);
  const targetSegment = barGamesRuntime.wheelSegments[targetIndex];
  const turns = barGamesRandom(25, 35) / 10;
  const alignment = (360 - ((barGamesRuntime.wheelRotation + targetSegment.angle + 22.5) % 360) + 360) % 360;
  const targetRotation = barGamesRuntime.wheelRotation + turns * 360 + alignment;
  if (wheel) {
    wheel.style.transition = 'transform 1800ms cubic-bezier(0.12, 0.75, 0.12, 1)';
    requestAnimationFrame(function () {
      wheel.style.transform = 'rotate(' + targetRotation + 'deg)';
    });
  }
  if (pointer) {
    pointer.classList.add('bar-wheel-pointer-jitter');
    setTimeout(function () {
      pointer.classList.remove('bar-wheel-pointer-jitter');
    }, 320);
  }
  const decisionPromise = barGamesAskAI('wheel', {
    segment: targetSegment.label,
    stake: barGamesStakeText(barGamesRuntime.stake),
    drunkness: window.BarCore.getState().drunkness
  });
  await barGamesDelay(1800);
  const decision = await decisionPromise;
  barGamesRuntime.wheelRotation = targetRotation;
  barGamesRuntime.wheelResult = targetSegment;
  barGamesRuntime.wheelBusy = false;
  barGamesOpenWheelResult(targetSegment, decision);
}

function barGamesOpenWheelResult(segment, decision) {
  let title = '';
  let summary = '';
  let stake = '';
  let recordable = true;
  if (segment.type === 'nothing') {
    title = '无事发生';
    summary = '轮盘停在「无事发生」，今晚先放过这一手。';
    stake = '无事发生';
    recordable = false;
  } else if (segment.type === 'double') {
    title = '抽中双倍';
    summary = '轮盘停在「双倍」，本局赌注按两份认账。';
    stake = '双倍：' + barGamesStakeText(barGamesRuntime.stake) + '，按两份认账';
  } else {
    title = '抽中' + segment.label;
    summary = '轮盘停在「' + segment.label + '」。';
    stake = segment.detail || segment.label;
    if (segment.type === 'drink') {
      stake = '一杯酒：' + segment.detail;
    } else {
      stake = segment.label + '：' + segment.detail;
    }
  }
  barGamesOpenResult({
    title: title,
    tone: 'neutral',
    summary: summary,
    stake: stake,
    aiReply: decision && decision.reply,
    game: 'wheel',
    recordable: recordable,
    loser: 'user'
  });
}
