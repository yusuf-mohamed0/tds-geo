<?php
/**
 * KOZMO AI — Autonomous WordPress AI Agent
 *
 * @package           KozmoAI_WP
 * @author            KOZMO AI
 * @license           GPL-2.0-or-later
 * @link              https://vireon.io
 *
 * @wordpress-plugin
 * Plugin Name:       KOZMO AI — Autonomous WP Agent
 * Plugin URI:        https://vireon.io/wordpress
 * Description:       Autonomous AI agent for WordPress. Automatically understands, manages, optimizes, and grows your website with AI-powered SEO content automation.
 * Version:           2.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            KOZMO AI
 * Author URI:        https://vireon.io
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       kozmo-ai-wp
 * Domain Path:       /languages
 * Network:           false
 */

defined('ABSPATH') || exit;

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
define('KOZMO_AI_WP_VERSION', '2.0.0');
define('KOZMO_AI_WP_FILE', __FILE__);
define('KOZMO_AI_WP_DIR', plugin_dir_path(__FILE__));
define('KOZMO_AI_WP_URL', plugin_dir_url(__FILE__));
define('KOZMO_AI_WP_BASENAME', plugin_basename(__FILE__));
define('KOZMO_AI_WP_API_NAMESPACE', 'kozmo-ai/v1');
define('KOZMO_AI_WP_DB_VERSION', '2.0.0');
define('KOZMO_AI_WP_AGENT_URL', defined('KOZMO_AI_AGENT_URL') ? KOZMO_AI_AGENT_URL : 'https://api.vireon.io');

// ─── Autoloader ─────────────────────────────────────
spl_autoload_register(function ($class) {
    $prefix = 'KozmoAI_WP\\';
    $base_dir = KOZMO_AI_WP_DIR . 'includes/';

    if (strncmp($prefix, $class, strlen($prefix)) !== 0) return;

    $relative = substr($class, strlen($prefix));
    // Convert CamelCase to hyphen-case: RateLimiter → rate-limiter, KnowledgeBase → knowledge-base
    $hyphenated = preg_replace('/([a-z0-9])([A-Z])/', '$1-$2', $relative);
    $hyphenated = preg_replace('/([A-Z]+)([A-Z][a-z])/', '$1-$2', $hyphenated);
    $file = $base_dir . 'class-' . strtolower(str_replace(['_', '\\'], ['-', '-'], $hyphenated)) . '.php';

    if (file_exists($file)) require $file;
});

// ─── Hooks ──────────────────────────────────────────
register_activation_hook(__FILE__, ['KozmoAI_WP\\Activator', 'activate']);
register_deactivation_hook(__FILE__, ['KozmoAI_WP\\Deactivator', 'deactivate']);
register_uninstall_hook(__FILE__, ['KozmoAI_WP\\Uninstaller', 'uninstall']);

// ─── Init ───────────────────────────────────────────
add_action('plugins_loaded', function () {
    load_plugin_textdomain('kozmo-ai-wp', false, dirname(KOZMO_AI_WP_BASENAME) . '/languages');

    $plugin = KozmoAI_WP\Main::get_instance();
    $plugin->init();
});

// ─── Flush rewrites on activation ───────────────────
register_activation_hook(__FILE__, function () {
    flush_rewrite_rules();
});
