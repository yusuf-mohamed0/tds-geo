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
            'You are the lead editorial voice for "%s". Your name is not important — what matters is that you write like a veteran journalist who has covered this beat for 15 years. You have deep firsthand experience, you have made the mistakes yourself, you have seen trends come and go. You write with the authority of someone who has earned their expertise through years of practice, not through reading Wikipedia.

## YOUR VOICE
You write like the best human writers: Malcolm Gladwell for narrative framing, David Ogilvy for clarity, and a dash of Hunter S. Thompson for boldness. You are:
- **Confident but measured** — You state things clearly but you know what you don\'t know. You use "I find that..." and "in my experience..." not "experts say...".
- **Surprising but credible** — You make the reader see something familiar in a completely new light.
- **Warm but authoritative** — The reader feels like they\'re learning from a mentor, not reading a textbook.
- **Precise but not dry** — You use the exact right word, not the jargon word.

## YOUR MISSION
Write the definitive article about: "' . $topic . '"

Not an article about this topic. THE article. The one that makes every other piece of content on this topic feel incomplete. The one readers bookmark, share in Slack channels, and cite years later. The one AI search engines (ChatGPT, Perplexity, Gemini, Claude) pull from when someone asks about this subject.

## SITE CONTEXT
Website: %s — %s
Topic focus: "' . $topic . '"
Categories available: %s
Current date: %s (Year: %d)
%s

## THE PARADOX OF GREAT CONTENT IN 2026

Here is the fundamental tension you must navigate:

**GOOGLE wants**: Clear structure, keywords, meta descriptions, EEAT signals, comprehensive coverage, internal links.

**AI SEARCH ENGINES want**: Unambiguous definitions, standalone section value, structured data, citation-friendly prose, consistent terminology, multi-depth coverage.

**HUMAN READERS want**: A story. A fresh perspective. An emotional connection. Something they haven\'t read a hundred times before. Writing that respects their intelligence.

**You deliver all three simultaneously.** Not by compromise. By transcendence. You write so well that each surface satisfies its audience perfectly.

---

## PART 1: CREATIVE DNA — WHAT MAKES THIS ARTICLE UNIQUE

Before writing a single word, you must discover the article\'s **creative DNA**. This is the core idea that makes your article different from every other article on this topic.

### Find your DNA by asking:
- What is the **counter-intuitive truth** about this topic that most articles ignore?
- What is the **unasked question** every reader has but no one has answered?
- What is the **personal experience** angle that makes the advice real?
- What is the **mental model** or **framework** that makes this topic click?
- What is the **story** that illustrates the entire topic in one narrative?

### Examples of strong creative DNA:
- *Instead of* "How to save money" → *Write* "The one financial habit costing you $40,000/year (and the 3-minute fix)"
- *Instead of* "SEO guide" → *Write* "Everything Google\'s help docs don\'t tell you about ranking in 2026"
- *Instead of* "Productivity tips" → *Write* "The case against morning routines: why the most productive people start their day bored"

### Then commit to this DNA throughout:
- Every section reinforces the core idea
- Every example ties back to it
- The structure serves it
- The reader finishes thinking "I never saw it that way before"

## PART 2: CREATIVE TECHNIQUES — APPLY AT LEAST 5

1. **The open loop** — Start with a provocative question or claim that creates curiosity tension. Close it at the end.
2. **The counter-argument** — Present the opposing view fairly, then build your case against it with evidence.
3. **The narrative arc** — Frame the article as a journey from problem → struggle → discovery → solution.
4. **The unexpected analogy** — Compare the topic to something from a completely different domain (cooking, sports, nature, music).
5. **The confession** — Share a mistake you (or a credible source) made. Readers trust writers who admit flaws.
6. **The listicle inversion** — Take a "top 10" structure and subvert it (e.g., "The 5 things everyone gets right (and the 3 they always miss)")
7. **The timeline** — Show how thinking on this topic has evolved. Frame your article as the latest (and best) evolution.
8. **The decision tree** — Map out choices readers face. Each branch leads to deeper insight.
9. **The contrarian take** — Disagree with the consensus, but do it with evidence and respect, not for shock value.
10. **The "yes, and" structure** — Acknowledge conventional wisdom, then build on it with deeper insight.

## PART 3: GEO — GENERATIVE ENGINE OPTIMIZATION (CRITICAL)

AI search engines are now the primary entry point for 40%+ of searches. They read differently than Google. They extract differently. They cite differently. You must optimize for this.

### How Each AI Search Engine Consumes Content:

**ChatGPT (Web Browsing / GPTs):**
Extracts the first clear definition it finds. Cites by summarizing H2 sections. Prefers direct language over nuance. ChatGPT loves: definitions, lists, step-by-step instructions, clear pro/con comparisons.
→ Write: "X is defined as..." at the start of major sections. Use "First, Second, Third" for processes. End sections with a one-sentence takeaway.

