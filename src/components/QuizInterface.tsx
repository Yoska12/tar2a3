import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Clock, 
  Flag, 
  ChevronRight, 
  ChevronLeft, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Lightbulb, 
  Grid3X3, 
  X, 
  Maximize2, 
  Minimize2,
  HelpCircle,
  Zap,
  BookmarkCheck
} from 'lucide-react';
import { Question, OptionId, QuizSettings, QuizResult } from '../types';
import { MathRenderer } from './MathRenderer';

interface QuizInterfaceProps {
  questions: Question[];
  settings: QuizSettings;
  quizTitle?: string;
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
}

const ARABIC_OPTION_LABELS: Record<OptionId, string> = {
  A: 'أ',
  B: 'ب',
  C: 'ج',
  D: 'د',
};

export const QuizInterface: React.FC<QuizInterfaceProps> = ({
  questions,
  settings,
  quizTitle = 'محاكي اختبار القدرات العامة - القسم الكمي',
  onFinish,
  onExit,
}) => {
  const total = questions.length;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, OptionId>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  const [timeRemaining, setTimeRemaining] = useState<number>(settings.timeLimitSeconds);
  const [timeSpent, setTimeSpent] = useState<number>(0);
  const [questionTimeSpent, setQuestionTimeSpent] = useState<Record<string, number>>({});
  
  // شاشات وحالات إضافية
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [showNavDrawer, setShowNavDrawer] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  const currentQuestion = questions[currentIndex];

  // إدارة المؤقت
  useEffect(() => {
    if (settings.timeLimitSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });

      setTimeSpent((prev) => prev + 1);

      if (currentQuestion) {
        setQuestionTimeSpent((prev) => ({
          ...prev,
          [currentQuestion.id]: (prev[currentQuestion.id] || 0) + 1,
        }));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [settings.timeLimitSeconds, currentQuestion]);

  // تبديل ملء الشاشة
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // اختيار إجابة
  const handleSelectOption = (optionId: OptionId) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: optionId,
    }));
  };

  // حذف إجابة السؤال الحالي
  const handleClearAnswer = () => {
    setUserAnswers((prev) => {
      const next = { ...prev };
      delete next[currentQuestion.id];
      return next;
    });
  };

  // تبديل علامة المراجعة
  const handleToggleFlag = () => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // الانتقال للأسئلة
  const handleNext = () => {
    setShowExplanation(false);
    if (currentIndex < total - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    setShowExplanation(false);
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setShowExplanation(false);
    setCurrentIndex(index);
    setShowNavDrawer(false);
  };

  // اختصارات لوحة المفاتيح
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowLeft') {
        // في الواجهة العربية، السهم الأيسر هو التالي
        handleNext();
      } else if (e.key === 'ArrowRight') {
        handlePrev();
      } else if (e.key === '1' || e.key.toLowerCase() === 'a') {
        handleSelectOption('A');
      } else if (e.key === '2' || e.key.toLowerCase() === 'b') {
        handleSelectOption('B');
      } else if (e.key === '3' || e.key.toLowerCase() === 'c') {
        handleSelectOption('C');
      } else if (e.key === '4' || e.key.toLowerCase() === 'd') {
        handleSelectOption('D');
      } else if (e.key.toLowerCase() === 'f' || e.key === 'م') {
        handleToggleFlag();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, currentQuestion]);

  // إحصائيات سريعة للوحة التنقل
  const answeredCount = useMemo(() => Object.keys(userAnswers).length, [userAnswers]);
  const flaggedCount = useMemo(() => Object.values(flaggedQuestions).filter(Boolean).length, [flaggedQuestions]);
  const unansweredCount = total - answeredCount;

  // تجهيز النتيجة النهائية
  const calculateResult = useCallback((): QuizResult => {
    let correctCount = 0;
    const categoryPerformance: Record<string, { total: number; correct: number }> = {};

    const detailedAnswers = questions.map((q) => {
      const userAnswer = userAnswers[q.id];
      const isCorrect = userAnswer === q.correctOption;

      if (isCorrect) {
        correctCount++;
      }

      // تصنيف الأقسام
      const catKey = q.categoryTitle || q.categoryId || 'عام';
      if (!categoryPerformance[catKey]) {
        categoryPerformance[catKey] = { total: 0, correct: 0 };
      }
      categoryPerformance[catKey].total++;
      if (isCorrect) {
        categoryPerformance[catKey].correct++;
      }

      return {
        question: q,
        userAnswer,
        isCorrect,
        timeSpentSeconds: questionTimeSpent[q.id] || 0,
      };
    });

    const scorePercentage = Math.round((correctCount / total) * 100);

    return {
      totalQuestions: total,
      correctAnswers: correctCount,
      wrongAnswers: answeredCount - correctCount,
      unanswered: unansweredCount,
      percentageScore: scorePercentage,
      totalTimeSeconds: timeSpent,
      categoryPerformance,
      detailedAnswers,
    };
  }, [questions, userAnswers, questionTimeSpent, total, answeredCount, unansweredCount, timeSpent]);

  // إنهاء الاختبار التلقائي أو اليدوي
  const handleAutoSubmit = () => {
    const result = calculateResult();
    onFinish(result);
  };

  const handleConfirmSubmit = () => {
    setShowConfirmSubmit(false);
    const result = calculateResult();
    onFinish(result);
  };

  // تنسيق الوقت (دقائق:ثواني)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isCurrentFlagged = flaggedQuestions[currentQuestion?.id];
  const currentAnswer = userAnswers[currentQuestion?.id];

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      
      {/* ========================================================================= */}
      {/* 1. الشريط العلوي (Alaqsam & Qiyas Modern Exam Header) */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0d1424]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          
          {/* الشعار وعنوان الاختبار */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 flex items-center justify-center font-bold text-amber-600 dark:text-amber-400 text-lg shadow-sm">
                ط
              </span>
              <div>
                <h1 className="text-base font-bold text-slate-800 dark:text-white leading-tight hidden sm:block">
                  {quizTitle}
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-500/20">
                    <Zap className="w-3 h-3" />
                    {settings.mode === 'Speed_Challenge' ? 'تحدي طرقع للسرعة' : settings.mode === 'Practice_Mode' ? 'وضع التدريب الفوري' : 'محاكي قياس الفعلي'}
                  </span>
                  <span className="hidden md:inline">• السؤال {currentIndex + 1} من {total}</span>
                </div>
              </div>
            </div>
          </div>

          {/* المؤقت الزمني وأزرار التحكم العلوية */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* مؤقت قياس الذكي */}
            {settings.timeLimitSeconds > 0 && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl font-mono text-sm font-bold border transition-all ${
                timeRemaining <= 120 
                  ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 animate-pulse' 
                  : timeRemaining <= 300 
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' 
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}

            {/* فتح لوحة شبكة الأسئلة */}
            <button
              onClick={() => setShowNavDrawer(!showNavDrawer)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition"
              title="لوحة الأسئلة السريعة"
            >
              <Grid3X3 className="w-4 h-4 text-amber-500" />
              <span className="hidden sm:inline">شبكة الأسئلة</span>
              <span className="bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-md font-bold text-[11px]">
                {currentIndex + 1}/{total}
              </span>
            </button>

            {/* زر ملء الشاشة */}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition hidden sm:flex"
              title="ملء الشاشة"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* زر تسليم وإنهاء الاختبار */}
            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="px-4 py-1.5 text-xs sm:text-sm font-bold rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-sm hover:shadow-glow transition-all"
            >
              إنهاء وتسليم
            </button>
          </div>

        </div>

        {/* شريط التقدم الدقيق */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1">
          <div 
            className="bg-gradient-to-r from-amber-500 to-yellow-400 h-1 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
          />
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. جسم شاشة الاختبار (المنطقة المركزية + لوحة التنقل) */}
      {/* ========================================================================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* العمود الرئيسي: بطاقة السؤال والخيارات وأدوات التحكم (8 أو 9 أعمدة) */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col gap-4">
          
          {/* بطاقة السؤال الرئيسية */}
          <div className="bg-white dark:bg-[#0d1424] rounded-2xl p-5 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between flex-1 relative overflow-hidden">
            
            {/* رأس السؤال والتصنيف */}
            <div>
              <div className="flex items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-amber-500 text-slate-950 text-xs font-black px-2.5 py-1 rounded-lg">
                    سؤال {currentIndex + 1}
                  </span>
                  {currentQuestion.categoryTitle && (
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                      {currentQuestion.categoryTitle}
                    </span>
                  )}
                  {currentQuestion.topicTitle && (
                    <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                      • {currentQuestion.topicTitle}
                    </span>
                  )}
                </div>

                {/* زر تمييز السؤال للمراجعة (Flag for review) */}
                <button
                  onClick={handleToggleFlag}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isCurrentFlagged 
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40 shadow-sm' 
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                  title="مراجعة لاحقاً (اختصار: F)"
                >
                  <Flag className={`w-3.5 h-3.5 ${isCurrentFlagged ? 'fill-amber-500 text-amber-500' : ''}`} />
                  <span>{isCurrentFlagged ? 'معلّم للمراجعة' : 'مراجعة لاحقاً'}</span>
                </button>
              </div>

              {/* نص السؤال ومعادلات KaTeX */}
              <div className="text-lg sm:text-xl font-medium text-slate-900 dark:text-slate-100 leading-relaxed min-h-[70px]">
                <MathRenderer content={currentQuestion.questionText} />
              </div>

              {/* رسم توضيحي هندسي SVG إن وجد */}
              {currentQuestion.svgDiagram && (
                <div 
                  className="my-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.svgDiagram }}
                />
              )}

              {/* خيارات الإجابة الأربعة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                {currentQuestion.options.map((option, optIdx) => {
                  const isSelected = currentAnswer === option.id;
                  const arabicLetter = ARABIC_OPTION_LABELS[option.id];

                  return (
                    <button
                      key={option.id}
                      onClick={() => handleSelectOption(option.id)}
                      className={`group relative flex items-center gap-4 p-4 rounded-xl border text-right transition-all duration-200 ${
                        isSelected
                          ? 'bg-amber-500/10 dark:bg-amber-500/15 border-amber-500 text-slate-950 dark:text-white ring-2 ring-amber-500/30 shadow-sm'
                          : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-amber-400/60 dark:hover:border-amber-500/50 hover:bg-slate-100/70 dark:hover:bg-slate-800/80'
                      }`}
                    >
                      {/* دائرة الحرف (أ، ب، ج، د) */}
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:border-amber-400'
                      }`}>
                        {arabicLetter}
                      </span>

                      {/* نص الخيار مع دعم KaTeX */}
                      <div className="flex-1 text-base font-semibold">
                        <MathRenderer content={option.text} />
                      </div>

                      {/* مؤشر رقمي سريع للاختصار */}
                      <span className="text-[10px] font-mono text-slate-400 opacity-40 group-hover:opacity-100">
                        [{optIdx + 1}]
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* أدوات وضع التدريب الفوري (Flash Mode) - كشف طريقة طرقع */}
            {(settings.allowInstantExplanation || settings.mode === 'Practice_Mode') && (
              <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <button
                  onClick={() => setShowExplanation(!showExplanation)}
                  className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 rounded-xl border border-amber-500/20 transition-all w-fit"
                >
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span>{showExplanation ? 'إخفاء طريقة طرقع السريعة' : 'كشف طريقة طرقع السريعة والحل الذكي'}</span>
                </button>

                {showExplanation && (
                  <div className="mt-3 p-4 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/30 text-sm leading-relaxed animate-in fade-in duration-200">
                    <div className="flex items-center gap-2 mb-2 font-bold text-amber-600 dark:text-amber-400">
                      <Zap className="w-4 h-4" />
                      <span>استراتيجية طرقع الذكية:</span>
                      <span className="text-xs font-normal text-slate-500">
                        (الإجابة الصحيحة هي: {ARABIC_OPTION_LABELS[currentQuestion.correctOption]})
                      </span>
                    </div>
                    <MathRenderer content={currentQuestion.explanation} />
                  </div>
                )}
              </div>
            )}

            {/* شريط الإجراءات السفلي (السابق، التالي، حذف الإجابة) */}
            <div className="flex items-center justify-between gap-3 pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/80">
              
              {/* زر السابق */}
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="w-4 h-4" />
                <span>السابق</span>
              </button>

              {/* زر حذف الإجابة إن كان مجاباً */}
              {currentAnswer && (
                <button
                  onClick={handleClearAnswer}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold transition"
                >
                  حذف الاختيار
                </button>
              )}

              {/* زر التالي أو إنهاء الاختبار عند آخر سؤال */}
              {currentIndex < total - 1 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition"
                >
                  <span>التالي</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmSubmit(true)}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تسليم الإجابات</span>
                </button>
              )}

            </div>

          </div>

          {/* نصائح واختصارات سريعة */}
          <div className="hidden sm:flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 px-2">
            <span>💡 اختصارات لوحة المفاتيح: الأرقام (1-4) للاختيارات • السهمين (← →) للتنقل • (F) للمراجعة</span>
            <span>المصدر: {currentQuestion.source || 'تجميعات قدرات'}</span>
          </div>

        </div>

        {/* العمود الجانبي: لوحة التنقل السريع بين الأسئلة (Qiyas-Style Navigation Grid) */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <div className="bg-white dark:bg-[#0d1424] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm sticky top-24">
            
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-amber-500" />
                <span>لوحة الأسئلة السريعة</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {answeredCount}/{total}
              </span>
            </div>

            {/* دليل الألوان والحالات */}
            <div className="grid grid-cols-2 gap-2 text-[11px] mb-4 text-slate-600 dark:text-slate-400 font-medium">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500 shrink-0" />
                <span>تمت الإجابة ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-amber-500 shrink-0" />
                <span>للمراجعة ({flaggedCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-200 dark:bg-slate-700 shrink-0" />
                <span>غير مجاب ({unansweredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md border-2 border-blue-500 bg-blue-500/20 shrink-0" />
                <span>السؤال الحالي</span>
              </div>
            </div>

            {/* شبكة أرقام الأسئلة */}
            <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto p-1">
              {questions.map((q, idx) => {
                const isAnswered = Boolean(userAnswers[q.id]);
                const isFlagged = Boolean(flaggedQuestions[q.id]);
                const isCurrent = idx === currentIndex;

                let btnStyles = 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

                if (isCurrent) {
                  btnStyles = 'border-2 border-blue-500 bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black shadow-sm scale-105';
                } else if (isFlagged) {
                  btnStyles = 'bg-amber-500 text-slate-950 font-bold border-amber-500 shadow-sm';
                } else if (isAnswered) {
                  btnStyles = 'bg-emerald-500 text-white font-bold border-emerald-500';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => handleJumpToQuestion(idx)}
                    className={`relative h-10 rounded-xl text-xs flex items-center justify-center font-mono transition-all hover:scale-105 border ${btnStyles}`}
                    title={`سؤال ${idx + 1}`}
                  >
                    <span>{idx + 1}</span>
                    {isFlagged && !isCurrent && (
                      <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ملخص الإجراءات السريعة */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              <button
                onClick={() => setShowConfirmSubmit(true)}
                className="w-full py-2.5 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition"
              >
                مراجعة وإنهاء الاختبار
              </button>
              <button
                onClick={onExit}
                className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-rose-500 transition text-center"
              >
                الخروج من الاختبار الحالي
              </button>
            </div>

          </div>
        </aside>

      </main>

      {/* ========================================================================= */}
      {/* 3. نافذة تأكيد تسليم الاختبار (Submission Confirmation Modal) */}
      {/* ========================================================================= */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#0d1424] rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">
              هل أنت مستعد لتسليم الاختبار؟
            </h3>
            
            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mb-6">
              تأكد من مراجعة كافة الأسئلة، فلن تتمكن من تعديل إجاباتك بعد التسليم.
            </p>

            {/* كروت الإحصائيات قبل التسليم */}
            <div className="grid grid-cols-3 gap-2 text-center mb-6">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="block text-lg font-black text-emerald-600 dark:text-emerald-400">{answeredCount}</span>
                <span className="text-[11px] text-slate-500 font-medium">تم حلها</span>
              </div>
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <span className="block text-lg font-black text-amber-600 dark:text-amber-400">{flaggedCount}</span>
                <span className="text-[11px] text-slate-500 font-medium">للمراجعة</span>
              </div>
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="block text-lg font-black text-rose-600 dark:text-rose-400">{unansweredCount}</span>
                <span className="text-[11px] text-slate-500 font-medium">متروكة</span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="mb-6 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-500/30 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>تنبيه: لديك {unansweredCount} أسئلة لم تقم بالإجابة عليها بعد!</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmSubmit}
                className="flex-1 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md transition"
              >
                تأكيد التسليم وعرض النتيجة
              </button>
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="px-4 py-3 rounded-xl font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                متابعة الحل
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
