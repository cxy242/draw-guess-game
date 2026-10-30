/* Virtual time uses persisted real/virtual anchors, never timer callback counts. */
(function () {
  'use strict';
  var enabled = false, speed = 1, offset = 0, realAnchor = Date.now(), virtualAnchor = realAnchor;
  var listeners = [], logs = [], initializing;
  var speeds = [0,1,2,10];
  function getNow() { return enabled ? virtualAnchor + (Date.now() - realAnchor) * speed : Date.now(); }
  function anchor(ts) { realAnchor = Date.now(); virtualAnchor = ts; offset = ts - realAnchor; }
  function fmt(ts) {
    var d = new Date(ts == null ? getNow() : ts), h = d.getHours();
    var p = h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜';
    return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日'+p+(h%12||12)+'点'+String(d.getMinutes()).padStart(2,'0')+'分';
  }
  function snapshot() { return {enabled:enabled,speed:speed,offset:enabled?getNow()-Date.now():offset,virtualTs:getNow(),realTs:Date.now(),formatted:fmt()}; }
  function emit() { var value=snapshot();listeners.slice().forEach(function(cb){try{cb(value)}catch(e){console.warn('[TimeWorld] 监听异常',e)}}); }
  async function get(k,def) { if(window.db){var r=await db.config.get(k);return r?r.value:def} var s=localStorage.getItem(k);return s==null?def:JSON.parse(s); }
  async function put(k,v) { if(window.db)await db.config.put({key:k,value:v});else localStorage.setItem(k,JSON.stringify(v)); }
  function persist() {
    var state={enabled:enabled,speed:speed,offset:offset,realAnchor:realAnchor,virtualAnchor:virtualAnchor};
    return put('tw_state_v3',state).then(function(){return Promise.all([put('tw_enabled',enabled),put('tw_speed',speed),put('tw_offset',offset),put('tw_frozen',speed===0?virtualAnchor:null),put('tw_audit',logs.slice())])}).catch(function(e){console.error('[TimeWorld] 保存失败',e);window.toast&&toast('时间设置保存失败，请检查存储空间');throw e});
  }
  function audit(action,detail) { logs.push({action:action,detail:detail||'',virtualTs:getNow(),realTs:Date.now()});if(logs.length>50)logs.splice(0,logs.length-50); }
  function save(action,detail) { audit(action,detail);persist().catch(function(){});emit(); }
  function setEnabled(on) { on=!!on;if(on===enabled)return;if(enabled){offset=getNow()-Date.now();}enabled=on;if(on)anchor(Date.now()+offset);save(on?'enable':'disable','虚拟时间'+(on?'开启':'关闭')); }
  function setSpeed(s) { if(speeds.indexOf(s)<0)return false;var ts=enabled?getNow():Date.now()+offset;anchor(ts);speed=s;save('setSpeed','流速→'+s);return true; }
  function setOffset(n) { anchor(Date.now()+(Number(n)||0));save('setOffset','调整到'+fmt(virtualAnchor)); }
  function addOffset(n) { anchor((enabled?getNow():Date.now()+offset)+(Number(n)||0));save('addOffset','偏移'+Number(n)+'毫秒'); }
  function reset() { anchor(Date.now());save('reset','回到现在'); }
  async function init() {
    if(initializing)return initializing;
    initializing=(async function(){
      if(window.waitForDB)await waitForDB();
      var s=await get('tw_state_v3',null);
      if(s&&Number.isFinite(s.realAnchor)&&Number.isFinite(s.virtualAnchor)){
        enabled=!!s.enabled;speed=speeds.indexOf(s.speed)>=0?s.speed:1;offset=Number(s.offset)||0;realAnchor=s.realAnchor;virtualAnchor=s.virtualAnchor;
      }else{
        enabled=await get('tw_enabled',false)===true;speed=Number(await get('tw_speed',1));if(speeds.indexOf(speed)<0)speed=1;offset=Number(await get('tw_offset',0))||0;
        anchor(speed===0?(Number(await get('tw_frozen',0))||Date.now()+offset):Date.now()+offset);
      }
      logs=await get('tw_audit',[]);if(!Array.isArray(logs))logs=[];emit();
    })().catch(function(e){enabled=false;console.error('[TimeWorld] 初始化失败',e);window.toast&&toast('虚拟时间未能恢复，请检查存储');throw e});
    return initializing;
  }
  async function since(charId,ownerUid) {
    if(!window.db||!charId)return '';
    ownerUid=ownerUid||window._wechatUid;
    var chats=await db.chats.where('charId').equals(Number(charId)||charId).toArray();
    chats=chats.filter(function(c){return ownerUid&&String(c.ownerUid)===String(ownerUid)});
    var ids=new Set(chats.map(function(c){return c.id}));if(!ids.size)return '';
    var msgs=await db.messages.where('chatId').anyOf(Array.from(ids)).toArray();
    if(!msgs.length)return '';var last=Math.max.apply(null,msgs.map(function(m){return Number(m.createdAt)||0}));var mins=Math.floor(Math.max(0,getNow()-last)/60000);
    return mins<1?'刚刚':mins<60?mins+'分钟前':mins<1440?Math.floor(mins/60)+'小时前':Math.floor(mins/1440)+'天前';
  }
  window.TimeWorld={getNow:getNow,getFormattedNow:fmt,getDayString:function(ts){var d=new Date(ts==null?getNow():ts);return d.getFullYear()+'年'+(d.getMonth()+1)+'月'+d.getDate()+'日 星期'+'日一二三四五六'[d.getDay()]},
    getTimeRange:function(last){return{startTime:Math.min(last||getNow(),getNow()),endTime:getNow()}},getTimeSinceLastChat:since,
    getOffset:function(){return enabled?getNow()-Date.now():offset},setOffset:setOffset,addOffset:addOffset,reset:reset,isEnabled:function(){return enabled},setEnabled:setEnabled,
    getSpeed:function(){return speed},setSpeed:setSpeed,audit:function(a,d){audit(a,d);persist().catch(function(){})},getAudit:function(){return logs.slice()},clearAudit:function(){logs=[];persist().catch(function(){});emit()},
    stampOf:function(){return{createdAt:getNow(),realCreatedAt:Date.now()}},getRecentDays:function(n,year){var a=[];for(var i=n;i>=1;i--){var d=new Date(getNow());d.setDate(d.getDate()-i);a.push({y:d.getFullYear(),m:d.getMonth()+1,d:d.getDate(),label:(year?d.getFullYear()+'年':'')+(d.getMonth()+1)+'月'+d.getDate()+'日'})}return a},
    onChange:function(cb){listeners.push(cb);return function(){listeners=listeners.filter(function(x){return x!==cb})}},init:init};
  window.TimeProvider=window.TimeWorld;
  setInterval(emit,1000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){init().catch(function(){})});else init().catch(function(){});
})();
