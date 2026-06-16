<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class SeoReport {

    public static function generate(): array {
        $health = Health::run_checks();
        $content_health = ContentAnalyzer::analyze_content_health();
        $keyword_coverage = ContentAnalyzer::keyword_coverage();
        $queue = Worker::get_queue_stats();
        $settings = get_option('kozmo_ai_wp_settings', []);
        $site_name = get_bloginfo('name');
        $site_url = get_bloginfo('url');
        $site_desc = get_bloginfo('description');
        $wp_version = get_bloginfo('version');
        $php_version = PHP_VERSION;
        $article_count = wp_count_posts('post')->publish ?? 0;
        $today_count = ContentGenerator::get_today_generation_count();

        global $wpdb;
        $avg_quality = $wpdb->get_var("SELECT AVG(quality_score) FROM {$wpdb->prefix}kozmo_ai_articles WHERE quality_score > 0");
        $total_ai = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_articles");

        $pagespeed = self::estimate_pagespeed();

        return [
            'generated_at'    => current_time('mysql'),
            'site_name'       => $site_name,
            'site_url'        => $site_url,
            'site_description'=> $site_desc,
            'wp_version'      => $wp_version,
            'php_version'     => $php_version,
            'health_score'    => $health['score'] ?? 100,
            'health_status'   => $health['overall'] ?? 'healthy',
            'health_checks'   => $health['checks'] ?? [],
            'article_stats'   => [
                'total_published' => (int) $article_count,
                'ai_generated'    => (int) $total_ai,
                'today_generated' => $today_count,
                'avg_quality'     => $avg_quality ? round((float) $avg_quality, 1) : 0,
            ],
            'content_health'  => $content_health,
            'keyword_coverage'=> $keyword_coverage,
            'queue_stats'     => $queue,
            'settings'        => [
                'model'       => $settings['openai_model'] ?? 'gpt-4o',
                'frequency'   => $settings['generation_frequency'] ?? 'every_15min',
                'daily_max'   => (int) ($settings['max_articles_daily'] ?? 24),
                'draft_mode'  => ($settings['generate_as_draft'] ?? 'no') === 'yes',
                'auto_gen'    => ($settings['enable_auto_generation'] ?? 'yes') === 'yes',
            ],
            'pagespeed_estimate' => $pagespeed,
            'recommendations' => self::generate_recommendations($health, $content_health, $avg_quality),
        ];
    }

    public static function render_html(): string {
        $report = self::generate();
        $grade = $report['health_score'] >= 90 ? 'A' : ($report['health_score'] >= 75 ? 'B' : ($report['health_score'] >= 60 ? 'C' : 'D'));
        $color = $report['health_score'] >= 90 ? '#34d399' : ($report['health_score'] >= 75 ? '#f59e0b' : '#ef4444');

        ob_start();
        ?>
        <!DOCTYPE html>
        <html><head><meta charset="utf-8"><title>SEO Report — <?php echo esc_html($report['site_name']); ?></title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; background:#0b0b12; color:#eaeaf2; padding:40px; }
            .wrap { max-width:900px; margin:0 auto; }
            h1 { font-size:28px; font-weight:700; margin-bottom:4px; }
            h2 { font-size:16px; font-weight:600; color:#8888aa; margin:32px 0 12px 0; padding-bottom:8px; border-bottom:1px solid #24243d; }
            .sub { color:#5c5c7a; font-size:14px; margin-bottom:24px; }
            .score-ring { display:inline-flex; width:80px; height:80px; border-radius:50%; align-items:center; justify-content:center; font-size:28px; font-weight:800; border:4px solid <?php echo $color; ?>; color:<?php echo $color; ?>; margin-bottom:8px; }
            .grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .card { background:#161625; border:1px solid #24243d; border-radius:12px; padding:16px; }
            .card .lbl { font-size:11px; color:#5c5c7a; text-transform:uppercase; letter-spacing:.03em; }
            .card .val { font-size:18px; font-weight:600; color:#eaeaf2; margin-top:2px; }
            .check { display:flex; align-items:center; gap:8px; font-size:13px; padding:4px 0; }
            .dot { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
            .dot.green { background:#34d399; }
            .dot.yellow { background:#f59e0b; }
            .dot.red { background:#ef4444; }
            .rec { padding:10px 14px; background:rgba(95,251,241,0.08); border:1px solid rgba(95,251,241,0.2); border-radius:8px; margin-bottom:8px; font-size:13px; color:#5ffbf1; }
            .rec.issue { background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.2); color:#ef4444; }
            .footer { margin-top:40px; padding-top:16px; border-top:1px solid #24243d; font-size:11px; color:#5c5c7a; }
        </style>
        </head><body>
        <div class="wrap">
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px;">
                <div style="text-align:center;"><div class="score-ring"><?php echo $grade; ?></div><div style="font-size:12px;color:#5c5c7a;">Grade</div></div>
                <div><h1>SEO Report</h1><div class="sub"><?php echo esc_html($report['site_name']); ?> — <?php echo esc_html($report['generated_at']); ?></div></div>
            </div>

            <h2>Health Overview</h2>
            <div class="grid">
                <div class="card"><div class="lbl">Health Score</div><div class="val"><?php echo (int) $report['health_score']; ?>/100</div></div>
                <div class="card"><div class="lbl">Status</div><div class="val"><?php echo esc_html(ucfirst($report['health_status'])); ?></div></div>
                <div class="card"><div class="lbl">Total Articles</div><div class="val"><?php echo (int) $report['article_stats']['total_published']; ?></div></div>
                <div class="card"><div class="lbl">AI Generated</div><div class="val"><?php echo (int) $report['article_stats']['ai_generated']; ?></div></div>
                <div class="card"><div class="lbl">Avg Quality</div><div class="val"><?php echo (float) $report['article_stats']['avg_quality']; ?>/100</div></div>
                <div class="card"><div class="lbl">Today Generated</div><div class="val"><?php echo (int) $report['article_stats']['today_generated']; ?></div></div>
                <div class="card"><div class="lbl">Site Speed Estimate</div><div class="val"><?php echo esc_html($report['pagespeed_estimate']); ?></div></div>
                <div class="card"><div class="lbl">PHP / WP</div><div class="val">PHP <?php echo esc_html($report['php_version']); ?> / WP <?php echo esc_html($report['wp_version']); ?></div></div>
            </div>

            <h2>Health Checks</h2>
            <?php foreach ($report['health_checks'] as $name => $check): $dot = $check['status'] === 'healthy' ? 'green' : ($check['status'] === 'degraded' ? 'yellow' : 'red'); ?>
            <div class="check"><span class="dot <?php echo $dot; ?>"></span><?php echo esc_html(ucfirst($name)); ?> — <?php echo esc_html($check['status']); ?></div>
            <?php endforeach; ?>

            <h2>Content Analysis</h2>
            <div class="grid">
                <?php foreach ([
                    'thin_content' => 'Thin Content', 'duplicate_titles' => 'Duplicate Titles',
                    'no_featured_images' => 'No Featured Images', 'no_meta_titles' => 'Missing Meta Titles',
                    'old_posts' => 'Outdated Content'
                ] as $key => $label): ?>
                <div class="card"><div class="lbl"><?php echo $label; ?></div><div class="val"><?php echo (int) ($report['content_health'][$key] ?? 0); ?></div></div>
                <?php endforeach; ?>
            </div>

            <h2>Keyword Coverage</h2>
            <div class="grid">
                <div class="card"><div class="lbl">Categories</div><div class="val"><?php echo (int) ($report['keyword_coverage']['total_cats'] ?? 0); ?></div></div>
                <div class="card"><div class="lbl">Tags</div><div class="val"><?php echo (int) ($report['keyword_coverage']['total_tags'] ?? 0); ?></div></div>
            </div>

            <h2>Queue & Pipeline</h2>
            <div class="grid">
                <div class="card"><div class="lbl">Pending Tasks</div><div class="val"><?php echo (int) ($report['queue_stats']['pending'] ?? 0); ?></div></div>
                <div class="card"><div class="lbl">Failed Tasks</div><div class="val"><?php echo (int) ($report['queue_stats']['failed'] ?? 0); ?></div></div>
            </div>

            <h2>Settings</h2>
            <div class="grid">
                <div class="card"><div class="lbl">AI Model</div><div class="val"><?php echo esc_html($report['settings']['model']); ?></div></div>
                <div class="card"><div class="lbl">Frequency</div><div class="val"><?php echo esc_html($report['settings']['frequency']); ?></div></div>
                <div class="card"><div class="lbl">Daily Max</div><div class="val"><?php echo (int) $report['settings']['daily_max']; ?></div></div>
                <div class="card"><div class="lbl">Mode</div><div class="val"><?php echo $report['settings']['draft_mode'] ? 'Draft' : 'Published'; ?></div></div>
            </div>

            <h2>Recommendations</h2>
            <?php foreach ($report['recommendations'] as $rec): $is_issue = strpos($rec, 'Fix') === 0 || strpos($rec, 'Increase') === 0 || strpos($rec, 'Add') === 0 || strpos($rec, 'Reduce') === 0; ?>
            <div class="rec <?php echo $is_issue ? 'issue' : ''; ?>"><?php echo esc_html($rec); ?></div>
            <?php endforeach; ?>

            <div class="footer">Generated by KOZMO AI v<?php echo esc_html(KOZMO_AI_WP_VERSION); ?> | <?php echo esc_url($report['site_url']); ?></div>
        </div>
        </body></html>
        <?php
        return ob_get_clean();
    }

    public static function download(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        $html = self::render_html();
        $site_name = sanitize_title(get_bloginfo('name'));
        $date = gmdate('Y-m-d');
        header('Content-Type: text/html; charset=utf-8');
        header('Content-Disposition: attachment; filename="seo-report-' . $site_name . '-' . $date . '.html"');
        header('Content-Length: ' . strlen($html));
        echo $html;
        exit;
    }

    private static function generate_recommendations(array $health, array $content_health, $avg_quality): array {
        $recs = [];

        if (($health['score'] ?? 100) < 80) {
            $recs[] = 'Overall health score is low (' . (int) ($health['score'] ?? 100) . '/100). Check individual health checks above.';
        }
        if (!empty($content_health['thin_content'])) {
            $recs[] = 'Fix ' . (int) $content_health['thin_content'] . ' thin content articles (expand to 500+ words).';
        }
        if (!empty($content_health['duplicate_titles'])) {
            $recs[] = 'Fix ' . (int) $content_health['duplicate_titles'] . ' duplicate title groups.';
        }
        if (!empty($content_health['no_featured_images'])) {
            $recs[] = 'Add featured images to ' . (int) $content_health['no_featured_images'] . ' articles.';
        }
        if (!empty($content_health['old_posts'])) {
            $recs[] = 'Update ' . (int) $content_health['old_posts'] . ' outdated articles (not modified in 6+ months).';
        }
        if ($avg_quality && $avg_quality < 85) {
            $recs[] = 'Improve average article quality (' . round((float) $avg_quality, 1) . '/100). Consider adjusting generation prompts.';
        }

        return $recs;
    }

    private static function estimate_pagespeed(): string {
        $cache = 'Unknown';
        if (defined('WP_CACHE') && WP_CACHE) $cache = 'WP_CACHE enabled';
        if (defined('W3TC') || defined('WPNXCACHE') || defined('WP_ROCKET_VERSION') || defined('LSCWP_V')) {
            $cache = 'Caching plugin detected';
        }
        $images = wp_count_attachments();
        $total_images = array_sum((array) $images);
        return $cache . ' | ' . number_format($total_images) . ' media files';
    }
}
