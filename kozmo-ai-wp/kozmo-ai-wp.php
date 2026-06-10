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
    $file = $base_dir . 'class-' . strtolower(str_replace(['_', '\\'], ['-', '-'], $relative)) . '.php';

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
