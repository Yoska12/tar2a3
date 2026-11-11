<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/session_helper.php';
initSession();

// Set CORS headers
$_allowed_origins = ['/','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowed_origins, true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_origin)) {
    header("Access-Control-Allow-Origin: $_origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User not authenticated.']);
    exit;
}

$userId = $_SESSION['telegram_id'];
$dataDir = __DIR__ . '/../../smart_exam_data';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$progressFile = $dataDir . '/' . $userId . '.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($progressFile)) {
        $progress = json_decode(file_get_contents($progressFile), true);
        echo json_encode(['success' => true, 'answeredQuestions' => $progress]);
    } else {
        echo json_encode(['success' => true, 'answeredQuestions' => []]);
    }
} elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (isset($data['answeredQuestions']) && is_array($data['answeredQuestions'])) {
        $newProgress = $data['answeredQuestions'];
        
        // Handle deduplication for objects (or strings)
        // We serialize to JSON to check uniqueness, then decode back
        $serialized = array_map(function($item) {
            return json_encode($item, JSON_UNESCAPED_UNICODE);
        }, $newProgress);
        
        $uniqueSerialized = array_unique($serialized);
        
        $finalProgress = array_map(function($item) {
            return json_decode($item, true);
        }, array_values($uniqueSerialized));
        
        if (file_put_contents($progressFile, json_encode($finalProgress, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
             http_response_code(500);
             echo json_encode(['success' => false, 'error' => 'Failed to save progress file.']);
             exit;
        }
        
        echo json_encode(['success' => true]);
    } else {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid data.']);
    }
} else {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Invalid request method.']);
}
?>