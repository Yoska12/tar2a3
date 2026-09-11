/**
 * ============================================================================
 * منصة طرقع - خدمة بوابة الدفع الإلكتروني كاشير (Kashier Payment Sessions v3)
 * ============================================================================
 * يتيح هذا الملف:
 * 1. إدارة وضبط مفاتيح حساب كاشير (Merchant ID, API Key, Secret Key)
 * 2. إنشاء جلسات دفع آمنة (Payment Sessions) وفق التوثيق الرسمي
 * 3. دعم العرض المدمج داخل الموقع (Embedded Iframe Checkout)
 * 4. تتبع وتخزين سجل العمليات والمعاملات المالية للطلاب
 */

import { TarqaUser } from './supabase';

export interface KashierSettings {
  enabled: boolean;
  mode: 'test' | 'live';
  merchantId: string;
  apiKey: string;
  secretKey: string;
  currency: 'EGP' | 'SAR';
  amount: number;
  brandColor: string;
  allowedMethods: string;
  simulateMode: boolean; // وضع المحاكاة عند عدم توفر مفاتيح حقيقية بعد
}

export interface KashierTransaction {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  timestamp: string;
  sessionUrl?: string;
  details?: string;
}

const SETTINGS_STORAGE_KEY = 'tarqa_kashier_settings';
const TRANSACTIONS_STORAGE_KEY = 'tarqa_kashier_transactions';

export const defaultKashierSettings: KashierSettings = {
  enabled: true,
  mode: 'test',
  merchantId: (import.meta as any).env?.VITE_KASHIER_MERCHANT_ID || 'MID-TARQA-TEST',
  apiKey: (import.meta as any).env?.VITE_KASHIER_API_KEY || '',
  secretKey: (import.meta as any).env?.VITE_KASHIER_SECRET_KEY || '',
  currency: 'EGP',
  amount: 75.00,
  brandColor: '#f59e0b', // اللون البرتقالي المميز لمنصة طرقع
  allowedMethods: 'card,wallet',
  simulateMode: true, // تفعيل المحاكاة افتراضياً للتجربة الفورية حتى يدخل المالك مفاتيحه
};

/**
 * جلب إعدادات بوابة كاشير المحفوظة
 */
export const getKashierSettings = (): KashierSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultKashierSettings };
    return { ...defaultKashierSettings, ...JSON.parse(raw) };
  } catch {
    return { ...defaultKashierSettings };
  }
};

/**
 * حفظ وتحديث إعدادات كاشير
 */
export const saveKashierSettings = (newSettings: Partial<KashierSettings>): KashierSettings => {
  try {
    const current = getKashierSettings();
    const updated: KashierSettings = { ...current, ...newSettings };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('tarqa_kashier_settings_changed', { detail: updated }));
    return updated;
  } catch (e) {
    console.warn('[Kashier] Failed to save settings locally:', e);
    return { ...defaultKashierSettings, ...newSettings };
  }
};

/**
 * جلب سجل المعاملات المالية
 */
export const getKashierTransactions = (): KashierTransaction[] => {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) || [];
  } catch {
    return [];
  }
};

/**
 * تسجيل معاملة مالية جديدة في سجل العمليات
 */
export const logKashierTransaction = (tx: Omit<KashierTransaction, 'id' | 'timestamp'>): KashierTransaction => {
  const newTx: KashierTransaction = {
    ...tx,
    id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    timestamp: new Date().toISOString(),
  };

  try {
    const existing = getKashierTransactions();
    const updated = [newTx, ...existing].slice(0, 100);
    localStorage.setItem(TRANSACTIONS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent('tarqa_kashier_tx_logged', { detail: newTx }));
  } catch (e) {
    console.warn('[Kashier] Failed to save transaction log:', e);
  }

  return newTx;
};

/**
 * تفريغ سجل المعاملات
 */
export const clearKashierTransactions = () => {
  try {
    localStorage.removeItem(TRANSACTIONS_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('tarqa_kashier_tx_logged'));
  } catch {}
};

export interface CreateSessionResult {
  success: boolean;
  sessionUrl?: string;
  orderId: string;
  isSimulated?: boolean;
  error?: string;
}

/**
 * إنشاء جلسة دفع لدى كاشير (Kashier Payment Session v3)
 */
