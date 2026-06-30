<?php
/**
 * Traffic Digital Solutions GEO — Autonomous WordPress AI Agent
 *
 * @package           TdsGeo_WP
 * @author            Traffic Digital Solutions GEO
 * @license           GPL-2.0-or-later
 * @link              https://trafficdigitalsolutions.com
 *
 * @wordpress-plugin
 * Plugin Name:       Traffic Digital Solutions GEO — WordPress Connector
 * Plugin URI:        https://trafficdigitalsolutions.com/wordpress
 * Description:       Thin connector for TDS Geo. Exposes REST API for post CRUD, media, taxonomies, and settings — all AI intelligence runs on the Core backend.
 * Version:           3.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Traffic Digital Solutions GEO
 * Author URI:        https://trafficdigitalsolutions.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       tds-geo-wp
 * Domain Path:       /languages
 * Network:           false
 */

defined('ABSPATH') || exit;

// ─── PHP version check ──────────────────────────────
if (version_compare(PHP_VERSION, '7.4', '<')) {
    add_action('admin_notices', function () {
        echo '<div class="notice notice-error"><p><strong>Traffic Digital Solutions GEO:</strong> ' .
             sprintf(
                 esc_html__('Requires PHP 7.4 or later. Your server is running PHP %s.', 'tds-geo-wp'),
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
    /**
     * @param string $haystack
     * @param string $needle
     * @param int    $offset
     * @param string|null $encoding
     * @return int|false
     */
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

// ─── Constants ───────────────────────────────────────
define('TDS_GEO_WP_VERSION', '3.0.0');
define('TDS_GEO_CONNECTOR_VERSION', '1.0.0');
define('TDS_GEO_WP_FILE', __FILE__);
define('TDS_GEO_WP_DIR', plugin_dir_path(__FILE__));
define('TDS_GEO_WP_URL', plugin_dir_url(__FILE__));
define('TDS_GEO_WP_BASENAME', plugin_basename(__FILE__));
define('TDS_GEO_WP_API_NAMESPACE', 'tds-geo/v1');

if (!defined('TDS_GEO_BACKEND_URL')) define('TDS_GEO_BACKEND_URL', getenv('TDS_GEO_BACKEND_URL') ?: '');

// Backward compatibility: define tds-geo-wp constants so existing integrations work
if (!defined('TDS_GEO_VERSION')) define('TDS_GEO_VERSION', TDS_GEO_WP_VERSION);
if (!defined('TDS_GEO_API_NAMESPACE')) define('TDS_GEO_API_NAMESPACE', 'tds-geo/v1');
if (!defined('TDS_GEO_LOG_TABLE')) define('TDS_GEO_LOG_TABLE', 'tds_geo_logs');
if (!defined('TDS_GEO_SETTINGS_OPTION')) define('TDS_GEO_SETTINGS_OPTION', 'tds_geo_wp_settings');
if (!defined('TDS_GEO_PLUGIN_FILE')) define('TDS_GEO_PLUGIN_FILE', TDS_GEO_WP_FILE);
if (!defined('TDS_GEO_PLUGIN_DIR')) define('TDS_GEO_PLUGIN_DIR', TDS_GEO_WP_DIR);
if (!defined('TDS_GEO_PLUGIN_URL')) define('TDS_GEO_PLUGIN_URL', TDS_GEO_WP_URL);

// ─── Autoloader ─────────────────────────────────────
spl_autoload_register(function ($class) {
    $prefix = 'TdsGeo_WP\\';
    $base_dir = TDS_GEO_WP_DIR . 'includes/';

    if (strncmp($prefix, $class, strlen($prefix)) !== 0) return;

    $relative = substr($class, strlen($prefix));
    // Convert CamelCase to hyphen-case: RateLimiter → rate-limiter, KnowledgeBase → knowledge-base
    $hyphenated = preg_replace('/([a-z0-9])([A-Z])/', '$1-$2', $relative);
    $hyphenated = preg_replace('/([A-Z]+)([A-Z][a-z])/', '$1-$2', $hyphenated);
    $file = $base_dir . 'class-' . strtolower(str_replace(['_', '\\'], ['-', '-'], $hyphenated)) . '.php';

    if (file_exists($file)) require $file;
});



// ─── random_bytes polyfill for hardened PHP installs ──
if (!function_exists('tds_geo_wp_random_bytes')) {
    function tds_geo_wp_random_bytes(int $length): string {
        if (function_exists('random_bytes')) {
            return random_bytes($length);
        }
        if (function_exists('openssl_random_pseudo_bytes')) {
            $bytes = openssl_random_pseudo_bytes($length);
            if (false !== $bytes) return $bytes;
        }
        // Fallback: not cryptographically secure, but prevents fatal error
        $bytes = '';
        for ($i = 0; $i < $length; $i++) {
            $bytes .= chr(random_int(0, 255));
        }
        return $bytes;
    }
}

// ─── Hooks ──────────────────────────────────────────
register_activation_hook(__FILE__, ['TdsGeo_WP\\Activator', 'activate']);
register_deactivation_hook(__FILE__, ['TdsGeo_WP\\Deactivator', 'deactivate']);
register_uninstall_hook(__FILE__, ['TdsGeo_WP\\Uninstaller', 'uninstall']);

// ─── Init ───────────────────────────────────────────
add_action('plugins_loaded', function () {
    load_plugin_textdomain('tds-geo-wp', false, dirname(TDS_GEO_WP_BASENAME) . '/languages');

    $plugin = TdsGeo_WP\Main::get_instance();
    $plugin->init();
});

// ─── Activation error notice ───────────────────────
add_action('admin_notices', function () {
    $errors = get_transient('tds_geo_wp_activation_notice');
    if (!empty($errors) && is_array($errors)) {
        echo '<div class="notice notice-error is-dismissible"><p><strong>Traffic Digital Solutions GEO Activation Errors:</strong></p><ul>';
        foreach ($errors as $error) {
            echo '<li>' . esc_html($error) . '</li>';
        }
        echo '</ul></div>';
        delete_transient('tds_geo_wp_activation_notice');
    }
});

// ─── Flush rewrites on activation ───────────────────
register_activation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
