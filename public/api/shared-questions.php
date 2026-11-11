<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية الأسئلة المشتركة وإدارة بنك الأسئلة (Shared Questions API)
 * ==============================================================================
 */
@ini_set('display_errors', 0);
@ini_set('display_startup_errors', 0);
@error_reporting(0);
@ini_set('memory_limit', '512M');
@ini_set('post_max_size', '128M');
@ini_set('upload_max_filesize', '128M');
@ini_set('max_execution_time', 300);
@ini_set('max_input_time', 300);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$baseDir = dirname(__DIR__);
$targetFiles = [
    __DIR__ . DIRECTORY_SEPARATOR . 'banks' . DIRECTORY_SEPARATOR . 'search.json',
    $baseDir . DIRECTORY_SEPARATOR . 'search.json',
    $baseDir . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'mo7aky' . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'banks' . DIRECTORY_SEPARATOR . 'search.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'search.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'shared_questions.json'
];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = @file_get_contents('php://input');
    if (empty($raw) && isset($_POST['questions'])) {
        $raw = $_POST['questions'];
    }

    $decoded = @json_decode($raw, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'البيانات المرسلة غير صالحة أو تجاوزت الحجم المسموح'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $jsonContent = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $writtenCount = 0;
    foreach ($targetFiles as $file) {
        $dir = dirname($file);
        if (!file_exists($dir)) {
            @mkdir($dir, 0755, true);
        }
        if (@file_put_contents($file, $jsonContent) !== false) {
            $writtenCount++;
        }
    }

    echo json_encode([
        'success' => true,
        'count' => count($decoded),
        'files_updated' => $writtenCount,
        'message' => count($decoded) > 0 
            ? 'تم حفظ ' . count($decoded) . ' سؤال بنجاح في بنك الأسئلة والسيرفر' 
            : 'تم تفريغ ومسح كافة الأسئلة بنجاح من بنك الأسئلة والسيرفر'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// GET
$questions = [];
foreach ($targetFiles as $file) {
    if (file_exists($file)) {
        $content = @file_get_contents($file);
        $decoded = @json_decode($content, true);
        if (is_array($decoded)) {
            $questions = $decoded;
            break;
        }
    }
}

echo json_encode($questions, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
exit;
