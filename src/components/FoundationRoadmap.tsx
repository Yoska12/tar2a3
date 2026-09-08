import React, { useState } from 'react';
import { 
  Sparkles, 
  Play, 
  CheckCircle2, 
  Clock, 
  BookOpen, 
  FileText, 
  Award, 
  ChevronLeft, 
  Lock, 
  Zap,
  Layers,
  ArrowLeft
} from 'lucide-react';
import { CourseModule, Lesson } from '../types';

interface FoundationRoadmapProps {
  modules: CourseModule[];
  onSelectLesson: (module: CourseModule, lesson: Lesson) => void;
  onStartModuleQuiz: (quizId: string) => void;
}

export const FoundationRoadmap: React.FC<FoundationRoadmapProps> = ({
  modules,
  onSelectLesson,
  onStartModuleQuiz,
}) => {
  const [expandedModuleId, setExpandedModuleId] = useState<string>(modules[0]?.id || '');

  // حساب الإحصائيات الشاملة
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDuration = modules.reduce((acc, m) => acc + (m.totalDurationMinutes || 0), 0);
  const completedLessons = modules.reduce(
    (acc, m) => acc + m.lessons.filter((l) => l.isCompleted).length,
    0
  );
  const progressPercentage = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* بانر الهوية الجديدة: التأسيس الكمي من الصفر */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/20 p-6 sm:p-10 shadow-sm">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>مسار تأسيس القدرات الكمي الرسمي • من الصفر حتى 100 🎯</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
            لا تعتمد على الحفظ العشوائي! <br />
            تأسس صح بـ <span className="text-amber-500">طريقة طرقع</span> الذهنية السريعة
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            مسار تسلسلي مبسط ومحكم يأخذ بيدك من المهارات الصفرية وجداول الضرب الخاطفة وصولاً لأصعب قوانين الهندسة والمتطابقات، مدعماً بمحاضرات فيديو مركزة ومذكرات PDF قابلة للتحميل وكويزات تطبيقية بعد كل درس.
          </p>

          {/* شريط الإنجاز العام لمسار التأسيس */}
          <div className="pt-2 max-w-xl space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>نسبة إنجازك في مسار التأسيس</span>
              <span className="text-amber-500 font-mono text-sm">{progressPercentage}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300/40 dark:border-slate-700/60">
              <div
                className="h-full bg-gradient-to-l from-amber-400 to-amber-500 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-medium">
              <span>✅ {completedLessons} من {totalLessons} محاضرة مكتملة</span>
              <span>•</span>
              <span>⏱️ {Math.round(totalDuration / 60)} ساعة شرح مركز</span>
              <span>•</span>
              <span>📑 15+ مذكرة PDF وملخص</span>
            </div>
          </div>
        </div>
      </section>

      {/* الأبواب التأسيسية التسلسلية (Foundation Roadmap Modules) */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            <span>خارطة الأبواب التأسيسية (5 أبواب شاملة)</span>
          </h2>
          <span className="text-xs font-bold text-slate-400">
            خطوة بخطوة بالترتيب التراكمي
          </span>
        </div>

        <div className="space-y-4">
          {modules.map((mod, modIdx) => {
            const isExpanded = expandedModuleId === mod.id;
            const completedInModule = mod.lessons.filter((l) => l.isCompleted).length;
            const modPercentage = mod.lessons.length > 0 ? Math.round((completedInModule / mod.lessons.length) * 100) : 0;

            return (
              <div
                key={mod.id}
                className={`rounded-3xl border transition-all overflow-hidden ${
                  isExpanded
                    ? 'bg-white dark:bg-[#0a0f1d] border-amber-500/30 shadow-md'
                    : 'bg-white/80 dark:bg-[#0a0f1d]/70 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {/* رأس الباب */}
                <div
                  onClick={() => setExpandedModuleId(isExpanded ? '' : mod.id)}
                  className="p-5 sm:p-6 flex items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center font-black text-lg shrink-0">
                      {modIdx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-base text-slate-900 dark:text-white truncate">
                          {mod.title}
                        </h3>
                        {modPercentage === 100 && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">
                            مكتمل ✅
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {completedInModule} / {mod.lessons.length} درس
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {mod.totalDurationMinutes} دقيقة
                      </div>
                    </div>

                    <div
                      className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center transition-transform ${
                        isExpanded ? 'rotate-90 text-amber-500' : ''
                      }`}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* قائمة محاضرات ودروس الباب (عند الفتح) */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/30 space-y-3">
                    {mod.lessons.map((lesson, lesIdx) => (
                      <div
                        key={lesson.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/40 transition group shadow-sm"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                              lesson.isCompleted
                                ? 'bg-emerald-500 text-white'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            {lesson.isCompleted ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              lesIdx + 1
                            )}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                                {lesson.title}
                              </h4>
                              {lesson.isFreePreview && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-bold">
                                  معاينة مجانية 🎁
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {lesson.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{lesson.durationMinutes} دقيقة</span>
                              </span>
                              {lesson.attachments && lesson.attachments.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>{lesson.attachments.length} مذكرة PDF للتحميل</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* أزرار الإجراء السريع */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          <button
                            onClick={() => onSelectLesson(mod, lesson)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm active:scale-95"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>شاهد المحاضرة</span>
                          </button>

                          {lesson.quizId && (
                            <button
                              onClick={() => onStartModuleQuiz(lesson.quizId!)}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition active:scale-95"
                              title="بدء كويز تطبيقي مباشر"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-500" />
                              <span className="hidden sm:inline-block">كويز الدرس</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};
