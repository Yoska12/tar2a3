<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية مزامنة جلسة المستخدم الموحدة مع الباك إند
 * Tarqa Platform - Unified Session Synchronization Endpoint
 * ==============================================================================
 * تربط جلسة الطالب في الموقع (Supabase / localStorage) مع جلسة PHP في السيرفر
 * بحيث تعمل جميع ميزات المحاكي (حفظ النتائج، جلب السجل، المفضلة، التقدم) فورياً
 */
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

require_once __DIR__ . '/session_helper.php';
initSession();
require_once __DIR__ . '/db-config.php';

// ضبط ترويسات CORS المعتمدة
$_allowed_origins = [
    'https://tarqa3.net',
    'https://www.tarqa3.net',
    'https://simulation.tarqa.com',
    'https://exam.tarqa.com',
    'https://tiger.tarqa.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173'
];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowed_origins, true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_origin)) {
    header("Access-Control-Allow-Origin: $_origin");
    header("Access-Control-Allow-Credentials: true");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function isOwnerEmailCheck($email) {
    if (!$email) return false;
    $clean = strtolower(trim($email));
    return in_array($clean, [
        'tarqa3@gmail.com',
        'superadmin@tarqa.com',
        'admin@tarqa.com',
        'owner@tarqa.com'
    ], true);
}

// 1. استقبال بيانات المزامنة
$input = json_decode(file_get_contents('php://input'), true);
$userData = $input['user'] ?? null;

if (!$userData && isset($_SESSION['user'])) {
    $userData = $_SESSION['user'];
}

if (!$userData) {
    // تحقق مما إذا كانت هناك جلسة PHP مسبقة
    if (isset($_SESSION['logged-in']) && $_SESSION['logged-in'] === true) {
        echo json_encode([
            'success' => true,
            'logged_in' => true,
            'user' => $_SESSION['user'] ?? null,
            'role_id' => $_SESSION['role_id'] ?? 6
        ]);
        exit;
    }

    echo json_encode([
        'success' => false,
        'logged_in' => false,
        'message' => 'No active user payload provided.'
    ]);
    exit;
}

$userId = trim($userData['id'] ?? $userData['userId'] ?? '');
$email = strtolower(trim($userData['email'] ?? $userData['user_email'] ?? ''));
$name = trim($userData['name'] ?? $userData['username'] ?? $userData['first_name'] ?? 'طالب طرقع');
$role = $userData['role'] ?? 'student';
$telegramId = $userData['telegramId'] ?? $userData['telegram_id'] ?? null;
$telegramUsername = trim($userData['telegramUsername'] ?? $userData['telegram_username'] ?? '');
$isSubscribed = !empty($userData['isSubscribed']);
$subscriptionExpiresAt = $userData['subscriptionExpiresAt'] ?? null;

// فحص صلاحية الإدارة أو الاشتراك
$isOwner = isOwnerEmailCheck($email);
$isManager = $isOwner || in_array($role, ['super_admin', 'admin', 'teacher'], true);
$effectiveSubscribed = $isManager || $isSubscribed;

// تحديد role_id في نظام المحاكي:
// 1 = Owner / Super Admin
// 2 = Super Admin
// 3 = Admin
// 4 = Teacher / Editor
// 5 = Subscriber / Member (كامل الصلاحيات لمحاكي الطرقعة)
// 6 = Student / Free (متاح لاختبار تحديد المستوى)
$roleId = 6;
if ($isOwner) {
    $roleId = 1;
} elseif ($role === 'super_admin') {
    $roleId = 2;
} elseif ($role === 'admin') {
    $roleId = 3;
} elseif ($role === 'teacher') {
    $roleId = 4;
} elseif ($effectiveSubscribed) {
    $roleId = 5;
}

$permissions = ['access_level_test'];
if ($effectiveSubscribed) {
    $permissions = array_merge($permissions, ['access_simulators', 'access_exams', 'member']);
}
if ($isManager) {
    $permissions = array_merge($permissions, ['admin', 'edit_questions', 'manage_exams']);
}

// بناء كائن المستخدم الموحد للجلسة
$unifiedUser = [
    'id' => $userId ?: ($telegramId ? strval($telegramId) : 'tarqa_' . substr(md5($email ?: uniqid()), 0, 10)),
    'telegram_id' => $telegramId ?: $userId,
    'first_name' => $name,
    'last_name' => '',
    'username' => $telegramUsername ?: ($email ? explode('@', $email)[0] : 'student'),
    'user_email' => $email,
    'email' => $email,
    'photo_url' => $userData['photo_url'] ?? $userData['avatar'] ?? 'https://i.ibb.co/tMMyJj2y/icon.jpg',
    'role' => $isManager ? 'admin' : ($effectiveSubscribed ? 'member' : 'student'),
    'role_id' => $roleId,
    'is_subscribed' => $effectiveSubscribed,
    'is_expired' => false,
    'subscription_expires_at' => $subscriptionExpiresAt,
    'permissions' => $permissions
];

// حفظ في جلسة PHP
$_SESSION['logged-in'] = true;
$_SESSION['telegram_id'] = $unifiedUser['telegram_id'];
$_SESSION['user_id'] = $unifiedUser['id'];
$_SESSION['user_email'] = $email;
$_SESSION['role_id'] = $roleId;
$_SESSION['user'] = $unifiedUser;
$_SESSION['permissions'] = $permissions;

// مزامنة اختيارية مع قاعدة بيانات MySQL إذا توفر الاتصال
if (isset($db) && $db !== null && !empty($unifiedUser['telegram_id'])) {
    try {
        $existing = $db->Select("SELECT id FROM users WHERE telegram_id = :tid OR email = :em LIMIT 1", [
            'tid' => strval($unifiedUser['telegram_id']),
            'em' => $email
        ]);
        if (!empty($existing)) {
            $db->Update("UPDATE users SET first_name = :fn, role_id = :rid, email = :em, updated_at = NOW() WHERE id = :id", [
                'fn' => $name,
                'rid' => $roleId,
                'em' => $email,
                'id' => $existing[0]['id']
            ]);
        }
    } catch (Throwable $e) {
        error_log("Optional MySQL user sync notice: " . $e->getMessage());
    }
}

echo json_encode([
    'success' => true,
    'logged_in' => true,
    'user' => $unifiedUser,
    'role_id' => $roleId,
    'is_expired' => false,
    'permissions' => $permissions
]);
exit;

