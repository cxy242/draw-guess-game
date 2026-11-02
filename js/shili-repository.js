/* 拾礼 v7：Dexie repository, browser script; relies on existing window.db */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShiliRepository=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
function requireDb(db){if(!db||!db.gifts||!db.giftEvents||!db.giftGenerationJobs||typeof db.transaction!=='function')throw Error('拾礼数据库未迁移到 v20');return db;}
function valid(x){if(!x||!x.ownerUid||!x.charId||!x.sourceType||x.sourceId===undefined||x.sourceId===null||x.sourceId==='')throw Error('ownerUid/charId/sourceType/sourceId required');return x;}
function key(x){valid(x);return JSON.stringify([String(x.ownerUid),String(x.sourceType),String(x.sourceId),String(x.charId),Number.isInteger(x.eventIndex)?x.eventIndex:0]);}
function record(x){valid(x);var now=Date.now();return {ownerUid:String(x.ownerUid),charId:String(x.charId),recipientUid:String(x.recipientUid||x.ownerUid),sourceType:String(x.sourceType),sourceId:String(x.sourceId),eventIndex:Number.isInteger(x.eventIndex)?x.eventIndex:0,eventKey:key(x),name:String(x.name||'未命名礼物'),description:String(x.description||''),message:String(x.message||''),status:'pending-review',imageStatus:'not-requested',realTimestamp:Number.isFinite(x.realTimestamp)?x.realTimestamp:now,virtualTimestamp:x.virtualTimestamp==null?null:x.virtualTimestamp,worldId:x.worldId==null?null:String(x.worldId),timeMode:x.timeMode==='virtual'?'virtual':'real',visibility:'private',createdAt:now,updatedAt:now};}
async function saveCandidate(db,input){requireDb(db);var item=record(input);return db.transaction('rw',db.gifts,db.giftEvents,async function(){var prior=await db.giftEvents.get(item.eventKey);if(prior){var old=await db.gifts.get(prior.giftId);if(!old)throw Error('giftEvents points to missing gift');return {gift:old,created:false};}var id=await db.gifts.add(item);await db.giftEvents.add({eventKey:item.eventKey,giftId:id,ownerUid:item.ownerUid,charId:item.charId,sourceType:item.sourceType,sourceId:item.sourceId,createdAt:item.createdAt});return {gift:Object.assign({},item,{id:id}),created:true};});}
async function confirm(db,ownerUid,giftId){requireDb(db);return db.transaction('rw',db.gifts,async function(){var g=await db.gifts.get(giftId);if(!g||g.ownerUid!==String(ownerUid))throw Error('礼物不存在或无权访问');if(g.status==='pending-review'){await db.gifts.update(giftId,{status:'received',updatedAt:Date.now()});g.status='received';}return g;});}
async function list(db,ownerUid,charId){requireDb(db);if(!ownerUid)throw Error('ownerUid required');var items=await db.gifts.where('ownerUid').equals(String(ownerUid)).toArray();return items.filter(function(g){return charId==null||g.charId===String(charId);});}
async function queueImage(db,ownerUid,giftId){requireDb(db);return db.transaction('rw',db.gifts,db.giftGenerationJobs,async function(){var g=await db.gifts.get(giftId);if(!g||g.ownerUid!==String(ownerUid)||!['received','draft','sent'].includes(g.status))throw Error('礼物未确认或无权访问');if(g.imageStatus==='ready'&&g.imageUrl)return {job:null,created:false};var existing=await db.giftGenerationJobs.where('giftId').equals(giftId).toArray();var active=existing.find(function(j){return j.status==='pending'||j.status==='running';});if(active)return {job:active,created:false};var job={giftId:giftId,ownerUid:g.ownerUid,status:'pending',attempts:0,createdAt:Date.now(),updatedAt:Date.now()};var id=await db.giftGenerationJobs.add(job);await db.gifts.update(giftId,{imageStatus:'queued',updatedAt:Date.now()});return {job:Object.assign({id:id},job),created:true};});}
async function memoryContext(db,ownerUid,charId,limit,options){
 requireDb(db);if(!ownerUid||!charId)return '';
 options=options||{};var realNow=Number.isFinite(options.realNow)?options.realNow:Date.now(),virtualNow=Number.isFinite(options.virtualNow)?options.virtualNow:(typeof window!=='undefined'&&window.TimeWorld?.getNow?.())||realNow;
 var all=await list(db,ownerUid,charId);var confirmed=all.filter(function(g){var virtual=Number.isFinite(g.virtualTimestamp)&&g.timeMode==='virtual';return (g.status==='received'||g.status==='sent')&&!g.characterDeleted&&(virtual?g.virtualTimestamp<=virtualNow:options.allowReal!==false&&g.realTimestamp<=realNow);});
 confirmed.sort(function(a,b){return (b.realTimestamp||0)-(a.realTimestamp||0)});
 return confirmed.slice(0,Math.max(1,Math.min(30,limit||12))).map(function(g){
 var virtual=Number.isFinite(g.virtualTimestamp)&&g.timeMode==='virtual',t=virtual?g.virtualTimestamp:g.realTimestamp;var day=Number.isFinite(t)?new Date(t).toLocaleDateString('zh-CN',options.timeZone?{timeZone:options.timeZone}:undefined):'';
 return (g.status==='sent'?'【用户已送给我】':'【我已送给用户】')+(virtual?'剧情时间 ':'现实时间 ')+day+' '+g.name+'（礼物ID '+g.id+'）'+(g.description?'：'+g.description.slice(0,150):'');
 }).join('\n');
}
async function confirmAndRemember(db,ownerUid,giftId,memory){
 var g=await confirm(db,ownerUid,giftId);
 if(['received','sent'].includes(g.status) && !g.memoryLoggedAt && memory && typeof memory.logStructuredEvent==='function'){
   // Persistent gift row remains the source of truth; memory is a recoverable index.
   var logged=await memory.logStructuredEvent(g.charId,{giftId:g.id,eventKey:g.eventKey,timestamp:g.timeMode==='virtual'&&g.virtualTimestamp!=null?g.virtualTimestamp:g.realTimestamp,event:(g.status==='sent'?'用户曾送给我「':'我曾送给用户「')+g.name+'」（拾礼编号 '+g.id+'）',source:'shili'},ownerUid);
   if(logged!==false)await db.gifts.update(giftId,{memoryLoggedAt:Date.now()});
 }
 return g;
}
async function createGift(db,input){
 requireDb(db);if(!input||!input.ownerUid||!input.charId||!input.name)throw Error('账号、赠送角色和礼物名称不能为空');
 var sourceId=input.sourceId||('manual-'+Date.now()+'-'+Math.random().toString(36).slice(2));
 return db.transaction('rw',db.gifts,db.giftEvents,async function(){
  var saved=await saveCandidate(db,Object.assign({},input,{sourceType:input.sourceType||'shili-manual',sourceId:sourceId}));
  if(input.draft===true&&saved.created){await db.gifts.update(saved.gift.id,{status:'draft',recipientUid:String(input.recipientUid||input.charId),deliveryStatus:'draft'});saved.gift=await db.gifts.get(saved.gift.id);}
  if(input.confirmed)saved.gift=await confirm(db,input.ownerUid,saved.gift.id);
  return saved;
 });
}
async function getGift(db,ownerUid,giftId){
 requireDb(db);if(!ownerUid)throw Error('ownerUid required');
 var gift=await db.gifts.get(giftId);return gift&&gift.ownerUid===String(ownerUid)?gift:null;
}

