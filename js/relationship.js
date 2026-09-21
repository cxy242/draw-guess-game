// relationship.js — 关系网模块 v3
// 照 ensemble.js 模式写的，不用IIFE
// 依赖：db.js, force-graph.min.js, anime.min.js

window.showRelationshipPage = async function() {
  window.toast && window.toast('关系网打开中...');
  try {
    var old = document.getElementById('relationship-page');
    if (old) old.remove();

    var page = document.createElement('div');
    page.id = 'relationship-page';
    page.className = 'full-page rel-page';
    page.innerHTML =
      '<div class="rel-header">' +
        '<button class="rel-header-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="rel-header-title" id="rel-title">关系网</span>' +
        '<div class="rel-header-right"></div>' +
      '</div>' +
      '<div class="rel-body" id="rel-body"></div>';

    var backBtn = page.querySelector('#rel-back');
    if (backBtn) backBtn.onclick = function() {
      if (window._relGraph) { try { window._relGraph._destructor && window._relGraph._destructor(); } catch(e) {} window._relGraph = null; }
      if (window._relResize) { window.removeEventListener('resize', window._relResize); window._relResize = null; }
      window.closePage && window.closePage('relationship-page');
    };

    window.openPage(page);
    _relRenderSelect(page);
  } catch(e) {
    console.error('[Relationship] open error:', e);
    window.toast && window.toast('关系网打开失败: ' + e.message);
  }
};

// ===== 渲染选择页 =====
async function _relRenderSelect(page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#999"><i class="fa fa-spinner fa-spin"></i> 加载中...</div>';

  var chars = [];
  try { chars = await db.characters.where('type').equals('char').toArray(); } catch(e) {}

  if (!chars.length) {
    body.innerHTML = '<div style="text-align:center;padding:60px;color:#999"><i class="fa fa-diagram-project" style="font-size:48px;opacity:0.3"></i><div style="margin-top:16px;font-size:16px;color:#666">还没有角色</div><div style="margin-top:8px;font-size:14px;color:#999">请先在角色档案中创建角色</div></div>';
    return;
  }

  var html = '<div style="padding:12px">';
  chars.forEach(function(c) {
    var avatar = c.avatar
      ? '<img src="' + _relEsc(c.avatar) + '" style="width:48px;height:48px;border-radius:50%;object-fit:cover" onerror="this.style.display=\'none\'">'
      : '<div style="width:48px;height:48px;border-radius:50%;background:#e8e8e8;display:flex;align-items:center;justify-content:center;font-size:20px;color:#999">' + _relEsc((c.name||'?')[0]) + '</div>';
    html += '<div class="rel-char-item" data-id="' + c.id + '" style="display:flex;align-items:center;padding:12px;margin-bottom:8px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer">' +
      avatar +
      '<div style="flex:1;margin-left:12px"><div style="font-size:15px;font-weight:500;color:#2f3136">' + _relEsc(c.name) + '</div><div style="font-size:13px;color:#999;margin-top:2px">点击查看关系网</div></div>' +
      '<i class="fa fa-angle-right" style="color:#ccc"></i></div>';
  });
  html += '</div>';
  body.innerHTML = html;

  body.querySelectorAll('.rel-char-item').forEach(function(item) {
    item.onclick = function() { _relRenderGraph(page, parseInt(item.dataset.id)); };
  });
}

