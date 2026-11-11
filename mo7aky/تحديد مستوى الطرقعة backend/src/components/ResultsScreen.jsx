import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useExamStore } from '../store/examStore';
import { categoryMapping, bankMapping, getAvailableExams, resetDataLoader } from '../utils/dataLoader';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Award, BookOpen, Trophy, Target, TrendingUp, Star, Home, GraduationCap, Save, RefreshCw, ArrowLeft, FolderPlus, ChevronRight, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Toaster } from './ui/sonner';
import { toast } from 'sonner';

const APP_CACHE_BUSTER = typeof window !== 'undefined' && window.__APP_CACHE_BUSTER ? window.__APP_CACHE_BUSTER : (typeof window !== 'undefined' ? (window.__APP_CACHE_BUSTER = Date.now()) : Date.now());

const getImageUrl = (imagePath, currentQuestion = null) => {
  if (!imagePath) return null;
  let url = imagePath;
  if (!imagePath.startsWith('http://') && !imagePath.startsWith('https://') && !imagePath.startsWith('data:')) {
    let cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    if (cleanPath.startsWith('Data/')) cleanPath = cleanPath.slice(5);

    const folder = (currentQuestion?.bank || currentQuestion?.category || 'search').replace(/\.json$/, '');

    let imgParam = cleanPath;
    if (cleanPath.startsWith(`${folder}/`)) {
      imgParam = cleanPath;
    } else if (cleanPath.includes('/') && !cleanPath.startsWith('images/')) {
      imgParam = cleanPath;
    } else {
      imgParam = `${folder}/${cleanPath}`;
    }
    url = `/get_image.php?img=${encodeURIComponent(imgParam)}`;
  } else if (url.includes('/Data/')) {
    let clean = url.replace(/^https?:\/\/[^\/]+\/Data\//i, '').split('?')[0];
    url = `/get_image.php?img=${encodeURIComponent(clean)}`;
  }

  if (!url.startsWith('data:') && !url.includes('_v=') && !url.includes('_=')) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_v=${APP_CACHE_BUSTER}`;
  }
  return url;
};

const ResultsScreen = ({ pastResult }) => {
  const isReviewMode = !!pastResult;
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');

  // --- Data Selectors from Store ---
  // Select state individually to prevent infinite loops
  const liveExamResults = useExamStore(state => state.examResults);
  const liveExamQuestions = useExamStore(state => state.examQuestions);
  const liveUserAnswers = useExamStore(state => state.userAnswers);
  const resetExam = useExamStore(state => state.resetExam);
  const initializeExam = useExamStore(state => state.initializeExam);
  const finishReviewingPastResult = useExamStore(state => state.finishReviewingPastResult);
  const selectedExam = useExamStore(state => state.selectedExam);
  const timerMode = useExamStore(state => state.timerMode);
  const timerDuration = useExamStore(state => state.timerDuration);
  const timeRemaining = useExamStore(state => state.timeRemaining);
  const shuffleChoices = useExamStore(state => state.shuffleChoices);
  const examCategory = useExamStore(state => state.selectedCategory);
  const examMode = useExamStore(state => state.examMode);
  const user = useExamStore(state => state.user);
  const { folders, createFolder, addQuestionToFolder } = useExamStore();
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('Login/auth.php?check_session', { credentials: 'include' });
        const data = await response.json();
        if (data && (data.user || data.telegram_id)) {
          setUserInfo(data.user || data);
        }
      } catch (error) { }
    };
    fetchUserInfo();
  }, []);

  const displayId = user?.id || user?.telegram_id || userInfo?.telegram_id || userInfo?.id || userInfo?.username || '';

  // --- Memoized Data Source ---
  const { results, questions, userAnswers } = useMemo(() => {
    if (isReviewMode) {
      return {
        results: {
          totalQuestions: pastResult.total_questions,
          correctAnswers: pastResult.correct_answers,
          incorrectAnswers: pastResult.incorrect_answers,
          unansweredQuestions: pastResult.unanswered_questions,
        },
        questions: pastResult.details.questions,
        userAnswers: pastResult.details.userAnswers,
      };
    }
    return {
      results: liveExamResults,
      questions: liveExamQuestions,
      userAnswers: liveUserAnswers,
    };
  }, [isReviewMode, pastResult, liveExamResults, liveExamQuestions, liveUserAnswers]);

  const getPrettyBankName = (key) => {
    if (!key) return '';
    const map = {
      'search': 'بنك الأسئلة (القسم الكمي)',
      'search.json': 'بنك الأسئلة (القسم الكمي)',
      'math1': 'بنك الأسئلة (القسم الكمي)',
      'math1.json': 'بنك الأسئلة (القسم الكمي)',
      'قدرات - كمي': 'بنك الأسئلة (القسم الكمي)',
      'كمي': 'بنك الأسئلة (القسم الكمي)',
      'القسم الكمي': 'بنك الأسئلة (القسم الكمي)',
      'bank1': 'البنك الأول (محوسب 2025)',
      'bank2': 'البنك الثاني',
      'bank3': 'البنك الثالث',
      'rcbank4': 'استيعاب المقروء',
      'rcbank5': 'استيعاب المقروء',
      'analogy': 'التناظر اللفظي',
      'completion': 'اكمال الجمل',
      'error': 'الخطا السياقي',
      'odd': 'المفردة الشاذة',
      'rc': 'استيعاب المقروء',
      'tiger_experiment': 'تجربة نمر'
    };
    return map[key] || key.replace(/\.json$/i, '');
  };

  const prettyExamName = useMemo(() => {
    let examName = isReviewMode ? pastResult?.exam_name : selectedExam;
    const categoryKey = isReviewMode ? pastResult?.details?.type : examCategory;

    if (categoryKey === 'tiger_experiment') {
      return 'تجربة نمر';
    }

    const cleanExam = getPrettyBankName(examName);
    const cleanCategory = getPrettyBankName(categoryKey);

    if (cleanExam && cleanCategory && cleanExam !== cleanCategory) {
      return `${cleanExam} - ${cleanCategory}`;
    }
    return cleanExam || cleanCategory || 'بنك الأسئلة (القسم الكمي)';
  }, [isReviewMode, pastResult, selectedExam, examCategory]);

  const isLastExam = useMemo(() => {
    if (!examCategory) return true; // Hide if no category

    const examsInCategory = getAvailableExams();
    if (examsInCategory.length === 0) return true; // Hide if no exams in category

    const currentExamIndex = examsInCategory.findIndex(e => e.name === selectedExam);
    if (currentExamIndex === -1) return true; // Hide if current exam not found

    return currentExamIndex === examsInCategory.length - 1;
  }, [examCategory, selectedExam]);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [displayedQuestions, setDisplayedQuestions] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [newResultId, setNewResultId] = useState(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedQuestionForFolder, setSelectedQuestionForFolder] = useState(null);

  const isQuestionInFolder = useMemo(() => {
    if (!selectedFolder || !folders[selectedFolder] || !selectedQuestionForFolder) {
      return false;
    }
    return folders[selectedFolder].questions.some(q => q.id === selectedQuestionForFolder.id && q.type === selectedQuestionForFolder.type);
  }, [selectedFolder, folders, selectedQuestionForFolder]);


  const handleOpenFolderDialog = (question) => {
    setSelectedQuestionForFolder(question);

    let foundFolder = null;
    if (folders && typeof folders === 'object') {
      for (const folder of Object.values(folders)) {
        if (folder.questions && Array.isArray(folder.questions)) {
          const questionExists = folder.questions.some(q => q.id === question.id && q.type === question.type);
          if (questionExists) {
            foundFolder = folder.name;
            break;
          }
        }
      }
    }

    setSelectedFolder(foundFolder);
    setIsCreatingFolder(false);
    setNewFolderName('');
    setIsFolderDialogOpen(true);
  };

  useEffect(() => {
    if (!isReviewMode && results && !saveSuccess && selectedExam !== 'مراجعة الأخطاء') {
      handleSaveResults();
    }
  }, [isReviewMode, results, saveSuccess, selectedExam]);

  // --- Handlers ---
  const handleSaveResults = useCallback(async () => {
    if (!results) return;
    setIsSaving(true);
    setSaveError(null);

    const percentage = results.totalQuestions > 0 ? parseFloat(((results.correctAnswers / results.totalQuestions) * 100).toFixed(1)) : 0;
    const resultsData = {
      examName: selectedExam || examCategory || 'اختبار تحديد المستوى',
      totalQuestions: results.totalQuestions,
      correctAnswers: results.correctAnswers,
      incorrectAnswers: results.incorrectAnswers,
      unansweredQuestions: results.unansweredQuestions,
      percentage: percentage,
      timeTaken: results.timeTaken, // Use timeTaken from results object
      details: {
        exam: selectedExam,
        type: examCategory,
        questions: questions.map(({ explanation, ...rest }) => rest),
        userAnswers: userAnswers,
      }
    };

    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('Login/save_results.php', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultsData),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setSaveSuccess(true);
          if (data.id) {
            setNewResultId(data.id);
          }
          setIsSaving(false);
          return; // Success — exit early
        } else {
          throw new Error(data.error || 'Failed to save results.');
        }
      } catch (error) {
        console.error(`Save results attempt ${attempt + 1}/${MAX_RETRIES} failed:`, error);
        if (attempt < MAX_RETRIES - 1) {
          // Wait before retrying: 1s, 2s, 4s (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        } else {
          setSaveError(error.message);
        }
      }
    }
    setIsSaving(false);
  }, [results, questions, userAnswers, selectedExam, timerMode, timerDuration, timeRemaining]);

  const handleDeleteResult = useCallback(async (id) => {
    if (!id) return;
    try {
      const response = await fetch('Login/delete_result.php', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete result.');
      }
      console.log('Result deleted successfully.');
    } catch (error) {
      console.error('Delete result error:', error);
    }
  }, []);

  const handleReplayExam = useCallback(async () => {
    window.scrollTo(0, 0);
    if (isReviewMode || !liveExamQuestions || liveExamQuestions.length === 0) return;

    // await handleDeleteResult(newResultId);

    initializeExam({
      questions: liveExamQuestions,
      examName: selectedExam,
      categoryKey: examCategory,
      timerMode: timerMode,
      timerDuration: timerDuration,
      shuffleChoices: shuffleChoices,
      examMode: examMode,
    });
  }, [isReviewMode, liveExamQuestions, selectedExam, timerMode, timerDuration, shuffleChoices, examMode, initializeExam, handleDeleteResult, examCategory, newResultId]);

  const handleNextExam = useCallback(async () => {
    window.scrollTo(0, 0);
    if (!examCategory) {
      resetExam();
      return;
    }

    // Get next exam info before resetting data
    const examsInCategory = getAvailableExams();
    if (examsInCategory.length <= 1) { // If only one or zero exams, just reset
      resetExam();
      return;
    }

    const currentExamIndex = examsInCategory.findIndex(e => e.name === selectedExam);
    const nextExamIndex = (currentExamIndex + 1) % examsInCategory.length;
    const nextExam = examsInCategory[nextExamIndex];

    // Now, reset the data loader before initializing the new exam
    resetDataLoader();

    await initializeExam({
      categoryKey: examCategory,
      examName: nextExam.name,
      timerMode: timerMode,
      timerDuration: timerDuration,
      shuffleChoices: shuffleChoices,
      examMode: examMode,
    });
  }, [examCategory, selectedExam, timerMode, timerDuration, shuffleChoices, examMode, resetExam, initializeExam]);

  useEffect(() => {
    const handleContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  if (!results) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 flex items-center justify-center" dir="rtl">
        <div className="text-center text-white">
          <GraduationCap className="h-12 w-12 mx-auto mb-4 text-orange-400 animate-pulse" />
          <div className="text-xl font-medium">لا توجد نتائج لعرضها.</div>
          <Button onClick={() => resetExam()} className="mt-4">العودة للرئيسية</Button>
        </div>
      </div>
    );
  }



  const handleCategoryClick = (category) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
      setDisplayedQuestions([]);
      return;
    }

    setSelectedCategory(category);

    let questionsToShow = [];
    if (category === 'correct') {
      questionsToShow = questions.filter(q => userAnswers[q.question_number] === q.answer);
    } else if (category === 'incorrect') {
      questionsToShow = questions.filter(q => userAnswers[q.question_number] !== undefined && userAnswers[q.question_number] !== q.answer);
    } else if (category === 'unanswered') {
      questionsToShow = questions.filter(q => userAnswers[q.question_number] === undefined || userAnswers[q.question_number] === null);
    }

    setDisplayedQuestions(questionsToShow.map(q => ({ ...q, userAnswer: userAnswers[q.question_number], correctAnswer: q.answer })));
  };

  const percentage = results.totalQuestions > 0
    ? parseFloat(((results.correctAnswers / results.totalQuestions) * 100).toFixed(1))
    : 0;

  const timeTakenSeconds = isReviewMode
    ? pastResult.time_taken_seconds
    : results?.timeTaken;

  console.log({
    isReviewMode,
    timeTakenSeconds,
    timerMode,
    timerDuration,
    timeRemaining,
    pastResultTime: pastResult ? pastResult.time_taken : undefined
  });

  const formatTime = (totalSeconds) => {
    if (totalSeconds === null || totalSeconds < 0) {
      return "";
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);

    let timeString = "";
    if (minutes > 0) {
      timeString += `${minutes} ${minutes === 1 ? 'دقيقة' : 'دقائق'}`;
    }
    if (seconds > 0) {
      if (timeString.length > 0) {
        timeString += " و ";
      }
      timeString += `${seconds} ${seconds === 1 ? 'ثانية' : 'ثواني'}`;
    }
    if (minutes === 0 && seconds === 0 && totalSeconds > 0) {
      return " في أقل من ثانية";
    }
    if (timeString.length === 0) {
      return "";
    }
    return ` في ${timeString}`;
  };

  const formattedTime = formatTime(timeTakenSeconds);

  const getGradeIcon = (p) => {
    if (p >= 90) return Trophy;
    if (p >= 80) return Award;
    if (p >= 70) return Star;
    return Target;
  };
  const GradeIcon = getGradeIcon(percentage);

  const getGradeColor = (p) => {
    if (p >= 90) return 'from-green-500 to-emerald-500';
    if (p >= 80) return 'from-orange-500 to-amber-500';
    if (p >= 70) return 'from-yellow-500 to-orange-500';
    return 'from-red-500 to-pink-500';
  };

  const getGradeTextColor = (p) => {
    if (p >= 90) return 'text-green-600';
    if (p >= 80) return 'text-blue-600';
    if (p >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getGradeLabel = (p) => {
    if (p >= 90) return 'ممتاز';
    if (p >= 80) return 'جيد جداً';
    if (p >= 70) return 'جيد';
    if (p >= 60) return 'مقبول';
    return 'ضعيف';
  };

  const categoryPerformance = useMemo(() => {
    if (results?.categoryPerformance && Array.isArray(results.categoryPerformance) && results.categoryPerformance.length > 0) {
      return results.categoryPerformance.map(c => ({
        ...c,
        percentage: typeof c.percentage === 'number' && !isNaN(c.percentage)
          ? c.percentage
          : (c.total > 0 ? (c.correct / c.total) * 100 : 0)
      }));
    }

    if (!questions || questions.length === 0) return [];

    const statsMap = {};

    questions.forEach(q => {
      const rawCategory = q.category || q.type || q.bank || 'القسم الكمي';
      const categoryDisplayName = (bankMapping && bankMapping[rawCategory]) || (bankMapping && bankMapping[categoryMapping?.[rawCategory]]) || (rawCategory === 'search' || rawCategory === 'math1' ? 'بنك الأسئلة (القسم الكمي)' : rawCategory);

      if (!statsMap[categoryDisplayName]) {
        statsMap[categoryDisplayName] = {
          name: categoryDisplayName,
          correct: 0,
          total: 0
        };
      }

      statsMap[categoryDisplayName].total++;

      const uAns = userAnswers[q.question_number];
      let isCorrect = false;
      if (uAns !== undefined) {
        if (typeof q.answer === 'number') {
          isCorrect = uAns === q.answer;
        } else if (typeof q.answer === 'string' && q.choices) {
          isCorrect = q.choices[uAns] === q.answer || uAns === q.answer;
        } else {
          isCorrect = uAns === q.answer;
        }
      }

      if (isCorrect) {
        statsMap[categoryDisplayName].correct++;
      }
    });

    return Object.values(statsMap).map(c => ({
      ...c,
      percentage: c.total > 0 ? (c.correct / c.total) * 100 : 0
    }));
  }, [results, questions, userAnswers]);

  const weakestCategories = useMemo(() => {
    if (!categoryPerformance || categoryPerformance.length === 0) return [];
    return categoryPerformance.filter(cat => cat.percentage < 70);
  }, [categoryPerformance]);

  return (
    <>
      <Toaster />
      <style>{`
        /* Custom blue scrollbar */
        ::-webkit-scrollbar {
          width: 12px;
          background: #001e3c;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
          border-radius: 8px;
          border: 2px solid #001e3c;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
        }
        ::-webkit-scrollbar-corner {
          background: #001e3c;
        }
        /* Firefox */
        html {
          scrollbar-color: #38bdf8 #001e3c;
          scrollbar-width: thin;
        }
      `}</style>
      <div className="min-h-screen text-slate-300" dir="rtl">
        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-6 pt-10 pb-0 text-center">
            <div className="flex justify-center mb-6">
              <div className="p-3 transition-transform duration-300 hover:scale-110">
                <GradeIcon className="h-16 w-16 text-orange-400" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-100 mb-6 leading-normal pb-1">
              {prettyExamName}
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              {`تهانينا! لقد اكملت الاختبار بنجاح${formattedTime}. اليك تفاصيل ادائك`}
            </p>
            {/* Home Button */}
            <Button
              variant=""
              className="absolute top-3 right-3 sm:top-6 sm:right-6 text-orange-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/30 px-2 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
              onClick={() => resetExam()}
            >
              <Home className="h-4 w-4 sm:h-6 sm:w-6 sm:ml-2" />
              <span className="font-bold text-xs sm:text-base hidden sm:inline">الصفحة الرئيسية</span>
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16 space-y-8 sm:px-6 lg:px-8">

          <Card className="rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className={`bg-gradient-to-r ${getGradeColor(percentage)} rounded-full p-4 shadow-xl`}>
                  <GradeIcon className="w-16 h-16 text-white" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold text-slate-100 mb-2">
                نتيجتك النهائية
              </CardTitle>
              <div className={`text-5xl font-bold ${getGradeTextColor(percentage)} mb-2`}>
                {(results.correctAnswers || 0)} / {(results.totalQuestions || 0)}
              </div>
              <div className={`text-3xl font-semibold ${getGradeTextColor(percentage)} mb-4`}>
                {percentage}%
              </div>
              <div className="flex justify-center">
                <Badge
                  variant="outline"
                  className={`text-lg px-4 py-2 bg-gradient-to-r ${getGradeColor(percentage)} text-white border-0 rounded-full shadow-lg`}
                >
                  {getGradeLabel(percentage)}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            <Card
              className={`bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto cursor-pointer ${selectedCategory === 'correct' ? 'ring-4 ring-orange-400 shadow-2xl' : ''}`}
              onClick={() => handleCategoryClick('correct')}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <CheckCircle className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-xl font-bold text-slate-100">اجابات صحيحة</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-orange-400 mb-2">{results.correctAnswers || 0}</div>
                <div className="text-slate-300">من اصل {results.totalQuestions || 0} سؤال</div>
                <div className="mt-2 text-xs text-slate-400">اضغط لعرض الاسئلة</div>
              </CardContent>
            </Card>

            <Card
              className={`bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto cursor-pointer ${selectedCategory === 'incorrect' ? 'ring-4 ring-orange-400 shadow-2xl' : ''}`}
              onClick={() => handleCategoryClick('incorrect')}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <XCircle className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-xl font-bold text-slate-100">اجابات خاطئة</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-orange-400 mb-2">{results.incorrectAnswers || 0}</div>
                <div className="text-slate-300">تحتاج الى مراجعة</div>
                <div className="mt-2 text-xs text-slate-400">اضغط لعرض الاسئلة</div>
              </CardContent>
            </Card>

            <Card
              className={`bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto cursor-pointer ${selectedCategory === 'unanswered' ? 'ring-4 ring-orange-400 shadow-2xl' : ''}`}
              onClick={() => handleCategoryClick('unanswered')}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <BookOpen className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-xl font-bold text-slate-100">اسئلة غير محلولة</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-orange-400 mb-2">{results.unansweredQuestions || 0}</div>
                <div className="text-slate-300">سؤال لم يتم حله</div>
                <div className="mt-2 text-xs text-slate-400">اضغط لعرض الاسئلة</div>
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
            <CardHeader>
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 transition-transform duration-300 hover:scale-110">
                  <TrendingUp className="h-6 w-6 text-orange-400" />
                </div>
              </div>
              <CardTitle className="text-center text-2xl font-bold text-slate-100">
                تحليل الاداء الذكي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Category Breakdown */}
                {categoryPerformance.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold text-slate-100 mb-4 text-center">ملخص الاداء حسب القسم</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {categoryPerformance.map((category) => (
                        <div key={category.name} className="bg-[#162442ff] rounded-xl p-4 border border-orange-400/10 hover:border-orange-400/30 transition-all">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-200 text-sm">{category.name}</span>
                            <span className="text-sm font-bold text-orange-400">{`${category.correct}/${category.total}`}</span>
                          </div>
                          <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden mb-2">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-orange-500 to-amber-400"
                              style={{ width: `${Math.min(Math.round(category.percentage || 0), 100)}%` }}
                            />
                          </div>
                          <div className="text-left text-xs font-semibold text-slate-400">
                            {Math.round(category.percentage || 0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                <div>
                  <h3 className="text-xl font-bold text-slate-100 mb-4 text-center">توصيات للتحسين</h3>
                  <div className="bg-[#162442ff] rounded-xl p-6 border-1">
                    <ul className="space-y-3 text-slate-300">
                      {weakestCategories.length > 0 ? (
                        weakestCategories.map((category) => (
                          <li key={category.name} className="flex items-start gap-3">
                            <div className="pt-1">
                              <Target className="h-4 w-4 text-orange-400" />
                            </div>
                            <span>
                              تحتاج الى المزيد من التدريب في قسم <strong className="text-amber-300">{category.name}</strong>، حيث ان نتيجتك كانت {Math.round(category.percentage || 0)}%.
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="flex items-center gap-3">
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span>اداء رائع! لقد اتقنت جميع أقسام الاختبار. حافظ على هذا المستوى بالمراجعة المستمرة.</span>
                        </li>
                      )}
                      {percentage < 80 && weakestCategories.length === 0 && (
                        <li className="flex items-start gap-3">
                          <div className="pt-1"><Target className="h-4 w-4 text-orange-400" /></div>
                          <span>اداؤك العام جيد، لكن للوصول الى مستوى الاتقان، ركز على مراجعة الاسئلة التي اخطات بها في مختلف أقسام الاختبار.</span>
                        </li>
                      )}
                      <li className="flex items-start gap-3">
                        <div className="pt-1"><BookOpen className="h-4 w-4 text-orange-400" /></div>
                        <span>استمر في حل الاختبارات المتنوعة لتطوير سرعتك ودقتك في جميع أقسام الاختبار.</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedCategory && displayedQuestions.length > 0 && (
            <Card className="rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
              <CardHeader>
                <div className="flex items-center justify-center mb-4">
                  <div className={`rounded-full p-3 ${selectedCategory === 'correct' ? 'p-3 transition-transform duration-300 hover:scale-110' : selectedCategory === 'incorrect' ? 'p-3 transition-transform duration-300 hover:scale-110' : 'p-3 transition-transform duration-300 hover:scale-110'}`}>
                    {selectedCategory === 'correct' ? <CheckCircle className="h-6 w-6 text-orange-400" /> :
                      selectedCategory === 'incorrect' ? <XCircle className="h-6 w-6 text-orange-400" /> :
                        <BookOpen className="h-6 w-6 text-orange-400" />}
                  </div>
                </div>
                <CardTitle className="text-center text-2xl font-bold text-slate-100">
                  {selectedCategory === 'correct' ? `الاسئلة الصحيحة (${displayedQuestions.length})` :
                    selectedCategory === 'incorrect' ? `الاسئلة الخاطئة (${displayedQuestions.length})` :
                      `الاسئلة غير المحلولة (${displayedQuestions.length})`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-8">
                  {displayedQuestions.map((question, index) => (
                    <div key={question.question_number || index} className={`relative overflow-hidden rounded-2xl p-6 border-l-4 shadow-lg ${selectedCategory === 'correct' ? 'bg-[#162442ff] border-orange-400' : selectedCategory === 'incorrect' ? 'bg-[#162442ff] border-orange-400' : 'bg-[#162442ff] border-orange-400'}`}>
                      {/* Telegram ID Watermark to prevent leaking - 3 watermarks */}
                      {displayId && (
                        <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none z-10 overflow-hidden select-none py-4">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className={`flex items-center w-full px-6 ${
                                i === 0 ? 'justify-start' : i === 1 ? 'justify-center' : 'justify-end'
                              }`}
                            >
                              <div
                                className="text-xs sm:text-sm md:text-base text-gray-400 font-mono"
                                style={{ transform: 'rotate(-30deg)', opacity: '0.35' }}
                              >
                                {displayId}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`rounded-full p-2 ${selectedCategory === 'correct' ? 'bg-green-100' : selectedCategory === 'incorrect' ? 'bg-red-100' : 'bg-gray-100'}`}>
                            <span className={`font-bold text-lg ${selectedCategory === 'correct' ? 'text-green-700' : selectedCategory === 'incorrect' ? 'text-red-700' : 'text-[#000000]'}`}>السؤال {question.question_number}</span>
                          </div>
                          <Badge className={` ${selectedCategory === 'correct' ? 'bg-orange-400/10 text-orange-400 rounded-full text-sm font-medium' : selectedCategory === 'incorrect' ? 'bg-orange-400/10 text-orange-400 rounded-full text-sm font-medium' : 'bg-orange-400/10 text-orange-400 rounded-full text-sm font-medium'}`}>
                            {question.category}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => handleOpenFolderDialog(question)}
                          className={`transition-all duration-300 rounded-lg sm:rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm lg:text-xs xl:text-sm min-w-0 cursor-pointer bg-transparent text-white hover:bg-transparent transform hover:scale-105`}
                          size="lg"
                        >
                          <FolderPlus className="h-8 w-8 sm:h-8 sm:w-8 flex-shrink-0" />

                        </Button>
                      </div>

                      {question.passage && (
                        <div className="mb-6 p-4 backdrop-blur-sm rounded-xl">
                          <div className="text-sm font-bold text-orange-400 mb-3 flex items-center gap-2">النص:</div>
                          <div className="text-sm text-slate-100 leading-relaxed">{question.passage}</div>
                        </div>
                      )}

                      <div className="mb-6 w-full max-w-full min-w-0">
                        <div className="text-sm font-bold text-orange-400 mb-3">السؤال:</div>
                        <div className="text-lg font-medium text-slate-100 backdrop-blur-sm rounded-xl p-2 sm:p-4 w-full max-w-full min-w-0 overflow-hidden">
                          {!(question.image || question.image_url) && (
                            <div className="break-words overflow-wrap-anywhere">{question.question}</div>
                          )}
                          {(question.image || question.image_url) && (
                            <div className="flex justify-center w-full max-w-full overflow-hidden my-2">
                              <img
                                src={getImageUrl(question.image || question.image_url, question)}
                                alt={`Question ${question.question_number}`}
                                className="w-full max-w-full h-auto max-h-[70vh] object-contain rounded-lg cursor-zoom-in block mx-auto"
                                onClick={() => {
                                  setZoomedImageUrl(getImageUrl(question.image || question.image_url, question));
                                  setIsImageZoomModalOpen(true);
                                }}
                                onError={(e) => {
                                  const rawSrc = question.image_url || question.image || '';
                                  if (!e.target.dataset.fallbackTried && rawSrc) {
                                    e.target.dataset.fallbackTried = 'true';
                                    let clean = rawSrc.replace(/^https?:\/\/tarqa\.net\/Data\//i, '').split('?')[0];
                                    if (clean.startsWith('images/')) clean = 'search/' + clean;
                                    if (!clean.includes('/')) clean = 'search/images/' + clean;
                                    e.target.src = `/get_image.php?img=${encodeURIComponent(clean)}&_v=${APP_CACHE_BUSTER}`;
                                  }
                                }}
                                onDragStart={(e) => e.preventDefault()}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {question.choices && question.choices.length > 0 && (
                        <div className="mb-6">
                          <div className="text-sm font-bold text-orange-400 mb-3">الخيارات:</div>
                          <div className="grid gap-3">
                            {question.choices.map((choice, choiceIndex) => {
                              const isUserAnswer = question.userAnswer === choiceIndex;
                              const isCorrectAnswer = question.correctAnswer === choiceIndex;

                              return (
                                <div
                                  key={choiceIndex}
                                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${isCorrectAnswer ? 'border-green-400' : isUserAnswer ? 'border-red-400' : ''}`}
                                >
                                  <div className="flex items-center gap-3 text-slate-100">
                                    <span className="flex-1 text-base leading-relaxed">{choice}</span>
                                    {isCorrectAnswer && (
                                      <div className="flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-5 w-5" />
                                        <span className="text-sm font-bold">الاجابة الصحيحة</span>
                                      </div>
                                    )}
                                    {isUserAnswer && !isCorrectAnswer && (
                                      <div className="flex items-center gap-1 text-red-600">
                                        <XCircle className="h-5 w-5" />
                                        <span className="text-sm font-bold">اجابتك</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No Questions Available Message */}
          {selectedCategory && displayedQuestions.length === 0 && (
            <Card className="rounded-lg text-card-foreground shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
              <CardContent className="text-center py-12">
                <div className="flex justify-center mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <BookOpen className="h-12 w-12 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">
                  لا توجد اسئلة متاحة
                </h3>
                <p className="text-slate-400">
                  {selectedCategory === 'correct' ? 'لا توجد اسئلة صحيحة لعرضها' :
                    selectedCategory === 'incorrect' ? 'لا توجد اسئلة خاطئة لعرضها' :
                      'لا توجد اسئلة غير محلولة لعرضها'}
                </p>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-center flex-wrap gap-4 pt-8">
            {!isReviewMode && (
              <Button
                onClick={handleReplayExam}
                className="backdrop-blur-sm font-bold bg-yellow-500 hover:bg-yellow-600 hover:text-white text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                size="lg"
              >
                <RefreshCw className="h-6 w-6 ml-2" />
                اعادة الاختبار
              </Button>
            )}
            <Button
              onClick={isReviewMode ? finishReviewingPastResult : resetExam}
              className="backdrop-blur-sm font-bold bg-orange-500 hover:bg-orange-600 hover:text-white text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
              size="lg"
            >
              <Home className="h-6 w-6 ml-2" />
              {isReviewMode ? "العودة للسجل" : "الصفحة الرئيسية"}
            </Button>
            {!isReviewMode && !isLastExam && (
              <Button
                onClick={handleNextExam}
                className="backdrop-blur-sm font-bold bg-teal-500 hover:bg-teal-600 hover:text-white text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                size="lg"
              >
                <ArrowLeft className="h-6 w-6 ml-2" />
                الاختبار التالي
              </Button>
            )}
          </div>
          {!isReviewMode && selectedExam !== 'مراجعة الأخطاء' && (
            <div className="flex items-center justify-center gap-3 p-4">
              {isSaving && <p className="text-slate-300 animate-pulse">جاري حفظ النتيجة...</p>}
              {saveError && (
                <>
                  <p className="text-red-400">خطأ في الحفظ: {saveError}</p>
                  <Button
                    onClick={handleSaveResults}
                    disabled={isSaving}
                    className="bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-400/30 rounded-lg px-4 py-2 text-sm font-bold cursor-pointer transition-all duration-300"
                    size="sm"
                  >
                    <RefreshCw className={`h-4 w-4 ml-1 ${isSaving ? 'animate-spin' : ''}`} />
                    إعادة المحاولة
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {/* Folder modal */}

        <Dialog modal={false} open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
          <DialogContent className="bg-white backdrop-blur-sm rounded-2xl shadow-2xl w-full sm:max-w-lg border border-white/20 p-0">
            <DialogHeader className="bg-gradient-to-r from-[#000429] to-[#004d91] text-white p-4 flex flex-row-reverse justify-between items-center rounded-t-2xl">

              <Button
                onClick={() => setIsFolderDialogOpen(false)}
                variant=""
                className="text-white bg-transparent hover:bg-transparent p-2 rounded-full cursor-pointer"
              >
                <X className="h-6 w-6" />
              </Button>

              <div>
                <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                  <FolderPlus className="h-6 w-6" />
                  حفظ في مجلد
                </DialogTitle>
                <DialogDescription className="sr-only">
                  حفظ الأسئلة في مجلد مخصص
                </DialogDescription>
              </div>
            </DialogHeader>

            <div className="p-6 space-y-6">
              <div>
                <h5 className="font-bold text-gray-800 text-lg">اختر مجلدًا</h5>
                <div className="flex items-center gap-2">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between bg-white/80 border-gray-300 hover:bg-gray-50 text-gray-800 cursor-pointer">
                        <span>{selectedFolder || "اختر مجلد"}</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent dir="rtl" className="bg-white border-gray-200 shadow-lg w-56">
                      {Object.values(folders || {}).map((folder) => (
                        <DropdownMenuItem
                          key={folder.name}
                          onSelect={() => setSelectedFolder(folder.name)}
                          className="cursor-pointer hover:bg-blue-50 focus:bg-blue-100"
                        >
                          {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={() => setIsCreatingFolder(!isCreatingFolder)} variant="outline" className="p-2 bg-white/80 border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                    <FolderPlus className="h-5 w-5" />
                  </Button>
                  {isQuestionInFolder && <CheckCircle className="h-6 w-6 text-green-500" />}
                </div>
                {isCreatingFolder && (
                  <div className="mt-7 space-y-5 transform transition-all duration-300">
                    <Label htmlFor="new-folder-name" className="font-bold text-gray-800 mb-3 text-lg text-center">اسم المجلد</Label>
                    <Input
                      id="new-folder-name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className="bg-white/80 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      placeholder="مثال: اسئلة مهمة"
                    />
                    <Button
                      onClick={() => {
                        if (newFolderName.trim() !== "") {
                          const folderName = newFolderName.trim();
                          createFolder(folderName);
                          setSelectedFolder(folderName);
                          setNewFolderName("");
                          setIsCreatingFolder(false);
                          toast.success(`تم إنشاء مجلد "${folderName}"`);
                        }
                      }}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold hover:from-blue-600 hover:to-indigo-600 cursor-pointer"
                    >
                      انشاء
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-center">
              <Button
                onClick={async () => {
                  if (selectedFolder) {
                    const folder = folders[selectedFolder];
                    if (folder) {
                      const questionExists = Array.isArray(folder.questions) && folder.questions.some(q => q.id === selectedQuestionForFolder.id && q.type === selectedQuestionForFolder.type);
                      if (questionExists) {
                        toast.info(`السؤال موجود بالفعل في مجلد "${selectedFolder}"`);
                      } else {
                        await addQuestionToFolder(selectedFolder, selectedQuestionForFolder);
                        toast.success(`تمت إضافة السؤال إلى مجلد "${selectedFolder}"`);
                      }
                    } else {
                      await addQuestionToFolder(selectedFolder, selectedQuestionForFolder);
                      toast.success(`تمت إضافة السؤال إلى مجلد "${selectedFolder}"`);
                    }
                  }
                  setIsFolderDialogOpen(false);
                }}
                disabled={!selectedFolder}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white font-bold hover:from-orange-600 hover:to-red-600 cursor-pointer"
                size="lg"
              >
                <span>اضافة</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Image Zoom Modal */}
      <Dialog modal={false} open={isImageZoomModalOpen} onOpenChange={setIsImageZoomModalOpen}>
        <DialogContent
          className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl max-h-[90vh] p-0 bg-transparent border-0 relative overflow-hidden flex items-center justify-center"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">تكبير الصورة</DialogTitle>
          <DialogDescription className="sr-only">عرض الصورة بحجم مكبر</DialogDescription>
          <DialogClose className="absolute top-3 left-3 z-50 p-2 bg-black/70 hover:bg-black/90 rounded-full text-white cursor-pointer transition-colors shadow-lg">
            <X className="h-6 w-6" />
          </DialogClose>
          {displayId && (
            <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none z-20 overflow-hidden select-none py-8">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`flex items-center w-full px-12 ${
                    i === 0 ? 'justify-start' : i === 1 ? 'justify-center' : 'justify-end'
                  }`}
                >
                  <div
                    className="text-xs sm:text-sm md:text-base text-gray-300/60 dark:text-gray-400/40 font-mono"
                    style={{ transform: 'rotate(-30deg)' }}
                  >
                    {displayId}
                  </div>
                </div>
              ))}
            </div>
          )}
          <img
            src={zoomedImageUrl}
            alt="Zoomed Question"
            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-md relative z-10 block mx-auto shadow-2xl bg-white"
            onDragStart={(e) => e.preventDefault()}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ResultsScreen;
