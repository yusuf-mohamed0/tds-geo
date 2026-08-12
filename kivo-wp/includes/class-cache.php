<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Cache {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function get(string $key, $default = null) {
        $data = get_transient('kivo_' . $key);
        return false !== $data ? $data : $default;
    }

    public static function set(string $key, $value, int $ttl = 60): void {
        set_transient('kivo_' . $key, $value, $ttl);
    }
}
