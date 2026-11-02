<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية حالة الصيانة السحابية (Hostinger PHP API)
 * Tarqa Platform - Site Maintenance Status Endpoint
 * ==============================================================================
 * يتحكم بحالة الموقع ووضع الصيانة ويسمح بمزامنتها مركزياً لجميع الأجهزة والزوار.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

// معالجة CORS
$allowed_origins = [
    'https://tarqa3.net',
    'https://www.tarqa3.net',
    'http://localhost:3000',
    'http://localhost:5173'
];

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $allowed_origins)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$configFile = __DIR__ . '/maintenance_config.json';

// إعدادات افتراضية
$defaultConfig = [
    'isEnabled' => false,
    'title' => 'المنصة تخضع حالياً لأعمال صيانة وتطوير دوري 🛠️',
    'message' => 'يقوم فريق طرقع الآن بإجراء تحديثات وتحسينات شاملة على خوادم المنصة وبنك الأسئلة لضمان تقديم أفضل تجربة تعليمية فائقة السرعة. سنعود للعمل بكامل طاقتنا في أقرب وقت ممكن!',
    'estimatedReturnTime' => 'اليوم خلال ساعتين',
    'supportUrl' => 'https://t.me/tr23km',
    'supportButtonText' => 'متابعة آخر التحديثات عبر تليجرام 💬',
    'allowAdminBypass' => true,
    'reasonPreset' => 'routine',
    'updatedAt' => date('c')
];

// 1. GET: قراءة حالة وضع الصيانة الحالية
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($configFile)) {
        $raw = file_get_contents($configFile);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            echo json_encode(array_merge($defaultConfig, $decoded), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            exit;
        }
    }
    echo json_encode($defaultConfig, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// 2. POST: تحديث حالة وضع الصيانة
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload && !empty($_POST)) {
        $payload = $_POST;
    }

    if (!is_array($payload)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid JSON payload'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // قراءة الإعداد الحالي لدمج التعديلات
    $current = $defaultConfig;
    if (file_exists($configFile)) {
        $raw = file_get_contents($configFile);
        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $current = array_merge($current, $decoded);
        }
    }

    $updated = [
        'isEnabled' => isset($payload['isEnabled']) ? (bool)$payload['isEnabled'] : $current['isEnabled'],
        'title' => !empty($payload['title']) ? trim($payload['title']) : $current['title'],
        'message' => !empty($payload['message']) ? trim($payload['message']) : $current['message'],
        'estimatedReturnTime' => isset($payload['estimatedReturnTime']) ? trim($payload['estimatedReturnTime']) : $current['estimatedReturnTime'],
        'supportUrl' => !empty($payload['supportUrl']) ? trim($payload['supportUrl']) : $current['supportUrl'],
        'supportButtonText' => !empty($payload['supportButtonText']) ? trim($payload['supportButtonText']) : $current['supportButtonText'],
        'allowAdminBypass' => true,
        'reasonPreset' => !empty($payload['reasonPreset']) ? trim($payload['reasonPreset']) : $current['reasonPreset'],
        'updatedAt' => date('c')
    ];

    $saved = @file_put_contents($configFile, json_encode($updated, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

    if ($saved === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to save configuration file'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => true,
        'config' => $updated
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}
