// tarot-page.js — 月月机 塔罗占卜 v7（视觉/交互重制版）
// 流程：question → shuffle → arc-select → reveal → reading
// 改造要点：
//   · 选牌改为「贴左弧线 + 可拖动旋转」，无限环绕
//   · 牌面使用真实塔罗牌图（RWS 公版扫描），缺图时降级为程序化 SVG 牌面
//   · 三段背景：bg-1 问卜（纸墨）/ bg-2 洗牌抽牌（夜）/ bg-3 解读（圣光）
//   · 洗牌/抽牌/揭示动效增强；AI 角色视角；记忆落库；历史回看
;(function() {
'use strict'

/* ===================================================================
   CARD DATA — 78 张完整牌义（RWS 传统 · 占星 decan · 图像志）
   由 wanwan-staging/tarot-work/tarot-deck.json 生成
   =================================================================== */
var CARD_DATA = [{"id":"M00","major":true,"suit":null,"rank":null,"rankZh":"","rankEn":"","numeral":"0","zh":"愚者","en":"The Fool","astro":"天王星 · 风","element":"","k_up":"新的开始 · 纯真 · 冒险 · 无限可能 · 信仰之跃","k_rev":"鲁莽 · 欠考虑 · 轻率 · 恐惧改变 · 停滞","up":"纯粹的起点，带着天真与信任跃入未知。牌面显示旅程尚未展开，一切皆有可能，以开放之心迎接命运的第一步。","rev":"轻率冒进、缺乏盘算，或因恐惧而寸步不前。提醒审视计划中的疏漏，勿让天真变成鲁莽。","sym":"悬崖边的旅人、脚边小白犬、手中白玫瑰与行囊、头顶旭日、远山","motif":"M00"},{"id":"M01","major":true,"suit":null,"rank":1,"rankZh":"","rankEn":"","numeral":"I","zh":"魔术师","en":"The Magician","astro":"水星","element":"","k_up":"显化 · 意志 · 资源在握 · 行动与统一","k_rev":"操纵 · 才能误用 · 意志涣散 · 欺瞒","up":"意志与行动合一的时刻。桌上四元素俱备，一手指天一手指地，是将灵感落实为现实的显化之力。","rev":"才能被误用或意志涣散，言语操纵、夸下海口。须警惕自欺与欺人，回到真诚的创造。","sym":"头侧无限符号、指天指地之手、桌上权杖圣杯宝剑星币、头顶倒八与玫瑰、缠绕的百合","motif":"M01"},{"id":"M02","major":true,"suit":null,"rank":2,"rankZh":"","rankEn":"","numeral":"II","zh":"女祭司","en":"The High Priestess","astro":"月亮","element":"","k_up":"直觉 · 潜意识 · 内在智慧 · 静默 · 隐秘","k_rev":"忽视直觉 · 隐秘泄露 · 表面化 · 内在迷雾","up":"帷幕之后藏着深处的知识。她静坐于两柱之间，唯有静心与直觉能够抵达答案——此刻宜倾听内在而非急于行动。","rev":"与内在失联、忽视直觉的低语，或隐藏之事逐渐浮出水面。宜恢复与自己深处的连接。","sym":"黑白双柱（B 与 J）、帷幕上的石榴与棕榈、月冠、膝头 TORA 卷轴、脚畔新月","motif":"M02"},{"id":"M03","major":true,"suit":null,"rank":3,"rankZh":"","rankEn":"","numeral":"III","zh":"皇后","en":"The Empress","astro":"金星","element":"","k_up":"丰盛 · 滋养 · 感官之美 · 创造 · 生育","k_rev":"依赖 · 过度保护 · 创造阻塞 · 自我忽视","up":"大地般的丰饶与滋养。万物生长的花园、柔软的织物与麦穗，象征创造力的成熟阶段与感官的富足。","rev":"创造力受阻、过度付出或过度依赖。提醒也以皇后之姿滋养自己，恢复生命力的流动。","sym":"麦田、心形盾牌上的金星符号、繁花枕榻、后冠十二星、茂密林野","motif":"M03"},{"id":"M04","major":true,"suit":null,"rank":4,"rankZh":"","rankEn":"","numeral":"IV","zh":"皇帝","en":"The Emperor","astro":"白羊座","element":"","k_up":"秩序 · 权威 · 稳固 · 守护 · 纪律","k_rev":"僵化 · 控制欲 · 滥用权力 · 失序","up":"以理性与纪律构筑的稳固秩序。石座与甲胄象征疆域与责任，是运用权威建立结构、承担守护的时刻。","rev":"权威走向僵化或独断，控制欲压过担当。宜松开紧握之手，让规则服务于人而非相反。","sym":"石质王座上的公羊头饰、甲胄、权杖与ORB球、荒峻山脉","motif":"M04"},{"id":"M05","major":true,"suit":null,"rank":5,"rankZh":"","rankEn":"","numeral":"V","zh":"教皇","en":"The Hierophant","astro":"金牛座","element":"","k_up":"传统 · 信仰 · 导师 · 教育 · 仪式","k_rev":"教条 · 破除传统 · 独立求索 · 伪善权威","up":"正统智慧的传承者。两位侍者跪于阶前，祝福之手授予入门的钥匙——寻求良师、遵循体系、以仪式安顿心灵。","rev":"教条僵化、盲目服从，或毅然走出体制独立求索。质疑权威的正当性，知识须亲证。","sym":"三重冠、右手祝福印、三重十字权杖、交叉钥匙、双柱圣殿、跪拜的二侍者","motif":"M05"},{"id":"M06","major":true,"suit":null,"rank":6,"rankZh":"","rankEn":"","numeral":"VI","zh":"恋人","en":"The Lovers","astro":"双子座","element":"","k_up":"结合 · 爱 · 和谐 · 抉择 · 价值契合","k_rev":"失衡 · 价值冲突 · 诱惑 · 疏离","up":"以爱为名的结合与重要的价值抉择。天使之上祝福，赤裸的男女立于生命树与知识树之间——选择出于真心。","rev":"关系失衡、价值观冲突或受诱惑所扰。抉择若背离本心，随之而来的是分裂与不安。","sym":"大天使拉斐尔、赤裸男女、生命树与火蛇、知识树与五果、远山太阳","motif":"M06"},{"id":"M07","major":true,"suit":null,"rank":7,"rankZh":"","rankEn":"","numeral":"VII","zh":"战车","en":"The Chariot","astro":"巨蟹座","element":"","k_up":"胜利 · 意志 · 驾驭对立 · 纪律前行","k_rev":"失控 · 方向迷失 · 阻力 · 强攻失当","up":"以意志驾驭相反的力量。黑白双斯芬克斯、星冠与城池——胜利不靠蛮力，而靠统合矛盾、紧握方向。","rev":"方向盘失守、蛮力受挫。宜重新收拢意志，勿让情绪牵引战车偏离正道。","sym":"方形城垣、黑白斯芬克斯、新月肩章、星形王冠、翼状日轮、黑白双柱","motif":"M07"},{"id":"M08","major":true,"suit":null,"rank":8,"rankZh":"","rankEn":"","numeral":"VIII","zh":"力量","en":"Strength","astro":"狮子座","element":"","k_up":"温柔的勇气 · 驯服本能 · 耐心 · 慈悲之力","k_rev":"自我怀疑 · 本能失控 · 软弱 · 强行压制","up":"真正的力量是温柔。花环轻抚狮鬃，以耐心与慈悲驯服本能，而非以暴力镇压——内在之狮与内在之光共存。","rev":"自我怀疑、本能压过理性，或以强权勉强压制。力量来自接纳而非否认内心的兽。","sym":"无限符号、花环与狮、白裙少女、狮口轻合、山野","motif":"M08"},{"id":"M09","major":true,"suit":null,"rank":9,"rankZh":"","rankEn":"","numeral":"IX","zh":"隐士","en":"The Hermit","astro":"处女座","element":"","k_up":"内省 · 寻求真理 · 独处 · 指引之光","k_rev":"孤立 · 逃避 · 拒绝指引 · 迷失","up":"提灯独行于雪峰，只照足下三步。是内省与沉淀的阶段，真理在静默中显现，智慧终将照亮他人。","rev":"以孤僻代替独处、拒绝他人的灯，或在黑暗中徘徊不肯点火。内省不等于封闭。","sym":"六芒星提灯、灰袍与兜帽、雪峰、持杖、长须","motif":"M09"},{"id":"M10","major":true,"suit":null,"rank":10,"rankZh":"","rankEn":"","numeral":"X","zh":"命运之轮","en":"Wheel of Fortune","astro":"木星","element":"","k_up":"转机 · 周期 · 命运之流 · 因果节点","k_rev":"时运不济 · 抗拒变化 · 周期断裂 · 低迷","up":"巨轮转动，起落皆是周期。轮顶狮身人面持剑不动，阿努比斯升、泰丰降，四活物执书守候四方——命运的节点已至，顺势而转。","rev":"逆着变化挣扎、时运胶着。记住轮会再转，此刻是周期的一段而非终点。","sym":"中央巨轮与 TORA、狮身人面像持剑、阿努比斯与蛇形泰丰、四角书卷活物（人鹰狮牛）","motif":"M10"},{"id":"M11","major":true,"suit":null,"rank":11,"rankZh":"","rankEn":"","numeral":"XI","zh":"正义","en":"Justice","astro":"天秤座","element":"","k_up":"公正 · 因果 · 真相 · 权衡 · 责任","k_rev":"偏颇 · 逃避责任 · 不公 · 失衡","up":"一手持天平一手持剑，帘幕开启——因果分明，抉择与行动必承其果。诚实面对，天平自有分晓。","rev":"天平倾斜、回避应负之责或遭遇不公。先自省：何处少了诚实，何处多了偏袒。","sym":"天平与直剑、红袍、王冠中的方形徽记、双柱间紫帘、足尖微露","motif":"M11"},{"id":"M12","major":true,"suit":null,"rank":12,"rankZh":"","rankEn":"","numeral":"XII","zh":"倒吊人","en":"The Hanged Man","astro":"海王星 · 水","element":"","k_up":"悬置 · 以退为进 · 反转视角 · 有意义的牺牲","k_rev":"无谓牺牲 · 停滞 · 殉道心态 · 抗拒放手","up":"倒悬于一字木架，足踝结成反三，面容却安然。停下、倒转视角，在悬置中看见平常看不见的真相。","rev":"牺牲无意义、停滞成空转，或抗拒必要的停顿。问自己：究竟在为谁悬挂。","sym":"倒悬的绿衣、胫骨成反三、一字架与绳、头顶光晕、生死之树修剪成架","motif":"M12"},{"id":"M13","major":true,"suit":null,"rank":13,"rankZh":"","rankEn":"","numeral":"XIII","zh":"死神","en":"Death","astro":"天蝎座","element":"","k_up":"结束与重生 · 彻底转变 · 放手 · 蜕变","k_rev":"抗拒终结 · 僵局 · 延迟转变 · 执守旧物","up":"白马缓缓行来，王座亦须低头。某一章确实结束了——结束之中孕育重生，放手才能迎接新的黎明。","rev":"抗拒必然的告别，旧局僵持不散。转变不会被无限推迟，只会更痛。","sym":"白马上黑甲骸骨、五瓣黑玫瑰旗、倒地国王、主教合十、孩童献花、双塔与日出","motif":"M13"},{"id":"M14","major":true,"suit":null,"rank":14,"rankZh":"","rankEn":"","numeral":"XIV","zh":"节制","en":"Temperance","astro":"射手座","element":"","k_up":"调和 · 中道 · 融合 · 耐心 · 流通","k_rev":"失衡 · 极端 · 失耐 · 不调和","up":"双足分踏水陆，两盏之间水流通畅无溢。是炼金般的调和艺术：将不同的元素以耐心融合为中道。","rev":"失衡与极端、水溢杯外。快而乱不如慢而准，调和需要时间。","sym":"大天使米迦勒、双杯流水、一足水中一足岸上、胸前水三角、鸢尾花、远山光冕","motif":"M14"},{"id":"M15","major":true,"suit":null,"rank":15,"rankZh":"","rankEn":"","numeral":"XV","zh":"恶魔","en":"The Devil","astro":"摩羯座","element":"","k_up":"束缚 · 欲望执念 · 物质诱惑 · 阴影","k_rev":"挣脱束缚 · 觉察 · 释放 · 重获自由","up":"锁链松垮地挂在颈间——枷锁大半是自愿戴上的。直视欲望与阴影，觉察执念如何假扮成需要。","rev":"链条脱落，觉察带来解脱。阴影被看见的那一刻，它的支配就松动了。","sym":"角羊恶魔、倒五芒星、赤裸双人的松链、火把、倒挂的锁链、黑墙","motif":"M15"},{"id":"M16","major":true,"suit":null,"rank":16,"rankZh":"","rankEn":"","numeral":"XVI","zh":"高塔","en":"The Tower","astro":"火星","element":"","k_up":"骤变 · 幻象崩塌 · 必要之毁灭 · 觉醒之雷","k_rev":"延迟的灾变 · 逃避崩塌 · 内在动荡 · 苦撑危局","up":"雷霆击中高塔，加冕者坠落，火焰四散——建立于虚妄之上的结构必被真相击穿。毁灭即是解放的开始。","rev":"灾变被延迟或勉强压抑，塔基的裂痕仍在加深。与其苦撑危局，不如主动拆解重建。","sym":"被雷击的双塔与金色王冠、坠落二人、二十二点火焰、灰雨与闪电","motif":"M16"},{"id":"M17","major":true,"suit":null,"rank":17,"rankZh":"","rankEn":"","numeral":"XVII","zh":"星星","en":"The Star","astro":"水瓶座","element":"","k_up":"希望 · 疗愈 · 灵感 · 信仰之泉","k_rev":"失望 · 信念动摇 · 灵感枯竭 · 心灰","up":"暴风雨之后，巨星永恒。少女双盏倾水，一注入池一注润土——希望的活水依旧流淌，指引夜行者。","rev":"希望之光暂时黯淡、灵感枯竭。星光未灭，只是被云遮住——让信念重新对准泉眼。","sym":"八芒巨星与七星环绕、双盏倾水、赤裸水畔少女、朱鹭鸟、远山","motif":"M17"},{"id":"M18","major":true,"suit":null,"rank":18,"rankZh":"","rankEn":"","numeral":"XVIII","zh":"月亮","en":"The Moon","astro":"双鱼座","element":"","k_up":"潜意识 · 幻象 · 不安 · 想象之力 · 夜路","k_rev":"迷雾散去 · 恐惧消退 · 真相渐明 · 释放幻觉","up":"月面垂滴成排的月光，双塔之间小径蜿蜒入夜——犬与狼对月而吠，龙虾自池中初现。此路须以直觉夜行，幻象与真实交错。","rev":"迷雾开始消散，恐惧显出原形。月亮的功课是穿越而非回避，黎明已在不远。","sym":"闭容侧脸之月、十五道垂光、双塔、犬与狼、月下池中龙虾、蜿蜒小径","motif":"M18"},{"id":"M19","major":true,"suit":null,"rank":19,"rankZh":"","rankEn":"","numeral":"XIX","zh":"太阳","en":"The Sun","astro":"太阳","element":"","k_up":"喜悦 · 成功 · 活力 · 光明 · 纯真之乐","k_rev":"暂时阴霾 · 过度乐观 · 迟来的成功 · 活力低落","up":"向日葵墙前孩童骑白马，赤身披红氅——毫无遮蔽的喜悦与成功。光明之下万物生长，享受应得的欢庆。","rev":"阳光被云暂掩、乐中生忧。成功或许迟到，但从未取消；莫让过度乐观灼伤枝叶。","sym":"直射的太阳与交替射线、向日葵墙、白马赤子、红氅与白花、欢快双生","motif":"M19"},{"id":"M20","major":true,"suit":null,"rank":20,"rankZh":"","rankEn":"","numeral":"XX","zh":"审判","en":"Judgement","astro":"冥王星 · 火","element":"","k_up":"觉醒召唤 · 清算与宽恕 · 重生 · 使命","k_rev":"自我怀疑 · 逃避召唤 · 苛责自判 · 停滞","up":"号角自棺中吹响，亡者应声而起，臂上画着解放的记号——过去的一切被清算、被宽恕，听完内在的召唤再启新程。","rev":"对召唤装聋作哑、以自责代替反省。审判不是定罪，而是允许自己重新站起来。","sym":"大天使加百列与号角、号旗上的十字、棺中起身的三人（男女子与孩童）、海面与远山","motif":"M20"},{"id":"M21","major":true,"suit":null,"rank":21,"rankZh":"","rankEn":"","numeral":"XXI","zh":"世界","en":"The World","astro":"土星","element":"","k_up":"完成 · 圆融 · 整合 · 旅程的圆满","k_rev":"未竟之圆 · 草率收尾 · 延迟完成 · 悬置","up":"桂冠之环中的舞者手持双杖，四活物守候四角——漫长旅程在此圆满收束。为自己加冕，然后带着完整的经验开始下一段旅程。","rev":"圆环差一扣、收尾草率或悬而未决。补完最后的细节，圆满值得善终。","sym":"月桂椭圆环与双杖、环中起舞的少女、四角活物（人鹰狮牛）、飘带","motif":"M21"},{"id":"W01","major":false,"suit":"wands","rank":1,"rankZh":"Ace","rankEn":"Ace","numeral":"A","zh":"权杖Ace","en":"Ace of Wands","astro":"火之源头（Ace）","element":"火","k_up":"灵感之火 · 新事业 · 纯粹意志 · 创造迸发","k_rev":"火种熄灭 · 延迟 · 缺乏方向 · 热情受阻","up":"权杖中伸出嫩芽与新叶——纯粹的意志之火点燃新的创造。是启程、远行与新事业的第一推动。","rev":"火种受潮、时机未熟或方向未明。让火苗在炉中养好，再谈燎原。","sym":"权杖·Ace","motif":"wands-1"},{"id":"W02","major":false,"suit":"wands","rank":2,"rankZh":"二","rankEn":"Two","numeral":"II","zh":"权杖二","en":"Two of Wands","astro":"火星 · 白羊座 I","element":"火","k_up":"主宰 · 规划蓝图 · 个人权力 · 望向未知","k_rev":"惧怕未知 · 计划紊乱 · 滞于舒适 · 犹疑","up":"左手握球右手持杖，立于城垣远眺海面——世界在手，下一片海在望。规划而非等待，主动掌握版图。","rev":"对未知过度提防、蓝图悬而不决。小权力握得太紧，大格局进不来。","sym":"权杖·二","motif":"wands-2"},{"id":"W03","major":false,"suit":"wands","rank":3,"rankZh":"三","rankEn":"Three","numeral":"III","zh":"权杖三","en":"Three of Wands","astro":"太阳 · 白羊座 II","element":"火","k_up":"远见 · 已发之船 · 等待回音 · 扩张格局","k_rev":"眼光短浅 · 延误 · 扩张受挫 · 缺乏前瞻","up":"船已离港，立于崖上静观风帆——付出已经上路，此刻是等待与保持格局的阶段。","rev":"延误的回音、收缩的计划。确认已尽力，然后允许时间行船。","sym":"权杖·三","motif":"wands-3"},{"id":"W04","major":false,"suit":"wands","rank":4,"rankZh":"四","rankEn":"Four","numeral":"IV","zh":"权杖四","en":"Four of Wands","astro":"金星 · 白羊座 III","element":"火","k_up":"庆典 · 稳固之基 · 社群之喜 · 安顿","k_rev":"过渡不稳 · 缺乏支持 · 欢庆未至 · 家园动荡","up":"花棚之下四人举杯起舞——阶段性的安定与庆祝，值得在继续之前好好扎根、好好欢呼。","rev":"欢庆延后、根基轻浮。仪式感与安顿并非浪费时间，而是续航的燃料。","sym":"权杖·四","motif":"wands-4"},{"id":"W05","major":false,"suit":"wands","rank":5,"rankZh":"五","rankEn":"Five","numeral":"V","zh":"权杖五","en":"Five of Wands","astro":"土星 · 狮子座 I","element":"火","k_up":"竞争 · 冲突磨合 · 众声喧哗 · 演练之争","k_rev":"回避冲突 · 化解争执 · 内耗平息 · 压抑分歧","up":"五杖交错，争者势均力敌——这是观点的比武而非战争，混乱中藏着活力与磨合。","rev":"冲突被回避或刚刚平息。真正的分歧若不摆上台面，只会转入地下。","sym":"权杖·五","motif":"wands-5"},{"id":"W06","major":false,"suit":"wands","rank":6,"rankZh":"六","rankEn":"Six","numeral":"VI","zh":"权杖六","en":"Six of Wands","astro":"木星 · 狮子座 II","element":"火","k_up":"得胜 · 凯旋 · 公众认可 · 自信凯歌","k_rev":"失宠 · 傲慢 · 不获认可 · 凯旋成空","up":"白马上的胜者头戴桂冠、权杖缠花，众人随行——努力被看见的时刻，堂堂正正接受掌声。","rev":"掌声冷落、或胜利蒙尘。谦逊不是否认功劳，而是分清功劳归谁。","sym":"权杖·六","motif":"wands-6"},{"id":"W07","major":false,"suit":"wands","rank":7,"rankZh":"七","rankEn":"Seven","numeral":"VII","zh":"权杖七","en":"Seven of Wands","astro":"火星 · 狮子座 III","element":"火","k_up":"坚守阵地 · 以寡敌众 · 捍卫立场","k_rev":"寡不敌众 · 放弃抵抗 · 内心动摇 · 防线崩溃","up":"高地上以一敌六，脚下是敌方来势——立场值得捍卫，优势在于地势与决心。","rev":"守不住或不必守。分清值得捍卫的与沉没的，撤出也是一种战略。","sym":"权杖·七","motif":"wands-7"},{"id":"W08","major":false,"suit":"wands","rank":8,"rankZh":"八","rankEn":"Eight","numeral":"VIII","zh":"权杖八","en":"Eight of Wands","astro":"水星 · 射手座 I","element":"火","k_up":"疾行 · 讯息飞驰 · 事态速展 · 箭在弦上","k_rev":"延迟 · 受阻 · 仓促凌乱 · 消息迟滞","up":"八杖齐飞向天际，河流亦奔涌——停滞期结束，事态加速推进，回信与进展接踵而至。","rev":"箭矢迟滞、事务堵在半空。检查哪一环卡住，而非加倍施压。","sym":"权杖·八","motif":"wands-8"},{"id":"W09","major":false,"suit":"wands","rank":9,"rankZh":"九","rankEn":"Nine","numeral":"IX","zh":"权杖九","en":"Nine of Wands","astro":"月亮 · 射手座 II","element":"火","k_up":"最后防线 · 伤痕中的坚韧 · 警觉守望","k_rev":"力竭 · 防备过度 · 放弃在即 · 旧伤复发","up":"缠着绷带仍持杖守门——一路伤痕，但仍在站岗。最后一段最吃紧，也最接近城内。","rev":"疲惫到想放弃、或把所有人都当敌人。允许求助，防线不必一个人守。","sym":"权杖·九","motif":"wands-9"},{"id":"W10","major":false,"suit":"wands","rank":10,"rankZh":"十","rankEn":"Ten","numeral":"X","zh":"权杖十","en":"Ten of Wands","astro":"土星 · 射手座 III","element":"火","k_up":"重负 · 担至终点 · 责任压身 · 将卸之担","k_rev":"卸下重担 · 分派 · 不堪负荷 · 濒临崩溃","up":"十杖压背仍朝家中走去——责任已近尾声，但莫让逞强把人压垮在离门口十步的地方。","rev":"放下一些、托付一些。责任的价值以能否走到终点衡量，而非以背得多重衡量。","sym":"权杖·十","motif":"wands-10"},{"id":"C01","major":false,"suit":"cups","rank":1,"rankZh":"Ace","rankEn":"Ace","numeral":"A","zh":"圣杯Ace","en":"Ace of Cups","astro":"水之源头（Ace）","element":"水","k_up":"心之泉涌 · 新情感 · 爱之初始 · 灵性滋养","k_rev":"情感封闭 · 倒溢之杯 · 空虚 · 压抑感受","up":"云中之手奉上满溢之杯，鸽身圣灵探入，泉水在脚下汇流——情感的活水初开，爱的能量正在注入。","rev":"杯覆水覆、心门未开。感受没有消失，只是被扣住了。","sym":"圣杯·Ace","motif":"cups-1"},{"id":"C02","major":false,"suit":"cups","rank":2,"rankZh":"二","rankEn":"Two","numeral":"II","zh":"圣杯二","en":"Two of Cups","astro":"金星 · 巨蟹座 I","element":"水","k_up":"相遇相许 · 互惠之爱 · 盟约 · 心灵契合","k_rev":"失衡关系 · 裂痕 · 疏远 · 误解","up":"两人举杯相向，双蛇杖与狮首悬于其间——平等交换的承诺与疗愈的相遇，彼此看见。","rev":"天平倾斜、话不投机。关系的修复始于把双杯重新举回同一高度。","sym":"圣杯·二","motif":"cups-2"},{"id":"C03","major":false,"suit":"cups","rank":3,"rankZh":"三","rankEn":"Three","numeral":"III","zh":"圣杯三","en":"Three of Cups","astro":"水星 · 巨蟹座 II","element":"水","k_up":"欢聚 · 友谊之杯 · 共同庆祝 · 丰收时刻","k_rev":"三人成虎 · 闲言 · 过度放纵 · 友谊变调","up":"三杯高举，园中果实满枝，友人相拥而笑——共享的喜悦让快乐加倍，圈子是滋养而非消耗。","rev":"流言与暗涌、纵乐过头。细听笑声背后有没有第三张嘴。","sym":"圣杯·三","motif":"cups-3"},{"id":"C04","major":false,"suit":"cups","rank":4,"rankZh":"四","rankEn":"Four","numeral":"IV","zh":"圣杯四","en":"Four of Cups","astro":"月亮 · 巨蟹座 III","element":"水","k_up":"漠然倦怠 · 审视内在 · 错过的杯 · 重新评估","k_rev":"走出低潮 · 重燃兴趣 · 接纳新机 · 觉醒","up":"树下沉思者三杯置前，云中第四杯奉上而不见——倦怠不是没有机会，而是暂时看不见想要什么。","rev":"伸出的手被接住了。从树影里走出来，允许新的杯入眼。","sym":"圣杯·四","motif":"cups-4"},{"id":"C05","major":false,"suit":"cups","rank":5,"rankZh":"五","rankEn":"Five","numeral":"V","zh":"圣杯五","en":"Five of Cups","astro":"火星 · 天蝎座 I","element":"水","k_up":"失落哀悼 · 倾覆之杯 · 身后仍有立杯 · 悲而后明","k_rev":"接受 · 哀而后明 · 回归 · 释怀前行","up":"三杯倾覆于地，黑衣者垂首；身后立着两杯与归家之桥——丧失真实，但未失去一切。","rev":"转过身来。哀悼走到尽头时，桥一直在那里。","sym":"圣杯·五","motif":"cups-5"},{"id":"C06","major":false,"suit":"cups","rank":6,"rankZh":"六","rankEn":"Six","numeral":"VI","zh":"圣杯六","en":"Six of Cups","astro":"太阳 · 天蝎座 II","element":"水","k_up":"怀旧 · 纯真之礼 · 旧日温情 · 童年记忆","k_rev":"困于过去 · 理想化旧忆 · 放下旧物 · 重新出发","up":"旧园中童子以盛满白花之杯相赠——往昔的温柔馈赠今日的心，怀旧当为滋养而非牢笼。","rev":"旧日成了滤镜或枷锁。真正值得留住的，会以新的形式再来。","sym":"圣杯·六","motif":"cups-6"},{"id":"C07","major":false,"suit":"cups","rank":7,"rankZh":"七","rankEn":"Seven","numeral":"VII","zh":"圣杯七","en":"Seven of Cups","astro":"金星 · 天蝎座 III","element":"水","k_up":"幻梦林立 · 选项过载 · 白日梦与诱惑 · 辨识真愿","k_rev":"清醒抉择 · 幻灭见真 · 专注 · 明辨","up":"云中七杯各盛幻象：城堡、珠宝、面容、蛇、花环……皆是诱惑也是投射——愿望太多时，先分辨哪个才是自己的。","rev":"云雾散去，幻象现形。选定一个，其余的还它自由。","sym":"圣杯·七","motif":"cups-7"},{"id":"C08","major":false,"suit":"cups","rank":8,"rankZh":"八","rankEn":"Eight","numeral":"VIII","zh":"圣杯八","en":"Eight of Cups","astro":"土星 · 双鱼座 I","element":"水","k_up":"离开 · 转身向高处 · 舍弃不再滋养的 · 内在之旅","k_rev":"驻足不前 · 恐惧漂泊 · 徘徊旧路 · 逃避离开","up":"月隐云间，八杯叠起；背影走向山径——不是逃，是清醒地离开不再滋养的一切，去寻找缺的那一杯。","rev":"脚步在原地打转。离开的勇气不会因推迟而增加。","sym":"圣杯·八","motif":"cups-8"},{"id":"C09","major":false,"suit":"cups","rank":9,"rankZh":"九","rankEn":"Nine","numeral":"IX","zh":"圣杯九","en":"Nine of Cups","astro":"木星 · 双鱼座 II","element":"水","k_up":"愿望成真 · 心满意足 · 感官之悦 · 犒赏","k_rev":"物满心空 · 纵欲 · 愿望落空 · 表面幸福","up":"抱臂而坐的主人身后九杯呈弧排开——愿望清单逐项兑现的时刻，理直气壮地享受。","rev":"握着满桌的杯却不解渴。检查许愿的是不是别人的清单。","sym":"圣杯·九","motif":"cups-9"},{"id":"C10","major":false,"suit":"cups","rank":10,"rankZh":"十","rankEn":"Ten","numeral":"X","zh":"圣杯十","en":"Ten of Cups","astro":"火星 · 双鱼座 III","element":"水","k_up":"圆满之家 · 彩虹之杯 · 情感丰收 · 和谐","k_rev":"家庭失谐 · 理想幻灭 · 关系裂隙 · 愿景破裂","up":"十杯悬作彩虹拱，伴侣相偕仰望，孩童起舞——情感的圆满不是童话，是日复一日共同仰望的成果。","rev":"拱桥残缺、各怀心事。家庭的彩虹需要每颗水滴都在场。","sym":"圣杯·十","motif":"cups-10"},{"id":"S01","major":false,"suit":"swords","rank":1,"rankZh":"Ace","rankEn":"Ace","numeral":"A","zh":"宝剑Ace","en":"Ace of Swords","astro":"风之源头（Ace）","element":"风","k_up":"思之利刃 · 真相之剑 · 心智突破 · 清晰","k_rev":"思绪混乱 · 真相扭曲 · 言语伤人 · 滥用智巧","up":"云中王冠捧出竖直之剑，剑尖破界——一念斩断混沌，真相与正义的力量降临，说破该说破的。","rev":"剑锋偏斜、词不达意或刻意曲解。先厘清事实，再挥动语言。","sym":"宝剑·Ace","motif":"swords-1"},{"id":"S02","major":false,"suit":"swords","rank":2,"rankZh":"二","rankEn":"Two","numeral":"II","zh":"宝剑二","en":"Two of Swords","astro":"月亮 · 天秤座 I","element":"风","k_up":"僵局 · 蒙眼权衡 · 回避抉择 · 静待时机","k_rev":"揭开眼罩 · 破僵局 · 决断 · 信息流动","up":"蒙眼者持双剑交叉而坐，海潮在后——两难不是靠等解决的，但此刻的信息确实不全。","rev":"眼罩揭开，剑要落下。迟来的决断好过完美的拖延。","sym":"宝剑·二","motif":"swords-2"},{"id":"S03","major":false,"suit":"swords","rank":3,"rankZh":"三","rankEn":"Three","numeral":"III","zh":"宝剑三","en":"Three of Swords","astro":"土星 · 天秤座 II","element":"风","k_up":"心碎之痛 · 利刃穿心 · 直言的刺痛 · 风暴悲恸","k_rev":"疗愈开始 · 宽恕 · 痛之释出 · 走出阴霾","up":"三剑穿心，冷雨如注——真相或离别带来的刺痛是真实的，允许它下雨。","rev":"剑逐一拔出，云缝透光。痛会过去，教训留下。","sym":"宝剑·三","motif":"swords-3"},{"id":"S04","major":false,"suit":"swords","rank":4,"rankZh":"四","rankEn":"Four","numeral":"IV","zh":"宝剑四","en":"Four of Swords","astro":"木星 · 天秤座 III","element":"风","k_up":"静养 · 退守复原 · 心智休憩 · 暂停","k_rev":"复苏 · 重新入世 · 静极思动 · 拖延休整","up":"石棺上剑者安卧，双手合十，三剑悬壁、一剑随棺——战斗间隙的必要停战，修整即是战略。","rev":"休息已足，起身的时刻到了；或以休养为名的无限期逃避。","sym":"宝剑·四","motif":"swords-4"},{"id":"S05","major":false,"suit":"swords","rank":5,"rankZh":"五","rankEn":"Five","numeral":"V","zh":"宝剑五","en":"Five of Swords","astro":"金星 · 双子座 I","element":"风","k_up":"惨胜 · 不光彩的得胜 · 冲突的代价 · 溃败","k_rev":"和解 · 放下旧怨 · 悔意 · 停止纷争","up":"拾剑者冷漠收场，败者离场垂首——赢了争斗、输了人心的时刻，先问代价值不值。","rev":"放下剑柄。有些胜利的第二名才是赢家。","sym":"宝剑·五","motif":"swords-5"},{"id":"S06","major":false,"suit":"swords","rank":6,"rankZh":"六","rankEn":"Six","numeral":"VI","zh":"宝剑六","en":"Six of Swords","astro":"水星 · 双子座 II","element":"风","k_up":"渡向平静 · 渐行渐稳 · 离伤赴安 · 同行","k_rev":"无法离开 · 旧事重演 · 未竟过渡 · 搁浅","up":"摆渡人静篙渡水，船中蒙面者与幼子同行，六剑立船——带着伤痕离开风暴水域，水面渐平。","rev":"船迟迟不开或中途折返。允许自己真的抵达对岸。","sym":"宝剑·六","motif":"swords-6"},{"id":"S07","major":false,"suit":"swords","rank":7,"rankZh":"七","rankEn":"Seven","numeral":"VII","zh":"宝剑七","en":"Seven of Swords","astro":"月亮 · 水瓶座 I","element":"风","k_up":"独行诡道 · 策略试探 · 暗中取巧","k_rev":"东窗事发 · 归还 · 坦白 · 自欺现形","up":"军营前携五剑而走者回头张望——策略没有错，但手段正在悄悄越过底线。","rev":"赃物归还、谎言拆穿。诚实在此局中的收益高于机巧。","sym":"宝剑·七","motif":"swords-7"},{"id":"S08","major":false,"suit":"swords","rank":8,"rankZh":"八","rankEn":"Eight","numeral":"VIII","zh":"宝剑八","en":"Eight of Swords","astro":"木星 · 双子座 III","element":"风","k_up":"心困自缚 · 思维之笼 · 受限之见 · 蒙眼绑身","k_rev":"自我松绑 · 看清枷锁 · 重获自由 · 新视角","up":"蒙眼者被八剑围困于沼地——束缚多半松松垮垮，笼子首先是想象出来的。","rev":"低头看见绑绳是活的。挪动一只脚，铁阵便有了缺口。","sym":"宝剑·八","motif":"swords-8"},{"id":"S09","major":false,"suit":"swords","rank":9,"rankZh":"九","rankEn":"Nine","numeral":"IX","zh":"宝剑九","en":"Nine of Swords","astro":"火星 · 双子座 III","element":"风","k_up":"忧思之夜 · 梦魇缠绕 · 焦虑放大 · 黎明前最暗","k_rev":"坦白求援 · 夜尽天明 · 焦虑缓解 · 直面恐惧","up":"坐起掩面，床上九剑横陈、彩毯绣剑与玫瑰——夜里的焦虑擅长放大三倍，天亮再看大半不成立。","rev":"开灯、开口、开窗。恐惧在说出口的瞬间缩小。","sym":"宝剑·九","motif":"swords-9"},{"id":"S10","major":false,"suit":"swords","rank":10,"rankZh":"十","rankEn":"Ten","numeral":"X","zh":"宝剑十","en":"Ten of Swords","astro":"太阳 · 双子座 III","element":"风","k_up":"终局之痛 · 背刺 · 谷底 · 黎明在望","k_rev":"复原 · 缓慢爬起 · 最坏已过 · 挣扎求生","up":"十剑并陈于背，晨曦已从海平线爬起——这一局彻底结束；谷底的意义在于再无可跌。","rev":"拔剑起身，伤疤成甲。把背后留给人，别再留给剑。","sym":"宝剑·十","motif":"swords-10"},{"id":"P01","major":false,"suit":"pentacles","rank":1,"rankZh":"Ace","rankEn":"Ace","numeral":"A","zh":"星币Ace","en":"Ace of Pentacles","astro":"土之源头（Ace）","element":"土","k_up":"财富之种 · 新机遇落地 · 丰盛之始 · 可触之愿","k_rev":"错失机会 · 财务焦虑 · 根基未固 · 价值感低","up":"花园门廊下云手奉出星币——愿望开始有了重量与形状，是可耕种、可积累的实质开端。","rev":"金币从指缝漏走或握而不种。种子需要土，不是保险柜。","sym":"星币·Ace","motif":"pentacles-1"},{"id":"P02","major":false,"suit":"pentacles","rank":2,"rankZh":"二","rankEn":"Two","numeral":"II","zh":"星币二","en":"Two of Pentacles","astro":"木星 · 摩羯座 I","element":"土","k_up":"变奏杂耍 · 灵活调度 · 平衡多线 · 应变","k_rev":"手忙脚乱 · 失衡调度 · 财务杂乱 · 不堪多线","up":"踏足起舞者双手耍双币，波涛之上双币由无限符号相连——资源有限时的节奏艺术：两件事轮流抛接。","rev":"球掉了一地。列出优先级，先接住会碎的那个。","sym":"星币·二","motif":"pentacles-2"},{"id":"P03","major":false,"suit":"pentacles","rank":3,"rankZh":"三","rankEn":"Three","numeral":"III","zh":"星币三","en":"Three of Pentacles","astro":"火星 · 摩羯座 II","element":"土","k_up":"匠心协作 · 技艺受认 · 共建蓝图","k_rev":"协作失调 · 平庸应付 · 角色错位 · 质量松懈","up":"教堂门廊下工匠持具，修士与执图纸者共议——一手技艺、一手协作，作品因被认真对待而成形。","rev":"三方各自为政、验收流于形式。请回到图纸上，而不是各说各话。","sym":"星币·三","motif":"pentacles-3"},{"id":"P04","major":false,"suit":"pentacles","rank":4,"rankZh":"四","rankEn":"Four","numeral":"IV","zh":"星币四","en":"Four of Pentacles","astro":"太阳 · 摩羯座 III","element":"土","k_up":"稳握所有 · 守成之固 · 控制 · 安全感","k_rev":"守财失度 · 紧抓不放 · 慷慨解囊 · 失控流失","up":"城门下抱币者头戴冠币——安全感至上、一毛不拔的时刻；守住核心，但别把城门也焊死。","rev":"要么终于松手分享，要么握得太紧指甲陷进掌心。钱是水流，不是标本。","sym":"星币·四","motif":"pentacles-4"},{"id":"P05","major":false,"suit":"pentacles","rank":5,"rankZh":"五","rankEn":"Five","numeral":"V","zh":"星币五","en":"Five of Pentacles","astro":"水星 · 金牛座 I","element":"土","k_up":"门外寒士 · 匮乏之感 · 遗落寒冬 · 精神贫瘠","k_rev":"熬过寒冬 · 援手将至 · 走出匮乏 · 重见暖意","up":"风雪中褴褛二人走过彩窗圣殿而不入——物质的寒冬或心灵的荒年；教堂就在身后，灯还亮着。","rev":"窗里透出光。求助不丢人，雪地里独行才危险。","sym":"星币·五","motif":"pentacles-5"},{"id":"P06","major":false,"suit":"pentacles","rank":6,"rankZh":"六","rankEn":"Six","numeral":"VI","zh":"星币六","en":"Six of Pentacles","astro":"月亮 · 金牛座 II","element":"土","k_up":"布施天平 · 资源流动 · 给予与领受","k_rev":"施受失衡 · 债务 · 暗藏条件 · 权力不对等","up":"商人持天平与钱袋，向乞者分币——慷慨解囊的时刻；留意天平上是否藏着无形的筹码。","rev":"面包带着钩子，或伸手的手开始颤抖。尊严与援助应当可以同时存在。","sym":"星币·六","motif":"pentacles-6"},{"id":"P07","major":false,"suit":"pentacles","rank":7,"rankZh":"七","rankEn":"Seven","numeral":"VII","zh":"星币七","en":"Seven of Pentacles","astro":"土星 · 金牛座 III","element":"土","k_up":"暂歇评估 · 果实未熟 · 耐心投资 · 长线耕耘","k_rev":"急于收割 · 徒劳投入 · 目光短浅 · 焦虑等待","up":"倚锄凝望藤上星币的农人——长出来的部分已经不错，未熟的部分急不来。","rev":"拔苗或弃田。检查土壤，而不是每天把果子捏一遍。","sym":"星币·七","motif":"pentacles-7"},{"id":"P08","major":false,"suit":"pentacles","rank":8,"rankZh":"八","rankEn":"Eight","numeral":"VIII","zh":"星币八","en":"Eight of Pentacles","astro":"太阳 · 室女座 I","element":"土","k_up":"勤勉精进 · 专注手艺 · 学徒之心 · 精雕细琢","k_rev":"敷衍了事 · 完美主义瘫痪 · 技艺停滞 · 心不在焉","up":"长凳上匠人一錾一錾镌币，成品成排陈列——专注是可复利的手艺，慢工正在出细活。","rev":"凿子停了：或因倦怠敷衍，或因完美主义不敢下刀。继续刻。","sym":"星币·八","motif":"pentacles-8"},{"id":"P09","major":false,"suit":"pentacles","rank":9,"rankZh":"九","rankEn":"Nine","numeral":"IX","zh":"星币九","en":"Nine of Pentacles","astro":"金星 · 室女座 II","element":"土","k_up":"自足丰饶 · 优雅独处 · 劳动所得之逸","k_rev":"依赖外求 · 表面富足 · 内在空虚 · 过度挥霍","up":"葡萄园中锦衣夫人白隼落腕——凭自己挣来的从容：不欠、不慌、不必解释。","rev":"花园的栅栏从里面锁上了，或果实正在悄悄烂掉。富足也需打理。","sym":"星币·九","motif":"pentacles-9"},{"id":"P10","major":false,"suit":"pentacles","rank":10,"rankZh":"十","rankEn":"Ten","numeral":"X","zh":"星币十","en":"Ten of Pentacles","astro":"水星 · 室女座 III","element":"土","k_up":"家族之富 · 传承体系 · 长期积累的圆满","k_rev":"家产纷争 · 短期思维 · 结构失衡 · 遗产之惑","up":"拱门内的长者与犬，门外交谈的男女与孩童——跨越世代的稳固结构：财富、家族与传承的完整图景。","rev":"柱子内部有了裂缝。传承需要的不只是遗嘱，还有对话。","sym":"星币·十","motif":"pentacles-10"},{"id":"W11","major":false,"suit":"wands","rank":"page","rankZh":"侍从","rankEn":"Page","numeral":"P","zh":"权杖侍从","en":"Page of Wands","astro":"火之地","element":"火","k_up":"热忱信使 · 探索火苗 · 新点子 · 好奇","k_rev":"三分钟热度 · 轻浮 · 坏消息 · 方向不明","up":"持杖凝视新芽的少年——一个想法刚刚点着，热情高涨而经验尚浅，学习与试错都是此局正道。","rev":"火苗见风就灭、精力散在太多新玩具上。选一根杖，把它种活。","sym":"权杖侍从","motif":"wands-page"},{"id":"W12","major":false,"suit":"wands","rank":"knight","rankZh":"骑士","rankEn":"Knight","numeral":"Kn","zh":"权杖骑士","en":"Knight of Wands","astro":"火之风","element":"火","k_up":"果敢行动 · 冒险冲锋 · 魅力引领","k_rev":"冲动鲁莽 · 虎头蛇尾 · 急躁误事","up":"骏马腾跃、杖指前方的骑手——行动力全开地扑向目标，自信有感染力，出发本身就是答案。","rev":"马蹄扬尘却无路线，点火太多、跟进太少。冲刺之前先看一次地图。","sym":"权杖骑士","motif":"wands-knight"},{"id":"W13","major":false,"suit":"wands","rank":"queen","rankZh":"女王","rankEn":"Queen","numeral":"Q","zh":"权杖女王","en":"Queen of Wands","astro":"火之水","element":"火","k_up":"温暖的自信 · 内在火焰 · 以心带人","k_rev":"嫉妒 · 专断 · 自我中心 · 火气失控","up":"向日葵畔侧杖而坐的王后——她的自信来自内在之火，以热情与确定性感染并点燃他人。","rev":"火焰烧向自己人。王后不需要通过压过谁来证明光亮。","sym":"权杖王后","motif":"wands-queen"},{"id":"W14","major":false,"suit":"wands","rank":"king","rankZh":"国王","rankEn":"King","numeral":"K","zh":"权杖国王","en":"King of Wands","astro":"火之火","element":"火","k_up":"远见领袖 · 大胆决断 · 以愿景服人","k_rev":"独裁 · 急躁 · 以势压人 · 苛求","up":"握杖而立、蜥蜴攀冠的君王——把火变成炉、把愿景变成蓝图，是能带队伍穿越沙漠的领导者。","rev":"王座变成火刑柱。领导力若只剩脾气，愿景便无人再信。","sym":"权杖国王","motif":"wands-king"},{"id":"C11","major":false,"suit":"cups","rank":"page","rankZh":"侍从","rankEn":"Page","numeral":"P","zh":"圣杯侍从","en":"Page of Cups","astro":"水之地","element":"水","k_up":"灵感信使 · 浪漫消息 · 感性学习","k_rev":"情绪化 · 稚嫩逃避 · 失意消息 · 内在小孩受伤","up":"池畔凝视杯中游鱼的少年——一条来自心灵深处的小消息：新的感受、邀约或灵感的萌芽。","rev":"情绪的风浪大过船。把心事说给能接住的人，别让内在小孩独自站到深夜。","sym":"圣杯侍从","motif":"cups-page"},{"id":"C12","major":false,"suit":"cups","rank":"knight","rankZh":"骑士","rankEn":"Knight","numeral":"Kn","zh":"圣杯骑士","en":"Knight of Cups","astro":"水之风","element":"水","k_up":"浪漫追寻 · 诗意邀约 · 理想主义","k_rev":"不切实际 · 空头承诺 · 情绪善变 · 逃避承诺","up":"持杯缓行、白翼头盔的骑士——为爱与理想而行的浪漫主义者，温柔、专注、带着诗意出发。","rev":"白马绕着花园打转。浪漫若不落地，承诺就成了道具。","sym":"圣杯骑士","motif":"cups-knight"},{"id":"C13","major":false,"suit":"cups","rank":"queen","rankZh":"女王","rankEn":"Queen","numeral":"Q","zh":"圣杯女王","en":"Queen of Cups","astro":"水之水","element":"水","k_up":"慈悲深察 · 直觉之心 · 以理解为舵","k_rev":"情绪淹没 · 依赖 · 失去边界 · 过度共情","up":"海畔宝座、闭目凝杯的王后——她以直觉读人、以慈悲接人，是最深的水也是最静的港。","rev":"潮水漫过船舷。共情要有岸，否则渡人的先沉。","sym":"圣杯王后","motif":"cups-queen"},{"id":"C14","major":false,"suit":"cups","rank":"king","rankZh":"国王","rankEn":"King","numeral":"K","zh":"圣杯国王","en":"King of Cups","astro":"水之火","element":"水","k_up":"情感之智 · 沉稳包容 · 以仁持平","k_rev":"情绪压抑 · 操控 · 冷漠疏离 · 喜怒无常","up":"波涛中稳坐王座的君王——见过深海的人不再怕浪，以情感之智与节制掌舵。","rev":"船帆收进衣柜。被压抑的海不会平，只会改道。","sym":"圣杯国王","motif":"cups-king"},{"id":"S11","major":false,"suit":"swords","rank":"page","rankZh":"侍从","rankEn":"Page","numeral":"P","zh":"宝剑侍从","en":"Page of Swords","astro":"风之地","element":"风","k_up":"警觉观察 · 好奇求知 · 消息与刺探","k_rev":"言语轻率 · 暗中窥探 · 八卦 · 思虑不周","up":"持剑而立、远望战场的少年——清醒的头脑与锐利的好奇，消息与情报纷至，先观察再表态。","rev":"剑还没拿稳就出鞘。话说得太快，或耳朵贴错了墙。","sym":"宝剑侍从","motif":"swords-page"},{"id":"S12","major":false,"suit":"swords","rank":"knight","rankZh":"骑士","rankEn":"Knight","numeral":"Kn","zh":"宝剑骑士","en":"Knight of Swords","astro":"风之风","element":"风","k_up":"冲锋的思想 · 疾风进攻 · 锋芒急智","k_rev":"横冲直撞 · 言语如刀 · 耗散用力 · 急功失谋","up":"疾风般冲来的骑手与宝剑——思维与行动都上了马背，直取要害，快得让人来不及设防。","rev":"冲错了战场。速度是武器也是盲区，锋芒需要靶心。","sym":"宝剑骑士","motif":"swords-knight"},{"id":"S13","major":false,"suit":"swords","rank":"queen","rankZh":"女王","rankEn":"Queen","numeral":"Q","zh":"宝剑女王","en":"Queen of Swords","astro":"风之水","element":"风","k_up":"清醒剪裁 · 以经验断是非 · 独立洞见","k_rev":"冷酷苛责 · 心怀怨毒 · 偏颇刻薄 · 封闭","up":"高座之上侧剑平举的王后——风起云涌中依然目光清明，以阅历裁断是非，不为人情弯剑。","rev":"剑尖指向无辜。受过伤的智慧不该变成报复的尺子。","sym":"宝剑王后","motif":"swords-queen"},{"id":"S14","major":false,"suit":"swords","rank":"king","rankZh":"国王","rankEn":"King","numeral":"K","zh":"宝剑国王","en":"King of Swords","astro":"风之火","element":"风","k_up":"智识权威 · 公正裁决 · 以理驭剑","k_rev":"独断暴虐 · 操纵智识 · 滥权冷酷 · 偏执","up":"剑身垂直、端坐云上的君王——把剑交给道理：以逻辑与公正作最终裁决的权威。","rev":"法庭变成刑场。当逻辑只服务权力，它就不再是智慧。","sym":"宝剑国王","motif":"swords-king"},{"id":"P11","major":false,"suit":"pentacles","rank":"page","rankZh":"侍从","rankEn":"Page","numeral":"P","zh":"星币侍从","en":"Page of Pentacles","astro":"土之地","element":"土","k_up":"好学实干 · 新学习机会 · 愿望成真的信使","k_rev":"学业荒废 · 不切实际 · 拖延 · 机会溜走","up":"草地灯下端详星币的少年——把愿望变成课业与练习的时刻，一步一个脚印的学习者。","rev":"课本压在盆栽底下。机会不接受预约，只接待准备。","sym":"星币侍从","motif":"pentacles-page"},{"id":"P12","major":false,"suit":"pentacles","rank":"knight","rankZh":"骑士","rankEn":"Knight","numeral":"Kn","zh":"星币骑士","en":"Knight of Pentacles","astro":"土之风","element":"土","k_up":"稳健前行 · 可靠勤勉 · 缓慢而确定","k_rev":"停滞不前 · 乏味僵化 · 固执守旧 · 漫无目标","up":"静立不动的黑骏马与持币骑士——他不赶路，因为一直在路上：最慢的速度里有最稳的抵达。","rev":"马站着睡着了。勤勉不等于原地，问一句：方向对吗。","sym":"星币骑士","motif":"pentacles-knight"},{"id":"P13","major":false,"suit":"pentacles","rank":"queen","rankZh":"女王","rankEn":"Queen","numeral":"Q","zh":"星币女王","en":"Queen of Pentacles","astro":"土之水","element":"土","k_up":"丰饶务实 · 滋养现实 · 居家之智","k_rev":"过度操劳 · 自我忽视 · 物欲失衡 · 挤压生活","up":"花园王座、玫瑰满园的王后——把日子过成花园的人：务实、滋养、把照顾当作专业。","rev":"花园里只剩她一个人在浇水。照顾世界之前，先把自己算进名单。","sym":"星币王后","motif":"pentacles-queen"},{"id":"P14","major":false,"suit":"pentacles","rank":"king","rankZh":"国王","rankEn":"King","numeral":"K","zh":"星币国王","en":"King of Pentacles","astro":"土之火","element":"土","k_up":"财富之主 · 稳健致富 · 可靠老练","k_rev":"物质至上 · 固执守财 · 僵化 · 以钱衡人","up":"藤蔓缠绕王座、脚边星币的君王——白手建起的城堡：稳健、慷慨而可靠，时间站在他这边。","rev":"城堡上了锁，钥匙藏进账本。资产表上没有的，他开始不信。","sym":"星币国王","motif":"pentacles-king"}];

/* ===================================================================
   SPREADS — 5 种牌阵
   =================================================================== */
var SPREAD_DATA = [{"id":"single","name":"每日一牌","en":"One Card","desc":"最古老的抽取方式：一个问题，一张牌，一个直指核心的回应。","bestFor":"日常指引、简明问题、聚焦单一事项","count":1,"positions":["神谕"],"slots":[{"label":"神谕","hint":"当下最需要看见的核心信息","x":0,"y":0,"rot":0}]},{"id":"three","name":"时间之流","en":"Three Card Spread","desc":"以时间为轴的三张牌：过去之所来，现在之所立，未来之所往。","bestFor":"事情走向、时间线问题、简洁的整体脉络","count":3,"positions":["过去","现在","未来"],"slots":[{"label":"过去","hint":"塑造现状的根源与来路","x":-1.55,"y":0,"rot":0},{"label":"现在","hint":"当下真实的状态与处境","x":0,"y":0,"rot":0},{"label":"未来","hint":"现有轨迹的趋势与走向","x":1.55,"y":0,"rot":0}]},{"id":"relationship","name":"双子连桥","en":"Five Card Relationship Spread","desc":"经典的关系牌阵：两端是你与对方，中央之桥呈现连接、考验与方向。","bestFor":"感情、亲密关系、合作与重要的人际连结","count":5,"positions":["我","对方","连结","考验","方向"],"slots":[{"label":"我","hint":"你在关系中的状态与位置","x":-2.1,"y":0.35,"rot":0},{"label":"对方","hint":"对方在关系中的状态与位置","x":2.1,"y":0.35,"rot":0},{"label":"连结","hint":"关系的现状与深层纽带","x":0,"y":1.35,"rot":0},{"label":"考验","hint":"关系需要面对的挑战","x":-1.05,"y":-1.35,"rot":0},{"label":"方向","hint":"关系的走向与相处的指引","x":1.05,"y":-1.35,"rot":0}]},{"id":"horseshoe","name":"马蹄铁阵","en":"Seven Card Horseshoe","desc":"七张牌沿马蹄铁排布，自过去绕至结果，是传统中兼顾细节与全局的全面牌阵。","bestFor":"事业、财务、学业等现实议题的全面透视","count":7,"positions":["过去","现状","隐匿","阻碍","环境","建议","结果"],"slots":[{"label":"过去","hint":"影响现状的过往因素","x":-2.7,"y":1.3,"rot":-0.42},{"label":"现状","hint":"目前所处的境地","x":-1.8,"y":-0.4,"rot":-0.28},{"label":"隐匿","hint":"隐藏的影响与未见的因素","x":-0.9,"y":-1.55,"rot":-0.14},{"label":"阻碍","hint":"需要跨越的主要障碍","x":0,"y":-2,"rot":0},{"label":"环境","hint":"他人与外部环境的态势","x":0.9,"y":-1.55,"rot":0.14},{"label":"建议","hint":"此刻最有力的行动建议","x":1.8,"y":-0.4,"rot":0.28},{"label":"结果","hint":"顺势而为的最终走向","x":2.7,"y":1.3,"rot":0.42}]},{"id":"celtic","name":"凯尔特十字","en":"Celtic Cross","desc":"传世最经典的牌阵：十字六牌呈现事之经纬，右侧四牌纵列为心灵阶梯。","bestFor":"重大抉择、复杂处境、值得郑重对待的问题","count":10,"positions":["现状","交叉","根基","过往","冠冕","将至","自我","环境","心念","终局"],"slots":[{"label":"现状","hint":"问题的核心与当下处境","x":0,"y":0,"rot":0},{"label":"交叉","hint":"横亘眼前的挑战或助力","x":0,"y":0,"rot":1.5707963267948966},{"label":"根基","hint":"潜藏的根源与深层动因","x":0,"y":1.5,"rot":0},{"label":"过往","hint":"正在退去的近期过去","x":-1.45,"y":0,"rot":0},{"label":"冠冕","hint":"意识层面的目标与理想","x":0,"y":-1.5,"rot":0},{"label":"将至","hint":"即将到来的临近未来","x":1.45,"y":0,"rot":0},{"label":"自我","hint":"你自身的态度与状态","x":2.9,"y":3.05,"rot":0},{"label":"环境","hint":"周围人与环境的影响","x":2.9,"y":1.5,"rot":0},{"label":"心念","hint":"内在的希望与恐惧","x":2.9,"y":-0.05,"rot":0},{"label":"终局","hint":"所有因素汇成的结果","x":2.9,"y":-1.6,"rot":0}]}];

var ALL_CARDS = CARD_DATA.map(function(c){
  return {
    id: c.id, zh: c.zh, en: c.en, major: c.major,
    suit: c.suit || null, rank: c.rank || null, rankZh: c.rankZh || '', numeral: c.numeral || '',
    k_up: c.k_up, k_rev: c.k_rev, up: c.up, rev: c.rev,
    sym: c.sym || '', astro: c.astro || '', element: c.element || ''
  };
});
var CARD_BY_ID = {};
ALL_CARDS.forEach(function(c){ CARD_BY_ID[c.id] = c; });

var SPREADS = SPREAD_DATA.map(function(s){
  return {
    id: s.id, name: s.name, en: s.en, desc: s.desc, bestFor: s.bestFor || '',
    count: s.count, positions: s.positions, slots: s.slots
  };
});

/* ===================================================================
   READER SYSTEM PROMPT
   =================================================================== */
var READER_SYSTEM = '你是一位资深塔罗牌解读师。你的解读须遵循下列结构：\n\n'+
  '1.【牌阵总览】概述牌阵时体现的意象走向和主题\n'+
  '2.【逐位解读】对每张牌在其所处位置进行深刻解读，结合牌面意象、正逆位含义和位置语义\n'+
  '3.【综合信息】将所有牌之间的关系和牌阵进行综合分析，揭示深刻的故事\n'+
  '4.【启示与建议】基于以上解读，给出温和而具有建设性的建议\n\n'+
  '解读要求：\n'+
  '- 忠实于牌义，不得杜撰、不得含糊\n'+
  '- 每张牌的解读要结合其关键词、牌面意象和位置语义\n'+
  '- 善用中文雅致、诗意而分明的语言\n'+
  '- 涉及健康、法律、财务或人生重大决策时，须提示咨询专业人士\n'+
  '- 不要使用 emoji\n'+
  '- 在每个小标题前加上 ## 标记（Markdown格式）';

function buildReadingMessages(selCards, spread, question){
  var cardDesc = selCards.map(function(sel,i){
    var slot = (spread.slots && spread.slots[i]) || null;
    var pos = sel.position || (slot ? slot.label : '') || '';
    var hint = slot && slot.hint ? slot.hint : '';
    var dir = sel.reversed ? '逆位' : '正位';
    var card = sel.card;
    return (i+1)+'. 【'+pos+'】'+card.zh+'（'+card.en+'）— '+dir+'\n'+
      '   位置语义：'+(hint || '—')+'\n'+
      '   关键词：'+(sel.reversed ? card.k_rev : card.k_up)+'\n'+
      '   释义：'+(sel.reversed ? card.rev : card.up)+'\n'+
      (card.sym ? '   牌面意象：'+card.sym+'\n' : '')+
      (card.astro ? '   占星对应：'+card.astro : '');
  }).join('\n\n');

  var userMsg = '问题：'+(question || '请解读当前的状态和方向')+'\n\n'+
    '牌阵「'+spread.name+'」中有'+selCards.length+'张牌：\n\n'+cardDesc+'\n\n'+
    '请按既定的解读结构（牌阵总览→逐位解读→综合信息→启示与建议）进行详细解读。';

  return [
    {role:'system',content:READER_SYSTEM},
    {role:'user',content:userMsg}
  ];
}

/* ===================================================================
   MD TO HTML
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
    if(/^[•\-\*]\s+/.test(trimmed)){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>'+processed.replace(/^[•\-\*]\s+/,'')+'</li>';
      return;
    }
    if(/^[①-⑩❶-❿]\s*/.test(trimmed)){
      if(!inList){ html += '<ul>'; inList = true; }
      html += '<li>'+processed+'</li>';
      return;
    }
    if(inList){ html += '</ul>'; inList = false; }
    html += '<p class="tarot-para-in">'+processed+'</p>';
  });
  if(inList) html += '</ul>';
  return html;
}

