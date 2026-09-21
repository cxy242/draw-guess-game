// relationship.js — 关系网模块 v6
// 照 ensemble.js 模式：第一行就是入口函数
// 依赖：db.js, force-graph.min.js

// ===== 入口函数（必须在最前面） =====
window.showRelationshipPage = async function() {
  window.toast && window.toast('关系网打开中...');
  try {
    var old = document.getElementById('rel-page');
    if (old) old.remove();

    var page = document.createElement('div');
    page.id = 'rel-page';
    page.className = 'full-page rel-page';
    page.style.zIndex = '400';
    page.innerHTML =
      '<div class="rel-header">' +
        '<button class="rel-header-back" id="rel-back"><i class="fa fa-angle-left"></i></button>' +
        '<span class="rel-header-title" id="rel-title">关系网</span>' +
        '<div class="rel-header-right"></div>' +
      '</div>' +
      '<div id="rel-body" style="flex:1;display:flex;flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch"></div>';

    var backBtn = page.querySelector('#rel-back');
    if (backBtn) backBtn.onclick = function() {
      if (window._relGraph) { try { window._relGraph._destructor && window._relGraph._destructor(); } catch(e) {} window._relGraph = null; }
      window.closePage && window.closePage('rel-page');
    };

    window.openPage(page);
    _relRenderSelect(page);
  } catch(e) {
    console.error('[Relationship] open error:', e);
    window.toast && window.toast('关系网打开失败: ' + e.message);
  }
};

// ===== 选择页 =====
async function _relRenderSelect(page) {
  var body = page.querySelector('#rel-body');
  if (!body) return;
  body.innerHTML = '<div style="text-align:center;padding:40px;color:#999"><i class="fa fa-spinner fa-spin"></i> 加载中...</div>';

  var chars = [];
  try { if (window.db) chars = await db.characters.where('type').equals('char').toArray(); } catch(e) {}

  if (!chars.length) {
    body.innerHTML = '<div style="text-align:center;padding:60px;color:#999"><div style="width:80px;height:80px;border-radius:50%;background:rgba(107,125,141,0.08);display:flex;align-items:center;justify-content:center;margin:0 auto 20px"><i class="fa fa-diagram-project" style="font-size:32px;opacity:0.4"></i></div><div style="font-size:18px;font-weight:600;color:#2d2b2e;margin-bottom:8px">还没有角色</div><div style="font-size:14px;color:#9aabab">请先在角色档案中创建角色</div></div>';
    return;
  }

  var html = '<div style="padding:12px">';
  chars.forEach(function(c) {
    var av = c.avatar
      ? '<img src="' + _relEsc(c.avatar) + '" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid rgba(107,125,141,0.12)">'
      : '<div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#6b7d8d">' + _relEsc((c.name||'?')[0]) + '</div>';
    html += '<div class="rel-char-item" data-id="' + c.id + '" style="display:flex;align-items:center;padding:14px 16px;margin-bottom:10px;background:#fff;border:1px solid rgba(107,125,141,0.12);border-radius:12px;box-shadow:0 1px 3px rgba(107,125,141,0.06);cursor:pointer">' +
      av +
      '<div style="flex:1;margin-left:14px;min-width:0"><div style="font-size:15px;font-weight:600;color:#2d2b2e;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + _relEsc(c.name) + '</div><div style="font-size:13px;color:#9aabab;margin-top:3px">点击查看关系网</div></div>' +
      '<i class="fa fa-angle-right" style="color:#9aabab;font-size:14px;opacity:0.5"></i></div>';
  });
  html += '</div>';
  body.innerHTML = html;

  body.querySelectorAll('.rel-char-item').forEach(function(item) {
    item.onclick = function() { _relRenderGraph(page, parseInt(item.dataset.id)); };
  });
}

