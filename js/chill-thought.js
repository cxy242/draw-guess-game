/* chill-thought.js — Chill心声展示模块 */
/* 原版Chill字段完全保留，只做UI适配 */

(function(){
'use strict';

// 原版Chill字段列表（不修改）
var CHILL_FIELDS = [
  'run_result_summary','actual_behavior_log','result_quote',
  'night_log_entries1','night_log_entries2','night_log_entries3','night_log_entries4',
  'night_report_entries1','night_report_entries2','night_report_entries3','night_report_entries4',
  'night_report_summary','night_report_quote',
  'unsent_draft','draft_last_line','draft_recovery_note',
  'account_1_messages','account_2_messages','account_3_messages','photo_description',
  'hidden_fragment_1','hidden_fragment_2'
];

// 字段分组（对应原版UI的各个section）
var CHILL_SECTIONS = {
  quick: {
    title: 'QUICK COMMAND 01',
    badge: 'ACTIVE',
    fields: ['run_result_summary','actual_behavior_log','result_quote'],
    labels: {run_result_summary:'RECORD',actual_behavior_log:'BEHAVIOR LOG',result_quote:'QUOTE'}
  },
  nightTimeline: {
    title: 'NIGHT TIMELINE',
    badge: '02:00\u201404:00',
    fields: ['night_log_entries1','night_log_entries2','night_log_entries3','night_log_entries4'],
    times: ['02:17','02:32','03:06','03:08']
  },
  nightReport: {
    title: 'NIGHT REPORT',
    badge: 'HIDDEN',
    fields: ['night_report_entries1','night_report_entries2','night_report_entries3','night_report_entries4'],
    times: ['02:17','02:32','03:06','03:08'],
    summary: 'night_report_summary',
    quote: 'night_report_quote'
  },
  draft: {
    title: 'UNSENT DRAFT',
    badge: 'LOCAL ONLY',
    fields: ['unsent_draft','draft_last_line','draft_recovery_note']
  },
  accounts: {
    title: 'TRACES',
    badge: '03',
    fields: ['account_1_messages','account_2_messages','account_3_messages','photo_description']
  },
  hidden: {
    title: 'HIDDEN FRAGMENTS',
    badge: 'SEALED',
    fields: ['hidden_fragment_1','hidden_fragment_2']
  }
};

// 检查消息是否有Chill心声数据
function hasChillData(msg) {
  if (!msg || !msg.chill) return false;
  return CHILL_FIELDS.some(function(f){ return msg.chill[f]; });
}

// 渲染单个section
function renderSection(sectionKey, data) {
  var sec = CHILL_SECTIONS[sectionKey];
  if (!sec) return '';
  var hasAny = sec.fields.some(function(f){ return data[f]; });
  if (!hasAny) return '';
  
  var html = '<div class="chill-thought-section">';
  html += '<div class="chill-thought-header">';
  html += '<h3>' + esc(sec.title) + '</h3>';
  html += '<span class="ct-badge">' + esc(sec.badge) + '</span>';
  html += '</div>';
  html += '<div class="chill-thought-body">';
  
  if (sectionKey === 'quick') {
    if (data.run_result_summary) {
      html += '<span class="ct-label">' + esc(sec.labels.run_result_summary) + '</span>';
      html += '<p>' + esc(data.run_result_summary) + '</p>';
    }
    if (data.actual_behavior_log) {
      html += '<span class="ct-label">' + esc(sec.labels.actual_behavior_log) + '</span>';
      html += '<p>' + esc(data.actual_behavior_log) + '</p>';
    }
    if (data.result_quote) {
      html += '<div class="ct-quote">' + esc(data.result_quote) + '</div>';
    }
  }
  
  if (sectionKey === 'nightTimeline') {
    sec.fields.forEach(function(f, i) {
      if (data[f]) {
        html += '<div class="ct-timeline-item">';
        html += '<span class="ct-time">' + esc(sec.times[i]) + '</span>';
        html += '<span class="ct-timeline-text">' + esc(data[f]) + '</span>';
        html += '</div>';
      }
    });
  }
  
  if (sectionKey === 'nightReport') {
    sec.fields.forEach(function(f, i) {
      if (data[f]) {
        html += '<div class="ct-timeline-item">';
        html += '<span class="ct-time">' + esc(sec.times[i]) + '</span>';
        html += '<span class="ct-timeline-text">' + esc(data[f]) + '</span>';
        html += '</div>';
      }
    });
    if (data[sec.summary]) {
      html += '<p style="margin-top:8px">' + esc(data[sec.summary]) + '</p>';
    }
    if (data[sec.quote]) {
      html += '<div class="ct-quote">' + esc(data[sec.quote]) + '</div>';
    }
  }
  
  if (sectionKey === 'draft') {
    if (data.unsent_draft) {
      html += '<div class="ct-draft-block">';
      html += '<p>' + esc(data.unsent_draft) + '</p>';
      if (data.draft_last_line) {
        html += '<p>' + esc(data.draft_last_line) + '<span class="ct-draft-cursor"></span></p>';
      }
      html += '</div>';
    }
    if (data.draft_recovery_note) {
      html += '<p style="margin-top:8px;color:var(--ct-sub);font-size:11px">' + esc(data.draft_recovery_note) + '</p>';
    }
  }
  
  if (sectionKey === 'accounts') {
    if (data.account_1_messages) {
      html += '<span class="ct-label">ACCOUNT 1 MESSAGES</span>';
      data.account_1_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<div class="ct-msg-item">' + esc(m.trim()) + '</div>';
      });
    }
    if (data.account_2_messages) {
      html += '<span class="ct-label">ACCOUNT 2 MESSAGES</span>';
      data.account_2_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<div class="ct-msg-item">' + esc(m.trim()) + '</div>';
      });
    }
    if (data.account_3_messages) {
      html += '<span class="ct-label">ACCOUNT 3 MESSAGES</span>';
      data.account_3_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<div class="ct-msg-item">' + esc(m.trim()) + '</div>';
      });
    }
    if (data.photo_description) {
      html += '<span class="ct-label">PHOTO DESCRIPTION</span>';
      html += '<p>' + esc(data.photo_description) + '</p>';
    }
  }
  
  if (sectionKey === 'hidden') {
    if (data.hidden_fragment_1) {
      html += '<div class="ct-hidden-block"><p>' + esc(data.hidden_fragment_1) + '</p></div>';
    }
    if (data.hidden_fragment_2) {
      html += '<div class="ct-hidden-block"><p>' + esc(data.hidden_fragment_2) + '</p></div>';
    }
  }
  
  html += '</div></div>';
  return html;
}

// 渲染完整Chill心声
function renderChillThought(msg, charName, char) {
  if (!hasChillData(msg)) return '';
  var data = msg.chill;
  var html = '<div class="chill-thought">';
  ['quick','nightTimeline','nightReport','draft','accounts','hidden'].forEach(function(key) {
    html += renderSection(key, data);
  });
  html += '</div>';
  return html;
}

// 空心声提示
function renderChillEmpty() {
  return '<div class="chill-thought-empty">还没有心声记录<br><span style="font-size:11px;color:var(--ct-tertiary)">下次回复时会自动生成</span></div>';
}

// HTML转义
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// 导出到全局
window.ChillThought = {
  hasData: hasChillData,
  render: renderChillThought,
  renderEmpty: renderChillEmpty,
  FIELDS: CHILL_FIELDS,
  SECTIONS: CHILL_SECTIONS
};

})();
