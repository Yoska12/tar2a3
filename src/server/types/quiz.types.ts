import { z } from 'zod';
import { OptionKey, QuestionDifficulty, QuizType } from './api.types';
export type { OptionKey, QuestionDifficulty, QuizType };

// ==============================================================================
// 1. واجهات الأسئلة (Questions Interfaces)
// ==============================================================================

export interface QuestionOption {
  id: OptionKey;
  text: string;
}

// السؤال الآمن المخصص للطلاب أثناء الاختبار (بدون إجابة صحيحة أو شرح)
export interface SanitizedQuestion {
  id: string;
  categoryId: string;
  topicId?: string | null;
  questionText: string;
  questionImageUrl?: string | null;
  svgDiagram?: string | null;
  options: QuestionOption[];
  difficulty: QuestionDifficulty;
  source?: string;
}

// السؤال الكامل الداخلي في السيرفر (يشمل الإجابة والشرح)
export interface FullQuestion extends SanitizedQuestion {
  correctOption: OptionKey;
  explanation: string;
  explanationImageUrl?: string | null;
}

// ==============================================================================
// 2. واجهات جلسات الاختبار والتصحيح (Quiz Sessions & Evaluation)
// ==============================================================================

export interface QuizSessionPayload {
  attemptId: string;
  userId: string;
  quizId: string;
  startedAt: number; // Unix timestamp in ms
  maxDurationSeconds: number;
  questionIds: string[];
}

export interface StudentAnswerInput {
  questionId: string;
  selectedOption: OptionKey;
  timeSpentSeconds: number;
}

export interface EvaluatedAnswer {
  questionId: string;
  questionText: string;
  selectedOption: OptionKey;
  correctOption: OptionKey;
  isCorrect: boolean;
  timeSpentSeconds: number;
  explanation: string;
  categoryId: string;
  topicId?: string | null;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryTitle?: string;
  totalQuestions: number;
  correctCount: number;
  accuracyPercentage: number;
}

export interface QuizSubmissionResult {
  attemptId: string;
  quizId: string;
  score: number; // Percentage e.g. 95.00
  targetScore: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  timeSpentSeconds: number;
  averageTimePerQuestion: number;
  categoryBreakdown: CategoryBreakdown[];
  detailedAnswers: EvaluatedAnswer[];
  completedAt: string;
}

// ==============================================================================
// 3. مخططات التحقق (Zod Schemas)
// ==============================================================================

export const startQuizSchema = z.object({
  quizId: z.string().min(1, 'معرف الاختبار مطلوب'),
  quizType: z.enum(['Diagnostic', 'Topic_Practice', 'Full_Mock', 'Speed_Challenge']).optional(),
});

export const submitQuizSchema = z.object({
  sessionToken: z.string().min(10, 'رمز جلسة الاختبار (sessionToken) مطلوب وغير صالح'),
  answers: z.array(
    z.object({
      questionId: z.string().min(1, 'معرف السؤال مطلوب'),
      selectedOption: z.enum(['A', 'B', 'C', 'D']),
      timeSpentSeconds: z.number().min(0, 'الزمن المستغرق يجب أن يكون موجباً'),
    })
  ).min(1, 'يجب إرسال إجابة واحدة على الأقل'),
});

export const verifyQuestionSchema = z.object({
  selectedOption: z.enum(['A', 'B', 'C', 'D']),
});

export const bookmarkQuestionSchema = z.object({
  bookmark: z.boolean().optional().default(true),
});

export const randomQuestionsQuerySchema = z.object({
  categoryId: z.string().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  limit: z.coerce.number().min(1).max(50).default(10),
  mode: z.enum(['mock', 'practice']).default('mock'),
});

export type StartQuizInput = z.infer<typeof startQuizSchema>;
export type SubmitQuizInput = z.infer<typeof submitQuizSchema>;
export type VerifyQuestionInput = z.infer<typeof verifyQuestionSchema>;
export type BookmarkQuestionInput = z.infer<typeof bookmarkQuestionSchema>;
export type RandomQuestionsQueryInput = z.infer<typeof randomQuestionsQuerySchema>;
