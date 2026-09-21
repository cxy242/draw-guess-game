// relationship.js — 关系网模块
// 依赖：db.js, force-graph.min.js, anime.min.js
// NO IIFE - all functions defined at module scope, entry exposed on window

var _relPageId = 'relationship-page';
var _relCurrentCharId = null;
var _relGraphInstance = null;
var _relGraphResizeHandler = null;
var _relLinkPulseRAF = null;
var _relGraphParticles = [];
var _relAnalysisResults = {};

// ===== Safe HTML escape =====
function _relEsc(str) {
  if (typeof wcEscHtml === 'function') return wcEscHtml(str);
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== Initial character for avatar fallback =====
function _relGetInitial(name) {
  return String(name || '?').trim().charAt(0) || '?';
}

// ===== Avatar HTML =====
function _relAvatarHTML(src, name, cls) {
  var c = cls || '';
  if (src) {
    return '<div class="' + c + '"><img src="' + _relEsc(src) + '" alt="' + _relEsc(name) + '"></div>';
  }
  return '<div class="' + c + '"><span>' + _relEsc(_relGetInitial(name)) + '</span></div>';
}

// ===== Anime.js helper =====
function _relHasAnime() { return typeof window.anime === 'function'; }

// ===== Page transition animation =====
function _relAnimatePageIn(container) {
  if (!_relHasAnime()) { container.style.opacity = '1'; return; }
  window.anime({
    targets: container,
    translateX: [30, 0],
    opacity: [0, 1],
    duration: 350,
    easing: 'easeOutCubic'
  });
}

function _relAnimatePageOut(container, callback) {
  if (!_relHasAnime()) { if (callback) callback(); return; }
  window.anime({
    targets: container,
    translateX: [0, -30],
    opacity: [1, 0],
    duration: 250,
    easing: 'easeInCubic',
    complete: callback
  });
}

// ===== Stagger animation for list/grid items =====
function _relAnimateStaggerItems(selector, parentEl) {
  if (!_relHasAnime()) {
    var items = (parentEl || document).querySelectorAll(selector);
    items.forEach(function(el) { el.style.opacity = '1'; });
    return;
  }
  var items = (parentEl || document).querySelectorAll(selector);
  if (!items.length) return;
  window.anime({
    targets: items,
    translateY: [16, 0],
    opacity: [0, 1],
    scale: [0.95, 1],
    duration: 400,
    delay: window.anime.stagger(50, { start: 80 }),
    easing: 'easeOutCubic'
  });
}

// ===== Toast with anime.js =====
function _relToast(msg) {
  if (typeof window.toast === 'function') { window.toast(msg); return; }
  var el = document.createElement('div');
  el.className = 'rel-toast';
  el.textContent = msg;
  document.body.appendChild(el);

  if (_relHasAnime()) {
    window.anime({
      targets: el,
      scale: [0.85, 1],
      opacity: [0, 1],
      duration: 300,
      easing: 'easeOutBack'
    });
    window.anime({
      targets: el,
      scale: [1, 0.85],
      opacity: [1, 0],
      duration: 250,
      delay: 1600,
      easing: 'easeInBack',
      complete: function() { el.remove(); }
    });
  } else {
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(1)';
    setTimeout(function() { el.remove(); }, 2000);
  }
}

// ===== Floating particles background =====
function _relSpawnParticles(container, count) {
  if (!container) return;
  for (var i = 0; i < (count || 12); i++) {
    var p = document.createElement('div');
    p.className = 'rel-particle';
    p.style.left = (Math.random() * 100) + '%';
    p.style.top = (60 + Math.random() * 40) + '%';
    p.style.width = (2 + Math.random() * 4) + 'px';
    p.style.height = p.style.width;
    p.style.opacity = '0';
    p.style.animationDuration = (8 + Math.random() * 12) + 's';
    p.style.animationDelay = (Math.random() * 6) + 's';
    container.appendChild(p);
  }
}

// ===== DB Tables (defined in db.js - no db.version here) =====
function _relEnsureTables() {
  if (!window.db) return;
  try {
    if (!db.relationships || !db.npcCharacters) {
      console.warn('[Relationship] DB tables missing — relationships/npcCharacters not in schema');
    }
  } catch (e) {
    console.warn('[Relationship] Table check error:', e);
  }
}

// Wait for db to be ready
if (window.db) {
  _relEnsureTables();
} else {
  var _relDbWait = setInterval(function() {
    if (window.db) { clearInterval(_relDbWait); _relEnsureTables(); }
  }, 100);
  setTimeout(function() { clearInterval(_relDbWait); }, 10000);
}

// =============================================================
//  RELATIONSHIP CRUD
// =============================================================

async function _relGetAll(charId) {
  if (!window.db) return [];
  return await db.relationships.where('charId').equals(charId).toArray();
}

async function _relGetById(id) {
  if (!window.db) return null;
  return await db.relationships.get(id);
}

async function _relGetBetween(charId, targetId) {
  if (!window.db) return null;
  if (typeof targetId === 'number') {
    var r = await db.relationships.where('[charId+targetId]').equals([charId, targetId]).first();
    if (r) return r;
  }
  var all = await db.relationships.where('charId').equals(charId).toArray();
  var targetLower = String(targetId).toLowerCase();
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].targetName || '').toLowerCase() === targetLower) return all[i];
    if (String(all[i].targetId) === String(targetId)) return all[i];
  }
  return null;
}

async function _relSave(rel) {
  if (!window.db) return 0;
  rel.updatedAt = Date.now();
  if (rel.id) {
    await db.relationships.update(rel.id, rel);
    return rel.id;
  }
  return await db.relationships.add(rel);
}

async function _relDelete(id) {
  if (!window.db) return;
  await db.relationships.delete(id);
}

async function _relDeleteForChar(charId) {
  if (!window.db) return;
  await db.relationships.where('charId').equals(charId).delete();
}

async function _relSaveBatch(rels) {
  if (!window.db || !rels.length) return;
  await db.relationships.bulkPut(rels);
}

// =============================================================
//  CHARACTER HELPERS
// =============================================================

async function _relGetChar(charId) {
  return await db.characters.get(charId);
}

async function _relGetAllChars() {
  return await db.characters.toArray();
}

// =============================================================
//  GRAPH DATA BUILDER
// =============================================================

