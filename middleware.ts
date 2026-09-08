import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

export async function middleware(request: NextRequest) {
  // 1. تحديث والتحقق من جلسة التوكن عبر updateSession المعتمدة لـ @supabase/ssr
  const { supabaseResponse, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  // 2. حالة الزائر (Guest State): إذا كانت قيمة user فارغة (null)
  if (!user) {
    // إزالة أي كوكيز جلسات قديمة معلقة لمنع الخلط الأمني
    if (request.cookies.has('tarqa_session')) {
      supabaseResponse.cookies.delete('tarqa_session');
    }

    // المسارات المحمية التي تتطلب تسجيل الدخول صراحة
    const protectedPaths = [
      '/dashboard',
      '/admin',
      '/teacher',
      '/classroom',
      '/attempts',
      '/profile',
    ];
    const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

    if (isProtected) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // الزائر مسموح له بالوصول إلى الصفحات العامة (الرئيسية، التأسيس، تسجيل الدخول، إلخ)
    // لا يتم تمرير أي ترويسات مستخدم أو هويات إطلاقاً
    return supabaseResponse;
  }

  // 3. حالة المستخدم المسجل والموثق من جلسة Supabase الحقيقية (Authenticated User)
  const isOwner = user.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com';
  let userRole: UserRole = 
    (user.app_metadata?.role as UserRole) || 
    (user.user_metadata?.role as UserRole) || 
    'student';

  if (isOwner || userRole === 'super_admin') {
    userRole = 'admin';
  }

  // إذا كان المستخدم مسجلاً بالفعل وحاول فتح صفحة تسجيل الدخول أو إنشاء الحساب:
  const isAuthPage = pathname === '/login' || pathname === '/signup';
  if (isAuthPage) {
    const rawRedirect = request.nextUrl.searchParams.get('redirect') || 
                        request.nextUrl.searchParams.get('redirectTo');
    
    let destination = (userRole === 'admin' || userRole === 'teacher') ? '/admin' : '/dashboard';
    if (
      rawRedirect && 
      rawRedirect.startsWith('/') && 
      !rawRedirect.startsWith('/login') && 
      !rawRedirect.startsWith('/signup')
    ) {
      destination = rawRedirect;
    }

    return NextResponse.redirect(new URL(destination, request.url));
  }

  // 4. حماية المسارات الإدارية الخاصة بالأدوار (RBAC)
  // مسار إدارة الرتب والمسارات الإدارية العامة (/admin/*)
  if (pathname.startsWith('/admin')) {
    if (userRole !== 'admin') {
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('required', 'admin');
      unauthorizedUrl.searchParams.set('current', userRole);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // مسارات المعلمين (/teacher/*)
  if (pathname.startsWith('/teacher')) {
    if (userRole !== 'teacher' && userRole !== 'admin') {
      const unauthorizedUrl = new URL('/unauthorized', request.url);
      unauthorizedUrl.searchParams.set('required', 'teacher');
      unauthorizedUrl.searchParams.set('current', userRole);
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  // 5. تمرير بيانات الهوية الموثقة عبر ترويسات الاستجابة للسيرفر
  supabaseResponse.headers.set('x-user-id', user.id);
  supabaseResponse.headers.set('x-user-role', userRole);
  supabaseResponse.headers.set('x-user-email', user.email || '');

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * استثناء ملفات الـ Next.js الثابتة والصور ومسارات الـ API العامة والأيقونات
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
