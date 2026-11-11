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
  CreditCard,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  Upload,
  Users,
  Tag
} from 'lucide-react';
import { CourseModule, Lesson, LessonAttachment, VideoProvider, CourseFileItem, CourseEnrollmentStatus, TeacherId, InstructorInfo, CourseItem } from '../types';
import { AVAILABLE_INSTRUCTORS } from '../data/foundationModules';
import { TarqaUser, authService, callHostingerApi } from '../lib/supabase';
import { uploadLessonVideo, formatVideoSize } from '../lib/videoUploadService';
import {
  ANNUAL_SUBSCRIPTION_PRICE_SAR,
  ANNUAL_SUBSCRIPTION_PRICE_EGP,
  DEFAULT_FOUNDATION_COURSE,
  canEditCourses,
  isUserSubscribed,
  getSubscriptionDetails,
  activateAnnualSubscription,
  canAccessLesson,
  coursesStorage,
  getCourseEnrollmentInfo,
  isCourseEnrollmentOpen,
  isCourseLockedOrUpcoming
} from '../lib/subscriptionService';
import { downloadTrackingService } from '../lib/downloadTrackingService';
import { KashierCheckoutModal } from './KashierCheckoutModal';
import { getKashierSettings, KashierTransaction } from '../lib/kashierService';
import { sanitizeUrl } from '../lib/securityUtils';
import { fileStorageService, isMobileDevice } from '../lib/fileStorageService';
import { PdfPreviewModal } from './PdfPreviewModal';
import { CourseEnrollButton } from './CourseEnrollButton';
import { AdBannerSlider } from './AdBannerSlider';
import { CourseSubscribersDashboard } from './CourseSubscribersDashboard';
import { CoursePaymentModal } from './CoursePaymentModal';
import { CoursePricingAndPromoAdminModal } from './CoursePricingAndPromoAdminModal';
import { courseCommerceService, PaymentReceipt } from '../lib/courseCommerceService';

