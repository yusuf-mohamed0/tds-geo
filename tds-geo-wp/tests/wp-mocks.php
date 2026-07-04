<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
// Minimal WordPress function mocks for testing

// Core globals
if (!isset($GLOBALS['wpdb'])) {
    $GLOBALS['wpdb'] = new stdClass();
    $GLOBALS['wpdb']->prefix = 'wp_';
}
if (!isset($GLOBALS['wp_actions'])) $GLOBALS['wp_actions'] = [];

// Plugin functions
function register_activation_hook($file, $callback) {}
function register_deactivation_hook($file, $callback) {}
function register_uninstall_hook($file, $callback) {}
function flush_rewrite_rules() {}
function plugin_dir_path($f) { return dirname($f) . '/'; }
function plugin_dir_url($f) { return 'http://ex.com/wp-content/plugins/' . basename(dirname($f)) . '/'; }
function plugin_basename($f) { return basename(dirname($f)) . '/' . basename($f); }

// Hook system
function add_action($hook, $callback, $priority = 10, $accepted_args = 1) {
    $GLOBALS['wp_actions'][$hook][] = $callback;
}
function add_filter($hook, $callback, $priority = 10, $accepted_args = 1) {}
function do_action($hook) {}
function apply_filters($hook, $value) { return $value; }
function current_user_can($cap) { return true; }
function wp_die($msg) { echo "wp_die: $msg\n"; exit; }

// i18n
function __($t, $d = 'default') { return $t; }
function _e($t, $d = 'default') { echo $t; }
function esc_html__($t, $d = 'default') { return $t; }
function esc_attr__($t, $d = 'default') { return $t; }
function load_plugin_textdomain($d, $p = false, $path = '') {}

// Sanitization
function esc_html($t) { return htmlspecialchars($t); }
function esc_attr($t) { return htmlspecialchars($t); }
function esc_url($u) { return $u; }
function esc_url_raw($u) { return $u; }
function sanitize_text_field($s) { return $s; }
function sanitize_textarea_field($s) { return $s; }
function sanitize_title($s) { return strtolower(preg_replace('/[^a-zA-Z0-9-]/', '-', $s)); }
function wp_kses_post($s) { return $s; }
function wp_unslash($s) { return $s; }
function absint($v) { return abs((int)$v); }
function wp_json_encode($d) { return json_encode($d); }

// Options
function get_option($k, $d = false) { return $d; }
function update_option($k, $v) { return true; }
function add_option($k, $v, $d = '', $a = 'yes') { return true; }
function delete_option($k) { return true; }

// Time
function current_time($t) { return date('Y-m-d H:i:s'); }
function wp_date($f, $ts = null) { return date($f, $ts ?: time()); }
function wp_timezone_string() { return 'UTC'; }
function get_locale() { return 'en_US'; }
function get_bloginfo($s = '') { return 'Test Site'; }
function get_current_user_id() { return 1; }
function is_admin() { return true; }
function is_multisite() { return false; }
function wp_using_ext_object_cache() { return false; }

// Cron
function wp_next_scheduled($h) { return false; }
function wp_schedule_event($t, $r, $h) {}
function wp_unschedule_event($t, $h) {}

// Admin
function admin_url($p) { return 'http://ex.com/wp-admin/' . $p; }
function add_query_arg($k, $v, $u) { return $u . '?' . $k . '=' . $v; }
function wp_safe_redirect($u) {}
function check_admin_referer($a, $q) {}
function check_ajax_referer($a, $q) {}
function add_menu_page($t, $m, $c, $s, $fn, $i, $p) {}
function add_submenu_page($p, $t, $m, $c, $s, $fn) {}
function wp_enqueue_style($h, $s, $d, $v) {}
function wp_enqueue_script($h, $s, $d, $v, $f) {}
function wp_localize_script($h, $n, $d) {}

// REST
function rest_url($p) { return 'http://ex.com/wp-json/' . $p; }
function register_rest_route($n, $r, $a) {}

// Posts/Content
function get_post($id) { return null; }
function get_posts($a) { return []; }
function wp_get_post_categories($i, $a) { return []; }
function wp_get_post_tags($i, $a) { return []; }
function get_the_post_thumbnail_url($i, $s) { return ''; }
function get_permalink($i) { return ''; }
function get_post_meta($i, $k, $s = false) { return ''; }
function update_post_meta($i, $k, $v) { return true; }
function wp_set_post_tags($i, $t, $a) {}
function wp_set_post_categories($i, $c, $a) {}
function set_post_thumbnail($i, $a) {}
function has_post_thumbnail($i) { return false; }
function get_the_author_meta($f, $i) { return ''; }
function wp_strip_all_tags($s) { return strip_tags($s); }
function wp_trim_words($t, $n) { $words = explode(' ', $t); return implode(' ', array_slice($words, 0, $n)); }
function wp_insert_post($d, $e = false) { return 1; }
function wp_update_post($d, $e = false) { return 1; }
function wp_delete_post($i, $f = false) { return true; }
function wp_publish_post($i) {}

