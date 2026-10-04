'use strict';
console.log('[Relmap] Module file loaded');

// ===== MINIMAL ENTRY (always works, self-contained) =====
window.showRelationshipPage = async function() {
  try {
    /* [XSS修复v1.1] MINIMAL 自包含本地 esc（不依赖 _relEsc——文件断在 L98 前不能引用它） */
    var _relMinEsc = function (s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    };
    // [兜底改造·不静默降级] 完整版未就绪时明示用户（验收：MINIMAL ENTRY 不静默）
    if (!window.__relmapFullReady) {
      console.error('[Relmap] 完整版未就绪，当前为 MINIMAL 兜底简化模式——请检查控制台上方的加载错误');
      window.showToastLong && window.showToastLong('关系图谱完整版加载失败，当前为简化模式');
    }
    var old = document.getElementById('rel-page');
    if (old) old.remove();
    var page = document.createElement('div');
    page.id = 'rel-page';
    page.className = 'full-page';
    page.style.cssText = 'z-index:400;background:#eceef1;display:flex;flex-direction:column;overflow:hidden';
    page.innerHTML = '<div style="display:flex;align-items:center;padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top));background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);border-bottom:0.5px solid rgba(107,125,141,0.12);flex-shrink:0;z-index:10"><button id="relmap-back" style="width:36px;height:36px;border:none;background:none;font-size:18px;cursor:pointer;border-radius:10px"><i class="fa fa-angle-left"></i></button><span style="flex:1;text-align:center;font-size:16px;font-weight:600;color:#2d2b2e">\u5173\u7cfb\u56fe\u8c31</span><div style="width:36px"></div></div><div id="relmap-body" style="flex:1;overflow-y:auto;padding:16px"></div>';
    page.querySelector('#relmap-back').onclick = function() { window.closePage && window.closePage('rel-page'); };
    window.openPage(page);
    var body = page.querySelector('#relmap-body');
    if (window.db && window.db.characters) {
      db.characters.where('type').equals('char').toArray().then(function(chars) {
        if (!chars.length) { body.innerHTML = '<div style="text-align:center;padding:60px;color:#9aabab"><div style="font-size:18px;font-weight:600;color:#2d2b2e;margin-bottom:8px">\u8fd8\u6ca1\u6709\u89d2\u8272</div></div>'; return; }
        var html = '';
        chars.forEach(function(c) {
          var av = c.avatar ? '<img src="' + _relMinEsc(c.avatar) + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(107,125,141,0.12)">' : '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#6b7d8d">' + _relMinEsc((c.name||'?')[0]) + '</div>';
          html += '<div data-char-id="' + c.id + '" style="display:flex;align-items:center;padding:14px 16px;margin-bottom:10px;background:#fff;border:1px solid rgba(107,125,141,0.12);border-radius:12px;box-shadow:0 1px 3px rgba(107,125,141,0.06);cursor:pointer">' + av + '<div style="flex:1;margin-left:14px;min-width:0"><div style="font-size:15px;font-weight:600;color:#2d2b2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _relMinEsc(c.name||'') + '</div><div style="font-size:13px;color:#9aabab;margin-top:3px">\u70b9\u51fb\u67e5\u770b\u5173\u7cfb\u7f51</div></div><i class="fa fa-angle-right" style="color:#9aabab;font-size:14px;opacity:0.5"></i></div>';
        });
        body.innerHTML = html;
        body.querySelectorAll('[data-char-id]').forEach(function(item) {
          item.onclick = function() {
            var charId = parseInt(item.dataset.charId);
            body.innerHTML = '<div style="text-align:center;padding:40px;color:#9aabab"><i class="fa fa-spinner fa-spin" style="font-size:24px"></i><div style="margin-top:12px">\u52a0\u8f7d\u4e2d...</div></div>';
            if (window.db && db.relationships) {
              db.relationships.where('charId').equals(charId).toArray().then(function(rels) {
                if (!rels.length) {
                  body.innerHTML = '<div style="text-align:center;padding:60px 20px"><div style="font-size:16px;font-weight:600;color:#2d2b2e;margin-bottom:8px">\u8fd8\u6ca1\u6709\u5173\u7cfb\u6570\u636e</div></div>';
                } else {
                  var h = '<div style="font-size:12px;font-weight:600;color:#9aabab;margin-bottom:12px">\u6240\u6709\u5173\u7cfb (' + rels.length + ')</div>';
                  rels.forEach(function(r) {
                    h += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:8px;background:#fff;border:1px solid rgba(107,125,141,0.08);border-radius:12px"><div style="width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;font-weight:700;color:#6b7d8d">' + _relMinEsc((r.targetName||'?')[0]) + '</div><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#2d2b2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _relMinEsc(r.targetName||'') + '</div><div style="font-size:13px;color:#9aabab;margin-top:3px">' + _relMinEsc(r.type||'\u8ba4\u8bc6') + ' \u00b7 \u4eb2\u5bc6\u5ea6 ' + (r.affinity||50) + '</div></div></div>';
                  });
                  body.innerHTML = h;
                }
              });
            }
          };
        });
      });
    }
  } catch(e) { window.toast && window.toast('\u5173\u7cfb\u56fe\u8c31\u9519\u8bef: ' + e.message); }
};
// ===== END MINIMAL ENTRY =====

// relationship.js — 关系网模块完整版 v7
// 依赖：db.js (v17), force-graph.min.js, anime.min.js
// NO IIFE — all functions at module scope, entry on window
// CSS: relationship.css (2872行) + relationship-extra.css (881行)

// =============================================================
//  CONSTANTS & STATE
// =============================================================

var _relPageId = 'rel-page';
var _relCurrentCharId = null;
var _relGraphInstance = null;
var _relImgCache = {};
var _relAnimFrame = null;
var _relGraphResizeHandler = null;
var _relParticleRAF = null;

var _REL_COLORS = {
  center: '#6b7d8d',
  close: '#5b9aff',
  friendly: 'rgba(91,154,255,0.5)',
  neutral: 'rgba(0,0,0,0.15)',
  accent: '#6b7d8d',
  accentLight: 'rgba(107,125,141,0.08)',
  bg: '#eceef1',
  card: '#ffffff',
  text: '#2d2b2e',
  textSub: '#5a6a7a',
  textMuted: '#9aabab'
};

var _REL_EASE = {
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)'
};

// =============================================================
//  UTILITY FUNCTIONS
// =============================================================

/** HTML escape */
function _relEsc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Avatar HTML with fallback */
function _relAvatarHTML(avatar, name, extraClass, size) {
  var sz = size || 44;
  var cls = extraClass || '';
  if (avatar) {
    return '<img src="' + _relEsc(avatar) + '" class="rel-avatar-ring ' + cls + '" ' +
      'style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;object-fit:cover" ' +
      'onerror="this.style.display=\'none\';if(this.nextElementSibling)this.nextElementSibling.style.display=\'flex\'">' +
      '<div class="rel-avatar-fallback ' + cls + '" style="display:none;width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;' +
      'background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));' +
      'display:flex;align-items:center;justify-content:center;font-size:' + Math.round(sz * 0.4) + 'px;font-weight:700;color:#6b7d8d">' +
      _relEsc((name||'?')[0]) + '</div>';
  }
  return '<div class="rel-avatar-fallback ' + cls + '" style="width:' + sz + 'px;height:' + sz + 'px;border-radius:50%;' +
    'background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));' +
    'display:flex;align-items:center;justify-content:center;font-size:' + Math.round(sz * 0.4) + 'px;font-weight:700;color:#6b7d8d">' +
    _relEsc((name||'?')[0]) + '</div>';
}

/** Toast notification */
function _relToast(msg, duration) {
  if (window.toast) { window.toast(msg); return; }
  var old = document.querySelector('.rel-toast');
  if (old) old.remove();
  var t = document.createElement('div');
  t.className = 'rel-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(function() { t.classList.add('show'); });
  setTimeout(function() {
    t.classList.remove('show');
    setTimeout(function() { if (t.parentNode) t.remove(); }, 300);
  }, duration || 2500);
}

/** Anime.js wrapper with fallback */
function _relAnime(targets, props) {
  if (!targets) return;
  if (window.anime) {
    props.targets = targets;
    if (!props.easing) props.easing = 'easeOutQuad';
    if (!props.duration) props.duration = 350;
    return window.anime(props);
  }
  // Fallback: just apply final state
  var els = typeof targets === 'string' ? document.querySelectorAll(targets) :
    (targets.length ? Array.from(targets) : [targets]);
  els.forEach(function(el) {
    if (props.opacity !== undefined) {
      var val = Array.isArray(props.opacity) ? props.opacity[1] : props.opacity;
      el.style.opacity = val;
    }
    if (props.translateY !== undefined) el.style.transform = 'translateY(0)';
    if (props.scale !== undefined) el.style.transform = 'scale(' + (Array.isArray(props.scale) ? props.scale[1] : props.scale) + ')';
  });
}

/** Stagger animate items */
function _relAnimateStaggerItems(selector, container) {
  var items = (container || document).querySelectorAll(selector);
  if (!items.length) return;
  items.forEach(function(el) { el.style.opacity = '0'; });
  _relAnime(items, {
    opacity: [0, 1],
    translateY: [12, 0],
    delay: window.anime ? window.anime.stagger(50, {start: 80}) : 0,
    duration: 400,
    easing: 'easeOutQuad'
  });
}

/** Create floating particles in container */
function _relCreateParticles(container, count) {
  count = count || 8;
  for (var i = 0; i < count; i++) {
    var p = document.createElement('div');
    p.className = 'rel-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = Math.random() * 100 + '%';
    p.style.animationDelay = (Math.random() * 6) + 's';
    p.style.width = p.style.height = (3 + Math.random() * 5) + 'px';
    container.appendChild(p);
  }
}

