<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Database {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function table(string $name): string {
        global $wpdb;
        return $wpdb->prefix . $name;
    }

    public static function run_cleanup(): void {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}kozmo_ai_logs WHERE created_at < %s",
            gmdate('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS)
        ));
    }
}
