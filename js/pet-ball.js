/* pet-ball.js — CSS宠物悬浮球 v3 精美版 */
/* 功能：橘猫/狐狸切换、多样互动、不同性格、聊天模型切换、线下模型切换、同步按钮 */
(function(){
'use strict';

var MOODS_CAT = ['喵~','想你了','摸摸我','嘿嘿','困了...','饿了...','陪你','在干嘛？','(◕ᴗ◕)','zzZ...'];
var MOODS_FOX = ['嗷~','想你了','摸摸头','嘿嘿','困了...','饿了...','陪你','在干嘛？','(≖ ◡ ≖)','zzZ...'];
var PERSONALITY_CAT = { name: '小橘', shy: false, playful: true };
var PERSONALITY_FOX = { name: '小狐', shy: true, playful: false };

var _petState = {
  type: 'cat',
  visible: false,
  moodTimer: null,
  blinkTimer: null,
  apiStatus: 'idle',
  apiLog: [],
  popupOpen: false
};

// === HTML构建 ===
function catHTML() {
  return '<div class="pet-cat">' +
    '<div class="ear l"></div><div class="ear r"></div>' +
    '<div class="head">' +
      '<div class="eye l"></div><div class="eye r"></div>' +
      '<div class="nose"></div><div class="mouth"></div>' +
      '<div class="whisker wl1"></div><div class="whisker wl2"></div>' +
      '<div class="whisker wr1"></div><div class="whisker wr2"></div>' +
      '<div class="blush bl"></div><div class="blush br"></div>' +
    '</div>' +
    '<div class="body"></div>' +
    '<div class="paw l"></div><div class="paw r"></div>' +
    '<div class="tail"></div>' +
  '</div>';
}

function foxHTML() {
  return '<div class="pet-fox">' +
    '<div class="ear l"></div><div class="ear r"></div>' +
    '<div class="head">' +
      '<div class="eye l"></div><div class="eye r"></div>' +
      '<div class="nose"></div><div class="mouth"></div>' +
      '<div class="blush bl"></div><div class="blush br"></div>' +
    '</div>' +
    '<div class="tail"></div>' +
  '</div>';
}

// === 表情气泡 ===
function showMood(wrap, text) {
  var mood = wrap.querySelector('.pet-mood');
  if (!mood) return;
  mood.textContent = text;
  mood.classList.add('show');
  setTimeout(function(){ mood.classList.remove('show'); }, 2800);
}

function randomMood() {
  var moods = _petState.type === 'fox' ? MOODS_FOX : MOODS_CAT;
  return moods[Math.floor(Math.random() * moods.length)];
}

// === 眨眼 ===
function startBlinking(wrap) {
  if (_petState.blinkTimer) clearInterval(_petState.blinkTimer);
  _petState.blinkTimer = setInterval(function() {
    if (!wrap.isConnected) { clearInterval(_petState.blinkTimer); return; }
    wrap.classList.add('blink');
    setTimeout(function(){ wrap.classList.remove('blink'); }, 180);
  }, 2500 + Math.random() * 4000);
}

// === 随机表情 ===
function startMoodLoop(wrap) {
  if (_petState.moodTimer) clearInterval(_petState.moodTimer);
  _petState.moodTimer = setInterval(function() {
    if (!wrap.isConnected) { clearInterval(_petState.moodTimer); return; }
    showMood(wrap, randomMood());
  }, 12000 + Math.random() * 18000);
}

// === 互动：戳 ===
function poke(wrap) {
  wrap.classList.remove('poke');
  void wrap.offsetWidth;
  wrap.classList.add('poke');
  var personality = _petState.type === 'fox' ? PERSONALITY_FOX : PERSONALITY_CAT;
  if (personality.shy) {
    showMood(wrap, '...');
  } else {
    showMood(wrap, randomMood());
  }
  setTimeout(function(){ wrap.classList.remove('poke'); }, 400);
}

// === 互动：开心 ===
function happy(wrap) {
  wrap.classList.remove('happy');
  void wrap.offsetWidth;
  wrap.classList.add('happy');
  var personality = _petState.type === 'fox' ? PERSONALITY_FOX : PERSONALITY_CAT;
  showMood(wrap, personality.playful ? '嘿嘿嘿！' : '嗯...');
  setTimeout(function(){ wrap.classList.remove('happy'); }, 1000);
}

// === 互动：惊讶 ===
function surprised(wrap) {
  wrap.classList.remove('surprised');
  void wrap.offsetWidth;
  wrap.classList.add('surprised');
  showMood(wrap, '!');
  setTimeout(function(){ wrap.classList.remove('surprised'); }, 800);
}

// === API状态 ===
function setApiStatus(status) {
  _petState.apiStatus = status;
  var dot = document.querySelector('.pet-api-dot');
  if (!dot) return;
  dot.className = 'pet-api-dot';
  if (status === 'ok') dot.classList.add('ok');
  else if (status === 'err') dot.classList.add('err');
}

function addApiLog(entry) {
  _petState.apiLog.unshift(entry);
  if (_petState.apiLog.length > 20) _petState.apiLog.length = 20;
  var logEl = document.querySelector('.pet-api-log');
  if (!logEl) return;
  renderApiLog(logEl);
}

function renderApiLog(container) {
  container.innerHTML = _petState.apiLog.map(function(e) {
    var cls = e.ok ? 'ok' : 'err';
    return '<div class="pet-api-log-entry"><span class="' + cls + '">●</span> ' +
      esc(e.model || '?') + ' <span style="opacity:.4">' + esc(e.time || '') + '</span></div>';
  }).join('');
}

// === 模型切换 ===
function getCurrentModel() {
  return _petState.currentModel || 'unknown';
}

function getOfflineModel() {
  return _petState.offlineModel || 'unknown';
}

// 从DB加载当前模型
async function loadCurrentModels() {
  try {
    var rows = await window.db.config.bulkGet(['apiModel', 'offlineApiModel']);
    _petState.currentModel = rows[0] ? rows[0].value : 'unknown';
    _petState.offlineModel = rows[1] ? rows[1].value : _petState.currentModel;
  } catch(e) {
    _petState.currentModel = 'unknown';
    _petState.offlineModel = 'unknown';
  }
}



function getAvailableModels() {
  return _petState.availableModels || [];
}

// 拉取API模型列表
async function fetchAvailableModels(target) {
  try {
    var url, key;
    // 线上和线下都用同一套API配置，只是模型不同
    var rows = await window.db.config.bulkGet(['apiBaseUrl', 'apiKey']);
    url = rows[0] ? rows[0].value : null;
    key = rows[1] ? rows[1].value : null;
    if (!url || !key) {
      showMood(document.querySelector('.pet-ball-wrap'), '请先配置API');
      return [];
    }
    var cleanUrl = url.replace(/\/+$/, '');
    var resp = await fetch(cleanUrl + '/v1/models', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var models = (data.data || []).map(function(m) { return m.id; }).sort();
    _petState.availableModels = models;
    showMood(document.querySelector('.pet-ball-wrap'), '拉取到 ' + models.length + ' 个模型');
    return models;
  } catch(e) {
    console.warn('[pet-ball] fetch models fail:', e);
    showMood(document.querySelector('.pet-ball-wrap'), '拉取失败');
    return [];
  }
}

async function switchChatModel(model) {
  try {
    if (window.db) await window.db.config.put({ key: 'apiModel', value: model });
    _petState.currentModel = model;
    if (window._apiConfigCache) window._apiConfigCache = null;
    showMood(document.querySelector('.pet-ball-wrap'), '聊天→ ' + model);
    happy(document.querySelector('.pet-ball-wrap'));
    renderPopupModels();
  } catch(e) { console.warn('[pet-ball] switch chat model fail', e); }
}

async function switchOfflineModel(model) {
  try {
    if (window.db) await window.db.config.put({ key: 'offlineApiModel', value: model });
    _petState.offlineModel = model;
    showMood(document.querySelector('.pet-ball-wrap'), '线下→ ' + model);
    happy(document.querySelector('.pet-ball-wrap'));
    renderPopupModels();
  } catch(e) { console.warn('[pet-ball] switch offline model fail', e); }
}

async function syncModels() {
  try {
    var chatModel = getCurrentModel();
    var offlineModel = getOfflineModel();
    // 同步到API配置
    if (window.db) {
      var apiRow = await window.db.config.get('apiSettings');
      var apiCfg = apiRow && apiRow.value ? apiRow.value : {};
      apiCfg.model = chatModel;
      await window.db.config.put({ key: 'apiSettings', value: apiCfg });
      // 同步线下
      var offRow = await window.db.config.get('offlineApiSettings');
      var offCfg = offRow && offRow.value ? offRow.value : {};
      offCfg.model = offlineModel;
      await window.db.config.put({ key: 'offlineApiSettings', value: offCfg });
    }
    showMood(document.querySelector('.pet-ball-wrap'), '已同步！');
    surprised(document.querySelector('.pet-ball-wrap'));
  } catch(e) { console.warn('[pet-ball] sync fail', e); }
}

// === 渲染弹出面板中的模型列表 ===
function renderPopupModels() {
  var chatList = document.querySelector('.pet-chat-model-list');
  var offlineList = document.querySelector('.pet-offline-model-list');
  if (!chatList && !offlineList) return;
  var models = getAvailableModels();
  var chatModel = getCurrentModel();
  var offlineModel = getOfflineModel();

  function renderList(container, current, switchFn) {
    if (!container) return;
    if (!models.length) {
      container.innerHTML = '<div style="color:#7a8b8b;font-size:11px;padding:8px 0">没有可用模型</div>';
      return;
    }
    container.innerHTML = models.map(function(m) {
      var name = typeof m === 'string' ? m : m.name || m.model || '?';
      var isActive = name === current;
      var statusCls = 'idle';
      var lastLog = _petState.apiLog.find(function(l){ return l.model === name; });
      if (lastLog) statusCls = lastLog.ok ? 'ok' : 'err';
      return '<button class="pet-model-btn' + (isActive ? ' active' : '') + '" data-model="' + esc(name) + '" data-target="' + esc(switchFn) + '">' +
        '<span class="pet-model-dot ' + statusCls + '"></span>' +
        '<span style="flex:1;text-align:left">' + esc(name) + '</span>' +
        (isActive ? '<span style="font-size:10px;opacity:.4">当前</span>' : '') +
        '</button>';
    }).join('');
    container.querySelectorAll('.pet-model-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var target = btn.dataset.target;
        if (target === 'chat') switchChatModel(btn.dataset.model);
        else if (target === 'offline') switchOfflineModel(btn.dataset.model);
      });
    });
  }

  renderList(chatList, chatModel, 'chat');
  renderList(offlineList, offlineModel, 'offline');
}

