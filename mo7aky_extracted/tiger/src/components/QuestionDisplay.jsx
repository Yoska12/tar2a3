import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowRight, ArrowLeft, Clock, Flag, Filter, BarChart3, BookOpen, GraduationCap, Target, CheckCircle, Home, X, ZoomIn, ArrowRightToLine, CircleHelp, LogIn, SquareX, GalleryVertical, TriangleAlert, User, Check, Scan, FolderPlus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
  DialogOverlay,
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

// Levenshtein distance function remains the same...
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

function EndSectionModal({
  isEndSectionModalOpen,
  setIsEndSectionModalOpen,
  handleEndSection,
  isLastSection,
  answeredQuestionCount,
  totalExamQuestionCount,
  actionType,
}) {

  // Determine if we should show "End Exam" logic based on last section OR if dealing with single-exam mode like tiger_experiment
  // We can pass a prop or check context, but for now we'll rely on isLastSection being true if we force it, 
  // or we can infer from the entity name. However, the logic below relies on isLastSection.
  // Ideally, if it's the specific experiment, isLastSection should be treated as true.

  const modalTitle = (actionType === 'exam' || isLastSection) ? "تأكيد انتهاء الاختبار" : "تأكيد انتهاء القسم";
  const entity = (actionType === 'exam' || isLastSection) ? "الاختبار" : "القسم";
  const modalBody = `لقد قمت بالإجابة على ${answeredQuestionCount} سؤال (أسئلة) من أصل ${totalExamQuestionCount}. وبمجرد انتهاء ${entity}، لن تستطيع الإجابة على أسئلة ${entity} مرة أخرى. هل حقا تريد إنهاء ${entity}؟`;
  const confirmButtonText = (actionType === 'exam' || isLastSection) ? "انهاء الاختبار" : "الانتقال للقسم التالي";

  return (
    <Dialog modal={false} open={isEndSectionModalOpen} onOpenChange={setIsEndSectionModalOpen}>
      {isEndSectionModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          }}
          onClick={() => setIsEndSectionModalOpen(false)}
        />
      )}
      <DialogContent showCloseButton={false} className="sm:max-w-md rounded-none" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
        <DialogHeader>
          <DialogTitle className="text-right text-3xl font-bold">{modalTitle}</DialogTitle>
          <DialogDescription className="sr-only">{modalTitle}</DialogDescription>
        </DialogHeader>
        <div className="py-4 text-right text-base">
          {modalBody}
        </div>
        <DialogFooter className="sm:justify-end">
          {/* "No" button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsEndSectionModalOpen(false)} // Closes the modal on press
            className="cursor-pointer hover:bg-background hover:text-foreground rounded-none"
          >
            لا
          </Button>
          {/* "Yes" button */}
          <Button
            type="button"
            className="bg-green-600 cursor-pointer hover:bg-green-600 rounded-none" // Green color like the image
            onClick={() => {
              handleEndSection();
              // Optionally close the modal after the action is triggered
              setIsEndSectionModalOpen(false);
            }}
          >
            نعم
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog >
  );
}

function ExplanationModal({ isOpen, onClose }) {
  return (
    <Dialog modal={false} open={isOpen} onOpenChange={onClose}>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 40,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
          }}
          onClick={onClose}
        />
      )}
      <DialogContent showCloseButton={false} className="sm:max-w-md rounded-none" dir="rtl" style={{ fontFamily: 'Arial, sans-serif' }}>
        <DialogHeader>
          <DialogTitle className="text-right text-3xl font-bold">شرح الاختبار</DialogTitle>
          <DialogDescription className="sr-only">شرح تفاصيل ونظام الاختبار</DialogDescription>
        </DialogHeader>
        <div className="py-4 text-right text-base">
          <p>اختبار موحد يشرف عليه المركز الوطني للقياس وهو شرط أساسي للقبول في الجامعات السعودية.</p>
          <p>يتكون من 5 اختبارات (واحد ورقي و4 محوسبة).</p>
          <p>عدد الأسئلة الكلي 120 سؤال.</p>
          <p>ويتكون من قسمين هما</p>
          <p>القسم الكمي: أسئلة في الحساب والهندسة والجبر والتحليل.</p>
          <p>القسم اللفظي: استيعاب المقروء، إكمال الجمل، التناظر اللفظي، الخطأ السياقي، المفردة الشاذة.</p>
        </div>
        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            onClick={onClose}
            className="cursor-pointer bg-[#4888bf] text-white hover:bg-[#4888bf] rounded-none"
          >
            حسنا
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


