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
            'tds_geo_logs',
            'tds_geo_api_keys',
            'tds_geo_articles',
        ];
        foreach ($tables as $table) {
            $wpdb->query("DROP TABLE IF EXISTS {$wpdb->prefix}{$table}");
        }

        $options = [
            'tds_geo_wp_settings',
            'tds_geo_wp_activated_at',
            'tds_geo_wp_initial_key',
        ];
        foreach ($options as $option) {
            delete_option($option);
        }
    }
}
