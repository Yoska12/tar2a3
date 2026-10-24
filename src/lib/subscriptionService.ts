import { UserRole, CourseModule, Lesson, CourseSubscription, CourseFileItem, CourseEnrollmentStatus, InstructorInfo } from '../types';
import { TarqaUser, supabase, isSupabaseConfigured, isValidUuid } from './supabase';
import { isOwnerEmail } from './securityUtils';
export { isOwnerEmail };
import { mockFoundationModules, mockCourseFiles, AVAILABLE_INSTRUCTORS } from '../data/foundationModules';
import { dbCache, invalidateCoursesCache } from './dbCache';

export const ANNUAL_SUBSCRIPTION_PRICE_SAR = 75;
export const ANNUAL_SUBSCRIPTION_PRICE_EGP = 1050;

/**
 * التحقق مما إذا كان التسجيل في الدورة متاحاً حالياً
 */
export const isCourseEnrollmentOpen = (courseOrModule?: { status?: CourseEnrollmentStatus } | null): boolean => {
  if (!courseOrModule || !courseOrModule.status) return true;
  return courseOrModule.status === 'active';
};

/**
 * الحصول على تفاصيل حالة التسجيل في الدورة (النص، اللون، إمكانية الاشتراك)
 */
export const getCourseEnrollmentInfo = (courseOrModule?: {
  status?: CourseEnrollmentStatus;
  availableDate?: string;
  customStatusText?: string;
} | null) => {
  const status: CourseEnrollmentStatus = courseOrModule?.status || 'active';
  const customText = courseOrModule?.customStatusText?.trim();
  const availableDate = courseOrModule?.availableDate?.trim();

  switch (status) {
    case 'paused':
      return {
        status,
        isOpen: false,
        badgeText: customText || 'التسجيل مغلق مؤقتاً ⏸️',
        buttonText: customText || 'قريباً ⏳',
        badgeColor: 'amber',
        notice: availableDate
          ? `التسجيل في هذه الدورة مغلق مؤقتاً، وسيُعاد فتحه بتاريخ: ${availableDate}`
          : 'التسجيل في هذه الدورة مغلق مؤقتاً لحين إعادة فتحها.',
      };
    case 'upcoming':
      return {
        status,
        isOpen: false,
        badgeText: customText || 'متاح قريباً ⏳',
        buttonText: customText || 'قريباً ⏳',
        badgeColor: 'blue',
        notice: availableDate
          ? `ستنطلق الدورة ويُتاح التسجيل بتاريخ: ${availableDate}`
          : 'هذه الدورة قادمة قريباً، ترقبوا موعد الانطلاق!',
      };
    case 'active':
    default:
      return {
        status: 'active' as CourseEnrollmentStatus,
        isOpen: true,
        badgeText: customText || 'التسجيل متاح الآن 🟢',
        buttonText: customText || 'اشترك الآن 🚀',
        badgeColor: 'emerald',
        notice: null,
      };
  }
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

  // 1. فحص حقل isSubscribed الصريح في كائن المستخدم
  if (user.isSubscribed === true) {
    if (!user.subscriptionExpiresAt) return true;
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    if (isNaN(expiry) || expiry > Date.now()) {
      return true;
    }
  }

  // 2. فحص حقل انتهاء الاشتراك في كائن المستخدم
  if (user.subscriptionExpiresAt) {
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    if (!isNaN(expiry) && expiry > Date.now()) {
      return true;
    }
  }

  // 3. فحص التخزين المحلي للاشتراكات
  try {
    const raw = localStorage.getItem('tarqa_subscriptions');
    if (raw) {
      const subs: Record<string, CourseSubscription> = JSON.parse(raw);
      const userSub = subs[user.id] || (user.email ? subs[user.email.toLowerCase()] : null);
      if (userSub && (userSub.isActive || (userSub as any).active)) {
        const expiryDate = userSub.expiresDate || (userSub as any).expiresAt;
        if (!expiryDate) return true;
        const expiry = new Date(expiryDate).getTime();
        if (isNaN(expiry) || expiry > Date.now()) {
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
  // فحص حالة التسجيل في الدورة: منع أي اشتراك إذا كانت الدورة موقوفة مؤقتاً
  const mainModule = coursesStorage.getModules()[0];
  if (mainModule && mainModule.status && mainModule.status !== 'active') {
    const info = getCourseEnrollmentInfo(mainModule);
    return {
      success: false,
      expiresAt: '',
      message: info.notice || 'التسجيل في هذه الدورة مغلق مؤقتاً (Course enrollment is currently paused)',
    };
  }

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

    // تحديث قائمة الأعضاء في tarqa_all_users_roles
    const allRolesRaw = localStorage.getItem('tarqa_all_users_roles');
    if (allRolesRaw) {
      const parsedRoles = JSON.parse(allRolesRaw);
      if (Array.isArray(parsedRoles)) {
        const updatedRoles = parsedRoles.map((u: any) => {
          if (u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase())) {
            return {
              ...u,
              isSubscribed: true,
              subscriptionExpiresAt: oneYearFromNow,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedRoles));
      }
    }

    // تحديث قائمة المستخدمين المسجلين tarqa_registered_users
    const registeredRaw = localStorage.getItem('tarqa_registered_users');
    if (registeredRaw) {
      const parsedReg = JSON.parse(registeredRaw);
      if (Array.isArray(parsedReg)) {
        const updatedReg = parsedReg.map((u: any) => {
          if (u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase())) {
            return {
              ...u,
              isSubscribed: true,
              subscriptionExpiresAt: oneYearFromNow,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_registered_users', JSON.stringify(updatedReg));
      }
    }

    // تحديث المستخدم الحالي في localStorage
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      if (parsed.id === user.id || (user.email && parsed.email?.toLowerCase() === user.email.toLowerCase())) {
        parsed.isSubscribed = true;
        parsed.subscriptionExpiresAt = oneYearFromNow;
        localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
      }
    }
  } catch (err) {
    console.warn('Error saving subscription locally:', err);
  }

  // 2. تحديث في قاعدة بيانات Supabase إن وجدت
  if (isSupabaseConfigured && (user.id || user.email)) {
    try {
      try {
        await supabase.rpc('admin_grant_subscription', {
          target_user_id: user.id,
          days_count: 365,
          target_email: user.email || null,
        });
      } catch (rpcErr) {}

      if (user.id && isValidUuid(user.id)) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: oneYearFromNow,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id);
      }

      if (user.email) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: oneYearFromNow,
            updated_at: new Date().toISOString(),
          } as any)
          .ilike('email', user.email.trim());
      }

      // مزامنة فورية في السحابة المركزية لضمان ظهور الاشتراك في داشبورد الإدارة على جميع الأجهزة
      try {
        const { data: storeData } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        let currentStorePayload: any = {};
        if (storeData?.ban_reason) {
          try {
            currentStorePayload = JSON.parse(storeData.ban_reason);
          } catch {}
        }

        const currentSubs = currentStorePayload.subscriptions || {};
        if (user.id) currentSubs[user.id] = subRecord;
        if (user.email) currentSubs[user.email.toLowerCase().trim()] = subRecord;

        const newStorePayload = {
          ...currentStorePayload,
          subscriptions: currentSubs,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from('profiles')
          .update({
            ban_reason: JSON.stringify(newStorePayload),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', CLOUD_LECTURES_STORE_ID);
      } catch (cloudErr) {
        console.warn('Could not sync subscription to cloud store:', cloudErr);
      }
    } catch (dbErr) {
      console.warn('Could not sync subscription to Supabase:', dbErr);
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
  userEmail?: string,
  telegramUsername?: string,
  telegramId?: number
): Promise<{ success: boolean; message: string }> => {
  const emailClean = userEmail ? userEmail.toLowerCase().trim() : undefined;
  const tgClean = telegramUsername ? telegramUsername.replace(/^@/, '').toLowerCase().trim() : undefined;
  const tgIdClean = telegramId ? String(telegramId) : undefined;

  const cancelledRecord = {
    userId,
    userEmail: emailClean,
    telegramUsername: tgClean,
    telegramId,
    isActive: false,
    active: false,
    isSubscribed: false,
    cancelledAt: new Date().toISOString(),
  };

  // 1. تحديث التخزين المحلي للاشتراكات بشكل قاطع
  try {
    const raw = localStorage.getItem('tarqa_subscriptions') || '{}';
    const subs = JSON.parse(raw);
    if (userId) subs[userId] = { ...(subs[userId] || {}), ...cancelledRecord };
    if (emailClean) subs[emailClean] = { ...(subs[emailClean] || {}), ...cancelledRecord };
    if (tgClean) subs[tgClean] = { ...(subs[tgClean] || {}), ...cancelledRecord };
    if (tgIdClean) subs[tgIdClean] = { ...(subs[tgIdClean] || {}), ...cancelledRecord };
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث المستخدم الحالي إذا كان هو المعني
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      const curEmail = (parsed.email || '').toLowerCase().trim();
      const curTg = (parsed.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        parsed.id === userId ||
        (emailClean && curEmail === emailClean) ||
        (tgClean && curTg === tgClean) ||
        (telegramId && parsed.telegramId === telegramId);

      if (isMatch) {
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
          const uEm = (u.email || '').toLowerCase().trim();
          const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const isMatch =
            u.id === userId ||
            (emailClean && uEm === emailClean) ||
            (tgClean && uTg === tgClean) ||
            (telegramId && u.telegramId === telegramId);

          if (isMatch) {
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

    // تحديث قائمة tarqa_registered_users
    const regRaw = localStorage.getItem('tarqa_registered_users');
    if (regRaw) {
      const parsedReg = JSON.parse(regRaw);
      if (Array.isArray(parsedReg)) {
        const updatedReg = parsedReg.map((u: any) => {
          const uEm = (u.email || '').toLowerCase().trim();
          const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const isMatch =
            u.id === userId ||
            (emailClean && uEm === emailClean) ||
            (tgClean && uTg === tgClean) ||
            (telegramId && u.telegramId === telegramId);

          if (isMatch) {
            return {
              ...u,
              isSubscribed: false,
              subscriptionExpiresAt: undefined,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_registered_users', JSON.stringify(updatedReg));
      }
    }
  } catch (err) {
    console.warn('Error cancelling subscription locally:', err);
  }

  // 2. تحديث في قاعدة بيانات Supabase إذا كانت متصلة
  if (isSupabaseConfigured && (userId || emailClean || tgClean || telegramId)) {
    try {
      try {
        await supabase.rpc('admin_cancel_subscription', {
          target_user_id: userId || '',
          target_email: emailClean || null,
        });
      } catch (rpcErr) {}

      if (userId && isValidUuid(userId)) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_expires_at: null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', userId);
      }

      if (emailClean) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_expires_at: null,
            updated_at: new Date().toISOString(),
          } as any)
          .ilike('email', emailClean);
      }

      if (tgClean) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_expires_at: null,
            updated_at: new Date().toISOString(),
          } as any)
          .or(`telegram_username.eq.${tgClean},telegram_username.eq.@${tgClean}`);
      }

      if (telegramId) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: false,
            subscription_expires_at: null,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('telegram_id', telegramId);
      }

      // 3. مزامنة فورية في السحابة المركزية
      try {
        const { data: storeData } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        let currentStorePayload: any = {};
        if (storeData?.ban_reason) {
          try {
            currentStorePayload = JSON.parse(storeData.ban_reason);
          } catch {}
        }

        const currentSubs = currentStorePayload.subscriptions || {};
        if (userId) currentSubs[userId] = cancelledRecord;
        if (emailClean) currentSubs[emailClean] = cancelledRecord;
        if (tgClean) currentSubs[tgClean] = cancelledRecord;

        const newStorePayload = {
          ...currentStorePayload,
          subscriptions: currentSubs,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from('profiles')
          .update({
            ban_reason: JSON.stringify(newStorePayload),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', CLOUD_LECTURES_STORE_ID);
      } catch {}
    } catch (dbErr) {
      console.warn('Could not sync subscription cancellation to Supabase:', dbErr);
    }
  }

  // 4. إطلاق الأحداث لتحديث كافة واجهات الموقع فوراً
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: { userId, email: emailClean, isActive: false } }));
    window.dispatchEvent(new CustomEvent('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
    window.dispatchEvent(new Event('storage'));
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
  targetUser: { id: string; email?: string; fullName?: string; telegramUsername?: string; telegramId?: number },
  days: number = 365
): Promise<{ success: boolean; message: string }> => {
  const emailClean = targetUser.email ? targetUser.email.toLowerCase().trim() : undefined;
  const tgClean = targetUser.telegramUsername ? targetUser.telegramUsername.replace(/^@/, '').toLowerCase().trim() : undefined;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  
  const subRecord: CourseSubscription = {
    userId: targetUser.id,
    userEmail: emailClean,
    userName: targetUser.fullName,
    planId: 'annual_75',
    planName: 'باقة طرقع السنوية الشاملة',
    priceSAR: ANNUAL_SUBSCRIPTION_PRICE_SAR,
    startDate: new Date().toISOString(),
    expiresDate: expiresAt,
    isActive: true,
    active: true,
  } as any;

  try {
    const raw = localStorage.getItem('tarqa_subscriptions') || '{}';
    const subs = JSON.parse(raw);
    if (targetUser.id) subs[targetUser.id] = subRecord;
    if (emailClean) subs[emailClean] = subRecord;
    if (tgClean) subs[tgClean] = subRecord;
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث tarqa_all_users_roles
    const allRolesRaw = localStorage.getItem('tarqa_all_users_roles');
    if (allRolesRaw) {
      const parsedRoles = JSON.parse(allRolesRaw);
      if (Array.isArray(parsedRoles)) {
        const updatedRoles = parsedRoles.map((u: any) => {
          const uEm = (u.email || '').toLowerCase().trim();
          const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const isMatch =
            u.id === targetUser.id ||
            (emailClean && uEm === emailClean) ||
            (tgClean && uTg === tgClean) ||
            (targetUser.telegramId && u.telegramId === targetUser.telegramId);

          if (isMatch) {
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

    // تحديث tarqa_registered_users
    const registeredRaw = localStorage.getItem('tarqa_registered_users');
    if (registeredRaw) {
      const parsedReg = JSON.parse(registeredRaw);
      if (Array.isArray(parsedReg)) {
        const updatedReg = parsedReg.map((u: any) => {
          const uEm = (u.email || '').toLowerCase().trim();
          const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
          const isMatch =
            u.id === targetUser.id ||
            (emailClean && uEm === emailClean) ||
            (tgClean && uTg === tgClean) ||
            (targetUser.telegramId && u.telegramId === targetUser.telegramId);

          if (isMatch) {
            return {
              ...u,
              isSubscribed: true,
              subscriptionExpiresAt: expiresAt,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_registered_users', JSON.stringify(updatedReg));
      }
    }

    // تحديث المستخدم الحالي إن كان هو المستهدف
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      const curEmail = (parsed.email || '').toLowerCase().trim();
      const curTg = (parsed.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        parsed.id === targetUser.id ||
        (emailClean && curEmail === emailClean) ||
        (tgClean && curTg === tgClean);

      if (isMatch) {
        parsed.isSubscribed = true;
        parsed.subscriptionExpiresAt = expiresAt;
        localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
      }
    }
  } catch (err) {
    console.warn('Error granting subscription locally:', err);
  }

  // 2. تحديث Supabase
  if (isSupabaseConfigured && (targetUser.id || emailClean || tgClean)) {
    try {
      if (targetUser.id && isValidUuid(targetUser.id)) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', targetUser.id);
      }

      if (emailClean) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          } as any)
          .ilike('email', emailClean);
      }

      if (tgClean) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          } as any)
          .or(`telegram_username.eq.${tgClean},telegram_username.eq.@${tgClean}`);
      }

      // مزامنة فورية في السحابة المركزية
      try {
        const { data: storeData } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        let currentStorePayload: any = {};
        if (storeData?.ban_reason) {
          try {
            currentStorePayload = JSON.parse(storeData.ban_reason);
          } catch {}
        }

        const currentSubs = currentStorePayload.subscriptions || {};
        if (targetUser.id) currentSubs[targetUser.id] = subRecord;
        if (emailClean) currentSubs[emailClean] = subRecord;
        if (tgClean) currentSubs[tgClean] = subRecord;

        const newStorePayload = {
          ...currentStorePayload,
          subscriptions: currentSubs,
          updatedAt: new Date().toISOString(),
        };

        await supabase
          .from('profiles')
          .update({
            ban_reason: JSON.stringify(newStorePayload),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', CLOUD_LECTURES_STORE_ID);
      } catch {}
    } catch {}
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: subRecord }));
    window.dispatchEvent(new CustomEvent('tarqa_user_changed'));
    window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
    window.dispatchEvent(new Event('storage'));
  }

  return {
    success: true,
    message: `تم تفعيل الاشتراك السنوي لـ ${targetUser.fullName || 'الطالب'} بنجاح!`,
  };
};

export const CLOUD_LECTURES_STORE_ID = '32344334-a8b9-40c3-aeeb-9d55f4d160e4';
export const CLOUD_LECTURES_STORE_EMAIL = 'lectures_store@tarqa.app';

/**
 * إدارة وتخزين وحدات ومحاضرات الدورات (مع المزامنة السحابية الفورية لجميع الطلاب)
 */
export const coursesStorage = {
  // إدارة معرفات المحاضرات والملفات المحذوفة نهائياً لمنع عودتها
  getDeletedLessonIds(): string[] {
    try {
      const raw = localStorage.getItem('tarqa_deleted_lessons_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },

  addDeletedLessonId(lessonId: string) {
    if (!lessonId) return;
    try {
      const current = this.getDeletedLessonIds();
      if (!current.includes(lessonId)) {
        const updated = [...current, lessonId];
        localStorage.setItem('tarqa_deleted_lessons_v1', JSON.stringify(updated));
      }
    } catch (e) {}
  },

  getDeletedFileIds(): string[] {
    try {
      const raw = localStorage.getItem('tarqa_deleted_files_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  },

  addDeletedFileId(fileId: string) {
    if (!fileId) return;
    try {
      const current = this.getDeletedFileIds();
      if (!current.includes(fileId)) {
        const updated = [...current, fileId];
        localStorage.setItem('tarqa_deleted_files_v1', JSON.stringify(updated));
      }
    } catch (e) {}
  },

  // مزامنة فورية إلى السحابة (Supabase Cloud Store)
  async syncToCloud(modules?: CourseModule[], files?: CourseFileItem[]) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const currentMods = modules !== undefined ? modules : this.getModules();
      const currentFiles = files !== undefined ? files : this.getFiles();
      const deletedLessonIds = this.getDeletedLessonIds();
      const deletedFileIds = this.getDeletedFileIds();

      // جلب البيانات السحابية الحالية للحفاظ على الاشتراكات وسجلات التحميلات
      let existingPayload: any = {};
      try {
        const { data: storeData } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        if (storeData?.ban_reason) {
          existingPayload = JSON.parse(storeData.ban_reason);
        }
      } catch {}

      const payload = JSON.stringify({
        ...existingPayload,
        version: 3,
        modules: currentMods,
        files: currentFiles,
        instructors: this.getInstructors(),
        deletedLessonIds,
        deletedFileIds,
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

  // جلب ومزامنة أحدث المحاضرات والاشتراكات من السحابة (Supabase Cloud Store)
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
      let cloudInstructors: InstructorInfo[] | null = null;
      let cloudDeletedLessons: string[] = [];
      let cloudDeletedFiles: string[] = [];
      let cloudSubs: Record<string, any> | null = null;

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
          if (Array.isArray(parsed.instructors)) {
            cloudInstructors = parsed.instructors;
          }
          if (Array.isArray(parsed.deletedLessonIds)) {
            cloudDeletedLessons = parsed.deletedLessonIds;
          }
          if (Array.isArray(parsed.deletedFileIds)) {
            cloudDeletedFiles = parsed.deletedFileIds;
          }
          if (parsed.subscriptions && typeof parsed.subscriptions === 'object') {
            cloudSubs = parsed.subscriptions;
          }
        }
      } catch (e) {
        console.warn('[coursesStorage] Cloud JSON parse error:', e);
      }

      if (cloudInstructors && Array.isArray(cloudInstructors) && cloudInstructors.length > 0) {
        try {
          localStorage.setItem('tarqa_custom_instructors_v1', JSON.stringify(cloudInstructors));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tarqa_instructors_changed', { detail: cloudInstructors }));
          }
        } catch {}
      }

      // مزامنة الاشتراكات السحابية محلياً فوراً
      if (cloudSubs && Object.keys(cloudSubs).length > 0) {
        try {
          const rawLocal = localStorage.getItem('tarqa_subscriptions') || '{}';
          const localSubs = JSON.parse(rawLocal);
          const mergedSubs = { ...localSubs, ...cloudSubs };
          localStorage.setItem('tarqa_subscriptions', JSON.stringify(mergedSubs));

          // التحقق مما إذا كان للمستخدم الحالي اشتراك مفعل سحابياً
          const curRaw = localStorage.getItem('tarqa_current_user');
          if (curRaw) {
            const cur = JSON.parse(curRaw);
            const userSub = cloudSubs[cur.id] || (cur.email && (cloudSubs[cur.email.toLowerCase()] || cloudSubs[cur.email]));
            if (userSub && (userSub.isActive === true || (userSub as any).active === true)) {
              const expDate = userSub.expiresDate || (userSub as any).expiresAt;
              const isNotExpired = !expDate || new Date(expDate).getTime() > Date.now();
              if (isNotExpired && !cur.isSubscribed) {
                cur.isSubscribed = true;
                cur.subscriptionExpiresAt = expDate || cur.subscriptionExpiresAt;
                localStorage.setItem('tarqa_current_user', JSON.stringify(cur));
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: userSub }));
                  window.dispatchEvent(new Event('tarqa_user_changed'));
                }
              }
            }
          }
        } catch {}
      }

      // دمج المعرفات المحذوفة سحابياً ومحلياً
      cloudDeletedLessons.forEach((id) => this.addDeletedLessonId(id));
      cloudDeletedFiles.forEach((id) => this.addDeletedFileId(id));
      const deletedLessonsSet = new Set(this.getDeletedLessonIds());
      const deletedFilesSet = new Set(this.getDeletedFileIds());

      let finalModules = this.getModules();
      if (cloudModules && Array.isArray(cloudModules) && cloudModules.length > 0) {
        const cleanedModules = cloudModules.map((m) => ({
          ...m,
          lessons: (m.lessons || []).filter((l: Lesson) => !deletedLessonsSet.has(l.id)),
        }));
        localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(cleanedModules));
        localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(cleanedModules));
        finalModules = cleanedModules;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: cleanedModules }));
        }
      }

      let finalFiles = this.getFiles();
      if (cloudFiles && Array.isArray(cloudFiles)) {
        const cleanedFiles = cloudFiles.filter((f) => !deletedFilesSet.has(f.id));
        localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(cleanedFiles));
        finalFiles = cleanedFiles;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: cleanedFiles }));
        }
      }

      return {
        modules: finalModules,
        files: finalFiles,
      };
    } catch (e) {
      console.warn('[coursesStorage] syncFromCloud exception:', e);
    }
    return null;
  },

  getModules(): CourseModule[] {
    const cached = dbCache.get<CourseModule[]>('db_course_modules');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const deletedLessonIds = new Set(this.getDeletedLessonIds());
    const normalizeLessons = (lessons: Lesson[]): Lesson[] => {
      const activeLessons = (lessons || []).filter((l: Lesson) => !deletedLessonIds.has(l.id));
      const withTeachers = activeLessons.map((l) => ({
        ...l,
        teacherId: l.teacherId || 'teacher_1',
        teacherName: l.teacherName || (l.teacherId === 'teacher_2' ? 'مدرس 2' : 'مدرس 1'),
      }));

      // إذا كان التخزين القديم لا يحتوي على محاضرات مدرس 2، نقوم بدمج محاضرات مدرس 2 الافتراضية
      const hasTeacher2 = withTeachers.some((l) => l.teacherId === 'teacher_2');
      if (!hasTeacher2) {
        const defaultTeacher2Lessons = (mockFoundationModules[0]?.lessons || []).filter(
          (l) => l.teacherId === 'teacher_2' && !deletedLessonIds.has(l.id)
        );
        return [...withTeachers, ...defaultTeacher2Lessons];
      }
      return withTeachers;
    };

    try {
      // 1. قراءة التخزين الأساسي المستقر v7
      const raw = localStorage.getItem('tarqa_custom_modules_v7');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const result = parsed.map((m) => {
            const lessons = normalizeLessons(m.lessons || []);
            const status = m.status === 'paused' && (!m.customStatusText || m.customStatusText.includes('قريباً')) ? 'active' : (m.status || 'active');
            return {
              ...m,
              status,
              customStatusText: status === 'active' ? '' : m.customStatusText,
              lessons,
              totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
            };
          });
          dbCache.set('db_course_modules', result, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
          return result;
        }
      }

      // 2. الهجرة الآمنة من v6 إذا كانت موجودة لأول مرة فقط
      const rawV6 = localStorage.getItem('tarqa_custom_modules_v6');
      if (rawV6 !== null) {
        const parsedV6 = JSON.parse(rawV6);
        if (Array.isArray(parsedV6) && parsedV6.length > 0) {
          const cleaned = parsedV6.map((m) => {
            const lessons = normalizeLessons(m.lessons || []);
            const status = m.status === 'paused' && (!m.customStatusText || m.customStatusText.includes('قريباً')) ? 'active' : (m.status || 'active');
            return {
              ...m,
              status,
              customStatusText: status === 'active' ? '' : m.customStatusText,
              lessons,
              totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
            };
          });
          this.saveModules(cleaned);
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved modules:', e);
    }

    // 3. الحالة الافتراضية المعتمدة فقط عند أول تشغيل للتطبيق قبل أي تخصيص
    const initial: CourseModule[] = JSON.parse(JSON.stringify(mockFoundationModules));
    const cleanedInitial = initial.map((m) => {
      const lessons = normalizeLessons(m.lessons || []);
      return {
        ...m,
        lessons,
        totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      };
    });
    this.saveModules(cleanedInitial);
    return cleanedInitial;
  },

  saveModules(modules: CourseModule[]): CourseModule[] {
    const deletedLessonIds = new Set(this.getDeletedLessonIds());
    const sanitizedModules = modules.map((m) => ({
      ...m,
      lessons: (m.lessons || []).filter((l: Lesson) => !deletedLessonIds.has(l.id)),
    }));

    try {
      dbCache.set('db_course_modules', sanitizedModules, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
      localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(sanitizedModules));
      localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(sanitizedModules));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: sanitizedModules }));
      }
    } catch (e) {
      console.warn('Failed to save modules to local storage:', e);
    }

    // مزامنة فورية للسحابة لتحديث كافة الطلاب فوراً
    this.syncToCloud(sanitizedModules);

    return sanitizedModules;
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

  updateModuleStatus(
    moduleId: string,
    status: CourseEnrollmentStatus,
    availableDate?: string,
    customStatusText?: string
  ): CourseModule[] {
    const current = this.getModules();
    const updated = current.map((m) =>
      m.id === moduleId
        ? {
            ...m,
            status,
            availableDate: availableDate !== undefined ? availableDate : m.availableDate,
            customStatusText: customStatusText !== undefined ? customStatusText : m.customStatusText,
          }
        : m
    );
    return this.saveModules(updated);
  },

  deleteModule(moduleId: string): CourseModule[] {
    const current = this.getModules();
    const targetModule = current.find((m) => m.id === moduleId);
    if (targetModule && targetModule.lessons) {
      targetModule.lessons.forEach((l) => this.addDeletedLessonId(l.id));
    }
    const updated = current.filter((m) => m.id !== moduleId);
    return this.saveModules(updated);
  },

  addLesson(moduleId: string, newLesson: Lesson): CourseModule[] {
    // إزالة المعرف من قائمة المحذوفات في حال إعادة إضافته
    try {
      const deleted = this.getDeletedLessonIds().filter((id) => id !== newLesson.id);
      localStorage.setItem('tarqa_deleted_lessons_v1', JSON.stringify(deleted));
    } catch (e) {}

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
    if (targetId) {
      this.addDeletedLessonId(targetId);
    }

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

  resetFilesToDefault(): CourseFileItem[] {
    try {
      localStorage.removeItem('tarqa_deleted_files_v1');
    } catch (e) {}
    const defaultFiles = JSON.parse(JSON.stringify(mockCourseFiles));
    this.saveFiles(defaultFiles);
    return defaultFiles;
  },

  resetToDefault(): CourseModule[] {
    try {
      localStorage.removeItem('tarqa_deleted_lessons_v1');
    } catch (e) {}
    const resetData = JSON.parse(JSON.stringify(mockFoundationModules));
    this.saveModules(resetData);
    this.resetFilesToDefault();
    return resetData;
  },

  // إدارة قسم ملفات ومذكرات الدورة
  getFiles(): CourseFileItem[] {
    const cached = dbCache.get<CourseFileItem[]>('db_course_files');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }

    const deletedFileIds = new Set(this.getDeletedFileIds());
    try {
      if (typeof window !== 'undefined' && !localStorage.getItem('tarqa_clean_mocks_files_v2')) {
        const raw = localStorage.getItem('tarqa_custom_files_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (f: CourseFileItem) =>
                !['file-1', 'file-2', 'file-3'].includes(f.id) &&
                !f.fileUrl?.startsWith('vault://pdf')
            );
            localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(filtered));
          }
        }
        localStorage.setItem('tarqa_clean_mocks_files_v2', 'true');
      }
    } catch {}

    try {
      const raw = localStorage.getItem('tarqa_custom_files_v1');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const res = parsed.filter((f: CourseFileItem) => !deletedFileIds.has(f.id));
          dbCache.set('db_course_files', res, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
          return res;
        }
      }
    } catch (e) {}
    const defaultFiles: CourseFileItem[] = JSON.parse(JSON.stringify(mockCourseFiles));
    const cleaned = defaultFiles.filter((f) => !deletedFileIds.has(f.id));
    this.saveFiles(cleaned);
    return cleaned;
  },

  saveFiles(files: CourseFileItem[]) {
    const deletedFileIds = new Set(this.getDeletedFileIds());
    const sanitizedFiles = files.filter((f) => !deletedFileIds.has(f.id));

    try {
      // تنظيف أي Data URLs ضخمة قبل التخزين في localStorage منعاً لحدوث QuotaExceededError
      const safeFiles = sanitizedFiles.map((f) => {
        if (f.fileUrl && f.fileUrl.startsWith('data:') && f.fileUrl.length > 5000) {
          return { ...f, fileUrl: `vault://pdf_migrated_${f.id}` };
        }
        return f;
      });
      dbCache.set('db_course_files', safeFiles, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
      localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(safeFiles));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: safeFiles }));
      }
    } catch (e) {
      console.warn('Failed to save files to local storage:', e);
    }

    // مزامنة فورية للسحابة
    this.syncToCloud(undefined, sanitizedFiles);
  },

  addFile(newFile: CourseFileItem): CourseFileItem[] {
    try {
      const deleted = this.getDeletedFileIds().filter((id) => id !== newFile.id);
      localStorage.setItem('tarqa_deleted_files_v1', JSON.stringify(deleted));
    } catch (e) {}

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
    if (fileId) {
      this.addDeletedFileId(fileId);
    }
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

  getInstructors(): InstructorInfo[] {
    try {
      const raw = localStorage.getItem('tarqa_custom_instructors_v1');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return AVAILABLE_INSTRUCTORS;
  },

  saveInstructors(instructors: InstructorInfo[]): InstructorInfo[] {
    try {
      localStorage.setItem('tarqa_custom_instructors_v1', JSON.stringify(instructors));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_instructors_changed', { detail: instructors }));
      }
    } catch (e) {
      console.warn('Failed to save instructors locally:', e);
    }
    this.syncToCloud();
    return instructors;
  },

  updateInstructor(instructor: InstructorInfo): InstructorInfo[] {
    const current = this.getInstructors();
    const index = current.findIndex((i) => i.id === instructor.id);
    let updated: InstructorInfo[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = { ...updated[index], ...instructor };
    } else {
      updated = [...current, instructor];
    }
    this.saveInstructors(updated);

    // تحديث اسم المدرس في جميع المحاضرات المرتبطة بهذا المعلم لضمان الاتساق
    try {
      const currentModules = this.getModules();
      let hasChanges = false;
      const updatedModules = currentModules.map((m) => ({
        ...m,
        lessons: (m.lessons || []).map((l) => {
          if ((l.teacherId || 'teacher_1') === instructor.id) {
            hasChanges = true;
            return {
              ...l,
              teacherName: instructor.name,
            };
          }
          return l;
        }),
      }));
      if (hasChanges) {
        this.saveModules(updatedModules);
      }
    } catch (e) {}

    return updated;
  },
};

/**
 * مزامنة وجلب كافة اشتراكات الطلاب من السحابة المركزية مباشرة
 */
export async function syncSubscriptionsFromCloud(): Promise<Record<string, any>> {
  if (!isSupabaseConfigured || !supabase) {
    try {
      const raw = localStorage.getItem('tarqa_subscriptions');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  try {
    const { data: storeData } = await supabase
      .from('profiles')
      .select('ban_reason')
      .eq('id', CLOUD_LECTURES_STORE_ID)
      .maybeSingle();

    let cloudSubs: Record<string, any> = {};
    if (storeData?.ban_reason) {
      try {
        const parsed = JSON.parse(storeData.ban_reason);
        if (parsed.subscriptions && typeof parsed.subscriptions === 'object') {
          cloudSubs = parsed.subscriptions;
        }
      } catch {}
    }

    const rawLocal = localStorage.getItem('tarqa_subscriptions') || '{}';
    const localSubs = JSON.parse(rawLocal);
    const merged = { ...localSubs, ...cloudSubs };
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('syncSubscriptionsFromCloud error:', err);
    try {
      const raw = localStorage.getItem('tarqa_subscriptions');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
}

