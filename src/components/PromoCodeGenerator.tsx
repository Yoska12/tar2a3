import React, { useState, useEffect } from 'react';
import {
  Tag,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
  Calendar,
  Layers,
  Users,
  Percent,
  Coins,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  Search,
  Filter
} from 'lucide-react';
import {
  courseCommerceService,
  PromoCodeItem,
} from '../lib/courseCommerceService';
import { CourseItem } from '../types';

interface PromoCodeGeneratorProps {
  courses?: CourseItem[];
  compact?: boolean;
}

export const PromoCodeGenerator: React.FC<PromoCodeGeneratorProps> = ({
  courses = [],
  compact = false,
}) => {
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'percentage' | 'fixed'>('all');

  // نموذج إنشاء الكود
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [maxUses, setMaxUses] = useState<number>(50);
  const [courseId, setCourseId] = useState<string>('all');
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // جلب الأكواد مباشرة من قاعدة بيانات السيرفر
  const fetchCodes = async () => {
    setIsLoading(true);
    try {
      const data = await courseCommerceService.getPromoCodes();
      setPromoCodes(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCodes();
  }, []);

  // دالة توليد كود خصم عشوائي مميز
  const generateRandomCode = () => {
    const prefixes = ['TARQA', 'QDRAT', 'TOP', 'VIP', 'SUCCESS', 'DISCOUNT'];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digits
    const generated = `${randomPrefix}${discountType === 'percentage' ? discountValue : ''}_${randomSuffix}`;
    setCode(generated.toUpperCase());
  };

  // نسخ الكود للحافظة
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    showToast(`تم نسخ الكود (${text}) إلى الحافظة! 📋`);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  // حفظ الكود الجديد في قاعدة البيانات
  const handleSavePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      alert('يرجى إدخال رمز الكود أو الضغط على "توليد كود عشوائي"');
      return;
    }

    if (discountValue <= 0) {
      alert('قيمة الخصم يجب أن تكون أكبر من صفر');
      return;
    }

    if (discountType === 'percentage' && discountValue > 100) {
      alert('نسبة الخصم المئوية لا يمكن أن تتجاوز 100%');
      return;
    }

    setIsSaving(true);
    const result = await courseCommerceService.savePromoCode({
      code: cleanCode,
      discount_type: discountType,
      discount_value: Number(discountValue),
      max_uses: Number(maxUses) || 100,
      course_id: courseId === 'all' ? null : courseId,
      expires_at: expiresAt ? `${expiresAt} 23:59:59` : null,
      is_active: isActive ? 1 : 0,
    });
    setIsSaving(false);

    if (result.success) {
      showToast(result.message || 'تم حفظ كود الخصم في قاعدة البيانات بنجاح! 💾✅');
      setCode('');
      setDiscountValue(20);
      setMaxUses(50);
      setExpiresAt('');
      fetchCodes();
    } else {
      alert(result.message || 'حدث خطأ أثناء حفظ كود الخصم في السيرفر');
    }
  };

  // تبديل تفعيل الكود في قاعدة البيانات
  const handleToggleActive = async (item: PromoCodeItem) => {
    const newStatus = Number(item.is_active) === 1 ? 0 : 1;
    await courseCommerceService.savePromoCode({
      ...item,
      is_active: newStatus,
    });
    showToast(newStatus === 1 ? `تم تفعيل الكود (${item.code}) ✅` : `تم إيقاف الكود (${item.code}) ⏸️`);
    fetchCodes();
  };

  // حذف الكود نهائياً من قاعدة البيانات
  const handleDeleteCode = async (idOrCode: string, codeName: string) => {
    if (window.confirm(`هل أنت متأكد من حذف كود الخصم "${codeName}" نهائياً من قاعدة البيانات؟`)) {
      const ok = await courseCommerceService.deletePromoCode(idOrCode);
      if (ok) {
        showToast(`تم حذف الكود "${codeName}" بنجاح 🗑️`);
        fetchCodes();
      } else {
        alert('تعذر حذف الكود من قاعدة البيانات');
      }
    }
  };

  // إحصائيات سريعة
  const totalActive = promoCodes.filter((c) => Number(c.is_active) === 1).length;
  const totalUses = promoCodes.reduce((acc, curr) => acc + (Number(curr.used_count) || 0), 0);

  // تصفية الأكواد للبحث
  const filteredCodes = promoCodes.filter((c) => {
    const matchSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.course_id && c.course_id.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchSearch) return false;

    if (filterType === 'active') return Number(c.is_active) === 1;
    if (filterType === 'percentage') return c.discount_type === 'percentage';
    if (filterType === 'fixed') return c.discount_type === 'fixed';
    return true;
  });

  return (
    <div className="space-y-6 text-right">
      {/* إشعار عائم Toast */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm animate-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* رأس الصفحة مع الشارة الأمنية */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-500/20 shrink-0">
            <Tag className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white flex items-center gap-2">
              <span>مولّد وإدارة أكواد الخصم والكوبونات</span>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold">
                MySQL Backend 🔒
              </span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              جميع الأكواد تُحسب وتُحقّق على السيرفر مباشرة ولا تظهر أو تُخزّن بشكل مكشوف في الفرونت إند إطلاقاً.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchCodes}
          disabled={isLoading}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 self-end md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isLoading ? 'animate-spin' : ''}`} />
          <span>تحديث من الداتابيز</span>
        </button>
      </div>

      {/* بطاقات الإحصائيات السريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">إجمالي الأكواد في الداتابيز</span>
            <span className="text-2xl font-black text-white font-mono">{promoCodes.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">الأكواد النشطة والفعّالة</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{totalActive}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs text-slate-400 font-bold block mb-1">مرات استخدام الطلاب للكوبونات</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{totalUses}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* قسم توليد وإنشاء كود خصم جديد */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h3 className="font-black text-base">إنشاء وتوليد كود خصم مخصص 🎟️</h3>
          </div>
          <button
            type="button"
            onClick={generateRandomCode}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-400 font-black text-xs transition flex items-center gap-2 cursor-pointer self-start sm:self-auto"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>توليد كود عشوائي بنقرة 🎲</span>
          </button>
        </div>

        <form onSubmit={handleSavePromo} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* رمز الكود */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                رمز الكود (Promo Code) <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="مثال: TARQA30"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm tracking-wider uppercase focus:border-amber-500 outline-none"
                />
              </div>
            </div>

            {/* نوع الخصم */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">نوع الخصم</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    discountType === 'percentage'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>نسبة مئوية (%)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('fixed')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    discountType === 'fixed'
                      ? 'bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  <span>مبلغ نقدي ثابت</span>
                </button>
              </div>
            </div>

            {/* قيمة الخصم */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                قيمة الخصم ({discountType === 'percentage' ? '%' : 'ريال / جنيه'}) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="1"
                max={discountType === 'percentage' ? 100 : 5000}
                required
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:border-amber-500 outline-none"
              />
            </div>

            {/* عدد المستخدمين المسموح لهم بالاستخدام (Max Uses) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-300">
                  عدد المستخدمين المسموح لهم بالاستخدام (الحد الأقصى)
                </label>
              </div>
              <input
                type="number"
                min="1"
                max="999999"
                required
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-mono font-bold text-sm focus:border-amber-500 outline-none"
              />
              <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px]">
                <span className="text-slate-500">خيارات سريعة:</span>
                {[1, 5, 20, 100, 500, 999999].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setMaxUses(cnt)}
                    className={`px-2 py-0.5 rounded-lg border cursor-pointer font-mono font-bold ${
                      maxUses === cnt
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {cnt === 999999 ? 'غير محدود ∞' : `${cnt} طلاب`}
                  </button>
                ))}
              </div>
            </div>

            {/* الدورة المستهدفة */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">الدورة المستهدفة</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-bold focus:border-amber-500 outline-none cursor-pointer"
              >
                <option value="all">🌟 جميع الدورات التدريبية في المنصة (شامل)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            {/* تاريخ انتهاء الصلاحية */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                تاريخ انتهاء الصلاحية (اختياري)
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono font-bold focus:border-amber-500 outline-none cursor-pointer"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer self-start sm:self-auto text-xs font-bold text-slate-300">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-amber-500 accent-amber-500"
              />
              <span>تفعيل الكود فوراً في قاعدة البيانات</span>
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 hover:from-amber-400 hover:to-yellow-400 transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ في الداتابيز...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>حفظ ونشر كود الخصم في قاعدة البيانات 💾</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* شريط البحث وتصفية الأكواد */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث عن رمز الكود..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pr-10 pl-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'active', label: 'النشطة فقط' },
            { id: 'percentage', label: 'نسب مئوية %' },
            { id: 'fixed', label: 'مبالغ نقدية' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                filterType === tab.id
                  ? 'bg-amber-500 text-slate-950 font-black'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* جدول وبطاقات الأكواد المسجلة في السيرفر */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Tag className="w-4 h-4 text-amber-500" />
            <span>سجل أكواد الخصم النشطة في قاعدة البيانات ({filteredCodes.length})</span>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-xs">جاري جلب أحدث الأكواد من قاعدة بيانات السيرفر...</p>
          </div>
        ) : filteredCodes.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <Tag className="w-12 h-12 mx-auto text-slate-600" />
            <p className="text-sm font-bold text-slate-300">لا توجد أكواد خصم مسجلة مطابقة للبحث</p>
            <p className="text-xs text-slate-500">استخدم النموذج أعلاه لتوليد أول كود خصم لمنصتك.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredCodes.map((item) => {
              const uses = Number(item.used_count) || 0;
              const max = Number(item.max_uses) || 100;
              const isExpired = item.expires_at && new Date(item.expires_at) < new Date();
              const isDepleted = uses >= max;
              const isEnabled = Number(item.is_active) === 1 && !isExpired && !isDepleted;

              // نسبة الاستهلاك
              const usagePercent = Math.min(100, Math.round((uses / max) * 100));

              return (
                <div
                  key={item.id || item.code}
                  className="p-4 sm:p-5 hover:bg-slate-800/40 transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    {/* رمز الكود وشارة الخصم */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="text-base sm:text-lg font-black font-mono tracking-wider text-amber-400 bg-amber-500/10 px-3 py-1 rounded-xl border border-amber-500/25">
                        {item.code}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleCopyCode(item.code)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                        title="نسخ الكود"
                      >
                        {copiedCode === item.code ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-black">
                        {item.discount_type === 'percentage'
                          ? `خصم ${item.discount_value}%`
                          : `خصم ${item.discount_value} ر.س / ج.م`}
                      </span>

                      {isEnabled ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold">
                          نشط ومتاح للطلاب
                        </span>
                      ) : isExpired ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-bold">
                          منتهي الصلاحية ⏳
                        </span>
                      ) : isDepleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[10px] font-bold">
                          نفدت مرات الاستخدام 🛑
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-bold">
                          معطل مؤقتاً ⏸️
                        </span>
                      )}
                    </div>

                    {/* تفاصيل الصلاحية والدورة وعدد مرات الاستخدام */}
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400">
                      <span>
                        الدورة:{' '}
                        <strong className="text-slate-200">
                          {item.course_id
                            ? courses.find((c) => c.id === item.course_id)?.title || item.course_id
                            : 'جميع الدورات التدريبية 🌟'}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        انتهاء الصلاحية:{' '}
                        <strong className="text-slate-200">
                          {item.expires_at ? item.expires_at.split(' ')[0] : 'صالح دائماً ∞'}
                        </strong>
                      </span>
                    </div>

                    {/* شريط استهلاك عدد المستخدمين */}
                    <div className="max-w-xs space-y-1 pt-1">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-slate-400">مرات الاستخدام الفعلية:</span>
                        <span className="font-bold text-white">
                          {uses} من {max >= 999999 ? 'غير محدود ∞' : max} طالب
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isDepleted
                              ? 'bg-rose-500'
                              : usagePercent > 75
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${max >= 999999 ? Math.min(100, uses * 2) : usagePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* أزرار الإجراءات السريعة (تفعيل/إيقاف، حذف) */}
                  <div className="flex items-center gap-2 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(item)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        Number(item.is_active) === 1
                          ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      }`}
                    >
                      {Number(item.is_active) === 1 ? 'تعطيل الكود ⏸️' : 'تفعيل الكود ▶️'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCode(item.id || item.code, item.code)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition cursor-pointer"
                      title="حذف الكود نهائياً"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

