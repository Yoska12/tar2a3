import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiError } from '@/server/lib/response';
import { startQuizSchema } from '@/server/types/quiz.types';
import { QuizService } from '@/server/services/quiz.service';

export async function POST(req: NextRequest) {
  try {
    // 1. التحقق من توثيق وهوية المستخدم
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return apiUnauthorized('يجب تسجيل الدخول لبدء جلسة اختبار جديدة.');
    }

    // 2. التحقق من صحة المدخلات
    const body = await req.json().catch(() => ({}));
    const parseResult = startQuizSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'بيانات بدء الاختبار غير صالحة';
      return apiBadRequest(errorMsg);
    }

    // 3. بدء الجلسة وتوليد التوكن الزمني المشفر
    const sessionData = await QuizService.startQuiz(user.id, parseResult.data.quizId);

    return apiSuccess(sessionData, 201);
  } catch (err: any) {
    console.error('[POST /api/quizzes/start] Error:', err);
    return apiError(err?.message || 'تعذر بدء جلسة الاختبار');
  }
}
