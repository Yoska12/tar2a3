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
          description: 'معلومات تفصيلية عن منصة طرقع لدورات وتأسيس القدرات العامة (القسم الكمي)',
          inputSchema: { type: 'object', properties: {} },
          execute: async () => ({
            name: 'منصة طرقع للقدرات',
            url: 'https://tarqa3.net/',
            description: 'أقوى منصة تدريب وشروحات تفاعلية لاختبار القدرات العامة (القسم الكمي) ودورات التأسيس الذكية.',
            support: 'https://t.me/tr23km',
            email: 'tarqa3k@gmail.com',
            phone: '+201104687320'
          })
        });

        (navigator as any).modelContext.registerTool({
          name: 'get_courses_info',
          description: 'استعلام عن دورات ومحاضرات تأسيس القدرات العامة (القسم الكمي) في منصة طرقع',
          inputSchema: { type: 'object', properties: {} },
          execute: async () => ({
            status: 'success',
            coursesUrl: 'https://tarqa3.net/#courses',
            description: 'دورات تأسيس شاملة للقدرات الكمي مع استراتيجيات الحل الذهني السريع.'
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
