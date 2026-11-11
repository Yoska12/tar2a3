const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projects = [
  { name: 'tarqa', dir: 'mo7aky_extracted/tarqa', target: 'public/simulation' },
  { name: 'level_test', dir: 'mo7aky_extracted/level_test', target: 'public/exam' },
  { name: 'tiger', dir: 'mo7aky_extracted/tiger', target: 'public/tiger' }
];

const themeDockContent = `import React, { useState } from 'react';
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
            title: 'محاكي الطرقعة (الأزرق)',
            image: '/blue.png',
            glowColor: 'blue',
            url: '/simulation/',
            selected: currentTheme === 'blue',
        },
        {
            id: 'محاكي نمر',
            title: 'محاكي نمر (الأخضر)',
            image: '/green.png',
            glowColor: 'green',
            url: '/tiger/',
            selected: currentTheme === 'green',
        },
        {
            id: 'تحديد المستوى',
            title: 'تحديد المستوى (البرتقالي)',
            image: '/orange.png',
            glowColor: 'orange',
            url: '/exam/',
            selected: currentTheme === 'orange',
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
            boxShadow: \`0 0 16px \${c.glow}, 0 0 24px \${c.glowOuter}\`,
            borderColor: c.border,
            borderWidth: '2px',
            borderRadius: '9999px',
        };
    };

    return (
        <>
            <style>{\`
                @keyframes selectedGlow {
                    0%, 100% { transform: scale(1.08); filter: brightness(1.1); }
                    50% { transform: scale(1.15); filter: brightness(1.25); }
                }
                .selected-theme-btn { animation: selectedGlow 2s ease-in-out infinite; }
            \`}</style>

            {/* Mobile Version - Vertical */}
            <div className="md:hidden relative flex flex-col items-center">
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="bg-white/10 backdrop-blur-md border border-white/30 shadow-xl px-2.5 py-2.5 cursor-pointer select-none transition-all duration-300 hover:bg-white/25 rounded-full"
                    title="التنقل بين المحاكيات"
                >
                    <ChevronDown className={\`h-5 w-5 text-cyan-400 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
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
                            <img src={theme.image} alt={theme.title} className="w-8 h-8 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        </a>
                    ))}
                </div>
            </div>

            {/* Desktop Version - Horizontal with zero text overlap */}
            <div className="hidden md:block bg-slate-900/90 backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300 hover:bg-slate-900/95 rounded-2xl min-w-[320px]">
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer select-none hover:text-white"
                >
                    <span className="text-slate-100 font-bold text-sm whitespace-nowrap">التنقل بين المحاكيات ⚡</span>
                    <ChevronDown className={\`h-4 w-4 text-cyan-400 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
                </div>

                <div className={\`transition-all duration-300 ease-in-out \${isOpen ? 'max-h-48 opacity-100 py-3 border-t border-white/10' : 'max-h-0 opacity-0 py-0 pointer-events-none overflow-hidden'}\`}>
                    <div className="grid grid-cols-3 gap-2 px-3">
                        {themes.map((theme) => (
                            <a
                                key={theme.id}
                                href={theme.url}
                                className={\`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl transition-all duration-200 cursor-pointer \${theme.selected ? 'bg-white/15 border border-cyan-400/50 shadow-md scale-105' : 'hover:bg-white/10 opacity-80 hover:opacity-100'}\`}
                                title={theme.title}
                            >
                                <div className="w-10 h-10 flex items-center justify-center">
                                    <img src={theme.image} alt={theme.title} className="w-9 h-9 object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                                </div>
                                <span className={\`text-[11px] font-bold text-center leading-tight \${theme.selected ? 'text-white' : 'text-slate-300'}\`}>
                                    {theme.id}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};

export default ThemeDock;
`;

