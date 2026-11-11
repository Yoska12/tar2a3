const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Normalize line endings
const normalized = content.replace(/\r\n/g, '\n');

// Find the simulator view block to replace
const startMarker = "currentView === 'simulator' && (\n        <main className=\"flex-1 w-full pb-24 md:pb-8\">\n          <SimulatorHub";
const endMarker = "        </main>\n      )}";

const startIdx = normalized.indexOf(startMarker);
if (startIdx === -1) {
  console.log('START MARKER NOT FOUND');
  console.log('Searching for partial...');
  const p = normalized.indexOf("currentView === 'simulator'");
  console.log('Partial found at:', p);
  if (p >= 0) console.log('Context:', JSON.stringify(normalized.substring(p, p+300)));
  process.exit(1);
}

const endIdx = normalized.indexOf(endMarker, startIdx);
if (endIdx === -1) {
  console.log('END MARKER NOT FOUND after index', startIdx);
  process.exit(1);
}

const actualEnd = endIdx + endMarker.length;
console.log('Found block from', startIdx, 'to', actualEnd);
console.log('Old block snippet:', JSON.stringify(normalized.substring(startIdx, startIdx+100)));

const newBlock = `currentView === 'simulator' && (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16 pb-24 md:pb-12 flex flex-col gap-8 font-cairo" dir="rtl">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>منظومة المحاكيات الذكية</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">اختر المحاكي المناسب لك</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">ثلاثة محاكيات مختلفة، كل واحد مصمم لهدف معين</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <button onClick={() => handleTabSelect('simulation')} className="group relative overflow-hidden cursor-pointer p-6 rounded-3xl border-2 border-amber-500/40 hover:border-amber-400 bg-gradient-to-br from-slate-900/90 to-[#0d1322] hover:shadow-2xl hover:shadow-amber-500/15 transition-all duration-300 hover:-translate-y-2 text-right flex flex-col gap-4">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center justify-between"><span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">الأكثر طلباً</span><div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-2xl group-hover:scale-110 transition-transform">⚡</div></div>
                <div><h3 className="font-black text-lg text-white group-hover:text-amber-300 transition-colors">محاكي الطرقعة الشامل</h3><p className="text-xs text-slate-400 mt-1.5 leading-relaxed">واجهة قياس محوسب حقيقية، أسئلة كمي ولفظي موقوتة، وحفظ تلقائي للدرجات والنتائج</p></div>
                <div className="flex items-center justify-between pt-3 border-t border-amber-500/20 text-xs font-black text-amber-400"><span>ابدأ الآن</span><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /></div>
              </div>
            </button>
            <button onClick={() => handleTabSelect('exam')} className="group relative overflow-hidden cursor-pointer p-6 rounded-3xl border-2 border-sky-500/40 hover:border-sky-400 bg-gradient-to-br from-slate-900/90 to-[#0d1322] hover:shadow-2xl hover:shadow-sky-500/15 transition-all duration-300 hover:-translate-y-2 text-right flex flex-col gap-4">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center justify-between"><span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">مجاني 100%</span><div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center font-black text-2xl group-hover:scale-110 transition-transform">🎯</div></div>
                <div><h3 className="font-black text-lg text-white group-hover:text-sky-300 transition-colors">اختبار تحديد المستوى</h3><p className="text-xs text-slate-400 mt-1.5 leading-relaxed">اختبار تشخيصي دقيق يحدد مستواك في القدرات ويقترح خطة المذاكرة الأنسب لك</p></div>
                <div className="flex items-center justify-between pt-3 border-t border-sky-500/20 text-xs font-black text-sky-400"><span>حدد مستواك</span><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /></div>
              </div>
            </button>
            <button onClick={() => handleTabSelect('tiger')} className="group relative overflow-hidden cursor-pointer p-6 rounded-3xl border-2 border-emerald-500/40 hover:border-emerald-400 bg-gradient-to-br from-slate-900/90 to-[#0d1322] hover:shadow-2xl hover:shadow-emerald-500/15 transition-all duration-300 hover:-translate-y-2 text-right flex flex-col gap-4">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />
              <div className="relative z-10 flex flex-col gap-4">
                <div className="flex items-center justify-between"><span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">نماذج جديدة</span><div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-2xl group-hover:scale-110 transition-transform">🐅</div></div>
                <div><h3 className="font-black text-lg text-white group-hover:text-emerald-300 transition-colors">محاكي واختبارات نمر</h3><p className="text-xs text-slate-400 mt-1.5 leading-relaxed">تدريب مكثف على أحدث نماذج نمر المقفلة وأسئلة قياس الأكثر تكراراً وتوقعاً</p></div>
                <div className="flex items-center justify-between pt-3 border-t border-emerald-500/20 text-xs font-black text-emerald-400"><span>ابدأ التدريب</span><ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /></div>
              </div>
            </button>
          </div>
        </main>
      )}

      {/* محاكي الطرقعة الشامل - صفحة كاملة */}
      {(currentView as any) === 'simulation' && (
        <main className="flex-1 w-full pb-24 md:pb-0">
          <StandaloneSimulatorView type="simulation" currentUser={currentUser}
            onBackToHome={() => { setCurrentView('simulator' as any); setActiveTab('simulator' as any); window.history.replaceState(null, '', '#simulator'); }}
            onSwitchSimulator={(t) => handleTabSelect(t)} />
        </main>
      )}

      {/* اختبار تحديد المستوى - صفحة كاملة */}
      {(currentView as any) === 'exam' && (
        <main className="flex-1 w-full pb-24 md:pb-0">
          <StandaloneSimulatorView type="exam" currentUser={currentUser}
            onBackToHome={() => { setCurrentView('simulator' as any); setActiveTab('simulator' as any); window.history.replaceState(null, '', '#simulator'); }}
            onSwitchSimulator={(t) => handleTabSelect(t)} />
        </main>
      )}

      {/* محاكي نمر - صفحة كاملة */}
      {(currentView as any) === 'tiger' && (
        <main className="flex-1 w-full pb-24 md:pb-0">
          <StandaloneSimulatorView type="tiger" currentUser={currentUser}
            onBackToHome={() => { setCurrentView('simulator' as any); setActiveTab('simulator' as any); window.history.replaceState(null, '', '#simulator'); }}
            onSwitchSimulator={(t) => handleTabSelect(t)} />
        </main>
      )}`;

const newContent = normalized.substring(0, startIdx) + newBlock + normalized.substring(actualEnd);
fs.writeFileSync('src/App.tsx', newContent, 'utf8');
console.log('SUCCESS - file written, new length:', newContent.length);
