// ==============================================================================
// 🚀 منصة طرقع للكمي - أنواع واستجابات واجهة برمجة التطبيقات (API Types)
// ==============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    timestamp: string;
    durationMs?: number;
  };
}

export type OptionKey = 'A' | 'B' | 'C' | 'D';
export type QuestionDifficulty = 'Easy' | 'Medium' | 'Hard';
export type QuizType = 'Diagnostic' | 'Topic_Practice' | 'Full_Mock' | 'Speed_Challenge';
export type UserRole = 'student' | 'teacher' | 'admin';

