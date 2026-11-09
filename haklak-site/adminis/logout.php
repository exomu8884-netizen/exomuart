<?php
declare(strict_types=1);
require __DIR__ . '/_lib.php';
$_SESSION = [];
session_destroy();
header('Location: /adminis/');
