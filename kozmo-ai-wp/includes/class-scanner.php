<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Scanner {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_scan', [self::class, 'run_full_scan']);
        add_action('kozmo_ai_heartbeat', [self::class, 'heartbeat']);
    }

    public static function heartbeat(): void {
        // Check for pending tasks
        global $wpdb;
        $pending = $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_queue WHERE status = 'pending' AND scheduled_at <= NOW()");
        if ((int) $pending > 0) {
            Worker::process_queue();
        }
    }

    public static function run_full_scan(): array {
        Logger::info('Starting full website scan');

        $data = [
            'site'       => self::scan_site_info(),
            'structure'  => self::scan_structure(),
            'content'    => self::scan_content_stats(),
            'taxonomies' => self::scan_taxonomies(),
            'media'      => self::scan_media(),
            'theme'      => self::scan_theme(),
            'plugins'    => self::scan_plugins(),
            'seo'        => self::scan_seo_config(),
            'users'      => self::scan_users(),
            'performance' => self::scan_performance(),
        ];

        // Store in knowledge base
        foreach ($data as $type => $values) {
            KnowledgeBase::store($type, $values);
        }

        KnowledgeBase::store('last_scan', [
            'timestamp' => current_time('mysql'),
            'summary'   => self::generate_summary($data),
        ]);

        $settings = get_option('kozmo_ai_wp_settings', []);
        $settings['last_scan_at'] = current_time('mysql');
        update_option('kozmo_ai_wp_settings', $settings);

        // Sync with agent
        self::sync_with_agent($data);

        Logger::info('Full website scan completed', [
            'site'      => $data['site']['name'],
            'posts'     => $data['content']['posts'],
            'pages'     => $data['content']['pages'],
            'categories' => $data['taxonomies']['categories'],
            'tags'      => $data['taxonomies']['tags'],
            'plugins'   => count($data['plugins']),
        ]);

        return $data;
    }

    private static function scan_site_info(): array {
        return [
            'name'        => get_bloginfo('name'),
            'description' => get_bloginfo('description'),
            'url'         => get_bloginfo('url'),
            'wp_url'      => get_bloginfo('wpurl'),
            'language'    => get_bloginfo('language'),
            'charset'     => get_bloginfo('charset'),
            'admin_email' => get_bloginfo('admin_email'),
            'timezone'    => wp_timezone_string(),
            'locale'      => get_locale(),
            'site_icon'   => get_site_icon_url(),
            'version'     => get_bloginfo('version'),
            'multisite'   => is_multisite(),
            'permalink'   => get_option('permalink_structure'),
            'posts_per_page' => get_option('posts_per_page'),
            'date_format' => get_option('date_format'),
            'time_format' => get_option('time_format'),
            'blog_public' => get_option('blog_public'),
            'robots'      => self::get_robots_txt(),
        ];
    }

    private static function get_robots_txt(): string {
        $uploads = wp_upload_dir();
        $robots_path = ABSPATH . 'robots.txt';
        if (file_exists($robots_path)) {
            return file_get_contents($robots_path);
        }
        return '';
    }

    private static function scan_structure(): array {
        $menus = [];
        $locations = get_nav_menu_locations();
        foreach ($locations as $location => $menu_id) {
            $menu = wp_get_nav_menu_object($menu_id);
            if ($menu) {
                $items = wp_get_nav_menu_items($menu_id);
                $menu_items = [];
                if ($items) {
                    foreach ($items as $item) {
                        $menu_items[] = [
                            'title' => $item->title,
                            'url'   => $item->url,
                            'type'  => $item->type,
                            'target' => $item->target,
                            'parent' => $item->menu_item_parent,
                        ];
                    }
                }
                $menus[] = [
                    'name'        => $menu->name,
                    'location'    => $location,
                    'items'       => $menu_items,
                    'item_count'  => count($menu_items),
                ];
            }
        }

        $widgets = [];
        $sidebars = wp_get_sidebars_widgets();
        foreach ($sidebars as $sidebar => $widget_ids) {
            if ('wp_inactive_widgets' === $sidebar) continue;
            $widgets[$sidebar] = $widget_ids ? count($widget_ids) : 0;
        }

        return [
            'menus'        => $menus,
            'menu_locations' => array_keys($locations),
            'widget_areas' => $widgets,
            'sidebar_count' => count($sidebars),
            'nav_menu_count' => count($menus),
        ];
    }

    private static function scan_content_stats(): array {
        $post_types = get_post_types(['public' => true], 'objects');
        $stats = [];

        foreach ($post_types as $pt) {
            $counts = wp_count_posts($pt->name);
            $stats[$pt->name] = [
                'label'   => $pt->label,
                'public'  => $pt->public,
                'hierarchical' => $pt->hierarchical,
                'has_archive'  => $pt->has_archive,
                'counts'  => [
                    'publish' => (int) ($counts->publish ?? 0),
                    'draft'   => (int) ($counts->draft ?? 0),
                    'pending' => (int) ($counts->pending ?? 0),
                    'future'  => (int) ($counts->future ?? 0),
                    'private' => (int) ($counts->private ?? 0),
                    'trash'   => (int) ($counts->trash ?? 0),
                ],
                'total'   => (int) array_sum((array) $counts),
            ];
        }

        // WooCommerce detection
        $is_woocommerce = in_array('woocommerce/woocommerce.php', apply_filters('active_plugins', get_option('active_plugins', [])));
        if (!function_exists('is_plugin_active')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $is_woocommerce = $is_woocommerce || (function_exists('is_plugin_active') && is_plugin_active('woocommerce/woocommerce.php'));
        if ($is_woocommerce) {
            $stats['product'] = [
                'label' => 'Products',
                'total' => (int) wp_count_posts('product')->publish ?? 0,
            ];
        }

        return $stats;
    }

    private static function scan_taxonomies(): array {
        $cats = get_categories(['hide_empty' => false]);
        $tags = get_tags(['hide_empty' => false]);

        return [
            'categories' => count($cats),
            'category_list' => array_map(function($c) {
                return ['id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug, 'count' => $c->count, 'parent' => $c->parent];
            }, $cats),
            'tags' => count($tags),
            'tag_list' => array_map(function($t) {
                return ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count];
            }, $tags),
            'custom_taxonomies' => get_taxonomies(['_builtin' => false, 'public' => true], 'names'),
        ];
    }

    private static function scan_media(): array {
        $total = (int) wp_count_posts('attachment')->inherit ?? 0;
        $sizes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'application/pdf'];
        $by_mime = [];
        foreach ($sizes as $mime) {
            $by_mime[$mime] = (int) wp_count_attachments($mime)->inherit ?? 0;
        }
        return [
            'total'  => $total,
            'by_mime' => $by_mime,
            'max_upload' => size_format(wp_max_upload_size()),
            'uploads_dir' => wp_upload_dir()['baseurl'],
        ];
    }

    private static function scan_theme(): array {
        $theme = wp_get_theme();
        return [
            'name'        => $theme->get('Name'),
            'version'     => $theme->get('Version'),
            'author'      => $theme->get('Author'),
            'uri'         => $theme->get('ThemeURI'),
            'parent_theme' => $theme->get('Template') !== $theme->get_stylesheet() ? $theme->get('Template') : null,
            'has_child'   => is_child_theme(),
            'screenshot'  => $theme->get_screenshot(),
            'tags'        => $theme->get('Tags'),
            'text_domain' => $theme->get('TextDomain'),
        ];
    }

    private static function scan_plugins(): array {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $all = get_plugins();
        $active = get_option('active_plugins', []);
        $plugins = [];
        foreach ($all as $slug => $data) {
            $plugins[] = [
                'name'    => $data['Name'],
                'slug'    => dirname($slug),
                'version' => $data['Version'],
                'active'  => in_array($slug, $active, true),
                'plugin_url' => $data['PluginURI'],
            ];
        }
        // Detect SEO plugins specifically
        $seo = [];
        if (defined('WPSEO_VERSION')) $seo['yoast'] = WPSEO_VERSION;
        if (defined('RANK_MATH_VERSION')) $seo['rank_math'] = RANK_MATH_VERSION;
        if (defined('AIOSEO_VERSION')) $seo['aioseo'] = AIOSEO_VERSION;

        return ['all' => $plugins, 'seo_plugins' => $seo, 'count' => count($plugins), 'active_count' => count($active)];
    }

    private static function scan_seo_config(): array {
        $seo_data = [
            'yoast_config' => [],
            'rank_math_config' => [],
            'has_sitemap'  => false,
            'has_robots'   => file_exists(ABSPATH . 'robots.txt'),
        ];

        if (defined('WPSEO_VERSION')) {
            $seo_data['yoast_config'] = [
                'title_separator' => get_option('wpseo_titles')['separator'] ?? '',
                'disable_author'  => get_option('wpseo_titles')['disable-author'] ?? false,
                'noindex_cats'    => get_option('wpseo_titles')['noindex-category'] ?? false,
                'noindex_tags'    => get_option('wpseo_titles')['noindex-post_tag'] ?? false,
            ];
            $seo_data['has_sitemap'] = (bool) get_option('wpseo')['enable_xml_sitemap'] ?? false;
        }

        if (defined('RANK_MATH_VERSION')) {
            $seo_data['rank_math_config'] = [
                'sitemap' => get_option('rank-math-options-sitemap')['items_per_page'] ?? 200,
            ];
            $seo_data['has_sitemap'] = true;
        }

        return $seo_data;
    }

    private static function scan_users(): array {
        $counts = count_users();
        $authors = get_users([
            'who'      => 'authors',
            'orderby'  => 'display_name',
            'fields'   => ['ID', 'display_name', 'user_email', 'roles'],
        ]);
        return [
            'total_users' => $counts['total_users'],
            'by_role'     => $counts['avail_roles'],
            'authors'     => array_map(function($u) {
                return ['id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'roles' => $u->roles];
            }, $authors),
        ];
    }

    private static function scan_performance(): array {
        global $wpdb;
        return [
            'db_engine'     => $wpdb->dbh ? 'connected' : 'disconnected',
            'db_collation'  => $wpdb->get_charset_collate(),
            'object_cache'  => wp_using_ext_object_cache(),
            'cache_plugins' => defined('WP_CACHE') && WP_CACHE,
            'php_version'   => PHP_VERSION,
            'memory_limit'  => WP_MEMORY_LIMIT,
            'max_execution' => ini_get('max_execution_time'),
            'post_count'    => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'publish'"),
            'comment_count' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved = '1'"),
        ];
    }

    private static function generate_summary(array $data): array {
        $total_posts = 0;
        foreach ($data['content'] as $pt => $stats) {
            if (is_array($stats) && isset($stats['total'])) $total_posts += $stats['total'];
        }
        return [
            'site_name'       => $data['site']['name'],
            'total_posts'     => $total_posts,
            'total_media'     => $data['media']['total'],
            'categories'      => $data['taxonomies']['categories'],
            'tags'            => $data['taxonomies']['tags'],
            'installed_plugins' => $data['plugins']['count'],
            'active_plugins'  => $data['plugins']['active_count'],
            'seo_plugins'     => array_keys($data['plugins']['seo_plugins']),
            'theme'           => $data['theme']['name'],
            'language'        => $data['site']['language'],
            'timezone'        => $data['site']['timezone'],
        ];
    }

    private static function sync_with_agent(array $data): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $api_key = get_option('kozmo_ai_wp_initial_key', '');

        if (empty($api_key)) {
            // Find first active key
            global $wpdb;
            $api_key = $wpdb->get_var("SELECT api_key FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE is_active = 1 LIMIT 1");
        }

        if (empty($api_key)) return;

        $agent_url = rtrim($settings['agent_url'] ?? KOZMO_AI_WP_AGENT_URL, '/');
        $response = wp_remote_post($agent_url . '/api/agent/webhook/sync', [
            'timeout' => 30,
            'headers' => [
                'Content-Type'  => 'application/json',
                'X-KOZMO-AI-Key' => $api_key,
            ],
            'body'    => wp_json_encode([
                'event' => 'website.scanned',
                'data'  => $data,
                'site'  => [
                    'url'   => get_bloginfo('url'),
                    'name'  => get_bloginfo('name'),
                ],
            ]),
        ]);

        if (is_wp_error($response)) {
            Logger::warning('Failed to sync scan with agent', ['error' => $response->get_error_message()]);
            return;
        }

        KnowledgeBase::set_synced();
        Logger::info('Scan synced with agent');
    }
}
