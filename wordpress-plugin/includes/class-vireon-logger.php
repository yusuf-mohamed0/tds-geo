<?php
/**
 * Vireon Logger
 *
 * Provides structured logging for the Vireon WordPress integration.
 * Logs are stored in a custom DB table and can be viewed in the admin.
 *
 * @package Vireon_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Vireon_Logger {

    /**
     * @var self|null Singleton instance
     */
    private static ?self $instance = null;

    /**
     * Log levels.
     */
    public const DEBUG     = 'debug';
    public const INFO      = 'info';
    public const WARNING   = 'warning';
    public const ERROR     = 'error';
    public const CRITICAL  = 'critical';

    /**
     * Level priority (higher = more severe).
     */
    private const LEVEL_PRIORITY = [
        self::DEBUG    => 0,
        self::INFO     => 1,
        self::WARNING  => 2,
        self::ERROR    => 3,
        self::CRITICAL => 4,
    ];

    /**
     * Initialize logger.
     */
    public static function init(): void {
        if (self::$instance === null) {
            self::$instance = new self();
        }
    }

    /**
     * Log a debug message.
     */
    public static function debug(string $message, array $context = []): void {
        self::log(self::DEBUG, $message, $context);
    }

    /**
     * Log an info message.
     */
    public static function info(string $message, array $context = []): void {
        self::log(self::INFO, $message, $context);
    }

    /**
     * Log a warning message.
     */
    public static function warning(string $message, array $context = []): void {
        self::log(self::WARNING, $message, $context);
    }

    /**
     * Log an error message.
     */
    public static function error(string $message, array $context = []): void {
        self::log(self::ERROR, $message, $context);
    }

    /**
     * Log a critical message.
     */
    public static function critical(string $message, array $context = []): void {
        self::log(self::CRITICAL, $message, $context);
    }

    /**
     * Core log method.
     *
     * @param string $level   Log level.
     * @param string $message Log message.
     * @param array  $context Structured context data.
     */
    private static function log(string $level, string $message, array $context = []): void {
        global $wpdb;

        // Get configured log level from settings
        $settings = get_option(VIREON_SETTINGS_OPTION, []);
        $config_level = $settings['log_level'] ?? 'error';

        // Only log if at or above the configured level
        $config_priority = self::LEVEL_PRIORITY[$config_level] ?? 1;
        $msg_priority = self::LEVEL_PRIORITY[$level] ?? 0;

        if ($msg_priority < $config_priority) {
            return; // Skip low-priority logs
        }

        // Truncate message to prevent oversized rows
        $message = mb_substr($message, 0, 1000);

        // Sanitize context
        $context_safe = self::sanitize_context($context);

        $wpdb->insert(
            $wpdb->prefix . VIREON_LOG_TABLE,
            [
                'level'      => $level,
                'message'    => $message,
                'context'    => wp_json_encode($context_safe),
                'created_at' => current_time('mysql'),
            ],
            ['%s', '%s', '%s', '%s']
        );

        // Also send to WP debug log if WP_DEBUG is enabled
        if (defined('WP_DEBUG') && WP_DEBUG) {
            // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
            error_log(
                sprintf(
                    '[Vireon] %s: %s %s',
                    strtoupper($level),
                    $message,
                    $context_safe ? wp_json_encode($context_safe) : ''
                )
            );
        }
    }

    /**
     * Sanitize context data for safe storage (remove sensitive keys).
     *
     * @param array $context Raw context data.
     *
     * @return array Sanitized context.
     */
    private static function sanitize_context(array $context): array {
        $sensitive_keys = ['api_key', 'password', 'secret', 'token', 'authorization'];
        $safe = [];

        foreach ($context as $key => $value) {
            if (in_array(strtolower($key), $sensitive_keys, true)) {
                $safe[$key] = '[REDACTED]';
            } elseif (is_array($value)) {
                $safe[$key] = self::sanitize_context($value);
            } elseif (is_scalar($value) || is_null($value)) {
                $safe[$key] = $value;
            } else {
                $safe[$key] = wp_json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            }
        }

        return $safe;
    }

    /**
     * Get recent log entries.
     *
     * @param int    $limit  Number of entries to fetch.
     * @param string $level  Optional level filter.
     *
     * @return array
     */
    public static function get_logs(int $limit = 100, string $level = ''): array {
        global $wpdb;
        $table = $wpdb->prefix . VIREON_LOG_TABLE;

        if (!empty($level)) {
            return $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT * FROM {$table} WHERE level = %s ORDER BY created_at DESC LIMIT %d",
                    $level,
                    $limit
                ),
                ARRAY_A
            );
        }

        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$table} ORDER BY created_at DESC LIMIT %d",
                $limit
            ),
            ARRAY_A
        );
    }

    /**
     * Delete old log entries (cleanup).
     *
     * @param int $days_retain Days of logs to keep.
     *
     * @return int Number of deleted rows.
     */
    public static function cleanup(int $days_retain = 30): int {
        global $wpdb;
        $table = $wpdb->prefix . VIREON_LOG_TABLE;

        $cutoff = gmdate('Y-m-d H:i:s', time() - ($days_retain * DAY_IN_SECONDS));

        return (int) $wpdb->query(
            $wpdb->prepare(
                "DELETE FROM {$table} WHERE created_at < %s",
                $cutoff
            )
        );
    }

    /**
     * Clear all logs.
     *
     * @return int Number of deleted rows.
     */
    public static function clear_logs(): int {
        global $wpdb;
        $table = $wpdb->prefix . VIREON_LOG_TABLE;

        return (int) $wpdb->query("TRUNCATE TABLE {$table}");
    }
}
