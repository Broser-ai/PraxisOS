<?php
/**
 * Plugin Name: by Pilar · midlertidig lukket
 * Description: Viser en midlertidig «lukket»-skærm for besøgende på bypilar.dk. wp-admin forbliver åbent. Slå fra ved at sætte BYPILAR_TEMPORARY_CLOSED til false.
 * Author: Broser-ai
 * Version: 1.0.0
 *
 * Must-use — aktiv automatisk. Fjern filen eller sæt constant til false for at åbne sitet igen.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Toggle: true = lukket for offentligheden, false = normalt site.
 * Kan også overrides i wp-config.php: define('BYPILAR_TEMPORARY_CLOSED', false);
 */
if (!defined('BYPILAR_TEMPORARY_CLOSED')) {
    define('BYPILAR_TEMPORARY_CLOSED', true);
}

/**
 * Hemmelig preview: /?bypilar_preview=åbn
 * Giver dig mulighed for at se det rigtige site uden at åbne for alle.
 */
if (!defined('BYPILAR_CLOSED_PREVIEW_KEY')) {
    define('BYPILAR_CLOSED_PREVIEW_KEY', 'pilar-preview');
}

add_action('template_redirect', 'bypilar_temporary_closed_gate', 0);

function bypilar_temporary_closed_gate(): void {
    if (!BYPILAR_TEMPORARY_CLOSED) {
        return;
    }

    // Preview-cookie / query
    if (isset($_GET['bypilar_preview']) && (string) $_GET['bypilar_preview'] === BYPILAR_CLOSED_PREVIEW_KEY) {
        setcookie('bypilar_preview', '1', time() + DAY_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true);
        return;
    }
    if (!empty($_COOKIE['bypilar_preview'])) {
        return;
    }

    // Lad admin / login / cron / ajax / REST (auth) igennem
    if (is_admin() || bypilar_closed_is_exempt_request()) {
        return;
    }

    if (is_user_logged_in() && current_user_can('manage_options')) {
        return;
    }

    bypilar_render_closed_screen();
    exit;
}

function bypilar_closed_is_exempt_request(): bool {
    $uri = $_SERVER['REQUEST_URI'] ?? '';

    $exempt_prefixes = [
        '/wp-admin',
        '/wp-login.php',
        '/wp-cron.php',
        '/xmlrpc.php',
    ];
    foreach ($exempt_prefixes as $p) {
        if (str_starts_with($uri, $p) || str_contains($uri, $p)) {
            return true;
        }
    }

    if (defined('DOING_CRON') && DOING_CRON) {
        return true;
    }
    if (defined('DOING_AJAX') && DOING_AJAX) {
        return true;
    }
    if (defined('REST_REQUEST') && REST_REQUEST) {
        return true;
    }

    return false;
}

function bypilar_render_closed_screen(): void {
    status_header(503);
    header('Retry-After: 86400');
    header('Content-Type: text/html; charset=utf-8');
    nocache_headers();

    $phone = '+45 93 95 20 41';
    $email = 'hej@bypilar.dk';
    $phone_href = 'tel:+4593952041';
    $email_href = 'mailto:hej@bypilar.dk?subject=' . rawurlencode('Tid hos by Pilar');

    echo '<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>by Pilar — vi gør klar</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,400;0,6..96,600;1,6..96,400&family=Karla:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --bg: #F5F0EB;
    --dark: #2D2420;
    --rose: #C49A82;
    --cream: #FAF5F0;
    --muted: #8A8078;
    --line: #E0D8D0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { min-height: 100%; }
  body {
    font-family: Karla, Helvetica Neue, Arial, sans-serif;
    background:
      radial-gradient(900px 480px at 12% -8%, rgba(196,154,130,0.28), transparent 70%),
      radial-gradient(700px 420px at 92% 8%, rgba(232,221,212,0.9), transparent 65%),
      var(--bg);
    color: var(--dark);
    -webkit-font-smoothing: antialiased;
  }
  .wrap {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 48px 24px;
  }
  .card {
    width: min(560px, 100%);
    text-align: center;
  }
  .mark {
    width: 56px; height: 56px; margin: 0 auto 28px;
    border: 1.2px solid var(--dark); border-radius: 999px;
    display: grid; place-items: center;
    font-family: "Bodoni Moda", Didot, Georgia, serif;
    font-size: 28px; line-height: 1;
  }
  .label {
    font-size: 11px; letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--rose); font-weight: 500;
  }
  h1 {
    margin-top: 14px;
    font-family: "Bodoni Moda", Didot, Georgia, serif;
    font-weight: 400;
    font-size: clamp(34px, 6vw, 48px);
    line-height: 1.12;
  }
  h1 em { color: var(--rose); font-style: italic; }
  p {
    margin: 18px auto 0;
    max-width: 42ch;
    font-size: 16px;
    line-height: 1.65;
    color: var(--muted);
  }
  .actions {
    margin-top: 36px;
    display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;
  }
  .btn {
    display: inline-block;
    font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase;
    font-weight: 500; padding: 15px 28px; text-decoration: none;
    transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
  }
  .btn-primary { background: var(--dark); color: var(--cream); }
  .btn-primary:hover { background: var(--rose); }
  .btn-outline {
    background: transparent; color: var(--dark);
    border: 1px solid var(--dark);
  }
  .btn-outline:hover { background: var(--dark); color: var(--cream); }
  .note {
    margin-top: 40px;
    padding-top: 24px;
    border-top: 1px solid var(--line);
    font-size: 13px;
    color: var(--muted);
  }
</style>
</head>
<body>
  <main class="wrap">
    <div class="card">
      <div class="mark" aria-hidden="true">P</div>
      <div class="label">by Pilar · Aarhus</div>
      <h1>Vi gør <em>klar</em> til dig</h1>
      <p>
        Online booking og websitet er midlertidigt lukket, mens vi finpudser den nye oplevelse.
        Har du brug for en tid i mellemtiden, så ring eller skriv — vi vender hurtigt tilbage.
      </p>
      <div class="actions">
        <a class="btn btn-primary" href="' . esc_url($phone_href) . '">Ring ' . esc_html($phone) . '</a>
        <a class="btn btn-outline" href="' . esc_attr($email_href) . '">Skriv til os</a>
      </div>
      <p class="note">Negle- &amp; fodpleje · Vi åbner snart igen online</p>
    </div>
  </main>
</body>
</html>';
}
