<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Cache {
    private static ?self $instance = null;
    private static string $group = 'kozmo_ai_wp';
    private static int $default_ttl = 3600;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function get(string $key, $default = null) {
        $value = wp_cache_get($key, self::$group);
        return false !== $value ? $value : $default;
    }

    public static function set(string $key, $value, int $ttl = 0): bool {
        return wp_cache_set($key, $value, self::$group, $ttl ?: self::$default_ttl);
    }

    public static function delete(string $key): bool {
        return wp_cache_delete($key, self::$group);
    }

    public static function flush(): bool {
        if (function_exists('wp_cache_flush_group')) {
            return wp_cache_flush_group(self::$group);
        }
        // Fallback for WP < 6.1
        return wp_cache_flush();
    }

    public static function remember(string $key, callable $callback, int $ttl = 0) {
        $cached = self::get($key);
        if (null !== $cached) return $cached;
        $value = $callback();
        self::set($key, $value, $ttl);
        return $value;
    }

    public static function get_transient(string $key, $default = null) {
        $value = get_transient('kozmo_ai_' . $key);
        return false !== $value ? $value : $default;
    }

    public static function set_transient(string $key, $value, int $ttl = 0): bool {
        return set_transient('kozmo_ai_' . $key, $value, $ttl ?: self::$default_ttl);
    }

    public static function delete_transient(string $key): bool {
        return delete_transient('kozmo_ai_' . $key);
    }

    public static function clear_all_transients(): void {
        global $wpdb;
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_kozmo_ai_%'");
        $wpdb->query("DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_timeout_kozmo_ai_%'");
    }
}
