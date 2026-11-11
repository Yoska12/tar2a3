/**
 * ============================================================================
 * إدارة وتخزين مميزات المنصة وروابط المجتمع التفاعلي (Platform Features Storage)
 * ============================================================================
 * تتيح للإدارة والمشرفين التحكم المطلق في:
 * 1. بطاقات المميزات (العناوين، الأوصاف، الشارات، الأيقونات، الألوان، والنقاط)
 * 2. طبيعة الإجراء والروابط (انتقال لمحاضرات، محاكي، تليجرام، رابط خارجي، تبويب داخلي، قريباً)
 * 3. ترتيب البطاقات وإخفائها أو إظهارها بحرية تامة
 * 4. روابط قنوات ومجموعات تليجرام التفاعلية بالكامل
 */
import { supabase, isSupabaseConfigured } from './supabase';
import { CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL } from './subscriptionService';

export type FeatureActionType =
  | 'courses'        // الانتقال لصفحة المحاضرات والدورات
  | 'coming-soon'    // مغلق مؤقتاً للتطوير / قريباً مع رسالة مخصصة
  | 'telegram-modal' // فتح نافذة مجتمع تليجرام
  | 'tab'            // انتقال لتبويب داخلي (dashboard, leaderboard, roadmap, categories)
  | 'url';           // رابط مخصص (URL)

export type FeatureColorTheme =
  | 'amber'
  | 'indigo'
  | 'sky'
  | 'emerald'
  | 'purple'
  | 'rose';

export type FeatureStatus = 'active' | 'paused' | 'coming-soon';

export interface PlatformFeatureItem {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon: string;
  colorTheme: FeatureColorTheme;
  bullets: string[];
  actionType: FeatureActionType;
  actionUrl?: string; // رابط مخصص عند اختيار url أو تليجرام مباشر
  targetTab?: string; // التبويب الداخلي عند اختيار tab
  buttonText: string;
  comingSoonNotice?: string; // نص التنبيه المخصص عند الضغط
  openInNewTab?: boolean; // هل يفتح في نافذة جديدة
  isVisible: boolean;
  order: number;
  status?: FeatureStatus; // 'active' (مفعلة) | 'paused' (مغلقة مؤقتاً) | 'coming-soon' (قريباً)
  statusNotice?: string; // رسالة التنبيه عند الضغط إذا كانت مغلقة أو قريباً
}

export interface TelegramCommunityGroup {
  id: string;
  name: string;
  description: string;
  url: string;
  badge: string;
  isMain?: boolean;
}

export const DEFAULT_FEATURES: PlatformFeatureItem[] = [
  {
    id: 'feature-lectures',
    title: 'محاضرات تدريب وتأسيس',
    description: 'شروحات فيديو تأسيسية متدرجة من الصفر تغطي كافة أبواب القدرات الكمي (الحساب، الجبر، الهندسة، الإحصاء والمقارنات) باستراتيجيات الحل في أقل من دقيقة.',
    badge: 'متاح بالكامل 🎓',
    icon: 'GraduationCap',
    colorTheme: 'amber',
    bullets: [
      'تأسيس ذكي من الأساسيات حتى أصعب الأفكار',
      'شروحات حيل "طرقع" السريعة بدون تعقيد',
      'مذكرات وملخصات وقوانين PDF جاهزة للتحميل'
    ],
    actionType: 'courses',
    buttonText: 'دخول المحاضرات',
    status: 'active',
    isVisible: true,
    order: 1
  },
  {
    id: 'feature-materials',
    title: 'مذكرات وملخصات تأسيس PDF',
    description: 'مذكرات تدريبية متخصصة وملخصات قوانين مركزة وخرائط ذهنية قابلة للتحميل، تدعم المذاكرة السريعة وتثبيت الأفكار الهامة.',
    badge: 'متاح للتحميل 📄',
    icon: 'FileText',
    colorTheme: 'purple',
    bullets: [
      'مذكرات شاملة لكل باب وفصل تدريبي',
      'ملخصات حيل وقوانين الحل الخاطف الذهني',
      'تحميل سريع ومباشر بجودة طباعة فائقة'
    ],
    actionType: 'courses',
    status: 'active',
    buttonText: 'تصفح المذكرات',
    isVisible: true,
    order: 2
  },
  {
    id: 'feature-telegram',
    title: 'مجتمع تفاعلي على تليجرام',
    description: 'قروبات وقنوات تليجرام تفاعلية تجمع الطلاب لمناقشة تسريبات وتجميعات الاختبارات اليومية، وتبادل الحلول الذكية مع نخبة المدربين والمشرفين.',
    badge: 'مجتمع نشط 💬',
    icon: 'Users',
    colorTheme: 'sky',
    bullets: [
      'قروبات نقاش يومية ومسائل تسريبات حصرية',
      'حلول فورية ومساعدة للأسئلة المستعصية',
      'تحديات تنافسية ومتابعة مستمرة بين الطلاب'
    ],
    actionType: 'telegram-modal',
    actionUrl: 'https://t.me/tr23km',
    buttonText: 'انضم للقروبات الآن',
    status: 'active',
    isVisible: true,
    order: 3
  }
];

