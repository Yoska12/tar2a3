import { NextRequest } from 'next/server';
import { apiSuccess, apiBadRequest, apiError } from '@/server/lib/response';
import { randomQuestionsQuerySchema } from '@/server/types/quiz.types';
import { QuestionService } from '@/server/services/question.service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawParams = {
      categoryId: searchParams.get('categoryId') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      limit: searchParams.get('limit') || 10,
      mode: searchParams.get('mode') || 'mock',
    };

    const parseResult = randomQuestionsQuerySchema.safeParse(rawParams);
    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues[0]?.message || 'معاملات البحث غير صالحة';
      return apiBadRequest(errorMsg);
    }

    const questions = await QuestionService.getRandomQuestions(parseResult.data);

    return apiSuccess({
      total: questions.length,
      questions,
    });
  } catch (err: any) {
    console.error('[GET /api/questions/random] Error:', err);
    return apiError(err?.message || 'تعذر جلب الأسئلة');
  }
}