// === 弹出面板HTML ===
function buildPopupHTML() {
  return '<div class="pet-popup-title">' + (_petState.type === 'fox' ? '🦊' : '🐱') + ' 宠物控制台</div>' +
    '<div class="pet-popup-section">' +
      '<div class="pet-popup-label">聊天模型（线上）</div>' +
      '<button class="pet-sync-btn" id="pet-fetch-chat" style="margin-bottom:6px;font-size:11px;padding:6px 10px">拉取可用模型</button>' +
      '<div class="pet-chat-model-list"></div>' +
    '</div>' +
    '<div class="pet-popup-section">' +
      '<div class="pet-popup-label">聊天模型（线下）</div>' +
      '<button class="pet-sync-btn" id="pet-fetch-offline" style="margin-bottom:6px;font-size:11px;padding:6px 10px">拉取可用模型</button>' +
      '<div class="pet-offline-model-list"></div>' +
    '</div>' +
    '<div class="pet-popup-section">' +
      '<button class="pet-sync-btn" id="pet-sync-btn">同步到API配置</button>' +
    '</div>' +
    '<div class="pet-popup-section">' +
      '<div class="pet-popup-label">最近调用</div>' +
      '<div class="pet-api-log"></div>' +
    '</div>' +
    '<div class="pet-popup-section" style="display:flex;gap:8px">' +
      '<button class="pet-model-btn" id="pet-switch-type" style="flex:1;justify-content:center">' +
        '<span>切换宠物</span></button>' +
      '<button class="pet-model-btn" id="pet-close-btn" style="flex:1;justify-content:center">' +
        '<span>关闭</span></button>' +
    '</div>';
}

