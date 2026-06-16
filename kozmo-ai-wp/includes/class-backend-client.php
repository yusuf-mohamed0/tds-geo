<?php
namespace KozmoAI_WP;

defined('ABSPATH') || exit;

class BackendClient {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    private static function get_url(): string {
        return get_option('kozmo_ai_wp_settings', [])['backend_url'] ?? '';
    }

    public static function is_configured(): bool {
        $url = self::get_url();
        return !empty($url) && filter_var($url, FILTER_VALIDATE_URL) !== false;
    }

    public static function is_available(): bool {
        if (!self::is_configured()) return false;

        $cached = get_transient('kozmo_ai_backend_available');
        if (false !== $cached) return (bool) $cached;

        $available = false;
        try {
            $url = rtrim(self::get_url(), '/') . '/api/health';
            $response = wp_remote_get($url, [
                'timeout'  => 5,
                'headers'  => ['Accept' => 'application/json'],
            ]);
            if (!is_wp_error($response) && wp_remote_retrieve_response_code($response) === 200) {
                $body = json_decode(wp_remote_retrieve_body($response), true);
                $available = !empty($body['status']) && $body['status'] === 'ok';
            }
        } catch (\Throwable $e) {
            $available = false;
        }

        set_transient('kozmo_ai_backend_available', $available ? '1' : '0', 300);
        return $available;
    }

    public static function check_health(): array {
        $checks = [];

        $checks['configured'] = ['status' => self::is_configured() ? 'healthy' : 'disabled'];

        if (self::is_configured()) {
            $checks['reachable'] = ['status' => self::is_available() ? 'healthy' : 'error'];
        } else {
            $checks['reachable'] = ['status' => 'disabled'];
        }

        $overall = 'disabled';
        foreach ($checks as $c) {
            if ($c['status'] === 'error') { $overall = 'error'; break; }
            if ($c['status'] === 'healthy') $overall = 'healthy';
        }

        return ['overall' => $overall, 'checks' => $checks];
    }

    public static function generate_article(string $topic): ?array {
        if (!self::is_available()) return null;

        try {
            $url = rtrim(self::get_url(), '/') . '/api/articles/generate';
            $response = wp_remote_post($url, [
                'timeout'  => 120,
                'headers'  => [
                    'Content-Type' => 'application/json',
                    'Accept'       => 'application/json',
                ],
                'body' => wp_json_encode([
                    'topic'  => $topic,
                    'source' => 'wordpress',
                ]),
            ]);

            if (is_wp_error($response)) {
                Logger::warning('Backend article generation failed', ['topic' => $topic, 'error' => $response->get_error_message()]);
                return null;
            }

            $status = wp_remote_retrieve_response_code($response);
            $body   = json_decode(wp_remote_retrieve_body($response), true);

            if ($status !== 200 && $status !== 201) {
                $msg = $body['message'] ?? "Backend returned HTTP {$status}";
                Logger::warning('Backend article generation failed', ['topic' => $topic, 'error' => $msg]);
                return null;
            }

            $data = $body['data'] ?? $body;
            if (empty($data['title']) || empty($data['content'])) {
                Logger::warning('Backend returned incomplete article', ['topic' => $topic]);
                return null;
            }

            Logger::info('Article generated via backend', [
                'topic' => $topic,
                'title' => $data['title'],
            ]);

            return [
                'title'             => sanitize_text_field($data['title']),
                'content_html'      => wp_kses_post($data['content'] ?? $data['content_html'] ?? ''),
                'slug'              => sanitize_title($data['slug'] ?? sanitize_title($data['title'])),
                'meta_title'        => mb_substr(sanitize_text_field($data['metaTitle'] ?? $data['meta_title'] ?? $data['title']), 0, 60),
                'meta_description'  => mb_substr(sanitize_textarea_field($data['metaDescription'] ?? $data['meta_description'] ?? ''), 0, 160),
                'categories'        => array_map('sanitize_text_field', (array) ($data['categories'] ?? [])),
                'tags'              => array_map('sanitize_text_field', (array) ($data['tags'] ?? [$topic])),
                'focus_keyword'     => sanitize_text_field($topic),
                'agent_article_id'  => 'backend_' . bin2hex(kozmo_ai_wp_random_bytes(12)),
            ];
        } catch (\Throwable $e) {
            Logger::warning('Backend article generation threw exception', ['topic' => $topic, 'error' => $e->getMessage()]);
            return null;
        }
    }

    public static function discover_topics(int $count = 5): ?array {
        if (!self::is_available()) return null;

        try {
            $url = rtrim(self::get_url(), '/') . '/api/articles/suggest-topics';
            $response = wp_remote_post($url, [
                'timeout'  => 30,
                'headers'  => [
                    'Content-Type' => 'application/json',
                    'Accept'       => 'application/json',
                ],
                'body' => wp_json_encode(['count' => $count, 'source' => 'wordpress']),
            ]);

            if (is_wp_error($response)) return null;

            $status = wp_remote_retrieve_response_code($response);
            if ($status !== 200) return null;

            $body = json_decode(wp_remote_retrieve_body($response), true);
            $topics = $body['topics'] ?? $body['data']['topics'] ?? [];

            if (empty($topics) || !is_array($topics)) return null;

            return array_map('sanitize_text_field', array_slice($topics, 0, $count));
        } catch (\Throwable $e) {
            return null;
        }
    }
}
