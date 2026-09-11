import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Terminal,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { Question, Category, OptionId, Difficulty, QuizMode } from '../types';
import { rolesService } from '../lib/rolesService';
import { localScoreStorage } from '../lib/supabase';
import {
  getAntiHackSettings,
  saveAntiHackSettings,
  getSecurityViolations,
  clearSecurityViolations,
  logSecurityViolation,
  AntiHackSettings,
  SecurityViolation
} from '../lib/antiHack';

interface AdminPanelProps {
  questions: Question[];
  categories: Category[];
  onAddQuestion: (newQuestion: Question) => void;
  onUpdateQuestion: (updated: Question) => void;
  onDeleteQuestion: (id: string) => void;
  onResetDefaultQuestions?: () => void;
  onSyncCloud?: () => Promise<void>;
  onCreateQuiz?: (quizData: any) => void;
  onDeleteQuiz?: (quizId: string) => void;
  quizzes?: any[];
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  questions,
  categories,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onResetDefaultQuestions,
  onSyncCloud,
  onCreateQuiz,
  onDeleteQuiz,
  quizzes = [],
}) => {
  const [activeTab, setActiveTab] = useState<'questions' | 'quizBuilder' | 'security'>('questions');

  // إعدادات وسجلات درع الأمان (Anti-Hack Shield)
  const [securitySettings, setSecuritySettings] = useState<AntiHackSettings>(() => getAntiHackSettings());
  const [securityLogs, setSecurityLogs] = useState<SecurityViolation[]>(() => getSecurityViolations());

  const handleToggleSecuritySetting = (key: keyof AntiHackSettings) => {
    const nextVal = !securitySettings[key];
    const updated = saveAntiHackSettings({ [key]: nextVal });
    setSecuritySettings(updated);
    showToast(`تم ${nextVal ? 'تفعيل' : 'تعطيل'} الإعداد الأمني بنجاح! 🛡️`, 'info');
  };

  const handleUpdateMaxTabSwitches = (count: number) => {
    const updated = saveAntiHackSettings({ maxExamTabSwitches: count });
    setSecuritySettings(updated);
    showToast(`تم تحديث الحد الأقصى لمخالفات الاختبار إلى (${count}) مرات.`, 'info');
  };

  const handleClearLogs = () => {
    if (window.confirm('هل تريد مسح سجل المخالفات الأمنية بالكامل؟')) {
      clearSecurityViolations();
      setSecurityLogs([]);
      showToast('تم مسح سجل المخالفات الأمنية بنجاح.', 'info');
    }
  };

  const handleSimulateAlert = () => {
    logSecurityViolation({
      userId: 'TEST-ADMIN',
      userName: 'فحص تجريبي',
      type: 'devtools_attempt',
      details: 'فحص تجريبي لنظام الإنذار الأمني من لوحة الإدارة',
    });
    setSecurityLogs(getSecurityViolations());
    showToast('تم إطلاق تنبيه أمني تجريبي وتسجيله في النظام! 🚨', 'success');
  };

  // رسائل التنبيه التفاعلية
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

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

  // إحصائيات المنصة الحقيقية 100%
  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    totalAttempts: 0,
    todayAttempts: 0,
    averageScore: 0,
    hasScores: false,
  });

  useEffect(() => {
    const loadRealStats = async () => {
      try {
        const users = await rolesService.getUsers();
        const storedAttempts = localScoreStorage.getAttempts();
        const realAttempts = Array.isArray(storedAttempts) 
          ? storedAttempts.filter((a: any) => !['att-1', 'att-2', 'att-3', 'att-4'].includes(a.id))
          : [];

        const todayStr = new Date().toISOString().split('T')[0];
        const todayAttempts = realAttempts.filter((a: any) => {
          const d = a.completed_at ? new Date(a.completed_at).toISOString().split('T')[0] : '';
          return d === todayStr;
        });

        const scores = realAttempts.map((a: any) => Number(a.score) || 0);
        const avg = scores.length > 0
          ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
          : 0;

        setPlatformStats({
          totalUsers: users.length,
          studentsCount: users.filter((u) => u.role === 'student').length,
          totalAttempts: realAttempts.length,
          todayAttempts: todayAttempts.length,
          averageScore: avg,
          hasScores: scores.length > 0,
        });
      } catch (err) {
        console.warn('Failed to load real stats in AdminPanel:', err);
      }
    };

    loadRealStats();

    const handleDataChanged = () => {
      loadRealStats();
    };

    window.addEventListener('tarqa_roles_changed', handleDataChanged);
    window.addEventListener('tarqa_user_changed', handleDataChanged);
    return () => {
      window.removeEventListener('tarqa_roles_changed', handleDataChanged);
      window.removeEventListener('tarqa_user_changed', handleDataChanged);
    };
  }, []);

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
      showToast('تم تحديث السؤال بنجاح وحفظه سحابياً ومحلياً! ✅', 'success');
    } else {
      onAddQuestion(questionData);
      showToast('تمت إضافة السؤال بنجاح وحفظه سحابياً ومحلياً! ✅', 'success');
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
      showToast('تم إنشاء ونشر الاختبار بنجاح وحفظه سحابياً! 🎯', 'success');
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

      {/* تنبيه الإجراء الفوري (Toast Notification) */}
      {toast && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : toast.type === 'error'
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 1. إحصائيات المنصة الشاملة (Platform Overview Cards) */}
      {/* ======================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">المستخدمون المسجلون</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{platformStats.totalUsers}</div>
            <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
              {platformStats.studentsCount > 0 ? `${platformStats.studentsCount} طالب مسجل` : 'بيانات حقيقية موثقة'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-lg">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">إجمالي بنك الأسئلة</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{questions.length}</div>
            <span className="text-[11px] text-blue-500 font-bold">
              مقسمة على {categories.filter(c => c.id !== 'all').length} أقسام كمي
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
            <CheckSquare className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">المحاولات المكتملة</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{platformStats.totalAttempts}</div>
            <span className="text-[11px] text-emerald-500 font-bold">
              {platformStats.todayAttempts > 0 ? `${platformStats.todayAttempts} محاولة اليوم` : 'سجل الاختبارات الفعلي'}
            </span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium">متوسط الدرجات</span>
            <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
              {platformStats.hasScores ? `${platformStats.averageScore}%` : '--'}
            </div>
            <span className="text-[11px] text-amber-500 font-bold">
              {platformStats.hasScores ? `بناءً على ${platformStats.totalAttempts} اختبار` : 'لا توجد اختبارات مسجلة بعد'}
            </span>
          </div>
        </div>

      </section>

      {/* ======================================================================= */}
      {/* تبويبات الإدارة (Bank Manager / Quiz Builder) */}
      {/* ======================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
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
            <span>منشئ الاختبارات المخصصة {quizzes.length > 0 && `(${quizzes.length})`}</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'security'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>درع الحماية ومكافحة الاختراق (Anti-Hack Shield)</span>
          </button>
        </div>

        {activeTab === 'questions' && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>متزامن سحابياً مع كافة الطلاب (Supabase Live)</span>
            </span>

            {onSyncCloud && (
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  try {
                    await onSyncCloud();
                    showToast('تمت المزامنة السحابية الفورية مع كافة الطلاب بنجاح! ☁️', 'success');
                  } catch {
                    showToast('تعذر إكمال النشر السحابي، تأكد من الاتصال بالإنترنت.', 'error');
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/30 font-bold text-xs transition active:scale-95 disabled:opacity-50"
                title="مزامنة وتأكيد حفظ بنك الأسئلة على السحابة"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSyncing ? 'جاري النشر...' : 'نشر سحابي مباشر ☁️'}</span>
              </button>
            )}

            {onResetDefaultQuestions && (
              <button
                onClick={() => {
                  if (window.confirm('هل تريد استعادة بنك الأسئلة الافتراضي للنموذج الأولي؟ سيتم حذف التعديلات وإعادتها للأصل.')) {
                    onResetDefaultQuestions();
                    showToast('تمت استعادة بنك الأسئلة الافتراضي بنجاح! 🔄', 'info');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-500 text-xs font-bold transition active:scale-95"
                title="استعادة بنك الأسئلة الافتراضي"
              >
                <span>استعادة الافتراضي 🔄</span>
              </button>
            )}

            <button
              onClick={handleOpenAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة سؤال جديد</span>
            </button>
          </div>
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

          {/* جدول الأسئلة للشاشات المتوسطة والكبيرة */}
          <div className="overflow-x-auto hidden md:block">
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
                          onClick={() => {
                            if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا السؤال نهائياً من بنك الأسئلة؟')) {
                              onDeleteQuestion(q.id);
                              showToast('تم حذف السؤال بنجاح وتحديث السحابة! 🗑️', 'info');
                            }
                          }}
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

          {/* عرض الأسئلة على الهواتف الذكية (Mobile Question Cards) */}
          <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredQuestions.map((q, idx) => (
              <div key={q.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                    #{idx + 1}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      {q.categoryTitle || q.categoryId}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        q.difficulty === 'Easy'
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : q.difficulty === 'Medium'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-rose-500/10 text-rose-500'
                      }`}
                    >
                      {q.difficulty === 'Easy' ? 'سهل' : q.difficulty === 'Medium' ? 'متوسط' : 'صعب'}
                    </span>
                  </div>
                </div>

                {/* نص المسألة والمعادلة */}
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                  <MathRenderer content={q.questionText} />
                </div>

                {/* الإجابة والمصدر والإجراءات */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400">الإجابة:</span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black font-mono text-xs">
                      {q.correctOption}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">({q.source || 'تجميعات 1446'})</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(q)}
                      className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition active:scale-95"
                      title="تعديل السؤال"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('هل أنت متأكد من رغبتك في حذف هذا السؤال نهائياً من بنك الأسئلة؟')) {
                          onDeleteQuestion(q.id);
                          showToast('تم حذف السؤال بنجاح وتحديث السحابة! 🗑️', 'info');
                        }
                      }}
                      className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition active:scale-95"
                      title="حذف السؤال"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
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
                className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-slate-950 font-black text-xs shadow-sm transition flex items-center justify-center gap-2 active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>إنشاء ونشر الاختبار للطلاب</span>
              </button>
            </form>

            {/* قائمة الاختبارات المنشأة مسبقاً */}
            {quizzes && quizzes.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>الاختبارات المنشأة سحابياً ({quizzes.length})</span>
                  </h3>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {quiz.title}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="text-amber-500 font-bold">
                            {quiz.questionIds?.length || 0} أسئلة
                          </span>
                          <span>•</span>
                          <span>{quiz.durationMinutes} دقيقة</span>
                          <span>•</span>
                          <span className="text-slate-500">
                            {quiz.type === 'Mock_Exam' ? 'محاكي قياس' : quiz.type === 'Speed_Challenge' ? 'تحدي سرعة' : 'تدريب'}
                          </span>
                        </div>
                      </div>

                      {onDeleteQuiz && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`هل أنت متأكد من حذف اختبار "${quiz.title}"؟`)) {
                              onDeleteQuiz(quiz.id);
                              showToast('تم حذف الاختبار بنجاح وتحديث السحابة! 🗑️', 'info');
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                          title="حذف الاختبار"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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
      {/* 3. درع الحماية ومكافحة الاختراق (Anti-Hack Shield Management Section) */}
      {/* ======================================================================= */}
      {activeTab === 'security' && (
        <section className="space-y-6">
          
          {/* بطاقة الحالة الرئيسية لدرع الحماية */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-amber-500/30 shadow-2xl relative overflow-hidden text-white">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20">
                  <ShieldCheck className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-black text-white">درع طرقع الأمني ومكافحة الاختراق</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      نشط ومراقب (Shield Core v3.0)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
                    نظام أمني متكامل لحماية بنك الأسئلة من التسريب، حظر أدوات المطورين والفحص (DevTools)، منع نسخ الأسئلة والمذكرات، كشف محاولات الغش بمغادرة شاشة الاختبار، وحماية جلسات المستخدمين من التلاعب.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSimulateAlert}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition active:scale-95 flex items-center gap-2 cursor-pointer"
                  title="إطلاق تنبيه تجريبي لفحص النظام"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>فحص الإنذار التجريبي 🚨</span>
                </button>
              </div>
            </div>

            {/* مؤشرات حية سريعة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">فحص العناصر (DevTools)</span>
                <span className={`text-xs font-bold ${securitySettings.blockDevTools ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {securitySettings.blockDevTools ? 'محظور تماماً ✅' : 'معطل ⚠️'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">نسخ الأسئلة وتحديدها</span>
                <span className={`text-xs font-bold ${securitySettings.blockCopyCut ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {securitySettings.blockCopyCut ? 'محمي من النسخ ✅' : 'متاح ⚠️'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">رصد مغادرة الاختبار</span>
                <span className={`text-xs font-bold ${securitySettings.detectTabSwitch ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {securitySettings.detectTabSwitch ? `نشط (${securitySettings.maxExamTabSwitches} مخالفات)` : 'معطل ⚠️'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">إجمالي المخالفات المرصودة</span>
                <span className="text-xs font-bold text-amber-400 font-mono">
                  {securityLogs.length} مخالفة مسجلة
                </span>
              </div>
            </div>
          </div>

          {/* لوحة تحكم مفاتيح الحماية والتبديل (Security Modules Toggles) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>إعدادات وحدات الأمان ومكافحة الاختراق</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 1. حظر DevTools والفحص */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">حظر أدوات المطورين (F12)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockDevTools')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockDevTools ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockDevTools ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يعطل مفاتيح F12 و Ctrl+Shift+I و Ctrl+Shift+J و Ctrl+U لمنع فحص العناصر وسرقة نصوص الأسئلة.
                  </p>
                </div>
              </div>

              {/* 2. حظر القائمة المنسدلة للزر الأيمن */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">تعطيل الزر الأيمن (Context Menu)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockContextMenu')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockContextMenu ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockContextMenu ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يمنع فتح قائمة الفحص وحفظ الصور بالفأرة في كافة صفحات المنصة مع استثناء حقول الإدخال.
                  </p>
                </div>
              </div>

              {/* 3. منع النسخ والقص */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">حظر نسخ وتحديد المحتوى</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockCopyCut')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockCopyCut ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockCopyCut ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يعطل اختصارات النسخ Ctrl+C وتحديد نصوص الأسئلة وخيارات الاختبار والمذكرات لحمايتها من السرقة.
                  </p>
                </div>
              </div>

              {/* 4. مكافحة لقطات الشاشة */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">إحباط لقطات الشاشة (PrintScreen)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockPrintScreen')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockPrintScreen ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockPrintScreen ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يمسح حافظة الجهاز فوراً عند ضغط زر تصوير الشاشة PrintScreen لمنع تسريب أسئلة قياس على تيليجرام.
                  </p>
                </div>
              </div>

              {/* 5. رصد مغادرة الاختبار */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">كشف مغادرة شاشة الاختبار (Tab-Switch)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('detectTabSwitch')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.detectTabSwitch ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.detectTabSwitch ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يرصد خروج الطالب من صفحة الاختبار للبحث في جوجل أو استخدام روبوتات الذكاء الاصطناعي مع إنذار فوري.
                  </p>
                </div>
              </div>

              {/* 6. السحب التلقائي للاختبار عند الغش */}
              <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">سحب الاختبار آلياً عند تكرار الغش</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('autoSubmitOnCheat')}
                      className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.autoSubmitOnCheat ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.autoSubmitOnCheat ? 'left-6' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    يقوم بإنهاء وتسليم الاختبار تلقائياً بعد استنفاد الطالب للحد الأقصى من مخالفات مغادرة النافذة.
                  </p>
                </div>
              </div>

            </div>

            {/* إعدادات الصرامة للمخالفات */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white mb-0.5">
                  الحد الأقصى المسموح به لمغادرة شاشة الاختبار قبل الإلغاء:
                </span>
                <span className="text-[11px] text-slate-500">
                  عدد الإنذارات التي تظهر للطالب قبل سحب ورقة الإجابة التلقائي.
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                {[1, 2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleUpdateMaxTabSwitches(cnt)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                      securitySettings.maxExamTabSwitches === cnt
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cnt} {cnt === 1 ? 'محاولة (صارم)' : cnt === 3 ? 'محاولات (قياسي)' : 'محاولات'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* سجل المخالفات الأمنية الفعلي (Live Security Audit Log) */}
          <div className="p-6 rounded-3xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  سجل المخالفات الأمنية المرصودة لحظياً ({securityLogs.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSecurityLogs(getSecurityViolations())}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث السجل</span>
                </button>

                {securityLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold transition cursor-pointer"
                  >
                    تفريغ السجل
                  </button>
                )}
              </div>
            </div>

            {securityLogs.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-80" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  سجل الأمان نظيف تماماً!
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  لم يتم رصد أي محاولات اختراق أو فحص لعناصر المنصة أو غش في الاختبارات حتى الآن.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                      <th className="pb-2 font-bold">الوقت والتاريخ</th>
                      <th className="pb-2 font-bold">نوع المخالفة</th>
                      <th className="pb-2 font-bold">المستخدم</th>
                      <th className="pb-2 font-bold">تفاصيل المحاولة المرصودة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {securityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition">
                        <td className="py-2.5 font-mono text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('ar-SA')} - {new Date(log.timestamp).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.type === 'devtools_attempt'
                              ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                              : log.type === 'tab_switch'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : log.type === 'storage_tamper'
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-500 border border-blue-500/30'
                          }`}>
                            {log.type === 'devtools_attempt' && 'محاولة فتح DevTools 🛠️'}
                            {log.type === 'tab_switch' && 'مغادرة الاختبار (Tab Switch) 🔄'}
                            {log.type === 'copy_attempt' && 'محاولة نسخ محتوى 📋'}
                            {log.type === 'screenshot_attempt' && 'لقطة شاشة PrintScreen 📸'}
                            {log.type === 'storage_tamper' && 'تلاعب ببيانات الحساب 🚨'}
                            {log.type === 'right_click' && 'زر أيمن محظور 🖱️'}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-slate-900 dark:text-slate-200">
                          {log.userName}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            #{log.userId.slice(0, 10)}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600 dark:text-slate-300 font-medium">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