export const DEFAULT_TELEGRAM_GROUPS: TelegramCommunityGroup[] = [
  {
    id: 'general-group',
    name: 'قروب نقاشات القدرات والكمي (طرقع) 💬',
    description: 'المجتمع التفاعلي الأساسي لطلاب طرقع لتبادل الأسئلة واستراتيجيات الحل السريع.',
    url: 'https://t.me/tr23km',
    badge: 'القروب العام',
    isMain: true
  },
  {
    id: 'leaks-channel',
    name: 'قناة التسريبات والتجميعات اليومية ⚡',
    description: 'نشر فوري لأحدث أسئلة وتجميعات اختبارات قياس المحوسبة والورقية مع الحلول.',
    url: 'https://t.me/tr23km',
    badge: 'تجميعات 1446-1447'
  },
  {
    id: 'direct-support',
    name: 'الدعم الفني واستفسارات المشتركين 🛡️',
    description: 'تواصل مباشر مع مشرفي المنصة لتفعيل الاشتراكات والمساعدة الأكاديمية.',
    url: 'https://t.me/tr23km',
    badge: 'خدمة 24/7'
  }
];

const STORAGE_KEY_FEATURES = 'tarqa_platform_features_custom_v1';
const STORAGE_KEY_GROUPS = 'tarqa_telegram_groups_custom_v1';

