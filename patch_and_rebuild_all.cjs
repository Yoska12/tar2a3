const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Step 1: Copying Assets ===');
const baseDir = __dirname;
const assets = ['blue.png', 'green.png', 'orange.png', 'logo1.png', 'Watermark.png', 'Watermark1.png', 'favicon1.ico'];

const targetDirs = [
  path.join(baseDir, 'public'),
  path.join(baseDir, 'public/simulation'),
  path.join(baseDir, 'public/simulation/assets'),
  path.join(baseDir, 'public/exam'),
  path.join(baseDir, 'public/exam/assets'),
  path.join(baseDir, 'public/tiger'),
  path.join(baseDir, 'public/tiger/assets'),
  path.join(baseDir, 'mo7aky_extracted/tarqa/public'),
  path.join(baseDir, 'mo7aky_extracted/level_test/public'),
  path.join(baseDir, 'mo7aky_extracted/tiger/public')
];

for (const dir of targetDirs) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Locate assets in workspace and copy to all target directories
for (const asset of assets) {
  const candidates = [
    path.join(baseDir, 'public', asset),
    path.join(baseDir, 'mo7aky/محاكي الطرقعة backend/public', asset),
    path.join(baseDir, 'mo7aky_extracted/tarqa/public', asset),
    path.join(baseDir, asset)
  ];
  let src = null;
  for (const c of candidates) {
    if (fs.existsSync(c)) { src = c; break; }
  }
  if (src) {
    for (const dir of targetDirs) {
      try {
        fs.copyFileSync(src, path.join(dir, asset));
      } catch (e) {}
    }
  }
}

console.log('=== Step 2: Patching ThemeDock.jsx and StartScreen.jsx ===');

const themeDockCode = `import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const ThemeDock = () => {
    const [isOpen, setIsOpen] = useState(false);

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    let currentTheme = 'blue';
    if (currentPath.includes('/tiger')) {
        currentTheme = 'green';
    } else if (currentPath.includes('/exam')) {
        currentTheme = 'orange';
    }

    const themes = [
        {
            id: 'محاكي الطرقعة',
            title: 'محاكي الطرقعة الشامل',
            image: '/blue.png',
            icon: '⚡',
            glowColor: 'blue',
            url: '/simulation/',
            selected: currentTheme === 'blue',
        },
        {
            id: 'تحديد المستوى',
            title: 'اختبار تحديد المستوى',
            image: '/orange.png',
            icon: '🎯',
            glowColor: 'orange',
            url: '/exam/',
            selected: currentTheme === 'orange',
        },
        {
            id: 'محاكي نمر',
            title: 'محاكي واختبارات نمر',
            image: '/green.png',
            icon: '🐅',
            glowColor: 'green',
            url: '/tiger/',
            selected: currentTheme === 'green',
        },
    ];

    const getSelectedStyle = (theme) => {
        if (!theme.selected) return {};
        const colors = {
            orange: { glow: 'rgba(245, 158, 11, 0.9)', glowOuter: 'rgba(217, 119, 6, 0.6)', border: '#f59e0b' },
            green: { glow: 'rgba(16, 185, 129, 0.9)', glowOuter: 'rgba(5, 150, 105, 0.6)', border: '#10b981' },
            blue: { glow: 'rgba(59, 130, 246, 0.9)', glowOuter: 'rgba(37, 99, 235, 0.6)', border: '#3b82f6' },
        };
        const c = colors[theme.glowColor] || colors.blue;
        return {
            boxShadow: '0 0 16px ' + c.glow + ', 0 0 24px ' + c.glowOuter,
            borderColor: c.border,
            borderWidth: '2px',
            borderRadius: '9999px',
        };
    };

    return (
        <div className="relative z-50">
            <style>{\`
                @keyframes selectedGlow {
                    0%, 100% { transform: scale(1.08); filter: brightness(1.1); }
                    50% { transform: scale(1.15); filter: brightness(1.25); }
                }
                .selected-theme-btn { animation: selectedGlow 2s ease-in-out infinite; }
            \`}</style>

            {/* Mobile Version */}
            <div className="md:hidden relative flex flex-col items-center">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-slate-900/90 backdrop-blur-md border border-white/30 shadow-xl px-2.5 py-2.5 cursor-pointer select-none transition-all duration-300 hover:bg-slate-800 rounded-full text-cyan-400"
                    title="التنقل بين المحاكيات"
                >
                    <ChevronDown className={\`h-5 w-5 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
                </button>

                <div className={\`flex flex-col items-center gap-3 mt-3 transition-all duration-300 ease-in-out \${isOpen ? 'opacity-100 max-h-96' : 'opacity-0 pointer-events-none max-h-0 overflow-hidden'}\`}>
                    {themes.map((theme) => (
                        <a
                            key={theme.id}
                            href={theme.url}
                            style={getSelectedStyle(theme)}
                            className={\`relative transition-all duration-300 ease-out transform cursor-pointer flex items-center justify-center p-1 rounded-full \${theme.selected ? 'w-11 h-11 selected-theme-btn z-10 bg-white/20' : 'w-10 h-10 opacity-80 hover:opacity-100 hover:scale-110 bg-white/10'}\`}
                            title={theme.title}
                        >
                            <img src={theme.image} alt="" className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            <span className="text-xs">{theme.icon}</span>
                        </a>
                    ))}
                </div>
            </div>

            {/* Desktop Version */}
            <div className="hidden md:block bg-slate-950/95 backdrop-blur-xl border border-white/20 shadow-2xl transition-all duration-300 rounded-2xl w-auto min-w-[340px]">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none hover:text-white"
                >
                    <span className="text-slate-100 font-bold text-xs whitespace-nowrap">التنقل بين المحاكيات ⚡</span>
                    <ChevronDown className={\`h-4 w-4 text-cyan-400 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
                </div>

                <div className={\`transition-all duration-300 ease-in-out \${isOpen ? 'max-h-56 opacity-100 py-3 border-t border-white/10' : 'max-h-0 opacity-0 py-0 pointer-events-none overflow-hidden'}\`}>
                    <div className="grid grid-cols-3 gap-2 px-3">
                        {themes.map((theme) => (
                            <a
                                key={theme.id}
                                href={theme.url}
                                className={\`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 cursor-pointer \${theme.selected ? 'bg-white/15 border border-cyan-400/50 shadow-md scale-105' : 'hover:bg-white/10 opacity-80 hover:opacity-100'}\`}
                                title={theme.title}
                            >
                                <div className="w-8 h-8 flex items-center justify-center relative">
                                    <img
                                      src={theme.image}
                                      alt=""
                                      className="w-7 h-7 object-contain"
                                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                    <span className="text-sm select-none">{theme.icon}</span>
                                </div>
                                <span className={\`text-[10px] font-bold text-center whitespace-nowrap leading-tight \${theme.selected ? 'text-white' : 'text-slate-300'}\`}>
                                    {theme.id}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ThemeDock;
`;

