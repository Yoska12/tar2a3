import React, { useState } from 'react';
import {
  Trophy,
  Zap,
  Target,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Bookmark,
  Sparkles,
  BookOpen,
  ChevronLeft,
  AlertTriangle,
  Play,
  RotateCcw,
  Shapes,
  Calculator,
  Scale,
  BarChart3,
  Lightbulb,
  ExternalLink
} from 'lucide-react';
import { RadarChart, RadarDataPoint } from './RadarChart';
import { MathRenderer } from './MathRenderer';
import { TarqaUser } from '../lib/supabase';
import { Category, Question } from '../types';
import { mockCategories, mockQuestions } from '../data/mockQuestions';

interface StudentDashboardProps {
  currentUser: TarqaUser | null;
  onStartMock: () => void;
  onStartPractice: (category?: Category) => void;
  onReviewAttempt?: (attemptId: string) => void;
  onOpenAuth?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  onStartMock,
  onStartPractice,
  onReviewAttempt,
  onOpenAuth,
}) => {
  const [selectedBookmarkedQuestion, setSelectedBookmarkedQuestion] = useState<Question | null>(null);

  // استخراج المحاولات السابقة من التخزين المحلي إن وجدت أو استخدام بيانات نموذجية أولية
  const localAttempts = React.useMemo(() => {
    try {
      const stored = localStorage.getItem('tarqa_attempts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    
    // بيانات افتراضية واقعية
    return [
      {
        id: 'att-1',
        title: 'محاكي قياس الشامل - النموذج الأول',
        score: 92,
        totalQuestions: 20,
        correctCount: 18,
        timeSpentSeconds: 780,
        completed_at: 'منذ يومين',
      },
      {
        id: 'att-2',
        title: 'تحدي طرقع للسرعة الذهنية',
        score: 85,
        totalQuestions: 10,
        correctCount: 8,
        timeSpentSeconds: 390,
        completed_at: 'منذ 3 أيام',
      },
      {
        id: 'att-3',
        title: 'تدريب مركز: الجبر والمعادلات',
        score: 95,
        totalQuestions: 15,
        correctCount: 14,
        timeSpentSeconds: 520,
        completed_at: 'منذ 5 أيام',
      },
      {
        id: 'att-4',
        title: 'تدريب مركز: الهندسة والزوايا',
        score: 54,
        totalQuestions: 12,
        correctCount: 6,
        timeSpentSeconds: 610,
        completed_at: 'منذ أسبوع',
      },
    ];
  }, []);

  // حساب معدل آخر 5 اختبارات والجاهزية للدرجة 100
  const scores = localAttempts.map((a: any) => a.score || 0);
  const currentAverage = scores.length > 0
    ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
    : 86;

  const targetScore = currentUser?.targetScore || 100;
  const progressRatio = Math.min(100, Math.round((currentAverage / targetScore) * 100));

  // بيانات مخطط الرادار للأقسام الخمسة
  const radarData: RadarDataPoint[] = [
    { category: 'الجبر والمعادلات', value: 92, fullMark: 100 },
    { category: 'الهندسة والزوايا', value: 54, fullMark: 100 },
    { category: 'الحساب والعمليات', value: 88, fullMark: 100 },
    { category: 'المقارنات', value: 82, fullMark: 100 },
    { category: 'الإحصاء والاحتمال', value: 76, fullMark: 100 },
  ];

  // الأسئلة المحفوظة للمراجعة لاحقاً
  const bookmarkedQuestions = React.useMemo(() => {
    return mockQuestions.slice(0, 4);
  }, []);

  const geometryCategory = mockCategories.find((c) => c.slug === 'geometry') || mockCategories[1];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 animate-in fade-in duration-200 font-cairo">

      {/* ======================================================================= */}
      {/* 1. الهيدر والبانر الترحيبي (Welcome & Goal Banner) */}
      {/* ======================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent dark:from-[#11192e] dark:to-[#070b14] border border-amber-500/25 p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>لوحة متابعة الطالب</span>
              </span>
              <span className="text-xs text-slate-500">• آخر تحديث: اليوم</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white">
              مرحباً بك، {currentUser?.fullName || 'يا بطل طرقع'}! 🎯
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
              هدفك هو تحقيق <strong className="text-amber-600 dark:text-amber-400 font-mono">100 🎯</strong> في القسم الكمي. أنت تبلي بلاءً حسناً، ومع التدريب المستمر ستصل بإذن الله!
            </p>

            {/* شريط التقدم نحو الهدف */}
            <div className="mt-2 max-w-xl">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-amber-500" />
                  <span>مدى الاقتراب من الهدف ({targetScore} 🎯):</span>
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">
                  {currentAverage}% (متبقي {Math.max(0, targetScore - currentAverage)} درجات)
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300 dark:border-slate-700">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700 shadow-sm"
                  style={{ width: `${progressRatio}%` }}
                />
              </div>
            </div>
          </div>

          {/* أزرار الإجراءات السريعة */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
            <button
              onClick={() => onStartPractice()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-xs border border-slate-200 dark:border-slate-700 shadow-sm transition"
            >
              <Lightbulb className="w-4 h-4 text-amber-500" />
              <span>ابدأ تدريب اليوم</span>
            </button>

            <button
              onClick={onStartMock}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md hover:shadow-glow transition transform hover:-translate-y-0.5"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>محاكي قياس جديد</span>
            </button>
          </div>

        </div>
      </section>

      {/* ======================================================================= */}
      {/* 2. بطاقات المؤشرات الرئيسية (Metric Cards) */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* الدقة الإجمالية */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">معدل الدقة الإجمالي</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              86.5%
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-3 h-3" />
              <span>+4.2% مقارنة بالأسبوع الماضي</span>
            </div>
          </div>
        </div>

        {/* سرعة الحل */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">سرعة حل المسألة</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Zap className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              44 <span className="text-sm font-normal">ثانية/سؤال</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
              <Zap className="w-3 h-3" />
              <span>أسرع بـ 16 ثانية من معيار قياس (60 ث)</span>
            </div>
          </div>
        </div>

        {/* الاختبارات المكتملة */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">الاختبارات المكتملة</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono">
              {localAttempts.length} <span className="text-sm font-normal">اختبارات</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-slate-500">
              <Clock className="w-3 h-3" />
              <span>إجمالي 57 مسألة محلولة</span>
            </div>
          </div>
        </div>

        {/* سلسلة الالتزام اليومي */}
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500">سلسلة الالتزام (Streak)</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Flame className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono flex items-center gap-2">
              <span>7 أيام</span>
              <span className="text-xl">🔥</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
              <span>استمر بالتدريب اليوم للحفاظ على الشعلة!</span>
            </div>
          </div>
        </div>

      </section>

      {/* ======================================================================= */}
      {/* 3. تحليل المهارات ومخطط الرادار ونقاط الضعف (Visual Analytics) */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* مخطط الرادار (Radar Chart) */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col items-center justify-between">
          <div className="w-full flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                رادار إتقان أقسام الكمي
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                توزيع مستواك عبر الموضوعات الخمسة الرئيسية
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
              مخطط تفاعلي
            </span>
          </div>

          <div className="py-2 flex items-center justify-center w-full">
            <RadarChart data={radarData} size={310} />
          </div>

          <p className="text-[11px] text-slate-500 text-center mt-2">
            مرر المؤشر فوق رؤوس المضلع لعرض نسبة كل قسم بدقة.
          </p>
        </div>

        {/* أشرطة الإتقان التفصيلية ونقطة الضعف */}
        <div className="lg:col-span-6 flex flex-col gap-4">
          
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex-1 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                تفاصيل إتقان الأقسام
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                نسبة إجاباتك الصحيحة في كل محور
              </p>

              <div className="space-y-3.5">
                {radarData.map((item, i) => {
                  const isLow = item.value < 65;
                  const isHigh = item.value >= 85;

                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800 dark:text-slate-200">{item.category}</span>
                        <span className={`font-mono ${isHigh ? 'text-emerald-500' : isLow ? 'text-rose-500' : 'text-amber-500'}`}>
                          {item.value}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isHigh ? 'bg-emerald-500' : isLow ? 'bg-rose-500' : 'bg-amber-500'
                          }`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* تنبيه نقطة الضعف والتوصية العلاجية الفورية */}
            <div className="mt-5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-rose-600 dark:text-rose-400">
                    تحتاج تركيز أكثر على: الهندسة والزوايا (54% إتقان)
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                    اكتشف استراتيجية مثلثات فيثاغورس الذهبية لتضاعف سرعتك في حل الأشكال.
                  </p>
                </div>
              </div>

              <button
                onClick={() => onStartPractice(geometryCategory)}
                className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shrink-0 transition flex items-center gap-1.5 shadow-sm"
              >
                <span>حل مسائل هندسية الآن</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

          </div>

        </div>

      </section>

      {/* ======================================================================= */}
      {/* 4. سجل الاختبارات الأخيرة (Recent Attempts Table) */}
      {/* ======================================================================= */}
      <section className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              سجل الاختبارات الأخيرة
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              نتائج آخر محاولاتك وتقارير التصحيح الفوري
            </p>
          </div>
          <button
            onClick={onStartMock}
            className="text-xs font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1"
          >
            <span>اختبار جديد</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                <th className="pb-3 pr-2">اسم الاختبار</th>
                <th className="pb-3 px-3">التاريخ</th>
                <th className="pb-3 px-3">الوقت المستغرق</th>
                <th className="pb-3 px-3">الإجابات الصحيحة</th>
                <th className="pb-3 px-3">الدرجة</th>
                <th className="pb-3 pl-2 text-left">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {localAttempts.map((attempt: any) => {
                const isGreat = attempt.score >= 90;
                const isGood = attempt.score >= 75;

                return (
                  <tr key={attempt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3.5 pr-2 font-bold text-slate-900 dark:text-white">
                      {attempt.title}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 font-medium">
                      {attempt.completed_at}
                    </td>
                    <td className="py-3.5 px-3 text-slate-500 font-mono">
                      {Math.round(attempt.timeSpentSeconds / 60)} دقيقة
                    </td>
                    <td className="py-3.5 px-3 text-slate-600 dark:text-slate-300 font-mono">
                      {attempt.correctCount} / {attempt.totalQuestions}
                    </td>
                    <td className="py-3.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black font-mono ${
                        isGreat 
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' 
                          : isGood 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                      }`}>
                        {attempt.score}%
                      </span>
                    </td>
                    <td className="py-3.5 pl-2 text-left">
                      <button
                        onClick={() => {
                          if (onReviewAttempt) onReviewAttempt(attempt.id);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition"
                      >
                        <span>مراجعة الحلول</span>
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ======================================================================= */}
      {/* 5. الأسئلة المحفوظة للمراجعة (Bookmarked Questions) */}
      {/* ======================================================================= */}
      <section className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
              <Bookmark className="w-4 h-4 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                الأسئلة المحفوظة للمراجعة (بنك أخطائي)
              </h2>
              <p className="text-xs text-slate-400">
                المسائل التي وضعت عليها علامة للمراجعة لإعادة حلها وتثبيت استراتيجياتها
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-slate-400 font-mono">
            {bookmarkedQuestions.length} مسائل
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {bookmarkedQuestions.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 hover:border-amber-500/40 transition flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    {q.categoryTitle || 'قسم الكمي'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    مستوى {q.difficulty === 'Hard' ? 'متقدم' : 'متوسط'}
                  </span>
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
                  <MathRenderer content={q.questionText} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-[11px] text-slate-400">طريقة طرقع متاحة</span>
                <button
                  onClick={() => setSelectedBookmarkedQuestion(q)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-1 transition shadow-sm"
                >
                  <span>عرض وحل</span>
                  <ChevronLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* نافذة معاينة السؤال المحفوظ وطريقة طرقع */}
      {selectedBookmarkedQuestion && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative bg-white dark:bg-[#0d1424] rounded-3xl max-w-lg w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                مراجعة مسألة محفوظة
              </span>
              <button
                onClick={() => setSelectedBookmarkedQuestion(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 text-sm text-slate-900 dark:text-white leading-relaxed">
              <MathRenderer content={selectedBookmarkedQuestion.questionText} />
            </div>

            {/* الخيارات */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {selectedBookmarkedQuestion.options.map((opt) => (
                <div
                  key={opt.id}
                  className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 ${
                    opt.id === selectedBookmarkedQuestion.correctOption
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span className="w-5 h-5 rounded bg-amber-500/10 text-amber-500 flex items-center justify-center text-[10px]">
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </div>
              ))}
            </div>

            {/* طريقة طرقع للحل السريع */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>طريقة طرقع الذكية للحل السريع:</span>
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <MathRenderer content={selectedBookmarkedQuestion.explanation} />
              </div>
            </div>

            <button
              onClick={() => setSelectedBookmarkedQuestion(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs hover:bg-slate-800 transition"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
