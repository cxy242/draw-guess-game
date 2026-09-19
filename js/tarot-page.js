// tarot-page.js — 月月机 塔罗占卜 (complete rewrite)
// Phases: question -> shuffle -> select(fan) -> reveal -> reading
// Features: CSS animations, AI character integration, memory saving
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

var ALL_CARDS = [];
MAJOR.forEach(function(c){
  ALL_CARDS.push({id:c.id,zh:c.zh,en:c.en,k_up:c.k_up,k_rev:c.k_rev,up:c.up,rev:c.rev,sym:c.sym||'',astro:c.astro||'',type:'major'});
});
var suitKeys = ['W','C','S','P'];
var NUM_CN = ['A','二','三','四','五','六','七','八','九','十'];
var NUM_EN = ['Ace','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
suitKeys.forEach(function(sk){
  var sd = SUIT_DEFS[sk];
  for(var i=0;i<10;i++){
    ALL_CARDS.push({
      id:sk+(i+1), zh:sd.zh+NUM_CN[i], en:sd.en+' '+NUM_EN[i],
      k_up:sd.element+'元素: '+sd.theme,
      k_rev:sd.element+'元素逆位: '+sd.theme+'受阻',
      up:sd.numUp[i], rev:sd.numRev[i],
      sym:sd.element+'元素象征', astro:'', type:'minor'
    });
  }
  var courts = ['Page','Knight','Queen','King'];
  sd.court.forEach(function(ci,j){
    ALL_CARDS.push({
      id:sk+(j+11), zh:sd.zh+ci.zh, en:sd.en+' '+ci.en,
      k_up:sd.element+' : '+ci.up.split('\uFF0C')[0],
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
    return (i+1)+'. 【'+pos+'】'+card.zh+'\uFF08'+card.en+'\uFF09\u2014 '+dir+'\n'+
      '   关键词：'+(sel.reversed ? card.k_rev : card.k_up)+'\n'+
      '   含义：'+(sel.reversed ? card.rev : card.up)+'\n'+
      (card.sym ? '   象征：'+card.sym+'\n' : '')+
      (card.astro ? '   对应：'+card.astro : '');
  }).join('\n\n');

  var userMsg = '问题：'+(question || '想了解当前的状况和方向')+'\n\n'+
    '牌阵中有'+selCards.length+'张牌：\n\n'+cardDesc+'\n\n'+
    '请按照你的解读结构（牌阵总览\u2192逐位解读\u2192综合信息\u2192启示与建议）进行详细解读。';

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
    var hMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if(hMatch){
      if(inList){ html += '</ul>'; inList = false; }
      html += '<h3>'+esc(hMatch[1])+'</h3>';
      return;
    }
    var processed = esc(trimmed);
    processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    processed = processed.replace(/__(.+?)__/g, '<strong>$1</strong>');
    if(/^[\u2022\-\*]\s+/.test(trimmed)){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>'+processed.replace(/^[\u2022\-\*]\s+/,'')+'</li>';
      return;
    }
    if(/^[\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467\u2468\u2469]\s*/.test(trimmed)){
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
  abortCtrl: null,
  charId: null,
  charName: '',
  charAvatar: '',
  charDescription: '',
  aiReadingText: '',
  aiReadingDone: false
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
function ornament(){
  return '<div class="tarot-ornament"><div class="tarot-ornament-diamond"></div></div>';
}

/* ===================================================================
   CHARACTER INTEGRATION
   =================================================================== */
var _characters = [];

async function loadCharacters(){
  if(_characters.length) return _characters;
  try{
    if(window.db && window.db.characters){
      _characters = await window.db.characters.where('type').equals('char').toArray();
    }
  }catch(e){ console.warn('[tarot] load characters:', e); }
  return _characters;
}

function buildCharacterSelectorHTML(chars){
  if(!chars || !chars.length) return '';
  var avatars = chars.map(function(c){
    var avatarSrc = c.avatar || '';
    var name = c.name || '';
    return '<div class="tarot-char-avatar-wrap" data-cid="'+c.id+'" data-cname="'+esc(name)+'">'+
      '<img class="tarot-char-avatar" src="'+esc(avatarSrc)+'" alt="'+esc(name)+'" onerror="this.style.display=\'none\'">'+
      '<div class="tarot-char-avatar-name">'+esc(name)+'</div>'+
    '</div>';
  }).join('');
  return '<div class="tarot-char-section">'+
    '<div class="tarot-char-heading">AI 视角 (可选)</div>'+
    '<div class="tarot-char-row">'+avatars+'</div>'+
    '<div class="tarot-char-name" id="tcn-name"></div>'+
  '</div>';
}

function bindCharacterSelector(screen){
  screen.querySelectorAll('.tarot-char-avatar-wrap').forEach(function(wrap){
    wrap.addEventListener('click', function(){
      var wasSelected = wrap.querySelector('.tarot-char-avatar').classList.contains('tarot-char-selected');
      // Deselect all
      screen.querySelectorAll('.tarot-char-avatar').forEach(function(a){a.classList.remove('tarot-char-selected')});
      var nameEl = screen.querySelector('#tcn-name');
      if(wasSelected){
        state.charId = null;
        state.charName = '';
        state.charAvatar = '';
        state.charDescription = '';
        if(nameEl) nameEl.textContent = '';
      } else {
        var avatar = wrap.querySelector('.tarot-char-avatar');
        avatar.classList.add('tarot-char-selected');
        state.charId = wrap.dataset.cid;
        state.charName = wrap.dataset.cname;
        state.charAvatar = avatar.src;
        var ch = _characters.find(function(x){return String(x.id)===String(state.charId)});
        state.charDescription = ch ? (ch.description || ch.identity && ch.identity.bio || ch.signature || '') : '';
        if(nameEl) nameEl.textContent = '\u4E0E '+state.charName+' \u76F8\u5173';
      }
    });
  });
}

/* ===================================================================
   PHASE: QUESTION
   =================================================================== */
async function renderQuestion(root){
  state.phase = 'question';
  state.charId = null; state.charName = ''; state.charAvatar = ''; state.charDescription = '';
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

  // Load characters
  var chars = await loadCharacters();
  var charHTML = buildCharacterSelectorHTML(chars);

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-question-phase">'+
      '<div class="tarot-panel tarot-question-panel">'+
        '<div class="tarot-eyebrow">CONSULT THE ORACLE</div>'+
        '<div class="tarot-main-title">以心问卜</div>'+
        ornament()+
        '<textarea class="tarot-textarea" id="tq-input" rows="3" placeholder="在心中默念你的问题"></textarea>'+
        charHTML+
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

  var screen = root.querySelector('.tarot-phase');

  // Bind character selector
  bindCharacterSelector(screen);

  // Bind mode options
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
      state.aiReadingText = '';
      state.aiReadingDone = false;
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
        state.selected = (h.cards||[]).map(function(c){
          return {card:{zh:c.zh,en:c.en,up:c.up||'',rev:c.rev||'',k_up:c.k_up||'',k_rev:c.k_rev||'',sym:c.sym||'',astro:c.astro||''},reversed:c.reversed,position:c.position};
        });
        state.readingText = h.reading||'';
        state.readingDone = true;
        state.charId = h.charId || null;
        state.charName = h.charName || '';
        state.aiReadingText = h.aiReading || '';
        state.aiReadingDone = !!h.aiReading;
        renderReading(root);
      }
    });
  });
}

/* ===================================================================
   AUTO PICK SPREAD
   =================================================================== */
function autoPickSpread(root){
  var q = state.question;
  if(!q || q.length < 8){ state.spread = 0; }
  else if(q.length < 30){ state.spread = 1; }
  else { state.spread = 2; }
  renderShuffle(root);
}

/* ===================================================================
   PHASE: SPREAD SELECTION (manual mode)
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
      state.aiReadingText = '';
      state.aiReadingDone = false;
      renderShuffle(root);
    });
  });

  screen.querySelector('#ts-back').addEventListener('click',function(){
    renderQuestion(root);
  });
}

/* ===================================================================
   PHASE: SHUFFLE — cards scatter and reform
   =================================================================== */
function renderShuffle(root){
  state.phase = 'shuffle';
  var sp = SPREADS[state.spread];
  var cardCount = 21;

  var cardsHTML = '';
  for(var i=0;i<cardCount;i++){
    cardsHTML += '<div class="tarot-deck-card" data-idx="'+i+'"></div>';
  }

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-shuffle-stage" id="tsh-stage">'+cardsHTML+'</div>'+
    '<div class="tarot-shuffle-hint">命运正在洗牌...</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');
  var cards = screen.querySelectorAll('.tarot-deck-card');

  // Phase 1: Stack at center
  cards.forEach(function(card, i){
    card.style.transform = 'translate(0, '+(-i*0.5)+'px) rotate(0deg)';
    card.style.opacity = '1';
    card.style.zIndex = i;
  });

  // Phase 2: Fan out after a brief pause
  setTimeout(function(){
    cards.forEach(function(card, i){
      card.classList.add('tarot-deck-fan');
      var totalCards = cards.length;
      var angleSpread = 60;
      var angle = -angleSpread/2 + (angleSpread/(totalCards-1))*i;
      var radius = 120;
      var rad = (angle - 90) * Math.PI / 180;
      var x = Math.cos(rad) * radius;
      var y = Math.sin(rad) * radius + radius;
      card.style.transform = 'translate('+x+'px, '+y+'px) rotate('+angle+'deg)';
    });
  }, 400);

  // Phase 3: Scatter (shuffle effect)
  setTimeout(function(){
    cards.forEach(function(card){
      card.classList.remove('tarot-deck-fan');
      card.classList.add('tarot-deck-scatter');
      var rx = (Math.random()-0.5)*280;
      var ry = (Math.random()-0.5)*200;
      var rr = (Math.random()-0.5)*120;
      card.style.transform = 'translate('+rx+'px, '+ry+'px) rotate('+rr+'deg)';
      card.style.opacity = '0.7';
    });
  }, 1800);

  // Phase 4: Reform into fan
  setTimeout(function(){
    cards.forEach(function(card, i){
      card.classList.remove('tarot-deck-scatter');
      card.classList.add('tarot-deck-reform');
      var totalCards = cards.length;
      var angleSpread = 60;
      var angle = -angleSpread/2 + (angleSpread/(totalCards-1))*i;
      var radius = 120;
      var rad = (angle - 90) * Math.PI / 180;
      var x = Math.cos(rad) * radius;
      var y = Math.sin(rad) * radius + radius;
      card.style.transform = 'translate('+x+'px, '+y+'px) rotate('+angle+'deg)';
      card.style.opacity = '1';
    });
  }, 2800);

  // Phase 5: Transition to select phase
  setTimeout(function(){
    renderFanSelect(root);
  }, 3800);
}

