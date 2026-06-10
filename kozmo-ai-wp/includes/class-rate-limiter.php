<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class RateLimiter {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function check(string $key, int $max_requests = 60, int $window = 60): bool {
        $cache_key = 'ratelimit_' . md5($key);
        $data = Cache::get($cache_key, ['count' => 0, 'reset' => time() + $window]);

        if ($data['reset'] < time()) {
            $data = ['count' => 0, 'reset' => time() + $window];
        }

        $data['count']++;
        Cache::set($cache_key, $data, $window);

        return $data['count'] <= $max_requests;
    }

    public static function remaining(string $key, int $max_requests = 60, int $window = 60): int {
        $cache_key = 'ratelimit_' . md5($key);
        $data = Cache::get($cache_key, ['count' => 0, 'reset' => time() + $window]);
        if ($data['reset'] < time()) return $max_requests;
        return max(0, $max_requests - $data['count']);
    }

    public static function get_reset_time(string $key): int {
        $cache_key = 'ratelimit_' . md5($key);
        $data = Cache::get($cache_key, ['count' => 0, 'reset' => time()]);
        return $data['reset'];
    }

    public static function middleware(string $key, int $max = 60, int $window = 60): bool {
        if (!self::check($key, $max, $window)) {
            Logger::warning('Rate limit exceeded', ['key' => $key]);
            return false;
        }
        return true;
    }
}
