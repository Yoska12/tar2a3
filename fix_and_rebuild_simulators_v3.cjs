const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== [Step 1] Updating ThemeDock.jsx across simulators ===');

const themeDockCode = (accentColor, badgeBorder, activeBg, activeText) => `import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Zap, Target, Flame } from 'lucide-react';

const ThemeDock = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    let currentTheme = 'blue';
    if (currentPath.includes('/tiger')) {
        currentTheme = 'green';
    } else if (currentPath.includes('/exam')) {
        currentTheme = 'orange';
    }

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const themes = [
        {
            id: 'tarqa',
            label: 'محاكي الطرقعة',
            subtitle: 'المحاكي الشامل',
            badgeBg: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-300',
            url: '/simulation/?admin=true',
            selected: currentTheme === 'blue',
            icon: Zap
        },
        {
            id: 'exam',
            label: 'تحديد المستوى',
            subtitle: 'تشخيص القدرات',
            badgeBg: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
            url: '/exam/?admin=true',
            selected: currentTheme === 'orange',
            icon: Target
        },
        {
            id: 'tiger',
            label: 'محاكي نمر',
            subtitle: 'نماذج وتجميعات',
            badgeBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300',
            url: '/tiger/?admin=true',
            selected: currentTheme === 'green',
            icon: Flame
        },
    ];

    return (
        <div className="relative font-cairo z-40" dir="rtl" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 shadow-md transition-all cursor-pointer text-xs sm:text-sm font-bold"
                title="التنقل بين المحاكيات الثلاثة"
            >
                <span className="w-2 h-2 rounded-full ${accentColor} animate-pulse" />
                <span className="hidden sm:inline">التنقل بين المحاكيات</span>
                <span className="sm:hidden">المحاكيات</span>
                <ChevronDown className={\`h-4 w-4 transition-transform duration-300 \${isOpen ? 'rotate-180' : ''}\`} />
            </button>

            {isOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 min-w-[210px] bg-slate-950/95 backdrop-blur-2xl border border-slate-700/80 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-150"
                >
                    {themes.map((t) => {
                        const IconComponent = t.icon;
                        return (
                            <a
                                key={t.id}
                                href={t.url}
                                onClick={() => setIsOpen(false)}
                                className={\`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all cursor-pointer border \${
                                    t.selected
                                        ? '${activeBg} ${badgeBorder} shadow-lg'
                                        : 'border-transparent hover:bg-white/5 hover:border-slate-700'
                                }\`}
                            >
                                <div className={\`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 \${t.badgeBg}\`}>
                                    <IconComponent className="w-4 h-4" />
                                </div>
                                <div className="flex flex-col text-right leading-none">
                                    <span className={\`text-xs font-black \${t.selected ? 'text-white' : 'text-slate-200'}\`}>
                                        {t.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 mt-1">
                                        {t.subtitle}
                                    </span>
                                </div>
                                {t.selected && (
                                    <span className="mr-auto text-[10px] font-bold px-1.5 py-0.5 rounded ${activeBg} ${activeText}">
                                        نشط
                                    </span>
                                )}
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ThemeDock;
`;

const simConfigs = [
    { dir: 'mo7aky_extracted/tarqa', accent: 'bg-cyan-400', border: 'border-cyan-400/60', bg: 'bg-cyan-500/20', text: 'text-cyan-300' },
    { dir: 'mo7aky_extracted/level_test', accent: 'bg-amber-400', border: 'border-amber-400/60', bg: 'bg-amber-500/20', text: 'text-amber-300' },
    { dir: 'mo7aky_extracted/tiger', accent: 'bg-emerald-400', border: 'border-emerald-400/60', bg: 'bg-emerald-500/20', text: 'text-emerald-300' }
];

simConfigs.forEach(cfg => {
    const dockPath = path.join(__dirname, cfg.dir, 'src/components/ThemeDock.jsx');
    if (fs.existsSync(dockPath)) {
        fs.writeFileSync(dockPath, themeDockCode(cfg.accent, cfg.border, cfg.bg, cfg.text), 'utf8');
        console.log('✓ Updated ThemeDock in', cfg.dir);
    }
});

console.log('\n=== [Step 2] Updating StartScreen.jsx across simulators ===');

