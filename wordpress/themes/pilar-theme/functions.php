<?php
/**
 * PILAR — Negle & Fodpleje theme
 * Hetzner / by Pilar klinik (app.bypilar.dk booking — not Planway).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('after_setup_theme', function () {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('html5', ['search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script']);

    register_nav_menus([
        'primary' => 'Primary Menu',
        'footer' => 'Footer Menu',
    ]);
});

add_action('wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'pilar-fonts',
        'https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,wght@0,400;0,500;1,400;1,500&family=Karla:wght@300;400;500;600;700&display=swap',
        [],
        null
    );
    // Bump assets so live caches drop http:// iframe + old CTAs after theme push.
    wp_enqueue_style('pilar-style', get_stylesheet_uri(), ['pilar-fonts'], '1.3.0-planway-total-kill');
    wp_enqueue_script('pilar-main', get_template_directory_uri() . '/js/main.js', [], '1.3.0-planway-total-kill', true);
});

add_action('wp_head', function () {
    $icon = get_template_directory_uri() . '/img/favicon.svg';
    echo '<link rel="icon" type="image/svg+xml" href="' . esc_url($icon) . '">' . "\n";
    if (is_front_page()) {
        echo '<meta name="description" content="Fodpleje og fodterapeut i Aarhus — book online hos by Pilar.">' . "\n";
    }
}, 1);

/**
 * Canonical public book URL (HTTPS). Prefer mu-plugin helper when loaded.
 */
function pilar_book_url(bool $embed = false): string
{
    if (function_exists('praxisos_book_url')) {
        return praxisos_book_url($embed);
    }
    return $embed
        ? 'https://app.bypilar.dk/t/bypilar/book?embed=1'
        : 'https://app.bypilar.dk/t/bypilar/book';
}

/**
 * Strip/replace Planway URLs + force HTTPS clinic booking + white-label copy.
 * Critical: live WP DB / menus may still contain Planway even after theme deploy.
 */
function pilar_rewrite_planway(string $html): string
{
    $book = pilar_book_url(false);
    $book_embed = pilar_book_url(true);

    // Any Planway URL → PraxisOS book (HTTPS)
    $html = preg_replace(
        '#https?://[^"\'\s<>]*planway\.com[^"\'\s<>]*#i',
        $book,
        $html
    ) ?? $html;

    // Mixed-content guard for clinic booking
    $html = str_ireplace('http://app.bypilar.dk', 'https://app.bypilar.dk', $html);

    // Prefer embed URL inside iframes that still point at bare book path
    $html = preg_replace(
        '#(<iframe[^>]+src=["\'])https://app\.bypilar\.dk/t/bypilar/book(?:\?embed=1)?(["\'])#i',
        '$1' . $book_embed . '$2',
        $html
    ) ?? $html;

    // Customer-facing: never brand PraxisOS on bypilar.dk
    $html = str_replace('via PraxisOS', 'hos by Pilar', $html);
    $html = str_replace('fra PraxisOS', 'hos by Pilar', $html);
    $html = str_replace(' · PraxisOS', '', $html);
    $html = str_replace('synkroniseres fra PraxisOS', 'opdateres løbende', $html);

    return $html;
}

/**
 * Replace unresolved Mailchimp shortcode + purge Planway from post content.
 */
add_filter('the_content', function ($content) {
    $content = str_replace(
        '[mc4wp_form id="newsletter"]',
        '<p style="margin:0"><a class="btn btn-primary" href="mailto:hej@bypilar.dk?subject=Nyhedsbrev">Tilmeld dig på hej@bypilar.dk</a></p>',
        $content
    );
    return pilar_rewrite_planway((string) $content);
}, 20);

add_filter('widget_text', function ($text) {
    return pilar_rewrite_planway((string) $text);
}, 20);

add_filter('widget_text_content', function ($text) {
    return pilar_rewrite_planway((string) $text);
}, 20);

/**
 * Menus: rewrite Planway custom links at runtime (DB menu items may still point there).
 */
add_filter('nav_menu_link_attributes', function ($atts) {
    if (!empty($atts['href']) && stripos((string) $atts['href'], 'planway.com') !== false) {
        $atts['href'] = pilar_book_url(false);
    }
    if (!empty($atts['href']) && stripos((string) $atts['href'], 'http://app.bypilar.dk') === 0) {
        $atts['href'] = str_ireplace('http://app.bypilar.dk', 'https://app.bypilar.dk', (string) $atts['href']);
    }
    return $atts;
}, 20);

add_filter('nav_menu_item_url', function ($url) {
    if (is_string($url) && stripos($url, 'planway.com') !== false) {
        return pilar_book_url(false);
    }
    if (is_string($url) && stripos($url, 'http://app.bypilar.dk') === 0) {
        return str_ireplace('http://app.bypilar.dk', 'https://app.bypilar.dk', $url);
    }
    return $url;
}, 20);

/**
 * Belt-and-suspenders: rewrite entire front-end HTML response so leftover Planway
 * in page builders / cached fragments / custom fields cannot leak to customers.
 */
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
        return;
    }
    ob_start(function ($html) {
        if (!is_string($html) || $html === '') {
            return $html;
        }
        return pilar_rewrite_planway($html);
    });
}, 0);

/**
 * Load a theme part HTML fragment (scraped from live Hostinger site).
 */
function pilar_part(string $name): void
{
    $path = get_template_directory() . '/parts/' . $name . '.phpfrag';
    if (!is_readable($path)) {
        return;
    }
    $html = file_get_contents($path);
    // Resolve newsletter shortcode in fragments (not run through the_content)
    $html = str_replace(
        '[mc4wp_form id="newsletter"]',
        '<p style="margin:0"><a class="btn btn-primary" href="mailto:hej@bypilar.dk?subject=Nyhedsbrev">Tilmeld dig på hej@bypilar.dk</a></p>',
        $html
    );
    // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted theme fragment
    echo pilar_rewrite_planway($html);
}

function pilar_fallback_primary_menu(): void
{
    $items = [
        ['/', 'Hjem'],
        ['/behandlinger/', 'Behandlinger'],
        ['/udekoerende/', 'Udekørende'],
        ['/booking/', 'Book Tid'],
        ['/om-os/', 'Om Os'],
    ];
    echo '<ul id="primaryMenu" class="nav-menu">';
    foreach ($items as [$path, $label]) {
        $url = home_url($path);
        $current = is_front_page() && $path === '/';
        echo '<li class="menu-item' . ($current ? ' current-menu-item' : '') . '"><a href="' . esc_url($url) . '">' . esc_html($label) . '</a></li>';
    }
    echo '</ul>';
}

function pilar_fallback_footer_menu(): void
{
    $items = [
        ['/', 'Hjem'],
        ['/behandlinger/', 'Behandlinger'],
        ['/udekoerende/', 'Udekørende'],
        ['/booking/', 'Book Tid'],
        ['/om-os/', 'Om Os'],
        ['/privatlivspolitik/', 'Privatlivspolitik'],
    ];
    echo '<ul class="footer-menu">';
    foreach ($items as [$path, $label]) {
        echo '<li class="menu-item"><a href="' . esc_url(home_url($path)) . '">' . esc_html($label) . '</a></li>';
    }
    echo '</ul>';
}
