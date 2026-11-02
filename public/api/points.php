<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية نظام النقاط والمستويات (Points & Leaderboard Backend)
 * Tarqa Platform - Backend Points & Leaderboard Service
 * ==============================================================================
 * يدير نقاط الطالب (XP) ويحفظها في قاعدة بيانات السيرفر بدقة:
 * 1. مرتبطة بحساب الطالب (ID والإيميل) وليس بجهاز التصفح أو الكوكيز.
 * 2. متزامنة مع لوحة المتصدرين وقاعدة البيانات.
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
$dataFile = $baseDir . DIRECTORY_SEPARATOR . 'points_db.json';

function readPointsDb($filePath) {
    if (!file_exists($filePath)) {
        return ['users' => []];
    }
    $content = @file_get_contents($filePath);
    if (!$content) {
        return ['users' => []];
    }
    $data = @json_decode($content, true);
    if (!is_array($data)) {
        return ['users' => []];
    }
    if (!isset($data['users'])) $data['users'] = [];
    return $data;
}

function writePointsDb($filePath, $data) {
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

// 1. طلب GET: جلب نقاط مستخدم أو قائمة المتصدرين
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $db = readPointsDb($dataFile);
    $userParam = isset($_GET['user']) ? trim($_GET['user']) : (isset($_GET['userId']) ? trim($_GET['userId']) : (isset($_GET['email']) ? trim($_GET['email']) : ''));
    $action = isset($_GET['action']) ? trim($_GET['action']) : '';

    if ($action === 'leaderboard') {
        $leaderboard = [];
        foreach ($db['users'] as $uKey => $uData) {
            $leaderboard[] = [
                'id' => isset($uData['userId']) ? $uData['userId'] : $uKey,
                'email' => isset($uData['userEmail']) ? $uData['userEmail'] : '',
                'name' => isset($uData['userName']) ? $uData['userName'] : 'طالب طرقع',
                'points' => isset($uData['points']) ? intval($uData['points']) : 0,
            ];
        }
        usort($leaderboard, function($a, $b) {
            return $b['points'] - $a['points'];
        });
        echo json_encode([
            'success' => true,
            'leaderboard' => $leaderboard,
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!empty($userParam)) {
        $lowerUser = strtolower($userParam);
        $userRecord = null;
        if (isset($db['users'][$userParam])) {
            $userRecord = $db['users'][$userParam];
        } else if (isset($db['users'][$lowerUser])) {
            $userRecord = $db['users'][$lowerUser];
        } else {
            foreach ($db['users'] as $k => $u) {
                if (
                    (isset($u['userId']) && $u['userId'] === $userParam) ||
                    (isset($u['userEmail']) && strtolower($u['userEmail']) === $lowerUser)
                ) {
                    $userRecord = $u;
                    break;
                }
            }
        }

        echo json_encode([
            'success' => true,
            'points' => $userRecord ? intval($userRecord['points']) : 0,
            'history' => ($userRecord && isset($userRecord['history'])) ? $userRecord['history'] : [],
            'timestamp' => date('c')
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode([
        'success' => true,
        'usersCount' => count($db['users']),
        'users' => $db['users'],
        'timestamp' => date('c')
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. طلب POST: إضافة أو تصفير نقاط
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!$payload || !is_array($payload)) {
        $payload = $_POST;
    }

    $userId    = !empty($payload['userId']) ? trim($payload['userId']) : '';
    $userEmail = !empty($payload['userEmail']) ? strtolower(trim($payload['userEmail'])) : (!empty($payload['email']) ? strtolower(trim($payload['email'])) : '');
    $userName  = !empty($payload['userName']) ? trim($payload['userName']) : 'طالب طرقع';
    $action    = !empty($payload['action']) ? trim($payload['action']) : 'add';
    $amount    = isset($payload['amount']) ? intval($payload['amount']) : 0;
    $reason    = !empty($payload['reason']) ? trim($payload['reason']) : 'إضافة نقاط';
    $category  = !empty($payload['category']) ? trim($payload['category']) : 'bonus';

    $primaryKey = !empty($userId) ? $userId : $userEmail;

    if (empty($primaryKey)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'User ID or Email is required'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $db = readPointsDb($dataFile);
    $existing = isset($db['users'][$primaryKey]) ? $db['users'][$primaryKey] : (isset($db['users'][$userEmail]) ? $db['users'][$userEmail] : null);

    $currentPts = ($existing && isset($existing['points'])) ? intval($existing['points']) : 0;
    $currentHistory = ($existing && isset($existing['history'])) ? $existing['history'] : [];

    if ($action === 'reset') {
        $newPts = 0;
        $currentHistory = [];
    } else if ($action === 'set') {
        $newPts = max(0, isset($payload['points']) ? intval($payload['points']) : $amount);
    } else {
        $newPts = max(0, $currentPts + max(0, $amount));
    }

    $now = date('c');
    $tx = [
        'id' => 'tx-' . round(microtime(true) * 1000),
        'amount' => $action === 'reset' ? 0 : $amount,
        'reason' => $reason,
        'category' => $category,
        'timestamp' => $now,
    ];

    if ($action !== 'reset') {
        array_unshift($currentHistory, $tx);
        $currentHistory = array_slice($currentHistory, 0, 50);
    }

    $record = [
        'userId' => !empty($userId) ? $userId : ($existing ? $existing['userId'] : 'usr-' . time()),
        'userEmail' => !empty($userEmail) ? $userEmail : ($existing ? $existing['userEmail'] : ''),
        'userName' => $userName,
        'points' => $newPts,
        'history' => $currentHistory,
        'updatedAt' => $now,
    ];

    $db['users'][$primaryKey] = $record;
    if (!empty($userEmail)) {
        $db['users'][$userEmail] = $record;
    }

    writePointsDb($dataFile, $db);

    echo json_encode([
        'success' => true,
        'points' => $newPts,
        'transaction' => $tx,
        'timestamp' => $now,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'message' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
exit;
