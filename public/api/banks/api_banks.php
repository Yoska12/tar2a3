<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية بنوك أسئلة المحاكي (Tarqa Simulator Banks API)
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

$action = $_GET['action'] ?? '';
$bankKey = $_GET['bank'] ?? 'search';
$examName = $_GET['exam'] ?? null;

$baseDir = __DIR__;
$candidatePaths = [
    $baseDir . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'banks' . DIRECTORY_SEPARATOR . 'search.json',
    $baseDir . DIRECTORY_SEPARATOR . 'search.json',
    $baseDir . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'mo7aky' . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'shared_questions.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'api' . DIRECTORY_SEPARATOR . 'banks' . DIRECTORY_SEPARATOR . 'search.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'search.json',
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'public' . DIRECTORY_SEPARATOR . 'shared_questions.json'
];

// إجراء حفظ الأسئلة (Save / Clear questions)
if ($action === 'save_questions' || ($_SERVER['REQUEST_METHOD'] === 'POST' && ($action === 'save' || $action === '' || $action === 'save_questions'))) {
    $raw = @file_get_contents('php://input');
    if (empty($raw) && isset($_POST['questions'])) {
        $raw = $_POST['questions'];
    }
    
    $decoded = @json_decode($raw, true);
    if (!is_array($decoded)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => 'البيانات المرسلة غير صالحة أو فارغة (تأكد من عدم تجاوز حجم الملف للحد المسموح)'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $jsonContent = json_encode($decoded, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    $writtenCount = 0;
    foreach ($candidatePaths as $file) {
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

// قراءة الأسئلة (GET)
$allQuestions = [];
foreach ($candidatePaths as $p) {
    if (file_exists($p)) {
        $raw = @file_get_contents($p);
        $decoded = @json_decode($raw, true);
        if (is_array($decoded)) {
            $allQuestions = $decoded;
            break;
        }
    }
}

// إذا طُلب جلب أسئلة بنك معين
if ($action === 'get_bank_questions') {
    $filtered = $allQuestions;
    if ($examName && trim($examName) !== '' && $examName !== 'اختبار مجمع') {
        $cleanExam = trim($examName);
        $matched = array_values(array_filter($allQuestions, function($q) use ($cleanExam) {
            return isset($q['exam']) && (
                $q['exam'] === $cleanExam ||
                strpos($q['exam'], $cleanExam) !== false ||
                strpos($cleanExam, $q['exam']) !== false
            );
        }));
        if (!empty($matched)) {
            $filtered = $matched;
        }
    }

    echo json_encode($filtered, JSON_UNESCAPED_UNICODE);
    exit;
}

// استخراج الأقسام الحقيقية ديناميكياً من الأسئلة المدخلة فعلياً
$examsMap = [];
foreach ($allQuestions as $q) {
    $eName = trim($q['exam'] ?? '');
    if ($eName !== '') {
        if (!isset($examsMap[$eName])) {
            $examsMap[$eName] = 0;
        }
        $examsMap[$eName]++;
    }
}

$examList = [];
foreach ($examsMap as $name => $count) {
    $examList[] = [
        'name' => $name,
        'question_count' => $count
    ];
}

$totalCount = count($allQuestions);

$banks = [];
if ($totalCount > 0) {
    $banks = [
        [
            'key' => 'search',
            'name' => 'محاكي الطرقعة الشامل',
            'file' => 'search.json',
            'question_count' => $totalCount,
            'exams' => $examList
        ],
        [
            'key' => 'level_test',
            'name' => 'اختبار تحديد المستوى',
            'file' => 'search.json',
            'question_count' => $totalCount,
            'exams' => $examList
        ],
        [
            'key' => 'tiger',
            'name' => 'محاكي واختبارات نمر',
            'file' => 'search.json',
            'question_count' => $totalCount,
            'exams' => $examList
        ]
    ];
}

echo json_encode([
    'success' => true,
    'banks' => $banks,
    'total_questions' => $totalCount,
    'bank_mapping' => [
        'search' => 'محاكي الطرقعة الشامل',
        'level_test' => 'اختبار تحديد المستوى',
        'tiger' => 'محاكي واختبارات نمر'
    ],
    'category_mapping' => [
        'قدرات - كمي' => 'search',
        'قدرات - لفظي' => 'search',
        'تحديد مستوى' => 'level_test',
        'تجميعات نمر' => 'tiger'
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
exit;
