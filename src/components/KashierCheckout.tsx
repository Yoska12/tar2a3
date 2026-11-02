import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  Loader2,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Check,
  CheckCircle2,
  ArrowRight,
  Maximize2,
  X,
  Zap
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { logKashierTransaction, KashierTransaction } from '../lib/kashierService';

export interface PricingOption {
  id: 'EGP' | 'SAR';
  currency: 'EGP' | 'SAR';
  amount: number;
  amountStr: string;
  label: string;
  country: string;
  flag: string;
  methods: string[];
  isPopular?: boolean;
}

export const PRICING_OPTIONS: PricingOption[] = [
  {
    id: 'EGP',
    currency: 'EGP',
    amount: 1100,
    amountStr: '1100',
    label: 'الجنيه المصري',
    country: 'جمهورية مصر العربية',
    flag: '🇪🇬',
    methods: ['فودافون كاش والمحافظ', 'ميزة (Meeza)', 'Visa', 'Mastercard'],
    isPopular: true,
  },
  {
    id: 'SAR',
    currency: 'SAR',
    amount: 75,
    amountStr: '75',
    label: 'الريال السعودي',
    country: 'المملكة العربية السعودية ودول الخليج',
    flag: '🇸🇦',
    methods: ['مدى (Mada)', 'Visa', 'Mastercard'],
    isPopular: false,
  },
];

export interface KashierCheckoutProps {
  currentUser?: TarqaUser | null;
  defaultCurrency?: 'EGP' | 'SAR';
  onSuccess?: (transaction: KashierTransaction) => void;
  onError?: (error: string) => void;
  className?: string;
  showTitle?: boolean;
}

/**
 * دالة مساعدة لحساب توقيع HMAC-SHA256 محلياً في المتصفح باستخدام Web Crypto API
 * لضمان عدم توقف عملية الدفع حتى في حال وجود بطء في الاتصال بالسيرفر
 */
