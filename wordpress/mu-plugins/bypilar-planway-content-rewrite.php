<?php
/**
 * Plugin Name: by Pilar · Planway content kill
 * Description: Runtime rewrite of legacy Planway URLs/iframes to PraxisOS HTTPS booking — even from old DB HTML.
 * Author: Broser-ai
 * Version: 1.0.0
 *
 * Must-use plugin — always on. Customer-facing pages must never emit planway.com.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('BYPILAR_BOOK_URL')) {
    define('BYPILAR_BOOK_URL', 'https://app.bypilar.dk/t/bypilar/book');
}
if (!defined('BYPILAR_BOOK_EMBED_URL')) {
    define('BYPILAR_BOOK_EMBED_URL', 'https://app.bypilar.dk/t/bypilar/book?embed=1');
}

/**
 * Useful query keys to preserve when rewriting Planway → PraxisOS.
 *
 * @var string[]
 */
const BYPILAR_PLANWAY_KEEP_QUERY = ['service', 'treatment', 'behandling', 'id', 'product', 'sku'];

/**
 * True when a URL points at Planway (any subdomain / path).
 */
function bypilar_is_planway_url(string $url): bool
{
    return (bool) preg_match('#https?://[^/\s"\'<>]*planway\.com#i', $url)
        || (bool) preg_match('#(^|["\'=\s])//[^/\s"\'<>]*planway\.com#i', $url);
}

/**
 * Rewrite one Planway (or mixed) booking URL to PraxisOS book.
 * Preserves useful query params when present; otherwise drops the query.
 */
function bypilar_rewrite_planway_url(string $url, bool $as_embed = false): string
{
    $book = 'https://app.bypilar.dk/t/bypilar/book';
    $keep = [];

    // parse_url works without WordPress (PHPUnit / CLI fixtures).
    $parts = parse_url($url);
    if (is_array($parts) && !empty($parts['query']) && is_string($parts['query'])) {
        parse_str($parts['query'], $params);
        if (is_array($params)) {
            foreach (BYPILAR_PLANWAY_KEEP_QUERY as $key) {
                if (!empty($params[$key]) && is_scalar($params[$key])) {
                    $keep[$key] = (string) $params[$key];
                }
            }
        }
    }

    if ($as_embed) {
        $keep['embed'] = '1';
    }

    if (!$keep) {
        return $as_embed ? BYPILAR_BOOK_EMBED_URL : BYPILAR_BOOK_URL;
    }

    return $book . '?' . http_build_query($keep);
}

/**
 * Force http://app.bypilar.dk → https://app.bypilar.dk (any path/query).
 */
function bypilar_force_https_app_bypilar(string $html): string
{
    return preg_replace('#http://app\.bypilar\.dk#i', 'https://app.bypilar.dk', $html) ?? $html;
}

/**
 * Purge Planway from arbitrary HTML (post content, widgets, menus, full page).
 * - href=*planway.com* → HTTPS PraxisOS book (preserve useful query)
 * - iframe src=*planway.com* → HTTPS PraxisOS embed
 * - leftover bare planway URLs → book URL
 * - http://app.bypilar.dk → https://app.bypilar.dk
 */
function bypilar_purge_planway_html(string $html): string
{
    if ($html === '') {
        return $html;
    }

    $has_planway = stripos($html, 'planway') !== false;
    $has_http_app = stripos($html, 'http://app.bypilar.dk') !== false;

    if (!$has_planway && !$has_http_app) {
        return $html;
    }
    if (!$has_planway && $has_http_app) {
        return bypilar_force_https_app_bypilar($html);
    }

    $html = bypilar_force_https_app_bypilar($html);

    // iframe src → embed
    $html = preg_replace_callback(
        '#(<iframe\b[^>]*?\bsrc\s*=\s*)([\'"])([^\'"]*planway\.com[^\'"]*)(\2)#is',
        static function (array $m): string {
            return $m[1] . $m[2] . bypilar_rewrite_planway_url($m[3], true) . $m[4];
        },
        $html
    ) ?? $html;

    // href → book (non-embed)
    $html = preg_replace_callback(
        '#(\bhref\s*=\s*)([\'"])([^\'"]*planway\.com[^\'"]*)(\2)#i',
        static function (array $m): string {
            return $m[1] . $m[2] . bypilar_rewrite_planway_url($m[3], false) . $m[4];
        },
        $html
    ) ?? $html;

    // Any remaining bare planway absolute URLs
    $html = preg_replace_callback(
        '#https?://[^\s"\'<>]*planway\.com[^\s"\'<>]*#i',
        static function (array $m): string {
            return bypilar_rewrite_planway_url($m[0], false);
        },
        $html
    ) ?? $html;

    return $html;
}

/**
 * Content / widget / menu filters — catch post_content still stored with Planway.
 */
foreach (['the_content', 'widget_text', 'widget_block_content', 'wp_nav_menu_items'] as $hook) {
    add_filter($hook, 'bypilar_purge_planway_html', 1);
    add_filter($hook, 'bypilar_purge_planway_html', 999);
}

add_filter('nav_menu_link_attributes', static function ($atts) {
    if (!is_array($atts) || empty($atts['href']) || !is_string($atts['href'])) {
        return $atts;
    }
    $href = $atts['href'];
    if (stripos($href, 'planway.com') !== false) {
        $atts['href'] = bypilar_rewrite_planway_url($href, false);
    } elseif (stripos($href, 'http://app.bypilar.dk') === 0) {
        $atts['href'] = bypilar_force_https_app_bypilar($href);
    }
    return $atts;
}, 1);

/**
 * Full-page safety net: theme fragments, Elementor, cached HTML, etc.
 */
add_action('template_redirect', static function (): void {
    if (is_admin()) {
        return;
    }
    if (function_exists('wp_doing_ajax') && wp_doing_ajax()) {
        return;
    }
    if (function_exists('wp_doing_cron') && wp_doing_cron()) {
        return;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return;
    }
    if (defined('WP_CLI') && WP_CLI) {
        return;
    }
    ob_start('bypilar_purge_planway_html');
}, 0);
