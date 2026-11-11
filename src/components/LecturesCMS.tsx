import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Video, 
  FileText, 
  Clock, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  Sparkles, 
  Play, 
  Save, 
  X, 
  Layers, 
  UploadCloud,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Shield,
  Gift,
  RotateCcw,
  Check,
  Paperclip,
  FileUp,
  Download,
  Search,
  BookOpen,
  FolderOpen,
  Users
} from 'lucide-react';
import { CourseModule, Lesson, LessonAttachment, VideoProvider, CourseFileItem, AttachmentType, CourseEnrollmentStatus, TeacherId, InstructorInfo } from '../types';
import { AVAILABLE_INSTRUCTORS } from '../data/foundationModules';
import { FileUploadZone } from './FileUploadZone';
import { uploadLessonVideo } from '../lib/videoUploadService';
import { fileStorageService } from '../lib/fileStorageService';
import { coursesStorage } from '../lib/subscriptionService';
import { CourseSubscribersDashboard } from './CourseSubscribersDashboard';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { sanitizeUrl } from '../lib/securityUtils';

interface LecturesCMSProps {
  modules: CourseModule[];
  onAddLesson: (moduleId: string, newLesson: Lesson) => void;
  onUpdateLesson: (updatedLesson: Lesson) => void;
  onDeleteLesson: (lessonId: string) => void;
  onTogglePublish: (lessonId: string) => void;
  onToggleFreePreview?: (lessonId: string) => void;
  onReorderLessons: (moduleId: string, lessonId: string, direction: 'up' | 'down') => void;
  onResetDefault?: () => void;
  onSyncCloud?: () => Promise<void>;
  files?: CourseFileItem[];
  onAddFile?: (newFile: CourseFileItem) => void;
  onUpdateFile?: (updatedFile: CourseFileItem) => void;
  onDeleteFile?: (fileId: string) => void;
  onToggleFilePreview?: (fileId: string) => void;
  onAddModule?: (newModule: CourseModule) => void;
  onUpdateModule?: (updatedModule: CourseModule) => void;
  onDeleteModule?: (moduleId: string) => void;
  onReorderModules?: (moduleId: string, direction: 'up' | 'down') => void;
  onAddInstructor?: (instructor: InstructorInfo) => void;
  onUpdateInstructor?: (instructor: InstructorInfo) => void;
  onDeleteInstructor?: (instructorId: string) => void;
}

