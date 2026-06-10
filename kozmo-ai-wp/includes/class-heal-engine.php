<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Self-healing engine — detects errors, attempts automatic repair, and retries.
 */
class HealEngine {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_heartbeat', [self::class, 'heartbeat_check']);
    }

    public static function record_error(string $code, string $message, array $context = [], string $severity = 'warning'): int {
        global $wpdb;

        $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_errors',
            [
                'error_code'     => $code,
                'error_message'  => $message,
                'error_context'  => wp_json_encode($context),
                'severity'       => $severity,
                'auto_healed'    => 0,
                'resolved'       => 0,
            ],
            ['%s', '%s', '%s', '%s', '%d', '%d']
        );

        Logger::error($message, array_merge($context, ['error_code' => $code, 'severity' => $severity]));
        return (int) $wpdb->insert_id;
    }

    public static function mark_healed(int $error_id): bool {
        global $wpdb;
        return (bool) $wpdb->update(
            $wpdb->prefix . 'kozmo_ai_errors',
            ['resolved' => 1, 'auto_healed' => 1, 'resolved_at' => current_time('mysql')],
            ['id' => $error_id],
            ['%d', '%d', '%s'],
            ['%d']
        );
    }

    public static function mark_resolved(int $error_id): bool {
        global $wpdb;
        return (bool) $wpdb->update(
            $wpdb->prefix . 'kozmo_ai_errors',
            ['resolved' => 1, 'resolved_at' => current_time('mysql')],
            ['id' => $error_id],
            ['%d', '%s'],
            ['%d']
        );
    }

    public static function heartbeat_check(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        if (($settings['auto_fix_errors'] ?? 'yes') !== 'yes') return;

        global $wpdb;

        // Find unresolved errors
        $errors = $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}kozmo_ai_errors WHERE resolved = 0 ORDER BY created_at ASC LIMIT 5",
            ARRAY_A
        );

        foreach ($errors as $error) {
            $healed = self::attempt_heal($error);
            if ($healed) {
                self::mark_healed((int) $error['id']);
                Logger::info('Auto-healed error', ['code' => $error['error_code'], 'id' => $error['id']]);
            }
        }
    }

    private static function attempt_heal(array $error): bool {
        $code = $error['error_code'];

        switch (true) {
            case str_starts_with($code, 'db_'):
                // Retry database connection
                global $wpdb;
                return (bool) $wpdb->check_database_version();

            case 'task_failed' === $code:
                // Tasks will auto-retry via Worker with exponential backoff
                return true;

            case str_starts_with($code, 'api_'):
                // API errors — clear cache, retry later
                Cache::flush();
                return true;

            case str_starts_with($code, 'sync_'):
                // Re-enqueue a sync
                Worker::enqueue('sync_knowledge', [], 5, 60);
                return true;

            default:
                // Unknown — just mark for review, don't retry
                return false;
        }
    }

    public static function get_error_stats(): array {
        global $wpdb;
        $table = $wpdb->prefix . 'kozmo_ai_errors';
        return [
            'unresolved' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE resolved = 0"),
            'healed'     => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE auto_healed = 1"),
            'total'      => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}"),
            'by_severity' => $wpdb->get_results("SELECT severity, COUNT(*) as count FROM {$table} WHERE resolved = 0 GROUP BY severity", OBJECT_K),
            'recent'     => $wpdb->get_results("SELECT * FROM {$table} WHERE resolved = 0 ORDER BY created_at DESC LIMIT 10", ARRAY_A),
        ];
    }

    public static function get_recent_errors(int $limit = 20): array {
        global $wpdb;
        return $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}kozmo_ai_errors ORDER BY created_at DESC LIMIT %d",
                $limit
            ),
            ARRAY_A
        );
    }
}
