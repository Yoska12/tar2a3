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
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Check if user is logged in
if (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User not logged in.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $telegram_id = $_SESSION['telegram_id'];
        $resultsDir = '../../results/' . $telegram_id;

        if (is_dir($resultsDir)) {
            $files = glob($resultsDir . '/*.json');
            $deletedCount = 0;
            foreach ($files as $file) {
                if (is_file($file)) {
                    unlink($file);
                    $deletedCount++;
                }
            }
            echo json_encode(['success' => true, 'message' => 'All results deleted successfully.', 'deletedCount' => $deletedCount]);
        } else {
            echo json_encode(['success' => true, 'message' => 'No results found to delete.', 'deletedCount' => 0]);
        }
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>