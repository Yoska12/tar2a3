<?php
// MCP (Model Context Protocol) Endpoint for Tarqa Platform (Apache / LiteSpeed / PHP)
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$tools = [
    [
        'name' => 'get_platform_info',
        'description' => 'الحصول على معلومات تفصيلية عن منصة طرقع، المسارات التعليمية، وبنك الأسئلة.',
        'inputSchema' => [
            'type' => 'object',
            'properties' => new stdClass()
        ]
    ],
    [
        'name' => 'search_questions',
        'description' => 'البحث في بنك أسئلة وتجميعات القدرات العامة (حساب، جبر، هندسة، إحصاء، مقارنات).',
        'inputSchema' => [
            'type' => 'object',
            'properties' => [
                'query' => [
                    'type' => 'string',
                    'description' => 'كلمة البحث أو موضوع السؤال'
                ],
                'category' => [
                    'type' => 'string',
                    'enum' => ['arithmetic', 'algebra', 'geometry', 'statistics', 'comparisons', 'all'],
                    'description' => 'القسم أو التصنيف المستهدف'
                ]
            ],
            'required' => ['query']
        ]
    ],
    [
        'name' => 'get_courses_overview',
        'description' => 'استعراض قائمة الأبواب والفصول التدريبية والمذكرات المتاحة في دورة التأسيس.',
        'inputSchema' => [
            'type' => 'object',
            'properties' => new stdClass()
        ]
    ]
];

$raw = file_get_contents('php://input');
$req = json_decode($raw, true) ?: [];
$method = $req['method'] ?? '';
$id = $req['id'] ?? null;

if ($_SERVER['REQUEST_METHOD'] === 'GET' || empty($method)) {
    echo json_encode([
        'jsonrpc' => '2.0',
        'result' => [
            'server' => 'tarqa3-qudurat',
            'version' => '1.0.0',
            'description' => 'منصة طرقع قدرات - خادم بروتوكول سياق النموذج (MCP Server)',
            'status' => 'online',
            'tools' => $tools
        ]
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

switch ($method) {
    case 'initialize':
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'protocolVersion' => '2024-11-05',
                'serverInfo' => [
                    'name' => 'tarqa3-qudurat',
                    'version' => '1.0.0'
                ],
                'capabilities' => [
                    'tools' => ['listChanged' => false]
                ]
            ]
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'tools/list':
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => [
                'tools' => $tools
            ]
        ], JSON_UNESCAPED_UNICODE);
        break;

    case 'ping':
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => new stdClass()
        ]);
        break;

    default:
        http_response_code(200);
        echo json_encode([
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => [
                'code' => -32601,
                'message' => 'Method not found'
            ]
        ], JSON_UNESCAPED_UNICODE);
        break;
}
