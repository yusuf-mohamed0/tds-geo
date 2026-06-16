<?php
namespace KozmoAI_WP;

defined('ABSPATH') || exit;

class GraphifyClient {
    private static ?self $instance = null;

    private const GRAPH_PATH   = KOZMO_AI_WP_DIR . '../graphify-out/graph.json';
    private const CACHE_TTL    = 3600;
    private const CACHE_FILE   = 'kozmo-ai-graph-cache.json';
    private const MAX_ENTITIES = 300;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function is_available(): bool {
        return file_exists(self::GRAPH_PATH) && filesize(self::GRAPH_PATH) > 100;
    }

    public static function check_health(): array {
        $checks = [];
        $exists = file_exists(self::GRAPH_PATH);
        $checks['graph_file'] = ['status' => $exists ? 'healthy' : 'disabled'];
        if ($exists) {
            $size = filesize(self::GRAPH_PATH);
            $checks['graph_file']['size_mb'] = round($size / 1048576, 1);
        }
        $cached = get_transient('kozmo_ai_graphify_cached');
        $checks['cache'] = ['status' => false !== $cached ? 'healthy' : 'pending'];
        $overall = 'disabled';
        foreach ($checks as $c) {
            if ($c['status'] === 'healthy') $overall = 'healthy';
        }
        return ['overall' => $overall, 'checks' => $checks];
    }

    public static function get_entity_context(int $max_entities = 30): string {
        $data = self::load();
        if (empty($data['entities'])) return '';

        $entities = array_slice($data['entities'], 0, $max_entities);
        $lines = [];
        foreach ($entities as $e) {
            $lines[] = "- {$e['label']} ({$e['type']}, community {$e['community']})";
        }
        return implode("\n", $lines);
    }

    public static function get_topic_hints(): string {
        $data = self::load();
        if (empty($data['communities'])) return '';

        $lines = [];
        foreach ($data['communities'] as $c) {
            $lines[] = sprintf('Topic cluster "%s" (%d entities): %s',
                $c['name'],
                $c['size'],
                implode(', ', $c['members'])
            );
        }
        return implode("\n", array_slice($lines, 0, 8));
    }

    private static function load(): array {
        $cache_valid = get_transient('kozmo_ai_graphify_cached');
        $cache_dir = self::cache_dir();

        if (false !== $cache_valid && $cache_dir) {
            $cache_file = $cache_dir . '/' . self::CACHE_FILE;
            if (file_exists($cache_file)) {
                $cached = file_get_contents($cache_file);
                if (false !== $cached) {
                    $data = json_decode($cached, true);
                    if (is_array($data)) return $data;
                }
            }
        }

        return self::build_and_cache($cache_dir);
    }

    private static function build_and_cache(?string $cache_dir): array {
        $path = self::GRAPH_PATH;
        if (!file_exists($path)) return ['entities' => [], 'communities' => []];

        $json = file_get_contents($path);
        if (false === $json || empty($json)) return ['entities' => [], 'communities' => []];

        $graph = json_decode($json, true);
        if (null === $graph || empty($graph['nodes'])) return ['entities' => [], 'communities' => []];

        $entities = [];
        $communities = [];

        foreach ($graph['nodes'] as $node) {
            $label = $node['label'] ?? '';
            $type  = $node['file_type'] ?? 'unknown';
            $community = $node['community'] ?? 0;
            if (empty($label)) continue;

            $entity = [
                'label'     => sanitize_text_field($label),
                'type'      => sanitize_text_field($type),
                'community' => (int) $community,
            ];

            $entities[] = $entity;
            if (!isset($communities[$community])) $communities[$community] = [];
            $communities[$community][] = $entity;
        }

        uasort($communities, static fn($a, $b) => count($b) <=> count($a));
        $community_summaries = [];
        $top_entities = [];
        $seen_labels = [];
        $idx = 0;

        foreach ($communities as $cid => $members) {
            if (count($members) < 3) continue;

            usort($members, static fn($a, $b) => strlen($b['label']) <=> strlen($a['label']));

            $sample = array_slice($members, 0, 12);
            $labels_sample = array_map(static fn($e) => $e['label'], $sample);

            $community_summaries[] = [
                'name'    => self::infer_cluster_name($labels_sample),
                'size'    => count($members),
                'members' => $labels_sample,
            ];

            foreach ($sample as $e) {
                if ($idx >= self::MAX_ENTITIES) break 2;
                if (isset($seen_labels[$e['label']])) continue;
                $seen_labels[$e['label']] = true;
                $top_entities[] = $e;
                $idx++;
            }
        }

        $data = ['entities' => $top_entities, 'communities' => $community_summaries];
        self::write_cache($cache_dir, $data);
        return $data;
    }

    private static function write_cache(?string $cache_dir, array $data): void {
        set_transient('kozmo_ai_graphify_cached', time(), self::CACHE_TTL);
        if (!$cache_dir) return;

        $payload = wp_json_encode($data);
        if (false === $payload) return;

        $tmp = $cache_dir . '/' . self::CACHE_FILE . '.tmp';
        $dst = $cache_dir . '/' . self::CACHE_FILE;

        if (file_put_contents($tmp, $payload) !== false) {
            rename($tmp, $dst);
        }
    }

    private static function cache_dir(): ?string {
        $uploads = wp_upload_dir();
        if (is_array($uploads) && !empty($uploads['basedir'])) {
            $dir = $uploads['basedir'] . '/kozmo-ai';
            if (!is_dir($dir)) {
                wp_mkdir_p($dir);
            }
            return is_dir($dir) ? $dir : null;
        }
        return null;
    }

    private static function infer_cluster_name(array $labels): string {
        $stops = ['class', 'interface', 'type', 'function', 'config', 'json', 'ts', 'php', 'js', 'file', 'service'];
        $filtered = array_values(array_diff($labels, $stops));
        if (empty($filtered)) return 'misc';
        $first = strtolower(reset($filtered));
        $parts = preg_split('/[_\-\s]+/', $first);
        return implode(' ', array_slice(array_filter($parts), 0, 3));
    }
}
