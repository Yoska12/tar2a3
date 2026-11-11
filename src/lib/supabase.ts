import { UserRole } from '../types';
import { sendWelcomeTelegramMessage } from './telegram';
import { isOwnerEmail } from './securityUtils';
import { 
  saveCurrentUserToIDB, 
  clearCurrentUserFromIDB, 
  saveRegisteredUserToIDB,
  saveQuizAttemptToIDB
} from './indexedDbService';

export { isOwnerEmail } from './securityUtils';

// ==============================================================================
// 🚀 التحول الشامل إلى استضافة وقاعدة بيانات هوستينجر (Hostinger MySQL Backend)
// تم تعطيل سوبابيز (Supabase) بالكامل وتوجيه كافة العمليات إلى خادم هوستينجر
// ==============================================================================
export const isSupabaseConfigured = false;

// Mock Supabase Query Builder لمنع أي أخطاء وقت التشغيل عند استدعاء supabase.from() في أي ملف
const createMockQueryBuilder = () => {
  const chain: any = {
    select: () => chain,
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => chain,
    upsert: () => Promise.resolve({ data: null, error: null }),
    delete: () => chain,
    eq: () => chain,
    neq: () => chain,
    or: () => chain,
    ilike: () => chain,
    order: () => chain,
    limit: () => chain,
    single: () => Promise.resolve({ data: null, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: any) => resolve({ data: [], error: null }),
  };
  return chain;
};

export const supabase: any = {
  auth: {
    getSession: async (): Promise<{ data: { session: any }; error: null }> => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error('تم تعطيل سوبابيز والانتقال إلى هوستينجر') }),
    signUp: async () => ({ data: { user: null, session: null }, error: new Error('تم تعطيل سوبابيز والانتقال إلى هوستينجر') }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: (_cb?: (event: any, session: any) => void) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
  from: () => createMockQueryBuilder(),
  channel: () => ({
    on: () => ({
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),
  removeChannel: () => {},
};

export const createClient = () => supabase;
export default supabase;

export const isValidUuid = (val?: string): boolean => {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
};

export interface TarqaUser {
  id: string;
  email: string;
  fullName: string;
  targetScore: number;
  role: UserRole;
  telegramUsername?: string;
  telegramId?: number;
  avatarUrl?: string;
  isBanned?: boolean;
  banReason?: string;
  isSubscribed?: boolean;
  subscriptionExpiresAt?: string;
  points?: number;
}

// دالة مساعدة لاستدعاء Hostinger PHP API
export const callHostingerApi = async (action: string, payload: any = {}) => {
  try {
    const res = await fetch(`/api/hostinger_api.php?action=${encodeURIComponent(action)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (data) {
      return { ...data, httpStatus: res.status, ok: res.ok };
    }
    return { success: false, httpStatus: res.status, ok: res.ok };
  } catch (e) {
    // Silently fall back to offline local storage
  }
  return null;
};

// دالة مركزية لمزامنة وإدراج أي مستخدم يسجل أو يدخل في لوحة الأعضاء فوراً
export const syncUserToMembersDashboard = async (user: TarqaUser) => {
  if (!user || (!user.id && !user.email)) return;

  const isOwner = isOwnerEmail(user.email);
  const role: UserRole = isOwner ? 'super_admin' : (user.role || 'student');
  const fullName = isOwner 
    ? (user.fullName && user.fullName !== 'طالب طرقع' ? user.fullName : 'Yoska') 
    : (user.fullName || 'طالب طرقع');

  const record = {
    id: user.id || 'usr-' + Date.now(),
    email: user.email || (user.telegramUsername ? `@${user.telegramUsername}` : 'user@tarqa.app'),
    fullName,
    role,
    targetScore: user.targetScore || 100,
    telegramUsername: user.telegramUsername,
    telegramId: user.telegramId,
    avatarUrl: user.avatarUrl,
    isSubscribed: isOwner ? true : user.isSubscribed,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    points: typeof user.points === 'number' ? user.points : 0,
    createdAt: new Date().toISOString(),
    lastSignInAt: new Date().toISOString(),
  };

  // المزامنة الفورية في التخزين المحلي لظهور فوري بدون تأخير
  try {
    const stored = localStorage.getItem('tarqa_all_users_roles');
    let list: any[] = stored ? JSON.parse(stored) : [];
    
    // إزالة الحسابات الوهمية
    list = list.filter(u => 
      !['usr-admin-02', 'usr-teacher-03', 'usr-teacher-04', 'usr-student-05', 'usr-student-06', 'usr-student-07'].includes(u.id) &&
      !u.email?.endsWith('@student.com')
    );

    const idx = list.findIndex((u: any) => 
      (u.id && record.id && u.id === record.id) ||
      (u.email && record.email && u.email.toLowerCase() === record.email.toLowerCase())
    );

    if (idx >= 0) {
      const prevRole = list[idx].role;
      if (prevRole === 'super_admin' || prevRole === 'admin' || prevRole === 'teacher') {
        if (!record.role || record.role === 'student') {
          record.role = prevRole;
        }
      }
      list[idx] = { 
        ...list[idx], 
        ...record, 
        role: record.role,
        isSubscribed: user.isSubscribed !== undefined ? user.isSubscribed : list[idx].isSubscribed,
        subscriptionExpiresAt: user.isSubscribed === false ? undefined : (user.subscriptionExpiresAt || list[idx].subscriptionExpiresAt),
        createdAt: list[idx].createdAt || record.createdAt 
      };
    } else {
      list.unshift(record);
    }

    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(list));
    window.dispatchEvent(new Event('tarqa_roles_changed'));

    // مزامنة المستخدم لحظياً مع الباك إند المركزي وقاعدة البيانات
    callHostingerApi('sync_user', { user: record }).catch(() => {});

    // مزامنة حالة الاشتراك مع الباك إند المركزي وقاعدة بيانات السيرفر
    if (user.isSubscribed) {
      callHostingerApi('update_subscription', {
        userId: user.id,
        target_user_id: user.id,
        email: user.email,
        is_subscribed: 1,
        period: 'annual',
        expires_at: user.subscriptionExpiresAt || null,
      }).catch(() => {});
    }
  } catch (e) {
    console.warn('[syncUserToMembersDashboard] local sync error:', e);
  }
};

// خدمة المصادقة عبر Hostinger والتخزين المحلي الموثوق
export const authService = {
  isConfigured: () => false,

  // الحصول على المستخدم الحالي
  getCurrentUser: (): TarqaUser | null => {
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem('tarqa_current_user');
      if (!stored) return null;

      const parsed: TarqaUser = JSON.parse(stored);
      if (!parsed || !parsed.id || !parsed.email) {
        localStorage.removeItem('tarqa_current_user');
        return null;
      }

      const emailLower = (parsed.email || '').trim().toLowerCase();
      const isOwner = isOwnerEmail(parsed.email);
      if (isOwner) {
        parsed.role = 'super_admin';
        parsed.isSubscribed = true;
      } else {
        // فحص الرتبة الممنوحة في سجل الأدوار
        try {
          const rolesRaw = localStorage.getItem('tarqa_all_users_roles');
          if (rolesRaw) {
            const allRoles = JSON.parse(rolesRaw);
            const cleanParsedTg = (parsed.telegramUsername || '').replace(/^@/, '').toLowerCase();
            const found = allRoles.find((u: any) => {
              const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase();
              return (u.id && u.id === parsed.id) || 
                     (u.email && u.email.toLowerCase() === emailLower) ||
                     (parsed.telegramId && u.telegramId && u.telegramId === parsed.telegramId) ||
                     (cleanParsedTg && uTg && uTg === cleanParsedTg);
            });
            if (found?.role && found.role !== parsed.role) {
              parsed.role = found.role;
              try {
                localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
              } catch {}
            }
            if (found && (found.isSubscribed === true || found.isSubscribed === false)) {
              parsed.isSubscribed = found.isSubscribed;
              if (found.subscriptionExpiresAt) parsed.subscriptionExpiresAt = found.subscriptionExpiresAt;
            }
          }
        } catch {}
      }

      return parsed;
    } catch {
      return null;
    }
  },

  // تحديث بيانات المستخدم الحالي من السيرفر المركزي
  refreshCurrentUser: async (): Promise<TarqaUser | null> => {
    try {
      const current = authService.getCurrentUser();
      if (!current || (!current.id && !current.email)) return null;

      const isOwner = isOwnerEmail(current.email);

      // فحص الرتبة وحالة الحساب والاشتراك من قاعدة بيانات هوستينجر المركزية
      try {
        const cleanTg = (current.telegramUsername || '').replace(/^@/, '').trim();
        const hostRes = await callHostingerApi('get_user_role', {
          userId: current.id,
          email: current.email,
          telegram_id: current.telegramId,
          telegram_username: cleanTg
        });

        // ✅ أمان حرج: لا نمسح الحساب أبداً إلا إذا السيرفر رجّع صريحاً وموثوقاً
        // hostRes === null يعني API فشل أو offline → نبقى على الحالة المحلية
        if (!hostRes || !hostRes.ok) {
          // السيرفر غير متاح أو رد بخطأ شبكي → نحتفظ بالمستخدم الحالي
          return current;
        }

        // إذا تم حظر الحساب في قاعدة البيانات بشكل صريح ومؤكد (httpStatus 403)
        if (
          hostRes.httpStatus === 403 &&
          (hostRes.isBanned === true || hostRes.user?.isBanned === true)
        ) {
          authService.clearCurrentUser();
          try {
            localStorage.removeItem('tarqa_current_user');
            localStorage.removeItem('tarqa_subscriptions');
            localStorage.removeItem('tarqa_course_subscriptions');
          } catch {}
          window.dispatchEvent(new Event('tarqa_user_changed'));
          return null;
        }

        // إذا تم حظر الحساب بشكل صريح ومؤكد (success:false وisBanned:true)
        if (
          hostRes.success === false &&
          (hostRes.isBanned === true || hostRes.user?.isBanned === true)
        ) {
          authService.clearCurrentUser();
          try {
            localStorage.removeItem('tarqa_current_user');
            localStorage.removeItem('tarqa_subscriptions');
            localStorage.removeItem('tarqa_course_subscriptions');
          } catch {}
          window.dispatchEvent(new Event('tarqa_user_changed'));
          return null;
        }

        // إذا تم حذف الحساب نهائياً بشكل صريح من قبل الإدارة (مع تأكيد httpStatus)
        if (hostRes.isDeleted === true && hostRes.httpStatus === 404) {
          authService.clearCurrentUser();
          try {
            localStorage.removeItem('tarqa_current_user');
            localStorage.removeItem('tarqa_subscriptions');
            localStorage.removeItem('tarqa_course_subscriptions');
          } catch {}
          window.dispatchEvent(new Event('tarqa_user_changed'));
          return null;
        }

        // تحديث البيانات من السيرفر إذا رجع بنجاح
        if (hostRes.success && hostRes.user) {
          const sUser = hostRes.user;
          const resolvedOwner = isOwner || isOwnerEmail(sUser.email);
          const newRole = resolvedOwner ? 'super_admin' : (sUser.role || current.role);
          let changed = false;
          if (newRole && newRole !== current.role) {
            current.role = newRole;
            changed = true;
          }
          if (sUser.isSubscribed !== undefined && !resolvedOwner) {
            const serverSub = Boolean(sUser.isSubscribed);
            if (current.isSubscribed !== serverSub) {
              current.isSubscribed = serverSub;
              if (sUser.subscriptionExpiresAt) {
                current.subscriptionExpiresAt = sUser.subscriptionExpiresAt;
              }
              changed = true;
            }
          }
          if (changed) {
            authService.setCurrentUser(current);
          }
        }
      } catch {
        // خطأ في التواصل مع السيرفر → نحتفظ بالمستخدم المحلي
      }

      return current;
    } catch {
      return authService.getCurrentUser();
    }
  },

  // حفظ المستخدم
  setCurrentUser: (user: TarqaUser): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem('tarqa_current_user', JSON.stringify(user));
      saveCurrentUserToIDB(user).catch(() => {});
      window.dispatchEvent(new Event('tarqa_user_changed'));
    } catch (e) {
      console.warn('[authService] Failed to set current user:', e);
    }
  },

  // مسح بيانات المستخدم الحالي عند تسجيل الخروج
  clearCurrentUser: (): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem('tarqa_current_user');
      clearCurrentUserFromIDB().catch(() => {});
      window.dispatchEvent(new Event('tarqa_user_changed'));
    } catch (e) {
      console.warn('[authService] Failed to clear current user:', e);
    }
  },

  // تبديل الدور للاختبار
  switchRole: (newRole: UserRole): TarqaUser | null => {
    const current = authService.getCurrentUser();
    if (!current) return null;
    const updated: TarqaUser = { ...current, role: newRole };
    localStorage.setItem('tarqa_current_user', JSON.stringify(updated));
    syncUserToMembersDashboard(updated);
    window.dispatchEvent(new Event('tarqa_user_changed'));
    return updated;
  },

  // تسميات وشارات الأدوار باللغة العربية
  getRoleBadge: (role: UserRole = 'student'): { label: string; color: string; iconText: string } => {
    switch (role) {
      case 'super_admin':
        return { 
          label: 'سوبر أدمن (Super Admin)', 
          color: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30 font-black', 
          iconText: '👑' 
        };
      case 'admin':
        return { 
          label: 'مسؤول المنصة (Admin)', 
          color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 font-bold', 
          iconText: '🛡️' 
        };
      case 'teacher':
        return { 
          label: 'معلم معتمد (Teacher)', 
          color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 font-semibold', 
          iconText: '🎓' 
        };
      case 'e_simulator':
        return { 
          label: 'محرر المحاكي (E.Simulator)', 
          color: 'bg-amber-500/15 text-amber-500 border-amber-500/30 font-bold', 
          iconText: '⚡' 
        };
      case 'e_cms':
        return { 
          label: 'محرر المحاضرات (E.CMS)', 
          color: 'bg-sky-500/15 text-sky-400 border-sky-500/30 font-bold', 
          iconText: '🎬' 
        };
      case 'student':
      default:
        return { 
          label: 'طالب طرقع (Student)', 
          color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30', 
          iconText: '🎯' 
        };
    }
  },

  // تسجيل الدخول (Hostinger API + Local Storage)
  signIn: async (params: { email: string; password: string }): Promise<{ user: TarqaUser; isDemo: boolean }> => {
    const isOwner = isOwnerEmail(params.email);
    const emailLower = (params.email || '').toLowerCase().trim();

    // 1. محاولة تسجيل الدخول عبر سيرفر هوستينجر
    try {
      const serverRes = await callHostingerApi('login', {
        email: emailLower,
        password: params.password
      });

      // إذا تم حظر الحساب في قاعدة البيانات بشكل مؤكد
      if (serverRes && (serverRes.isBanned === true || (serverRes.httpStatus === 403 && serverRes.banReason))) {
        throw new Error(serverRes.banReason || serverRes.error || 'تم حظر هذا الحساب من قبل إدارة المنصة.');
      }

      // إذا تم حذف الحساب نهائياً بشكل صريح من قبل الإدارة
      if (serverRes && serverRes.isDeleted === true) {
        throw new Error('هذا الحساب تم حذفه نهائياً من قبل إدارة المنصة.');
      }

      if (serverRes && serverRes.success && serverRes.user) {
        const u = serverRes.user;
        if (u.isBanned) {
          throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${u.banReason ? `\nسبب الحظر: ${u.banReason}` : ''}`);
        }
        const tarqaUser: TarqaUser = {
          id: u.id,
          email: u.email,
          fullName: isOwner ? 'Yoska' : (u.fullName || 'طالب طرقع'),
          targetScore: u.targetScore || 100,
          role: isOwner ? 'super_admin' : (u.role || 'student'),
          telegramUsername: u.telegramUsername,
          telegramId: u.telegramId,
          isBanned: false,
          isSubscribed: isOwner ? true : Boolean(u.isSubscribed),
          subscriptionExpiresAt: u.subscriptionExpiresAt,
          points: u.points || 0,
          avatarUrl: u.avatarUrl
        };

        localStorage.setItem('tarqa_current_user', JSON.stringify(tarqaUser));
        saveCurrentUserToIDB(tarqaUser).catch(() => {});
        syncUserToMembersDashboard(tarqaUser);
        window.dispatchEvent(new Event('tarqa_user_changed'));
        return { user: tarqaUser, isDemo: false };
      }
    } catch (e: any) {
      if (e.message && (e.message.includes('حظر') || e.message.includes('حذف') || e.message.includes('كلمة المرور'))) {
        throw e;
      }
    }

    // 2. وضع الحسابات المحلية الاحتياطية (يعمل دائماً دون انقطاع)
    const users: any[] = JSON.parse(localStorage.getItem('tarqa_registered_users') || '[]');
    const foundUser = users.find((u) => u.email.toLowerCase() === emailLower);

    if (foundUser) {
      if (foundUser.password !== params.password && !isOwner) {
        throw new Error('كلمة المرور غير صحيحة، يرجى إعادة المحاولة');
      }

      if (foundUser.isBanned) {
        throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${foundUser.banReason ? ` سبب الحظر: ${foundUser.banReason}` : ''}`);
      }

      const effectiveRole: UserRole = isOwner ? 'super_admin' : (foundUser.role || 'student');
      const user: TarqaUser = {
        id: foundUser.id,
        email: foundUser.email,
        fullName: isOwner ? 'Yoska' : foundUser.fullName,
        targetScore: foundUser.targetScore || 100,
        role: effectiveRole,
        telegramUsername: foundUser.telegramUsername,
        isBanned: false,
        isSubscribed: isOwner ? true : Boolean(foundUser.isSubscribed),
        subscriptionExpiresAt: foundUser.subscriptionExpiresAt,
        points: typeof foundUser.points === 'number' ? foundUser.points : 0,
      };

      localStorage.setItem('tarqa_current_user', JSON.stringify(user));
      saveCurrentUserToIDB(user).catch(() => {});
      syncUserToMembersDashboard(user);
      window.dispatchEvent(new Event('tarqa_user_changed'));
      return { user, isDemo: true };
    }

    // إذا كان المالك، ننشئ حسابه فوراً كسوبر أدمن
    if (isOwner) {
      const ownerUser: TarqaUser = {
        id: 'usr-yoska-owner',
        email: params.email,
        fullName: 'Yoska',
        targetScore: 100,
        role: 'super_admin',
        isSubscribed: true,
        points: 9999,
        telegramUsername: 'yassien_ahmed'
      };
      users.push({ ...ownerUser, password: params.password });
      localStorage.setItem('tarqa_registered_users', JSON.stringify(users));
      localStorage.setItem('tarqa_current_user', JSON.stringify(ownerUser));
      syncUserToMembersDashboard(ownerUser);
      window.dispatchEvent(new Event('tarqa_user_changed'));
      return { user: ownerUser, isDemo: false };
    }

    throw new Error('البريد الإلكتروني غير مسجل في المنصة. يرجى إنشاء حساب جديد أولاً.');
  },

  // إنشاء حساب جديد (Hostinger API + Local Storage)
  signUp: async (params: {
    email: string;
    password: string;
    fullName: string;
    targetScore: number;
    role?: UserRole;
    telegramUsername?: string;
  }): Promise<{ user: TarqaUser; isDemo: boolean }> => {
    const isOwner = isOwnerEmail(params.email);
    const emailLower = (params.email || '').toLowerCase().trim();
    const role: UserRole = isOwner ? 'super_admin' : 'student';

    // 1. فحص محلي أولي
    const users: any[] = JSON.parse(localStorage.getItem('tarqa_registered_users') || '[]');
    const existing = users.find(u => u.email.toLowerCase() === emailLower);
    if (existing) {
      throw new Error('هذا البريد الإلكتروني مسجل بالفعل! يمكنك تسجيل الدخول مباشرة.');
    }

    // 2. محاولة التسجيل في هوستينجر وقاعدة البيانات المركزية
    let serverRes: any = null;
    try {
      serverRes = await callHostingerApi('register', {
        email: emailLower,
        password: params.password,
        fullName: isOwner ? 'Yoska' : params.fullName,
        targetScore: params.targetScore,
        telegramUsername: params.telegramUsername,
      });
      if (serverRes && serverRes.httpStatus === 409) {
        throw new Error('هذا البريد الإلكتروني مسجل بالفعل! يمكنك تسجيل الدخول مباشرة.');
      }
    } catch (apiErr: any) {
      if (apiErr?.message?.includes('مسجل بالفعل')) throw apiErr;
    }

    const assignedId = (serverRes && serverRes.user && serverRes.user.id) || (isOwner ? 'usr-yoska-owner' : 'usr-' + Date.now());

    const newUser: TarqaUser = {
      id: assignedId,
      email: emailLower,
      fullName: isOwner ? 'Yoska' : params.fullName,
      targetScore: params.targetScore || 100,
      telegramUsername: params.telegramUsername,
      role,
      isSubscribed: isOwner ? true : false,
      points: 0,
    };

    users.push({ ...newUser, password: params.password });
    localStorage.setItem('tarqa_registered_users', JSON.stringify(users));
    saveRegisteredUserToIDB({ ...newUser, password: params.password }).catch(() => {});
    localStorage.setItem('tarqa_current_user', JSON.stringify(newUser));
    saveCurrentUserToIDB(newUser).catch(() => {});
    syncUserToMembersDashboard(newUser);
    window.dispatchEvent(new Event('tarqa_user_changed'));
    window.dispatchEvent(new Event('tarqa_roles_changed'));

    return { user: newUser, isDemo: false };
  },

  // تسجيل الدخول والربط عبر تليجرام الرسمي (@Tarqa3bot)
  signInWithTelegram: async (tgData: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  }): Promise<TarqaUser> => {
    const rawUsername = tgData.username?.replace(/^@/, '').trim() || '';
    const isOwner = rawUsername.toLowerCase() === 'yassien_ahmed';
    let fullName = isOwner 
      ? 'Yoska' 
      : ([tgData.first_name, tgData.last_name].filter(Boolean).join(' ') || (rawUsername ? `@${rawUsername}` : 'طالب طرقع'));

    let role: UserRole = isOwner ? 'super_admin' : 'student';
    let email = isOwner 
      ? 'yassooooo27m@gmail.com' 
      : (rawUsername ? `${rawUsername}@telegram.tarqa` : `tg_${tgData.id}@tarqa.app`);

    let targetScore = 100;
    let userId = isOwner ? 'usr-yoska-owner' : `tg-${tgData.id}`;

    // إرسال وتوثيق البيانات في هوستينجر
    try {
      const tgRes = await callHostingerApi('telegram_auth', {
        id: tgData.id,
        first_name: tgData.first_name,
        username: rawUsername,
        photo_url: tgData.photo_url
      });
      if (tgRes && tgRes.isBanned === true) {
        throw new Error(tgRes.error || 'تم حظر هذا الحساب من قبل إدارة المنصة.');
      }
      if (tgRes && tgRes.isDeleted === true) {
        throw new Error('هذا الحساب تم حذفه نهائياً من قبل إدارة المنصة.');
      }
    } catch (tgErr: any) {
      if (tgErr.message && (tgErr.message.includes('حظر') || tgErr.message.includes('حذف'))) {
        throw tgErr;
      }
    }

    const user: TarqaUser = {
      id: userId,
      email,
      fullName,
      targetScore,
      role,
      telegramUsername: rawUsername || undefined,
      telegramId: tgData.id,
      avatarUrl: tgData.photo_url,
      isSubscribed: isOwner ? true : false,
    };

    localStorage.setItem('tarqa_current_user', JSON.stringify(user));
    saveCurrentUserToIDB(user).catch(() => {});
    syncUserToMembersDashboard(user);
    window.dispatchEvent(new Event('tarqa_user_changed'));

    if (tgData.id) {
      try {
        sendWelcomeTelegramMessage(tgData.id, fullName, targetScore).catch(() => {});
      } catch {}
    }

    return user;
  },

  // تسجيل الخروج وتنظيف الجلسة
  signOut: async () => {
    try {
      localStorage.removeItem('tarqa_current_user');
      localStorage.removeItem('tarqa_session');
      clearCurrentUserFromIDB().catch(() => {});
      if (typeof document !== 'undefined') {
        const cookies = document.cookie.split(';');
        for (const cookie of cookies) {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
        }
      }
    } catch {}

    window.dispatchEvent(new Event('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_points_updated', { detail: { points: 0, added: 0 } }));
  },
};

// تخزين محاولات الاختبار محلياً وفي هوستينجر
export const localScoreStorage = {
  saveAttempt: (attempt: any) => {
    try {
      const existing = JSON.parse(localStorage.getItem('tarqa_attempts') || '[]');
      const newAttempt = {
        ...attempt,
        id: 'local-' + Date.now(),
        createdAt: new Date().toISOString(),
      };
      existing.unshift(newAttempt);
      localStorage.setItem('tarqa_attempts', JSON.stringify(existing.slice(0, 50)));
      saveQuizAttemptToIDB(newAttempt).catch(() => {});

      // مزامنة مع هوستينجر
      callHostingerApi('save_score', {
        userId: attempt.userId || 'guest',
        examName: attempt.examName || attempt.quizTitle || 'اختبار طرقع',
        score: attempt.score || 0,
        totalQuestions: attempt.totalQuestions || 0,
        correctAnswers: attempt.correctAnswers || 0,
        timeTaken: attempt.timeTaken || 0
      }).catch(() => {});
    } catch (e) {
      console.warn('Failed to save attempt to localStorage:', e);
    }
  },
  getAttempts: () => {
    try {
      const stored = localStorage.getItem('tarqa_attempts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const realOnly = parsed.filter((a: any) => !['att-1', 'att-2', 'att-3', 'att-4'].includes(a.id));
          return realOnly;
        }
      }
      return [];
    } catch {
      return [];
    }
  },
};
