// Local HTTP fixtures exercise production adapters; no external API or keys are used.
const fs=require('fs'),vm=require('vm'),http=require('http'),assert=require('assert/strict'),crypto=require('crypto');
const rootDir=require('path').join(__dirname,'..');
const copy=x=>x===undefined?undefined:structuredClone(x);
class Query{
 constructor(t,p=()=>true){this.t=t;this.p=p;this.n=Infinity;}
 and(f){const old=this.p;this.p=x=>old(x)&&f(x);return this;}
 filter(f){return this.and(f)} reverse(){this.rev=true;return this} async count(){return (await this.toArray()).length} limit(n){this.n=n;return this}
 async toArray(){return [...this.t.rows.values()].sort((a,b)=>(this.rev?-1:1)*(Number(a.id)-Number(b.id))).filter(this.p).slice(0,this.n).map(copy)}
 async first(){return (await this.limit(1).toArray())[0]}
 async delete(){for(const row of await this.toArray())this.t.rows.delete(this.t.key(row))}
 async modify(patch){for(const row of await this.toArray())await this.t.update(this.t.key(row),patch)}
}
class Table{
 constructor(name){this.name=name;this.rows=new Map();this.next=1}
 key(r){return this.name==='config'?r.key:this.name==='giftEvents'?r.eventKey:r.id}
 async get(id){return copy(this.rows.get(id))}
 async toArray(){return [...this.rows.values()].map(copy)}
 async add(r){r=copy(r);if(this.key(r)==null)r.id=this.next++;if(this.rows.has(this.key(r)))throw Error('Duplicate primary key');if(this.name==='gifts'&&[...this.rows.values()].some(x=>x.eventKey===r.eventKey))throw Error('Duplicate event key');this.rows.set(this.key(r),r);return this.key(r)}
 async put(r){r=copy(r);if(this.key(r)==null)r.id=this.next++;this.rows.set(this.key(r),r);return this.key(r)}
 async update(id,patch){if(!this.rows.has(id))return 0;this.rows.set(id,Object.assign({},this.rows.get(id),copy(patch)));return 1}
 async delete(id){this.rows.delete(id)}
 async bulkGet(ids){return Promise.all(ids.map(x=>this.get(x)))} async bulkPut(rows){for(const r of rows)await this.put(r)}
 filter(f){return new Query(this,f)}
 where(field){const value=r=>field.startsWith('[')?field.slice(1,-1).split('+').map(k=>r[k]):r[field];return {startsWith:v=>new Query(this,r=>String(value(r)).startsWith(v)),equals:v=>new Query(this,r=>JSON.stringify(value(r))===JSON.stringify(v)),above:v=>new Query(this,r=>r[field]>v),anyOf:vs=>new Query(this,r=>vs.includes(r[field]))}}
}
function db(){const d={name:'fixture',transaction:async(...args)=>args.at(-1)()};for(const n of ['config','gifts','giftEvents','giftGenerationJobs','shiliAnniversaries','characters','chats','messages','groupChats','groupMessages','offlineChats'])d[n]=new Table(n);return d;}
let hits={text:0,image:0,body:[],personas:[],systems:[]},failImage=false,formatReject=false,imageURL=false,failDownload=false,textFormatReject=false,octetImage=false;
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK2cAAAAASUVORK5CYII=';
const server=http.createServer(async(req,res)=>{let text='';for await(const b of req)text+=b;const body=text?JSON.parse(text):{};res.setHeader('Content-Type','application/json');
 if(req.url.endsWith('/chat/completions')){hits.text++;if(textFormatReject&&body.response_format){res.statusCode=400;res.end(JSON.stringify({error:{message:'Unknown parameter response_format json_object'}}));return;}const last=body.messages.at(-1).content;let parsed;try{parsed=JSON.parse(last)}catch{};hits.personas.push(parsed?.档案与上下文);hits.systems.push(body.messages.find(m=>m.role==='system')?.content||'');const count=parsed?.任务资料?.数量;const output=count?JSON.stringify({gifts:Array.from({length:count},(_,i)=>({name:'礼物'+i,description:'手工银质书签'+i,message:'这是我为你挑选的心意'+i}))}):'谢谢你送我的书签，我会好好收藏。';res.end(JSON.stringify({choices:[{message:{role:'assistant',content:output},finish_reason:'stop'}]}));}
 else if(req.url.endsWith('/images/generations')){hits.image++;hits.body.push(body);if(failImage){res.statusCode=503;res.end(JSON.stringify({error:{message:'fixture image unavailable'}}));}else if(formatReject&&body.response_format){res.statusCode=400;res.end(JSON.stringify({error:{message:'Unknown parameter response_format'}}));}else res.end(JSON.stringify({data:[imageURL?{url:'http://127.0.0.1:'+server.address().port+'/gift.png'}:{b64_json:png}]}));}
 else if(req.url==='/gift.png'){if(failDownload){res.statusCode=503;res.end('download unavailable');return;}res.setHeader('Content-Type',octetImage?'application/octet-stream':'image/png');res.end(Buffer.from(png,'base64'));}
 else{res.statusCode=404;res.end('{}');}});
