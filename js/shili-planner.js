/* 拾礼：纯函数纪念日计划器；不会自动执行后台任务 */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ShiliPlanner=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(String(s))&&!Number.isNaN(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
function dayStart(now){return Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z');}
function annualDate(date,year){var value=year+'-'+date.slice(5);return validDate(value)?value:(date.slice(5)==='02-29'?year+'-02-28':null);}
function occurrence(item,now){
 if(!item||!validDate(item.date)||!Number.isFinite(now))return null;
 var date=item.date;
 if(item.recurring===true||item.recurring==='yearly'){
  var year=new Date(now).getUTCFullYear();date=annualDate(item.date,year);
  if(Date.parse(date+'T00:00:00Z')<dayStart(now))date=annualDate(item.date,year+1);
 }
 return date?Date.parse(date+'T00:00:00Z'):null;
}
function due(items,clock,windowMs){
 if(!clock||!Number.isFinite(clock.realNow)||!Number.isFinite(clock.virtualNow))throw Error('双时钟参数缺失');
 var span=Math.max(0,Number(windowMs)||0);
 return (items||[]).filter(function(x){
  if(!x||x.enabled===false)return false;
  var now=x.timeMode==='virtual'?clock.virtualNow:clock.realNow,t=occurrence(x,now);
  return t!==null&&t>=dayStart(now)&&t<=now+span;
 }).map(function(x){return {id:x.id,ownerUid:x.ownerUid,timeMode:x.timeMode,at:occurrence(x,x.timeMode==='virtual'?clock.virtualNow:clock.realNow),charId:x.charId};});
}
function calendarDate(now,timeZone){
 if(!timeZone)return new Date(now).toISOString().slice(0,10);
 var parts=new Intl.DateTimeFormat('en-US',{timeZone:timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
 function part(type){return parts.find(function(x){return x.type===type}).value;}
 return part('year')+'-'+part('month')+'-'+part('day');
}
function today(items,clock){
 if(!clock||!Number.isFinite(clock.realNow)||!Number.isFinite(clock.virtualNow))throw Error('双时钟参数缺失');
 return (items||[]).filter(function(x){return x&&x.enabled!==false&&validDate(x.date)}).map(function(x){
  var now=x.timeMode==='virtual'?clock.virtualNow:clock.realNow,day=calendarDate(now,x.timeZone||clock.timeZone);
  var annual=x.recurring===true||x.recurring==='yearly';
  var monthDay=x.date.slice(5),todayPart=day.slice(5);
  var match=annual?(monthDay===todayPart||(monthDay==='02-29'&&todayPart==='02-28'&&!validDate(day.slice(0,4)+'-02-29'))):x.date===day;
  return match?{id:x.id,ownerUid:x.ownerUid,charId:x.charId,timeMode:x.timeMode,at:Date.parse(day+'T00:00:00Z')}:null;
 }).filter(Boolean);
}
function deliveryKey(ownerUid,anniversaryId,charId,occurrenceAt){return JSON.stringify([String(ownerUid),String(anniversaryId),String(charId),Number(occurrenceAt)]);}
return {validDate:validDate,occurrence:occurrence,due:due,today:today,calendarDate:calendarDate,deliveryKey:deliveryKey};});
