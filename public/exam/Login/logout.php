<?php
session_start();
// -------------------------
// منع التخزين المؤقت (Caching) نهائياً
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past
// -------------------------

// تدمير جميع بيانات الجلسة
$_SESSION = [];
session_destroy();

// إرجاع استجابة ناجحة
header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true]);