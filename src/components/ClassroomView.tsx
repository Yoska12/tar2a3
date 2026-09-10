import React, { useState, useRef } from 'react';
import { 
  Play, 
  CheckCircle2, 
  FileText, 
  Download, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  ArrowLeft, 
  Clock, 
  BookOpen, 
  ChevronRight, 
  ExternalLink,
  Volume2,
  Settings,
  Maximize,
  Lightbulb,
  Award
} from 'lucide-react';
import { Lesson, CourseModule, LessonAttachment } from '../types';
import { TarqaUser } from '../lib/supabase';
import { SecureVideoPlayer } from './SecureVideoPlayer';

interface ClassroomViewProps {
  currentModule: CourseModule;
  currentLesson: Lesson;
  currentUser?: TarqaUser | null;
  onSelectLesson: (lesson: Lesson) => void;
  onCompleteLesson: (lessonId: string) => void;
  onStartQuiz?: (quizId: string) => void;
  onBackToRoadmap: () => void;
}

export const ClassroomView: React.FC<ClassroomViewProps> = ({
  currentModule,
  currentLesson,
  currentUser,
  onSelectLesson,
  onCompleteLesson,
  onStartQuiz,
  onBackToRoadmap,
}) => {
  const [activeTab, setActiveTab] = useState<'attachments' | 'quiz' | 'tarqa_tips'>('attachments');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isCompleted, setIsCompleted] = useState<boolean>(currentLesson.isCompleted || false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // استخراج رابط الـ Embed ليوتيوب
  const getEmbedUrl = (url: string, speed: number) => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) {
        videoId = url.split('v=')[1]?.split('&')[0];
      } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1]?.split('?')[0];
      }
      return `https://www.youtube.com/embed/${videoId || 'dQw4w9WgXcQ'}?autoplay=0&rel=0&modestbranding=1`;
    }
    return url;
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleToggleCompleted = () => {
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    if (nextState) {
      onCompleteLesson(currentLesson.id);
    }
  };

  // إيجاد الدرس التالي والسابق
  const currentIndex = currentModule.lessons.findIndex((l) => l.id === currentLesson.id);
  const prevLesson = currentIndex > 0 ? currentModule.lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex < currentModule.lessons.length - 1 ? currentModule.lessons[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col font-cairo">
      
      {/* الشريط العلوي لغرفة المحاضرة */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0a0f1d]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToRoadmap}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 font-bold text-xs transition"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للمسار</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 hidden sm:inline-block">{currentModule.title}</span>
            <span className="text-slate-400 hidden sm:inline-block">•</span>
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">
              {currentLesson.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleCompleted}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
              isCompleted
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-500'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isCompleted ? 'تم إكمال الدرس ✅' : 'تحديد كمكتمل'}</span>
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي: مشغل الفيديو + القائمة الجانبية */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* القسم الرئيسي (مشغل الفيديو والمذكرات): 8 أعمدة */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* مشغل الفيديو الآمن والمشفر مع العلامة المائية المانعة للتسريب */}
          {currentLesson.videoProvider === 'uploaded_video' ||
          currentLesson.videoProvider === 'direct_url' ||
          !currentLesson.videoUrl.includes('youtube.com') ? (
            <SecureVideoPlayer
              src={currentLesson.videoUrl}
              title={currentLesson.title}
              currentUser={currentUser}
              onEnded={() => onCompleteLesson(currentLesson.id)}
            />
          ) : (
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-slate-200 dark:border-slate-800">
              <iframe
                src={getEmbedUrl(currentLesson.videoUrl, playbackSpeed)}
                title={currentLesson.title}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              {/* علامة مائية عائمة لمعرّف المستخدم حتى على فيديوهات يوتيوب */}
              <div className="absolute top-4 left-4 pointer-events-none z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-white text-[10px] font-mono select-none">
                <span className="text-amber-400 font-bold">طالب طرقع: </span>
                <span>#{currentUser?.id?.slice(0, 10) || 'GUEST'}</span>
              </div>
            </div>
          )}

          {/* أزرار التحكم بالسرعة والانتقال */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                سرعة الشرح:
              </span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                {[1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSpeedChange(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                      playbackSpeed === s
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {prevLesson && (
                <button
                  onClick={() => onSelectLesson(prevLesson)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>المحاضرة السابقة</span>
                </button>
              )}

              {nextLesson && (
                <button
                  onClick={() => onSelectLesson(nextLesson)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition shadow-sm"
                >
                  <span>المحاضرة التالية</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* تبويبات ما بعد المحاضرة (المذكرات، الكويز، طريقة طرقع) */}
          <div className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-4 mb-6">
              <button
                onClick={() => setActiveTab('attachments')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'attachments'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>المذكرات والملازم المرفقة ({currentLesson.attachments?.length || 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'quiz'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <HelpCircle className="w-4 h-4" />
                <span>كويز تثبيت المفهوم</span>
              </button>

              <button
                onClick={() => setActiveTab('tarqa_tips')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                  activeTab === 'tarqa_tips'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>طريقة طرقع في الدرس</span>
              </button>
            </div>

            {/* محتوى تبويب المذكرات */}
            {activeTab === 'attachments' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    حمل مذكرات وملخصات المحاضرة للمذاكرة بدون إنترنت:
                  </h4>
                </div>

                {currentLesson.attachments && currentLesson.attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentLesson.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {att.title}
                            </h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {att.fileSize} • {att.fileType === 'pdf' ? 'مذكرة شرح كاملة' : att.fileType === 'summary' ? 'خريطة مفاهيم' : 'ورقة عمل تدريبية'}
                            </p>
                          </div>
                        </div>

                        <a
                          href={att.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          download
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm shrink-0"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل</span>
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    لا توجد ملفات مرفقة إضافية لهذا الدرس. الشرح كافٍ ومباشر بالفيديو!
                  </div>
                )}
              </div>
            )}

            {/* محتوى تبويب الكويز */}
            {activeTab === 'quiz' && (
              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center mx-auto text-xl font-black">
                  🎯
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 dark:text-white">
                    جاهز لتطبيق ما تعلمته في المحاضرة؟
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                    كويز سريع من 5 إلى 10 أسئلة مخصصة تماماً لأفكار هذا الدرس، لضمان استيعاب القواعد الذهنية قبل المتابعة.
                  </p>
                </div>

                <button
                  onClick={() => onStartQuiz && onStartQuiz(currentLesson.quizId || 'f1111111-1111-1111-1111-111111111111')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>ابدأ كويز المحاضرة لتثبيت المعلومة</span>
                </button>
              </div>
            )}

            {/* محتوى تبويب طريقة طرقع */}
            {activeTab === 'tarqa_tips' && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-amber-500 font-bold text-xs">
                    <Sparkles className="w-4 h-4" />
                    <span>القاعدة الذهبية من منصة طرقع:</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    في اختبار القدرات، المعيار هو <strong className="text-amber-500">السرعة الذهنية</strong> وليس الحل الروتيني المطول. تدرب دائماً على تجزئة الأعداد والتعامل مع المسألة كمعادلة بصرية يمكنك حلها بمجرد النظر.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* القسم الجانبي (فهرس دروس الباب التأسيسي): 4 أعمدة */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm sticky top-20">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  محتويات الباب التأسيسي
                </span>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5 truncate max-w-[200px]">
                  {currentModule.title}
                </h3>
              </div>
              <div className="text-xs font-bold text-slate-400">
                {currentModule.lessons.length} محاضرات
              </div>
            </div>

            {/* قائمة الدروس التسلسلية */}
            <div className="space-y-2">
              {currentModule.lessons.map((lesson, idx) => {
                const isActive = lesson.id === currentLesson.id;
                return (
                  <button
                    key={lesson.id}
                    onClick={() => onSelectLesson(lesson)}
                    className={`w-full flex items-start gap-3 p-3 rounded-2xl text-right transition group ${
                      isActive
                        ? 'bg-amber-500/15 border border-amber-500/30 text-amber-500 shadow-sm'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-black'
                          : lesson.isCompleted
                          ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                      }`}
                    >
                      {lesson.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h5
                          className={`font-bold text-xs truncate ${
                            isActive ? 'text-amber-500' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {lesson.title}
                        </h5>
                        {lesson.isFreePreview && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[9px] font-bold shrink-0">
                            مجاني
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{lesson.durationMinutes} دقيقة</span>
                        </span>
                        {lesson.attachments && lesson.attachments.length > 0 && (
                          <span>• {lesson.attachments.length} مذكرات</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
