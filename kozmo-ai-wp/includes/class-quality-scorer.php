<?php
namespace KozmoAI_WP;
defined('ABSPATH') || exit;

class QualityScorer {
    private static ?self $instance = null;

    public static function init(): void {
        if (null === self::$instance) self::$instance = new self();
    }

    public static function score_article(array $article): array {
        $score = 100;
        $metrics = [];
        $improvements = [];

        // 1. Title quality
        $title = $article['title'] ?? '';
        $title_len = mb_strlen($title);
        if ($title_len < 20) { $score -= 10; $improvements[] = 'Title too short'; $metrics['title_score'] = 30; }
        elseif ($title_len > 70) { $score -= 5; $improvements[] = 'Title too long'; $metrics['title_score'] = 70; }
        else { $metrics['title_score'] = 100; }

        // 2. Content length
        $content = $article['content'] ?? $article['content_html'] ?? '';
        $text = wp_strip_all_tags($content);
        $word_count = str_word_count($text);
        if ($word_count < 500) { $score -= 15; $improvements[] = 'Content too short';
            $metrics['length_score'] = max(0, ($word_count / 1000) * 100); }
        elseif ($word_count < 1000) { $score -= 5; $improvements[] = 'Consider expanding content';
            $metrics['length_score'] = 70; }
        else { $metrics['length_score'] = 100; }

        // 3. Readability (paragraph length)
        $paragraphs = explode("\n\n", $text);
        $long_paragraphs = 0;
        foreach ($paragraphs as $p) {
            if (str_word_count(trim($p)) > 100) $long_paragraphs++;
        }
        if ($long_paragraphs > 0) {
            $penalty = min(10, $long_paragraphs * 3);
            $score -= $penalty;
            $improvements[] = "{$long_paragraphs} paragraphs too long";
            $metrics['readability_score'] = max(50, 100 - $penalty * 5);
        } else {
            $metrics['readability_score'] = 100;
        }

        // 4. Heading structure
        $h_count = preg_match_all('/<h[2-6][^>]*>/i', $content, $h_matches);
        if ($h_count < 2 && $word_count > 500) {
            $score -= 10;
            $improvements[] = 'Missing heading structure';
            $metrics['heading_score'] = 40;
        } else {
            $metrics['heading_score'] = min(100, 60 + $h_count * 10);
        }

        // 5. Images
        $img_count = preg_match_all('/<img[^>]+>/i', $content, $img_matches);
        $alt_missing = 0;
        foreach ($img_matches[0] as $img_tag) {
            if (stripos($img_tag, 'alt=') === false) $alt_missing++;
        }
        if ($img_count < 1 && $word_count > 300) {
            $score -= 8;
            $improvements[] = 'No images in content';
            $metrics['image_score'] = 20;
        } else {
            $metrics['image_score'] = min(100, 50 + $img_count * 15);
            if ($alt_missing > 0) {
                $score -= $alt_missing * 2;
                $improvements[] = "{$alt_missing} images missing alt text";
                $metrics['image_score'] -= $alt_missing * 10;
            }
        }

        // 6. Meta completeness
        $has_meta_title = !empty($article['meta_title']);
        $has_meta_desc = !empty($article['meta_description']);
        if (!$has_meta_title) { $score -= 10; $improvements[] = 'Missing meta title'; }
        if (!$has_meta_desc) { $score -= 10; $improvements[] = 'Missing meta description'; }
        $metrics['meta_score'] = (($has_meta_title ? 50 : 0) + ($has_meta_desc ? 50 : 0));

        // 7. Focus keyword usage
        $keyword = $article['focus_keyword'] ?? '';
        if (!empty($keyword)) {
            $kw_in_title = mb_stripos($title, $keyword) !== false;
            $kw_in_content = mb_stripos($text, $keyword) !== false;
            $kw_density = substr_count(mb_strtolower($text), mb_strtolower($keyword)) / max(1, $word_count) * 100;

            if (!$kw_in_title) { $score -= 5; $improvements[] = 'Keyword not in title'; }
            if (!$kw_in_content) { $score -= 5; $improvements[] = 'Keyword not found in content'; }
            if ($kw_density > 3) { $score -= 5; $improvements[] = 'Keyword stuffing detected'; }
            $metrics['keyword_score'] = ($kw_in_title ? 30 : 0) + ($kw_in_content ? 30 : 0) + ($kw_density <= 3 ? 40 : 0);
        } else {
            $metrics['keyword_score'] = 0;
        }

        // 8. Internal links
        $site_url_quoted = preg_quote(get_bloginfo('url'), '/');
        preg_match_all('/href="(?:' . $site_url_quoted . '[^"]*)"/i', $content, $internal);
        if (count($internal[0]) < 1) {
            $score -= 5;
            $improvements[] = 'No internal links';
            $metrics['linking_score'] = 0;
        } else {
            $metrics['linking_score'] = min(100, count($internal[0]) * 20);
        }

        // 9. External references
        preg_match_all('/href="(https?:\/\/(?!' . $site_url_quoted . ')[^"]+)"/i', $content, $external);
        if (count($external[0]) < 1) {
            $score -= 3;
            $metrics['reference_score'] = 0;
        } else {
            $metrics['reference_score'] = min(100, count($external[0]) * 15);
        }

        // 10. Schema presence
        if (!empty($article['schema'])) {
            $metrics['schema_score'] = 100;
        } else {
            $score -= 3;
            $metrics['schema_score'] = 0;
        }

        $score = max(0, min(100, $score));

        return [
            'score'        => round($score, 2),
            'passed'       => $score >= 95,
            'word_count'   => $word_count,
            'paragraphs'   => count($paragraphs),
            'images'       => $img_count,
            'headings'     => $h_count,
            'metrics'      => $metrics,
            'improvements' => $improvements,
            'grade'        => $score >= 95 ? 'A' : ($score >= 85 ? 'B' : ($score >= 70 ? 'C' : 'D')),
        ];
    }
}
