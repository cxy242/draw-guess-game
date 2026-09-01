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

// 渲染单个section - 使用原版Chill模板的HTML结构
function renderSection(sectionKey, data) {
  var sec = CHILL_SECTIONS[sectionKey];
  if (!sec) return '';
  var hasAny = sec.fields.some(function(f){ return data[f]; });
  if (!hasAny) return '';
  
  var html = '';
  
  if (sectionKey === 'quick') {
    // 原版Hero指标区 - 使用.chill-thought .hero-metric样式
    html += '<div class="hero-metric">';
    html += '<div class="orbit"><i></i><i></i><span><small>ACTIVE</small><strong>01</strong><em>shortcut</em></span></div>';
    html += '<div class="hero-copy">';
    html += '<span>QUICK COMMAND</span>';
    html += '<strong>快捷指令</strong>';
    if (data.result_quote) {
      html += '<p>' + esc(data.result_quote) + '</p>';
    }
    html += '</div>';
    html += '<button class="section-intro-btn"><span>RUN</span></button>';
    html += '</div>';
    
    // 行为记录卡片
    if (data.run_result_summary || data.actual_behavior_log) {
      html += '<div class="section-intro"><div><span>BEHAVIOR LOG</span><h2>行为记录</h2></div><span class="count">01</span></div>';
      html += '<div class="rule-stack">';
      if (data.run_result_summary) {
        html += '<div class="rule-card tone-appear"><span class="rule-number">01</span><div class="rule-main"><small>RECORD</small><strong>' + esc(data.run_result_summary) + '</strong></div></div>';
      }
      if (data.actual_behavior_log) {
        html += '<div class="rule-card tone-midnight"><span class="rule-number">02</span><div class="rule-main"><small>BEHAVIOR</small><strong>' + esc(data.actual_behavior_log) + '</strong></div></div>';
      }
      html += '</div>';
    }
  }
  
  if (sectionKey === 'nightTimeline') {
    html += '<div class="section-intro"><div><span>NIGHT TIMELINE</span><h2>夜间时间轴</h2></div><span class="count">02:00—04:00</span></div>';
    html += '<div class="rule-stack">';
    sec.fields.forEach(function(f, i) {
      if (data[f]) {
        var tone = i === 0 ? 'tone-appear' : (i === 1 ? 'tone-midnight' : 'tone-three-days');
        html += '<div class="rule-card ' + tone + '"><span class="rule-number">' + esc(sec.times[i]) + '</span><div class="rule-main"><strong>' + esc(data[f]) + '</strong></div></div>';
      }
    });
    html += '</div>';
  }
  
  if (sectionKey === 'nightReport') {
    html += '<div class="section-intro"><div><span>NIGHT REPORT</span><h2>深层夜间报告</h2></div><span class="count">HIDDEN</span></div>';
    html += '<div class="rule-stack">';
    sec.fields.forEach(function(f, i) {
      if (data[f]) {
        var tone = i === 0 ? 'tone-appear' : (i === 1 ? 'tone-midnight' : 'tone-three-days');
        html += '<div class="rule-card ' + tone + '"><span class="rule-number">' + esc(sec.times[i]) + '</span><div class="rule-main"><strong>' + esc(data[f]) + '</strong></div></div>';
      }
    });
    html += '</div>';
    if (data[sec.summary]) {
      html += '<div class="if-block"><p>' + esc(data[sec.summary]) + '</p></div>';
    }
    if (data[sec.quote]) {
      html += '<div class="tiny-confession">' + esc(data[sec.quote]) + '</div>';
    }
  }
  
  if (sectionKey === 'draft') {
    html += '<div class="section-intro"><div><span>UNSENT DRAFT</span><h2>未发送草稿</h2></div><span class="count">LOCAL ONLY</span></div>';
    if (data.unsent_draft) {
      html += '<div class="if-block"><p>' + esc(data.unsent_draft) + '</p>';
      if (data.draft_last_line) {
        html += '<p>' + esc(data.draft_last_line) + '<span class="text-cursor"></span></p>';
      }
      html += '</div>';
    }
    if (data.draft_recovery_note) {
      html += '<p class="receipt-note">' + esc(data.draft_recovery_note) + '</p>';
    }
  }
  
  if (sectionKey === 'accounts') {
    html += '<div class="section-intro"><div><span>TRACES</span><h2>消息痕迹</h2></div><span class="count">03</span></div>';
    html += '<div class="logic-flow">';
    if (data.account_1_messages) {
      html += '<div class="logic-block"><span>ACCOUNT 1</span>';
      data.account_1_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<p>' + esc(m.trim()) + '</p>';
      });
      html += '</div>';
    }
    if (data.account_2_messages) {
      html += '<div class="logic-block"><span>ACCOUNT 2</span>';
      data.account_2_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<p>' + esc(m.trim()) + '</p>';
      });
      html += '</div>';
    }
    if (data.account_3_messages) {
      html += '<div class="logic-block"><span>ACCOUNT 3</span>';
      data.account_3_messages.split('/n').forEach(function(m) {
        if (m.trim()) html += '<p>' + esc(m.trim()) + '</p>';
      });
      html += '</div>';
    }
    if (data.photo_description) {
      html += '<div class="logic-block"><span>PHOTO</span><p>' + esc(data.photo_description) + '</p></div>';
    }
    html += '</div>';
  }
  
  if (sectionKey === 'hidden') {
    html += '<div class="section-intro"><div><span>HIDDEN FRAGMENTS</span><h2>隐藏档案</h2></div><span class="count">SEALED</span></div>';
    if (data.hidden_fragment_1) {
      html += '<div class="if-block"><p>' + esc(data.hidden_fragment_1) + '</p></div>';
    }
    if (data.hidden_fragment_2) {
      html += '<div class="if-block"><p>' + esc(data.hidden_fragment_2) + '</p></div>';
    }
  }
  
  return html;
}

