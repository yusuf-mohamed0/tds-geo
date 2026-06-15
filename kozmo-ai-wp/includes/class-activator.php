<?php
/**
 * Plugin activation handler.
 *
 * @package KozmoAI_WP
 */

namespace KozmoAI_WP;

defined('ABSPATH') || exit;

class Activator {

    public static function activate(): void {
        $errors = [];

        try {
            self::create_tables();
        } catch (\Throwable $e) {
            $errors[] = 'Table creation failed: ' . $e->getMessage();
        }

        try {
            self::set_defaults();
        } catch (\Throwable $e) {
            $errors[] = 'Default setup failed: ' . $e->getMessage();
        }

        try {
            self::schedule_crons();
        } catch (\Throwable $e) {
            $errors[] = 'Cron scheduling failed: ' . $e->getMessage();
        }

        try {
            self::trigger_initial_scan();
        } catch (\Throwable $e) {
            $errors[] = 'Initial scan trigger failed: ' . $e->getMessage();
        }

        update_option('kozmo_ai_wp_db_version', KOZMO_AI_WP_DB_VERSION);
        update_option('kozmo_ai_wp_activated_at', current_time('mysql'));

        if (!empty($errors)) {
            update_option('kozmo_ai_wp_activation_errors', $errors, false);
            set_transient('kozmo_ai_wp_activation_notice', $errors, 30);
        }
    }

    private static function create_tables(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        // Activity log
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            level VARCHAR(20) NOT NULL DEFAULT 'info',
            service VARCHAR(50) DEFAULT NULL,
            message TEXT NOT NULL,
            context LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_service (service),
            INDEX idx_created (created_at)
        ) $charset;";

        // API keys
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_api_keys (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            api_key VARCHAR(64) NOT NULL UNIQUE,
            label VARCHAR(100) DEFAULT NULL,
            permissions VARCHAR(255) NOT NULL DEFAULT 'read,write',
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            last_used_at DATETIME DEFAULT NULL,
            expires_at DATETIME DEFAULT NULL,
            created_by BIGINT UNSIGNED DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_key (api_key),
            INDEX idx_active (is_active)
        ) $charset;";

        // Knowledge base — stores website scan data
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_knowledge (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            data_type VARCHAR(50) NOT NULL,
            data_key VARCHAR(255) NOT NULL,
            data_value LONGTEXT NOT NULL,
            checksum VARCHAR(64) DEFAULT NULL,
            synced TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_type_key (data_type, data_key),
            INDEX idx_type (data_type),
            INDEX idx_synced (synced)
        ) $charset;";

