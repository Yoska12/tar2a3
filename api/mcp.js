// MCP (Model Context Protocol) Endpoint for Tarqa Platform (Vercel Serverless Function)
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const tools = [
    {
      name: 'get_platform_info',
      description: 'الحصول على معلومات تفصيلية عن منصة طرقع، المسارات التعليمية، وبنك الأسئلة.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'search_questions',
      description: 'البحث في بنك أسئلة وتجميعات القدرات العامة (حساب، جبر، هندسة، إحصاء، مقارنات).',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'كلمة البحث أو موضوع السؤال'
          },
          category: {
            type: 'string',
            enum: ['arithmetic', 'algebra', 'geometry', 'statistics', 'comparisons', 'all'],
            description: 'القسم أو التصنيف المستهدف'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'get_courses_overview',
      description: 'استعراض قائمة الأبواب والفصول التدريبية والمذكرات المتاحة في دورة التأسيس.',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  ];

  if (req.method === 'GET' || !req.body?.method) {
    return res.status(200).json({
      jsonrpc: '2.0',
      result: {
        server: 'tarqa3-qudurat',
        version: '1.0.0',
        description: 'منصة طرقع قدرات - خادم بروتوكول سياق النموذج (MCP Server)',
        status: 'online',
        tools
      }
    });
  }

  const { method, id } = req.body;

  switch (method) {
    case 'initialize':
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          serverInfo: {
            name: 'tarqa3-qudurat',
            version: '1.0.0'
          },
          capabilities: {
            tools: { listChanged: false }
          }
        }
      });

    case 'tools/list':
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {
          tools
        }
      });

    case 'ping':
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        result: {}
      });

    default:
      return res.status(200).json({
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      });
  }
}
