<?php
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Database {
    private static ?self $instance = null;
    private const DB_VERSION_OPTION = 'tds_geo_db_version';
    private const DB_VERSION = 1;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        self::migrate();
    }

    public static function table(string $name): string {
        global $wpdb;
        return $wpdb->prefix . $name;
    }

    public static function run_cleanup(): void {
        global $wpdb;
        $wpdb->query($wpdb->prepare(
            "DELETE FROM {$wpdb->prefix}tds_geo_logs WHERE created_at < %s",
            gmdate('Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS)
        ));
    }

    private static function migrate(): void {
        $current = (int) get_option(self::DB_VERSION_OPTION, 0);
        if ($current >= self::DB_VERSION) return;

        global $wpdb;
        require_once ABSPATH . 'wp-admin/includes/upgrade.php';

        $charset = $wpdb->get_charset_collate();

        $tables = [];

        if ($current < 1) {
            $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tds_geo_logs (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                level VARCHAR(20) NOT NULL DEFAULT 'info',
                service VARCHAR(50) DEFAULT NULL,
                message TEXT NOT NULL,
                context LONGTEXT DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_level (level),
                INDEX idx_created (created_at)
            ) $charset;";

            $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tds_geo_api_keys (
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

            $tables[] = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}tds_geo_articles (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                post_id BIGINT UNSIGNED NOT NULL,
                agent_article_id VARCHAR(64) DEFAULT NULL,
                quality_score DECIMAL(5,2) DEFAULT 0.00,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_post_id (post_id),
                INDEX idx_agent_id (agent_article_id)
            ) $charset;";
        }

        // Future migrations go here:
        // if ($current < 2) { ... }

        foreach ($tables as $sql) {
            dbDelta($sql);
        }

        update_option(self::DB_VERSION_OPTION, self::DB_VERSION);
    }
}
