import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  BookOpen,
  FileText,
  CheckCircle2,
  Sparkles,
  Lock,
  Eye,
  ShieldCheck,
  ChevronLeft,
  Calendar,
  Layers,
  Award,
  Zap,
} from 'lucide-react';
import { CourseFileItem } from '../types';
import { fileStorageService } from '../lib/fileStorageService';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: CourseFileItem | null;
  currentUser?: any;
  isSubscribed?: boolean;
  onSubscribeClick?: () => void;
  onDownloadClick?: (file: CourseFileItem) => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  currentUser,
  isSubscribed = false,
  onSubscribeClick,
  onDownloadClick,
}) => {
  const [activeTab, setActiveTab] = useState<'reader' | 'pages'>('reader');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // إعادة ضبط التبويب والحالة عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setActiveTab('reader');
      setIsDownloading(false);
      setDownloadSuccess(false);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const hasAccess = file.isFreePreview || isSubscribed;

  const handleDownload = async () => {
    if (!hasAccess) {
      onSubscribeClick?.();
      return;
    }

    setIsDownloading(true);
    try {
      if (onDownloadClick) {
        onDownloadClick(file);
      } else {
        await fileStorageService.downloadOrPreviewFile(
          file.fileUrl,
          file.title,
          false,
          file.title,
          file.description
        );
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (e) {
      console.error('Download error in modal:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-[#0c1324] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* ===================================================================== */}
        {/* 1. Header الشامل للملف */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <BookOpen className="w-6 h-6" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {file.fileType === 'pdf'
                    ? 'مذكرة تأسيس شاملة'
                    : file.fileType === 'summary'
                    ? 'ملخص القوانين الذهبية'
                    : 'أوراق عمل تدريبية'}
                </span>

                {file.isFreePreview ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>معاينة وتحميل مجاني 🎁</span>
                  </span>
                ) : hasAccess ? (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>متاح باشتراكك ✅</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>يتطلب اشتراك كامل</span>
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white line-clamp-1">
                {file.title}
              </h3>

              <div className="flex items-center gap-3 text-xs text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  <span>{file.pagesCount || '100+ صفحة'}</span>
                </span>
                <span>•</span>
                <span>{file.fileSize || 'PDF'}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>دفعة 1446-1447هـ (2025/2026)</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer shrink-0"
            title="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 2. شريط التبويبات (فهرس المحتوى / الصفحات النموذجية) */}
        {/* ===================================================================== */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 bg-white dark:bg-[#0c1324]">
          <button
            onClick={() => setActiveTab('reader')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'reader'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>فهرس ومحتوى المذكرة 📖</span>
          </button>

          <button
            onClick={() => setActiveTab('pages')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'pages'
                ? 'bg-amber-500 text-slate-950 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>عرض صفحات المعاينة 📄</span>
          </button>
        </div>

        {/* ===================================================================== */}
        {/* 3. محتوى التبويبات التفاعلية */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {activeTab === 'reader' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm leading-relaxed">
                <div className="font-black flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>دليل طرقع التأسيسي الشامل لاختبار القدرات العامة (محوسب وورقي)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  تم إعداد هذا المحتوى التدريبي وفق أحدث معايير المركز الوطني قياس وتجميعات عام 2025/2026 لضمان التأسيس من الصفر وحتى إتقان استراتيجيات الحل الخاطف في 30 ثانية.
                </p>
              </div>

              {/* أقسام المذكرة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* قسم 1 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs">
                      1
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      الحساب والكسور والنسب المئوية 🧮
                    </h4>
                  </div>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pr-2 list-disc list-inside">
                    <li>استراتيجية التدرج المنتظم لحل مسائل النسب والتخفيضات</li>
                    <li>المقص السريع للمقارنة بين الكسور وتوحيد المقامات في ثانية</li>
                    <li>قوانين المتتابعات الحسابية والهندسية ومجموع الحدود</li>
                  </ul>
                </div>

                {/* قسم 2 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black text-xs">
                      2
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      الجبر والمعادلات السريعة والأسس ⚡
                    </h4>
                  </div>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pr-2 list-disc list-inside">
                    <li>المتطابقات الشهيرة وفك المربعات وفرق المربعين</li>
                    <li>قواعد الأسس، الأس السالب، والجذور التكعيبية والتربيعية</li>
                    <li>استراتيجية التعويض بالأرقام البسيطة (0، 1، 2) للحل الخاطف</li>
                  </ul>
                </div>

                {/* قسم 3 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs">
                      3
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      الهندسة والزوايا والأشكال المظللة 📐
                    </h4>
                  </div>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pr-2 list-disc list-inside">
                    <li>المثلثات الذهبية الشهيرة (3:4:5، 5:12:13، 30-60-90)</li>
                    <li>طرق حساب مساحة الأجزاء المظللة بحيلة الطرح التراكمي</li>
                    <li>قوانين محيط ومساحة الدائرة والمضلعات المنتظمة</li>
                  </ul>
                </div>

                {/* قسم 4 */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-xs">
                      4
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                      المقارنات والإحصاء والاحتمالات 📊
                    </h4>
                  </div>
                  <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 pr-2 list-disc list-inside">
                    <li>الحالات الأربع للمقارنة وحيل اختيار (المعطيات غير كافية)</li>
                    <li>المتوسط الحسابي والوسيط والمنوال وقراءة الرسوم البيانية</li>
                    <li>مبدأ العد الأساسي والاحتمالات المركبة والتباديل</li>
                  </ul>
                </div>
              </div>

              {/* ميزات الحقيبة */}
              <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span>أكثر من 500 تمرين محلول خطوة بخطوة بالاستراتيجية الخاطفة</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <Award className="w-4 h-4" />
                  <span>تحديث دوري ومستمر مع بنك قياس الرسمي 2025</span>
                </div>
              </div>
            </div>
          ) : (
            /* تبويب الصفحات النموذجية */
            <div className="space-y-4">
              <div className="p-8 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-28 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-col justify-between items-center">
                  <div className="w-full h-2 rounded bg-amber-500"></div>
                  <FileText className="w-8 h-8 text-slate-400" />
                  <div className="text-[9px] font-black text-slate-500">PDF PREVIEW</div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                    {file.title}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    {file.description || 'ملف التأسيس الشامل المعتمد لاختبار القدرات العامة من منصة طرقع.'}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-center">
                  <span className="text-xs px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    حجم الملف: {file.fileSize || '10 MB'}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    عدد الصفحات: {file.pagesCount || '100+ صفحة'}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                    الصيغة: PDF جاهز للطباعة والتحميل
                  </span>
                </div>

                <p className="text-xs text-slate-400 max-w-sm">
                  اضغط على زر التحميل أدناه لحفظ الملف كاملاً على هاتفك أو حاسوبك بصيغة PDF قابلة للطباعة والتصفح دون اتصال بالإنترنت.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 4. Footer الإجراءات (التحميل والاشتراك) */}
        {/* ===================================================================== */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {hasAccess ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>الملف متاح للتحميل الفوري لجهازك بنقرة واحدة ✅</span>
              </span>
            ) : (
              <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>اشترك الآن (75 ر.س/سنة) لتحميل جميع الملفات والمحاضرات 🚀</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer flex-1 sm:flex-initial"
            >
              إغلاق المعاينة
            </button>

            {hasAccess ? (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black transition shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial active:scale-95 disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                <span>{downloadSuccess ? 'تم بدء التنزيل بنجاح! 📥' : isDownloading ? 'جاري التجهيز...' : 'تحميل الملف كاملاً PDF 📥'}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  onClose();
                  onSubscribeClick?.();
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 text-xs sm:text-sm font-black transition shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial active:scale-95"
              >
                <Lock className="w-4 h-4" />
                <span>تفعيل الاشتراك السنوي للتحميل 🚀</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
