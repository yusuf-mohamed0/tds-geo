<?php
/**
 * KOZMO Core REST API
 *
 * Registers custom WP REST API endpoints for KOZMO Core integration.
 * All endpoints are under the `kozmo-core/v1` namespace.
 *
 * Endpoints:
 * - POST /kozmo-core/v1/posts          — Create a new post
 * - PUT  /kozmo-core/v1/posts/{id}    — Update an existing post
 * - DELETE /kozmo-core/v1/posts/{id}  — Delete a post
 * - GET  /kozmo-core/v1/posts/{id}    — Get post details
 * - GET  /kozmo-core/v1/posts         — List posts
 * - POST /kozmo-core/v1/posts/batch   — Batch create/update posts
 * - GET  /kozmo-core/v1/status        — Connection status & health check
 * - POST /kozmo-core/v1/media         — Upload media
 * - GET  /kozmo-core/v1/categories    — List categories (for content mapping)
 * - GET  /kozmo-core/v1/tags          — List tags
 * - GET  /kozmo-core/v1/settings      — Get plugin settings (read-only)
 * - POST /kozmo-core/v1/settings/sync — Force sync configuration
 *
 * @package KOZMO_Core_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class KOZMO_Core_API {

    /**
     * @var self|null Singleton instance
     */
    private static ?self $instance = null;

    /**
     * Initialize the API.
     */
    public static function init(): void {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    /**
     * Register all REST API routes.
     */
    public static function register_routes(): void {
        $namespace = KOZMO_CORE_API_NAMESPACE;

        // ─── Posts ────────────────────────────────────
        register_rest_route($namespace, '/posts', [
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [self::class, 'create_post'],
                'permission_callback' => [self::class, 'check_write_permission'],
                'args'                => self::get_post_args(),
            ],
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'list_posts'],
                'permission_callback' => [self::class, 'check_read_permission'],
                'args'                => [
                    'status' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                    'limit' => [
                        'type'              => 'integer',
                        'default'           => 20,
                        'sanitize_callback' => 'absint',
                    ],
                    'offset' => [
                        'type'              => 'integer',
                        'default'           => 0,
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ],
        ]);

        // Single post CRUD
        register_rest_route($namespace, '/posts/(?P<id>\d+)', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'get_post'],
                'permission_callback' => [self::class, 'check_read_permission'],
                'args'                => [
                    'id' => [
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ],
            [
                'methods'             => WP_REST_Server::EDITABLE,
                'callback'            => [self::class, 'update_post'],
                'permission_callback' => [self::class, 'check_write_permission'],
                'args'                => [
                    'id' => [
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ],
            [
                'methods'             => WP_REST_Server::DELETABLE,
                'callback'            => [self::class, 'delete_post'],
                'permission_callback' => [self::class, 'check_write_permission'],
                'args'                => [
                    'id' => [
                        'required'          => true,
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                    'force' => [
                        'type'              => 'boolean',
                        'default'           => false,
                    ],
                ],
            ],
        ]);

        // Batch posts
        register_rest_route($namespace, '/posts/batch', [
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [self::class, 'batch_posts'],
                'permission_callback' => [self::class, 'check_write_permission'],
                'args'                => [
                    'posts' => [
                        'required'          => true,
                        'type'              => 'array',
                        'items'             => ['type' => 'object'],
                    ],
                ],
            ],
        ]);

        // ─── Health / Status ────────────────────────
        register_rest_route($namespace, '/status', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'get_status'],
                'permission_callback' => [self::class, 'check_read_permission'],
            ],
        ]);

        // ─── Media ─────────────────────────────────────
        register_rest_route($namespace, '/media', [
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [self::class, 'upload_media'],
                'permission_callback' => [self::class, 'check_write_permission'],
                'args'                => [
                    'url' => [
                        'required'          => true,
                        'type'              => 'string',
                        'format'            => 'uri',
                        'sanitize_callback' => 'esc_url_raw',
                    ],
                    'post_id' => [
                        'type'              => 'integer',
                        'sanitize_callback' => 'absint',
                    ],
                ],
            ],
        ]);

        // ─── Taxonomies ────────────────────────────────
        register_rest_route($namespace, '/categories', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'list_categories'],
                'permission_callback' => [self::class, 'check_read_permission'],
                'args'                => [
                    'search' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        register_rest_route($namespace, '/tags', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'list_tags'],
                'permission_callback' => [self::class, 'check_read_permission'],
                'args'                => [
                    'search' => [
                        'type'              => 'string',
                        'sanitize_callback' => 'sanitize_text_field',
                    ],
                ],
            ],
        ]);

        // ─── Settings (read-only from API) ────────────
        register_rest_route($namespace, '/settings', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'get_settings'],
                'permission_callback' => [self::class, 'check_read_permission'],
            ],
        ]);

        // ─── Authors ──────────────────────────────────
        register_rest_route($namespace, '/authors', [
            [
                'methods'             => WP_REST_Server::READABLE,
                'callback'            => [self::class, 'list_authors'],
                'permission_callback' => [self::class, 'check_read_permission'],
            ],
        ]);

        // ─── Webhook receiver ─────────────────────────
        register_rest_route($namespace, '/webhook', [
            [
                'methods'             => WP_REST_Server::CREATABLE,
                'callback'            => [self::class, 'handle_webhook'],
                'permission_callback' => '__return_true', // Validated inside callback
            ],
        ]);
    }

    private static function is_api_enabled(): bool {
        $settings = get_option(KOZMO_CORE_SETTINGS_OPTION, []);
        return ($settings['api_enabled'] ?? 'yes') === 'yes';
    }

    private static function get_rate_limit_key(string $scope): string {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $path = $_SERVER['REQUEST_URI'] ?? '';
        return 'kozmo_core_ratelimit_' . md5($scope . ':' . $ip . ':' . $path);
    }

    private static function rate_limit_response(string $scope, int $max_requests, int $window): WP_Error|true {
        $cache_key = self::get_rate_limit_key($scope);
        $data = get_transient($cache_key);

        if (!is_array($data) || ($data['reset'] ?? 0) < time()) {
            $data = ['count' => 0, 'reset' => time() + $window];
        }

        $data['count']++;
        set_transient($cache_key, $data, $window);

        if ($data['count'] <= $max_requests) {
            return true;
        }

        return new WP_Error(
            'kozmo_core_rate_limited',
            __('Rate limit exceeded. Please try again later.', 'kozmo-core-integration'),
            ['status' => 429, 'retry_after' => max(1, $data['reset'] - time())]
        );
    }

    public static function check_read_permission() {
        if (!self::is_api_enabled() || !KOZMO_Core_Auth::check_read_permission()) {
            return false;
        }

        return self::rate_limit_response('read', 120, 60);
    }

    public static function check_write_permission() {
        if (!self::is_api_enabled() || !KOZMO_Core_Auth::check_write_permission()) {
            return false;
        }

        return self::rate_limit_response('write', 30, 60);
    }

    // ══════════════════════════════════════════════════════════════
    // ENDPOINT CALLBACKS
    // ══════════════════════════════════════════════════════════════

    /**
     * POST /kozmo-core/v1/posts — Create a new post.
     */
    public static function create_post(WP_REST_Request $request): WP_REST_Response {
        $article = $request->get_params();
        $result = KOZMO_Core_Sync::create_post($article);

        if (!$result['success']) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $result['message'],
            ], 400);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'post_id'  => $result['post_id'],
                'post_url' => $result['post_url'],
            ],
            'message' => $result['message'],
        ], 201);
    }

    /**
     * GET /kozmo-core/v1/posts — List posts.
     */
    public static function list_posts(WP_REST_Request $request): WP_REST_Response {
        $status = $request->get_param('status');
        $limit  = $request->get_param('limit');
        $offset = $request->get_param('offset');

        $args = [
            'post_type'      => 'any',
            'post_status'    => $status ?: 'any',
            'posts_per_page' => $limit,
            'offset'         => $offset,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        // If we have a kozmo_core_article_id query, search by that
        $kozmo_core_id = $request->get_param('kozmo_core_article_id');
        if ($kozmo_core_id) {
            $args['meta_key']   = '_kozmo_core_article_id';
            $args['meta_value'] = sanitize_text_field($kozmo_core_id);
        }

        $query   = new WP_Query($args);
        $posts   = [];
        $total   = $query->found_posts;

        foreach ($query->posts as $post) {
            $posts[] = self::format_post($post);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => $posts,
            'total'   => (int) $total,
        ], 200);
    }

    /**
     * GET /kozmo-core/v1/posts/{id} — Get a single post.
     */
    public static function get_post(WP_REST_Request $request): WP_REST_Response {
        $post_id = $request->get_param('id');
        $post    = get_post($post_id);

        if (!$post) {
            return new WP_REST_Response([
                'success' => false,
                'message' => __('Post not found.', 'kozmo-core-integration'),
            ], 404);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => self::format_post($post),
        ], 200);
    }

    /**
     * PUT /kozmo-core/v1/posts/{id} — Update a post.
     */
    public static function update_post(WP_REST_Request $request): WP_REST_Response {
        $post_id = $request->get_param('id');
        $article = $request->get_params();
        unset($article['id']); // Remove id from article data

        $result = KOZMO_Core_Sync::update_post($post_id, $article);

        if (!$result['success']) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $result['message'],
            ], 400);
        }

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'post_id' => $result['post_id'],
            ],
            'message' => $result['message'],
        ], 200);
    }

    /**
     * DELETE /kozmo-core/v1/posts/{id} — Delete a post.
     */
    public static function delete_post(WP_REST_Request $request): WP_REST_Response {
        $post_id      = $request->get_param('id');
        $force_delete = $request->get_param('force');

        $result = KOZMO_Core_Sync::delete_post($post_id, $force_delete);

        if (!$result['success']) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $result['message'],
            ], 400);
        }

        return new WP_REST_Response([
            'success' => true,
            'message' => $result['message'],
        ], 200);
    }

    /**
     * POST /kozmo-core/v1/posts/batch — Batch create/update posts.
     */
    public static function batch_posts(WP_REST_Request $request): WP_REST_Response {
        $posts  = $request->get_param('posts');
        $results = [];

        foreach ($posts as $index => $article) {
            if (!empty($article['id'])) {
                // Update existing
                $results[] = [
                    'index'   => $index,
                    'action'  => 'update',
                    'result'  => KOZMO_Core_Sync::update_post((int) $article['id'], $article),
                ];
            } else {
                // Create new
                $results[] = [
                    'index'  => $index,
                    'action' => 'create',
                    'result' => KOZMO_Core_Sync::create_post($article),
                ];
            }
        }

        $success_count = count(array_filter($results, fn($r) => $r['result']['success']));
        $fail_count    = count($results) - $success_count;

        KOZMO_Core_Logger::info('Batch post operation completed', [
            'total'   => count($results),
            'success' => $success_count,
            'failed'  => $fail_count,
        ]);

        return new WP_REST_Response([
            'success' => $fail_count === 0,
            'data'    => $results,
            'summary' => [
                'total'   => count($results),
                'success' => $success_count,
                'failed'  => $fail_count,
            ],
        ], $fail_count === 0 ? 200 : 207);
    }

    /**
     * GET /kozmo-core/v1/status — Health check and connection status.
     */
    public static function get_status(): WP_REST_Response {
        global $wpdb;

        $settings = get_option(KOZMO_CORE_SETTINGS_OPTION, []);

        // Check database connectivity
        $db_ok = !is_wp_error($wpdb->check_database_version());

        // Get API key count
        $key_count = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_core_api_keys WHERE is_active = 1"
        );

        // Get KOZMO Core-imported posts count
        $kozmo_core_posts = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_kozmo_core_imported_at'"
        );

        $wp_version   = get_bloginfo('version');
        $php_version  = PHP_VERSION;

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'status'             => 'ok',
                'plugin_version'     => KOZMO_CORE_VERSION,
                'wordpress_version'  => $wp_version,
                'php_version'        => $php_version,
                'database_connected' => $db_ok,
                'api_enabled'        => self::is_api_enabled(),
                'active_api_keys'    => $key_count,
                'kozmo_core_posts'       => $kozmo_core_posts,
                'site_name'          => get_bloginfo('name'),
                'site_url'           => get_bloginfo('url'),
                'admin_email'        => get_bloginfo('admin_email'),
                'timezone'           => wp_timezone_string(),
                'locale'             => get_locale(),
                'seo_plugins'        => self::detect_seo_plugins(),
            ],
        ], 200);
    }

    /**
     * POST /kozmo-core/v1/media — Upload media from URL.
     */
    public static function upload_media(WP_REST_Request $request): WP_REST_Response {
        $url     = $request->get_param('url');
        $post_id = $request->get_param('post_id') ?: 0;

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $tmp = download_url(esc_url_raw($url));
        if (is_wp_error($tmp)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $tmp->get_error_message(),
            ], 400);
        }

        $file_array = [
            'name'     => basename($url),
            'tmp_name' => $tmp,
        ];

        $attachment_id = media_handle_sideload($file_array, $post_id);

        if (is_wp_error($attachment_id)) {
            // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            @unlink($tmp);
            return new WP_REST_Response([
                'success' => false,
                'message' => $attachment_id->get_error_message(),
            ], 400);
        }

        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        @unlink($tmp);

        $attachment = get_post($attachment_id);

        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'id'          => $attachment_id,
                'url'         => wp_get_attachment_url($attachment_id),
                'title'       => $attachment->post_title,
                'mime_type'   => $attachment->post_mime_type,
                'filesize'    => filesize(get_attached_file($attachment_id)),
                'width'       => wp_get_attachment_metadata($attachment_id)['width'] ?? 0,
                'height'      => wp_get_attachment_metadata($attachment_id)['height'] ?? 0,
            ],
        ], 201);
    }

    /**
     * GET /kozmo-core/v1/categories — List categories.
     */
    public static function list_categories(WP_REST_Request $request): WP_REST_Response {
        $search = $request->get_param('search');

        $args = [
            'taxonomy'   => 'category',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ];

        if (!empty($search)) {
            $args['name__like'] = sanitize_text_field($search);
        }

        $terms = get_terms($args);

        if (is_wp_error($terms)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $terms->get_error_message(),
            ], 500);
        }

        $categories = array_map(function ($term) {
            return [
                'id'       => $term->term_id,
                'name'     => $term->name,
                'slug'     => $term->slug,
                'count'    => $term->count,
                'parent'   => $term->parent,
                'taxonomy' => $term->taxonomy,
            ];
        }, $terms);

        return new WP_REST_Response([
            'success' => true,
            'data'    => $categories,
            'total'   => count($categories),
        ], 200);
    }

    /**
     * GET /kozmo-core/v1/tags — List tags.
     */
    public static function list_tags(WP_REST_Request $request): WP_REST_Response {
        $search = $request->get_param('search');

        $args = [
            'taxonomy'   => 'post_tag',
            'hide_empty' => false,
            'orderby'    => 'name',
            'order'      => 'ASC',
        ];

        if (!empty($search)) {
            $args['name__like'] = sanitize_text_field($search);
        }

        $terms = get_terms($args);

        if (is_wp_error($terms)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $terms->get_error_message(),
            ], 500);
        }

        $tags = array_map(function ($term) {
            return [
                'id'       => $term->term_id,
                'name'     => $term->name,
                'slug'     => $term->slug,
                'count'    => $term->count,
                'taxonomy' => $term->taxonomy,
            ];
        }, $terms);

        return new WP_REST_Response([
            'success' => true,
            'data'    => $tags,
            'total'   => count($tags),
        ], 200);
    }

    /**
     * GET /kozmo-core/v1/settings — Get plugin configuration (read-only via API).
     */
    public static function get_settings(): WP_REST_Response {
        $settings = get_option(KOZMO_CORE_SETTINGS_OPTION, []);

        // Only expose non-sensitive settings via API
        return new WP_REST_Response([
            'success' => true,
            'data'    => [
                'api_enabled'      => $settings['api_enabled'] ?? 'yes',
                'auto_import_tags' => $settings['auto_import_tags'] ?? 'yes',
                'auto_import_cats' => $settings['auto_import_cats'] ?? 'yes',
                'default_status'   => $settings['default_status'] ?? 'draft',
                'enable_webhooks'  => $settings['enable_webhooks'] ?? 'no',
                'debug_mode'       => $settings['debug_mode'] ?? 'no',
                'seo_plugins'      => self::detect_seo_plugins(),
                'version'          => KOZMO_CORE_VERSION,
            ],
        ], 200);
    }

    /**
     * GET /kozmo-core/v1/authors — List available authors.
     */
    public static function list_authors(): WP_REST_Response {
        $users = get_users([
            'who'      => 'authors',
            'orderby'  => 'display_name',
            'order'    => 'ASC',
            'fields'   => ['ID', 'display_name', 'user_email', 'user_nicename'],
        ]);

        $authors = array_map(function ($user) {
            return [
                'id'           => $user->ID,
                'display_name' => $user->display_name,
                'email'        => $user->user_email,
                'slug'         => $user->user_nicename,
                'avatar'       => get_avatar_url($user->ID),
            ];
        }, $users);

        return new WP_REST_Response([
            'success' => true,
            'data'    => $authors,
            'total'   => count($authors),
        ], 200);
    }

    /**
     * POST /kozmo-core/v1/webhook — Receive incoming webhook from KOZMO Core.
     */
    public static function handle_webhook(WP_REST_Request $request): WP_REST_Response {
        $settings = get_option(KOZMO_CORE_SETTINGS_OPTION, []);

        if (($settings['enable_webhooks'] ?? 'no') !== 'yes') {
            return new WP_REST_Response([
                'success' => false,
                'message' => __('Webhooks are disabled.', 'kozmo-core-integration'),
            ], 403);
        }

        $rate_limit = self::rate_limit_response('webhook', 60, 60);
        if (is_wp_error($rate_limit)) {
            return new WP_REST_Response([
                'success' => false,
                'message' => $rate_limit->get_error_message(),
            ], 429);
        }

        // Verify webhook secret if configured
        if (!empty($settings['webhook_secret'])) {
            $signature = $request->get_header('X-KOZMO Core-Signature');
            $payload   = $request->get_body();

            if (empty($signature)) {
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Missing webhook signature.',
                ], 401);
            }

            $expected = 'sha256=' . hash_hmac('sha256', $payload, $settings['webhook_secret']);
            if (!hash_equals($expected, $signature)) {
                KOZMO_Core_Logger::warning('Invalid webhook signature received');
                return new WP_REST_Response([
                    'success' => false,
                    'message' => 'Invalid webhook signature.',
                ], 401);
            }
        }

        // Authenticate as fallback
        $auth = KOZMO_Core_Auth::authenticate_request();
        if (!$auth['valid'] && empty($settings['webhook_secret'])) {
            return new WP_REST_Response([
                'success' => false,
                'message' => 'Authentication required for webhook.',
            ], 401);
        }

        $event  = $request->get_param('event');
        $data   = $request->get_param('data', []);

        KOZMO_Core_Logger::info('Webhook received', [
            'event' => $event,
            'type'  => gettype($data),
        ]);

        switch ($event) {
            case 'article.created':
                $result = KOZMO_Core_Sync::create_post($data);
                break;

            case 'article.updated':
                $post_id = $data['post_id'] ?? 0;
                if (!$post_id) {
                    // Try to find by kozmo_core_article_id
                    $kozmo_core_id = $data['kozmo_core_article_id'] ?? '';
                    if ($kozmo_core_id) {
                        $post = KOZMO_Core_Sync::get_post_by_kozmo_core_id($kozmo_core_id);
                        $post_id = $post ? $post->ID : 0;
                    }
                }
                if (!$post_id) {
                    // Create instead
                    $result = KOZMO_Core_Sync::create_post($data);
                } else {
                    $result = KOZMO_Core_Sync::update_post($post_id, $data);
                }
                break;

            case 'article.deleted':
                $post_id = $data['post_id'] ?? 0;
                if (!$post_id && !empty($data['kozmo_core_article_id'])) {
                    $post = KOZMO_Core_Sync::get_post_by_kozmo_core_id($data['kozmo_core_article_id']);
                    $post_id = $post ? $post->ID : 0;
                }
                if ($post_id) {
                    $result = KOZMO_Core_Sync::delete_post($post_id, true);
                } else {
                    $result = ['success' => true, 'message' => 'No matching post found — ignored.'];
                }
                break;

            case 'ping':
                $result = ['success' => true, 'message' => 'pong', 'post_id' => null];
                break;

            default:
                KOZMO_Core_Logger::warning('Unknown webhook event', ['event' => $event]);
                return new WP_REST_Response([
                    'success' => false,
                    'message' => "Unknown event type: {$event}",
                ], 400);
        }

        return new WP_REST_Response([
            'success' => true,
            'event'   => $event,
            'data'    => $result,
        ], 200);
    }

    // ══════════════════════════════════════════════════════════════
    // HELPERS
    // ══════════════════════════════════════════════════════════════

    /**
     * Format a WP_Post for API response.
     *
     * @param WP_Post $post Post object.
     *
     * @return array
     */
    private static function format_post(WP_Post $post): array {
        $categories = wp_get_post_categories($post->ID, ['fields' => 'all']);
        $tags       = wp_get_post_tags($post->ID, ['fields' => 'all']);

        return [
            'id'                => $post->ID,
            'title'             => $post->post_title,
            'slug'              => $post->post_name,
            'content'           => $post->post_content,
            'excerpt'           => $post->post_excerpt,
            'status'            => $post->post_status,
            'type'              => $post->post_type,
            'author'            => [
                'id'           => $post->post_author,
                'display_name' => get_the_author_meta('display_name', $post->post_author),
            ],
            'categories'        => array_map(function ($cat) {
                return ['id' => $cat->term_id, 'name' => $cat->name, 'slug' => $cat->slug];
            }, $categories),
            'tags'              => array_map(function ($tag) {
                return ['id' => $tag->term_id, 'name' => $tag->name, 'slug' => $tag->slug];
            }, $tags),
            'featured_image'    => get_the_post_thumbnail_url($post->ID, 'full'),
            'featured_image_id' => get_post_thumbnail_id($post->ID),
            'permalink'         => get_permalink($post->ID),
            'meta'              => [
                'title'       => get_post_meta($post->ID, '_kozmo_core_meta_title', true),
                'description' => get_post_meta($post->ID, '_kozmo_core_meta_description', true),
            ],
            'kozmo_core_article_id' => get_post_meta($post->ID, '_kozmo_core_article_id', true),
            'imported_at'       => get_post_meta($post->ID, '_kozmo_core_imported_at', true),
            'created_at'        => $post->post_date,
            'updated_at'        => $post->post_modified,
        ];
    }

    /**
     * Detect installed SEO plugins.
     *
     * @return array
     */
    private static function detect_seo_plugins(): array {
        $plugins = [];

        if (defined('WPSEO_VERSION')) {
            $plugins['yoast'] = WPSEO_VERSION;
        }
        if (defined('RANK_MATH_VERSION')) {
            $plugins['rank_math'] = RANK_MATH_VERSION;
        }
        if (defined('AIOSEO_VERSION')) {
            $plugins['aioseo'] = AIOSEO_VERSION;
        }
        if (defined('SEOPRESS_VERSION')) {
            $plugins['seopress'] = SEOPRESS_VERSION;
        }
        if (defined('THE_SE_FRAMEWORK_VERSION')) {
            $plugins['the_seo_framework'] = THE_SE_FRAMEWORK_VERSION;
        }

        return $plugins;
    }

    /**
     * Get schema args for the create/update post endpoint.
     *
     * @return array
     */
    private static function get_post_args(): array {
        return [
            'title' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'content' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'wp_kses_post',
            ],
            'content_html' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'wp_kses_post',
            ],
            'slug' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_title',
            ],
            'status' => [
                'type'              => 'string',
                'required'          => false,
                'default'           => 'draft',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'tags' => [
                'type'              => 'array',
                'required'          => false,
                'items'             => ['type' => 'string'],
            ],
            'categories' => [
                'type'              => 'array',
                'required'          => false,
                'items'             => ['type' => 'string'],
            ],
            'meta_title' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'meta_description' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_textarea_field',
            ],
            'focus_keyword' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'featured_image_url' => [
                'type'              => 'string',
                'required'          => false,
                'format'            => 'uri',
                'sanitize_callback' => 'esc_url_raw',
            ],
            'publish_date' => [
                'type'              => 'string',
                'required'          => false,
                'format'            => 'date-time',
            ],
            'author_id' => [
                'type'              => 'integer',
                'required'          => false,
                'sanitize_callback' => 'absint',
            ],
            'post_type' => [
                'type'              => 'string',
                'required'          => false,
                'default'           => 'post',
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'kozmo_core_article_id' => [
                'type'              => 'string',
                'required'          => false,
                'sanitize_callback' => 'sanitize_text_field',
            ],
            'custom_fields' => [
                'type'              => 'object',
                'required'          => false,
            ],
        ];
    }
}
