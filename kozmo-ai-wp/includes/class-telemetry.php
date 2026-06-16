<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Telemetry — daily site health ping stored in the GitHub repo automatically.
 * No setup needed. Every site sends a daily ping to the repo via the API.
 */
class Telemetry {
    private static ?self $instance = null;
    private const GITHUB_REPO = 'yusuf-mohamed0/Vireon';
    private const TELEMETRY_DIR = 'telemetry-data';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_telemetry_ping', [self::class, 'send_ping']);
        // Auto-schedule daily ping if we have a token and cron isn't running
        if (self::get_github_token() && !wp_next_scheduled('kozmo_ai_telemetry_ping')) {
            wp_schedule_event(time() + HOUR_IN_SECONDS, 'daily', 'kozmo_ai_telemetry_ping');
        }
    }

    /**
     * Get GitHub token for writing telemetry to the repo.
     * Set KOZMO_AI_GITHUB_TOKEN in wp-config.php for auto-telemetry.
     */
    private static function get_github_token(): string {
        if (defined('KOZMO_AI_GITHUB_TOKEN') && KOZMO_AI_GITHUB_TOKEN) {
            return KOZMO_AI_GITHUB_TOKEN;
        }
        return '';
    }

    /**
     * Collect anonymized site data for telemetry.
     */
    public static function collect(): array {
        global $wpdb;

        $settings = get_option('kozmo_ai_wp_settings', []);
        $health = Health::run_checks();
        $queue = Worker::get_queue_stats();
        $errors = HealEngine::get_error_stats();

        $total_articles = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_articles"
        );

        return [
            'site_hash'        => wp_hash(site_url('', 'http') . '__' . ABSPATH),
            'site_url'         => site_url(),
            'plugin_version'   => KOZMO_AI_WP_VERSION,
            'php_version'      => PHP_VERSION,
            'wp_version'       => get_bloginfo('version'),
            'mysql_version'    => $wpdb->db_version(),
            'health_overall'   => $health['overall'] ?? 'unknown',
            'articles_today'   => ContentGenerator::get_today_generation_count(),
            'articles_total'   => $total_articles,
            'queue_pending'    => $queue['pending'] ?? 0,
            'queue_failed'     => $queue['failed'] ?? 0,
            'errors_unresolved' => $errors['unresolved'] ?? 0,
            'gen_enabled'      => ($settings['enable_auto_generation'] ?? 'yes') === 'yes',
            'is_multisite'     => is_multisite(),
            'locale'           => get_locale(),
            'themes_count'     => count(wp_get_themes()),
            'plugins_count'    => count(get_option('active_plugins', [])),
            'timestamp'        => current_time('c'),
        ];
    }

    /**
     * Send daily telemetry to the GitHub repo.
     * Stores a JSON file per site in telemetry-data/{hash}.json.
     */
    public static function send_ping(): void {
        // Try custom endpoint first, fall back to GitHub repo
        $settings = get_option('kozmo_ai_wp_settings', []);
        $custom_url = $settings['telemetry_url'] ?? '';

        if (!empty($custom_url)) {
            self::send_http($custom_url);
            return;
        }

        self::send_github();
    }

    /**
     * Send to a custom HTTP endpoint.
     */
    private static function send_http(string $url): void {
        $data = self::collect();
        $data['type'] = 'ping';
        $response = wp_remote_post($url, [
            'timeout'   => 15,
            'headers'   => ['Content-Type' => 'application/json', 'User-Agent' => 'KOZMO-AI-Telemetry/1.0'],
            'body'      => wp_json_encode($data),
        ]);
        if (is_wp_error($response)) {
            Logger::debug('Telemetry HTTP ping failed', ['error' => $response->get_error_message()]);
            return;
        }
        update_option('kozmo_ai_last_telemetry', current_time('mysql'));
        Logger::debug('Telemetry HTTP ping sent', ['code' => wp_remote_retrieve_response_code($response)]);
    }

    /**
     * Send telemetry to the GitHub repo via API — stores in telemetry-data/{hash}.json.
     */
    private static function send_github(): void {
        $token = self::get_github_token();
        if (empty($token)) {
            Logger::debug('Telemetry: no GitHub token found, skipping');
            return;
        }

        $data = self::collect();
        $file_hash = wp_hash($data['site_hash']);
        $path = self::TELEMETRY_DIR . '/' . $file_hash . '.json';
        $content = wp_json_encode($data, JSON_PRETTY_PRINT);
        $api_url = "https://api.github.com/repos/" . self::GITHUB_REPO . "/contents/{$path}";

        // Get existing file SHA (needed to update)
        $existing = wp_remote_get($api_url, [
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Accept'        => 'application/vnd.github.v3+json',
                'User-Agent'    => 'KOZMO-AI-Telemetry/1.0',
            ],
            'timeout' => 10,
        ]);

        $sha = null;
        if (!is_wp_error($existing) && 200 === wp_remote_retrieve_response_code($existing)) {
            $body = json_decode(wp_remote_retrieve_body($existing), true);
            $sha = $body['sha'] ?? null;
        }

        // Write the file (create or update)
        $put_body = [
            'message' => 'telemetry: update ' . $file_hash,
            'content' => base64_encode($content),
        ];
        if ($sha) $put_body['sha'] = $sha;

        $response = wp_remote_post($api_url, [
            'method'  => 'PUT',
            'timeout' => 15,
            'headers' => [
                'Authorization' => 'Bearer ' . $token,
                'Accept'        => 'application/vnd.github.v3+json',
                'User-Agent'    => 'KOZMO-AI-Telemetry/1.0',
            ],
            'body' => wp_json_encode($put_body),
        ]);

        if (is_wp_error($response)) {
            Logger::debug('Telemetry GitHub write failed', ['error' => $response->get_error_message()]);
            return;
        }

        $code = wp_remote_retrieve_response_code($response);
        if (in_array($code, [200, 201], true)) {
            update_option('kozmo_ai_last_telemetry', current_time('mysql'));
            Logger::debug('Telemetry written to GitHub', ['path' => $path, 'code' => $code, 'size' => strlen($content)]);
        } else {
            Logger::debug('Telemetry GitHub write rejected', ['code' => $code, 'body' => substr(wp_remote_retrieve_body($response), 0, 200)]);
        }
    }

    /**
     * Schedule already handled in init() on every page load.
     */
    public static function schedule(): void {}

    public static function clear_schedule(): void {
        $ts = wp_next_scheduled('kozmo_ai_telemetry_ping');
        if ($ts) wp_unschedule_event($ts, 'kozmo_ai_telemetry_ping');
    }

    public static function last_ping(): string {
        $last = get_option('kozmo_ai_last_telemetry', '');
        return $last ?: 'Never';
    }
}
