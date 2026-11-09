window.showBarFlight = async function () {
  await window.BarCore.init();
  const root = barRuntime.root;
  if (!root) {
    return;
  }
  Object.assign(barFlightRuntime, {
    root: root,
    user: window.BarCore.getUserProfile(),
    companion: barRuntime.companion || await window.BarCore.getCompanion(),
    cups: barFlightMakeCups(),
    turn: 'user',
    revealed: 0,
    userHits: 0,
    aiHits: 0,
    busy: false,
    complete: false,
    resultText: ''
  });
  barFlightRender();
  barFlightBind(root);
};

const barFlightRuntime = {
  root: null,
  user: null,
  companion: null,
  cups: [],
  turn: 'user',
  revealed: 0,
  userHits: 0,
  aiHits: 0,
  busy: false,
  complete: false,
  resultText: ''
};

const barFlightDialogues = {
  pick: ['我就闻着这杯像酒。', '这杯看起来最会说谎。', '先揭开这杯看看。'],
  drink: ['这杯我记住了。', '整杯喝下，今晚认账。', '入口比闻起来直接。']
};

function barFlightShuffle(items) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[target];
    copy[target] = current;
  }
  return copy;
}

function barFlightDrinkPool() {
  const menu = window.BarCore.data.menu || {};
  return (menu.drinks || []).filter(function (drink) {
    return Number(drink.drunkness || 0) > 0 && drink.id !== 'sober-pill';
  });
}

