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
        add_action('wp_ajax_kozmo_ai_dashboard_data', [Dashboard::class, 'ajax_data']);
        add_filter('plugin_action_links_' . KOZMO_AI_WP_BASENAME, [self::class, 'action_links']);
        add_filter('admin_body_class', [self::class, 'body_class']);
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
                            <a href="<?php echo esc_url(get_edit_post_link($a['ID'])); ?>" class="k-btn k-btn-secondary k-btn-sm">Edit</a>
                            <a href="<?php echo esc_url(get_permalink($a['ID'])); ?>" class="k-btn k-btn-secondary k-btn-sm" target="_blank">View</a>
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
                        <div class="k-field"><label>API Key</label><input type="password" name="openai_api_key" value="<?php echo !empty($settings['openai_api_key']) ? '********' : ''; ?>" placeholder="sk-..." /><div class="k-desc">The only required field. Everything else auto-configures.</div></div>
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
                                    <td class="k-masked"><?php echo esc_html($key['masked_key'] ?? '••••••••'); ?></td>
                                    <td><?php echo esc_html($key['permissions']); ?></td>
                                    <td><span class="k-tag <?php echo $key['is_active'] ? 'k-tag-active' : 'k-tag-red'; ?>"><?php echo $key['is_active'] ? 'Active' : 'Revoked'; ?></span></td>
                                    <td style="text-align:right;"><?php if ($key['is_active']): ?>
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
            'api_enabled'            => sanitize_text_field(wp_unslash($_POST['api_enabled'] ?? 'no')),
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
            'last_scan_at'           => $old_settings['last_scan_at'] ?? '',
            'last_sync_at'           => current_time('mysql'),
        ];

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
}