// Taxonomies
function get_terms($a) { return []; }
function get_categories($a) { return []; }
function get_tags($a) { return []; }
function term_exists($n, $t = '') { return null; }
function wp_insert_term($n, $t, $a = []) { return ['term_id' => 1]; }
function get_taxonomies($a, $o) { return []; }

// Theme/nav
function get_nav_menu_locations() { return []; }
function wp_get_nav_menu_object($id) { return null; }
function wp_get_nav_menu_items($id) { return []; }
function wp_get_sidebars_widgets() { return []; }
function get_theme_mod($k, $d = false) { return $d; }

// Posts count
function wp_count_posts($t) {
    return (object)['publish'=>0,'draft'=>0,'pending'=>0,'future'=>0,'private'=>0,'trash'=>0];
}
function wp_count_attachments($m) { return (object)['inherit' => 0]; }
function get_post_types($a, $o = 'names') { return $o === 'names' ? ['post','page'] : []; }

// Users
function count_users() { return ['total_users'=>1,'avail_roles'=>['administrator'=>1]]; }
function get_users($a) { return []; }
function get_userdata($id) { return null; }

// Files
function wp_upload_dir() { return ['baseurl'=>'http://ex.com/wp-uploads','basedir'=>'/tmp/wp-uploads']; }
function wp_max_upload_size() { return 10485760; }
function size_format($b) { return '10 MB'; }
function get_site_icon_url() { return ''; }

// Theme
function wp_get_theme() {
    static $theme = null;
    if (!$theme) {
        $theme = new stdClass();
        $theme->name = 'Test Theme';
        $theme->version = '1.0';
        $theme->author = 'Test';
        $theme->uri = '';
        $theme->screenshot = '';
        $theme->tags = [];
        $theme->textdomain = 'test';
        $theme->get = function($k) { return ''; };
        $theme->get_screenshot = function() { return ''; };
        $theme->get_stylesheet = function() { return 'test'; };
        $theme->get_template = function() { return 'test'; };
    }
    return $theme;
}
function is_child_theme() { return false; }

// Plugins
function get_plugins() { return []; }
function is_plugin_active($p) { return false; }

// Security
function wp_verify_nonce($n, $a) { return true; }
function wp_hash($d, $s) { return hash('sha256', $d); }
function wp_salt($s) { return 'test_salt'; }

// WP_Query
if (!class_exists('WP_Query')) {
    class WP_Query {
        public $posts = [];
        public $found_posts = 0;
        public function __construct($a = []) {}
    }
}

// WP_Post
if (!class_exists('WP_Post')) {
    class WP_Post {
        public $ID = 0;
        public $post_title = '';
        public $post_content = '';
        public $post_excerpt = '';
        public $post_status = 'draft';
        public $post_type = 'post';
        public $post_name = '';
        public $post_author = 1;
        public $post_date = '';
        public $post_modified = '';
    }
}

// WP_REST_Response
if (!class_exists('WP_REST_Response')) {
    class WP_REST_Response {
        public function __construct($d = [], $s = 200) {}
    }
}
if (!class_exists('WP_REST_Request')) {
    class WP_REST_Request {
        public function get_params() { return []; }
        public function get_param($k) { return null; }
        public function get_json_params() { return []; }
        public function get_header($k) { return ''; }
        public function get_body() { return ''; }
    }
}

// WP_Error
if (!class_exists('WP_Error')) {
    class WP_Error {
        private $msg = '';
        public function __construct($c = '', $m = '') { $this->msg = $m; }
        public function get_error_message() { return $this->msg; }
    }
}

// Constants
if (!defined('OBJECT')) define('OBJECT', 'OBJECT');
if (!defined('OBJECT_K')) define('OBJECT_K', 'OBJECT_K');
if (!defined('ARRAY_A')) define('ARRAY_A', 'ARRAY_A');
if (!defined('DAY_IN_SECONDS')) define('DAY_IN_SECONDS', 86400);
if (!defined('HOUR_IN_SECONDS')) define('HOUR_IN_SECONDS', 3600);
if (!defined('MINUTE_IN_SECONDS')) define('MINUTE_IN_SECONDS', 60);
if (!defined('WP_MEMORY_LIMIT')) define('WP_MEMORY_LIMIT', '128M');
if (!defined('WP_CONTENT_DIR')) define('WP_CONTENT_DIR', '/tmp/wp-content');
