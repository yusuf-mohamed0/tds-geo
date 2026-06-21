<?php
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

/**
 * Sync engine — maps agent article data to WordPress posts with SEO metadata.
 */
class Sync {
    private static ?self $instance = null;

    private const STATUS_MAP = [
        'published' => 'publish', 'draft' => 'draft', 'pending' => 'pending',
        'scheduled' => 'future', 'archived' => 'draft', 'reviewed' => 'pending',
        'approved' => 'pending', 'generated' => 'draft',
    ];

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function create_post(array $article): array {
        $post_data = self::build_post_data($article);
        $settings  = get_option('tds_geo_wp_settings', []);

        if (empty($post_data['post_title'])) return ['success' => false, 'message' => 'Title required.'];
        if (empty($post_data['post_author'])) $post_data['post_author'] = (int) ($settings['default_author'] ?? 1);

        $post_id = wp_insert_post(wp_slash($post_data), true);
        if (is_wp_error($post_id)) return ['success' => false, 'message' => $post_id->get_error_message()];

        self::handle_taxonomies($post_id, $article);
        self::handle_featured_image($post_id, $article['featured_image_url'] ?? '');
        self::handle_meta($post_id, $article);

        if (!empty($article['custom_fields'])) {
            self::set_custom_fields($post_id, $article['custom_fields']);
        }

        $agent_id = $article['agent_article_id'] ?? $article['tds_geo_article_id'] ?? $article['tds_geo_article_id'] ?? '';
        update_post_meta($post_id, '_tds_geo_article_id', $agent_id);
        update_post_meta($post_id, '_tds_geo_article_id', $agent_id);
        update_post_meta($post_id, '_tds_geo_imported_at', current_time('mysql'));
        update_post_meta($post_id, '_tds_geo_imported_at', current_time('mysql'));

        global $wpdb;
        $wpdb->replace($wpdb->prefix . 'tds_geo_articles', [
            'post_id'          => $post_id,
            'agent_article_id' => $agent_id,
            'quality_score'    => $article['quality_score'] ?? $article['quality'] ?? 0,
        ], ['%d', '%s', '%f']);

        Logger::info('Post created by agent', ['post_id' => $post_id, 'title' => $post_data['post_title']]);

        return ['success' => true, 'post_id' => $post_id, 'post_url' => get_permalink($post_id)];
    }

    public static function update_post(int $post_id, array $article): array {
        $existing = get_post($post_id);
        if (!$existing) return ['success' => false, 'message' => 'Post not found.'];

        $post_data = self::build_post_data($article, $existing);
        $post_data['ID'] = $post_id;

        $updated = wp_update_post(wp_slash($post_data), true);
        if (is_wp_error($updated)) return ['success' => false, 'message' => $updated->get_error_message()];

        if (isset($article['tags']) || isset($article['categories'])) self::handle_taxonomies($post_id, $article);
        if (!empty($article['featured_image_url'])) self::handle_featured_image($post_id, $article['featured_image_url']);
        self::handle_meta($post_id, $article);

        if (!empty($article['custom_fields'])) {
            self::set_custom_fields($post_id, $article['custom_fields']);
        }

        update_post_meta($post_id, '_tds_geo_last_updated', current_time('mysql'));

        return ['success' => true, 'post_id' => $post_id];
    }

    public static function delete_post(int $post_id, bool $force = false): array {
        $result = wp_delete_post($post_id, $force);
        return $result
            ? ['success' => true]
            : ['success' => false, 'message' => 'Failed to delete post.'];
    }

    public static function get_post_by_agent_id(string $agent_id): ?\WP_Post {
        $posts = get_posts([
            'meta_key'   => '_tds_geo_article_id',
            'meta_value' => $agent_id,
            'post_type'  => 'any',
            'post_status' => 'any',
            'numberposts' => 1,
        ]);
        if (!empty($posts)) return $posts[0];

        $posts = get_posts([
            'meta_key'   => '_tds_geo_article_id',
            'meta_value' => $agent_id,
            'post_type'  => 'any',
            'post_status' => 'any',
            'numberposts' => 1,
        ]);
        return $posts[0] ?? null;
    }