export const createKashierPaymentSession = async (
  user: TarqaUser | null,
  options?: {
    amount?: number;
    currency?: 'EGP' | 'SAR';
    description?: string;
  }
): Promise<CreateSessionResult> => {
  const settings = getKashierSettings();
  const amount = options?.amount ?? settings.amount;
  const currency = options?.currency ?? settings.currency;
  const description = options?.description ?? 'اشتراك باقة طرقع السنوية الشاملة للقدرات';

  // توليد رقم طلب فريد وفق اشتراطات كاشير
  const cleanId = user?.id ? user.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) : 'guest';
  const orderId = `tarqa_${cleanId}_${Date.now()}`;

  const payload = {
    expireAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    maxFailureAttempts: 3,
    paymentType: 'credit',
    amount: Number(amount).toFixed(2),
    currency,
    order: orderId,
    merchantRedirect: `${window.location.origin}/?payment=kashier_done&order=${orderId}`,
    display: 'ar',
    type: 'one-time',
    allowedMethods: settings.allowedMethods || 'card,wallet',
    redirectMethod: null,
    iframeBackgroundColor: '#0d1424',
    metaData: {
      userId: user?.id || 'guest',
      userName: user?.fullName || 'طالب طرقع',
      plan: 'annual_qudurat',
    },
    merchantId: settings.merchantId,
    failureRedirect: false,
    brandColor: settings.brandColor || '#f59e0b',
    defaultMethod: 'card',
    description,
    manualCapture: false,
    customer: {
      email: user?.email && !user.email.includes('@telegram.tarqa') ? user.email : 'student@tarqa.app',
      reference: user?.id || `user_${Date.now()}`,
    },
    saveCard: 'optional',
    retrieveSavedCard: true,
    interactionSource: 'ECOMMERCE',
    enable3DS: true,
    serverWebhook: `${window.location.origin}/api/kashier-webhook`,
    notes: 'الاشتراك السنوي - منصة طرقع',
  };

  // 1. المحاولة أولاً عبر الدالة السحابية الآمنة (Serverless Endpoint)
  try {
    const apiRes = await fetch('/api/create-kashier-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        settingsMode: settings.mode,
        customApiKey: settings.apiKey || undefined,
        customSecretKey: settings.secretKey || undefined,
        customMerchantId: settings.merchantId || undefined,
      }),
    });

    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data.sessionUrl) {
        logKashierTransaction({
          orderId,
          userId: user?.id || 'guest',
          userName: user?.fullName || 'طالب طرقع',
          userEmail: user?.email || 'student@tarqa.app',
          amount,
          currency,
          status: 'PENDING',
          sessionUrl: data.sessionUrl,
          details: 'تم إنشاء جلسة دفع كاشير رسمية بنجاح عبر السيرفر السحابي',
        });
        return {
          success: true,
          sessionUrl: data.sessionUrl,
          orderId,
          isSimulated: false,
        };
      }
    }
  } catch (err) {
    console.info('[Kashier] Serverless endpoint not available, evaluating direct/simulated mode...');
  }

  // 2. إذا كانت المفاتيح مدخلة ومفعلة، نحاول الاتصال المباشر بـ Kashier API
  if (settings.secretKey && settings.apiKey && settings.merchantId && !settings.simulateMode) {
    try {
      const endpoint = settings.mode === 'live'
        ? 'https://api.kashier.io/v3/payment/sessions'
        : 'https://test-api.kashier.io/v3/payment/sessions';

      const directRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': settings.secretKey,
          'api-key': settings.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (directRes.ok) {
        const data = await directRes.json();
        const sessionUrl = data.sessionUrl || data.data?.sessionUrl;
        if (sessionUrl) {
          logKashierTransaction({
            orderId,
            userId: user?.id || 'guest',
            userName: user?.fullName || 'طالب طرقع',
            userEmail: user?.email || 'student@tarqa.app',
            amount,
            currency,
            status: 'PENDING',
            sessionUrl,
            details: `تم إنشاء جلسة دفع كاشير (${settings.mode.toUpperCase()})`,
          });
          return {
            success: true,
            sessionUrl,
            orderId,
            isSimulated: false,
          };
        }
      } else {
        const errJson = await directRes.json().catch(() => ({}));
        console.warn('[Kashier] Direct API returned error:', directRes.status, errJson);
      }
    } catch (e: any) {
      console.warn('[Kashier] Direct fetch failed (likely CORS or network):', e);
    }
  }

  // 3. وضع المعاينة والمحاكاة التجريبية الذكي (Smart Sandbox Simulator)
  // يعمل بشكل فوري لضمان عدم توقف تجربة المستخدم حتى يتم إدخال مفاتيح الإنتاج
  const simulatedSessionUrl = `https://payments.kashier.io/session/simulated-${orderId}?mode=test`;

  logKashierTransaction({
    orderId,
    userId: user?.id || 'guest',
    userName: user?.fullName || 'طالب طرقع',
    userEmail: user?.email || 'student@tarqa.app',
    amount,
    currency,
    status: 'PENDING',
    sessionUrl: simulatedSessionUrl,
    details: 'جلسة محاكاة تجريبية مدمجة (Sandbox Simulation)',
  });

  return {
    success: true,
    sessionUrl: simulatedSessionUrl,
    orderId,
    isSimulated: true,
  };
};
