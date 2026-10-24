import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function kashierDevApiPlugin(): Plugin {
  const handler = async (req: any, res: any) => {
    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', (chunk: any) => { bodyStr += chunk; });
      req.on('end', async () => {
        try {
          const body = JSON.parse(bodyStr || '{}');
          const { settingsMode, customApiKey, customSecretKey, customMerchantId, ...kashierPayload } = body;
          const mode = settingsMode || process.env.KASHIER_MODE || 'test';
          const merchantId = customMerchantId || process.env.KASHIER_MERCHANT_ID || 'MID-50598-297';
          const apiKey = customApiKey || process.env.KASHIER_API_KEY || '980f3d9b-9782-40a0-ad47-f49ae98fdbb7';
          const secretKey = customSecretKey || process.env.KASHIER_SECRET_KEY || '6ec661c17fe95a9faae76df553f6ecb6$c02d309b502aa7a0f1eb27dbdb37f61f58e17df14f8a04b43ffa526a9e51b2f9281357acae5ca6412eb4ba540b919776';

          const endpoint = mode === 'live'
            ? 'https://api.kashier.io/v3/payment/sessions'
            : 'https://test-api.kashier.io/v3/payment/sessions';

          const finalPayload = {
            ...kashierPayload,
            merchantId,
          };

          const kashierRes = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': secretKey,
              'api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(finalPayload),
          });

          const data = await kashierRes.json();
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = kashierRes.status;
          res.end(JSON.stringify(data));
        } catch (err: any) {
          res.setHeader('Content-Type', 'application/json');
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'Internal Server Error' }));
        }
      });
    } else {
      res.statusCode = 405;
      res.end('Method Not Allowed');
    }
  };

  return {
    name: 'kashier-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/create-kashier-session', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/create-kashier-session', handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), kashierDevApiPlugin()],
  envPrefix: ['VITE_', 'SUPABASE_'],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/lib': path.resolve(__dirname, './src/lib'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 3000,
    cors: true,
  },
});
