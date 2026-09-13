// Memory Panel - 5 modules: status, health, schedule, memory, footer
(function(){
  'use strict';

  function escMemHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function formatMemTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    var pad = function(n){ return n<10?'0'+n:n; };
    return (d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes());
  }

  async function loadData() {
    try {
      if (!window.db || !window.db.config) return null;
      var chars = [];
      try { chars = await window.db.characters.toArray(); } catch(e){}
      var cid = (window.currentCharId) || (chars[0] && chars[0].id) || 'default';
      var rec = await window.db.config.get('memoryPanel_' + cid);
      return rec ? rec : null;
    } catch(e) {
      console.warn('[MemoryPanel] load error', e);
      return null;
    }
  }

  // Module 1: Status (wearing, activity, location, mood, next)
  function renderStatus(data) {
    if (!data) return '';
    var rows = [
      { icon: 'fa-tshirt', label: '穿着', key: 'wearing' },
      { icon: 'fa-running', label: '活动', key: 'activity' },
      { icon: 'fa-map-marker-alt', label: '位置', key: 'location' },
      { icon: 'fa-smile', label: '心情', key: 'mood' },
      { icon: 'fa-arrow-right', label: '下一步', key: 'next' }
    ];
    var html = '<div class="mp-card"><div class="mp-card-title"><i class="fas fa-user-circle"></i> 当前状态</div>';
    var hasData = false;
    rows.forEach(function(r){
      var item = data[r.key];
      if (item && item.v) {
        hasData = true;
        html += '<div class="mp-status-row">' +
          '<i class="fas ' + escMemHtml(r.icon) + '" style="color:#4a9eff;width:16px;text-align:center"></i>' +
          '<span class="mp-label">' + escMemHtml(r.label) + '</span>' +
          '<span class="mp-value">' + escMemHtml(item.v) + '</span>' +
          '<span class="mp-time">' + formatMemTime(item.t) + '</span>' +
          '</div>';
      }
    });
    html += '</div>';
    return hasData ? html : '';
  }

  // Module 2: Health
  function renderHealth(data) {
    if (!data) return '';
    var ai = data.healthAi;
    var user = data.healthUser;
    if ((!ai || !ai.v) && (!user || !user.v)) return '';
    var html = '<div class="mp-card mp-health-card"><div class="mp-card-title"><i class="fas fa-heartbeat"></i> 健康状况</div>';
    if (ai && ai.v) {
      html += '<div class="mp-health-item"><div class="mp-health-label"><i class="fas fa-robot"></i> AI记录</div>' +
        '<div>' + escMemHtml(ai.v) + '</div><div class="mp-time" style="font-size:11px;color:#a0aec0">' + formatMemTime(ai.t) + '</div></div>';
    }
    if (user && user.v) {
      html += '<div class="mp-health-item"><div class="mp-health-label"><i class="fas fa-user"></i> 用户告知</div>' +
        '<div>' + escMemHtml(user.v) + '</div><div class="mp-time" style="font-size:11px;color:#a0aec0">' + formatMemTime(user.t) + '</div></div>';
    }
    html += '</div>';
    return html;
  }

  // Module 3: Schedule
  function renderSchedule(data) {
    if (!data) return '';
    var sections = [];
    if (data.schedulePast && data.schedulePast.length) {
      data.schedulePast.forEach(function(day){
        var s = '<div class="mp-schedule-section"><div class="mp-schedule-date">' + escMemHtml(day.date) + '</div>';
        (day.events||[]).forEach(function(e){
          s += '<div class="mp-schedule-event"><span class="mp-event-time">' + escMemHtml(e.time) + '</span><span>' + escMemHtml(e.event) + '</span></div>';
        });
        s += '</div>';
        sections.push(s);
      });
    }
    if (data.scheduleToday && data.scheduleToday.length) {
      var s = '<div class="mp-schedule-section"><div class="mp-schedule-date"><i class="fas fa-sun"></i> 今天</div>';
      data.scheduleToday.forEach(function(e){
        s += '<div class="mp-schedule-event"><span class="mp-event-time">' + escMemHtml(e.time) + '</span><span>' + escMemHtml(e.event) + '</span></div>';
      });
      s += '</div>';
      sections.push(s);
    }
    if (data.scheduleTomorrow && data.scheduleTomorrow.length) {
      var s = '<div class="mp-schedule-section"><div class="mp-schedule-date"><i class="fas fa-calendar-day"></i> 明天</div>';
      data.scheduleTomorrow.forEach(function(e){
        s += '<div class="mp-schedule-event"><span class="mp-event-time">' + escMemHtml(e.time) + '</span><span>' + escMemHtml(e.event) + '</span></div>';
      });
      s += '</div>';
      sections.push(s);
    }
    if (data.agreements && data.agreements.length) {
      var s = '<div class="mp-schedule-section"><div class="mp-schedule-date"><i class="fas fa-handshake"></i> 约定</div>';
      data.agreements.forEach(function(a){
        s += '<div class="mp-agreement-item"><span>' + escMemHtml(a.event) + '</span>' +
          '<span class="mp-agreement-status">' + escMemHtml(a.status || '已约定') + '</span></div>';
      });
      s += '</div>';
      sections.push(s);
    }
    if (!sections.length) return '';
    return '<div class="mp-card mp-schedule-card"><div class="mp-card-title"><i class="fas fa-calendar-alt"></i> 日程安排</div>' + sections.join('') + '</div>';
  }

  // Module 4: Memory items (agreements as memory entries)
  function renderMemory(data) {
    if (!data) return '';
    var items = [];
    if (data.wearing && data.wearing.v) items.push({ icon: 'fa-tshirt', text: '穿着: ' + data.wearing.v, time: data.wearing.t });
    if (data.activity && data.activity.v) items.push({ icon: 'fa-running', text: '活动: ' + data.activity.v, time: data.activity.t });
    if (data.location && data.location.v) items.push({ icon: 'fa-map-marker-alt', text: '位置: ' + data.location.v, time: data.location.t });
    if (data.mood && data.mood.v) items.push({ icon: 'fa-smile', text: '心情: ' + data.mood.v, time: data.mood.t });
    if (data.healthAi && data.healthAi.v) items.push({ icon: 'fa-heartbeat', text: '健康(AI): ' + data.healthAi.v, time: data.healthAi.t });
    if (data.healthUser && data.healthUser.v) items.push({ icon: 'fa-notes-medical', text: '健康(用户): ' + data.healthUser.v, time: data.healthUser.t });
    if (!items.length) return '';
    items.sort(function(a,b){ return (b.time||0)-(a.time||0); });
    var html = '<div class="mp-card"><div class="mp-card-title"><i class="fas fa-brain"></i> 记忆详情</div>';
    items.forEach(function(it){
      html += '<div class="mp-mem-item"><i class="fas ' + escMemHtml(it.icon) + ' mp-mem-icon"></i>' +
        '<div class="mp-mem-content"><div>' + escMemHtml(it.text) + '</div>' +
        '<div class="mp-mem-meta">' + formatMemTime(it.time) + '</div></div></div>';
    });
    html += '</div>';
    return html;
  }

  // Module 5: Footer
  function renderFooter(data) {
    var updated = data && data.updatedAt ? formatMemTime(data.updatedAt) : '无数据';
    return '<div class="mp-footer"><span class="mp-updated"><i class="fas fa-clock"></i> 更新于 ' + escMemHtml(updated) + '</span>' +
      '<button class="mp-btn" id="mp-close-btn-bottom"><i class="fas fa-check"></i> 知道了</button></div>';
  }

  function buildPanel(data) {
    var html = '<div class="mp-panel">' +
      '<div class="mp-header"><h2><i class="fas fa-brain"></i> 记忆面板</h2>' +
      '<button class="mp-close-btn" id="mp-close-x">&times;</button></div>' +
      '<div class="mp-body">' +
      renderStatus(data) +
      renderHealth(data) +
      renderSchedule(data) +
      renderMemory(data) +
      '</div>' +
      renderFooter(data) +
      '</div>';
    return html;
  }

  function closeMemoryPanel() {
    var ov = document.querySelector('.mp-overlay');
    if (ov) { ov.remove(); }
  }

  async function openMemoryPanel() {
    closeMemoryPanel();
    var data = await loadData();
    var overlay = document.createElement('div');
    overlay.className = 'mp-overlay';
    overlay.innerHTML = buildPanel(data);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e){
      if (e.target === overlay) closeMemoryPanel();
    });
    var xBtn = overlay.querySelector('#mp-close-x');
    if (xBtn) xBtn.addEventListener('click', closeMemoryPanel);
    var bBtn = overlay.querySelector('#mp-close-btn-bottom');
    if (bBtn) bBtn.addEventListener('click', closeMemoryPanel);
  }

  window.openMemoryPanel = openMemoryPanel;
  window.closeMemoryPanel = closeMemoryPanel;
})();