function _relBuildGraphData(charId, relationships, allChars, centerChar) {
  var charMap = {};
  allChars.forEach(function(c) { charMap[c.id] = c; });

  var center = centerChar || charMap[charId];
  if (!center) return { nodes: [], links: [] };

  var nodes = [];
  var links = [];
  var nodeIds = {};
  var RADIUS = 160;

  nodes.push({
    id: center.id,
    name: center.name || '?',
    avatar: center.avatar || '',
    type: 'center',
    x: 0,
    y: 0,
    affinity: 100
  });
  nodeIds[center.id] = true;

  var targets = [];
  var targetSeen = {};
  for (var i = 0; i < relationships.length; i++) {
    var r = relationships[i];
    var tid = r.targetId;
    if (!tid || tid === charId || targetSeen[tid]) continue;
    targetSeen[tid] = true;
    targets.push(r);
  }

  var angleStep = targets.length > 0 ? (2 * Math.PI / targets.length) : 0;
  for (var j = 0; j < targets.length; j++) {
    var rel = targets[j];
    var tChar = charMap[rel.targetId];
    var angle = angleStep * j - Math.PI / 2;
    var dist = RADIUS + (100 - (rel.affinity || 50)) * 1.2;

    nodes.push({
      id: rel.targetId,
      name: rel.targetName || (tChar ? tChar.name : '?'),
      avatar: tChar ? (tChar.avatar || '') : '',
      type: 'target',
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
      affinity: rel.affinity || 50,
      relType: rel.type || ''
    });
    nodeIds[rel.targetId] = true;

    links.push({
      source: charId,
      target: rel.targetId,
      type: rel.type || '',
      affinity: rel.affinity || 50,
      description: rel.desc || rel.description || ''
    });
  }

  // Add cross-links between connected nodes
  for (var k = 0; k < relationships.length; k++) {
    var r2 = relationships[k];
    if (nodeIds[r2.charId] && nodeIds[r2.targetId] && r2.charId !== charId) {
      var exists = false;
      for (var m = 0; m < links.length; m++) {
        if ((links[m].source === r2.charId && links[m].target === r2.targetId) ||
            (links[m].source === r2.targetId && links[m].target === r2.charId)) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        links.push({
          source: r2.charId,
          target: r2.targetId,
          type: r2.type || '',
          affinity: r2.affinity || 50
        });
      }
    }
  }

  return { nodes: nodes, links: links };
}

// =============================================================
//  AI RELATIONSHIP EXTRACTION FROM PERSONA
// =============================================================

async function _relExtractFromPersona(char) {
  if (!char) throw new Error('No character provided');
  if (typeof window.callAI !== 'function') throw new Error('AI service not available');

  var prompt = '你是关系网络分析器。根据以下角色人设，提取所有提到的人物和他们与角色的关系。\n\n' +
    '角色名：' + (char.name || '未知') + '\n' +
    '人设：\n' + (char.description || '暂无') + '\n\n' +
    '返回JSON：{"relations":[{"name":"人名","type":"关系类型","desc":"简短描述"}]}';

  var raw = await window.callAI([{ role: 'user', content: prompt }], {
    responseFormat: 'json_object',
    temperature: 0.3
  });

  var parsed;
  try {
    var obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    parsed = Array.isArray(obj) ? obj : (obj.relations || obj.relationships || obj.data || []);
  } catch (e) {
    console.warn('[Relationship] AI response parse error:', e, raw);
    parsed = [];
  }

  // Match names to existing characters
  var allChars = await _relGetAllChars();
  var otherChars = allChars.filter(function(c) { return c.id !== char.id; });

  for (var j = 0; j < parsed.length; j++) {
    if (!parsed[j].targetId && parsed[j].name) {
      var match = otherChars.find(function(c) {
        return (c.name || '').toLowerCase() === parsed[j].name.toLowerCase() ||
               (c.nick || '').toLowerCase() === parsed[j].name.toLowerCase();
      });
      if (match) parsed[j].targetId = match.id;
    }
    parsed[j].targetName = parsed[j].name || parsed[j].targetName || '';
    parsed[j].affinity = Math.max(0, Math.min(100, parseInt(parsed[j].affinity) || 50));
  }

  return parsed;
}

// =============================================================
//  CLIENT-SIDE AUTO-REFRESH (every 2 days)
// =============================================================

function _relCheckAutoRefresh() {
  try {
    var lastGen = localStorage.getItem('rel_last_gen_time');
    if (!lastGen || (Date.now() - parseInt(lastGen)) > 2 * 24 * 60 * 60 * 1000) {
      localStorage.setItem('rel_last_gen_time', String(Date.now()));
      // Will trigger AI generation when user opens the page
      return true;
    }
  } catch (e) {}
  return false;
}

// =============================================================
//  PAGE SHELL (common header + body)
// =============================================================

function _relCreatePage() {
  var existing = document.getElementById(_relPageId);
  if (existing) existing.remove();

  var page = document.createElement('div');
  page.id = _relPageId;
  page.className = 'full-page rel-page';
  page.style.zIndex = '400';
  page.innerHTML =
    '<div class="rel-header">' +
      '<button class="rel-header-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
      '<span class="rel-header-title" id="rel-title">关系网</span>' +
      '<div class="rel-header-right" id="rel-header-right"></div>' +
    '</div>' +
    '<div id="rel-body" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>';

  // Spawn floating particles
  _relSpawnParticles(page, 10);

  // Back button
  page.querySelector('#rel-back').addEventListener('click', function() {
    _relHandleBack(page);
  });

  window.openPage(page);
  return page;
}

function _relSetTitle(page, title) {
  var el = page.querySelector('#rel-title');
  if (el) el.textContent = title;
}

function _relSetHeaderRight(page, html) {
  var el = page.querySelector('#rel-header-right');
  if (el) el.innerHTML = html;
}

function _relHandleBack(page) {
  var title = page.querySelector('#rel-title');
  var currentTitle = title ? title.textContent : '';

  if (currentTitle === '关系图') {
    var body = page.querySelector('#rel-body');
    if (body && _relHasAnime()) {
      _relAnimatePageOut(body, function() {
        _relRenderSelectPage(page);
      });
    } else {
      _relRenderSelectPage(page);
    }
    _relCleanupGraph();
  } else if (currentTitle === 'AI分析' || currentTitle === '关系管理') {
    var body2 = page.querySelector('#rel-body');
    if (body2 && _relHasAnime()) {
      _relAnimatePageOut(body2, function() {
        if (_relCurrentCharId) {
          _relShowGraphPage(_relCurrentCharId);
        } else {
          _relRenderSelectPage(page);
        }
      });
    } else {
      if (_relCurrentCharId) {
        _relShowGraphPage(_relCurrentCharId);
      } else {
        _relRenderSelectPage(page);
      }
    }
  } else {
    window.closePage(_relPageId);
    _relCleanupGraph();
  }
}

function _relCleanupGraph() {
  _relCurrentCharId = null;
  if (_relGraphInstance) {
    try { _relGraphInstance._destructor && _relGraphInstance._destructor(); } catch(e) {}
    _relGraphInstance = null;
  }
  if (_relGraphResizeHandler) {
    window.removeEventListener('resize', _relGraphResizeHandler);
    _relGraphResizeHandler = null;
  }
  if (_relLinkPulseRAF) {
    cancelAnimationFrame(_relLinkPulseRAF);
    _relLinkPulseRAF = null;
  }
}

// =============================================================
//  PAGE 1: CHARACTER SELECT PAGE
// =============================================================

