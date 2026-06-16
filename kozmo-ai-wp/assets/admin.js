(function($) {
  'use strict';

  var k = {
    refreshTimer: null,
    ajaxUrl: window.kozmoAI?.ajax_url || '',
    nonce:   window.kozmoAI?.nonce   || '',
  };

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

  // ─── Update stat card ───
  function setStat(metric, value, sub) {
    var $v = $('[data-k-stat="' + metric + '"]');
    if ($v.length) animateNumber($v, parseInt(value, 10));
    if (sub) $('[data-k-sub="' + metric + '"]').text(sub);
  }

  // ─── Update state indicator ───
  function setState(state) {
    var dot = $('.k-nav-dot');
    var banner = $('.k-banner');
    dot.removeClass('healthy warning critical').addClass(state);
    banner.removeClass('healthy warning critical').addClass(state);
    banner.find('.k-banner-text').text(
      state === 'healthy' ? 'All systems operational' :
      state === 'warning' ? 'Some systems need attention' :
      'Critical issues require immediate action'
    );
    banner.find('.k-banner-icon').text(
      state === 'healthy' ? '✓' : state === 'warning' ? '⚠' : '✕'
    );
  }

  // ─── Update generation badge ───
  function setGenState(enabled) {
    var $badge = $('.k-gen-badge');
    if (enabled) {
      $badge.removeClass('k-tag-yellow k-tag-red').addClass('k-tag-active').text('Active');
    } else {
      $badge.removeClass('k-tag-active k-tag-red').addClass('k-tag-yellow').text('Paused');
    }
  }

  // ─── Load dashboard data ───
  function loadDashboard() {
    if (!k.ajaxUrl) return;
    $.post(k.ajaxUrl, { action: 'kozmo_ai_dashboard_data', nonce: k.nonce }, function(r) {
      if (!r || !r.success || !r.data) return;
      var d = r.data;
      var health = d.health || {};
      var queue = d.queue || {};
      var errors = d.errors || {};
      var kb = d.kb || {};
      var content = d.content || {};
      var kw = d.keywords || {};

      setState(health.overall || 'healthy');
      setGenState(d.generation_enabled);

      setStat('health', health.score || 100, health.overall);
      setStat('queue', queue.pending || 0, (queue.failed || 0) + ' failed');
      setStat('errors', errors.unresolved || 0, (errors.healed || 0) + ' healed');
      setStat('knowledge', kb.total || 0, (kb.unsynced || 0) + ' unsynced');
      setStat('content', content.thin_content || 0, (content.no_featured_images || 0) + ' no images');
      setStat('taxonomy', kw.total_cats || 0, (kw.total_tags || 0) + ' tags');
      setStat('today_articles', d.today_articles || 0, '');

      var $next = $('[data-k-next]');
      if ($next.length) $next.text(d.next_run ? new Date(d.next_run * 1000).toLocaleString() : 'Awaiting schedule');

      var $scan = $('[data-k-scan]');
      if ($scan.length) $scan.text(d.last_scan || '—');

      // Update recent activity
      if (d.recent_logs && d.recent_logs.length) {
        var $tbody = $('.k-activity tbody');
        $tbody.empty();
        $.each(d.recent_logs.slice(0, 5), function(i, log) {
          var lvl = (log.level || 'info').toLowerCase();
          $tbody.append(
            '<tr><td><span class="k-tag k-tag-' + (lvl === 'error' ? 'red' : lvl === 'warning' ? 'yellow' : 'blue') + '">' +
            log.level.toUpperCase() + '</span></td>' +
            '<td>' + (log.service || '—') + '</td>' +
            '<td>' + (log.message || '') + '</td>' +
            '<td class="k-text-mono">' + (log.created_at ? new Date(log.created_at).toLocaleString() : '') + '</td></tr>'
          );
        });
      }

      // Update recent articles
      if (d.recent_articles && d.recent_articles.length) {
        var $atbody = $('.k-articles tbody');
        $atbody.empty();
        $.each(d.recent_articles.slice(0, 5), function(i, a) {
          var tagClass = a.post_status === 'publish' ? 'k-tag-active' : 'k-tag-yellow';
          var tagText = a.post_status === 'publish' ? 'Published' : 'Draft';
          $atbody.append(
            '<tr><td><a href="' + a.edit_link + '" class="k-cell-link">' + a.post_title + '</a></td>' +
            '<td><span class="k-tag ' + tagClass + '">' + tagText + '</span></td>' +
            '<td>' + (Math.round(a.quality_score) || '—') + '</td>' +
            '<td class="k-text-mono">' + (a.created_at ? new Date(a.created_at).toLocaleDateString() : '') + '</td></tr>'
          );
        });
      }
    });
  }

  // ─── Schedule refresh ───
  function scheduleRefresh() {
    if (k.refreshTimer) clearTimeout(k.refreshTimer);
    k.refreshTimer = setTimeout(function() {
      loadDashboard();
      scheduleRefresh();
    }, 60000);
  }

  // ─── Init ───
  $(function() {
    // Staggered fade-in
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
    $(document).on('click', '#k-refresh', function() { loadDashboard(); });

    // Start dashboard
    if ($('.k-dashboard').length) {
      loadDashboard();
      scheduleRefresh();
    }
  });
})(jQuery);
