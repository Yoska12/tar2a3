<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/session_helper.php';
initSession();

// Set CORS headers
$_allowed_origins = ['/','https://tarqa3.net','https://www.tarqa3.net','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
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

$input = json_decode(file_get_contents('php://input'), true) ?: [];

// Check if user is logged in or provided userId
$userId = $_SESSION['telegram_id'] ?? $_SESSION['user_id'] ?? $input['userId'] ?? $input['user_id'] ?? null;
if (!$userId && (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User not logged in.']);
    exit;
}

// Handle POST request
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!$input) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid input data.']);
        exit;
    }

    try {
        $telegram_id = $userId ?: 'guest';
        $baseDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'results';
        if (!is_dir($baseDir)) {
            @mkdir($baseDir, 0755, true);
        }
        $resultsDir = $baseDir . DIRECTORY_SEPARATOR . preg_replace('/[^a-zA-Z0-9_\-]/', '_', $telegram_id);

        if (!is_dir($resultsDir)) {
            if (!mkdir($resultsDir, 0755, true)) {
                throw new Exception('Failed to create results directory.');
            }
        }

        $id = uniqid();
        $exam_name = $input['examName'] ?? 'Unknown Exam';
        $total_questions = $input['totalQuestions'] ?? 0;
        $correct_answers = $input['correctAnswers'] ?? 0;
        $incorrect_answers = $input['incorrectAnswers'] ?? 0;
        $unanswered_questions = $input['unansweredQuestions'] ?? 0;
        $score_percentage = $input['percentage'] ?? 0;
        $time_taken_seconds = $input['timeTaken'] ?? null;
        $details = $input['details'] ?? null;
        $created_at = date('Y-m-d H:i:s');

        $result_data = [
            'id' => $id,
            'exam_name' => $exam_name,
            'exam' => $input['details']['exam'] ?? $exam_name,
            'type' => $input['details']['type'] ?? null,
            'total_questions' => $total_questions,
            'correct_answers' => $correct_answers,
            'incorrect_answers' => $incorrect_answers,
            'unanswered_questions' => $unanswered_questions,
            'score_percentage' => $score_percentage,
            'time_taken_seconds' => $time_taken_seconds,
            'details' => $details,
            'created_at' => $created_at
        ];

        $filename = $resultsDir . '/' . $id . '.json';
        if (file_put_contents($filename, json_encode($result_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)) === false) {
            throw new Exception('Failed to save result file.');
        }

        echo json_encode(['success' => true, 'message' => 'Results saved successfully.', 'id' => $id]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>