// === 创建宠物 ===
async function createPetBall() {
  var existing = document.getElementById('global-floating-ball');
  if (existing) existing.remove();
  var existing2 = document.querySelector('.pet-ball-wrap');
  if (existing2) existing2.remove();
  var popup = document.querySelector('.pet-popup');
  if (popup) popup.remove();

  var app = document.getElementById('app');
  if (!app) return;

  var config = null;
  try {
    if (window.db) {
      var row = await window.db.config.get('floatingBallSettings');
      config = row && row.value;
    }
  } catch(e) {}
  if (!config) config = {};
  _petState.type = config.petType || 'cat';
  await loadCurrentModels();

  // 创建容器
  var wrap = document.createElement('div');
  wrap.className = 'pet-ball-wrap';
  wrap.style.left = (config.xRatio != null ? config.xRatio * (window.innerWidth - 64) : window.innerWidth - 74) + 'px';
  wrap.style.top = (config.yRatio != null ? config.yRatio * (window.innerHeight - 80) : window.innerHeight * 0.4) + 'px';

  // API状态灯
  var dot = document.createElement('div');
  dot.className = 'pet-api-dot';
  if (_petState.apiStatus === 'ok') dot.classList.add('ok');
  else if (_petState.apiStatus === 'err') dot.classList.add('err');
  wrap.appendChild(dot);

  // 宠物本体
  var target = document.createElement('div');
  target.className = 'pet-idle-target';
  target.innerHTML = _petState.type === 'fox' ? foxHTML() : catHTML();
  wrap.appendChild(target);

  // 表情气泡
  var mood = document.createElement('div');
  mood.className = 'pet-mood';
  wrap.appendChild(mood);

  // 弹出面板
  var popupEl = document.createElement('div');
  popupEl.className = 'pet-popup';
  popupEl.innerHTML = buildPopupHTML();
  document.body.appendChild(popupEl);

  app.appendChild(wrap);

  // 绑定事件
  bindPetEvents(wrap, popupEl, config);
  startBlinking(wrap);
  startMoodLoop(wrap);
  _petState.visible = true;

  setTimeout(renderPopupModels, 500);
}