/* ===================================================================
   CARD ART
   =================================================================== */
var ART_BASE = '_assets/tarot/';

function artPath(card){
  return ART_BASE + String(card.id).toLowerCase() + '.webp';
}

/* 无图降级：程序化 SVG 牌面（花色徽记 + 点数 + 牌名铭牌） */
var SUIT_EMBLEM = {
  wands:  'M32 6 L36 30 L32 58 L28 30 Z M28 40 L20 54 M36 40 L44 54',
  cups:   'M20 24 H44 V40 A12 12 0 0 1 20 40 Z M20 24 A6 6 0 0 0 32 14 A6 6 0 0 1 44 24 M26 52 H38',
  swords: 'M32 6 L36 26 L32 46 L28 26 Z M18 50 H46 M24 56 H40 M32 46 V56',
  pentacles: 'M32 14 A18 18 0 1 0 32.1 14 Z M32 24 L36 30 L44 30 L38 36 L40 46 L32 41 L24 46 L26 36 L20 30 L28 30 Z'
};

function svgFallbackFace(card){
  var W = 200, H = 312;
  var inner = '';
  if (card.major) {
    inner = '<circle cx="100" cy="120" r="54" fill="none" stroke="#d4b073" stroke-width="1.2" opacity="0.8"/>'+
            '<circle cx="100" cy="120" r="44" fill="none" stroke="#d4b073" stroke-width="0.6" opacity="0.5"/>'+
            '<text x="100" y="128" text-anchor="middle" font-family="Georgia,serif" font-size="30" fill="#ecd9a8" opacity="0.9">'+
            (card.numeral || card.zh.slice(0,2))+'</text>'+
            '<path d="M100 44 L104 56 L100 68 L96 56 Z" fill="#d4b073" opacity="0.7"/>';
  } else {
    var path = SUIT_EMBLEM[card.suit] || SUIT_EMBLEM.pentacles;
    var rank = card.rank || 1;
    var cols = rank > 6 ? 2 : 1;
    var rowsN = Math.ceil(rank / cols);
    var boxTop = 58, boxH = 128;
    var pips = '';
    for (var i = 0; i < rank; i++){
      var c = cols === 1 ? 0 : (i % cols);
      var r = Math.floor(i / cols);
      var px = cols === 1 ? 100 : (76 + c * 48);
      var py = boxTop + (rowsN === 1 ? boxH/2 : (r + 0.5) * (boxH / rowsN));
      /* 徽记原始坐标系 0..64，缩放到 24px 见方 */
      var s = 24 / 64;
      pips += '<path d="'+path+'" transform="translate('+(px - 32*s).toFixed(1)+', '+(py - 32*s).toFixed(1)+') scale('+s.toFixed(4)+')" '+
              'fill="none" stroke="#ecd9a8" stroke-width="4" opacity="0.82" stroke-linecap="round"/>';
    }
    inner = '<rect x="24" y="'+boxTop+'" width="152" height="'+boxH+'" fill="none" stroke="#d4b073" stroke-width="0.7" opacity="0.28"/>'+pips;
  }
  var svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">'+
      '<defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1">'+
        '<stop offset="0" stop-color="#221a3c"/><stop offset="1" stop-color="#0b0816"/></linearGradient></defs>'+
      '<rect width="'+W+'" height="'+H+'" fill="url(#g)"/>'+
      '<rect x="8" y="8" width="'+(W-16)+'" height="'+(H-16)+'" fill="none" stroke="#d4b073" stroke-width="0.8" opacity="0.35"/>'+
      inner +
      '<text x="100" y="272" text-anchor="middle" font-family="Songti SC, serif" font-size="22" fill="#e9dfc7">'+
        esc(card.zh)+'</text>'+
      '<text x="100" y="292" text-anchor="middle" font-family="Georgia,serif" font-size="11" fill="#b5ab93" opacity="0.8">'+
        esc(card.en)+'</text>'+
    '</svg>';
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}

