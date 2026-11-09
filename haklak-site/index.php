<?php
require __DIR__ . '/inc/layout.php';
$P = 'home';
page_start($P, (string) v($P, 'meta_title'), (string) v($P, 'meta_description'));
?>
  <section class="main-visual">
    <?php if (v($P, 'banner_image')): ?><img src="<?= e(v($P, 'banner_image')) ?>" alt=""><?php endif; ?>
    <div class="visual-text">
      <strong><?= br(v($P, 'banner_title')) ?></strong>
      <span><?= t($P, 'banner_sub') ?></span>
    </div>
  </section>

  <div class="content-area">

    <aside class="left-sidebar">
      <h3 class="box-title"><?= t($P, 'quick_title') ?></h3>
      <div class="quick-menu">
        <?php foreach (v($P, 'quick_links') as $l): ?>
        <a href="<?= href($l['url'] ?? '') ?>"><?= e($l['label'] ?? '') ?></a>
        <?php endforeach; ?>
      </div>
    </aside>

    <main class="main-content">
      <h3 class="section-title"><?= t($P, 'books_title') ?> <a class="more" href="<?= href(v($P, 'books_more_url')) ?>"><?= t($P, 'books_more') ?></a></h3>
      <div class="featured-menu">
        <?php foreach (v($P, 'books') as $b): ?>
        <a class="featured-item" href="<?= href($b['url'] ?? '') ?>">
          <?php if (!empty($b['image'])): ?><img src="<?= e($b['image']) ?>" alt="<?= e($b['title'] ?? '') ?>"><?php else: ?><div class="thumb"><?= t($P, 'books_empty') ?></div><?php endif; ?>
          <p><?= e($b['title'] ?? '') ?></p>
        </a>
        <?php endforeach; ?>
      </div>

      <h3 class="section-title"><?= t($P, 'today_title') ?></h3>
      <article class="main-article today">
        <div class="big"><?= t($P, 'today_big') ?></div>
        <div>
          <h2><?= t($P, 'today_heading') ?></h2>
          <p><?= br(v($P, 'today_text')) ?></p>
        </div>
      </article>

      <h3 class="section-title"><?= t($P, 'notice_title') ?> <a class="more" href="<?= href(v($P, 'notice_more_url')) ?>"><?= t($P, 'notice_more') ?></a></h3>
      <ul class="board-list">
        <?php foreach (v($P, 'notices') as $n): ?>
        <li><a href="<?= href($n['url'] ?? '') ?>"><?= e($n['title'] ?? '') ?></a><time><?= e($n['date'] ?? '') ?></time></li>
        <?php endforeach; ?>
      </ul>
    </main>

    <aside class="right-sidebar">
      <div class="contact-box">
        <h3><?= t($P, 'contact_title') ?></h3>
        <p><?= br(v($P, 'contact_text')) ?></p>
        <a class="btn btn-primary btn-block" href="<?= href(v($P, 'contact_btn1_url')) ?>"><?= t($P, 'contact_btn1') ?></a>
        <a class="btn btn-block" href="<?= href(v($P, 'contact_btn2_url')) ?>"><?= t($P, 'contact_btn2') ?></a>
      </div>
      <?php foreach (v($P, 'side_banners') as $s): ?>
        <?php if (!empty($s['image'])): ?>
      <a class="side-banner" href="<?= href($s['url'] ?? '') ?>"><img src="<?= e($s['image']) ?>" alt="<?= e($s['title'] ?? '') ?>"></a>
        <?php else: ?>
      <a class="side-banner text" href="<?= href($s['url'] ?? '') ?>"><strong><?= e($s['title'] ?? '') ?></strong><span><?= e($s['text'] ?? '') ?></span></a>
        <?php endif; ?>
      <?php endforeach; ?>
    </aside>

  </div>
<?php page_end(); ?>