// === 绑定事件 ===
function bindPetEvents(wrap, popup, config) {
  var isDragging = false;
  var startX, startY, startLeft, startTop;
  var dragThreshold = 5;
  var moved = false;

  var pointerDownOnPet = false;
  var longPressTimer = null;
  var longPressTriggered = false;
  var LONG_PRESS_MS = 500;

  function onStart(e) {
    pointerDownOnPet = true;
    longPressTriggered = false;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = parseFloat(wrap.style.left) || 0;
    startTop = parseFloat(wrap.style.top) || 0;
    isDragging = true;
    moved = false;
    wrap.classList.add('is-dragging');
    // 长按检测
    longPressTimer = setTimeout(function() {
      if (!moved) {
        longPressTriggered = true;
        togglePopup(wrap, popup);
      }
    }, LONG_PRESS_MS);
    e.preventDefault();
  }

  function onMove(e) {
    if (!isDragging || !pointerDownOnPet) return;
    var dx = e.clientX - startX;
    var dy = e.clientY - startY;
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) {
      moved = true;
      if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    }
    if (!moved) return;
    var newLeft = Math.max(0, Math.min(window.innerWidth - 64, startLeft + dx));
    var newTop = Math.max(0, Math.min(window.innerHeight - 64, startTop + dy));
    wrap.style.left = newLeft + 'px';
    wrap.style.top = newTop + 'px';
    e.preventDefault();
  }

  function onEnd() {
    if (!pointerDownOnPet) return;
    pointerDownOnPet = false;
    isDragging = false;
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    wrap.classList.remove('is-dragging');
    if (!moved && !longPressTriggered) {
      // 短按=互动
      poke(wrap);
    }
    savePetPosition(wrap, config);
  }

  wrap.addEventListener('pointerdown', onStart, { passive: false });
  document.addEventListener('pointermove', onMove, { passive: false });
  document.addEventListener('pointerup', onEnd);
  document.addEventListener('pointercancel', onEnd);

  // 弹出面板按钮
  var switchBtn = popup.querySelector('#pet-switch-type');
  if (switchBtn) {
    switchBtn.addEventListener('click', function() {
      _petState.type = _petState.type === 'cat' ? 'fox' : 'cat';
      var target = wrap.querySelector('.pet-idle-target');
      if (target) target.innerHTML = _petState.type === 'fox' ? foxHTML() : catHTML();
      showMood(wrap, _petState.type === 'fox' ? '嗷！' : '喵！');
      savePetType(_petState.type);
      // 更新面板标题
      var title = popup.querySelector('.pet-popup-title');
      if (title) title.innerHTML = (_petState.type === 'fox' ? '🦊' : '🐱') + ' 宠物控制台';
    });
  }

  var closeBtn = popup.querySelector('#pet-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      hidePopup(popup, wrap);
    });
  }

  var syncBtn = popup.querySelector('#pet-sync-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', function() {
      syncModels();
    });
  }

  // 拉取聊天模型
  var fetchChatBtn = popup.querySelector('#pet-fetch-chat');
  if (fetchChatBtn) {
    fetchChatBtn.addEventListener('click', async function() {
      fetchChatBtn.textContent = '拉取中...';
      fetchChatBtn.disabled = true;
      await fetchAvailableModels('chat');
      renderPopupModels();
      fetchChatBtn.textContent = '拉取可用模型';
      fetchChatBtn.disabled = false;
    });
  }

  // 拉取线下模型
  var fetchOfflineBtn = popup.querySelector('#pet-fetch-offline');
  if (fetchOfflineBtn) {
    fetchOfflineBtn.addEventListener('click', async function() {
      fetchOfflineBtn.textContent = '拉取中...';
      fetchOfflineBtn.disabled = true;
      await fetchAvailableModels('offline');
      renderPopupModels();
      fetchOfflineBtn.textContent = '拉取可用模型';
      fetchOfflineBtn.disabled = false;
    });
  }
}