async function computeBrowserHmacSha256(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export const KashierCheckout: React.FC<KashierCheckoutProps> = ({
  currentUser,
  defaultCurrency = 'EGP',
  onSuccess,
  onError,
  className = '',
  showTitle = true,
}) => {
  // 1. حالة اختيار الباقة والعملة الديناميكية
  const [selectedCurrency, setSelectedCurrency] = useState<'EGP' | 'SAR'>(defaultCurrency);
  const selectedOption =
    PRICING_OPTIONS.find((opt) => opt.currency === selectedCurrency) || PRICING_OPTIONS[0];

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // الثوابت المعتمدة المباشرة لكاشير
  const merchantId =
    (import.meta as any).env?.VITE_KASHIER_MERCHANT_ID || 'MID-50598-297';
  const iframeKey =
    (import.meta as any).env?.VITE_KASHIER_IFRAME_KEY ||
    '91bdc6e4-423d-4bcb-91ef-a27485a465d1';
  // ⚠️ Note: Secret key is kept strictly on the backend for security
  const mode = 'live';
  const baseUrl = 'https://payments.kashier.io';

  /**
   * توليد رقم طلب فريد يبدأ بـ TARQA3_ وفق الاشتراطات المطلوبة
   */
  const generateUniqueOrderId = (): string => {
    return `TARQA3_${Date.now()}`;
  };

  /**
   * تنفيذ عملية التوجيه الآمنة لبوابة كاشير المباشرة
   */
  const handleProceedToPayment = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const orderId = generateUniqueOrderId();
      const amount = selectedOption.amountStr; // "1" or "75"
      const currency = selectedOption.currency; // "EGP" or "SAR"
      const formattedAmount = Number(selectedOption.amount).toFixed(2);

      const origin =
        typeof window !== 'undefined' && window.location.origin.startsWith('http')
          ? window.location.origin
          : 'https://tarqa3.net';

      const redirectUrl = `${origin}/?payment=kashier_done&order=${orderId}`;
      const webhookUrl = `${origin}/api/webhooks/kashier`;

      // حساب الهاش المشفر عبر الصيغة المعيارية لكاشير
      let hash = '';
      const canonicalPath = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;

      // 1. المحاولة أولاً عبر الباك إند API للحصول على التوقيع المشفر
      try {
        const hashRes = await fetch('/api/kashier/hash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            amount,
            currency,
            merchantId,
          }),
        });

        if (hashRes.ok) {
          const hashData = await hashRes.json();
          if (hashData.hash) {
            hash = hashData.hash;
          }
        }
      } catch (backendErr) {
        console.warn('[KashierCheckout] Backend hash endpoint error, falling back to Web Crypto:', backendErr);
      }

      // 2. استخدام Web Crypto API في المتصفح في حال تعذر الاتصال بالباك إند
      // ملاحظة: كاشير تعتمد مفتاح الآي فريم (iframeKey / Payment API Key) لتشفير الـ HPP
      if (!hash) {
        hash = await computeBrowserHmacSha256(iframeKey, canonicalPath);
      }

      // تسجيل المعاملة في السجل المحلي للموقع
      logKashierTransaction({
        orderId,
        userId: currentUser?.id || 'guest',
        userName: currentUser?.fullName || 'طالب طرقع',
        userEmail: currentUser?.email || 'student@tarqa.app',
        amount: selectedOption.amount,
        currency,
        status: 'PENDING',
        details: `بدء توجيه العميل للدفع المباشر (${amount} ${currency}) عبر كاشير Live`,
      });

      // 3. بناء الرابط المباشر بجميع المعاملات الإلزامية التي يطلبها كاشير في queryParamMap
      const queryParams = new URLSearchParams({
        merchantId,
        order: orderId,
        orderId: orderId,
        amount,
        currency,
        mode,
        hash,
        merchantRedirect: redirectUrl,
        serverWebhook: webhookUrl,
        display: 'ar',
        brandColor: '#f59e0b',
      });

      const paymentUrl = `${baseUrl}/?${queryParams.toString()}`;

      // حفظ بيانات الطلب والعميل محلياً لضمان تفعيل الحساب فور العودة
      try {
        localStorage.setItem(
          'tarqa_pending_kashier_payment',
          JSON.stringify({
            orderId,
            amount: selectedOption.amount,
            currency: selectedOption.currency,
            userId: currentUser?.id,
            userEmail: currentUser?.email,
            userName: currentUser?.fullName,
            timestamp: Date.now(),
          })
        );
      } catch (storageErr) {
        console.warn('LocalStorage save error:', storageErr);
      }

      // 4. التوجيه الفوري لصفحة كاشير الرسمية
      window.location.href = paymentUrl;
    } catch (err: any) {
      console.error('[KashierCheckout] Redirection error:', err);
      const msg = err?.message || 'تعذر بدء عملية الدفع، يرجى المحاولة مرة أخرى.';
      setErrorMsg(msg);
      onError?.(msg);
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className={`relative w-full max-w-xl mx-auto rounded-3xl bg-[#090d16] text-white p-6 sm:p-8 border border-amber-500/25 shadow-[0_0_50px_rgba(245,158,11,0.08)] overflow-hidden ${className}`}
    >
      {/* إضاءة برتقالية خلفية أنيقة تتناسب مع هوية طرقع (Orange Ambient Lighting) */}
      <div className="absolute -top-20 -right-20 w-56 h-56 bg-amber-500/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-56 h-56 bg-orange-600/15 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-80" />

      {/* رأس المكون */}
      {showTitle && (
        <div className="relative z-10 mb-6 pb-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-100 flex items-center gap-2">
                  <span>بوابة الدفع الإلكتروني</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Live 256-bit</span>
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  اشتراك سنوي شامل لمنصة طرقع للقدرات
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-400/90 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>تفعيل فوري</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. أداة اختيار الباقة والعملة التفاعلية (Dynamic Currency & Pricing Selector) */}
      <div className="relative z-10 mb-6">
        <label className="block text-xs font-bold text-slate-300 mb-3 text-right">
          اختر عملة وطريقة الدفع المناسبة لك:
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PRICING_OPTIONS.map((opt) => {
            const isSelected = selectedCurrency === opt.currency;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedCurrency(opt.currency)}
                className={`relative p-4 rounded-2xl text-right transition-all duration-200 cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#141b2d] to-[#0c1220] border-amber-500 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-1 ring-amber-500/50 scale-[1.01]'
                    : 'bg-[#0f1422]/70 hover:bg-[#141a2b] border-slate-800 hover:border-slate-700 text-slate-300'
                }`}
              >
                {/* بادج الأكثر اختياراً */}
                {opt.isPopular && (
                  <span className="absolute -top-2.5 left-4 text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 shadow-md">
                    الأكثر طلباً ⭐
                  </span>
                )}

                <div className="flex items-start justify-between w-full mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" role="img" aria-label={opt.label}>
                      {opt.flag}
                    </span>
                    <div>
                      <div className="text-xs font-black text-slate-200">
                        {opt.label} ({opt.currency})
                      </div>
                      <div className="text-[10px] text-slate-400 line-clamp-1">
                        {opt.country}
                      </div>
                    </div>
                  </div>

                  {/* أيقونة التحديد */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'border border-slate-700 bg-slate-900/50'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between w-full">
                  <span className="text-[11px] text-slate-400">السعر:</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono text-amber-400">
                      {opt.amount}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {opt.currency === 'SAR' ? 'ريال' : 'جنيه'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. ملخص تفاصيل الطلب والحساب */}
      <div className="relative z-10 mb-6 p-4 rounded-2xl bg-[#0e1424]/80 border border-slate-800/80 space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">الباقة المختارة:</span>
          <span className="font-bold text-slate-200">الاشتراك السنوي الشامل (365 يوماً)</span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">بوابة الدفع الرسمية:</span>
          <span className="font-bold text-amber-400 flex items-center gap-1">
            <span>Kashier Payment Gateway</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">
              Live
            </span>
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">وسائل الدفع المتاحة:</span>
          <span className="font-bold text-slate-300 text-[11px]">
            {selectedOption.methods.join(' • ')}
          </span>
        </div>
        <div className="pt-2.5 border-t border-slate-800 flex justify-between items-center">
          <span className="text-sm font-black text-slate-100">المبلغ الإجمالي للدفع:</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]">
              {selectedOption.amountStr}
            </span>
            <span className="text-xs font-black text-slate-300">
              {selectedOption.currency === 'SAR' ? 'ريال سعودي (SAR)' : 'جنيه مصري (EGP)'}
            </span>
          </div>
        </div>
      </div>

      {/* رسالة الخطأ إن وُجدت */}
      {errorMsg && (
        <div className="relative z-10 mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-bold">{errorMsg}</span>
        </div>
      )}

      {/* 3. زر الانتقال للدفع المباشر عبر كاشير (Action CTA Button) */}
      <div className="relative z-10 space-y-3">
        <button
          type="button"
          onClick={handleProceedToPayment}
          disabled={loading}
          className="w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base text-slate-950 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.35)] flex items-center justify-center gap-2.5 transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 select-none group"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-slate-950" />
              <span>جاري التحويل لبوابة كاشير الآمنة...</span>
            </>
          ) : (
            <>
              <Zap className="w-5 h-5 text-slate-950 fill-current" />
              <span>
                تأكيد والدفع الآن • {selectedOption.amountStr}{' '}
                {selectedOption.currency === 'SAR' ? 'ر.س' : 'ج.م'}
              </span>
              <ExternalLink className="w-4 h-4 text-slate-950 group-hover:translate-x-[-2px] transition-transform" />
            </>
          )}
        </button>

        <p className="text-[11px] text-center text-slate-400 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>سيتم تحويلك إلى صفحة الدفع الرسمية والمشفرة التابعة لبنك كاشير</span>
        </p>
      </div>

      {/* شعارات وسائل الدفع المعتمدة بالأسفل */}
      <div className="relative z-10 mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-center gap-2 text-slate-400 text-[10px] font-bold">
        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          🇸🇦 مدى Mada
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          💳 Visa
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          💳 Mastercard
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          🇪🇬 ميزة Meeza
        </span>
        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
          📱 محافظ كاش
        </span>
      </div>
    </div>
  );
};

export default KashierCheckout;