// ===== 渲染图谱页 =====
async function _relRenderGraph(page, charId) {
  var body = page.querySelector('#rel-body');
  if (!body) return;

  var char = null;
  try { char = await db.characters.get(charId); } catch(e) {}
  if (!char) { window.toast && window.toast('角色不存在'); return; }

  var title = page.querySelector('#rel-title');
  if (title) title.textContent = char.name + '的关系网';

  body.innerHTML =
    '<div id="rel-graph-wrap" style="flex:1;position:relative;overflow:hidden"></div>' +
    '<div style="position:absolute;bottom:20px;right:16px;display:flex;flex-direction:column;gap:8px;z-index:10">' +
      '<button id="rel-tool-center" style="width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.1);cursor:pointer"><i class="fa fa-crosshairs"></i></button>' +
      '<button id="rel-tool-add" style="width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.1);cursor:pointer"><i class="fa fa-plus"></i></button>' +
      '<button id="rel-tool-ai" style="width:40px;height:40px;border-radius:50%;border:none;background:rgba(255,255,255,0.9);box-shadow:0 2px 8px rgba(0,0,0,0.1);cursor:pointer"><i class="fa fa-wand-magic-sparkles"></i></button>' +
    '</div>';

  var wrap = body.querySelector('#rel-graph-wrap');
  if (!wrap) return;

  var rels = await _relGetAll(charId);
  var allChars = [];
  try { allChars = await db.characters.toArray(); } catch(e) {}

  var graphData = _relBuildGraph(charId, rels, allChars, char);

  if (!window.ForceGraph) {
    wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#999">ForceGraph未加载</div>';
    return;
  }

  var w = wrap.clientWidth || 300;
  var h = wrap.clientHeight || 400;

  window._relGraph = window.ForceGraph()(wrap)
    .graphData(graphData)
    .backgroundColor('#f7f7f8')
    .width(w)
    .height(h)
    .nodeLabel(function() { return ''; })
    .nodeVal(function(n) { return n.type === 'center' ? 30 : 20; })
    .linkColor(function() { return 'rgba(107,125,141,0.3)'; })
    .linkWidth(function() { return 1.5; })
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    .cooldownTime(3000)
    .onNodeClick(function(node) { _relShowDetail(node, charId); })
    .nodeCanvasObject(function(node, ctx, gs) {
      var size = node.type === 'center' ? 22 : 16;
      var fs = 11 / gs;
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
      if (node._img && node._imgLoaded) {
        try { ctx.drawImage(node._img, node.x - size, node.y - size, size * 2, size * 2); } catch(e) { _relDrawFallback(ctx, node, size); }
      } else {
        _relDrawFallback(ctx, node, size);
        if (node.avatar && !node._imgLoading && !node._imgFailed) {
          node._imgLoading = true;
          var img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() { node._img = img; node._imgLoaded = true; window._relGraph && window._relGraph.refresh(); };
          img.onerror = function() { node._imgLoading = false; node._imgFailed = true; };
          img.src = node.avatar;
        }
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.strokeStyle = node.type === 'center' ? 'rgba(107,125,141,0.6)' : 'rgba(0,0,0,0.08)';
      ctx.lineWidth = node.type === 'center' ? 2 : 1;
      ctx.stroke();
      if (fs > 0) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = (node.type === 'center' ? 'bold ' : '') + fs + 'px -apple-system, sans-serif';
        ctx.fillStyle = '#2d2b2e';
        ctx.fillText(node.name || '?', node.x, node.y + size + 3);
      }
    });

  setTimeout(function() { window._relGraph && window._relGraph.zoomToFit(400, 50); }, 500);

  var centerBtn = body.querySelector('#rel-tool-center');
  if (centerBtn) centerBtn.onclick = function() { window._relGraph && window._relGraph.zoomToFit(400, 50); };

  var addBtn = body.querySelector('#rel-tool-add');
  if (addBtn) addBtn.onclick = function() { _relShowAddSheet(charId, page); };

  var aiBtn = body.querySelector('#rel-tool-ai');
  if (aiBtn) aiBtn.onclick = function() { _relAiGenerate(charId, page); };

  window._relResize = function() { if (window._relGraph && wrap) window._relGraph.width(wrap.clientWidth).height(wrap.clientHeight); };
  window.addEventListener('resize', window._relResize);
}

