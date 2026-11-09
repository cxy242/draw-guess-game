window.showCandyPage = async function () {
  if (!window._wechatUid) {
    window.candyShowLoginPage(window.showCandyPage);
    return;
  }
  var core = window.CandyCore;
  if (!core) throw new Error('CandyCore 未加载');
  await core.init();
  var oldPage = document.querySelector('.candy-page');
  if (oldPage) {
    if (typeof oldPage._candyCleanup === 'function') oldPage._candyCleanup();
    oldPage.remove();
  }
  var page = document.createElement('section');
  page.className = 'candy-page';
  page.setAttribute('aria-label', '因果律软糖罐');
  var viewTimer = null;

  function cleanup() {
    clearInterval(viewTimer);
    clearTimeout(page.revealTimer);
    core.stopTicker();
  }
  page._candyCleanup = cleanup;
  await candyEnsureBuddyConfig();
  var candyBuddyId = await candyGetBuddyId();
  if (window._candyBuddyPickerPending || !candyBuddyId) {
    window._candyBuddyPickerPending = false;
    candyShowBuddyPicker(page, await candyGetBuddyCharacters());
    document.body.appendChild(page);
    return;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function formatDate(timestamp) {
    var date = new Date(Number(timestamp) || Date.now());
    return date.getFullYear() + '年' + (date.getMonth() + 1) + '月' + date.getDate() + '日';
  }

  function schemeClass(scheme) {
    var map = {
      '可乐': 'candy-scheme-coke', '青苹果': 'candy-scheme-apple',
      '焦糖咖啡': 'candy-scheme-coffee', '蜜桃': 'candy-scheme-peach',
      '荔枝': 'candy-scheme-lychee', '橘子汽水': 'candy-scheme-orange',
      '柠檬': 'candy-scheme-lemon', '绵云': 'candy-scheme-cloud',
      '葡萄': 'candy-scheme-grape', '草莓奶': 'candy-scheme-berry',
      '树莓红': 'candy-scheme-raspberry', '芭乐': 'candy-scheme-guava',
      '紫藤': 'candy-scheme-wisteria', 'mm双色': 'candy-scheme-dual',
      'mm巧克力': 'candy-scheme-chocolate', 'mm橙红': 'candy-scheme-coral',
      'mm沙': 'candy-scheme-sand', 'mm米白': 'candy-scheme-ivory',
      'mm蓝': 'candy-scheme-blue', 'mm金': 'candy-scheme-gold',
      'mm黄': 'candy-scheme-yellow'
    };
    return map[scheme] || 'candy-scheme-cloud';
  }

  function shapeClass(shape) {
    var map = {
      '方糖': 'candy-shape-square', '圆珠': 'candy-shape-round',
      '三角': 'candy-shape-triangle', '五角星': 'candy-shape-star',
      '和果子': 'candy-shape-mochi', '花果子': 'candy-shape-flower',
      '弯豆': 'candy-shape-bean'
    };
    return map[shape] || 'candy-shape-round';
  }

  function textureClass(index) {
    return ['candy-texture-stripe', 'candy-texture-dots', 'candy-texture-solid'][index % 3];
  }

  function beanArt(candy, large, index) {
    return '<span class="candy-bean ' + shapeClass(candy.shape) + ' ' +
      schemeClass(candy.scheme) + ' ' + textureClass(Number(index) || 0) +
      (large ? ' candy-bean-large' : '') + '" aria-hidden="true"></span>';
  }

  function jarArt(jar) {
    var tones = {
      blueberry: 'candy-jar-tone-1',
      raspberry: 'candy-jar-tone-2',
      cappuccino: 'candy-jar-tone-3',
      lemongrass: 'candy-jar-tone-4',
      wisteria: 'candy-jar-tone-5'
    };
    return '<span class="candy-jar-illustration ' + tones[jar.id] + '" aria-hidden="true">' +
      '<span class="candy-jar-glass"></span><span class="candy-jar-shine"></span>' +
      '<span class="candy-jar-label"></span><span class="candy-jar-lid"></span></span>';
  }

  function icon(name) {
    var icons = {
      back: 'candy-icon-back',
      coin: 'candy-icon-coin',
      scan: 'candy-icon-scan',
      jar: 'candy-icon-jar',
      candy: 'candy-icon-candy',
      person: 'candy-icon-person',
      search: 'candy-icon-search',
      unlock: 'candy-icon-unlock',
      lock: 'candy-icon-lock'
    };
    return '<span class="candy-icon ' + icons[name] + '" aria-hidden="true"></span>';
  }

  function topbar(title) {
    return '<header class="candy-topbar">' +
      '<button class="candy-back" type="button" data-candy-action="back" aria-label="返回">' + icon('back') + '</button>' +
      '<h1 class="candy-page-title">' + escapeHtml(title) + '</h1>' +
      '<button class="candy-coin-badge" type="button" data-candy-action="shop" aria-label="打开商店">' +
        '<span class="candy-star" aria-hidden="true"></span><span data-candy-coins>' + core.state.coins + '</span></button>' +
      '</header>';
  }

  function mount(content, title, backRenderer) {
    page.innerHTML = topbar(title) + '<main class="candy-content">' + content + '</main>';
    bindCommon(backRenderer);
    clearInterval(viewTimer);
    viewTimer = setInterval(function () {
      if (!document.body.contains(page)) {
        clearInterval(viewTimer);
        return;
      }
      core.refreshEffects();
      updateViewTimes();
    }, 1000);
  }

  function bindCommon(backRenderer) {
    var back = page.querySelector('[data-candy-action="back"]');
    if (back) back.addEventListener('click', function () {
      if (backRenderer) {
        backRenderer();
      } else if (window.showGameHallPage) {
        cleanup();
        page.remove();
        window.showGameHallPage();
      } else {
        cleanup();
        page.remove();
      }
    });
    var shop = page.querySelector('.candy-coin-badge');
    if (shop) shop.addEventListener('click', renderShop);
  }

  function toast(message, tone) {
    var oldToast = document.querySelector('.candy-toast');
    if (oldToast) oldToast.remove();
    var item = document.createElement('div');
    item.className = 'candy-toast' + (tone === 'danger' ? ' candy-toast-danger' : '');
    item.textContent = message;
    document.body.appendChild(item);
    requestAnimationFrame(function () { item.classList.add('is-visible'); });
    setTimeout(function () {
      item.classList.remove('is-visible');
      setTimeout(function () { item.remove(); }, 220);
    }, 2400);
  }

  function statusBanner() {
    var states = core.getActiveViews();
    if (!states.length) return '';
    var active = states[0];
    var reveal = core.getRevealContent(active.candyId);
    return '<button class="candy-status-banner" type="button" data-candy-action="status">' +
      '<span class="candy-status-pulse" aria-hidden="true"></span>' +
      '<span class="candy-status-banner-copy"><strong>' + escapeHtml(reveal ? reveal.label : '药效') + '</strong>' +
      '<small>' + escapeHtml(active.target.name || '受影响者') + ' · ' +
      '<span data-candy-state-time="' + escapeHtml(active.id) + '">' +
      core.formatRemaining(active.remainingSeconds * 1000) + '</span></small></span>' +
      '<span class="candy-link-mark" aria-hidden="true"></span></button>';
  }

  function renderHome() {
    var jar = core.getTodayJar();
    var opened = core.state.today.openJarIds.includes(jar.id);
    var activeCount = core.getActiveViews().length;
    var mysteryCount = core.state.today.mysteryPurchases.length;
    var jars = core.getJars().map(function (item) {
      return '<button class="candy-jar-card candy-card-l1' + (item.id === jar.id ? ' is-selected' : '') +
        '" type="button" data-jar-id="' + escapeHtml(item.id) + '">' + jarArt(item) +
        '<strong>' + escapeHtml(item.name) + '</strong>' +
        '<small>' + (core.state.today.openJarIds.includes(item.id) ? '今日已开' : escapeHtml(item.category || '未开封')) + '</small></button>';
    }).join('');
    var content = '<div class="candy-home-stack">' + statusBanner() +
      '<section class="candy-today candy-card-l2">' + jarArt(jar) +
        '<div class="candy-today-copy"><span class="candy-eyebrow">今日的罐子</span>' +
        '<h2>' + escapeHtml(jar.name) + '</h2><p class="candy-quote">' + escapeHtml(jar.line) + '</p>' +
        '<button class="candy-primary" type="button" data-candy-action="open-jar">' +
        (opened ? '再开一次' : '开罐') + '</button></div></section>' +
      '<section class="candy-section"><div class="candy-section-head"><div><h2>五罐陈列</h2>' +
        '<p>点选一罐，换作今天的罐子。</p></div><span class="candy-scroll-mark" aria-hidden="true"></span></div>' +
        '<div class="candy-jars">' + jars + '</div></section>' +
      '<section class="candy-status-row candy-card-l1">' +
        '<button type="button" data-candy-action="shop"><span class="candy-star"></span><strong>' + core.state.coins + '</strong><small>星币</small></button>' +
        '<button type="button" data-candy-action="shop"><strong>' + mysteryCount + ' / 6</strong><small>今日神秘柜</small></button>' +
        '<button type="button" data-candy-action="status"><strong>' + activeCount + '</strong><small>进行中药效</small></button>' +
      '</section>' +
      '<nav class="candy-entry-row" aria-label="软糖罐功能">' +
        '<button class="candy-ghost" type="button" data-candy-action="dex">图鉴</button>' +
        '<button class="candy-ghost" type="button" data-candy-action="shop">商店</button>' +
        '<button class="candy-ghost" type="button" data-candy-action="ledger">账本</button>' +
      '</nav></div>';
    mount(content, '因果律软糖罐');
    page.querySelector('[data-candy-action="open-jar"]').addEventListener('click', function () {
      var result = core.openJar();
      toast(result.firstOpen ? '开罐了，今日奖励 +' + result.reward + '✦' : '今天已经领取过开罐奖励');
      renderJar();
    });
    page.querySelectorAll('[data-jar-id]').forEach(function (button) {
      button.addEventListener('click', function () { confirmJar(button.getAttribute('data-jar-id')); });
    });
    page.querySelectorAll('[data-candy-action="dex"]').forEach(function (button) {
      button.addEventListener('click', renderDex);
    });
    page.querySelectorAll('[data-candy-action="shop"]').forEach(function (button) {
      button.addEventListener('click', renderShop);
    });
    page.querySelectorAll('[data-candy-action="ledger"]').forEach(function (button) {
      button.addEventListener('click', renderLedger);
    });
    page.querySelectorAll('[data-candy-action="status"]').forEach(function (button) {
      button.addEventListener('click', renderStatus);
    });
  }

  function layer(html, className) {
    closeLayer();
    var item = document.createElement('div');
    item.className = 'candy-layer ' + className;
    item.innerHTML = html;
    page.appendChild(item);
    requestAnimationFrame(function () { item.classList.add('is-visible'); });
    item.querySelectorAll('[data-close-layer]').forEach(function (button) {
      button.addEventListener('click', closeLayer);
    });
    return item;
  }

  function closeLayer() {
    var item = page.querySelector('.candy-layer');
    if (!item) return;
    item.classList.remove('is-visible');
    setTimeout(function () { item.remove(); }, 180);
  }

  function departAction(callback) {
    var item = page.querySelector('.candy-action-layer');
    if (!item) {
      callback();
      return;
    }
    item.classList.add('is-departing');
    setTimeout(function () {
      item.remove();
      callback();
    }, 320);
  }

  function confirmJar(jarId) {
    var jar = core.getJar(jarId);
    if (!jar) return;
    layer('<button class="candy-layer-backdrop" type="button" data-close-layer aria-label="关闭"></button>' +
      '<section class="candy-confirm candy-card-l3"><span class="candy-kicker">换今日罐</span>' +
      '<h2>换成「' + escapeHtml(jar.name) + '」？</h2><p>' + escapeHtml(jar.line) + '</p>' +
      '<div class="candy-button-row"><button class="candy-ghost" type="button" data-close-layer>再想想</button>' +
      '<button class="candy-primary" type="button" data-confirm-jar>就换这罐</button></div></section>',
      'candy-confirm-layer');
    page.querySelector('[data-confirm-jar]').addEventListener('click', function () {
      core.selectJar(jarId);
      closeLayer();
      toast('今日罐已换成「' + jar.name + '」');
      renderHome();
    });
  }

  function renderJar() {
    var jar = core.getTodayJar();
    var candies = core.getJarCandySelection(jar.id, 8);
    var candyMarkup = candies.map(function (candy, index) {
      return '<button class="candy-bean-card candy-card-l1 candy-card-l1-hover" type="button" data-candy-id="' +
        escapeHtml(candy.id) + '"><span class="candy-bean-spot">' + beanArt(candy, true, index) + '</span>' +
        '<span class="candy-appearance">' + escapeHtml(candy.shop) + '</span></button>';
    }).join('');
    var content = '<div class="candy-jar-page-stack"><section class="candy-jar-opening">' +
      '<div class="candy-jar-mouth" aria-label="罐口俯视图"><span class="candy-jar-mouth-inner"></span>' +
      '<span class="candy-jar-mouth-glow"></span></div>' +
      '<div class="candy-jar-opening-copy"><span class="candy-eyebrow">罐口俯视</span>' +
      '<h2>' + escapeHtml(jar.name) + '</h2><p>只看糖衣和形状，药效暂时保密。</p></div></section>' +
      '<section class="candy-bean-grid">' + candyMarkup + '</section>' +
      '<p class="candy-hint">点一颗糖，决定自己吃，还是递给 Ta。</p></div>';
    mount(content, '糖罐内部', renderHome);
    page.querySelectorAll('[data-candy-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        openCandyAction(button.getAttribute('data-candy-id'));
      });
    });
  }

  function openCandyAction(candyId) {
    var candy = core.getCandy(candyId);
    if (!candy) return;
    layer('<button class="candy-layer-backdrop" type="button" data-close-layer aria-label="关闭"></button>' +
      '<section class="candy-candy-action candy-card-l3"><button class="candy-close" type="button" data-close-layer aria-label="关闭"></button>' +
      '<div class="candy-action-art">' + beanArt(candy, true, 2) + '</div>' +
      '<span class="candy-eyebrow">' + escapeHtml(candy.scheme) + ' · ' + escapeHtml(candy.shape) + '</span>' +
      '<p class="candy-action-appearance">' + escapeHtml(candy.shop) + '</p>' +
      '<div class="miss-compose candy-note-compose"><input class="miss-input" data-feed-note maxlength="48" placeholder="喂糖时说一句（选填）">' +
      '<button class="miss-send" type="button" data-save-note>记下</button></div>' +
      '<div class="candy-button-row"><button class="candy-primary" type="button" data-eat-candy>我自己吃</button>' +
      '<button class="candy-ghost" type="button" data-feed-candy>喂给 Ta</button></div></section>',
      'candy-action-layer');
    var noteInput = page.querySelector('[data-feed-note]');
    var noteButton = page.querySelector('[data-save-note]');
    noteButton.addEventListener('click', function () {
      toast(noteInput.value.trim() ? '附言已记下' : '附言为空也行');
    });
    noteInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        noteButton.click();
      }
    });
    page.querySelector('[data-eat-candy]').addEventListener('click', function () {
      this.disabled = true;
      consumeCandy(candy, { id: 'user', name: '你', avatar: core.getUserProfile().avatar }, 'eaten', noteInput.value.trim());
    });
    page.querySelector('[data-feed-candy]').addEventListener('click', async function () {
      var characters = await core.getCharacters();
      if (!characters.length) {
        toast('还没有可选择的角色档案');
        return;
      }
      openTargetPicker(candy, characters, noteInput.value.trim());
    });
  }

  function openTargetPicker(candy, characters, note) {
    var characterButtons = characters.map(function (character) {
      var avatarSource = character.avatar || character.avatarUrl || character.photo || character.image;
      var avatar = avatarSource ? '<img class="candy-avatar" src="' + escapeHtml(avatarSource) + '" alt="">' :
        '<span class="candy-avatar candy-avatar-fallback">' + escapeHtml((character.name || '?').slice(0, 1)) + '</span>';
      return '<button class="candy-target-card candy-card-l1" type="button" data-target-id="' + escapeHtml(character.id) + '">' +
        avatar + '<strong>' + escapeHtml(character.name || '角色') + '</strong></button>';
    }).join('');
    layer('<button class="candy-layer-backdrop" type="button" data-close-layer aria-label="关闭"></button>' +
      '<section class="candy-target-picker candy-card-l3"><span class="candy-kicker">一人一问</span><h2>这颗糖喂给谁？</h2>' +
      '<div class="candy-target-grid">' + characterButtons + '</div>' +
      '<button class="candy-ghost" type="button" data-close-layer>返回</button></section>', 'candy-confirm-layer');
    page.querySelectorAll('[data-target-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        var character = characters.find(function (item) {
          return String(item.id) === String(button.getAttribute('data-target-id'));
        });
        if (!character) return;
        button.disabled = true;
        consumeCandy(candy, {
          type: 'character',
          id: Number(character.id),
          name: character.name,
          avatar: character.avatar || ''
        }, 'fed', note);
      });
    });
  }

  async function decide(event, payload) {
    if (window.CandyAI && typeof window.CandyAI.decision === 'function') {
      try {
        var result = await window.CandyAI.decision(Object.assign({ event: event }, payload));
        if (typeof result === 'string' && result.trim()) return result.trim();
        if (result && typeof result.text === 'string' && result.text.trim()) return result.text.trim();
      } catch (error) {
        if (window.console && window.console.warn) window.console.warn(error);
      }
    }
    var pools = {
      eaten: ['糖纸窸窣一声，今天的因果开始转动。', '先别急着判断，答案比反应来得更早。'],
      fed: ['这一颗替你递过去了，反应等它自己发生。', '附言收好，接下来交给 Ta。'],
      status: ['先演“不对劲”，再演它是哪一种不对劲。']
    };
    var pool = pools[event] || pools.status;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function injectCandyMessage(payload) {
    window.dispatchEvent(new CustomEvent('candy-message', { detail: payload }));
    if (window.BarAI && typeof window.BarAI.onCandyOffered === 'function') {
      window.BarAI.onCandyOffered(payload);
    } else if (window.BarAI && typeof window.BarAI.onDrinkOffered === 'function') {
      window.BarAI.onDrinkOffered({
        drink: {
          id: 'candy-' + payload.candyId,
          name: payload.target.name || '软糖',
          description: payload.note
        },
        message: payload.text
      });
    }
  }

  async function consumeCandy(candy, target, source, note) {
    var active = core.startCandyState(candy.id, target, source);
    if (!active) return;
    var line = await decide(source === 'fed' ? 'fed' : 'eaten', {
      candy: candy,
      target: target,
      note: note || ''
    });
    if (note) {
      core.addLedger('feed-note', '喂糖附言：' + note, 0, {
        candyId: candy.id,
        target: target
      });
      core.saveState(true);
    }
    injectCandyMessage({
      text: line,
      target: target,
      note: note || '',
      candyId: candy.id
    });
    departAction(function () {
      renderReveal(active, line, source);
    });
  }

  function renderReveal(active, line, source) {
    var reveal = core.getRevealContent(active.candyId);
    if (!reveal) return;
    var examples = reveal.examples.slice(0, 2).map(function (example) {
      return '<blockquote>' + escapeHtml(example) + '</blockquote>';
    }).join('');
    var targetName = active.target.name || '受影响者';
    var content = '<div class="candy-reveal-stack is-awaiting"><p class="candy-reveal-kicker">' +
      (source === 'fed' ? '喂给了 ' + escapeHtml(targetName) : '你自己吃下了它') + '</p>' +
      '<button class="candy-flip-card" type="button" data-flip-card aria-label="翻开揭晓卡">' +
        '<span class="candy-flip-inner"><span class="candy-flip-back">' +
          '<span class="candy-wrapper-lines"></span><strong>？</strong></span>' +
        '<span class="candy-flip-front"><small>药效揭晓</small><strong>' + escapeHtml(reveal.label) + '</strong>' +
          '<em>' + escapeHtml(reveal.reveal) + '</em></span>' +
        '<span class="candy-flip-instructions"><small>玩法说明</small><strong>怎么演</strong>' +
          '<em>' + escapeHtml(reveal.instruction.join(' ')) + '</em></span></span></button>' +
      '<section class="candy-countdown candy-card-l2"><svg class="candy-ring" viewBox="0 0 120 120" aria-label="剩余时间">' +
        '<circle class="candy-ring-track" cx="60" cy="60" r="52"></circle>' +
        '<circle class="candy-ring-progress" data-ring-progress cx="60" cy="60" r="52"></circle></svg>' +
        '<div class="candy-ring-center"><strong data-countdown="' + escapeHtml(active.id) + '">' +
        core.formatRemaining(active.remainingSeconds * 1000) + '</strong><small>真实时间</small></div>' +
        '<div class="candy-countdown-copy"><span class="candy-eyebrow">持续时间</span><strong>' +
        active.totalSeconds / 60 + ' 分钟</strong><p>' + escapeHtml(line) + '</p></div></section>' +
      '<section class="candy-play-card candy-card-l2"><div class="candy-play-copy"><h2>怎么演</h2>' +
        '<p>' + escapeHtml(reveal.instruction.join(' ')) + '</p></div><div class="candy-examples"><h3>例句</h3>' +
        examples + '</div></section>' +
      '<button class="candy-primary candy-wide" type="button" data-confirm-reveal>记下了</button></div>';
    mount(content, '药效揭晓', showCardBack);
    var stack = page.querySelector('.candy-reveal-stack');
    var flip = page.querySelector('[data-flip-card]');
    clearTimeout(page.revealTimer);
    page.revealTimer = setTimeout(function () {
      if (!document.body.contains(flip)) return;
      stack.classList.remove('is-awaiting');
      flip.classList.add('is-flipped');
    }, 1180);
    flip.addEventListener('click', function () {
      if (!flip.classList.contains('is-flipped')) return;
      if (flip.classList.contains('is-instructions')) {
        flip.classList.remove('is-instructions');
      } else {
        flip.classList.add('is-instructions');
      }
    });
    var ring = page.querySelector('[data-ring-progress]');
    var circumference = 2 * Math.PI * 52;
    ring.style.strokeDasharray = String(circumference);
    ring.style.strokeDashoffset = String(circumference);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        ring.style.strokeDashoffset = String(circumference * (1 - active.remainingRatio));
      });
    });
    page.querySelector('[data-confirm-reveal]').addEventListener('click', async function () {
      var closingLine = await decide('status', { candy: core.getCandy(active.candyId), active: active });
      core.addLedger('reveal-confirm', '记下药效：' + reveal.label + '。' + closingLine, 0, {
        candyId: active.candyId,
        stateId: active.id
      });
      core.saveState(true);
      injectCandyMessage({ text: closingLine, target: active.target, note: '', candyId: active.candyId });
      toast('药效已记入账本');
      renderHome();
    });
  }

  function showCardBack() {
    var stack = page.querySelector('.candy-reveal-stack');
    var flip = page.querySelector('[data-flip-card]');
    if (!stack || !flip) return;
    clearTimeout(page.revealTimer);
    flip.classList.remove('is-flipped', 'is-instructions');
    stack.classList.add('is-awaiting');
    page.revealTimer = setTimeout(function () {
      if (!document.body.contains(flip)) return;
      stack.classList.remove('is-awaiting');
      flip.classList.add('is-flipped');
    }, 350);
  }

  function miniRing(percent) {
    var circumference = 2 * Math.PI * 32;
    var offset = circumference * (1 - Math.max(0, Math.min(1, percent)));
    return '<svg class="candy-ring candy-ring-small" viewBox="0 0 80 80" aria-hidden="true">' +
      '<circle class="candy-ring-track" cx="40" cy="40" r="32"></circle>' +
      '<circle class="candy-ring-progress" cx="40" cy="40" r="32" style="stroke-dasharray:' +
      circumference + ';stroke-dashoffset:' + offset + '"></circle></svg>';
  }

  function targetMarkup(target) {
    if (target.type === 'character') {
      var targetAvatarSource = target.avatar || target.avatarUrl || target.photo || target.image;
      return (targetAvatarSource ? '<img class="candy-avatar candy-avatar-small" src="' + escapeHtml(targetAvatarSource) + '" alt="">' :
        '<span class="candy-avatar candy-avatar-small candy-avatar-fallback">' + escapeHtml((target.name || '?').slice(0, 1)) + '</span>') +
        '<span>' + escapeHtml(target.name || 'Ta') + '</span>';
    }
    return '<span class="candy-avatar candy-avatar-small candy-avatar-fallback">你</span><span>你</span>';
  }

  function renderStatus() {
    var states = core.getActiveViews();
    var cards = states.map(function (active) {
      var reveal = core.getRevealContent(active.candyId);
      return '<article class="candy-status-card candy-card-l1"><div class="candy-status-ring">' +
        miniRing(active.remainingRatio) + '<strong data-status-time="' + escapeHtml(active.id) + '">' +
        core.formatRemaining(active.remainingSeconds * 1000) + '</strong></div>' +
        '<div class="candy-status-copy"><span class="candy-eyebrow">' +
        escapeHtml(reveal ? reveal.name : '') + '</span><h2>' +
        escapeHtml(reveal ? reveal.label : '药效') + '</h2><div class="candy-person">' +
        targetMarkup(active.target) + '</div></div>' +
        '<button class="candy-danger-ghost" type="button" data-release-state="' +
        escapeHtml(active.id) + '">解除</button></article>';
    }).join('');
    var empty = '<section class="candy-empty"><span class="candy-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>' +
      '<h2>现在很清醒</h2><p data-status-note>没有进行中的药效，因果暂时很安静。</p>' +
      '<button class="candy-ghost" type="button" data-open-jar>去开一罐</button></section>';
    mount('<div class="candy-status-stack">' + (states.length ? cards : empty) + '</div>', '进行中的药效', renderHome);
    page.querySelectorAll('[data-release-state]').forEach(function (button) {
      button.addEventListener('click', function () {
        confirmRelease(button.getAttribute('data-release-state'));
      });
    });
    var openJar = page.querySelector('[data-open-jar]');
    if (openJar) openJar.addEventListener('click', renderJar);
    decide('status', { states: states }).then(function (line) {
      var note = page.querySelector('[data-status-note]');
      if (note) note.textContent = line;
    });
  }

  function confirmRelease(stateId) {
    var active = core.getCandyStateView(stateId);
    var reveal = active && core.getRevealContent(active.candyId);
    layer('<button class="candy-layer-backdrop" type="button" data-close-layer aria-label="关闭"></button>' +
      '<section class="candy-confirm candy-card-l3"><span class="candy-kicker">二次确认</span><h2>解除「' +
      escapeHtml(reveal ? reveal.label : '药效') + '」？</h2><p>解除后，这条药效会立即失效。</p>' +
      '<div class="candy-button-row"><button class="candy-ghost" type="button" data-close-layer>保留</button>' +
      '<button class="candy-danger" type="button" data-confirm-release>解除</button></div></section>', 'candy-confirm-layer');
    page.querySelector('[data-confirm-release]').addEventListener('click', function () {
      core.endCandyState(stateId);
      core.addLedger('state-release', '解除药效：' + (reveal ? reveal.label : '药效'), 0, { stateId: stateId });
      core.saveState(true);
      closeLayer();
      toast('药效已解除', 'danger');
      renderStatus();
    });
  }

  function updateViewTimes() {
    core.getActiveViews().forEach(function (active) {
      var value = core.formatRemaining(active.remainingSeconds * 1000);
      page.querySelectorAll('[data-candy-state-time="' + active.id + '"],[data-countdown="' +
        active.id + '"],[data-status-time="' + active.id + '"]').forEach(function (node) {
        node.textContent = value;
      });
    });
  }

  function progressRing(value, total) {
    var percent = total ? Math.max(0, Math.min(1, value / total)) : 0;
    var circumference = 2 * Math.PI * 46;
    var offset = circumference * (1 - percent);
    return '<svg class="candy-progress-ring" viewBox="0 0 110 110" aria-hidden="true">' +
      '<circle class="candy-ring-track" cx="55" cy="55" r="46"></circle>' +
      '<circle class="candy-ring-progress" cx="55" cy="55" r="46" style="stroke-dasharray:' +
      circumference + ';stroke-dashoffset:' + offset + '"></circle></svg>';
  }

  function renderDex(filter) {
    var activeFilter = filter || 'all';
    var candies = core.getCatalog().candies.slice();
    if (activeFilter === 'seen') {
      candies = candies.filter(function (candy) { return Boolean(core.getDexEntry(candy.id)); });
    } else if (activeFilter === 'unseen') {
      candies = candies.filter(function (candy) { return !core.getDexEntry(candy.id); });
    } else if (activeFilter === 'rare') {
      candies.sort(function (left, right) {
        return (Number(right.jar) || 0) - (Number(left.jar) || 0);
      });
    }
    var unlocked = core.state.dex.length;
    var total = core.getCatalog().candies.length;
    var cards = candies.map(function (candy, index) {
      var entry = core.getDexEntry(candy.id);
      if (!entry) {
        return '<article class="candy-dex-card candy-card-l1 is-locked"><div class="candy-dex-art is-silhouette">' +
          beanArt(candy, true, index) + '</div><strong>？</strong><small>尚未见过</small>' +
          '<button class="candy-ghost" type="button" disabled>未解锁</button></article>';
      }
      var reveal = core.getRevealContent(candy.id);
      var examples = reveal.examples.slice(0, 2).map(function (example) {
        return '<blockquote>' + escapeHtml(example) + '</blockquote>';
      }).join('');
      return '<article class="candy-dex-card candy-card-l1 candy-card-l1-hover is-unlocked" data-dex-id="' +
        escapeHtml(candy.id) + '"><button class="candy-dex-summary" type="button" data-expand-dex="' +
        escapeHtml(candy.id) + '"><div class="candy-dex-art">' + beanArt(candy, true, index) + '</div>' +
        '<strong>' + escapeHtml(candy.name) + '</strong><p>' + escapeHtml(candy.reveal) + '</p>' +
        '<span class="candy-link-mark" aria-hidden="true"></span></button>' +
        '<div class="candy-dex-detail"><span class="candy-eyebrow">档案 · 首见 ' +
        formatDate(entry.firstSeenAt) + '</span><p>' + escapeHtml(reveal.instruction.join(' ')) + '</p>' +
        '<div class="candy-examples"><h3>例句</h3>' + examples + '</div></div></article>';
    }).join('');
    var filters = [
      ['all', '全部'], ['seen', '已见'], ['unseen', '未见'], ['rare', '按稀有度']
    ].map(function (item) {
      return '<button class="candy-filter' + (item[0] === activeFilter ? ' is-active' : '') +
        '" type="button" data-dex-filter="' + item[0] + '">' + item[1] + '</button>';
    }).join('');
    var content = '<div class="candy-dex-stack"><section class="candy-dex-progress candy-card-l2">' +
      progressRing(unlocked, total) + '<div><span class="candy-eyebrow">糖档案进度</span>' +
      '<strong>' + unlocked + ' / ' + total + '</strong><p>每见过一颗，图鉴就会留下一条真实档案。</p></div></section>' +
      '<div class="candy-filter-row" role="group" aria-label="图鉴筛选">' + filters + '</div>' +
      '<section class="candy-dex-grid">' + cards + '</section></div>';
    mount(content, '软糖图鉴', renderHome);
    page.querySelectorAll('[data-dex-filter]').forEach(function (button) {
      button.addEventListener('click', function () {
        renderDex(button.getAttribute('data-dex-filter'));
      });
    });
    page.querySelectorAll('[data-expand-dex]').forEach(function (button) {
      button.addEventListener('click', function () {
        var card = button.closest('.candy-dex-card');
        if (card) card.classList.toggle('is-open');
      });
    });
  }

  function renderShop(restockCandyId) {
    var selection = core.getShopSelection();
    var named = selection.map(function (candy, index) {
      return '<article class="candy-shop-card candy-card-l1 candy-card-l1-hover' +
        (restockCandyId === candy.id ? ' is-restocking' : '') + '">' +
        '<div class="candy-shop-art">' + beanArt(candy, true, index) + '</div>' +
        '<div class="candy-shop-copy"><span class="candy-eyebrow">' + escapeHtml(candy.scheme) + ' · ' +
        escapeHtml(candy.shape) + '</span><h3>' + escapeHtml(candy.name) + '</h3>' +
        '<p>' + escapeHtml(candy.shop) + '</p></div>' +
        '<button class="candy-buy-button" type="button" data-buy-named="' + escapeHtml(candy.id) + '">' +
        '<span class="candy-star"></span>5 一口价</button></article>';
    }).join('');
    var bought = core.state.today.mysteryPurchases.length;
    var prices = [];
    for (var index = 0; index < 7; index += 1) {
      prices.push(core.mysteryPrice(index));
    }
    var steps = prices.map(function (price, position) {
      var purchased = position < bought;
      var current = position === bought;
      return '<button class="candy-mystery-step candy-card-l1' + (purchased ? ' is-bought' : '') +
        (current ? ' is-current' : '') + '" type="button"' + (purchased ? ' disabled' : '') +
        ' data-buy-mystery><span class="candy-mystery-door"></span><strong>' +
        (purchased ? '已取' : price + '✦') + '</strong><small>第 ' + (position + 1) + ' 格</small></button>';
    }).join('');
    var content = '<div class="candy-shop-stack"><section class="candy-wallet candy-card-l2">' +
      '<div><span class="candy-eyebrow">星币余额</span><strong><span class="candy-star"></span>' +
      core.state.coins + '</strong></div><p>每天开罐 +5✦，吃糖 +2✦，上限 50</p></section>' +
      '<section class="candy-section"><div class="candy-section-head"><div><h2>指名陈列</h2>' +
      '<p>今天罐里的糖，挑中就带走。</p></div><span class="candy-shop-ticket">5✦ / 颗</span></div>' +
      '<div class="candy-shop-grid">' + named + '</div></section>' +
      '<section class="candy-section"><div class="candy-section-head"><div><h2>神秘柜</h2>' +
      '<p>阶梯价 3、3、4、4、5、5，第 7 颗起都是 5✦。</p></div>' +
      '<span class="candy-shop-ticket">' + bought + ' / 6 今日</span></div>' +
      '<div class="candy-mystery-row">' + steps + '</div>' +
      '<button class="candy-primary candy-wide" type="button" data-buy-mystery>拿下下一格 · ' +
      core.mysteryPrice(Math.min(bought, 6)) + '✦</button></section></div>';
    mount(content, '软糖商店', renderHome);
    page.querySelectorAll('[data-buy-named]').forEach(function (button) {
      button.addEventListener('click', function () {
        var candyId = button.getAttribute('data-buy-named');
        var result = core.buyNamedCandy(candyId);
        if (!result.ok) {
          toast(result.reason, 'danger');
          return;
        }
        toast('已收入储藏罐：' + result.candy.name);
        var replacement = core.getCandiesForJar(core.state.today.jarId).find(function (candy) {
          return candy.id !== candyId && !selection.some(function (item) { return item.id === candy.id; });
        });
        renderShop(replacement ? replacement.id : candyId);
      });
    });
    page.querySelectorAll('[data-buy-mystery]').forEach(function (button) {
      button.addEventListener('click', function () {
        var result = core.buyMysteryCandy();
        if (!result.ok) {
          toast(result.reason, 'danger');
          return;
        }
        toast('神秘柜第 ' + result.position + ' 格：' + result.candy.name);
        renderShop(result.candy.id);
      });
    });
  }

  function ledgerIcon(type) {
    if (type.indexOf('shop') === 0) return 'candy-ledger-shop';
    if (type.indexOf('reward') === 0 || type.indexOf('jar') === 0) return 'candy-ledger-reward';
    if (type.indexOf('state') === 0 || type.indexOf('reveal') === 0) return 'candy-ledger-state';
    return 'candy-ledger-note';
  }

  function renderLedger() {
    var entries = core.state.ledger.slice();
    var rows = entries.length ? entries.map(function (entry) {
      var time = new Date(entry.at);
      var timeText = formatDate(entry.at) + ' ' + String(time.getHours()).padStart(2, '0') +
        ':' + String(time.getMinutes()).padStart(2, '0');
      return '<article class="candy-ledger-item candy-card-l1"><span class="candy-ledger-dot ' +
        ledgerIcon(entry.type) + '" aria-hidden="true"></span><div class="candy-ledger-copy">' +
        '<strong>' + escapeHtml(entry.text) + '</strong><small>' + timeText + '</small></div>' +
        '<span class="candy-ledger-delta' + (entry.delta > 0 ? ' is-positive' : '') +
        (entry.delta < 0 ? ' is-negative' : '') + '">' + (entry.delta > 0 ? '+' : '') +
        (entry.delta || '') + '</span></article>';
    }).join('') : '<section class="candy-empty"><h2>账本还是空的</h2><p>开一罐，第一条记录就会出现在这里。</p></section>';
    mount('<div class="candy-ledger-stack"><section class="candy-ledger-head candy-card-l2">' +
      '<div><span class="candy-eyebrow">累计记录</span><strong>' + entries.length + ' 条</strong></div>' +
      '<p>星币、开罐、药效和图鉴的因果都在这里。</p></section>' +
      '<section class="candy-timeline">' + rows + '</section></div>', '软糖账本', renderHome);
  }

  renderHome();
  document.body.appendChild(page);
};

