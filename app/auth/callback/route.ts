import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Route Handler: تبادل كود المصادقة (Auth Callback / PKCE Code Exchange)
 * يُستخدم عند العودة من روابط تأكيد البريد، إعادة تعيين كلمة المرور، أو تسجيل الدخول الخارجي
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const rawNext = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect') || '/dashboard';
  const origin = requestUrl.origin;

  // التحقق من أن مسار التوجيه نسبي وآمن
  let nextDestination = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data?.session) {
        const user = data.user;
        const role = user?.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com'
          ? 'admin'
          : ((user?.app_metadata?.role === 'super_admin' ? 'admin' : user?.app_metadata?.role) || user?.user_metadata?.role || 'student');

        // توجيه الأدمن تلقائياً إلى لوحة الإدارة إذا كانت الوجهة الافتراضية
        if (nextDestination === '/dashboard' && (role === 'admin' || role === 'super_admin')) {
          nextDestination = '/admin';
        }

        return NextResponse.redirect(`${origin}${nextDestination}`);
      }
    } catch (err) {
      console.error('Auth Callback Error:', err);
    }
  }

  // في حال فشل الكود أو انتهاء صلاحيته، يتم تحويل المستخدم لصفحة الدخول مع رسالة خطأ واضحة
  return NextResponse.redirect(`${origin}/login?error=auth_code_invalid`);
}
