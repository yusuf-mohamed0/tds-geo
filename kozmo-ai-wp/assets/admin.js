(function($) {
  'use strict';

  var k = {
    refreshTimer: null,
    ajaxUrl: window.kozmoAI?.ajax_url || '',
    nonce:   window.kozmoAI?.nonce   || '',
    loading: false,
  };

  // ─── Loading state ───
  function setLoading(on) {
    k.loading = on;
    $('#k-refresh').prop('disabled', on).toggleClass('k-loading', on);
    if (on) $('#k-refresh').text('⟳ Refreshing...');
    else $('#k-refresh').text('Refresh');
  }

  // ─── Show toast message ───
  function showToast(msg, type) {
    var $t = $('.k-toast');
    if (!$t.length) {
      $t = $('<div class="k-toast">').appendTo('.k-shell');
    }
    $t.text(msg).removeClass('k-toast-error k-toast-success').addClass('k-toast-' + (type || 'success'));
    $t.addClass('k-toast-visible');
    setTimeout(function() { $t.removeClass('k-toast-visible'); }, 4000);
  }

  // ─── Pipeline percentage ───
  function pipelinePct(stage) {
    var map = { queued:10, generating_article:30, scoring:60, publishing:85, completed:100, failed:100 };
    return map[stage] || 5;
  }

  // ─── Number animation ───
  function animateNumber($el, target) {
    var current = parseInt($el.attr('data-k-value'), 10) || 0;
    if (current === target) return;
    $el.prop('Counter', current).animate({ Counter: target }, {
      duration: 500, easing: 'swing',
      step: function(v) { $el.text(Math.round(v)); }
    });
    $el.attr('data-k-value', target);
  }

  function setStat(metric, value, sub) {
    var $v = $('[data-k-stat="' + metric + '"]');
    if ($v.length) animateNumber($v, parseInt(value, 10));
    if (sub) $('[data-k-sub="' + metric + '"]').text(sub);
  }

  function setState(state) {
    var dot = $('.k-nav-dot');
    var banner = $('.k-banner');
    if (dot.length) dot.removeClass('healthy warning critical').addClass(state);
    if (banner.length) {
      banner.removeClass('healthy warning critical').addClass(state);
      banner.find('.k-banner-text').text(
        state === 'healthy' ? 'All systems operational' :
        state === 'warning' ? 'Some systems need attention' : 'Critical issues require immediate action'
      );
      banner.find('.k-banner-icon').text(state === 'healthy' ? '✓' : state === 'warning' ? '⚠' : '✕');
    }
  }

  function setGenState(enabled) {
    var $badge = $('.k-gen-badge');
    if ($badge.length) $badge.removeClass('k-tag-yellow k-tag-red').addClass(enabled ? 'k-tag-active' : 'k-tag-yellow').text(enabled ? 'Active' : 'Paused');
  }

  // ─── Load dashboard data ───
  function loadDashboard() {
    if (!k.ajaxUrl || k.loading) return;
    setLoading(true);
    $.post(k.ajaxUrl, { action: 'kozmo_ai_dashboard_data', nonce: k.nonce }, function(r) {
      if (!r || !r.success || !r.data) {
        showToast('Failed to load dashboard data. Check console for details.', 'error');
        return;
      }
      var d = r.data;
      var health = d.health || {};
      var queue = d.queue || {};
      var errors = d.errors || {};
      var kb = d.kb || {};
      var content = d.content || {};
      var kw = d.keywords || {};

      setState(health.overall || 'healthy');
      setGenState(d.generation_enabled);

      setStat('health', health.score || 100, health.overall || '—');
      setStat('queue', queue.pending || 0, (queue.failed || 0) + ' failed');
      setStat('errors', errors.unresolved || 0, (errors.healed || 0) + ' healed');
      setStat('knowledge', kb.total || 0, (kb.unsynced || 0) + ' unsynced');
      setStat('content', content.thin_content || 0, (content.no_featured_images || 0) + ' no images');
      setStat('taxonomy', kw.total_cats || 0, (kw.total_tags || 0) + ' tags');
      setStat('today_articles', d.today_articles || 0, '');
      setStat('pipeline', d.pipeline_count || 0, (d.pipeline_failed || 0) + ' failed');

      var $next = $('[data-k-next]');
      if ($next.length) $next.text(d.next_run ? new Date(d.next_run * 1000).toLocaleString() : 'Awaiting schedule');

      // Pipeline stages
      if (d.pipeline_stages) {
        var failed = d.pipeline_stages.failed || 0;
        var stages = d.pipeline_stages.stages || {};
        var inProgress = 0;
        for (var s in stages) { if (s !== 'completed' && s !== 'failed') inProgress += parseInt(stages[s].count, 10); }
        var $pStat = $('[data-k-stat="pipeline"]');
        if ($pStat.length) animateNumber($pStat, inProgress);
        $('[data-k-sub="pipeline"]').text(failed + ' failed');
      }

      // Recent activity
      if (d.recent_logs && d.recent_logs.length) {
        var $tbody = $('.k-activity tbody');
        if ($tbody.length) {
          $tbody.empty();
          $.each(d.recent_logs.slice(0, 5), function(i, log) {
            var lvl = (log.level || 'info').toLowerCase();
            $tbody.append(
              '<tr><td><span class="k-tag k-tag-' + (lvl === 'error' ? 'red' : lvl === 'warning' ? 'yellow' : 'blue') + '">' +
              (log.level || 'INFO') + '</span></td>' +
              '<td>' + (log.service || '—') + '</td>' +
              '<td>' + (log.message || '') + '</td>' +
              '<td class="k-text-mono">' + (log.created_at ? new Date(log.created_at).toLocaleString() : '') + '</td></tr>'
            );
          });
        }
      }

      // Recent articles with pipeline bar
      if (d.recent_articles && d.recent_articles.length) {
        var $atbody = $('.k-articles tbody');
        if ($atbody.length) {
          $atbody.empty();
          $.each(d.recent_articles.slice(0, 5), function(i, a) {
            var stage = a.pipeline_stage || 'completed';
            var error = a.pipeline_error || '';
            var pct = pipelinePct(stage);
            var barBg = error ? 'var(--k-red)' : pct >= 100 ? 'var(--k-green)' : 'var(--k-accent)';
            var barTitle = error ? 'Error: ' + error : 'Stage: ' + stage;
            var barLabel = error ? 'Failed' : stage;
            $atbody.append(
              '<tr><td><a href="' + (a.edit_link || '#') + '" class="k-cell-link">' + (a.post_title || 'Untitled') + '</a></td>' +
              '<td><span class="k-tag ' + (a.post_status === 'publish' ? 'k-tag-active' : 'k-tag-yellow') + '">' +
              (a.post_status === 'publish' ? 'Published' : 'Draft') + '</span></td>' +
              '<td>' + (a.quality || '—') + '</td>' +
              '<td style="min-width:120px;"><div class="k-pipeline-bar" title="' + barTitle + '"><div class="k-pipeline-fill" style="width:' + pct + '%;background:' + barBg + ';"></div><span class="k-pipeline-label">' + barLabel + '</span></div></td>' +
              '<td class="k-text-mono">' + (a.post_date ? new Date(a.post_date).toLocaleDateString() : '') + '</td></tr>'
            );
          });
        }
      }
    }).fail(function(xhr) {
      showToast('Server error: ' + (xhr.statusText || 'unknown'), 'error');
    }).always(function() {
      setLoading(false);
    });
  }

  function scheduleRefresh() {
    if (k.refreshTimer) clearTimeout(k.refreshTimer);
    k.refreshTimer = setTimeout(function() { loadDashboard(); scheduleRefresh(); }, 60000);
  }

  // ─── Article actions: publish / draft / delete ───
  function articleAction(postId, action) {
    if (!k.ajaxUrl) return;
    var label = action === 'publish' ? 'Publish' : action === 'draft' ? 'Move to Draft' : 'Delete';
    if (action === 'delete' && !confirm('Delete this article permanently?')) return;
    var $btn = $('[data-k-action="' + postId + '"][data-k-act="' + action + '"]');
    if ($btn.length) $btn.prop('disabled', true).text('...');
    $.post(k.ajaxUrl, { action: 'kozmo_ai_article_action', post_id: postId, act: action, nonce: k.nonce }, function(r) {
      if (r.success) {
        showToast('Article ' + action + 'ed successfully');
        loadDashboard();
      } else {
        showToast(r.data?.message || 'Action failed', 'error');
        if ($btn.length) $btn.prop('disabled', false).text(label);
      }
    }).fail(function() {
      showToast('Server error', 'error');
      if ($btn.length) $btn.prop('disabled', false).text(label);
    });
  }
  window.articleAction = articleAction;

  // ─── Reveal API key ───
  window.revealApiKey = function(keyId) {
    var password = prompt('Enter your admin password to reveal this API key:');
    if (!password) return;
    var ajaxUrl = kozmoAI?.ajax_url || ajaxurl;
    $.post(ajaxUrl, {
      action: 'kozmo_ai_reveal_key', key_id: keyId, password: password, nonce: kozmoAI?.nonce || ''
    }, function(r) {
      if (r.success && r.data?.api_key) {
        var $td = $('[data-key-id="' + keyId + '"]');
        $td.html('<code style="font-size:12px;word-break:break-all;background:var(--k-bg);padding:2px 6px;border-radius:4px;">' + $('<span>').text(r.data.api_key).html() + '</code>');
        setTimeout(function() { $td.text(r.data.api_key.substring(0, 16) + '...'); }, 15000);
      } else {
        alert(r.data?.message || 'Failed to reveal key.');
      }
    });
  };

  // ─── Init ───
  $(function() {
    $('.k-fade').each(function(i) { $(this).css('animation-delay', (i * 0.06) + 's'); });

    // Copy to clipboard
    $(document).on('click', '[data-k-copy]', function() {
      var text = $(this).data('k-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          var $btn = $(this); $btn.text('Copied!');
          setTimeout(function() { $btn.text('Copy'); }, 2000);
        }.bind(this));
      }
    });

    // Refresh button
    $(document).on('click', '#k-refresh', function(e) { e.preventDefault(); loadDashboard(); });

    if ($('.k-dashboard').length) { loadDashboard(); scheduleRefresh(); }
  });
})(jQuery);
