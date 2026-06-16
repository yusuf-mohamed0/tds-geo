<?php
/**
 * Plugin Name:     KOZMO Core WordPress Integration
 * Plugin URI:      https://kozmo-core.ai/wordpress
 * Description:     Connect your WordPress site to KOZMO Core — AI-powered SEO content automation. Receive, manage, and publish AI-generated articles directly from the KOZMO Core platform.
 * Version:         1.0.0
 * Requires PHP:    7.4
 * Requires WP:     5.6
 * Author:          KOZMO Core
 * Author URI:      https://kozmo-core.ai
 * License:         GPL v2 or later
 * License URI:     https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:     kozmo-core-integration
 * Domain Path:     /languages
 *
 * @package KOZMO_Core_Integration
 */

// ──────────────────────────────────────────────
// SECURITY: Prevent direct access
// ──────────────────────────────────────────────
if (!defined('ABSPATH')) {
    exit;
}

// ─── PHP version check ──────────────────────────────
if (version_compare(PHP_VERSION, '7.4', '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p><strong>KOZMO Core:</strong> ' .
             sprintf(
                 esc_html__('Requires PHP 7.4 or later. Your server is running PHP %s.', 'kozmo-core-integration'),
                 PHP_VERSION
             ) .
             '</p></div>';
    });
    return; // Stop executing the plugin
}

// ─── PHP 8.0+ polyfills for PHP 7.4 compatibility ───
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool {
        return 0 === strncmp($haystack, $needle, strlen($needle));
    }
}
if (!function_exists('str_contains')) {
    function str_contains(string $haystack, string $needle): bool {
        return '' === $needle || false !== strpos($haystack, $needle);
    }
}
if (!function_exists('str_ends_with')) {
    function str_ends_with(string $haystack, string $needle): bool {
        return '' === $needle || substr($haystack, -strlen($needle)) === $needle;
    }
}

// ─── mbstring polyfills (for hosts without mbstring extension) ───
if (!function_exists('mb_substr')) {
    function mb_substr(string $str, int $start, ?int $length = null, string $encoding = 'UTF-8'): string {
        return null === $length ? substr($str, $start) : substr($str, $start, $length);
    }
}
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $str, string $encoding = 'UTF-8'): int {
        return strlen($str);
    }
}
if (!function_exists('mb_stripos')) {
    function mb_stripos(string $haystack, string $needle, int $offset = 0, ?string $encoding = null) {
        return stripos($haystack, $needle, $offset);
    }
}
if (!function_exists('mb_strtolower')) {
    function mb_strtolower(string $str, string $encoding = 'UTF-8'): string {
        return strtolower($str);
    }
}
if (!function_exists('mb_strtoupper')) {
    function mb_strtoupper(string $str, string $encoding = 'UTF-8'): string {
        return strtoupper($str);
    }
}

