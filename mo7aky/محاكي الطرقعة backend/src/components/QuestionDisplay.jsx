import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeft, Clock, Flag, Filter, BarChart3, BookOpen, GraduationCap, Target, CheckCircle, Home, X, ZoomIn, ArrowRightToLine, CircleHelp, LogIn, SquareX, GalleryVertical, TriangleAlert, FolderPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import EquationImage from "./ui/Equation.jpg";
import { useExamStore } from '../store/examStore';
import { useIsMobile } from '../hooks/use-mobile';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const APP_CACHE_BUSTER = typeof window !== 'undefined' && window.__APP_CACHE_BUSTER ? window.__APP_CACHE_BUSTER : (typeof window !== 'undefined' ? (window.__APP_CACHE_BUSTER = Date.now()) : Date.now());

const getImageUrl = (imagePath, currentQuestion = null) => {
  if (!imagePath) return null;

  // If already a constructed get_image.php URL or full URL, return directly with cache buster
  if (
    imagePath.includes('get_image.php?') ||
    imagePath.startsWith('http://') ||
    imagePath.startsWith('https://') ||
    imagePath.startsWith('data:')
  ) {
    let url = imagePath;
    if (!url.startsWith('data:') && !url.includes('_v=') && !url.includes('_=')) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}_v=${APP_CACHE_BUSTER}`;
    }
    return url;
  }

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

const levenshteinDistance = (s1, s2) => {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator, // substitution
      );
    }
  }
  return track[s2.length][s1.length];
};

const QuestionDisplay = () => {
  const [fontSize, setFontSize] = useState('normal'); // normal, small, smaller, large, larger
  const [isEquationZoomed, setIsEquationZoomed] = useState(false);
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');
  const isMobile = useIsMobile();
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [timerModalMessage, setTimerModalMessage] = useState('');
  const [userInfo, setUserInfo] = useState(null);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);


  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const response = await fetch('Login/auth.php');
        const data = await response.json();
        if (data.logged_in && data.user) {
          setUserInfo(data.user);
        }
      } catch (error) {
        console.error("Failed to fetch user info", error);
      }
    };
    fetchUserInfo();
  }, []);


  const fontSizeMap = {

    'normal': 'خط عادي',
    'large': 'خط عريض',
    'larger': 'خط عريض بزيادة'
  };

  const {
    user,
    examQuestions,
    currentQuestionIndex,
    currentSection,
    userAnswers,
    deferredQuestions,
    markedQuestions,
    examMode,
    reviewMode,
    examCompleted,
    timerActive,
    timeRemaining,
    sectionReviewMode,
    hasSeenSectionReview,
    returnedFromSectionReview,
    reviewedSection,
    hideDeferButton,
    selectAnswer,
    toggleDeferred,
    toggleMarked,
    nextQuestion,
    previousQuestion,
    getQuestionStats,
    getCurrentExamInfo,
    goToQuestion,
    setReviewMode,
    goToSectionReview,
    sectionReviewFilter,
    filteredQuestionIndices,
    currentFilteredIndex,
    folders,
    createFolder,
    addQuestionToFolder,
    timerInterval,
    startTimer,
    nightMode,
  } = useExamStore();

  const displayId = user?.id || user?.telegram_id || userInfo?.telegram_id || userInfo?.id || userInfo?.username || '';

  // Restart timer if it should be active but isn't running (e.g. after page refresh)
  useEffect(() => {
    if (timerActive && !timerInterval) {
      startTimer();
    }
  }, [timerActive, timerInterval, startTimer]);

  useEffect(() => {
    if (timeRemaining === 300) { // 5 minutes
      setTimerModalMessage('تحذير متبقي من الوقت خمس دقائق');
      setIsTimerModalOpen(true);
    }
    if (timeRemaining === 60) { // 1 minute
      setTimerModalMessage('تحذير متبقي من الوقت دقيقة واحدة');
      setIsTimerModalOpen(true);
    }
  }, [timeRemaining]);

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle keyboard events if we're not in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          handleNext();
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (canGoPrevious()) {
            handlePrevious();
          }
          break;
        case 'h':
        case 'H':
        case 'ا': // Handle key 'H' when in Arabic layout
          setIsExitDialogOpen(true);
          break;
        default:
          const numKey = parseInt(event.key, 10);
          if (!isNaN(numKey) && numKey >= 1 && numKey <= 9) {
            const currentQ = examQuestions[currentQuestionIndex];
            if (currentQ && currentQ.choices && currentQ.choices.length > 0) {
              let choiceIndex = numKey - 1;
              // If user chooses a number higher than available choices, select the last one
              if (choiceIndex >= currentQ.choices.length) {
                choiceIndex = currentQ.choices.length - 1;
              }
              handleAnswerSelect(choiceIndex);
            }
          }
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestionIndex, examQuestions, examMode, currentSection]); // Dependencies to ensure the effect updates when these change

  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (event) => {
      // F12
      if (event.key === 'F12') {
        event.preventDefault();
      }
      // Ctrl+Shift+I
      if (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
        event.preventDefault();
      }
      // Ctrl+C
      if (event.ctrlKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault();
      }
      // Ctrl+V
      if (event.ctrlKey && (event.key === 'V' || event.key === 'v')) {
        event.preventDefault();
      }
      // Ctrl+P
      if (event.ctrlKey && (event.key === 'P' || event.key === 'p')) {
        event.preventDefault();
      }
      // Ctrl+S
      if (event.ctrlKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
      }
      // Ctrl +/-, and other zoom keys
      if (event.ctrlKey && ['=', '+', '-'].includes(event.key)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Function to calculate the display question number based on exam mode
  const getDisplayQuestionNumber = () => {
    if (examMode === 'sectioned') {
      // For sectioned mode: show 1-11 for each section
      const questionInSection = (currentQuestionIndex % 11) + 1;
      return questionInSection;
    } else {
      // For single section mode: show 1-65
      return currentQuestionIndex + 1;
    }
  };

  // Function to calculate total questions for display
  const getTotalQuestionsDisplay = () => {
    if (examMode === 'sectioned') {
      const questionsPerSection = 11;
      const totalQuestions = examQuestions.length;
      const currentSectionIndex = Math.floor(currentQuestionIndex / questionsPerSection);
      const totalSections = Math.ceil(totalQuestions / questionsPerSection);

      if (currentSectionIndex === totalSections - 1) { // We are in the last section
        const remaining = totalQuestions % questionsPerSection;
        if (remaining > 0) {
          return remaining;
        }
      }
      return questionsPerSection;
    } else {
      return examQuestions.length;
    }
  };

  // Function to remove diacritics (tashkeel) from Arabic text
  const removeDiacritics = (text) => {
    // First, handle the specific case of alif with tanween fath (اً) by removing both.
    text = text.replace(/اً/g, '');
    // Then, remove other diacritics.
    return text.replace(/[ً-ْٰۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, "");
  };

  // Function to normalize Arabic text
  const normalizeText = (text) => {
    return text
      .replace(/[إأآا]/g, 'ا') // Normalize alif with hamza
      .replace(/[ؤ]/g, 'و')   // Normalize waw with hamza
      .replace(/[ئ]/g, 'ي')   // Normalize yaa with hamza
      .replace(/ء/g, '')      // Remove standalone hamza
      .replace(/ى/g, 'ي')     // Normalize alif maqsura to yaa
      .replace(/ة/g, 'ه');    // Normalize teh marbuta to heh
  };

  // Function to get the core word by removing common prefixes and suffixes
  const getCoreWord = (word) => {
    // First, remove punctuation from the word
    let cleanedWord = word.replace(/[،,\.؛;:!؟?]/g, '');

    let core = normalizeText(removeDiacritics(cleanedWord));

    // Handle prefixes - order is important
    // Remove prefixes that don't typically combine with ال
    core = core.replace(/^(و|ف|س)+/, '');

    // Handle ب, ك, ل prefixes, which can be followed by ال
    if (core.startsWith('ب')) {
      core = core.substring(1);
      if (core.startsWith('ال')) {
        core = core.substring(2);
      }
    } else if (core.startsWith('ك')) {
      core = core.substring(1);
      if (core.startsWith('ال')) {
        core = core.substring(2);
      }
    } else if (core.startsWith('لل')) { // Special case for ل + ال
      core = core.substring(2);
    } else if (core.startsWith('ل')) {
      core = core.substring(1);
    } else if (core.startsWith('ال')) {
      core = core.substring(2);
    }

    // Remove common suffixes (including the problematic 'ا' vs 'و' endings)
    // First handle the specific case of 'وا' vs 'و' endings
    if (core.endsWith('وا')) {
      core = core.slice(0, -2) + 'و'; // Replace 'وا' with 'و'
    }

    // Then handle other common suffixes
    core = core.replace(/(ه|ها|هم|هن|ك|كم|كن|ي|نا|ون|ين|ات|ا)$/, '');

    return core;
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // Function to highlight choice words in red for contextual error questions
  const highlightChoiceWords = (questionText, choices, questionType) => {
    if (questionType !== 'error' || !choices || !questionText) {
      return escapeHtml(questionText);
    }

    const words = questionText.split(/(\s+|[،.؛:()])/);
    const highlightedWords = words.map(escapeHtml);

    // Pre-process choices to handle the A(B) format by splitting them into independent choices.
    const processedChoices = [];
    choices.forEach(choice => {
      const trimmedChoice = choice.trim();
      if (!trimmedChoice) return;
      if (trimmedChoice.includes('(') && trimmedChoice.includes(')')) {
        const parts = trimmedChoice.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
        processedChoices.push(...parts);
      } else {
        processedChoices.push(trimmedChoice);
      }
    });

    processedChoices.forEach(choice => {
      const choiceWords = choice.split(/\s+/).filter(Boolean);

      const questionWordsWithIndices = words
        .map((word, index) => ({ word, index }))
        .filter(item => item.word.trim() !== '' && !/^[،.؛:()]/.test(item.word.trim()) && !item.word.includes('\u200e'));

      let exactMatchesFound = false;
      const exactMatchIndices = [];

      // Pass 1: Check for exact matches for this choice
      for (let i = 0; i <= questionWordsWithIndices.length - choiceWords.length; i++) {
        let isExactMatch = true;
        for (let j = 0; j < choiceWords.length; j++) {
          if (questionWordsWithIndices[i + j].word !== choiceWords[j]) {
            isExactMatch = false;
            break;
          }
        }
        if (isExactMatch) {
          exactMatchesFound = true;
          for (let j = 0; j < choiceWords.length; j++) {
            exactMatchIndices.push(questionWordsWithIndices[i + j].index);
          }
          i += choiceWords.length - 1;
        }
      }

      if (exactMatchesFound) {
        // If we found exact matches, only highlight them
        exactMatchIndices.forEach(index => {
          if (!highlightedWords[index].includes('<span')) {
            highlightedWords[index] = `<span style="color: red; font-weight: bold;">${escapeHtml(words[index])}</span>`;
          }
        });
      } else {
        // Pass 2: No exact match, use normalization and fuzzy matching.
        const coreChoiceWords = choiceWords.map(getCoreWord);
        for (let i = 0; i <= questionWordsWithIndices.length - choiceWords.length; i++) {
          let isNormalizationMatch = true;
          for (let j = 0; j < coreChoiceWords.length; j++) {
            const coreQuestionWord = getCoreWord(questionWordsWithIndices[i + j].word);
            const coreChoiceWord = coreChoiceWords[j];

            // First, check for exact match after normalization
            if (coreChoiceWord === coreQuestionWord) {
              continue;
            }

            // If not exact, check for fuzzy match (Levenshtein distance of 1)
            // To reduce false positives, we only allow this for words of reasonable length.
            if (coreChoiceWord.length < 4 || levenshteinDistance(coreChoiceWord, coreQuestionWord) !== 1) {
              isNormalizationMatch = false;
              break;
            }
          }

          if (isNormalizationMatch) {
            for (let j = 0; j < coreChoiceWords.length; j++) {
              const originalIndex = questionWordsWithIndices[i + j].index;
              if (!highlightedWords[originalIndex].includes('<span')) {
                highlightedWords[originalIndex] = `<span style="color: red; font-weight: bold;">${escapeHtml(words[originalIndex])}</span>`;
              }
            }
            i += coreChoiceWords.length - 1;
          }
        }
      }
    });

    return highlightedWords.join('');
  };

  // Function to render highlighted text
  const renderHighlightedText = (text) => {
    return <div dangerouslySetInnerHTML={{ __html: text }} />;
  };

  if (!examQuestions || examQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center" dir="rtl">
        <div className="text-center backdrop-blur-sm rounded-2xl p-4 sm:p-8 shadow-xl mx-4">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-medium text-gray-900">جاري تحميل الاسئلة...</div>
          <div className="text-sm text-gray-600 mt-2">يرجى الانتظار</div>
        </div>
      </div>
    );
  }

  const currentQuestion = examQuestions[currentQuestionIndex];

  if (!currentQuestion) {
    // This can happen if the exam is resetting or questions are not loaded yet.
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center" dir="rtl">
        <div className="text-center backdrop-blur-sm rounded-2xl p-4 sm:p-8 shadow-xl mx-4">
          <div className="text-lg sm:text-xl font-medium text-gray-900">...</div>
        </div>
      </div>
    );
  }

  // START: REVISED MODIFICATION FOR TARQA TEST
  // Check if the question data includes a 'category' field, which indicates it's from the "tarqa" test.
  const isTarqaTest = currentQuestion.category !== undefined;

  // Map Arabic categories to English keys used in explanation logic
  const categoryMap = {
    'التناظر اللفظي': 'analogy',
    'اكمال الجمل': 'completion',
    'الخطا السياقي': 'error',
    'استيعاب المقروء': 'rcbank4',
    'الارتباط والاختلاف': 'odd',
  };

  // Determine if the question is a contextual error type for highlighting
  const isErrorQuestion = currentQuestion.type === 'error' ||
    (isTarqaTest && currentQuestion.category && currentQuestion.category.trim() === 'الخطا السياقي');
  // END: REVISED MODIFICATION FOR TARQA TEST

  const selectedAnswer = userAnswers[currentQuestion.question_number];
  const isDeferred = deferredQuestions[currentQuestion.question_number];
  const isMarked = markedQuestions[currentQuestion.question_number];
  const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const examInfo = getCurrentExamInfo();

  const isQuestionInFolder = useMemo(() => {
    if (!selectedFolder || !folders[selectedFolder]) {
      return false;
    }
    return folders[selectedFolder].questions.some(q => q.question === currentQuestion.question && JSON.stringify(q.choices) === JSON.stringify(currentQuestion.choices));
  }, [selectedFolder, folders, currentQuestion]);

  const categoryDisplayNameMap = {
    'bank1': 'البنك الأول (محوسب 2025)',
    'bank2': 'البنك الثاني',
    'bank3': 'البنك الثالث',
    'rcbank4': 'استيعاب المقروء',
    'rcbank5': 'استيعاب المقروء',
    'analogy': 'التناظر اللفظي',
    'completion': 'اكمال الجمل',
    'error': 'الخطا السياقي',
    'odd': 'الارتباط والاختلاف',
  };
  const bankName = categoryDisplayNameMap[examInfo.category];

  // Check if we can go to previous question (not first question and not first question of current section)
  const canGoPrevious = () => {
    if (sectionReviewFilter !== 'all') {
      return currentFilteredIndex > 0;
    }

    if (isFirstQuestion) return false;

    // Allow going back if examMode is not 'sectioned' (i.e., combined test)
    if (examMode !== 'sectioned') {
      return true;
    }

    const currentQuestionNumber = currentQuestionIndex + 1;
    const isFirstQuestionInSection = (currentQuestionNumber - 1) % 11 === 0;

    // If we're at the first question of a section and it's not the very first question, prevent going back
    if (isFirstQuestionInSection && currentQuestionIndex > 0) {
      return false;
    }

    return true;
  };

  // Allow navigation for all question types - removed answer requirement
  const canProceed = true;

  // Check if there are any deferred questions in the current section
  const hasDeferredQuestionsInCurrentSection = () => {
    const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;

    if (isLastQuestion) {
      return examQuestions.some(q => deferredQuestions[q.question_number]);
    }
    // Original logic
    return examQuestions
      .filter(q => q.section === currentSection)
      .some(q => deferredQuestions[q.question_number]);
  };

  const handleAnswerSelect = (choiceIndex) => {
    selectAnswer(currentQuestion.question_number, choiceIndex);
  };

  const handleDeferToggle = () => {
    toggleDeferred(currentQuestion.question_number);
  };

  const handleMarkToggle = () => {
    toggleMarked(currentQuestion.question_number);
  };

  const handleNext = () => {
    nextQuestion();
  };

  const handlePrevious = () => {
    previousQuestion();
  };

  const handleTextEnlarge = () => {
    setIsTextEnlarged(true);
  };

  const handleCloseEnlargedText = () => {
    setIsTextEnlarged(false);
  };

  // Function to handle section review button
  const handleSectionReview = () => {
    // Navigate to section review page using the store function
    console.log("Navigating to section review page for section:", currentSection);
    goToSectionReview();
  };

  // Function to check if section review button should be shown
  const shouldShowSectionReviewButton = () => {
    if (examMode !== 'sectioned') {
      return false;
    }
    // The button should only show if we have been to the review screen for the current section.
    // The `reviewedSection` state from the store holds the number of the section being reviewed.
    return reviewedSection === currentSection;
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeLabel = (type) => {
    const labels = {
      'analogy': 'التناظر اللفظي',
      'completion': 'اكمال الجمل',
      'error': 'الخطا السياقي',
      'rcbank4': 'استيعاب المقروء',
      'rcbank5': 'استيعاب المقروء',
      'odd': 'الارتباط والاختلاف',
      'Tarqa': 'طرقعة'
    };
    return labels[type] || type;
  };

  const getQuestionTypeExplanation = (type) => {
    const explanations = {
      'analogy': 'في بداية كل سؤال ممَّا يأتي، كلمتان ترتبطان بعلاقة معينة، تتبعها أربعة أزواج من الكلمات، أحدها ترتبط فيه الكلمتان بعلاقة مشابهة للعلاقة بين الكلمتين في بداية السؤال. الطلوب هو اختيار الإجابة الصحيحة.',
      'completion': 'تلي كل جملة من الجمل الآتية أربعة اختيارات ، أحدها يُكمل الفراغ أو الفراغات في الجملة إكمالاً صحيحاً . المطلوب هو اختيار الإجابة الصحيحة.',
      'error': 'في كل جملة مما يأتي أربع كلمات كل منها مكتوبة بخط غليظ . المطلوب هو: تحديد الكلمة التي لا يتفق معناها مع المعنى العام للجملة. (الخطأ ليس إملائياً ولا نحوياً).',
      'rcbank4': 'السؤال التالي يتعلق بالنص المرفق , بعد السؤال هناك أربع اختيارات , واحد منها صحيح المطلوب , هو قراءة النص بعناية , ثم اختيار الإجابة الصحيحة',
      'rcbank5': 'السؤال التالي يتعلق بالنص المرفق , بعد السؤال هناك أربع اختيارات , واحد منها صحيح المطلوب , هو قراءة النص بعناية , ثم اختيار الإجابة الصحيحة',
      'odd': 'السؤال الاتي يحتوي على أربع كلمات. تتشابه ثلاثة من هذه الكلمات بناءً على سمة معينة، بينما تكون الكلمة الرابعة مختلفة عنها. سيكون مطلوبًا منك تحديد الكلمة المختلفة. ',
      'Tarqa': ''
    };
    return explanations[type] || '';
  };

  const stats = getQuestionStats();
  // Determine if it's the last question of a section or the exam to show the correct icon
  const isLastFilteredQuestion = sectionReviewFilter !== 'all' && currentFilteredIndex === filteredQuestionIndices.length - 1;
  const isLastQuestionInSection = (currentQuestionIndex + 1) % 11 === 0;
  const showLoginIcon = isLastFilteredQuestion || isLastQuestion || (isLastQuestionInSection && examMode === 'sectioned');

  // Determine button text and style based on whether it's the last question
  const getNextButtonText = () => {
    if (isLastFilteredQuestion) {
      return 'انهاء المراجعة';
    }

    const currentQuestionNumber = currentQuestionIndex + 1;
    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

    if (isLastQuestion) {
      return 'انهاء الاختبار';
    } else if (isLastQuestionInSection && examMode === 'sectioned') {
      return 'انهاء القسم';
    }

    return 'التالي';
  };

  const getNextButtonMobileText = () => {
    if (isLastFilteredQuestion) {
      return 'انهاء المراجعة';
    }

    const currentQuestionNumber = currentQuestionIndex + 1;
    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

    if (isLastQuestion) {
      return 'انهاء الاختبار';
    } else if (isLastQuestionInSection && examMode === 'sectioned') {
      return 'انهاء القسم';
    }

    return 'التالي';
  };

  return (
    <>
      <style>{`
@media (min-width: 768px) {
        /* --- Custom Scrollbar Styles (Webkit Browsers) --- */

        /* 1. Sets the overall size of the scrollbar */
        ::-webkit-scrollbar {
        width: 16px;  /* For vertical scrollbars */
        height: 16px; /* For horizontal scrollbars */
        }

        /* 2. The track (the background of the scrollbar) */
        ::-webkit-scrollbar-track {
        background-color: #add1ff; /* A light gray background */
        border: 1px solid #a9a9a9;  /* A medium gray border */

        /* This creates the subtle dotted pattern from the image */
        background-image: radial-gradient(circle, rgba(0, 0, 0, 0.2) 1px, transparent 1px);
        background-size: 3px 3px;
        }

        /* 3. The draggable scrolling handle (the thumb) */
        ::-webkit-scrollbar-thumb {
        background-color: #ffffff; /* White base color */
        border: 1px solid #828282;  /* Dark gray border for the thumb */
        border-radius: 2px; /* Slight rounding for a softer look */
        }

        /* 4. Hover effect for the thumb for better user experience */
        ::-webkit-scrollbar-thumb:hover {
        background-color: #f0f0f0; /* A light gray on hover */
        }

        /* 5. The buttons on either end of the scrollbar (arrows) */
        ::-webkit-scrollbar-button {
        background-color: #add1ff; /* A neutral gray to match the theme */
        border: 1px solid #828282;  /* Matching dark gray border */
        background-repeat: no-repeat;
        background-position: center;
        }

        /* 6. Style for the up-arrow button */
        ::-webkit-scrollbar-button:vertical:decrement {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='black' viewBox='0 0 16 16'><path d='m7.247 4.86-4.796 5.481c-.566.647-.106 1.659.753 1.659h9.592a1 1 0 0 0 .753-1.659l-4.796-5.48a1 1 0 0 0-1.506 0z'/></svg>");
        }

        /* 7. Style for the down-arrow button */
        ::-webkit-scrollbar-button:vertical:increment {
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='black' viewBox='0 0 16 16'><path d='M7.247 11.14 2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/></svg>");
        }

        /* 8. Active state for buttons */
        ::-webkit-scrollbar-button:active {
            background-color: #c0c0c0; /* Darken button when clicked */
        }
    }
        .hover-yellow-text:hover span, .hover-yellow-text:hover svg {
          color: yellow !important;
          stroke: yellow !important;
        }
        /* Remove all hover, shadow, and transform effects from buttons and interactive elements */
        .no-hover, .no-hover:focus, .no-hover:active {
          background: transparent !important;
          color: white !important;
          box-shadow: none !important;
          outline: none !important;
          border: none !important;
          filter: none !important;
          transition: none !important;
          transform: none !important;
        }
        .no-hover:hover {
            background: transparent !important;
        }
        .no-hover span {
          color: white !important;
        }
        .no-hover svg {
          stroke: white !important;
        }
        .no-hover:hover span {
          color: yellow !important;
        }
        .no-hover:hover svg {
          stroke: yellow !important;
        }
        .no-hover * {
          box-shadow: none !important;
          filter: none !important;
          transition: none !important;
        }
        .shadow-lg, .shadow-xl, .hover\:shadow-xl, .hover\:shadow-lg, .transform, .hover\:scale-105, .transition-all, .duration-300 {
          box-shadow: none !important;
          filter: none !important;
          transition: none !important;
          transform: none !important;
        }
        .hide-close-button > button {
            display: none;
        }
      `}</style>
      <div className={`min-h-screen flex flex-col ${nightMode ? 'bg-slate-900 text-slate-200' : 'bg-white'}`} dir="rtl" style={{ fontFamily: 'arial', zoom: isMobile ? '110%' : '130%' }}>
        <div className="sticky top-0 z-20">
          {/* Enhanced Header - Consistent Size Across All Devices */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[#005085ff]"></div>
            <div className="">
              <div className="mx-auto">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="hidden md:flex items-center gap-3">
                    <div className="backdrop-blur-sm rounded-xl px-4 py-1">
                      <div className="text-white text-xl">
                        محاكي الطرقعة{examInfo?.exam ? ` - ${examInfo.exam}` : ''}{userInfo ? ` - ${userInfo.first_name} ${userInfo.last_name}` : ''}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      className="text-white hover:bg-white/20 hover:text-yellow-300 no-hover"
                      onClick={() => {
                        if (window.confirm('هل أنت متأكد من خروجك؟ سيتم إعادة تعيين الاختبار.')) {
                          useExamStore.getState().resetExam();
                        }
                      }}
                    >
                    </Button>
                  </div>

                  <div className="w-full md:w-auto flex items-center gap-3 flex-wrap">
                    <div className="w-full flex flex-row-reverse md:flex-col justify-between items-center md:items-end">
                      {timerActive && (
                        <div className="backdrop-blur-sm rounded-xl px-4 py-1 hover-yellow-text">
                          <div className={`text-sm md:text-base flex items-center gap-2 ${timeRemaining < 300 ? 'text-[#ffff00]' : 'text-white'}`}> {/* Removed animate-pulse */}
                            <Clock className="h-5 w-5" />
                            <span className="hidden md:inline">الوقت المتبقي</span>
                            <span className="text-sm md:text-base tracking-wide">{formatTime(timeRemaining)}</span>
                          </div>
                        </div>
                      )}
                      <div className="backdrop-blur-sm rounded-xl px-4 py-1 hover-yellow-text">
                        <div className="text-white text-sm md:text-base flex items-center gap-2">
                          <GalleryVertical className="h-5 w-5" />
                          <span>
                            {getDisplayQuestionNumber()}
                            <span className="md:hidden"> / </span>
                            <span className="hidden md:inline"> من </span>
                            {getTotalQuestionsDisplay()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-0.5 bg-white w-full"></div>

          {/* Second Header */}
          <div className="relative overflow-hidden bg-[#0066a1ff]">
            <div className="mx-auto">
              {isMobile ? (
                <div className="flex justify-between items-center px-4">
                  <div>
                    {!reviewMode && !examCompleted && (
                      <Button
                        onClick={handleMarkToggle}
                        className="py-2 text-white font-medium text-base cursor-pointer bg-transparent hover:bg-transparent hover-yellow-text"
                      >
                        <Flag
                          className={`h-5 w-5 ml-2 -scale-x-100 -rotate-10 transition-colors ${isMarked ? 'fill-[#ffff00]' : ''}`}
                        />
                        <span>
                          {isMarked ? 'تمييز السؤال للمراجعة' : 'تمييز السؤال للمراجعة'}
                        </span>
                      </Button>
                    )}
                  </div>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="" className="bg-transparent p-2 text-white no-hover cursor-pointer">
                        <span>{fontSizeMap[fontSize]}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      dir="rtl"
                      className="bg-[#0066a1ff] rounded-none"
                    >
                      <DropdownMenuItem onClick={() => setFontSize('normal')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عادي</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFontSize('large')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عريض</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setFontSize('larger')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عريض بزيادة</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <div className="flex justify-end items-center px-4">
                  <div className="flex items-center">
                    {!reviewMode && !examCompleted && (
                      <Button
                        onClick={handleMarkToggle}
                        className="py-2 text-white font-medium text-base cursor-pointer bg-transparent hover:bg-transparent hover-yellow-text"
                      >
                        <Flag
                          className={`h-5 w-5 ml-2 -scale-x-100 -rotate-10 transition-colors ${isMarked ? 'fill-[#ffff00]' : ''}`}
                        />
                        <span>
                          {isMarked ? 'تمييز السؤال للمراجعة' : 'تمييز السؤال للمراجعة'}
                        </span>
                      </Button>
                    )}
                    <div className="w-px self-stretch bg-white mx-2"></div>
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="" className="bg-transparent p-2 text-white no-hover cursor-pointer">
                          <span>{fontSizeMap[fontSize]}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        dir="rtl"
                        className="bg-[#0066a1ff] rounded-none"
                      >
                        <DropdownMenuItem onClick={() => setFontSize('normal')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عادي</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFontSize('large')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عريض</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setFontSize('larger')} className="text-white hover:bg-transparent focus:bg-transparent focus:text-white font-serif">خط عريض بزيادة</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Main Content - Split View */}
        <div className="flex flex-col lg:flex-row w-full flex-grow">

          {/* Question Area */}
          <div className="w-full lg:w-1/2 p-4 pb-24 sm:pb-20 border-b-[15px] border-[#005085ff] relative overflow-hidden">
            <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-6 lg:p-4 xl:p-4 min-w-0 w-full overflow-hidden relative ${nightMode ? 'bg-slate-900 text-slate-200' : 'bg-white'}`}>
              {/* Telegram ID Watermark to prevent leaking - 3 watermarks */}
              {displayId && (
                <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none z-10 overflow-hidden select-none py-6">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex items-center w-full px-8 ${
                        i === 0 ? 'justify-start' : i === 1 ? 'justify-center' : 'justify-end'
                      }`}
                    >
                      <div
                        className="text-xs sm:text-sm md:text-base text-gray-400 dark:text-gray-500 font-mono"
                        style={{ transform: 'rotate(-30deg)', opacity: '0.35' }}
                      >
                        {displayId}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reading passage for RC questions - Mobile Optimized */}
              {currentQuestion.passage && (
                <div className={`font-medium leading-relaxed mb-6 sm:mb-8 lg:mb-6 xl:mb-6 text-right break-words overflow-wrap-anywhere ${nightMode ? 'text-slate-200' : 'text-gray-900'} ${fontSize === 'smaller' ? 'text-sm sm:text-base' : fontSize === 'small' ? 'text-base sm:text-lg' : fontSize === 'normal' ? 'text-lg sm:text-xl' : fontSize === 'large' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>
                  {currentQuestion.passage}
                </div>
              )}

              {/* Question text / Image - Mobile Optimized with highlighting for error questions */}
              <div className={`font-medium leading-relaxed mb-3 sm:mb-6 lg:mb-3 xl:mb-3 text-right break-words overflow-wrap-anywhere ${nightMode ? 'text-slate-200' : 'text-gray-900'} ${fontSize === 'smaller' ? 'text-sm sm:text-base' : fontSize === 'small' ? 'text-base sm:text-lg' : fontSize === 'normal' ? 'text-lg sm:text-xl' : fontSize === 'large' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>
                {!(currentQuestion.image || currentQuestion.image_url) && (
                  isErrorQuestion ?
                    renderHighlightedText(highlightChoiceWords(currentQuestion.question, currentQuestion.choices, 'error')) :
                    currentQuestion.question
                )}
                {(currentQuestion.image || currentQuestion.image_url) && (
                  <div className="flex justify-center w-full max-w-full overflow-hidden my-2">
                    <img
                      src={getImageUrl(currentQuestion.image || currentQuestion.image_url, currentQuestion)}
                      alt={`Question ${currentQuestion.question_number}`}
                      className="w-full max-w-full md:max-w-[520px] lg:max-w-[560px] xl:max-w-[600px] h-auto max-h-[38vh] md:max-h-[40vh] object-contain rounded-lg cursor-zoom-in block mx-auto shadow-sm"
                      onClick={() => {
                        setZoomedImageUrl(getImageUrl(currentQuestion.image || currentQuestion.image_url, currentQuestion));
                        setIsImageZoomModalOpen(true);
                      }}
                      onError={(e) => {
                        if (e.target.dataset.fallbackTried) return;
                        e.target.dataset.fallbackTried = 'true';
                        const rawSrc = currentQuestion.image_url || currentQuestion.image || '';
                        if (!rawSrc) return;
                        let clean = rawSrc;
                        if (clean.includes('img=')) {
                          clean = decodeURIComponent(clean.split('img=')[1].split('&')[0]);
                        }
                        clean = clean.replace(/^https?:\/\/[^\/]+\/Data\//i, '').replace(/^https?:\/\/[^\/]+\//i, '').split('?')[0];
                        if (clean.startsWith('images/')) clean = 'search/' + clean;
                        if (!clean.includes('/')) clean = 'search/images/' + clean;
                        if (clean && !clean.includes('get_image')) {
                          e.target.src = `/get_image.php?img=${encodeURIComponent(clean)}&_v=${APP_CACHE_BUSTER}`;
                        }
                      }}
                      onDragStart={(e) => e.preventDefault()}
                    />
                  </div>
                )}
              </div>

              {/* Answer choices - Mobile Optimized with proper bottom spacing */}
              <div className="space-y-1 sm:space-y-2 lg:space-y-1 xl:space-y-1 mb-6 sm:mb-8">
                <RadioGroup
                  dir="rtl"
                  value={selectedAnswer?.toString() || ''}
                  onValueChange={(value) => handleAnswerSelect(parseInt(value))}
                  className="space-y-1 sm:space-y-2"
                >
                  {currentQuestion.choices && currentQuestion.choices.map((choice, index) => (
                    <div
                      key={index}
                      className={`flex items-center space-x-2 rounded-lg sm:rounded-xl backdrop-blur-sm cursor-pointer ${nightMode ? 'bg-slate-900 text-slate-200' : 'bg-white'}`}
                      onClick={() => handleAnswerSelect(index)}
                    >
                      <RadioGroupItem
                        value={index.toString()}
                        id={`choice-${index}`}
                        className={`flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none ${nightMode ? 'border-white text-white' : ''}`}
                      />
                      <Label
                        htmlFor={`choice-${index}`}
                        className={`flex-1 cursor-pointer leading-relaxed text-right font-medium pointer-events-none break-words overflow-wrap-anywhere ${nightMode ? 'text-slate-200' : 'text-gray-800'} ${fontSize === 'smaller' ? 'text-sm sm:text-base' : fontSize === 'small' ? 'text-base sm:text-lg' : fontSize === 'normal' ? 'text-lg sm:text-xl' : fontSize === 'large' ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'}`}>
                        {choice}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>
          {/* Separator */}
          <div className="md:hidden w-full h-[15px] bg-[#005085ff]" />
          <div className="hidden md:block w-[15px] bg-[#005085ff]"></div>
          {/* Instruction Panel */}
          <div className="w-full lg:w-1/2 p-4 pb-28 sm:pb-20">
            <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-4 xl:p-4 min-w-0 w-full ${nightMode ? 'bg-slate-900 text-slate-200' : 'bg-white'}`}>
              <div className="text-[#ff0000]">
                <h3 className="text-xl flex items-center gap-0 font-bold mb-2">
                  {(currentQuestion.image || currentQuestion.image_url) ? 'أسئلة الاختيار من متعدد' : (isTarqaTest && currentQuestion.category ? currentQuestion.category.trim() : getQuestionTypeLabel(currentQuestion.type))}
                </h3>
              </div>
              <div className="">
                <div className="text-[#ff0000] leading-relaxed" style={{ lineHeight: '2' }}>
                  {(currentQuestion.image || currentQuestion.image_url)
                    ? 'فيما يلي سؤال يتبعه أربعة خيارات، اختر منها الإجابة الصحيحة.'
                    : (isTarqaTest && currentQuestion.category
                      ? getQuestionTypeExplanation(categoryMap[currentQuestion.category.trim()] || 'Tarqa')
                      : getQuestionTypeExplanation(currentQuestion.type))}
                </div>
              </div>

              <Button onClick={() => setIsFolderDialogOpen(true)} className={`py-2 font-medium text-base cursor-pointer bg-transparent hover:bg-transparent hover-yellow-text ${nightMode ? 'text-white' : 'text-black'}`}>
                <FolderPlus className="h-7 w-7 ml-2" />
              </Button>
            </div>
          </div>
        </div>

        {isFolderDialogOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" dir="rtl" style={{ fontFamily: 'serif' }}>
            <div className="bg-[#005085ff] max-w-md w-full mx-4 shadow-md border border-white">
              <div className="bg-[#005085ff] p-2 flex justify-between items-center border-b border-white">
                <div className="flex items-center gap-2">
                  <FolderPlus className="h-6 w-6 text-white" />
                  <h3 className="text-white">
                    المجلدات
                  </h3>
                </div>
                <button
                  onClick={() => setIsFolderDialogOpen(false)}
                  className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer"
                >
                  <SquareX className="h-6 w-6 text-white" />
                </button>
              </div>

              <div className="p-6 text-right text-white space-y-4 text-base">
                <div>
                  <h5 className="text-white">اختر مجلدًا</h5>
                  <div className="flex items-center gap-2">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="bg-transparent hover:bg-transparent hover:text-yellow-200 text-white border-white cursor-pointer">
                          {selectedFolder || "اختر"}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent dir="rtl" style={{ fontFamily: 'serif' }} className="bg-[#005085ff] hover:text-white text-white border-white w-32">
                        {Object.values(folders).map((folder) => (
                          <DropdownMenuItem
                            key={folder.name}
                            onSelect={() => setSelectedFolder(folder.name)}
                            className="hover:bg-transparent focus:bg-transparent cursor-pointer focus:text-yellow-200"
                          >
                            {folder.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button onClick={() => setIsCreatingFolder(!isCreatingFolder)} className="p-2 cursor-pointer bg-transparent text-white hover:bg-transparent rounded-none hover-yellow-text focus-visible:ring-0 focus-visible:ring-offset-0 outline-none">
                      <FolderPlus className="h-7 w-7" />
                    </Button>
                    {isQuestionInFolder && <CheckCircle className="h-5 w-5 text-green-400" />}
                  </div>
                  {isCreatingFolder && (
                    <div className="mt-4 w-48">
                      <Label htmlFor="new-folder-name" className="text-white">اسم المجلد الجديد</Label>
                      <Input
                        id="new-folder-name"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        className="bg-transparent text-white mt-2"
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
                        className="mt-2 cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
                      >
                        انشاء
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-4 pb-4 flex justify-center gap-3">
                <Button
                  onClick={() => {
                    if (selectedFolder) {
                      const folder = folders[selectedFolder];
                      if (folder) {
                        const questionExists = folder.questions.some(q => q.question === currentQuestion.question && JSON.stringify(q.choices) === JSON.stringify(currentQuestion.choices));
                        if (questionExists) {
                          toast.info(`السؤال موجود بالفعل في مجلد "${selectedFolder}"`);
                        } else {
                          addQuestionToFolder(selectedFolder, currentQuestion);
                          toast.success(`تمت إضافة السؤال إلى مجلد "${selectedFolder}"`);
                        }
                      }
                    }
                    setIsFolderDialogOpen(false);
                  }}
                  disabled={!selectedFolder}
                  className="cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
                >
                  <span>اضافة</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Navigation Footer - Mobile Optimized */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="backdrop-blur-sm border-t">
            <div className="absolute inset-0 bg-[#005085ff]"></div>
            <div className="relative mx-auto">
              {/* Mobile View */}
              <div className="flex md:hidden justify-between items-stretch w-full">
                <div className="flex items-stretch w-1/3 justify-start">
                  {/* Previous Button */}
                  {canGoPrevious() && (
                    <Button
                      onClick={handlePrevious}
                      disabled={!canGoPrevious()}
                      className="text-lg font-bold rounded-none disabled:opacity-50 sm:disabled:opacity-0 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-4"
                      size="lg"
                    >
                      <ArrowRight className="h-7 w-7 ml-2" />
                      <span>السابق</span>
                    </Button>
                  )}
                </div>
                <div className="flex items-stretch w-1/3 justify-center">
                  {/* Section Review Button */}
                  {shouldShowSectionReviewButton() && (
                    <Button
                      onClick={handleSectionReview}
                      className="text-lg font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover p-4"
                    >
                      <ArrowRightToLine className="h-7 w-7" />
                    </Button>
                  )}
                </div>
                <div className="flex items-stretch w-1/3 justify-end">
                  {/* Next Button */}
                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className='text-lg font-bold rounded-none disabled:opacity-50 sm:disabled:opacity-0 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-4'
                    size="lg"
                  >
                    <span>{getNextButtonMobileText()}</span>
                    {showLoginIcon ? (
                      <LogIn className="h-7 w-7 mr-2 -scale-x-100" />
                    ) : (
                      <ArrowLeft className="h-7 w-7 mr-2" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:flex items-stretch">
                {/* Equations Button */}
                <Dialog modal={false} onOpenChange={(isOpen) => { if (!isOpen) setIsEquationZoomed(false); }}>
                  <DialogTrigger asChild>
                    <Button
                      variant="ghost"
                      className="text-lg font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover p-2 cursor-pointer"
                    >
                      <CircleHelp className="h-5 w-5 ml-2" />
                      <span className="inline">المعادلات</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent
                    className="p-0 border-0 max-w-3xl hide-close-button"
                    dir="rtl"
                  >
                    <DialogHeader className="bg-[#005085ff] text-white p-4 relative h-14"> {/* Added h-14 for a consistent height */}
                      {/* Title and Icon on the right */}
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <CircleHelp className="h-6 w-6" />
                        <DialogTitle className="font-serif font-normal text-xl">المعادلات</DialogTitle>
                      </div>
                      <DialogDescription className="sr-only">عرض المعادلات الرياضية</DialogDescription>

                      {/* Close Button on the left */}
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <DialogClose asChild>
                          <Button
                            variant=""
                            className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer"
                          >
                            <SquareX className="h-6 w-6 text-white" />
                          </Button>
                        </DialogClose>
                      </div>
                    </DialogHeader>
                    <div>
                      <img
                        src={EquationImage}
                        alt="Equations"
                        className="w-full h-auto"
                      />
                    </div>
                  </DialogContent>
                </Dialog>
                <div className="w-0.5 self-stretch bg-white mx-2"></div>

                {/* Section Review Button on the right */}
                {shouldShowSectionReviewButton() && (
                  <Button
                    onClick={handleSectionReview}
                    className="text-lg font-bold rounded-lg flex-shrink-0 cursor-pointer bg-transparent no-hover p-2"
                  >
                    <ArrowRightToLine className="h-5 w-5 ml-2" />
                    <span className="inline">شاشة المراجعة</span>
                  </Button>
                )}
                {shouldShowSectionReviewButton() && <div className="w-0.5 self-stretch bg-white mx-2"></div>}

                <div className="flex-1"></div>

                <div className="flex items-stretch">
                  {canGoPrevious() && <div className="w-0.5 self-stretch bg-white mx-1"></div>}
                  <Button
                    onClick={handlePrevious}
                    disabled={!canGoPrevious()}
                    className="text-lg font-bold rounded-r-lg disabled:opacity-0 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer bg-transparent no-hover border-0"
                    size="sm"
                  >
                    <ArrowRight className="h-5 w-5 ml-2" />
                    <span className="inline">السابق</span>
                  </Button>

                  <div className="w-0.5 self-stretch bg-white mx-2"></div>

                  <Button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className='text-lg font-bold rounded-l-lg disabled:opacity-50 sm:disabled:opacity-0 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer bg-transparent no-hover border-0'
                    size="sm"
                  >
                    <span className="inline">{getNextButtonText()}</span>
                    {showLoginIcon ? (
                      <LogIn className="h-5 w-5 mr-2 -scale-x-100" />
                    ) : (
                      <ArrowLeft className="h-5 w-5 mr-2" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Timer Modal */}
      {isTimerModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" dir="rtl" style={{ fontFamily: 'serif' }}>
          {/* Main Modal Container with Classic Styling */}
          <div className="bg-[#005085ff] max-w-md w-full mx-4 shadow-md border border-white">

            {/* Title Bar */}
            <div className="bg-[#005085ff] p-2 flex justify-between items-center border-b border-white">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-6 w-6 text-white" />
                <h3 className="text-white">
                  تحذير!
                </h3>
              </div>
              <button
                onClick={() => setIsTimerModalOpen(false)}
                className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer"
              >
                <SquareX className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 text-right text-white space-y-4 text-base">
              <p className="leading-relaxed text-lg">
                {timerModalMessage}
              </p>
            </div>

            {/* Action Button */}
            <div className="px-4 pb-4 flex justify-center gap-3">
              {/* Confirm Button (Primary Action) */}
              <Button
                onClick={() => setIsTimerModalOpen(false)}
                className="cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
              >
                <span>حسنا</span>
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* exit dialog */}
      <Dialog modal={false} open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent dir="rtl" className="bg-[#112240] border-slate-700 max-w-md w-full p-0 overflow-hidden">
          {/* Modal Header */}
          <div className="p-1 text-center">
            <div className="flex justify-center mb-1">
              <div className="p-5 transition-transform duration-300 hover:scale-110">
                <TriangleAlert className="h-8 w-8 text-cyan-400" />
              </div>
            </div>
            <DialogTitle className="text-xl font-bold text-white mb-2">
              تأكيد الخروج
            </DialogTitle>
            <DialogDescription className="sr-only">
              تأكيد الخروج من الاختبار
            </DialogDescription>
          </div>

          {/* Modal Content */}
          <div className="p-6 pt-0">
            {/* Centered Text Container */}
            <div className="flex items-center justify-center text-center mb-8 h-24">
              <p className="text-slate-300 text-base leading-relaxed">
                هل أنت متأكد من خروجك؟ سيتم إعادة تعيين الاختبار.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row-reverse gap-3">
              {/* Confirm Button (Primary Action) */}
              <Button
                onClick={() => {
                  setIsExitDialogOpen(false);
                  useExamStore.getState().resetExam();
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
              >
                نعم
              </Button>
              {/* Cancel Button (Secondary Action) */}
              <Button
                onClick={() => setIsExitDialogOpen(false)}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
              >
                الغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
}

export default QuestionDisplay;
