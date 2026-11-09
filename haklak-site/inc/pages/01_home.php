<?php
/* 홈(인트로) — /index.php */
return [
    'id' => 'home',
    'title' => '홈 (인트로)',
    'path' => '/',
    'order' => 1,
    'fields' => [
        ['group' => '검색·공유 정보', 'key' => 'meta_title', 'label' => '브라우저 탭 제목', 'type' => 'text', 'default' => '학락 學樂 | 배우는 즐거움을 펴내는 출판사'],
        ['key' => 'meta_description', 'label' => '검색 결과 설명', 'type' => 'textarea', 'default' => '학락(學樂)은 좋은 책과 강의, 교육영상으로 배우는 즐거움을 나누는 출판사입니다.'],

        ['group' => '메인 배너', 'key' => 'banner_image', 'label' => '배너 사진 (가로 1180px 이상 권장)', 'type' => 'image', 'default' => ''],
        ['key' => 'banner_title', 'label' => '배너 큰 글', 'type' => 'textarea', 'default' => "배우는 즐거움을\n책으로 펴냅니다"],
        ['key' => 'banner_sub', 'label' => '배너 작은 글', 'type' => 'text', 'default' => '學樂 · 오래 곁에 두고 읽을 책, 그 책에서 이어지는 강의와 영상'],

        ['group' => '왼쪽 바로가기', 'key' => 'quick_title', 'label' => '제목', 'type' => 'text', 'default' => '바로가기'],
        ['key' => 'quick_links', 'label' => '바로가기 버튼', 'type' => 'list',
            'fields' => [
                ['key' => 'label', 'label' => '이름', 'type' => 'text'],
                ['key' => 'url', 'label' => '주소', 'type' => 'text'],
            ],
            'default' => [
                ['label' => '학락 소개', 'url' => '/about/greeting.php'],
                ['label' => '전체 도서', 'url' => '/books/'],
                ['label' => '신간·출간 예정', 'url' => '/books/new.php'],
                ['label' => '강의 안내', 'url' => '/lectures/'],
                ['label' => '출강·강연 의뢰', 'url' => '/lectures/request.php'],
                ['label' => '교육영상', 'url' => '/media/'],
                ['label' => '원고 투고', 'url' => '/contact/submission.php'],
            ]],

        ['group' => '학락의 책', 'key' => 'books_title', 'label' => '제목', 'type' => 'text', 'default' => '학락의 책'],
        ['key' => 'books_more', 'label' => '더보기 글자', 'type' => 'text', 'default' => '더보기 +'],
        ['key' => 'books_more_url', 'label' => '더보기 주소', 'type' => 'text', 'default' => '/books/'],
        ['key' => 'books', 'label' => '도서 칸', 'type' => 'list',
            'fields' => [
                ['key' => 'title', 'label' => '도서명', 'type' => 'text'],
                ['key' => 'image', 'label' => '표지', 'type' => 'image'],
                ['key' => 'url', 'label' => '주소', 'type' => 'text'],
            ],
            'default' => array_fill(0, 4, ['title' => '[도서명]', 'image' => '', 'url' => '/books/'])],
        ['key' => 'books_empty', 'label' => '표지가 없을 때 글자', 'type' => 'text', 'default' => '표지 준비 중'],

        ['group' => '오늘의 글귀', 'key' => 'today_title', 'label' => '제목', 'type' => 'text', 'default' => '오늘의 글귀'],
        ['key' => 'today_big', 'label' => '큰 글자', 'type' => 'text', 'default' => '學'],
        ['key' => 'today_heading', 'label' => '글귀', 'type' => 'text', 'default' => '學而時習之 不亦說乎'],
        ['key' => 'today_text', 'label' => '풀이', 'type' => 'textarea', 'default' => '배우고 때때로 익히면 또한 기쁘지 아니한가. 《논어》 학이편'],

        ['group' => '공지사항', 'key' => 'notice_title', 'label' => '제목', 'type' => 'text', 'default' => '공지사항'],
        ['key' => 'notice_more', 'label' => '더보기 글자', 'type' => 'text', 'default' => '더보기 +'],
        ['key' => 'notice_more_url', 'label' => '더보기 주소', 'type' => 'text', 'default' => '/news/'],
        ['key' => 'notices', 'label' => '공지 목록', 'type' => 'list',
            'fields' => [
                ['key' => 'title', 'label' => '제목', 'type' => 'text'],
                ['key' => 'date', 'label' => '날짜', 'type' => 'text'],
                ['key' => 'url', 'label' => '주소', 'type' => 'text'],
            ],
            'default' => [
                ['title' => '학락 공식 홈페이지를 열었습니다', 'date' => '2026.11', 'url' => '/news/'],
                ['title' => '학락 사업자등록을 마쳤습니다', 'date' => '2026.10.13', 'url' => '/news/'],
                ['title' => '출판사 학락이 첫발을 내디뎠습니다', 'date' => '2026.10.07', 'url' => '/news/'],
            ]],

        ['group' => '오른쪽 문의 상자', 'key' => 'contact_title', 'label' => '제목', 'type' => 'text', 'default' => '문의 · 투고'],
        ['key' => 'contact_text', 'label' => '안내 글', 'type' => 'textarea', 'default' => '출간 제안, 강의 의뢰, 협업 문의를 기다립니다.'],
        ['key' => 'contact_btn1', 'label' => '주황 버튼 글자', 'type' => 'text', 'default' => '문의하기'],
        ['key' => 'contact_btn1_url', 'label' => '주황 버튼 주소', 'type' => 'text', 'default' => '/contact/'],
        ['key' => 'contact_btn2', 'label' => '흰 버튼 글자', 'type' => 'text', 'default' => '원고 투고'],
        ['key' => 'contact_btn2_url', 'label' => '흰 버튼 주소', 'type' => 'text', 'default' => '/contact/submission.php'],

        ['group' => '오른쪽 배너', 'key' => 'side_banners', 'label' => '배너', 'type' => 'list',
            'help' => '사진을 넣으면 사진 배너, 없으면 글자 배너로 나옵니다.',
            'fields' => [
                ['key' => 'title', 'label' => '제목', 'type' => 'text'],
                ['key' => 'text', 'label' => '작은 글', 'type' => 'text'],
                ['key' => 'image', 'label' => '사진', 'type' => 'image'],
                ['key' => 'url', 'label' => '주소', 'type' => 'text'],
            ],
            'default' => [
                ['title' => '신간·출간 예정', 'text' => '곧 만날 학락의 책', 'image' => '', 'url' => '/books/new.php'],
                ['title' => '교육영상', 'text' => '강의를 영상으로 만나 보세요', 'image' => '', 'url' => '/media/'],
                ['title' => '오시는 길', 'text' => '서울 종로구 이화장1길 32', 'image' => '', 'url' => '/about/location.php'],
            ]],
    ],
];
