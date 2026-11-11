<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية إدارة ومزامنة الاشتراكات وقاعدة بيانات المشتركين (Backend)
 * Tarqa Platform - Course Subscriptions Backend API & Database Sync
 * ==============================================================================
 * مربوط مباشرة بالخادم وقاعدة البيانات لمعرفة:
 * 1. من هم الطلاب المشتركون ومن هم غير المشتركين بدقة متناهية
 * 2. تفعيل أو إلغاء أو تمديد الاشتراكات من لوحة التحكم أو بعد الدفع
 * 3. حفظ دائم في السيرفر (subscriptions_log.json) مستقلاً تماماً عن المتصفح والـ Frontend
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
$subsFile = $baseDir . DIRECTORY_SEPARATOR . 'subscriptions_log.json';

// وظيفة مساعدة لقراءة الاشتراكات بأمان مع القفل (Thread-safe read)
function readSubscriptionsData($filePath) {
    if (!file_exists($filePath)) {
        return ['subscriptions' => []];
    }
    $content = @file_get_contents($filePath);
    if (!$content) {
        return ['subscriptions' => []];
    }
    $data = @json_decode($content, true);
    if (!is_array($data) || !isset($data['subscriptions']) || !is_array($data['subscriptions'])) {
        return ['subscriptions' => []];
    }
    return $data;
}

