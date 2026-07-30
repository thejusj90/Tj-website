<?php if (!defined('ABSPATH')) { exit; } ?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<header class="site-header">
  <div class="site-shell header-inner">
    <a class="brand" href="<?php echo esc_url(home_url('/')); ?>" aria-label="Home">
      <?php echo esc_html(get_bloginfo('name') ?: 'THEJUS JOSEPH'); ?>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-menu" aria-label="Toggle navigation">
      <span></span><span></span><span></span>
    </button>
    <nav class="site-nav" id="site-menu" aria-label="Primary navigation">
      <?php
      wp_nav_menu(array(
        'theme_location' => 'primary',
        'container' => false,
        'fallback_cb' => function () {
            echo '<ul><li><a href="#journey">Journey</a></li><li><a href="#impact">Work</a></li><li><a href="' . esc_url(home_url('/contact/')) . '">Contact</a></li></ul>';
        },
      ));
      ?>
    </nav>
  </div>
</header>
