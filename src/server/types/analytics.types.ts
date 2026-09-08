// ==============================================================================
// 🚀 منصة طرقع للكمي - أنواع محرك التحليلات وإحصاءات الأداء (Analytics Types)
// ==============================================================================

export interface CategoryMastery {
  categoryId: string;
  categoryTitle: string;
  categorySlug: string;
  totalAnswered: number;
  correctCount: number;
  masteryPercentage: number; // 0 - 100
  status: 'Mastered' | 'Good' | 'Needs_Practice';
}

export interface TimeEfficiencyReport {
  averageSecondsPerQuestion: number;
  targetSecondsPerQuestion: number; // 60s for standard Qiyas, 45s for Tarqa Speed
  isEfficient: boolean; // true if <= target
  efficiencyRating: 'Fast' | 'Optimal' | 'Slow';
  recommendation: string;
}

export interface WeakSubtopic {
  topicId: string;
  topicTitle: string;
  categoryTitle: string;
  failureRate: number; // percentage e.g. 66.7%
  totalAttempted: number;
  wrongCount: number;
  recommendedQuizType: string;
  recommendedAction: string;
}

export interface UserAnalyticsReport {
  userId: string;
  totalQuizzesTaken: number;
  averageScore: number;
  highestScore: number;
  targetScore: number; // default 100 🎯
  streakDays: number;
  categoryMastery: CategoryMastery[];
  timeEfficiency: TimeEfficiencyReport;
  topWeakSubtopics: WeakSubtopic[];
  recentAttemptsTrend: {
    attemptId: string;
    score: number;
    completedAt: string;
  }[];
}
