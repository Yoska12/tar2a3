import React, { useState } from 'react';
import {
  Users,
  Database,
  CheckSquare,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  BookOpen,
  HelpCircle,
  FileText,
  Clock,
  Layers,
  Save,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { Question, Category, OptionId, Difficulty, QuizMode } from '../types';

interface AdminPanelProps {
  questions: Question[];
  categories: Category[];
  onAddQuestion: (newQuestion: Question) => void;
  onUpdateQuestion: (updated: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onCreateQuiz?: (quizData: any) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  questions,
  categories,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onCreateQuiz,
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'quizBuilder'>('questions');

  // فلاتر بنك الأسئلة
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState<string>('all');

  // نافذة إضافة / تعديل سؤال
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // حالة استمارة السؤال
  const [formCategoryId, setFormCategoryId] = useState('algebra');
  const [formQuestionText, setFormQuestionText] = useState('إذا كان $2^{x+1} = 8$ ، فما قيمة $x$؟');
  const [formQuestionImageUrl, setFormQuestionImageUrl] = useState('');
  const [formSvgDiagram, setFormSvgDiagram] = useState('');
  const [formOptions, setFormOptions] = useState([
    { id: 'A' as OptionId, text: '1' },
    { id: 'B' as OptionId, text: '2' },
    { id: 'C' as OptionId, text: '3' },
    { id: 'D' as OptionId, text: '4' },
  ]);
  const [formCorrectOption, setFormCorrectOption] = useState<OptionId>('B');
  const [formExplanation, setFormExplanation] = useState('بما أن $8 = 2^3$ ، إذن $x+1 = 3$ ومنها $x = 2$ مباشرة بدون معادلات.');
  const [formDifficulty, setFormDifficulty] = useState<Difficulty>('Medium');
  const [formSource, setFormSource] = useState('تجميعات 1446 الحديثة');

  // حالة استمارة منشئ الاختبارات
  const [quizTitle, setQuizTitle] = useState('');
  const [quizDescription, setQuizDescription] = useState('');
  const [quizType, setQuizType] = useState<QuizMode>('Mock_Exam');
  const [quizDurationMinutes, setQuizDurationMinutes] = useState(20);
  const [selectedQuizQuestionIds, setSelectedQuizQuestionIds] = useState<string[]>([]);
  const [quizCreatedSuccess, setQuizCreatedSuccess] = useState(false);

  // تصفية الأسئلة
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = 
      q.questionText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.explanation.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategoryFilter === 'all' || q.categoryId === selectedCategoryFilter;
    const matchesDifficulty = selectedDifficultyFilter === 'all' || q.difficulty === selectedDifficultyFilter;

    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  // فتح نافذة الإضافة
  const handleOpenAddModal = () => {
    setEditingQuestionId(null);
    setFormCategoryId(categories.filter(c => c.id !== 'all')[0]?.id || 'algebra');
    setFormQuestionText('');
    setFormQuestionImageUrl('');
    setFormSvgDiagram('');
    setFormOptions([
      { id: 'A', text: '' },
      { id: 'B', text: '' },
      { id: 'C', text: '' },
      { id: 'D', text: '' },
    ]);
    setFormCorrectOption('A');
    setFormExplanation('');
    setFormDifficulty('Medium');
    setFormSource('تجميعات 1446');
    setIsModalOpen(true);
  };

  // فتح نافذة التعديل
  const handleOpenEditModal = (q: Question) => {
    setEditingQuestionId(q.id);
    setFormCategoryId(q.categoryId);
    setFormQuestionText(q.questionText);
    setFormQuestionImageUrl(q.questionImageUrl || '');
    setFormSvgDiagram(q.svgDiagram || '');
    setFormOptions(q.options.map(o => ({ id: o.id, text: o.text })));
    setFormCorrectOption(q.correctOption);
    setFormExplanation(q.explanation);
    setFormDifficulty(q.difficulty);
    setFormSource(q.source || 'تجميعات 1446');
    setIsModalOpen(true);
  };

  // حفظ السؤال
  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestionText.trim()) return;

    const categoryObj = categories.find(c => c.id === formCategoryId);

    const questionData: Question = {
      id: editingQuestionId || 'q-' + Date.now(),
      categoryId: formCategoryId,
      categoryTitle: categoryObj?.title,
      questionText: formQuestionText,
      questionImageUrl: formQuestionImageUrl || undefined,
      svgDiagram: formSvgDiagram || undefined,
      options: formOptions,
      correctOption: formCorrectOption,
      explanation: formExplanation,
      difficulty: formDifficulty,
      source: formSource,
    };

    if (editingQuestionId) {
      onUpdateQuestion(questionData);
    } else {
      onAddQuestion(questionData);
    }

    setIsModalOpen(false);
  };

  // إنشاء الاختبار
  const handleBuildQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizTitle.trim() || selectedQuizQuestionIds.length === 0) return;

    if (onCreateQuiz) {
      onCreateQuiz({
        id: 'quiz-' + Date.now(),
        title: quizTitle,
        description: quizDescription,
        type: quizType,
        durationMinutes: quizDurationMinutes,
        questionIds: selectedQuizQuestionIds,
      });
    }

    setQuizCreatedSuccess(true);
    setTimeout(() => {
      setQuizCreatedSuccess(false);
      setQuizTitle('');
      setQuizDescription('');
      setSelectedQuizQuestionIds([]);
    }, 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 animate-in fade-in duration-200 font-cairo">

      {/* ======================================================================= */}
      {/* 1. إحصائيات المنصة الشاملة (Platform Overview Cards) */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">الطلاب النشطون</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">1,248</div>
            <span className="text-[11px] text-emerald-500 font-bold">+12% هذا الشهر</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-lg">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي بنك الأسئلة</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{questions.length}</div>
            <span className="text-[11px] text-blue-500 font-bold">مقسمة على 6 محاور</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">اختبارات اليوم</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">89</div>
            <span className="text-[11px] text-emerald-500 font-bold">بمعدل إكمال 94%</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">متوسط الدرجات</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">84.2%</div>
            <span className="text-[11px] text-amber-500 font-bold">هدفنا 100 🎯</span>
          </div>
        </div>

      </section>

      {/* ======================================================================= */}
      {/* تبويبات الإدارة (Bank Manager / Quiz Builder) */}
      {/* ======================================================================= */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('questions')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'questions'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>إدارة بنك الأسئلة ({questions.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('quizBuilder')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'quizBuilder'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>منشئ الاختبارات المخصصة</span>
          </button>
        </div>

        {activeTab === 'questions' && (
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة سؤال جديد</span>
          </button>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 2. جدول بنك الأسئلة (Question Bank Manager Table) */}
      {/* ======================================================================= */}
      {activeTab === 'questions' && (
        <section className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
          
          {/* شريط البحث والفلترة */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="ابحث في نصوص الأسئلة أو الشروحات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-4 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-slate-900 dark:text-white"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">جميع الأقسام</option>
                {categories.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>

              <select
                value={selectedDifficultyFilter}
                onChange={(e) => setSelectedDifficultyFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
              >
                <option value="all">كل المستويات</option>
                <option value="Easy">سهل</option>
                <option value="Medium">متوسط</option>
                <option value="Hard">صعب</option>
              </select>
            </div>
          </div>

          {/* جدول الأسئلة */}
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-bold">
                  <th className="pb-3 pr-2 w-12">#</th>
                  <th className="pb-3 px-3">نص المسألة (KaTeX / LaTeX)</th>
                  <th className="pb-3 px-3">القسم</th>
                  <th className="pb-3 px-3">المستوى</th>
                  <th className="pb-3 px-3">الإجابة الصحيحة</th>
                  <th className="pb-3 px-3">المصدر</th>
                  <th className="pb-3 pl-2 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredQuestions.map((q, idx) => (
                  <tr key={q.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                    <td className="py-3 pr-2 text-slate-400 font-mono">{idx + 1}</td>
                    
                    <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200 max-w-md">
                      <div className="line-clamp-2">
                        <MathRenderer content={q.questionText} />
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {q.categoryTitle || q.categoryId}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        q.difficulty === 'Easy' 
                          ? 'bg-emerald-500/10 text-emerald-500' 
                          : q.difficulty === 'Medium' 
                          ? 'bg-blue-500/10 text-blue-500' 
                          : 'bg-rose-500/10 text-rose-500'
                      }`}>
                        {q.difficulty === 'Easy' ? 'سهل' : q.difficulty === 'Medium' ? 'متوسط' : 'صعب'}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black font-mono">
                        {q.correctOption}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {q.source || 'تجميعات 1446'}
                    </td>

                    <td className="py-3 pl-2 text-left">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(q)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-amber-500 transition"
                          title="تعديل السؤال"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 transition"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </section>
      )}

      {/* ======================================================================= */}
      {/* 3. منشئ الاختبارات المخصصة (Quiz Builder) */}
      {/* ======================================================================= */}
      {activeTab === 'quizBuilder' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-5 p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              <span>إعدادات الاختبار الجديد</span>
            </h2>

            <form onSubmit={handleBuildQuiz} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  عنوان الاختبار
                </label>
                <input
                  type="text"
                  placeholder="مثال: محاكي تجميعات النماذج الحديثة (أسبوع 1)"
                  value={quizTitle}
                  onChange={(e) => setQuizTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  الوصف والتوجيهات
                </label>
                <textarea
                  placeholder="ملاحظات توجيهية للطالب قبل البدء..."
                  value={quizDescription}
                  onChange={(e) => setQuizDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع الاختبار
                  </label>
                  <select
                    value={quizType}
                    onChange={(e) => setQuizType(e.target.value as QuizMode)}
                    className="w-full px-3 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Mock_Exam">محاكي قياس شامل</option>
                    <option value="Speed_Challenge">تحدي طرقع للسرعة</option>
                    <option value="Practice_Mode">تدريب مفتوح</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المدة (بالدقائق)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={quizDurationMinutes}
                    onChange={(e) => setQuizDurationMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border text-xs bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  />
                </div>
              </div>

              {/* ملخص الأسئلة المحددة */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">الأسئلة المختارة للاختبار:</span>
                  <span className="font-bold text-amber-500 font-mono text-sm">
                    {selectedQuizQuestionIds.length} سؤال
                  </span>
                </div>
              </div>

              {quizCreatedSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم إنشاء ونشر الاختبار بنجاح في المنصة! 🎯</span>
                </div>
              )}

              <button
                type="submit"
                disabled={selectedQuizQuestionIds.length === 0 || !quizTitle.trim()}
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black text-xs shadow-sm transition flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>إنشاء ونشر الاختبار للطلاب</span>
              </button>
            </form>
          </div>

          {/* قائمة اختيار الأسئلة للاختبار */}
          <div className="lg:col-span-7 p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  اختر الأسئلة المضمنة في الاختبار
                </h3>
                <p className="text-xs text-slate-400">انقر لتحديد أو إلغاء تحديد المسألة</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (selectedQuizQuestionIds.length === questions.length) {
                    setSelectedQuizQuestionIds([]);
                  } else {
                    setSelectedQuizQuestionIds(questions.map(q => q.id));
                  }
                }}
                className="text-xs font-bold text-amber-500 hover:text-amber-600"
              >
                {selectedQuizQuestionIds.length === questions.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
              </button>
            </div>

            <div className="max-h-[460px] overflow-y-auto space-y-2 pr-1">
              {questions.map((q) => {
                const isSelected = selectedQuizQuestionIds.includes(q.id);

                return (
                  <div
                    key={q.id}
                    onClick={() => {
                      setSelectedQuizQuestionIds((prev) =>
                        isSelected ? prev.filter(id => id !== q.id) : [...prev, q.id]
                      );
                    }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500/50 shadow-sm'
                        : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200/60 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="mt-1 accent-amber-500 rounded cursor-pointer"
                    />
                    <div className="flex-1 text-xs text-slate-800 dark:text-slate-200 line-clamp-2">
                      <MathRenderer content={q.questionText} />
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shrink-0">
                      {q.categoryTitle || 'كمي'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </section>
      )}

      {/* ======================================================================= */}
      {/* 4. نافذة إضافة وتعديل سؤال مع معاينة LaTeX الفورية (Live Math Preview) */}
      {/* ======================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative bg-white dark:bg-[#0d1424] rounded-3xl max-w-2xl w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{editingQuestionId ? 'تعديل مسألة كمي' : 'إضافة مسألة كمي جديدة'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">القسم</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    {categories.filter(c => c.id !== 'all').map(c => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">مستوى الصعوبة</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as Difficulty)}
                    className="w-full px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="Easy">سهل (أساسيات)</option>
                    <option value="Medium">متوسط (تجميعات قياس)</option>
                    <option value="Hard">صعب (تحدي نخبوي)</option>
                  </select>
                </div>
              </div>

              {/* نص السؤال */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  نص المسألة (يدعم صيغ LaTeX بين علامات $)
                </label>
                <textarea
                  rows={3}
                  value={formQuestionText}
                  onChange={(e) => setFormQuestionText(e.target.value)}
                  placeholder="مثال: إذا كان $x + y = 10$ و $x - y = 4$ ، فما قيمة $x^2 - y^2$؟"
                  className="w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 font-sans"
                  required
                />
              </div>

              {/* معاينة LaTeX الرياضية الفورية (Live Math Preview) */}
              {formQuestionText && (
                <div className="p-3 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                  <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    <span>معاينة المعادلات الرياضية الفورية (KaTeX Preview):</span>
                  </div>
                  <div className="text-sm text-slate-900 dark:text-white leading-relaxed">
                    <MathRenderer content={formQuestionText} />
                  </div>
                </div>
              )}

              {/* الخيارات الأربعة مع تحديد الصحيح */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  الخيارات الأربعة (حدد زر الخيار الصحيح)
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {formOptions.map((opt, idx) => (
                    <div
                      key={opt.id}
                      className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
                        formCorrectOption === opt.id
                          ? 'bg-emerald-500/10 border-emerald-500/40'
                          : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <input
                        type="radio"
                        name="correctOption"
                        checked={formCorrectOption === opt.id}
                        onChange={() => setFormCorrectOption(opt.id)}
                        className="accent-emerald-500 cursor-pointer"
                        title="تحديد كإجابة صحيحة"
                      />
                      <span className="font-bold font-mono text-slate-500 text-xs">{opt.id}</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const newOpts = [...formOptions];
                          newOpts[idx].text = e.target.value;
                          setFormOptions(newOpts);
                        }}
                        placeholder={`الخيار ${opt.id}`}
                        className="w-full bg-transparent border-none focus:outline-none text-xs text-slate-900 dark:text-white font-medium"
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* طريقة طرقع للحل السريع */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  طريقة طرقع الذكية (استراتيجية الحل الذهني السريع)
                </label>
                <textarea
                  rows={2}
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  placeholder="اشرح كيف يطرقع الطالب السؤال في أقل من 30 ثانية باستخدام التدرج أو التجريب أو فيثاغورس..."
                  className="w-full px-3.5 py-2 rounded-xl border bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold transition"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm transition"
                >
                  {editingQuestionId ? 'حفظ التعديلات' : 'إضافة المسألة'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