// ===== 图谱页 =====
async function _relRenderGraph(page, charId) {
  var body = page.querySelector('#rel-body');
  if (!body) return;

  var char = null;
  try { if (window.db) char = await db.characters.get(charId); } catch(e) {}
  if (!char) { window.toast && window.toast('角色不存在'); return; }

  var title = page.querySelector('#rel-title');
  if (title) title.textContent = char.name + '的关系网';

  body.innerHTML = '<div id="rel-graph-wrap" style="flex:1;position:relative;overflow:hidden"></div>' +
    '<div style="position:absolute;bottom:24px;right:16px;display:flex;flex-direction:column;gap:10px;z-index:10">' +
      '<button id="rel-center-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(107,125,141,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#2d2b2e"><i class="fa fa-crosshairs"></i></button>' +
      '<button id="rel-add-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(107,125,141,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#2d2b2e"><i class="fa fa-plus"></i></button>' +
      '<button id="rel-ai-btn" style="width:44px;height:44px;border-radius:50%;border:none;background:rgba(255,255,255,0.85);backdrop-filter:blur(12px);box-shadow:0 2px 8px rgba(107,125,141,0.1);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:16px;color:#2d2b2e"><i class="fa fa-wand-magic-sparkles"></i></button>' +
    '</div>';

  var wrap = body.querySelector('#rel-graph-wrap');
  if (!wrap) return;

  // Load relationships
  var rels = [];
  try { if (window.db) rels = await db.relationships.where('charId').equals(charId).toArray(); } catch(e) {}

  // If no relationships, prompt AI generation
  if (!rels.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:60px 20px"><div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;margin:0 auto 20px;box-shadow:0 0 20px rgba(107,125,141,0.15)"><i class="fa fa-wand-magic-sparkles" style="font-size:28px;color:#6b7d8d"></i></div><div style="font-size:16px;font-weight:600;color:#2d2b2e;margin-bottom:8px">还没有关系数据</div><div style="font-size:14px;color:#9aabab;margin-bottom:20px;max-width:260px;margin-left:auto;margin-right:auto;line-height:1.6">点击下方AI按钮从人设中自动提取人物关系</div></div>';
  } else {
    _relDrawGraph(wrap, charId, rels, char);
  }

  // Tool buttons
  var centerBtn = body.querySelector('#rel-center-btn');
  if (centerBtn) centerBtn.onclick = function() { window._relGraph && window._relGraph.zoomToFit(400, 50); };

  var addBtn = body.querySelector('#rel-add-btn');
  if (addBtn) addBtn.onclick = function() { _relShowAddSheet(charId, page); };

  var aiBtn = body.querySelector('#rel-ai-btn');
  if (aiBtn) aiBtn.onclick = function() { _relAiGenerate(charId, page); };
}

// ===== 绘制图谱 =====
function _relDrawGraph(wrap, charId, rels, centerChar) {
  if (!window.ForceGraph) {
    wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#999">ForceGraph未加载</div>';
    return;
  }

  var allChars = [];
  db.characters.toArray().then(function(chars) {
    allChars = chars;
    var nodes = [{id: 'c' + charId, name: centerChar.name, avatar: centerChar.avatar, type: 'center'}];
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
        nodes.push({id: nid, name: nname, avatar: nav, type: 'related', relType: r.type});
      }
      links.push({source: 'c' + charId, target: nid, type: r.type});
    });

    var w = wrap.clientWidth || 300;
    var h = wrap.clientHeight || 400;

    window._relGraph = window.ForceGraph()(wrap)
      .graphData({nodes: nodes, links: links})
      .backgroundColor('#eceef1')
      .width(w).height(h)
      .nodeLabel(function() { return ''; })
      .nodeVal(function(n) { return n.type === 'center' ? 30 : 20; })
      .linkColor(function() { return 'rgba(107,125,141,0.3)'; })
      .linkWidth(function() { return 1.5; })
      .d3AlphaDecay(0.02)
      .d3VelocityDecay(0.3)
      .cooldownTime(3000)
      .onNodeClick(function(node) { _relShowDetail(node, charId); })
      .nodeCanvasObject(function(node, ctx, gs) {
        if (isNaN(node.x) || isNaN(node.y)) return;
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

        // Border
        ctx.beginPath();
        ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
        ctx.strokeStyle = node.type === 'center' ? 'rgba(107,125,141,0.6)' : 'rgba(0,0,0,0.08)';
        ctx.lineWidth = node.type === 'center' ? 2 : 1;
        ctx.stroke();

        // Name
        if (fs > 0) {
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.font = (node.type === 'center' ? 'bold ' : '') + fs + 'px -apple-system, sans-serif';
          ctx.fillStyle = '#2d2b2e';
          ctx.fillText(node.name || '?', node.x, node.y + size + 3);
        }
      });

    setTimeout(function() { window._relGraph && window._relGraph.zoomToFit(400, 50); }, 500);
  });
}

