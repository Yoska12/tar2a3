/**
 * ============================================================================
 * خدمة إدارة حالة الموقع ووضع الصيانة (Site Status & Maintenance Service)
 * ============================================================================
 * مرتبطة كلياً بقاعدة البيانات والباك إند (Database & Backend First)
 * خالية تماماً من الاعتماد على كوكيز المتصفح أو التخزين المؤقت العشوائي
 *
 * القواعد الصارمة:
 * 1. السورس الحقيقي المعتمد هو قاعدة البيانات وخوادم الباك إند (/api/maintenance)
 * 2. لا يمكن لأي عميل أو زائر تغيير حالة الصيانة تلقائياً
 * 3. التفعيل والتعطيل محصور حصراً بالمالك والمدير العام (Super Admin & Admin)
 * 4. الموقع غير محجوب إلا إذا كانت isEnabled = true في قاعدة البيانات
 * 5. المشرفون يستطيعون الدخول والمتابعة حتى أثناء وضع الصيانة
 * 6. تم التخلص من تكرار طلبات الشبكة والمزامنة التلقائية التي كانت تجمد واجهة المستخدم
 */

import { isOwnerEmail } from './securityUtils';
import { supabase, isSupabaseConfigured, TarqaUser } from './supabase';

export interface MaintenanceConfig {
  isEnabled: boolean; // هل وضع الصيانة مفعّل؟
  title: string;      // عنوان رسالة الصيانة
  message: string;    // الرسالة الموجهة للطلاب والمدرسين
  estimatedReturnTime: string; // التوقيت المتوقع لعودة الموقع
  supportUrl: string; // رابط الدعم وتليجرام
  supportButtonText: string; // نص زر الدعم
  allowAdminBypass: boolean; // السماح للأدمن بتجاوز الحجب (دائماً true)
  reasonPreset?: 'routine' | 'upgrade' | 'exam' | 'courses' | 'custom';
  updatedAt: string;
}

export const DEFAULT_MAINTENANCE_CONFIG: MaintenanceConfig = {
  isEnabled: false,
  title: 'المنصة تخضع حالياً لأعمال صيانة وتطوير دوري 🛠️',
  message: 'يقوم فريق طرقع الآن بإجراء تحديثات وتحسينات شاملة على خوادم المنصة ومحاضرات التأسيس لضمان تقديم أفضل تجربة تعليمية فائقة السرعة. سنعود للعمل بكامل طاقتنا في أقرب وقت ممكن!',
  estimatedReturnTime: 'اليوم خلال ساعتين',
  supportUrl: 'https://t.me/tr23km',
  supportButtonText: 'متابعة آخر التحديثات عبر تليجرام 💬',
  allowAdminBypass: true,
  reasonPreset: 'routine',
  updatedAt: '2026-11-02T00:00:00.000Z'
};

const STORAGE_KEY_MAINTENANCE = 'tarqa_site_maintenance_v1';
const PREVIEW_MODE_KEY = 'tarqa_maintenance_preview_mode';
const ADMIN_OVERRIDE_KEY = 'tarqa_maintenance_admin_override';

// ذاكرة وصول عشوائي مؤقتة في التطبيق لتفادي القراءة المستمرة من التخزين
let inMemoryConfig: MaintenanceConfig = { ...DEFAULT_MAINTENANCE_CONFIG };
let lastFetchTimestamp = 0;
const CACHE_TTL_MS = 20000; // كاش داخلي لمدة 20 ثانية لتخفيف الضغط على الشبكة

// تهيئة أولية آمنة: مسح أي وضع محاكاة قديم أو غير مقصود
if (typeof window !== 'undefined') {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MAINTENANCE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        inMemoryConfig = { ...DEFAULT_MAINTENANCE_CONFIG, ...parsed };
      }
    }
  } catch {}
}

const isUserAdmin = (user?: { role?: string; email?: string | null } | null): boolean => {
  if (!user) return false;
  if (isOwnerEmail(user.email)) return true;
  return user.role === 'admin' || user.role === 'super_admin';
};

// نقاط النهاية المعتمدة للباك إند
const getApiEndpoint = (): string => {
  return '/api/maintenance';
};

// قناة البث الفوري بين النوافذ لنفس المتصفح
let maintenanceBroadcastChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    maintenanceBroadcastChannel = new BroadcastChannel('tarqa_maintenance_channel');
    maintenanceBroadcastChannel.onmessage = (event) => {
      if (event?.data && typeof event.data.isEnabled === 'boolean') {
        inMemoryConfig = { ...inMemoryConfig, ...event.data };
        window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: inMemoryConfig }));
      }
    };
  } catch {}
}

// قناة البث اللحظي عبر سحابة Supabase
if (isSupabaseConfigured && supabase) {
  try {
    const supabaseMaintChannel = supabase.channel('tarqa_maintenance_realtime_v2');
    supabaseMaintChannel
      .on('broadcast', { event: 'maintenance_status' }, (response: any) => {
        if (response?.payload && typeof response.payload.isEnabled === 'boolean') {
          const remoteConf: MaintenanceConfig = response.payload;
          inMemoryConfig = { ...inMemoryConfig, ...remoteConf };
          try {
            localStorage.setItem(STORAGE_KEY_MAINTENANCE, JSON.stringify(inMemoryConfig));
          } catch {}
          window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: inMemoryConfig }));
        }
      })
      .subscribe();
  } catch {}
}