function cardFaceHTML(card, reversed, opts){
  opts = opts || {};
  var src = artPath(card);
  var fb = svgFallbackFace(card);
  return ''+
    '<div class="tarot-card-face'+(reversed ? ' tarot-reversed-content' : '')+'">'+
      (reversed ? '<div class="tarot-card-plate-dir tarot-rev">逆位</div>'
                : '<div class="tarot-card-plate-dir tarot-up">正位</div>')+
      '<img class="tarot-card-img" src="'+esc(src)+'" alt="'+esc(card.zh)+'" loading="lazy" '+
        'onerror="this.onerror=null;this.src=\''+fb.replace(/'/g, '%27')+'\'">'+
      (opts.plate === false ? '' :
      '<div class="tarot-card-plate">'+
        '<div class="tarot-card-plate-cn">'+esc(card.zh)+'</div>'+
        '<div class="tarot-card-plate-en">'+esc(card.en)+'</div>'+
      '</div>')+
    '</div>';
}

function cardBackHTML(){
  return '<div class="tarot-card-back"><div class="tarot-card-back-core"></div></div>';
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

/* 弧形选牌运行时状态 */
var arc = {
  offset: 0,
  velocity: 0,
  dragging: false,
  moved: 0,
  lastX: 0,
  lastT: 0,
  raf: 0,
  root: null,
  cards: [],
  W: 0,
  H: 0
};

/* ===================================================================
   HELPERS
   =================================================================== */
function esc(s){var d=document.createElement('div');d.textContent=s==null?'':String(s);return d.innerHTML}
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
   BACKGROUND MANAGER — 三段背景 + 明暗墨色模式
   =================================================================== */
var BG_IMAGES = {
  1: '_assets/tarot-bg-1.webp',   /* 问卜：白纸拼贴 */
  2: '_assets/tarot-bg-2.webp',   /* 抽牌：黑星空星盘 */
  3: '_assets/tarot-bg-3.webp'    /* 解读：教堂彩窗 */
};
var currentBg = 0;

function ensureBgLayers(root){
  if(root.querySelector('.tarot-bg')) return;
  var wrap = document.createElement('div');
  wrap.className = 'tarot-bg';
  root.appendChild(wrap);
  for(var k=1;k<=3;k++){
    var layer = document.createElement('div');
    layer.className = 'tarot-bg-layer';
    layer.setAttribute('data-bg', String(k));
    layer.style.backgroundImage = 'url("'+BG_IMAGES[k]+'")';
    root.appendChild(layer);
  }
  var veil = document.createElement('div');
  veil.className = 'tarot-veil';
  root.appendChild(veil);
}

function setTarotBg(root, n){
  if(!n || n === currentBg) return;
  currentBg = n;
  ensureBgLayers(root);
  root.querySelectorAll('.tarot-bg-layer').forEach(function(l){
    l.classList.toggle('tarot-bg-on', l.getAttribute('data-bg') === String(n));
  });
  root.classList.toggle('tarot-mode-paper', n === 1);
  root.classList.toggle('tarot-mode-night', n !== 1);
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
    return '<div class="tarot-char-avatar-wrap" data-cid="'+esc(c.id)+'" data-cname="'+esc(name)+'">'+
      '<img class="tarot-char-avatar" src="'+esc(avatarSrc)+'" alt="'+esc(name)+'" onerror="this.style.display=\'none\'">'+
      '<div class="tarot-char-avatar-name">'+esc(name)+'</div>'+
    '</div>';
  }).join('');
  return '<div class="tarot-char-section">'+
    '<div class="tarot-char-heading">AI 视角（可选）</div>'+
    '<div class="tarot-char-row">'+avatars+'</div>'+
    '<div class="tarot-char-name" id="tcn-name"></div>'+
  '</div>';
}

