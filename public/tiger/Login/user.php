<?php
require_once __DIR__ . '/session_helper.php';
initSession();

if (!isset($_SESSION['logged-in']) || $_SESSION['logged-in'] !== true) {
    die('يرجى تسجيل الدخول أولاً.');
}

function checkPermission($permission) {
    return in_array($permission, $_SESSION['permissions'] ?? []);
}

echo "<h1>مرحباً بك، مستخدم Telegram</h1>";
echo "<p>دورك: " . ($_SESSION['role_id'] ?? 'غير معروف') . "</p>";
echo "<p>صلاحياتك:</p><ul>";

foreach ($_SESSION['permissions'] as $perm) {
    echo "<li>" . htmlspecialchars($perm) . "</li>";
}
echo "</ul>";

// مثال على فحص صلاحية معينة
if (checkPermission('manage_users')) {
    echo "<p>يمكنك إدارة المستخدمين.</p>";
} else {
    echo "<p>ليس لديك صلاحية إدارة المستخدمين.</p>";
}
