import { supabase, isSupabaseConfigured, authService } from './supabase';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';

// الحساب الإداري المعتمد لمالك المنصة (Yoska)
const INITIAL_DEMO_USERS: UserWithRole[] = [
  {
    id: 'usr-admin-01',
    email: 'yassoooo27m@gmail.com',
    fullName: 'Yoska',
    role: 'admin',
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
  // جلب كافة المستخدمين
  getUsers: async (): Promise<UserWithRole[]> => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, target_score, telegram_username, telegram_id, avatar_url, created_at, last_sign_in_at')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            email: d.email || `${d.id.substring(0, 8)}@user.tarqa`,
            fullName: d.full_name || 'مستخدم طرقع',
            role: (d.role as UserRole) || 'student',
            targetScore: d.target_score || 100,
            telegramUsername: d.telegram_username,
            telegramId: d.telegram_id,
            avatarUrl: d.avatar_url,
            createdAt: d.created_at || new Date().toISOString(),
            lastSignInAt: d.last_sign_in_at,
          }));
        }
      } catch (err) {
        console.warn('Failed to fetch from Supabase, using local state:', err);
      }
    }

    // القراءة من التخزين المحلي بعد تنظيف أي حسابات وهمية سابقة
    try {
      const stored = localStorage.getItem('tarqa_all_users_roles');
      if (stored) {
        let usersList: UserWithRole[] = JSON.parse(stored);
        
        // إزالة الحسابات الوهمية التجريبية السابقة (@tarqa.app و @student.com)
        usersList = usersList.filter(u => 
          (!u.email.endsWith('@tarqa.app') || u.email.startsWith('tg_')) && 
          !u.email.endsWith('@student.com') &&
          !['usr-admin-02', 'usr-teacher-03', 'usr-teacher-04', 'usr-student-05', 'usr-student-06', 'usr-student-07'].includes(u.id)
        );

        // تحويل أي حساب برتبة super_admin سابقة إلى admin
        usersList = usersList.map(u => u.role === 'super_admin' ? { ...u, role: 'admin' as UserRole } : u);

        const yoska = usersList.find((u) => 
          u.email.toLowerCase() === 'yassoooo27m@gmail.com' || 
          u.email.toLowerCase() === 'yassooooo27m@gmail.com'
        );

        if (yoska) {
          yoska.role = 'admin';
          yoska.fullName = 'Yoska';
        } else {
          usersList.unshift(INITIAL_DEMO_USERS[0]);
        }

        localStorage.setItem('tarqa_all_users_roles', JSON.stringify(usersList));
        return usersList;
      }
    } catch { }

    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(INITIAL_DEMO_USERS));
    return INITIAL_DEMO_USERS;
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
    const isOwner = userEmail === 'yassoooo27m@gmail.com' || userEmail === 'yassooooo27m@gmail.com';
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

    // تم إلغاء رتبة السوبر أدمن، لا يُسمح بالترقية إليها
    if (newRole === 'super_admin') {
      return {
        success: false,
        error: 'تم إلغاء رتبة السوبر أدمن في المنصة؛ أعلى رتبة إدارية هي مسؤول المنصة (Admin).',
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
