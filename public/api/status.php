<?php
/**
 * ==============================================================================
 * منصة طرقع - فحص صحة وجاهزية استضافة هوستينجر للتخزين ورفع الملفات
 * Tarqa Platform - Hostinger Storage Health & Upload Limits Status
 * ==============================================================================
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$baseDir = dirname(__DIR__);
$uploadsDir = $baseDir . DIRECTORY_SEPARATOR . 'uploads';

if (!is_dir($uploadsDir)) {
    @mkdir($uploadsDir, 0755, true);
}

$isWritable = is_writable($uploadsDir);
$diskFree = function_exists('disk_free_space') ? disk_free_space($baseDir) : null;
$diskTotal = function_exists('disk_total_space') ? disk_total_space($baseDir) : null;

function formatBytes($bytes, $precision = 2) {
    if ($bytes === null || $bytes === false) return 'غير متاح';
    $units = ['B', 'KB', 'MB', 'GB', 'TB'];
    $bytes = max($bytes, 0);
    $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
    $pow = min($pow, count($units) - 1);
    $bytes /= pow(1024, $pow);
    return round($bytes, $precision) . ' ' . $units[$pow];
}

echo json_encode([
    'status' => 'operational',
    'provider' => 'Hostinger',
    'timestamp' => date('c'),
    'php_version' => PHP_VERSION,
    'uploads_directory' => [
        'path' => $uploadsDir,
        'exists' => is_dir($uploadsDir),
        'writable' => $isWritable,
    ],
    'php_limits' => [
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size'),
        'memory_limit' => ini_get('memory_limit'),
        'max_execution_time' => ini_get('max_execution_time') . 's',
    ],
    'disk_space' => [
        'free' => formatBytes($diskFree),
        'total' => formatBytes($diskTotal),
    ],
    'features' => [
        'direct_uploads' => true,
        'supabase_storage_disabled' => true,
        'cors_enabled' => true,
        'mobile_download_headers' => true
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
