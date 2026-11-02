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

// تسجيل عملية التحميل تلقائياً في السيرفر لضمان معرفة من قام بالتحميل
$userId = !empty($_GET['user_id']) ? trim($_GET['user_id']) : (!empty($_GET['userId']) ? trim($_GET['userId']) : 'guest-student');
$userEmail = !empty($_GET['user_email']) ? strtolower(trim($_GET['user_email'])) : (!empty($_GET['email']) ? strtolower(trim($_GET['email'])) : '');
$userName = !empty($_GET['user_name']) ? trim($_GET['user_name']) : (!empty($_GET['name_user']) ? trim($_GET['name_user']) : 'طالب طرقع');

$logFile = __DIR__ . DIRECTORY_SEPARATOR . 'downloads_log.json';
if ($userId !== 'guest-student' || !empty($userEmail)) {
    try {
        $rawLog = @file_get_contents($logFile);
        $logData = $rawLog ? @json_decode($rawLog, true) : ['users' => [], 'events' => []];
        if (!is_array($logData)) $logData = ['users' => [], 'events' => []];
        if (!isset($logData['users'])) $logData['users'] = [];
        if (!isset($logData['events'])) $logData['events'] = [];

        $now = date('c');
        $fileEntry = [
            'id' => 'file-' . md5($requestedFile),
            'title' => $customName,
            'fileUrl' => '/api/download.php?file=' . urlencode($requestedFile),
            'fileType' => strtolower(pathinfo($filePath, PATHINFO_EXTENSION)),
            'fileSize' => filesize($filePath),
            'downloadedAt' => $now,
        ];

        $pk = ($userId !== 'guest-student') ? $userId : $userEmail;
        $existing = isset($logData['users'][$pk]) ? $logData['users'][$pk] : null;
        if ($existing) {
            $files = isset($existing['files']) && is_array($existing['files']) ? $existing['files'] : [];
            $files[] = $fileEntry;
            $existing['downloadCount'] = ($existing['downloadCount'] ?? count($files) - 1) + 1;
            $existing['lastDownloadedAt'] = $now;
            $existing['files'] = array_slice($files, -50);
            $logData['users'][$pk] = $existing;
        } else {
            $logData['users'][$pk] = [
                'userId' => $userId,
                'userEmail' => $userEmail,
                'userName' => $userName,
                'downloadCount' => 1,
                'lastDownloadedAt' => $now,
                'files' => [$fileEntry],
            ];
        }
        if (!empty($userEmail)) {
            $logData['users'][$userEmail] = $logData['users'][$pk];
        }

        $logData['events'][] = [
            'eventId' => 'evt-' . microtime(true),
            'fileTitle' => $customName,
            'userId' => $userId,
            'userEmail' => $userEmail,
            'userName' => $userName,
            'downloadedAt' => $now,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ];
        if (count($logData['events']) > 500) {
            $logData['events'] = array_slice($logData['events'], -500);
        }

        @file_put_contents($logFile, json_encode($logData, JSON_UNESCAPED_UNICODE));
    } catch (\Throwable $e) {}
}

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
