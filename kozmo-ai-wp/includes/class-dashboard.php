<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Admin Dashboard — modern UI with live stats.
 */
class Dashboard {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function load_activity_feed(): void {
        // Stub for real-time feed loading
    }

    public static function render(): void {
        $health = Health::run_checks();
        $log_stats = Logger::get_stats();
        $queue = Worker::get_queue_stats();
        $kb = KnowledgeBase::get_stats();
        $errors = HealEngine::get_error_stats();
        $settings = get_option('kozmo_ai_wp_settings', []);
        $content_health = ContentAnalyzer::analyze_content_health();
        $keyword_coverage = ContentAnalyzer::keyword_coverage();

        ?>
        <div class="wrap kozmo-ai-wrap">
            <div class="kozmo-header">
                <h1><span class="kozmo-logo">K</span> KOZMO AI <span class="kozmo-version">v<?php echo esc_html(KOZMO_AI_WP_VERSION); ?></span></h1>
                <div class="kozmo-header-actions">
                    <span class="kozmo-badge badge-<?php echo esc_attr($health['overall']); ?>"><?php echo esc_html(ucfirst($health['overall'])); ?></span>
                    <span class="kozmo-updated"><?php esc_html_e('Last scan:', 'kozmo-ai-wp'); ?> <?php echo esc_html($settings['last_scan_at'] ?? '—'); ?></span>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="kozmo-grid">
                <div class="kozmo-stat">
                    <div class="stat-icon icon-health">⚡</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo $health['overall']; ?></div>
                        <div class="stat-lbl"><?php esc_html_e('System Health', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) $health['unhealthy']; ?> issues</div>
                    </div>
                </div>
                <div class="kozmo-stat">
                    <div class="stat-icon icon-queue">📋</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo (int) ($queue['pending'] ?? 0); ?></div>
                        <div class="stat-lbl"><?php esc_html_e('Pending Tasks', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) ($queue['failed'] ?? 0); ?> failed</div>
                    </div>
                </div>
                <div class="kozmo-stat">
                    <div class="stat-icon icon-errors">⚠️</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo (int) ($errors['unresolved'] ?? 0); ?></div>
                        <div class="stat-lbl"><?php esc_html_e('Unresolved Errors', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) ($errors['healed'] ?? 0); ?> auto-healed</div>
                    </div>
                </div>
                <div class="kozmo-stat">
                    <div class="stat-icon icon-kb">🧠</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo (int) ($kb['total'] ?? 0); ?></div>
                        <div class="stat-lbl"><?php esc_html_e('Knowledge Items', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) ($kb['unsynced'] ?? 0); ?> unsynced</div>
                    </div>
                </div>
                <div class="kozmo-stat">
                    <div class="stat-icon icon-content">📝</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo (int) ($content_health['thin_content'] ?? 0); ?></div>
                        <div class="stat-lbl"><?php esc_html_e('Thin Content', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) ($content_health['no_featured_images'] ?? 0); ?> missing images</div>
                    </div>
                </div>
                <div class="kozmo-stat">
                    <div class="stat-icon icon-keywords">🔑</div>
                    <div class="stat-body">
                        <div class="stat-val"><?php echo (int) ($keyword_coverage['total_tags'] ?? 0); ?></div>
                        <div class="stat-lbl"><?php esc_html_e('Keywords (Tags)', 'kozmo-ai-wp'); ?></div>
                        <div class="stat-sub"><?php echo (int) ($keyword_coverage['total_cats'] ?? 0); ?> categories</div>
                    </div>
                </div>
            </div>

            <!-- Quick Actions -->
            <div class="kozmo-actions">
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="button button-primary">
                    ⚙️ <?php esc_html_e('Settings', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="button">
                    🔑 <?php esc_html_e('API Keys', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-diagnostics')); ?>" class="button">
                    📊 <?php esc_html_e('Diagnostics', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="button">
                    📋 <?php esc_html_e('Logs', 'kozmo-ai-wp'); ?>
                </a>
                <button id="kozmo-ai-refresh" class="button">🔄 <?php esc_html_e('Refresh', 'kozmo-ai-wp'); ?></button>
            </div>

            <!-- Content Health Detail -->
            <div class="kozmo-grid-2">
                <div class="kozmo-card">
                    <h2><?php esc_html_e('Content Issues', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped">
                        <thead><tr><th><?php esc_html_e('Issue', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Count', 'kozmo-ai-wp'); ?></th></tr></thead>
                        <tbody>
                            <tr><td><?php esc_html_e('Thin Content', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-warning"><?php echo (int) ($content_health['thin_content'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Duplicate Titles', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-warning"><?php echo (int) ($content_health['duplicate_titles'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Missing Featured Images', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-info"><?php echo (int) ($content_health['no_featured_images'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Missing Meta Titles', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-info"><?php echo (int) ($content_health['no_meta_titles'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Outdated Content (6mo+)', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-info"><?php echo (int) ($content_health['old_posts'] ?? 0); ?></span></td></tr>
                        </tbody>
                    </table>
                </div>

                <div class="kozmo-card">
                    <h2><?php esc_html_e('Queue Status', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped">
                        <thead><tr><th><?php esc_html_e('Status', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Count', 'kozmo-ai-wp'); ?></th></tr></thead>
                        <tbody>
                            <tr><td><?php esc_html_e('Pending', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-info"><?php echo (int) ($queue['pending'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Completed', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-active"><?php echo (int) ($queue['completed'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Failed', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-error"><?php echo (int) ($queue['failed'] ?? 0); ?></span></td></tr>
                            <tr><td><?php esc_html_e('Total', 'kozmo-ai-wp'); ?></td><td><?php echo (int) ($queue['total'] ?? 0); ?></td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Log Activity -->
            <div class="kozmo-card">
                <h2><?php esc_html_e('Recent Activity', 'kozmo-ai-wp'); ?></h2>
                <?php
                $recent_logs = Logger::get_logs(10);
                if (!empty($recent_logs)): ?>
                <table class="widefat striped">
                    <thead><tr><th><?php esc_html_e('Level', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Service', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Message', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Time', 'kozmo-ai-wp'); ?></th></tr></thead>
                    <tbody><?php foreach ($recent_logs as $log): ?><tr class="log-<?php echo esc_attr($log['level']); ?>">
                        <td><span class="kozmo-badge badge-<?php echo esc_attr($log['level']); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                        <td><?php echo esc_html($log['service'] ?? '—'); ?></td>
                        <td><?php echo esc_html($log['message']); ?></td>
                        <td style="white-space:nowrap;"><?php echo esc_html(wp_date('M j, H:i', strtotime($log['created_at']))); ?></td>
                    </tr><?php endforeach; ?></tbody>
                </table>
                <?php else: ?>
                <p class="kozmo-muted"><?php esc_html_e('No recent activity.', 'kozmo-ai-wp'); ?></p>
                <?php endif; ?>
            </div>

            <!-- Connection Info -->
            <div class="kozmo-card">
                <h2><?php esc_html_e('Connection Info', 'kozmo-ai-wp'); ?></h2>
                <table class="widefat striped" style="max-width:600px;">
                    <tr><td><?php esc_html_e('REST API Base', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(rest_url('kozmo-ai/v1/')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Webhook URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(rest_url('kozmo-ai/v1/webhook')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Agent URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_html($settings['agent_url'] ?? KOZMO_AI_WP_AGENT_URL); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Site URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(get_bloginfo('url')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('API Enabled', 'kozmo-ai-wp'); ?></td><td><?php echo ($settings['api_enabled'] ?? 'yes') === 'yes' ? __('Yes', 'kozmo-ai-wp') : __('No', 'kozmo-ai-wp'); ?></td></tr>
                </table>
            </div>
        </div>

        <script>
        jQuery(document).ready(function($) {
            $('#kozmo-ai-refresh').on('click', function() { location.reload(); });
        });
        </script>
        <?php
    }

    public static function ajax_data(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error('Unauthorized');

        wp_send_json_success([
            'health'  => Health::run_checks(),
            'queue'   => Worker::get_queue_stats(),
            'errors'  => HealEngine::get_error_stats(),
            'logs'    => Logger::get_stats(),
            'kb'      => KnowledgeBase::get_stats(),
        ]);
    }
}
