<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Auth {
    private static ?self $instance = null;
    private static ?array $active_keys = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        self::ensure_schema();
        add_action('admin_post_kozmo_ai_generate_key', [self::class, 'handle_generate_key']);
        add_action('admin_post_kozmo_ai_revoke_key', [self::class, 'handle_revoke_key']);
        add_action('wp_ajax_kozmo_ai_reveal_key', [self::class, 'handle_reveal_key']);
    }

    private static function ensure_schema(): void {
        global $wpdb;

        $table = $wpdb->prefix . 'kozmo_ai_api_keys';
        $has_hash = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM {$table} LIKE %s", 'api_key_hash'));
        if (!$has_hash) {
            $wpdb->query("ALTER TABLE {$table} ADD COLUMN api_key_hash VARCHAR(255) DEFAULT NULL AFTER api_key");
        }
        $has_enc = $wpdb->get_var($wpdb->prepare("SHOW COLUMNS FROM {$table} LIKE %s", 'api_key_encrypted'));
        if (!$has_enc) {
            $wpdb->query("ALTER TABLE {$table} ADD COLUMN api_key_encrypted TEXT DEFAULT NULL AFTER api_key_hash");
        }
    }

    private static function encrypt_key(string $plaintext): string {
        $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
        $iv = openssl_random_pseudo_bytes(16);
        $encrypted = openssl_encrypt($plaintext, 'aes-256-cbc', $key, 0, $iv);
        return base64_encode($iv . $encrypted);
    }

    private static function decrypt_key(string $encoded): ?string {
        $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
        $data = base64_decode($encoded, true);
        if (false === $data || strlen($data) < 17) return null;
        $iv = substr($data, 0, 16);
        $encrypted = substr($data, 16);
        $decrypted = openssl_decrypt($encrypted, 'aes-256-cbc', $key, 0, $iv);
        return false !== $decrypted ? $decrypted : null;
    }

    private static function hash_api_key(string $api_key): string {
        if (function_exists('wp_hash_password')) {
            return wp_hash_password($api_key);
        }

        return password_hash($api_key, PASSWORD_DEFAULT);
    }

    private static function verify_api_key(string $api_key, string $hash): bool {
        if (function_exists('wp_check_password')) {
            return wp_check_password($api_key, $hash);
        }

        return password_verify($api_key, $hash);
    }

    private static function mask_key(?string $api_key): string {
        if (!empty($api_key)) {
            return substr($api_key, 0, 16) . '...';
        }

        return __('Stored securely', 'kozmo-ai-wp');
    }

    public static function generate_key(string $label = '', string $permissions = 'read,write', int $created_by = 0, int $expires_in = 0): array {
        global $wpdb;
        $api_key = 'kai_' . bin2hex(random_bytes(24));
        $expires_at = $expires_in > 0 ? gmdate('Y-m-d H:i:s', time() + ($expires_in * DAY_IN_SECONDS)) : null;

        $inserted = $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_api_keys',
            [
                'api_key'          => null,
                'api_key_hash'     => self::hash_api_key($api_key),
                'api_key_encrypted'=> self::encrypt_key($api_key),
                'label'            => sanitize_text_field($label),
                'permissions'      => sanitize_text_field($permissions),
                'is_active'        => 1,
                'expires_at'       => $expires_at,
                'created_by'       => $created_by ?: get_current_user_id(),
            ],
            ['%s', '%s', '%s', '%s', '%s', '%d', '%s', '%d']
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
                    "SELECT id, api_key, api_key_hash, permissions FROM {$wpdb->prefix}kozmo_ai_api_keys
                     WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > %s)",
                    current_time('mysql')
                ),
                ARRAY_A
            );
            self::$active_keys = $results;
        }

        foreach (self::$active_keys as $row) {
            $legacy_match = !empty($row['api_key']) && hash_equals($row['api_key'], $api_key);
            $hash_match = !empty($row['api_key_hash']) && self::verify_api_key($api_key, $row['api_key_hash']);

            if (!$legacy_match && !$hash_match) {
                continue;
            }

            $wpdb->update(
                $wpdb->prefix . 'kozmo_ai_api_keys',
                ['last_used_at' => current_time('mysql')],
                ['id' => (int) $row['id']],
                ['%s'],
                ['%d']
            );

            return [
                'valid'       => true,
                'permissions' => array_map('trim', explode(',', $row['permissions'])),
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
        $keys = $wpdb->get_results(
            "SELECT id, api_key, label, permissions, is_active, last_used_at, expires_at, created_at
             FROM {$wpdb->prefix}kozmo_ai_api_keys ORDER BY created_at DESC",
            ARRAY_A
        );

        foreach ($keys as &$key) {
            $key['masked_key'] = self::mask_key($key['api_key'] ?? '');
        }

        return $keys;
    }

    public static function reveal_key(int $key_id): ?string {
        global $wpdb;
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT api_key, api_key_encrypted FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE id = %d",
            $key_id
        ), ARRAY_A);
        if (!$row) return null;
        if (!empty($row['api_key_encrypted'])) {
            return self::decrypt_key($row['api_key_encrypted']);
        }
        if (!empty($row['api_key'])) {
            return $row['api_key'];
        }
        return null;
    }

    public static function handle_reveal_key(): void {
        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized.']);
        }
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'kozmo_ai_wp_ajax')) {
            wp_send_json_error(['message' => 'Security check failed. Refresh the page.']);
        }
        $key_id = absint($_POST['key_id'] ?? 0);
        $password = wp_unslash($_POST['password'] ?? '');
        if (!$key_id || !$password) {
            wp_send_json_error(['message' => 'Missing key ID or password.']);
        }
        $user = wp_get_current_user();
        if (!wp_check_password($password, $user->user_pass, $user->ID)) {
            wp_send_json_error(['message' => 'Invalid password.']);
        }
        $revealed = self::reveal_key($key_id);
        if (null === $revealed) {
            wp_send_json_error(['message' => 'Cannot reveal this key (only hash stored). Generate a new one.']);
        }
        wp_send_json_success(['api_key' => $revealed]);
    }

    public static function revoke_key_by_id(int $key_id): bool {
        global $wpdb;
        $updated = $wpdb->update(
            $wpdb->prefix . 'kozmo_ai_api_keys',
            ['is_active' => 0],
            ['id' => $key_id],
            ['%d'],
            ['%d']
        );
        if ($updated) {
            self::$active_keys = null;
            Logger::info('API key revoked', ['key_id' => $key_id]);
        }
        return (bool) $updated;
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
        if (empty($api_key)) {
            return ['valid' => false, 'permissions' => [], 'message' => 'Missing API key. Provide it via X-KOZMO-AI-Key or Authorization: Bearer.'];
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
        check_admin_referer('kozmo_ai_generate_key', 'kozmo_ai_generate_nonce');

        $label       = sanitize_text_field(wp_unslash($_POST['label'] ?? ''));
        $permissions = sanitize_text_field(wp_unslash($_POST['permissions'] ?? 'read,write'));
        $expires_in  = absint(wp_unslash($_POST['expires_in'] ?? 0));
        $result = self::generate_key($label, $permissions, get_current_user_id(), $expires_in);

        $redirect = admin_url('admin.php?page=kozmo-ai-wp-settings');
        if ($result['success']) $redirect = add_query_arg('new_key', $result['api_key'], $redirect);

        wp_safe_redirect($redirect);
        exit;
    }

    public static function handle_revoke_key(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_revoke_key', 'kozmo_ai_revoke_nonce');

        $key_id = absint(wp_unslash($_POST['key_id'] ?? 0));
        if ($key_id > 0) self::revoke_key_by_id($key_id);

        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
        exit;
    }
}