interface CoursesViewProps {
  currentUser?: TarqaUser | null;
  onOpenClassroom: (module: CourseModule, lesson: Lesson) => void;
  onBackToHome: () => void;
  onOpenAuth?: () => void;
  initialCourseId?: string | null;
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  currentUser,
  onOpenClassroom,
  onBackToHome,
  onOpenAuth,
  initialCourseId = null,
  onOpenPolicies,
}) => {
  const [courses, setCourses] = useState<CourseItem[]>(() => coursesStorage.getCourses());
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(initialCourseId);

  // نافذة إضافة وتعديل الدورات التدريبية
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [courseFormData, setCourseFormData] = useState<CourseItem>({
    id: '',
    title: '',
    description: '',
    coverImage: '',
    badge: 'الدورة المعتمدة 1446',
    badgeColor: 'amber',
    priceSar: 75,
    priceEg: ANNUAL_SUBSCRIPTION_PRICE_EGP,
    status: 'active',
    availableDate: '',
    customStatusText: '',
    orderIndex: 1,
  });
  const courseCoverInputRef = React.useRef<HTMLInputElement>(null);

  const [modules, setModules] = useState<CourseModule[]>(() => coursesStorage.getModules());
  const [files, setFiles] = useState<CourseFileItem[]>(() => coursesStorage.getFiles());
  const [instructors, setInstructors] = useState<InstructorInfo[]>(() => coursesStorage.getInstructors());
  const [activeTab, setActiveTab] = useState<'all' | 'lectures' | 'files'>('all');
  const [subscribersModalCourseId, setSubscribersModalCourseId] = useState<string | null>(null);
  const [lockedCourseNotice, setLockedCourseNotice] = useState<CourseItem | null>(null);

  // الدورة الحالية المختارة (أو الافتراضية)
  const currentCourse = courses.find((c) => c.id === selectedCourseId) || courses[0] || DEFAULT_FOUNDATION_COURSE;

  // الأبواب والملفات الخاصة بالدورة المختارة فقط
  const currentCourseModules = modules.filter(
    (m) => (m.courseId || 'course-foundation') === currentCourse.id
  );
  const currentCourseFiles = files.filter(
    (f) => (f.courseId || 'course-foundation') === currentCourse.id
  );

  // حالة الباب / الفصل المختار
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    () => currentCourseModules[0]?.id || 'mod-lectures'
  );

  // تحديث الباب المختار تلقائياً عند تغيير الدورة
  useEffect(() => {
    if (selectedCourseId) {
      const cMods = modules.filter((m) => (m.courseId || 'course-foundation') === selectedCourseId);
      if (cMods.length > 0) {
        setSelectedModuleId(cMods[0].id);
      }
    }
  }, [selectedCourseId, modules]);

  // تحديد المعلم المختار من قائمة المدرسين
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherId | 'all'>('all');

  // نافذة إضافة / تعديل المدرسين
  const [teacherModalOpen, setTeacherModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<InstructorInfo | null>(null);
  const [teacherFormData, setTeacherFormData] = useState<InstructorInfo>({
    id: '',
    name: '',
    fullName: '',
    title: '',
    tagline: '',
    avatarIcon: '👨‍🏫',
    badgeColor: 'amber',
  });

  // الباب الحالي المختار أو الافتراضي
  const currentModule = currentCourseModules.find((m) => m.id === selectedModuleId) || currentCourseModules[0] || {
    id: 'mod-lectures',
    courseId: currentCourse.id,
    title: 'المحاضرات',
    description: 'محاضرات الدورة التدريبية من الصفر حتى الاحتراف.',
    orderIndex: 1,
    isPublished: true,
    status: 'active' as CourseEnrollmentStatus,
    customStatusText: '',
    availableDate: '',
    lessons: [],
  };

  const moduleEnrollmentInfo = getCourseEnrollmentInfo(currentModule);
  const currentCourseEnrollmentInfo = getCourseEnrollmentInfo(currentCourse);
  const isCurrentCourseLocked = !currentCourseEnrollmentInfo.isOpen;

  const [subscriptionInfo, setSubscriptionInfo] = useState(() => getSubscriptionDetails(currentUser));

  const isEditor = canEditCourses(currentUser?.role, currentUser?.email);

  useEffect(() => {
    setSubscriptionInfo(getSubscriptionDetails(currentUser));
  }, [currentUser]);

  // التحقق المباشر من قاعدة بيانات السيرفر لضمان أن إلغاء الاشتراك يطبق فوراً على جهاز الطالب
  useEffect(() => {
    const verifyWithServer = async () => {
      if (!currentUser || isEditor) return;
      try {
        const cleanTg = (currentUser.telegramUsername || '').replace(/^@/, '').trim();
        const hostRes = await callHostingerApi('get_user_role', {
          userId: currentUser.id,
          email: currentUser.email,
          telegram_id: currentUser.telegramId,
          telegram_username: cleanTg
        });
        if (hostRes && hostRes.success && hostRes.user) {
          const isSub = Boolean(hostRes.user.isSubscribed);
          if (currentUser.isSubscribed !== isSub) {
            const updated: TarqaUser = {
              ...currentUser,
              isSubscribed: isSub,
              subscriptionExpiresAt: hostRes.user.subscriptionExpiresAt,
            };
            authService.setCurrentUser(updated);
            if (!isSub) {
              try {
                const rawSubs = localStorage.getItem('tarqa_subscriptions');
                if (rawSubs) {
                  const subs = JSON.parse(rawSubs);
                  if (currentUser.id) delete subs[currentUser.id];
                  if (currentUser.email) delete subs[currentUser.email.toLowerCase().trim()];
                  localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));
                }
              } catch {}
            }
            setSubscriptionInfo(getSubscriptionDetails(updated));
            window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
          }
        }
        await courseCommerceService.syncCourseSubscriptionsFromDb(currentUser.id, currentUser.email);
      } catch (e) {
        console.warn('verifyWithServer error:', e);
      }
    };
    verifyWithServer();
  }, [currentUser, isEditor]);

  useEffect(() => {
    const handleSubUpdated = () => {
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
    };
    window.addEventListener('tarqa:subscription_updated', handleSubUpdated);
    window.addEventListener('storage', handleSubUpdated);
    return () => {
      window.removeEventListener('tarqa:subscription_updated', handleSubUpdated);
      window.removeEventListener('storage', handleSubUpdated);
    };
  }, [currentUser]);

  // وضع التعديل للمعلمين والمشرفين
  const [isEditMode, setIsEditMode] = useState(false);

  // نوافذ الاشتراك والتعديل
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [isKashierCheckoutOpen, setIsKashierCheckoutOpen] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscribeSuccessMessage, setSubscribeSuccessMessage] = useState<string | null>(null);
  const [payingCourse, setPayingCourse] = useState<CourseItem | null>(null);
  const [isCommerceAdminOpen, setIsCommerceAdminOpen] = useState(false);
  const [courseSubscriptionsVersion, setCourseSubscriptionsVersion] = useState(0);
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  const handleManualCloudSync = async () => {
    setIsSyncingCloud(true);
    try {
      // 1. مزامنة فورية صاعدة وهابطة مع السيرفر
      const localMods = coursesStorage.getModules();
      const localCourses = coursesStorage.getCourses();

      // إذا كان هذا الجهاز لديه محاضرات، يرفعها للسيرفر لضمان مزامنتها مع باقي الأجهزة
      if (isEditor && localMods.length > 0) {
        await coursesStorage.syncToCloud(localMods, undefined, localCourses);
      }

      // جلب أحدث نسخة موحدة من قاعدة بيانات السيرفر
      const cloudData = await coursesStorage.syncFromCloud();
      if (cloudData?.modules) {
        setModules([...cloudData.modules]);
      }
      if (cloudData?.files) {
        setFiles([...cloudData.files]);
      }

      // تحديث قائمة الدورات
      setCourses([...coursesStorage.getCourses()]);

      // تحديث الأسعار المعتمدة من الداتابيز
      const pricing = await courseCommerceService.getCoursePricing();
      if (pricing && pricing.length > 0) {
        setCourses((prev) =>
          prev.map((c) => {
            const p = pricing.find((item) => item.course_id === c.id);
            if (p) {
              return {
                ...c,
                priceSar: Number(p.price_sar) || c.priceSar,
                priceEg: Number(p.price_egp) || c.priceEg,
              };
            }
            return c;
          })
        );
      }

      // تحديث رتبة المستخدم واشتراكاته من الباك إند
      await authService.refreshCurrentUser();

      const totalLessons = (cloudData?.modules || localMods).reduce((acc, m) => acc + (m.lessons?.length || 0), 0);
      setDownloadToast(`تمت المزامنة بنجاح! 🔄 (${totalLessons} محاضرة متزامنة مع السيرفر وجميع أجهزتك)`);
    } catch (e: any) {
      setDownloadToast('تعذرت المزامنة: يرجى التحقق من الاتصال بالإنترنت');
    } finally {
      setIsSyncingCloud(false);
      setTimeout(() => setDownloadToast(null), 4000);
    }
  };

  // حالة التحميل والتنزيل المباشر
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<{
    fileName: string;
    url: string;
    title: string;
  } | null>(null);

  // نافذة إضافة / تعديل محاضرة
  const [lessonModalOpen, setLessonModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonFormData, setLessonFormData] = useState({
    title: '',
    description: '',
    teacherId: 'teacher_1' as TeacherId,
    teacherName: 'مدرس 1',
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

  // نافذة إضافة / تعديل الأبواب والفصول
  const [moduleModalOpen, setModuleModalOpen] = useState(false);
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    title: '',
    description: '',
    status: 'active' as CourseEnrollmentStatus,
    availableDate: '',
    customStatusText: '',
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

  // نافذة معاينة وتصفح ملف PDF التفاعلية
  const [previewFile, setPreviewFile] = useState<CourseFileItem | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

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


  // فتح نافذة إضافة مدرس جديد
  const handleOpenAddTeacher = () => {
    setEditingTeacher(null);
    setTeacherFormData({
      id: 'teacher_' + Date.now(),
      name: '',
      fullName: '',
      title: '',
      tagline: '',
      avatarIcon: '👨‍🏫',
      badgeColor: 'amber',
    });
    setTeacherModalOpen(true);
  };

  // فتح نافذة تعديل بيانات مدرس
  const handleOpenEditTeacher = (teacher: InstructorInfo) => {
    setEditingTeacher(teacher);
    setTeacherFormData({ ...teacher });
    setTeacherModalOpen(true);
  };

  // حفظ إضافة أو تعديل المدرس
  const handleSaveTeacher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherFormData.name.trim()) return;

    const finalFullName = teacherFormData.fullName.trim() || teacherFormData.name.trim();

    if (editingTeacher) {
      const updated: InstructorInfo = {
        ...teacherFormData,
        name: teacherFormData.name.trim(),
        fullName: finalFullName,
        title: teacherFormData.title.trim() || 'معلم خبير في تأسيس القدرات',
        tagline: teacherFormData.tagline.trim(),
      };
      const updatedList = coursesStorage.updateInstructor(updated);
      setInstructors([...updatedList]);
      setModules([...coursesStorage.getModules()]);
      setDownloadToast(`تم تحديث بيانات المعلم (${updated.name}) بنجاح! 👨‍🏫✅`);
    } else {
      const newInst: InstructorInfo = {
        ...teacherFormData,
        id: teacherFormData.id || 'teacher_' + Date.now(),
        name: teacherFormData.name.trim(),
        fullName: finalFullName,
        title: teacherFormData.title.trim() || 'معلم خبير في تأسيس القدرات',
        tagline: teacherFormData.tagline.trim(),
      };
      const updatedList = coursesStorage.addInstructor(newInst);
      setInstructors([...updatedList]);
      setSelectedTeacher(newInst.id);
      setDownloadToast(`تمت إضافة المعلم الجديد (${newInst.name}) بنجاح! 👨‍🏫🎉`);
    }
    setTeacherModalOpen(false);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  // حذف مدرس
  const handleDeleteTeacher = (instId: string, name: string) => {
    if (instructors.length <= 1) {
      alert('يجب الإبقاء على مدرس واحد على الأقل في المنصة.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المدرس "${name}"؟ سيتم تحويل كافة محاضراته إلى المعلم الأول تلقائياً.`)) {
      const updatedList = coursesStorage.deleteInstructor(instId);
      setInstructors([...updatedList]);
      setModules([...coursesStorage.getModules()]);
      if (selectedTeacher === instId) {
        setSelectedTeacher(updatedList[0]?.id || 'teacher_1');
      }
      setDownloadToast(`تم حذف المدرس "${name}" بنجاح! 🗑️`);
      setTimeout(() => setDownloadToast(null), 3500);
    }
  };

  // معالجات إدارة الدورات التدريبية
  const handleCourseCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('حجم الصورة كبير، يرجى اختيار صورة أقل من 8 ميجابايت.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCourseFormData((prev) => ({ ...prev, coverImage: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const openAddCourseModal = () => {
    setEditingCourse(null);
    setCourseFormData({
      id: '',
      title: '',
      description: '',
      coverImage: '',
      badge: 'دورة جديدة 1446',
      badgeColor: 'amber',
      priceSar: 75,
      priceEg: ANNUAL_SUBSCRIPTION_PRICE_EGP,
      status: 'active',
      availableDate: '',
      customStatusText: '',
      orderIndex: courses.length + 1,
    });
    setCourseModalOpen(true);
  };

  const openEditCourseModal = (course: CourseItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingCourse(course);
    setCourseFormData({
      ...course,
      status: course.status || 'active',
      customStatusText: course.customStatusText || '',
      availableDate: course.availableDate || '',
    });
    setCourseModalOpen(true);
  };

  const handleSaveCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseFormData.title.trim()) {
      alert('يرجى كتابة اسم الدورة التدريبية.');
      return;
    }

    if (editingCourse) {
      const updated: CourseItem = {
        ...editingCourse,
        title: courseFormData.title.trim(),
        description: courseFormData.description.trim(),
        coverImage: courseFormData.coverImage?.trim() || '',
        badge: courseFormData.badge?.trim() || '',
        badgeColor: courseFormData.badgeColor || 'amber',
        priceSar: Number(courseFormData.priceSar) || 75,
        priceEg: Number(courseFormData.priceEg) || ANNUAL_SUBSCRIPTION_PRICE_EGP,
        status: courseFormData.status || 'active',
        availableDate: courseFormData.availableDate?.trim() || '',
        customStatusText: courseFormData.customStatusText?.trim() || '',
      };
      const updatedList = coursesStorage.updateCourse(updated);
      setCourses([...updatedList]);
      coursesStorage.syncToCloud(undefined, undefined, updatedList).catch(() => { });
      // مزامنة فورية لسعر الدورة في قاعدة بيانات السيرفر
      courseCommerceService
        .updateCoursePrice(
          updated.id,
          updated.title,
          updated.priceSar ?? 75,
          updated.priceEg ?? ANNUAL_SUBSCRIPTION_PRICE_EGP
        )
        .catch(() => { });
      setDownloadToast(`تم تحديث الدورة [${updated.title}] بنجاح! 🎯✅`);
    } else {
      const newCourse: CourseItem = {
        id: 'course_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        title: courseFormData.title.trim(),
        description: courseFormData.description.trim(),
        coverImage: courseFormData.coverImage?.trim() || '',
        badge: courseFormData.badge?.trim() || 'دورة جديدة',
        badgeColor: courseFormData.badgeColor || 'amber',
        priceSar: Number(courseFormData.priceSar) || 75,
        priceEg: Number(courseFormData.priceEg) || ANNUAL_SUBSCRIPTION_PRICE_EGP,
        status: courseFormData.status || 'active',
        availableDate: courseFormData.availableDate?.trim() || '',
        customStatusText: courseFormData.customStatusText?.trim() || '',
        orderIndex: courses.length + 1,
        createdAt: new Date().toISOString(),
      };
      const updatedList = coursesStorage.addCourse(newCourse);
      setCourses([...updatedList]);
      coursesStorage.syncToCloud(undefined, undefined, updatedList).catch(() => { });
      // حفظ سعر الدورة الجديدة في قاعدة بيانات السيرفر
      courseCommerceService
        .updateCoursePrice(
          newCourse.id,
          newCourse.title,
          newCourse.priceSar ?? 75,
          newCourse.priceEg ?? ANNUAL_SUBSCRIPTION_PRICE_EGP
        )
        .catch(() => { });
      setDownloadToast(`تم إنشاء الدورة الجديدة [${newCourse.title}] بنجاح! 🎯🎉`);
    }

    setCourseModalOpen(false);
    setTimeout(() => setDownloadToast(null), 3500);
  };

  const handleDeleteCourse = (courseId: string, title: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (courseId === 'course-foundation') {
      alert('دورة التأسيس الشاملة هي الدورة الأساسية المعتمدة ولا يمكن حذفها.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف دورة "${title}" نهائياً؟`)) {
      const updatedList = coursesStorage.deleteCourse(courseId);
      setCourses([...updatedList]);
      if (selectedCourseId === courseId) {
        setSelectedCourseId(null);
      }
      setDownloadToast(`تم حذف الدورة "${title}" بنجاح 🗑️`);
      setTimeout(() => setDownloadToast(null), 3500);
    }
  };

  // الاستماع لتغييرات الدورات والملفات والاشتراكات والمدرسين
  useEffect(() => {
    const handleSubChanged = () => {
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
    };
    const handleCoursesChanged = (e: any) => {
      const incoming = e.detail || coursesStorage.getCourses();
      setCourses([...incoming]);
    };
    const handleModulesChanged = (e: any) => {
      const incoming = e.detail || coursesStorage.getModules();
      setModules([...incoming]);
    };
    const handleFilesChanged = (e: any) => {
      const incoming = e.detail !== undefined ? e.detail : coursesStorage.getFiles();
      setFiles([...incoming]);
    };
    const handleInstructorsChanged = (e: any) => {
      const incoming = e.detail !== undefined ? e.detail : coursesStorage.getInstructors();
      setInstructors([...incoming]);
    };

    window.addEventListener('tarqa_subscription_changed', handleSubChanged);
    window.addEventListener('tarqa_user_changed', handleSubChanged);
    window.addEventListener('tarqa_courses_list_changed', handleCoursesChanged);
    window.addEventListener('tarqa_course_pricing_updated', handleCoursesChanged);
    window.addEventListener('tarqa_courses_modules_changed', handleModulesChanged);
    window.addEventListener('tarqa_courses_files_changed', handleFilesChanged);
    window.addEventListener('tarqa_instructors_changed', handleInstructorsChanged);

    return () => {
      window.removeEventListener('tarqa_subscription_changed', handleSubChanged);
      window.removeEventListener('tarqa_user_changed', handleSubChanged);
      window.removeEventListener('tarqa_courses_list_changed', handleCoursesChanged);
      window.removeEventListener('tarqa_course_pricing_updated', handleCoursesChanged);
      window.removeEventListener('tarqa_courses_modules_changed', handleModulesChanged);
      window.removeEventListener('tarqa_courses_files_changed', handleFilesChanged);
      window.removeEventListener('tarqa_instructors_changed', handleInstructorsChanged);
    };
  }, [currentUser]);

  // مزامنة أحدث المحاضرات والملفات من السحابة وقاعدة البيانات عند فتح صفحة الدورات
  useEffect(() => {
    coursesStorage.syncFromCloud().then((cloudData) => {
      if (cloudData?.modules && Array.isArray(cloudData.modules)) {
        setModules([...cloudData.modules]);
      }
      if (cloudData?.files && Array.isArray(cloudData.files)) {
        setFiles([...cloudData.files]);
      }
      if (cloudData?.courses && Array.isArray(cloudData.courses)) {
        setCourses([...cloudData.courses]);
      }
    }).catch(() => { });

    // جلب أحدث أسعار معتمدة من قاعدة البيانات
    courseCommerceService.getCoursePricing().then((pricing) => {
      if (pricing && pricing.length > 0) {
        setCourses((prev) =>
          prev.map((c) => {
            const found = pricing.find((p) => p.course_id === c.id);
            if (found) {
              return {
                ...c,
                priceSar: Number(found.price_sar) || c.priceSar,
                priceEg: Number(found.price_egp) || c.priceEg,
              };
            }
            return c;
          })
        );
      }
    }).catch(() => { });
  }, []);

  // الاستماع لتحديثات اشتراكات وأسعار الدورات المستقلة
  useEffect(() => {
    const handleSubUpdated = () => {
      setCourseSubscriptionsVersion((v) => v + 1);
      setSubscriptionInfo(getSubscriptionDetails(currentUser));
    };
    window.addEventListener('tarqa_course_subscription_updated', handleSubUpdated);
    window.addEventListener('tarqa_course_pricing_updated', handleSubUpdated);
    return () => {
      window.removeEventListener('tarqa_course_subscription_updated', handleSubUpdated);
      window.removeEventListener('tarqa_course_pricing_updated', handleSubUpdated);
    };
  }, [currentUser]);

  // تحديث حالة الاشتراك عند تغير المستخدم
  useEffect(() => {
    setSubscriptionInfo(getSubscriptionDetails(currentUser));
  }, [currentUser]);

  // تنفيذ الاشتراك السنوي عبر فتح بوابة الدفع المعتمدة (كاشير / إنستاباي)
  const handleConfirmSubscription = () => {
    if (!isEditor && isCurrentCourseLocked) {
      setDownloadToast(currentCourseEnrollmentInfo.notice || 'التسجيل في هذه الدورة مغلق حالياً أو قادم قريباً ⏳');
      setTimeout(() => setDownloadToast(null), 4000);
      return;
    }

    if (!currentUser) {
      setShowSubscribeModal(false);
      onOpenAuth?.();
      return;
    }

    setShowSubscribeModal(false);
    setPayingCourse(currentCourse);
    setIsKashierCheckoutOpen(true);
  };

  // معالجة اكتمال الدفع بنجاح من بوابة كاشير أو إنستاباي
  const handleKashierPaymentSuccess = async (tx: KashierTransaction) => {
    const userToAct = currentUser || {
      id: tx.userId || 'student_' + Date.now(),
      email: tx.userEmail || '',
      fullName: tx.userName || 'طالب طرقع',
      role: 'student',
    } as TarqaUser;

    setIsSubscribing(true);
    try {
      const res = await activateAnnualSubscription(userToAct);
      setSubscriptionInfo(getSubscriptionDetails(userToAct));
      setSubscribeSuccessMessage('تم تأكيد الدفع وتفعيل اشتراكك السنوي بنجاح! 🎉 استمتع بجميع المحاضرات والملفات.');
      setIsKashierCheckoutOpen(false);
      setShowSubscribeModal(false);
      window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
      setTimeout(() => {
        setSubscribeSuccessMessage(null);
      }, 4000);
    } catch (e) {
      console.error('Error activating subscription after Kashier payment:', e);
    } finally {
      setIsSubscribing(false);
    }
  };

  // فتح المحاضرة أو نافذة الاشتراك أو توجيه الزائر للتسجيل
  const handleLessonClick = async (lesson: Lesson) => {
    if (!isEditor && isCurrentCourseLocked) {
      setDownloadToast('هذه الدورة قادمة قريباً ومغلقة حالياً ⏳ ستتاح المحاضرات فور إطلاق الدورة رسمياً');
      setTimeout(() => setDownloadToast(null), 4000);
      return;
    }

    if (!currentUser) {
      if (lesson.isFreePreview) {
        setDownloadToast('هذه المحاضرة تجريبية مجانية 🎁 سجل حسابك المجاني في ثوانٍ لمشاهدتها فوراً!');
        setTimeout(() => setDownloadToast(null), 5000);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_open_auth', { detail: 'signup' }));
        }
        onOpenAuth?.();
        return;
      }
      setDownloadToast('هذه المحاضرة مخصصة للمشتركين 🔒 يرجى تسجيل حسابك والاشتراك للوصول الكامل');
      setTimeout(() => setDownloadToast(null), 5000);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_open_auth', { detail: 'signin' }));
      }
      onOpenAuth?.();
      return;
    }

    let isEnrolled = courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id);
    let canAccess = canAccessLesson(lesson, currentUser);

    // التحقق المباشر من قاعدة بيانات السيرفر قبل فتح المحاضرة للمشترك
    if (!isEditor && !lesson.isFreePreview && (isEnrolled || canAccess)) {
      try {
        const cleanTg = (currentUser.telegramUsername || '').replace(/^@/, '').trim();
        const hostRes = await callHostingerApi('get_user_role', {
          userId: currentUser.id,
          email: currentUser.email,
          telegram_id: currentUser.telegramId,
          telegram_username: cleanTg
        });
        if (hostRes && hostRes.success && hostRes.user) {
          const isSub = Boolean(hostRes.user.isSubscribed);
          if (!isSub) {
            // تم إلغاء اشتراكه في قاعدة البيانات! نقفل المحاضرة فوراً
            const updated: TarqaUser = {
              ...currentUser,
              isSubscribed: false,
              subscriptionExpiresAt: undefined,
            };
            authService.setCurrentUser(updated);
            try {
              const rawSubs = localStorage.getItem('tarqa_subscriptions');
              if (rawSubs) {
                const subs = JSON.parse(rawSubs);
                if (currentUser.id) delete subs[currentUser.id];
                if (currentUser.email) delete subs[currentUser.email.toLowerCase().trim()];
                localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));
              }
            } catch {}
            setSubscriptionInfo(getSubscriptionDetails(updated));
            window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
            setPayingCourse(currentCourse);
            setDownloadToast('تم إلغاء اشتراكك في هذه الدورة أو انتهت صلاحيته 🔒');
            setTimeout(() => setDownloadToast(null), 4500);
            return;
          }
        }
      } catch {}
    }

    isEnrolled = courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id);
    canAccess = canAccessLesson(lesson, currentUser);
    const hasAccess = lesson.isFreePreview || isEditor || isEnrolled || canAccess;
    if (hasAccess) {
      onOpenClassroom({ ...currentModule, lessons: displayedLessons }, lesson);
    } else {
      setPayingCourse(currentCourse);
    }
  };

  // تحميل أو فتح ملف
  const handleFileAction = async (file: CourseFileItem, previewMode = false) => {
    if (!isEditor && isCurrentCourseLocked) {
      setDownloadToast('هذه الدورة قادمة قريباً ومغلقة حالياً ⏳ ستتاح المذكرات والملفات فور إطلاق الدورة رسمياً');
      setTimeout(() => setDownloadToast(null), 4000);
      return;
    }

    if (!currentUser) {
      if (file.isFreePreview) {
        setDownloadToast('هذا الملف متاح مجاناً 🎁 يرجى إنشاء حساب مجاني أولاً للوصول إليه');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_open_auth', { detail: 'signup' }));
        }
      } else {
        setDownloadToast('هذا الملف مخصص للمشتركين 🔒 يرجى تسجيل حسابك والاشتراك للوصول إليه');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_open_auth', { detail: 'signin' }));
        }
      }
      setTimeout(() => setDownloadToast(null), 4500);
      onOpenAuth?.();
      return;
    }

    let isEnrolled = courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id);

    // التحقق المباشر من قاعدة بيانات السيرفر قبل فتح أو تحميل الملف
    if (!isEditor && !file.isFreePreview && (isEnrolled || subscriptionInfo.isSubscribed)) {
      try {
        const cleanTg = (currentUser.telegramUsername || '').replace(/^@/, '').trim();
        const hostRes = await callHostingerApi('get_user_role', {
          userId: currentUser.id,
          email: currentUser.email,
          telegram_id: currentUser.telegramId,
          telegram_username: cleanTg
        });
        if (hostRes && hostRes.success && hostRes.user) {
          const isSub = Boolean(hostRes.user.isSubscribed);
          if (!isSub) {
            const updated: TarqaUser = {
              ...currentUser,
              isSubscribed: false,
              subscriptionExpiresAt: undefined,
            };
            authService.setCurrentUser(updated);
            try {
              const rawSubs = localStorage.getItem('tarqa_subscriptions');
              if (rawSubs) {
                const subs = JSON.parse(rawSubs);
                if (currentUser.id) delete subs[currentUser.id];
                if (currentUser.email) delete subs[currentUser.email.toLowerCase().trim()];
                localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));
              }
            } catch {}
            setSubscriptionInfo(getSubscriptionDetails(updated));
            window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
            setPayingCourse(currentCourse);
            setDownloadToast('تم إلغاء اشتراكك في هذه الدورة أو انتهت صلاحيته 🔒');
            setTimeout(() => setDownloadToast(null), 4500);
            return;
          }
        }
      } catch {}
    }

    isEnrolled = courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id);
    const hasAccess = Boolean(file.isFreePreview || isEditor || isEnrolled || subscriptionInfo.isSubscribed);

    if (!hasAccess) {
      setPayingCourse(currentCourse);
      setDownloadToast('عفواً، معاينة وتنزيل هذا الملف متاحة للمشتركين فقط 🔒');
      setTimeout(() => setDownloadToast(null), 4000);
      return;
    }

    // التحقق من أن الملف تم رفعه فعلياً بواسطة المدرس
    if (!file.fileUrl || file.fileUrl.trim() === '' || file.fileUrl.includes('tarqa.app/files/')) {
      setDownloadToast('⚠️ لم يتم رفع ملف أصلي لهذه المذكرة بعد من قبل المدرس أو الإدارة.');
      setTimeout(() => setDownloadToast(null), 4500);
      return;
    }

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

    const isMobile = isMobileDevice();
    // على الموبايل أو في حال طلب المعاينة، نفتح دائماً نافذة التحميل الشاملة لمنع حجب المتصفحات الجوالة (سفاري وكروم) للتنزيل الصامت
    if (isMobile || previewMode) {
      setPreviewFile(file);
      setIsPreviewModalOpen(true);
      return;
    }

    // تنزيل الملف كاملاً على جهاز الطالب مباشرة مع ختم وتشفير بياناته الأمنية (للكمبيوتر)
    setDownloadingFileId(file.id);
    setDownloadToast(`جاري تشفير وتنزيل [${file.title}] على جهازك... 🛡️`);

    try {
      const res = await fileStorageService.downloadWatermarkedFile(file, currentUser);
      if (res && res.success) {
        setDownloadNotice({
          fileName: res.fileName,
          url: res.url,
          title: file.title,
        });
        setDownloadToast(`تم تجهيز وتنزيل [${file.title}] على جهازك بنجاح ✅`);
      } else {
        setDownloadToast('تعذر تنزيل الملف، يرجى المحاولة مجدداً');
      }
      setTimeout(() => setDownloadToast(null), 5000);
    } catch (err) {
      console.error('Error downloading file:', err);
      setDownloadToast('تعذر تنزيل الملف، يرجى المحاولة مجدداً');
      setTimeout(() => setDownloadToast(null), 4000);
    } finally {
      setDownloadingFileId(null);
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

    const defaultVideoUrl = '';

    const teacherId = lessonFormData.teacherId || instructors[0]?.id || 'teacher_1';
    const matchedTeacher = instructors.find((i) => i.id === teacherId);
    const teacherName = matchedTeacher?.fullName || matchedTeacher?.name || lessonFormData.teacherName || 'مدرس';

    if (editingLesson) {
      const updatedLesson: Lesson = {
        ...editingLesson,
        title: lessonFormData.title.trim(),
        description: lessonFormData.description.trim(),
        teacherId,
        teacherName,
        videoUrl: lessonFormData.videoUrl.trim() || defaultVideoUrl,
        videoProvider: lessonFormData.videoProvider || (lessonFormData.videoUrl.includes('youtu') ? 'youtube' : 'direct_url'),
        durationMinutes: Number(lessonFormData.durationMinutes) || 15,
        isFreePreview: lessonFormData.isFreePreview,
        attachments: attachments.length > 0 ? attachments : editingLesson.attachments,
      };
      const updated = coursesStorage.updateLesson(updatedLesson);
      setModules([...updated]);
      setSelectedTeacher(teacherId);
      setDownloadToast(`تم تحديث المحاضرة [${updatedLesson.title}] بنجاح ✅`);
      setTimeout(() => setDownloadToast(null), 3500);
    } else {
      const newLesson: Lesson = {
        id: 'lesson_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        moduleId: currentModule.id,
        moduleTitle: currentModule.title,
        title: lessonFormData.title.trim(),
        description: lessonFormData.description.trim(),
        teacherId,
        teacherName,
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
      setSelectedTeacher('all');
      setDownloadToast(`تمت إضافة المحاضرة [${newLesson.title}] بنجاح 🎥✅`);
      setTimeout(() => setDownloadToast(null), 3500);
    }

    setLessonModalOpen(false);
  };

  // حذف محاضرة
  const handleDeleteLesson = (lessonId: string) => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه المحاضرة نهائياً من الموقع؟')) {
      const updated = coursesStorage.deleteLesson(currentModule.id, lessonId);
      setModules([...updated]);
      setDownloadToast('تم حذف المحاضرة نهائياً بنجاح 🗑️');
      setTimeout(() => setDownloadToast(null), 3500);
    }
  };

  // تبديل المعاينة المجانية للمحاضرة
  const handleToggleLessonPreview = (lessonId: string) => {
    const updated = coursesStorage.toggleFreePreview(currentModule.id, lessonId);
    setModules([...updated]);
  };

  // فتح نافذة إضافة باب جديد
  const handleOpenAddModule = () => {
    setEditingModule(null);
    setModuleFormData({
      title: '',
      description: '',
      status: 'active',
      availableDate: '',
      customStatusText: '',
    });
    setModuleModalOpen(true);
  };

  // فتح نافذة تعديل باب
  const handleOpenEditModule = (mod?: CourseModule) => {
    const target = mod || currentModule;
    setEditingModule(target);
    setModuleFormData({
      title: target.title || '',
      description: target.description || '',
      status: (target.status || 'active') as CourseEnrollmentStatus,
      availableDate: target.availableDate || '',
      customStatusText: target.customStatusText || '',
    });
    setModuleModalOpen(true);
  };

  // حفظ إضافة أو تعديل الباب
  const handleSaveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingModule) return;
    const cleanTitle = moduleFormData.title.trim();
    if (!cleanTitle) return;

    setIsSavingModule(true);
    try {
      if (editingModule) {
        const updated: CourseModule = {
          ...editingModule,
          courseId: editingModule.courseId || currentCourse.id,
          title: cleanTitle,
          description: moduleFormData.description.trim(),
          status: moduleFormData.status,
          availableDate: moduleFormData.availableDate.trim(),
          customStatusText: moduleFormData.customStatusText.trim(),
        };
        const updatedList = coursesStorage.updateModule(updated);
        setModules([...updatedList]);
        setDownloadToast(`تم تحديث باب [${updated.title}] بنجاح 📚✅`);
      } else {
        const uniqueId = 'mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newMod: CourseModule = {
          id: uniqueId,
          courseId: currentCourse.id,
          title: cleanTitle,
          description: moduleFormData.description.trim(),
          orderIndex: currentCourseModules.length + 1,
          status: moduleFormData.status,
          customStatusText: moduleFormData.customStatusText.trim(),
          availableDate: moduleFormData.availableDate.trim(),
          badgeColor: 'amber',
          isPublished: true,
          lessons: [],
          totalDurationMinutes: 0,
          completedLessonsCount: 0,
        };
        const updatedList = coursesStorage.addModule(newMod);
        setModules([...updatedList]);
        setSelectedModuleId(newMod.id);
        setDownloadToast(`تمت إضافة باب جديد [${newMod.title}] بنجاح 📚🎉`);
      }
      setModuleModalOpen(false);
      setTimeout(() => setDownloadToast(null), 3500);
    } finally {
      setTimeout(() => setIsSavingModule(false), 400);
    }
  };

  // حذف باب بالكامل
  const handleDeleteModule = (modId: string, title: string) => {
    if (modules.length <= 1) {
      alert('لا يمكن حذف الباب الوحيد في الدورة.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف باب "${title}" فقط وكافة المحاضرات التابعة له؟`)) {
      const updatedList = coursesStorage.deleteModule(modId);
      setModules([...updatedList]);
      if (selectedModuleId === modId) {
        setSelectedModuleId(updatedList[0]?.id || '');
      }
      setDownloadToast(`تم حذف باب [${title}] بنجاح 🗑️`);
      setTimeout(() => setDownloadToast(null), 3500);
    }
  };

  // إعادة ترتيب الأبواب
  const handleReorderModule = (modId: string, direction: 'up' | 'down') => {
    const updatedList = coursesStorage.reorderModules(modId, direction);
    setModules([...updatedList]);
    setDownloadToast('تم تحديث ترتيب الأبواب بنجاح ↕️');
    setTimeout(() => setDownloadToast(null), 3000);
  };

  // حفظ ملف جديد أو معدل
  const handleSaveFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileFormData.title.trim()) return;

    if (editingFile) {
      const updated: CourseFileItem = {
        ...editingFile,
        courseId: editingFile.courseId || currentCourse.id,
        title: fileFormData.title.trim(),
        description: fileFormData.description.trim(),
        fileUrl: fileFormData.fileUrl.trim(),
        fileSize: fileFormData.fileSize.trim() || '10 MB',
        pagesCount: fileFormData.pagesCount.trim() || '100 صفحة',
        fileType: fileFormData.fileType,
        isFreePreview: fileFormData.isFreePreview,
      };
      const updatedFiles = coursesStorage.updateFile(updated);
      setFiles([...updatedFiles]);
      setDownloadToast(`تم تحديث الملف [${updated.title}] بنجاح 📄✅`);
      setTimeout(() => setDownloadToast(null), 3500);
    } else {
      const newFile: CourseFileItem = {
        id: 'cfile_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        courseId: currentCourse.id,
        title: fileFormData.title.trim(),
        description: fileFormData.description.trim(),
        fileUrl: fileFormData.fileUrl.trim(),
        fileSize: fileFormData.fileSize.trim() || '10 MB',
        pagesCount: fileFormData.pagesCount.trim() || '100 صفحة',
        fileType: fileFormData.fileType,
        isFreePreview: fileFormData.isFreePreview,
        downloadCount: 0,
        uploadedAt: 'اليوم',
      };
      const updatedFiles = coursesStorage.addFile(newFile);
      setFiles([...updatedFiles]);
      setDownloadToast(`تمت إضافة الملف [${newFile.title}] بنجاح 📄✅`);
      setTimeout(() => setDownloadToast(null), 3500);
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

  // تصفية المحاضرات حسب المدرس المختار
  const allCourseLessons = currentCourseModules.flatMap((m) => m.lessons || []);
  const allLessons = currentModule.lessons || [];
  const currentTeacherObj = (selectedTeacher !== 'all' ? instructors.find((i) => i.id === selectedTeacher) : null) || instructors[0] || AVAILABLE_INSTRUCTORS[0];
  const displayedLessons = selectedTeacher === 'all'
    ? allLessons
    : allLessons.filter((l) => (l.teacherId || instructors[0]?.id || 'teacher_1') === selectedTeacher);

  const totalLessons = allCourseLessons.length > 0 ? allCourseLessons.length : allLessons.length;
  const activeLecturesCount = displayedLessons.length;
  const totalDurationMinutes = allCourseLessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0);
  const freePreviewsCount = allCourseLessons.filter((l) => l.isFreePreview).length;
  const mainFile = currentCourseFiles[0] || files[0];

  // نافذة إضافة / تعديل دورة تدريبية
  const renderCourseModal = () => {
    if (!courseModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-right">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>{editingCourse ? 'تعديل بيانات الدورة التدريبية ✏️' : 'إضافة دورة تدريبية جديدة 🎯'}</span>
            </h3>
            <button
              onClick={() => setCourseModalOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSaveCourse} className="space-y-4 pt-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                اسم الدورة التدريبية: <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={courseFormData.title || ''}
                onChange={(e) => setCourseFormData({ ...courseFormData, title: e.target.value })}
                placeholder="مثال: دورة التأسيس الشاملة للقدرات 🎯"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                وصف ومحاور الدورة:
              </label>
              <textarea
                rows={3}
                value={courseFormData.description || ''}
                onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                placeholder="اكتب نبذة مختصرة عن الدورة التدريبية والفئة المستهدفة وما سيتعلمه الطالب..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* صورة غلاف الدورة */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                صورة غلاف الدورة (رابط مباشر أو رفع من الجهاز):
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={courseFormData.coverImage || ''}
                  onChange={(e) => setCourseFormData({ ...courseFormData, coverImage: e.target.value })}
                  placeholder="https://... أو ارفع صورة"
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <input
                  type="file"
                  ref={courseCoverInputRef}
                  onChange={handleCourseCoverUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => courseCoverInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>رفع صورة</span>
                </button>
              </div>
              {courseFormData.coverImage && (
                <div className="mt-2 relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 h-28 bg-slate-900/50">
                  <img
                    src={courseFormData.coverImage}
                    alt="معاينة الغلاف"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setCourseFormData({ ...courseFormData, coverImage: '' })}
                    className="absolute top-2 left-2 p-1 rounded-lg bg-slate-950/70 text-rose-400 hover:text-rose-300 transition cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* الشارة واللون */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  شارة الدورة (Badge):
                </label>
                <input
                  type="text"
                  value={courseFormData.badge || ''}
                  onChange={(e) => setCourseFormData({ ...courseFormData, badge: e.target.value })}
                  placeholder="مثال: دورة تأسيس معتمدة 1446"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  لون الشارة:
                </label>
                <select
                  value={courseFormData.badgeColor || 'amber'}
                  onChange={(e) => setCourseFormData({ ...courseFormData, badgeColor: e.target.value as any })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold cursor-pointer"
                >
                  <option value="amber">ذهبي (Amber)</option>
                  <option value="blue">أزرق (Blue)</option>
                  <option value="emerald">أخضر (Emerald)</option>
                  <option value="purple">بنفسجي (Purple)</option>
                  <option value="rose">وردي (Rose)</option>
                </select>
              </div>
            </div>

            {/* الأسعار: ريال سعودي وجنيه مصري */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  السعر السنوي (ريال سعودي 🇸🇦):
                </label>
                <input
                  type="number"
                  min="0"
                  value={courseFormData.priceSar ?? 75}
                  onChange={(e) => setCourseFormData({ ...courseFormData, priceSar: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  السعر بالجنيه المصري (مصر 🇪🇬):
                </label>
                <input
                  type="number"
                  min="0"
                  value={courseFormData.priceEg ?? ANNUAL_SUBSCRIPTION_PRICE_EGP}
                  onChange={(e) => setCourseFormData({ ...courseFormData, priceEg: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>
            </div>

            {/* حالة التسجيل والتاريخ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  حالة التسجيل في الدورة:
                </label>
                <select
                  value={courseFormData.status || 'active'}
                  onChange={(e) => setCourseFormData({ ...courseFormData, status: e.target.value as any })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold cursor-pointer"
                >
                  <option value="active">متاحة للتسجيل الفوري 🟢</option>
                  <option value="upcoming">قريباً / قادمة قريباً ⏳</option>
                  <option value="locked">مغلقة / قيد التجهيز 🔒</option>
                  <option value="paused">مغلقة مؤقتاً للتحديث ⏸️</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  تاريخ الإتاحة أو موعد البدء (اختياري):
                </label>
                <input
                  type="text"
                  value={courseFormData.availableDate || ''}
                  onChange={(e) => setCourseFormData({ ...courseFormData, availableDate: e.target.value })}
                  placeholder="مثال: 15 أكتوبر 2026 أو قريباً"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {courseFormData.status && courseFormData.status !== 'active' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص الزر والشارة المخصص (اختياري):
                </label>
                <input
                  type="text"
                  value={courseFormData.customStatusText || ''}
                  onChange={(e) => setCourseFormData({ ...courseFormData, customStatusText: e.target.value })}
                  placeholder="مثال: قريباً ⏳ أو قيد التجهيز"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer"
              >
                {editingCourse ? 'حفظ تعديلات الدورة 💾' : 'إنشاء وإضافة الدورة الآن 🎯🎉'}
              </button>
              <button
                type="button"
                onClick={() => setCourseModalOpen(false)}
                className="px-5 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-900 dark:text-slate-100 transition-colors pb-24">
      {selectedCourseId === null ? (
        <>
          {/* ======================================================================= */}
          {/* 1. قسم الإعلانات والبوابات (أعلى الصفحة كما في رسم المستخدم) */}
          {/* ======================================================================= */}
          <AdBannerSlider
            isEditor={isEditor}
            courses={courses}
            onSelectCourse={(cId) => {
              const target = courses.find((c) => c.id === cId);
              if (target && !isEditor && !getCourseEnrollmentInfo(target).isOpen) {
                setLockedCourseNotice(target);
              } else {
                setSelectedCourseId(cId);
              }
            }}
          />

          {/* الخط الفاصل بين قسم الإعلانات وقسم الدورات (كما في رسم المستخدم تماماً) */}
          <div className="relative max-w-7xl mx-auto my-8 sm:my-12 px-4 sm:px-6 lg:px-8">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent" />
            <div className="absolute left-1/2 -translate-x-1/2 -top-3 px-4 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center gap-1.5 shadow-sm">
              <span>✨</span>
              <span>منصة الدورات المعتمدة</span>
              <span>✨</span>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* 2. قسم الدورات التدريبية (الدورات : كما في رسم المستخدم) */}
          {/* ======================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-black">
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <span>الدورات :</span>
                    <span className="text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                      {courses.length} دورات متاحة 🎯
                    </span>
                  </h2>
                </div>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  اختر الدورة التدريبية للانتقال إلى صفحتها الخاصة ومتابعة الأبواب والمحاضرات والملفات المعتمدة.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 flex-wrap sm:flex-nowrap lg:flex-wrap">
                {isEditor && (
                  <>
                    <button
                      onClick={() => setSubscribersModalCourseId('all')}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-black text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                      <Users className="w-4 h-4 text-sky-500" />
                      <span>مشتركو الدورات 👥</span>
                    </button>

                    <button
                      onClick={handleManualCloudSync}
                      disabled={isSyncingCloud}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                      title="مزامنة فورية للمحاضرات والدورات والأسعار بين جميع أجهزتك (الموبايل، التاب، واللابتوب)"
                    >
                      {isSyncingCloud ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <RotateCcw className="w-4 h-4 text-emerald-500" />}
                      <span>مزامنة الأجهزة والداتابيز 🔄</span>
                    </button>

                    <button
                      onClick={() => setIsCommerceAdminOpen(true)}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs sm:text-sm shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                      title="إدارة أسعار الدورات في الداتابيز وأكواد الخصم وسجل الإيصالات"
                    >
                      <Tag className="w-4 h-4 text-amber-500" />
                      <span>🎟️ مولّد الكوبونات والأسعار</span>
                    </button>
                    <button
                      onClick={openAddCourseModal}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                      title="إضافة دورة تدريبية جديدة"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ إضافة دورة جديدة 🎯</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* شبكة بطاقات الدورات (متجاوبة تماماً للموبايل والتابلت والكمبيوتر) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {courses.map((course) => {
                const courseModules = modules.filter(
                  (m) => (m.courseId || 'course-foundation') === course.id
                );
                const courseLessons = courseModules.flatMap((m) => m.lessons || []);
                const courseFiles = files.filter(
                  (f) => (f.courseId || 'course-foundation') === course.id
                );
                const courseStatusInfo = getCourseEnrollmentInfo(course);
                const isCourseLocked = !courseStatusInfo.isOpen;

                return (
                  <div
                    key={course.id}
                    onClick={() => {
                      if (!isEditor && isCourseLocked) {
                        setLockedCourseNotice(course);
                      } else {
                        setSelectedCourseId(course.id);
                      }
                    }}
                    className="group relative rounded-3xl bg-white dark:bg-[#0c1324] border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 transition-all duration-300 hover:shadow-[0_12px_35px_rgba(245,158,11,0.15)] flex flex-col justify-between overflow-hidden cursor-pointer"
                  >
                    {/* الجزء العلوي: صورة الغلاف أو الأيقونة + الشارة */}
                    <div className="relative h-48 w-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 overflow-hidden">
                      {course.coverImage ? (
                        <img
                          src={course.coverImage}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center relative">
                          <div className="absolute inset-0 bg-radial from-amber-500/10 via-transparent to-transparent opacity-60" />
                          <div className="w-16 h-16 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-2 shadow-inner">
                            <GraduationCap className="w-8 h-8" />
                          </div>
                          <span className="text-xs font-bold text-amber-300/80">منصة طرقع التعليمية</span>
                        </div>
                      )}

                      {/* الشارات العلوية */}
                      <div className="absolute top-3 right-3 flex items-center gap-1.5 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-[11px] font-black bg-slate-950/80 backdrop-blur-md text-amber-400 border border-amber-500/30 shadow-md">
                          {course.badge || 'دورة معتمدة'}
                        </span>
                        {isCourseLocked && (
                          <span className="px-3 py-1 rounded-full text-[11px] font-black bg-rose-950/85 backdrop-blur-md text-rose-300 border border-rose-500/40 shadow-md flex items-center gap-1">
                            <Lock className="w-3 h-3 text-rose-400" />
                            <span>{courseStatusInfo.buttonText || 'قريباً ⏳'}</span>
                          </span>
                        )}
                      </div>

                      {/* أزرار المشرف السريعة */}
                      {isEditor && (
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSubscribersModalCourseId(course.id);
                            }}
                            className="p-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-sky-400 hover:text-sky-300 border border-slate-700 hover:border-sky-500/40 transition cursor-pointer"
                            title="مشتركو هذه الدورة"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => openEditCourseModal(course, e)}
                            className="p-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 transition cursor-pointer"
                            title="تعديل الدورة"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {course.id !== 'course-foundation' && (
                            <button
                              onClick={(e) => handleDeleteCourse(course.id, course.title, e)}
                              className="p-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md text-slate-300 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition cursor-pointer"
                              title="حذف الدورة"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-[#0c1324] to-transparent" />
                    </div>

                    {/* محتوى البطاقة */}
                    <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors leading-tight">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                          {course.description || 'شرح متكامل ومكثف يشمل المحاضرات المسجلة والمذكرات المعتمدة واختبارات قياس.'}
                        </p>
                      </div>

                      {/* إحصائيات الدورة */}
                      <div className="grid grid-cols-2 gap-2 py-2 border-y border-slate-100 dark:border-slate-800/80 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
                          <Video className="w-3.5 h-3.5 text-amber-500" />
                          <span>{courseLessons.length} محاضرة</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-bold">
                          <FileText className="w-3.5 h-3.5 text-blue-500" />
                          <span>{courseFiles.length} ملفات PDF</span>
                        </div>
                      </div>

                      {/* السعر وزر الدخول */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-bold">الاشتراك السنوي:</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                              {course.priceSar}
                            </span>
                            <span className="text-[11px] font-bold text-slate-500">ريال / سنة</span>
                          </div>
                        </div>

                        {isEditor ? (
                          <div className="px-4 py-2.5 rounded-xl bg-amber-500 group-hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5">
                            <span>إدارة الدورة 🛡️</span>
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                          </div>
                        ) : isCourseLocked ? (
                          <div className="px-4 py-2.5 rounded-xl bg-slate-800 text-amber-400 border border-amber-500/40 font-black text-xs shadow-md transition flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            <span>{courseStatusInfo.buttonText || 'قريباً ⏳'}</span>
                          </div>
                        ) : courseCommerceService.isUserSubscribedToCourse(currentUser, course.id) ? (
                          <div className="px-4 py-2.5 rounded-xl bg-emerald-500 group-hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5">
                            <span>أنت مشترك ✅ دخول 🚀</span>
                            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingCourse(course);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer hover:scale-105"
                          >
                            <span>اشتراك الدورة 💳</span>
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* كرت إضافة دورة جديدة في نهاية الشبكة (للمشرفين والمعلمين فقط) */}
              {isEditor && (
                <div
                  onClick={openAddCourseModal}
                  className="group relative rounded-3xl border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-300 min-h-[300px] flex flex-col items-center justify-center p-8 text-center cursor-pointer shadow-sm hover:shadow-xl hover:shadow-amber-500/10 active:scale-98"
                >
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-inner shadow-amber-500/20">
                    <Plus className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                    إضافة دورة جديدة 🎯
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-xs leading-relaxed">
                    أنشئ دورة تدريبية جديدة مع غلاف وسعر ومحاضرات ومذكرات معتمدة.
                  </p>
                  <span className="mt-5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-black text-xs shadow-md transition group-hover:bg-amber-400">
                    + إنشاء دورة الآن
                  </span>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* زر العودة لقائمة الدورات (في الصفحة المخصصة لكل دورة) */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 flex items-center justify-between gap-4 flex-wrap">
            <button
              onClick={() => setSelectedCourseId(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 text-slate-700 dark:text-slate-200 hover:text-amber-600 dark:hover:text-amber-400 font-black text-xs sm:text-sm shadow-sm transition group cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-amber-500 group-hover:-translate-x-1 transition-transform" />
              <span>← العودة إلى قائمة الدورات (الدورات :)</span>
            </button>

            <div className="flex items-center gap-2">
              {isEditor && (
                <>
                  <button
                    type="button"
                    onClick={handleManualCloudSync}
                    disabled={isSyncingCloud}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-black text-xs sm:text-sm shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                    title="مزامنة فورية للمحاضرات والدورات والأسعار بين جميع أجهزتك (الموبايل، التاب، واللابتوب)"
                  >
                    {isSyncingCloud ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <RotateCcw className="w-4 h-4 text-emerald-500" />}
                    <span>مزامنة الأجهزة والداتابيز 🔄</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCommerceAdminOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-black text-xs sm:text-sm shadow-sm transition cursor-pointer"
                    title="إدارة أسعار الدورات في الداتابيز وأكواد الخصم وسجل الإيصالات"
                  >
                    <Tag className="w-4 h-4 text-amber-500" />
                    <span>الأسعار والكوبونات والإيصالات 🎟️⚙️</span>
                  </button>
                </>
              )}

              {isEditor && (
                <button
                  onClick={openAddCourseModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm shadow-md transition cursor-pointer active:scale-95"
                  title="إضافة دورة تدريبية جديدة"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ إضافة دورة جديدة 🎯</span>
                </button>
              )}
            </div>
          </div>

          {/* ======================================================================= */}
          {/* 1. رأس الصفحة والبانر الترحيبي وبطاقة الاشتراك للدورة المحددة */}
          {/* ======================================================================= */}
          <section className="relative overflow-hidden pt-4 pb-12 px-4 sm:px-6 lg:px-8 border-b border-sky-200/50 dark:border-amber-500/20 bg-gradient-to-b from-sky-400/10 via-amber-400/5 to-transparent dark:from-amber-950/30 dark:via-[#130d1d]/20 dark:to-transparent">
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">

              {/* الجانب الأيمن: النص والعنوان (متجاوب بشكل مريح للشاشات والتابلت) */}
              <div className="lg:col-span-7 space-y-4 text-right">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 p-1 flex items-center justify-center shadow-sm shrink-0">
                    <img src="/frame_00012.png" alt="شعار طرقع" className="w-full h-full object-contain drop-shadow-sm" />
                  </div>
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 dark:bg-amber-500/15 border border-sky-200/70 dark:border-amber-500/30 text-sky-900 dark:text-amber-400 text-xs font-bold shadow-sm backdrop-blur-sm">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    <span>{currentCourse.badge || 'دورة معتمدة'}</span>
                  </div>
                  {isCurrentCourseLocked && (
                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-black shadow-sm">
                      <Lock className="w-3.5 h-3.5" />
                      <span>{currentCourseEnrollmentInfo.buttonText || 'قريباً ⏳'}</span>
                    </div>
                  )}
                </div>

                {isCurrentCourseLocked && (
                  <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs sm:text-sm font-bold flex items-center justify-between gap-3 flex-wrap shadow-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>{currentCourseEnrollmentInfo.notice || 'هذه الدورة قادمة قريباً ومغلقة للتسجيل حالياً ⏳'}</span>
                    </div>
                    {isEditor && (
                      <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-700 dark:text-purple-300 text-[11px] font-black">
                        دخول كمسؤول للتعديل 🛡️
                      </span>
                    )}
                  </div>
                )}

                <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-[1.3]">
                  {currentCourse.title} 🎯 <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-600 via-amber-500 to-yellow-500">
                    محاضرات مسجلة + ملف المذكرة المعتمد PDF
                  </span>
                </h1>

                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {currentCourse.description || `اشتراك سنوي موحد يمنحك وصولاً شاملاً لمدة 365 يوماً إلى المحاضرات التدريبية (${totalLessons} محاضرة تدريبية)، وقسم الملف الذي يضم المذكرات وأوراق العمل والملخصات القابلة للتحميل.`}
                </p>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500 dark:text-slate-400 pt-2">
                  <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <Video className="w-4 h-4" />
                    <span>{totalLessons} محاضرة مسجلة</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <FileText className="w-4 h-4" />
                    <span>{currentCourseFiles.length} ملفات ومذكرات</span>
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
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${isEditMode
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30'
                        }`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{isEditMode ? 'إغلاق وضع تعديل المحتوى' : 'تفعيل وضع إدارة وتعديل المحتوى (معلم / مشرف)'}</span>
                    </button>

                    <button
                      onClick={(e) => openEditCourseModal(currentCourse, e)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-sm cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>تعديل تفاصيل هذه الدورة ⚙️</span>
                    </button>

                    <button
                      onClick={() => setSubscribersModalCourseId(currentCourse.id)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-300 shadow-sm cursor-pointer"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>مشتركو هذه الدورة 👥</span>
                    </button>

                    <button
                      onClick={() => setIsCommerceAdminOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 shadow-sm cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>مولّد الكوبونات وتعديل السعر 🎟️</span>
                    </button>
                  </div>
                )}
              </div>

              {/* الجانب الأيسر: بطاقة الاشتراك السنوي للدورة (مضبوطة العرض للتابلت واللابتوب) */}
              <div className="lg:col-span-5 flex justify-center w-full">
                <div className="w-full max-w-lg lg:max-w-sm rounded-3xl tarqa-glass-hero backdrop-blur-2xl p-6 shadow-[0_12px_40px_rgba(14,165,233,0.12)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(245,158,11,0.18)] relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      الباقة السنوية الشاملة
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      {moduleEnrollmentInfo.badgeText}
                    </span>
                  </div>

                  {/* السعر الكبير */}
                  <div className="flex flex-col mb-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white font-mono">
                        {currentCourse.priceSar || ANNUAL_SUBSCRIPTION_PRICE_SAR}
                      </span>
                      <span className="text-sm font-bold text-slate-500">ريال سعودي / سنوياً</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-amber-600 dark:text-amber-400 font-mono">
                      <span>أو ما يعادله في مصر:</span>
                      <span className="text-sm font-black underline">{currentCourse.priceEg || ANNUAL_SUBSCRIPTION_PRICE_EGP} جنيه مصري</span>
                    </div>
                  </div>

                  {/* قائمة المميزات */}
                  <div className="space-y-2.5 text-xs text-slate-700 dark:text-slate-300 pb-5 mb-5 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>فتح كافة محاضرات الدورة بدون قيود</span>
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
                  ) : isCurrentCourseLocked ? (
                    <div className="space-y-2">
                      <div className="w-full py-3.5 px-4 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-amber-400 font-black text-sm text-center flex items-center justify-center gap-2 shadow-inner">
                        <Lock className="w-4 h-4" />
                        <span>{currentCourseEnrollmentInfo.buttonText || 'التسجيل مغلق حالياً ⏳'}</span>
                      </div>
                      <p className="text-[11px] text-center text-slate-500 dark:text-slate-400 font-bold">
                        {currentCourse.availableDate
                          ? `📅 موعد الإتاحة المتوقع: ${currentCourse.availableDate}`
                          : 'الدورة قيد الإعداد والتجهيز وستفتح قريباً بإذن الله.'}
                      </p>
                    </div>
                  ) : courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id) ? (
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-1">
                      <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>أنت مشترك في هذه الدورة بنجاح ✅</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        متاح لك مشاهدة كافة محاضرات الدورة وتحميل المذكرات المعتمدة
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setPayingCourse(currentCourse)}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-base shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer select-none transition-all active:scale-[0.98]"
                      >
                        <Sparkles className="w-5 h-5 text-slate-950 shrink-0" />
                        <span>الاشتراك في هذه الدورة 🚀 ({currentCourse.priceSar || ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س)</span>
                      </button>
                    </div>
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
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white/80 dark:bg-[#120e1d]/80 p-2 rounded-2xl border border-sky-200/70 dark:border-amber-500/25 backdrop-blur-xl shadow-[0_4px_20px_rgba(14,165,233,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none max-w-full py-1 -mx-1 px-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'all'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-sky-100/60 dark:hover:bg-white/5'
                    }`}
                >
                  <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span>عرض الكل</span>
                </button>

                <button
                  onClick={() => setActiveTab('lectures')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'lectures'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-sky-100/60 dark:hover:bg-white/5'
                    }`}
                >
                  <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="hidden xs:inline">باب المحاضرات ({totalLessons})</span>
                  <span className="xs:hidden">المحاضرات ({totalLessons})</span>
                </button>

                <button
                  onClick={() => setActiveTab('files')}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 whitespace-nowrap ${activeTab === 'files'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-sky-100/60 dark:hover:bg-white/5'
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
                      const defaultTeacherId: TeacherId = selectedTeacher === 'teacher_2' ? 'teacher_2' : 'teacher_1';
                      setLessonFormData({
                        title: '',
                        description: '',
                        teacherId: defaultTeacherId,
                        teacherName: defaultTeacherId === 'teacher_2' ? 'مدرس 2' : 'مدرس 1',
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

                  {isEditor && (
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
                      className="px-3.5 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة ملف ➕</span>
                    </button>
                  )}
                </div>

                {/* بطاقة الملف الرئيسي البارزة (Hero File Card) أو بطاقة الحالة الفارغة */}
                {mainFile ? (
                  <div className="rounded-3xl tarqa-glass-hero p-6 sm:p-8 backdrop-blur-2xl shadow-[0_10px_35px_rgba(14,165,233,0.1)] dark:shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                      <div className="lg:col-span-8 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 rounded-full text-[11px] font-black bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            <span>الملف المعتمد الأساسي • نسخة 2025</span>
                          </span>
                          {mainFile.isFreePreview && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              معاينة مجانية 🎁
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

                      {/* أزرار تحميل ومعاينة الملف الرئيسي (متجاوبة للتابلت والكمبيوتر) */}
                      <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 justify-center">
                        {!currentUser ? (
                          mainFile.isFreePreview ? (
                            <button
                              onClick={() => handleFileAction(mainFile, true)}
                              className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                              <Lock className="w-4 h-4" />
                              <span>سجل حسابك لمعاينة الملف مجاناً 🎁</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleFileAction(mainFile, false)}
                              className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                            >
                              <Lock className="w-4 h-4" />
                              <span>تسجيل الدخول والاشتراك للتحميل 🔒</span>
                            </button>
                          )
                        ) : Boolean(mainFile.isFreePreview || subscriptionInfo.isSubscribed) ? (
                          <button
                            onClick={() => handleFileAction(mainFile, false)}
                            disabled={downloadingFileId === mainFile.id}
                            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-75"
                          >
                            {downloadingFileId === mainFile.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>جاري تشفير وتنزيل الملف على جهازك...</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                <span>تحميل الملف الكامل الآن على جهازك 📥</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={handleConfirmSubscription}
                            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                          >
                            <Sparkles className="w-4 h-4 text-slate-950" />
                            <span>اشترك لتحميل الملف الكامل 🚀</span>
                          </button>
                        )}

                        {!currentUser ? (
                          <button
                            onClick={() => handleFileAction(mainFile, true)}
                            className="w-full py-3 px-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Lock className="w-4 h-4 text-amber-500" />
                            <span>معاينة الملف (يلزم حساب) 👁️</span>
                          </button>
                        ) : Boolean(mainFile.isFreePreview || subscriptionInfo.isSubscribed) ? (
                          <button
                            onClick={() => handleFileAction(mainFile, true)}
                            className="w-full py-3 px-5 rounded-2xl bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Eye className="w-4 h-4 text-blue-500" />
                            <span>معاينة وتصفح الملف 👁️</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setDownloadToast('عفواً، معاينة هذا الملف متاحة للمشتركين فقط 🔒');
                              setPayingCourse(currentCourse);
                            }}
                            className="w-full py-3 px-5 rounded-2xl bg-slate-100/80 hover:bg-amber-500/10 dark:bg-slate-800/80 dark:hover:bg-amber-500/10 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 font-bold text-xs border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/40 transition flex items-center justify-center gap-2 cursor-pointer"
                            title="معاينة الملف متاحة للمشتركين فقط"
                          >
                            <Lock className="w-4 h-4 text-amber-500" />
                            <span>معاينة الملف (للمشتركين فقط 🔒)</span>
                          </button>
                        )}

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
                ) : (
                  <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#0c1324] border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto text-2xl">
                      📄
                    </div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      لم يتم إضافة أي مذكرات أو ملفات بعد
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      سيتم إتاحة المذكرات والملفات تلقائياً فور قيام الإدارة برفعها وتحديثها سحابياً.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                      {isEditor && (
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
                          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                        >
                          + إضافة مذكرة جديدة
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* باقي ملفات ومذكرات الدورة */}
                {currentCourseFiles.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {currentCourseFiles.slice(1).map((file) => {
                      const hasAccess = file.isFreePreview || subscriptionInfo.isSubscribed;
                      return (
                        <div
                          key={file.id}
                          className="p-5 rounded-3xl tarqa-glass-metric backdrop-blur-xl shadow-[0_4px_20px_rgba(14,165,233,0.06)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.6)] flex flex-col justify-between gap-4 hover:border-sky-300 dark:hover:border-amber-400/50 transition-all"
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
                            {hasAccess ? (
                              <button
                                type="button"
                                onClick={() => handleFileAction(file, false)}
                                disabled={downloadingFileId === file.id}
                                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 disabled:opacity-75"
                              >
                                {downloadingFileId === file.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>جاري التنزيل...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3.5 h-3.5" />
                                    <span>تحميل الملف</span>
                                  </>
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleConfirmSubscription}
                                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                              >
                                <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                                <span>اشترك الآن 🚀</span>
                              </button>
                            )}

                            {hasAccess ? (
                              <button
                                type="button"
                                onClick={() => handleFileAction(file, true)}
                                className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="معاينة وتصفح محتوى الملف"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-500" />
                                <span>معاينة</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!currentUser) {
                                    setDownloadToast('يرجى تسجيل حسابك أولاً للوصول إلى الملفات والمذكرات 🔒');
                                    onOpenAuth?.();
                                    return;
                                  }
                                  setDownloadToast('عفواً، معاينة هذا الملف متاحة للمشتركين فقط 🔒');
                                  setPayingCourse(currentCourse);
                                }}
                                className="px-3 py-2.5 rounded-xl bg-slate-100/70 hover:bg-amber-500/10 dark:bg-slate-800/50 dark:hover:bg-amber-500/10 text-slate-400 dark:text-slate-500 hover:text-amber-500 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                                title="معاينة هذا الملف تتطلب اشتراكاً"
                              >
                                <Lock className="w-3.5 h-3.5 text-amber-500" />
                                <span>مغلق 🔒</span>
                              </button>
                            )}

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
            {/* 4. باب المحاضرات (مع خياري مدرس 1 ومدرس 2) */}
            {/* ===================================================================== */}
            {(activeTab === 'all' || activeTab === 'lectures') && (
              <section className="space-y-6">
                {/* ================================================================= */}
                {/* شريط اختيار وإدارة الأبواب والفصول التدريبية (الأقسام) */}
                {/* ================================================================= */}
                <div className="bg-white/70 dark:bg-[#120e1d]/70 p-4 sm:p-5 rounded-3xl border border-sky-200/70 dark:border-amber-500/25 backdrop-blur-xl shadow-sm space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                          <span>أبواب وفصول الدورة التدريبية</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                            {currentCourseModules.length} أبواب 📚
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          اختر الباب أو الفصل الذي ترغب بمتابعة محاضراته وتمارينه
                        </p>
                      </div>
                    </div>

                    {isEditor && isEditMode && (
                      <button
                        onClick={handleOpenAddModule}
                        className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة باب جديد 📚</span>
                      </button>
                    )}
                  </div>

                  {/* قائمة كروت الأبواب والفصول */}
                  {currentCourseModules.length === 0 ? (
                    <div className="p-8 text-center bg-white/50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
                      <div className="text-3xl">📚</div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        لم يتم إضافة أبواب لهذه الدورة بعد
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        يمكن للمشرف أو المعلم الضغط على زر &quot;إضافة باب جديد&quot; أعلاه لبدء تنظيم المحتوى والمحاضرات.
                      </p>
                      {isEditor && (
                        <button
                          onClick={handleOpenAddModule}
                          className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                        >
                          + إضافة أول باب الآن
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                      {currentCourseModules.map((mod, modIdx) => {
                        const isCurrent = currentModule.id === mod.id;
                        const modLessonsCount = mod.lessons?.length || 0;
                        return (
                          <div
                            key={mod.id}
                            onClick={() => setSelectedModuleId(mod.id)}
                            className={`p-3.5 rounded-2xl cursor-pointer transition-all border text-right relative overflow-hidden flex flex-col justify-between gap-2.5 ${isCurrent
                                ? 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500 shadow-md ring-2 ring-amber-500/30'
                                : 'bg-white/60 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5'
                              }`}
                          >
                            {isCurrent && (
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />
                            )}

                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${isCurrent
                                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                  }`}>
                                  {modIdx + 1}
                                </span>
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                  {mod.title}
                                </h4>
                              </div>

                              <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                {modLessonsCount} محاضرة
                              </span>
                            </div>

                            {mod.description && (
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 leading-relaxed">
                                {mod.description}
                              </p>
                            )}

                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[10px]">
                              <span className={`font-bold ${isCurrent ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                {isCurrent ? '✓ الباب المختار حالياً' : 'اضغط للمشاهدة'}
                              </span>

                              {isEditor && isEditMode && (
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={() => handleReorderModule(mod.id, 'up')}
                                    disabled={modIdx === 0}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500 disabled:opacity-30 cursor-pointer"
                                    title="تقديم الباب"
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => handleReorderModule(mod.id, 'down')}
                                    disabled={modIdx === currentCourseModules.length - 1}
                                    className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-amber-500 disabled:opacity-30 cursor-pointer"
                                    title="تأخير الباب"
                                  >
                                    ↓
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditModule(mod)}
                                    className="p-1 rounded bg-slate-100 hover:bg-purple-100 dark:bg-slate-800 text-slate-500 hover:text-purple-600 cursor-pointer"
                                    title="تعديل تفاصيل الباب"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                  </button>
                                  {currentCourseModules.length > 1 && (
                                    <button
                                      onClick={() => handleDeleteModule(mod.id, mod.title)}
                                      className="p-1 rounded bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 text-slate-500 hover:text-rose-600 cursor-pointer"
                                      title="حذف هذا الباب"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* تفاصيل الباب المختار وأزرار الإجراءات */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <Video className="w-6 h-6 text-amber-500" />
                        <span>{currentModule.title || 'المحاضرات'} 🎥</span>
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {instructors.length} خيارات للشرح 👨‍🏫
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {currentModule.description || 'اختر المعلم المناسب لأسلوب فهمك، أو تنقل بين شروحات المعلمين بحرية كاملة'}
                    </p>
                  </div>

                  {isEditor && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditMode && (
                        <>
                          <button
                            onClick={() => handleOpenEditModule(currentModule)}
                            className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تعديل هذا الباب</span>
                          </button>

                          <button
                            onClick={handleOpenAddTeacher}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة مدرس 👨‍🏫</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => {
                          setEditingLesson(null);
                          setUploadedVideoInfo(null);
                          setVideoUploadError(null);
                          setLessonFormData({
                            title: '',
                            description: '',
                            teacherId: selectedTeacher,
                            teacherName: currentTeacherObj.fullName || currentTeacherObj.name || 'مدرس',
                            videoUrl: '',
                            videoProvider: 'uploaded_video',
                            durationMinutes: 15,
                            isFreePreview: false,
                            pdfTitle: '',
                            pdfUrl: '',
                          });
                          setLessonModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-600 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>إضافة محاضرة ➕</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* بطاقات اختيار المعلمين الديناميكية (Dynamic Teachers Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {instructors.map((teacher, idx) => {
                    const teacherLessons = allLessons.filter((l) => (l.teacherId || instructors[0]?.id) === teacher.id);
                    const isSelected = selectedTeacher === teacher.id;
                    const teacherHours = Math.round(teacherLessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60);
                    const teacherFreeCount = teacherLessons.filter((l) => l.isFreePreview).length;

                    return (
                      <div
                        key={teacher.id}
                        onClick={() => setSelectedTeacher(teacher.id)}
                        className={`p-5 rounded-3xl cursor-pointer transition-all duration-300 relative overflow-hidden border flex flex-col justify-between ${isSelected
                            ? 'bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500 shadow-[0_8px_30px_rgba(245,158,11,0.18)] ring-2 ring-amber-500/40'
                            : 'bg-white/80 dark:bg-[#120e1d]/70 border-slate-200 dark:border-slate-800 hover:border-amber-500/40 hover:bg-amber-500/5 shadow-sm'
                          }`}
                      >
                        {isSelected && (
                          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400" />
                        )}

                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                                {teacher.avatarIcon || '👨‍🏫'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                                    {teacher.fullName || teacher.name}
                                  </h3>
                                  {isSelected && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 flex items-center gap-1 shadow-sm">
                                      <Check className="w-3 h-3 stroke-[3]" />
                                      <span>المسار المحدد</span>
                                    </span>
                                  )}
                                  {isEditor && isEditMode && (
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditTeacher(teacher)}
                                        className="p-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-slate-950 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition cursor-pointer"
                                        title={`تعديل بيانات (${teacher.name})`}
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </button>
                                      {instructors.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteTeacher(teacher.id, teacher.name)}
                                          className="p-1 rounded-lg bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 border border-rose-500/20 transition cursor-pointer"
                                          title={`حذف (${teacher.name})`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                                  {teacher.title || 'خبير التأسيس والقدرات'}
                                </p>
                              </div>
                            </div>

                            <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                              {teacherLessons.length} محاضرات
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                            {teacher.tagline || 'شرح تأصيلي مبسط يربط المفاهيم بالخرائط الذهنية وتكتيكات الحل الخاطف.'}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-4 mt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                          <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-[11px] font-bold">
                            <span>⏱️ {teacherHours} ساعة</span>
                            <span>•</span>
                            <span className="text-emerald-600 dark:text-emerald-400">
                              🎁 {teacherFreeCount} مجانية
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTeacher(teacher.id);
                              const tLessons = allLessons.filter((l) => (l.teacherId || instructors[0]?.id) === teacher.id);
                              const firstPlayable = tLessons.find((l) => l.isFreePreview) || tLessons[0];
                              if (firstPlayable) {
                                if (currentUser || firstPlayable.isFreePreview) {
                                  handleLessonClick(firstPlayable);
                                } else {
                                  setDownloadToast('يرجى تسجيل حسابك أولاً للوصول إلى المحاضرة 🔒');
                                  onOpenAuth?.();
                                }
                              }
                            }}
                            className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 cursor-pointer ${isSelected
                                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-500 hover:text-slate-950'
                              }`}
                          >
                            <span>{isSelected ? `تشغيل محاضرات ${teacher.name}` : `اختيار ${teacher.name}`}</span>
                            <Play className="w-3 h-3 fill-current" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {/* بطاقة إضافة مدرس جديد للمعلم/المشرف في وضع التعديل */}
                  {isEditor && isEditMode && (
                    <div
                      onClick={handleOpenAddTeacher}
                      className="p-5 rounded-3xl border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition flex flex-col items-center justify-center gap-2 text-center min-h-[170px]"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shadow-sm">
                        👨‍🏫
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          + إضافة مدرس جديد للمنصة
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          أضف معلماً جديداً باسمه ولقبه وأسلوب شرحه لتخصيص مسار خاص به
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* شريط الفلترة السريع والمصغر للمدرسين */}
                <div className="flex items-center justify-between flex-wrap gap-3 bg-white/60 dark:bg-[#120e1d]/60 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
                    <span className="text-xs font-bold text-slate-500 px-2 shrink-0">عرض محاضرات:</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTeacher('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${selectedTeacher === 'all'
                          ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-amber-500/10'
                        }`}
                    >
                      <span>✨ جميع المدرسين ({allLessons.length})</span>
                    </button>
                    {instructors.map((teacher) => {
                      const tLessons = allLessons.filter((l) => (l.teacherId || instructors[0]?.id) === teacher.id);
                      const isSel = selectedTeacher === teacher.id;
                      return (
                        <button
                          key={teacher.id}
                          onClick={() => setSelectedTeacher(teacher.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${isSel
                              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-amber-500/10'
                            }`}
                        >
                          <span>{teacher.avatarIcon || '👨‍🏫'} {teacher.name} ({tLessons.length})</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-xs text-slate-500 font-bold px-2">
                    عرض محاضرات ({currentTeacherObj.fullName || currentTeacherObj.name}) في باب [{currentModule.title}] ({displayedLessons.length} محاضرة)
                  </div>
                </div>

                {/* قائمة المحاضرات داخل باب المحاضرات */}
                <div className="rounded-3xl tarqa-glass-card backdrop-blur-2xl shadow-[0_8px_30px_rgba(14,165,233,0.08)] dark:shadow-[0_8px_30px_rgba(0,0,0,0.7),0_0_20px_rgba(245,158,11,0.1)] overflow-hidden p-4 sm:p-6 space-y-3">

                  {displayedLessons.length === 0 ? (
                    <div className="py-12 text-center space-y-3">
                      <Video className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                      <h4 className="text-sm font-black text-slate-700 dark:text-slate-200">
                        لا توجد محاضرات مضافة لهذا المسار حالياً
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        {isEditor
                          ? 'يمكنك إضافة محاضراتك وشروحاتك المسجلة بالضغط على زر الإضافة أدناه.'
                          : 'سيقوم المعلم برفع ونشر المحاضرات هنا قريباً بإذن الله ✨'}
                      </p>
                      {isEditor && (
                        <button
                          onClick={() => {
                            setEditingLesson(null);
                            setUploadedVideoInfo(null);
                            setVideoUploadError(null);
                            setLessonFormData({
                              title: '',
                              description: '',
                              teacherId: selectedTeacher,
                              teacherName: currentTeacherObj.fullName || currentTeacherObj.name || 'مدرس',
                              videoUrl: '',
                              videoProvider: 'uploaded_video',
                              durationMinutes: 15,
                              isFreePreview: false,
                              pdfTitle: '',
                              pdfUrl: '',
                            });
                            setLessonModalOpen(true);
                          }}
                          className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition shadow-md inline-flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة أول محاضرة الآن ➕</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    displayedLessons.map((lesson, lesIdx) => {
                      const hasAccess = canAccessLesson(lesson, currentUser);
                      const tId = lesson.teacherId || instructors[0]?.id || 'teacher_1';
                      const lesTeacher = instructors.find((i) => i.id === tId) || instructors[0];

                      return (
                        <div
                          key={lesson.id}
                          className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${hasAccess
                              ? 'bg-amber-50/50 dark:bg-[#191326]/70 border-sky-200/80 dark:border-amber-500/20 hover:bg-white dark:hover:bg-[#201733]/90 hover:border-sky-400 dark:hover:border-amber-400/50 shadow-sm'
                              : 'bg-slate-100/60 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/40 opacity-85'
                            }`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div
                              onClick={() => handleLessonClick(lesson)}
                              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition ${hasAccess
                                  ? 'bg-amber-500/15 text-amber-500 hover:bg-amber-500 hover:text-slate-950 border border-amber-500/30'
                                  : lesson.isFreePreview
                                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 border border-emerald-500/30'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 border border-slate-300 dark:border-slate-700'
                                }`}
                              title={
                                hasAccess
                                  ? 'مشاهدة المحاضرة الآن'
                                  : lesson.isFreePreview
                                    ? 'معاينة مجانية (يلزم تسجيل حساب مجاني)'
                                    : 'مخصص للمشتركين فقط (يتطلب اشتراك نشط)'
                              }
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

                                {/* شارة المدرس الديناميكية */}
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                  <span>{lesTeacher?.avatarIcon || '👨‍🏫'}</span>
                                  <span>{lesTeacher?.fullName || lesTeacher?.name || lesson.teacherName || 'مدرس'}</span>
                                </span>

                                {lesson.isFreePreview ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                    معاينة مجانية {!currentUser ? '(يلزم حساب)' : ''} 🎁
                                  </span>
                                ) : hasAccess ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    متاح بالاشتراك ✅
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                                    <Lock className="w-2.5 h-2.5 text-amber-500" />
                                    <span>يتطلب اشتراك 🔒</span>
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
                                  className={`p-2 rounded-xl text-xs transition cursor-pointer ${lesson.isFreePreview
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
                                      teacherId: (lesson.teacherId || instructors[0]?.id || 'teacher_1') as TeacherId,
                                      teacherName: lesson.teacherName || lesTeacher?.fullName || lesTeacher?.name || 'مدرس',
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

                            {/* زر تشغيل المحاضرة أو زر الاشتراك أو تسجيل الحساب للزائر */}
                            {!currentUser ? (
                              lesson.isFreePreview ? (
                                <button
                                  onClick={() => handleLessonClick(lesson)}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-600 dark:text-emerald-400 hover:text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm border border-emerald-500/30 hover:border-emerald-500 active:scale-95"
                                  title="معاينة مجانية - يلزم إنشاء حساب مجاني لمشاهدتها فوراً"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>معاينة مجانية (يلزم حساب) 🎁</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleLessonClick(lesson)}
                                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-amber-500 dark:bg-slate-800 dark:hover:bg-amber-500 text-slate-700 hover:text-slate-950 dark:text-slate-300 dark:hover:text-slate-950 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm border border-slate-300 dark:border-slate-700 hover:border-amber-500 active:scale-95"
                                  title="هذه المحاضرة مخصصة للمشتركين فقط 🔒"
                                >
                                  <Lock className="w-3.5 h-3.5 text-amber-500" />
                                  <span>مخصص للمشتركين 🔒</span>
                                </button>
                              )
                            ) : hasAccess ? (
                              <button
                                onClick={() => handleLessonClick(lesson)}
                                className={`px-4 py-2 rounded-xl font-black text-xs transition flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 ${lesTeacher?.badgeColor === 'emerald'
                                    ? 'bg-emerald-500 hover:bg-emerald-600 text-slate-950'
                                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                                  }`}
                                title={lesson.isFreePreview ? 'مشاهدة المعاينة المجانية' : 'مشاهدة المحاضرة الآن'}
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>{lesson.isFreePreview ? 'مشاهدة المعاينة 🎁' : 'مشاهدة الآن ▶️'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleLessonClick(lesson)}
                                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
                                title="اشترك في منصة طرقع للوصول الفوري لهذه المحاضرة"
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-950" />
                                <span>اشترك للمشاهدة 🚀</span>
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
        </>
      )}

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
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">رسوم الاشتراك المعتمدة:</span>
                <div className="text-left font-mono">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {currentCourse?.priceSar ?? ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س
                  </div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                    أو {currentCourse?.priceEg ?? getKashierSettings().amount ?? ANNUAL_SUBSCRIPTION_PRICE_EGP} جنيه مصري / سنوياً
                  </div>
                </div>
              </div>

              {subscribeSuccessMessage ? (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>{subscribeSuccessMessage}</span>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-right space-y-2">
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>الدفع الإلكتروني الآمن المباشر عبر بوابة كاشير (Kashier)</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      مدى، فيزا، ماستركارد، فوري، ميزة، أو المحافظ الإلكترونية. تفعيل فوري للاشتراك بعد إتمام العملية.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirmSubscription}
                    disabled={isSubscribing}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/30 flex items-center justify-center gap-2 cursor-pointer select-none transition-all active:scale-[0.98] disabled:opacity-70"
                  >
                    {isSubscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري التجهيز...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950 shrink-0" />
                        <span>متابعة الدفع والاشتراك الآن 💳 ({ANNUAL_SUBSCRIPTION_PRICE_SAR} ر.س)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSubscribeModal(false)}
                    className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* نافذة الدفع المستقل للدورة مع كود الخصم والإيصالات الفورية */}
      {payingCourse && (
        <CoursePaymentModal
          isOpen={!!payingCourse}
          onClose={() => setPayingCourse(null)}
          course={payingCourse}
          currentUser={currentUser || null}
          onOpenAuth={onOpenAuth}
          onOpenPolicies={onOpenPolicies}
          onSuccess={(receipt) => {
            setSubscriptionInfo(getSubscriptionDetails(currentUser));
            setSubscribeSuccessMessage(`تم تفعيل اشتراكك في (${receipt.course_title}) بنجاح! 🎉`);
            setTimeout(() => setSubscribeSuccessMessage(null), 4000);
          }}
        />
      )}

      {/* لوحة تحكم الأدمن: إدارة الأسعار في الداتابيز والكوبونات وسجل الإيصالات */}
      {isCommerceAdminOpen && (
        <CoursePricingAndPromoAdminModal
          isOpen={isCommerceAdminOpen}
          onClose={() => setIsCommerceAdminOpen(false)}
          courses={courses}
        />
      )}

      {/* نافذة الدفع المدمجة عبر بوابة كاشير (Kashier Checkout Modal) */}
      <KashierCheckoutModal
        isOpen={isKashierCheckoutOpen}
        onClose={() => setIsKashierCheckoutOpen(false)}
        currentUser={currentUser || null}
        onPaymentSuccess={handleKashierPaymentSuccess}
        customAmount={payingCourse?.priceEg ?? currentCourse?.priceEg ?? getKashierSettings().amount ?? 1100}
        customPriceEg={payingCourse?.priceEg ?? currentCourse?.priceEg ?? getKashierSettings().amount ?? 1100}
        customPriceSar={payingCourse?.priceSar ?? currentCourse?.priceSar ?? 75}
        customCurrency="EGP"
        onOpenPolicies={onOpenPolicies}
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
              {/* اختيار المعلم المشرف على المحاضرة */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    المعلم المشرف على المحاضرة *
                  </label>
                  {isEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setLessonModalOpen(false);
                        handleOpenAddTeacher();
                      }}
                      className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ إضافة مدرس جديد</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1 border border-slate-100 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50">
                  {instructors.map((teacher) => {
                    const isSelected = (lessonFormData.teacherId || instructors[0]?.id) === teacher.id;
                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() =>
                          setLessonFormData({
                            ...lessonFormData,
                            teacherId: teacher.id,
                            teacherName: teacher.fullName || teacher.name,
                          })
                        }
                        className={`p-2.5 rounded-xl border text-right transition flex items-center gap-2.5 cursor-pointer ${isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-black shadow-sm ring-1 ring-amber-500/40'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-amber-500/30'
                          }`}
                      >
                        <span className="text-xl shrink-0">{teacher.avatarIcon || '👨‍🏫'}</span>
                        <div className="min-w-0 truncate">
                          <div className="text-xs font-black truncate">{teacher.fullName || teacher.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{teacher.title || 'معلم خبير'}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                    placeholder="https://... أو ارفع الملف من الزر أعلاه"
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
      {/* 8. نافذة إضافة / تعديل بيانات باب المحاضرات */}
      {/* ======================================================================= */}
      {moduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1424] border border-amber-500/30 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Video className="w-5 h-5 text-amber-500" />
                <span>{editingModule ? 'تعديل تفاصيل الباب التدريبي' : 'إضافة باب جديد للدورة التدريبية 📚'}</span>
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
                  اسم أو عنوان الباب *
                </label>
                <input
                  type="text"
                  required
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  placeholder="مثال: الباب الثاني: الجبر والمعادلات"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
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
                  placeholder="وصف مختصر لموضوعات هذا الباب وأهدافه التعليمية..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* قسم التحكم في حالة التسجيل والاشتراك بالدورة */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                <span className="text-xs font-black text-amber-700 dark:text-amber-300 block">
                  ⚙️ إعدادات حالة التسجيل والاشتراك (Enrollment Status):
                </span>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة الدورة والزر للمستخدمين:
                  </label>
                  <select
                    value={moduleFormData.status}
                    onChange={(e) => setModuleFormData({ ...moduleFormData, status: e.target.value as CourseEnrollmentStatus })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                  >
                    <option value="active">🟢 متاح للتسجيل والاشتراك فوراً (Active)</option>
                    <option value="paused">⏸️ التسجيل مغلق مؤقتاً / قريباً (Paused)</option>
                    <option value="upcoming">⏳ قادمة قريباً (Upcoming)</option>
                  </select>
                </div>

                {moduleFormData.status !== 'active' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        نص الزر والحالة المخصص:
                      </label>
                      <input
                        type="text"
                        value={moduleFormData.customStatusText}
                        onChange={(e) => setModuleFormData({ ...moduleFormData, customStatusText: e.target.value })}
                        placeholder="مثال: قريباً ⏳ أو مغلق مؤقتاً للتحديث"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        موعد فتح التسجيل المتوقع (اختياري):
                      </label>
                      <input
                        type="text"
                        value={moduleFormData.availableDate}
                        onChange={(e) => setModuleFormData({ ...moduleFormData, availableDate: e.target.value })}
                        placeholder="مثال: 15 أكتوبر 2026 أو قريباً"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {editingModule ? 'حفظ التعديلات' : 'إضافة الباب الآن 📚'}
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

      {/* نافذة إضافة / تعديل اسم وبيانات المدرس */}
      {teacherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#151022] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-lg font-black">
                  {teacherFormData.avatarIcon || '👨‍🏫'}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {editingTeacher ? 'تعديل بيانات واسم المدرس' : 'إضافة مدرس جديد للمنصة 👨‍🏫'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editingTeacher ? `تعديل بيانات (${teacherFormData.name}) ومسار شرحه` : 'أدخل بيانات المدرس الجديد وتخصصه لإنشاء مسار تدريبي له'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTeacherModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacher} className="space-y-3.5 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المدرس المختصر (يظهر في الأزرار والفلترة) *:
                </label>
                <input
                  type="text"
                  required
                  value={teacherFormData.name}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, name: e.target.value })}
                  placeholder="مثال: أ. أحمد أو مدرس 1"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الاسم الكامل واللقب (يظهر كعنوان بالبطاقة):
                </label>
                <input
                  type="text"
                  value={teacherFormData.fullName || ''}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, fullName: e.target.value })}
                  placeholder="مثال: أستاذ أحمد المنصور"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المسمى / التخصص:
                  </label>
                  <input
                    type="text"
                    value={teacherFormData.title || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, title: e.target.value })}
                    placeholder="مثال: خبير التأسيس الذهني والخرائط المعرفية"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الأيقونة (إيموجي):
                  </label>
                  <input
                    type="text"
                    value={teacherFormData.avatarIcon || ''}
                    onChange={(e) => setTeacherFormData({ ...teacherFormData, avatarIcon: e.target.value })}
                    placeholder="👨‍🏫 أو ⚡"
                    className="w-full px-3.5 py-2 text-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-bold"
                  />
                  <div className="flex items-center justify-center gap-1 pt-1.5 flex-wrap">
                    {['👨‍🏫', '👩‍🏫', '⚡', '🧠', '🎯', '💡', '🌟', '🚀', '👑'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setTeacherFormData({ ...teacherFormData, avatarIcon: emoji })}
                        className="w-6 h-6 rounded text-xs hover:bg-amber-500/20 cursor-pointer"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نبذة ووصف مسار الشرح:
                </label>
                <textarea
                  rows={2}
                  value={teacherFormData.tagline || ''}
                  onChange={(e) => setTeacherFormData({ ...teacherFormData, tagline: e.target.value })}
                  placeholder="نبذة عن طريقة شرح المدرس في هذا المسار..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition cursor-pointer"
                >
                  {editingTeacher ? 'حفظ تعديلات المدرس 💾' : 'إضافة المدرس للمنصة 👨‍🏫🎉'}
                </button>
                <button
                  type="button"
                  onClick={() => setTeacherModalOpen(false)}
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
      {/* 9. نافذة معاينة وتصفح ملفات PDF التفاعلية للطلاب */}
      {/* ======================================================================= */}
      <PdfPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => {
          setIsPreviewModalOpen(false);
          setPreviewFile(null);
        }}
        file={previewFile}
        currentUser={currentUser}
        isSubscribed={subscriptionInfo.isSubscribed || courseCommerceService.isUserSubscribedToCourse(currentUser, currentCourse.id)}
        onSubscribeClick={() => setPayingCourse(currentCourse)}
        onDownloadClick={(fileToDownload) => {
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
      {/* إشعار عائم وشريط حفظ الملف المباشر على الجهاز */}
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
                إذا لم يبدأ التنزيل تلقائياً، اضغط على الزر لحفظه مباشرة على جهازك:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <a
              href={downloadNotice.url}
              download={downloadNotice.fileName}
              onClick={() => {
                setDownloadToast('جاري حفظ وتنزيل الملف على جهازك ✅');
                setTimeout(() => setDownloadToast(null), 3000);
              }}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>حفظ الملف على الجهاز 💾</span>
            </a>
            <a
              href={downloadNotice.url}
              {...(downloadNotice.url.startsWith('blob:') ? {} : { target: '_blank', rel: 'noopener' })}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="فتح وتصفح الملف"
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

      {downloadToast && !downloadNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900 text-white text-xs sm:text-sm font-bold shadow-2xl border border-amber-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{downloadToast}</span>
        </div>
      )}

      {/* نافذة مشتركي الدورات التدريبية المخصصة */}
      {subscribersModalCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-6xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-4 sm:p-6">
            <button
              onClick={() => setSubscribersModalCourseId(null)}
              className="absolute top-4 left-4 p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer z-10"
              title="إغلاق النافذة"
            >
              <X className="w-5 h-5" />
            </button>
            <CourseSubscribersDashboard
              initialCourseId={subscribersModalCourseId === 'all' ? undefined : subscribersModalCourseId}
              onBack={() => setSubscribersModalCourseId(null)}
            />
          </div>
        </div>
      )}

      {/* مودال إشعار الدورة المغلقة / قيد التجهيز */}
      {lockedCourseNotice && (
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="bg-[#0b101e] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col items-center gap-5 shadow-2xl shadow-amber-500/20 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-3xl">
              ⏳
            </div>
            <div className="space-y-2.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                <Lock className="w-3.5 h-3.5" />
                <span>{getCourseEnrollmentInfo(lockedCourseNotice).badgeText || 'الدورة قادمة قريباً'}</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                {lockedCourseNotice.title}
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                {getCourseEnrollmentInfo(lockedCourseNotice).notice || 'نقوم حالياً بتجهيز وإعداد هذه الدورة التعليمية بأعلى معايير قياس. سيتوفر التسجيل والمحاضرات فور الانطلاق قريباً بإذن الله!'}
              </p>
              {lockedCourseNotice.availableDate && (
                <div className="mt-2 py-2 px-3 rounded-xl bg-slate-900 border border-amber-500/20 text-xs font-bold text-amber-400">
                  📅 موعد الإتاحة المتوقع: {lockedCourseNotice.availableDate}
                </div>
              )}
            </div>
            <button
              onClick={() => setLockedCourseNotice(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              حسناً، فهمت ✨
            </button>
          </div>
        </div>
      )}

      {/* نافذة إضافة وتعديل الدورات التدريبية للمشرف والمعلم */}
      {renderCourseModal()}
    </div>
  );
};
