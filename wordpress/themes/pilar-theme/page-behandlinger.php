<?php
/**
 * Template Name: Behandlinger
 * Slug: behandlinger
 *
 * Priser og ydelser hentes fra PraxisOS via [praxis_services]
 * (single source of truth — ikke hardcoded i temaet).
 */
get_header();
?>
<main style="padding-top:130px;min-height:70vh">
  <div class="container" style="padding-bottom:40px">
    <p class="label" style="margin-bottom:12px">Behandlinger &amp; priser</p>
    <h1 class="heading" style="font-size:clamp(28px,3.5vw,44px);margin-bottom:16px">Vores behandlinger</h1>
    <p style="font-size:15px;color:var(--muted);max-width:560px;line-height:1.7;margin-bottom:40px">
      Fodbehandling, manicure og klippekort — book direkte. Priser synkroniseres fra PraxisOS.
    </p>
    <?php echo do_shortcode('[praxis_services]'); ?>
    <div style="margin-top:48px">
      <?php echo do_shortcode('[praxis_vouchers]'); ?>
    </div>
  </div>
</main>
<?php
get_footer();
