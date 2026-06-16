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
        $pipeline_summary = self::pipeline_summary();
        $total_articles = wp_count_posts('post')->publish ?? 0;
        $milestone = self::get_milestone_message($today_count, $total_articles);

        // Ring SVG — circumference for r=15 is ~94.25
        $ring_circ = 2 * M_PI * 15;
        $ring_pct = $daily_max > 0 ? min(100, ($today_count / $daily_max) * 100) : 0;
        $ring_offset = $ring_circ - ($ring_pct / 100) * $ring_circ;
        ?>
        <div class="wrap k-shell k-dashboard">
            <?php self::render_nav('dashboard'); ?>

            <?php if ($milestone): ?>
            <div class="k-milestone">
                <span class="k-milestone-icon"><?php echo esc_html($milestone['icon']); ?></span>
                <span class="k-milestone-text"><?php echo esc_html($milestone['message']); ?></span>
                <button class="k-milestone-close" title="Dismiss">&times;</button>
            </div>
            <?php endif; ?>

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
                    <div class="k-gen-item"><span class="k-gen-label">Articles Today</span>
                        <div class="k-daily-ring">
                            <svg class="k-ring-svg" viewBox="0 0 36 36">
                                <circle class="k-ring-bg" cx="18" cy="18" r="15"/>
                                <circle class="k-ring-fg" cx="18" cy="18" r="15"
                                    stroke-dasharray="<?php echo esc_attr($ring_circ); ?>"
                                    stroke-dashoffset="<?php echo esc_attr($ring_offset); ?>"/>
                            </svg>
                            <span class="k-ring-text"><?php echo (int) $today_count; ?></span>
                        </div>
                        <span class="k-gen-label">/ <?php echo (int) $daily_max; ?></span>
                    </div>
                    <div class="k-gen-item"><span class="k-gen-label">Mode</span><span class="k-gen-value"><?php echo esc_html($publish_mode); ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Next Run</span>
                        <span class="k-gen-value" data-k-next><?php echo $next_run ? esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), $next_run)) : 'Awaiting schedule'; ?></span>
                        <span class="k-gen-label" style="font-size:10px;">in <span data-k-countdown><?php echo $next_run ? self::countdown_text($next_run) : '—'; ?></span></span>
                    </div>
                    <span class="k-tag k-gen-badge <?php echo $gen_enabled ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $gen_enabled ? 'Active' : 'Paused'; ?></span>
                </div>
                <div class="k-gen-actions">
                    <button id="k-generate-now" class="k-btn k-btn-secondary k-btn-sm" title="Generate articles immediately">⟳ Generate Now</button>
                    <button id="k-refresh" class="k-btn k-btn-secondary k-btn-sm">Refresh</button>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-seo')); ?>" class="k-btn k-btn-secondary k-btn-sm">SEO Report</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-btn k-btn-primary k-btn-sm">Settings</a>
                </div>
            </div>

            <div class="k-grid k-fade k-fade-d2">
                <div class="k-stat"><div class="k-stat-label">System Health</div><div class="k-stat-value" data-k-stat="health"><?php echo (int) ($health['score'] ?? 100); ?></div><div class="k-stat-sub" data-k-sub="health"><?php echo esc_html($overall); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">Pending Tasks</div><div class="k-stat-value" data-k-stat="queue"><?php echo (int) ($queue['pending'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="queue"><?php echo (int) ($queue['failed'] ?? 0); ?> failed</div></div>
                <div class="k-stat"><div class="k-stat-label">Unresolved Errors</div><div class="k-stat-value" data-k-stat="errors"><?php echo (int) ($errors['unresolved'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="errors"><?php echo (int) ($errors['healed'] ?? 0); ?> healed</div></div>
                <div class="k-stat"><div class="k-stat-label">Knowledge Items</div><div class="k-stat-value" data-k-stat="knowledge"><?php echo (int) ($kb['total'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="knowledge"><?php echo (int) ($kb['unsynced'] ?? 0); ?> unsynced</div></div>
                <div class="k-stat"><div class="k-stat-label">Pipeline In Progress</div><div class="k-stat-value" data-k-stat="pipeline"><?php echo (int) array_sum(array_map(function($s){return (int)$s->count;}, $pipeline_summary['stages'])); ?></div><div class="k-stat-sub" data-k-sub="pipeline"><?php echo (int) $pipeline_summary['failed']; ?> failed</div></div>
                <div class="k-stat"><div class="k-stat-label">Articles Published</div><div class="k-stat-value"><?php echo (int) $total_articles; ?></div><div class="k-stat-sub">All-time total</div></div>
                <div class="k-stat"><div class="k-stat-label">Thin Content</div><div class="k-stat-value" data-k-stat="content"><?php echo (int) ($content_health['thin_content'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="content"><?php echo (int) ($content_health['no_featured_images'] ?? 0); ?> no images</div></div>
                <div class="k-stat"><div class="k-stat-label">Taxonomy Coverage</div><div class="k-stat-value" data-k-stat="taxonomy"><?php echo (int) ($keyword_coverage['total_cats'] ?? 0); ?></div><div class="k-stat-sub" data-k-sub="taxonomy"><?php echo (int) ($keyword_coverage['total_tags'] ?? 0); ?> tags</div></div>
                <?php $telemetry_url = $settings['telemetry_url'] ?? ''; ?>
                <div class="k-stat"><div class="k-stat-label">Telemetry</div><div class="k-stat-value"><?php echo $telemetry_url ? '✓' : '○'; ?></div><div class="k-stat-sub"><?php echo $telemetry_url ? esc_html(parse_url($telemetry_url, PHP_URL_HOST)) : 'Not configured'; ?></div></div>
            </div>

            <?php if ($queue['pending'] > 0): ?>
            <div class="k-card k-fade k-fade-d2" style="margin-bottom:16px;">
                <div class="k-card-header"><h2>Queue</h2><span class="k-tag k-tag-blue"><?php echo (int) $queue['pending']; ?> pending</span></div>
                <div class="k-queue-list"></div>
            </div>
            <?php endif; ?>

            <div class="k-panel k-fade k-fade-d3">
                <div class="k-card">
                    <div class="k-card-header"><h2>Recent Articles</h2><a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-content')); ?>" class="k-btn k-btn-secondary k-btn-sm">Manage All</a></div>
                    <?php if (empty($articles)): ?>
                    <div class="k-empty"><div class="k-empty-icon">📝</div><p>No AI-generated articles yet</p><p style="font-size:12px;color:var(--k-text-tertiary);margin-top:8px;">Articles will appear here after the first generation cycle. Click "Generate Now" above to start immediately.</p></div>
                    <?php else: ?>
                    <div class="k-table-wrap">
                    <table class="k-table k-articles"><thead><tr><th>Title</th><th>Status</th><th>Quality</th><th>Pipeline</th><th>Date</th><th style="text-align:right;">Actions</th></tr></thead>
                        <tbody><?php foreach ($articles as $a):
                            $stage = $a['pipeline_stage'] ?? 'pending';
                            $error = $a['pipeline_error'] ?? '';
                            $pct = self::pipeline_pct($stage);
                        ?>
                        <tr><td><a href="<?php echo esc_url(get_edit_post_link($a['ID'])); ?>" class="k-cell-link"><?php echo esc_html($a['post_title']); ?></a></td>
                            <td><span class="k-tag <?php echo $a['post_status'] === 'publish' ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $a['post_status'] === 'publish' ? 'Published' : 'Draft'; ?></span></td>
                            <td><span class="k-col-badge k-quality"><?php echo esc_html($a['quality'] ?? '—'); ?></span></td>
                            <td style="min-width:120px;">
                                <div class="k-pipeline-bar" title="<?php echo $error ? esc_attr("Error: {$error}") : esc_attr("Stage: {$stage}"); ?>">
                                    <div class="k-pipeline-fill" style="width:<?php echo (int) $pct; ?>%;background:<?php echo $error ? 'var(--k-red)' : ($pct >= 100 ? 'var(--k-green)' : 'var(--k-accent)'); ?>;"></div>
                                    <span class="k-pipeline-label"><?php echo $error ? 'Failed' : esc_html($stage); ?></span>
                                </div>
                            </td>
                            <td class="k-text-mono"><?php echo esc_html(wp_date('M j, Y', strtotime($a['post_date']))); ?></td>
                            <td style="text-align:right;white-space:nowrap;">
                                <div class="k-action-group">
                                <?php if ($a['post_status'] !== 'publish'): ?>
                                <button class="k-btn k-btn-sm k-tag-green" onclick="articleAction(<?php echo (int) $a['ID']; ?>, 'publish')" data-k-action="<?php echo (int) $a['ID']; ?>" data-k-act="publish">Pub</button>
                                <?php endif; ?>
                                <button class="k-btn k-btn-sm k-btn-danger" onclick="articleAction(<?php echo (int) $a['ID']; ?>, 'delete')" data-k-action="<?php echo (int) $a['ID']; ?>" data-k-act="delete">×</button>
                                </div>
                            </td></tr>
                        <?php endforeach; ?></tbody>
                    </table>
                    </div><?php endif; ?>
                </div>

                <div class="k-card">
                    <div class="k-card-header"><h2>Recent Activity</h2></div>
                    <?php if (empty($recent)): ?>
                    <div class="k-empty"><div class="k-empty-icon">📄</div><p>No recent activity</p><p style="font-size:12px;color:var(--k-text-tertiary);margin-top:8px;">Activity logs appear when the system generates articles or runs maintenance tasks.</p></div>
                    <?php else: ?>
                    <div class="k-table-wrap">
                    <table class="k-table k-activity"><thead><tr><th>Level</th><th>Service</th><th>Message</th><th>Time</th></tr></thead>
                        <tbody><?php foreach ($recent as $log): $lvl = strtolower($log['level'] ?? 'info'); ?>
                        <tr><td><span class="k-tag <?php echo $lvl === 'error' ? 'k-tag-red' : ($lvl === 'warning' ? 'k-tag-yellow' : 'k-tag-blue'); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                            <td><?php echo esc_html($log['service'] ?? '—'); ?></td>
                            <td title="<?php echo esc_attr($log['message']); ?>"><?php echo mb_strlen($log['message']) > 80 ? esc_html(mb_substr($log['message'], 0, 80) . '…') : esc_html($log['message']); ?></td>
                            <td class="k-text-mono"><?php echo esc_html(wp_date('M j, H:i', strtotime($log['created_at']))); ?></td></tr>
                        <?php endforeach; ?></tbody>
                    </table>
                    </div><?php endif; ?>
                </div>
            </div>
        </div>
        <?php
    }

    private static function get_milestone_message(int $today, int $total): ?array {
        if ($total === 0 && $today === 0) {
            return ['icon' => '🚀', 'message' => 'Welcome! Your first articles will generate soon. Click "Generate Now" to start immediately.'];
        }
        if ($total === 1) {
            return ['icon' => '🎉', 'message' => 'First article published! Your AI content engine is live.'];
        }
        if ($total === 10) {
            return ['icon' => '🔥', 'message' => '10 articles published! Your site is building authority.'];
        }
        if ($total === 50) {
            return ['icon' => '⭐', 'message' => '50 articles published! Significant content milestone reached.'];
        }
        if ($total === 100) {
            return ['icon' => '🏆', 'message' => '100 articles published! Your site is becoming a topical authority.'];
        }
        return null;
    }

    private static function countdown_text(int $timestamp): string {
        $diff = max(0, $timestamp - time());
        if ($diff <= 0) return 'Now';
        $m = floor($diff / 60);
        $s = $diff % 60;
        return "{$m}m {$s}s";
    }

    /**
     * Count articles by pipeline stage for summary stats.
     */
    private static function pipeline_summary(): array {
        global $wpdb;
        $stages = $wpdb->get_results(
            "SELECT pm.meta_value AS stage, COUNT(*) AS count
             FROM {$wpdb->postmeta} pm
             INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE pm.meta_key = '_kozmo_ai_pipeline_stage'
               AND p.post_type = 'post'
             GROUP BY pm.meta_value",
            OBJECT_K
        );
        $failed = $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->postmeta}
             WHERE meta_key = '_kozmo_ai_pipeline_error'
               AND meta_value != ''"
        );
        return [
            'stages' => $stages ?: [],
            'failed' => (int) $failed,
        ];
    }

    private static function recent_articles(int $limit = 5): array {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_status, p.post_date, a.quality_score, a.pipeline_status, a.created_at
             FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->prefix}kozmo_ai_articles a ON p.ID = a.post_id
             WHERE p.post_type = 'post'
               AND (a.agent_article_id IS NOT NULL OR p.ID IN (SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_kozmo_ai_auto_generated'))
             ORDER BY COALESCE(a.created_at, p.post_date) DESC LIMIT %d", $limit
        ), ARRAY_A);
        foreach ($rows as &$r) {
            $r['quality'] = $r['quality_score'] ? round((float) $r['quality_score']) : '—';
            $r['pipeline_stage'] = get_post_meta($r['ID'], '_kozmo_ai_pipeline_stage', true) ?: ($r['pipeline_status'] ?? 'completed');
            $r['pipeline_error'] = get_post_meta($r['ID'], '_kozmo_ai_pipeline_error', true);
            $r['edit_link'] = get_edit_post_link($r['ID']);
        }
        return $rows;
    }

    public static function ajax_data(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error('Unauthorized');

        $settings = get_option('kozmo_ai_wp_settings', []);
        $queue = Worker::get_queue_stats();
        $pipeline = self::pipeline_summary();
        $pipeline_total = array_sum(array_map(function($s){return (int)$s->count;}, $pipeline['stages']));
        wp_send_json_success([
            'health'  => Health::run_checks(),
            'queue'   => $queue,
            'errors'  => HealEngine::get_error_stats(),
            'logs'    => Logger::get_stats(),
            'kb'      => KnowledgeBase::get_stats(),
            'content' => ContentAnalyzer::analyze_content_health(),
            'keywords' => ContentAnalyzer::keyword_coverage(),
            'next_run' => wp_next_scheduled('kozmo_ai_generate_articles'),
            'generation_enabled' => ($settings['enable_auto_generation'] ?? 'yes') === 'yes',
            'last_scan' => $settings['last_scan_at'] ?? '',
            'today_articles' => ContentGenerator::get_today_generation_count(),
            'daily_max' => (int) ($settings['max_articles_daily'] ?? 24),
            'recent_logs' => Logger::get_logs(5),
            'recent_articles' => self::recent_articles(5),
            'pipeline_stages' => $pipeline,
            'pipeline_count' => $pipeline_total,
            'pipeline_failed' => (int) $pipeline['failed'],
        ]);
    }

    /**
     * Map pipeline stage name to a progress percentage.
     */
    private static function pipeline_pct(string $stage): int {
        $map = [
            'queued'            => 10,
            'generating_article'=> 30,
            'scoring'           => 60,
            'publishing'        => 85,
            'completed'         => 100,
            'failed'            => 100,
        ];
        return $map[$stage] ?? 5;
    }

    /**
     * Safely call a static bool method — returns false on any error.
     */
    private static function safe_bool(string $callable): bool {
        try {
            $ref = new \ReflectionMethod($callable);
            return $ref->invoke(null);
        } catch (\Throwable $e) {
            return false;
        }
    }

    public static function render_nav(string $active): void {
        $pages = [
            'dashboard' => ['Dashboard', admin_url('admin.php?page=kozmo-ai-wp')],
            'content'   => ['Content',   admin_url('admin.php?page=kozmo-ai-wp-content')],
            'research'  => ['Research',  admin_url('admin.php?page=kozmo-ai-wp-research')],
            'seo'       => ['SEO Report', admin_url('admin.php?page=kozmo-ai-wp-seo')],
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
