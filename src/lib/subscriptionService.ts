import { UserRole, CourseModule, Lesson, CourseSubscription, CourseFileItem } from '../types';
import { TarqaUser, supabase, isSupabaseConfigured } from './supabase';
import { mockFoundationModules, mockCourseFiles } from '../data/foundationModules';

export const ANNUAL_SUBSCRIPTION_PRICE_SAR = 75;

export const isOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return email.trim().toLowerCase() === 'yassooooo27m@gmail.com';
};

/**
 * فحص صلاحية التعديل على محتوى الدورات (متاحة حصرياً للمعلم والأدمن والسوبر أدمن والمالك)
 */
export const canEditCourses = (role?: UserRole | null, email?: string | null): boolean => {
  if (isOwnerEmail(email)) return true;
  if (!role) return false;
  return role === 'super_admin' || role === 'admin' || role === 'teacher';
};

/**
 * فحص اشتراك المستخدم السنوي (365 يوماً بـ 75 ريال)
 */
export const isUserSubscribed = (user?: TarqaUser | null): boolean => {
  if (!user) return false;
  
  // المشرفون والمعلمون والمالك لديهم وصول شامل مجاني دائم
  if (canEditCourses(user.role, user.email)) {
    return true;
  }

  // فحص حقل انتهاء الاشتراك في كائن المستخدم
  if (user.subscriptionExpiresAt) {
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    if (expiry > Date.now()) {
      return true;
    }
  }

  // فحص التخزين المحلي للاشتراكات
  try {
    const raw = localStorage.getItem('tarqa_subscriptions');
    if (raw) {
      const subs: Record<string, CourseSubscription> = JSON.parse(raw);
      const userSub = subs[user.id] || (user.email ? subs[user.email.toLowerCase()] : null);
      if (userSub && userSub.isActive) {
        const expiry = new Date(userSub.expiresDate).getTime();
        if (expiry > Date.now()) {
          return true;
        }
      }
    }
  } catch (e) {
    console.warn('Failed to parse local subscriptions:', e);
  }

  return false;
};

/**
 * جلب تفاصيل الاشتراك الحالية (الأيام المتبقية، تاريخ الانتهاء، الحالة)
 */
export const getSubscriptionDetails = (user?: TarqaUser | null) => {
  const isManager = canEditCourses(user?.role, user?.email);
  const subscribed = isUserSubscribed(user);

  if (isManager) {
    return {
      isSubscribed: true,
      isManager: true,
      daysRemaining: 365,
      expiresDateFormatted: 'وصول إداري غير محدود',
      expiresIso: undefined,
    };
  }

  if (!user || !subscribed) {
    return {
      isSubscribed: false,
      isManager: false,
      daysRemaining: 0,
      expiresDateFormatted: 'غير مشترك',
      expiresIso: undefined,
    };
  }

  let expiresIso = user.subscriptionExpiresAt;
  if (!expiresIso) {
    try {
      const raw = localStorage.getItem('tarqa_subscriptions');
      if (raw) {
        const subs = JSON.parse(raw);
        const sub = subs[user.id] || (user.email ? subs[user.email.toLowerCase()] : null);
        if (sub?.expiresDate) expiresIso = sub.expiresDate;
      }
    } catch (e) {}
  }

  if (!expiresIso) {
    // اشتراك افتراضي ساري لمدة سنة من اليوم
    expiresIso = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  }

  const expiryTime = new Date(expiresIso).getTime();
  const diffMs = Math.max(0, expiryTime - Date.now());
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const dateObj = new Date(expiresIso);
  const expiresDateFormatted = dateObj.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return {
    isSubscribed: true,
    isManager: false,
    daysRemaining,
    expiresDateFormatted,
    expiresIso,
  };
};

/**
 * فحص إمكانية الوصول إلى محاضرة معينة (إذا كانت مجانية أو الطالب مشترك أو مشرف)
 */
export const canAccessLesson = (lesson: Lesson, user?: TarqaUser | null): boolean => {
  if (lesson.isFreePreview) return true;
  return isUserSubscribed(user);
};

/**
 * تفعيل الاشتراك السنوي للطالب لمدة سنة كاملة (365 يوماً بـ 75 ر.س)
 */