let passed=0;function ok(label,fn){fn();passed++;console.log('PASS',label)}
async function main(){await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port+'/v1',d=db();let owner='1',virtual=Date.parse('2030-01-01T00:00:00Z'),enabled=true;
 const events=[],memories=[],context={console,Date,Intl,URL,URLSearchParams,TextEncoder,TextDecoder,Blob,Headers,Request,Response,AbortController,FormData,Buffer,crypto:crypto.webcrypto,atob,btoa,setTimeout,clearTimeout,setInterval:()=>0,clearInterval:()=>{},structuredClone,db:d,document:{visibilityState:'visible',addEventListener(){},getElementById(){return null}},navigator:{},localStorage:{getItem(){return null},setItem(){}},addEventListener(){},dispatchEvent(e){events.push(e)},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},getShiliOwnerUid:()=>owner,TimeWorld:{getNow:()=>virtual,isEnabled:()=>enabled,getSpeed:()=>0,onChange(){}},WanWanMemory:{getMemoryContext:async()=>'',logStructuredEvent:async(id,data,uid)=>{memories.push({id,data,uid});return true}},fetch:async(url,opts)=>{if(new URL(url).hostname!=='127.0.0.1')throw Error('External fixture request forbidden');return fetch(url,opts)},FileReader:class{readAsDataURL(blob){blob.arrayBuffer().then(b=>{this.result='data:'+blob.type+';base64,'+Buffer.from(b).toString('base64');this.onload()}).catch(e=>this.onerror(e))}}};context.window=context;vm.createContext(context);
 for(const file of ['settings','shili-repository','shili-core','shili-planner','shili-integration','shili-image','shili-bridge','shili-service','shili-portable'])vm.runInContext(fs.readFileSync(rootDir+'/js/'+file+'.js','utf8'),context,{filename:file+'.js'});
 for(const [key,value] of Object.entries({apiBaseUrl:base,apiKey:'local-fixture-key',apiModel:'fixture-text',imageGenApiUrl:base,imageGenApiKey:'local-fixture-key',imageGenModel:'fixture-image',imageGenSize:'1024x1024'}))await d.config.put({key,value});
 await d.characters.put({id:1,type:'user',name:'用户'});await d.characters.put({id:2,type:'character',name:'小雨',description:'温柔，喜欢手工',ownerUid:1});await d.characters.put({id:3,type:'character',name:'小明',ownerUid:9});
 const svc=context.ShiliService,repo=context.ShiliRepository,bridge=context.ShiliBridge;
 let job=await svc.requestGifts(d,'1','2',{requestId:'one',count:2,timeMode:'virtual'});
 ok('真实生产文本适配器→本地HTTP→两份方案',()=>assert.equal(hits.text,1));
 ok('真实生产图片适配器→本地HTTP→每份独立调用',()=>assert.equal(hits.image,2));
 ok('两份礼物均有可保存图片并送达',()=>{assert.equal(job.giftIds.length,2);for(const id of job.giftIds){const g=d.gifts.rows.get(id);assert.equal(g.status,'received');assert.equal(g.deliveryStatus,'sent');assert(g.imageUrl.startsWith('data:image/png;base64,'));assert.equal(g.recipientUid,'1')}});
 ok('两张聊天卡片和两条角色记忆',()=>{assert.equal(d.messages.rows.size,2);assert.equal(memories.length,2);assert([...d.messages.rows.values()].every(x=>x.role==='assistant'))});
 const message=[...d.messages.rows.values()][0],gift=await bridge.giftForMessage(d,'1','wechat-private',message.id,'2');ok('聊天卡片打开同一giftId',()=>assert.equal(gift.id,job.giftIds[0]));
 await svc.requestGifts(d,'1','2',{requestId:'one',count:2});ok('同一已完成任务不重复生图、记忆、消息',()=>{assert.equal(hits.image,2);assert.equal(d.gifts.rows.size,2);assert.equal(d.messages.rows.size,2)});
 failImage=true;await assert.rejects(()=>svc.requestGifts(d,'1','2',{requestId:'retry',count:1}));const saved=(await svc.recentRequests(d,'1')).find(x=>x.id==='retry');ok('图片503保留任务和方案，不发空卡片',()=>{assert.equal(saved.status,'failed');assert.equal(d.messages.rows.size,2)});
 const textHits=hits.text;failImage=false;await svc.requestGifts(d,'1','2',{requestId:'retry',count:1});ok('重试只续原图，不重新调用文本AI或重复创建',()=>{assert.equal(hits.text,textHits);assert.equal(d.gifts.rows.size,3);assert.equal(d.messages.rows.size,3)});
 formatReject=true;await svc.requestGifts(d,'1','2',{requestId:'format',count:1});ok('仅格式参数被明确拒绝才去参重试',()=>{const b=hits.body;assert(b.at(-2).response_format);assert(!b.at(-1).response_format)});formatReject=false;
 imageURL=true;await svc.requestGifts(d,'1','2',{requestId:'url',count:1});ok('远程图像URL下载转永久base64',()=>assert(d.gifts.rows.get(5).imageUrl.startsWith('data:image/png;base64,')));imageURL=false;
 owner='9';await assert.rejects(()=>svc.requestGifts(d,'1','2',{requestId:'cross'}));owner='1';await assert.rejects(()=>svc.requestGifts(d,'1','3',{requestId:'foreign'}));ok('账号和角色归属拒绝跨账号请求',()=>assert.equal(d.gifts.rows.size,5));
 let outbound=await repo.createGift(d,{ownerUid:'1',charId:'2',name:'我的书签',description:'蓝色手工书签',draft:true,sourceType:'shili-manual'});await repo.setGiftFields(d,'1',outbound.gift.id,{imageUrl:'data:image/png;base64,'+png,imageStatus:'ready'});await bridge.sendToCharacter(d,'1',outbound.gift.id);await svc.replyToGift(d,'1',outbound.gift.id);const textAfter=hits.text;await svc.replyToGift(d,'1',outbound.gift.id);ok('用户送出→真实文本适配器回应→重试不重复',()=>{assert.equal(hits.text,textAfter);assert.equal(d.gifts.rows.get(outbound.gift.id).replyStatus,'done');assert([...d.messages.rows.values()].some(x=>x.content.includes('谢谢你送我')))});
 const c=context.ShiliCore;ok('已经送花不被后半句以后误判',()=>assert.equal(c.completedGifts('她把一束花送给你，随后说以后每天都想陪着你。',['小雨']).length,1));ok('同一段两件礼物',()=>assert.equal(c.completedGifts('他把一枚戒指送给你，又把一条项链送给你。',['小雨']).length,2));ok('第三人赠送不记成当前角色',()=>assert.equal(c.completedGifts('小明把一束花送给你，小雨在旁边看着。',['小雨']).length,0));ok('梦境承诺拒绝与用户送出不算收到',()=>{for(const t of ['梦里他把一枚戒指送给你','他准备把一枚戒指送给你','他把一枚戒指送给你，你没有收下','你把一枚戒指送给他'])assert.equal(c.completedGifts(t,['小雨']).length,0)});
 let chat=[...d.chats.rows.values()][0];await d.messages.add({chatId:chat.id,role:'assistant',content:'__NARRATIVE__小雨把一枚戒指送给你，又把一条项链送给你。',createdAt:1});let scan=await bridge.scanIncremental(d,'1',200,{retryFailures:true});await context.ShiliIntegration.whenIdle();const before=d.gifts.rows.size,again=await bridge.scanIncremental(d,'1',200);ok('增量第二次无新记录不重复扫描或建礼物',()=>{assert.equal(again.scanned,0);assert.equal(d.gifts.rows.size,before)});
 await d.offlineChats.add({ownerUid:'1',charId:2,role:'assistant',content:'小雨把一条围巾送给你。',createdAt:1});scan=await bridge.scanIncremental(d,'1',200);await context.ShiliIntegration.whenIdle();ok('后加线下剧情继续增量且多件礼物保存',()=>{assert.equal(scan.created,1);assert([...d.gifts.rows.values()].some(g=>g.name==='项链'))});
 let auto=await svc.saveAuto(d,'1',{enabled:true,charIds:['2'],intervalDays:3,count:2,timeMode:'virtual'});ok('虚拟暂停时未达到下轮',()=>assert.equal(svc.dueSlot(auto,virtual),null));virtual+=3*86400000;ok('虚拟三天后到期',()=>assert.equal(svc.dueSlot(auto,virtual),1));await svc.tick();ok('自动总共生成2件，回退不再送',()=>{const saved=d.config.rows.get('shili-auto:1').value;assert.equal(saved.lastSlot,1);assert.equal(svc.dueSlot(saved,virtual-86400000),null)});
 let backup=await context.ShiliPortable.exportOwner(d,'1');ok('新增礼物可导出且引用验证通过',()=>assert(context.ShiliPortable.validate(backup,'1')));
 const imported=db();for(const name of ['characters','chats','messages'])for(const row of await d[name].toArray())await imported[name].put(row);await repo.createGift(imported,{ownerUid:'1',charId:'2',name:'已有的礼物',sourceType:'fixture-other',draft:true});
 const restored=await context.ShiliPortable.importOwner(imported,'1',backup,{confirmed:true});let restoredJob=(await imported.config.get('shili-request:'+JSON.stringify(['1','one'])))?.value;ok('备份恢复重新映射任务礼物ID',()=>assert.equal(restoredJob.giftIds[0],restored.idMap[job.giftIds[0]]));
 const linked=await bridge.giftForMessage(imported,'1','wechat-private',message.id,'2');ok('恢复后聊天卡片仍打开同一份礼物',()=>assert.equal(linked.id,restoredJob.giftIds[0]));
 await assert.rejects(()=>svc.requestGifts(d,'1','2',{count:1.5}));ok('拒绝非整数礼物件数',()=>assert.equal(svc.parsePlan('{"gifts":[]}',0).length,0));
 const id=await d.offlineChats.add({ownerUid:'1',charId:2,role:'assistant',content:'小雨把一顶帽子送给你。',createdAt:1}),originalSave=repo.saveCandidate;let failed=true;repo.saveCandidate=async(...args)=>{if(failed&&args[1].name==='帽子'){failed=false;throw Error('fixture storage error')}return originalSave(...args)};
 scan=await bridge.scanIncremental(d,'1',200);ok('补扫失败保留检查点和待重试记录',()=>{assert.equal(scan.errors.length,1);assert([...d.config.rows.values()].some(r=>r.key.startsWith('shili-scan-failure:')&&r.value.id===id))});repo.saveCandidate=originalSave;scan=await bridge.scanIncremental(d,'1',200,{retryFailures:true});await context.ShiliIntegration.whenIdle();ok('下次仅重试失败项，不从头补扫',()=>{assert.equal(scan.scanned,0);assert.equal(scan.created,1);assert([...d.gifts.rows.values()].some(g=>g.name==='帽子'))});
 await d.characters.put({id:4,type:'character',name:'小晴',ownerUid:1});await d.offlineChats.add({ownerUid:'1',charId:2,participantIds:[2,4],mode:'ensemble',role:'assistant',content:'小雨把一盒饼干送给你。小晴把一条手链送给你。',createdAt:1});scan=await bridge.scanIncremental(d,'1',200);await context.ShiliIntegration.whenIdle();ok('群像按明确赠送者分别登记，不全算第一个角色',()=>{assert([...d.gifts.rows.values()].some(g=>g.name==='手链'&&g.charId==='4'));assert([...d.gifts.rows.values()].some(g=>g.name==='饼干'&&g.charId==='2'))});
 await assert.rejects(()=>context.ShiliImage.durableImage('data:image/png;base64,bm90LWFuLWltYWdl'));ok('拒绝伪装成base64的非图片响应',()=>assert.equal(c.completedGifts('【小晴】我把一条手链送给你。',['小晴'],{explicitOnly:true}).length,1));
 const p=context.ShiliPlanner,clock={realNow:Date.parse('2026-11-02T04:00:00Z'),virtualNow:Date.parse('2030-01-01T04:00:00Z'),timeZone:'Asia/Shanghai'},a={date:'2025-11-02',timeMode:'real',countMode:'countup',recurring:true,eventType:'together'};
 ok('累计跨周年不清零',()=>assert.equal(p.stats(a,clock).count,365));ok('起始日0或1天',()=>{assert.equal(p.stats({...a,date:'2026-11-02'},clock).count,0);assert.equal(p.stats({...a,date:'2026-11-02',includeStartDay:true},clock).count,1)});ok('年度倒数、未来首次与闰日',()=>{assert.equal(p.stats({...a,date:'2020-10-31',countMode:'countdown'},clock).targetDate,'2027-10-31');assert(!p.isOccasionDay({...a,date:'2027-11-02'},'2026-11-02'));assert(p.isOccasionDay({...a,date:'2024-02-29'},'2025-02-28'))});

 const openedId=job.giftIds[0],textBeforeOpen=hits.text,memBeforeOpen=memories.length;await svc.openGift(d,'1',openedId);await svc.openGift(d,'1',openedId);
 ok('拆封幂等，只记录事实、不调用AI伪造用户感受',()=>{assert.equal(hits.text,textBeforeOpen);assert.equal(memories.length,memBeforeOpen+1);assert(memories.at(-1).data.event.includes('不能推断用户喜欢'));assert.equal(d.gifts.rows.get(openedId).status,'received')});
 ok('原聊天卡片更新为已拆封',()=>assert(JSON.parse(d.messages.rows.get(message.id).content.slice(8)).opened));
 const wechat=fs.readFileSync(rootDir+'/js/wechat.js','utf8'),renderer=wechat.slice(wechat.indexOf('function renderGiftCard('),wechat.indexOf('window.openWechatShiliGift',wechat.indexOf('function renderGiftCard(')+30));
 // Evaluate the actual renderer declaration, stopping at its next function boundary.
 const declaration=wechat.slice(wechat.indexOf('function renderGiftCard('),wechat.indexOf('\n}',wechat.indexOf('function renderGiftCard('))+2);
 const card=vm.runInNewContext('('+declaration+')',{wcEscHtml:s=>String(s).replace(/</g,'&lt;')});
 const sealed=card({giftId:1,itemName:'秘密银戒指',reason:'秘密祝福'},{id:1,role:'assistant'}),opened=card({giftId:1,itemName:'秘密银戒指',reason:'秘密祝福',opened:true},{id:1,role:'assistant'});
 ok('生产卡片待拆隐藏名称祝福，已拆显示内容和状态',()=>{assert(!sealed.includes('秘密银戒指'));assert(!sealed.includes('秘密祝福'));assert(sealed.includes('待拆封'));assert(opened.includes('秘密银戒指'));assert(opened.includes('已拆封'))});
 await d.characters.update(1,{relations:[{charId:2,relation:'我们一起做书签'},{charId:4,relation:'其他人的秘密'}]});await d.characters.update(2,{relations:[{charId:1,relation:'珍视对方'},{charId:4,relation:'不相关的秘密'}]});
 await svc.requestGifts(d,'1','2',{requestId:'after-open',count:1,timeMode:'virtual'});
 ok('角色上下文只带双方关系、最近12条和拆封事实',()=>{const ctx=hits.personas.at(-1);assert.equal(ctx.角色.关系.length,1);assert.equal(ctx.用户.关系.length,1);assert(ctx.最近聊天.length<=12);assert(hits.systems.at(-1).includes('用户已拆封'))});
 ok('任务列表排除回应记录、保留真实任务',()=>{const rows=[...d.config.rows.values()].filter(r=>r.key.startsWith('shili-request:'));assert(rows.some(r=>r.value.charId==null));});
 const grouped=await repo.createGift(d,{ownerUid:'1',charId:'2',name:'群聊专属礼物',sourceType:'wechat-group',sourceId:'group-fixture',sourceChatId:101,confirmed:true,realTimestamp:Date.now()-1000});
 const group101=await repo.memoryContext(d,'1','2',30,{publicOnly:true,groupId:101}),group102=await repo.memoryContext(d,'1','2',30,{publicOnly:true,groupId:102});
 ok('群聊只读本群礼物，私聊礼物不泄露到群',()=>{assert(group101.includes('群聊专属礼物'));assert(!group101.includes('礼物0'));assert(!group102.includes('群聊专属礼物'))});
 await assert.rejects(()=>svc.requestGifts(d,'1','4',{requestId:'one',count:1}));ok('已完成任务不能换角色复用',()=>assert.equal((d.config.rows.get('shili-request:'+JSON.stringify(['1','one']))).value.charId,'2'));
 virtual+=3*86400000;let autoRow=(await d.config.get('shili-auto:1')).value;autoRow.lastSlot=2;autoRow.pendingSlot={slot:2,anchor:autoRow.anchor,timeMode:'virtual',dueAt:virtual,groups:[['2',2]]};await d.config.put({key:'shili-auto:1',value:autoRow});vm.runInContext(fs.readFileSync(rootDir+'/js/shili-service.js','utf8'),context);let beforeResume=d.gifts.rows.size;await context.ShiliService.tick();
 ok('中断后恢复已领取的自动轮次，不丢礼物',()=>{assert.equal(d.gifts.rows.size,beforeResume+2);assert.equal(d.config.rows.get('shili-auto:1').value.pendingSlot,null)});
 autoRow=(await d.config.get('shili-auto:1')).value;autoRow.lastSlot=3;autoRow.pendingSlot={slot:3,anchor:autoRow.anchor,timeMode:'virtual',dueAt:virtual+3*86400000,groups:[['2',2]]};await d.config.put({key:'shili-auto:1',value:autoRow});vm.runInContext(fs.readFileSync(rootDir+'/js/shili-service.js','utf8'),context);beforeResume=d.gifts.rows.size;await context.ShiliService.tick();
 ok('虚拟时间回退不提前执行待恢复轮次',()=>assert.equal(d.gifts.rows.size,beforeResume));
 const firstPage=await repo.listPage(d,'1',{limit:3}),secondPage=await repo.listPage(d,'1',{limit:3,beforeId:firstPage.nextBeforeId});
 ok('珍藏分批读取，不重复、不删除旧记录',()=>{assert.equal(firstPage.items.length,3);assert.equal(secondPage.items.length,3);assert(!secondPage.items.some(g=>firstPage.items.some(x=>x.id===g.id)));assert(firstPage.hasMore)});
 ok('首页计数与全部持久记录一致',()=>assert.equal(d.gifts.rows.size,[...d.gifts.rows.values()].filter(g=>g.ownerUid==='1').length));const counts=await repo.stats(d,'1');assert.equal(counts.total,d.gifts.rows.size);
 for(let i=0;i<12;i++)await d.config.put({key:'shili-request:'+JSON.stringify(['1','old-failed-'+i]),value:{id:'old-failed-'+i,ownerUid:'1',charId:'2',status:'failed',giftIds:[],createdAt:i}});const unfinished=await svc.recentRequests(d,'1');
 ok('全部失败任务保留，不被最近8条完成任务挤掉',()=>{assert.equal(unfinished.filter(j=>j.id.startsWith('old-failed-')).length,12);assert(unfinished.every(j=>j.charId!=null&&Array.isArray(j.giftIds)))});


 imageURL=true;failDownload=true;await assert.rejects(()=>svc.requestGifts(d,'1','2',{requestId:'download-resume',count:1}));let imageCallsAfterGenerated=hits.image;failDownload=false;await svc.requestGifts(d,'1','2',{requestId:'download-resume',count:1});imageURL=false;
 ok('图片已生成但下载失败：重试只保存原图，不再次付费生图',()=>assert.equal(hits.image,imageCallsAfterGenerated));
 const received=await repo.getGift(d,'1',openedId);await assert.rejects(()=>repo.setGiftFields(d,'1',openedId,{message:'把角色原话改掉'}));
 ok('收礼原贺卡不允许被包装编辑覆盖',()=>assert.equal(d.gifts.rows.get(openedId).message,received.message));
 const sentBefore=await repo.getGift(d,'1',outbound.gift.id);await assert.rejects(()=>repo.setGiftFields(d,'1',outbound.gift.id,{message:'送出后又改掉'}));
 ok('已送出贺卡保持与聊天一致，不可事后改写正文',()=>assert.equal(d.gifts.rows.get(outbound.gift.id).message,sentBefore.message));
 await assert.rejects(()=>repo.saveAnniversary(d,'1',{title:'错误关联',date:'2026-11-03',charId:3,eventType:'custom'}));
 ok('纪念日拒绝关联其他账号的角色',()=>assert(!(Array.from(d.shiliAnniversaries.rows.values()).some(a=>a.title==='错误关联'))));
 enabled=false;await assert.rejects(()=>svc.saveAuto(d,'1',{enabled:true,charIds:['2'],intervalDays:3,count:2,timeMode:'virtual'}));enabled=true;
 ok('虚拟时间未开启时不能误启用虚拟自动送礼',()=>assert.equal(enabled,true));
 const originalCall=context.callAI;let releaseText;const hold=new Promise(r=>releaseText=r);context.callAI=async(...args)=>{await hold;return originalCall(...args)};
 const pendingOne=svc.requestGifts(d,'1','2',{requestId:'concurrent-actor',count:1});await new Promise(r=>setTimeout(r,10));await assert.rejects(()=>svc.requestGifts(d,'1','4',{requestId:'concurrent-actor',count:1}));releaseText();await pendingOne;context.callAI=originalCall;
 const lockedTask=(await d.config.get('shili-request:'+JSON.stringify(['1','concurrent-actor']))).value;
 ok('进行中的同名任务也不能切换角色复用',()=>assert.equal(lockedTask.charId,'2'));


 textFormatReject=true;let beforeTextFormat=hits.text;await svc.requestGifts(d,'1','2',{requestId:'format-text',count:1});textFormatReject=false;
 ok('文本服务明确拒绝JSON格式参数才去参重试，并严格解析方案',()=>assert.equal(hits.text,beforeTextFormat+2));
 const setup=await svc.setupStatus(d);ok('首次使用能分别识别文本与图片接口配置',()=>assert(setup.textReady&&setup.imageReady));
 await d.config.delete('apiKey');const imageBeforeMissing=hits.image;await assert.rejects(()=>svc.requestGifts(d,'1','2',{requestId:'missing-text-api',count:1}),/文本AI未配置/);await d.config.put({key:'apiKey',value:'local-fixture-key'});
 ok('文本未配置不会误调用生图或制造收到的礼物',()=>assert.equal(hits.image,imageBeforeMissing));


 imageURL=true;octetImage=true;const octetTask=await svc.requestGifts(d,'1','2',{requestId:'octet-image',count:1});imageURL=false;octetImage=false;const octetGift=await repo.getGift(d,'1',octetTask.giftIds[0]);ok('图片直链返回通用二进制MIME也按真实文件字节识别保存',()=>assert(octetGift.imageUrl.startsWith('data:image/png;base64,')));
 console.log('RESULT',passed,'passed; local HTTP fixtures + in-memory tables, NOT browser Dexie or external providers.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
