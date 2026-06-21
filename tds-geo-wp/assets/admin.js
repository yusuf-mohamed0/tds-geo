(function($) {
  'use strict';

  var tds = {
    refreshTimer: null,
    countdownTimer: null,
    ajaxUrl: window.tdsGeo?.ajax_url || '',
    nonce:   window.tdsGeo?.nonce   || '',
    loading: false,
    nextRun: null,
  };

  function setLoading(on) {
    tds.loading = on;
    $('#tds-refresh').prop('disabled', on).toggleClass('tds-loading', on);
    $('#tds-refresh').text(on ? '⟳ Refreshing...' : 'Refresh');
  }

  function showToast(msg, type) {
    var $t = $('.tds-toast');
    if (!$t.length) { $t = $('<div class="tds-toast">').appendTo('.tds-shell'); }
    $t.text(msg).removeClass('tds-toast-error tds-toast-success').addClass( 'tds-toast-' + (type || 'success'));
    $t.addClass('tds-toast-visible');
    setTimeout(function() { $t.removeClass('tds-toast-visible'); }, 4000);
  }

  function pipelinePct(stage) {
    var map = { queued:10, generating_article:30, scoring:60, publishing:85, completed:100, failed:100 };
    return map[stage] || 5;
  }

  function animateNumber($el, target) {
    var current = parseInt($el.attr('data-tds-value'), 10) || 0;
    if (current === target) return;
    $el.prop('Counter', current).animate({ Counter: target }, {
      duration: 500, easing: 'swing',
      step: function(v) { $el.text(Math.round(v)); }
    });
    $el.attr('data-tds-value', target);
  }

  function setStat(metric, value, sub) {
    var $v = $('[data-tds-stat="' + metric + '"]');
    if ($v.length) animateNumber($v, parseInt(value, 10));
    if (sub) $('[data-tds-sub="' + metric + '"]').text(sub);
  }

  function setState(state) {
    var dot = $('.tds-nav-dot');
    var banner = $('.tds-banner');
    if (dot.length) dot.removeClass('healthy warning critical').addClass(state);
    if (banner.length) {
      banner.removeClass('healthy warning critical').addClass(state);
      banner.find('.tds-banner-text').text(
        state === 'healthy' ? 'All systems operational' :
        state === 'warning' ? 'Some systems need attention' : 'Critical issues require immediate action'
      );
      banner.find('.tds-banner-icon').text(state === 'healthy' ? '✓' : state === 'warning' ? '⚠' : '✕');
    }
  }

  function setGenState(enabled) {
    var $badge = $('.tds-gen-badge');
    if ($badge.length) $badge.removeClass('tds-tag-yellow tds-tag-red').addClass(enabled ? 'tds-tag-active' : 'tds-tag-yellow').text(enabled ? 'Active' : 'Paused');
  }

  // ─── Countdown timer ───
  function updateCountdown() {
    if (!tds.nextRun) { $('[data-tds-countdown]').text('—'); return; }
    var now = Math.floor(Date.now() / 1000);
    var diff = tds.nextRun - now;
    if (diff <= 0) { $('[data-tds-countdown]').text('Now'); return; }
    var m = Math.floor(diff / 60);
    var s = diff % 60;
    $('[data-tds-countdown]').text(m + 'm ' + s + 's');
  }

  function startCountdown(nextRunTs) {
    tds.nextRun = nextRunTs;
    if (tds.countdownTimer) clearInterval(tds.countdownTimer);
    updateCountdown();
    tds.countdownTimer = setInterval(updateCountdown, 1000);
  }

  // ─── Update daily ring ───
  function updateDailyRing(current, max) {
    var pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    var circ = 2 * Math.PI * 15;
    var offset = circ - (pct / 100) * circ;
    $('.tds-ring-fg').css('stroke-dasharray', circ).css('stroke-dashoffset', offset);
    $('.tds-ring-text').text(current);
  }

  // ─── Generate Now ───
  function generateNow() {
    if (!tds.ajaxUrl || tds.loading) return;
    var $btn = $('#tds-generate-now');
    $btn.prop('disabled', true).addClass('tds-generating').text('⟳ Generating...');
    $.post(tds.ajaxUrl, { action: 'tds_geo_generate_now', nonce: tds.nonce }, function(r) {
      if (r.success) {
        showToast(r.data?.message || 'Generation started! Articles will appear shortly.', 'success');
        setTimeout(loadDashboard, 2000);
      } else {
        showToast(r.data?.message || 'Generation failed to start', 'error');
      }
    }).fail(function() {
      showToast('Server error', 'error');
    }).always(function() {
      $btn.prop('disabled', false).removeClass('tds-generating').text('⟳ Generate Now');
    });
  }

  // ─── Test API Key ───
  function testApiKey() {
    var $btn = $('#tds-test-api');
    var $result = $('.tds-test-result');
    $btn.prop('disabled', true).text('Testing...');
    $result.remove();
    $.post(tds.ajaxUrl, { action: 'tds_geo_test_api', nonce: tds.nonce }, function(r) {
      var html = r.success
        ? '<div class="tds-test-result tds-test-success">✓ ' + (r.data?.model || 'Key works') + '</div>'
        : '<div class="tds-test-result tds-test-fail">✕ ' + (r.data?.message || 'Invalid key') + '</div>';
      $btn.after(html);
    }).fail(function() {
      $btn.after('<div class="tds-test-result tds-test-fail">✕ Connection failed</div>');
    }).always(function() {
      $btn.prop('disabled', false).text('Test Connection');
    });
  }

  // ─── Dismiss milestone ───
  function dismissMilestone() {
    $('.tds-milestone').slideUp(300, function() { $(this).remove(); });
    if (tds.ajaxUrl) {
      $.post(tds.ajaxUrl, { action: 'tds_geo_dismiss_milestone', nonce: tds.nonce });
    }
  }

  // ─── Load dashboard data ───
  function loadDashboard() {
    if (!tds.ajaxUrl || tds.loading) return;
    setLoading(true);
    $.post(tds.ajaxUrl, { action: 'tds_geo_dashboard_data', nonce: tds.nonce }, function(r) {
      if (!r || !r.success || !r.data) {
        showToast('Failed to load dashboard data.', 'error');
        return;
      }
      var d = r.data;
      setState(d.health?.overall || 'healthy');
      setGenState(d.generation_enabled);
      setStat('health', d.health?.score || 100, d.health?.overall || '—');
      setStat('queue', d.queue?.pending || 0, (d.queue?.failed || 0) + ' failed');
      setStat('errors', d.errors?.unresolved || 0, (d.errors?.healed || 0) + ' healed');
      setStat('knowledge', d.kb?.total || 0, (d.kb?.unsynced || 0) + ' unsynced');
      setStat('content', d.content?.thin_content || 0, (d.content?.no_featured_images || 0) + ' no images');
      setStat('taxonomy', d.keywords?.total_cats || 0, (d.keywords?.total_tags || 0) + ' tags');
      setStat('today_articles', d.today_articles || 0, '');
      setStat('pipeline', d.pipeline_count || 0, (d.pipeline_failed || 0) + ' failed');

      // Daily ring
      updateDailyRing(d.today_articles || 0, d.daily_max || 24);

      // Next run + countdown
      if (d.next_run) {
        startCountdown(d.next_run);
      }
      var $next = $('[data-tds-next]');
      if ($next.length) $next.text(d.next_run ? new Date(d.next_run * 1000).toLocaleString() : 'Awaiting schedule');

      // Queue items (live)
      var $queueArea = $('.tds-queue-list');
      if ($queueArea.length) {
        $queueArea.empty();
        if (d.queue?.pending_tasks?.length) {
          $.each(d.queue.pending_tasks.slice(0, 5), function(i, t) {
            $queueArea.append(
              '<div class="tds-queue-item"><span class="tds-pulse"></span><span class="tds-queue-label">' +
              $('<span>').text(t.task_type || t).html() + '</span><span class="tds-queue-eta">queued</span></div>'
            );
          });
        } else {
          $queueArea.html('<div style="font-size:11px;color:var(--tds-text-tertiary);padding:4px 0;">No pending tasks</div>');
        }
      }

      // Pipeline stages
      if (d.pipeline_stages) {
        var failed = d.pipeline_stages.failed || 0;
        var stages = d.pipeline_stages.stages || {};
        var inProgress = 0;
        for (var s in stages) { if (s !== 'completed' && s !== 'failed') inProgress += parseInt(stages[s].count, 10); }
        setStat('pipeline', inProgress, failed + ' failed');
      }

      // Recent activity
      if (d.recent_logs && d.recent_logs.length) {
        var $tbody = $('.tds-activity tbody');
        if ($tbody.length) {
          $tbody.empty();
          $.each(d.recent_logs.slice(0, 5), function(i, log) {
            var lvl = (log.level || 'info').toLowerCase();
            $tbody.append(
              '<tr><td><span class="tds-tag tds-tag-' + (lvl === 'error' ? 'red' : lvl === 'warning' ? 'yellow' : 'blue') + '">' +
              (log.level || 'INFO') + '</span></td>' +
              '<td>' + (log.service || '—') + '</td>' +
              '<td title="' + $('<span>').text(log.message || '').html() + '">' + $('<span>').text((log.message || '').substring(0, 80) + ((log.message || '').length > 80 ? '…' : '')).html() + '</td>' +
              '<td class="tds-text-mono">' + (log.created_at ? new Date(log.created_at).toLocaleString() : '') + '</td></tr>'
            );
          });
        }
      }

      // Recent articles with pipeline bar
      if (d.recent_articles && d.recent_articles.length) {
        var $atbody = $('.tds-articles tbody');
        if ($atbody.length) {
          $atbody.empty();
          $.each(d.recent_articles.slice(0, 5), function(i, a) {
            var stage = a.pipeline_stage || 'completed';
            var error = a.pipeline_error || '';
            var pct = pipelinePct(stage);
            var barBg = error ? 'var(--tds-red)' : pct >= 100 ? 'var(--tds-green)' : 'var(--tds-accent)';
            $atbody.append(
              '<tr><td><a href="' + (a.edit_link || '#') + '" class="tds-cell-link">' +
              $('<span>').text(a.post_title || 'Untitled').html() + '</a></td>' +
              '<td><span class="tds-tag ' + (a.post_status === 'publish' ? 'tds-tag-active' : 'tds-tag-yellow') + '">' +
              (a.post_status === 'publish' ? 'Published' : 'Draft') + '</span></td>' +
              '<td>' + (a.quality || '—') + '</td>' +
              '<td style="min-width:120px;"><div class="tds-pipeline-bar" title="' +
              (error ? 'Error: ' + $('<span>').text(error).html() : 'Stage: ' + stage) +
              '"><div class="tds-pipeline-fill" style="width:' + pct + '%;background:' + barBg + ';"></div><span class="tds-pipeline-label">' +
              (error ? 'Failed' : stage) + '</span></div></td>' +
              '<td class="tds-text-mono">' + (a.post_date ? new Date(a.post_date).toLocaleDateString() : '') + '</td>' +
              '<td style="text-align:right;"><div class="tds-action-group">' +
              (a.post_status !== 'publish'
                ? '<button class="tds-btn tds-btn-sm tds-tag-green" onclick="articleAction(' + a.ID + ',\'publish\')">Pub</button>'
                : '') +
              '<button class="tds-btn tds-btn-sm tds-btn-danger" onclick="articleAction(' + a.ID + ',\'delete\')">×</button></div></td></tr>'
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
    if (tds.refreshTimer) clearTimeout(tds.refreshTimer);
    tds.refreshTimer = setTimeout(function() { loadDashboard(); scheduleRefresh(); }, 60000);
  }

  // ─── Article actions ───
  function articleAction(postId, action) {
    if (!tds.ajaxUrl) return;
    var $btns = $('[data-tds-action="' + postId + '"]');
    var label = action === 'publish' ? 'Publish' : action === 'draft' ? 'Draft' : 'Delete';
    if (action === 'delete' && !confirm('Delete this article permanently?')) return;
    $btns.prop('disabled', true);
    $.post(tds.ajaxUrl, { action: 'tds_geo_article_action', post_id: postId, act: action, nonce: tds.nonce }, function(r) {
      if (r.success) { showToast('Article ' + action + 'ed successfully'); loadDashboard(); }
      else { showToast(r.data?.message || 'Action failed', 'error'); $btns.prop('disabled', false); }
    }).fail(function() { showToast('Server error', 'error'); $btns.prop('disabled', false); });
  }
  window.articleAction = articleAction;

  // ─── Reveal API key ───
  window.revealApiKey = function(keyId) {
    var password = prompt('Enter your admin password to reveal this API key:');
    if (!password) return;
    $.post(tdsGeo?.ajax_url || ajaxurl, {
      action: 'tds_geo_reveal_key', key_id: keyId, password: password, nonce: tdsGeo?.nonce || ''
    }, function(r) {
      if (r.success && r.data?.api_key) {
        var $td = $('[data-key-id="' + keyId + '"]');
        $td.html('<code style="font-size:12px;word-break:break-all;background:var(--tds-bg);padding:2px 6px;border-radius:4px;">' + $('<span>').text(r.data.api_key).html() + '</code>');
        setTimeout(function() { $td.text(r.data.api_key.substring(0, 16) + '...'); }, 15000);
      } else { alert(r.data?.message || 'Failed to reveal key.'); }
    });
  };

  // ─── Init ───
  $(function() {
    $('.tds-fade').each(function(i) { $(this).css('animation-delay', (i * 0.06) + 's'); });

    $(document).on('click', '[data-tds-copy]', function() {
      var text = $(this).data('tds-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          var $btn = $(this); $btn.text('Copied!');
          setTimeout(function() { $btn.text('Copy'); }, 2000);
        }.bind(this));
      }
    });

    $(document).on('click', '#tds-refresh', function(e) { e.preventDefault(); loadDashboard(); });
    $(document).on('click', '#tds-generate-now', function(e) { e.preventDefault(); generateNow(); });
    $(document).on('click', '#tds-test-api', function(e) { e.preventDefault(); testApiKey(); });
    $(document).on('click', '.tds-milestone-close', function() { dismissMilestone(); });

    if ($('.tds-dashboard').length) { loadDashboard(); scheduleRefresh(); }
  });
})(jQuery);
