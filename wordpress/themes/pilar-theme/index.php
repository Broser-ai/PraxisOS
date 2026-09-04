<?php
get_header();
?>
<main style="padding-top:130px;min-height:50vh">
  <div class="container" style="padding-bottom:80px">
    <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
      <article style="margin-bottom:48px">
        <h2 class="heading" style="font-size:28px;margin-bottom:12px"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
        <div style="font-size:15px;line-height:1.75;color:var(--muted)"><?php the_excerpt(); ?></div>
      </article>
    <?php endwhile; else : ?>
      <p class="label">Blog</p>
      <h1 class="heading" style="margin:12px 0 24px">Ingen indlæg endnu</h1>
      <p style="color:var(--muted)">Der er ingen blogindlæg at vise.</p>
    <?php endif; ?>
  </div>
</main>
<?php
get_footer();