/** Skeleton loading HTML */
function _relSkeletonHTML(count) {
  count = count || 3;
  var html = '';
  for (var i = 0; i < count; i++) {
    html +=
      '<div class="rel-skeleton" style="margin-bottom:16px">' +
        '<div style="display:flex;align-items:center;gap:12px;padding:16px">' +
          '<div class="rel-skeleton-line" style="width:44px;height:44px;border-radius:50%;flex-shrink:0"></div>' +
          '<div style="flex:1">' +
            '<div class="rel-skeleton-line" style="width:60%;height:14px;margin-bottom:8px"></div>' +
            '<div class="rel-skeleton-line short" style="width:40%;height:10px"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }
  return html;
}

/** Empty state HTML */
function _relEmptyHTML(icon, title, desc) {
  return '<div class="rel-empty">' +
    '<div class="rel-empty-icon"><i class="fa ' + (icon || 'fa-inbox') + '"></i></div>' +
    '<div class="rel-empty-title">' + _relEsc(title || '暂无数据') + '</div>' +
    '<div class="rel-empty-desc">' + _relEsc(desc || '') + '</div>' +
  '</div>';
}

// =============================================================
//  DATABASE HELPERS
// =============================================================

async function _relGetAll(charId) {
  if (!window.db || !db.relationships) return [];
  try { return await db.relationships.where('charId').equals(charId).toArray(); } catch(e) { return []; }
}

async function _relGetBetween(charId, targetId) {
  if (!window.db || !db.relationships) return null;
  try {
    var all = await db.relationships.where('charId').equals(charId).toArray();
    return all.find(function(r) {
      return String(r.targetId) === String(targetId) || r.targetId === targetId;
    }) || null;
  } catch(e) { return null; }
}

async function _relGetChar(id) {
  if (!window.db) return null;
  try { return await db.characters.get(id); } catch(e) { return null; }
}

async function _relGetAllChars() {
  if (!window.db) return [];
  try { return await db.characters.toArray(); } catch(e) { return []; }
}

async function _relCountRels(charId) {
  var rels = await _relGetAll(charId);
  return rels.length;
}

async function _relGetNpcChars(charId) {
  if (!window.db || !db.npcCharacters) return [];
  try { return await db.npcCharacters.where('charId').equals(charId).toArray(); } catch(e) { return []; }
}

// =============================================================
//  PAGE HEADER HELPERS
// =============================================================

function _relSetTitle(page, title) {
  var el = page.querySelector('.rel-header-title');
  if (el) el.textContent = title;
}

function _relSetHeaderRight(page, html) {
  var el = page.querySelector('.rel-header-right');
  if (el) el.innerHTML = html;
}

function _relSetBackAction(page, fn) {
  var btn = page.querySelector('#rel-back');
  if (btn) {
    btn.onclick = null;
    btn.addEventListener('click', fn);
  }
}

// =============================================================
//  GRAPH DATA BUILDER
// =============================================================

function _relBuildGraphData(charId, relationships, allChars, centerChar) {
  var nodes = [{
    id: 'c_' + charId,
    name: centerChar.name,
    avatar: centerChar.avatar || '',
    type: 'center',
    affinity: 100
  }];
  var links = [];
  var seen = {};

  relationships.forEach(function(r) {
    var nid = String(r.targetId).indexOf('npc_') === 0 ? r.targetId : 'c_' + r.targetId;
    if (!seen[nid]) {
      seen[nid] = true;
      var nname = r.targetName || String(r.targetId);
      var nav = r.targetAvatar || '';
      var match = allChars.find(function(c) { return String(c.id) === String(r.targetId); });
      if (match) { nname = match.name; nav = match.avatar || ''; }
      nodes.push({id: nid, name: nname, avatar: nav, type: 'related', affinity: r.affinity || 50, relType: r.type});
    }
    links.push({source: 'c_' + charId, target: nid, type: r.type, affinity: r.affinity || 50});
  });

  return {nodes: nodes, links: links};
}

// =============================================================
//  IMAGE LOADING
// =============================================================

function _relLoadImg(node) {
  if (!node.avatar || _relImgCache[node.avatar]) {
    node._img = _relImgCache[node.avatar] || null;
    node._imgLoaded = !!node._img;
    return;
  }
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    _relImgCache[node.avatar] = img;
    node._img = img;
    node._imgLoaded = true;
    if (_relGraphInstance) _relGraphInstance.refresh();
  };
  img.onerror = function() { node._imgFailed = true; };
  img.src = node.avatar;
}

// =============================================================
//  GRAPH NODE RENDERING
// =============================================================

function _relNodeCanvasObject(node, ctx, globalScale) {
  if (isNaN(node.x) || isNaN(node.y)) return;
  var isCenter = node.type === 'center';
  var size = isCenter ? 28 : 18;
  var fontSize = 11 / globalScale;

  // Center node glow
  if (isCenter) {
    var pulse = 0.2 + 0.12 * Math.sin(Date.now() % 3000 / 3000 * Math.PI * 2);
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 10, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(107,125,141,' + pulse + ')';
    ctx.fill();
    ctx.restore();

    // Outer ring
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(107,125,141,0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Clip circle for avatar
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
  ctx.closePath();
  ctx.clip();

  if (node._img && node._imgLoaded) {
    try { ctx.drawImage(node._img, node.x - size, node.y - size, size * 2, size * 2); } catch(e) { _relDrawFallback(ctx, node, size); }
  } else {
    _relDrawFallback(ctx, node, size);
    _relLoadImg(node);
  }
  ctx.restore();

  // Border
  ctx.beginPath();
  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
  ctx.strokeStyle = isCenter ? 'rgba(107,125,141,0.6)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = isCenter ? 2.5 : 1;
  ctx.stroke();

  // Name label
  if (fontSize > 0.5) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = (isCenter ? 'bold ' : '') + Math.min(fontSize, 13) + 'px -apple-system, "Noto Sans SC", sans-serif';
    ctx.fillStyle = _REL_COLORS.text;
    ctx.fillText(node.name || '?', node.x, node.y + size + 5);

    // Relationship type label
    if (node.relType && !isCenter) {
      ctx.font = Math.min(fontSize * 0.85, 10) + 'px -apple-system, sans-serif';
      ctx.fillStyle = _REL_COLORS.textMuted;
      ctx.fillText(node.relType, node.x, node.y + size + 5 + fontSize + 2);
    }
  }
}

function _relDrawFallback(ctx, node, size) {
  var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size);
  if (node.type === 'center') {
    grad.addColorStop(0, '#d4dce3');
    grad.addColorStop(1, '#8fa0af');
  } else {
    grad.addColorStop(0, '#eceef1');
    grad.addColorStop(1, '#b1bfca');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
  // Initial letter
  ctx.fillStyle = node.type === 'center' ? '#fff' : '#6b7d8d';
  ctx.font = 'bold ' + (size * 0.7) + 'px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((node.name || '?')[0], node.x, node.y);
}

// =============================================================
//  GRAPH CLEANUP
// =============================================================

function _relCleanupGraph() {
  if (_relGraphInstance) {
    try { _relGraphInstance._destructor && _relGraphInstance._destructor(); } catch(e) {}
    _relGraphInstance = null;
  }
  if (_relGraphResizeHandler) {
    window.removeEventListener('resize', _relGraphResizeHandler);
    _relGraphResizeHandler = null;
  }
  if (_relAnimFrame) {
    cancelAnimationFrame(_relAnimFrame);
    _relAnimFrame = null;
  }
}

// =============================================================
//  OVERLAY HELPERS
// =============================================================

function _relAnimateOverlayIn(overlay, card) {
  overlay.style.opacity = '0';
  if (card) { card.style.transform = 'scale(0.88) translateY(20px)'; card.style.opacity = '0'; }
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    if (card) {
      card.style.transform = 'scale(1) translateY(0)';
      card.style.opacity = '1';
    }
  });
}

function _relAnimateOverlayOut(overlay, card, callback) {
  overlay.style.opacity = '0';
  if (card) { card.style.transform = 'scale(0.92) translateY(20px)'; card.style.opacity = '0'; }
  setTimeout(function() {
    if (overlay.parentNode) overlay.remove();
    if (callback) callback();
  }, 300);
}

// =============================================================
//  ENTRY POINT
// =============================================================

window.__relmapFullReady = true; // [兜底改造] 完整版入口已装载（与 MINIMAL 兜底配对）
window.showRelationshipPage = async function() {
  _relToast('关系网打开中...');
  _relCleanupGraph();

  try {
    var old = document.getElementById(_relPageId);
    if (old) old.remove();

    var page = document.createElement('div');
    page.id = _relPageId;
    page.className = 'full-page rel-page';
    page.style.zIndex = '400';

    page.innerHTML =
      '<div class="rel-header">' +
        '<button class="rel-header-back rel-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="rel-header-title rel-title">关系网</span>' +
        '<div class="rel-header-right"></div>' +
      '</div>' +
      '<div class="rel-body" id="rel-body"></div>';

    // Back button
    page.querySelector('#rel-back').addEventListener('click', function() {
      _relCleanupGraph();
      window.closePage && window.closePage(_relPageId);
    });

    window.openPage(page);
    _relRenderSelectPage(page);

  } catch(e) {
    console.error('[Relationship] open error:', e);
    _relToast('关系网打开失败: ' + e.message);
  }
};

// =============================================================
//  PAGE 1: SELECT — 选择角色
// =============================================================

async function _relRenderSelectPage(page) {
  _relCurrentCharId = null;
  _relCleanupGraph();

  var body = page.querySelector('#rel-body');
  if (!body) return;
  _relSetTitle(page, '关系网');
  _relSetHeaderRight(page, '');

  // Skeleton loading
  body.innerHTML =
    '<div class="rel-select-body">' +
      '<div class="rel-select-search">' +
        '<input class="rel-search" id="rel-search" placeholder="搜索角色..." type="text">' +
      '</div>' +
      '<div class="rel-char-grid" id="rel-char-grid">' + _relSkeletonHTML(4) + '</div>' +
    '</div>';

  // Load characters
  var chars = [];
  try { if (window.db) chars = await db.characters.where('type').equals('char').toArray(); } catch(e) {}

  var grid = page.querySelector('#rel-char-grid');
  if (!grid) return;

  if (!chars.length) {
    grid.innerHTML = _relEmptyHTML('fa-diagram-project', '还没有角色', '请先在角色档案中创建角色');
    return;
  }

  await _relRenderCharGrid(grid, chars, page);

  // Search handler
  var searchInput = page.querySelector('#rel-search');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = this.value.trim().toLowerCase();
      var filtered = q ? chars.filter(function(c) {
        return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
               (c.nick || '').toLowerCase().indexOf(q) >= 0;
      }) : chars;
      _relRenderCharGrid(grid, filtered, page);
    });
  }
}

async function _relRenderCharGrid(grid, chars, page) {
  var html = '';
  for (var i = 0; i < chars.length; i++) {
    var c = chars[i];
    var count = await _relCountRels(c.id);
    var avatarSize = 52;
    html +=
      '<div class="rel-char-item" data-id="' + c.id + '">' +
        '<div class="rel-char-avatar">' +
          _relAvatarHTML(c.avatar, c.name, '', avatarSize) +
        '</div>' +
        '<div class="rel-char-info">' +
          '<div class="rel-char-name">' + _relEsc(c.name) + '</div>' +
          '<div class="rel-char-meta">' +
            '<span class="rel-char-count">' + count + ' 条关系</span>' +
          '</div>' +
        '</div>' +
        '<div class="rel-char-arrow"><i class="fa fa-angle-right"></i></div>' +
      '</div>';
  }

  // Divider + AI extract button
  html +=
    '<div class="rel-divider-text" style="grid-column:1/-1">或</div>' +
    '<button class="rel-ai-extract rel-btn-ripple" id="rel-ai-extract-all" style="grid-column:1/-1">' +
      '<div class="rel-ai-icon"><i class="fa fa-wand-magic-sparkles"></i></div>' +
      '<div class="rel-ai-text">AI 一键提取所有关系</div>' +
      '<div class="rel-ai-subtext">从角色人设中自动提取人物关系</div>' +
      '<div class="rel-ai-progress" id="rel-ai-progress" style="display:none">' +
        '<div class="rel-loading-dots"><span></span><span></span><span></span></div>' +
      '</div>' +
    '</button>';

  grid.innerHTML = html;

  // Stagger animate
  _relAnimateStaggerItems('.rel-char-item', grid);

  // Click to graph
  grid.querySelectorAll('.rel-char-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var charId = parseInt(item.dataset.id);
      _relShowGraphPage(charId, page);
    });
  });

  // AI extract all
  var extractBtn = grid.querySelector('#rel-ai-extract-all');
  if (extractBtn) {
    extractBtn.addEventListener('click', function() {
      _relExtractAllRelationships(chars, page);
    });
  }
}

// =============================================================
//  AI EXTRACTION — 从人设提取关系
// =============================================================

async function _relExtractAllRelationships(chars, page) {
  if (!window.callAI) { _relToast('AI服务未配置'); return; }

  var progress = page.querySelector('#rel-ai-progress');
  var extractBtn = page.querySelector('#rel-ai-extract-all');
  if (progress) progress.style.display = 'block';
  if (extractBtn) extractBtn.disabled = true;
  _relToast('AI分析中，请稍候...');

  var total = 0;
  for (var i = 0; i < chars.length; i++) {
    try {
      var count = await _relExtractFromPersona(chars[i]);
      total += count;
    } catch(e) {
      console.warn('[Relationship] extract error for ' + chars[i].name + ':', e);
    }
  }

  if (progress) progress.style.display = 'none';
  if (extractBtn) extractBtn.disabled = false;
  _relToast('已提取 ' + total + ' 条关系');
  localStorage.setItem('rel_last_gen_time', String(Date.now()));

  // Refresh
  _relRenderSelectPage(page);
}

