<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Security {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function verify_nonce(string $action, string $nonce_field = '_wpnonce'): bool {
        $nonce = isset($_REQUEST[$nonce_field]) ? sanitize_text_field(wp_unslash($_REQUEST[$nonce_field])) : '';
        return (bool) wp_verify_nonce($nonce, $action);
    }

    public static function verify_admin(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'kozmo-ai-wp'));
        }
    }

    public static function sanitize_deep($value) {
        if (is_array($value)) {
            return array_map([self::class, 'sanitize_deep'], $value);
        }
        if (is_string($value)) {
            return sanitize_text_field(wp_unslash($value));
        }
        return $value;
    }

    public static function sanitize_html(string $html): string {
        return wp_kses_post($html);
    }

    public static function sanitize_key(string $key): string {
        return sanitize_key($key);
    }

    public static function escape_output(string $output): string {
        return esc_html($output);
    }

    public static function is_valid_url(string $url): bool {
        return (bool) filter_var($url, FILTER_VALIDATE_URL);
    }

    public static function is_valid_email(string $email): bool {
        return (bool) is_email($email);
    }

    public static function generate_nonce(string $action = 'kozmo_ai_wp_action'): string {
        return wp_create_nonce($action);
    }

    public static function ajax_nonce_check(string $action = 'kozmo_ai_wp_ajax'): void {
        check_ajax_referer($action, 'nonce');
    }
}
