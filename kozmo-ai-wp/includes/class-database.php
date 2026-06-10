<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Database {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_cleanup', [self::class, 'run_cleanup']);
    }

    public static function table(string $name): string {
        global $wpdb;
        return $wpdb->prefix . $name;
    }

    public static function run_cleanup(): void {
        global $wpdb;

        // Clean logs older than 30 days
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}kozmo_ai_logs WHERE created_at < %s",
            gmdate('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS)
        ));

        // Clean resolved errors older than 7 days
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}kozmo_ai_errors WHERE resolved = 1 AND resolved_at < %s",
            gmdate('Y-m-d H:i:s', time() - 7 * DAY_IN_SECONDS)
        ));

        // Clean completed queue items older than 7 days
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}kozmo_ai_queue WHERE status IN ('completed','failed') AND completed_at < %s",
            gmdate('Y-m-d H:i:s', time() - 7 * DAY_IN_SECONDS)
        ));
    }

    public static function get_table_info(): array {
        global $wpdb;
        $tables = [
            'kozmo_ai_logs',
            'kozmo_ai_api_keys',
            'kozmo_ai_knowledge',
            'kozmo_ai_queue',
            'kozmo_ai_articles',
            'kozmo_ai_errors',
        ];
        $info = [];
        foreach ($tables as $t) {
            $count = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}{$t}");
            $info[$t] = (int) $count;
        }
        return $info;
    }
}
