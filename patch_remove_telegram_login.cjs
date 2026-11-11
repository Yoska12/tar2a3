const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const baseDir = __dirname;
console.log('=== Step 1: Patching StartScreen.jsx in all 3 simulators to remove Telegram login and bind to platform DB ===');

const simProjects = [
  { name: 'tarqa', dir: path.join(baseDir, 'mo7aky_extracted/tarqa'), target: 'simulation' },
  { name: 'level_test', dir: path.join(baseDir, 'mo7aky_extracted/level_test'), target: 'exam' },
  { name: 'tiger', dir: path.join(baseDir, 'mo7aky_extracted/tiger'), target: 'tiger' }
];

for (const p of simProjects) {
  const ssPath = path.join(p.dir, 'src/components/StartScreen.jsx');
  if (!fs.existsSync(ssPath)) continue;

  let code = fs.readFileSync(ssPath, 'utf8');

  // 1. Remove TelegramLoginWidget component definition
  code = code.replace(
    /\/\/ Telegram Login Widget Component[\s\S]*?const TelegramLoginWidget =[\s\S]*?\};\s*(?=\n\n|\nconst|\nfunction|\nexport)/m,
    '// Telegram Login Widget completely removed - bound to platform database\nconst TelegramLoginWidget = () => null;\n'
  );

  // 2. Replace sessionCheck inside initializeApp to bind directly to platform localStorage and MySQL backend
  const newSessionCheck = `      const sessionCheck = async () => {
        let platformUser = null;
        try {
          const raw = localStorage.getItem('tarqa_current_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && (parsed.id || parsed.email || parsed.username || parsed.name)) {
              platformUser = parsed;
            }
          }
        } catch (e) {}

        const email = (platformUser?.email || '').toLowerCase();
        const role = platformUser?.role || 'student';
        const isManager = ['admin', 'super_admin', 'teacher'].includes(role) || 
                          ['tarqa3@gmail.com', 'yassooooo27m@gmail.com'].includes(email);

        const unifiedUser = {
          id: platformUser?.id || 'tarqa_' + Math.random().toString(36).substring(2, 9),
          first_name: platformUser?.name || platformUser?.first_name || (email ? email.split('@')[0] : 'طالب طرقع'),
          last_name: platformUser?.last_name || '',
          username: platformUser?.username || (email ? email.split('@')[0] : 'tarqa_student'),
          email: email,
          user_email: email,
          photo_url: platformUser?.photo_url || platformUser?.avatar || 'https://i.ibb.co/tMMyJj2y/icon.jpg',
          role: isManager ? 'admin' : 'member',
          role_id: isManager ? 1 : 5,
          is_subscribed: true,
          is_expired: false,
          permissions: ['access_simulators', 'access_exams', 'access_level_test', 'member', 'admin']
        };

        try {
          fetch('/Login/sync_tarqa_session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user: unifiedUser })
          }).catch(() => {});
        } catch (e) {}

        setUser(unifiedUser);
        setIsAuthorized(true);
        return unifiedUser;
      };`;

  // Replace sessionCheck function
  code = code.replace(
    /const sessionCheck = async \(\) => \{[\s\S]*?return null;\s*\};/m,
    newSessionCheck
  );

  // 3. Remove "if (!banks || !Array.isArray(banks) || banks.length === 0) { ... setUser(null) ... }"
  code = code.replace(
    /if \(!banks \|\| !Array\.isArray\(banks\) \|\| banks\.length === 0\) \{[\s\S]*?console\.info\('Dev Bypass active: Continuing despite unauthenticated remote question banks\.'\);\s*\}/m,
    '// Auto-authorized via platform session'
  );

  // 4. Remove the blocking "if (!user) { ... }" block
  code = code.replace(
    /if \(!user\) \{[\s\S]*?return \([\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}/m,
    '// Login gate removed - automatically bound to website user session'
  );

  // 5. Remove the blocking "if (!isAuthorized) { ... }" block
  code = code.replace(
    /if \(!isAuthorized\) \{[\s\S]*?return \([\s\S]*?<\/div>\s*<\/div>\s*\);\s*\}/m,
    '// Authorization gate removed - automatically permitted via platform subscription'
  );

  // 6. Fix handleLogout to redirect to platform home '/'
  code = code.replace(
    /const handleLogout = useCallback\(async \(\) => \{[\s\S]*?window\.location\.reload\(\);\s*\}, \[setUser\]\);/m,
    `const handleLogout = useCallback(async () => {
    try {
      await fetch('/Login/logout.php', { credentials: 'include' });
    } catch (e) {}
    window.location.href = '/';
  }, []);`
  );

  fs.writeFileSync(ssPath, code, 'utf8');
  console.log(`[OK] Successfully patched StartScreen.jsx for ${p.name}`);
}

console.log('=== Step 2: Rebuilding all 3 simulators with Vite ===');

const nodeModulesSource = path.join(baseDir, 'mo7aky/محاكي الطرقعة backend/node_modules');
const viteBin = path.join(nodeModulesSource, 'vite/bin/vite.js');

for (const p of simProjects) {
  console.log(`Building ${p.name}...`);
  execSync('node "' + viteBin + '" build', {
    cwd: p.dir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
}

console.log('=== Step 3: Deploying built simulators to public and dist ===');

const assets = ['blue.png', 'green.png', 'orange.png', 'logo1.png', 'Watermark.png', 'Watermark1.png', 'favicon1.ico'];

for (const p of simProjects) {
  const distDir = path.join(p.dir, 'dist');
  const publicTarget = path.join(baseDir, 'public', p.target);
  const distTarget = path.join(baseDir, 'dist', p.target);

  // Find generated JS and CSS
  const assetsDir = path.join(distDir, 'assets');
  let jsFile = '';
  let cssFile = '';
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    jsFile = files.find(f => f.startsWith('index-') && f.endsWith('.js')) || '';
    cssFile = files.find(f => f.startsWith('index-') && f.endsWith('.css')) || '';
  }

  // Copy dist to publicTarget
  fs.cpSync(distDir, publicTarget, { recursive: true });
  // Copy dist to distTarget
  fs.cpSync(distDir, distTarget, { recursive: true });

  // Update dual-mode index.html in both locations
  const simTitles = {
    tarqa: 'محاكي الطرقعة الشامل',
    level_test: 'اختبار تحديد مستوى الطرقعة',
    tiger: 'محاكي واختبارات نمر'
  };

  const dualModeHtml = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <base href="/${p.target}/">
  <meta charset="UTF-8" />
  <link rel="icon" type="image/x-icon" href="/favicon1.ico" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${simTitles[p.name]} - منصة طرقع</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
    .locked-screen {
      background: radial-gradient(circle at 50% 20%, #151d30 0%, #080c16 100%);
      color: #fff;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
    }
    .locked-card {
      background: rgba(13, 19, 34, 0.95);
      border: 2px solid rgba(245, 158, 11, 0.4);
      border-radius: 28px;
      padding: 40px 28px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(245, 158, 11, 0.2);
      color: #fcd34d;
      border: 1px solid rgba(245, 158, 11, 0.4);
      padding: 6px 16px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 800;
    }
    .icon {
      font-size: 52px;
      width: 86px;
      height: 86px;
      background: rgba(245, 158, 11, 0.15);
      border: 2px solid rgba(245, 158, 11, 0.4);
      border-radius: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    h1 { font-size: 24px; font-weight: 900; color: #fff; }
    p { font-size: 14px; color: #94a3b8; line-height: 1.7; }
    .btn {
      display: inline-block;
      width: 100%;
      padding: 13px 20px;
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: #020617;
      text-decoration: none;
      font-weight: 900;
      font-size: 14px;
      border-radius: 14px;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
    }
    .btn:hover { transform: translateY(-2px); }
    .btn-admin {
      background: rgba(255, 255, 255, 0.08);
      color: #cbd5e1;
      border: 1px solid rgba(255, 255, 255, 0.15);
      margin-top: 6px;
    }
    .btn-admin:hover { background: rgba(255, 255, 255, 0.15); color: #fff; }
  </style>

  <script>
    (function() {
      var isAdmin = false;
      try {
        var params = new URLSearchParams(window.location.search);
        var hash = (window.location.hash || '').toLowerCase();
        if (
          params.get('admin') === 'true' || 
          params.get('admin') === 'questions' || 
          params.get('questions') === 'true' || 
          params.get('dev_bypass') === 'true' ||
          hash.includes('admin') ||
          hash.includes('questions')
        ) {
          isAdmin = true;
        }

        var rawUser = localStorage.getItem('tarqa_current_user');
        if (rawUser) {
          var u = JSON.parse(rawUser);
          if (
            u && (
              u.role === 'admin' || 
              u.role === 'super_admin' || 
              u.role === 'teacher' || 
              (u.email && u.email.toLowerCase() === 'yassooooo27m@gmail.com')
            )
          ) {
            isAdmin = true;
          }
        }

        if (localStorage.getItem('dev_bypass') === 'true') {
          isAdmin = true;
        }
      } catch (e) {}

      window.__IS_ADMIN__ = isAdmin;
      window.__SIMULATOR_JS__ = './assets/${jsFile}';
      window.__SIMULATOR_CSS__ = './assets/${cssFile}';
    })();
  </script>
</head>
<body>
  <div id="root"></div>

  <div id="lockedView" class="locked-screen" style="display: none;">
    <div class="locked-card">
      <div class="icon">⏳</div>
      <div class="badge">🔒 مقفول للطلاب - قيد التحديث</div>
      <h1>${simTitles[p.name]}</h1>
      <p>
        المحاكي تحت التحديث الشامل وتجهيز أحدث نماذج قياس الرسمية 1446-1447. سيتوفر قريباً لجميع الطلاب!
      </p>
      <a href="/" class="btn">الرجوع إلى منصة طرقع الرئيسية ⚡</a>
      <button class="btn btn-admin" onclick="promptAdminUnlock()">دخول المشرفين والمعلمين 🛡️</button>
    </div>
  </div>

  <script>
    function promptAdminUnlock() {
      var pass = prompt('أدخل كلمة مرور المسؤول للدخول:');
      if (pass === 'tarqa2026' || pass === 'admin' || pass === 'yasso') {
        localStorage.setItem('dev_bypass', 'true');
        window.location.search = '?admin=true';
      } else if (pass) {
        alert('كلمة المرور غير صحيحة');
      }
    }

    if (window.__IS_ADMIN__) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.crossOrigin = '';
      link.href = window.__SIMULATOR_CSS__;
      document.head.appendChild(link);

      var script = document.createElement('script');
      script.type = 'module';
      script.crossOrigin = '';
      script.src = window.__SIMULATOR_JS__;
      document.body.appendChild(script);
    } else {
      document.getElementById('lockedView').style.display = 'flex';
      var rootEl = document.getElementById('root');
      if (rootEl) rootEl.style.display = 'none';
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(publicTarget, 'index.html'), dualModeHtml, 'utf8');
  fs.writeFileSync(path.join(distTarget, 'index.html'), dualModeHtml, 'utf8');

  // Copy images
  for (const asset of assets) {
    const srcAsset = path.join(baseDir, 'public', asset);
    if (fs.existsSync(srcAsset)) {
      try {
        fs.copyFileSync(srcAsset, path.join(publicTarget, asset));
        fs.copyFileSync(srcAsset, path.join(distTarget, asset));
        const assetsSubPub = path.join(publicTarget, 'assets');
        const assetsSubDist = path.join(distTarget, 'assets');
        if (fs.existsSync(assetsSubPub)) fs.copyFileSync(srcAsset, path.join(assetsSubPub, asset));
        if (fs.existsSync(assetsSubDist)) fs.copyFileSync(srcAsset, path.join(assetsSubDist, asset));
      } catch (e) {}
    }
  }
  console.log(`[OK] Deployed ${p.name}`);
}

console.log('=== All Simulators Rebuilt and Deployed! ===');

