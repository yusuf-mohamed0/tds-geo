<?php
/**
 * Plugin activation handler — thin connector tables.
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
            self::migrate_from_core_wp();
        } catch (\Throwable $e) {
            $errors[] = 'Migration from kozmo-core-wp failed: ' . $e->getMessage();
        }

        if (!empty($errors)) {
            set_transient('kozmo_ai_wp_activation_notice', $errors, 30);
        }
    }

    private static function create_tables(): void {
        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_logs (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            level VARCHAR(20) NOT NULL DEFAULT 'info',
            service VARCHAR(50) DEFAULT NULL,
            message TEXT NOT NULL,
            context LONGTEXT DEFAULT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_level (level),
            INDEX idx_created (created_at)
        ) $charset;";

        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_api_keys (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            api_key VARCHAR(64) DEFAULT NULL UNIQUE,
            api_key_hash VARCHAR(255) DEFAULT NULL,
            api_key_encrypted TEXT DEFAULT NULL,
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

        $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kozmo_ai_articles (
            id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            post_id BIGINT UNSIGNED NOT NULL,
            agent_article_id VARCHAR(64) DEFAULT NULL,
            quality_score DECIMAL(5,2) DEFAULT 0.00,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_post_id (post_id),
            INDEX idx_agent_id (agent_article_id)
        ) $charset;";

        foreach ($tables as $sql) {
            dbDelta($sql);
        }
    }

    private static function set_defaults(): void {
        $defaults = [
            'api_enabled'     => 'yes',
            'log_level'       => 'info',
            'enable_webhooks' => 'yes',
            'webhook_secret'  => '',
            'debug_mode'      => 'no',
            'default_status'  => 'draft',
            'default_author'  => get_current_user_id() ?: 1,
            'auto_import_tags' => 'yes',
            'auto_import_cats' => 'yes',
        ];

        $existing = get_option('kozmo_ai_wp_settings', null);
        if (!is_array($existing)) {
            add_option('kozmo_ai_wp_settings', $defaults, '', 'yes');
        }

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

    private static function migrate_from_core_wp(): void {
        global $wpdb;

        $core_log_table = $wpdb->prefix . 'kozmo_core_logs';
        $core_keys_table = $wpdb->prefix . 'kozmo_core_api_keys';
        $has_core_tables = $wpdb->get_var("SHOW TABLES LIKE '{$core_log_table}'");

        if (empty($has_core_tables)) return;

        // Migrate API keys: mark existing kozmo_ai keys, copy core keys
        $ai_keys_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_api_keys");
        if ($ai_keys_count === 0) {
            $wpdb->query(
                "INSERT IGNORE INTO {$wpdb->prefix}kozmo_ai_api_keys
                 (api_key, api_key_hash, label, permissions, is_active, last_used_at, expires_at, created_by, created_at)
                 SELECT api_key, api_key_hash, label, permissions, is_active, last_used_at, expires_at, created_by, created_at
                 FROM {$core_keys_table}"
            );
        }

        // Migrate core settings
        $core_settings = get_option('kozmo_core_settings', null);
        if (is_array($core_settings)) {
            $ai_settings = get_option('kozmo_ai_wp_settings', []);
            foreach (['api_enabled', 'log_level', 'default_status', 'default_author', 'webhook_secret', 'debug_mode'] as $key) {
                if (!isset($ai_settings[$key]) && isset($core_settings[$key])) {
                    $ai_settings[$key] = $core_settings[$key];
                }
            }
            if (!isset($ai_settings['enable_webhooks'])) {
                $ai_settings['enable_webhooks'] = $core_settings['enable_webhooks'] ?? 'no';
            }
            update_option('kozmo_ai_wp_settings', $ai_settings);
        }

        // Migrate initial key
        $core_initial = get_option('kozmo_core_initial_api_key', '');
        if (!empty($core_initial) && !get_option('kozmo_ai_wp_initial_key', '')) {
            add_option('kozmo_ai_wp_initial_key', $core_initial, '', 'no');
        }
    }
}
