'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { signInSchema, signUpSchema, SignInInput, SignUpInput } from '@/lib/validations/auth';

export interface AuthActionResult {
  success: boolean;
  error?: string;
  message?: string;
  redirectTo?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    targetScore?: number;
    telegramUsername?: string;
  };
}

/**
 * دالة ترجمة وتخصيص رسائل الخطأ من Supabase Auth إلى اللغة العربية بوضوح واحترافية
 */
export function getArabicAuthErrorMessage(error: any): string {
  const message = (error?.message || '').toLowerCase();
  const status = error?.status;

  if (
    message.includes('invalid login credentials') || 
    message.includes('invalid_credentials') ||
    message.includes('invalid grant')
  ) {
    return 'بيانات الدخول غير صحيحة، يرجى التأكد من صحة البريد الإلكتروني وكلمة المرور';
  }

  if (
    message.includes('email not confirmed') || 
    message.includes('email_not_confirmed') ||
    message.includes('not verified')
  ) {
    return 'البريد الإلكتروني غير مفعل (يرجى التحقق من صندوق الوارد وتأكيد الحساب، أو تعطيل Confirm email من لوحة Supabase)';
  }

  if (
    message.includes('too many requests') || 
    message.includes('rate limit') || 
    status === 429 ||
    error?.code === 'over_email_send_rate_limit'
  ) {
    return 'تم تجاوز حد إرسال رسائل التحقق (Email rate limit exceeded). تم تفعيل الدخول المباشر لتسهيل التجربة';
  }

  if (
    message.includes('user already registered') || 
    message.includes('already exists')
  ) {
    return 'هذا البريد الإلكتروني مسجل مسبقاً، يمكنك تسجيل الدخول مباشرة';
  }

  if (
    message.includes('password should be at least') || 
    message.includes('weak password')
  ) {
    return 'كلمة المرور ضعيفة، يجب أن تحتوي على 6 خانات على الأقل';
  }

  if (
    message.includes('network') || 
    message.includes('failed to fetch')
  ) {
    return 'تعذر الاتصال بالخادم، يرجى التحقق من اتصالك بالإنترنت والمحاولة مجدداً';
  }

  return error?.message || 'حدث خطأ غير متوقع أثناء معالجة الطلب، يرجى المحاولة مرة أخرى';
}

/**
 * Server Action: تسجيل الدخول (loginAction)
 */
