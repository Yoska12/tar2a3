import React, { useState, useEffect } from 'react';
import {
  Zap,
  Target,
  Trophy,
  Clock,
  Sparkles,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  History,
  X,
  ChevronLeft
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { simulatorService, SimulatorExamResult, SimulatorStats } from '../lib/simulatorService';
import { isUserSubscribed, canEditCourses } from '../lib/subscriptionService';

interface SimulatorHubProps {
  currentUser: TarqaUser | null;
  onOpenAuth?: (tab?: 'signin' | 'signup') => void;
  onOpenSubscribe?: () => void;
  onBackToHome?: () => void;
}

export const SimulatorHub: React.FC<SimulatorHubProps> = ({
  currentUser,
  onOpenAuth,
  onOpenSubscribe,
  onBackToHome,
}) => {
  // المحاكي نشط ومفتوح مباشرة افتراضياً (محاكي الطرقعة الشامل)
  const [activeSimulator, setActiveSimulator] = useState<'simulation' | 'exam' | 'tiger'>('simulation');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [results, setResults] = useState<SimulatorExamResult[]>([]);
  const [stats, setStats] = useState<SimulatorStats>({
    totalExams: 0,
    averageScore: 0,
    highestScore: 0,
    totalTimeMinutes: 0,
    recentResults: [],
  });

  const isSubscribed = isUserSubscribed(currentUser) || canEditCourses(currentUser?.role, currentUser?.email);

  // مزامنة جلسة المستخدم وجلب النتائج السابقة
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      if (currentUser) {
        await simulatorService.syncSessionToBackend(currentUser);
        const data = await simulatorService.getResults(currentUser);
        if (isMounted) {
          setResults(data);
          setStats(simulatorService.calculateStats(data));
        }
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const titleMap = {
    exam: 'تحديد المستوى ⚡',
    simulation: 'محاكي الطرقعة الشامل 🎯',
    tiger: 'محاكي واختبارات نمر 🐅',
  };

  const pathMap = {
    exam: '/exam/index.html',
    simulation: '/simulation/index.html',
    tiger: '/tiger/index.html',
  };

  const handleSwitchSimulator = (type: 'simulation' | 'exam' | 'tiger') => {
    setActiveSimulator(type);
  };

  return (
    <div
      className={`w-full transition-all duration-300 font-cairo ${
        isFullscreen
          ? 'fixed inset-0 z-[99999] bg-slate-950 flex flex-col p-2 sm:p-4'
          : 'min-h-[88vh] py-3 max-w-7xl mx-auto px-2 sm:px-4 flex flex-col'
      }`}
      dir="rtl"
    >
      {/* شريط أدوات التحكم العلوي والتبديل بين المحاكيات */}
      <div className="bg-slate-900/95 backdrop-blur-md border border-amber-500/30 rounded-2xl p-2.5 sm:p-3 mb-3 flex flex-wrap items-center justify-between gap-2 shadow-2xl">
        
        {/* أزرار التبديل السريع بين المحاكيات الثلاثة */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          {/* 1. تحديد المستوى (البرتقالي) */}
          <button
            onClick={() => handleSwitchSimulator('exam')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSimulator === 'exam'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 shadow-md shadow-amber-500/25 scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Target className="w-4 h-4 text-slate-950 fill-current" />
            <span>تحديد المستوى ⚡</span>
          </button>

          {/* 2. محاكي الطرقعة الشامل (الأزرق) */}
          <button
            onClick={() => handleSwitchSimulator('simulation')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSimulator === 'simulation'
                ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25 scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>محاكي الطرقعة الشامل 🎯</span>
          </button>

          {/* 3. محاكي واختبارات نمر (الأخضر) */}
          <button
            onClick={() => handleSwitchSimulator('tiger')}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-1.5 cursor-pointer ${
              activeSimulator === 'tiger'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25 scale-102'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <span>🐅 محاكي واختبارات نمر</span>
          </button>
        </div>

        {/* أدوات العرض والإجراءات (ملء الشاشة، نافذة مستقلة، سجل النتائج) */}
        <div className="flex items-center gap-1.5 sm:gap-2 mr-auto">
          {/* سجل النتائج */}
          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            title="عرض سجل الاختبارات والدرجات السابقة"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">سجل النتائج</span>
            {stats.totalExams > 0 && (
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                {stats.totalExams}
              </span>
            )}
          </button>

          {/* ملء الشاشة */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            title={isFullscreen ? 'تصغير الشاشة' : 'تكبير ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
          </button>

          {/* فتح في نافذة مستقلة */}
          <a
            href={pathMap[activeSimulator]}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
            title="فتح المحاكي في تبويب مستقل"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">نافذة مستقلة</span>
          </a>
        </div>

      </div>

      {/* شاشة المحاكي المقفولة حالياً للتطوير */}
      <div className="flex-1 w-full bg-[#0b101e] rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl relative min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/10">
            ⏳
          </div>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              🔒 مقفول حالياً للتطوير والتحديث
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              المحاكي سيتوفر قريباً جداً ⏳
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              نقوم حالياً بتحديث شامل لبنك الأسئلة وإعادة هيكلة واجهة الاختبار وفق أعلى معايير قياس لعام 1446-1447. سيعود المحاكي للعمل قريباً جداً!
            </p>
          </div>
          {onBackToHome && (
            <button
              onClick={onBackToHome}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              العودة إلى منصة طرقع
            </button>
          )}
        </div>
      </div>

      {/* مودال سجل النتائج المنبثق */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#0d1322] border border-amber-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 overflow-hidden">
            
            {/* رأس المودال */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white">سجل الاختبارات والنتائج</h3>
                  <p className="text-xs text-slate-400">إجمالي الاختبارات المكتملة: {stats.totalExams}</p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* الإحصائيات السريعة */}
            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">أعلى درجة</span>
                <div className="text-lg font-black text-amber-400">{stats.highestScore}%</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">متوسط الدقة</span>
                <div className="text-lg font-black text-sky-400">{stats.averageScore}%</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">الاختبارات</span>
                <div className="text-lg font-black text-emerald-400">{stats.totalExams}</div>
              </div>
            </div>

            {/* قائمة النتائج */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {results.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-sm">
                  لم تقم بإجراء أي اختبارات بعد. ابدأ أول اختبار الآن! 🎯
                </div>
              ) : (
                results.map((res, i) => (
                  <div
                    key={res.id || i}
                    className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">{res.exam_name || 'اختبار قدرات'}</div>
                      <div className="text-slate-400 text-[11px] mt-0.5 font-mono">
                        {new Date(res.created_at).toLocaleDateString('ar-SA', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-end">
                        <span className="text-base font-black text-amber-400">{res.score_percentage || 0}%</span>
                        <div className="text-[10px] text-slate-400">
                          {res.correct_answers || 0} / {res.total_questions || 0} صحيحة
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* زر الإغلاق السفلي */}
            <button
              onClick={() => setShowHistoryModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition cursor-pointer"
            >
              إغلاق
            </button>

          </div>
        </div>
      )}

    </div>
  );
};
