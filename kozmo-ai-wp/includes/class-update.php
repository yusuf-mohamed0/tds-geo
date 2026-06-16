<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Update system — auto-updates from GitHub releases, plus DB upgrade.
 */
class Update {
    private static ?self $instance = null;
    private const GITHUB_REPO = 'yusuf-mohamed0/Vireon';
    private const CACHE_KEY = 'kozmo_ai_github_update';
    private const CACHE_TTL = 7200; // 2 hours

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('plugins_loaded', [self::class, 'maybe_upgrade'], 5);
        add_filter('plugins_api', [self::class, 'plugin_info'], 20, 3);
        add_filter('site_transient_update_plugins', [self::class, 'check_update']);
    }

    public static function maybe_upgrade(): void {
        $stored_db_version = (string) get_option('kozmo_ai_wp_db_version', '');
        $stored_plugin_version = (string) get_option('kozmo_ai_wp_plugin_version', '');

        if ($stored_db_version === KOZMO_AI_WP_DB_VERSION && $stored_plugin_version === KOZMO_AI_WP_VERSION) {
            return;
        }

        Activator::upgrade();
    }

    /**
     * Fetch the latest release from GitHub API.
     */
    private static function fetch_latest_release(): ?array {
        $cached = get_transient(self::CACHE_KEY);
        if (false !== $cached && is_array($cached)) return $cached;

        $url = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';
        $response = wp_remote_get($url, [
            'timeout' => 10,
            'headers' => ['Accept' => 'application/vnd.github.v3+json', 'User-Agent' => 'KOZMO-AI-Plugin'],
        ]);

        if (is_wp_error($response) || 200 !== wp_remote_retrieve_response_code($response)) return null;

        $data = json_decode(wp_remote_retrieve_body($response), true);
        if (empty($data['tag_name'])) return null;

        $release = [
            'version'     => ltrim($data['tag_name'], 'v'),
            'tag_name'    => $data['tag_name'],
            'zip_url'     => $data['zipball_url'] ?? '',
            'changelog'   => $data['body'] ?? '',
            'published_at' => $data['published_at'] ?? '',
        ];

        // Find a ZIP asset if attached
        if (!empty($data['assets'])) {
            foreach ($data['assets'] as $asset) {
                if (str_ends_with($asset['name'] ?? '', '.zip')) {
                    $release['zip_url'] = $asset['browser_download_url'];
                    break;
                }
            }
        }

        set_transient(self::CACHE_KEY, $release, self::CACHE_TTL);
        return $release;
    }

    public static function plugin_info($res, $action, $args) {
        if ('plugin_information' !== $action) return $res;
        if ('kozmo-ai-wp' !== ($args->slug ?? '')) return $res;

        $release = self::fetch_latest_release();

        $res = new \stdClass();
        $res->name = 'KOZMO AI — Autonomous WP Agent';
        $res->slug = 'kozmo-ai-wp';
        $res->version = $release['version'] ?? KOZMO_AI_WP_VERSION;
        $res->author = '<a href="https://github.com/' . self::GITHUB_REPO . '">KOZMO AI</a>';
        $res->homepage = 'https://github.com/' . self::GITHUB_REPO;
        $res->requires = '5.8';
        $res->tested = '6.7';
        $res->requires_php = '7.4';
        $res->download_link = $release['zip_url'] ?? '';
        $res->last_updated = $release['published_at'] ?? gmdate('Y-m-d');
        $res->sections = [
            'description' => 'Autonomous AI agent for WordPress. Automatically understands, manages, optimizes, and grows your website with AI-powered SEO content automation. Auto-updates from GitHub.',
            'installation' => '1. Upload the plugin. 2. Activate. 3. Connect your OpenAI API key. 4. The AI agent takes over. Updates are delivered automatically from GitHub releases.',
            'changelog' => $release['changelog'] ?: 'See https://github.com/' . self::GITHUB_REPO . '/releases',
        ];
        $res->banners = [];
        $res->icons = [];

        return $res;
    }

    public static function check_update($transient) {
        if (empty($transient->checked)) return $transient;

        $plugin_slug = plugin_basename(KOZMO_AI_WP_FILE);
        $current_version = KOZMO_AI_WP_VERSION;

        $release = self::fetch_latest_release();
        if (null === $release) return $transient;

        $github_version = $release['version'] ?? '';
        if (empty($github_version)) return $transient;

        // Only offer update if GitHub version is strictly newer
        if (version_compare($github_version, $current_version, '<=')) return $transient;

        $update = new \stdClass();
        $update->slug = 'kozmo-ai-wp';
        $update->plugin = $plugin_slug;
        $update->new_version = $github_version;
        $update->url = 'https://github.com/' . self::GITHUB_REPO;
        $update->package = $release['zip_url'] ?: 'https://api.github.com/repos/' . self::GITHUB_REPO . '/zipball/' . $release['tag_name'];

        $transient->response[$plugin_slug] = $update;

        return $transient;
    }

    /**
     * Clear cached update check (call after pushing a new release).
     */
    public static function clear_cache(): void {
        delete_transient(self::CACHE_KEY);
    }
}
