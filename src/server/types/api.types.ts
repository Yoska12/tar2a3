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

export type UserRole = 'student' | 'teacher' | 'admin';
