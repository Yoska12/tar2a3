import { NextRequest } from 'next/server';
import { getAuthenticatedUser } from '@/server/lib/auth';
import { apiSuccess, apiBadRequest, apiUnauthorized, apiError } from '@/server/lib/response';
import { bookmarkQuestionSchema } from '@/server/types/quiz.types';
import { QuestionService } from '@/server/services/question.service';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) {
      return apiUnauthorized('يجب تسجيل الدخول لحفظ السؤال في المفضلة.');
    }

    const params = await Promise.resolve(context.params);
    const questionId = params?.id;

    if (!questionId) {
      return apiBadRequest('معرف السؤال مطلوب');
    }

    const body = await req.json().catch(() => ({}));
    const parseResult = bookmarkQuestionSchema.safeParse(body);
    const shouldBookmark = parseResult.success ? parseResult.data.bookmark : true;

    const result = await QuestionService.bookmarkQuestion(user.id, questionId, shouldBookmark);

    return apiSuccess(result);
  } catch (err: any) {
    console.error('[POST /api/questions/[id]/bookmark] Error:', err);
    return apiError(err?.message || 'تعذر تحديث حفظ السؤال');
  }
}
