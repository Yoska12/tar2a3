<?php
date_default_timezone_set('Asia/Riyadh');
ob_start();
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL & ~E_NOTICE & ~E_WARNING);

function sendAuthJson($data, $status = 200) {
    if (ob_get_length()) ob_clean();
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data);
    exit;
}

// -------------------------
// منع التخزين المؤقت (Caching) نهائياً
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT"); // Date in the past

// -------------------------
require_once __DIR__ . '/session_helper.php';
initSession();
require_once __DIR__ . '/db-config.php';

// تسجيل خروج إجباري
if (isset($_GET['force_logout']) && isset($_SESSION['logged-in']) && in_array('edit_users', $_SESSION['permissions'] ?? [])) {
    $target_id = intval($_GET['force_logout']);
    
    // جلب telegram_id للمستخدم المستهدف
    $target_user = $db ? $db->Select("SELECT telegram_id FROM users WHERE id = :id", ['id' => $target_id]) : [];
    if (!empty($target_user)) {
        $telegram_id = $target_user[0]['telegram_id'];
        
        // تحديث حقل force_logout في قاعدة البيانات
        $db->Update("UPDATE users SET force_logout = 1 WHERE telegram_id = :telegram_id", 
                   ['telegram_id' => $telegram_id]);
        
        sendAuthJson(['success' => true]);
    }
    
    sendAuthJson(['success' => false, 'error' => 'المستخدم غير موجود']);
}

// التحقق من تسجيل الخروج الإجباري
if (isset($_SESSION['telegram_id']) && $db) {
    $user = $db->Select("SELECT force_logout FROM users WHERE telegram_id = :telegram_id", 
                       ['telegram_id' => $_SESSION['telegram_id']]);
    
    if (!empty($user) && $user[0]['force_logout'] == 1) {
        // إعادة تعيين الحقل
        $db->Update("UPDATE users SET force_logout = 0 WHERE telegram_id = :telegram_id", 
                   ['telegram_id' => $_SESSION['telegram_id']]);
        
        // تسجيل الخروج
        session_unset();
        session_destroy();
        
        if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
            sendAuthJson(['logout_required' => true]);
        } else {
            header('Location: /');
            exit;
        }
    }
}

// توكن البوت الموحد — loaded from environment variables via bot_config.php
$bot_config_file = __DIR__ . '/bot_config.php';
if (!file_exists($bot_config_file)) {
    $bot_config_file = __DIR__ . '/../../Telegram-Login/bot_config.php';
}
if (file_exists($bot_config_file)) {
    require_once $bot_config_file;
}
if (!defined('BOT_TOKEN') || empty(BOT_TOKEN)) {
    error_log('CRITICAL: BOT_TOKEN not configured. Set TELEGRAM_BOT_TOKEN in .env');
    sendAuthJson(['success' => false, 'error' => 'Server configuration error'], 500);
}

