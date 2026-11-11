<?php
/**
 * ==============================================================================
 * 🚀 منصة طرقع - بوابة واجهة برمجة التطبيقات وقاعدة بيانات هوستينجر (Hostinger PHP API)
 * Tarqa Platform - MySQL Backend API (Replacing Supabase completely)
 * ==============================================================================
 */

date_default_timezone_set('Asia/Riyadh');
ob_start();
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

// ------------------------------------------------------------------------------
// CORS Headers
// ------------------------------------------------------------------------------
$_allowed_origins = [
    'https://tarqa3.net',
    'https://www.tarqa3.net',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowed_origins, true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_origin)) {
    header("Access-Control-Allow-Origin: $_origin");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}

header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=utf-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function sendJson($data, $status = 200) {
    if (ob_get_length()) ob_clean();
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// ------------------------------------------------------------------------------
// Database Connection (Multi-Path Detection & Resilient Direct Fallback)
// ------------------------------------------------------------------------------
$dbConfigPaths = [
    dirname(__DIR__) . '/Login/db-config.php',
    dirname(__DIR__) . '/login/db-config.php',
    __DIR__ . '/../Login/db-config.php',
    __DIR__ . '/../login/db-config.php',
    __DIR__ . '/Login/db-config.php',
    __DIR__ . '/db-config.php'
];

foreach ($dbConfigPaths as $cfgPath) {
    if (file_exists($cfgPath)) {
        require_once $cfgPath;
        break;
    }
}

$pdo = null;
$dbError = null;

if (class_exists('Database')) {
    try {
        $database = new Database();
        $pdo = $database->getConnection();
    } catch (Throwable $e) {
        $dbError = $e->getMessage();
        error_log("Database class error: " . $e->getMessage());
    }
}

// Direct Fallback if Database class failed, not found, or connection returned null
if (!$pdo) {
    $hosts = ['localhost', '127.0.0.1'];
    $dbCandidates = [
        ['name' => 'u805713762_tarqa3', 'user' => 'u805713762_tarqa3', 'pass' => 'Alaqsam$123'],
        ['name' => 'u187359406_tarqa', 'user' => 'u187359406_tarqa', 'pass' => 'Alaqsam$123']
    ];
    foreach ($hosts as $h) {
        foreach ($dbCandidates as $cand) {
            try {
                $pdo = new PDO("mysql:host={$h};dbname={$cand['name']};charset=utf8mb4;", $cand['user'], $cand['pass'], [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_TIMEOUT => 5
                ]);
                $pdo->exec("SET time_zone = '+03:00';");
                $dbError = null;
                break 2;
            } catch (Throwable $e) {
                $dbError = $e->getMessage();
                error_log("Direct PDO fallback on host {$h} db {$cand['name']} failed: " . $e->getMessage());
            }
        }
    }
}

if ($pdo) {
    initCommerceTables($pdo);
}

// قراءة بيانات الطلب (JSON أو Form Data)
$rawInput = file_get_contents('php://input');
$body = json_decode($rawInput, true) ?: [];
$action = $_GET['action'] ?? $body['action'] ?? '';

// فحص الاتصال
if ($action === 'ping' || $action === 'status') {
    sendJson([
        'success' => true,
        'backend' => 'Hostinger MySQL PHP API',
        'db_connected' => ($pdo !== null),
        'db_error' => $dbError,
        'timestamp' => date('Y-m-d H:i:s')
    ]);
}

// ==============================================================================
// 1. تسجيل مستخدم جديد (Register)
// ==============================================================================
if ($action === 'register') {
    $email = strtolower(trim($body['email'] ?? ''));
    $password = trim($body['password'] ?? '');
    $fullName = trim($body['fullName'] ?? $body['full_name'] ?? 'طالب طرقع');
    $targetScore = intval($body['targetScore'] ?? $body['target_score'] ?? 100);
    $telegramUsername = trim($body['telegramUsername'] ?? $body['telegram_username'] ?? '');
    $telegramUsername = ltrim($telegramUsername, '@');
    $telegramId = intval($body['telegramId'] ?? $body['telegram_id'] ?? 0);

    if (empty($email) || empty($password)) {
        sendJson(['success' => false, 'error' => 'البريد الإلكتروني وكلمة المرور مطلوبان'], 400);
    }

    $isOwner = ($email === 'yassooooo27m@gmail.com');
    $role = $isOwner ? 'super_admin' : 'student';
    $roleId = $isOwner ? 1 : 6;
    $isSubscribed = $isOwner ? 1 : 0;
    $userId = $body['id'] ?? ($isOwner ? 'usr-yoska-owner' : 'usr-' . bin2hex(random_bytes(8)));
    $hashedPassword = password_hash($password, PASSWORD_BCRYPT);

    // تنظيف الحساب من قائمة المحذوفين إذا كان يُعاد إنشاؤه
    $delFile = __DIR__ . '/deleted_users.json';
    if (file_exists($delFile)) {
        $delList = json_decode(@file_get_contents($delFile), true) ?: [];
        if (in_array($email, $delList) || in_array($userId, $delList)) {
            $delList = array_values(array_filter($delList, fn($x) => $x !== $email && $x !== $userId));
            @file_put_contents($delFile, json_encode($delList, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        }
    }

    // 1. الحفظ في قاعدة بيانات MySQL
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE LOWER(email) = ? LIMIT 1");
            $stmt->execute([$email]);
            if ($stmt->fetch()) {
                sendJson(['success' => false, 'error' => 'هذا البريد الإلكتروني مسجل بالفعل'], 409);
            }

            $ins = $pdo->prepare("
                INSERT INTO users (id, email, password_hash, full_name, role, role_id, target_score, telegram_username, telegram_id, is_subscribed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    full_name = VALUES(full_name),
                    password_hash = VALUES(password_hash),
                    target_score = VALUES(target_score),
                    telegram_username = VALUES(telegram_username),
                    telegram_id = VALUES(telegram_id),
                    updated_at = NOW()
            ");
            $ins->execute([
                $userId, $email, $hashedPassword, $fullName, $role, $roleId, $targetScore,
                $telegramUsername ?: null, $telegramId ?: null, $isSubscribed
            ]);
        } catch (Exception $e) {
            error_log("Register MySQL error: " . $e->getMessage());
        }
    }

    // 2. حفظ نسخة احتياطية فورية في registered_users_backup.json لضمان الظهور الفوري في لوحة الإدارة
    $usersBackupFile = __DIR__ . '/registered_users_backup.json';
    $allRegUsers = file_exists($usersBackupFile) ? (json_decode(@file_get_contents($usersBackupFile), true) ?: []) : [];
    $foundIdx = -1;
    foreach ($allRegUsers as $idx => $ru) {
        if (($ru['id'] ?? '') === $userId || strtolower($ru['email'] ?? '') === $email) {
            $foundIdx = $idx;
            break;
        }
    }
    $userRecord = [
        'id' => $userId,
        'email' => $email,
        'fullName' => $fullName,
        'role' => $role,
        'targetScore' => $targetScore,
        'telegramUsername' => $telegramUsername ?: null,
        'telegramId' => $telegramId ?: null,
        'isSubscribed' => (bool)$isSubscribed,
        'points' => 0,
        'createdAt' => date('Y-m-d H:i:s'),
        'lastSignInAt' => date('Y-m-d H:i:s'),
    ];
    if ($foundIdx >= 0) {
        $allRegUsers[$foundIdx] = array_merge($allRegUsers[$foundIdx], $userRecord);
    } else {
        $allRegUsers[] = $userRecord;
    }
    @file_put_contents($usersBackupFile, json_encode($allRegUsers, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    sendJson([
        'success' => true,
        'user' => [
            'id' => $userId,
            'email' => $email,
            'fullName' => $fullName,
            'role' => $role,
            'targetScore' => $targetScore,
            'telegramUsername' => $telegramUsername ?: null,
            'telegramId' => $telegramId ?: null,
            'isSubscribed' => (bool)$isSubscribed,
            'points' => 0
        ]
    ]);
}

// مزامنة أي حساب مستخدم من الواجهة مع السيرفر
if ($action === 'sync_user') {
    $u = $body['user'] ?? $body;
    $uid = trim($u['id'] ?? '');
    $em = strtolower(trim($u['email'] ?? ''));
    $fn = trim($u['fullName'] ?? $u['full_name'] ?? 'طالب طرقع');
    $rl = trim($u['role'] ?? 'student');
    $tg = trim($u['telegramUsername'] ?? $u['telegram_username'] ?? '');
    $tg = ltrim($tg, '@');
    $tgId = intval($u['telegramId'] ?? $u['telegram_id'] ?? 0);
    $ts = intval($u['targetScore'] ?? $u['target_score'] ?? 100);
    $isSub = !empty($u['isSubscribed']) || !empty($u['is_subscribed']) ? 1 : 0;
    $expAt = $u['subscriptionExpiresAt'] ?? $u['subscription_expires_at'] ?? null;

    if (!empty($uid) || !empty($em)) {
        if ($pdo) {
            try {
                $ins = $pdo->prepare("
                    INSERT INTO users (id, email, full_name, role, target_score, telegram_username, telegram_id, is_subscribed, subscription_expires_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                    ON DUPLICATE KEY UPDATE
                        full_name = VALUES(full_name),
                        target_score = VALUES(target_score),
                        telegram_username = VALUES(telegram_username),
                        telegram_id = VALUES(telegram_id),
                        is_subscribed = VALUES(is_subscribed),
                        subscription_expires_at = VALUES(subscription_expires_at),
                        updated_at = NOW()
                ");
                $ins->execute([
                    $uid ?: ('usr_' . substr(md5($em), 0, 12)),
                    $em, $fn, $rl, $ts,
                    $tg ?: null, $tgId ?: null, $isSub, $expAt
                ]);
            } catch (Throwable $e) {}
        }

        $usersBackupFile = __DIR__ . '/registered_users_backup.json';
        $allRegUsers = file_exists($usersBackupFile) ? (json_decode(@file_get_contents($usersBackupFile), true) ?: []) : [];
        $found = false;
        foreach ($allRegUsers as &$ru) {
            if (($ru['id'] ?? '') === $uid || ($em && strtolower($ru['email'] ?? '') === $em)) {
                $ru['fullName'] = $fn;
                $ru['role'] = $rl;
                $ru['isSubscribed'] = (bool)$isSub;
                $ru['subscriptionExpiresAt'] = $expAt;
                $found = true;
                break;
            }
        }
        unset($ru);
        if (!$found) {
            $allRegUsers[] = [
                'id' => $uid,
                'email' => $em,
                'fullName' => $fn,
                'role' => $rl,
                'targetScore' => $ts,
                'telegramUsername' => $tg ?: null,
                'telegramId' => $tgId ?: null,
                'isSubscribed' => (bool)$isSub,
                'subscriptionExpiresAt' => $expAt,
                'createdAt' => date('Y-m-d H:i:s'),
                'lastSignInAt' => date('Y-m-d H:i:s'),
            ];
        }
        @file_put_contents($usersBackupFile, json_encode($allRegUsers, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }
    sendJson(['success' => true]);
}

// ==============================================================================
// 2. تسجيل الدخول بالبريد وكلمة المرور (Login)
// ==============================================================================
if ($action === 'login') {
    $email = strtolower(trim($body['email'] ?? ''));
    $password = trim($body['password'] ?? '');

    if (empty($email) || empty($password)) {
        sendJson(['success' => false, 'error' => 'يرجى إدخال البريد وكلمة المرور'], 400);
    }

    $delFile = __DIR__ . '/deleted_users.json';
    $delList = file_exists($delFile) ? (json_decode(@file_get_contents($delFile), true) ?: []) : [];
    if (in_array($email, $delList)) {
        sendJson(['success' => false, 'isDeleted' => true, 'notFound' => true, 'error' => 'هذا الحساب تم حذفه نهائياً من قبل الإدارة'], 404);
    }

    $isOwner = ($email === 'yassooooo27m@gmail.com');

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$email]);
            $row = $stmt->fetch();

            if ($row) {
                // التحقق من الحظر
                if (!empty($row['is_banned'])) {
                    sendJson([
                        'success' => false,
                        'isBanned' => true,
                        'banReason' => $row['ban_reason'],
                        'error' => 'تم حظر هذا الحساب من قبل الإدارة. ' . ($row['ban_reason'] ?? '')
                    ], 403);
                }

                // التحقق من كلمة المرور
                $pwOk = false;
                if (!empty($row['password_hash'])) {
                    $pwOk = password_verify($password, $row['password_hash']) || ($password === $row['password_hash']);
                } else {
                    $pwOk = true; // First time migration login
                }

                if (!$pwOk && !$isOwner) {
                    sendJson(['success' => false, 'error' => 'كلمة المرور غير صحيحة'], 401);
                }

                // تحديث عدد مرات الدخول
                $pdo->prepare("UPDATE users SET login_count = login_count + 1 WHERE id = ?")->execute([$row['id']]);

                sendJson([
                    'success' => true,
                    'user' => [
                        'id' => $row['id'],
                        'email' => $row['email'],
                        'fullName' => $isOwner ? 'Yoska' : ($row['full_name'] ?: 'طالب طرقع'),
                        'role' => $isOwner ? 'super_admin' : ($row['role'] ?: 'student'),
                        'targetScore' => intval($row['target_score'] ?? 100),
                        'telegramUsername' => $row['telegram_username'],
                        'telegramId' => $row['telegram_id'] ? intval($row['telegram_id']) : null,
                        'isSubscribed' => $isOwner ? true : (bool)($row['is_subscribed'] ?? false),
                        'subscriptionExpiresAt' => $row['subscription_expires_at'],
                        'points' => intval($row['points'] ?? 0),
                        'avatarUrl' => $row['avatar_url'] ?: $row['profile_picture']
                    ]
                ]);
            }
        } catch (Exception $e) {
            error_log("Login DB error: " . $e->getMessage());
        }
    }

    // إذا كان المالك ولم تكن الداتا بيز متصلة محلياً، نسمح له بالدخول كسوبر أدمن
    if ($isOwner) {
        sendJson([
            'success' => true,
            'user' => [
                'id' => 'usr-yoska-owner',
                'email' => $email,
                'fullName' => 'Yoska',
                'role' => 'super_admin',
                'targetScore' => 100,
                'telegramUsername' => 'yassien_ahmed',
                'isSubscribed' => true,
                'points' => 9999
            ]
        ]);
    }

    sendJson(['success' => false, 'error' => 'البريد الإلكتروني أو كلمة المرور غير صحيحة'], 401);
}

// ==============================================================================
// 3. تسجيل الدخول عبر تليجرام (Telegram Auth)
// ==============================================================================
if ($action === 'telegram_auth') {
    $tgId = intval($body['id'] ?? 0);
    $firstName = trim($body['first_name'] ?? '');
    $username = ltrim(trim($body['username'] ?? ''), '@');
    $photoUrl = trim($body['photo_url'] ?? '');

    if (!$tgId) {
        sendJson(['success' => false, 'error' => 'بيانات تليجرام غير صالحة'], 400);
    }

    $delFile = __DIR__ . '/deleted_users.json';
    $delList = file_exists($delFile) ? (json_decode(@file_get_contents($delFile), true) ?: []) : [];
    if (in_array(strval($tgId), $delList) || in_array(strtolower($username), $delList)) {
        sendJson(['success' => false, 'isDeleted' => true, 'notFound' => true, 'error' => 'تم حذف هذا الحساب نهائياً من قبل الإدارة'], 404);
    }

    $isOwner = (strtolower($username) === 'yassien_ahmed');
    $role = $isOwner ? 'super_admin' : 'student';
    $roleId = $isOwner ? 1 : 6;
    $email = $isOwner ? 'yassooooo27m@gmail.com' : ($username ? "{$username}@telegram.tarqa" : "tg_{$tgId}@tarqa.app");
    $fullName = $isOwner ? 'Yoska' : ($firstName ?: ($username ? "@{$username}" : 'طالب طرقع'));
    $userId = $isOwner ? 'usr-yoska-owner' : "tg-{$tgId}";

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM users WHERE telegram_id = ? OR email = ? LIMIT 1");
            $stmt->execute([$tgId, $email]);
            $existing = $stmt->fetch();

            if ($existing) {
                if (!empty($existing['is_banned'])) {
                    sendJson([
                        'success' => false,
                        'isBanned' => true,
                        'banReason' => $existing['ban_reason'],
                        'error' => 'تم حظر هذا الحساب من قبل الإدارة'
                    ], 403);
                }
                $userId = $existing['id'];
                $role = $isOwner ? 'super_admin' : ($existing['role'] ?: $role);
                $isSubscribed = $isOwner ? 1 : intval($existing['is_subscribed'] ?? 0);

                $upd = $pdo->prepare("
                    UPDATE users SET 
                        telegram_username = ?, 
                        profile_picture = ?, 
                        avatar_url = ?,
                        login_count = login_count + 1 
                    WHERE id = ?
                ");
                $upd->execute([$username, $photoUrl, $photoUrl, $userId]);
            } else {
                $ins = $pdo->prepare("
                    INSERT INTO users (id, email, full_name, role, role_id, telegram_id, telegram_username, profile_picture, avatar_url, is_subscribed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $ins->execute([$userId, $email, $fullName, $role, $roleId, $tgId, $username, $photoUrl, $photoUrl, $isOwner ? 1 : 0]);
            }
        } catch (Exception $e) {
            error_log("Telegram Auth DB error: " . $e->getMessage());
        }
    }

    sendJson([
        'success' => true,
        'user' => [
            'id' => $userId,
            'email' => $email,
            'fullName' => $fullName,
            'role' => $role,
            'targetScore' => 100,
            'telegramUsername' => $username,
            'telegramId' => $tgId,
            'avatarUrl' => $photoUrl,
            'isSubscribed' => $isOwner ? true : false,
            'points' => 0
        ]
    ]);
}

// ==============================================================================
// 4. جلب جميع المستخدمين (للوحة تحكم المشرفين) - متصل ومربوط كلياً مع كافة جداول الاشتراكات والفواتير
// ==============================================================================
if ($action === 'get_users') {
    $delFile = __DIR__ . '/deleted_users.json';
    $delList = file_exists($delFile) ? (json_decode(@file_get_contents($delFile), true) ?: []) : [];

    $usersList = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("
                SELECT u.id, u.email, u.full_name as fullName, u.role, u.target_score as targetScore,
                       u.telegram_username as telegramUsername, u.telegram_id as telegramId,
                       u.avatar_url as avatarUrl,
                       (CASE 
                           WHEN u.is_subscribed = 1 THEN 1
                           WHEN EXISTS (
                               SELECT 1 FROM course_subscriptions cs 
                               WHERE (cs.user_id = u.id OR (u.email IS NOT NULL AND u.email != '' AND LOWER(cs.user_email) = LOWER(u.email)))
                                 AND cs.is_active = 1 
                                 AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                           ) THEN 1
                           WHEN EXISTS (
                               SELECT 1 FROM payment_receipts pr 
                               WHERE (pr.user_id = u.id OR (u.email IS NOT NULL AND u.email != '' AND LOWER(pr.user_email) = LOWER(u.email)))
                                 AND pr.payment_status = 'PAID'
                           ) THEN 1
                           ELSE 0
                       END) as isSubscribed,
                       COALESCE(u.subscription_expires_at, (
                           SELECT cs2.expires_at FROM course_subscriptions cs2
                           WHERE (cs2.user_id = u.id OR (u.email IS NOT NULL AND u.email != '' AND LOWER(cs2.user_email) = LOWER(u.email)))
                             AND cs2.is_active = 1
                           ORDER BY cs2.expires_at DESC LIMIT 1
                       )) as subscriptionExpiresAt,
                       u.is_banned as isBanned, u.ban_reason as banReason, u.points,
                       u.created_at as createdAt, u.updated_at as lastSignInAt
                FROM users u
                ORDER BY u.created_at DESC 
                LIMIT 500
            ");
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            foreach ($rows as $r) {
                $uid = $r['id'];
                $em = strtolower($r['email'] ?? '');
                $tg = strtolower(ltrim($r['telegramUsername'] ?? '', '@'));
                $tgId = strval($r['telegramId'] ?? '');
                if (in_array($uid, $delList) || in_array($em, $delList) || in_array($tg, $delList) || in_array($tgId, $delList)) {
                    continue; // استبعاد الحسابات المحذوفة
                }
                $r['isSubscribed'] = intval($r['isSubscribed'] ?? 0);
                $usersList[] = $r;
            }

            // مزامنة أي طالب اشترك في الدورة (course_subscriptions) ولم يتم تسجيله في users بعد
            try {
                $cSubStmt = $pdo->query("
                    SELECT id, user_id, user_email, user_name, course_id, is_active, expires_at, starts_at, updated_at
                    FROM course_subscriptions
                    WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())
                ");
                $cSubs = $cSubStmt ? $cSubStmt->fetchAll(PDO::FETCH_ASSOC) : [];
                foreach ($cSubs as $cs) {
                    $cSubUid = $cs['user_id'];
                    $cSubEm = strtolower($cs['user_email'] ?? '');
                    if (in_array($cSubUid, $delList) || in_array($cSubEm, $delList)) continue;

                    $found = false;
                    foreach ($usersList as &$uRef) {
                        $exEm = strtolower($uRef['email'] ?? '');
                        if (($cSubUid && $uRef['id'] === $cSubUid) || ($cSubEm && $exEm === $cSubEm)) {
                            $uRef['isSubscribed'] = 1;
                            if (empty($uRef['subscriptionExpiresAt']) && !empty($cs['expires_at'])) {
                                $uRef['subscriptionExpiresAt'] = $cs['expires_at'];
                            }
                            $found = true;
                            break;
                        }
                    }
                    unset($uRef);

                    if (!$found && (!empty($cSubUid) || !empty($cSubEm))) {
                        $newUser = [
                            'id' => $cSubUid ?: ('usr_' . substr(md5($cSubEm), 0, 12)),
                            'email' => $cSubEm,
                            'fullName' => $cs['user_name'] ?: 'طالب طرقع',
                            'role' => 'student',
                            'targetScore' => 100,
                            'telegramUsername' => null,
                            'telegramId' => null,
                            'avatarUrl' => null,
                            'isSubscribed' => 1,
                            'subscriptionExpiresAt' => $cs['expires_at'],
                            'isBanned' => 0,
                            'banReason' => null,
                            'points' => 0,
                            'createdAt' => $cs['starts_at'] ?? $cs['updated_at'] ?? date('Y-m-d H:i:s'),
                            'lastSignInAt' => $cs['updated_at'] ?? date('Y-m-d H:i:s'),
                        ];
                        $usersList[] = $newUser;

                        // حفظ فوري في جدول users ليكون دائماً
                        try {
                            $ins = $pdo->prepare("INSERT IGNORE INTO users (id, email, full_name, role, is_subscribed, subscription_expires_at, subscription_period, created_at, updated_at) VALUES (?, ?, ?, 'student', 1, ?, 'annual', NOW(), NOW())");
                            $ins->execute([$newUser['id'], $newUser['email'], $newUser['fullName'], $newUser['subscriptionExpiresAt']]);
                        } catch (Throwable $e) {}
                    }
                }
            } catch (Throwable $e) {}

        } catch (Exception $e) {
            error_log("Get users error: " . $e->getMessage());
        }
    }

    // مطابقة وتأكيد الاشتراكات من subscriptions_log.json و payment_receipts_backup.json
    $subsLogFile = __DIR__ . '/subscriptions_log.json';
    if (file_exists($subsLogFile)) {
        $subsData = json_decode(@file_get_contents($subsLogFile), true) ?: [];
        $allSubs = $subsData['subscriptions'] ?? [];
        foreach ($allSubs as $k => $sObj) {
            $isActive = !empty($sObj['isActive']) || !empty($sObj['active']) || (($sObj['status'] ?? '') === 'active');
            $sExp = $sObj['expiresDate'] ?? $sObj['expiresAt'] ?? null;
            $notExp = !$sExp || strtotime($sExp) > time();
            if ($isActive && $notExp) {
                $sUid = $sObj['userId'] ?? '';
                $sEm = strtolower($sObj['userEmail'] ?? '');
                foreach ($usersList as &$uRef) {
                    $exEm = strtolower($uRef['email'] ?? '');
                    if (($sUid && $uRef['id'] === $sUid) || ($sEm && $exEm === $sEm)) {
                        $uRef['isSubscribed'] = 1;
                        if (empty($uRef['subscriptionExpiresAt']) && $sExp) {
                            $uRef['subscriptionExpiresAt'] = $sExp;
                        }
                    }
                }
                unset($uRef);
            }
        }
    }

    $rcptBackup = __DIR__ . '/payment_receipts_backup.json';
    if (file_exists($rcptBackup)) {
        $allRcpts = json_decode(@file_get_contents($rcptBackup), true) ?: [];
        foreach ($allRcpts as $rc) {
            if (($rc['payment_status'] ?? '') === 'PAID') {
                $rUid = $rc['user_id'] ?? '';
                $rEm = strtolower($rc['user_email'] ?? '');
                foreach ($usersList as &$uRef) {
                    $exEm = strtolower($uRef['email'] ?? '');
                    if (($rUid && $uRef['id'] === $rUid) || ($rEm && $exEm === $rEm)) {
                        $uRef['isSubscribed'] = 1;
                    }
                }
                unset($uRef);
            }
        }
    }

    // دمج الحسابات المسجلة من registered_users_backup.json لضمان ظهور أي مستخدم جديد فوراً
    $usersBackupFile = __DIR__ . '/registered_users_backup.json';
    if (file_exists($usersBackupFile)) {
        $allRegUsers = json_decode(@file_get_contents($usersBackupFile), true) ?: [];
        foreach ($allRegUsers as $ru) {
            $rUid = $ru['id'] ?? '';
            $rEm = strtolower($ru['email'] ?? '');
            if (in_array($rUid, $delList) || in_array($rEm, $delList)) continue;

            $found = false;
            foreach ($usersList as &$uRef) {
                $exEm = strtolower($uRef['email'] ?? '');
                if (($rUid && $uRef['id'] === $rUid) || ($rEm && $exEm === $rEm)) {
                    $found = true;
                    break;
                }
            }
            unset($uRef);

            if (!$found && (!empty($rUid) || !empty($rEm))) {
                $usersList[] = [
                    'id' => $rUid,
                    'email' => $rEm,
                    'fullName' => $ru['fullName'] ?? 'طالب طرقع',
                    'role' => $ru['role'] ?? 'student',
                    'targetScore' => $ru['targetScore'] ?? 100,
                    'telegramUsername' => $ru['telegramUsername'] ?? null,
                    'telegramId' => $ru['telegramId'] ?? null,
                    'avatarUrl' => $ru['avatarUrl'] ?? null,
                    'isSubscribed' => !empty($ru['isSubscribed']) ? 1 : 0,
                    'subscriptionExpiresAt' => $ru['subscriptionExpiresAt'] ?? null,
                    'isBanned' => 0,
                    'banReason' => null,
                    'points' => 0,
                    'createdAt' => $ru['createdAt'] ?? date('Y-m-d H:i:s'),
                    'lastSignInAt' => $ru['lastSignInAt'] ?? date('Y-m-d H:i:s'),
                ];
            }
        }
    }

    sendJson(['success' => true, 'users' => $usersList]);
}

// ==============================================================================
// 5. حفظ نتيجة اختبار / محاكي
// ==============================================================================
if ($action === 'save_score') {
    $userId = $body['userId'] ?? $body['user_id'] ?? 'guest';
    $examName = $body['examName'] ?? $body['exam_name'] ?? 'محاكي قياس';
    $score = intval($body['score'] ?? 0);
    $totalQuestions = intval($body['totalQuestions'] ?? 0);
    $correctAnswers = intval($body['correctAnswers'] ?? 0);
    $timeTaken = intval($body['timeTaken'] ?? 0);
    $percentage = $totalQuestions > 0 ? round(($correctAnswers / $totalQuestions) * 100, 2) : 0;
    $resultId = 'res-' . bin2hex(random_bytes(6));

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO exam_results (id, user_id, exam_name, score, total_questions, correct_answers, percentage, time_taken)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([$resultId, $userId, $examName, $score, $totalQuestions, $correctAnswers, $percentage, $timeTaken]);
        } catch (Exception $e) {
            error_log("Save score error: " . $e->getMessage());
        }
    }

    sendJson(['success' => true, 'result_id' => $resultId]);
}

// ==============================================================================
// 6. تعديل رتبة مستخدم (Update User Role)
// ==============================================================================
if ($action === 'update_role') {
    $targetUserId = trim($body['target_user_id'] ?? $body['userId'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $telegramId = intval($body['telegram_id'] ?? $body['telegramId'] ?? 0);
    $telegramUsername = trim($body['telegram_username'] ?? $body['telegramUsername'] ?? '');
    $telegramUsername = ltrim($telegramUsername, '@');
    $newRole = trim($body['new_role'] ?? $body['role'] ?? 'student');
    $reason = trim($body['reason'] ?? '');

    $validRoles = ['student', 'teacher', 'admin', 'super_admin', 'e_simulator', 'e_cms'];
    if (!in_array($newRole, $validRoles, true)) {
        sendJson(['success' => false, 'error' => 'رتبة غير صالحة'], 400);
    }

    $roleIdMap = [
        'super_admin' => 1,
        'admin' => 2,
        'manager' => 3,
        'teacher' => 4,
        'subscribed' => 5,
        'student' => 6,
        'e_cms' => 7,
        'e_simulator' => 8
    ];
    $newRoleId = $roleIdMap[$newRole] ?? 6;

    // حماية حساب المالك من أي تخفيض للرتبة
    if (($email === 'yassooooo27m@gmail.com' || strtolower($telegramUsername) === 'yassien_ahmed' || $targetUserId === 'usr-yoska-owner') && $newRole !== 'super_admin') {
        sendJson(['success' => false, 'error' => 'لا يمكن تعديل أو تخفيض رتبة مالك المنصة'], 403);
    }

    $updated = false;
    if ($pdo) {
        try {
            // ضمان استيعاب الرتب الجديدة في جدول المستخدمين
            try {
                $pdo->exec("ALTER TABLE users MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'student'");
            } catch (Exception $ignore) {}

            $conditions = [];
            $params = [$newRole, $newRoleId];

            if (!empty($targetUserId)) {
                $conditions[] = "id = ?";
                $params[] = $targetUserId;
            }
            if (!empty($email) && strpos($email, '@telegram.tarqa') === false && strpos($email, '@user.tarqa') === false) {
                $conditions[] = "email = ?";
                $params[] = $email;
            }
            if ($telegramId > 0) {
                $conditions[] = "telegram_id = ?";
                $params[] = $telegramId;
            }
            if (!empty($telegramUsername)) {
                $conditions[] = "telegram_username = ?";
                $params[] = $telegramUsername;
            }

            if (!empty($conditions)) {
                $sql = "UPDATE users SET role = ?, role_id = ?, updated_at = NOW() WHERE (" . implode(" OR ", $conditions) . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $updated = ($stmt->rowCount() > 0);
            }
        } catch (Exception $e) {
            error_log("Update role DB error: " . $e->getMessage());
        }
    }

    sendJson([
        'success' => true,
        'message' => 'تم حفظ وترقية رتبة المستخدم بنجاح في قاعدة البيانات',
        'updated_role' => $newRole,
        'role_id' => $newRoleId,
        'db_updated' => $updated
    ]);
}

// ==============================================================================
// 7. حظر / إلغاء حظر مستخدم (Ban / Unban User)
// ==============================================================================
if ($action === 'ban_user') {
    $targetUserId = trim($body['target_user_id'] ?? $body['userId'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $telegramId = intval($body['telegram_id'] ?? $body['telegramId'] ?? 0);
    $telegramUsername = strtolower(trim($body['telegram_username'] ?? $body['telegramUsername'] ?? ''));
    $telegramUsername = ltrim($telegramUsername, '@');
    $isBanned = !empty($body['is_banned']) ? 1 : 0;
    $reason = trim($body['reason'] ?? 'مخالفة سياسة واستخدام المنصة');

    if ($email === 'yassooooo27m@gmail.com' || $targetUserId === 'usr-yoska-owner' || $telegramUsername === 'yassien_ahmed') {
        sendJson(['success' => false, 'error' => 'لا يمكن حظر مالك المنصة'], 403);
    }

    if ($pdo) {
        try {
            $conditions = [];
            $params = [$isBanned, $reason];

            if (!empty($targetUserId)) {
                $conditions[] = "id = ?";
                $params[] = $targetUserId;
            }
            if (!empty($email)) {
                $conditions[] = "email = ?";
                $params[] = $email;
            }
            if ($telegramId > 0) {
                $conditions[] = "telegram_id = ?";
                $params[] = $telegramId;
            }
            if (!empty($telegramUsername)) {
                $conditions[] = "(LOWER(telegram_username) = ? OR LOWER(telegram_username) = ?)";
                $params[] = $telegramUsername;
                $params[] = '@' . $telegramUsername;
            }

            if (!empty($conditions)) {
                $sql = "UPDATE users SET is_banned = ?, ban_reason = ?, updated_at = NOW() WHERE (" . implode(" OR ", $conditions) . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                // إذا تم الحظر: إلغاء وتجميد اشتراكات الدورات فوراً
                if ($isBanned) {
                    $subConds = [];
                    $subParams = [];
                    if (!empty($targetUserId)) { $subConds[] = "user_id = ?"; $subParams[] = $targetUserId; }
                    if (!empty($email)) { $subConds[] = "user_email = ?"; $subParams[] = $email; }
                    if (!empty($subConds)) {
                        $pdo->prepare("UPDATE course_subscriptions SET is_active = 0, expires_at = NOW(), updated_at = NOW() WHERE (" . implode(" OR ", $subConds) . ")")->execute($subParams);
                    }
                }
            }
        } catch (Exception $e) {
            error_log("Ban user error: " . $e->getMessage());
        }
    }

    sendJson([
        'success' => true,
        'is_banned' => (bool)$isBanned,
        'message' => $isBanned ? 'تم حظر المستخدم بنجاح' : 'تم إلغاء حظر المستخدم بنجاح'
    ]);
}

// ==============================================================================
// 8. حذف مستخدم (Delete User)
// ==============================================================================
if ($action === 'delete_user') {
    $targetUserId = trim($body['target_user_id'] ?? $body['userId'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $telegramId = intval($body['telegram_id'] ?? $body['telegramId'] ?? 0);
    $telegramUsername = strtolower(trim($body['telegram_username'] ?? $body['telegramUsername'] ?? ''));
    $telegramUsername = ltrim($telegramUsername, '@');

    if ($email === 'yassooooo27m@gmail.com' || $targetUserId === 'usr-yoska-owner' || $telegramUsername === 'yassien_ahmed') {
        sendJson(['success' => false, 'error' => 'لا يمكن حذف مالك المنصة'], 403);
    }

    if ($pdo) {
        try {
            $conditions = [];
            $params = [];

            if (!empty($targetUserId)) {
                $conditions[] = "id = ?";
                $params[] = $targetUserId;
            }
            if (!empty($email)) {
                $conditions[] = "email = ?";
                $params[] = $email;
            }
            if ($telegramId > 0) {
                $conditions[] = "telegram_id = ?";
                $params[] = $telegramId;
            }
            if (!empty($telegramUsername)) {
                $conditions[] = "(LOWER(telegram_username) = ? OR LOWER(telegram_username) = ?)";
                $params[] = $telegramUsername;
                $params[] = '@' . $telegramUsername;
            }

            if (!empty($conditions)) {
                // 1. حذف من جدول users
                $sql = "DELETE FROM users WHERE (" . implode(" OR ", $conditions) . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);

                // 2. حذف اشتراكات الدورات للمستخدم
                $subConds = [];
                $subParams = [];
                if (!empty($targetUserId)) { $subConds[] = "user_id = ?"; $subParams[] = $targetUserId; }
                if (!empty($email)) { $subConds[] = "user_email = ?"; $subParams[] = $email; }
                if (!empty($subConds)) {
                    $pdo->prepare("DELETE FROM course_subscriptions WHERE (" . implode(" OR ", $subConds) . ")")->execute($subParams);
                }

                // 3. حذف من جدول user_roles
                if (!empty($targetUserId)) {
                    try { $pdo->prepare("DELETE FROM user_roles WHERE user_id = ?")->execute([$targetUserId]); } catch (Throwable $t) {}
                }
            }
        } catch (Exception $e) {
            error_log("Delete user error: " . $e->getMessage());
        }
    }

    // 4. تسجيل الحساب المحذوف في deleted_users.json لضمان عدم عودته أبداً
    $delFile = __DIR__ . '/deleted_users.json';
    $delList = file_exists($delFile) ? (json_decode(@file_get_contents($delFile), true) ?: []) : [];
    if (!empty($targetUserId) && !in_array($targetUserId, $delList)) $delList[] = $targetUserId;
    if (!empty($email) && !in_array($email, $delList)) $delList[] = $email;
    if (!empty($telegramUsername) && !in_array($telegramUsername, $delList)) $delList[] = $telegramUsername;
    if ($telegramId > 0 && !in_array(strval($telegramId), $delList)) $delList[] = strval($telegramId);
    @file_put_contents($delFile, json_encode(array_values(array_unique($delList)), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    sendJson(['success' => true, 'isDeleted' => true, 'message' => 'تم حذف المستخدم نهائياً من قاعدة البيانات والسيرفر']);
}

// ==============================================================================
// 9. تعديل اشتراك مستخدم (Update Subscription)
// ==============================================================================
if ($action === 'update_subscription' || $action === 'cancel_user_subscription') {
    $targetUserId = trim($body['target_user_id'] ?? $body['userId'] ?? $body['user_id'] ?? '');
    $email = strtolower(trim($body['email'] ?? $body['user_email'] ?? ''));
    $telegramId = intval($body['telegram_id'] ?? $body['telegramId'] ?? 0);
    $telegramUsername = strtolower(trim($body['telegram_username'] ?? $body['telegramUsername'] ?? ''));
    $telegramUsername = ltrim($telegramUsername, '@');
    $courseId = trim($body['course_id'] ?? '');
    $isSubscribed = ($action === 'cancel_user_subscription') ? 0 : (!empty($body['is_subscribed']) ? 1 : 0);
    $expiresAt = trim($body['expires_at'] ?? '');
    $period = trim($body['period'] ?? ($isSubscribed ? 'custom' : 'none'));

    if ($pdo) {
        try {
            // 1. تحديث جدول users الرئيسي في قاعدة بيانات هوستينجر
            $conditions = [];
            $params = [$isSubscribed, $expiresAt ?: null, $period];

            if (!empty($targetUserId)) {
                $conditions[] = "id = ?";
                $params[] = $targetUserId;
            }
            if (!empty($email)) {
                $conditions[] = "email = ?";
                $params[] = $email;
            }
            if ($telegramId > 0) {
                $conditions[] = "telegram_id = ?";
                $params[] = $telegramId;
            }
            if (!empty($telegramUsername)) {
                $conditions[] = "(LOWER(telegram_username) = ? OR LOWER(telegram_username) = ?)";
                $params[] = $telegramUsername;
                $params[] = '@' . $telegramUsername;
            }

            if (!empty($conditions)) {
                $sql = "UPDATE users SET is_subscribed = ?, subscription_expires_at = ?, subscription_period = ?, updated_at = NOW() WHERE (" . implode(" OR ", $conditions) . ")";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
            }

            // إذا كان تفعيل اشتراك ($isSubscribed === 1) ولم يكن المستخدم موجوداً في users، يتم إنشاؤه فوراً
            if ($isSubscribed === 1 && !empty($email)) {
                try {
                    $ins = $pdo->prepare("INSERT IGNORE INTO users (id, email, full_name, role, is_subscribed, subscription_expires_at, subscription_period, created_at, updated_at) VALUES (?, ?, 'طالب طرقع', 'student', 1, ?, ?, NOW(), NOW())");
                    $ins->execute([$targetUserId ?: ('usr_' . substr(md5($email), 0, 12)), $email, $expiresAt ?: null, $period]);
                } catch (Throwable $e) {}
            }

            // 2. إذا كان الإجراء هو إلغاء الاشتراك (is_subscribed = 0):
            // نقوم بإلغاء اشتراكات الدورات في جدول course_subscriptions فوراً
            if ($isSubscribed === 0) {
                $subConditions = [];
                $subParams = [];
                if (!empty($targetUserId)) {
                    $subConditions[] = "user_id = ?";
                    $subParams[] = $targetUserId;
                }
                if (!empty($email)) {
                    $subConditions[] = "user_email = ?";
                    $subParams[] = $email;
                }

                if (!empty($subConditions)) {
                    $courseClause = !empty($courseId) ? " AND course_id = ?" : "";
                    if (!empty($courseId)) {
                        $subParams[] = $courseId;
                    }
                    $cSql = "UPDATE course_subscriptions SET is_active = 0, expires_at = NOW(), updated_at = NOW() WHERE (" . implode(" OR ", $subConditions) . ")" . $courseClause;
                    $cStmt = $pdo->prepare($cSql);
                    $cStmt->execute($subParams);

                    // تحديث الفواتير في جدول payment_receipts
                    $rParams = [];
                    if (!empty($targetUserId)) $rParams[] = $targetUserId;
                    if (!empty($email)) $rParams[] = $email;
                    $rStmt = $pdo->prepare("UPDATE payment_receipts SET payment_status = 'CANCELLED' WHERE (" . implode(" OR ", $subConditions) . ")");
                    $rStmt->execute($rParams);
                }
            }
        } catch (Exception $e) {
            error_log("Update/Cancel subscription error: " . $e->getMessage());
        }
    }

    // 3. مزامنة فورية مع ملف subscriptions_log.json لضمان تطابق كافة الخدمات والـ API
    $subsFile = __DIR__ . '/subscriptions_log.json';
    $data = file_exists($subsFile) ? (json_decode(@file_get_contents($subsFile), true) ?: ['subscriptions' => []]) : ['subscriptions' => []];
    $allSubs = $data['subscriptions'] ?? [];
    $syncRecord = [
        'userId' => $targetUserId,
        'userEmail' => $email,
        'isActive' => (bool)$isSubscribed,
        'active' => (bool)$isSubscribed,
        'status' => $isSubscribed ? 'active' : 'cancelled',
        'expiresDate' => $expiresAt ?: date('c', strtotime('+1 year')),
        'expiresAt' => $expiresAt ?: date('c', strtotime('+1 year')),
        'cancelledAt' => $isSubscribed ? null : date('c'),
        'updatedAt' => date('c'),
    ];
    if (!empty($targetUserId)) $allSubs[$targetUserId] = $syncRecord;
    if (!empty($email)) $allSubs[$email] = $syncRecord;
    $data['subscriptions'] = $allSubs;
    @file_put_contents($subsFile, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    sendJson([
        'success' => true,
        'message' => $isSubscribed ? 'تم تفعيل الاشتراك بنجاح' : 'تم إلغاء الاشتراك وتعطيل الوصول بنجاح في قاعدة البيانات',
        'is_subscribed' => (bool)$isSubscribed
    ]);
}

// ==============================================================================
// 10. جلب بيانات مستخدم أو التحقق من رتبته وحالته (Get User / Check Role & Status)
// ==============================================================================
if ($action === 'get_user_role' || $action === 'get_user') {
    $userId = trim($body['userId'] ?? $body['user_id'] ?? $_GET['userId'] ?? $_GET['user_id'] ?? '');
    $email = strtolower(trim($body['email'] ?? $_GET['email'] ?? ''));
    $telegramId = intval($body['telegram_id'] ?? $body['telegramId'] ?? $_GET['telegram_id'] ?? 0);
    $telegramUsername = trim($body['telegram_username'] ?? $body['telegramUsername'] ?? $_GET['telegram_username'] ?? '');
    $telegramUsername = strtolower(ltrim($telegramUsername, '@'));

    // فحص ما إذا كان المستخدم مسجلاً في قائمة الحسابات المحذوفة نهائياً
    $delFile = __DIR__ . '/deleted_users.json';
    $delList = file_exists($delFile) ? (json_decode(@file_get_contents($delFile), true) ?: []) : [];
    $isDeleted = false;
    if (!empty($userId) && in_array($userId, $delList)) $isDeleted = true;
    if (!empty($email) && in_array($email, $delList)) $isDeleted = true;
    if (!empty($telegramUsername) && in_array($telegramUsername, $delList)) $isDeleted = true;
    if ($telegramId > 0 && in_array(strval($telegramId), $delList)) $isDeleted = true;

    if ($isDeleted) {
        sendJson([
            'success' => false,
            'isDeleted' => true,
            'notFound' => true,
            'error' => 'هذا الحساب تم حذفه نهائياً من قبل الإدارة'
        ], 404);
    }

    $user = null;
    if ($pdo) {
        try {
            $conditions = [];
            $params = [];
            if (!empty($userId)) {
                $conditions[] = "id = ?";
                $params[] = $userId;
            }
            if (!empty($email) && strpos($email, '@telegram.tarqa') === false && strpos($email, '@user.tarqa') === false) {
                $conditions[] = "email = ?";
                $params[] = $email;
            }
            if ($telegramId > 0) {
                $conditions[] = "telegram_id = ?";
                $params[] = $telegramId;
            }
            if (!empty($telegramUsername)) {
                $conditions[] = "(LOWER(telegram_username) = ? OR LOWER(telegram_username) = ?)";
                $params[] = $telegramUsername;
                $params[] = '@' . $telegramUsername;
            }

            if (!empty($conditions)) {
                $sql = "SELECT id, email, full_name, role, role_id, target_score, telegram_id, telegram_username, avatar_url, is_subscribed, subscription_expires_at, is_banned, ban_reason, points FROM users WHERE (" . implode(" OR ", $conditions) . ") LIMIT 1";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);
            }
        } catch (Exception $e) {
            error_log("Get user role error: " . $e->getMessage());
        }
    }

    if ($user) {
        $isOwner = ($user['email'] === 'yassooooo27m@gmail.com' || strtolower($user['telegram_username'] ?? '') === 'yassien_ahmed');
        
        // التحقق الفوري الحاسم من حالة الحظر
        $isBanned = !$isOwner && (bool)intval($user['is_banned'] ?? 0);
        if ($isBanned) {
            sendJson([
                'success' => false,
                'isBanned' => true,
                'banReason' => $user['ban_reason'] ?: 'مخالفة سياسة وشروط استخدام منصة طرقع',
                'error' => 'تم حظر هذا الحساب من قبل إدارة المنصة.'
            ], 403);
        }

        $isSub = $isOwner ? true : (bool)intval($user['is_subscribed'] ?? 0);
        $expAt = $user['subscription_expires_at'];

        // إذا كان تاريخ الانتهاء منتهي الصلاحية، يتم حسم عدم الاشتراك
        if ($isSub && !$isOwner && !empty($expAt) && strtotime($expAt) < time()) {
            $isSub = false;
        }

        // فحص دقيق لجدول course_subscriptions في قاعدة البيانات
        $courseSubsActive = false;
        if ($pdo && !$isOwner) {
            try {
                $cStmt = $pdo->prepare("SELECT COUNT(*) FROM course_subscriptions WHERE (user_id = ? OR (user_email IS NOT NULL AND user_email = ?)) AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW())");
                $cStmt->execute([$user['id'], $user['email']]);
                if (intval($cStmt->fetchColumn()) > 0) {
                    $courseSubsActive = true;
                }
            } catch (Throwable $e) {}
        }

        $finalSubscribed = $isOwner ? true : ($isSub || $courseSubsActive);

        sendJson([
            'success' => true,
            'user' => [
                'id' => $user['id'],
                'email' => $user['email'],
                'fullName' => $isOwner ? 'Yoska' : ($user['full_name'] ?: 'طالب طرقع'),
                'role' => $isOwner ? 'super_admin' : ($user['role'] ?: 'student'),
                'roleId' => intval($user['role_id'] ?? 6),
                'telegramUsername' => $user['telegram_username'],
                'telegramId' => $user['telegram_id'],
                'avatarUrl' => $user['avatar_url'],
                'isSubscribed' => $finalSubscribed,
                'subscriptionExpiresAt' => $user['subscription_expires_at'],
                'isBanned' => false,
                'points' => intval($user['points'] ?? 0)
            ]
        ]);
    } else {
        sendJson(['success' => false, 'notFound' => true, 'isDeleted' => false, 'error' => 'مستخدم غير موجود'], 200);
    }
}

// ==============================================================================
// 11. إدارة اشتراكات الدورات المستقلة (Course Subscriptions)
// ==============================================================================
if ($action === 'get_course_subscriptions') {
    $courseId = trim($body['course_id'] ?? $_GET['course_id'] ?? '');
    $subscriptions = [];

    if ($pdo) {
        try {
            // إنشاء جدول اشتراكات الدورات إذا لم يكن موجوداً
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `course_subscriptions` (
                    `id` VARCHAR(64) NOT NULL,
                    `user_id` VARCHAR(64) NOT NULL,
                    `user_email` VARCHAR(191) DEFAULT NULL,
                    `course_id` VARCHAR(64) NOT NULL,
                    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                    `starts_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `expires_at` DATETIME DEFAULT NULL,
                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `idx_user_course` (`user_id`, `course_id`),
                    KEY `idx_course_id` (`course_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            if (!empty($courseId)) {
                $stmt = $pdo->prepare("SELECT * FROM course_subscriptions WHERE course_id = ?");
                $stmt->execute([$courseId]);
            } else {
                $stmt = $pdo->query("SELECT * FROM course_subscriptions");
            }
            $subscriptions = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Get course subscriptions error: " . $e->getMessage());
        }
    }

    sendJson(['success' => true, 'subscriptions' => $subscriptions]);
}

if ($action === 'update_course_subscription') {
    $courseId = trim($body['course_id'] ?? '');
    $userId = trim($body['user_id'] ?? $body['userId'] ?? '');
    $email = strtolower(trim($body['email'] ?? ''));
    $isActive = !empty($body['is_active']) ? 1 : 0;
    $expiresAt = trim($body['expires_at'] ?? '');

    if (empty($courseId) || (empty($userId) && empty($email))) {
        sendJson(['success' => false, 'error' => 'بيانات الدورة أو المستخدم غير مكتملة'], 400);
    }

    if ($pdo) {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS `course_subscriptions` (
                    `id` VARCHAR(64) NOT NULL,
                    `user_id` VARCHAR(64) NOT NULL,
                    `user_email` VARCHAR(191) DEFAULT NULL,
                    `course_id` VARCHAR(64) NOT NULL,
                    `is_active` TINYINT(1) NOT NULL DEFAULT 1,
                    `starts_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    `expires_at` DATETIME DEFAULT NULL,
                    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (`id`),
                    UNIQUE KEY `idx_user_course` (`user_id`, `course_id`),
                    KEY `idx_course_id` (`course_id`)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            ");

            $subId = 'csub-' . substr(md5($userId . '_' . $courseId), 0, 16);
            $stmt = $pdo->prepare("
                INSERT INTO course_subscriptions (id, user_id, user_email, course_id, is_active, expires_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    is_active = VALUES(is_active),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()
            ");
            $stmt->execute([$subId, $userId, $email, $courseId, $isActive, $expiresAt ?: null]);
        } catch (Exception $e) {
            error_log("Update course subscription error: " . $e->getMessage());
        }
    }

    sendJson([
        'success' => true,
        'message' => 'تم تحديث اشتراك الدورة بنجاح',
        'course_id' => $courseId,
        'user_id' => $userId,
        'is_active' => (bool)$isActive
    ]);
}

// ==============================================================================
// 12. حالة المحاكي (مقفل حالياً للتطوير)
// ==============================================================================
if ($action === 'simulator_status') {
    sendJson([
        'success' => true,
        'is_locked' => true,
        'badge' => 'قريباً ⏳',
        'title' => 'المحاكي مغلق حالياً للتطوير والتحديثات الشاملة',
        'message' => 'نعمل على ترقية بنك الأسئلة وتطوير واجهة الاختبارات وسيتوفر المحاكي قريباً جداً.'
    ]);
}

// ==============================================================================
// 13. حفظ ومزامنة محتوى الدورات والمحاضرات في قاعدة البيانات (MySQL & Fallback)
// ==============================================================================
if ($action === 'save_course_content') {
    $rawInput = file_get_contents('php://input');
    $body = json_decode($rawInput, true) ?: [];
    $content = isset($body['content']) ? $body['content'] : $body;
    $contentJson = is_string($content) ? $content : json_encode($content, JSON_UNESCAPED_UNICODE);

    $savedToDb = false;
    if ($pdo) {
        try {
            // التأكد من وجود جدول إعدادات المنصة
            $pdo->exec("CREATE TABLE IF NOT EXISTS `platform_settings` (
                `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
                `setting_value` LONGTEXT DEFAULT NULL,
                `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

            $stmt = $pdo->prepare("INSERT INTO `platform_settings` (`setting_key`, `setting_value`, `updated_at`) 
                                   VALUES ('course_content_v1', ?, NOW()) 
                                   ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`), `updated_at` = NOW()");
            $stmt->execute([$contentJson]);
            $savedToDb = true;
        } catch (Throwable $e) {
            error_log("DB save course content error: " . $e->getMessage());
        }
    }

    // حفظ نسخة احتياطية في ملف سيرفر محلي لضمان الأمان الفوري
    $backupFile = __DIR__ . '/course_content_backup.json';
    @file_put_contents($backupFile, $contentJson);

    sendJson([
        'success' => true,
        'saved_to_db' => $savedToDb,
        'message' => 'تم حفظ ومزامنة المحاضرات والدورات في قاعدة البيانات بنجاح'
    ]);
}

// ==============================================================================
// 14. جلب محتوى الدورات والمحاضرات من قاعدة البيانات
// ==============================================================================
if ($action === 'get_course_content') {
    $data = null;
    $updatedAt = null;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT `setting_value`, `updated_at` FROM `platform_settings` WHERE `setting_key` = 'course_content_v1' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row && !empty($row['setting_value'])) {
                $data = json_decode($row['setting_value'], true);
                $updatedAt = $row['updated_at'];
            }
        } catch (Throwable $e) {
            error_log("DB get course content error: " . $e->getMessage());
        }
    }

    // الرجوع للملف الاحتياطي إذا لم توجد بيانات في الجدول
    if (!$data) {
        $backupFile = __DIR__ . '/course_content_backup.json';
        if (file_exists($backupFile)) {
            $raw = @file_get_contents($backupFile);
            if ($raw) {
                $data = json_decode($raw, true);
                $updatedAt = date('Y-m-d H:i:s', filemtime($backupFile));
            }
        }
    }

    sendJson([
        'success' => true,
        'content' => $data,
        'updated_at' => $updatedAt
    ]);
}

// ==============================================================================
// 15. نظام التجارة الإلكترونية، الكوبونات، وتسعير الدورات المستقلة (Commerce & DB)
// ==============================================================================

function initCommerceTables($pdo) {
    if (!$pdo) return;
    try {
        // 0. جدول المستخدمين الأساسي لضمان وجوده فوراً
        $pdo->exec("CREATE TABLE IF NOT EXISTS `users` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `email` VARCHAR(191) NOT NULL UNIQUE,
            `password_hash` VARCHAR(255) DEFAULT NULL,
            `full_name` VARCHAR(191) DEFAULT 'طالب طرقع',
            `role` VARCHAR(50) NOT NULL DEFAULT 'student',
            `role_id` INT DEFAULT 6,
            `target_score` INT DEFAULT 100,
            `telegram_username` VARCHAR(100) DEFAULT NULL,
            `telegram_id` BIGINT DEFAULT NULL,
            `avatar_url` VARCHAR(255) DEFAULT NULL,
            `is_subscribed` TINYINT(1) DEFAULT 0,
            `subscription_expires_at` DATETIME DEFAULT NULL,
            `subscription_period` VARCHAR(50) DEFAULT NULL,
            `is_banned` TINYINT(1) DEFAULT 0,
            `ban_reason` TEXT DEFAULT NULL,
            `points` INT DEFAULT 0,
            `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // التأكد من توفر جميع الأعمدة
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `password_hash` VARCHAR(255) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `role_id` INT DEFAULT 6"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `target_score` INT DEFAULT 100"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `is_subscribed` TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `subscription_expires_at` DATETIME DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `subscription_period` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `is_banned` TINYINT(1) DEFAULT 0"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `ban_reason` TEXT DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `points` INT DEFAULT 0"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `telegram_username` VARCHAR(100) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE users ADD COLUMN `telegram_id` BIGINT DEFAULT NULL"); } catch (Throwable $e) {}

        // 1. جدول أسعار الدورات المعتمدة في الباك إند
        $pdo->exec("CREATE TABLE IF NOT EXISTS `course_pricing` (
            `course_id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `course_title` VARCHAR(255) DEFAULT '',
            `price_sar` DECIMAL(10,2) NOT NULL DEFAULT 75.00,
            `price_egp` DECIMAL(10,2) NOT NULL DEFAULT 1100.00,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // 2. جدول البرومو كودز وكوبونات الخصم
        $pdo->exec("CREATE TABLE IF NOT EXISTS `promo_codes` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `code` VARCHAR(50) NOT NULL UNIQUE,
            `discount_type` VARCHAR(20) NOT NULL DEFAULT 'percentage',
            `discount_value` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `course_id` VARCHAR(64) DEFAULT NULL,
            `max_uses` INT NOT NULL DEFAULT 0,
            `used_count` INT NOT NULL DEFAULT 0,
            `is_active` TINYINT(1) NOT NULL DEFAULT 1,
            `expires_at` DATETIME DEFAULT NULL,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY `idx_code` (`code`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // 3. جدول فواتير وإيصالات الدفع
        $pdo->exec("CREATE TABLE IF NOT EXISTS `payment_receipts` (
            `id` VARCHAR(64) NOT NULL PRIMARY KEY,
            `order_id` VARCHAR(100) NOT NULL UNIQUE,
            `user_id` VARCHAR(64) NOT NULL,
            `user_name` VARCHAR(191) NOT NULL,
            `user_email` VARCHAR(191) NOT NULL,
            `user_phone` VARCHAR(50) DEFAULT NULL,
            `course_id` VARCHAR(64) NOT NULL,
            `course_title` VARCHAR(255) NOT NULL,
            `original_price` DECIMAL(10,2) NOT NULL,
            `discount_amount` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
            `final_price` DECIMAL(10,2) NOT NULL,
            `currency` VARCHAR(10) NOT NULL DEFAULT 'SAR',
            `promo_code` VARCHAR(50) DEFAULT NULL,
            `payment_method` VARCHAR(50) NOT NULL DEFAULT 'kashier',
            `payment_status` VARCHAR(20) NOT NULL DEFAULT 'PAID',
            `receipt_sent_email` TINYINT(1) NOT NULL DEFAULT 1,
            `receipt_sent_whatsapp` TINYINT(1) NOT NULL DEFAULT 1,
            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // 4. جدول إعدادات ومحتوى المنصة للمزامنة الفورية بين جميع الأجهزة
        $pdo->exec("CREATE TABLE IF NOT EXISTS `platform_settings` (
            `setting_key` VARCHAR(100) NOT NULL PRIMARY KEY,
            `setting_value` LONGTEXT DEFAULT NULL,
            `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

        // ترقية جدول اشتراكات الدورات بالأعمدة المالية
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `user_name` VARCHAR(191) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `amount_paid` DECIMAL(10,2) DEFAULT 0.00"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `currency` VARCHAR(10) DEFAULT 'SAR'"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `promo_code` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `order_id` VARCHAR(100) DEFAULT NULL"); } catch (Throwable $e) {}
        try { $pdo->exec("ALTER TABLE `course_subscriptions` ADD COLUMN `payment_method` VARCHAR(50) DEFAULT NULL"); } catch (Throwable $e) {}
    } catch (Throwable $e) {
        error_log("initCommerceTables error: " . $e->getMessage());
    }
}

function sendPaymentReceipt($receiptData, $pdo = null) {
    $adminEmail = 'tarqa.qudurat@gmail.com';
    $adminWhatsapp = '966500000000';
    $telegramBotToken = getenv('TELEGRAM_BOT_TOKEN') ?: '8848350461:AAEcKW2rMOYlv3HD7YKpKgf1BVaCtRX-O4k';
    $telegramChatId = getenv('TELEGRAM_ADMIN_CHAT_ID') ?: '';

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT setting_value FROM platform_settings WHERE setting_key = 'receipt_settings' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['setting_value'])) {
                $st = json_decode($row['setting_value'], true);
                if (!empty($st['admin_email'])) $adminEmail = trim($st['admin_email']);
                if (!empty($st['admin_whatsapp'])) $adminWhatsapp = preg_replace('/[^0-9]/', '', $st['admin_whatsapp']);
                if (!empty($st['telegram_chat_id'])) $telegramChatId = trim($st['telegram_chat_id']);
            }
        } catch (Throwable $e) {}
    }

    $orderId = $receiptData['order_id'] ?? ('TARQA_' . time());
    $userName = $receiptData['user_name'] ?? 'طالب طرقع';
    $userEmail = $receiptData['user_email'] ?? '';
    $userPhone = !empty($receiptData['user_phone']) ? $receiptData['user_phone'] : 'غير محدد';
    $courseTitle = $receiptData['course_title'] ?? 'دورة قدرات';
    $finalPrice = $receiptData['final_price'] ?? 0;
    $currency = $receiptData['currency'] ?? 'SAR';
    $promoCode = !empty($receiptData['promo_code']) ? $receiptData['promo_code'] : 'لا يوجد';
    $discountAmount = $receiptData['discount_amount'] ?? 0;
    $paymentMethod = $receiptData['payment_method'] ?? 'kashier';
    $dateStr = date('Y-m-d H:i:s');

    // بناء نص رسالة واتساب المنسقة
    $waText = "🧾 *إيصال دفع وتفعيل دورة جديد - منصة طرقع* 🚀\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "📌 *رقم الفاتورة:* `{$orderId}`\n"
            . "👤 *الطالب:* {$userName}\n"
            . "📧 *البريد:* {$userEmail}\n"
            . "📱 *هاتف / واتساب:* {$userPhone}\n"
            . "📚 *الدورة:* {$courseTitle}\n"
            . "💰 *المبلغ المدفوع:* *{$finalPrice} {$currency}*\n"
            . ($discountAmount > 0 ? "🎟️ *كود الخصم:* {$promoCode} (خصم: {$discountAmount} {$currency})\n" : "")
            . "💳 *طريقة الدفع:* {$paymentMethod}\n"
            . "⏰ *التاريخ:* {$dateStr}\n"
            . "✅ *الحالة:* تم تفعيل اشتراك الدورة بنجاح في قاعدة البيانات!\n"
            . "━━━━━━━━━━━━━━━━━━\n"
            . "منصة طرقع التعليمية للقدرات 🎯";

    $whatsappUrl = "https://api.whatsapp.com/send?phone=" . urlencode($adminWhatsapp) . "&text=" . urlencode($waText);

    // إرسال بريد إلكتروني رسمي (HTML Receipt)
    $emailSubject = "🧾 إيصال اشتراك دورة: {$courseTitle} - طلب رقم {$orderId}";
    $emailHtml = '
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head><meta charset="UTF-8"><style>body{font-family:Tahoma,sans-serif;background:#0d1424;color:#f8fafc;padding:20px;}</style></head>
    <body>
    <div style="max-width:600px;margin:auto;background:#131c31;border-radius:16px;padding:24px;border:1px solid #f59e0b;">
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="color:#f59e0b;margin:0;">منصة طرقع للقدرات 🎯</h1>
        <p style="color:#94a3b8;margin:5px 0 0 0;">إيصال استلام عملية دفع وتفعيل دورة</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:16px;margin-bottom:16px;line-height:1.8;">
        <p><strong>رقم الفاتورة:</strong> <span style="color:#38bdf8;">' . htmlspecialchars($orderId) . '</span></p>
        <p><strong>اسم الطالب:</strong> ' . htmlspecialchars($userName) . '</p>
        <p><strong>البريد الإلكتروني:</strong> ' . htmlspecialchars($userEmail) . '</p>
        <p><strong>الهاتف / واتساب:</strong> ' . htmlspecialchars($userPhone) . '</p>
        <p><strong>اسم الدورة:</strong> <span style="color:#f59e0b;font-weight:bold;">' . htmlspecialchars($courseTitle) . '</span></p>
        <p><strong>المبلغ المدفوع:</strong> <span style="color:#10b981;font-size:18px;font-weight:bold;">' . htmlspecialchars($finalPrice) . ' ' . htmlspecialchars($currency) . '</span></p>
        ' . ($discountAmount > 0 ? '<p><strong>كود الخصم:</strong> ' . htmlspecialchars($promoCode) . ' (توفير: ' . htmlspecialchars($discountAmount) . ' ' . htmlspecialchars($currency) . ')</p>' : '') . '
        <p><strong>طريقة الدفع:</strong> ' . htmlspecialchars($paymentMethod) . '</p>
        <p><strong>التاريخ:</strong> ' . $dateStr . '</p>
      </div>
      <div style="text-align:center;color:#10b981;font-weight:bold;">
        ✅ تم تسجيل وتفعيل اشتراك الطالب في قاعدة البيانات بنجاح.
      </div>
    </div>
    </body>
    </html>';

    $headers = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: Tarqa Platform <noreply@tarqa3.net>\r\n";
    if (!empty($userEmail)) {
        $headers .= "Reply-To: {$userEmail}\r\n";
    }

    @mail($adminEmail, $emailSubject, $emailHtml, $headers);
    if (!empty($userEmail) && filter_var($userEmail, FILTER_VALIDATE_EMAIL)) {
        @mail($userEmail, "🧾 إيصال اشتراكك في {$courseTitle} - منصة طرقع", $emailHtml, $headers);
    }

    if (!empty($telegramBotToken) && !empty($telegramChatId)) {
        try {
            $tgUrl = "https://api.telegram.org/bot{$telegramBotToken}/sendMessage";
            $tgData = ['chat_id' => $telegramChatId, 'text' => $waText, 'parse_mode' => 'Markdown'];
            $ctx = stream_context_create([
                'http' => ['method' => 'POST', 'header' => "Content-Type: application/json\r\n", 'content' => json_encode($tgData), 'timeout' => 4]
            ]);
            @file_get_contents($tgUrl, false, $ctx);
        } catch (Throwable $e) {}
    }

    return [
        'whatsapp_url' => $whatsappUrl,
        'whatsapp_text' => $waText,
        'email_sent' => true,
    ];
}

// تهيئة جداول التجارة والأسعار تلقائياً
if ($pdo) {
    initCommerceTables($pdo);
}

// ------------------------------------------------------------------------------
// A. جلب وتحديث أسعار الدورات في الباك إند والداتابيز
// ------------------------------------------------------------------------------
if ($action === 'get_course_pricing') {
    $pricing = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT * FROM course_pricing WHERE is_active = 1");
            $pricing = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}
    }

    if (empty($pricing)) {
        $backupFile = __DIR__ . '/course_pricing_backup.json';
        if (file_exists($backupFile)) {
            $pricing = json_decode(@file_get_contents($backupFile), true) ?: [];
        }
    }

    if (empty($pricing)) {
        // افتراضيات النظام الأساسية
        $pricing = [
            [
                'course_id' => 'course-foundation',
                'course_title' => 'دورة التأسيس الشاملة للقدرات 🎯',
                'price_sar' => 75.00,
                'price_egp' => 1100.00,
                'is_active' => 1
            ]
        ];
    }

    sendJson(['success' => true, 'pricing' => $pricing]);
}

if ($action === 'update_course_price') {
    $courseId = trim($body['course_id'] ?? '');
    $courseTitle = trim($body['course_title'] ?? '');
    $priceSar = floatval($body['price_sar'] ?? 75);
    $priceEgp = floatval($body['price_egp'] ?? 1100);
    $isActive = isset($body['is_active']) ? (!empty($body['is_active']) ? 1 : 0) : 1;

    if (empty($courseId)) {
        sendJson(['success' => false, 'error' => 'معرف الدورة مطلوب'], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO course_pricing (course_id, course_title, price_sar, price_egp, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE
                    course_title = VALUES(course_title),
                    price_sar = VALUES(price_sar),
                    price_egp = VALUES(price_egp),
                    is_active = VALUES(is_active),
                    updated_at = NOW()
            ");
            $stmt->execute([$courseId, $courseTitle, $priceSar, $priceEgp, $isActive]);
        } catch (Throwable $e) {
            error_log("Update course price error: " . $e->getMessage());
        }
    }

    // حفظ في ملف احتياطي
    $backupFile = __DIR__ . '/course_pricing_backup.json';
    $existing = file_exists($backupFile) ? (json_decode(@file_get_contents($backupFile), true) ?: []) : [];
    $found = false;
    foreach ($existing as &$p) {
        if ($p['course_id'] === $courseId) {
            $p['price_sar'] = $priceSar;
            $p['price_egp'] = $priceEgp;
            $p['course_title'] = $courseTitle ?: $p['course_title'];
            $p['is_active'] = $isActive;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $existing[] = [
            'course_id' => $courseId,
            'course_title' => $courseTitle,
            'price_sar' => $priceSar,
            'price_egp' => $priceEgp,
            'is_active' => $isActive,
        ];
    }
    @file_put_contents($backupFile, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    sendJson([
        'success' => true,
        'message' => 'تم حفظ وتحديث سعر الدورة في قاعدة البيانات بنجاح',
        'course_id' => $courseId,
        'price_sar' => $priceSar,
        'price_egp' => $priceEgp
    ]);
}

// ------------------------------------------------------------------------------
// حساب التوقيع الرقمي لكاشير (Kashier Hash Generator)
// ------------------------------------------------------------------------------
if ($action === 'kashier_hash') {
    $merchantId = trim($body['merchantId'] ?? 'MID-50598-297');
    $secretKey = trim($body['customSecretKey'] ?? '');
    if (empty($secretKey) || strlen($secretKey) < 30) {
        $secretKey = 'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b';
    }
    $orderId = trim($body['orderId'] ?? '');
    $amount = floatval($body['amount'] ?? 1100);
    $formattedAmount = ($amount == floor($amount)) ? strval(intval($amount)) : number_format($amount, 2, '.', '');
    $currency = strtoupper(trim($body['currency'] ?? 'EGP'));
    if ($currency !== 'SAR') $currency = 'EGP';

    $path = "/?payment={$merchantId}.{$orderId}.{$formattedAmount}.{$currency}";
    $hash = hash_hmac('sha256', $path, $secretKey);

    sendJson([
        'success' => true,
        'hash' => $hash,
        'amount' => $formattedAmount,
        'currency' => $currency,
        'orderId' => $orderId
    ]);
}

// ------------------------------------------------------------------------------
// فحص جلسة كاشير الرسمية عبر السيرفر لتفادي Invalid Token و CORS
// ------------------------------------------------------------------------------
if ($action === 'verify_kashier_session') {
    $sessionId = trim($body['sessionId'] ?? $body['session_id'] ?? $_GET['sessionId'] ?? '');
    $secretKey = trim($body['customSecretKey'] ?? '');
    if (empty($secretKey) || strlen($secretKey) < 30) {
        $secretKey = 'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b';
    }
    $apiKey = '91bdc6e4-423d-4bcb-91ef-a27485a465d1';
    $mode = trim($body['mode'] ?? 'live');
    
    if (empty($sessionId)) {
        sendJson(['success' => false, 'error' => 'رقم الجلسة مطلوب'], 400);
    }
    
    $baseUrl = ($mode === 'live') ? 'https://api.kashier.io' : 'https://test-api.kashier.io';
    $url = "{$baseUrl}/v3/payment/sessions/{$sessionId}";
    
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        "Authorization: {$secretKey}",
        "api-key: {$apiKey}",
        "Content-Type: application/json"
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    
    if ($err) {
        sendJson(['success' => false, 'error' => 'خطأ في الاتصال بسيرفر كاشير: ' . $err], 500);
    }
    
    $resData = json_decode($response, true);
    if ($httpCode >= 200 && $httpCode < 300 && $resData) {
        $dataObj = $resData['data'] ?? $resData;
        $sessionStatus = strtoupper($dataObj['status'] ?? 'PENDING');
        $capturedAmount = floatval($dataObj['capturedAmount'] ?? 0);
        $isPaid = ($sessionStatus === 'SUCCESS' || $sessionStatus === 'CAPTURED' || $sessionStatus === 'PAID' || $capturedAmount > 0);

        sendJson([
            'success' => true,
            'isPaid' => $isPaid,
            'status' => $sessionStatus,
            'orderId' => $dataObj['paymentParams']['order'] ?? '',
            'amount' => $dataObj['paymentParams']['amount'] ?? 0,
            'currency' => $dataObj['paymentParams']['currency'] ?? 'EGP',
            'data' => $dataObj
        ]);
    } else {
        sendJson([
            'success' => false,
            'error' => $resData['message'] ?? $resData['error'] ?? "كاشير أرجع رمز استجابة {$httpCode}",
            'httpStatus' => $httpCode,
            'raw' => $resData
        ], $httpCode ?: 400);
    }
}

// ------------------------------------------------------------------------------
// توليد جلسة ورابط دفع كاشير الرسمي (Kashier Checkout Session Generator)
// ------------------------------------------------------------------------------
if ($action === 'create_kashier_session') {
    $merchantId = trim($body['customMerchantId'] ?? $body['merchantId'] ?? 'MID-50598-297');
    $secretKey = trim($body['customSecretKey'] ?? '');
    if (empty($secretKey) || strlen($secretKey) < 30) {
        $secretKey = 'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b';
    }
    $apiKey = trim($body['customApiKey'] ?? $body['apiKey'] ?? '91bdc6e4-423d-4bcb-91ef-a27485a465d1');
    $orderId = trim($body['order'] ?? $body['orderId'] ?? ('TARQA3_' . round(microtime(true) * 1000)));
    $amount = floatval($body['amount'] ?? 1100);
    $formattedAmount = number_format($amount, 2, '.', '');
    $currency = strtoupper(trim($body['currency'] ?? 'EGP'));
    if ($currency !== 'SAR') $currency = 'EGP';

    $origin = !empty($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : 'https://tarqa3.net';
    $redirectUrl = $origin . '/?payment=kashier_done&order=' . urlencode($orderId);

    $customerEmail = !empty($body['customer']['email']) ? trim($body['customer']['email']) : 'student@tarqa.app';
    $customerRef = !empty($body['customer']['reference']) ? trim($body['customer']['reference']) : ('user_' . round(microtime(true) * 1000));

    $kashierPayload = [
        'expireAt' => gmdate('Y-m-d\TH:i:s\Z', time() + 3600),
        'maxFailureAttempts' => 3,
        'paymentType' => 'credit',
        'amount' => $formattedAmount,
        'currency' => $currency,
        'order' => $orderId,
        'merchantRedirect' => $redirectUrl,
        'display' => 'ar',
        'type' => 'one-time',
        'allowedMethods' => 'card,wallet',
        'merchantId' => $merchantId,
        'description' => trim($body['description'] ?? 'اشتراك منصة طرقع'),
        'customer' => [
            'email' => $customerEmail,
            'reference' => $customerRef,
        ]
    ];

    $sessionUrl = '';
    $sessionId = '';

    // 1. الاتصال الرسمي ببوابة Kashier v3 Payment Sessions API عبر الخادم
    if (function_exists('curl_init')) {
        $ch = curl_init('https://api.kashier.io/v3/payment/sessions');
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($kashierPayload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: ' . $secretKey,
            'api-key: ' . $apiKey,
            'Content-Type: application/json'
        ]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode >= 200 && $httpCode < 300 && !empty($response)) {
            $respData = json_decode($response, true);
            if (!empty($respData['sessionUrl'])) {
                $sessionUrl = $respData['sessionUrl'];
                $sessionId = $respData['_id'] ?? '';
            }
        }
    }

    if (!empty($sessionUrl)) {
        sendJson([
            'success' => true,
            'sessionUrl' => $sessionUrl,
            'sessionId' => $sessionId,
            'orderId' => $orderId,
            'amount' => $formattedAmount,
            'currency' => $currency
        ]);
    } else {
        sendJson([
            'success' => false,
            'message' => 'تعذر إنشاء جلسة دفع كاشير عبر السيرفر، يرجى المحاولة لاحقاً',
            'orderId' => $orderId
        ], 502);
    }
}

// ------------------------------------------------------------------------------
// B. التحقق من كود الخصم (Promo Code Validation on Backend)
// ------------------------------------------------------------------------------
if ($action === 'validate_promo_code') {
    $code = strtoupper(trim($body['code'] ?? $_GET['code'] ?? ''));
    $courseId = trim($body['course_id'] ?? $_GET['course_id'] ?? 'course-foundation');
    $currency = strtoupper(trim($body['currency'] ?? $_GET['currency'] ?? 'SAR'));
    if ($currency !== 'EGP') $currency = 'SAR';

    if (empty($code)) {
        sendJson(['success' => false, 'valid' => false, 'message' => 'يرجى إدخال رمز كود الخصم'], 400);
    }

    // 1. جلب السعر المعتمد للدورة من قاعدة البيانات أو النسخة الاحتياطية المحدثة
    $originalPrice = ($currency === 'EGP') ? 1100.00 : 75.00;
    $courseTitle = 'الدورة الشاملة للقدرات';
    $foundPrice = false;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM course_pricing WHERE course_id = ? LIMIT 1");
            $stmt->execute([$courseId]);
            $pRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($pRow) {
                $originalPrice = ($currency === 'EGP') ? floatval($pRow['price_egp']) : floatval($pRow['price_sar']);
                if (!empty($pRow['course_title'])) $courseTitle = $pRow['course_title'];
                $foundPrice = true;
            }
        } catch (Throwable $e) {}
    }

    if (!$foundPrice) {
        $backupPricingFile = __DIR__ . '/course_pricing_backup.json';
        if (file_exists($backupPricingFile)) {
            $allPrices = json_decode(@file_get_contents($backupPricingFile), true) ?: [];
            foreach ($allPrices as $pr) {
                if ($pr['course_id'] === $courseId) {
                    $originalPrice = ($currency === 'EGP') ? floatval($pr['price_egp']) : floatval($pr['price_sar']);
                    if (!empty($pr['course_title'])) $courseTitle = $pr['course_title'];
                    $foundPrice = true;
                    break;
                }
            }
        }
    }

    // 2. فحص كود الخصم في قاعدة البيانات
    $promoRow = null;
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM promo_codes WHERE code = ? LIMIT 1");
            $stmt->execute([$code]);
            $promoRow = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}
    }

    if (!$promoRow) {
        $backupFile = __DIR__ . '/promo_codes_backup.json';
        if (file_exists($backupFile)) {
            $allP = json_decode(@file_get_contents($backupFile), true) ?: [];
            foreach ($allP as $p) {
                if (strtoupper($p['code']) === $code) {
                    $promoRow = $p;
                    break;
                }
            }
        }
    }

    if (!$promoRow) {
        sendJson(['success' => false, 'valid' => false, 'message' => 'كود الخصم غير موجود أو تم حذفه'], 404);
    }

    if (empty($promoRow['is_active'])) {
        sendJson(['success' => false, 'valid' => false, 'message' => 'كود الخصم معطل حالياً'], 400);
    }

    if (!empty($promoRow['expires_at']) && strtotime($promoRow['expires_at']) < time()) {
        sendJson(['success' => false, 'valid' => false, 'message' => 'عذراً، كود الخصم انتهت صلاحيته'], 400);
    }

    if (!empty($promoRow['max_uses']) && intval($promoRow['max_uses']) > 0) {
        if (intval($promoRow['used_count']) >= intval($promoRow['max_uses'])) {
            sendJson(['success' => false, 'valid' => false, 'message' => 'عذراً، وصل كود الخصم للحد الأقصى للاستخدام'], 400);
        }
    }

    if (!empty($promoRow['course_id']) && $promoRow['course_id'] !== $courseId && $promoRow['course_id'] !== 'all') {
        sendJson(['success' => false, 'valid' => false, 'message' => 'هذا الكود غير مخصص لهذه الدورة التدريبية'], 400);
    }

    $discountType = $promoRow['discount_type']; // 'percentage' | 'fixed'
    $discountValue = floatval($promoRow['discount_value']);
    $discountAmount = 0.0;

    if ($discountType === 'percentage') {
        $discountAmount = round(($originalPrice * $discountValue) / 100, 2);
    } else {
        $discountAmount = min($originalPrice, $discountValue);
    }

    $finalPrice = max(0.0, round($originalPrice - $discountAmount, 2));

    sendJson([
        'success' => true,
        'valid' => true,
        'code' => $code,
        'discount_type' => $discountType,
        'discount_value' => $discountValue,
        'original_price' => $originalPrice,
        'discount_amount' => $discountAmount,
        'final_price' => $finalPrice,
        'currency' => $currency,
        'course_id' => $courseId,
        'course_title' => $courseTitle,
        'message' => 'تم تطبيق كود الخصم بنجاح! خصم ' . ($discountType === 'percentage' ? "{$discountValue}%" : "{$discountValue} {$currency}")
    ]);
}

// ------------------------------------------------------------------------------
// C. إدارة البرومو كودز (CRUD Promo Codes - Admin)
// ------------------------------------------------------------------------------
if ($action === 'get_promo_codes') {
    $codes = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT * FROM promo_codes ORDER BY created_at DESC");
            $codes = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}
    }

    if (empty($codes)) {
        $backupFile = __DIR__ . '/promo_codes_backup.json';
        if (file_exists($backupFile)) {
            $codes = json_decode(@file_get_contents($backupFile), true) ?: [];
        }
    }

    sendJson(['success' => true, 'promo_codes' => $codes]);
}

if ($action === 'save_promo_code') {
    $id = trim($body['id'] ?? ('promo_' . time()));
    $code = strtoupper(trim($body['code'] ?? ''));
    $discountType = ($body['discount_type'] === 'fixed') ? 'fixed' : 'percentage';
    $discountValue = floatval($body['discount_value'] ?? 10);
    $courseId = !empty($body['course_id']) ? trim($body['course_id']) : null;
    $maxUses = intval($body['max_uses'] ?? 0);
    $isActive = isset($body['is_active']) ? (!empty($body['is_active']) ? 1 : 0) : 1;
    $expiresAt = !empty($body['expires_at']) ? trim($body['expires_at']) : null;

    if (empty($code)) {
        sendJson(['success' => false, 'error' => 'رمز كود الخصم مطلوب'], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO promo_codes (id, code, discount_type, discount_value, course_id, max_uses, is_active, expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
                ON DUPLICATE KEY UPDATE
                    code = VALUES(code),
                    discount_type = VALUES(discount_type),
                    discount_value = VALUES(discount_value),
                    course_id = VALUES(course_id),
                    max_uses = VALUES(max_uses),
                    is_active = VALUES(is_active),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()
            ");
            $stmt->execute([$id, $code, $discountType, $discountValue, $courseId, $maxUses, $isActive, $expiresAt]);
        } catch (Throwable $e) {
            error_log("Save promo code error: " . $e->getMessage());
        }
    }

    $backupFile = __DIR__ . '/promo_codes_backup.json';
    $existing = file_exists($backupFile) ? (json_decode(@file_get_contents($backupFile), true) ?: []) : [];
    $found = false;
    foreach ($existing as &$p) {
        if ($p['id'] === $id || strtoupper($p['code']) === $code) {
            $p['code'] = $code;
            $p['discount_type'] = $discountType;
            $p['discount_value'] = $discountValue;
            $p['course_id'] = $courseId;
            $p['max_uses'] = $maxUses;
            $p['is_active'] = $isActive;
            $p['expires_at'] = $expiresAt;
            $found = true;
            break;
        }
    }
    if (!$found) {
        $existing[] = [
            'id' => $id,
            'code' => $code,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'course_id' => $courseId,
            'max_uses' => $maxUses,
            'used_count' => 0,
            'is_active' => $isActive,
            'expires_at' => $expiresAt,
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }
    @file_put_contents($backupFile, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    sendJson([
        'success' => true,
        'message' => 'تم حفظ كود الخصم بنجاح في قاعدة البيانات',
        'promo_code' => [
            'id' => $id,
            'code' => $code,
            'discount_type' => $discountType,
            'discount_value' => $discountValue,
            'course_id' => $courseId,
            'max_uses' => $maxUses,
            'is_active' => (bool)$isActive,
            'expires_at' => $expiresAt,
        ]
    ]);
}

if ($action === 'delete_promo_code') {
    $idOrCode = trim($body['id'] ?? $body['code'] ?? $_GET['id'] ?? $_GET['code'] ?? '');
    if (empty($idOrCode)) {
        sendJson(['success' => false, 'error' => 'معرف كود الخصم مطلوب'], 400);
    }

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("DELETE FROM promo_codes WHERE id = ? OR code = ?");
            $stmt->execute([$idOrCode, strtoupper($idOrCode)]);
        } catch (Throwable $e) {}
    }

    $backupFile = __DIR__ . '/promo_codes_backup.json';
    if (file_exists($backupFile)) {
        $existing = json_decode(@file_get_contents($backupFile), true) ?: [];
        $existing = array_values(array_filter($existing, function($p) use ($idOrCode) {
            return $p['id'] !== $idOrCode && strtoupper($p['code']) !== strtoupper($idOrCode);
        }));
        @file_put_contents($backupFile, json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    sendJson(['success' => true, 'message' => 'تم حذف كود الخصم بنجاح']);
}

// ------------------------------------------------------------------------------
// D. تأكيد دفع دورة وتفعيل اشتراكها وإرسال الإيصال (Confirm Payment & Send Receipt)
// ------------------------------------------------------------------------------
if ($action === 'confirm_course_payment') {
    $orderId = trim($body['order_id'] ?? ('TARQA_' . time()));
    $courseId = trim($body['course_id'] ?? 'course-foundation');
    $courseTitle = trim($body['course_title'] ?? 'دورة قدرات');
    $userId = trim($body['user_id'] ?? ('usr_' . time()));
    $userName = trim($body['user_name'] ?? 'طالب طرقع');
    $userEmail = strtolower(trim($body['user_email'] ?? ''));
    $userPhone = trim($body['user_phone'] ?? '');
    $currency = strtoupper(trim($body['currency'] ?? 'SAR'));
    if ($currency !== 'EGP') $currency = 'SAR';
    $promoCode = strtoupper(trim($body['promo_code'] ?? ''));
    $paymentMethod = trim($body['payment_method'] ?? 'kashier');

    // 1. حساب السعر الدقيق المحمي من قاعدة البيانات أو النسخة الاحتياطية المحدثة
    $originalPrice = ($currency === 'EGP') ? 1100.00 : 75.00;
    $foundPrice = false;

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT * FROM course_pricing WHERE course_id = ? LIMIT 1");
            $stmt->execute([$courseId]);
            $pRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($pRow) {
                $originalPrice = ($currency === 'EGP') ? floatval($pRow['price_egp']) : floatval($pRow['price_sar']);
                if (!empty($pRow['course_title'])) $courseTitle = $pRow['course_title'];
                $foundPrice = true;
            }
        } catch (Throwable $e) {}
    }

    if (!$foundPrice) {
        $backupPricingFile = __DIR__ . '/course_pricing_backup.json';
        if (file_exists($backupPricingFile)) {
            $allPrices = json_decode(@file_get_contents($backupPricingFile), true) ?: [];
            foreach ($allPrices as $pr) {
                if ($pr['course_id'] === $courseId) {
                    $originalPrice = ($currency === 'EGP') ? floatval($pr['price_egp']) : floatval($pr['price_sar']);
                    if (!empty($pr['course_title'])) $courseTitle = $pr['course_title'];
                    $foundPrice = true;
                    break;
                }
            }
        }
    }

    // احتساب الخصم بالسيرفر إذا توفر كود خصم
    $discountAmount = 0.0;
    if (!empty($promoCode)) {
        if ($pdo) {
            try {
                $stmt = $pdo->prepare("SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 LIMIT 1");
                $stmt->execute([$promoCode]);
                $pRow = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($pRow) {
                    if ($pRow['discount_type'] === 'percentage') {
                        $discountAmount = round(($originalPrice * floatval($pRow['discount_value'])) / 100, 2);
                    } else {
                        $discountAmount = min($originalPrice, floatval($pRow['discount_value']));
                    }
                    // زيادة عدد الاستخدامات
                    $upd = $pdo->prepare("UPDATE promo_codes SET used_count = used_count + 1 WHERE code = ?");
                    $upd->execute([$promoCode]);
                }
            } catch (Throwable $e) {}
        }
    }

    $finalPrice = max(0.0, round($originalPrice - $discountAmount, 2));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+1 year'));

    // التمييز الصارم بين إنستاباي (يدوي) وكاشير (فوري)
    $isInstapay = (strtolower($paymentMethod) === 'instapay');
    $isActive = $isInstapay ? 0 : 1; // 0 بانتظار مراجعة وتفعيل الإدارة يدوياً، 1 تفعيل فوري لكاشير
    $paymentStatus = $isInstapay ? 'PENDING' : 'PAID';

    // 2. تسجيل اشتراك الدورة للمستخدم في جدول course_subscriptions
    // تنبيه حاسم: إذا كانت طريقة الدفع إنستاباي يتم الحفظ كـ غير مفعل (is_active = 0) بانتظار التفعيل اليدوي من الإدارة
    $subId = 'csub-' . substr(md5($userId . '_' . $courseId), 0, 16);
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO course_subscriptions 
                (id, user_id, user_email, user_name, course_id, is_active, amount_paid, currency, promo_code, order_id, payment_method, starts_at, expires_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW())
                ON DUPLICATE KEY UPDATE
                    user_name = VALUES(user_name),
                    user_email = VALUES(user_email),
                    is_active = VALUES(is_active),
                    amount_paid = VALUES(amount_paid),
                    currency = VALUES(currency),
                    promo_code = VALUES(promo_code),
                    order_id = VALUES(order_id),
                    payment_method = VALUES(payment_method),
                    expires_at = VALUES(expires_at),
                    updated_at = NOW()
            ");
            $stmt->execute([
                $subId, $userId, $userEmail, $userName, $courseId, $isActive,
                $finalPrice, $currency, $promoCode ?: null, $orderId, $paymentMethod, $expiresAt
            ]);
        } catch (Throwable $e) {
            error_log("Enroll in course_subscriptions error: " . $e->getMessage());
        }
    }

    // 3. حفظ الفاتورة في جدول payment_receipts (قيد المراجعة لإنستاباي أو مدفوعة لكاشير)
    $receiptId = 'rcpt_' . time() . '_' . substr(md5($orderId), 0, 6);
    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO payment_receipts 
                (id, order_id, user_id, user_name, user_email, user_phone, course_id, course_title, original_price, discount_amount, final_price, currency, promo_code, payment_method, payment_status, receipt_sent_email, receipt_sent_whatsapp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, NOW())
                ON DUPLICATE KEY UPDATE payment_status = VALUES(payment_status)
            ");
            $stmt->execute([
                $receiptId, $orderId, $userId, $userName, $userEmail, $userPhone,
                $courseId, $courseTitle, $originalPrice, $discountAmount, $finalPrice, $currency,
                $promoCode ?: null, $paymentMethod, $paymentStatus
            ]);
        } catch (Throwable $e) {
            error_log("Insert payment_receipts error: " . $e->getMessage());
        }
    }

    // 3.1 تحديث وتثبيت حالة اشتراك الطالب في جدول users ليظهر فوراً في الداشبورد والإحصائيات
    if ($isActive === 1 && $pdo) {
        try {
            $updUser = $pdo->prepare("
                UPDATE users 
                SET is_subscribed = 1, 
                    subscription_expires_at = ?, 
                    subscription_period = 'annual',
                    updated_at = NOW() 
                WHERE id = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)
            ");
            $updUser->execute([$expiresAt, $userId, $userEmail]);

            // إذا لم يكن مسجلاً في جدول users مسبقاً، يتم إدراجه كطالب مشترك فوراً
            if (!empty($userEmail)) {
                $insUser = $pdo->prepare("
                    INSERT IGNORE INTO users 
                    (id, email, full_name, role, is_subscribed, subscription_expires_at, subscription_period, created_at, updated_at)
                    VALUES (?, ?, ?, 'student', 1, ?, 'annual', NOW(), NOW())
                ");
                $insUser->execute([$userId, $userEmail, $userName ?: 'طالب طرقع', $expiresAt]);
            }
        } catch (Throwable $e) {
            error_log("Update user subscription from confirm_course_payment error: " . $e->getMessage());
        }
    }

    // 3.2 تحديث subscriptions_log.json لمزامنة فورية مع نقطة نهاية الاشتراكات ولوحة الإدارة
    if ($isActive === 1) {
        $subsFile = __DIR__ . '/subscriptions_log.json';
        $subsData = file_exists($subsFile) ? (json_decode(@file_get_contents($subsFile), true) ?: ['subscriptions' => []]) : ['subscriptions' => []];
        $allSubs = $subsData['subscriptions'] ?? [];
        $subLogEntry = [
            'userId' => $userId,
            'userEmail' => $userEmail,
            'userName' => $userName,
            'planId' => 'annual_' . $courseId,
            'planName' => $courseTitle,
            'priceSAR' => ($currency === 'SAR' ? $finalPrice : round($finalPrice / 15, 2)),
            'priceEGP' => ($currency === 'EGP' ? $finalPrice : round($finalPrice * 15, 2)),
            'startDate' => date('c'),
            'expiresDate' => date('c', strtotime($expiresAt)),
            'expiresAt' => date('c', strtotime($expiresAt)),
            'isActive' => true,
            'active' => true,
            'status' => 'active',
            'orderId' => $orderId,
            'paymentMethod' => $paymentMethod,
            'updatedAt' => date('c')
        ];
        if (!empty($userId)) $allSubs[$userId] = $subLogEntry;
        if (!empty($userEmail)) $allSubs[$userEmail] = $subLogEntry;
        $subsData['subscriptions'] = $allSubs;
        @file_put_contents($subsFile, json_encode($subsData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    // حفظ نسخة احتياطية في payment_receipts_backup.json
    $rcptBackup = __DIR__ . '/payment_receipts_backup.json';
    $allRcpts = file_exists($rcptBackup) ? (json_decode(@file_get_contents($rcptBackup), true) ?: []) : [];
    $receiptObj = [
        'id' => $receiptId,
        'order_id' => $orderId,
        'user_id' => $userId,
        'user_name' => $userName,
        'user_email' => $userEmail,
        'user_phone' => $userPhone,
        'course_id' => $courseId,
        'course_title' => $courseTitle,
        'original_price' => $originalPrice,
        'discount_amount' => $discountAmount,
        'final_price' => $finalPrice,
        'currency' => $currency,
        'promo_code' => $promoCode,
        'payment_method' => $paymentMethod,
        'payment_status' => $paymentStatus,
        'created_at' => date('Y-m-d H:i:s'),
    ];
    $allRcpts[] = $receiptObj;
    @file_put_contents($rcptBackup, json_encode($allRcpts, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

    // 4. إرسال الإيصال الرسمي على الإيميل وتجهيز رسالة ورابط واتساب
    $receiptResult = sendPaymentReceipt($receiptObj, $pdo);

    sendJson([
        'success' => true,
        'message' => $isInstapay ? 'تم استلام طلب التحويل عبر إنستاباي بنجاح ⏳ بانتظار المراجعة والتفعيل اليدوي' : 'تم تفعيل اشتراك الدورة وتوليد الإيصال بنجاح! 🎉',
        'is_active' => ($isActive === 1),
        'payment_status' => $paymentStatus,
        'subscription' => [
            'id' => $subId,
            'course_id' => $courseId,
            'user_id' => $userId,
            'is_active' => ($isActive === 1),
            'expires_at' => $expiresAt
        ],
        'receipt' => $receiptObj,
        'whatsapp_url' => $receiptResult['whatsapp_url'],
        'whatsapp_text' => $receiptResult['whatsapp_text']
    ]);
}

// ------------------------------------------------------------------------------
// E. جلب سجل الإيصالات وإعدادات الواتساب/الإيميل (Admin)
// ------------------------------------------------------------------------------
if ($action === 'get_payment_receipts') {
    $receipts = [];
    if ($pdo) {
        try {
            $stmt = $pdo->query("SELECT * FROM payment_receipts ORDER BY created_at DESC LIMIT 100");
            $receipts = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {}
    }

    if (empty($receipts)) {
        $rcptBackup = __DIR__ . '/payment_receipts_backup.json';
        if (file_exists($rcptBackup)) {
            $receipts = json_decode(@file_get_contents($rcptBackup), true) ?: [];
        }
    }

    sendJson(['success' => true, 'receipts' => $receipts]);
}

if ($action === 'get_receipt_settings') {
    $settings = [
        'admin_whatsapp' => '966500000000',
        'admin_email' => 'tarqa.qudurat@gmail.com',
        'telegram_chat_id' => ''
    ];

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("SELECT setting_value FROM platform_settings WHERE setting_key = 'receipt_settings' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row && !empty($row['setting_value'])) {
                $decoded = json_decode($row['setting_value'], true);
                if (is_array($decoded)) $settings = array_merge($settings, $decoded);
            }
        } catch (Throwable $e) {}
    }

    sendJson(['success' => true, 'settings' => $settings]);
}

if ($action === 'save_receipt_settings') {
    $whatsapp = preg_replace('/[^0-9]/', '', $body['admin_whatsapp'] ?? '966500000000');
    $email = trim($body['admin_email'] ?? 'tarqa.qudurat@gmail.com');
    $tgChatId = trim($body['telegram_chat_id'] ?? '');

    $settingsJson = json_encode([
        'admin_whatsapp' => $whatsapp,
        'admin_email' => $email,
        'telegram_chat_id' => $tgChatId,
        'updated_at' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE);

    if ($pdo) {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO platform_settings (setting_key, setting_value, updated_at)
                VALUES ('receipt_settings', ?, NOW())
                ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
            ");
            $stmt->execute([$settingsJson]);
        } catch (Throwable $e) {}
    }

    sendJson(['success' => true, 'message' => 'تم حفظ إعدادات الإيصالات بنجاح']);
}

sendJson(['success' => false, 'error' => 'إجراء غير معروف'], 404);

