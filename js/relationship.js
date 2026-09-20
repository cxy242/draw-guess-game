// relationship.js — 关系网模块 (v2 重写)
// 照着 ensemble.js 模式写的，不用IIFE
// 依赖：db.js, force-graph.min.js, anime.min.js

'use strict';

var _relPageId = 'relationship-page';
var _relGraphInstance = null;
var _relResizeHandler = null;

// ===== 关系CRUD =====
async function relGetAll(charId) {
  try {
    if (!window.db || !window.db.relationships) return [];
    return await db.relationships.where('charId').equals(charId).toArray();
  } catch(e) { return []; }
}

async function relSave(rel) {
  try {
    if (!window.db || !window.db.relationships) return;
    if (rel.id) { await db.relationships.put(rel); }
    else { rel.id = await db.relationships.add(rel); }
    return rel.id;
  } catch(e) { return null; }
}

async function relDelete(id) {
  try { if (window.db && window.db.relationships) await db.relationships.delete(id); } catch(e) {}
}

// ===== 全局注入函数 =====
window.getRelationshipContext = async function(charId) {
  try {
    var rels = await relGetAll(charId);
    if (!rels.length) return '';
    var lines = rels.map(function(r) {
      return '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + (r.desc ? '（' + r.desc.slice(0, 30) + '）' : '');
    });
    return '\n【你的人际关系】\n' + lines.join('\n');
  } catch(e) { return ''; }
};

window.getRelationBetween = async function(charId, targetNameOrId) {
  try {
    var rels = await relGetAll(charId);
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].targetName === targetNameOrId || String(rels[i].targetId) === String(targetNameOrId)) return rels[i];
    }
    return null;
  } catch(e) { return null; }
};

// ===== Toast =====
function relToast(msg) {
  if (window.toast) { window.toast(msg); return; }
  var el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:#fff;padding:10px 20px;border-radius:20px;font-size:14px;z-index:9999';
  document.body.appendChild(el);
  setTimeout(function() { el.remove(); }, 2000);
}

// ===== 主页面 =====
window.showRelationshipPage = async function() {
  try {
    var old = document.getElementById(_relPageId);
    if (old) old.remove();

    var page = document.createElement('div');
    page.id = _relPageId;
    page.className = 'full-page rel-page';
    page.innerHTML =
      '<div class="rel-header">' +
        '<button class="rel-header-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="rel-header-title">关系网</span>' +
        '<div class="rel-header-right"></div>' +
      '</div>' +
      '<div class="rel-body" id="rel-body"></div>';

    page.querySelector('#rel-back').onclick = function() {
      if (_relGraphInstance) { try { _relGraphInstance._destructor && _relGraphInstance._destructor(); } catch(e) {} _relGraphInstance = null; }
      if (_relResizeHandler) { window.removeEventListener('resize', _relResizeHandler); _relResizeHandler = null; }
      window.closePage(_relPageId);
    };

    window.openPage(page);
    renderSelectPage(page);
  } catch(e) {
    console.error('[Relationship] open error:', e);
    relToast('关系网打开失败: ' + e.message);
  }
};

// ===== 选择页 =====
async function renderSelectPage(page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;

  body.innerHTML = '<div class="rel-loading"><i class="fa fa-spinner fa-spin"></i><span>加载中...</span></div>';

  var chars = [];
  try { chars = await db.characters.where('type').equals('char').toArray(); } catch(e) {}

  if (!chars.length) {
    body.innerHTML = '<div class="rel-empty"><div class="rel-empty-icon"><i class="fa fa-diagram-project"></i></div><div class="rel-empty-title">还没有角色</div><div class="rel-empty-desc">请先在角色档案中创建角色</div></div>';
    return;
  }

  var html = '<div class="rel-char-list">';
  chars.forEach(function(c) {
    var avatar = c.avatar ? '<img class="rel-char-avatar" src="' + esc(c.avatar) + '" onerror="this.style.display=\'none\'">' : '<div class="rel-char-avatar rel-avatar-fallback">' + esc((c.name || '?')[0]) + '</div>';
    html += '<div class="rel-char-item" data-char-id="' + c.id + '">' +
      avatar +
      '<div class="rel-char-info"><div class="rel-char-name">' + esc(c.name) + '</div><div class="rel-char-meta">点击查看关系网</div></div>' +
      '<i class="fa fa-angle-right rel-char-arrow"></i></div>';
  });
  html += '</div>';

  body.innerHTML = html;

  // 绑定点击
  body.querySelectorAll('.rel-char-item').forEach(function(item) {
    item.onclick = function() {
      var charId = parseInt(item.dataset.charId);
      renderGraphPage(page, charId);
    };
  });
}

