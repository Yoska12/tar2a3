import { UserRole, CourseModule, Lesson, CourseSubscription, CourseFileItem } from '../types';
import { TarqaUser, supabase, isSupabaseConfigured } from './supabase';
import { mockFoundationModules, mockCourseFiles } from '../data/foundationModules';

export const ANNUAL_SUBSCRIPTION_PRICE_SAR = 75;
export const ANNUAL_SUBSCRIPTION_PRICE_EGP = 1020;

export const isOwnerEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === 'yassooooo27m@gmail.com' || e === 'iyoskalg@gmail.com';
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

export const CLOUD_LECTURES_STORE_ID = '32344334-a8b9-40c3-aeeb-9d55f4d160e4';
export const CLOUD_LECTURES_STORE_EMAIL = 'lectures_store@tarqa.app';

/**
 * إدارة وتخزين وحدات ومحاضرات الدورات (مع المزامنة السحابية الفورية لجميع الطلاب)
 */
export const coursesStorage = {
  // مزامنة فورية إلى السحابة (Supabase Cloud Store)
  async syncToCloud(modules?: CourseModule[], files?: CourseFileItem[]) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const currentMods = modules !== undefined ? modules : this.getModules();
      const currentFiles = files !== undefined ? files : this.getFiles();
      const payload = JSON.stringify({
        version: 2,
        modules: currentMods,
        files: currentFiles,
        updatedAt: new Date().toISOString(),
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          ban_reason: payload,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', CLOUD_LECTURES_STORE_ID);

      if (error) {
        console.warn('[coursesStorage] Error syncing to cloud store by ID, trying email:', error);
        await supabase
          .from('profiles')
          .update({
            ban_reason: payload,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('email', CLOUD_LECTURES_STORE_EMAIL);
      }
    } catch (e) {
      console.warn('[coursesStorage] Cloud sync exception:', e);
    }
  },

  // جلب ومزامنة أحدث المحاضرات من السحابة (Supabase Cloud Store)
  async syncFromCloud(): Promise<{ modules: CourseModule[]; files: CourseFileItem[] } | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('ban_reason, updated_at')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      let targetData = data;
      if (error || !targetData || !targetData.ban_reason) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('ban_reason, updated_at')
          .eq('email', CLOUD_LECTURES_STORE_EMAIL)
          .maybeSingle();
        targetData = byEmail;
      }

      if (!targetData || !targetData.ban_reason) return null;

      let cloudModules: CourseModule[] | null = null;
      let cloudFiles: CourseFileItem[] | null = null;

      try {
        const parsed = JSON.parse(targetData.ban_reason);
        if (Array.isArray(parsed)) {
          cloudModules = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.modules)) {
            cloudModules = parsed.modules;
          }
          if (Array.isArray(parsed.files)) {
            cloudFiles = parsed.files;
          }
        }
      } catch (e) {
        console.warn('[coursesStorage] Cloud JSON parse error:', e);
      }

      if (cloudModules && cloudModules.length > 0) {
        localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(cloudModules));
        localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(cloudModules));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: cloudModules }));
        }
      }

      if (cloudFiles && Array.isArray(cloudFiles) && cloudFiles.length > 0) {
        localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(cloudFiles));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: cloudFiles }));
        }
      }

      if (cloudModules || (cloudFiles && cloudFiles.length > 0)) {
        return {
          modules: cloudModules || this.getModules(),
          files: (cloudFiles && cloudFiles.length > 0) ? cloudFiles : this.getFiles(),
        };
      }
    } catch (e) {
      console.warn('[coursesStorage] syncFromCloud exception:', e);
    }
    return null;
  },

  getModules(): CourseModule[] {
    try {
      // 1. قراءة التخزين الأساسي المستقر v7
      const raw = localStorage.getItem('tarqa_custom_modules_v7');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }

      // 2. الهجرة الآمنة من v6 إذا كانت موجودة لأول مرة فقط
      const rawV6 = localStorage.getItem('tarqa_custom_modules_v6');
      if (rawV6) {
        const parsedV6 = JSON.parse(rawV6);
        if (Array.isArray(parsedV6) && parsedV6.length > 0) {
          this.saveModules(parsedV6);
          return parsedV6;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved modules:', e);
    }

    // 3. الحالة الافتراضية المبدئية عند فتح الموقع لأول مرة فقط
    const initial = JSON.parse(JSON.stringify(mockFoundationModules));
    this.saveModules(initial);
    return initial;
  },

  saveModules(modules: CourseModule[]): CourseModule[] {
    try {
      localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(modules));
      localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(modules));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: modules }));
      }
    } catch (e) {
      console.warn('Failed to save modules to local storage:', e);
    }

    // مزامنة فورية للسحابة لتحديث كافة الطلاب فوراً
    this.syncToCloud(modules);

    return modules;
  },

  addModule(newModule: CourseModule): CourseModule[] {
    const current = this.getModules();
    const updated = [...current, newModule];
    return this.saveModules(updated);
  },

  updateModule(updatedModule: CourseModule): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((m) => (m.id === updatedModule.id ? updatedModule : m));
    return this.saveModules(updated);
  },

  deleteModule(moduleId: string): CourseModule[] {
    const current = this.getModules();
    const updated = current.filter((m) => m.id !== moduleId);
    return this.saveModules(updated);
  },

  addLesson(moduleId: string, newLesson: Lesson): CourseModule[] {
    const current = this.getModules();
    if (current.length === 0) {
      current.push({
        id: 'mod-lectures',
        title: 'المحاضرات',
        description: 'محاضرات التأسيس الشاملة للقدرات',
        orderIndex: 1,
        isPublished: true,
        lessons: [],
      });
    }

    // تحديد الباب المستهدف أو استخدام أول باب
    const targetModule = current.find((m) => m.id === moduleId) || current[0];
    newLesson.moduleId = targetModule.id;
    newLesson.moduleTitle = targetModule.title;

    const updated = current.map((mod) => {
      // إزالة أي درس مسبق بنفس المعرف لمنع التكرار
      const filtered = (mod.lessons || []).filter((l) => l.id !== newLesson.id);
      if (mod.id === targetModule.id) {
        const nextLessons = [...filtered, newLesson];
        return {
          ...mod,
          lessons: nextLessons,
          totalDurationMinutes: nextLessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
        };
      }
      return {
        ...mod,
        lessons: filtered,
      };
    });

    return this.saveModules(updated);
  },

  updateLesson(updatedLesson: Lesson): CourseModule[] {
    const current = this.getModules();
    // التأكد من معرف الباب حتى لو لم يكن محدداً بشكل صحيح في كائن الدرس
    let targetModId = updatedLesson.moduleId;
    if (!targetModId) {
      const found = current.find((m) => (m.lessons || []).some((l) => l.id === updatedLesson.id));
      if (found) {
        targetModId = found.id;
        updatedLesson.moduleId = found.id;
        updatedLesson.moduleTitle = found.title;
      } else if (current[0]) {
        targetModId = current[0].id;
        updatedLesson.moduleId = current[0].id;
        updatedLesson.moduleTitle = current[0].title;
      }
    }

    const updated = current.map((mod) => {
      if (mod.id === targetModId) {
        const exists = (mod.lessons || []).some((l) => l.id === updatedLesson.id);
        const lessons = exists
          ? mod.lessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
          : [...(mod.lessons || []), updatedLesson];
        return {
          ...mod,
          lessons,
          totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
        };
      } else {
        // حذف من الباب القديم إذا تم تغيير الباب التابع له
        const filtered = (mod.lessons || []).filter((l) => l.id !== updatedLesson.id);
        return {
          ...mod,
          lessons: filtered,
          totalDurationMinutes: filtered.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
        };
      }
    });
    return this.saveModules(updated);
  },

  deleteLesson(moduleIdOrLessonId: string, maybeLessonId?: string): CourseModule[] {
    const targetId = maybeLessonId || moduleIdOrLessonId;
    const current = this.getModules();
    const updated = current.map((mod) => {
      const filtered = (mod.lessons || []).filter((l) => l.id !== targetId);
      return {
        ...mod,
        lessons: filtered,
        totalDurationMinutes: filtered.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      };
    });
    return this.saveModules(updated);
  },

  togglePublish(lessonId: string): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => ({
      ...mod,
      lessons: (mod.lessons || []).map((l) =>
        l.id === lessonId ? { ...l, isPublished: !l.isPublished } : l
      ),
    }));
    return this.saveModules(updated);
  },

  toggleFreePreview(moduleIdOrLessonId: string, maybeLessonId?: string): CourseModule[] {
    const targetId = maybeLessonId || moduleIdOrLessonId;
    const current = this.getModules();
    const updated = current.map((mod) => ({
      ...mod,
      lessons: (mod.lessons || []).map((l) =>
        l.id === targetId ? { ...l, isFreePreview: !l.isFreePreview } : l
      ),
    }));
    return this.saveModules(updated);
  },

  reorderLessons(moduleId: string, lessonId: string, direction: 'up' | 'down'): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((mod) => {
      if (mod.id !== moduleId && moduleId !== 'all') return mod;
      const list = [...(mod.lessons || [])];
      const idx = list.findIndex((l) => l.id === lessonId);
      if (idx === -1) return mod;
      if (direction === 'up' && idx === 0) return mod;
      if (direction === 'down' && idx === list.length - 1) return mod;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      const temp = list[idx];
      list[idx] = list[targetIdx];
      list[targetIdx] = temp;
      return { ...mod, lessons: list };
    });
    return this.saveModules(updated);
  },

  resetToDefault(): CourseModule[] {
    const resetData = JSON.parse(JSON.stringify(mockFoundationModules));
    return this.saveModules(resetData);
  },

  // إدارة قسم ملفات ومذكرات الدورة
  getFiles(): CourseFileItem[] {
    try {
      const raw = localStorage.getItem('tarqa_custom_files_v1');
      if (raw !== null) {
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
      // تنظيف أي Data URLs ضخمة قبل التخزين في localStorage منعاً لحدوث QuotaExceededError
      const safeFiles = files.map((f) => {
        if (f.fileUrl && f.fileUrl.startsWith('data:') && f.fileUrl.length > 5000) {
          return { ...f, fileUrl: `vault://pdf_migrated_${f.id}` };
        }
        return f;
      });
      localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(safeFiles));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: files }));
      }
    } catch (e) {
      console.warn('Failed to save files to local storage:', e);
    }

    // مزامنة فورية للسحابة
    this.syncToCloud(undefined, files);
  },

  addFile(newFile: CourseFileItem): CourseFileItem[] {
    const current = this.getFiles();
    // منع تكرار نفس الملف في حال استدعاء الدالة في المكون الفرعي والأب معاً
    const filtered = current.filter((f) => f.id !== newFile.id);
    const updated = [newFile, ...filtered];
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

