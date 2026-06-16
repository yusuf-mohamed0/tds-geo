<?php
/**
 * KOZMO Core Admin Settings Page
 *
 * Provides the WordPress admin dashboard UI for managing the KOZMO Core integration:
 * - API key management (generate, revoke, list)
 * - Plugin settings (log level, default status, auto-import options)
 * - Log viewer for debugging
 * - System status / health check
 * - Quick start guide
 *
 * @package KOZMO_Core_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class KOZMO_Core_Admin {

    /**
     * @var self|null Singleton instance
     */
    private static ?self $instance = null;

    /**
     * Admin page hook suffix.
     */
    private static string $hook = '';

    /**
     * Initialize admin hooks.
     */
    public static function init(): void {
        if (self::$instance === null) {
            self::$instance = new self();
        }

        add_action('admin_menu', [self::class, 'add_admin_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_post_kozmo_core_generate_key', [self::class, 'handle_generate_key']);
        add_action('admin_post_kozmo_core_revoke_key', [self::class, 'handle_revoke_key']);
        add_action('admin_post_kozmo_core_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_kozmo_core_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('wp_ajax_kozmo_core_test_connection', [self::class, 'ajax_test_connection']);
        add_filter('plugin_action_links_' . plugin_basename(KOZMO_CORE_PLUGIN_FILE), [self::class, 'add_plugin_action_links']);
    }

    /**
     * Add admin menu items.
     */
    public static function add_admin_menu(): void {
        self::$hook = add_menu_page(
            __('KOZMO Core Integration', 'kozmo-core-integration'),
            __('KOZMO Core', 'kozmo-core-integration'),
            'manage_options',
            'kozmo-core',
            [self::class, 'render_dashboard'],
            'dashicons-update',
            30
        );

        add_submenu_page(
            'kozmo-core',
            __('Settings', 'kozmo-core-integration'),
            __('Settings', 'kozmo-core-integration'),
            'manage_options',
            'kozmo-core-settings',
            [self::class, 'render_settings']
        );

        add_submenu_page(
            'kozmo-core',
            __('API Keys', 'kozmo-core-integration'),
            __('API Keys', 'kozmo-core-integration'),
            'manage_options',
            'kozmo-core-keys',
            [self::class, 'render_api_keys']
        );

        add_submenu_page(
            'kozmo-core',
            __('Logs', 'kozmo-core-integration'),
            __('Logs', 'kozmo-core-integration'),
            'manage_options',
            'kozmo-core-logs',
            [self::class, 'render_logs']
        );
    }

    /**
     * Enqueue admin CSS.
     */
    public static function enqueue_assets(string $hook): void {
        if (str_starts_with($hook, 'toplevel_page_kozmo-core') || str_starts_with($hook, 'kozmo_core_page_kozmo-core')) {
            wp_enqueue_style(
                'kozmo-core-admin',
                KOZMO_CORE_PLUGIN_URL . 'assets/admin.css',
                [],
                KOZMO_CORE_VERSION
            );
        }
    }

    /**
     * Add plugin action links.
     */
    public static function add_plugin_action_links(array $links): array {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            admin_url('admin.php?page=kozmo-core-settings'),
            esc_html__('Settings', 'kozmo-core-integration')
        );
        $api_key_link = sprintf(
            '<a href="%s" style="font-weight:600;">%s</a>',
            admin_url('admin.php?page=kozmo-core-keys'),
            esc_html__('Get API Key', 'kozmo-core-integration')
        );
        array_unshift($links, $api_key_link, $settings_link);
        return $links;
    }

    // ══════════════════════════════════════════════════════════════
    // RENDER: Dashboard
    // ══════════════════════════════════════════════════════════════

    /**
     * Render the main dashboard page.
     */
    public static function render_dashboard(): void {
        $settings   = get_option(KOZMO_CORE_SETTINGS_OPTION, []);
        $api_enabled = ($settings['api_enabled'] ?? 'yes') === 'yes';

        // Gather stats
        global $wpdb;
        $key_count    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_core_api_keys WHERE is_active = 1");
        $kozmo_core_posts = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_kozmo_core_imported_at'");
        $log_count    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_core_logs WHERE level IN ('error','critical')");
        $seo_plugins  = KOZMO_Core_API::detect_seo_plugins();

        ?>
        <div class="wrap kozmo-core-admin-wrap">
            <div class="kozmo-core-header">
                <h1>
                    <span class="kozmo-core-logo">K</span>
                    <?php esc_html_e('KOZMO Core WordPress Integration', 'kozmo-core-integration'); ?>
                </h1>
                <span class="kozmo-core-version">v<?php echo esc_html(KOZMO_CORE_VERSION); ?></span>
            </div>

            <div class="kozmo-core-status-bar <?php echo $api_enabled ? 'status-ok' : 'status-warning'; ?>">
                <span class="status-dot"></span>
                <?php echo $api_enabled
                    ? esc_html__('API Active — ready to receive content from KOZMO Core.', 'kozmo-core-integration')
                    : esc_html__('API Disabled — enable in Settings to receive content.', 'kozmo-core-integration'); ?>
            </div>

            <div class="kozmo-core-stats-grid">
                <div class="kozmo-core-stat-card">
                    <div class="stat-icon stat-icon-blue">
                        <span class="dashicons dashicons-rest-api"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($key_count); ?></div>
                        <div class="stat-label"><?php esc_html_e('Active API Keys', 'kozmo-core-integration'); ?></div>
                    </div>
                </div>

                <div class="kozmo-core-stat-card">
                    <div class="stat-icon stat-icon-green">
                        <span class="dashicons dashicons-admin-post"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($kozmo_core_posts); ?></div>
                        <div class="stat-label"><?php esc_html_e('Imported Posts', 'kozmo-core-integration'); ?></div>
                    </div>
                </div>

                <div class="kozmo-core-stat-card">
                    <div class="stat-icon <?php echo $log_count > 0 ? 'stat-icon-red' : 'stat-icon-gray'; ?>">
                        <span class="dashicons dashicons-warning"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($log_count); ?></div>
                        <div class="stat-label"><?php esc_html_e('Unresolved Errors', 'kozmo-core-integration'); ?></div>
                    </div>
                </div>

                <div class="kozmo-core-stat-card">
                    <div class="stat-icon stat-icon-purple">
                        <span class="dashicons dashicons-admin-plugins"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo count($seo_plugins); ?></div>
                        <div class="stat-label"><?php esc_html_e('SEO Plugins Detected', 'kozmo-core-integration'); ?></div>
                    </div>
                </div>
            </div>

            <div class="kozmo-core-quick-actions">
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-keys')); ?>" class="button button-primary">
                    <span class="dashicons dashicons-admin-network"></span>
                    <?php esc_html_e('Manage API Keys', 'kozmo-core-integration'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-settings')); ?>" class="button">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <?php esc_html_e('Plugin Settings', 'kozmo-core-integration'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-logs')); ?>" class="button">
                    <span class="dashicons dashicons-list-view"></span>
                    <?php esc_html_e('View Logs', 'kozmo-core-integration'); ?>
                </a>
                <button id="kozmo-core-test-connection" class="button">
                    <span class="dashicons dashicons-yes"></span>
                    <?php esc_html_e('Test Connection', 'kozmo-core-integration'); ?>
                </button>
            </div>

            <div class="kozmo-core-card">
                <h2><?php esc_html_e('How to Connect', 'kozmo-core-integration'); ?></h2>
                <ol class="kozmo-core-steps">
                    <li>
                        <strong><?php esc_html_e('Generate an API Key', 'kozmo-core-integration'); ?></strong>
                        <p><?php esc_html_e('Go to the API Keys page and create a new key. Copy it — you will need to enter it in the KOZMO Core dashboard.', 'kozmo-core-integration'); ?></p>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Enter Credentials in KOZMO Core', 'kozmo-core-integration'); ?></strong>
                        <p><?php esc_html_e('In your KOZMO Core dashboard, go to CMS Connections → Add WordPress connection. Enter:', 'kozmo-core-integration'); ?></p>
                        <ul class="kozmo-core-detail-list">
                            <li><code><?php echo esc_url(get_bloginfo('url')); ?>/wp-json/kozmo-core/v1</code></li>
                            <li><?php esc_html_e('Your API Key from step 1', 'kozmo-core-integration'); ?></li>
                        </ul>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Test the Connection', 'kozmo-core-integration'); ?></strong>
                        <p><?php esc_html_e('Click the "Test Connection" button above or test directly from your KOZMO Core dashboard. KOZMO Core will create a test post to verify integration.', 'kozmo-core-integration'); ?></p>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Start Publishing', 'kozmo-core-integration'); ?></strong>
                        <p><?php esc_html_e('Once connected, KOZMO Core can create, update, and publish articles directly to your WordPress site. Configure the default post status and other settings under Settings.', 'kozmo-core-integration'); ?></p>
                    </li>
                </ol>
            </div>

            <div class="kozmo-core-card">
                <h2><?php esc_html_e('API Endpoints', 'kozmo-core-integration'); ?></h2>
                <p><?php esc_html_e('KOZMO Core communicates with your site via the WordPress REST API. All endpoints require authentication with your API key.', 'kozmo-core-integration'); ?></p>
                <table class="widefat striped kozmo-core-endpoints-table">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Method', 'kozmo-core-integration'); ?></th>
                            <th><?php esc_html_e('Endpoint', 'kozmo-core-integration'); ?></th>
                            <th><?php esc_html_e('Description', 'kozmo-core-integration'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><code>GET</code></td><td><code>/kozmo-core/v1/status</code></td><td><?php esc_html_e('Health check and connection status', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/kozmo-core/v1/posts</code></td><td><?php esc_html_e('Create a new post', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>PUT</code></td><td><code>/kozmo-core/v1/posts/{id}</code></td><td><?php esc_html_e('Update an existing post', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>DELETE</code></td><td><code>/kozmo-core/v1/posts/{id}</code></td><td><?php esc_html_e('Delete a post', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/kozmo-core/v1/categories</code></td><td><?php esc_html_e('List available categories', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/kozmo-core/v1/tags</code></td><td><?php esc_html_e('List available tags', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/kozmo-core/v1/authors</code></td><td><?php esc_html_e('List available authors', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/kozmo-core/v1/media</code></td><td><?php esc_html_e('Upload media from URL', 'kozmo-core-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/kozmo-core/v1/webhook</code></td><td><?php esc_html_e('Receive webhook events from KOZMO Core', 'kozmo-core-integration'); ?></td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
        jQuery(document).ready(function($) {
            $('#kozmo-core-test-connection').on('click', function() {
                var btn = $(this);
                btn.prop('disabled', true).text('Testing...');

                $.ajax({
                    url: '<?php echo esc_js(admin_url('admin-ajax.php')); ?>',
                    method: 'POST',
                    data: {
                        action: 'kozmo_core_test_connection',
                        _ajax_nonce: '<?php echo esc_js(wp_create_nonce('kozmo_core_test_connection')); ?>'
                    },
                    success: function(response) {
                        if (response.success) {
                            alert('✅ Connection OK: API is reachable and responding.');
                        } else {
                            alert('❌ Connection failed: ' + (response.data.message || 'Unknown error'));
                        }
                    },
                    error: function() {
                        alert('❌ AJAX request failed — check your WordPress admin connection.');
                    },
                    complete: function() {
                        btn.prop('disabled', false).text('Test Connection');
                    }
                });
            });
        });
        </script>
        <?php
    }

    // ══════════════════════════════════════════════════════════════
    // RENDER: Settings
    // ══════════════════════════════════════════════════════════════

    /**
     * Render the settings page.
     */
    public static function render_settings(): void {
        $settings = get_option(KOZMO_CORE_SETTINGS_OPTION, []);
        ?>
        <div class="wrap kozmo-core-admin-wrap">
            <h1><?php esc_html_e('KOZMO Core - Settings', 'kozmo-core-integration'); ?></h1>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('kozmo_core_save_settings', 'kozmo_core_nonce'); ?>
                <input type="hidden" name="action" value="kozmo_core_save_settings">

                <div class="kozmo-core-card">
                    <h2><?php esc_html_e('General Settings', 'kozmo-core-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('API Status', 'kozmo-core-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="api_enabled" value="yes" <?php checked($settings['api_enabled'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Enable REST API endpoint', 'kozmo-core-integration'); ?>
                                </label>
                                <p class="description"><?php esc_html_e('Disable to temporarily stop receiving content from KOZMO Core.', 'kozmo-core-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Default Post Status', 'kozmo-core-integration'); ?></th>
                            <td>
                                <select name="default_status">
                                    <option value="draft" <?php selected($settings['default_status'] ?? 'draft', 'draft'); ?>><?php esc_html_e('Draft', 'kozmo-core-integration'); ?></option>
                                    <option value="pending" <?php selected($settings['default_status'] ?? 'draft', 'pending'); ?>><?php esc_html_e('Pending Review', 'kozmo-core-integration'); ?></option>
                                    <option value="publish" <?php selected($settings['default_status'] ?? 'draft', 'publish'); ?>><?php esc_html_e('Published', 'kozmo-core-integration'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Default status for new posts created by KOZMO Core. KOZMO Core can override this per-article.', 'kozmo-core-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Default Author', 'kozmo-core-integration'); ?></th>
                            <td>
                                <?php
                                wp_dropdown_users([
                                    'name'             => 'default_author',
                                    'selected'         => $settings['default_author'] ?? get_current_user_id(),
                                    'show_option_none' => false,
                                    'option_none_value' => 0,
                                ]);
                                ?>
                                <p class="description"><?php esc_html_e('Default author for posts created by KOZMO Core. Can be overridden per-article.', 'kozmo-core-integration'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="kozmo-core-card">
                    <h2><?php esc_html_e('Content Import Settings', 'kozmo-core-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Auto-Import Tags', 'kozmo-core-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="auto_import_tags" value="yes" <?php checked($settings['auto_import_tags'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Automatically create and assign tags from KOZMO Core articles', 'kozmo-core-integration'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Auto-Import Categories', 'kozmo-core-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="auto_import_cats" value="yes" <?php checked($settings['auto_import_cats'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Automatically create and assign categories from KOZMO Core articles', 'kozmo-core-integration'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="kozmo-core-card">
                    <h2><?php esc_html_e('Webhook Configuration', 'kozmo-core-integration'); ?></h2>
                    <p><?php esc_html_e('Webhooks allow KOZMO Core to send real-time content updates to your site. To use webhooks, configure a webhook endpoint in your KOZMO Core dashboard with the URL below.', 'kozmo-core-integration'); ?></p>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Webhook URL', 'kozmo-core-integration'); ?></th>
                            <td>
                                <code><?php echo esc_url(rest_url(KOZMO_CORE_API_NAMESPACE . '/webhook')); ?></code>
                                <button type="button" class="button button-small" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim())"><?php esc_html_e('Copy', 'kozmo-core-integration'); ?></button>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Webhook Secret', 'kozmo-core-integration'); ?></th>
                            <td>
                                <input type="text" name="webhook_secret" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Optional. If set, KOZMO Core will sign webhook payloads with this secret for verification. Generate a random string (minimum 16 characters).', 'kozmo-core-integration'); ?></p>
                                <button type="button" class="button button-small" onclick="if(confirm('Generate a new secret?')){this.previousElementSibling.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}"><?php esc_html_e('Generate Secret', 'kozmo-core-integration'); ?></button>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="kozmo-core-card">
                    <h2><?php esc_html_e('Logging', 'kozmo-core-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Log Level', 'kozmo-core-integration'); ?></th>
                            <td>
                                <select name="log_level">
                                    <option value="debug" <?php selected($settings['log_level'] ?? 'error', 'debug'); ?>><?php esc_html_e('Debug (all messages)', 'kozmo-core-integration'); ?></option>
                                    <option value="info" <?php selected($settings['log_level'] ?? 'error', 'info'); ?>><?php esc_html_e('Info', 'kozmo-core-integration'); ?></option>
                                    <option value="warning" <?php selected($settings['log_level'] ?? 'error', 'warning'); ?>><?php esc_html_e('Warning', 'kozmo-core-integration'); ?></option>
                                    <option value="error" <?php selected($settings['log_level'] ?? 'error', 'error'); ?>><?php esc_html_e('Errors only', 'kozmo-core-integration'); ?></option>
                                    <option value="critical" <?php selected($settings['log_level'] ?? 'error', 'critical'); ?>><?php esc_html_e('Critical only', 'kozmo-core-integration'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Minimum log level to record. Use "Debug" during initial setup, then switch to "Error" for production.', 'kozmo-core-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Debug Mode', 'kozmo-core-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="debug_mode" value="yes" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?> />
                                    <?php esc_html_e('Enable verbose debugging (includes request/response logging)', 'kozmo-core-integration'); ?>
                                </label>
                                <p class="description"><?php esc_html_e('Warning: generates a lot of log entries. Use temporarily for troubleshooting only.', 'kozmo-core-integration'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php submit_button(__('Save Settings', 'kozmo-core-integration')); ?>
            </form>
        </div>
        <?php
    }

    // ══════════════════════════════════════════════════════════════
    // RENDER: API Keys
    // ══════════════════════════════════════════════════════════════

    /**
     * Render the API keys management page.
     */
    public static function render_api_keys(): void {
        $keys = KOZMO_Core_Auth::list_keys();
        ?>
        <div class="wrap kozmo-core-admin-wrap">
            <h1><?php esc_html_e('KOZMO Core - API Keys', 'kozmo-core-integration'); ?></h1>

            <div class="kozmo-core-card">
                <h2><?php esc_html_e('Generate New API Key', 'kozmo-core-integration'); ?></h2>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
                    <?php wp_nonce_field('kozmo_core_generate_key', 'kozmo_core_nonce'); ?>
                    <input type="hidden" name="action" value="kozmo_core_generate_key">

                    <div>
                        <label for="key_label" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Label', 'kozmo-core-integration'); ?>
                        </label>
                        <input type="text" id="key_label" name="label" value="" placeholder="e.g., KOZMO Core Production" class="regular-text" />
                    </div>

                    <div>
                        <label for="key_permissions" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Permissions', 'kozmo-core-integration'); ?>
                        </label>
                        <select id="key_permissions" name="permissions">
                            <option value="read,write"><?php esc_html_e('Read & Write (full access)', 'kozmo-core-integration'); ?></option>
                            <option value="read"><?php esc_html_e('Read Only', 'kozmo-core-integration'); ?></option>
                            <option value="write"><?php esc_html_e('Write Only', 'kozmo-core-integration'); ?></option>
                        </select>
                    </div>

                    <div>
                        <label for="key_expiry" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Expires', 'kozmo-core-integration'); ?>
                        </label>
                        <select id="key_expiry" name="expires_in">
                            <option value="0"><?php esc_html_e('Never', 'kozmo-core-integration'); ?></option>
                            <option value="30"><?php esc_html_e('30 days', 'kozmo-core-integration'); ?></option>
                            <option value="90"><?php esc_html_e('90 days', 'kozmo-core-integration'); ?></option>
                            <option value="180"><?php esc_html_e('180 days', 'kozmo-core-integration'); ?></option>
                            <option value="365"><?php esc_html_e('1 year', 'kozmo-core-integration'); ?></option>
                        </select>
                    </div>

                    <?php submit_button(__('Generate Key', 'kozmo-core-integration'), 'primary', '', false); ?>
                </form>

                <?php if (isset($_GET['new_key'])): ?>
                    <div class="kozmo-core-notice kozmo-core-notice-success">
                        <p><strong><?php esc_html_e('New API Key Generated!', 'kozmo-core-integration'); ?></strong></p>
                        <p><?php esc_html_e('Copy this key now — it will not be shown again.', 'kozmo-core-integration'); ?></p>
                        <div class="kozmo-core-key-display">
                            <code><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['new_key']))); ?></code>
                            <button type="button" class="button button-small" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!'">
                                <?php esc_html_e('Copy', 'kozmo-core-integration'); ?>
                            </button>
                        </div>
                    </div>
                <?php endif; ?>
            </div>

            <div class="kozmo-core-card">
                <h2><?php esc_html_e('Existing API Keys', 'kozmo-core-integration'); ?></h2>
                <?php if (empty($keys)): ?>
                    <p><?php esc_html_e('No API keys generated yet.', 'kozmo-core-integration'); ?></p>
                <?php else: ?>
                    <table class="widefat striped">
                        <thead>
                            <tr>
                                <th><?php esc_html_e('Label', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('API Key', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Permissions', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Status', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Last Used', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Expires', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Created', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Actions', 'kozmo-core-integration'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($keys as $key): ?>
                                <tr>
                                    <td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                                    <td><code><?php echo esc_html($key['masked_key'] ?? __('Stored securely', 'kozmo-core-integration')); ?></code></td>
                                    <td><?php echo esc_html($key['permissions']); ?></td>
                                    <td>
                                        <span class="kozmo-core-status-badge <?php echo $key['is_active'] ? 'badge-active' : 'badge-inactive'; ?>">
                                            <?php echo $key['is_active'] ? esc_html__('Active', 'kozmo-core-integration') : esc_html__('Revoked', 'kozmo-core-integration'); ?>
                                        </span>
                                    </td>
                                    <td><?php echo $key['last_used_at'] ? esc_html($key['last_used_at']) : '—'; ?></td>
                                    <td>
                                        <?php
                                        if (!$key['expires_at']) {
                                            esc_html_e('Never', 'kozmo-core-integration');
                                        } else {
                                            $expires = strtotime($key['expires_at']);
                                            echo esc_html(wp_date(get_option('date_format'), $expires));
                                            if ($expires < time()) {
                                                echo ' <span class="kozmo-core-status-badge badge-inactive">Expired</span>';
                                            }
                                        }
                                        ?>
                                    </td>
                                    <td><?php echo esc_html(wp_date(get_option('date_format'), strtotime($key['created_at']))); ?></td>
                                    <td>
                                        <?php if ($key['is_active']): ?>
                                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                                <?php wp_nonce_field('kozmo_core_revoke_key', 'kozmo_core_nonce'); ?>
                                                <input type="hidden" name="action" value="kozmo_core_revoke_key" />
                                                <input type="hidden" name="key_id" value="<?php echo esc_attr($key['id']); ?>" />
                                                <button type="submit" class="button button-small button-link-delete" onclick="return confirm('<?php esc_attr_e('Revoke this API key? This cannot be undone.', 'kozmo-core-integration'); ?>');">
                                                    <?php esc_html_e('Revoke', 'kozmo-core-integration'); ?>
                                                </button>
                                            </form>
                                        <?php else: ?>
                                            <span class="kozmo-core-muted">—</span>
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

    // ══════════════════════════════════════════════════════════════
    // RENDER: Logs
    // ══════════════════════════════════════════════════════════════

    /**
     * Render the logs viewer page.
     */
    public static function render_logs(): void {
        $level = isset($_GET['level']) ? sanitize_text_field(wp_unslash($_GET['level'])) : '';
        $logs  = KOZMO_Core_Logger::get_logs(200, $level);

        ?>
        <div class="wrap kozmo-core-admin-wrap">
            <h1><?php esc_html_e('KOZMO Core - Activity Logs', 'kozmo-core-integration'); ?></h1>

            <div class="kozmo-core-card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-logs')); ?>" class="button button-small <?php echo empty($level) ? 'button-primary' : ''; ?>"><?php esc_html_e('All', 'kozmo-core-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-logs&level=error')); ?>" class="button button-small <?php echo $level === 'error' ? 'button-primary' : ''; ?>"><?php esc_html_e('Errors', 'kozmo-core-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-logs&level=warning')); ?>" class="button button-small <?php echo $level === 'warning' ? 'button-primary' : ''; ?>"><?php esc_html_e('Warnings', 'kozmo-core-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-core-logs&level=info')); ?>" class="button button-small <?php echo $level === 'info' ? 'button-primary' : ''; ?>"><?php esc_html_e('Info', 'kozmo-core-integration'); ?></a>
                    </div>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('kozmo_core_clear_logs', 'kozmo_core_nonce'); ?>
                        <input type="hidden" name="action" value="kozmo_core_clear_logs" />
                        <button type="submit" class="button button-small button-link-delete" onclick="return confirm('<?php esc_attr_e('Clear all logs? This cannot be undone.', 'kozmo-core-integration'); ?>');">
                            <?php esc_html_e('Clear All Logs', 'kozmo-core-integration'); ?>
                        </button>
                    </form>
                </div>
            </div>

            <?php if (empty($logs)): ?>
                <div class="kozmo-core-card">
                    <p><?php esc_html_e('No log entries found.', 'kozmo-core-integration'); ?></p>
                </div>
            <?php else: ?>
                <div class="kozmo-core-card" style="padding:0; overflow-x:auto;">
                    <table class="widefat striped" style="margin:0;">
                        <thead>
                            <tr>
                                <th style="width:100px;"><?php esc_html_e('Level', 'kozmo-core-integration'); ?></th>
                                <th><?php esc_html_e('Message', 'kozmo-core-integration'); ?></th>
                                <th style="width:200px;"><?php esc_html_e('Context', 'kozmo-core-integration'); ?></th>
                                <th style="width:180px;"><?php esc_html_e('Time', 'kozmo-core-integration'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($logs as $log): ?>
                                <tr class="kozmo-core-log-row log-level-<?php echo esc_attr($log['level']); ?>">
                                    <td>
                                        <span class="kozmo-core-log-level level-<?php echo esc_attr($log['level']); ?>">
                                            <?php echo esc_html(strtoupper($log['level'])); ?>
                                        </span>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                    <td>
                                        <?php if (!empty($log['context'])): ?>
                                            <button type="button" class="button button-small toggle-context" onclick="var el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none';">
                                                <?php esc_html_e('Show', 'kozmo-core-integration'); ?>
                                            </button>
                                            <pre style="display:none; font-size:11px; max-height:150px; overflow:auto; background:#f0f0f1; padding:8px; border-radius:4px; margin-top:4px;"><?php echo esc_html(json_encode(json_decode($log['context'], true), JSON_PRETTY_PRINT)); ?></pre>
                                        <?php else: ?>
                                            <span class="kozmo-core-muted">—</span>
                                        <?php endif; ?>
                                    </td>
                                    <td style="white-space:nowrap;">
                                        <?php
                                        echo esc_html(
                                            wp_date(
                                                get_option('date_format') . ' ' . get_option('time_format'),
                                                strtotime($log['created_at'])
                                            )
                                        );
                                        ?>
                                    </td>
                                </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            <?php endif; ?>
        </div>
        <?php
    }

    // ══════════════════════════════════════════════════════════════
    // FORM HANDLERS
    // ══════════════════════════════════════════════════════════════

    /**
     * Handle API key generation form submission.
     */
    public static function handle_generate_key(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'kozmo-core-integration'));
        }
        check_admin_referer('kozmo_core_generate_key', 'kozmo_core_nonce');

        $label       = sanitize_text_field(wp_unslash($_POST['label'] ?? ''));
        $permissions = sanitize_text_field(wp_unslash($_POST['permissions'] ?? 'read,write'));
        $expires_in  = absint(wp_unslash($_POST['expires_in'] ?? 0));

        $result = KOZMO_Core_Auth::generate_key($label, $permissions, get_current_user_id(), $expires_in);

        $redirect = admin_url('admin.php?page=kozmo-core-keys');
        if ($result['success']) {
            $redirect = add_query_arg('new_key', $result['api_key'], $redirect);
            set_transient('kozmo_core_notice', ['type' => 'success', 'message' => $result['message']], 30);
        } else {
            set_transient('kozmo_core_notice', ['type' => 'error', 'message' => $result['message']], 30);
        }

        wp_safe_redirect($redirect);
        exit;
    }

    /**
     * Handle API key revocation form submission.
     */
    public static function handle_revoke_key(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'kozmo-core-integration'));
        }
        check_admin_referer('kozmo_core_revoke_key', 'kozmo_core_nonce');

        $key_id = absint(wp_unslash($_POST['key_id'] ?? 0));

        if ($key_id > 0) {
            KOZMO_Core_Auth::revoke_key_by_id($key_id);
        }

        wp_safe_redirect(admin_url('admin.php?page=kozmo-core-keys'));
        exit;
    }

    /**
     * Handle settings save form submission.
     */
    public static function handle_save_settings(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'kozmo-core-integration'));
        }
        check_admin_referer('kozmo_core_save_settings', 'kozmo_core_nonce');

        $settings = [
            'api_enabled'      => sanitize_text_field(wp_unslash($_POST['api_enabled'] ?? 'no')),
            'log_level'        => sanitize_text_field(wp_unslash($_POST['log_level'] ?? 'error')),
            'default_status'   => sanitize_text_field(wp_unslash($_POST['default_status'] ?? 'draft')),
            'default_author'   => absint(wp_unslash($_POST['default_author'] ?? get_current_user_id())),
            'auto_import_tags' => sanitize_text_field(wp_unslash($_POST['auto_import_tags'] ?? 'no')),
            'auto_import_cats' => sanitize_text_field(wp_unslash($_POST['auto_import_cats'] ?? 'no')),
            'webhook_secret'   => sanitize_text_field(wp_unslash($_POST['webhook_secret'] ?? '')),
            'debug_mode'       => sanitize_text_field(wp_unslash($_POST['debug_mode'] ?? 'no')),
        ];

        // Validate webhook secret length
        if (!empty($settings['webhook_secret']) && strlen($settings['webhook_secret']) < 16) {
            $settings['webhook_secret'] = get_option(KOZMO_CORE_SETTINGS_OPTION)['webhook_secret'] ?? '';
            set_transient('kozmo_core_notice', [
                'type'    => 'warning',
                'message' => __('Webhook secret must be at least 16 characters. Value was not saved.', 'kozmo-core-integration'),
            ], 30);
        }

        update_option(KOZMO_CORE_SETTINGS_OPTION, $settings);

        set_transient('kozmo_core_notice', [
            'type'    => 'success',
            'message' => __('Settings saved.', 'kozmo-core-integration'),
        ], 30);

        wp_safe_redirect(admin_url('admin.php?page=kozmo-core-settings'));
        exit;
    }

    /**
     * Handle clear logs action.
     */
    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'kozmo-core-integration'));
        }
        check_admin_referer('kozmo_core_clear_logs', 'kozmo_core_nonce');

        KOZMO_Core_Logger::clear_logs();

        wp_safe_redirect(admin_url('admin.php?page=kozmo-core-logs'));
        exit;
    }

    /**
     * AJAX handler for testing API connection.
     * Uses an active API key from the database to authenticate the test request.
     */
    public static function ajax_test_connection(): void {
        check_ajax_referer('kozmo_core_test_connection');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized.']);
        }

        global $wpdb;

        // Get an active API key from the database
        $api_key = get_option('kozmo_core_initial_api_key', '');
        if (empty($api_key)) {
            $api_key = $wpdb->get_var(
                "SELECT api_key FROM {$wpdb->prefix}kozmo_core_api_keys WHERE is_active = 1 AND api_key IS NOT NULL AND api_key <> '' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1"
            );
        }

        if (empty($api_key)) {
            wp_send_json_error([
                'message' => __('No active API key found. Generate one first on the API Keys page.', 'kozmo-core-integration'),
            ]);
            return;
        }

        // Test the KOZMO Core status endpoint with a valid API key
        $response = wp_remote_get(rest_url(KOZMO_CORE_API_NAMESPACE . '/status'), [
            'timeout' => 10,
            'headers' => [
                'X-KOZMO-Core-Key' => $api_key,
            ],
        ]);

        if (is_wp_error($response)) {
            wp_send_json_error(['message' => $response->get_error_message()]);
            return;
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = json_decode(wp_remote_retrieve_body($response), true);

        if ($status_code === 200 && ($body['success'] ?? false)) {
            wp_send_json_success([
                'status_code' => $status_code,
                'status'      => $body['data']['status'] ?? 'ok',
                'site_name'   => $body['data']['site_name'] ?? '',
                'version'     => $body['data']['plugin_version'] ?? '',
            ]);
        } else {
            wp_send_json_error([
                'status_code' => $status_code,
                'message'     => $body['message'] ?? __('Connection test failed. Check that the REST API is accessible.', 'kozmo-core-integration'),
            ]);
        }
    }
}