// ===== 图谱页 =====
async function renderGraphPage(page, charId) {
  var body = page.querySelector('#rel-body');
  if (!body) return;

  var char = null;
  try { char = await db.characters.get(charId); } catch(e) {}
  if (!char) { relToast('角色不存在'); return; }

  // 更新标题
  var title = page.querySelector('.rel-header-title');
  if (title) title.textContent = char.name + '的关系网';

  body.innerHTML =
    '<div class="rel-graph-wrap" id="rel-graph-wrap"></div>' +
    '<div class="rel-graph-tools">' +
      '<button class="rel-graph-tool-btn" id="rel-tool-center" title="居中"><i class="fa fa-crosshairs"></i></button>' +
      '<button class="rel-graph-tool-btn" id="rel-tool-add" title="添加关系"><i class="fa fa-plus"></i></button>' +
      '<button class="rel-graph-tool-btn" id="rel-tool-ai" title="AI生成"><i class="fa fa-wand-magic-sparkles"></i></button>' +
    '</div>';

  var wrap = body.querySelector('#rel-graph-wrap');
  if (!wrap) return;

  // 获取关系数据
  var rels = await relGetAll(charId);
  var allChars = [];
  try { allChars = await db.characters.toArray(); } catch(e) {}

  var graphData = buildGraphData(charId, rels, allChars, char);

  // Force graph
  if (!window.ForceGraph) {
    wrap.innerHTML = '<div class="rel-empty"><div class="rel-empty-title">ForceGraph未加载</div></div>';
    return;
  }

  var w = wrap.clientWidth || 300;
  var h = wrap.clientHeight || 400;

  _relGraphInstance = window.ForceGraph()(wrap)
    .graphData(graphData)
    .backgroundColor('#f7f7f8')
    .width(w)
    .height(h)
    .nodeLabel(function() { return ''; })
    .nodeVal(function(n) { return n.type === 'center' ? 30 : 20; })
    .linkColor(function(l) { return 'rgba(107,125,141,0.3)'; })
    .linkWidth(function(l) { return 1.5; })
    .d3AlphaDecay(0.02)
    .d3VelocityDecay(0.3)
    .cooldownTime(3000)
    .onNodeClick(function(node) { showRelDetailCard(node, charId); });

  // 自定义节点渲染
  _relGraphInstance.nodeCanvasObject(function(node, ctx, gs) {
    var size = node.type === 'center' ? 22 : 16;
    var fs = 11 / gs;

    // 头像
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.closePath();
    ctx.clip();
    if (node._img && node._imgLoaded) {
      try { ctx.drawImage(node._img, node.x - size, node.y - size, size * 2, size * 2); } catch(e) { drawFallback(ctx, node, size); }
    } else {
      drawFallback(ctx, node, size);
      if (node.avatar && !node._imgLoading) {
        node._imgLoading = true;
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() { node._img = img; node._imgLoaded = true; _relGraphInstance && _relGraphInstance.refresh(); };
        img.onerror = function() { node._imgLoading = false; };
        img.src = node.avatar;
      }
    }
    ctx.restore();

    // 边框
    ctx.beginPath();
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
    ctx.strokeStyle = node.type === 'center' ? 'rgba(107,125,141,0.6)' : 'rgba(0,0,0,0.08)';
    ctx.lineWidth = node.type === 'center' ? 2 : 1;
    ctx.stroke();

    // 名字
    if (fs > 0) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = (node.type === 'center' ? 'bold ' : '') + fs + 'px -apple-system, sans-serif';
      ctx.fillStyle = '#2d2b2e';
      ctx.fillText(node.name || '?', node.x, node.y + size + 3);
    }
  });

  // 居中
  setTimeout(function() {
    _relGraphInstance && _relGraphInstance.zoomToFit(400, 50);
  }, 500);

  // 工具按钮
  var centerBtn = body.querySelector('#rel-tool-center');
  if (centerBtn) centerBtn.onclick = function() { _relGraphInstance && _relGraphInstance.zoomToFit(400, 50); };

  var addBtn = body.querySelector('#rel-tool-add');
  if (addBtn) addBtn.onclick = function() { showAddRelSheet(charId, page); };

  var aiBtn = body.querySelector('#rel-tool-ai');
  if (aiBtn) aiBtn.onclick = function() { aiGenerateRels(charId, page); };

  // Resize
  _relResizeHandler = function() {
    if (_relGraphInstance && wrap) {
      _relGraphInstance.width(wrap.clientWidth).height(wrap.clientHeight);
    }
  };
  window.addEventListener('resize', _relResizeHandler);
}