function _relRenderSelectPage(page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;
  body.innerHTML =
    '<div class="rel-select-body">' +
      '<input class="rel-select-search" id="rel-search" placeholder="搜索角色...">' +
      '<div class="rel-char-grid" id="rel-char-grid"></div>' +
    '</div>';

  _relSetTitle(page, '关系网');
  _relSetHeaderRight(page, '');

  var searchInput = body.querySelector('#rel-search');
  var grid = body.querySelector('#rel-char-grid');

  _relLoadSelectGrid(grid, '');

  // Search bar focus animation
  searchInput.addEventListener('focus', function() {
    if (!_relHasAnime()) return;
    window.anime({
      targets: searchInput,
      scale: [1, 1.01],
      duration: 200,
      easing: 'easeOutCubic'
    });
  });
  searchInput.addEventListener('blur', function() {
    if (!_relHasAnime()) return;
    window.anime({
      targets: searchInput,
      scale: [1.01, 1],
      duration: 200,
      easing: 'easeOutCubic'
    });
  });

  searchInput.addEventListener('input', function() {
    _relLoadSelectGrid(grid, searchInput.value.trim());
  });

  _relAnimatePageIn(body);
}

async function _relLoadSelectGrid(grid, query) {
  var chars = await _relGetAllChars();
  if (query) {
    var q = query.toLowerCase();
    chars = chars.filter(function(c) {
      return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
             (c.nick || '').toLowerCase().indexOf(q) >= 0;
    });
  }
  if (!chars.length) {
    grid.innerHTML = '<div class="rel-empty-hint">暂无角色数据</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < chars.length; i++) {
    var c = chars[i];
    html += '<div class="rel-char-card" data-char-id="' + c.id + '">' +
      _relAvatarHTML(c.avatar, c.name, 'rel-char-card-avatar') +
      '<div class="rel-char-card-name">' + _relEsc(c.name || '?') + '</div>' +
      '<div class="rel-char-card-type">' + _relEsc(c.type === 'char' ? '角色' : c.type === 'npc' ? 'NPC' : '用户') + '</div>' +
    '</div>';
  }
  grid.innerHTML = html;

  // Stagger card entrance
  _relAnimateStaggerItems('.rel-char-card', grid);

  grid.querySelectorAll('.rel-char-card').forEach(function(card) {
    card.addEventListener('click', function() {
      var charId = parseInt(card.dataset.charId);
      if (charId) _relShowGraphPage(charId);
    });
  });
}

// =============================================================
//  PAGE 2: GRAPH PAGE (force-graph)
// =============================================================

function _relShowGraphPage(charId) {
  var page = document.getElementById(_relPageId);
  if (!page) return;
  _relCurrentCharId = charId;

  var body = page.querySelector('#rel-body');
  if (!body) return;

  body.innerHTML =
    '<div class="rel-graph-body">' +
      '<div class="rel-graph-loading" id="rel-graph-loading">' +
        '<i class="fa fa-spinner"></i>' +
        '<span>加载图谱中...</span>' +
      '</div>' +
      '<div class="rel-graph-canvas-wrap" id="rel-graph-wrap"></div>' +
      '<div class="rel-graph-legend" id="rel-graph-legend">' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:#5b9aff"></div><span>亲密 (80+)</span></div>' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:rgba(91,154,255,0.5)"></div><span>友好 (50-79)</span></div>' +
        '<div class="rel-graph-legend-item"><div class="rel-graph-legend-dot" style="background:rgba(0,0,0,0.15)"></div><span>一般 (&lt;50)</span></div>' +
      '</div>' +
      '<div class="rel-graph-tools">' +
        '<button class="rel-graph-tool-btn" id="rel-graph-add" title="添加关系"><i class="fa fa-plus"></i></button>' +
        '<button class="rel-graph-tool-btn" id="rel-graph-ai" title="AI分析"><i class="fa fa-wand-magic-sparkles"></i></button>' +
        '<button class="rel-graph-tool-btn" id="rel-graph-manage" title="管理"><i class="fa fa-gear"></i></button>' +
      '</div>' +
    '</div>';

  _relSetTitle(page, '关系图');
  _relSetHeaderRight(page,
    '<button class="rel-header-btn" id="rel-graph-refresh" title="刷新"><i class="fa fa-arrows-rotate"></i></button>'
  );

  // Animate tool buttons entrance
  _relAnimateStaggerItems('.rel-graph-tool-btn', body);

  _relRenderGraph(charId);

  // Tool button events
  body.querySelector('#rel-graph-add').addEventListener('click', function() {
    _relShowAddSheet(charId, page);
  });
  body.querySelector('#rel-graph-ai').addEventListener('click', function() {
    _relShowAnalysisPage(charId);
  });
  body.querySelector('#rel-graph-manage').addEventListener('click', function() {
    _relShowManagePage(charId);
  });

  var refreshBtn = page.querySelector('#rel-graph-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', function() {
      _relRenderGraph(charId);
    });
  }
}

