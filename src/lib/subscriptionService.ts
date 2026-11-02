import { UserRole, CourseModule, Lesson, CourseSubscription, CourseFileItem, CourseEnrollmentStatus, InstructorInfo, CourseItem, AdBannerItem } from '../types';
import { TarqaUser, supabase, isSupabaseConfigured, isValidUuid } from './supabase';
import { isOwnerEmail } from './securityUtils';
export { isOwnerEmail };
import { mockFoundationModules, mockCourseFiles, AVAILABLE_INSTRUCTORS } from '../data/foundationModules';
import { dbCache, invalidateCoursesCache, invalidateUsersCache, invalidateSubscriptionsCache } from './dbCache';

export const ANNUAL_SUBSCRIPTION_PRICE_SAR = 75;
export const ANNUAL_SUBSCRIPTION_PRICE_EGP = 1100;

export const DEFAULT_FOUNDATION_COURSE: CourseItem = {
  id: 'course-foundation',
  title: 'دورة التأسيس الشاملة للقدرات 🎯',
  description: 'محاضرات مسجلة وتأسيس شامل من الصفر حتى 100% للقسمين الكمي واللفظي مع مذكرة التأسيس المعتمدة PDF.',
  coverImage: '',
  badge: 'الدورة المعتمدة 1446',
  badgeColor: 'amber',
  priceSar: 75,
  priceEg: 1100,
  status: 'active',
  orderIndex: 1,
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

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

  const cleanEmail = (user.email || '').toLowerCase().trim();
  const cleanId = (user.id || '').trim();

  // فحص سجل الاشتراكات المحلي أولاً للتحقق من أي قرار إلغاء أو تفعيل صريح
  let userSub: CourseSubscription | null = null;
  try {
    const raw = localStorage.getItem('tarqa_subscriptions');
    if (raw) {
      const subs: Record<string, CourseSubscription> = JSON.parse(raw);
      userSub = (cleanId ? subs[cleanId] : null) || (cleanEmail ? subs[cleanEmail] : null);
    }
  } catch (e) {
    console.warn('Failed to parse local subscriptions:', e);
  }

  // إذا تم إلغاء الاشتراك صراحة في سجل الاشتراكات
  if (userSub && (userSub.isActive === false || (userSub as any).active === false || (userSub as any).status === 'cancelled')) {
    return false;
  }

  // إذا كان الحساب غير مشترك صراحة في كائن المستخدم
  if (user.isSubscribed === false) {
    // نتأكد فقط إن كان هناك اشتراك مفعل حديثاً في userSub
    if (userSub && (userSub.isActive === true || (userSub as any).active === true || (userSub as any).status === 'active')) {
      const expiryDate = userSub.expiresDate || (userSub as any).expiresAt;
      if (!expiryDate) return true;
      const expiry = new Date(expiryDate).getTime();
      if (!isNaN(expiry) && expiry > Date.now()) {
        return true;
      }
    }
    return false;
  }

  // 1. فحص حقل isSubscribed الصريح في كائن المستخدم
  if (user.isSubscribed === true) {
    if (!user.subscriptionExpiresAt) return true;
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    if (isNaN(expiry) || expiry > Date.now()) {
      return true;
    }
    return false;
  }

  // 2. فحص سجل الاشتراكات المحلي إذا توفر اشتراك مفعل سارٍ
  if (userSub && (userSub.isActive === true || (userSub as any).active === true || (userSub as any).status === 'active')) {
    const expiryDate = userSub.expiresDate || (userSub as any).expiresAt;
    if (!expiryDate) return true;
    const expiry = new Date(expiryDate).getTime();
    if (isNaN(expiry) || expiry > Date.now()) {
      return true;
    }
  }

  // 3. فحص حقل انتهاء الاشتراك في كائن المستخدم إن كان سارياً
  if (user.subscriptionExpiresAt) {
    const expiry = new Date(user.subscriptionExpiresAt).getTime();
    if (!isNaN(expiry) && expiry > Date.now()) {
      return true;
    }
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
 * ملاحظة: غير المسجلين (الزوار) يتوجب عليهم تسجيل حساب أولاً
 */
export const canAccessLesson = (lesson: Lesson, user?: TarqaUser | null): boolean => {
  if (!user) return false;
  if (lesson.isFreePreview) return true;
  return isUserSubscribed(user);
};

/**
 * وظيفة مساعدة لمزامنة الاشتراك مباشرة مع خادم الباك إند (Hostinger PHP Backend)
 */
export async function syncSubscriptionToBackend(
  action: 'grant' | 'cancel',
  payload: {
    userId?: string;
    userEmail?: string;
    userName?: string;
    telegramUsername?: string;
    telegramId?: number;
    days?: number;
  }
): Promise<boolean> {
  try {
    const res = await fetch('/api/subscriptions.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        userId: payload.userId,
        userEmail: payload.userEmail,
        userName: payload.userName,
        telegramUsername: payload.telegramUsername,
        telegramId: payload.telegramId,
        days: payload.days || 365,
      }),
      keepalive: true,
    });
    return res.ok;
  } catch (err) {
    console.debug('[syncSubscriptionToBackend] notice:', err);
    return false;
  }
}

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
    const cleanEmail = (user.email || '').toLowerCase().trim();
    const cleanTg = (user.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();

    if (user.id) subs[user.id] = subRecord;
    if (cleanEmail) subs[cleanEmail] = subRecord;
    if (cleanTg) subs[cleanTg] = subRecord;
    if (user.telegramId) subs[String(user.telegramId)] = subRecord;
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));

    // تحديث أو إدراج في tarqa_all_users_roles لظهور فوري في الداشبورد عند الأدمن
    const allRolesRaw = localStorage.getItem('tarqa_all_users_roles');
    let parsedRoles: any[] = allRolesRaw ? JSON.parse(allRolesRaw) : [];
    if (!Array.isArray(parsedRoles)) parsedRoles = [];

    let foundInRoles = false;
    parsedRoles = parsedRoles.map((u: any) => {
      const uEm = (u.email || '').toLowerCase().trim();
      const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        (user.id && u.id === user.id) ||
        (cleanEmail && uEm === cleanEmail) ||
        (cleanTg && uTg === cleanTg) ||
        (user.telegramId && u.telegramId === user.telegramId);

      if (isMatch) {
        foundInRoles = true;
        return {
          ...u,
          fullName: user.fullName || u.fullName,
          email: user.email || u.email,
          isSubscribed: true,
          subscriptionExpiresAt: oneYearFromNow,
        };
      }
      return u;
    });

    if (!foundInRoles) {
      parsedRoles.push({
        id: user.id || 'usr_' + Date.now(),
        email: user.email || 'student@tarqa.app',
        fullName: user.fullName || 'طالب طرقع',
        role: user.role || 'student',
        targetScore: user.targetScore || 100,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId,
        avatarUrl: user.avatarUrl,
        isSubscribed: true,
        subscriptionExpiresAt: oneYearFromNow,
        createdAt: new Date().toISOString(),
      });
    }
    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(parsedRoles));

    // تحديث قائمة المستخدمين المسجلين tarqa_registered_users
    const registeredRaw = localStorage.getItem('tarqa_registered_users');
    let parsedReg: any[] = registeredRaw ? JSON.parse(registeredRaw) : [];
    if (!Array.isArray(parsedReg)) parsedReg = [];

    let foundInReg = false;
    parsedReg = parsedReg.map((u: any) => {
      const uEm = (u.email || '').toLowerCase().trim();
      const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        (user.id && u.id === user.id) ||
        (cleanEmail && uEm === cleanEmail) ||
        (cleanTg && uTg === cleanTg) ||
        (user.telegramId && u.telegramId === user.telegramId);

      if (isMatch) {
        foundInReg = true;
        return {
          ...u,
          fullName: user.fullName || u.fullName,
          email: user.email || u.email,
          isSubscribed: true,
          subscriptionExpiresAt: oneYearFromNow,
        };
      }
      return u;
    });

    if (!foundInReg) {
      parsedReg.push({
        id: user.id || 'usr_' + Date.now(),
        email: user.email || 'student@tarqa.app',
        fullName: user.fullName || 'طالب طرقع',
        role: user.role || 'student',
        targetScore: user.targetScore || 100,
        telegramUsername: user.telegramUsername,
        telegramId: user.telegramId,
        avatarUrl: user.avatarUrl,
        isSubscribed: true,
        subscriptionExpiresAt: oneYearFromNow,
        createdAt: new Date().toISOString(),
      });
    }
    localStorage.setItem('tarqa_registered_users', JSON.stringify(parsedReg));

    // تحديث المستخدم الحالي في localStorage
    const currentRaw = localStorage.getItem('tarqa_current_user');
    if (currentRaw) {
      const parsed = JSON.parse(currentRaw);
      const curEm = (parsed.email || '').toLowerCase().trim();
      const curTg = (parsed.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        parsed.id === user.id ||
        (cleanEmail && curEm === cleanEmail) ||
        (cleanTg && curTg === cleanTg);

      if (isMatch) {
        parsed.isSubscribed = true;
        parsed.subscriptionExpiresAt = oneYearFromNow;
        localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
      }
    }

    // تسجيل المعاملة مباشرة في سجل معاملات كاشير ليراها الأدمن فوراً
    try {
      const txRaw = localStorage.getItem('tarqa_kashier_transactions');
      let txList: any[] = txRaw ? JSON.parse(txRaw) : [];
      if (!Array.isArray(txList)) txList = [];
      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        orderId: `TARQA3_${Date.now()}`,
        userId: user.id || 'student',
        userName: user.fullName || 'طالب طرقع',
        userEmail: user.email || 'student@tarqa.app',
        amount: ANNUAL_SUBSCRIPTION_PRICE_EGP,
        currency: 'EGP',
        status: 'SUCCESS',
        details: 'تم تأكيد الدفع وتفعيل الاشتراك السنوي الشامل بنجاح',
        timestamp: new Date().toISOString(),
      };
      txList.unshift(newTx);
      localStorage.setItem('tarqa_kashier_transactions', JSON.stringify(txList.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('tarqa_kashier_tx_logged', { detail: newTx }));
    } catch {}

    // تفريغ كاش المستخدمين والاشتراكات لضمان جلب البيانات الحديثة فوراً
    invalidateUsersCache();
    invalidateSubscriptionsCache();
    dbCache.invalidate('db_users_with_roles');
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

      if (user.telegramId) {
        await supabase
          .from('profiles')
          .update({
            is_subscribed: true,
            subscription_expires_at: oneYearFromNow,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('telegram_id', user.telegramId);
      }

      try {
        await supabase.rpc('activate_kashier_subscription', {
          p_order_id: null,
          p_user_id: user.id || null,
          p_user_email: user.email || null,
        });
      } catch {}

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

  // 3. مزامنة مباشرة ومؤكدة مع خادم الباك إند (Hostinger PHP Backend)
  syncSubscriptionToBackend('grant', {
    userId: user.id,
    userEmail: user.email,
    userName: user.fullName,
    telegramUsername: user.telegramUsername,
    telegramId: user.telegramId,
    days: 365,
  }).catch(() => {});

  // 4. إطلاق حدث تحديث في النافذة
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: subRecord }));
    window.dispatchEvent(new CustomEvent('tarqa:subscription_updated', { detail: subRecord }));
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

    // تحديث سجل معاملات كاشير لتعليم أي معاملة لهذا المستخدم بأنها ملغاة
    try {
      const txRaw = localStorage.getItem('tarqa_kashier_transactions');
      if (txRaw) {
        const txList = JSON.parse(txRaw);
        if (Array.isArray(txList)) {
          const updatedTxList = txList.map((tx: any) => {
            const txEm = (tx.userEmail || '').toLowerCase().trim();
            const isMatch = (userId && tx.userId === userId) || (emailClean && txEm === emailClean);
            if (isMatch && tx.status === 'SUCCESS') {
              return { ...tx, status: 'CANCELLED', details: 'تم إلغاء الاشتراك من قبل الإدارة' };
            }
            return tx;
          });
          localStorage.setItem('tarqa_kashier_transactions', JSON.stringify(updatedTxList));
        }
      }
    } catch {}

    // تفريغ الكاش فوراً لضمان عدم عودة البيانات القديمة
    dbCache.invalidate('db_users_with_roles');
    invalidateUsersCache();
    invalidateSubscriptionsCache();
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

  // 4. مزامنة الإلغاء مع خادم الباك إند (Hostinger PHP Backend)
  syncSubscriptionToBackend('cancel', {
    userId,
    userEmail: emailClean,
    telegramUsername: tgClean,
    telegramId,
  }).catch(() => {});

  // 5. إطلاق الأحداث لتحديث كافة واجهات الموقع فوراً
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: { userId, email: emailClean, isActive: false } }));
    window.dispatchEvent(new CustomEvent('tarqa:subscription_updated', { detail: { userId, email: emailClean, isActive: false } }));
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
    let parsedRoles: any[] = allRolesRaw ? JSON.parse(allRolesRaw) : [];
    if (!Array.isArray(parsedRoles)) parsedRoles = [];
    let foundInRoles = false;
    const updatedRoles = parsedRoles.map((u: any) => {
      const uEm = (u.email || '').toLowerCase().trim();
      const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        u.id === targetUser.id ||
        (emailClean && uEm === emailClean) ||
        (tgClean && uTg === tgClean) ||
        (targetUser.telegramId && u.telegramId === targetUser.telegramId);

      if (isMatch) {
        foundInRoles = true;
        return {
          ...u,
          fullName: targetUser.fullName || u.fullName,
          isSubscribed: true,
          subscriptionExpiresAt: expiresAt,
        };
      }
      return u;
    });

    if (!foundInRoles) {
      updatedRoles.push({
        id: targetUser.id || ('usr_' + Date.now()),
        email: targetUser.email || (emailClean || 'student@tarqa.app'),
        fullName: targetUser.fullName || 'طالب مشترك',
        role: 'student',
        targetScore: 100,
        telegramUsername: targetUser.telegramUsername,
        telegramId: targetUser.telegramId,
        isSubscribed: true,
        subscriptionExpiresAt: expiresAt,
        createdAt: new Date().toISOString(),
        lastSignInAt: new Date().toISOString(),
      });
    }
    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedRoles));

    // تحديث tarqa_registered_users
    const registeredRaw = localStorage.getItem('tarqa_registered_users');
    let parsedReg: any[] = registeredRaw ? JSON.parse(registeredRaw) : [];
    if (!Array.isArray(parsedReg)) parsedReg = [];
    let foundInReg = false;
    const updatedReg = parsedReg.map((u: any) => {
      const uEm = (u.email || '').toLowerCase().trim();
      const uTg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isMatch =
        u.id === targetUser.id ||
        (emailClean && uEm === emailClean) ||
        (tgClean && uTg === tgClean) ||
        (targetUser.telegramId && u.telegramId === targetUser.telegramId);

      if (isMatch) {
        foundInReg = true;
        return {
          ...u,
          fullName: targetUser.fullName || u.fullName,
          isSubscribed: true,
          subscriptionExpiresAt: expiresAt,
        };
      }
      return u;
    });

    if (!foundInReg && emailClean) {
      updatedReg.push({
        id: targetUser.id || ('usr_' + Date.now()),
        email: targetUser.email || emailClean,
        fullName: targetUser.fullName || 'طالب مشترك',
        role: 'student',
        targetScore: 100,
        telegramUsername: targetUser.telegramUsername,
        telegramId: targetUser.telegramId,
        isSubscribed: true,
        subscriptionExpiresAt: expiresAt,
        createdAt: new Date().toISOString(),
      });
    }
    localStorage.setItem('tarqa_registered_users', JSON.stringify(updatedReg));

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

    // تسجيل المعاملة في سجل المعاملات المالية لظهورها في الداشبورد
    try {
      const txRaw = localStorage.getItem('tarqa_kashier_transactions');
      let txList: any[] = txRaw ? JSON.parse(txRaw) : [];
      if (!Array.isArray(txList)) txList = [];
      const newTx = {
        id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        orderId: `TARQA3_${Date.now()}`,
        userId: targetUser.id || 'student',
        userName: targetUser.fullName || 'طالب طرقع',
        userEmail: targetUser.email || (emailClean || 'student@tarqa.app'),
        amount: ANNUAL_SUBSCRIPTION_PRICE_EGP,
        currency: 'EGP',
        status: 'SUCCESS',
        details: 'تفعيل اشتراك سنوي مباشر بواسطة إدارة المنصة',
        timestamp: new Date().toISOString(),
      };
      txList.unshift(newTx);
      localStorage.setItem('tarqa_kashier_transactions', JSON.stringify(txList.slice(0, 100)));
      window.dispatchEvent(new CustomEvent('tarqa_kashier_tx_logged', { detail: newTx }));
    } catch {}

    // تفريغ الكاش فوراً
    dbCache.invalidate('db_users_with_roles');
    invalidateUsersCache();
    invalidateSubscriptionsCache();
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

  // 3. مزامنة التفعيل مع خادم الباك إند (Hostinger PHP Backend)
  syncSubscriptionToBackend('grant', {
    userId: targetUser.id,
    userEmail: emailClean,
    userName: targetUser.fullName,
    telegramUsername: tgClean,
    telegramId: targetUser.telegramId,
    days,
  }).catch(() => {});

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: subRecord }));
    window.dispatchEvent(new CustomEvent('tarqa:subscription_updated', { detail: subRecord }));
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
 * قائمة معرفات المحاضرات والملفات الوهمية القديمة لحذفها نهائياً ومنع ظهورها لأي زائر أو مشترك
 */
