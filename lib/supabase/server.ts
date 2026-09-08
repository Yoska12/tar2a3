import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  'https://djkwgwdlygxqcateivbc.supabase.co';

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 
  'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

/**
 * عميل Supabase للسيرفر (Server Client)
 * يُستخدم داخل: Server Components و Server Actions و Route Handlers
 * يدعم قراءة وتعيين الـ Cookies بدقة وفق أحدث معايير @supabase/ssr
 */
export async function createClient(customCookieStore?: any) {
  const cookieStore = customCookieStore 
    ? (typeof customCookieStore.then === 'function' ? await customCookieStore : customCookieStore)
    : await cookies();

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // يتم تجاهل هذا الخطأ إذا تم استدعاء `setAll` من داخل Server Component
            // حيث يتم إدارة تحديث التوكن عبر Middleware
          }
        },
      },
    }
  );
}

export default createClient;
