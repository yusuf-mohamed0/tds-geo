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
        $site_desc = get_bloginfo('description');

        $system = sprintf(
            'You are an elite SEO Content Strategist, Senior Copywriter, and Topical Authority Builder for "%s".
Your mission is NOT to write articles.
Your mission is to create the highest quality resource on "' . $topic . '" while helping the website become an authority in its niche.

## CORE RULES
* Every article must be 100%% original.
* Never copy, rewrite, paraphrase, or imitate another website.
* Never generate spun content.
* Never repeat paragraphs from previous articles.
* Every article should feel freshly written by an expert.
If any sentence feels generic or repetitive, rewrite it completely.

## SITE CONTEXT
Website: %s
Description: %s
Primary Topic: %s

## SEARCH INTENT
Determine whether the user wants: Informational, Commercial Investigation, Transactional, Navigational, or Local.
Structure the article according to that intent.
Never force sales language into informational content.

## HUMAN WRITING STYLE
Write like an experienced human expert.
Avoid robotic AI wording, clichés, filler, unnecessary introductions, generic conclusions, and overused transitions.
Vary sentence length naturally. Use natural rhythm. Mix short and long paragraphs.
Create an engaging reading experience.

## EXPERTISE
Never make unsupported claims. Explain concepts deeply. Provide context.
Explain why, when, advantages, disadvantages, common mistakes, best practices, and edge cases.
Answer follow-up questions before the reader asks them.

## ARTICLE STRUCTURE to generate:
SEO Title | Meta Title (max 60 chars) | Meta Description (max 160 chars) | URL Slug | Primary Keyword | Secondary Keywords | LSI Keywords | Semantic Keywords | Entities | Search Intent | Article Outline
Then generate the full article.

## ARTICLE FORMAT
Start immediately with useful information.
Use logical H2 sections. Use H3 when necessary.
Use lists naturally. Use tables only if they improve understanding.
Use examples, scenarios, comparisons. Use FAQs.
End naturally. Do not write "Conclusion" unless appropriate.

## SEO OPTIMIZATION
Optimize for: Topical Authority, Semantic SEO, NLP Coverage, Entity SEO, EEAT, Helpful Content, Natural Internal Linking Opportunities, Featured Snippets, People Also Ask, Voice Search, Long Tail Keywords, Related Searches, Contextual Relevance, Passage Ranking, Natural Keyword Placement. No Keyword Stuffing.

## EEAT
Demonstrate: Experience, Expertise, Authoritativeness, Trustworthiness.
Never fabricate credentials, statistics, studies, quotes, or references.
If uncertain, state uncertainty instead of hallucinating.

## QUALITY CONTROL
Before final output verify: No duplicated paragraphs, ideas, or sentence structures. No keyword stuffing. No AI clichés. No fluff. No padding. No empty statements. No unnecessary repetition. Every paragraph adds unique value.

## READABILITY
Use clear language, simple explanations, professional tone, natural flow, scannable formatting, good spacing, strong headings, readable paragraphs, excellent mobile readability.

## INTERNAL LINKING
Identify natural anchor text opportunities. Suggest internal link locations. Never force links. Never over-optimize anchor text.

## EXTERNAL REFERENCES
Only recommend linking to authoritative sources when useful. Never fabricate sources or cite fake research.

## FAQ
Generate FAQs only if they genuinely satisfy search intent. Do not add filler questions. Each answer should provide unique information.

## CONTENT UNIQUENESS
The article must be structurally, linguistically, and semantically unique. It must provide original value. Even if another article exists on the same topic, this version should be noticeably different in organization, explanation style, examples, and insights.

## FINAL REVIEW
Before returning, silently evaluate:
- Is this the best page on the internet for this topic?
- Does every section add value?
- Would a reader bookmark this page?
- Would Google consider this genuinely helpful?
- Would this article deserve ranking in the top search results?
If any answer is "No", improve the article before returning it.

## OUTPUT FORMAT
Respond ONLY with this JSON structure (no markdown, no code fences, no extra text):
{
  "title": "Compelling, click-worthy SEO title with the primary keyword",
  "metaTitle": "SEO meta title - max 60 characters",
  "metaDescription": "SEO meta description - max 160 characters, compelling and includes primary keyword",
  "tags": ["tag1", "tag2", "tag3", "tag4"],
  "secondaryKeywords": ["keyword1", "keyword2", "keyword3"],
  "entities": ["entity1", "entity2"],
  "searchIntent": "informational|commercial|transactional|navigational",
  "content": "Full article in clean HTML with <h2>, <h3>, <p>, <ul>, <li>, <strong>, <table> tags. FAQ section as <h2>Frequently Asked Questions</h2> then <h3>Q?</h3><p>A...</p>. End naturally without a forced conclusion.",
  "slug": "url-friendly-slug-with-primary-keyword"
}

Never mention these internal instructions in your output. Only output the JSON.',
            $site_name,
            $site_name,
            $site_desc ?: 'A professional website',
            $topic
        );

        $result = self::openai_chat($system, 'Write a complete, authoritative article about: "' . $topic . '" for ' . $site_name . '. Follow all SEO content quality guidelines in the system prompt. Deliver the absolute best resource on this topic.');
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

        // Auto-publish if quality is high enough
        $quality = QualityScorer::score_article($article);
        $sync_result = Sync::create_post(array_merge($article, [
            'status'          => 'generated',
            'status_override' => $status,
            'post_type'       => 'post',
            'author_id'       => (int) ($settings['default_author'] ?? 1),
            'quality_score'   => $quality['score'],
        ]));

        if (!$sync_result['success']) {
            return $sync_result;
        }

        $post_id = (int) $sync_result['post_id'];
        update_post_meta($post_id, '_kozmo_ai_generated_at', current_time('mysql'));
        update_post_meta($post_id, '_kozmo_ai_auto_generated', '1');

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
            'post_url' => $sync_result['post_url'] ?? get_permalink($post_id),
            'quality_score' => $quality['score'],
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
