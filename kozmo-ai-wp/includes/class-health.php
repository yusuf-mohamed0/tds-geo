<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Health check system — monitors plugin and site health.
 */
class Health {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_notices', [self::class, 'admin_notices']);
    }

    public static function run_checks(): array {
        $checks = [];

        // Database
        global $wpdb;
        $db_ok = !is_wp_error($wpdb->check_database_version());
        $checks['database'] = ['status' => $db_ok ? 'healthy' : 'error'];

        // API connectivity
        $settings = get_option('kozmo_ai_wp_settings', []);
        $checks['api'] = ['status' => ($settings['api_enabled'] ?? 'yes') === 'yes' ? 'healthy' : 'disabled'];

        // Queue health
        $queue = Worker::get_queue_stats();
        $checks['queue'] = ['status' => $queue['failed'] > 10 ? 'degraded' : 'healthy', 'pending' => $queue['pending'], 'failed' => $queue['failed']];

        // Error count
        $errors = HealEngine::get_error_stats();
        $checks['errors'] = ['status' => $errors['unresolved'] > 5 ? 'degraded' : 'healthy', 'unresolved' => $errors['unresolved']];

        // Knowledge base
        $kb = KnowledgeBase::get_stats();
        $checks['knowledge'] = ['status' => $kb['total'] > 0 ? 'healthy' : 'pending', 'items' => $kb['total']];

        // Logs
        $log_stats = Logger::get_stats();
        $checks['logs'] = ['status' => ($log_stats['critical'] ?? 0) > 0 ? 'degraded' : 'healthy', 'critical' => $log_stats['critical'] ?? 0];

        // Last scan
        $last_scan = $settings['last_scan_at'] ?? '';
        $checks['last_scan'] = ['status' => !empty($last_scan) ? 'healthy' : 'pending', 'timestamp' => $last_scan];

        // Graphify knowledge graph (optional — missing file is not an error)
        try {
            $graphify = GraphifyClient::check_health();
            if ($graphify['overall'] === 'error') {
                // Missing graph file is 'disabled', not 'error' — it's optional
                $checks['graphify'] = ['status' => 'disabled'];
            } else {
                $checks['graphify'] = ['status' => $graphify['overall'] === 'healthy' ? 'healthy' : 'disabled'];
            }
        } catch (\Throwable $e) {
            $checks['graphify'] = ['status' => 'disabled'];
        }

        // Overall — only error/degraded from REQUIRED services count; optional features are excluded
        $unhealthy = count(array_filter($checks, fn($c) => $c['status'] === 'error'));
        $degraded  = count(array_filter($checks, fn($c) => $c['status'] === 'degraded'));
        $overall   = $unhealthy > 0 ? 'error' : ($degraded > 0 ? 'degraded' : 'healthy');

        return ['overall' => $overall, 'checks' => $checks, 'unhealthy' => $unhealthy, 'degraded' => $degraded];
    }

    public static function get_score(): int {
        $health = self::run_checks();
        $score = 100;
        $score -= $health['unhealthy'] * 25;
        $score -= $health['degraded'] * 10;
        return max(0, $score);
    }

    public static function admin_notices(): void {
        $screen = get_current_screen();
        if (!$screen || strpos($screen->id, 'kozmo-ai') === false) return;

        $health = self::run_checks();
        if ($health['overall'] === 'error') {
            echo '<div class="notice notice-error"><p><strong>KOZMO AI:</strong> ' .
                 esc_html__('System health check found critical issues. Check Diagnostics for details.', 'kozmo-ai-wp') .
                 '</p></div>';
        } elseif ($health['overall'] === 'degraded') {
            echo '<div class="notice notice-warning"><p><strong>KOZMO AI:</strong> ' .
                 esc_html__('Some systems are degraded. Check the dashboard for details.', 'kozmo-ai-wp') .
                 '</p></div>';
        }
    }
}