// إعداد رؤوس الـ CORS — restricted to allowed origins
$_allowed_cors_origins = ['/','https://tarqa3.net','https://www.tarqa3.net','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
$_cors_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$_cors_allowed = in_array($_cors_origin, $_allowed_cors_origins, true) || (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_cors_origin);
if ($_cors_allowed && !empty($_cors_origin)) {
    header("Access-Control-Allow-Origin: $_cors_origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

//---------------------------------------------

if (isset($_SESSION['telegram_id'])) {
    $logout_file = __DIR__ . '/pending_logouts.txt';
    $telegram_id = $_SESSION['telegram_id'];
    
    if (file_exists($logout_file)) {
        $pending_logouts = file($logout_file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        if (is_array($pending_logouts) && in_array($telegram_id, $pending_logouts)) {
            // تنظيف الملف من هذا المستخدم
            $updated_logouts = array_diff($pending_logouts, [$telegram_id]);
            
            // استخدام flock لمنع تضارب الكتابة
            $fp = fopen($logout_file, 'w');
            if ($fp && flock($fp, LOCK_EX)) {
                fwrite($fp, implode(PHP_EOL, $updated_logouts));
                flock($fp, LOCK_UN);
                fclose($fp);
            } else if ($fp) {
                fclose($fp);
            }
            
            // تسجيل الخروج
            session_unset();
            session_destroy();
            
            // إرجاع رد مناسب
            if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
                sendAuthJson(['logout_required' => true]);
            } else {
                header('Location: /');
                exit;
            }
        }
    }
}

// ---------------------------------------------
// تسجيل الخروج
// ---------------------------------------------
if (isset($_GET['logout'])) {
    session_unset();
    session_destroy();
    sendAuthJson(['success' => true, 'message' => 'تم تسجيل الخروج بنجاح']);
}

// ---------------------------------------------
// التحقق من حالة الجلسة
// ---------------------------------------------
if (isset($_GET['check_session'])) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $response = [
        'success' => false,
        'logged_in' => false,
        'message' => 'غير مسجل الدخول'
    ];

    if (isset($_SESSION['logged-in']) && $_SESSION['logged-in'] === true) {
        $telegram_id = $_SESSION['telegram_id'] ?? null;
        $user = $telegram_id ? getUserByTelegramId($db, $telegram_id) : false;
        
        if ($user) {
            $userRoleId = intval($user['role_id'] ?? 6);
            if ($userRoleId === 5 && !empty($user['role_expires_at']) && strtotime($user['role_expires_at']) <= time()) {
                $userRoleId = 6;
                if ($db) {
                    try {
                        $db->Update("UPDATE users SET role_id = 6, subscription_period = 'none' WHERE id = :uid", ['uid' => $user['id']]);
                        $db->Update("UPDATE orders SET payment_status = 'expired' WHERE (user_id = :uid OR user_id = :tid) AND payment_status IN ('confirmed', 'completed', 'approved')", [
                            'uid' => strval($user['id']),
                            'tid' => strval($user['telegram_id'])
                        ]);
                        $db->Update("UPDATE enrollments SET status = 'inactive' WHERE (user_id = :uid OR user_id = :tid) AND status = 'active'", [
                            'uid' => strval($user['id']),
                            'tid' => strval($user['telegram_id'])
                        ]);
                    } catch (Throwable $e) { error_log('Subscription expiry update failed: ' . $e->getMessage()); }
                }
                $_SESSION['role_id'] = 6;
                $_SESSION['permissions'] = getRolePermissions($db, 6);
            }

            $isExpired = (!empty($user['role_expires_at']) && strtotime($user['role_expires_at']) <= time());
            $response = [
                'success' => true,
                'logged_in' => true,
                'user' => [
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'] ?? '',
                    'username' => $user['telegram_username'] ?? '',
                    'photo_url' => $user['profile_picture'] ?? '',
                    'id' => $user['telegram_id'],
                    'role_id' => $_SESSION['role_id'] ?? $userRoleId,
                    'user_email' => $user['user_email'] ?? $user['email'] ?? '',
                    'user_phone' => $user['user_phone'] ?? $user['phone'] ?? '',
                    'user_gender' => $user['user_gender'] ?? $user['gender'] ?? '',
                    'email' => $user['user_email'] ?? $user['email'] ?? '',
                    'phone' => $user['user_phone'] ?? $user['phone'] ?? '',
                    'gender' => $user['user_gender'] ?? $user['gender'] ?? ''
                ],
                'role_name' => getRoleName($db, $_SESSION['role_id'] ?? $userRoleId),
                'role_id' => $_SESSION['role_id'] ?? $userRoleId,
                'is_expired' => $isExpired,
                'permissions' => $_SESSION['permissions'] ?? []
            ];
        } else if (isset($_SESSION['user'])) {
            $userRoleId = intval($_SESSION['role_id'] ?? 6);
            $response = [
                'success' => true,
                'logged_in' => true,
                'user' => $_SESSION['user'],
                'role_name' => ($db && getRoleName($db, $userRoleId) !== 'Unknown') ? getRoleName($db, $userRoleId) : 'User',
                'role_id' => $userRoleId,
                'is_expired' => false,
                'permissions' => $_SESSION['permissions'] ?? []
            ];
        } else {
            session_unset();
            session_destroy();
            $response['message'] = 'المستخدم غير موجود في قاعدة البيانات';
        }
    }

    sendAuthJson($response);
}

function getRoleName($db, $role_id) {
    if (!$db) return 'Unknown';
    try {
        $role = $db->Select("SELECT name FROM roles WHERE id = :id", ['id' => $role_id]);
        return $role[0]['name'] ?? 'Unknown';
    } catch (Exception $e) {
        return 'Unknown';
    }
}

if (isset($_GET['check_permissions'])) {
    if (isset($_SESSION['logged-in']) && $_SESSION['logged-in']) {
        sendAuthJson([
            'success' => true,
            'permissions' => $_SESSION['permissions'] ?? []
        ]);
    } else {
        sendAuthJson([
            'success' => false,
            'error' => 'غير مسجل الدخول'
        ]);
    }
}

// ---------------------------------------------
// استقبال بيانات من Telegram Widget عبر POST
// ---------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!$input || !isset($input['hash'])) {
        sendAuthJson(['success' => false, 'error' => 'بيانات غير صالحة'], 400);
    }

    try {
        $auth_data = checkTelegramAuthorization($input);
        $userData = userAuthentication($db, $auth_data);
        sendAuthJson([
            'success'    => true,
            'first_name' => $userData['first_name'],
            'last_name'  => $userData['last_name'] ?? '',
            'username'   => $userData['username'] ?? '',
            'photo_url'  => $userData['photo_url'] ?? '',
            'user'       => $userData
        ]);
    } catch (Exception $e) {
        sendAuthJson(['success' => false, 'error' => $e->getMessage()], 401);
    }
}

