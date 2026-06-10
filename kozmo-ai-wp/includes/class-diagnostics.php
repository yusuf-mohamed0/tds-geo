<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Diagnostics — system info, troubleshooting, and performance metrics.
 */
class Diagnostics {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function get_system_info(): array {
        global $wpdb;

        $memory_limit = wp_convert_hr_to_bytes(WP_MEMORY_LIMIT);
        $memory_usage = function_exists('memory_get_usage') ? memory_get_usage(true) : 0;

        return [
            'plugin' => [
                'version' => KOZMO_AI_WP_VERSION,
                'db_version' => get_option('kozmo_ai_wp_db_version'),
                'activated_at' => get_option('kozmo_ai_wp_activated_at'),
                'initial_key_set' => !empty(get_option('kozmo_ai_wp_initial_key')),
            ],
            'wordpress' => [
                'version' => get_bloginfo('version'),
                'multisite' => is_multisite(),
                'site_url' => get_bloginfo('url'),
                'home_url' => get_bloginfo('wpurl'),
                'locale' => get_locale(),
                'timezone' => wp_timezone_string(),
                'permalink' => get_option('permalink_structure'),
                'debug_mode' => defined('WP_DEBUG') && WP_DEBUG,
                'cron_status' => defined('DISABLE_WP_CRON') && DISABLE_WP_CRON ? 'disabled' : 'enabled',
            ],
            'server' => [
                'php_version' => PHP_VERSION,
                'php_max_execution' => ini_get('max_execution_time'),
                'php_max_input' => ini_get('max_input_time'),
                'php_memory_limit' => size_format($memory_limit),
                'php_memory_usage' => $memory_usage ? size_format($memory_usage) : 'unknown',
                'php_post_max' => ini_get('post_max_size'),
                'php_upload_max' => ini_get('upload_max_filesize'),
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
                'mysql_version' => $wpdb->db_version(),
                'object_cache' => wp_using_ext_object_cache(),
            ],
            'tables' => Database::get_table_info(),
            'queue' => Worker::get_queue_stats(),
            'errors' => HealEngine::get_error_stats(),
            'knowledge' => KnowledgeBase::get_stats(),
            'logs' => Logger::get_stats(),
            'health' => Health::run_checks(),
        ];
    }
}
