<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class ContentResearch {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_research_keywords', [self::class, 'auto_research']);
    }

    public static function research_keywords(int $count = 10): array {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $site_name = get_bloginfo('name');
        $site_desc = get_bloginfo('description');
        $categories = get_categories(['hide_empty' => false, 'number' => 50]);
        $cat_names = [];
        foreach ($categories as $c) {
            if (!in_array(strtolower($c->name), ['uncategorized', 'uncategorised', 'blog', 'general'], true)) {
                $cat_names[] = $c->name;
            }
        }

        $cache_key = 'kozmo_ai_research_' . md5($site_name . implode(',', $cat_names));
        $cached = get_transient($cache_key);
        if ($cached) return $cached;

        try {
            $system = 'You are a senior content strategist and SEO researcher. Analyze this website and return keyword clusters with trends.';
            $user = sprintf(
                'Website: "%s"%s. Categories: %s. Research %d keyword clusters in this site\'s industry.
Each cluster must have: cluster_name, keywords (5-8 specific long-tail keywords), trend (up/stable/down), search_intent, avg_monthly (estimated relative volume 1-100).
Return JSON: {"clusters": [{"cluster_name": "...", "keywords": ["...", "..."], "trend": "up|stable|down", "search_intent": "informational|commercial|transactional", "avg_monthly": 1-100}]}
Focus on trends that will grow in the next 12 months. Include GEO-relevant topics that AI search engines (ChatGPT, Perplexity, Gemini) will prioritize.',
                $site_name,
                $site_desc ? ' — ' . $site_desc : '',
                implode(', ', $cat_names),
                $count
            );

            $result = self::openai_chat($system, $user);
            $clusters = $result['content']['clusters'] ?? [];

            if (!empty($clusters)) {
                set_transient($cache_key, $clusters, HOUR_IN_SECONDS * 6);
            }

            Logger::info('Keywords researched', ['count' => count($clusters)]);
            return $clusters;
        } catch (\Throwable $e) {
            Logger::warning('Keyword research failed', ['error' => $e->getMessage()]);
            return [];
        }
    }

    public static function research_content_gaps(): array {
        $site_name = get_bloginfo('name');
        $site_desc = get_bloginfo('description');

        $existing_posts = get_posts([
            'posts_per_page' => 50,
            'post_type' => 'post',
            'post_status' => 'publish',
            'fields' => 'ids',
        ]);
        $existing_titles = [];
        foreach ($existing_posts as $pid) {
            $existing_titles[] = get_the_title($pid);
        }

        $cache_key = 'kozmo_ai_gaps_' . md5($site_name);
        $cached = get_transient($cache_key);
        if ($cached) return $cached;

        try {
            $system = 'You are a content strategist identifying content gaps and opportunities.';
            $user = sprintf(
                'Website: "%s"%s. Already covered: %s.
Identify 5 content gaps — topics this site should cover but hasn\'t.
For each: gap, opportunity_score (1-10), urgency (high/medium/low), why_it_matters.
Return JSON: {"gaps": [{"gap": "...", "opportunity_score": 8, "urgency": "high|medium|low", "why_it_matters": "..."}]}',
                $site_name,
                $site_desc ? ' — ' . $site_desc : '',
                implode('; ', array_slice($existing_titles, 0, 30))
            );

            $result = self::openai_chat($system, $user);
            $gaps = $result['content']['gaps'] ?? [];

            if (!empty($gaps)) {
                set_transient($cache_key, $gaps, HOUR_IN_SECONDS * 12);
            }

            return $gaps;
        } catch (\Throwable $e) {
            Logger::warning('Content gap analysis failed', ['error' => $e->getMessage()]);
            return [];
        }
    }

    public static function auto_research(): void {
        $clusters = self::research_keywords(10);
        if (!empty($clusters)) {
            update_option('kozmo_ai_cached_keywords', $clusters);
        }
        $gaps = self::research_content_gaps();
        if (!empty($gaps)) {
            update_option('kozmo_ai_cached_gaps', $gaps);
        }
        Logger::info('Auto research complete', ['clusters' => count($clusters), 'gaps' => count($gaps)]);
    }

    private static function openai_chat(string $system, string $user): array {
        if (!ContentGenerator::is_configured()) {
            throw new \RuntimeException('OpenAI API key not configured.');
        }

        $settings = get_option('kozmo_ai_wp_settings', []);
        $model = $settings['openai_model'] ?? 'gpt-4o';
        $base_url = rtrim($settings['openai_base_url'] ?? '', '/') ?: 'https://api.openai.com';
        $api_url = $base_url . '/v1/chat/completions';

        $response = wp_remote_post($api_url, [
            'timeout'  => 60,
            'headers'  => [
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer ' . ContentGenerator::get_openai_key(),
            ],
            'body'     => wp_json_encode([
                'model'             => $model,
                'messages'          => [
                    ['role' => 'system', 'content' => $system],
                    ['role' => 'user',   'content' => $user],
                ],
                'max_tokens'        => 2048,
                'temperature'       => 0.7,
                'response_format'   => ['type' => 'json_object'],
            ]),
        ]);

        if (is_wp_error($response)) {
            throw new \RuntimeException('OpenAI request failed: ' . $response->get_error_message());
        }

        $status = wp_remote_retrieve_response_code($response);
        $body   = wp_remote_retrieve_body($response);

        if ($status !== 200) {
            $error = json_decode($body, true);
            throw new \RuntimeException('OpenAI error: ' . ($error['error']['message'] ?? "HTTP {$status}"));
        }

        $data = json_decode($body, true);
        $content = $data['choices'][0]['message']['content'] ?? '';
        if (empty($content)) throw new \RuntimeException('Empty response');
        return ['content' => json_decode($content, true)];
    }
}