async function _relRenderGraph(charId) {
  var wrap = document.getElementById('rel-graph-wrap');
  var loading = document.getElementById('rel-graph-loading');
  if (!wrap) return;

  // Cleanup previous instance
  if (_relGraphInstance) {
    try { _relGraphInstance._destructor && _relGraphInstance._destructor(); } catch(e) {}
    wrap.innerHTML = '';
    _relGraphInstance = null;
  }
  if (_relGraphResizeHandler) {
    window.removeEventListener('resize', _relGraphResizeHandler);
    _relGraphResizeHandler = null;
  }
  if (_relLinkPulseRAF) {
    cancelAnimationFrame(_relLinkPulseRAF);
    _relLinkPulseRAF = null;
  }
  _relGraphParticles = [];

  if (loading) loading.style.display = 'flex';

  var allChars = await _relGetAllChars();
  var rels = await _relGetAll(charId);
  var centerChar = await _relGetChar(charId);

  // Fallback: use char.relations if no stored relationships
  if (!rels.length && centerChar && centerChar.relations && centerChar.relations.length) {
    rels = centerChar.relations.map(function(r) {
      var tc = allChars.find(function(c) { return c.id === r.charId; });
      return {
        charId: charId,
        targetId: r.charId,
        targetName: tc ? tc.name : '',
        type: r.type || '',
        desc: r.desc || '',
        affinity: 50
      };
    });
  }

  var graphData = _relBuildGraphData(charId, rels, allChars, centerChar);

  if (!window.ForceGraph) {
    if (loading) loading.innerHTML = '<span style="color:#b05a5a">ForceGraph 库未加载</span>';
    return;
  }

  if (loading) loading.style.display = 'none';

  var Graph = window.ForceGraph;
  var graph = Graph()(wrap)
    .graphData(graphData)
    .backgroundColor('#ffffff')
    .width(wrap.clientWidth)
    .height(wrap.clientHeight)
    .nodeLabel(function() { return ''; })
    .nodeVal(function(node) { return node.type === 'center' ? 30 : 20; })
    .linkColor(function(link) {
      var aff = link.affinity || 50;
      if (aff >= 80) return 'rgba(91,154,255,0.6)';
      if (aff >= 50) return 'rgba(91,154,255,0.35)';
      return 'rgba(0,0,0,0.12)';
    })
    .linkWidth(function(link) {
      return (link.affinity || 50) >= 70 ? 2.5 : 1.5;
    })
    .linkDirectionalArrowLength(0)
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    .cooldownTime(3000)
    .onNodeClick(function(node) {
      _relShowDetailCard(node, charId);
    });

  // Custom node rendering with avatar + name
  graph.nodeCanvasObject(function(node, ctx, globalScale) {
    // NaN guard
    if (isNaN(node.x) || isNaN(node.y)) return;

    var size = node.type === 'center' ? 24 : 16;
    var fontSize = 12 / globalScale;

    // Center node breathing glow
    if (node.type === 'center') {
      var t = (Date.now() % 3000) / 3000;
      var glowSize = size + 4 + Math.sin(t * Math.PI * 2) * 3;
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, glowSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(91,154,255,' + (0.08 + Math.sin(t * Math.PI * 2) * 0.04) + ')';
      ctx.fill();
      ctx.restore();
    }

    // Entering node scale animation
    var nodeScale = 1;
    if (node._entering) {
      nodeScale = 0;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();

    if (node._imgLoaded && node._img) {
      try {
        ctx.drawImage(node._img, node.x - size, node.y - size, size * 2, size * 2);
      } catch(e) {
        _relDrawFallbackCircle(ctx, node, size);
      }
    } else {
      _relDrawFallbackCircle(ctx, node, size);
      if (node.avatar && !node._imgLoading) {
        node._imgLoading = true;
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
          node._img = img;
          node._imgLoaded = true;
          graph.refresh();
        };
        img.onerror = function() {
          node._imgLoading = false;
        };
        img.src = node.avatar;
      }
    }
    ctx.restore();

    // Draw border
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.strokeStyle = node.type === 'center' ? '#5b9aff' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = node.type === 'center' ? 2.5 : 1.5;
    ctx.stroke();

    // Draw name below
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = (node.type === 'center' ? 'bold ' : '') + fontSize + 'px -apple-system, "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#2f3136';
    ctx.fillText(node.name || '?', node.x, node.y + size + 4);

    // Draw relationship type tag
    if (node.relType && node.type !== 'center') {
      var tagFontSize = 10 / globalScale;
      ctx.font = tagFontSize + 'px -apple-system, sans-serif';
      ctx.fillStyle = '#5b9aff';
      ctx.fillText(node.relType, node.x, node.y + size + 4 + fontSize + 2);
    }
  });

  graph.nodePointerAreaPaint(function(node, color, ctx) {
    if (isNaN(node.x) || isNaN(node.y)) return;
    var size = node.type === 'center' ? 24 : 16;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
    ctx.fill();
  });

  _relGraphInstance = graph;

  // Initialize floating particles on the graph canvas
  _relInitGraphParticles(graph);

  // Start link pulse animation loop
  _relStartLinkPulse(graph);

  // BFS stagger node entrance animation
  _relAnimateGraphEntrance(graph, graphData, charId);

  // Center on the center node
  setTimeout(function() {
    _relCenterGraph();
  }, 600);

  // Resize handler
  _relGraphResizeHandler = function() {
    if (_relGraphInstance && wrap) {
      _relGraphInstance.width(wrap.clientWidth).height(wrap.clientHeight);
    }
  };
  window.addEventListener('resize', _relGraphResizeHandler);
}

// ===== Floating particles on graph canvas background =====
function _relInitGraphParticles(graph) {
  _relGraphParticles = [];
  for (var i = 0; i < 20; i++) {
    _relGraphParticles.push({
      x: (Math.random() - 0.5) * 800,
      y: (Math.random() - 0.5) * 800,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 2,
      alpha: 0.08 + Math.random() * 0.12
    });
  }
}

// ===== Link pulse animation: draw moving dots along connections =====
function _relStartLinkPulse(graph) {
  if (!graph) return;
  var linkPulses = [];
  var lastBuild = 0;

  function buildPulses() {
    var data = graph.graphData();
    if (!data || !data.links) return;
    linkPulses = [];
    for (var i = 0; i < data.links.length; i++) {
      var link = data.links[i];
      linkPulses.push({
        link: link,
        t: Math.random(),
        speed: 0.003 + Math.random() * 0.004,
        color: (link.affinity || 50) >= 70 ? 'rgba(91,154,255,0.6)' : 'rgba(91,154,255,0.3)'
      });
    }
  }

  function animate() {
    _relLinkPulseRAF = requestAnimationFrame(animate);

    var now = Date.now();
    if (now - lastBuild > 5000) {
      buildPulses();
      lastBuild = now;
    }

    try {
      var canvas = graph.canvas();
      if (!canvas) return;
      var ctx = canvas.getContext('2d');

      // Draw floating particles
      for (var p = 0; p < _relGraphParticles.length; p++) {
        var pt = _relGraphParticles[p];
        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.x > 400 || pt.x < -400) pt.vx *= -1;
        if (pt.y > 400 || pt.y < -400) pt.vy *= -1;

        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(91,154,255,' + pt.alpha + ')';
        ctx.fill();
      }

      // Draw link pulse dots
      for (var i = 0; i < linkPulses.length; i++) {
        var lp = linkPulses[i];
        var link = lp.link;
        var src = typeof link.source === 'object' ? link.source : null;
        var tgt = typeof link.target === 'object' ? link.target : null;
        if (!src || !tgt || src.x == null || tgt.x == null ||
            isNaN(src.x) || isNaN(src.y) || isNaN(tgt.x) || isNaN(tgt.y)) continue;

        lp.t += lp.speed;
        if (lp.t > 1) lp.t -= 1;

        var px = src.x + (tgt.x - src.x) * lp.t;
        var py = src.y + (tgt.y - src.y) * lp.t;

        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fillStyle = lp.color;
        ctx.fill();
      }
    } catch (e) {
      // Canvas may not be ready
    }
  }

  buildPulses();
  lastBuild = Date.now();
  animate();
}

// ===== BFS stagger node entrance animation =====
function _relAnimateGraphEntrance(graph, graphData, centerCharId) {
  if (!_relHasAnime() || !graphData || !graphData.nodes.length) return;

  // BFS from center node
  var adjacency = {};
  graphData.links.forEach(function(l) {
    var sid = typeof l.source === 'object' ? l.source.id : l.source;
    var tid = typeof l.target === 'object' ? l.target.id : l.target;
    if (!adjacency[sid]) adjacency[sid] = [];
    if (!adjacency[tid]) adjacency[tid] = [];
    adjacency[sid].push(tid);
    adjacency[tid].push(sid);
  });

  var visited = {};
  var queue = [centerCharId];
  var order = [];
  visited[centerCharId] = true;
  var depth = {};
  depth[centerCharId] = 0;

  while (queue.length) {
    var curr = queue.shift();
    order.push({ id: curr, depth: depth[curr] });
    var neighbors = adjacency[curr] || [];
    for (var i = 0; i < neighbors.length; i++) {
      if (!visited[neighbors[i]]) {
        visited[neighbors[i]] = true;
        depth[neighbors[i]] = depth[curr] + 1;
        queue.push(neighbors[i]);
      }
    }
  }

  // Animate each node with a delay based on BFS depth
  var nodeMap = {};
  graphData.nodes.forEach(function(n) { nodeMap[n.id] = n; });

  order.forEach(function(item, idx) {
    var node = nodeMap[item.id];
    if (!node) return;
    var delay = 100 + item.depth * 200 + idx * 30;

    node._entering = true;

    setTimeout(function() {
      node._entering = false;
      if (graph && typeof graph.refresh === 'function') graph.refresh();
    }, delay);
  });

  // Refresh graph periodically during entrance
  var entranceStart = Date.now();
  var entranceDuration = 100 + order.length * 50 + 400;
  function entranceLoop() {
    if (Date.now() - entranceStart < entranceDuration) {
      if (graph && typeof graph.refresh === 'function') graph.refresh();
      requestAnimationFrame(entranceLoop);
    }
  }
  requestAnimationFrame(entranceLoop);
}

