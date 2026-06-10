<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Deactivator {
    public static function deactivate(): void {
        Activator::clear_crons();
        flush_rewrite_rules();
    }
}
