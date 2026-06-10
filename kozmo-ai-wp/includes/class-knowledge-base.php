<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class KnowledgeBase {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function store(string $data_type, $data, string $data_key = ''): bool {
        global $wpdb;

        if (empty($data_key)) {
            $data_key = $data_type . '_' . gmdate('Y-m-d_H');
        }

        $json = wp_json_encode($data);
        $checksum = md5($json);

        // Check existing
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT id FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE data_type = %s AND data_key = %s",
            $data_type,
            $data_key
        ));

        if ($existing) {
            return (bool) $wpdb->update(
                $wpdb->prefix . 'kozmo_ai_knowledge',
                ['data_value' => $json, 'checksum' => $checksum, 'synced' => 0, 'updated_at' => current_time('mysql')],
                ['id' => $existing],
                ['%s', '%s', '%d', '%s'],
                ['%d']
            );
        }

        return (bool) $wpdb->insert(
            $wpdb->prefix . 'kozmo_ai_knowledge',
            [
                'data_type'  => $data_type,
                'data_key'   => $data_key,
                'data_value' => $json,
                'checksum'   => $checksum,
                'synced'     => 0,
            ],
            ['%s', '%s', '%s', '%s', '%d']
        );
    }

    public static function get(string $data_type, string $data_key = '') {
        global $wpdb;

        if (!empty($data_key)) {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT data_value FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE data_type = %s AND data_key = %s ORDER BY updated_at DESC LIMIT 1",
                $data_type,
                $data_key
            ));
        } else {
            $row = $wpdb->get_row($wpdb->prepare(
                "SELECT data_value FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE data_type = %s ORDER BY updated_at DESC LIMIT 1",
                $data_type
            ));
        }

        if (!$row) return null;
        return json_decode($row->data_value, true);
    }

    public static function get_by_type(string $data_type): array {
        global $wpdb;
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT data_key, data_value, updated_at FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE data_type = %s ORDER BY updated_at DESC",
            $data_type
        ), ARRAY_A);

        $results = [];
        foreach ($rows as $row) {
            $results[] = [
                'key'        => $row['data_key'],
                'value'      => json_decode($row['data_value'], true),
                'updated_at' => $row['updated_at'],
            ];
        }
        return $results;
    }

    public static function set_synced(): void {
        global $wpdb;
        $wpdb->query("UPDATE {$wpdb->prefix}kozmo_ai_knowledge SET synced = 1 WHERE synced = 0");
    }

    public static function get_unsynced(): array {
        global $wpdb;
        return $wpdb->get_results(
            "SELECT * FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE synced = 0 ORDER BY created_at ASC",
            ARRAY_A
        );
    }

    public static function get_stats(): array {
        global $wpdb;
        $total = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_knowledge");
        $types = $wpdb->get_results("SELECT data_type, COUNT(*) as count FROM {$wpdb->prefix}kozmo_ai_knowledge GROUP BY data_type", OBJECT_K);
        $unsynced = (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->prefix}kozmo_ai_knowledge WHERE synced = 0");

        $by_type = [];
        foreach ($types as $t => $data) {
            $by_type[$t] = (int) $data->count;
        }

        return [
            'total'    => $total,
            'by_type'  => $by_type,
            'unsynced' => $unsynced,
        ];
    }
}