function _relDrawFallbackCircle(ctx, node, size) {
  var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size);
  if (node.type === 'center') {
    grad.addColorStop(0, '#dceaff');
    grad.addColorStop(1, '#a0c4ff');
  } else {
    grad.addColorStop(0, '#f0f0f2');
    grad.addColorStop(1, '#d8d8da');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);

  // Draw initial
  ctx.fillStyle = node.type === 'center' ? '#5b9aff' : '#8a8a8a';
  ctx.font = 'bold ' + (size * 0.9) + 'px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(_relGetInitial(node.name), node.x, node.y);
}

function _relCenterGraph() {
  if (!_relGraphInstance) return;
  _relGraphInstance.centerAt(0, 0, 800);
  _relGraphInstance.zoom(1.2, 800);
}

// =============================================================
//  PAGE 3: DETAIL CARD POPUP
// =============================================================

async function _relShowDetailCard(node, centerCharId) {
  var targetId = node.id || node;
  // Remove existing overlay
  var old = document.getElementById('rel-detail-overlay');
  if (old) old.remove();

  var target = await _relGetChar(targetId);
  var rel = null;
  if (centerCharId && targetId !== centerCharId) {
    rel = await _relGetBetween(centerCharId, targetId);
  }

  // Gather all relationships for this character
  var targetRels = await _relGetAll(targetId);
  var allStored = await db.relationships.toArray();
  var incomingRels = allStored.filter(function(r) { return r.targetId === targetId && r.charId !== targetId; });
  var allRels = targetRels.concat(incomingRels);

  var seenPairs = {};
  var uniqueRels = [];
  for (var i = 0; i < allRels.length; i++) {
    var r = allRels[i];
    var pairKey = Math.min(r.charId, r.targetId) + '-' + Math.max(r.charId, r.targetId);
    if (!seenPairs[pairKey]) {
      seenPairs[pairKey] = true;
      uniqueRels.push(r);
    }
  }

  var relRowsHTML = '';
  for (var j = 0; j < uniqueRels.length; j++) {
    var rr = uniqueRels[j];
    var otherId = rr.charId === targetId ? rr.targetId : rr.charId;
    var otherChar = await _relGetChar(otherId);
    if (!otherChar) continue;
    relRowsHTML +=
      '<div class="rel-detail-relation-row" data-char-id="' + otherId + '">' +
        _relAvatarHTML(otherChar.avatar, otherChar.name, 'rel-detail-relation-avatar') +
        '<div class="rel-detail-relation-info">' +
          '<div class="rel-detail-relation-name">' + _relEsc(otherChar.name) + '</div>' +
          '<div class="rel-detail-relation-type">' + _relEsc(rr.type || '') + '</div>' +
        '</div>' +
      '</div>';
  }

  if (!relRowsHTML) {
    relRowsHTML = '<div class="rel-empty-hint" style="padding:12px 0;font-size:13px">暂无已知关系</div>';
  }

  var affinityVal = rel ? (rel.affinity || 0) : 0;
  var affinityHTML = rel ? (
    '<div class="rel-detail-section">' +
      '<div class="rel-detail-label">亲密度</div>' +
      '<div class="rel-affinity-bar-wrap">' +
        '<div class="rel-affinity-bar"><div class="rel-affinity-bar-fill" style="width:' + affinityVal + '%"></div></div>' +
        '<span class="rel-affinity-value">' + affinityVal + '</span>' +
      '</div>' +
    '</div>'
  ) : '';

  var overlay = document.createElement('div');
  overlay.id = 'rel-detail-overlay';
  overlay.className = 'rel-overlay';
  overlay.innerHTML =
    '<div class="rel-detail-card">' +
      '<div class="rel-detail-header">' +
        _relAvatarHTML(target ? target.avatar : '', target ? target.name : '?', 'rel-detail-avatar') +
        '<div class="rel-detail-info">' +
          '<div class="rel-detail-name">' + _relEsc(target ? target.name : '未知') + '</div>' +
          '<div class="rel-detail-type">' + _relEsc(target ? (target.role || target.type || '') : '') + '</div>' +
        '</div>' +
        '<button class="rel-detail-close" id="rel-detail-close"><i class="fa fa-times"></i></button>' +
      '</div>' +
      '<div class="rel-detail-body">' +
        (rel && rel.type ? (
          '<div class="rel-detail-section">' +
            '<div class="rel-detail-label">关系</div>' +
            '<div class="rel-detail-text">' + _relEsc(rel.type) + '</div>' +
          '</div>'
        ) : '') +
        (rel && (rel.desc || rel.description) ? (
          '<div class="rel-detail-section">' +
            '<div class="rel-detail-label">描述</div>' +
            '<div class="rel-detail-text">' + _relEsc(rel.desc || rel.description) + '</div>' +
          '</div>'
        ) : '') +
        affinityHTML +
        (target && target.description ? (
          '<div class="rel-detail-section">' +
            '<div class="rel-detail-label">简介</div>' +
            '<div class="rel-detail-text">' + _relEsc(target.description.substring(0, 200)) + (target.description.length > 200 ? '...' : '') + '</div>' +
          '</div>'
        ) : '') +
        '<div class="rel-detail-section">' +
          '<div class="rel-detail-label">相关角色</div>' +
          '<div class="rel-detail-relations">' + relRowsHTML + '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Animate overlay and card entrance with anime.js
  if (_relHasAnime()) {
    window.anime({
      targets: overlay,
      opacity: [0, 1],
      duration: 250,
      easing: 'easeOutCubic'
    });
    window.anime({
      targets: overlay.querySelector('.rel-detail-card'),
      scale: [0.88, 1],
      opacity: [0, 1],
      translateY: [12, 0],
      duration: 400,
      delay: 80,
      easing: 'easeOutBack'
    });
    // Stagger relation rows
    var relRows = overlay.querySelectorAll('.rel-detail-relation-row');
    if (relRows.length) {
      window.anime({
        targets: relRows,
        translateX: [-10, 0],
        opacity: [0, 1],
        duration: 300,
        delay: window.anime.stagger(40, { start: 250 }),
        easing: 'easeOutCubic'
      });
    }
  } else {
    overlay.style.opacity = '1';
    var card = overlay.querySelector('.rel-detail-card');
    if (card) { card.style.opacity = '1'; card.style.transform = 'none'; }
  }

  // Close handlers
  overlay.querySelector('#rel-detail-close').addEventListener('click', function() {
    _relCloseDetailOverlay(overlay);
  });
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) _relCloseDetailOverlay(overlay);
  });

  // Click on related character -> switch graph
  overlay.querySelectorAll('.rel-detail-relation-row').forEach(function(row) {
    row.addEventListener('click', function() {
      var charId = parseInt(row.dataset.charId);
      _relCloseDetailOverlay(overlay, function() {
        if (charId) _relShowGraphPage(charId);
      });
    });
  });
}