/* ===================================================================
   PHASE: FAN SELECT — cards in arc, tap to flip
   =================================================================== */
function renderFanSelect(root){
  state.phase = 'select';
  var sp = SPREADS[state.spread];
  var need = sp.count;
  var showCount = Math.min(state.deck.length, 21);
  var deck = state.deck.slice(0, showCount);

  var fanCardsHTML = deck.map(function(c,i){
    return '<div class="tarot-fan-card" data-idx="'+i+'">'+
      '<div class="tarot-fan-card-inner">'+
        '<div class="tarot-fan-back"></div>'+
        '<div class="tarot-fan-front">'+
          '<div class="tarot-fan-front-cn">'+esc(c.zh)+'</div>'+
          '<div class="tarot-fan-front-en">'+esc(c.en)+'</div>'+
          '<div class="tarot-fan-front-dir"></div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-fan-header">'+
      '<div class="tarot-eyebrow">DRAW THE CARDS</div>'+
      '<div class="tarot-fan-title">'+esc(sp.name)+'</div>'+
      '<div class="tarot-fan-progress" id="tfan-prog">已选 0 / '+need+'</div>'+
    '</div>'+
    '<div class="tarot-fan-container" id="tfan-container">'+fanCardsHTML+'</div>'+
    '<div class="tarot-ritual-bar">'+
      '<div class="tarot-ritual-hint">点击牌面抽取 '+need+' 张牌</div>'+
      '<div class="tarot-ritual-actions">'+
        '<button class="tarot-ritual-btn" id="tfan-back">返回</button>'+
        '<button class="tarot-ritual-btn" id="tfan-view" disabled>查看解读</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');
  var cards = screen.querySelectorAll('.tarot-fan-card');
  var container = screen.querySelector('#tfan-container');

  // Position cards in a fan arc
  var total = cards.length;
  var angleSpread = Math.min(120, total * 6);
  var radius = 200;
  cards.forEach(function(card, i){
    var angle = -angleSpread/2 + (angleSpread/(total-1))*i;
    var rad = (angle - 90) * Math.PI / 180;
    var x = Math.cos(rad) * radius;
    var y = Math.sin(rad) * radius + radius;
    card.style.transform = 'rotate('+angle+'deg) translateY('+(-radius)+'px)';
    card.style.zIndex = i + 10;
  });

  // Add touch/drag scrolling to rotate the fan
  var fanOffset = 0;
  var touchStartX = 0;
  var touchStartOffset = 0;
  var isDragging = false;

  function updateFanPositions(offset) {
    cards.forEach(function(card, i){
      var angle = -angleSpread/2 + (angleSpread/(total-1))*i + offset;
      var rad = (angle - 90) * Math.PI / 180;
      var x = Math.cos(rad) * radius;
      var y = Math.sin(rad) * radius + radius;
      card.style.transform = 'rotate('+angle+'deg) translateY('+(-radius)+'px)';
    });
  }

  if (container) {
    container.addEventListener('touchstart', function(e) {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartOffset = fanOffset;
        isDragging = false;
      }
    }, { passive: true });

    container.addEventListener('touchmove', function(e) {
      if (e.touches.length === 1) {
        var dx = e.touches[0].clientX - touchStartX;
        if (Math.abs(dx) > 5) isDragging = true;
        fanOffset = touchStartOffset + dx * 0.3;
        updateFanPositions(fanOffset);
      }
    }, { passive: true });

    container.addEventListener('touchend', function(e) {
      // Momentum not needed, just keep the offset
    }, { passive: true });

    // Also support mouse drag
    var mouseDown = false;
    var mouseStartX = 0;
    container.addEventListener('mousedown', function(e) {
      mouseDown = true;
      mouseStartX = e.clientX;
      touchStartOffset = fanOffset;
      isDragging = false;
    });
    container.addEventListener('mousemove', function(e) {
      if (!mouseDown) return;
      var dx = e.clientX - mouseStartX;
      if (Math.abs(dx) > 5) isDragging = true;
      fanOffset = touchStartOffset + dx * 0.3;
      updateFanPositions(fanOffset);
    });
    container.addEventListener('mouseup', function() { mouseDown = false; });
    container.addEventListener('mouseleave', function() { mouseDown = false; });
  }

  // Bind card clicks
  cards.forEach(function(card){
    card.addEventListener('click', function(e){
      e.stopPropagation();
      e.preventDefault();
      if(state.selected.length >= need) return;
      if(card.classList.contains('tarot-fan-picked')) return;
      if(card._selecting) return;
      card._selecting = true;

      var idx = Number(card.dataset.idx);
      var c = state.deck[idx];
      var reversed = Math.random() < 0.35;

      // Lift up, then flip
      card.classList.add('tarot-fan-picked', 'tarot-fan-flipped');

      // Set orientation
      var dir = card.querySelector('.tarot-fan-front-dir');
      var front = card.querySelector('.tarot-fan-front');
      if(reversed){
        dir.className = 'tarot-fan-front-dir tarot-rev';
        dir.textContent = '\u9006\u4F4D';
        front.classList.add('tarot-reversed-content');
      } else {
        dir.className = 'tarot-fan-front-dir tarot-up';
        dir.textContent = '\u6B63\u4F4D';
      }

      var sp = SPREADS[state.spread];
      state.selected.push({
        card: c,
        reversed: reversed,
        position: sp.positions[state.selected.length] || ''
      });

      screen.querySelector('#tfan-prog').textContent = '\u5DF2\u9009 '+state.selected.length+' / '+need;

      if(state.selected.length >= need){
        cards.forEach(function(s){
          if(!s.classList.contains('tarot-fan-flipped')){
            s.classList.add('tarot-fan-picked');
          }
        });
        screen.querySelector('#tfan-view').disabled = false;
      }
    });
  });

  screen.querySelector('#tfan-back').addEventListener('click', function(){
    renderQuestion(root);
  });

  screen.querySelector('#tfan-view').addEventListener('click', function(){
    renderReveal(root);
  });
}