// ---------------------------------------------
// استقبال بيانات عبر GET (عند فتح الرابط مباشرة من Widget Redirect)
// ---------------------------------------------
if (isset($_GET['hash'])) {
    try {
        $auth_data = checkTelegramAuthorization($_GET);
        $userData = userAuthentication($db, $auth_data);
        
        if (isset($_GET['redirect']) && $_GET['redirect'] === '0') {
            sendAuthJson([
                'success' => true,
                'first_name' => $userData['first_name'],
                'last_name' => $userData['last_name'] ?? '',
                'username' => $userData['username'] ?? '',
                'photo_url' => $userData['photo_url'] ?? ''
            ]);
        } else {
            // Redirect back to the main application
            header('Location: ../');
            exit;
        }
    } catch (Exception $e) {
        if (isset($_GET['redirect']) && $_GET['redirect'] === '0') {
            sendAuthJson(['success' => false, 'error' => $e->getMessage()], 401);
        } else {
            error_log('Telegram login failed: ' . $e->getMessage());
            http_response_code(401);
            die('Login failed. Please go back and try again.');
        }
    }
}

// ---------------------------------------------
// تحقق من صحة بيانات Telegram
// ---------------------------------------------
function checkTelegramAuthorization(array $auth_data): array
{
    if (!defined('BOT_TOKEN') || empty(BOT_TOKEN) || strlen(trim(BOT_TOKEN)) < 20) {
        error_log("Critical security failure: BOT_TOKEN is missing or not configured in auth.php");
        throw new Exception('خطأ في إعدادات المصادقة بالنظام');
    }

    $check_hash = $auth_data['hash'] ?? '';
    if (empty($check_hash)) {
        throw new Exception('توقيع المصادقة غير موجود');
    }
    unset($auth_data['hash']);

    $data_check_arr = [];
    foreach ($auth_data as $key => $value) {
        $data_check_arr[] = $key . '=' . $value;
    }
    sort($data_check_arr);
    $data_check_string = implode("\n", $data_check_arr);

    $secret_key = hash('sha256', BOT_TOKEN, true);
    $hash       = hash_hmac('sha256', $data_check_string, $secret_key);

    if (!hash_equals($hash, $check_hash)) {
        throw new Exception('البيانات ليست من Telegram');
    }
    
    // منع هجمات إعادة الإرسال والتواريخ المستقبلية
    $authTime = intval($auth_data['auth_date'] ?? 0);
    $timeDiff = time() - $authTime;
    if ($timeDiff < -60 || $timeDiff > 600) {
        throw new Exception('بيانات المصادقة منتهية الصلاحية أو غير صالحة');
    }

    return $auth_data;
}

