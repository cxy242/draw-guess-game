// relationship.js — 关系网模块
// 依赖：db.js, force-graph.min.js
// ===== IIFE =====
;(function() {
  'use strict';

  try {

  var PAGE_ID = 'relationship-page';

  // ===== Safe HTML escape =====
  function esc(str) {
    if (typeof wcEscHtml === 'function') return wcEscHtml(str);
    if (str == null) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ===== Initial character for avatar fallback =====
  function getInitial(name) {
    return String(name || '?').trim().charAt(0) || '?';
  }

  // ===== Avatar HTML =====
  function avatarHTML(src, name, cls) {
    var c = cls || '';
    if (src) {
      return '<div class="' + c + '"><img src="' + esc(src) + '" alt="' + esc(name) + '"></div>';
    }
    return '<div class="' + c + '"><span>' + esc(getInitial(name)) + '</span></div>';
  }

  // ===== Toast helper =====
  function relToast(msg) {
    if (typeof window.toast === 'function') { window.toast(msg); return; }
    var el = document.createElement('div');
    el.className = 'rel-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 2000);
  }

  // ===== DB Version 17 Upgrade =====
  function upgradeDB() {
    if (!window.db) return;
    try {
      db.version(17).stores({
        config:            'key',
        characters:        '++id, type, name',
        chats:             '++id, charId, ownerUid, [ownerUid+charId]',
        messages:          '++id, chatId, createdAt, [chatId+createdAt], clientMessageId, serverMessageId, onlineStatus',
        groupChats:        '++id',
        groupMessages:     '++id, groupId, createdAt',
        moments:           '++id, ownerUid, charId, createdAt, [ownerUid+charId]',
        finance:           '++id, charId',
        offlineChats:      '++id, charId',
        stickers:          '++id, categoryId',
        stickerCategories: '++id',
        memories:          '++id, ownerUid, charId, chatId, [ownerUid+charId], [chatId+status], updatedAt',
        memoryRuns:        '++id, ownerUid, charId, chatId, fromMsgId, toMsgId, createdAt',
        callRecords:       '++id, chatId, charId, ownerUid, createdAt',
        smsConversations:  '++id, ownerPhone, remotePhone, [ownerPhone+remotePhone], updatedAt',
        smsMessages:       '++id, conversationId, createdAt',
        imageBlobs:        '++id, createdAt',
        doorModules:       '&id, type, enabled, updatedAt',
        doorResults:       '&id, userId, characterId, moduleId, createdAt',
        avgSaves:          '++id, gameId, slot, updatedAt',
        avgConfigs:        'key',
        mcpServers:        '&id, name, enabled, updatedAt',
        mcpToolTraces:     '++id, scope, conversationId, [scope+conversationId], turnId, createdAt',
        relationships:     '++id, charId, targetId, [charId+targetId], affinity',
        npcCharacters:     '++id, sourceCharId, name'
      });
    } catch (e) {
      console.warn('[Relationship] DB upgrade error (may already exist):', e);
    }
  }

  // Try upgrading immediately; if db not ready, wait
  if (window.db) {
    upgradeDB();
  } else {
    var _dbWait = setInterval(function() {
      if (window.db) { clearInterval(_dbWait); upgradeDB(); }
    }, 100);
    setTimeout(function() { clearInterval(_dbWait); }, 10000);
  }

  // =============================================================
  //  RELATIONSHIP CRUD
  // =============================================================

  async function getAllRelationships(charId) {
    if (!window.db) return [];
    return await db.relationships.where('charId').equals(charId).toArray();
  }

  async function getRelationshipById(id) {
    if (!window.db) return null;
    return await db.relationships.get(id);
  }

  async function getRelationshipBetween(charId, targetId) {
    if (!window.db) return null;
    // Try by numeric id first
    if (typeof targetId === 'number') {
      var r = await db.relationships.where('[charId+targetId]').equals([charId, targetId]).first();
      if (r) return r;
    }
    // Fallback: search by target name
    var all = await db.relationships.where('charId').equals(charId).toArray();
    var targetLower = String(targetId).toLowerCase();
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].targetName || '').toLowerCase() === targetLower) return all[i];
      if (String(all[i].targetId) === String(targetId)) return all[i];
    }
    return null;
  }

  async function saveRelationship(rel) {
    if (!window.db) return 0;
    if (rel.id) {
      await db.relationships.update(rel.id, rel);
      return rel.id;
    }
    return await db.relationships.add(rel);
  }

  async function deleteRelationship(id) {
    if (!window.db) return;
    await db.relationships.delete(id);
  }

  async function deleteRelationshipsForChar(charId) {
    if (!window.db) return;
    await db.relationships.where('charId').equals(charId).delete();
  }

  async function saveRelationshipsBatch(rels) {
    if (!window.db || !rels.length) return;
    await db.relationships.bulkPut(rels);
  }

  // =============================================================
  //  CHARACTER HELPERS
  // =============================================================

  async function getChar(charId) {
    return await db.characters.get(charId);
  }

  async function getAllChars() {
    return await db.characters.toArray();
  }

  async function getCharsByIds(ids) {
    if (!ids.length) return [];
    return (await db.characters.bulkGet(ids)).filter(Boolean);
  }

  // =============================================================
  //  AFFINITY CALCULATION FROM CHAT MESSAGES
  // =============================================================

  async function calculateAffinity(charId) {
    if (!window.db) return {};
    var chats = await db.chats.where('charId').equals(charId).toArray();
    var result = {};
    for (var i = 0; i < chats.length; i++) {
      var msgs = await db.messages.where('chatId').equals(chats[i].id).toArray();
      for (var j = 0; j < msgs.length; j++) {
        var m = msgs[j];
        // Count positive signals: message length, frequency
        // This is a simplified affinity - real one would use AI
        var ownerUid = chats[i].ownerUid || 'default';
        if (!result[ownerUid]) result[ownerUid] = { count: 0, totalLen: 0 };
        result[ownerUid].count++;
        result[ownerUid].totalLen += (m.content || '').length;
      }
    }
    // Normalize: 0-100
    var scores = {};
    for (var uid in result) {
      var d = result[uid];
      // More messages and longer = higher affinity, cap at 100
      scores[uid] = Math.min(100, Math.round(d.count * 2 + d.totalLen / 50));
    }
    return scores;
  }

  async function getAffinityForTarget(charId, targetId) {
    // Check stored relationship first
    var rel = await getRelationshipBetween(charId, targetId);
    if (rel && typeof rel.affinity === 'number') return rel.affinity;
    // Fallback: calculate from chat data (if target is user)
    var affinities = await calculateAffinity(charId);
    // Return the max affinity found (for display purposes)
    var max = 0;
    for (var uid in affinities) {
      if (affinities[uid] > max) max = affinities[uid];
    }
    return max;
  }

  // =============================================================
  //  AI RELATIONSHIP EXTRACTION FROM PERSONA
  // =============================================================

  async function extractRelationshipsFromPersona(char) {
    if (!char) throw new Error('No character provided');
    if (typeof window.callAI !== 'function') throw new Error('AI service not available');

    var charInfo = 'Name: ' + (char.name || 'Unknown') + '\n';
    if (char.nick) charInfo += 'Nickname: ' + char.nick + '\n';
    if (char.gender) charInfo += 'Gender: ' + char.gender + '\n';
    if (char.role) charInfo += 'Role: ' + char.role + '\n';
    if (char.description) charInfo += 'Description:\n' + char.description + '\n';

    // Include existing relations from char.relations
    var existingRels = char.relations || [];
    if (existingRels.length) {
      charInfo += '\nExisting known relations:\n';
      for (var i = 0; i < existingRels.length; i++) {
        var r = existingRels[i];
        var targetChar = await getChar(r.charId);
        charInfo += '- ' + (targetChar ? targetChar.name : 'ID:' + r.charId) + ': ' + (r.type || 'unknown');
        if (r.desc) charInfo += ' (' + r.desc + ')';
        charInfo += '\n';
      }
    }

    // Get all other characters for reference
    var allChars = await getAllChars();
    var otherChars = allChars.filter(function(c) { return c.id !== char.id; });
    var otherList = otherChars.map(function(c) {
      return '- ID:' + c.id + ' Name:' + (c.name || '?') + (c.role ? ' Role:' + c.role : '');
    }).join('\n');

    var prompt = 'You are analyzing a character profile to extract all interpersonal relationships.\n\n' +
      'CHARACTER PROFILE:\n' + charInfo + '\n\n' +
      'KNOWN CHARACTERS IN THE SYSTEM:\n' + otherList + '\n\n' +
      'TASK: Extract ALL people mentioned in this character\'s description and relations. ' +
      'For each person found, determine:\n' +
      '1. Whether they match a known character (by name)\n' +
      '2. The relationship type (friend, lover, family, colleague, rival, enemy, etc.)\n' +
      '3. A brief description of the relationship\n' +
      '4. An affinity score 0-100 (100=closest bond, 0=hostile)\n\n' +
      'Return a JSON array. Each element:\n' +
      '{ "targetId": <charId or null if not in system>, "targetName": "<name>", "type": "<relationship type>", ' +
      '"description": "<relationship description>", "affinity": <0-100> }\n\n' +
      'Return ONLY the JSON array, no other text. If no relationships found, return [].';

    var raw = await window.callAI([{ role: 'user', content: prompt }], {
      responseFormat: 'json_object',
      temperature: 0.3
    });

    var parsed;
    try {
      var obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      parsed = Array.isArray(obj) ? obj : (obj.relationships || obj.data || []);
    } catch (e) {
      console.warn('[Relationship] AI response parse error:', e, raw);
      parsed = [];
    }

    // Enrich with targetIds from name matching
    for (var j = 0; j < parsed.length; j++) {
      if (!parsed[j].targetId && parsed[j].targetName) {
        var match = otherChars.find(function(c) {
          return (c.name || '').toLowerCase() === parsed[j].targetName.toLowerCase() ||
                 (c.nick || '').toLowerCase() === parsed[j].targetName.toLowerCase();
        });
        if (match) parsed[j].targetId = match.id;
      }
      // Normalize affinity
      parsed[j].affinity = Math.max(0, Math.min(100, parseInt(parsed[j].affinity) || 50));
    }

    return parsed;
  }

  // =============================================================
  //  GENERATE ALL RELATIONSHIPS VIA AI (ONE BIG CALL)
  // =============================================================

  async function generateAllRelationships() {
    if (typeof window.callAI !== 'function') throw new Error('AI service not available');

    var allChars = await getAllChars();
    if (allChars.length < 2) throw new Error('Need at least 2 characters');

    var charSummaries = allChars.map(function(c) {
      var s = 'ID:' + c.id + ' Name:' + (c.name || '?');
      if (c.nick) s += ' Nick:' + c.nick;
      if (c.gender) s += ' Gender:' + c.gender;
      if (c.role) s += ' Role:' + c.role;
      if (c.description) s += '\n  Description: ' + c.description.substring(0, 300);
      if (c.relations && c.relations.length) {
        s += '\n  Relations: ' + c.relations.map(function(r) {
          var t = allChars.find(function(ac) { return ac.id === r.charId; });
          return (t ? t.name : 'ID:' + r.charId) + '(' + (r.type || '?') + ')';
        }).join(', ');
      }
      return s;
    }).join('\n\n');

    var prompt = 'You are building a relationship network for a group of characters.\n\n' +
      'CHARACTERS:\n' + charSummaries + '\n\n' +
      'TASK: For EVERY pair of characters that have any relationship, generate a relationship entry. ' +
      'Consider their descriptions, existing relations, and infer connections.\n\n' +
      'Return a JSON object: { "relationships": [...] }\n' +
      'Each element:\n' +
      '{ "charId": <source char ID>, "targetId": <target char ID>, "targetName": "<target name>", ' +
      '"type": "<relationship type>", "description": "<brief description>", "affinity": <0-100> }\n\n' +
      'Generate entries in BOTH directions (A->B and B->A) when appropriate. ' +
      'Use Chinese for type and description if the characters are Chinese. ' +
      'Return ONLY the JSON object.';

    var raw = await window.callAI([{ role: 'user', content: prompt }], {
      responseFormat: 'json_object',
      temperature: 0.4
    });

    var parsed;
    try {
      var obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
      parsed = Array.isArray(obj) ? obj : (obj.relationships || obj.data || []);
    } catch (e) {
      console.warn('[Relationship] generateAll parse error:', e, raw);
      throw new Error('Failed to parse AI response');
    }

    // Resolve targetIds and save
    var charMap = {};
    allChars.forEach(function(c) { charMap[c.id] = c; });

    var toSave = [];
    for (var i = 0; i < parsed.length; i++) {
      var r = parsed[i];
      if (!r.charId) continue;
      // Resolve targetId from name if missing
      if (!r.targetId && r.targetName) {
        var match = allChars.find(function(c) {
          return (c.name || '').toLowerCase() === r.targetName.toLowerCase();
        });
        if (match) r.targetId = match.id;
      }
      if (!r.targetId) continue;
      r.affinity = Math.max(0, Math.min(100, parseInt(r.affinity) || 50));
      r.updatedAt = Date.now();
      toSave.push(r);
    }

    // Clear old data and save new
    await db.relationships.clear();
    if (toSave.length) {
      await saveRelationshipsBatch(toSave);
    }
    return toSave;
  }

  // =============================================================
  //  GRAPH DATA BUILDER
  // =============================================================

  function buildGraphData(charId, relationships, allChars) {
    var charMap = {};
    allChars.forEach(function(c) { charMap[c.id] = c; });

    var center = charMap[charId];
    if (!center) return { nodes: [], links: [] };

    var nodes = [];
    var links = [];
    var nodeIds = new Set();
    var RADIUS = 160;

    // Center node
    nodes.push({
      id: center.id,
      name: center.name || '?',
      avatar: center.avatar || '',
      type: 'center',
      x: 0,
      y: 0,
      affinity: 100
    });
    nodeIds.add(center.id);

    // Collect unique targets
    var targets = [];
    var targetSeen = new Set();
    for (var i = 0; i < relationships.length; i++) {
      var r = relationships[i];
      var tid = r.targetId;
      if (!tid || tid === charId || targetSeen.has(tid)) continue;
      targetSeen.add(tid);
      targets.push(r);
    }

    // Position targets radially
    var angleStep = targets.length > 0 ? (2 * Math.PI / targets.length) : 0;
    for (var j = 0; j < targets.length; j++) {
      var rel = targets[j];
      var tChar = charMap[rel.targetId];
      var angle = angleStep * j - Math.PI / 2; // Start from top
      var dist = RADIUS + (100 - (rel.affinity || 50)) * 1.2; // Closer = higher affinity

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
      nodeIds.add(rel.targetId);

      links.push({
        source: charId,
        target: rel.targetId,
        type: rel.type || '',
        affinity: rel.affinity || 50,
        description: rel.description || ''
      });
    }

    // Add inter-target links if they exist in relationships
    for (var k = 0; k < relationships.length; k++) {
      var r2 = relationships[k];
      if (nodeIds.has(r2.charId) && nodeIds.has(r2.targetId) && r2.charId !== charId) {
        // Avoid duplicate links
        var exists = links.find(function(l) {
          return (l.source === r2.charId && l.target === r2.targetId) ||
                 (l.source === r2.targetId && l.target === r2.charId);
        });
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
  //  RELATIONSHIP CONTEXT FOR AI PROMPT INJECTION
  // =============================================================

  async function getRelationshipContext(charId) {
    if (!window.db) return '';
    var rels = await getAllRelationships(charId);
    if (!rels.length) {
      // Fallback to char.relations
      var char = await getChar(charId);
      if (!char || !char.relations || !char.relations.length) return '';
      var lines = [];
      for (var i = 0; i < char.relations.length; i++) {
        var r = char.relations[i];
        var target = await getChar(r.charId);
        var name = target ? target.name : 'Unknown';
        lines.push('- ' + name + ': ' + (r.type || 'relation') + (r.desc ? ' (' + r.desc + ')' : ''));
      }
      return 'Known relationships:\n' + lines.join('\n');
    }

    var lines2 = [];
    for (var j = 0; j < rels.length; j++) {
      var rel = rels[j];
      var line = '- ' + (rel.targetName || 'Unknown') + ': ' + (rel.type || 'relation');
      if (rel.description) line += ' - ' + rel.description;
      if (typeof rel.affinity === 'number') line += ' [affinity:' + rel.affinity + '/100]';
      lines2.push(line);
    }
    return 'Known relationships:\n' + lines2.join('\n');
  }

  // =============================================================
  //  GET SPECIFIC RELATIONSHIP BETWEEN TWO CHARACTERS
  // =============================================================

  async function getRelationBetween(charId, targetNameOrId) {
    // Try as ID first
    var numericId = parseInt(targetNameOrId);
    if (!isNaN(numericId)) {
      var byId = await getRelationshipBetween(charId, numericId);
      if (byId) return byId;
    }
    // Try by name
    return await getRelationshipBetween(charId, String(targetNameOrId));
  }

  // =============================================================
  //  PAGE 1: CHARACTER SELECT PAGE
  // =============================================================

  function renderSelectPage(page) {
    var body = page.querySelector('#rel-body');
    if (!body) return;
    body.innerHTML =
      '<div class="rel-select-body">' +
        '<input class="rel-select-search" id="rel-search" placeholder="搜索角色...">' +
        '<div class="rel-char-grid" id="rel-char-grid"></div>' +
      '</div>';

    setTitle(page, '关系网');
    setHeaderRight(page, '');

    var searchInput = body.querySelector('#rel-search');
    var grid = body.querySelector('#rel-char-grid');

    loadSelectGrid(grid, '');

    searchInput.addEventListener('input', function() {
      loadSelectGrid(grid, searchInput.value.trim());
    });
  }

  async function loadSelectGrid(grid, query) {
    var chars = await getAllChars();
    if (query) {
      var q = query.toLowerCase();
      chars = chars.filter(function(c) {
        return (c.name || '').toLowerCase().indexOf(q) >= 0 ||
               (c.nick || '').toLowerCase().indexOf(q) >= 0;
      });
    }
    if (!chars.length) {
      grid.innerHTML = '<div class="rel-empty-hint">No characters found</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      html += '<div class="rel-char-card" data-char-id="' + c.id + '">' +
        avatarHTML(c.avatar, c.name, 'rel-char-card-avatar') +
        '<div class="rel-char-card-name">' + esc(c.name || '?') + '</div>' +
        '<div class="rel-char-card-type">' + esc(c.type === 'char' ? 'CHAR' : c.type === 'npc' ? 'NPC' : 'USER') + '</div>' +
      '</div>';
    }
    grid.innerHTML = html;

    grid.querySelectorAll('.rel-char-card').forEach(function(card) {
      card.addEventListener('click', function() {
        var charId = parseInt(card.dataset.charId);
        if (charId) showGraphPage(charId);
      });
    });
  }

  // =============================================================
  //  PAGE 2: GRAPH PAGE (force-graph)
  // =============================================================

  var _graphInstance = null;
  var _graphResizeHandler = null;

  function showGraphPage(charId) {
    var page = document.getElementById(PAGE_ID);
    if (!page) return;
    _currentCharId = charId;

    var body = page.querySelector('#rel-body');
    if (!body) return;

    body.innerHTML =
      '<div class="rel-graph-body">' +
        '<div class="rel-graph-loading" id="rel-graph-loading">' +
          '<i class="fa fa-spinner"></i>' +
          '<span>Loading graph...</span>' +
        '</div>' +
        '<div class="rel-graph-canvas-wrap" id="rel-graph-wrap"></div>' +
        '<div class="rel-graph-tools">' +
          '<button class="rel-graph-tool-btn" id="rel-graph-zoom-in" title="Zoom in"><i class="fa fa-plus"></i></button>' +
          '<button class="rel-graph-tool-btn" id="rel-graph-zoom-out" title="Zoom out"><i class="fa fa-minus"></i></button>' +
          '<button class="rel-graph-tool-btn" id="rel-graph-center" title="Center"><i class="fa fa-crosshairs"></i></button>' +
          '<button class="rel-graph-tool-btn" id="rel-graph-ai" title="AI analysis"><i class="fa fa-wand-magic-sparkles"></i></button>' +
          '<button class="rel-graph-tool-btn" id="rel-graph-manage" title="Manage"><i class="fa fa-gear"></i></button>' +
        '</div>' +
      '</div>';

    setTitle(page, '关系图');
    setHeaderRight(page,
      '<button class="rel-header-btn" id="rel-graph-refresh" title="Refresh"><i class="fa fa-arrows-rotate"></i></button>'
    );

    renderGraph(charId);

    // Tool buttons
    body.querySelector('#rel-graph-zoom-in').addEventListener('click', function() {
      if (_graphInstance) _graphInstance.zoom(1.3, 400);
    });
    body.querySelector('#rel-graph-zoom-out').addEventListener('click', function() {
      if (_graphInstance) _graphInstance.zoom(0.7, 400);
    });
    body.querySelector('#rel-graph-center').addEventListener('click', function() {
      centerGraph();
    });
    body.querySelector('#rel-graph-ai').addEventListener('click', function() {
      showAnalysisPage(charId);
    });
    body.querySelector('#rel-graph-manage').addEventListener('click', function() {
      showManagePage(charId);
    });

    var refreshBtn = page.querySelector('#rel-graph-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function() {
        renderGraph(charId);
      });
    }
  }

  async function renderGraph(charId) {
    var wrap = document.getElementById('rel-graph-wrap');
    var loading = document.getElementById('rel-graph-loading');
    if (!wrap) return;

    // Cleanup previous instance
    if (_graphInstance) {
      try { _graphInstance._destructor && _graphInstance._destructor(); } catch(e) {}
      wrap.innerHTML = '';
      _graphInstance = null;
    }
    if (_graphResizeHandler) {
      window.removeEventListener('resize', _graphResizeHandler);
      _graphResizeHandler = null;
    }

    if (loading) loading.style.display = 'flex';

    var allChars = await getAllChars();
    var rels = await getAllRelationships(charId);

    // If no stored relationships, try to build from char.relations
    if (!rels.length) {
      var center = await getChar(charId);
      if (center && center.relations && center.relations.length) {
        rels = center.relations.map(function(r) {
          var tc = allChars.find(function(c) { return c.id === r.charId; });
          return {
            charId: charId,
            targetId: r.charId,
            targetName: tc ? tc.name : '',
            type: r.type || '',
            description: r.desc || '',
            affinity: 50
          };
        });
      }
    }

    var graphData = buildGraphData(charId, rels, allChars);

    if (!window.ForceGraph) {
      if (loading) loading.innerHTML = '<span style="color:#b05a5a">ForceGraph library not loaded</span>';
      return;
    }

    if (loading) loading.style.display = 'none';

    var Graph = window.ForceGraph;
    var graph = Graph()(wrap)
      .graphData(graphData)
      .backgroundColor('#ffffff')
      .width(wrap.clientWidth)
      .height(wrap.clientHeight)
      .nodeLabel(function() { return ''; }) // We render our own labels
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
      .d3AlphaDecay(0.05)
      .d3VelocityDecay(0.3)
      .cooldownTime(3000)
      .onNodeClick(function(node) {
        showDetailCard(node.id, charId);
      });

    // Custom node rendering with avatar + name
    graph.nodeCanvasObject(function(node, ctx, globalScale) {
      var size = node.type === 'center' ? 24 : 18;
      var fontSize = 12 / globalScale;

      // Draw circular avatar
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();

      if (node._imgLoaded && node._img) {
        try {
          ctx.drawImage(node._img, node.x - size, node.y - size, size * 2, size * 2);
        } catch(e) {
          drawFallbackCircle(ctx, node, size);
        }
      } else {
        drawFallbackCircle(ctx, node, size);
        // Load image async
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

    graph.nodePointerAreaPaint(function(node, color, ctx, globalScale) {
      var size = node.type === 'center' ? 24 : 18;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
      ctx.fill();
    });

    _graphInstance = graph;

    // Center on the center node
    setTimeout(function() {
      centerGraph();
    }, 600);

    // Resize handler
    _graphResizeHandler = function() {
      if (_graphInstance && wrap) {
        _graphInstance.width(wrap.clientWidth).height(wrap.clientHeight);
      }
    };
    window.addEventListener('resize', _graphResizeHandler);
  }

  function drawFallbackCircle(ctx, node, size) {
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
    ctx.fillText(getInitial(node.name), node.x, node.y);
  }

  function centerGraph() {
    if (!_graphInstance) return;
    _graphInstance.centerAt(0, 0, 800);
    _graphInstance.zoom(1.2, 800);
  }

  // =============================================================
  //  PAGE 3: DETAIL CARD POPUP
  // =============================================================

  async function showDetailCard(targetId, centerCharId) {
    // Remove existing overlay
    var old = document.getElementById('rel-detail-overlay');
    if (old) old.remove();

    var target = await getChar(targetId);
    var rel = null;
    if (centerCharId && targetId !== centerCharId) {
      rel = await getRelationshipBetween(centerCharId, targetId);
    }

    // Get all relationships of this target
    var targetRels = await getAllRelationships(targetId);
    // Also get relationships pointing to this target
    var allStored = await db.relationships.toArray();
    var incomingRels = allStored.filter(function(r) { return r.targetId === targetId && r.charId !== targetId; });
    var allRels = targetRels.concat(incomingRels);

    // Deduplicate
    var seenPairs = {};
    var uniqueRels = [];
    for (var i = 0; i < allRels.length; i++) {
      var r = allRels[i];
      var key = Math.min(r.charId, r.targetId) + '-' + Math.max(r.charId, r.targetId);
      if (!seenPairs[key]) {
        seenPairs[key] = true;
        uniqueRels.push(r);
      }
    }

    var relRowsHTML = '';
    for (var j = 0; j < uniqueRels.length; j++) {
      var rr = uniqueRels[j];
      var otherId = rr.charId === targetId ? rr.targetId : rr.charId;
      var otherChar = await getChar(otherId);
      if (!otherChar) continue;
      relRowsHTML +=
        '<div class="rel-detail-relation-row" data-char-id="' + otherId + '">' +
          avatarHTML(otherChar.avatar, otherChar.name, 'rel-detail-relation-avatar') +
          '<div class="rel-detail-relation-info">' +
            '<div class="rel-detail-relation-name">' + esc(otherChar.name) + '</div>' +
            '<div class="rel-detail-relation-type">' + esc(rr.type || '') + '</div>' +
          '</div>' +
        '</div>';
    }

    if (!relRowsHTML) {
      relRowsHTML = '<div class="rel-empty-hint" style="padding:12px 0;font-size:13px">No known relationships</div>';
    }

    var affinityVal = rel ? (rel.affinity || 0) : 0;
    var affinityHTML = rel ? (
      '<div class="rel-detail-section">' +
        '<div class="rel-detail-label">AFFINITY</div>' +
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
          avatarHTML(target ? target.avatar : '', target ? target.name : '?', 'rel-detail-avatar') +
          '<div class="rel-detail-info">' +
            '<div class="rel-detail-name">' + esc(target ? target.name : 'Unknown') + '</div>' +
            '<div class="rel-detail-type">' + esc(target ? (target.role || target.type || '') : '') + '</div>' +
          '</div>' +
          '<button class="rel-detail-close" id="rel-detail-close"><i class="fa fa-times"></i></button>' +
        '</div>' +
        '<div class="rel-detail-body">' +
          (rel && rel.type ? (
            '<div class="rel-detail-section">' +
              '<div class="rel-detail-label">RELATIONSHIP</div>' +
              '<div class="rel-detail-text">' + esc(rel.type) + '</div>' +
            '</div>'
          ) : '') +
          (rel && rel.description ? (
            '<div class="rel-detail-section">' +
              '<div class="rel-detail-label">DESCRIPTION</div>' +
              '<div class="rel-detail-text">' + esc(rel.description) + '</div>' +
            '</div>'
          ) : '') +
          affinityHTML +
          (target && target.description ? (
            '<div class="rel-detail-section">' +
              '<div class="rel-detail-label">PROFILE</div>' +
              '<div class="rel-detail-text">' + esc(target.description.substring(0, 200)) + (target.description.length > 200 ? '...' : '') + '</div>' +
            '</div>'
          ) : '') +
          '<div class="rel-detail-section">' +
            '<div class="rel-detail-label">RELATED CHARACTERS</div>' +
            '<div class="rel-detail-relations">' + relRowsHTML + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelector('#rel-detail-close').addEventListener('click', function() {
      overlay.remove();
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });

    // Click on related character: navigate to their graph
    overlay.querySelectorAll('.rel-detail-relation-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var charId = parseInt(row.dataset.charId);
        overlay.remove();
        if (charId) showGraphPage(charId);
      });
    });
  }

  // =============================================================
  //  PAGE 4: AI ANALYSIS PAGE
  // =============================================================

  var _analysisResults = {};

  function showAnalysisPage(charId) {
    var page = document.getElementById(PAGE_ID);
    if (!page) return;

    var body = page.querySelector('#rel-body');
    if (!body) return;

    setTitle(page, 'AI Analysis');
    setHeaderRight(page, '');

    body.innerHTML =
      '<div class="rel-analysis-body" id="rel-analysis-body"></div>';

    var analysisBody = body.querySelector('#rel-analysis-body');

    // Render existing results if any
    renderAnalysisContent(analysisBody, charId);
  }

  async function renderAnalysisContent(container, charId) {
    var char = await getChar(charId);
    if (!char) {
      container.innerHTML = '<div class="rel-empty-hint">Character not found</div>';
      return;
    }

    var existing = _analysisResults[charId];
    var existingRels = await getAllRelationships(charId);

    var html =
      '<div class="rel-analysis-card">' +
        '<div class="rel-analysis-card-title">' + esc(char.name) + '</div>' +
        '<div class="rel-analysis-text">' + esc(char.description || 'No description available') + '</div>' +
      '</div>' +
      '<button class="rel-analysis-btn" id="rel-ai-extract">' +
        '<i class="fa fa-wand-magic-sparkles"></i> Extract from description' +
      '</button>' +
      '<button class="rel-analysis-btn" id="rel-ai-generate" style="background:#5b9aff">' +
        '<i class="fa fa-arrows-rotate"></i> Regenerate all relationships' +
      '</button>' +
      '<div id="rel-ai-results"></div>';

    container.innerHTML = html;

    var resultsDiv = container.querySelector('#rel-ai-results');

    // Show existing relationships
    if (existingRels.length) {
      resultsDiv.innerHTML = '<div class="rel-analysis-card-title" style="margin-bottom:8px;font-size:13px;color:#888">Stored Relationships (' + existingRels.length + ')</div>';
      for (var i = 0; i < existingRels.length; i++) {
        resultsDiv.innerHTML += buildAnalysisRelRow(existingRels[i]);
      }
    }

    // Extract button
    container.querySelector('#rel-ai-extract').addEventListener('click', async function() {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Analyzing...';
      try {
        var extracted = await extractRelationshipsFromPersona(char);
        _analysisResults[charId] = extracted;

        if (!extracted.length) {
          relToast('No relationships found in description');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i> Extract from description';
          return;
        }

        // Save extracted relationships
        var toSave = extracted.map(function(r) {
          return {
            charId: charId,
            targetId: r.targetId || 0,
            targetName: r.targetName || '',
            type: r.type || '',
            description: r.description || '',
            affinity: r.affinity || 50,
            updatedAt: Date.now()
          };
        }).filter(function(r) { return r.targetId || r.targetName; });

        // Check for existing entries and merge
        var existing = await getAllRelationships(charId);
        var existingMap = {};
        existing.forEach(function(e) { existingMap[e.targetId] = e; });

        for (var j = 0; j < toSave.length; j++) {
          var existingEntry = existingMap[toSave[j].targetId];
          if (existingEntry) {
            toSave[j].id = existingEntry.id; // Update existing
          }
        }

        await saveRelationshipsBatch(toSave);
        relToast('Extracted ' + toSave.length + ' relationships');

        // Re-render
        renderAnalysisContent(container, charId);
      } catch (e) {
        console.error('[Relationship] extract error:', e);
        relToast('Error: ' + (e.message || 'Unknown error'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-wand-magic-sparkles"></i> Extract from description';
      }
    });

    // Generate all button
    container.querySelector('#rel-ai-generate').addEventListener('click', async function() {
      var btn = this;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Generating all...';
      try {
        var all = await generateAllRelationships();
        relToast('Generated ' + all.length + ' relationships');
        renderAnalysisContent(container, charId);
      } catch (e) {
        console.error('[Relationship] generateAll error:', e);
        relToast('Error: ' + (e.message || 'Unknown error'));
        btn.disabled = false;
        btn.innerHTML = '<i class="fa fa-arrows-rotate"></i> Regenerate all relationships';
      }
    });
  }

  function buildAnalysisRelRow(rel) {
    return '<div class="rel-analysis-rel-row">' +
      '<div class="rel-analysis-rel-avatar"><span>' + esc(getInitial(rel.targetName)) + '</span></div>' +
      '<div class="rel-analysis-rel-body">' +
        '<div class="rel-analysis-rel-name">' + esc(rel.targetName || 'Unknown') + '</div>' +
        '<div class="rel-analysis-rel-type">' + esc(rel.type || '') + ' (affinity: ' + (rel.affinity || 50) + ')</div>' +
        (rel.description ? '<div class="rel-analysis-rel-desc">' + esc(rel.description) + '</div>' : '') +
      '</div>' +
    '</div>';
  }

  // =============================================================
  //  PAGE 5: MANAGE PAGE (edit/delete relationships)
  // =============================================================

  function showManagePage(charId) {
    var page = document.getElementById(PAGE_ID);
    if (!page) return;

    var body = page.querySelector('#rel-body');
    if (!body) return;

    setTitle(page, 'Manage');
    setHeaderRight(page,
      '<button class="rel-header-btn" id="rel-add-rel-btn" title="Add relationship"><i class="fa fa-plus"></i></button>'
    );

    body.innerHTML = '<div class="rel-manage-body" id="rel-manage-body"></div>';
    loadManageList(charId);

    // Add button
    page.querySelector('#rel-add-rel-btn').addEventListener('click', function() {
      showEditRelationModal(charId, null);
    });
  }

  async function loadManageList(charId) {
    var container = document.getElementById('rel-manage-body');
    if (!container) return;

    var rels = await getAllRelationships(charId);
    var allChars = await getAllChars();
    var charMap = {};
    allChars.forEach(function(c) { charMap[c.id] = c; });

    var html = '';

    // Button to add from existing char.relations
    var char = await getChar(charId);
    if (char && char.relations && char.relations.length) {
      var unlinked = char.relations.filter(function(r) {
        return !rels.find(function(sr) { return sr.targetId === r.charId; });
      });
      if (unlinked.length) {
        html += '<button class="rel-manage-btn" id="rel-import-existing">' +
          '<i class="fa fa-download"></i> Import ' + unlinked.length + ' existing relations' +
        '</button>';
      }
    }

    if (rels.length) {
      html += '<div class="rel-manage-section-title">Relationships (' + rels.length + ')</div>';
      html += '<div class="rel-manage-list">';
      for (var i = 0; i < rels.length; i++) {
        var r = rels[i];
        var tc = charMap[r.targetId];
        html +=
          '<div class="rel-manage-item" data-rel-id="' + r.id + '" data-char-id="' + r.targetId + '">' +
            avatarHTML(tc ? tc.avatar : '', r.targetName || (tc ? tc.name : '?'), 'rel-manage-item-avatar') +
            '<div class="rel-manage-item-info">' +
              '<div class="rel-manage-item-name">' + esc(r.targetName || (tc ? tc.name : '?')) + '</div>' +
              '<div class="rel-manage-item-sub">' + esc(r.type || '') + (r.description ? ' - ' + esc(r.description) : '') + '</div>' +
            '</div>' +
            '<i class="fa fa-chevron-right rel-manage-item-arrow"></i>' +
          '</div>';
      }
      html += '</div>';

      html += '<button class="rel-manage-btn rel-manage-btn-danger" id="rel-clear-all">' +
        '<i class="fa fa-trash"></i> Clear all relationships' +
      '</button>';
    } else {
      html += '<div class="rel-empty-hint">No relationships stored. Use AI analysis to extract them.</div>';
    }

    container.innerHTML = html;

    // Bind events
    container.querySelectorAll('.rel-manage-item').forEach(function(item) {
      item.addEventListener('click', function() {
        var relId = parseInt(item.dataset.relId);
        var targetId = parseInt(item.dataset.charId);
        showEditRelationModal(charId, relId, targetId);
      });
    });

    var importBtn = container.querySelector('#rel-import-existing');
    if (importBtn) {
      importBtn.addEventListener('click', async function() {
        await importExistingRelations(charId);
        relToast('Relations imported');
        loadManageList(charId);
      });
    }

    var clearBtn = container.querySelector('#rel-clear-all');
    if (clearBtn) {
      clearBtn.addEventListener('click', async function() {
        if (confirm('Clear all stored relationships for this character?')) {
          await deleteRelationshipsForChar(charId);
          relToast('All cleared');
          loadManageList(charId);
        }
      });
    }
  }

  async function importExistingRelations(charId) {
    var char = await getChar(charId);
    if (!char || !char.relations || !char.relations.length) return;
    var existing = await getAllRelationships(charId);
    var existingTargets = new Set(existing.map(function(r) { return r.targetId; }));
    var toSave = [];
    for (var i = 0; i < char.relations.length; i++) {
      var r = char.relations[i];
      if (existingTargets.has(r.charId)) continue;
      var target = await getChar(r.charId);
      toSave.push({
        charId: charId,
        targetId: r.charId,
        targetName: target ? target.name : '',
        type: r.type || '',
        description: r.desc || '',
        affinity: 50,
        updatedAt: Date.now()
      });
    }
    if (toSave.length) await saveRelationshipsBatch(toSave);
  }

  // =============================================================
  //  EDIT RELATION MODAL
  // =============================================================

  async function showEditRelationModal(charId, relId, targetId) {
    // Remove existing modal
    var old = document.getElementById('rel-edit-modal');
    if (old) old.remove();

    var rel = null;
    if (relId) {
      rel = await getRelationshipById(relId);
    }

    var allChars = await getAllChars();
    var otherChars = allChars.filter(function(c) { return c.id !== charId; });

    var currentTarget = rel ? rel.targetId : (targetId || '');
    var currentType = rel ? (rel.type || '') : '';
    var currentDesc = rel ? (rel.description || '') : '';
    var currentAffinity = rel ? (rel.affinity != null ? rel.affinity : 50) : 50;

    var optionsHTML = '<option value="">Select character...</option>';
    for (var i = 0; i < otherChars.length; i++) {
      var c = otherChars[i];
      var sel = c.id === currentTarget ? ' selected' : '';
      optionsHTML += '<option value="' + c.id + '"' + sel + '>' + esc(c.name || '?') + '</option>';
    }

    var modal = document.createElement('div');
    modal.id = 'rel-edit-modal';
    modal.className = 'rel-modal';
    modal.innerHTML =
      '<div class="rel-modal-sheet">' +
        '<div class="rel-modal-title">' + (relId ? 'Edit Relationship' : 'Add Relationship') + '</div>' +
        '<div class="rel-modal-field">' +
          '<label class="rel-modal-label">Target Character</label>' +
          '<select class="rel-modal-select" id="rel-edit-target">' + optionsHTML + '</select>' +
        '</div>' +
        '<div class="rel-modal-field">' +
          '<label class="rel-modal-label">Relationship Type</label>' +
          '<input class="rel-modal-input" id="rel-edit-type" placeholder="e.g. friend, lover, colleague" value="' + esc(currentType) + '">' +
        '</div>' +
        '<div class="rel-modal-field">' +
          '<label class="rel-modal-label">Description</label>' +
          '<textarea class="rel-modal-textarea" id="rel-edit-desc" placeholder="Describe the relationship...">' + esc(currentDesc) + '</textarea>' +
        '</div>' +
        '<div class="rel-modal-field">' +
          '<label class="rel-modal-label">Affinity (0-100): <span id="rel-aff-val">' + currentAffinity + '</span></label>' +
          '<input type="range" id="rel-edit-affinity" min="0" max="100" value="' + currentAffinity + '" style="width:100%;accent-color:#5b9aff">' +
        '</div>' +
        '<div class="rel-modal-actions">' +
          (relId ? '<button class="rel-modal-btn rel-modal-btn-cancel" id="rel-edit-delete" style="background:#fde8e8;color:#b05a5a">Delete</button>' : '') +
          '<button class="rel-modal-btn rel-modal-btn-cancel" id="rel-edit-cancel">Cancel</button>' +
          '<button class="rel-modal-btn rel-modal-btn-confirm" id="rel-edit-save">Save</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    // Affinity slider live update
    var affSlider = modal.querySelector('#rel-edit-affinity');
    var affVal = modal.querySelector('#rel-aff-val');
    affSlider.addEventListener('input', function() {
      affVal.textContent = affSlider.value;
    });

    // Cancel
    modal.querySelector('#rel-edit-cancel').addEventListener('click', function() {
      modal.remove();
    });

    // Click outside to close
    modal.addEventListener('click', function(e) {
      if (e.target === modal) modal.remove();
    });

    // Delete
    var delBtn = modal.querySelector('#rel-edit-delete');
    if (delBtn) {
      delBtn.addEventListener('click', async function() {
        if (relId) {
          await deleteRelationship(relId);
          relToast('Deleted');
          modal.remove();
          // Refresh manage page
          loadManageList(charId);
        }
      });
    }

    // Save
    modal.querySelector('#rel-edit-save').addEventListener('click', async function() {
      var selectedTarget = parseInt(modal.querySelector('#rel-edit-target').value);
      if (!selectedTarget) {
        relToast('Please select a target character');
        return;
      }
      var targetChar = await getChar(selectedTarget);
      var newRel = {
        charId: charId,
        targetId: selectedTarget,
        targetName: targetChar ? targetChar.name : '',
        type: modal.querySelector('#rel-edit-type').value.trim(),
        description: modal.querySelector('#rel-edit-desc').value.trim(),
        affinity: parseInt(affSlider.value) || 50,
        updatedAt: Date.now()
      };
      if (relId) newRel.id = relId;

      await saveRelationship(newRel);
      relToast('Saved');
      modal.remove();
      loadManageList(charId);
    });
  }

  // =============================================================
  //  PAGE SHELL (common header + body)
  // =============================================================

  var _currentCharId = null;

  function createPage() {
    var existing = document.getElementById(PAGE_ID);
    if (existing) existing.remove();

    var page = document.createElement('div');
    page.id = PAGE_ID;
    page.className = 'full-page rel-page';
    page.innerHTML =
      '<div class="rel-header">' +
        '<button class="rel-header-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="rel-header-title" id="rel-title">关系网</span>' +
        '<div class="rel-header-right" id="rel-header-right"></div>' +
      '</div>' +
      '<div id="rel-body" style="flex:1;display:flex;flex-direction:column;overflow:hidden"></div>';

    // Back button
    page.querySelector('#rel-back').addEventListener('click', function() {
      handleBack(page);
    });

    window.openPage(page);
    return page;
  }

  function setTitle(page, title) {
    var el = page.querySelector('#rel-title');
    if (el) el.textContent = title;
  }

  function setHeaderRight(page, html) {
    var el = page.querySelector('#rel-header-right');
    if (el) el.innerHTML = html;
  }

  function handleBack(page) {
    var title = page.querySelector('#rel-title');
    var currentTitle = title ? title.textContent : '';

    if (currentTitle === '关系图') {
      // Go back to select
      renderSelectPage(page);
      _currentCharId = null;
      // Cleanup graph
      if (_graphInstance) {
        try { _graphInstance._destructor && _graphInstance._destructor(); } catch(e) {}
        _graphInstance = null;
      }
      if (_graphResizeHandler) {
        window.removeEventListener('resize', _graphResizeHandler);
        _graphResizeHandler = null;
      }
    } else if (currentTitle === 'AI Analysis' || currentTitle === 'Manage') {
      // Go back to graph
      if (_currentCharId) {
        showGraphPage(_currentCharId);
      } else {
        renderSelectPage(page);
      }
    } else {
      // On select page: close
      window.closePage(PAGE_ID);
      _currentCharId = null;
      if (_graphInstance) {
        try { _graphInstance._destructor && _graphInstance._destructor(); } catch(e) {}
        _graphInstance = null;
      }
      if (_graphResizeHandler) {
        window.removeEventListener('resize', _graphResizeHandler);
        _graphResizeHandler = null;
      }
    }
  }

  // =============================================================
  //  ENTRY POINT
  // =============================================================

  function showRelationshipPage() {
    var page = createPage();
    renderSelectPage(page);
  }

  // =============================================================
  //  EXPOSE PUBLIC API
  // =============================================================

  window.RelationshipModule = {
    showRelationshipPage: showRelationshipPage,
    getRelationshipContext: getRelationshipContext,
    getRelationBetween: getRelationBetween,
    extractRelationshipsFromPersona: extractRelationshipsFromPersona,
    generateAllRelationships: generateAllRelationships,
    buildGraphData: buildGraphData,
    getAllRelationships: getAllRelationships,
    saveRelationship: saveRelationship,
    deleteRelationship: deleteRelationship,
    calculateAffinity: calculateAffinity,
    showGraphPage: showGraphPage,
    showAnalysisPage: showAnalysisPage,
    showManagePage: showManagePage,
    showDetailCard: showDetailCard
  };

  // Also expose entry point globally for home screen icon
  window.showRelationshipPage = showRelationshipPage;

  console.log('[Relationship] Module loaded successfully');

  } catch (e) {
    console.error('[Relationship] Module init error:', e);
  }

})();