/* ===================================================================
   PHASE: REVEAL — selected cards fly to row
   =================================================================== */
function renderReveal(root){
  state.phase = 'reveal';
  var sp = SPREADS[state.spread];

  var revealCardsHTML = state.selected.map(function(sel, i){
    var dir = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D';
    var dirClass = sel.reversed ? 'tarot-rev' : 'tarot-up';
    var revClass = sel.reversed ? 'tarot-rev-visual' : '';
    var posLabel = sel.position || sp.positions[i] || '';
    return '<div class="tarot-reveal-card" data-ci="'+i+'">'+
      '<div class="tarot-reveal-card-pos">'+esc(posLabel)+'</div>'+
      '<div class="tarot-reveal-card-visual tarot-reveal-glow '+revClass+'">'+
        '<div class="tarot-reveal-card-cn">'+esc(sel.card.zh)+'</div>'+
        '<div class="tarot-reveal-card-en">'+esc(sel.card.en)+'</div>'+
        '<div class="tarot-reveal-card-dir '+dirClass+'">'+dir+'</div>'+
      '</div>'+
      '<div class="tarot-reveal-card-label">'+
        esc(sel.card.zh)+' <span class="tarot-reveal-orient-'+dirClass+'">'+dir+'</span>'+
      '</div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-reveal-stage">'+
      '<div class="tarot-reveal-header">'+
        '<div class="tarot-eyebrow">THE CARDS REVEALED</div>'+
        '<div class="tarot-reveal-title">'+esc(sp.name)+'</div>'+
        ornament()+
      '</div>'+
      '<div class="tarot-reveal-row" id="trev-row">'+revealCardsHTML+'</div>'+
      '<div class="tarot-reveal-actions">'+
        '<button class="tarot-btn" id="trev-reading">查看解读</button>'+
        '<button class="tarot-btn tarot-btn-ghost" id="trev-back">重新抽牌</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');

  // Stagger cards appearing
  var revealCards = screen.querySelectorAll('.tarot-reveal-card');
  revealCards.forEach(function(card, i){
    setTimeout(function(){
      card.classList.add('tarot-reveal-in');
    }, 100 + i * 150);
  });

  screen.querySelector('#trev-reading').addEventListener('click', function(){
    renderReading(root);
  });

  screen.querySelector('#trev-back').addEventListener('click', function(){
    state.deck = shuffle(ALL_CARDS);
    state.selected = [];
    renderShuffle(root);
  });
}

/* ===================================================================
   PHASE: READING — streaming AI interpretation
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

  // AI perspective section
  var aiSectionHTML = '';
  if(state.charId && state.charName){
    var aiBody = state.aiReadingDone ? mdToHtml(state.aiReadingText) :
      '<div class="tarot-reading-loading">'+esc(state.charName)+'正在思考...<span class="tarot-cursor"></span></div>';
    var avatarSrc = state.charAvatar || '';
    aiSectionHTML = '<div class="tarot-ai-section" id="tai-section">'+
      '<div class="tarot-ai-heading">AI PERSPECTIVE</div>'+
      '<div class="tarot-ai-avatar-row"><img class="tarot-ai-avatar-img" src="'+esc(avatarSrc)+'" alt="'+esc(state.charName)+'" onerror="this.style.display=\'none\'"></div>'+
      '<div class="tarot-ai-char-name">'+esc(state.charName)+'的视角</div>'+
      '<div class="tarot-ai-body" id="tai-body">'+aiBody+'</div>'+
    '</div>';
  }

  var html = '<div class="tarot-reading-overlay tarot-active">'+
    '<div class="tarot-reading-scroll">'+
      '<div class="tarot-reading-panel">'+
        '<div class="tarot-eyebrow">THE READING</div>'+
        '<div class="tarot-main-title">牌阵解读</div>'+
        ornament()+
        '<div class="tarot-reading-question">\u201C'+esc(question)+'\u201D</div>'+
        '<div class="tarot-chips-row">'+chipsHTML+'</div>'+
        '<div class="tarot-reading-body" id="tr-body">'+bodyContent+'</div>'+
        aiSectionHTML+
        '<div class="tarot-reading-actions">'+
          '<button class="tarot-btn" id="tr-retry">再问一次</button>'+
          '<button class="tarot-btn" id="tr-copy">誊抄</button>'+
          '<button class="tarot-btn" id="tr-new">新的占问</button>'+
        '</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  var old = root.querySelector('.tarot-reading-overlay');
  if(old) old.remove();
  root.insertAdjacentHTML('beforeend', html);

  // Bind chip clicks for card detail
  root.querySelectorAll('.tarot-chip').forEach(function(chip){
    chip.addEventListener('click',function(){
      showCardDetail(root, Number(chip.dataset.ci));
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
    state.aiReadingText = '';
    state.aiReadingDone = false;
    renderFanSelect(root);
  });

  root.querySelector('#tr-copy').addEventListener('click',function(){
    var fullText = state.readingText;
    if(state.aiReadingText) fullText += '\n\n--- '+state.charName+'的视角 ---\n'+state.aiReadingText;
    if(navigator.clipboard && fullText){
      navigator.clipboard.writeText(fullText).then(function(){
        showToast(root, '已誊抄至剪贴板');
      });
    }
  });

  root.querySelector('#tr-new').addEventListener('click',function(){
    var ol = root.querySelector('.tarot-reading-overlay');
    if(ol) ol.remove();
    state = {phase:'question',mode:state.mode,spread:null,question:'',deck:[],selected:[],readingText:'',readingDone:false,abortCtrl:null,charId:null,charName:'',charAvatar:'',charDescription:'',aiReadingText:'',aiReadingDone:false};
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
  var dir = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D';
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
        max_tokens:4000,
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
            var scrollEl = root.querySelector('.tarot-reading-scroll');
            if(scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        }catch(e){}
      }
    }

    bodyEl.innerHTML = mdToHtml(state.readingText);
    state.readingDone = true;

    // Save to history
    saveHistory({
      ts:Date.now(),
      question:state.question,
      spreadId:sp.id,
      spreadName:sp.name,
      cards:state.selected.map(function(sel){
        return {zh:sel.card.zh,en:sel.card.en,up:sel.card.up||'',rev:sel.card.rev||'',k_up:sel.card.k_up||'',k_rev:sel.card.k_rev||'',sym:sel.card.sym||'',astro:sel.card.astro||'',reversed:sel.reversed,position:sel.position};
      }),
      reading:state.readingText,
      charId:state.charId,
      charName:state.charName,
      aiReading:''
    });

    // Now fetch AI character perspective if selected
    if(state.charId && state.charName){
      fetchCharacterReading(root);
    }

  } catch(e){
    if(e.name === 'AbortError') return;
    console.error('[tarot] reading error:',e);
    if(bodyEl) bodyEl.innerHTML = '<div style="color:var(--t-wine)">解读失败：'+esc(e.message||'未知错误')+'</div>';
  }
}

/* ===================================================================
   AI CHARACTER PERSPECTIVE READING
   =================================================================== */
async function fetchCharacterReading(root){
  var aiBodyEl = root.querySelector('#tai-body');
  if(!aiBodyEl) return;

  try {
    var cfg = await window.loadGameApiConfig();
    if(!cfg.url || !cfg.key || !cfg.model){
      aiBodyEl.innerHTML = '<div style="color:var(--t-wine)">无法获取角色解读</div>';
      return;
    }

    var sp = SPREADS[state.spread];
    var charDesc = state.charDescription || state.charName;

    // Build card summary for the character
    var cardSummary = state.selected.map(function(sel, i){
      var pos = sel.position || sp.positions[i] || '';
      var dir = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D';
      return (i+1)+'. '+pos+': '+sel.card.zh+'('+dir+')';
    }).join('\n');

    var systemPrompt = '\u4F60\u662F' + state.charName + '\u3002\n\n' +
      '\u4F60\u7684\u7B80\u4ECB\uFF1A' + charDesc + '\n\n' +
      '\u73B0\u5728\uFF0C\u6709\u4EBA\u8FDB\u884C\u4E86\u4E00\u6B21\u5854\u7F57\u5360\u535C\u3002\u8BF7\u4F60\u4EE5\u81EA\u5DF1\u7684\u89C6\u89D2\u548C\u6027\u683C\uFF0C\u5BF9\u8FD9\u4E9B\u724C\u8FDB\u884C\u89E3\u8BFB\u3002\n\n' +
      '\u8981\u6C42\uFF1A\n' +
      '1. \u4EE5\u4F60\u7684\u8BED\u6C14\u548C\u98CE\u683C\u8FDB\u884C\u89E3\u8BFB\n' +
      '2. \u7ED3\u5408\u4F60\u7684\u7ECF\u5386\u548C\u4E27\u89C2\u70B9\u6765\u770B\u5F85\u8FD9\u4E9B\u724C\n' +
      '3. \u7ED9\u51FA\u4F60\u81EA\u5DF1\u7684\u770B\u6CD5\u548C\u5EFA\u8BAE\n' +
      '4. \u4F7F\u7528\u4E2D\u6587\u56DE\u7B54\uFF0C\u9002\u5EA6\u4F7F\u7528\u5C0F\u6807\u9898\u5206\u6BB5\n' +
      '5. \u5728\u6BCF\u4E2A\u5C0F\u6807\u9898\u524D\u52A0\u4E0A ## \u6807\u8BB0';

    var userMsg = '\u8FD9\u662F\u5360\u535C\u7684\u95EE\u9898\uFF1A' + (state.question || '\u6BCF\u65E5\u6307\u5F15') + '\n\n' +
      '\u724C\u9635\uFF1A\n' + cardSummary + '\n\n' +
      '\u4E3B\u8981\u89E3\u8BFB\uFF1A\n' + state.readingText.slice(0, 800) + '\n\n' +
      '\u8BF7\u4F60\u4EE5\u81EA\u5DF1\u7684\u89C6\u89D2\u89E3\u8BFB\u8FD9\u4E9B\u724C\u3002';

    var messages = [
      {role:'system', content:systemPrompt},
      {role:'user', content:userMsg}
    ];

    var abortCtrl = new AbortController();
    // Don't override main abortCtrl - create separate one for character reading

    var response = await fetch(cfg.url+'/chat/completions',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
      body:JSON.stringify({
        model:cfg.model,
        messages:messages,
        temperature:0.8,
        max_tokens:3000,
        stream:true
      }),
      signal:abortCtrl.signal
    });

    if(!response.ok){
      throw new Error('Character API error: '+response.status);
    }

    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    state.aiReadingText = '';

    aiBodyEl.innerHTML = '<span class="tarot-cursor"></span>';

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
            state.aiReadingText += delta.content;
            aiBodyEl.innerHTML = mdToHtml(state.aiReadingText)+'<span class="tarot-cursor"></span>';
            var scrollEl = root.querySelector('.tarot-reading-scroll');
            if(scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
          }
        }catch(e){}
      }
    }

    aiBodyEl.innerHTML = mdToHtml(state.aiReadingText);
    state.aiReadingDone = true;

    // Update history with AI reading
    try{
      var hist = getHistory();
      if(hist.length > 0 && hist[0].ts){
        hist[0].aiReading = state.aiReadingText;
        localStorage.setItem('tarot_history', JSON.stringify(hist));
      }
    }catch(e){}

    // Save to db.memories
    saveTarotMemory();

  } catch(e){
    if(e.name === 'AbortError') return;
    console.error('[tarot] character reading error:', e);
    if(aiBodyEl) aiBodyEl.innerHTML = '<div style="color:var(--t-wine)">角色解读失败</div>';
  }
}

