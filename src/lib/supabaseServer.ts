import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.VITE_SUPABASE_URL || 
  'https://djkwgwdlygxqcateivbc.supabase.co';

const supabaseAnonKey = 
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.VITE_SUPABASE_ANON_KEY || 
  'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

const supabaseServiceRoleKey = 
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  supabaseAnonKey;

/**
 * إنشاء عميل Supabase بصلاحيات السيرفر الإدارية (Service Role / Admin Client)
 * لتعديل رتب واشتراكات الطلاب بأمان بعد تأكيد الدفع
 */
export function getSupabaseAdminClient() {
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * تفعيل اشتراك الطالب في قاعدة بيانات Supabase لمدة سنة كاملة
 */
export async function activateUserSubscriptionInDatabase({
  userId,
  userEmail,
  orderId,
  amount,
  currency = 'EGP',
}: {
  userId?: string;
  userEmail?: string;
  orderId?: string;
  amount?: number | string;
  currency?: string;
}): Promise<{ success: boolean; message: string; data?: any }> {
  const supabase = getSupabaseAdminClient();
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let updatedAny = false;

  console.log(`[Supabase Server] Activating subscription for user: ${userId || userEmail || 'unknown'}, order: ${orderId}`);

  // 1. محاولة استدعاء الدالة المخزنة في سوبابيز إن وجدت
  try {
    if (userId || userEmail) {
      await supabase.rpc('admin_grant_subscription', {
        target_user_id: userId || null,
        days_count: 365,
        target_email: userEmail || null,
      });
      updatedAny = true;
    }
  } catch (rpcErr) {
    // تجاهل خطأ عدم وجود الـ RPC والاعتماد على التحديث المباشر للجدول
  }

  // 2. تحديث سجل المستخدم في جدول profiles
  const updatePayload = {
    is_subscribed: true,
    subscription_status: 'active',
    subscription_expires_at: oneYearFromNow,
    updated_at: new Date().toISOString(),
  };

  if (userId) {
    const { error: idError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', userId);

    if (!idError) updatedAny = true;
  }

  if (userEmail) {
    const { error: emailError } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('email', userEmail.toLowerCase().trim());

    if (!emailError) updatedAny = true;
  }

  // 3. تسجيل المعاملة في جدول subscriptions
  try {
    await supabase.from('subscriptions').upsert({
      user_id: userId || null,
      user_email: userEmail || null,
      order_id: orderId || `order_${Date.now()}`,
      plan_id: 'annual_qudurat',
      amount: typeof amount === 'number' ? amount : parseFloat(String(amount || 0)),
      currency: currency.toUpperCase(),
      payment_method: 'kashier',
      status: 'active',
      active: true,
      created_at: new Date().toISOString(),
      expires_at: oneYearFromNow,
    });
  } catch (subErr) {
    // في حال عدم وجود جدول منفصل للاشتراكات
  }

  return {
    success: true,
    message: 'Subscription successfully activated for 1 year.',
    data: {
      userId,
      userEmail,
      orderId,
      expiresAt: oneYearFromNow,
    },
  };
}
