<?php
/**
 * Plugin Name: by Pilar · Klinik Bridge
 * Description: Kobler WordPress (bypilar.dk) til klinik-booking på app.bypilar.dk — services, embed, klippekort.
 * Author: Broser-ai
 * Version: 1.3.0
 *
 * Must-use plugin — altid aktiv. Cursor kan opdatere denne fil via Git/SSH.
 *
 * White-label: customer-facing copy uses "by Pilar" / "Klinik" / app.bypilar.dk —
 * never Planway, and never the internal product name on public pages.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('PRAXISOS_BASE_URL')) {
    $env = getenv('PRAXISOS_BASE_URL');
    define('PRAXISOS_BASE_URL', ($env !== false && $env !== '') ? $env : 'https://app.bypilar.dk');
}
if (!defined('PRAXISOS_INTERNAL_URL')) {
    $internal = getenv('PRAXISOS_INTERNAL_URL');
    define('PRAXISOS_INTERNAL_URL', $internal !== false && $internal !== '' ? $internal : PRAXISOS_BASE_URL);
}
if (!defined('PRAXISOS_TENANT')) {
    define('PRAXISOS_TENANT', 'bypilar');
}

/** Canonical HTTPS book URL (embed). */
function praxisos_book_url(bool $embed = false, string $service = ''): string {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    // Force https on public customer booking (never http:// or Planway).
    if (stripos($base, 'http://app.bypilar.dk') === 0) {
        $base = 'https://app.bypilar.dk';
    }
    $url = $base . '/t/' . rawurlencode(PRAXISOS_TENANT) . '/book';
    $qs = [];
    if ($embed) {
        $qs['embed'] = '1';
    }
    if ($service !== '') {
        $qs['service'] = $service;
    }
    if ($qs) {
        $url .= '?' . http_build_query($qs);
    }
    return $url;
}

function praxisos_klinik_url(): string {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    if (stripos($base, 'http://app.bypilar.dk') === 0) {
        $base = 'https://app.bypilar.dk';
    }
    return $base . '/login';
}

/**
 * Hent JSON fra klinik-API (intern URL først — Docker-netværk).
 */
function praxisos_fetch_json(string $path) {
    $urls = [
        rtrim(PRAXISOS_INTERNAL_URL, '/') . $path,
        rtrim(PRAXISOS_BASE_URL, '/') . $path,
    ];
    $urls = array_values(array_unique($urls));
    $last_error = null;
    foreach ($urls as $url) {
        $res = wp_remote_get($url, [
            'timeout' => 10,
            'headers' => ['Accept' => 'application/json'],
        ]);
        if (is_wp_error($res)) {
            $last_error = $res->get_error_message();
            continue;
        }
        $code = wp_remote_retrieve_response_code($res);
        if ($code < 200 || $code >= 300) {
            $last_error = 'HTTP ' . $code;
            continue;
        }
        $body = json_decode(wp_remote_retrieve_body($res), true);
        if (!is_array($body)) {
            $last_error = 'invalid_json';
            continue;
        }
        return $body;
    }
    return new WP_Error('praxisos_fetch_failed', $last_error ?: 'unknown');
}

add_action('wp_enqueue_scripts', function () {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    if (stripos($base, 'http://app.bypilar.dk') === 0) {
        $base = 'https://app.bypilar.dk';
    }
    $tenant = PRAXISOS_TENANT;
    wp_enqueue_script(
        'praxisos-embed',
        $base . '/embed/v1/' . rawurlencode($tenant),
        [],
        '1.3.0',
        true
    );
});

/** White-label: hide product badge on customer pages. */
add_filter('language_attributes', function ($output) {
    if (is_admin()) {
        return $output;
    }
    if (stripos($output, 'data-praxis-no-badge') !== false) {
        return $output;
    }
    return trim($output . ' data-praxis-no-badge');
});

/**
 * [praxis_book] [praxis_book service="fod-std"]
 */
add_shortcode('praxis_book', function ($atts) {
    $a = shortcode_atts([
        'service' => '',
        'label' => 'Book tid',
        'class' => 'btn btn-primary praxis-book-btn',
    ], $atts, 'praxis_book');

    $attr = $a['service'] !== '' ? ' data-praxis-book="' . esc_attr($a['service']) . '"' : ' data-praxis-book';
    return '<button type="button" class="' . esc_attr($a['class']) . '"' . $attr . '>'
        . esc_html($a['label'])
        . '</button>';
});

/**
 * Staff entry — white-label on customer host.
 * [praxis_klinik] or [praxis_kom_i_gang]
 */
add_shortcode('praxis_klinik', function ($atts) {
    $a = shortcode_atts([
        'label' => 'Kom i gang · Klinik',
        'class' => 'btn btn-outline praxis-klinik-link',
    ], $atts, 'praxis_klinik');
    return '<a class="' . esc_attr($a['class']) . '" href="' . esc_url(praxisos_klinik_url()) . '" rel="noopener">'
        . esc_html($a['label'])
        . '</a>';
});
add_shortcode('praxis_kom_i_gang', function ($atts) {
    return do_shortcode('[praxis_klinik]');
});

