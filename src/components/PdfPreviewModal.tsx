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
  Calendar,
  Layers,
  Award,
  Zap,
  ExternalLink,
  Loader2,
  Maximize2,
  AlertTriangle,
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
  const [activeTab, setActiveTab] = useState<'viewer' | 'chapters'>('viewer');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // حالة الرابط المباشر للـ PDF والتحميل
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  const studentName =
    currentUser?.full_name?.trim() ||
    currentUser?.email?.split('@')[0] ||
    'طالب منصة طرقع';

  const studentId =
    currentUser?.email ||
    currentUser?.telegram_username ||
    currentUser?.phone_number ||
    (currentUser?.id ? `ID-${currentUser.id.slice(0, 8)}` : 'حساب مسجل');

  // توليد وعرض الـ PDF المشفر باسم وبيانات الطالب عند فتح النافذة
  useEffect(() => {
    let activeUrl: string | null = null;

    if (isOpen && file) {
      setActiveTab('viewer');
      setIsLoadingPdf(true);
      setPdfLoadError(null);
      setDownloadSuccess(false);

      fileStorageService
        .getWatermarkedPdfBlobUrl(
          {
            title: file.title,
            fileUrl: file.fileUrl,
            description: file.description,
            pagesCount: file.pagesCount,
          },
          currentUser
        )
        .then((url: string) => {
          activeUrl = url;
          setPdfBlobUrl(url);
          setIsLoadingPdf(false);
        })
        .catch((err: any) => {
          console.error('Error generating PDF preview:', err);
          setPdfLoadError('تعذر عرض الملف مباشرة. يمكنك تنزيل النسخة المشفرة لجهازك بالزر أدناه.');
          setIsLoadingPdf(false);
        });
    }

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
      setPdfBlobUrl(null);
    };
  }, [isOpen, file, currentUser]);

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
        await fileStorageService.downloadWatermarkedFile(
          {
            title: file.title,
            fileUrl: file.fileUrl,
            description: file.description,
            pagesCount: file.pagesCount,
          },
          currentUser
        );
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (e) {
      console.error('Download error in modal:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl h-[95vh] flex flex-col rounded-3xl bg-white dark:bg-[#0c1324] border border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* ===================================================================== */}
        {/* 1. Header الشامل للملف */}
        {/* ===================================================================== */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between gap-3 shrink-0">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 text-slate-950 flex items-center justify-center shrink-0 shadow-md">
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  {file.fileType === 'pdf'
                    ? 'مذكرة تأسيس شاملة'
                    : file.fileType === 'summary'
                    ? 'ملخص القوانين الذهبية'
                    : 'أوراق عمل تدريبية'}
                </span>

                {file.isFreePreview ? (
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>معاينة وتحميل مجاني 🎁</span>
                  </span>
                ) : hasAccess ? (
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>متاح باشتراكك ✅</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>يتطلب اشتراك كامل</span>
                  </span>
                )}

                {/* شارة التشفير الأمني باسم الطالب */}
                <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>نسخة مشفرة ومحمية باسم: {studentName}</span>
                </span>
              </div>

              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white line-clamp-1">
                {file.title}
              </h3>

              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>{file.pagesCount || '100+ صفحة'}</span>
                </span>
                <span>•</span>
                <span>{file.fileSize || 'PDF'}</span>
                <span>•</span>
                <span className="hidden sm:inline-flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>دفعة 1446-1447هـ (2025/2026)</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="فتح في شاشة كاملة"
              >
                <Maximize2 className="w-4 h-4" />
              </a>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 2. شريط التبويبات (تصفح الملف المباشر / الفهرس) */}
        {/* ===================================================================== */}
        <div className="px-3 sm:px-5 pt-2.5 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 bg-white dark:bg-[#0c1324] shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('viewer')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'viewer'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>تصفح صفحات الملف المباشرة 📄</span>
            </button>

            <button
              onClick={() => setActiveTab('chapters')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'chapters'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>فهرس ومحتوى المذكرة 📖</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>علامة مائية أمنية مدمجة بكل الصفحات ضد التسريب</span>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* 3. العرض المباشر للملف (PDF Viewer) */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-hidden p-2 sm:p-4 bg-slate-100/50 dark:bg-slate-950/40">
          {activeTab === 'viewer' ? (
            <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 flex flex-col">
              {isLoadingPdf ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-950 text-white">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold">جاري تجهيز وتشفير صفحات الملف ببياناتك الأمنية...</p>
                    <p className="text-xs text-slate-400">يتم وسم الصفحات باسم [{studentName}] والعلامة المائية المانعة للتسريب</p>
                  </div>
                </div>
              ) : pdfLoadError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 bg-slate-900 text-white">
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                  <p className="text-sm font-bold text-slate-200">{pdfLoadError}</p>
                  <button
                    onClick={handleDownload}
                    className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
                  >
                    تحميل الملف المشفر مباشرة 📥
                  </button>
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=1&navpanes=0&view=FitH`}
                  className="w-full h-full rounded-2xl border-0 bg-white dark:bg-slate-900"
                  title={file.title}
                />
              ) : null}
            </div>
          ) : (
            /* تبويب الفهرس والأبواب */
            <div className="w-full h-full overflow-y-auto p-4 space-y-4 bg-white dark:bg-[#0c1324] rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs sm:text-sm leading-relaxed">
                <div className="font-black flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                  <span>دليل طرقع التأسيسي الشامل لاختبار القدرات العامة (محوسب وورقي)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">
                  تم إعداد هذا المحتوى التدريبي وفق أحدث معايير المركز الوطني قياس وتجميعات عام 2025/2026 لضمان التأسيس من الصفر وحتى إتقان استراتيجيات الحل الخاطف في 30 ثانية.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
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
            </div>
          )}
        </div>

        {/* ===================================================================== */}
        {/* 4. Footer الإجراءات والتحميل المباشر للجهاز */}
        {/* ===================================================================== */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="line-clamp-1">
              {hasAccess
                ? `التحميل متاح فوراً لجهازك مع تشفير صفحات الملف باسمك (${studentName})`
                : 'اشترك الآن (75 ر.س/سنة) لتحميل النسخ المشفرة لجميع الملفات والمحاضرات'}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer flex-1 sm:flex-initial"
            >
              إغلاق
            </button>

            {hasAccess ? (
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black transition shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial active:scale-95 disabled:opacity-60"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تشفير وتنزيل الملف...</span>
                  </>
                ) : downloadSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                    <span>تم التحميل على جهازك بنجاح! 📥</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>تحميل الملف كاملاً على جهازك (PDF مشفر) 📥</span>
                  </>
                )}
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
                <span>تفعيل الاشتراك لتحميل الملف (75 ر.س/سنة) 🚀</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
