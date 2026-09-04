<?php
/**
 * Template Name: Book Tid
 *
 * Public booking — HTTPS iframe to app.bypilar.dk only.
 */
get_header();

$book_embed = function_exists('praxisos_book_url')
    ? praxisos_book_url(true)
    : 'https://app.bypilar.dk/t/bypilar/book?embed=1';
?>
<main style="padding-top:130px;min-height:70vh">
  <div class="container booking-section">
    <p class="label" style="margin-bottom:12px">Online Booking</p>
    <h2 class="heading" style="font-size:clamp(28px,3.5vw,44px);margin-bottom:16px">Book din behandling</h2>
    <p style="font-size:15px;color:var(--muted);margin-bottom:40px;line-height:1.7">
      Vælg behandling, dato og tid herunder. Du booker direkte hos by Pilar og modtager automatisk bekræftelse på e-mail og SMS-påmindelse 24 timer før.
    </p>

    <div class="booking-embed" style="margin-bottom:28px">
      <p style="margin-bottom:16px">
        <?php echo do_shortcode('[praxis_book label="Åbn booking"]'); ?>
        <a class="btn btn-outline" href="<?php echo esc_url(home_url('/behandlinger/')); ?>" style="margin-left:8px">Se priser</a>
        <?php echo do_shortcode('[praxis_klinik]'); ?>
      </p>
      <iframe
        src="<?php echo esc_url($book_embed); ?>"
        style="width:100%;min-height:720px;border:1px solid var(--grayL);border-radius:12px;background:#fff"
        title="Book behandling hos by Pilar"
        loading="lazy"
        allow="clipboard-write; payment"
        referrerpolicy="strict-origin-when-cross-origin"
      ></iframe>
    </div>
  </div>
</main>

<section class="newsletter">
  <div class="newsletter-inner">
    <p class="label" style="margin-bottom:16px">Nyhedsbrev</p>
    <h3>Tips, tilbud &amp; <em>inspiration</em></h3>
    <div class="newsletter-form">
      <p style="margin:0"><a class="btn btn-primary" href="mailto:hej@bypilar.dk?subject=Nyhedsbrev">Tilmeld dig på hej@bypilar.dk</a></p>
    </div>
  </div>
</section>
<?php
get_footer();
