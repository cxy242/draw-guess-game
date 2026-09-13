/* memory-panel.js - Memory Panel Module */
(function(){
  "use strict";

  function escMemHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSkeletonCards(count) {
    var html = '';
    for (var i = 0; i < (count || 3); i++) {
      html += '<div class="mp-skeleton">' +
        '<div class="mp-skeleton-line short"></div>' +
        '<div class="mp-skeleton-line medium"></div>' +
        '<div class="mp-skeleton-line"></div>' +
      '</div>';
    }
    return html;
  }

  async function loadData(charId) {
    try {
      const val = await db.config.get('memoryPanel_' + charId);
      return (val && val.value) ? val.value : {};
    } catch (e) {
      return {};
    }
  }

  function renderStatus(data) {
    const d = data || {};
    const items = [
      { icon: 'fa-shirt', label: '穿着', value: (d.wearing && d.wearing.v) ? d.wearing.v : '未记录' },
      { icon: 'fa-person-running', label: '活动', value: (d.activity && d.activity.v) ? d.activity.v : '未记录' },
      { icon: 'fa-location-dot', label: '位置', value: (d.location && d.location.v) ? d.location.v : '未记录' },
      { icon: 'fa-face-smile', label: '心情', value: (d.mood && d.mood.v) ? d.mood.v : '未记录' },
      { icon: 'fa-arrow-right', label: '下一步', value: (d.next && d.next.v) ? d.next.v : '未记录' }
    ];
    return '<div class="mp-status">' +
      '<div class="mp-card-title"><i class="fa-solid fa-circle-info"></i> 当前状态</div>' +
      items.map(function(it) {
        return '<div class="mp-status-row">' +
          '<div class="mp-status-icon"><i class="fa-solid ' + escMemHtml(it.icon) + '"></i></div>' +
          '<span class="mp-label">' + escMemHtml(it.label) + '</span>' +
          '<span class="mp-value">' + escMemHtml(it.value) + '</span>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function renderHealth(data) {
    const d = data || {};
    const aiText = (d.healthAi && d.healthAi.v) ? d.healthAi.v : '暂无健康信息';
    const recovery = d.recovery || 0;
    const userHealth = (d.healthUser && d.healthUser.v) ? d.healthUser.v : '未记录';
    return '<div class="mp-health">' +
      '<div class="mp-card-title"><i class="fa-solid fa-heart-pulse"></i> 健康状态</div>' +
      '<div class="mp-health-section">' +
        '<div class="mp-health-label"><i class="fa-solid fa-robot"></i> AI 健康状态</div>' +
        '<div class="mp-health-text">' + escMemHtml(aiText) + '</div>' +
        '<div class="mp-recovery-bar-wrap">' +
          '<div class="mp-recovery-bar" style="width:' + Math.min(100, Math.max(0, recovery)) + '%"></div>' +
        '</div>' +
        '<div class="mp-recovery-label">恢复进度: ' + recovery + '%</div>' +
      '</div>' +
      '<div class="mp-health-section">' +
        '<div class="mp-health-label"><i class="fa-solid fa-user"></i> 用户健康</div>' +
        '<div class="mp-health-text">' + escMemHtml(userHealth) + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderSchedule(data) {
    const d = data || {};
    const past = d.schedulePast || [];
    const today = d.scheduleToday || [];
    const tomorrow = d.scheduleTomorrow || [];
    const agreements = d.agreements || [];

    function renderTimeline(items) {
      if (!items.length) return '<div class="mp-empty"><i class="fa-solid fa-calendar-xmark"></i>暂无安排</div>';
      return items.map(function(it) {
        return '<div class="mp-timeline-item">' +
          '<div class="mp-timeline-dot"></div>' +
          '<div class="mp-timeline-content">' +
            '<div class="mp-timeline-time">' + escMemHtml(it.time || '') + '</div>' +
            '<div class="mp-timeline-text">' + escMemHtml(it.text || it.content || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<div class="mp-schedule">' +
      '<div class="mp-card-title"><i class="fa-solid fa-calendar-days"></i> 日程安排</div>' +
      '<div class="mp-tabs" data-tabs="schedule">' +
        '<button class="mp-tab active" data-tab="past">前三天</button>' +
        '<button class="mp-tab" data-tab="today">今天</button>' +
        '<button class="mp-tab" data-tab="tomorrow">明天</button>' +
        '<button class="mp-tab" data-tab="agreements">约定</button>' +
      '</div>' +
      '<div class="mp-tab-content" data-tab-content="past">' + renderTimeline(past) + '</div>' +
      '<div class="mp-tab-content" data-tab-content="today" style="display:none">' + renderTimeline(today) + '</div>' +
      '<div class="mp-tab-content" data-tab-content="tomorrow" style="display:none">' + renderTimeline(tomorrow) + '</div>' +
      '<div class="mp-tab-content" data-tab-content="agreements" style="display:none">' + renderTimeline(agreements) + '</div>' +
    '</div>';
  }

  async function renderMemoryList(charId) {
    let memories = [];
    try {
      const all = await db.memories.where('charId').equals(charId).toArray();
      memories = all || [];
    } catch (e) {
      try {
        const all = await db.memories.toArray();
        memories = (all || []).filter(function(m) { return m.charId === charId; });
      } catch (e2) {
        memories = [];
      }
    }

    const recalledKey = 'memRecalled_' + charId;
    let recalled = [];
    try { recalled = JSON.parse(localStorage.getItem(recalledKey) || '[]'); } catch(e) { recalled = []; }

    var cards = '';
    if (memories.length === 0) {
      cards = '<div class="mp-empty"><i class="fa-solid fa-brain"></i>还没有记忆记录<br>开始对话后会自动积累</div>';
    } else {
      cards = memories.map(function(m) {
        const id = m.id || m._id || '';
        const title = escMemHtml(m.title || '无标题');
        const content = escMemHtml((m.content || '').substring(0, 50) + ((m.content || '').length > 50 ? '...' : ''));
        const sourceType = escMemHtml(m.sourceType || 'unknown');
        const time = escMemHtml(m.time || m.createdAt || '');
        const isRecalled = recalled.indexOf(id) !== -1;

        return '<div class="mp-memory-card' + (isRecalled ? ' mp-recalled' : '') + '" data-mem-id="' + escMemHtml(String(id)) + '">' +
          '<div class="mp-memory-header">' +
            '<span class="mp-memory-title">' + title + '</span>' +
            '<span class="mp-memory-badge">' + sourceType + '</span>' +
          '</div>' +
          '<div class="mp-memory-content">' + content + '</div>' +
          '<div class="mp-memory-time">' + time + '</div>' +
          '<div class="mp-memory-actions">' +
            '<button class="mp-btn mp-btn-recall' + (isRecalled ? ' active' : '') + '" data-action="recall" data-id="' + escMemHtml(String(id)) + '">' +
              '<i class="fa-solid fa-lightbulb"></i> 想起' +
            '</button>' +
            '<button class="mp-btn mp-btn-view" data-action="view" data-id="' + escMemHtml(String(id)) + '">' +
              '<i class="fa-solid fa-eye"></i> 查看原文' +
            '</button>' +
            '<button class="mp-btn mp-btn-resummarize" data-action="resummarize" data-id="' + escMemHtml(String(id)) + '">' +
              '<i class="fa-solid fa-rotate"></i> 重新总结' +
            '</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    return '<div class="mp-memory-list">' +
      '<div class="mp-card-title"><i class="fa-solid fa-book-open"></i> 记忆列表</div>' +
      '<div class="mp-memory-search">' +
        '<i class="fa-solid fa-magnifying-glass mp-search-icon"></i>' +
        '<input type="text" class="mp-search-input" placeholder="搜索记忆..." />' +
      '</div>' +
      '<div class="mp-memory-cards">' + cards + '</div>' +
    '</div>';
  }

  function renderFooter() {
    return '<div class="mp-footer">' +
      '<button class="mp-btn mp-btn-add"><i class="fa-solid fa-plus"></i> 添加记忆</button>' +
      '<button class="mp-btn mp-btn-settings"><i class="fa-solid fa-gear"></i> 设置</button>' +
    '</div>';
  }

  function buildPanel(charId, charName, data, memoryListHtml) {
    return '<div class="mp-overlay">' +
      '<div class="mp-panel">' +
        '<div class="mp-header">' +
          '<div class="mp-header-title">' +
            '<i class="fa-solid fa-brain"></i> ' + escMemHtml(charName) + ' 的记忆面板' +
          '</div>' +
          '<button class="mp-close">&times;</button>' +
        '</div>' +
        '<div class="mp-body">' +
          renderStatus(data) +
          renderHealth(data) +
          renderSchedule(data) +
          memoryListHtml +
        '</div>' +
        renderFooter() +
      '</div>' +
    '</div>';
  }

  function bindEvents(panel, charId) {
    // Close
    var closeBtn = panel.querySelector('.mp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        var overlay = panel.querySelector('.mp-overlay') || panel;
        overlay.remove();
      });
    }
    // Overlay click to close
    var overlay = panel.querySelector('.mp-overlay');
    if (overlay) {
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) overlay.remove();
      });
    }

    // Schedule tabs
    var tabButtons = panel.querySelectorAll('[data-tabs="schedule"] .mp-tab');
    tabButtons.forEach(function(btn) {
      btn.addEventListener('click', function() {
        tabButtons.forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
        var tabId = btn.getAttribute('data-tab');
        var contents = panel.querySelectorAll('.mp-tab-content');
        contents.forEach(function(c) {
          c.style.display = c.getAttribute('data-tab-content') === tabId ? '' : 'none';
        });
      });
    });

    // Search
    var searchInput = panel.querySelector('.mp-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        var q = searchInput.value.toLowerCase();
        var cards = panel.querySelectorAll('.mp-memory-card');
        cards.forEach(function(card) {
          var text = card.textContent.toLowerCase();
          card.style.display = text.indexOf(q) !== -1 ? '' : 'none';
        });
      });
    }

    // Recall toggle
    panel.querySelectorAll('[data-action="recall"]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = btn.getAttribute('data-id');
        var recalledKey = 'memRecalled_' + charId;
        var recalled = [];
        try { recalled = JSON.parse(localStorage.getItem(recalledKey) || '[]'); } catch(e) { recalled = []; }
        var idx = recalled.indexOf(id);
        if (idx !== -1) {
          recalled.splice(idx, 1);
          btn.classList.remove('active');
          var card = btn.closest('.mp-memory-card');
          if (card) card.classList.remove('mp-recalled');
        } else {
          recalled.push(id);
          btn.classList.add('active');
          var card = btn.closest('.mp-memory-card');
          if (card) card.classList.add('mp-recalled');
        }
        localStorage.setItem(recalledKey, JSON.stringify(recalled));
      });
    });

    // View original
    panel.querySelectorAll('[data-action="view"]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var memId = btn.getAttribute('data-id');
        var originalText = '';
        try {
          const run = await db.memoryRuns.where('memoryId').equals(memId).first();
          if (run && run.originalText) {
            originalText = run.originalText;
          }
        } catch(e) {}
        if (!originalText) {
          try {
            const runs = await db.memoryRuns.toArray();
            const found = (runs || []).find(function(r) { return r.memoryId === memId || String(r.id) === String(memId); });
            if (found) originalText = found.originalText || found.text || '';
          } catch(e2) {}
        }
        if (!originalText) originalText = '未找到原文';

        var popup = document.createElement('div');
        popup.className = 'mp-popup-overlay';
        popup.innerHTML = '<div class="mp-popup">' +
          '<div class="mp-popup-header">' +
            '<span>原文内容</span>' +
            '<button class="mp-popup-close">&times;</button>' +
          '</div>' +
          '<div class="mp-popup-body">' + escMemHtml(originalText) + '</div>' +
        '</div>';
        document.body.appendChild(popup);
        popup.querySelector('.mp-popup-close').addEventListener('click', function() { popup.remove(); });
        popup.addEventListener('click', function(e) { if (e.target === popup) popup.remove(); });
      });
    });

    // Re-summarize
    panel.querySelectorAll('[data-action="resummarize"]').forEach(function(btn) {
      btn.addEventListener('click', async function() {
        var memId = btn.getAttribute('data-id');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 处理中...';
        try {
          let mem = null;
          try { mem = await db.memories.get(memId); } catch(e) {}
          if (!mem) {
            const all = await db.memories.toArray();
            mem = (all || []).find(function(m) { return String(m.id) === String(memId) || String(m._id) === String(memId); });
          }
          if (mem && typeof window.callAI === 'function') {
            const result = await window.callAI({
              task: 'resummarize',
              memoryId: memId,
              content: mem.content || mem.originalText || '',
              title: mem.title || ''
            });
            if (result) {
              btn.innerHTML = '<i class="fa-solid fa-check"></i> 完成';
            } else {
              btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重新总结';
            }
          } else {
            btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重新总结';
            if (!mem) console.warn('Memory not found:', memId);
            if (typeof window.callAI !== 'function') console.warn('window.callAI not available');
          }
        } catch(e) {
          console.error('Re-summarize error:', e);
          btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重新总结';
        }
        btn.disabled = false;
      });
    });
  }

  window.openMemoryPanel = async function(charId, charName) {
    if (!charId) {
      console.warn('openMemoryPanel: charId is required');
      return;
    }
    charName = charName || 'AI';

    // Remove existing panel if any
    var existing = document.querySelector('.mp-overlay');
    if (existing) existing.remove();

    // Show loading state with skeleton
    var container = document.createElement('div');
    container.innerHTML = '<div class="mp-overlay">' +
      '<div class="mp-panel">' +
        '<div class="mp-header">' +
          '<div class="mp-header-title">' +
            '<i class="fa-solid fa-brain"></i> ' + escMemHtml(charName) + ' 的记忆面板' +
          '</div>' +
          '<button class="mp-close">&times;</button>' +
        '</div>' +
        '<div class="mp-body">' +
          renderSkeletonCards(3) +
        '</div>' +
      '</div>' +
    '</div>';
    var overlay = container.firstElementChild;
    document.body.appendChild(overlay);

    // Bind close on loading overlay
    var closeBtn = overlay.querySelector('.mp-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() { overlay.remove(); });
    }
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });

    // Load data
    const data = await loadData(charId);
    const memoryListHtml = await renderMemoryList(charId);

    // Replace with full panel
    overlay.remove();
    var container2 = document.createElement('div');
    container2.innerHTML = buildPanel(charId, charName, data, memoryListHtml);
    var overlay2 = container2.firstElementChild;
    document.body.appendChild(overlay2);
    bindEvents(overlay2, charId);
  };
})();
