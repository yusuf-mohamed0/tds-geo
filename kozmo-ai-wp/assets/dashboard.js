/**
 * KOZMO AI WP — Dashboard Live Data
 */
(function($) {
    'use strict';

    var $refreshBtn = $('#kozmo-ai-refresh');

    // Manual refresh
    $refreshBtn.on('click', function(e) {
        e.preventDefault();
        loadDashboardData();
    });

    // Auto-refresh every 60 seconds
    setTimeout(function() {
        loadDashboardData();
    }, 60000);

    function loadDashboardData() {
        $refreshBtn.prop('disabled', true).text('Loading...');

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
                $refreshBtn.prop('disabled', false).text('\ud83d\udd04 Refresh');
            }
        });
    }

    function updateStats(data) {
        // Update queue stats
        if (data.queue) {
            $('.stat-queue-pending').text(data.queue.pending || 0);
            $('.stat-queue-failed').text(data.queue.failed || 0);
        }
        // Update error stats
        if (data.errors) {
            $('.stat-errors-unresolved').text(data.errors.unresolved || 0);
            $('.stat-errors-healed').text(data.errors.healed || 0);
        }
        // Update KB stats
        if (data.kb) {
            $('.stat-kb-total').text(data.kb.total || 0);
            $('.stat-kb-unsynced').text(data.kb.unsynced || 0);
        }
    }

})(jQuery);