function _relCloseDetailOverlay(overlay, callback) {
  if (!overlay) return;
  if (_relHasAnime()) {
    window.anime({
      targets: overlay,
      opacity: [1, 0],
      duration: 200,
      easing: 'easeInCubic',
      complete: function() {
        overlay.remove();
        if (callback) callback();
      }
    });
    var card = overlay.querySelector('.rel-detail-card');
    if (card) {
      window.anime({
        targets: card,
        scale: [1, 0.92],
        opacity: [1, 0],
        translateY: [0, 12],
        duration: 200,
        easing: 'easeInCubic'
      });
    }
  } else {
    overlay.remove();
    if (callback) callback();
  }
}

// =============================================================
//  PAGE 4: ADD RELATIONSHIP SHEET (bottom slide-up)
// =============================================================

async function _relShowAddSheet(charId, page) {
  var old = document.getElementById('rel-add-sheet');
  if (old) old.remove();

  var allChars = await _relGetAllChars();
  var otherChars = allChars.filter(function(c) { return c.id !== charId; });

  var optionsHTML = '<option value="">选择角色...</option>';
  for (var i = 0; i < otherChars.length; i++) {
    var c = otherChars[i];
    optionsHTML += '<option value="' + c.id + '">' + _relEsc(c.name || '?') + '</option>';
  }

  var sheet = document.createElement('div');
  sheet.id = 'rel-add-sheet';
  sheet.className = 'rel-modal';
  sheet.innerHTML =
    '<div class="rel-modal-sheet">' +
      '<div class="rel-modal-title">添加关系</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">目标角色</label>' +
        '<select class="rel-modal-select" id="rel-add-target">' + optionsHTML + '</select>' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">关系类型</label>' +
        '<input class="rel-modal-input" id="rel-add-type" placeholder="如：朋友、同事、恋人">' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">描述（选填）</label>' +
        '<textarea class="rel-modal-textarea" id="rel-add-desc" placeholder="描述这段关系..."></textarea>' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">亲密度 (0-100): <span id="rel-add-aff-val">50</span></label>' +
        '<input type="range" id="rel-add-affinity" min="0" max="100" value="50" style="width:100%;accent-color:#5b9aff">' +
      '</div>' +
      '<div class="rel-modal-actions">' +
        '<button class="rel-modal-btn rel-modal-btn-cancel" id="rel-add-cancel">取消</button>' +
        '<button class="rel-modal-btn rel-modal-btn-confirm" id="rel-add-save">保存</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(sheet);

  // Animate sheet entrance
  if (_relHasAnime()) {
    window.anime({ targets: sheet, opacity: [0, 1], duration: 250, easing: 'easeOutCubic' });
    window.anime({ targets: sheet.querySelector('.rel-modal-sheet'), translateY: ['100%', '0%'], duration: 400, easing: 'easeOutCubic' });
  } else {
    sheet.style.opacity = '1';
    sheet.querySelector('.rel-modal-sheet').style.transform = 'translateY(0)';
  }

  // Affinity slider live update
  var affSlider = sheet.querySelector('#rel-add-affinity');
  var affVal = sheet.querySelector('#rel-add-aff-val');
  affSlider.addEventListener('input', function() { affVal.textContent = affSlider.value; });

  // Cancel
  sheet.querySelector('#rel-add-cancel').addEventListener('click', function() {
    _relCloseSheet(sheet);
  });
  sheet.addEventListener('click', function(e) {
    if (e.target === sheet) _relCloseSheet(sheet);
  });

  // Save
  sheet.querySelector('#rel-add-save').addEventListener('click', async function() {
    var selectedTarget = parseInt(sheet.querySelector('#rel-add-target').value);
    if (!selectedTarget) {
      _relToast('请选择目标角色');
      return;
    }
    var targetChar = await _relGetChar(selectedTarget);
    var newRel = {
      charId: charId,
      targetId: selectedTarget,
      targetName: targetChar ? targetChar.name : '',
      type: sheet.querySelector('#rel-add-type').value.trim(),
      desc: sheet.querySelector('#rel-add-desc').value.trim(),
      affinity: parseInt(affSlider.value) || 50,
      source: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await _relSave(newRel);
    _relToast('关系已保存');
    _relCloseSheet(sheet);
    // Refresh graph
    _relRenderGraph(charId);
  });
}

function _relCloseSheet(sheet) {
  if (!sheet) return;
  if (_relHasAnime()) {
    window.anime({ targets: sheet, opacity: [1, 0], duration: 200, easing: 'easeInCubic', complete: function() { sheet.remove(); } });
    var inner = sheet.querySelector('.rel-modal-sheet');
    if (inner) { window.anime({ targets: inner, translateY: ['0%', '100%'], duration: 300, easing: 'easeInCubic' }); }
  } else {
    sheet.remove();
  }
}

// =============================================================
//  PAGE 4b: EDIT RELATION MODAL (used from manage page)
// =============================================================

async function _relShowEditModal(charId, relId, targetId) {
  var old = document.getElementById('rel-edit-modal');
  if (old) old.remove();

  var rel = null;
  if (relId) {
    rel = await _relGetById(relId);
  }

  var allChars = await _relGetAllChars();
  var otherChars = allChars.filter(function(c) { return c.id !== charId; });

  var currentTarget = rel ? rel.targetId : (targetId || '');
  var currentType = rel ? (rel.type || '') : '';
  var currentDesc = rel ? (rel.desc || rel.description || '') : '';
  var currentAffinity = rel ? (rel.affinity != null ? rel.affinity : 50) : 50;

  var optionsHTML = '<option value="">选择角色...</option>';
  for (var i = 0; i < otherChars.length; i++) {
    var c = otherChars[i];
    var sel = c.id === currentTarget ? ' selected' : '';
    optionsHTML += '<option value="' + c.id + '"' + sel + '>' + _relEsc(c.name || '?') + '</option>';
  }

  var modal = document.createElement('div');
  modal.id = 'rel-edit-modal';
  modal.className = 'rel-modal';
  modal.innerHTML =
    '<div class="rel-modal-sheet">' +
      '<div class="rel-modal-title">' + (relId ? '编辑关系' : '添加关系') + '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">目标角色</label>' +
        '<select class="rel-modal-select" id="rel-edit-target">' + optionsHTML + '</select>' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">关系类型</label>' +
        '<input class="rel-modal-input" id="rel-edit-type" placeholder="如：朋友、同事、恋人" value="' + _relEsc(currentType) + '">' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">描述</label>' +
        '<textarea class="rel-modal-textarea" id="rel-edit-desc" placeholder="描述这段关系...">' + _relEsc(currentDesc) + '</textarea>' +
      '</div>' +
      '<div class="rel-modal-field">' +
        '<label class="rel-modal-label">亲密度 (0-100): <span id="rel-aff-val">' + currentAffinity + '</span></label>' +
        '<input type="range" id="rel-edit-affinity" min="0" max="100" value="' + currentAffinity + '" style="width:100%;accent-color:#5b9aff">' +
      '</div>' +
      '<div class="rel-modal-actions">' +
        (relId ? '<button class="rel-modal-btn rel-modal-btn-cancel" id="rel-edit-delete" style="background:#fde8e8;color:#b05a5a">删除</button>' : '') +
        '<button class="rel-modal-btn rel-modal-btn-cancel" id="rel-edit-cancel">取消</button>' +
        '<button class="rel-modal-btn rel-modal-btn-confirm" id="rel-edit-save">保存</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(modal);

  // Animate modal entrance
  if (_relHasAnime()) {
    window.anime({ targets: modal, opacity: [0, 1], duration: 250, easing: 'easeOutCubic' });
    window.anime({ targets: modal.querySelector('.rel-modal-sheet'), translateY: ['100%', '0%'], duration: 400, easing: 'easeOutCubic' });
  } else {
    modal.style.opacity = '1';
    modal.querySelector('.rel-modal-sheet').style.transform = 'translateY(0)';
  }

  // Affinity slider live update
  var affSlider = modal.querySelector('#rel-edit-affinity');
  var affVal = modal.querySelector('#rel-aff-val');
  affSlider.addEventListener('input', function() { affVal.textContent = affSlider.value; });

  // Cancel
  modal.querySelector('#rel-edit-cancel').addEventListener('click', function() {
    _relCloseSheet(modal);
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) _relCloseSheet(modal);
  });

  // Delete
  var delBtn = modal.querySelector('#rel-edit-delete');
  if (delBtn) {
    delBtn.addEventListener('click', async function() {
      if (relId) {
        await _relDelete(relId);
        _relToast('已删除');
        _relCloseSheet(modal);
        _relLoadManageList(charId);
      }
    });
  }

  // Save
  modal.querySelector('#rel-edit-save').addEventListener('click', async function() {
    var selectedTarget = parseInt(modal.querySelector('#rel-edit-target').value);
    if (!selectedTarget) {
      _relToast('请选择目标角色');
      return;
    }
    var targetChar = await _relGetChar(selectedTarget);
    var newRel = {
      charId: charId,
      targetId: selectedTarget,
      targetName: targetChar ? targetChar.name : '',
      type: modal.querySelector('#rel-edit-type').value.trim(),
      desc: modal.querySelector('#rel-edit-desc').value.trim(),
      affinity: parseInt(affSlider.value) || 50,
      updatedAt: Date.now()
    };
    if (relId) newRel.id = relId;
    if (!relId) newRel.createdAt = Date.now();

    await _relSave(newRel);
    _relToast('已保存');
    _relCloseSheet(modal);
    _relLoadManageList(charId);
  });
}

