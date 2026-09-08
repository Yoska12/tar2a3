import { getSupabaseAdminClient } from '../lib/db';
import { 
  SanitizedQuestion, 
  RandomQuestionsQueryInput, 
  OptionKey 
} from '../types/quiz.types';
import { mockQuestions } from '../../data/mockQuestions';

export class QuestionService {
  /**
   * 1. جلب بنك أسئلة مخصص حسب القسم، الصعوبة، أو النمط (بدون إجابات صحيحة)
   */
  static async getRandomQuestions(filters: RandomQuestionsQueryInput): Promise<SanitizedQuestion[]> {
    const supabase = getSupabaseAdminClient();

    try {
      let query = supabase
        .from('questions')
        .select(`
          id,
          category_id,
          topic_id,
          question_text,
          question_image_url,
          svg_diagram,
          options,
          difficulty,
          source
        `)
        .eq('is_published', true);

      if (filters.categoryId && filters.categoryId !== 'all') {
        query = query.eq('category_id', filters.categoryId);
      }

      if (filters.difficulty) {
        query = query.eq('difficulty', filters.difficulty);
      }

      query = query.limit(filters.limit || 10);

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        return data.map((q: any) => ({
          id: q.id,
          categoryId: q.category_id,
          topicId: q.topic_id,
          questionText: q.question_text,
          questionImageUrl: q.question_image_url,
          svgDiagram: q.svg_diagram,
          options: q.options,
          difficulty: q.difficulty,
          source: q.source,
        }));
      }
    } catch (e) {
      console.warn('[QuestionService] DB query failed, falling back to mock questions:', e);
    }

    // تصفية الأسئلة المحلية واستبعاد الإجابة والشرح لحماية الأمان
    let result = [...mockQuestions];

    if (filters.categoryId && filters.categoryId !== 'all') {
      result = result.filter((q) => q.categoryId === filters.categoryId);
    }

    if (filters.difficulty) {
      result = result.filter((q) => q.difficulty === filters.difficulty);
    }

    result = result.sort(() => 0.5 - Math.random()).slice(0, filters.limit || 10);

    return result.map((q) => ({
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
   * 2. التحقق الفوري من إجابة سؤال واحد (لنمط التدريب الموجه والحل السريع)
   */
  static async verifyQuestion(
    questionId: string,
    selectedOption: OptionKey
  ): Promise<{
    isCorrect: boolean;
    correctOption: OptionKey;
    explanation: string;
    svgDiagram?: string | null;
  }> {
    const supabase = getSupabaseAdminClient();

    try {
      const { data, error } = await supabase
        .from('questions')
        .select('correct_option, explanation, svg_diagram')
        .eq('id', questionId)
        .maybeSingle();

      if (!error && data) {
        const isCorrect = data.correct_option === selectedOption;
        return {
          isCorrect,
          correctOption: data.correct_option as OptionKey,
          explanation: data.explanation,
          svgDiagram: data.svg_diagram,
        };
      }
    } catch (e) {
      console.warn('[QuestionService] DB verify error, fallback to mock questions:', e);
    }

    // مطابقة مع الأسئلة المحلية
    const found = mockQuestions.find((q) => q.id === questionId);
    if (!found) {
      throw new Error('السؤال المطلوب غير موجود');
    }

    const isCorrect = found.correctOption === selectedOption;
    return {
      isCorrect,
      correctOption: found.correctOption,
      explanation: found.explanation,
      svgDiagram: found.svgDiagram,
    };
  }

  /**
   * 3. حفظ السؤال في المفضلة / المراجعة لاحقاً (Bookmark)
   */
  static async bookmarkQuestion(
    userId: string,
    questionId: string,
    bookmark = true
  ): Promise<{ bookmarked: boolean; questionId: string }> {
    const supabase = getSupabaseAdminClient();

    try {
      if (bookmark) {
        await supabase
          .from('saved_questions')
          .upsert({ user_id: userId, question_id: questionId }, { onConflict: 'user_id,question_id' });
      } else {
        await supabase
          .from('saved_questions')
          .delete()
          .eq('user_id', userId)
          .eq('question_id', questionId);
      }
    } catch (e) {
      console.warn('[QuestionService] Bookmark persistence error:', e);
    }

    return {
      bookmarked: bookmark,
      questionId,
    };
  }
}