export const activateAnnualSubscription = async (
  user: TarqaUser
): Promise<{ success: boolean; expiresAt: string; message: string }> => {
  const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  const subRecord: CourseSubscription = {
    userId: user.id,
    userEmail: user.email,
    userName: user.fullName,
    planId: 'annual_75',
    planName: 'باقة طرقع السنوية الشاملة',
    priceSAR: ANNUAL_SUBSCRIPTION_PRICE_SAR,
    startDate: new Date().toISOString(),
    expiresDate: oneYearFromNow,
    isActive: true,
  };

  // 1. حفظ في التخزين المحلي فوراً
  try {
    const raw = localStorage.getItem('tarqa_subscriptions') || '{}';
    const subs = JSON.parse(raw);
    subs[user.id] = subRecord;
    if (user.email) {
      subs[user.email.toLowerCase()] = subRecord;
    }
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث المستخدم الحالي في localStorage
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      parsed.isSubscribed = true;
      parsed.subscriptionExpiresAt = oneYearFromNow;
      localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
    }
  } catch (err) {
    console.warn('Error saving subscription locally:', err);
  }

  // 2. تحديث في قاعدة بيانات Supabase إن وجدت
  if (isSupabaseConfigured && user.id) {
    try {
      await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_expires_at: oneYearFromNow,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', user.id);
    } catch (dbErr) {
      console.warn('Could not sync subscription to Supabase (profiles columns might need update):', dbErr);
    }
  }

  // 3. إطلاق حدث تحديث في النافذة
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: subRecord }));
    window.dispatchEvent(new CustomEvent('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
  }

  return {
    success: true,
    expiresAt: oneYearFromNow,
    message: 'تم تفعيل باقة طرقع السنوية بنجاح لمدة 365 يوماً!',
  };
};

/**
 * إلغاء اشتراك المستخدم السنوي (سواء بواسطة السوبر أدمن من لوحة التحكم أو المستخدم)
 */