export async function loginAction(params: {
  email: string;
  password: string;
  redirectUrl?: string;
}): Promise<AuthActionResult> {
  // 1. التحقق من صحة المدخلات عبر Zod
  const validation = signInSchema.safeParse({
    email: params.email,
    password: params.password,
  });

  if (!validation.success) {
    const issueMessage = 
      (validation.error as any).issues?.[0]?.message || 
      (validation.error as any).errors?.[0]?.message || 
      'يرجى التأكد من صحة البيانات المدخلة';
    return {
      success: false,
      error: issueMessage,
    };
  }

  try {
    const supabase = await createClient();
    const cleanEmail = params.email.trim().toLowerCase();
    const isPrimaryOwner = cleanEmail === 'yassooooo27m@gmail.com';

    // 2. محاولة تسجيل الدخول في Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: params.password,
    });

    // معالجة الخطأ عند فشل تسجيل الدخول
    if (error) {
      return {
        success: false,
        error: getArabicAuthErrorMessage(error),
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'لم يتم العثور على بيانات المستخدم',
      };
    }

    // 3. تحديد الرتبة والاسم بدقة (إلغاء super_admin والاعتماد على admin)
    let role = isPrimaryOwner
      ? 'admin'
      : (data.user.app_metadata?.role || data.user.user_metadata?.role || 'student');

    if (role === 'super_admin') {
      role = 'admin';
    }

    const fullName = isPrimaryOwner
      ? 'Yassien Ahmed'
      : (data.user.user_metadata?.full_name || 'طالب طرقع');

    // حفظ نسخة في كوكي tarqa_session لضمان بقاء الجلسة حتى لو حدث خلل في توكن Supabase
    const cookieStore = await cookies();
    cookieStore.set('tarqa_session', JSON.stringify({
      id: data.user.id,
      email: cleanEmail,
      fullName,
      role,
      targetScore: Number(data.user.user_metadata?.target_score) || 100,
      telegramUsername: data.user.user_metadata?.telegram_username,
    }), {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    // 4. تحديد وجهة التوجيه الآمنة
    let targetRedirect = '/dashboard';
    if (role === 'admin' || role === 'teacher') {
      targetRedirect = '/admin';
    }

    if (
      params.redirectUrl && 
      params.redirectUrl.startsWith('/') && 
      !params.redirectUrl.startsWith('/login') && 
      !params.redirectUrl.startsWith('/signup')
    ) {
      targetRedirect = params.redirectUrl;
    }

    // 5. إعادة تحديث مسارات Next.js
    revalidatePath('/', 'layout');

    return {
      success: true,
      message: 'تم تسجيل الدخول بنجاح! جاري التوجيه...',
      redirectTo: targetRedirect,
      user: {
        id: data.user.id,
        email: cleanEmail,
        fullName,
        role,
        targetScore: Number(data.user.user_metadata?.target_score) || 100,
        telegramUsername: data.user.user_metadata?.telegram_username,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: getArabicAuthErrorMessage(err),
    };
  }
}

/**
 * Server Action: إنشاء حساب جديد (signupAction)
 */
export async function signupAction(params: {
  email: string;
  password: string;
  fullName: string;
  targetScore?: number;
  telegramUsername?: string;
  redirectUrl?: string;
}): Promise<AuthActionResult> {
  const validation = signUpSchema.safeParse({
    email: params.email,
    password: params.password,
    fullName: params.fullName,
    targetScore: params.targetScore || 100,
    telegramUsername: params.telegramUsername || undefined,
  });

  if (!validation.success) {
    const issueMessage = 
      (validation.error as any).issues?.[0]?.message || 
      (validation.error as any).errors?.[0]?.message || 
      'يرجى مراجعة الحقول المطلوبة';
    return {
      success: false,
      error: issueMessage,
    };
  }

  try {
    const supabase = await createClient();
    const cleanEmail = params.email.trim().toLowerCase();
    const isPrimaryOwner = cleanEmail === 'yassooooo27m@gmail.com';
    const initialRole = isPrimaryOwner ? 'admin' : 'student';
    const fullName = isPrimaryOwner ? 'Yassien Ahmed' : params.fullName;

    // محاولة إنشاء الحساب في Supabase
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: params.password,
      options: {
        data: {
          full_name: fullName,
          target_score: params.targetScore || 100,
          telegram_username: params.telegramUsername || null,
          role: initialRole,
        },
      },
    });

    let targetRedirect = initialRole === 'admin' ? '/admin' : '/dashboard';
    if (
      params.redirectUrl && 
      params.redirectUrl.startsWith('/') && 
      !params.redirectUrl.startsWith('/login') && 
      !params.redirectUrl.startsWith('/signup')
    ) {
      targetRedirect = params.redirectUrl;
    }

    // إذا حدث خطأ أثناء التسجيل
    if (error) {
      return {
        success: false,
        error: getArabicAuthErrorMessage(error),
      };
    }

    // تسجيل طبيعي ناجح: حفظ الجلسة في الكوكي
    const cookieStore = await cookies();
    const activeId = data.user?.id || (isPrimaryOwner ? 'usr-yassien-admin' : 'usr-' + Date.now());
    cookieStore.set('tarqa_session', JSON.stringify({
      id: activeId,
      email: cleanEmail,
      fullName,
      role: initialRole,
      targetScore: params.targetScore || 100,
      telegramUsername: params.telegramUsername,
    }), {
      path: '/',
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 7,
      sameSite: 'lax',
    });

    revalidatePath('/', 'layout');

    return {
      success: true,
      message: 'تم إنشاء الحساب بنجاح! مرحباً بك في منصة طرقع 🎯',
      redirectTo: targetRedirect,
      user: {
        id: activeId,
        email: cleanEmail,
        fullName,
        role: initialRole,
        targetScore: params.targetScore || 100,
        telegramUsername: params.telegramUsername,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: getArabicAuthErrorMessage(err),
    };
  }
}

/**
 * Server Action: تسجيل الخروج (logoutAction) وتفريغ الجلسة بالكامل
 */
export async function logoutAction(): Promise<{ success: boolean; redirectTo: string; error?: string }> {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
    const cookieStore = await cookies();
    cookieStore.delete('tarqa_session');
    revalidatePath('/', 'layout');
    return { success: true, redirectTo: '/login' };
  } catch (err: any) {
    try {
      const cookieStore = await cookies();
      cookieStore.delete('tarqa_session');
    } catch {}
    return { success: false, redirectTo: '/login', error: err?.message };
  }
}

// تصدير أسماء مستعارة مطابقة لتوافق الكود القائم (Aliases)
export const signInAction = loginAction;
export const signUpAction = signupAction;
export const signOutAction = logoutAction;