    private static function build_post_data(array $article, ?\WP_Post $existing = null): array {
        $settings = get_option('tds_geo_wp_settings', []);
        $tds_geo_status = strtolower($article['status'] ?? 'draft');
        $wp_status = self::STATUS_MAP[$tds_geo_status] ?? 'draft';

        $content = $article['content_html'] ?? $article['content'] ?? '';
        $content = wp_kses_post($content);

        $excerpt = $article['meta_description'] ?? '';
        if (empty($excerpt) && !empty($content)) {
            $excerpt = wp_trim_words(wp_strip_all_tags($content), 55);
        }

        $data = [
            'post_title'    => sanitize_text_field($article['title'] ?? $existing->post_title ?? ''),
            'post_content'  => $content,
            'post_excerpt'  => sanitize_text_field($excerpt),
            'post_status'   => $article['status_override'] ?? $wp_status,
            'post_type'     => $article['post_type'] ?? 'post',
            'post_name'     => $article['slug'] ?? '',
            'comment_status' => $article['comment_status'] ?? 'closed',
            'ping_status'   => $article['ping_status'] ?? 'closed',
        ];

        if (!empty($article['publish_date'])) {
            $data['post_date'] = $article['publish_date'];
            $data['post_date_gmt'] = get_gmt_from_date($article['publish_date']);
            if ($tds_geo_status === 'scheduled') {
                $data['post_status'] = 'future';
            }
        }
        if (!empty($article['author_id'])) $data['post_author'] = (int) $article['author_id'];
        if (!empty($article['author_email'])) {
            $user = get_user_by('email', $article['author_email']);
            if ($user) $data['post_author'] = $user->ID;
        }

        if ($existing) {
            foreach ($data as $key => $value) {
                if (empty($value) && $key !== 'ID') {
                    unset($data[$key]);
                }
            }
        }

        return $data;
    }

    private static function handle_taxonomies(int $post_id, array $article): void {
        if (!empty($article['tags'])) {
            $tag_ids = [];
            foreach ((array) $article['tags'] as $tag) {
                if (is_numeric($tag)) { $tag_ids[] = (int) $tag; continue; }
                $term = term_exists(sanitize_text_field($tag), 'post_tag');
                if (!$term) $term = wp_insert_term(sanitize_text_field($tag), 'post_tag');
                if (!is_wp_error($term) && !empty($term['term_id'])) $tag_ids[] = (int) $term['term_id'];
            }
            if (!empty($tag_ids)) wp_set_post_tags($post_id, $tag_ids, false);
        }
        if (!empty($article['categories'])) {
            $cat_ids = [];
            foreach ((array) $article['categories'] as $cat) {
                if (is_numeric($cat)) { $cat_ids[] = (int) $cat; continue; }
                $name = sanitize_text_field($cat);
                $term = term_exists($name, 'category');
                if (!$term) {
                    $existing = get_terms(['taxonomy' => 'category', 'name' => $name, 'hide_empty' => false, 'number' => 1]);
                    if (!empty($existing) && !is_wp_error($existing)) $term = ['term_id' => $existing[0]->term_id];
                }
                if (!$term) $term = wp_insert_term($name, 'category');
                if (!is_wp_error($term) && !empty($term['term_id'])) $cat_ids[] = (int) $term['term_id'];
            }
            if (!empty($cat_ids)) wp_set_post_categories($post_id, $cat_ids, false);
        }
    }

