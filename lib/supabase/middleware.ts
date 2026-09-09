import { supabase } from '@/lib/supabase';

/**
 * تحديث جلسة المستخدم في بيئة المتصفح والـ SPA
 */
export async function updateSession(request?: any) {
  const { data: { user } } = await supabase.auth.getUser();
  return { user, supabase };
}

export const createClient = updateSession;
export default updateSession;
