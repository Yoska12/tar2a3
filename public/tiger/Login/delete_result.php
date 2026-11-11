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

// Handle POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['id'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input data. Result ID is missing.']);
        exit;
    }

    try {
		$telegram_id = $_SESSION['telegram_id'];
        $result_id = $input['id'];
        
        // Sanitize the result_id to prevent directory traversal attacks
        $result_id = basename($result_id);

        $filePath = '../../results/' . $telegram_id . '/' . $result_id . '.json';

        if (file_exists($filePath)) {
            if (unlink($filePath)) {
                echo json_encode(['success' => true, 'message' => 'Result deleted successfully.']);
            } else {
                throw new Exception('Failed to delete result file.');
            }
        } else {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Result not found.']);
        }
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>