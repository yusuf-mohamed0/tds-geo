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
    }
}