export const MOCK_LESSON_IDS = new Set<string>([
  'les-1', 'les-2', 'les-3', 'les-4', 'les-5', 'les-6', 'les-7', 'les-8',
  'les-t2-1', 'les-t2-2', 'les-t2-3', 'les-t2-4', 'les-t2-5', 'les-t2-6', 'les-t2-7', 'les-t2-8'
]);

export const MOCK_FILE_IDS = new Set<string>(['file-1', 'file-2', 'file-3']);

export const isMockLesson = (l: any): boolean => {
  if (!l) return false;
  const id = String(l.id || '');
  const videoUrl = String(l.videoUrl || '');
  const title = String(l.title || '');
  // حظر وحذف أي محاضرات وهمية أو تجريبية سابقة (بما فيها فيديوهات الدلافين oceans.mp4) نهائياً
  if (
    MOCK_LESSON_IDS.has(id) ||
    id.startsWith('mock-') ||
    videoUrl.includes('oceans.mp4') ||
    videoUrl.includes('vjs.zencdn.net') ||
    title.includes('جدول الضرب') ||
    title.includes('الحساب الذهني الخاطف') ||
    title.includes('الكسور وتوحيد المقامات') ||
    title.includes('التكنيك السريع للعمليات الحسابية') ||
    title.includes('الكسور الاعتيادية والعشرية')
  ) {
    return true;
  }
  return false;
};

