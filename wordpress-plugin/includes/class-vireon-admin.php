<?php
/**
 * Vireon Admin Settings Page
 *
 * Provides the WordPress admin dashboard UI for managing the Vireon integration:
 * - API key management (generate, revoke, list)
 * - Plugin settings (log level, default status, auto-import options)
 * - Log viewer for debugging
 * - System status / health check
 * - Quick start guide
 *
 * @package Vireon_Integration
 */

if (!defined('ABSPATH')) {
    exit;
}

class Vireon_Admin {

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
        add_action('admin_post_vireon_generate_key', [self::class, 'handle_generate_key']);
        add_action('admin_post_vireon_revoke_key', [self::class, 'handle_revoke_key']);
        add_action('admin_post_vireon_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_vireon_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('wp_ajax_vireon_test_connection', [self::class, 'ajax_test_connection']);
        add_filter('plugin_action_links_' . plugin_basename(VIREON_PLUGIN_FILE), [self::class, 'add_plugin_action_links']);
    }

    /**
     * Add admin menu items.
     */
    public static function add_admin_menu(): void {
        self::$hook = add_menu_page(
            __('Vireon Integration', 'vireon-integration'),
            __('Vireon', 'vireon-integration'),
            'manage_options',
            'vireon',
            [self::class, 'render_dashboard'],
            'dashicons-update',
            30
        );

        add_submenu_page(
            'vireon',
            __('Settings', 'vireon-integration'),
            __('Settings', 'vireon-integration'),
            'manage_options',
            'vireon-settings',
            [self::class, 'render_settings']
        );

        add_submenu_page(
            'vireon',
            __('API Keys', 'vireon-integration'),
            __('API Keys', 'vireon-integration'),
            'manage_options',
            'vireon-keys',
            [self::class, 'render_api_keys']
        );

        add_submenu_page(
            'vireon',
            __('Logs', 'vireon-integration'),
            __('Logs', 'vireon-integration'),
            'manage_options',
            'vireon-logs',
            [self::class, 'render_logs']
        );
    }

    /**
     * Enqueue admin CSS.
     */
    public static function enqueue_assets(string $hook): void {
        if (str_starts_with($hook, 'toplevel_page_vireon') || str_starts_with($hook, 'vireon_page_vireon')) {
            wp_enqueue_style(
                'vireon-admin',
                VIREON_PLUGIN_URL . 'assets/admin.css',
                [],
                VIREON_VERSION
            );
        }
    }

