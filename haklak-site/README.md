# haklak.net 홈페이지

PHP 8 + 파일 저장(JSON) 방식. 데이터베이스 없이 고대디 cPanel 웹호스팅에서 돌아갑니다.
**모든 문구와 사진은 관리자(/adminis)에서 바꿉니다. 페이지 파일에 문구를 직접 쓰지 않습니다.**

## 폴더
```
index.php               홈(인트로)
about/greeting.php      하위 페이지 예시 (인사말)
inc/bootstrap.php       공통 기능 (내용 읽기, 출력 도우미)
inc/layout.php          공통 틀 (머리말·메뉴·경로·왼쪽 소메뉴·꼬리말)
inc/pages/*.php         페이지별 "편집 항목 정의"  ← 관리자 화면이 이걸 읽어 입력 칸을 만듦
adminis/                관리자 (로그인·편집·사진 올리기)
assets/css/style.css    디자인
data/content.json       관리자에서 저장한 내용 (자동 생성)
data/backup/            저장할 때마다 이전 내용 자동 백업 (최근 50개)
uploads/                관리자에서 올린 사진
```

## 새 페이지를 만드는 규칙 (반드시 지킬 것)
페이지 하나 = 파일 두 개.

1. `inc/pages/NN_이름.php` — 편집 항목 정의. 이 파일이 생기면 관리자 목록에 **자동으로** 나타납니다.
   ```php
   return [
     'id' => 'about_vision',            // 고유 이름
     'title' => '학락 소개 › 학락의 방향', // 관리자 목록에 보일 이름
     'path' => '/about/vision.php',     // 실제 주소
     'order' => 11,                     // 관리자 목록 순서
     'fields' => [
       ['key' => 'page_title', 'label' => '페이지 제목', 'type' => 'text', 'default' => '학락의 방향'],
       ['key' => 'body', 'label' => '본문', 'type' => 'textarea', 'default' => '...'],
       ['key' => 'photo', 'label' => '사진', 'type' => 'image', 'default' => ''],
       ['key' => 'items', 'label' => '목록', 'type' => 'list', 'fields' => [...], 'default' => [...]],
     ],
   ];
   ```
   - 칸 종류: `text`(한 줄) · `textarea`(여러 줄) · `image`(사진) · `list`(항목 추가·삭제·순서 변경 가능한 목록)
   - `group` 을 넣으면 관리자 화면에 소제목으로 묶여 보입니다.
2. 실제 페이지 파일 (예: `about/vision.php`) — 문구는 전부 `t()`, `br()`, `paras()`, `v()` 로 꺼내 씁니다.
   ```php
   <?php
   require dirname(__DIR__) . '/inc/layout.php';
   $P = 'about_vision';
   page_start($P, v($P, 'page_title') . ' | 학락', '', true);   // true = 하위 페이지 틀
   ?>
     <h2><?= t($P, 'heading') ?></h2>
     <?= paras(v($P, 'body')) ?>
   <?php page_end(true); ?>
   ```
3. 메뉴에 넣으려면 관리자 → 사이트 공통 → 대메뉴의 소메뉴 칸에 `이름 | /about/vision.php` 한 줄 추가.

출력 도우미: `t()` 한 줄 글 · `br()` 줄바꿈 유지 · `paras()` 빈 줄로 문단 나눔 · `href()` 안전한 링크 · `e()` 글자 그대로 출력.

## 고대디에 올리기
1. 고대디 **웹호스팅(cPanel, Linux)** 이 필요합니다. 웹사이트 빌더 요금제에서는 PHP가 돌지 않습니다.
2. cPanel → PHP 버전 선택에서 PHP 8.1 이상.
3. 이 폴더 안 내용을 전부 `public_html/` 에 올립니다. (`.htaccess` 숨김 파일 포함)
4. `data/`, `uploads/` 폴더 권한 755 (웹에서 쓰기 가능해야 함).
5. https://haklak.net/adminis 접속 → 처음 한 번 관리자 비밀번호 만들기(10자 이상).
6. cPanel에서 무료 SSL(https) 켜기.

## 보안
- `data/`, `inc/` 는 웹에서 직접 열리지 않게 막아 둠 (`.htaccess`).
- 관리자: 비밀번호 암호화 저장, 5번 틀리면 10분 잠김, 모든 저장에 보안 토큰 확인.
- 사진: jpg·png·gif·webp, 5MB 이하만. 파일 이름은 자동으로 바뀌고, `uploads/` 안에서는 프로그램 실행 금지.
- 비밀번호를 잊으면 `data/admin.json` 을 지우고 /adminis 에서 새로 만들면 됩니다 (FTP/cPanel 접근 필요).
