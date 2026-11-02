import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// PWA Service Worker Registration
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Service Worker registration failed:', err);
    });
  });
}

// Runtime WebMCP Tool Registration
function registerWebMCPTools() {
  if (typeof navigator !== 'undefined') {
    if (!(navigator as any).modelContext) {
      const toolList: any[] = [];
      try {
        Object.defineProperty(navigator, 'modelContext', {
          value: {
            registerTool: (t: any) => { toolList.push(t); return t; },
            tools: toolList
          },
          writable: true,
          configurable: true
        });
      } catch (e) {
        (navigator as any).modelContext = {
          registerTool: (t: any) => { toolList.push(t); return t; },
          tools: toolList
        };
      }
    }

    if ((navigator as any).modelContext && typeof (navigator as any).modelContext.registerTool === 'function') {
      try {
        (navigator as any).modelContext.registerTool({
          name: 'get_platform_info',
          description: 'معلومات تفصيلية عن منصة طرقع لتدريب القدرات العامة (القسم الكمي)',
          inputSchema: { type: 'object', properties: {} },
          execute: async () => ({
            name: 'منصة طرقع للقدرات',
            url: 'https://tarqa3.net/',
            description: 'أقوى منصة تدريب تفاعلية لاختبار القدرات العامة (القسم الكمي) ومحاكي قياس.',
            support: 'https://t.me/tr23km',
            email: 'tarqa3k@gmail.com',
            phone: '+201104687320'
          })
        });

        (navigator as any).modelContext.registerTool({
          name: 'search_questions',
          description: 'ابحث في بنك أسئلة وتجميعات اختبار القدرات العامة (القسم الكمي)',
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'كلمة البحث أو موضوع المسألة' }
            },
            required: ['query']
          },
          execute: async (params: any) => ({
            query: params?.query || '',
            status: 'success',
            url: 'https://tarqa3.net/?q=' + encodeURIComponent(params?.query || '')
          })
        });
      } catch (e) {
        console.warn('[WebMCP] Runtime registration warning:', e);
      }
    }
  }
}

if (typeof window !== 'undefined') {
  registerWebMCPTools();
  window.addEventListener('load', registerWebMCPTools);
}
