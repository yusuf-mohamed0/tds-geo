<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Dashboard {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function load_activity_feed(): void {}

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
        $publish_mode = ($settings['generate_as_draft'] ?? 'no') === 'yes' ? 'Draft' : 'Published';
        $ai_model = $settings['openai_model'] ?? 'gpt-4o';
        $recent = Logger::get_logs(5);
        $articles = self::recent_articles(5);
        $overall = $health['overall'] ?? 'healthy';

        // Pre-compute integration statuses (wrapped for safety)
        $backend_available = false;
        $graphify_available = false;
        try { $backend_available = BackendClient::is_available(); } catch (\Throwable $e) {}
        try { $graphify_available = GraphifyClient::is_available(); } catch (\Throwable $e) {}
        ?>
        <div class="wrap k-shell k-dashboard">
            <?php self::render_nav('dashboard'); ?>

            <div class="k-banner <?php echo esc_attr($overall); ?> k-fade">
                <span class="k-banner-icon"><?php echo $overall === 'healthy' ? '✓' : ($overall === 'warning' ? '⚠' : '✕'); ?></span>
                <span class="k-banner-text"><?php
                    echo $overall === 'healthy' ? esc_html__('All systems operational', 'kozmo-ai-wp') :
                         ($overall === 'warning' ? esc_html__('Some systems need attention', 'kozmo-ai-wp') :
                         esc_html__('Critical issues require immediate action', 'kozmo-ai-wp'));
                ?></span>
                <?php if ($overall !== 'healthy'): ?>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-btn k-btn-sm" style="margin-left:auto;background:var(--k-surface-hover);">Review</a>
                <?php endif; ?>
            </div>

            <div class="k-gen k-fade k-fade-d1">
                <div class="k-gen-info">
                    <div class="k-gen-item"><span class="k-gen-label">Model</span><span class="k-gen-value"><?php echo esc_html($ai_model); ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Articles Today</span><span class="k-gen-value" data-k-stat="today_articles"><?php echo (int) $today_count; ?></span><span class="k-gen-label">/ <?php echo (int) $daily_max; ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Mode</span><span class="k-gen-value"><?php echo esc_html($publish_mode); ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Next Run</span><span class="k-gen-value" data-k-next><?php echo $next_run ? esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), $next_run)) : 'Awaiting schedule'; ?></span></div>
                    <span class="k-tag k-gen-badge <?php echo $gen_enabled ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $gen_enabled ? 'Active' : 'Paused'; ?></span>
                    <?php if ($backend_available): ?>
                    <span class="k-tag k-tag-green">Backend</span>
                    <?php endif; ?>
                    <?php if ($graphify_available): ?>
                    <span class="k-tag k-tag-violet">Graph</span>
                    <?php endif; ?>
                </div>
                <div class="k-gen-actions">
                    <button id="k-refresh" class="k-btn k-btn-secondary k-btn-sm">Refresh</button>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-btn k-btn-primary k-btn-sm">Settings</a>
                </div>
            </div>

            <div class="k-grid k-fade k-fade-d2">
                <div class="k-stat"><div class="k-stat-label">System Health</div><div class="k-stat-value" data-k-stat="health"><?php echo (int) ($health['score'] ?? 100); ?></div><div class="k-stat-sub" data-k-sub="health"><?php echo esc_html($overall); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">Pending Tasks</div><div class="k-stat-value" data-k-stat="queue"><?php echo (int) ($queue['pending'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="queue"><?php echo (int) ($queue['failed'] ?? 0); ?> failed</div></div>
                <div class="k-stat"><div class="k-stat-label">Unresolved Errors</div><div class="k-stat-value" data-k-stat="errors"><?php echo (int) ($errors['unresolved'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="errors"><?php echo (int) ($errors['healed'] ?? 0); ?> healed</div></div>
                <div class="k-stat"><div class="k-stat-label">Knowledge Items</div><div class="k-stat-value" data-k-stat="knowledge"><?php echo (int) ($kb['total'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="knowledge"><?php echo (int) ($kb['unsynced'] ?? 0); ?> unsynced</div></div>
                <div class="k-stat"><div class="k-stat-label">Thin Content</div><div class="k-stat-value" data-k-stat="content"><?php echo (int) ($content_health['thin_content'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="content"><?php echo (int) ($content_health['no_featured_images'] ?? 0); ?> no images</div></div>
                <div class="k-stat"><div class="k-stat-label">Taxonomy Coverage</div><div class="k-stat-value" data-k-stat="taxonomy"><?php echo (int) ($keyword_coverage['total_cats'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="taxonomy"><?php echo (int) ($keyword_coverage['total_tags'] ?? 0); ?> tags</div></div>
            </div>

            <div class="k-panel k-fade k-fade-d3">
                <div class="k-card">
                    <div class="k-card-header"><h2>Recent Articles</h2><a href="<?php echo esc_url(admin_url('edit.php')); ?>" class="k-btn k-btn-secondary k-btn-sm">View All</a></div>
                    <?php if (empty($articles)): ?>
                    <div class="k-empty"><div class="k-empty-icon">📝</div>No AI-generated articles yet</div>
                    <?php else: ?>
                    <div class="k-table-wrap">
                    <table class="k-table k-articles"><thead><tr><th>Title</th><th>Status</th><th>Quality</th><th>Date</th></tr></thead>
                        <tbody><?php foreach ($articles as $a): ?>
                        <tr><td><a href="<?php echo esc_url(get_edit_post_link($a['ID'])); ?>" class="k-cell-link"><?php echo esc_html($a['post_title']); ?></a></td>
                            <td><span class="k-tag <?php echo $a['post_status'] === 'publish' ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $a['post_status'] === 'publish' ? 'Published' : 'Draft'; ?></span></td>
                            <td><?php echo esc_html($a['quality'] ?? '—'); ?></td>
                            <td class="k-text-mono"><?php echo esc_html(wp_date('M j, Y', strtotime($a['post_date']))); ?></td></tr>
                        <?php endforeach; ?></tbody>
                    </table>
                    </div><?php endif; ?>
                </div>

                <div class="k-card">
                    <div class="k-card-header"><h2>Recent Activity</h2></div>
                    <?php if (empty($recent)): ?>
                    <div class="k-empty"><div class="k-empty-icon">📄</div>No recent activity</div>
                    <?php else: ?>
                    <div class="k-table-wrap">
                    <table class="k-table k-activity"><thead><tr><th>Level</th><th>Service</th><th>Message</th><th>Time</th></tr></thead>
                        <tbody><?php foreach ($recent as $log): $lvl = strtolower($log['level'] ?? 'info'); ?>
                        <tr><td><span class="k-tag <?php echo $lvl === 'error' ? 'k-tag-red' : ($lvl === 'warning' ? 'k-tag-yellow' : 'k-tag-blue'); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                            <td><?php echo esc_html($log['service'] ?? '—'); ?></td>
                            <td><?php echo esc_html($log['message']); ?></td>
                            <td class="k-text-mono"><?php echo esc_html(wp_date('M j, H:i', strtotime($log['created_at']))); ?></td></tr>
                        <?php endforeach; ?></tbody>
                    </table>
                    </div><?php endif; ?>
                </div>
            </div>
        </div>
        <?php
    }

    private static function recent_articles(int $limit = 5): array {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_status, p.post_date, a.quality_score
             FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->prefix}kozmo_ai_articles a ON p.ID = a.post_id
             ORDER BY a.created_at DESC LIMIT %d", $limit
        ), ARRAY_A);
        foreach ($rows as &$r) {
            $r['quality'] = $r['quality_score'] ? round((float) $r['quality_score']) : '—';
        }
        return $rows;
    }

    public static function ajax_data(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error('Unauthorized');

        $settings = get_option('kozmo_ai_wp_settings', []);
        wp_send_json_success([
            'health'  => Health::run_checks(),
            'queue'   => Worker::get_queue_stats(),
            'errors'  => HealEngine::get_error_stats(),
            'logs'    => Logger::get_stats(),
            'kb'      => KnowledgeBase::get_stats(),
            'content' => ContentAnalyzer::analyze_content_health(),
            'keywords' => ContentAnalyzer::keyword_coverage(),
            'next_run' => wp_next_scheduled('kozmo_ai_generate_articles'),
            'generation_enabled' => ($settings['enable_auto_generation'] ?? 'yes') === 'yes',
            'last_scan' => $settings['last_scan_at'] ?? '',
            'today_articles' => ContentGenerator::get_today_generation_count(),
            'recent_logs' => Logger::get_logs(5),
            'recent_articles' => self::recent_articles(5),
            'backend_connected'  => self::safe_bool('BackendClient::is_configured'),
            'backend_available'  => self::safe_bool('BackendClient::is_available'),
            'graphify_available' => self::safe_bool('GraphifyClient::is_available'),
        ]);
    }

    /**
     * Safely call a static bool method — returns false on any error.
     */
    private static function safe_bool(string $callable): bool {
        try {
            if (0 === strncmp($callable, 'BackendClient::', 15)) {
                $method = substr($callable, 15);
                return BackendClient::$method();
            }
            if (0 === strncmp($callable, 'GraphifyClient::', 16)) {
                $method = substr($callable, 16);
                return GraphifyClient::$method();
            }
        } catch (\Throwable $e) {
            Logger::debug('safe_bool caught error', ['callable' => $callable, 'error' => $e->getMessage()]);
        }
        return false;
    }

    public static function render_nav(string $active): void {
        $pages = [
            'dashboard' => ['Dashboard', admin_url('admin.php?page=kozmo-ai-wp')],
            'content'   => ['Content',   admin_url('admin.php?page=kozmo-ai-wp-content')],
            'settings'  => ['Settings',  admin_url('admin.php?page=kozmo-ai-wp-settings')],
        ];
        $health = Health::run_checks();
        ?>
        <nav class="k-nav">
            <div class="k-nav-logo">K</div>
            <div class="k-nav-title">KOZMO AI</div>
            <div class="k-nav-items"><?php foreach ($pages as $key => $p): ?>
                <a href="<?php echo esc_url($p[1]); ?>" class="k-nav-item <?php echo $active === $key ? 'active' : ''; ?>"><?php echo esc_html($p[0]); ?></a>
            <?php endforeach; ?></div>
            <div class="k-nav-status">
                <span class="k-nav-dot <?php echo esc_attr($health['overall'] ?? 'healthy'); ?>"></span>
                <?php echo esc_html(ucfirst($health['overall'] ?? 'healthy')); ?>
            </div>
        </nav>
        <?php
    }
}