// ──────────────────────────────────────────────
// PLUGIN CONSTANTS
// ──────────────────────────────────────────────
define('KOZMO_CORE_VERSION', '1.0.0');
define('KOZMO_CORE_PLUGIN_FILE', __FILE__);
define('KOZMO_CORE_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('KOZMO_CORE_PLUGIN_URL', plugin_dir_url(__FILE__));
define('KOZMO_CORE_API_NAMESPACE', 'kozmo-core/v1');
define('KOZMO_CORE_DB_VERSION', '1.0.0');
define('KOZMO_CORE_LOG_TABLE', 'kozmo_core_logs');
define('KOZMO_CORE_SETTINGS_OPTION', 'kozmo_core_settings');

// ──────────────────────────────────────────────
// AUTOLOADER
// ──────────────────────────────────────────────
spl_autoload_register(function ($class) {
    $prefix = 'KOZMO_Core_';
    $base_dir = KOZMO_CORE_PLUGIN_DIR . 'includes/';

    if (strncmp($prefix, $class, strlen($prefix)) !== 0) {
        return;
    }

    $relative_class = substr($class, strlen($prefix));
    $file = $base_dir . 'class-' . strtolower(str_replace('_', '-', $relative_class)) . '.php';

    if (file_exists($file)) {
        require_once $file;
    }
});

// ──────────────────────────────────────────────
// HOOKS: Activation, Deactivation, Uninstall
// ──────────────────────────────────────────────
register_activation_hook(__FILE__, 'kozmo_core_activate');
register_deactivation_hook(__FILE__, 'kozmo_core_deactivate');

/**
 * Plugin activation — creates DB tables and default settings.
 */
function kozmo_core_activate(): void {
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    global $wpdb;

    $charset_collate = $wpdb->get_charset_collate();

    // Logs table
    $log_table = $wpdb->prefix . KOZMO_CORE_LOG_TABLE;
    $sql_log = "CREATE TABLE IF NOT EXISTS {$log_table} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        level VARCHAR(20) NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        context LONGTEXT DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_level (level),
        INDEX idx_created (created_at)
    ) {$charset_collate};";

    dbDelta($sql_log);

    // API keys table
    $keys_table = $wpdb->prefix . 'kozmo_core_api_keys';
    $sql_keys = "CREATE TABLE IF NOT EXISTS {$keys_table} (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        api_key VARCHAR(64) DEFAULT NULL UNIQUE,
        api_key_hash VARCHAR(255) DEFAULT NULL,
        label VARCHAR(100) DEFAULT NULL,
        permissions VARCHAR(255) NOT NULL DEFAULT 'read,write',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        last_used_at DATETIME DEFAULT NULL,
        expires_at DATETIME DEFAULT NULL,
        created_by BIGINT UNSIGNED DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_api_key (api_key),
        INDEX idx_is_active (is_active)
    ) {$charset_collate};";

    dbDelta($sql_keys);

    // Default settings
    $defaults = [
        'api_enabled'      => 'yes',
        'log_level'        => 'error',
        'auto_import_tags' => 'yes',
        'auto_import_cats' => 'yes',
        'default_status'   => 'draft',
        'default_author'   => get_current_user_id(),
        'enable_webhooks'  => 'no',
        'webhook_secret'   => '',
        'debug_mode'       => 'no',
    ];

    if (!get_option(KOZMO_CORE_SETTINGS_OPTION)) {
        add_option(KOZMO_CORE_SETTINGS_OPTION, $defaults, '', 'yes');
    }

    // Generate an initial API key
    if (!get_option('kozmo_core_initial_api_key')) {
        $api_key = 'vrn_' . bin2hex(random_bytes(24));
        add_option('kozmo_core_initial_api_key', $api_key, '', 'no');

        $wpdb->insert(
            $keys_table,
            [
                'api_key'     => $api_key,
                'label'       => 'Auto-generated (activation)',
                'permissions' => 'read,write',
                'is_active'   => 1,
                'created_by'  => get_current_user_id(),
            ],
            ['%s', '%s', '%s', '%d', '%d']
        );
    }

    add_option('kozmo_core_db_version', KOZMO_CORE_DB_VERSION);
}

/**
 * Plugin deactivation — cleanup if needed.
 */
function kozmo_core_deactivate(): void {
    // Optionally flush rewrite rules
    flush_rewrite_rules();
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
add_action('plugins_loaded', 'kozmo_core_init');

function kozmo_core_init(): void {
    // Load text domain for translations
    load_plugin_textdomain('kozmo-core-integration', false, dirname(plugin_basename(__FILE__)) . '/languages');

    // Initialize components
    KOZMO_Core_Logger::init();
    KOZMO_Core_Auth::init();
    KOZMO_Core_Admin::init();
    KOZMO_Core_API::init();
    KOZMO_Core_Sync::init();
}

/**
 * On activation, ensure rewrite rules are flushed.
 */
add_action('activated_plugin', function ($plugin) {
    if ($plugin === plugin_basename(__FILE__)) {
        flush_rewrite_rules();
    }
});
