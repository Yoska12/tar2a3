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
  mode: 'live',
  merchantId: (import.meta as any).env?.VITE_KASHIER_MERCHANT_ID || 'MID-50598-297',
  apiKey: (import.meta as any).env?.VITE_KASHIER_IFRAME_KEY || (import.meta as any).env?.VITE_KASHIER_API_KEY || '91bdc6e4-423d-4bcb-91ef-a27485a465d1',
  secretKey: 'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b',
  currency: 'EGP',
  amount: 1100, // 1100 جنيه مصري السعر الرسمي للباقة السنوية
  brandColor: '#f59e0b', // اللون البرتقالي المميز لمنصة طرقع
  allowedMethods: 'card,wallet',
  simulateMode: false, // وضع البوابة الحية المباشرة
};

/**
 * دالة مساعدة لحساب توقيع HMAC-SHA256 باستخدام Web Crypto API
 */
async function computeWebHmacSha256(keyStr: string, message: string): Promise<string> {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const enc = new TextEncoder();
      const key = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(keyStr),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await window.crypto.subtle.sign('HMAC', key, enc.encode(message));
      return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (e) {
      console.warn('[Kashier] WebCrypto failed:', e);
    }
  }
  return '';
}

/**
 * جلب إعدادات بوابة كاشير المحفوظة
 */
export const getKashierSettings = (): KashierSettings => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...defaultKashierSettings };
    const parsed = JSON.parse(raw);
    const currency = parsed.currency === 'SAR' ? 'SAR' : 'EGP';
    let amount = Number(parsed.amount);
    if (!amount || amount <= 10) {
      amount = currency === 'SAR' ? 75 : 1100;
    }
    return { 
      ...defaultKashierSettings, 
      ...parsed, 
      currency,
      amount,
      merchantId: (parsed.merchantId || defaultKashierSettings.merchantId).trim(),
      apiKey: (parsed.apiKey || defaultKashierSettings.apiKey).trim(),
      secretKey: (parsed.secretKey || defaultKashierSettings.secretKey).trim() || defaultKashierSettings.secretKey
    };
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
    const updated: KashierSettings = { 
      ...current, 
      ...newSettings,
      merchantId: (newSettings.merchantId ?? current.merchantId).trim(),
      apiKey: (newSettings.apiKey ?? current.apiKey).trim(),
      secretKey: (newSettings.secretKey ?? current.secretKey).trim() || defaultKashierSettings.secretKey,
    };
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
  sessionId?: string;
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
  const currency = options?.currency ?? settings.currency;
  
  // تحديد السعر الدقيق بناء على العملة: 1100 جنيه مصري أو 75 ريال سعودي
  let amount = options?.amount;
  if (amount === undefined) {
    if (currency === 'SAR') {
      amount = settings.currency === 'SAR' ? settings.amount : 75;
    } else {
      amount = settings.currency === 'EGP' ? settings.amount : 1100;
    }
  }

  const description = options?.description ?? 'اشتراك باقة طرقع السنوية الشاملة للقدرات';

  // توليد رقم طلب فريد وفق اشتراطات كاشير
  const orderId = `TARQA3_${Date.now()}`;
  const originUrl = typeof window !== 'undefined' && window.location.origin.startsWith('https://')
    ? window.location.origin
    : 'https://tarqa3.net';

  const payload = {
    expireAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    maxFailureAttempts: 3,
    paymentType: 'credit',
    amount: Number(amount).toFixed(2),
    currency,
    order: orderId,
    merchantRedirect: `${originUrl}/?payment=kashier_done&order=${orderId}`,
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
    serverWebhook: `${window.location.origin}/api/webhooks/kashier`,
    notes: 'الاشتراك السنوي - منصة طرقع',
  };

  // 1. المحاولة المباشرة مع Kashier v3 Payment Sessions API (سريعة جداً وتدعم CORS)
  try {
    const directEndpoint = settings.mode === 'live'
      ? 'https://api.kashier.io/v3/payment/sessions'
      : 'https://test-api.kashier.io/v3/payment/sessions';

    const directRes = await fetch(directEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': settings.secretKey,
        'api-key': settings.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const directData = await directRes.json().catch(() => ({}));
    if (directRes.ok && directData.sessionUrl) {
      logKashierTransaction({
        orderId,
        userId: user?.id || 'guest',
        userName: user?.fullName || 'طالب طرقع',
        userEmail: user?.email || 'student@tarqa.app',
        amount,
        currency,
        status: 'PENDING',
        sessionUrl: directData.sessionUrl,
        details: 'تم إنشاء جلسة دفع كاشير رسمية بنجاح (اتصال مباشر)',
      });
      return {
        success: true,
        sessionUrl: directData.sessionUrl,
        sessionId: directData._id || directData.data?._id,
        orderId,
        isSimulated: false,
      };
    }
  } catch (directErr: any) {
    console.warn('[Kashier] Direct API call error, falling back to server endpoints:', directErr);
  }

  // 2. المحاولة عبر خادم PHP على هوستنجر (Hostinger Backend Endpoint)
  try {
    const phpRes = await fetch('/api/hostinger_api.php?action=create_kashier_session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        customMerchantId: settings.merchantId,
        customSecretKey: settings.secretKey,
        customApiKey: settings.apiKey,
      }),
    });

    const phpData = await phpRes.json().catch(() => ({}));
    if (phpRes.ok && phpData.sessionUrl) {
      logKashierTransaction({
        orderId,
        userId: user?.id || 'guest',
        userName: user?.fullName || 'طالب طرقع',
        userEmail: user?.email || 'student@tarqa.app',
        amount,
        currency,
        status: 'PENDING',
        sessionUrl: phpData.sessionUrl,
        details: 'تم إنشاء جلسة دفع كاشير موثقة بنجاح عبر سيرفر المنصة',
      });
      return {
        success: true,
        sessionUrl: phpData.sessionUrl,
        sessionId: phpData.sessionId || phpData._id,
        orderId,
        isSimulated: false,
      };
    }
  } catch (err: any) {}

  // 3. المحاولة عبر الدالة السحابية الآمنة (Vercel Serverless Endpoint)
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

    const data = await apiRes.json().catch(() => ({}));

    if (apiRes.ok && data.sessionUrl) {
      logKashierTransaction({
        orderId,
        userId: user?.id || 'guest',
        userName: user?.fullName || 'طالب طرقع',
        userEmail: user?.email || 'student@tarqa.app',
        amount,
        currency,
        status: 'PENDING',
        sessionUrl: data.sessionUrl,
        details: 'تم إنشاء جلسة دفع كاشير رسمية بنجاح (سيرفر)',
      });
      return {
        success: true,
        sessionUrl: data.sessionUrl,
        sessionId: data.sessionId || data._id,
        orderId,
        isSimulated: false,
      };
    }
  } catch (err: any) {}

  console.error('[Kashier] All session creation endpoints failed.');
  return {
    success: false,
    orderId,
    error: 'تعذر إنشاء جلسة الدفع، يرجى إعادة المحاولة لاحقاً أو التواصل مع الدعم.',
  };
};