function cardName(value){return typeof value==='string'?Array.from(value.replace(/^(?:To|致)\s*[:：]\s*/i,'').replace(/[\u0000-\u001f\u007f]/g,' ').trim()).slice(0,32).join(''):'';}
function cardDirection(g){return g.sourceType==='shili-manual'&&(g.status==='draft'||g.status==='sent'||g.deliveryStatus==='sent')?'to-character':'to-user';}
function cardAddressKey(g){return 'shili-card-address:'+JSON.stringify([String(g.ownerUid),String(g.charId),cardDirection(g)]);}
async function getCardRecipient(db,ownerUid,giftId,options){
 var g=await getGift(db,ownerUid,giftId);if(!g)throw Error('礼物不存在或无权访问');
 var name=cardName(g.cardToName);if(name)return {name:name,source:'gift',direction:cardDirection(g)};
 var saved=db.config&&await db.config.get(cardAddressKey(g));name=cardName(saved&&saved.value);
 if(name)return {name:name,source:'pair',direction:cardDirection(g)};
 var outbound=cardDirection(g)==='to-character',person=null,owner=null;
 if(db.characters){person=await db.characters.get(Number(g.charId)||g.charId);owner=await db.characters.get(Number(g.ownerUid)||g.ownerUid);if(!owner||owner.type!=='user')owner=null;}
 var speaker=outbound?owner:person,target=outbound?String(g.charId):String(g.ownerUid);
 var relation=speaker&&Array.isArray(speaker.relations)&&speaker.relations.find(function(r){return String(r.charId)===target;});
 if(typeof window!=='undefined'&&window.ShiliPersona){var resolved=await window.ShiliPersona.resolve(db,ownerUid,giftId,{force:!!(options&&options.forcePersona)});if(resolved&&resolved.name)return Object.assign({direction:cardDirection(g)},resolved);}
 return {name:'亲爱的你',source:'persona-unset',direction:cardDirection(g)};
}
async function setGiftFields(db,ownerUid,giftId,fields){
 if(typeof fields?.imageUrl==='string'&&fields.imageUrl.startsWith('blob:')){var response=await fetch(fields.imageUrl);if(!response.ok)throw Error('临时图片已失效，请重新选择');var blob=await response.blob();if(!/^image\/(?:png|jpeg|webp|gif)$/i.test(blob.type))throw Error('临时文件不是支持的图片');var durable=await new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(Error('图片保存失败'));};reader.readAsDataURL(blob);});fields=Object.assign({},fields,{imageUrl:durable});}
 requireDb(db);var allowed=['imageUrl','imageStatus','openedAt','message','description','wrapped','cardStyle','cardToName','scheduledAt'];if(fields.imageUrl&&!/^(https?:|data:image\/(?:png|jpeg|webp|gif);base64,|blob:)/i.test(fields.imageUrl))throw Error('不支持的图片地址');var patch={updatedAt:Date.now()};
 allowed.forEach(function(k){if(Object.prototype.hasOwnProperty.call(fields,k))patch[k]=fields[k];});if(Object.prototype.hasOwnProperty.call(patch,'cardToName')){if(typeof patch.cardToName!=='string')throw Error('贺卡称呼需为文字');patch.cardToName=cardName(patch.cardToName);}
 var tables=[db.gifts];if(Object.prototype.hasOwnProperty.call(patch,'cardToName')&&db.config)tables.push(db.config);return db.transaction('rw',tables,async function(){var g=await db.gifts.get(giftId);if(!g||g.ownerUid!==String(ownerUid))throw Error('礼物不存在或无权访问');if(Object.prototype.hasOwnProperty.call(patch,'cardToName')&&db.config){if(patch.cardToName)await db.config.put({key:cardAddressKey(g),value:patch.cardToName});else await db.config.delete(cardAddressKey(g));}if(Object.prototype.hasOwnProperty.call(patch,'openedAt')){if(g.status!=='received')throw Error('未确认礼物不能拆封');patch.openedAt=g.openedAt||Date.now();}await db.gifts.update(giftId,patch);return Object.assign({},g,patch);});
}
async function saveAnniversary(db,ownerUid,item){
 if(!db.shiliAnniversaries)throw Error('纪念日数据库未初始化');if(!ownerUid||!item||!String(item.title||'').trim()||!item.date)throw Error('缺少纪念日标题或日期');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date)||Number.isNaN(Date.parse(item.date+'T00:00:00Z'))||new Date(item.date+'T00:00:00Z').toISOString().slice(0,10)!==item.date)throw Error('日期无效');
 if(item.coverUrl&&!/^(https?:|data:image\/(?:png|jpeg|webp);base64,)/i.test(item.coverUrl))throw Error('纪念日封面地址无效');
 var charId=String(item.charId||'');if(charId){var actor=db.characters&&await db.characters.get(Number(charId)||charId);if(!actor||['user','online_friend'].includes(actor.type)||actor.deleted||actor.isDeleted)throw Error('请从角色档案选择有效的关联人物');}
 var now=Date.now(),row={coverUrl:item.coverUrl||'',ownerUid:String(ownerUid),title:String(item.title).trim().slice(0,100),date:String(item.date),timeMode:item.timeMode==='virtual'?'virtual':'real',charId:charId,recurring:item.recurring===true,enabled:true,characterDeleted:false,updatedAt:now};
 return db.transaction('rw',db.shiliAnniversaries,async function(){if(item.id!=null){var old=await db.shiliAnniversaries.get(item.id);if(!old||String(old.ownerUid)!==String(ownerUid))throw Error('纪念日不存在或无权修改');await db.shiliAnniversaries.update(old.id,row);return old.id;}return db.shiliAnniversaries.add(Object.assign({createdAt:now},row));});
}
async function listAnniversaries(db,ownerUid){if(!db.shiliAnniversaries||!ownerUid)throw Error('纪念日数据库未就绪');return db.shiliAnniversaries.where('ownerUid').equals(String(ownerUid)).toArray();}
async function deleteAnniversary(db,ownerUid,id){return db.transaction('rw',db.shiliAnniversaries,db.gifts,async function(){var x=await db.shiliAnniversaries.get(id);if(!x||x.ownerUid!==String(ownerUid))throw Error('纪念日不存在或无权访问');await db.gifts.where('ownerUid').equals(String(ownerUid)).and(function(g){return g.anniversaryId===id;}).modify({anniversaryId:null});return db.shiliAnniversaries.delete(id);});}
async function handleCharacterDeletion(db,ownerUid,charId,mode){
 requireDb(db);if(!ownerUid||!charId||!['preserve','delete'].includes(mode))throw Error('角色礼物处理参数无效');
 var tables=[db.gifts,db.giftEvents,db.giftGenerationJobs];if(db.shiliAnniversaries)tables.push(db.shiliAnniversaries);return db.transaction('rw',tables,async function(){
  var rows=await db.gifts.where('ownerUid').equals(String(ownerUid)).toArray();var affected=rows.filter(function(g){return String(g.charId)===String(charId)});
  for(var g of affected){
   if(mode==='preserve')await db.gifts.update(g.id,{characterDeleted:true,characterName:'已删除角色',visibility:'archived',updatedAt:Date.now()});
   else{
    await db.giftGenerationJobs.where('giftId').equals(g.id).delete();
    await db.giftEvents.delete(g.eventKey);await db.gifts.delete(g.id);
   }
  }
  if(db.shiliAnniversaries)await db.shiliAnniversaries.where('ownerUid').equals(String(ownerUid)).and(function(a){return String(a.charId)===String(charId);}).modify({enabled:false,characterDeleted:true});return affected.length;
 });
}
return {eventKey:key,makeRecord:record,saveCandidate:saveCandidate,confirm:confirm,confirmAndRemember:confirmAndRemember,memoryContext:memoryContext,list:list,getGift:getGift,queueImage:queueImage,createGift:createGift,setGiftFields:setGiftFields,getCardRecipient:getCardRecipient,saveAnniversary:saveAnniversary,listAnniversaries:listAnniversaries,deleteAnniversary:deleteAnniversary,handleCharacterDeletion:handleCharacterDeletion};
});