/* ===================================================================
   SAVE TO db.memories
   =================================================================== */
async function saveTarotMemory(){
  try{
    if(!window.db || !window.db.memories) return;
    if(!state.charId) return;

    var ownerUid = null;
    try{
      var users = await window.db.characters.where('type').equals('user').toArray();
      if(users.length) ownerUid = String(users[0].id);
    }catch(e){}

    var sp = SPREADS[state.spread];
    var cardLines = state.selected.map(function(sel, i){
      var dir = sel.reversed ? '\u9006\u4F4D' : '\u6B63\u4F4D';
      var pos = sel.position || sp.positions[i] || '';
      return pos + '\uFF1A' + sel.card.zh + '(' + dir + ')\u2014\u2014' + (sel.reversed ? sel.card.rev : sel.card.up);
    }).join('\n');

    var cardNames = state.selected.map(function(sel){
      var dir = sel.reversed ? '\u9006' : '';
      return sel.card.zh + dir;
    }).join('\u3001');

    // 用AI生成塔罗专属5板块格式记忆
    var memPrompt = '\u4F60\u662F\u8BB0\u5FC6\u6574\u7406\u5668\u3002\u8BF7\u5C06\u4EE5\u4E0B\u5854\u7F57\u5360\u535C\u7ED3\u679C\u6574\u7406\u4E3A\u7ED3\u6784\u5316\u8BB0\u5FC6\u3002\n\n' +
      '\u5360\u535C\u9635\uFF1A' + sp.name + '\n' +
      '\u95EE\u9898\uFF1A' + (state.question || '\u6BCF\u65E5\u6307\u5F15') + '\n' +
      '\u62BD\u724C\u7ED3\u679C\uFF1A\n' + cardLines + '\n' +
      (state.readingText ? '\u5F15\u64CE\u89E3\u8BFB\u6458\u8981\uFF1A' + state.readingText.slice(0, 300) + '\n' : '') +
      (state.aiReadingText ? (state.charName || '\u89D2\u8272') + '\u89C6\u89D2\u89E3\u8BFB\u6458\u8981\uFF1A' + state.aiReadingText.slice(0, 300) + '\n' : '') +
      '\n\u8BF7\u6309\u4EE5\u4E0B5\u4E2A\u677F\u5757\u683C\u5F0F\u8F93\u51FA\uFF1A\n' +
      '\u3010\u5360\u535C\u4FE1\u606F\u3011\u724C\u9635\u540D\u79F0\u3001\u95EE\u9898\u3001\u62BD\u5230\u7684\u724C\u548C\u65B9\u4F4D\n' +
      '\u3010\u6838\u5FC3\u542F\u793A\u3011\u724C\u9762\u4F20\u8FBE\u7684\u6700\u91CD\u8981\u4FE1\u606F\uFF0C2-3\u53E5\n' +
      '\u3010\u60C5\u611F\u5730\u56FE\u3011\u724C\u9762\u663E\u793A\u7684\u60C5\u611F\u72B6\u6001\u548C\u53D8\u5316\u8D8B\u52BF\n' +
      '\u3010\u5F85\u89E3\u7B54\u9898\u3011\u724C\u9762\u63D0\u793A\u4F46\u672A\u5B8C\u5168\u89E3\u7B54\u7684\u95EE\u9898\n' +
      '\u3010\u884C\u52A8\u5EFA\u8BAE\u3011\u57FA\u4E8E\u724C\u9762\u7684\u5177\u4F53\u5EFA\u8BAE\uFF0C1-2\u6761\n' +
      '\n\u7B80\u6D01\u660E\u4E86\uFF0C\u6BCF\u677F\u57572-3\u53E5\u3002\u4E0D\u8981\u7528emoji\u3002';

    var memContent = '';
    try{
      if(window.callAI){
        memContent = await window.callAI([{role:'user',content:memPrompt}],{charAntiDrift:true});
        if(typeof memContent === 'string') memContent = memContent.replace(/```[\s\S]*?```/g,'').trim();
      }
    }catch(e){ console.warn('[tarot] AI memory gen failed:', e); }

    // fallback: 手动拼接
    if(!memContent){
      memContent = '\u3010\u5360\u535C\u4FE1\u606F\u3011' + sp.name + '\uFF0C\u95EE\u9898\uFF1A' + (state.question || '\u6BCF\u65E5\u6307\u5F15') + '\n' +
        '\u3010\u6838\u5FC3\u542F\u793A\u3011' + cardNames + '\n' +
        '\u3010\u60C5\u611F\u5730\u56FE\u3011\u5F85\u89E3\u8BFB\n' +
        '\u3010\u5F85\u89E3\u7B54\u9898\u3011\u65E0\n' +
        '\u3010\u884C\u52A8\u5EFA\u8BAE\u3011\u65E0';
    }

    var title = '\u5854\u7F57: ' + (state.question || '\u6BCF\u65E5\u6307\u5F15').slice(0, 20);

    var keywords = ['\u5854\u7F57', sp.name];
    state.selected.forEach(function(sel){
      if(keywords.length < 8) keywords.push(sel.card.zh);
    });

    await window.db.memories.add({
      ownerUid: ownerUid || 'default',
      charId: state.charId,
      chatId: 'tarot_' + state.charId,
      title: title,
      content: memContent,
      keywords: keywords.slice(0, 8),
      valence: 0,
      arousal: 0.3,
      importance: 5,
      embedding: null,
      status: 'active',
      sourceMsgStartId: null,
      sourceMsgEndId: null,
      sourceAt: Date.now(),
      sourceType: 'tarot',
      decayPercent: 80,
      isLongTerm: false,
      injectionLayer: 2,
      participants: [],
      lastRecalledAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastAccessedAt: null,
      accessCount: 0
    });

    console.log('[tarot] memory saved for char:', state.charId);
  }catch(e){
    console.warn('[tarot] save memory failed:', e);
  }
}

