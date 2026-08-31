/* pet-ball.js — CSS宠物悬浮球模块 */
(function(){
'use strict';

var MOODS = ['想你了~','在干嘛？','摸摸我','嘿嘿','(◕ᴗ◕)','zzZ...','饿了...','陪你','喵~','呜呜'];
var FOX_MOODS = ['想你了~','在干嘛？','摸摸头','嘿嘿','(≖ ◡ ≖)','zzZ...','饿了...','陪你','嗷~','呜呜'];
var _petState = { type: 'cat', visible: false, moodTimer: null, blinkTimer: null, apiStatus: 'idle', apiLog: [] };

// 构建小猫HTML
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
    '<div class="tail"></div>' +
  '</div>';
}

// 构建狐狸HTML
function foxHTML() {
  return '<div class="pet-fox">' +
    '<div class="ear l"></div><div class="ear r"></div>' +
    '<div class="head">' +
      '<div class="eye l"></div><div class="eye r"></div>' +
      '<div class="nose"></div><div class="mouth"></div>' +
    '</div>' +
    '<div class="tail"></div>' +
  '</div>';
}

// 显示表情气泡
function showMood(wrap, text) {
  var mood = wrap.querySelector('.pet-mood');
  if (!mood) return;
  mood.textContent = text;
  mood.classList.add('show');
  setTimeout(function(){ mood.classList.remove('show'); }, 2500);
}

// 眨眼
function startBlinking(wrap) {
  if (_petState.blinkTimer) clearInterval(_petState.blinkTimer);
  _petState.blinkTimer = setInterval(function() {
    if (!wrap.isConnected) { clearInterval(_petState.blinkTimer); return; }
    wrap.classList.add('blink');
    setTimeout(function(){ wrap.classList.remove('blink'); }, 200);
  }, 3000 + Math.random() * 3000);
}

// 随机表情
function startMoodLoop(wrap) {
  if (_petState.moodTimer) clearInterval(_petState.moodTimer);
  _petState.moodTimer = setInterval(function() {
    if (!wrap.isConnected) { clearInterval(_petState.moodTimer); return; }
    var moods = _petState.type === 'fox' ? FOX_MOODS : MOODS;
    showMood(wrap, moods[Math.floor(Math.random() * moods.length)]);
  }, 15000 + Math.random() * 20000);
}

// 互动：戳
function poke(wrap) {
  wrap.classList.remove('poke');
  void wrap.offsetWidth;
  wrap.classList.add('poke');
  var moods = _petState.type === 'fox' ? FOX_MOODS : MOODS;
  showMood(wrap, moods[Math.floor(Math.random() * moods.length)]);
  setTimeout(function(){ wrap.classList.remove('poke'); }, 500);
}

// 互动：开心
function happy(wrap) {
  wrap.classList.remove('happy');
  void wrap.offsetWidth;
  wrap.classList.add('happy');
  showMood(wrap, _petState.type === 'fox' ? '嗷嗷！' : '喵喵！');
  setTimeout(function(){ wrap.classList.remove('happy'); }, 1200);
}

// 设置API状态
function setApiStatus(status) {
  _petState.apiStatus = status;
  var dot = document.querySelector('.pet-api-dot');
  if (!dot) return;
  dot.className = 'pet-api-dot';
  if (status === 'ok') dot.classList.add('ok');
  else if (status === 'err') dot.classList.add('err');
}

// 添加API日志
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
    var icon = e.ok ? '●' : '●';
    return '<div class="pet-api-log-entry"><span class="' + cls + '">' + icon + '</span> ' +
      esc(e.model || '?') + ' <span style="opacity:.5">' + esc(e.time || '') + '</span></div>';
  }).join('');
}

// 获取当前API模型
function getCurrentModel() {
  try {
    var settings = window._aiSettings || {};
    return settings.model || 'unknown';
  } catch(e) { return 'unknown'; }
}

