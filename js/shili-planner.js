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
  if(date<item.date)date=item.date;
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
 var match=isOccasionDay(x,day);
  return match?{id:x.id,ownerUid:x.ownerUid,charId:x.charId,timeMode:x.timeMode,at:Date.parse(day+'T00:00:00Z')}:null;
 }).filter(Boolean);
}
var TYPES={birthday:'生日',festival:'节日',anniversary:'周年纪念',together:'在一起',firstMeeting:'初次相遇',promise:'约定',travel:'旅行',custom:'自定义'};
var TYPE_HINTS={birthday:'区分用户生日与角色生日，结合人设表达祝福，不编造年龄。',festival:'按用户设置的日期与节日名称回应，不推测农历换算或其他节日习俗。',anniversary:'结合已知共同经历纪念，不编造经历、关系或周年数。',together:'准确使用累计相伴天数，不把每年纪念当作累计清零，不推测未设定的恋爱关系。',firstMeeting:'可结合已知初遇记忆，不编造初遇地点或过程。',promise:'区分约定尚未到期、今天到期和已过期，不宣称约定已经履行。',travel:'区分出发前、出发当天和行程日期已过，不编造已经出行。',custom:'依据名称和补充说明理解，不推测事件类型或已完成状态。'};
function isOccasionDay(item,day){
 if(!item||item.enabled===false||!validDate(item.date)||!validDate(day)||day<item.date)return false;
 if(item.recurring===true||item.recurring==='yearly')return annualDate(item.date,day.slice(0,4))===day;
 return item.date===day;
}
function dateNumber(day){return Date.parse(day+'T00:00:00Z')/86400000;}
function stats(item,clock){
 var now=item.timeMode==='virtual'?clock.virtualNow:clock.realNow,day=calendarDate(now,item.timeZone||clock.timeZone),target=item.date;
 var delta=dateNumber(day)-dateNumber(item.date),mode=item.countMode==='countup'?'countup':'countdown';
 if(mode==='countdown'&&(item.recurring===true||item.recurring==='yearly')){
  target=annualDate(item.date,day.slice(0,4));
  if(target<day)target=annualDate(item.date,Number(day.slice(0,4))+1);
  if(target<item.date)target=item.date;
 }
 var remaining=dateNumber(target)-dateNumber(day),count=mode==='countup'?(delta>=0?delta+(item.includeStartDay===true?1:0):null):remaining;
 var label=mode==='countup'?(delta<0?'还有 '+(-delta)+' 天开始':'已累计 '+count+' 天'):(remaining===0?'就是今天':remaining>0?'还有 '+remaining+' 天':'已过去 '+(-remaining)+' 天');
 return {day:day,targetDate:target,countMode:mode,count:count,elapsedDays:delta,remainingDays:remaining,label:label,isToday:isOccasionDay(item,day),started:delta>=0};
}
function occasionContext(item,clock){
 var x=stats(item,clock),type=TYPES[item.eventType]?item.eventType:'custom';
 return {名称:item.title,类型:TYPES[type],生日属于:type==='birthday'?(item.birthdayOf==='character'?'关联角色':'当前用户'):undefined,时间体系:item.timeMode==='virtual'?'虚拟时间':'现实时间',起始或目标日期:item.date,计数方式:x.countMode==='countup'?'累计日':'倒数日',起始当天算第一天:item.includeStartDay===true,每年重复:item.recurring===true||item.recurring==='yearly',当前日期:x.day,日期状态:x.isToday?'今天是纪念日':x.elapsedDays<0?'尚未到起始日期':'今天不是纪念日',天数说明:x.label,下次目标日期:x.countMode==='countdown'?x.targetDate:undefined,补充说明:String(item.aiNote||'').slice(0,500),理解规则:TYPE_HINTS[type]};
}
function deliveryKey(ownerUid,anniversaryId,charId,occurrenceAt){return JSON.stringify([String(ownerUid),String(anniversaryId),String(charId),Number(occurrenceAt)]);}
return {validDate:validDate,occurrence:occurrence,due:due,today:today,calendarDate:calendarDate,deliveryKey:deliveryKey,types:TYPES,stats:stats,isOccasionDay:isOccasionDay,occasionContext:occasionContext};});