// === 弹出面板开关 ===
function togglePopup(wrap, popup) {
  if (popup.classList.contains('show')) {
    hidePopup(popup, wrap);
  } else {
    showPopup(wrap, popup);
  }
}

function showPopup(wrap, popup) {
  _petState.popupOpen = true;
  wrap.classList.add('pet-popup-open');
  var rect = wrap.getBoundingClientRect();
  var left = Math.min(rect.left, window.innerWidth - 310);
  var top = rect.bottom + 10;
  if (top + 350 > window.innerHeight) top = rect.top - 360;
  popup.style.left = Math.max(0, left) + 'px';
  popup.style.top = Math.max(0, top) + 'px';
  popup.classList.add('show');
  renderPopupModels();
  var logEl = popup.querySelector('.pet-api-log');
  if (logEl) renderApiLog(logEl);
}

function hidePopup(popup, wrap) {
  _petState.popupOpen = false;
  popup.classList.remove('show');
  if (wrap) wrap.classList.remove('pet-popup-open');
}

// === 保存 ===
async function savePetPosition(wrap, config) {
  if (!window.db) return;
  try {
    var left = parseFloat(wrap.style.left) || 0;
    var top = parseFloat(wrap.style.top) || 0;
    config.xRatio = left / (window.innerWidth - 64);
    config.yRatio = top / (window.innerHeight - 64);
    await window.db.config.put({ key: 'floatingBallSettings', value: config });
  } catch(e) {}
}

async function savePetType(type) {
  if (!window.db) return;
  try {
    var row = await window.db.config.get('floatingBallSettings');
    var config = row && row.value ? row.value : {};
    config.petType = type;
    await window.db.config.put({ key: 'floatingBallSettings', value: config });
  } catch(e) {}
}

// === 工具 ===
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// === 导出 ===
window.PetBall = {
  create: createPetBall,
  setApiStatus: setApiStatus,
  addApiLog: addApiLog,
  happy: function(){ var w = document.querySelector('.pet-ball-wrap'); if (w) happy(w); },
  poke: function(){ var w = document.querySelector('.pet-ball-wrap'); if (w) poke(w); },
  surprised: function(){ var w = document.querySelector('.pet-ball-wrap'); if (w) surprised(w); },
  hide: function() {
    var w = document.querySelector('.pet-ball-wrap');
    if (w) w.remove();
    var p = document.querySelector('.pet-popup');
    if (p) p.remove();
    _petState.visible = false;
  },
  isVisible: function(){ return _petState.visible; }
};

})();
