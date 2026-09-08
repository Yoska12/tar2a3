import { supabase, isSupabaseConfigured, authService } from './supabase';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';

// بيانات أولية للمستخدمين للاختبار والمعاينة الفورية (Initial Demo Users)
const INITIAL_DEMO_USERS: UserWithRole[] = [
  {
    id: 'usr-admin-01',
    email: 'yassooooo27m@gmail.com',
    fullName: 'Yassien Ahmed',
    role: 'admin',
    targetScore: 100,
    telegramUsername: 'yassien_ahmed',
    telegramId: 987654321,
    createdAt: '2024-01-01T10:00:00Z',
    lastSignInAt: '2024-05-18T14:30:00Z',
  },
  {
    id: 'usr-admin-02',
    email: 'admin@tarqa.app',
    fullName: 'أ. عبد الرحمن الشريف',
    role: 'admin',
    targetScore: 100,
    telegramUsername: 'abdulrahman_sharif',
    telegramId: 876543210,
    createdAt: '2024-01-15T12:00:00Z',
    lastSignInAt: '2024-05-18T11:20:00Z',
  },
  {
    id: 'usr-teacher-03',
    email: 'reem.teacher@tarqa.app',
    fullName: 'م. ريم الغامدي',
    role: 'teacher',
    targetScore: 100,
    telegramUsername: 'reem_math',
    telegramId: 765432109,
    createdAt: '2024-02-01T09:00:00Z',
    lastSignInAt: '2024-05-17T18:45:00Z',
  },
  {
    id: 'usr-teacher-04',
    email: 'fahad.math@tarqa.app',
    fullName: 'أ. فهد العتيبي (الحساب الذهني)',
    role: 'teacher',
    targetScore: 100,
    telegramUsername: 'fahad_speed',
    telegramId: 654321098,
    createdAt: '2024-02-10T15:00:00Z',
    lastSignInAt: '2024-05-16T20:10:00Z',
  },
  {
    id: 'usr-student-05',
    email: 'mohammed@student.com',
    fullName: 'محمد الدوسري',
    role: 'student',
    targetScore: 98,
    telegramUsername: 'mohammed_d',
    createdAt: '2024-03-05T16:00:00Z',
    lastSignInAt: '2024-05-18T08:00:00Z',
  },
  {
    id: 'usr-student-06',
    email: 'sara@student.com',
    fullName: 'سارة الشهري',
    role: 'student',
    targetScore: 100,
    telegramUsername: 'sara_q',
    createdAt: '2024-03-12T11:00:00Z',
    lastSignInAt: '2024-05-17T22:15:00Z',
  },
  {
    id: 'usr-student-07',
    email: 'khaled@student.com',
    fullName: 'خالد المطيري',
    role: 'student',
    targetScore: 95,
    telegramUsername: 'khaled_m',
    createdAt: '2024-04-01T13:30:00Z',
    lastSignInAt: '2024-05-15T19:00:00Z',
  },
];

const INITIAL_LOGS: RoleChangeLog[] = [
  {
    id: 'log-001',
    adminId: 'usr-super-admin-01',
    adminName: 'سلطان القحطاني',
    targetUserId: 'usr-admin-02',
    targetUserName: 'أ. عبد الرحمن الشريف',
    oldRole: 'teacher',
    newRole: 'admin',
    reason: 'ترقية لإدارة محتوى ومحاضرات منصة التأسيس',
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'log-002',
    adminId: 'usr-super-admin-01',
    adminName: 'سلطان القحطاني',
    targetUserId: 'usr-teacher-03',
    targetUserName: 'م. ريم الغامدي',
    oldRole: 'student',
    newRole: 'teacher',
    reason: 'اعتماد معلمة لشروحات مسار الهندسة والزوايا',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
];

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

    // القراءة من التخزين المحلي أو البيانات الأولية
    try {
      const stored = localStorage.getItem('tarqa_all_users_roles');
      let usersList: UserWithRole[] = stored ? JSON.parse(stored) : INITIAL_DEMO_USERS;
      
      // تحويل أي حساب برتبة super_admin سابقة إلى admin
      usersList = usersList.map(u => u.role === 'super_admin' ? { ...u, role: 'admin' as UserRole } : u);

      const yassien = usersList.find((u) => u.email.toLowerCase() === 'yassooooo27m@gmail.com');
      if (yassien) {
        yassien.role = 'admin';
        yassien.fullName = 'Yassien Ahmed';
      } else {
        usersList.unshift({
          id: 'usr-admin-01',
          email: 'yassooooo27m@gmail.com',
          fullName: 'Yassien Ahmed',
          role: 'admin',
          targetScore: 100,
          telegramUsername: 'yassien_ahmed',
          createdAt: '2024-01-01T10:00:00Z',
        });
      }
      localStorage.setItem('tarqa_all_users_roles', JSON.stringify(usersList));
      return usersList;
    } catch {}

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
        return JSON.parse(stored);
      }
    } catch {}

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
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentUser?.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com';
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
    if (currentUser.id === targetUserId) {
      authService.switchRole(newRole);
    }

    // 5. تسجيل العملية في سجل التدقيق (Audit Log)
    const newLog: RoleChangeLog = {
      id: 'log-' + Date.now(),
      adminId: currentUser.id,
      adminName: currentUser.fullName || 'السوبر أدمن',
      targetUserId: targetUser.id,
      targetUserName: targetUser.fullName,
      oldRole: targetUser.role,
      newRole,
      reason: reason || 'تعديل الصلاحية عبر لوحة تحكم السوبر أدمن',
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
