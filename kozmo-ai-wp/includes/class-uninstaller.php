<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Uninstaller {
    public static function uninstall(): void {
        global $wpdb;

        $tables = [
            'kozmo_ai_logs',
            'kozmo_ai_api_keys',
        ];
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
        }

        $options = [
            'kozmo_ai_wp_settings',
            'kozmo_ai_wp_activated_at',
            'kozmo_ai_wp_initial_key',
        ];
        foreach ($options as $option) {
            delete_option($option);
        }
    }
}
