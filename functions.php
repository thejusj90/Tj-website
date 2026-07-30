<?php
/**
 * Theme functions.
 */
if (!defined('ABSPATH')) { exit; }

function thejus_editorial_setup() {
    add_theme_support('title-tag');
    add_theme_support('post-thumbnails');
    add_theme_support('custom-logo');
    add_theme_support('html5', array('search-form','comment-form','comment-list','gallery','caption','style','script'));
    register_nav_menus(array(
        'primary' => __('Primary Menu', 'thejus-editorial'),
    ));
}
add_action('after_setup_theme', 'thejus_editorial_setup');

function thejus_editorial_assets() {
    wp_enqueue_style(
        'thejus-editorial-fonts',
        'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
        array(),
        null
    );
    wp_enqueue_style('thejus-editorial-style', get_stylesheet_uri(), array('thejus-editorial-fonts'), '1.0.0');
    wp_enqueue_script('thejus-editorial-script', get_template_directory_uri() . '/assets/js/theme.js', array(), '1.0.0', true);
}
add_action('wp_enqueue_scripts', 'thejus_editorial_assets');

function thejus_editorial_customize_register($wp_customize) {
    $wp_customize->add_section('thejus_home', array(
        'title' => __('Homepage Content', 'thejus-editorial'),
        'priority' => 30,
    ));

    $settings = array(
        'hero_eyebrow' => array('Founder. Operator. Ecosystem Builder.', 'sanitize_text_field'),
        'hero_title' => array('Three ecosystems. One mission.', 'sanitize_text_field'),
        'hero_text' => array("I’ve experienced the startup ecosystem as a founder, operated it at scale, and helped build a new category.", 'sanitize_textarea_field'),
        'journey_kicker' => array('The Trilogy', 'sanitize_text_field'),
        'journey_title' => array('Three seats. Three perspectives.', 'sanitize_text_field'),
        'impact_heading' => array('Now, I build what ecosystems need next.', 'sanitize_text_field'),
    );

    foreach ($settings as $id => $data) {
        $wp_customize->add_setting($id, array('default' => $data[0], 'sanitize_callback' => $data[1]));
        $wp_customize->add_control($id, array(
            'label' => ucwords(str_replace('_', ' ', $id)),
            'section' => 'thejus_home',
            'type' => ($id === 'hero_text') ? 'textarea' : 'text',
        ));
    }

    $wp_customize->add_setting('hero_image', array('sanitize_callback' => 'absint'));
    $wp_customize->add_control(new WP_Customize_Media_Control($wp_customize, 'hero_image', array(
        'label' => __('Hero portrait', 'thejus-editorial'),
        'section' => 'thejus_home',
        'mime_type' => 'image',
    )));

    $wp_customize->add_setting('signature_image', array('sanitize_callback' => 'absint'));
    $wp_customize->add_control(new WP_Customize_Media_Control($wp_customize, 'signature_image', array(
        'label' => __('Signature image', 'thejus-editorial'),
        'section' => 'thejus_home',
        'mime_type' => 'image',
    )));

    $stats = array(
        1 => array('15+', 'Years in ecosystems'),
        2 => array('250+', 'Startups supported'),
        3 => array('75+', 'Startups funded'),
        4 => array('₹17Cr+', 'Funding facilitated'),
    );
    foreach ($stats as $i => $stat) {
        $wp_customize->add_setting("stat_{$i}_value", array('default' => $stat[0], 'sanitize_callback' => 'sanitize_text_field'));
        $wp_customize->add_control("stat_{$i}_value", array('label' => "Stat {$i} value", 'section' => 'thejus_home'));
        $wp_customize->add_setting("stat_{$i}_label", array('default' => $stat[1], 'sanitize_callback' => 'sanitize_text_field'));
        $wp_customize->add_control("stat_{$i}_label", array('label' => "Stat {$i} label", 'section' => 'thejus_home'));
    }

    $cards = array(
        1 => array('The Founder', 'I built a startup and experienced the gaps firsthand.'),
        2 => array('The Program Builder', 'At T-Hub, I led Lab32 and helped 110+ startups scale and raise capital.'),
        3 => array('The Category Builder', 'At FiiRE Goa, I built the TourismTech vertical from the ground up.'),
    );
    foreach ($cards as $i => $card) {
        $wp_customize->add_setting("journey_{$i}_title", array('default' => $card[0], 'sanitize_callback' => 'sanitize_text_field'));
        $wp_customize->add_control("journey_{$i}_title", array('label' => "Journey {$i} title", 'section' => 'thejus_home'));
        $wp_customize->add_setting("journey_{$i}_text", array('default' => $card[1], 'sanitize_callback' => 'sanitize_textarea_field'));
        $wp_customize->add_control("journey_{$i}_text", array('label' => "Journey {$i} text", 'section' => 'thejus_home', 'type' => 'textarea'));
        $wp_customize->add_setting("journey_{$i}_image", array('sanitize_callback' => 'absint'));
        $wp_customize->add_control(new WP_Customize_Media_Control($wp_customize, "journey_{$i}_image", array(
            'label' => "Journey {$i} image",
            'section' => 'thejus_home',
            'mime_type' => 'image',
        )));
    }
}
add_action('customize_register', 'thejus_editorial_customize_register');

function thejus_editorial_image_or_default($setting, $default_path, $size = 'full') {
    $id = (int) get_theme_mod($setting);
    if ($id) {
        $url = wp_get_attachment_image_url($id, $size);
        if ($url) { return $url; }
    }
    return get_template_directory_uri() . $default_path;
}