async function _relExtractFromPersona(char) {
  if (!char || !window.callAI) return 0;

  var prompt = '你是关系网络分析器。根据以下角色人设，提取所有提到的人物和他们与角色的关系。\n\n' +
    '角色名：' + (char.name || '未知') + '\n' +
    '人设：\n' + (char.description || '暂无') + '\n\n' +
    '要求：\n' +
    '1. 提取人设中明确提到的所有人物\n' +
    '2. 每个人物要有名字、关系类型、详细描述（50-100字，包含相处方式、情感深度、互动特点）\n' +
    '3. 如果人设中没有提到其他人，返回空数组\n\n' +
    '返回JSON：{"relations":[{"name":"人名","type":"关系类型","desc":"详细描述这段关系，50-100字，包含相处方式、情感深度、互动特点"}]}';

  var raw = await window.callAI([{role: 'user', content: prompt}], {responseFormat: 'json_object', charAntiDrift: true});

  var parsed;
  try {
    var obj = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;
    parsed = Array.isArray(obj) ? obj : (obj.relations || obj.relationships || obj.data || []);
  } catch(e) {
    console.warn('[Relationship] AI parse error:', e);
    parsed = [];
  }

  if (!parsed.length) return 0;

  var allChars = await _relGetAllChars();
  var otherChars = allChars.filter(function(c) { return c.id !== char.id; });
  var existingRels = await _relGetAll(char.id);
  var existingNames = existingRels.map(function(r) { return (r.targetName || '').toLowerCase(); });

  var count = 0;
  for (var j = 0; j < parsed.length; j++) {
    var r = parsed[j];
    if (!r.name) continue;
    if (existingNames.indexOf(r.name.toLowerCase()) >= 0) continue;

    var targetId = 'npc_' + Date.now() + '_' + j;
    var match = otherChars.find(function(c) {
      return (c.name || '').toLowerCase() === r.name.toLowerCase() ||
             (c.nick || '').toLowerCase() === r.name.toLowerCase();
    });
    if (match) targetId = match.id;

    await db.relationships.add({
      charId: char.id, targetId: targetId,
      targetName: r.name, targetAvatar: match ? (match.avatar || '') : '',
      type: r.type || '认识', desc: r.desc || '',
      affinity: 50, source: 'ai',
      createdAt: Date.now(), updatedAt: Date.now()
    });
    count++;
  }
  return count;
}

// =============================================================
//  PAGE 2: GRAPH — 关系图谱
// =============================================================

function _relShowGraphPage(charId, page) {
  _relCurrentCharId = charId;
  _relCleanupGraph();

  var body = page.querySelector('#rel-body');
  if (!body) return;

  body.innerHTML =
    '<div class="rel-graph-body">' +
      '<div class="rel-graph-loading" id="rel-graph-loading">' +
        '<div class="rel-loading"><div class="rel-loading-spinner"></div></div>' +
        '<span style="margin-left:12px;color:#9aabab;font-size:14px">加载图谱中...</span>' +
      '</div>' +
      '<div class="rel-graph-canvas-wrap" id="rel-graph-wrap"></div>' +
      '<div class="rel-graph-legend" id="rel-graph-legend">' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:#5b9aff"></div><span>亲密 (80+)</span></div>' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:rgba(91,154,255,0.5)"></div><span>友好 (50-79)</span></div>' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:rgba(0,0,0,0.15)"></div><span>一般 (&lt;50)</span></div>' +
      '</div>' +
      '<div class="rel-graph-tools">' +
        '<button class="rel-graph-tool-btn rel-graph-add" id="rel-graph-add" title="添加关系"><i class="fa fa-plus"></i></button>' +
        '<button class="rel-graph-tool-btn rel-graph-ai" id="rel-graph-ai" title="AI分析"><i class="fa fa-wand-magic-sparkles"></i></button>' +
        '<button class="rel-graph-tool-btn rel-graph-manage" id="rel-graph-manage" title="管理"><i class="fa fa-gear"></i></button>' +
      '</div>' +
    '</div>';

  _relSetTitle(page, '关系图');
  _relSetHeaderRight(page,
    '<button class="rel-header-btn rel-graph-refresh" id="rel-graph-refresh" title="刷新"><i class="fa fa-arrows-rotate"></i></button>'
  );

  // Animate tools entrance
  _relAnimateStaggerItems('.rel-graph-tool-btn', body);

  // Render graph
  _relRenderGraph(charId, page);

  // Tool events
  body.querySelector('#rel-graph-add').addEventListener('click', function() { _relShowAddSheet(charId, page); });
  body.querySelector('#rel-graph-ai').addEventListener('click', function() { _relShowAnalysisPage(charId, page); });
  body.querySelector('#rel-graph-manage').addEventListener('click', function() { _relShowManagePage(charId, page); });

  var refreshBtn = page.querySelector('#rel-graph-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() { _relRenderGraph(charId, page); });
  }
}

async function _relRenderGraph(charId, page) {
  var wrap = page.querySelector('#rel-graph-wrap');
  var loading = page.querySelector('#rel-graph-loading');
  if (!wrap) return;

  var char = await _relGetChar(charId);
  if (!char) { _relToast('角色不存在'); return; }

  var rels = await _relGetAll(charId);
  var allChars = await _relGetAllChars();

  if (loading) loading.style.display = 'none';

  if (!rels.length) {
    wrap.innerHTML = _relEmptyHTML('fa-wand-magic-sparkles', '还没有关系数据', '点击下方AI按钮从人设中自动提取人物关系');
    return;
  }

  if (!window.ForceGraph) {
    wrap.innerHTML = _relEmptyHTML('fa-exclamation-triangle', 'ForceGraph未加载', '请刷新页面重试');
    return;
  }

  var graphData = _relBuildGraphData(charId, rels, allChars, char);
  var w = wrap.clientWidth || 300;
  var h = wrap.clientHeight || 400;

  _relGraphInstance = window.ForceGraph()(wrap)
    .graphData(graphData)
    .backgroundColor('transparent')
    .width(w).height(h)
    .nodeLabel(function() { return ''; })
    .nodeVal(function(n) { return n.type === 'center' ? 40 : 25; })
    .linkColor(function(l) {
      var aff = l.affinity || 50;
      if (aff >= 80) return 'rgba(91,154,255,0.6)';
      if (aff >= 50) return 'rgba(91,154,255,0.3)';
      return 'rgba(0,0,0,0.1)';
    })
    .linkWidth(function(l) { return Math.max(1, (l.affinity || 50) / 25); })
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    .cooldownTime(3000)
    .onNodeClick(function(node) { _relShowDetailCard(node, charId); })
    .nodeCanvasObject(_relNodeCanvasObject);

  // BFS entrance animation
  _relAnimateGraphEntrance(graphData);

  // Resize handler
  _relGraphResizeHandler = function() {
    if (_relGraphInstance && wrap.clientWidth > 0) {
      _relGraphInstance.width(wrap.clientWidth).height(wrap.clientHeight);
    }
  };
  window.addEventListener('resize', _relGraphResizeHandler);

  // Zoom to fit after layout
  setTimeout(function() {
    if (_relGraphInstance) _relGraphInstance.zoomToFit(400, 50);
  }, 600);
}

function _relAnimateGraphEntrance(graphData) {
  var adj = {};
  graphData.links.forEach(function(l) {
    var s = typeof l.source === 'object' ? l.source.id : l.source;
    var t = typeof l.target === 'object' ? l.target.id : l.target;
    if (!adj[s]) adj[s] = [];
    if (!adj[t]) adj[t] = [];
    adj[s].push(t);
    adj[t].push(s);
  });

  var visited = {};
  var queue = [graphData.nodes[0].id];
  visited[graphData.nodes[0].id] = true;
  var order = 0;
  while (queue.length) {
    var curr = queue.shift();
    var node = graphData.nodes.find(function(n) { return n.id === curr; });
    if (node) node._animOrder = order++;
    (adj[curr] || []).forEach(function(nid) {
      if (!visited[nid]) { visited[nid] = true; queue.push(nid); }
    });
  }
  graphData.nodes.forEach(function(n) {
    if (n._animOrder === undefined) n._animOrder = order++;
  });
}

// =============================================================
//  PAGE 3: DETAIL CARD — 详情卡片
// =============================================================

async function _relShowDetailCard(node, centerCharId) {
 try {
  var targetId = node.id || node;
  var dbId = String(targetId).replace(/^c_/, '');
  var numericId = parseInt(dbId);
  if (String(numericId) === dbId) dbId = numericId;

  var old = document.getElementById('rel-detail-overlay');
  if (old) old.remove();

  var target = await _relGetChar(dbId);
  var targetName = target ? target.name : (node.name || String(targetId));
  var targetAvatar = target ? (target.avatar || '') : (node.avatar || '');
  var targetDesc = target ? (target.description || '') : '';

  var rel = null;
  if (centerCharId && String(dbId) !== String(centerCharId)) {
    rel = await _relGetBetween(centerCharId, dbId);
  }

  // Gather related relationships
  var targetRels = await _relGetAll(dbId);
  var allStored = (window.db && db.relationships) ? await db.relationships.toArray() : [];
  var incomingRels = allStored.filter(function(r) {
    return String(r.targetId) === String(dbId) && String(r.charId) !== String(dbId);
  });
  var allRels = targetRels.concat(incomingRels);

  var seenPairs = {};
  var uniqueRels = [];
  for (var i = 0; i < allRels.length; i++) {
    var r = allRels[i];
    var pairKey = Math.min(Number(r.charId)||0, Number(r.targetId)||0) + '-' + Math.max(Number(r.charId)||0, Number(r.targetId)||0);
    if (!seenPairs[pairKey]) { seenPairs[pairKey] = true; uniqueRels.push(r); }
  }

  // Build related rows HTML
  var relRowsHTML = '';
  for (var j = 0; j < Math.min(uniqueRels.length, 8); j++) {
    var rr = uniqueRels[j];
    var otherId = String(rr.charId) === String(dbId) ? rr.targetId : rr.charId;
    var otherChar = await _relGetChar(otherId);
    var otherName = otherChar ? otherChar.name : (rr.targetName || String(otherId));
    var otherAvatar = otherChar ? (otherChar.avatar || '') : '';
    relRowsHTML +=
      '<div class="rel-detail-relation-row">' +
        _relAvatarHTML(otherAvatar, otherName, 'rel-detail-relation-avatar', 32) +
        '<div class="rel-detail-relation-info">' +
          '<div class="rel-detail-relation-name">' + _relEsc(otherName) + '</div>' +
          '<div class="rel-detail-relation-type">' + _relEsc(rr.type || '认识') + '</div>' +
        '</div>' +
      '</div>';
  }
  if (!relRowsHTML) relRowsHTML = '<div class="rel-empty-hint" style="padding:12px 0;font-size:13px;color:#9aabab">暂无已知关系</div>';

  // Affinity section
  var affinityVal = rel ? (rel.affinity || 0) : 0;
  var affinityHTML = rel ?
    '<div class="rel-detail-section">' +
      '<div class="rel-detail-label">亲密度</div>' +
      '<div class="rel-affinity-bar-wrap">' +
        '<div class="rel-affinity-bar"><div class="rel-affinity-bar-fill" id="rel-aff-fill" style="width:0%"></div></div>' +
        '<span class="rel-affinity-value">' + affinityVal + '</span>' +
      '</div>' +
    '</div>' : '';

  var typeHTML = rel ? '<div class="rel-detail-type" style="display:inline-block;padding:4px 14px;border-radius:20px;background:rgba(107,125,141,0.1);color:#6b7d8d;font-size:13px;font-weight:500;margin-top:6px">' + _relEsc(rel.type || '认识') + '</div>' : '';
  var descHTML = rel && rel.desc ? '<div class="rel-detail-text" style="font-size:13px;color:#5a6a7a;line-height:1.6;margin-top:10px">' + _relEsc(rel.desc) + '</div>' : '';

  // Create overlay
  var overlay = document.createElement('div');
  overlay.id = 'rel-detail-overlay';
  overlay.className = 'rel-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 250ms ease;padding:20px';

  overlay.innerHTML =
    '<div class="rel-detail-card" style="transform:scale(0.88) translateY(20px);opacity:0;transition:transform 350ms ' + _REL_EASE.spring + ',opacity 250ms ease;max-width:340px;width:100%;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(107,125,141,0.12);overflow:hidden">' +
      '<div class="rel-detail-header" style="display:flex;flex-direction:column;align-items:center;padding:32px 24px 20px;background:linear-gradient(180deg,rgba(107,125,141,0.04) 0%,transparent 100%)">' +
        _relAvatarHTML(targetAvatar, targetName, 'rel-detail-avatar', 80) +
        '<div class="rel-detail-info" style="text-align:center;margin-top:14px">' +
          '<div class="rel-detail-name" style="font-size:20px;font-weight:700;color:#2d2b2e;letter-spacing:-0.02em">' + _relEsc(targetName) + '</div>' +
          typeHTML +
        '</div>' +
      '</div>' +
      '<div class="rel-detail-body" style="padding:20px 24px">' +
        descHTML +
        affinityHTML +
        '<div class="rel-detail-section" style="margin-top:16px">' +
          '<div class="rel-detail-label" style="font-size:12px;font-weight:600;color:#9aabab;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.05em">关联人物</div>' +
          '<div class="rel-detail-relations">' + relRowsHTML + '</div>' +
        '</div>' +
      '</div>' +
      '<div style="padding:0 24px 28px;display:flex;gap:12px">' +
        '<button class="rel-detail-close rel-btn-ghost" style="flex:1;height:44px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:rgba(107,125,141,0.05);color:#6b7d8d;font-size:14px;font-weight:600;cursor:pointer">关闭</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    var card = overlay.querySelector('.rel-detail-card');
    if (card) { card.style.transform = 'scale(1) translateY(0)'; card.style.opacity = '1'; }
    // Animate affinity bar
    var fill = document.getElementById('rel-aff-fill');
    if (fill) {
      setTimeout(function() {
        fill.style.transition = 'width 800ms ' + _REL_EASE.out;
        fill.style.width = affinityVal + '%';
      }, 150);
    }
  });

  // Close handlers
  overlay.addEventListener('click', function(e) { if (e.target === overlay) _relAnimateOverlayOut(overlay, overlay.querySelector('.rel-detail-card')); });
  var closeBtn = overlay.querySelector('.rel-detail-close');
  if (closeBtn) closeBtn.addEventListener('click', function() { _relAnimateOverlayOut(overlay, overlay.querySelector('.rel-detail-card')); });
 } catch(e) { console.error('[Relationship] detail card error:', e); _relToast('详情加载失败'); }
}