/* ===================================================================
   API SETTINGS
   =================================================================== */
function showTarotApiSettings(root) {
  var existing = root.querySelector('.tarot-settings-panel');
  if (existing) { existing.remove(); return; }

  var panel = document.createElement('div');
  panel.className = 'tarot-settings-panel';
  panel.innerHTML =
    '<div class="tarot-settings-title">\u795E\u8C1E\u6765\u6E90\u8BBE\u7F6E</div>' +
    '<div class="tarot-settings-status" id="tarot-api-status">\u68C0\u67E5\u4E2D...</div>' +
    '<div class="tarot-settings-actions">' +
      '<button class="tarot-ritual-btn" id="tarot-sync-main">\u540C\u6B65\u4E3BAPI\u914D\u7F6E</button>' +
      '<button class="tarot-ritual-btn" id="tarot-settings-close">\u5173\u95ED</button>' +
    '</div>';

  root.appendChild(panel);
  checkTarotApiStatus();

  panel.querySelector('#tarot-sync-main').addEventListener('click', async function() {
    try {
      var rows = await db.config.bulkGet(['apiBaseUrl', 'apiKey', 'apiModel']);
      var v = function(r) { return r ? r.value : null };
      var url = v(rows[0]), key = v(rows[1]), model = v(rows[2]);
      if (!url || !key || !model) {
        window.toast && window.toast('\u4E3BAPI\u914D\u7F6E\u4E0D\u5B8C\u6574\uFF0C\u8BF7\u5148\u5728\u8BBE\u7F6E\u914D\u7F6E\u4E3BAPI');
        return;
      }
      await Promise.all([
        db.config.put({ key: 'gameApiBaseUrl', value: url }),
        db.config.put({ key: 'gameApiKey', value: key }),
        db.config.put({ key: 'gameApiModel', value: model })
      ]);
      window._gameApiConfigCache = null;
      window.toast && window.toast('\u5DF2\u540C\u6B65\u4E3BAPI\u914D\u7F6E');
      checkTarotApiStatus();
    } catch(e) {
      window.toast && window.toast('\u540C\u6B65\u5931\u8D25: ' + e.message);
    }
  });

  panel.querySelector('#tarot-settings-close').addEventListener('click', function() {
    panel.remove();
  });
}