// ===== 详情卡片 =====
function _relShowDetail(node, charId) {
  var old = document.getElementById('rel-detail-overlay');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = 'rel-detail-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(45,43,46,0.3);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10001;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 250ms ease;padding:20px';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:20px;box-shadow:0 24px 60px rgba(107,125,141,0.12);max-width:340px;width:100%;overflow:hidden;transform:scale(0.88) translateY(20px);transition:transform 350ms cubic-bezier(0.34,1.56,0.64,1),opacity 250ms ease">' +
      '<div style="display:flex;flex-direction:column;align-items:center;padding:32px 24px 24px;background:linear-gradient(180deg,rgba(107,125,141,0.06) 0%,transparent 100%)">' +
        (node.avatar ? '<img src="' + _relEsc(node.avatar) + '" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 6px 20px rgba(107,125,141,0.15);margin-bottom:16px">' : '<div style="width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,rgba(107,125,141,0.08),rgba(107,125,141,0.18));display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#6b7d8d;margin-bottom:16px">' + _relEsc((node.name||'?')[0]) + '</div>') +
        '<div style="font-size:22px;font-weight:700;color:#2d2b2e;letter-spacing:-0.02em">' + _relEsc(node.name) + '</div>' +
        (node.relType ? '<div style="display:inline-flex;margin-top:8px;padding:5px 16px;border-radius:20px;background:#6b7d8d;color:#fff;font-size:13px;font-weight:500;box-shadow:0 2px 8px rgba(107,125,141,0.2)">' + _relEsc(node.relType) + '</div>' : '') +
      '</div>' +
      '<div style="padding:24px">' +
        '<div id="rel-detail-desc" style="font-size:14px;color:#5a6a7a;line-height:1.7;margin-bottom:16px">加载中...</div>' +
        '<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(107,125,141,0.08);border-radius:12px">' +
          '<span style="font-size:13px;color:#9aabab;width:52px;font-weight:500">亲密度</span>' +
          '<div style="flex:1;height:8px;border-radius:4px;background:rgba(107,125,141,0.1);overflow:hidden"><div style="height:100%;border-radius:4px;background:linear-gradient(90deg,#6b7d8d,#8fa0af,#b1bfca);width:50%;transition:width 800ms cubic-bezier(0.23,1,0.32,1)"></div></div>' +
          '<span style="font-size:14px;font-weight:700;color:#6b7d8d;min-width:32px;text-align:right">50</span>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:12px;padding:20px 24px 28px">' +
        '<button id="rel-detail-close" style="flex:1;height:46px;border-radius:12px;border:1px solid rgba(107,125,141,0.12);background:rgba(107,125,141,0.08);color:#6b7d8d;font-size:14px;font-weight:600;cursor:pointer">关闭</button>' +
        '<button id="rel-detail-edit" style="flex:1;height:46px;border-radius:12px;border:none;background:#6b7d8d;color:#fff;font-size:14px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(107,125,141,0.2)">编辑</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(function() {
    overlay.style.opacity = '1';
    var card = overlay.querySelector('div');
    if (card) { card.style.transform = 'scale(1) translateY(0)'; card.style.opacity = '1'; }
  });

  // Load description
  var descEl = overlay.querySelector('#rel-detail-desc');
  if (descEl) {
    var targetId = node.id.replace('c', '');
    if (node.type !== 'center') {
      db.characters.get(parseInt(targetId)).then(function(c) {
        if (c && c.description) descEl.textContent = c.description.slice(0, 150) + (c.description.length > 150 ? '...' : '');
        else descEl.textContent = '暂无描述';
      }).catch(function() { descEl.textContent = '暂无描述'; });
    } else {
      descEl.textContent = '这是中心人物';
    }
  }

  overlay.onclick = function(e) { if (e.target === overlay) _relCloseOverlay(overlay); };
  var closeBtn = overlay.querySelector('#rel-detail-close');
  if (closeBtn) closeBtn.onclick = function() { _relCloseOverlay(overlay); };
}