simConfigs.forEach(cfg => {
    const startScreenPath = path.join(__dirname, cfg.dir, 'src/components/StartScreen.jsx');
    if (!fs.existsSync(startScreenPath)) return;

    let content = fs.readFileSync(startScreenPath, 'utf8');

    // 1. Fix loadSavedSettings default selectedQuestionType
    content = content.replace(
        /selectedQuestionType:\s*['"]analogy['"]/g,
        "selectedQuestionType: 'search'"
    );

    // 2. Fix initializeApp to auto-select first category and first test
    const oldInitCategories = /const allCategories = getAvailableCategories\(\);[\s\S]*?setCategories\(filteredCategories\);[\s\S]*?setLoading\(false\);/;
    const newInitCategories = `const allCategories = getAvailableCategories();
      const filteredCategories = allCategories.filter(cat => {
        if (cat.key === 'unreleased') {
          const roleId = parseInt(currentUser?.role_id);
          return [1, 2, 3].includes(roleId);
        }
        return true;
      });
      setCategories(filteredCategories);
      setLoading(false);

      if (filteredCategories.length > 0) {
        let currentSaved = null;
        try {
          const s = localStorage.getItem('examSettings');
          if (s) currentSaved = JSON.parse(s)?.selectedQuestionType;
        } catch(e) {}

        const validCat = filteredCategories.find(c => c.key === currentSaved) || filteredCategories.find(c => c.key === 'search') || filteredCategories[0];
        const activeKey = validCat.key;
        updateSetting('selectedQuestionType', activeKey);

        const availableExams = getAvailableExams(activeKey);
        setTestsForCategory(availableExams);
        if (availableExams && availableExams.length > 0) {
          setSelectedTest(availableExams[0].name);
          setSelectedTests([availableExams[0].name]);
          startPreloadingSelectedTests([availableExams[0].name], activeKey);
        }
      }`;

    if (oldInitCategories.test(content)) {
        content = content.replace(oldInitCategories, newInitCategories);
        console.log('✓ Updated category auto-selection in', cfg.dir);
    }

    // 3. Fix handleCategorySelect to also auto-select first exam
    const oldHandleCategory = /const handleCategorySelect = \(categoryKey\) => \{[\s\S]*?setIsTestSelectionModalOpen\(true\);[\s\S]*?\};/;
    const newHandleCategory = `const handleCategorySelect = (categoryKey) => {
    updateSetting('selectedQuestionType', categoryKey);
    setIsCategoryModalOpen(false);

    const availableExams = getAvailableExams(categoryKey);
    setTestsForCategory(availableExams);
    if (availableExams && availableExams.length > 0) {
      setSelectedTest(availableExams[0].name);
      setSelectedTests([availableExams[0].name]);
      startPreloadingSelectedTests([availableExams[0].name], categoryKey);
    } else {
      setSelectedTests([]);
      setSelectedTest(null);
    }

    setIsTestSelectionModalOpen(true);
  };`;

    if (oldHandleCategory.test(content)) {
        content = content.replace(oldHandleCategory, newHandleCategory);
        console.log('✓ Updated handleCategorySelect in', cfg.dir);
    }

    // 4. Clean up header & remove duplicate "إدارة الأسئلة" & clean up ThemeDock placement
    // Look for the area from `<div className="relative z-10">` down to before `<div className="flex justify-center mb-6 mt-10">`
    const headerRegex = /<div className="relative z-10">[\s\S]*?<div className="flex justify-center mb-6 mt-10">/;
    const newHeader = `<div className="relative z-30 w-full px-3 sm:px-6 pt-3 sm:pt-5 pb-2">
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
              
              {/* Right Side: Navigation & Actions */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                <Button
                  variant=""
                  className="text-cyan-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold"
                  onClick={() => window.location.href = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || ['5173', '5174', '5175'].includes(window.location.port)) ? ('http://' + window.location.hostname + ':5173/') : '/'}
                >
                  <Home className="h-4 w-4" />
                  <span>الرئيسية</span>
                </Button>

                <Button
                  variant=""
                  className="text-amber-300 hover:bg-amber-500/25 bg-amber-500/15 backdrop-blur-sm border border-amber-500/40 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 text-xs sm:text-sm font-bold"
                  onClick={showQuestionsManager}
                  title="إدارة بنك أسئلة المحاكي"
                >
                  <FileText className="h-4 w-4 text-amber-400" />
                  <span>إدارة الأسئلة 📝</span>
                </Button>

                <ThemeDock />
              </div>

              {/* Left Side: User Profile & Quick Actions */}
              {user && (
                <div className="text-white flex items-center gap-2 sm:gap-3 bg-white/10 backdrop-blur-sm border border-white/20 px-3 py-1.5 rounded-xl shadow-md">
                  <img src={user.photo_url || 'https://i.ibb.co/tMMyJj2y/icon.jpg'} alt={user.first_name} className="w-8 h-8 rounded-full border-2 border-cyan-400 object-cover" />
                  <div className="hidden md:block text-right">
                    <p className="text-xs sm:text-sm font-bold leading-tight">{user.first_name} {user.last_name}</p>
                    <p className="text-[10px] text-slate-300" dir="ltr">@{user.username || 'tarqa'}</p>
                  </div>
                  
                  <div className="h-4 w-px bg-white/20 mx-1 hidden sm:block" />

                  <Button onClick={showHistory} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-lg cursor-pointer" title="سجل الاختبارات">
                    <History className="h-4 w-4" />
                  </Button>
                  <Button onClick={() => setIsStatsModalOpen(true)} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-lg cursor-pointer" title="الإحصائيات">
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      toggleNightMode();
                      if (!nightMode) {
                        toast.success('تم تفعيل الوضع الليلي');
                      } else {
                        toast.info('تم إلغاء الوضع الليلي');
                      }
                    }}
                    className={\`p-2 rounded-lg cursor-pointer \${nightMode ? 'text-yellow-400 hover:bg-white/20' : 'text-cyan-400 hover:bg-white/20'}\`}
                    title="تبديل الوضع الليلي"
                  >
                    {nightMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                  </Button>
                  <Button onClick={handleLogout} variant="ghost" className="text-slate-300 hover:bg-red-500/20 hover:text-red-400 p-2 rounded-lg cursor-pointer" title="تسجيل الخروج">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}

            </div>
          </div>

          <div className="relative max-w-7xl mx-auto px-6 py-6 text-center">
            <div className="flex justify-center mb-6 mt-10">`;

    if (headerRegex.test(content)) {
        content = content.replace(headerRegex, newHeader);
        console.log('✓ Cleaned up top navigation header in', cfg.dir);
    }

    fs.writeFileSync(startScreenPath, content, 'utf8');
});

console.log('\n=== [Step 3] Building all 3 simulators ===');

const viteBin = path.join(__dirname, 'mo7aky_extracted/tarqa/node_modules/.bin/vite.cmd');

simConfigs.forEach(cfg => {
    const fullDir = path.join(__dirname, cfg.dir);
    console.log(`Building ${cfg.dir}...`);
    try {
        execSync(`"${viteBin}" build`, { cwd: fullDir, stdio: 'inherit' });
        console.log(`✓ Built ${cfg.dir} successfully`);
    } catch (err) {
        console.error(`Failed to build ${cfg.dir}:`, err.message);
    }
});

console.log('\n=== [Step 4] Copying build outputs to public folders ===');

function copyFolderRecursiveSync(source, target) {
    if (!fs.existsSync(target)) {
        fs.mkdirSync(target, { recursive: true });
    }
    const files = fs.readdirSync(source);
    for (const file of files) {
        const curSource = path.join(source, file);
        const curTarget = path.join(target, file);
        if (fs.lstatSync(curSource).isDirectory()) {
            copyFolderRecursiveSync(curSource, curTarget);
        } else {
            fs.copyFileSync(curSource, curTarget);
        }
    }
}

const copyMappings = [
    { from: 'mo7aky_extracted/tarqa/dist', to: 'public/simulation' },
    { from: 'mo7aky_extracted/level_test/dist', to: 'public/exam' },
    { from: 'mo7aky_extracted/tiger/dist', to: 'public/tiger' }
];

copyMappings.forEach(m => {
    const fromPath = path.join(__dirname, m.from);
    const toPath = path.join(__dirname, m.to);
    if (fs.existsSync(fromPath)) {
        copyFolderRecursiveSync(fromPath, toPath);
        console.log(`✓ Copied ${m.from} -> ${m.to}`);

        // Update target index.html with latest JS and CSS names
        const distIndex = path.join(fromPath, 'index.html');
        const targetIndex = path.join(toPath, 'index.html');
        if (fs.existsSync(distIndex) && fs.existsSync(targetIndex)) {
            const distHtml = fs.readFileSync(distIndex, 'utf8');
            const jsMatch = distHtml.match(/src="[^"]*\/assets\/(index-[^"]+\.js)"/);
            const cssMatch = distHtml.match(/href="[^"]*\/assets\/(index-[^"]+\.css)"/);

            if (jsMatch && cssMatch) {
                let targetHtml = fs.readFileSync(targetIndex, 'utf8');
                targetHtml = targetHtml.replace(/window\.__SIMULATOR_JS__\s*=\s*'[^']+'/, `window.__SIMULATOR_JS__ = './assets/${jsMatch[1]}'`);
                targetHtml = targetHtml.replace(/window\.__SIMULATOR_CSS__\s*=\s*'[^']+'/, `window.__SIMULATOR_CSS__ = './assets/${cssMatch[1]}'`);
                fs.writeFileSync(targetIndex, targetHtml, 'utf8');
                console.log(`✓ Updated asset links in ${m.to}/index.html to ${jsMatch[1]} and ${cssMatch[1]}`);
            }
        }
    }
});

console.log('\n=== Done patching simulators! ===');

