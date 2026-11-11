<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/../session_helper.php';
initSession();

// CORS headers
$_allowed_origins = ['/','https://tarqa3.net','https://www.tarqa3.net','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
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

    if (!isset($input['oldFolderName']) || empty(trim($input['oldFolderName']))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Old folder name is required.']);
        exit;
    }
    if (!isset($input['newFolderName']) || empty(trim($input['newFolderName']))) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'New folder name is required.']);
        exit;
    }

    try {
        $telegram_id = $_SESSION['telegram_id'];
        
        $oldFolderName = basename(trim($input['oldFolderName']));
        $newFolderName = trim($input['newFolderName']);
        
        // Sanitize newFolderName
        $newFolderName = preg_replace('/[^a-zA-Z0-9\s\-_ء-ي]/u', '', $newFolderName);
        $newFolderName = trim($newFolderName);
        if (empty($newFolderName)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid new folder name.']);
            exit;
        }

        $foldersDir = '../../../folders/' . $telegram_id;
        $oldFilePath = $foldersDir . '/' . $oldFolderName . '.json';
        $newFilePath = $foldersDir . '/' . $newFolderName . '.json';

        if (!file_exists($oldFilePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Source folder not found.']);
            exit;
        }

        if (file_exists($newFilePath) && $oldFolderName !== $newFolderName) {
            http_response_code(409); // Conflict
            echo json_encode(['success' => false, 'error' => 'A folder with the new name already exists.']);
            exit;
        }

        // Read old data
        $content = file_get_contents($oldFilePath);
        $data = json_decode($content, true);
        
        // Update name inside JSON
        $data['name'] = $newFolderName;
        
        // Write to new file
        if (file_put_contents($newFilePath, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception('Failed to save renamed folder data.');
        }

        // Delete old file if names are different
        if ($oldFolderName !== $newFolderName) {
            if (!unlink($oldFilePath)) {
                // If unlink fails, continue
            }
        }

        echo json_encode(['success' => true, 'message' => 'Folder renamed successfully.', 'folder' => $data]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>
