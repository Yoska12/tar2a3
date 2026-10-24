import { Category, Question } from '../types';

export const mockCategories: Category[] = [
  {
    id: 'all',
    title: 'جميع الأقسام (محاكي قياس)',
    slug: 'all',
    description: 'اختبار تجريبي متكامل يجمع كل موضوعات القسم الكمي بنفس توزيع قياس',
    icon: 'Layers',
    badgeColor: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    questionsCount: 0,
  },
  {
    id: 'geometry',
    title: 'الهندسة والقياس',
    slug: 'geometry',
    description: 'المثلثات، الدوائر، المربعات والمستطيلات، الزوايا والمساحات المظللة',
    icon: 'Shapes',
    badgeColor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    questionsCount: 0,
  },
  {
    id: 'algebra',
    title: 'الجبر والمعادلات',
    slug: 'algebra',
    description: 'الأسس، الجذور، المتطابقات، المتتابعات، وحل المعادلات من الدرجة الأولى والثانية',
    icon: 'Variable',
    badgeColor: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    questionsCount: 0,
  },
  {
    id: 'arithmetic',
    title: 'الحساب والأعداد',
    slug: 'arithmetic',
    description: 'النسب المئوية، التدرج المنتظم، الكسور، قابلية القسمة، والعمليات الذهنية',
    icon: 'Calculator',
    badgeColor: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    questionsCount: 0,
  },
  {
    id: 'comparisons',
    title: 'المقارنات',
    slug: 'comparisons',
    description: 'المقارنة بين قيمتين (الأولى أكبر، الثانية أكبر، متساويتان، المعطيات غير كافية)',
    icon: 'Scale',
    badgeColor: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    questionsCount: 0,
  },
  {
    id: 'statistics',
    title: 'الإحصاء والاحتمالات',
    slug: 'statistics',
    description: 'المتوسط الحسابي، الوسيط، المنوال، الرسوم البيانية، ومبدأ العد',
    icon: 'BarChart3',
    badgeColor: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    questionsCount: 0,
  },
  {
    id: 'word-problems',
    title: 'المسائل اللفظية',
    slug: 'word-problems',
    description: 'مسائل السرعة والمسافة والزمن، الأعمار، والعمل المشترك والصنابير',
    icon: 'Clock',
    badgeColor: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    questionsCount: 0,
  },
];

/**
 * بنك الأسئلة (يبدأ فارغاً ويستقبل الأسئلة الحقيقية المعتمدة فقط من السحابة أو لوحة الإدارة)
 */
export const mockQuestions: Question[] = [];