// =============================================================
//  ADD RELATIONSHIP SHEET — 底部弹窗
// =============================================================

async function _relShowAddSheet(charId, page) {
  var allChars = await _relGetAllChars();
  var others = allChars.filter(function(c) { return c.id !== charId; });
  var options = others.map(function(c) {
    return '<option value="' + c.id + '">' + _relEsc(c.name) + '</option>';
  }).join('');

  var overlay = document.createElement('div');
  overlay.className = 'rel-overlay rel-sheet-overlay';
  overlay.style.cssText = 'opacity:0;transition:opacity 250ms ease';

  var sheet = document.createElement('div');
  sheet.className = 'rel-add-sheet';
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -4px 20px rgba(107,125,141,0.1);padding:24px;padding-bottom:calc(24px + env(safe-area-inset-bottom));z-index:10002;transform:translateY(100%);transition:transform 400ms ' + _REL_EASE.drawer + ';max-height:80vh;overflow-y:auto';

  sheet.innerHTML =
    '<div class="rel-drag-handle" style="width:36px;height:4px;border-radius:2px;background:#bcc8c8;margin:0 auto 20px"></div>' +
    '<div class="rel-sheet-title" style="font-size:20px;font-weight:700;color:#2d2b2e;margin-bottom:20px;text-align:center">添加关系</div>' +
    '<div class="rel-sheet-label" style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">目标角色</div>' +
    '<select class="rel-add-target" id="rel-add-target" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;margin-bottom:14px;-webkit-appearance:none"><option value="">选择目标角色</option>' + options + '</select>' +
    '<div class="rel-sheet-label" style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系类型</div>' +
    '<input class="rel-add-type" id="rel-add-type" placeholder="如：闺蜜、同事、父亲" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;margin-bottom:14px;box-sizing:border-box">' +
    '<div class="rel-sheet-label" style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系描述（选填）</div>' +
    '<textarea class="rel-add-desc" id="rel-add-desc" placeholder="详细描述这段关系" rows="3" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;margin-bottom:14px;box-sizing:border-box;resize:none"></textarea>' +
    '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">' +
      '<div class="rel-sheet-label" style="font-size:12px;font-weight:600;color:#5a6a7a;white-space:nowrap">亲密度</div>' +
      '<input type="range" min="0" max="100" value="50" id="rel-add-aff-slider" style="flex:1">' +
      '<span class="rel-add-aff-val" id="rel-add-aff-val" style="font-size:14px;font-weight:700;color:#6b7d8d;min-width:28px;text-align:right">50</span>' +
    '</div>' +
    '<div style="display:flex;gap:12px">' +
      '<button class="rel-add-cancel rel-btn-ghost" style="flex:1;height:48px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:15px;font-weight:600;cursor:pointer">取消</button>' +
      '<button class="rel-add-save rel-btn-gradient" style="flex:2;height:48px;border-radius:12px;border:none;background:#6b7d8d;color:#fff;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(107,125,141,0.2)">确认添加</button>' +
    '</div>';

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    overlay.classList.add('show');
    sheet.style.transform = 'translateY(0)';
  });

  // Affinity slider
  var slider = sheet.querySelector('#rel-add-aff-slider');
  var valEl = sheet.querySelector('#rel-add-aff-val');
  if (slider && valEl) slider.addEventListener('input', function() { valEl.textContent = this.value; });

  function close() {
    overlay.style.opacity = '0';
    sheet.style.transform = 'translateY(100%)';
    setTimeout(function() { overlay.remove(); sheet.remove(); }, 400);
  }

  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  sheet.querySelector('.rel-add-cancel').addEventListener('click', close);

  sheet.querySelector('.rel-add-save').addEventListener('click', async function() {
    var targetId = parseInt(sheet.querySelector('#rel-add-target').value);
    var type = sheet.querySelector('#rel-add-type').value.trim();
    var desc = sheet.querySelector('#rel-add-desc').value.trim();
    var affinity = parseInt(sheet.querySelector('#rel-add-aff-slider').value) || 50;

    if (!targetId || !type) { _relToast('请选择目标并填写关系类型'); return; }
    var target = allChars.find(function(c) { return c.id === targetId; });

    try {
      await db.relationships.add({
        charId: charId, targetId: targetId,
        targetName: target ? target.name : '', targetAvatar: target ? (target.avatar || '') : '',
        type: type, desc: desc, affinity: affinity,
        source: 'manual', createdAt: Date.now(), updatedAt: Date.now()
      });
      close();
      _relToast('关系已添加');
      _relRenderGraph(charId, page);
    } catch(e) { _relToast('添加失败: ' + e.message); }
  });
}

// =============================================================
//  PAGE 4: AI ANALYSIS — AI分析页
// =============================================================

async function _relShowAnalysisPage(charId, page) {
  if (!window.callAI) { _relToast('AI服务未配置'); return; }

  var body = page.querySelector('#rel-body');
  if (!body) return;

  var char = await _relGetChar(charId);
  if (!char) { _relToast('角色不存在'); return; }

  var rels = await _relGetAll(charId);
  if (!rels.length) { _relToast('暂无关系数据，请先添加关系'); return; }

  _relSetTitle(page, 'AI 分析');
  _relSetHeaderRight(page, '');
  _relSetBackAction(page, function() { _relShowGraphPage(charId, page); });

  // Loading state
  body.innerHTML =
    '<div class="rel-analysis-body">' +
      '<div class="rel-card rel-card-glow" style="padding:32px 20px;text-align:center;border-radius:16px">' +
        '<div class="rel-loading"><div class="rel-loading-spinner"></div></div>' +
        '<div style="margin-top:14px;color:#9aabab;font-size:14px">AI 正在分析关系网络...</div>' +
      '</div>' +
    '</div>';

  // Build prompt
  var relLines = rels.map(function(r) {
    return '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + (r.desc ? '（' + r.desc.slice(0, 80) + '）' : '') + '，亲密度' + (r.affinity || 50);
  }).join('\n');

  var prompt = '你是关系分析师。根据以下角色的人设和关系数据，进行深度分析。\n\n' +
    '角色：' + char.name + '\n' +
    '人设：' + (char.description || '暂无') + '\n\n' +
    '当前关系：\n' + relLines + '\n\n' +
    '请分析并返回JSON：\n' +
    '{"impression":"对这个角色的整体印象，100-200字","stories":["关系故事1（从人设推断的互动场景）","关系故事2"],"compatibility":[{"name":"人物名","score":85,"reason":"兼容原因"}],"suggestions":["相处建议1","相处建议2"]}';

  try {
    var raw = await window.callAI([{role: 'user', content: prompt}], {responseFormat: 'json_object', charAntiDrift: true});
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    var html = '<div class="rel-analysis-body">';

    // Impression card
    if (data.impression) {
      html +=
        '<div class="rel-analysis-card rel-card-gradient-border" style="margin-bottom:16px;padding:20px;border-radius:16px;background:#fff;box-shadow:0 4px 12px rgba(107,125,141,0.06)">' +
          '<div class="rel-analysis-card-title" style="font-size:15px;font-weight:700;color:#2d2b2e;margin-bottom:10px">整体印象</div>' +
          '<div class="rel-analysis-text" style="font-size:14px;color:#5a6a7a;line-height:1.7">' + _relEsc(data.impression) + '</div>' +
        '</div>';
    }

    // Stories
    if (data.stories && data.stories.length) {
      html +=
        '<div class="rel-analysis-card" style="margin-bottom:16px;padding:20px;border-radius:16px;background:#fff;box-shadow:0 4px 12px rgba(107,125,141,0.06)">' +
          '<div class="rel-analysis-card-title" style="font-size:15px;font-weight:700;color:#2d2b2e;margin-bottom:10px">关系故事</div>';
      data.stories.forEach(function(s) {
        html += '<div class="rel-analysis-text" style="font-size:14px;color:#5a6a7a;line-height:1.7;margin-bottom:10px">' + _relEsc(s) + '</div>';
      });
      html += '</div>';
    }

    // Compatibility
    if (data.compatibility && data.compatibility.length) {
      html +=
        '<div class="rel-analysis-card" style="margin-bottom:16px;padding:20px;border-radius:16px;background:#fff;box-shadow:0 4px 12px rgba(107,125,141,0.06)">' +
          '<div class="rel-analysis-card-title" style="font-size:15px;font-weight:700;color:#2d2b2e;margin-bottom:10px">兼容度分析</div>';
      data.compatibility.forEach(function(c) {
        html +=
          '<div class="rel-analysis-rel-row" style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid rgba(107,125,141,0.06)">' +
            '<div class="rel-analysis-rel-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;color:#6b7d8d;flex-shrink:0">' + _relEsc((c.name||'?')[0]) + '</div>' +
            '<div class="rel-analysis-rel-body" style="flex:1;min-width:0">' +
              '<div class="rel-analysis-rel-name" style="font-size:14px;font-weight:600;color:#2d2b2e">' + _relEsc(c.name) + '</div>' +
              '<div class="rel-analysis-rel-type" style="font-size:12px;color:#6b7d8d;margin-top:2px">兼容度 ' + (c.score || 0) + '%</div>' +
              '<div class="rel-analysis-rel-desc" style="font-size:13px;color:#5a6a7a;margin-top:4px;line-height:1.5">' + _relEsc(c.reason || '') + '</div>' +
            '</div>' +
          '</div>';
      });
      html += '</div>';
    }

    // Suggestions
    if (data.suggestions && data.suggestions.length) {
      html +=
        '<div class="rel-analysis-card" style="margin-bottom:16px;padding:20px;border-radius:16px;background:#fff;box-shadow:0 4px 12px rgba(107,125,141,0.06)">' +
          '<div class="rel-analysis-card-title" style="font-size:15px;font-weight:700;color:#2d2b2e;margin-bottom:10px">相处建议</div>';
      data.suggestions.forEach(function(s, idx) {
        html += '<div style="display:flex;gap:10px;margin-bottom:8px"><span style="color:#6b7d8d;font-weight:600;font-size:14px">' + (idx+1) + '.</span><span style="font-size:14px;color:#5a6a7a;line-height:1.6">' + _relEsc(s) + '</span></div>';
      });
      html += '</div>';
    }

    // Back button
    html += '<button class="rel-analysis-btn" id="rel-analysis-back" style="width:100%;height:48px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:15px;font-weight:600;cursor:pointer;margin-top:8px"><i class="fa fa-angle-left"></i> 返回图谱</button>';
    html += '</div>';

    body.innerHTML = html;
    _relAnimateStaggerItems('.rel-analysis-card', body);

    var backBtn = body.querySelector('#rel-analysis-back');
    if (backBtn) backBtn.addEventListener('click', function() { _relShowGraphPage(charId, page); });

  } catch(e) {
    console.error('[Relationship] analysis error:', e);
    body.innerHTML =
      '<div class="rel-analysis-body">' +
        _relEmptyHTML('fa-exclamation-circle', '分析失败', e.message || '未知错误') +
        '<button class="rel-analysis-btn" id="rel-analysis-back" style="width:100%;height:48px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:15px;font-weight:600;cursor:pointer;margin-top:16px"><i class="fa fa-angle-left"></i> 返回图谱</button>' +
      '</div>';
    var backBtn2 = body.querySelector('#rel-analysis-back');
    if (backBtn2) backBtn2.addEventListener('click', function() { _relShowGraphPage(charId, page); });
  }
}