const QuestionDisplay = () => {
  const [passageFontSize, setPassageFontSize] = useState(18);
  const [questionFontSize, setQuestionFontSize] = useState(22);
  const [choiceFontSize, setChoiceFontSize] = useState(18);
  const [localAnswer, setLocalAnswer] = useState(undefined);
  const [isEndSectionModalOpen, setIsEndSectionModalOpen] = useState(false);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);
  const [isEquationModalOpen, setIsEquationModalOpen] = useState(false);
  const [isImageZoomModalOpen, setIsImageZoomModalOpen] = useState(false);
  const [zoomedImageUrl, setZoomedImageUrl] = useState('');
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [endActionType, setEndActionType] = useState('section'); // 'section' or 'exam'
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);

  const adjustFontSize = (adjustment) => {
    setPassageFontSize(prev => Math.max(12, prev + adjustment));
    setQuestionFontSize(prev => Math.max(14, prev + adjustment));
  };

  const [isEquationZoomed, setIsEquationZoomed] = useState(false);
  const isMobile = useIsMobile();
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [timerModalMessage, setTimerModalMessage] = useState('');


  const {
    examQuestions,
    currentQuestionIndex,
    userAnswers,
    timeRemaining,
    timerActive, // Get timerActive state
    selectAnswer,
    nextQuestion,
    previousQuestion,
    getQuestionStats,
    goToQuestion,
    markedQuestions,
    visitedQuestions,
    toggleMarked,
    userId,
    user, // Add user from store
    userEmail,
    endSection,
    currentSection,
    totalSections,
    highestVisitedQuestionIndex,
    selectedCategory, // Get selectedCategory to check for tiger_experiment
    completeExam,
    folders,
    createFolder,
    addQuestionToFolder,
    nightMode,
  } = useExamStore();

  const displayId = user?.id || userId;
  const currentQuestion = (examQuestions && examQuestions.length > 0) ? examQuestions[currentQuestionIndex] : null;

  useEffect(() => {
    setLocalAnswer(userAnswers[examQuestions[currentQuestionIndex]?.question_number]);
  }, [currentQuestionIndex, userAnswers, examQuestions]);

  useEffect(() => {
    setPassageFontSize(20);
    setQuestionFontSize(22);
    setChoiceFontSize(18);
  }, [currentQuestionIndex]);

  const isQuestionInFolder = useMemo(() => {
    if (!selectedFolder || !folders[selectedFolder] || !currentQuestion) {
      return false;
    }
    return folders[selectedFolder].questions.some(q => q.question === currentQuestion.question && JSON.stringify(q.choices) === JSON.stringify(currentQuestion.choices));
  }, [selectedFolder, folders, currentQuestion]);

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
  }, [currentQuestionIndex, examQuestions, currentSection]); // Dependencies to ensure the effect updates when these change

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

  // Levenshtein and text normalization functions remain the same...
  const removeDiacritics = (text) => {
    text = text.replace(/اً/g, '');
    return text.replace(/[ً-ْٰۖ-ۜ۟-۪ۤۧۨ-ۭ]/g, "");
  };
  const normalizeText = (text) => {
    return text
      .replace(/[إأآا]/g, 'ا')
      .replace(/[ؤ]/g, 'و')
      .replace(/[ئ]/g, 'ي')
      .replace(/ء/g, '')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  };
  const getCoreWord = (word) => {
    let cleanedWord = word.replace(/[،.؛;:!؟?]/g, '');
    let core = normalizeText(removeDiacritics(cleanedWord));
    core = core.replace(/^(و|ف|س)+/, '');
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
    } else if (core.startsWith('لل')) {
      core = core.substring(2);
    } else if (core.startsWith('ل')) {
      core = core.substring(1);
    } else if (core.startsWith('ال')) {
      core = core.substring(2);
    }
    if (core.endsWith('وا')) {
      core = core.slice(0, -2) + 'و';
    }
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

  const highlightChoiceWords = (questionText, choices, questionType) => {
    if (questionType !== 'error' || !choices || !questionText) {
      return escapeHtml(questionText);
    }
    const words = questionText.split(/(\s+|[،.؛:()])/);
    const highlightedWords = words.map(escapeHtml);
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
        exactMatchIndices.forEach(index => {
          if (!highlightedWords[index].includes('<span')) {
            highlightedWords[index] = `<span style="font-weight: bold;">${escapeHtml(words[index])}</span>`;
          }
        });
      } else {
        const coreChoiceWords = choiceWords.map(getCoreWord);
        for (let i = 0; i <= questionWordsWithIndices.length - choiceWords.length; i++) {
          let isNormalizationMatch = true;
          for (let j = 0; j < coreChoiceWords.length; j++) {
            const coreQuestionWord = getCoreWord(questionWordsWithIndices[i + j].word);
            const coreChoiceWord = coreChoiceWords[j];
            if (coreChoiceWord === coreQuestionWord) {
              continue;
            }
            if (coreChoiceWord.length < 4 || levenshteinDistance(coreChoiceWord, coreQuestionWord) !== 1) {
              isNormalizationMatch = false;
              break;
            }
          }
          if (isNormalizationMatch) {
            for (let j = 0; j < coreChoiceWords.length; j++) {
              const originalIndex = questionWordsWithIndices[i + j].index;
              if (!highlightedWords[originalIndex].includes('<span')) {
                highlightedWords[originalIndex] = `<span style="color: font-weight: bold;">${escapeHtml(words[originalIndex])}</span>`;
              }
            }
            i += coreChoiceWords.length - 1;
          }
        }
      }
    });
    return highlightedWords.join('');
  };
  const renderHighlightedText = (text) => {
    return <div dangerouslySetInnerHTML={{ __html: text }} />;
  };

  if (!examQuestions || examQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex items-center justify-center rounded-none" dir="rtl">
        <div className="text-center p-8 rounded-none">
          <GraduationCap className="h-16 w-16 text-blue-600 mx-auto mb-4" />
          <div className="text-xl font-medium text-gray-900">جاري تحميل الاسئلة...</div>
        </div>
      </div>
    );
  }

  // const currentQuestion = examQuestions[currentQuestionIndex]; // Moved to top

  if (!currentQuestion) {
    return <div>...</div>; // Simple fallback
  }

  const handlePrevious = () => {
    previousQuestion();
  };

  const handleSaveAndNext = () => {
    if (localAnswer !== undefined) {
      selectAnswer(currentQuestion.question_number, localAnswer);
    }

    const { examQuestions, currentQuestionIndex } = useExamStore.getState();

    const isLastQuestionOfExam = currentQuestionIndex === examQuestions.length - 1;
    const isEndOfSectionBlock = (currentQuestionIndex + 1) % 24 === 0;
    const isOnBoundary = (isEndOfSectionBlock && !isLastQuestionOfExam) || isLastQuestionOfExam;

    if (isOnBoundary) {
      setLocalAnswer(undefined);
      return;
    }

    nextQuestion();
    setLocalAnswer(undefined);
  };

  const canGoPrevious = () => {
    return currentQuestionIndex > 0;
  };

  const handleNext = () => {
    handleSaveAndNext();
  };

  const handleAnswerSelect = (choiceIndex) => {
    if (currentQuestion) {
      selectAnswer(currentQuestion.question_number, choiceIndex);
      setLocalAnswer(choiceIndex);
    }
  };

  const handleEndSection = () => {
    if (endActionType === 'exam') {
      completeExam();
    } else {
      endSection();
    }
    setIsEndSectionModalOpen(false);
  };

  const handleMark = () => {
    toggleMarked(currentQuestion.question_number);
  };

  const handleGoToNextMarked = () => {
    const { currentSection } = useExamStore.getState();
    const markedIds = Object.keys(markedQuestions).map(Number);
    if (markedIds.length === 0) {
      return; // No marked questions
    }

    const markedQuestionsInSection = examQuestions.filter(q => q.section === currentSection && markedQuestions[q.question_number]);
    if (markedQuestionsInSection.length === 0) {
      return; // No marked questions in this section
    }

    const markedIndicesInSection = markedQuestionsInSection.map(q => examQuestions.findIndex(eq => eq.question_number === q.question_number));
    markedIndicesInSection.sort((a, b) => a - b);

    let nextMarkedIndex = -1;
    for (let i = 0; i < markedIndicesInSection.length; i++) {
      if (markedIndicesInSection[i] > currentQuestionIndex) {
        nextMarkedIndex = markedIndicesInSection[i];
        break;
      }
    }

    if (nextMarkedIndex === -1) {
      nextMarkedIndex = markedIndicesInSection[0];
    }

    if (nextMarkedIndex !== -1) {
      goToQuestion(nextMarkedIndex);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const toArabicNumerals = (n) => {
    return n.toString().replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[d]);
  };

  const stats = getQuestionStats();
  const questionsInSection = examQuestions.filter(q => q.section === currentSection);
  const answeredCountInSection = questionsInSection.filter(q => userAnswers[q.question_number] !== undefined).length;
  const unansweredCountInSection = questionsInSection.length - answeredCountInSection;
  const unvisitedCountInSection = questionsInSection.filter(q => !visitedQuestions[q.question_number]).length;
  const isErrorQuestion = currentQuestion.type === 'error' || (currentQuestion.category && currentQuestion.category.trim() === 'الخطا السياقي');

  const isLastQuestionOfExam = currentQuestionIndex === examQuestions.length - 1;
  const highestVisitedInCurrentSection = highestVisitedQuestionIndex[currentSection] || 0;
  const sectionStartIndex = (currentSection - 1) * 24;
  const sectionEndIndex = Math.min(sectionStartIndex + 23, examQuestions.length - 1);
  const hasReachedEndOfSection = highestVisitedInCurrentSection >= sectionEndIndex;

  const shouldEnableEndSectionButton = hasReachedEndOfSection;
  const isLastSection = currentSection === totalSections;

  const currentSectionIndex = Math.floor(currentQuestionIndex / 24);
  const isCurrentQuestionMarked = markedQuestions[currentQuestion.question_number];

  const explanationSectionStartIndex = currentSectionIndex * 24;
  let shouldShowExplanation = true;
  for (let i = explanationSectionStartIndex; i < currentQuestionIndex; i++) {
    if (examQuestions[i].category === currentQuestion.category) {
      shouldShowExplanation = false;
      break;
    }
  }

  const getQuestionTypeExplanation = (type) => {
    const explanations = {
      'التناظر اللفظي': 'في بداية كل سؤال معنا ياتي كلمتان ترتبطان بعلاقة معينة، تتبعهما اربعة ازواج من الكلمات، واحد منها ترتبط فيه الكلمتان بعلاقة مشابهة لعلاقة بين الكلمتين في بداية السؤال. المطلوب هو اختيار الاجابة الصحيحة',
      'اكمال الجمل': 'يحتوي كل سؤال على جملة او اكثر بها فراغ او اكثر، والمطلوب اختيار الكلمة او العبارة المناسبة لملء الفراغ من بين البدائل المعطاة',
      'الخطا السياقي': 'يحتوي كل سؤال على جملة تحتوي على خطا نحوي او املائي او لغوي، والمطلوب تحديد موضع الخطا',
      'استيعاب المقروء': 'يحتوي كل سؤال على نص يليه عدة اسئلة حول محتوى النص، والمطلوب قراءة النص بعناية ثم الاجابة على الاسئلة',
      'المفردة الشاذة': 'يحتوي كل سؤال على مجموعة من الكلمات، واحدة منها لا تنتمي للمجموعة، والمطلوب تحديد الكلمة الشاذة',
      'الارتباط والاختلاف': 'يحتوي كل سؤال على مجموعة من الكلمات، واحدة منها لا تنتمي للمجموعة، والمطلوب تحديد الكلمة الشاذة',
    };
    return explanations[type] || '';
  };

  let firstUnansweredIndexInSection = -1;
  for (let i = sectionStartIndex; i <= sectionEndIndex && examQuestions[i]; i++) {
    if (userAnswers[examQuestions[i].question_number] === undefined) {
      firstUnansweredIndexInSection = i;
      break;
    }
  }

  return (
    <div className={`min-h-screen flex flex-col rounded-none ${nightMode ? 'bg-slate-900 text-slate-200' : 'bg-white'}`} dir="rtl" style={{
      fontFamily: 'Arial, sans-serif',
      backgroundImage: nightMode ? 'none' : 'linear-gradient(#ddddddff 1px, transparent 1px), linear-gradient(90deg, #ddddddff 1px, transparent 1px)',
      backgroundSize: '20px 20px'
    }}>
      <div className={`flex justify-between items-center px-4 bg-[#068479] text-white rounded-none ${isMobile ? 'py-2' : 'py-6'}`} dir="rtl">
        <div className="flex-1">
          {isMobile && (
            <Button onClick={handleGoToNextMarked} className="bg-[#4888bf] cursor-pointer text-xs px-2 py-1 h-auto rounded-none">الأسئلة المؤجلة</Button>
          )}
        </div>
        {isMobile && timerActive ? (
          <div className="flex-1 text-center">
            <div className="text-xs">الوقت المتبقي</div>
            <div className={`text-2xl font-bold tracking-wider ${timeRemaining < 60 ? '!text-red-500 animate-fast-pulse' : ''}`}>{formatTime(timeRemaining)}</div>
          </div>
        ) : (
          <div className="flex-1 text-center font-bold text-lg"></div> // Placeholder for desktop title if any
        )}
        <div className="flex-1 flex justify-end">
          {isMobile && (
            <Button onClick={() => setIsFolderDialogOpen(true)} className="py-1 px-2 font-medium cursor-pointer bg-transparent hover:bg-transparent hover:text-cyan-200 text-white p-0 rounded-none">
              <FolderPlus className="h-6 w-6" />
            </Button>
          )}
        </div>
      </div>
      {/* ===== MAIN CONTENT FLEX CONTAINER ===== */}
      <div className={`flex flex-1 overflow-y-auto p-2 gap-2 ${isMobile ? 'flex-col pb-20' : 'flex-row-reverse'}`}>

        {/* ===== LEFT SIDEBAR (Info & Navigation) ===== */}
        <div className={`${isMobile ? 'hidden' : 'w-64 flex-shrink-0 flex flex-col gap-2 p-2 mt-5'}`}>
          {/* This whole sidebar is hidden on mobile, its contents are moved for mobile view */}


          {/* User Info & Stats Panel */}
          <div className={`border border-slate-300 p-3 flex flex-col gap-3 text-sm shadow-sm rounded-none ${nightMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-[#e4eef8]'}`}>
            {/* User Info */}
            <div className={`w-18 h-18 border flex items-center justify-center self-center rounded-none ${nightMode ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-gray-200 border-gray-300 text-gray-400'}`}>
              <User className="w-12 h-12" />
            </div>
            <div>
              <div className={nightMode ? 'text-slate-400' : 'text-gray-600'}>المستخدم:</div>
              <div className={`font-bold ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}>{userEmail}</div>
              <div className={nightMode ? 'text-slate-400' : 'text-gray-600'}>رقم الاقامة:</div>
              <div className={`font-bold ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}>{userId}</div>
            </div>

            {/* {Timer} */}
            <div className="p-3 text-center relative rounded-none">
              <div className="absolute top-2 right-2 text-right">
              </div>
              <div className={`text-4xl font-bold tracking-wider ${nightMode ? 'text-slate-200' : 'text-slate-800'} ${timeRemaining < 60 ? '!text-red-500 animate-fast-pulse' : ''}`}>{formatTime(timeRemaining)}</div>
            </div>


            {/* Totals */}
            <div className={`border-t border-b py-2 text-center rounded-none ${nightMode ? 'border-slate-700' : 'border-slate-300'}`}>
              <span className={`font-bold ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>مجموع الأسئلة: {examQuestions.length}</span>
            </div>

            {/* Stats Grid - 2x2 Layout */}
            <div className={`grid grid-cols-2 gap-x-4 gap-y-2 ${nightMode ? 'text-slate-300' : 'text-slate-700'}`}>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#009b0dff] border border-gray-400 flex items-center justify-center text-xs font-bold text-white rounded-none">{answeredCountInSection}</div>
                <span>تمت الإجابة</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#e36f59] border border-gray-400 flex items-center justify-center text-xs font-bold text-white rounded-none">{unansweredCountInSection}</div>
                <span>تتم الإجابة</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#4888bf] border border-gray-400 flex items-center justify-center text-xs font-bold text-white rounded-none">{examQuestions.filter(q => q.section === currentSection && markedQuestions[q.question_number]).length}</div>
                <span>إجابة مؤجلة</span>
              </div>
            </div>
          </div>

          {/* Question Navigation Panel */}
          <div className={`border border-slate-300 shadow-sm rounded-none ${nightMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-[#e4eef8]'}`}>

            <div className="grid grid-cols-6 gap-1 px-5 py-2 overflow-y-auto">
              {Array.from({ length: 24 }).map((_, index) => {
                const questionNumber = currentSectionIndex * 24 + index;
                const question = examQuestions[questionNumber];

                if (!question) {
                  return <div key={index} className={`w-6 h-6 rounded-none ${nightMode ? 'bg-slate-700' : 'bg-gray-200'}`} />;
                }

                const qNum = question.question_number;
                const isAnswered = userAnswers[qNum] !== undefined;
                const isMarked = markedQuestions[qNum];
                const isCurrent = currentQuestionIndex === questionNumber;
                const isVisited = visitedQuestions[qNum];

                let buttonClass = nightMode ? 'bg-slate-900 text-slate-200 border border-slate-700 cursor-pointer' : 'bg-white text-black border border-gray-300 cursor-pointer'; // Not Visited

                if (isVisited && !isAnswered) {
                  buttonClass = 'bg-[#e96100ff] text-white cursor-pointer'; // Visited & Unanswered
                }
                if (isAnswered) {
                  buttonClass = 'bg-[#009b0dff] text-white cursor-pointer'; // Answered
                }
                if (isCurrent) {
                  buttonClass += ' ring-2 ring-blue-500 font-bold'; // Current question highlight
                }

                return (
                  <button
                    key={index}
                    onClick={() => goToQuestion(questionNumber)}
                    className={`relative w-6 h-6 flex items-center justify-center transition-all leading-none rounded-none ${buttonClass}`}
                  >
                    {isMarked && <Scan className={`w-7 h-7 absolute ${nightMode ? 'text-white' : 'text-black'}`} />}
                    <span className="relative">{index + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigator footer */}

          <div className={`grid grid-cols-2 gap-2 mt-4 border border-slate-300 p-2 rounded-none ${nightMode ? 'bg-slate-800 border-slate-700' : 'bg-[#e4eef8]'}`}>
            <Button onClick={() => setIsExplanationModalOpen(true)} className="bg-[#4888bf] cursor-pointer hover:bg-[#4888bf] rounded-none">شرح الاختبار</Button>
            <Button onClick={handleGoToNextMarked} className="bg-[#4888bf] cursor-pointer hover:bg-[#4888bf] rounded-none">الأسئلة المؤجلة</Button>
            <Button onClick={() => setIsEquationModalOpen(true)} className="bg-[#4888bf] cursor-pointer hover:bg-[#4888bf] rounded-none">المعادلات</Button>
            <button
              onClick={() => setIsEndSectionModalOpen(true)}
              disabled={!shouldEnableEndSectionButton}
              className="bg-[#ff6a00ff] text-white disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer hover:bg-[#ff6a00ff] rounded-none"
            >
              انهاء القسم
            </button>
          </div>
        </div>


        {/* ===== RIGHT MAIN AREA (Question) ===== */}
        <div className="flex-1 flex flex-col overflow-y-auto relative">
          <div className="relative z-20 flex flex-col flex-1">
            <div className={`border border-gray-300 overflow-y-auto rounded-none ${isMobile ? 'hidden' : ''} ${nightMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-[#e4eef8] text-black'}`}>
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span>{examQuestions.length} مجموع الأسئلة في الاختبار</span>
                  <span className="mx-2">|</span>
                  <span>الأسئلة المحلولة:</span>
                  <span className="text-green-600 mr-1">{stats.answered}</span>
                </div>
              </div>
            </div>

            {/* --- Question Box --- */}
            <div className={`border border-gray-300 p-4 relative overflow-y-auto rounded-none ${isMobile ? 'flex-grow mt-0 max-h-[60vh]' : 'flex-grow-0 min-h-[55vh] h-[60%] mt-6'} ${nightMode ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white'}`}>
              {displayId && (
                <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-8 pointer-events-none z-0 overflow-hidden select-none">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="flex items-center justify-center">
                      <div className="text-xs text-gray-400 font-mono tracking-wider" style={{ transform: 'rotate(-25deg)', opacity: '0.12' }}>
                        {displayId}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex justify-between items-center mb-2 border p-1 rounded-none ${nightMode ? 'border-slate-700 bg-slate-900/50' : 'border-gray-300'}`}>
                <div>
                  <span>السؤال رقم</span>
                  <span className="text-lg mx-2">{toArabicNumerals(currentQuestionIndex % 24 + 1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setPassageFontSize(14); setQuestionFontSize(18); setChoiceFontSize(14); }} className="text-white px-3 py-1 bg-[#47afcd] rounded-none cursor-pointer">A⁻</button>
                  <button onClick={() => { setPassageFontSize(18); setQuestionFontSize(22); setChoiceFontSize(18); }} className="text-white px-3 py-1 bg-[#47afcd] rounded-none cursor-pointer">A</button>
                  <button onClick={() => { setPassageFontSize(22); setQuestionFontSize(26); setChoiceFontSize(22); }} className="text-white px-3 py-1 bg-[#47afcd] rounded-none cursor-pointer">A⁺</button>
                </div>
              </div>

              {shouldShowExplanation && !isMobile && (
                <div className={`p-3 rounded-none mb-4 border ${nightMode ? 'border-slate-700 bg-slate-900/40 text-slate-300' : 'border-gray-300 bg-slate-50 text-slate-800'}`}>
                  <div className="font-bold text-sm mb-1">أسئلة الاختيار من متعدد</div>
                  <div className="text-xs sm:text-sm">فيما يلي سؤال يتبعه أربعة خيارات، اختر منها الإجابة الصحيحة.</div>
                </div>
              )}

              {currentQuestion.passage && (<div className="mb-4 pt-4">
                <div
                  className={`text-right leading-relaxed p-2 ${nightMode ? 'text-slate-300' : ''}`}
                  style={{ fontSize: `${passageFontSize}px` }}
                >
                  {currentQuestion.passage}
                </div>
              </div>
              )}

              <div className={`font-medium leading-relaxed mb-8 text-right ${nightMode ? 'text-slate-100' : ''}`} style={{ fontSize: `${questionFontSize}px` }}>
                {!(currentQuestion.image_url || currentQuestion.image) && (
                  isErrorQuestion
                    ? renderHighlightedText(highlightChoiceWords(currentQuestion.question, currentQuestion.choices, 'error'))
                    : currentQuestion.question
                )}
                {(currentQuestion.image_url || currentQuestion.image) && (
                  <div className="flex justify-start w-full max-w-full overflow-hidden my-2" dir="rtl">
                    <img
                      src={getImageUrl(currentQuestion.image_url || currentQuestion.image, currentQuestion)}
                      alt={`Question ${currentQuestion.question_number}`}
                      className="w-auto max-w-full md:max-w-[400px] lg:max-w-[440px] xl:max-w-[480px] h-auto max-h-[28vh] md:max-h-[30vh] object-contain rounded-lg cursor-zoom-in block mr-0 ml-auto shadow-sm"
                      onClick={() => {
                        setZoomedImageUrl(getImageUrl(currentQuestion.image_url || currentQuestion.image, currentQuestion));
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

              <RadioGroup
                dir="rtl"
                value={localAnswer?.toString() || ''}
                onValueChange={(value) => setLocalAnswer(parseInt(value))}

              >
                {currentQuestion.choices && currentQuestion.choices.map((choice, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 p-1"
                  >
                    <RadioGroupItem
                      value={index.toString()}
                      id={`choice-${index}`}
                      className="cursor-pointer"
                    />
                    <Label
                      htmlFor={`choice-${index}`}
                      className={`flex text-right font-medium cursor-pointer ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}
                      style={{ fontSize: `${choiceFontSize}px` }}
                    >
                      {choice}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* navigation buttons */}
            <div className={`flex justify-start mt-4 gap-2 p-2 border border-gray-300 rounded-none ${nightMode ? 'bg-slate-800 border-slate-700' : 'bg-[#e4eef8]'}`}>

              <Button
                onClick={handlePrevious}
                className="bg-[#a55800ff] no-hover text-white py-3 px-5 text-lg cursor-pointer disabled:bg-[#a55800ff] disabled:opacity-100 disabled:cursor-not-allowed hover:bg-[#a55800ff] rounded-none"
                disabled={currentQuestionIndex === sectionStartIndex}
              >
                {isMobile ? 'السابق' : 'السؤال السابق'}
              </Button>

              <Button
                onClick={handleSaveAndNext}
                className="bg-[#068479] no-hover text-white py-3 px-5 text-lg cursor-pointer hover:bg-[#068479] rounded-none"
              >
                حفظ والتالي
              </Button>

              <Button
                onClick={handleMark}
                className={`bg-transparent no-hover py-3 px-5 text-lg border-2 cursor-pointer flex items-center gap-2 hover:bg-transparent rounded-none ${nightMode ? 'text-slate-200 border-slate-400' : 'text-black border-[#004480]'}`}
              >
                <div className={`w-6 h-6 border flex items-center justify-center rounded-none ${nightMode ? 'border-slate-300' : 'border-black'}`}>
                  {isCurrentQuestionMarked && <Check className={`w-5 h-5 ${nightMode ? 'text-slate-200' : 'text-black'}`} />}
                </div>
                <span>
                  {isMobile ? (isCurrentQuestionMarked ? 'مراجعة' : 'مراجعة') : (isCurrentQuestionMarked ? 'أضف السؤال للمراجعة' : 'أضف السؤال للمراجعة')}
                </span>
              </Button>
              {!isMobile && (
                <Button onClick={() => setIsFolderDialogOpen(true)} className={`py-2 font-medium text-base cursor-pointer bg-transparent hover:bg-transparent hover-yellow-text rounded-none ${nightMode ? 'text-white' : 'text-black'}`}>
                  <FolderPlus className="h-7 w-7 ml-2" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {isMobile && (
          <div className={`border border-slate-300 shadow-sm mb-5 rounded-none ${nightMode ? 'bg-slate-800 border-slate-700' : 'bg-[#e4eef8]'}`}>
            <div className="grid grid-cols-8 gap-1 p-2 overflow-y-auto">
              {Array.from({ length: 24 }).map((_, index) => {
                const questionNumber = currentSectionIndex * 24 + index;
                const question = examQuestions[questionNumber];

                if (!question) {
                  return <div key={index} className="w-5 h-5 rounded-none" />;
                }

                const qNum = question.question_number;
                const isAnswered = userAnswers[qNum] !== undefined;
                const isMarked = markedQuestions[qNum];
                const isCurrent = currentQuestionIndex === questionNumber;
                const isVisited = visitedQuestions[qNum];

                let buttonClass = 'bg-white text-black border border-gray-300 cursor-pointer'; // Not Visited

                if (isVisited && !isAnswered) {
                  buttonClass = 'bg-[#e96100ff] text-white cursor-pointer'; // Visited & Unanswered
                }
                if (isAnswered) {
                  buttonClass = 'bg-[#009b0dff] text-white cursor-pointer'; // Answered
                }

                return (
                  <button
                    key={index}
                    onClick={() => goToQuestion(questionNumber)}
                    className={`relative w-5 h-5 text-xs flex items-center justify-center leading-none rounded-none ${buttonClass}`}
                  >
                    {isMarked && <Scan className="w-6 h-6 text-black absolute" />}
                    <span className="relative">{index + 1}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Explanation Modal */}
      <ExplanationModal modal={false}
        isOpen={isExplanationModalOpen}
        onClose={() => setIsExplanationModalOpen(false)}
      />

      {/* End Section Modal */}
      <EndSectionModal modal={false}
        isEndSectionModalOpen={isEndSectionModalOpen}
        setIsEndSectionModalOpen={setIsEndSectionModalOpen}
        handleEndSection={handleEndSection}
        isLastSection={isLastSection}
        answeredQuestionCount={answeredCountInSection}
        totalExamQuestionCount={questionsInSection.length}
        actionType={endActionType}
      />

      {/* Equation Modal */}
      <Dialog modal={false} open={isEquationModalOpen} onOpenChange={(isOpen) => { setIsEquationModalOpen(isOpen); if (!isOpen) setIsEquationZoomed(false); }}>
        <DialogContent
          className="p-0 border-0 max-w-3xl rounded-none"
          dir="rtl"
          showCloseButton={false}
        >
          <DialogHeader className="bg-[#a55800ff] text-white p-4 relative h-14 rounded-none"> {/* Added h-14 for a consistent height */}
            {/* Title and Icon on the right */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <CircleHelp className="h-6 w-6" />
              <DialogTitle className="font-serif font-bold text-xl">القوانين</DialogTitle>
            </div>
            <DialogDescription className="sr-only">عرض القوانين الرياضية</DialogDescription>
            {/* Close button on the left */}
            {/* Close button on the left */}
            <DialogClose className="absolute left-4 top-1/2 -translate-y-1/2 rounded-none opacity-70 ring-offset-background transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground cursor-pointer">
              <X className="h-6 w-6" />
              <span className="sr-only">Close</span>
            </DialogClose>
          </DialogHeader>
          <img src={EquationImage} alt="Equation" className="rounded-none" onDragStart={(e) => e.preventDefault()} />
        </DialogContent>
      </Dialog>

      {/* Folder modal */}
      {isFolderDialogOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 rounded-none" dir="rtl" style={{ fontFamily: 'serif' }}>
          <div className="bg-[#068479] max-w-md w-full mx-4 shadow-md border border-white rounded-none">
            <div className="bg-[#068479] p-2 flex justify-between items-center border-b border-white rounded-none">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-6 w-6 text-white" />
                <h3 className="text-white">
                  المجلدات
                </h3>
              </div>
              <button
                onClick={() => setIsFolderDialogOpen(false)}
                className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer rounded-none"
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
                      <Button variant="outline" className="bg-transparent hover:bg-transparent hover:text-yellow-200 text-white border-white cursor-pointer rounded-none">
                        {selectedFolder || "اختر"}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent dir="rtl" style={{ fontFamily: 'serif' }} className="bg-[#068479] hover:text-white text-white border-white w-32 rounded-none">
                      {Object.values(folders).map((folder) => (
                        <DropdownMenuItem
                          key={folder.name}
                          onSelect={() => setSelectedFolder(folder.name)}
                          className="hover:bg-transparent focus:bg-transparent cursor-pointer focus:text-yellow-200 rounded-none"
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
                      className="bg-transparent text-white mt-2 rounded-none"
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

      {/* Image Zoom Modal */}
      <Dialog modal={false} open={isImageZoomModalOpen} onOpenChange={setIsImageZoomModalOpen}>
        <DialogContent
          className="max-w-[95vw] md:max-w-4xl lg:max-w-6xl max-h-[90vh] p-0 bg-transparent border-0 rounded-none relative overflow-hidden flex items-center justify-center"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">تكبير الصورة</DialogTitle>
          <DialogDescription className="sr-only">عرض الصورة بحجم مكبر</DialogDescription>
          <DialogClose className="absolute top-3 left-3 z-50 p-2 bg-black/70 hover:bg-black/90 rounded-none text-white cursor-pointer transition-colors shadow-lg">
            <X className="h-6 w-6" />
          </DialogClose>
          {displayId && (
            <div className="absolute inset-0 grid grid-cols-2 sm:grid-cols-3 grid-rows-2 sm:grid-rows-3 gap-6 pointer-events-none z-20 overflow-hidden select-none">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  <div
                    className="text-xs text-gray-400 font-mono"
                    style={{ transform: 'rotate(-25deg)', opacity: '0.12' }}
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
            className="w-auto h-auto max-w-full max-h-[85vh] object-contain rounded-none relative z-10 block mx-auto shadow-2xl bg-white"
            onDragStart={(e) => e.preventDefault()}
          />
        </DialogContent>
      </Dialog>

      <footer className={`flex justify-between items-center px-3 py-2 bg-[#068479] text-white rounded-none ${isMobile ? 'fixed bottom-0 w-full' : ''}`} dir="rtl">
        <div>محاكي الطرقعة</div>
        {isMobile && (
          <button
            onClick={() => setIsEndSectionModalOpen(true)}
            disabled={!shouldEnableEndSectionButton}
            className="bg-[#ff6a00ff] text-white px-4 py-1 rounded-none disabled:bg-gray-400 disabled:cursor-not-allowed cursor-pointer"
          >
            انهاء القسم
          </button>
        )}
      </footer>

      {/* exit dialog */}
      <Dialog modal={false} open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <DialogContent dir="rtl" className="bg-[#068479] border-slate-700 max-w-md w-full p-0 overflow-hidden rounded-none">
          {/* Modal Header */}
          <div className="p-1 text-center">
            <div className="flex justify-center mb-1">
              <div className="p-5 transition-transform duration-300 hover:scale-110">
                <TriangleAlert className="h-8 w-8 text-slate-100" />
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
              <p className="text-slate-100 text-base leading-relaxed">
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
                className="flex-1 bg-transparent text-slate-100 transition-all duration-300 py-3 rounded-none font-bold border-[0.5px] border-slate-100 hover:bg-transparent cursor-pointer"
              >
                نعم
              </Button>
              {/* Cancel Button (Secondary Action) */}
              <Button
                onClick={() => setIsExitDialogOpen(false)}
                className="flex-1 bg-transparent text-slate-100 transition-all duration-300 py-3 rounded-none font-bold border-[0.5px] border-slate-100 hover:bg-transparent cursor-pointer"
              >
                الغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default QuestionDisplay;