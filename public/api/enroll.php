<?php
/**
 * منصة طرقع - نقطة نهاية التحقق من حالة التسجيل والاشتراك بالدورات
 * Hostinger PHP API Endpoint: /api/enroll.php
 * 
 * يتحقق من حالة الدورة قبل بدء الدفع أو التسجيل، ويمنع أي عملية إذا كانت موقوفة مؤقتاً (Paused)
 */

header('Content-Type: application/json; charset=utf-8');

// 1. معالجة سياسات مشاركة الموارد (CORS)
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
    header("Access-Control-Allow-Origin: https://tarqa3.net");
}

header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// معالجة طلبات Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 2. قراءة البيانات المرسلة (JSON أو Form Data)
$raw_input = file_get_contents('php://input');
$data = json_decode($raw_input, true);
if (!$data && !empty($_POST)) {
    $data = $_POST;
}

$course_id = isset($data['course_id']) ? trim($data['course_id']) : (isset($_GET['course_id']) ? trim($_GET['course_id']) : 'mod-lectures');
$user_id = isset($data['user_id']) ? trim($data['user_id']) : '';

// 3. ملف حالة الدورات المخزن محلياً على خادم هوستينجر (أو قاعدة البيانات)
$status_file = __DIR__ . '/course_status.json';

// الحالة الافتراضية
$current_status = 'paused';
$custom_status_text = 'الاشتراك متاح قريباً ⏳';
$available_date = '';

if (file_exists($status_file)) {
    $status_data = json_decode(file_get_contents($status_file), true);
    if (isset($status_data[$course_id])) {
        $current_status = $status_data[$course_id]['status'] ?? 'paused';
        $custom_status_text = $status_data[$course_id]['custom_status_text'] ?? 'الاشتراك متاح قريباً ⏳';
        $available_date = $status_data[$course_id]['available_date'] ?? '';
    }
}

// إذا كان الطلب استعلام GET عن حالة الدورة
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'success' => true,
        'course_id' => $course_id,
        'status' => $current_status,
        'is_enrollable' => ($current_status === 'active'),
        'custom_status_text' => $custom_status_text,
        'available_date' => $available_date,
        'button_text' => ($current_status === 'active') ? 'اشترك الآن 🚀' : ($custom_status_text ?: 'قريباً ⏳')
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// ==============================================================================
// 4. التحقق الأمني: منع التسجيل إذا كانت الدورة موقوفة أو قادمة
// ==============================================================================
if ($current_status !== 'active') {
    http_response_code(403); // Forbidden
    echo json_encode([
        'success' => false,
        'error' => 'Course enrollment is currently paused',
        'error_code' => 'ENROLLMENT_PAUSED',
        'status' => $current_status,
        'message' => 'عذراً، التسجيل في هذه الدورة مغلق مؤقتاً لحين إعادة فتحها.',
        'custom_status_text' => $custom_status_text,
        'available_date' => $available_date
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// إذا كانت الدورة نشطة ومتاحة، يتم إكمال إجراءات التسجيل
http_response_code(200);
echo json_encode([
    'success' => true,
    'course_id' => $course_id,
    'status' => 'active',
    'message' => 'التسجيل متاح بنجاح لهذه الدورة، جارٍ توجيهك لبوابة الدفع.'
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
