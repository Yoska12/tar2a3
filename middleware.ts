import { updateSession } from '@/lib/supabase/middleware';

export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

/**
 * دالة التحقق من جلسة المستخدم في بيئة الـ Client/SPA
 */
export async function middleware(request?: any) {
  const { user, supabase } = await updateSession(request);
  return { user, supabase };
}

export default middleware;
