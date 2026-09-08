import { z } from 'zod';

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('يرجى إدخال بريد إلكتروني صالح'),
  password: z
    .string()
    .min(6, 'كلمة المرور يجب أن تتكون من 6 خانات على الأقل'),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .min(2, 'الاسم يجب أن يحتوي على حرفين على الأقل')
    .max(50, 'الاسم طويل جداً'),
  email: z
    .string()
    .min(1, 'البريد الإلكتروني مطلوب')
    .email('يرجى إدخال بريد إلكتروني صالح وموثوق'),
  password: z
    .string()
    .min(6, 'كلمة المرور يجب أن لا تقل عن 6 أحرف أو أرقام'),
  targetScore: z
    .number()
    .min(50, 'الدرجة المستهدفة الأدنى هي 50')
    .max(100, 'الدرجة المستهدفة القصوى هي 100'),
  telegramUsername: z
    .string()
    .optional(),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
