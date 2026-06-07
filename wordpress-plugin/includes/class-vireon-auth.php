<?php
/**
 * Vireon API Key Authentication
 *
 * Handles API key generation, validation, and permission checking
 * for the Vireon WordPress integration REST API.
 *
 * @package Vireon_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Vireon_Auth {

    /**
     * @var self|null Singleton instance
     */
    private static ?self $instance = null;

    /**
     * @var array|null Cached active API keys
     */
    private static ?array $active_keys = null;

    /**
     * Initialize auth hooks.
     */
    public static function init(): void {
        if (self::$instance === null) {
            self::$instance = new self();
        }
    }

    /**
     * Generate a new API key.
     *
     * @param string $label       Optional label for the key.
     * @param string $permissions Comma-separated permissions (read, write).
     * @param int    $created_by  WP user ID who created the key.
     * @param int    $expires_in  Days until expiry (0 = never).
     *
     * @return array{success: bool, api_key?: string, message?: string}
     */
    public static function generate_key(
        string $label = '',
        string $permissions = 'read,write',
        int $created_by = 0,
        int $expires_in = 0
    ): array {
        global $wpdb;

        $api_key = 'vrn_' . bin2hex(random_bytes(24));
        $expires_at = $expires_in > 0
            ? gmdate('Y-m-d H:i:s', time() + ($expires_in * DAY_IN_SECONDS))
            : null;

        $inserted = $wpdb->insert(
            $wpdb->prefix . 'vireon_api_keys',
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

        if (!$inserted) {
            return [
                'success' => false,
                'message' => __('Failed to generate API key.', 'vireon-integration'),
            ];
        }

        Vireon_Logger::info('API key generated', [
            'label'       => $label,
            'permissions' => $permissions,
            'expires_in'  => $expires_in,
        ]);

        return [
            'success' => true,
            'api_key' => $api_key,
            'message' => __('API key generated successfully.', 'vireon-integration'),
        ];
    }

    /**
     * Validate an API key and return its permissions.
     *
     * @param string $api_key The key to validate.
     *
     * @return array{valid: bool, permissions: string[], message: string}
     */
    public static function validate_key(string $api_key): array {
        global $wpdb;    // Cache all active keys on first call
    if (self::$active_keys === null) {
      self::$active_keys = [];
      $results = $wpdb->get_results(
        $wpdb->prepare(
          "SELECT api_key, permissions, expires_at
           FROM {$wpdb->prefix}vireon_api_keys
           WHERE is_active = 1
           AND (expires_at IS NULL OR expires_at > NOW())"
        ),
        ARRAY_A
      );
      foreach ($results as $row) {
        self::$active_keys[$row['api_key']] = $row;
      }
    }

    if (isset(self::$active_keys[$api_key])) {
      // Update last_used_at (don't block if fail)
      $wpdb->update(
        $wpdb->prefix . 'vireon_api_keys',
        ['last_used_at' => current_time('mysql')],
        ['api_key' => $api_key],
        ['%s'],
        ['%s']
      );

      return [
        'valid'       => true,
        'permissions' => array_map('trim', explode(',', self::$active_keys[$api_key]['permissions'])),
        'message'     => 'Key is valid.',
      ];
    }

        return [
            'valid'       => false,
            'permissions' => [],
            'message'     => 'Invalid or revoked API key.',
        ];
    }

    /**
     * Revoke an API key (soft delete).
     *
     * @param string $api_key The key to revoke.
     *
     * @return bool
     */
    public static function revoke_key(string $api_key): bool {
        global $wpdb;

        $updated = $wpdb->update(
            $wpdb->prefix . 'vireon_api_keys',
            ['is_active' => 0],
            ['api_key' => $api_key],
            ['%d'],
            ['%s']
        );

        if ($updated) {
            self::$active_keys = null; // bust cache
            Vireon_Logger::info('API key revoked', ['api_key' => substr($api_key, 0, 12) . '...']);
        }

        return (bool) $updated;
    }

    /**
     * List all API keys.
     *
     * @return array
     */
    public static function list_keys(): array {
        global $wpdb;

        return $wpdb->get_results(
            "SELECT id, api_key, label, permissions, is_active, last_used_at, expires_at, created_at
             FROM {$wpdb->prefix}vireon_api_keys
             ORDER BY created_at DESC",
            ARRAY_A
        );
    }

    /**
     * Check if a given permission is granted for the current request context.
     *
     * @param string $permission The permission to check (e.g., 'write').
     * @param array  $key_data   The validated key data from validate_key().
     *
     * @return bool
     */
    public static function has_permission(string $permission, array $key_data): bool {
        if (!$key_data['valid']) {
            return false;
        }
        return in_array($permission, $key_data['permissions'], true);
    }

    /**
     * Authenticate an incoming REST API request.
     *
     * Reads the X-Vireon-Key header and validates it.
     *
     * @return array{valid: bool, permissions: string[], message: string}
     */
    public static function authenticate_request(): array {
        $api_key = '';

        // Check header first
        if (!empty($_SERVER['HTTP_X_VIREON_KEY'])) {
            $api_key = sanitize_text_field(wp_unslash($_SERVER['HTTP_X_VIREON_KEY']));
        }

        // Fallback: Authorization: Bearer <key>
        if (empty($api_key) && !empty($_SERVER['HTTP_AUTHORIZATION'])) {
            $auth = sanitize_text_field(wp_unslash($_SERVER['HTTP_AUTHORIZATION']));
            if (str_starts_with($auth, 'Bearer ')) {
                $api_key = trim(substr($auth, 7));
            }
        }

        // Fallback: query parameter ?api_key=
        if (empty($api_key) && !empty($_GET['api_key'])) {
            $api_key = sanitize_text_field(wp_unslash($_GET['api_key']));
        }

        if (empty($api_key)) {
            return [
                'valid'       => false,
                'permissions' => [],
                'message'     => 'Missing API key. Provide via X-Vireon-Key header or Bearer token.',
            ];
        }

        return self::validate_key($api_key);
    }

    /**
     * Middleware-style REST permission callback.
     *
     * Usage: 'permission_callback' => ['Vireon_Auth', 'check_write_permission']
     *
     * @return bool
     */
    public static function check_read_permission(): bool {
        $auth = self::authenticate_request();
        return $auth['valid'] && self::has_permission('read', $auth);
    }

    /**
     * Permission callback for write operations.
     *
     * @return bool
     */
    public static function check_write_permission(): bool {
        $auth = self::authenticate_request();
        return $auth['valid'] && self::has_permission('write', $auth);
    }

    /**
     * Permission callback for admin operations.
     *
     * @return bool
     */
    public static function check_admin_permission(): bool {
        // Admin operations also need WP admin privileges
        return current_user_can('manage_options');
    }
}