// =============================================================
//  PAGE 5: MANAGEMENT — 管理页
// =============================================================

async function _relShowManagePage(charId, page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;

  var char = await _relGetChar(charId);
  if (!char) return;

  _relSetTitle(page, char.name + ' 的关系');
  _relSetHeaderRight(page,
    '<button class="rel-header-btn" id="rel-manage-add" title="添加"><i class="fa fa-plus"></i></button>'
  );
  _relSetBackAction(page, function() { _relShowGraphPage(charId, page); });

  var rels = await _relGetAll(charId);
  var allChars = await _relGetAllChars();

  var html = '<div class="rel-manage-body" style="padding:16px">';

  if (!rels.length) {
    html += _relEmptyHTML('fa-users', '暂无关系', '点击右上角 + 添加关系');
  } else {
    html += '<div class="rel-manage-section-title" style="font-size:12px;font-weight:600;color:#9aabab;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">所有关系 (' + rels.length + ')</div>';
    html += '<div class="rel-manage-list">';
    for (var i = 0; i < rels.length; i++) {
      var r = rels[i];
      var targetChar = allChars.find(function(c) { return String(c.id) === String(r.targetId); });
      var tName = targetChar ? targetChar.name : (r.targetName || String(r.targetId));
      var tAvatar = targetChar ? (targetChar.avatar || '') : (r.targetAvatar || '');
      var affColor = (r.affinity || 50) >= 80 ? '#5b9aff' : (r.affinity || 50) >= 50 ? '#8fa0af' : '#bcc8c8';
      html +=
        '<div class="rel-manage-item" data-rel-id="' + r.id + '" data-target-id="' + r.targetId + '" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:8px;background:#fff;border:1px solid rgba(107,125,141,0.08);border-radius:12px;cursor:pointer;transition:transform 150ms ease,box-shadow 150ms ease">' +
          '<div class="rel-manage-item-avatar">' + _relAvatarHTML(tAvatar, tName, '', 44) + '</div>' +
          '<div class="rel-manage-item-info" style="flex:1;min-width:0">' +
            '<div class="rel-manage-item-name" style="font-size:15px;font-weight:600;color:#2d2b2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _relEsc(tName) + '</div>' +
            '<div class="rel-manage-item-sub" style="font-size:13px;color:#9aabab;margin-top:3px">' + _relEsc(r.type || '认识') + ' · <span style="color:' + affColor + '">亲密度 ' + (r.affinity || 50) + '</span></div>' +
          '</div>' +
          '<div class="rel-manage-item-arrow" style="color:#bcc8c8;font-size:14px"><i class="fa fa-angle-right"></i></div>' +
        '</div>';
    }
    html += '</div>';
    html += '<button class="rel-clear-all" id="rel-clear-all" style="display:block;width:100%;padding:14px;margin-top:20px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.05);border-radius:12px;color:#e74c3c;font-size:14px;font-weight:600;cursor:pointer">清空所有关系</button>';
  }

  html += '</div>';
  body.innerHTML = html;

  _relAnimateStaggerItems('.rel-manage-item', body);

  // Click to edit
  body.querySelectorAll('.rel-manage-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var relId = parseInt(item.dataset.relId);
      var targetId = item.dataset.targetId;
      _relShowEditModal(charId, relId, targetId, page);
    });
  });

  // Add button
  var addBtn = page.querySelector('#rel-manage-add');
  if (addBtn) addBtn.addEventListener('click', function() { _relShowAddSheet(charId, page); });

  // Clear all
  var clearBtn = body.querySelector('#rel-clear-all');
  if (clearBtn) {
    clearBtn.addEventListener('click', async function() {
      if (!confirm('确定清空所有关系？此操作不可撤销。')) return;
      var all = await _relGetAll(charId);
      for (var k = 0; k < all.length; k++) {
        await db.relationships.delete(all[k].id);
      }
      _relToast('已清空所有关系');
      _relShowManagePage(charId, page);
    });
  }
}

// =============================================================
//  EDIT MODAL — 编辑关系
// =============================================================

async function _relShowEditModal(charId, relId, targetId, page) {
  var rel = null;
  try { rel = await db.relationships.get(relId); } catch(e) {}
  if (!rel) { _relToast('关系不存在'); return; }

  var targetChar = await _relGetChar(rel.targetId);
  var tName = targetChar ? targetChar.name : (rel.targetName || '');

  var overlay = document.createElement('div');
  overlay.className = 'rel-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 250ms ease;padding:20px;z-index:10002';

  overlay.innerHTML =
    '<div class="rel-edit-modal" style="transform:scale(0.92);opacity:0;transition:transform 250ms ' + _REL_EASE.out + ',opacity 200ms ease;max-width:340px;width:100%;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(107,125,141,0.12);overflow:hidden">' +
      '<div style="padding:28px 24px">' +
        '<div style="font-size:20px;font-weight:700;color:#2d2b2e;text-align:center;margin-bottom:24px">编辑关系</div>' +
        '<div style="margin-bottom:16px">' +
          '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">目标</div>' +
          '<div style="padding:10px 14px;background:#f5f5f5;border-radius:10px;font-size:14px;color:#2d2b2e">' + _relEsc(tName) + '</div>' +
        '</div>' +
        '<div style="margin-bottom:16px">' +
          '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系类型</div>' +
          '<input class="rel-edit-type" value="' + _relEsc(rel.type || '') + '" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;box-sizing:border-box">' +
        '</div>' +
        '<div style="margin-bottom:16px">' +
          '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系描述</div>' +
          '<textarea class="rel-edit-desc" rows="3" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;box-sizing:border-box;resize:none">' + _relEsc(rel.desc || '') + '</textarea>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">' +
          '<div style="font-size:12px;font-weight:600;color:#5a6a7a;white-space:nowrap">亲密度</div>' +
          '<input type="range" min="0" max="100" value="' + (rel.affinity || 50) + '" class="rel-edit-affinity" style="flex:1">' +
          '<span class="rel-aff-val" style="font-size:14px;font-weight:700;color:#6b7d8d;min-width:28px;text-align:right">' + (rel.affinity || 50) + '</span>' +
        '</div>' +
        '<div style="display:flex;gap:10px">' +
          '<button class="rel-edit-cancel" style="flex:1;height:44px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:14px;font-weight:600;cursor:pointer">取消</button>' +
          '<button class="rel-edit-save" style="flex:1;height:44px;border-radius:12px;border:none;background:#6b7d8d;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(107,125,141,0.2)">保存</button>' +
          '<button class="rel-edit-delete" style="flex:1;height:44px;border-radius:12px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.05);color:#e74c3c;font-size:14px;font-weight:600;cursor:pointer">删除</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    var modal = overlay.querySelector('.rel-edit-modal');
    if (modal) { modal.style.transform = 'scale(1)'; modal.style.opacity = '1'; }
  });

  // Affinity slider
  var slider = overlay.querySelector('.rel-edit-affinity');
  var valEl = overlay.querySelector('.rel-aff-val');
  if (slider && valEl) slider.addEventListener('input', function() { valEl.textContent = this.value; });

  function close() {
    overlay.style.opacity = '0';
    var modal = overlay.querySelector('.rel-edit-modal');
    if (modal) { modal.style.transform = 'scale(0.92)'; modal.style.opacity = '0'; }
    setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
  }

  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.querySelector('.rel-edit-cancel').addEventListener('click', close);

  overlay.querySelector('.rel-edit-save').addEventListener('click', async function() {
    var type = overlay.querySelector('.rel-edit-type').value.trim();
    var desc = overlay.querySelector('.rel-edit-desc').value.trim();
    var affinity = parseInt(overlay.querySelector('.rel-edit-affinity').value) || 50;
    if (!type) { _relToast('请填写关系类型'); return; }

    try {
      await db.relationships.update(relId, {type: type, desc: desc, affinity: affinity, updatedAt: Date.now()});
      close();
      _relToast('已保存');
      _relShowManagePage(charId, page);
    } catch(e) { _relToast('保存失败: ' + e.message); }
  });

  overlay.querySelector('.rel-edit-delete').addEventListener('click', async function() {
    try {
      await db.relationships.delete(relId);
      close();
      _relToast('已删除');
      _relShowManagePage(charId, page);
    } catch(e) { _relToast('删除失败: ' + e.message); }
  });
}

// =============================================================
//  GLOBAL API — 关系上下文注入（供其他模块调用）
// =============================================================

window.getRelationshipContext = async function(charId) {
  try {
    if (!window.db || !db.relationships) return '';
    var rels = await db.relationships.where('charId').equals(charId).toArray();
    if (!rels.length) return '';
    var lines = rels.map(function(r) {
      return '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + (r.desc ? '（' + r.desc + '）' : '');
    });
    return '\n【你的人际关系】\n' + lines.join('\n');
  } catch(e) { return ''; }
};

