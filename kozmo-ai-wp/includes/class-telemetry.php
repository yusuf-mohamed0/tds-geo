<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Telemetry — daily site health ping so you know how many installs are running.
 */
class Telemetry {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_telemetry_ping', [self::class, 'send_ping']);
    }

    /**
     * Collect anonymized site data for telemetry.
     */
    public static function collect(): array {
        global $wpdb;

        $settings = get_option('kozmo_ai_wp_settings', []);
        $health = Health::run_checks();
        $queue = Worker::get_queue_stats();
        $errors = HealEngine::get_error_stats();

        // Count total articles ever generated
        $total_articles = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_articles"
        );

        return [
            'site_hash'        => wp_hash(site_url('', 'http') . '__' . ABSPATH),
            'plugin_version'   => KOZMO_AI_WP_VERSION,
            'php_version'      => PHP_VERSION,
            'wp_version'       => get_bloginfo('version'),
            'mysql_version'    => $wpdb->db_version(),
            'health_overall'   => $health['overall'] ?? 'unknown',
            'articles_today'   => ContentGenerator::get_today_generation_count(),
            'articles_total'   => $total_articles,
            'queue_pending'    => $queue['pending'] ?? 0,
            'queue_failed'     => $queue['failed'] ?? 0,
            'errors_unresolved' => $errors['unresolved'] ?? 0,
            'gen_enabled'      => ($settings['enable_auto_generation'] ?? 'yes') === 'yes',
            'is_multisite'     => is_multisite(),
            'locale'           => get_locale(),
            'themes_count'     => count(wp_get_themes()),
            'plugins_count'    => count(get_option('active_plugins', [])),
            'timestamp'        => current_time('c'),
        ];
    }

    /**
     * Send daily telemetry ping to configured endpoint.
     */
    public static function send_ping(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $endpoint = $settings['telemetry_url'] ?? '';
        if (empty($endpoint)) return;

        $data = self::collect();
        $data['type'] = 'ping';

        $response = wp_remote_post($endpoint, [
            'timeout'   => 15,
            'headers'   => ['Content-Type' => 'application/json', 'User-Agent' => 'KOZMO-AI-Telemetry/1.0'],
            'body'      => wp_json_encode($data),
        ]);

        if (is_wp_error($response)) {
            Logger::debug('Telemetry ping failed', ['error' => $response->get_error_message()]);
            return;
        }

        update_option('kozmo_ai_last_telemetry', current_time('mysql'));
        Logger::debug('Telemetry ping sent', ['endpoint' => parse_url($endpoint, PHP_URL_HOST), 'code' => wp_remote_retrieve_response_code($response)]);
    }

    /**
     * Schedule the daily telemetry cron if configured.
     */
    public static function schedule(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $endpoint = $settings['telemetry_url'] ?? '';
        if (empty($endpoint)) {
            self::clear_schedule();
            return;
        }
        if (!wp_next_scheduled('kozmo_ai_telemetry_ping')) {
            wp_schedule_event(time() + DAY_IN_SECONDS, 'daily', 'kozmo_ai_telemetry_ping');
        }
    }

    /**
     * Remove the telemetry cron.
     */
    public static function clear_schedule(): void {
        $ts = wp_next_scheduled('kozmo_ai_telemetry_ping');
        if ($ts) wp_unschedule_event($ts, 'kozmo_ai_telemetry_ping');
    }

    /**
     * Get last ping time (for settings display).
     */
    public static function last_ping(): string {
        $last = get_option('kozmo_ai_last_telemetry', '');
        return $last ?: 'Never';
    }
}
