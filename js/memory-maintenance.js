/* Local memory housekeeping. Raw records are retained for recovery and history. */
(function(){
  'use strict';
  function emotion(text){
    text=String(text||'');var positive=/开心|高兴|喜欢|期待|幸福|感动/.test(text),negative=/难过|伤心|生气|害怕|焦虑|讨厌|疲惫/.test(text);
    return {valence:positive===negative?0:positive?0.5:-0.5,arousal:/非常|特别|太|激动|愤怒|恐惧/.test(text)?0.8:0.3};
  }
  async function saveProgress(charId,data,ownerUid){
    ownerUid=ownerUid||window._wechatUid;if(!charId||!ownerUid)return;
    await WanWanRuntime.put('lastChatProgress_'+ownerUid+'_'+charId,Object.assign({endedAt:WanWanRuntime.now()},data||{}));
  }
  async function getProgress(charId,ownerUid,atTime){
    var p=await WanWanRuntime.config('lastChatProgress_'+(ownerUid||window._wechatUid)+'_'+charId,null);
    if(!p||p.endedAt>(atTime==null?WanWanRuntime.now():atTime))return '';
    return '【最近对话进度】'+(p.lastTopic||'')+'；最后内容：'+(p.lastMessage||'');
  }
  async function resolveConflict(row){
    if(!row.factKey)return row;
    var old=await db.memories.where('charId').equals(row.charId).filter(function(m){return String(m.ownerUid)===String(row.ownerUid)&&m.factKey===row.factKey&&!m.replacedAt}).toArray();
    if(old.some(function(m){return m.content===row.content}))return null;
    var id=await db.memories.add(row);
    for(var previous of old)await db.memories.update(previous.id,{replacedAt:row.sourceAt||row.createdAt,supersededBy:id});
    return Object.assign({},row,{id:id});
  }
  async function consolidate(ownerUid){
    if(!ownerUid)return;
    return WanWanRuntime.withLock('memory-maintenance:'+ownerUid,async function(){
      var date=new Date();var day=date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();var key='memoryMaintenance:'+ownerUid;
      if(await WanWanRuntime.config(key,'')===day)return;
      var rows=await db.memories.where('ownerUid').equals(ownerUid).toArray(),seen=new Map();
      for(var row of rows){if(row.status==='archived')continue;var k=row.charId+'|'+String(row.content||'').trim().replace(/\s+/g,' ')+'|'+row.sourceAt;
        if(seen.has(k))await db.memories.update(row.id,{status:'archived',duplicateOf:seen.get(k)});else seen.set(k,row.id);
      }
      await WanWanRuntime.put(key,day);
    });
  }
  Object.assign(window.WanWanMemory,{detectEmotion:emotion,saveConversationProgress:saveProgress,getConversationProgress:getProgress,resolveConflict:resolveConflict,dreamConsolidate:consolidate});
  setInterval(function(){if(window._wechatUid)consolidate(window._wechatUid).catch(function(e){console.warn('[Memory] 本地整理失败，原记录保留',e)})},60000);
})();
