import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../types';
import { sendWelcomeTelegramMessage } from './telegram';

// قراءة بيانات الاتصال بـ Supabase من متغيرات بيئة Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://djkwgwdlygxqcateivbc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in configuration.');
}

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('placeholder') &&
  supabaseUrl.startsWith('https://')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export { createClient };
export default supabase;

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
}

// دالة مركزية لمزامنة وإدراج أي مستخدم يسجل أو يدخل في لوحة الأعضاء فوراً
export const syncUserToMembersDashboard = async (user: TarqaUser) => {
  if (!user || (!user.id && !user.email)) return;

  const normalizedEmail = (user.email || '').trim().toLowerCase();
  const isOwner = normalizedEmail === 'yassooooo27m@gmail.com';
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
    createdAt: new Date().toISOString(),
    lastSignInAt: new Date().toISOString(),
  };

  // 1. المزامنة الفورية في التخزين المحلي لظهور فوري بدون انتظار السيرفر
  try {
    const stored = localStorage.getItem('tarqa_all_users_roles');
    let list: any[] = stored ? JSON.parse(stored) : [];
    
    // إزالة الحسابات الوهمية التجريبية
    list = list.filter(u => 
      !['usr-admin-02', 'usr-teacher-03', 'usr-teacher-04', 'usr-student-05', 'usr-student-06', 'usr-student-07'].includes(u.id) &&
      !u.email?.endsWith('@student.com')
    );

    const idx = list.findIndex((u: any) => 
      (u.id && record.id && u.id === record.id) ||
      (u.email && record.email && u.email.toLowerCase() === record.email.toLowerCase())
    );

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...record };
    } else {
      list.unshift(record);
    }

    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(list));
    window.dispatchEvent(new Event('tarqa_roles_changed'));
  } catch (e) {
    console.warn('[syncUserToMembersDashboard] local sync error:', e);
  }

  // 2. المزامنة مع جدول profiles في Supabase إذا كانت مفعلة
  if (isSupabaseConfigured && record.id && !record.id.startsWith('usr-') && !record.id.startsWith('tg-')) {
    try {
      const payload: any = {
        id: record.id,
        full_name: record.fullName,
        role: record.role,
        target_score: record.targetScore,
        telegram_username: record.telegramUsername || null,
        telegram_id: record.telegramId || null,
        avatar_url: record.avatarUrl || '',
        updated_at: new Date().toISOString(),
      };
      if (record.email && !record.email.includes('@user.tarqa')) {
        payload.email = record.email;
      }

      const { error } = await supabase.from('profiles').upsert(payload);
      if (error) {
        // إذا فشل بسبب عدم وجود عمود email
        delete payload.email;
        await supabase.from('profiles').upsert(payload);
      }
    } catch (err) {
      console.warn('[syncUserToMembersDashboard] Supabase upsert note:', err);
    }
  }
};

