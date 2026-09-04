<?php
get_header();
?>
<main style="padding-top:130px;min-height:50vh">
  <div class="container" style="padding-bottom:80px">
    <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
      <h1 class="heading" style="font-size:clamp(28px,3vw,44px);margin-bottom:24px"><?php the_title(); ?></h1>
      <div class="entry-content" style="font-size:15px;line-height:1.75;color:var(--muted)">
        <?php the_content(); ?>
      </div>
    <?php endwhile; endif; ?>
  </div>
</main>
<?php
get_footer();
