<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Admin {
    private static ?self $instance = null;
    private static string $hook = '';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_menu', [self::class, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_post_kozmo_ai_generate_key', ['KozmoAI_WP\\Auth', 'handle_generate_key']);
        add_action('admin_post_kozmo_ai_revoke_key', ['KozmoAI_WP\\Auth', 'handle_revoke_key']);
        add_action('admin_post_kozmo_ai_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_kozmo_ai_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('wp_ajax_kozmo_ai_test_connection', [self::class, 'ajax_test_connection']);
    }

    public static function add_admin_menu(): void {
        self::$hook = add_menu_page(
            __('KOZMO AI', 'kozmo-ai-wp'),
            __('KOZMO AI', 'kozmo-ai-wp'),
            'manage_options',
            'kozmo-ai-wp',
            [self::class, 'render_dashboard'],
            'dashicons-update',
            30
        );
        add_submenu_page('kozmo-ai-wp', __('Settings', 'kozmo-ai-wp'), __('Settings', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-settings', [self::class, 'render_settings']);
        add_submenu_page('kozmo-ai-wp', __('API Keys', 'kozmo-ai-wp'), __('API Keys', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-keys', [self::class, 'render_api_keys']);
        add_submenu_page('kozmo-ai-wp', __('Logs', 'kozmo-ai-wp'), __('Logs', 'kozmo-ai-wp'), 'manage_options', 'kozmo-ai-wp-logs', [self::class, 'render_logs']);
    }

    public static function enqueue_assets(string $hook): void {
        if (str_starts_with($hook, 'toplevel_page_kozmo-ai-wp') || str_contains($hook, 'kozmo-ai-wp-')) {
            wp_enqueue_style('kozmo-ai-admin', KOZMO_AI_WP_URL . 'assets/admin.css', [], KOZMO_AI_WP_VERSION);
            wp_enqueue_script('kozmo-ai-admin', KOZMO_AI_WP_URL . 'assets/admin.js', ['jquery'], KOZMO_AI_WP_VERSION, true);
            wp_localize_script('kozmo-ai-admin', 'kozmoAI', [
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce'    => wp_create_nonce('kozmo_ai_wp_ajax'),
            ]);
        }
    }

    // ══════════════════════════════════
    // RENDER: Dashboard
    // ══════════════════════════════════

    public static function render_dashboard(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        global $wpdb;
        $key_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE is_active = 1");
        $imported_posts = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_kozmo_ai_imported_at'");
        $log_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_logs WHERE level IN ('error','critical')");
        $seo_plugins = Api::detect_seo_plugins();
        $api_enabled = ($settings['api_enabled'] ?? 'yes') === 'yes';
        ?>
        <div class="k-shell k-admin-dashboard">
            <div class="k-nav">
                <div class="k-nav-logo">K</div>
                <span class="k-nav-title">KOZMO AI</span>
                <div class="k-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp')); ?>" class="k-nav-item active">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="k-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="k-nav-item">Logs</a>
                </div>
                <div class="k-nav-status">v<?php echo esc_html(KOZMO_AI_WP_VERSION); ?> <span class="k-nav-dot <?php echo $api_enabled ? 'healthy' : 'warning'; ?>"></span></div>
            </div>

            <div class="k-banner <?php echo $api_enabled ? 'healthy' : 'warning'; ?>">
                <span class="k-banner-icon"><?php echo $api_enabled ? '✓' : '⚠'; ?></span>
                <span class="k-banner-text"><?php echo $api_enabled ? 'API Active — ready to receive content from KOZMO Core.' : 'API Disabled — enable in Settings to receive content.'; ?></span>
            </div>

            <div class="k-grid">
                <div class="k-stat"><div class="k-stat-label">Active API Keys</div><div class="k-stat-value"><?php echo esc_html($key_count); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">Imported Posts</div><div class="k-stat-value"><?php echo esc_html($imported_posts); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">Unresolved Errors</div><div class="k-stat-value"><?php echo esc_html($log_count); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">SEO Plugins</div><div class="k-stat-value"><?php echo count($seo_plugins); ?></div></div>
            </div>

            <div class="k-gen">
                <div class="k-gen-info">
                    <div class="k-gen-item"><span class="k-gen-label">Status</span><span class="k-gen-badge k-tag <?php echo $api_enabled ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $api_enabled ? 'Active' : 'Paused'; ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Default Status</span><span class="k-gen-value"><?php echo esc_html($settings['default_status'] ?? 'draft'); ?></span></div>
                </div>
                <div class="k-gen-actions">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="k-btn k-btn-primary">Manage API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-btn k-btn-secondary">Settings</a>
                    <button id="k-test-api" class="k-btn k-btn-secondary">Test Connection</button>
                </div>
            </div>

            <div class="k-card">
                <h2>How to Connect</h2>
                <ol class="kozmo-core-steps" style="counter-reset:step;list-style:none;padding:0;">
                    <li style="counter-increment:step;position:relative;padding:0 0 20px 48px;"><strong>Generate an API Key</strong><p>Go to the API Keys page and create a new key. Copy it — you will need to enter it in the KOZMO Core dashboard.</p></li>
                    <li style="counter-increment:step;position:relative;padding:0 0 20px 48px;"><strong>Enter in KOZMO Core</strong><p>In your KOZMO Core dashboard, go to CMS Connections → Add WordPress connection. Enter your site URL and API key.</p></li>
                    <li style="counter-increment:step;position:relative;padding:0 0 20px 48px;"><strong>Start Publishing</strong><p>Once connected, KOZMO Core can create, update, and publish articles directly to your WordPress site.</p></li>
                </ol>
            </div>
        </div>
        <?php
    }

    // ══════════════════════════════════
    // RENDER: Settings
    // ══════════════════════════════════

    public static function render_settings(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        ?>
        <div class="k-shell">
            <div class="k-nav">
                <div class="k-nav-logo">K</div>
                <span class="k-nav-title">KOZMO AI — Settings</span>
                <div class="k-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp')); ?>" class="k-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-nav-item active">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="k-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="k-nav-item">Logs</a>
                </div>
            </div>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('kozmo_ai_save_settings', 'kozmo_ai_nonce'); ?>
                <input type="hidden" name="action" value="kozmo_ai_save_settings">

                <div class="k-settings">
                    <div class="k-section">
                        <div class="k-section-header">General</div>
                        <div class="k-field k-field-checkbox">
                            <input type="checkbox" name="api_enabled" id="api_enabled" value="yes" <?php checked($settings['api_enabled'] ?? 'yes', 'yes'); ?>>
                            <label for="api_enabled">Enable REST API</label>
                        </div>
                        <div class="k-field">
                            <label for="default_status">Default Post Status</label>
                            <select name="default_status" id="default_status">
                                <option value="draft" <?php selected($settings['default_status'] ?? 'draft', 'draft'); ?>>Draft</option>
                                <option value="pending" <?php selected($settings['default_status'] ?? 'draft', 'pending'); ?>>Pending Review</option>
                                <option value="publish" <?php selected($settings['default_status'] ?? 'draft', 'publish'); ?>>Published</option>
                            </select>
                            <div class="k-desc">Default status for new posts created by KOZMO Core. Can be overridden per-article.</div>
                        </div>
                        <div class="k-field">
                            <label for="default_author">Default Author</label>
                            <?php wp_dropdown_users(['name' => 'default_author', 'selected' => $settings['default_author'] ?? get_current_user_id(), 'show_option_none' => false]); ?>
                            <div class="k-desc">Default author for posts created by KOZMO Core.</div>
                        </div>
                        <div class="k-field k-field-checkbox">
                            <input type="checkbox" name="auto_import_tags" id="auto_import_tags" value="yes" <?php checked($settings['auto_import_tags'] ?? 'yes', 'yes'); ?>>
                            <label for="auto_import_tags">Auto-import Tags</label>
                        </div>
                        <div class="k-field k-field-checkbox">
                            <input type="checkbox" name="auto_import_cats" id="auto_import_cats" value="yes" <?php checked($settings['auto_import_cats'] ?? 'yes', 'yes'); ?>>
                            <label for="auto_import_cats">Auto-import Categories</label>
                        </div>
                    </div>

                    <div class="k-section">
                        <div class="k-section-header">Webhook</div>
                        <div class="k-field">
                            <label>Webhook URL</label>
                            <code style="display:block;padding:8px 12px;background:var(--k-bg-elevated);border-radius:var(--k-radius);"><?php echo esc_url(rest_url(KOZMO_AI_WP_API_NAMESPACE . '/webhook')); ?></code>
                            <div class="k-desc">Configure this URL in your KOZMO Core dashboard's webhook settings.</div>
                        </div>
                        <div class="k-field">
                            <label for="webhook_secret">Webhook Secret</label>
                            <input type="text" name="webhook_secret" id="webhook_secret" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>">
                            <div class="k-desc">Optional. If set, KOZMO Core will sign payloads with this secret.</div>
                        </div>
                        <div class="k-field k-field-checkbox">
                            <input type="checkbox" name="enable_webhooks" id="enable_webhooks" value="yes" <?php checked($settings['enable_webhooks'] ?? 'yes', 'yes'); ?>>
                            <label for="enable_webhooks">Enable Webhooks</label>
                        </div>
                    </div>

                    <div class="k-section">
                        <div class="k-section-header">Logging</div>
                        <div class="k-field">
                            <label for="log_level">Log Level</label>
                            <select name="log_level" id="log_level">
                                <option value="debug" <?php selected($settings['log_level'] ?? 'info', 'debug'); ?>>Debug (all messages)</option>
                                <option value="info" <?php selected($settings['log_level'] ?? 'info', 'info'); ?>>Info</option>
                                <option value="warning" <?php selected($settings['log_level'] ?? 'info', 'warning'); ?>>Warning</option>
                                <option value="error" <?php selected($settings['log_level'] ?? 'info', 'error'); ?>>Errors only</option>
                                <option value="critical" <?php selected($settings['log_level'] ?? 'info', 'critical'); ?>>Critical only</option>
                            </select>
                        </div>
                        <div class="k-field k-field-checkbox">
                            <input type="checkbox" name="debug_mode" id="debug_mode" value="yes" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?>>
                            <label for="debug_mode">Debug Mode</label>
                            <div class="k-desc">Warning: generates a lot of log entries.</div>
                        </div>
                    </div>

                    <button type="submit" class="k-btn k-btn-primary">Save Settings</button>
                </div>
            </form>
        </div>
        <?php
    }

    // ══════════════════════════════════
    // RENDER: API Keys
    // ══════════════════════════════════

    public static function render_api_keys(): void {
        $keys = Auth::list_keys();
        ?>
        <div class="k-shell">
            <div class="k-nav">
                <div class="k-nav-logo">K</div>
                <span class="k-nav-title">KOZMO AI — API Keys</span>
                <div class="k-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp')); ?>" class="k-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="k-nav-item active">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="k-nav-item">Logs</a>
                </div>
            </div>

            <div class="k-card">
                <div class="k-card-header"><h2>Generate New API Key</h2></div>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;">
                    <?php wp_nonce_field('kozmo_ai_generate_key', 'kozmo_ai_generate_nonce'); ?>
                    <input type="hidden" name="action" value="kozmo_ai_generate_key">
                    <div class="k-field" style="margin:0;">
                        <label for="key_label">Label</label>
                        <input type="text" id="key_label" name="label" placeholder="e.g., KOZMO Core Production">
                    </div>
                    <div class="k-field" style="margin:0;">
                        <label for="key_permissions">Permissions</label>
                        <select id="key_permissions" name="permissions">
                            <option value="read,write">Read & Write (full access)</option>
                            <option value="read">Read Only</option>
                            <option value="write">Write Only</option>
                        </select>
                    </div>
                    <div class="k-field" style="margin:0;">
                        <label for="key_expiry">Expires</label>
                        <select id="key_expiry" name="expires_in">
                            <option value="0">Never</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="180">180 days</option>
                            <option value="365">1 year</option>
                        </select>
                    </div>
                    <button type="submit" class="k-btn k-btn-primary">Generate Key</button>
                </form>

                <?php if (isset($_GET['new_key'])): ?>
                <div class="k-notice k-notice-success" style="margin-top:16px;">
                    <strong>New API Key Generated!</strong> Copy it now — it will not be shown again.
                    <div class="k-key-display k-key-new" style="margin-top:8px;">
                        <code><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['new_key']))); ?></code>
                        <button type="button" class="k-btn k-btn-sm k-btn-secondary" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!';">Copy</button>
                    </div>
                </div>
                <?php endif; ?>
            </div>

            <div class="k-card">
                <div class="k-card-header"><h2>Existing API Keys</h2></div>
                <?php if (empty($keys)): ?>
                    <p style="color:var(--k-text-secondary);">No API keys generated yet.</p>
                <?php else: ?>
                <table class="k-key-table">
                    <thead><tr><th>Label</th><th>Key</th><th>Permissions</th><th>Status</th><th>Last Used</th><th>Expires</th><th>Created</th><th>Actions</th></tr></thead>
                    <tbody>
                        <?php foreach ($keys as $key): ?>
                        <tr>
                            <td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                            <td class="k-masked" data-key-id="<?php echo esc_attr($key['id']); ?>"><?php echo esc_html($key['masked_key'] ?? 'Stored securely'); ?></td>
                            <td><?php echo esc_html($key['permissions']); ?></td>
                            <td><span class="k-tag <?php echo $key['is_active'] ? 'k-tag-active' : 'k-tag-red'; ?>"><?php echo $key['is_active'] ? 'Active' : 'Revoked'; ?></span></td>
                            <td><?php echo $key['last_used_at'] ? esc_html($key['last_used_at']) : '—'; ?></td>
                            <td><?php echo $key['expires_at'] ? esc_html(wp_date(get_option('date_format'), strtotime($key['expires_at']))) : 'Never'; ?></td>
                            <td><?php echo esc_html(wp_date(get_option('date_format'), strtotime($key['created_at']))); ?></td>
                            <td>
                                <?php if ($key['is_active']): ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                    <?php wp_nonce_field('kozmo_ai_revoke_key', 'kozmo_ai_revoke_nonce'); ?>
                                    <input type="hidden" name="action" value="kozmo_ai_revoke_key">
                                    <input type="hidden" name="key_id" value="<?php echo esc_attr($key['id']); ?>">
                                    <button type="submit" class="k-btn k-btn-sm k-btn-danger" onclick="return confirm('Revoke this API key? This cannot be undone.');">Revoke</button>
                                </form>
                                <button type="button" class="k-btn k-btn-sm k-btn-secondary" onclick="revealApiKey(<?php echo esc_js($key['id']); ?>)">Reveal</button>
                                <?php else: ?>
                                <span style="color:var(--k-text-tertiary);">—</span>
                                <?php endif; ?>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php endif; ?>
            </div>
        </div>
        <?php
    }

    // ══════════════════════════════════
    // RENDER: Logs
    // ══════════════════════════════════

    public static function render_logs(): void {
        $level = isset($_GET['level']) ? sanitize_text_field(wp_unslash($_GET['level'])) : '';
        $logs = Logger::get_logs(200, $level);
        ?>
        <div class="k-shell">
            <div class="k-nav">
                <div class="k-nav-logo">K</div>
                <span class="k-nav-title">KOZMO AI — Activity Logs</span>
                <div class="k-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp')); ?>" class="k-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-settings')); ?>" class="k-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-keys')); ?>" class="k-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="k-nav-item active">Logs</a>
                </div>
            </div>

            <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;">
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs')); ?>" class="k-btn k-btn-sm <?php echo empty($level) ? 'k-btn-primary' : 'k-btn-secondary'; ?>">All</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs&level=error')); ?>" class="k-btn k-btn-sm <?php echo $level === 'error' ? 'k-btn-primary' : 'k-btn-secondary'; ?>">Errors</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs&level=warning')); ?>" class="k-btn k-btn-sm <?php echo $level === 'warning' ? 'k-btn-primary' : 'k-btn-secondary'; ?>">Warnings</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-logs&level=info')); ?>" class="k-btn k-btn-sm <?php echo $level === 'info' ? 'k-btn-primary' : 'k-btn-secondary'; ?>">Info</a>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-left:auto;">
                    <?php wp_nonce_field('kozmo_ai_clear_logs', 'kozmo_ai_nonce'); ?>
                    <input type="hidden" name="action" value="kozmo_ai_clear_logs">
                    <button type="submit" class="k-btn k-btn-sm k-btn-danger" onclick="return confirm('Clear all logs? This cannot be undone.');">Clear All</button>
                </form>
            </div>

            <?php if (empty($logs)): ?>
                <div class="k-card"><p style="color:var(--k-text-secondary);">No log entries found.</p></div>
            <?php else: ?>
            <div class="k-table-wrap">
                <table class="k-table">
                    <thead><tr><th>Level</th><th>Service</th><th>Message</th><th>Time</th></tr></thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><span class="k-tag <?php echo $log['level'] === 'error' || $log['level'] === 'critical' ? 'k-tag-red' : ($log['level'] === 'warning' ? 'k-tag-yellow' : 'k-tag-blue'); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                            <td><?php echo esc_html($log['service'] ?? 'core'); ?></td>
                            <td><?php echo esc_html($log['message']); ?></td>
                            <td class="k-text-mono"><?php echo esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log['created_at']))); ?></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            <?php endif; ?>
        </div>
        <?php
    }

    // ══════════════════════════════════
    // HANDLERS
    // ══════════════════════════════════

    public static function handle_save_settings(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_save_settings', 'kozmo_ai_nonce');

        $settings = [
            'api_enabled'      => sanitize_text_field(wp_unslash($_POST['api_enabled'] ?? 'no')),
            'log_level'        => sanitize_text_field(wp_unslash($_POST['log_level'] ?? 'info')),
            'default_status'   => sanitize_text_field(wp_unslash($_POST['default_status'] ?? 'draft')),
            'default_author'   => absint(wp_unslash($_POST['default_author'] ?? get_current_user_id())),
            'auto_import_tags' => sanitize_text_field(wp_unslash($_POST['auto_import_tags'] ?? 'no')),
            'auto_import_cats' => sanitize_text_field(wp_unslash($_POST['auto_import_cats'] ?? 'no')),
            'webhook_secret'   => sanitize_text_field(wp_unslash($_POST['webhook_secret'] ?? '')),
            'enable_webhooks'  => sanitize_text_field(wp_unslash($_POST['enable_webhooks'] ?? 'no')),
            'debug_mode'       => sanitize_text_field(wp_unslash($_POST['debug_mode'] ?? 'no')),
        ];

        update_option('kozmo_ai_wp_settings', $settings);
        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
        exit;
    }

    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_clear_logs', 'kozmo_ai_nonce');
        Logger::clear_logs();
        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-logs'));
        exit;
    }

    public static function ajax_test_connection(): void {
        check_ajax_referer('kozmo_ai_wp_ajax');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized.']);

        global $wpdb;
        $api_key = get_option('kozmo_ai_wp_initial_key', '');
        if (empty($api_key)) {
            $api_key = $wpdb->get_var(
                "SELECT api_key FROM {$wpdb->prefix}kozmo_ai_api_keys WHERE is_active = 1 AND api_key IS NOT NULL AND api_key <> '' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1"
            );
        }

        if (empty($api_key)) {
            wp_send_json_error(['message' => 'No active API key found. Generate one first.']);
            return;
        }

        $response = wp_remote_get(rest_url(KOZMO_AI_WP_API_NAMESPACE . '/status'), [
            'timeout' => 10,
            'headers' => ['X-KOZMO-AI-Key' => $api_key],
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => $response->get_error_message()]);
            return;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code === 200 && ($body['success'] ?? false)) {
            wp_send_json_success([
                'model'       => $body['data']['version'] ?? 'ok',
                'site_name'   => $body['data']['site_name'] ?? '',
                'seo_plugins' => count($body['data']['seo_plugins'] ?? []),
            ]);
        } else {
            wp_send_json_error([
                'status_code' => $status_code,
                'message'     => $body['message'] ?? 'Connection test failed.',
            ]);
        }
    }
}
