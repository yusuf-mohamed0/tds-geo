<?php
// <YKS />  YUSUF KO STA  Code. Build. Ship.™
// © 2026 Yusuf Mohamed. All rights reserved.
// Licensed under the ISC License.
namespace TdsGeo_WP;
defined('ABSPATH') || exit;

class Admin {
    private static ?self $instance = null;
    private static string $hook = '';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_menu', [self::class, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_head', [self::class, 'inject_sidebar_logo']);
        add_filter('admin_body_class', [self::class, 'admin_body_class']);
        add_action('admin_post_kivo_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_kivo_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('wp_ajax_kivo_test_connection', [self::class, 'ajax_test_connection']);
        add_action('wp_ajax_kivo_dashboard_data', [self::class, 'ajax_dashboard_data']);
    }

    public static function add_admin_menu(): void {
        self::$hook = add_menu_page(
            __('Kivo Geo', 'kivo-wp'),
            __('Kivo Geo', 'kivo-wp'),
            'manage_options',
            'kivo-wp',
            [self::class, 'render_dashboard'],
            'dashicons-update',
            30
        );
        add_submenu_page('kivo-wp', __('Settings', 'kivo-wp'), __('Settings', 'kivo-wp'), 'manage_options', 'kivo-wp-settings', [self::class, 'render_settings']);
        add_submenu_page('kivo-wp', __('API Keys', 'kivo-wp'), __('API Keys', 'kivo-wp'), 'manage_options', 'kivo-wp-keys', [self::class, 'render_api_keys']);
        add_submenu_page('kivo-wp', __('Logs', 'kivo-wp'), __('Logs', 'kivo-wp'), 'manage_options', 'kivo-wp-logs', [self::class, 'render_logs']);
    }

    public static function enqueue_assets(string $hook): void {
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        $is_plugin_page = str_starts_with($hook, 'toplevel_page_kivo-wp')
            || str_contains($hook, 'kivo-wp-')
            || str_starts_with($page, 'kivo-wp');

        if (!$is_plugin_page) {
            return;
        }

        wp_enqueue_style('kivo-admin', KIVO_WP_URL . 'assets/admin.css', [], KIVO_WP_VERSION);
        wp_enqueue_script('kivo-admin', KIVO_WP_URL . 'assets/admin.js', ['jquery'], KIVO_WP_VERSION, true);
        wp_localize_script('kivo-admin', 'tdsGeo', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('kivo_wp_ajax'),
        ]);
    }

    public static function admin_body_class(string $classes): string {
        $page = isset($_GET['page']) ? sanitize_key(wp_unslash($_GET['page'])) : '';
        if (!str_starts_with($page, 'kivo-wp')) {
            return $classes;
        }

        return trim($classes . ' kivo-wp-admin');
    }

    public static function inject_sidebar_logo(): void {
        ?>
        <style>
        #adminmenu .tds-sidebar-logo {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px 12px 10px;
            border-bottom: 1px solid rgba(252,185,0,0.12);
            margin-bottom: 6px;
        }
        #adminmenu .tds-sidebar-logo img {
            max-width: 100%;
            height: auto;
            max-height: 34px;
            display: block;
        }
        </style>
        <script>
        (function() {
            var menu = document.getElementById('adminmenu');
            if (!menu || document.querySelector('.tds-sidebar-logo')) return;
            var logo = document.createElement('li');
            logo.className = 'tds-sidebar-logo';
            logo.innerHTML = '<img src="<?php echo esc_url(KIVO_WP_URL . 'assets/kivo-white.png'); ?>" alt="Kivo Geo">';
            menu.insertBefore(logo, menu.firstChild);
        })();
        </script>
        <?php
    }

    // ══════════════════════════════════
    // RENDER: Dashboard
    // ══════════════════════════════════

    public static function render_dashboard(): void {
        $settings = get_option('kivo_wp_settings', []);
        global $wpdb;
        $key_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kivo_api_keys WHERE is_active = 1");
        $imported_posts = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_kivo_imported_at'");
        $log_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kivo_logs WHERE level IN ('error','critical')");
        $seo_plugins = Api::detect_seo_plugins();
        $api_enabled = ($settings['api_enabled'] ?? 'yes') === 'yes';
        $api_ready = $api_enabled && $key_count > 0;
        $api_state = !$api_enabled ? 'warning' : ($api_ready ? 'healthy' : 'warning');
        $api_message = !$api_enabled
            ? 'API Disabled — enable in Settings to receive content.'
            : ($api_ready
                ? 'API Ready - authenticated and ready to receive content from Kivo Geo.'
                : 'API Enabled, but no active API key exists yet. Generate one to connect Kivo Geo.');
        ?>
        <div class="tds-shell tds-admin-dashboard">
            <div class="tds-nav">
                <div class="tds-nav-logo"><img src="<?php echo esc_url(KIVO_WP_URL . 'assets/kivo-white.png'); ?>" alt="Kivo Geo"></div>
                <span class="tds-nav-title">Kivo Geo</span>
                <div class="tds-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp')); ?>" class="tds-nav-item active">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-settings')); ?>" class="tds-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-keys')); ?>" class="tds-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs')); ?>" class="tds-nav-item">Logs</a>
                </div>
                <div class="tds-nav-status">v<?php echo esc_html(KIVO_WP_VERSION); ?> <span class="tds-nav-dot <?php echo esc_attr($api_state); ?>"></span></div>
            </div>

            <div class="tds-banner <?php echo esc_attr($api_state); ?>">
                <span class="tds-banner-icon"><?php echo $api_ready ? '✓' : '⚠'; ?></span>
                <span class="tds-banner-text"><?php echo esc_html($api_message); ?></span>
            </div>

            <div class="tds-grid">
                <div class="tds-stat"><div class="tds-stat-label">Active API Keys</div><div class="tds-stat-value"><?php echo esc_html($key_count); ?></div></div>
                <div class="tds-stat"><div class="tds-stat-label">Imported Posts</div><div class="tds-stat-value"><?php echo esc_html($imported_posts); ?></div></div>
                <div class="tds-stat"><div class="tds-stat-label">Unresolved Errors</div><div class="tds-stat-value"><?php echo esc_html($log_count); ?></div></div>
                <div class="tds-stat"><div class="tds-stat-label">SEO Plugins</div><div class="tds-stat-value"><?php echo count($seo_plugins); ?></div></div>
            </div>

            <div class="tds-gen">
                <div class="tds-gen-info">
                    <div class="tds-gen-item"><span class="tds-gen-label">Status</span><span class="tds-gen-badge tds-tag <?php echo $api_ready ? 'tds-tag-active' : 'tds-tag-yellow'; ?>"><?php echo $api_ready ? 'Ready' : ($api_enabled ? 'Needs Key' : 'Paused'); ?></span></div>
                    <div class="tds-gen-item"><span class="tds-gen-label">Default Status</span><span class="tds-gen-value"><?php echo esc_html($settings['default_status'] ?? 'draft'); ?></span></div>
                </div>
                <div class="tds-gen-actions">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-keys')); ?>" class="tds-btn tds-btn-primary">Manage API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-settings')); ?>" class="tds-btn tds-btn-secondary">Settings</a>
                    <button id="tds-test-api" class="tds-btn tds-btn-secondary">Test Connection</button>
                </div>
            </div>

            <div class="tds-card">
                <div class="tds-card-header"><h2>How to Connect</h2></div>
                <ol class="kivo-steps">
                    <li><strong>Generate an API Key</strong><p>Go to the API Keys page and create a new key. Copy it; you will need to enter it in the Kivo Geo dashboard.</p></li>
                    <li><strong>Enter in Kivo Geo</strong><p>In your Kivo Geo dashboard, go to CMS Connections - Add WordPress connection. Enter your site URL and API key.</p></li>
                    <li><strong>Start Publishing</strong><p>Once connected, Kivo Geo can create, update, and publish articles directly to your WordPress site.</p></li>
                </ol>
            </div>
        </div>
        <?php
    }

    // ══════════════════════════════════
    // RENDER: Settings
    // ══════════════════════════════════

    public static function render_settings(): void {
        $settings = get_option('kivo_wp_settings', []);
        ?>
        <div class="tds-shell">
            <div class="tds-nav">
                <div class="tds-nav-logo"><img src="<?php echo esc_url(KIVO_WP_URL . 'assets/kivo-white.png'); ?>" alt="Kivo Geo" style="height:28px;width:auto;"></div>
                <span class="tds-nav-title">Kivo Geo - Settings</span>
                <div class="tds-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp')); ?>" class="tds-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-settings')); ?>" class="tds-nav-item active">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-keys')); ?>" class="tds-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs')); ?>" class="tds-nav-item">Logs</a>
                </div>
            </div>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('kivo_save_settings', 'kivo_nonce'); ?>
                <input type="hidden" name="action" value="kivo_save_settings">

                <?php if (isset($_GET['updated'])): ?>
                <div class="tds-notice tds-notice-success" style="margin-bottom:16px;">
                    Settings saved successfully.
                </div>
                <?php endif; ?>

                <div class="tds-settings">
                    <div class="tds-section">
                        <div class="tds-section-header">General</div>
                        <div class="tds-field tds-field-checkbox">
                            <input type="checkbox" name="api_enabled" id="api_enabled" value="yes" <?php checked($settings['api_enabled'] ?? 'yes', 'yes'); ?>>
                            <label for="api_enabled">Enable REST API</label>
                        </div>
                        <div class="tds-field">
                            <label for="default_status">Default Post Status</label>
                            <select name="default_status" id="default_status">
                                <option value="draft" <?php selected($settings['default_status'] ?? 'draft', 'draft'); ?>>Draft</option>
                                <option value="pending" <?php selected($settings['default_status'] ?? 'draft', 'pending'); ?>>Pending Review</option>
                                <option value="publish" <?php selected($settings['default_status'] ?? 'draft', 'publish'); ?>>Published</option>
                            </select>
                            <div class="tds-desc">Default status for new posts created by Kivo Geo. Can be overridden per-article.</div>
                        </div>
                        <div class="tds-field">
                            <label for="default_author">Default Author</label>
                            <?php wp_dropdown_users(['name' => 'default_author', 'selected' => $settings['default_author'] ?? get_current_user_id(), 'show_option_none' => false]); ?>
                            <div class="tds-desc">Default author for posts created by Kivo Geo.</div>
                        </div>
                        <div class="tds-field tds-field-checkbox">
                            <input type="checkbox" name="auto_import_tags" id="auto_import_tags" value="yes" <?php checked($settings['auto_import_tags'] ?? 'yes', 'yes'); ?>>
                            <label for="auto_import_tags">Auto-import Tags</label>
                        </div>
                        <div class="tds-field tds-field-checkbox">
                            <input type="checkbox" name="auto_import_cats" id="auto_import_cats" value="yes" <?php checked($settings['auto_import_cats'] ?? 'yes', 'yes'); ?>>
                            <label for="auto_import_cats">Auto-import Categories</label>
                        </div>
                    </div>

                    <div class="tds-section">
                        <div class="tds-section-header">Webhook</div>
                        <div class="tds-field">
                            <label>Webhook URL</label>
                            <code style="display:block;padding:8px 12px;background:var(--tds-bg-elevated);border-radius:var(--tds-radius);"><?php echo esc_url(rest_url(KIVO_WP_API_NAMESPACE . '/webhook')); ?></code>
                            <div class="tds-desc">Configure this URL in your Kivo Geo dashboard's webhook settings.</div>
                        </div>
                        <div class="tds-field">
                            <label for="webhook_secret">Webhook Secret</label>
                            <input type="text" name="webhook_secret" id="webhook_secret" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>">
                            <div class="tds-desc">Optional. If set, Kivo Geo will sign payloads with this secret.</div>
                        </div>
                        <div class="tds-field tds-field-checkbox">
                            <input type="checkbox" name="enable_webhooks" id="enable_webhooks" value="yes" <?php checked($settings['enable_webhooks'] ?? 'yes', 'yes'); ?>>
                            <label for="enable_webhooks">Enable Webhooks</label>
                        </div>
                    </div>

                    <div class="tds-section">
                        <div class="tds-section-header">Logging</div>
                        <div class="tds-field">
                            <label for="log_level">Log Level</label>
                            <select name="log_level" id="log_level">
                                <option value="debug" <?php selected($settings['log_level'] ?? 'info', 'debug'); ?>>Debug (all messages)</option>
                                <option value="info" <?php selected($settings['log_level'] ?? 'info', 'info'); ?>>Info</option>
                                <option value="warning" <?php selected($settings['log_level'] ?? 'info', 'warning'); ?>>Warning</option>
                                <option value="error" <?php selected($settings['log_level'] ?? 'info', 'error'); ?>>Errors only</option>
                                <option value="critical" <?php selected($settings['log_level'] ?? 'info', 'critical'); ?>>Critical only</option>
                            </select>
                        </div>
                        <div class="tds-field tds-field-checkbox">
                            <input type="checkbox" name="debug_mode" id="debug_mode" value="yes" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?>>
                            <label for="debug_mode">Debug Mode</label>
                            <div class="tds-desc">Warning: generates a lot of log entries.</div>
                        </div>
                    </div>

                    <button type="submit" class="tds-btn tds-btn-primary">Save Settings</button>
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
        $new_key = get_transient('kivo_wp_new_key_' . get_current_user_id());
        $key_error = get_transient('kivo_wp_key_error_' . get_current_user_id());
        if ($new_key) {
            delete_transient('kivo_wp_new_key_' . get_current_user_id());
        }
        if ($key_error) {
            delete_transient('kivo_wp_key_error_' . get_current_user_id());
        }
        ?>
        <div class="tds-shell">
            <div class="tds-nav">
                <div class="tds-nav-logo"><img src="<?php echo esc_url(KIVO_WP_URL . 'assets/kivo-white.png'); ?>" alt="Kivo Geo" style="height:28px;width:auto;"></div>
                <span class="tds-nav-title">Kivo Geo - API Keys</span>
                <div class="tds-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp')); ?>" class="tds-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-settings')); ?>" class="tds-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-keys')); ?>" class="tds-nav-item active">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs')); ?>" class="tds-nav-item">Logs</a>
                </div>
            </div>

            <div class="tds-card">
                <div class="tds-card-header"><h2>Generate New API Key</h2></div>

                <?php if (isset($_GET['updated'])): ?>
                <div class="tds-notice tds-notice-success" style="margin-bottom:16px;">
                    API key updated successfully.
                </div>
                <?php endif; ?>

                <?php if ($key_error): ?>
                <div class="tds-notice tds-notice-error" style="margin-bottom:16px;">
                    <?php echo esc_html($key_error); ?>
                </div>
                <?php endif; ?>

                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="tds-key-form">
                    <?php wp_nonce_field('kivo_generate_key', 'kivo_generate_nonce'); ?>
                    <input type="hidden" name="action" value="kivo_generate_key">
                    <div class="tds-field">
                        <label for="key_label">Label</label>
                        <input type="text" id="key_label" name="label" placeholder="e.g., Kivo Geo Production">
                    </div>
                    <div class="tds-field">
                        <label for="key_permissions">Permissions</label>
                        <select id="key_permissions" name="permissions">
                            <option value="read,write">Read & Write (full access)</option>
                            <option value="read">Read Only</option>
                            <option value="write">Write Only</option>
                        </select>
                    </div>
                    <div class="tds-field">
                        <label for="key_expiry">Expires</label>
                        <select id="key_expiry" name="expires_in">
                            <option value="0">Never</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="180">180 days</option>
                            <option value="365">1 year</option>
                        </select>
                    </div>
                    <button type="submit" class="tds-btn tds-btn-primary">Generate Key</button>
                </form>

                <?php if ($new_key): ?>
                <div class="tds-notice tds-notice-success" style="margin-top:16px;">
                    <strong>New API Key Generated!</strong> Copy it now — it will not be shown again.
                    <div class="tds-key-display tds-key-new" style="margin-top:8px;">
                        <code><?php echo esc_html($new_key); ?></code>
                        <button type="button" class="tds-btn tds-btn-sm tds-btn-secondary" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!';">Copy</button>
                    </div>
                </div>
                <?php endif; ?>
            </div>

            <div class="tds-card">
                <div class="tds-card-header"><h2>Existing API Keys</h2></div>
                <?php if (empty($keys)): ?>
                    <p style="color:var(--tds-text-secondary);">No API keys generated yet.</p>
                <?php else: ?>
                <table class="tds-key-table">
                    <thead><tr><th>Label</th><th>Key</th><th>Permissions</th><th>Status</th><th>Last Used</th><th>Expires</th><th>Created</th><th>Actions</th></tr></thead>
                    <tbody>
                        <?php foreach ($keys as $key): ?>
                        <tr>
                            <td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                            <td class="tds-masked" data-key-id="<?php echo esc_attr($key['id']); ?>"><?php echo esc_html($key['masked_key'] ?? 'Stored securely'); ?></td>
                            <td><?php echo esc_html($key['permissions']); ?></td>
                            <td><span class="tds-tag <?php echo $key['is_active'] ? 'tds-tag-active' : 'tds-tag-red'; ?>"><?php echo $key['is_active'] ? 'Active' : 'Revoked'; ?></span></td>
                            <td><?php echo $key['last_used_at'] ? esc_html($key['last_used_at']) : '—'; ?></td>
                            <td><?php echo $key['expires_at'] ? esc_html(wp_date(get_option('date_format'), strtotime($key['expires_at']))) : 'Never'; ?></td>
                            <td><?php echo esc_html(wp_date(get_option('date_format'), strtotime($key['created_at']))); ?></td>
                            <td>
                                <?php if ($key['is_active']): ?>
                                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                    <?php wp_nonce_field('kivo_revoke_key', 'kivo_revoke_nonce'); ?>
                                    <input type="hidden" name="action" value="kivo_revoke_key">
                                    <input type="hidden" name="key_id" value="<?php echo esc_attr($key['id']); ?>">
                                    <button type="submit" class="tds-btn tds-btn-sm tds-btn-danger" onclick="return confirm('Revoke this API key? This cannot be undone.');">Revoke</button>
                                </form>
                                <button type="button" class="tds-btn tds-btn-sm tds-btn-secondary" onclick="revealApiKey(<?php echo esc_js($key['id']); ?>)">Reveal</button>
                                <?php else: ?>
                                <span style="color:var(--tds-text-tertiary);">—</span>
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
        <div class="tds-shell">
            <div class="tds-nav">
                <div class="tds-nav-logo"><img src="<?php echo esc_url(KIVO_WP_URL . 'assets/kivo-white.png'); ?>" alt="Kivo Geo" style="height:28px;width:auto;"></div>
                <span class="tds-nav-title">Kivo Geo - Activity Logs</span>
                <div class="tds-nav-items">
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp')); ?>" class="tds-nav-item">Dashboard</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-settings')); ?>" class="tds-nav-item">Settings</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-keys')); ?>" class="tds-nav-item">API Keys</a>
                    <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs')); ?>" class="tds-nav-item active">Logs</a>
                </div>
            </div>

            <div class="tds-filter-bar">
                <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs')); ?>" class="tds-btn tds-btn-sm <?php echo empty($level) ? 'tds-btn-primary' : 'tds-btn-secondary'; ?>">All</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs&level=error')); ?>" class="tds-btn tds-btn-sm <?php echo $level === 'error' ? 'tds-btn-primary' : 'tds-btn-secondary'; ?>">Errors</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs&level=warning')); ?>" class="tds-btn tds-btn-sm <?php echo $level === 'warning' ? 'tds-btn-primary' : 'tds-btn-secondary'; ?>">Warnings</a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kivo-wp-logs&level=info')); ?>" class="tds-btn tds-btn-sm <?php echo $level === 'info' ? 'tds-btn-primary' : 'tds-btn-secondary'; ?>">Info</a>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="margin-left:auto;">
                    <?php wp_nonce_field('kivo_clear_logs', 'kivo_nonce'); ?>
                    <input type="hidden" name="action" value="kivo_clear_logs">
                    <button type="submit" class="tds-btn tds-btn-sm tds-btn-danger" onclick="return confirm('Clear all logs? This cannot be undone.');">Clear All</button>
                </form>
            </div>

            <?php if (empty($logs)): ?>
                <div class="tds-card"><p style="color:var(--tds-text-secondary);">No log entries found.</p></div>
            <?php else: ?>
            <div class="tds-table-wrap">
                <table class="tds-table">
                    <thead><tr><th>Level</th><th>Service</th><th>Message</th><th>Time</th></tr></thead>
                    <tbody>
                        <?php foreach ($logs as $log): ?>
                        <tr>
                            <td><span class="tds-tag <?php echo $log['level'] === 'error' || $log['level'] === 'critical' ? 'tds-tag-red' : ($log['level'] === 'warning' ? 'tds-tag-yellow' : 'tds-tag-blue'); ?>"><?php echo esc_html(strtoupper($log['level'])); ?></span></td>
                            <td><?php echo esc_html($log['service'] ?? 'core'); ?></td>
                            <td><?php echo esc_html($log['message']); ?></td>
                            <td class="tds-text-mono"><?php echo esc_html(wp_date(get_option('date_format') . ' ' . get_option('time_format'), strtotime($log['created_at']))); ?></td>
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
        check_admin_referer('kivo_save_settings', 'kivo_nonce');

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

        update_option('kivo_wp_settings', $settings);
        wp_safe_redirect(admin_url('admin.php?page=kivo-wp-settings&updated=1'));
        exit;
    }

    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kivo_clear_logs', 'kivo_nonce');
        Logger::clear_logs();
        wp_safe_redirect(admin_url('admin.php?page=kivo-wp-logs'));
        exit;
    }

    public static function ajax_dashboard_data(): void {
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'kivo_wp_ajax')) { wp_send_json_error(['message' => 'Security check failed. Refresh the page.']); return; }
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized.']);

        global $wpdb;
        $settings = get_option('kivo_wp_settings', []);
        $api_enabled = ($settings['api_enabled'] ?? 'yes') === 'yes';
        $key_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kivo_api_keys WHERE is_active = 1");
        $error_count = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kivo_logs WHERE level IN ('error','critical')");
        $imported_posts = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_kivo_imported_at'");
        $today_start = wp_date('Y-m-d 00:00:00');
        $today_articles = (int) $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->postmeta} pm JOIN {$wpdb->posts} p ON p.ID = pm.post_id WHERE pm.meta_key = '_kivo_imported_at' AND p.post_date >= %s",
                $today_start
            )
        );

        $overall = $api_enabled && $key_count > 0 ? 'healthy' : ($key_count === 0 ? 'warning' : 'critical');

        $recent_logs = $wpdb->get_results(
            "SELECT level, service, message, created_at FROM {$wpdb->prefix}kivo_logs ORDER BY created_at DESC LIMIT 10",
            ARRAY_A
        );

        $recent_articles = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT p.ID, p.post_title, p.post_status, p.post_date, COALESCE(ga.quality_score, 0) as quality
                 FROM {$wpdb->postmeta} pm
                 JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                 LEFT JOIN {$wpdb->prefix}kivo_articles ga ON ga.post_id = p.ID
                 WHERE pm.meta_key = '_kivo_imported_at'
                 ORDER BY p.post_date DESC LIMIT %d",
                10
            ),
            ARRAY_A
        );

        $cat_count = (int) wp_count_terms(['taxonomy' => 'category']);
        $tag_count = (int) wp_count_terms(['taxonomy' => 'post_tag']);

        wp_send_json_success([
            'health' => [
                'overall' => $overall,
                'score'   => $api_enabled ? ($error_count === 0 ? 100 : max(0, 100 - ($error_count * 10))) : 50,
            ],
            'generation_enabled' => $api_enabled,
            'queue' => [
                'pending'       => 0,
                'failed'        => 0,
                'pending_tasks' => [],
            ],
            'errors' => [
                'unresolved' => $error_count,
                'healed'     => 0,
            ],
            'kb' => [
                'total'    => 0,
                'unsynced' => 0,
            ],
            'content' => [
                'thin_content'        => 0,
                'no_featured_images'  => 0,
            ],
            'keywords' => [
                'total_cats' => $cat_count,
                'total_tags' => $tag_count,
            ],
            'today_articles'  => $today_articles,
            'daily_max'       => 24,
            'pipeline_count'  => 0,
            'pipeline_failed' => 0,
            'pipeline_stages' => [
                'failed'  => 0,
                'stages'  => [],
            ],
            'next_run'        => null,
            'recent_logs'     => $recent_logs,
            'recent_articles' => $recent_articles,
        ]);
    }

    public static function ajax_test_connection(): void {
        if (!wp_verify_nonce($_POST['nonce'] ?? '', 'kivo_wp_ajax')) { wp_send_json_error(['message' => 'Security check failed. Refresh the page.']); return; }
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized.']);

        global $wpdb;
        $stored_key = get_option('kivo_wp_initial_key', '');
        $active_key_id = (int) $wpdb->get_var(
            "SELECT id FROM {$wpdb->prefix}kivo_api_keys WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 1"
        );
        $db_key = $active_key_id > 0 ? (Auth::reveal_key($active_key_id) ?: '') : '';

        $api_key = $db_key ?: $stored_key;

        if (empty($api_key)) {
            wp_send_json_error(['message' => 'No active API key found. Generate one first.']);
            return;
        }

        $request = new \WP_REST_Request('GET', '/' . KIVO_WP_API_NAMESPACE . '/status');
        $request->set_header('X-Kivo-Key', $api_key);
        $response = rest_do_request($request);

        if ($response->is_error()) {
            $error = $response->as_error();
            wp_send_json_error(['message' => $error ? $error->get_error_message() : 'Connection test failed.']);
            return;
        }

        $status_code = $response->get_status();
        $body = $response->get_data();

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
