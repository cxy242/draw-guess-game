/* Account-scoped supplemental backup. Host chats must be restored separately first. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShiliPortable=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
var TABLES=['gifts','giftEvents','giftGenerationJobs','shiliAnniversaries'];
function fail(s){throw Error(s);}
function eventKey(g){return JSON.stringify([String(g.ownerUid),String(g.sourceType),String(g.sourceId),String(g.charId),Number.isInteger(g.eventIndex)?g.eventIndex:0]);}
function ownedSetting(row,owner){return row&&((row.key==='shili-auto:'+String(owner))||(row.key==='shili-scan:'+String(owner))||((row.key.startsWith('shili-last-open:')||row.key.startsWith('shili-request:')||row.key.startsWith('shili-scan-failure:'))&&String(row.value?.ownerUid)===String(owner)));}
function validate(data,ownerUid){
 if(!ownerUid||!data||data.format!=='shili-owner-backup'||data.version!==1||String(data.ownerUid)!==String(ownerUid)||!data.tables)fail('备份格式或账号不匹配');
 if(data.settings!=null&&(!Array.isArray(data.settings)||data.settings.some(function(r){return !ownedSetting(r,ownerUid);})))fail('备份设置包含不属于当前账号的数据');
 for(var name of TABLES){
  var rows=data.tables[name];if(!Array.isArray(rows))fail('缺少备份表 '+name);
  var seen=new Set();for(var row of rows){if(!row||String(row.ownerUid)!==String(ownerUid))fail('跨账号数据被拒绝');var id=name==='giftEvents'?row.eventKey:row.id;if(id==null||seen.has(id))fail('缺少或重复主键 '+name);seen.add(id);}
 }
 var gifts=new Map(data.tables.gifts.map(function(g){return[g.id,g]})),keys=new Set();
 for(var g of gifts.values()){
  if(!g.charId||!g.sourceType||g.sourceId==null||g.eventKey!==eventKey(g)||keys.has(g.eventKey))fail('礼物事件键无效');keys.add(g.eventKey);
  if(!['draft','pending-review','received','sent','rejected','cancelled'].includes(g.status))fail('礼物状态无效');
  if(g.imageUrl&&!/^(https?:|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(g.imageUrl))fail('图片必须使用持久化地址');
 }
 var events=new Map(data.tables.giftEvents.map(function(e){return[e.eventKey,e]}));
 for(var gift of gifts.values()){var event=events.get(gift.eventKey);if(!event||event.giftId!==gift.id)fail('缺少礼物事件引用');}
 for(var e of events.values()){var ref=gifts.get(e.giftId);if(!ref||ref.eventKey!==e.eventKey||String(e.charId)!==String(ref.charId))fail('事件引用不一致');}
 for(var j of data.tables.giftGenerationJobs){if(!gifts.has(j.giftId)||!['pending','running','failed','ready','completed','cancelled'].includes(j.status))fail('图片任务引用或状态无效');}
 for(var a of data.tables.shiliAnniversaries){if(!a.title||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!Number.isFinite(Date.parse(a.date+'T00:00:00Z'))||new Date(a.date+'T00:00:00Z').toISOString().slice(0,10)!==a.date)fail('纪念日日期或标题无效');}
 var anniversaries=new Set(data.tables.shiliAnniversaries.map(function(a){return a.id}));
 for(var gift of gifts.values())if(gift.anniversaryId!=null&&!anniversaries.has(gift.anniversaryId))fail('纪念日引用丢失');
 return true;
}
async function exportOwner(db,ownerUid){
 if(!ownerUid)fail('缺少账号');
 return db.transaction('r',TABLES.map(function(n){return db[n]}).concat(db.config?[db.config]:[]),async function(){
  var tables={};for(var name of TABLES)tables[name]=await db[name].where('ownerUid').equals(String(ownerUid)).toArray();
  var data={format:'shili-owner-backup',version:1,ownerUid:String(ownerUid),exportedAt:new Date().toISOString(),tables:tables,settings:db.config?(await db.config.toArray()).filter(function(r){return ownedSetting(r,ownerUid);}):[]};validate(data,ownerUid);return data;
 });
}
async function importOwner(db,ownerUid,data,opts){
 validate(data,ownerUid);if(!opts||opts.confirmed!==true)fail('恢复必须先获得用户明确确认');
 // Freeze caller data before asynchronous work; never accept caller-supplied primary keys.
 data=JSON.parse(JSON.stringify(data));
 var tables=TABLES.map(function(n){if(!db||!db[n])fail('缺少数据表 '+n);return db[n]});
 if(db.messages)tables.push(db.messages);if(db.chats)tables.push(db.chats);if(db.config)tables.push(db.config);
 return db.transaction('rw',tables,async function(){
  var ids=new Map(),annIds=new Map(),added=0,skipped=0;
  var annKey=function(a){return JSON.stringify([a.title,a.date,a.timeMode,String(a.charId||''),!!a.recurring,a.enabled!==false,a.eventType||'custom',a.countMode||'countdown',a.includeStartDay===true,a.birthdayOf||'user',a.aiNote||'',a.timeZone||'']);};
  var existingAnn=new Map((await db.shiliAnniversaries.where('ownerUid').equals(String(ownerUid)).toArray()).map(function(a){return [annKey(a),a.id]}));
  var eventsByKey=new Map(data.tables.giftEvents.map(function(e){return [e.eventKey,e]}));
  var jobsByGift=new Map();for(var job of data.tables.giftGenerationJobs){if(!jobsByGift.has(job.giftId))jobsByGift.set(job.giftId,[]);jobsByGift.get(job.giftId).push(job);}
  for(var a of data.tables.shiliAnniversaries){var copy=Object.assign({},a);delete copy.id;var k=annKey(a),id=existingAnn.get(k);if(id==null){id=await db.shiliAnniversaries.add(copy);existingAnn.set(k,id);}annIds.set(a.id,id);}
  for(var g of data.tables.gifts){
   var old=await db.gifts.where('eventKey').equals(g.eventKey).first();
   if(old){if(old.ownerUid!==String(ownerUid))fail('事件归属冲突');var ev=await db.giftEvents.get(old.eventKey);if(!ev||ev.giftId!==old.id)fail('目标事件引用损坏');ids.set(g.id,old.id);skipped++;continue;}
   if(g.wechatMessageId!=null){
    var msg=db.messages&&await db.messages.get(g.wechatMessageId),chat=msg&&db.chats&&await db.chats.get(msg.chatId);
    // A same-number message from another database is not proof of identity.
    if(!chat||String(chat.ownerUid)!==String(ownerUid)||String(chat.charId)!==String(g.charId)||!g.wechatClientMessageId||msg.clientMessageId!==g.wechatClientMessageId)fail('请先恢复并核实关联微信消息');
   }
   var copy=Object.assign({},g);delete copy.id;delete copy.memoryLoggedAt;delete copy.generatorJobId;
   if(copy.anniversaryId!=null)copy.anniversaryId=annIds.get(copy.anniversaryId);
   if(copy.imageStatus==='running'||copy.imageStatus==='queued')copy.imageStatus='failed';
   var id=await db.gifts.add(copy);ids.set(g.id,id);added++;
   var ev=Object.assign({},eventsByKey.get(g.eventKey),{giftId:id});await db.giftEvents.add(ev);
   for(var j of (jobsByGift.get(g.id)||[])){
    var job=Object.assign({},j,{giftId:id});delete job.id;
    if(job.status==='running'||job.status==='pending'){job.status='failed';job.error='恢复后请手动重试，避免重复计费';}
    var jobId=await db.giftGenerationJobs.add(job);if(g.generatorJobId===j.id)await db.gifts.update(id,{generatorJobId:jobId});
   }
  }
  if(db.messages&&db.chats){for(var original of data.tables.gifts){var mapped=ids.get(original.id);if(mapped===original.id||original.wechatMessageId==null)continue;var msg=await db.messages.get(original.wechatMessageId),chat=msg&&await db.chats.get(msg.chatId);if(!msg||!chat||String(chat.ownerUid)!==String(ownerUid)||String(chat.charId)!==String(original.charId)||msg.clientMessageId!==original.wechatClientMessageId||!String(msg.content||'').startsWith('__GIFT__'))continue;var payload;try{payload=JSON.parse(msg.content.slice(8));}catch(e){continue;}if(String(payload.giftId)===String(original.id)){payload.giftId=mapped;await db.messages.update(msg.id,{content:'__GIFT__'+JSON.stringify(payload)});}}}
  if(db.config){for(var setting of data.settings||[]){if(setting.key==='shili-scan:'+String(ownerUid)||setting.key.startsWith('shili-scan-failure:'))continue;if(await db.config.get(setting.key))continue;var value=JSON.parse(JSON.stringify(setting.value));if(value.giftId!=null)value.giftId=ids.get(value.giftId);if(Array.isArray(value.giftIds))value.giftIds=value.giftIds.map(function(id){return ids.get(id);}).filter(function(id){return id!=null;});if(value.status==='running'){value.status='failed';value.error='恢复后请手动继续，避免重复计费';}await db.config.put({key:setting.key,value:value});}await db.config.delete('shili-scan:'+String(ownerUid));}
  return {added:added,skipped:skipped,idMap:Object.fromEntries(ids),anniversaryIdMap:Object.fromEntries(annIds)};
 });
}
return {exportOwner:exportOwner,validate:validate,importOwner:importOwner};});
