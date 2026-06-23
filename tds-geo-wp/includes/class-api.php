<?php
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

/**
 * REST API endpoints — thin connector for TDS Geo.
 * Registers both tds-geo/v1 and (for backward compat) tds-geo/v1.
 */
class Api {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void {
        self::register_route_set(TDS_GEO_WP_API_NAMESPACE);

        if (!defined('TDS_GEO_API_NAMESPACE')) {
            define('TDS_GEO_API_NAMESPACE', 'tds-geo/v1');
        }
        self::register_route_set(TDS_GEO_API_NAMESPACE);
    }

    private static function register_route_set(string $ns): void {
        register_rest_route($ns, '/status', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'get_status'],
            'permission_callback' => [self::class, 'check_read_permission'],
        ]);

        register_rest_route($ns, '/posts', [
            ['methods' => 'POST', 'callback' => [self::class, 'create_post'], 'permission_callback' => [self::class, 'check_write_permission'], 'args' => self::post_args()],
            ['methods' => 'GET',  'callback' => [self::class, 'list_posts'], 'permission_callback' => [self::class, 'check_read_permission']],
        ]);
        register_rest_route($ns, '/posts/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [self::class, 'get_post'], 'permission_callback' => [self::class, 'check_read_permission']],
            ['methods' => 'PUT',    'callback' => [self::class, 'update_post'], 'permission_callback' => [self::class, 'check_write_permission']],
            ['methods' => 'DELETE', 'callback' => [self::class, 'delete_post'], 'permission_callback' => [self::class, 'check_write_permission']],
        ]);

        register_rest_route($ns, '/posts/batch', [
            'methods' => 'POST', 'callback' => [self::class, 'batch_posts'], 'permission_callback' => [self::class, 'check_write_permission'],
        ]);

        register_rest_route($ns, '/media', [
            'methods' => 'POST', 'callback' => [self::class, 'upload_media'], 'permission_callback' => [self::class, 'check_write_permission'],
        ]);

        register_rest_route($ns, '/categories', ['methods' => 'GET', 'callback' => [self::class, 'list_categories'], 'permission_callback' => [self::class, 'check_read_permission']]);
        register_rest_route($ns, '/tags', ['methods' => 'GET', 'callback' => [self::class, 'list_tags'], 'permission_callback' => [self::class, 'check_read_permission']]);
        register_rest_route($ns, '/authors', ['methods' => 'GET', 'callback' => [self::class, 'list_authors'], 'permission_callback' => [self::class, 'check_read_permission']]);

        register_rest_route($ns, '/settings', [
            ['methods' => 'GET', 'callback' => [self::class, 'get_settings'], 'permission_callback' => [self::class, 'check_read_permission']],
            ['methods' => 'PUT', 'callback' => [self::class, 'update_settings'], 'permission_callback' => [self::class, 'check_write_permission']],
        ]);

        register_rest_route($ns, '/webhook', ['methods' => 'POST', 'callback' => [self::class, 'handle_webhook'], 'permission_callback' => '__return_true']);
    }

    private static function is_api_enabled(): bool {
        $settings = get_option('tds_geo_wp_settings', []);
        return ($settings['api_enabled'] ?? 'yes') === 'yes';
    }

    private static function get_rate_limit_key(string $scope): string {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $path = $_SERVER['REQUEST_URI'] ?? '';
        return 'rest:' . $scope . ':' . $ip . ':' . md5($path);
    }

    private static function rate_limit_response(string $scope, int $max_requests, int $window): \WP_Error|true {
        $key = self::get_rate_limit_key($scope);
        if (RateLimiter::check($key, $max_requests, $window)) return true;
        $retry_after = max(1, RateLimiter::get_reset_time($key) - time());
        return new \WP_Error(
            'tds_geo_rate_limited',
            __('Rate limit exceeded.', 'tds-geo-wp'),
            ['status' => 429, 'retry_after' => $retry_after]
        );
    }

    public static function check_read_permission() {
        if (!self::is_api_enabled() || !Auth::check_read_permission()) return false;
        return self::rate_limit_response('read', 120, 60);
    }

    public static function check_write_permission() {
        if (!self::is_api_enabled() || !Auth::check_write_permission()) return false;
        return self::rate_limit_response('write', 30, 60);
    }

    // ── Status ──
    public static function get_status(): \WP_REST_Response {
        global $wpdb;
        $settings = get_option('tds_geo_wp_settings', []);
        $key_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}tds_geo_api_keys WHERE is_active = 1");
        $db_ok = !is_wp_error($wpdb->check_database_version());
        $imported_posts = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_tds_geo_imported_at'"
        );

        return new \WP_REST_Response([
            'success' => true,
            'data'    => [
                'status'           => 'ok',
                'version'          => TDS_GEO_WP_VERSION,
                'wp_version'       => get_bloginfo('version'),
                'php_version'      => PHP_VERSION,
                'database_ok'      => $db_ok,
                'api_enabled'      => self::is_api_enabled(),
                'active_keys'      => $key_count,
                'imported_posts'   => $imported_posts,
                'site_name'        => get_bloginfo('name'),
                'site_url'         => get_bloginfo('url'),
                'admin_email'      => get_bloginfo('admin_email'),
                'timezone'         => wp_timezone_string(),
                'locale'           => get_locale(),
                'seo_plugins'      => self::detect_seo_plugins(),
                'modules'          => Main::get_instance()->get_services(),
            ],
        ], 200);
    }

    // ── Posts ──
    public static function create_post(\WP_REST_Request $request): \WP_REST_Response {
        $article = $request->get_params();
        $result = Sync::create_post($article);
        if (!$result['success']) {
            return new \WP_REST_Response(['success' => false, 'message' => $result['message']], 400);
        }
        return new \WP_REST_Response([
            'success' => true,
            'data'    => ['post_id' => $result['post_id'], 'post_url' => $result['post_url']],
        ], 201);
    }

    public static function list_posts(\WP_REST_Request $request): \WP_REST_Response {
        $status  = $request->get_param('status');
        $limit   = $request->get_param('limit') ?: 20;
        $offset  = $request->get_param('offset') ?: 0;
        $agent_id = $request->get_param('agent_article_id');

        $args = [
            'post_type'      => 'any',
            'post_status'    => $status ?: 'any',
            'posts_per_page' => min(100, (int) $limit),
            'offset'         => (int) $offset,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($agent_id) {
            $args['meta_key'] = '_tds_geo_article_id';
            $args['meta_value'] = sanitize_text_field($agent_id);
        }

        $query = new \WP_Query($args);
        $posts = [];
        foreach ($query->posts as $post) {
            $posts[] = self::format_post($post);
        }

        return new \WP_REST_Response([
            'success' => true,
            'data'    => $posts,
            'total'   => (int) $query->found_posts,
        ], 200);
    }

    public static function get_post(\WP_REST_Request $request): \WP_REST_Response {
        $post = get_post($request->get_param('id'));
        if (!$post) return new \WP_REST_Response(['success' => false, 'message' => 'Post not found.'], 404);
        return new \WP_REST_Response(['success' => true, 'data' => self::format_post($post)], 200);
    }

    public static function update_post(\WP_REST_Request $request): \WP_REST_Response {
        $post_id = $request->get_param('id');
        $article = $request->get_params();
        unset($article['id']);
        $result = Sync::update_post($post_id, $article);
        return $result['success']
            ? new \WP_REST_Response(['success' => true, 'data' => ['post_id' => $result['post_id']]], 200)
            : new \WP_REST_Response(['success' => false, 'message' => $result['message']], 400);
    }

    public static function delete_post(\WP_REST_Request $request): \WP_REST_Response {
        $post_id = $request->get_param('id');
        $force   = $request->get_param('force') ?: false;
        $result  = Sync::delete_post($post_id, $force);
        return $result['success']
            ? new \WP_REST_Response(['success' => true], 200)
            : new \WP_REST_Response(['success' => false, 'message' => $result['message']], 400);
    }

    public static function batch_posts(\WP_REST_Request $request): \WP_REST_Response {
        $posts = $request->get_param('posts') ?: [];
        $results = [];
        foreach ($posts as $i => $article) {
            if (!empty($article['id'])) {
                $results[] = ['index' => $i, 'action' => 'update', 'result' => Sync::update_post((int) $article['id'], $article)];
            } else {
                $results[] = ['index' => $i, 'action' => 'create', 'result' => Sync::create_post($article)];
            }
        }
        $success_count = count(array_filter($results, fn($r) => $r['result']['success']));
        $fail_count = count($results) - $success_count;
        return new \WP_REST_Response([
            'success' => $fail_count === 0,
            'data'    => $results,
            'summary' => ['total' => count($results), 'success' => $success_count, 'failed' => $fail_count],
        ], $fail_count === 0 ? 200 : 207);
    }

    // ── Media ──
    public static function upload_media(\WP_REST_Request $request): \WP_REST_Response {
        $url     = $request->get_param('url');
        $post_id = $request->get_param('post_id') ?: 0;
        $alt_text = $request->get_param('alt_text') ?: '';

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $tmp = download_url(esc_url_raw($url));
        if (is_wp_error($tmp)) return new \WP_REST_Response(['success' => false, 'message' => $tmp->get_error_message()], 400);

        $file_array = ['name' => basename($url), 'tmp_name' => $tmp];
        $attachment_id = media_handle_sideload($file_array, $post_id);

        if (is_wp_error($attachment_id)) { @unlink($tmp); return new \WP_REST_Response(['success' => false, 'message' => $attachment_id->get_error_message()], 400); }

        @unlink($tmp);
        if (!empty($alt_text)) update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($alt_text));

        $attachment = get_post($attachment_id);
        return new \WP_REST_Response(['success' => true, 'data' => [
            'id' => $attachment_id,
            'url' => wp_get_attachment_url($attachment_id),
            'mime' => get_post_mime_type($attachment_id),
            'filesize' => filesize(get_attached_file($attachment_id)),
            'width' => wp_get_attachment_metadata($attachment_id)['width'] ?? 0,
            'height' => wp_get_attachment_metadata($attachment_id)['height'] ?? 0,
        ]], 201);
    }

    // ── Taxonomies ──
    public static function list_categories(\WP_REST_Request $request): \WP_REST_Response {
        $search = $request->get_param('search');
        $args = ['taxonomy' => 'category', 'hide_empty' => false, 'orderby' => 'name'];
        if (!empty($search)) $args['name__like'] = sanitize_text_field($search);
        $terms = get_terms($args);
        if (is_wp_error($terms)) return new \WP_REST_Response(['success' => false, 'message' => $terms->get_error_message()], 500);
        $cats = array_map(fn($t) => ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count, 'parent' => $t->parent], $terms);
        return new \WP_REST_Response(['success' => true, 'data' => $cats, 'total' => count($cats)], 200);
    }

    public static function list_tags(\WP_REST_Request $request): \WP_REST_Response {
        $search = $request->get_param('search');
        $args = ['taxonomy' => 'post_tag', 'hide_empty' => false, 'orderby' => 'name'];
        if (!empty($search)) $args['name__like'] = sanitize_text_field($search);
        $terms = get_terms($args);
        if (is_wp_error($terms)) return new \WP_REST_Response(['success' => false, 'message' => $terms->get_error_message()], 500);
        $tags = array_map(fn($t) => ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count], $terms);
        return new \WP_REST_Response(['success' => true, 'data' => $tags, 'total' => count($tags)], 200);
    }

    public static function list_authors(): \WP_REST_Response {
        $users = get_users(['who' => 'authors', 'orderby' => 'display_name', 'fields' => ['ID', 'display_name', 'user_email', 'user_nicename']]);
        $authors = array_map(fn($u) => ['id' => $u->ID, 'name' => $u->display_name, 'email' => $u->user_email, 'slug' => $u->user_nicename], $users);
        return new \WP_REST_Response(['success' => true, 'data' => $authors, 'total' => count($authors)], 200);
    }

    // ── Settings ──
    public static function get_settings(): \WP_REST_Response {
        $settings = get_option('tds_geo_wp_settings', []);
        unset($settings['openai_api_key'], $settings['agent_url']);
        $settings['seo_plugins'] = self::detect_seo_plugins();
        $settings['version'] = TDS_GEO_WP_VERSION;
        return new \WP_REST_Response(['success' => true, 'data' => $settings], 200);
    }

    public static function update_settings(\WP_REST_Request $request): \WP_REST_Response {
        $body = $request->get_json_params();
        $settings = get_option('tds_geo_wp_settings', []);

        $text_fields = [
            'api_enabled', 'webhook_secret',
            'debug_mode', 'log_level', 'default_status', 'default_author',
            'auto_import_tags', 'auto_import_cats',
        ];
        foreach ($text_fields as $k) {
            if (isset($body[$k])) $settings[$k] = sanitize_text_field($body[$k]);
        }

        update_option('tds_geo_wp_settings', $settings);
        return new \WP_REST_Response(['success' => true, 'message' => 'Settings updated.'], 200);
    }

    // ── Webhook ──
    public static function handle_webhook(\WP_REST_Request $request): \WP_REST_Response {
        $settings = get_option('tds_geo_wp_settings', []);
        if (($settings['enable_webhooks'] ?? 'yes') !== 'yes') {
            return new \WP_REST_Response(['success' => false, 'message' => 'Webhooks disabled.'], 403);
        }

        $rate_limit = self::rate_limit_response('webhook', 60, 60);
        if (is_wp_error($rate_limit)) {
            return new \WP_REST_Response(['success' => false, 'message' => $rate_limit->get_error_message()], 429);
        }

        $webhook_ok = false;

        if (!empty($settings['webhook_secret'])) {
            $signature = $request->get_header('X-TDS-GEO-Signature') ?: $request->get_header('X-TDS-GEO-Signature');
            $payload   = $request->get_body();
            if (empty($signature)) return new \WP_REST_Response(['success' => false, 'message' => 'Missing signature.'], 401);
            $expected = 'sha256=' . hash_hmac('sha256', $payload, $settings['webhook_secret']);
            if (hash_equals($expected, $signature)) $webhook_ok = true;
        }

        if (!$webhook_ok) {
            $auth = Auth::authenticate_request();
            if ($auth['valid'] && in_array('write', $auth['permissions'], true)) $webhook_ok = true;
        }

        if (!$webhook_ok) {
            return new \WP_REST_Response(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        $event = $request->get_param('event');
        $data  = $request->get_param('data', []);

        Logger::info('Webhook received', ['event' => $event]);

        switch ($event) {
            case 'article.created':
                $result = Sync::create_post($data);
                break;
            case 'article.updated':
                $post_id = $data['post_id'] ?? 0;
                $agent_id = $data['agent_article_id'] ?? $data['tds_geo_article_id'] ?? $data['tds_geo_article_id'] ?? '';
                if (!$post_id && !empty($agent_id)) {
                    $post = Sync::get_post_by_agent_id($agent_id);
                    $post_id = $post ? $post->ID : 0;
                }
                $result = $post_id ? Sync::update_post($post_id, $data) : Sync::create_post($data);
                break;
            case 'article.deleted':
                $post_id = $data['post_id'] ?? 0;
                $agent_id = $data['agent_article_id'] ?? $data['tds_geo_article_id'] ?? $data['tds_geo_article_id'] ?? '';
                if (!$post_id && !empty($agent_id)) {
                    $post = Sync::get_post_by_agent_id($agent_id);
                    $post_id = $post ? $post->ID : 0;
                }
                $result = $post_id ? Sync::delete_post($post_id, true) : ['success' => true, 'message' => 'No matching post.'];
                break;
            case 'ping':
                $result = ['success' => true, 'message' => 'pong'];
                break;
            default:
                return new \WP_REST_Response(['success' => false, 'message' => "Unknown event: {$event}"], 400);
        }

        return new \WP_REST_Response(['success' => true, 'event' => $event, 'data' => $result], 200);
    }

    // ── Helpers ──
    private static function format_post(\WP_Post $post): array {
        $cats = wp_get_post_categories($post->ID, ['fields' => 'all']);
        $tags = wp_get_post_tags($post->ID, ['fields' => 'all']);
        return [
            'id'                => $post->ID,
            'title'             => $post->post_title,
            'slug'              => $post->post_name,
            'content'           => $post->post_content,
            'excerpt'           => $post->post_excerpt,
            'status'            => $post->post_status,
            'type'              => $post->post_type,
            'author'            => ['id' => (int) $post->post_author, 'name' => get_the_author_meta('display_name', $post->post_author)],
            'categories'        => array_map(fn($c) => ['id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug], $cats),
            'tags'              => array_map(fn($t) => ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug], $tags),
            'featured_image'    => get_the_post_thumbnail_url($post->ID, 'full'),
            'featured_image_id' => get_post_thumbnail_id($post->ID),
            'permalink'         => get_permalink($post->ID),
            'meta'              => ['title' => get_post_meta($post->ID, '_tds_geo_meta_title', true), 'description' => get_post_meta($post->ID, '_tds_geo_meta_description', true)],
            'agent_id'          => get_post_meta($post->ID, '_tds_geo_article_id', true),
            'imported_at'       => get_post_meta($post->ID, '_tds_geo_imported_at', true),
            'created_at'        => $post->post_date,
            'updated_at'        => $post->post_modified,
        ];
    }

    public static function detect_seo_plugins(): array {
        $plugins = [];
        if (defined('WPSEO_VERSION')) $plugins['yoast'] = WPSEO_VERSION;
        if (defined('RANK_MATH_VERSION')) $plugins['rank_math'] = RANK_MATH_VERSION;
        if (defined('AIOSEO_VERSION')) $plugins['aioseo'] = AIOSEO_VERSION;
        if (defined('SEOPRESS_VERSION')) $plugins['seopress'] = SEOPRESS_VERSION;
        if (defined('THE_SE_FRAMEWORK_VERSION')) $plugins['the_seo_framework'] = THE_SE_FRAMEWORK_VERSION;
        return $plugins;
    }

    private static function post_args(): array {
        return [
            'title' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'content' => ['type' => 'string', 'sanitize_callback' => 'wp_kses_post'],
            'content_html' => ['type' => 'string', 'sanitize_callback' => 'wp_kses_post'],
            'status' => ['type' => 'string', 'default' => 'draft', 'sanitize_callback' => 'sanitize_text_field'],
            'slug' => ['type' => 'string', 'sanitize_callback' => 'sanitize_title'],
            'tags' => ['type' => 'array', 'items' => ['type' => 'string']],
            'categories' => ['type' => 'array', 'items' => ['type' => 'string']],
            'meta_title' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'meta_description' => ['type' => 'string', 'sanitize_callback' => 'sanitize_textarea_field'],
            'focus_keyword' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'featured_image_url' => ['type' => 'string', 'format' => 'uri', 'sanitize_callback' => 'esc_url_raw'],
            'publish_date' => ['type' => 'string', 'format' => 'date-time'],
            'author_id' => ['type' => 'integer', 'sanitize_callback' => 'absint'],
            'author_email' => ['type' => 'string', 'format' => 'email'],
            'post_type' => ['type' => 'string', 'default' => 'post', 'sanitize_callback' => 'sanitize_text_field'],
            'agent_article_id' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'schema' => ['type' => 'string'],
            'auto_publish' => ['type' => 'boolean'],
            'comment_status' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'custom_fields' => ['type' => 'object'],
            'quality_score' => ['type' => 'number'],
        ];
    }
}