        // Queue / tasks
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_queue (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            task_type VARCHAR(50) NOT NULL,
            task_data LONGTEXT NOT NULL,
            priority INT NOT NULL DEFAULT 10,
            status VARCHAR(20) NOT NULL DEFAULT 'pending',
            retries INT NOT NULL DEFAULT 0,
            max_retries INT NOT NULL DEFAULT 3,
            error_message TEXT DEFAULT NULL,
            scheduled_at DATETIME DEFAULT NULL,
            started_at DATETIME DEFAULT NULL,
            completed_at DATETIME DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status),
            INDEX idx_type (task_type),
            INDEX idx_scheduled (scheduled_at)
        ) $charset;";

        // Published articles tracking
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_articles (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            agent_article_id VARCHAR(64) DEFAULT NULL,
            pipeline_status VARCHAR(50) DEFAULT 'pending',
            quality_score DECIMAL(5,2) DEFAULT 0,
            seo_score DECIMAL(5,2) DEFAULT 0,
            pipeline_data LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uk_post (post_id),
            INDEX idx_agent (agent_article_id),
            INDEX idx_pipeline (pipeline_status)
        ) $charset;";

        // Diagnostics / self-healing
        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_errors (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            error_code VARCHAR(100) NOT NULL,
            error_message TEXT NOT NULL,
            error_context LONGTEXT DEFAULT NULL,
            severity VARCHAR(20) NOT NULL DEFAULT 'warning',
            auto_healed TINYINT(1) NOT NULL DEFAULT 0,
            resolved TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME DEFAULT NULL,
            INDEX idx_code (error_code),
            INDEX idx_severity (severity),
            INDEX idx_resolved (resolved)
        ) $charset;";

        foreach ($tables as $sql) {
            dbDelta($sql);
        }
    }

    private static function set_defaults(): void {
        $defaults = [
            'api_enabled'        => 'yes',
            'log_level'          => 'info',
            'agent_url'          => KOZMO_AI_WP_AGENT_URL,
            'auto_discover'      => 'yes',
            'auto_publish'       => 'yes',
            'min_quality_score'  => 95,
            'auto_fix_errors'    => 'yes',
            'cron_interval'      => 'kozmo_ai_every_15min',
            'max_articles_daily' => 10,
            'enable_webhooks'    => 'yes',
            'webhook_secret'     => '',
            'debug_mode'         => 'no',
            'last_scan_at'       => '',
            'last_sync_at'       => '',
        ];

        if (!get_option('kozmo_ai_wp_settings')) {
            add_option('kozmo_ai_wp_settings', $defaults, '', 'yes');
        }

        // Auto-generate initial API key
        if (!get_option('kozmo_ai_wp_initial_key')) {
            $api_key = 'kai_' . bin2hex(kozmo_ai_wp_random_bytes(24));
            add_option('kozmo_ai_wp_initial_key', $api_key, '', 'no');

            global $wpdb;
            $wpdb->insert(
                $wpdb->prefix . 'kozmo_ai_api_keys',
                [
                    'api_key'     => $api_key,
                    'label'       => 'Auto-generated (activation)',
                    'permissions' => 'read,write,admin',
                    'is_active'   => 1,
                    'created_by'  => get_current_user_id() ?: 1,
                ],
                ['%s', '%s', '%s', '%d', '%d']
            );
        }
    }

    private static function schedule_crons(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $interval = $settings['cron_interval'] ?? 'kozmo_ai_every_15min';

        if (!wp_next_scheduled('kozmo_ai_heartbeat')) {
            wp_schedule_event(time() + 60, $interval, 'kozmo_ai_heartbeat');
        }
        if (!wp_next_scheduled('kozmo_ai_scan')) {
            wp_schedule_event(time() + 300, 'kozmo_ai_twice_daily', 'kozmo_ai_scan');
        }
        if (!wp_next_scheduled('kozmo_ai_maintenance')) {
            wp_schedule_event(time() + 600, 'twicedaily', 'kozmo_ai_maintenance');
        }
        if (!wp_next_scheduled('kozmo_ai_sync')) {
            wp_schedule_event(time() + 900, 'hourly', 'kozmo_ai_sync');
        }
        if (!wp_next_scheduled('kozmo_ai_cleanup')) {
            wp_schedule_event(time() + 3600, 'daily', 'kozmo_ai_cleanup');
        }
    }

    private static function trigger_initial_scan(): void {
        // Queue a full website scan
        global $wpdb;
        $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_queue',
            [
                'task_type'    => 'full_scan',
                'task_data'    => json_encode(['trigger' => 'activation', 'full' => true]),
                'priority'     => 1,
                'status'       => 'pending',
                'scheduled_at' => current_time('mysql'),
            ],
            ['%s', '%s', '%d', '%s', '%s']
        );
    }

    /**
     * Remove all scheduled cron events.
     */
    public static function clear_crons(): void {
        $hooks = [
            'kozmo_ai_heartbeat',
            'kozmo_ai_scan',
            'kozmo_ai_maintenance',
            'kozmo_ai_sync',
            'kozmo_ai_cleanup',
        ];
        foreach ($hooks as $hook) {
            $timestamp = wp_next_scheduled($hook);
            if ($timestamp) {
                wp_unschedule_event($timestamp, $hook);
            }
        }
    }
}
