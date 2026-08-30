// spicy-data.js — 星途财弈 · 游戏数据（从JSON文件完整加载）
// 运行时从 /data/*.json 加载933条任务+64条真心话+35张身份卡
(function () {
  'use strict'

  // ── 数据缓存 ──
  var _taskLib = null
  var _truthPool = null
  var _identityPool = null

  // ── 异步加载 ──
  async function loadJSON(path) {
    try { var r = await fetch(path); return await r.json() } catch(e) { return null }
  }

  async function loadAll() {
    if (_taskLib && _truthPool && _identityPool) return
    var results = await Promise.all([
      loadJSON('data/monopoly-library.v2.json'),
      loadJSON('data/monopoly-truths.json'),
      loadJSON('data/monopoly-identities.json')
    ])
    if (results[0]) _taskLib = results[0].tasks || results[0]
    if (results[1]) _truthPool = results[1]
    if (results[2]) _identityPool = results[2]
  }

  function getTaskLib() { return _taskLib || [] }
  function getTruthPool() { return _truthPool || [] }
  function getIdentityPool() { return _identityPool || [] }

  // ── 红线开关（14种）──
  var REDLINE_SWITCHES = {
    'anal':['后庭','肛'], 'toys':['玩具','道具'], 'pain':['打','痛','SP'],
    'bondage':['绑','束缚','拘束'], 'public':['暴露','户外','公共'],
    'degrade':['羞辱','辱骂','贬低'], 'wet':['失禁','尿','喷'],
    'foot':['足','脚','踩'], 'spit':['口水','唾液'],
    'milk':['产乳','奶','挤奶'], 'estim':['电','电击'],
    'dp':['双插','双入'], 'hypno':['催眠','暗示'], 'wax':['蜡','蜡烛']
  }

  // ── 功能卡池（完整8张）──
  var CHANCE_CARDS = [
    { name:'后退3格', desc:'对手后退3格', effect:'push_opponent', value:3 },
    { name:'入狱', desc:'送对手进监狱', effect:'send_jail' },
    { name:'出狱卡', desc:'被关→出狱；没被关→免疫下次入狱', effect:'jail_free' },
    { name:'加速', desc:'下一轮再掷一次（连走两回合）', effect:'double_roll' },
    { name:'抢劫', desc:'偷对手3币', effect:'steal_coins', value:3 },
    { name:'赌一把', desc:'掷硬币：赢+3币/输-3币', effect:'gamble', value:3 },
    { name:'收租', desc:'对手按你的地盘数交租（每块1币）', effect:'collect_rent', value:1 },
    { name:'敲诈', desc:'逼对手交2币', effect:'extort', value:2 },
  ]

  var FATE_CARDS = [
    { name:'罚款', desc:'交3星币给对手', effect:'fine_3', value:3 },
    { name:'幸运捡钱', desc:'获得2星币', effect:'bonus_2', value:2 },
    { name:'倒退5格', desc:'后退5格', effect:'go_back_5', value:5 },
    { name:'进监狱', desc:'直接进监狱', effect:'go_jail' },
    { name:'超级任务', desc:'比当前强度高1-2级，不做交8币', effect:'super_task' },
    { name:'羞耻展示', desc:'做一个羞耻展示任务', effect:'shame_task' },
  ]

  // ── 常量 ──
  var TOLL_COST = 3
  var DUEL_STAKE = 3
  var JAIL_TURNS = 2
  var TAX_AMOUNT = 3
  var CARD_DRAW_COST = 3
  var SWAP_CAP = 3
  var SUPER_BUYOUT = 8
  var SHOP_CARD_COST = 3  // 商店买卡价格

  // ── 暴露到全局 ──
  window.SpicyData = {
    loadAll: loadAll,
    getTaskLib: getTaskLib,
    getTruthPool: getTruthPool,
    getIdentityPool: getIdentityPool,
    REDLINE_SWITCHES: REDLINE_SWITCHES,
    CHANCE_CARDS: CHANCE_CARDS,
    FATE_CARDS: FATE_CARDS,
    TOLL_COST: TOLL_COST,
    DUEL_STAKE: DUEL_STAKE,
    JAIL_TURNS: JAIL_TURNS,
    TAX_AMOUNT: TAX_AMOUNT,
    CARD_DRAW_COST: CARD_DRAW_COST,
    SWAP_CAP: SWAP_CAP,
    SUPER_BUYOUT: SUPER_BUYOUT,
    SHOP_CARD_COST: SHOP_CARD_COST
  }

})()
