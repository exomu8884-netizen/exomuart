<?php
/* 관리자 첫 화면: 처음엔 비밀번호 만들기 → 로그인 → 편집할 페이지 목록 */
declare(strict_types=1);
require __DIR__ . '/_lib.php';

$msg = '';
$err = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $act = $_POST['act'] ?? '';
    $pw = (string) ($_POST['pw'] ?? '');
    if ($act === 'setup' && !admin_exists()) {
        if (mb_strlen($pw) < 10 || $pw !== ($_POST['pw2'] ?? '')) {
            $err = '비밀번호는 10자 이상이어야 하고, 두 번 똑같이 입력해야 합니다.';
        } else {
            set_password($pw);
            try_login($pw);
            header('Location: /adminis/');
            exit;
        }
    } elseif ($act === 'login' && admin_exists()) {
        $err = try_login($pw);
        if ($err === '') {
            header('Location: /adminis/');
            exit;
        }
    } elseif ($act === 'password' && is_logged_in()) {
        $admin = json_decode((string) file_get_contents(ADMIN_FILE), true) ?: [];
        if (!password_verify((string) ($_POST['old'] ?? ''), $admin['hash'] ?? '')) {
            $err = '지금 비밀번호가 맞지 않습니다.';
        } elseif (mb_strlen($pw) < 10 || $pw !== ($_POST['pw2'] ?? '')) {
            $err = '새 비밀번호는 10자 이상이어야 하고, 두 번 똑같이 입력해야 합니다.';
        } else {
            set_password($pw);
            $msg = '비밀번호를 바꿨습니다.';
        }
    }
}

if (!admin_exists()) {
    admin_head('처음 설정');
    ?>
  <section class="adm-card narrow">
    <h1>관리자 비밀번호 만들기</h1>
    <p class="hint">처음 한 번만 나오는 화면입니다. 10자 이상으로 정해 주세요.</p>
    <?php if ($err): ?><p class="adm-err"><?= e($err) ?></p><?php endif; ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="act" value="setup">
      <label>비밀번호<input type="password" name="pw" required minlength="10" autocomplete="new-password"></label>
      <label>비밀번호 확인<input type="password" name="pw2" required minlength="10" autocomplete="new-password"></label>
      <button class="adm-btn primary">만들기</button>
    </form>
  </section>
    <?php
    admin_foot();
    exit;
}

if (!is_logged_in()) {
    admin_head('로그인');
    ?>
  <section class="adm-card narrow">
    <h1>관리자 로그인</h1>
    <?php if ($err): ?><p class="adm-err"><?= e($err) ?></p><?php endif; ?>
    <form method="post"><?= csrf_field() ?><input type="hidden" name="act" value="login">
      <label>비밀번호<input type="password" name="pw" required autofocus autocomplete="current-password"></label>
      <button class="adm-btn primary">로그인</button>
    </form>
  </section>
    <?php
    admin_foot();
    exit;
}

if (($_GET['action'] ?? '') === 'password') {
    admin_head('비밀번호 변경');
    ?>
  <section class="adm-card narrow">
    <h1>비밀번호 변경</h1>
    <?php if ($err): ?><p class="adm-err"><?= e($err) ?></p><?php endif; ?>
    <?php if ($msg): ?><p class="adm-ok"><?= e($msg) ?></p><?php endif; ?>
    <form method="post" action="/adminis/?action=password"><?= csrf_field() ?><input type="hidden" name="act" value="password">
      <label>지금 비밀번호<input type="password" name="old" required autocomplete="current-password"></label>
      <label>새 비밀번호 (10자 이상)<input type="password" name="pw" required minlength="10" autocomplete="new-password"></label>
      <label>새 비밀번호 확인<input type="password" name="pw2" required minlength="10" autocomplete="new-password"></label>
      <button class="adm-btn primary">바꾸기</button>
    </form>
  </section>
    <?php
    admin_foot();
    exit;
}

$saved = content_all();
admin_head('페이지 목록');
?>
  <section class="adm-card">
    <h1>편집할 페이지</h1>
    <p class="hint">새 페이지를 만들면 이 목록에 자동으로 추가됩니다.</p>
    <table class="adm-table">
      <thead><tr><th>페이지</th><th>주소</th><th>상태</th><th></th></tr></thead>
      <tbody>
      <?php foreach (schema_all() as $id => $s): ?>
        <tr>
          <td><strong><?= e($s['title']) ?></strong></td>
          <td><a href="<?= e($s['path']) ?>" target="_blank"><?= e($s['path']) ?></a></td>
          <td><?= isset($saved[$id]) ? '수정됨' : '<span class="muted">기본 문구</span>' ?></td>
          <td><a class="adm-btn" href="/adminis/edit.php?page=<?= urlencode($id) ?>">편집</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </section>
<?php admin_foot();
