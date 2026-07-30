<?php
if (!defined('ABSPATH')) { exit; }
get_header();
$hero = thejus_editorial_image_or_default('hero_image', '/assets/images/hero-demo.webp');
$signature = thejus_editorial_image_or_default('signature_image', '/assets/images/signature-demo.webp');
?>
<main>
  <section class="hero">
    <div class="site-shell hero-grid">
      <div class="hero-copy">
        <div class="eyebrow"><?php echo esc_html(get_theme_mod('hero_eyebrow', 'Founder. Operator. Ecosystem Builder.')); ?></div>
        <h1 class="hero-title"><?php echo esc_html(get_theme_mod('hero_title', 'Three ecosystems. One mission.')); ?></h1>
        <p class="hero-sub"><?php echo esc_html(get_theme_mod('hero_text', "I’ve experienced the startup ecosystem as a founder, operated it at scale, and helped build a new category.")); ?></p>
        <img class="signature" src="<?php echo esc_url($signature); ?>" alt="Signature">
      </div>
      <div class="hero-visual" aria-hidden="true">
        <img src="<?php echo esc_url($hero); ?>" alt="">
      </div>
    </div>
  </section>

  <section class="stats" aria-label="Key metrics">
    <div class="site-shell stats-grid">
      <?php for ($i = 1; $i <= 4; $i++) : ?>
        <div class="stat">
          <div class="stat-value"><?php echo esc_html(get_theme_mod("stat_{$i}_value")); ?></div>
          <div class="stat-label"><?php echo esc_html(get_theme_mod("stat_{$i}_label")); ?></div>
        </div>
      <?php endfor; ?>
    </div>
  </section>

  <section class="section" id="journey">
    <div class="site-shell">
      <div class="section-heading-row">
        <div>
          <div class="section-kicker"><?php echo esc_html(get_theme_mod('journey_kicker', 'The Trilogy')); ?></div>
          <h2 class="section-heading"><?php echo esc_html(get_theme_mod('journey_title', 'Three seats. Three perspectives.')); ?></h2>
        </div>
        <div class="section-nav" aria-hidden="true"><span class="round-btn">←</span><span class="round-btn is-dark">→</span></div>
      </div>

      <div class="journey-grid">
        <?php for ($i = 1; $i <= 3; $i++) :
          $img = thejus_editorial_image_or_default("journey_{$i}_image", "/assets/images/journey-{$i}.webp");
        ?>
          <article class="journey-card">
            <div class="journey-card-content">
              <div class="card-no">0<?php echo (int) $i; ?></div>
              <h3><?php echo esc_html(get_theme_mod("journey_{$i}_title")); ?></h3>
              <p><?php echo esc_html(get_theme_mod("journey_{$i}_text")); ?></p>
              <div class="journey-rule"></div>
            </div>
            <img src="<?php echo esc_url($img); ?>" alt="">
          </article>
        <?php endfor; ?>
      </div>

      <div class="impact-box" id="impact">
        <div class="impact-top">
          <h2 class="impact-heading"><?php echo esc_html(get_theme_mod('impact_heading', 'Now, I build what ecosystems need next.')); ?></h2>
          <a class="impact-arrow" href="<?php echo esc_url(home_url('/work/')); ?>" aria-label="View work">↗</a>
        </div>
        <div class="impact-grid">
          <?php
          $impact = array(
            array('For Founders','Resources, tools and funding insights.','book'),
            array('For Incubators','Playbooks, templates and frameworks.','building'),
            array('For Ecosystems','Strategy, networks and collaborations.','network'),
            array('For Impact','Programs that create measurable change.','growth'),
          );
          foreach ($impact as $item) : ?>
            <div class="impact-item">
              <div class="impact-icon" aria-hidden="true">
                <?php if ($item[2] === 'book') : ?>
                  <svg viewBox="0 0 32 32"><path d="M4 6c5 0 8 1 12 4v17c-4-3-7-4-12-4V6Z"/><path d="M28 6c-5 0-8 1-12 4v17c4-3 7-4 12-4V6Z"/></svg>
                <?php elseif ($item[2] === 'building') : ?>
                  <svg viewBox="0 0 32 32"><path d="M4 11 16 4l12 7"/><path d="M6 11h20M8 13v12m5-12v12m6-12v12m5-12v12M4 27h24"/></svg>
                <?php elseif ($item[2] === 'network') : ?>
                  <svg viewBox="0 0 32 32"><circle cx="7" cy="11" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="21" cy="23" r="3"/><circle cx="8" cy="24" r="3"/><path d="m10 12 11-3M9 14l10 7M11 24h7"/></svg>
                <?php else : ?>
                  <svg viewBox="0 0 32 32"><path d="M4 26h7v-7H4v7Zm17 0h7V14h-7v12ZM12 26h7V8h-7v18Z"/><path d="m4 12 7-5 5 3 10-7"/></svg>
                <?php endif; ?>
              </div>
              <div class="impact-title"><?php echo esc_html($item[0]); ?></div>
              <p><?php echo esc_html($item[1]); ?></p>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </section>
</main>
<?php get_footer(); ?>
