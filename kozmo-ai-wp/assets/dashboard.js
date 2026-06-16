/**
 * KOZMO AI WP - Dashboard Live Data
 */
(function($) {
    'use strict';

    var $refreshBtn = $('#kozmo-ai-refresh');
    var refreshLabel = $refreshBtn.text();
    var refreshTimer = null;

    $refreshBtn.on('click', function(e) {
        e.preventDefault();
        loadDashboardData();
    });

    scheduleRefresh();

    function scheduleRefresh() {
        if (refreshTimer) {
            clearTimeout(refreshTimer);
        }

        refreshTimer = setTimeout(function() {
            loadDashboardData();
        }, 60000);
    }

    function loadDashboardData() {
        $('body').addClass('kozmo-loading');
        $refreshBtn.prop('disabled', true).text('Synchronizing...');

        $.ajax({
            url: kozmoAI.ajax_url,
            method: 'POST',
            data: {
                action: 'kozmo_ai_dashboard_data',
                nonce: kozmoAI.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    updateStats(response.data);
                }
            },
            complete: function() {
                $('body').removeClass('kozmo-loading');
                $refreshBtn.prop('disabled', false).text(refreshLabel);
                scheduleRefresh();
            }
        });
    }

    function animateNumber($el, nextValue) {
        var current = parseInt(String($el.text()).replace(/[^0-9-]/g, ''), 10);
        var target = parseInt(nextValue, 10);

        if (isNaN(target)) {
            $el.text(nextValue);
            return;
        }

        if (isNaN(current)) {
            current = 0;
        }

        if (current === target) {
            return;
        }

        $({ value: current }).animate({ value: target }, {
            duration: 550,
            easing: 'swing',
            step: function() {
                $el.text(Math.round(this.value));
            },
            complete: function() {
                $el.text(target);
            }
        });
    }

    function setMetric(metric, value, subtext) {
        var $value = $('[data-stat-value="' + metric + '"]');
        var $sub = $('[data-stat-sub="' + metric + '"]');

        if ($value.length) {
            animateNumber($value, value);
        }

        if ($sub.length && typeof subtext !== 'undefined') {
            $sub.text(subtext);
        }
    }

    function updateStats(data) {
        if (data.health) {
            var overall = data.health.overall || 'healthy';
            $('[data-health-state]')
                .removeClass('badge-active badge-healthy badge-ok badge-pass badge-warning badge-degraded badge-error badge-critical badge-danger badge-inactive badge-pending badge-info')
                .addClass('badge-' + overall)
                .text(overall.charAt(0).toUpperCase() + overall.slice(1));

            setMetric('health', data.health.unhealthy || 0, overall.charAt(0).toUpperCase() + overall.slice(1) + ' state');
        }

        if (data.queue) {
            setMetric('queue', data.queue.pending || 0, (data.queue.failed || 0) + ' failed tasks waiting for recovery');
        }

        if (data.errors) {
            setMetric('errors', data.errors.unresolved || 0, (data.errors.healed || 0) + ' issues auto-healed by KOZMO');
        }

        if (data.kb) {
            setMetric('knowledge', data.kb.total || 0, (data.kb.unsynced || 0) + ' records still waiting to sync');
        }

        if (data.content) {
            setMetric('content', data.content.thin_content || 0, (data.content.no_featured_images || 0) + ' posts still need stronger visual support');
        }

        if (data.keywords) {
            setMetric('taxonomy', data.keywords.total_cats || 0, (data.keywords.total_tags || 0) + ' tags mapped to live topic signals');
        }

        if (typeof data.today_articles !== 'undefined') {
            animateNumber($('[data-stat-value="today_articles"]'), data.today_articles);
        }

        if (typeof data.generation_enabled !== 'undefined') {
            $('[data-generation-state]')
                .removeClass('badge-active badge-inactive')
                .addClass(data.generation_enabled ? 'badge-active' : 'badge-inactive')
                .text(data.generation_enabled ? 'Active' : 'Disabled');
        }

        if (typeof data.next_run !== 'undefined') {
            $('[data-next-run]').text(data.next_run ? new Date(data.next_run * 1000).toLocaleString() : 'Awaiting schedule');
        }

        if (typeof data.last_scan !== 'undefined') {
            $('[data-last-scan]').text('Last scan: ' + (data.last_scan || '—'));
        }
    }

})(jQuery);
