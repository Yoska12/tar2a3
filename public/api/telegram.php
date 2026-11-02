<?php
/**
 * ==============================================================================
 * منصة طرقع - بوابة تليجرام الآمنة (Server-Side Telegram Gateway)
 * Tarqa Platform - Secure Telegram Backend Service (Hostinger PHP)
 * ==============================================================================
 * يقوم هذا الملف بإخفاء توكن البوت في السيرفر تماماً ومنع تسريبه للواجهة الأمامية
 * 1. إرسال الرسائل والإشعارات للطلاب (Send Message API)
 * 2. التحقق الأمني من توقيع تسجيل الدخول عبر تليجرام (Telegram Login Auth Verification)
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// توكن البوت الرسمي السري محفوظ حصراً في السيرفر
$botToken = getenv('TELEGRAM_BOT_TOKEN') ?: ($_SERVER['TELEGRAM_BOT_TOKEN'] ?? '8848350461:AAEcKW2rMOYlv3HD7YKpKgf1BVaCtRX-O4k');
$botUsername = getenv('TELEGRAM_BOT_USERNAME') ?: ($_SERVER['TELEGRAM_BOT_USERNAME'] ?? 'Tarqa3bot');
$telegramApi = "https://api.telegram.org/bot{$botToken}";

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'status' => 'active',
        'bot' => '@' . $botUsername,
        'secure_gateway' => true,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$input = file_get_contents('php://input');
$body = json_decode($input, true) ?: [];
$action = $_GET['action'] ?? ($body['action'] ?? 'send_message');

// ==============================================================================
// 1. إجراء: التحقق الأمني من تسجيل دخول ويدجت تليجرام (Verify Auth)
// ==============================================================================
if ($action === 'verify_auth' || $action === 'verify') {
    $authData = $body['authData'] ?? $body;
    $hash = $authData['hash'] ?? null;

    if (!$hash) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'isValid' => false, 'error' => 'Missing hash']);
        exit;
    }

    $authDate = intval($authData['auth_date'] ?? 0);
    $now = time();
    if ($authDate > 0 && ($now - $authDate) > 86400) {
        echo json_encode(['ok' => false, 'isValid' => false, 'error' => 'Authentication data expired']);
        exit;
    }

    unset($authData['hash']);
    unset($authData['action']);

    $dataCheckArr = [];
    foreach ($authData as $key => $val) {
        if ($val !== null && $val !== '') {
            $dataCheckArr[] = "{$key}={$val}";
        }
    }
    sort($dataCheckArr);
    $dataCheckString = implode("\n", $dataCheckArr);

    $secretKey = hash('sha256', $botToken, true);
    $calculatedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

    $isValid = hash_equals($calculatedHash, $hash);

    echo json_encode([
        'ok' => true,
        'isValid' => $isValid,
        'user' => $isValid ? [
            'id' => intval($authData['id'] ?? 0),
            'first_name' => $authData['first_name'] ?? '',
            'last_name' => $authData['last_name'] ?? '',
            'username' => $authData['username'] ?? '',
            'photo_url' => $authData['photo_url'] ?? '',
            'auth_date' => $authDate
        ] : null,
        'error' => $isValid ? null : 'Invalid Telegram signature'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==============================================================================
// 2. إجراء: إرسال رسالة عبر البوت إلى مستخدم أو الأدمن (Send Message)
// ==============================================================================
if ($action === 'send_message' || $action === 'send') {
    $chatId = $body['chat_id'] ?? $body['chatId'] ?? null;
    $text = $body['text'] ?? null;
    $parseMode = $body['parse_mode'] ?? $body['parseMode'] ?? 'HTML';

    if (!$chatId || !$text) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'chat_id and text are required']);
        exit;
    }

    if ($chatId === 'admin') {
        $chatId = getenv('TELEGRAM_ADMIN_CHAT_ID') ?: ($_SERVER['TELEGRAM_ADMIN_CHAT_ID'] ?? '8848350461');
    }

    $sendUrl = "{$telegramApi}/sendMessage";
    $payload = json_encode([
        'chat_id' => $chatId,
        'text' => $text,
        'parse_mode' => $parseMode,
        'disable_web_page_preview' => true,
    ]);

    $ch = curl_init($sendUrl);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 6);

    $result = curl_exec($ch);
    $curlErr = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curlErr) {
        echo json_encode(['ok' => false, 'error' => $curlErr]);
        exit;
    }

    $tgRes = json_decode($result, true) ?: [];
    echo json_encode([
        'ok' => $tgRes['ok'] ?? ($httpCode === 200),
        'description' => $tgRes['description'] ?? null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['ok' => false, 'error' => 'Unknown action']);
exit;
