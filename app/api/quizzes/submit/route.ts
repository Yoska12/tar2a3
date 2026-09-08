import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiError } from '@/server/lib/response';
import { submitQuizSchema } from '@/server/types/quiz.types';
import { QuizService } from '@/server/services/quiz.service';
import { TelegramService } from '@/server/services/telegram.service';

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من هوية الطالب
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return apiUnauthorized('يجب تسجيل الدخول لتسليم الاختبار واحتساب نتيجتك.');
    }

    // 2. التحقق من صحة مدخلات التسليم عبر Zod
    const body = await req.json().catch(() => ({}));
    const parseResult = submitQuizSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'بيانات تسليم الاختبار غير صالحة';
      return apiBadRequest(errorMsg);
    }

    // 3. تصحيح الاختبار من طرف السيرفر
    const evaluationResult = await QuizService.submitQuiz(user.id, parseResult.data);

    // 4. إرسال إشعار فوري للطالب على تليجرام في الخلفية
    try {
      TelegramService.sendQuizResultAlert(user.id, evaluationResult).catch((e) => {
        console.warn('[Telegram Alert Background] Error:', e);
      });
    } catch {}

    return apiSuccess(evaluationResult);
  } catch (err: any) {
    console.error('[POST /api/quizzes/submit] Error:', err);
    return apiError(err?.message || 'تعذر تصحيح وتسليم الاختبار');
  }
}
