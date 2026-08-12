<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class AdminRemote {
    private static ?self $instance = null;

    private const MALWARE_PATTERNS = [
        '/base64_decode\s*\(\s*[\'\"][A-Za-z0-9+\/=]{100,}[\'\"]\s*\)/s',
        '/eval\s*\(\s*(base64_decode|gzuncompress|gzinflate|str_rot13)/s',
        '/eval\s*\(\s*\$_(GET|POST|REQUEST|COOKIE|SERVER)/s',
        '/preg_replace\s*\(\s*[\'\"].*[\/eE][\'\"]\s*,/s',
        '/\$(GET|POST|REQUEST|COOKIE|SERVER)\s*\(/',
        '/create_function\s*\(\s*[\'\"]/s',
        '/assert\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/\$_=(base64_decode|str_rot13|gzuncompress|gzinflate)/s',
        '/\\\\x[0-9a-fA-F]{2}\\\\x[0-9a-fA-F]{2}\\\\x[0-9a-fA-F]{2}/s',
        '/system\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/exec\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/shell_exec\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/passthru\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/call_user_func\s*\(\s*\$_(GET|POST|REQUEST)/s',
        '/chr\s*\(\d+\)\s*\.\s*chr\s*\(/s',
        '/\\\\\$\{?[a-z_][a-z0-9_]*\}?\s*\(/i',
        '/\$[a-z_][a-z0-9_]*\s*\.\s*\$[a-z_][a-z0-9_]*\s*\.\s*\$[a-z_][a-z0-9_]*\s*\./i',
    ];

    private const MALWARE_HINT_LABELS = [
        'Long base64 string passed to base64_decode',
        'eval() with encoded input',
        'eval() with superglobal input',
        'preg_replace with /e modifier (deprecated code execution)',
        'Superglobal used as function call (backdoor)',
        'create_function (deprecated code execution)',
        'assert with user input',
        'Variable assignment from encoded function',
        'Hex-encoded string sequences',
        'system() with user input',
        'exec() with user input',
        'shell_exec() with user input',
        'passthru() with user input',
        'call_user_func with user input',
        'chr() concatenation (obfuscation)',
        'Variable as function call',
        'String concatenation with dots (obfuscation)',
    ];

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void {
        $ns = KIVO_WP_API_NAMESPACE;
        $auth = [self::class, 'check_permission'];

        register_rest_route($ns, '/admin/files/scan', [
            'methods' => 'GET',
            'callback' => [self::class, 'scan_files'],
            'permission_callback' => $auth,
            'args' => [
                'path' => ['type' => 'string', 'default' => ''],
                'recursive' => ['type' => 'boolean', 'default' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/files/read', [
            'methods' => 'GET',
            'callback' => [self::class, 'read_file'],
            'permission_callback' => $auth,
            'args' => [
                'path' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/files/write', [
            'methods' => 'POST',
            'callback' => [self::class, 'write_file'],
            'permission_callback' => $auth,
            'args' => [
                'path' => ['type' => 'string', 'required' => true],
                'content' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/plugins/list', [
            'methods' => 'GET',
            'callback' => [self::class, 'list_plugins'],
            'permission_callback' => $auth,
        ]);

        register_rest_route($ns, '/admin/plugins/toggle', [
            'methods' => 'POST',
            'callback' => [self::class, 'toggle_plugin'],
            'permission_callback' => $auth,
            'args' => [
                'plugin' => ['type' => 'string', 'required' => true],
                'action' => ['type' => 'string', 'enum' => ['activate', 'deactivate'], 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/themes/list', [
            'methods' => 'GET',
            'callback' => [self::class, 'list_themes'],
            'permission_callback' => $auth,
        ]);

        register_rest_route($ns, '/admin/themes/activate', [
            'methods' => 'POST',
            'callback' => [self::class, 'activate_theme'],
            'permission_callback' => $auth,
            'args' => [
                'stylesheet' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/db/options', [
            'methods' => 'GET',
            'callback' => [self::class, 'db_options'],
            'permission_callback' => $auth,
            'args' => [
                'search' => ['type' => 'string', 'default' => ''],
                'limit' => ['type' => 'integer', 'default' => 50],
            ],
        ]);

        register_rest_route($ns, '/admin/db/query', [
            'methods' => 'POST',
            'callback' => [self::class, 'db_query'],
            'permission_callback' => $auth,
            'args' => [
                'query' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/db/update-option', [
            'methods' => 'POST',
            'callback' => [self::class, 'db_update_option'],
            'permission_callback' => $auth,
            'args' => [
                'option_name' => ['type' => 'string', 'required' => true],
                'option_value' => ['type' => 'string', 'required' => true],
                'autoload' => ['type' => 'string', 'default' => 'no'],
            ],
        ]);

        register_rest_route($ns, '/admin/db/delete-option', [
            'methods' => 'POST',
            'callback' => [self::class, 'db_delete_option'],
            'permission_callback' => $auth,
            'args' => [
                'option_name' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/scan/malware', [
            'methods' => 'POST',
            'callback' => [self::class, 'scan_malware'],
            'permission_callback' => $auth,
            'args' => [
                'path' => ['type' => 'string', 'default' => ''],
                'depth' => ['type' => 'integer', 'default' => 5],
            ],
        ]);

        register_rest_route($ns, '/admin/scan/repair', [
            'methods' => 'POST',
            'callback' => [self::class, 'repair_file'],
            'permission_callback' => $auth,
            'args' => [
                'path' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/site/info', [
            'methods' => 'GET',
            'callback' => [self::class, 'site_info'],
            'permission_callback' => $auth,
        ]);

        register_rest_route($ns, '/admin/widgets/list', [
            'methods' => 'GET',
            'callback' => [self::class, 'list_widgets'],
            'permission_callback' => $auth,
        ]);

        register_rest_route($ns, '/admin/widgets/clear', [
            'methods' => 'POST',
            'callback' => [self::class, 'clear_sidebar_widgets'],
            'permission_callback' => $auth,
            'args' => [
                'sidebar' => ['type' => 'string', 'default' => ''],
            ],
        ]);

        register_rest_route($ns, '/admin/htaccess/read', [
            'methods' => 'GET',
            'callback' => [self::class, 'read_htaccess'],
            'permission_callback' => $auth,
        ]);

        register_rest_route($ns, '/admin/htaccess/write', [
            'methods' => 'POST',
            'callback' => [self::class, 'write_htaccess'],
            'permission_callback' => $auth,
            'args' => [
                'content' => ['type' => 'string', 'required' => true],
            ],
        ]);

        register_rest_route($ns, '/admin/core/file-check', [
            'methods' => 'POST',
            'callback' => [self::class, 'check_core_files'],
            'permission_callback' => $auth,
            'args' => [
                'files' => ['type' => 'array', 'items' => ['type' => 'string'], 'required' => true],
            ],
        ]);
    }

    public static function check_permission(): bool {
        if (is_user_logged_in() && current_user_can('manage_options')) return true;
        $auth = Auth::authenticate_request();
        return $auth['valid'] && (in_array('admin', $auth['permissions'], true) || in_array('write', $auth['permissions'], true));
    }

    private static function safe_path(string $path, string $subdir = ''): ?string {
        $base = $subdir ? ABSPATH . ltrim($subdir, '/') : ABSPATH;
        $real_base = realpath($base);
        $resolved = realpath($base . '/' . ltrim($path, '/'));
        if (false === $resolved) return null;
        if (strncmp($resolved, $real_base, strlen($real_base)) !== 0) return null;
        // Only allow .php, .html, .htm, .js, .css, .txt, .htaccess, .json, .xml, .svg, .png, .jpg, .jpeg, .gif, .ico, .woff2, .woff, .eot, .ttf
        $ext = strtolower(pathinfo($resolved, PATHINFO_EXTENSION));
        if (!in_array($ext, ['php', 'html', 'htm', 'js', 'css', 'txt', 'htaccess', 'json', 'xml', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'ico', 'woff2', 'woff', 'eot', 'ttf', 'pot'], true)) {
            // Allow files with no extension (like certain config files)
            if ($ext !== '') return null;
        }
        return $resolved;
    }

    private static function scan_dir(string $path, int $max_depth = 5, int $depth = 0): array {
        if ($depth > $max_depth) return [];
        $files = [];
        $real_path = realpath($path);
        if (false === $real_path || !is_dir($real_path)) return $files;
        $entries = scandir($real_path);
        if (false === $entries) return $files;
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $full = $real_path . '/' . $entry;
            if (is_dir($full)) {
                if ($depth < $max_depth) {
                    $files = array_merge($files, self::scan_dir($full, $max_depth, $depth + 1));
                }
            } elseif (is_file($full)) {
                $files[] = $full;
            }
        }
        return $files;
    }

    // ── File Operations ──

    public static function scan_files(\WP_REST_Request $request): \WP_REST_Response {
        $path = sanitize_text_field($request->get_param('path'));
        $recursive = (bool) $request->get_param('recursive');

        $base = ABSPATH . ltrim($path, '/');
        $real_base = realpath($base);
        if (false === $real_base || !is_dir($real_base) || strncmp($real_base, ABSPATH, strlen(ABSPATH)) !== 0) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Invalid directory path.'], 400);
        }

        if ($recursive) {
            $files = self::scan_dir($real_base, 5);
        } else {
            $entries = scandir($real_base);
            $files = [];
            if (is_array($entries)) {
                foreach ($entries as $entry) {
                    if ($entry === '.' || $entry === '..') continue;
                    $full = $real_base . '/' . $entry;
                    $files[] = $full;
                }
            }
        }

        $result = [];
        foreach ($files as $f) {
            $rel = str_replace(ABSPATH, '', $f);
            $ext = pathinfo($f, PATHINFO_EXTENSION);
            $result[] = [
                'path' => $rel,
                'name' => basename($f),
                'size' => is_file($f) ? filesize($f) : 0,
                'modified' => is_file($f) ? gmdate('Y-m-d H:i:s', filemtime($f)) : '',
                'type' => is_dir($f) ? 'dir' : ($ext ?: 'file'),
                'is_writable' => is_writable($f),
            ];
        }

        usort($result, fn($a, $b) => $a['path'] <=> $b['path']);

        return new \WP_REST_Response(['success' => true, 'data' => $result, 'total' => count($result)], 200);
    }

    public static function read_file(\WP_REST_Request $request): \WP_REST_Response {
        $path = sanitize_text_field($request->get_param('path'));
        $safe = self::safe_path($path);
        if (null === $safe || !is_file($safe)) {
            return new \WP_REST_Response(['success' => false, 'message' => 'File not found or access denied.'], 404);
        }
        $content = file_get_contents($safe);
        if (false === $content) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Could not read file.'], 500);
        }
        $lines = substr_count($content, "\n") + 1;
        return new \WP_REST_Response([
            'success' => true,
            'data' => [
                'path' => str_replace(ABSPATH, '', $safe),
                'name' => basename($safe),
                'size' => strlen($content),
                'lines' => $lines,
                'content' => $content,
                'is_writable' => is_writable($safe),
            ],
        ], 200);
    }

    public static function write_file(\WP_REST_Request $request): \WP_REST_Response {
        $path = sanitize_text_field($request->get_param('path'));
        $content = $request->get_param('content');

        $safe = self::safe_path($path);
        if (null === $safe) {
            return new \WP_REST_Response(['success' => false, 'message' => 'File not found or access denied.'], 404);
        }
        if (!is_writable($safe)) {
            return new \WP_REST_Response(['success' => false, 'message' => 'File is not writable.'], 403);
        }
        $bytes = file_put_contents($safe, $content);
        if (false === $bytes) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Could not write file.'], 500);
        }
        return new \WP_REST_Response(['success' => true, 'message' => "Written {$bytes} bytes.", 'data' => ['path' => str_replace(ABSPATH, '', $safe)]], 200);
    }

    // ── Plugin Management ──

    public static function list_plugins(): \WP_REST_Response {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $all = get_plugins();
        $active = get_option('active_plugins', []);
        $result = [];
        foreach ($all as $plugin_file => $data) {
            $result[] = [
                'file' => $plugin_file,
                'name' => $data['Name'],
                'version' => $data['Version'],
                'active' => in_array($plugin_file, $active, true) || is_plugin_active_for_network($plugin_file),
                'description' => $data['Description'],
                'author' => $data['Author'],
                'requires_wp' => $data['RequiresWP'] ?? '',
                'requires_php' => $data['RequiresPHP'] ?? '',
            ];
        }
        return new \WP_REST_Response(['success' => true, 'data' => $result, 'total' => count($result)], 200);
    }

    public static function toggle_plugin(\WP_REST_Request $request): \WP_REST_Response {
        $plugin_file = sanitize_text_field($request->get_param('plugin'));
        $action = $request->get_param('action');

        if (!function_exists('activate_plugin')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        if ($action === 'activate') {
            $result = activate_plugin($plugin_file, '', false, true);
            if (is_wp_error($result)) {
                return new \WP_REST_Response(['success' => false, 'message' => $result->get_error_message()], 400);
            }
            return new \WP_REST_Response(['success' => true, 'message' => "Activated: {$plugin_file}"], 200);
        } else {
            deactivate_plugins($plugin_file, false, false);
            return new \WP_REST_Response(['success' => true, 'message' => "Deactivated: {$plugin_file}"], 200);
        }
    }

    // ── Theme Management ──

    public static function list_themes(): \WP_REST_Response {
        $all = wp_get_themes();
        $current = get_stylesheet();
        $result = [];
        foreach ($all as $slug => $theme) {
            $result[] = [
                'slug' => $slug,
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'active' => $slug === $current,
                'author' => $theme->get('Author'),
                'description' => $theme->get('Description'),
                'has_parent' => $theme->parent() ? $theme->parent()->get('Name') : null,
            ];
        }
        return new \WP_REST_Response(['success' => true, 'data' => $result, 'total' => count($result)], 200);
    }

    public static function activate_theme(\WP_REST_Request $request): \WP_REST_Response {
        $stylesheet = sanitize_text_field($request->get_param('stylesheet'));
        $theme = wp_get_theme($stylesheet);
        if (!$theme->exists()) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Theme not found.'], 404);
        }
        switch_theme($stylesheet);
        return new \WP_REST_Response(['success' => true, 'message' => "Active theme: {$theme->get('Name')}"], 200);
    }

    // ── Widgets ──

    public static function list_widgets(): \WP_REST_Response {
        global $wp_registered_sidebars;
        $sidebars = [];
        foreach ($wp_registered_sidebars as $id => $sidebar) {
            $widgets = get_option("widgets_{$id}", []);
            $sidebars[] = [
                'id' => $id,
                'name' => $sidebar['name'],
                'widgets' => is_array($widgets) ? $widgets : [],
            ];
        }
        // Also check for inactive widgets
        $inactive = get_option('widget_block', []);
        $sidebars[] = [
            'id' => 'wp_inactive_widgets',
            'name' => 'Inactive Widgets',
            'widgets' => is_array($inactive) ? $inactive : [],
        ];
        return new \WP_REST_Response(['success' => true, 'data' => $sidebars], 200);
    }

    public static function clear_sidebar_widgets(\WP_REST_Request $request): \WP_REST_Response {
        $sidebar = sanitize_text_field($request->get_param('sidebar'));
        if (empty($sidebar)) {
            // Clear all sidebars
            global $wp_registered_sidebars;
            foreach ($wp_registered_sidebars as $id => $s) {
                update_option("widgets_{$id}", []);
            }
            return new \WP_REST_Response(['success' => true, 'message' => 'All sidebars cleared.'], 200);
        }
        $key = "widgets_{$sidebar}";
        $current = get_option($key, []);
        if (empty($current)) {
            return new \WP_REST_Response(['success' => true, 'message' => 'Sidebar already empty.'], 200);
        }
        update_option($key, []);
        return new \WP_REST_Response(['success' => true, 'message' => "Cleared widgets in sidebar: {$sidebar}"], 200);
    }

    // ── Database ──

    public static function db_options(\WP_REST_Request $request): \WP_REST_Response {
        global $wpdb;
        $search = sanitize_text_field($request->get_param('search'));
        $limit = min(100, absint($request->get_param('limit')));

        $where = '';
        $params = [];
        if (!empty($search)) {
            $where = "WHERE option_name LIKE %s OR option_value LIKE %s";
            $like = '%' . $wpdb->esc_like($search) . '%';
            $params = [$like, $like];
        }

        $rows = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT option_id, option_name, option_value, autoload FROM {$wpdb->options} {$where} ORDER BY option_id DESC LIMIT %d",
                array_merge($params, [$limit])
            ),
            ARRAY_A
        );

        foreach ($rows as &$row) {
            if (strlen($row['option_value']) > 500) {
                $row['option_value_truncated'] = substr($row['option_value'], 0, 500) . '...';
                $row['option_value_size'] = strlen($row['option_value']);
            } else {
                $row['option_value_truncated'] = $row['option_value'];
                $row['option_value_size'] = strlen($row['option_value']);
            }
        }

        return new \WP_REST_Response(['success' => true, 'data' => $rows, 'total' => count($rows)], 200);
    }

    public static function db_query(\WP_REST_Request $request): \WP_REST_Response {
        global $wpdb;
        $q = trim($request->get_param('query'));
        $allowed_prefixes = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'];
        $upper = strtoupper(substr($q, 0, 6));
        $allowed = false;
        foreach ($allowed_prefixes as $p) {
            if (str_starts_with($upper, $p)) {
                $allowed = true;
                break;
            }
        }
        if (!$allowed) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Only SELECT, SHOW, DESCRIBE, EXPLAIN queries are allowed.'], 403);
        }
        $results = $wpdb->get_results($q, ARRAY_A);
        if (null === $results) {
            return new \WP_REST_Response(['success' => false, 'message' => $wpdb->last_error], 500);
        }
        return new \WP_REST_Response(['success' => true, 'data' => $results, 'total' => count($results)], 200);
    }

    public static function db_update_option(\WP_REST_Request $request): \WP_REST_Response {
        $option_name = sanitize_text_field($request->get_param('option_name'));
        $option_value = $request->get_param('option_value');
        $autoload = in_array($request->get_param('autoload'), ['yes', 'no'], true) ? $request->get_param('autoload') : 'no';

        $updated = update_option($option_name, $option_value, $autoload === 'yes');
        if (!$updated && get_option($option_name) === $option_value) {
            return new \WP_REST_Response(['success' => true, 'message' => "Option '{$option_name}' already has that value.", 'data' => ['option_name' => $option_name]], 200);
        }
        if ($updated) {
            return new \WP_REST_Response(['success' => true, 'message' => "Option '{$option_name}' updated.", 'data' => ['option_name' => $option_name]], 200);
        }
        return new \WP_REST_Response(['success' => false, 'message' => "Could not update option '{$option_name}'."], 500);
    }

    public static function db_delete_option(\WP_REST_Request $request): \WP_REST_Response {
        $option_name = sanitize_text_field($request->get_param('option_name'));
        if (!str_starts_with($option_name, 'widget_') && !str_starts_with($option_name, 'theme_mod') && $option_name !== 'agraria_core_options') {
            // Only allow deleting widget/theme options and specific plugin options for safety
            return new \WP_REST_Response(['success' => false, 'message' => 'Option name must start with widget_ or theme_mod, or be a known sidebar option.'], 403);
        }
        $deleted = delete_option($option_name);
        if ($deleted) {
            return new \WP_REST_Response(['success' => true, 'message' => "Option '{$option_name}' deleted."], 200);
        }
        return new \WP_REST_Response(['success' => false, 'message' => "Option '{$option_name}' not found or could not be deleted."], 404);
    }

    // ── .htaccess ──

    public static function read_htaccess(): \WP_REST_Response {
        $path = ABSPATH . '.htaccess';
        if (!file_exists($path)) {
            return new \WP_REST_Response(['success' => true, 'data' => ['content' => '', 'path' => '.htaccess', 'exists' => false]], 200);
        }
        if (!is_readable($path)) {
            return new \WP_REST_Response(['success' => false, 'message' => '.htaccess exists but is not readable.'], 403);
        }
        $content = file_get_contents($path);
        return new \WP_REST_Response(['success' => true, 'data' => ['content' => $content ?: '', 'path' => '.htaccess', 'exists' => true, 'size' => strlen($content)]], 200);
    }

    public static function write_htaccess(\WP_REST_Request $request): \WP_REST_Response {
        $content = $request->get_param('content');
        $path = ABSPATH . '.htaccess';
        if (file_exists($path) && !is_writable($path)) {
            return new \WP_REST_Response(['success' => false, 'message' => '.htaccess is not writable.'], 403);
        }
        $bytes = file_put_contents($path, $content);
        if (false === $bytes) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Could not write .htaccess.'], 500);
        }
        return new \WP_REST_Response(['success' => true, 'message' => '.htaccess written.', 'data' => ['bytes' => $bytes]], 200);
    }

    // ── WordPress Core File Verification ──

    public static function check_core_files(\WP_REST_Request $request): \WP_REST_Response {
        global $wp_version;
        $files = $request->get_param('files');
        $results = [];
        foreach ($files as $f) {
            $safe = self::safe_path($f);
            if (null === $safe || !is_file($safe)) {
                $results[] = ['file' => $f, 'status' => 'not_found'];
                continue;
            }
            $md5 = md5_file($safe);
            $size = filesize($safe);
            $known = self::get_known_core_md5($f, $wp_version);
            $results[] = [
                'file' => $f,
                'status' => $known ? ($known === $md5 ? 'ok' : 'modified') : 'unknown',
                'md5' => $md5,
                'size' => $size,
                'expected_md5' => $known ?: null,
            ];
        }
        return new \WP_REST_Response(['success' => true, 'data' => $results], 200);
    }

    private static function get_known_core_md5(string $file, string $version): ?string {
        // Load checksums from WordPress.org API
        $url = "https://api.wordpress.org/core/checksums/1.0/?version={$version}&locale=en_US";
        $resp = wp_remote_get($url, ['timeout' => 10]);
        if (is_wp_error($resp)) return null;
        $body = wp_remote_retrieve_body($resp);
        $data = json_decode($body, true);
        if (empty($data['checksums'][$file])) return null;
        return $data['checksums'][$file];
    }

    // ── Malware Scanner ──

    public static function scan_malware(\WP_REST_Request $request): \WP_REST_Response {
        $path = sanitize_text_field($request->get_param('path'));
        $depth = min(10, max(1, absint($request->get_param('depth'))));

        $scan_dir = empty($path) ? ABSPATH : ABSPATH . ltrim($path, '/');
        $real_dir = realpath($scan_dir);
        if (false === $real_dir || !is_dir($real_dir)) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Invalid directory.'], 400);
        }

        $files = self::scan_dir($real_dir, $depth);
        $hits = [];
        $checked = 0;

        foreach ($files as $f) {
            $ext = pathinfo($f, PATHINFO_EXTENSION);
            if (!in_array($ext, ['php', 'html', 'htm', 'js'], true)) continue;
            if (filesize($f) > 5 * 1024 * 1024) continue; // Skip >5MB files

            $content = file_get_contents($f);
            if (false === $content) continue;
            $checked++;

            foreach (self::MALWARE_PATTERNS as $i => $pattern) {
                if (preg_match_all($pattern, $content, $matches, PREG_OFFSET_CAPTURE)) {
                    $rel = str_replace(ABSPATH, '', $f);
                    foreach ($matches[0] as $match) {
                        $line = substr_count(substr($content, 0, $match[1]), "\n") + 1;
                        $hits[] = [
                            'file' => $rel,
                            'line' => $line,
                            'pattern' => self::MALWARE_HINT_LABELS[$i] ?? "Pattern #{$i}",
                            'match' => substr($match[0], 0, 120),
                            'severity' => self::classify_severity($i),
                        ];
                    }
                }
            }
        }

        // Sort hits by file
        usort($hits, fn($a, $b) => strcmp($a['file'], $b['file']) ?: ($a['line'] - $b['line']));

        return new \WP_REST_Response([
            'success' => true,
            'data' => [
                'scanned' => $checked,
                'hits' => $hits,
                'total_hits' => count($hits),
                'scan_path' => str_replace(ABSPATH, '', $real_dir),
            ],
        ], 200);
    }

    private static function classify_severity(int $pattern_index): string {
        // Patterns 0-3: critical (direct code execution)
        // Patterns 4-7: high (backdoor patterns)
        // Patterns 8-11: medium (suspicious)
        // Patterns 12+: low (obfuscation)
        if ($pattern_index <= 3) return 'critical';
        if ($pattern_index <= 7) return 'high';
        if ($pattern_index <= 11) return 'medium';
        if ($pattern_index <= 14) return 'low';
        return 'info';
    }

    private static function remove_injected_code(string $content, string $file): string {
        $ext = pathinfo($file, PATHINFO_EXTENSION);

        if ($ext === 'php' && basename($file) === 'header.php') {
            // Remove injected scripts before <!DOCTYPE or after </html>
            $content = preg_replace('/^.*?(?=<!DOCTYPE|<html)/is', '', $content);
            // Remove anything after </html>
            $content = preg_replace('/<\/html>\s*.*$/is', '</html>', $content);
        }

        if ($ext === 'php' && basename($file) === 'functions.php') {
            // Remove eval/base64_decode chains at the top of the file
            $lines = explode("\n", $content);
            $clean = [];
            $skip = false;
            foreach ($lines as $line) {
                // Skip lines that are part of malware injection
                if (preg_match('/^(<\?php\s*)?(\/\*.*\*\/)?\s*eval\s*\(/i', trim($line))) {
                    $skip = true;
                    continue;
                }
                if ($skip && preg_match('/;\s*$/', trim($line))) {
                    $skip = false;
                    continue;
                }
                if (!$skip) {
                    $clean[] = $line;
                }
            }
            $content = implode("\n", $clean);
        }

        // General: remove base64_decode/eval chains
        $content = preg_replace('/eval\s*\(\s*base64_decode\s*\(\s*[\'\"][A-Za-z0-9+\/=]{50,}[\'\"]\s*\)\s*\)\s*;/s', '', $content);
        $content = preg_replace('/eval\s*\(\s*\$[a-zA-Z_\x7f-\xff][a-zA-Z0-9_\x7f-\xff]*\s*\)\s*;/s', '', $content);

        return $content;
    }

    public static function repair_file(\WP_REST_Request $request): \WP_REST_Response {
        $path = sanitize_text_field($request->get_param('path'));
        $safe = self::safe_path($path);

        if (null === $safe || !is_file($safe)) {
            return new \WP_REST_Response(['success' => false, 'message' => 'File not found.'], 404);
        }
        if (!is_writable($safe)) {
            return new \WP_REST_Response(['success' => false, 'message' => 'File is not writable.'], 403);
        }

        // Backup original
        $backup = $safe . '.bak.' . gmdate('YmdHis');
        copy($safe, $backup);

        $content = file_get_contents($safe);
        $original = $content;

        // Remove malware
        $content = self::remove_injected_code($content, $safe);
        $rel = str_replace(ABSPATH, '', $safe);

        if ($content === $original) {
            @unlink($backup);
            return new \WP_REST_Response(['success' => true, 'message' => 'No malware patterns found in file.', 'data' => ['path' => $rel, 'backup' => str_replace(ABSPATH, '', $backup)]], 200);
        }

        $bytes = file_put_contents($safe, $content);
        if (false === $bytes) {
            // Restore backup
            copy($backup, $safe);
            @unlink($backup);
            return new \WP_REST_Response(['success' => false, 'message' => 'Could not write repaired file.'], 500);
        }

        return new \WP_REST_Response([
            'success' => true,
            'message' => 'File repaired. Backup created.',
            'data' => [
                'path' => $rel,
                'backup' => str_replace(ABSPATH, '', $backup),
                'bytes_written' => $bytes,
            ],
        ], 200);
    }

    // ── Site Info ──

    public static function site_info(): \WP_REST_Response {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        global $wpdb, $wp_version;
        $active_plugins = get_option('active_plugins', []);
        $all_plugins = get_plugins();
        $plugin_list = [];
        foreach ($all_plugins as $f => $data) {
            $plugin_list[] = [
                'file' => $f,
                'name' => $data['Name'],
                'version' => $data['Version'],
                'active' => in_array($f, $active_plugins, true),
            ];
        }

        $themes = wp_get_themes();
        $theme_list = [];
        foreach ($themes as $slug => $theme) {
            $theme_list[] = [
                'slug' => $slug,
                'name' => $theme->get('Name'),
                'version' => $theme->get('Version'),
                'active' => $slug === get_stylesheet(),
            ];
        }

        $table_count = $wpdb->get_results("SHOW TABLE STATUS", ARRAY_A);
        $db_size = 0;
        foreach ($table_count as $t) {
            $db_size += ($t['Data_length'] + $t['Index_length']);
        }

        $info = [
            'wp_version' => $wp_version,
            'php_version' => PHP_VERSION,
            'mysql_version' => $wpdb->db_version(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'unknown',
            'site_url' => get_site_url(),
            'home_url' => get_home_url(),
            'admin_email' => get_bloginfo('admin_email'),
            'timezone' => wp_timezone_string(),
            'multisite' => is_multisite(),
            'debug_mode' => defined('WP_DEBUG') && WP_DEBUG,
            'memory_limit' => WP_MEMORY_LIMIT,
            'max_upload_size' => wp_max_upload_size(),
            'post_count' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status NOT IN ('auto-draft', 'trash')"),
            'user_count' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->users}"),
            'db_size_mb' => round($db_size / 1024 / 1024, 2),
            'plugins' => $plugin_list,
            'themes' => $theme_list,
            'active_theme' => get_stylesheet(),
            'permalink_structure' => get_option('permalink_structure'),
            'wordpress_cron' => defined('DISABLE_WP_CRON') ? !DISABLE_WP_CRON : true,
            'file_permissions' => [
                'wp-config' => is_writable(ABSPATH . 'wp-config.php'),
                'wp-content' => is_writable(WP_CONTENT_DIR),
                'htaccess' => file_exists(ABSPATH . '.htaccess') && is_writable(ABSPATH . '.htaccess'),
            ],
        ];

        return new \WP_REST_Response(['success' => true, 'data' => $info], 200);
    }
}