export const isMockFile = (f: any): boolean => {
  if (!f) return false;
  const id = String(f.id || '');
  const url = String(f.fileUrl || '');
  // ملفات الدورة الافتراضية الـ 3 السابقة حصراً
  if (MOCK_FILE_IDS.has(id) || id.startsWith('mock-')) return true;
  if (url === 'vault://pdf_tarqa_foundation_2025' || url === 'vault://pdf_golden_rules_summary' || url === 'vault://pdf_practice_worksheets') return true;
  return false;
};

// تنظيف فوري لجميع المحاضرات والملفات الوهمية ومحاضرات الدلافين من التخزين المحلي فور تحميل الملف
try {
  if (typeof window !== 'undefined') {
    // إضافة محاضرات الدلافين تلقائياً إلى قائمة المحذوفات حتى لا تظهر نهائياً
    const delRaw = localStorage.getItem('tarqa_deleted_lessons_v1');
    const delList: string[] = delRaw ? JSON.parse(delRaw) : [];
    [
      'les-1', 'les-2', 'les-3', 'les-4', 'les-5', 'les-6', 'les-7', 'les-8',
      'les-t2-1', 'les-t2-2', 'les-t2-3', 'les-t2-4', 'les-t2-5', 'les-t2-6', 'les-t2-7', 'les-t2-8'
    ].forEach((id) => {
      if (!delList.includes(id)) delList.push(id);
    });
    localStorage.setItem('tarqa_deleted_lessons_v1', JSON.stringify(delList));

    ['tarqa_custom_modules_v8', 'tarqa_custom_modules_v7'].forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.map((m: any) => ({
              ...m,
              lessons: (m.lessons || []).filter((l: any) => !isMockLesson(l)),
            }));
            localStorage.setItem(k, JSON.stringify(cleaned));
          }
        } catch {}
      }
    });

    ['tarqa_custom_files_v2', 'tarqa_custom_files_v1'].forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter((f: any) => !isMockFile(f));
            localStorage.setItem(k, JSON.stringify(cleaned));
          }
        } catch {}
      }
    });

    dbCache.invalidate('db_course_modules');
  }
} catch {}

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
        if (Array.isArray(parsed)) {
          return parsed;
        }
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
        if (Array.isArray(parsed)) {
          return parsed;
        }
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
  async syncToCloud(modules?: CourseModule[], files?: CourseFileItem[], courses?: CourseItem[], banners?: AdBannerItem[]) {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const currentMods = modules !== undefined ? modules : this.getModules();
      const currentFiles = files !== undefined ? files : this.getFiles();
      const currentCourses = courses !== undefined ? courses : this.getCourses();
      const currentBanners = banners !== undefined ? banners : this.getBanners();
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
          delete existingPayload.maintenanceConfig;
        }
      } catch {}

      const payload = JSON.stringify({
        ...existingPayload,
        version: 4,
        modules: currentMods,
        files: currentFiles,
        courses: currentCourses,
        adBanners: currentBanners,
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
      let cloudCourses: CourseItem[] | null = null;
      let cloudBanners: AdBannerItem[] | null = null;
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
          if (Array.isArray(parsed.courses)) {
            cloudCourses = parsed.courses;
          }
          if (Array.isArray(parsed.adBanners)) {
            cloudBanners = parsed.adBanners;
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

      if (cloudCourses && Array.isArray(cloudCourses) && cloudCourses.length > 0) {
        try {
          localStorage.setItem('tarqa_custom_courses_v1', JSON.stringify(cloudCourses));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tarqa_courses_list_changed', { detail: cloudCourses }));
          }
        } catch {}
      }

      if (cloudBanners && Array.isArray(cloudBanners)) {
        try {
          localStorage.setItem('tarqa_ad_banners_v1', JSON.stringify(cloudBanners));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('tarqa_ad_banners_changed', { detail: cloudBanners }));
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
      let hasCloudMocks = false;

      if (cloudModules && Array.isArray(cloudModules) && cloudModules.length > 0) {
        const cleanedModules = cloudModules.map((m) => {
          const rawLessons = m.lessons || [];
          const lessons = rawLessons
            .filter((l: Lesson) => !deletedLessonsSet.has(l.id) && !isMockLesson(l))
            .map((l: Lesson) => {
              let vUrl = l.videoUrl || '';
              return { ...l, videoUrl: vUrl };
            });
          return {
            ...m,
            lessons,
            totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
          };
        });
        localStorage.setItem('tarqa_custom_modules_v8', JSON.stringify(cleanedModules));
        localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(cleanedModules));
        finalModules = cleanedModules;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tarqa_courses_modules_changed', { detail: cleanedModules }));
        }
      }

      let finalFiles = this.getFiles();
      if (cloudFiles && Array.isArray(cloudFiles) && cloudFiles.length > 0) {
        const cleanedFiles = cloudFiles.filter((f) => !deletedFilesSet.has(f.id) && !isMockFile(f));
        localStorage.setItem('tarqa_custom_files_v2', JSON.stringify(cleanedFiles));
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

  getModules(courseId?: string): CourseModule[] {
    const cached = dbCache.get<CourseModule[]>('db_course_modules');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      const hasMock = cached.some((m) =>
        (m.lessons || []).some((l) => isMockLesson(l))
      );
      if (!hasMock) {
        if (courseId) {
          return cached.filter((m) => (m.courseId || 'course-foundation') === courseId);
        }
        return cached;
      }
      dbCache.invalidate('db_course_modules');
    }

    const deletedLessonIds = new Set(this.getDeletedLessonIds());

    const normalizeLessons = (lessons: Lesson[]): Lesson[] => {
      // استبعاد أي محاضرات محذوفة نهائياً أو وهمية
      const activeLessons = (lessons || []).filter(
        (l: Lesson) => !deletedLessonIds.has(l.id) && !isMockLesson(l)
      );
      return activeLessons.map((l) => {
        let vUrl = l.videoUrl || '';
        return {
          ...l,
          videoUrl: vUrl,
          teacherId: l.teacherId || 'teacher_1',
          teacherName: l.teacherName || (l.teacherId === 'teacher_2' ? 'مدرس 2' : 'مدرس 1'),
        };
      });
    };

    try {
      // 1. قراءة التخزين الأساسي المستقر v8 أو v7
      const raw = localStorage.getItem('tarqa_custom_modules_v8') || localStorage.getItem('tarqa_custom_modules_v7');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // تنظيف وإلغاء تكرار الأبواب المتكررة بنفس المعرف أو بنفس العنوان الفارغ
          const seenIds = new Set<string>();
          const seenTitles = new Set<string>();
          const deduped: any[] = [];
          for (const m of parsed) {
            if (!m || !m.title) continue;
            const normTitle = m.title.trim().toLowerCase();
            // تخطي التكرار إذا كان نفس المعرف أو نفس العنوان وبدون دروس مستقلة
            if (seenIds.has(m.id) || (seenTitles.has(normTitle) && (m.lessons || []).length === 0)) {
              continue;
            }
            seenIds.add(m.id);
            seenTitles.add(normTitle);
            deduped.push(m);
          }

          const validModules = deduped.length > 0 ? deduped : parsed;
          const result = validModules.map((m, idx) => {
            const rawLessons = m.lessons || [];
            const lessons = normalizeLessons(rawLessons);
            const status = m.status === 'paused' && (!m.customStatusText || m.customStatusText.includes('قريباً')) ? 'active' : (m.status || 'active');
            return {
              ...m,
              courseId: m.courseId || 'course-foundation',
              orderIndex: m.orderIndex || idx + 1,
              status,
              customStatusText: status === 'active' ? '' : m.customStatusText,
              lessons,
              totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
            };
          });
          dbCache.set('db_course_modules', result, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
          if (courseId) {
            return result.filter((m) => (m.courseId || 'course-foundation') === courseId);
          }
          return result;
        }
      }
    } catch (e) {
      console.warn('Failed to parse saved modules:', e);
    }

    // 2. الحالة الافتراضية المعتمدة (فارغة تماماً من أي محاضرات وهمية)
    const initial: CourseModule[] = JSON.parse(JSON.stringify(mockFoundationModules));
    const cleanedInitial = initial.map((m) => {
      const lessons = normalizeLessons(m.lessons || []);
      return {
        ...m,
        courseId: m.courseId || 'course-foundation',
        lessons,
        totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      };
    });
    this.saveModules(cleanedInitial);
    if (courseId) {
      return cleanedInitial.filter((m) => (m.courseId || 'course-foundation') === courseId);
    }
    return cleanedInitial;
  },

  saveModules(modules: CourseModule[]): CourseModule[] {
    const deletedLessonIds = new Set(this.getDeletedLessonIds());
    // ضمان عدم وجود أي كائنات مكررة بنفس المعرف نهائياً
    const seenIds = new Set<string>();
    const uniqueModules: CourseModule[] = [];
    for (const m of modules) {
      if (!m || !m.id || seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      uniqueModules.push(m);
    }

    const sanitizedModules = uniqueModules.map((m) => {
      let lessons = (m.lessons || []).filter((l: Lesson) => !deletedLessonIds.has(l.id) && !isMockLesson(l));
      return {
        ...m,
        lessons,
        totalDurationMinutes: lessons.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
      };
    });

    try {
      dbCache.set('db_course_modules', sanitizedModules, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
      localStorage.setItem('tarqa_custom_modules_v8', JSON.stringify(sanitizedModules));
      localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(sanitizedModules));
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
    // 1. توليد معرف فريد مؤكد في حال عدم وجوده أو تكراره
    const uniqueId = newModule.id && !current.some((m) => m.id === newModule.id)
      ? newModule.id
      : 'mod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

    // 2. الحماية الصارمة من التكرار: إذا كان الباب موجوداً مسبقاً بنفس المعرف، نعيد القائمة الحالية مباشرة
    if (current.some((m) => m.id === uniqueId)) {
      return current;
    }

    // 3. منع تكرار إضافة نفس العنوان في نفس اللحظة (Double Submit Guard)
    const normTitle = newModule.title.trim().toLowerCase();
    const existingTitle = current.find((m) => m.title.trim().toLowerCase() === normTitle);
    if (existingTitle) {
      // إذا كان موجوداً بالفعل وتم طلبه مرة أخرى، لا نكرره ونعيد القائمة دون مضاعفة
      return current;
    }

    const modToAdd: CourseModule = {
      ...newModule,
      id: uniqueId,
      courseId: newModule.courseId || 'course-foundation',
      title: newModule.title.trim(),
      orderIndex: newModule.orderIndex || current.length + 1,
      lessons: newModule.lessons || [],
      totalDurationMinutes: (newModule.lessons || []).reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
    };

    const updated = [...current, modToAdd];
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
    if (current.length <= 1) {
      // حماية: عدم حذف الباب الوحيد في الدورة
      return current;
    }

    const targetModule = current.find((m) => m.id === moduleId);
    if (targetModule && targetModule.lessons) {
      targetModule.lessons.forEach((l) => this.addDeletedLessonId(l.id));
    }

    // حذف الباب المختار حصراً ومطابقة الـ ID فقط
    const updated = current.filter((m) => m.id !== moduleId);
    if (updated.length === 0) {
      return current;
    }

    // إعادة فهرسة الترتيب للأبواب المتبقية
    const reindexed = updated.map((m, idx) => ({
      ...m,
      orderIndex: idx + 1,
    }));

    return this.saveModules(reindexed);
  },

  reorderModules(moduleId: string, direction: 'up' | 'down'): CourseModule[] {
    const current = this.getModules();
    const idx = current.findIndex((m) => m.id === moduleId);
    if (idx === -1) return current;
    if (direction === 'up' && idx === 0) return current;
    if (direction === 'down' && idx === current.length - 1) return current;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    const updated = [...current];
    const temp = updated[idx];
    updated[idx] = updated[targetIdx];
    updated[targetIdx] = temp;
    const reindexed = updated.map((m, index) => ({
      ...m,
      orderIndex: index + 1,
    }));
    return this.saveModules(reindexed);
  },

  addLesson(moduleId: string, newLesson: Lesson): CourseModule[] {
    // إزالة المعرف من قائمة المحذوفات في حال إعادة إضافته لضمان عدم استبعاده
    if (newLesson && newLesson.id) {
      try {
        const deleted = this.getDeletedLessonIds().filter((id) => id !== newLesson.id);
        localStorage.setItem('tarqa_deleted_lessons_v1', JSON.stringify(deleted));
      } catch (e) {}
    }

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

    // تحديد الباب المستهدف أو استخدام أول باب متاح
    const targetModule = (moduleId && moduleId !== 'all' ? current.find((m) => m.id === moduleId) : null) || current[0];
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
        totalDurationMinutes: filtered.reduce((sum, l) => sum + (l.durationMinutes || 0), 0),
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
    this.saveFiles([]);
    return [];
  },

  resetToDefault(): CourseModule[] {
    try {
      localStorage.removeItem('tarqa_deleted_lessons_v1');
    } catch (e) {}
    const resetData = JSON.parse(JSON.stringify(mockFoundationModules)).map((m: any) => ({
      ...m,
      lessons: [],
      totalDurationMinutes: 0,
    }));
    this.saveModules(resetData);
    this.resetFilesToDefault();
    return resetData;
  },

  // إدارة قسم ملفات ومذكرات الدورة
  getFiles(courseId?: string): CourseFileItem[] {
    const cached = dbCache.get<CourseFileItem[]>('db_course_files');
    if (cached && Array.isArray(cached) && cached.length > 0) {
      const hasTarqaApp = cached.some((f) => f.fileUrl && f.fileUrl.includes('tarqa.app/files/'));
      if (!hasTarqaApp) {
        if (courseId) {
          return cached.filter((f) => (f.courseId || 'course-foundation') === courseId);
        }
        return cached;
      }
      dbCache.invalidate('db_course_files');
    }

    const deletedFileIds = new Set(this.getDeletedFileIds());

    try {
      const raw = localStorage.getItem('tarqa_custom_files_v2') || localStorage.getItem('tarqa_custom_files_v1');
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const res = parsed
            .filter((f: CourseFileItem) => !deletedFileIds.has(f.id) && !isMockFile(f))
            .map((f: CourseFileItem) => ({
              ...f,
              courseId: f.courseId || 'course-foundation',
              fileUrl: f.fileUrl && f.fileUrl.includes('tarqa.app/files/') ? '' : f.fileUrl,
            }));
          dbCache.set('db_course_files', res, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
          if (courseId) {
            return res.filter((f) => (f.courseId || 'course-foundation') === courseId);
          }
          return res;
        }
      }
    } catch (e) {}

    const defaultFiles: CourseFileItem[] = JSON.parse(JSON.stringify(mockCourseFiles));
    const cleaned = defaultFiles
      .filter((f) => !deletedFileIds.has(f.id) && !isMockFile(f))
      .map((f) => ({ ...f, courseId: f.courseId || 'course-foundation' }));
    this.saveFiles(cleaned);
    if (courseId) {
      return cleaned.filter((f) => (f.courseId || 'course-foundation') === courseId);
    }
    return cleaned;
  },

  saveFiles(files: CourseFileItem[]) {
    const deletedFileIds = new Set(this.getDeletedFileIds());
    const sanitizedFiles = files.filter((f) => !deletedFileIds.has(f.id) && !isMockFile(f));

    try {
      // تنظيف أي Data URLs ضخمة قبل التخزين في localStorage منعاً لحدوث QuotaExceededError
      const safeFiles = sanitizedFiles.map((f) => {
        if (f.fileUrl && f.fileUrl.startsWith('data:') && f.fileUrl.length > 5000) {
          return { ...f, fileUrl: `vault://pdf_migrated_${f.id}` };
        }
        return f;
      });
      dbCache.set('db_course_files', safeFiles, { tag: 'courses', ttlMs: 60 * 60 * 1000 });
      localStorage.setItem('tarqa_custom_files_v2', JSON.stringify(safeFiles));
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
    const fileToAdd: CourseFileItem = {
      ...newFile,
      courseId: newFile.courseId || 'course-foundation',
    };
    const updated = [fileToAdd, ...filtered];
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

  addInstructor(newInstructor: InstructorInfo): InstructorInfo[] {
    const current = this.getInstructors();
    const filtered = current.filter((i) => i.id !== newInstructor.id);
    const updated = [...filtered, newInstructor];
    return this.saveInstructors(updated);
  },

  deleteInstructor(instructorId: string): InstructorInfo[] {
    const current = this.getInstructors();
    if (current.length <= 1) {
      return current; // الاحتفاظ بمدرس واحد على الأقل كمرجع أساسي
    }
    const updated = current.filter((i) => i.id !== instructorId);
    this.saveInstructors(updated);

    // إعادة تعيين أي محاضرات تابعة لهذا المعلم إلى المعلم الأول المتاح
    const fallbackTeacher = updated[0];
    if (fallbackTeacher) {
      try {
        const currentModules = this.getModules();
        let hasChanges = false;
        const updatedModules = currentModules.map((m) => ({
          ...m,
          lessons: (m.lessons || []).map((l) => {
            if (l.teacherId === instructorId) {
              hasChanges = true;
              return {
                ...l,
                teacherId: fallbackTeacher.id,
                teacherName: fallbackTeacher.name,
              };
            }
            return l;
          }),
        }));
        if (hasChanges) {
          this.saveModules(updatedModules);
        }
      } catch (e) {}
    }
    return updated;
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

  // ==============================================================================
  // إدارة قائمة الدورات التدريبية المخصصة (Courses Management)
  // ==============================================================================
  getCourses(): CourseItem[] {
    try {
      const raw = localStorage.getItem('tarqa_custom_courses_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasFoundation = parsed.some((c: CourseItem) => c.id === 'course-foundation');
          const list = hasFoundation ? parsed : [DEFAULT_FOUNDATION_COURSE, ...parsed];
          return list.map((c: CourseItem) => {
            if (c.id === 'course-foundation' && (!c.priceEg || c.priceEg === 620)) {
              return { ...c, priceEg: ANNUAL_SUBSCRIPTION_PRICE_EGP };
            }
            return c;
          });
        }
      }
    } catch (e) {}
    return [DEFAULT_FOUNDATION_COURSE];
  },

  saveCourses(courses: CourseItem[]): CourseItem[] {
    try {
      const seen = new Set<string>();
      const deduped: CourseItem[] = [];
      for (const c of courses) {
        if (!c || !c.id || seen.has(c.id)) continue;
        seen.add(c.id);
        deduped.push(c);
      }
      const finalCourses = deduped.length > 0 ? deduped : [DEFAULT_FOUNDATION_COURSE];
      localStorage.setItem('tarqa_custom_courses_v1', JSON.stringify(finalCourses));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_courses_list_changed', { detail: finalCourses }));
      }
      this.syncToCloud(undefined, undefined, finalCourses);
      return finalCourses;
    } catch (e) {
      console.warn('Failed to save courses:', e);
      return courses;
    }
  },

  addCourse(newCourse: CourseItem): CourseItem[] {
    const current = this.getCourses();
    const uniqueId = newCourse.id && !current.some((c) => c.id === newCourse.id)
      ? newCourse.id
      : 'course_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const toAdd: CourseItem = {
      ...newCourse,
      id: uniqueId,
      orderIndex: newCourse.orderIndex || current.length + 1,
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, toAdd];
    return this.saveCourses(updated);
  },

  updateCourse(updatedCourse: CourseItem): CourseItem[] {
    const current = this.getCourses();
    const updated = current.map((c) => (c.id === updatedCourse.id ? { ...c, ...updatedCourse } : c));
    return this.saveCourses(updated);
  },

  deleteCourse(courseId: string): CourseItem[] {
    if (courseId === 'course-foundation') {
      return this.getCourses(); // دورة التأسيس المعتمدة لا يمكن حذفها
    }
    const current = this.getCourses();
    const updated = current.filter((c) => c.id !== courseId);
    return this.saveCourses(updated);
  },

  // ==============================================================================
  // إدارة بنرات وإعلانات الدورات التدريبية (Ad Banners Carousel)
  // ==============================================================================
  getBanners(): AdBannerItem[] {
    try {
      const raw = localStorage.getItem('tarqa_ad_banners_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((b: AdBannerItem) => b && b.imageUrl && b.imageUrl.trim().length > 0);
        }
      }
    } catch (e) {}
    return [];
  },

  saveBanners(banners: AdBannerItem[]): AdBannerItem[] {
    try {
      const sanitized = banners.filter((b) => b && b.imageUrl && b.imageUrl.trim().length > 0);
      localStorage.setItem('tarqa_ad_banners_v1', JSON.stringify(sanitized));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_ad_banners_changed', { detail: sanitized }));
      }
      this.syncToCloud(undefined, undefined, undefined, sanitized);
      return sanitized;
    } catch (e) {
      console.warn('Failed to save ad banners:', e);
      return banners;
    }
  },

  addBanner(newBanner: AdBannerItem): AdBannerItem[] {
    const current = this.getBanners();
    const uniqueId = newBanner.id && !current.some((b) => b.id === newBanner.id)
      ? newBanner.id
      : 'banner_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const toAdd: AdBannerItem = {
      ...newBanner,
      id: uniqueId,
      orderIndex: newBanner.orderIndex || current.length + 1,
      isActive: newBanner.isActive !== false,
      createdAt: new Date().toISOString(),
    };
    const updated = [...current, toAdd];
    return this.saveBanners(updated);
  },

  updateBanner(updatedBanner: AdBannerItem): AdBannerItem[] {
    const current = this.getBanners();
    const updated = current.map((b) => (b.id === updatedBanner.id ? { ...b, ...updatedBanner } : b));
    return this.saveBanners(updated);
  },

  deleteBanner(bannerId: string): AdBannerItem[] {
    const current = this.getBanners();
    const updated = current.filter((b) => b.id !== bannerId);
    return this.saveBanners(updated);
  },
};

