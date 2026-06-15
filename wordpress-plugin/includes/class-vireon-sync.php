<?php
/**
 * Vireon Content Sync Service
 *
 * Maps Vireon article data to WordPress posts, handling:
 * - Post creation, updates, and deletion
 * - Category and tag mapping
 * - Featured image handling
 * - Custom field / meta management
 * - Scheduling and status mapping
 * - SEO metadata (Yoast, Rank Math, etc.)
 *
 * @package Vireon_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Vireon_Sync {

    /**
     * @var self|null Singleton instance
     */
    private static ?self $instance = null;

    /**
     * Vireon status → WP post status mapping.
     */
    private const STATUS_MAP = [
        'published' => 'publish',
        'draft'     => 'draft',
        'pending'   => 'pending',
        'scheduled' => 'future',
        'archived'  => 'draft',
        'reviewed'  => 'pending',
        'approved'  => 'pending',
        'generated' => 'draft',
    ];

    /**
     * Initialize sync hooks.
     */
    public static function init(): void {
        if (self::$instance === null) {
            self::$instance = new self();
        }
    }

    /**
     * Create a new WordPress post from Vireon article data.
     *
     * @param array $article Vireon article data. Expected keys:
     *                       title, content, slug, status, tags, categories,
     *                       meta_title, meta_description, featured_image_url,
     *                       custom_fields, publish_date, author_id.
     *
     * @return array{success: bool, post_id?: int, post_url?: string, message?: string}
     */
    public static function create_post(array $article): array {
        $post_data = self::build_post_data($article);
        $settings  = get_option(VIREON_SETTINGS_OPTION, []);

        // Validate required data
        if (empty($post_data['post_title'])) {
            return [
                'success' => false,
                'message' => __('Post title is required.', 'vireon-integration'),
            ];
        }

        // Set default author if not specified
        if (empty($post_data['post_author'])) {
            $post_data['post_author'] = (int) ($settings['default_author'] ?? 1);
        }

        // Create the post
        $post_id = wp_insert_post(wp_slash($post_data), true);

        if (is_wp_error($post_id)) {
            Vireon_Logger::error('Failed to create post', [
                'title' => $post_data['post_title'],
                'error' => $post_id->get_error_message(),
            ]);

            return [
                'success' => false,
                'message' => $post_id->get_error_message(),
            ];
        }

        // Handle categories
        if (!empty($article['categories']) && self::should_import('auto_import_cats', $settings)) {
            self::set_post_categories($post_id, $article['categories']);
        }

        // Handle tags
        if (!empty($article['tags']) && self::should_import('auto_import_tags', $settings)) {
            self::set_post_tags($post_id, $article['tags']);
        }

        // Handle featured image
        if (!empty($article['featured_image_url'])) {
            self::set_featured_image($post_id, $article['featured_image_url']);
        }

        // Handle custom fields / meta
        if (!empty($article['custom_fields'])) {
            self::set_custom_fields($post_id, $article['custom_fields']);
        }

        // Handle SEO metadata (Yoast, Rank Math)
        self::set_seo_meta($post_id, $article);

        // Store Vireon metadata for cross-reference
        update_post_meta($post_id, '_vireon_article_id', $article['vireon_article_id'] ?? '');
        update_post_meta($post_id, '_vireon_imported_at', current_time('mysql'));
        update_post_meta($post_id, '_vireon_source', 'api');

        Vireon_Logger::info('Post created from Vireon', [
            'post_id'      => $post_id,
            'title'        => $post_data['post_title'],
            'status'       => $post_data['post_status'],
            'vireon_id'    => $article['vireon_article_id'] ?? 'N/A',
        ]);

        return [
            'success'  => true,
            'post_id'  => $post_id,
            'post_url' => get_permalink($post_id),
            'message'  => __('Post created successfully.', 'vireon-integration'),
        ];
    }

    /**
     * Update an existing WordPress post from Vireon article data.
     *
     * @param int   $post_id WordPress post ID.
     * @param array $article Vireon article data (partial or full).
     *
     * @return array{success: bool, post_id?: int, message?: string}
     */
    public static function update_post(int $post_id, array $article): array {
        $existing = get_post($post_id);
        if (!$existing) {
            return [
                'success' => false,
                'message' => __('Post not found.', 'vireon-integration'),
            ];
        }

        $post_data = self::build_post_data($article, $existing);
        $post_data['ID'] = $post_id;

        $updated = wp_update_post(wp_slash($post_data), true);

        if (is_wp_error($updated)) {
            Vireon_Logger::error('Failed to update post', [
                'post_id' => $post_id,
                'error'   => $updated->get_error_message(),
            ]);

            return [
                'success' => false,
                'message' => $updated->get_error_message(),
            ];
        }

        // Update tags if provided
        if (isset($article['tags'])) {
            self::set_post_tags($post_id, $article['tags']);
        }

        // Update categories if provided
        if (isset($article['categories'])) {
            self::set_post_categories($post_id, $article['categories']);
        }

        // Update featured image
        if (!empty($article['featured_image_url'])) {
            self::set_featured_image($post_id, $article['featured_image_url']);
        }

        // Update custom fields
        if (!empty($article['custom_fields'])) {
            self::set_custom_fields($post_id, $article['custom_fields']);
        }

        // Update SEO metadata
        self::set_seo_meta($post_id, $article);

        update_post_meta($post_id, '_vireon_last_updated', current_time('mysql'));

        Vireon_Logger::info('Post updated from Vireon', [
            'post_id' => $post_id,
            'title'   => $article['title'] ?? $existing->post_title,
        ]);

        return [
            'success' => true,
            'post_id' => $post_id,
            'message' => __('Post updated successfully.', 'vireon-integration'),
        ];
    }

    /**
     * Delete a WordPress post.
     *
     * @param int  $post_id     WordPress post ID.
     * @param bool $force_delete Whether to permanently delete or trash.
     *
     * @return array{success: bool, message?: string}
     */
    public static function delete_post(int $post_id, bool $force_delete = false): array {
        $result = wp_delete_post($post_id, $force_delete);

        if (!$result) {
            return [
                'success' => false,
                'message' => __('Failed to delete post.', 'vireon-integration'),
            ];
        }

        Vireon_Logger::info('Post deleted via Vireon', [
            'post_id' => $post_id,
            'force'   => $force_delete,
        ]);

        return [
            'success' => true,
            'message' => __('Post deleted successfully.', 'vireon-integration'),
        ];
    }

    /**
     * Get a WordPress post by Vireon article ID.
     *
     * @param string $vireon_id The Vireon article UUID.
     *
     * @return WP_Post|null
     */
    public static function get_post_by_vireon_id(string $vireon_id): ?WP_Post {
        $posts = get_posts([
            'meta_key'   => '_vireon_article_id',
            'meta_value' => $vireon_id,
            'post_type'  => 'any',
            'post_status' => 'any',
            'numberposts' => 1,
        ]);

        return $posts[0] ?? null;
    }

    /**
     * Build wp_insert_post compatible post data from Vireon article.
     *
     * @param array     $article  Vireon article data.
     * @param WP_Post|null $existing Existing post (for partial updates).
     *
     * @return array
     */
    private static function build_post_data(array $article, ?WP_Post $existing = null): array {
        $settings = get_option(VIREON_SETTINGS_OPTION, []);

        // Map Vireon status to WP status
        $vireon_status = strtolower($article['status'] ?? 'draft');
        $wp_status = self::STATUS_MAP[$vireon_status] ?? 'draft';

        // Handle content format (HTML or markdown)
        $content = $article['content_html'] ?? $article['content'] ?? '';
        $content = wp_kses_post($content); // Sanitize HTML

        // Generate excerpt
        $excerpt = $article['meta_description'] ?? '';
        if (empty($excerpt) && !empty($content)) {
            $excerpt = wp_trim_words(wp_strip_all_tags($content), 55, '...');
        }

        // Build post data
        $post_data = [
            'post_title'    => sanitize_text_field($article['title'] ?? $existing->post_title ?? ''),
            'post_content'  => $content,
            'post_excerpt'  => sanitize_text_field($excerpt),
            'post_status'   => $article['status_override'] ?? $wp_status,
            'post_type'     => $article['post_type'] ?? 'post',
            'post_name'     => $article['slug'] ?? '',
            'comment_status' => $article['comment_status'] ?? 'closed',
            'ping_status'   => $article['ping_status'] ?? 'closed',
        ];

        // Handle scheduling
        if (!empty($article['publish_date'])) {
            $post_data['post_date'] = $article['publish_date'];
            $post_data['post_date_gmt'] = get_gmt_from_date($article['publish_date']);
            if ($vireon_status === 'scheduled') {
                $post_data['post_status'] = 'future';
            }
        }

        // Author
        if (!empty($article['author_id'])) {
            $post_data['post_author'] = (int) $article['author_id'];
        } elseif (!empty($article['author_email'])) {
            $user = get_user_by('email', $article['author_email']);
            if ($user) {
                $post_data['post_author'] = $user->ID;
            }
        }

        // Clean up empty values from partial updates
        if ($existing) {
            foreach ($post_data as $key => $value) {
                if (empty($value) && $key !== 'ID') {
                    unset($post_data[$key]);
                }
            }
        }

        return $post_data;
    }

    /**
     * Set categories on a post, creating new ones if needed.
     *
     * @param int   $post_id     Post ID.
     * @param array $categories  Array of category names, slugs, or IDs.
     */
    private static function set_post_categories(int $post_id, array $categories): void {
        $term_ids = [];

        foreach ($categories as $category) {
            $term_id = self::resolve_term($category, 'category');
            if ($term_id) {
                $term_ids[] = $term_id;
            }
        }

        if (!empty($term_ids)) {
            wp_set_post_categories($post_id, $term_ids, false);
        }
    }

    /**
     * Set tags on a post, creating new ones if needed.
     *
     * @param int   $post_id Post ID.
     * @param array $tags    Array of tag names.
     */
    private static function set_post_tags(int $post_id, array $tags): void {
        $tag_ids = [];

        foreach ($tags as $tag) {
            if (is_numeric($tag)) {
                // Already a term ID
                $tag_ids[] = (int) $tag;
            } else {
                // Find or create by name/slug
                $term = term_exists(sanitize_text_field($tag), 'post_tag');
                if (!$term) {
                    $term = wp_insert_term(sanitize_text_field($tag), 'post_tag');
                }
                if (!is_wp_error($term) && !empty($term['term_id'])) {
                    $tag_ids[] = (int) $term['term_id'];
                }
            }
        }

        if (!empty($tag_ids)) {
            wp_set_post_tags($post_id, $tag_ids, false);
        }
    }

    /**
     * Resolve a category term by ID, slug, or name.
     *
     * @param string|int $category Category value.
     * @param string     $taxonomy Taxonomy name.
     *
     * @return int|null Term ID, or null on failure.
     */
    private static function resolve_term($category, string $taxonomy = 'category'): ?int {
        if (is_numeric($category)) {
            $term = term_exists((int) $category, $taxonomy);
            return $term ? (int) $category : null;
        }

        $category_name = sanitize_text_field((string) $category);

        // Try by slug first
        $term = term_exists($category_name, $taxonomy);

        // Try by name
        if (!$term) {
            $existing = get_terms([
                'taxonomy'   => $taxonomy,
                'name'       => $category_name,
                'hide_empty' => false,
                'number'     => 1,
            ]);
            if (!empty($existing) && !is_wp_error($existing)) {
                $term = ['term_id' => $existing[0]->term_id];
            }
        }

        // Create new term
        if (!$term) {
            $new = wp_insert_term($category_name, $taxonomy);
            if (!is_wp_error($new)) {
                return $new['term_id'];
            }
            return null;
        }

        return (int) ($term['term_id'] ?? 0) ?: null;
    }

    /**
     * Set featured image from a URL.
     *
     * @param int    $post_id Post ID.
     * @param string $image_url Remote image URL to download and attach.
     */
    private static function set_featured_image(int $post_id, string $image_url): void {
        require_once ABSPATH . 'wp-admin/includes/media.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/image.php';

        // Check if we already have this media imported
        $attachment_id = attachment_url_to_postid($image_url);
        if ($attachment_id) {
            set_post_thumbnail($post_id, $attachment_id);
            return;
        }

        // Download and sideload the image
        $tmp = download_url($image_url);
        if (is_wp_error($tmp)) {
            Vireon_Logger::warning('Failed to download featured image', [
                'post_id'   => $post_id,
                'image_url' => $image_url,
                'error'     => $tmp->get_error_message(),
            ]);
            return;
        }

        $file_array = [
            'name'     => basename($image_url),
            'tmp_name' => $tmp,
        ];

        $attachment_id = media_handle_sideload($file_array, $post_id);

        if (is_wp_error($attachment_id)) {
            Vireon_Logger::warning('Failed to sideload featured image', [
                'post_id' => $post_id,
                'error'   => $attachment_id->get_error_message(),
            ]);
            // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
            @unlink($tmp);
            return;
        }

        set_post_thumbnail($post_id, $attachment_id);

        // Set alt text from the post title
        $post_title = get_the_title($post_id);
        if (!empty($post_title)) {
            update_post_meta($attachment_id, '_wp_attachment_image_alt', sanitize_text_field($post_title));
        }

        // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
        @unlink($tmp);

        Vireon_Logger::info('Featured image set', [
            'post_id'       => $post_id,
            'attachment_id' => $attachment_id,
        ]);
    }

    /**
     * Set custom fields / post meta.
     *
     * @param int   $post_id       Post ID.
     * @param array $custom_fields Key-value pairs of meta data.
     */
    private static function set_custom_fields(int $post_id, array $custom_fields): void {
        foreach ($custom_fields as $key => $value) {
            // Skip internal Vireon fields
            if (str_starts_with($key, '_vireon_')) {
                continue;
            }

            if (is_array($value)) {
                $value = wp_json_encode($value);
            }

            update_post_meta($post_id, sanitize_key($key), sanitize_text_field((string) $value));
        }
    }

    /**
     * Set SEO metadata — supports Yoast, Rank Math, and All in One SEO.
     *
     * @param int   $post_id Post ID.
     * @param array $article Article data with meta_title and meta_description.
     */
    private static function set_seo_meta(int $post_id, array $article): void {
        $meta_title       = $article['meta_title'] ?? '';
        $meta_description = $article['meta_description'] ?? '';
        $focus_keyword    = $article['focus_keyword'] ?? '';

        // Yoast SEO
        if (defined('WPSEO_VERSION') || defined('WPSEO_PREMIUM_VERSION')) {
            if (!empty($meta_title)) {
                update_post_meta($post_id, '_yoast_wpseo_title', $meta_title);
            }
            if (!empty($meta_description)) {
                update_post_meta($post_id, '_yoast_wpseo_metadesc', $meta_description);
            }
            if (!empty($focus_keyword)) {
                update_post_meta($post_id, '_yoast_wpseo_focuskw', $focus_keyword);
            }
        }

        // Rank Math SEO
        if (defined('RANK_MATH_VERSION')) {
            if (!empty($meta_title)) {
                update_post_meta($post_id, 'rank_math_title', $meta_title);
            }
            if (!empty($meta_description)) {
                update_post_meta($post_id, 'rank_math_description', $meta_description);
            }
            if (!empty($focus_keyword)) {
                update_post_meta($post_id, 'rank_math_focus_keyword', $focus_keyword);
            }
        }

        // All in One SEO
        if (defined('AIOSEO_VERSION')) {
            if (!empty($meta_title)) {
                update_post_meta($post_id, '_aioseo_title', $meta_title);
            }
            if (!empty($meta_description)) {
                update_post_meta($post_id, '_aioseo_description', $meta_description);
            }
        }

        // SEOPress
        if (defined('SEOPRESS_VERSION')) {
            if (!empty($meta_title)) {
                update_post_meta($post_id, '_seopress_titles_title', $meta_title);
            }
            if (!empty($meta_description)) {
                update_post_meta($post_id, '_seopress_titles_desc', $meta_description);
            }
        }

        // Always store Vireon SEO data
        if (!empty($meta_title)) {
            update_post_meta($post_id, '_vireon_meta_title', $meta_title);
        }
        if (!empty($meta_description)) {
            update_post_meta($post_id, '_vireon_meta_description', $meta_description);
        }
    }

    /**
     * Check whether to auto-import a given feature based on settings.
     *
     * @param string $setting_key The settings key.
     * @param array  $settings    Current settings array.
     *
     * @return bool
     */
    private static function should_import(string $setting_key, array $settings): bool {
        return ($settings[$setting_key] ?? 'yes') === 'yes';
    }

    /**
     * Get posts that have been imported via Vireon.
     *
     * @param int    $limit  Max posts to fetch.
     * @param string $status Optional post status filter.
     *
     * @return array
     */
    public static function get_vireon_posts(int $limit = 50, string $status = ''): array {
        $args = [
            'meta_key'   => '_vireon_imported_at',
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
                'post_id'          => $post->ID,
                'title'            => $post->post_title,
                'status'           => $post->post_status,
                'url'              => get_permalink($post->ID),
                'vireon_article_id' => get_post_meta($post->ID, '_vireon_article_id', true),
                'imported_at'      => get_post_meta($post->ID, '_vireon_imported_at', true),
            ];
        }

        return $results;
    }
}