// ===== 构建图数据 =====
function buildGraphData(charId, rels, allChars, centerChar) {
  var nodes = [{ id: 'char_' + charId, name: centerChar.name, avatar: centerChar.avatar, type: 'center' }];
  var links = [];
  var seen = {};

  rels.forEach(function(r) {
    var targetId = r.targetId;
    var targetName = r.targetName || String(targetId);
    var targetAvatar = r.targetAvatar || '';
    var nodeId = String(targetId).indexOf('npc_') === 0 ? targetId : 'char_' + targetId;

    if (!seen[nodeId]) {
      seen[nodeId] = true;
      // 尝试从characters表找头像
      var tc = allChars.find(function(c) { return String(c.id) === String(targetId); });
      if (tc) { targetName = tc.name; targetAvatar = tc.avatar || ''; }

      nodes.push({ id: nodeId, name: targetName, avatar: targetAvatar, type: 'related', relType: r.type });
    }
    links.push({ source: 'char_' + charId, target: nodeId, affinity: r.affinity || 50, type: r.type });
  });

  return { nodes: nodes, links: links };
}

// ===== 详情卡片 =====
function showRelDetailCard(node, charId) {
  var old = document.getElementById('rel-detail-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'rel-detail-overlay';
  overlay.className = 'rel-card-overlay';
  overlay.innerHTML =
    '<div class="rel-card">' +
      '<div class="rel-card-header">' +
        (node.avatar ? '<img class="rel-card-avatar" src="' + esc(node.avatar) + '" onerror="this.style.display=\'none\'">' : '<div class="rel-card-avatar rel-avatar-fallback">' + esc((node.name||'?')[0]) + '</div>') +
        '<div class="rel-card-name">' + esc(node.name) + '</div>' +
        (node.relType ? '<div class="rel-card-relation">' + esc(node.relType) + '</div>' : '') +
      '</div>' +
      '<div class="rel-card-body">' +
        '<div class="rel-card-desc" id="rel-card-desc">加载中...</div>' +
        '<div class="rel-card-affinity"><span class="rel-card-affinity-label">亲密度</span><div class="rel-card-affinity-bar"><div class="rel-card-affinity-fill" style="width:50%"></div></div><span class="rel-card-affinity-val">50</span></div>' +
      '</div>' +
      '<div class="rel-card-actions">' +
        '<button class="rel-card-btn rel-card-btn-ghost" id="rel-card-close">关闭</button>' +
        '<button class="rel-card-btn rel-card-btn-primary" id="rel-card-edit">编辑</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('show'); });

  // 加载描述
  if (node.type !== 'center') {
    var targetId = node.id.replace('char_', '');
    db.characters.get(parseInt(targetId)).then(function(c) {
      var desc = overlay.querySelector('#rel-card-desc');
      if (desc && c) desc.textContent = c.description ? c.description.slice(0, 100) + '...' : '暂无描述';
      else if (desc) desc.textContent = '暂无描述';
    }).catch(function() {});
  } else {
    var desc = overlay.querySelector('#rel-card-desc');
    if (desc) desc.textContent = '这是中心人物';
  }

  // 关闭
  overlay.onclick = function(e) { if (e.target === overlay) closeCard(overlay); };
  overlay.querySelector('#rel-card-close').onclick = function() { closeCard(overlay); };
}

function closeCard(overlay) {
  overlay.classList.remove('show');
  setTimeout(function() { overlay.remove(); }, 200);
}

// ===== 添加关系弹窗 =====
function showAddRelSheet(charId, page) {
  var old = document.getElementById('rel-add-overlay');
  if (old) old.remove();

  db.characters.toArray().then(function(allChars) {
    var others = allChars.filter(function(c) { return c.id !== charId; });
    var options = others.map(function(c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'rel-add-overlay';
    overlay.className = 'rel-sheet-overlay';
    overlay.innerHTML = '<div class="rel-sheet-backdrop"></div>';
    var sheet = document.createElement('div');
    sheet.className = 'rel-sheet';
    sheet.innerHTML =
      '<div class="rel-sheet-title">添加关系</div>' +
      '<select class="rel-sheet-input" id="rel-add-target"><option value="">选择目标角色</option>' + options + '</select>' +
      '<input class="rel-sheet-input" id="rel-add-type" placeholder="关系类型（如：闺蜜、同事、父亲）">' +
      '<textarea class="rel-sheet-textarea" id="rel-add-desc" placeholder="关系描述（选填）" rows="2"></textarea>' +
      '<button class="rel-sheet-btn" id="rel-add-confirm">确认添加</button>';

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { overlay.classList.add('show'); sheet.classList.add('show'); });

    function close() {
      overlay.classList.remove('show');
      sheet.classList.remove('show');
      setTimeout(function() { overlay.remove(); sheet.remove(); }, 200);
    }
    overlay.querySelector('.rel-sheet-backdrop').onclick = close;

    sheet.querySelector('#rel-add-confirm').onclick = async function() {
      var targetId = parseInt(sheet.querySelector('#rel-add-target').value);
      var type = sheet.querySelector('#rel-add-type').value.trim();
      var desc = sheet.querySelector('#rel-add-desc').value.trim();
      if (!targetId || !type) { relToast('请选择目标并填写关系类型'); return; }

      var target = allChars.find(function(c) { return c.id === targetId; });
      await relSave({ charId: charId, targetId: targetId, targetName: target ? target.name : '', targetAvatar: target ? target.avatar || '' : '', type: type, desc: desc, affinity: 50, source: 'manual', createdAt: Date.now(), updatedAt: Date.now() });
      close();
      relToast('关系已添加');
      renderGraphPage(page, charId);
    };
  });
}

// ===== AI生成关系 =====
async function aiGenerateRels(charId, page) {
  if (!window.callAI) { relToast('AI服务未配置'); return; }
  relToast('AI生成中...');

  try {
    var char = await db.characters.get(charId);
    if (!char) { relToast('角色不存在'); return; }

    var prompt = '你是关系网络分析器。根据以下角色人设，提取所有提到的人物和他们与角色的关系。\n\n' +
      '角色名：' + char.name + '\n' +
      '人设：\n' + (char.description || '暂无') + '\n\n' +
      '要求：\n' +
      '1. 提取人设中明确提到的所有人物（朋友、家人、同事等）\n' +
      '2. 每个人物要有名字、关系类型、简短描述\n' +
      '3. 如果人设中没有提到其他人，返回空数组\n\n' +
      '返回JSON：\n' +
      '{"relations":[{"name":"人名","type":"关系类型","desc":"简短描述"}]}';

    var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', charAntiDrift: true });
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    if (!data.relations || !data.relations.length) { relToast('人设中未找到相关人物'); return; }

    var count = 0;
    for (var i = 0; i < data.relations.length; i++) {
      var r = data.relations[i];
      if (!r.name) continue;
      await relSave({ charId: charId, targetId: 'npc_' + Date.now() + '_' + i, targetName: r.name, targetAvatar: '', type: r.type || '认识', desc: r.desc || '', affinity: 50, source: 'ai', createdAt: Date.now(), updatedAt: Date.now() });
      count++;
    }
    relToast('已生成 ' + count + ' 条关系');
    renderGraphPage(page, charId);
  } catch(e) {
    console.error('[Relationship] AI generate error:', e);
    relToast('AI生成失败: ' + e.message);
  }
}

// ===== 辅助函数 =====
function drawFallback(ctx, node, size) {
  var grad = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, size);
  grad.addColorStop(0, '#e8e8e8');
  grad.addColorStop(1, '#ccc');
  ctx.fillStyle = grad;
  ctx.fillRect(node.x - size, node.y - size, size * 2, size * 2);
}

function esc(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ===== 自动刷新（客户端2天检测） =====
(function relAutoRefresh() {
  try {
    var last = localStorage.getItem('rel_last_gen_time');
    var now = Date.now();
    if (!last || (now - parseInt(last)) > 2 * 24 * 60 * 60 * 1000) {
      if (window.db && window.db.characters) {
        db.characters.where('type').equals('char').toArray().then(function(chars) {
          if (!chars.length) return;
          console.log('[Relationship] Auto-refresh triggered');
          localStorage.setItem('rel_last_gen_time', String(now));
        }).catch(function() {});
      }
    }
  } catch(e) {}
})();

console.log('[Relationship] Module loaded');