// 获取可用模型列表
function getAvailableModels() {
  try {
    var settings = window._aiSettings || {};
    return settings.availableModels || [];
  } catch(e) { return []; }
}

// 切换模型
async function switchModel(model) {
  try {
    if (window._aiSettings) {
      window._aiSettings.model = model;
    }
    if (window.db) {
      await window.db.config.put({ key: 'aiModel', value: model });
    }
    showMood(document.querySelector('.pet-ball-wrap'), '切到 ' + model);
    renderPopupModels();
  } catch(e) {
    console.warn('[pet-ball] 切换模型失败', e);
  }
}

// 渲染弹出面板中的模型列表
function renderPopupModels() {
  var container = document.querySelector('.pet-model-list');
  if (!container) return;
  var models = getAvailableModels();
  var current = getCurrentModel();
  if (!models.length) {
    container.innerHTML = '<div style="color:#888;font-size:11px">没有可用模型</div>';
    return;
  }
  container.innerHTML = models.map(function(m) {
    var name = typeof m === 'string' ? m : m.name || m.model || '?';
    var isActive = name === current;
    var statusCls = 'idle';
    var lastLog = _petState.apiLog.find(function(l){ return l.model === name; });
    if (lastLog) statusCls = lastLog.ok ? 'ok' : 'err';
    return '<button class="pet-model-btn' + (isActive ? ' active' : '') + '" data-model="' + esc(name) + '">' +
      '<span class="pet-model-dot ' + statusCls + '"></span>' +
      '<span>' + esc(name) + '</span>' +
      (isActive ? '<span style="margin-left:auto;font-size:10px;opacity:.5">当前</span>' : '') +
      '</button>';
  }).join('');
  container.querySelectorAll('.pet-model-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      switchModel(btn.dataset.model);
    });
  });
}

// 构建弹出面板HTML
function buildPopupHTML() {
  return '<div class="pet-popup-title">🐾 宠物控制台</div>' +
    '<div class="pet-popup-section">' +
      '<div class="pet-popup-label">API 模型</div>' +
      '<div class="pet-model-list"></div>' +
    '</div>' +
    '<div class="pet-popup-section">' +
      '<div class="pet-popup-label">最近调用</div>' +
      '<div class="pet-api-log"></div>' +
    '</div>' +
    '<div class="pet-popup-section" style="display:flex;gap:6px">' +
      '<button class="pet-model-btn" id="pet-switch-type" style="flex:1;justify-content:center">' +
        '<span>切换宠物</span></button>' +
      '<button class="pet-model-btn" id="pet-close-btn" style="flex:1;justify-content:center">' +
        '<span>关闭</span></button>' +
    '</div>';
}

// 创建宠物悬浮球
async function createPetBall() {
  var existing = document.getElementById('global-floating-ball');
  if (existing) existing.remove();
  var existing2 = document.querySelector('.pet-ball-wrap');
  if (existing2) existing2.remove();
  var popup = document.querySelector('.pet-popup');
  if (popup) popup.remove();

  var app = document.getElementById('app');
  if (!app) return;

  // 加载配置
  var config = null;
  try {
    if (window.db) {
      var row = await window.db.config.get('floatingBallSettings');
      config = row && row.value;
    }
  } catch(e) {}
  if (!config) config = {};
  _petState.type = config.petType || 'cat';

  // 创建宠物容器
  var wrap = document.createElement('div');
  wrap.className = 'pet-ball-wrap';
  wrap.style.left = (config.xRatio != null ? config.xRatio * (window.innerWidth - 60) : window.innerWidth - 70) + 'px';
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

  // 渲染模型列表
  setTimeout(renderPopupModels, 500);
}

