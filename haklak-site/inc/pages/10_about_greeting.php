<?php
/* 학락 소개 > 인사말 — /about/greeting.php */
return [
    'id' => 'about_greeting',
    'title' => '학락 소개 › 인사말',
    'path' => '/about/greeting.php',
    'order' => 10,
    'fields' => [
        ['key' => 'page_title', 'label' => '페이지 제목', 'type' => 'text', 'default' => '인사말'],
        ['key' => 'heading', 'label' => '본문 큰 제목', 'type' => 'text', 'default' => '배우는 즐거움을 함께 나누고 싶습니다'],
        ['key' => 'image', 'label' => '사진 (대표 사진 등, 없으면 안 나옴)', 'type' => 'image', 'default' => ''],
        ['key' => 'body', 'label' => '본문 (빈 줄로 문단 구분)', 'type' => 'textarea',
            'default' => "책 한 권이 한 사람의 배움을 바꿀 수 있다고 믿습니다. 학락(學樂)이라는 이름에는 배우는 일이 무거운 의무가 아니라 즐거움이 되기를 바라는 마음을 담았습니다.\n\n학락은 깊이 있는 내용을 누구나 읽기 쉽게 다듬은 책을 펴내고, 그 책에서 시작한 배움이 강의와 교육영상으로 이어지도록 하겠습니다.\n\n독자 여러분의 곁에서 오래 읽히는 책을 만들겠습니다. 감사합니다."],
        ['key' => 'sign_label', 'label' => '서명 앞 글자', 'type' => 'text', 'default' => '학락 대표'],
        ['key' => 'sign_name', 'label' => '서명 이름', 'type' => 'text', 'default' => '이병구'],
    ],
];