/**
 * [praxis_services] — service cards fra klinik-API (SoT).
 */
add_shortcode('praxis_services', function () {
    $data = praxisos_fetch_json('/api/v1/' . rawurlencode(PRAXISOS_TENANT) . '/services');
    if (is_wp_error($data)) {
        return '<p class="praxis-services-error" style="color:var(--muted)">Behandlinger kunne ikke hentes lige nu ('
            . esc_html($data->get_error_message())
            . '). Prøv igen senere, eller ring til by Pilar.</p>';
    }
    $services = $data['services'] ?? [];
    if (!$services) {
        return '<p style="color:var(--muted)">Ingen aktive behandlinger.</p>';
    }

    ob_start();
    echo '<div class="praxis-services-grid" style="display:grid;gap:20px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">';
    foreach ($services as $s) {
        if (isset($s['active']) && !$s['active']) {
            continue;
        }
        $id = (string) ($s['id'] ?? '');
        $name = (string) ($s['name'] ?? '');
        $short = (string) ($s['shortDescription'] ?? $s['description'] ?? '');
        $price = isset($s['price']) ? (int) $s['price'] : 0;
        $dur = $s['durationMin'] ?? null;
        $dur_label = $dur !== null ? esc_html((string) $dur) . ' min' : 'Efter aftale';
        $addons = $s['addOns'] ?? [];

        echo '<article class="praxis-service-card" style="border:1px solid var(--grayL,#E0D8D0);background:var(--white,#fff);padding:24px 22px;border-radius:4px">';
        echo '<p class="label" style="margin-bottom:8px">' . esc_html((string) ($s['category'] ?? '')) . '</p>';
        echo '<h3 class="heading" style="font-size:24px;margin-bottom:10px">' . esc_html($name) . '</h3>';
        echo '<p style="font-size:14px;line-height:1.65;color:var(--muted,#8A8078);margin-bottom:16px">' . esc_html($short) . '</p>';
        if (is_array($addons) && count($addons) > 0) {
            echo '<p style="font-size:12px;color:var(--gray,#A09890);margin-bottom:14px">Tilvalg: ';
            $bits = [];
            foreach ($addons as $a) {
                $an = (string) ($a['name'] ?? '');
                if ($an === '') {
                    continue;
                }
                if (!empty($a['chargeable']) && isset($a['price']) && $a['price'] !== null) {
                    $bits[] = esc_html($an) . ' (+' . (int) $a['price'] . ' kr)';
                } else {
                    $bits[] = esc_html($an);
                }
            }
            echo implode(' · ', $bits);
            echo '</p>';
        }
        echo '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:18px;padding-top:12px;border-top:1px solid var(--grayL,#E0D8D0)">';
        echo '<span style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--gray)">' . $dur_label . '</span>';
        echo '<span class="heading" style="font-size:22px">' . esc_html((string) $price) . ' kr</span>';
        echo '</div>';
        echo '<button type="button" class="btn btn-primary" style="width:100%" data-praxis-book="' . esc_attr($id) . '">Book tid</button>';
        echo '</article>';
    }
    echo '</div>';
    return (string) ob_get_clean();
});

/**
 * [praxis_vouchers] — klippekort (link + oversigt).
 */
add_shortcode('praxis_vouchers', function () {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    if (stripos($base, 'http://app.bypilar.dk') === 0) {
        $base = 'https://app.bypilar.dk';
    }
    $url = $base . '/t/' . rawurlencode(PRAXISOS_TENANT) . '/klippekort';

    $packages = [
        ['Almindelig fodbehandling', 5, 1350],
        ['Almindelig fodbehandling', 10, 2700],
        ['Udvidet fodbehandling', 5, 1800],
        ['Udvidet fodbehandling', 10, 3200],
        ['Luksus fodbehandling', 5, 2470],
        ['Luksus fodbehandling', 10, 4390],
    ];

    ob_start();
    echo '<section class="praxis-vouchers">';
    echo '<p class="label" style="margin-bottom:8px">Klippekort</p>';
    echo '<h2 class="heading" style="font-size:clamp(24px,3vw,36px);margin-bottom:20px">Spar med klippekort</h2>';
    echo '<div style="display:grid;gap:14px;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-bottom:24px">';
    foreach ($packages as [$name, $clips, $price]) {
        echo '<div style="border:1px solid var(--grayL,#E0D8D0);padding:18px 16px;background:var(--cream,#FAF5F0)">';
        echo '<div class="heading" style="font-size:18px;margin-bottom:6px">' . esc_html($name) . '</div>';
        echo '<div style="font-size:13px;color:var(--muted)">' . (int) $clips . ' klip</div>';
        echo '<div class="heading" style="font-size:22px;margin-top:10px">' . number_format((int) $price, 0, ',', '.') . ' kr</div>';
        echo '</div>';
    }
    echo '</div>';
    echo '<a class="btn btn-outline" href="' . esc_url($url) . '" target="_blank" rel="noopener">Køb klippekort hos by Pilar →</a>';
    echo '</section>';
    return (string) ob_get_clean();
});

