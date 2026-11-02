<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية تسجيل ومتابعة تحميلات الطلاب للملفات والمذكرات (Backend)
 * Tarqa Platform - Backend File Download Tracker & Auditor
 * ==============================================================================
 * تسجل في قاعدة بيانات السيرفر (downloads_log.json) بدقة متناهية:
 * 1. هوية الطالب (الاسم، البريد الإلكتروني، المعرف ID، وتليجرام)
 * 2. تفاصيل الملف (العنوان، المعرف، الرابط، الحجم، والنوع)
 * 3. التوقيت الدقيق وعنوان الـ IP والمتصفح
 * 4. تزامن مع لوحة تحكم السوبر أدمن فوراً لبيان من قام بالتحميل بالتفصيل
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = __DIR__;
$logFile = $baseDir . DIRECTORY_SEPARATOR . 'downloads_log.json';

// وظيفة مساعدة لقراءة السجل بأمان مع القفل (Thread-safe read)
function readDownloadsLog($filePath) {
    if (!file_exists($filePath)) {
        return ['users' => [], 'events' => []];
    }
    $content = @file_get_contents($filePath);
    if (!$content) {
        return ['users' => [], 'events' => []];
    }
    $data = @json_decode($content, true);
    if (!is_array($data)) {
        return ['users' => [], 'events' => []];
    }
    if (!isset($data['users'])) $data['users'] = [];
    if (!isset($data['events'])) $data['events'] = [];
    return $data;
}

// وظيفة مساعدة لكتابة السجل بأمان مع القفل (Thread-safe write)
function writeDownloadsLog($filePath, $data) {
    $fp = @fopen($filePath, 'c+');
    if (!$fp) return false;

    if (flock($fp, LOCK_EX)) {
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return true;
    }
    fclose($fp);
    return false;
}

