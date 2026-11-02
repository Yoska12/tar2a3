/**
 * ثوابت وإعدادات التواصل والدعم الفني الرسمية لمنصة طرقع
 */
export const SUPPORT_EMAIL = 'tarqa3k@gmail.com';
export const SUPPORT_PHONE_EGYPT = '+201104687320';
export const SUPPORT_PHONE_EGYPT_FORMATTED = '01104687320';
export const SUPPORT_WHATSAPP_URL = 'https://wa.me/201104687320';

// حساب الدعم الفني المباشر على تليجرام (حساب خدمة عملاء شخصي ومباشر وليس بوتاً)
export const SUPPORT_TELEGRAM_ACCOUNT = 'tr23km';
export const SUPPORT_TELEGRAM_BOT = 'tr23km'; // للتوافق العكسي مع الملفات الحالية
export const SUPPORT_TELEGRAM_URL = 'https://t.me/tr23km';


export interface TelegramCommunityGroup {
  id: string;
  name: string;
  description: string;
  url: string;
  badge: string;
  isMain?: boolean;
}

// مجموعات وقنوات مجتمع طرقع التفاعلي على تليجرام
export const TELEGRAM_COMMUNITY_GROUPS: TelegramCommunityGroup[] = [
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

