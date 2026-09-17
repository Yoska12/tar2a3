<?php
/**
 * ==============================================================================
 * منصة طرقع - بوابة تنزيل الملفات المباشرة من سيرفر هوستينجر (Hostinger Direct Download)
 * Tarqa Platform - Safe Attachment Downloader with Content-Disposition Headers
 * ==============================================================================
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, HEAD, OPTIONS');
header('Access-Control-Allow-Headers: Origin, X-Requested-With, Content-Type, Accept, Authorization, Range');
header('Access-Control-Expose-Headers: Content-Length, Content-Range, Content-Disposition');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = dirname(__DIR__);
$uploadsDir = realpath($baseDir . DIRECTORY_SEPARATOR . 'uploads');

if (!isset($_GET['file']) || empty($_GET['file'])) {
    http_response_code(400);
    echo "خطأ: لم يتم تحديد الملف المراد تنزيله.";
    exit;
}

// تنظيف اسم الملف ومنع هجمات Directory Traversal (../)
$requestedFile = basename($_GET['file']);
$filePath = realpath($uploadsDir . DIRECTORY_SEPARATOR . $requestedFile);

// التحقق من أن الملف موجود بالفعل وداخل مجلد uploads حصراً
if (!$filePath || !file_exists($filePath) || strpos($filePath, $uploadsDir) !== 0) {
    http_response_code(404);
    echo "خطأ: الملف المطلوب غير موجود على السيرفر.";
    exit;
}

// تحديد الاسم الظاهر للتنزيل لدى المستخدم
$customName = !empty($_GET['name']) ? basename($_GET['name']) : $requestedFile;
$cleanName = preg_replace('/[/\\?%*:|"<>#]/', '-', $customName);
$encodedName = rawurlencode($cleanName);

// تحديد نوع MIME
$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
$mimeTypes = [
    'pdf' => 'application/pdf',
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    'svg' => 'image/svg+xml',
    'mp4' => 'video/mp4',
    'webm' => 'video/webm',
    'mov' => 'video/quicktime',
    'zip' => 'application/zip',
    'rar' => 'application/x-rar-compressed',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
$contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

$fileSize = filesize($filePath);

// ترويسات التنزيل الإجباري للموبايل والكمبيوتر
header('Content-Description: File Transfer');
header('Content-Type: ' . $contentType);
header("Content-Disposition: attachment; filename=\"{$cleanName}\"; filename*=UTF-8''{$encodedName}");
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate, post-check=0, pre-check=0');
header('Pragma: public');
header('Content-Length: ' . $fileSize);
header('Accept-Ranges: bytes');

// إيقاف أي Buffer لتسريع البث المباشر
if (ob_get_level()) {
    ob_end_clean();
}

// قراءة وبث الملف بكتل 8KB لتفادي استهلاك ذاكرة السيرفر
$handle = fopen($filePath, 'rb');
if ($handle !== false) {
    while (!feof($handle)) {
        echo fread($handle, 8192);
        flush();
    }
    fclose($handle);
} else {
    readfile($filePath);
}
exit;
