<?php
/**
 * منصة طرقع - نقطة دخول بديلة لتوافق خوادم LiteSpeed و Apache على Hostinger
 * Tarqa Platform - Failsafe Entry Point
 */
$indexPath = __DIR__ . '/index.html';
if (file_exists($indexPath)) {
    // إرسال ترويسات منع الكاش لضمان وصول التحديثات
    header('Cache-Control: no-cache, no-store, must-revalidate');
    header('Pragma: no-cache');
    header('Expires: 0');
    header('Content-Type: text/html; charset=UTF-8');
    readfile($indexPath);
    exit;
}
http_response_code(200);
echo '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>منصة طرقع</title></head><body><p>جاري تحميل المنصة...</p><script>window.location.reload();</script></body></html>';

