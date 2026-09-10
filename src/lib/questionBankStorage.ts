import { Question } from '../types';
import { mockQuestions } from '../data/mockQuestions';
import { supabase, isSupabaseConfigured } from './supabase';
import { CLOUD_LECTURES_STORE_ID } from './subscriptionService';

export const CLOUD_QUESTIONS_STORE_ID = 'a0a2797a-5bcb-4987-b9bc-43b6a3d36876';
export const CLOUD_QUESTIONS_STORE_EMAIL = 'tarqa_test_1789048296799@gmail.com';

const STORAGE_KEY_QUESTIONS = 'tarqa_custom_questions_v1';
const STORAGE_KEY_QUIZZES = 'tarqa_custom_quizzes_v1';

export interface CustomQuizItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  durationMinutes: number;
  questionIds: string[];
  createdAt?: string;
}

/**
 * إدارة وتخزين بنك الأسئلة والاختبارات المخصصة
 * مع المزامنة السحابية اللحظية (Supabase Cloud Sync) لكافة المستخدمين والطلاب
 */
export const questionBankStorage = {
  // جلب الأسئلة من التخزين المحلي أو الأسئلة الافتراضية
  getQuestions(): Question[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QUESTIONS);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[questionBankStorage] Error reading local questions:', e);
    }
    return [...mockQuestions];
  },

  // حفظ الأسئلة محلياً ومزامنتها سحابياً فوراً
  saveQuestions(questions: Question[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(questions));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tarqa_questions_changed', { detail: questions })
        );
      }
      this.syncToCloud(questions);
    } catch (e) {
      console.warn('[questionBankStorage] Error saving questions:', e);
    }
  },

  // إضافة سؤال جديد
  addQuestion(newQuestion: Question): Question[] {
    const current = this.getQuestions();
    const updated = [newQuestion, ...current];
    this.saveQuestions(updated);
    return updated;
  },

  // تعديل سؤال موجود
  updateQuestion(updatedQuestion: Question): Question[] {
    const current = this.getQuestions();
    const updated = current.map((q) =>
      q.id === updatedQuestion.id ? updatedQuestion : q
    );
    this.saveQuestions(updated);
    return updated;
  },

  // حذف سؤال
  deleteQuestion(questionId: string): Question[] {
    const current = this.getQuestions();
    const updated = current.filter((q) => q.id !== questionId);
    this.saveQuestions(updated);
    return updated;
  },

  // إعادة التعيين إلى بنك الأسئلة الافتراضي
  resetToDefault(): Question[] {
    const reset = [...mockQuestions];
    this.saveQuestions(reset);
    return reset;
  },

  // جلب الاختبارات المخصصة
  getQuizzes(): CustomQuizItem[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_QUIZZES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[questionBankStorage] Error reading quizzes:', e);
    }
    return [];
  },

  // حفظ اختبار مخصص جديد
  saveQuiz(quizData: CustomQuizItem): CustomQuizItem[] {
    try {
      const current = this.getQuizzes();
      const existingIdx = current.findIndex((q) => q.id === quizData.id);
      let updated: CustomQuizItem[];
      if (existingIdx >= 0) {
        updated = current.map((q) => (q.id === quizData.id ? quizData : q));
      } else {
        updated = [quizData, ...current];
      }
      localStorage.setItem(STORAGE_KEY_QUIZZES, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tarqa_quizzes_changed', { detail: updated })
        );
      }
      this.syncToCloud(undefined, updated);
      return updated;
    } catch (e) {
      console.warn('[questionBankStorage] Error saving quiz:', e);
      return this.getQuizzes();
    }
  },

  // حذف اختبار مخصص
  deleteQuiz(quizId: string): CustomQuizItem[] {
    try {
      const current = this.getQuizzes();
      const updated = current.filter((q) => q.id !== quizId);
      localStorage.setItem(STORAGE_KEY_QUIZZES, JSON.stringify(updated));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tarqa_quizzes_changed', { detail: updated })
        );
      }
      this.syncToCloud(undefined, updated);
      return updated;
    } catch (e) {
      console.warn('[questionBankStorage] Error deleting quiz:', e);
      return this.getQuizzes();
    }
  },

  // مزامنة فورية إلى السحابة (Supabase Cloud Store)
  async syncToCloud(questions?: Question[], quizzes?: CustomQuizItem[]): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;
    try {
      const currentQuestions = questions || this.getQuestions();
      const currentQuizzes = quizzes || this.getQuizzes();

      const payload = JSON.stringify({
        version: 1,
        questions: currentQuestions,
        quizzes: currentQuizzes,
        updatedAt: new Date().toISOString(),
      });

      // 1. التحديث في السجل الأساسي لبنك الأسئلة
      const { error } = await supabase
        .from('profiles')
        .update({
          ban_reason: payload,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', CLOUD_QUESTIONS_STORE_ID);

      if (error) {
        console.warn('[questionBankStorage] Primary cloud sync error, trying backup store:', error);
        // نسخة احتياطية في مخزن المنصة المركزي
        const { data: backupRec } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();

        let backupParsed: any = {};
        try {
          if (backupRec?.ban_reason) {
            backupParsed = JSON.parse(backupRec.ban_reason);
          }
        } catch {}

        await supabase
          .from('profiles')
          .update({
            ban_reason: JSON.stringify({
              ...backupParsed,
              questions: currentQuestions,
              quizzes: currentQuizzes,
              questionsUpdatedAt: new Date().toISOString(),
            }),
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', CLOUD_LECTURES_STORE_ID);
      }

      return true;
    } catch (e) {
      console.warn('[questionBankStorage] syncToCloud exception:', e);
      return false;
    }
  },

  // جلب ومزامنة أحدث الأسئلة والاختبارات من السحابة لجميع المستخدمين
  async syncFromCloud(): Promise<{ questions: Question[]; quizzes: CustomQuizItem[] } | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    try {
      // 1. المحاولة من السجل الأساسي
      const { data, error } = await supabase
        .from('profiles')
        .select('ban_reason, updated_at')
        .eq('id', CLOUD_QUESTIONS_STORE_ID)
        .maybeSingle();

      let targetData = data;

      // 2. المحاولة من السجل الاحتياطي إذا لم يتوفر الأساسي
      if (error || !targetData || !targetData.ban_reason) {
        const { data: backupData } = await supabase
          .from('profiles')
          .select('ban_reason, updated_at')
          .eq('id', CLOUD_LECTURES_STORE_ID)
          .maybeSingle();
        targetData = backupData;
      }

      if (!targetData || !targetData.ban_reason) return null;

      let cloudQuestions: Question[] | null = null;
      let cloudQuizzes: CustomQuizItem[] | null = null;

      try {
        const parsed = JSON.parse(targetData.ban_reason);
        if (Array.isArray(parsed)) {
          cloudQuestions = parsed;
        } else if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.questions)) {
            cloudQuestions = parsed.questions;
          }
          if (Array.isArray(parsed.quizzes)) {
            cloudQuizzes = parsed.quizzes;
          }
        }
      } catch (e) {
        console.warn('[questionBankStorage] Error parsing cloud questions JSON:', e);
      }

      if (cloudQuestions && Array.isArray(cloudQuestions)) {
        localStorage.setItem(STORAGE_KEY_QUESTIONS, JSON.stringify(cloudQuestions));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tarqa_questions_changed', { detail: cloudQuestions })
          );
        }
      }

      if (cloudQuizzes && Array.isArray(cloudQuizzes)) {
        localStorage.setItem(STORAGE_KEY_QUIZZES, JSON.stringify(cloudQuizzes));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('tarqa_quizzes_changed', { detail: cloudQuizzes })
          );
        }
      }

      if (cloudQuestions) {
        return {
          questions: cloudQuestions,
          quizzes: cloudQuizzes || this.getQuizzes(),
        };
      }
    } catch (e) {
      console.warn('[questionBankStorage] syncFromCloud exception:', e);
    }
    return null;
  },
};