    private static function handle_featured_image(int $post_id, string $image_url): void {
        if (empty($image_url)) return;

        $attachment_id = attachment_url_to_postid($image_url);
        if ($attachment_id) { set_post_thumbnail($post_id, $attachment_id); return; }

        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        $tmp = download_url($image_url);
        if (is_wp_error($tmp)) return;

        $file_array = ['name' => basename($image_url), 'tmp_name' => $tmp];
        $attachment_id = media_handle_sideload($file_array, $post_id);

        if (is_wp_error($attachment_id)) { @unlink($tmp); return; }

        set_post_thumbnail($post_id, $attachment_id);
        update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field(get_the_title($post_id)));
        @unlink($tmp);
    }

    private static function handle_meta(int $post_id, array $article): void {
        $mt = $article['meta_title'] ?? '';
        $md = $article['meta_description'] ?? '';
        $kw = $article['focus_keyword'] ?? '';

        // Yoast SEO
        if (defined('WPSEO_VERSION') || defined('WPSEO_PREMIUM_VERSION')) {
            if ($mt) update_post_meta($post_id, '_yoast_wpseo_title', $mt);
            if ($md) update_post_meta($post_id, '_yoast_wpseo_metadesc', $md);
            if ($kw) update_post_meta($post_id, '_yoast_wpseo_focuskw', $kw);
        }
        // Rank Math
        if (defined('RANK_MATH_VERSION')) {
            if ($mt) update_post_meta($post_id, 'rank_math_title', $mt);
            if ($md) update_post_meta($post_id, 'rank_math_description', $md);
            if ($kw) update_post_meta($post_id, 'rank_math_focus_keyword', $kw);
        }
        // AIOSEO
        if (defined('AIOSEO_VERSION')) {
            if ($mt) update_post_meta($post_id, '_aioseo_title', $mt);
            if ($md) update_post_meta($post_id, '_aioseo_description', $md);
        }
        // SEOPress
        if (defined('SEOPRESS_VERSION')) {
            if ($mt) update_post_meta($post_id, '_seopress_titles_title', $mt);
            if ($md) update_post_meta($post_id, '_seopress_titles_desc', $md);
        }
        // The SEO Framework
        if (defined('THE_SE_FRAMEWORK_VERSION')) {
            if ($mt) update_post_meta($post_id, '_genesis_title', $mt);
            if ($md) update_post_meta($post_id, '_genesis_description', $md);
        }

        // Always store
        if ($mt) update_post_meta($post_id, '_tds_geo_meta_title', $mt);
        if ($md) update_post_meta($post_id, '_tds_geo_meta_description', $md);
        if ($kw) update_post_meta($post_id, '_tds_geo_focus_keyword', $kw);

        if (!empty($article['schema'])) {
            update_post_meta($post_id, '_tds_geo_schema', $article['schema']);
        }
    }

    private static function set_custom_fields(int $post_id, array $custom_fields): void {
        foreach ($custom_fields as $key => $value) {
            if (str_starts_with($key, '_tds_geo_')) continue;
            if (is_array($value)) $value = wp_json_encode($value);
            update_post_meta($post_id, sanitize_key($key), sanitize_text_field((string) $value));
        }
    }

    private static function should_import(string $setting_key, array $settings): bool {
        return ($settings[$setting_key] ?? 'yes') === 'yes';
    }

    public static function get_agent_posts(int $limit = 50, string $status = ''): array {
        $args = [
            'meta_key'   => '_tds_geo_imported_at',
            'post_type'  => 'any',
            'post_status' => $status ?: 'any',
            'numberposts' => $limit,
            'orderby'    => 'meta_value',
            'order'      => 'DESC',
        ];

        $posts = get_posts($args);
        $results = [];

        foreach ($posts as $post) {
            $results[] = [
                'post_id'           => $post->ID,
                'title'             => $post->post_title,
                'status'            => $post->post_status,
                'url'               => get_permalink($post->ID),
                'agent_article_id'  => get_post_meta($post->ID, '_tds_geo_article_id', true),
                'imported_at'       => get_post_meta($post->ID, '_tds_geo_imported_at', true),
            ];
        }

        return $results;
    }
}
