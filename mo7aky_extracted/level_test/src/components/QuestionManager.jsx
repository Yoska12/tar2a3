import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, Calculator, Plus, Trash2, Edit3, Save, X, 
  ArrowRight, Check, Search, Download, Upload, Copy, RefreshCw, 
  Sparkles, AlertCircle, FileText, Image as ImageIcon, Layers,
  FileUp, Eye, CheckCircle2, ChevronDown, HelpCircle, ZoomIn, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// Helper: Compress and resize image file to base64 jpeg
const compressImageFile = (file, maxWidth = 1200, quality = 0.80) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper: Dynamically load PDF.js reliably
const loadPdfJs = async () => {
  if (window.pdfjsLib) return window.pdfjsLib;

  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (window.pdfjsLib) return resolve(window.pdfjsLib);
      existing.addEventListener('load', () => resolve(window.pdfjsLib));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(window.pdfjsLib);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  const candidateUrls = [
    '/vendor/pdfjs/pdf.min.js',
    './vendor/pdfjs/pdf.min.js',
    '../vendor/pdfjs/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
  ];

  for (const src of candidateUrls) {
    try {
      await loadScript(src);
      if (window.pdfjsLib) break;
    } catch (e) {
      console.warn('Could not load PDF.js from', src);
    }
  }

  if (window.pdfjsLib) {
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = `${window.location.origin}/vendor/pdfjs/pdf.worker.min.js`;
    } catch (err) {}
    return window.pdfjsLib;
  }
  throw new Error('تعذر تحميل محرك قراءة ملفات الـ PDF');
};

