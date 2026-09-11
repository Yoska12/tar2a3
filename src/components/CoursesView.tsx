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
  Crown,
  Layers,
  ArrowRight,
  ExternalLink,
  Download,
  Eye,
  Check,
  X,
  AlertCircle,
  Video,
  BookOpen,
  FolderDown,
  FileSpreadsheet,
  UploadCloud,
  Film,
  Loader2,
  Shield,
  CreditCard
} from 'lucide-react';
import { CourseModule, Lesson, LessonAttachment, VideoProvider, CourseFileItem } from '../types';
import { TarqaUser } from '../lib/supabase';
import { uploadLessonVideo, formatVideoSize } from '../lib/videoUploadService';
import {
  ANNUAL_SUBSCRIPTION_PRICE_SAR,
  ANNUAL_SUBSCRIPTION_PRICE_EGP,
  canEditCourses,
  isUserSubscribed,
  getSubscriptionDetails,
  activateAnnualSubscription,
  canAccessLesson,
  coursesStorage
} from '../lib/subscriptionService';
import { downloadTrackingService } from '../lib/downloadTrackingService';
import { KashierCheckoutModal } from './KashierCheckoutModal';
import { getKashierSettings, KashierTransaction } from '../lib/kashierService';
import { sanitizeUrl } from '../lib/securityUtils';
import { fileStorageService } from '../lib/fileStorageService';

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
  const [files, setFiles] = useState<CourseFileItem[]>(() => coursesStorage.getFiles());
  const [activeTab, setActiveTab] = useState<'all' | 'lectures' | 'files'>('all');
  
  // الباب الوحيد للمحاضرات
  const currentModule = modules[0] || {
    id: 'mod-lectures',
    title: 'المحاضرات',
    description: 'محاضرات التأسيس الشاملة للقدرات من الصفر حتى الاحتراف.',
    orderIndex: 1,
    isPublished: true,
    lessons: [],
  };

  const [subscriptionInfo, setSubscriptionInfo] = useState(() => getSubscriptionDetails(currentUser));
  const isEditor = canEditCourses(currentUser?.role, currentUser?.email);

  // وضع التعديل للمعلمين والمشرفين
  const [isEditMode, setIsEditMode] = useState(false);

  // نوافذ الاشتراك والتعديل
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isKashierCheckoutOpen, setIsKashierCheckoutOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeSuccessMessage, setSubscribeSuccessMessage] = useState<string | null>(null);

  // نافذة إضافة / تعديل محاضرة
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
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

  // حالة رفع ملف الفيديو
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [uploadedVideoInfo, setUploadedVideoInfo] = useState<{ name: string; size: string } | null>(null);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoFileInputRef = React.useRef<HTMLInputElement>(null);

  // معالجة اختيار ملف فيديو ورفعه
  const handleVideoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingVideo(true);
    setVideoUploadProgress(10);
    setVideoUploadError(null);

    try {
      const res = await uploadLessonVideo(file, editingLesson ? editingLesson.id : 'lecture', (p) => {
        setVideoUploadProgress(p);
      });

      if (res.success && res.videoUrl) {
        setLessonFormData((prev) => ({
          ...prev,
          videoUrl: res.videoUrl!,
          videoProvider: 'uploaded_video',
        }));
        setUploadedVideoInfo({
          name: res.fileName || file.name,
          size: res.fileSizeFormatted || formatVideoSize(file.size),
        });
      } else {
        setVideoUploadError(res.error || 'فشلت عملية رفع ملف الفيديو');
      }
    } catch (err: any) {
      setVideoUploadError(err?.message || 'حدث خطأ أثناء رفع الفيديو');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // نافذة تعديل اسم وتفاصيل باب المحاضرات
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [moduleFormData, setModuleFormData] = useState({
    title: currentModule.title || 'المحاضرات',
    description: currentModule.description || '',
  });

  // نافذة إضافة / تعديل ملف
  const [fileModalOpen, setFileModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<CourseFileItem | null>(null);
  const [fileFormData, setFileFormData] = useState({
    title: '',
    description: '',
    fileUrl: '',
    fileSize: '10 MB',
    pagesCount: '100 صفحة',
    fileType: 'pdf' as 'pdf' | 'worksheet' | 'summary' | 'book',
    isFreePreview: false,
  });

  // حالة رفع ملف PDF في نافذة الملفات
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadProgress, setPdfUploadProgress] = useState(0);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const pdfFileInputRef = React.useRef<HTMLInputElement>(null);

  // معالجة اختيار ورفع ملف PDF
  const handlePdfFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setPdfUploadError('يرجى اختيار ملف بصيغة PDF فقط.');
      return;
    }

    setIsUploadingPdf(true);
    setPdfUploadProgress(15);
    setPdfUploadError(null);

    // ملء العنوان تلقائياً إذا كان فارغاً
    if (!fileFormData.title.trim()) {
      setFileFormData((prev) => ({
        ...prev,
        title: file.name.replace(/\.pdf$/i, ''),
      }));
    }

    try {
      const res = await fileStorageService.uploadPdf(file, (p) => {
        setPdfUploadProgress(p);
      });

      if (res.success && res.fileUrl) {
        setFileFormData((prev) => ({
          ...prev,
          fileUrl: res.fileUrl,
          fileSize: res.fileSizeFormatted || prev.fileSize,
        }));
      } else {
        setPdfUploadError(res.error || 'فشلت عملية رفع الملف');
      }
    } catch (err: any) {
      console.warn('PDF upload fallback activated:', err);
      const fallbackUrl = URL.createObjectURL(file);
      setFileFormData((prev) => ({
        ...prev,
        fileUrl: fallbackUrl,
      }));
    } finally {
      setIsUploadingPdf(false);
      setPdfUploadProgress(0);
      if (pdfFileInputRef.current) pdfFileInputRef.current.value = '';
    }
  };

  // الاستماع لتغييرات الدورات والملفات والاشتراكات
  useEffect(() => {
    const handleSubChanged = () => {
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
    };
    const handleModulesChanged = (e: any) => {
      if (e.detail) setModules(e.detail);
      else setModules(coursesStorage.getModules());
    };
    const handleFilesChanged = (e: any) => {
      if (e.detail !== undefined) setFiles(e.detail);
      else setFiles(coursesStorage.getFiles());
    };

    window.addEventListener('tarqa_subscription_changed', handleSubChanged);
    window.addEventListener('tarqa_user_changed', handleSubChanged);
    window.addEventListener('tarqa_courses_modules_changed', handleModulesChanged);
    window.addEventListener('tarqa_courses_files_changed', handleFilesChanged);

    return () => {
      window.removeEventListener('tarqa_subscription_changed', handleSubChanged);
      window.removeEventListener('tarqa_user_changed', handleSubChanged);
      window.removeEventListener('tarqa_courses_modules_changed', handleModulesChanged);
      window.removeEventListener('tarqa_courses_files_changed', handleFilesChanged);
    };
  }, [currentUser]);

  // تحديث حالة الاشتراك عند تغير المستخدم
  useEffect(() => {
    setSubscriptionInfo(getSubscriptionDetails(currentUser));
  }, [currentUser]);

  // تنفيذ الاشتراك السنوي عبر بوابة كاشير أو التفعيل المباشر
  const handleConfirmSubscription = async () => {
    if (!currentUser) {
      setShowSubscribeModal(false);
      onOpenAuth?.();
      return;
    }

    const kashierSettings = getKashierSettings();
    if (kashierSettings.enabled) {
      setShowSubscribeModal(false);
      setIsKashierCheckoutOpen(true);
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

  // معالجة اكتمال الدفع بنجاح من بوابة كاشير
  const handleKashierPaymentSuccess = async (tx: KashierTransaction) => {
    if (!currentUser) return;
    setIsSubscribing(true);
    try {
      const res = await activateAnnualSubscription(currentUser);
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
      setSubscribeSuccessMessage(res.message);
      setIsKashierCheckoutOpen(false);
      setShowSubscribeModal(false);
    } catch (e) {
      console.error('Error activating subscription after Kashier payment:', e);
    } finally {
      setIsSubscribing(false);
    }
  };

  // فتح المحاضرة أو نافذة الاشتراك
  const handleLessonClick = (lesson: Lesson) => {
    const hasAccess = canAccessLesson(lesson, currentUser);
    if (hasAccess) {
      onOpenClassroom(currentModule, lesson);
    } else {
      setShowSubscribeModal(true);
    }
  };

  // تحميل أو فتح ملف
  const handleFileAction = (file: CourseFileItem, previewMode = false) => {
    const hasAccess = file.isFreePreview || subscriptionInfo.isSubscribed;
    if (hasAccess) {
      downloadTrackingService.trackDownload(
        {
          id: file.id,
          title: file.title,
          fileUrl: file.fileUrl,
          fileType: file.fileType,
          fileSize: file.fileSize,
        },
        currentUser
      );
      const safeUrl = sanitizeUrl(file.fileUrl);
      if (safeUrl !== '#') {
        window.open(safeUrl, '_blank', 'noopener,noreferrer');
      }
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

    const defaultVideoUrl = 'https://vjs.zencdn.net/v/oceans.mp4';

    if (editingLesson) {
      const updatedLesson: Lesson = {
        ...editingLesson,
        title: lessonFormData.title.trim(),
        description: lessonFormData.description.trim(),
        videoUrl: lessonFormData.videoUrl.trim() || defaultVideoUrl,
        videoProvider: lessonFormData.videoProvider || (lessonFormData.videoUrl.includes('youtu') ? 'youtube' : 'direct_url'),
        durationMinutes: Number(lessonFormData.durationMinutes) || 15,
        isFreePreview: lessonFormData.isFreePreview,
        attachments: attachments.length > 0 ? attachments : editingLesson.attachments,
      };
      const updated = coursesStorage.updateLesson(updatedLesson);
      setModules([...updated]);
    } else {
      const newLesson: Lesson = {
        id: 'les-' + Date.now(),
        moduleId: currentModule.id,
        moduleTitle: currentModule.title,
        title: lessonFormData.title.trim(),
        description: lessonFormData.description.trim(),
        videoUrl: lessonFormData.videoUrl.trim() || defaultVideoUrl,
        videoProvider: lessonFormData.videoProvider || (lessonFormData.videoUrl.includes('youtu') ? 'youtube' : 'direct_url'),
        durationMinutes: Number(lessonFormData.durationMinutes) || 15,
        orderIndex: (currentModule.lessons?.length || 0) + 1,
        isFreePreview: lessonFormData.isFreePreview,
        isPublished: true,
        attachments,
      };
      const updated = coursesStorage.addLesson(currentModule.id, newLesson);
      setModules([...updated]);
    }

    setLessonModalOpen(false);
  };

  // حذف محاضرة
  const handleDeleteLesson = (lessonId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه المحاضرة؟')) {
      const updated = coursesStorage.deleteLesson(currentModule.id, lessonId);
      setModules([...updated]);
    }
  };

  // تبديل المعاينة المجانية للمحاضرة
  const handleToggleLessonPreview = (lessonId: string) => {
    const updated = coursesStorage.toggleFreePreview(currentModule.id, lessonId);
    setModules([...updated]);
  };

  // حفظ تفاصيل باب المحاضرات
  const handleSaveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!moduleFormData.title.trim()) return;

    const updated = {
      ...currentModule,
      title: moduleFormData.title.trim(),
      description: moduleFormData.description.trim(),
    };
    const updatedList = coursesStorage.updateModule(updated);
    setModules([...updatedList]);
    setModuleModalOpen(false);
  };

  // حفظ ملف جديد أو معدل
  const handleSaveFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileFormData.title.trim()) return;

    if (editingFile) {
      const updated: CourseFileItem = {
        ...editingFile,
        title: fileFormData.title.trim(),
        description: fileFormData.description.trim(),
        fileUrl: fileFormData.fileUrl.trim() || 'https://tarqa.app/files/foundation.pdf',
        fileSize: fileFormData.fileSize.trim() || '10 MB',
        pagesCount: fileFormData.pagesCount.trim() || '100 صفحة',
        fileType: fileFormData.fileType,
        isFreePreview: fileFormData.isFreePreview,
      };
      const updatedFiles = coursesStorage.updateFile(updated);
      setFiles([...updatedFiles]);
    } else {
      const newFile: CourseFileItem = {
        id: 'file-' + Date.now(),
        title: fileFormData.title.trim(),
        description: fileFormData.description.trim(),
        fileUrl: fileFormData.fileUrl.trim() || 'https://tarqa.app/files/foundation.pdf',
        fileSize: fileFormData.fileSize.trim() || '10 MB',
        pagesCount: fileFormData.pagesCount.trim() || '100 صفحة',
        fileType: fileFormData.fileType,
        isFreePreview: fileFormData.isFreePreview,
        downloadCount: 0,
        uploadedAt: 'اليوم',
      };
      const updatedFiles = coursesStorage.addFile(newFile);
      setFiles([...updatedFiles]);
    }

    setFileModalOpen(false);
  };

  // حذف ملف
  const handleDeleteFile = (fileId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الملف من قسم الملفات؟')) {
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      const updatedFiles = coursesStorage.deleteFile(fileId);
      setFiles([...updatedFiles]);
    }
  };

  // تبديل معاينة الملف المجانية
  const handleToggleFilePreview = (fileId: string) => {
    const updatedFiles = coursesStorage.toggleFilePreview(fileId);
    setFiles([...updatedFiles]);
  };

  const totalLessons = currentModule.lessons.length;
  const totalDurationMinutes = currentModule.lessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const freePreviewsCount = currentModule.lessons.filter((l) => l.isFreePreview).length;
  const mainFile = files[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 transition-colors pb-24">
      {/* ======================================================================= */}
      {/* 1. رأس الصفحة والبانر الترحيبي وبطاقة الاشتراك السنوي (75 ريال / سنة) */}
      {/* ======================================================================= */}
      <section className="relative overflow-hidden pt-8 pb-12 px-4 sm:px-6 lg:px-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* الجانب الأيمن: النص والعنوان */}
          <div className="lg:col-span-7 space-y-4 text-right">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
              <GraduationCap className="w-4 h-4 text-amber-500" />
              <span>دورة طرقع للتأسيس الشامل • المحاضرات والملف المعتمد 1446</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-[1.3]">
              تأسيس القدرات من الصفر حتى 100 🎯 <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-600 via-amber-500 to-yellow-500">
                محاضرات مسجلة + مذكرة التأسيس الكاملة PDF
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              اشتراك سنوي موحد يمنحك وصولاً شاملاً لمدة 365 يوماً إلى باب المحاضرات التأسيسية المكثفة ({totalLessons} محاضرة تدريبية)، وقسم الملف الذي يضم مذكرة طرقع الكاملة وأوراق العمل والملخصات القابلة للتحميل.
            </p>

            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 pt-2">
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Video className="w-4 h-4" />
                <span>{totalLessons} محاضرة مسجلة</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <FileText className="w-4 h-4" />
                <span>{files.length} ملفات ومذكرات كاملة</span>
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

            {/* أدوات المشرف / المعلم */}
            {isEditor && (
              <div className="pt-2 flex items-center gap-2">
                <button
                  onClick={() => setIsEditMode(!isEditMode)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                    isEditMode
                      ? 'bg-purple-600 text-white border-purple-500'
                      : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditMode ? 'إغلاق وضع تعديل المحتوى' : 'تفعيل وضع إدارة وتعديل المحتوى (معلم / مشرف)'}</span>
                </button>
              </div>
            )}
          </div>

          {/* الجانب الأيسر: بطاقة الاشتراك (75 ريال / سنة) */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm rounded-3xl bg-white/90 dark:bg-[#0d1424]/90 backdrop-blur-xl border-2 border-amber-500/40 p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />
              
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  الباقة السنوية الشاملة
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  سنة كاملة (365 يوماً)
                </span>
              </div>

              {/* السعر الكبير */}
              <div className="flex flex-col mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white font-mono">
                    {ANNUAL_SUBSCRIPTION_PRICE_SAR}
                  </span>
                  <span className="text-sm font-bold text-slate-500">ريال سعودي / سنوياً</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                  <span>أو ما يعادله في مصر:</span>
                  <span className="text-sm font-black underline">{ANNUAL_SUBSCRIPTION_PRICE_EGP} جنيه مصري</span>
                </div>
              </div>

              {/* قائمة المميزات */}
              <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>فتح كافة محاضرات التأسيس بدون قيود</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تحميل مذكرة طرقع الشاملة (الملف الكامل PDF)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>ملخص القوانين الذهبية وأوراق العمل</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تحديثات مستمرة وتجميعات نماذج 1446</span>
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
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-md hover:shadow-glow transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 fill-current" />
                  <span>اشترك الآن ({ANNUAL_SUBSCRIPTION_PRICE_SAR} ريال / {ANNUAL_SUBSCRIPTION_PRICE_EGP} جنيه)</span>
                </button>
              )}

            </div>
          </div>

        </div>
      </section>

      {/* ======================================================================= */}
      {/* 2. شريط التبديل بين قسم المحاضرات وقسم الملف */}
      {/* ======================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {/* أزرار التبديل الفورية بين الأقسام */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white/60 dark:bg-[#0c1324]/60 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none max-w-full py-1 -mx-1 px-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'all'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span>عرض الكل</span>
            </button>

            <button
              onClick={() => setActiveTab('lectures')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'lectures'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline">باب المحاضرات ({totalLessons})</span>
              <span className="xs:hidden">المحاضرات ({totalLessons})</span>
            </button>

            <button
              onClick={() => setActiveTab('files')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${
                activeTab === 'files'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FolderDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden xs:inline">قسم الملف والمذكرات ({files.length})</span>
              <span className="xs:hidden">الملف والمذكرات ({files.length})</span>
            </button>
          </div>

          {/* شريط الإجراءات السريعة للمعلمين عند تفعيل وضع التعديل */}
          {isEditor && isEditMode && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
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
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة محاضرة جديدة</span>
              </button>

              <button
                onClick={() => {
                  setEditingFile(null);
                  setFileFormData({
                    title: '',
                    description: '',
                    fileUrl: '',
                    fileSize: '10 MB',
                    pagesCount: '100 صفحة',
                    fileType: 'pdf',
                    isFreePreview: false,
                  });
                  setFileModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة ملف جديد</span>
              </button>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 3. قسم الملف (ملف التأسيس الشامل والمذكرات) */}
        {/* ===================================================================== */}
        {(activeTab === 'all' || activeTab === 'files') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BookOpen className="w-6 h-6 text-blue-500" />
                  <span>قسم الملف والمذكرات التأسيسية 📄</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  حمل مذكرة طرقع الكاملة وملخصات القوانين وأوراق العمل للمذاكرة والمتابعة مع المحاضرات
                </p>
              </div>

              {isEditor && isEditMode && (
                <button
                  onClick={() => {
                    setEditingFile(null);
                    setFileFormData({
                      title: '',
                      description: '',
                      fileUrl: '',
                      fileSize: '10 MB',
                      pagesCount: '100 صفحة',
                      fileType: 'pdf',
                      isFreePreview: false,
                    });
                    setFileModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة ملف</span>
                </button>
              )}
            </div>

            {/* بطاقة الملف الرئيسي البارزة (Hero File Card) */}
            {mainFile && (
              <div className="rounded-3xl bg-gradient-to-br from-blue-500/10 via-amber-500/5 to-purple-500/10 border-2 border-blue-500/30 p-6 sm:p-8 backdrop-blur-xl shadow-lg relative overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-8 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-[11px] font-black bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        <span>الملف المعتمد الأساسي • نسخة 2025</span>
                      </span>
                      {mainFile.isFreePreview && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          معاينة مجانية متاحة 🎁
                        </span>
                      )}
                    </div>

                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                      {mainFile.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
                      {mainFile.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 font-bold pt-1">
                      <span>حجم الملف: <strong>{mainFile.fileSize}</strong></span>
                      <span>•</span>
                      <span>عدد الصفحات: <strong>{mainFile.pagesCount || '185 صفحة'}</strong></span>
                      <span>•</span>
                      <span>صيغة الملف: <strong>PDF عالي الدقة</strong></span>
                    </div>
                  </div>

                  {/* أزرار تحميل ومعاينة الملف الرئيسي */}
                  <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
                    <button
                      onClick={() => handleFileAction(mainFile, false)}
                      className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      {mainFile.isFreePreview || subscriptionInfo.isSubscribed ? (
                        <>
                          <Download className="w-4 h-4" />
                          <span>تحميل الملف الكامل الآن 📥</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4 text-amber-300" />
                          <span>فتح وتحميل الملف (مشتركين) 🔒</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleFileAction(mainFile, true)}
                      className="w-full py-3 px-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>معاينة وتصفح الملف 👁️</span>
                    </button>

                    {/* أدوات المشرف للملف الرئيسي */}
                    {isEditor && isEditMode && (
                      <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setEditingFile(mainFile);
                            setFileFormData({
                              title: mainFile.title,
                              description: mainFile.description,
                              fileUrl: mainFile.fileUrl,
                              fileSize: mainFile.fileSize,
                              pagesCount: mainFile.pagesCount || '185 صفحة',
                              fileType: mainFile.fileType,
                              isFreePreview: !!mainFile.isFreePreview,
                            });
                            setFileModalOpen(true);
                          }}
                          className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold hover:text-purple-500 transition cursor-pointer"
                        >
                          تعديل الملف
                        </button>
                        <button
                          onClick={() => handleToggleFilePreview(mainFile.id)}
                          className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 text-xs font-bold hover:text-emerald-500 transition cursor-pointer"
                        >
                          {mainFile.isFreePreview ? 'قفل المعاينة' : 'إتاحة مجاناً'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* باقي ملفات ومذكرات الدورة */}
            {files.length > 1 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {files.slice(1).map((file) => {
                  const hasAccess = file.isFreePreview || subscriptionInfo.isSubscribed;
                  return (
                    <div
                      key={file.id}
                      className="p-5 rounded-3xl bg-white/80 dark:bg-[#0c1324]/80 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm shadow-sm flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                            <FileText className="w-4 h-4" />
                          </span>
                          {file.isFreePreview ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              معاينة مجانية 🎁
                            </span>
                          ) : hasAccess ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                              متاح لاشتراكك ✅
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-500">
                              يتطلب اشتراك 🔒
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {file.title}
                        </h4>

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {file.description}
                        </p>

                        <div className="text-[11px] text-slate-400 font-bold flex items-center gap-3">
                          <span>{file.fileSize}</span>
                          <span>•</span>
                          <span>{file.pagesCount || 'ملف PDF'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => handleFileAction(file, false)}
                          className="flex-1 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل الملف</span>
                        </button>

                        <button
                          onClick={() => handleFileAction(file, true)}
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition cursor-pointer"
                          title="معاينة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {isEditor && isEditMode && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingFile(file);
                                setFileFormData({
                                  title: file.title,
                                  description: file.description,
                                  fileUrl: file.fileUrl,
                                  fileSize: file.fileSize,
                                  pagesCount: file.pagesCount || '50 صفحة',
                                  fileType: file.fileType,
                                  isFreePreview: !!file.isFreePreview,
                                });
                                setFileModalOpen(true);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 text-slate-500 hover:text-purple-600 transition cursor-pointer"
                              title="تعديل"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteFile(file.id)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* ===================================================================== */}
        {/* 4. باب المحاضرات (باب واحد فقط للمحاضرات اسمه "المحاضرات") */}
        {/* ===================================================================== */}
        {(activeTab === 'all' || activeTab === 'lectures') && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Video className="w-6 h-6 text-amber-500" />
                  <span>{currentModule.title || 'المحاضرات'} 🎥</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentModule.description || 'شروحات فيديو تأسيسية مكثفة مع استراتيجيات الحل السريع'}
                </p>
              </div>

              {isEditor && isEditMode && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setModuleFormData({
                        title: currentModule.title,
                        description: currentModule.description,
                      });
                      setModuleModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>تعديل وصف الباب</span>
                  </button>

                  <button
                    onClick={() => {
                      setEditingLesson(null);
                      setUploadedVideoInfo(null);
                      setVideoUploadError(null);
                      setLessonFormData({
                        title: '',
                        description: '',
                        videoUrl: '',
                        videoProvider: 'uploaded_video',
                        durationMinutes: 15,
                        isFreePreview: false,
                        pdfTitle: '',
                        pdfUrl: '',
                      });
                      setLessonModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold hover:bg-amber-600 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة محاضرة</span>
                  </button>
                </div>
              )}
            </div>

            {/* قائمة المحاضرات داخل باب المحاضرات */}
            <div className="rounded-3xl bg-white/80 dark:bg-[#0c1324]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm overflow-hidden p-4 sm:p-6 space-y-3">
              
              {currentModule.lessons.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Video className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <p className="text-xs text-slate-400">لا توجد محاضرات في هذا الباب حتى الآن.</p>
                </div>
              ) : (
                currentModule.lessons.map((lesson, lesIdx) => {
                  const hasAccess = canAccessLesson(lesson, currentUser);

                  return (
                    <div
                      key={lesson.id}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        hasAccess
                          ? 'bg-white dark:bg-[#0f172a]/70 border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 hover:shadow-sm'
                          : 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/40 dark:border-slate-800/40 opacity-90'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          onClick={() => handleLessonClick(lesson)}
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition ${
                            hasAccess
                              ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                          }`}
                        >
                          {hasAccess ? <Play className="w-5 h-5 fill-current ml-0.5" /> : <Lock className="w-5 h-5" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4
                              onClick={() => handleLessonClick(lesson)}
                              className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate cursor-pointer hover:text-amber-500 transition"
                            >
                              {lesIdx + 1}. {lesson.title}
                            </h4>

                            {lesson.isFreePreview ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                معاينة مجانية 🎁
                              </span>
                            ) : hasAccess ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                متاح بالاشتراك ✅
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                <span>مقفل (75 ر.س/سنة)</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                            {lesson.description}
                          </p>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-bold mt-1.5">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{lesson.durationMinutes} دقيقة</span>
                            </span>
                            {lesson.attachments && lesson.attachments.length > 0 && (
                              <span className="flex items-center gap-1 text-blue-500">
                                <FileText className="w-3.5 h-3.5" />
                                <span>ملف PDF مرفق</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* أزرار المشاهدة والتحكم */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* أزرار المعلم والمشرف */}
                        {isEditor && isEditMode && (
                          <div className="flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-slate-800">
                            <button
                              onClick={() => handleToggleLessonPreview(lesson.id)}
                              className={`p-2 rounded-xl text-xs transition cursor-pointer ${
                                lesson.isFreePreview
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                              }`}
                              title={lesson.isFreePreview ? 'إلغاء المعاينة المجانية' : 'جعلها معاينة مجانية للجميع'}
                            >
                              {lesson.isFreePreview ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                            </button>

                            <button
                              onClick={() => {
                                setEditingLesson(lesson);
                                setUploadedVideoInfo(lesson.videoUrl ? { name: 'فيديو المحاضرة الحالي', size: '' } : null);
                                setVideoUploadError(null);
                                setLessonFormData({
                                  title: lesson.title,
                                  description: lesson.description,
                                  videoUrl: lesson.videoUrl,
                                  videoProvider: lesson.videoProvider || 'uploaded_video',
                                  durationMinutes: lesson.durationMinutes,
                                  isFreePreview: lesson.isFreePreview,
                                  pdfTitle: lesson.attachments?.[0]?.title || '',
                                  pdfUrl: lesson.attachments?.[0]?.fileUrl || '',
                                });
                                setLessonModalOpen(true);
                              }}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 text-slate-500 hover:text-purple-600 transition cursor-pointer"
                              title="تعديل المحاضرة"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 transition cursor-pointer"
                              title="حذف المحاضرة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* زر تشغيل المحاضرة أو زر الاشتراك */}
                        {hasAccess ? (
                          <button
                            onClick={() => handleLessonClick(lesson)}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>مشاهدة الآن</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setShowSubscribeModal(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>اشترك لفتح الدرس</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

      </main>

      {/* ======================================================================= */}
      {/* 5. نافذة الاشتراك السنوي الموحد (75 ريال / سنة) */}
      {/* ======================================================================= */}
      {showSubscribeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1424] border-2 border-amber-500/40 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSubscribeModal(false)}
              className="absolute top-4 left-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-3 pt-2">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center mx-auto shadow-sm">
                <Crown className="w-7 h-7" />
              </div>

              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                تفعيل باقة طرقع السنوية الشاملة 🎯
              </h3>

              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                افتح جميع محاضرات التأسيس وقسم الملف (مذكرة طرقع الشاملة PDF وأوراق العمل) لمدة <strong>سنة كاملة (365 يوماً)</strong>.
              </p>

              <div className="py-4 px-6 rounded-2xl bg-amber-500/10 border border-amber-500/20 my-4 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">رسوم الاشتراك السنوي:</span>
                <div className="text-left font-mono">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س
                  </div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    أو {ANNUAL_SUBSCRIPTION_PRICE_EGP} جنيه مصري / سنوياً
                  </div>
                </div>
              </div>

              {subscribeSuccessMessage ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{subscribeSuccessMessage}</span>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {/* زر الدفع الآمن عبر كاشير */}
                  <button
                    disabled={isSubscribing}
                    onClick={() => {
                      if (!currentUser) {
                        setShowSubscribeModal(false);
                        onOpenAuth?.();
                        return;
                      }
                      setShowSubscribeModal(false);
                      setIsKashierCheckoutOpen(true);
                    }}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4 text-slate-950" />
                    <span>الدفع الإلكتروني الآمن (Kashier) 💳</span>
                  </button>

                  <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 flex-wrap">
                    <span>طرق الدفع:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">مدى Mada</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">Visa / Master</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-300">المحافظ الإلكترونية</span>
                  </div>

                  {/* زر التفعيل التجريبي السريع */}
                  <button
                    type="button"
                    disabled={isSubscribing}
                    onClick={async () => {
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
                    }}
                    className="w-full py-2.5 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 text-slate-600 dark:text-slate-400 hover:text-amber-500 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>تفعيل تجريبي فوري (Demo Mode)</span>
                  </button>

                  <p className="text-[10px] text-slate-400">
                    * الدفع مشفر بنكياً بنظام 256-bit SSL والاشتراك سارٍ لمدة 365 يوماً.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدفع المدمجة عبر بوابة كاشير (Kashier Checkout Modal) */}
      <KashierCheckoutModal
        isOpen={isKashierCheckoutOpen}
        onClose={() => setIsKashierCheckoutOpen(false)}
        currentUser={currentUser || null}
        onPaymentSuccess={handleKashierPaymentSuccess}
      />

      {/* ======================================================================= */}
      {/* 6. نافذة إضافة / تعديل محاضرة */}
      {/* ======================================================================= */}
      {lessonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0d1424] border border-purple-500/30 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-purple-500" />
                <span>{editingLesson ? 'تعديل المحاضرة' : 'إضافة محاضرة جديدة'}</span>
              </h3>
              <button
                onClick={() => setLessonModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان المحاضرة *
                </label>
                <input
                  type="text"
                  required
                  value={lessonFormData.title}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, title: e.target.value })}
                  placeholder="مثال: أسرار جدول الضرب السريع والضرب الذهني"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف مختصر للمحاضرة
                </label>
                <textarea
                  rows={2}
                  value={lessonFormData.description}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, description: e.target.value })}
                  placeholder="ما الذي سيتعلمه الطالب في هذه المحاضرة؟"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* خيار رفع الفيديو مباشرة أو وضع رابط مباشر */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-900 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-amber-500" />
                    <span>فيديو المحاضرة (مشفر ومحمي) 🔒</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-500/20">
                    <Shield className="w-3 h-3" />
                    <span>مانع للتسريب بالـ User ID</span>
                  </span>
                </div>

                {/* نصيحة ذهبية لمنصات التعليم وضمان تشغيل الموبايل */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                  <span className="font-bold">🌟 التوصية المثلى لجميع الهواتف:</span> يُنصح بشدة برفع الفيديو على <strong>YouTube واختيار (غير مدرج - Unlisted)</strong> ثم وضع الرابط هنا. يمنح ذلك تشغيلاً سريعاً 100% بدون تقطيع على كل هواتف الآيفون والأندرويد وبجودات متعددة تلقائياً.
                </div>

                {/* رابط يوتيوب أو رابط مباشر */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رابط فيديو المحاضرة (YouTube أو رابط MP4 مباشر):
                  </label>
                  <input
                    type="text"
                    value={lessonFormData.videoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLessonFormData({
                        ...lessonFormData,
                        videoUrl: val,
                        videoProvider: val.includes('youtube.com') || val.includes('youtu.be') ? 'youtube' : 'direct_url',
                      });
                    }}
                    placeholder="https://youtu.be/... أو https://www.youtube.com/watch?v=..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono text-left"
                    dir="ltr"
                  />
                </div>

                {/* منطقة رفع الفيديو من الجهاز */}
                <div className="flex flex-col gap-2 pt-2 border-t border-amber-500/20">
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    أو رفع ملف فيديو من جهازك (للمعاينة المباشرة على هذا الكمبيوتر):
                  </span>
                  <input
                    ref={videoFileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/mkv,.mp4,.webm,.mov"
                    onChange={handleVideoFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => videoFileInputRef.current?.click()}
                    disabled={isUploadingVideo}
                    className="w-full py-3 px-4 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingVideo ? (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-bold">
                          جارٍ معالجة الفيديو ({videoUploadProgress}%)...
                        </span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          رفع ملف فيديو من هذا الجهاز
                        </span>
                      </>
                    )}
                  </button>

                  {/* رسالة الخطأ إن وجدت */}
                  {videoUploadError && (
                    <div className="text-[11px] font-bold text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{videoUploadError}</span>
                    </div>
                  )}

                  {/* معلومات الفيديو المرفوع أو الرابط المباشر */}
                  {uploadedVideoInfo && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-between">
                      <div className="flex items-center gap-2 truncate">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span className="truncate">{uploadedVideoInfo.name}</span>
                      </div>
                      {uploadedVideoInfo.size && (
                        <span className="text-[10px] font-mono shrink-0">{uploadedVideoInfo.size}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  المدة بالدقائق
                </label>
                <input
                  type="number"
                  min="1"
                  value={lessonFormData.durationMinutes}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, durationMinutes: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 space-y-2">
                <span className="text-xs font-bold text-purple-700 dark:text-purple-300 block">
                  مذكرة / ملف PDF مرفق بالمحاضرة (اختياري)
                </span>
                <input
                  type="text"
                  placeholder="عنوان الملف المرفق (مثال: تلخيص الدرس.pdf)"
                  value={lessonFormData.pdfTitle}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, pdfTitle: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="url"
                  placeholder="رابط تحميل ملف الـ PDF"
                  value={lessonFormData.pdfUrl}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, pdfUrl: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFreePreviewCheck"
                  checked={lessonFormData.isFreePreview}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, isFreePreview: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded"
                />
                <label htmlFor="isFreePreviewCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  إتاحة هذه المحاضرة كمعاينة مجانية 🎁 (يستطيع أي طالب مشاهدتها بدون اشتراك)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  حفظ المحاضرة
                </button>
                <button
                  type="button"
                  onClick={() => setLessonModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. نافذة إضافة / تعديل ملف في قسم الملفات */}
      {/* ======================================================================= */}
      {fileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0d1424] border border-blue-500/30 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-500" />
                <span>{editingFile ? 'تعديل الملف' : 'إضافة ملف جديد لقسم الملفات'}</span>
              </h3>
              <button
                onClick={() => setFileModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFile} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم أو عنوان الملف *
                </label>
                <input
                  type="text"
                  required
                  value={fileFormData.title}
                  onChange={(e) => setFileFormData({ ...fileFormData, title: e.target.value })}
                  placeholder="مثال: مذكرة طرقع الشاملة لتأسيس القدرات (الملف الكامل).pdf"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف الملف
                </label>
                <textarea
                  rows={2}
                  value={fileFormData.description}
                  onChange={(e) => setFileFormData({ ...fileFormData, description: e.target.value })}
                  placeholder="وصف لمحتوى الملف وما يشتمل عليه من تمارين وشروحات..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* قسم رفع الملف من الجهاز أو إدخال رابط */}
              <div className="space-y-2.5 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    رفع ملف الـ PDF من جهازك:
                  </label>
                  <input
                    ref={pdfFileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePdfFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => pdfFileInputRef.current?.click()}
                    disabled={isUploadingPdf}
                    className="w-full py-2.5 px-4 rounded-xl border-2 border-dashed border-blue-400 dark:border-blue-600/60 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    {isUploadingPdf ? (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارٍ رفع وتجهيز الملف ({pdfUploadProgress}%)...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-blue-500" />
                        <span>اضغط لرفع ملف PDF من جهازك مباشرة 📤</span>
                      </>
                    )}
                  </button>

                  {pdfUploadError && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1">{pdfUploadError}</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      أو رابط تحميل الملف (URL / تم الرفع):
                    </label>
                    {fileFormData.fileUrl && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>الملف جاهز</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={fileFormData.fileUrl.startsWith('data:') ? 'تم تجهيز وتضمين ملف PDF محلياً بنجاح 📄' : fileFormData.fileUrl}
                    onChange={(e) => {
                      if (!e.target.value.includes('تم تجهيز')) {
                        setFileFormData({ ...fileFormData, fileUrl: e.target.value });
                      }
                    }}
                    placeholder="https://tarqa.app/files/tarqa_complete_2025.pdf"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حجم الملف التقريبي
                  </label>
                  <input
                    type="text"
                    value={fileFormData.fileSize}
                    onChange={(e) => setFileFormData({ ...fileFormData, fileSize: e.target.value })}
                    placeholder="مثال: 14.8 MB"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    عدد الصفحات
                  </label>
                  <input
                    type="text"
                    value={fileFormData.pagesCount}
                    onChange={(e) => setFileFormData({ ...fileFormData, pagesCount: e.target.value })}
                    placeholder="مثال: 185 صفحة"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isFileFreeCheck"
                  checked={fileFormData.isFreePreview}
                  onChange={(e) => setFileFormData({ ...fileFormData, isFreePreview: e.target.checked })}
                  className="w-4 h-4 accent-blue-500 rounded"
                />
                <label htmlFor="isFileFreeCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  إتاحة هذا الملف كمعاينة مجانية 🎁 (يمكن لأي طالب تحميله بدون اشتراك)
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  حفظ الملف
                </button>
                <button
                  type="button"
                  onClick={() => setFileModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 8. نافذة تعديل بيانات باب المحاضرات */}
      {/* ======================================================================= */}
      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1424] border border-amber-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-500" />
                <span>تعديل تفاصيل باب المحاضرات</span>
              </h3>
              <button
                onClick={() => setModuleModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم الباب *
                </label>
                <input
                  type="text"
                  required
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  placeholder="المحاضرات"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  وصف الباب
                </label>
                <textarea
                  rows={3}
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setModuleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
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
