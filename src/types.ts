export type OptionId = 'A' | 'B' | 'C' | 'D';
export type UserRole = 'student' | 'teacher' | 'admin' | 'super_admin';

export interface Option {
  id: OptionId;
  text: string;
  image?: string;
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface Category {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon: string;
  badgeColor?: string;
  questionsCount?: number;
}

export interface Question {
  id: string;
  categoryId: string;
  categoryTitle?: string;
  topicId?: string;
  topicTitle?: string;
  questionText: string; // يدعم نصوص KaTeX مثل $x^2 + 5$
  questionImageUrl?: string;
  svgDiagram?: string; // رسم هندسي SVG اختياري عالي الدقة
  options: Option[];
  correctOption: OptionId;
  explanation: string; // شرح "طريقة طرقع الذكية"
  explanationImageUrl?: string;
  difficulty: Difficulty;
  source?: string;
}

export type QuizMode = 'Mock_Exam' | 'Practice_Mode' | 'Speed_Challenge';

export interface QuizSettings {
  mode: QuizMode;
  timeLimitSeconds: number; // 0 means no time limit
  allowInstantExplanation: boolean;
  categoryFilter?: string;
}

export interface QuizResult {
  totalQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unanswered: number;
  percentageScore: number;
  totalTimeSeconds: number;
  categoryPerformance: Record<string, { total: number; correct: number }>;
  detailedAnswers: {
    question: Question;
    userAnswer?: OptionId;
    isCorrect: boolean;
    timeSpentSeconds: number;
  }[];
}

// ==============================================================================
// أنواع نظام تأسيس القدرات والمحاضرات والمذكرات (Lectures & Foundation System)
// ==============================================================================

export type VideoProvider = 'uploaded_video' | 'direct_url' | 'youtube' | 'vimeo' | 'bunny';
export type AttachmentType = 'pdf' | 'summary' | 'worksheet';

export interface LessonAttachment {
  id: string;
  lessonId: string;
  title: string;
  fileUrl: string;
  fileSize: string;
  fileType: AttachmentType;
  downloadCount?: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  moduleTitle?: string;
  title: string;
  description: string;
  videoProvider: VideoProvider;
  videoUrl: string;
  durationMinutes: number;
  orderIndex: number;
  isFreePreview: boolean;
  isPublished: boolean;
  quizId?: string;
  attachments?: LessonAttachment[];
  isCompleted?: boolean;
  lastWatchedSeconds?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description: string;
  orderIndex: number;
  icon?: string;
  badgeColor?: string;
  isPublished: boolean;
  lessons: Lesson[];
  totalDurationMinutes?: number;
  completedLessonsCount?: number;
}

export interface UserLessonProgress {
  id: string;
  userId: string;
  lessonId: string;
  isCompleted: boolean;
  lastWatchedSeconds: number;
  completedAt?: string;
}

// ==============================================================================
// نظام إدارة الرتب والصلاحيات (Super Admin Roles Management System)
// ==============================================================================

export interface StudentDownloadedFile {
  id?: string;
  title: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: string;
  downloadedAt: string;
}

export interface UserWithRole {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  targetScore: number;
  telegramUsername?: string;
  telegramId?: number;
  avatarUrl?: string;
  createdAt: string;
  lastSignInAt?: string;
  isBanned?: boolean;
  banReason?: string;
  bannedAt?: string;
  isSubscribed?: boolean;
  subscriptionExpiresAt?: string;
  // نظام تتبع تحميل الملفات والمذكرات
  hasDownloadedFiles?: boolean;
  downloadedFilesCount?: number;
  lastDownloadedAt?: string;
  downloadedFiles?: StudentDownloadedFile[];
}

export interface CourseSubscription {
  userId: string;
  userEmail?: string;
  userName?: string;
  planId: 'annual_75';
  planName: string;
  priceSAR: number;
  startDate: string;
  expiresDate: string;
  isActive: boolean;
}

export interface RoleChangeLog {
  id: string;
  adminId: string;
  adminName?: string;
  targetUserId: string;
  targetUserName?: string;
  oldRole: UserRole;
  newRole: UserRole;
  reason?: string;
  createdAt: string;
}

export interface CourseFileItem {
  id: string;
  title: string;
  description: string;
  fileUrl: string;
  fileSize: string;
  pagesCount?: string;
  fileType: 'pdf' | 'worksheet' | 'summary' | 'book';
  isFreePreview?: boolean;
  downloadCount?: number;
  uploadedAt?: string;
}

