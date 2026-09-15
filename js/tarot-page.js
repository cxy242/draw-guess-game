// tarot-page.js — 月月机 塔罗占卜 (full rewrite)
;(function() {
'use strict'

/* ===================================================================
   CARD DATA — 78 cards with full meanings
   =================================================================== */
var MAJOR = [
{id:'M00',zh:'愚者',en:'The Fool',k_up:'新的开始 / 纯真 / 冒险精神',k_rev:'鲁莽 / 欠考虑 / 恐惧改变',
up:'愚者象征着全新旅程的开始。他带着纯真的心踏上未知之路，不被过去束缚，不为未来忧虑。这张牌鼓励你信任生命的流动，以开放的心态迎接新的可能性。',
rev:'逆位的愚者提醒你审视当下的决定是否过于草率。可能你在回避必要的准备，或者对风险视而不见。出发之前请确认行囊中装满了智慧与清醒。',
sym:'年轻人站在悬崖边，手持白玫瑰，身旁有小狗，头顶是明亮的太阳。',astro:'天王星'},
{id:'M01',zh:'魔术师',en:'The Magician',k_up:'显化 / 意志力 / 资源齐备',k_rev:'操纵 / 才能误用 / 意志涣散',
up:'魔术师代表着将意念化为现实的力量。四元素的象征齐聚桌前，说明你已拥有达成目标所需的一切资源。此刻是行动的时机，用清晰的意图和坚定的意志去创造你想要的结果。',
rev:'逆位暗示才华可能被误用，或你在用花言巧语掩盖真相。也可能你有足够的能力却迟迟无法集中精力去运用。警惕身边可能存在的欺骗。',
sym:'红白长袍的人一手举 Wand 指天，一手指地，桌上有四元素器具，头顶无限符号。',astro:'水星'},
{id:'M02',zh:'女祭司',en:'The High Priestess',k_up:'直觉 / 潜意识 / 内在智慧',k_rev:'忽视直觉 / 隐秘泄露',
up:'女祭司端坐在明暗两柱之间，守护着深层的智慧与秘密。她邀请你暂时放下理性分析，去倾听内心深处的声音。答案不在外面，而在你自己的内在。',
rev:'逆位提示你可能正在忽视自己的直觉。外在的喧嚣淹没了内心的声音。也可能有隐藏的信息即将浮出水面。',
sym:'庄严女性坐在黑白两柱之间，膝上放卷轴，头顶新月，身后帷幕。',astro:'月亮'},
{id:'M03',zh:'皇后',en:'The Empress',k_up:'丰盛 / 滋养 / 感官之美 / 生育',k_rev:'依赖 / 过度保护 / 创造力阻塞',
up:'皇后是大地之母的化身，象征着丰饶、美丽和生命的创造力。她提醒你去享受感官世界的美好——自然、艺术、美食。爱与美的能量正在你生命中蓬勃生长。',
rev:'逆位可能意味着你在给予和接受之间失去了平衡。过度照顾他人而忽视了自己的需要，或者创造力遇到了瓶颈。',
sym:'丰满美丽的女性坐在户外，周围茂盛自然，手持权杖，头戴十二星冠冕。',astro:'金星'},
{id:'M04',zh:'皇帝',en:'The Emperor',k_up:'秩序 / 权威 / 稳固 / 守护',k_rev:'僵化 / 控制欲 / 滥用权力',
up:'皇帝代表着结构、规则和稳定的权威。他用理性和纪律为混乱带来秩序。这张牌提示你需要建立清晰的框架和边界，用坚定而非强硬的态度来引领局面。',
rev:'逆位暗示权力可能被滥用——可能是你过于强势，也可能是你正受到不合理的控制。僵化的思维正在扼杀灵活性。',
sym:'严肃男性坐在石质宝座上，手持权杖和宝球，宝座有四个羊头装饰。',astro:'白羊座'},
{id:'M05',zh:'教皇',en:'The Hierophant',k_up:'传统 / 信仰体系 / 导师 / 教育',k_rev:'教条主义 / 叛逆 / 挑战权威',
up:'教皇是精神世界的导师，代表传统智慧和正统教育。他提示你可以从既有的体系和经验中学习，寻找一位导师或加入支持你的社群。',
rev:'逆位鼓励你质疑既定的规则。不是所有传统都值得遵循，不是所有权威都是对的。你可能需要找到属于自己的道路。',
sym:'宗教领袖坐在灰柱之间，头戴三重冠冕，右手做祝福手势，两信徒跪在面前。',astro:'金牛座'},
{id:'M06',zh:'恋人',en:'The Lovers',k_up:'选择 / 关系 / 价值观契合 / 和谐',k_rev:'不协调 / 错误选择 / 价值观冲突',
up:'恋人牌的核心不仅是爱情，更是关于选择和价值观的契合。当你面临重要抉择时，遵循内心深处的价值观。在关系中，它象征着真诚的连接和彼此的尊重。',
rev:'逆位暗示你可能正经历价值观的冲突或关系中的不协调。某个选择可能并非出于真心，或者你在违背自己的原则行事。',
sym:'天使在上方祝福一男一女，女子身后是知善恶树，男子身后是生命之树。',astro:'双子座'},
{id:'M07',zh:'战车',en:'The Chariot',k_up:'胜利 / 意志力 / 决心 / 前进',k_rev:'失控 / 方向迷失 / 挫败感',
up:'战车牌象征着通过坚定意志和明确方向取得胜利。驾驭者控制着两只方向相反的狮身人面兽，代表将矛盾的力量整合为前进的动力。保持专注，勇往直前。',
rev:'逆位提示你可能感到失控或方向不明。内在矛盾和外在阻力让你难以集中精力。先找到内在的平衡点，重新校准方向。',
sym:'铠甲驾驭者站在战车上，头顶星星华盖，前方两只狮身人面兽一黑一白。',astro:'巨蟹座'},
{id:'M08',zh:'力量',en:'Strength',k_up:'内在力量 / 勇气 / 耐心 / 慈悲',k_rev:'自我怀疑 / 软弱 / 恐惧',
up:'力量牌描绘的不是外在的强悍，而是内在的柔韧与勇气。女性温柔地驯服狮子，说明真正的力量来自爱与耐心，而非暴力与压制。用慈悲和坚韧去化解眼前的挑战。',
rev:'逆位暗示你可能正在经历自我怀疑或内在恐惧。你可能低估了自己的能力，或者用外在的强硬来掩盖内在的脆弱。',
sym:'白衣女性温柔地合上狮子的嘴，头顶有无限符号，周围花环绿地。',astro:'狮子座'},
{id:'M09',zh:'隐士',en:'The Hermit',k_up:'内省 / 孤独中的智慧 / 指引',k_rev:'孤僻 / 逃避 / 过度封闭',
up:'隐士举着灯笼独行在山巅，选择暂时远离喧嚣去寻求内在的真理。这张牌邀请你进入安静的独处时光，去反思和沉淀。答案在寂静中自然浮现。',
rev:'逆位可能意味着你过于封闭自己，或者用独处来逃避现实。孤独变成了孤僻。也可能是你一直在寻找答案，却忽略了向外界伸出援手。',
sym:'灰袍老人独自站在雪山之巅，手持六角灯笼，灯笼内有星光，拄着长杖。',astro:'处女座'},
{id:'M10',zh:'命运之轮',en:'Wheel of Fortune',k_up:'转变 / 命运 / 机遇 / 周期循环',k_rev:'抵抗改变 / 坏运气 / 停滞',
up:'命运之轮不断旋转，提醒我们生命中的起伏是不可避免的。新的机遇正在降临。接受变化的必然性，顺势而为。这也是一张关于因果的牌。',
rev:'逆位暗示你可能正处于低潮期，或在抗拒不可避免的变化。坏运气不会永远持续。在命运的低谷中学会接受和等待。',
sym:'巨大的轮盘在空中旋转，轮上有炼金术符号，四角有人、鹰、牛、狮。',astro:'木星'},
{id:'M11',zh:'正义',en:'Justice',k_up:'公平 / 真相 / 因果法则 / 责任',k_rev:'不公正 / 逃避责任 / 偏见',
up:'正义女神手持天平与利剑，象征公平、真相和因果法则。她提醒你每一个选择都有后果。以诚实和公正的态度面对眼前的事务，承担起应负的责任。',
rev:'逆位暗示某种不公正正在发生——可能是你受到了不公平对待，也可能是你在逃避责任。法律或制度层面的问题需要关注。',
sym:'蒙眼女性坐在宝座上，右手持利剑，左手举天平，身后紫色帷幕。',astro:'天秤座'},
{id:'M12',zh:'倒吊人',en:'The Hanged Man',k_up:'牺牲 / 新视角 / 等待 / 放下',k_rev:'拖延 / 抗拒 / 无谓的牺牲',
up:'倒吊人自愿倒悬在树上，神态安详，用全新的角度看世界。这张牌邀请你暂时放下控制，以不同的方式审视当前的处境。主动的等待和放下反而能带来最大的突破。',
rev:'逆位暗示你可能在做无谓的牺牲，或一直在拖延某个必要的决定。也可能你试图用"等待"来逃避行动。审视你的等待是否还有意义。',
sym:'一个人倒挂在T形树上，一条腿弯曲交叉，双手背在身后，头顶光晕。',astro:'海王星'},
{id:'M13',zh:'死神',en:'Death',k_up:'结束 / 转变 / 重生 / 释放旧有',k_rev:'抵抗改变 / 恐惧结束 / 停滞不前',
up:'死神牌并不意味着物理上的死亡，而是象征深刻的转变和旧事物的终结。某种状况正在走向结束，为新的生命腾出空间。接受结束是重生的前提。',
rev:'逆位暗示你正在强烈地抵抗某种必要的结束。恐惧让你紧紧抓住已经不再有意义的东西。勇敢面对改变，新的开始就在结束之后。',
sym:'骑白马的骷髅骑士，旗帜上画着白玫瑰，国王倒在地上，主教和孩童在一旁。',astro:'天蝎座'},
{id:'M14',zh:'节制',en:'Temperance',k_up:'平衡 / 耐心 / 调和 / 中庸之道',k_rev:'极端 / 失衡 / 过度 / 缺乏耐心',
up:'节制牌中的天使将水在两个杯子间反复倾倒，象征平衡与融合的艺术。在各种对立面之间找到中庸之道——工作与休息、理性与情感。最好的结果需要时间酝酿。',
rev:'逆位暗示生活中某些方面失去了平衡。你可能走向了某个极端。重新审视你的生活节奏，找到需要调整的失衡之处。',
sym:'天使一脚踏水一脚踏地，将水在两个金杯间倾倒，远处是道路和山脉。',astro:'射手座'},
{id:'M15',zh:'恶魔',en:'The Devil',k_up:'束缚 / 欲望 / 物质主义 / 阴影面',k_rev:'解脱 / 觉醒 / 打破束缚',
up:'恶魔牌揭示了某种束缚你的力量——物质欲望、不健康的关系模式、成瘾行为或恐惧。画中男女被锁链拴住，但锁链是松的，他们随时可以取下。直面你的阴影面。',
rev:'逆位是积极信号，意味着你正在从某种束缚中觉醒和解脱。你开始看清控制你的模式，并有勇气去打破它们。自由就在眼前。',
sym:'恶魔坐在顶端，翅膀展开，下方一男一女被松锁链拴住，锁链可以取下。',astro:'摩羯座'},
{id:'M16',zh:'塔',en:'The Tower',k_up:'突变 / 崩塌 / 启示 / 重建',k_rev:'恐惧改变 / 逃避灾难 / 内在动荡',
up:'塔被闪电击中，皇冠坠落，人们从高处跌落。这象征着虚假结构的崩塌和真相的揭示。有时候我们需要经历剧烈变化才能从错误的信念中解放出来。在废墟之上才能建造真正坚固的东西。',
rev:'逆位暗示你正在极力避免某种必要的崩塌。内在的动荡已经存在，你只是在推迟面对。主动拆除比被动倒塌要好得多。',
sym:'石塔被闪电击中，火焰喷出，两人从高处坠落，皇冠从塔顶落下。',astro:'火星'},
{id:'M17',zh:'星星',en:'The Star',k_up:'希望 / 灵感 / 宁静 / 治愈',k_rev:'绝望 / 失去信心 / 断连',
up:'在经历了塔的崩塌之后，星星带来希望与治愈。裸身的女性跪在水边，将水倒回大地和池塘。最黑暗的时刻已经过去。保持信心，让灵感和宁静重新充满你的心灵。',
rev:'逆位暗示你可能正在经历信心的丧失。希望变得暗淡，灵感枯竭。然而星星从未消失，只是暂时被云层遮蔽。找回信念的第一步是允许自己再次去相信。',
sym:'裸身女性跪在水边，一手倒水入池，一手倒水入大地，头顶一颗大星七颗小星。',astro:'水瓶座'},
{id:'M18',zh:'月亮',en:'The Moon',k_up:'幻象 / 恐惧 / 潜意识 / 直觉',k_rev:'释放恐惧 / 真相浮现 / 幻象消散',
up:'月亮在夜空中照耀，但光芒是借来的、朦胧的。龙虾从水中爬出，狗和狼在嚎叫。你可能正处于一个充满迷惑和不确定的时期。此时需要信任直觉，但不要急于做出重大决定。',
rev:'逆位意味着迷雾正在散去。困扰你的恐惧和幻象正在被看清。真相开始浮现，你能够更清晰地分辨什么是真实的，什么是想象的。',
sym:'满月与新月同时出现在天空，下方是水池、龙虾、狗和狼，两侧是塔楼。',astro:'双鱼座'},
{id:'M19',zh:'太阳',en:'The Sun',k_up:'快乐 / 成功 / 活力 / 真相大白',k_rev:'暂时的困难 / 延迟的满足',
up:'太阳牌带来纯粹的喜悦、成功和生命力。灿烂的阳光照耀一切，孩童在白墙上快乐地骑着白马。真相大白，万物清晰可见。享受这段充满活力的时光，用你的光芒照亮周围的人。',
rev:'逆位虽然仍带着积极能量，但暗示快乐和成功可能暂时被遮蔽或延迟。太阳并未消失，只是暂时被云层遮住。',
sym:'灿烂的太阳照耀下方，一个赤裸孩童骑在白马上，手持红旗，向日葵盛开。',astro:'太阳'},
{id:'M20',zh:'审判',en:'Judgement',k_up:'觉醒 / 重生 / 召唤 / 深层反思',k_rev:'自我怀疑 / 逃避召唤 / 拒绝反思',
up:'天使在云端吹响号角，人们从棺木中站起回应召唤。审判牌代表一种深层的觉醒——你被呼唤去回顾过去的经历，从中提炼智慧，然后以全新的姿态重生。听从内心的召唤。',
rev:'逆位暗示你可能在逃避某种深层的自我审视。内心的召唤在响，但你选择充耳不闻。勇敢面对过去的自己，原谅和释放才能带来真正的新生。',
sym:'天使在云端吹响巨大号角，人们从棺木中站起，双手伸向天空。',astro:'冥王星'},
{id:'M21',zh:'世界',en:'The World',k_up:'完成 / 整合 / 成就 / 圆满',k_rev:'未完成 / 缺乏收尾 / 停滞',
up:'世界牌是大阿尔卡纳的终章，象征一个完整周期的圆满完成。舞者被月桂花环包围，手持两根权杖，代表对立面的整合。你已完成了一段重要的旅程，准备好迎接下一个循环。',
rev:'逆位暗示某件事情还没有真正完成。你离终点很近，但还缺少最后的收尾。找到那个缺失的部分，完成它，然后前进。',
sym:'裸身舞者被椭圆形月桂花环包围，手持两根权杖，四角有人、鹰、牛、狮。',astro:'土星'}
];

/* Minor Arcana — Wands(权杖) / Cups(圣杯) / Swords(宝剑) / Pentacles(星币) */
var SUIT_DEFS = {
W:{zh:'权杖',en:'Wands',element:'火',theme:'意志 / 行动 / 创造',
  numUp:['新火种的点燃','创造力的二元对舞','行动前的准备','稳固的基业','竞争与冲突','胜利的旅途','捍卫立场','迅速的行动','坚韧的守望','重担与压力'],
  numRev:['火种未燃','热情消退','延迟与犹豫','失去控制','避免冲突','方向迷失','防御过度','匆忙与鲁莽','固执己见','卸下重担'],
  court:[
    {zh:'侍从',en:'Page',up:'好奇的消息传来，新项目的萌芽，学习的热情',rev:'消息延迟，缺乏方向，不成熟的行为'},
    {zh:'骑士',en:'Knight',up:'勇往直前的行动，热情的追求，冒险精神',rev:'鲁莽冲动，缺乏耐心，行动受阻'},
    {zh:'王后',en:'Queen',up:'自信与魅力，独立精神，温暖的鼓励',rev:'嫉妒与控制，自私，热情被压抑'},
    {zh:'国王',en:'King',up:'领导力与远见，企业家精神，激励他人',rev:'专制独断，急躁，滥用权力'}
  ]},
C:{zh:'圣杯',en:'Cups',element:'水',theme:'情感 / 关系 / 直觉',
  numUp:['情感的新开始','和谐的结合','庆祝与友情','冥想与倦怠','失落与遗憾','回忆与选择','幻想与诱惑','离开与探索','满足与感恩','幸福的圆满'],
  numRev:['情感空虚','不和谐','社交中的疏离','逃避现实','从失落中恢复','执念于过去','幻想破灭','恐惧离开','贪得无厌','幸福中的不安'],
  court:[
    {zh:'侍从',en:'Page',up:'温柔的消息，情感的萌芽，直觉的觉醒',rev:'情绪化，不成熟的感情，虚假的承诺'},
    {zh:'骑士',en:'Knight',up:'浪漫的追求，情感的邀请，跟随内心',rev:'嫉妒，情绪不稳定，虚假的浪漫'},
    {zh:'王后',en:'Queen',up:'深层的同理心，情感的智慧，直觉的引导',rev:'情绪淹没理性，依赖，过度敏感'},
    {zh:'国王',en:'King',up:'情感的掌控，慈悲的领导，外交手腕',rev:'情绪操控，冷漠，压抑情感'}
  ]},
S:{zh:'宝剑',en:'Swords',element:'风',theme:'思维 / 真相 / 冲突',
  numUp:['突破性的想法','艰难的选择','心碎与悲伤','休息与边界','从困境中恢复','遗弃与退缩','欺骗与幻想','逃离困境','焦虑与创伤','背叛与痛苦'],
  numRev:['新的想法','妥协的方案','从心碎中恢复','打破旧习','从伤痛中痊愈','重拾方向','真相大白','走出困境','放下焦虑','从背叛中重生'],
  court:[
    {zh:'侍从',en:'Page',up:'求知欲，新的信息，思维的敏锐',rev:'恶意的谣言，间谍行为，缺乏经验'},
    {zh:'骑士',en:'Knight',up:'果断的行动，追求真相，勇往直前',rev:'好斗，言辞伤人，不计后果'},
    {zh:'王后',en:'Queen',up:'清晰的判断，独立思考，直言不讳',rev:'尖酸刻薄，心口不一，过度严厉'},
    {zh:'国王',en:'King',up:'理性权威，公正的判断，战略思维',rev:'冷酷无情，操控人心，滥用智慧'}
  ]},
P:{zh:'星币',en:'Pentacles',element:'土',theme:'物质 / 身体 / 资源',
  numUp:['新的财务机会','平衡收支','技能的精进','享受成果','物质的损失','感恩与分享','技能的学习','勤劳与耐心','丰收与满足','世代传承的财富'],
  numRev:['错失机会','财务失衡','缺乏进步','过于物质','从损失中恢复','自私与吝啬','缺乏目标','懒惰与拖延','贪婪','财富的忧虑'],
  court:[
    {zh:'侍从',en:'Page',up:'学习新技能，务实的消息，脚踏实地',rev:'缺乏目标，不切实际，学习困难'},
    {zh:'骑士',en:'Knight',up:'勤劳踏实，稳步前进，可靠性',rev:'停滞不前，过于谨慎，缺乏野心'},
    {zh:'王后',en:'Queen',up:'富足与慷慨，安全感，与大地的连接',rev:'过度重视物质，忽视精神需求'},
    {zh:'国王',en:'King',up:'财务成功，商业头脑，安全感的提供者',rev:'贪婪，守财，用金钱控制他人'}
  ]}
};

/* Build ALL_CARDS */
var ALL_CARDS = [];
MAJOR.forEach(function(c){
  ALL_CARDS.push({id:c.id,zh:c.zh,en:c.en,k_up:c.k_up,k_rev:c.rev?c.k_rev:'',up:c.up,rev:c.rev,sym:c.sym||'',astro:c.astro||'',type:'major'});
});
var suitKeys = ['W','C','S','P'];
var NUM_CN = ['A','二','三','四','五','六','七','八','九','十'];
var NUM_EN = ['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
suitKeys.forEach(function(sk){
  var sd = SUIT_DEFS[sk];
  for(var i=0;i<10;i++){
    ALL_CARDS.push({
      id:sk+(i+1), zh:sd.zh+NUM_CN[i], en:sd.en+' '+NUM_EN[i],
      k_up:sd.element+'元素 · '+sd.theme,
      k_rev:sd.element+'元素逆位 · '+sd.theme+'受阻',
      up:sd.numUp[i], rev:sd.numRev[i],
      sym:sd.element+'元素象征', astro:'', type:'minor'
    });
  }
  var courts = ['Page','Knight','Queen','King'];
  sd.court.forEach(function(ci,j){
    ALL_CARDS.push({
      id:sk+(j+11), zh:sd.zh+ci.zh, en:sd.en+' '+ci.en,
      k_up:sd.element+' · '+ci.up.split('，')[0],
      k_rev:sd.element+'逆位',
      up:ci.up, rev:ci.rev,
      sym:sd.element+'元素宫廷牌', astro:'', type:'minor'
    });
  });
});

/* ===================================================================
   SPREADS
   =================================================================== */
var SPREADS = [
  {id:'single',name:'每日一牌',desc:'抽取一张牌，获得今日指引',count:1,positions:['指引']},
  {id:'three',name:'时间之流',desc:'过去 / 现在 / 未来的三牌展开',count:3,positions:['过去','现在','未来']},
  {id:'cross',name:'十字牌阵',desc:'四张牌探索问题的各个面向',count:4,positions:['核心','阻碍','根源','建议']},
  {id:'celtic',name:'凯尔特十字',desc:'十张牌的深度全面解读',count:10,positions:['现况','挑战','根源','过去','可能','近未来','自我','环境','希望','结局']}
];

/* ===================================================================
   READER SYSTEM PROMPT
   =================================================================== */
var READER_SYSTEM = '你是一位深谙塔罗象征语言的解读师。你的解读遵循以下结构：\n\n'+
  '1. 【牌阵总览】简述牌阵整体的能量走向和主题\n'+
  '2. 【逐位解读】对每张牌在其所在位置进行深入解读，结合牌面象征、正逆位含义和位置语境\n'+
  '3. 【综合信息】将各张牌之间的关系和张力进行整合分析，揭示更深层的故事\n'+
  '4. 【启示与建议】基于以上解读，给出温和而具有洞察力的建议\n\n'+
  '解读要求：\n'+
  '- 语言温暖而有洞察力，不夸张不玄学\n'+
  '- 每张牌的解读要包含其关键词、象征意义和位置含义\n'+
  '- 如果是逆位，温柔地指出需要注意的地方，但不制造恐惧\n'+
  '- 结尾给一个诗意的总结\n'+
  '- 使用中文回答，适度使用小标题分段\n'+
  '- 在每个小标题前加上 ## 标记（Markdown格式）';

function buildReadingMessages(selCards, positions, question){
  var cardDesc = selCards.map(function(sel,i){
    var pos = positions[i] || '';
    var dir = sel.reversed ? '逆位' : '正位';
    var card = sel.card;
    return (i+1)+'. 【'+pos+'】'+card.zh+'（'+card.en+'）— '+dir+'\n'+
      '   关键词：'+(sel.reversed ? card.k_rev : card.k_up)+'\n'+
      '   含义：'+(sel.reversed ? card.rev : card.up)+'\n'+
      (card.sym ? '   象征：'+card.sym+'\n' : '')+
      (card.astro ? '   对应：'+card.astro : '');
  }).join('\n\n');

  var userMsg = '问题：'+(question || '想了解当前的状况和方向')+'\n\n'+
    '牌阵中有'+selCards.length+'张牌：\n\n'+cardDesc+'\n\n'+
    '请按照你的解读结构（牌阵总览→逐位解读→综合信息→启示与建议）进行详细解读。';

  return [
    {role:'system',content:READER_SYSTEM},
    {role:'user',content:userMsg}
  ];
}

/* ===================================================================
   MD TO HTML (simple markdown renderer)
   =================================================================== */
function mdToHtml(md){
  if(!md) return '';
  var lines = md.split('\n');
  var html = '';
  var inList = false;
  lines.forEach(function(line){
    var trimmed = line.trim();
    if(!trimmed){
      if(inList){ html += '</ul>'; inList = false; }
      return;
    }
    // Headings
    var hMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if(hMatch){
      if(inList){ html += '</ul>'; inList = false; }
      html += '<h3>'+esc(hMatch[1])+'</h3>';
      return;
    }
    // Bold
    var processed = esc(trimmed);
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>');
    // Lists
    if(/^[•\-\*]\s+/.test(trimmed)){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>'+processed.replace(/^[•\-\*]\s+/,'')+'</li>';
      return;
    }
    if(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/.test(trimmed)){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>'+processed+'</li>';
      return;
    }
    if(inList){ html += '</ul>'; inList = false; }
    html += '<p>'+processed+'</p>';
  });
  if(inList) html += '</ul>';
  return html;
}

/* ===================================================================
   STATE
   =================================================================== */
var state = {
  phase: 'question',
  mode: 'auto',
  spread: null,
  question: '',
  deck: [],
  selected: [],
  readingText: '',
  readingDone: false,
  abortCtrl: null
};

/* ===================================================================
   HELPERS
   =================================================================== */
function esc(s){var d=document.createElement('div');d.textContent=s;return d.innerHTML}
function shuffle(arr){
  var a=arr.slice();
  for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t}
  return a;
}
function getHistory(){try{return JSON.parse(localStorage.getItem('tarot_history')||'[]')}catch(e){return[]}}
function saveHistory(item){
  var list=getHistory();list.unshift(item);if(list.length>20)list.length=20;
  try{localStorage.setItem('tarot_history',JSON.stringify(list))}catch(e){}
}
function fmtDate(ts){
  var d=new Date(ts);
  return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
}

/* ===================================================================
   ORNAMENT HTML
   =================================================================== */
function ornament(){
  return '<div class="tarot-ornament"><div class="tarot-ornament-diamond"></div></div>';
}

/* ===================================================================
   PHASE: QUESTION
   =================================================================== */
function renderQuestion(root){
  state.phase = 'question';
  var hist = getHistory().slice(0,5);
  var histHTML = '';
  if(hist.length===0){
    histHTML = '<div class="tarot-empty">尚无占卜记录</div>';
  } else {
    histHTML = hist.map(function(h){
      var tags = (h.cards||[]).map(function(c){
        return '<span class="tarot-history-card-tag">'+esc(c.zh)+(c.reversed?' 逆':'')+'</span>';
      }).join('');
      return '<div class="tarot-history-item" data-ts="'+h.ts+'">'+
        '<div class="tarot-history-meta">'+
          '<span class="tarot-history-date">'+fmtDate(h.ts)+'</span>'+
          '<span class="tarot-history-spread-tag">'+esc(h.spreadName||'')+'</span>'+
        '</div>'+
        '<div class="tarot-history-q">'+esc(h.question||'每日指引')+'</div>'+
        '<div class="tarot-history-cards-row">'+tags+'</div>'+
      '</div>';
    }).join('');
  }

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-question-phase">'+
      '<div class="tarot-panel tarot-question-panel">'+
        '<div class="tarot-eyebrow">CONSULT THE ORACLE</div>'+
        '<div class="tarot-main-title">以心问卜</div>'+
        ornament()+
        '<textarea class="tarot-textarea" id="tq-input" rows="3" placeholder="在心中默念你的问题"></textarea>'+
        '<div class="tarot-mode-group">'+
          '<div class="tarot-mode-option tarot-selected" data-mode="auto">依问择阵</div>'+
          '<div class="tarot-mode-option" data-mode="manual">自行选阵</div>'+
        '</div>'+
        '<div class="tarot-submit-row">'+
          '<button class="tarot-btn" id="tq-submit">启 示</button>'+
        '</div>'+
        '<div class="tarot-whisper">静心凝神，答案自会浮现</div>'+
      '</div>'+
      '<div class="tarot-history-section">'+
        '<div class="tarot-history-heading">占卜记录</div>'+
        '<div id="tq-history">'+histHTML+'</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;

  // Bind events
  var screen = root.querySelector('.tarot-phase');
  screen.querySelectorAll('.tarot-mode-option').forEach(function(opt){
    opt.addEventListener('click',function(){
      screen.querySelectorAll('.tarot-mode-option').forEach(function(o){o.classList.remove('tarot-selected')});
      opt.classList.add('tarot-selected');
      state.mode = opt.dataset.mode;
    });
  });

  screen.querySelector('#tq-submit').addEventListener('click',function(){
    state.question = (screen.querySelector('#tq-input').value||'').trim();
    if(state.mode==='auto'){
      state.deck = shuffle(ALL_CARDS);
      state.selected = [];
      state.readingText = '';
      state.readingDone = false;
      // AI picks spread based on question
      autoPickSpread(root);
    } else {
      renderSpread(root);
    }
  });

  screen.querySelectorAll('.tarot-history-item').forEach(function(item){
    item.addEventListener('click',function(){
      var ts = Number(item.dataset.ts);
      var h = getHistory().find(function(x){return x.ts===ts});
      if(h){
        state.question = h.question||'';
        state.spread = SPREADS.findIndex(function(s){return s.id===h.spreadId});
        if(state.spread<0) state.spread=0;
        state.selected = h.cards||[];
        state.readingText = h.reading||'';
        state.readingDone = true;
        renderReading(root);
      }
    });
  });
}

/* ===================================================================
   AUTO PICK SPREAD
   =================================================================== */
async function autoPickSpread(root){
  // Simple heuristic: if question is short/simple → single, else → three, long → celtic
  var q = state.question;
  if(!q || q.length < 8){ state.spread = 0; }
  else if(q.length < 30){ state.spread = 1; }
  else { state.spread = 2; }
  renderSelect(root);
}

/* ===================================================================
   PHASE: SPREAD SELECTION
   =================================================================== */
function renderSpread(root){
  state.phase = 'spread';
  var listHTML = SPREADS.map(function(s,i){
    return '<div class="tarot-spread-card" data-idx="'+i+'">'+
      '<div class="tarot-spread-card-header">'+
        '<span class="tarot-spread-card-name">'+esc(s.name)+'</span>'+
        '<span class="tarot-spread-card-count">'+s.count+'张</span>'+
      '</div>'+
      '<div class="tarot-spread-card-desc">'+esc(s.desc)+'</div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-question-phase">'+
      '<div class="tarot-panel tarot-question-panel">'+
        '<div class="tarot-eyebrow">CHOOSE THE PATTERN</div>'+
        '<div class="tarot-main-title">择取牌阵</div>'+
        ornament()+
        '<div class="tarot-spread-list">'+listHTML+'</div>'+
        '<div class="tarot-back-row">'+
          '<button class="tarot-btn tarot-btn-ghost" id="ts-back">回到问询</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');

  screen.querySelectorAll('.tarot-spread-card').forEach(function(card){
    card.addEventListener('click',function(){
      state.spread = Number(card.dataset.idx);
      state.deck = shuffle(ALL_CARDS);
      state.selected = [];
      state.readingText = '';
      state.readingDone = false;
      renderSelect(root);
    });
  });

  screen.querySelector('#ts-back').addEventListener('click',function(){
    renderQuestion(root);
  });
}

/* ===================================================================
   PHASE: SELECT CARDS
   =================================================================== */
function renderSelect(root){
  state.phase = 'select';
  var sp = SPREADS[state.spread];
  var need = sp.count;
  // Show enough face-down cards (min 21 or need*3)
  var showCount = Math.max(need*3, 21);
  var deck = state.deck.slice(0, showCount);

  var gridHTML = deck.map(function(c,i){
    return '<div class="tarot-card-slot" data-idx="'+i+'">'+
      '<div class="tarot-card-inner">'+
        '<div class="tarot-card-back"></div>'+
        '<div class="tarot-card-front">'+
          '<div class="tarot-card-front-cn">'+esc(c.zh)+'</div>'+
          '<div class="tarot-card-front-en">'+esc(c.en)+'</div>'+
          '<div class="tarot-card-front-dir"></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-select-header">'+
      '<div class="tarot-eyebrow">DRAW THE CARDS</div>'+
      '<div class="tarot-select-title">'+esc(sp.name)+'</div>'+
      '<div class="tarot-select-progress" id="tsel-prog">已选 0 / '+need+'</div>'+
    '</div>'+
    '<div class="tarot-card-grid" id="tsel-grid">'+gridHTML+'</div>'+
    '<div class="tarot-ritual-bar">'+
      '<div class="tarot-ritual-hint">点击牌面抽取 '+need+' 张牌</div>'+
      '<div class="tarot-ritual-actions">'+
        '<button class="tarot-ritual-btn" id="tsel-back">返回</button>'+
        '<button class="tarot-ritual-btn" id="tsel-view" disabled>查看解读</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');

  // Bind card clicks
  var slots = screen.querySelectorAll('.tarot-card-slot');
  slots.forEach(function(slot){
    slot.addEventListener('click',function(){
      if(state.selected.length >= need) return;
      if(slot.classList.contains('tarot-picked')) return;

      var idx = Number(slot.dataset.idx);
      var card = state.deck[idx];
      var reversed = Math.random() < 0.35;

      // Flip animation
      slot.classList.add('tarot-flipped','tarot-picked');

      // Set orientation
      var dir = slot.querySelector('.tarot-card-front-dir');
      if(reversed){
        dir.className = 'tarot-card-front-dir tarot-rev';
        dir.textContent = '逆位';
        slot.querySelector('.tarot-card-front-cn').style.transform = 'rotate(180deg)';
        slot.querySelector('.tarot-card-front-en').style.transform = 'rotate(180deg)';
      } else {
        dir.className = 'tarot-card-front-dir tarot-up';
        dir.textContent = '正位';
      }

      var sp = SPREADS[state.spread];
      state.selected.push({
        card: card,
        reversed: reversed,
        position: sp.positions[state.selected.length] || ''
      });

      screen.querySelector('#tsel-prog').textContent = '已选 '+state.selected.length+' / '+need;

      if(state.selected.length >= need){
        // Disable remaining
        slots.forEach(function(s){
          if(!s.classList.contains('tarot-flipped')) s.classList.add('tarot-picked');
        });
        screen.querySelector('#tsel-view').disabled = false;
      }
    });
  });

  screen.querySelector('#tsel-back').addEventListener('click',function(){
    renderQuestion(root);
  });

  screen.querySelector('#tsel-view').addEventListener('click',function(){
    renderReading(root);
  });
}

/* ===================================================================
   PHASE: READING
   =================================================================== */
function renderReading(root){
  state.phase = 'reading';
  var sp = SPREADS[state.spread];
  var question = state.question || '每日指引';

  var chipsHTML = state.selected.map(function(sel,i){
    var cls = sel.reversed ? 'tarot-chip tarot-chip-rev' : 'tarot-chip';
    var dir = sel.reversed ? ' 逆' : '';
    var pos = sel.position || sp.positions[i] || '';
    return '<div class="'+cls+'" data-ci="'+i+'">'+esc(pos)+' '+esc(sel.card.zh)+dir+'</div>';
  }).join('');

  var bodyContent = state.readingDone ? mdToHtml(state.readingText) :
    '<div class="tarot-reading-loading">正在连接星轨...<span class="tarot-cursor"></span></div>';

  var html = '<div class="tarot-reading-overlay tarot-active">'+
    '<div class="tarot-reading-scroll">'+
      '<div class="tarot-reading-panel">'+
        '<div class="tarot-eyebrow">THE READING</div>'+
        '<div class="tarot-main-title">牌阵解读</div>'+
        ornament()+
        '<div class="tarot-reading-question">\u201c'+esc(question)+'\u201d</div>'+
        '<div class="tarot-chips-row">'+chipsHTML+'</div>'+
        '<div class="tarot-reading-body" id="tr-body">'+bodyContent+'</div>'+
        '<div class="tarot-reading-actions">'+
          '<button class="tarot-btn" id="tr-retry">再问一次</button>'+
          '<button class="tarot-btn" id="tr-copy">誊抄</button>'+
          '<button class="tarot-btn" id="tr-new">新的占问</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  // Remove old reading overlay if any
  var old = root.querySelector('.tarot-reading-overlay');
  if(old) old.remove();

  root.insertAdjacentHTML('beforeend', html);

  // Bind chip clicks
  root.querySelectorAll('.tarot-chip').forEach(function(chip){
    chip.addEventListener('click',function(){
      var ci = Number(chip.dataset.ci);
      showCardDetail(root, ci);
    });
  });

  // Bind action buttons
  root.querySelector('#tr-retry').addEventListener('click',function(){
    var ol = root.querySelector('.tarot-reading-overlay');
    if(ol) ol.remove();
    state.deck = shuffle(ALL_CARDS);
    state.selected = [];
    state.readingText = '';
    state.readingDone = false;
    renderSelect(root);
  });

  root.querySelector('#tr-copy').addEventListener('click',function(){
    if(navigator.clipboard && state.readingText){
      navigator.clipboard.writeText(state.readingText).then(function(){
        showToast(root, '已誊抄至剪贴板');
      });
    }
  });

  root.querySelector('#tr-new').addEventListener('click',function(){
    var ol = root.querySelector('.tarot-reading-overlay');
    if(ol) ol.remove();
    state = {phase:'question',mode:state.mode,spread:null,question:'',deck:[],selected:[],readingText:'',readingDone:false,abortCtrl:null};
    renderQuestion(root);
  });

  // Start AI reading if not done
  if(!state.readingDone){
    fetchReading(root);
  }
}

/* ===================================================================
   CARD DETAIL MODAL
   =================================================================== */
function showCardDetail(root, ci){
  var sel = state.selected[ci];
  if(!sel) return;
  var sp = SPREADS[state.spread];
  var pos = sel.position || sp.positions[ci] || '';
  var dir = sel.reversed ? '逆位' : '正位';
  var dirClass = sel.reversed ? 'tarot-rev' : 'tarot-up';
  var keywords = sel.reversed ? sel.card.k_rev : sel.card.k_up;
  var meaning = sel.reversed ? sel.card.rev : sel.card.up;

  var html = '<div class="tarot-detail-overlay tarot-active" id="t-detail">'+
    '<div class="tarot-detail-panel">'+
      '<button class="tarot-detail-close" id="td-close">X</button>'+
      '<div class="tarot-detail-position">'+esc(pos)+'</div>'+
      '<div class="tarot-detail-name">'+esc(sel.card.zh)+'</div>'+
      '<div class="tarot-detail-name-en">'+esc(sel.card.en)+'</div>'+
      '<div class="tarot-detail-orient '+dirClass+'">'+dir+'</div>'+
      '<div class="tarot-detail-divider"></div>'+
      '<div class="tarot-detail-section-title">关键词</div>'+
      '<div class="tarot-detail-keywords">'+esc(keywords)+'</div>'+
      '<div class="tarot-detail-divider"></div>'+
      '<div class="tarot-detail-section-title">释义</div>'+
      '<div class="tarot-detail-text">'+esc(meaning)+'</div>'+
      (sel.card.sym ? '<div class="tarot-detail-divider"></div>'+
        '<div class="tarot-detail-section-title">象征</div>'+
        '<div class="tarot-detail-meta">'+esc(sel.card.sym)+'</div>' : '')+
      (sel.card.astro ? '<div class="tarot-detail-meta" style="margin-top:6px">对应：'+esc(sel.card.astro)+'</div>' : '')+
    '</div>'+
  '</div>';

  var old = root.querySelector('.t-detail');
  // Remove old
  root.querySelectorAll('.tarot-detail-overlay').forEach(function(o){o.remove()});
  root.insertAdjacentHTML('beforeend', html);

  root.querySelector('#td-close').addEventListener('click',function(){
    root.querySelector('.tarot-detail-overlay').remove();
  });
  root.querySelector('.tarot-detail-overlay').addEventListener('click',function(e){
    if(e.target === this) this.remove();
  });
}

/* ===================================================================
   TOAST
   =================================================================== */
function showToast(root, msg){
  var t = document.createElement('div');
  t.className = 'tarot-toast';
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(function(){t.remove()},1600);
}

/* ===================================================================
   AI READING (streaming)
   =================================================================== */
async function fetchReading(root){
  var bodyEl = root.querySelector('#tr-body');
  if(!bodyEl) return;

  try {
    if(!window.loadGameApiConfig){
      bodyEl.innerHTML = '<div style="color:var(--t-wine)">未找到 API 配置接口</div>';
      return;
    }
    var cfg = await window.loadGameApiConfig();
    if(!cfg.url || !cfg.key || !cfg.model){
      bodyEl.innerHTML = '<div style="color:var(--t-wine)">请先配置 API（Base URL / Key / Model）</div>';
      return;
    }

    var sp = SPREADS[state.spread];
    var messages = buildReadingMessages(state.selected, sp.positions, state.question);

    var abortCtrl = new AbortController();
    state.abortCtrl = abortCtrl;

    var response = await fetch(cfg.url+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify({
        model:cfg.model,
        messages:messages,
        temperature:cfg.temp||0.7,
        max_tokens:2500,
        stream:true
      }),
      signal:abortCtrl.signal
    });

    if(!response.ok){
      var errText='';
      try{errText=await response.text()}catch(e){}
      throw new Error('API 请求失败 ('+response.status+')'+(errText?': '+errText.slice(0,100):''));
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    state.readingText = '';

    // Show streaming cursor
    bodyEl.innerHTML = '<span class="tarot-cursor"></span>';

    while(true){
      var result = await reader.read();
      if(result.done) break;
      buffer += decoder.decode(result.value, {stream:true});
      var lines = buffer.split('\n');
      buffer = lines.pop()||'';
      for(var li=0;li<lines.length;li++){
        var line = lines[li].trim();
        if(!line || !line.startsWith('data:')) continue;
        var data = line.slice(5).trim();
        if(data==='[DONE]') continue;
        try{
          var chunk = JSON.parse(data);
          var delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
          if(delta && delta.content){
            state.readingText += delta.content;
            bodyEl.innerHTML = mdToHtml(state.readingText)+'<span class="tarot-cursor"></span>';
            // Auto-scroll
            var scrollEl = root.querySelector('.tarot-reading-scroll');
            if(scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        }catch(e){}
      }
    }

    // Final render
    bodyEl.innerHTML = mdToHtml(state.readingText);
    state.readingDone = true;

    // Auto-save to history
    var sp = SPREADS[state.spread];
    saveHistory({
      ts:Date.now(),
      question:state.question,
      spreadId:sp.id,
      spreadName:sp.name,
      cards:state.selected.map(function(sel){
        return {zh:sel.card.zh,en:sel.card.en,reversed:sel.reversed,position:sel.position};
      }),
      reading:state.readingText
    });

  } catch(e){
    if(e.name === 'AbortError') return;
    console.error('[tarot] reading error:',e);
    if(bodyEl) bodyEl.innerHTML = '<div style="color:var(--t-wine)">解读失败：'+esc(e.message||'未知错误')+'</div>';
  }
}

/* ===================================================================
   ENTRY POINT
   =================================================================== */
window.showTarotPage = function(){
  var existing = document.getElementById('tarot-page');
  if(existing) existing.remove();

  var root = document.createElement('div');
  root.id = 'tarot-page';
  root.className = 'tarot-root';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'tarot-close';
  closeBtn.innerHTML = '<span class="tarot-close-x"></span>';
  closeBtn.addEventListener('click',function(){
    if(state.abortCtrl) state.abortCtrl.abort();
    root.remove();
  });
  root.appendChild(closeBtn);

  var phases = document.createElement('div');
  phases.className = 'tarot-phases';
  root.appendChild(phases);

  var app = document.getElementById('app') || document.body;
  app.appendChild(root);

  state = {phase:'question',mode:'auto',spread:null,question:'',deck:[],selected:[],readingText:'',readingDone:false,abortCtrl:null};
  renderQuestion(root);
};

})()
