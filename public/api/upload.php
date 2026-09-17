<?php
/**
 * ==============================================================================
 * منصة طرقع - بوابة رفع الملفات والمذكرات والفيديوهات لسيرفر هوستينجر (Hostinger)
 * Tarqa Platform - Hostinger Direct File & Video Upload Handler
 * ==============================================================================
 */

// 1. ترويسات CORS الكاملة للسماح بالرفع من الموقع
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
header('Access-Control-Expose-Headers: Content-Length, Content-Range, Content-Disposition');

// معالجة طلبات الفحص المسبق (Preflight OPTIONS)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ضبط نوع الاستجابة JSON بترميز UTF-8
header('Content-Type: application/json; charset=utf-8');

// زيادة حدود استهلاك الذاكرة والوقت في بيئة PHP لرفع الملفات الكبيرة
@ini_set('memory_limit', '512M');
@ini_set('max_execution_time', '600');
@ini_set('max_input_time', '600');

// التحقق من طريقة الطلب
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'error' => 'طريقة الطلب غير مدعومة. يجب استخدام POST للرفع.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. تحديد مسار مجلد المرفقات داخل السيرفر (public_html/uploads)
$baseDir = dirname(__DIR__); // المجلد الأب (public أو الجذر)
$uploadsDir = $baseDir . DIRECTORY_SEPARATOR . 'uploads';

// إنشاء المجلد إذا لم يكن موجوداً بصلاحيات قراءة وكتابة
if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0755, true);
}

// 3. تأمين مجلد uploads بملف .htaccess يمنع تشغيل أي سكريبتات PHP داخل مجلد التحميل
$securityHtaccess = $uploadsDir . DIRECTORY_SEPARATOR . '.htaccess';
if (!file_exists($securityHtaccess)) {
    $htaccessContent = "# تأمين مجلد المرفقات في هوستينجر ومنع تنفيذ أي كود برمجي\n"
        . "<FilesMatch \"\\.(php|phtml|php3|php4|php5|php7|php8|phps|cgi|pl|sh|bash)$\">\n"
        . "    Order Allow,Deny\n"
        . "    Deny from all\n"
        . "</FilesMatch>\n"
        . "Options -ExecCGI -Indexes\n";
    @file_put_contents($securityHtaccess, $htaccessContent);
}

// 4. التحقق من وجود الملف في الطلب
if (!isset($_FILES['file']) || empty($_FILES['file']['name'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'لم يتم إرسال أي ملف في الطلب.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$uploadedFile = $_FILES['file'];

// فحص أخطاء الرفع الأصلية في PHP
if ($uploadedFile['error'] !== UPLOAD_ERR_OK) {
    $errorMessage = 'حدث خطأ أثناء استقبال الملف على السيرفر.';
    switch ($uploadedFile['error']) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            $errorMessage = 'حجم الملف يتجاوز الحد الأقصى المسموح به في إعدادات السيرفر.';
            break;
        case UPLOAD_ERR_PARTIAL:
            $errorMessage = 'تم رفع جزء من الملف فقط، يرجى إعادة المحاولة.';
            break;
        case UPLOAD_ERR_NO_FILE:
            $errorMessage = 'لم يتم تحديد ملف للرفع.';
            break;
        case UPLOAD_ERR_NO_TMP_DIR:
            $errorMessage = 'المجلد المؤقت على السيرفر غير متاح.';
            break;
        case UPLOAD_ERR_CANT_WRITE:
            $errorMessage = 'تعذر كتابة الملف على قرص السيرفر. تأكد من الصلاحيات.';
            break;
    }

    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $errorMessage,
        'errorCode' => $uploadedFile['error']
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 5. استخراج وتنظيف بيانات الملف
$originalName = basename($uploadedFile['name']);
$fileSize = (int)$uploadedFile['size'];
$ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

// قائمة الصيغ المسموح برفعها
$allowedExtensions = [
    // مستندات
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar',
    // فيديو وصوت
    'mp4', 'webm', 'mov', 'mkv', 'avi', 'mp3', 'wav',
    // صور
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'
];

if (!in_array($ext, $allowedExtensions, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => "امتداد الملف (.$ext) غير مسموح به في المنصة لأسباب أمنية."
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 6. توليد اسم آمن وفريد للملف يمنع التعارض والتداخل
$uploadType = isset($_POST['type']) ? preg_replace('/[^a-z0-9_-]/i', '', $_POST['type']) : ($ext === 'pdf' ? 'doc' : 'media');
$timestamp = time();
$randomHash = substr(bin2hex(random_bytes(6)), 0, 8);
$cleanNameSnippet = substr(preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($originalName, PATHINFO_FILENAME)), 0, 20);
$uniqueFileName = "trq_{$uploadType}_{$timestamp}_{$cleanNameSnippet}_{$randomHash}.{$ext}";

$targetFilePath = $uploadsDir . DIRECTORY_SEPARATOR . $uniqueFileName;

// 7. نقل الملف إلى مجلد التخزين الدائم
if (!@move_uploaded_file($uploadedFile['tmp_name'], $targetFilePath)) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'فشل في حفظ الملف داخل مجلد التخزين على هوستينجر. تأكد من صلاحيات الكتابة لمجلد uploads.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 8. تجهيز الروابط والبيانات للعرض والتنزيل
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['SERVER_PORT']) && $_SERVER['SERVER_PORT'] == 443) ? 'https://' : 'http://';
$host = $_SERVER['HTTP_HOST'] ?? 'localhost';
$relativeUrl = '/uploads/' . $uniqueFileName;
$absoluteUrl = $protocol . $host . $relativeUrl;

// تنسيق حجم الملف بشكل مقروء
function formatBytes($bytes, $precision = 2) {
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

$fileSizeFormatted = formatBytes($fileSize);

// استجابة النجاح
http_response_code(200);
echo json_encode([
    'success' => true,
    'fileUrl' => $relativeUrl,
    'absoluteUrl' => $absoluteUrl,
    'fileName' => $originalName,
    'savedName' => $uniqueFileName,
    'fileSize' => $fileSize,
    'fileSizeFormatted' => $fileSizeFormatted,
    'fileType' => $ext,
    'server' => 'hostinger',
    'uploadedAt' => date('c'),
    'message' => 'تم رفع الملف بنجاح وتخزينه على استضافة هوستينجر.'
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
