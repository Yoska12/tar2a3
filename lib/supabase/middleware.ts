import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://djkwgwdlygxqcateivbc.supabase.co';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

/**
 * تحديث جلسة المستخدم في الـ Middleware وتجديد الـ JWT Token تلقائياً عند كل طلب
 * متوافق تماماً مع توثيق @supabase/ssr الرسمي لـ Next.js App Router
 * يقوم بإعادة كتابة الـ Cookies في كل من Request و Response لمنع فقدان الجلسة
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ⚠️ تحذير أمني: نستخدم getUser() حصراً وليس getSession() 
  // لتجنب قراءة التوكنات المنتهية أو غير الصالحة من الكاش
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { supabaseResponse, user, supabase };
}

export const createClient = updateSession;
export default updateSession;
