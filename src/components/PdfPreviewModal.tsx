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
  Clock,
} from 'lucide-react';
import { CourseFileItem } from '../types';
import { fileStorageService, isMobileDevice, isIOSDevice } from '../lib/fileStorageService';

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
  const [downloadMessage, setDownloadMessage] = useState<{ text: string; isComplete?: boolean } | null>(null);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);

  // حالة الرابط المباشر للـ PDF والتحميل
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [preparedFile, setPreparedFile] = useState<File | null>(null);
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

  const hasAccess = Boolean(file?.isFreePreview || isSubscribed);

  // توليد وعرض الـ PDF المشفر باسم وبيانات الطالب عند فتح النافذة فقط لمن يملك حق الوصول
  useEffect(() => {
    let activeUrl: string | null = null;
    let isCancelled = false;

    if (isOpen && file) {
      setActiveTab('viewer');
      setDownloadSuccess(false);
      setPreparedFile(null);
      setPdfBlobUrl(null);

      // حظر أمني قاطع: إذا كان الملف متاحاً بالاشتراك والمستخدم غير مشترك، لا نقوم بجلب أو تحميل أي بايت من الـ PDF
      if (!hasAccess) {
        setIsLoadingPdf(false);
        setPdfLoadError(null);
        return;
      }

      setIsLoadingPdf(true);
      setPdfLoadError(null);

      fileStorageService
        .getWatermarkedPdfBlob(
          file.fileUrl,
          {
            title: file.title,
            description: file.description,
            pagesCount: file.pagesCount,
          },
          currentUser
        )
        .then((blob: Blob) => {
          if (!isCancelled) {
            const cleanBase = (file.title || 'مذكرة_طرقع_التعليمية')
              .replace(/[/\\?%*:|"<>#]/g, '-')
              .replace(/\s+/g, ' ')
              .trim();
            const safeName = cleanBase.toLowerCase().endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;
            const fileObj = new File([blob], safeName, { type: 'application/pdf', lastModified: Date.now() });
            const url = URL.createObjectURL(blob);
            activeUrl = url;
            setPreparedFile(fileObj);
            setPdfBlobUrl(url);
            setIsLoadingPdf(false);
          }
        })
        .catch((err: any) => {
          if (!isCancelled) {
            console.error('Error generating PDF preview:', err);
            setPdfLoadError('تعذر عرض الملف مباشرة داخل الإطار. يمكنك فتح الملف أو تنزيله لجهازك بالزر أدناه.');
            setIsLoadingPdf(false);
          }
        });
    }

    return () => {
      isCancelled = true;
      if (activeUrl) {
        setTimeout(() => URL.revokeObjectURL(activeUrl!), 120000);
      }
      setPdfBlobUrl(null);
      setPreparedFile(null);
    };
  }, [isOpen, file?.id, file?.fileUrl, currentUser?.id, currentUser?.email, isSubscribed, file?.isFreePreview]);

  if (!isOpen || !file) return null;

  const cleanBaseName = (file.title || 'مذكرة_طرقع_التعليمية')
    .replace(/[/\\?%*:|"<>#]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const safeFileName = cleanBaseName.toLowerCase().endsWith('.pdf') ? cleanBaseName : `${cleanBaseName}.pdf`;

  const handleDownload = async () => {
    if (!hasAccess) {
      if (onSubscribeClick) {
        onSubscribeClick();
      }
      setDownloadMessage({ text: 'هذا الملف متاح للمشتركين فقط 🔒 يرجى الاشتراك', isComplete: false });
      setTimeout(() => setDownloadMessage(null), 4000);
      return;
    }

    if (!pdfBlobUrl) return;
    setIsDownloading(true);
    setDownloadMessage(null);
    setShowFallbackBanner(false);

    try {
      if (onDownloadClick) {
        onDownloadClick(file);
      }

      // 1. لهواتف الآيفون حصراً عبر Web Share API
      if (
        isIOSDevice() &&
        preparedFile &&
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        navigator.canShare &&
        navigator.canShare({ files: [preparedFile] })
      ) {
        try {
          await navigator.share({
            files: [preparedFile],
            title: safeFileName,
            text: `مذكرة طرقع: ${file.title}`,
          });
          setDownloadMessage({ text: 'تم حفظ ومشاركة الملف بنجاح! 📥', isComplete: true });
          setTimeout(() => setDownloadMessage(null), 5000);
          setIsDownloading(false);
          return;
        } catch (shareErr: any) {
          if (shareErr?.name === 'AbortError') {
            setIsDownloading(false);
            return;
          }
          console.warn('Native iOS share dismissed or failed:', shareErr);
        }
      }

      // 2. لهواتف الآيفون إن لم تكن ميزة المشاركة مدعومة: فتح مباشر في سفاري لحفظه في الملفات
      if (isIOSDevice()) {
        const opened = window.open(pdfBlobUrl, '_blank');
        if (!opened) {
          setShowFallbackBanner(true);
          setDownloadMessage({ text: 'يرجى الضغط على "فتح في تبويب مستقل" لحفظ الملف في سفاري', isComplete: false });
        } else {
          setDownloadMessage({ text: 'تم فتح الملف، اضغط على زر المشاركة ثم "حفظ في الملفات"', isComplete: true });
          setTimeout(() => setDownloadMessage(null), 6000);
        }
        setIsDownloading(false);
        return;
      }

      // 3. لأجهزة الأندرويد والكمبيوتر: إذا كان الملف رابط خارجي مباشر يتم استخدام مسار التنزيل الموثوق
      if (file.fileUrl && (file.fileUrl.startsWith('http://') || file.fileUrl.startsWith('https://')) && !file.fileUrl.startsWith('blob:')) {
        const proxyUrl = file.fileUrl.includes('supabase.co')
          ? `${file.fileUrl}?download=${encodeURIComponent(safeFileName)}`
          : `/api/download?url=${encodeURIComponent(file.fileUrl)}&filename=${encodeURIComponent(safeFileName)}`;
        window.location.assign(proxyUrl);
        setDownloadMessage({ text: 'جاري بدء التنزيل... تفقد شريط إشعارات هاتفك 📥', isComplete: false });
        setShowFallbackBanner(true);
        setTimeout(() => setDownloadMessage(null), 6000);
        setIsDownloading(false);
        return;
      }

      // 4. لأجهزة الأندرويد والكمبيوتر مع ملفات Blob المحلية
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = pdfBlobUrl;
      a.download = safeFileName;
      a.setAttribute('download', safeFileName);
      document.body.appendChild(a);
      try {
        a.click();
      } catch (e) {
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
        a.dispatchEvent(evt);
      }
      setTimeout(() => {
        try {
          if (document.body.contains(a)) document.body.removeChild(a);
        } catch (e) {}
      }, 1000);

      setDownloadMessage({ text: 'جاري بدء التنزيل... تفقد إشعارات التنزيل في هاتفك 📥', isComplete: false });
      setShowFallbackBanner(true);
      setTimeout(() => setDownloadMessage(null), 6000);
    } catch (e) {
      console.error('Download error in modal:', e);
      setShowFallbackBanner(true);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-5xl h-[95vh] flex flex-col rounded-3xl tarqa-glass-hero backdrop-blur-2xl shadow-[0_20px_60px_rgba(14,165,233,0.15)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.2)] overflow-hidden transition-all"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* ===================================================================== */}
        {/* 1. Header الشامل للملف */}
        {/* ===================================================================== */}
        <div className="p-3.5 sm:p-5 border-b border-sky-100 dark:border-amber-500/20 bg-sky-50/60 dark:bg-[#120a1c]/70 flex items-start justify-between gap-3 shrink-0">
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
            {hasAccess && pdfBlobUrl && (
              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className="px-2.5 sm:px-3 py-1.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer flex items-center gap-1.5 text-xs font-black shadow-sm active:scale-95 disabled:opacity-50"
                title="حفظ وتنزيل المذكرة على جهازك"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="inline">{downloadSuccess ? 'تم الحفظ ✅' : 'حفظ 💾'}</span>
              </button>
            )}

            {hasAccess && pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noopener"
                className="p-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-600 dark:text-slate-300 transition cursor-pointer"
                title="فتح في شاشة كاملة / تبويب مستقل"
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
            !hasAccess ? (
              <div className="w-full h-full relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-slate-900 via-slate-950 to-black flex flex-col items-center justify-center p-6 text-center space-y-5">
                <div className="relative">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border-2 border-amber-500/40 flex items-center justify-center text-amber-500 shadow-2xl shadow-amber-500/10">
                    <Lock className="w-10 h-10" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center shadow-md">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                </div>

                <div className="space-y-2 max-w-md">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 text-xs font-black">
                    <Lock className="w-3.5 h-3.5" />
                    <span>محتوى محمي ومتاح للمشتركين فقط</span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    معاينة وتصفح هذا الملف تتطلب اشتراكاً نشطاً 🔒
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    ملف <strong className="text-amber-400">"{file.title}"</strong> وجميع المذكرات والملخصات التأسيسية الشاملة متاحة حصرياً لطلاب باقة طرقع المشتركين.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm pt-2">
                  <button
                    onClick={() => {
                      if (onSubscribeClick) {
                        onSubscribeClick();
                      } else {
                        alert('الاشتراك سيكون متاحاً قريباً جداً فور تدشين وتفعيل بوابة الدفع الإلكتروني! ⏳');
                      }
                    }}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Clock className="w-4 h-4" />
                    <span>الاشتراك متاح قريباً ⏳</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('chapters')}
                    className="w-full sm:w-auto py-3.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    <span>فهرس المذكرة 📖</span>
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-[11px] text-slate-400 flex items-center gap-2 max-w-sm">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>يشمل الاشتراك المذكرات التأسيسية، بنوك الأسئلة، والتحميل والطباعة.</span>
                </div>
              </div>
            ) : (
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
                <div className="w-full h-full relative flex flex-col">
                  {/* شريط أدوات سريع أعلى شاشة القراءة */}
                  <div className="px-3 sm:px-4 py-2 bg-slate-800/95 text-slate-300 text-xs flex items-center justify-between border-b border-slate-700 shrink-0">
                    <span className="flex items-center gap-2 font-bold text-slate-200 min-w-0">
                      <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                      <span className="truncate">{file.title}</span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={pdfBlobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-amber-400 font-bold flex items-center gap-1 transition text-[11px] sm:text-xs"
                        title="فتح في تبويب خارجي مستقل"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>شاشة كاملة ↗</span>
                      </a>
                      {!hasAccess ? (
                        <button
                          onClick={() => {
                            if (onSubscribeClick) onSubscribeClick();
                            else alert('الاشتراك في الباقة سيكون متاحاً قريباً جداً فور تدشين بوابة الدفع! ⏳');
                          }}
                          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/30 font-bold flex items-center gap-1 transition text-[11px] sm:text-xs shadow-sm cursor-pointer"
                          title="الاشتراك متاح قريباً"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>الاشتراك قريباً ⏳</span>
                        </button>
                      ) : (
                        <button
                          onClick={handleDownload}
                          disabled={isDownloading || !pdfBlobUrl}
                          className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1 transition text-[11px] sm:text-xs shadow-sm cursor-pointer disabled:opacity-50"
                          title="تحميل الملف مباشرة على جهازك"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل 📥</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* عارض الـ PDF المتجاوب مع مختلف الأنظمة */}
                  <div className="flex-1 w-full relative bg-slate-900 overflow-hidden flex flex-col">
                    {/* واجهة مخصصة لشاشات الموبايل (حل مشكلة عدم فتح الـ iframe على الآيفون والأندرويد) */}
                    <div className="md:hidden flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4 bg-gradient-to-b from-slate-900 to-slate-950 text-white overflow-y-auto">
                      <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shrink-0">
                        <FileText className="w-8 h-8" />
                      </div>

                      <div className="space-y-1.5 max-w-sm">
                        <h3 className="text-sm sm:text-base font-black text-white line-clamp-2">{file.title}</h3>
                        <p className="text-[11px] text-slate-400">
                          نسخة مشفرة ومختومة أمنياً باسمك ({studentName})
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1 text-xs text-amber-400 font-bold">
                          <span>{file.pagesCount || '100+ صفحة'}</span>
                          <span>•</span>
                          <span>{file.fileSize || 'PDF'}</span>
                        </div>
                      </div>

                      <div className="w-full max-w-xs space-y-2.5 pt-1">
                        {!hasAccess ? (
                          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-3">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
                              <Lock className="w-6 h-6" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs sm:text-sm font-black text-white">تحميل المذكرة الكاملة متاح قريباً ⏳</h4>
                              <p className="text-[11px] text-slate-300">الاشتراك وتنزيل كافة المذكرات سيكون متاحاً قريباً جداً فور تدشين بوابة الدفع</p>
                            </div>
                            <button
                              onClick={onSubscribeClick}
                              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-400 font-black text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Clock className="w-4 h-4 animate-pulse" />
                              <span>الاشتراك متاح قريباً ⏳</span>
                            </button>
                          </div>
                        ) : (
                          <>
                            {isIOSDevice() ? (
                              <div className="space-y-2 w-full">
                                {preparedFile && typeof navigator !== 'undefined' && 'share' in navigator && (
                                  <button
                                    type="button"
                                    onClick={handleDownload}
                                    disabled={!pdfBlobUrl || isLoadingPdf || isDownloading}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                                  >
                                    {isDownloading ? (
                                      <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>جاري الحفظ والمشاركة...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Download className="w-4 h-4" />
                                        <span>حفظ في تطبيق الملفات (iOS) 📥</span>
                                      </>
                                    )}
                                  </button>
                                )}

                                {pdfBlobUrl && (
                                  <a
                                    href={pdfBlobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => {
                                      if (onDownloadClick) onDownloadClick(file);
                                    }}
                                    className="w-full py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-400 font-bold text-xs border border-amber-500/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>فتح في سفاري ثم حفظ في الملفات 📱</span>
                                  </a>
                                )}
                              </div>
                            ) : (
                              /* هواتف الأندرويد والتابلت */
                              <div className="space-y-2 w-full">
                                {file.fileUrl && (file.fileUrl.startsWith('http://') || file.fileUrl.startsWith('https://')) && !file.fileUrl.startsWith('blob:') ? (
                                  <a
                                    href={file.fileUrl.includes('supabase.co')
                                      ? `${file.fileUrl}?download=${encodeURIComponent(safeFileName)}`
                                      : `/api/download?url=${encodeURIComponent(file.fileUrl)}&filename=${encodeURIComponent(safeFileName)}`
                                    }
                                    download={safeFileName}
                                    onClick={() => {
                                      if (onDownloadClick) onDownloadClick(file);
                                    }}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>تنزيل الملف لجهازك (Android) 📥</span>
                                  </a>
                                ) : pdfBlobUrl ? (
                                  <a
                                    href={pdfBlobUrl}
                                    download={safeFileName}
                                    onClick={() => {
                                      if (onDownloadClick) onDownloadClick(file);
                                    }}
                                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span>تنزيل الملف لجهازك (Android) 📥</span>
                                  </a>
                                ) : (
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full py-3.5 px-4 rounded-2xl bg-slate-800 text-slate-400 font-bold text-xs flex items-center justify-center gap-2"
                                  >
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                    <span>جاري تجهيز صفحات المذكرة...</span>
                                  </button>
                                )}

                                {pdfBlobUrl && (
                                  <a
                                    href={pdfBlobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                                    <span>فتح وتصفح المذكرة بالمتصفح 👁️</span>
                                  </a>
                                )}
                              </div>
                            )}

                            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-[11px] leading-relaxed text-slate-300 text-right space-y-1">
                              <p>
                                🍏 <strong>لمستخدمي الآيفون:</strong> اضغط على <strong>(حفظ في تطبيق الملفات)</strong> أو افتح في سفاري واختر <strong>"حفظ في الملفات" (Save to Files)</strong>.
                              </p>
                              <p>
                                🤖 <strong>لمستخدمي الأندرويد:</strong> اضغط على <strong>(تنزيل الملف لجهازك)</strong> وسيبدأ التنزيل الفعلي مباشرة في مجلد التحميلات (Downloads).
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* عارض الشاشات الكبيرة والكمبيوتر */}
                    <div className="hidden md:block flex-1 w-full h-full relative">
                      <object
                        data={pdfBlobUrl}
                        type="application/pdf"
                        className="w-full h-full rounded-b-2xl"
                      >
                        <iframe
                          src={pdfBlobUrl}
                          className="w-full h-full border-0 rounded-b-2xl bg-white dark:bg-slate-900"
                          title={file.title}
                        />
                      </object>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            )
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
        {/* شريط المساعدة الإضافي للتحميل على الموبايل عند الحاجة */}
        {/* ===================================================================== */}
        {showFallbackBanner && pdfBlobUrl && (
          <div className="p-2.5 px-4 bg-amber-500/10 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-700 dark:text-amber-300 shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>إذا لم يبدأ التنزيل تلقائياً في هاتفك:</span>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={pdfBlobUrl}
                download={safeFileName}
                className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition cursor-pointer"
              >
                تنزيل مباشر 💾
              </a>
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noopener"
                className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-300 transition cursor-pointer"
              >
                فتح لحفظه 👁️
              </a>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 4. Footer الإجراءات والتحميل المباشر للجهاز */}
        {/* ===================================================================== */}
        <div className="p-3 sm:p-4 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/90 dark:bg-slate-900/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
            {hasAccess ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="line-clamp-1">
                  التحميل متاح فوراً لجهازك مع تشفير صفحات الملف باسمك ({studentName})
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="line-clamp-1">
                  معاينة وتنزيل هذا الملف متاحة حصرياً لمشتركي باقة طرقع 🔒
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer flex-1 sm:flex-initial"
            >
              إغلاق
            </button>

            {hasAccess && pdfBlobUrl && (
              <a
                href={pdfBlobUrl}
                target="_blank"
                rel="noopener"
                className="px-3.5 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-300 transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 active:scale-95"
                title="فتح الملف في تبويب مستقل للموبايل والآيفون"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>فتح في تبويب مستقل 👁️</span>
              </a>
            )}

            {!hasAccess ? (
              <button
                onClick={() => {
                  if (onSubscribeClick) onSubscribeClick();
                  else alert('الاشتراك في الباقة سيكون متاحاً قريباً جداً فور تدشين بوابة الدفع! ⏳');
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 border border-amber-500/40 hover:bg-amber-500/30 text-amber-500 dark:text-amber-400 text-xs sm:text-sm font-black transition shadow-sm flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial active:scale-95"
              >
                <Clock className="w-4 h-4" />
                <span>الاشتراك متاح قريباً ⏳</span>
              </button>
            ) : (
              <button
                onClick={handleDownload}
                disabled={isDownloading || !pdfBlobUrl}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs sm:text-sm font-black transition shadow-md hover:shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer flex-1 sm:flex-initial active:scale-95 disabled:opacity-60"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تحضير التنزيل...</span>
                  </>
                ) : downloadMessage ? (
                  <>
                    {downloadMessage.isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                    ) : (
                      <Download className="w-4 h-4 text-slate-950" />
                    )}
                    <span>{downloadMessage.text}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>تحميل / حفظ الملف (PDF) 📥</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
