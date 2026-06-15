<?php
/**
 * Content Generator — self-contained AI article generation engine.
 *
 * Calls OpenAI directly from PHP — no external backend needed.
 * Discovers topics, generates SEO-optimized articles, and publishes them.
 *
 * @package KozmoAI_WP
 */

namespace KozmoAI_WP;

defined('ABSPATH') || exit;

/**
 * Self-contained AI article generator.
 *
 * Flow:
 *   1. discover_topics() — scans WP categories/tags + suggests topics via OpenAI
 *   2. generate_article($topic) — calls OpenAI to write a full SEO article
 *   3. publish_article($article) — creates the WP post via Sync
 */
class ContentGenerator {

    private static ?self $instance = null;

    /** How many articles to generate in a single batch run */
    private const BATCH_SIZE = 3;

    /** OpenAI model to use */
    private string $model = 'gpt-4o';

    /** Max tokens per generation */
    private int $max_tokens = 4096;

    /** Temperature for generation */
    private float $temperature = 0.7;

    public static function init(): void {
        if (null === self::$instance) {
            self::$instance = new self();
            $instance = self::$instance;
            // Read settings into instance properties
            $settings = get_option('kozmo_ai_wp_settings', []);
            $instance->model = $settings['openai_model'] ?? 'gpt-4o';
            $instance->max_tokens = (int) ($settings['openai_max_tokens'] ?? 4096);
            $instance->temperature = (float) ($settings['openai_temperature'] ?? 0.7);
        }
        // Register cron hooks
        add_action('kozmo_ai_generate_articles', [self::class, 'auto_generate']);
        add_action('kozmo_ai_discover_topics', [self::class, 'auto_discover_topics']);
    }

    /**
     * Get the OpenAI API key from settings (stored encrypted).
     */
    private static function get_openai_key(): string {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $encrypted = $settings['openai_api_key'] ?? '';
        if (empty($encrypted)) return '';

        // Decrypt using WordPress salt as key
        $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
        $decoded = base64_decode($encrypted);
        if (false === $decoded || strlen($decoded) < 16) return '';

        $iv = substr($decoded, 0, 16);
        $encrypted_data = substr($decoded, 16);
        $decrypted = openssl_decrypt($encrypted_data, 'aes-256-cbc', $key, 0, $iv);
        return false !== $decrypted ? $decrypted : '';
    }