function barFlightQuestion(difficulty) {
  const questions = window.BarCore.data.questions || {};
  const flight = questions.flight || {};
  const pool = Array.isArray(flight) ? flight : flight[difficulty] || [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : '说出一件今晚想让 Ta 知道的事。';
}

function barFlightMakeCup(kind, drink, difficulty) {
  const labels = { water: '白水', normal: '普通', strong: '最烈' };
  return {
    number: 0,
    kind: kind,
    label: labels[kind],
    difficulty: difficulty || '',
    drink: drink || null,
    question: kind === 'water' ? '' : barFlightQuestion(difficulty),
    revealed: false,
    taken: false
  };
}

function barFlightMakeCups() {
  const drinks = barFlightShuffle(barFlightDrinkPool());
  const strongDrink = drinks.slice().sort(function (left, right) {
    return Number(right.drunkness || 0) - Number(left.drunkness || 0);
  })[0] || { id: 'house-strong', name: '最烈的一杯', drunkness: 2.5 };
  const normalDrinks = drinks.filter(function (drink) {
    return drink.id !== strongDrink.id;
  }).slice(0, 2);
  if (!normalDrinks.length) {
    normalDrinks.push({ id: 'house-normal', name: '普通的一杯', drunkness: 1 });
  }
  const cups = [
    barFlightMakeCup('water', null, ''),
    barFlightMakeCup('water', null, ''),
    barFlightMakeCup('water', null, ''),
    barFlightMakeCup('normal', normalDrinks[0], 'light'),
    barFlightMakeCup('normal', normalDrinks[1] || normalDrinks[0], 'medium'),
    barFlightMakeCup('strong', strongDrink, 'heavy')
  ];
  return barFlightShuffle(cups).map(function (cup, index) {
    cup.number = index + 1;
    return cup;
  });
}

function barFlightProgressMarkup() {
  const companion = barFlightRuntime.companion || { name: '小机', avatar: '' };
  const user = barFlightRuntime.user || {};
  const current = barFlightRuntime.complete
    ? '<span class="bar-flight-turn-copy">今晚结账</span>'
    : barAvatar(barFlightRuntime.turn === 'user' ? user : companion, 'bar-flight-turn-avatar') +
      '<span class="bar-flight-turn-copy">轮到' + (barFlightRuntime.turn === 'user' ? '你' : 'Ta') + '</span>';
  const width = Math.round((barFlightRuntime.revealed / 6) * 100);
  return '<section class="bar-flight-progress">' +
    '<div class="bar-flight-progress-head"><strong>已揭 ' + barFlightRuntime.revealed + ' / 6</strong><div class="bar-flight-turn">' + current + '</div></div>' +
    '<div class="bar-flight-progress-track"><span class="bar-flight-progress-fill" style="width:' + width + '%"></span></div>' +
  '</section>';
}

function barFlightGlassMarkup(cup) {
  const liquidClass = cup.kind === 'water' ? 'bar-flight-liquid-water' : cup.kind === 'strong' ? 'bar-flight-liquid-strong' : 'bar-flight-liquid-normal';
  return '<button class="bar-flight-glass' + (cup.revealed ? ' bar-flight-revealed' : '') + (cup.taken ? ' bar-flight-taking' : '') + '" type="button" data-flight-action="reveal" data-cup="' + cup.number + '"' +
    ((cup.revealed || barFlightRuntime.busy || barFlightRuntime.complete || barFlightRuntime.turn !== 'user') ? ' disabled' : '') + '>' +
    '<span class="bar-flight-card-inner">' +
      '<span class="bar-flight-face"><span class="bar-flight-cover">?</span><span class="bar-flight-glass-art"><i class="bar-flight-bowl"></i><i class="bar-flight-stem"></i><i class="bar-flight-base"></i></span></span>' +
      '<span class="bar-flight-face bar-flight-back"><span class="bar-flight-liquid ' + liquidClass + '"></span><span class="bar-flight-glass-art bar-flight-glass-outline"><i class="bar-flight-bowl"></i><i class="bar-flight-stem"></i><i class="bar-flight-base"></i></span><span class="bar-flight-cup-label">' + barEscape(cup.label) + '</span></span>' +
    '</span><span class="bar-flight-number">' + cup.number + '</span></button>';
}

function barFlightSummaryMarkup() {
  if (!barFlightRuntime.complete) {
    return '';
  }
  const state = window.BarCore.getState();
  return '<div class="bar-flight-summary"><strong>六杯全揭</strong><span>你中了 ' + barFlightRuntime.userHits + ' 杯 · Ta 中了 ' + barFlightRuntime.aiHits + ' 杯</span><span>今晚醉意结算 ' + Number(state.drunkness).toFixed(1) + ' / 10</span></div>';
}

function barFlightMarkup() {
  const actionLabel = barFlightRuntime.turn === 'user' ? '点一杯揭开' : '让 Ta 揭';
  const actionName = barFlightRuntime.turn === 'user' ? 'user-hint' : 'ai-reveal';
  return barTopbar('六杯盲品', { settings: true }) +
    '<main class="bar-game-page">' +
      '<div class="bar-game-intro"><span class="bar-game-kicker">FLIGHT 06</span><h2>六杯里，只有三杯是白水</h2><p>轮到谁，谁来揭；揭到酒就照任务纸条做。</p></div>' +
      barFlightProgressMarkup() +
      '<section class="bar-flight-grid">' + barFlightRuntime.cups.map(barFlightGlassMarkup).join('') + '</section>' +
      '<div class="bar-flight-actions"><button class="bar-btn bar-btn-primary bar-game-primary" type="button" data-flight-action="' + actionName + '"' + (barFlightRuntime.busy || barFlightRuntime.complete ? ' disabled' : '') + '>' + actionLabel + '</button></div>' +
      barFlightSummaryMarkup() +
    '</main>';
}

function barFlightRender() {
  if (barFlightRuntime.root) {
    barFlightRuntime.root.innerHTML = barFlightMarkup();
  }
}

function barFlightBind(root) {
  if (root._barFlightBound) {
    return;
  }
  root._barFlightBound = true;
  root.addEventListener('click', barFlightHandleClick);
}

function barFlightHandleClick(event) {
  const actionNode = event.target.closest && event.target.closest('[data-flight-action]');
  if (!actionNode) {
    return;
  }
  const action = actionNode.getAttribute('data-flight-action');
  if (action === 'reveal') {
    barFlightRevealUser(Number(actionNode.getAttribute('data-cup')));
    return;
  }
  if (action === 'ai-reveal') {
    barFlightRevealAI();
    return;
  }
  if (action === 'user-hint') {
    barFlightToast('轮到你：点一杯揭开。白水安全，揭到酒要照任务纸条做。');
    return;
  }
  if (action === 'accept-task') {
    barFlightCloseLayer();
    barFlightFinishTurn('user');
  }
}

function barFlightToast(message, tone) {
  const oldToast = barFlightRuntime.root.querySelector('.bar-game-toast');
  if (oldToast) {
    oldToast.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'bar-game-toast' + (tone === 'danger' ? ' bar-game-toast-danger' : '');
  toast.textContent = message;
  barFlightRuntime.root.appendChild(toast);
  requestAnimationFrame(function () {
    toast.classList.add('bar-visible');
  });
  setTimeout(function () {
    toast.remove();
  }, 2800);
}

function barFlightCloseLayer() {
  const layer = barFlightRuntime.root.querySelector('.bar-game-layer');
  if (layer) {
    layer.remove();
  }
}

function barFlightDelay(milliseconds) {
  return new Promise(function (resolve) {
    setTimeout(resolve, milliseconds);
  });
}

async function barFlightAskAI(kind, payload) {
  const pools = {
    flightPick: barFlightDialogues.pick,
    flightDrink: barFlightDialogues.drink
  };
  const pool = pools[kind] || pools.flightPick;
  const fallbackReply = pool[Math.floor(Math.random() * pool.length)];
  const available = payload && Array.isArray(payload.available) ? payload.available : [1, 2, 3, 4, 5, 6];
  const fallback = {
    pick: available[Math.floor(Math.random() * available.length)],
    reply: fallbackReply
  };
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

async function barFlightRevealUser(number) {
  const cup = barFlightRuntime.cups.find(function (item) {
    return item.number === number;
  });
  if (!cup || cup.revealed || barFlightRuntime.busy || barFlightRuntime.complete || barFlightRuntime.turn !== 'user') {
    return;
  }
  barFlightRuntime.busy = true;
  cup.revealed = true;
  const cupNode = barFlightRuntime.root.querySelector('[data-cup="' + number + '"]');
  if (cupNode) {
    cupNode.classList.add('bar-flight-revealed');
    cupNode.disabled = true;
  }
  await barFlightDelay(450);
  barFlightRuntime.revealed += 1;
  if (cup.kind === 'water') {
    barFlightRender();
    barFlightToast('安全，这一杯是白水。');
    barFlightFinishTurn('user');
    return;
  }
  barFlightRuntime.userHits += 1;
  barFlightRender();
  barFlightOpenTask(cup);
}

function barFlightOpenTask(cup) {
  barFlightCloseLayer();
  const difficultyLabels = { light: '轻', medium: '中', heavy: '重' };
  const layer = document.createElement('div');
  layer.className = 'bar-game-layer';
  layer.innerHTML = '<div class="bar-game-modal bar-task-note">' +
    '<div class="bar-note-head"><span class="bar-game-kicker">TASK NOTE</span><span class="bar-difficulty-badge bar-difficulty-' + cup.difficulty + '">' + difficultyLabels[cup.difficulty] + '</span></div>' +
    '<h2>任务纸条</h2><p>' + barEscape(cup.question) + '</p>' +
    '<button class="bar-btn bar-btn-primary" type="button" data-flight-action="accept-task">知道了，照做</button>' +
  '</div>';
  barFlightRuntime.root.appendChild(layer);
  requestAnimationFrame(function () {
    layer.classList.add('bar-visible');
  });
}

async function barFlightRevealAI() {
  if (barFlightRuntime.busy || barFlightRuntime.complete || barFlightRuntime.turn !== 'ai') {
    return;
  }
  barFlightRuntime.busy = true;
  barFlightRender();
  const available = barFlightRuntime.cups.filter(function (cup) {
    return !cup.revealed;
  }).map(function (cup) {
    return cup.number;
  });
  const decision = await barFlightAskAI('flightPick', {
    available: available,
    revealed: barFlightRuntime.revealed,
    userHits: barFlightRuntime.userHits,
    aiHits: barFlightRuntime.aiHits,
    drunkness: window.BarCore.getState().drunkness
  });
  const requested = Number(decision.pick);
  const number = available.indexOf(requested) >= 0 ? requested : available[Math.floor(Math.random() * available.length)];
  const cup = barFlightRuntime.cups.find(function (item) {
    return item.number === number;
  });
  if (!cup) {
    barFlightRuntime.busy = false;
    barFlightRender();
    return;
  }
  cup.revealed = true;
  const cupNode = barFlightRuntime.root.querySelector('[data-cup="' + number + '"]');
  if (cupNode) {
    cupNode.classList.add('bar-flight-revealed');
    cupNode.disabled = true;
  }
  await barFlightDelay(450);
  barFlightRuntime.revealed += 1;
  if (cup.kind === 'water') {
    barFlightRender();
    barFlightToast('Ta 揭到白水，这一杯安全。');
    barFlightFinishTurn('ai');
    return;
  }
  barFlightRuntime.aiHits += 1;
  barFlightRender();
  const reactionPromise = barFlightAskAI('flightDrink', {
    cup: cup.label,
    drink: cup.drink && cup.drink.name,
    drunkness: window.BarCore.getState().drunkness
  });
  await barFlightAnimateDrink(number);
  const reaction = await reactionPromise;
  const delta = Number(cup.drink && cup.drink.drunkness || 1);
  window.BarCore.changeDrunkness(delta, 'Ta 喝下' + (cup.drink && cup.drink.name || '最烈的一杯'), {
    source: 'bar-flight',
    cup: number
  });
  const state = window.BarCore.getState();
  barFlightToast('Ta 整杯喝下，醉意升至 ' + Number(state.drunkness).toFixed(1) + ' / 10。' + reaction.reply);
  barFlightFinishTurn('ai');
}

async function barFlightAnimateDrink(number) {
  const cupNode = barFlightRuntime.root.querySelector('[data-cup="' + number + '"]');
  const avatarNode = barFlightRuntime.root.querySelector('.bar-flight-turn-avatar');
  const cup = barFlightRuntime.cups.find(function (item) {
    return item.number === number;
  });
  if (!cupNode) {
    return;
  }
  if (avatarNode) {
    const cupRect = cupNode.getBoundingClientRect();
    const avatarRect = avatarNode.getBoundingClientRect();
    cupNode.style.setProperty('--bar-flight-x', (avatarRect.left + avatarRect.width / 2 - (cupRect.left + cupRect.width / 2)) + 'px');
    cupNode.style.setProperty('--bar-flight-y', (avatarRect.top + avatarRect.height / 2 - (cupRect.top + cupRect.height / 2)) + 'px');
  }
  cupNode.classList.add('bar-flight-taking');
  await barFlightDelay(400);
  if (cup) {
    cup.taken = false;
  }
}

function barFlightFinishTurn(owner) {
  if (barFlightRuntime.revealed >= 6) {
    barFlightRuntime.complete = true;
    barFlightRuntime.turn = 'none';
    barFlightRuntime.busy = false;
    barFlightRuntime.resultText = '你中了 ' + barFlightRuntime.userHits + ' 杯，Ta 中了 ' + barFlightRuntime.aiHits + ' 杯。';
    barFlightRender();
    return;
  }
  barFlightRuntime.turn = owner === 'user' ? 'ai' : 'user';
  barFlightRuntime.busy = false;
  barFlightRender();
}
