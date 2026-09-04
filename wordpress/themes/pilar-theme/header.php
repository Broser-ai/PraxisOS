<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<nav class="site-nav" id="siteNav">
  <div class="container nav-inner">
    <a href="<?php echo esc_url(home_url('/')); ?>" class="nav-logo">
      <svg width="36" height="36" viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="22.5" stroke="#2D2420" stroke-width="1.2"/><text x="24" y="31" text-anchor="middle" font-family="Bodoni Moda, serif" font-size="26" fill="#2D2420">P</text></svg>
      <div>
        <div class="nav-logo-text">PILAR</div>
        <div class="nav-logo-sub">Negle &amp; Fodpleje</div>
      </div>
    </a>

    <button class="menu-toggle" onclick="document.getElementById('primaryMenu').classList.toggle('open')" aria-label="Menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="8" x2="20" y2="8"/><line x1="4" y1="16" x2="20" y2="16"/></svg>
    </button>

    <?php
    wp_nav_menu([
        'theme_location' => 'primary',
        'container' => false,
        'menu_id' => 'primaryMenu',
        'menu_class' => 'nav-menu',
        'fallback_cb' => 'pilar_fallback_primary_menu',
    ]);
    ?>
  </div>
</nav>
