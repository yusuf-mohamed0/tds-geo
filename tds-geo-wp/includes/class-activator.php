<?php
/**
 * Plugin activation handler — thin connector tables.
 *
 * @package TdsGeo_WP
 */

namespace TdsGeo_WP;

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
            $errors[] = 'Migration from tds-geo-wp failed: ' . $e->getMessage();
        }

        if (!empty($errors)) {
            set_transient('tds_geo_wp_activation_notice', $errors, 30);
        }
    }

    private static function create_tables(): void {
        Database::init();
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

        $existing = get_option('tds_geo_wp_settings', null);
        if (!is_array($existing)) {
            add_option('tds_geo_wp_settings', $defaults, '', 'yes');
        }

        if (!get_option('tds_geo_wp_initial_key')) {
            $api_key = 'kai_' . bin2hex(tds_geo_wp_random_bytes(24));
            add_option('tds_geo_wp_initial_key', $api_key, '', 'no');

            global $wpdb;
            $wpdb->insert(
                $wpdb->prefix . 'tds_geo_api_keys',
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

        $core_log_table = $wpdb->prefix . 'tds_geo_logs';
        $core_keys_table = $wpdb->prefix . 'tds_geo_api_keys';
        $has_core_tables = $wpdb->get_var("SHOW TABLES LIKE '{$core_log_table}'");

        if (empty($has_core_tables)) return;

        // Migrate API keys: mark existing tds_geo keys, copy core keys
        $ai_keys_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}tds_geo_api_keys");
        if ($ai_keys_count === 0) {
            $wpdb->query(
                "INSERT IGNORE INTO {$wpdb->prefix}tds_geo_api_keys
                 (api_key, api_key_hash, label, permissions, is_active, last_used_at, expires_at, created_by, created_at)
                 SELECT api_key, api_key_hash, label, permissions, is_active, last_used_at, expires_at, created_by, created_at
                 FROM {$core_keys_table}"
            );
        }

        // Migrate core settings
        $core_settings = get_option('tds_geo_settings', null);
        if (is_array($core_settings)) {
            $ai_settings = get_option('tds_geo_wp_settings', []);
            foreach (['api_enabled', 'log_level', 'default_status', 'default_author', 'webhook_secret', 'debug_mode'] as $key) {
                if (!isset($ai_settings[$key]) && isset($core_settings[$key])) {
                    $ai_settings[$key] = $core_settings[$key];
                }
            }
            if (!isset($ai_settings['enable_webhooks'])) {
                $ai_settings['enable_webhooks'] = $core_settings['enable_webhooks'] ?? 'no';
            }
            update_option('tds_geo_wp_settings', $ai_settings);
        }

        // Migrate initial key
        $core_initial = get_option('tds_geo_initial_api_key', '');
        if (!empty($core_initial) && !get_option('tds_geo_wp_initial_key', '')) {
            add_option('tds_geo_wp_initial_key', $core_initial, '', 'no');
        }
    }
}
