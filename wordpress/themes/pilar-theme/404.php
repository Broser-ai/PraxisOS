<?php
get_header();
?>
<main style="padding-top:130px;min-height:50vh">
  <div class="container" style="padding-bottom:80px;text-align:center">
    <p class="label">404</p>
    <h1 class="heading" style="margin:16px 0 24px">Siden findes ikke</h1>
    <a class="btn btn-primary" href="<?php echo esc_url(home_url('/')); ?>">Til forsiden</a>
  </div>
</main>
<?php
get_footer();
