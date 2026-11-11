<?php
/**
 * ==============================================================================
 * منصة طرقع - نقطة نهاية خدمة صور الأسئلة الآمنة (Tarqa Simulator Image Loader)
 * ==============================================================================
 */
ini_set('display_errors', 0);
error_reporting(0);

$img = $_GET['img'] ?? '';
if (empty($img)) {
    http_response_code(400);
    exit('Missing image path');
}

// حماية متقدمة ضد Directory Traversal
$cleanImg = str_replace(['..', "\0"], '', $img);
$cleanImg = ltrim($cleanImg, '/\\');

$baseDir = __DIR__;
$candidatePaths = [
    $baseDir . DIRECTORY_SEPARATOR . 'Data' . DIRECTORY_SEPARATOR . $cleanImg,
    $baseDir . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $cleanImg,
    $baseDir . DIRECTORY_SEPARATOR . $cleanImg,
    dirname($baseDir) . DIRECTORY_SEPARATOR . 'mo7aky' . DIRECTORY_SEPARATOR . $cleanImg
];

$filePath = null;
foreach ($candidatePaths as $p) {
    if (file_exists($p) && is_file($p)) {
        $filePath = $p;
        break;
    }
}

if (!$filePath) {
    http_response_code(404);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Image not found');
}

// تحديد MIME Type المناسب
$ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
$mimeMap = [
    'png' => 'image/png',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'webp' => 'image/webp',
    'svg' => 'image/svg+xml',
    'ico' => 'image/x-icon',
    'gif' => 'image/gif'
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

header("Content-Type: {$mime}");
header('Content-Length: ' . filesize($filePath));
header('Cache-Control: public, max-age=86400');
header('Access-Control-Allow-Origin: *');

readfile($filePath);
exit;

