/**
 * ==============================================================================
 * منصة طرقع - خدمة محاكي قياس وبنوك الأسئلة المتكاملة (Tarqa Simulator Service)
 * ==============================================================================
 * إدارة ومزامنة نتائج الاختبارات، الربط مع الباك إند (PHP/MySQL) وسوبابيز (Supabase)
 * ونظام الرتب والاشتراكات السنوية ونقاط المكافآت.
 */
import { TarqaUser, supabase, isSupabaseConfigured } from './supabase';
import { isUserSubscribed, canEditCourses } from './subscriptionService';
import { pointsService } from './pointsService';

export interface SimulatorExamResult {
  id: string;
  exam_name: string;
  exam?: string;
  type?: string;
  total_questions: number;
  correct_answers: number;
  incorrect_answers: number;
  unanswered_questions: number;
  score_percentage: number;
  time_taken_seconds?: number;
  created_at: string;
  details?: any;
}

export interface SimulatorStats {
  totalExams: number;
  averageScore: number;
  highestScore: number;
  totalTimeMinutes: number;
  recentResults: SimulatorExamResult[];
}

const STORAGE_KEY_LOCAL_RESULTS = 'tarqa_simulator_cached_results_v1';

export const simulatorService = {
  /**
   * مزامنة جلسة المستخدم الحالية فوراً مع خادم الباك إند PHP
   * لضمان عمل حفظ النتائج والتقدم والمجلدات بدون انقطاع
   */
  async syncSessionToBackend(user: TarqaUser | null): Promise<boolean> {
    if (!user || (!user.id && !user.email)) return false;
    try {
      const res = await fetch('/Login/sync_tarqa_session.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user }),
      });
      return res.ok;
    } catch (e) {
      console.debug('[simulatorService.syncSessionToBackend] notice:', e);
      return false;
    }
  },

  /**
   * فحص أهلية الطالب لدخول المحاكي المعين
   */
  canAccessSimulator(
    simulatorType: 'simulation' | 'exam' | 'tiger',
    user: TarqaUser | null
  ): { canAccess: boolean; reason?: 'guest' | 'subscription_required' } {
    if (!user) {
      return { canAccess: false, reason: 'guest' };
    }

    // اختبار تحديد المستوى متاح مجاناً لجميع الطلاب المسجلين
    if (simulatorType === 'exam') {
      return { canAccess: true };
    }

    // المشرفون والمعلمون والمشتركون لديهم وصول كامل لمحاكي الطرقعة ومحاكي نمر
    const subscribed = isUserSubscribed(user) || canEditCourses(user.role, user.email);
    if (subscribed) {
      return { canAccess: true };
    }

    return { canAccess: false, reason: 'subscription_required' };
  },

  /**
   * جلب سجل نتائج الاختبارات السابقة للطالب (من الباك إند + Supabase + التخزين المحلي)
   */
  async getResults(user: TarqaUser | null): Promise<SimulatorExamResult[]> {
    if (!user) return [];

    const userId = user.telegramId || user.id || user.email;
    let results: SimulatorExamResult[] = [];

    // 1. محاولة الجلب من الباك إند PHP السحابي
    try {
      const res = await fetch(`/Login/get_results.php?userId=${encodeURIComponent(userId)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && Array.isArray(data.results)) {
          results = data.results;
        }
      }
    } catch (e) {
      console.debug('[simulatorService.getResults] backend fetch notice:', e);
    }

    // 2. إذا كانت النتائج فارغة، محاولة الجلب من Supabase (user_quiz_attempts)
    if (results.length === 0 && isSupabaseConfigured && user.id) {
      try {
        const { data, error } = await supabase
          .from('user_quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })
          .limit(50);

        if (!error && data && data.length > 0) {
          results = data.map((d: any) => ({
            id: d.id,
            exam_name: d.quiz_title || d.quiz_id || 'اختبار محاكي قياس',
            total_questions: d.total_questions || 0,
            correct_answers: d.correct_count || 0,
            incorrect_answers: d.wrong_count || 0,
            unanswered_questions: Math.max(0, (d.total_questions || 0) - ((d.correct_count || 0) + (d.wrong_count || 0))),
            score_percentage: Number(d.score || 0),
            time_taken_seconds: d.time_spent_seconds || 0,
            created_at: d.completed_at || new Date().toISOString(),
          }));
        }
      } catch (e) {
        console.debug('[simulatorService.getResults] supabase fetch notice:', e);
      }
    }

    // 3. التخزين المحلي كنسخة احتياطية
    if (results.length === 0 && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${STORAGE_KEY_LOCAL_RESULTS}_${userId}`);
        if (stored) {
          results = JSON.parse(stored);
        }
      } catch (e) {}
    } else if (results.length > 0 && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${STORAGE_KEY_LOCAL_RESULTS}_${userId}`, JSON.stringify(results));
      } catch (e) {}
    }

    return results;
  },

  /**
   * حساب إحصائيات الطالب الإجمالية من نتائج الاختبارات
   */
  calculateStats(results: SimulatorExamResult[]): SimulatorStats {
    if (!results || results.length === 0) {
      return {
        totalExams: 0,
        averageScore: 0,
        highestScore: 0,
        totalTimeMinutes: 0,
        recentResults: [],
      };
    }

    const totalExams = results.length;
    let sumScore = 0;
    let highestScore = 0;
    let totalSeconds = 0;

    results.forEach((r) => {
      const score = Number(r.score_percentage) || 0;
      sumScore += score;
      if (score > highestScore) highestScore = score;
      totalSeconds += Number(r.time_taken_seconds) || 0;
    });

    const averageScore = Math.round(sumScore / totalExams);
    const totalTimeMinutes = Math.round(totalSeconds / 60);

    return {
      totalExams,
      averageScore,
      highestScore: Math.round(highestScore),
      totalTimeMinutes,
      recentResults: results.slice(0, 10),
    };
  },

  /**
   * حفظ نتيجة اختبار جديدة ومكافأة الطالب بالنقاط
   */
  async saveResult(
    user: TarqaUser | null,
    resultData: {
      examName: string;
      totalQuestions: number;
      correctAnswers: number;
      incorrectAnswers: number;
      unansweredQuestions: number;
      percentage: number;
      timeTaken: number;
      details?: any;
    }
  ): Promise<boolean> {
    if (!user) return false;

    const userId = user.telegramId || user.id || user.email;

    // 1. الحفظ في الباك إند PHP
    try {
      await fetch('/Login/save_results.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...resultData,
          userId,
        }),
      });
    } catch (e) {
      console.debug('[simulatorService.saveResult] backend notice:', e);
    }

    // 2. الحفظ في Supabase (user_quiz_attempts)
    if (isSupabaseConfigured && user.id) {
      try {
        await supabase.from('user_quiz_attempts').insert({
          user_id: user.id,
          quiz_id: '00000000-0000-0000-0000-000000000001', // Default simulator quiz UUID
          score: resultData.percentage,
          total_questions: resultData.totalQuestions,
          correct_count: resultData.correctAnswers,
          wrong_count: resultData.incorrectAnswers,
          time_spent_seconds: resultData.timeTaken,
          answers: resultData.details || {},
        });
      } catch (e) {
        console.debug('[simulatorService.saveResult] supabase insert notice:', e);
      }
    }

    // 3. منح نقاط للطالب عبر pointsService
    try {
      let earnedPoints = 50; // 50 نقطة بمجرد إكمال الاختبار
      if (resultData.percentage >= 90) {
        earnedPoints += 100; // بونص تفوق ممتاز
      } else if (resultData.percentage >= 80) {
        earnedPoints += 50; // بونص جيد جداً
      }
      pointsService.addPoints(earnedPoints, `إكمال ${resultData.examName} بنسبة ${resultData.percentage}%`, 'bonus', user);
    } catch (e) {}

    return true;
  },
};
