import React, { useState, useRef, useEffect } from 'react';
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
  Minimize,
  Lightbulb,
  Award,
  Eye,
  X,
  Lock
} from 'lucide-react';
import { Lesson, CourseModule, LessonAttachment, CourseFileItem } from '../types';
import { TarqaUser } from '../lib/supabase';
import { SecureVideoPlayer } from './SecureVideoPlayer';
import { downloadTrackingService } from '../lib/downloadTrackingService';
import { fileStorageService, isMobileDevice } from '../lib/fileStorageService';
import { PdfPreviewModal } from './PdfPreviewModal';
import { isUserSubscribed, coursesStorage } from '../lib/subscriptionService';

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
  // حماية آمنة وشاشة بديلة في حال كان الدرس أو الباب غير محدد لمنع أي خطأ في واجهة React
  if (!currentLesson || !currentModule) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-cairo">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-3xl font-black mb-4">
          🎓
        </div>
        <h2 className="text-xl font-black text-slate-900 dark:text-white mb-2">لم يتم تحديد المحاضرة المطلوبة</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
          يرجى الرجوع إلى صفحة الدورات والمحاضرات واختيار أي درس ترغب في مشاهدته.
        </p>
        <button
          onClick={onBackToRoadmap}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs shadow-md hover:scale-105 transition cursor-pointer"
        >
          الرجوع للمحاضرات والدورات ⬅️
        </button>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'attachments' | 'quiz' | 'tarqa_tips'>('attachments');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isCompleted, setIsCompleted] = useState<boolean>(Boolean(currentLesson?.isCompleted));
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState<boolean>(false);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
  const vimeoIframeRef = useRef<HTMLIFrameElement>(null);

  // تحديث حالة الإكمال تلقائياً عند تغيير الدرس المختار
  useEffect(() => {
    setIsCompleted(Boolean(currentLesson?.isCompleted));
  }, [currentLesson?.id, currentLesson?.isCompleted]);

  // حالة معاينة ملف الـ PDF المرفق
  const [previewFile, setPreviewFile] = useState<CourseFileItem | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<{
    fileName: string;
    url: string;
    title: string;
  } | null>(null);

  // استخراج رابط الـ Embed ليوتيوب
  // فحص واستخراج روابط التشغيل لليوتيوب وفيميو والروابط المباشرة
  const isYouTube = (url: string = '', provider: string = '') => {
    if (provider === 'youtube') return true;
    return url.includes('youtube.com') || url.includes('youtu.be');
  };

  const isVimeo = (url: string = '', provider: string = '') => {
    if (provider === 'vimeo') return true;
    return url.includes('vimeo.com');
  };

  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
    const videoId = match ? match[1] : '';
    return `https://www.youtube-nocookie.com/embed/${videoId || 'dQw4w9WgXcQ'}?autoplay=0&rel=0&modestbranding=1&playsinline=1&enablejsapi=1`;
  };

  const getVimeoEmbedUrl = (url: string) => {
    if (!url) return '';
    const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
    const videoId = match ? match[1] : '';
    return `https://player.vimeo.com/video/${videoId || ''}?badge=0&autopause=0&player_id=0`;
  };

  // التحكم بسرعة الشرح في جميع المشغلات (فيديو عادي، مشغل مشفر، ويوتيوب وفيميو)
  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);

    // 1. يوتيوب عبر postMessage
    if (youtubeIframeRef.current?.contentWindow) {
      try {
        youtubeIframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setPlaybackRate',
            args: [speed]
          }),
          '*'
        );
      } catch (e) {}
    }

    // 2. فيميو عبر postMessage
    if (vimeoIframeRef.current?.contentWindow) {
      try {
        vimeoIframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            method: 'setPlaybackRate',
            value: speed
          }),
          '*'
        );
      } catch (e) {}
    }

    // 3. أي فيديو HTML5 في المشغل الداخلي أو الصفحة
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    document.querySelectorAll('video').forEach((v) => {
      try {
        v.playbackRate = speed;
      } catch (e) {}
    });
  };

  // إعادة تطبيق السرعة تلقائياً عند تغيير الدرس أو إعادة التحميل
  useEffect(() => {
    if (youtubeIframeRef.current?.contentWindow) {
      try {
        youtubeIframeRef.current.contentWindow.postMessage(
          JSON.stringify({
            event: 'command',
            func: 'setPlaybackRate',
            args: [playbackSpeed]
          }),
          '*'
        );
      } catch (e) {}
    }
    document.querySelectorAll('video').forEach((v) => {
      try {
        v.playbackRate = playbackSpeed;
      } catch (e) {}
    });
  }, [currentLesson.id, playbackSpeed]);

  // ملء وتصغير الشاشة لمنطقة مشغل الفيديو مع دعم كامل للأندرويد وiOS Safari والبديل المرئي CSS
  const togglePlayerFullscreen = () => {
    const doc = document as any;
    const isNativeFs = !!(
      doc.fullscreenElement ||
      doc.webkitFullscreenElement ||
      doc.mozFullScreenElement ||
      doc.msFullscreenElement
    );

    if (isNativeFs || isPlayerFullscreen) {
      setIsPlayerFullscreen(false);
      try {
        if (doc.exitFullscreen) {
          doc.exitFullscreen().catch(() => {});
        } else if (doc.webkitExitFullscreen) {
          doc.webkitExitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          doc.mozCancelFullScreen();
        } else if (doc.msExitFullscreen) {
          doc.msExitFullscreen();
        }
      } catch (e) {}
      return;
    }

    const container = playerContainerRef.current as any;
    const internalVideo = container?.querySelector('video') as any;

    // محاولة تشغيل Native Fullscreen على الحاوية
    if (container) {
      if (typeof container.requestFullscreen === 'function') {
        container
          .requestFullscreen()
          .then(() => setIsPlayerFullscreen(true))
          .catch(() => {
            // إذا رفض المتصفح (مثلاً داخل متصفح تيليجرام أو أذونات مقيدة) أو iOS:
            if (internalVideo && typeof internalVideo.webkitEnterFullscreen === 'function') {
              try {
                internalVideo.webkitEnterFullscreen();
                setIsPlayerFullscreen(true);
                return;
              } catch (e) {}
            }
            setIsPlayerFullscreen(true);
          });
        return;
      } else if (typeof container.webkitRequestFullscreen === 'function') {
        try {
          container.webkitRequestFullscreen();
          setIsPlayerFullscreen(true);
          return;
        } catch (e) {}
      } else if (typeof container.mozRequestFullScreen === 'function') {
        try {
          container.mozRequestFullScreen();
          setIsPlayerFullscreen(true);
          return;
        } catch (e) {}
      } else if (typeof container.msRequestFullscreen === 'function') {
        try {
          container.msRequestFullscreen();
          setIsPlayerFullscreen(true);
          return;
        } catch (e) {}
      }
    }

    // دعم خاص لـ iPhone Safari على عنصر الفيديو
    if (internalVideo && typeof internalVideo.webkitEnterFullscreen === 'function') {
      try {
        internalVideo.webkitEnterFullscreen();
        setIsPlayerFullscreen(true);
        return;
      } catch (e) {}
    }

    // بديل CSS المرئي الأنيق الذي يعمل 100% على كافة الشاشات والمتصفحات
    setIsPlayerFullscreen(true);
  };

  // مراقبة أحداث الخروج من ملء الشاشة ومفتاح Esc
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isNativeFs = !!(
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement
      );
      if (!isNativeFs && isPlayerFullscreen) {
        setIsPlayerFullscreen(false);
      } else if (isNativeFs) {
        setIsPlayerFullscreen(true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPlayerFullscreen) {
        setIsPlayerFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isPlayerFullscreen]);

  const handleToggleCompleted = () => {
    const nextState = !isCompleted;
    setIsCompleted(nextState);
    if (nextState && currentLesson?.id) {
      onCompleteLesson(currentLesson.id);
    }
  };

  // إيجاد الدرس التالي والسابق بأمان تام
  const lessonsList = currentModule?.lessons || [];
  const currentIndex = lessonsList.findIndex((l) => l?.id === currentLesson?.id);
  const prevLesson = currentIndex > 0 ? lessonsList[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessonsList.length - 1 ? lessonsList[currentIndex + 1] : null;

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 flex flex-col font-cairo">
      
      {/* الشريط العلوي لغرفة المحاضرة - متجاوب ومضغوط المساحات تماماً على الموبايل */}
      <header className="sticky top-0 z-20 bg-white/85 dark:bg-[#0d0915]/85 backdrop-blur-2xl border-b border-sky-200/60 dark:border-amber-500/20 px-2 sm:px-6 h-12 sm:h-14 flex items-center justify-between gap-1.5 sm:gap-4">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={onBackToRoadmap}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-amber-500 font-bold text-[11px] sm:text-xs transition shrink-0 cursor-pointer"
            title="العودة للمسار"
          >
            <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden xs:inline sm:inline">العودة للمسار</span>
            <span className="xs:hidden sm:hidden">العودة</span>
          </button>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block shrink-0" />

          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <span className="text-slate-400 hidden md:inline-block truncate">{currentModule.title}</span>
            <span className="text-slate-400 hidden md:inline-block">•</span>
            {(() => {
              const currentInstructors = coursesStorage.getInstructors();
              const instructor = currentInstructors.find((i) => i.id === (currentLesson.teacherId || 'teacher_1'));
              const isT2 = currentLesson.teacherId === 'teacher_2';
              const name = instructor?.fullName || instructor?.name || currentLesson.teacherName || (isT2 ? 'مدرس 2' : 'مدرس 1');
              const icon = instructor?.avatarIcon || (isT2 ? '⚡' : '👨‍🏫');
              return (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                  isT2
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}>
                  {icon} {name}
                </span>
              );
            })()}
            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[110px] xs:max-w-[190px] sm:max-w-md text-[11px] sm:text-xs">
              {currentLesson.title}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggleCompleted}
            className={`flex items-center gap-1 px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition shadow-sm shrink-0 cursor-pointer ${
              isCompleted
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/15 hover:text-emerald-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="hidden xs:inline">{isCompleted ? 'تم إكمال الدرس ✅' : 'تحديد كمكتمل'}</span>
            <span className="xs:hidden">{isCompleted ? 'مكتمل ✅' : 'إكمال'}</span>
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي: مشغل الفيديو + القائمة الجانبية */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6">
        
        {/* القسم الرئيسي (مشغل الفيديو والمذكرات): 8 أعمدة */}
        <div className="lg:col-span-8 flex flex-col gap-3 sm:gap-6">
          
          {/* مشغل الفيديو: يدعم يوتيوب، فيميو، والمشغل الآمن المشفر للروابط المباشرة مع وضع ملء الشاشة الشامل */}
          <div
            ref={playerContainerRef}
            className={`transition-all duration-200 ${
              isPlayerFullscreen
                ? 'fixed inset-0 z-[99999] w-screen h-screen bg-black flex flex-col justify-center items-center p-0 m-0'
                : 'relative w-full'
            }`}
          >
            {/* زر عائم لتصغير الشاشة عند تفعيل ملء الشاشة */}
            {isPlayerFullscreen && (
              <button
                type="button"
                onClick={togglePlayerFullscreen}
                className="absolute top-4 right-4 z-50 px-3.5 py-1.5 rounded-xl bg-black/85 hover:bg-black text-white border border-amber-500/60 text-xs font-bold flex items-center gap-1.5 shadow-2xl backdrop-blur-md cursor-pointer transition active:scale-95"
              >
                <Minimize className="w-4 h-4 text-amber-400" />
                <span>تصغير الشاشة ✕</span>
              </button>
            )}

            {isYouTube(currentLesson.videoUrl, currentLesson.videoProvider) ? (
              <div className={`relative aspect-video overflow-hidden bg-black shadow-2xl ${
                isPlayerFullscreen
                  ? 'w-full h-full max-h-screen rounded-none border-0'
                  : 'w-full rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800'
              }`}>
                <iframe
                  ref={youtubeIframeRef}
                  src={getYouTubeEmbedUrl(currentLesson.videoUrl)}
                  title={currentLesson.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowFullScreen
                  onLoad={() => {
                    try {
                      youtubeIframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({
                          event: 'command',
                          func: 'setPlaybackRate',
                          args: [playbackSpeed]
                        }),
                        '*'
                      );
                    } catch (e) {}
                  }}
                />
                {/* علامة مائية عائمة لمعرّف المستخدم */}
                <div className="absolute top-4 left-4 pointer-events-none z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-white text-[10px] font-mono select-none">
                  <span className="text-amber-400 font-bold">طالب طرقع: </span>
                  <span>#{currentUser?.id?.slice(0, 10) || 'GUEST'}</span>
                </div>
              </div>
            ) : isVimeo(currentLesson.videoUrl, currentLesson.videoProvider) ? (
              <div className={`relative aspect-video overflow-hidden bg-black shadow-2xl ${
                isPlayerFullscreen
                  ? 'w-full h-full max-h-screen rounded-none border-0'
                  : 'w-full rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800'
              }`}>
                <iframe
                  ref={vimeoIframeRef}
                  src={getVimeoEmbedUrl(currentLesson.videoUrl)}
                  title={currentLesson.title}
                  className="w-full h-full border-0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                />
                <div className="absolute top-4 left-4 pointer-events-none z-10 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-md border border-amber-500/30 text-white text-[10px] font-mono select-none">
                  <span className="text-amber-400 font-bold">طالب طرقع: </span>
                  <span>#{currentUser?.id?.slice(0, 10) || 'GUEST'}</span>
                </div>
              </div>
            ) : (
              <SecureVideoPlayer
                src={currentLesson.videoUrl}
                title={currentLesson.title}
                currentUser={currentUser}
                onEnded={() => onCompleteLesson(currentLesson.id)}
                playbackSpeed={playbackSpeed}
                onSpeedChange={handleSpeedChange}
              />
            )}
          </div>

          {/* أزرار التحكم بالسرعة وملء الشاشة والانتقال - متقاربة وأنيقة جداً على الموبايل */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-2xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                  سرعة الشرح:
                </span>
                <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-100 dark:bg-slate-900 p-0.5 sm:p-1 rounded-xl">
                  {[1, 1.25, 1.5, 2].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSpeedChange(s)}
                      className={`px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer select-none ${
                        playbackSpeed === s
                          ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                          : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* زر ملء الشاشة الخارجي المباشر */}
              <button
                type="button"
                onClick={togglePlayerFullscreen}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition cursor-pointer active:scale-95 select-none ${
                  isPlayerFullscreen
                    ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                    : 'bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800'
                }`}
                title={isPlayerFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
              >
                {isPlayerFullscreen ? (
                  <>
                    <Minimize className="w-3.5 h-3.5 text-slate-950" />
                    <span>تصغير</span>
                  </>
                ) : (
                  <>
                    <Maximize className="w-3.5 h-3.5 text-amber-500" />
                    <span>ملء الشاشة</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 sm:gap-2">
              {prevLesson ? (
                <button
                  type="button"
                  onClick={() => onSelectLesson(prevLesson)}
                  className="flex items-center justify-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-[11px] sm:text-xs font-bold transition text-center cursor-pointer"
                >
                  <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span className="truncate">المحاضرة السابقة</span>
                </button>
              ) : (
                <div className="sm:hidden" />
              )}

              {nextLesson && (
                <button
                  type="button"
                  onClick={() => onSelectLesson(nextLesson)}
                  className={`flex items-center justify-center gap-1 px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-black transition shadow-sm text-center cursor-pointer ${
                    !prevLesson ? 'col-span-2 sm:col-span-1' : ''
                  }`}
                >
                  <span className="truncate">المحاضرة التالية</span>
                  <ArrowLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                </button>
              )}
            </div>
          </div>

          {/* تبويبات ما بعد المحاضرة (المذكرات، الكويز، طريقة طرقع) - مسافات محسوبة ومضغوطة لتظهر كاملة على الموبايل */}
          <div className="tarqa-glass-card backdrop-blur-2xl rounded-2xl sm:rounded-3xl p-3 sm:p-6 shadow-[0_8px_30px_rgba(14,165,233,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.12)] overflow-hidden">
            <div className="flex items-center gap-1 sm:gap-2 border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-4 sm:mb-6 overflow-x-auto scrollbar-none flex-nowrap -mx-1 px-1">
              <button
                type="button"
                onClick={() => setActiveTab('attachments')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === 'attachments'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900/50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>المذكرات ({currentLesson.attachments?.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === 'quiz'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900/50'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>كويز التثبيت</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('tarqa_tips')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
                  activeTab === 'tarqa_tips'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-900/50'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                <span>طريقة طرقع</span>
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

                        <div className="flex items-center gap-1.5 shrink-0">
                          {(() => {
                            const isAttFree = Boolean((att as any).isFreePreview || currentLesson.isFreePreview);
                            const hasAccess = isAttFree || isUserSubscribed(currentUser);

                            return (
                              <>
                                {hasAccess ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPreviewFile({
                                          id: att.id,
                                          title: att.title,
                                          description: `ملف ومذكرة شرح مرفقة بدرس: ${currentLesson.title}`,
                                          fileUrl: att.fileUrl,
                                          fileSize: att.fileSize,
                                          pagesCount: 'ملف الدرس',
                                          fileType: att.fileType as any,
                                          isFreePreview: isAttFree,
                                        });
                                        setIsPreviewModalOpen(true);
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer active:scale-95"
                                      title="معاينة وتصفح محتوى الملف"
                                    >
                                      <Eye className="w-3.5 h-3.5 text-amber-500" />
                                      <span>معاينة</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        downloadTrackingService.trackDownload(
                                          {
                                            id: att.id,
                                            title: att.title,
                                            fileUrl: att.fileUrl,
                                            fileType: att.fileType,
                                            fileSize: att.fileSize,
                                          },
                                          currentUser
                                        );

                                        // على الموبايل، نفتح دائماً نافذة العرض والتحميل الشاملة لمنع حجب سفاري وكروم للتنزيل الصامت
                                        if (isMobileDevice()) {
                                          setPreviewFile({
                                            id: att.id,
                                            title: att.title,
                                            description: `ملف ومذكرة شرح مرفقة بدرس: ${currentLesson.title}`,
                                            fileUrl: att.fileUrl,
                                            fileSize: att.fileSize,
                                            pagesCount: 'ملف الدرس',
                                            fileType: att.fileType as any,
                                            isFreePreview: isAttFree,
                                          });
                                          setIsPreviewModalOpen(true);
                                          return;
                                        }

                                        const res = await fileStorageService.downloadWatermarkedFile(
                                          {
                                            title: att.title,
                                            fileUrl: att.fileUrl,
                                            description: `ملف ومذكرة شرح مرفقة بدرس: ${currentLesson.title}`,
                                            pagesCount: 'ملف الدرس',
                                          },
                                          currentUser
                                        );
                                        if (res && res.success) {
                                          setDownloadNotice({
                                            fileName: res.fileName,
                                            url: res.url,
                                            title: att.title,
                                          });
                                        }
                                      }}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-sm cursor-pointer active:scale-95"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      <span>تحميل</span>
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      alert('عفواً، معاينة هذا الملف وتنزيله متاحان فقط لمشتركي باقة طرقع 🔒');
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 font-bold text-xs transition cursor-pointer hover:text-amber-500 border border-dashed border-slate-200 dark:border-slate-700"
                                    title="هذا الملف متاح للمشتركين فقط"
                                  >
                                    <Lock className="w-3.5 h-3.5 text-amber-500" />
                                    <span>مغلق للمشتركين 🔒</span>
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
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
                    كويز تطبيقي مخصص لأفكار هذا الدرس للتأكد من فهم الشرح قبل المتابعة.
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
          <div className="tarqa-glass-card backdrop-blur-2xl rounded-3xl p-5 shadow-[0_8px_30px_rgba(14,165,233,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.12)] sticky top-20">
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
                        <span>•</span>
                        <span className={lesson.teacherId === 'teacher_2' ? 'text-emerald-500 font-bold' : 'text-amber-500 font-bold'}>
                          {lesson.teacherId === 'teacher_2' ? '⚡ مدرس 2' : '👨‍🏫 مدرس 1'}
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

      {/* نافذة معاينة ملف PDF التفاعلية لملفات الدرس المرفقة */}
      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setPreviewFile(null);
        }}
        file={previewFile}
        currentUser={currentUser}
        isSubscribed={isUserSubscribed(currentUser)}
        onSubscribeClick={() => {
          alert('هذا الملف متاح حصرياً لمشتركي باقة طرقع 🔒 يرجى تفعيل أو تجديد الاشتراك لتنزيل الملفات');
        }}
        onDownloadClick={(fileToDownload) => {
          const hasAccess = Boolean(fileToDownload.isFreePreview || isUserSubscribed(currentUser));
          if (!hasAccess) return;
          downloadTrackingService.trackDownload(
            {
              id: fileToDownload.id,
              title: fileToDownload.title,
              fileUrl: fileToDownload.fileUrl,
              fileType: fileToDownload.fileType,
              fileSize: fileToDownload.fileSize,
            },
            currentUser
          );
        }}
      />

      {/* شريط حفظ الملف المباشر على الجهاز */}
      {downloadNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-4 max-w-xl w-[92%] rounded-3xl bg-slate-950/95 text-white border-2 border-amber-500 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md">
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-0.5 text-right">
              <p className="text-xs sm:text-sm font-black text-white truncate">
                تم تجهيز [{downloadNotice.title}] للتحميل 📥
              </p>
              <p className="text-[11px] text-amber-400 font-medium">
                إذا لم يبدأ التنزيل تلقائياً على جهازك، اضغط على زر الحفظ:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <a
              href={downloadNotice.url}
              download={downloadNotice.fileName}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>حفظ الملف على الجهاز 💾</span>
            </a>
            <a
              href={downloadNotice.url}
              target="_blank"
              rel="noopener"
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="فتح الملف في تبويب مستقل للموبايل"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>فتح 👁️</span>
            </a>
            <button
              onClick={() => setDownloadNotice(null)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
