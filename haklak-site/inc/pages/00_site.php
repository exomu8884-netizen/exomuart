<?php
/* 사이트 공통: 머리말·메뉴·꼬리말. 모든 페이지에 함께 나옵니다. */
return [
    'id' => '_site',
    'title' => '사이트 공통 (로고·메뉴·하단 정보)',
    'path' => '/',
    'order' => 0,
    'fields' => [
        ['group' => '로고·검색', 'key' => 'logo_text', 'label' => '로고 글자', 'type' => 'text', 'default' => '學樂 학락'],
        ['key' => 'logo_sub', 'label' => '로고 아래 작은 글자', 'type' => 'text', 'default' => '배우는 즐거움을 펴내는 출판사'],
        ['key' => 'logo_image', 'label' => '로고 이미지 (넣으면 로고 글자 대신 나옴)', 'type' => 'image', 'default' => ''],
        ['key' => 'search_placeholder', 'label' => '검색창 안내 문구', 'type' => 'text', 'default' => '검색어 입력'],
        ['key' => 'search_button', 'label' => '검색 버튼', 'type' => 'text', 'default' => '검색'],

        ['group' => '상단 메뉴', 'key' => 'home_label', 'label' => '첫 메뉴(홈) 이름', 'type' => 'text', 'default' => 'Home'],
        ['key' => 'menu', 'label' => '대메뉴', 'type' => 'list',
            'help' => '소메뉴는 한 줄에 하나씩 "이름 | 주소" 형식으로 적습니다. 대메뉴 주소를 비우면 첫 소메뉴로 갑니다.',
            'fields' => [
                ['key' => 'label', 'label' => '대메뉴 이름', 'type' => 'text'],
                ['key' => 'url', 'label' => '대메뉴 주소 (비워도 됨)', 'type' => 'text'],
                ['key' => 'subs', 'label' => '소메뉴 (이름 | 주소)', 'type' => 'textarea'],
            ],
            'default' => [
                ['label' => '학락 소개', 'url' => '', 'subs' => "인사말 | /about/greeting.php\n학락의 방향 | /about/vision.php\n연혁 | /about/history.php\n오시는 길 | /about/location.php"],
                ['label' => '도서', 'url' => '', 'subs' => "전체 도서 | /books/\n신간·출간 예정 | /books/new.php\n전자책 | /books/ebooks.php\n교재·학습서 | /books/textbooks.php"],
                ['label' => '강의·교육', 'url' => '', 'subs' => "강의 안내 | /lectures/\n교육 컨설팅 | /lectures/consulting.php\n출강·강연 의뢰 | /lectures/request.php"],
                ['label' => '영상', 'url' => '', 'subs' => "교육영상 | /media/\n유료 강좌 안내 | /media/courses.php"],
                ['label' => '소식', 'url' => '', 'subs' => "공지사항 | /news/\n출간·행사 소식 | /news/events.php"],
                ['label' => '문의', 'url' => '', 'subs' => "일반 문의 | /contact/\n원고 투고 | /contact/submission.php"],
            ]],

        ['group' => '하단 정보', 'key' => 'footer_links', 'label' => '하단 링크', 'type' => 'list',
            'fields' => [
                ['key' => 'label', 'label' => '이름', 'type' => 'text'],
                ['key' => 'url', 'label' => '주소', 'type' => 'text'],
                ['key' => 'strong', 'label' => '굵게 표시 (아무 글자나 넣으면 굵게)', 'type' => 'text'],
            ],
            'default' => [
                ['label' => '학락 소개', 'url' => '/about/greeting.php', 'strong' => ''],
                ['label' => '오시는 길', 'url' => '/about/location.php', 'strong' => ''],
                ['label' => '문의', 'url' => '/contact/', 'strong' => ''],
                ['label' => '원고 투고', 'url' => '/contact/submission.php', 'strong' => ''],
                ['label' => '개인정보처리방침', 'url' => '/privacy.php', 'strong' => 'Y'],
            ]],
        ['key' => 'biz_info', 'label' => '사업자 정보 (줄바꿈 그대로 표시)', 'type' => 'textarea',
            'default' => "상호 학락 · 대표 이병구 · 사업자등록번호 541-76-00544 · 출판사 신고 제2026-000127호\n주소 서울특별시 종로구 이화장1길 32 (이화동) · 전화 [전화번호] · 이메일 [이메일] · 개인정보보호책임자 이병구"],
        ['key' => 'copyright', 'label' => '저작권 문구', 'type' => 'text', 'default' => 'Copyright © 2026 HAKLAK. All Rights Reserved.'],
    ],
];
