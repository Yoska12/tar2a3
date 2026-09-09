import { apiSuccess, apiBadRequest, apiError } from '@/server/lib/response';
import { verifyQuestionSchema } from '@/server/types/quiz.types';
import { QuestionService } from '@/server/services/question.service';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const questionId = params?.id;

    if (!questionId) {
      return apiBadRequest('معرف السؤال مطلوب');
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = verifyQuestionSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'الخيار المحدد غير صالح (اختر A, B, C, D)';
      return apiBadRequest(errorMsg);
    }

    const verification = await QuestionService.verifyQuestion(
      questionId,
      parseResult.data.selectedOption
    );

    return apiSuccess(verification);
  } catch (err: any) {
    console.error('[POST /api/questions/[id]/verify] Error:', err);
    return apiError(err?.message || 'تعذر التحقق من إجابة السؤال');
  }
}
