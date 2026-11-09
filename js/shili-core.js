/* 拾礼 v6 - 纯逻辑原型；未接入原项目。 */
(function(root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ShiliCore = factory(); })(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function normalizedText(input) { return String(input == null ? '' : input).trim().replace(/\s+/g, ' '); }
  function parseMessage(raw) {
    var s = normalizedText(raw);
    if (s.startsWith('__NARRATIVE__')) return {kind:'narrative', text:s.slice(13)};
    if (s.startsWith('__GIFT__')) { try {return {kind:'legacy-gift', data:JSON.parse(s.slice(8))};} catch(e) {return {kind:'invalid-gift', error:'invalid JSON'};} }
    return {kind:'text',text:s};
  }
  function classifyNarrative(raw) {
    var text = normalizedText(raw);
    if (!text) return {kind:'none', confidence:'none'};
    if (/(梦见|做梦|梦里|假如|如果|仿佛|想象|假设|本可以)/.test(text)) return {kind:'hypothetical',confidence:'medium'};
    if (/(明天|以后|下次|将来|打算|准备|计划|想要|会送|要送|答应送|承诺送)/.test(text)) return {kind:'promised',confidence:'medium'};
    if (/(去年|以前|曾经|记得|回忆|当年|上次).{0,25}(送|赠|给过|戴上)/.test(text)) return {kind:'recalled',confidence:'medium'};
    if (/(拒绝|没有收|没收下|退还|还给|不要这份|并未送|没送)/.test(text)) return {kind:'declined-or-returned',confidence:'medium'};
    if (/(递给|送给|赠给|交到.{0,10}手中|戴在.{0,10}手上|戴上|塞进.{0,10}手里|放进.{0,10}掌心|收下了)/.test(text)) return {kind:'gift-candidate',confidence:'low'};
    return {kind:'none',confidence:'none'};
  }
  function validateEvent(e) {
    if (!e || !e.ownerUid || !e.sourceType || !e.sourceId || !e.charId) throw Error('Missing ownerUid/sourceType/sourceId/charId');
    return {ownerUid:String(e.ownerUid),sourceType:String(e.sourceType),sourceId:String(e.sourceId),charId:String(e.charId),eventIndex:Number.isInteger(e.eventIndex)?e.eventIndex:0};
  }
  function completedGifts(raw,names,options) {
    var text=normalizedText(raw),out=[];
    if(/梦见|做梦|梦里|假如|假设|想象|你(?:并未|没有|没)收下|拒绝|退还/.test(text))return out;
    var clauses=text.split(/[，。！；\n]/),allowed=(options?.explicitOnly?[]:['他','她','我','角色']).concat(names||[]).filter(Boolean),ambiguous=false;
    clauses.forEach(function(clause){
      if(/[？?]|是否|有没有|会不会|能不能|要不要|了吗|了么|给你看看|用完.*还/.test(clause))return;
      if(/去年|以前|曾经|记得|回忆|当年|上次|明天|以后|下次|将来|打算|准备|计划|会送|要送|没有|并未|没送|不曾/.test(clause))return;
      var pattern=/([^，。！？；]*?)(?:把|将)\s*(?:一(?:份|个|只|条|枚|对|本|束|盒|袋|块|件|封|张|顶|双|瓶|支|颗|套|篮|幅|架|盏|串|箱|罐)\s*)?[「『“"]?([^，。！？；：」』”"]{1,40}?)[」』”"]?\s*(?:轻轻地?|郑重地?|小心地?|缓缓地?)?\s*(送给|赠给|递给|交到|塞进|放进)(?:了)?\s*(?:你|用户)(?:的手(?:中|里)|的掌心)?/g,m;
      while((m=pattern.exec(clause))){var subject=m[1].trim().replace(/^(?:然后|随后|接着|于是|又|并且|并)/,'').trim();
        (names||[]).filter(Boolean).forEach(function(n){for(var prefix of ['【'+n+'】',n+'：',n+':'])if(subject.startsWith(prefix)){var tail=subject.slice(prefix.length).trim().replace(/^我/,'');subject=n+tail;}});
        var known=subject===''&&out.length>0||allowed.some(function(n){if(!subject.startsWith(n))return false;return /^(?:轻轻地?|郑重地?|小心地?|缓缓地?|微笑着|笑着|温柔地|亲手)?$/.test(subject.slice(n.length));});
        if(!known){if(subject)ambiguous=true;continue;}if(ambiguous&&['他','她','我',''].includes(subject))continue;
        if(!/送给|赠给/.test(m[3])&&!/礼物|赠礼|送你的|送给你的|生日|纪念|心意/.test(clause))continue;
        var name=m[2].replace(/^[这那](?:份|个|只|条|枚|对|本|束|盒|袋|块|件|封|张|顶|双|瓶|支|颗|套|篮|幅|架|盏|串|箱|罐)/,'').replace(/[「『“"」』”"]/g,'').trim();
        if(/^(?:祝福|亲吻|吻|拥抱|笑容|目光|消息|回复|问候|晚安|早安|爱意|承诺)$/.test(name))continue;
        if(!name||/^(?:礼物|礼盒|东西|物品|包裹|心意|惊喜)$/.test(name)||/递给|送给|赠给|交到|说/.test(name))continue;
        out.push({name:name,description:clause,message:'',evidence:m[0]});
      }
    });return out;
  }
  function completedGift(raw,names){return completedGifts(raw,names)[0]||null;}
  function eventKey(e) { var x=validateEvent(e);return JSON.stringify([x.ownerUid,x.sourceType,x.sourceId,x.charId,x.eventIndex]); }
  function ingestPlan(e) {
    var x=validateEvent(e), parsed=parseMessage(e.content), classification=parsed.kind==='narrative'?classifyNarrative(parsed.text):{kind:'none',confidence:'none'};
    if (parsed.kind==='legacy-gift') return {action:'legacy-review',eventKey:eventKey(e),parsed:parsed};
    if (classification.kind==='gift-candidate') return {action:'review',eventKey:eventKey(e),classification:classification,source:x};
    return {action:'skip',eventKey:eventKey(e),classification:classification};
  }
  return {parseMessage:parseMessage,classifyNarrative:classifyNarrative,completedGift:completedGift,completedGifts:completedGifts,eventKey:eventKey,ingestPlan:ingestPlan};
});
