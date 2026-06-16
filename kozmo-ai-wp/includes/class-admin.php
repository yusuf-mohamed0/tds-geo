<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Admin — registers menu pages, enqueues assets, handles forms.
 */
class Admin {
    private static ?self $instance = null;
    private static string $hook = '';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_menu', [self::class, 'add_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_post_kozmo_ai_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_kozmo_ai_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('wp_ajax_kozmo_ai_dashboard_data', [Dashboard::class, 'ajax_data']);
        add_filter('plugin_action_links_' . KOZMO_AI_WP_BASENAME, [self::class, 'action_links']);
    }

    public static function add_menu(): void {
        self::$hook = add_menu_page(
            __('KOZMO AI', 'kozmo-ai-wp'),
            __('KOZMO AI', 'kozmo-ai-wp'),
            'manage_options',
            'kozmo-ai-wp',
            [Dashboard::class, 'render'],
            'dashicons-superhero',
            30
        );

        add_submenu_page('kozmo-ai-wp', __('Dashboard', 'kozmo-ai-wp'), __('Dashboard', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp', [Dashboard::class, 'render']);
        add_submenu_page('kozmo-ai-wp', __('Settings', 'kozmo-ai-wp'), __('Settings', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-settings', [self::class, 'render_settings']);
        add_submenu_page('kozmo-ai-wp', __('API Keys', 'kozmo-ai-wp'), __('API Keys', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-keys', [self::class, 'render_keys']);
        add_submenu_page('kozmo-ai-wp', __('Logs', 'kozmo-ai-wp'), __('Logs', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-logs', [self::class, 'render_logs']);
        add_submenu_page('kozmo-ai-wp', __('Diagnostics', 'kozmo-ai-wp'), __('Diagnostics', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-diagnostics', [self::class, 'render_diagnostics']);
    }

    public static function enqueue_assets(string $hook): void {
        if (strpos($hook, 'kozmo-ai-wp') === false) return;

        wp_enqueue_style('kozmo-ai-wp-admin', KOZMO_AI_WP_URL . 'assets/admin.css', [], KOZMO_AI_WP_VERSION);
        wp_enqueue_script('kozmo-ai-wp-admin', KOZMO_AI_WP_URL . 'assets/admin.js', ['jquery'], KOZMO_AI_WP_VERSION, true);
        wp_enqueue_script('kozmo-ai-wp-dashboard', KOZMO_AI_WP_URL . 'assets/dashboard.js', ['jquery'], KOZMO_AI_WP_VERSION, true);

        wp_localize_script('kozmo-ai-wp-dashboard', 'kozmoAI', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('kozmo_ai_wp_ajax'),
            'rest_url' => rest_url('kozmo-ai/v1/'),
            'version'  => KOZMO_AI_WP_VERSION,
        ]);
    }

    public static function action_links(array $links): array {
        $dash = sprintf('<a href="%s">%s</a>', admin_url('admin.php?page=kozmo-ai-wp'), __('Dashboard', 'kozmo-ai-wp'));
        $keys = sprintf('<a href="%s" style="font-weight:600;">%s</a>', admin_url('admin.php?page=kozmo-ai-wp-keys'), __('API Key', 'kozmo-ai-wp'));
        array_unshift($links, $keys, $dash);
        return $links;
    }

    // ── Settings Page ──
    public static function render_settings(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        ?>
        <div class="wrap kozmo-ai-wrap">
            <div class="kozmo-header"><h1><span class="kozmo-logo">K</span> <?php esc_html_e('KOZMO AI — Settings', 'kozmo-ai-wp'); ?></h1></div>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('kozmo_ai_save_settings', 'kozmo_ai_nonce'); ?>
                <input type="hidden" name="action" value="kozmo_ai_save_settings">

                <div class="kozmo-card"><h2><?php esc_html_e('Connection', 'kozmo-ai-wp'); ?></h2>
                    <table class="form-table">
                        <tr><th><?php esc_html_e('Agent URL', 'kozmo-ai-wp'); ?></th>
                            <td><input type="url" name="agent_url" value="<?php echo esc_attr($settings['agent_url'] ?? KOZMO_AI_WP_AGENT_URL); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('URL of the KOZMO AI agent API.', 'kozmo-ai-wp'); ?></p></td></tr>
                        <tr><th><?php esc_html_e('API Enabled', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="api_enabled" value="yes" <?php checked($settings['api_enabled'] ?? 'yes', 'yes'); ?> /> <?php esc_html_e('Enable REST API', 'kozmo-ai-wp'); ?></label></td></tr>
                        <tr><th><?php esc_html_e('Webhook Secret', 'kozmo-ai-wp'); ?></th>
                            <td><input type="text" name="webhook_secret" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Secret for webhook signature verification (min 16 chars).', 'kozmo-ai-wp'); ?></p></td></tr>
                    </table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('AI Content Generation', 'kozmo-ai-wp'); ?></h2>
                    <p class="description" style="margin-bottom:15px;"><?php esc_html_e('Connect OpenAI to automatically generate and publish SEO-optimized articles. No external backend needed.', 'kozmo-ai-wp'); ?></p>
                    <table class="form-table">
                        <tr><th><?php esc_html_e('OpenAI API Key', 'kozmo-ai-wp'); ?></th>
                            <td><input type="password" name="openai_api_key" value="<?php echo !empty($settings['openai_api_key']) ? '********' : ''; ?>" class="regular-text" placeholder="sk-..." />
                                <p class="description"><?php esc_html_e('Your OpenAI API key. Stored encrypted. Required for auto-generation.', 'kozmo-ai-wp'); ?></p></td></tr>
                        <tr><th><?php esc_html_e('OpenAI Model', 'kozmo-ai-wp'); ?></th>
                            <td><select name="openai_model">
                                <option value="gpt-4o" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4o'); ?>>GPT-4o (recommended)</option>
                                <option value="gpt-4o-mini" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4o-mini'); ?>>GPT-4o Mini (faster, cheaper)</option>
                                <option value="gpt-4-turbo" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4-turbo'); ?>>GPT-4 Turbo</option>
                            </select></td></tr>
                        <tr><th><?php esc_html_e('Enable Auto-Generation', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="enable_auto_generation" value="yes" <?php checked($settings['enable_auto_generation'] ?? 'yes', 'yes'); ?> /> <?php esc_html_e('Automatically discover topics and generate articles on a schedule', 'kozmo-ai-wp'); ?></label></td></tr>
                        <tr><th><?php esc_html_e('Generation Frequency', 'kozmo-ai-wp'); ?></th>
                            <td><select name="generation_frequency">
                                <option value="kozmo_ai_every_15min" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_every_15min'); ?>><?php esc_html_e('Every 15 minutes', 'kozmo-ai-wp'); ?></option>
                                <option value="kozmo_ai_hourly" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_hourly'); ?>><?php esc_html_e('Every hour', 'kozmo-ai-wp'); ?></option>
                                <option value="kozmo_ai_twice_daily" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_twice_daily'); ?>><?php esc_html_e('Twice daily', 'kozmo-ai-wp'); ?></option>
                                <option value="daily" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'daily'); ?>><?php esc_html_e('Once daily', 'kozmo-ai-wp'); ?></option>
                            </select></td></tr>
                        <tr><th><?php esc_html_e('Save as Draft', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="generate_as_draft" value="yes" <?php checked($settings['generate_as_draft'] ?? 'no', 'yes'); ?> /> <?php esc_html_e('Save generated articles as drafts (uncheck to publish immediately)', 'kozmo-ai-wp'); ?></label></td></tr>
                        <tr><th><?php esc_html_e('Max Articles/Day', 'kozmo-ai-wp'); ?></th>
                            <td><input type="number" name="max_articles_daily" value="<?php echo esc_attr($settings['max_articles_daily'] ?? 5); ?>" min="1" max="50" />
                                <p class="description"><?php esc_html_e('Maximum articles to generate per day.', 'kozmo-ai-wp'); ?></p></td></tr>
                        <tr><th><?php esc_html_e('Publish On Quality >=', 'kozmo-ai-wp'); ?></th>
                            <td><input type="number" name="min_quality_score" value="<?php echo esc_attr($settings['min_quality_score'] ?? 95); ?>" min="1" max="100" /> / 100</td></tr>
                        <tr><th><?php esc_html_e('Auto Publish', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="auto_publish" value="yes" <?php checked($settings['auto_publish'] ?? 'yes', 'yes'); ?> /> <?php esc_html_e('Auto-publish drafts when quality score >= minimum threshold', 'kozmo-ai-wp'); ?></label></td></tr>
                    </table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Automation', 'kozmo-ai-wp'); ?></h2>
                    <table class="form-table">
                        <tr><th><?php esc_html_e('Auto Fix Errors', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="auto_fix_errors" value="yes" <?php checked($settings['auto_fix_errors'] ?? 'yes', 'yes'); ?> /> <?php esc_html_e('Automatically attempt to repair errors', 'kozmo-ai-wp'); ?></label></td></tr>
                        <tr><th><?php esc_html_e('Auto Scan', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="auto_discover" value="yes" <?php checked($settings['auto_discover'] ?? 'yes', 'yes'); ?> /> <?php esc_html_e('Auto-discover site changes', 'kozmo-ai-wp'); ?></label></td></tr>
                    </table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Logging', 'kozmo-ai-wp'); ?></h2>
                    <table class="form-table">
                        <tr><th><?php esc_html_e('Log Level', 'kozmo-ai-wp'); ?></th>
                            <td><select name="log_level">
                                <option value="debug" <?php selected($settings['log_level'] ?? 'info', 'debug'); ?>>Debug</option>
                                <option value="info" <?php selected($settings['log_level'] ?? 'info', 'info'); ?>>Info</option>
                                <option value="warning" <?php selected($settings['log_level'] ?? 'info', 'warning'); ?>>Warning</option>
                                <option value="error" <?php selected($settings['log_level'] ?? 'info', 'error'); ?>>Error</option>
                            </select></td></tr>
                        <tr><th><?php esc_html_e('Debug Mode', 'kozmo-ai-wp'); ?></th>
                            <td><label><input type="checkbox" name="debug_mode" value="yes" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?> /> <?php esc_html_e('Verbose request/response logging', 'kozmo-ai-wp'); ?></label></td></tr>
                    </table></div>

                <?php submit_button(__('Save Settings', 'kozmo-ai-wp')); ?>
            </form>
        </div>
        <?php
    }

    public static function handle_save_settings(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_save_settings', 'kozmo_ai_nonce');

        $old_settings = get_option('kozmo_ai_wp_settings', []);

        // Handle OpenAI API key — encrypt inline to avoid double-save bug
        $openai_key_raw = sanitize_text_field(wp_unslash($_POST['openai_api_key'] ?? ''));
        $encrypted_openai_key = $old_settings['openai_api_key'] ?? '';
        if (!empty($openai_key_raw) && $openai_key_raw !== '********') {
            $key = defined('NONCE_KEY') ? NONCE_KEY : 'kozmo-ai-fallback';
            $iv = openssl_random_pseudo_bytes(16);
            $encrypted = openssl_encrypt($openai_key_raw, 'aes-256-cbc', $key, 0, $iv);
            if (false !== $encrypted) {
                $encrypted_openai_key = base64_encode($iv . $encrypted);
            }
        }

        $settings = [
            'agent_url'              => esc_url_raw(wp_unslash($_POST['agent_url'] ?? KOZMO_AI_WP_AGENT_URL)),
            'api_enabled'            => sanitize_text_field(wp_unslash($_POST['api_enabled'] ?? 'no')),
            'webhook_secret'         => sanitize_text_field(wp_unslash($_POST['webhook_secret'] ?? '')),
            'log_level'              => sanitize_text_field(wp_unslash($_POST['log_level'] ?? 'info')),
            'auto_publish'           => sanitize_text_field(wp_unslash($_POST['auto_publish'] ?? 'no')),
            'auto_discover'          => sanitize_text_field(wp_unslash($_POST['auto_discover'] ?? 'no')),
            'auto_fix_errors'        => sanitize_text_field(wp_unslash($_POST['auto_fix_errors'] ?? 'no')),
            'min_quality_score'      => absint(wp_unslash($_POST['min_quality_score'] ?? 95)),
            'max_articles_daily'     => absint(wp_unslash($_POST['max_articles_daily'] ?? 5)),
            'debug_mode'             => sanitize_text_field(wp_unslash($_POST['debug_mode'] ?? 'no')),
            'enable_webhooks'        => 'yes',
            'enable_auto_generation' => sanitize_text_field(wp_unslash($_POST['enable_auto_generation'] ?? 'no')),
            'generation_frequency'   => sanitize_text_field(wp_unslash($_POST['generation_frequency'] ?? 'kozmo_ai_every_15min')),
            'openai_model'           => sanitize_text_field(wp_unslash($_POST['openai_model'] ?? 'gpt-4o')),
            'generate_as_draft'      => sanitize_text_field(wp_unslash($_POST['generate_as_draft'] ?? 'no')),
            'openai_api_key'         => $encrypted_openai_key,
            'cron_interval'          => $old_settings['cron_interval'] ?? 'kozmo_ai_every_15min',
            'last_scan_at'           => $old_settings['last_scan_at'] ?? '',
            'last_sync_at'           => current_time('mysql'),
        ];

        if (($settings['enable_auto_generation'] ?? 'no') !== 'yes') {
            Scheduler::clear_auto_generation();
        } else {
            Scheduler::schedule_auto_generation($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', true);
        }

        if (!empty($settings['webhook_secret']) && strlen($settings['webhook_secret']) < 16) {
            $existing = get_option('kozmo_ai_wp_settings', []);
            $settings['webhook_secret'] = $existing['webhook_secret'] ?? '';
        }

        update_option('kozmo_ai_wp_settings', $settings);
        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
        exit;
    }

    // ── API Keys Page ──
    public static function render_keys(): void {
        $keys = Auth::list_keys();
        ?>
        <div class="wrap kozmo-ai-wrap">
            <div class="kozmo-header"><h1><span class="kozmo-logo">K</span> <?php esc_html_e('KOZMO AI — API Keys', 'kozmo-ai-wp'); ?></h1></div>

            <div class="kozmo-card"><h2><?php esc_html_e('Generate New Key', 'kozmo-ai-wp'); ?></h2>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="kozmo-flex">
                    <?php wp_nonce_field('kozmo_ai_generate_key', 'kozmo_ai_nonce'); ?>
                    <input type="hidden" name="action" value="kozmo_ai_generate_key">
                    <div><label><?php esc_html_e('Label', 'kozmo-ai-wp'); ?><br><input type="text" name="label" placeholder="e.g., Agent Production" /></label></div>
                    <div><label><?php esc_html_e('Permissions', 'kozmo-ai-wp'); ?><br>
                        <select name="permissions">
                            <option value="read,write"><?php esc_html_e('Read & Write', 'kozmo-ai-wp'); ?></option>
                            <option value="read"><?php esc_html_e('Read Only', 'kozmo-ai-wp'); ?></option>
                            <option value="write"><?php esc_html_e('Write Only', 'kozmo-ai-wp'); ?></option>
                        </select></label></div>
                    <div><label><?php esc_html_e('Expires', 'kozmo-ai-wp'); ?><br>
                        <select name="expires_in">
                            <option value="0"><?php esc_html_e('Never', 'kozmo-ai-wp'); ?></option>
                            <option value="30">30 <?php esc_html_e('days', 'kozmo-ai-wp'); ?></option>
                            <option value="90">90 <?php esc_html_e('days', 'kozmo-ai-wp'); ?></option>
                            <option value="365">1 <?php esc_html_e('year', 'kozmo-ai-wp'); ?></option>
                        </select></label></div>
                    <div><br><?php submit_button(__('Generate Key', 'kozmo-ai-wp'), 'primary', '', false); ?></div>
                </form>
                <?php if (isset($_GET['new_key'])): ?>
                    <div class="kozmo-notice kozmo-notice-success">
                        <p><strong><?php esc_html_e('New Key Generated!', 'kozmo-ai-wp'); ?></strong></p>
                        <code style="font-size:14px;padding:8px;display:inline-block;background:#f0f0f1;border-radius:4px;"><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['new_key']))); ?></code>
                        <p><em><?php esc_html_e('Copy this now — it won\'t be shown again.', 'kozmo-ai-wp'); ?></em></p>
                    </div>
                <?php endif; ?>
            </div>

            <div class="kozmo-card"><h2><?php esc_html_e('Existing Keys', 'kozmo-ai-wp'); ?></h2>
                <?php if (empty($keys)): ?><p><?php esc_html_e('No keys generated yet.', 'kozmo-ai-wp'); ?></p>
                <?php else: ?>
                <table class="widefat striped">
                    <thead><tr><th><?php esc_html_e('Label', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Key', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Permissions', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Status', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Actions', 'kozmo-ai-wp'); ?></th></tr></thead>
                    <tbody><?php foreach ($keys as $key): ?><tr>
                        <td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                        <td><code><?php echo esc_html($key['masked_key'] ?? __('Stored securely', 'kozmo-ai-wp')); ?></code></td>
                        <td><?php echo esc_html($key['permissions']); ?></td>
                        <td><span class="kozmo-badge <?php echo $key['is_active'] ? 'badge-active' : 'badge-inactive'; ?>"><?php echo $key['is_active'] ? __('Active', 'kozmo-ai-wp') : __('Revoked', 'kozmo-ai-wp'); ?></span></td>
                        <td><?php if ($key['is_active']): ?>
                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                <?php wp_nonce_field('kozmo_ai_revoke_key', 'kozmo_ai_nonce'); ?>
                                <input type="hidden" name="action" value="kozmo_ai_revoke_key" />
                                <input type="hidden" name="key_id" value="<?php echo esc_attr($key['id']); ?>" />
                                <button class="button button-small" onclick="return confirm('<?php esc_attr_e('Revoke this key?', 'kozmo-ai-wp'); ?>');"><?php esc_html_e('Revoke', 'kozmo-ai-wp'); ?></button>
                            </form>
                        <?php endif; ?></td>
                    </tr><?php endforeach; ?></tbody>
                </table><?php endif; ?>
            </div>
        </div>
        <?php
    }

    // ── Logs Page ──
    public static function render_logs(): void {
        $level = isset($_GET['level']) ? sanitize_text_field(wp_unslash($_GET['level'])) : '';
        $service = isset($_GET['service']) ? sanitize_text_field(wp_unslash($_GET['service'])) : '';
        $logs = Logger::get_logs(200, $level, $service);
        $stats = Logger::get_stats();
        ?>
        <div class="wrap kozmo-ai-wrap">
            <div class="kozmo-header"><h1><span class="kozmo-logo">K</span> <?php esc_html_e('KOZMO AI — Logs', 'kozmo-ai-wp'); ?></h1></div>
            <div class="kozmo-card">
                <div class="kozmo-flex" style="align-items:center;gap:8px;">
                    <span class="kozmo-badge badge-<?php echo $stats['error'] > 0 ? 'error' : 'active'; ?>"><?php echo (int) $stats['error']; ?> errors</span>
                    <span class="kozmo-badge badge-warning"><?php echo (int) $stats['warning']; ?> warnings</span>
                    <span class="kozmo-badge badge-info"><?php echo (int) $stats['info']; ?> info</span>
                    <span style="flex:1"></span>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="button button-small"><?php esc_html_e('All', 'kozmo-ai-wp'); ?></a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs&level=error')); ?>" class="button button-small"><?php esc_html_e('Errors', 'kozmo-ai-wp'); ?></a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs&level=warning')); ?>" class="button button-small"><?php esc_html_e('Warnings', 'kozmo-ai-wp'); ?></a>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('kozmo_ai_clear_logs', 'kozmo_ai_nonce'); ?>
                        <input type="hidden" name="action" value="kozmo_ai_clear_logs" />
                        <button class="button button-small" onclick="return confirm('<?php esc_attr_e('Clear all logs?', 'kozmo-ai-wp'); ?>');"><?php esc_html_e('Clear', 'kozmo-ai-wp'); ?></button>
                    </form>
                </div>
            </div>
            <?php if (empty($logs)): ?><div class="kozmo-card"><p><?php esc_html_e('No log entries.', 'kozmo-ai-wp'); ?></p></div>
            <?php else: ?>
            <div class="kozmo-table-wrap">
                <table class="widefat striped"><thead><tr><th style="width:80px;"><?php esc_html_e('Level', 'kozmo-ai-wp'); ?></th><th style="width:100px;"><?php esc_html_e('Service', 'kozmo-ai-wp'); ?></th><th><?php esc_html_e('Message', 'kozmo-ai-wp'); ?></th><th style="width:180px;"><?php esc_html_e('Time', 'kozmo-ai-wp'); ?></th></tr></thead>
                <tbody><?php foreach ($logs as $log): ?><tr class="kozmo-log-row log-<?php echo esc_attr($log['level']); ?>">
                    <td><span class="kozmo-badge badge-<?php echo esc_attr($log['level']); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                    <td><?php echo esc_html($log['service'] ?? 'core'); ?></td>
                    <td><?php echo esc_html($log['message']); ?>
                        <?php if (!empty($log['context'])): ?>
                        <button class="button button-small toggle-context" onclick="var e=this.nextElementSibling;e.style.display=e.style.display==='none'?'block':'none';"><?php esc_html_e('Show', 'kozmo-ai-wp'); ?></button>
                        <pre style="display:none;font-size:11px;max-height:120px;overflow:auto;background:#f0f0f1;padding:8px;border-radius:4px;"><?php echo esc_html(json_encode(json_decode($log['context'], true), JSON_PRETTY_PRINT)); ?></pre>
                        <?php endif; ?>
                    </td>
                    <td style="white-space:nowrap;"><?php echo esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log['created_at']))); ?></td>
                </tr><?php endforeach; ?></tbody></table>
            </div><?php endif; ?>
        </div>
        <?php
    }

    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_clear_logs', 'kozmo_ai_nonce');
        Logger::clear();
        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-logs'));
        exit;
    }

    // ── Diagnostics Page ──
    public static function render_diagnostics(): void {
        $info = Diagnostics::get_system_info();
        ?>
        <div class="wrap kozmo-ai-wrap">
            <div class="kozmo-header"><h1><span class="kozmo-logo">K</span> <?php esc_html_e('KOZMO AI — Diagnostics', 'kozmo-ai-wp'); ?></h1></div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:20px;">
                <div class="kozmo-card"><h2><?php esc_html_e('Plugin', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <tr><td><?php esc_html_e('Version', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['plugin']['version']); ?></td></tr>
                        <tr><td><?php esc_html_e('DB Version', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['plugin']['db_version']); ?></td></tr>
                        <tr><td><?php esc_html_e('Activated At', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['plugin']['activated_at']); ?></td></tr>
                    </tbody></table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('WordPress', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <tr><td><?php esc_html_e('Version', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['wordpress']['version']); ?></td></tr>
                        <tr><td><?php esc_html_e('Site URL', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['wordpress']['site_url']); ?></td></tr>
                        <tr><td><?php esc_html_e('Permalink', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['wordpress']['permalink'] ?: 'Plain'); ?></td></tr>
                        <tr><td><?php esc_html_e('Cron', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['wordpress']['cron_status']); ?></td></tr>
                    </tbody></table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Server', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <tr><td>PHP</td><td><?php echo esc_html($info['server']['php_version']); ?></td></tr>
                        <tr><td>MySQL</td><td><?php echo esc_html($info['server']['mysql_version']); ?></td></tr>
                        <tr><td><?php esc_html_e('Memory', 'kozmo-ai-wp'); ?></td><td><?php echo esc_html($info['server']['php_memory_limit']); ?> (<?php echo esc_html($info['server']['php_memory_usage']); ?> <?php esc_html_e('used', 'kozmo-ai-wp'); ?>)</td></tr>
                        <tr><td><?php esc_html_e('Object Cache', 'kozmo-ai-wp'); ?></td><td><?php echo $info['server']['object_cache'] ? '✅' : '❌'; ?></td></tr>
                    </tbody></table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Health', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <tr><td><?php esc_html_e('Overall', 'kozmo-ai-wp'); ?></td><td><span class="kozmo-badge badge-<?php echo esc_attr($info['health']['overall']); ?>"><?php echo esc_html($info['health']['overall']); ?></span></td></tr>
                        <?php foreach ($info['health']['checks'] as $name => $check): ?>
                        <tr><td><?php echo esc_html($name); ?></td><td><span class="kozmo-badge badge-<?php echo esc_attr($check['status']); ?>"><?php echo esc_html($check['status']); ?></span></td></tr>
                        <?php endforeach; ?>
                    </tbody></table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Tables', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <?php foreach ($info['tables'] as $name => $count): ?>
                        <tr><td><?php echo esc_html($name); ?></td><td><?php echo esc_html($count); ?></td></tr>
                        <?php endforeach; ?>
                    </tbody></table></div>

                <div class="kozmo-card"><h2><?php esc_html_e('Queue', 'kozmo-ai-wp'); ?></h2>
                    <table class="widefat striped"><tbody>
                        <?php foreach ($info['queue'] as $key => $val): if (is_array($val)) continue; ?>
                        <tr><td><?php echo esc_html($key); ?></td><td><?php echo esc_html($val); ?></td></tr>
                        <?php endforeach; ?>
                    </tbody></table></div>
            </div>
        </div>
        <?php
    }
}
