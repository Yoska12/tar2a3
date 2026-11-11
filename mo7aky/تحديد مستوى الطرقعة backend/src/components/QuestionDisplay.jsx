import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Clock, Flag, Filter, BarChart3, BookOpen, GraduationCap, Target, CheckCircle, Home, X, ZoomIn, RotateCcw, FolderPlus, SquareX, TriangleAlert } from 'lucide-react';
import { useExamStore } from '../store/examStore';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { useIsMobile } from '../hooks/use-mobile';

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
  const isMobile = useIsMobile();
  const [isTextEnlarged, setIsTextEnlarged] = useState(false);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
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

  const {
    user,
    folders,
    createFolder,
    addQuestionToFolder,
    examQuestions,
    currentQuestionIndex,
    currentSection,
    userAnswers,
    deferredQuestions,
    examMode,
    reviewMode,
    timerActive,
    timeRemaining,
    sectionReviewMode,
    hasSeenSectionReview,
    returnedFromSectionReview,
    reviewedSection,
    hideDeferButton,
    selectAnswer,
    toggleDeferred,
    nextQuestion,
    previousQuestion,
    getQuestionStats,
    getCurrentExamInfo,
    goToQuestion,
    setReviewMode,
    goToSectionReview,
    resetExam, // Added resetExam
    nightMode // Night mode support
  } = useExamStore();

  const displayId = user?.id || user?.telegram_id || userInfo?.telegram_id || userInfo?.id || userInfo?.username || '';

  if (!examQuestions || examQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center" dir="rtl">
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 sm:p-8 shadow-xl mx-4">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl font-medium text-gray-900">جاري تحميل الاسئلة...</div>
          <div className="text-sm text-gray-600 mt-2">يرجى الانتظار</div>
        </div>
      </div>
    );
  }

  const currentQuestion = examQuestions[currentQuestionIndex];

  const isQuestionInFolder = useMemo(() => {
    if (!selectedFolder || !folders[selectedFolder]) {
      return false;
    }
    return folders[selectedFolder].questions.some(q => q.question === currentQuestion.question && JSON.stringify(q.choices) === JSON.stringify(currentQuestion.choices));
  }, [selectedFolder, folders, currentQuestion]);

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

    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);


    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);

    };
  }, []);

  useEffect(() => {
    // Using a small timeout to ensure the DOM is ready for scrolling
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  }, []); // The empty dependency array ensures this runs only once when the component mounts

  // Add keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Only handle keyboard events if we're not in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }

      // Check if we should show deferred questions button
      const currentQuestionNumber = currentQuestionIndex + 1;
      const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

      let shouldShowDeferredButton = false;

      if (examMode === 'combined') {
        // For combined sectioned exam, only show deferred button at the end of entire exam
        shouldShowDeferredButton = isLastQuestion && hasDeferredQuestionsInCurrentSection();
      } else {
        // For regular sectioned exam
        shouldShowDeferredButton =
          (isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection()) ||
          (isLastQuestion && hasDeferredQuestionsInCurrentSection());
      }

      const numKey = parseInt(event.key, 10);
      if (!isNaN(numKey) && numKey >= 1 && numKey <= 9) {
        const currentQ = examQuestions[currentQuestionIndex];
        if (currentQ && currentQ.choices && currentQ.choices.length > 0) {
          let choiceIndex = numKey - 1;
          // If user chooses a number higher than available choices, select the last one
          if (choiceIndex >= currentQ.choices.length) {
            choiceIndex = currentQ.choices.length - 1;
          }
          selectAnswer(currentQ.question_number, choiceIndex);
        }
      }

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          // Disable keyboard navigation for next button when deferred questions button should be shown
          if (canProceed && !shouldShowDeferredButton) {
            handleNext();
          }
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
          break;
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup function to remove event listener
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentQuestionIndex, examQuestions, deferredQuestions, examMode, currentSection]); // Dependencies to ensure the effect updates when these change

  // Function to calculate the display question number based on exam mode
  const getDisplayQuestionNumber = () => {
    if (examMode === 'sectioned') {
      // For sectioned mode: show 1-11 for each section
      const questionInSection = (currentQuestionIndex % 11) + 1;
      return questionInSection;
    } else {
      // For single section mode: show 1-55
      return currentQuestionIndex + 1;
    }
  };



  // Function to calculate total questions for display
  const getTotalQuestionsDisplay = () => {
    if (examMode === 'sectioned') {
      // For sectioned mode: show 11 as total for each section
      return 11;
    } else {
      // For single section mode: show total number of questions (55)
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

  // Function to highlight choice words in red for contextual error questions
  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

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
        <div className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 sm:p-8 shadow-xl mx-4">
          <div className="bg-blue-100 rounded-full p-3 sm:p-4 w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 flex items-center justify-center">
            <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 animate-pulse" />
          </div>
          <div className="text-lg sm:text-xl font-medium text-gray-900">جاري تحميل الاسئلة...</div>
          <div className="text-sm text-gray-600 mt-2">يرجى الانتظار</div>
        </div>
      </div>
    );
  }

  const selectedAnswer = userAnswers[currentQuestion.question_number];
  const isDeferred = deferredQuestions[currentQuestion.question_number];
  const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;
  const examInfo = getCurrentExamInfo();

  // Check if we can go to previous question (not first question and not first question of current section)
  const canGoPrevious = () => {
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

  // Find the first deferred question index in the current section
  const getFirstDeferredQuestionIndexInCurrentSection = () => {
    const isLastQuestion = currentQuestionIndex === examQuestions.length - 1;

    if (isLastQuestion) {
      for (let i = 0; i < examQuestions.length; i++) {
        const question = examQuestions[i];
        if (deferredQuestions[question.question_number]) {
          return i;
        }
      }
      return -1;
    }
    // Original logic
    for (let i = 0; i < examQuestions.length; i++) {
      const question = examQuestions[i];
      if (question.section === currentSection && deferredQuestions[question.question_number]) {
        return i;
      }
    }
    return -1;
  };

  const handleAnswerSelect = (choiceIndex) => {
    selectAnswer(currentQuestion.question_number, choiceIndex);
  };

  const handleDeferToggle = () => {
    toggleDeferred(currentQuestion.question_number);
  };

  const handleNext = () => {
    // Check if this is the last question in the current section for sectioned exams
    const currentQuestionNumber = currentQuestionIndex + 1;
    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

    // For combined sectioned exam, only check at the end of the entire exam
    if (examMode === 'combined') {
      // If it's the last question and there are deferred questions, go to first deferred question
      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        const firstDeferredIndex = getFirstDeferredQuestionIndexInCurrentSection();
        if (firstDeferredIndex !== -1) {
          if (typeof goToQuestion === 'function') {
            goToQuestion(firstDeferredIndex);
          } else {
            console.log('Navigate to deferred question at index:', firstDeferredIndex);
          }
          return;
        }
      }
    } else {
      // For regular sectioned exam
      // If it's the end of a section in a sectioned exam and there are deferred questions in the current section
      if (isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection()) {
        const firstDeferredIndex = getFirstDeferredQuestionIndexInCurrentSection();
        if (firstDeferredIndex !== -1) {
          if (typeof goToQuestion === 'function') {
            goToQuestion(firstDeferredIndex);
          } else {
            console.log('Navigate to deferred question at index:', firstDeferredIndex);
          }
          return;
        }
      }

      // If it's the last question and there are deferred questions in the current section, go to first deferred question in current section
      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        const firstDeferredIndex = getFirstDeferredQuestionIndexInCurrentSection();
        if (firstDeferredIndex !== -1) {
          if (typeof goToQuestion === 'function') {
            goToQuestion(firstDeferredIndex);
          } else {
            console.log('Navigate to deferred question at index:', firstDeferredIndex);
          }
          return;
        }
      }
    }

    nextQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevious = () => {
    // Allow going back if examMode is not 'sectioned' (i.e., combined test)
    if (examMode !== 'sectioned') {
      previousQuestion();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Check if we're at the first question of the current section
    const currentQuestionNumber = currentQuestionIndex + 1;
    const isFirstQuestionInSection = (currentQuestionNumber - 1) % 11 === 0;

    // If we're at the first question of a section and it's not the very first question, prevent going back
    if (isFirstQuestionInSection && currentQuestionIndex > 0) {
      return; // Don't allow going back to previous section
    }

    previousQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTextEnlarge = () => {
    setIsTextEnlarged(true);
  };

  const handleCloseEnlargedText = () => {
    setIsTextEnlarged(false);
  };

  const handleOpenInstructionModal = () => {
    setIsInstructionModalOpen(true);
  };

  const handleCloseInstructionModal = () => {
    setIsInstructionModalOpen(false);
  };

  // Function to handle section review button
  const handleSectionReview = () => {
    // Navigate to section review page using the store function
    console.log("Navigating to section review page for section:", currentSection);
    goToSectionReview();
  };

  // Function to check if section review button should be shown
  const shouldShowSectionReviewButton = () => {
    // Show the button if:
    // 1. It's a sectioned exam AND we returned from section review
    // 2. OR if it's a sectioned exam AND there are deferred questions in current section AND we've seen section review
    return examMode === 'sectioned' && (
      returnedFromSectionReview ||
      (hasDeferredQuestionsInCurrentSection() && hasSeenSectionReview)
    );
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeLabel = (question) => {
    if (question?.image || question?.image_url) {
      return 'أسئلة الاختيار من متعدد';
    }
    const labels = {
      'analogy': 'التناظر اللفظي',
      'completion': 'اكمال الجمل',
      'error': 'الخطا السياقي',
      'rc': 'استيعاب المقروء',
      'odd': 'المفردة الشاذة',
      'search': 'أسئلة الاختيار من متعدد'
    };

    const categoryLabel = labels[question?.type] || question?.category || question?.type;
    let fullLabel = categoryLabel;

    // If there's a specific exam name and it's different from the category label
    if (question?.exam && question?.exam !== categoryLabel) {
      fullLabel = `${categoryLabel}`;
    } else if (question?.exam) {
      fullLabel = question.exam; // If exam name is the same as category, just show exam name
    }

    return fullLabel;
  };

  const getQuestionTypeExplanation = (type) => {
    const explanations = {
      'analogy': 'في بداية كل سؤال معنا ياتي كلمتان ترتبطان بعلاقة معينة، تتبعهما اربعة ازواج من الكلمات، واحد منها ترتبط فيه الكلمتان بعلاقة مشابهة لعلاقة بين الكلمتين في بداية السؤال. المطلوب هو اختيار الاجابة الصحيحة',
      'completion': 'يحتوي كل سؤال على جملة او اكثر بها فراغ او اكثر، والمطلوب اختيار الكلمة او العبارة المناسبة لملء الفراغ من بين البدائل المعطاة',
      'error': 'يحتوي كل سؤال على جملة تحتوي على خطا نحوي او املائي او لغوي، والمطلوب تحديد موضع الخطا',
      'rc': 'يحتوي كل سؤال على نص يليه عدة اسئلة حول محتوى النص، والمطلوب قراءة النص بعناية ثم الاجابة على الاسئلة',
      'odd': 'يحتوي كل سؤال على مجموعة من الكلمات، واحدة منها لا تنتمي للمجموعة، والمطلوب تحديد الكلمة الشاذة',
      'search': 'فيما يلي سؤال يتبعه أربعة خيارات، اختر منها الإجابة الصحيحة.'
    };
    return explanations[type] || 'فيما يلي سؤال يتبعه أربعة خيارات، اختر منها الإجابة الصحيحة.';
  };

  const stats = getQuestionStats();

  // Determine button text and style based on whether it's the last question and there are deferred questions
  const getNextButtonText = () => {
    const currentQuestionNumber = currentQuestionIndex + 1;
    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

    // For combined sectioned exam, only show deferred button at the end of entire exam
    if (examMode === 'combined') {
      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        return 'لديك اسئلة مؤجلة';
      }
    } else {
      // For regular sectioned exam
      // Check for deferred questions at section end for sectioned exams
      if (isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection()) {
        return 'لديك اسئلة مؤجلة';
      }

      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        return 'لديك اسئلة مؤجلة';
      }
    }

    if (isLastQuestion) {
      return 'انهاء الاختبار';
    } else if (isLastQuestionInSection && examMode === 'sectioned') {
      // Show "End Section" for sectioned exams at end of section
      return 'انهاء القسم';
    }

    return 'التالي';
  };

  const getNextButtonMobileText = () => {
    const currentQuestionNumber = currentQuestionIndex + 1;
    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

    // For combined sectioned exam, only show deferred button at the end of entire exam
    if (examMode === 'combined') {
      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        return 'اسئلة مؤجلة';
      }
    } else {
      // For regular sectioned exam
      // Check for deferred questions at section end for sectioned exams
      if (isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection()) {
        return 'اسئلة مؤجلة';
      }

      if (isLastQuestion && hasDeferredQuestionsInCurrentSection()) {
        return 'اسئلة مؤجلة';
      }
    }

    if (isLastQuestion) {
      return 'انهاء الاختبار';
    } else if (isLastQuestionInSection && examMode === 'sectioned') {
      // Show "End Section" for sectioned exams at end of section
      return 'انهاء القسم';
    }

    return 'التالي';
  };

  return (
    <>
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
      <div className={`min-h-screen pb-24 sm:pb-20 ${nightMode ? 'bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]' : 'bg-gradient-to-br from-slate-50 via-blue-50 to-blue-100'}`} dir="rtl">
        {/* Enhanced Header - Consistent Size Across All Devices */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[#004d91] to-[#000429]"></div>
          <div className="">
            <div className="mx-auto px-4 py-4">
              <div className="flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30">
                    <div className="text-white font-bold text-base">
                      السؤال {getDisplayQuestionNumber()} من {getTotalQuestionsDisplay()}
                    </div>
                  </div>
                  {/* Progress Indicator - Hidden on mobile */}
                  <div className="hidden md:flex bg-white/20 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/30">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-white/30 rounded-full h-2">
                        <div
                          className="rounded-full h-2 transition-all duration-300"
                          style={{
                            width: `${(getDisplayQuestionNumber() / getTotalQuestionsDisplay()) * 100}%`,
                            background: 'linear-gradient(to right, #10B981 0%, #06D6A0 50%, #00F5FF 100%)'
                          }}
                        ></div>
                      </div>
                      <span className="text-white text-sm font-medium">
                        {Math.round((getDisplayQuestionNumber() / getTotalQuestionsDisplay()) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {examMode === 'sectioned' && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30 hidden sm:block">
                      <div className="text-white font-medium text-base">القسم {currentSection}</div>
                    </div>
                  )}
                  {timerActive && (
                    <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/30">
                      <div className={`font-bold text-base flex items-center gap-2 ${timeRemaining < 300 ? 'text-red-300 animate-pulse' : 'text-white'}`}>
                        <Clock className="h-5 w-5" />
                        <span className="text-lg font-extrabold tracking-wide">{formatTime(timeRemaining)}</span>
                      </div>
                    </div>
                  )}
                  <Button
                    variant=""
                    className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-300 px-4 py-2 text-base font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-white/30 flex-shrink-0 cursor-pointer"
                    onClick={() => {
                      resetExam();
                    }}
                  >
                    <Home className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enlarged Text Modal */}
        {isTextEnlarged && currentQuestion.passage && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseEnlargedText}>
            <div className={`rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden ${nightMode ? 'bg-[#112240] border border-orange-400/20' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-[#000429] to-[#004d91] text-white p-4 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <BookOpen className="h-6 w-6" />
                  النص المكبر
                </h3>
                <Button
                  onClick={handleCloseEnlargedText}
                  variant=""
                  className="text-white bg-transparent hover:bg-transparent p-2 rounded-full cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className={`leading-relaxed text-lg ${nightMode ? 'text-slate-200' : 'text-gray-800'}`} style={{ lineHeight: '2' }}>
                  {currentQuestion.passage}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instruction Modal */}
        {isInstructionModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseInstructionModal}>
            <div className={`rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden ${nightMode ? 'bg-[#112240] border border-orange-400/20' : 'bg-white'}`} onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-r from-[#000429] to-[#004d91] text-white p-4 flex justify-between items-center">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Target className="h-6 w-6" />
                  {getQuestionTypeLabel(currentQuestion)}
                </h3>
                <Button
                  onClick={handleCloseInstructionModal}
                  variant=""
                  className="text-white bg-transparent hover:bg-transparent p-2 rounded-full cursor-pointer"
                >
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className={`leading-relaxed text-lg ${nightMode ? 'text-slate-200' : 'text-gray-800'}`} style={{ lineHeight: '2' }}>
                  {(currentQuestion.image || currentQuestion.image_url)
                    ? 'فيما يلي سؤال يتبعه أربعة خيارات، اختر منها الإجابة الصحيحة.'
                    : getQuestionTypeExplanation(currentQuestion.type)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - Mobile Optimized with proper bottom spacing */}
        <div className="pt-2 sm:pt-3 lg:pt-1 xl:pt-1 min-h-screen px-2 sm:px-4 lg:px-6">
          <div className="px-2 sm:px-4 py-2 sm:py-4 lg:px-4 lg:py-2 xl:px-4 xl:py-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6 auto-rows-min">
              {/* Question Area - Mobile Optimized */}
              <div className="lg:col-span-2 xl:col-span-3 2xl:col-span-4 min-w-0">
                <div className={`backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-xl border p-3 sm:p-6 lg:p-4 xl:p-4 min-w-0 w-full overflow-hidden relative ${nightMode ? 'bg-[#001625]/90 border-orange-400/20' : 'bg-white/80 border-white/20'}`}>
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

                  {/* Question Type and Status - Mobile Optimized */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4 lg:mb-2 xl:mb-2 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs sm:text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2 sm:px-4 py-1 sm:py-2 font-medium rounded-full border-0 cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105"
                        onClick={handleOpenInstructionModal}
                      >
                        <Target className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                        {getQuestionTypeLabel(currentQuestion)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedAnswer !== undefined && (
                        <Badge variant="default" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                          <CheckCircle className="h-2 w-2 sm:h-3 sm:w-3 ml-1" />
                          مجاب
                        </Badge>
                      )}
                      {isDeferred && (
                        <Badge variant="default" className="bg-gradient-to-r from-orange-500 to-red-500 text-white border-0 rounded-full px-2 sm:px-3 py-1 text-xs sm:text-sm">
                          <Flag className="h-2 w-2 sm:h-3 sm:w-3 ml-1" />
                          مؤجل
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Reading passage for RC questions - Mobile Optimized */}
                  {currentQuestion.passage && (
                    <Card className={`mb-3 sm:mb-4 lg:mb-2 xl:mb-2 border-0 shadow-lg ${nightMode ? 'bg-gradient-to-br from-[#001625] to-[#002850]' : 'bg-gradient-to-br from-blue-50 to-indigo-50'}`}>
                      <CardHeader
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg p-2 sm:p-4 cursor-pointer hover:from-blue-700 hover:to-indigo-700 transition-all duration-300"
                        onClick={handleTextEnlarge}
                      >
                        <CardTitle className="text-base sm:text-lg text-center flex items-center justify-center gap-2">
                          <ZoomIn className="h-4 w-4 sm:h-5 sm:w-5" />
                          تكبير النص
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-1 sm:p-2">
                        <div
                          className={`leading-relaxed overflow-y-auto passage-scroll text-center mx-auto text-xs sm:text-sm max-h-[150px] ${nightMode ? 'text-slate-300' : 'text-gray-700'}`}
                          style={{ lineHeight: '1.8' }}
                        >
                          {currentQuestion.passage}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Question text / Image - Mobile Optimized with highlighting for error questions */}
                  <div className={`text-base sm:text-lg font-medium leading-relaxed mb-3 sm:mb-6 lg:mb-3 xl:mb-3 text-center break-words overflow-wrap-anywhere ${nightMode ? 'text-slate-100' : 'text-gray-900'}`}>
                    {!(currentQuestion.image || currentQuestion.image_url) && (
                      currentQuestion.type === 'error' ?
                        renderHighlightedText(highlightChoiceWords(currentQuestion.question, currentQuestion.choices, currentQuestion.type)) :
                        currentQuestion.question
                    )}
                    {(currentQuestion.image || currentQuestion.image_url) && (
                      <div className="flex justify-center w-full max-w-full overflow-hidden my-2">
                        <img
                          src={getImageUrl(currentQuestion.image || currentQuestion.image_url, currentQuestion)}
                          alt={`Question ${currentQuestion.question_number}`}
                          className="w-full max-w-full md:max-w-[540px] lg:max-w-[580px] xl:max-w-[620px] h-auto max-h-[40vh] md:max-h-[42vh] object-contain rounded-lg cursor-zoom-in block mx-auto shadow-sm"
                          onClick={() => {
                            setZoomedImageUrl(getImageUrl(currentQuestion.image || currentQuestion.image_url, currentQuestion));
                            setIsImageZoomModalOpen(true);
                          }}
                          onError={(e) => {
                            const rawSrc = currentQuestion.image_url || currentQuestion.image || '';
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

                  {/* Answer choices - Mobile Optimized with proper bottom spacing */}
                  <div className="space-y-2 sm:space-y-3 lg:space-y-1 xl:space-y-1 max-w-4xl mx-auto mb-6 sm:mb-8">
                    <RadioGroup
                      value={selectedAnswer?.toString() || ''}
                      onValueChange={(value) => handleAnswerSelect(parseInt(value))}
                      className="space-y-2 sm:space-y-3"
                    >
                      {currentQuestion.choices && currentQuestion.choices.map((choice, index) => (
                        <div
                          key={index}
                          className={`flex items-center space-x-2 sm:space-x-3 space-x-reverse p-2 sm:p-3 rounded-lg sm:rounded-xl transition-all duration-300 border-2 backdrop-blur-sm cursor-pointer ${nightMode
                            ? (selectedAnswer === index
                              ? 'border-orange-400 bg-orange-500/20 shadow-lg shadow-orange-500/20'
                              : 'border-slate-600 bg-slate-800/60 hover:border-orange-400/50 hover:bg-slate-700/60')
                            : (selectedAnswer === index
                              ? 'border-blue-500 bg-gradient-to-r from-orange-50 to-amber-100 shadow-lg'
                              : 'border-gray-200 bg-white/60 hover:border-blue-200 hover:bg-gradient-to-r hover:from-cyan-50 hover:to-blue-50')
                            }`}
                          onClick={() => handleAnswerSelect(index)}
                        >
                          <RadioGroupItem
                            value={index.toString()}
                            id={`choice-${index}`}
                            className={`flex-shrink-0 border-2 w-4 h-4 sm:w-5 sm:h-5 pointer-events-none ${nightMode ? 'border-orange-400 text-orange-400 data-[state=checked]:bg-orange-400' : 'border-blue-300'}`}
                          />
                          <Label
                            htmlFor={`choice-${index}`}
                            className={`flex-1 cursor-pointer text-base sm:text-lg leading-relaxed text-right font-medium pointer-events-none break-words overflow-wrap-anywhere ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}
                          >
                            {choice}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </div>

              {/* Enhanced Sidebar - Mobile Optimized with proper bottom spacing */}
              <div className="lg:col-span-1 xl:col-span-1 2xl:col-span-1 min-w-0 w-full">
                <div className="grid grid-cols-1 gap-3 sm:gap-4 h-fit">
                  {/* Stats - Mobile Optimized */}
                  <Card className={`border-0 shadow-xl backdrop-blur-sm hover:shadow-2xl transition-all duration-300 min-w-0 w-full ${nightMode ? 'bg-[#001625]/90 border border-orange-400/20' : 'bg-white/80'}`}>
                    <CardHeader className="pb-2 sm:pb-3 p-2 sm:p-4">
                      <div className="flex items-center justify-center mb-2 sm:mb-3">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-full p-1.5 sm:p-2">
                          <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 text-white" />
                        </div>
                      </div>
                      <CardTitle className={`text-center text-sm sm:text-base lg:text-sm xl:text-base font-bold break-words ${nightMode ? 'text-slate-100' : 'text-gray-900'}`}>
                        احصائيات الاختبار
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 sm:space-y-3 p-2 sm:p-4 pt-0">
                      <div className={`rounded-lg p-2 sm:p-3 border-2 min-w-0 ${nightMode ? 'bg-green-500/10 border-green-500/30' : 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'}`}>
                        <div className="flex justify-between items-center gap-1">
                          <span className={`font-medium text-xs sm:text-sm truncate ${nightMode ? 'text-green-400' : 'text-green-700'}`}>مجاب عليها:</span>
                          <span className={`font-bold text-lg sm:text-xl flex-shrink-0 ${nightMode ? 'text-green-300' : 'text-green-800'}`}>{stats.answered}</span>
                        </div>
                      </div>
                      <div className={`rounded-lg p-2 sm:p-3 border-2 min-w-0 ${nightMode ? 'bg-slate-500/10 border-slate-500/30' : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'}`}>
                        <div className="flex justify-between items-center gap-1">
                          <span className={`font-medium text-xs sm:text-sm truncate ${nightMode ? 'text-slate-400' : 'text-gray-700'}`}>غير مجاب:</span>
                          <span className={`font-bold text-lg sm:text-xl flex-shrink-0 ${nightMode ? 'text-slate-300' : 'text-gray-800'}`}>{stats.unanswered}</span>
                        </div>
                      </div>
                      <div className={`rounded-lg p-2 sm:p-3 border-2 min-w-0 ${nightMode ? 'bg-orange-500/10 border-orange-500/30' : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'}`}>
                        <div className="flex justify-between items-center gap-1">
                          <span className={`font-medium text-xs sm:text-sm truncate ${nightMode ? 'text-orange-400' : 'text-orange-700'}`}>مؤجلة:</span>
                          <span className={`font-bold text-lg sm:text-xl flex-shrink-0 ${nightMode ? 'text-orange-300' : 'text-orange-800'}`}>{stats.deferred}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                {/* Defer Button - Mobile Optimized with proper spacing to avoid footer overlap */}
                {/* Hide defer button when hideDeferButton is true OR when returned from section review */}
                {!hideDeferButton && !returnedFromSectionReview && (
                  <div className="mt-3 sm:mt-4 mb-6 sm:mb-8 text-center grid grid-cols-1 gap-3 sm:gap-4">
                    <Button
                      onClick={() => setIsFolderDialogOpen(true)}
                      className={`w-full transition-all duration-300 rounded-lg sm:rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm lg:text-xs xl:text-sm min-w-0 cursor-pointer bg-gradient-to-r from-blue-500 to-indigo-500 text-white hover:from-blue-600 hover:to-indigo-600 shadow-lg hover:shadow-xl transform hover:scale-105`}
                      size="lg"
                    >
                      <FolderPlus className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 flex-shrink-0" />
                      <span className="truncate">
                        حفظ في مجلد
                      </span>
                    </Button>
                    <Button
                      onClick={handleDeferToggle}
                      disabled={selectedAnswer !== undefined}
                      className={`w-full transition-all duration-300 rounded-lg sm:rounded-xl h-10 sm:h-12 font-bold text-xs sm:text-sm lg:text-xs xl:text-sm min-w-0 cursor-pointer ${selectedAnswer !== undefined
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed opacity-50'
                        : isDeferred
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:from-green-600 hover:to-emerald-600'
                          : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600'
                        } shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:hover:shadow-lg`}
                      size="lg"
                    >
                      <Flag className="h-3 w-3 sm:h-4 sm:w-4 ml-1 sm:ml-2 flex-shrink-0" />
                      <span className="truncate">
                        {selectedAnswer !== undefined ? 'لا يمكن التأجيل بعد الاجابة' : (isDeferred ? 'الغاء التأجيل' : 'تأجيل السؤال')}
                      </span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Navigation Footer - Mobile Optimized */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="bg-white/10 backdrop-blur-sm border-t border-white/20">
            <div className="absolute inset-0 bg-gradient-to-r from-[#000429] to-[#004d91]"></div>
            <div className="relative mx-auto px-3 sm:px-6 py-3 sm:py-4">
              <div className="flex justify-between items-center gap-2 sm:gap-4">
                {/* Previous Button - Mobile Optimized */}
                <Button
                  onClick={handlePrevious}
                  disabled={!canGoPrevious()}
                  className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-300 px-3 sm:px-8 py-2 sm:py-3 text-sm sm:text-lg font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-white/30 flex-shrink-0 cursor-pointer"
                  size="sm"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 ml-1 sm:ml-2" />
                  <span className="hidden sm:inline">السابق</span>
                  <span className="sm:hidden">السابق</span>
                </Button>

                {/* Section Review Button - Only show when conditions are met */}
                {shouldShowSectionReviewButton() && (
                  <Button
                    onClick={handleSectionReview}
                    className="bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-all duration-300 px-3 sm:px-6 py-2 sm:py-3 text-sm sm:text-lg font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl border border-white/30 flex-shrink-0 cursor-pointer"
                    size="sm"
                  >
                    <RotateCcw className="h-4 w-4 sm:h-5 sm:w-5 ml-1 sm:ml-2" />
                    <span className="hidden sm:inline">مراجعة القسم</span>
                    <span className="sm:hidden">مراجعة</span>
                  </Button>
                )}

                {/* Spacer to push next button to the right */}
                <div className="flex-1"></div>

                {/* Next Button - Mobile Optimized with conditional text and styling */}
                <Button
                  onClick={handleNext}
                  disabled={!canProceed}
                  className={`backdrop-blur-sm text-white transition-all duration-300 px-3 sm:px-8 py-2 sm:py-3 text-sm sm:text-lg font-bold rounded-lg sm:rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed border border-white/30 flex-shrink-0 cursor-pointer ${(() => {
                    const currentQuestionNumber = currentQuestionIndex + 1;
                    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

                    // Check for deferred questions at section end or exam end
                    if ((isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection) ||
                      (isLastQuestion && hasDeferredQuestionsInCurrentSection)) {
                      return 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 animate-pulse';
                    }

                    // Apply gradient to End Section and End Exam buttons
                    if (isLastQuestion || (isLastQuestionInSection && examMode === 'sectioned')) {
                      return 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 animate-pulse';
                    }
                    return 'bg-white/20 hover:bg-white/30';
                  })()
                    }`}
                  size="sm"
                >
                  <span className="hidden sm:inline">{getNextButtonText()}</span>
                  <span className="sm:hidden">{getNextButtonMobileText()}</span>
                  {(() => {
                    const currentQuestionNumber = currentQuestionIndex + 1;
                    const isLastQuestionInSection = currentQuestionNumber % 11 === 0;

                    if ((isLastQuestionInSection && !isLastQuestion && examMode === 'sectioned' && hasDeferredQuestionsInCurrentSection) ||
                      (isLastQuestion && hasDeferredQuestionsInCurrentSection)) {
                      return <Flag className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />;
                    }
                    return <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />;
                  })()}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Folder modal */}

        <Dialog modal={false} open={isFolderDialogOpen} onOpenChange={setIsFolderDialogOpen}>
          <DialogContent className={`backdrop-blur-sm rounded-2xl shadow-2xl w-full sm:max-w-lg border p-0 ${nightMode ? 'bg-[#112240] border-orange-400/20' : 'bg-white border-white/20'}`}>
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
                <h5 className={`font-bold text-lg ${nightMode ? 'text-slate-100' : 'text-gray-800'}`}>اختر مجلدًا</h5>
                <div className="flex items-center gap-2">
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className={`w-full justify-between cursor-pointer ${nightMode ? 'bg-slate-800/80 border-slate-600 hover:bg-slate-700 text-slate-200' : 'bg-white/80 border-gray-300 hover:bg-gray-50 text-gray-800'}`}>
                        <span>{selectedFolder || "اختر مجلد"}</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent dir="rtl" className={`shadow-lg w-56 ${nightMode ? 'bg-[#112240] border-slate-600' : 'bg-white border-gray-200'}`}>
                      {Object.values(folders).map((folder) => (
                        <DropdownMenuItem
                          key={folder.name}
                          onSelect={() => setSelectedFolder(folder.name)}
                          className={`cursor-pointer ${nightMode ? 'hover:bg-slate-700 focus:bg-slate-700 text-slate-200' : 'hover:bg-blue-50 focus:bg-blue-100'}`}
                        >
                          {folder.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button onClick={() => setIsCreatingFolder(!isCreatingFolder)} variant="outline" className={`p-2 cursor-pointer ${nightMode ? 'bg-slate-800/80 border-slate-600 text-slate-300 hover:bg-slate-700' : 'bg-white/80 border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                    <FolderPlus className="h-5 w-5" />
                  </Button>
                  {isQuestionInFolder && <CheckCircle className="h-6 w-6 text-green-500" />}
                </div>
                {isCreatingFolder && (
                  <div className="mt-7 space-y-5 transform transition-all duration-300">
                    <Label htmlFor="new-folder-name" className={`font-bold mb-3 text-lg text-center ${nightMode ? 'text-slate-100' : 'text-gray-800'}`}>اسم المجلد</Label>
                    <Input
                      id="new-folder-name"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      className={`${nightMode ? 'bg-slate-800/80 border-slate-600 focus:border-orange-400 focus:ring-orange-400 text-slate-200 placeholder:text-slate-400' : 'bg-white/80 border-gray-300 focus:border-blue-500 focus:ring-blue-500'}`}
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
                      className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 cursor-pointer"
                    >
                      انشاء
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6 flex justify-center">
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
                className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold hover:from-cyan-600 hover:to-blue-600 cursor-pointer"
                size="lg"
              >
                <span>اضافة</span>
              </Button>
            </div>
          </DialogContent>
        </Dialog>


        {/* exit dialog */}
        <Dialog modal={false} open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
          <DialogContent dir="rtl" className="bg-[#112240] border-slate-700 max-w-md w-full p-0 overflow-hidden">
            {/* Modal Header */}
            <div className="p-1 text-center">
              <div className="flex justify-center mb-1">
                <div className="p-5 transition-transform duration-300 hover:scale-110">
                  <TriangleAlert className="h-8 w-8 text-orange-400" />
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
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  نعم
                </Button>
                {/* Cancel Button (Secondary Action) */}
                <Button
                  onClick={() => setIsExitDialogOpen(false)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                >
                  الغاء
                </Button>
              </div>
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
}

export default QuestionDisplay;