// 渲染完整Chill心声
function renderChillThought(msg, charName, char) {
  if (!hasChillData(msg)) return '';
  var data = msg.chill;
  var avatarHtml = '';
  if (char && char.avatar) {
    avatarHtml = '<img src="' + esc(char.avatar) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%">';
  }
  var html = '<div class="chill-thought">';
  // 直接渲染内容区（不用手机外壳，在心声面板中显示）
  html += '<div class="screen home-view" style="position:relative;padding:12px 14px 16px;overflow:visible">';
  // 品牌头
  html += '<header class="brand-head">';
  html += '<div><span class="kicker">PRIVATE BEHAVIOR LOG</span>';
  html += '<h1>after<span>.</span></h1></div>';
  html += '<div class="avatar">' + avatarHtml + '</div>';
  html += '</header>';
  // hero-metric指标区
  if (data.result_quote || data.run_result_summary) {
    html += '<section class="hero-metric">';
    html += '<div class="orbit"><i></i><i></i><span><small>active</small><strong>01</strong><em>shortcut</em></span></div>';
    html += '<div class="hero-copy"><span>QUICK COMMAND</span>';
    html += '<strong>快捷指令</strong>';
    if (data.result_quote) html += '<p>' + esc(data.result_quote) + '</p>';
    html += '</div>';
    html += '<button><span>RUN</span></button>';
    html += '</section>';
  }
  // quick命令区 - rule-stack
  if (data.run_result_summary || data.actual_behavior_log) {
    html += '<div class="section-intro"><div><span>BEHAVIOR LOG</span><h2>行为记录</h2></div><span class="count">01</span></div>';
    html += '<div class="rule-stack">';
    if (data.run_result_summary) {
      html += '<div class="rule-card tone-appear"><span class="rule-number">01</span><div class="rule-main"><small>RECORD</small><strong>' + esc(data.run_result_summary) + '</strong><em>想起她的原因</em></div></div>';
    }
    if (data.actual_behavior_log) {
      html += '<div class="rule-card tone-midnight"><span class="rule-number">02</span><div class="rule-main"><small>BEHAVIOR</small><strong>' + esc(data.actual_behavior_log) + '</strong><em>脑内画面</em></div></div>';
    }
    html += '</div>';
  }
  // nightTimeline
  var nightFields = ['night_log_entries1','night_log_entries2','night_log_entries3','night_log_entries4'];
  var nightTimes = ['02:17','02:32','03:06','03:08'];
  var hasNight = nightFields.some(function(f){ return data[f]; });
  if (hasNight) {
    html += '<div class="section-intro"><div><span>NIGHT TIMELINE</span><h2>夜间时间轴</h2></div><span class="count">02:00\u201404:00</span></div>';
    html += '<div class="rule-stack">';
    nightFields.forEach(function(f, i) {
      if (data[f]) {
        var tone = i===0?'tone-appear':(i===1?'tone-midnight':'tone-three-days');
        html += '<div class="rule-card ' + tone + '"><span class="rule-number">' + nightTimes[i] + '</span><div class="rule-main"><strong>' + esc(data[f]) + '</strong></div></div>';
      }
    });
    html += '</div>';
  }
  // nightReport
  var reportFields = ['night_report_entries1','night_report_entries2','night_report_entries3','night_report_entries4'];
  var hasReport = reportFields.some(function(f){ return data[f]; });
  if (hasReport || data.night_report_summary || data.night_report_quote) {
    html += '<div class="section-intro"><div><span>NIGHT REPORT</span><h2>深层夜间报告</h2></div><span class="count">HIDDEN</span></div>';
    html += '<div class="rule-stack">';
    reportFields.forEach(function(f, i) {
      if (data[f]) {
        var tone = i===0?'tone-appear':(i===1?'tone-midnight':'tone-three-days');
        html += '<div class="rule-card ' + tone + '"><span class="rule-number">' + nightTimes[i] + '</span><div class="rule-main"><strong>' + esc(data[f]) + '</strong></div></div>';
      }
    });
    html += '</div>';
    if (data.night_report_summary) {
      html += '<div class="if-block"><p>' + esc(data.night_report_summary) + '</p></div>';
    }
    if (data.night_report_quote) {
      html += '<div class="tiny-confession">' + esc(data.night_report_quote) + '</div>';
    }
  }
  // draft
  if (data.unsent_draft || data.draft_last_line || data.draft_recovery_note) {
    html += '<div class="section-intro"><div><span>UNSENT DRAFT</span><h2>未发送草稿</h2></div><span class="count">LOCAL ONLY</span></div>';
    if (data.unsent_draft) {
      html += '<div class="if-block"><p>' + esc(data.unsent_draft) + '</p>';
      if (data.draft_last_line) html += '<p>' + esc(data.draft_last_line) + '</p>';
      html += '</div>';
    }
    if (data.draft_recovery_note) {
      html += '<p class="receipt-note">' + esc(data.draft_recovery_note) + '</p>';
    }
  }
  // accounts
  var accFields = ['account_1_messages','account_2_messages','account_3_messages'];
  var hasAcc = accFields.some(function(f){ return data[f]; });
  if (hasAcc || data.photo_description) {
    html += '<div class="section-intro"><div><span>TRACES</span><h2>消息痕迹</h2></div><span class="count">03</span></div>';
    html += '<div class="logic-flow">';
    accFields.forEach(function(f, i) {
      if (data[f]) {
        html += '<div class="logic-block"><span>ACCOUNT ' + (i+1) + '</span>';
        data[f].split('/n').forEach(function(m) {
          if (m.trim()) html += '<p>' + esc(m.trim()) + '</p>';
        });
        html += '</div>';
      }
    });
    if (data.photo_description) {
      html += '<div class="logic-block"><span>PHOTO</span><p>' + esc(data.photo_description) + '</p></div>';
    }
    html += '</div>';
  }
  // hidden
  if (data.hidden_fragment_1 || data.hidden_fragment_2) {
    html += '<div class="section-intro"><div><span>HIDDEN FRAGMENTS</span><h2>隐藏档案</h2></div><span class="count">SEALED</span></div>';
    if (data.hidden_fragment_1) html += '<div class="if-block"><p>' + esc(data.hidden_fragment_1) + '</p></div>';
    if (data.hidden_fragment_2) html += '<div class="if-block"><p>' + esc(data.hidden_fragment_2) + '</p></div>';
  }
  html += '</div>'; // screen
  html += '</div>'; // chill-thought
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