// ---------------------------------------------
// جلب مستخدم حسب telegram_id
// ---------------------------------------------
function getUserByTelegramId($db, int $telegram_id)
{
    if (!$db) return false;
    try {
        $rows = $db->Select(
            "SELECT * FROM users WHERE telegram_id = :telegram_id",
            ['telegram_id' => $telegram_id]
        );
        return $rows[0] ?? false;
    } catch (Exception $e) {
        error_log("Database error: " . $e->getMessage());
        return false;
    }
}

// ---------------------------------------------
// إنشاء مستخدم جديد بدور افتراضي = 6
// ---------------------------------------------
function createNewUser($db, array $auth_data, int $role_id = 6)
{
    if (!$db) return false;
    try {
        // Note: Schema migrations (ALTER TABLE) have been moved to deployment scripts.
        // Do not run DDL statements on every login.

        $db->Insert(
            "INSERT INTO users 
                (first_name, last_name, telegram_id, telegram_username, profile_picture, auth_date, login_count, role_id)
             VALUES 
                (:first_name, :last_name, :telegram_id, :telegram_username, :profile_picture, :auth_date, 1, :role_id)",
            [
                'first_name'        => $auth_data['first_name'],
                'last_name'         => $auth_data['last_name']        ?? '',
                'telegram_id'       => $auth_data['id'],
                'telegram_username' => $auth_data['username']         ?? '',
                'profile_picture'   => $auth_data['photo_url']        ?? '',
                'auth_date'         => $auth_data['auth_date'],
                'role_id'           => $role_id
            ]
        );
        return true;
    } catch (Exception $e) {
        error_log("Create user error: " . $e->getMessage());
        return false;
    }
}

// ---------------------------------------------
// تحديث مستخدم موجود وزيادة login_count
// ---------------------------------------------
function updateExistingUser($db, array $auth_data)
{
    if (!$db) return false;
    try {
        // Note: Schema migrations (ALTER TABLE) have been moved to deployment scripts.

        $db->Update(
            "UPDATE users SET
                telegram_username = :telegram_username,
                profile_picture   = :profile_picture,
                auth_date         = :auth_date,
                login_count       = login_count + 1
             WHERE telegram_id = :telegram_id",
            [
                'telegram_username' => $auth_data['username']         ?? '',
                'profile_picture'   => $auth_data['photo_url']        ?? '',
                'auth_date'         => $auth_data['auth_date'],
                'telegram_id'       => $auth_data['id']
            ]
        );
        return true;
    } catch (Exception $e) {
        error_log("Update user error: " . $e->getMessage());
        return false;
    }
}

// ---------------------------------------------
// جلب صلاحيات الدور من جدول role_permission
// ---------------------------------------------
function getRolePermissions($db, int $role_id): array
{
    if (!$db) return [];
    try {
        $rows = $db->Select(
            "SELECT p.name AS permission_name
             FROM role_permission rp
             JOIN permissions p ON rp.permission_id = p.id
             WHERE rp.role_id = :role_id",
            ['role_id' => $role_id]
        );
        return array_column($rows, 'permission_name');
    } catch (Exception $e) {
        error_log("Get permissions error: " . $e->getMessage());
        return [];
    }
}