window.getRelationBetween = async function(charId, targetNameOrId) {
  try {
    if (!window.db || !db.relationships) return null;
    var rels = await db.relationships.where('charId').equals(charId).toArray();
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].targetName === targetNameOrId || String(rels[i].targetId) === String(targetNameOrId)) return rels[i];
    }
    return null;
  } catch(e) { return null; }
};

// =============================================================
//  AUTO-REFRESH (客户端2天检测)
// =============================================================

try {
  var _relLastGen = localStorage.getItem('rel_last_gen_time');
  if (!_relLastGen || (Date.now() - parseInt(_relLastGen)) > 2 * 24 * 60 * 60 * 1000) {
    console.log('[Relationship] Auto-refresh ready (2+ days since last generation)');
  }
} catch(e) {}

console.log('[Relationship] Module loaded successfully');// =============================================================
//  GRAPH PARTICLE SYSTEM — 浮动粒子背景
// =============================================================

var _relParticles = [];
var _relParticleCtx = null;
var _relParticleCanvas = null;

function _relInitParticles(container) {
  _relParticleCanvas = document.createElement('canvas');
  _relParticleCanvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
  container.appendChild(_relParticleCanvas);
  _relParticleCtx = _relParticleCanvas.getContext('2d');
  _relResizeParticleCanvas();
  _relParticles = [];
  for (var i = 0; i < 12; i++) {
    _relParticles.push({
      x: Math.random() * _relParticleCanvas.width,
      y: Math.random() * _relParticleCanvas.height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: 2 + Math.random() * 3,
      opacity: 0.1 + Math.random() * 0.2
    });
  }
  _relAnimateParticles();
}

function _relResizeParticleCanvas() {
  if (!_relParticleCanvas || !_relParticleCanvas.parentNode) return;
  _relParticleCanvas.width = _relParticleCanvas.parentNode.clientWidth;
  _relParticleCanvas.height = _relParticleCanvas.parentNode.clientHeight;
}

function _relAnimateParticles() {
  if (!_relParticleCtx || !_relParticleCanvas) return;
  var ctx = _relParticleCtx;
  var w = _relParticleCanvas.width;
  var h = _relParticleCanvas.height;
  ctx.clearRect(0, 0, w, h);
  for (var i = 0; i < _relParticles.length; i++) {
    var p = _relParticles[i];
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0 || p.x > w) p.vx *= -1;
    if (p.y < 0 || p.y > h) p.vy *= -1;
    p.opacity = 0.1 + 0.1 * Math.sin(Date.now() * 0.001 + i);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(107,125,141,' + p.opacity + ')';
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(107,125,141,0.05)';
  ctx.lineWidth = 1;
  for (var j = 0; j < _relParticles.length; j++) {
    for (var k = j + 1; k < _relParticles.length; k++) {
      var dx = _relParticles[j].x - _relParticles[k].x;
      var dy = _relParticles[j].y - _relParticles[k].y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        ctx.globalAlpha = (1 - dist / 150) * 0.3;
        ctx.beginPath();
        ctx.moveTo(_relParticles[j].x, _relParticles[j].y);
        ctx.lineTo(_relParticles[k].x, _relParticles[k].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  _relParticleRAF = requestAnimationFrame(_relAnimateParticles);
}

function _relCleanupParticles() {
  if (_relParticleRAF) { cancelAnimationFrame(_relParticleRAF); _relParticleRAF = null; }
  if (_relParticleCanvas && _relParticleCanvas.parentNode) _relParticleCanvas.parentNode.removeChild(_relParticleCanvas);
  _relParticleCanvas = null;
  _relParticleCtx = null;
  _relParticles = [];
}

// =============================================================
//  NODE HOVER EFFECTS — 节点悬停
// =============================================================

function _relSetupNodeHover(graph, wrap) {
  if (!graph) return;
  var tooltip = document.createElement('div');
  tooltip.className = 'rel-tooltip';
  tooltip.style.cssText = 'position:absolute;pointer-events:none;opacity:0;transition:opacity 150ms ease;padding:6px 12px;background:rgba(45,43,46,0.85);color:#fff;border-radius:8px;font-size:12px;white-space:nowrap;z-index:10';
  wrap.appendChild(tooltip);
  graph.onNodeHover(function(node) {
    if (node) {
      tooltip.textContent = node.name + (node.relType ? ' · ' + node.relType : '');
      tooltip.style.opacity = '1';
      var coords = graph.graph2ScreenCoords(node.x, node.y);
      tooltip.style.left = (coords.x + 20) + 'px';
      tooltip.style.top = (coords.y - 10) + 'px';
    } else {
      tooltip.style.opacity = '0';
    }
  });
}

// =============================================================
//  GRAPH ZOOM CONTROLS
// =============================================================

function _relZoomIn() { if (_relGraphInstance) _relGraphInstance.zoom(_relGraphInstance.zoom() * 1.3, 300); }
function _relZoomOut() { if (_relGraphInstance) _relGraphInstance.zoom(_relGraphInstance.zoom() / 1.3, 300); }
function _relZoomFit() { if (_relGraphInstance) _relGraphInstance.zoomToFit(400, 50); }

// =============================================================
//  NPC CHARACTER MANAGEMENT — NPC人物管理
// =============================================================

async function _relShowNpcManager(charId, page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;
  _relSetTitle(page, 'NPC 人物');
  _relSetHeaderRight(page, '<button class="rel-header-btn" id="rel-npc-add" title="添加NPC"><i class="fa fa-plus"></i></button>');
  _relSetBackAction(page, function() { _relShowManagePage(charId, page); });
  var npcs = await _relGetNpcChars(charId);
  var html = '<div class="rel-manage-body" style="padding:16px">';
  if (!npcs.length) {
    html += _relEmptyHTML('fa-user-plus', '暂无NPC人物', '从人设中提取或手动添加');
  } else {
    html += '<div class="rel-manage-section-title" style="font-size:12px;font-weight:600;color:#9aabab;margin-bottom:12px">NPC人物 (' + npcs.length + ')</div><div class="rel-manage-list">';
    for (var i = 0; i < npcs.length; i++) {
      var npc = npcs[i];
      html += '<div class="rel-manage-item" data-npc-id="' + npc.id + '" style="display:flex;align-items:center;gap:12px;padding:14px 16px;margin-bottom:8px;background:#fff;border:1px solid rgba(107,125,141,0.08);border-radius:12px;cursor:pointer">' +
        _relAvatarHTML(npc.avatar, npc.name, '', 44) +
        '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:600;color:#2d2b2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _relEsc(npc.name) + '</div>' +
        '<div style="font-size:13px;color:#9aabab;margin-top:3px">' + _relEsc(npc.description || '暂无描述').slice(0, 40) + '</div></div>' +
        '<div style="color:#bcc8c8;font-size:14px"><i class="fa fa-angle-right"></i></div></div>';
    }
    html += '</div>';
  }
  html += '</div>';
  body.innerHTML = html;
  _relAnimateStaggerItems('.rel-manage-item', body);
  var addBtn = page.querySelector('#rel-npc-add');
  if (addBtn) addBtn.addEventListener('click', function() { _relShowAddNpcSheet(charId, page); });
  body.querySelectorAll('.rel-manage-item').forEach(function(item) {
    item.addEventListener('click', function() { _relShowEditNpcModal(parseInt(item.dataset.npcId), charId, page); });
  });
}

async function _relShowAddNpcSheet(charId, page) {
  var overlay = document.createElement('div');
  overlay.className = 'rel-overlay';
  overlay.style.cssText = 'opacity:0;transition:opacity 250ms ease';
  var sheet = document.createElement('div');
  sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff;border-radius:24px 24px 0 0;box-shadow:0 -4px 20px rgba(107,125,141,0.1);padding:24px;z-index:10002;transform:translateY(100%);transition:transform 400ms ' + _REL_EASE.drawer + ';max-height:70vh;overflow-y:auto';
  sheet.innerHTML = '<div style="width:36px;height:4px;border-radius:2px;background:#bcc8c8;margin:0 auto 20px"></div>' +
    '<div style="font-size:20px;font-weight:700;color:#2d2b2e;margin-bottom:20px;text-align:center">添加NPC人物</div>' +
    '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">名字</div>' +
    '<input id="npc-name" placeholder="人物名字" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;margin-bottom:14px;box-sizing:border-box">' +
    '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">描述</div>' +
    '<textarea id="npc-desc" placeholder="人物描述" rows="3" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;margin-bottom:20px;box-sizing:border-box;resize:none"></textarea>' +
    '<div style="display:flex;gap:12px"><button class="npc-cancel" style="flex:1;height:48px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:15px;font-weight:600;cursor:pointer">取消</button>' +
    '<button class="npc-save" style="flex:2;height:48px;border-radius:12px;border:none;background:#6b7d8d;color:#fff;font-size:15px;font-weight:600;cursor:pointer">添加</button></div>';
  document.body.appendChild(overlay);
  document.body.appendChild(sheet);
  requestAnimationFrame(function() { overlay.style.opacity = '1'; sheet.style.transform = 'translateY(0)'; });
  function close() { overlay.style.opacity = '0'; sheet.style.transform = 'translateY(100%)'; setTimeout(function() { overlay.remove(); sheet.remove(); }, 400); }
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  sheet.querySelector('.npc-cancel').addEventListener('click', close);
  sheet.querySelector('.npc-save').addEventListener('click', async function() {
    var name = sheet.querySelector('#npc-name').value.trim();
    var desc = sheet.querySelector('#npc-desc').value.trim();
    if (!name) { _relToast('请填写名字'); return; }
    try {
      await db.npcCharacters.add({ name: name, avatar: '', description: desc, source: 'manual', charId: charId, createdAt: Date.now() });
      close(); _relToast('NPC已添加'); _relShowNpcManager(charId, page);
    } catch(e) { _relToast('添加失败: ' + e.message); }
  });
}

async function _relShowEditNpcModal(npcId, charId, page) {
  var npc = null;
  try { npc = await db.npcCharacters.get(npcId); } catch(e) {}
  if (!npc) { _relToast('NPC不存在'); return; }
  var overlay = document.createElement('div');
  overlay.className = 'rel-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 250ms ease;padding:20px;z-index:10002';
  overlay.innerHTML = '<div style="transform:scale(0.92);opacity:0;transition:transform 250ms ' + _REL_EASE.out + ',opacity 200ms ease;max-width:340px;width:100%;background:#fff;border-radius:24px;box-shadow:0 24px 60px rgba(107,125,141,0.12);overflow:hidden;padding:28px 24px">' +
    '<div style="font-size:20px;font-weight:700;color:#2d2b2e;text-align:center;margin-bottom:24px">编辑NPC</div>' +
    '<div style="margin-bottom:16px"><div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">名字</div>' +
    '<input class="npc-edit-name" value="' + _relEsc(npc.name) + '" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;box-sizing:border-box"></div>' +
    '<div style="margin-bottom:24px"><div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">描述</div>' +
    '<textarea class="npc-edit-desc" rows="3" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;background:#f5f5f5;box-sizing:border-box;resize:none">' + _relEsc(npc.description || '') + '</textarea></div>' +
    '<div style="display:flex;gap:10px"><button class="npc-edit-cancel" style="flex:1;height:44px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:transparent;color:#6b7d8d;font-size:14px;font-weight:600;cursor:pointer">取消</button>' +
    '<button class="npc-edit-save" style="flex:1;height:44px;border-radius:12px;border:none;background:#6b7d8d;color:#fff;font-size:14px;font-weight:600;cursor:pointer">保存</button>' +
    '<button class="npc-edit-delete" style="flex:1;height:44px;border-radius:12px;border:1px solid rgba(231,76,60,0.2);background:rgba(231,76,60,0.05);color:#e74c3c;font-size:14px;font-weight:600;cursor:pointer">删除</button></div></div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.style.opacity = '1'; var m = overlay.querySelector('div'); if (m) { m.style.transform = 'scale(1)'; m.style.opacity = '1'; } });
  function close() { overlay.style.opacity = '0'; var m = overlay.querySelector('div'); if (m) { m.style.transform = 'scale(0.92)'; m.style.opacity = '0'; } setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300); }
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.querySelector('.npc-edit-cancel').addEventListener('click', close);
  overlay.querySelector('.npc-edit-save').addEventListener('click', async function() {
    var name = overlay.querySelector('.npc-edit-name').value.trim();
    var desc = overlay.querySelector('.npc-edit-desc').value.trim();
    if (!name) { _relToast('请填写名字'); return; }
    try { await db.npcCharacters.update(npcId, {name: name, description: desc}); close(); _relToast('已保存'); _relShowNpcManager(charId, page); } catch(e) { _relToast('保存失败'); }
  });
  overlay.querySelector('.npc-edit-delete').addEventListener('click', async function() {
    try { await db.npcCharacters.delete(npcId); close(); _relToast('已删除'); _relShowNpcManager(charId, page); } catch(e) { _relToast('删除失败'); }
  });
}

// =============================================================
//  RELATIONSHIP STATS
// =============================================================

async function _relGetStats(charId) {
  var rels = await _relGetAll(charId);
  var stats = { total: rels.length, avgAffinity: 0, close: 0, friendly: 0, neutral: 0, byType: {} };
  if (!rels.length) return stats;
  var sum = 0;
  rels.forEach(function(r) {
    var aff = r.affinity || 50;
    sum += aff;
    if (aff >= 80) stats.close++;
    else if (aff >= 50) stats.friendly++;
    else stats.neutral++;
    var type = r.type || '认识';
    stats.byType[type] = (stats.byType[type] || 0) + 1;
  });
  stats.avgAffinity = Math.round(sum / rels.length);
  return stats;
}

// =============================================================
//  GLOBAL API EXTENSIONS
// =============================================================

window.getRelationshipContextFormatted = async function(charId) {
  try {
    if (!window.db || !db.relationships) return '';
    var rels = await db.relationships.where('charId').equals(charId).toArray();
    if (!rels.length) return '';
    rels.sort(function(a, b) { return (b.affinity || 0) - (a.affinity || 0); });
    var lines = ['你的人际关系：'];
    rels.forEach(function(r) {
      var aff = r.affinity || 50;
      var level = aff >= 80 ? '亲密' : aff >= 50 ? '友好' : '一般';
      var line = '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + '，' + level;
      if (r.desc) line += '（' + r.desc.slice(0, 50) + '）';
      lines.push(line);
    });
    return lines.join('\n');
  } catch(e) { return ''; }
};

window.getRelationshipSummary = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    if (!rels.length) return '';
    var char = await _relGetChar(charId);
    var charName = char ? char.name : '未知';
    var lines = [charName + '的关系网络：'];
    rels.forEach(function(r) { lines.push(r.targetName + '(' + (r.type||'认识') + ',亲密度' + (r.affinity||50) + ')'); });
    return lines.join('，');
  } catch(e) { return ''; }
};

