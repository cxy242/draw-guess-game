/* 拾礼第二阶段：原生 DOM 页面，复用小手机的 openPage/closePage */
(function(root){'use strict';
var state={tab:'home',selected:null,view:null,filter:'all',query:''};
var renderVersion=0;
function el(t,c,txt){var n=document.createElement(t);if(c)n.className=c;if(txt!==undefined)n.textContent=String(txt);return n;}
function btn(text,fn,cls){var n=el('button',cls||'shili-btn',text);n.type='button';var owner=String(uid());n.onclick=async function(){if(String(uid())!==owner){alert('账号已切换，请重新打开拾礼');return;}if(n.disabled)return;n.disabled=true;try{await fn();}catch(e){alert(e.message||e);}finally{n.disabled=false;}};return n;}
function icon(kind,cls){var n=el('span',(cls?cls+' ':'')+'shili-icon shili-icon-'+kind);n.setAttribute('aria-hidden','true');for(var i=1;i<=12;i++)n.appendChild(el('i','shili-stroke shili-stroke-'+i));return n;}
function art(name,cls,alt){var n=el('img',cls||'shili-art');n.addEventListener('error',function(){n.hidden=true;});n.src='assets/shili/'+name+'.png';n.alt=alt||'';if(!alt)n.setAttribute('aria-hidden','true');return n;}
function giftDate(g){return new Date(g.timeMode==='virtual'&&Number.isFinite(g.virtualTimestamp)?g.virtualTimestamp:g.realTimestamp);}
function registerGiftLid(stage){var w=stage.clientWidth;if(!w)return;var h=[1.0499537047914775, 0.12973959235239965, -0.03204783947709971, 0.03891193136872545, 0.9854798517491682, -0.04410517166891939, -0.012616987237098363, 0.26744868292339624];var n=stage.querySelector('.shili-lid-registration');n.style.transform='matrix3d('+[h[0],h[3],0,h[6]/w,h[1],h[4],0,h[7]/w,0,0,1,0,h[2]*w,h[5]*w,0,1].join(',')+')';stage.dataset.registered='true';}
function collage(main,view){
 var h=main.querySelector('.shili-page-heading');if(!h||view==='home')return;
 var assets={create:['restored/green-botanical-stamp','green-stamp'],calendar:['reference/floral-stamp-transparent','floral-stamp'],cabinet:['restored/album-award','album-award'],settings:['reference/floral-stamp-transparent','floral-stamp'],opening:['restored/opening-corner-bow','corner-bow']};
 var item=assets[view];if(item){var n=art(item[0],'shili-foreground shili-foreground-'+item[1]);n.dataset.assetId=view+'-'+item[1];h.appendChild(n);}
}

function go(tab){state.tab=tab;state.selected=null;state.view=null;state.filter='all';state.query='';render();}
function uid(){return typeof root.getShiliOwnerUid==='function'?root.getShiliOwnerUid():null;}
function db(){if(!root.db||!root.ShiliRepository)throw Error('礼物数据库尚未准备好');if(!uid())throw Error('当前微信账号未绑定，无法安全读取礼物');return root.db;}
function updateLayout(page){var r=page.getBoundingClientRect(),sx=r.width/390,sy=Math.max(.5,(r.height-84*sx)/782);page.style.setProperty('--shili-nav-height',(page.querySelector('.shili-nav')?.getBoundingClientRect().height||62*sx)+'px');page.style.setProperty('--shili-sx',sx);page.style.setProperty('--shili-sy',sy);var angle=Math.atan2(-84*782*sy/1570,780*r.width/1001)*180/Math.PI;page.style.setProperty('--shili-note-angle',angle.toFixed(2)+'deg');}
function shell(){var old=document.getElementById('shili-page');if(old)old.remove();var page=el('div','full-page shili-page');page.id='shili-page';var h=el('header','shili-header');h.appendChild(btn('‹',function(){if(state.selected){state.view=state.view==='wrapping'?'preview':null;if(!page.dataset.view||page.dataset.view==='detail')state.selected=null;render();return;}if(typeof root.closePage==='function'){try{root.closePage('shili-page');return;}catch(e){}}page.remove();},'shili-back'));h.appendChild(el('span','shili-head-title','拾礼'));page.appendChild(h);var backdrop=el('div','shili-backdrop');backdrop.setAttribute('aria-hidden','true');page.appendChild(backdrop);var main=el('main','shili-main');main.id='shili-content';page.appendChild(main);var nav=el('nav','shili-nav');page.querySelector('.shili-back').setAttribute('aria-label','返回月月小手机');nav.setAttribute('aria-label','拾礼主导航');[['home','首页','nav_home'],['create','送礼','nav_gift'],['calendar','日历','nav_calendar'],['cabinet','珍藏','nav_album'],['settings','设置','nav_settings']].forEach(function(pair){var n=btn('',function(){go(pair[0]);},'shili-nav-item'+(state.tab===pair[0]?' active':''));n.appendChild(icon(pair[0]==='settings'?'gear':pair[0]==='create'?'gift':pair[0]==='cabinet'?'album':pair[0],'shili-nav-icon'));n.appendChild(el('span','',pair[1]));nav.appendChild(n);});page.appendChild(nav);if(typeof root.openPage==='function')root.openPage(page);else document.body.appendChild(page);updateLayout(page);if(root.ResizeObserver){page._shiliLayoutResize=new ResizeObserver(function(){if(!page.isConnected){page._shiliLayoutResize.disconnect();return;}updateLayout(page);});page._shiliLayoutResize.observe(page);}return page;}
function heading(main,sub,title){var h=el('div','shili-page-heading'),script=el('div','shili-script');var lines={'The Little Gift Garden':['The Little','Gift Garden'],'Our Milestones':['Our','Milestones'],'The Keepsake Album':['The Keepsake','Album']}[sub]||[sub];lines.forEach(function(line){script.appendChild(el('span','shili-title-line',line));});h.appendChild(script);h.appendChild(el('h1','',title));main.appendChild(h);}
function notice(main,msg){main.appendChild(el('p','shili-empty',msg));}
function field(form,label,type,required){var wrap=el('label','shili-field');wrap.appendChild(el('span','',label));var input=el(type==='textarea'?'textarea':'input','shili-input');if(type!=='textarea')input.type=type||'text';input.required=!!required;wrap.appendChild(input);form.appendChild(wrap);return input;}
async function render(){
 var version=++renderVersion,owner=String(uid()),page=document.getElementById('shili-page')||shell();
 var target=page.querySelector('#shili-content'),main=el('div');
 page.dataset.view=state.selected?(state.view||'detail'):state.tab;page.querySelector('.shili-back').setAttribute('aria-label',state.selected?'返回上一页':'返回月月小手机');target.replaceChildren();notice(target,'正在整理心意…');
 page.querySelectorAll('.shili-nav-item').forEach(function(n,i){n.classList.toggle('active',['home','create','calendar','cabinet','settings'][i]===state.tab);});
 try{
  if(root.ShiliImage)await root.ShiliImage.recoverExpired(db(),owner);
  if(version!==renderVersion||String(uid())!==owner)return;
  if(state.selected){
   if(state.view==='preview')await preview(main,state.selected);
   else if(state.view==='wrapping')await wrapping(main,state.selected);
   else if(state.view==='opening')await opening(main,state.selected);
   else await detail(main,state.selected);
  }else if(state.tab==='home')await home(main);
  else if(state.tab==='create')await create(main);
  else if(state.tab==='calendar')await calendar(main);
  else if(state.tab==='cabinet')await cabinet(main);
  else await settings(main);
 }catch(e){notice(main,String(e.message||e));}
 if(version!==renderVersion||!page.isConnected)return;
 if(String(uid())!==owner){target.replaceChildren();notice(target,'账号已切换，请重新打开拾礼');return;}
 collage(main,page.dataset.view);var sheet=el('div','shili-sheet');sheet.append(...Array.from(main.childNodes));target.replaceChildren(sheet);updateLayout(page);target.querySelectorAll('.shili-mechanical').forEach(registerGiftLid);if(page._shiliResize)page._shiliResize.disconnect();if(root.ResizeObserver&&target.querySelector('.shili-mechanical')){page._shiliResize=new ResizeObserver(function(){if(!page.isConnected){page._shiliResize.disconnect();return;}target.querySelectorAll('.shili-mechanical').forEach(registerGiftLid);});page._shiliResize.observe(target);}target.scrollTop=0;page.querySelectorAll('.shili-nav-item').forEach(function(n){n.setAttribute('aria-current',n.classList.contains('active')?'page':'false');});
}
async function home(main){
 var hero=el('section','shili-hero');heading(hero,'The Little Gift Garden','拾起每一份心意');hero.appendChild(el('p','shili-subtitle','A sweet journey,\ninto your heart.'));hero.appendChild(art('reference/tulips','shili-home-photo'));hero.appendChild(art('restored/home-curl-ribbon','shili-home-ribbon shili-long-curl'));hero.appendChild(art('restored/home-flower-rose-stamp-v2','shili-home-stamp'));hero.appendChild(art('reference/botanical-transparent','shili-home-sprig'));hero.appendChild(el('span','shili-home-for-you','For You'));hero.appendChild(art('restored/home-postmark','shili-home-postmark'));main.appendChild(hero);
 var shortcuts=el('div','shili-shortcuts');[['create','制作礼物','nav_gift'],['calendar','纪念日','nav_calendar'],['cabinet','珍藏柜','nav_album']].forEach(function(x){var n=btn('',function(){go(x[0]);},'shili-shortcut');n.appendChild(icon(x[0]==='create'?'gift':x[0]==='cabinet'?'album':x[0]));n.appendChild(el('span','',x[1]));shortcuts.appendChild(n);});main.appendChild(shortcuts);
 var g=await root.ShiliRepository.list(db(),String(uid())),confirmed=g.filter(function(x){return x.status==='received';}),pending=g.filter(function(x){return x.status==='pending-review';});
 var summary=el('div','shili-summary');summary.appendChild(el('strong','',confirmed.length+' 份珍藏'));summary.appendChild(el('span','',pending.length+' 份待核实'));summary.appendChild(btn('查看珍藏柜',function(){go('cabinet');},'shili-link'));main.appendChild(summary);
 if(pending.length)main.appendChild(btn('核实剧情礼物',function(){go('cabinet');}));
 var items=await root.ShiliRepository.listAnniversaries(db(),String(uid()));if(items.length){main.appendChild(el('h2','shili-section','值得记住的日子'));items.slice(0,2).forEach(function(a){main.appendChild(btn(a.title+' · '+a.date,function(){go('calendar');},'shili-event-link'));});}
 if(g.length){main.appendChild(el('h2','shili-section','最近的心意'));g.sort(function(a,b){return b.realTimestamp-a.realTimestamp;}).slice(0,2).forEach(function(gift){main.appendChild(btn(gift.name,function(){state.selected=gift.id;state.view=null;render();},'shili-event-link'));});}
}
async function create(main){
 heading(main,'Make a Gift','制作礼物');var scene=el('div','shili-atelier-scene');scene.appendChild(art('reference/atelier-complete','shili-atelier'));scene.appendChild(el('p','shili-atelier-note','A gift\nfor someone\nspecial.'));main.appendChild(scene);var methods=el('div','shili-methods');main.appendChild(methods);
 var d=db(),owner=String(uid()),chats=await d.chats.filter(function(c){return String(c.ownerUid)===owner}).toArray();
 var f=el('form','shili-form'),wrap=el('label','shili-field'),char=el('select','shili-input');
 wrap.appendChild(el('span','','赠送角色'));wrap.appendChild(char);f.appendChild(wrap);char.required=true;
 var empty=el('option','','请选择微信角色');empty.value='';char.appendChild(empty);
 var seen=new Set();
 for(var chat of chats){
  if(seen.has(String(chat.charId)))continue;seen.add(String(chat.charId));
  var character=await d.characters.get(Number(chat.charId)||chat.charId);
  if(!character||['user','online_friend'].includes(character.type))continue;
  var option=el('option','',character.nick||character.name||'未命名角色');option.value=String(chat.charId);char.appendChild(option);
 }
 if(char.options.length===1)notice(main,'还没有可赠礼的角色，请先在微信中建立角色会话。');
 var name=field(f,'礼物名称','text',true),description=field(f,'礼物描述','textarea'),message=field(f,'贺卡祝福','textarea');name.maxLength=80;var photo=field(f,'礼物图片（可选）','file'),imageData='',imageReadPromise=Promise.resolve('');photo.accept='image/png,image/jpeg,image/webp';photo.onchange=async function(){var file=photo.files[0];imageData='';imageReadPromise=Promise.resolve('');if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)){alert('请选择 PNG、JPEG 或 WebP 图片');photo.value='';return;}if(file.size>8*1024*1024){alert('请选择 8 MB 以内的图片');photo.value='';return;}imageReadPromise=new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result)};reader.onerror=reject;reader.readAsDataURL(file)});try{imageData=await imageReadPromise;}catch(e){alert('图片读取失败，请重新选择');photo.value='';imageReadPromise=Promise.resolve('');}};[['AI 生成礼物','根据心意写下内容，再生成礼物图片','nav_gift'],['从相册选择','选一张值得珍藏的照片','nav_album'],['手动制作','自由写下礼物与祝福','nav_calendar']].forEach(function(x,i){var n=btn('',function(){formBox.open=true;(i===1?photo:name).focus();formBox.scrollIntoView({block:'nearest'});},'shili-method');n.appendChild(icon(['flower','photo','bow'][i]));var c=el('span');c.appendChild(el('strong','',x[0]));c.appendChild(el('small','',x[1]));n.appendChild(c);n.appendChild(el('span','shili-chevron','›'));methods.appendChild(n);});var formBox=el('details','shili-fold');formBox.open=false;formBox.appendChild(el('summary','','写下这份心意'));notice(f,'先保存文字礼物；可上传图片，或保存后使用已配置的图片 API 生成。');
 f.appendChild(btn('保存礼物',async function(){
  if(!f.reportValidity())return;
  imageData=await imageReadPromise;
  if(String(uid())!==owner)throw Error('账号已切换，请重新制作礼物');
  var r=await root.ShiliRepository.createGift(d,{ownerUid:owner,charId:char.value,name:name.value.trim(),description:description.value.trim(),message:message.value.trim(),realTimestamp:Date.now(),virtualTimestamp:root.TimeWorld?.isEnabled?.()?root.TimeWorld.getNow():null,timeMode:root.TimeWorld?.isEnabled?.()?'virtual':'real',draft:true,recipientUid:char.value,sourceType:'shili-manual'});
  if(imageData)await root.ShiliRepository.setGiftFields(d,owner,r.gift.id,{imageUrl:imageData,imageStatus:'ready'});
  if(String(uid())!==owner)return;
  state.selected=r.gift.id;state.view='preview';render();
 }));formBox.appendChild(f);main.appendChild(formBox);
}
async function cabinet(main){
 heading(main,'The Keepsake Album','珍藏柜');var owner=String(uid()),drawVersion=0;var gifts=await root.ShiliRepository.list(db(),owner);gifts.sort(function(a,b){return (b.realTimestamp||0)-(a.realTimestamp||0);});
 var filters=el('div','shili-filters');[['all','全部'],['received','收到的'],['sent','送出的'],['unopened','未拆封']].forEach(function(x){var n=btn(x[1],function(){state.filter=x[0];render();},'shili-filter'+(state.filter===x[0]?' active':''));n.setAttribute('aria-pressed',String(state.filter===x[0]));filters.appendChild(n);});var tools=el('div','shili-album-tools');tools.appendChild(filters);main.appendChild(tools);
 var search=el('input','shili-input shili-search');search.type='search';search.placeholder='寻找一份心意…';search.setAttribute('aria-label','搜索礼物');search.value=state.query;tools.appendChild(search);
 var grid=el('div','shili-album');main.appendChild(grid);
 async function draw(){var drawId=++drawVersion;if(String(uid())!==owner)return;grid.replaceChildren();var rows=gifts.filter(function(g){return (state.filter==='all'||g.status===state.filter||(state.filter==='unopened'&&g.status==='received'&&!g.openedAt))&&(!state.query||(g.name+' '+g.description+' '+g.message).toLowerCase().includes(state.query.toLowerCase()));});if(!rows.length){notice(grid,'这里还没有这类心意。每一份礼物，都会在这里被好好收藏。');return;}for(var g of rows){var item=btn('',(function(id){return function(){state.selected=id;state.view=null;render();};})(g.id),'shili-album-item');item.style.setProperty('--shili-order',Math.min(grid.children.length,8));var mat=el('div','shili-album-photo');if(g.imageUrl){var img=el('img');img.src=g.imageUrl;img.alt=g.name;mat.appendChild(img);}else{mat.appendChild(icon('gift'));mat.appendChild(el('span','','文字礼物'));}item.appendChild(mat);var char=await db().characters.get(Number(g.charId)||g.charId);if(String(uid())!==owner||drawId!==drawVersion)return;item.appendChild(el('strong','',g.name));item.appendChild(el('small','',(g.characterDeleted?'已删除角色':char?.nick||char?.name||'角色 '+g.charId)+' · '+(g.status==='received'?(g.openedAt?'已收藏':'待拆封'):g.status==='sent'?'已送出':g.status==='draft'?'草稿':'待核实')));item.appendChild(el('time','',giftDate(g).toLocaleDateString('zh-CN')+(g.timeMode==='virtual'?' · 剧情':'')));grid.appendChild(item);}}
 search.oninput=function(){state.query=search.value;draw();};await draw();
}
async function detail(main,id){
 var owner=String(uid()),g=await root.ShiliRepository.getGift(db(),owner,id);
 if(!g)throw Error('礼物不存在');
 heading(main,'A Gift For You',g.name);
 if(g.imageUrl){var photo=el('figure','shili-detail-photo'),img=el('img','shili-preview');img.src=g.imageUrl;img.alt=g.name;photo.appendChild(img);main.appendChild(photo);}
 else main.appendChild(el('div','shili-placeholder shili-detail-letter','文字礼物'));
 main.appendChild(el('p','shili-description',g.description||'暂无礼物描述'));
 main.appendChild(el('blockquote','shili-card',g.message||'愿这份心意被好好收藏。'));
 var actor=g.characterDeleted?null:await db().characters.get(Number(g.charId)||g.charId);main.appendChild(el('p','shili-meta','赠送角色：'+(g.characterDeleted?'已删除角色':actor?.nick||actor?.name||'未命名角色')+' · '+giftDate(g).toLocaleString('zh-CN')+(g.timeMode==='virtual'?'（剧情时间）':'（现实时间）')));if(g.status==='draft')main.appendChild(btn('预览与包装',function(){state.view='preview';render();}));
 if(g.status==='draft')main.appendChild(btn('送到原微信会话',async function(){try{await root.ShiliBridge.sendToCharacter(db(),String(uid()),g.id);render();}catch(e){alert(e.message||e);}}));
 else if(g.status==='pending-review')main.appendChild(btn('确认剧情中已收到这份礼物',async function(){try{await root.ShiliBridge.confirmGift(db(),String(uid()),g.id);render();}catch(e){alert(e.message||e);}}));
 else if(g.status==='sent')main.appendChild(el('p','shili-meta','已送到原微信会话'));
 else if(g.status==='received'){
  if(!g.openedAt)main.appendChild(btn('拆开并收藏',function(){state.view='opening';render();}));
  else{main.appendChild(el('p','shili-meta','已拆封'));main.appendChild(btn('重看拆封动画',function(){state.view='opening';render();},'shili-link'));}main.appendChild(btn('查看贺卡',function(){state.view='preview';render();},'shili-link'));
 }
 if(['received','draft','sent'].includes(g.status)&&!g.imageUrl){
  var configured=await root.ShiliImage.isConfigured(db());
  if(String(uid())!==owner)return;
  if(!configured)main.appendChild(el('p','shili-meta','未配置图片 API，当前是完整的文字礼物。可在拾礼设置中配置后补生成。'));
  else if(g.imageStatus==='running'){main.appendChild(el('p','shili-meta','图片正在生成，最多等待 2 分钟。'));main.appendChild(btn('刷新生成状态',function(){render();}));}
  else{
   if(g.imageStatus==='failed')main.appendChild(el('p','shili-meta','图片生成失败，文字礼物已保留。'));
   main.appendChild(btn(g.imageStatus==='failed'?'重新生成图片':'生成礼物图片',async function(){
    try{await root.ShiliImage.generate(db(),String(uid()),g.id);render();}
    catch(e){alert(e.message||e);render();}
   }));
  }
 }
 var actionButtons=Array.from(main.children).filter(function(n){return n.tagName==='BUTTON';});if(actionButtons.length){var actions=el('div','shili-detail-actions');actionButtons.forEach(function(n){actions.appendChild(n);});main.appendChild(actions);}
}
function cardSalutation(name,cls){var n=el('div',cls||'shili-note-salutation');n.appendChild(el('span','shili-to-prefix','To:'));n.appendChild(el('span','shili-to-name',name));return n;}
async function preview(main,id){
 var g=await root.ShiliRepository.getGift(db(),String(uid()),id);if(!g)throw Error('礼物不存在');
 var recipient=await root.ShiliRepository.getCardRecipient(db(),String(uid()),id);heading(main,'Gift Preview','礼物预览');main.classList.add('shili-preview-page');
 var artwork=el('div','shili-preview-artwork'),photo=el('figure','shili-preview-photo');artwork.appendChild(photo);main.appendChild(artwork);
 if(g.imageUrl){var img=el('img','shili-preview shili-preview-image');img.src=g.imageUrl;img.alt=g.name;photo.appendChild(img);}
 else photo.appendChild(el('div','shili-preview-text-gift','一份写下来的心意'));
 var note=el('article','shili-preview-note'),copy=el('div','shili-note-content');note.setAttribute('aria-label','礼物贺卡');
 copy.appendChild(cardSalutation(recipient.name));copy.appendChild(el('p','shili-note-title','这份「'+g.name+'」，送给你。'));
 copy.appendChild(el('blockquote','shili-note-message',g.message||g.description||'愿这份心意被好好收藏。'));note.appendChild(copy);
 var when=giftDate(g),date=el('time','shili-note-date');
 if(Number.isFinite(when.getTime())){date.dateTime=when.toISOString();date.textContent=when.getFullYear()+'.'+String(when.getMonth()+1).padStart(2,'0')+'.'+String(when.getDate()).padStart(2,'0');note.appendChild(date);}
 main.appendChild(note);
 var previewActions=el('div','shili-preview-actions');main.appendChild(previewActions);
 if(g.status==='draft')previewActions.appendChild(btn('确认发送到微信',async function(){await root.ShiliBridge.sendToCharacter(db(),String(uid()),g.id);state.view=null;render();}));
 previewActions.appendChild(btn('下一步：包装贺卡',function(){state.view='wrapping';render();}));
 var details=el('div','shili-preview-details');details.appendChild(el('p','shili-meta','包装：'+({pink:'柔粉丝带',sage:'鼠尾草绿丝带',blue:'浅蓝信笺'}[g.wrapped]||'尚未选择')));
 details.appendChild(btn('查看图片与详情',function(){state.view=null;render();},'shili-link'));main.appendChild(details);var edit=el('details','shili-fold shili-address-editor');edit.appendChild(el('summary','','修改贺卡称呼'));var form=el('form','shili-form'),address=field(form,'贺卡称呼','text',true);address.maxLength=32;address.value=recipient.name;address.placeholder='写上你们平常对彼此的称呼';form.appendChild(btn('从角色档案重新读取',async function(){await root.ShiliRepository.setGiftFields(db(),String(uid()),id,{cardToName:''});await root.ShiliRepository.getCardRecipient(db(),String(uid()),id,{forcePersona:true});render();},'shili-link'));form.appendChild(btn('保存称呼',async function(){if(!form.reportValidity())return;await root.ShiliRepository.setGiftFields(db(),String(uid()),id,{cardToName:address.value});render();}));edit.appendChild(form);main.appendChild(edit);
}
async function wrapping(main,id){
 var owner=String(uid()),g=await root.ShiliRepository.getGift(db(),owner,id);if(!g)throw Error('礼物不存在');
 var recipient=await root.ShiliRepository.getCardRecipient(db(),owner,id);heading(main,'Gift Wrapping','包装贺卡');main.appendChild(art('reference/wrapped-gift-transparent','shili-wrapped-art'));var swatches=el('div','shili-swatches');main.appendChild(swatches);
 var card=el('article','shili-wrapping-card');card.setAttribute('aria-label','贺卡排版预览');var cardCopy=el('div','shili-wrapping-copy');cardCopy.appendChild(cardSalutation(recipient.name,'shili-note-salutation shili-wrap-salutation'));cardCopy.appendChild(el('h2','','这份「'+g.name+'」，送给你。'));cardCopy.appendChild(el('p','',g.message||'愿这份心意被好好收藏。'));card.appendChild(cardCopy);main.appendChild(card);
 var cards=el('div','shili-card-choices'),cardStyle=g.cardStyle||'floral';main.insertBefore(cards,card);[['floral','花笺贺卡'],['rose','玫瑰贺卡'],['script','手写贺卡']].forEach(function(x){var n=btn('',function(){cardStyle=x[0];updateCard();},'shili-card-choice shili-card-choice-'+x[0]);n.setAttribute('aria-label',x[1]);n.dataset.style=x[0];var sample=el('span','shili-card-sample shili-card-sample-'+x[0]);if(x[0]==='script')sample.appendChild(el('span','','For\nYou'));n.appendChild(sample);n.appendChild(el('span','shili-card-caption',x[1]));cards.appendChild(n);});var form=el('form','shili-form'),address=field(form,'贺卡称呼','text',true),message=field(form,'贺卡文字','textarea');address.maxLength=32;address.value=recipient.name;address.placeholder='写上你们平常对彼此的称呼';message.value=g.message||'';
 var picker=el('select','shili-input');[['pink','柔粉丝带'],['sage','鼠尾草绿丝带'],['blue','浅蓝信笺']].forEach(function(x){var o=el('option','',x[1]);o.value=x[0];picker.appendChild(o)});picker.value=g.wrapped||'pink';
 [['pink','柔粉丝带'],['sage','鼠尾草绿丝带'],['blue','浅蓝信笺']].forEach(function(x){var n=btn(x[1],function(){picker.value=x[0];updateCard();},'shili-swatch shili-swatch-'+x[0]);n.dataset.value=x[0];swatches.appendChild(n);});function updateCard(){card.querySelector('.shili-to-name').textContent=address.value.trim()||recipient.name;card.dataset.style=cardStyle;cards.querySelectorAll('button').forEach(function(n){n.setAttribute('aria-pressed',String(n.dataset.style===cardStyle));});card.dataset.wrap=picker.value;card.querySelector('p').textContent=message.value||'愿这份心意被好好收藏。';swatches.querySelectorAll('button').forEach(function(n){n.setAttribute('aria-pressed',String(n.dataset.value===picker.value));});}address.oninput=updateCard;message.oninput=updateCard;picker.onchange=updateCard;updateCard();
 var wrap=el('label','shili-field');wrap.appendChild(el('span','','包装样式'));wrap.appendChild(picker);form.appendChild(wrap);
 var editFold=el('details','shili-fold');editFold.appendChild(el('summary','','编辑贺卡与包装'));editFold.appendChild(form);main.appendChild(editFold);main.appendChild(btn('保存包装与贺卡',async function(){if(!form.reportValidity())return;try{await root.ShiliRepository.setGiftFields(db(),owner,id,Object.assign({message:message.value,wrapped:picker.value,cardStyle:cardStyle},address.value!==recipient.name?{cardToName:address.value}:{}));state.view=null;render()}catch(e){alert(e.message||e)}}));
}
async function opening(main,id){
 var owner=String(uid()),g=await root.ShiliRepository.getGift(db(),owner,id);
 if(!g||g.status!=='received')throw Error('礼物不存在或尚未确认');
 heading(main,'Open the Gift','拆开礼物');
 var stage=el('div','shili-opening-stage shili-mechanical'+(g.openedAt?' is-open':''));
 var glow=el('i','shili-gift-glow');glow.setAttribute('aria-hidden','true');stage.appendChild(glow);
 var shadow=el('i','shili-gift-shadow');shadow.setAttribute('aria-hidden','true');stage.appendChild(shadow);
 stage.appendChild(art('reference/gift-layer-body','shili-body-layer'));
 var left=el('i','shili-tissue shili-tissue-left'),right=el('i','shili-tissue shili-tissue-right');left.setAttribute('aria-hidden','true');right.setAttribute('aria-hidden','true');stage.appendChild(left);stage.appendChild(right);
 var lid=el('div','shili-lid-layer');lid.setAttribute('aria-hidden','true');lid.appendChild(art('reference/gift-layer-lid','shili-lid-registration'));stage.appendChild(lid);
 stage.appendChild(icon('ribbon','shili-gift-bow'));
 for(var i=0;i<16;i++){var piece=el('i','shili-confetti');piece.setAttribute('aria-hidden','true');piece.style.setProperty('--piece',i);piece.style.setProperty('--drift',((i%2?-1:1)*(28+(i*29)%125))+'px');piece.style.setProperty('--spin',(i%2?1:-1)*(150+i*23)+'deg');stage.appendChild(piece);}
 if(g.imageUrl){var reveal=el('img','shili-revealed-gift');reveal.src=g.imageUrl;reveal.alt=g.name;stage.appendChild(reveal);}
 else{var letter=el('div','shili-revealed-gift shili-revealed-letter');letter.appendChild(el('span','',g.message||g.name));stage.appendChild(letter);}
 stage.appendChild(el('strong','',g.name));main.appendChild(stage);
 var live=el('p','shili-unwrapping-status',g.openedAt?'已拆封，心意已好好珍藏。':'一份心意，等待你轻轻打开。');live.setAttribute('role','status');live.setAttribute('aria-live','polite');main.appendChild(live);
 async function play(){var version=renderVersion;if(String(uid())!==owner||!stage.isConnected)return;stage.classList.remove('is-open');stage.setAttribute('aria-busy','true');live.textContent='解开丝带，翻起盒盖，慢慢展开这份心意…';stage.classList.add('is-unwrapping');if(!root.matchMedia('(prefers-reduced-motion: reduce)').matches)await new Promise(function(resolve){setTimeout(resolve,3900);});if(String(uid())!==owner||version!==renderVersion||!stage.isConnected)return;state.view='opening';render();}
 main.appendChild(btn(g.openedAt?'查看珍藏':'拆开礼物',async function(){
  if(g.openedAt){state.view=null;render();return;}
  await root.ShiliRepository.setGiftFields(db(),owner,id,{openedAt:Date.now()});
  await play();
 }));
 if(g.openedAt)main.appendChild(btn('再看一次拆封动画',play,'shili-link'));
}
async function calendar(main){
 heading(main,'Our Milestones','纪念日');
 var d=db(),owner=String(uid()),items=await root.ShiliRepository.listAnniversaries(d,owner);
 var now={realNow:Date.now(),virtualNow:root.TimeWorld?.getNow?.()??Date.now(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone};
 var today=root.ShiliPlanner.today(items,now);if(today.length){
  var names=today.map(function(x){var found=items.find(function(a){return a.id===x.id});return found?.title||'纪念日'});
  var todayNote=el('p','shili-empty shili-today-note','今天的纪念日：'+names.join('、')+'。请在原微信会话中决定如何庆祝。');
 }
 var calendarFilter='all',filterBar=el('div','shili-filters');[['all','全部'],['upcoming','即将到来'],['past','已完成']].forEach(function(x){var b=btn(x[1],function(){calendarFilter=x[0];filterBar.querySelectorAll('button').forEach(function(n){n.classList.toggle('active',n===b);n.setAttribute('aria-pressed',String(n===b));});eventList.querySelectorAll('[data-past]').forEach(function(n){n.hidden=calendarFilter==='upcoming'?!(Number(n.dataset.days)>=0&&Number(n.dataset.days)<=30):calendarFilter==='past'&&n.dataset.past!=='true';});},'shili-filter'+(x[0]==='all'?' active':''));b.setAttribute('aria-pressed',String(x[0]==='all'));filterBar.appendChild(b);});var toolbar=el('div','shili-calendar-toolbar');toolbar.appendChild(filterBar);var monthMode=false,modeButton=btn('查看月历',function(){monthMode=!monthMode;month.hidden=!monthMode;eventList.hidden=monthMode;filterBar.hidden=monthMode;if(todayNote)todayNote.hidden=monthMode;modeButton.textContent=monthMode?'返回纪念日':'查看月历';modeButton.setAttribute('aria-expanded',String(monthMode));},'shili-calendar-mode');modeButton.setAttribute('aria-expanded','false');toolbar.appendChild(modeButton);main.appendChild(toolbar);
 var month=el('section','shili-fold shili-calendar-month');month.hidden=true;var clock=el('select','shili-input');clock.setAttribute('aria-label','月历时间体系');[['real','现实时间'],['virtual','虚拟时间']].forEach(function(x){var o=el('option','',x[1]);o.value=x[0];clock.appendChild(o);});month.appendChild(clock);var monthGrid=el('div','shili-month-grid');month.appendChild(monthGrid);var monthOffset=0,selectedDay=null;var dayDetail=el('div','shili-day-detail');dayDetail.setAttribute('aria-live','polite');month.appendChild(dayDetail);var monthNav=el('div','shili-month-nav');monthNav.appendChild(btn('‹ 上月',function(){monthOffset--;drawMonth();},'shili-link'));var monthTitle=el('strong');monthNav.appendChild(monthTitle);monthNav.appendChild(btn('下月 ›',function(){monthOffset++;drawMonth();},'shili-link'));month.insertBefore(monthNav,monthGrid);function eventsFor(key){return items.filter(function(a){return a.enabled!==false&&a.timeMode===clock.value&&(a.date===key||(a.recurring&&(a.date.slice(5)===key.slice(5)||(a.date.slice(5)==='02-29'&&key.slice(5)==='02-28'&&!root.ShiliPlanner.validDate(key.slice(0,4)+'-02-29')))));});}
 function chooseDay(key){selectedDay=key;monthGrid.querySelectorAll('.shili-day').forEach(function(n){n.setAttribute('aria-pressed',String(n.dataset.date===key));});dayDetail.replaceChildren();dayDetail.appendChild(el('strong','',key+' 的纪念日'));var rows=eventsFor(key);if(!rows.length)dayDetail.appendChild(el('p','','这一天还没有纪念日。'));rows.forEach(function(a){var row=el('p','shili-day-event');row.appendChild(el('span','',a.title));row.appendChild(el('small','',a.recurring?'每年重复':'仅这一次'));dayDetail.appendChild(row);});}
 function drawMonth(){monthGrid.replaceChildren();var base=new Date(clock.value==='virtual'?now.virtualNow:now.realNow),date=new Date(base.getFullYear(),base.getMonth()+monthOffset,1),year=date.getFullYear(),m=date.getMonth();monthTitle.textContent=year+'年'+(m+1)+'月';'一二三四五六日'.split('').forEach(function(x){monthGrid.appendChild(el('span','shili-weekday',x));});for(var i=0;i<(date.getDay()+6)%7;i++)monthGrid.appendChild(el('span'));for(var day=1;day<=new Date(year,m+1,0).getDate();day++){var key=year+'-'+String(m+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'),events=eventsFor(key),cell=btn(day,(function(k){return function(){chooseDay(k);};})(key),'shili-day'+(events.length?' has-event':''));cell.dataset.date=key;cell.setAttribute('aria-label',key+(events.length?'，'+events.length+'个纪念日':''));if(events.length)cell.title=events.map(function(a){return a.title;}).join('、');if(year===base.getFullYear()&&m===base.getMonth()&&day===base.getDate())cell.classList.add('today');monthGrid.appendChild(cell);}var prefix=year+'-'+String(m+1).padStart(2,'0')+'-';chooseDay(selectedDay&&selectedDay.startsWith(prefix)?selectedDay:prefix+String(monthOffset===0?base.getDate():1).padStart(2,'0'));}clock.onchange=function(){monthOffset=0;selectedDay=null;drawMonth();};drawMonth();
 var eventList=el('div','shili-event-list');main.appendChild(eventList);var fold=el('details','shili-fold');fold.appendChild(el('summary','','＋ 添加纪念日'));
 var editingId=null,existingCover='';var f=el('form','shili-form'),title=field(f,'纪念日名称','text',true),date=field(f,'日期','date',true),roleWrap=el('label','shili-field'),charId=el('select','shili-input');charId.setAttribute('aria-label','关联人物');roleWrap.appendChild(el('span','','关联人物'));roleWrap.appendChild(charId);f.appendChild(roleWrap);var unlinked=el('option','','仅自己记录（不关联角色）');unlinked.value='';charId.appendChild(unlinked);var roleRows=await root.ShiliIntegration.listCharacters(d),roleNames=new Map();roleRows.forEach(function(c){var label=c.nick&&c.nick!==c.name?c.nick+'（'+c.name+'）':c.name||c.nick||'未命名角色',o=el('option','',label);o.value=String(c.id);charId.appendChild(o);roleNames.set(String(c.id),label);});notice(f,'关联人物来自角色档案。到了该日期，这位角色在生成内容前会读取当天纪念日；不关联则只作为自己的记录。');
 var mode=el('select','shili-input');[['real','现实时间'],['virtual','虚拟时间']].forEach(function(a){var o=el('option','',a[1]);o.value=a[0];mode.appendChild(o)});
 var l=el('label','shili-field');l.appendChild(el('span','','时间体系'));l.appendChild(mode);f.appendChild(l);
 var annual=field(f,'每年重复','checkbox');annual.classList.add('shili-checkbox');var cover=field(f,'纪念日封面（可选）','file'),coverRead=Promise.resolve('');cover.accept='image/png,image/jpeg,image/webp';cover.onchange=function(){var file=cover.files[0];coverRead=Promise.resolve('');if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024){alert('请选择8 MB以内的PNG、JPEG或WebP图片');cover.value='';return;}coverRead=new Promise(function(resolve,reject){var reader=new FileReader();reader.onload=function(){resolve(reader.result);};reader.onerror=function(){reject(Error('封面读取失败，请重新选择'));};reader.readAsDataURL(file);});};
 var saveEventButton=btn('保存纪念日',async function(){if(!f.reportValidity())return;if(!title.value.trim()){title.setCustomValidity('请填写纪念日名称');title.reportValidity();return;}try{var coverData=await coverRead;if(String(uid())!==owner)throw Error('账号已切换，请重新添加纪念日');await root.ShiliRepository.saveAnniversary(d,owner,{id:editingId,title:title.value.trim(),date:date.value,timeMode:mode.value,charId:charId.value.trim(),recurring:annual.checked,coverUrl:coverData||existingCover});render()}catch(e){alert(e.message||e)}});f.appendChild(saveEventButton);var cancelEdit=btn('取消编辑',function(){editingId=null;existingCover='';f.reset();saveEventButton.textContent='保存纪念日';cancelEdit.hidden=true;});cancelEdit.hidden=true;f.appendChild(cancelEdit);title.oninput=function(){title.setCustomValidity('');};fold.appendChild(f);main.appendChild(fold);
 if(!items.length)notice(eventList,'将值得纪念的日子，轻轻记在这里。');
 items.forEach(function(a){var r=el('div','shili-gift'),badge=el('div','shili-date-badge');badge.appendChild(el('strong','',a.date.slice(8)));badge.appendChild(el('small','',a.date.slice(5,7)+'月'));if(a.coverUrl){var coverImg=el('img','shili-event-cover');coverImg.src=a.coverUrl;coverImg.alt=a.title;coverImg.onerror=function(){this.replaceWith(badge);};r.appendChild(coverImg);}else r.appendChild(badge);var at=a.timeMode==='virtual'?now.virtualNow:now.realNow;var dayKey=root.ShiliPlanner.calendarDate(at,a.timeZone||now.timeZone);r.dataset.past=String(!a.recurring&&a.date<dayKey);var occurrence=root.ShiliPlanner.occurrence(a,Date.parse(dayKey+'T12:00:00Z')),days=Math.round((occurrence-Date.parse(dayKey+'T00:00:00Z'))/86400000);r.dataset.days=days;var c=el('div','shili-gift-content');c.appendChild(el('strong','',a.title));var dateLine=el('small','',a.date+' '),countdown=el('em','shili-countdown',days===0?'（今天）':days>0?'（'+days+'天后）':'（已过'+Math.abs(days)+'天）');dateLine.appendChild(countdown);c.appendChild(dateLine);if(a.charId)c.appendChild(el('small','',a.characterDeleted?'关联角色已删除，已停用':'关联：'+(roleNames.get(String(a.charId))||'原关联角色已失效')));r.appendChild(c);
 r.appendChild(btn('编辑',function(){editingId=a.id;existingCover=a.coverUrl||'';title.value=a.title;date.value=a.date;mode.value=a.timeMode;annual.checked=!!a.recurring;charId.value=roleNames.has(String(a.charId))?String(a.charId):'';saveEventButton.textContent='保存修改';cancelEdit.hidden=false;fold.open=true;fold.scrollIntoView({block:'nearest'});},'shili-link'));
 r.appendChild(btn('删除',async function(){if(confirm('删除这条纪念日？')){await root.ShiliRepository.deleteAnniversary(d,owner,a.id);render()}},'shili-link'));eventList.appendChild(r)});Array.from(eventList.querySelectorAll('[data-days]')).sort(function(a,b){var x=Number(a.dataset.days),y=Number(b.dataset.days);return (x<0)-(y<0)||(x<0?y-x:x-y);}).forEach(function(n){eventList.appendChild(n);});main.insertBefore(month,eventList);if(todayNote)main.insertBefore(todayNote,toolbar);
}
async function settings(main){
 heading(main,'Settings','设置');
 var owner=String(uid()),d=db(),current=typeof root.loadImageGenConfig==='function'?await root.loadImageGenConfig(true):{url:'',key:'',model:'',size:'1024x1024'};
 if(String(uid())!==owner)return;
 [['角色管理','nav_gift',function(){if(typeof root.showCharacterPage==='function'){root.closePage('shili-page');root.showCharacterPage();}}],['纪念日管理','nav_calendar',function(){go('calendar');}]].forEach(function(x){var n=btn('',x[2],'shili-settings-row');n.appendChild(icon(x[0]==='角色管理'?'gift':'heart-calendar'));n.appendChild(el('span','',x[0]));n.appendChild(el('span','shili-chevron','›'));main.appendChild(n);});
 var apiSection=el('details','shili-settings-group');var apiTitle=el('summary');apiTitle.appendChild(icon('gift'));apiTitle.appendChild(el('span','','礼物图片 API'));apiSection.appendChild(apiTitle);main.appendChild(apiSection);var settingsMain=main;main=apiSection;
 notice(main,'与月月小手机的 IMAGE 设置共用。只填写文字时无需配置；API Key 仅保存在本机设置中。');
 notice(main,'内置礼物画风：ins 风为主，加一点复古感。柔和自然光、真实材质与讲究的构图，保留礼物本身的颜色，避免塑料质感和夸张的 AI 光效。');
 if(root.ShiliImage?.NEGATIVE_GROUPS){var styleGuide=el('details','shili-style-guide');styleGuide.appendChild(el('summary','','内置画风与反向提示词'));var styleList=el('ul');root.ShiliImage.NEGATIVE_GROUPS.forEach(function(g){var li=el('li');li.appendChild(el('strong','',g.label+'：'));li.appendChild(el('span','',g.text));styleList.appendChild(li);});styleGuide.appendChild(styleList);main.appendChild(styleGuide);}
 var f=el('form','shili-form');
 var url=field(f,'图片 API 地址','url',true),key=field(f,'API Key（留空则保持原值）','password'),model=field(f,'图片模型','text',true),size=field(f,'图片尺寸','text',true);
 url.value=current.url||'';model.value=current.model||'';size.value=current.size||'1024x1024';key.autocomplete='new-password';
 key.placeholder=current.key?'已配置，留空保持原值':'尚未配置';
 f.appendChild(btn('保存图片 API',async function(){try{
  var next={url:url.value.trim().replace(/\/+$/,''),key:key.value.trim()||current.key||'',model:model.value.trim(),size:size.value.trim()};
  if(!next.url||!next.key||!next.model||!next.size)throw Error('请填写图片 API 地址、Key、模型和尺寸');
  if(!/^https:\/\//i.test(next.url)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(next.url))throw Error('图片 API 地址需使用 HTTPS');
  if(String(uid())!==owner)throw Error('账号已切换，请重新打开设置');
  await d.transaction('rw',d.config,async function(){await d.config.bulkPut([
   {key:'imageGenApiUrl',value:next.url},{key:'imageGenApiKey',value:next.key},
   {key:'imageGenModel',value:next.model},{key:'imageGenSize',value:next.size}
  ]);});
  root._imageGenConfigCache=null;current=next;key.value='';key.placeholder='已配置，留空保持原值';
  alert('图片 API 已保存');
 }catch(e){alert(e.message||e);}}));
 main.appendChild(f);main=settingsMain;var backupSection=el('details','shili-settings-group');var backupTitle=el('summary');backupTitle.appendChild(icon('sync'));backupTitle.appendChild(el('span','','数据备份与恢复'));backupSection.appendChild(backupTitle);main.appendChild(backupSection);main=backupSection;

 notice(main,'导出当前微信账号的礼物与纪念日。恢复时合并新记录，已有礼物保持不变；关联聊天需要先恢复原小手机备份。');
 main.appendChild(btn('导出拾礼备份',async function(){try{
  var data=await root.ShiliPortable.exportOwner(db(),String(uid()));var url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
  var a=el('a');a.href=url;a.download='shili-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(function(){URL.revokeObjectURL(url)},1000);
 }catch(e){alert(e.message||e);}}));
 var file=el('input','shili-input');file.type='file';file.accept='.json,application/json';file.setAttribute('aria-label','选择拾礼备份');
 file.onchange=async function(){try{
  var owner=String(uid()),d=db(),selected=file.files[0];if(!selected)return;
  if(selected.size>32*1024*1024)throw Error('此入口支持 32 MB 以内备份，大文件恢复尚未支持');
  var data=JSON.parse(await selected.text());root.ShiliPortable.validate(data,owner);
  if(!confirm('将合并 '+data.tables.gifts.length+' 份礼物。已有记录不会被覆盖，是否恢复？'))return;
  if(String(uid())!==owner)throw Error('账号已切换，请重新选择备份');
  var result=await root.ShiliPortable.importOwner(d,owner,data,{confirmed:true});alert('已恢复 '+result.added+' 份，保留已有 '+result.skipped+' 份');
 }catch(e){alert(e.message||e);}finally{file.value='';}};
 main.appendChild(file);main=settingsMain;var scanSection=el('details','shili-settings-group');var scanTitle=el('summary');scanTitle.appendChild(icon('clock'));scanTitle.appendChild(el('span','','剧情礼物与聊天补扫'));scanSection.appendChild(scanTitle);main.appendChild(scanSection);main=scanSection;
 var scanStatus=el('p','shili-meta');scanStatus.setAttribute('role','status');main.appendChild(scanStatus);
 main.appendChild(btn('补扫聊天与线下礼物',async function(){
  var cursor=null,total=0,created=0,errors=0,r;
  do{
   if(String(uid())!==owner)throw Error('账号已切换，补扫已停止');
   r=await root.ShiliBridge.scanAll(d,owner,200,cursor);cursor=r.cursor;
   total+=r.scanned;created+=r.created;errors+=r.errors.length;
   scanStatus.textContent='已扫描 '+total+' 条，新增 '+created+' 份礼物记录，异常 '+errors+' 条';
   if(r.hasMore)await new Promise(function(resolve){setTimeout(resolve,0)});
  }while(r.hasMore);
  scanStatus.textContent+='。扫描完成。';
 }));
 main=settingsMain;var about=el('details','shili-settings-group');var aboutTitle=el('summary');aboutTitle.appendChild(icon('info'));aboutTitle.appendChild(el('span','','关于拾礼'));about.appendChild(aboutTitle);notice(about,'把每一份心意，收藏成日子的纪念。礼物数据按当前微信账号隔离，图片沿用月月小手机设置。');main.appendChild(about);var help=el('details','shili-settings-group');var helpTitle=el('summary');helpTitle.appendChild(icon('help'));helpTitle.appendChild(el('span','','帮助与使用'));help.appendChild(helpTitle);notice(help,'送礼：选择角色并保存礼物，再预览、包装和确认发送。收到的礼物可从微信卡片或珍藏柜拆开。图片生成失败时文字礼物仍保留，可重试。');main.appendChild(help);
 var storage=el('details','shili-settings-group');var storageTitle=el('summary');storageTitle.appendChild(icon('person'));storageTitle.appendChild(el('span','','我的珍藏记录'));storage.appendChild(storageTitle);var gifts=await root.ShiliRepository.list(d,owner);notice(storage,gifts.length+' 份礼物，'+gifts.filter(function(g){return g.status==='received'&&!g.openedAt}).length+' 份等待拆封。');storage.appendChild(btn('打开珍藏柜',function(){go('cabinet');}));main.appendChild(storage);
}
root.showShiliPage=function(){state.tab='home';state.selected=null;state.view=null;shell();render();};
root.addEventListener('shili:gift-updated',function(e){if(String(uid())!==String(e.detail?.ownerUid)||!document.getElementById('shili-page'))return;if((!state.selected&&['home','cabinet'].includes(state.tab))||(String(state.selected)===String(e.detail.giftId)&&!state.view))render();});
root.ShiliUI={openGift:function(id){state.tab='cabinet';state.selected=id;state.view=null;shell();render();}};
})(window);
