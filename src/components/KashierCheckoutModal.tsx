import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ShieldCheck,
  Lock,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import {
  createKashierPaymentSession,
  getKashierSettings,
  logKashierTransaction,
  KashierTransaction,
} from '../lib/kashierService';

interface KashierCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: TarqaUser | null;
  onPaymentSuccess: (transaction: KashierTransaction) => void;
  customAmount?: number;
  customCurrency?: 'EGP' | 'SAR';
  onOpenPolicies?: (tab: 'terms' | 'privacy' | 'cookies' | 'refund') => void;
}

export const KashierCheckoutModal: React.FC<KashierCheckoutModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onPaymentSuccess,
  customAmount,
  customCurrency,
  onOpenPolicies,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string>('');
  const [isSimulated, setIsSimulated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const settings = getKashierSettings();
  const [selectedCurrency, setSelectedCurrency] = useState<'EGP' | 'SAR'>(customCurrency || settings.currency || 'SAR');

  const amount = customAmount ?? (selectedCurrency === 'SAR' ? 75 : 1020);
  const currency = selectedCurrency;

  // تهيئة جلسة الدفع فور فتح النافذة أو تغير العملة
  useEffect(() => {
    if (!isOpen) {
      setSessionUrl(null);
      setError(null);
      setPaymentDone(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const initSession = async () => {
      try {
        const res = await createKashierPaymentSession(currentUser, {
          amount,
          currency,
          description: `اشتراك باقة طرقع السنوية الشاملة (${amount} ${currency === 'SAR' ? 'ريال' : 'جنيه'})`,
        });

        if (!isMounted) return;

        if (res.success && res.sessionUrl) {
          setSessionUrl(res.sessionUrl);
          setOrderId(res.orderId);
          setIsSimulated(Boolean(res.isSimulated));
        } else {
          setError(res.error || 'تعذر إنشاء جلسة الدفع مع بوابة كاشير. يرجى مراجعة الاتصال.');
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err?.message || 'حدث خطأ غير متوقع أثناء الاتصال بكاشير');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSession();

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentUser, amount, currency, selectedCurrency]);

  // الاستماع لرسائل postMessage من كاشير وفق التوثيق الرسمي
  useEffect(() => {
    if (!isOpen) return;

    const handleKashierMessage = (event: MessageEvent) => {
      // 1. التحقق الصارم من موثوقية مصدر الرسالة (Origin Validation) لمنع ثغرات تزييف الدفع عبر postMessage
      const origin = (event.origin || '').toLowerCase();
      const isTrustedKashier =
        origin.endsWith('.kashier.io') ||
        origin === 'https://kashier.io' ||
        origin === 'https://checkout.kashier.io' ||
        origin === 'https://payments.kashier.io' ||
        origin === 'https://api.kashier.io' ||
        origin === 'https://test-api.kashier.io';
      const isSelfOrigin = origin === window.location.origin.toLowerCase();

      // رفض أي رسالة غير قادمة من نطاق كاشير المعتمد أو النطاق المحلي في وضع المحاكاة
      if (!isTrustedKashier && !(isSimulated && isSelfOrigin)) {
        return;
      }

      // 2. التحقق من محتوى البيانات
      const data = event.data;
      if (!data) return;

      const messageType = typeof data === 'string' ? data : data.message || data.status || data.event;

      // عند استلام إشعار النجاح من كاشير
      if (
        messageType === 'SUCCESS' ||
        messageType === 'PAID' ||
        messageType === 'payment_success' ||
        data?.paymentStatus === 'SUCCESS' ||
        data?.message?.toLowerCase?.() === 'success'
      ) {
        handleSuccessCheckout();
      } else if (
        messageType === 'FAILED' ||
        messageType === 'CANCELLED' ||
        data?.paymentStatus === 'FAILED'
      ) {
        logKashierTransaction({
          orderId,
          userId: currentUser?.id || 'guest',
          userName: currentUser?.fullName || 'طالب طرقع',
          userEmail: currentUser?.email || 'student@tarqa.app',
          amount,
          currency,
          status: 'FAILED',
          sessionUrl: sessionUrl || undefined,
          details: 'فشلت عملية الدفع أو تم إلغاؤها من قبل المستخدم',
        });
      }
    };

    window.addEventListener('message', handleKashierMessage);
    return () => {
      window.removeEventListener('message', handleKashierMessage);
    };
  }, [isOpen, orderId, currentUser, amount, currency, sessionUrl]);

  // معالجة النجاح وإشعار المنصة
  const handleSuccessCheckout = () => {
    setPaymentDone(true);
    const tx = logKashierTransaction({
      orderId,
      userId: currentUser?.id || 'guest',
      userName: currentUser?.fullName || 'طالب طرقع',
      userEmail: currentUser?.email || 'student@tarqa.app',
      amount,
      currency,
      status: 'SUCCESS',
      sessionUrl: sessionUrl || undefined,
      details: isSimulated
        ? `تمت العملية بنجاح عبر المحاكي التجريبي (${amount} ${currency})`
        : `تمت العملية وتأكيد الدفع عبر كاشير (${amount} ${currency})`,
    });

    setTimeout(() => {
      onPaymentSuccess(tx);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-xl bg-white dark:bg-[#0b1120] border-2 border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] relative">
        
        {/* شريط رأس النافذة */}
        <div className="px-5 py-4 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  بوابة الدفع الآمنة (Kashier)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>تشفير 256-bit</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                باقة طرقع السنوية الشاملة • <strong className="text-amber-500 font-mono text-xs">{amount} {currency === 'SAR' ? 'ر.س' : 'ج.م'}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* شريط التبديل السريع بين العملتين (75 ريال سعودي أو 1020 جنيه مصري) */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            اختر عملة وطريقة الدفع المناسبة لك:
          </span>
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-200 dark:bg-slate-800">
            <button
              type="button"
              disabled={loading}
              onClick={() => setSelectedCurrency('SAR')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedCurrency === 'SAR'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🇸🇦 75 ريال (مدى / بطاقات)</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => setSelectedCurrency('EGP')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                selectedCurrency === 'EGP'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>🇪🇬 1020 جنيه (فودافون كاش / إنستاباي / ميزة)</span>
            </button>
          </div>
        </div>

        {/* جسم النافذة */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col items-center justify-center min-h-[420px]">
          
          {/* 1. حالة التحميل */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
                <Lock className="w-6 h-6 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-2">
                جاري تأمين الاتصال البنكي وتهيئة جلسة كاشير...
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                يتم الآن تجهيز نموذج الدفع المشفر عبر خوادم كاشير المعتمدة
              </p>
            </div>
          )}

          {/* 2. حالة حدوث خطأ */}
          {!loading && error && (
            <div className="w-full max-w-md p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400">
                تعذر إتمام الاتصال ببوابة الدفع
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {error}
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    setLoading(true);
                    setError(null);
                    createKashierPaymentSession(currentUser, { amount, currency })
                      .then((res) => {
                        if (res.success && res.sessionUrl) {
                          setSessionUrl(res.sessionUrl);
                          setOrderId(res.orderId);
                          setIsSimulated(Boolean(res.isSimulated));
                        } else {
                          setError(res.error || 'فشلت إعادة المحاولة');
                        }
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer"
                >
                  إعادة المحاولة
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* 3. شاشة اكتمال الدفع بنجاح */}
          {paymentDone && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-2">
                تم الدفع بنجاح! مبروك 🎉
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                تم تفعيل باقة طرقع السنوية الشاملة لحسابك فورياً. جاري تحويلك للمحاضرات والملفات...
              </p>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-2">
                <span>رقم العملية:</span>
                <span className="font-bold text-amber-500">{orderId}</span>
              </div>
            </div>
          )}

          {/* 4. عرض جلسة كاشير داخل iframe مدمج (Embedded Checkout Flow) */}
          {!loading && !error && !paymentDone && sessionUrl && (
            <div className="w-full flex-1 flex flex-col h-full space-y-3">
              
              {/* شريط معلومات الدفع السريع */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    طرق الدفع المتاحة:
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    مدى • فيزا • ماستركارد • المحافظ الإلكترونية
                  </span>
                </div>
                <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                  {amount} {currency}
                </span>
              </div>

              {/* إذا كانت الجلسة محاكاة تجريبية لعدم توفر مفاتيح بعد */}
              {isSimulated ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 rounded-2xl bg-amber-500/5 dark:bg-slate-900/50 border border-amber-500/30 text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/40 flex items-center justify-center">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white">
                      جلسة فحص تجريبية لبوابة كاشير (Kashier Sandbox)
                    </h5>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
                      هذه الجلسة تعمل في وضع المحاكاة الذكي للتجربة الفورية. يمكنك إدخال مفاتيح الإنتاج الخاصة بحسابك في لوحة التحكم الإدارية لبدء استقبال أموال حقيقية.
                    </p>
                  </div>

                  <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-right text-xs">
                    <div className="flex justify-between pb-1 border-b border-slate-100 dark:border-slate-850">
                      <span className="text-slate-500">الطلب:</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{orderId}</span>
                    </div>
                    <div className="flex justify-between pb-1 border-b border-slate-100 dark:border-slate-850">
                      <span className="text-slate-500">المبلغ:</span>
                      <span className="font-bold text-amber-500">{amount} {currency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">الطالب:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{currentUser?.fullName || 'طالب مسجل'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm pt-2">
                    <button
                      type="button"
                      onClick={handleSuccessCheckout}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>محاكاة دفع ناجح (تفعيل فوري)</span>
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                /* تضمين إطار Kashier Iframe الفعلي */
                <div className="flex-1 w-full min-h-[460px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 relative bg-white">
                  <iframe
                    ref={iframeRef}
                    src={sessionUrl}
                    title="Kashier Payment Gateway"
                    className="w-full h-full min-h-[460px] border-0"
                    allow="payment"
                  />
                </div>
              )}

              {/* شريط التذييل والسياسات */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span>بوابة دفع معتمدة</span>
                  <strong className="text-slate-600 dark:text-slate-300">Kashier PCI-DSS</strong>
                </span>

                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => onOpenPolicies?.('terms')}
                    className="hover:text-amber-500 hover:underline cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    شروط الاستخدام
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => onOpenPolicies?.('privacy')}
                    className="hover:text-amber-500 hover:underline cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    الخصوصية
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => onOpenPolicies?.('refund')}
                    className="hover:text-amber-500 hover:underline cursor-pointer text-slate-500 dark:text-slate-400"
                  >
                    سياسة الاسترجاع
                  </button>
                </div>

                {!isSimulated && (
                  <a
                    href={sessionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-amber-500 hover:underline flex items-center gap-1 font-bold text-[10px]"
                  >
                    <span>نافذة خارجية</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
