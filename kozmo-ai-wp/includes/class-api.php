<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * REST API endpoints for KOZMO AI agent integration.
 */
class Api {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('rest_api_init', [self::class, 'register_routes']);
    }

    public static function register_routes(): void {
        $ns = 'kozmo-ai/v1';

        // Status / health
        register_rest_route($ns, '/status', [
            'methods'             => 'GET',
            'callback'            => [self::class, 'get_status'],
            'permission_callback' => [self::class, 'check_read_permission'],
        ]);

        // Posts CRUD
        register_rest_route($ns, '/posts', [
            ['methods' => 'POST', 'callback' => [self::class, 'create_post'], 'permission_callback' => [self::class, 'check_write_permission'], 'args' => self::post_args()],
            ['methods' => 'GET',  'callback' => [self::class, 'list_posts'], 'permission_callback' => [self::class, 'check_read_permission']],
        ]);
        register_rest_route($ns, '/posts/(?P<id>\d+)', [
            ['methods' => 'GET',    'callback' => [self::class, 'get_post'], 'permission_callback' => [self::class, 'check_read_permission']],
            ['methods' => 'PUT',    'callback' => [self::class, 'update_post'], 'permission_callback' => [self::class, 'check_write_permission']],
            ['methods' => 'DELETE', 'callback' => [self::class, 'delete_post'], 'permission_callback' => [self::class, 'check_write_permission']],
        ]);

        // Batch
        register_rest_route($ns, '/posts/batch', [
            'methods' => 'POST', 'callback' => [self::class, 'batch_posts'], 'permission_callback' => [self::class, 'check_write_permission'],
        ]);

        // Media
        register_rest_route($ns, '/media', [
            'methods' => 'POST', 'callback' => [self::class, 'upload_media'], 'permission_callback' => [self::class, 'check_write_permission'],
        ]);

        // Taxonomies
        register_rest_route($ns, '/categories', ['methods' => 'GET', 'callback' => [self::class, 'list_categories'], 'permission_callback' => [self::class, 'check_read_permission']]);
        register_rest_route($ns, '/tags', ['methods' => 'GET', 'callback' => [self::class, 'list_tags'], 'permission_callback' => [self::class, 'check_read_permission']]);
        register_rest_route($ns, '/authors', ['methods' => 'GET', 'callback' => [self::class, 'list_authors'], 'permission_callback' => [self::class, 'check_read_permission']]);

        // Settings
        register_rest_route($ns, '/settings', [
            ['methods' => 'GET', 'callback' => [self::class, 'get_settings'], 'permission_callback' => [self::class, 'check_read_permission']],
            ['methods' => 'PUT', 'callback' => [self::class, 'update_settings'], 'permission_callback' => [self::class, 'check_write_permission']],
        ]);

        // Scanner / knowledge base
        register_rest_route($ns, '/scan', ['methods' => 'POST', 'callback' => [self::class, 'trigger_scan'], 'permission_callback' => [self::class, 'check_write_permission']]);
        register_rest_route($ns, '/knowledge', ['methods' => 'GET', 'callback' => [self::class, 'get_knowledge'], 'permission_callback' => [self::class, 'check_read_permission']]);

        // Webhook receiver
        register_rest_route($ns, '/webhook', ['methods' => 'POST', 'callback' => [self::class, 'handle_webhook'], 'permission_callback' => '__return_true']);

        // Analytics / reporting
        register_rest_route($ns, '/analytics', ['methods' => 'GET', 'callback' => [self::class, 'get_analytics'], 'permission_callback' => [self::class, 'check_read_permission']]);

        // Queue management
        register_rest_route($ns, '/queue', ['methods' => 'GET', 'callback' => [self::class, 'get_queue'], 'permission_callback' => [self::class, 'check_read_permission']]);
        register_rest_route($ns, '/queue/process', ['methods' => 'POST', 'callback' => [self::class, 'process_queue'], 'permission_callback' => [self::class, 'check_write_permission']]);

        // AI Article Generation — calls OpenAI directly, no cron/queue needed
        register_rest_route($ns, '/generate', [
            'methods'             => 'POST',
            'callback'            => [self::class, 'generate_ai_article'],
            'permission_callback' => [self::class, 'check_write_permission'],
            'args'                => [
                'topic'        => ['type' => 'string', 'required' => true, 'sanitize_callback' => 'sanitize_text_field'],
                'status'       => ['type' => 'string', 'default' => 'publish', 'sanitize_callback' => 'sanitize_text_field'],
                'auto_publish' => ['type' => 'boolean', 'default' => true],
            ],
        ]);
    }

    private static function is_api_enabled(): bool {
        $settings = get_option('kozmo_ai_wp_settings', []);
        return ($settings['api_enabled'] ?? 'yes') === 'yes';
    }

    private static function get_rate_limit_key(string $scope): string {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
        $path = $_SERVER['REQUEST_URI'] ?? '';
        return 'rest:' . $scope . ':' . $ip . ':' . md5($path);
    }

    private static function rate_limit_response(string $scope, int $max_requests, int $window): \WP_Error|true {
        $key = self::get_rate_limit_key($scope);
        if (RateLimiter::check($key, $max_requests, $window)) {
            return true;
        }

        $retry_after = max(1, RateLimiter::get_reset_time($key) - time());
        return new \WP_Error(
            'kozmo_ai_rate_limited',
            __('Rate limit exceeded. Please try again later.', 'kozmo-ai-wp'),
            ['status' => 429, 'retry_after' => $retry_after]
        );
    }

    public static function check_read_permission() {
        if (!self::is_api_enabled() || !Auth::check_read_permission()) {
            return false;
        }

        return self::rate_limit_response('read', 120, 60);
    }

    public static function check_write_permission() {
        if (!self::is_api_enabled() || !Auth::check_write_permission()) {
            return false;
        }

        return self::rate_limit_response('write', 30, 60);
    }

    // ── Status ──
    public static function get_status(): \WP_REST_Response {
        // Auto-process pending queue items (poor man's cron)
        Worker::process_queue();

        global $wpdb;
        $settings = get_option('kozmo_ai_wp_settings', []);
        $key_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE is_active = 1");
        $queue_pending = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_queue WHERE status = 'pending'");

        return new \WP_REST_Response([
            'success' => true,
            'data'    => [
                'status'             => 'ok',
                'version'            => KOZMO_AI_WP_VERSION,
                'wp_version'         => get_bloginfo('version'),
                'php_version'        => PHP_VERSION,
                'db_version'         => KOZMO_AI_WP_DB_VERSION,
                'active_keys'        => $key_count,
                'queue_pending'      => $queue_pending,
                'site_name'          => get_bloginfo('name'),
                'site_url'           => get_bloginfo('url'),
                'agent_connected'    => !empty($settings['agent_url']),
                'last_scan'          => $settings['last_scan_at'] ?? '',
                'last_sync'          => $settings['last_sync_at'] ?? '',
                'debug_mode'         => ($settings['debug_mode'] ?? 'no') === 'yes',
                'modules'            => Main::get_instance()->get_services(),
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

        // Run quality scoring
        $quality = QualityScorer::score_article($article);
        if ($quality['score'] >= 95 && ($article['auto_publish'] ?? true)) {
            wp_publish_post($result['post_id']);
            $result['auto_published'] = true;
        }

        return new \WP_REST_Response([
            'success' => true,
            'data'    => ['post_id' => $result['post_id'], 'post_url' => $result['post_url']],
            'quality' => $quality,
        ], 201);
    }

    public static function list_posts(\WP_REST_Request $request): \WP_REST_Response {
        $status  = $request->get_param('status');
        $limit   = $request->get_param('limit') ?: 20;
        $offset  = $request->get_param('offset') ?: 0;
        $vireon_id = $request->get_param('vireon_article_id');

        $args = [
            'post_type'      => 'any',
            'post_status'    => $status ?: 'any',
            'posts_per_page' => min(100, (int) $limit),
            'offset'         => (int) $offset,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ($vireon_id) {
            $args['meta_key'] = '_kozmo_ai_article_id';
            $args['meta_value'] = sanitize_text_field($vireon_id);
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
        $success = count(array_filter($results, fn($r) => $r['result']['success']));
        return new \WP_REST_Response(['success' => $success === count($posts), 'data' => $results, 'summary' => ['total' => count($posts), 'success' => $success]], 200);
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

        return new \WP_REST_Response(['success' => true, 'data' => [
            'id' => $attachment_id, 'url' => wp_get_attachment_url($attachment_id), 'mime' => get_post_mime_type($attachment_id),
        ]], 201);
    }

    // ── Taxonomies ──
    public static function list_categories(\WP_REST_Request $request): \WP_REST_Response {
        $terms = get_terms(['taxonomy' => 'category', 'hide_empty' => false, 'orderby' => 'name']);
        $cats = array_map(fn($t) => ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug, 'count' => $t->count, 'parent' => $t->parent], $terms);
        return new \WP_REST_Response(['success' => true, 'data' => $cats, 'total' => count($cats)], 200);
    }

    public static function list_tags(\WP_REST_Request $request): \WP_REST_Response {
        $terms = get_terms(['taxonomy' => 'post_tag', 'hide_empty' => false, 'orderby' => 'name']);
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
        $settings = get_option('kozmo_ai_wp_settings', []);
        // Mask the encrypted API key — never expose it
        if (!empty($settings['openai_api_key'])) {
            $settings['openai_api_key'] = '********';
        }
        return new \WP_REST_Response(['success' => true, 'data' => $settings], 200);
    }

    public static function update_settings(\WP_REST_Request $request): \WP_REST_Response {
        $body = $request->get_json_params();
        $settings = get_option('kozmo_ai_wp_settings', []);

        // Handle OpenAI API key — encrypt it for storage
        if (isset($body['openai_api_key'])) {
            $raw_key = sanitize_text_field($body['openai_api_key']);
            if (!empty($raw_key) && $raw_key !== '********') {
                $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
                $iv = openssl_random_pseudo_bytes(16);
                $encrypted = openssl_encrypt($raw_key, 'aes-256-cbc', $key, 0, $iv);
                if (false !== $encrypted) {
                    $settings['openai_api_key'] = base64_encode($iv . $encrypted);
                }
            }
        }

        // General text/boolean settings
        $text_fields = [
            'api_enabled', 'agent_url', 'webhook_secret',
            'auto_discover', 'auto_publish', 'auto_fix_errors', 'debug_mode',
            'enable_auto_generation', 'generate_as_draft',
            'log_level', 'openai_model', 'generation_frequency',
        ];
        foreach ($text_fields as $key) {
            if (isset($body[$key])) $settings[$key] = sanitize_text_field($body[$key]);
        }

        // Numeric fields
        if (isset($body['min_quality_score'])) $settings['min_quality_score'] = absint($body['min_quality_score']);
        if (isset($body['max_articles_daily'])) $settings['max_articles_daily'] = absint($body['max_articles_daily']);

        update_option('kozmo_ai_wp_settings', $settings);

        // Reschedule cron if generation frequency changed
        if (isset($body['enable_auto_generation']) || isset($body['generation_frequency'])) {
            if (($settings['enable_auto_generation'] ?? 'yes') === 'yes') {
                Scheduler::schedule_auto_generation($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', true);
            } else {
                Scheduler::clear_auto_generation();
            }
        }

        return new \WP_REST_Response(['success' => true, 'message' => 'Settings updated.'], 200);
    }

    // ── Scan ──
    public static function trigger_scan(): \WP_REST_Response {
        $result = Scanner::run_full_scan();
        return new \WP_REST_Response(['success' => true, 'data' => $result], 200);
    }

    public static function get_knowledge(): \WP_REST_Response {
        $type = $_GET['type'] ?? '';
        if ($type) {
            $data = KnowledgeBase::get_by_type(sanitize_text_field($type));
        } else {
            $data = KnowledgeBase::get_stats();
        }
        return new \WP_REST_Response(['success' => true, 'data' => $data], 200);
    }

    // ── Webhook ──
    public static function handle_webhook(\WP_REST_Request $request): \WP_REST_Response {
        $settings = get_option('kozmo_ai_wp_settings', []);

        if (($settings['enable_webhooks'] ?? 'yes') !== 'yes') {
            return new \WP_REST_Response(['success' => false, 'message' => 'Webhooks are disabled.'], 403);
        }

        $rate_limit = self::rate_limit_response('webhook', 60, 60);
        if (is_wp_error($rate_limit)) {
            return new \WP_REST_Response(['success' => false, 'message' => $rate_limit->get_error_message()], 429);
        }

        // Verify webhook secret if configured
        if (!empty($settings['webhook_secret'])) {
            $signature = $request->get_header('X-KOZMO-AI-Signature');
            $payload   = $request->get_body();
            if (empty($signature)) return new \WP_REST_Response(['success' => false, 'message' => 'Missing signature.'], 401);
            $expected = 'sha256=' . hash_hmac('sha256', $payload, $settings['webhook_secret']);
            if (!hash_equals($expected, $signature)) return new \WP_REST_Response(['success' => false, 'message' => 'Invalid signature.'], 401);
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
                $agent_id = $data['kozmo_ai_article_id'] ?? $data['agent_article_id'] ?? $data['vireon_article_id'] ?? '';
                if (!$post_id && !empty($agent_id)) {
                    $post = Sync::get_post_by_agent_id($agent_id);
                    $post_id = $post ? $post->ID : 0;
                }
                $result = $post_id ? Sync::update_post($post_id, $data) : Sync::create_post($data);
                break;
            case 'article.deleted':
                $post_id = $data['post_id'] ?? 0;
                $agent_id = $data['kozmo_ai_article_id'] ?? $data['agent_article_id'] ?? $data['vireon_article_id'] ?? '';
                if (!$post_id && !empty($agent_id)) {
                    $post = Sync::get_post_by_agent_id($agent_id);
                    $post_id = $post ? $post->ID : 0;
                }
                $result = $post_id ? Sync::delete_post($post_id, true) : ['success' => true, 'message' => 'No matching post.'];
                break;
            case 'scan':
                Scanner::run_full_scan();
                $result = ['success' => true, 'message' => 'Scan triggered.'];
                break;
            case 'ping':
                $result = ['success' => true, 'message' => 'pong'];
                break;
            default:
                return new \WP_REST_Response(['success' => false, 'message' => "Unknown event: {$event}"], 400);
        }

        return new \WP_REST_Response(['success' => true, 'event' => $event, 'data' => $result], 200);
    }

    // ── Analytics ──
    public static function get_analytics(): \WP_REST_Response {
        // Auto-process pending queue items (poor man's cron)
        Worker::process_queue();

        global $wpdb;
        return new \WP_REST_Response(['success' => true, 'data' => [
            'logs'       => Logger::get_stats(),
            'knowledge'  => KnowledgeBase::get_stats(),
            'database'   => Database::get_table_info(),
            'queue'      => Worker::get_queue_stats(),
            'content'    => ContentAnalyzer::analyze_content_health(),
            'errors'     => HealEngine::get_error_stats(),
        ]], 200);
    }

    // ── Queue ──
    public static function get_queue(): \WP_REST_Response {
        return new \WP_REST_Response(['success' => true, 'data' => Worker::get_queue_stats()], 200);
    }

    public static function process_queue(): \WP_REST_Response {
        $processed = Worker::process_queue();
        return new \WP_REST_Response(['success' => true, 'message' => "Queue processing triggered. Processed {$processed} tasks.", 'processed' => $processed], 200);
    }

    // ── AI Article Generation (direct, no queue/cron) ──
    public static function generate_ai_article(\WP_REST_Request $request): \WP_REST_Response {
        if (!ContentGenerator::is_configured()) {
            return new \WP_REST_Response([
                'success' => false,
                'message' => 'OpenAI API key not configured. Go to KOZMO AI → Settings to add it.',
            ], 400);
        }

        $topic       = $request->get_param('topic');
        $status      = $request->get_param('status') ?: 'publish';
        $auto_publish = $request->get_param('auto_publish');

        try {
            $article = ContentGenerator::generate_article($topic);
            $result  = ContentGenerator::publish_article($article, [
                'status'       => $status,
                'auto_publish' => $auto_publish,
            ]);

            if (!$result['success']) {
                return new \WP_REST_Response(['success' => false, 'message' => $result['message']], 500);
            }

            $published_status = get_post_status($result['post_id']);

            return new \WP_REST_Response([
                'success' => true,
                'data'    => [
                    'post_id'       => $result['post_id'],
                    'post_url'      => $result['post_url'],
                    'title'         => $article['title'],
                    'slug'          => $article['slug'],
                    'meta_title'    => $article['meta_title'],
                    'meta_description' => $article['meta_description'],
                    'tags'          => $article['tags'],
                    'focus_keyword' => $article['focus_keyword'],
                    'status'        => $published_status,
                    'quality_score' => $result['quality_score'] ?? null,
                ],
            ], 201);
        } catch (\Throwable $e) {
            Logger::error('AI article generation failed', ['topic' => $topic, 'error' => $e->getMessage()]);
            return new \WP_REST_Response([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    // ── Helpers ──
    private static function format_post(\WP_Post $post): array {
        $cats = wp_get_post_categories($post->ID, ['fields' => 'all']);
        $tags = wp_get_post_tags($post->ID, ['fields' => 'all']);
        return [
            'id'             => $post->ID,
            'title'          => $post->post_title,
            'slug'           => $post->post_name,
            'content'        => $post->post_content,
            'excerpt'        => $post->post_excerpt,
            'status'         => $post->post_status,
            'type'           => $post->post_type,
            'author'         => ['id' => (int) $post->post_author, 'name' => get_the_author_meta('display_name', $post->post_author)],
            'categories'     => array_map(fn($c) => ['id' => $c->term_id, 'name' => $c->name, 'slug' => $c->slug], $cats),
            'tags'           => array_map(fn($t) => ['id' => $t->term_id, 'name' => $t->name, 'slug' => $t->slug], $tags),
            'featured_image' => get_the_post_thumbnail_url($post->ID, 'full'),
            'permalink'      => get_permalink($post->ID),
            'meta'           => ['title' => get_post_meta($post->ID, '_kozmo_ai_meta_title', true), 'description' => get_post_meta($post->ID, '_kozmo_ai_meta_description', true)],
            'agent_id'       => get_post_meta($post->ID, '_kozmo_ai_article_id', true),
            'quality_score'  => get_post_meta($post->ID, '_kozmo_ai_quality_score', true),
            'created_at'     => $post->post_date,
            'updated_at'     => $post->post_modified,
        ];
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
            'post_type' => ['type' => 'string', 'default' => 'post', 'sanitize_callback' => 'sanitize_text_field'],
            'vireon_article_id' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
            'schema' => ['type' => 'string'],
            'auto_publish' => ['type' => 'boolean'],
            'comment_status' => ['type' => 'string', 'sanitize_callback' => 'sanitize_text_field'],
        ];
    }
}