add_shortcode('praxis_scan_link', function ($atts) {
    $a = shortcode_atts([
        'label' => 'Klinik',
        'path' => '/login',
    ], $atts, 'praxis_scan_link');
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    if (stripos($base, 'http://app.bypilar.dk') === 0) {
        $base = 'https://app.bypilar.dk';
    }
    $url = $base . $a['path'];
    return '<a class="praxis-scan-link" href="' . esc_url($url) . '" rel="noopener">'
        . esc_html($a['label'])
        . '</a>';
});

add_shortcode('praxis_agents', function () {
    $html = '<div class="praxis-agents" data-praxis-agents="1">';
    $html .= '<p><strong>by Pilar</strong></p>';
    $html .= '<ul>';
    $html .= '<li><a href="' . esc_url(praxisos_book_url()) . '" rel="noopener">Booking</a></li>';
    $html .= '<li>' . do_shortcode('[praxis_klinik]') . '</li>';
    $html .= '</ul></div>';
    return $html;
});

add_action('rest_api_init', function () {
    register_rest_route('praxisos/v1', '/status', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            $url = rtrim(PRAXISOS_INTERNAL_URL, '/') . '/api/agents/status';
            $res = wp_remote_get($url, ['timeout' => 8]);
            if (is_wp_error($res)) {
                return new WP_REST_Response([
                    'ok' => false,
                    'error' => $res->get_error_message(),
                    'clinic' => PRAXISOS_BASE_URL,
                    'internal' => PRAXISOS_INTERNAL_URL,
                ], 502);
            }
            $code = wp_remote_retrieve_response_code($res);
            $body = json_decode(wp_remote_retrieve_body($res), true);
            return new WP_REST_Response([
                'ok' => $code >= 200 && $code < 300,
                'clinic' => PRAXISOS_BASE_URL,
                'tenant' => PRAXISOS_TENANT,
                'agents' => $body,
            ], 200);
        },
    ]);

    register_rest_route('praxisos/v1', '/services', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            $data = praxisos_fetch_json('/api/v1/' . rawurlencode(PRAXISOS_TENANT) . '/services');
            if (is_wp_error($data)) {
                return new WP_REST_Response(['ok' => false, 'error' => $data->get_error_message()], 502);
            }
            return new WP_REST_Response(['ok' => true, 'data' => $data], 200);
        },
    ]);

    register_rest_route('praxisos/v1', '/ping', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            return [
                'ok' => true,
                'site' => get_bloginfo('name'),
                'home' => home_url('/'),
                'clinic' => PRAXISOS_BASE_URL,
                'book' => praxisos_book_url(true),
                'tenant' => PRAXISOS_TENANT,
                'controlled_by' => 'cursor-ssh-wpcli',
            ];
        },
    ]);
});

add_action('admin_menu', function () {
    add_options_page(
        'Klinik · by Pilar',
        'Klinik',
        'manage_options',
        'praxisos-bypilar',
        'praxisos_bypilar_admin_page'
    );
});

function praxisos_bypilar_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $base = esc_url(rtrim(PRAXISOS_BASE_URL, '/'));
    $book = esc_url(praxisos_book_url(true));
    echo '<div class="wrap">';
    echo '<h1>Klinik · by Pilar</h1>';
    echo '<p>WordPress styres via Cursor/SSH. Booking kører på <code>app.bypilar.dk</code> (ikke Planway).</p>';
    echo '<p><strong>Klinik base:</strong> <a href="' . $base . '" target="_blank" rel="noopener">' . $base . '</a></p>';
    echo '<ul>';
    echo '<li><a href="' . $book . '" target="_blank" rel="noopener">Booking embed</a></li>';
    echo '<li><a href="' . esc_url(praxisos_klinik_url()) . '" target="_blank" rel="noopener">Kom i gang · Klinik</a></li>';
    echo '<li><a href="' . $base . '/api/v1/bypilar/services" target="_blank" rel="noopener">Services API</a></li>';
    echo '</ul>';
    echo '<p>Shortcodes: <code>[praxis_services]</code> <code>[praxis_vouchers]</code> <code>[praxis_book]</code> <code>[praxis_klinik]</code></p>';
    echo '</div>';
}

add_action('wp_head', function () {
    echo '<style id="praxisos-bypilar-bridge">
.praxis-book-btn{cursor:pointer}
.praxis-klinik-link{margin-left:8px}
.praxis-agents{border:1px solid #d9cfbc;background:#f3ede1;padding:16px 18px;border-radius:12px}
.praxis-agents a{color:#8a6a3d}
.popular-card{font:inherit;color:inherit;background:inherit}
</style>';
});
