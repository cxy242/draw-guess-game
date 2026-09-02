/* chill-thought.js — Chill 心声面板模块 */
/* 无手机外壳，直接渲染原版 Chill HTML 结构 */

(function () {
  'use strict';

  /* ── 字段定义 ────────────────────────────────────── */
  var CHILL_FIELDS = [
    'run_result_summary', 'actual_behavior_log', 'result_quote',
    'night_log_entries1', 'night_log_entries2', 'night_log_entries3', 'night_log_entries4',
    'night_report_entries1', 'night_report_entries2', 'night_report_entries3', 'night_report_entries4',
    'night_report_summary', 'night_report_quote',
    'unsent_draft', 'draft_last_line', 'draft_recovery_note',
    'account_1_messages', 'account_2_messages', 'account_3_messages', 'photo_description',
    'hidden_fragment_1', 'hidden_fragment_2'
  ];

  var SECTIONS = {
    quick: {
      label: 'QUICK COMMAND 01',
      title: '快捷指令',
      badge: 'ACTIVE',
      fields: ['run_result_summary', 'actual_behavior_log', 'result_quote'],
      labels: {
        run_result_summary: 'RECORD',
        actual_behavior_log: 'BEHAVIOR LOG',
        result_quote: 'QUOTE'
      }
    },
    nightTimeline: {
      label: 'NIGHT TIMELINE',
      title: '夜间时间轴',
      badge: '02:00\u201404:00',
      fields: ['night_log_entries1', 'night_log_entries2', 'night_log_entries3', 'night_log_entries4'],
      times: ['02:17', '02:32', '03:06', '03:08']
    },
    nightReport: {
      label: 'NIGHT REPORT',
      title: '深层夜间报告',
      badge: 'HIDDEN',
      fields: ['night_report_entries1', 'night_report_entries2', 'night_report_entries3', 'night_report_entries4'],
      times: ['02:17', '02:32', '03:06', '03:08'],
      summary: 'night_report_summary',
      quote: 'night_report_quote'
    },
    draft: {
      label: 'UNSENT DRAFT',
      title: '未发送草稿',
      badge: 'LOCAL ONLY',
      fields: ['unsent_draft', 'draft_last_line', 'draft_recovery_note']
    },
    accounts: {
      label: 'TRACES',
      title: '消息痕迹',
      badge: '03',
      fields: ['account_1_messages', 'account_2_messages', 'account_3_messages', 'photo_description']
    },
    hidden: {
      label: 'HIDDEN FRAGMENTS',
      title: '隐藏档案',
      badge: 'SEALED',
      fields: ['hidden_fragment_1', 'hidden_fragment_2']
    }
  };

  /* ── 工具函数 ────────────────────────────────────── */
  function esc(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function hasAny(data, fields) {
    for (var i = 0; i < fields.length; i++) {
      if (data[fields[i]]) return true;
    }
    return false;
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  /* ── hasData ─────────────────────────────────────── */
  function hasData(msg) {
    if (!msg || !msg.chill) return false;
    var d = msg.chill;
    return CHILL_FIELDS.some(function (f) { return !!d[f]; });
  }

  /* ── 各 section 渲染 ─────────────────────────────── */

  function renderBrandHead(charName) {
    var name = esc(charName || 'Chill');
    return '<div class="brand-head">' +
      '<div>' +
        '<span class="kicker">CHILL THOUGHT</span>' +
        '<h1>' + name + '<span>\'s</span></h1>' +
        '<h1>心声</h1>' +
      '</div>' +
    '</div>';
  }

  function renderHeroMetric(data) {
    var sec = SECTIONS.quick;
    var quote = data.result_quote || '';
    var summary = data.run_result_summary || '';
    var hasQuote = !!quote;

    var html = '<div class="hero-metric">';
    // orbit 环形指标
    html += '<div class="orbit">' +
      '<i></i><i></i>' +
      '<span><small>ACTIVE</small><strong>01</strong><em>shortcut</em></span>' +
    '</div>';
    // hero-copy 右侧文案
    html += '<div class="hero-copy">' +
      '<span>QUICK COMMAND</span>' +
      '<strong>快捷指令</strong>';
    if (hasQuote) {
      html += '<p>' + esc(quote) + '</p>';
    }
    html += '</div>';
    html += '</div>';
    return html;
  }

  function renderQuickCards(data) {
    var sec = SECTIONS.quick;
    if (!hasAny(data, sec.fields)) return '';
    var html = '';
    // section-intro
    html += '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';
    // rule-stack
    html += '<div class="rule-stack">';
    var tones = ['tone-appear', 'tone-midnight', 'tone-three-days'];
    var desc = ['想起她的原因', '脑内画面', ''];
    sec.fields.forEach(function (f, i) {
      if (data[f]) {
        html += '<div class="rule-card ' + tones[i] + '">' +
          '<span class="rule-number">0' + (i + 1) + '</span>' +
          '<div class="rule-main">' +
            '<small>' + sec.labels[f] + '</small>' +
            '<strong>' + esc(data[f]) + '</strong>' +
            (desc[i] ? '<em>' + desc[i] + '</em>' : '') +
          '</div>' +
        '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  function renderNightTimeline(data) {
    var sec = SECTIONS.nightTimeline;
    if (!hasAny(data, sec.fields)) return '';
    var html = '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';
    html += '<div class="rule-stack">';
    var tones = ['tone-appear', 'tone-midnight', 'tone-three-days', 'tone-three-days'];
    sec.fields.forEach(function (f, i) {
      if (data[f]) {
        html += '<div class="rule-card ' + tones[i] + '">' +
          '<span class="rule-number">' + sec.times[i] + '</span>' +
          '<div class="rule-main"><strong>' + esc(data[f]) + '</strong></div>' +
        '</div>';
      }
    });
    html += '</div>';
    return html;
  }

  function renderNightReport(data) {
    var sec = SECTIONS.nightReport;
    var hasEntries = hasAny(data, sec.fields);
    var hasSummary = !!data[sec.summary];
    var hasQuote = !!data[sec.quote];
    if (!hasEntries && !hasSummary && !hasQuote) return '';

    var html = '<div class="night-report-wrap">';
    html += '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';

    // 夜间报告暗色面板
    html += '<div class="night-report">';
    if (hasEntries) {
      html += '<div class="report-rows">';
      sec.fields.forEach(function (f, i) {
        if (data[f]) {
          html += '<p><time>' + sec.times[i] + '</time><span>' + esc(data[f]) + '</span></p>';
        }
      });
      html += '</div>';
    }
    if (hasSummary) {
      html += '<div class="report-summary"><b>&#x2022;</b><p>' + nl2br(data[sec.summary]) + '</p></div>';
    }
    if (hasQuote) {
      html += '<blockquote>' + esc(data[sec.quote]) + '</blockquote>';
    }
    html += '</div>'; // night-report
    html += '</div>'; // night-report-wrap
    return html;
  }

  function renderDraft(data) {
    var sec = SECTIONS.draft;
    if (!hasAny(data, sec.fields)) return '';
    var html = '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';
    // ghost-editor 草稿区
    html += '<div class="ghost-editor">';
    if (data.unsent_draft) {
      html += '<p class="has-text">' + nl2br(data.unsent_draft) + '</p>';
    }
    html += '</div>';
    // draft-last-line
    if (data.draft_last_line) {
      html += '<div class="draft-sheet"><p>' + esc(data.draft_last_line) + '</p></div>';
    }
    // recovery note
    if (data.draft_recovery_note) {
      html += '<p class="receipt-note">' + esc(data.draft_recovery_note) + '</p>';
    }
    return html;
  }

  function renderAccounts(data) {
    var sec = SECTIONS.accounts;
    var accFields = ['account_1_messages', 'account_2_messages', 'account_3_messages'];
    var hasAcc = hasAny(data, accFields);
    var hasPhoto = !!data.photo_description;
    if (!hasAcc && !hasPhoto) return '';

    var html = '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';
    html += '<div class="logic-flow">';
    accFields.forEach(function (f, i) {
      if (data[f]) {
        html += '<div class="logic-block">' +
          '<span>ACCOUNT ' + (i + 1) + '</span>';
        var msgs = data[f].split('\n');
        msgs.forEach(function (m) {
          m = m.trim();
          if (m) html += '<p>' + esc(m) + '</p>';
        });
        html += '</div>';
      }
    });
    if (hasPhoto) {
      html += '<div class="logic-block"><span>PHOTO</span><p>' + esc(data.photo_description) + '</p></div>';
    }
    html += '</div>';
    return html;
  }

  function renderHidden(data) {
    var sec = SECTIONS.hidden;
    if (!hasAny(data, sec.fields)) return '';
    var html = '<div class="section-intro">' +
      '<div><span>' + sec.label + '</span><h2>' + sec.title + '</h2></div>' +
      '<span class="count">' + sec.badge + '</span>' +
    '</div>';
    if (data.hidden_fragment_1) {
      html += '<div class="if-block"><p>' + esc(data.hidden_fragment_1) + '</p></div>';
    }
    if (data.hidden_fragment_2) {
      html += '<div class="if-block"><p>' + esc(data.hidden_fragment_2) + '</p></div>';
    }
    return html;
  }

  /* ── 主渲染 ──────────────────────────────────────── */
  function render(msg, charName, char) {
    if (!msg || !msg.chill) return '';
    var data = msg.chill;
    if (!hasData(msg)) return '';

    var html = '<div class="chill-thought">';
    // brand-head 头部
    html += renderBrandHead(charName);
    // hero-metric 指标卡（快捷指令摘要）
    html += renderHeroMetric(data);
    // 快捷指令详细卡片
    html += renderQuickCards(data);
    // 夜间时间轴
    html += renderNightTimeline(data);
    // 夜间深层报告（暗色）
    html += renderNightReport(data);
    // 未发送草稿
    html += renderDraft(data);
    // 消息痕迹
    html += renderAccounts(data);
    // 隐藏档案
    html += renderHidden(data);
    html += '</div>';
    return html;
  }

  /* ── 空状态 ──────────────────────────────────────── */
  function renderEmpty() {
    return '<div class="chill-thought chill-thought-empty">' +
      '<div class="brand-head"><div>' +
        '<span class="kicker">CHILL THOUGHT</span>' +
        '<h1>暂无心声</h1>' +
      '</div></div>' +
      '<p style="text-align:center;color:var(--ui-text-tertiary);font-size:.72rem;margin:2rem 0">' +
        '还没有心声记录<br>下次回复时会自动生成' +
      '</p>' +
    '</div>';
  }

  /* ── 导出 ────────────────────────────────────────── */
  window.ChillThought = {
    hasData: hasData,
    render: render,
    renderEmpty: renderEmpty,
    FIELDS: CHILL_FIELDS,
    SECTIONS: SECTIONS
  };

})();
