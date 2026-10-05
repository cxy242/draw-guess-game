/**
 * time.js — 虚拟世界时间引擎 (TimeWorld) v2.0
 * 按 task4-design-spec.md §6 施工（图纸为唯一施工依据）
 * ============================================================
 * 文件定位：纯逻辑引擎，无 DOM。UI 在 time-page.js。
 * 内胆格式：'YYYY年M月D日上午/中午/下午/晚上X点XX分'（X点XX分补零，与 memory.js v6.2.2 同款）
 *
 * 铁律：
 *   1. 全项目唯一时间源——禁用裸 new Date()/Date.now()（收口迁移清单见图纸 §6）
 *   2. 语义时间用虚拟（getNow），机制节流用现实（Date.now 白名单内的定时器）
 *   3. 双时间戳：写档 createdAt=虚拟 + realCreatedAt=现实（审计锚，写档方用 stampOf()）
 *   4. 设置全部真生效，不做隐性钳制
 *   5. 流速引擎：现实 setInterval 每秒累加偏移（按图纸 §6 实现要点），暂停=冻结
 *
 * 存储 db.config 六键：tw_enabled / tw_offset / tw_speed / tw_audit / tw_ball_visible / tw_ball_pos
 */
(function () {
  'use strict';

  /* ================= 常量 ================= */
  var K_ENABLED = 'tw_enabled';
  var K_OFFSET  = 'tw_offset';
  var K_SPEED   = 'tw_speed';
  var K_AUDIT   = 'tw_audit';
  var K_FROZEN  = 'tw_frozen';        // P2-2：暂停冻结点持久化（第七键）
  var AUDIT_MAX = 50;                 // 图纸 §4⑦：最多 50 条，旧的从头删
  var SPEEDS    = [0, 1, 2, 10];      // 暂停/正常/2x/10x
  var WEEK      = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  /* ================= 状态 ================= */
  var _enabled = false;
  var _offset = 0;          // 虚拟-真实 偏移（毫秒），流速累加也进这里
  var _speed = 1;
  var _speedTimer = null;   // 现实 setInterval（机制节流白名单）
  var _frozenTs = null;     // 暂停冻结点（打回#1）
  var _listeners = [];

  /* ================= 内部工具 ================= */
  function _pad2(n) { return (n < 10 ? '0' : '') + n; }

  function _period(h) {
    return h < 6 ? '凌晨' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : h < 22 ? '晚上' : '深夜';
  }

  /* 内胆格式化：'YYYY年M月D日上午X点XX分'（分钟补零） */
  function _formatInner(ts) {
    var d = new Date(ts);   // 数字时间戳搬运（白名单）
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日' +
      _period(d.getHours()) + (d.getHours() % 12 || 12) + '点' + _pad2(d.getMinutes()) + '分';
  }

  function _emit() {
    var snap = _snapshot();
    for (var i = 0; i < _listeners.length; i++) {
      try { _listeners[i](snap); } catch (e) { console.warn('[TimeWorld] 监听器异常:', e); }
    }
  }

  function _snapshot() {
    return {
      enabled: _enabled,
      speed: _speed,
      offset: _offset,
      virtualTs: getNow(),
      realTs: Date.now(),
      formatted: getFormattedNow()
    };
  }

  /* ================= 持久化（db.config 优先，localStorage 兜底） ================= */
  async function _put(key, value) {
    try {
      if (window.db && window.db.config) await window.db.config.put({ key: key, value: value });
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.warn('[TimeWorld] 持久化失败 ' + key + ':', e); }
  }

  async function _get(key, def) {
    try {
      if (window.db && window.db.config) {
        var r = await window.db.config.get(key);
        return r ? r.value : def;
      }
      var raw = localStorage.getItem(key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  }

  /* ================= 流速引擎（图纸 §6：现实 interval 每秒累加偏移） ================= */
  function _stopSpeedTimer() {
    if (_speedTimer) { clearInterval(_speedTimer); _speedTimer = null; }
  }

  function _startSpeedTimer() {
    _stopSpeedTimer();
    if (!_enabled || _speed <= 1) return;   // 关闭或正常流速不需累加
    // 每现实秒多走 (speed-1) 秒；暂停（0）由 _offset 冻结语义处理
    _speedTimer = setInterval(function () {
      _offset += (_speed - 1) * 1000;
    }, 1000);
  }

  /* ================= 核心接口（图纸 §6 十接口） ================= */

  /** Number 时间戳：开=虚拟now（含冻结），关=Date.now()（克劳德打回#2 修：关=回现实） */
  function getNow() {
    if (!_enabled) return Date.now();
    if (_speed === 0 && _frozenTs != null) return _frozenTs;   // 打回#1 修：暂停=冻结
    return Date.now() + _offset;
  }

  /** 'YYYY年M月D日 上午X点XX分'（内胆与 memory.js v6.2.2 同款） */
  function getFormattedNow(ts) {
    return _formatInner(ts != null ? ts : getNow());
  }

  /** '2027年3月5日 星期四'（AI 注入用） */
  function getDayString(ts) {
    var d = new Date(ts != null ? ts : getNow());
    return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + WEEK[d.getDay()];
  }

  /** 记忆总结窗口（虚拟口径，单调性：起点=max(上次总结点, now)） */
  function getTimeRange(lastSummaryTs) {
    var now = getNow();
    // 打回#3 裁决：不截尾（图纸未写截尾；超时未总结的消息必须进窗，截尾=漏消息）
    var start = lastSummaryTs || now;                               // 无 lastSummary=零窗（防首跑全量刷屏）
    if (lastSummaryTs && lastSummaryTs > now) start = now;          // 虚拟倒退防重（单调性）
    return { startTime: start, endTime: now };
  }

  /** 距上次聊天（虚拟口径） */
  async function getTimeSinceLastChat(charId) {
    try {
      if (!window.db || !window.db.messages || !charId) return '';
      // P2-5 修：读该角色消息 max(createdAt)（语义="上次聊天"，chats.createdAt 是会话创建时刻错源）
      var msgs = await window.db.messages.where('charId').equals(charId).toArray();
      if (!msgs.length) return '';
      var lastTs = msgs.reduce(function (m, x) { return Math.max(m, x.createdAt || 0); }, 0);
      var diff = getNow() - lastTs;
      if (diff < 0) return '刚刚';
      var mins = Math.floor(diff / 60000);
      if (mins < 60) return mins + '分钟前';
      var hrs = Math.floor(mins / 60);
      return hrs < 24 ? hrs + '小时前' : Math.floor(hrs / 24) + '天前';
    } catch (e) { return ''; }
  }

  /* ---- 偏移控制 ---- */
  function getOffset() { return _offset; }

  function setOffset(n) {
    // P2-3 修：冻结态下设置直接改冻结点（否则被 getNow 短路+解冻吞掉）
    if (_speed === 0 && _frozenTs != null) {
      _frozenTs = Date.now() + (Number(n) || 0);
      _put(K_FROZEN, _frozenTs);
    } else {
      _offset = Number(n) || 0;
      _put(K_OFFSET, _offset);
    }
    audit('setOffset', '偏移→' + Math.round(Number(n) / 60000) + '分钟');
    _emit();
  }

  function addOffset(ms) {
    if (_speed === 0 && _frozenTs != null) {
      _frozenTs += ms;
      _put(K_FROZEN, _frozenTs);
    } else {
      _offset += ms;
      _put(K_OFFSET, _offset);
    }
    audit('addOffset', (ms >= 0 ? '+' : '') + Math.round(ms / 60000) + '分钟');
    _emit();
  }

  function reset() {
    if (_speed === 0 && _frozenTs != null) {
      _frozenTs = Date.now();
      _put(K_FROZEN, _frozenTs);
    } else {
      _offset = 0;
      _put(K_OFFSET, 0);
    }
    audit('reset', '一键回到现在');
    _emit();
  }

  /* ---- 开关与流速 ---- */
  function isEnabled() { return _enabled; }

  function setEnabled(on) {
    on = !!on;
    if (on === _enabled) return;
    _enabled = on;
    _put(K_ENABLED, on);
    if (on) {
      audit('enable', '虚拟时间开启');
      _startSpeedTimer();
    } else {
      audit('disable', '虚拟时间关闭（偏移保留）');
      _stopSpeedTimer();
    }
    _emit();
  }

  function getSpeed() { return _speed; }

  function setSpeed(s) {
    if (SPEEDS.indexOf(s) === -1) {
      console.warn('[TimeWorld] 非法流速（合法档 ' + SPEEDS.join('/') + '）:', s);
      return false;
    }
    // 打回#1 修：暂停=冻结（捕获冻结点；恢复时锚定解冻值世界不跳变）
    if (s === 0 && _speed !== 0) {
      _frozenTs = Date.now() + _offset;
      _put(K_FROZEN, _frozenTs);   // P2-2：持久化冻结点
    } else if (_speed === 0 && s !== 0 && _frozenTs != null) {
      _offset = _frozenTs - Date.now();
      _frozenTs = null;
      _put(K_OFFSET, _offset);
      _put(K_FROZEN, null);
    }
    _speed = s;
    _put(K_SPEED, s);
    audit('setSpeed', '流速→' + (s === 0 ? '暂停（冻结）' : s + 'x'));
    _startSpeedTimer();
    _emit();
    return true;
  }

  /* ================= 审计链（含 realCreatedAt 现实锚） ================= */
  function audit(action, detail) {
    var log = _auditCache;
    log.push({
      action: action,
      detail: detail || '',
      virtualTs: getNow(),
      realTs: Date.now()          // 现实锚（边界#2）
    });
    if (log.length > AUDIT_MAX) log.splice(0, log.length - AUDIT_MAX);
    _put(K_AUDIT, log);
  }

  var _auditCache = [];

  function getAudit() { return _auditCache.slice(); }

  function clearAudit() {
    _auditCache = [];
    _put(K_AUDIT, []);
    _emit();
  }

  /* ================= 写档双时间戳（铁律③） ================= */
  function stampOf() {
    return { createdAt: getNow(), realCreatedAt: Date.now() };
  }

  /* ================= UI 辅助 ================= */

  /** 近 N 天虚拟日期（setDate 算天+可带年份，P4b/c） */
  function getRecentDays(n, withYear) {
    var out = [];
    var base = new Date(getNow());
    for (var i = n; i >= 1; i--) {
      var d = new Date(base.getTime());
      d.setDate(d.getDate() - i);
      out.push({
        y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(),
        label: (withYear ? d.getFullYear() + '年' : '') + (d.getMonth() + 1) + '月' + d.getDate() + '日'
      });
    }
    return out;
  }

  function onChange(cb) {
    if (typeof cb === 'function') _listeners.push(cb);
    return function offChange() {   // P2-4：注销口（防监听器泄漏）
      var i = _listeners.indexOf(cb);
      if (i !== -1) _listeners.splice(i, 1);
    };
  }

  /* ================= 启动装载 ================= */
  async function init() {
    try {
      _enabled = (await _get(K_ENABLED, false)) === true;
      _offset = Number(await _get(K_OFFSET, 0)) || 0;
      var sp = Number(await _get(K_SPEED, 1));
      _speed = SPEEDS.indexOf(sp) !== -1 ? sp : 1;
      var log = await _get(K_AUDIT, []);
      _auditCache = Array.isArray(log) ? log : [];
      _frozenTs = Number(await _get(K_FROZEN, 0)) || null;   // P2-2：恢复冻结点
      _startSpeedTimer();
      console.log('[TimeWorld] 就绪 enabled=' + _enabled + ' speed=' + _speed + ' offset=' + _offset);
      _emit();
    } catch (e) {
      // P2-6 修：半初始化态强制复位（否则 _enabled 可能已 true 仍走虚拟分支）
      console.warn('[TimeWorld] init 失败，强制复位降级真实时间:', e);
      _enabled = false; _speed = 1; _frozenTs = null;
      _stopSpeedTimer();
    }
  }

  /* ================= 导出（图纸 §6 十接口+扩展） ================= */
  window.TimeWorld = {
    /* 十接口 */
    getNow: getNow,
    getFormattedNow: getFormattedNow,
    getDayString: getDayString,
    getTimeRange: getTimeRange,
    getTimeSinceLastChat: getTimeSinceLastChat,
    getOffset: getOffset,
    setOffset: setOffset,
    addOffset: addOffset,
    reset: reset,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    getSpeed: getSpeed,
    setSpeed: setSpeed,
    audit: audit,
    /* 扩展（写档双戳/审计读取/UI 辅助） */
    stampOf: stampOf,
    getAudit: getAudit,
    clearAudit: clearAudit,
    getRecentDays: getRecentDays,
    onChange: onChange,
    init: init
  };

  /* 兼容别名（收口迁移期旧名过渡，迁移完成后删除） */
  window.TimeProvider = window.TimeWorld;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  } else {
    setTimeout(init, 500);
  }
})();
