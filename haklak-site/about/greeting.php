<?php
require dirname(__DIR__) . '/inc/layout.php';
$P = 'about_greeting';
page_start($P, v($P, 'page_title') . ' | 학락', '', true);
?>
      <h2><?= t($P, 'heading') ?></h2>
      <?php if (v($P, 'image')): ?><img class="page-image" src="<?= e(v($P, 'image')) ?>" alt=""><?php endif; ?>
      <?= paras(v($P, 'body')) ?>
      <p class="sign"><?= t($P, 'sign_label') ?><strong><?= t($P, 'sign_name') ?></strong></p>
<?php page_end(true); ?>
