<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Update system — checks for and manages plugin updates.
 */
class Update {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('plugins_loaded', [self::class, 'maybe_upgrade'], 5);
        add_filter('plugins_api', [self::class, 'plugin_info'], 20, 3);
        add_filter('site_transient_update_plugins', [self::class, 'check_update']);
    }

    public static function maybe_upgrade(): void {
        $stored_db_version = (string) get_option('kozmo_ai_wp_db_version', '');
        $stored_plugin_version = (string) get_option('kozmo_ai_wp_plugin_version', '');

        if ($stored_db_version === KOZMO_AI_WP_DB_VERSION && $stored_plugin_version === KOZMO_AI_WP_VERSION) {
            return;
        }

        Activator::upgrade();
    }

    public static function plugin_info($res, $action, $args) {
        if ('plugin_information' !== $action) return $res;
        if ('kozmo-ai-wp' !== ($args->slug ?? '')) return $res;

        $res = new \stdClass();
        $res->name = 'KOZMO AI — Autonomous WP Agent';
        $res->slug = 'kozmo-ai-wp';
        $res->version = KOZMO_AI_WP_VERSION;
        $res->author = '<a href="https://vireon.io">KOZMO AI</a>';
        $res->homepage = 'https://vireon.io/wordpress';
        $res->requires = '5.8';
        $res->tested = '6.4';
        $res->requires_php = '7.4';
        $res->downloaded = 0;
        $res->last_updated = '2026-06-16';
        $res->sections = [
            'description' => 'Autonomous AI agent for WordPress that automatically understands, manages, and grows your website.',
            'installation' => '1. Upload the plugin. 2. Activate. 3. Connect your API key. 4. The AI agent takes over.',
            'changelog' => 'Full changelog available at https://vireon.io/changelog',
        ];
        $res->banners = [];
        $res->icons = [];

        return $res;
    }

    public static function check_update($transient) {
        if (empty($transient->checked)) return $transient;
        return $transient;
    }
}