for (const p of projects) {
  console.log(`Processing ${p.name}...`);
  
  // 1. ThemeDock.jsx
  const tdPath = path.join(p.dir, 'src/components/ThemeDock.jsx');
  fs.writeFileSync(tdPath, themeDockContent, 'utf8');
  console.log(`Updated ThemeDock in ${p.name}`);

  // 2. App.jsx: Add direct URL support for ?questions=true or #questions
  const appPath = path.join(p.dir, 'src/App.jsx');
  let appCode = fs.readFileSync(appPath, 'utf8');
  if (!appCode.includes('checkQuestionManager')) {
    appCode = appCode.replace('viewingQuestionsManager,', 'viewingQuestionsManager,\n    showQuestionsManager,');
    const effectHook = `
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkQuestionManager = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = (window.location.hash || '').toLowerCase();
        if (
          urlParams.get('questions') === 'true' ||
          urlParams.get('manage_questions') === '1' ||
          urlParams.get('admin') === 'questions' ||
          hash === '#questions' ||
          hash === '#manage-questions' ||
          hash === '#admin-questions'
        ) {
          showQuestionsManager();
        }
      };
      checkQuestionManager();
      window.addEventListener('hashchange', checkQuestionManager);
      return () => window.removeEventListener('hashchange', checkQuestionManager);
    }
  }, [showQuestionsManager]);
`;
    appCode = appCode.replace('function App() {', 'function App() {' + effectHook);
    fs.writeFileSync(appPath, appCode, 'utf8');
    console.log(`Added direct question manager URL support in ${p.name}`);
  }

  // 3. StartScreen.jsx: Add prominent "إدارة الأسئلة 📝" button at top
  const ssPath = path.join(p.dir, 'src/components/StartScreen.jsx');
  let ssCode = fs.readFileSync(ssPath, 'utf8');
  if (!ssCode.includes('title="إدارة بنك أسئلة المحاكي"')) {
    // Ensure FileText is imported
    if (!ssCode.includes('FileText')) {
      ssCode = ssCode.replace("from 'lucide-react';", "FileText,\n} from 'lucide-react';");
    }
    
    // Add button next to "الصفحة الرئيسية"
    const searchTarget = '<span>الصفحة الرئيسية</span>\n              </Button>';
    const searchTargetAlt = '<span>الصفحة الرئيسية</span>\r\n              </Button>';
    const buttonHtml = `

              {/* زر إدارة الأسئلة المباشر في أعلى المحاكي */}
              <Button
                variant=""
                className="absolute top-3 right-28 sm:top-6 sm:right-48 text-amber-300 hover:bg-amber-500/25 bg-amber-500/15 backdrop-blur-sm border border-amber-500/40 px-3 py-2 sm:px-5 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer flex items-center gap-1.5 font-bold text-xs sm:text-base z-30"
                onClick={showQuestionsManager}
                title="إدارة بنك أسئلة المحاكي"
              >
                <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-amber-400" />
                <span>إدارة الأسئلة 📝</span>
              </Button>`;

    if (ssCode.includes(searchTarget)) {
      ssCode = ssCode.replace(searchTarget, searchTarget + buttonHtml);
    } else if (ssCode.includes(searchTargetAlt)) {
      ssCode = ssCode.replace(searchTargetAlt, searchTargetAlt + buttonHtml);
    } else {
      console.log('Notice: HomePage button search string varied, searching by Home...');
      ssCode = ssCode.replace(/<Home className=[^>]+>[\s\S]*?<\/Button>/, (match) => match + buttonHtml);
    }
    fs.writeFileSync(ssPath, ssCode, 'utf8');
    console.log(`Added prominent Questions button to StartScreen in ${p.name}`);
  }

  // 4. Build project with vite
  console.log(`Building ${p.name}...`);
  try {
    execSync('npm run build', { cwd: p.dir, stdio: 'inherit' });
    console.log(`Build succeeded for ${p.name}!`);

    // 5. Copy dist files to destination in public
    const distDir = path.join(p.dir, 'dist');
    const targetDir = p.target;
    if (fs.existsSync(distDir)) {
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const item of fs.readdirSync(src)) {
          const s = path.join(src, item);
          const d = path.join(dest, item);
          if (fs.statSync(s).isDirectory()) {
            copyRecursive(s, d);
          } else {
            fs.copyFileSync(s, d);
          }
        }
      };
      copyRecursive(distDir, targetDir);
      console.log(`Copied ${p.name} dist to ${targetDir}`);
    }
  } catch (err) {
    console.error(`Build failed for ${p.name}:`, err.message);
  }
}

console.log('All patches and builds complete!');

