import { CourseModule, CourseFileItem, InstructorInfo } from '../types';
export type { CourseFileItem, InstructorInfo };

/**
 * بيانات المدرسين المعتمدين لمسارات دورة طرقع
 */
export const AVAILABLE_INSTRUCTORS: InstructorInfo[] = [
  {
    id: 'teacher_1',
    name: 'مدرس 1',
    fullName: 'مدرس 1',
    title: 'خبير التأسيس الذهني والخرائط المعرفية',
    tagline: 'شرح تأصيلي مبسط من الصفر يربط المفاهيم بالخرائط الذهنية وقوانين قياس الأساسية.',
    avatarIcon: '👨‍🏫',
    badgeColor: 'amber',
  },
  {
    id: 'teacher_2',
    name: 'مدرس 2',
    fullName: 'مدرس 2',
    title: 'خبير التكنيك السريع واستراتيجيات الـ 100',
    tagline: 'طرق طرقع السحرية للحل الخاطف في ثانيتين بمجرد النظر واستبعاد الخيارات والأنماط الذكية.',
    avatarIcon: '⚡',
    badgeColor: 'emerald',
  },
];

/**
 * باب واحد فقط للمحاضرات اسمه "المحاضرات"
 * يبدأ فارغاً تماماً بدون أي محاضرات افتراضية أو وهمية (تضاف المحاضرات الحقيقية من لوحة الإدارة)
 */
export const mockFoundationModules: CourseModule[] = [
  {
    id: 'mod-lectures',
    title: 'المحاضرات',
    description: 'محاضرات التأسيس الشاملة للقدرات.',
    orderIndex: 1,
    icon: 'Video',
    badgeColor: 'amber',
    isPublished: true,
    status: 'active',
    customStatusText: '',
    availableDate: '',
    totalDurationMinutes: 0,
    completedLessonsCount: 0,
    lessons: [],
  },
];

/**
 * قسم ملفات الدورة والمذكرات
 * يبدأ فارغاً تماماً بدون أي ملفات افتراضية (تضاف المذكرات الحقيقية من لوحة الإدارة)
 */
export const mockCourseFiles: CourseFileItem[] = [];
