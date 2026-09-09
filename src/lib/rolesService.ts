import { supabase, isSupabaseConfigured, authService, syncUserToMembersDashboard } from './supabase';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';

// الحساب الإداري المعتمد لمالك المنصة (Yoska)
const INITIAL_DEMO_USERS: UserWithRole[] = [
  {
    id: 'usr-admin-01',
    email: 'yassooooo27m@gmail.com',
    fullName: 'Yoska',
    role: 'super_admin',
    targetScore: 100,
    telegramUsername: 'yassien_ahmed',
    telegramId: 987654321,
    createdAt: '2024-01-01T10:00:00Z',
    lastSignInAt: new Date().toISOString(),
  },
];

// سجل التدقيق المبدئي (يبدأ فارغاً ويُسجل العمليات الحقيقية فقط)
const INITIAL_LOGS: RoleChangeLog[] = [];

export const rolesService = {
  // مزامنة وتسجيل أي عضو جديد فوراً
  registerOrSyncUser: (user: Partial<UserWithRole>) => {
    syncUserToMembersDashboard(user as any);
  },

  // جلب كافة المستخدمين والأعضاء المسجلين
  getUsers: async (): Promise<UserWithRole[]> => {
    let supabaseUsers: UserWithRole[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*');

        if (!error && data && data.length > 0) {
          const sorted = [...data].sort((a: any, b: any) => {
            const tA = new Date(a.created_at || a.updated_at || 0).getTime();
            const tB = new Date(b.created_at || b.updated_at || 0).getTime();
            return tB - tA;
          });

          supabaseUsers = sorted.map((d: any) => {
            const email = d.email || (d.telegram_username ? `@${d.telegram_username}` : `${d.id.substring(0, 8)}@user.tarqa`);
            const isOwner = email.toLowerCase() === 'yassooooo27m@gmail.com';
            return {
              id: d.id,
              email,
              fullName: isOwner ? (d.full_name && d.full_name !== 'طالب طرقع' ? d.full_name : 'Yoska') : (d.full_name || 'طالب طرقع'),
              role: isOwner ? 'super_admin' : ((d.role as UserRole) || 'student'),
              targetScore: d.target_score || 100,
              telegramUsername: d.telegram_username,
              telegramId: d.telegram_id,
              avatarUrl: d.avatar_url,
              createdAt: d.created_at || d.updated_at || new Date().toISOString(),
              lastSignInAt: d.last_sign_in_at || d.updated_at || d.created_at,
            };
          });
        }
      } catch (err) {
        console.warn('Failed to fetch from Supabase, using local state:', err);
      }
    }

    // قراءة المستخدمين المسجلين محلياً
    let localUsers: UserWithRole[] = [];
    try {
      const stored = localStorage.getItem('tarqa_all_users_roles');
      if (stored) {
        localUsers = JSON.parse(stored);
      }
    } catch {}

    // استيراد أي مستخدم جديد تم تسجيله في tarqa_registered_users
    try {
      const registered = localStorage.getItem('tarqa_registered_users');
      if (registered) {
        const regList = JSON.parse(registered);
        if (Array.isArray(regList)) {
          for (const ru of regList) {
            if (!localUsers.some(u => u.id === ru.id || (u.email && ru.email && u.email.toLowerCase() === ru.email.toLowerCase()))) {
              localUsers.push({
                id: ru.id || 'usr-' + Date.now(),
                email: ru.email,
                fullName: ru.fullName || 'طالب طرقع',
                role: ru.role || 'student',
                targetScore: ru.targetScore || 100,
                telegramUsername: ru.telegramUsername,
                telegramId: ru.telegramId,
                avatarUrl: ru.avatarUrl,
                createdAt: ru.createdAt || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {}

    // دمج قوائم المستخدمين لضمان عدم ضياع أي مستخدم سجل جديداً
    const userMap = new Map<string, UserWithRole>();

    // 1. إضافة مستخدمي Supabase
    for (const u of supabaseUsers) {
      const key = (u.email ? u.email.toLowerCase() : '') || u.id;
      userMap.set(key, u);
    }

    // 2. دمج المستخدمين المحليين
    for (const u of localUsers) {
      if (['usr-admin-02', 'usr-teacher-03', 'usr-teacher-04', 'usr-student-05', 'usr-student-06', 'usr-student-07'].includes(u.id)) continue;
      if (u.email?.endsWith('@student.com')) continue;
      if (u.email?.endsWith('@tarqa.app') && !u.email.startsWith('tg_')) continue;

      const key = (u.email ? u.email.toLowerCase() : '') || u.id;
      if (!userMap.has(key)) {
        userMap.set(key, u);
      }
    }

    let resultUsers = Array.from(userMap.values());

    // ضمان وجود الحساب الإداري الرئيسي (Yoska) في رأس القائمة كسوبر أدمن
    const yoska = resultUsers.find(u => u.email.toLowerCase() === 'yassooooo27m@gmail.com');
    if (yoska) {
      yoska.role = 'super_admin';
      yoska.fullName = 'Yoska';
    } else {
      resultUsers.unshift(INITIAL_DEMO_USERS[0]);
    }

    try {
      localStorage.setItem('tarqa_all_users_roles', JSON.stringify(resultUsers));
    } catch {}

    return resultUsers;
  },

  // جلب سجل التدقيق
  getAuditLogs: async (): Promise<RoleChangeLog[]> => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('role_change_logs')
          .select('id, admin_id, target_user_id, old_role, new_role, reason, created_at')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((l: any) => ({
            id: l.id,
            adminId: l.admin_id,
            targetUserId: l.target_user_id,
            oldRole: (l.old_role === 'super_admin' ? 'admin' : l.old_role) as UserRole,
            newRole: (l.new_role === 'super_admin' ? 'admin' : l.new_role) as UserRole,
            reason: l.reason,
            createdAt: l.created_at,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch audit logs from Supabase:', err);
      }
    }

    try {
      const stored = localStorage.getItem('tarqa_role_logs');
      if (stored) {
        const logs: RoleChangeLog[] = JSON.parse(stored);
        const realLogs = logs.filter(l => !['log-001', 'log-002'].includes(l.id));
        localStorage.setItem('tarqa_role_logs', JSON.stringify(realLogs));
        return realLogs;
      }
    } catch { }

    localStorage.setItem('tarqa_role_logs', JSON.stringify(INITIAL_LOGS));
    return INITIAL_LOGS;
  },

  // تعديل رتبة مستخدم (Update Role)
  updateUserRole: async (
    targetUserId: string,
    newRole: UserRole,
    reason?: string
  ): Promise<{ success: boolean; error?: string; updatedUser?: UserWithRole }> => {
    const currentUser = authService.getCurrentUser();

    // 1. التحقق من صلاحية مسؤول المنصة (Admin)
    const userEmail = currentUser?.email?.trim().toLowerCase();
    const isOwner = userEmail === 'yassooooo27m@gmail.com';
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || isOwner;
    if (!isAdmin) {
      return {
        success: false,
        error: 'عملية مرفوضة: صلاحية تعديل الرتب محصورة فقط بمسؤولي المنصة (Admins).',
      };
    }

    // جلب قائمة المستخدمين الحالية
    const users = await rolesService.getUsers();
    const targetUser = users.find((u) => u.id === targetUserId);

    if (!targetUser) {
      return { success: false, error: 'لم يتم العثور على المستخدم المطلوب' };
    }

    if (targetUser.role === newRole) {
      return { success: true, updatedUser: targetUser };
    }

    // منح رتبة السوبر أدمن محصور بمالك المنصة أو سوبر أدمن
    if (newRole === 'super_admin' && !isOwner && currentUser?.role !== 'super_admin') {
      return {
        success: false,
        error: 'منح رتبة السوبر أدمن محصور بمالك المنصة والسوبر أدمن حصراً.',
      };
    }

    // 3. محاولة التحديث في Supabase إن كان متاحاً
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUserId);

        if (error) throw error;
      } catch (err: any) {
        console.warn('Supabase role update error:', err);
      }
    }

    // 4. تحديث الحالة المحلية
    const updatedUsers = users.map((u) => {
      if (u.id === targetUserId) {
        return { ...u, role: newRole };
      }
      return u;
    });

    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedUsers));

    // إذا تم تعديل المستخدم المسجل حالياً، نحدث جلسته أيضاً
    if (currentUser && currentUser.id === targetUserId) {
      authService.switchRole(newRole);
    }

    // 5. تسجيل العملية في سجل التدقيق (Audit Log)
    const newLog: RoleChangeLog = {
      id: 'log-' + Date.now(),
      adminId: currentUser?.id || 'usr-admin-01',
      adminName: currentUser?.fullName || 'مسؤول المنصة',
      targetUserId: targetUser.id,
      targetUserName: targetUser.fullName,
      oldRole: targetUser.role,
      newRole,
      reason: reason || 'تعديل الصلاحية عبر لوحة إدارة المنصة',
      createdAt: new Date().toISOString(),
    };

    const currentLogs = await rolesService.getAuditLogs();
    const updatedLogs = [newLog, ...currentLogs];
    localStorage.setItem('tarqa_role_logs', JSON.stringify(updatedLogs));

    // إشعار التطبيق بالتغيير
    window.dispatchEvent(new Event('tarqa_roles_changed'));

    return {
      success: true,
      updatedUser: { ...targetUser, role: newRole },
    };
  },
};
