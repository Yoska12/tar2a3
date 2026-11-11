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
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

// Preflight request
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

// Handle GET request
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $telegram_id = $_SESSION['telegram_id'];
        $foldersDir = '../../../folders/' . $telegram_id;

        if (!is_dir($foldersDir)) {
            if (!mkdir($foldersDir, 0750, true)) {
                throw new Exception('Failed to create folders directory.');
            }
        }

        $folders = [];
        $files = glob($foldersDir . '/*.json');

        foreach ($files as $file) {
            $content = file_get_contents($file);
            $data = json_decode($content, true);
            if ($data) {
                $folders[$data['name']] = $data;
            }
        }

        echo json_encode(['success' => true, 'folders' => $folders]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>