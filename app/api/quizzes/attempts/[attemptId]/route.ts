import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiForbidden, apiNotFound, apiError } from '@/server/lib/response';
import { QuizService } from '@/server/services/quiz.service';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attemptId: string }> | { attemptId: string } }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return apiUnauthorized('يجب تسجيل الدخول لعرض تفاصيل المحاولة.');
    }

    const params = await Promise.resolve(context.params);
    const attemptId = params?.attemptId;

    if (!attemptId) {
      return apiBadRequest('معرف المحاولة مطلوب');
    }

    const attempt = await QuizService.getAttemptDetails(attemptId, user.id);
    if (!attempt) {
      return apiNotFound('المحاولة المطلوبة غير موجودة');
    }

    return apiSuccess(attempt);
  } catch (err: any) {
    if (err.message === 'FORBIDDEN') {
      return apiForbidden('غير مصرح لك بالاطلاع على نتيجة طالب آخر.');
    }
    console.error('[GET /api/quizzes/attempts/[attemptId]] Error:', err);
    return apiError(err?.message || 'تعذر جلب تفاصيل المحاولة');
  }
}