// 绑定事件
function bindPetEvents(wrap, popup, config) {
  var isDragging = false;
  var startX, startY, startLeft, startTop;
  var dragThreshold = 5;
  var moved = false;

  function onStart(e) {
    var touch = e.touches ? e.touches[0] : e;
    startX = touch.clientX;
    startY = touch.clientY;
    startLeft = parseFloat(wrap.style.left) || 0;
    startTop = parseFloat(wrap.style.top) || 0;
    isDragging = true;
    moved = false;
    wrap.classList.add('is-dragging');
  }

  function onMove(e) {
    if (!isDragging) return;
    var touch = e.touches ? e.touches[0] : e;
    var dx = touch.clientX - startX;
    var dy = touch.clientY - startY;
    if (Math.abs(dx) > dragThreshold || Math.abs(dy) > dragThreshold) moved = true;
    if (!moved) return;
    var newLeft = Math.max(0, Math.min(window.innerWidth - 60, startLeft + dx));
    var newTop = Math.max(0, Math.min(window.innerHeight - 60, startTop + dy));
    wrap.style.left = newLeft + 'px';
    wrap.style.top = newTop + 'px';
    e.preventDefault();
  }

  function onEnd() {
    isDragging = false;
    wrap.classList.remove('is-dragging');
    if (!moved) {
      // 点击
      poke(wrap);
      togglePopup(wrap, popup);
    }
    // 保存位置
    savePetPosition(wrap, config);
  }

  wrap.addEventListener('mousedown', onStart);
  wrap.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);

  // 弹出面板按钮
  var switchBtn = popup.querySelector('#pet-switch-type');
  if (switchBtn) {
    switchBtn.addEventListener('click', function() {
      _petState.type = _petState.type === 'cat' ? 'fox' : 'cat';
      var target = wrap.querySelector('.pet-idle-target');
      if (target) target.innerHTML = _petState.type === 'fox' ? foxHTML() : catHTML();
      showMood(wrap, _petState.type === 'fox' ? '嗷！' : '喵！');
      savePetType(_petState.type);
    });
  }
  var closeBtn = popup.querySelector('#pet-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      hidePopup(popup, wrap);
    });
  }
}

// 弹出面板开关
function togglePopup(wrap, popup) {
  var isOpen = popup.classList.contains('show');
  if (isOpen) {
    hidePopup(popup, wrap);
  } else {
    showPopup(wrap, popup);
  }
}

function showPopup(wrap, popup) {
  wrap.classList.add('pet-popup-open');
  var rect = wrap.getBoundingClientRect();
  var left = Math.min(rect.left, window.innerWidth - 290);
  var top = rect.bottom + 8;
  if (top + 300 > window.innerHeight) top = rect.top - 310;
  popup.style.left = left + 'px';
  popup.style.top = Math.max(0, top) + 'px';
  popup.classList.add('show');
  renderPopupModels();
  var logEl = popup.querySelector('.pet-api-log');
  if (logEl) renderApiLog(logEl);
}

function hidePopup(popup, wrap) {
  popup.classList.remove('show');
  if (wrap) wrap.classList.remove('pet-popup-open');
}

// 保存位置
async function savePetPosition(wrap, config) {
  if (!window.db) return;
  try {
    var left = parseFloat(wrap.style.left) || 0;
    var top = parseFloat(wrap.style.top) || 0;
    config.xRatio = left / (window.innerWidth - 60);
    config.yRatio = top / (window.innerHeight - 60);
    await window.db.config.put({ key: 'floatingBallSettings', value: config });
  } catch(e) {}
}

// 保存宠物类型
async function savePetType(type) {
  if (!window.db) return;
  try {
    var row = await window.db.config.get('floatingBallSettings');
    var config = row && row.value ? row.value : {};
    config.petType = type;
    await window.db.config.put({ key: 'floatingBallSettings', value: config });
  } catch(e) {}
}

// HTML转义
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 导出
window.PetBall = {
  create: createPetBall,
  setApiStatus: setApiStatus,
  addApiLog: addApiLog,
  happy: function(){ var w = document.querySelector('.pet-ball-wrap'); if (w) happy(w); },
  poke: function(){ var w = document.querySelector('.pet-ball-wrap'); if (w) poke(w); },
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