export const maintenanceService = {
  /**
   * جلب إعدادات وضع الصيانة الحالية
   */
  getConfig(): MaintenanceConfig {
    return { ...inMemoryConfig };
  },

  /**
   * حفظ وتحديث إعدادات وضع الصيانة في قاعدة البيانات والباك إند
   * لا يمكن استدعاؤه إلا من قبل المشرفين المعتمدين
   */
  saveConfig(newConfig: Partial<MaintenanceConfig>, user?: { role?: string; email?: string | null } | null): MaintenanceConfig {
    // التحقق من صلاحيات المشرف إذا تم تمرير المستخدم
    if (user !== undefined && !isUserAdmin(user)) {
      console.warn('[maintenanceService] Unauthorized attempt to modify maintenance config');
      return { ...inMemoryConfig };
    }

    const updated: MaintenanceConfig = {
      ...inMemoryConfig,
      ...newConfig,
      allowAdminBypass: true,
      updatedAt: new Date().toISOString()
    };

    inMemoryConfig = updated;

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_MAINTENANCE, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: updated }));

        if (maintenanceBroadcastChannel) {
          try {
            maintenanceBroadcastChannel.postMessage(updated);
          } catch {}
        }
      }
    } catch {}

    // المزامنة الفورية مع قاعدة البيانات والباك إند
    this.syncToCloud(updated).catch(() => {});

    return updated;
  },

  /**
   * تفعيل أو إيقاف وضع الصيانة من قبل الأدمن
   */
  toggleMaintenance(forceState?: boolean, user?: { role?: string; email?: string | null } | null): MaintenanceConfig {
    if (user !== undefined && !isUserAdmin(user)) {
      console.warn('[maintenanceService] Unauthorized attempt to toggle maintenance');
      return { ...inMemoryConfig };
    }

    const current = this.getConfig();
    const targetState = typeof forceState === 'boolean' ? forceState : !current.isEnabled;

    if (targetState) {
      this.setAdminOverride(true);
    } else {
      this.setAdminOverride(false);
      this.setPreviewMode(false);
    }

    return this.saveConfig({ isEnabled: targetState }, user);
  },

  /**
   * هل وضع المحاكاة / المعاينة مفعل على شاشة المشرف الحالية؟
   * محمي: لا يمكن تفعيله إلا إذا كان المستخدم أدمن فعلياً
   */
  isPreviewModeActive(user?: { role?: string; email?: string | null } | null): boolean {
    try {
      if (typeof window !== 'undefined') {
        const isSim = sessionStorage.getItem(PREVIEW_MODE_KEY) === 'true';
        if (!isSim) return false;
        // إذا كان المستخدم طالباً أو غير أدمن، نلغي وضع المعاينة فوراً لمنع حبسه
        if (user && !isUserAdmin(user)) {
          sessionStorage.removeItem(PREVIEW_MODE_KEY);
          return false;
        }
        return true;
      }
    } catch {}
    return false;
  },

  /**
   * تفعيل أو إلغاء وضع المعاينة لشاشة المشرف
   */
  setPreviewMode(active: boolean, user?: { role?: string; email?: string | null } | null): void {
    try {
      if (typeof window !== 'undefined') {
        if (active && user && !isUserAdmin(user)) {
          return;
        }
        if (active) {
          sessionStorage.setItem(PREVIEW_MODE_KEY, 'true');
        } else {
          sessionStorage.removeItem(PREVIEW_MODE_KEY);
        }
        window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: this.getConfig() }));
      }
    } catch {}
  },

  /**
   * هل المشرف تخطى شاشة الصيانة صراحة للدخول للإشراف؟
   */
  isAdminOverrideActive(): boolean {
    try {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem(ADMIN_OVERRIDE_KEY) === 'true';
      }
    } catch {}
    return false;
  },

  /**
   * تعيين أو إلغاء تخطي المشرف لشاشة الصيانة
   */
  setAdminOverride(active: boolean): void {
    try {
      if (typeof window !== 'undefined') {
        if (active) {
          sessionStorage.setItem(ADMIN_OVERRIDE_KEY, 'true');
        } else {
          sessionStorage.removeItem(ADMIN_OVERRIDE_KEY);
        }
        window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: this.getConfig() }));
      }
    } catch {}
  },

  /**
   * فحص ما إذا كان المستخدم الحالي محجوباً بواسطة وضع الصيانة
   * المنطق الصارم والنهائي:
   * 1. وضع الصيانة معطل (!isEnabled) => غير محجوب نهائياً (false) تحت أي ظرف
   * 2. وضع المعاينة مفعل لمشرف => محجوب لتمكينه من المعاينة (true)
   * 3. وضع الصيانة مفعل (isEnabled = true):
   *    - المشرف/المالك ومعه صلاحية التجاوز => غير محجوب (false)
   *    - المشرف/المالك بدون تجاوز => يرى شاشة الصيانة مع شريط التحكم الإداري (true)
   *    - الطلاب والمعلمون والزوار => محجوبون تماماً (true)
   */
  isBlocked(user?: { role?: string; email?: string | null } | null): boolean {
    const config = this.getConfig();

    // إذا كان وضع المعاينة مفعلاً صراحة لمشرف معتمد
    if (this.isPreviewModeActive(user)) {
      return true;
    }

    // القاعدة الأساسية: إذا كان وضع الصيانة غير مفعّل، فلا يوجد حجب لأي شخص
    if (!config.isEnabled) {
      return false;
    }

    // إذا كان المستخدم أدمن أو مالكاً وقام بتخطي الحجب للإشراف
    const isAdmin = isUserAdmin(user);
    if (isAdmin && this.isAdminOverrideActive()) {
      return false;
    }

    // الموقع محجوب
    return true;
  },

  /**
   * رفع ومزامنة إعدادات وضع الصيانة إلى قاعدة البيانات والباك إند فوراً
   */
  async syncToCloud(config?: MaintenanceConfig): Promise<boolean> {
    const targetConfig = config || this.getConfig();
    let success = false;

    // 1. التحديث المباشر في جدول platform_settings بقاعدة بيانات Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase
          .from('platform_settings')
          .upsert({
            key: 'maintenance',
            value: targetConfig,
            updated_at: targetConfig.updatedAt
          });
        if (!error) {
          success = true;
        }
      } catch (dbErr) {
        console.warn('[maintenanceService] Supabase direct upsert note:', dbErr);
      }
    }

    // 2. التحديث عبر نقطة نهاية الباك إند
    const endpoint = getApiEndpoint();
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetConfig)
      });
      if (res.ok) {
        success = true;
      }
    } catch {}

    // 3. محاولة ثانوية عبر PHP في حالة استضافة Hostinger
    try {
      await fetch('/api/maintenance.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targetConfig)
      });
    } catch {}

    return success;
  },

  /**
   * جلب أحدث حالة وضع صيانة من قاعدة البيانات والباك إند
   * مصدر الحقيقة هو الخادم وقاعدة البيانات، مع كاش خفيف لتجنب التجميد
   */
  async syncFromCloud(force = false): Promise<MaintenanceConfig | null> {
    const now = Date.now();
    if (!force && now - lastFetchTimestamp < CACHE_TTL_MS) {
      return inMemoryConfig;
    }
    lastFetchTimestamp = now;

    let remoteConfig: MaintenanceConfig | null = null;

    // 1. محاولة مباشرة وسريعة من جدول platform_settings في Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('value, updated_at')
          .eq('key', 'maintenance')
          .maybeSingle();

        if (!error && data?.value && typeof data.value.isEnabled === 'boolean') {
          remoteConfig = {
            ...DEFAULT_MAINTENANCE_CONFIG,
            ...data.value,
            updatedAt: data.value.updatedAt || data.updated_at || new Date().toISOString()
          };
        }
      } catch {}
    }

    // 2. إذا لم يتوفر من سوبابيز، نجلب من نقطة الباك إند
    if (!remoteConfig) {
      const endpoints = ['/api/maintenance', '/api/maintenance.php'];
      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            cache: 'no-store',
            headers: { 'Cache-Control': 'no-cache' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && typeof data.isEnabled === 'boolean') {
              remoteConfig = {
                ...DEFAULT_MAINTENANCE_CONFIG,
                ...data
              };
              break;
            }
          }
        } catch {}
      }
    }

    if (remoteConfig) {
      const isChanged = inMemoryConfig.isEnabled !== remoteConfig.isEnabled ||
                        inMemoryConfig.title !== remoteConfig.title ||
                        inMemoryConfig.message !== remoteConfig.message ||
                        inMemoryConfig.estimatedReturnTime !== remoteConfig.estimatedReturnTime ||
                        inMemoryConfig.updatedAt !== remoteConfig.updatedAt;

      inMemoryConfig = { ...remoteConfig };

      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY_MAINTENANCE, JSON.stringify(remoteConfig));
          if (isChanged) {
            window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: remoteConfig }));
          }
        }
      } catch {}

      return remoteConfig;
    }

    return inMemoryConfig;
  },

  /**
   * استعادة الإعدادات الافتراضية وحفظها في قاعدة البيانات
   */
  resetToDefault(user?: { role?: string; email?: string | null } | null): MaintenanceConfig {
    if (user !== undefined && !isUserAdmin(user)) {
      return { ...inMemoryConfig };
    }
    const def = { ...DEFAULT_MAINTENANCE_CONFIG, updatedAt: new Date().toISOString() };
    inMemoryConfig = def;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_MAINTENANCE, JSON.stringify(def));
        sessionStorage.removeItem(PREVIEW_MODE_KEY);
        sessionStorage.removeItem(ADMIN_OVERRIDE_KEY);
        window.dispatchEvent(new CustomEvent('tarqa_maintenance_changed', { detail: def }));
      }
    } catch {}
    this.syncToCloud(def).catch(() => {});
    return def;
  }
};
