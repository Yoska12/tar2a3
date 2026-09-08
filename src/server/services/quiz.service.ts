import crypto from 'crypto';
import { getSupabaseAdminClient } from '../lib/db';
import { createQuizSessionToken, verifyQuizSessionToken } from '../lib/token';
import { 
  SanitizedQuestion, 
  FullQuestion, 
  QuizSubmissionResult, 
  SubmitQuizInput, 
  CategoryBreakdown, 
  EvaluatedAnswer 
} from '../types/quiz.types';
import { mockQuestions, mockCategories } from '../../data/mockQuestions';

export class QuizService {
  /**
   * 1. بدء جلسة اختبار جديدة وتوليد توكن زمني مشفر لمنع التلاعب بمؤقت المتصفح
   */
  static async startQuiz(userId: string, quizId: string): Promise<{
    sessionToken: string;
    quizId: string;
    durationMinutes: number;
    totalQuestions: number;
    startedAt: number;
  }> {
    const supabase = getSupabaseAdminClient();

    // جلب تفاصيل الاختبار من Supabase
    let durationMinutes = 20;
    let questionIds: string[] = [];

    try {
      const { data: quizData } = await supabase
        .from('quizzes')
        .select('id, duration_minutes')
        .eq('id', quizId)
        .maybeSingle();

      if (quizData) {
        durationMinutes = quizData.duration_minutes || 20;

        // جلب معرفات الأسئلة المرتبطة بالاختبار
        const { data: qData } = await supabase
          .from('quiz_questions')
          .select('question_id')
          .eq('quiz_id', quizId)
          .order('order_index', { ascending: true });

        if (qData && qData.length > 0) {
          questionIds = qData.map((item) => item.question_id);
        }
      }
    } catch (e) {
      console.warn('[QuizService] Falling back to local data:', e);
    }

    // إذا لم تكن البيانات في قاعدة البيانات بعد، نستخدم بنك الأسئلة المدمج
    if (questionIds.length === 0) {
      questionIds = mockQuestions.slice(0, 10).map((q) => q.id);
      durationMinutes = 15;
    }

    const startedAt = Date.now();
    const maxDurationSeconds = durationMinutes * 60;
    const attemptId = 'att_' + crypto.randomUUID();

    // توليد توكن الجلسة المشفر بـ HMAC-SHA256
    const sessionToken = createQuizSessionToken({
      attemptId,
      userId,
      quizId,
      startedAt,
      maxDurationSeconds,
      questionIds,
    });

    return {
      sessionToken,
      quizId,
      durationMinutes,
      totalQuestions: questionIds.length,
      startedAt,
    };
  }

  /**
   * 2. جلب أسئلة الاختبار مع الحذف التام للإجابات الصحيحة والشروحات (منع تسريب الإجابات)
   */
  static async getSanitizedQuestions(quizId: string): Promise<SanitizedQuestion[]> {
    const supabase = getSupabaseAdminClient();

    try {
      // استعلام Supabase مع استبعاد صريح للأعمدة الحساسة
      const { data: dbQuestions, error } = await supabase
        .from('quiz_questions')
        .select(`
          question:questions (
            id,
            category_id,
            topic_id,
            question_text,
            question_image_url,
            svg_diagram,
            options,
            difficulty,
            source
          )
        `)
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (!error && dbQuestions && dbQuestions.length > 0) {
        return dbQuestions.map((row: any) => {
          const q = row.question;
          return {
            id: q.id,
            categoryId: q.category_id,
            topicId: q.topic_id,
            questionText: q.question_text,
            questionImageUrl: q.question_image_url,
            svgDiagram: q.svg_diagram,
            options: q.options,
            difficulty: q.difficulty,
            source: q.source,
          };
        });
      }
    } catch (e) {
      console.warn('[QuizService] Failed to load from DB, using sanitized mock questions:', e);
    }

    // الحماية المزدوجة: فلترة الأسئلة المحلية وحذف الإجابة والشرح
    return mockQuestions.map((q) => ({
      id: q.id,
      categoryId: q.categoryId,
      topicId: q.topicId,
      questionText: q.questionText,
      questionImageUrl: q.questionImageUrl,
      svgDiagram: q.svgDiagram,
      options: q.options,
      difficulty: q.difficulty,
      source: q.source,
    }));
  }

