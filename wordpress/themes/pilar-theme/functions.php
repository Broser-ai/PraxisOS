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
    wp_enqueue_style('pilar-style', get_stylesheet_uri(), ['pilar-fonts'], '1.2.0-planway-kill');
    wp_enqueue_script('pilar-main', get_template_directory_uri() . '/js/main.js', [], '1.2.0-planway-kill', true);
});

add_action('wp_head', function () {
    $icon = get_template_directory_uri() . '/img/favicon.svg';
    echo '<link rel="icon" type="image/svg+xml" href="' . esc_url($icon) . '">' . "\n";
    if (is_front_page()) {
        echo '<meta name="description" content="Fodpleje og fodterapeut i Aarhus — book online hos by Pilar.">' . "\n";
    }
}, 1);

/**
 * Replace unresolved Mailchimp shortcode with a simple mailto CTA.
 */
add_filter('the_content', function ($content) {
    return str_replace(
        '[mc4wp_form id="newsletter"]',
        '<p style="margin:0"><a class="btn btn-primary" href="mailto:hej@bypilar.dk?subject=Nyhedsbrev">Tilmeld dig på hej@bypilar.dk</a></p>',
        $content
    );
});

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
    // Hard purge: never serve Planway booking URLs from theme fragments
    $book = function_exists('praxisos_book_url')
        ? praxisos_book_url(false)
        : 'https://app.bypilar.dk/t/bypilar/book';
    $book_embed = function_exists('praxisos_book_url')
        ? praxisos_book_url(true)
        : 'https://app.bypilar.dk/t/bypilar/book?embed=1';
    $html = preg_replace(
        '#https?://[^"\']*planway\.com[^"\']*#i',
        $book,
        $html
    ) ?? $html;
    $html = str_ireplace('http://app.bypilar.dk', 'https://app.bypilar.dk', $html);
    $html = str_replace(
        'https://app.bypilar.dk/t/bypilar/book?embed=1',
        $book_embed,
        $html
    );
    // Customer-facing: never brand PraxisOS on bypilar.dk
    $html = str_replace('via PraxisOS', 'hos by Pilar', $html);
    $html = str_replace('fra PraxisOS', 'hos by Pilar', $html);
    $html = str_replace(' · PraxisOS', '', $html);
    $html = str_replace('synkroniseres fra PraxisOS', 'opdateres løbende', $html);
    // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted theme fragment
    echo $html;
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