    /**
     * Add plugin action links.
     */
    public static function add_plugin_action_links(array $links): array {
        $settings_link = sprintf(
            '<a href="%s">%s</a>',
            admin_url('admin.php?page=vireon-settings'),
            esc_html__('Settings', 'vireon-integration')
        );
        $api_key_link = sprintf(
            '<a href="%s" style="font-weight:600;">%s</a>',
            admin_url('admin.php?page=vireon-keys'),
            esc_html__('Get API Key', 'vireon-integration')
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
        $settings   = get_option(VIREON_SETTINGS_OPTION, []);
        $api_enabled = ($settings['api_enabled'] ?? 'yes') === 'yes';

        // Gather stats
        global $wpdb;
        $key_count    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}vireon_api_keys WHERE is_active = 1");
        $vireon_posts = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->postmeta} WHERE meta_key = '_vireon_imported_at'");
        $log_count    = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}vireon_logs WHERE level IN ('error','critical')");
        $seo_plugins  = Vireon_API::detect_seo_plugins();

        ?>
        <div class="wrap vireon-admin-wrap">
            <div class="vireon-header">
                <h1>
                    <span class="vireon-logo">V</span>
                    <?php esc_html_e('Vireon WordPress Integration', 'vireon-integration'); ?>
                </h1>
                <span class="vireon-version">v<?php echo esc_html(VIREON_VERSION); ?></span>
            </div>

            <div class="vireon-status-bar <?php echo $api_enabled ? 'status-ok' : 'status-warning'; ?>">
                <span class="status-dot"></span>
                <?php echo $api_enabled
                    ? esc_html__('API Active — ready to receive content from Vireon.', 'vireon-integration')
                    : esc_html__('API Disabled — enable in Settings to receive content.', 'vireon-integration'); ?>
            </div>

            <div class="vireon-stats-grid">
                <div class="vireon-stat-card">
                    <div class="stat-icon stat-icon-blue">
                        <span class="dashicons dashicons-rest-api"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($key_count); ?></div>
                        <div class="stat-label"><?php esc_html_e('Active API Keys', 'vireon-integration'); ?></div>
                    </div>
                </div>

                <div class="vireon-stat-card">
                    <div class="stat-icon stat-icon-green">
                        <span class="dashicons dashicons-admin-post"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($vireon_posts); ?></div>
                        <div class="stat-label"><?php esc_html_e('Imported Posts', 'vireon-integration'); ?></div>
                    </div>
                </div>

                <div class="vireon-stat-card">
                    <div class="stat-icon <?php echo $log_count > 0 ? 'stat-icon-red' : 'stat-icon-gray'; ?>">
                        <span class="dashicons dashicons-warning"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo esc_html($log_count); ?></div>
                        <div class="stat-label"><?php esc_html_e('Unresolved Errors', 'vireon-integration'); ?></div>
                    </div>
                </div>

                <div class="vireon-stat-card">
                    <div class="stat-icon stat-icon-purple">
                        <span class="dashicons dashicons-admin-plugins"></span>
                    </div>
                    <div class="stat-body">
                        <div class="stat-value"><?php echo count($seo_plugins); ?></div>
                        <div class="stat-label"><?php esc_html_e('SEO Plugins Detected', 'vireon-integration'); ?></div>
                    </div>
                </div>
            </div>

            <div class="vireon-quick-actions">
                <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-keys')); ?>" class="button button-primary">
                    <span class="dashicons dashicons-admin-network"></span>
                    <?php esc_html_e('Manage API Keys', 'vireon-integration'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-settings')); ?>" class="button">
                    <span class="dashicons dashicons-admin-settings"></span>
                    <?php esc_html_e('Plugin Settings', 'vireon-integration'); ?>
                </a>
                <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-logs')); ?>" class="button">
                    <span class="dashicons dashicons-list-view"></span>
                    <?php esc_html_e('View Logs', 'vireon-integration'); ?>
                </a>
                <button id="vireon-test-connection" class="button">
                    <span class="dashicons dashicons-yes"></span>
                    <?php esc_html_e('Test Connection', 'vireon-integration'); ?>
                </button>
            </div>

            <div class="vireon-card">
                <h2><?php esc_html_e('How to Connect', 'vireon-integration'); ?></h2>
                <ol class="vireon-steps">
                    <li>
                        <strong><?php esc_html_e('Generate an API Key', 'vireon-integration'); ?></strong>
                        <p><?php esc_html_e('Go to the API Keys page and create a new key. Copy it — you will need to enter it in the Vireon dashboard.', 'vireon-integration'); ?></p>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Enter Credentials in Vireon', 'vireon-integration'); ?></strong>
                        <p><?php esc_html_e('In your Vireon dashboard, go to CMS Connections → Add WordPress connection. Enter:', 'vireon-integration'); ?></p>
                        <ul class="vireon-detail-list">
                            <li><code><?php echo esc_url(get_bloginfo('url')); ?>/wp-json/vireon/v1</code></li>
                            <li><?php esc_html_e('Your API Key from step 1', 'vireon-integration'); ?></li>
                        </ul>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Test the Connection', 'vireon-integration'); ?></strong>
                        <p><?php esc_html_e('Click the "Test Connection" button above or test directly from your Vireon dashboard. Vireon will create a test post to verify integration.', 'vireon-integration'); ?></p>
                    </li>
                    <li>
                        <strong><?php esc_html_e('Start Publishing', 'vireon-integration'); ?></strong>
                        <p><?php esc_html_e('Once connected, Vireon can create, update, and publish articles directly to your WordPress site. Configure the default post status and other settings under Settings.', 'vireon-integration'); ?></p>
                    </li>
                </ol>
            </div>

            <div class="vireon-card">
                <h2><?php esc_html_e('API Endpoints', 'vireon-integration'); ?></h2>
                <p><?php esc_html_e('Vireon communicates with your site via the WordPress REST API. All endpoints require authentication with your API key.', 'vireon-integration'); ?></p>
                <table class="widefat striped vireon-endpoints-table">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Method', 'vireon-integration'); ?></th>
                            <th><?php esc_html_e('Endpoint', 'vireon-integration'); ?></th>
                            <th><?php esc_html_e('Description', 'vireon-integration'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td><code>GET</code></td><td><code>/vireon/v1/status</code></td><td><?php esc_html_e('Health check and connection status', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/vireon/v1/posts</code></td><td><?php esc_html_e('Create a new post', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>PUT</code></td><td><code>/vireon/v1/posts/{id}</code></td><td><?php esc_html_e('Update an existing post', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>DELETE</code></td><td><code>/vireon/v1/posts/{id}</code></td><td><?php esc_html_e('Delete a post', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/vireon/v1/categories</code></td><td><?php esc_html_e('List available categories', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/vireon/v1/tags</code></td><td><?php esc_html_e('List available tags', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>GET</code></td><td><code>/vireon/v1/authors</code></td><td><?php esc_html_e('List available authors', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/vireon/v1/media</code></td><td><?php esc_html_e('Upload media from URL', 'vireon-integration'); ?></td></tr>
                        <tr><td><code>POST</code></td><td><code>/vireon/v1/webhook</code></td><td><?php esc_html_e('Receive webhook events from Vireon', 'vireon-integration'); ?></td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <script>
        jQuery(document).ready(function($) {
            $('#vireon-test-connection').on('click', function() {
                var btn = $(this);
                btn.prop('disabled', true).text('Testing...');

                $.ajax({
                    url: '<?php echo esc_js(admin_url('admin-ajax.php')); ?>',
                    method: 'POST',
                    data: {
                        action: 'vireon_test_connection',
                        _ajax_nonce: '<?php echo esc_js(wp_create_nonce('vireon_test_connection')); ?>'
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
        $settings = get_option(VIREON_SETTINGS_OPTION, []);
        ?>
        <div class="wrap vireon-admin-wrap">
            <h1><?php esc_html_e('Vireon - Settings', 'vireon-integration'); ?></h1>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('vireon_save_settings', 'vireon_nonce'); ?>
                <input type="hidden" name="action" value="vireon_save_settings">

                <div class="vireon-card">
                    <h2><?php esc_html_e('General Settings', 'vireon-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('API Status', 'vireon-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="api_enabled" value="yes" <?php checked($settings['api_enabled'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Enable REST API endpoint', 'vireon-integration'); ?>
                                </label>
                                <p class="description"><?php esc_html_e('Disable to temporarily stop receiving content from Vireon.', 'vireon-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Default Post Status', 'vireon-integration'); ?></th>
                            <td>
                                <select name="default_status">
                                    <option value="draft" <?php selected($settings['default_status'] ?? 'draft', 'draft'); ?>><?php esc_html_e('Draft', 'vireon-integration'); ?></option>
                                    <option value="pending" <?php selected($settings['default_status'] ?? 'draft', 'pending'); ?>><?php esc_html_e('Pending Review', 'vireon-integration'); ?></option>
                                    <option value="publish" <?php selected($settings['default_status'] ?? 'draft', 'publish'); ?>><?php esc_html_e('Published', 'vireon-integration'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Default status for new posts created by Vireon. Vireon can override this per-article.', 'vireon-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Default Author', 'vireon-integration'); ?></th>
                            <td>
                                <?php
                                wp_dropdown_users([
                                    'name'             => 'default_author',
                                    'selected'         => $settings['default_author'] ?? get_current_user_id(),
                                    'show_option_none' => false,
                                    'option_none_value' => 0,
                                ]);
                                ?>
                                <p class="description"><?php esc_html_e('Default author for posts created by Vireon. Can be overridden per-article.', 'vireon-integration'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="vireon-card">
                    <h2><?php esc_html_e('Content Import Settings', 'vireon-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Auto-Import Tags', 'vireon-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="auto_import_tags" value="yes" <?php checked($settings['auto_import_tags'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Automatically create and assign tags from Vireon articles', 'vireon-integration'); ?>
                                </label>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Auto-Import Categories', 'vireon-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="auto_import_cats" value="yes" <?php checked($settings['auto_import_cats'] ?? 'yes', 'yes'); ?> />
                                    <?php esc_html_e('Automatically create and assign categories from Vireon articles', 'vireon-integration'); ?>
                                </label>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="vireon-card">
                    <h2><?php esc_html_e('Webhook Configuration', 'vireon-integration'); ?></h2>
                    <p><?php esc_html_e('Webhooks allow Vireon to send real-time content updates to your site. To use webhooks, configure a webhook endpoint in your Vireon dashboard with the URL below.', 'vireon-integration'); ?></p>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Webhook URL', 'vireon-integration'); ?></th>
                            <td>
                                <code><?php echo esc_url(rest_url(VIREON_API_NAMESPACE . '/webhook')); ?></code>
                                <button type="button" class="button button-small" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim())"><?php esc_html_e('Copy', 'vireon-integration'); ?></button>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Webhook Secret', 'vireon-integration'); ?></th>
                            <td>
                                <input type="text" name="webhook_secret" value="<?php echo esc_attr($settings['webhook_secret'] ?? ''); ?>" class="regular-text" />
                                <p class="description"><?php esc_html_e('Optional. If set, Vireon will sign webhook payloads with this secret for verification. Generate a random string (minimum 16 characters).', 'vireon-integration'); ?></p>
                                <button type="button" class="button button-small" onclick="if(confirm('Generate a new secret?')){this.previousElementSibling.value=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}"><?php esc_html_e('Generate Secret', 'vireon-integration'); ?></button>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="vireon-card">
                    <h2><?php esc_html_e('Logging', 'vireon-integration'); ?></h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row"><?php esc_html_e('Log Level', 'vireon-integration'); ?></th>
                            <td>
                                <select name="log_level">
                                    <option value="debug" <?php selected($settings['log_level'] ?? 'error', 'debug'); ?>><?php esc_html_e('Debug (all messages)', 'vireon-integration'); ?></option>
                                    <option value="info" <?php selected($settings['log_level'] ?? 'error', 'info'); ?>><?php esc_html_e('Info', 'vireon-integration'); ?></option>
                                    <option value="warning" <?php selected($settings['log_level'] ?? 'error', 'warning'); ?>><?php esc_html_e('Warning', 'vireon-integration'); ?></option>
                                    <option value="error" <?php selected($settings['log_level'] ?? 'error', 'error'); ?>><?php esc_html_e('Errors only', 'vireon-integration'); ?></option>
                                    <option value="critical" <?php selected($settings['log_level'] ?? 'error', 'critical'); ?>><?php esc_html_e('Critical only', 'vireon-integration'); ?></option>
                                </select>
                                <p class="description"><?php esc_html_e('Minimum log level to record. Use "Debug" during initial setup, then switch to "Error" for production.', 'vireon-integration'); ?></p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row"><?php esc_html_e('Debug Mode', 'vireon-integration'); ?></th>
                            <td>
                                <label>
                                    <input type="checkbox" name="debug_mode" value="yes" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?> />
                                    <?php esc_html_e('Enable verbose debugging (includes request/response logging)', 'vireon-integration'); ?>
                                </label>
                                <p class="description"><?php esc_html_e('Warning: generates a lot of log entries. Use temporarily for troubleshooting only.', 'vireon-integration'); ?></p>
                            </td>
                        </tr>
                    </table>
                </div>

                <?php submit_button(__('Save Settings', 'vireon-integration')); ?>
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
        $keys = Vireon_Auth::list_keys();
        ?>
        <div class="wrap vireon-admin-wrap">
            <h1><?php esc_html_e('Vireon - API Keys', 'vireon-integration'); ?></h1>

            <div class="vireon-card">
                <h2><?php esc_html_e('Generate New API Key', 'vireon-integration'); ?></h2>
                <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:flex; gap:12px; align-items:flex-end; flex-wrap:wrap;">
                    <?php wp_nonce_field('vireon_generate_key', 'vireon_nonce'); ?>
                    <input type="hidden" name="action" value="vireon_generate_key">

                    <div>
                        <label for="key_label" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Label', 'vireon-integration'); ?>
                        </label>
                        <input type="text" id="key_label" name="label" value="" placeholder="e.g., Vireon Production" class="regular-text" />
                    </div>

                    <div>
                        <label for="key_permissions" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Permissions', 'vireon-integration'); ?>
                        </label>
                        <select id="key_permissions" name="permissions">
                            <option value="read,write"><?php esc_html_e('Read & Write (full access)', 'vireon-integration'); ?></option>
                            <option value="read"><?php esc_html_e('Read Only', 'vireon-integration'); ?></option>
                            <option value="write"><?php esc_html_e('Write Only', 'vireon-integration'); ?></option>
                        </select>
                    </div>

                    <div>
                        <label for="key_expiry" style="display:block; margin-bottom:4px; font-weight:600;">
                            <?php esc_html_e('Expires', 'vireon-integration'); ?>
                        </label>
                        <select id="key_expiry" name="expires_in">
                            <option value="0"><?php esc_html_e('Never', 'vireon-integration'); ?></option>
                            <option value="30"><?php esc_html_e('30 days', 'vireon-integration'); ?></option>
                            <option value="90"><?php esc_html_e('90 days', 'vireon-integration'); ?></option>
                            <option value="180"><?php esc_html_e('180 days', 'vireon-integration'); ?></option>
                            <option value="365"><?php esc_html_e('1 year', 'vireon-integration'); ?></option>
                        </select>
                    </div>

                    <?php submit_button(__('Generate Key', 'vireon-integration'), 'primary', '', false); ?>
                </form>

                <?php if (isset($_GET['new_key'])): ?>
                    <div class="vireon-notice vireon-notice-success">
                        <p><strong><?php esc_html_e('New API Key Generated!', 'vireon-integration'); ?></strong></p>
                        <p><?php esc_html_e('Copy this key now — it will not be shown again.', 'vireon-integration'); ?></p>
                        <div class="vireon-key-display">
                            <code><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['new_key']))); ?></code>
                            <button type="button" class="button button-small" onclick="navigator.clipboard.writeText(this.previousElementSibling.textContent.trim());this.textContent='Copied!'">
                                <?php esc_html_e('Copy', 'vireon-integration'); ?>
                            </button>
                        </div>
                    </div>
                <?php endif; ?>
            </div>

            <div class="vireon-card">
                <h2><?php esc_html_e('Existing API Keys', 'vireon-integration'); ?></h2>
                <?php if (empty($keys)): ?>
                    <p><?php esc_html_e('No API keys generated yet.', 'vireon-integration'); ?></p>
                <?php else: ?>
                    <table class="widefat striped">
                        <thead>
                            <tr>
                                <th><?php esc_html_e('Label', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('API Key', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Permissions', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Status', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Last Used', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Expires', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Created', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Actions', 'vireon-integration'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($keys as $key): ?>
                                <tr>
                                    <td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                                    <td><code><?php echo esc_html($key['masked_key'] ?? __('Stored securely', 'vireon-integration')); ?></code></td>
                                    <td><?php echo esc_html($key['permissions']); ?></td>
                                    <td>
                                        <span class="vireon-status-badge <?php echo $key['is_active'] ? 'badge-active' : 'badge-inactive'; ?>">
                                            <?php echo $key['is_active'] ? esc_html__('Active', 'vireon-integration') : esc_html__('Revoked', 'vireon-integration'); ?>
                                        </span>
                                    </td>
                                    <td><?php echo $key['last_used_at'] ? esc_html($key['last_used_at']) : '—'; ?></td>
                                    <td>
                                        <?php
                                        if (!$key['expires_at']) {
                                            esc_html_e('Never', 'vireon-integration');
                                        } else {
                                            $expires = strtotime($key['expires_at']);
                                            echo esc_html(wp_date(get_option('date_format'), $expires));
                                            if ($expires < time()) {
                                                echo ' <span class="vireon-status-badge badge-inactive">Expired</span>';
                                            }
                                        }
                                        ?>
                                    </td>
                                    <td><?php echo esc_html(wp_date(get_option('date_format'), strtotime($key['created_at']))); ?></td>
                                    <td>
                                        <?php if ($key['is_active']): ?>
                                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                                                <?php wp_nonce_field('vireon_revoke_key', 'vireon_nonce'); ?>
                                                <input type="hidden" name="action" value="vireon_revoke_key" />
                                                <input type="hidden" name="key_id" value="<?php echo esc_attr($key['id']); ?>" />
                                                <button type="submit" class="button button-small button-link-delete" onclick="return confirm('<?php esc_attr_e('Revoke this API key? This cannot be undone.', 'vireon-integration'); ?>');">
                                                    <?php esc_html_e('Revoke', 'vireon-integration'); ?>
                                                </button>
                                            </form>
                                        <?php else: ?>
                                            <span class="vireon-muted">—</span>
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
        $logs  = Vireon_Logger::get_logs(200, $level);

        ?>
        <div class="wrap vireon-admin-wrap">
            <h1><?php esc_html_e('Vireon - Activity Logs', 'vireon-integration'); ?></h1>

            <div class="vireon-card">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                    <div>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-logs')); ?>" class="button button-small <?php echo empty($level) ? 'button-primary' : ''; ?>"><?php esc_html_e('All', 'vireon-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-logs&level=error')); ?>" class="button button-small <?php echo $level === 'error' ? 'button-primary' : ''; ?>"><?php esc_html_e('Errors', 'vireon-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-logs&level=warning')); ?>" class="button button-small <?php echo $level === 'warning' ? 'button-primary' : ''; ?>"><?php esc_html_e('Warnings', 'vireon-integration'); ?></a>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=vireon-logs&level=info')); ?>" class="button button-small <?php echo $level === 'info' ? 'button-primary' : ''; ?>"><?php esc_html_e('Info', 'vireon-integration'); ?></a>
                    </div>
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline;">
                        <?php wp_nonce_field('vireon_clear_logs', 'vireon_nonce'); ?>
                        <input type="hidden" name="action" value="vireon_clear_logs" />
                        <button type="submit" class="button button-small button-link-delete" onclick="return confirm('<?php esc_attr_e('Clear all logs? This cannot be undone.', 'vireon-integration'); ?>');">
                            <?php esc_html_e('Clear All Logs', 'vireon-integration'); ?>
                        </button>
                    </form>
                </div>
            </div>

            <?php if (empty($logs)): ?>
                <div class="vireon-card">
                    <p><?php esc_html_e('No log entries found.', 'vireon-integration'); ?></p>
                </div>
            <?php else: ?>
                <div class="vireon-card" style="padding:0; overflow-x:auto;">
                    <table class="widefat striped" style="margin:0;">
                        <thead>
                            <tr>
                                <th style="width:100px;"><?php esc_html_e('Level', 'vireon-integration'); ?></th>
                                <th><?php esc_html_e('Message', 'vireon-integration'); ?></th>
                                <th style="width:200px;"><?php esc_html_e('Context', 'vireon-integration'); ?></th>
                                <th style="width:180px;"><?php esc_html_e('Time', 'vireon-integration'); ?></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($logs as $log): ?>
                                <tr class="vireon-log-row log-level-<?php echo esc_attr($log['level']); ?>">
                                    <td>
                                        <span class="vireon-log-level level-<?php echo esc_attr($log['level']); ?>">
                                            <?php echo esc_html(strtoupper($log['level'])); ?>
                                        </span>
                                    </td>
                                    <td><?php echo esc_html($log['message']); ?></td>
                                    <td>
                                        <?php if (!empty($log['context'])): ?>
                                            <button type="button" class="button button-small toggle-context" onclick="var el=this.nextElementSibling;el.style.display=el.style.display==='none'?'block':'none';">
                                                <?php esc_html_e('Show', 'vireon-integration'); ?>
                                            </button>
                                            <pre style="display:none; font-size:11px; max-height:150px; overflow:auto; background:#f0f0f1; padding:8px; border-radius:4px; margin-top:4px;"><?php echo esc_html(json_encode(json_decode($log['context'], true), JSON_PRETTY_PRINT)); ?></pre>
                                        <?php else: ?>
                                            <span class="vireon-muted">—</span>
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
            wp_die(esc_html__('Unauthorized.', 'vireon-integration'));
        }
        check_admin_referer('vireon_generate_key', 'vireon_nonce');

        $label       = sanitize_text_field(wp_unslash($_POST['label'] ?? ''));
        $permissions = sanitize_text_field(wp_unslash($_POST['permissions'] ?? 'read,write'));
        $expires_in  = absint(wp_unslash($_POST['expires_in'] ?? 0));

        $result = Vireon_Auth::generate_key($label, $permissions, get_current_user_id(), $expires_in);

        $redirect = admin_url('admin.php?page=vireon-keys');
        if ($result['success']) {
            $redirect = add_query_arg('new_key', $result['api_key'], $redirect);
            set_transient('vireon_notice', ['type' => 'success', 'message' => $result['message']], 30);
        } else {
            set_transient('vireon_notice', ['type' => 'error', 'message' => $result['message']], 30);
        }

        wp_safe_redirect($redirect);
        exit;
    }

    /**
     * Handle API key revocation form submission.
     */
    public static function handle_revoke_key(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'vireon-integration'));
        }
        check_admin_referer('vireon_revoke_key', 'vireon_nonce');

        $key_id = absint(wp_unslash($_POST['key_id'] ?? 0));

        if ($key_id > 0) {
            Vireon_Auth::revoke_key_by_id($key_id);
        }

        wp_safe_redirect(admin_url('admin.php?page=vireon-keys'));
        exit;
    }

    /**
     * Handle settings save form submission.
     */
    public static function handle_save_settings(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'vireon-integration'));
        }
        check_admin_referer('vireon_save_settings', 'vireon_nonce');

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
            $settings['webhook_secret'] = get_option(VIREON_SETTINGS_OPTION)['webhook_secret'] ?? '';
            set_transient('vireon_notice', [
                'type'    => 'warning',
                'message' => __('Webhook secret must be at least 16 characters. Value was not saved.', 'vireon-integration'),
            ], 30);
        }

        update_option(VIREON_SETTINGS_OPTION, $settings);

        set_transient('vireon_notice', [
            'type'    => 'success',
            'message' => __('Settings saved.', 'vireon-integration'),
        ], 30);

        wp_safe_redirect(admin_url('admin.php?page=vireon-settings'));
        exit;
    }

    /**
     * Handle clear logs action.
     */
    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Unauthorized.', 'vireon-integration'));
        }
        check_admin_referer('vireon_clear_logs', 'vireon_nonce');

        Vireon_Logger::clear_logs();

        wp_safe_redirect(admin_url('admin.php?page=vireon-logs'));
        exit;
    }

    /**
     * AJAX handler for testing API connection.
     * Uses an active API key from the database to authenticate the test request.
     */
    public static function ajax_test_connection(): void {
        check_ajax_referer('vireon_test_connection');

        if (!current_user_can('manage_options')) {
            wp_send_json_error(['message' => 'Unauthorized.']);
        }

        global $wpdb;

        // Get an active API key from the database
        $api_key = get_option('vireon_initial_api_key', '');
        if (empty($api_key)) {
            $api_key = $wpdb->get_var(
                "SELECT api_key FROM {$wpdb->prefix}vireon_api_keys WHERE is_active = 1 AND api_key IS NOT NULL AND api_key <> '' AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1"
            );
        }

        if (empty($api_key)) {
            wp_send_json_error([
                'message' => __('No active API key found. Generate one first on the API Keys page.', 'vireon-integration'),
            ]);
            return;
        }

        // Test the Vireon status endpoint with a valid API key
        $response = wp_remote_get(rest_url(VIREON_API_NAMESPACE . '/status'), [
            'timeout' => 10,
            'headers' => [
                'X-Vireon-Key' => $api_key,
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
                'message'     => $body['message'] ?? __('Connection test failed. Check that the REST API is accessible.', 'vireon-integration'),
            ]);
        }
    }
}
