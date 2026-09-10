import React, { useState } from 'react';
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
  Check
} from 'lucide-react';
import { CourseModule, Lesson, LessonAttachment, VideoProvider } from '../types';
import { FileUploadZone } from './FileUploadZone';
import { uploadLessonVideo } from '../lib/videoUploadService';

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
}) => {
  const [selectedModuleId, setSelectedModuleId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // حالة نموذج إضافة/تعديل درس
  const [formData, setFormData] = useState<{
    moduleId: string;
    title: string;
    description: string;
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
    videoProvider: 'uploaded_video',
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
  const videoInputRef = React.useRef<HTMLInputElement>(null);

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

  // حساب الإحصائيات الشاملة
  const allLessons = modules.flatMap((m) => m.lessons);
  const totalDuration = allLessons.reduce((acc, l) => acc + l.durationMinutes, 0);
  const totalAttachments = allLessons.reduce((acc, l) => acc + (l.attachments?.length || 0), 0);
  const freePreviewsCount = allLessons.filter((l) => l.isFreePreview).length;

  const openAddModal = (defaultModuleId?: string) => {
    setEditingLesson(null);
    setFormData({
      moduleId: defaultModuleId || modules[0]?.id || '',
      title: '',
      description: '',
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
    setFormData({
      moduleId: lesson.moduleId,
      title: lesson.title,
      description: lesson.description,
      videoProvider: lesson.videoProvider,
      videoUrl: lesson.videoUrl,
      durationMinutes: lesson.durationMinutes,
      isFreePreview: lesson.isFreePreview,
      isPublished: lesson.isPublished,
      quizId: lesson.quizId || '',
      attachments: lesson.attachments || [],
    });
    setIsModalOpen(true);
  };

  React.useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSaveLesson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('يرجى إدخال عنوان المحاضرة');
      return;
    }

    const defaultVideoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    const finalVideoUrl = formData.videoUrl.trim() || defaultVideoUrl;

    if (editingLesson) {
      const updated: Lesson = {
        ...editingLesson,
        moduleId: formData.moduleId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        videoProvider: formData.videoProvider,
        videoUrl: finalVideoUrl,
        durationMinutes: Number(formData.durationMinutes) || 15,
        isFreePreview: formData.isFreePreview,
        isPublished: formData.isPublished,
        quizId: formData.quizId || undefined,
        attachments: formData.attachments,
      };
      onUpdateLesson(updated);
      setToast({ text: 'تم حفظ تعديلات المحاضرة بنجاح في الموقع! ✅', type: 'success' });
    } else {
      const newLesson: Lesson = {
        id: 'les-' + Date.now(),
        moduleId: formData.moduleId,
        title: formData.title.trim(),
        description: formData.description.trim(),
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
      setToast({ text: 'تمت إضافة المحاضرة ونشرها بنجاح في الموقع! ✅', type: 'success' });
    }

    setIsModalOpen(false);
  };

  const filteredModules = selectedModuleId === 'all' 
    ? modules 
    : modules.filter((m) => m.id === selectedModuleId);

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

      {/* رأس الصفحة والإحصائيات السريعة */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold mb-2">
            <Video className="w-3.5 h-3.5" />
            <span>لوحة إدارة المحاضرات والمذكرات (Lectures CMS)</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            إدارة مسار تأسيس القدرات بالفيديو
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            رفع وتعديل شروحات الأبواب التأسيسية، ربط ملفات PDF، وتحديد المعاينات المجانية.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
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
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold text-xs transition active:scale-95 shadow-sm"
              title="مزامنة فورية مع السحابة لكافة الطلاب"
            >
              <UploadCloud className="w-4 h-4 text-emerald-500" />
              <span>نشر سحابي مباشر ☁️</span>
            </button>
          )}

          {onResetDefault && (
            <button
              onClick={() => {
                if (window.confirm('هل أنت متأكد من رغبتك في استعادة المحاضرات الافتراضية؟ سيتم إعادة تحميل المسار التأسيسي الأصلي.')) {
                  onResetDefault();
                  setToast({ text: 'تمت استعادة المحاضرات الافتراضية بنجاح! 🔄', type: 'info' });
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition active:scale-95 border border-slate-200 dark:border-slate-700"
              title="استعادة البيانات الافتراضية"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>استعادة الافتراضي</span>
            </button>
          )}

          <button
            onClick={() => openAddModal()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة محاضرة جديدة</span>
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات الأربعة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-400">إجمالي الأبواب</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {modules.length} أبواب
          </div>
          <p className="text-[11px] text-amber-500 mt-1">تغطي كامل قسم الكمي</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-400">المحاضرات المسجلة</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {allLessons.length} محاضرة
          </div>
          <p className="text-[11px] text-emerald-500 mt-1">{freePreviewsCount} معاينة مجانية</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-400">ساعات الشرح المركزة</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {Math.round((totalDuration / 60) * 10) / 10} ساعة
          </div>
          <p className="text-[11px] text-slate-400 mt-1">متوسط 20 دقيقة للدرس</p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-bold text-slate-400">المذكرات المرفقة (PDF)</div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {totalAttachments} مذكرة
          </div>
          <p className="text-[11px] text-blue-400 mt-1">مربوطة بـ Supabase Storage</p>
        </div>
      </div>

      {/* الفلترة حسب الباب */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedModuleId('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
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
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedModuleId === m.id
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {m.title} ({m.lessons.length})
          </button>
        ))}
      </div>

      {/* قائمة الدروس منظمة حسب الأبواب */}
      <div className="space-y-6">
        {filteredModules.map((mod) => (
          <div
            key={mod.id}
            className="bg-white dark:bg-[#0a0f1d] border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm"
          >
            {/* رأس الباب */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black text-sm">
                  {mod.orderIndex}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    {mod.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{mod.description}</p>
                </div>
              </div>

              <button
                onClick={() => openAddModal(mod.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-200 font-bold text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة درس لهذا الباب</span>
              </button>
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
                          <span>📑 {lesson.attachments?.length || 0} مذكرات</span>
                        </div>
                      </div>
                    </div>

                    {/* أزرار الإدارة والترتيب */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      {/* أزرار الترتيب */}
                      <button
                        onClick={() => onReorderLessons(mod.id, lesson.id, 'up')}
                        disabled={idx === 0}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => onReorderLessons(mod.id, lesson.id, 'down')}
                        disabled={idx === mod.lessons.length - 1}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition"
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

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
                          className={`p-2 rounded-xl border text-xs font-bold transition ${
                            lesson.isFreePreview
                              ? 'text-amber-500 border-amber-500/30 bg-amber-500/10'
                              : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:text-amber-500'
                          }`}
                          title={lesson.isFreePreview ? 'معاينة مجانية (اضغط للإلغاء)' : 'غير مجاني (اضغط لجعله مجانياً)'}
                        >
                          <Gift className="w-3.5 h-3.5" />
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
                        className={`p-2 rounded-xl border text-xs font-bold transition ${
                          lesson.isPublished
                            ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10'
                            : 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                        }`}
                        title={lesson.isPublished ? 'منشور (اضغط للإخفاء)' : 'مخفي (اضغط للنشر)'}
                      >
                        {lesson.isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>

                      {/* تعديل */}
                      <button
                        onClick={() => openEditModal(lesson)}
                        className="p-2 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 border border-slate-200 dark:border-slate-800 transition"
                        title="تعديل المحاضرة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {/* حذف */}
                      <button
                        onClick={() => {
                          if (window.confirm(`هل أنت متأكد من حذف محاضرة "${lesson.title}"؟ سيتم حذفها نهائياً من الموقع ولن تعود.`)) {
                            onDeleteLesson(lesson.id);
                            setToast({ text: `تم حذف محاضرة "${lesson.title}" بنجاح! 🗑️`, type: 'info' });
                          }
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200 dark:border-slate-800 transition"
                        title="حذف المحاضرة نهائياً"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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

      {/* نافذة منبثقة لإضافة / تعديل المحاضرة (Modal Drawer) */}
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
                className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLesson} className="space-y-5">
              
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
                    <span>فيديو المحاضرة (مشفر ومحمي) 🔒</span>
                  </span>
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    <span>مانع للتسريب بالـ User ID</span>
                  </span>
                </div>

                {/* زر رفع ملف الفيديو */}
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
                  className="w-full py-3 px-4 rounded-xl border border-dashed border-amber-500/40 hover:border-amber-500 bg-white dark:bg-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isUploadingVideo ? (
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جارٍ رفع ملف الفيديو ({videoUploadProgress}%)...</span>
                    </div>
                  ) : (
                    <>
                      <UploadCloud className="w-4 h-4 text-amber-500" />
                      <span>اضغط لرفع فيديو من جهازك (MP4 / WebM)</span>
                    </>
                  )}
                </button>

                {videoUploadError && (
                  <p className="text-[11px] font-bold text-rose-500">{videoUploadError}</p>
                )}

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
                      <option value="uploaded_video">فيديو مرفوع (مشفر) 🔒</option>
                      <option value="direct_url">رابط مباشر (MP4)</option>
                      <option value="youtube">YouTube</option>
                      <option value="vimeo">Vimeo</option>
                      <option value="bunny">Bunny.net</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      رابط الفيديو المباشر أو الفيديو المرفوع:
                    </label>
                    <input
                      type="text"
                      placeholder="https://... أو سيتم تعبئته تلقائياً عند الرفع"
                      value={formData.videoUrl}
                      onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 text-left dir-ltr"
                    />
                  </div>
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
                  className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 transition"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md shadow-amber-500/20 active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingLesson ? 'حفظ التعديلات' : 'إضافة ونشر الدرس'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
