<?php
/* 관리자 공통: 로그인, 보안 토큰, 저장, 사진 올리기 */
declare(strict_types=1);
require_once dirname(__DIR__) . '/inc/bootstrap.php';

define('ADMIN_FILE', ROOT_DIR . '/data/admin.json');
define('ATTEMPT_FILE', ROOT_DIR . '/data/login_attempts.json');
define('BACKUP_DIR', ROOT_DIR . '/data/backup');
define('MAX_UPLOAD', 5 * 1024 * 1024);

session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Strict',
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'path' => '/adminis',
]);
session_name('haklak_admin');
session_start();

function admin_exists(): bool
{
    return is_file(ADMIN_FILE);
}

function is_logged_in(): bool
{
    return !empty($_SESSION['admin']);
}

function require_login(): void
{
    if (!is_logged_in()) {
        header('Location: /adminis/');
        exit;
    }
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="csrf" value="' . e(csrf_token()) . '">';
}

function csrf_check(): void
{
    if (!hash_equals($_SESSION['csrf'] ?? '', (string) ($_POST['csrf'] ?? ''))) {
        http_response_code(400);
        exit('보안 확인에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.');
    }
}

function write_json(string $file, array $data): void
{
    $tmp = $file . '.tmp';
    file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    rename($tmp, $file);
}

function set_password(string $pw): void
{
    write_json(ADMIN_FILE, ['hash' => password_hash($pw, PASSWORD_DEFAULT), 'updated' => date('c')]);
}

/* 로그인: 같은 접속 주소에서 5번 틀리면 10분 잠김 */
function try_login(string $pw): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '-';
    $att = is_file(ATTEMPT_FILE) ? (json_decode((string) file_get_contents(ATTEMPT_FILE), true) ?: []) : [];
    $rec = $att[$ip] ?? ['n' => 0, 't' => 0];
    if ($rec['n'] >= 5 && time() - $rec['t'] < 600) {
        return '로그인을 여러 번 실패해서 10분 동안 잠겼습니다.';
    }
    $admin = json_decode((string) file_get_contents(ADMIN_FILE), true) ?: [];
    if (password_verify($pw, $admin['hash'] ?? '')) {
        unset($att[$ip]);
        write_json(ATTEMPT_FILE, $att);
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        return '';
    }
    $att[$ip] = ['n' => ($rec['n'] >= 5 ? 0 : $rec['n']) + 1, 't' => time()];
    write_json(ATTEMPT_FILE, $att);
    usleep(500000);
    return '비밀번호가 맞지 않습니다.';
}

/* 사진 올리기: jpg·png·gif·webp, 5MB 이하만 */
function store_upload(array $f): ?string
{
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
        return null;
    }
    if ($f['error'] !== UPLOAD_ERR_OK || $f['size'] > MAX_UPLOAD) {
        throw new RuntimeException('사진은 5MB 이하만 올릴 수 있습니다.');
    }
    $info = @getimagesize($f['tmp_name']);
    $ext = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'][$info[2] ?? 0] ?? null;
    if (!$ext) {
        throw new RuntimeException('사진 파일(jpg, png, gif, webp)만 올릴 수 있습니다.');
    }
    $dir = UPLOAD_DIR . '/' . date('Y/m');
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $name = date('Ymd-His') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) {
        throw new RuntimeException('사진을 저장하지 못했습니다.');
    }
    return UPLOAD_URL . '/' . date('Y/m') . "/$name";
}

/* $_FILES 의 중첩 배열에서 한 파일 꺼내기 */
function file_at(array $path): array
{
    if (!isset($_FILES['u'])) {
        return ['error' => UPLOAD_ERR_NO_FILE];
    }
    $out = [];
    foreach (['name', 'type', 'tmp_name', 'error', 'size'] as $k) {
        $node = $_FILES['u'][$k];
        foreach ($path as $p) {
            if (!is_array($node) || !array_key_exists($p, $node)) {
                return ['error' => UPLOAD_ERR_NO_FILE];
            }
            $node = $node[$p];
        }
        $out[$k] = $node;
    }
    return $out;
}

/* 한 칸의 값 정리 */
function clean_value(array $f, $posted, array $path, bool $delete)
{
    if ($f['type'] === 'image') {
        $new = store_upload(file_at($path));
        if ($new !== null) {
            return $new;
        }
        return $delete ? '' : (string) $posted;
    }
    $s = str_replace("\r\n", "\n", (string) $posted);
    return $f['type'] === 'textarea' ? $s : trim($s);
}

/* 페이지 하나 저장: 저장 전 내용을 백업 */
function save_page(string $page): void
{
    $schema = schema($page);
    $post = $_POST['f'] ?? [];
    $del = $_POST['d'] ?? [];
    $values = [];
    foreach ($schema['fields'] as $f) {
        $k = $f['key'];
        if ($f['type'] === 'list') {
            $rows = [];
            foreach ((array) ($post[$k] ?? []) as $i => $row) {
                $r = [];
                foreach ($f['fields'] as $sf) {
                    $r[$sf['key']] = clean_value($sf, $row[$sf['key']] ?? '', [$k, $i, $sf['key']], !empty($del[$k][$i][$sf['key']]));
                }
                $rows[] = $r;
            }
            $values[$k] = $rows;
        } else {
            $values[$k] = clean_value($f, $post[$k] ?? '', [$k], !empty($del[$k]));
        }
    }

    if (!is_dir(BACKUP_DIR)) {
        mkdir(BACKUP_DIR, 0755, true);
    }
    if (is_file(DATA_FILE)) {
        copy(DATA_FILE, BACKUP_DIR . '/content-' . date('Ymd-His') . '.json');
        $old = glob(BACKUP_DIR . '/content-*.json');
        sort($old);
        foreach (array_slice($old, 0, max(0, count($old) - 50)) as $o) {
            unlink($o);
        }
    }
    $all = is_file(DATA_FILE) ? (json_decode((string) file_get_contents(DATA_FILE), true) ?: []) : [];
    $all[$page] = $values;
    write_json(DATA_FILE, $all);
}

function admin_head(string $title): void
{
    ?>
<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title><?= e($title) ?> | 학락 관리자</title>
  <link rel="stylesheet" href="/adminis/admin.css">
</head>
<body>
<header class="adm-top">
  <a href="/adminis/" class="adm-logo">학락 관리자</a>
  <?php if (is_logged_in()): ?>
  <nav><a href="/" target="_blank">사이트 보기 ↗</a><a href="/adminis/?action=password">비밀번호 변경</a><a href="/adminis/logout.php">로그아웃</a></nav>
  <?php endif; ?>
</header>
<main class="adm-main">
    <?php
}

function admin_foot(): void
{
    echo "</main>\n</body>\n</html>\n";
}
