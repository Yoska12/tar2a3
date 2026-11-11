import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

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

function simulatorDevApiPlugin(): Plugin {
  const handleSimulatorRequest = (req: any, res: any, next: any) => {
    let rawUrl = req.url || '';

    // If accessing simulator root path without trailing slash, redirect with 302 to ensure proper relative asset resolution
    if (rawUrl === '/simulation') {
      res.writeHead(302, { Location: '/simulation/' });
      return res.end();
    } else if (rawUrl === '/simulation/') {
      req.url = '/simulation/index.html';
      rawUrl = req.url;
    } else if (rawUrl === '/exam') {
      res.writeHead(302, { Location: '/exam/' });
      return res.end();
    } else if (rawUrl === '/exam/') {
      req.url = '/exam/index.html';
      rawUrl = req.url;
    } else if (rawUrl === '/tiger') {
      res.writeHead(302, { Location: '/tiger/' });
      return res.end();
    } else if (rawUrl === '/tiger/') {
      req.url = '/tiger/index.html';
      rawUrl = req.url;
    }

    // Normalize URL path by stripping any leading /simulation, /exam, /tiger
    const normalizedUrl = rawUrl.replace(/^\/(?:simulation|exam|tiger)/, '');

    // 1. Bank Questions API
    if (normalizedUrl.startsWith('/api_banks.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      
      const searchPath = path.resolve(__dirname, 'public/api/banks/search.json');
      const sharedPath = path.resolve(__dirname, 'mo7aky/shared_questions.json');
      let questions: any[] = [];
      const readSafeJson = (p: string) => {
        try {
          let s = fs.readFileSync(p, 'utf8');
          if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
          return JSON.parse(s);
        } catch { return null; }
      };
      if (fs.existsSync(searchPath)) {
        questions = readSafeJson(searchPath) || [];
      }
      if ((!questions || questions.length === 0) && fs.existsSync(sharedPath)) {
        questions = readSafeJson(sharedPath) || [];
      }

      if (rawUrl.includes('action=get_bank_questions')) {
        return res.end(JSON.stringify({ success: true, count: questions.length, questions }));
      }

      const examsMap: Record<string, number> = {};
      for (const q of questions) {
        const e = (q.exam || '').trim();
        if (e) {
          examsMap[e] = (examsMap[e] || 0) + 1;
        }
      }
      const realExams = Object.keys(examsMap).map(k => ({ name: k, question_count: examsMap[k] }));

      return res.end(JSON.stringify({
        success: true,
        banks: [
          {
            key: 'search',
            name: 'محاكي الطرقعة الشامل',
            question_count: questions.length,
            exams: realExams
          },
          {
            key: 'level_test',
            name: 'اختبار تحديد المستوى',
            question_count: questions.length,
            exams: realExams
          },
          {
            key: 'tiger',
            name: 'محاكي واختبارات نمر',
            question_count: questions.length,
            exams: realExams
          }
        ],
        bank_mapping: { search: 'محاكي الطرقعة الشامل', level_test: 'اختبار تحديد المستوى', tiger: 'محاكي واختبارات نمر' },
        category_mapping: { 'قدرات - كمي': 'search', 'قدرات - لفظي': 'search', 'تحديد مستوى': 'level_test', 'تجميعات نمر': 'tiger' }
      }));
    }

    // 2. Shared Questions API
    if (normalizedUrl.startsWith('/api/shared-questions')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      const sharedPath = path.resolve(__dirname, 'mo7aky/shared_questions.json');
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk: any) => { body += chunk; });
        req.on('end', () => {
          try {
            fs.writeFileSync(sharedPath, body, 'utf8');
            const searchBankPath = path.resolve(__dirname, 'public/api/banks/search.json');
            if (fs.existsSync(path.dirname(searchBankPath))) {
              fs.writeFileSync(searchBankPath, body, 'utf8');
            }
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ success: true }));
          } catch (e: any) {
            res.statusCode = 500;
            return res.end(JSON.stringify({ success: false, error: e.message }));
          }
        });
        return;
      }
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (fs.existsSync(sharedPath)) {
        return res.end(fs.readFileSync(sharedPath, 'utf8'));
      }
      return res.end('[]');
    }

    // 3. Auth Check Session & User Endpoints
    if (normalizedUrl.startsWith('/Login/auth.php') || normalizedUrl.startsWith('/Login/user.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      const devUser = {
        id: '123456789',
        first_name: 'طالب',
        last_name: 'طرقع',
        username: 'tarqa_student',
        role_id: 1,
        role: 'super_admin',
        is_expired: false,
        permissions: ['admin', 'access_simulators', 'access_exams']
      };
      return res.end(JSON.stringify({
        success: true,
        logged_in: true,
        user: devUser,
        role_id: 1,
        role_name: 'Super Admin',
        is_expired: false,
        permissions: ['admin', 'access_simulators', 'access_exams']
      }));
    }

    // 4. Session Sync
    if (normalizedUrl.startsWith('/Login/sync_tarqa_session.php')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', () => {
        let u = null;
        try { u = JSON.parse(body)?.user; } catch {}
        const safeUser = {
          id: u?.id || 'dev_user',
          first_name: u?.full_name?.split(' ')[0] || u?.first_name || 'طالب',
          last_name: u?.full_name?.split(' ').slice(1).join(' ') || u?.last_name || 'طرقع',
          username: u?.email?.split('@')[0] || u?.username || 'tarqa_student',
          email: u?.email || 'student@tarqa.net',
          role_id: 1,
          role: 'super_admin',
          is_expired: false,
          permissions: ['admin', 'access_simulators', 'access_exams']
        };
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({
          success: true,
          logged_in: true,
          user: safeUser,
          role_id: 1,
          role_name: 'Super Admin',
          is_expired: false,
          permissions: ['admin', 'access_simulators', 'access_exams']
        }));
      });
      return;
    }

    // 5. Smart Exam Progress & Reset
    if (normalizedUrl.startsWith('/Login/smart_exam_progress.php') || normalizedUrl.startsWith('/Login/reset_smart_exam_progress.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(JSON.stringify({ success: true, progress: {} }));
    }

    // 6. Folders API
    if (normalizedUrl.startsWith('/Login/folders/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(JSON.stringify({ success: true, folders: [] }));
    }

    // 7. Save Results
    if (normalizedUrl.startsWith('/Login/save_results.php')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      let body = '';
      req.on('data', (chunk: any) => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const userId = data.userId || 'dev_user';
          const resultsDir = path.resolve(__dirname, 'results', String(userId).replace(/[^a-zA-Z0-9_\-]/g, '_'));
          if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
          const id = String(Date.now());
          fs.writeFileSync(path.join(resultsDir, `${id}.json`), JSON.stringify({ id, ...data, created_at: new Date().toISOString() }, null, 2), 'utf8');
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, id }));
        } catch {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, id: Date.now() }));
        }
      });
      return;
    }

    // 8. Get Results & Single Result & Incorrect Questions
    if (normalizedUrl.startsWith('/Login/get_results.php') || normalizedUrl.startsWith('/Login/get_single_result.php') || normalizedUrl.startsWith('/Login/get_incorrect_questions.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      try {
        const resultsBase = path.resolve(__dirname, 'results');
        let results: any[] = [];
        if (fs.existsSync(resultsBase)) {
          const userDirs = fs.readdirSync(resultsBase);
          for (const u of userDirs) {
            const uPath = path.join(resultsBase, u);
            if (fs.statSync(uPath).isDirectory()) {
              const files = fs.readdirSync(uPath).filter((f: string) => f.endsWith('.json'));
              for (const f of files) {
                try {
                  results.push(JSON.parse(fs.readFileSync(path.join(uPath, f), 'utf8')));
                } catch {}
              }
            }
          }
        }
        results.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
        return res.end(JSON.stringify({ success: true, results, questions: [] }));
      } catch {
        return res.end(JSON.stringify({ success: true, results: [], questions: [] }));
      }
    }

    // 9. Clear / Delete Result & Logout
    if (normalizedUrl.startsWith('/Login/clear_all_results.php') || normalizedUrl.startsWith('/Login/delete_result.php') || normalizedUrl.startsWith('/Login/logout.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(JSON.stringify({ success: true }));
    }

    // 10. Question Images
    if (normalizedUrl.startsWith('/get_image.php')) {
      const imgParam = new URL(rawUrl, 'http://localhost:3000').searchParams.get('img') || '';
      const clean = imgParam.replace(/\.\./g, '').replace(/^[\\\/]+/, '');
      const candidate = path.resolve(__dirname, 'public/Data', clean);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return fs.createReadStream(candidate).pipe(res);
      }
      res.statusCode = 404;
      return res.end('Not found');
    }

    // 10.5 Subscriptions API in Local Dev
    if (normalizedUrl.startsWith('/api/subscriptions.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      const subsFile = path.resolve(__dirname, 'public/api/subscriptions_log.json');
      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      if (req.method === 'GET') {
        let subsData: any = { subscriptions: {} };
        if (fs.existsSync(subsFile)) {
          try { subsData = JSON.parse(fs.readFileSync(subsFile, 'utf-8')); } catch {}
        }
        return res.end(JSON.stringify({ success: true, subscriptions: subsData.subscriptions || {}, totalSubscribed: Object.keys(subsData.subscriptions || {}).length }));
      }

      if (req.method === 'POST') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            let subsData: any = { subscriptions: {} };
            if (fs.existsSync(subsFile)) {
              try { subsData = JSON.parse(fs.readFileSync(subsFile, 'utf-8')); } catch {}
            }
            subsData.subscriptions = subsData.subscriptions || {};
            const key = body.userId || body.userEmail;
            if (key) {
              subsData.subscriptions[key] = {
                userId: body.userId,
                userEmail: body.userEmail,
                userName: body.userName,
                isActive: body.action !== 'cancel',
                active: body.action !== 'cancel',
                status: body.action === 'cancel' ? 'cancelled' : 'active',
                expiresDate: new Date(Date.now() + (body.days || 365) * 86400000).toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
            fs.mkdirSync(path.dirname(subsFile), { recursive: true });
            fs.writeFileSync(subsFile, JSON.stringify(subsData, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true, message: 'Subscription saved in dev' }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }
    }

    // 11. Hostinger API (Course Content & Settings Sync in Local Dev)
    if (normalizedUrl.startsWith('/api/hostinger_api.php')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      const urlObj = new URL(rawUrl, 'http://localhost:3000');
      const action = urlObj.searchParams.get('action');
      const backupPath = path.resolve(__dirname, 'public/api/course_content_backup.json');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        return res.end();
      }

      if (action === 'get_users') {
        const subsFile = path.resolve(__dirname, 'public/api/subscriptions_log.json');
        const rcptBackup = path.resolve(__dirname, 'public/api/payment_receipts_backup.json');
        const regBackup = path.resolve(__dirname, 'public/api/registered_users_backup.json');
        let subsData: any = { subscriptions: {} };
        if (fs.existsSync(subsFile)) {
          try { subsData = JSON.parse(fs.readFileSync(subsFile, 'utf-8')); } catch {}
        }
        let rcpts: any[] = [];
        if (fs.existsSync(rcptBackup)) {
          try { rcpts = JSON.parse(fs.readFileSync(rcptBackup, 'utf-8')); } catch {}
        }
        let regUsers: any[] = [];
        if (fs.existsSync(regBackup)) {
          try { regUsers = JSON.parse(fs.readFileSync(regBackup, 'utf-8')); } catch {}
        }
        const userMap = new Map<string, any>();
        for (const ru of regUsers) {
          const id = ru.id || ('usr_' + (ru.email || Date.now()));
          userMap.set(id, {
            id,
            email: ru.email || '',
            fullName: ru.fullName || 'طالب طرقع',
            role: ru.role || 'student',
            targetScore: ru.targetScore || 100,
            telegramUsername: ru.telegramUsername,
            telegramId: ru.telegramId,
            isSubscribed: ru.isSubscribed ? 1 : 0,
            subscriptionExpiresAt: ru.subscriptionExpiresAt,
            isBanned: 0,
            createdAt: ru.createdAt || new Date().toISOString(),
            lastSignInAt: ru.lastSignInAt || new Date().toISOString(),
          });
        }
        for (const [k, s] of Object.entries<any>(subsData.subscriptions || {})) {
          if (s.isActive || s.active || s.status === 'active') {
            const id = s.userId || ('usr_' + k);
            if (userMap.has(id)) {
              userMap.get(id).isSubscribed = 1;
            } else {
              userMap.set(id, {
                id,
                email: s.userEmail || '',
                fullName: s.userName || 'طالب طرقع',
                role: 'student',
                targetScore: 100,
                isSubscribed: 1,
                subscriptionExpiresAt: s.expiresDate || s.expiresAt,
                isBanned: 0,
                createdAt: s.startDate || new Date().toISOString(),
                lastSignInAt: s.updatedAt || new Date().toISOString()
              });
            }
          }
        }
        for (const r of rcpts) {
          if (r.payment_status === 'PAID') {
            const id = r.user_id || ('usr_' + r.order_id);
            if (!userMap.has(id)) {
              userMap.set(id, {
                id,
                email: r.user_email || '',
                fullName: r.user_name || 'طالب طرقع',
                role: 'student',
                targetScore: 100,
                isSubscribed: 1,
                subscriptionExpiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
                isBanned: 0,
                createdAt: r.created_at || new Date().toISOString(),
                lastSignInAt: r.created_at || new Date().toISOString()
              });
            } else {
              const u = userMap.get(id);
              u.isSubscribed = 1;
            }
          }
        }
        return res.end(JSON.stringify({ success: true, users: Array.from(userMap.values()) }));
      }

      if (action === 'register' || action === 'sync_user') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const u = body.user || body;
            const regBackup = path.resolve(__dirname, 'public/api/registered_users_backup.json');
            let regUsers: any[] = [];
            if (fs.existsSync(regBackup)) {
              try { regUsers = JSON.parse(fs.readFileSync(regBackup, 'utf-8')); } catch {}
            }
            const uid = u.id || ('usr_' + Date.now());
            const email = (u.email || '').toLowerCase().trim();
            const existingIdx = regUsers.findIndex((r: any) => r.id === uid || (email && r.email && r.email.toLowerCase() === email));
            const newRecord = {
              id: uid,
              email,
              fullName: u.fullName || u.full_name || 'طالب طرقع',
              role: u.role || 'student',
              targetScore: Number(u.targetScore || u.target_score) || 100,
              telegramUsername: u.telegramUsername,
              telegramId: u.telegramId,
              isSubscribed: Boolean(u.isSubscribed || u.is_subscribed),
              createdAt: new Date().toISOString(),
              lastSignInAt: new Date().toISOString()
            };
            if (existingIdx >= 0) {
              regUsers[existingIdx] = { ...regUsers[existingIdx], ...newRecord };
            } else {
              regUsers.unshift(newRecord);
            }
            fs.mkdirSync(path.dirname(regBackup), { recursive: true });
            fs.writeFileSync(regBackup, JSON.stringify(regUsers, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true, user: newRecord }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      if (action === 'update_subscription') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const subsFile = path.resolve(__dirname, 'public/api/subscriptions_log.json');
            let subsData: any = { subscriptions: {} };
            if (fs.existsSync(subsFile)) {
              try { subsData = JSON.parse(fs.readFileSync(subsFile, 'utf-8')); } catch {}
            }
            subsData.subscriptions = subsData.subscriptions || {};
            const isSub = Boolean(body.is_subscribed);
            const key = body.userId || body.target_user_id || body.email;
            if (key) {
              subsData.subscriptions[key] = {
                userId: body.userId || body.target_user_id,
                userEmail: body.email,
                isActive: isSub,
                active: isSub,
                status: isSub ? 'active' : 'cancelled',
                expiresDate: body.expires_at || new Date(Date.now() + 365 * 86400000).toISOString(),
                updatedAt: new Date().toISOString()
              };
            }
            fs.mkdirSync(path.dirname(subsFile), { recursive: true });
            fs.writeFileSync(subsFile, JSON.stringify(subsData, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true, is_subscribed: isSub, message: 'Subscription updated in dev' }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      if (action === 'save_course_content') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const content = body.content || body;
            const contentJson = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            fs.mkdirSync(path.dirname(backupPath), { recursive: true });
            fs.writeFileSync(backupPath, contentJson, 'utf-8');
            return res.end(JSON.stringify({ success: true, saved_to_db: true, message: 'Saved successfully to local backup' }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      if (action === 'get_course_content') {
        if (fs.existsSync(backupPath)) {
          try {
            const raw = fs.readFileSync(backupPath, 'utf-8');
            const data = JSON.parse(raw);
            return res.end(JSON.stringify({ success: true, content: data, updated_at: new Date().toISOString() }));
          } catch {}
        }
        return res.end(JSON.stringify({ success: true, content: null }));
      }

      // Course Pricing (Get & Update)
      const pricingBackup = path.resolve(__dirname, 'public/api/course_pricing_backup.json');
      if (action === 'get_course_pricing') {
        let pricing: any[] = [];
        if (fs.existsSync(pricingBackup)) {
          try { pricing = JSON.parse(fs.readFileSync(pricingBackup, 'utf-8')); } catch {}
        }
        if (!pricing || pricing.length === 0) {
          pricing = [
            { course_id: 'course-foundation', course_title: 'دورة التأسيس الشاملة للقدرات 🎯', price_sar: 75, price_egp: 1100, is_active: 1 }
          ];
        }
        return res.end(JSON.stringify({ success: true, pricing }));
      }

      if (action === 'update_course_price') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            let pricing: any[] = [];
            if (fs.existsSync(pricingBackup)) {
              try { pricing = JSON.parse(fs.readFileSync(pricingBackup, 'utf-8')); } catch {}
            }
            const foundIdx = pricing.findIndex((p: any) => p.course_id === body.course_id);
            const entry = {
              course_id: body.course_id,
              course_title: body.course_title || '',
              price_sar: Number(body.price_sar) || 75,
              price_egp: Number(body.price_egp) || 1100,
              is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1
            };
            if (foundIdx >= 0) {
              pricing[foundIdx] = { ...pricing[foundIdx], ...entry };
            } else {
              pricing.push(entry);
            }
            fs.mkdirSync(path.dirname(pricingBackup), { recursive: true });
            fs.writeFileSync(pricingBackup, JSON.stringify(pricing, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true, message: 'Price updated in dev' }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      // Promo Codes CRUD & Validation
      const promoBackup = path.resolve(__dirname, 'public/api/promo_codes_backup.json');
      if (action === 'get_promo_codes') {
        let promo_codes: any[] = [];
        if (fs.existsSync(promoBackup)) {
          try { promo_codes = JSON.parse(fs.readFileSync(promoBackup, 'utf-8')); } catch {}
        }
        return res.end(JSON.stringify({ success: true, promo_codes }));
      }

      if (action === 'save_promo_code') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            let codes: any[] = [];
            if (fs.existsSync(promoBackup)) {
              try { codes = JSON.parse(fs.readFileSync(promoBackup, 'utf-8')); } catch {}
            }
            const codeClean = String(body.code || '').toUpperCase().trim();
            const id = body.id || 'promo_' + Date.now();
            const foundIdx = codes.findIndex((c: any) => c.id === id || c.code === codeClean);
            const entry = {
              id,
              code: codeClean,
              discount_type: body.discount_type === 'fixed' ? 'fixed' : 'percentage',
              discount_value: Number(body.discount_value) || 10,
              course_id: body.course_id || null,
              max_uses: Number(body.max_uses) || 0,
              used_count: body.used_count || 0,
              is_active: body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
              expires_at: body.expires_at || null,
              created_at: new Date().toISOString()
            };
            if (foundIdx >= 0) {
              codes[foundIdx] = { ...codes[foundIdx], ...entry };
            } else {
              codes.unshift(entry);
            }
            fs.mkdirSync(path.dirname(promoBackup), { recursive: true });
            fs.writeFileSync(promoBackup, JSON.stringify(codes, null, 2), 'utf-8');
            return res.end(JSON.stringify({ success: true, message: 'Promo code saved in dev' }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      if (action === 'delete_promo_code') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          const body = JSON.parse(bodyStr || '{}');
          const target = body.id || body.code || urlObj.searchParams.get('id') || '';
          if (fs.existsSync(promoBackup)) {
            try {
              let codes = JSON.parse(fs.readFileSync(promoBackup, 'utf-8'));
              codes = codes.filter((c: any) => c.id !== target && c.code !== target.toUpperCase());
              fs.writeFileSync(promoBackup, JSON.stringify(codes, null, 2), 'utf-8');
            } catch {}
          }
          return res.end(JSON.stringify({ success: true, message: 'Deleted' }));
        });
        return;
      }

      if (action === 'validate_promo_code') {
        const code = (urlObj.searchParams.get('code') || '').toUpperCase().trim();
        const courseId = urlObj.searchParams.get('course_id') || 'course-foundation';
        const currency = (urlObj.searchParams.get('currency') || 'SAR').toUpperCase();

        let originalPrice = currency === 'EGP' ? 1100 : 75;
        if (fs.existsSync(pricingBackup)) {
          try {
            const pList = JSON.parse(fs.readFileSync(pricingBackup, 'utf-8'));
            const found = pList.find((p: any) => p.course_id === courseId);
            if (found) {
              originalPrice = currency === 'EGP' ? Number(found.price_egp) : Number(found.price_sar);
            }
          } catch {}
        }

        let promo: any = null;
        if (fs.existsSync(promoBackup)) {
          try {
            const codes = JSON.parse(fs.readFileSync(promoBackup, 'utf-8'));
            promo = codes.find((c: any) => c.code === code && c.is_active);
          } catch {}
        }

        if (!promo) {
          return res.end(JSON.stringify({ success: false, valid: false, message: 'كود الخصم غير موجود أو معطل' }));
        }

        if (promo.course_id && promo.course_id !== courseId && promo.course_id !== 'all') {
          return res.end(JSON.stringify({ success: false, valid: false, message: 'هذا الكود غير مخصص لهذه الدورة' }));
        }

        let discountAmount = 0;
        if (promo.discount_type === 'percentage') {
          discountAmount = Math.round((originalPrice * promo.discount_value) / 100);
        } else {
          discountAmount = Math.min(originalPrice, promo.discount_value);
        }
        const finalPrice = Math.max(0, originalPrice - discountAmount);

        return res.end(JSON.stringify({
          success: true,
          valid: true,
          code,
          discount_type: promo.discount_type,
          discount_value: promo.discount_value,
          original_price: originalPrice,
          discount_amount: discountAmount,
          final_price: finalPrice,
          currency,
          course_id: courseId,
          message: `تم تطبيق الخصم بنجاح! توفير ${discountAmount} ${currency}`
        }));
      }

      // Confirm Payment & Receipts
      const rcptBackup = path.resolve(__dirname, 'public/api/payment_receipts_backup.json');
      if (action === 'confirm_course_payment') {
        let bodyStr = '';
        req.on('data', (chunk: any) => { bodyStr += chunk; });
        req.on('end', () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const orderId = body.order_id || ('TARQA_' + Date.now());
            const courseId = body.course_id || 'course-foundation';
            const courseTitle = body.course_title || 'دورة قدرات';
            const userName = body.user_name || 'طالب طرقع';
            const userEmail = body.user_email || 'student@tarqa.app';
            const userPhone = body.user_phone || '';
            const currency = body.currency || 'SAR';
            let originalPrice = Number(body.original_price) || (currency === 'EGP' ? 1100 : 75);
            let discountAmount = Number(body.discount_amount) || 0;
            const promoCode = (body.promo_code || '').toUpperCase().trim();
            const paymentMethod = body.payment_method || 'kashier';

            if (promoCode && discountAmount === 0 && fs.existsSync(promoBackup)) {
              try {
                const codes = JSON.parse(fs.readFileSync(promoBackup, 'utf-8'));
                const matched = codes.find((c: any) => c.code === promoCode && (c.is_active === 1 || c.is_active === true));
                if (matched) {
                  if (matched.discount_type === 'percentage') {
                    discountAmount = Math.round((originalPrice * Number(matched.discount_value)) / 100);
                  } else {
                    discountAmount = Math.min(originalPrice, Number(matched.discount_value));
                  }
                  matched.used_count = (matched.used_count || 0) + 1;
                  fs.writeFileSync(promoBackup, JSON.stringify(codes, null, 2), 'utf-8');
                }
              } catch {}
            }

            const finalPrice = Math.max(0, originalPrice - discountAmount);

            const receipt = {
              id: 'rcpt_' + Date.now(),
              order_id: orderId,
              user_id: body.user_id || 'usr_guest',
              user_name: userName,
              user_email: userEmail,
              user_phone: userPhone,
              course_id: courseId,
              course_title: courseTitle,
              original_price: originalPrice,
              discount_amount: discountAmount,
              final_price: finalPrice,
              currency,
              promo_code: promoCode,
              payment_method: paymentMethod,
              payment_status: 'PAID',
              created_at: new Date().toISOString()
            };

            let allRcpts: any[] = [];
            if (fs.existsSync(rcptBackup)) {
              try { allRcpts = JSON.parse(fs.readFileSync(rcptBackup, 'utf-8')); } catch {}
            }
            allRcpts.unshift(receipt);
            fs.mkdirSync(path.dirname(rcptBackup), { recursive: true });
            fs.writeFileSync(rcptBackup, JSON.stringify(allRcpts, null, 2), 'utf-8');

            const waText = encodeURIComponent(
              `🧾 إيصال دفع وتفعيل دورة جديد - منصة طرقع 🚀\n` +
              `رقم الفاتورة: ${orderId}\n` +
              `الطالب: ${userName}\n` +
              `الدورة: ${courseTitle}\n` +
              `المبلغ: ${finalPrice} ${currency}\n` +
              (promoCode ? `كود الخصم: ${promoCode}\n` : '') +
              `طريقة الدفع: ${paymentMethod}\n` +
              `التاريخ: ${new Date().toLocaleString('ar-SA')}`
            );
            const whatsappUrl = `https://api.whatsapp.com/send?phone=966500000000&text=${waText}`;

            return res.end(JSON.stringify({
              success: true,
              message: 'تم تفعيل الدورة وتسجيل الإيصال بنجاح',
              receipt,
              whatsapp_url: whatsappUrl
            }));
          } catch (e: any) {
            return res.end(JSON.stringify({ success: false, error: e?.message }));
          }
        });
        return;
      }

      if (action === 'get_payment_receipts') {
        let receipts: any[] = [];
        if (fs.existsSync(rcptBackup)) {
          try { receipts = JSON.parse(fs.readFileSync(rcptBackup, 'utf-8')); } catch {}
        }
        return res.end(JSON.stringify({ success: true, receipts }));
      }

      if (action === 'get_receipt_settings') {
        return res.end(JSON.stringify({
          success: true,
          settings: { admin_whatsapp: '966500000000', admin_email: 'tarqa.qudurat@gmail.com' }
        }));
      }

      if (action === 'save_receipt_settings') {
        return res.end(JSON.stringify({ success: true, message: 'Settings saved' }));
      }

      if (action === 'ping' || action === 'status') {
        return res.end(JSON.stringify({ success: true, backend: 'Vite Dev Mock Hostinger API', timestamp: new Date().toISOString() }));
      }
    }

    next();
  };

  return {
    name: 'simulator-dev-api',
    configureServer(server) {
      server.middlewares.use(handleSimulatorRequest);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handleSimulatorRequest);
    },
  };
}

export default defineConfig({
  plugins: [react(), kashierDevApiPlugin(), simulatorDevApiPlugin()],
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
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-icons': ['lucide-react'],
          'vendor-katex': ['katex'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
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
