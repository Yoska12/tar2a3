import React, { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Plus, Trash2, Edit3, Image as ImageIcon, Link as LinkIcon, ExternalLink, Sparkles, X, Check, Upload, Eye, EyeOff } from 'lucide-react';
import { AdBannerItem, CourseItem } from '../types';
import { coursesStorage } from '../lib/subscriptionService';

interface AdBannerSliderProps {
  isEditor: boolean;
  courses: CourseItem[];
  onSelectCourse?: (courseId: string) => void;
}

export const AdBannerSlider: React.FC<AdBannerSliderProps> = ({
  isEditor,
  courses,
  onSelectCourse,
}) => {
  const [banners, setBanners] = useState<AdBannerItem[]>(() => coursesStorage.getBanners());
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState<'next' | 'prev'>('next');
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);

  // حالة نافذة إدارة الإعلانات للمشرف
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AdBannerItem | null>(null);
  const [bannerFormData, setBannerFormData] = useState<{
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;
    linkUrl: string;
    targetCourseId: string;
    isActive: boolean;
  }>({
    id: '',
    imageUrl: '',
    title: '',
    subtitle: '',
    linkUrl: '',
    targetCourseId: '',
    isActive: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);
  const progressTimerRef = useRef<any>(null);

  // الاستماع لتحديثات البنرات في الوقت الحقيقي
  useEffect(() => {
    const handleBannersChanged = (e: any) => {
      const incoming = e.detail || coursesStorage.getBanners();
      setBanners([...incoming]);
    };
    window.addEventListener('tarqa_ad_banners_changed', handleBannersChanged);
    return () => {
      window.removeEventListener('tarqa_ad_banners_changed', handleBannersChanged);
    };
  }, []);

  // البنرات النشطة المعروضة فقط
  const activeBanners = banners.filter((b) => b.isActive !== false && b.imageUrl && b.imageUrl.trim().length > 0);

  // ضبط المؤشر في حال تغير عدد البنرات
  useEffect(() => {
    if (currentIndex >= activeBanners.length && activeBanners.length > 0) {
      setCurrentIndex(0);
    }
  }, [activeBanners.length, currentIndex]);

  // مؤقت التبديل كل 5 ثوانٍ بتأثير تقليب الصفحة
  useEffect(() => {
    if (activeBanners.length <= 1 || isHovered || isManageModalOpen) {
      setProgress(0);
      return;
    }

    const INTERVAL_MS = 5000;
    const STEP_MS = 50;
    let elapsed = 0;

    progressTimerRef.current = setInterval(() => {
      elapsed += STEP_MS;
      const pct = Math.min(100, (elapsed / INTERVAL_MS) * 100);
      setProgress(pct);

      if (elapsed >= INTERVAL_MS) {
        elapsed = 0;
        triggerFlip('next');
      }
    }, STEP_MS);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [activeBanners.length, currentIndex, isHovered, isManageModalOpen]);

  const triggerFlip = (direction: 'next' | 'prev') => {
    if (isFlipping || activeBanners.length <= 1) return;
    setFlipDirection(direction);
    setIsFlipping(true);

    setTimeout(() => {
      setCurrentIndex((prev) => {
        if (direction === 'next') {
          return (prev + 1) % activeBanners.length;
        } else {
          return (prev - 1 + activeBanners.length) % activeBanners.length;
        }
      });
      setIsFlipping(false);
      setProgress(0);
    }, 600);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerFlip('next');
  };

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    triggerFlip('prev');
  };

  const handleBannerClick = (banner: AdBannerItem) => {
    if (banner.targetCourseId && onSelectCourse) {
      onSelectCourse(banner.targetCourseId);
    } else if (banner.linkUrl) {
      if (banner.linkUrl.startsWith('http')) {
        window.open(banner.linkUrl, '_blank', 'noopener,noreferrer');
      } else {
        window.location.href = banner.linkUrl;
      }
    }
  };

  // رفع صورة البانر من الجهاز وتحويلها إلى Data URL
  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 10 ميجابايت.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setBannerFormData((prev) => ({ ...prev, imageUrl: dataUrl }));
      }
    };
    reader.readAsDataURL(file);
  };

  const openAddBannerModal = () => {
    setEditingBanner(null);
    setBannerFormData({
      id: '',
      imageUrl: '',
      title: '',
      subtitle: '',
      linkUrl: '',
      targetCourseId: courses[0]?.id || 'course-foundation',
      isActive: true,
    });
    setIsManageModalOpen(true);
  };

  const openEditBannerModal = (banner: AdBannerItem) => {
    setEditingBanner(banner);
    setBannerFormData({
      id: banner.id,
      imageUrl: banner.imageUrl,
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      linkUrl: banner.linkUrl || '',
      targetCourseId: banner.targetCourseId || '',
      isActive: banner.isActive !== false,
    });
    setIsManageModalOpen(true);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerFormData.imageUrl || !bannerFormData.imageUrl.trim()) {
      alert('يرجى إضافة رابط صورة الإعلان أو رفع صورة من جهازك.');
      return;
    }

    if (editingBanner) {
      const updated = coursesStorage.updateBanner({
        ...editingBanner,
        imageUrl: bannerFormData.imageUrl.trim(),
        title: bannerFormData.title.trim(),
        subtitle: bannerFormData.subtitle.trim(),
        linkUrl: bannerFormData.linkUrl.trim(),
        targetCourseId: bannerFormData.targetCourseId || undefined,
        isActive: bannerFormData.isActive,
      });
      setBanners([...updated]);
    } else {
      const newBanner: AdBannerItem = {
        id: 'banner_' + Date.now(),
        imageUrl: bannerFormData.imageUrl.trim(),
        title: bannerFormData.title.trim(),
        subtitle: bannerFormData.subtitle.trim(),
        linkUrl: bannerFormData.linkUrl.trim(),
        targetCourseId: bannerFormData.targetCourseId || undefined,
        orderIndex: banners.length + 1,
        isActive: bannerFormData.isActive,
      };
      const updated = coursesStorage.addBanner(newBanner);
      setBanners([...updated]);
    }

    setIsManageModalOpen(false);
  };

  const handleDeleteBanner = (bannerId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الإعلان نهائياً من الموقع؟')) {
      const updated = coursesStorage.deleteBanner(bannerId);
      setBanners([...updated]);
      if (editingBanner?.id === bannerId) {
        setIsManageModalOpen(false);
      }
      setCurrentIndex((prev) => (prev >= updated.length ? Math.max(0, updated.length - 1) : prev));
    }
  };

  // الحالة عندما لا توجد أي إعلانات:
  // إذا لم يكن مشرفاً: لا يظهر شيء مطلقاً (حسب طلب المستخدم الصريح)
  // إذا كان مشرفاً: يظهر زر أنيق لإضافة أول إعلان أو إدارة المحفوظ
  if (activeBanners.length === 0) {
    if (!isEditor) {
      return null;
    }

    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-2">
        <div className="relative border-2 border-dashed border-sky-300/60 dark:border-amber-500/30 rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-br from-sky-500/5 via-amber-500/5 to-purple-500/5 backdrop-blur-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-2">
            قسم بنرات وإعلانات الدورات
          </h3>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
            لا توجد إعلانات معروضة حالياً. كمسؤول أو معلم، يمكنك رفع صور إعلانات لدوراتك التدريبية تتقلب تلقائياً كل 5 ثوانٍ بتأثير تقليب الصفحة.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={openAddBannerModal}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>إضافة إعلان / بانر ترويجي</span>
            </button>
            {banners.length > 0 && (
              <button
                onClick={() => setIsManageModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-bold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
              >
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>إدارة الإعلانات المحفوظة ({banners.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* نافذة إدارة الإعلانات */}
        {renderManageModal()}
      </div>
    );
  }

  const currentBanner = activeBanners[currentIndex] || activeBanners[0];
  const nextBanner = activeBanners[(currentIndex + 1) % activeBanners.length];

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-4">
      {/* شريط الإدارة للمشرف */}
      {isEditor && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>بنرات وإعلانات الدورات ({activeBanners.length} إعلانات نشطة)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleDeleteBanner(currentBanner.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="حذف هذا الإعلان نهائياً من الموقع"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف هذا الإعلان</span>
            </button>
            <button
              type="button"
              onClick={() => openEditBannerModal(currentBanner)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>تعديل هذا البانر</span>
            </button>
            <button
              type="button"
              onClick={openAddBannerModal}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة إعلان جديد</span>
            </button>
          </div>
        </div>
      )}

      {/* الحاوية ثلاثية الأبعاد لتأثير تقليب الصفحة 3D Page Turn */}
      <div
        className="relative group w-full rounded-3xl overflow-hidden shadow-2xl border border-sky-200/60 dark:border-amber-500/25 bg-slate-900 select-none"
        style={{ perspective: '1600px' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* أزرار الإدارة السريعة العائمة على البانر مباشرة للمشرف */}
        {isEditor && (
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteBanner(currentBanner.id);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/90 hover:bg-rose-600 text-white backdrop-blur-md border border-rose-400/40 transition flex items-center gap-1.5 shadow-lg cursor-pointer"
              title="حذف هذا الإعلان نهائياً من الموقع"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>حذف الإعلان 🗑️</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openEditBannerModal(currentBanner);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 transition flex items-center gap-1.5 shadow-lg cursor-pointer"
              title="تعديل هذا البانر"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>تعديل</span>
            </button>
          </div>
        )}
        {/* شاشة العرض مع تأثير تقليب الصفحة الفعلي */}
        <div
          onClick={() => handleBannerClick(currentBanner)}
          className={`relative w-full aspect-[21/9] sm:aspect-[24/9] max-h-[360px] min-h-[170px] sm:min-h-[240px] cursor-pointer overflow-hidden transition-all duration-700 ease-out`}
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipping
              ? flipDirection === 'next'
                ? 'rotateY(-12deg) scale(0.98)'
                : 'rotateY(12deg) scale(0.98)'
              : 'rotateY(0deg) scale(1)',
          }}
        >
          {/* الصورة الأساسية الحالية */}
          <img
            src={currentBanner.imageUrl}
            alt={currentBanner.title || 'إعلان الدورة'}
            className={`w-full h-full object-cover transition-all duration-700 ${
              isFlipping ? 'opacity-80 brightness-95' : 'opacity-100 brightness-100'
            }`}
            loading="eager"
          />

          {/* طبقة تدرج جمالية وقناع ظل الكتاب (Book spine shadow effect) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
          
          {/* محاكاة طية وتجعيد الصفحة عند التقليب */}
          {isFlipping && (
            <div
              className={`absolute inset-0 pointer-events-none transition-opacity duration-500 ${
                flipDirection === 'next'
                  ? 'bg-gradient-to-l from-black/50 via-white/10 to-transparent'
                  : 'bg-gradient-to-r from-black/50 via-white/10 to-transparent'
              }`}
            />
          )}

          {/* نصوص وتفاصيل البانر إن وجدت */}
          {(currentBanner.title || currentBanner.subtitle) && (
            <div className="absolute bottom-4 sm:bottom-6 right-4 sm:right-8 left-4 sm:left-8 text-right z-10 pointer-events-none">
              {currentBanner.title && (
                <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white drop-shadow-lg mb-1 leading-tight flex items-center gap-2">
                  <span>{currentBanner.title}</span>
                  {(currentBanner.targetCourseId || currentBanner.linkUrl) && (
                    <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 opacity-90 inline shrink-0" />
                  )}
                </h2>
              )}
              {currentBanner.subtitle && (
                <p className="text-xs sm:text-sm md:text-base text-slate-200 drop-shadow line-clamp-2 max-w-2xl">
                  {currentBanner.subtitle}
                </p>
              )}
            </div>
          )}

          {/* شريط تقدم الـ 5 ثوانٍ */}
          {activeBanners.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 overflow-hidden z-20">
              <div
                className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-400 transition-all duration-75 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* أزرار التنقل السابقة واللاحقة (تظهر عند الحوم أو دائماً على الجوال) */}
        {activeBanners.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              aria-label="الإعلان السابق"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition border border-white/20 opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 z-20"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            <button
              onClick={handleNext}
              aria-label="الإعلان التالي"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md flex items-center justify-center transition border border-white/20 opacity-80 group-hover:opacity-100 hover:scale-105 active:scale-95 z-20"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* مؤشرات النقاط السفلية (Indicators) */}
            <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-20 pointer-events-auto">
              {activeBanners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (idx !== currentIndex && !isFlipping) {
                      setFlipDirection(idx > currentIndex ? 'next' : 'prev');
                      setIsFlipping(true);
                      setTimeout(() => {
                        setCurrentIndex(idx);
                        setIsFlipping(false);
                        setProgress(0);
                      }, 500);
                    }
                  }}
                  className={`transition-all duration-300 rounded-full ${
                    idx === currentIndex
                      ? 'w-6 sm:w-8 h-2 bg-amber-400 shadow-md shadow-amber-400/50'
                      : 'w-2 h-2 bg-white/40 hover:bg-white/70'
                  }`}
                  aria-label={`الانتقال إلى الإعلان رقم ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* نافذة إدارة الإعلانات */}
      {renderManageModal()}
    </div>
  );

  function renderManageModal() {
    if (!isManageModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white dark:bg-[#13111C] border border-slate-200 dark:border-amber-500/30 rounded-3xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 relative text-right">
          
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-amber-500" />
              <span>{editingBanner ? 'تعديل الإعلان والبانر' : 'إضافة إعلان وبانر جديد'}</span>
            </h3>
            <button
              onClick={() => setIsManageModalOpen(false)}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSaveBanner} className="space-y-4">
            {/* 1. رفع الصورة أو إدخال الرابط */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                صورة الإعلان <span className="text-rose-500">*</span>
              </label>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={bannerFormData.imageUrl}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, imageUrl: e.target.value })}
                    placeholder="ضع رابط الصورة المباشر هنا (URL)..."
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shrink-0 transition"
                  >
                    <Upload className="w-4 h-4" />
                    <span>رفع من جهازي</span>
                  </button>
                </div>

                {/* معاينة الصورة المرفوعة */}
                {bannerFormData.imageUrl && (
                  <div className="relative rounded-2xl overflow-hidden aspect-[21/9] max-h-48 border border-slate-200 dark:border-slate-700 bg-slate-950">
                    <img
                      src={bannerFormData.imageUrl}
                      alt="معاينة الإعلان"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setBannerFormData({ ...bannerFormData, imageUrl: '' })}
                      className="absolute top-2 left-2 p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition backdrop-blur-sm"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 2. عنوان الإعلان */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                عنوان الإعلان الرئيسي (اختياري)
              </label>
              <input
                type="text"
                value={bannerFormData.title}
                onChange={(e) => setBannerFormData({ ...bannerFormData, title: e.target.value })}
                placeholder="مثال: دورة التأسيس الشاملة للقدرات 🎯"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 3. الوصف الإعلاني الفرعي */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                نص فرعي / وصف ترويجي (اختياري)
              </label>
              <input
                type="text"
                value={bannerFormData.subtitle}
                onChange={(e) => setBannerFormData({ ...bannerFormData, subtitle: e.target.value })}
                placeholder="مثال: خصم خاص وشامل المذكرة الكاملة PDF..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* 4. الربط بدورة معينة عند النقر */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                توجيه الطالب عند النقر على الإعلان
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">فتح صفحة دورة تدريبية:</label>
                  <select
                    value={bannerFormData.targetCourseId}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, targetCourseId: e.target.value, linkUrl: '' })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- بدون توجيه لدورة --</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">أو رابط خارجي / مخصص:</label>
                  <input
                    type="text"
                    value={bannerFormData.linkUrl}
                    onChange={(e) => setBannerFormData({ ...bannerFormData, linkUrl: e.target.value, targetCourseId: '' })}
                    placeholder="https://..."
                    dir="ltr"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* 5. حالة التفعيل */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="bannerActiveCheckbox"
                checked={bannerFormData.isActive}
                onChange={(e) => setBannerFormData({ ...bannerFormData, isActive: e.target.checked })}
                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 focus:ring-offset-0 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
              />
              <label htmlFor="bannerActiveCheckbox" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                تفعيل عرض هذا الإعلان للطلاب في شريط البنرات
              </label>
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
              {editingBanner ? (
                <button
                  type="button"
                  onClick={() => handleDeleteBanner(editingBanner.id)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 transition flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الإعلان</span>
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManageModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingBanner ? 'حفظ التعديلات' : 'إضافة الإعلان'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* قائمة جميع البنرات المسجلة */}
          {banners.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                <span>الإعلانات المحفوظة في الموقع ({banners.length})</span>
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-amber-500/30 transition text-xs"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={b.imageUrl}
                        alt=""
                        className="w-12 h-8 rounded-lg object-cover shrink-0 border border-slate-300 dark:border-slate-700"
                      />
                      <div className="truncate">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {b.title || 'إعلان بدون عنوان'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {b.targetCourseId ? `ربط بالدورة: ${courses.find(c => c.id === b.targetCourseId)?.title || b.targetCourseId}` : b.linkUrl || 'بدون رابط'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mr-2">
                      <button
                        type="button"
                        onClick={() => openEditBannerModal(b)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-amber-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                        title="تعديل"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteBanner(b.id)}
                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }
};
