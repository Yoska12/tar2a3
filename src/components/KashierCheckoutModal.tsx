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
  RefreshCw,
  MessageSquare,
  HelpCircle,
  FileText
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import {
  createKashierPaymentSession,
  getKashierSettings,
  logKashierTransaction,
  KashierTransaction,
} from '../lib/kashierService';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_EGYPT_FORMATTED,
  SUPPORT_TELEGRAM_URL,
  SUPPORT_TELEGRAM_BOT
} from '../lib/constants';

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
  const settings = getKashierSettings();
  const [selectedCurrency, setSelectedCurrency] = useState<'EGP' | 'SAR'>(
    customCurrency || settings.currency || 'SAR'
  );
  const amount = customAmount ?? (selectedCurrency === 'SAR' ? 75 : 1050);
  const currency = selectedCurrency;

  const [loading, setLoading] = useState<boolean>(true);
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [paymentDone, setPaymentDone] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // بدء وإنشاء جلسة كاشير الحقيقية فور فتح النافذة
  const initSession = async () => {
    setLoading(true);
    setError(null);
    setPaymentDone(false);

    try {
      const res = await createKashierPaymentSession(currentUser, {
        amount,
        currency,
        description: `اشتراك باقة طرقع السنوية الشاملة للقدرات (${amount} ${currency === 'SAR' ? 'ريال' : 'جنيه'})`,
      });

      if (res.success && res.sessionUrl) {
        setSessionUrl(res.sessionUrl);
        setOrderId(res.orderId);
        // إزالة مؤشر التحميل بعد ثانيتين لضمان ظهور الصفحة
        setTimeout(() => setLoading(false), 2000);
      } else {
        setError(res.error || 'تعذر الاتصال ببوابة كاشير، يرجى المحاولة مرة أخرى.');
      }
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع أثناء تهيئة جلسة الدفع.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      initSession();
    } else {
      setSessionUrl(null);
      setError(null);
      setPaymentDone(false);
      setLoading(false);
    }
  }, [isOpen, selectedCurrency, amount, currency]);

  // الاستماع لأحداث ورسائل كاشير من الـ Iframe
  useEffect(() => {
    if (!isOpen) return;

    const handleKashierMessage = (event: MessageEvent) => {
      const origin = (event.origin || '').toLowerCase();
      const isTrustedKashier =
        origin.endsWith('.kashier.io') ||
        origin === 'https://kashier.io' ||
        origin === 'https://checkout.kashier.io' ||
        origin === 'https://payments.kashier.io' ||
        origin === 'https://api.kashier.io' ||
        origin === 'https://test-api.kashier.io' ||
        origin === window.location.origin.toLowerCase();

      if (!isTrustedKashier) return;

      const data = event.data;
      if (!data) return;

      const messageType = typeof data === 'string' ? data : data.message || data.status || data.event;

      if (messageType === 'contentLoaded' || messageType === 'iframeLoaded') {
        setLoading(false);
      }

      if (
        messageType === 'paymentSuccess' ||
        messageType === 'SUCCESS' ||
        messageType === 'PAID' ||
        messageType === 'payment_success' ||
        data?.paymentStatus === 'SUCCESS' ||
        data?.message?.toLowerCase?.() === 'success'
      ) {
        handleSuccessCheckout();
      } else if (messageType === 'closeIframe' || messageType === 'iframeHide') {
        onClose();
      } else if (messageType === 'urlRedirection' && (data?.params?.redirectUrl || data?.redirectUrl)) {
        const targetUrl = data?.params?.redirectUrl || data?.redirectUrl;
        if (targetUrl) {
          window.location.replace(targetUrl);
        }
      }
    };

    window.addEventListener('message', handleKashierMessage);
    return () => {
      window.removeEventListener('message', handleKashierMessage);
    };
  }, [isOpen, orderId, currentUser, amount, currency, sessionUrl]);

  // معالجة نجاح الدفع وتفعيل الاشتراك
  const handleSuccessCheckout = () => {
    setPaymentDone(true);
    const tx = logKashierTransaction({
      orderId: orderId || `tarqa_${Date.now()}`,
      userId: currentUser?.id || 'guest',
      userName: currentUser?.fullName || 'طالب طرقع',
      userEmail: currentUser?.email || 'student@tarqa.app',
      amount,
      currency,
      status: 'SUCCESS',
      sessionUrl: sessionUrl || undefined,
      details: `تم تأكيد الدفع بنجاح عبر كاشير (${amount} ${currency})`,
    });

    setTimeout(() => {
      onPaymentSuccess(tx);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl bg-white dark:bg-[#0b1120] border-2 border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh] max-h-[850px] relative">
        
        {/* شريط رأس النافذة */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center shadow-inner">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                  بوابة الدفع الإلكتروني (Kashier)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>تشفير 256-bit</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                باقة طرقع السنوية الشاملة • <strong className="text-amber-500 font-mono text-sm">{amount} {currency === 'SAR' ? 'ر.س' : 'ج.م'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* اختيار العملة */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => setSelectedCurrency('SAR')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedCurrency === 'SAR'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🇸🇦 75 ر.س
              </button>
              <button
                type="button"
                onClick={() => setSelectedCurrency('EGP')}
                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                  selectedCurrency === 'EGP'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                🇪🇬 1050 ج.م
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم النافذة الرئيسي */}
        <div className="flex-1 overflow-hidden relative bg-slate-50/50 dark:bg-slate-950/50 flex flex-col">
          
          {/* حالة نجاح العملية */}
          {paymentDone ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-500 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/20 mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-2">
                تم تأكيد الدفع وتفعيل الاشتراك بنجاح! 🎉
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md leading-relaxed mb-6">
                تم فتح جميع دورات وملفات طرقع فورياً لحسابك لمدة سنة كاملة.
              </p>

              <div className="w-full max-w-sm p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2 text-right text-xs">
                <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">رقم الطلب:</span>
                  <span className="font-mono font-bold text-amber-500">{orderId}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">المبلغ:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{amount} {currency}</span>
                </div>
                <div className="flex justify-between pb-1.5 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500">المشترك:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{currentUser?.fullName || 'طالب طرقع'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">حالة الدفع:</span>
                  <span className="font-bold text-emerald-500">مدفوع ومؤكد ✓</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري فتح المحاضرات...</span>
              </div>
            </div>
          ) : error ? (
            /* حالة الخطأ مع خيارات إعادة المحاولة والتواصل */
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">
                تعذر تحميل بوابة الدفع
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                {error}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={initSession}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-2 transition cursor-pointer shadow-md"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>إعادة المحاولة</span>
                </button>

                <a
                  href={SUPPORT_TELEGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition"
                >
                  <MessageSquare className="w-4 h-4 text-sky-500" />
                  <span>الدعم الفني عبر تليجرام</span>
                </a>
              </div>
            </div>
          ) : (
            /* عرض شاشة كاشير المباشرة الحقيقية */
            <div className="flex-1 w-full h-full relative flex flex-col">
              {loading && (
                <div className="absolute inset-0 z-20 bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 text-center p-4">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
                  <p className="text-sm font-black text-slate-900 dark:text-white">
                    جاري تحميل بوابة كاشير الآمنة...
                  </p>
                  <p className="text-xs text-slate-500">
                    يتم إنشاء جلسة دفع مشفرة بمبلغ {amount} {currency === 'SAR' ? 'ريال' : 'جنيه'}
                  </p>
                </div>
              )}

              {sessionUrl && (
                <iframe
                  ref={iframeRef}
                  src={sessionUrl}
                  title="Kashier Payment Gateway"
                  className="w-full flex-1 border-0 bg-transparent"
                  allow="payment *; camera *; microphone *"
                  onLoad={() => setLoading(false)}
                />
              )}
            </div>
          )}
        </div>

        {/* الشريط السفلي: خيارات الدعم والأمان والسياسات */}
        <div className="px-5 py-3 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-bold text-[11px]">معتمد من كاشير • فيزا، ماستركارد، مدى، ميزة، والمحافظ</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            {sessionUrl && !paymentDone && (
              <a
                href={sessionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
              >
                <span>فتح بصفحة كاملة</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {onOpenPolicies && (
              <button
                type="button"
                onClick={() => onOpenPolicies('refund')}
                className="hover:text-amber-500 transition cursor-pointer"
              >
                سياسة الاسترجاع
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
