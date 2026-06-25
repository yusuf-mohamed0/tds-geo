<?php
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Cache {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function get(string $key, $default = null) {
        $data = get_transient('tds_geo_' . $key);
        return false !== $data ? $data : $default;
    }

    public static function set(string $key, $value, int $ttl = 60): void {
        set_transient('tds_geo_' . $key, $value, $ttl);
    }
}