function candyEscape(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
  });
}

function candyAvatarImage(character, className) {
  var source = character && (character.avatar || character.avatarUrl || character.photo || character.image);
  return source
    ? '<img class="' + className + '" src="' + candyEscape(source) + '" alt="' + candyEscape(character && character.name || '伙伴') + '">'
    : '<span class="' + className + ' ' + className + '-empty">' + candyEscape((character && character.name || '?').slice(0, 1)) + '</span>';
}

async function candyGetUserAccounts() {
  try {
    if (typeof window.getXUserList === 'function') {
      var result = await window.getXUserList();
      var rows = Array.isArray(result) ? result : (result && (result.users || result.characters || result.list));
      if (Array.isArray(rows) && rows.length) return rows;
    }
  } catch (error) {
  }
  var table = window.db && window.db.characters;
  if (!table) return [];
  try {
    return await table.where('type').equals('user').toArray();
  } catch (error) {
    var fallbackRows = await table.toArray();
    return fallbackRows.filter(function (row) { return row.type === 'user' || row.role === 'user'; });
  }
}

async function candyGetBuddyCharacters() {
  var table = window.db && window.db.characters;
  if (!table) return [];
  try {
    return await table.where('type').notEqual('user').toArray();
  } catch (error) {
    var rows = await table.toArray();
    return rows.filter(function (row) { return row.type !== 'user' && row.role !== 'user'; });
  }
}