function _relCloseOverlay(el) {
  el.style.opacity = '0';
  var card = el.querySelector('div');
  if (card) { card.style.transform = 'scale(0.92) translateY(20px)'; card.style.opacity = '0'; }
  setTimeout(function() { el.remove(); }, 300);
}

// ===== 添加关系 =====
function _relShowAddSheet(charId, page) {
  db.characters.toArray().then(function(allChars) {
    var others = allChars.filter(function(c) { return c.id !== charId; });
    var options = others.map(function(c) { return '<option value="' + c.id + '">' + _relEsc(c.name) + '</option>'; }).join('');

    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(45,43,46,0.3);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:10001;opacity:0;transition:opacity 250ms ease';

    var sheet = document.createElement('div');
    sheet.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -4px 20px rgba(107,125,141,0.1);padding:24px;padding-bottom:calc(24px + env(safe-area-inset-bottom));z-index:10002;transform:translateY(100%);transition:transform 350ms cubic-bezier(0.32,0.72,0,1);max-height:80vh;overflow-y:auto';
    sheet.innerHTML =
      '<div style="width:36px;height:4px;border-radius:2px;background:#bcc8c8;margin:0 auto 20px"></div>' +
      '<div style="font-size:20px;font-weight:700;color:#2d2b2e;margin-bottom:24px;text-align:center;letter-spacing:-0.02em">添加关系</div>' +
      '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">目标角色</div>' +
      '<select id="rel-add-target" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;color:#2d2b2e;background:#eceef1;margin-bottom:14px;box-sizing:border-box;-webkit-appearance:none;font-family:inherit"><option value="">选择目标角色</option>' + options + '</select>' +
      '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系类型</div>' +
      '<input id="rel-add-type" placeholder="如：闺蜜、同事、父亲" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;color:#2d2b2e;background:#eceef1;margin-bottom:14px;box-sizing:border-box;-webkit-appearance:none;font-family:inherit">' +
      '<div style="font-size:12px;font-weight:600;color:#5a6a7a;margin-bottom:6px">关系描述（选填）</div>' +
      '<textarea id="rel-add-desc" placeholder="简短描述这段关系" rows="2" style="width:100%;padding:12px 16px;border:1px solid rgba(107,125,141,0.12);border-radius:12px;font-size:14px;color:#2d2b2e;background:#eceef1;margin-bottom:20px;box-sizing:border-box;resize:none;font-family:inherit;line-height:1.5"></textarea>' +
      '<button id="rel-add-confirm" style="width:100%;height:52px;border-radius:16px;border:none;background:#6b7d8d;color:#fff;font-size:16px;font-weight:600;cursor:pointer;box-shadow:0 4px 12px rgba(107,125,141,0.2)">确认添加</button>';

    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { overlay.style.opacity = '1'; sheet.style.transform = 'translateY(0)'; });

    function close() {
      overlay.style.opacity = '0';
      sheet.style.transform = 'translateY(100%)';
      setTimeout(function() { overlay.remove(); sheet.remove(); }, 350);
    }
    overlay.onclick = function(e) { if (e.target === overlay) close(); };

    sheet.querySelector('#rel-add-confirm').onclick = async function() {
      var targetId = parseInt(sheet.querySelector('#rel-add-target').value);
      var type = sheet.querySelector('#rel-add-type').value.trim();
      var desc = sheet.querySelector('#rel-add-desc').value.trim();
      if (!targetId || !type) { window.toast && window.toast('请选择目标并填写关系类型'); return; }
      var target = allChars.find(function(c) { return c.id === targetId; });
      try {
        await db.relationships.add({charId: charId, targetId: targetId, targetName: target ? target.name : '', targetAvatar: target ? target.avatar || '' : '', type: type, desc: desc, affinity: 50, source: 'manual', createdAt: Date.now(), updatedAt: Date.now()});
        close();
        window.toast && window.toast('关系已添加');
        _relRenderGraph(page, charId);
      } catch(e) { window.toast && window.toast('添加失败: ' + e.message); }
    };
  });
}