// =============================================================
//  PAGE 5: AI ANALYSIS PAGE
// =============================================================

function _relShowAnalysisPage(charId) {
  var page = document.getElementById(_relPageId);
  if (!page) return;

  var body = page.querySelector('#rel-body');
  if (!body) return;

  _relSetTitle(page, 'AI分析');
  _relSetHeaderRight(page, '');

  body.innerHTML = '<div class="rel-analysis-body" id="rel-analysis-body"></div>';

  var analysisBody = body.querySelector('#rel-analysis-body');
  _relRenderAnalysisContent(analysisBody, charId);
  _relAnimatePageIn(body);
}

async function _relRenderAnalysisContent(container, charId) {
  var char = await _relGetChar(charId);
  if (!char) {
    container.innerHTML = '<div class="rel-empty-hint">角色未找到</div>';
    return;
  }

  var existingRels = await _relGetAll(charId);

  var html =
    '<div class="rel-analysis-card">' +
      '<div class="rel-analysis-card-title">' + _relEsc(char.name) + '</div>' +
      '<div class="rel-analysis-text">' + _relEsc(char.description || '暂无描述') + '</div>' +
    '</div>' +
    '<button class="rel-analysis-btn" id="rel-ai-extract">' +
      '<i class="fa fa-wand-magic-sparkles"></i> 从人设提取关系' +
    '</button>' +
    '<div id="rel-ai-results"></div>';

  container.innerHTML = html;

  var resultsDiv = container.querySelector('#rel-ai-results');

  if (existingRels.length) {
    resultsDiv.innerHTML = '<div class="rel-analysis-card-title" style="margin-bottom:8px;font-size:13px;color:#888">已存储关系 (' + existingRels.length + ')</div>';
    for (var i = 0; i < existingRels.length; i++) {
      resultsDiv.innerHTML += _relBuildAnalysisRelRow(existingRels[i]);
    }
    _relAnimateStaggerItems('.rel-analysis-rel-row', resultsDiv);
  }

  // Extract button
  container.querySelector('#rel-ai-extract').addEventListener('click', async function() {
    var btn = this;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 分析中...';
    try {
      var extracted = await _relExtractFromPersona(char);
      _relAnalysisResults[charId] = extracted;

      if (!extracted.length) {
        _relToast('人设中未发现关系');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i> 从人设提取关系';
        return;
      }

      var toSave = extracted.map(function(r) {
        return {
          charId: charId,
          targetId: r.targetId || 0,
          targetName: r.targetName || r.name || '',
          type: r.type || '',
          desc: r.desc || r.description || '',
          affinity: r.affinity || 50,
          source: 'ai',
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
      }).filter(function(r) { return r.targetId || r.targetName; });

      // Merge with existing
      var existing = await _relGetAll(charId);
      var existingMap = {};
      existing.forEach(function(e) { existingMap[e.targetId] = e; });

      for (var j = 0; j < toSave.length; j++) {
        var existingEntry = existingMap[toSave[j].targetId];
        if (existingEntry) {
          toSave[j].id = existingEntry.id;
          toSave[j].createdAt = existingEntry.createdAt;
        }
      }

      await _relSaveBatch(toSave);
      localStorage.setItem('rel_last_gen_time', String(Date.now()));
      _relToast('提取了 ' + toSave.length + ' 条关系');

      _relRenderAnalysisContent(container, charId);
    } catch (e) {
      console.error('[Relationship] extract error:', e);
      _relToast('错误: ' + (e.message || '未知错误'));
      btn.disabled = false;
      btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i> 从人设提取关系';
    }
  });
}

function _relBuildAnalysisRelRow(rel) {
  return '<div class="rel-analysis-rel-row">' +
    '<div class="rel-analysis-rel-avatar"><span>' + _relEsc(_relGetInitial(rel.targetName)) + '</span></div>' +
    '<div class="rel-analysis-rel-body">' +
      '<div class="rel-analysis-rel-name">' + _relEsc(rel.targetName || '未知') + '</div>' +
      '<div class="rel-analysis-rel-type">' + _relEsc(rel.type || '') + ' (亲密度: ' + (rel.affinity || 50) + ')</div>' +
      (rel.desc || rel.description ? '<div class="rel-analysis-rel-desc">' + _relEsc(rel.desc || rel.description) + '</div>' : '') +
    '</div>' +
  '</div>';
}

// =============================================================
//  MANAGE PAGE (edit/delete relationships)
// =============================================================

function _relShowManagePage(charId) {
  var page = document.getElementById(_relPageId);
  if (!page) return;

  var body = page.querySelector('#rel-body');
  if (!body) return;

  _relSetTitle(page, '关系管理');
  _relSetHeaderRight(page,
    '<button class="rel-header-btn" id="rel-add-rel-btn" title="添加关系"><i class="fa fa-plus"></i></button>'
  );

  body.innerHTML = '<div class="rel-manage-body" id="rel-manage-body"></div>';
  _relLoadManageList(charId);
  _relAnimatePageIn(body);

  page.querySelector('#rel-add-rel-btn').addEventListener('click', function() {
    _relShowEditModal(charId, null);
  });
}

async function _relLoadManageList(charId) {
  var container = document.getElementById('rel-manage-body');
  if (!container) return;

  var rels = await _relGetAll(charId);
  var allChars = await _relGetAllChars();
  var charMap = {};
  allChars.forEach(function(c) { charMap[c.id] = c; });

  var html = '';

  // Import existing char.relations if not yet stored
  var char = await _relGetChar(charId);
  if (char && char.relations && char.relations.length) {
    var relTargets = {};
    rels.forEach(function(r) { relTargets[r.targetId] = true; });
    var unlinked = char.relations.filter(function(r) {
      return !relTargets[r.charId];
    });
    if (unlinked.length) {
      html += '<button class="rel-manage-btn" id="rel-import-existing">' +
        '<i class="fa fa-download"></i> 导入 ' + unlinked.length + ' 条已有关系' +
      '</button>';
    }
  }

  if (rels.length) {
    html += '<div class="rel-manage-section-title">关系列表 (' + rels.length + ')</div>';
    html += '<div class="rel-manage-list">';
    for (var i = 0; i < rels.length; i++) {
      var r = rels[i];
      var tc = charMap[r.targetId];
      html +=
        '<div class="rel-manage-item" data-rel-id="' + r.id + '" data-char-id="' + r.targetId + '">' +
          _relAvatarHTML(tc ? tc.avatar : '', r.targetName || (tc ? tc.name : '?'), 'rel-manage-item-avatar') +
          '<div class="rel-manage-item-info">' +
            '<div class="rel-manage-item-name">' + _relEsc(r.targetName || (tc ? tc.name : '?')) + '</div>' +
            '<div class="rel-manage-item-sub">' + _relEsc(r.type || '') + ((r.desc || r.description) ? ' - ' + _relEsc(r.desc || r.description) : '') + '</div>' +
          '</div>' +
          '<i class="fa fa-chevron-right rel-manage-item-arrow"></i>' +
        '</div>';
    }
    html += '</div>';

    html += '<button class="rel-manage-btn rel-manage-btn-danger" id="rel-clear-all">' +
      '<i class="fa fa-trash"></i> 清除所有关系' +
    '</button>';
  } else {
    html += '<div class="rel-empty-hint">暂无存储的关系。使用AI分析从人设中提取。</div>';
  }

  container.innerHTML = html;

  // Stagger animate list items
  _relAnimateStaggerItems('.rel-manage-item', container);

  // Bind events
  container.querySelectorAll('.rel-manage-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var relId = parseInt(item.dataset.relId);
      var targetId = parseInt(item.dataset.charId);
      _relShowEditModal(charId, relId, targetId);
    });
  });

  var importBtn = container.querySelector('#rel-import-existing');
  if (importBtn) {
    importBtn.addEventListener('click', async function() {
      await _relImportExistingRelations(charId);
      _relToast('关系已导入');
      _relLoadManageList(charId);
    });
  }

  var clearBtn = container.querySelector('#rel-clear-all');
  if (clearBtn) {
    clearBtn.addEventListener('click', async function() {
      if (confirm('确定清除该角色的所有关系？')) {
        await _relDeleteForChar(charId);
        _relToast('已清除');
        _relLoadManageList(charId);
      }
    });
  }
}