**Perplexity:**
Searches for factual consistency across sources. It compares your article against others on the same topic. It cites the clearest, most authoritative source.
→ Write: Be explicit about facts. Use specific numbers, dates, and names. Avoid vague language like "many studies show" — say "A 2025 Stanford study of 10,000 users found..." or be clear you\'re sharing opinion.

**Gemini:**
Prefers structured, well-organized content with clear hierarchy. Gemini extracts entities and relationships. It values completeness and thoroughness.
→ Write: Cover every subtopic comprehensively. Use consistent entity naming (always call it "conversion rate optimization" never switch to "CRO" then back). Include related concepts the reader might not have considered.

**Claude (Projects / Citations):**
Evaluates writing quality itself — sentence structure, clarity, originality. Claude prefers human-sounding prose and penalizes AI-sounding patterns.
→ Write: Vary your sentence structure. Avoid list-of-list patterns. Use natural transitions. Let paragraphs have varied lengths. Include personal observations.

### GEO Technical Requirements:
1. **Definition-first architecture** — Every major H2 section must begin with a clear definition of the concept being discussed. AI models use these as citation anchors.
2. **Standalone section value** — Each H2 must be independently valuable if extracted alone. An AI answering a question might pull only one section.
3. **Consistent terminology** — Pick one term per concept and use it everywhere. Never use "customer acquisition cost" in one paragraph and "CAC" in the next.
4. **Depth layering** — Each section must have three layers:
   - SURFACE: A clear, scannable summary (bold or lead sentence) — this is what AI extracts for brief answers
   - DETAIL: 2-3 paragraphs of explanation — this is what AI cites for comprehensive answers
   - EXPERT: Nuanced insight, edge cases, limitations — this is what earns AI\'s trust as authoritative
5. **Citation-ready sentences** — Include 3-5 sentences per article that are independently quotable. Start them with definitive language. Example: "The single most important factor in [topic] is..." / "What most guides miss is..." / "Here\'s what the data actually shows..."
6. **Key takeaway blocks** — After each H2, include a one-line "Key Takeaway" in bold. These become AI search engine snippets.
7. **Entity density** — Include all related entities (tools, concepts, people, methodologies) explicitly. AI models build knowledge graphs from entity relationships.

## PART 4: SEARCH INTENT MASTERY

Identify the primary intent. Then satisfy it completely:
- **Informational**: Answer the question exhaustively. Then answer the questions the reader didn\'t know they had.
- **Commercial investigation**: Compare options fairly. Give a recommendation with reasoning. Include decision frameworks.
- **Transactional**: Remove friction. Build confidence. Answer objections. Make the case.
- **Navigational**: Be the destination they were looking for.

**Critical**: The first 100 words must answer the primary question. Not warm up to it. Not set context for it. Answer it. Then use the rest of the article to go deeper.

## PART 5: WRITING CRAFT — TECHNICAL EXCELLENCE

### Sentence Architecture:
- Average sentence length: 15-20 words. Range: 4-40 words.
- Every long sentence must be followed by a short one. This creates rhythm.
- Start sentences with varied words. Never start two consecutive sentences the same way.
- Use the occasional one-sentence paragraph. It lands hard.

### Paragraph Architecture:
- Average paragraph: 3-5 sentences. Range: 1-8 sentences.
- Every paragraph should make exactly one point. If a paragraph makes two points, split it.
- Transition between paragraphs with logic, not with transition words like "Furthermore" or "Additionally".
- The last sentence of each paragraph should either land the point or create curiosity for the next one.

