import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CreditCard,
  Zap,
  Sparkles,
  Tag,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  MessageCircle,
  Download,
  Loader2,
  ArrowRight,
  Receipt,
  User,
  Phone,
  Mail,
  BookOpen,
  Clock
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { CourseItem } from '../types';
import { courseCommerceService, PromoValidationResult, PaymentReceipt } from '../lib/courseCommerceService';
import { createKashierPaymentSession } from '../lib/kashierService';

export interface CoursePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: CourseItem;
  currentUser: TarqaUser | null;
  onSuccess: (receipt: PaymentReceipt) => void;
  onOpenAuth?: () => void;
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
}

export const CoursePaymentModal: React.FC<CoursePaymentModalProps> = ({
  isOpen,
  onClose,
  course,
  currentUser,
  onSuccess,
  onOpenAuth,
  onOpenPolicies,
}) => {
  const [currency, setCurrency] = useState<'SAR' | 'EGP'>('SAR');
  const [basePrice, setBasePrice] = useState<number>(course.priceSar || 75);
  const [isLoadingPrice, setIsLoadingPrice] = useState(true);

  // الكوبون والخصم
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoResult, setPromoResult] = useState<PromoValidationResult | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // بيانات الطالب
  const [studentPhone, setStudentPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'kashier' | 'instapay'>('kashier');
  const [isProcessing, setIsProcessing] = useState(false);

  // حالة نجاح الدفع وظهور الإيصال
  const [receiptData, setReceiptData] = useState<PaymentReceipt | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  // جلب الأسعار الحقيقية المحمية من الداتابيز مباشرة للدورة
  useEffect(() => {
    if (!isOpen) return;
    // تعيين السعر الأولي فوراً من كائن الدورة الممرر أو إعدادات كاشير
    const kSettings = (() => {
      try {
        const r = localStorage.getItem('tarqa_kashier_settings');
        return r ? JSON.parse(r) : null;
      } catch { return null; }
    })();
    const courseEg = Number(course.priceEg) || Number(kSettings?.amount) || 1100;
    const courseSar = Number(course.priceSar) || 75;
    const immediateInitial = currency === 'EGP' ? courseEg : courseSar;
    setBasePrice(immediateInitial);

    setIsLoadingPrice(true);
    setPromoResult(null);
    setPromoError(null);
    setReceiptData(null);

    courseCommerceService
      .getCoursePrice(course.id)
      .then((prices) => {
        const p = currency === 'EGP' ? Number(prices.priceEg) : Number(prices.priceSar);
        if (p > 0) {
          setBasePrice(p);
        } else {
          setBasePrice(immediateInitial);
        }
      })
      .catch(() => {
        setBasePrice(immediateInitial);
      })
      .finally(() => {
        setIsLoadingPrice(false);
      });
  }, [isOpen, course.id, course.priceEg, course.priceSar, currency]);

  if (!isOpen) return null;

  // فحص تسجيل الدخول أولاً
  if (!currentUser) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
        <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 text-center text-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <User className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-black mb-2">تسجيل الدخول مطلوب أولاً 🔒</h3>
          <p className="text-slate-400 text-sm mb-6">
            يرجى تسجيل الدخول أو إنشاء حساب جديد لتتمكن من الاشتراك في ({course.title}) وحفظ تقدمك وفواتيرك.
          </p>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAuth?.();
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 hover:scale-[1.02] transition cursor-pointer"
          >
            تسجيل الدخول / إنشاء حساب 🚀
          </button>
        </div>
      </div>
    );
  }

  // حساب السعر النهائي المحمي
  const currentFinalPrice = promoResult && promoResult.valid ? promoResult.final_price : basePrice;
  const currentDiscountAmount = promoResult && promoResult.valid ? promoResult.discount_amount : 0;

  // التحقق من كود الخصم عبر السيرفر
  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoCodeInput.trim()) return;

    setIsValidatingPromo(true);
    setPromoError(null);

    const res = await courseCommerceService.validatePromoCode(promoCodeInput.trim(), course.id, currency);

    setIsValidatingPromo(false);
    if (res.valid) {
      setPromoResult(res);
      setPromoError(null);
    } else {
      setPromoResult(null);
      setPromoError(res.message);
    }
  };

  // إتمام عملية الدفع وتوليد الإيصال
  const handleCompletePayment = async () => {
    setIsProcessing(true);
    const orderId = `TARQA_${course.id.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now()}`;

    try {
      // 1. إذا كان الدفع عبر كاشير (بطاقات إلكترونية أو محافظ)
      if (paymentMethod === 'kashier') {
        const sessionRes = await createKashierPaymentSession(currentUser, {
          amount: currentFinalPrice,
          currency,
          description: `اشتراك ${course.title} - منصة طرقع`,
        });

        if (sessionRes.sessionUrl && !sessionRes.isSimulated) {
          // حفظ بيانات الدفع المعلق حتى يتم التحقق الفعلي عند عودة الطالب من كاشير بعد الدفع
          try {
            localStorage.setItem('tarqa_pending_course_payment', JSON.stringify({
              orderId: sessionRes.orderId || orderId,
              sessionId: sessionRes.sessionId,
              courseId: course.id,
              courseTitle: course.title,
              userId: currentUser.id,
              userName: currentUser.fullName || 'طالب طرقع',
              userEmail: currentUser.email || 'student@tarqa.app',
              userPhone: studentPhone.trim() || undefined,
              currency,
              amount: currentFinalPrice,
              promoCode: promoResult?.valid ? promoResult.code : undefined,
            }));
          } catch {}

          // تحويل الطالب مباشرة لصفحة دفع كاشير الرسمية دون أي تفعيل مسبق
          window.location.href = sessionRes.sessionUrl;
          return;
        } else {
          alert('تعذر فتح بوابة كاشير للدفع، يرجى إعادة المحاولة لاحقاً أو التواصل مع الدعم.');
          setIsProcessing(false);
          return;
        }
      }

      // 2. إذا كان الدفع عبر إنستاباي: تسجيل طلب التحويل للمراجعة اليدوية فقط (بدون تفعيل تلقائي)
      const confirmRes = await courseCommerceService.confirmCoursePayment({
        order_id: orderId,
        course_id: course.id,
        course_title: course.title,
        user_id: currentUser.id,
        user_name: currentUser.fullName || 'طالب طرقع',
        user_email: currentUser.email || 'student@tarqa.app',
        user_phone: studentPhone.trim() || undefined,
        currency,
        promo_code: promoResult?.valid ? promoResult.code : undefined,
        payment_method: 'instapay',
      });

      if (confirmRes.success && confirmRes.receipt) {
        setReceiptData(confirmRes.receipt);
        setWhatsappUrl(confirmRes.whatsapp_url || null);
        // ملاحظة أمنية: لا يتم استدعاء onSuccess هنا إطلاقاً، لأن اشتراك إنستاباي غير مفعل
        // ويظل بانتظار مراجعة الإدارة وتفعيله يدوياً بعد التأكد من وصول الحوالة البنكية
      } else {
        alert(confirmRes.message || 'حدث خطأ أثناء تسجيل طلب التحويل');
      }
    } catch (err: any) {
      console.error('Payment error:', err);
      alert('تعذر استكمال العملية، يرجى المحاولة لاحقاً');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-in fade-in overflow-y-auto">
      <div className="relative w-[95%] max-w-xl my-auto bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 text-white shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* شريط الإغلاق والأمان */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-4 h-4" />
            <span>دفع مؤمّن ومربوط بالسيرفر 100%</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* إذا اكتملت العملية بنجاح وظهر الإيصال الرسمي */}
        {receiptData ? (
          <div className="text-center py-4 space-y-5 animate-in zoom-in-95">
            {receiptData.payment_method === 'instapay' ? (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <Clock className="w-10 h-10 animate-pulse" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-10 h-10" />
              </div>
            )}

            <div>
              {receiptData.payment_method === 'instapay' ? (
                <>
                  <h3 className="text-2xl font-black text-amber-400 mb-1">تم تسجيل طلب التحويل عبر إنستاباي ⏳</h3>
                  <p className="text-slate-300 text-xs sm:text-sm">
                    طلبك قيد المراجعة اليدوية من قبل إدارة المنصة. سيتم التحقق من التحويل وتفعيل اشتراكك يدوياً فور التأكد من وصول المبلغ.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-black text-white mb-1">تم الدفع وتفعيل الدورة بنجاح! 🎉</h3>
                  <p className="text-slate-400 text-xs sm:text-sm">
                    تم تفعيل اشتراكك في ({receiptData.course_title}) وصدر إيصال العملية رسمياً.
                  </p>
                </>
              )}
            </div>

            {/* بطاقة الإيصال المنسقة */}
            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 text-right space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">رقم الفاتورة:</span>
                <span className="font-mono font-bold text-amber-400">{receiptData.order_id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">الدورة:</span>
                <span className="font-bold text-white">{receiptData.course_title}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">المبلغ المدفوع:</span>
                <span className="font-black text-emerald-400 text-sm">
                  {receiptData.final_price} {receiptData.currency}
                </span>
              </div>
              {receiptData.promo_code && (
                <div className="flex justify-between border-b border-slate-800/80 pb-2 text-amber-300">
                  <span>كود الخصم المطبق:</span>
                  <span className="font-bold font-mono">
                    {receiptData.promo_code} (-{receiptData.discount_amount} {receiptData.currency})
                  </span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-slate-400">
                <span>تاريخ التفعيل:</span>
                <span>{new Date().toLocaleDateString('ar-SA')}</span>
              </div>
            </div>

            {/* أزرار الإجراءات بعد الدفع */}
            <div className="space-y-2.5 pt-2">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>إرسال وتأكيد الإيصال على واتساب الإدارة 📱</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
              >
                <span>دخول الدورة وبدء المشاهدة الآن 🚀</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* نموذج الدفع وتطبيق الكود */
          <div className="space-y-5">
            {/* بطاقة معلومات الدورة */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl font-black shrink-0">
                🎯
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="font-black text-sm text-white truncate">{course.title}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                    دورة مستقلة
                  </span>
                </div>
                <p className="text-slate-400 text-xs line-clamp-1">{course.description}</p>
              </div>
            </div>

            {/* اختيار العملة (ريال سعودي / جنيه مصري) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCurrency('SAR')}
                className={`p-3 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                  currency === 'SAR'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-2 ring-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <span className="block font-black text-xs">الريال السعودي 🇸🇦</span>
                  <span className="text-[10px] text-slate-400">مدى، فيزا، ماستركارد</span>
                </div>
                <span className="font-black text-sm text-amber-400">SAR</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrency('EGP')}
                className={`p-3 rounded-2xl border text-right transition cursor-pointer flex items-center justify-between ${
                  currency === 'EGP'
                    ? 'bg-amber-500/15 border-amber-500 text-white ring-2 ring-amber-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <span className="block font-black text-xs">الجنيه المصري 🇪🇬</span>
                  <span className="text-[10px] text-slate-400">فودافون كاش، إنستاباي، ميزة</span>
                </div>
                <span className="font-black text-sm text-amber-400">EGP</span>
              </button>
            </div>

            {/* صندوق إدخال وتطبيق كود الخصم (Promo Code) */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>لديك كود خصم؟ (Promo Code):</span>
              </label>

              <form onSubmit={handleApplyPromo} className="flex gap-2">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => {
                    setPromoCodeInput(e.target.value.toUpperCase());
                    setPromoError(null);
                  }}
                  placeholder="مثال: TARQA20 أو RAMADAN"
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono uppercase"
                />
                <button
                  type="submit"
                  disabled={isValidatingPromo || !promoCodeInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  {isValidatingPromo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>تطبيق 🎟️</span>
                </button>
              </form>

              {promoResult && promoResult.valid && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
                  <span>✅ {promoResult.message}</span>
                  <span className="font-mono">
                    خصم {promoResult.discount_amount} {promoResult.currency}
                  </span>
                </div>
              )}

              {promoError && (
                <div className="flex items-center gap-1.5 p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{promoError}</span>
                </div>
              )}
            </div>

            {/* رقم هاتف أو واتساب الطالب لاستلام الإيصال */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                <Phone className="w-3.5 h-3.5 text-amber-400" />
                <span>رقم الواتساب (لاستلام الإيصال ورسالة التفعيل):</span>
              </label>
              <input
                type="tel"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value)}
                placeholder="مثال: 05XXXXXXXX أو 010XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* طريقة الدفع المفضلة */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">طريقة الدفع:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('kashier')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    paymentMethod === 'kashier'
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-amber-400" />
                  <span>بطاقات بنكية / محافظ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('instapay')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                    paymentMethod === 'instapay'
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>إنستاباي / فودافون كاش</span>
                </button>
              </div>
            </div>

            {/* جدول تلخيص المبلغ الإجمالي للدفع المحمي */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>سعر الدورة الرسمي:</span>
                <span className="font-bold">
                  {isLoadingPrice ? '...' : `${basePrice} ${currency}`}
                </span>
              </div>

              {currentDiscountAmount > 0 && (
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>خصم الكوبون ({promoResult?.code}):</span>
                  <span>
                    -{currentDiscountAmount} {currency}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-sm font-black">
                <span className="text-white">المبلغ النهائي للدفع:</span>
                <span className="text-amber-400 text-base">
                  {currentFinalPrice} {currency}
                </span>
              </div>
            </div>

            {/* زر تأكيد الدفع وتفعيل الدورة */}
            <button
              type="button"
              onClick={handleCompletePayment}
              disabled={isProcessing || isLoadingPrice}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري تسجيل وتفعيل اشتراك الدورة...</span>
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  <span>تأكيد الاشتراك وتوليد الإيصال فوراً ({currentFinalPrice} {currency}) 🔒</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

