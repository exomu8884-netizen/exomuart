<?php
/* 학락 공통 기능: 내용(content.json) 읽기, 페이지 정의(inc/pages/*.php) 읽기, 출력 도우미 */
declare(strict_types=1);

define('ROOT_DIR', dirname(__DIR__));
define('DATA_FILE', ROOT_DIR . '/data/content.json');
define('UPLOAD_DIR', ROOT_DIR . '/uploads');
define('UPLOAD_URL', '/uploads');

/* 모든 페이지 정의. inc/pages 에 파일을 추가하면 관리자 화면에 자동으로 나타납니다. */
function schema_all(): array
{
    static $all = null;
    if ($all === null) {
        $all = [];
        foreach (glob(ROOT_DIR . '/inc/pages/*.php') as $file) {
            $s = require $file;
            $all[$s['id']] = $s;
        }
        uasort($all, fn($a, $b) => ($a['order'] ?? 99) <=> ($b['order'] ?? 99));
    }
    return $all;
}

function schema(string $page): array
{
    $all = schema_all();
    if (!isset($all[$page])) {
        throw new RuntimeException("페이지 정의가 없습니다: $page");
    }
    return $all[$page];
}

function content_all(): array
{
    static $c = null;
    if ($c === null) {
        $c = is_file(DATA_FILE) ? (json_decode((string) file_get_contents(DATA_FILE), true) ?: []) : [];
    }
    return $c;
}

/* 값 읽기: 저장된 값이 없으면 페이지 정의의 기본값 */
function v(string $page, string $key)
{
    $c = content_all();
    if (isset($c[$page]) && array_key_exists($key, $c[$page])) {
        return $c[$page][$key];
    }
    foreach (schema($page)['fields'] as $f) {
        if ($f['key'] === $key) {
            return $f['default'] ?? ($f['type'] === 'list' ? [] : '');
        }
    }
    return '';
}

function e($s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

/* 한 줄 글 */
function t(string $page, string $key): string
{
    return e(v($page, $key));
}

/* 줄바꿈을 <br>로 */
function br($s): string
{
    return nl2br(e($s), false);
}

/* 문단 글: 빈 줄로 문단을 나누고, 한 줄 바꿈은 <br> */
function paras($s): string
{
    $out = '';
    foreach (preg_split("/\R\s*\R/u", trim((string) $s)) as $p) {
        if ($p !== '') {
            $out .= '<p>' . br($p) . "</p>\n";
        }
    }
    return $out;
}

/* 주소: 관리자가 입력한 링크 중 javascript: 같은 위험한 주소는 막음 */
function href($url): string
{
    $url = trim((string) $url);
    if ($url === '' || preg_match('#^(https?://|/|\#|mailto:|tel:)#i', $url) !== 1) {
        return '#';
    }
    return e($url);
}

/* 메뉴 */
function menu(): array
{
    $menu = [];
    foreach (v('_site', 'menu') as $m) {
        $subs = [];
        foreach (preg_split('/\R/u', (string) ($m['subs'] ?? '')) as $line) {
            if (str_contains($line, '|')) {
                [$label, $url] = array_map('trim', explode('|', $line, 2));
                $subs[] = ['label' => $label, 'url' => $url];
            }
        }
        $menu[] = ['label' => $m['label'] ?? '', 'url' => $m['url'] ?? ($subs[0]['url'] ?? '#'), 'subs' => $subs];
    }
    return $menu;
}

function current_path(): string
{
    $p = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    return $p === '/index.php' ? '/' : $p;
}
