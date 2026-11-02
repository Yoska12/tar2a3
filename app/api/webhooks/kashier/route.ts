import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// قراءة بيانات الاتصال بـ Supabase من متغيرات البيئة مع قيم احتياطية آمنة
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://djkwgwdlygxqcateivbc.supabase.co';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // التحقق من حالة نجاح الدفع من كاشير
    const isPaid =
      body.event === 'payment.paid' ||
      body.paymentStatus === 'SUCCESS' ||
      body.data?.paymentStatus === 'SUCCESS' ||
      body.status === 'SUCCESS' ||
      body.data?.status === 'SUCCESS';

    if (isPaid) {
      const payload = body.data || body;
      const customerEmail =
        payload.customer?.email ||
        body.customer?.email ||
        payload.metaData?.userEmail ||
        payload.merchantOrderId ||
        body.merchantOrderId;

      if (customerEmail) {
        const now = new Date().toISOString();
        const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

        // 1. تحديث حالة الاشتراك في قاعدة بيانات Supabase (جدول subscriptions)
        const { error } = await supabase
          .from('subscriptions')
          .update({
            status: 'active',
            updated_at: now,
          })
          .eq('email', customerEmail);

        if (error) {
          console.warn('تنبيه تحديث subscriptions، جاري المحاولة بالإدراج البديل:', error.message);
          // محاولة إدراج/تحديث السجل إذا لم يكن موجوداً مسبقاً
          await supabase
            .from('subscriptions')
            .upsert({
              email: customerEmail,
              status: 'active',
              updated_at: now,
              created_at: now,
            })
            .catch(() => {});
        }

        // 2. تحديث جدول profiles لمنح الطالب صلاحيات وتفعيل الاشتراك المباشر بالمنصة
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_status: 'active',
            subscription_expires_at: oneYearFromNow,
            updated_at: now,
          })
          .eq('email', customerEmail)
          .catch((e) => console.warn('تنبيه تحديث profiles:', e));
      }
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('خطأ في الـ Webhook:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * معالج الـ GET للتعامل مع إعادة توجيه المتصفح بعد الدفع
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get('orderId') || url.searchParams.get('order') || '';
    const paymentStatus = (url.searchParams.get('paymentStatus') || '').toUpperCase();

    const redirectUrl = new URL('/', req.url);
    if (paymentStatus === 'SUCCESS') {
      redirectUrl.searchParams.set('payment', 'kashier_done');
      redirectUrl.searchParams.set('status', 'success');
      redirectUrl.searchParams.set('order', orderId);
    } else {
      redirectUrl.searchParams.set('payment', 'kashier_cancelled');
    }

    return NextResponse.redirect(redirectUrl);
  } catch (e) {
    return NextResponse.redirect(new URL('/?payment=error', req.url));
  }
}
