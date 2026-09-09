import { apiSuccess, apiBadRequest, apiError } from '@/server/lib/response';
import { QuizService } from '@/server/services/quiz.service';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const quizId = params?.id;

    if (!quizId) {
      return apiBadRequest('معرف الاختبار مطلوب في مسار الرابط');
    }

    // جلب الأسئلة خالية تماماً من الإجابات والشروحات
    const sanitizedQuestions = await QuizService.getSanitizedQuestions(quizId);

    return apiSuccess({
      quizId,
      total: sanitizedQuestions.length,
      questions: sanitizedQuestions,
    });
  } catch (err: any) {
    console.error('[GET /api/quizzes/[id]/questions] Error:', err);
    return apiError(err?.message || 'تعذر جلب أسئلة الاختبار');
  }
}
