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
    public static function get_openai_key(): string {
        // Try settings first (stored encrypted)
        $settings = get_option('kozmo_ai_wp_settings', []);
        $encrypted = $settings['openai_api_key'] ?? '';
        if (!empty($encrypted)) {
            $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
            $decoded = base64_decode($encrypted);
            if (false !== $decoded && strlen($decoded) >= 16) {
                $iv = substr($decoded, 0, 16);
                $encrypted_data = substr($decoded, 16);
                $decrypted = openssl_decrypt($encrypted_data, 'aes-256-cbc', $key, 0, $iv);
                if (false !== $decrypted) return $decrypted;
            }
        }
        // Fall back to global default constant (set in wp-config.php)
        if (defined('KOZMO_AI_DEFAULT_OPENAI_KEY') && KOZMO_AI_DEFAULT_OPENAI_KEY) {
            return KOZMO_AI_DEFAULT_OPENAI_KEY;
        }
        return '';
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

        // Try backend first (when configured)
        try {
            $backend_topics = BackendClient::discover_topics($count);
            if (null !== $backend_topics && !empty($backend_topics)) {
                Logger::info('Topics discovered via backend', ['count' => count($backend_topics)]);
                return $backend_topics;
            }
        } catch (\Throwable $e) {
            Logger::warning('BackendClient::discover_topics threw', ['error' => $e->getMessage()]);
        }

        // 1. Use existing WordPress categories as topic seeds
        $categories = get_categories(['hide_empty' => false, 'number' => 20]);
        foreach ($categories as $cat) {
            $topic = $cat->name;
            if (in_array(strtolower($topic), ['uncategorized', 'uncategorised', 'blog', 'general'], true)) {
                continue;
            }
            $topics[] = sanitize_text_field($topic);
        }

        // 2. Get site info + graphify intelligence for context
        $site_name = get_bloginfo('name');
        $site_desc = get_bloginfo('description');

        // Inject graphify topic hints when available — wrapped to never block
        $graphify_hints = '';
        try {
            if (GraphifyClient::is_available()) {
                $clusters = GraphifyClient::get_topic_hints();
                if (!empty($clusters)) {
                    $graphify_hints = "\n\nKnowledge graph topic clusters (codebase entities):\n{$clusters}";
                }
            }
        } catch (\Throwable $e) {
            Logger::warning('GraphifyClient topic hint injection failed', ['error' => $e->getMessage()]);
        }

        // 3. Ask OpenAI to suggest relevant topics based on site context
        try {
            $system = 'You are a content strategist. Suggest relevant blog topics for a website.';
            $user = sprintf(
                'Website: "%s"%s has these categories: %s. Suggest %d specific, engaging blog topic ideas relevant to this site.%s Return JSON: {"topics": ["topic 1", "topic 2", ...]}. Make each topic specific and SEO-friendly (e.g. "How to improve customer retention with personalized email marketing" not just "marketing").',
                $site_name,
                $site_desc ? ' — ' . $site_desc : '',
                !empty($topics) ? implode(', ', array_unique($topics)) : 'various topics',
                $count,
                $graphify_hints
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

        $topics = array_values(array_unique(array_filter($topics)));
        shuffle($topics);

        return array_slice($topics, 0, $count);
    }

    private static function get_site_categories(int $limit = 20): array {
        $categories = get_categories(['hide_empty' => false, 'number' => $limit]);
        $available = [];

        foreach ($categories as $cat) {
            $name = sanitize_text_field($cat->name);
            if (in_array(strtolower($name), ['uncategorized', 'uncategorised', 'blog', 'general'], true)) {
                continue;
            }
            $available[] = $name;
        }

        return array_values(array_unique(array_filter($available)));
    }

    private static function infer_categories(string $topic, array $available_categories, array $requested_categories = []): array {
        $normalized_available = [];
        foreach ($available_categories as $category) {
            $normalized_available[sanitize_title($category)] = sanitize_text_field($category);
        }

        $selected = [];
        foreach ($requested_categories as $category) {
            $key = sanitize_title((string) $category);
            if (isset($normalized_available[$key])) {
                $selected[] = $normalized_available[$key];
            }
        }

        if (!empty($selected)) {
            return array_values(array_unique($selected));
        }

        $topic_terms = preg_split('/[^a-z0-9]+/i', sanitize_title($topic)) ?: [];
        foreach ($normalized_available as $key => $category) {
            foreach ($topic_terms as $term) {
                if (strlen($term) < 4) {
                    continue;
                }
                if (strpos($key, $term) !== false) {
                    $selected[] = $category;
                    break;
                }
            }
        }

        if (empty($selected) && !empty($available_categories)) {
            $selected[] = $available_categories[0];
        }

        return array_slice(array_values(array_unique($selected)), 0, 2);
    }

    private static function normalize_freshness(string $text, int $current_year): string {
        return (string) preg_replace_callback('/\b20\d{2}\b/', static function(array $matches) use ($current_year) {
            $year = (int) $matches[0];
            if ($year >= $current_year) {
                return $matches[0];
            }

            return (string) $current_year;
        }, $text);
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
     * Update pipeline stage tracking meta for a generated article.
     */
    private static function set_pipeline_stage(?int $post_id, string $stage, ?string $error = null): void {
        if (!$post_id) {
            // Before post exists, store in a transient keyed by agent_article_id
            return;
        }
        update_post_meta($post_id, '_kozmo_ai_pipeline_stage', $stage);
        update_post_meta($post_id, '_kozmo_ai_pipeline_updated', current_time('mysql'));
        if ($error) {
            update_post_meta($post_id, '_kozmo_ai_pipeline_error', $error);
            Logger::error("Pipeline stage '{$stage}' failed", ['post_id' => $post_id, 'error' => $error]);
        } else {
            delete_post_meta($post_id, '_kozmo_ai_pipeline_error');
        }
    }

    /**
     * Generate a full SEO article for a given topic via OpenAI or backend.
     *
     * @param string $topic The topic/keyword to write about.
     * @return array{title: string, content_html: string, slug: string, meta_title: string, meta_description: string, tags: string[], focus_keyword: string, agent_article_id: string}
     */
    public static function generate_article(string $topic): array {
        // Try backend first (when configured) — wrapped in try-catch so fallback always works
        try {
            $backend_result = BackendClient::generate_article($topic);
            if (null !== $backend_result) {
                Logger::info('Article generated via backend API', ['topic' => $topic, 'title' => $backend_result['title']]);
                return $backend_result;
            }
        } catch (\Throwable $e) {
            Logger::warning('BackendClient::generate_article threw', ['error' => $e->getMessage()]);
        }

        // Fall back to direct OpenAI with knowledge graph intelligence
        $site_name = get_bloginfo('name');
        $site_desc = get_bloginfo('description');
        $current_year = (int) gmdate('Y');
        $today = gmdate('Y-m-d');
        $available_categories = self::get_site_categories();
        $categories_context = !empty($available_categories) ? implode(', ', $available_categories) : 'No specific categories configured';
        $agent_article_id = 'auto_' . bin2hex(kozmo_ai_wp_random_bytes(12));

        // Inject graphify knowledge graph entities when available — wrapped to never block generation
        $graphify_context = '';
        try {
            if (GraphifyClient::is_available()) {
                $entities = GraphifyClient::get_entity_context(30);
                $topics   = GraphifyClient::get_topic_hints();
                if (!empty($entities)) {
                    $graphify_context = "\n## KNOWLEDGE GRAPH ENTITIES (codebase intelligence)\nRelated entities from the project knowledge graph:\n{$entities}\n";
                }
                if (!empty($topics)) {
                    $graphify_context .= "\n## TOPIC CLUSTERS\nRelated topic clusters to draw from:\n{$topics}\n";
                }
            }
        } catch (\Throwable $e) {
            Logger::warning('GraphifyClient context injection failed', ['error' => $e->getMessage()]);
            $graphify_context = '';
        }

        Logger::info('Pipeline stage: generating_article', ['topic' => $topic, 'agent_article_id' => $agent_article_id]);

        $system = sprintf(
            'You are a permanent Senior SEO Strategist, Editorial Director, GEO Specialist, and Human Copywriter for "%s".
Your objective is to produce the highest quality, most creative, and most authoritative article possible for this topic.
Content must rank for years without major rewrites and must be optimized for BOTH traditional search engines AND AI search engines (ChatGPT, Perplexity, Gemini, Claude, Copilot).
Never optimize for speed. Always optimize for quality.

## ABSOLUTE RULES — These are mandatory. Never violate them.
- Never copy content from any website. Never rewrite existing articles. Never paraphrase competitors.
- Never generate spun content, filler, meaningless introductions, generic conclusions, or keyword stuffing.
- Never repeat paragraphs, ideas, or sentence structures unnecessarily.
- Never generate AI clichés, robotic wording, or predictable sentence patterns.
- Every sentence must provide unique value. Every paragraph must have a unique purpose.
- Never fabricate statistics, studies, quotes, research papers, case studies, or sources. Ever.

## SITE CONTEXT
Website: %s
Description: %s
Primary Topic: %s — which is the article topic: "' . $topic . '"
Today: %s
Current Year: %d
Available Site Categories: %s
%s

## TOPIC: "' . $topic . '"
Write the best resource on this topic that has ever been written — the definitive guide that leaves all competitors obsolete.

## FRESHNESS
The article must be current as of %s. Use up-to-date language, examples, and recommendations suitable for %d.

## CREATIVITY & ORIGINALITY — THIS IS CRITICAL
Write from first principles. Assume millions of articles already exist on this topic. Yours must be different.
- Start with a bold, original angle or hook — not a generic introduction
- Use storytelling, narrative tension, surprising analogies, and vivid examples
- Create your own structure — never follow competitor templates or standard formats
- Include original frameworks, mental models, or decision trees that do not exist anywhere else
- Challenge conventional wisdom when it makes sense — offer a contrarian perspective backed by reasoning
- Write with personality: authoritative but not dry, expert but not inaccessible
- Every article should feel like it was written by a human expert who has deep firsthand experience
- Vary sentence structure dramatically: short punchy sentences. Long flowing explanations. Rhetorical questions. Direct address to the reader.
- Use metaphors and analogies that make complex ideas instantly understandable
- Include "what most people get wrong" sections — these are highly engaging

## GENERATIVE ENGINE OPTIMIZATION (GEO) — AI Search Engine Optimization
This article MUST be optimized for how AI search engines consume and cite content:
- Use clear, unambiguous language that AI models can confidently cite as authoritative
- Structure information in digestible chunks — AI models prefer well-organized, scannable content
- Include explicit definitions of key concepts early in the article — AI search engines use these for featured citations
- Use direct answers to common questions formatted as standalone statements — AI models extract these for conversational responses
- Write comprehensive sections that can stand alone as citations — each H2 section should be independently valuable
- Include data, frameworks, and structured information (tables, lists, step-by-step) that AI models can parse and reproduce
- Use consistent terminology throughout — avoid using multiple terms for the same concept
- Address the topic at multiple depth levels: surface level for brief AI summaries, deep level for detailed AI citations
- Include "key takeaway" summaries for major sections — these become AI search engine snippets
- Write for both skimmers (AI-generated summaries) and deep readers (full article consumption)
- Avoid ambiguity — AI search engines penalize content that requires interpretation

## SEARCH INTENT
Identify the primary search intent before writing: Informational, Commercial Investigation, Transactional, Navigational, or Local.
Build the article entirely around satisfying that intent. Never mix unrelated intents.
Answer the primary question immediately in the first paragraph. Then answer secondary questions. Then answer questions the reader has not yet thought to ask.
The article should eliminate the need for another search — it must become the final destination.

## HUMAN WRITING STYLE
Write like a highly experienced human expert with natural rhythm and personality.
Vary sentence length dramatically. Mix short and long sentences. Use transitions that feel natural, not formulaic.
Create an engaging reading experience. The reader should never suspect AI involvement.
Write naturally. Readability and flow matter more than keyword placement.

## DEPTH & EEAT
Every article must demonstrate: Experience, Expertise, Authoritativeness, Trustworthiness.
Go beyond surface explanations. Explain why, how, when, advantages, disadvantages, limitations, edge cases, mistakes, best practices, and real-world applications.
Use evidence-based reasoning. State uncertainty when necessary.
If uncertain, state limitations instead of guessing. Accuracy is more important than confidence.

## SEMANTIC SEO
Cover the topic comprehensively. Include all major subtopics, entities, related concepts, and semantic relationships.
Use naturally occurring terminology. Do not force keywords.
Optimize for topical authority rather than keyword density.
Support featured snippets, People Also Ask, voice search, and passage ranking naturally.

## ARTICLE STRUCTURE
Generate in this order: SEO Title | Meta Title (max 60 chars) | Meta Description (max 150 chars) | URL Slug | Primary Keyword | Secondary Keywords | Entities | Article Outline
Then write the full article.
Structure: H1 > Introduction (immediately valuable) > H2 > H3 | Lists | Tables (when helpful) | Examples | Step-by-step guides | FAQs | Natural closing
No empty sections. No weak headings. No unnecessary headings.

## ARTICLE FORMAT
Start immediately with useful information — no padding, no warm-up.
Use logical H2 sections and H3 subsections only when necessary.
Use lists naturally. Use tables only if they improve understanding.
Use original examples, scenarios, and comparisons.
End naturally. Do not write "Conclusion" unless the topic genuinely calls for one.

## FAQ
Generate FAQs only if they genuinely satisfy search intent.
Do not add filler questions. Each answer must provide unique value the main content has not already covered.

## SELF-REVIEW PIPELINE — Execute before outputting
Step 1: Understand the topic completely. Determine intent, audience, expected expertise, and questions to answer.
Step 2: Create a complete outline with a unique structure. Check for logical flow. Remove duplicated sections. Merge weak ones.
Step 3: Ensure this article does not overlap with other articles you have written. Choose a unique perspective.
Step 4: Before each paragraph, verify it provides new information and answers a unique question.
Step 5: Before each heading, verify it is necessary and deserves its own section.
Step 6: Review the entire article for: repeated ideas, wording, transitions, examples, sentence structures, explanations, conclusions. Rewrite everything that feels repetitive.
Step 7: Review every paragraph independently. Delete paragraphs that do not significantly improve the article.
Step 8: Review as Google Search Quality Team. Evaluate: originality, helpfulness, depth, authority, accuracy, clarity, trustworthiness, user satisfaction, semantic coverage, topical authority.
Step 9: Review as GEO specialist. Evaluate: Can AI search engines easily cite this? Are definitions clear? Is each section independently useful? Is the structure AI-friendly? Is language unambiguous?
Step 10: Review as website owner. Would you proudly publish this under your own name? Would it outperform competitors? Would users bookmark and share it?
Step 11: Review as experienced editor. Improve: sentence rhythm, paragraph flow, natural language, transitions, readability, formatting, examples, storytelling, clarity. Remove robotic language completely.
Step 12: Review SEO + GEO. Natural keyword usage, semantic coverage, entity optimization, clear hierarchy, logical heading structure, strong internal linking, AI-citability, unambiguous language, structured data readiness.
Step 13: Review facts. Never invent statistics, studies, quotes, research, dates, percentages, case studies, organizations, awards, or sources. Never hallucinate.
Step 14: Final quality gate. Reject if it contains: duplicate ideas, thin content, weak explanations, generic advice, filler, keyword stuffing, AI clichés, robotic writing, unnecessary repetition, poor transitions, shallow coverage, incomplete answers. If any issue exists, rewrite until resolved.

## CLAIM VERIFICATION
Before outputting any factual claim: verify it against common knowledge. If uncertain, use hedging language ("typically", "often", "can"). Never fabricate studies, research papers, or expert quotes.

## INTERNAL LINKS
Identify natural anchor text opportunities. Suggest internal link locations. Never force links.

## FINAL REVIEW
Before returning, silently evaluate:
- Is this the best page on the internet for this topic?
- Will it remain evergreen for years?
- Would a reader bookmark this page?
- Would Google consider this genuinely helpful?
- Would ChatGPT/Perplexity/Gemini cite this as an authoritative source?
- Would this article deserve ranking in the top search results?
If any answer is "No", improve the article before returning it.

## OUTPUT FORMAT
Respond ONLY with this JSON structure (no markdown, no code fences, no extra text):
{
  "title": "Compelling, click-worthy SEO title with the primary keyword",
  "metaTitle": "SEO meta title — max 60 characters",
  "metaDescription": "SEO meta description — max 150 characters, compelling and includes primary keyword",
  "categories": ["Best matching existing category 1", "Optional category 2"],
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
            $topic,
            $today,
            $current_year,
            $categories_context,
            $graphify_context,
            $today,
            $current_year,
            $current_year
        );

        $result = self::openai_chat($system, 'Write a complete, authoritative article about: "' . $topic . '" for ' . $site_name . '. Follow all SEO content quality guidelines in the system prompt. Deliver the absolute best resource on this topic.');
        $data = $result['content'];

        if (empty($data['title']) || empty($data['content'])) {
            throw new \RuntimeException('OpenAI response missing required fields (title or content)');
        }

        $normalized_title = self::normalize_freshness(sanitize_text_field($data['title']), $current_year);
        $normalized_meta_title = self::normalize_freshness(sanitize_text_field($data['metaTitle'] ?? $data['title']), $current_year);
        $normalized_meta_description = self::normalize_freshness(sanitize_textarea_field($data['metaDescription'] ?? ''), $current_year);
        $slug = $data['slug'] ?? sanitize_title($normalized_title);
        $slug = sanitize_title(self::normalize_freshness($slug, $current_year));
        $word_count = str_word_count(wp_strip_all_tags($data['content']));
        $selected_categories = self::infer_categories($topic, $available_categories, (array) ($data['categories'] ?? []));

        Logger::info('Article generated via AI', [
            'topic'   => $topic,
            'title'   => $normalized_title,
            'words'   => $word_count,
            'tokens'  => $result['tokens_in'] . '→' . $result['tokens_out'],
        ]);

        return [
            'title'             => $normalized_title,
            'content_html'      => wp_kses_post($data['content']),
            'slug'              => sanitize_title($slug),
            'meta_title'        => mb_substr($normalized_meta_title, 0, 60),
            'meta_description'  => mb_substr($normalized_meta_description, 0, 160),
            'categories'        => $selected_categories,
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
        $status = $options['status'] ?? 'publish';
        $auto_publish = $options['auto_publish'] ?? ($settings['auto_publish'] ?? 'yes') === 'yes';
        $post_id = 0;

        try {
            // Stage: scoring
            Logger::info('Pipeline stage: scoring', ['topic' => $article['focus_keyword'] ?? '']);
            $quality = QualityScorer::score_article($article);

            // Stage: publishing (creating WP post)
            Logger::info('Pipeline stage: publishing', [
                'topic' => $article['focus_keyword'] ?? '',
                'score' => $quality['score'],
            ]);
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
            self::set_pipeline_stage($post_id, 'publishing');
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

            self::set_pipeline_stage($post_id, 'completed');

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
        } catch (\Throwable $e) {
            if ($post_id) {
                self::set_pipeline_stage($post_id, 'failed', $e->getMessage());
            }
            Logger::error('Article publishing failed', [
                'topic' => $article['focus_keyword'] ?? '',
                'error' => $e->getMessage(),
            ]);
            return ['success' => false, 'message' => $e->getMessage()];
        }
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
        if (($settings['enable_auto_generation'] ?? 'yes') !== 'yes') {
            Logger::debug('Auto-generate skipped: auto-generation disabled in settings');
            // Unscheduled stale cron if disabled
            Scheduler::clear_auto_generation();
            return;
        }

        $daily_max = (int) ($settings['max_articles_daily'] ?? 24);
        $publish_status = ($settings['generate_as_draft'] ?? 'no') === 'yes' ? 'draft' : 'publish';

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
            if (empty($topics)) {
                Logger::warning('Auto-generate skipped: no topics discovered', [
                    'batch' => $batch,
                    'daily_limit' => $daily_max,
                    'today_count' => $today_count,
                ]);
                return;
            }
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
