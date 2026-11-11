import React, { useState, useEffect } from 'react';
import {
  Zap,
  Target,
  ExternalLink,
  Maximize2,
  Minimize2,
  ChevronRight,
  ArrowRight
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { simulatorService } from '../lib/simulatorService';

export type SimulatorType = 'simulation' | 'exam' | 'tiger';

interface StandaloneSimulatorViewProps {
  type: SimulatorType;
  onBackToHome: () => void;
  onSwitchSimulator?: (newType: SimulatorType) => void;
  currentUser?: TarqaUser | null;
}

const SIMULATOR_CONFIGS: Record<SimulatorType, {
  title: string;
  subtitle: string;
  path: string;
  badge: string;
  badgeColor: string;
  borderColor: string;
}> = {
  simulation: {
    title: 'محاكي الطرقعة الشامل',
    subtitle: 'نظام محاكاة قياس الأصلي 1446-1447 • أسئلة كمي ولفظي معتمدة وتوقيت قياسي',
    path: '/simulation/',
    badge: 'محاكي الطرقعة 🎯',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    borderColor: 'border-sky-500/30'
  },
  exam: {
    title: 'تحديد المستوى',
    subtitle: 'اختبار تشخيصي دقيق لتحديد مستواك الحقيقي في القدرات وخطة التأسيس الموصى بها',
    path: '/exam/',
    badge: 'تحديد المستوى ⚡',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderColor: 'border-amber-500/30'
  },
  tiger: {
    title: 'محاكي واختبارات نمر',
    subtitle: 'تدريب مكثف على أحدث صيغ النماذج المقفلة وأسئلة قياس الأكثر تكراراً',
    path: '/tiger/',
    badge: 'محاكي نمر 🐅',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderColor: 'border-emerald-500/30'
  }
};

export const StandaloneSimulatorView: React.FC<StandaloneSimulatorViewProps> = ({
  type,
  onBackToHome,
  onSwitchSimulator,
  currentUser
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const config = SIMULATOR_CONFIGS[type] || SIMULATOR_CONFIGS.simulation;

  // مزامنة جلسة المستخدم مع المحاكي
  useEffect(() => {
    if (currentUser) {
      simulatorService.syncSessionToBackend(currentUser).catch(() => {});
    }
  }, [currentUser]);

  return (
    <div
      className={`w-full transition-all duration-300 font-cairo ${
        isFullscreen
          ? 'fixed inset-0 z-[999999] bg-slate-950 flex flex-col p-2'
          : 'w-full min-h-[92vh] py-3 max-w-7xl mx-auto px-2 sm:px-4 flex flex-col'
      }`}
      dir="rtl"
    >
      {/* شريط رأس الصفحة المستقلة للمحاكي */}
      <header className={`bg-[#0b101e]/95 backdrop-blur-xl border ${config.borderColor} rounded-2xl p-3 mb-3 flex flex-wrap items-center justify-between gap-3 shadow-2xl`}>
        
        {/* زر العودة وعنوان المحاكي المستقل */}
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToHome}
            className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-slate-700 cursor-pointer shadow-sm group"
            title="الرجوع إلى منصة طرقع"
          >
            <ArrowRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span>الرئيسية</span>
          </button>

          <div className="h-5 w-px bg-slate-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border ${config.badgeColor}`}>
                {config.badge}
              </span>
              <h1 className="text-sm sm:text-base font-black text-white leading-tight">
                {config.title}
              </h1>
            </div>
            <p className="text-[11px] text-slate-400 font-medium hidden md:block mt-0.5">
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* أدوات التحكم والتنقل */}
        <div className="flex items-center gap-2 mr-auto">
          {/* روابط المحاكيات الأخرى للتنقل السريع بين الصفحات */}
          {onSwitchSimulator && (
            <div className="hidden lg:flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
              <span className="text-[10px] text-slate-400 px-2 font-bold">انتقال إلى:</span>
              {type !== 'simulation' && (
                <button
                  onClick={() => onSwitchSimulator('simulation')}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-amber-400 font-bold transition text-xs cursor-pointer"
                >
                  محاكي الطرقعة
                </button>
              )}
              {type !== 'exam' && (
                <button
                  onClick={() => onSwitchSimulator('exam')}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-sky-400 font-bold transition text-xs cursor-pointer"
                >
                  تحديد المستوى
                </button>
              )}
              {type !== 'tiger' && (
                <button
                  onClick={() => onSwitchSimulator('tiger')}
                  className="px-2.5 py-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-emerald-400 font-bold transition text-xs cursor-pointer"
                >
                  محاكي نمر
                </button>
              )}
            </div>
          )}

          {/* زر ملء الشاشة */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            title={isFullscreen ? 'تصغير الشاشة' : 'تكبير ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isFullscreen ? 'تصغير' : 'ملء الشاشة'}</span>
          </button>

          {/* حالة المحاكي */}
          <div className="px-3.5 py-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-xs flex items-center gap-1.5">
            <span>قريباً ⏳</span>
          </div>
        </div>

      </header>

      {/* مساحة صفحة المحاكي - مقفولة حالياً */}
      <main className="flex-1 w-full bg-[#0b101e] rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl relative min-h-[500px] flex flex-col items-center justify-center p-8 text-center">
        <div className="max-w-md w-full flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/40 flex items-center justify-center text-4xl shadow-xl shadow-amber-500/10">
            ⏳
          </div>
          <div className="space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
              🔒 مقفول حالياً للتطوير
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              {config.title} - قريباً ⏳
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              نقوم حالياً بتحديث شامل لبنك الأسئلة وإعادة هيكلة واجهة الاختبار وفق أعلى معايير قياس لعام 1446-1447. سيعود المحاكي للعمل قريباً جداً!
            </p>
          </div>
          <button
            onClick={onBackToHome}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/25 cursor-pointer"
          >
            العودة إلى منصة طرقع
          </button>
        </div>
      </main>

    </div>
  );
};