// خدمة المصادقة الذكية: تدعم الاتصال الحي بـ Supabase + وضع المعاينة المحلي الفوري
export const authService = {
  isConfigured: () => isSupabaseConfigured,

  // الحصول على المستخدم الحالي (من الجلسة المحلية الموثقة أو Supabase)
  getCurrentUser: (): TarqaUser | null => {
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem('tarqa_current_user');
      if (!stored) {
        // إذا لم تكن هناك بيانات مخزنة، المستخدم زائر (Guest) حصراً
        return null;
      }
      const parsed = JSON.parse(stored);
      if (!parsed || !parsed.id || !parsed.email) {
        localStorage.removeItem('tarqa_current_user');
        return null;
      }
      if (!parsed.role) parsed.role = 'student';
      return parsed;
    } catch {
      return null;
    }
  },

  // تبديل الدور للاختبار المحلي السريع (Demo Role Switcher)
  switchRole: (newRole: UserRole): TarqaUser | null => {
    const current = authService.getCurrentUser();
    if (!current) return null;
    const updated: TarqaUser = { ...current, role: newRole };
    localStorage.setItem('tarqa_current_user', JSON.stringify(updated));
    syncUserToMembersDashboard(updated);
    window.dispatchEvent(new Event('tarqa_user_changed'));
    return updated;
  },

  // تسميات وشارات الأدوار باللغة العربية مع الألوان المحددة
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
      case 'student':
      default:
        return { 
          label: 'طالب طرقع (Student)', 
          color: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30', 
          iconText: '🎯' 
        };
    }
  },

  // تسجيل الدخول
  signIn: async (params: { email: string; password: string }): Promise<{ user: TarqaUser; isDemo: boolean }> => {
    // 1. إذا كان Supabase مرتبطاً ببيانات حقيقية، نجرب الاتصال به أولاً
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: params.email,
          password: params.password,
        });

        if (error) throw error;
        if (!data.user) throw new Error('لم يتم العثور على بيانات المستخدم');

        // استخراج الدور من Custom Claims (app_metadata) المشفرة أو من metadata
        let role: UserRole = 
          (data.user.app_metadata?.role as UserRole) || 
          (data.user.user_metadata?.role as UserRole) || 
          'student';

        const emailLower = params.email.toLowerCase();
        const isOwner = emailLower === 'yassooooo27m@gmail.com';
        if (isOwner) {
          role = 'super_admin';
        }

        // استعلام ملف المستخدم من Supabase للتحقق من الرتبة وحالة الحظر
        let isBanned = false;
        let banReason: string | undefined = undefined;

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role, full_name, target_score, telegram_username, avatar_url, is_banned, ban_reason')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile) {
            if (profile.role) role = profile.role as UserRole;
            isBanned = Boolean(profile.is_banned);
            banReason = profile.ban_reason || undefined;
          }
        } catch {}

        if (isBanned) {
          await supabase.auth.signOut();
          localStorage.removeItem('tarqa_current_user');
          throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${banReason ? ` سبب الحظر: ${banReason}` : ''}`);
        }

        const user: TarqaUser = {
          id: data.user.id,
          email: data.user.email || params.email,
          fullName: isOwner ? 'Yoska' : (data.user.user_metadata?.full_name || 'طالب طرقع'),
          targetScore: Number(data.user.user_metadata?.target_score) || 100,
          role,
          telegramUsername: data.user.user_metadata?.telegram_username,
          avatarUrl: data.user.user_metadata?.avatar_url,
          isBanned: false,
        };

        localStorage.setItem('tarqa_current_user', JSON.stringify(user));
        syncUserToMembersDashboard(user);
        window.dispatchEvent(new Event('tarqa_user_changed'));
        return { user, isDemo: false };
      } catch (err: any) {
        console.error('Supabase Auth failed:', err);
        throw err;
      }
    }

    // 2. وضع المعاينة المحلي (Local Demo Mode) - يعمل 100% دون انقطاع
    const users: any[] = JSON.parse(localStorage.getItem('tarqa_registered_users') || '[]');
    const emailLower = params.email.toLowerCase();
    const isOwner = emailLower === 'yassooooo27m@gmail.com';
    const foundUser = users.find((u) => u.email.toLowerCase() === emailLower);

    if (foundUser) {
      if (foundUser.password !== params.password) {
        throw new Error('كلمة المرور غير صحيحة، يرجى إعادة المحاولة');
      }

      if (foundUser.isBanned) {
        throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${foundUser.banReason ? ` سبب الحظر: ${foundUser.banReason}` : ''}`);
      }

      const user: TarqaUser = {
        id: foundUser.id,
        email: foundUser.email,
        fullName: isOwner ? 'Yoska' : foundUser.fullName,
        targetScore: foundUser.targetScore || 100,
        role: isOwner ? 'super_admin' : (foundUser.role || (emailLower.includes('admin') ? 'admin' : emailLower.includes('teacher') ? 'teacher' : 'student')),
        telegramUsername: foundUser.telegramUsername,
        isBanned: false,
      };
      localStorage.setItem('tarqa_current_user', JSON.stringify(user));
      syncUserToMembersDashboard(user);
      window.dispatchEvent(new Event('tarqa_user_changed'));
      return { user, isDemo: true };
    }

    // تعيين الدور تلقائياً في وضع المعاينة إذا احتوى البريد على admin أو teacher أو كان حساب Yoska
    let detectedRole: UserRole = 'student';
    if (isOwner) {
      detectedRole = 'super_admin';
    } else if (emailLower.includes('admin')) {
      detectedRole = 'admin';
    } else if (emailLower.includes('teacher')) {
      detectedRole = 'teacher';
    }

    const newUser: TarqaUser = {
      id: isOwner ? 'usr-yoska-admin' : 'usr-' + Date.now(),
      email: params.email,
      fullName: isOwner ? 'Yoska' : (params.email.split('@')[0] || (detectedRole === 'super_admin' ? 'Yoska (سوبر أدمن)' : detectedRole === 'admin' ? 'مدير المنصة' : 'طالب طرقع')),
      targetScore: 100,
      role: detectedRole,
    };

    users.push({ ...newUser, password: params.password });
    localStorage.setItem('tarqa_registered_users', JSON.stringify(users));
    localStorage.setItem('tarqa_current_user', JSON.stringify(newUser));
    syncUserToMembersDashboard(newUser);
    window.dispatchEvent(new Event('tarqa_user_changed'));

    return { user: newUser, isDemo: true };
  },

  // إنشاء حساب جديد
  signUp: async (params: {
    email: string;
    password: string;
    fullName: string;
    targetScore: number;
    role?: UserRole;
    telegramUsername?: string;
  }): Promise<{ user: TarqaUser; isDemo: boolean }> => {
    const role: UserRole = 'student';
    const fullName: string = params.fullName;

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: params.email,
          password: params.password,
          options: {
            data: {
              full_name: fullName,
              target_score: params.targetScore || 100,
              role: 'student',
              telegram_username: params.telegramUsername || null,
            },
          },
        });

        if (error) throw error;
        if (!data.user) throw new Error('لم يتم إنشاء المستخدم');

        // إنشاء أو تحديث صف المستخدم فوراً في جدول public.profiles
        try {
          const profilePayload: any = {
            id: data.user.id,
            email: params.email,
            full_name: fullName,
            target_score: params.targetScore || 100,
            role: 'student',
            telegram_username: params.telegramUsername || null,
            updated_at: new Date().toISOString(),
          };
          const { error: profileError } = await supabase.from('profiles').upsert(profilePayload);
          if (profileError) {
            delete profilePayload.email;
            await supabase.from('profiles').upsert(profilePayload);
          }
        } catch (profileErr) {
          console.warn('[Profiles] direct upsert notice:', profileErr);
        }

        const user: TarqaUser = {
          id: data.user.id,
          email: params.email,
          fullName,
          targetScore: params.targetScore || 100,
          role: 'student',
          telegramUsername: params.telegramUsername,
        };

        localStorage.setItem('tarqa_current_user', JSON.stringify(user));
        syncUserToMembersDashboard(user);
        window.dispatchEvent(new Event('tarqa_user_changed'));
        return { user, isDemo: false };
      } catch (err: any) {
        console.error('Supabase SignUp failed:', err);
        throw err;
      }
    }

    // وضع المعاينة المحلي
    const users: any[] = JSON.parse(localStorage.getItem('tarqa_registered_users') || '[]');
    const existing = users.find((u) => u.email.toLowerCase() === params.email.toLowerCase());
    if (existing) {
      throw new Error('هذا البريد مسجل مسبقاً، يمكنك تسجيل الدخول بدلاً من ذلك');
    }

    const newUser: TarqaUser = {
      id: 'usr-' + Date.now(),
      email: params.email,
      fullName: params.fullName,
      targetScore: params.targetScore || 100,
      role,
      telegramUsername: params.telegramUsername,
    };

    users.push({ ...newUser, password: params.password });
    localStorage.setItem('tarqa_registered_users', JSON.stringify(users));
    localStorage.setItem('tarqa_current_user', JSON.stringify(newUser));
    syncUserToMembersDashboard(newUser);
    window.dispatchEvent(new Event('tarqa_user_changed'));

    return { user: newUser, isDemo: true };
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
    let userId = isOwner ? 'usr-admin-01' : `tg-${tgData.id}`;

    // مزامنة والتحقق من حسابات Supabase إذا كانت مفعلة
    if (isSupabaseConfigured) {
      try {
        let query = supabase.from('profiles').select('id, email, full_name, role, target_score, telegram_id, telegram_username, is_banned, ban_reason');
        if (tgData.id && rawUsername) {
          query = query.or(`telegram_id.eq.${tgData.id},telegram_username.eq.${rawUsername}`);
        } else if (tgData.id) {
          query = query.eq('telegram_id', tgData.id);
        } else if (rawUsername) {
          query = query.eq('telegram_username', rawUsername);
        }
        const { data: existingProfile } = await query.maybeSingle();
        if (existingProfile) {
          if (existingProfile.is_banned) {
            throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${existingProfile.ban_reason ? ` سبب الحظر: ${existingProfile.ban_reason}` : ''}`);
          }
          userId = existingProfile.id || userId;
          if (existingProfile.email) email = existingProfile.email;
          if (existingProfile.role) role = existingProfile.role as UserRole;
          if (existingProfile.full_name) fullName = existingProfile.full_name;
          if (existingProfile.target_score) targetScore = existingProfile.target_score;
        }
      } catch (err: any) {
        if (err?.message?.includes('تم حظر')) throw err;
        console.warn('Supabase telegram profile lookup note:', err);
      }
    }

    // التحقق أيضاً من التخزين المحلي
    try {
      const localUsers = JSON.parse(localStorage.getItem('tarqa_all_users_roles') || '[]');
      const localMatch = localUsers.find((u: any) => 
        (u.telegramId && u.telegramId === tgData.id) ||
        (rawUsername && u.telegramUsername && u.telegramUsername.toLowerCase() === rawUsername.toLowerCase())
      );
      if (localMatch?.isBanned) {
        throw new Error(`تم حظر هذا الحساب من قبل إدارة المنصة.${localMatch.banReason ? ` سبب الحظر: ${localMatch.banReason}` : ''}`);
      }
    } catch (err: any) {
      if (err?.message?.includes('تم حظر')) throw err;
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
    };

    localStorage.setItem('tarqa_current_user', JSON.stringify(user));
    syncUserToMembersDashboard(user);
    window.dispatchEvent(new Event('tarqa_user_changed'));

    // إرسال رسالة ترحيبية فورية للطالب عبر البوت إذا توفر الـ chatId
    if (tgData.id) {
      try {
        sendWelcomeTelegramMessage(tgData.id, fullName, targetScore).catch(() => {});
      } catch {}
    }

    return user;
  },

  // تسجيل الخروج وتنظيف الجلسة والـ Cookies تماماً
  signOut: async () => {
    try {
      localStorage.removeItem('tarqa_current_user');
      localStorage.removeItem('tarqa_session');
      // مسح كافة الكوكيز الممكنة في المتصفح
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

    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
  },
};

// تخزين محاولات الاختبار محلياً
export const localScoreStorage = {
  saveAttempt: (attempt: any) => {
    try {
      const existing = JSON.parse(localStorage.getItem('tarqa_attempts') || '[]');
      existing.unshift({
        ...attempt,
        id: 'local-' + Date.now(),
        completed_at: new Date().toISOString(),
      });
      localStorage.setItem('tarqa_attempts', JSON.stringify(existing.slice(0, 30)));
    } catch (e) {
      console.warn('Could not save to localStorage', e);
    }
  },
  getAttempts: () => {
    try {
      const stored = localStorage.getItem('tarqa_attempts');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const realOnly = parsed.filter((a: any) => !['att-1', 'att-2', 'att-3', 'att-4'].includes(a.id));
          if (realOnly.length !== parsed.length) {
            localStorage.setItem('tarqa_attempts', JSON.stringify(realOnly));
          }
          return realOnly;
        }
      }
      return [];
    } catch {
      return [];
    }
  },
};
