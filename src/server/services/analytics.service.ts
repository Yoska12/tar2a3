import { getSupabaseAdminClient } from '../lib/db';
import { 
  UserAnalyticsReport, 
  CategoryMastery, 
  TimeEfficiencyReport, 
  WeakSubtopic 
} from '../types/analytics.types';
import { mockCategories } from '../../data/mockQuestions';

export class AnalyticsService {
  /**
   * حساب تقرير أداء تحليلي شامل يعتمد على التجميعات (Aggregations)
   */
  static async getUserAnalytics(userId: string): Promise<UserAnalyticsReport> {
    const supabase = getSupabaseAdminClient();

    let attempts: any[] = [];
    let targetScore = 100;
    let streakDays = 1;

    try {
      // 1. جلب بيانات ملف الطالب
      const { data: profile } = await supabase
        .from('profiles')
        .select('target_score, streak_days')
        .eq('id', userId)
        .maybeSingle();

      if (profile) {
        targetScore = profile.target_score || 100;
        streakDays = profile.streak_days || 1;
      }

      // 2. جلب جميع محاولات الطالب
      const { data: dbAttempts } = await supabase
        .from('user_quiz_attempts')
        .select('id, score, total_questions, correct_count, wrong_count, time_spent_seconds, answers, completed_at')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false });