// ===== AI生成 =====
async function _relAiGenerate(charId, page) {
  if (!window.callAI) { window.toast && window.toast('AI服务未配置'); return; }
  window.toast && window.toast('AI生成中...');

  try {
    var char = null;
    if (window.db) char = await db.characters.get(charId);
    if (!char) { window.toast && window.toast('角色不存在'); return; }

    var prompt = '你是关系网络分析器。根据以下角色人设，提取所有提到的人物和他们与角色的关系。\n\n角色名：' + char.name + '\n人设：\n' + (char.description || '暂无') + '\n\n要求：\n1. 提取人设中明确提到的所有人物\n2. 每个人物要有名字、关系类型、简短描述\n3. 如果人设中没有提到其他人，返回空数组\n\n返回JSON：{"relations":[{"name":"人名","type":"关系类型","desc":"简短描述"}]}';

    var raw = await window.callAI([{role: 'user', content: prompt}], {responseFormat: 'json_object', charAntiDrift: true});
    var data = typeof raw === 'string' ? JSON.parse(raw.replace(/```json?\s*/g, '').replace(/```/g, '').trim()) : raw;

    if (!data || !data.relations || !data.relations.length) {
      window.toast && window.toast('人设中未找到相关人物');
      return;
    }

    var count = 0;
    for (var i = 0; i < data.relations.length; i++) {
      var r = data.relations[i];
      if (!r.name) continue;
      await db.relationships.add({charId: charId, targetId: 'npc_' + Date.now() + '_' + i, targetName: r.name, targetAvatar: '', type: r.type || '认识', desc: r.desc || '', affinity: 50, source: 'ai', createdAt: Date.now(), updatedAt: Date.now()});
      count++;
    }
    window.toast && window.toast('已生成 ' + count + ' 条关系');
    localStorage.setItem('rel_last_gen_time', String(Date.now()));
    _relRenderGraph(page, charId);
  } catch(e) {
    console.error('[Relationship] AI error:', e);
    window.toast && window.toast('AI生成失败: ' + e.message);
  }
}

// ===== 全局注入 =====
window.getRelationshipContext = async function(charId) {
  try {
    if (!window.db) return '';
    var rels = await db.relationships.where('charId').equals(charId).toArray();
    if (!rels.length) return '';
    var lines = rels.map(function(r) { return '- ' + (r.targetName || r.targetId) + '：' + (r.type || '认识') + (r.desc ? '（' + r.desc.slice(0, 30) + '）' : ''); });
    return '\n【你的人际关系】\n' + lines.join('\n');
  } catch(e) { return ''; }
};

window.getRelationBetween = async function(charId, targetNameOrId) {
  try {
    if (!window.db) return null;
    var rels = await db.relationships.where('charId').equals(charId).toArray();
    for (var i = 0; i < rels.length; i++) {
      if (rels[i].targetName === targetNameOrId || String(rels[i].targetId) === String(targetNameOrId)) return rels[i];
    }
    return null;
  } catch(e) { return null; }
};

// ===== 工具函数 =====
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

// ===== 自动刷新（客户端2天检测） =====
try {
  var _relLastGen = localStorage.getItem('rel_last_gen_time');
  if (!_relLastGen || (Date.now() - parseInt(_relLastGen)) > 2 * 24 * 60 * 60 * 1000) {
    console.log('[Relationship] Auto-refresh ready (2+ days since last)');
  }
} catch(e) {}

console.log('[Relationship] Module loaded');