/**
 * مزامنة وجلب كافة اشتراكات الطلاب من السحابة المركزية والباك إند مباشرة
 */
export async function syncSubscriptionsFromCloud(): Promise<Record<string, any>> {
  const rawLocal = localStorage.getItem('tarqa_subscriptions') || '{}';
  let localSubs: Record<string, any> = {};
  try {
    localSubs = JSON.parse(rawLocal);
  } catch {}

  // 1. جلب الاشتراكات الموثقة في خادم الباك إند (Hostinger PHP Backend)
  let backendSubs: Record<string, any> = {};
  try {
    const res = await fetch('/api/subscriptions.php');
    if (res.ok) {
      const data = await res.json();
      if (data?.subscriptions && typeof data.subscriptions === 'object') {
        backendSubs = data.subscriptions;
      }
    }
  } catch (bErr) {
    console.debug('[syncSubscriptionsFromCloud] Backend fetch notice:', bErr);
  }

  try {
    let cloudSubs: Record<string, any> = { ...backendSubs };

    // 1. استعلام كافة المشتركين الفعليين مباشرة من جدول profiles في Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: dbSubscribers, error: dbErr } = await supabase
          .from('profiles')
          .select('id, email, full_name, telegram_username, telegram_id, is_subscribed, subscription_expires_at, created_at')
          .eq('is_subscribed', true);

        if (!dbErr && dbSubscribers && dbSubscribers.length > 0) {
          for (const p of dbSubscribers) {
            const expDate = p.subscription_expires_at || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
            const subRecord = {
              userId: p.id,
              userEmail: p.email,
              userName: p.full_name || 'طالب طرقع',
              telegramUsername: p.telegram_username,
              telegramId: p.telegram_id,
              planId: 'annual_75',
              planName: 'باقة طرقع السنوية الشاملة',
              priceSAR: ANNUAL_SUBSCRIPTION_PRICE_SAR,
              startDate: p.created_at || new Date().toISOString(),
              expiresDate: expDate,
              isActive: true,
              active: true,
              status: 'active',
            };

            if (p.id) cloudSubs[p.id] = subRecord;
            if (p.email) cloudSubs[p.email.toLowerCase().trim()] = subRecord;
            if (p.telegram_username) cloudSubs[p.telegram_username.replace(/^@/, '').toLowerCase().trim()] = subRecord;
            if (p.telegram_id) cloudSubs[String(p.telegram_id)] = subRecord;
          }
        }
      } catch (fetchErr) {
        console.warn('[syncSubscriptionsFromCloud] DB profiles fetch notice:', fetchErr);
      }

      // 2. دمج الاشتراكات المسجلة في السحابة المركزية (CLOUD_LECTURES_STORE_ID)
      try {
        const { data: storeData } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        if (storeData?.ban_reason) {
          try {
            const parsed = JSON.parse(storeData.ban_reason);
            if (parsed.subscriptions && typeof parsed.subscriptions === 'object') {
              cloudSubs = { ...cloudSubs, ...parsed.subscriptions };
            }
          } catch {}
        }
      } catch {}
    }

    // 3. دمج ذكي: يتم دمج بيانات السحابة أولاً، ولكن أي إلغاء صريح محلياً أو سحابياً يحظى بالأولوية المطلقة
    const merged = { ...cloudSubs, ...localSubs };
    for (const [key, val] of Object.entries(localSubs)) {
      if (val && ((val as any).isActive === false || (val as any).active === false || (val as any).status === 'cancelled')) {
        merged[key] = val;
      }
    }
    for (const [key, val] of Object.entries(cloudSubs)) {
      if (val && ((val as any).isActive === false || (val as any).active === false || (val as any).status === 'cancelled')) {
        merged[key] = val;
      }
    }
    localStorage.setItem('tarqa_subscriptions', JSON.stringify(merged));
    return merged;
  } catch (err) {
    console.warn('syncSubscriptionsFromCloud error:', err);
    return localSubs;
  }
}