window.updateAffinityFromChat = async function(charId, targetId, delta) {
  try {
    if (!window.db || !db.relationships) return;
    var rel = await _relGetBetween(charId, targetId);
    if (!rel) return;
    var newAff = Math.max(0, Math.min(100, (rel.affinity || 50) + (delta || 0.5)));
    await db.relationships.update(rel.id, {affinity: newAff, updatedAt: Date.now()});
  } catch(e) {}
};

window.importRelationships = async function(charId, relArray) {
  if (!Array.isArray(relArray) || !window.db) return 0;
  var count = 0;
  for (var i = 0; i < relArray.length; i++) {
    var r = relArray[i];
    if (!r.name && !r.targetName) continue;
    try {
      await db.relationships.add({
        charId: charId, targetId: r.targetId || ('npc_import_' + Date.now() + '_' + i),
        targetName: r.name || r.targetName || '', targetAvatar: r.avatar || '',
        type: r.type || '认识', desc: r.desc || '', affinity: r.affinity || 50,
        source: 'import', createdAt: Date.now(), updatedAt: Date.now()
      });
      count++;
    } catch(e) {}
  }
  return count;
};

window.exportRelationships = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    return rels.map(function(r) { return { name: r.targetName, type: r.type, desc: r.desc, affinity: r.affinity, source: r.source }; });
  } catch(e) { return []; }
};

// =============================================================
//  ERROR RECOVERY
// =============================================================

function _relHandleError(e, context) {
  console.error('[Relationship] ' + context + ':', e);
  var msg = e.message || String(e);
  if (msg.indexOf('QuotaExceededError') >= 0) _relToast('存储空间不足，请清理数据');
  else if (msg.indexOf('Network') >= 0 || msg.indexOf('fetch') >= 0) _relToast('网络错误，请检查连接');
  else _relToast('操作失败: ' + msg.slice(0, 50));
}

// =============================================================
//  PERFORMANCE MONITORING
// =============================================================

var _relPerfMarks = {};
function _relPerfStart(label) { _relPerfMarks[label] = Date.now(); }
function _relPerfEnd(label) {
  if (_relPerfMarks[label]) {
    var elapsed = Date.now() - _relPerfMarks[label];
    console.log('[Relationship] ' + label + ': ' + elapsed + 'ms');
    delete _relPerfMarks[label];
    return elapsed;
  }
  return 0;
}// =============================================================
//  INTEGRATION — 集成粒子系统到图谱页
// =============================================================

// Patch _relRenderGraph to include particles and hover
var _relOrigRenderGraph = _relRenderGraph;
_relRenderGraph = async function(charId, page) {
  var wrap = page.querySelector('#rel-graph-wrap');
  var loading = page.querySelector('#rel-graph-loading');
  if (!wrap) return;

  var char = await _relGetChar(charId);
  if (!char) { _relToast('角色不存在'); return; }

  var rels = await _relGetAll(charId);
  var allChars = await _relGetAllChars();

  if (loading) loading.style.display = 'none';

  if (!rels.length) {
    _relCleanupGraph();
    wrap.innerHTML = _relEmptyHTML('fa-wand-magic-sparkles', '还没有关系数据', '点击下方AI按钮从人设中自动提取人物关系');
    return;
  }

  if (!window.ForceGraph) {
    _relCleanupGraph();
    wrap.innerHTML = _relEmptyHTML('fa-exclamation-triangle', 'ForceGraph未加载', '请刷新页面重试');
    return;
  }

  // Clean up old graph instance, resize handlers, particles, and stale DOM (tooltips etc.)
  _relCleanupGraph();
  wrap.innerHTML = '';

  // Init particles background
  _relInitParticles(wrap);

  var graphData = _relBuildGraphData(charId, rels, allChars, char);
  var w = wrap.clientWidth || 300;
  var h = wrap.clientHeight || 400;

  _relGraphInstance = window.ForceGraph()(wrap)
    .graphData(graphData)
    .backgroundColor('transparent')
    .width(w).height(h)
    .nodeLabel(function() { return ''; })
    .nodeVal(function(n) { return n.type === 'center' ? 40 : 25; })
    .linkColor(function(l) {
      var aff = l.affinity || 50;
      if (aff >= 80) return 'rgba(91,154,255,0.6)';
      if (aff >= 50) return 'rgba(91,154,255,0.3)';
      return 'rgba(0,0,0,0.1)';
    })
    .linkWidth(function(l) { return Math.max(1, (l.affinity || 50) / 25); })
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    .cooldownTime(3000)
    .onNodeClick(function(node) { _relShowDetailCard(node, charId); })
    .nodeCanvasObject(_relNodeCanvasObject);

  // Setup hover tooltips
  _relSetupNodeHover(_relGraphInstance, wrap);

  // BFS entrance animation
  _relAnimateGraphEntrance(graphData);

  // Resize handler
  _relGraphResizeHandler = function() {
    if (_relGraphInstance && wrap.clientWidth > 0) {
      _relGraphInstance.width(wrap.clientWidth).height(wrap.clientHeight);
      _relResizeParticleCanvas();
    }
  };
  window.addEventListener('resize', _relGraphResizeHandler);

  setTimeout(function() {
    if (_relGraphInstance) _relGraphInstance.zoomToFit(400, 50);
  }, 600);
};

// =============================================================
//  INTEGRATION — NPC管理按钮加入管理页
// =============================================================

var _relOrigShowManagePage = _relShowManagePage;
_relShowManagePage = async function(charId, page) {
  await _relOrigShowManagePage(charId, page);
  // Add NPC manager button
  var body = page.querySelector('#rel-body');
  if (!body) return;
  var existingBtn = body.querySelector('#rel-npc-manager-btn');
  if (existingBtn) return;

  var btn = document.createElement('button');
  btn.id = 'rel-npc-manager-btn';
  btn.className = 'rel-manage-btn';
  btn.style.cssText = 'display:block;width:100%;padding:14px;margin-top:12px;border:1px solid rgba(107,125,141,0.12);background:rgba(107,125,141,0.05);border-radius:12px;color:#6b7d8d;font-size:14px;font-weight:600;cursor:pointer';
  btn.innerHTML = '<i class="fa fa-user-plus" style="margin-right:8px"></i> 管理NPC人物';
  btn.addEventListener('click', function() { _relShowNpcManager(charId, page); });

  var clearBtn = body.querySelector('#rel-clear-all');
  if (clearBtn) clearBtn.parentNode.insertBefore(btn, clearBtn);
  else body.querySelector('.rel-manage-body').appendChild(btn);
};

// =============================================================
//  INTEGRATION — 清理粒子当离开图谱页
// =============================================================

var _relOrigCleanupGraph2 = _relCleanupGraph;
_relCleanupGraph = function() {
  _relOrigCleanupGraph2();
  _relCleanupParticles();
};

// =============================================================
//  RELATIONSHIP BATCH IMPORT FROM PERSONA (一次性全部提取)
// =============================================================

window.generateAllRelationships = async function() {
  if (!window.db || !window.callAI) { _relToast('服务未就绪'); return; }
  var chars = await _relGetAllChars();
  var charTypeChars = chars.filter(function(c) { return c.type === 'char'; });
  if (!charTypeChars.length) { _relToast('没有角色'); return; }

  _relToast('开始批量提取关系...');
  var total = 0;
  for (var i = 0; i < charTypeChars.length; i++) {
    try {
      var count = await _relExtractFromPersona(charTypeChars[i]);
      total += count;
    } catch(e) {
      console.warn('[Relationship] batch extract error:', e);
    }
  }
  localStorage.setItem('rel_last_gen_time', String(Date.now()));
  _relToast('批量提取完成，共 ' + total + ' 条关系');
  return total;
};

// =============================================================
//  RELATIONSHIP SEARCH — 搜索关系
// =============================================================

window.searchRelationships = async function(charId, query) {
  try {
    var rels = await _relGetAll(charId);
    if (!query) return rels;
    var q = query.toLowerCase();
    return rels.filter(function(r) {
      return (r.targetName || '').toLowerCase().indexOf(q) >= 0 ||
             (r.type || '').toLowerCase().indexOf(q) >= 0 ||
             (r.desc || '').toLowerCase().indexOf(q) >= 0;
    });
  } catch(e) { return []; }
};

// =============================================================
//  RELATIONSHIP DEDUPLICATION — 去重
// =============================================================

window.deduplicateRelationships = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var seen = {};
    var dupes = [];
    rels.forEach(function(r) {
      var key = charId + '_' + r.targetId;
      if (seen[key]) dupes.push(r.id);
      else seen[key] = true;
    });
    for (var i = 0; i < dupes.length; i++) {
      await db.relationships.delete(dupes[i]);
    }
    if (dupes.length) _relToast('已去除 ' + dupes.length + ' 条重复关系');
    return dupes.length;
  } catch(e) { return 0; }
};

