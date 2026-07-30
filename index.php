<?php
if (!defined('ABSPATH')) { exit; }
get_header();
?>
<main class="content-area">
  <div class="site-shell">
    <?php if (have_posts()) : while (have_posts()) : the_post(); ?>
      <article <?php post_class(); ?>>
        <h1><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h1>
        <?php the_excerpt(); ?>
      </article>
    <?php endwhile; the_posts_pagination(); else : ?>
      <p><?php esc_html_e('Nothing found.', 'thejus-editorial'); ?></p>
    <?php endif; ?>
  </div>
</main>
<?php get_footer(); ?>
