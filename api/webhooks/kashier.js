import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const KASHIER_SECRET_KEY =
  process.env.KASHIER_SECRET_KEY ||
  'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b';
const KASHIER_IFRAME_KEY =
  process.env.KASHIER_IFRAME_KEY || '91bdc6e4-423d-4bcb-91ef-a27485a465d1';
const KASHIER_MERCHANT_ID =
  process.env.KASHIER_MERCHANT_ID || 'MID-50598-297';

function verifySignature(payload, signature) {
  if (!signature) return false;
  try {
    const keys = Object.keys(payload)
      .filter((k) => k !== 'signature' && k !== 'mode' && payload[k] !== undefined && payload[k] !== null && typeof payload[k] !== 'object')
      .sort();

    let queryString = '';
    for (const key of keys) {
      queryString += `&${key}=${payload[key]}`;
    }
    queryString = queryString.replace(/^&/, '');

    const sig1 = crypto.createHmac('sha256', KASHIER_SECRET_KEY).update(queryString).digest('hex');
    if (sig1.toLowerCase() === signature.toLowerCase()) return true;

    if (KASHIER_IFRAME_KEY) {
      const sig2 = crypto.createHmac('sha256', KASHIER_IFRAME_KEY).update(queryString).digest('hex');
      if (sig2.toLowerCase() === signature.toLowerCase()) return true;
    }

    if (payload.orderId || payload.merchantOrderId) {
      const orderId = payload.orderId || payload.merchantOrderId;
      const amount = Number(payload.amount).toFixed(2);
      const curr = payload.currency || 'EGP';
      const path = `/?payment=${KASHIER_MERCHANT_ID}.${orderId}.${amount}.${curr}`;
      const sig3 = crypto.createHmac('sha256', KASHIER_SECRET_KEY).update(path).digest('hex');
      if (sig3.toLowerCase() === signature.toLowerCase()) return true;
    }

    return false;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

async function activateSubscription({ userId, userEmail, orderId, amount, currency }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[Webhook] Missing Supabase admin credentials');
    return { success: false, error: 'Database service credentials missing' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  let targetId = userId;
  if (!targetId && userEmail) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail.toLowerCase().trim())
      .single();
    if (profile?.id) targetId = profile.id;
  }

  if (targetId) {
    await supabase
      .from('profiles')
      .update({
        is_subscribed: true,
        subscription_status: 'active',
        subscription_expires_at: expiresAt.toISOString(),
      })
      .eq('id', targetId);
  }

  await supabase.from('subscriptions').insert({
    user_id: targetId || null,
    order_id: orderId,
    amount: Number(amount) || 0,
    currency: currency || 'EGP',
    status: 'active',
    payment_gateway: 'kashier',
    created_at: new Date().toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return { success: true, targetId, expiresAt: expiresAt.toISOString() };
}

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-kashier-signature, kashier-signature');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    const params = req.query || {};
    const paymentStatus = String(params.paymentStatus || params.status || '').toUpperCase();
    const orderId = params.orderId || params.order || '';
    const signature = params.signature || params.hash || '';

    // ✅ التحقق من صحة الـ signature قبل أي تفعيل
    if (paymentStatus === 'SUCCESS' && orderId) {
      // بناء payload للتحقق من الـ signature
      const verifyPayload = { ...params };
      delete verifyPayload.signature;
      delete verifyPayload.hash;

      const isValid = signature && verifySignature(verifyPayload, signature);

      if (!isValid) {
        console.warn('[Webhook GET] Invalid or missing signature for orderId:', orderId);
        // نوجه لصفحة الدورات بدون تفعيل – المتصفح سيعرض إشعار خطأ
        return res.redirect(`/?payment=kashier_invalid&status=error&order=${orderId}`);
      }

      let userId = params.userId || '';
      if (!userId && orderId.startsWith('tarqa_')) {
        const parts = orderId.split('_');
        if (parts.length >= 2) userId = parts[1];
      }

      await activateSubscription({
        userId,
        userEmail: params.userEmail,
        orderId,
        amount: params.amount,
        currency: params.currency || 'EGP',
      });

      return res.redirect(`/?payment=kashier_done&status=success&order=${orderId}`);
    }

    return res.redirect(`/?payment=kashier_cancelled&status=failed`);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let rawBody = req.body;
    if (typeof rawBody === 'string') {
      try {
        rawBody = JSON.parse(rawBody);
      } catch {
        rawBody = {};
      }
    }
    rawBody = rawBody || {};

    const payload = rawBody.data || rawBody;
    const signature =
      req.headers['x-kashier-signature'] ||
      req.headers['kashier-signature'] ||
      payload.signature ||
      rawBody.signature;

    const isSignatureValid = verifySignature(payload, signature);

    // ✅ رفض أي طلب بتوقيع مزوّر أو مفقود
    if (!isSignatureValid) {
      console.warn('[Webhook POST] Invalid or missing signature. Rejecting request.');
      return res.status(401).json({ error: 'Invalid signature. Request rejected.' });
    }

    const eventType = String(rawBody.event || rawBody.type || '').toLowerCase();
    const paymentStatus = String(payload.paymentStatus || payload.status || rawBody.status || '').toUpperCase();

    const isSuccessful =
      eventType === 'payment.paid' ||
      eventType === 'order.paid' ||
      paymentStatus === 'SUCCESS' ||
      paymentStatus === 'PAID' ||
      paymentStatus === 'CAPTURED';

    if (!isSuccessful) {
      return res.status(200).json({ success: true, message: 'Non-success event acknowledged' });
    }

    const orderId = payload.orderId || payload.merchantOrderId || rawBody.orderId || '';
    const amount = payload.amount || rawBody.amount;
    const currency = payload.currency || rawBody.currency || 'EGP';

    const metaData = payload.metaData || payload.metadata || rawBody.metaData || {};
    const customer = payload.customer || rawBody.customer || {};

    let userId = metaData.userId || customer.reference || '';
    let userEmail = customer.email || metaData.userEmail || '';

    if (!userId && orderId.startsWith('tarqa_')) {
      const parts = orderId.split('_');
      if (parts.length >= 2) userId = parts[1];
    }

    const result = await activateSubscription({
      userId,
      userEmail,
      orderId,
      amount,
      currency,
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription activated',
      result,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