async function _relImportExistingRelations(charId) {
  var char = await _relGetChar(charId);
  if (!char || !char.relations || !char.relations.length) return;

  var existing = await _relGetAll(charId);
  var existingTargets = {};
  existing.forEach(function(r) { existingTargets[r.targetId] = true; });

  var toSave = [];
  for (var i = 0; i < char.relations.length; i++) {
    var r = char.relations[i];
    if (existingTargets[r.charId]) continue;
    var target = await _relGetChar(r.charId);
    toSave.push({
      charId: charId,
      targetId: r.charId,
      targetName: target ? target.name : '',
      type: r.type || '',
      desc: r.desc || '',
      affinity: 50,
      source: 'import',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }
  if (toSave.length) await _relSaveBatch(toSave);
}

// =============================================================
//  GLOBAL: getRelationshipContext - for AI prompt injection
// =============================================================

async function getRelationshipContext(charId) {
  if (!window.db) return '';
  var rels = await _relGetAll(charId);
  if (!rels.length) {
    var char = await _relGetChar(charId);
    if (!char || !char.relations || !char.relations.length) return '';
    var lines = [];
    for (var i = 0; i < char.relations.length; i++) {
      var r = char.relations[i];
      var target = await _relGetChar(r.charId);
      var name = target ? target.name : '未知';
      lines.push('- ' + name + '：' + (r.type || '关系') + (r.desc ? '（' + r.desc.slice(0, 30) + '）' : ''));
    }
    return '\n【你的人际关系】\n' + lines.join('\n');
  }

  var lines2 = [];
  for (var j = 0; j < rels.length; j++) {
    var rel = rels[j];
    var line = '- ' + (rel.targetName || '未知') + '：' + (rel.type || '关系');
    if (rel.desc || rel.description) line += '（' + (rel.desc || rel.description).slice(0, 30) + '）';
    if (typeof rel.affinity === 'number') line += ' [亲密度:' + rel.affinity + '/100]';
    lines2.push(line);
  }
  return '\n【你的人际关系】\n' + lines2.join('\n');
}

// =============================================================
//  GLOBAL: getRelationBetween - get specific relationship
// =============================================================

async function getRelationBetween(charId, targetNameOrId) {
  var numericId = parseInt(targetNameOrId);
  if (!isNaN(numericId)) {
    var byId = await _relGetBetween(charId, numericId);
    if (byId) return byId;
  }
  return await _relGetBetween(charId, String(targetNameOrId));
}

// =============================================================
//  GLOBAL: relGetAll, relSave, relDelete (exposed for other modules)
// =============================================================

window.relGetAll = _relGetAll;
window.relSave = _relSave;
window.relDelete = _relDelete;

// =============================================================
//  ENTRY POINT
// =============================================================

window.showRelationshipPage = async function() {
  window.toast && window.toast('\u5173\u7cfb\u7f51v5\u52a0\u8f7d\u4e2d...');
  try {
    // Check auto-refresh
    var needsRefresh = _relCheckAutoRefresh();

    var page = _relCreatePage();
    _relRenderSelectPage(page);

    // If auto-refresh needed, trigger AI generation in background
    if (needsRefresh) {
      console.log('[Relationship] Auto-refresh triggered (2+ days since last generation)');
    }
  } catch(e) {
    console.error('[Relationship] error:', e);
    window.toast && window.toast('打开失败: ' + e.message);
  }
};

// =============================================================
//  EXPOSE GLOBAL API
// =============================================================

window.getRelationshipContext = getRelationshipContext;
window.getRelationBetween = getRelationBetween;

console.log('[Relationship] Module loaded successfully');
