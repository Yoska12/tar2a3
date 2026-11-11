<?php
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
require_once __DIR__ . '/session_helper.php';
initSession();

$_allowed_origins = ['/','https://www.tarqa.com','https://simulation.tarqa.com','https://exam.tarqa.com','https://tiger.tarqa.com'];
$_origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($_origin, $_allowed_origins, true) || preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#i', $_origin)) {
    header("Access-Control-Allow-Origin: $_origin");
    header("Access-Control-Allow-Credentials: true");
}
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-Requested-With");
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (!isset($_SESSION['logged-in']) || !$_SESSION['logged-in']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'User not logged in.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    try {
        $telegram_id = $_SESSION['telegram_id'];
        $resultsDir = '../../results/' . $telegram_id;
        $result_id_filter = isset($_GET['id']) ? basename($_GET['id']) : null;

        if (!is_dir($resultsDir)) {
            echo json_encode(['success' => true, 'questions' => [], 'parsingErrors' => []]);
            exit;
        }

        function findMistakesInResult($result) {
            $incorrect_questions = [];
            if ($result && !empty($result['details']['questions']) && !empty($result['details']['userAnswers'])) {
                $questions = $result['details']['questions'];
                $userAnswers = $result['details']['userAnswers'];

                $questionsByNum = [];
                foreach($questions as $q) {
                    if(isset($q['question_number'])) {
                        $questionsByNum[(string)$q['question_number']] = $q;
                    }
                }

                foreach ($userAnswers as $qNum => $userAnswerIndex) {
                    if (isset($questionsByNum[(string)$qNum])) {
                        $q = $questionsByNum[(string)$qNum];
                        if (isset($q['id']) && $userAnswerIndex !== null) {
                            $isCorrect = isset($q['answer']) && ($userAnswerIndex == $q['answer']);
                            if (!$isCorrect) {
                                $incorrect_questions[] = $q;
                            }
                        }
                    }
                }
            }
            return $incorrect_questions;
        }

        $all_incorrect_questions = [];
        $parsing_errors = [];

        if ($result_id_filter) {
            $filePath = $resultsDir . '/' . $result_id_filter . '.json';
            if (!file_exists($filePath)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'Result not found.']);
                exit;
            }

            $content = file_get_contents($filePath);
            $result = json_decode($content, true);

            if ($result === null && json_last_error() !== JSON_ERROR_NONE) {
                $parsing_errors[] = ['file' => basename($filePath), 'error' => json_last_error_msg()];
            } else {
                $all_incorrect_questions = findMistakesInResult($result);
            }
        } else {
            $files = glob($resultsDir . '/*.json');
            foreach ($files as $file) {
                $content = file_get_contents($file);
                $result = json_decode($content, true);

                if ($result === null && json_last_error() !== JSON_ERROR_NONE) {
                    $parsing_errors[] = ['file' => basename($file), 'error' => json_last_error_msg()];
                    continue;
                }

                $mistakes = findMistakesInResult($result);
                $all_incorrect_questions = array_merge($all_incorrect_questions, $mistakes);
            }
        }

        $unique_questions_map = [];
        foreach ($all_incorrect_questions as $q) {
            if (isset($q['question'])) {
                $key = md5(trim($q['question']));
                if (!isset($unique_questions_map[$key])) {
                    $unique_questions_map[$key] = $q;
                }
            }
        }
        $unique_questions = array_values($unique_questions_map);

        echo json_encode(['success' => true, 'questions' => $unique_questions, 'parsingErrors' => $parsing_errors]);
        exit;

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Server error: ' . $e->getMessage()]);
        exit;
    }
}
?>