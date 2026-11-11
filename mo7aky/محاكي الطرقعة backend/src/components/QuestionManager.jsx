import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Calculator, Plus, Trash2, Edit3, Save, X, 
  ArrowRight, Check, Search, Download, Upload, Copy, RefreshCw, 
  Sparkles, AlertCircle, FileText, Image as ImageIcon, Layers
} from 'lucide-react';
import { toast } from 'sonner';

export default function QuestionManager({ onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'list', 'json'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'search', 'verbal'
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    question: '',
    type: 'search', // 'search' = كمي, 'verbal' = لفظي
    category: 'قدرات - كمي',
    exam: 'القسم الكمي',
    choices: ['', '', '', ''],
    answer: 0,
    passage: '',
    image_url: ''
  });

  const [hasPassage, setHasPassage] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    let loaded = [];
    try {
      const res = await fetch('/api/shared-questions', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          loaded = data;
        }
      }
    } catch (e) {
      console.warn('Failed to load from /api/shared-questions, falling back to localStorage', e);
    }

    if (loaded.length === 0) {
      try {
        const local = localStorage.getItem('tarqa_simulator_shared_questions');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) loaded = parsed;
        }
      } catch (e) {}
    }

    setQuestions(loaded);
    setJsonInput(JSON.stringify(loaded, null, 2));
    setLoading(false);
  };

  const saveQuestionsToServer = async (newQuestions) => {
    setQuestions(newQuestions);
    setJsonInput(JSON.stringify(newQuestions, null, 2));

    // Save to localStorage
    try {
      localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify(newQuestions));
    } catch (e) {}

    // Save to server
    try {
      const res = await fetch('/api/shared-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuestions)
      });
      if (!res.ok) {
        console.warn('Could not persist to server, saved locally');
      }
    } catch (e) {
      console.warn('Network error saving to /api/shared-questions', e);
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      type: 'search',
      category: 'قدرات - كمي',
      exam: 'القسم الكمي',
      choices: ['', '', '', ''],
      answer: 0,
      passage: '',
      image_url: ''
    });
    setEditingId(null);
    setHasPassage(false);
    setHasImage(false);
  };

  const handleTypeChange = (newType) => {
    setFormData(prev => ({
      ...prev,
      type: newType,
      category: newType === 'search' ? 'قدرات - كمي' : 'قدرات - لفظي',
      exam: prev.exam === 'القسم الكمي' && newType === 'verbal' 
        ? 'القسم اللفظي' 
        : (prev.exam === 'القسم اللفظي' && newType === 'search' ? 'القسم الكمي' : prev.exam)
    }));
  };

  const handleChoiceChange = (index, value) => {
    setFormData(prev => {
      const newChoices = [...prev.choices];
      newChoices[index] = value;
      return { ...prev, choices: newChoices };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question.trim()) {
      toast.error('يرجى كتابة نص السؤال');
      return;
    }

    if (formData.choices.some(c => !c.trim())) {
      toast.error('يرجى ملء جميع الخيارات الأربعة (أ، ب، ج، د)');
      return;
    }

    const questionObj = {
      id: editingId || `tarqa-q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      question: formData.question.trim(),
      type: formData.type,
      category: formData.category,
      exam: formData.exam.trim() || (formData.type === 'search' ? 'القسم الكمي' : 'القسم اللفظي'),
      choices: formData.choices.map(c => c.trim()),
      answer: Number(formData.answer),
      passage: hasPassage && formData.passage.trim() ? formData.passage.trim() : null,
      image_url: hasImage && formData.image_url.trim() ? formData.image_url.trim() : null,
      updated_at: new Date().toISOString()
    };

    let updatedList;
    if (editingId) {
      updatedList = questions.map(q => q.id === editingId ? questionObj : q);
      toast.success('تم تعديل السؤال بنجاح!');
    } else {
      updatedList = [questionObj, ...questions];
      toast.success('تمت إضافة السؤال بنجاح وحفظه!');
    }

    await saveQuestionsToServer(updatedList);
    resetForm();
    setActiveTab('list');
  };

  const handleEdit = (q) => {
    setEditingId(q.id);
    setFormData({
      question: q.question || '',
      type: q.type || 'search',
      category: q.category || (q.type === 'search' ? 'قدرات - كمي' : 'قدرات - لفظي'),
      exam: q.exam || 'القسم الكمي',
      choices: Array.isArray(q.choices) && q.choices.length === 4 ? [...q.choices] : ['', '', '', ''],
      answer: typeof q.answer === 'number' ? q.answer : 0,
      passage: q.passage || '',
      image_url: q.image_url || q.image || ''
    });
    setHasPassage(Boolean(q.passage));
    setHasImage(Boolean(q.image_url || q.image));
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) {
      const updated = questions.filter(q => q.id !== id);
      await saveQuestionsToServer(updated);
      toast.success('تم حذف السؤال.');
    }
  };

  const handleJsonImport = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        toast.error('يجب أن يكون الـ JSON عبارة عن مصفوفة أسئلة [...]');
        return;
      }

      // Format & sanitize questions
      const sanitized = parsed.map((q, idx) => ({
        id: q.id || `tarqa-q-${Date.now()}-${idx}`,
        question: q.question || '',
        type: q.type || (q.category?.includes('لفظي') ? 'verbal' : 'search'),
        category: q.category || (q.type === 'verbal' ? 'قدرات - لفظي' : 'قدرات - كمي'),
        exam: q.exam || 'القسم الكمي',
        choices: Array.isArray(q.choices) ? q.choices : ['أ', 'ب', 'ج', 'د'],
        answer: typeof q.answer === 'number' ? q.answer : 0,
        passage: q.passage || null,
        image_url: q.image_url || q.image || null
      }));

      await saveQuestionsToServer(sanitized);
      toast.success(`تم استيراد ${sanitized.length} سؤال بنجاح!`);
      setActiveTab('list');
    } catch (e) {
      toast.error('صيغة JSON غير صحيحة: ' + e.message);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(questions, null, 2));
    toast.success('تم نسخ الـ JSON إلى الحافظة!');
  };

  const handleAddSampleQuestions = async () => {
    const sampleQuestions = [
      {
        id: `tarqa-sample-1`,
        question: 'إذا كان س + ص = ٨ ، وَ س - ص = ٢ ، فما قيمة س ؟',
        type: 'search',
        category: 'قدرات - كمي',
        exam: 'القسم الكمي',
        choices: ['٥', '٤', '٣', '٦'],
        answer: 0,
        passage: null,
        image_url: null
      },
      {
        id: `tarqa-sample-2`,
        question: 'اشترى محمد ٥ أقلام وَ ٤ دفاتر بمبلغ ٤٠ ريالاً، إذا كان ثمن القلم ٤ ريالات، فما ثمن الدفتر الواحد؟',
        type: 'search',
        category: 'قدرات - كمي',
        exam: 'القسم الكمي',
        choices: ['٥ ريالات', '٤ ريالات', '٦ ريالات', '٣ ريالات'],
        answer: 0,
        passage: null,
        image_url: null
      },
      {
        id: `tarqa-sample-3`,
        question: 'ما العلاقة المشابهة لـ: رئة : تنفس ؟',
        type: 'verbal',
        category: 'قدرات - لفظي',
        exam: 'القسم اللفظي',
        choices: ['عين : رؤية', 'يد : كتابة', 'قلب : نبض', 'أذن : كلام'],
        answer: 0,
        passage: null,
        image_url: null
      },
      {
        id: `tarqa-sample-4`,
        question: 'إكمال الجمل: حسن الخلق يذيب الخطايا كما تذيب الشمس ......',
        type: 'verbal',
        category: 'قدرات - لفظي',
        exam: 'القسم اللفظي',
        choices: ['الجليد', 'الماء', 'الحديد', 'التراب'],
        answer: 0,
        passage: null,
        image_url: null
      }
    ];

    const merged = [...sampleQuestions, ...questions];
    await saveQuestionsToServer(merged);
    toast.success('تمت إضافة ٤ أسئلة قدرات نموذجية!');
  };

  const handleClearAll = async () => {
    if (window.confirm('تحذير: هل أنت متأكد من مسح كافة الأسئلة المحفوظة؟')) {
      await saveQuestionsToServer([]);
      toast.success('تم تفريغ بنك الأسئلة.');
    }
  };

  // Filtered list
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = !searchQuery.trim() || 
      (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.exam && q.exam.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.choices && q.choices.some(c => String(c).includes(searchQuery)));

    const matchesType = filterType === 'all' || q.type === filterType;
    return matchesSearch && matchesType;
  });

  const choiceLabels = ['أ', 'ب', 'ج', 'د'];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 dir-rtl font-sans" dir="rtl">
      {/* Top Bar Header */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">إدارة أسئلة محاكي الطرقعة</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                مربوط بجميع المحاكيات
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              أضف وعدّل الأسئلة لتظهر فورياً في محاكي الطرقعة ومحاكي نمر وتحديد المستوى
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 transition-all text-sm font-bold shadow-md cursor-pointer"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى المحاكي</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'add'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'تعديل السؤال' : 'إضافة سؤال جديد'}</span>
          </button>

          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>قائمة الأسئلة</span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-orange-400 font-black border border-slate-700">
              {questions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>استيراد وتصدير JSON</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>المزامنة التلقائية مفعلة</span>
        </div>
      </div>

      {/* Tab 1: Add / Edit Question Form */}
      {activeTab === 'add' && (
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
              {editingId ? <Edit3 className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-orange-500" />}
              <span>{editingId ? 'تعديل بيانات السؤال' : 'بيانات السؤال الجديد'}</span>
            </h2>
            {editingId && (
              <button
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>إلغاء التعديل</span>
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                نوع القسم
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => handleTypeChange('search')}
                  className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer font-bold ${
                    formData.type === 'search'
                      ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-md shadow-orange-500/10'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Calculator className="w-5 h-5" />
                  <span>القسم الكمي (رياضيات / مسائل)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeChange('verbal')}
                  className={`flex items-center justify-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer font-bold ${
                    formData.type === 'verbal'
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400 shadow-md shadow-cyan-500/10'
                      : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span>القسم اللفظي (تناظر / استيعاب / إكمال)</span>
                </button>
              </div>
            </div>

            {/* Exam / Model Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                اسم النموذج أو الاختبار
              </label>
              <input
                type="text"
                value={formData.exam}
                onChange={(e) => setFormData(prev => ({ ...prev, exam: e.target.value }))}
                placeholder="مثال: القسم الكمي، النموذج الأول، بنك القدرات، تحديد المستوى..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-sm font-medium"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-[11px] text-slate-500 self-center">نماذج سريعة:</span>
                {['القسم الكمي', 'القسم اللفظي', 'تحديد المستوى', 'النموذج الأول', 'بنك أسئلة المحاكي'].map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, exam: item }))}
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition-all border border-slate-700/60"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                نص السؤال <span className="text-orange-500">*</span>
              </label>
              <textarea
                rows={4}
                value={formData.question}
                onChange={(e) => setFormData(prev => ({ ...prev, question: e.target.value }))}
                placeholder="اكتب نص السؤال هنا بدقة وبخط واضح..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 text-sm leading-relaxed"
                required
              />
            </div>

            {/* Optional Passage & Image Toggles */}
            <div className="flex flex-wrap gap-4 pt-2">
              <button
                type="button"
                onClick={() => setHasPassage(!hasPassage)}
                className={`text-xs px-3.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  hasPassage
                    ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>{hasPassage ? 'إلغاء نص القطعة' : '+ إضافة نص قطعة (استيعاب مقروء)'}</span>
              </button>

              <button
                type="button"
                onClick={() => setHasImage(!hasImage)}
                className={`text-xs px-3.5 py-2 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                  hasImage
                    ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                    : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>{hasImage ? 'إلغاء صورة السؤال' : '+ إضافة رابط صورة للسؤال'}</span>
              </button>
            </div>

            {/* Optional Passage Box */}
            {hasPassage && (
              <div className="p-4 bg-slate-950 border border-cyan-500/30 rounded-xl space-y-2 animate-fadeIn">
                <label className="block text-xs font-bold text-cyan-400">
                  نص القطعة (استيعاب المقروء)
                </label>
                <textarea
                  rows={4}
                  value={formData.passage}
                  onChange={(e) => setFormData(prev => ({ ...prev, passage: e.target.value }))}
                  placeholder="أدخل نص المقال أو القطعة هنا..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 text-xs leading-relaxed"
                />
              </div>
            )}

            {/* Optional Image URL Box */}
            {hasImage && (
              <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-3 animate-fadeIn">
                <label className="block text-xs font-bold text-amber-400">
                  رابط صورة السؤال (Image URL)
                </label>
                <input
                  type="text"
                  value={formData.image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                  placeholder="https://example.com/question-diagram.png أو مسار نسبي..."
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 text-xs"
                />
                {formData.image_url && (
                  <div className="mt-2 p-2 bg-slate-900/60 rounded-lg border border-slate-800 max-w-xs">
                    <p className="text-[10px] text-slate-400 mb-1">معاينة الصورة:</p>
                    <img
                      src={formData.image_url}
                      alt="معاينة"
                      className="max-h-32 object-contain rounded"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* 4 Choices with Correct Answer Radio */}
            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                الخيارات الأربعة وحدد الإجابة الصحيحة بالضغط على الرمز <span className="text-orange-500">*</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {choiceLabels.map((label, idx) => {
                  const isCorrect = formData.answer === idx;
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-3 p-2.5 rounded-xl border-2 transition-all ${
                        isCorrect
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, answer: idx }))}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm shrink-0 transition-all cursor-pointer ${
                          isCorrect
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                        title="انقر لتحديد هذا الخيار كإجابة صحيحة"
                      >
                        {isCorrect ? <Check className="w-5 h-5 stroke-[3]" /> : label}
                      </button>

                      <input
                        type="text"
                        value={formData.choices[idx]}
                        onChange={(e) => handleChoiceChange(idx, e.target.value)}
                        placeholder={`الخيار (${label})`}
                        className="w-full bg-transparent text-white text-sm focus:outline-none placeholder-slate-600 font-medium"
                        required
                      />

                      {isCorrect && (
                        <span className="text-[11px] font-bold text-emerald-400 shrink-0 px-2 py-0.5 rounded bg-emerald-500/20">
                          الإجابة الصحيحة
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="flex-1 py-3 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-base shadow-lg shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                <span>{editingId ? 'حفظ التعديلات' : 'حفظ السؤال الآن'}</span>
              </button>

              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all cursor-pointer"
              >
                مسح الحقول
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Questions List */}
      {activeTab === 'list' && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Controls: Search & Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute right-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث في الأسئلة أو النماذج..."
                className="w-full pr-10 pl-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setFilterType('all')}
                className={`text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer transition-all ${
                  filterType === 'all'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                الكل ({questions.length})
              </button>
              <button
                onClick={() => setFilterType('search')}
                className={`text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer transition-all ${
                  filterType === 'search'
                    ? 'bg-orange-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                كمي ({questions.filter(q => q.type === 'search').length})
              </button>
              <button
                onClick={() => setFilterType('verbal')}
                className={`text-xs px-3.5 py-2 rounded-xl font-bold cursor-pointer transition-all ${
                  filterType === 'verbal'
                    ? 'bg-cyan-500 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                لفظي ({questions.filter(q => q.type === 'verbal').length})
              </button>
            </div>
          </div>

          {/* Questions Grid / Empty State */}
          {filteredQuestions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-slate-900/60 border border-slate-800 rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-500">
                <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-300 mb-2">لا توجد أسئلة حالياً</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                لم تقم بإضافة أي أسئلة بعد. يمكنك إضافة سؤال جديد أو استيراد أسئلة عبر JSON أو إضافة أسئلة نموذجية.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setActiveTab('add')}
                  className="px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة سؤال جديد</span>
                </button>
                <button
                  onClick={handleAddSampleQuestions}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>إضافة ٤ أسئلة قدرات نموذجية للبدء</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredQuestions.map((q, index) => {
                const isVerbal = q.type === 'verbal';
                return (
                  <div
                    key={q.id || index}
                    className="p-5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all shadow-md space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-xs text-slate-300">
                          #{index + 1}
                        </span>
                        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          isVerbal 
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' 
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {isVerbal ? 'القسم اللفظي' : 'القسم الكمي'}
                        </span>
                        <span className="text-[11px] text-slate-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                          {q.exam || 'القسم العام'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(q)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                          title="تعديل السؤال"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(q.id)}
                          className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all cursor-pointer"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Passage preview if available */}
                    {q.passage && (
                      <div className="p-3 bg-slate-950 border border-cyan-500/20 rounded-xl text-xs text-cyan-200/90 leading-relaxed">
                        <span className="font-bold text-cyan-400 block mb-1">القطعة:</span>
                        {q.passage}
                      </div>
                    )}

                    {/* Question text */}
                    <p className="text-base font-bold text-white leading-relaxed">
                      {q.question}
                    </p>

                    {/* Question image if available */}
                    {(q.image_url || q.image) && (
                      <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 max-w-sm">
                        <img
                          src={q.image_url || q.image}
                          alt="صورة السؤال"
                          className="max-h-48 object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {/* Choices Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
                      {choiceLabels.map((lbl, cIdx) => {
                        const isCorrect = q.answer === cIdx;
                        const choiceText = q.choices?.[cIdx] || '';
                        return (
                          <div
                            key={lbl}
                            className={`flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium border ${
                              isCorrect
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                : 'bg-slate-950/50 border-slate-800/80 text-slate-300'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-400'
                            }`}>
                              {lbl}
                            </span>
                            <span className="truncate">{choiceText}</span>
                            {isCorrect && (
                              <span className="text-[10px] text-emerald-400 mr-auto font-bold">
                                ✓ الصحيحة
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: JSON Import / Export */}
      {activeTab === 'json' && (
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-500" />
                <span>استيراد وتصدير الأسئلة دفعة واحدة (JSON)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                يمكنك نسخ كامل بنك الأسئلة أو لصق أسئلة جاهزة بصيغة JSON
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer border border-slate-700"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الـ JSON</span>
              </button>
            </div>
          </div>

          <div>
            <textarea
              rows={14}
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="الصق مصفوفة الأسئلة هنا كـ JSON [...]"
              className="w-full p-4 bg-slate-950 border border-slate-800 rounded-xl text-emerald-400 font-mono text-xs focus:outline-none focus:border-orange-500 leading-relaxed"
              dir="ltr"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              onClick={handleJsonImport}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-black text-sm shadow-lg shadow-orange-500/20 cursor-pointer transition-all"
            >
              <Save className="w-4 h-4" />
              <span>استيراد وتحديث بنك الأسئلة الآن</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleAddSampleQuestions}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>إضافة نماذج قدرات تجريبية</span>
              </button>

              <button
                onClick={handleClearAll}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold transition-all cursor-pointer border border-red-500/20"
              >
                <Trash2 className="w-4 h-4" />
                <span>مسح كافة الأسئلة</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
