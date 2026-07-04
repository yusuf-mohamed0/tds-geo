<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Deactivator {
    public static function deactivate(): void {
        flush_rewrite_rules();
    }
}
