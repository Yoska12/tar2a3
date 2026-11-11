import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

function sharedQuestionsPlugin() {
  const sharedFilePath = path.resolve(__dirname, '../shared_questions.json');
  return {
    name: 'shared-questions-api',
    configureServer(server) {
      server.middlewares.use('/api/shared-questions', (req, res, next) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          try {
            if (fs.existsSync(sharedFilePath)) {
              const data = fs.readFileSync(sharedFilePath, 'utf8');
              res.end(data || '[]');
            } else {
              res.end('[]');
            }
          } catch (e) {
            res.end('[]');
          }
        } else if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              fs.writeFileSync(sharedFilePath, JSON.stringify(parsed, null, 2), 'utf8');
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: true, count: Array.isArray(parsed) ? parsed.length : 0 }));
            } catch (err) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), sharedQuestionsPlugin()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    proxy: {
      '/Login': {
        target: 'https://alaqsam.net',
        changeOrigin: true,
        secure: false,
      },
      '/api_banks.php': {
        target: 'https://alaqsam.net',
        changeOrigin: true,
        secure: false,
      },
      '/get_image.php': {
        target: 'https://alaqsam.net',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
