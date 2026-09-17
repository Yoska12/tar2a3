import { getSupabaseAdminClient } from './db';
import { UserRole } from '../types/api.types';

export type NextRequest = Request & { cookies?: { get: (name: string) => { value: string } | undefined } | any };

export interface AuthenticatedUser {
  id: string;
  email?: string;
  fullName?: string;
  targetScore?: number;
  role: UserRole;
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // 1. فحص ترويسة Authorization الصريحة (Bearer JWT Token)
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 2. فحص ملفات تعريف الارتباط الآمنة (Cookies)
    if (!token && req.cookies) {
      let projectRef = '';
      try {
        const rawUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        if (rawUrl) {
          projectRef = new URL(rawUrl).hostname.split('.')[0];
        }
      } catch {
        // ignore url parsing error
      }
      const cookieNames = [
        'sb-access-token', 
        'supabase-auth-token',
        ...(projectRef ? [`sb-${projectRef}-auth-token`] : []),
      ];
      for (const name of cookieNames) {
        const c = req.cookies.get(name);
        if (c?.value) {
          token = c.value;
          break;
        }
      }
    }

    // 3. التحقق الأمني من التوكن المشفر عبر Supabase Auth (Cryptographically Verified)
    if (token) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (!error && data.user) {
        // قراءة الدور المعتمد حصراً من Custom Claims المشفرة في app_metadata (Server-Controlled Only)
        // تحذير أمني: لا نثق إطلاقاً في user_metadata لمنع التلاعب بالصلاحيات عبر /auth/v1/signup
        let role: UserRole = (data.user.app_metadata?.role as UserRole);

        // في حال لم تكن Claims محدثة في التوكن، نقرأ الرتبة الحقيقية الموثقة من جدول profiles عبر السيرفر
        if (!role) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.user.id)
            .maybeSingle();
          role = (profile?.role as UserRole) || 'student';
        }

        return {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || 'طالب طرقع',
          targetScore: Number(data.user.user_metadata?.target_score) || 100,
          role,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('[AuthHelper] Failed to authenticate user:', err);
    return null;
  }
}

/**
 * التحقق من تسجيل دخول المستخدم وتطابق أحد الأدوار المصرح بها
 */
export async function requireRole(
  req: NextRequest, 
  allowedRoles: UserRole[]
): Promise<{ user: AuthenticatedUser } | { error: string; status: number }> {
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return { error: 'يجب تسجيل الدخول للوصول إلى هذا المسار', status: 401 };
  }

  // المدير يمتلك الوصول دائماً
  if (user.role === 'admin' || allowedRoles.includes(user.role)) {
    return { user };
  }

  return { 
    error: `غير مصرح لك بتنفيذ هذه العملية. الدور المطلوب: [${allowedRoles.join(', ')}] بينما دورك الحالي: [${user.role}]`, 
    status: 403 
  };
}

/**
 * فحص الصلاحية الإدارية حصراً (Admin Only)
 */
export async function requireAdmin(req: NextRequest) {
  return requireRole(req, ['admin']);
}

/**
 * فحص صلاحية المعلمين والمدراء (Teacher or Admin)
 */
export async function requireTeacher(req: NextRequest) {
  return requireRole(req, ['teacher', 'admin']);
}