function bindCharacterSelector(screen){
  screen.querySelectorAll('.tarot-char-avatar-wrap').forEach(function(wrap){
    wrap.addEventListener('click', function(){
      var wasSelected = wrap.classList.contains('tarot-char-picked');
      screen.querySelectorAll('.tarot-char-avatar').forEach(function(a){a.classList.remove('tarot-char-selected')});
      screen.querySelectorAll('.tarot-char-avatar-wrap').forEach(function(w){w.classList.remove('tarot-char-picked')});
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
        wrap.classList.add('tarot-char-picked');
        state.charId = wrap.dataset.cid;
        state.charName = wrap.dataset.cname;
        state.charAvatar = avatar.src;
        var ch = _characters.find(function(x){return String(x.id)===String(state.charId)});
        state.charDescription = ch ? (ch.description || (ch.identity && ch.identity.bio) || ch.signature || '') : '';
        if(nameEl) nameEl.textContent = '与 '+state.charName+' 一起解读';
      }
    });
  });
}

/* ===================================================================
   PHASE: QUESTION（背景 1 · 纸墨模式）
   =================================================================== */
async function renderQuestion(root){
  state.phase = 'question';
  state.charId = null; state.charName = ''; state.charAvatar = ''; state.charDescription = '';
  setTarotBg(root, 1);

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

  var chars = await loadCharacters();
  var charHTML = buildCharacterSelectorHTML(chars);

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-question-phase">'+
      '<div class="tarot-panel tarot-question-panel">'+
        '<div class="tarot-eyebrow">CONSULT THE ORACLE</div>'+
        '<div class="tarot-main-title">卜问心事</div>'+
        ornament()+
        '<textarea class="tarot-textarea" id="tq-input" rows="3" placeholder="在此写下你的问题"></textarea>'+
        charHTML+
        '<div class="tarot-mode-group">'+
          '<div class="tarot-mode-option tarot-selected" data-mode="auto">依问选阵</div>'+
          '<div class="tarot-mode-option" data-mode="manual">自行选阵</div>'+
        '</div>'+
        '<div class="tarot-submit-row">'+
          '<button class="tarot-btn" id="tq-submit">启 示</button>'+
        '</div>'+
        '<div class="tarot-whisper">凝神静意，答案自会浮现</div>'+
      '</div>'+
      '<div class="tarot-history-section">'+
        '<div class="tarot-history-heading">占卜记录</div>'+
        '<div id="tq-history">'+histHTML+'</div>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');

  bindCharacterSelector(screen);

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
      autoPickSpread();
      renderShuffle(root);
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
        state.selected = (h.cards||[]).map(function(c,i){
          /* 老版本存的历史没有 id，按中文名回查牌库 */
          var card = (c.id && CARD_BY_ID[c.id]) || null;
          if(!card && c.zh){
            card = ALL_CARDS.find(function(x){ return x.zh === c.zh; }) || null;
          }
          if(!card){
            card = {id:'', zh:c.zh||'', en:c.en||'', k_up:c.k_up||'', k_rev:c.k_rev||'',
                    up:c.up||'', rev:c.rev||'', sym:c.sym||'', astro:c.astro||''};
          }
          return {card:card, reversed:!!c.reversed, position:c.position};
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
function autoPickSpread(){
  var q = state.question || '';
  var idx;
  if(q.length < 8) idx = 0;            /* 每日一牌 */
  else if(q.length < 24) idx = 1;      /* 时间之流 */
  else if(q.length < 48) idx = 2;      /* 双子连桥 */
  else idx = 3;                        /* 马蹄铁阵 */
  state.spread = idx;
}

/* ===================================================================
   PHASE: SPREAD SELECTION（手动）
   =================================================================== */
function renderSpread(root){
  state.phase = 'spread';
  setTarotBg(root, 1);

  var listHTML = SPREADS.map(function(s,i){
    return '<div class="tarot-spread-card" data-idx="'+i+'">'+
      '<div class="tarot-spread-card-header">'+
        '<span class="tarot-spread-card-name">'+esc(s.name)+'</span>'+
        '<span class="tarot-spread-card-count">'+s.count+'张</span>'+
      '</div>'+
      '<div class="tarot-spread-card-desc">'+esc(s.desc)+'</div>'+
      (s.bestFor ? '<div class="tarot-spread-card-desc tarot-spread-card-best">适合：'+esc(s.bestFor)+'</div>' : '')+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-question-phase">'+
      '<div class="tarot-panel tarot-question-panel">'+
        '<div class="tarot-eyebrow">CHOOSE THE PATTERN</div>'+
        '<div class="tarot-main-title">选取牌阵</div>'+
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
   PHASE: SHUFFLE — 落定 → 旋涡 → 收拢（背景 2）
   =================================================================== */
function renderShuffle(root){
  state.phase = 'shuffle';
  setTarotBg(root, 2);

  var sp = SPREADS[state.spread];
  var cardCount = 21;
  var W = root.clientWidth, H = root.clientHeight;
  var cx = W/2, cy = H*0.46;

  var cardsHTML = '';
  for(var i=0;i<cardCount;i++){
    cardsHTML += '<div class="tarot-deck-card" data-idx="'+i+'"></div>';
  }

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-shuffle-stage" id="tsh-stage">'+
      '<div class="tarot-shuffle-altar"></div>'+
      cardsHTML+
    '</div>'+
    '<div class="tarot-shuffle-hint">命运正在洗牌…</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');
  var cards = Array.prototype.slice.call(screen.querySelectorAll('.tarot-deck-card'));

  /* 阶段 1 · 牌堆落定 */
  cards.forEach(function(card, i){
    card.style.transform = 'translate('+(-i*0.4)+'px, 0px) rotate(0deg)';
    card.style.opacity = '1';
    card.style.zIndex = String(i);
  });

  /* 阶段 2 · 旋涡散开（带 3D 翻转与随机延迟） */
  later(function(){
    cards.forEach(function(card, i){
      card.classList.remove('tarot-deck-fan');
      card.classList.add('tarot-deck-swirl');
      var a = (i / cardCount) * Math.PI * 2 + Math.random()*0.4;
      var rad = 70 + Math.random()*130;
      var x = cx + Math.cos(a)*rad - 32;
      var y = cy + Math.sin(a)*rad*0.72 - 50;
      var rot = Math.random()*180 - 90;
      var flip = Math.random() > 0.5 ? 1 : -1;
      card.style.transitionDelay = (Math.random()*260) + 'ms';
      card.style.transform = 'translate('+x.toFixed(1)+'px, '+y.toFixed(1)+'px) rotate('+rot.toFixed(1)+'deg) rotateY('+flip*180+'deg)';
      card.style.opacity = '0.88';
    });
  }, 420);

  /* 阶段 3 · 回流收拢成一叠 */
  later(function(){
    cards.forEach(function(card, i){
      card.classList.remove('tarot-deck-swirl');
      card.classList.add('tarot-deck-reform');
      card.style.transitionDelay = (i*22) + 'ms';
      var a = -Math.PI/2 + (i - (cardCount-1)/2) * 0.06;
      var rad = 150;
      var x = cx + Math.cos(a)*rad*0.62 - 32;
      var y = cy + Math.sin(a)*rad*0.5 - 50;
      card.style.transform = 'translate('+x.toFixed(1)+'px, '+y.toFixed(1)+'px) rotate('+((i-(cardCount-1)/2)*1.6).toFixed(1)+'deg) rotateY(0deg)';
      card.style.opacity = '1';
    });
  }, 1750);

  /* 阶段 4 · 进入弧形选牌 */
  later(function(){ renderArcSelect(root); }, 3400);
}

/* ===================================================================
   PHASE: ARC SELECT — 贴左弧线 · 拖动旋转 · 点击抽牌
   =================================================================== */
function arcMetrics(W, H){
  var narrow = W < 380;
  return {
    W: W, H: H,
    /* 弧心在舞台右侧 → 牌沿一条贴着左缘的月牙排布 */
    cx: W * 1.20,
    cy: H * 0.50,
    rx: W * 1.10,
    ry: H * 0.46,
    step: narrow ? 0.150 : 0.145,
    window: 1.00,           /* 可见半角 */
    tilt: 40,               /* 牌面倾角系数（度） */
    cardW: narrow ? 74 : (W >= 500 ? 96 : 86)
  };
}

function renderArcSelect(root){
  state.phase = 'select';
  setTarotBg(root, 2);

  var sp = SPREADS[state.spread];
  var need = sp.count;
  var showCount = Math.min(state.deck.length, 21);
  var deck = state.deck.slice(0, showCount);

  var cardsHTML = deck.map(function(c,i){
    return '<div class="tarot-arc-card" data-idx="'+i+'">'+
      '<div class="tarot-arc-card-inner">'+ cardBackHTML() + cardFaceHTML(c, false) +'</div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-fan-header">'+
      '<div class="tarot-eyebrow">DRAW THE CARDS</div>'+
      '<div class="tarot-fan-title">'+esc(sp.name)+'</div>'+
      '<div class="tarot-fan-progress" id="tfan-prog">已选 0 / '+need+'</div>'+
    '</div>'+
    '<div class="tarot-arc-stage" id="tarc-stage">'+
      '<div class="tarot-arc-rail"></div>'+
      cardsHTML+
      '<div class="tarot-arc-hint">← 拖动弧线转牌 · 点击抽牌 →</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');
  var stage = screen.querySelector('#tarc-stage');
  var nodes = Array.prototype.slice.call(screen.querySelectorAll('.tarot-arc-card'));

  arc.root = stage;
  arc.cards = nodes.map(function(node, i){
    return {node: node, card: deck[i], idx: i, picked: false, theta: 0};
  });
  /* 以舞台自身盒子为坐标系：牌的位置直接是舞台内坐标 */
  var stageRect = stage.getBoundingClientRect();
  var m = arcMetrics(stageRect.width, stageRect.height);
  arc.W = m.W; arc.H = m.H;
  arc.metrics = m;
  arc.offset = -0.15 * m.step;
  arc.velocity = 0;
  arc.total = deck.length * m.step;

  layoutArc();

  /* ---- 拖动旋转 ---- */
  function onDown(e){
    var t = e.touches ? e.touches[0] : null;
    var p = t || e;
    arc.dragging = true;
    arc.moved = 0;
    arc.lastX = p.clientX;
    arc.touchId = t ? t.identifier : null;
    arc.lastT = e.timeStamp || Date.now();
    arc.velocity = 0;
    stopInertia();
  }
  function onMove(e){
    if(!arc.dragging) return;
    var p = e;
    if(e.touches){
      p = null;
      for(var ti = 0; ti < e.touches.length; ti++){
        if(e.touches[ti].identifier === arc.touchId){ p = e.touches[ti]; break; }
      }
      if(!p) return;
    }
    var dx = p.clientX - arc.lastX;
    arc.lastX = p.clientX;
    arc.moved += Math.abs(dx);
    var now = e.timeStamp || Date.now();
    var dt = Math.max(16, now - arc.lastT);
    arc.lastT = now;
    arc.offset -= dx / arc.metrics.rx;         /* 位移换算成弧度 */
    arc.velocity = (-dx / arc.metrics.rx) / dt * 16;
    layoutArc();
    if(e.cancelable) e.preventDefault();
  }
  function onUp(e){
    if(!arc.dragging) return;
    if(e && e.changedTouches && arc.touchId !== null){
      var ended = false;
      for(var ci = 0; ci < e.changedTouches.length; ci++){
        if(e.changedTouches[ci].identifier === arc.touchId){ ended = true; break; }
      }
      if(!ended) return;
    }
    arc.dragging = false;
    arc.touchId = null;
    startInertia();
  }
  /* 点选：直接绑在牌上，刚拖过弧线时不误触 */
  nodes.forEach(function(node, i){
    node.addEventListener('click', function(e){
      e.stopPropagation();
      e.preventDefault();
      if(arc.moved > 8) return;
      pickCard(i);
    });
  });

  stage.addEventListener('touchstart', onDown, {passive:true});
  stage.addEventListener('touchmove', onMove, {passive:false});
  stage.addEventListener('touchend', onUp, {passive:true});
  stage.addEventListener('touchcancel', onUp, {passive:true});
  stage.addEventListener('mousedown', function(e){ e.preventDefault(); onDown(e); });
  function onWinMove(e){ if(arc.dragging) onMove(e); }
  function onWinUp(e){ if(arc.dragging) onUp(e); }
  window.addEventListener('mousemove', onWinMove);
  window.addEventListener('mouseup', onWinUp);
  stage.addEventListener('wheel', function(e){
    arc.offset += e.deltaY / arc.metrics.rx;
    layoutArc();
    if(e.cancelable) e.preventDefault();
  }, {passive:false});

  /* 选牌进度条按钮 */
  var ritual = document.createElement('div');
  ritual.className = 'tarot-ritual-bar';
  ritual.innerHTML =
    '<div class="tarot-ritual-hint">点击牌面抽取 '+need+' 张牌</div>'+
    '<div class="tarot-ritual-actions">'+
      '<button class="tarot-ritual-btn" id="tarc-back">返回</button>'+
      '<button class="tarot-ritual-btn" id="tarc-view" disabled>查看解读</button>'+
    '</div>';
  root.appendChild(ritual);
  ritual.querySelector('#tarc-back').addEventListener('click', function(){
    ritual.remove(); renderQuestion(root);
  });
  ritual.querySelector('#tarc-view').addEventListener('click', function(){
    ritual.remove(); renderReveal(root);
  });

  var progEl = screen.querySelector('#tfan-prog');
  var viewBtn = ritual.querySelector('#tarc-view');

  function layoutArc(){
    var mm = arc.metrics;
    for(var i=0;i<arc.cards.length;i++){
      var it = arc.cards[i];
      if(it.picked){ continue; }
      var raw = arc.offset + it.idx * mm.step;
      /* 无缝环绕 */
      var t = raw;
      while(t > mm.window) t -= arc.total;
      while(t < -mm.window) t += arc.total;
      it.theta = t;
      var x = mm.cx - mm.rx * Math.cos(t);
      var y = mm.cy + mm.ry * Math.sin(t);
      var deg = -t * mm.tilt;
      it.x = x; it.y = y; it.deg = deg;
      var depth = Math.min(1, Math.abs(t) / mm.window);
      var scale = 1 - depth * 0.18;
      var op = 1 - depth * 0.5;
      var z = Math.round(100 - Math.abs(t) * 60);
      it.node.style.transform =
        'translate('+x.toFixed(1)+'px, '+y.toFixed(1)+'px) rotate('+deg.toFixed(2)+'deg) scale('+scale.toFixed(3)+')';
      it.node.style.opacity = op.toFixed(2);
      it.node.style.zIndex = String(z);
    }
  }

  function startInertia(){
    if(Math.abs(arc.velocity) < 0.0012) return;
    var decay = 0.94;
    function step(){
      arc.velocity *= decay;
      arc.offset += arc.velocity;
      layoutArc();
      if(Math.abs(arc.velocity) > 0.0012 && !arc.dragging){
        arc.raf = requestAnimationFrame(step);
      } else {
        arc.raf = 0;
      }
    }
    stopInertia();
    arc.raf = requestAnimationFrame(step);
  }
  function stopInertia(){
    if(arc.raf){ cancelAnimationFrame(arc.raf); arc.raf = 0; }
  }

  function pickCard(i){
    var it = arc.cards[i];
    if(!it || it.picked) return;
    if(state.selected.length >= need) return;
    it.picked = true;

    var reversed = Math.random() < 0.30;
    it.node.querySelector('.tarot-card-face').classList.toggle('tarot-reversed-content', reversed);
    var dirEl = it.node.querySelector('.tarot-card-plate-dir');
    dirEl.className = 'tarot-card-plate-dir ' + (reversed ? 'tarot-rev' : 'tarot-up');
    dirEl.textContent = reversed ? '逆位' : '正位';

    state.selected.push({
      card: it.card,
      reversed: reversed,
      position: sp.positions[state.selected.length] || ''
    });

    progEl.textContent = '已选 '+state.selected.length+' / '+need;
    if(state.selected.length >= need){
      progEl.classList.add('tarot-fan-progress-full');
      viewBtn.disabled = false;
      arc.cards.forEach(function(c){
        if(!c.picked) c.node.classList.add('tarot-arc-dim');
      });
      stopInertia();
      arc.velocity = 0;
    }

    /* 第一拍：原地翻面 + 抬起，让图案看清楚 */
    var mm = arc.metrics;
    var slotIdx = state.selected.length - 1;
    it.node.classList.add('tarot-arc-picked','tarot-arc-flipped');
    it.node.style.zIndex = '200';
    it.node.style.transition = 'transform 0.7s var(--t-ease), opacity 0.4s ease';
    it.node.style.transform =
      'translate('+(it.x||0).toFixed(0)+'px, '+(it.y-18).toFixed(0)+'px) rotate('+(it.deg||0).toFixed(1)+'deg) scale(1.18)';

    /* 第二拍：落进底部「已选」托盘，常驻可见 */
    later(function(){
      var trayY = mm.H - 52;
      var trayX = mm.W * 0.5 + (slotIdx - (need - 1) / 2) * 52;
      it.node.classList.add('tarot-arc-flying');
      it.node.style.transition = 'transform 0.85s var(--t-ease), opacity 0.4s ease';
      it.node.style.transform =
        'translate('+trayX.toFixed(0)+'px, '+trayY.toFixed(0)+'px) rotate(0deg) scale(0.62)';
      it.node.style.opacity = '1';
      it.node.style.zIndex = '60';
    }, 900);
  }

  /* 清理拖动时挂在 window 上的监听 */
  window.addEventListener('tarot-arc-teardown', function teardownOnce(){
    stage.removeEventListener('touchstart', onDown);
    stage.removeEventListener('touchmove', onMove);
    stage.removeEventListener('touchend', onUp);
    stage.removeEventListener('touchcancel', onUp);
    window.removeEventListener('mousemove', onWinMove);
    window.removeEventListener('mouseup', onWinUp);
    window.removeEventListener('tarot-arc-teardown', teardownOnce);
    stopInertia();
    arc.root = null;
    arc.cards = [];
  });
}

/* ===================================================================
   PHASE: REVEAL — 牌面真实图案依次亮出
   =================================================================== */
function renderReveal(root){
  state.phase = 'reveal';
  setTarotBg(root, 2);
  stopArc(root);

  var sp = SPREADS[state.spread];
  var n = state.selected.length;
  /* 张数少就把牌放大，让牌面图案看得清 */
  var cw = n <= 1 ? 152 : (n <= 3 ? 96 : (n <= 5 ? 84 : 72));
  var ch = Math.round(cw / 0.583);
  var sizeStyle = 'width:'+cw+'px;height:'+ch+'px;';

  var revealCardsHTML = state.selected.map(function(sel, i){
    var dir = sel.reversed ? '逆位' : '正位';
    var dirClass = sel.reversed ? 'tarot-rev' : 'tarot-up';
    var revClass = sel.reversed ? 'tarot-rev-visual' : '';
    var slot = (sp.slots && sp.slots[i]) || null;
    var posLabel = sel.position || (slot ? slot.label : '');
    return '<div class="tarot-reveal-card" data-ci="'+i+'">'+
      '<div class="tarot-reveal-card-pos">'+esc(posLabel)+'</div>'+
      '<div class="tarot-reveal-card-visual tarot-reveal-glow '+revClass+'" style="'+sizeStyle+'">'+
        '<div class="tarot-reveal-card-dir '+dirClass+'">'+dir+'</div>'+
        '<img class="tarot-card-img" src="'+esc(artPath(sel.card))+'" alt="'+esc(sel.card.zh)+'" '+
          'onerror="this.onerror=null;this.src=\''+svgFallbackFace(sel.card).replace(/'/g, '%27')+'\'">'+
      '</div>'+
      '<div class="tarot-reveal-card-label">'+esc(sel.card.zh)+
        ' <span class="tarot-reveal-orient-'+(sel.reversed?'rev':'up')+'">'+dir+'</span></div>'+
    '</div>';
  }).join('');

  var html = '<div class="tarot-phase tarot-active">'+
    '<div class="tarot-reveal-stage">'+
      '<div class="tarot-reveal-header">'+
        '<div class="tarot-eyebrow">THE CARDS REVEALED</div>'+
        '<div class="tarot-reveal-title">'+esc(sp.name)+'</div>'+
        ornament()+
      '</div>'+
      '<div class="tarot-reveal-panel"><div class="tarot-reveal-row" id="trev-row">'+revealCardsHTML+'</div></div>'+
      '<div class="tarot-reveal-actions">'+
        '<button class="tarot-btn" id="trev-reading">查看解读</button>'+
        '<button class="tarot-btn tarot-btn-ghost" id="trev-back">重新抽牌</button>'+
      '</div>'+
    '</div>'+
  '</div>';

  root.querySelector('.tarot-phases').innerHTML = html;
  var screen = root.querySelector('.tarot-phase');

  screen.querySelectorAll('.tarot-reveal-card').forEach(function(card, i){
    later(function(){ card.classList.add('tarot-reveal-in'); }, 120 + i * 180);
  });

  screen.querySelectorAll('.tarot-reveal-card').forEach(function(card){
    card.addEventListener('click', function(){
      showCardDetail(root, Number(card.getAttribute('data-ci')));
    });
  });

  screen.querySelector('#trev-reading').addEventListener('click',function(){
    renderReading(root);
  });

  screen.querySelector('#trev-back').addEventListener('click',function(){
    try{ if(state.abortCtrl) state.abortCtrl.abort(); }catch(e){}
    clearTimers();
    state.deck = shuffle(ALL_CARDS);
    state.selected = [];
    renderShuffle(root);
  });
}

function stopArc(root){
  try{ window.dispatchEvent(new CustomEvent('tarot-arc-teardown')); }catch(e){}
  var bar = root.querySelector('.tarot-ritual-bar');
  if(bar) bar.remove();
}

/* ===================================================================
   PHASE: READING — 背景 3 · 流式解读
   =================================================================== */
function renderReading(root){
  state.phase = 'reading';
  setTarotBg(root, 3);
  stopArc(root);

  var sp = SPREADS[state.spread];
  var question = state.question || '每日指引';

  var chipsHTML = state.selected.map(function(sel,i){
    var cls = sel.reversed ? 'tarot-chip tarot-chip-rev' : 'tarot-chip';
    var dir = sel.reversed ? ' 逆' : '';
    var pos = sel.position || ((sp.positions||[])[i] || '');
    return '<div class="'+cls+'" data-ci="'+i+'">'+esc(pos)+' '+esc(sel.card.zh)+dir+'</div>';
  }).join('');

  var bodyContent = state.readingDone ? mdToHtml(state.readingText) :
    '<div class="tarot-reading-loading">正在连接星轨...<span class="tarot-cursor"></span></div>';

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
        '<div class="tarot-reading-question">“'+esc(question)+'”</div>'+
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
  root.querySelector('.tarot-phases').innerHTML = html;   /* 解读页换页不叠层（防覆盖问题） */

  root.querySelectorAll('.tarot-chip').forEach(function(chip){
    chip.addEventListener('click',function(){
      showCardDetail(root, Number(chip.dataset.ci));
    });
  });

  root.querySelector('#tr-retry').addEventListener('click',function(){
    try{ if(state.abortCtrl) state.abortCtrl.abort(); }catch(e){}
    clearTimers();
    var ol = root.querySelector('.tarot-reading-overlay');
    if(ol) ol.remove();
    state.deck = shuffle(ALL_CARDS);
    state.selected = [];
    state.readingText = '';
    state.readingDone = false;
    state.aiReadingText = '';
    state.aiReadingDone = false;
    renderArcSelect(root);
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
    try{ if(state.abortCtrl) state.abortCtrl.abort(); }catch(e){}
    clearTimers();
    var ol = root.querySelector('.tarot-reading-overlay');
    if(ol) ol.remove();
    resetState();
    renderQuestion(root);
  });

  if(!state.readingDone){
    fetchReading(root);
  }
}

function resetState(){
  teardownTarotSession();
  state = {
    phase:'question', mode:state.mode, spread:null, question:'', deck:[], selected:[],
    readingText:'', readingDone:false, abortCtrl:null, charId:null, charName:'',
    charAvatar:'', charDescription:'', aiReadingText:'', aiReadingDone:false
  };
  currentBg = 0;
  _characters = [];
}

/* ===================================================================
   CARD DETAIL MODAL
   =================================================================== */
function showCardDetail(root, ci){
  var sel = state.selected[ci];
  if(!sel) return;
  var sp = SPREADS[state.spread];
  var slot = (sp.slots && sp.slots[ci]) || null;
  var pos = sel.position || (slot ? slot.label : '');
  var hint = slot && slot.hint ? slot.hint : '';
  var dir = sel.reversed ? '逆位' : '正位';
  var dirClass = sel.reversed ? 'tarot-rev' : 'tarot-up';
  var keywords = sel.reversed ? sel.card.k_rev : sel.card.k_up;
  var meaning = sel.reversed ? sel.card.rev : sel.card.up;

  var html = '<div class="tarot-detail-overlay tarot-active" id="t-detail">'+
    '<div class="tarot-detail-panel">'+
      '<button class="tarot-detail-close" id="td-close">✕</button>'+
      '<div class="tarot-detail-art">'+
        '<img src="'+esc(artPath(sel.card))+'" alt="'+esc(sel.card.zh)+'" '+
          'onerror="this.onerror=null;this.src=\''+svgFallbackFace(sel.card).replace(/'/g, '%27')+'\'">'+
      '</div>'+
      '<div class="tarot-detail-position">'+esc(pos)+'</div>'+
      '<div class="tarot-detail-name">'+esc(sel.card.zh)+'</div>'+
      '<div class="tarot-detail-name-en">'+esc(sel.card.en)+'</div>'+
      '<div class="tarot-detail-orient '+dirClass+'">'+dir+'</div>'+
      (hint ? '<div class="tarot-detail-meta" style="margin-bottom:10px">'+esc(hint)+'</div>' : '')+
      '<div class="tarot-detail-divider"></div>'+
      '<div class="tarot-detail-section-title">关键词</div>'+
      '<div class="tarot-detail-keywords">'+esc(keywords)+'</div>'+
      '<div class="tarot-detail-divider"></div>'+
      '<div class="tarot-detail-section-title">释义</div>'+
      '<div class="tarot-detail-text">'+esc(meaning)+'</div>'+
      (sel.card.sym ? '<div class="tarot-detail-divider"></div>'+
        '<div class="tarot-detail-section-title">牌面意象</div>'+
        '<div class="tarot-detail-meta">'+esc(sel.card.sym)+'</div>' : '')+
      (sel.card.astro ? '<div class="tarot-detail-meta" style="margin-top:6px">占星对应：'+esc(sel.card.astro)+'</div>' : '')+
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
async function streamChat(root, bodyEl, messages, opts){
  opts = opts || {};
  var cfg = await window.loadGameApiConfig();
  if(!cfg.url || !cfg.key || !cfg.model){
    bodyEl.innerHTML = '<div style="color:var(--t-wine)">请先配置 API（Base URL / Key / Model）</div>';
    return {ok:false, text:''};
  }
  var abortCtrl = new AbortController();
  state.abortCtrl = abortCtrl;

  var response = await fetch(cfg.url+'/chat/completions',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+cfg.key},
    body:JSON.stringify({
      model:cfg.model,
      messages:messages,
      temperature: opts.temperature != null ? opts.temperature : (cfg.temp || 0.7),
      max_tokens: opts.maxTokens || 4000,
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
  var out = '';
  var paintQueued = false;
  var paint = function () {
    paintQueued = false;
    bodyEl.innerHTML = mdToHtml(out) + '<span class="tarot-cursor"></span>';
    var sc = root.querySelector('.tarot-reading-scroll');
    if (sc) sc.scrollTop = sc.scrollHeight;
  };

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
          out += delta.content;
          if (!paintQueued) { paintQueued = true; requestAnimationFrame(paint); }
        }
      }catch(e){}
    }
  }
  /* 尾包兼容：末帧无换行时不丢字 */
  var tail = buffer.trim();
  if(tail && tail.startsWith('data:')){
    var tailData = tail.slice(5).trim();
    if(tailData && tailData !== '[DONE]'){
      try{
        var tailChunk = JSON.parse(tailData);
        var tailDelta = tailChunk.choices && tailChunk.choices[0] && tailChunk.choices[0].delta;
        if(tailDelta && tailDelta.content) out += tailDelta.content;
      }catch(e){}
    }
  }
  bodyEl.innerHTML = mdToHtml(out);
  return {ok:true, text:out};
}

async function fetchReading(root){
  var bodyEl = root.querySelector('#tr-body');
  if(!bodyEl) return;

  try {
    if(!window.loadGameApiConfig){
      bodyEl.innerHTML = '<div style="color:var(--t-wine)">未找到 API 配置接口</div>';
      return;
    }
    var sp = SPREADS[state.spread];
    var messages = buildReadingMessages(state.selected, sp, state.question);

    var res = await streamChat(root, bodyEl, messages, {temperature: undefined, maxTokens: 4000});
    if(!res.ok) return;
    state.readingText = res.text;
    state.readingDone = true;

    saveHistory({
      ts:Date.now(),
      question:state.question,
      spreadId:sp.id,
      spreadName:sp.name,
      cards:state.selected.map(function(sel){
        return {
          id: sel.card.id, zh:sel.card.zh, en:sel.card.en,
          up:sel.card.up, rev:sel.card.rev, k_up:sel.card.k_up, k_rev:sel.card.k_rev,
          sym:sel.card.sym, astro:sel.card.astro,
          reversed:sel.reversed, position:sel.position
        };
      }),
      reading:state.readingText,
      charId:state.charId,
      charName:state.charName,
      aiReading:''
    });

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
    var sp = SPREADS[state.spread];
    var charDesc = state.charDescription || state.charName;

    var cardSummary = state.selected.map(function(sel, i){
      var slot = (sp.slots && sp.slots[i]) || null;
      var pos = sel.position || (slot ? slot.label : '');
      var dir = sel.reversed ? '逆位' : '正位';
      return (i+1)+'. '+pos+': '+sel.card.zh+'('+dir+')';
    }).join('\n');

    var systemPrompt = '你是' + state.charName + '。\n\n' +
      '你的简介：' + charDesc + '\n\n' +
      '现在，有人进行了一次塔罗占卜。请你以自己的视角和性格，对这些牌进行解读。\n\n' +
      '要求：\n' +
      '1. 以你的语气和风格进行解读\n' +
      '2. 结合你的经历和价值观来看待这些牌\n' +
      '3. 给出你自己的看法和建议\n' +
      '4. 使用中文回答，适度使用小标题分段\n' +
      '5. 在每个小标题前加上 ## 标记';

    var userMsg = '这是占卜的问题：' + (state.question || '每日指引') + '\n\n' +
      '牌阵：\n' + cardSummary + '\n\n' +
      '主要解读：\n' + state.readingText.slice(0, 800) + '\n\n' +
      '请你自己以自己的视角解读这些牌。';

    var res = await streamChat(root, aiBodyEl, [
      {role:'system', content:systemPrompt},
      {role:'user', content:userMsg}
    ], {temperature: 0.85, maxTokens: 3000});
    if(!res.ok) return;

    state.aiReadingText = res.text;
    state.aiReadingDone = true;

    try{
      var hist = getHistory();
      if(hist.length > 0 && hist[0].ts){
        hist[0].aiReading = state.aiReadingText;
        localStorage.setItem('tarot_history', JSON.stringify(hist));
      }
    }catch(e){}

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
      var slot = (sp.slots && sp.slots[i]) || null;
      var dir = sel.reversed ? '逆位' : '正位';
      var pos = sel.position || (slot ? slot.label : '');
      return pos + '：' + sel.card.zh + '(' + dir + ')' + (slot && slot.hint ? '（'+slot.hint+'）' : '') +
             '——' + (sel.reversed ? sel.card.rev : sel.card.up);
    }).join('\n');

    var cardNames = state.selected.map(function(sel){
      var dir = sel.reversed ? '逆' : '';
      return sel.card.zh + dir;
    }).join('、');

    var memPrompt = '你是记忆整理器。请将以下塔罗占卜结果整理为结构化记忆。\n\n' +
      '占卜阵：' + sp.name + '\n' +
      '问题：' + (state.question || '每日指引') + '\n' +
      '抽牌结果：\n' + cardLines + '\n' +
      (state.readingText ? '引擎解读摘要：' + state.readingText.slice(0, 300) + '\n' : '') +
      (state.aiReadingText ? (state.charName || '角色') + '视角解读摘要：' + state.aiReadingText.slice(0, 300) + '\n' : '') +
      '\n请按以下5个板块格式输出：\n' +
      '【占卜信息】牌阵名称、问题、抽到的牌和方位\n' +
      '【核心启示】牌面传达的最重要信息，2-3句\n' +
      '【情感地图】牌面显示的情感状态和变化趋势\n' +
      '【待解答题】牌面提示但未完全解答的问题\n' +
      '【行动建议】基于牌面的具体建议，1-2条\n' +
      '\n简洁明了，每板块2-3句。不要用emoji。';

    var memContent = '';
    try{
      if(window.callAI){
        memContent = await window.callAI([{role:'user',content:memPrompt}],{charAntiDrift:true});
        if(typeof memContent === 'string') memContent = memContent.replace(/```[\s\S]*?```/g,'').trim();
      }
    }catch(e){ console.warn('[tarot] AI memory gen failed:', e); }

    if(!memContent){
      memContent = '【占卜信息】' + sp.name + '，问题：' + (state.question || '每日指引') + '\n' +
        '【核心启示】' + cardNames + '\n' +
        '【情感地图】待解读\n' +
        '【待解答题】无\n' +
        '【行动建议】无';
    }

    var title = '塔罗: ' + (state.question || '每日指引').slice(0, 20);

    var keywords = ['塔罗', sp.name];
    state.selected.forEach(function(sel){
      if(keywords.length < 8) keywords.push(sel.card.zh);
    });

    var nowTs = (window.TimeWorld ? window.TimeWorld.getNow() : Date.now());

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
      createdAt: nowTs,
      updatedAt: nowTs,
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
    '<div class="tarot-settings-title">神谕来源设置</div>' +
    '<div class="tarot-settings-status" id="tarot-api-status">检查中...</div>' +
    '<div class="tarot-settings-actions">' +
      '<button class="tarot-ritual-btn" id="tarot-sync-main">同步主API配置</button>' +
      '<button class="tarot-ritual-btn" id="tarot-settings-close">关闭</button>' +
    '</div>';

  root.appendChild(panel);
  checkTarotApiStatus();

  panel.querySelector('#tarot-sync-main').addEventListener('click', async function() {
    try {
      var rows = await db.config.bulkGet(['apiBaseUrl', 'apiKey', 'apiModel']);
      var v = function(r) { return r ? r.value : null };
      var url = v(rows[0]), key = v(rows[1]), model = v(rows[2]);
      if (!url || !key || !model) {
        window.toast && window.toast('主API配置不完整，请先在设置配置主API');
        return;
      }
      await Promise.all([
        db.config.put({ key: 'gameApiBaseUrl', value: url }),
        db.config.put({ key: 'gameApiKey', value: key }),
        db.config.put({ key: 'gameApiModel', value: model })
      ]);
      window._gameApiConfigCache = null;
      window.toast && window.toast('已同步主API配置');
      checkTarotApiStatus();
    } catch(e) {
      window.toast && window.toast('同步失败: ' + e.message);
    }
  });

  panel.querySelector('#tarot-settings-close').addEventListener('click', function() {
    panel.remove();
  });
}

function checkTarotApiStatus() {
  var el = document.getElementById('tarot-api-status');
  if (!el || !window.loadGameApiConfig) { if(el) el.textContent = '无法读取配置'; return; }
  window.loadGameApiConfig().then(function(cfg) {
    if (cfg.url && cfg.key && cfg.model) {
      el.innerHTML = '<span style="color:#7ab87a">✓</span> ' + esc(cfg.model);
    } else {
      el.innerHTML = '<span style="color:var(--t-wine)">✗</span> 未配置——请同步主API或在游戏大厅设置';
    }
  });
}

/* ---- 会话生命周期：定时器注册表 + 会话拆除（防旧会话串写/泄漏） ---- */
var _timers = [];
function later(fn, ms){ var t = setTimeout(fn, ms); _timers.push(t); return t; }
function clearTimers(){ for(var ti = 0; ti < _timers.length; ti++){ clearTimeout(_timers[ti]); } _timers = []; }
function teardownTarotSession(){
  try{ if(state.abortCtrl) state.abortCtrl.abort(); }catch(e){}
  try{ window.dispatchEvent(new CustomEvent('tarot-arc-teardown')); }catch(e){}
  clearTimers();
}

/* ===================================================================
   ENTRY POINT
   =================================================================== */
window.showTarotPage = function(){
  var existing = document.getElementById('tarot-page');
  teardownTarotSession();
  if(existing) existing.remove();

  var root = document.createElement('div');
  root.id = 'tarot-page';
  root.className = 'tarot-root';

  var closeBtn = document.createElement('button');
  closeBtn.className = 'tarot-close';
  closeBtn.innerHTML = '<span class="tarot-close-x"></span>';
  closeBtn.addEventListener('click',function(){
    if(state.abortCtrl) state.abortCtrl.abort();
    stopArc(root);
    root.remove();
  });
  root.appendChild(closeBtn);

  var settingsBtn = document.createElement('button');
  settingsBtn.className = 'tarot-settings-btn';
  settingsBtn.innerHTML = '⚙';
  settingsBtn.title = 'API设置';
  settingsBtn.addEventListener('click', function(){ showTarotApiSettings(root); });
  root.appendChild(settingsBtn);

  var phases = document.createElement('div');
  phases.className = 'tarot-phases';
  root.appendChild(phases);

  var app = document.getElementById('app') || document.body;
  app.appendChild(root);

  ensureBgLayers(root);
  resetState();
  renderQuestion(root);
};

})()
