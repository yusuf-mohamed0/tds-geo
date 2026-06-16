<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Admin Dashboard — modern UI with live stats.
 */
class Dashboard {
    private static ?self $instance = null;

    private static function metric_card(string $icon, string $tone, string $label, int $value, string $subtext, string $metric): void {
        ?>
        <div class="kozmo-stat kozmo-reveal" data-metric-card="<?php echo esc_attr($metric); ?>">
            <div class="stat-icon icon-<?php echo esc_attr($tone); ?>"><span><?php echo esc_html($icon); ?></span></div>
            <div class="stat-body">
                <div class="stat-lbl"><?php echo esc_html($label); ?></div>
                <div class="stat-val" data-stat-value="<?php echo esc_attr($metric); ?>"><?php echo (int) $value; ?></div>
                <div class="stat-sub" data-stat-sub="<?php echo esc_attr($metric); ?>"><?php echo esc_html($subtext); ?></div>
            </div>
        </div>
        <?php
    }

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function load_activity_feed(): void {
        // Stub for real-time feed loading
    }

    public static function render(): void {
        $health = Health::run_checks();
        $queue = Worker::get_queue_stats();
        $kb = KnowledgeBase::get_stats();
        $errors = HealEngine::get_error_stats();
        $settings = get_option('kozmo_ai_wp_settings', []);
        $content_health = ContentAnalyzer::analyze_content_health();
        $keyword_coverage = ContentAnalyzer::keyword_coverage();
        $next_run = wp_next_scheduled('kozmo_ai_generate_articles');
        $gen_enabled = ($settings['enable_auto_generation'] ?? 'yes') === 'yes';
        $today_count = ContentGenerator::get_today_generation_count();
        $daily_max = (int) ($settings['max_articles_daily'] ?? 24);
        $publish_mode = ($settings['generate_as_draft'] ?? 'no') === 'yes' ? __('Draft', 'kozmo-ai-wp') : __('Published', 'kozmo-ai-wp');
        $ai_model = $settings['openai_model'] ?? 'gpt-4o';
        $hero_summary = sprintf(
            __('%1$s autonomous publishing with %2$d queued actions, %3$d unresolved issues, and %4$d live site insights.', 'kozmo-ai-wp'),
            $gen_enabled ? __('Continuous', 'kozmo-ai-wp') : __('Manual', 'kozmo-ai-wp'),
            (int) ($queue['pending'] ?? 0),
            (int) ($errors['unresolved'] ?? 0),
            (int) ($kb['total'] ?? 0)
        );

        ?>
        <div class="wrap kozmo-ai-wrap kozmo-admin-shell">
            <div class="kozmo-brand-guidelines kozmo-reveal">
                <span class="kozmo-guideline-dot"></span>
                <strong><?php esc_html_e('Brand System', 'kozmo-ai-wp'); ?>:</strong>
                <span><?php esc_html_e('Midnight Intelligence', 'kozmo-ai-wp'); ?></span>
                <span><?php esc_html_e('Signal Cyan', 'kozmo-ai-wp'); ?></span>
                <span><?php esc_html_e('Neural Violet', 'kozmo-ai-wp'); ?></span>
            </div>

            <section class="kozmo-hero kozmo-reveal">
                <div class="kozmo-hero-copy">
                    <span class="kozmo-kicker"><?php esc_html_e('Autonomous Content Intelligence', 'kozmo-ai-wp'); ?></span>
                    <h1><span class="kozmo-logo">K</span> KOZMO AI <span class="kozmo-version">v<?php echo esc_html(KOZMO_AI_WP_VERSION); ?></span></h1>
                    <p class="kozmo-hero-summary"><?php echo esc_html($hero_summary); ?></p>
                    <div class="kozmo-hero-meta">
                        <span class="kozmo-badge badge-<?php echo esc_attr($health['overall']); ?>" data-health-state><?php echo esc_html(ucfirst($health['overall'])); ?></span>
                        <span class="kozmo-updated" data-last-scan><?php esc_html_e('Last scan:', 'kozmo-ai-wp'); ?> <?php echo esc_html($settings['last_scan_at'] ?? '—'); ?></span>
                        <span class="kozmo-updated"><?php esc_html_e('Publish mode:', 'kozmo-ai-wp'); ?> <?php echo esc_html($publish_mode); ?></span>
                    </div>
                    <div class="kozmo-actions kozmo-actions-hero">
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="button button-primary kozmo-button kozmo-button-primary">
                            <?php esc_html_e('Tune AI Settings', 'kozmo-ai-wp'); ?>
                        </a>
                        <button id="kozmo-ai-refresh" class="button kozmo-button kozmo-button-secondary">
                            <?php esc_html_e('Refresh Live Signals', 'kozmo-ai-wp'); ?>
                        </button>
                    </div>
                </div>
                <div class="kozmo-hero-visual" aria-hidden="true">
                    <div class="kozmo-orbit kozmo-orbit-outer"></div>
                    <div class="kozmo-orbit kozmo-orbit-inner"></div>
                    <div class="kozmo-core">
                        <span><?php echo esc_html($ai_model); ?></span>
                        <strong><?php esc_html_e('AI Core', 'kozmo-ai-wp'); ?></strong>
                    </div>
                    <div class="kozmo-signal kozmo-signal-one"></div>
                    <div class="kozmo-signal kozmo-signal-two"></div>
                    <div class="kozmo-signal kozmo-signal-three"></div>
                </div>
            </section>

            <div class="kozmo-grid">
                <?php self::metric_card('⚡', 'health', __('System Health', 'kozmo-ai-wp'), (int) $health['unhealthy'], sprintf(__('%s state', 'kozmo-ai-wp'), ucfirst($health['overall'])), 'health'); ?>
                <?php self::metric_card('📋', 'queue', __('Pending Tasks', 'kozmo-ai-wp'), (int) ($queue['pending'] ?? 0), sprintf(__('%d failed tasks waiting for recovery', 'kozmo-ai-wp'), (int) ($queue['failed'] ?? 0)), 'queue'); ?>
                <?php self::metric_card('⚠', 'errors', __('Unresolved Errors', 'kozmo-ai-wp'), (int) ($errors['unresolved'] ?? 0), sprintf(__('%d issues auto-healed by KOZMO', 'kozmo-ai-wp'), (int) ($errors['healed'] ?? 0)), 'errors'); ?>
                <?php self::metric_card('🧠', 'kb', __('Knowledge Items', 'kozmo-ai-wp'), (int) ($kb['total'] ?? 0), sprintf(__('%d records still waiting to sync', 'kozmo-ai-wp'), (int) ($kb['unsynced'] ?? 0)), 'knowledge'); ?>
                <?php self::metric_card('✍', 'content', __('Thin Content Alerts', 'kozmo-ai-wp'), (int) ($content_health['thin_content'] ?? 0), sprintf(__('%d posts still need stronger visual support', 'kozmo-ai-wp'), (int) ($content_health['no_featured_images'] ?? 0)), 'content'); ?>
                <?php self::metric_card('◎', 'keywords', __('Taxonomy Coverage', 'kozmo-ai-wp'), (int) ($keyword_coverage['total_cats'] ?? 0), sprintf(__('%d tags mapped to live topic signals', 'kozmo-ai-wp'), (int) ($keyword_coverage['total_tags'] ?? 0)), 'taxonomy'); ?>
            </div>

            <div class="kozmo-actions">
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="button kozmo-button kozmo-button-secondary">
                    <?php esc_html_e('Settings', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="button kozmo-button kozmo-button-secondary">
                    <?php esc_html_e('API Keys', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-diagnostics')); ?>" class="button kozmo-button kozmo-button-secondary">
                    <?php esc_html_e('Diagnostics', 'kozmo-ai-wp'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="button kozmo-button kozmo-button-secondary">
                    <?php esc_html_e('Logs', 'kozmo-ai-wp'); ?>
                </a>
            </div>

            <div class="kozmo-grid-2">
                <div class="kozmo-card kozmo-reveal">
                    <div class="kozmo-card-heading">
                        <h2><?php esc_html_e('Content Intelligence Radar', 'kozmo-ai-wp'); ?></h2>
                        <span class="kozmo-badge badge-info"><?php esc_html_e('Smart Audit', 'kozmo-ai-wp'); ?></span>
                    </div>
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

                <div class="kozmo-card kozmo-reveal">
                    <div class="kozmo-card-heading">
                        <h2><?php esc_html_e('Autonomy Queue', 'kozmo-ai-wp'); ?></h2>
                        <span class="kozmo-badge badge-active"><?php esc_html_e('Self-Healing', 'kozmo-ai-wp'); ?></span>
                    </div>
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

            <div class="kozmo-grid-2">
                <div class="kozmo-card kozmo-reveal">
                    <div class="kozmo-card-heading">
                        <h2><?php esc_html_e('Brand Presence', 'kozmo-ai-wp'); ?></h2>
                        <span class="kozmo-badge badge-info"><?php esc_html_e('3-Color Protocol', 'kozmo-ai-wp'); ?></span>
                    </div>
                    <div class="kozmo-brand-panel">
                        <div class="kozmo-brand-chip kozmo-brand-ink">
                            <strong><?php esc_html_e('Midnight Intelligence', 'kozmo-ai-wp'); ?></strong>
                            <span><?php esc_html_e('Core trust, control, and premium depth.', 'kozmo-ai-wp'); ?></span>
                        </div>
                        <div class="kozmo-brand-chip kozmo-brand-cyan">
                            <strong><?php esc_html_e('Signal Cyan', 'kozmo-ai-wp'); ?></strong>
                            <span><?php esc_html_e('Live automation, scanning, and actionable clarity.', 'kozmo-ai-wp'); ?></span>
                        </div>
                        <div class="kozmo-brand-chip kozmo-brand-violet">
                            <strong><?php esc_html_e('Neural Violet', 'kozmo-ai-wp'); ?></strong>
                            <span><?php esc_html_e('Reasoning, pattern detection, and AI sophistication.', 'kozmo-ai-wp'); ?></span>
                        </div>
                    </div>
                </div>

                <?php if (ContentGenerator::is_configured()): ?>
                <div class="kozmo-card kozmo-reveal">
                    <div class="kozmo-card-heading">
                        <h2><?php esc_html_e('AI Auto-Generation', 'kozmo-ai-wp'); ?></h2>
                        <span class="kozmo-badge <?php echo $gen_enabled ? 'badge-active' : 'badge-inactive'; ?>" data-generation-state><?php echo $gen_enabled ? esc_html__('Active', 'kozmo-ai-wp') : esc_html__('Disabled', 'kozmo-ai-wp'); ?></span>
                    </div>
                    <table class="widefat striped kozmo-status-table" style="max-width:100%;">
                        <tr><td><?php esc_html_e('AI Model', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_html($ai_model); ?></code></td></tr>
                        <tr><td><?php esc_html_e('Articles Today', 'kozmo-ai-wp'); ?></td><td><span data-stat-value="today_articles"><?php echo (int) $today_count; ?></span> / <?php echo (int) $daily_max; ?></td></tr>
                        <tr><td><?php esc_html_e('Generated As', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($publish_mode); ?></td></tr>
                        <tr><td><?php esc_html_e('Auto-Publish', 'kozmo-ai-wp'); ?></td><td><?php echo ($settings['auto_publish'] ?? 'yes') === 'yes' ? sprintf(esc_html__('Yes (quality >= %d)', 'kozmo-ai-wp'), (int) ($settings['min_quality_score'] ?? 95)) : esc_html__('No', 'kozmo-ai-wp'); ?></td></tr>
                        <tr><td><?php esc_html_e('Next Generation', 'kozmo-ai-wp'); ?></td><td data-next-run><?php echo $next_run ? esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), $next_run)) : esc_html__('Awaiting schedule', 'kozmo-ai-wp'); ?></td></tr>
                    </table>
                </div>
                <?php endif; ?>
            </div>

            <div class="kozmo-card kozmo-reveal">
                <div class="kozmo-card-heading">
                    <h2><?php esc_html_e('Recent Activity', 'kozmo-ai-wp'); ?></h2>
                    <span class="kozmo-badge badge-info"><?php esc_html_e('Live Feed', 'kozmo-ai-wp'); ?></span>
                </div>
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

            <div class="kozmo-card kozmo-reveal">
                <div class="kozmo-card-heading">
                    <h2><?php esc_html_e('Connection Intelligence', 'kozmo-ai-wp'); ?></h2>
                    <span class="kozmo-badge badge-info"><?php esc_html_e('Operator View', 'kozmo-ai-wp'); ?></span>
                </div>
                <table class="widefat striped" style="max-width:600px;">
                    <tr><td><?php esc_html_e('REST API Base', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(rest_url('kozmo-ai/v1/')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Webhook URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(rest_url('kozmo-ai/v1/webhook')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Agent URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_html($settings['agent_url'] ?? KOZMO_AI_WP_AGENT_URL); ?></code></td></tr>
                    <tr><td><?php esc_html_e('Site URL', 'kozmo-ai-wp'); ?></td><td><code><?php echo esc_url(get_bloginfo('url')); ?></code></td></tr>
                    <tr><td><?php esc_html_e('API Enabled', 'kozmo-ai-wp'); ?></td><td><?php echo ($settings['api_enabled'] ?? 'yes') === 'yes' ? __('Yes', 'kozmo-ai-wp') : __('No', 'kozmo-ai-wp'); ?></td></tr>
                </table>
            </div>
        </div>

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
            'content' => ContentAnalyzer::analyze_content_health(),
            'keywords' => ContentAnalyzer::keyword_coverage(),
            'next_run' => wp_next_scheduled('kozmo_ai_generate_articles'),
            'generation_enabled' => (get_option('kozmo_ai_wp_settings', [])['enable_auto_generation'] ?? 'yes') === 'yes',
            'last_scan' => get_option('kozmo_ai_wp_settings', [])['last_scan_at'] ?? '',
            'today_articles' => ContentGenerator::get_today_generation_count(),
        ]);
    }
}
