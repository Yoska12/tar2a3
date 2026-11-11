import React, { useState, useEffect } from 'react';
import {
  X,
  Tag,
  DollarSign,
  Receipt,
  Settings,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Save,
  Loader2,
  RefreshCw,
  Search,
  Calendar,
  Layers,
  CheckCircle2,
  Coins,
  Zap
} from 'lucide-react';
import { CourseItem } from '../types';
import { PromoCodeGenerator } from './PromoCodeGenerator';
import {
  courseCommerceService,
  CoursePriceItem,
  PromoCodeItem,
  PaymentReceipt,
  ReceiptSettings,
} from '../lib/courseCommerceService';
import { rolesService } from '../lib/rolesService';

export interface CoursePricingAndPromoAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CourseItem[];
}

export const CoursePricingAndPromoAdminModal: React.FC<CoursePricingAndPromoAdminModalProps> = ({
  isOpen,
  onClose,
  courses,
}) => {
  const [activeTab, setActiveTab] = useState<'promo' | 'pricing' | 'receipts' | 'settings'>('promo');

  // بيانات البرومو كودز
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [isLoadingPromo, setIsLoadingPromo] = useState(false);

  // بيانات تسعير الدورات
  const [pricingList, setPricingList] = useState<Record<string, { priceSar: number; priceEg: number; title: string }>>({});
  const [isSavingPricing, setIsSavingPricing] = useState<string | null>(null);

  // سجل الإيصالات
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [isLoadingReceipts, setIsLoadingReceipts] = useState(false);
  const [receiptSearch, setReceiptSearch] = useState('');

  // إعدادات الإيصالات (واتساب وإيميل)
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    admin_whatsapp: '966500000000',
    admin_email: 'tarqa.qudurat@gmail.com',
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // تحميل البيانات الأولية
  const loadAllData = async () => {
    setIsLoadingPromo(true);
    setIsLoadingReceipts(true);

    try {
      // 1. جلب الكوبونات
      const codes = await courseCommerceService.getPromoCodes();
      setPromoCodes(codes);

      // 2. جلب الأسعار من الداتابيز
      const prices = await courseCommerceService.getCoursePricing();
      const pMap: Record<string, { priceSar: number; priceEg: number; title: string }> = {};

      courses.forEach((c) => {
        const found = prices.find((p) => p.course_id === c.id);
        pMap[c.id] = {
          priceSar: found ? Number(found.price_sar) : (c.priceSar || 75),
          priceEg: found ? Number(found.price_egp) : (c.priceEg || 1100),
          title: c.title,
        };
      });
      setPricingList(pMap);

      // 3. جلب الإيصالات
      const rcpts = await courseCommerceService.getPaymentReceipts();
      setReceipts(rcpts);

      // 4. جلب إعدادات الإشعار
      const st = await courseCommerceService.getReceiptSettings();
      setReceiptSettings(st);
    } finally {
      setIsLoadingPromo(false);
      setIsLoadingReceipts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // حفظ سعر دورة معينة في قاعدة البيانات
  const handleSaveCoursePrice = async (courseId: string) => {
    const data = pricingList[courseId];
    if (!data) return;

    setIsSavingPricing(courseId);
    const ok = await courseCommerceService.updateCoursePrice(
      courseId,
      data.title,
      Number(data.priceSar),
      Number(data.priceEg)
    );
    setIsSavingPricing(null);

    if (ok) {
      showToast(`تم تحديث سعر (${data.title}) في قاعدة البيانات بنجاح! 💾✅`);
    } else {
      alert('تعذر حفظ السعر في قاعدة البيانات');
    }
  };

  // تفعيل يدوي لاشتراك إنستاباي بعد مراجعة المشرف للإيصال
  const [activatingReceiptId, setActivatingReceiptId] = useState<string | null>(null);

  const handleActivateReceipt = async (rcpt: PaymentReceipt) => {
    if (!rcpt.user_id && !rcpt.user_email) {
      alert('بيانات الطالب غير مكتملة');
      return;
    }
    const idKey = rcpt.id || rcpt.order_id;
    setActivatingReceiptId(idKey);
    try {
      await rolesService.grantSubscription(
        {
          id: rcpt.user_id || 'usr_' + Date.now(),
          email: rcpt.user_email,
          fullName: rcpt.user_name,
        },
        365
      );

      // تحديث حالة الفاتورة في السيرفر
      await fetch('/api/hostinger_api.php?action=update_course_subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: rcpt.user_id,
          course_id: rcpt.course_id,
          is_active: 1,
        }),
      }).catch(() => {});

      setReceipts((prev) =>
        prev.map((r) =>
          (r.id === rcpt.id || r.order_id === rcpt.order_id)
            ? { ...r, payment_status: 'PAID' }
            : r
        )
      );
      showToast(`تم التفعيل اليدوي لاشتراك (${rcpt.user_name}) بنجاح! 🎓✅`);
    } catch (err: any) {
      alert('حدث خطأ أثناء التفعيل اليدوي: ' + (err?.message || 'تعذر الاتصال'));
    } finally {
      setActivatingReceiptId(null);
    }
  };

  // حفظ إعدادات الواتساب والإيميل
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    const ok = await courseCommerceService.saveReceiptSettings(receiptSettings);
    setIsSavingSettings(false);
    if (ok) {
      showToast('تم حفظ إعدادات إرسال الإيصالات والواتساب بنجاح! 📱✅');
    } else {
      alert('تعذر حفظ الإعدادات');
    }
  };

  const filteredReceipts = receipts.filter(
    (r) =>
      r.order_id?.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.user_name?.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.course_title?.toLowerCase().includes(receiptSearch.toLowerCase()) ||
      r.promo_code?.toLowerCase().includes(receiptSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="relative w-[95%] max-w-5xl my-auto bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-7 text-white shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* شريط الإشعار العلوي (Toast) */}
        {toastMessage && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-slate-950 font-black px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs sm:text-sm animate-in slide-in-from-top-4">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* رأس النافذة */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">إدارة تسعير الدورات والكوبونات والإيصالات 🎟️⚙️</h3>
              <p className="text-slate-400 text-xs">تحكم كامل مربوط بالباك إند وقاعدة البيانات مباشرة</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* التبويبات الأربعة */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('promo')}
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'promo'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>أكواد الخصم والكوبونات ({promoCodes.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pricing')}
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'pricing'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>تسعير الدورات في الداتابيز</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receipts')}
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'receipts'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>سجل الفواتير والإيصالات ({receipts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-2.5 px-4 rounded-xl flex items-center gap-2 transition cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>إعدادات الواتساب والإيميل</span>
          </button>
        </div>

        {/* 1. تبويب أكواد الخصم والكوبونات (مربوط بقاعدة البيانات مباشرة) */}
        {activeTab === 'promo' && (
          <PromoCodeGenerator courses={courses} />
        )}

        {/* 2. تبويب تسعير الدورات في قاعدة البيانات */}
        {activeTab === 'pricing' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
              💡 <strong>تنويه أمني هام:</strong> الأسعار المحددة هنا تُحفظ مباشرة في جدول <code className="font-mono bg-black/40 px-1 py-0.5 rounded">course_pricing</code> بقاعدة بيانات السيرفر (MySQL)، ولا يمكن لأي طالب أو عميل التلاعب بها في المتصفح نهائياً.
            </div>

            <div className="space-y-3">
              {courses.map((course) => {
                const data = pricingList[course.id] || {
                  priceSar: course.priceSar || 75,
                  priceEg: course.priceEg || 1100,
                  title: course.title,
                };
                const isSaving = isSavingPricing === course.id;

                return (
                  <div
                    key={course.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-white">{course.title}</span>
                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {course.id}
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs line-clamp-1">{course.description}</p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">السعر (ر.س 🇸🇦):</label>
                        <input
                          type="number"
                          min="0"
                          value={data.priceSar}
                          onChange={(e) =>
                            setPricingList({
                              ...pricingList,
                              [course.id]: { ...data, priceSar: Number(e.target.value) },
                            })
                          }
                          className="w-24 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-amber-400 text-center"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">السعر (ج.م 🇪🇬):</label>
                        <input
                          type="number"
                          min="0"
                          value={data.priceEg}
                          onChange={(e) =>
                            setPricingList({
                              ...pricingList,
                              [course.id]: { ...data, priceEg: Number(e.target.value) },
                            })
                          }
                          className="w-24 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-amber-400 text-center"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveCoursePrice(course.id)}
                        disabled={isSaving}
                        className="mt-4 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span>حفظ في الداتابيز</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. تبويب سجل الفواتير والإيصالات */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 right-3" />
                <input
                  type="text"
                  value={receiptSearch}
                  onChange={(e) => setReceiptSearch(e.target.value)}
                  placeholder="بحث برقم الفاتورة أو اسم الطالب أو الدورة..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                onClick={loadAllData}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث السجل</span>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 font-bold">
                  <tr>
                    <th className="p-3">رقم الفاتورة</th>
                    <th className="p-3">الطالب</th>
                    <th className="p-3">الدورة</th>
                    <th className="p-3">المبلغ</th>
                    <th className="p-3">الطريقة والحالة</th>
                    <th className="p-3">التاريخ</th>
                    <th className="p-3 text-center">إشعار واتساب</th>
                    <th className="p-3 text-center">التفعيل اليدوي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center p-6 text-slate-500">
                        لا توجد فواتير مطابقة لعمليات البحث.
                      </td>
                    </tr>
                  ) : (
                    filteredReceipts.map((rcpt) => {
                      const waText = encodeURIComponent(
                        `🧾 تفاصيل فاتورة اشتراك دورة:\nرقم: ${rcpt.order_id}\nالطالب: ${rcpt.user_name}\nالدورة: ${rcpt.course_title}\nالمبلغ: ${rcpt.final_price} ${rcpt.currency}`
                      );
                      const waLink = `https://api.whatsapp.com/send?phone=${encodeURIComponent(
                        receiptSettings.admin_whatsapp || ''
                      )}&text=${waText}`;

                      const isPaid = rcpt.payment_status === 'PAID';

                      return (
                        <tr key={rcpt.id || rcpt.order_id} className="hover:bg-slate-900/50">
                          <td className="p-3 font-mono font-bold text-amber-400">{rcpt.order_id}</td>
                          <td className="p-3">
                            <span className="block font-bold text-white">{rcpt.user_name}</span>
                            <span className="block text-[10px] text-slate-400">{rcpt.user_email}</span>
                          </td>
                          <td className="p-3 text-slate-300 font-bold">{rcpt.course_title}</td>
                          <td className="p-3 font-black text-emerald-400">
                            {rcpt.final_price} {rcpt.currency}
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-300 font-bold">
                                {rcpt.payment_method === 'instapay' ? 'إنستاباي ⚡' : 'كاشير 💳'}
                              </span>
                              {isPaid ? (
                                <span className="inline-block w-fit px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold">
                                  مفعل ✅
                                </span>
                              ) : (
                                <span className="inline-block w-fit px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold">
                                  قيد المراجعة ⏳
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-slate-400">
                            {rcpt.created_at ? new Date(rcpt.created_at).toLocaleDateString('ar-SA') : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition text-[11px] font-bold"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>واتساب</span>
                            </a>
                          </td>
                          <td className="p-3 text-center">
                            {isPaid ? (
                              <span className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>تم التفعيل</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={activatingReceiptId === (rcpt.id || rcpt.order_id)}
                                onClick={() => handleActivateReceipt(rcpt)}
                                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-[11px] shadow transition cursor-pointer flex items-center gap-1 mx-auto disabled:opacity-50"
                              >
                                {activatingReceiptId === (rcpt.id || rcpt.order_id) ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Zap className="w-3.5 h-3.5" />
                                )}
                                <span>تفعيل يدوي</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 4. تبويب إعدادات الواتساب والإيميل */}
        {activeTab === 'settings' && (
          <form onSubmit={handleSaveSettings} className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4 max-w-xl">
            <div>
              <h4 className="font-black text-sm text-white mb-1">وجهات استلام الإيصالات والإشعارات الفورية:</h4>
              <p className="text-slate-400 text-xs">
                عند إتمام أي طالب لعملية دفع، يتم إرسال الإيصال المنسق مباشرة إلى هذا الرقم والبريد.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                رقم واتساب الإدارة (مع مفتاح الدولة، مثال: 966500000000 أو 201000000000):
              </label>
              <input
                type="text"
                required
                value={receiptSettings.admin_whatsapp}
                onChange={(e) =>
                  setReceiptSettings({ ...receiptSettings, admin_whatsapp: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                بريد الإدارة لاستلام الإيصالات الرسمية:
              </label>
              <input
                type="email"
                required
                value={receiptSettings.admin_email}
                onChange={(e) =>
                  setReceiptSettings({ ...receiptSettings, admin_email: e.target.value })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingSettings}
              className="py-3 px-6 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer transition disabled:opacity-50"
            >
              {isSavingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>حفظ الإعدادات في قاعدة البيانات 💾</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