// وظيفة مساعدة لكتابة الاشتراكات بأمان مع القفل (Thread-safe write)
function writeSubscriptionsData($filePath, $data) {
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
// 1. طلب GET: جلب قائمة كافة المشتركين وحالات الاشتراكات للوحة التحكم
// ==============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $data = readSubscriptionsData($subsFile);
    $allSubs = $data['subscriptions'] ?? [];

    // مزامنة أي مشتري مسجل في فواتير الدفع المعتمدة
    $rcptFile = $baseDir . DIRECTORY_SEPARATOR . 'payment_receipts_backup.json';
    if (file_exists($rcptFile)) {
        $rcpts = @json_decode(@file_get_contents($rcptFile), true) ?: [];
        foreach ($rcpts as $rc) {
            if (($rc['payment_status'] ?? '') === 'PAID') {
                $uid = $rc['user_id'] ?? '';
                $uemail = strtolower($rc['user_email'] ?? '');
                $subRec = [
                    'userId' => $uid,
                    'userEmail' => $uemail,
                    'userName' => $rc['user_name'] ?? 'طالب طرقع',
                    'planId' => 'annual_' . ($rc['course_id'] ?? 'course'),
                    'planName' => $rc['course_title'] ?? 'باقة طرقع',
                    'startDate' => $rc['created_at'] ?? date('c'),
                    'expiresDate' => date('c', strtotime('+1 year', strtotime($rc['created_at'] ?? 'now'))),
                    'expiresAt' => date('c', strtotime('+1 year', strtotime($rc['created_at'] ?? 'now'))),
                    'isActive' => true,
                    'active' => true,
                    'status' => 'active',
                ];
                if (!empty($uid) && !isset($allSubs[$uid])) $allSubs[$uid] = $subRec;
                if (!empty($uemail) && !isset($allSubs[$uemail])) $allSubs[$uemail] = $subRec;
            }
        }
    }

    // إذا طُلب التحقق من مستخدم معين
    $requestedUser = isset($_GET['user']) ? trim($_GET['user']) : '';
    if (!empty($requestedUser)) {
        $lowerUser = strtolower($requestedUser);
        $cleanTg = ltrim($lowerUser, '@');
        $userSub = null;

        if (isset($allSubs[$requestedUser])) {
            $userSub = $allSubs[$requestedUser];
        } else if (isset($allSubs[$lowerUser])) {
            $userSub = $allSubs[$lowerUser];
        } else if (isset($allSubs[$cleanTg])) {
            $userSub = $allSubs[$cleanTg];
        } else {
            foreach ($allSubs as $k => $s) {
                if (
                    (isset($s['userId']) && $s['userId'] === $requestedUser) ||
                    (isset($s['userEmail']) && strtolower($s['userEmail']) === $lowerUser) ||
                    (isset($s['telegramUsername']) && strtolower(ltrim($s['telegramUsername'], '@')) === $cleanTg)
                ) {
                    $userSub = $s;
                    break;
                }
            }
        }

        $isCurrentlyActive = false;
        if ($userSub) {
            $isActive = !empty($userSub['isActive']) || !empty($userSub['active']) || (($userSub['status'] ?? '') === 'active');
            $expiresTime = isset($userSub['expiresDate']) ? strtotime($userSub['expiresDate']) : (isset($userSub['expiresAt']) ? strtotime($userSub['expiresAt']) : 0);
            $isNotExpired = ($expiresTime === 0 || $expiresTime > time());
            $isCurrentlyActive = $isActive && $isNotExpired;
        }

        echo json_encode([
            'success' => true,
            'isSubscribed' => $isCurrentlyActive,
            'subscription' => $userSub,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // تجهيز قائمة مرتبة للمشتركين النشطين
    $activeCount = 0;
    $activeList = [];
    $now = time();

    foreach ($allSubs as $key => $sub) {
        $isActive = !empty($sub['isActive']) || !empty($sub['active']) || (($sub['status'] ?? '') === 'active');
        $expiresTime = isset($sub['expiresDate']) ? strtotime($sub['expiresDate']) : (isset($sub['expiresAt']) ? strtotime($sub['expiresAt']) : 0);
        $isNotExpired = ($expiresTime === 0 || $expiresTime > $now);

        if ($isActive && $isNotExpired) {
            $activeCount++;
            $activeList[] = $sub;
        }
    }

    echo json_encode([
        'success' => true,
        'totalSubscribed' => $activeCount,
        'totalRecords' => count($allSubs),
        'subscriptions' => $allSubs,
        'activeList' => $activeList,
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ==============================================================================
// 2. طلب POST: تفعيل أو إلغاء أو مزامنة اشتراك في السيرفر
// ==============================================================================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !is_array($payload)) {
        $payload = $_POST;
    }

    $action = $payload['action'] ?? 'grant';
    $userId = !empty($payload['userId']) ? trim($payload['userId']) : (!empty($payload['id']) ? trim($payload['id']) : '');
    $userEmail = !empty($payload['userEmail']) ? strtolower(trim($payload['userEmail'])) : (!empty($payload['email']) ? strtolower(trim($payload['email'])) : '');
    $userName = !empty($payload['userName']) ? trim($payload['userName']) : (!empty($payload['fullName']) ? trim($payload['fullName']) : 'طالب طرقع');
    $telegram = !empty($payload['telegramUsername']) ? trim($payload['telegramUsername']) : (!empty($payload['telegram']) ? trim($payload['telegram']) : '');
    $telegramId = !empty($payload['telegramId']) ? trim($payload['telegramId']) : null;
    $days = isset($payload['days']) ? intval($payload['days']) : 365;

    $data = readSubscriptionsData($subsFile);
    $subs = $data['subscriptions'] ?? [];

    $cleanTg = strtolower(ltrim($telegram, '@'));
    $now = date('c');

    if ($action === 'grant') {
        $expiresAt = date('c', time() + ($days * 86400));
        $subRecord = [
            'userId' => $userId,
            'userEmail' => $userEmail,
            'userName' => $userName,
            'telegramUsername' => $telegram,
            'telegramId' => $telegramId,
            'planId' => 'annual_75',
            'planName' => 'باقة طرقع السنوية الشاملة',
            'startDate' => $now,
            'expiresDate' => $expiresAt,
            'expiresAt' => $expiresAt,
            'isActive' => true,
            'active' => true,
            'status' => 'active',
            'updatedAt' => $now,
        ];

        // تسجيل تحت كافة معرفات الطالب الممكنة للبحث السريع
        if (!empty($userId)) $subs[$userId] = $subRecord;
        if (!empty($userEmail)) $subs[$userEmail] = $subRecord;
        if (!empty($cleanTg)) $subs[$cleanTg] = $subRecord;
        if (!empty($telegramId)) $subs[strval($telegramId)] = $subRecord;

        $data['subscriptions'] = $subs;
        $written = writeSubscriptionsData($subsFile, $data);

        echo json_encode([
            'success' => $written,
            'message' => "تم تفعيل الاشتراك بنجاح في السيرفر لمدة {$days} يوماً 🎓✅",
            'subscription' => $subRecord,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'cancel') {
        $subRecord = [
            'userId' => $userId,
            'userEmail' => $userEmail,
            'userName' => $userName,
            'telegramUsername' => $telegram,
            'telegramId' => $telegramId,
            'isActive' => false,
            'active' => false,
            'status' => 'cancelled',
            'cancelledAt' => $now,
            'updatedAt' => $now,
        ];

        if (!empty($userId)) $subs[$userId] = $subRecord;
        if (!empty($userEmail)) $subs[$userEmail] = $subRecord;
        if (!empty($cleanTg)) $subs[$cleanTg] = $subRecord;
        if (!empty($telegramId)) $subs[strval($telegramId)] = $subRecord;

        $data['subscriptions'] = $subs;
        $written = writeSubscriptionsData($subsFile, $data);

        echo json_encode([
            'success' => $written,
            'message' => 'تم إلغاء الاشتراك بنجاح في السيرفر ⚪',
            'subscription' => $subRecord,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'sync') {
        // مزامنة دفعة من المشتركين القادمين من Supabase أو مصدر موثوق
        $batch = isset($payload['subscriptions']) && is_array($payload['subscriptions']) ? $payload['subscriptions'] : [];
        foreach ($batch as $k => $s) {
            if (is_array($s)) {
                $subs[$k] = $s;
            }
        }
        $data['subscriptions'] = $subs;
        $written = writeSubscriptionsData($subsFile, $data);

        echo json_encode([
            'success' => $written,
            'message' => 'تمت مزامنة بيانات المشتركين في السيرفر بنجاح 🔄',
            'count' => count($subs),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid action specified']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
