<?php
ini_set('display_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/../session_helper.php';
initSession();

// CORS
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

    if (!isset($input['folderName']) || !isset($input['question'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Folder name and question are required.']);
        exit;
    }

    try {
        $telegram_id = $_SESSION['telegram_id'];
        $folderName = basename($input['folderName']);
        $question = $input['question'];

        $filePath = '../../../folders/' . $telegram_id . '/' . $folderName . '.json';

        if (!file_exists($filePath)) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Folder not found.']);
            exit;
        }

        $content = file_get_contents($filePath);
        $folderData = json_decode($content, true);

        if ($folderData === null) {
             throw new Exception('Failed to parse folder data.');
        }
        
        // Check if question already exists
        $questionExists = false;
        foreach ($folderData['questions'] as $q) {
            if ($q['id'] === $question['id'] && $q['type'] === $question['type']) {
                $questionExists = true;
                break;
            }
        }

        if ($questionExists) {
            // Question already in folder, return success but indicate no change
            echo json_encode(['success' => true, 'message' => 'Question already in folder.', 'data' => $folderData]);
            exit;
        }


        $folderData['questions'][] = $question;

        if (file_put_contents($filePath, json_encode($folderData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception('Failed to save updated folder data.');
        }

        echo json_encode(['success' => true, 'message' => 'Question added to folder.', 'data' => $folderData]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>