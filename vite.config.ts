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
          const apiKey = customApiKey || process.env.KASHIER_API_KEY || '';
          // ⚠️ المفتاح السري من السيرفر فقط – لا نضع fallback hardcoded هنا
          const secretKey = customSecretKey || process.env.KASHIER_SECRET_KEY || '';

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
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          // مكتبات React الأساسية
          'vendor-react': ['react', 'react-dom'],
          // Supabase
          'vendor-supabase': ['@supabase/supabase-js'],
          // Lucide Icons
          'vendor-icons': ['lucide-react'],
          // KaTeX للمعادلات
          'vendor-katex': ['katex'],
          // مكتبات النماذج والتحقق
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // Google Genai
          'vendor-genai': ['@google/genai'],
        },
      },
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