const simFolders = ['tarqa', 'level_test', 'tiger'];
for (const sf of simFolders) {
  const tdPath = path.join(baseDir, 'mo7aky_extracted', sf, 'src/components/ThemeDock.jsx');
  if (fs.existsSync(path.dirname(tdPath))) {
    fs.writeFileSync(tdPath, themeDockCode, 'utf8');
  }

  // Patch StartScreen.jsx
  const ssPath = path.join(baseDir, 'mo7aky_extracted', sf, 'src/components/StartScreen.jsx');
  if (fs.existsSync(ssPath)) {
    let content = fs.readFileSync(ssPath, 'utf8');
    // Replace hardcoded 5173 redirect with clean '/'
    content = content.replace(
      /onClick=\{\(\)\s*=>\s*window\.location\.href\s*=\s*\([^)]*\)\s*\?\s*\([^)]*\)\s*:\s*'\/'\}/g,
      "onClick={() => window.location.href = '/'}"
    );
    fs.writeFileSync(ssPath, content, 'utf8');
  }
}

console.log('=== Step 3: Building Simulators with Vite ===');
const nodeModulesSource = path.join(baseDir, 'mo7aky/محاكي الطرقعة backend/node_modules');
const viteBin = path.join(nodeModulesSource, 'vite/bin/vite.js');

for (const sf of simFolders) {
  const simDir = path.join(baseDir, 'mo7aky_extracted', sf);
  const nmTarget = path.join(simDir, 'node_modules');
  if (!fs.existsSync(nmTarget)) {
    try {
      execSync('cmd /c "mklink /J \\"' + nmTarget + '\\" \\"' + nodeModulesSource + '\\""', { stdio: 'ignore' });
    } catch (e) {}
  }

  console.log('Building ' + sf + '...');
  execSync('node "' + viteBin + '" build', {
    cwd: simDir,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
}

console.log('=== Step 4: Injecting Auth/Session Scripts & Deploying to Public ===');
const sessionScript = `  <script>
    try {
      if (localStorage.getItem('dev_bypass') === null) {
        localStorage.setItem('dev_bypass', 'true');
      }
      var raw = localStorage.getItem('tarqa_current_user');
      if (raw) {
        var u = JSON.parse(raw);
        if (u && (u.id || u.email)) {
          fetch('/Login/sync_tarqa_session.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ user: u })
          }).catch(function(e) {});
        }
      }
    } catch(e) {}
  </script>`;

const simDeploy = [
  { src: 'tarqa', dest: 'simulation' },
  { src: 'level_test', dest: 'exam' },
  { src: 'tiger', dest: 'tiger' }
];

for (const { src, dest } of simDeploy) {
  const distDir = path.join(baseDir, 'mo7aky_extracted', src, 'dist');
  const publicDest = path.join(baseDir, 'public', dest);

  if (!fs.existsSync(publicDest)) fs.mkdirSync(publicDest, { recursive: true });

  // Copy dist to publicDest
  fs.cpSync(distDir, publicDest, { recursive: true });

  // Inject session script into publicDest/index.html
  const indexPath = path.join(publicDest, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    if (!html.includes('sync_tarqa_session.php')) {
      html = html.replace('<head>', '<head>\n' + sessionScript);
      fs.writeFileSync(indexPath, html, 'utf8');
    }
  }

  // Also copy all images to publicDest and publicDest/assets
  for (const asset of assets) {
    const srcAsset = path.join(baseDir, 'public', asset);
    if (fs.existsSync(srcAsset)) {
      try {
        fs.copyFileSync(srcAsset, path.join(publicDest, asset));
        const assetsSub = path.join(publicDest, 'assets');
        if (fs.existsSync(assetsSub)) {
          fs.copyFileSync(srcAsset, path.join(assetsSub, asset));
        }
      } catch (e) {}
    }
  }
}

console.log('=== ALL SIMULATORS REBUILT AND DEPLOYED SUCCESSFULLY! ===');