function checkTarotApiStatus() {
  var el = document.getElementById('tarot-api-status');
  if (!el || !window.loadGameApiConfig) { if(el) el.textContent = '\u65E0\u6CD5\u8BFB\u53D6\u914D\u7F6E'; return; }
  window.loadGameApiConfig().then(function(cfg) {
    if (cfg.url && cfg.key && cfg.model) {
      el.innerHTML = '<span style="color:#7ab87a">\u2713</span> ' + esc(cfg.model);
    } else {
      el.innerHTML = '<span style="color:var(--t-wine)">\u2717</span> \u672A\u914D\u7F6E\u2014\u2014\u8BF7\u540C\u6B65\u4E3BAPI\u6216\u5728\u6E38\u620F\u5927\u53E5\u8BBE\u7F6E';
    }
  });
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

  var settingsBtn = document.createElement('button');
  settingsBtn.className = 'tarot-settings-btn';
  settingsBtn.innerHTML = '\u2699';
  settingsBtn.title = 'API设置';
  settingsBtn.addEventListener('click', function(){ showTarotApiSettings(root); });
  root.appendChild(settingsBtn);

  var phases = document.createElement('div');
  phases.className = 'tarot-phases';
  root.appendChild(phases);

  var app = document.getElementById('app') || document.body;
  app.appendChild(root);

  state = {phase:'question',mode:'auto',spread:null,question:'',deck:[],selected:[],readingText:'',readingDone:false,abortCtrl:null,charId:null,charName:'',charAvatar:'',charDescription:'',aiReadingText:'',aiReadingDone:false};
  _characters = [];
  renderQuestion(root);
};

})()