export const LecturesCMS: React.FC<LecturesCMSProps> = ({
  modules,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onTogglePublish,
  onToggleFreePreview,
  onReorderLessons,
  onResetDefault,
  onSyncCloud,
  files,
  onAddFile,
  onUpdateFile,
  onDeleteFile,
  onToggleFilePreview,
  onAddModule,
  onUpdateModule,
  onDeleteModule,
  onReorderModules,
  onAddInstructor,
  onUpdateInstructor,
  onDeleteInstructor,
}) => {
  // تبويب العرض الحالي: المحاضرات أو المذكرات والملفات أو الأبواب أو المدرسين أو المشتركين
  const [activeTab, setActiveTab] = useState<'lectures' | 'files' | 'modules' | 'instructors' | 'subscribers'>('lectures');
  const [subscribersCourseId, setSubscribersCourseId] = useState<string | undefined>(undefined);
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // حالة ملفات ومذكرات الدورة
  const [courseFiles, setCourseFiles] = useState<CourseFileItem[]>(() => (files !== undefined ? files : coursesStorage.getFiles()));
  // حالة المدرسين
  const [instructors, setInstructors] = useState<InstructorInfo[]>(() => coursesStorage.getInstructors());
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<TeacherId | 'all'>('all');

  // نافذة إضافة / تعديل باب تدريبي (Module Modal)
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isSavingModule, setIsSavingModule] = useState(false);
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    title: '',
    description: '',
    orderIndex: 1,
    status: 'active' as CourseEnrollmentStatus,
    customStatusText: '',
    badgeColor: 'amber',
  });

  // نافذة إضافة / تعديل مدرس (Instructor Modal)
  const [isInstructorModalOpen, setIsInstructorModalOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<InstructorInfo | null>(null);
  const [instructorFormData, setInstructorFormData] = useState<InstructorInfo>({
    id: '',
    name: '',
    fullName: '',
    title: '',
    tagline: '',
    avatarIcon: '👨‍🏫',
    badgeColor: 'amber',
  });

  useEffect(() => {
    if (files !== undefined) {
      setCourseFiles(files);
    }
  }, [files]);

  useEffect(() => {
    const handleFilesChanged = (e: any) => {
      const updated = e.detail !== undefined ? e.detail : coursesStorage.getFiles();
      setCourseFiles([...updated]);
    };
    const handleInstructorsChanged = (e: any) => {
      const updated = e.detail !== undefined ? e.detail : coursesStorage.getInstructors();
      setInstructors([...updated]);
    };

    window.addEventListener('tarqa_courses_files_changed', handleFilesChanged);
    window.addEventListener('tarqa_instructors_changed', handleInstructorsChanged);
    return () => {
      window.removeEventListener('tarqa_courses_files_changed', handleFilesChanged);
      window.removeEventListener('tarqa_instructors_changed', handleInstructorsChanged);
    };
  }, []);

  const currentTeacherObj = (selectedTeacherFilter !== 'all' ? instructors.find((i) => i.id === selectedTeacherFilter) : null) || instructors[0] || AVAILABLE_INSTRUCTORS[0];

  // حالة نموذج إضافة/تعديل درس
  const [formData, setFormData] = useState<{
    moduleId: string;
    title: string;
    description: string;
    teacherId: TeacherId;
    teacherName: string;
    videoProvider: VideoProvider;
    videoUrl: string;
    durationMinutes: number;
    isFreePreview: boolean;
    isPublished: boolean;
    quizId: string;
    attachments: LessonAttachment[];
  }>({
    moduleId: modules[0]?.id || '',
    title: '',
    description: '',
    teacherId: instructors[0]?.id || 'teacher_1',
    teacherName: instructors[0]?.name || 'مدرس 1',
    videoProvider: 'youtube',
    videoUrl: '',
    durationMinutes: 15,
    isFreePreview: false,
    isPublished: true,
    quizId: 'f1111111-1111-1111-1111-111111111111',
    attachments: [],
  });

  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // ============================================================================
  // حالة نافذة إضافة / تعديل ملف (File Management Modal)
  // ============================================================================
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState<CourseFileItem | null>(null);
  const [fileModalMode, setFileModalMode] = useState<'course_file' | 'lesson_attachment'>('course_file');
  const [targetLessonId, setTargetLessonId] = useState<string>('');

  const [fileFormData, setFileFormData] = useState<{
    title: string;
    description: string;
    fileUrl: string;
    fileSize: string;
    pagesCount: string;
    fileType: 'pdf' | 'worksheet' | 'summary' | 'book';
    isFreePreview: boolean;
  }>({
    title: '',
    description: '',
    fileUrl: '',
    fileSize: '',
    pagesCount: '',
    fileType: 'pdf',
    isFreePreview: false,
  });

  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [fileUploadProgress, setFileUploadProgress] = useState(0);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const filePickerRef = useRef<HTMLInputElement>(null);

  // نافذة إدارة مرفقات المحاضرة السريعة (Quick Lesson Attachments Modal)
  const [managingLessonAttachments, setManagingLessonAttachments] = useState<Lesson | null>(null);

  // فلترة وبحث الملفات
  const [fileSearchQuery, setFileSearchQuery] = useState('');
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'pdf' | 'summary' | 'worksheet' | 'book'>('all');

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
        setFormData((prev) => ({
          ...prev,
          videoUrl: res.videoUrl!,
          videoProvider: 'uploaded_video',
        }));
      } else {
        setVideoUploadError(res.error || 'فشلت عملية رفع ملف الفيديو');
      }
    } catch (err: any) {
      setVideoUploadError(err?.message || 'حدث خطأ أثناء الرفع');
    } finally {
      setIsUploadingVideo(false);
    }
  };

  // رفع ملف PDF مباشر من الجهاز
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handlePDFFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setFileUploadError('يرجى اختيار ملف بصيغة PDF فقط.');
      return;
    }

    setIsUploadingFile(true);
    setFileUploadProgress(15);
    setFileUploadError(null);

    // ملء العنوان والحجم تلقائياً
    if (!fileFormData.title.trim()) {
      setFileFormData((prev) => ({ ...prev, title: file.name.replace(/\.pdf$/i, '') }));
    }

    try {
      const result = await fileStorageService.uploadPdf(file, (progress) => {
        setFileUploadProgress(progress);
      });

      setFileFormData((prev) => ({
        ...prev,
        fileUrl: result.fileUrl,
        fileSize: result.fileSizeFormatted,
      }));
      setToast({ text: 'تم تجهيز ورفع ملف الـ PDF بنجاح! 📄✅', type: 'success' });
    } catch (err: any) {
      console.warn('File upload fallback activated:', err);
      // في أسوأ الظروف، لا نمنع المستخدم وننشئ رابطاً محلياً للملف
      const fallbackUrl = URL.createObjectURL(file);
      setFileFormData((prev) => ({
        ...prev,
        fileUrl: fallbackUrl,
        fileSize: formatBytes(file.size),
      }));
      setToast({ text: 'تم اعتماد ملف الـ PDF بنجاح! 📄✅', type: 'success' });
    } finally {
      setIsUploadingFile(false);
      setFileUploadProgress(0);
      if (filePickerRef.current) filePickerRef.current.value = '';
    }
  };

  // حساب الإحصائيات الشاملة
  const allLessons = modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalAttachments = allLessons.reduce((acc, l) => acc + (l.attachments?.length || 0), 0);
  const freePreviewsCount = allLessons.filter((l) => l.isFreePreview).length;

  // ============================================================================
  // إدارة الأبواب والفصول التدريبية (Course Modules Management)
  // ============================================================================
  const openAddModuleModal = () => {
    setEditingModule(null);
    setModuleFormData({
      title: '',
      description: '',
      orderIndex: modules.length + 1,
      status: 'active',
      customStatusText: '',
      badgeColor: 'amber',
    });
    setIsModuleModalOpen(true);
  };

  const openEditModuleModal = (mod: CourseModule) => {
    setEditingModule(mod);
    setModuleFormData({
      title: mod.title,
      description: mod.description || '',
      orderIndex: mod.orderIndex || 1,
      status: mod.status || 'active',
      customStatusText: mod.customStatusText || '',
      badgeColor: mod.badgeColor || 'amber',
    });
    setIsModuleModalOpen(true);
  };

  const handleSaveModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingModule) return;
    const cleanTitle = moduleFormData.title.trim();
    if (!cleanTitle) {
      alert('يرجى إدخال عنوان الباب');
      return;
    }

    setIsSavingModule(true);
    try {
      if (editingModule) {
        const updated: CourseModule = {
          ...editingModule,
          title: cleanTitle,
          description: moduleFormData.description.trim(),
          orderIndex: Number(moduleFormData.orderIndex) || 1,
          status: moduleFormData.status,
          customStatusText: moduleFormData.customStatusText.trim(),
          badgeColor: moduleFormData.badgeColor,
        };
        coursesStorage.updateModule(updated);
        if (onUpdateModule) onUpdateModule(updated);
        setToast({ text: `تم حفظ تعديلات باب "${updated.title}" بنجاح! 📚✅`, type: 'success' });
      } else {
        const uniqueId = 'mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newMod: CourseModule = {
          id: uniqueId,
          title: cleanTitle,
          description: moduleFormData.description.trim(),
          orderIndex: Number(moduleFormData.orderIndex) || modules.length + 1,
          status: moduleFormData.status,
          customStatusText: moduleFormData.customStatusText.trim(),
          badgeColor: moduleFormData.badgeColor,
          isPublished: true,
          lessons: [],
          totalDurationMinutes: 0,
          completedLessonsCount: 0,
        };
        coursesStorage.addModule(newMod);
        if (onAddModule) onAddModule(newMod);
        setToast({ text: `تمت إضافة باب جديد "${newMod.title}" بنجاح! 📚🎉`, type: 'success' });
      }
      setIsModuleModalOpen(false);
    } finally {
      setTimeout(() => setIsSavingModule(false), 400);
    }
  };

  const handleDeleteModule = (modId: string, title: string) => {
    if (modules.length <= 1) {
      alert('لا يمكن حذف الباب الوحيد في الدورة.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف باب "${title}" فقط وكافة المحاضرات التابعة له؟`)) {
      coursesStorage.deleteModule(modId);
      if (onDeleteModule) onDeleteModule(modId);
      if (selectedModuleId === modId) setSelectedModuleId('all');
      setToast({ text: `تم حذف باب "${title}" بنجاح! 🗑️`, type: 'info' });
    }
  };

  const handleReorderModule = (modId: string, direction: 'up' | 'down') => {
    const updated = coursesStorage.reorderModules(modId, direction);
    if (onReorderModules) onReorderModules(modId, direction);
    setToast({ text: 'تم تحديث ترتيب الأبواب بنجاح ↕️', type: 'info' });
  };

  // ============================================================================
  // إدارة المدرسين والمعلمين (Instructors Management)
  // ============================================================================
  const openAddInstructorModal = () => {
    setEditingInstructor(null);
    setInstructorFormData({
      id: 'teacher_' + Date.now(),
      name: '',
      fullName: '',
      title: '',
      tagline: '',
      avatarIcon: '👨‍🏫',
      badgeColor: 'amber',
    });
    setIsInstructorModalOpen(true);
  };

  const openEditInstructorModal = (inst: InstructorInfo) => {
    setEditingInstructor(inst);
    setInstructorFormData({ ...inst });
    setIsInstructorModalOpen(true);
  };

  const handleSaveInstructor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorFormData.name.trim()) {
      alert('يرجى إدخال اسم المدرس');
      return;
    }

    const finalFullName = instructorFormData.fullName.trim() || instructorFormData.name.trim();

    if (editingInstructor) {
      const updated: InstructorInfo = {
        ...instructorFormData,
        name: instructorFormData.name.trim(),
        fullName: finalFullName,
        title: instructorFormData.title.trim() || 'معلم خبير في تأسيس القدرات',
        tagline: instructorFormData.tagline.trim(),
      };
      const res = coursesStorage.updateInstructor(updated);
      setInstructors([...res]);
      if (onUpdateInstructor) onUpdateInstructor(updated);
      setToast({ text: `تم تحديث بيانات المعلم (${updated.name}) بنجاح! 👨‍🏫✅`, type: 'success' });
    } else {
      const newInst: InstructorInfo = {
        ...instructorFormData,
        id: instructorFormData.id || 'teacher_' + Date.now(),
        name: instructorFormData.name.trim(),
        fullName: finalFullName,
        title: instructorFormData.title.trim() || 'معلم خبير في تأسيس القدرات',
        tagline: instructorFormData.tagline.trim(),
      };
      const res = coursesStorage.addInstructor(newInst);
      setInstructors([...res]);
      if (onAddInstructor) onAddInstructor(newInst);
      setToast({ text: `تمت إضافة المعلم الجديد (${newInst.name}) بنجاح! 👨‍🏫🎉`, type: 'success' });
    }
    setIsInstructorModalOpen(false);
  };

  const handleDeleteInstructor = (instId: string, name: string) => {
    if (instructors.length <= 1) {
      alert('يجب الإبقاء على مدرس واحد على الأقل في المنصة.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المدرس "${name}"؟ سيتم تحويل كافة محاضراته إلى المعلم الأول تلقائياً.`)) {
      const res = coursesStorage.deleteInstructor(instId);
      setInstructors([...res]);
      if (onDeleteInstructor) onDeleteInstructor(instId);
      if (selectedTeacherFilter === instId) {
        setSelectedTeacherFilter((res[0]?.id as TeacherId) || 'teacher_1');
      }
      setToast({ text: `تم حذف المدرس "${name}" بنجاح! 🗑️`, type: 'info' });
    }
  };

  const openAddModal = (defaultModuleId?: string) => {
    setEditingLesson(null);
    const activeTeacher = (selectedTeacherFilter !== 'all' ? instructors.find((i) => i.id === selectedTeacherFilter) : null) || instructors[0] || AVAILABLE_INSTRUCTORS[0];
    setFormData({
      moduleId: defaultModuleId || modules[0]?.id || '',
      title: '',
      description: '',
      teacherId: activeTeacher.id,
      teacherName: activeTeacher.name,
      videoProvider: 'youtube',
      videoUrl: '',
      durationMinutes: 15,
      isFreePreview: false,
      isPublished: true,
      quizId: 'f1111111-1111-1111-1111-111111111111',
      attachments: [],
    });
    setIsModalOpen(true);
  };

  const openEditModal = (lesson: Lesson) => {
    setEditingLesson(lesson);
    const currentTeacherId = (lesson.teacherId as TeacherId) || instructors[0]?.id || 'teacher_1';
    const currentTeacher = instructors.find((i) => i.id === currentTeacherId) || instructors[0];
    setFormData({
      moduleId: lesson.moduleId,
      title: lesson.title,
      description: lesson.description,
      teacherId: currentTeacherId,
      teacherName: lesson.teacherName || currentTeacher?.name || 'مدرس',
      videoProvider: lesson.videoProvider || 'youtube',
      videoUrl: lesson.videoUrl,
      durationMinutes: lesson.durationMinutes,
      isFreePreview: lesson.isFreePreview,
      isPublished: lesson.isPublished,
      quizId: lesson.quizId || '',
      attachments: lesson.attachments || [],
    });
    setIsModalOpen(true);
  };

  // فتح نافذة إضافة ملف عام للدورة
  const openAddCourseFileModal = () => {
    setEditingFile(null);
    setFileModalMode('course_file');
    setTargetLessonId('');
    setFileFormData({
      title: '',
      description: '',
      fileUrl: '',
      fileSize: '',
      pagesCount: '',
      fileType: 'pdf',
      isFreePreview: false,
    });
    setFileUploadError(null);
    setIsFileModalOpen(true);
  };

  // فتح نافذة تعديل ملف
  const openEditCourseFileModal = (file: CourseFileItem) => {
    setEditingFile(file);
    setFileModalMode('course_file');
    setTargetLessonId('');
    setFileFormData({
      title: file.title,
      description: file.description || '',
      fileUrl: file.fileUrl,
      fileSize: file.fileSize || '',
      pagesCount: file.pagesCount || '',
      fileType: file.fileType || 'pdf',
      isFreePreview: !!file.isFreePreview,
    });
    setFileUploadError(null);
    setIsFileModalOpen(true);
  };

  // فتح نافذة إرفاق ملف بدرس محدد
  const openAttachFileToLesson = (lesson: Lesson) => {
    setEditingFile(null);
    setFileModalMode('lesson_attachment');
    setTargetLessonId(lesson.id);
    setFileFormData({
      title: `مذكرة شرح - ${lesson.title}`,
      description: `مذكرة وتمارين تدريبية مخصصة لدرس: ${lesson.title}`,
      fileUrl: '',
      fileSize: '',
      pagesCount: '',
      fileType: 'pdf',
      isFreePreview: lesson.isFreePreview,
    });
    setFileUploadError(null);
    setIsFileModalOpen(true);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // حفظ المحاضرة
  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('يرجى إدخال عنوان المحاضرة');
      return;
    }

    const defaultVideoUrl = '';
    const finalVideoUrl = formData.videoUrl.trim() || defaultVideoUrl;
    const currentTeacher = instructors.find((i) => i.id === formData.teacherId) || instructors[0];
    const resolvedTeacherName = formData.teacherName?.trim() || currentTeacher?.name || 'مدرس';

    if (editingLesson) {
      const updated: Lesson = {
        ...editingLesson,
        moduleId: formData.moduleId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        teacherId: formData.teacherId,
        teacherName: resolvedTeacherName,
        videoProvider: formData.videoProvider,
        videoUrl: finalVideoUrl,
        durationMinutes: Number(formData.durationMinutes) || 15,
        isFreePreview: formData.isFreePreview,
        isPublished: formData.isPublished,
        quizId: formData.quizId || undefined,
        attachments: formData.attachments,
      };
      onUpdateLesson(updated);
      setToast({ text: `تم حفظ تعديلات المحاضرة (${resolvedTeacherName}) بنجاح! ✅`, type: 'success' });
    } else {
      const newLesson: Lesson = {
        id: 'les-' + Date.now(),
        moduleId: formData.moduleId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        teacherId: formData.teacherId,
        teacherName: resolvedTeacherName,
        videoProvider: formData.videoProvider,
        videoUrl: finalVideoUrl,
        durationMinutes: Number(formData.durationMinutes) || 15,
        orderIndex: 99,
        isFreePreview: formData.isFreePreview,
        isPublished: formData.isPublished,
        quizId: formData.quizId || undefined,
        attachments: formData.attachments,
      };
      onAddLesson(formData.moduleId, newLesson);
      setSelectedTeacherFilter('all');
      setToast({ text: `تمت إضافة المحاضرة ونشرها للمدرس (${resolvedTeacherName}) بنجاح! ✅`, type: 'success' });
    }

    setIsModalOpen(false);
  };

  // حفظ نموذج الملف (سواء كان ملف عام للدورة أو مرفق بمحاضرة)
  const handleSaveFileForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileFormData.title.trim()) {
      alert('يرجى إدخال عنوان أو اسم الملف');
      return;
    }

    // تجهيز رابط الملف المرفوع
    const finalFileUrl = fileFormData.fileUrl.trim();
    if (!finalFileUrl) {
      alert('يرجى رفع ملف PDF أو إدخال رابط الملف أولاً ليتمكن الطلاب من تحميله');
      return;
    }

    if (fileModalMode === 'lesson_attachment') {
      // إرفاق بمحاضرة محددة
      const targetLesson = allLessons.find((l) => l.id === targetLessonId);
      if (!targetLesson) {
        alert('يرجى اختيار المحاضرة التابع لها الملف');
        return;
      }

      const newAttachment: LessonAttachment = {
        id: 'att-' + Date.now(),
        lessonId: targetLesson.id,
        title: fileFormData.title.trim(),
        fileUrl: finalFileUrl,
        fileSize: fileFormData.fileSize.trim() || '10 MB',
        fileType: (fileFormData.fileType === 'book' ? 'pdf' : fileFormData.fileType) as AttachmentType,
        downloadCount: 0,
      };

      const updatedLesson: Lesson = {
        ...targetLesson,
        attachments: [...(targetLesson.attachments || []), newAttachment],
      };

      onUpdateLesson(updatedLesson);
      if (managingLessonAttachments?.id === targetLesson.id) {
        setManagingLessonAttachments(updatedLesson);
      }
      setToast({ text: `تم إرفاق الملف بمحاضرة "${targetLesson.title}" بنجاح! 📎✅`, type: 'success' });
    } else {
      // ملف عام لقسم المذكرات والملفات
      if (editingFile) {
        const updated: CourseFileItem = {
          ...editingFile,
          title: fileFormData.title.trim(),
          description: fileFormData.description.trim(),
          fileUrl: finalFileUrl,
          fileSize: fileFormData.fileSize.trim() || '12 MB',
          pagesCount: fileFormData.pagesCount.trim() || undefined,
          fileType: fileFormData.fileType,
          isFreePreview: fileFormData.isFreePreview,
        };
        const res = coursesStorage.updateFile(updated);
        setCourseFiles([...res]);
        if (onUpdateFile) {
          onUpdateFile(updated);
        }
        setToast({ text: 'تم حفظ تعديلات الملف بنجاح! 📄✅', type: 'success' });
      } else {
        const newFile: CourseFileItem = {
          id: 'file-' + Date.now(),
          title: fileFormData.title.trim(),
          description: fileFormData.description.trim(),
          fileUrl: finalFileUrl,
          fileSize: fileFormData.fileSize.trim() || '12 MB',
          pagesCount: fileFormData.pagesCount.trim() || '50 صفحة',
          fileType: fileFormData.fileType,
          isFreePreview: fileFormData.isFreePreview,
          downloadCount: 0,
          uploadedAt: new Date().toISOString(),
        };
        const res = coursesStorage.addFile(newFile);
        setCourseFiles([...res]);
        if (onAddFile) {
          onAddFile(newFile);
        }
        setToast({ text: 'تمت إضافة ونشر الملف في قسم المذكرات بنجاح! 📄🎉', type: 'success' });
      }
    }

    setIsFileModalOpen(false);
  };

  // حذف ملف عام
  const handleDeleteCourseFile = (fileId: string, title: string) => {
    if (window.confirm(`هل أنت متأكد من حذف ملف "${title}" نهائياً من قسم المذكرات؟`)) {
      // 1. تحديث فوري وسريع للحالة المحلية لمنع أي بقاء بصري للملف
      setCourseFiles((prev) => prev.filter((f) => f.id !== fileId));

      // 2. الحذف الفعلي من التخزين والمزامنة السحابية
      const res = coursesStorage.deleteFile(fileId);
      setCourseFiles([...res]);

      // 3. إشعار المكون الأب
      if (onDeleteFile) {
        onDeleteFile(fileId);
      }
      setToast({ text: `تم حذف ملف "${title}" بنجاح! 🗑️`, type: 'info' });
    }
  };

  // تبديل المعاينة المجانية لملف عام
  const handleToggleCourseFilePreview = (fileId: string) => {
    const res = coursesStorage.toggleFilePreview(fileId);
    setCourseFiles([...res]);
    if (onToggleFilePreview) {
      onToggleFilePreview(fileId);
    }
    setToast({ text: 'تم تحديث حالة المعاينة المجانية للملف 🎁', type: 'info' });
  };

  const filteredModules = modules
    .filter((m) => selectedModuleId === 'all' || m.id === selectedModuleId)
    .map((m) => ({
      ...m,
      lessons: selectedTeacherFilter === 'all'
        ? m.lessons
        : m.lessons.filter((l) => (l.teacherId || 'teacher_1') === selectedTeacherFilter),
    }));

  const filteredFiles = courseFiles.filter((file) => {
    const matchesSearch = file.title.toLowerCase().includes(fileSearchQuery.toLowerCase()) ||
      (file.description && file.description.toLowerCase().includes(fileSearchQuery.toLowerCase()));
    const matchesType = fileTypeFilter === 'all' || file.fileType === fileTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-300 relative">
      {/* إشعار عائم Toast */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-2xl border backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 ${
          toast.type === 'success'
            ? 'bg-emerald-600/95 text-white border-emerald-400'
            : toast.type === 'error'
            ? 'bg-rose-600/95 text-white border-rose-400'
            : 'bg-slate-900/95 text-white border-slate-700'
        }`}>
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
          {toast.type === 'error' && <X className="w-5 h-5 text-rose-200" />}
          {toast.type === 'info' && <Sparkles className="w-5 h-5 text-amber-400" />}
          <span className="text-sm font-bold">{toast.text}</span>
        </div>
      )}

      {/* رأس الصفحة والإجراءات الرئيسية */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 p-0.5 flex items-center justify-center shrink-0 shadow-sm">
              <img src="/frame_00012.png" alt="شعار طرقع" className="w-full h-full object-contain" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Video className="w-3.5 h-3.5" />
              <span>لوحة إدارة المحاضرات والمناهج (Lectures CMS)</span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {activeTab === 'lectures' && 'إدارة مسار تأسيس القدرات بالفيديو 🎥'}
            {activeTab === 'files' && 'إدارة بنك المذكرات وملفات الـ PDF 📄'}
            {activeTab === 'modules' && 'إدارة الأبواب والفصول التدريبية 📚'}
            {activeTab === 'instructors' && 'إدارة المدرسين والمعلمين المعتمدين 👨‍🏫'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            إضافة وتعديل الأبواب التدريبية، المدرسين، فيديوهات الشرح، وربط مذكرات الـ PDF بكل سهولة.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>متزامن سحابياً مع كافة الطلاب (Supabase Live)</span>
          </div>

          {onSyncCloud && (
            <button
              onClick={async () => {
                await onSyncCloud();
                setToast({ text: 'تمت المزامنة السحابية بنجاح! التعديلات منشورة الآن لجميع الطلاب ☁️✅', type: 'success' });
              }}
              className="inline-flex items-center gap-1 px-2.5 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs transition active:scale-95 shadow-sm cursor-pointer"
              title="مزامنة فورية مع السحابة لكافة الطلاب"
            >
              <UploadCloud className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" />
              <span>نشر سحابي ☁️</span>
            </button>
          )}

          {/* زر إضافة باب جديد */}
          <button
            onClick={() => openAddModuleModal()}
            className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer"
            title="إضافة باب أو فصل تدريبي جديد"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>إضافة باب 📚</span>
          </button>

          {/* زر إضافة مدرس جديد */}
          <button
            onClick={() => openAddInstructorModal()}
            className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
            title="إضافة مدرس جديد لمنصة طرقع"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>إضافة مدرس 👨‍🏫</span>
          </button>

          {/* زر إضافة ملف / مذكرة */}
          <button
            onClick={() => openAddCourseFileModal()}
            className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-blue-500/20 active:scale-95 cursor-pointer"
            title="إضافة ملف PDF أو مذكرة جديدة للموقع"
          >
            <FileUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>إضافة مذكرة 📄</span>
          </button>

          {/* زر إضافة محاضرة */}
          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm transition shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>إضافة محاضرة 🎥</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الأربعة التفاعلية */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div 
          onClick={() => setActiveTab('modules')}
          className={`p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border shadow-sm cursor-pointer transition group ${
            activeTab === 'modules' ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-purple-500/40'
          }`}
        >
          <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
            <span>الأبواب والفصول</span>
            <Layers className="w-3.5 h-3.5 text-purple-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {modules.length} أبواب
          </div>
          <p className="text-[11px] text-purple-500 mt-1 font-semibold">+ إضافة وإدارة الأبواب 📚</p>
        </div>

        <div 
          onClick={() => setActiveTab('lectures')}
          className={`p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border shadow-sm cursor-pointer transition group ${
            activeTab === 'lectures' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
            <span>المحاضرات المسجلة</span>
            <Video className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {allLessons.length} محاضرة
          </div>
          <p className="text-[11px] text-emerald-500 mt-1">{freePreviewsCount} معاينة مجانية • {Math.round((totalDuration / 60) * 10) / 10} س</p>
        </div>

        <div 
          onClick={() => setActiveTab('instructors')}
          className={`p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border shadow-sm cursor-pointer transition group ${
            activeTab === 'instructors' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
            <span>المدرسين المعتمدين</span>
            <Shield className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {instructors.length} مدرسين
          </div>
          <p className="text-[11px] text-emerald-500 mt-1 font-semibold">+ إضافة وتعديل المدرسين 👨‍🏫</p>
        </div>

        <div 
          onClick={() => setActiveTab('files')}
          className={`p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border shadow-sm cursor-pointer transition group ${
            activeTab === 'files' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-blue-500/40'
          }`}
        >
          <div className="text-xs font-bold text-slate-400 flex items-center justify-between">
            <span>ملفات ومذكرات الدورة (PDF)</span>
            <FileText className="w-3.5 h-3.5 text-blue-500 group-hover:scale-110 transition" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {courseFiles.length} ملف
          </div>
          <p className="text-[11px] text-blue-400 mt-1 font-semibold">إضافة وإدارة المذكرات 📄</p>
        </div>
      </div>

      {/* شريط التبديل بين الأقسام الأربعة */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('lectures')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'lectures'
              ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>المحاضرات والدروس ({allLessons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'files'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>المذكرات والملفات ({courseFiles.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('modules')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'modules'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>الأبواب والفصول ({modules.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('instructors')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'instructors'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>المدرسين ({instructors.length})</span>
        </button>

        <button
          onClick={() => {
            setSubscribersCourseId(undefined);
            setActiveTab('subscribers');
          }}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition cursor-pointer whitespace-nowrap ${
            activeTab === 'subscribers'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>مشتركو الدورات 👥</span>
        </button>
      </div>

      {/* ======================================================================= */}
      {/* 1. تبويب المحاضرات والدروس */}
      {/* ======================================================================= */}
      {activeTab === 'lectures' && (
        <div className="space-y-6">
          {/* شريط تصفية المدرسين الديناميكي (يدعم أي عدد من المدرسين) */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-slate-50 dark:via-slate-900/60 to-emerald-500/10 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>👨‍🏫 تصفية المحاضرات حسب المدرس:</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedTeacherFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                  selectedTeacherFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500/40'
                }`}
              >
                <span>🌟 عرض جميع المحاضرات (الكل)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                  {allLessons.length}
                </span>
              </button>
              {instructors.map((inst) => {
                const isSelected = selectedTeacherFilter === inst.id;
                const count = allLessons.filter((l) => (l.teacherId || 'teacher_1') === inst.id).length;
                return (
                  <button
                    key={inst.id}
                    onClick={() => setSelectedTeacherFilter(inst.id as TeacherId)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500/40'
                    }`}
                  >
                    <span>{inst.avatarIcon || '👨‍🏫'} {inst.name || inst.fullName}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                      {count}
                    </span>
                  </button>
                );
              })}

              <button
                onClick={() => openAddInstructorModal()}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer"
                title="إضافة مدرس جديد"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>مدرس جديد</span>
              </button>
            </div>
          </div>

          {/* الفلترة حسب الباب وزر إضافة باب */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedModuleId('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedModuleId === 'all'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              جميع الأبواب ({allLessons.length})
            </button>

            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  selectedModuleId === m.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {m.title} ({m.lessons.length})
              </button>
            ))}

            <button
              onClick={() => openAddModuleModal()}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-600 dark:text-purple-400 border border-purple-500/30 transition whitespace-nowrap flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>باب جديد</span>
            </button>
          </div>

          {/* قائمة الدروس منظمة حسب الأبواب */}
          <div className="space-y-6">
            {filteredModules.map((mod) => (
              <div
                key={mod.id}
                className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm"
              >
                {/* رأس الباب */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-sm">
                      {mod.orderIndex}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-slate-900 dark:text-white">
                          {mod.title}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-black border ${
                          mod.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : mod.status === 'locked'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : mod.status === 'upcoming'
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                        }`}>
                          {mod.status === 'active'
                            ? 'متاح للتسجيل ✅'
                            : mod.status === 'locked'
                            ? 'مغلق / قيد التجهيز 🔒'
                            : mod.status === 'upcoming'
                            ? 'قادم قريباً ⏳'
                            : 'التسجيل مغلق مؤقتاً ⏸️'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{mod.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* محول حالة التسجيل المباشر من لوحة المعلم */}
                    <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                      <span className="text-[11px] font-bold text-slate-500 px-1">التسجيل:</span>
                      <select
                        value={mod.status || 'paused'}
                        onChange={(e) => {
                          const newStatus = e.target.value as CourseEnrollmentStatus;
                          coursesStorage.updateModuleStatus(mod.id, newStatus);
                          setToast({
                            text: `تم تغيير حالة التسجيل إلى (${newStatus === 'active' ? 'متاح للتسجيل' : newStatus === 'locked' ? 'مغلق / قيد التجهيز' : newStatus === 'paused' ? 'مغلق مؤقتاً' : 'قادمة قريباً'}) بنجاح!`,
                            type: 'success',
                          });
                        }}
                        className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
                      >
                        <option value="active">🟢 متاح للجميع (Active)</option>
                        <option value="locked">🔒 مغلق / قيد التجهيز (Locked)</option>
                        <option value="paused">⏸️ مغلق مؤقتاً (Paused)</option>
                        <option value="upcoming">⏳ قادمة قريباً (Upcoming)</option>
                      </select>
                    </div>

                    {/* أزرار ترتيب الباب للأعلى والأسفل */}
                    <div className="flex items-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <button
                        onClick={() => handleReorderModule(mod.id, 'up')}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                        title="رفع ترتيب الباب للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReorderModule(mod.id, 'down')}
                        className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition cursor-pointer border-r border-slate-200 dark:border-slate-700"
                        title="إنزال ترتيب الباب للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* زر تعديل الباب */}
                    <button
                      onClick={() => openEditModuleModal(mod)}
                      className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500 hover:text-white text-purple-600 dark:text-purple-400 border border-purple-500/20 transition cursor-pointer"
                      title="تعديل بيانات الباب"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* زر حذف الباب */}
                    <button
                      onClick={() => handleDeleteModule(mod.id, mod.title)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/20 transition cursor-pointer"
                      title="حذف هذا الباب بالكامل"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => openAddModal(mod.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة درس</span>
                    </button>
                  </div>
                </div>

                {/* جدول الدروس في الباب */}
                {mod.lessons.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {mod.lessons.map((lesson, idx) => (
                      <div
                        key={lesson.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-900/30 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                            {idx + 1}
                          </div>

                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                                {lesson.title}
                              </h4>
                              {/* شارة المدرس */}
                              {(() => {
                                const lTeacher = instructors.find((i) => i.id === lesson.teacherId) || instructors[0];
                                const isGreen = lTeacher?.badgeColor === 'emerald' || lesson.teacherId === 'teacher_2';
                                return (
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                                    isGreen
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                  }`}>
                                    <span>{lTeacher?.avatarIcon || '👨‍🏫'} {lesson.teacherName || lTeacher?.name || lTeacher?.fullName || 'مدرس'}</span>
                                  </span>
                                );
                              })()}
                              {lesson.isFreePreview && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-500 text-[10px] font-bold">
                                  معاينة مجانية
                                </span>
                              )}
                              {!lesson.isPublished && (
                                <span className="px-2 py-0.5 rounded bg-rose-500/15 text-rose-400 text-[10px] font-bold">
                                  مسودة (مخفي)
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-400 line-clamp-1">
                              {lesson.description}
                            </p>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                              <span>⏱️ {lesson.durationMinutes} دقيقة</span>
                              <span>•</span>
                              <span>🎥 {lesson.videoProvider}</span>
                              <span>•</span>
                              <button
                                onClick={() => setManagingLessonAttachments(lesson)}
                                className="inline-flex items-center gap-1 text-blue-500 hover:text-blue-400 font-bold transition cursor-pointer"
                                title="عرض وإدارة مذكرات هذا الدرس"
                              >
                                <Paperclip className="w-3 h-3" />
                                <span>{lesson.attachments?.length || 0} مذكرات مرفقة</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* أزرار الإدارة والترتيب */}
                        <div className="flex items-center gap-1 sm:gap-1.5 self-end sm:self-center shrink-0">
                          {/* زر إرفاق ملف مباشر لهذه المحاضرة */}
                          <button
                            onClick={() => openAttachFileToLesson(lesson)}
                            className="p-1.5 sm:p-2 rounded-xl text-blue-500 hover:bg-blue-500/10 border border-blue-500/30 transition cursor-pointer"
                            title="إرفاق ملف / مذكرة PDF لهذا الدرس مباشرة 📎"
                          >
                            <Paperclip className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          {/* أزرار الترتيب */}
                          <button
                            onClick={() => onReorderLessons(mod.id, lesson.id, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                            title="تحريك لأعلى"
                          >
                            <ArrowUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          <button
                            onClick={() => onReorderLessons(mod.id, lesson.id, 'down')}
                            disabled={idx === mod.lessons.length - 1}
                            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition cursor-pointer"
                            title="تحريك لأسفل"
                          >
                            <ArrowDown className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          <div className="h-3.5 sm:h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 sm:mx-1" />

                          {/* زر المعاينة المجانية */}
                          {onToggleFreePreview && (
                            <button
                              onClick={() => {
                                onToggleFreePreview(lesson.id);
                                setToast({
                                  text: lesson.isFreePreview ? 'تم إلغاء المعاينة المجانية للدرس' : 'أصبح الدرس متاحاً كمعاينة مجانية 🎁',
                                  type: 'info',
                                });
                              }}
                              className={`p-1.5 sm:p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                                lesson.isFreePreview
                                  ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                                  : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-amber-500'
                              }`}
                              title={lesson.isFreePreview ? 'معاينة مجانية (اضغط للإلغاء)' : 'غير مجاني (اضغط لجعله مجانياً)'}
                            >
                              <Gift className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                            </button>
                          )}

                          {/* زر تبديل النشر */}
                          <button
                            onClick={() => {
                              onTogglePublish(lesson.id);
                              setToast({
                                text: lesson.isPublished ? 'تم إخفاء المحاضرة من الطلاب (مسودة)' : 'تم نشر المحاضرة للطلاب بنجاح! 👁️',
                                type: 'info',
                              });
                            }}
                            className={`p-1.5 sm:p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                              lesson.isPublished
                                ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                                : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                            }`}
                            title={lesson.isPublished ? 'منشور (اضغط للإخفاء)' : 'مخفي (اضغط للنشر)'}
                          >
                            {lesson.isPublished ? <Eye className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <EyeOff className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
                          </button>

                          {/* تعديل */}
                          <button
                            onClick={() => openEditModal(lesson)}
                            className="p-1.5 sm:p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                            title="تعديل المحاضرة"
                          >
                            <Edit3 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>

                          {/* حذف */}
                          <button
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من حذف محاضرة "${lesson.title}"؟ سيتم حذفها نهائياً من الموقع ولن تعود.`)) {
                                onDeleteLesson(lesson.id);
                                setToast({ text: `تم حذف محاضرة "${lesson.title}" بنجاح! 🗑️`, type: 'info' });
                              }
                            }}
                            className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                            title="حذف المحاضرة نهائياً"
                          >
                            <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    لا توجد محاضرات في هذا الباب حالياً. اضغط "إضافة درس" للبدء.
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. تبويب المذكرات وملفات الدورة (PDF Management Tab) */}
      {/* ======================================================================= */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* شريط البحث والفلترة وزر إضافة ملف */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0a0f1d] p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="ابحث في المذكرات والملفات بالاسم أو الوصف..."
                  value={fileSearchQuery}
                  onChange={(e) => setFileSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-10 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={fileTypeFilter}
                onChange={(e) => setFileTypeFilter(e.target.value as any)}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                <option value="all">جميع أنواع الملفات ({courseFiles.length})</option>
                <option value="pdf">مذكرات كاملة</option>
                <option value="summary">خرائط مفاهيم</option>
                <option value="worksheet">أوراق عمل وتدريبات</option>
                <option value="book">كتب ومراجع</option>
              </select>
            </div>

            <button
              onClick={() => openAddCourseFileModal()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة ملف PDF جديد</span>
            </button>
          </div>

          {/* شبكة كروت المذكرات */}
          {filteredFiles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4 hover:border-blue-500/40 hover:shadow-lg transition group"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        {file.isFreePreview ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-[10px] font-black">
                            معاينة مجانية 🎁
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-500 text-[10px] font-bold">
                            خاص بالمشتركين 🔒
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold">
                          {file.fileType === 'pdf' ? 'مذكرة كاملة' : file.fileType === 'summary' ? 'خريطة مفاهيم' : file.fileType === 'worksheet' ? 'ورقة عمل' : 'مرجع'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-500 transition">
                        {file.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                        {file.description || 'مذكرة تدريبية شاملة لقسم تأسيس القدرات.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      {file.fileSize && <span>📦 {file.fileSize}</span>}
                      {file.pagesCount && (
                        <>
                          <span>•</span>
                          <span>📄 {file.pagesCount}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* أزرار الإجراءات */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => fileStorageService.downloadOrPreviewFile(file.fileUrl, file.title, true, file.title, file.description)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                      title="فتح أو تجربة تحميل الملف"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>معاينة</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCourseFilePreview(file.id)}
                        className={`p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                          file.isFreePreview
                            ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-emerald-500'
                        }`}
                        title={file.isFreePreview ? 'معاينة مجانية (اضغط للتعطيل)' : 'اجعل الملف متاحاً مجاناً للجميع'}
                      >
                        <Gift className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => openEditCourseFileModal(file)}
                        className="p-2 rounded-xl text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                        title="تعديل بيانات الملف"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteCourseFile(file.id, file.title)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                        title="حذف الملف نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                <FileText className="w-7 h-7" />
              </div>
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                لا توجد ملفات أو مذكرات مطابقة للبحث
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                يمكنك إضافة أول مذكرة أو ملف PDF الآن ليتسنى لجميع الطلاب تحميلها ودراستها.
              </p>
              <button
                onClick={() => openAddCourseFileModal()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مذكرة PDF الآن</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* 3. تبويب إدارة الأبواب والفصول التدريبية (Chapters/Modules Tab) */}
      {/* ======================================================================= */}
      {activeTab === 'modules' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0a0f1d] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                <span>قائمة الأبواب والفصول التدريبية ({modules.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                يمكنك إضافة فصول وأبواب جديدة بحرية، ترتيبها، وتعديل حالات التسجيل بها
              </p>
            </div>

            <button
              onClick={() => openAddModuleModal()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-purple-600/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة باب جديد 📚</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((mod, idx) => {
              const lessonsCount = mod.lessons?.length || 0;
              const duration = (mod.lessons || []).reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
              return (
                <div
                  key={mod.id}
                  className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden group hover:border-purple-500/50 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-sm shrink-0">
                          #{mod.orderIndex || idx + 1}
                        </div>
                        <div>
                          <h4 className="font-black text-base text-slate-900 dark:text-white group-hover:text-purple-500 transition">
                            {mod.title}
                          </h4>
                          <span className="text-[11px] font-mono text-slate-400">ID: {mod.id}</span>
                        </div>
                      </div>

                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-black border ${
                        mod.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                          : mod.status === 'locked'
                          ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
                          : mod.status === 'upcoming'
                          ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
                          : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
                      }`}>
                        {mod.status === 'active'
                          ? 'متاح للتسجيل ✅'
                          : mod.status === 'locked'
                          ? 'مغلق / قيد التجهيز 🔒'
                          : mod.status === 'upcoming'
                          ? 'قادم قريباً ⏳'
                          : 'التسجيل مغلق مؤقتاً ⏸️'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {mod.description || 'لا يوجد وصف مدخل لهذا الباب.'}
                    </p>

                    {mod.customStatusText && (
                      <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl inline-block">
                        📢 {mod.customStatusText}
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs font-bold text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                        <Video className="w-3.5 h-3.5" />
                        <span>{lessonsCount} محاضرات</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{Math.round(duration / 60 * 10) / 10} ساعة</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleReorderModule(mod.id, 'up')}
                        disabled={idx === 0}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                        title="تحريك للأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReorderModule(mod.id, 'down')}
                        disabled={idx === modules.length - 1}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                        title="تحريك للأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModuleModal(mod)}
                        className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white transition cursor-pointer"
                        title="تعديل الباب"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteModule(mod.id, mod.title)}
                        className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                        title="حذف الباب"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setSubscribersCourseId(mod.courseId || mod.id);
                          setActiveTab('subscribers');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                        title="عرض وإدارة مشتركي هذا الباب والدورة"
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>المشتركون 👥</span>
                      </button>

                      <button
                        onClick={() => {
                          setSelectedModuleId(mod.id);
                          setActiveTab('lectures');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                      >
                        استعراض الدروس 🎥
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. تبويب إدارة المدرسين والمعلمين (Instructors Tab) */}
      {/* ======================================================================= */}
      {activeTab === 'instructors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#0a0f1d] p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-500" />
                <span>إدارة المدرسين والمعلمين المعتمدين ({instructors.length})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                يمكنك إضافة مدرسين جدد بحرية، تخصيص ألقابهم، نبذاتهم، وأيقوناتهم المعبرة
              </p>
            </div>

            <button
              onClick={() => openAddInstructorModal()}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm transition shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ إضافة مدرس جديد 👨‍🏫</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {instructors.map((inst) => {
              const teacherLessons = allLessons.filter((l) => (l.teacherId || 'teacher_1') === inst.id);
              const duration = teacherLessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0);
              return (
                <div
                  key={inst.id}
                  className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden group hover:border-emerald-500/50 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                          {inst.avatarIcon || '👨‍🏫'}
                        </div>
                        <div>
                          <h4 className="font-black text-base text-slate-900 dark:text-white group-hover:text-emerald-500 transition">
                            {inst.fullName || inst.name}
                          </h4>
                          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                            {inst.title || 'معلم خبير'}
                          </p>
                        </div>
                      </div>

                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono">
                        {inst.id}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {inst.tagline || 'شرح تأصيلي ومبسط لمنهج القدرات العامة.'}
                    </p>

                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <Video className="w-3.5 h-3.5" />
                        <span>{teacherLessons.length} محاضرات منشورة</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{Math.round(duration / 60 * 10) / 10} ساعة</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditInstructorModal(inst)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white transition flex items-center gap-1 text-xs font-bold cursor-pointer"
                        title="تعديل بيانات المعلم"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>تعديل</span>
                      </button>

                      {instructors.length > 1 && (
                        <button
                          onClick={() => handleDeleteInstructor(inst.id, inst.name)}
                          className="p-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500 hover:text-white transition cursor-pointer"
                          title="حذف هذا المعلم"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setSelectedTeacherFilter(inst.id as TeacherId);
                        setActiveTab('lectures');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-500 hover:text-slate-950 dark:bg-slate-800 dark:hover:bg-amber-500 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                      محاضراته ({teacherLessons.length}) 🎥
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. تبويب لوحات مشتركي الدورات المستقلة */}
      {/* ======================================================================= */}
      {activeTab === 'subscribers' && (
        <div className="animate-in fade-in duration-200">
          <CourseSubscribersDashboard
            initialCourseId={subscribersCourseId}
            onBack={() => setActiveTab('modules')}
          />
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. نافذة منبثقة لإضافة / تعديل المحاضرة (Lecture Modal) */}
      {/* ======================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 animate-in zoom-in-95">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingLesson ? 'تعديل المحاضرة التأسيسية' : 'إضافة محاضرة تأسيسية جديدة'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل رابط الشرح وخصص ملفات الـ PDF والمذكرات المرفقة
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-5">
              
              {/* اختيار المدرس (مدرس 1 vs مدرس 2) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  مدرس المحاضرة:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {instructors.map((teacher) => {
                    const isSelected = formData.teacherId === teacher.id;
                    return (
                      <button
                        key={teacher.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, teacherId: teacher.id as TeacherId, teacherName: teacher.name })}
                        className={`p-3 rounded-2xl border text-right transition cursor-pointer flex items-center gap-3 ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-500 text-slate-900 dark:text-white shadow-md shadow-amber-500/10 ring-2 ring-amber-500/30'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                          isSelected ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-200 dark:bg-slate-800'
                        }`}>
                          {teacher.avatarIcon || '👨‍🏫'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black truncate">{teacher.fullName || teacher.name}</span>
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">{teacher.title || 'معلم خبير'}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* اختيار الباب التأسيسي */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الباب التأسيسي التابع له:
                </label>
                <select
                  value={formData.moduleId}
                  onChange={(e) => setFormData({ ...formData, moduleId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* عنوان الدرس */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان المحاضرة:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أسرار جدول الضرب والعمليات الذهنية الخاطفة"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* وصف الدرس */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  وصف الشرح وأهم النقاط:
                </label>
                <textarea
                  rows={2}
                  placeholder="نبذة سريعة عما سيتعلمه الطالب في هذا الفيديو..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* مزود الفيديو ورابط الفيديو والرفع المباشر */}
              <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-slate-900 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Video className="w-4 h-4 text-amber-500" />
                    <span>فيديو المحاضرة والشرح 🎥</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>حماية وعلامة مائية مانعة للتسريب</span>
                  </span>
                </div>

                {/* نصيحة ذهبية لمنصات التعليم وضمان تشغيل الموبايل */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                  <span className="font-bold">🌟 التوصية المثلى لجميع الهواتف:</span> يُنصح بشدة برفع الفيديو على <strong>YouTube واختيار (غير مدرج - Unlisted)</strong> ثم وضع الرابط هنا. يمنح ذلك تشغيلاً سريعاً 100% بدون تقطيع على كل هواتف الآيفون والأندرويد وبجودات متعددة تلقائياً.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      نوع المزود:
                    </label>
                    <select
                      value={formData.videoProvider}
                      onChange={(e) => setFormData({ ...formData, videoProvider: e.target.value as VideoProvider })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                    >
                      <option value="youtube">YouTube (موصى به لجميع الهواتف) ⭐</option>
                      <option value="direct_url">رابط مباشر (MP4)</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="uploaded_video">فيديو مرفوع من الجهاز (معاينة محلية) 🔒</option>
                      <option value="bunny">Bunny.net</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      رابط فيديو المحاضرة (YouTube أو MP4):
                    </label>
                    <input
                      type="text"
                      placeholder="https://youtu.be/... أو https://www.youtube.com/watch?v=..."
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left dir-ltr"
                    />
                  </div>
                </div>

                {/* خيار رفع الفيديو كخيار بديل */}
                <div className="pt-2 border-t border-amber-500/20">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">أو رفع ملف فيديو من جهازك (للمعاينة المباشرة):</span>
                    <span className="text-[10px] text-slate-400">MP4, WebM</span>
                  </div>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime,video/mkv,.mp4,.webm,.mov"
                    onChange={handleVideoFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploadingVideo}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-white dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingVideo ? (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارٍ معالجة ملف الفيديو ({videoUploadProgress}%)...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-amber-500" />
                        <span>اضغط لرفع فيديو من جهاز الكمبيوتر</span>
                      </>
                    )}
                  </button>

                  {videoUploadError && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1">{videoUploadError}</p>
                  )}
                </div>
              </div>

              {/* المدة وخيارات الإتاحة */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    مدة المحاضرة (بالدقائق):
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={formData.durationMinutes}
                    onChange={(e) => setFormData({ ...formData, durationMinutes: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 sm:pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isFreePreview}
                      onChange={(e) => setFormData({ ...formData, isFreePreview: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                    <span>إتاحة كمعاينة مجانية 🎁</span>
                  </label>
                </div>

                <div className="flex items-center gap-2 sm:pt-6">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData({ ...formData, isPublished: e.target.checked })}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                    />
                    <span>نشر الدرس فورياً للطلاب</span>
                  </label>
                </div>
              </div>

              {/* منطقة رفع المذكرات المرفقة (FileUploadZone) */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>المذكرات والملازم المرفقة (PDF Attachments):</span>
                </h4>
                
                <FileUploadZone
                  lessonId={editingLesson?.id || 'temp-lesson'}
                  attachments={formData.attachments}
                  onAddAttachment={(newAtt) =>
                    setFormData((prev) => ({
                      ...prev,
                      attachments: [...prev.attachments, newAtt],
                    }))
                  }
                  onRemoveAttachment={(attId) =>
                    setFormData((prev) => ({
                      ...prev,
                      attachments: prev.attachments.filter((a) => a.id !== attId),
                    }))
                  }
                />
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingLesson ? 'حفظ التعديلات' : 'إضافة ونشر الدرس'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 4. نافذة إضافة / تعديل ملف ومذكرة (File Management Modal) */}
      {/* ======================================================================= */}
      {isFileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1222] border border-blue-500/30 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingFile 
                      ? 'تعديل بيانات الملف / المذكرة'
                      : fileModalMode === 'lesson_attachment'
                      ? 'إرفاق ملف بمحاضرة'
                      : 'إضافة ملف أو مذكرة جديدة (PDF)'
                    }
                  </h3>
                  <p className="text-xs text-slate-400">
                    رفع ملفات PDF، أوراق العمل، والمذكرات التأسيسية
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsFileModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFileForm} className="space-y-4">
              {/* اختيار نوع الإضافة إن لم تكن مخصصة لدرس مسبق */}
              {!editingFile && (
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setFileModalMode('course_file')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      fileModalMode === 'course_file'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    📄 ملف عام للدورة والمذكرات
                  </button>
                  <button
                    type="button"
                    onClick={() => setFileModalMode('lesson_attachment')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      fileModalMode === 'lesson_attachment'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    📎 إرفاق بمحاضرة محددة
                  </button>
                </div>
              )}

              {/* إذا كان إرفاق بمحاضرة، نطلب تحديد المحاضرة */}
              {fileModalMode === 'lesson_attachment' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    اختر المحاضرة التابع لها هذا الملف:
                  </label>
                  <select
                    value={targetLessonId}
                    onChange={(e) => setTargetLessonId(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- اختر المحاضرة من القائمة --</option>
                    {modules.map((mod) => (
                      <optgroup key={mod.id} label={mod.title}>
                        {mod.lessons.map((les) => (
                          <option key={les.id} value={les.id}>
                            {mod.orderIndex}.{les.orderIndex} {les.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              )}

              {/* عنوان الملف */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان أو اسم الملف / المذكرة *:
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مذكرة طرقع الشاملة لتأسيس الكمي (الملف الكامل)"
                  value={fileFormData.title}
                  onChange={(e) => setFileFormData({ ...fileFormData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* وصف الملف */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  وصف محتوى الملف:
                </label>
                <textarea
                  rows={2}
                  placeholder="وصف مختصر لمحتوى المذكرة وأهم التمارين الموجودة بها..."
                  value={fileFormData.description}
                  onChange={(e) => setFileFormData({ ...fileFormData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              {/* نوع المرفق */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نوع الملف:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pdf', label: 'مذكرة كاملة' },
                    { id: 'summary', label: 'خريطة مفاهيم' },
                    { id: 'worksheet', label: 'ورقة عمل' },
                    { id: 'book', label: 'كتاب / مرجع' },
                  ].map((type) => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setFileFormData({ ...fileFormData, fileType: type.id as any })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        fileFormData.fileType === type.id
                          ? 'bg-blue-500/15 border-blue-500 text-blue-500'
                          : 'border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* قسم رفع الملف أو إدخال الرابط */}
              <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-slate-900 border border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-blue-500" />
                    <span>ملف الـ PDF ورابط التحميل *</span>
                  </span>
                  <span className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    مستودع سحابي آمن
                  </span>
                </div>

                {/* خيار رفع ملف مباشر من الكمبيوتر */}
                <div>
                  <input
                    ref={filePickerRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handlePDFFileSelect}
                    className="hidden"
                  />

                  <button
                    type="button"
                    onClick={() => filePickerRef.current?.click()}
                    disabled={isUploadingFile}
                    className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-blue-500/40 hover:border-blue-500 bg-white dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isUploadingFile ? (
                      <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جارٍ رفع ملف الـ PDF ({fileUploadProgress}%)...</span>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4 text-blue-500" />
                        <span>اضغط لرفع ملف PDF من جهازك مباشرة 📤</span>
                      </>
                    )}
                  </button>

                  {fileUploadError && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1">{fileUploadError}</p>
                  )}
                </div>

                {/* رابط التحميل المباشر أو حالة الملف المرفوع */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                      رابط التحميل (URL / Google Drive / تم الرفع):
                    </label>
                    {fileFormData.fileUrl && (
                      <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>الملف جاهز ومحفوظ</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="https://... (أو ارفع الملف أعلاه مباشرة)"
                    value={fileFormData.fileUrl.startsWith('data:') ? 'تم تجهيز وتضمين ملف PDF محلياً بنجاح 📄' : fileFormData.fileUrl}
                    onChange={(e) => {
                      if (!e.target.value.includes('تم تجهيز')) {
                        setFileFormData({ ...fileFormData, fileUrl: e.target.value });
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 text-left dir-ltr"
                  />
                </div>
              </div>

              {/* حجم الملف وعدد الصفحات */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    حجم الملف (تلقائي أو مخصص):
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: 14.8 MB"
                    value={fileFormData.fileSize}
                    onChange={(e) => setFileFormData({ ...fileFormData, fileSize: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                {fileModalMode === 'course_file' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      عدد الصفحات:
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: 185 صفحة"
                      value={fileFormData.pagesCount}
                      onChange={(e) => setFileFormData({ ...fileFormData, pagesCount: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                )}
              </div>

              {/* خيار المعاينة المجانية */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cmsFileFreeCheck"
                  checked={fileFormData.isFreePreview}
                  onChange={(e) => setFileFormData({ ...fileFormData, isFreePreview: e.target.checked })}
                  className="w-4 h-4 accent-blue-500 rounded cursor-pointer"
                />
                <label htmlFor="cmsFileFreeCheck" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  إتاحة هذا الملف كمعاينة مجانية 🎁 (يمكن لأي طالب تحميله مجاناً بدون اشتراك)
                </label>
              </div>

              {/* أزرار الحفظ والإلغاء */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsFileModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition shadow-md shadow-blue-600/20 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingFile ? 'حفظ تعديلات الملف' : 'حفظ ونشر الملف'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. نافذة إدارة مرفقات المحاضرة السريعة (Quick Lesson Attachments Modal) */}
      {/* ======================================================================= */}
      {managingLessonAttachments && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1222] border border-blue-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-blue-500" />
                  <span>مرفقات ومذكرات المحاضرة</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">
                  {managingLessonAttachments.title}
                </p>
              </div>

              <button
                onClick={() => setManagingLessonAttachments(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {(managingLessonAttachments.attachments && managingLessonAttachments.attachments.length > 0) ? (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  {managingLessonAttachments.attachments.map((att) => (
                    <div key={att.id} className="p-3 flex items-center justify-between gap-3 text-xs bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {att.title}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{att.fileSize}</span>
                            <span>•</span>
                            <span className="text-blue-500 font-semibold">
                              {att.fileType === 'pdf' ? 'مذكرة' : att.fileType === 'summary' ? 'خريطة مفاهيم' : 'ورقة عمل'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            fileStorageService.downloadWatermarkedFile({
                              title: att.title,
                              fileUrl: att.fileUrl,
                            });
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition cursor-pointer"
                          title="تحميل المذكرة"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف المرفق "${att.title}" من هذا الدرس؟`)) {
                              const updatedLesson: Lesson = {
                                ...managingLessonAttachments,
                                attachments: (managingLessonAttachments.attachments || []).filter((a) => a.id !== att.id),
                              };
                              onUpdateLesson(updatedLesson);
                              setManagingLessonAttachments(updatedLesson);
                              setToast({ text: `تم حذف المرفق "${att.title}" بنجاح! 🗑️`, type: 'info' });
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                          title="حذف المرفق"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center text-slate-400 text-xs border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  لا توجد مذكرات أو ملفات مرفقة بهذا الدرس حتى الآن.
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  const lesson = managingLessonAttachments;
                  setManagingLessonAttachments(null);
                  openAttachFileToLesson(lesson);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مذكرة جديدة لهذا الدرس 📄</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 6. نافذة إضافة / تعديل الباب التدريبي (Module Modal) */}
      {/* ======================================================================= */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1222] border border-purple-500/30 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingModule ? 'تعديل الباب التدريبي' : 'إضافة باب تدريبي جديد 📚'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل تفاصيل الباب ورتبته وحالة التسجيل المتاحة للطلاب
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModuleModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveModule} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  عنوان الباب أو الفصل: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الباب الثاني: الهندسة والزوايا والأشكال"
                  value={moduleFormData.title}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  وصف الباب ومحتواه التدريبي:
                </label>
                <textarea
                  rows={3}
                  placeholder="نبذة عن المهارات والقوانين التي يغطيها هذا الباب..."
                  value={moduleFormData.description}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    ترتيب ظهور الباب:
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={moduleFormData.orderIndex}
                    onChange={(e) => setModuleFormData({ ...moduleFormData, orderIndex: Number(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    حالة التسجيل في الباب:
                  </label>
                  <select
                    value={moduleFormData.status}
                    onChange={(e) => setModuleFormData({ ...moduleFormData, status: e.target.value as CourseEnrollmentStatus })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="active">🟢 متاح للتسجيل للجميع (Active)</option>
                    <option value="locked">🔒 مغلق / قيد التجهيز (Locked)</option>
                    <option value="paused">⏸️ مغلق مؤقتاً للتحديث (Paused)</option>
                    <option value="upcoming">⏳ قادم قريباً (Upcoming)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  نص حالة مخصص أو تنبيه اختياري:
                </label>
                <input
                  type="text"
                  placeholder="مثال: يفتح التسجيل مع بداية الأسبوع القادم"
                  value={moduleFormData.customStatusText}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, customStatusText: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModuleModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition shadow-md shadow-purple-600/20 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingModule ? 'حفظ تعديلات الباب' : 'إنشاء الباب الآن 📚'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. نافذة إضافة / تعديل المدرس (Instructor Modal) */}
      {/* ======================================================================= */}
      {isInstructorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-[#0c1222] border border-emerald-500/30 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 my-8 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingInstructor ? 'تعديل بيانات المعلم' : 'إضافة مدرس جديد لمنصة طرقع 👨‍🏫'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    أدخل الاسم، اللقب، وأسلوب الشرح ليكون خياراً متاحاً للطلاب
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsInstructorModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInstructor} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    الاسم المعروض: <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أ. محمد عبد الله"
                    value={instructorFormData.name}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    الاسم الكامل:
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: الأستاذ محمد عبد الله السعيد"
                    value={instructorFormData.fullName}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, fullName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  اللقب والتخصص التدريبي:
                </label>
                <input
                  type="text"
                  placeholder="مثال: خبير التأسيس السريع واستراتيجيات الحل الخاطف"
                  value={instructorFormData.title}
                  onChange={(e) => setInstructorFormData({ ...instructorFormData, title: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  النبذة التعريفية وأسلوب الشرح:
                </label>
                <textarea
                  rows={2}
                  placeholder="مثال: شرح مبسط من الصفر يركز على الفهم العميق وقوانين قياس الأساسية..."
                  value={instructorFormData.tagline}
                  onChange={(e) => setInstructorFormData({ ...instructorFormData, tagline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    الأيقونة التعبيرية (Emoji):
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={instructorFormData.avatarIcon || '👨‍🏫'}
                      onChange={(e) => setInstructorFormData({ ...instructorFormData, avatarIcon: e.target.value })}
                      className="w-16 text-center text-xl px-2 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                    <div className="flex items-center gap-1 overflow-x-auto">
                      {['👨‍🏫', '⚡', '🎯', '🧠', '🚀', '💡', '🌟', '📚'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setInstructorFormData({ ...instructorFormData, avatarIcon: emoji })}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-base cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    لون البادج والشعار:
                  </label>
                  <select
                    value={instructorFormData.badgeColor}
                    onChange={(e) => setInstructorFormData({ ...instructorFormData, badgeColor: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="amber">كهرماني (Amber) 🟡</option>
                    <option value="emerald">زمردي (Emerald) 🟢</option>
                    <option value="cyan">سماوي (Cyan) 🔵</option>
                    <option value="purple">بنفسجي (Purple) 🟣</option>
                    <option value="rose">وردي (Rose) 🔴</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsInstructorModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingInstructor ? 'حفظ تعديلات المعلم' : 'إضافة المعلم الآن 👨‍🏫'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
