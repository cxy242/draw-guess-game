/* 拾礼 v9: 微信/剧情消息持久化桥接。只有已写入数据库的消息才会被扫描。 */
(function(root){'use strict';
function textOf(x){return String(x==null?'':x)}
function parse(row){return root.ShiliCore&&root.ShiliCore.parseMessage(textOf(row.content))}
async function ingest(db,source,row,id,ownerUid,charId){
 if(!root.ShiliRepository||!root.ShiliCore||!db||!ownerUid||!charId||!id||row.role==='user')return {action:'skip'};
 // Derive private ownership from the committed chat, never the active UI account.
 if(source==='wechat-group'){
  var groupRow=await db.groupMessages.get(id);if(!groupRow)return {action:'skip'};
  var group=await db.groupChats.get(groupRow.groupId);
  if(!group||String(group.ownerUid)!==String(ownerUid)||String(groupRow.senderId)!==String(charId))throw Error('群消息归属不匹配');
  row=groupRow;if(row.role==='user')return {action:'skip'};
 }
 if(source==='wechat-offline'){
  var offline=await db.offlineChats?.get(id);if(!offline)return {action:'skip'};
  if(String(offline.ownerUid)!==String(ownerUid)||(offline.mode==='ensemble'?!(offline.participantIds||[]).some(function(id){return String(id)===String(charId);}):String(offline.charId)!==String(charId)))throw Error('线下剧情归属不匹配');
  row=offline;if(row.role==='user')return {action:'skip'};
 }
 if(source==='wechat-private'){
  var persisted=await db.messages.get(id);if(!persisted)return {action:'skip'};
  var chat=await db.chats.get(persisted.chatId);
  if(!chat||String(chat.ownerUid)!==String(ownerUid)||String(chat.charId)!==String(charId))throw Error('消息归属不匹配');
  row=persisted;if(row.role==='user')return {action:'skip'};
 }
 var card=parse(row);
 if(card?.kind==='legacy-gift'&&card.data.giftId){var linked=await db.gifts.get(Number(card.data.giftId)||card.data.giftId);if(linked&&String(linked.ownerUid)===String(ownerUid)&&String(linked.charId)===String(charId)&&linked.wechatMessageId===id&&linked.wechatClientMessageId===row.clientMessageId)return {gift:linked,created:false};}
 var p=source==='wechat-offline'?root.ShiliCore.parseMessage('__NARRATIVE__'+textOf(row.content)):parse(row);if(!p)return {action:'skip'};if(p.kind==='text')p={kind:'narrative',text:p.text};
 var character=db.characters&&await db.characters.get(Number(charId)||charId);
 if(!character||character.deleted||character.isDeleted||['user','online_friend'].includes(character.type)||(character.ownerUid!=null&&String(character.ownerUid)!==String(ownerUid)))return {action:'skip'};
 var completedRows=p.kind==='narrative'?root.ShiliCore.completedGifts(p.text,[character?.name,character?.nick],{explicitOnly:row.mode==='ensemble'}):[];
 var completed=completedRows[0];
 var name='',description='',message='',type='';
 if(p.kind==='legacy-gift'){
   if(p.data.action&&p.data.action!=='send')return {action:'skip'};
   if(source==='wechat-group'&&String(p.data.recipientUid)!==String(ownerUid))return {action:'skip'};
   if(p.data.recipientUid!=null&&String(p.data.recipientUid)!==String(ownerUid))return {action:'skip'};
   name=textOf(p.data.itemName||'礼物');description=textOf(p.data.reason||'');message=description;type='legacy-gift';
 }else if(p.kind==='narrative'&&completedRows.length){
   name=completed?completed.name:'剧情中的礼物';description=p.text;type='narrative';
 }else{return {action:'skip'};}
 var virtual=Number.isFinite(row.virtualTimestamp)?row.virtualTimestamp:(Number.isFinite(row.realCreatedAt)&&Number.isFinite(row.createdAt)?row.createdAt:null);
 var entries=completedRows.length?completedRows:[{name:name,description:description,message:message}],results=[];
 for(var entryIndex=0;entryIndex<entries.length;entryIndex++){var entry=entries[entryIndex];
 var saved=await root.ShiliRepository.saveCandidate(db,{ownerUid:String(ownerUid),charId:String(charId),sourceType:source,sourceId:String(row.shiliGiftBatchId||id),sourceChatId:row.groupId??row.chatId,eventIndex:entryIndex,name:entry.name,description:entry.description,message:entry.message||message,virtualTimestamp:virtual,worldId:row.worldId||null,timeMode:row.timeMode||(virtual===null?'real':'virtual'),realTimestamp:Number.isFinite(row.realCreatedAt)?row.realCreatedAt:(Number.isFinite(row.createdAt)?row.createdAt:Date.now())});
 var wasPending=saved.gift.status==='pending-review';
 if((p.kind==='legacy-gift'&&String(p.data.recipientUid)===String(ownerUid))||completed){
  if(p.kind==='legacy-gift'&&wasPending&&saved.gift.name==='剧情中的礼物')await db.gifts.update(saved.gift.id,{name:name,description:description,message:message});
  saved.gift=await root.ShiliRepository.confirmAndRemember(db,ownerUid,saved.gift.id,root.WanWanMemory);
  if(wasPending&&root.ShiliIntegration)root.ShiliIntegration.scheduleGiftImage(db,ownerUid,saved.gift.id).catch(function(){});
 }
 if(saved.created||wasPending&&saved.gift.status==='received')root.ShiliIntegration?.announce?.(ownerUid,saved.gift.id);
 results.push(saved);
 }return Object.assign({},results[0],{createdCount:results.filter(function(x){return x.created;}).length,gifts:results.map(function(x){return x.gift;})});
}
// 失败不回滚已保存的聊天消息：提供显式补扫，处理恢复/导入/异常。
async function scanPrivate(db,ownerUid,limit,cursor){
 if(!ownerUid)throw Error('ownerUid required');
 var cap=Math.min(2000,Math.max(1,Number(limit)||2000));
 var chats=await db.chats.filter(function(c){return String(c.ownerUid)===String(ownerUid)}).toArray();
 chats.sort(function(a,b){return a.id-b.id});
 var result={scanned:0,created:0,errors:[],hasMore:false,cursor:null};
 for(var chat of chats){
  if(cursor&&chat.id<cursor.chatId)continue;
  var after=cursor&&chat.id===cursor.chatId?cursor.messageId:0;
  var rows=await db.messages.where('chatId').equals(chat.id).and(function(row){return row.id>after}).limit(cap-result.scanned+1).toArray();
  for(var row of rows){
   if(result.scanned>=cap){result.hasMore=true;return result;}
   result.scanned++;result.cursor={chatId:chat.id,messageId:row.id};
   try{var x=await ingest(db,'wechat-private',row,row.id,ownerUid,chat.charId);if(x.created)result.created++;}
   catch(e){result.errors.push({id:row.id,error:String(e.message||e)});}
  }
 }
 return result;
}
async function sendToCharacter(db,ownerUid,giftId){
 if(!ownerUid||!db.messages||!db.chats||!db.characters)throw Error('微信尚未准备好');
 var result=await db.transaction('rw',db.gifts,db.messages,db.chats,db.characters,async function(){
  var gift=await db.gifts.get(giftId);
  if(!gift||String(gift.ownerUid)!==String(ownerUid)||gift.sourceType!=='shili-manual')throw Error('无权发送这份礼物');
  if(gift.deliveryStatus==='sent')return {gift:gift,created:false};
  if(gift.status!=='draft')throw Error('请先保存礼物草稿');
  if(!gift.imageUrl||gift.imageStatus!=='ready')throw Error('请先生成礼物图片或从相册选择图片');
  var char=await db.characters.get(Number(gift.charId)||gift.charId);
  if(!char||char.deleted||char.isDeleted||(char.ownerUid!=null&&String(char.ownerUid)!==String(ownerUid))||char.type==='user'||char.type==='online_friend')throw Error('该角色当前不支持本地礼物卡片');
  var chats=await db.chats.filter(function(c){return String(c.ownerUid)===String(ownerUid)}).toArray();
  var chat=chats.find(function(c){return String(c.charId)===String(gift.charId)&&String(c.ownerUid)===String(ownerUid)});
  if(!chat)throw Error('请先在微信中建立与这位角色的会话');
  var clientId='shili-gift-'+ownerUid+'-'+gift.id;
  var old=await db.messages.where('clientMessageId').equals(clientId).first();
  if(old&&old.chatId!==chat.id)throw Error('礼物消息 ID 冲突');
  var now=Date.now(),virtual=root.TimeWorld&&root.TimeWorld.getNow?root.TimeWorld.getNow():now;
  var payload={giftId:gift.id,itemName:gift.name,reason:gift.message||gift.description,recipientUid:gift.charId};
  var msgId=old?old.id:await db.messages.add({chatId:chat.id,charId:char.id,role:'user',content:'__GIFT__'+JSON.stringify(payload),clientMessageId:clientId,createdAt:virtual,realCreatedAt:now,timeMode:root.TimeWorld?.isEnabled?.()?'virtual':'real'});
  await db.gifts.update(gift.id,{status:'sent',deliveryStatus:'sent',wechatMessageId:msgId,wechatClientMessageId:clientId,realTimestamp:now,virtualTimestamp:root.TimeWorld?.isEnabled?.()?virtual:null,timeMode:root.TimeWorld?.isEnabled?.()?'virtual':'real',updatedAt:now});
  return {gift:await db.gifts.get(gift.id),messageId:msgId,created:!old};
 });
 try{await root.ShiliRepository.confirmAndRemember(db,ownerUid,giftId,root.WanWanMemory);}catch(e){console.warn('[拾礼] 赠礼已送达，记忆索引可在下次读取时恢复',e.message||e);}
 root.ShiliIntegration?.announce?.(ownerUid,giftId);return result;
}
async function scanAll(db,ownerUid,limit,cursor){
 var cap=Math.min(2000,Math.max(1,Number(limit)||200)),result={scanned:0,created:0,errors:[],hasMore:false,cursor:cursor||{stage:'private',privateCursor:null,lastId:0}},state=Object.assign({},result.cursor);
 if(state.stage==='private'){var r=await scanPrivate(db,ownerUid,cap,state.privateCursor);result.scanned+=r.scanned;result.created+=r.created;result.errors.push(...r.errors);if(r.hasMore){result.hasMore=true;result.cursor={stage:'private',privateCursor:r.cursor,lastId:0};return result;}state={stage:'group',lastId:0};}
 var stages=['group','offline'];for(var stage of stages){if(state.stage!==stage)continue;if(result.scanned>=cap){result.hasMore=true;result.cursor=state;return result;}
  var table=stage==='group'?db.groupMessages:db.offlineChats,owned=new Set();if(stage==='group'&&db.groupChats)(await db.groupChats.filter(function(g){return String(g.ownerUid)===String(ownerUid);}).toArray()).forEach(function(g){owned.add(String(g.id));});
  if(table){var left=cap-result.scanned,rows=await table.where('id').above(Number(state.lastId)||0).filter(function(m){return stage==='group'?owned.has(String(m.groupId)):String(m.ownerUid)===String(ownerUid);}).limit(left+1).toArray();for(var row of rows.slice(0,left)){result.scanned++;state.lastId=row.id;try{var x=await ingest(db,stage==='group'?'wechat-group':'wechat-offline',row,row.id,ownerUid,stage==='group'?row.senderId:row.charId);if(x.created)result.created++;}catch(e){result.errors.push({source:stage,id:row.id,error:String(e.message||e)});}}if(rows.length>left){result.hasMore=true;result.cursor=state;return result;}}
  state={stage:stage==='group'?'offline':'done',lastId:0};
 }result.cursor=state;return result;
}
async function giftForMessage(db,ownerUid,source,id,charId){
 var table=source==='wechat-group'?db.groupMessages:source==='wechat-offline'?db.offlineChats:db.messages;var message=table&&await table.get(id);
 var card=message&&parse(message);if(card?.kind==='legacy-gift'&&card.data.giftId){var linked=await db.gifts.get(Number(card.data.giftId)||card.data.giftId);if(linked&&String(linked.ownerUid)===String(ownerUid)&&String(linked.charId)===String(charId)&&linked.wechatMessageId===id&&linked.wechatClientMessageId===message.clientMessageId)return linked;}
 var eventKey=root.ShiliRepository.eventKey({ownerUid,sourceType:source,sourceId:String(message?.shiliGiftBatchId||id),charId});
 var event=await db.giftEvents.get(eventKey);if(!event||String(event.ownerUid)!==String(ownerUid))return null;
 var gift=await db.gifts.get(event.giftId);return gift&&String(gift.ownerUid)===String(ownerUid)&&String(gift.charId)===String(charId)?gift:null;
}
var incrementalBusy=new Map();
function scanKey(owner){return 'shili-scan:'+String(owner);}
function failureKey(owner,source,id){return 'shili-scan-failure:'+JSON.stringify([String(owner),source,id]);}
async function scanProgress(db,owner){return (await db.config.get(scanKey(owner)))?.value||{private:0,group:0,offline:0,scanned:0,created:0,updatedAt:null};}
async function scanIncremental(db,owner,limit,options){
 owner=String(owner);options=options||{};var lock=db.name+':'+owner;if(incrementalBusy.has(lock))return incrementalBusy.get(lock);
 var work=(async function(){var state=await scanProgress(db,owner),result={scanned:0,created:0,errors:[],hasMore:false},cap=Math.min(500,Math.max(1,Number(limit)||100)),chats=new Map((await db.chats.filter(function(c){return String(c.ownerUid)===owner;}).toArray()).map(function(c){return [c.id,c];})),groups=new Map(db.groupChats?(await db.groupChats.filter(function(c){return String(c.ownerUid)===owner;}).toArray()).map(function(c){return [c.id,c];}):[]);
 function stillOwner(){if(root.getShiliOwnerUid&&String(root.getShiliOwnerUid())!==owner)throw Error('账号已切换，补扫已暂停，进度已保留');}
 async function process(source,row){
  var charId=source==='private'?chats.get(row.chatId)?.charId:source==='group'?row.senderId:row.charId;
  if(source==='private'&&!chats.has(row.chatId)||source==='group'&&!groups.has(row.groupId)||source==='offline'&&String(row.ownerUid)!==owner)return;
  if(!charId)return;
  var key=failureKey(owner,source,row.id);
  try{var actors=source==='offline'&&row.mode==='ensemble'?(row.participantIds||[]):[charId];for(var actorId of actors){var x=await ingest(db,'wechat-'+(source==='private'?'private':source==='group'?'group':'offline'),row,row.id,owner,actorId);result.created+=x.createdCount||(x.created?1:0);}await db.config.delete(key);}
  catch(e){var old=(await db.config.get(key))?.value;await db.config.put({key:key,value:{ownerUid:owner,source:source,id:row.id,error:String(e.message||e),attempts:(old?.attempts||0)+1,updatedAt:Date.now()}});result.errors.push({source:source,id:row.id,error:String(e.message||e)});}
 }
 if(options.retryFailures){var failures=(await db.config.where('key').startsWith('shili-scan-failure:').toArray()).filter(function(r){return r.key.startsWith('shili-scan-failure:')&&String(r.value?.ownerUid)===owner;});for(var f of failures.slice(0,cap)){stillOwner();var table=f.value.source==='private'?db.messages:f.value.source==='group'?db.groupMessages:db.offlineChats,row=table&&await table.get(f.value.id);if(row)await process(f.value.source,row);else await db.config.delete(f.key);}}
 for(var source of ['private','group','offline']){var table=source==='private'?db.messages:source==='group'?db.groupMessages:db.offlineChats;if(!table)continue;if(result.scanned>=cap){result.hasMore=true;break;}
  var rows=await table.where('id').above(Number(state[source])||0).limit(cap-result.scanned+1).toArray();
  for(var row of rows){if(result.scanned>=cap){result.hasMore=true;break;}stillOwner();await process(source,row);result.scanned++;state[source]=row.id;state.scanned=(state.scanned||0)+1;state.created=(state.created||0)+result.created-(result._createdSaved||0);result._createdSaved=result.created;state.updatedAt=Date.now();await db.config.put({key:scanKey(owner),value:state});}
 }
 delete result._createdSaved;result.progress=state;return result;})();incrementalBusy.set(lock,work);try{return await work;}finally{incrementalBusy.delete(lock);}
}
async function markForRescan(db,owner,source,id){await db.config.put({key:failureKey(owner,source,id),value:{ownerUid:String(owner),source:source,id:id,error:'消息已更新，等待重新核对',attempts:0,updatedAt:Date.now()}});}
async function resetScan(db,owner){if(root.getShiliOwnerUid&&String(root.getShiliOwnerUid())!==String(owner))throw Error('账号不匹配');await db.config.delete(scanKey(owner));}
async function confirmGift(db,ownerUid,giftId){var before=await root.ShiliRepository.getGift(db,ownerUid,giftId),g=await root.ShiliRepository.confirmAndRemember(db,ownerUid,giftId,root.WanWanMemory);if(before?.status==='pending-review'&&g.status==='received')root.ShiliIntegration?.scheduleGiftImage(db,ownerUid,giftId).catch(function(){});root.ShiliIntegration?.announce?.(ownerUid,giftId);return g;}
async function getCharacterGiftMemory(db,ownerUid,charId){return root.ShiliRepository.memoryContext(db,ownerUid,charId,12);}
root.ShiliBridge={markForRescan:markForRescan,scanIncremental:scanIncremental,scanProgress:scanProgress,resetScan:resetScan,ingest:ingest,scanPrivate:scanPrivate,scanAll:scanAll,sendToCharacter:sendToCharacter,giftForMessage:giftForMessage,confirmGift:confirmGift,getCharacterGiftMemory:getCharacterGiftMemory};
})(typeof window!=='undefined'?window:globalThis);