async function candyGetBuddyId() {
  if (window._candyBuddyId != null) return parseInt(window._candyBuddyId, 10) || null;
  try {
    var record = await window.db.config.get('candyBuddyId');
    var value = record && (record.value ?? record.candyBuddyId);
    var id = parseInt(value, 10);
    return Number.isFinite(id) ? id : null;
  } catch (error) {
    return null;
  }
}

async function candyEnsureBuddyConfig() {
  var id = await candyGetBuddyId();
  if (id) window._candyBuddyId = id;
}

async function candySaveBuddyId(characterId) {
  var id = parseInt(characterId, 10);
  if (!Number.isFinite(id)) return;
  window._candyBuddyId = id;
  try {
    await window.db.config.put({ key: 'candyBuddyId', value: id });
  } catch (error) {
  }
}

function candyShowLoginPage(callback) {
  var old = document.querySelector('.candy-buddy-login-page');
  if (old) old.remove();
  var login = document.createElement('div');
  login.className = 'candy-buddy-login-page';
  login.innerHTML = '<button class="candy-buddy-login-close" type="button" data-candy-login-close>返回</button>' +
    '<div class="candy-buddy-login-shell"><div class="candy-buddy-login-mark"><span class="candy-icon candy-icon-person" aria-hidden="true"></span></div>' +
    '<h1 class="candy-buddy-login-title">登录微信</h1><p class="candy-buddy-login-subtitle">选择微信账号继续</p>' +
    '<button class="candy-buddy-login-wechat" type="button" data-candy-login-users>通过微信登录</button>' +
    '<div class="candy-buddy-login-accounts" data-candy-login-accounts hidden></div></div>';
  document.body.appendChild(login);
  login.querySelector('[data-candy-login-close]').addEventListener('click', function () { login.remove(); });
  login.querySelector('[data-candy-login-users]').addEventListener('click', async function () {
    var accounts = await candyGetUserAccounts();
    var container = login.querySelector('[data-candy-login-accounts]');
    container.hidden = false;
    container.innerHTML = accounts.length
      ? accounts.map(function (account) {
        return '<button class="candy-buddy-login-account" type="button" data-candy-user-id="' + candyEscape(account.id) + '">' +
          candyAvatarImage(account, 'candy-buddy-login-avatar') + '<strong>' + candyEscape(account.name) + '</strong></button>';
      }).join('')
      : '<p class="candy-buddy-login-empty">没有找到微信账号，请先在微信里登录。</p>';
    container.querySelectorAll('[data-candy-user-id]').forEach(function (button) {
      button.addEventListener('click', function () {
        window._wechatUid = String(button.dataset.candyUserId);
        window._candyBuddyPickerPending = true;
        login.remove();
        if (typeof callback === 'function') callback();
      });
    });
  });
}