  /**
   * 3. تصحيح الاختبار من طرف السيرفر (Server-Side Evaluation)
   * التحقق من التوقيت ومنع التلاعب، مطابقة الإجابات، حساب الدرجة، وحفظ المحاولة في قاعدة البيانات
   */
  static async submitQuiz(
    userId: string,
    input: SubmitQuizInput
  ): Promise<QuizSubmissionResult> {
    // 1. التحقق من توكن الجلسة وصلاحيته
    const session = verifyQuizSessionToken(input.sessionToken);
    if (!session) {
      throw new Error('رمز جلسة الاختبار غير صالح أو تم التلاعب به.');
    }

    if (session.userId !== userId) {
      throw new Error('لا يمكنك تسليم اختبار باسم مستخدم آخر.');
    }

    // 2. التحقق من التوقيت الفعلي من السيرفر (السماح بفارق 60 ثانية إضافية لتأخير الشبكة)
    const elapsedSeconds = Math.round((Date.now() - session.startedAt) / 1000);
    const maxAllowedSeconds = session.maxDurationSeconds + 60;

    if (elapsedSeconds > maxAllowedSeconds) {
      console.warn(`[QuizService] Quiz submitted late: ${elapsedSeconds}s > ${maxAllowedSeconds}s`);
      // لا نلغي الاختبار تماماً بل نسجله مع تنبيه تجاوز الوقت
    }

    // 3. جلب الأسئلة الأصلية مع الإجابات الصحيحة من قاعدة البيانات
    const questionMap = new Map<string, FullQuestion>();
    const supabase = getSupabaseAdminClient();

    try {
      const { data: dbQuestions } = await supabase
        .from('questions')
        .select('*')
        .in('id', session.questionIds);

      if (dbQuestions && dbQuestions.length > 0) {
        dbQuestions.forEach((q: any) => {
          questionMap.set(q.id, {
            id: q.id,
            categoryId: q.category_id,
            topicId: q.topic_id,
            questionText: q.question_text,
            questionImageUrl: q.question_image_url,
            svgDiagram: q.svg_diagram,
            options: q.options,
            correctOption: q.correct_option,
            explanation: q.explanation,
            difficulty: q.difficulty,
          });
        });
      }
    } catch (e) {
      console.warn('[QuizService] Loading questions from DB failed, using local bank:', e);
    }

    // مواءمة الأسئلة من القائمة المحلية إن لم تكن في DB
    mockQuestions.forEach((q) => {
      if (!questionMap.has(q.id)) {
        questionMap.set(q.id, {
          id: q.id,
          categoryId: q.categoryId,
          topicId: q.topicId,
          questionText: q.questionText,
          questionImageUrl: q.questionImageUrl,
          svgDiagram: q.svgDiagram,
          options: q.options,
          correctOption: q.correctOption,
          explanation: q.explanation,
          difficulty: q.difficulty,
        });
      }
    });

    // 4. مطابقة وتصحيح إجابات الطالب
    let correctCount = 0;
    const categoryStats: Record<string, { total: number; correct: number }> = {};
    const detailedAnswers: EvaluatedAnswer[] = [];

    for (const ans of input.answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      const isCorrect = ans.selectedOption === q.correctOption;
      if (isCorrect) correctCount++;

      if (!categoryStats[q.categoryId]) {
        categoryStats[q.categoryId] = { total: 0, correct: 0 };
      }
      categoryStats[q.categoryId].total++;
      if (isCorrect) categoryStats[q.categoryId].correct++;

      detailedAnswers.push({
        questionId: q.id,
        questionText: q.questionText,
        selectedOption: ans.selectedOption,
        correctOption: q.correctOption,
        isCorrect,
        timeSpentSeconds: ans.timeSpentSeconds || 0,
        explanation: q.explanation,
        categoryId: q.categoryId,
        topicId: q.topicId,
      });
    }

    const totalQuestions = input.answers.length;
    const wrongCount = totalQuestions - correctCount;
    const scorePercentage = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(2)) : 0;

    // بناء تفاصيل كل قسم
    const categoryBreakdown: CategoryBreakdown[] = Object.entries(categoryStats).map(([catId, stats]) => {
      const catObj = mockCategories.find((c) => c.id === catId || c.slug === catId);
      return {
        categoryId: catId,
        categoryTitle: catObj?.title || catId,
        totalQuestions: stats.total,
        correctCount: stats.correct,
        accuracyPercentage: stats.total > 0 ? Number(((stats.correct / stats.total) * 100).toFixed(1)) : 0,
      };
    });

    const completedAt = new Date().toISOString();

    const result: QuizSubmissionResult = {
      attemptId: session.attemptId,
      quizId: session.quizId,
      score: scorePercentage,
      targetScore: 100, // هدفنا 100 🎯
      totalQuestions,
      correctCount,
      wrongCount,
      timeSpentSeconds: elapsedSeconds,
      averageTimePerQuestion: totalQuestions > 0 ? Math.round(elapsedSeconds / totalQuestions) : 0,
      categoryBreakdown,
      detailedAnswers,
      completedAt,
    };

    // 5. حفظ السجل داخل جدول user_quiz_attempts
    try {
      await supabase.from('user_quiz_attempts').insert({
        id: session.attemptId.startsWith('att_') ? crypto.randomUUID() : session.attemptId,
        user_id: userId,
        quiz_id: session.quizId.length === 36 ? session.quizId : null,
        score: scorePercentage,
        total_questions: totalQuestions,
        correct_count: correctCount,
        wrong_count: wrongCount,
        time_spent_seconds: elapsedSeconds,
        answers: detailedAnswers,
        completed_at: completedAt,
      });
    } catch (saveError) {
      console.warn('[QuizService] Failed to persist attempt to Supabase:', saveError);
    }

    return result;
  }

  /**
   * 4. جلب تقرير النتيجة التفصيلي مع التحقق الصارم من ملكية المحاولة
   */
  static async getAttemptDetails(attemptId: string, userId: string): Promise<any | null> {
    const supabase = getSupabaseAdminClient();

    try {
      const { data: attempt, error } = await supabase
        .from('user_quiz_attempts')
        .select('*')
        .eq('id', attemptId)
        .maybeSingle();

      if (error || !attempt) {
        return null;
      }

      // حماية صارمة: منع أي مستخدم من قراءة نتائج غيره
      if (attempt.user_id !== userId) {
        throw new Error('FORBIDDEN');
      }

      return attempt;
    } catch (e: any) {
      if (e.message === 'FORBIDDEN') throw e;
      console.warn('[QuizService] Could not fetch attempt from DB:', e);
      return null;
    }
  }
}