// =============================================================
//  RELATIONSHIP TIMELINE — 关系时间线
// =============================================================

window.getRelationshipTimeline = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    rels.sort(function(a, b) { return (a.createdAt || 0) - (b.createdAt || 0); });
    return rels.map(function(r) {
      return {
        name: r.targetName,
        type: r.type,
        affinity: r.affinity,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        source: r.source
      };
    });
  } catch(e) { return []; }
};

// =============================================================
//  RELATIONSHIP NETWORK DENSITY — 网络密度分析
// =============================================================

window.getNetworkDensity = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var allChars = await _relGetAllChars();
    var totalPossible = allChars.length - 1; // Exclude self
    if (totalPossible <= 0) return 0;
    return Math.round((rels.length / totalPossible) * 100);
  } catch(e) { return 0; }
};

// =============================================================
//  RELATIONSHIP INFLUENCE SCORE — 影响力评分
// =============================================================

window.getInfluenceScore = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    if (!rels.length) return 0;
    var allStored = await db.relationships.toArray();
    var incoming = allStored.filter(function(r) { return String(r.targetId) === String(charId); });
    var outgoing = rels.length;
    var avgAff = rels.reduce(function(sum, r) { return sum + (r.affinity || 50); }, 0) / rels.length;
    // Score = connections * avg_affinity / 100
    return Math.round(((outgoing + incoming.length) * avgAff / 100) * 10) / 10;
  } catch(e) { return 0; }
};

// =============================================================
//  RELATIONSHIP AUTO-DETECT FROM CHAT — 从聊天自动检测关系
// =============================================================

window.detectRelationshipFromChat = async function(charId, messages) {
  if (!window.callAI || !messages || !messages.length) return;
  var char = await _relGetChar(charId);
  if (!char) return;

  var chatText = messages.map(function(m) { return m.content || ''; }).join('\n').slice(0, 1000);

  var prompt = '从以下聊天记录中，检测是否有新的人物关系被提及。\n\n' +
    '角色：' + char.name + '\n' +
    '聊天记录：\n' + chatText + '\n\n' +
    '如果发现了新的人物关系，返回JSON：{"relations":[{"name":"人名","type":"关系类型","desc":"描述"}]}\n' +
    '如果没有发现新关系，返回：{"relations":[]}';

  try {
    var raw = await window.callAI([{role: 'user', content: prompt}], {responseFormat: 'json_object'});
    var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (data.relations && data.relations.length) {
      var existing = await _relGetAll(charId);
      var existingNames = existing.map(function(r) { return (r.targetName || '').toLowerCase(); });
      var added = 0;
      for (var i = 0; i < data.relations.length; i++) {
        var r = data.relations[i];
        if (!r.name || existingNames.indexOf(r.name.toLowerCase()) >= 0) continue;
        await db.relationships.add({
          charId: charId, targetId: 'npc_chat_' + Date.now() + '_' + i,
          targetName: r.name, targetAvatar: '',
          type: r.type || '认识', desc: r.desc || '',
          affinity: 30, source: 'chat',
          createdAt: Date.now(), updatedAt: Date.now()
        });
        added++;
      }
      if (added) console.log('[Relationship] Detected ' + added + ' new relationships from chat');
    }
  } catch(e) {
    console.warn('[Relationship] detect from chat error:', e);
  }
};

console.log('[Relationship] Full module loaded with all integrations');// =============================================================
//  RELATIONSHIP CLUSTER DETECTION — 社交圈层检测
// =============================================================

window.detectSocialClusters = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    if (rels.length < 3) return [];

    // Group by type
    var clusters = {};
    rels.forEach(function(r) {
      var type = r.type || '认识';
      if (!clusters[type]) clusters[type] = [];
      clusters[type].push(r);
    });

    // Build cluster info
    var result = [];
    Object.keys(clusters).forEach(function(type) {
      var members = clusters[type];
      var avgAff = members.reduce(function(s, r) { return s + (r.affinity || 50); }, 0) / members.length;
      result.push({
        name: type,
        count: members.length,
        avgAffinity: Math.round(avgAff),
        members: members.map(function(r) { return r.targetName; })
      });
    });

    // Sort by count descending
    result.sort(function(a, b) { return b.count - a.count; });
    return result;
  } catch(e) { return []; }
};

// =============================================================
//  RELATIONSHIP STRENGTH MATRIX — 关系强度矩阵
// =============================================================

window.getRelationshipMatrix = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var matrix = {};
    rels.forEach(function(r) {
      matrix[r.targetName || r.targetId] = {
        type: r.type || '认识',
        affinity: r.affinity || 50,
        desc: r.desc || '',
        source: r.source || 'unknown',
        daysSinceUpdate: Math.floor((Date.now() - (r.updatedAt || r.createdAt || Date.now())) / 86400000)
      };
    });
    return matrix;
  } catch(e) { return {}; }
};

// =============================================================
//  RELATIONSHIP HEALTH CHECK — 关系健康度检查
// =============================================================

window.checkRelationshipHealth = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var issues = [];

    // Check for stale relationships (no update in30+ days)
    var stale = rels.filter(function(r) {
      return (Date.now() - (r.updatedAt || r.createdAt || 0)) > 30 * 86400000;
    });
    if (stale.length) issues.push({type: 'stale', count: stale.length, message: stale.length + '条关系超过30天未更新'});

    // Check for low affinity
    var lowAff = rels.filter(function(r) { return (r.affinity || 50) < 20; });
    if (lowAff.length) issues.push({type: 'low_affinity', count: lowAff.length, message: lowAff.length + '条关系亲密度低于20'});

    // Check for no description
    var noDesc = rels.filter(function(r) { return !r.desc; });
    if (noDesc.length) issues.push({type: 'no_desc', count: noDesc.length, message: noDesc.length + '条关系缺少描述'});

    return {
      total: rels.length,
      healthy: rels.length - issues.reduce(function(s, i) { return s + i.count; }, 0),
      issues: issues
    };
  } catch(e) { return {total: 0, healthy: 0, issues: []}; }
};

// =============================================================
//  RELATIONSHIP SUGGESTIONS — 关系建议
// =============================================================

window.suggestRelationships = async function(charId) {
  try {
    var char = await _relGetChar(charId);
    if (!char || !window.callAI) return [];

    var existing = await _relGetAll(charId);
    var existingNames = existing.map(function(r) { return r.targetName; });

    var prompt = '根据以下角色的人设，建议可能但尚未记录的关系。\n\n' +
      '角色：' + char.name + '\n' +
      '人设：' + (char.description || '暂无') + '\n' +
      '已有关系：' + (existingNames.join('、') || '无') + '\n\n' +
      '返回JSON：{"suggestions":[{"name":"人名","type":"可能的关系","reason":"为什么可能有这个关系"}]}';

    var raw = await window.callAI([{role: 'user', content: prompt}], {responseFormat: 'json_object', charAntiDrift: true});
    var data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return data.suggestions || [];
  } catch(e) { return []; }
};

// =============================================================
//  RELATIONSHIP EXPORT AS MARKDOWN — 导出为Markdown
// =============================================================

window.exportRelationshipsAsMarkdown = async function(charId) {
  try {
    var char = await _relGetChar(charId);
    var rels = await _relGetAll(charId);
    if (!char) return '';

    var md = '# ' + char.name + ' 的关系网络\n\n';
    md += '生成时间：' + new Date().toLocaleString('zh-CN') + '\n\n';
    md += '---\n\n';

    if (!rels.length) {
      md += '暂无关系数据。\n';
      return md;
    }

    // Sort by affinity descending
    rels.sort(function(a, b) { return (b.affinity || 0) - (a.affinity || 0); });

    md += '## 关系列表 (' + rels.length + '条)\n\n';
    rels.forEach(function(r, idx) {
      var aff = r.affinity || 50;
      var level = aff >= 80 ? '亲密' : aff >= 50 ? '友好' : '一般';
      md += '### ' + (idx + 1) + '. ' + (r.targetName || r.targetId) + '\n';
      md += '- **关系类型**：' + (r.type || '认识') + '\n';
      md += '- **亲密度**：' + aff + '/100 (' + level + ')\n';
      if (r.desc) md += '- **描述**：' + r.desc + '\n';
      md += '- **来源**：' + (r.source || 'unknown') + '\n\n';
    });

    return md;
  } catch(e) { return ''; }
};

// =============================================================
//  RELATIONSHIP GRAPH EXPORT — 图谱数据导出
// =============================================================

window.exportGraphData = async function(charId) {
  try {
    var char = await _relGetChar(charId);
    var rels = await _relGetAll(charId);
    var allChars = await _relGetAllChars();
    if (!char) return null;
    return _relBuildGraphData(charId, rels, allChars, char);
  } catch(e) { return null; }
};

// =============================================================
//  RELATIONSHIP VALIDATION — 数据验证
// =============================================================

window.validateRelationships = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var allChars = await _relGetAllChars();
    var issues = [];

    rels.forEach(function(r) {
      // Check for missing target name
      if (!r.targetName && !r.targetId) {
        issues.push({id: r.id, issue: 'missing_target', message: '关系缺少目标'});
      }
      // Check for invalid affinity
      if (r.affinity < 0 || r.affinity > 100) {
        issues.push({id: r.id, issue: 'invalid_affinity', message: '亲密度超出范围: ' + r.affinity});
      }
      // Check for orphaned references (target char deleted)
      if (typeof r.targetId === 'number') {
        var targetExists = allChars.some(function(c) { return c.id === r.targetId; });
        if (!targetExists) {
          issues.push({id: r.id, issue: 'orphaned', message: '目标角色已删除: ' + r.targetName});
        }
      }
    });

    return {valid: issues.length === 0, total: rels.length, issues: issues};
  } catch(e) { return {valid: false, total: 0, issues: []}; }
};

// =============================================================
//  RELATIONSHIP REPAIR — 数据修复
// =============================================================

window.repairRelationships = async function(charId) {
  try {
    var validation = await window.validateRelationships(charId);
    var repaired = 0;

    for (var i = 0; i < validation.issues.length; i++) {
      var issue = validation.issues[i];
      if (issue.issue === 'invalid_affinity') {
        await db.relationships.update(issue.id, {affinity: Math.max(0, Math.min(100, 50))});
        repaired++;
      }
      // Don't auto-delete orphaned - user should decide
    }

    if (repaired) _relToast('已修复 ' + repaired + ' 条数据问题');
    return repaired;
  } catch(e) { return 0; }
};

// =============================================================
//  RELATIONSHIP REMINDER — 关系维护提醒
// =============================================================

window.getRelationshipReminders = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    var reminders = [];
    var now = Date.now();

    rels.forEach(function(r) {
      var daysSince = Math.floor((now - (r.updatedAt || r.createdAt || now)) / 86400000);
      if (daysSince > 7 && (r.affinity || 50) >= 50) {
        reminders.push({
          name: r.targetName,
          type: r.type,
          affinity: r.affinity,
          daysSince: daysSince,
          message: '已经' + daysSince + '天没有和' + (r.targetName || '对方') + '互动了'
        });
      }
    });

    reminders.sort(function(a, b) { return b.daysSince - a.daysSince; });
    return reminders;
  } catch(e) { return []; }
};

// =============================================================
//  FINAL INIT — 最终初始化
// =============================================================

// Auto-check for stale relationships on load
try {
  if (window.db && db.relationships) {
    db.relationships.count().then(function(count) {
      if (count > 0) {
        console.log('[Relationship] ' + count + ' relationships in database');
      }
    }).catch(function() {});
  }
} catch(e) {}

console.log('[Relationship] Complete module v7 loaded');