export const cancelAnnualSubscription = async (
  userId: string,
  userEmail?: string
): Promise<{ success: boolean; message: string }> => {
  // 1. تحديث التخزين المحلي للاشتراكات
  try {
    const raw = localStorage.getItem('tarqa_subscriptions') || '{}';
    const subs = JSON.parse(raw);
    if (subs[userId]) {
      subs[userId].isActive = false;
    }
    if (userEmail && subs[userEmail.toLowerCase()]) {
      subs[userEmail.toLowerCase()].isActive = false;
    }
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث المستخدم الحالي إذا كان هو المعني
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      if (parsed.id === userId || (userEmail && parsed.email?.toLowerCase() === userEmail.toLowerCase())) {
        parsed.isSubscribed = false;
        parsed.subscriptionExpiresAt = undefined;
        localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
      }
    }

    // تحديث قائمة الأعضاء في tarqa_all_users_roles
    const allRolesRaw = localStorage.getItem('tarqa_all_users_roles');
    if (allRolesRaw) {
      const parsedRoles = JSON.parse(allRolesRaw);
      if (Array.isArray(parsedRoles)) {
        const updatedRoles = parsedRoles.map((u: any) => {
          if (u.id === userId || (userEmail && u.email?.toLowerCase() === userEmail.toLowerCase())) {
            return {
              ...u,
              isSubscribed: false,
              subscriptionExpiresAt: undefined,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedRoles));
      }
    }
  } catch (err) {
    console.warn('Error cancelling subscription locally:', err);
  }

  // 2. تحديث في قاعدة بيانات Supabase إذا كانت متصلة
  if (isSupabaseConfigured && userId) {
    try {
      await supabase
        .from('profiles')
        .update({
          is_subscribed: false,
          subscription_expires_at: null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', userId);
    } catch (dbErr) {
      console.warn('Could not sync subscription cancellation to Supabase:', dbErr);
    }
  }

  // 3. إطلاق الأحداث لتحديث واجهات الموقع فوراً
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
  }

  return {
    success: true,
    message: 'تم إلغاء الاشتراك بنجاح.',
  };
};

/**
 * منح أو تفعيل اشتراك سنوي لمستخدم معين بواسطة الإدارة (Super Admin)
 */
export const grantAnnualSubscription = async (
  targetUser: { id: string; email?: string; fullName?: string },
  days: number = 365
): Promise<{ success: boolean; message: string }> => {
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const subRecord: CourseSubscription = {
    userId: targetUser.id,
    userEmail: targetUser.email,
    userName: targetUser.fullName,
    planId: 'annual_75',
    planName: 'باقة طرقع السنوية الشاملة',
    priceSAR: ANNUAL_SUBSCRIPTION_PRICE_SAR,
    startDate: new Date().toISOString(),
    expiresDate: expiresAt,
    isActive: true,
  };

  try {
    const raw = localStorage.getItem('tarqa_subscriptions') || '{}';
    const subs = JSON.parse(raw);
    subs[targetUser.id] = subRecord;
    if (targetUser.email) {
      subs[targetUser.email.toLowerCase()] = subRecord;
    }
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث tarqa_all_users_roles
    const allRolesRaw = localStorage.getItem('tarqa_all_users_roles');
    if (allRolesRaw) {
      const parsedRoles = JSON.parse(allRolesRaw);
      if (Array.isArray(parsedRoles)) {
        const updatedRoles = parsedRoles.map((u: any) => {
          if (u.id === targetUser.id || (targetUser.email && u.email?.toLowerCase() === targetUser.email.toLowerCase())) {
            return {
              ...u,
              isSubscribed: true,
              subscriptionExpiresAt: expiresAt,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedRoles));
      }
    }

    // تحديث المستخدم الحالي إذا كان هو نفسه
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      if (parsed.id === targetUser.id || (targetUser.email && parsed.email?.toLowerCase() === targetUser.email.toLowerCase())) {
        parsed.isSubscribed = true;
        parsed.subscriptionExpiresAt = expiresAt;
        localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
      }
    }
  } catch (e) {}

  if (isSupabaseConfigured && targetUser.id) {
    try {
      await supabase
        .from('profiles')
        .update({
          is_subscribed: true,
          subscription_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', targetUser.id);
    } catch (e) {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: subRecord }));
    window.dispatchEvent(new CustomEvent('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
  }

  return {
    success: true,
    message: 'تم تفعيل الاشتراك السنوي بنجاح لمدة سنة كاملة.',
  };
};

/**
 * إدارة وتخزين وحدات ومحاضرات الدورات (مع إمكانية التعديل والإضافة للمعلمين والمشرفين)
 */
export const coursesStorage = {
  getModules(): CourseModule[] {
    try {
      const raw = localStorage.getItem('tarqa_custom_modules_v4');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return mockFoundationModules;
  },

  saveModules(modules: CourseModule[]) {
    try {
      localStorage.setItem('tarqa_custom_modules_v4', JSON.stringify(modules));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: modules }));
      }
    } catch (e) {
      console.warn('Failed to save modules to local storage:', e);
    }
  },

  addModule(newModule: CourseModule): CourseModule[] {
    const current = this.getModules();
    const updated = [...current, newModule];
    this.saveModules(updated);
    return updated;
  },

  updateModule(updatedModule: CourseModule): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((m) => (m.id === updatedModule.id ? updatedModule : m));
    this.saveModules(updated);
    return updated;
  },

  deleteModule(moduleId: string): CourseModule[] {
    const current = this.getModules();
    const updated = current.filter((m) => m.id !== moduleId);
    this.saveModules(updated);
    return updated;
  },

  addLesson(moduleId: string, newLesson: Lesson): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => {
      if (mod.id === moduleId) {
        return {
          ...mod,
          lessons: [...mod.lessons, newLesson],
        };
      }
      return mod;
    });
    this.saveModules(updated);
    return updated;
  },

  updateLesson(updatedLesson: Lesson): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => {
      if (mod.id === updatedLesson.moduleId) {
        return {
          ...mod,
          lessons: mod.lessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)),
        };
      }
      return mod;
    });
    this.saveModules(updated);
    return updated;
  },

  deleteLesson(moduleId: string, lessonId: string): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => {
      if (mod.id === moduleId) {
        return {
          ...mod,
          lessons: mod.lessons.filter((l) => l.id !== lessonId),
        };
      }
      return mod;
    });
    this.saveModules(updated);
    return updated;
  },

  toggleFreePreview(moduleId: string, lessonId: string): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => {
      if (mod.id === moduleId) {
        return {
          ...mod,
          lessons: mod.lessons.map((l) =>
            l.id === lessonId ? { ...l, isFreePreview: !l.isFreePreview } : l
          ),
        };
      }
      return mod;
    });
    this.saveModules(updated);
    return updated;
  },

  // إدارة قسم ملفات ومذكرات الدورة
  getFiles(): CourseFileItem[] {
    try {
      const raw = localStorage.getItem('tarqa_custom_files_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return mockCourseFiles;
  },

  saveFiles(files: CourseFileItem[]) {
    try {
      localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(files));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: files }));
      }
    } catch (e) {
      console.warn('Failed to save files to local storage:', e);
    }
  },

  addFile(newFile: CourseFileItem): CourseFileItem[] {
    const current = this.getFiles();
    const updated = [newFile, ...current];
    this.saveFiles(updated);
    return updated;
  },

  updateFile(updatedFile: CourseFileItem): CourseFileItem[] {
    const current = this.getFiles();
    const updated = current.map((f) => (f.id === updatedFile.id ? updatedFile : f));
    this.saveFiles(updated);
    return updated;
  },

  deleteFile(fileId: string): CourseFileItem[] {
    const current = this.getFiles();
    const updated = current.filter((f) => f.id !== fileId);
    this.saveFiles(updated);
    return updated;
  },

  toggleFilePreview(fileId: string): CourseFileItem[] {
    const current = this.getFiles();
    const updated = current.map((f) =>
      f.id === fileId ? { ...f, isFreePreview: !f.isFreePreview } : f
    );
    this.saveFiles(updated);
    return updated;
  },
};

