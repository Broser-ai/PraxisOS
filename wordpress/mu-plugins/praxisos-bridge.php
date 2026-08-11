<?php
/**
 * Plugin Name: PraxisOS · by Pilar Bridge
 * Description: Kobler WordPress (bypilar.dk) til PraxisOS — booking-embed, agent-status, scan-links.
 * Author: Broser-ai / PraxisOS
 * Version: 1.0.0
 *
 * Must-use plugin — altid aktiv. Cursor kan opdatere denne fil via Git/SSH.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('PRAXISOS_BASE_URL')) {
    define('PRAXISOS_BASE_URL', getenv('PRAXISOS_BASE_URL') ?: 'http://app.bypilar.dk');
}
if (!defined('PRAXISOS_TENANT')) {
    define('PRAXISOS_TENANT', 'bypilar');
}

/**
 * Front-end: PraxisOS booking embed + agent CTA’er
 */
add_action('wp_enqueue_scripts', function () {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    $tenant = PRAXISOS_TENANT;
    wp_enqueue_script(
        'praxisos-embed',
        $base . '/embed/v1/' . rawurlencode($tenant),
        [],
        '1.0.0',
        true
    );
});

/**
 * Shortcodes til tema/sider
 * [praxis_book] [praxis_book service="fod-scan"]
 * [praxis_scan_link]
 * [praxis_agents]
 */
add_shortcode('praxis_book', function ($atts) {
    $a = shortcode_atts([
        'service' => '',
        'label' => 'Book tid',
        'class' => 'praxis-book-btn',
    ], $atts, 'praxis_book');

    $attr = $a['service'] !== '' ? ' data-praxis-book="' . esc_attr($a['service']) . '"' : ' data-praxis-book';
    return '<button type="button" class="' . esc_attr($a['class']) . '"' . $attr . '>'
        . esc_html($a['label'])
        . '</button>';
});

add_shortcode('praxis_scan_link', function ($atts) {
    $a = shortcode_atts([
        'label' => 'Klinik · fod-scan',
        'path' => '/scan',
    ], $atts, 'praxis_scan_link');
    $url = rtrim(PRAXISOS_BASE_URL, '/') . $a['path'];
    return '<a class="praxis-scan-link" href="' . esc_url($url) . '" target="_blank" rel="noopener">'
        . esc_html($a['label'])
        . '</a>';
});

add_shortcode('praxis_agents', function () {
    $base = rtrim(PRAXISOS_BASE_URL, '/');
    $html = '<div class="praxis-agents" data-praxis-agents="1">';
    $html .= '<p><strong>by Pilar · PraxisOS agenter</strong></p>';
    $html .= '<ul>';
    $html .= '<li><a href="' . esc_url($base . '/admin/agents/automation') . '" target="_blank" rel="noopener">Agent-automation</a></li>';
    $html .= '<li><a href="' . esc_url($base . '/scan') . '" target="_blank" rel="noopener">Fod-scan · Nexus</a></li>';
    $html .= '<li><a href="' . esc_url($base . '/admin/bird') . '" target="_blank" rel="noopener">Bird SMS</a></li>';
    $html .= '<li><a href="' . esc_url($base . '/journal') . '" target="_blank" rel="noopener">Journal</a></li>';
    $html .= '</ul></div>';
    return $html;
});

/**
 * REST: proxy agent-status fra PraxisOS (så Cursor/WP kan læse health)
 * GET /wp-json/praxisos/v1/status
 */
add_action('rest_api_init', function () {
    register_rest_route('praxisos/v1', '/status', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            $url = rtrim(PRAXISOS_BASE_URL, '/') . '/api/agents/status';
            $res = wp_remote_get($url, ['timeout' => 8]);
            if (is_wp_error($res)) {
                return new WP_REST_Response([
                    'ok' => false,
                    'error' => $res->get_error_message(),
                    'praxisos' => PRAXISOS_BASE_URL,
                ], 502);
            }
            $code = wp_remote_retrieve_response_code($res);
            $body = json_decode(wp_remote_retrieve_body($res), true);
            return new WP_REST_Response([
                'ok' => $code >= 200 && $code < 300,
                'praxisos' => PRAXISOS_BASE_URL,
                'tenant' => PRAXISOS_TENANT,
                'agents' => $body,
            ], 200);
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
                'praxisos' => PRAXISOS_BASE_URL,
                'tenant' => PRAXISOS_TENANT,
                'controlled_by' => 'cursor-ssh-wpcli',
            ];
        },
    ]);
});

/**
 * Admin: PraxisOS panel under Indstillinger
 */
add_action('admin_menu', function () {
    add_options_page(
        'PraxisOS · by Pilar',
        'PraxisOS',
        'manage_options',
        'praxisos-bypilar',
        'praxisos_bypilar_admin_page'
    );
});

function praxisos_bypilar_admin_page() {
    if (!current_user_can('manage_options')) {
        return;
    }
    $base = esc_url(PRAXISOS_BASE_URL);
    echo '<div class="wrap">';
    echo '<h1>PraxisOS · by Pilar</h1>';
    echo '<p>WordPress styres via Cursor/SSH (<code>scripts/wp.sh</code>). Klinik-OS kører parallelt.</p>';
    echo '<p><strong>PraxisOS base:</strong> <a href="' . $base . '" target="_blank" rel="noopener">' . $base . '</a></p>';
    echo '<ul>';
    echo '<li><a href="' . $base . '/scan" target="_blank">Fod-scan</a></li>';
    echo '<li><a href="' . $base . '/admin/agents/automation" target="_blank">Agent-automation</a></li>';
    echo '<li><a href="' . $base . '/t/bypilar/book" target="_blank">Booking</a></li>';
    echo '<li><a href="' . esc_url(rest_url('praxisos/v1/ping')) . '" target="_blank">WP bridge ping</a></li>';
    echo '</ul>';
    echo '<p>Shortcodes: <code>[praxis_book]</code> <code>[praxis_book service="fod-scan"]</code> <code>[praxis_agents]</code> <code>[praxis_scan_link]</code></p>';
    echo '</div>';
}

/**
 * Minimal brand CSS for book-knapper (tema-uafhængig)
 */
add_action('wp_head', function () {
    echo '<style id="praxisos-bypilar-bridge">
.praxis-book-btn{appearance:none;background:#1f1d18;color:#f3ede1;border:0;border-radius:999px;padding:12px 22px;font:600 14px/1 system-ui,sans-serif;letter-spacing:.04em;cursor:pointer}
.praxis-book-btn:hover{opacity:.9}
.praxis-agents{border:1px solid #d9cfbc;background:#f3ede1;padding:16px 18px;border-radius:12px}
.praxis-agents a{color:#8a6a3d}
</style>';
});
