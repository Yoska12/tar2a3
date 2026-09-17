import { z } from 'zod';

// قائمة بأشهر نطاقات البريد المؤقت والوهمي لمنع حسابات الاسبرام
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'yopmail.com',
  'getnada.com',
  'dispostable.com',
  'trashmail.com',
]);

// دالة تطهير النصوص من وسوم HTML و XSS
export const sanitizeInputText = (val: string): string => {
  return (val || '').replace(/<[^>]*>?/gm, '').trim();
};

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('يرجى إدخال بريد إلكتروني صالح'),
  password: z
    .string()
    .min(6, 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل')
    .max(72, 'كلمة المرور لا يمكن أن تتجاوز 72 خانة'),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .min(1, 'الاسم مطلوب')
    .min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل')
    .max(50, 'الاسم طويل جداً (الحد الأقصى 50 حرفاً)')
    .regex(/^[\p{L}\s\.\-]+$/u, 'الاسم يجب أن يحتوي على أحرف فقط بدون رموز خاصة'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .max(255, 'البريد الإلكتروني طويل جداً')
    .email('يرجى إدخال بريد إلكتروني صالح وموثوق')
    .refine(
      (email) => {
        const domain = (email || '').trim().toLowerCase().split('@')[1];
        return domain ? !DISPOSABLE_EMAIL_DOMAINS.has(domain) : true;
      },
      { message: 'لا يُسمح باستخدام خدمات البريد المؤقت أو الوهمي، يرجى استخدام بريد حقيقي' }
    ),
  password: z
    .string()
    .min(8, 'كلمة المرور يجب أن لا تقل عن 8 خانات')
    .max(72, 'كلمة المرور لا يمكن أن تتجاوز 72 خانة')
    .regex(/^(?=.*[A-Za-z\u0600-\u06FF])(?=.*\d).+$/, 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل'),
  targetScore: z
    .number()
    .int('الدرجة المستهدفة يجب أن تكون عدداً صحيحاً')
    .min(50, 'الدرجة المستهدفة الأدنى هي 50')
    .max(100, 'الدرجة المستهدفة القصوى هي 100'),
  telegramUsername: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[a-zA-Z0-9_]{3,32}$/.test(val.replace(/^@/, '').trim()),
      { message: 'معرف تليجرام يجب أن يتكون من 3-32 حرفاً أو رقماً إنجليزياً أو شرطة سفلية' }
    ),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

