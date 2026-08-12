<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Uninstaller {
    public static function uninstall(): void {
        global $wpdb;

        $tables = [
            'kivo_logs',
            'kivo_api_keys',
            'kivo_articles',
        ];
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
        }

        $options = [
            'kivo_wp_settings',
            'kivo_wp_activated_at',
            'kivo_wp_initial_key',
        ];
        foreach ($options as $option) {
            delete_option($option);
        }
    }
}
