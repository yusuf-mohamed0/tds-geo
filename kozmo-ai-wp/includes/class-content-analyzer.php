<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class ContentAnalyzer {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function analyze_content_health(): array {
        global $wpdb;

        $thin_content = $wpdb->get_results(
            "SELECT ID, post_title, post_content, post_date
             FROM {$wpdb->posts}
             WHERE post_status = 'publish'
               AND (post_type = 'post' OR post_type = 'page')
               AND LENGTH(COALESCE(post_content, '')) < 500
             ORDER BY post_date DESC
             LIMIT 50"
        );

        $duplicate_titles = $wpdb->get_results(
            "SELECT post_title, COUNT(*) as cnt, GROUP_CONCAT(ID) as ids
             FROM {$wpdb->posts}
             WHERE post_status = 'publish' AND (post_type = 'post' OR post_type = 'page')
             GROUP BY post_title
             HAVING cnt > 1
             LIMIT 20"
        );

        $no_images = $wpdb->get_results(
            "SELECT p.ID, p.post_title
             FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_thumbnail_id'
             WHERE p.post_status = 'publish' AND p.post_type = 'post'
               AND pm.meta_id IS NULL
             LIMIT 20"
        );

        $no_meta = $wpdb->get_results(
            "SELECT p.ID, p.post_title
             FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id AND pm.meta_key = '_kozmo_ai_meta_title'
             WHERE p.post_status = 'publish' AND p.post_type = 'post'
               AND pm.meta_id IS NULL
             LIMIT 20"
        );

        $old_posts = $wpdb->get_results(
            "SELECT ID, post_title, post_modified
             FROM {$wpdb->posts}
             WHERE post_status = 'publish' AND post_type = 'post'
               AND post_modified < DATE_SUB(NOW(), INTERVAL 6 MONTH)
             ORDER BY post_modified ASC
             LIMIT 50"
        );

        return [
            'thin_content'       => count($thin_content),
            'thin_content_list'  => array_map(fn($p) => ['id' => $p->ID, 'title' => $p->post_title], $thin_content),
            'duplicate_titles'   => count($duplicate_titles),
            'duplicate_list'     => $duplicate_titles,
            'no_featured_images' => count($no_images),
            'no_featured_list'   => array_map(fn($p) => ['id' => $p->ID, 'title' => $p->post_title], $no_images),
            'no_meta_titles'     => count($no_meta),
            'no_meta_list'       => array_map(fn($p) => ['id' => $p->ID, 'title' => $p->post_title], $no_meta),
            'old_posts'          => count($old_posts),
            'old_posts_list'     => array_map(fn($p) => ['id' => $p->ID, 'title' => $p->post_title, 'modified' => $p->post_modified], $old_posts),
        ];
    }

    public static function keyword_coverage(): array {
        global $wpdb;
        $tag_keywords = $wpdb->get_results(
            "SELECT t.name, t.slug, t.count
             FROM {$wpdb->term_taxonomy} tt
             JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
             WHERE tt.taxonomy = 'post_tag'
             ORDER BY t.count DESC
             LIMIT 100"
        );

        $cat_keywords = $wpdb->get_results(
            "SELECT t.name, t.slug, t.count
             FROM {$wpdb->term_taxonomy} tt
             JOIN {$wpdb->terms} t ON tt.term_id = t.term_id
             WHERE tt.taxonomy = 'category'
             ORDER BY t.count DESC
             LIMIT 50"
        );

        return [
            'tags'       => $tag_keywords,
            'categories' => $cat_keywords,
            'total_tags' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy = 'post_tag'"),
            'total_cats' => (int) $wpdb->get_var("SELECT COUNT(*) FROM {$wpdb->term_taxonomy} WHERE taxonomy = 'category'"),
        ];
    }

    public static function detect_outdated_content(int $days = 180): array {
        global $wpdb;
        return $wpdb->get_results($wpdb->prepare(
            "SELECT ID, post_title, post_date, post_modified
             FROM {$wpdb->posts}
             WHERE post_status = 'publish' AND post_type = 'post'
               AND post_modified < DATE_SUB(NOW(), INTERVAL %d DAY)
             ORDER BY post_modified ASC",
            $days
        ), ARRAY_A);
    }

    public static function detect_cannibalization(): array {
        global $wpdb;
        // Find posts with similar titles
        $results = $wpdb->get_results(
            "SELECT LOWER(SUBSTRING_INDEX(post_title, ' ', 3)) as title_start,
                    COUNT(*) as cnt,
                    GROUP_CONCAT(ID) as ids,
                    GROUP_CONCAT(post_title SEPARATOR '||') as titles
             FROM {$wpdb->posts}
             WHERE post_status = 'publish' AND post_type = 'post'
             GROUP BY title_start
             HAVING cnt > 2
             ORDER BY cnt DESC
             LIMIT 20",
            ARRAY_A
        );

        return array_map(function($r) {
            $titles = explode('||', $r['titles']);
            return [
                'count'  => (int) $r['cnt'],
                'ids'    => explode(',', $r['ids']),
                'titles' => $titles,
            ];
        }, $results);
    }
}
