<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Auth {
    private static ?self $instance = null;
    private static ?array $active_keys = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_post_kozmo_ai_generate_key', [self::class, 'handle_generate_key']);
        add_action('admin_post_kozmo_ai_revoke_key', [self::class, 'handle_revoke_key']);
    }

    public static function generate_key(string $label = '', string $permissions = 'read,write', int $created_by = 0, int $expires_in = 0): array {
        global $wpdb;
        $api_key = 'kai_' . bin2hex(random_bytes(24));
        $expires_at = $expires_in > 0 ? gmdate('Y-m-d H:i:s', time() + ($expires_in * DAY_IN_SECONDS)) : null;

        $inserted = $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_api_keys',
            [
                'api_key'     => $api_key,
                'label'       => sanitize_text_field($label),
                'permissions' => sanitize_text_field($permissions),
                'is_active'   => 1,
                'expires_at'  => $expires_at,
                'created_by'  => $created_by ?: get_current_user_id(),
            ],
            ['%s', '%s', '%s', '%d', '%s', '%d']
        );

        if (!$inserted) return ['success' => false, 'message' => __('Failed to generate API key.', 'kozmo-ai-wp')];

        Logger::info('API key generated', ['label' => $label, 'permissions' => $permissions]);
        return ['success' => true, 'api_key' => $api_key, 'message' => __('API key generated.', 'kozmo-ai-wp')];
    }

    public static function validate_key(string $api_key): array {
        global $wpdb;

        if (null === self::$active_keys) {
            self::$active_keys = [];
            $results = $wpdb->get_results(
                $wpdb->prepare(
                    "SELECT api_key, permissions FROM {$wpdb->prefix}kozmo_ai_api_keys
                     WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > %s)",
                    current_time('mysql')
                ),
                ARRAY_A
            );
            foreach ($results as $row) {
                self::$active_keys[$row['api_key']] = $row['permissions'];
            }
        }

        if (isset(self::$active_keys[$api_key])) {
            $wpdb->update(
                $wpdb->prefix . 'kozmo_ai_api_keys',
                ['last_used_at' => current_time('mysql')],
                ['api_key' => $api_key],
                ['%s'],
                ['%s']
            );

            return [
                'valid'       => true,
                'permissions' => array_map('trim', explode(',', self::$active_keys[$api_key])),
                'message'     => 'Key is valid.',
            ];
        }

        return ['valid' => false, 'permissions' => [], 'message' => 'Invalid or revoked key.'];
    }

    public static function revoke_key(string $api_key): bool {
        global $wpdb;
        $updated = $wpdb->update(
            $wpdb->prefix . 'kozmo_ai_api_keys',
            ['is_active' => 0],
            ['api_key' => $api_key],
            ['%d'],
            ['%s']
        );
        if ($updated) {
            self::$active_keys = null;
            Logger::info('API key revoked', ['key' => substr($api_key, 0, 12) . '...']);
        }
        return (bool) $updated;
    }

    public static function list_keys(): array {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT id, api_key, label, permissions, is_active, last_used_at, expires_at, created_at
             FROM {$wpdb->prefix}kozmo_ai_api_keys ORDER BY created_at DESC",
            ARRAY_A
        );
    }

    public static function authenticate_request(): array {
        $api_key = '';

        if (!empty($_SERVER['HTTP_X_KOZMO_AI_KEY'])) {
            $api_key = sanitize_text_field(wp_unslash($_SERVER['HTTP_X_KOZMO_AI_KEY']));
        }
        if (empty($api_key) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth = sanitize_text_field(wp_unslash($_SERVER['HTTP_AUTHORIZATION']));
            if (str_starts_with($auth, 'Bearer ')) {
                $api_key = trim(substr($auth, 7));
            }
        }
        if (empty($api_key) && !empty($_GET['api_key'])) {
            $api_key = sanitize_text_field(wp_unslash($_GET['api_key']));
        }

        if (empty($api_key)) {
            return ['valid' => false, 'permissions' => [], 'message' => 'Missing API key.'];
        }

        return self::validate_key($api_key);
    }

    public static function check_read_permission(): bool {
        $auth = self::authenticate_request();
        return $auth['valid'] && in_array('read', $auth['permissions'], true);
    }

    public static function check_write_permission(): bool {
        $auth = self::authenticate_request();
        return $auth['valid'] && in_array('write', $auth['permissions'], true);
    }

    public static function check_admin_permission(): bool {
        return current_user_can('manage_options');
    }

    public static function handle_generate_key(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_generate_key', 'kozmo_ai_nonce');

        $label       = sanitize_text_field(wp_unslash($_POST['label'] ?? ''));
        $permissions = sanitize_text_field(wp_unslash($_POST['permissions'] ?? 'read,write'));
        $expires_in  = absint(wp_unslash($_POST['expires_in'] ?? 0));
        $result = self::generate_key($label, $permissions, get_current_user_id(), $expires_in);

        $redirect = admin_url('admin.php?page=kozmo-ai-wp-keys');
        if ($result['success']) $redirect = add_query_arg('new_key', $result['api_key'], $redirect);

        wp_safe_redirect($redirect);
        exit;
    }

    public static function handle_revoke_key(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_revoke_key', 'kozmo_ai_nonce');

        $key_id = absint(wp_unslash($_POST['key_id'] ?? 0));
        global $wpdb;
        $api_key = $wpdb->get_var($wpdb->prepare(
            "SELECT api_key FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE id = %d", $key_id
        ));
        if ($api_key) self::revoke_key($api_key);

        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-keys'));
        exit;
    }
}