// ===== 构建图数据 =====
function _relBuildGraph(charId, rels, allChars, centerChar) {
  var nodes = [{ id: 'c' + charId, name: centerChar.name, avatar: centerChar.avatar, type: 'center' }];
  var links = [];
  var seen = {};
  rels.forEach(function(r) {
    var nid = String(r.targetId).indexOf('npc_') === 0 ? r.targetId : 'c' + r.targetId;
    var nname = r.targetName || String(r.targetId);
    var nav = r.targetAvatar || '';
    if (!seen[nid]) {
      seen[nid] = true;
      var tc = allChars.find(function(c) { return String(c.id) === String(r.targetId); });
      if (tc) { nname = tc.name; nav = tc.avatar || ''; }
      nodes.push({ id: nid, name: nname, avatar: nav, type: 'related', relType: r.type });
    }
    links.push({ source: 'c' + charId, target: nid, type: r.type });
  });
  return { nodes: nodes, links: links };
}

// ===== 详情卡片 =====
function _relShowDetail(node, charId) {
  var old = document.getElementById('rel-detail-overlay');
  if (old) old.remove();
  var overlay = document.createElement('div');
  overlay.id = 'rel-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10001;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;padding:24px;max-width:320px;width:90%;text-align:center">' +
      (node.avatar ? '<img src="' + _relEsc(node.avatar) + '" style="width:64px;height:64px;border-radius:50%;object-fit:cover">' : '<div style="width:64px;height:64px;border-radius:50%;background:#e8e8e8;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:24px;color:#999">' + _relEsc((node.name||'?')[0]) + '</div>') +
      '<div style="font-size:18px;font-weight:600;margin-top:12px;color:#2f3136">' + _relEsc(node.name) + '</div>' +
      (node.relType ? '<div style="font-size:14px;color:#5b9aff;margin-top:4px">' + _relEsc(node.relType) + '</div>' : '') +
      '<div style="margin-top:16px;display:flex;gap:12px;justify-content:center">' +
        '<button id="rel-detail-close" style="padding:8px 24px;border-radius:20px;border:1px solid #ddd;background:#fff;font-size:14px;cursor:pointer">关闭</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.style.opacity = '1'; });
  overlay.onclick = function(e) { if (e.target === overlay) _relCloseOverlay(overlay); };
  overlay.querySelector('#rel-detail-close').onclick = function() { _relCloseOverlay(overlay); };
}

function _relCloseOverlay(el) {
  el.style.opacity = '0';
  setTimeout(function() { el.remove(); }, 200);
}

// ===== 添加关系 =====
function _relShowAddSheet(charId, page) {
  db.characters.toArray().then(function(allChars) {
    var others = allChars.filter(function(c) { return c.id !== charId; });
    var options = others.map(function(c) { return '<option value="' + c.id + '">' + _relEsc(c.name) + '</option>'; }).join('');
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10001;display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity 0.2s';
    overlay.innerHTML =
      '<div style="background:#fff;border-radius:16px 16px 0 0;padding:24px;width:100%;max-width:400px">' +
        '<div style="font-size:18px;font-weight:600;margin-bottom:16px">添加关系</div>' +
        '<select id="rel-add-target" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:12px"><option value="">选择目标角色</option>' + options + '</select>' +
        '<input id="rel-add-type" placeholder="关系类型（如：闺蜜、同事）" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:12px;box-sizing:border-box">' +
        '<textarea id="rel-add-desc" placeholder="关系描述（选填）" rows="2" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px;margin-bottom:16px;box-sizing:border-box;resize:none"></textarea>' +
        '<button id="rel-add-confirm" style="width:100%;padding:12px;border-radius:12px;border:none;background:#5b9aff;color:#fff;font-size:15px;cursor:pointer">确认添加</button>' +
      '</div>';
    document.body.appendChild(overlay);
    requestAnimationFrame(function() { overlay.style.opacity = '1'; });
    overlay.onclick = function(e) { if (e.target === overlay) _relCloseOverlay(overlay); };
    overlay.querySelector('#rel-add-confirm').onclick = async function() {
      var targetId = parseInt(overlay.querySelector('#rel-add-target').value);
      var type = overlay.querySelector('#rel-add-type').value.trim();
      var desc = overlay.querySelector('#rel-add-desc').value.trim();
      if (!targetId || !type) { window.toast && window.toast('请选择目标并填写关系类型'); return; }
      var target = allChars.find(function(c) { return c.id === targetId; });
      await _relSave({ charId: charId, targetId: targetId, targetName: target ? target.name : '', targetAvatar: target ? target.avatar || '' : '', type: type, desc: desc, affinity: 50, source: 'manual', createdAt: Date.now(), updatedAt: Date.now() });
      _relCloseOverlay(overlay);
      window.toast && window.toast('关系已添加');
      _relRenderGraph(page, charId);
    };
  });
}

