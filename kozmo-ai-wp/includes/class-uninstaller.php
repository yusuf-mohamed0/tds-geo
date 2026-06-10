<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Uninstaller {
    public static function uninstall(): void {
        global $wpdb;
        Activator::clear_crons();

        $tables = [
            'kozmo_ai_logs',
            'kozmo_ai_api_keys',
            'kozmo_ai_knowledge',
            'kozmo_ai_queue',
            'kozmo_ai_articles',
            'kozmo_ai_errors',
        ];
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
        }

        $options = [
            'kozmo_ai_wp_settings',
            'kozmo_ai_wp_db_version',
            'kozmo_ai_wp_activated_at',
            'kozmo_ai_wp_initial_key',
            'kozmo_ai_wp_last_sync',
            'kozmo_ai_wp_scan_results',
        ];
        foreach ($options as $option) {
            delete_option($option);
        }
    }
}