/**
 * التحقق من نتيجة جلسة الدفع عبر Kashier API
 * GET /v3/payment/sessions/:sessionId/payment
 * وفق التوثيق الرسمي لـ Kashier
 */
export const verifyKashierPaymentSession = async (sessionId: string): Promise<{
  success: boolean;
  status?: string;
  data?: any;
  error?: string;
}> => {
  const settings = getKashierSettings();
  if (!settings.secretKey) {
    return { success: false, error: 'Secret Key is not configured' };
  }

  // 1. المحاولة عبر خادم المنصة المركزي لتفادي قيود CORS و Invalid Token في المتصفح
  try {
    const sRes = await fetch('/api/hostinger_api.php?action=verify_kashier_session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        customSecretKey: settings.secretKey,
        mode: settings.mode,
      }),
    });
    const sData = await sRes.json().catch(() => null);
    if (sData && sData.success) {
      return {
        success: true,
        status: sData.status || sData.data?.status || 'SUCCESS',
        data: sData.data,
      };
    }
    if (sData && sData.error) {
      return { success: false, error: sData.error };
    }
  } catch (backendErr) {
    console.warn('[kashierService] Backend verification fallback to direct API:', backendErr);
  }

  // 2. المحاولة المباشرة مع سيرفر كاشير
  try {
    const baseUrl = settings.mode === 'live'
      ? 'https://api.kashier.io'
      : 'https://test-api.kashier.io';

    const res = await fetch(`${baseUrl}/v3/payment/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': settings.secretKey,
        'api-key': settings.apiKey,
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err?.message || `HTTP ${res.status}` };
    }

    const json = await res.json();
    const dataObj = json?.data ?? json;
    const sessionStatus = (dataObj?.status || json?.status || 'PENDING').toUpperCase();
    const captured = Number(dataObj?.capturedAmount || 0);
    const isPaid = sessionStatus === 'SUCCESS' || sessionStatus === 'CAPTURED' || sessionStatus === 'PAID' || captured > 0;

    return {
      success: true,
      status: isPaid ? 'SUCCESS' : sessionStatus,
      data: dataObj,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network error' };
  }
};

