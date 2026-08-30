/* chill-thought.js — Chill心声渲染模块 */
window.ChillThought = (function() {
  'use strict';

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function buildSection(title, badge, bodyHtml) {
    return '<div class="chill-thought-section">' +
      '<div class="chill-thought-header">' +
        '<h3>' + esc(title) + '</h3>' +
        (badge ? '<span class="ct-badge">' + esc(badge) + '</span>' : '') +
      '</div>' +
      '<div class="chill-thought-body">' + bodyHtml + '</div>' +
    '</div>';
  }

  function p(text) {
    return text ? '<p>' + esc(text) + '</p>' : '';
  }

  function label(text) {
    return text ? '<span class="ct-label">' + esc(text) + '</span>' : '';
  }

  function quote(text) {
    return text ? '<div class="ct-quote">' + esc(text) + '</div>' : '';
  }

  function timelineItem(time, text) {
    if (!text) return '';
    return '<div class="ct-timeline-item">' +
      '<span class="ct-time">' + esc(time) + '</span>' +
      '<span class="ct-timeline-text">' + esc(text) + '</span>' +
    '</div>';
  }

  function msgItem(text) {
    if (!text) return '';
    return '<div class="ct-msg-item">' + esc(text) + '</div>';
  }

  function hiddenBlock(text) {
    if (!text) return '';
    return '<div class="ct-hidden-block"><p>' + esc(text) + '</p></div>';
  }

  function draftBlock(text, cursor) {
    if (!text) return '';
    return '<div class="ct-draft-block">' +
      '<p>' + esc(text) + (cursor ? '<span class="ct-draft-cursor"></span>' : '') + '</p>' +
    '</div>';
  }

  function splitMsgs(text) {
    if (!text) return [];
    return text.split('/n').map(function(s) { return s.trim(); }).filter(Boolean);
  }

  /* 主渲染函数：接收Chill字段数据，返回HTML */
  function render(data, charName, char) {
    if (!data || typeof data !== 'object') return '';
    var hasAny = false;
    var html = '<div class="chill-thought">';

    // 快捷指令01 — 行为记录
    if (data.run_result_summary || data.actual_behavior_log || data.result_quote) {
      hasAny = true;
      var body = '';
      if (data.run_result_summary) { body += label('行为记录'); body += p(data.run_result_summary); }
      if (data.actual_behavior_log) { body += label('画面记录'); body += p(data.actual_behavior_log); }
      if (data.result_quote) { body += quote(data.result_quote); }
      html += buildSection('快捷指令 01', 'ACTIVE', body);
    }

    // 夜间白色时间轴
    var nightLogs = [data.night_log_entries1, data.night_log_entries2, data.night_log_entries3, data.night_log_entries4];
    var hasNightLog = nightLogs.some(function(v) { return !!v; });
    if (hasNightLog) {
      hasAny = true;
      var times = ['02:17', '02:32', '03:06', '03:08'];
      var body = '';
      nightLogs.forEach(function(text, i) {
        if (text) body += timelineItem(times[i], text);
      });
      html += buildSection('夜间白色时间轴', 'NIGHT LOG', body);
    }

    // 黑色 NIGHT REPORT
    var nightReports = [data.night_report_entries1, data.night_report_entries2, data.night_report_entries3, data.night_report_entries4];
    var hasNightReport = nightReports.some(function(v) { return !!v; }) || data.night_report_summary || data.night_report_quote;
    if (hasNightReport) {
      hasAny = true;
      var times2 = ['02:17', '02:32', '03:06', '03:08'];
      var body = '';
      nightReports.forEach(function(text, i) {
        if (text) body += timelineItem(times2[i], text);
      });
      if (data.night_report_summary) { body += label('深夜碎碎念'); body += p(data.night_report_summary); }
      if (data.night_report_quote) { body += quote(data.night_report_quote); }
      html += buildSection('NIGHT REPORT', 'HIDDEN', body);
    }

    // 草稿恢复
    if (data.unsent_draft || data.draft_last_line || data.draft_recovery_note) {
      hasAny = true;
      var body = '';
      if (data.unsent_draft) { body += label('未发送的草稿'); body += draftBlock(data.unsent_draft, data.draft_last_line); }
      if (data.draft_last_line) { body += label('光标停留'); body += p(data.draft_last_line + '│'); }
      if (data.draft_recovery_note) { body += label('恢复分析'); body += p(data.draft_recovery_note); }
      html += buildSection('草稿恢复 03', 'RECOVERED', body);
    }

    // 小号消息
    var hasAccounts = data.account_1_messages || data.account_2_messages || data.account_3_messages || data.photo_description;
    if (hasAccounts) {
      hasAny = true;
      var body = '';
      if (data.account_1_messages) {
        body += label('原账号 · 最后的消息');
        splitMsgs(data.account_1_messages).forEach(function(m) { body += msgItem(m); });
      }
      if (data.account_2_messages) {
        body += label('小号 · 伪装试探');
        splitMsgs(data.account_2_messages).forEach(function(m) { body += msgItem(m); });
      }
      if (data.photo_description) {
        body += label('照片描述');
        body += p(data.photo_description);
      }
      if (data.account_3_messages) {
        body += label('另一个小号');
        splitMsgs(data.account_3_messages).forEach(function(m) { body += msgItem(m); });
      }
      html += buildSection('小号消息', 'TRACE', body);
    }

    // 隐藏档案
    if (data.hidden_fragment_1 || data.hidden_fragment_2) {
      hasAny = true;
      var body = '';
      if (data.hidden_fragment_1) { body += label('片段 01'); body += hiddenBlock(data.hidden_fragment_1); }
      if (data.hidden_fragment_2) { body += label('片段 02'); body += hiddenBlock(data.hidden_fragment_2); }
      html += buildSection('隐藏档案', 'SEALED', body);
    }

    // 如果没有任何Chill字段，返回空
    if (!hasAny) return '';

    html += '</div>';
    return html;
  }

  return { render: render };
})();