      if (dbAttempts && dbAttempts.length > 0) {
        attempts = dbAttempts;
      }
    } catch (e) {
      console.warn('[AnalyticsService] DB query failed:', e);
    }

    // إحصائيات عامة
    const totalQuizzesTaken = attempts.length;
    const scores = attempts.map((a) => Number(a.score) || 0);
    const highestScore = scores.length > 0 ? Math.max(...scores) : 0;
    const averageScore = scores.length > 0 
      ? Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) 
      : 0;

    // تجميع الإجابات حسب الأقسام والموضوعات
    const categoryStats: Record<string, { total: number; correct: number }> = {};
    const topicStats: Record<string, { topicId: string; total: number; wrong: number; categoryId: string }> = {};

    let totalQuestionsAnswered = 0;
    let totalTimeSpent = 0;

    // المرور على جميع الإجابات المخزنة
    attempts.forEach((att) => {
      totalTimeSpent += att.time_spent_seconds || 0;
      const ansList = Array.isArray(att.answers) ? att.answers : [];

      ansList.forEach((ans: any) => {
        totalQuestionsAnswered++;
        const catId = ans.categoryId || 'arithmetic';
        const isCorrect = Boolean(ans.isCorrect);

        if (!categoryStats[catId]) {
          categoryStats[catId] = { total: 0, correct: 0 };
        }
        categoryStats[catId].total++;
        if (isCorrect) categoryStats[catId].correct++;

        // تتبع الموضوعات الفرعية إن وجدت
        const topicId = ans.topicId || catId;
        if (!topicStats[topicId]) {
          topicStats[topicId] = { topicId, total: 0, wrong: 0, categoryId: catId };
        }
        topicStats[topicId].total++;
        if (!isCorrect) topicStats[topicId].wrong++;
      });
    });

    // 1. حساب نسبة الإتقان لكل قسم (Category Mastery)
    const validCategories = mockCategories.filter((c) => c.id !== 'all');
    const categoryMastery: CategoryMastery[] = validCategories.map((cat) => {
      const stats = categoryStats[cat.id] || categoryStats[cat.slug] || { total: 0, correct: 0 };
      const percentage = stats.total > 0 
        ? Number(((stats.correct / stats.total) * 100).toFixed(1)) 
        : 0;

      let status: 'Mastered' | 'Good' | 'Needs_Practice' = 'Needs_Practice';
      if (percentage >= 85) status = 'Mastered';
      else if (percentage >= 65) status = 'Good';

      return {
        categoryId: cat.id,
        categoryTitle: cat.title,
        categorySlug: cat.slug,
        totalAnswered: stats.total,
        correctCount: stats.correct,
        masteryPercentage: percentage,
        status,
      };
    });

    // 2. تحليل الكفاءة الزمنية (Time Efficiency)
    const avgSecondsPerQuestion = totalQuestionsAnswered > 0 
      ? Math.round(totalTimeSpent / totalQuestionsAnswered) 
      : 42; // القيمة النموذجية لطريقة طرقع

    const targetSeconds = 60; // معيار قياس
    const isEfficient = avgSecondsPerQuestion <= targetSeconds;

    let efficiencyRating: 'Fast' | 'Optimal' | 'Slow' = 'Optimal';
    let recommendation = 'سرعتك متوازنة وممتازة مع معايير اختبار قياس.';

    if (avgSecondsPerQuestion < 40) {
      efficiencyRating = 'Fast';
      recommendation = 'سرعة خارقة بأسلوب طرقع! تأكد فقط من قراءة المعطيات بدقة.';
    } else if (avgSecondsPerQuestion > targetSeconds) {
      efficiencyRating = 'Slow';
      recommendation = 'الوقت المستغرق أعلى من دقيقة لكل سؤال، تدرب على استراتيجيات التدرج والتجريب الذهني.';
    }

    const timeEfficiency: TimeEfficiencyReport = {
      averageSecondsPerQuestion: avgSecondsPerQuestion,
      targetSecondsPerQuestion: targetSeconds,
      isEfficient,
      efficiencyRating,
      recommendation,
    };

    // 3. تحديد أكثر 3 موضوعات فرعية يخفق فيها الطالب لاقتراح اختبارات علاجية
    const weakTopicsSorted = Object.values(topicStats)
      .filter((t) => t.wrong > 0 && t.total >= 2)
      .map((t) => {
        const cat = validCategories.find((c) => c.id === t.categoryId);
        const failureRate = Number(((t.wrong / t.total) * 100).toFixed(1));
        return {
          topicId: t.topicId,
          topicTitle: `مسائل ${cat?.title || t.topicId}`,
          categoryTitle: cat?.title || 'القسم الكمي',
          failureRate,
          totalAttempted: t.total,
          wrongCount: t.wrong,
          recommendedQuizType: 'Topic_Practice',
          recommendedAction: `بدء اختبار علاجي مركز في: ${cat?.title || 'هذا الموضوع'} مع استراتيجيات طرقع`,
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate)
      .slice(0, 3);

    // إذا لم تكن هناك إخفاقات كافية، نقترح موضوعات أساسية شائعة للتدريب
    const topWeakSubtopics: WeakSubtopic[] = weakTopicsSorted.length > 0 
      ? weakTopicsSorted 
      : [
          {
            topicId: 'geometry_triangles',
            topicTitle: 'المثلثات والزوايا المظللة',
            categoryTitle: 'الهندسة والقياس',
            failureRate: 0,
            totalAttempted: 0,
            wrongCount: 0,
            recommendedQuizType: 'Topic_Practice',
            recommendedAction: 'تدرب على ثلاثيات فيثاغورس الذهبية لتسريع الحل',
          },
          {
            topicId: 'arithmetic_percentages',
            topicTitle: 'النسب المئوية والربح والخسارة',
            categoryTitle: 'الحساب والأعداد',
            failureRate: 0,
            totalAttempted: 0,
            wrongCount: 0,
            recommendedQuizType: 'Topic_Practice',
            recommendedAction: 'استخدم طريقة التدرج المنتظم بدلاً من القوانين الطويلة',
          },
        ];

    // مسار الدرجات الأخيرة (Trend)
    const recentAttemptsTrend = attempts.slice(0, 7).map((a) => ({
      attemptId: a.id,
      score: Number(a.score) || 0,
      completedAt: a.completed_at,
    }));

    return {
      userId,
      totalQuizzesTaken,
      averageScore,
      highestScore,
      targetScore,
      streakDays,
      categoryMastery,
      timeEfficiency,
      topWeakSubtopics,
      recentAttemptsTrend,
    };
  }
}