function candyShowBuddyPicker(root, characters) {
  var old = root.querySelector('.candy-buddy-picker-layer');
  if (old) old.remove();
  var layer = document.createElement('div');
  layer.className = 'candy-buddy-picker-layer';
  var cards = characters.map(function (character) {
    return '<button class="candy-buddy-card" type="button" data-candy-buddy-id="' + candyEscape(character.id) + '">' +
      candyAvatarImage(character, 'candy-buddy-avatar') + '<span class="candy-buddy-copy"><strong class="candy-buddy-name">' +
      candyEscape(character.name) + '</strong><small class="candy-buddy-prompt">点这里确认</small></span></button>';
  }).join('');
  layer.innerHTML = '<section class="candy-buddy-picker-panel"><div class="candy-buddy-picker-head">' +
    '<p class="candy-buddy-picker-kicker">一人一问</p><h2 class="candy-buddy-picker-title">这罐糖，想和谁一起开？</h2>' +
    '<p class="candy-buddy-picker-copy">选中一位后，只再确认一次。</p></div>' +
    (characters.length ? '<div class="candy-buddy-list">' + cards + '</div><div class="candy-buddy-question" data-candy-buddy-question></div>' :
      '<div class="candy-buddy-empty"><h3 class="candy-buddy-empty-title">先去微信聊几句再回来</h3><p class="candy-buddy-empty-copy">角色档案会出现在这里。</p></div>') +
    '</section>';
  root.appendChild(layer);
  layer.querySelectorAll('[data-candy-buddy-id]').forEach(function (button) {
    button.addEventListener('click', function () {
      var character = characters.find(function (item) { return String(item.id) === button.dataset.candyBuddyId; });
      var question = layer.querySelector('[data-candy-buddy-question]');
      question.innerHTML = '<h3 class="candy-buddy-question-title">就是「' + candyEscape(character.name) + '」吗？</h3>' +
        '<div class="candy-buddy-question-actions"><button class="candy-buddy-secondary" type="button" data-candy-buddy-cancel>再看看</button>' +
        '<button class="candy-buddy-primary" type="button" data-candy-buddy-confirm>就是 Ta</button></div>';
      question.querySelector('[data-candy-buddy-cancel]').addEventListener('click', function () { question.innerHTML = ''; });
      question.querySelector('[data-candy-buddy-confirm]').addEventListener('click', async function () {
        await candySaveBuddyId(character.id);
        layer.remove();
        window._candyBuddyPickerPending = false;
        await window.showCandyPage();
      });
    });
  });
}
