import crypto from 'crypto';

export interface KashierOrderParams {
  merchantId?: string;
  orderId: string;
  amount: number | string;
  currency: 'EGP' | 'SAR' | string;
  secretKey?: string;
}

export interface GeneratedKashierHashResult {
  hash: string;
  path: string;
  queryPath: string;
  queryHash: string;
  merchantId: string;
  orderId: string;
  amount: string;
  currency: string;
  checkoutUrl: string;
}

/**
 * جلب مفتاح السر الافتراضي لكاشير من متغيرات البيئة
 */
export function getKashierSecretKey(): string {
  return (
    process.env.KASHIER_SECRET_KEY ||
    process.env.VITE_KASHIER_SECRET_KEY ||
    'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b'
  );
}

/**
 * جلب المعرف التجاري لكاشير
 */
export function getKashierMerchantId(): string {
  return (
    process.env.KASHIER_MERCHANT_ID ||
    process.env.NEXT_PUBLIC_KASHIER_MERCHANT_ID ||
    process.env.VITE_KASHIER_MERCHANT_ID ||
    'MID-50598-297'
  );
}

/**
 * جلب مفتاح الآي فريم (KASHIER_IFRAME_KEY)
 */
export function getKashierIframeKey(): string {
  return (
    process.env.KASHIER_IFRAME_KEY ||
    process.env.NEXT_PUBLIC_KASHIER_IFRAME_KEY ||
    process.env.VITE_KASHIER_IFRAME_KEY ||
    '91bdc6e4-423d-4bcb-91ef-a27485a465d1'
  );
}

/**
 * جلب الرابط الأساسي لكاشير
 */
export function getKashierBaseUrl(): string {
  return (
    process.env.KASHIER_BASE_URL ||
    process.env.NEXT_PUBLIC_KASHIER_BASE_URL ||
    process.env.VITE_KASHIER_BASE_URL ||
    'https://checkout.kashier.io'
  );
}

/**
 * توليد توقيع / هاش الدفع الآمن وفق خوارزمية HMAC-SHA256 المعتمدة من Kashier
 */
export function generateKashierOrderHash(params: KashierOrderParams): GeneratedKashierHashResult {
  const merchantId = (params.merchantId || getKashierMerchantId()).trim();
  const orderId = String(params.orderId).trim();
  const iframeKey = getKashierIframeKey();
  const secretKey = (params.secretKey || iframeKey || getKashierSecretKey()).trim();
  const baseUrl = (process.env.KASHIER_BASE_URL || 'https://payments.kashier.io').replace(/\/+$/, '');

  // تنسيق المبلغ بدقة عشرية مطابقة لاشتراطات كاشير
  const numericAmount = typeof params.amount === 'number' ? params.amount : parseFloat(String(params.amount));
  const amount = isNaN(numericAmount) ? '1' : (numericAmount % 1 === 0 ? numericAmount.toString() : numericAmount.toFixed(2));
  const currency = (params.currency || 'EGP').trim().toUpperCase();

  // 1. الصيغة المعيارية الأولى (Canonical Path): /?payment=mid.orderId.amount.currency
  const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(path)
    .digest('hex');

  // 2. الصيغة التوافقية الثانية للـ iFrame (Query Path): ?payment=mid=...&orderId=...
  const queryPath = `?payment=mid=${merchantId}&orderId=${orderId}&amount=${amount}&currency=${currency}`;
  const queryHash = crypto
    .createHmac('sha256', secretKey)
    .update(queryPath)
    .digest('hex');

  // رابط التوجيه المباشر النهائي إلى payments.kashier.io
  const checkoutUrl = `${baseUrl}/?merchantId=${merchantId}&order=${orderId}&orderId=${orderId}&amount=${amount}&currency=${currency}&mode=live&hash=${hash}&merchantRedirect=${encodeURIComponent('https://tarqa3.net/?payment=kashier_done&order=' + orderId)}`;

  return {
    hash,
    path,
    queryPath,
    queryHash,
    merchantId,
    orderId,
    amount,
    currency,
    checkoutUrl,
  };
}

/**
 * التحقق الآمن من توقيع الويب هوك أو رد كاشير المشفر (Webhook Signature Verification)
 * لمنع التلاعب وتزوير العمليات عبر فحص Constant-time timingSafeEqual
 */
export function verifyKashierSignature(
  payload: Record<string, any>,
  receivedSignature?: string,
  customSecret?: string
): boolean {
  try {
    const signatureToVerify = receivedSignature || payload.signature;
    if (!signatureToVerify) {
      return false;
    }

    const secretKey = customSecret || getKashierSecretKey() || getKashierIframeKey();
    if (!secretKey) {
      return false;
    }

    // بناء النص المشفر عبر جمع الحقول ما عدا signature و mode
    const keys = Object.keys(payload)
      .filter((k) => k !== 'signature' && k !== 'mode' && payload[k] !== undefined && payload[k] !== null && typeof payload[k] !== 'object')
      .sort();

    let queryString = '';
    for (const key of keys) {
      queryString += `&${key}=${payload[key]}`;
    }
    queryString = queryString.replace(/^&/, '');

    const calculatedSig1 = crypto
      .createHmac('sha256', secretKey)
      .update(queryString)
      .digest('hex');

    // محاولة مقارنة التوقيع الأول
    if (safeCompare(calculatedSig1, signatureToVerify)) {
      return true;
    }

    // محاولة مطابقة ثانية باستخدام مفتاح الآي فريم البديل إن كان مختلفاً
    const iframeKey = getKashierIframeKey();
    if (iframeKey && iframeKey !== secretKey) {
      const calculatedSig2 = crypto
        .createHmac('sha256', iframeKey)
        .update(queryString)
        .digest('hex');

      if (safeCompare(calculatedSig2, signatureToVerify)) {
        return true;
      }
    }

    // فحص بديل إذا كانت كاشير ترسل الصيغة المعيارية: /?payment=mid.orderId.amount.currency
    if (payload.merchantOrderId || payload.orderId) {
      const orderId = payload.merchantOrderId || payload.orderId;
      const amount = Number(payload.amount).toFixed(2);
      const currency = payload.currency || 'EGP';
      const mid = payload.merchantId || getKashierMerchantId();
      const canonicalPath = `/?payment=${mid}.${orderId}.${amount}.${currency}`;

      const canonicalSig = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPath)
        .digest('hex');

      if (safeCompare(canonicalSig, signatureToVerify)) {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('[Kashier] Signature verification exception:', err);
    return false;
  }
}

/**
 * مقارنة آمنة للهاش تمنع هجمات التوقيت (Timing Attacks)
 */
function safeCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a.toLowerCase().trim());
  const bufB = Buffer.from(b.toLowerCase().trim());
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
