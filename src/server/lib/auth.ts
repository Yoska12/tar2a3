import { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from './db';
import { UserRole } from '../types/api.types';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  fullName?: string;
  targetScore?: number;
  role: UserRole;
}

export async function getAuthenticatedUser(req: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // 1. فحص ترويسات الميدلوير المحقونة مسبقاً (Fast Path)
    const forwardedUserId = req.headers.get('x-user-id');
    const forwardedRole = req.headers.get('x-user-role') as UserRole;
    if (forwardedUserId && forwardedRole) {
      return {
        id: forwardedUserId,
        email: req.headers.get('x-user-email') || undefined,
        fullName: req.headers.get('x-user-name') || 'طالب طرقع',
        targetScore: 100,
        role: forwardedRole,
      };
    }

    // 2. فحص ترويسة Authorization
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    }

    // 3. فحص ملفات تعريف الارتباط (Cookies) كبديل
    if (!token && req.cookies) {
      const cookieNames = ['sb-access-token', 'supabase-auth-token', 'sb-djkwgwdlygxqcateivbc-auth-token'];
      for (const name of cookieNames) {
        const c = req.cookies.get(name);
        if (c?.value) {
          token = c.value;
          break;
        }
      }
    }

    // 4. التحقق من التوكن عبر Supabase Auth
    if (token) {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.auth.getUser(token);

      if (!error && data.user) {
        // قراءة الدور من Custom Claims (app_metadata) المشفرة بالـ JWT
        const role: UserRole = 
          (data.user.app_metadata?.role as UserRole) || 
          (data.user.user_metadata?.role as UserRole) || 
          'student';

        return {
          id: data.user.id,
          email: data.user.email,
          fullName: data.user.user_metadata?.full_name || 'طالب طرقع',
          targetScore: Number(data.user.user_metadata?.target_score) || 100,
          role,
        };
      }
    }

    // 5. في بيئة التطوير والاختبار المحلي، دعم ترويسة x-user-id
    const devUserId = req.headers.get('x-user-id');
    if (devUserId) {
      return {
        id: devUserId,
        email: `${devUserId}@tarqa.local`,
        fullName: req.headers.get('x-user-name') || 'طالب طرقع التجريبي',
        targetScore: 100,
        role: (req.headers.get('x-user-role') as UserRole) || 'student',
      };
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
