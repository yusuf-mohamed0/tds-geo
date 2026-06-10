<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class SeoAuditor {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function audit_post(int $post_id): array {
        $post = get_post($post_id);
        if (!$post) return ['score' => 0, 'issues' => ['Post not found']];

        $score = 100;
        $issues = [];
        $warnings = [];
        $passes = [];

        // Title analysis
        $title = $post->post_title;
        $title_len = mb_strlen($title);
        if ($title_len < 30) { $score -= 10; $issues[] = 'Title too short (< 30 chars)'; }
        elseif ($title_len < 50) { $score -= 5; $warnings[] = 'Title could be longer (aim for 50-60 chars)'; }
        elseif ($title_len > 70) { $score -= 5; $warnings[] = 'Title exceeds 70 characters'; }
        else { $passes[] = 'Title length is optimal'; }

        // Content length
        $content = wp_strip_all_tags($post->post_content);
        $word_count = str_word_count($content);
        if ($word_count < 300) { $score -= 15; $issues[] = 'Content too thin (< 300 words)'; }
        elseif ($word_count < 600) { $score -= 8; $warnings[] = 'Content could be expanded (aim for 1000+ words)'; }
        elseif ($word_count >= 2000) { $passes[] = 'Comprehensive content length'; }
        else { $passes[] = 'Good content length'; }

        // Images
        $has_featured = has_post_thumbnail($post_id);
        if (!$has_featured) { $score -= 5; $warnings[] = 'No featured image set'; }
        else { $passes[] = 'Featured image present'; }

        $img_count = preg_match_all('/<img[^>]+>/i', $post->post_content, $matches);
        if ($img_count < 1 && $word_count > 300) { $score -= 5; $issues[] = 'No images in content'; }
        elseif ($img_count >= 3) { $passes[] = 'Good image use in content'; }

        // Headings
        preg_match_all('/<h[1-6][^>]*>/i', $post->post_content, $heading_matches);
        $heading_count = count($heading_matches[0]);
        if ($heading_count < 2 && $word_count > 500) { $score -= 5; $issues[] = 'Too few headings for content length'; }
        else { $passes[] = 'Headings present'; }

        // Check for H1
        $has_h1 = preg_match('/<h1[^>]*>/i', $post->post_content);
        if ($has_h1) { $score -= 5; $warnings[] = 'Multiple H1 tags in content'; }

        // Meta
        $meta_title = get_post_meta($post_id, '_vireon_meta_title', true);
        $meta_desc = get_post_meta($post_id, '_vireon_meta_description', true);
        if (empty($meta_title)) { $score -= 10; $issues[] = 'Missing meta title'; }
        else { $passes[] = 'Meta title set'; }
        if (empty($meta_desc)) { $score -= 10; $issues[] = 'Missing meta description'; }
        else { $passes[] = 'Meta description set'; }

        // Focus keyword in title
        $focus = get_post_meta($post_id, '_vireon_focus_keyword', true);
        if (!empty($focus)) {
            if (stripos($title, $focus) === false) { $score -= 5; $warnings[] = 'Focus keyword not in title'; }
            else { $passes[] = 'Focus keyword found in title'; }
            if (stripos($content, $focus) === false) { $score -= 5; $warnings[] = 'Focus keyword not in content'; }
            else { $passes[] = 'Focus keyword found in content'; }
        }

        // Internal links
        preg_match_all('/href="(?:' . preg_quote(get_bloginfo('url'), '/') . '[^"]*)"/i', $post->post_content, $internal_links);
        $internal_count = count($internal_links[0]);
        if ($internal_count < 1 && $word_count > 500) { $score -= 5; $warnings[] = 'No internal links in content'; }
        elseif ($internal_count >= 3) { $passes[] = 'Good internal linking'; }

        // External links
        $site_url_quoted = preg_quote(get_bloginfo('url'), '/');
        preg_match_all('/href="(https?:\/\/(?!' . $site_url_quoted . ')[^"]+)"/i', $post->post_content, $external_links);
        if (count($external_links[0]) >= 2) { $passes[] = 'External references present'; }

        // Reading time
        $reading_time = ceil($word_count / 200);
        $passes[] = "Estimated reading time: {$reading_time} min";

        // Schema
        $has_schema = get_post_meta($post_id, '_vireon_schema', true);
        if (!empty($has_schema)) { $passes[] = 'Schema markup present'; }

        // Slug analysis
        $slug = $post->post_name;
        if (strlen($slug) > 50) { $score -= 3; $warnings[] = 'URL slug is too long'; }

        $score = max(0, min(100, $score));

        return [
            'score'     => $score,
            'issues'    => $issues,
            'warnings'  => $warnings,
            'passes'    => $passes,
            'word_count' => $word_count,
            'reading_time' => $reading_time,
            'focus_keyword' => $focus,
        ];
    }
}
