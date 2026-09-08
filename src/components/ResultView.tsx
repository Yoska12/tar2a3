import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw, 
  Home, 
  Filter, 
  Lightbulb, 
  ChevronDown, 
  ChevronUp, 
  Share2, 
  BarChart2,
  Sparkles,
  Zap
} from 'lucide-react';
import { QuizResult, OptionId } from '../types';
import { MathRenderer } from './MathRenderer';

interface ResultViewProps {
  result: QuizResult;
  onRetake: () => void;
  onHome: () => void;
}

const ARABIC_OPTION_LABELS: Record<OptionId, string> = {
  A: 'أ',
  B: 'ب',
  C: 'ج',
  D: 'د',
};

export const ResultView: React.FC<ResultViewProps> = ({
  result,
  onRetake,
  onHome,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'correct'>('all');
  const [expandedExplanations, setExpandedExplanations] = useState<Record<string, boolean>>({});

  // إطلاق الاحتفال عند التفوق
  useEffect(() => {
    if (result.percentageScore >= 80) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#f59e0b', '#fbbf24', '#10b981', '#3b82f6'],
      });
    }
  }, [result.percentageScore]);

  // تبديل ظهور الشرح
  const toggleExplanation = (questionId: string) => {
    setExpandedExplanations((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  // تصفية الأسئلة
  const filteredQuestions = result.detailedAnswers.filter((item) => {
    if (filterMode === 'wrong') return !item.isCorrect;
    if (filterMode === 'correct') return item.isCorrect;
    return true;
  });

  // تقييم النتيجة
  const getRatingMessage = () => {
    if (result.percentageScore >= 90) {
      return {
        title: 'طرقعتها بجدارة! 🎯 درجة استثنائية (100)',
        desc: 'أداؤك عالي جداً وتكتيكاتك سريعة ودقيقة، أنت جاهز لتحقيق 100 في قياس!',
        color: 'text-amber-500 dark:text-amber-400',
        badge: 'مستوى نخبوي 100 🎯',
      };
    } else if (result.percentageScore >= 75) {
      return {
        title: 'أداء ممتاز ورائع! 👏',
        desc: 'مستواك متقدم جداً، فقط ركز على نقاط الضعف البسيطة لتضمن الدرجة الكاملة.',
        color: 'text-emerald-500 dark:text-emerald-400',
        badge: 'مستوى متقدم',
      };
    } else {
      return {
        title: 'بداية جيدة.. والتعلم مستمر! 💪',
        desc: 'راجع طرق طرقع السريعة في الأسئلة الخاطئة لتتعلم حيل التدرج والحل الذهني.',
        color: 'text-blue-500 dark:text-blue-400',
        badge: 'يحتاج تدريب مكثف',
      };
    }
  };

  const rating = getRatingMessage();
  const avgTimePerQuestion = result.totalQuestions > 0 
    ? Math.round(result.totalTimeSeconds / result.totalQuestions) 
    : 0;

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}د ${s}ث`;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        
        {/* بطاقة النتيجة الرئيسية */}
        <div className="relative overflow-hidden bg-white dark:bg-[#0d1424] rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800 shadow-xl text-center">
          
          {/* زخرفة خلفية ذهبية */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* أيقونة الكأس والتقييم */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/15 border-2 border-amber-500/30 flex items-center justify-center text-amber-500 shadow-glow mb-4">
              <Trophy className="w-10 h-10" />
            </div>

            <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-2">
              {rating.badge}
            </span>

            <h2 className={`text-2xl sm:text-3xl font-black ${rating.color} mb-2`}>
              {rating.title}
            </h2>

            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-lg mb-6">
              {rating.desc}
            </p>

            {/* النسبة المئوية الدائرية الكبيرة */}
            <div className="my-2 p-6 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/80 inline-flex flex-col items-center">
              <span className="text-5xl sm:text-6xl font-black font-mono text-slate-900 dark:text-white">
                {result.percentageScore}%
              </span>
              <span className="text-xs font-semibold text-slate-500 mt-1">
                ({result.correctAnswers} إجابة صحيحة من أصل {result.totalQuestions})
              </span>
            </div>

            {/* تفاصيل البطاقات السريعة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-2xl mt-6">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold">صحيحة</span>
                </div>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{result.correctAnswers}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                <div className="flex items-center justify-center gap-1 text-rose-600 dark:text-rose-400 mb-1">
                  <XCircle className="w-4 h-4" />
                  <span className="text-xs font-bold">خاطئة</span>
                </div>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono">{result.wrongAnswers}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-600 dark:text-blue-400 mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-bold">الوقت الكلي</span>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{formatSeconds(result.totalTimeSeconds)}</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-600 dark:text-amber-400 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-bold">معدل السؤال</span>
                </div>
                <span className="text-lg font-black text-slate-900 dark:text-white font-mono">{avgTimePerQuestion} ثانية</span>
              </div>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <button
                onClick={onRetake}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md hover:shadow-glow transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>إعادة الاختبار</span>
              </button>

              <button
                onClick={onHome}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                <Home className="w-4 h-4" />
                <span>العودة للرئيسية</span>
              </button>
            </div>

          </div>
        </div>

        {/* تحليل الأداء حسب أقسام الكمي */}
        {Object.keys(result.categoryPerformance).length > 0 && (
          <div className="bg-white dark:bg-[#0d1424] rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-amber-500" />
              <span>تحليل الأداء حسب أقسام الكمي (لتحديد نقاط الضعف)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.entries(result.categoryPerformance).map(([category, stats]) => {
                const percent = Math.round((stats.correct / stats.total) * 100);
                const isGood = percent >= 70;

                return (
                  <div key={category} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center justify-between text-sm font-semibold mb-2">
                      <span className="text-slate-800 dark:text-slate-200">{category}</span>
                      <span className={`font-mono font-bold ${isGood ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {stats.correct}/{stats.total} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isGood ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* استعراض ومراجعة الأسئلة والشروحات */}
        <div className="bg-white dark:bg-[#0d1424] rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                مراجعة الأسئلة وشروحات "طريقة طرقع"
              </h3>
              <p className="text-xs text-slate-500">
                تعلم حيل الحل السريع والتدرج المنتظم لكل مسألة
              </p>
            </div>

            {/* أزرار التصفية */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'all' 
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                الكل ({result.detailedAnswers.length})
              </button>
              <button
                onClick={() => setFilterMode('wrong')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'wrong' 
                    ? 'bg-rose-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-rose-500'
                }`}
              >
                الخاطئة فقط ({result.wrongAnswers})
              </button>
              <button
                onClick={() => setFilterMode('correct')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  filterMode === 'correct' 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-emerald-500'
                }`}
              >
                الصحيحة ({result.correctAnswers})
              </button>
            </div>
          </div>

          {/* قائمة الأسئلة */}
          <div className="flex flex-col gap-6">
            {filteredQuestions.map((item, idx) => {
              const q = item.question;
              const isExpanded = Boolean(expandedExplanations[q.id]);
              const isCorrect = item.isCorrect;

              return (
                <div 
                  key={q.id}
                  className={`p-5 rounded-2xl border transition-all ${
                    isCorrect 
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.04]' 
                      : 'border-rose-500/30 bg-rose-500/[0.02] dark:bg-rose-500/[0.04]'
                  }`}
                >
                  {/* شريط حالة السؤال */}
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-500">
                        {q.categoryTitle || 'قسم الكمي'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">
                        الوقت: {item.timeSpentSeconds} ثانية
                      </span>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>إجابة صحيحة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400">
                          <XCircle className="w-4 h-4" />
                          <span>إجابة خاطئة</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* نص السؤال */}
                  <div className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">
                    <MathRenderer content={q.questionText} />
                  </div>

                  {/* الخيارات */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                    {q.options.map((opt) => {
                      const isUserChoice = item.userAnswer === opt.id;
                      const isCorrectChoice = q.correctOption === opt.id;

                      let optStyles = 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300';

                      if (isCorrectChoice) {
                        optStyles = 'bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold';
                      } else if (isUserChoice && !isCorrect) {
                        optStyles = 'bg-rose-500/15 border-rose-500 text-rose-700 dark:text-rose-300 font-bold';
                      }

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-xs sm:text-sm ${optStyles}`}
                        >
                          <span className="w-6 h-6 rounded-md bg-white dark:bg-slate-700 flex items-center justify-center font-bold shrink-0">
                            {ARABIC_OPTION_LABELS[opt.id]}
                          </span>
                          <div className="flex-1">
                            <MathRenderer content={opt.text} />
                          </div>
                          {isCorrectChoice && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {isUserChoice && !isCorrect && <XCircle className="w-4 h-4 text-rose-500" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* زر فتح شرح طرقع */}
                  <button
                    onClick={() => toggleExplanation(q.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:text-amber-700 transition"
                  >
                    <Lightbulb className="w-4 h-4" />
                    <span>{isExpanded ? 'إخفاء طريقة طرقع للحل السريع' : 'عرض طريقة طرقع للحل السريع'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  {/* محتوى الشرح */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-xs sm:text-sm leading-relaxed">
                      <div className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 mb-2">
                        <Zap className="w-4 h-4" />
                        <span>سر الحل مع طرقع:</span>
                      </div>
                      <MathRenderer content={q.explanation} />
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>

      </div>
    </div>
  );
};
