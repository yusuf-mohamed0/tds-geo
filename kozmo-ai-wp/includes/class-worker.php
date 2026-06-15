<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

/**
 * Queue-based worker system that processes background tasks.
 */
class Worker {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
        add_action('kozmo_ai_heartbeat', [self::class, 'process_queue']);
        add_action('kozmo_ai_scan', [self::class, 'handle_scan_task']);
        add_action('kozmo_ai_maintenance', [self::class, 'handle_maintenance']);
        add_action('kozmo_ai_sync', [self::class, 'handle_sync']);
    }

    public static function enqueue(string $type, array $data = [], int $priority = 10, int $delay = 0): bool {
        global $wpdb;

        $scheduled_at = $delay > 0
            ? gmdate('Y-m-d H:i:s', time() + $delay)
            : current_time('mysql');

        return (bool) $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_queue',
            [
                'task_type'    => $type,
                'task_data'    => wp_json_encode($data),
                'priority'     => $priority,
                'status'       => 'pending',
                'scheduled_at' => $scheduled_at,
            ],
            ['%s', '%s', '%d', '%s', '%s']
        );
    }

    public static function process_queue(): int {
        global $wpdb;
        $processed = 0;

        $tasks = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT * FROM {$wpdb->prefix}kozmo_ai_queue
                 WHERE status = 'pending'
                   AND scheduled_at <= %s
                 ORDER BY priority ASC, created_at ASC
                 LIMIT %d",
                current_time('mysql'),
                10
            ),
            ARRAY_A
        );

        foreach ($tasks as $task) {
            $result = self::execute($task);
            if ($result['success']) {
                $wpdb->update(
                    $wpdb->prefix . 'kozmo_ai_queue',
                    ['status' => 'completed', 'completed_at' => current_time('mysql')],
                    ['id' => $task['id']],
                    ['%s', '%s'],
                    ['%d']
                );
                $processed++;
            } else {
                $retries = (int) $task['retries'] + 1;
                $max = (int) $task['max_retries'];

                if ($retries >= $max) {
                    $wpdb->update(
                        $wpdb->prefix . 'kozmo_ai_queue',
                        ['status' => 'failed', 'retries' => $retries, 'error_message' => $result['message']],
                        ['id' => $task['id']],
                        ['%s', '%d', '%s'],
                        ['%d']
                    );
                    HealEngine::record_error('task_failed', $result['message'], ['task_id' => $task['id'], 'task_type' => $task['task_type']], 'warning');
                } else {
                    $backoff = min(300, pow(2, $retries) * 30);
                    $wpdb->update(
                        $wpdb->prefix . 'kozmo_ai_queue',
                        ['retries' => $retries, 'status' => 'pending', 'scheduled_at' => gmdate('Y-m-d H:i:s', time() + $backoff)],
                        ['id' => $task['id']],
                        ['%d', '%s', '%s'],
                        ['%d']
                    );
                }
            }
        }

        return $processed;
    }

    private static function execute(array $task): array {
        $type = $task['task_type'];
        $data = json_decode($task['task_data'], true) ?: [];

        Logger::debug('Executing task', ['type' => $type, 'id' => $task['id']]);

        switch ($type) {
            case 'full_scan':
                Scanner::run_full_scan();
                return ['success' => true];

            case 'partial_scan':
                // Re-scan specific sections
                if (!empty($data['section'])) {
                    return ['success' => true];
                }
                return ['success' => true];

            case 'sync_knowledge':
                $unsynced = KnowledgeBase::get_unsynced();
                // In production, push to agent
                KnowledgeBase::set_synced();
                return ['success' => true];

            case 'analyze_content':
                $result = ContentAnalyzer::analyze_content_health();
                KnowledgeBase::store('content_health', $result);
                return ['success' => true];

            case 'audit_seo':
                $post_id = $data['post_id'] ?? 0;
                if ($post_id) {
                    $audit = SeoAuditor::audit_post($post_id);
                    update_post_meta($post_id, '_kozmo_ai_seo_audit', wp_json_encode($audit));
                }
                return ['success' => true];

            case 'quality_check':
                $post_id = $data['post_id'] ?? 0;
                if ($post_id) {
                    $post = get_post($post_id);
                    if ($post) {
                        $score = QualityScorer::score_article([
                            'title'            => $post->post_title,
                            'content'          => $post->post_content,
                            'meta_title'       => get_post_meta($post_id, '_kozmo_ai_meta_title', true),
                            'meta_description' => get_post_meta($post_id, '_kozmo_ai_meta_description', true),
                            'focus_keyword'    => get_post_meta($post_id, '_kozmo_ai_focus_keyword', true),
                        ]);
                        update_post_meta($post_id, '_kozmo_ai_quality_score', $score['score']);
                        global $wpdb;
                        $wpdb->update(
                            $wpdb->prefix . 'kozmo_ai_articles',
                            ['quality_score' => $score['score']],
                            ['post_id' => $post_id],
                            ['%f'],
                            ['%d']
                        );
                    }
                }
                return ['success' => true];

            case 'repair_broken_links':
                // Scan posts for broken links
                return ['success' => true];

            case 'generate_article':
                $topic = $data['topic'] ?? '';
                if (empty($topic)) {
                    return ['success' => false, 'message' => 'Topic required for article generation'];
                }
                try {
                    $article = ContentGenerator::generate_article($topic);
                    $settings = get_option('kozmo_ai_wp_settings', []);
                    $status = ($settings['generate_as_draft'] ?? 'yes') === 'yes' ? 'draft' : 'publish';
                    $result  = ContentGenerator::publish_article($article, ['status' => $status]);
                    return $result;
                } catch (\Throwable $e) {
                    return ['success' => false, 'message' => $e->getMessage()];
                }

            case 'discover_topics':
                try {
                    $topics = ContentGenerator::discover_topics();
                    foreach ($topics as $topic) {
                        self::enqueue('generate_article', ['topic' => $topic], 10);
                    }
                    return ['success' => true, 'message' => 'Discovered ' . count($topics) . ' topics'];
                } catch (\Throwable $e) {
                    return ['success' => false, 'message' => $e->getMessage()];
                }

            case 'cleanup':
                Database::run_cleanup();
                return ['success' => true];

            default:
                return ['success' => false, 'message' => "Unknown task type: {$type}"];
        }
    }

    public static function handle_scan_task(): void {
        self::enqueue('full_scan', [], 5);
    }

    public static function handle_maintenance(): void {
        self::enqueue('analyze_content', [], 15);
        self::enqueue('repair_broken_links', [], 20);
        self::enqueue('cleanup', [], 25);
    }

    public static function handle_sync(): void {
        self::enqueue('sync_knowledge', [], 10);
    }

    public static function get_queue_stats(): array {
        global $wpdb;
        $table = $wpdb->prefix . 'kozmo_ai_queue';
        return [
            'pending'   => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'pending'"),
            'running'   => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'running'"),
            'completed' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'completed'"),
            'failed'    => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table} WHERE status = 'failed'"),
            'total'     => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$table}"),
            'by_type'   => $wpdb->get_results("SELECT task_type, COUNT(*) as count FROM {$table} WHERE status = 'pending' GROUP BY task_type", OBJECT_K),
        ];
    }
}
