<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/../session_helper.php';
initSession();

// CORS headers
$_allowed_origins = ['/','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowed_origins, true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_origin)) {
    header("Access-Control-Allow-Origin: $_origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

// Preflight
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Check login
if (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User not logged in.']);
    exit;
}

// Handle POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);

    if (!isset($input['folderName']) || empty(trim($input['folderName']))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Folder name is required.']);
        exit;
    }

    try {
        $telegram_id = $_SESSION['telegram_id'];
        $folderName = trim($input['folderName']);
        // Sanitize folderName to prevent directory traversal and invalid characters
        $folderName = preg_replace('/[^a-zA-Z0-9\s\-_ء-ي]/u', '', $folderName);
        if (empty($folderName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid folder name.']);
            exit;
        }


        $foldersDir = '../../../folders/' . $telegram_id;

        if (!is_dir($foldersDir)) {
            if (!mkdir($foldersDir, 0750, true)) {
                throw new Exception('Failed to create folders directory.');
            }
        }

        $filePath = $foldersDir . '/' . $folderName . '.json';

        if (file_exists($filePath)) {
            http_response_code(409); // Conflict
            echo json_encode(['success' => false, 'error' => 'Folder already exists.']);
            exit;
        }

        $folderData = [
            'name' => $folderName,
            'questions' => []
        ];

        if (file_put_contents($filePath, json_encode($folderData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception('Failed to create folder file.');
        }

        echo json_encode(['success' => true, 'message' => 'Folder created successfully.', 'folder' => $folderData]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>