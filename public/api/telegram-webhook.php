<?php
/**
 * ==============================================================================
 * منصة طرقع - معالج ويب هوك بوت تليجرام الرسمي (@Tarqa3bot)
 * Tarqa Platform - Official Telegram Bot Webhook Handler (Hostinger PHP)
 * ==============================================================================
 */

// إعدادات CORS وترويسات الأمان
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// توكن ومعلومات البوت - يتم جلبه من متغيرات البيئة في السيرفر أو القيمة الافتراضية
$botToken = getenv('TELEGRAM_BOT_TOKEN') ?: ($_SERVER['TELEGRAM_BOT_TOKEN'] ?? '8848350461:AAGYEx9UQCgEhE-ppEpx5Pz7s-ZERK9iSPM');
$botUsername = getenv('TELEGRAM_BOT_USERNAME') ?: ($_SERVER['TELEGRAM_BOT_USERNAME'] ?? 'Tarqa3bot');
$telegramApi = !empty($botToken) ? "https://api.telegram.org/bot{$botToken}" : "";

// فحص الحالة المباشر (Health Check عبر المتصفح)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'operational',
        'bot' => '@' . $botUsername,
        'platform' => 'Tarqa Platform',
        'timestamp' => date('c'),
        'webhook' => 'active'
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// قراءة بيانات التحديث من تيليجرام (JSON Payload)
$input = file_get_contents('php://input');
if (empty($input)) {
    http_response_code(200);
    echo json_encode(['ok' => false, 'error' => 'Empty input']);
    exit;
}

$update = json_decode($input, true);
if (!$update) {
    http_response_code(200);
    echo json_encode(['ok' => false, 'error' => 'Invalid JSON']);
    exit;
}

// استخراج بيانات الرسالة والمستخدم
$message = $update['message'] ?? $update['edited_message'] ?? null;
if (!$message) {
    http_response_code(200);
    echo json_encode(['ok' => true]);
    exit;
}

$chatId = $message['chat']['id'] ?? null;
$text = trim($message['text'] ?? '');
$firstName = htmlspecialchars($message['from']['first_name'] ?? 'طالب طرقع', ENT_QUOTES, 'UTF-8');

if (!$chatId) {
    http_response_code(200);
    echo json_encode(['ok' => false, 'error' => 'Missing chat_id']);
    exit;
}

// إعداد الرسائل الموجزة والمحددة
$replyText = '';

if (stripos($text, '/start') === 0) {
    $replyText = "👋 أهلاً <b>{$firstName}</b>، تم ربط حسابك في منصة طرقع بنجاح ✅\n🎯 فالك الـ 100 بإذن الله!";
} elseif (stripos($text, '/score') === 0) {
    $replyText = "📊 <b>منصة طرقع للكمي</b>\nسجل دخولك بالمنصة لمتابعة نتائجك وتقارير تقدمك:\n👉 https://tarqa3.net";
} elseif (stripos($text, '/help') === 0) {
    $replyText = "🎯 <b>منصة طرقع للكمي</b>\n• أرسل /start لتأكيد التفعيل والربط\n• رابط المنصة: https://tarqa3.net\n🎯 فالك الـ 100!";
} else {
    $replyText = "👋 أهلاً بك في منصة طرقع للكمي!\n🌐 يمكنك الدخول للمنصة والتدريب عبر الرابط:\nhttps://tarqa3.net 🎯";
}

// إرسال الرد الفوري للمستخدم عبر Telegram SendMessage API
if (!empty($replyText)) {
    $sendUrl = "{$telegramApi}/sendMessage";
    $payload = json_encode([
        'chat_id' => $chatId,
        'text' => $replyText,
        'parse_mode' => 'HTML',
        'disable_web_page_preview' => true,
    ]);

    // تنفيذ الطلب باستخدام cURL أو fallback لمكتبة file_get_contents
    if (function_exists('curl_init')) {
        $ch = curl_init($sendUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
        @curl_exec($ch);
        @curl_close($ch);
    } else {
        @file_get_contents($sendUrl, false, stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 5
            ]
        ]));
    }
}

// الرد لتيليجرام بنجاح (HTTP 200 OK)
http_response_code(200);
echo json_encode(['ok' => true]);
