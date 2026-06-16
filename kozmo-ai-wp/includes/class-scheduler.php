<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Scheduler — manages WP-Cron hooks for periodic tasks.
 */
class Scheduler {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('init', [self::class, 'schedule_auto_generation']);
    }

    /**
     * Schedule the auto-generation cron job if it's not already scheduled.
     */
    public static function schedule_auto_generation(?string $frequency = null, bool $force_reschedule = false): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        if (($settings['enable_auto_generation'] ?? 'yes') !== 'yes') {
            self::clear_auto_generation();
            return;
        }

        $frequency = $frequency ?: ($settings['generation_frequency'] ?? 'kozmo_ai_every_15min');

        if ($force_reschedule) {
            self::clear_auto_generation();
        }

        if (!wp_next_scheduled('kozmo_ai_generate_articles')) {
            if (ContentGenerator::is_configured()) {
                wp_schedule_event(time() + 600, $frequency, 'kozmo_ai_generate_articles');
            }
        }
    }

    /**
     * Remove all scheduled auto-generation events.
     */
    public static function clear_auto_generation(): void {
        $timestamp = wp_next_scheduled('kozmo_ai_generate_articles');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'kozmo_ai_generate_articles');
        }
        $timestamp = wp_next_scheduled('kozmo_ai_discover_topics');
        if ($timestamp) {
            wp_unschedule_event($timestamp, 'kozmo_ai_discover_topics');
        }
    }
}
