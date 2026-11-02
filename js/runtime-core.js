/* Shared identity, durable task and social generation rules. */
(function () {
  'use strict';
  var pending = new Map();
  function sid(v) { return v == null ? '' : String(v); }
  function now() { return window.TimeWorld ? TimeWorld.getNow() : Date.now(); }
  async function ready() { if (window.waitForDB) await window.waitForDB(); if (!window.db) throw new Error('数据库尚未就绪，请稍后重试'); return window.db; }
  async function config(key, fallback) { await ready(); var row = await db.config.get(key); return row ? row.value : fallback; }
  async function put(key, value) { await ready(); await db.config.put({ key: key, value: value }); return value; }
  function withLock(key, fn) {
    if (pending.has(key)) return pending.get(key);
    var work = function () { return Promise.resolve().then(fn); };
    var task = (navigator.locks ? navigator.locks.request('wanwan:' + key, work) : work());
    pending.set(key, task);
    task.finally(function () { if (pending.get(key) === task) pending.delete(key); }).catch(function () {});
    return task;
  }
  var queues=new Map();
  function serialize(key,fn){
    if(navigator.locks)return navigator.locks.request('wanwan:'+key,function(){return fn()});
    var task=(queues.get(key)||Promise.resolve()).catch(function(){}).then(fn);queues.set(key,task);
    task.finally(function(){if(queues.get(key)===task)queues.delete(key)}).catch(function(){});return task;
  }
  async function currentUser(hint) {
    await ready();
    var users = await db.characters.where('type').equals('user').toArray();
    var id = hint && (hint.id || hint.charId) || window._wechatUid;
    var user = users.find(function (u) { return sid(u.id) === sid(id); });
    if (!user && hint && (hint.phone || hint.identity && hint.identity.phone)) {
      var phone = hint.phone || hint.identity.phone;
      user = users.find(function (u) { return u.identity && u.identity.phone === phone; });
    }
    if (!user && users.length === 1) user = users[0];
    if (!user) throw new Error('请先选择当前账号');
    return user;
  }
  async function resolvePerson(raw, allowUser) {
    await ready(); raw = raw || {};
    var all = await db.characters.toArray();
    var id = raw.charId || raw.authorId || raw.uid || raw.id;
    var name = String(raw.from || raw.authorName || raw.name || '').trim();
    var normalizedId = sid(id).replace(/^char_/, '');
    var byId = all.find(function (c) { return sid(c.id) === normalizedId; });
    var matches = all.filter(function (c) { return name && [c.name, c.nick, c.wechatName].some(function (n) { return n && String(n).trim() === name; }); });
    if(byId&&name&&matches.length===1&&sid(matches[0].id)!==sid(byId.id))return null;
    var c = byId || (matches.length === 1 ? matches[0] : null);
    // Never turn an ambiguous archive identity, or the user, into a fake NPC.
    if (c && c.type === 'user' && !allowUser || !c && matches.length) return null;
    if (c) return { id: sid(c.id), name: c.nick || c.name, avatar: c.avatar || '', type: c.type, char: c, isNpc: false };
    var npcs = db.npcCharacters ? await db.npcCharacters.toArray() : [];
    var npc = npcs.find(function (n) { return name && n.name === name; });
    return { id: npc ? 'npc_' + npc.id : 'npc_' + (name || '路人'), name: name || '路人', avatar: npc && npc.avatar || '', type: 'npc', isNpc: true };
  }
  async function comments(raw, author, postId, slot) {
    var rows = [], byName = new Map();
    for (var i = 0; i < (raw || []).length; i++) {
      var item = raw[i]; if (!item) continue;
      var name = item.from || item.name || (item.isAuthorReply ? author.name : '');
      var person = await resolvePerson({ charId: item.isAuthorReply ? author.id : item.charId, name: name }, false);
      if (!person || !String(item.text || item.content || '').trim()) continue;
      var parent = item.to ? byName.get(item.to) : rows[Number(item.replyToIndex)];
      var row = { id: postId + '_c_' + i, postId: postId, authorId: person.id, authorName: person.name, authorAvatar: person.avatar || null,
        authorHandle: '@' + person.name, isNpc: person.isNpc, content: String(item.text || item.content), stats: { likes: 0 },
        createdAt: new Date(slot + i * 1000).toISOString(), realCreatedAt: Date.now(), isReply: !!parent,
        replyTo: parent && parent.id || null, replyToName: parent && parent.authorName || '' };
      rows.push(row); byName.set(name, row);
    }
    return rows;
  }
  async function generate(char, slot, preference, ownerUid) {
    await ready();
    var user = await currentUser(ownerUid ? { id: ownerUid } : null);
    var fresh = await db.characters.get(char.id);
    if (!fresh || fresh.type === 'user') throw new Error('发帖角色不存在');
    char = fresh;
    var history = [];
    if (db.xPosts) history = await db.xPosts.orderBy('createdAt').reverse().filter(function (p) { return sid(p.realAuthorId || p.authorId) === sid(char.id); }).limit(12).toArray();
    var pastMoments=await db.moments.where('charId').equals(char.id).reverse().filter(function(p){return sid(p.ownerUid)===sid(user.id)&&p.createdAt<=slot}).limit(8).toArray();
    history=history.concat(pastMoments);
    var memories = window.WanWanMemory ? await WanWanMemory.getMemoryContext(null, char.id, user.id,
      [{ content: '该时段的生活、近况和偏好' }], { atTime: slot, readOnly: true }) : '';
    var pool = (await db.characters.toArray()).map(function (p) { return { id: p.id, name: p.nick || p.name, type: p.type }; });
    var time = window.TimeWorld ? TimeWorld.getFormattedNow(slot) : new Date(slot).toLocaleString('zh-CN');
    var prompt = '只扮演指定发帖角色，生成其在计划时刻会发的一条社交帖子与自然评论互动，熟人与路人可共同参与，生成约5条评论及适量作者回复。\n' +
      '角色ID：' + char.id + '\n完整人设：' + JSON.stringify({id:char.id,name:char.name,nick:char.nick,description:char.description,personality:char.personality,scenario:char.scenario,birthday:char.birthday,relations:char.relations}) + '\n计划时刻：' + time + '\n' +
      '当时已知记忆（不得使用此后事件）：\n' + memories + '\n' +
      '近期帖子，请避免重复话题与句式：\n' + history.filter(function (p) { return new Date(p.createdAt).getTime() <= slot; }).map(function (p) { return String(p.content||'').slice(0,1000); }).join('\n') + '\n' +
      '发帖内容可写日常见闻、饮食、兴趣、路边的猫、心情，或与用户相关的真实经历；不要求每条涉及用户。' +
      '记忆是生活背景，不是必须复述的题目：一直上学也不要每条发上学。符合时段、作息、年龄、人设与既有事实。' +
      '可创作普通生活小片段，不得捏造和用户见面、关系变化等重要经历。不要替用户写评论。' +
      '熟人使用下列真实ID与名字，真正路人才使用NPC；不得为已有角色另造身份。\n人物池：' + JSON.stringify(pool) + '\n' +
      '风格：' + (preference || '自然生活化') + '\n返回JSON：{"speakerId":' + JSON.stringify(char.id) + ',"content":"帖子正文","tags":[],"comments":[{"charId":角色ID或null,"from":"名字","text":"评论","to":null}]}';
    for (var attempt = 0; attempt < 2; attempt++) {
      var raw = await window.callAI([{ role: 'user', content: prompt }], { responseFormat: 'json_object', charId: char.id, shiliOwnerUid: user.id, shiliAtTime: slot, shiliAllowBackground: true, noTimeDiary: true });
      var data = typeof raw === 'string' ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()) : raw;
      if (data && sid(data.speakerId) === sid(char.id) && String(data.content || '').trim()) return data;
      prompt += '\n上次发帖身份或正文无效，请严格返回指定speakerId和非空正文。';
    }
    throw new Error('生成内容的发帖身份不匹配，任务保留待重试');
  }
  async function migrateSingleAccount(){
    await ready();var users=await db.characters.where('type').equals('user').toArray();if(users.length!==1)return;
    var uid=users[0].id;
    var rows=await db.config.toArray();
    for(var r of rows){var m=/^memoryPanel_(\d+)$/.exec(r.key);if(m){var k='memoryPanel_'+uid+'_'+m[1];if(!await db.config.get(k))await db.config.put({key:k,value:r.value})}}
    if(db.xingeLetters)await db.xingeLetters.filter(function(x){return x.ownerUid==null}).modify({ownerUid:uid});
    for(var i=0;i<localStorage.length;i++){var key=localStorage.key(i);var m=/^memoryEventLog_(\d+)$/.exec(key);if(m){var k='memoryEventLog_'+uid+'_'+m[1];if(localStorage.getItem(k)==null)localStorage.setItem(k,localStorage.getItem(key));}}
  }
  document.addEventListener('DOMContentLoaded',function(){migrateSingleAccount().catch(function(e){console.warn('[Data] 旧归属数据保留',e)})});
  window.WanWanRuntime = { ready: ready, config: config, put: put, withLock: withLock, serialize: serialize, now: now, sameId: function (a,b) { return sid(a) === sid(b); } };
  window.WanWanIdentity = { currentUser: currentUser, resolve: resolvePerson };
  window.WanWanSocial = { generate: generate, comments: comments };
})();