// ---------------------------------------------
// عملية المصادقة وإنشاء الجلسة
// ---------------------------------------------
function userAuthentication($db, array $auth_data)
{
    $user = getUserByTelegramId($db, $auth_data['id']);
    // منع تسجيل دخول المحظورين
    if ($user && isset($user['is_banned']) && $user['is_banned']) {
        session_unset();
        session_destroy();
        throw new Exception('❌ تم حظرك من الدخول للموقع. إذا كنت تعتقد أن هذا خطأ، تواصل مع الإدارة.');
    }
    $role_id = 6; // افتراضي

    if ($user) {
        updateExistingUser($db, $auth_data);
        $role_id = intval($user['role_id'] ?? 6);
        if ($role_id === 5 && !empty($user['role_expires_at']) && strtotime($user['role_expires_at']) <= time()) {
            $role_id = 6;
            if ($db) {
                try {
                    $db->Update("UPDATE users SET role_id = 6, subscription_period = 'none' WHERE id = :uid", ['uid' => $user['id']]);
                    $db->Update("UPDATE orders SET payment_status = 'expired' WHERE (user_id = :uid OR user_id = :tid) AND payment_status IN ('confirmed', 'completed', 'approved')", [
                        'uid' => strval($user['id']),
                        'tid' => strval($user['telegram_id'])
                    ]);
                    $db->Update("UPDATE enrollments SET status = 'inactive' WHERE (user_id = :uid OR user_id = :tid) AND status = 'active'", [
                        'uid' => strval($user['id']),
                        'tid' => strval($user['telegram_id'])
                    ]);
                } catch (Throwable $e) { error_log('Subscription expiry update failed: ' . $e->getMessage()); }
            }
        }
        $user = getUserByTelegramId($db, $auth_data['id']);
    } else {
        createNewUser($db, $auth_data, $role_id);
        $user = getUserByTelegramId($db, $auth_data['id']);
    }

    $permissions = getRolePermissions($db, $role_id);

    $_SESSION['logged-in']   = true;
    $_SESSION['telegram_id'] = $auth_data['id'];
    $_SESSION['user_id']     = $auth_data['id'];
    $_SESSION['role_id']     = $role_id;
    $_SESSION['permissions'] = $permissions;
    
    // تجديد معرف الجلسة لمنع هجمات تثبيت الجلسة (Session Fixation)
    session_regenerate_id(true);

    $userEmailVal = $user['user_email'] ?? $user['email'] ?? '';
    $userPhoneVal = $user['user_phone'] ?? $user['phone'] ?? '';
    $userGenderVal = $user['user_gender'] ?? $user['gender'] ?? '';

    // تخزين بيانات المستخدم محدثة دائماً وبدون مسح الإيميل والهاتف والجنس
    $userData = [
        'first_name'  => $user['first_name'] ?? $auth_data['first_name'],
        'last_name'   => $user['last_name']  ?? ($auth_data['last_name'] ?? ''),
        'username'    => $auth_data['username']   ?? '',
        'photo_url'   => $auth_data['photo_url']  ?? '',
        'id'          => $auth_data['id'],
        'user_email'  => $userEmailVal,
        'user_phone'  => $userPhoneVal,
        'user_gender' => $userGenderVal,
        'email'       => $userEmailVal,
        'phone'       => $userPhoneVal,
        'gender'      => $userGenderVal
    ];
    
    $_SESSION['user'] = $userData;
    $_SESSION['user_email'] = $userEmailVal;
    $_SESSION['user_phone'] = $userPhoneVal;
    $_SESSION['user_gender'] = $userGenderVal;
    $_SESSION['email'] = $userEmailVal;
    $_SESSION['phone'] = $userPhoneVal;
    $_SESSION['gender'] = $userGenderVal;

    return $userData;
}

// إذا طلبنا auth.php مباشرة بدون معاملات
if ($_SERVER['REQUEST_METHOD'] === 'GET' && empty($_GET)) {
    if (isset($_SESSION['logged-in']) && $_SESSION['logged-in']) {
        sendAuthJson([
            'success' => true,
            'logged_in' => true,
            'user' => $_SESSION['user'] ?? null
        ]);
    } else {
        sendAuthJson(['success' => true, 'logged_in' => false]);
    }
}

// ---------------------------------------------
// إرجاع صلاحيات المستخدم (للاستخدام من قبل JS)
// ---------------------------------------------
if (isset($_GET['get_permissions'])) {
    if (empty($_SESSION['logged-in'])) {
        sendAuthJson(['success' => false, 'error' => 'غير مسجل الدخول']);
    }

    sendAuthJson([
        'success'     => true,
        'permissions' => $_SESSION['permissions'] ?? []
    ]);
}

// ---------------------------------------------
// التحقق من صلاحية محددة (للميدلوير)
// ---------------------------------------------
if (isset($_GET['check_permission'])) {
    $permission = $_GET['check_permission'];

    if (empty($_SESSION['logged-in'])) {
        sendAuthJson([
            'allowed' => false,
            'message' => 'يجب تسجيل الدخول أولاً'
        ]);
    }

    if (!in_array($permission, $_SESSION['permissions'] ?? [])) {
        sendAuthJson([
            'allowed' => false,
            'message' => 'ليس لديك الصلاحية: ' . $permission
        ]);
    }

    sendAuthJson(['allowed' => true]);
}