// ==============================================================================
// 1. طلب GET: جلب سجلات كافة الطلاب المحملين للوحة الإدارة
// ==============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $log = readDownloadsLog($logFile);
    
    // إذا طُلب مستخدم معين عبر المعرف أو الإيميل
    $requestedUser = isset($_GET['user']) ? trim($_GET['user']) : '';
    if (!empty($requestedUser)) {
        $lowerUser = strtolower($requestedUser);
        $userRecord = null;
        if (isset($log['users'][$requestedUser])) {
            $userRecord = $log['users'][$requestedUser];
        } else if (isset($log['users'][$lowerUser])) {
            $userRecord = $log['users'][$lowerUser];
        } else {
            foreach ($log['users'] as $k => $u) {
                if (
                    (isset($u['userId']) && $u['userId'] === $requestedUser) ||
                    (isset($u['userEmail']) && strtolower($u['userEmail']) === $lowerUser)
                ) {
                    $userRecord = $u;
                    break;
                }
            }
        }

        echo json_encode([
            'success' => true,
            'record' => $userRecord,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // إرجاع كافة السجلات بصيغة سهلة الدمج مع الواجهة
    echo json_encode([
        'success' => true,
        'totalUsersWithDownloads' => count($log['users']),
        'totalEvents' => count($log['events']),
        'users' => $log['users'],
        'latestEvents' => array_slice(array_reverse($log['events']), 0, 50),
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==============================================================================
// 2. طلب POST: تسجيل عملية تحميل جديدة من الواجهة
// ==============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !is_array($payload)) {
        // دعم استقبال البيانات عبر Form-data / POST العادي
        $payload = $_POST;
    }

    // دعم مسح سجل تحميلات طالب معين إذا طلب الأدمن ذلك
    if (isset($payload['action']) && $payload['action'] === 'clear') {
        $targetUser = !empty($payload['userId']) ? trim($payload['userId']) : (!empty($payload['userEmail']) ? strtolower(trim($payload['userEmail'])) : '');
        $log = readDownloadsLog($logFile);
        if (!empty($targetUser)) {
            unset($log['users'][$targetUser]);
            if (!empty($payload['userEmail'])) {
                unset($log['users'][strtolower(trim($payload['userEmail']))]);
            }
            if (!empty($payload['userId'])) {
                unset($log['users'][trim($payload['userId'])]);
            }
            writeDownloadsLog($logFile, $log);
        }
        echo json_encode(['success' => true, 'message' => 'تم مسح سجل التحميلات بنجاح من الخادم 🗑️']);
        exit;
    }

    $fileTitle = !empty($payload['fileTitle']) ? trim($payload['fileTitle']) : (!empty($payload['title']) ? trim($payload['title']) : 'مذكرة دراسية');
    $fileId    = !empty($payload['fileId']) ? trim($payload['fileId']) : (!empty($payload['id']) ? trim($payload['id']) : 'file-' . time());
    $fileUrl   = !empty($payload['fileUrl']) ? trim($payload['fileUrl']) : '';
    $fileType  = !empty($payload['fileType']) ? trim($payload['fileType']) : 'pdf';
    $fileSize  = !empty($payload['fileSize']) ? trim($payload['fileSize']) : 'PDF';

    $userId    = !empty($payload['userId']) ? trim($payload['userId']) : 'guest-student';
    $userEmail = !empty($payload['userEmail']) ? strtolower(trim($payload['userEmail'])) : (!empty($payload['email']) ? strtolower(trim($payload['email'])) : '');
    $userName  = !empty($payload['userName']) ? trim($payload['userName']) : (!empty($payload['name']) ? trim($payload['name']) : 'طالب طرقع');
    $telegram  = !empty($payload['telegramUsername']) ? trim($payload['telegramUsername']) : (!empty($payload['telegram']) ? trim($payload['telegram']) : '');

    $now = date('c');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';

    $downloadEvent = [
        'eventId' => 'evt-' . microtime(true) . '-' . mt_rand(100, 999),
        'fileId' => $fileId,
        'fileTitle' => $fileTitle,
        'fileUrl' => $fileUrl,
        'fileType' => $fileType,
        'fileSize' => $fileSize,
        'userId' => $userId,
        'userEmail' => $userEmail,
        'userName' => $userName,
        'telegram' => $telegram,
        'ip' => $ip,
        'downloadedAt' => $now,
    ];

    $log = readDownloadsLog($logFile);

    // إضافة الحدث في قائمة الأحداث العامة (نحتفظ بآخر 500 حدث)
    $log['events'][] = $downloadEvent;
    if (count($log['events']) > 500) {
        $log['events'] = array_slice($log['events'], -500);
    }

    // تحديد المفتاح الرئيسي للمستخدم (الـ ID أو البريد الإلكتروني)
    $primaryKey = ($userId !== 'guest-student' && !empty($userId)) ? $userId : ($userEmail ?: 'guest-' . md5($ip));

    $existing = isset($log['users'][$primaryKey]) ? $log['users'][$primaryKey] : null;
    if (!$existing && !empty($userEmail) && isset($log['users'][$userEmail])) {
        $existing = $log['users'][$userEmail];
    }

    $fileEntry = [
        'id' => $fileId,
        'title' => $fileTitle,
        'fileUrl' => $fileUrl,
        'fileType' => $fileType,
        'fileSize' => $fileSize,
        'downloadedAt' => $now,
    ];

    if ($existing) {
        $existingFiles = isset($existing['files']) && is_array($existing['files']) ? $existing['files'] : [];
        $existingFiles[] = $fileEntry;
        
        $updatedUser = [
            'userId' => ($userId !== 'guest-student' && !empty($userId)) ? $userId : ($existing['userId'] ?? $userId),
            'userEmail' => $userEmail ?: ($existing['userEmail'] ?? ''),
            'userName' => ($userName !== 'طالب طرقع' && !empty($userName)) ? $userName : ($existing['userName'] ?? $userName),
            'telegramUsername' => $telegram ?: ($existing['telegramUsername'] ?? ''),
            'downloadCount' => ($existing['downloadCount'] ?? count($existingFiles) - 1) + 1,
            'lastDownloadedAt' => $now,
            'files' => array_slice($existingFiles, -50), // نحتفظ بآخر 50 ملفاً
        ];
    } else {
        $updatedUser = [
            'userId' => $userId,
            'userEmail' => $userEmail,
            'userName' => $userName,
            'telegramUsername' => $telegram,
            'downloadCount' => 1,
            'lastDownloadedAt' => $now,
            'files' => [$fileEntry],
        ];
    }

    // حفظ تحت المفتاح الرئيسي وتحت البريد الإلكتروني أيضاً لتسهيل البحث
    $log['users'][$primaryKey] = $updatedUser;
    if (!empty($userEmail)) {
        $log['users'][$userEmail] = $updatedUser;
    }
    if (!empty($userId) && $userId !== 'guest-student') {
        $log['users'][$userId] = $updatedUser;
    }

    $written = writeDownloadsLog($logFile, $log);

    echo json_encode([
        'success' => $written,
        'message' => 'تم تسجيل التحميل بنجاح في السيرفر 📥',
        'record' => $updatedUser,
        'event' => $downloadEvent,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