export const featuresStorage = {
  // جلب مميزات المنصة
  getFeatures(): PlatformFeatureItem[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_FEATURES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.sort((a, b) => a.order - b.order);
          }
        }
      }
    } catch (e) {
      console.warn('[featuresStorage] Error reading features:', e);
    }
    return [...DEFAULT_FEATURES];
  },

  // حفظ مميزات المنصة
  saveFeatures(features: PlatformFeatureItem[]): void {
    try {
      if (typeof window !== 'undefined') {
        const sorted = [...features].map((item, idx) => ({ ...item, order: idx + 1 }));
        localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(sorted));
        window.dispatchEvent(new CustomEvent('tarqa_features_changed', { detail: sorted }));
      }
    } catch (e) {
      console.warn('[featuresStorage] Error saving features:', e);
    }
    this.syncToCloud(features).catch(() => {});
  },

  // إضافة أو تحديث ميزة
  saveFeature(feature: PlatformFeatureItem): PlatformFeatureItem[] {
    const current = this.getFeatures();
    const index = current.findIndex(f => f.id === feature.id);
    let updated: PlatformFeatureItem[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = feature;
    } else {
      updated = [...current, { ...feature, order: current.length + 1 }];
    }
    this.saveFeatures(updated);
    return updated;
  },

  // تحريك ميزة لأعلى أو لأسفل في الترتيب
  moveFeature(featureId: string, direction: 'up' | 'down'): PlatformFeatureItem[] {
    const list = this.getFeatures();
    const idx = list.findIndex(f => f.id === featureId);
    if (idx === -1) return list;

    if (direction === 'up' && idx > 0) {
      const temp = list[idx];
      list[idx] = list[idx - 1];
      list[idx - 1] = temp;
    } else if (direction === 'down' && idx < list.length - 1) {
      const temp = list[idx];
      list[idx] = list[idx + 1];
      list[idx + 1] = temp;
    }

    this.saveFeatures(list);
    return list;
  },

  // استنساخ ميزة لتسهيل الإضافة
  duplicateFeature(featureId: string): PlatformFeatureItem[] {
    const current = this.getFeatures();
    const target = current.find(f => f.id === featureId);
    if (!target) return current;

    const cloned: PlatformFeatureItem = {
      ...target,
      id: `feature-${Date.now()}`,
      title: `${target.title} (نسخة)`,
      order: current.length + 1
    };

    return this.saveFeature(cloned);
  },

  // حذف ميزة
  deleteFeature(featureId: string): PlatformFeatureItem[] {
    const current = this.getFeatures();
    const updated = current.filter(f => f.id !== featureId);
    this.saveFeatures(updated);
    return updated;
  },

  // جلب مجموعات تليجرام
  getTelegramGroups(): TelegramCommunityGroup[] {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY_GROUPS);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[featuresStorage] Error reading telegram groups:', e);
    }
    return [...DEFAULT_TELEGRAM_GROUPS];
  },

  // حفظ مجموعات تليجرام
  saveTelegramGroups(groups: TelegramCommunityGroup[]): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
        window.dispatchEvent(new CustomEvent('tarqa_telegram_groups_changed', { detail: groups }));
      }
    } catch (e) {
      console.warn('[featuresStorage] Error saving telegram groups:', e);
    }
    this.syncToCloud(undefined, groups).catch(() => {});
  },

  // إضافة أو تحديث مجموعة تليجرام
  saveTelegramGroup(group: TelegramCommunityGroup): TelegramCommunityGroup[] {
    const current = this.getTelegramGroups();
    const index = current.findIndex(g => g.id === group.id);
    let updated: TelegramCommunityGroup[];
    if (index >= 0) {
      updated = [...current];
      updated[index] = group;
    } else {
      updated = [...current, group];
    }
    this.saveTelegramGroups(updated);
    return updated;
  },

  // حذف مجموعة تليجرام
  deleteTelegramGroup(groupId: string): TelegramCommunityGroup[] {
    const current = this.getTelegramGroups();
    const updated = current.filter(g => g.id !== groupId);
    this.saveTelegramGroups(updated);
    return updated;
  },

  // استعادة الإعدادات الافتراضية
  resetToDefault(): void {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_FEATURES);
        localStorage.removeItem(STORAGE_KEY_GROUPS);
        window.dispatchEvent(new CustomEvent('tarqa_features_changed', { detail: DEFAULT_FEATURES }));
        window.dispatchEvent(new CustomEvent('tarqa_telegram_groups_changed', { detail: DEFAULT_TELEGRAM_GROUPS }));
      }
    } catch (e) {
      console.warn('[featuresStorage] Error resetting features:', e);
    }
    this.syncToCloud(DEFAULT_FEATURES, DEFAULT_TELEGRAM_GROUPS).catch(() => {});
  },

  // مزامنة المميزات والمجموعات إلى السحابة المركزية (Supabase Cloud Store)
  async syncToCloud(features?: PlatformFeatureItem[], groups?: TelegramCommunityGroup[]): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const targetFeatures = features || this.getFeatures();
      const targetGroups = groups || this.getTelegramGroups();

      let existingPayload: any = {};
      const { data: storeData } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      if (storeData?.ban_reason) {
        try {
          existingPayload = JSON.parse(storeData.ban_reason);
        } catch {}
      }

      const mergedPayload = JSON.stringify({
        ...existingPayload,
        platformFeatures: targetFeatures,
        telegramGroups: targetGroups,
        featuresUpdatedAt: new Date().toISOString()
      });

      const { error } = await supabase
        .from('profiles')
        .update({
          ban_reason: mergedPayload,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', CLOUD_LECTURES_STORE_ID);

      if (error) {
        await supabase
          .from('profiles')
          .update({
            ban_reason: mergedPayload,
            updated_at: new Date().toISOString()
          } as any)
          .eq('email', CLOUD_LECTURES_STORE_EMAIL);
      }
      return true;
    } catch (e) {
      console.warn('[featuresStorage] syncToCloud exception:', e);
      return false;
    }
  },

  // جلب المميزات والمجموعات من السحابة المركزية لجميع الزوار
  async syncFromCloud(): Promise<{ features: PlatformFeatureItem[]; groups: TelegramCommunityGroup[] } | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      if (!error && data?.ban_reason) {
        try {
          const parsed = JSON.parse(data.ban_reason);
          let loaded = false;
          if (parsed && Array.isArray(parsed.platformFeatures) && parsed.platformFeatures.length > 0) {
            localStorage.setItem(STORAGE_KEY_FEATURES, JSON.stringify(parsed.platformFeatures));
            window.dispatchEvent(new CustomEvent('tarqa_features_changed', { detail: parsed.platformFeatures }));
            loaded = true;
          }
          if (parsed && Array.isArray(parsed.telegramGroups) && parsed.telegramGroups.length > 0) {
            localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(parsed.telegramGroups));
            window.dispatchEvent(new CustomEvent('tarqa_telegram_groups_changed', { detail: parsed.telegramGroups }));
            loaded = true;
          }
          if (loaded) {
            return {
              features: this.getFeatures(),
              groups: this.getTelegramGroups()
            };
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[featuresStorage] syncFromCloud exception:', e);
    }
    return null;
  }
};