// ===== AI生成 =====
async function _relAiGenerate(charId, page) {
  if (!window.callAI) { window.toast && window.toast('AI服务未配置'); return; }
  window.toast && window.toast('AI生成中...');
  try {
    var char = await db.characters.get(charId);
    if (!char) { window.toast && window.toast('角色不存在'); return; }
    var prompt = '你是关系网络分析器。根据以下角色人设，提取所有提到的人物和他们与角色的关系。\n\n角色名：' + char.name + '\n人设：\n' + (char.description || '暂无') + '\n\n返回JSON：{"relations":[{"name":"人名","type":"关系类型","desc":"简短描述"}]}';
    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', charAntiDrift: true });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;
    if (!data.relations || !data.relations.length) { window.toast && window.toast('人设中未找到相关人物'); return; }
    var count = 0;
    for (var i = 0; i < data.relations.length; i++) {
      var r = data.relations[i];
      if (!r.name) continue;
      await _relSave({ charId: charId, targetId: 'npc_' + Date.now() + '_' + i, targetName: r.name, targetAvatar: '', type: r.type || '认识', desc: r.desc || '', affinity: 50, source: 'ai', createdAt: Date.now(), updatedAt: Date.now() });
      count++;
    }
    window.toast && window.toast('已生成 ' + count + ' 条关系');
    _relRenderGraph(page, charId);
  } catch(e) {
    console.error('[Relationship] AI error:', e);
    window.toast && window.toast('AI生成失败: ' + e.message);
  }
}

// ===== CRUD =====
async function _relGetAll(charId) {
  try { if (window.db && window.db.relationships) return await db.relationships.where('charId').equals(charId).toArray(); } catch(e) {}
  return [];
}

async function _relSave(rel) {
  try {
    if (!window.db || !window.db.relationships) return;
    if (rel.id) await db.relationships.put(rel); else rel.id = await db.relationships.add(rel);
    return rel.id;
  } catch(e) { return null; }
}

async function _relDelete(id) {
  try { if (window.db && window.db.relationships) await db.relationships.delete(id); } catch(e) {}
}

// ===== 全局注入 =====
window.getRelationshipContext = async function(charId) {
  try {
    var rels = await _relGetAll(charId);
    if (!rels.length) return '';
    var lines = rels.map(function(r) { return '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + (r.desc ? '（' + r.desc.slice(0, 30) + '）' : ''); });
    return '\n【你的人际关系】\n' + lines.join('\n');
  } catch(e) { return ''; }
};

window.getRelationBetween = async function(charId, targetNameOrId) {
  try {
    var rels = await _relGetAll(charId);
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].targetName === targetNameOrId || String(rels[i].targetId) === String(targetNameOrId)) return rels[i];
    }
    return null;
  } catch(e) { return null; }
};

// ===== 辅助 =====
function _relEsc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _relDrawFallback(ctx, node, size) {
  var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size);
  grad.addColorStop(0, '#e8e8e8');
  grad.addColorStop(1, '#ccc');
  ctx.fillStyle = grad;
  ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
}

// ===== 自动刷新 =====
try {
  var _relLastGen = localStorage.getItem('rel_last_gen_time');
  if (!_relLastGen || (Date.now() - parseInt(_relLastGen)) > 2 * 24 * 60 * 60 * 1000) {
    if (window.db && window.db.characters) {
      db.characters.where('type').equals('char').toArray().then(function(chars) {
        if (chars.length) localStorage.setItem('rel_last_gen_time', String(Date.now()));
      }).catch(function() {});
    }
  }
} catch(e) {}

console.log('[Relationship] Module loaded');
