<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Logger {
    private static ?self $instance = null;
    private static array $level_priority = [
        'debug'    => 0,
        'info'     => 1,
        'notice'   => 2,
        'warning'  => 3,
        'error'    => 4,
        'critical' => 5,
    ];
    private static string $min_level = 'info';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        $settings = get_option('kivo_wp_settings', []);
        self::$min_level = $settings['log_level'] ?? 'info';
    }

    public static function debug(string $message, array $context = []): void  { self::log('debug', $message, $context); }
    public static function info(string $message, array $context = []): void   { self::log('info', $message, $context); }
    public static function notice(string $message, array $context = []): void { self::log('notice', $message, $context); }
    public static function warning(string $message, array $context = []): void { self::log('warning', $message, $context); }
    public static function error(string $message, array $context = []): void   { self::log('error', $message, $context); }
    public static function critical(string $message, array $context = []): void { self::log('critical', $message, $context); }

    private static function log(string $level, string $message, array $context = []): void {
        global $wpdb;

        $config_priority = self::$level_priority[self::$min_level] ?? 1;
        $msg_priority = self::$level_priority[$level] ?? 0;
        if ($msg_priority < $config_priority) return;

        $message = mb_substr($message, 0, 2000);
        $context_safe = self::sanitize_context($context);

        $wpdb->insert(
            $wpdb->prefix . 'kivo_logs',
            [
                'level'      => $level,
                'service'    => $context['service'] ?? 'core',
                'message'    => $message,
                'context'    => wp_json_encode($context_safe),
                'created_at' => current_time('mysql'),
            ],
            ['%s', '%s', '%s', '%s', '%s']
        );

        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log(sprintf(
                '[Kivo Geo] %s: %s %s',
                strtoupper($level),
                $message,
                $context_safe ? wp_json_encode($context_safe) : ''
            ));
        }
    }

    private static function sanitize_context(array $context): array {
        $sensitive = ['api_key', 'password', 'secret', 'token', 'authorization', 'access_token'];
        $safe = [];
        foreach ($context as $key => $value) {
            if (in_array(strtolower($key), $sensitive, true)) {
                $safe[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $safe[$key] = self::sanitize_context($value);
            } elseif (is_scalar($value) || is_null($value)) {
                $safe[$key] = $value;
            } else {
                $safe[$key] = wp_json_encode($value);
            }
        }
        return $safe;
    }

    public static function get_logs(int $limit = 100, string $level = '', string $service = ''): array {
        global $wpdb;
        $table = $wpdb->prefix . 'kivo_logs';
        $where = [];
        $params = [];

        if (!empty($level)) {
            $where[] = 'level = %s';
            $params[] = $level;
        }
        if (!empty($service)) {
            $where[] = 'service = %s';
            $params[] = $service;
        }

        $where_sql = $where ? 'WHERE ' . implode(' AND ', $where) : '';
        $params[] = $limit;

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} {$where_sql} ORDER BY created_at DESC LIMIT %d",
                $params
            ),
            ARRAY_A
        );
    }

    public static function get_stats(): array {
        global $wpdb;
        $table = $wpdb->prefix . 'kivo_logs';
        $results = $wpdb->get_results(
            "SELECT level, COUNT(*) as count FROM {$table} GROUP BY level",
            OBJECT_K
        );
        $stats = ['debug' => 0, 'info' => 0, 'notice' => 0, 'warning' => 0, 'error' => 0, 'critical' => 0];
        foreach ($results as $level => $data) {
            $stats[$level] = (int) $data->count;
        }
        return $stats;
    }

    public static function clear(): int {
        global $wpdb;
        return (int) $wpdb->query("TRUNCATE TABLE {$wpdb->prefix}kivo_logs");
    }

    public static function cleanup(int $days_retain = 30): int {
        global $wpdb;
        $table = $wpdb->prefix . 'kivo_logs';
        $cutoff = gmdate('Y-m-d H:i:s', time() - ($days_retain * DAY_IN_SECONDS));
        return (int) $wpdb->query(
            $wpdb->prepare("DELETE FROM {$table} WHERE created_at < %s", $cutoff)
        );
    }

    public static function clear_logs(): int {
        return self::clear();
    }
}