export default function QuestionManager({ onBack }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('add'); // 'add', 'pdf', 'list', 'json'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'search', 'verbal'
  const [filterExam, setFilterExam] = useState('all');
  const [editingId, setEditingId] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);

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
  const [imageUploading, setImageUploading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  // PDF Import state
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfExamName, setPdfExamName] = useState('');
  const [pdfType, setPdfType] = useState('search');
  const [pdfCategory, setPdfCategory] = useState('قدرات - كمي');
  const [pdfProcessing, setPdfProcessing] = useState(false);
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [extractedPdfQuestions, setExtractedPdfQuestions] = useState([]);
  const pdfInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Load questions on mount
  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    setLoading(true);
    let loaded = null;

    const endpoints = [
      '/api_banks.php?action=get_bank_questions&bank=search',
      '/api/shared-questions.php',
      '/api/shared-questions',
      '../api_banks.php?action=get_bank_questions&bank=search'
    ];

    for (const url of endpoints) {
      try {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}_t=${Date.now()}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            loaded = data;
            break;
          }
        }
      } catch (e) {}
    }

    if (loaded !== null) {
      // Server returned valid response (even if empty [])
      setQuestions(loaded);
      setJsonInput(JSON.stringify(loaded, null, 2));
      try {
        localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify(loaded));
      } catch (e) {}
    } else {
      // Only fallback to localStorage if network call failed completely
      try {
        const local = localStorage.getItem('tarqa_simulator_shared_questions');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            setQuestions(parsed);
            setJsonInput(JSON.stringify(parsed, null, 2));
          }
        }
      } catch (e) {}
    }

    setLoading(false);
  };

  const saveQuestionsToServer = async (newQuestions) => {
    const endpoints = [
      '/api_banks.php?action=save_questions',
      '/api/shared-questions.php',
      '/api/shared-questions',
      '../api_banks.php?action=save_questions'
    ];

    let savedOnServer = false;
    let serverResponse = null;
    let lastError = null;

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newQuestions)
        });

        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success) {
            savedOnServer = true;
            serverResponse = data;
            break;
          }
        } else {
          const errData = await res.json().catch(() => null);
          if (errData && errData.error) {
            lastError = new Error(errData.error);
          }
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (savedOnServer) {
      setQuestions(newQuestions);
      setJsonInput(JSON.stringify(newQuestions, null, 2));
      try {
        localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify(newQuestions));
      } catch (e) {}
      toast.success(serverResponse?.message || `تم حفظ ${newQuestions.length} سؤال بنجاح!`, {
        duration: 4000
      });
      return { success: true, count: newQuestions.length };
    } else {
      const msg = lastError?.message || 'تعذر الاتصال بالسيرفر أو تجاوز حجم الملف الحد المسموح';
      toast.error(`❌ فشل الحفظ على السيرفر: ${msg}`, { duration: 6000 });
      alert(`❌ فشل حفظ التغييرات على السيرفر!\nالسبب: ${msg}\nيرجى المحاولة مرة أخرى أو التحقق من حجم الملف.`);
      return { success: false, error: msg };
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

  // Handle single question image upload
  const handleSingleImageFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    try {
      setImageUploading(true);
      const dataUrl = await compressImageFile(file, 1200, 0.80);
      setFormData(prev => ({ ...prev, image_url: dataUrl }));
      setHasImage(true);
      toast.success('تم رفع الصورة وضغطها بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء قراءة الصورة');
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.question.trim() && !formData.image_url) {
      toast.error('يرجى كتابة نص السؤال أو إرفاق صورة للسؤال');
      return;
    }

    if (formData.choices.some(c => !c.trim())) {
      toast.error('يرجى ملء جميع الخيارات الأربعة (أ، ب، ج، د)');
      return;
    }

    const questionObj = {
      id: editingId || `tarqa-q-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      question: formData.question.trim() || 'اختر الإجابة الصحيحة بناءً على الصورة أعلاه',
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
      updatedList = questions.map(q => (q.id === editingId ? questionObj : q));
    } else {
      updatedList = [questionObj, ...questions];
    }

    setSaving(true);
    const result = await saveQuestionsToServer(updatedList);
    setSaving(false);

    if (result.success) {
      alert(editingId ? '✅ تم حفظ تعديلات السؤال بنجاح على السيرفر!' : '✅ تم إضافة السؤال وحفظه بنجاح على السيرفر!');
      resetForm();
      setActiveTab('list');
    }
  };

  const handleEdit = (q) => {
    setEditingId(q.id);
    setFormData({
      question: q.question || '',
      type: q.type || 'search',
      category: q.category || 'قدرات - كمي',
      exam: q.exam || 'القسم الكمي',
      choices: Array.isArray(q.choices) && q.choices.length === 4 ? [...q.choices] : ['أ', 'ب', 'ج', 'د'],
      answer: typeof q.answer === 'number' ? q.answer : 0,
      passage: q.passage || '',
      image_url: q.image_url || q.image || ''
    });
    setHasPassage(!!q.passage);
    setHasImage(!!(q.image_url || q.image));
    setActiveTab('add');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا السؤال نهائياً؟')) {
      return;
    }
    const updatedList = questions.filter(q => q.id !== id);
    setSaving(true);
    const result = await saveQuestionsToServer(updatedList);
    setSaving(false);

    if (result.success) {
      alert('✅ تم حذف السؤال بنجاح وتحديث السيرفر.');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('تحذير شديد: هل أنت متأكد من تفريغ ومسح كافة الأسئلة في بنك الأسئلة بالكامل؟')) {
      return;
    }
    setSaving(true);
    const result = await saveQuestionsToServer([]);
    setSaving(false);

    if (result.success) {
      try {
        localStorage.removeItem('tarqa_simulator_shared_questions');
        localStorage.setItem('tarqa_simulator_shared_questions', JSON.stringify([]));
      } catch (e) {}
      setQuestions([]);
      setJsonInput('[]');
      alert('✅ تم تفريغ ومسح كافة الأسئلة من بنك الأسئلة والسيرفر بنجاح!');
    }
  };

  // Handle PDF file selection
  const handlePdfSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('يرجى اختيار ملف بصيغة PDF فقط');
      return;
    }

    setPdfFile(file);
    const baseName = file.name.replace(/\.pdf$/i, '');
    setPdfFileName(file.name);
    if (!pdfExamName) {
      setPdfExamName(baseName);
    }
    setExtractedPdfQuestions([]);
  };

  // Convert PDF pages to JPG images and create questions
  const handleProcessPdf = async () => {
    if (!pdfFile) {
      toast.error('يرجى اختيار ملف PDF أولاً');
      return;
    }

    try {
      setPdfProcessing(true);
      setPdfProgress({ current: 0, total: 0 });

      const pdfjs = await loadPdfJs();
      const arrayBuffer = await pdfFile.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = pdf.numPages;

      if (numPages === 0) {
        toast.error('الملف فارغ أو لا يحتوي على صفحات');
        setPdfProcessing(false);
        return;
      }

      setPdfProgress({ current: 0, total: numPages });
      const createdQuestions = [];
      const examTitle = pdfExamName.trim() || pdfFile.name.replace(/\.pdf$/i, '') || 'نموذج مستورد من PDF';

      for (let i = 1; i <= numPages; i++) {
        setPdfProgress({ current: i, total: numPages });
        const page = await pdf.getPage(i);
        
        // Scale 1.25 gives sharp text while keeping each page ~40-60KB
        const viewport = page.getViewport({ scale: 1.25 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        // Solid white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({ canvasContext: ctx, viewport }).promise;
        const pageDataUrl = canvas.toDataURL('image/jpeg', 0.80);

        createdQuestions.push({
          id: `tarqa-pdf-${Date.now()}-p${i}`,
          pageNumber: i,
          question: `سؤال صفحة (${i})`,
          type: pdfType,
          category: pdfCategory,
          exam: examTitle,
          choices: ['أ', 'ب', 'ج', 'د'],
          answer: 0,
          passage: null,
          image_url: pageDataUrl,
          updated_at: new Date().toISOString()
        });
      }

      setExtractedPdfQuestions(createdQuestions);
      toast.success(`تم استخراج ${createdQuestions.length} سؤال بنجاح! راجع الإجابات ثم اضغط زر "اعتماد وحفظ".`);
    } catch (err) {
      console.error('PDF Processing Error:', err);
      const msg = err.message || err;
      alert(`❌ فشل معالجة ملف الـ PDF: ${msg}`);
      toast.error(`حدث خطأ أثناء معالجة ملف الـ PDF: ${msg}`);
    } finally {
      setPdfProcessing(false);
    }
  };

  // Change answer for an extracted question
  const handleSetExtractedAnswer = (index, ansIndex) => {
    setExtractedPdfQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], answer: ansIndex };
      return copy;
    });
  };

  // Delete an extracted question before saving
  const handleDeleteExtracted = (index) => {
    setExtractedPdfQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Save extracted PDF questions to bank
  const handleSaveExtractedToBank = async () => {
    if (extractedPdfQuestions.length === 0) {
      toast.error('لا توجد أسئلة مستخرجة لحفظها');
      return;
    }

    setSaving(true);
    const merged = [...extractedPdfQuestions, ...questions];
    const result = await saveQuestionsToServer(merged);
    setSaving(false);

    if (result.success) {
      alert(`✅ تم الحفظ بنجاح! تمت إضافة ${extractedPdfQuestions.length} سؤال إلى بنك الأسئلة والسيرفر.`);
      setExtractedPdfQuestions([]);
      setPdfFile(null);
      setPdfFileName('');
      if (pdfInputRef.current) pdfInputRef.current.value = '';
      setActiveTab('list');
    }
  };

  // JSON handling
  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(jsonInput);
      if (!Array.isArray(parsed)) {
        toast.error('صيغة JSON غير صحيحة: يجب أن يكون مصفوفة أسئلة [...]');
        return;
      }

      const sanitized = parsed.map((q, idx) => ({
        id: q.id || `tarqa-q-${Date.now()}-${idx}`,
        question: q.question || '',
        type: q.type || (q.category?.includes('لفظي') ? 'verbal' : 'search'),
        category: q.category || (q.type === 'verbal' ? 'قدرات - لفظي' : 'قدرات - كمي'),
        exam: q.exam || 'القسم الكمي',
        choices: Array.isArray(q.choices) && q.choices.length === 4 ? q.choices : ['أ', 'ب', 'ج', 'د'],
        answer: typeof q.answer === 'number' ? q.answer : 0,
        passage: q.passage || null,
        image_url: q.image_url || q.image || null,
        updated_at: new Date().toISOString()
      }));

      setSaving(true);
      const result = await saveQuestionsToServer(sanitized);
      setSaving(false);

      if (result.success) {
        alert(`✅ تم استيراد وحفظ ${sanitized.length} سؤال بنجاح على السيرفر!`);
        setActiveTab('list');
      }
    } catch (e) {
      toast.error('صيغة JSON غير صحيحة: ' + e.message);
    }
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(questions, null, 2));
    toast.success('تم نسخ الـ JSON إلى الحافظة!');
  };

  const handleDownloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(questions, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute('href', dataStr);
    dlAnchorElem.setAttribute('download', `tarqa_questions_${Date.now()}.json`);
    dlAnchorElem.click();
  };

  // Extract unique exams for filtering
  const uniqueExams = Array.from(new Set(questions.map(q => q.exam).filter(Boolean)));

  // Filtered list
  const filteredQuestions = questions.filter(q => {
    const matchesSearch = !searchQuery.trim() || 
      (q.question && q.question.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.exam && q.exam.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (q.choices && q.choices.some(c => String(c).includes(searchQuery)));

    const matchesType = filterType === 'all' || q.type === filterType;
    const matchesExam = filterExam === 'all' || q.exam === filterExam;
    return matchesSearch && matchesType && matchesExam;
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
              <h1 className="text-2xl font-black tracking-tight text-white">إدارة بنك الأسئلة والنماذج</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                مربوط بكافة المحاكيات
              </span>
            </div>
            <p className="text-xs md:text-sm text-slate-400 mt-1">
              أضف الأسئلة يدوياً مع الصور، أو ارفع ملف PDF ليتم تحويل كل صفحة إلى سؤال بصورة تلقائياً!
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saving && (
            <div className="flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري الحفظ على السيرفر...</span>
            </div>
          )}

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
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            onClick={() => setActiveTab('add')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'add'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            {editingId ? <Edit3 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{editingId ? 'تعديل السؤال' : 'إضافة سؤال يدوي'}</span>
          </button>

          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <FileUp className="w-4 h-4" />
            <span>استيراد من PDF (صفحة = سؤال)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
              تلقائي
            </span>
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
            <span>تحرير / استيراد JSON</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>المزامنة مع السيرفر مفعلة</span>
        </div>
      </div>

      {/* TAB 1: ADD / EDIT MANUAL QUESTION */}
      {activeTab === 'add' && (
        <div className="max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                {editingId ? <Edit3 className="w-5 h-5 text-amber-500" /> : <Plus className="w-5 h-5 text-orange-500" />}
                <span>{editingId ? 'تعديل السؤال المحدد' : 'إضافة سؤال جديد إلى بنك الأسئلة'}</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                يمكنك كتابة نص السؤال أو رفع صورة توضيحية من جهازك
              </p>
            </div>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section / Category selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">نوع القسم</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleTypeChange('search')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      formData.type === 'search'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Calculator className="w-4 h-4" />
                    <span>كمي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTypeChange('verbal')}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      formData.type === 'verbal'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-md shadow-blue-500/10'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>لفظي</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">التصنيف</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="مثال: قدرات - كمي"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">اسم النموذج / الاختبار</label>
                <input
                  type="text"
                  value={formData.exam}
                  onChange={e => setFormData({ ...formData, exam: e.target.value })}
                  placeholder="مثال: نموذج الـ 120 (كمي)"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Question Text */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                نص السؤال (أو اتركه موجزاً إذا كان السؤال صورة)
              </label>
              <textarea
                rows={3}
                value={formData.question}
                onChange={e => setFormData({ ...formData, question: e.target.value })}
                placeholder="اكتب نص السؤال هنا... (مثال: إذا كان س + ص = ٨ ، فما قيمة...)"
                className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-y"
              />
            </div>

            {/* Image attachment option */}
            <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasImage}
                    onChange={e => {
                      setHasImage(e.target.checked);
                      if (!e.target.checked) setFormData(prev => ({ ...prev, image_url: '' }));
                    }}
                    className="w-4 h-4 rounded text-orange-500 bg-slate-800 border-slate-700 focus:ring-orange-500"
                  />
                  <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-amber-400" />
                    <span>إرفاق صورة للسؤال (معادلة، رسم بياني، أو لقطة شاشة)</span>
                  </span>
                </label>
              </div>

              {hasImage && (
                <div className="space-y-3 pt-2 border-t border-slate-700/50">
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={imageUploading}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/40 text-sm font-bold cursor-pointer transition"
                    >
                      {imageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      <span>{imageUploading ? 'جاري ضغط ورفع الصورة...' : 'اختر صورة من جهازك'}</span>
                    </button>
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSingleImageFile}
                      className="hidden"
                    />

                    <span className="text-xs text-slate-500">أو الصق رابط صورة مباشر:</span>
                    <input
                      type="text"
                      value={formData.image_url}
                      onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                      placeholder="https://... أو data:image/..."
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                    />
                  </div>

                  {formData.image_url && (
                    <div className="relative mt-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800 flex items-center gap-3">
                      <img
                        src={formData.image_url}
                        alt="Question Preview"
                        className="h-20 w-32 object-contain bg-white rounded-lg border border-slate-700 cursor-pointer"
                        onClick={() => setZoomedImage(formData.image_url)}
                      />
                      <div className="flex-1 text-xs">
                        <span className="text-emerald-400 font-bold block mb-1">✓ تم إرفاق الصورة بنجاح</span>
                        <span className="text-slate-400">انقر على الصورة لتكبيرها ومعاينتها بالحجم الكامل</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                        className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition cursor-pointer"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Reading Passage option */}
            <div className="bg-slate-800/40 border border-slate-700/80 rounded-2xl p-4">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={hasPassage}
                  onChange={e => setHasPassage(e.target.checked)}
                  className="w-4 h-4 rounded text-orange-500 bg-slate-800 border-slate-700 focus:ring-orange-500"
                />
                <span className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span>إضافة قطعة قراءة / نص مرافق (استيعاب المقروء)</span>
                </span>
              </label>

              {hasPassage && (
                <div className="pt-2 border-t border-slate-700/50">
                  <textarea
                    rows={4}
                    value={formData.passage}
                    onChange={e => setFormData({ ...formData, passage: e.target.value })}
                    placeholder="الصق نص القطعة هنا..."
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              )}
            </div>

            {/* Choices Grid */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-2">
                الخيارات الأربعة (حدد زر الإجابة الصحيحة)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {formData.choices.map((choice, idx) => {
                  const isCorrect = formData.answer === idx;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 p-2.5 rounded-2xl border transition ${
                        isCorrect
                          ? 'bg-emerald-500/10 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, answer: idx })}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition cursor-pointer ${
                          isCorrect
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-slate-700/80 text-slate-300 hover:bg-slate-600'
                        }`}
                        title="انقر لتعيين كإجابة صحيحة"
                      >
                        {isCorrect ? <Check className="w-5 h-5 stroke-[3]" /> : choiceLabels[idx]}
                      </button>

                      <input
                        type="text"
                        value={choice}
                        onChange={e => handleChoiceChange(idx, e.target.value)}
                        placeholder={`الخيار (${choiceLabels[idx]})`}
                        className="flex-1 bg-transparent border-0 px-2 py-1 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                      />

                      {isCorrect && (
                        <span className="text-[11px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                          صحيح
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition cursor-pointer disabled:opacity-50"
              >
                تفريغ الحقول
              </button>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{editingId ? 'حفظ التعديلات على السيرفر' : 'حفظ وإضافة السؤال لبنك الأسئلة'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: PDF IMPORT (PAGE = QUESTION) */}
      {activeTab === 'pdf' && (
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-4 pb-4 mb-6 border-b border-slate-800">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <FileUp className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">استيراد وتحويل ملف PDF تلقائياً (صفحة = سؤال)</h2>
                <p className="text-xs md:text-sm text-slate-400 mt-1">
                  ارفع أي ملف تجميعات أو نماذج بصيغة PDF؛ سيقوم المحاكي بتحويل كل صفحة إلى صورة نقية عالية الجودة، وتوليد سؤال مستقل لكل صفحة مع خيارات (أ، ب، ج، د)!
                </p>
              </div>
            </div>

            {/* PDF Settings */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">نوع القسم</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPdfType('search');
                      setPdfCategory('قدرات - كمي');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      pdfType === 'search'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Calculator className="w-4 h-4" />
                    <span>كمي</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPdfType('verbal');
                      setPdfCategory('قدرات - لفظي');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-bold transition cursor-pointer ${
                      pdfType === 'verbal'
                        ? 'bg-blue-500/20 border-blue-500 text-blue-400'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>لفظي</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">التصنيف</label>
                <input
                  type="text"
                  value={pdfCategory}
                  onChange={e => setPdfCategory(e.target.value)}
                  placeholder="مثال: قدرات - كمي"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-2">اسم النموذج / الاختبار</label>
                <input
                  type="text"
                  value={pdfExamName}
                  onChange={e => setPdfExamName(e.target.value)}
                  placeholder="مثال: تجميعات نموذج الإشعاع (كمي)"
                  className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Drop / File Selector Zone */}
            <div
              onClick={() => !pdfProcessing && pdfInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center transition cursor-pointer ${
                pdfFile
                  ? 'border-emerald-500/60 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-orange-500/60 hover:bg-slate-800/30'
              } ${pdfProcessing ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfSelected}
                className="hidden"
                disabled={pdfProcessing}
              />

              <div className="flex flex-col items-center justify-center gap-3">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  pdfFile ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {pdfFile ? <CheckCircle2 className="w-8 h-8" /> : <FileUp className="w-8 h-8" />}
                </div>

                {pdfFile ? (
                  <div>
                    <h3 className="text-base font-bold text-emerald-400">{pdfFileName}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      حجم الملف: {(pdfFile.size / (1024 * 1024)).toFixed(2)} ميجابايت • اضغط لتغيير الملف
                    </p>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-base font-bold text-slate-200">اضغط هنا لاختيار ملف PDF من جهازك</h3>
                    <p className="text-xs text-slate-500 mt-1">يدعم ملفات التجميعات والنماذج (.pdf)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Process Button / Progress */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                {pdfProcessing ? (
                  <span className="flex items-center gap-2 text-amber-400 font-bold">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري معالجة وتحويل صفحات الـ PDF إلى صور ({pdfProgress.current} من {pdfProgress.total})...</span>
                  </span>
                ) : (
                  <span>سيتم حفظ الصور بصيغة JPG عالية الدقة مع ضغط ذكي للأداء</span>
                )}
              </div>

              <button
                type="button"
                onClick={handleProcessPdf}
                disabled={!pdfFile || pdfProcessing}
                className={`flex items-center gap-2 px-7 py-3 rounded-xl font-bold text-sm shadow-xl transition cursor-pointer ${
                  !pdfFile || pdfProcessing
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/25'
                }`}
              >
                {pdfProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>{pdfProcessing ? 'جاري التحويل...' : '🚀 بدء تحويل صفحات الـ PDF إلى أسئلة'}</span>
              </button>
            </div>

            {/* Progress Bar */}
            {pdfProcessing && pdfProgress.total > 0 && (
              <div className="mt-4">
                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-amber-400 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${(pdfProgress.current / pdfProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                  <span>الصفحة {pdfProgress.current} من {pdfProgress.total}</span>
                  <span>{Math.round((pdfProgress.current / pdfProgress.total) * 100)}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Extracted Questions Gallery & Verification */}
          {extractedPdfQuestions.length > 0 && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl space-y-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>الأسئلة المستخرجة ({extractedPdfQuestions.length} سؤال)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    يمكنك تحديد الإجابة الصحيحة لكل صفحة بنقرة سريعة، أو حذف أي صفحة غير مرغوبة (كصفحة الغلاف)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveExtractedToBank}
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{saving ? 'جاري الحفظ على السيرفر...' : `اعتماد وحفظ جميع الأسئلة (${extractedPdfQuestions.length}) في بنك الأسئلة`}</span>
                  </button>
                </div>
              </div>

              {/* Grid of Extracted Questions */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto p-1">
                {extractedPdfQuestions.map((q, idx) => (
                  <div
                    key={q.id || idx}
                    className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
                  >
                    <div>
                      {/* Top bar of question card */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          صفحة {q.pageNumber || idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteExtracted(idx)}
                          className="p-1 text-slate-500 hover:text-red-400 rounded-md hover:bg-red-500/10 transition cursor-pointer"
                          title="حذف هذه الصفحة من الأسئلة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Image Preview Thumbnail */}
                      <div className="relative group bg-white rounded-xl overflow-hidden border border-slate-700 mb-3 aspect-[4/3] flex items-center justify-center">
                        <img
                          src={q.image_url}
                          alt={`Page ${idx + 1}`}
                          className="w-full h-full object-contain cursor-pointer"
                          onClick={() => setZoomedImage(q.image_url)}
                        />
                        <button
                          type="button"
                          onClick={() => setZoomedImage(q.image_url)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition cursor-pointer"
                        >
                          <ZoomIn className="w-6 h-6" />
                        </button>
                      </div>
                    </div>

                    {/* Quick Choice Selector */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-400 mb-1.5">حدد الإجابة الصحيحة:</div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {choiceLabels.map((label, ansIdx) => {
                          const isSelected = q.answer === ansIdx;
                          return (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handleSetExtractedAnswer(idx, ansIdx)}
                              className={`py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500 text-white shadow-md'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bottom save bar */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <span className="text-xs text-slate-400">
                  إجمالي الصفحات الجاهزة للإضافة: <strong className="text-emerald-400">{extractedPdfQuestions.length}</strong>
                </span>

                <button
                  type="button"
                  onClick={handleSaveExtractedToBank}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 transition cursor-pointer disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>{saving ? 'جاري الحفظ على السيرفر...' : 'اعتماد وحفظ جميع الأسئلة في بنك الأسئلة'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: QUESTIONS LIST */}
      {activeTab === 'list' && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Controls & Search */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Search bar */}
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="ابحث في نص السؤال، اسم النموذج، أو الخيارات..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pr-10 pl-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
                >
                  <option value="all">كافة الأقسام</option>
                  <option value="search">كمي فقط</option>
                  <option value="verbal">لفظي فقط</option>
                </select>

                {/* Exam Filter */}
                {uniqueExams.length > 0 && (
                  <select
                    value={filterExam}
                    onChange={e => setFilterExam(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer max-w-[200px]"
                  >
                    <option value="all">كافة النماذج ({uniqueExams.length})</option>
                    {uniqueExams.map(ex => (
                      <option key={ex} value={ex}>{ex}</option>
                    ))}
                  </select>
                )}

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadQuestions}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                  title="تحديث البيانات من السيرفر"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>

                {/* Clear All */}
                {questions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>تفريغ الكل</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Questions Grid/List */}
          {loading ? (
            <div className="text-center py-20">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">جاري تحميل الأسئلة من السيرفر...</p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-3xl p-12 text-center">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300">بنك الأسئلة فارغ أو لا توجد نتائج للبحث</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                يمكنك إضافة أسئلة يدوية، أو رفع ملف PDF لتوليد الأسئلة من الصفحات مباشرة
              </p>
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  onClick={() => setActiveTab('pdf')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 text-white text-xs font-bold shadow-lg transition cursor-pointer"
                >
                  <FileUp className="w-4 h-4" />
                  <span>استيراد من ملف PDF</span>
                </button>
                <button
                  onClick={() => setActiveTab('add')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة سؤال يدوي</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2">
                <span>عرض {filteredQuestions.length} سؤال من إجمالي {questions.length}</span>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {filteredQuestions.map((q, idx) => {
                  const hasImg = !!(q.image_url || q.image);
                  return (
                    <div
                      key={q.id || idx}
                      className="bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      {/* Left: Thumbnail & Content */}
                      <div className="flex items-start gap-4 flex-1">
                        {/* Image preview if exists */}
                        {hasImg && (
                          <div
                            className="relative group w-20 h-20 rounded-xl overflow-hidden bg-white border border-slate-700 shrink-0 flex items-center justify-center cursor-pointer shadow"
                            onClick={() => setZoomedImage(q.image_url || q.image)}
                          >
                            <img
                              src={q.image_url || q.image}
                              alt="Thumbnail"
                              className="w-full h-full object-contain"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                              <Eye className="w-5 h-5" />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2 flex-1">
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              q.type === 'verbal'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>
                              {q.type === 'verbal' ? 'لفظي' : 'كمي'}
                            </span>

                            {q.exam && (
                              <span className="text-[11px] font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md border border-slate-700">
                                {q.exam}
                              </span>
                            )}

                            {hasImg && (
                              <span className="text-[11px] font-medium bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/20 flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                <span>صورة</span>
                              </span>
                            )}
                          </div>

                          {/* Question Text */}
                          <p className="text-sm font-bold text-slate-100 leading-relaxed">
                            {q.question || 'بدون نص (معادلة أو رسمة في الصورة)'}
                          </p>

                          {/* Choices preview */}
                          {Array.isArray(q.choices) && (
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {q.choices.map((c, cIdx) => {
                                const isAns = q.answer === cIdx;
                                return (
                                  <span
                                    key={cIdx}
                                    className={`text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1.5 ${
                                      isAns
                                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                                        : 'bg-slate-800/60 border-slate-700/60 text-slate-400'
                                    }`}
                                  >
                                    <span className="opacity-70 font-bold">{choiceLabels[cIdx]}:</span>
                                    <span>{c}</span>
                                    {isAns && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(q)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDelete(q.id)}
                          className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition cursor-pointer"
                          title="حذف السؤال"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ADVANCED JSON */}
      {activeTab === 'json' && (
        <div className="max-w-5xl mx-auto bg-slate-900/90 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-500" />
                <span>تحرير واستيراد وتصدير JSON المباشر</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                يمكنك نسخ الأسئلة بصيغة JSON، أو لصق مصفوفة أسئلة جديدة وحفظها فورياً
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>نسخ الـ JSON</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadJson}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل كملف</span>
              </button>
            </div>
          </div>

          <div>
            <textarea
              rows={16}
              value={jsonInput}
              onChange={e => setJsonInput(e.target.value)}
              className="w-full bg-slate-950 font-mono text-xs text-emerald-400 p-4 rounded-2xl border border-slate-800 focus:outline-none focus:border-orange-500 dir-ltr"
              dir="ltr"
              placeholder="[ { ... } ]"
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <span className="text-xs text-slate-400">
              تأكد من سلامة الأقواس وصيغة الـ JSON قبل الحفظ
            </span>

            <button
              type="button"
              onClick={handleImportJson}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold text-sm shadow-lg shadow-orange-500/25 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>اعتماد وحفظ الـ JSON في البنك</span>
            </button>
          </div>
        </div>
      )}

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-2 shadow-2xl">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-4 left-4 p-2 rounded-full bg-black/60 text-white hover:bg-black transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={zoomedImage}
              alt="Zoomed"
              className="max-h-[85vh] w-auto object-contain mx-auto rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}