    /**
     * Encrypt and store the OpenAI API key.
     */
    public static function save_openai_key(string $api_key): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        if (empty($api_key)) {
            unset($settings['openai_api_key']);
        } else {
            $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
            $iv = openssl_random_pseudo_bytes(16);
            $encrypted = openssl_encrypt($api_key, 'aes-256-cbc', $key, 0, $iv);
            if (false !== $encrypted) {
                $settings['openai_api_key'] = base64_encode($iv . $encrypted);
            }
        }
        update_option('kozmo_ai_wp_settings', $settings);
    }

    /**
     * Check if we have a valid OpenAI key configured.
     */
    public static function is_configured(): bool {
        return !empty(self::get_openai_key());
    }

    // ─── OpenAI API call (raw HTTP from PHP) ─────────────────────

    /**
     * Call the OpenAI chat completions API.
     *
     * @param string $system  System prompt.
     * @param string $user    User message.
     * @return array{content: mixed, tokens_in: int, tokens_out: int}
     */
    private static function openai_chat(string $system, string $user): array {
        $api_key = self::get_openai_key();
        if (empty($api_key)) {
            throw new \RuntimeException('OpenAI API key not configured. Go to KOZMO AI → Settings.');
        }

        $instance = self::get_instance_safe();
        $response = wp_remote_post('https://api.openai.com/v1/chat/completions', [
            'timeout'  => 120,
            'headers'  => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . $api_key,
            ],
            'body'     => wp_json_encode([
                'model'             => $instance->model,
                'messages'          => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user',   'content' => $user],
                ],
                'max_tokens'        => $instance->max_tokens,
                'temperature'       => $instance->temperature,
                'response_format'   => ['type' => 'json_object'],
            ]),
        ]);

        if (is_wp_error($response)) {
            throw new \RuntimeException('OpenAI API request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            $error = json_decode($body, true);
            $msg = $error['error']['message'] ?? "HTTP {$status}";
            throw new \RuntimeException('OpenAI API error: ' . $msg);
        }

        $data = json_decode($body, true);
        $content = $data['choices'][0]['message']['content'] ?? '';
        if (empty($content)) {
            throw new \RuntimeException('OpenAI returned empty content');
        }

        return [
            'content'   => json_decode($content, true),
            'tokens_in'  => $data['usage']['prompt_tokens'] ?? 0,
            'tokens_out' => $data['usage']['completion_tokens'] ?? 0,
        ];
    }

    private static function get_instance_safe(): self {
        if (null === self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    // ─── Topic Discovery ─────────────────────────────────────────

    /**
     * Discover topics from WordPress categories + AI suggestions.
     *
     * Returns an array of topic strings ready for article generation.
     */
    public static function discover_topics(int $count = 5): array {
        $topics = [];

        // 1. Use existing WordPress categories as topic seeds
        $categories = get_categories(['hide_empty' => false, 'number' => 20]);
        foreach ($categories as $cat) {
            $topic = $cat->name;
            // Skip uncategorized, default categories
            if (in_array(strtolower($topic), ['uncategorized', 'uncategorised', 'blog', 'general'], true)) {
                continue;
            }
            $topics[] = sanitize_text_field($topic);
        }

        // 2. Get site info for context
        $site_name = get_bloginfo('name');
        $site_desc = get_bloginfo('description');

        // 3. Ask OpenAI to suggest relevant topics based on site context
        try {
            $system = 'You are a content strategist. Suggest relevant blog topics for a website.';
            $user = sprintf(
                'Website: "%s"%s has these categories: %s. Suggest %d specific, engaging blog topic ideas relevant to this site. Return JSON: {"topics": ["topic 1", "topic 2", ...]}. Make each topic specific and SEO-friendly (e.g. "How to improve customer retention with personalized email marketing" not just "marketing").',
                $site_name,
                $site_desc ? ' — ' . $site_desc : '',
                !empty($topics) ? implode(', ', array_unique($topics)) : 'various topics',
                $count
            );

            $result = self::openai_chat($system, $user);
            $ai_topics = $result['content']['topics'] ?? [];

            if (is_array($ai_topics)) {
                $topics = array_merge($topics, $ai_topics);
            }

            Logger::info('Topics discovered', ['count' => count($topics), 'ai_suggested' => count($ai_topics)]);
        } catch (\Throwable $e) {
            Logger::warning('Topic discovery via AI failed, using categories only', [
                'error' => $e->getMessage(),
            ]);
        }

        // Deduplicate and limit
        $topics = array_values(array_unique(array_filter($topics)));
        shuffle($topics);

        return array_slice($topics, 0, $count);
    }

    /**
     * Cron handler: discover topics and enqueue generation tasks.
     */
    public static function auto_discover_topics(): void {
        if (!self::is_configured()) {
            Logger::debug('Auto-discover skipped: OpenAI key not configured');
            return;
        }

        $settings = get_option('kozmo_ai_wp_settings', []);
        $daily_max = (int) ($settings['max_articles_daily'] ?? 5);

        // Check how many articles were generated today
        $today_count = self::get_today_generation_count();
        $remaining = max(0, $daily_max - $today_count);

        if ($remaining <= 0) {
            Logger::info('Daily article limit reached', ['limit' => $daily_max]);
            return;
        }

        try {
            $batch = min($remaining, self::BATCH_SIZE);
            $topics = self::discover_topics($batch);

            foreach ($topics as $topic) {
                Worker::enqueue('generate_article', ['topic' => $topic], 10);
            }

            Logger::info('Topics discovered and queued', ['count' => count($topics), 'remaining' => $remaining]);
        } catch (\Throwable $e) {
            Logger::error('Topic discovery failed', ['error' => $e->getMessage()]);
        }
    }

    // ─── Article Generation ──────────────────────────────────────

    /**
     * Generate a full SEO article for a given topic via OpenAI.
     *
     * @param string $topic The topic/keyword to write about.
     * @return array{title: string, content_html: string, slug: string, meta_title: string, meta_description: string, tags: string[], focus_keyword: string, agent_article_id: string}
     */
    public static function generate_article(string $topic): array {
        $site_name = get_bloginfo('name');

        $system = sprintf(
            'You are a senior SEO content writer for "%s". Follow Google\'s E-E-A-T guidelines.

CONTENT RULES:
- Length: 800-1500 words
- Structure: Introduction, 4-6 H2 sections with H3 subsections, FAQ (3-5 Q&A), Conclusion with CTA
- Use clean HTML tags: <h2>, <h3>, <p>, <ul>/<li>, <strong>
- Write in a professional, informative tone
- Make it scannable with bullet points and short paragraphs

SEO RULES:
- Include the topic naturally in the first 100 words
- Use semantic keyword variations throughout
- metaTitle: max 60 chars
- metaDescription: max 160 chars
- Include 3-5 relevant tags

Respond ONLY with JSON (no markdown, no code fences):
{
  "title": "Compelling article title with the main keyword",
  "metaTitle": "SEO title under 60 chars",
  "metaDescription": "SEO description under 160 chars",
  "tags": ["tag1", "tag2", "tag3"],
  "content": "Full article as clean HTML with <h2>, <h3>, <p>, <ul>, <li>, <strong>. FAQ section as <h2>Frequently Asked Questions</h2> then <h3>Q?</h3><p>A...</p>. End with conclusion paragraph and natural call-to-action.",
  "slug": "url-friendly-slug"
}',
            $site_name
        );

        $result = self::openai_chat($system, 'Write a complete SEO-optimized article about: "' . $topic . '".');
        $data = $result['content'];

        if (empty($data['title']) || empty($data['content'])) {
            throw new \RuntimeException('OpenAI response missing required fields (title or content)');
        }

        $slug = $data['slug'] ?? sanitize_title($data['title']);
        $word_count = str_word_count(wp_strip_all_tags($data['content']));

        Logger::info('Article generated via AI', [
            'topic'   => $topic,
            'title'   => $data['title'],
            'words'   => $word_count,
            'tokens'  => $result['tokens_in'] . '→' . $result['tokens_out'],
        ]);

        return [
            'title'             => sanitize_text_field($data['title']),
            'content_html'      => wp_kses_post($data['content']),
            'slug'              => sanitize_title($slug),
            'meta_title'        => mb_substr(sanitize_text_field($data['metaTitle'] ?? $data['title']), 0, 60),
            'meta_description'  => mb_substr(sanitize_textarea_field($data['metaDescription'] ?? ''), 0, 160),
            'tags'              => !empty($data['tags']) ? array_map('sanitize_text_field', (array) $data['tags']) : [$topic],
            'focus_keyword'     => sanitize_text_field($topic),
            'agent_article_id'  => 'auto_' . bin2hex(kozmo_ai_wp_random_bytes(12)),
        ];
    }

    /**
     * Publish a generated article as a WordPress post.
     *
     * @param array $article Article data from generate_article().
     * @param array{status?: string, auto_publish?: bool} $options
     * @return array{success: bool, post_id?: int, post_url?: string, message?: string}
     */
    public static function publish_article(array $article, array $options = []): array {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $status = $options['status'] ?? 'draft';
        $auto_publish = $options['auto_publish'] ?? ($settings['auto_publish'] ?? 'yes') === 'yes';

        // Build the post data
        $post_data = [
            'post_title'    => $article['title'],
            'post_content'  => $article['content_html'],
            'post_status'   => $status,
            'post_type'     => 'post',
            'post_name'     => $article['slug'],
            'post_author'   => (int) ($settings['default_author'] ?? 1),
            'meta_input'    => [
                '_kozmo_ai_meta_title'       => $article['meta_title'],
                '_kozmo_ai_meta_description' => $article['meta_description'],
                '_kozmo_ai_focus_keyword'    => $article['focus_keyword'],
                '_kozmo_ai_article_id'       => $article['agent_article_id'],
                '_kozmo_ai_generated_at'     => current_time('mysql'),
                '_kozmo_ai_auto_generated'   => '1',
            ],
        ];

        // Insert the post
        $post_id = wp_insert_post(wp_slash($post_data), true);

        if (is_wp_error($post_id)) {
            return ['success' => false, 'message' => $post_id->get_error_message()];
        }

        // Add tags
        if (!empty($article['tags'])) {
            $tag_ids = [];
            foreach ($article['tags'] as $tag) {
                $term = term_exists($tag, 'post_tag');
                if (!$term) {
                    $term = wp_insert_term($tag, 'post_tag');
                }
                if (!is_wp_error($term) && !empty($term['term_id'])) {
                    $tag_ids[] = (int) $term['term_id'];
                }
            }
            if (!empty($tag_ids)) {
                wp_set_post_tags($post_id, $tag_ids, false);
            }
        }

        // Auto-publish if quality is high enough
        $quality = QualityScorer::score_article($article);
        if ($auto_publish && $status === 'draft' && $quality['score'] >= (int) ($settings['min_quality_score'] ?? 95)) {
            wp_publish_post($post_id);
            Logger::info('Article auto-published', ['post_id' => $post_id, 'quality' => $quality['score']]);
        }

        // Track in articles table
        global $wpdb;
        $wpdb->replace(
            $wpdb->prefix . 'kozmo_ai_articles',
            [
                'post_id'          => $post_id,
                'agent_article_id' => $article['agent_article_id'],
                'quality_score'    => $quality['score'],
                'pipeline_status'  => 'completed',
            ],
            ['%d', '%s', '%f', '%s']
        );

        Logger::info('Article published by auto-generator', [
            'post_id'  => $post_id,
            'title'    => $article['title'],
            'topic'    => $article['focus_keyword'],
            'quality'  => $quality['score'],
        ]);

        return [
            'success'  => true,
            'post_id'  => $post_id,
            'post_url' => get_permalink($post_id),
        ];
    }

    // ─── Auto-Generation Cron Handler ───────────────────────────

    /**
     * Cron handler: discover topics, generate articles, and publish them.
     * Called by 'kozmo_ai_generate_articles' WP-Cron hook.
     */
    public static function auto_generate(): void {
        if (!self::is_configured()) {
            Logger::debug('Auto-generate skipped: OpenAI key not configured');
            return;
        }

        $settings = get_option('kozmo_ai_wp_settings', []);

        // Check if auto-generation is actually enabled
        if (($settings['enable_auto_generation'] ?? 'no') !== 'yes') {
            Logger::debug('Auto-generate skipped: auto-generation disabled in settings');
            // Unscheduled stale cron if disabled
            Scheduler::clear_auto_generation();
            return;
        }

        $daily_max = (int) ($settings['max_articles_daily'] ?? 5);
        $publish_status = ($settings['generate_as_draft'] ?? 'yes') === 'yes' ? 'draft' : 'publish';

        // Check daily limit
        $today_count = self::get_today_generation_count();
        if ($today_count >= $daily_max) {
            Logger::info('Daily article limit reached, skipping generation', [
                'limit' => $daily_max,
                'today' => $today_count,
            ]);
            return;
        }

        $batch = min($daily_max - $today_count, self::BATCH_SIZE);

        try {
            $topics = self::discover_topics($batch);
            Logger::info('Auto-generate starting', ['topics' => $topics, 'status' => $publish_status]);

            $generated = 0;
            foreach ($topics as $topic) {
                try {
                    $article = self::generate_article($topic);
                    $result  = self::publish_article($article, ['status' => $publish_status]);
                    if ($result['success']) {
                        $generated++;
                        Logger::info('Article auto-generated', [
                            'topic'   => $topic,
                            'post_id' => $result['post_id'],
                            'title'   => $article['title'],
                        ]);
                    }
                } catch (\Throwable $e) {
                    Logger::error('Article generation failed for topic', [
                        'topic' => $topic,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            Logger::info('Auto-generation cycle complete', [
                'generated' => $generated,
                'requested' => count($topics),
            ]);
        } catch (\Throwable $e) {
            Logger::error('Auto-generation cycle failed', ['error' => $e->getMessage()]);
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────

    /**
     * Count how many articles were auto-generated today (to enforce daily limit).
     */
    public static function get_today_generation_count(): int {
        global $wpdb;
        $today_start = gmdate('Y-m-d 00:00:00');
        $count = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->postmeta} pm
             INNER JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE pm.meta_key = '_kozmo_ai_auto_generated'
               AND pm.meta_value = '1'
               AND p.post_date >= %s",
            $today_start
        ));
        return (int) $count;
    }
}
