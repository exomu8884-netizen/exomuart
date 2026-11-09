<?php
/* 페이지 편집: inc/pages 의 정의대로 입력 칸을 자동으로 만듭니다 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';
require_login();

$page = (string) ($_GET['page'] ?? '');
if (!isset(schema_all()[$page])) {
    http_response_code(404);
    exit('없는 페이지입니다.');
}
$schema = schema($page);
$err = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    try {
        save_page($page);
        header('Location: /adminis/edit.php?page=' . urlencode($page) . '&saved=1');
        exit;
    } catch (RuntimeException $ex) {
        $err = $ex->getMessage();
    }
}

/* 입력 칸 하나 그리기. $name 은 f[...] 안쪽 이름, $path 는 u[...]·d[...] 용 */
function field_input(array $f, $value, string $name): string
{
    $id = 'f_' . preg_replace('/[^a-z0-9_]/i', '_', $name);
    $h = '<div class="adm-field"><label for="' . $id . '">' . e($f['label']) . '</label>';
    switch ($f['type']) {
        case 'textarea':
            $h .= '<textarea id="' . $id . '" name="f' . $name . '" rows="4">' . e($value) . '</textarea>';
            break;
        case 'image':
            $h .= '<div class="adm-image">';
            $h .= $value ? '<img src="' . e($value) . '" alt="">' : '<span class="muted">사진 없음</span>';
            $h .= '<input type="hidden" name="f' . $name . '" value="' . e($value) . '">';
            $h .= '<input id="' . $id . '" type="file" name="u' . $name . '" accept="image/jpeg,image/png,image/gif,image/webp">';
            if ($value) {
                $h .= '<label class="inline"><input type="checkbox" name="d' . $name . '" value="1"> 사진 빼기</label>';
            }
            $h .= '</div>';
            break;
        default:
            $h .= '<input id="' . $id . '" type="text" name="f' . $name . '" value="' . e($value) . '">';
    }
    return $h . '</div>';
}

function list_row(array $f, array $row, string $key, $i): string
{
    $h = '<div class="adm-row"><div class="adm-row-tools"><span class="num"></span>' .
        '<button type="button" class="adm-btn sm" data-up>↑</button><button type="button" class="adm-btn sm" data-down>↓</button>' .
        '<button type="button" class="adm-btn sm danger" data-del>삭제</button></div>';
    foreach ($f['fields'] as $sf) {
        $h .= field_input($sf, $row[$sf['key']] ?? '', "[$key][$i][{$sf['key']}]");
    }
    return $h . '</div>';
}

admin_head($schema['title']);
?>
  <p><a href="/adminis/">← 페이지 목록</a></p>
  <section class="adm-card">
    <h1><?= e($schema['title']) ?> <a class="adm-view" href="<?= e($schema['path']) ?>" target="_blank">페이지 보기 ↗</a></h1>
    <?php if (isset($_GET['saved'])): ?><p class="adm-ok">저장했습니다. 사이트에 바로 반영됐습니다.</p><?php endif; ?>
    <?php if ($err): ?><p class="adm-err"><?= e($err) ?></p><?php endif; ?>

    <form method="post" enctype="multipart/form-data" id="adm-form">
      <?= csrf_field() ?>
      <?php foreach ($schema['fields'] as $f): ?>
        <?php if (!empty($f['group'])): ?><h2 class="adm-group"><?= e($f['group']) ?></h2><?php endif; ?>
        <?php if ($f['type'] === 'list'): $rows = v($page, $f['key']); ?>
          <div class="adm-list" data-key="<?= e($f['key']) ?>">
            <div class="adm-list-head"><strong><?= e($f['label']) ?></strong>
              <?php if (!empty($f['help'])): ?><span class="hint"><?= e($f['help']) ?></span><?php endif; ?></div>
            <div class="adm-rows">
              <?php foreach ($rows as $i => $row): ?><?= list_row($f, (array) $row, $f['key'], $i) ?><?php endforeach; ?>
            </div>
            <template><?= list_row($f, [], $f['key'], '__i__') ?></template>
            <button type="button" class="adm-btn" data-add>+ 항목 추가</button>
          </div>
        <?php else: ?>
          <?= field_input($f, v($page, $f['key']), '[' . $f['key'] . ']') ?>
          <?php if (!empty($f['help'])): ?><p class="hint"><?= e($f['help']) ?></p><?php endif; ?>
        <?php endif; ?>
      <?php endforeach; ?>
      <div class="adm-save"><button class="adm-btn primary lg">저장하기</button></div>
    </form>
  </section>

<script>
/* 목록 항목 추가·삭제·순서 바꾸기. 저장할 때 번호를 다시 매깁니다. */
(function () {
  var seq = 1000;
  document.querySelectorAll('.adm-list').forEach(function (list) {
    var rows = list.querySelector('.adm-rows');
    list.querySelector('[data-add]').addEventListener('click', function () {
      var html = list.querySelector('template').innerHTML.replace(/__i__/g, 'n' + (seq++));
      rows.insertAdjacentHTML('beforeend', html);
      number(rows);
    });
    rows.addEventListener('click', function (e) {
      var row = e.target.closest('.adm-row');
      if (!row) return;
      if (e.target.hasAttribute('data-del') && confirm('이 항목을 지울까요? (저장해야 반영됩니다)')) row.remove();
      if (e.target.hasAttribute('data-up') && row.previousElementSibling) rows.insertBefore(row, row.previousElementSibling);
      if (e.target.hasAttribute('data-down') && row.nextElementSibling) rows.insertBefore(row.nextElementSibling, row);
      number(rows);
    });
    number(rows);
  });
  function number(rows) {
    Array.prototype.forEach.call(rows.children, function (r, i) { r.querySelector('.num').textContent = (i + 1) + '번'; });
  }
  /* 순서를 바꾼 대로 저장되도록 이름의 번호를 순서대로 다시 매김 */
  document.getElementById('adm-form').addEventListener('submit', function () {
    document.querySelectorAll('.adm-list').forEach(function (list) {
      var key = list.getAttribute('data-key');
      Array.prototype.forEach.call(list.querySelector('.adm-rows').children, function (row, i) {
        row.querySelectorAll('[name]').forEach(function (el) {
          el.name = el.name.replace(new RegExp('^([fud])\\[' + key + '\\]\\[[^\\]]+\\]'), '$1[' + key + '][' + i + ']');
        });
      });
    });
  });
})();
</script>
<?php admin_foot();