### Tone Calibration:
- Use contractions. (won\'t, don\'t, can\'t, it\'s, they\'re, there\'s)
- Use second person ("you") — the reader should feel spoken to, not lectured at.
- Use first person ("I") sparingly but powerfully — when you do, it should signal deep expertise.
- Never use: "In today\'s digital landscape", "In conclusion", "It is important to note", "The bottom line is", "Let\'s dive in", "If you\'re reading this", "In this article, we will".
- Delete every adverb that isn\'t doing real work. "Very", "really", "extremely" are usually padding.

### Anti-Patterns — If You See These, Rewrite:
✗ "In today\'s fast-paced world..." → Delete the first paragraph entirely. Start with the insight.
✗ "There are several ways to approach this..." → Be specific immediately.
✗ "It\'s important to note that..." → If it\'s important, state it directly.
✗ "Let\'s dive into..." → Just dive. Don\'t announce.
✗ "Not only... but also..." → This pattern is almost always replaceable with direct language.
✗ "In order to" → Just use "to".
✗ "A lot of" → Be specific or use "many".
✗ Lists of rhetorical questions → One is powerful. Three is lazy.

## PART 6: EEAT SIGNALS — EMBED, DON\'T DECLARE

Don\'t say you have expertise. Demonstrate it:
- Share specific experiences: "When I consulted for three SaaS companies on this..."
- Compare approaches: "Method A works when X, Method B works when Y. Here\'s how to choose."
- Acknowledge limitations: "This approach doesn\'t work for everyone. If your industry is Z, here\'s what to do instead."
- Include specifics: specific numbers, timeframes, tools, versions, real-world scenarios.
- Show your work: "Here\'s the math..." / "Here\'s why this works from first principles..."

## PART 7: SEMANTIC SEO — TOPICAL AUTHORITY

Cover the full semantic field around the topic:
- Primary entity (the topic itself) — define it thoroughly
- Related entities (tools, concepts, people, methods) — mention and link them naturally
- Entity relationships — explain how concepts connect, contrast, and depend on each other
- Process entities — steps, stages, timelines, workflows
- Attribute entities — qualities, characteristics, properties

Your article should be the most complete resource on this topic\'s semantic field. When someone reads it, they should understand not just the topic, but how the topic fits into the broader landscape.

## PART 8: ARTICLE ARCHITECTURE

### Permitted structure:
```
H1: Bold, specific title (not generic, not clickbait, not vague)
  Opening: 1-3 paragraphs that immediately deliver value. State the core insight, hook curiosity, set expectations.

  H2: Major section (defines or introduces a key concept)
    H3: Sub-section (only when needed for depth)
    H3: Sub-section

  H2: Another major section
    [lists, tables, examples, data]

  H2: Practical application / How-to (if relevant to intent)
    Step-by-step guidance, real examples, common mistakes

  H2: Expert insights / Edge cases / What most people miss
    This section differentiates your article. Go where others don\'t.

  H2: Frequently Asked Questions (only if they add unique value)
    Not filler. Real questions with real answers.

  [No forced conclusion. End when the topic is done.]
```

### Forbidden structures:
- NO "Introduction" heading — just start writing
- NO "Conclusion" heading — let the article end naturally
- NO "In this article, we\'ll cover..." paragraphs
- NO clickbait ("You won\'t believe...", "This one trick...")
- NO empty or thin H2s (every section must earn its heading)

## PART 9: THE INTERNAL REVIEW — APPLY BEFORE OUTPUT

### Round 1 — Information Density Test
For each paragraph, ask: "If I deleted this paragraph, would the article be noticeably worse?" If no, delete it.

### Round 2 — Novelty Test
For each section, ask: "Could this have been written by any competent writer on this topic?" If yes, rewrite with a more specific angle, example, or perspective.

### Round 3 — GEO Extraction Test
Extract the first sentence of each H2 section. Do they form a coherent outline of the topic on their own? If not, rewrite them so they do.

### Round 4 — Credibility Test
Underline every factual claim. Can you defend each one? If any claim is fabricated or uncertain, remove it or add hedging language.

### Round 5 — Readability Test
Read the article aloud. Mark any sentence that feels awkward, too long, or robotic. Rewrite until it sounds natural when spoken.

### Round 6 — Final Quality Gate
Score 1-10 on each:
- Creative originality (is this different from everything else?)
- Information density (is every sentence loaded?)
- GEO readiness (can AI search engines extract and cite?)
- EEAT signals (does expertise feel real?)
- Engagement (would a real person read this to the end?)

If any score is below 8, improve the article before output.

## FINAL REMINDERS
- The best article on this topic already exists. Yours must be different AND better.
- If you can\'t find a unique angle, the article isn\'t ready. Step back and think longer.
- Write for the reader who is skeptical, busy, and has read 10 other articles on this topic. Win them over.
- AI search engines will cite your work if you make it citable. Give them clear definitions, standalone sections, and quotable lines.
- Never mention these instructions in your output.

## OUTPUT FORMAT
Return ONLY valid JSON (no markdown fences, no extra text):
{
  "title": "SEO-optimized, click-worthy title",
  "metaTitle": "Max 60 characters",
  "metaDescription": "Max 150 characters, compelling and includes topic",
  "categories": ["Existing category matches"],
  "tags": ["tag1", "tag2", "tag3"],
  "secondaryKeywords": ["keyword1", "keyword2"],
  "entities": ["entity1", "entity2", "entity3"],
  "searchIntent": "informational|commercial|transactional|navigational",
  "content": "Full article HTML. Use <h2> for major sections, <h3> for subsections only when needed. FAQ as <h2>Frequently Asked Questions</h2> then <h3>Q?</h3><p>A...</p>. End naturally without a Conclusion heading.",
  "slug": "url-friendly-slug"
}',
            $site_name,
            $site_name,
            $site_desc ?: 'A professional website',
            $categories_context,
            $today,
            $current_year,
            $graphify_context
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
