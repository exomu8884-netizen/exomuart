<?php
/* 공통 틀: 머리말·메뉴·(하위 페이지) 경로와 왼쪽 소메뉴·꼬리말. 모든 문구는 관리자 '사이트 공통'에서 바꿉니다. */
declare(strict_types=1);
require_once __DIR__ . '/bootstrap.php';

/* 지금 주소가 속한 대메뉴와 소메뉴 찾기 */
function menu_position(): array
{
    $path = current_path();
    foreach (menu() as $m) {
        foreach ($m['subs'] as $s) {
            if ($s['url'] === $path) {
                return [$m, $s];
            }
        }
    }
    return [null, null];
}

function page_start(string $page, string $title, string $description = '', bool $sub = false): void
{
    [$group, $item] = menu_position();
    $site = '_site';
    ?>
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= e($title) ?></title>
  <?php if ($description !== ''): ?><meta name="description" content="<?= e($description) ?>"><?php endif; ?>
  <meta property="og:title" content="<?= e($title) ?>">
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body>
<div class="site-wrapper">

  <header class="site-header">
    <a class="site-logo" href="/">
      <?php if (v($site, 'logo_image')): ?><img src="<?= e(v($site, 'logo_image')) ?>" alt="<?= t($site, 'logo_text') ?>" class="logo-img"><?php else: ?><?= t($site, 'logo_text') ?><?php endif; ?>
      <small><?= t($site, 'logo_sub') ?></small>
    </a>
    <form class="header-search" action="https://www.google.com/search" method="get" target="_blank" role="search">
      <input type="hidden" name="as_sitesearch" value="haklak.net">
      <input type="search" name="q" placeholder="<?= t($site, 'search_placeholder') ?>" aria-label="사이트 검색">
      <button type="submit"><?= t($site, 'search_button') ?></button>
      <button type="button" class="menu-toggle" aria-label="메뉴 열기" aria-expanded="false"
        onclick="var n=document.querySelector('.main-nav'),o=n.classList.toggle('open');this.setAttribute('aria-expanded',o);this.textContent=o?'✕':'☰'">☰</button>
    </form>
  </header>

  <nav class="main-nav" aria-label="주 메뉴">
    <ul>
      <li><a href="/"><?= t($site, 'home_label') ?></a></li>
      <?php foreach (menu() as $m): ?>
      <li class="<?= $m['subs'] ? 'has-sub' : '' ?><?= $group && $group['label'] === $m['label'] ? ' on' : '' ?>">
        <a href="<?= href($m['url']) ?>"><?= e($m['label']) ?></a>
        <?php if ($m['subs']): ?>
        <ul class="sub">
          <?php foreach ($m['subs'] as $s): ?><li><a href="<?= href($s['url']) ?>"><?= e($s['label']) ?></a></li><?php endforeach; ?>
        </ul>
        <?php endif; ?>
      </li>
      <?php endforeach; ?>
    </ul>
  </nav>
    <?php
    if ($sub) {
        $heading = (string) v($page, 'page_title');
        ?>
  <div class="page-head">
    <div class="crumb"><span><a href="/"><?= t($site, 'home_label') ?></a></span><?php if ($group): ?><span><?= e($group['label']) ?></span><?php endif; ?><span><?= e($heading) ?></span></div>
    <h1><?= e($heading) ?></h1>
  </div>
  <div class="content-area sub-page">
    <aside class="left-sidebar">
      <?php if ($group): ?>
      <h3 class="box-title"><?= e($group['label']) ?></h3>
      <div class="quick-menu">
        <?php foreach ($group['subs'] as $s): ?>
        <a href="<?= href($s['url']) ?>"<?= $item && $s['url'] === $item['url'] ? ' class="on"' : '' ?>><?= e($s['label']) ?></a>
        <?php endforeach; ?>
      </div>
      <?php endif; ?>
    </aside>
    <main class="main-content page-body">
        <?php
    }
}

function page_end(bool $sub = false): void
{
    $site = '_site';
    if ($sub) {
        echo "    </main>\n  </div>\n";
    }
    ?>
  <footer class="site-footer">
    <div class="footer-links">
      <?php foreach (v($site, 'footer_links') as $l): ?>
      <a href="<?= href($l['url'] ?? '') ?>"<?= !empty($l['strong']) ? ' class="strong"' : '' ?>><?= e($l['label'] ?? '') ?></a>
      <?php endforeach; ?>
    </div>
    <div class="biz-info"><?= br(v($site, 'biz_info')) ?></div>
    <div><?= t($site, 'copyright') ?></div>
  </footer>

</div>
</body>
</html>
    <?php
}
