/**
 * ملف إعدادات مميزات منصة طرقع وروابط المجتمع (Platform Features & Community Links)
 * يمكنك التعديل هنا مباشرة أو من خلال لوحة الإدارة في الموقع
 */

export interface PlatformFeatureConfig {
  id: string;
  title: string;
  description: string;
  badge: string;
  icon: 'GraduationCap' | 'Clock' | 'Users' | 'Zap' | 'BookOpen' | 'FileText' | 'Flame' | 'Sparkles' | 'MessageSquare';
  colorTheme: 'amber' | 'indigo' | 'sky' | 'emerald' | 'purple' | 'rose';
  bullets: string[];
  actionType: 'courses' | 'telegram-modal' | 'url' | 'coming-soon';
  actionUrl?: string; // إذا كان actionType هو url ضع الرابط هنا
  buttonText: string;
}

export interface TelegramCommunityGroupConfig {
  id: string;
  name: string;
  description: string;
  url: string; // رابط القروب أو القناة https://t.me/...
  badge: string;
  isMain?: boolean;
}

// 1. بطاقات المميزات الرئيسية المعروضة في الصفحة الرئيسية
export const PLATFORM_FEATURES_CONFIG: PlatformFeatureConfig[] = [
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
    buttonText: 'دخول المحاضرات'
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
    buttonText: 'تصفح المذكرات'
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
    buttonText: 'انضم للقروبات الآن'
  }
];

// 2. روابط قنوات ومجموعات تليجرام التفاعلية (عدل الروابط هنا بحريتك)
export const TELEGRAM_COMMUNITY_CONFIG: TelegramCommunityGroupConfig[] = [
  {
    id: 'general-group',
    name: 'قروب نقاشات القدرات والكمي (طرقع) 💬',
    description: 'المجتمع التفاعلي الأساسي لطلاب طرقع لتبادل الأسئلة واستراتيجيات الحل السريع.',
    url: 'https://t.me/tr23km', // ضع رابط القروب هنا
    badge: 'القروب العام',
    isMain: true
  },
  {
    id: 'leaks-channel',
    name: 'قناة التسريبات والتجميعات اليومية ⚡',
    description: 'نشر فوري لأحدث أسئلة وتجميعات اختبارات قياس المحوسبة والورقية مع الحلول.',
    url: 'https://t.me/tr23km', // ضع رابط القناة هنا
    badge: 'تجميعات 1446-1447'
  },
  {
    id: 'direct-support',
    name: 'الدعم الفني واستفسارات المشتركين 🛡️',
    description: 'تواصل مباشر مع مشرفي المنصة لتفعيل الاشتراكات والمساعدة الأكاديمية.',
    url: 'https://t.me/tr23km', // حساب الدعم المباشر
    badge: 'خدمة 24/7'
  }
];
