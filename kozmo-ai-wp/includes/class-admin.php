<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class Admin {
    private static ?self $instance = null;
    private static string $hook = '';

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('admin_menu', [self::class, 'add_menu']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_assets']);
        add_action('admin_post_kozmo_ai_save_settings', [self::class, 'handle_save_settings']);
        add_action('admin_post_kozmo_ai_clear_logs', [self::class, 'handle_clear_logs']);
        add_action('admin_post_kozmo_ai_download_seo_report', [SeoReport::class, 'download']);
        add_action('wp_ajax_kozmo_ai_dashboard_data', [Dashboard::class, 'ajax_data']);
        add_action('wp_ajax_kozmo_ai_article_action', [self::class, 'handle_article_action']);
        add_action('wp_ajax_kozmo_ai_research_data', [self::class, 'handle_research_data']);
        add_action('wp_ajax_kozmo_ai_generate_now', [self::class, 'handle_generate_now']);
        add_action('wp_ajax_kozmo_ai_test_api', [self::class, 'handle_test_api']);
        add_action('wp_ajax_kozmo_ai_dismiss_milestone', [self::class, 'handle_dismiss_milestone']);
        add_filter('plugin_action_links_' . KOZMO_AI_WP_BASENAME, [self::class, 'action_links']);
        add_filter('admin_body_class', [self::class, 'body_class']);
        add_filter('manage_post_posts_columns', [self::class, 'post_columns']);
        add_action('manage_post_posts_custom_column', [self::class, 'post_column_data'], 10, 2);
    }

    public static function body_class(string $classes): string {
        $screen = get_current_screen();
        if ($screen && strpos($screen->id, 'kozmo-ai-wp') !== false) {
            $classes .= ' kozmo-dark';
        }
        return $classes;
    }

    public static function add_menu(): void {
        self::$hook = add_menu_page(
            'KOZMO AI', 'KOZMO AI', 'manage_options',
            'kozmo-ai-wp', [Dashboard::class, 'render'],
            'dashicons-superhero', 30
        );
        add_submenu_page('kozmo-ai-wp', 'Dashboard', 'Dashboard', 'manage_options', 'kozmo-ai-wp', [Dashboard::class, 'render']);
        add_submenu_page('kozmo-ai-wp', 'Content', 'Content', 'manage_options', 'kozmo-ai-wp-content', [self::class, 'render_content']);
        add_submenu_page('kozmo-ai-wp', 'Research', 'Research', 'manage_options', 'kozmo-ai-wp-research', [self::class, 'render_research']);
        add_submenu_page('kozmo-ai-wp', 'SEO Report', 'SEO Report', 'manage_options', 'kozmo-ai-wp-seo', [self::class, 'render_seo_report']);
        add_submenu_page('kozmo-ai-wp', 'Settings', 'Settings', 'manage_options', 'kozmo-ai-wp-settings', [self::class, 'render_settings']);
    }

    public static function enqueue_assets(string $hook): void {
        if (strpos($hook, 'kozmo-ai-wp') === false) return;

        wp_enqueue_style('kozmo-ai-wp-admin', KOZMO_AI_WP_URL . 'assets/admin.css', [], KOZMO_AI_WP_VERSION);
        wp_enqueue_script('kozmo-ai-wp-admin', KOZMO_AI_WP_URL . 'assets/admin.js', ['jquery'], KOZMO_AI_WP_VERSION, true);
        wp_localize_script('kozmo-ai-wp-admin', 'kozmoAI', [
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce'    => wp_create_nonce('kozmo_ai_wp_ajax'),
        ]);
    }

    public static function action_links(array $links): array {
        $links[] = '<a href="' . admin_url('admin.php?page=kozmo-ai-wp') . '">Dashboard</a>';
        $links[] = '<a href="' . admin_url('admin.php?page=kozmo-ai-wp-settings') . '">Settings</a>';
        return $links;
    }

    // ── Content Page ──
    public static function render_content(): void {
        global $wpdb;
        $page = isset($_GET['paged']) ? max(1, (int) $_GET['paged']) : 1;
        $per_page = 20;
        $offset = ($page - 1) * $per_page;
        $status_filter = isset($_GET['status']) ? sanitize_text_field(wp_unslash($_GET['status'])) : '';
        $search = isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '';

        $where = "WHERE a.agent_article_id IS NOT NULL";
        $where .= $status_filter ? $wpdb->prepare(" AND p.post_status = %s", $status_filter) : '';
        $where .= $search ? $wpdb->prepare(" AND p.post_title LIKE %s", '%' . $wpdb->esc_like($search) . '%') : '';

        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_articles a INNER JOIN {$wpdb->posts} p ON p.ID = a.post_id {$where}");
        $articles = $wpdb->get_results($wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_status, p.post_date, a.quality_score, a.pipeline_status
             FROM {$wpdb->prefix}kozmo_ai_articles a INNER JOIN {$wpdb->posts} p ON p.ID = a.post_id {$where}
             ORDER BY a.created_at DESC LIMIT %d OFFSET %d", $per_page, $offset
        ), ARRAY_A);

        $total_pages = ceil($total / $per_page);
        ?>
        <div class="wrap k-shell">
            <?php Dashboard::render_nav('content'); ?>
            <div class="k-card" style="margin-bottom:20px;">
                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                    <form method="get" style="display:flex;align-items:center;gap:8px;flex:1;flex-wrap:wrap;">
                        <input type="hidden" name="page" value="kozmo-ai-wp-content" />
                        <select name="status" style="padding:6px 10px;background:var(--k-bg-elevated);border:1px solid var(--k-border);border-radius:var(--k-radius);color:var(--k-text);font-size:13px;">
                            <option value="">All Statuses</option>
                            <option value="publish" <?php selected($status_filter, 'publish'); ?>>Published</option>
                            <option value="draft" <?php selected($status_filter, 'draft'); ?>>Draft</option>
                        </select>
                        <input type="text" name="s" value="<?php echo esc_attr($search); ?>" placeholder="Search articles…" style="padding:6px 10px;background:var(--k-bg-elevated);border:1px solid var(--k-border);border-radius:var(--k-radius);color:var(--k-text);font-size:13px;min-width:200px;" />
                        <button class="k-btn k-btn-secondary k-btn-sm">Filter</button>
                        <?php if ($status_filter || $search): ?>
                        <a href="<?php echo esc_url(admin_url('admin.php?page=kozmo-ai-wp-content')); ?>" class="k-btn k-btn-sm" style="color:var(--k-text-secondary);">Clear</a>
                        <?php endif; ?>
                    </form>
                    <span style="font-size:13px;color:var(--k-text-tertiary);"><?php echo (int) $total; ?> articles</span>
                </div>
            </div>

            <?php if (empty($articles)): ?>
            <div class="k-empty" style="padding:64px 24px;"><div class="k-empty-icon">📝</div><div>No AI-generated articles found</div></div>
            <?php else: ?>
            <div class="k-card" style="padding:0;overflow:hidden;">
                <div class="k-table-wrap">
                <table class="k-table" style="font-size:13px;"><thead><tr>
                    <th>Title</th><th>Status</th><th>Quality</th><th>Pipeline</th><th>Date</th><th style="text-align:right;">Actions</th>
                </tr></thead><tbody><?php foreach ($articles as $a): ?>
                    <tr><td><a href="<?php echo esc_url(get_edit_post_link($a['ID'])); ?>" class="k-cell-link"><?php echo esc_html($a['post_title']); ?></a></td>
                        <td><span class="k-tag <?php echo $a['post_status'] === 'publish' ? 'k-tag-active' : 'k-tag-yellow'; ?>"><?php echo $a['post_status'] === 'publish' ? 'Published' : 'Draft'; ?></span></td>
                        <td><?php echo $a['quality_score'] ? round((float) $a['quality_score'], 1) : '—'; ?></td>
                        <td><span class="k-tag <?php echo $a['pipeline_status'] === 'completed' ? 'k-tag-green' : 'k-tag-blue'; ?>"><?php echo esc_html($a['pipeline_status'] ?? 'pending'); ?></span></td>
                        <td class="k-text-mono"><?php echo esc_html(wp_date('M j, Y', strtotime($a['post_date']))); ?></td>
                        <td style="text-align:right;white-space:nowrap;">
                            <div class="k-action-group">
                            <?php if ($a['post_status'] !== 'publish'): ?>
                            <button class="k-btn k-btn-sm k-tag-green" onclick="articleAction(<?php echo (int) $a['ID']; ?>, 'publish')" data-k-action="<?php echo (int) $a['ID']; ?>" data-k-act="publish">Publish</button>
                            <?php endif; ?>
                            <?php if ($a['post_status'] !== 'draft'): ?>
                            <button class="k-btn k-btn-sm k-btn-secondary" onclick="articleAction(<?php echo (int) $a['ID']; ?>, 'draft')" data-k-action="<?php echo (int) $a['ID']; ?>" data-k-act="draft">Draft</button>
                            <?php endif; ?>
                            <a href="<?php echo esc_url(get_edit_post_link($a['ID'])); ?>" class="k-btn k-btn-secondary k-btn-sm">Edit</a>
                            <button class="k-btn k-btn-sm k-btn-danger" onclick="articleAction(<?php echo (int) $a['ID']; ?>, 'delete')" data-k-action="<?php echo (int) $a['ID']; ?>" data-k-act="delete">×</button>
                            </div>
                        </td>
                    </tr>
                <?php endforeach; ?></tbody></table>
                </div>
            </div>

            <?php if ($total_pages > 1): ?>
            <div style="display:flex;justify-content:center;gap:4px;margin-top:16px;">
                <?php for ($i = 1; $i <= $total_pages; $i++): ?>
                <a href="<?php echo esc_url(add_query_arg(['page' => 'kozmo-ai-wp-content', 'paged' => $i, 'status' => $status_filter, 's' => $search], admin_url('admin.php'))); ?>" class="k-btn k-btn-sm <?php echo $i === $page ? 'k-btn-primary' : 'k-btn-secondary'; ?>"><?php echo $i; ?></a>
                <?php endfor; ?>
            </div>
            <?php endif; ?>
            <?php endif; ?>
        </div>
        <?php
    }

    // ── Consolidated Settings Page ──
    public static function render_settings(): void {
        $settings = get_option('kozmo_ai_wp_settings', []);
        $keys = Auth::list_keys();
        $info = Diagnostics::get_system_info();
        $errors = !empty($_GET['updated']);
        ?>
        <div class="wrap k-shell">
            <?php Dashboard::render_nav('settings'); ?>
            <?php if ($errors): ?>
            <div class="k-notice k-notice-success k-fade"><span>✓</span> Settings saved successfully</div>
            <?php endif; ?>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" class="k-settings">
                <?php wp_nonce_field('kozmo_ai_save_settings', 'kozmo_ai_nonce'); ?>
                <input type="hidden" name="action" value="kozmo_ai_save_settings">

                <div class="k-section k-fade">
                    <div class="k-section-header">⚙ OpenAI</div>
                    <div class="k-card">
                        <div class="k-field"><label>API Key</label><input type="password" name="openai_api_key" value="<?php echo !empty($settings['openai_api_key']) ? '********' : ''; ?>" placeholder="sk-..." /><div class="k-desc">The only required field. Everything else auto-configures.</div><button id="k-test-api" class="k-btn k-btn-secondary k-btn-sm" style="margin-top:8px;">Test Connection</button></div>
                        <div class="k-field"><label>Model</label><select name="openai_model"><option value="gpt-4o" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4o'); ?>>GPT-4o (recommended)</option><option value="gpt-4o-mini" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4o-mini'); ?>>GPT-4o Mini (cheaper)</option><option value="gpt-4-turbo" <?php selected($settings['openai_model'] ?? 'gpt-4o', 'gpt-4-turbo'); ?>>GPT-4 Turbo</option></select></div>
                    </div>
                </div>

                <details class="k-details k-fade">
                    <summary>⚡ Advanced</summary>
                    <div class="k-details-body">
                        <div class="k-section-header" style="margin-top:0;">Generation</div>
                        <div class="k-card">
                            <div class="k-field"><label>Frequency</label><select name="generation_frequency"><option value="kozmo_ai_every_15min" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_every_15min'); ?>>Every 15 minutes</option><option value="kozmo_ai_hourly" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_hourly'); ?>>Hourly</option><option value="kozmo_ai_twice_daily" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'kozmo_ai_twice_daily'); ?>>Twice daily</option><option value="daily" <?php selected($settings['generation_frequency'] ?? 'kozmo_ai_every_15min', 'daily'); ?>>Once daily</option></select></div>
                            <div class="k-field"><label>Max articles per day</label><input type="number" name="max_articles_daily" value="<?php echo esc_attr($settings['max_articles_daily'] ?? 24); ?>" min="1" max="100" /></div>
                            <div class="k-field k-field-checkbox"><input type="checkbox" name="generate_as_draft" value="yes" id="k-gen-draft" <?php checked($settings['generate_as_draft'] ?? 'no', 'yes'); ?> /><label for="k-gen-draft">Save as draft instead of publishing immediately</label></div>
                        </div>

                        <div class="k-section-header">API Keys</div>
                        <div class="k-card">
                            <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
                                <div class="k-field" style="flex:1;min-width:160px;"><label>Label</label><input type="text" name="new_key_label" placeholder="e.g. Production" /></div>
                                <div class="k-field" style="flex:0 0 140px;"><label>Permissions</label><select name="new_key_permissions"><option value="read,write">Read & Write</option><option value="read">Read Only</option><option value="write">Write Only</option></select></div>
                                <div class="k-field" style="flex:0 0 120px;"><label>Expires</label><select name="new_key_expires"><option value="0">Never</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></div>
                                <div style="display:flex;align-items:flex-end;">
                                    <?php wp_nonce_field('kozmo_ai_generate_key', 'kozmo_ai_generate_nonce'); ?>
                                    <button type="submit" name="generate_key" value="1" class="k-btn k-btn-primary k-btn-sm">Generate Key</button>
                                </div>
                            </div>

                            <?php if (isset($_GET['new_key'])): ?>
                            <div class="k-key-display k-key-new"><code><?php echo esc_html(sanitize_text_field(wp_unslash($_GET['new_key']))); ?></code><button type="button" class="k-btn k-btn-secondary k-btn-sm" data-k-copy="<?php echo esc_attr(sanitize_text_field(wp_unslash($_GET['new_key']))); ?>">Copy</button></div>
                            <p style="font-size:12px;color:var(--k-text-tertiary);margin:-8px 0 16px 0;">Copy this now — it won't be shown again.</p>
                            <?php endif; ?>

                            <?php if (empty($keys)): ?>
                            <p style="color:var(--k-text-tertiary);font-size:13px;">No API keys generated yet.</p>
                            <?php else: ?>
                            <table class="k-key-table"><thead><tr><th>Label</th><th>Key</th><th>Permissions</th><th>Status</th><th style="text-align:right;">Actions</th></tr></thead>
                                <tbody><?php foreach ($keys as $key): ?>
                                <tr><td><?php echo esc_html($key['label'] ?: '—'); ?></td>
                                    <td class="k-masked" data-key-id="<?php echo (int) $key['id']; ?>"><?php echo esc_html($key['masked_key'] ?? '••••••••'); ?></td>
                                    <td><?php echo esc_html($key['permissions']); ?></td>
                                    <td><span class="k-tag <?php echo $key['is_active'] ? 'k-tag-active' : 'k-tag-red'; ?>"><?php echo $key['is_active'] ? 'Active' : 'Revoked'; ?></span></td>
                                    <td style="text-align:right;white-space:nowrap;"><?php if ($key['is_active']): ?>
                                        <button type="button" class="k-btn k-btn-secondary k-btn-sm" onclick="revealApiKey(<?php echo (int) $key['id']; ?>)">Show</button>
                                        <?php wp_nonce_field('kozmo_ai_revoke_key', 'kozmo_ai_revoke_' . $key['id']); ?>
                                        <button type="submit" name="revoke_key" value="<?php echo esc_attr($key['id']); ?>" class="k-btn k-btn-danger k-btn-sm" onclick="return confirm('Revoke this key?');">Revoke</button>
                                    <?php endif; ?></td>
                                </tr><?php endforeach; ?></tbody>
                            </table>
                            <?php endif; ?>
                        </div>

                        <div class="k-section-header">System</div>
                        <div class="k-card">
                            <div class="k-field"><label>Log level</label><select name="log_level"><option value="debug" <?php selected($settings['log_level'] ?? 'info', 'debug'); ?>>Debug</option><option value="info" <?php selected($settings['log_level'] ?? 'info', 'info'); ?>>Info</option><option value="warning" <?php selected($settings['log_level'] ?? 'info', 'warning'); ?>>Warning</option><option value="error" <?php selected($settings['log_level'] ?? 'info', 'error'); ?>>Error</option></select></div>
                            <div class="k-field k-field-checkbox" style="margin-bottom:20px;"><input type="checkbox" name="debug_mode" value="yes" id="k-debug" <?php checked($settings['debug_mode'] ?? 'no', 'yes'); ?> /><label for="k-debug">Verbose debug logging</label></div>
                            <div class="k-field"><label>Telemetry URL (optional)</label><input type="url" name="telemetry_url" value="<?php echo esc_url($settings['telemetry_url'] ?? ''); ?>" placeholder="https://your-server.com/telemetry" /><div class="k-desc">Daily health ping with version, article counts, queue stats. Leave empty to disable. Last ping: <?php echo esc_html(\KozmoAI_WP\Telemetry::last_ping()); ?></div></div>

                            <div style="display:flex;gap:16px;margin-bottom:24px;flex-wrap:wrap;">
                                <div><span class="k-tag k-tag-blue">PHP <?php echo esc_html($info['server']['php_version'] ?? PHP_VERSION); ?></span></div>
                                <div><span class="k-tag k-tag-blue">MySQL <?php echo esc_html($info['server']['mysql_version'] ?? ''); ?></span></div>
                                <div><span class="k-tag k-tag-<?php echo ($info['health']['overall'] ?? 'healthy') === 'healthy' ? 'green' : 'yellow'; ?>"><?php echo esc_html(ucfirst($info['health']['overall'] ?? 'healthy')); ?></span></div>
                            </div>

                            <div class="k-health"><?php foreach (($info['health']['checks'] ?? []) as $name => $check): ?>
                                <div class="k-health-item"><span class="k-dot" style="background:<?php echo $check['status'] === 'healthy' ? 'var(--k-green)' : ($check['status'] === 'degraded' ? 'var(--k-yellow)' : 'var(--k-red)'); ?>"></span><?php echo esc_html(ucfirst($name)); ?> — <?php echo esc_html($check['status']); ?></div>
                            <?php endforeach; ?></div>

                            <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--k-border);">
                                <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                                    <span style="font-size:13px;color:var(--k-text-secondary);">Logs:</span>
                                    <span class="k-tag k-tag-red"><?php echo (int) ($info['logs']['error'] ?? 0); ?> errors</span>
                                    <span class="k-tag k-tag-yellow"><?php echo (int) ($info['logs']['warning'] ?? 0); ?> warnings</span>
                                    <span class="k-tag k-tag-blue"><?php echo (int) ($info['logs']['info'] ?? 0); ?> info</span>
                                    <span style="flex:1;"></span>
                                    <?php wp_nonce_field('kozmo_ai_clear_logs', 'kozmo_ai_clear_nonce'); ?>
                                    <button type="submit" name="clear_logs" value="1" class="k-btn k-btn-danger k-btn-sm" onclick="return confirm('Clear all logs?');">Clear Logs</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>

                <div style="margin-top:24px;">
                    <button type="submit" class="k-btn k-btn-primary" style="padding:10px 28px;">Save Settings</button>
                </div>
            </form>
        </div>
        <?php
    }

    // ── Form Handlers ──
    public static function handle_save_settings(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_save_settings', 'kozmo_ai_nonce');

        $old_settings = get_option('kozmo_ai_wp_settings', []);

        // Handle API key generation within settings form
        if (!empty($_POST['generate_key'])) {
            check_admin_referer('kozmo_ai_generate_key', 'kozmo_ai_generate_nonce');
            $key_label = sanitize_text_field(wp_unslash($_POST['new_key_label'] ?? ''));
            $key_perms = sanitize_text_field(wp_unslash($_POST['new_key_permissions'] ?? 'read,write'));
            $key_exp   = absint(wp_unslash($_POST['new_key_expires'] ?? 0));
            $result = Auth::generate_key($key_label, $key_perms, get_current_user_id(), $key_exp);
            $redirect = admin_url('admin.php?page=kozmo-ai-wp-settings');
            if ($result['success']) $redirect = add_query_arg('new_key', $result['api_key'], $redirect);
            wp_safe_redirect($redirect);
            exit;
        }

        // Handle key revocation within settings form
        if (!empty($_POST['revoke_key'])) {
            $key_id = (int) $_POST['revoke_key'];
            check_admin_referer('kozmo_ai_revoke_key', 'kozmo_ai_revoke_' . $key_id);
            Auth::revoke_key_by_id($key_id);
            wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
            exit;
        }

        // Handle clear logs within settings form
        if (!empty($_POST['clear_logs'])) {
            check_admin_referer('kozmo_ai_clear_logs', 'kozmo_ai_clear_nonce');
            Logger::clear();
            wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
            exit;
        }

        // Encrypt OpenAI key
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
            'api_enabled'            => sanitize_text_field(wp_unslash($_POST['api_enabled'] ?? 'yes')),
            'webhook_secret'         => sanitize_text_field(wp_unslash($_POST['webhook_secret'] ?? '')),
            'log_level'              => sanitize_text_field(wp_unslash($_POST['log_level'] ?? 'info')),
            'debug_mode'             => sanitize_text_field(wp_unslash($_POST['debug_mode'] ?? 'no')),
            'enable_auto_generation' => sanitize_text_field(wp_unslash($_POST['enable_auto_generation'] ?? 'yes')),
            'generation_frequency'   => sanitize_text_field(wp_unslash($_POST['generation_frequency'] ?? 'kozmo_ai_every_15min')),
            'openai_model'           => sanitize_text_field(wp_unslash($_POST['openai_model'] ?? 'gpt-4o')),
            'generate_as_draft'      => sanitize_text_field(wp_unslash($_POST['generate_as_draft'] ?? 'no')),
            'auto_publish'           => sanitize_text_field(wp_unslash($_POST['auto_publish'] ?? 'no')),
            'min_quality_score'      => absint(wp_unslash($_POST['min_quality_score'] ?? 95)),
            'max_articles_daily'     => absint(wp_unslash($_POST['max_articles_daily'] ?? 24)),
            'openai_api_key'         => $encrypted_openai_key,
            'auto_discover'          => $old_settings['auto_discover'] ?? 'yes',
            'auto_fix_errors'        => $old_settings['auto_fix_errors'] ?? 'yes',
            'enable_webhooks'        => 'yes',
            'cron_interval'          => $old_settings['cron_interval'] ?? 'kozmo_ai_every_15min',
            'telemetry_url'          => esc_url_raw(wp_unslash($_POST['telemetry_url'] ?? '')),
            'last_scan_at'           => $old_settings['last_scan_at'] ?? '',
            'last_sync_at'           => current_time('mysql'),
        ];

        // Reschedule telemetry if URL changed
        Telemetry::schedule();

        if (!empty($settings['webhook_secret']) && strlen($settings['webhook_secret']) < 16) {
            $settings['webhook_secret'] = $old_settings['webhook_secret'] ?? '';
        }

        update_option('kozmo_ai_wp_settings', $settings);

        if (($settings['enable_auto_generation'] ?? 'no') !== 'yes') {
            Scheduler::clear_auto_generation();
        } else {
            Scheduler::schedule_auto_generation($settings['generation_frequency'], true);
        }

        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
        exit;
    }

    public static function handle_clear_logs(): void {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('kozmo_ai_clear_logs', 'kozmo_ai_nonce');
        Logger::clear();
        wp_safe_redirect(admin_url('admin.php?page=kozmo-ai-wp-settings&updated=1'));
        exit;
    }

    // ── Article AJAX Actions ──
    public static function handle_article_action(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized']);

        $post_id = (int) ($_POST['post_id'] ?? 0);
        $action = sanitize_text_field(wp_unslash($_POST['act'] ?? ''));

        if (!$post_id || !in_array($action, ['publish', 'draft', 'delete'], true)) {
            wp_send_json_error(['message' => 'Invalid parameters']);
        }

        if ($action === 'delete') {
            wp_delete_post($post_id, true);
            Logger::info('Article deleted via dashboard', ['post_id' => $post_id]);
            wp_send_json_success(['message' => 'Article permanently deleted']);
        }

        if ($action === 'publish') {
            wp_publish_post($post_id);
            update_post_meta($post_id, '_kozmo_ai_pipeline_stage', 'completed');
            delete_post_meta($post_id, '_kozmo_ai_pipeline_error');
            Logger::info('Article published via dashboard', ['post_id' => $post_id]);
            wp_send_json_success(['message' => 'Article published']);
        }

        if ($action === 'draft') {
            wp_update_post(['ID' => $post_id, 'post_status' => 'draft']);
            Logger::info('Article moved to draft via dashboard', ['post_id' => $post_id]);
            wp_send_json_success(['message' => 'Article moved to draft']);
        }
    }

    // ── Research Data AJAX ──
    public static function handle_research_data(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized']);

        try {
            ContentResearch::auto_research();
            $keywords = get_option('kozmo_ai_cached_keywords', []);
            $gaps = get_option('kozmo_ai_cached_gaps', []);
            wp_send_json_success([
                'keywords' => $keywords,
                'gaps'     => $gaps,
            ]);
        } catch (\Throwable $e) {
            wp_send_json_error(['message' => $e->getMessage()]);
        }
    }

    // ── Research Page ──
    public static function render_research(): void {
        $keywords = get_option('kozmo_ai_cached_keywords', []);
        $gaps = get_option('kozmo_ai_cached_gaps', []);
        ?>
        <div class="wrap k-shell">
            <?php Dashboard::render_nav('research'); ?>
            <div class="k-gen k-fade">
                <div class="k-gen-info">
                    <div class="k-gen-item"><span class="k-gen-label">Keyword Clusters</span><span class="k-gen-value"><?php echo count($keywords); ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Content Gaps</span><span class="k-gen-value"><?php echo count($gaps); ?></span></div>
                    <span class="k-tag k-tag-blue">Auto-researched via OpenAI</span>
                </div>
                <div class="k-gen-actions">
                    <button id="k-research" class="k-btn k-btn-primary k-btn-sm">⟳ Research Now</button>
                </div>
            </div>

            <div class="k-research-grid">
                <div class="k-research-card">
                    <h3>🔍 Keyword Clusters</h3>
                    <?php if (empty($keywords)): ?>
                    <div class="k-empty" style="padding:24px;"><div class="k-empty-icon">🔑</div>No keywords yet. Click "Research Now" to fetch.</div>
                    <?php else: foreach ($keywords as $k): ?>
                    <div style="margin-bottom:14px;padding:10px 12px;background:var(--k-bg-elevated);border-radius:var(--k-radius);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <strong style="font-size:13px;"><?php echo esc_html($k['cluster_name'] ?? ''); ?></strong>
                            <span class="k-tag <?php echo ($k['trend'] ?? 'stable') === 'up' ? 'k-tag-green' : (($k['trend'] ?? 'stable') === 'down' ? 'k-tag-red' : 'k-tag-yellow'); ?>"><?php echo esc_html($k['trend'] ?? 'stable'); ?></span>
                        </div>
                        <div style="font-size:11px;color:var(--k-text-tertiary);margin-bottom:4px;">
                            Intent: <?php echo esc_html($k['search_intent'] ?? '—'); ?> · Volume: <?php echo (int) ($k['avg_monthly'] ?? 0); ?>
                        </div>
                        <div><?php foreach ((array) ($k['keywords'] ?? []) as $kw): ?>
                            <span class="k-tag k-tag-blue"><?php echo esc_html($kw); ?></span>
                        <?php endforeach; ?></div>
                    </div>
                    <?php endforeach; endif; ?>
                </div>

                <div class="k-research-card">
                    <h3>📊 Content Gaps</h3>
                    <?php if (empty($gaps)): ?>
                    <div class="k-empty" style="padding:24px;"><div class="k-empty-icon">📊</div>No gaps yet. Click "Research Now" to fetch.</div>
                    <?php else: foreach ($gaps as $g): ?>
                    <div style="margin-bottom:14px;padding:10px 12px;background:var(--k-bg-elevated);border-radius:var(--k-radius);">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                            <strong style="font-size:13px;"><?php echo esc_html($g['gap'] ?? ''); ?></strong>
                            <span class="k-tag <?php echo ($g['urgency'] ?? 'medium') === 'high' ? 'k-tag-red' : (($g['urgency'] ?? 'medium') === 'low' ? 'k-tag-yellow' : 'k-tag-blue'); ?>"><?php echo esc_html($g['urgency'] ?? 'medium'); ?></span>
                        </div>
                        <div style="display:flex;gap:8px;font-size:11px;color:var(--k-text-tertiary);margin-bottom:4px;">
                            <span>Opportunity: <?php echo (int) ($g['opportunity_score'] ?? 0); ?>/10</span>
                        </div>
                        <div style="font-size:12px;color:var(--k-text-secondary);"><?php echo esc_html($g['why_it_matters'] ?? ''); ?></div>
                    </div>
                    <?php endforeach; endif; ?>
                </div>
            </div>
        </div>
        <script>
        (function($) {
            $('#k-research').on('click', function() {
                var $btn = $(this).prop('disabled', true).text('⟳ Researching...');
                $.post(ajaxurl, { action: 'kozmo_ai_research_data', nonce: kozmoAI?.nonce }, function(r) {
                    if (r.success) location.reload();
                    else alert(r.data?.message || 'Research failed');
                }).always(function() { $btn.prop('disabled', false).text('⟳ Research Now'); });
            });
        })(jQuery);
        </script>
        <?php
    }

    // ── SEO Report Page ──
    public static function render_seo_report(): void {
        $report = SeoReport::generate();
        $grade = $report['health_score'] >= 90 ? 'A' : ($report['health_score'] >= 75 ? 'B' : ($report['health_score'] >= 60 ? 'C' : 'D'));
        $color = $report['health_score'] >= 90 ? 'var(--k-green)' : ($report['health_score'] >= 75 ? 'var(--k-yellow)' : 'var(--k-red)');
        ?>
        <div class="wrap k-shell">
            <?php Dashboard::render_nav('seo'); ?>
            <div class="k-gen k-fade">
                <div class="k-gen-info">
                    <div class="k-gen-item"><span class="k-gen-label">Grade</span><span class="k-gen-value" style="color:<?php echo $color; ?>"><?php echo $grade; ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Health Score</span><span class="k-gen-value"><?php echo (int) $report['health_score']; ?>/100</span></div>
                    <div class="k-gen-item"><span class="k-gen-label">AI Articles</span><span class="k-gen-value"><?php echo (int) $report['article_stats']['ai_generated']; ?></span></div>
                    <div class="k-gen-item"><span class="k-gen-label">Avg Quality</span><span class="k-gen-value"><?php echo (float) $report['article_stats']['avg_quality']; ?>/100</span></div>
                </div>
                <div class="k-gen-actions">
                    <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                        <?php wp_nonce_field('kozmo_ai_download_seo_report', 'kozmo_ai_seo_nonce'); ?>
                        <input type="hidden" name="action" value="kozmo_ai_download_seo_report">
                        <button type="submit" class="k-btn k-btn-primary k-btn-sm">⬇ Download Full Report</button>
                        <button id="k-seo-refresh" class="k-btn k-btn-secondary k-btn-sm">Refresh</button>
                    </form>
                </div>
            </div>

            <div class="k-grid">
                <div class="k-stat"><div class="k-stat-label">Health Score</div><div class="k-stat-value" style="color:<?php echo $color; ?>"><?php echo (int) $report['health_score']; ?></div><div class="k-stat-sub"><?php echo esc_html(ucfirst($report['health_status'])); ?></div></div>
                <div class="k-stat"><div class="k-stat-label">Total Articles</div><div class="k-stat-value"><?php echo (int) $report['article_stats']['total_published']; ?></div><div class="k-stat-sub"><?php echo (int) $report['article_stats']['ai_generated']; ?> AI-generated</div></div>
                <div class="k-stat"><div class="k-stat-label">Avg Quality</div><div class="k-stat-value"><?php echo (float) $report['article_stats']['avg_quality']; ?></div><div class="k-stat-sub">out of 100</div></div>
                <div class="k-stat"><div class="k-stat-label">Content Issues</div><div class="k-stat-value"><?php echo (int) ($report['content_health']['thin_content'] ?? 0); ?></div><div class="k-stat-sub"><?php echo (int) ($report['content_health']['no_featured_images'] ?? 0); ?> no images</div></div>
                <div class="k-stat"><div class="k-stat-label">Duplicate Titles</div><div class="k-stat-value"><?php echo (int) ($report['content_health']['duplicate_titles'] ?? 0); ?></div><div class="k-stat-sub">groups of duplicates</div></div>
                <div class="k-stat"><div class="k-stat-label">Outdated Content</div><div class="k-stat-value"><?php echo (int) ($report['content_health']['old_posts'] ?? 0); ?></div><div class="k-stat-sub">not updated in 6+ months</div></div>
            </div>

            <div class="k-panel">
                <div class="k-card">
                    <div class="k-card-header"><h2>Health Checks</h2></div>
                    <div class="k-health"><?php foreach ($report['health_checks'] as $name => $check): ?>
                        <div class="k-health-item"><span class="k-dot" style="background:<?php echo $check['status'] === 'healthy' ? 'var(--k-green)' : ($check['status'] === 'degraded' ? 'var(--k-yellow)' : 'var(--k-red)'); ?>"></span><?php echo esc_html(ucfirst($name)); ?> — <?php echo esc_html($check['status']); ?></div>
                    <?php endforeach; ?></div>
                </div>
                <div class="k-card">
                    <div class="k-card-header"><h2>Settings</h2></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">
                        <div><span style="color:var(--k-text-tertiary);">Model:</span> <?php echo esc_html($report['settings']['model']); ?></div>
                        <div><span style="color:var(--k-text-tertiary);">Frequency:</span> <?php echo esc_html($report['settings']['frequency']); ?></div>
                        <div><span style="color:var(--k-text-tertiary);">Daily Max:</span> <?php echo (int) $report['settings']['daily_max']; ?></div>
                        <div><span style="color:var(--k-text-tertiary);">Mode:</span> <?php echo $report['settings']['draft_mode'] ? 'Draft' : 'Published'; ?></div>
                        <div><span style="color:var(--k-text-tertiary);">PHP:</span> <?php echo esc_html($report['php_version']); ?></div>
                        <div><span style="color:var(--k-text-tertiary);">WP:</span> <?php echo esc_html($report['wp_version']); ?></div>
                        <div><span style="color:var(--k-text-tertiary);">Speed:</span> <?php echo esc_html($report['pagespeed_estimate']); ?></div>
                        <div><span style="color:var(--k-text-tertiary);">Pending Tasks:</span> <?php echo (int) ($report['queue_stats']['pending'] ?? 0); ?></div>
                    </div>
                </div>
            </div>

            <?php if (!empty($report['recommendations'])): ?>
            <div class="k-card k-fade">
                <div class="k-card-header"><h2>Recommendations</h2></div>
                <?php foreach ($report['recommendations'] as $rec): ?>
                <div style="padding:10px 14px;margin-bottom:8px;background:var(--k-accent-dim);border:1px solid var(--k-accent);border-radius:var(--k-radius);font-size:13px;color:var(--k-accent);"><?php echo esc_html($rec); ?></div>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        <script>
        (function($) {
            $('#k-seo-refresh').on('click', function() { location.reload(); });
        })(jQuery);
        </script>
        <?php
    }

    // ── Test API Key AJAX ──
    public static function handle_test_api(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized']);

        try {
            $api_key = ContentGenerator::get_openai_key();
            if (empty($api_key)) {
                wp_send_json_error(['message' => 'No API key configured. Add one in Settings.']);
                return;
            }
            $response = wp_remote_get('https://api.openai.com/v1/models', [
                'timeout' => 15,
                'headers' => ['Authorization' => 'Bearer ' . $api_key],
            ]);
            if (is_wp_error($response)) {
                wp_send_json_error(['message' => 'Connection failed: ' . $response->get_error_message()]);
                return;
            }
            $status = wp_remote_retrieve_response_code($response);
            if ($status === 200) {
                $body = json_decode(wp_remote_retrieve_body($response), true);
                $model = $body['data'][0]['id'] ?? 'Connected';
                $settings = get_option('kozmo_ai_wp_settings', []);
                $configured = $settings['openai_model'] ?? 'gpt-4o';
                wp_send_json_success(['model' => "Key works! Connected as '{$configured}'"]);
            } elseif ($status === 401) {
                wp_send_json_error(['message' => 'Invalid API key. Check your key in Settings.']);
            } else {
                wp_send_json_error(['message' => "HTTP {$status} — unexpected response from OpenAI"]);
            }
        } catch (\Throwable $e) {
            wp_send_json_error(['message' => $e->getMessage()]);
        }
    }

    // ── Generate Now AJAX ──
    public static function handle_generate_now(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) wp_send_json_error(['message' => 'Unauthorized']);

        if (!ContentGenerator::is_configured()) {
            wp_send_json_error(['message' => 'OpenAI key not configured. Go to Settings first.']);
            return;
        }
        if (get_transient('kozmo_ai_generate_lock')) {
            wp_send_json_error(['message' => 'Generation already in progress. Please wait.']);
            return;
        }

        Worker::enqueue('discover_topics', ['trigger' => 'manual'], 1);
        Logger::info('Manual generation triggered via Dashboard');

        wp_send_json_success(['message' => 'Generation started — articles will appear in the queue shortly.']);
    }

    // ── Dismiss Milestone AJAX ──
    public static function handle_dismiss_milestone(): void {
        check_ajax_referer('kozmo_ai_wp_ajax', 'nonce');
        if (!current_user_can('manage_options')) return;
        update_user_meta(get_current_user_id(), 'kozmo_ai_milestone_dismissed', current_time('mysql'));
        wp_send_json_success();
    }

    // ── Post List Columns ──
    public static function post_columns(array $columns): array {
        $columns['kozmo_ai_badge'] = 'KOZMO AI';
        $columns['kozmo_ai_quality'] = 'Quality';
        $columns['kozmo_ai_pipeline'] = 'Pipeline';
        return $columns;
    }

    public static function post_column_data(string $column, int $post_id): void {
        if ($column === 'kozmo_ai_badge') {
            $generated = get_post_meta($post_id, '_kozmo_ai_auto_generated', true);
            if ($generated) {
                echo '<span class="k-col-badge k-ai-gen">AI</span>';
            }
        }
        if ($column === 'kozmo_ai_quality') {
            $score = get_post_meta($post_id, '_kozmo_ai_quality_score', true);
            if (!$score) {
                global $wpdb;
                $score = $wpdb->get_var($wpdb->prepare(
                    "SELECT quality_score FROM {$wpdb->prefix}kozmo_ai_articles WHERE post_id = %d", $post_id
                ));
            }
            if ($score) {
                $v = round((float) $score);
                $cls = $v >= 90 ? 'k-quality' : ($v >= 70 ? 'k-tag-yellow' : 'k-tag-red');
                echo '<span class="k-col-badge ' . $cls . '">' . $v . '</span>';
            }
        }
        if ($column === 'kozmo_ai_pipeline') {
            $stage = get_post_meta($post_id, '_kozmo_ai_pipeline_stage', true);
            if ($stage) {
                echo '<span class="k-col-pipeline">' . esc_html($stage) . '</span>';
            }
        }
    }
}
