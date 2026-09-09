import { createClient } from '@supabase/supabase-js';
import { UserRole } from '../types';

// قراءة بيانات الاتصال بـ Supabase من متغيرات بيئة Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://djkwgwdlygxqcateivbc.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or Anon Key is missing in environment variables.');
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
}

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

        const user: TarqaUser = {
          id: data.user.id,
          email: data.user.email || params.email,
          fullName: isOwner ? 'Yoska' : (data.user.user_metadata?.full_name || 'طالب طرقع'),
          targetScore: Number(data.user.user_metadata?.target_score) || 100,
          role,
          telegramUsername: data.user.user_metadata?.telegram_username,
          avatarUrl: data.user.user_metadata?.avatar_url,
        };

        localStorage.setItem('tarqa_current_user', JSON.stringify(user));
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
      const user: TarqaUser = {
        id: foundUser.id,
        email: foundUser.email,
        fullName: isOwner ? 'Yoska' : foundUser.fullName,
        targetScore: foundUser.targetScore || 100,
        role: isOwner ? 'super_admin' : (foundUser.role || (emailLower.includes('admin') ? 'admin' : emailLower.includes('teacher') ? 'teacher' : 'student')),
        telegramUsername: foundUser.telegramUsername,
      };
      localStorage.setItem('tarqa_current_user', JSON.stringify(user));
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

        const user: TarqaUser = {
          id: data.user.id,
          email: params.email,
          fullName,
          targetScore: params.targetScore || 100,
          role: 'student',
          telegramUsername: params.telegramUsername,
        };

        localStorage.setItem('tarqa_current_user', JSON.stringify(user));
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
    window.dispatchEvent(new Event('tarqa_user_changed'));

    return { user: newUser, isDemo: true };
  },

  // تسجيل الدخول السريع عبر تليجرام
  signInWithTelegram: (tgData: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
  }): TarqaUser => {
    const fullName = [tgData.first_name, tgData.last_name].filter(Boolean).join(' ') || 'طالب طرقع';
    const user: TarqaUser = {
      id: 'tg-' + tgData.id,
      email: `tg_${tgData.id}@tarqa.app`,
      fullName,
      targetScore: 100,
      role: 'student',
      telegramUsername: tgData.username,
      telegramId: tgData.id,
      avatarUrl: tgData.photo_url,
    };

    localStorage.setItem('tarqa_current_user', JSON.stringify(user));
    window.dispatchEvent(new Event('tarqa_user_changed'));
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
