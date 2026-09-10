import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Lock,
  Unlock,
  Play,
  FileText,
  Clock,
  Plus,
  Edit3,
  Trash2,
  ShieldCheck,
  Crown,
  Layers,
  ArrowRight,
  ExternalLink,
  Zap,
  Star,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  Video
} from 'lucide-react';
import { CourseModule, Lesson, LessonAttachment, VideoProvider } from '../types';
import { TarqaUser } from '../lib/supabase';
import {
  ANNUAL_SUBSCRIPTION_PRICE_SAR,
  canEditCourses,
  isUserSubscribed,
  getSubscriptionDetails,
  activateAnnualSubscription,
  canAccessLesson,
  coursesStorage
} from '../lib/subscriptionService';

interface CoursesViewProps {
  currentUser?: TarqaUser | null;
  onOpenClassroom: (module: CourseModule, lesson: Lesson) => void;
  onBackToHome: () => void;
  onOpenAuth?: () => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  currentUser,
  onOpenClassroom,
  onBackToHome,
  onOpenAuth,
}) => {
  const [modules, setModules] = useState<CourseModule[]>(() => coursesStorage.getModules());
  const [expandedModuleId, setExpandedModuleId] = useState<string>(() => modules[0]?.id || '');
  const [subscriptionInfo, setSubscriptionInfo] = useState(() => getSubscriptionDetails(currentUser));
  const isEditor = canEditCourses(currentUser?.role, currentUser?.email);

  // وضع التعديل للمعلمين والمشرفين
  const [isEditMode, setIsEditMode] = useState(false);

  // نوافذ الاشتراك والتعديل
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeSuccessMessage, setSubscribeSuccessMessage] = useState<string | null>(null);

  // نافذة إضافة / تعديل محاضرة
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    description: '',
    videoUrl: '',
    videoProvider: 'youtube' as VideoProvider,
    durationMinutes: 15,
    isFreePreview: false,
    pdfTitle: '',
    pdfUrl: '',
  });

  // نافذة إضافة / تعديل باب
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    title: '',
    description: '',
  });

  // الاستماع لتغييرات الدورات والاشتراكات
  useEffect(() => {
    const handleSubChanged = () => {
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
    };
    const handleModulesChanged = (e: any) => {
      if (e.detail) setModules(e.detail);
      else setModules(coursesStorage.getModules());
    };

    window.addEventListener('tarqa_subscription_changed', handleSubChanged);
    window.addEventListener('tarqa_user_changed', handleSubChanged);
    window.addEventListener('tarqa_courses_modules_changed', handleModulesChanged);

    return () => {
      window.removeEventListener('tarqa_subscription_changed', handleSubChanged);
      window.removeEventListener('tarqa_user_changed', handleSubChanged);
      window.removeEventListener('tarqa_courses_modules_changed', handleModulesChanged);
    };
  }, [currentUser]);

  // تحديث حالة الاشتراك عند تغير المستخدم
  useEffect(() => {
    setSubscriptionInfo(getSubscriptionDetails(currentUser));
  }, [currentUser]);

  // تنفيذ الاشتراك السنوي الفوري (75 ر.س)
  const handleConfirmSubscription = async () => {
    if (!currentUser) {
      setShowSubscribeModal(false);
      onOpenAuth?.();
      return;
    }

    setIsSubscribing(true);
    try {
      const res = await activateAnnualSubscription(currentUser);
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
      setSubscribeSuccessMessage(res.message);
      setTimeout(() => {
        setSubscribeSuccessMessage(null);
        setShowSubscribeModal(false);
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubscribing(false);
    }
  };

  // فتح المحاضرة أو نافذة الاشتراك
  const handleLessonClick = (module: CourseModule, lesson: Lesson) => {
    const hasAccess = canAccessLesson(lesson, currentUser);
    if (hasAccess) {
      onOpenClassroom(module, lesson);
    } else {
      setShowSubscribeModal(true);
    }
  };

  // حفظ المحاضرة
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonFormData.title.trim()) return;

    const attachments: LessonAttachment[] = [];
    if (lessonFormData.pdfTitle.trim() && lessonFormData.pdfUrl.trim()) {
      attachments.push({
        id: 'att-' + Date.now(),
        lessonId: editingLesson ? editingLesson.id : 'temp',
        title: lessonFormData.pdfTitle,
        fileUrl: lessonFormData.pdfUrl,
        fileSize: 'PDF',
        fileType: 'pdf',
      });
    }

    if (editingLesson) {
      const updated: Lesson = {
        ...editingLesson,
        title: lessonFormData.title,
        description: lessonFormData.description,
        videoUrl: lessonFormData.videoUrl,
        videoProvider: lessonFormData.videoProvider,
        durationMinutes: Number(lessonFormData.durationMinutes) || 15,
        isFreePreview: lessonFormData.isFreePreview,
        attachments: attachments.length > 0 ? attachments : editingLesson.attachments,
      };
      const updatedModules = coursesStorage.updateLesson(updated);
      setModules(updatedModules);
    } else {
      const newLesson: Lesson = {
        id: 'les-' + Date.now(),
        moduleId: targetModuleId,
        title: lessonFormData.title,
        description: lessonFormData.description,
        videoUrl: lessonFormData.videoUrl,
        videoProvider: lessonFormData.videoProvider,
        durationMinutes: Number(lessonFormData.durationMinutes) || 15,
        orderIndex: 99,
        isFreePreview: lessonFormData.isFreePreview,
        isPublished: true,
        attachments,
      };
      const updatedModules = coursesStorage.addLesson(targetModuleId, newLesson);
      setModules(updatedModules);
    }

    setLessonModalOpen(false);
  };

  // حذف المحاضرة
  const handleDeleteLesson = (moduleId: string, lessonId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه المحاضرة نهائياً؟')) {
      const updated = coursesStorage.deleteLesson(moduleId, lessonId);
      setModules(updated);
    }
  };

  // تبديل المعاينة المجانية
  const handleToggleFreePreview = (moduleId: string, lessonId: string) => {
    const updated = coursesStorage.toggleFreePreview(moduleId, lessonId);
    setModules(updated);
  };

  // حفظ الباب
  const handleSaveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleFormData.title.trim()) return;

    if (editingModule) {
      const updated: CourseModule = {
        ...editingModule,
        title: moduleFormData.title,
        description: moduleFormData.description,
      };
      const updatedModules = coursesStorage.updateModule(updated);
      setModules(updatedModules);
    } else {
      const newMod: CourseModule = {
        id: 'mod-' + Date.now(),
        title: moduleFormData.title,
        description: moduleFormData.description,
        orderIndex: modules.length + 1,
        isPublished: true,
        lessons: [],
      };
      const updatedModules = coursesStorage.addModule(newMod);
      setModules(updatedModules);
      setExpandedModuleId(newMod.id);
    }

    setModuleModalOpen(false);
  };

  // حذف الباب
  const handleDeleteModule = (moduleId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الباب التدريبي وكافة محاضراته؟')) {
      const updated = coursesStorage.deleteModule(moduleId);
      setModules(updated);
    }
  };

  // حساب الإحصائيات
  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);
  const totalDurationMinutes = modules.reduce((acc, m) => acc + m.lessons.reduce((lAcc, l) => lAcc + (l.durationMinutes || 0), 0), 0);
  const freePreviewsCount = modules.reduce((acc, m) => acc + m.lessons.filter(l => l.isFreePreview).length, 0);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8 font-cairo animate-in fade-in duration-200">
      
      {/* ======================================================================= */}
      {/* شريط المسار والرجوع للرئيسية */}
      {/* ======================================================================= */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للرئيسية</span>
        </button>

        {isEditor && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>صلاحية إدارة المحتوى (معلم / مشرف)</span>
            </span>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                isEditMode
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'إيقاف وضع التعديل' : 'تفعيل وضع التعديل ⚙️'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 1. قسم الهيرو لصفحة الدورات مع بطاقة الاشتراك السنوي بـ 75 ريال */}
      {/* ======================================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent dark:from-[#11192e] dark:to-[#070b14] border border-amber-500/25 p-6 sm:p-10 shadow-xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* النص الترحيبي وتفاصيل الدورة */}
          <div className="lg:col-span-7 flex flex-col items-start gap-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>دورات طرقع للتأسيس الكمي الشامل • العام التدريبي 1446</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-[1.3]">
              تأسيس القدرات من الصفر حتى 100 🎯 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-600 via-amber-500 to-yellow-500">
                شرح مركز، مذكرات، وحيل طرقع السريعة
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              اشتراك سنوي واحد يمنحك وصولاً كاملاً لمدة 365 يوماً إلى {modules.length} أبواب تأسيسية شاملة ({totalLessons} محاضرة تدريبية، مذكرات PDF قابلة للطباعة، وتطبيقات عملية بعد كل درس).
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 pt-2">
              <span className="flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-500" />
                <span>{modules.length} أبواب شاملة</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Video className="w-4 h-4 text-amber-500" />
                <span>{totalLessons} محاضرة مسجلة</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{Math.round(totalDurationMinutes / 60)} ساعة تدريبية</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <Sparkles className="w-4 h-4" />
                <span>{freePreviewsCount} محاضرات مجانية للمعاينة</span>
              </span>
            </div>
          </div>

          {/* بطاقة السعر والاشتراك (75 ريال / سنة) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-3xl bg-white/90 dark:bg-[#0d1424]/90 backdrop-blur-xl border-2 border-amber-500/40 p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  الباقة السنوية الموحدة
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  سنة كاملة (365 يوماً)
                </span>
              </div>

              {/* السعر الكبير */}
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white font-mono">
                  {ANNUAL_SUBSCRIPTION_PRICE_SAR}
                </span>
                <span className="text-sm font-bold text-slate-500">ريال سعودي / سنوياً</span>
              </div>

              {/* قائمة المميزات */}
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>فتح كافة المحاضرات بدون قيود</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>مذكرات وتلخيصات PDF قابلة للتحميل</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>كويزات قياس واختبارات تجريبية</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تحديثات مستمرة لأحدث نماذج 1446</span>
                </div>
              </div>

              {/* زر الاشتراك أو حالة الاشتراك الحالية */}
              {subscriptionInfo.isManager ? (
                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-center">
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-300 flex items-center justify-center gap-1.5">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>وصول إداري غير محدود مفعّل</span>
                  </span>
                </div>
              ) : subscriptionInfo.isSubscribed ? (
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-1">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اشتراكك سارٍ ونشط ✅</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    متبقي <strong>{subscriptionInfo.daysRemaining} يوماً</strong> • ينتهي في {subscriptionInfo.expiresDateFormatted}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowSubscribeModal(true)}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-md hover:shadow-glow transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>اشترك الآن بـ {ANNUAL_SUBSCRIPTION_PRICE_SAR} ريال فقط</span>
                </button>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* ======================================================================= */}
      {/* 2. شريط أدوات التعديل والإضافة المتاح للمعلمين والمشرفين */}
      {/* ======================================================================= */}
      {isEditor && isEditMode && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500 text-white">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">وضع إدارة محتوى الدورات مفعّل</h4>
              <p className="text-[11px] text-slate-500">بإمكانك كمعلم أو مشرف إضافة أبواب ومحاضرات وتعديل الروابط وتحديد المعاينات المجانية.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingModule(null);
                setModuleFormData({ title: '', description: '' });
                setModuleModalOpen(true);
              }}
              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة باب جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 3. كتالوج الأبواب التدريبية والمحاضرات (Courses Modules & Lessons) */}
      {/* ======================================================================= */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-6 h-6 text-amber-500" />
              <span>محتوى ومنهج الدورة ({modules.length} أبواب تأسيسية)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              اضغط على أي باب لاستعراض المحاضرات والمذكرات المرفقة
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {modules.map((mod, modIdx) => {
            const isExpanded = expandedModuleId === mod.id;
            const completedLessons = mod.lessons.filter(l => l.isCompleted).length;
            const modDuration = mod.lessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);

            return (
              <div
                key={mod.id}
                className="rounded-3xl bg-white/80 dark:bg-[#0c1324]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden transition-all"
              >
                {/* رأس الباب التدريبي */}
                <div
                  onClick={() => setExpandedModuleId(isExpanded ? '' : mod.id)}
                  className="p-5 sm:p-6 cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-black text-lg shrink-0">
                      {modIdx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                          {mod.title}
                        </h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                          {mod.lessons.length} محاضرات
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                        {mod.description}
                      </p>
                    </div>
                  </div>

                  {/* الجزء الأيسر من رأس الباب */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* أزرار تعديل وحذف الباب في وضع التعديل */}
                    {isEditor && isEditMode && (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setEditingModule(mod);
                            setModuleFormData({ title: mod.title, description: mod.description });
                            setModuleModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-purple-950 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition"
                          title="تعديل الباب"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(mod.id)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition"
                          title="حذف الباب"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                      {modDuration} دقيقة
                    </span>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* قائمة محاضرات الباب */}
                {isExpanded && (
                  <div className="border-t border-slate-100 dark:border-slate-800/80 p-4 sm:p-6 bg-slate-50/40 dark:bg-slate-900/40 space-y-3">
                    
                    {/* زر إضافة محاضرة جديدة للباب في وضع التعديل */}
                    {isEditor && isEditMode && (
                      <div className="pb-2">
                        <button
                          onClick={() => {
                            setTargetModuleId(mod.id);
                            setEditingLesson(null);
                            setLessonFormData({
                              title: '',
                              description: '',
                              videoUrl: '',
                              videoProvider: 'youtube',
                              durationMinutes: 15,
                              isFreePreview: false,
                              pdfTitle: '',
                              pdfUrl: '',
                            });
                            setLessonModalOpen(true);
                          }}
                          className="w-full py-2.5 rounded-xl border-2 border-dashed border-purple-500/40 hover:border-purple-500 text-purple-600 dark:text-purple-400 text-xs font-bold transition flex items-center justify-center gap-2 bg-purple-500/5"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة محاضرة جديدة لهذا الباب</span>
                        </button>
                      </div>
                    )}

                    {mod.lessons.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400">
                        لا توجد محاضرات في هذا الباب حتى الآن.
                      </div>
                    ) : (
                      mod.lessons.map((lesson, lesIdx) => {
                        const hasAccess = canAccessLesson(lesson, currentUser);

                        return (
                          <div
                            key={lesson.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              hasAccess
                                ? 'bg-white dark:bg-[#0c1324] border-slate-200/80 dark:border-slate-800 hover:border-amber-500/40'
                                : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/40 opacity-90'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                hasAccess 
                                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30' 
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                              }`}>
                                {hasAccess ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <Lock className="w-4 h-4" />}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                    {lesIdx + 1}. {lesson.title}
                                  </h4>

                                  {lesson.isFreePreview ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                      معاينة مجانية 🎁
                                    </span>
                                  ) : hasAccess ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      مفتوح باشتراكك ✅
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                                      <Lock className="w-2.5 h-2.5" />
                                      اشتراك 75 ر.س
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{lesson.durationMinutes} دقيقة</span>
                                  </span>
                                  {lesson.attachments && lesson.attachments.length > 0 && (
                                    <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                      <FileText className="w-3 h-3" />
                                      <span>مذكرة PDF مرفقة</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* أزرار الإجراء للمحاضرة */}
                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              {/* أزرار الإدارة للمعلم في وضع التعديل */}
                              {isEditor && isEditMode && (
                                <div className="flex items-center gap-1 mr-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                                  <button
                                    onClick={() => handleToggleFreePreview(mod.id, lesson.id)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                                      lesson.isFreePreview
                                        ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700'
                                    }`}
                                    title="تبديل وضع المعاينة المجانية"
                                  >
                                    {lesson.isFreePreview ? 'مجاني' : 'مدفوع'}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setTargetModuleId(mod.id);
                                      setEditingLesson(lesson);
                                      setLessonFormData({
                                        title: lesson.title,
                                        description: lesson.description || '',
                                        videoUrl: lesson.videoUrl,
                                        videoProvider: lesson.videoProvider,
                                        durationMinutes: lesson.durationMinutes,
                                        isFreePreview: lesson.isFreePreview,
                                        pdfTitle: lesson.attachments?.[0]?.title || '',
                                        pdfUrl: lesson.attachments?.[0]?.fileUrl || '',
                                      });
                                      setLessonModalOpen(true);
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 dark:hover:bg-purple-950 text-slate-600 dark:text-slate-300 hover:text-purple-600 transition"
                                    title="تعديل المحاضرة"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(mod.id, lesson.id)}
                                    className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-950 text-slate-600 dark:text-slate-300 hover:text-rose-600 transition"
                                    title="حذف المحاضرة"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}

                              {/* زر المشاهدة أو الاشتراك */}
                              {hasAccess ? (
                                <button
                                  onClick={() => handleLessonClick(mod, lesson)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition flex items-center gap-1.5"
                                >
                                  <Play className="w-3 h-3 fill-current" />
                                  <span>مشاهدة المحاضرة</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => setShowSubscribeModal(true)}
                                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 transition flex items-center gap-1.5"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>فتح المحاضرة (اشتراك)</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* نافذة الاشتراك السنوي بـ 75 ريال (Checkout / Subscription Modal) */}
      {/* ======================================================================= */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1322] border border-amber-500/30 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSubscribeModal(false)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-4">
              <GraduationCap className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1">
              الاشتراك في باقة دورات طرقع السنوية
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              فتح كامل المحتوى لمدة سنة كاملة (365 يوماً) لكافة المحاضرات والمذكرات
            </p>

            {/* تفاصيل السعر والفاتورة */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 mb-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">الباقة:</span>
                <span className="font-bold text-slate-900 dark:text-white">باقة طرقع السنوية الشاملة</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">مدة الوصول:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">سنة كاملة (365 يوماً)</span>
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-amber-500/20 font-black">
                <span className="text-slate-900 dark:text-white">إجمالي الرسوم:</span>
                <span className="text-xl text-amber-600 dark:text-amber-400 font-mono">
                  {ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س
                </span>
              </div>
            </div>

            {subscribeSuccessMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{subscribeSuccessMessage}</span>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleConfirmSubscription}
                disabled={isSubscribing}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 fill-current" />
                <span>{isSubscribing ? 'جاري التفعيل...' : `تأكيد الاشتراك بـ ${ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س سنوياً`}</span>
              </button>

              <button
                onClick={() => setShowSubscribeModal(false)}
                className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* نافذة إضافة / تعديل محاضرة (للمعلمين والمشرفين) */}
      {/* ======================================================================= */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setLessonModalOpen(false)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              {editingLesson ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              أدخل تفاصيل المحاضرة ورابط الفيديو والمذكرة
            </p>

            <form onSubmit={handleSaveLesson} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان المحاضرة:</label>
                <input
                  type="text"
                  required
                  value={lessonFormData.title}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, title: e.target.value })}
                  placeholder="مثال: استراتيجية التدرج المنتظم في النسبة المئوية"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">رابط الفيديو (يوتيوب أو رابط مباشر):</label>
                <input
                  type="text"
                  required
                  value={lessonFormData.videoUrl}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, videoUrl: e.target.value })}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">المدة بالدقائق:</label>
                  <input
                    type="number"
                    min="1"
                    value={lessonFormData.durationMinutes}
                    onChange={(e) => setLessonFormData({ ...lessonFormData, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">نوع المعاينة:</label>
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonFormData.isFreePreview}
                      onChange={(e) => setLessonFormData({ ...lessonFormData, isFreePreview: e.target.checked })}
                      className="rounded text-amber-500"
                    />
                    <span className="font-bold">معاينة مجانية 🎁</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مذكرة PDF مرفقة (اختياري):</label>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={lessonFormData.pdfTitle}
                    onChange={(e) => setLessonFormData({ ...lessonFormData, pdfTitle: e.target.value })}
                    placeholder="عنوان المذكرة (مثال: ملخص قوانين التدرج)"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <input
                    type="text"
                    value={lessonFormData.pdfUrl}
                    onChange={(e) => setLessonFormData({ ...lessonFormData, pdfUrl: e.target.value })}
                    placeholder="رابط ملف PDF"
                    className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black transition"
                >
                  حفظ المحاضرة
                </button>
                <button
                  type="button"
                  onClick={() => setLessonModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* نافذة إضافة / تعديل باب تدريبي (للمعلمين والمشرفين) */}
      {/* ======================================================================= */}
      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setModuleModalOpen(false)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              {editingModule ? 'تعديل الباب التدريبي' : 'إضافة باب تدريبي جديد'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              حدد عنوان الباب والوصف الخاص به
            </p>

            <form onSubmit={handleSaveModule} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">عنوان الباب:</label>
                <input
                  type="text"
                  required
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  placeholder="مثال: الباب السابع: المتتابعات والمتسلسلات الخاطفة"
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">الوصف:</label>
                <textarea
                  rows={3}
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  placeholder="وصف محتوى الباب التدريبي..."
                  className="w-full p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white resize-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black transition"
                >
                  حفظ الباب
                </button>
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
