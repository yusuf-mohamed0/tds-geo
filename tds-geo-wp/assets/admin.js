(function($) {
  'use strict';

  var k = {
    refreshTimer: null,
    countdownTimer: null,
    ajaxUrl: window.tdsGeo?.ajax_url || '',
    nonce:   window.tdsGeo?.nonce   || '',
    loading: false,
    nextRun: null,
  };

  function setLoading(on) {
    k.loading = on;
    $('#k-refresh').prop('disabled', on).toggleClass('k-loading', on);
    $('#k-refresh').text(on ? '⟳ Refreshing...' : 'Refresh');
  }

  function showToast(msg, type) {
    var $t = $('.k-toast');
    if (!$t.length) { $t = $('<div class="k-toast">').appendTo('.k-shell'); }
    $t.text(msg).removeClass('k-toast-error k-toast-success').addClass('k-toast-' + (type || 'success'));
    $t.addClass('k-toast-visible');
    setTimeout(function() { $t.removeClass('k-toast-visible'); }, 4000);
  }

  function pipelinePct(stage) {
    var map = { queued:10, generating_article:30, scoring:60, publishing:85, completed:100, failed:100 };
    return map[stage] || 5;
  }

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

  // ─── Countdown timer ───
  function updateCountdown() {
    if (!k.nextRun) { $('[data-k-countdown]').text('—'); return; }
    var now = Math.floor(Date.now() / 1000);
    var diff = k.nextRun - now;
    if (diff <= 0) { $('[data-k-countdown]').text('Now'); return; }
    var m = Math.floor(diff / 60);
    var s = diff % 60;
    $('[data-k-countdown]').text(m + 'm ' + s + 's');
  }

  function startCountdown(nextRunTs) {
    k.nextRun = nextRunTs;
    if (k.countdownTimer) clearInterval(k.countdownTimer);
    updateCountdown();
    k.countdownTimer = setInterval(updateCountdown, 1000);
  }

  // ─── Update daily ring ───
  function updateDailyRing(current, max) {
    var pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    var circ = 2 * Math.PI * 15;
    var offset = circ - (pct / 100) * circ;
    $('.k-ring-fg').css('stroke-dasharray', circ).css('stroke-dashoffset', offset);
    $('.k-ring-text').text(current);
  }

  // ─── Generate Now ───
  function generateNow() {
    if (!k.ajaxUrl || k.loading) return;
    var $btn = $('#k-generate-now');
    $btn.prop('disabled', true).addClass('k-generating').text('⟳ Generating...');
    $.post(k.ajaxUrl, { action: 'tds_geo_generate_now', nonce: k.nonce }, function(r) {
      if (r.success) {
        showToast(r.data?.message || 'Generation started! Articles will appear shortly.', 'success');
        setTimeout(loadDashboard, 2000);
      } else {
        showToast(r.data?.message || 'Generation failed to start', 'error');
      }
    }).fail(function() {
      showToast('Server error', 'error');
    }).always(function() {
      $btn.prop('disabled', false).removeClass('k-generating').text('⟳ Generate Now');
    });
  }

  // ─── Test API Key ───
  function testApiKey() {
    var $btn = $('#k-test-api');
    var $result = $('.k-test-result');
    $btn.prop('disabled', true).text('Testing...');
    $result.remove();
    $.post(k.ajaxUrl, { action: 'tds_geo_test_api', nonce: k.nonce }, function(r) {
      var html = r.success
        ? '<div class="k-test-result k-test-success">✓ ' + (r.data?.model || 'Key works') + '</div>'
        : '<div class="k-test-result k-test-fail">✕ ' + (r.data?.message || 'Invalid key') + '</div>';
      $btn.after(html);
    }).fail(function() {
      $btn.after('<div class="k-test-result k-test-fail">✕ Connection failed</div>');
    }).always(function() {
      $btn.prop('disabled', false).text('Test Connection');
    });
  }

  // ─── Dismiss milestone ───
  function dismissMilestone() {
    $('.k-milestone').slideUp(300, function() { $(this).remove(); });
    if (k.ajaxUrl) {
      $.post(k.ajaxUrl, { action: 'tds_geo_dismiss_milestone', nonce: k.nonce });
    }
  }

  // ─── Load dashboard data ───
  function loadDashboard() {
    if (!k.ajaxUrl || k.loading) return;
    setLoading(true);
    $.post(k.ajaxUrl, { action: 'tds_geo_dashboard_data', nonce: k.nonce }, function(r) {
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
      var $next = $('[data-k-next]');
      if ($next.length) $next.text(d.next_run ? new Date(d.next_run * 1000).toLocaleString() : 'Awaiting schedule');

      // Queue items (live)
      var $queueArea = $('.k-queue-list');
      if ($queueArea.length) {
        $queueArea.empty();
        if (d.queue?.pending_tasks?.length) {
          $.each(d.queue.pending_tasks.slice(0, 5), function(i, t) {
            $queueArea.append(
              '<div class="k-queue-item"><span class="k-pulse"></span><span class="k-queue-label">' +
              $('<span>').text(t.task_type || t).html() + '</span><span class="k-queue-eta">queued</span></div>'
            );
          });
        } else {
          $queueArea.html('<div style="font-size:11px;color:var(--k-text-tertiary);padding:4px 0;">No pending tasks</div>');
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
        var $tbody = $('.k-activity tbody');
        if ($tbody.length) {
          $tbody.empty();
          $.each(d.recent_logs.slice(0, 5), function(i, log) {
            var lvl = (log.level || 'info').toLowerCase();
            $tbody.append(
              '<tr><td><span class="k-tag k-tag-' + (lvl === 'error' ? 'red' : lvl === 'warning' ? 'yellow' : 'blue') + '">' +
              (log.level || 'INFO') + '</span></td>' +
              '<td>' + (log.service || '—') + '</td>' +
              '<td title="' + $('<span>').text(log.message || '').html() + '">' + $('<span>').text((log.message || '').substring(0, 80) + ((log.message || '').length > 80 ? '…' : '')).html() + '</td>' +
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
            $atbody.append(
              '<tr><td><a href="' + (a.edit_link || '#') + '" class="k-cell-link">' +
              $('<span>').text(a.post_title || 'Untitled').html() + '</a></td>' +
              '<td><span class="k-tag ' + (a.post_status === 'publish' ? 'k-tag-active' : 'k-tag-yellow') + '">' +
              (a.post_status === 'publish' ? 'Published' : 'Draft') + '</span></td>' +
              '<td>' + (a.quality || '—') + '</td>' +
              '<td style="min-width:120px;"><div class="k-pipeline-bar" title="' +
              (error ? 'Error: ' + $('<span>').text(error).html() : 'Stage: ' + stage) +
              '"><div class="k-pipeline-fill" style="width:' + pct + '%;background:' + barBg + ';"></div><span class="k-pipeline-label">' +
              (error ? 'Failed' : stage) + '</span></div></td>' +
              '<td class="k-text-mono">' + (a.post_date ? new Date(a.post_date).toLocaleDateString() : '') + '</td>' +
              '<td style="text-align:right;"><div class="k-action-group">' +
              (a.post_status !== 'publish'
                ? '<button class="k-btn k-btn-sm k-tag-green" onclick="articleAction(' + a.ID + ',\'publish\')">Pub</button>'
                : '') +
              '<button class="k-btn k-btn-sm k-btn-danger" onclick="articleAction(' + a.ID + ',\'delete\')">×</button></div></td></tr>'
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

  // ─── Article actions ───
  function articleAction(postId, action) {
    if (!k.ajaxUrl) return;
    var $btns = $('[data-k-action="' + postId + '"]');
    var label = action === 'publish' ? 'Publish' : action === 'draft' ? 'Draft' : 'Delete';
    if (action === 'delete' && !confirm('Delete this article permanently?')) return;
    $btns.prop('disabled', true);
    $.post(k.ajaxUrl, { action: 'tds_geo_article_action', post_id: postId, act: action, nonce: k.nonce }, function(r) {
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
        $td.html('<code style="font-size:12px;word-break:break-all;background:var(--k-bg);padding:2px 6px;border-radius:4px;">' + $('<span>').text(r.data.api_key).html() + '</code>');
        setTimeout(function() { $td.text(r.data.api_key.substring(0, 16) + '...'); }, 15000);
      } else { alert(r.data?.message || 'Failed to reveal key.'); }
    });
  };

  // ─── Init ───
  $(function() {
    $('.k-fade').each(function(i) { $(this).css('animation-delay', (i * 0.06) + 's'); });

    $(document).on('click', '[data-k-copy]', function() {
      var text = $(this).data('k-copy');
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(function() {
          var $btn = $(this); $btn.text('Copied!');
          setTimeout(function() { $btn.text('Copy'); }, 2000);
        }.bind(this));
      }
    });

    $(document).on('click', '#k-refresh', function(e) { e.preventDefault(); loadDashboard(); });
    $(document).on('click', '#k-generate-now', function(e) { e.preventDefault(); generateNow(); });
    $(document).on('click', '#k-test-api', function(e) { e.preventDefault(); testApiKey(); });
    $(document).on('click', '.k-milestone-close', function() { dismissMilestone(); });

    if ($('.k-dashboard').length) { loadDashboard(); scheduleRefresh(); }
  });
})(jQuery);
