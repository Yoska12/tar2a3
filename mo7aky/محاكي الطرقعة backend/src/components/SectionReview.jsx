import React, { useState, useEffect } from "react";
import { useExamStore } from "../store/examStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from './ui/badge';
import { CheckCircle, X, Clock, ArrowLeft, ArrowRight, BookOpen, BarChart3, Target, GraduationCap, Award, Home, AlertTriangle, Flag, GalleryVertical, LogIn, GalleryHorizontal, SquareMinus, SquareX, TriangleAlert } from 'lucide-react';
import { useIsMobile } from '../hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const arabicOrdinalNames = [
  '', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس',
  'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر',
  'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر',
  'السادس عشر', 'السابع عشر', 'الثامن عشر', 'التاسع عشر', 'العشرون',
  'الحادي والعشرون', 'الثاني والعشرون', 'الثالث والعشرون', 'الرابع والعشرون', 'الخامس والعشرون',
  'السادس والعشرون', 'السابع والعشرون', 'الثامن والعشرون', 'التاسع والعشرون', 'الثلاثون',
  'الحادي والثلاثون', 'الثاني والثلاثون', 'الثالث والثلاثون', 'الرابع والثلاثون', 'الخامس والثلاثون',
  'السادس والثلاثون', 'السابع والثلاثون', 'الثامن والثلاثون', 'التاسع والثلاثون', 'الأربعون',
  'الحادي والأربعون', 'الثاني والأربعون', 'الثالث والأربعون', 'الرابع والأربعون', 'الخامس والأربعون',
  'السادس والأربعون', 'السابع والأربعون', 'الثامن والأربعون', 'التاسع والأربعون', 'الخمسون'
];

const SectionReview = () => {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isTimerModalOpen, setIsTimerModalOpen] = useState(false);
  const [timerModalMessage, setTimerModalMessage] = useState('');
  const [reviewAlertModal, setReviewAlertModal] = useState({ isOpen: false, message: '' });
  const [fontSize, setFontSize] = useState('normal'); // normal, small, smaller, large, larger
  const isMobile = useIsMobile();

  const fontSizeMap = {
    'normal': 'خط عادي',
    'large': 'خط عريض',
    'larger': 'خط عريض بزيادة'
  };

  const {
    currentSection,
    examQuestions,
    userAnswers,
    deferredQuestions,
    markedQuestions,
    exitSectionReview,
    goToQuestion,
    timerActive,
    timeRemaining,
    examMode,
    completeExam,
    moveToNextSectionFromReview,
    enterSectionReviewMode,
    exitSectionReviewMode,
    questionsPerSection,
    timerInterval,
    startTimer,
    nightMode,
  } = useExamStore();

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

  // Calculate total sections
  const totalSections = Math.max(...examQuestions.map(q => q.section));
  const isLastSection = currentSection === totalSections;

  // Get current section questions
  const sectionQuestions = examQuestions.filter(q => q.section === currentSection);

  // Calculate section statistics
  const sectionStats = {
    total: sectionQuestions.length,
    answered: 0,
    unanswered: 0,
    deferred: 0,
    marked: 0
  };

  sectionQuestions.forEach(question => {
    if (userAnswers[question.question_number] !== undefined) {
      sectionStats.answered++;
    } else {
      sectionStats.unanswered++;
    }

    if (deferredQuestions[question.question_number]) {
      sectionStats.deferred++;
    }

    if (markedQuestions[question.question_number]) {
      sectionStats.marked++;
    }
  });

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleQuestionClick = (questionNumber) => {
    exitSectionReviewMode();
    const globalIndex = examQuestions.findIndex(q => q.question_number === questionNumber);
    if (globalIndex !== -1) {
      goToQuestion(globalIndex);
      window.scrollTo({ top: 0, }); // Scroll to top
    }
  };

  const handleNextSection = () => {
    setShowConfirmModal(true);
  };

  const confirmNextSection = () => {
    setShowConfirmModal(false);
    if (isLastSection) {
      completeExam();
    } else {
      moveToNextSectionFromReview();
    }
    window.scrollTo({ top: 0, });
  };

  const cancelNextSection = () => {
    setShowConfirmModal(false);
  };

  const handleReviewMarked = () => {
    if (enterSectionReviewMode('marked')) {
      window.scrollTo({ top: 0 });
    } else {
      setReviewAlertModal({ isOpen: true, message: "لا توجد أسئلة مميزة بعلامة في هذا القسم." });
    }
  };

  const handleReviewIncomplete = () => {
    if (enterSectionReviewMode('incomplete')) {
      window.scrollTo({ top: 0 });
    } else {
      setReviewAlertModal({ isOpen: true, message: "جميع الأسئلة في هذا القسم مكتملة." });
    }
  };

  const handleReturnToSection = () => {
    exitSectionReviewMode();
    const firstQuestionOfSection = examQuestions.find(q => q.section === currentSection);
    if (firstQuestionOfSection) {
      const questionIndex = examQuestions.findIndex(q => q.question_number === firstQuestionOfSection.question_number);
      if (questionIndex !== -1) {
        goToQuestion(questionIndex);
      }
    }
    window.scrollTo({ top: 0 });
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
      `}</style>
      <div className={`h-screen flex flex-col ${nightMode ? 'bg-slate-900' : 'bg-white'}`} dir="rtl" style={{ fontFamily: 'arial', zoom: isMobile ? '90%' : '125%' }}>
        <div className="sticky top-0 z-20">
          {/* Header */}
          <div className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[#005085ff]"></div>
            <div className="">
              <div className="mx-auto">
                <div className="flex justify-between items-center flex-wrap gap-3">
                  <div className="hidden md:flex items-center gap-3">
                    <div className="backdrop-blur-sm rounded-xl px-4 py-1">
                      <div className="text-white text-xl">
                        اختبار القدرات العامة - القسم العلمي - سري جدا - محاكي الطرقعة
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
                      <Home className="h-6 w-6" />
                    </Button>
                  </div>

                  <div className="w-full md:w-auto flex items-center gap-3 flex-wrap">
                    <div className="w-full flex flex-row-reverse md:flex-col justify-between items-center md:items-end">
                      {timerActive && (
                        <div className="backdrop-blur-sm rounded-xl px-4 py-1 hover-yellow-text">
                          <div className={`text-sm md:text-base flex items-center gap-2 ${timeRemaining < 300 ? 'text-[#ffff00]' : 'text-white'}`}>
                            <Clock className="h-5 w-5" />
                            <span className="hidden md:inline">الوقت المتبقي</span>
                            <span className="text-sm md:text-base tracking-wide">{formatTime(timeRemaining)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-0.5 bg-white w-full"></div>

          {/* Second Header */}
          <div className="bg-[#0066a1ff] text-white p-5 text-right text-xl flex items-center">
          </div>
        </div>

        {/* Main Content */}
        <div className={`flex-grow pb-48 ${nightMode ? 'bg-slate-900' : ''}`}>
          <div className={`text-center text-xl font-bold py-4 ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}>
            القسم {currentSection} استعراض
          </div>

          <div className="bg-[#0066a1ff] text-white p-2 text-right text-xl flex items-center">
            <SquareMinus className="w-5 h-5" />
            <span className="pr-2">
              إرشادات
            </span>
          </div>
          <div className="px-4 py-4">
            <div className={`text-right ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}>
              <p className="mb-2 text-sm">فيما يلي ملخص لإجاباتك يمكنك مراجعة أسئلتك بثلاث (3) طرق مختلفه</p>
              <p className="mb-4 text-sm">الأزرار الموجودة في الركن السفلي الأيسر تطابق هذه الخيارات :</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>قم بمراجعة كل أسئلتك وإجاباتك.</li>
                <li>قم بمراجعة الأسئلة غير المكتملة.</li>
                <li>قم بمراجعة الأسئلة المميزة بعلامة للمراجعة (انقر فوق الرمز تمييز لتغيير العلامة الخاصة بحالة المراجعة.)</li>
              </ol>
              <p className="mt-4 text-sm">يمكنك أيضاً النقر فوق رقم سؤال لربطه مباشرة بموقعه في الاختبار.</p>
            </div>
          </div>

          {/* Questions Spreadsheet */}
          <div className="border-t-2 border-b-2 border-gray-400 mt-4">
            <div className="bg-[#0066a1ff] text-white p-2 text-right text-xl flex items-center justify-between">
              <div className="flex items-center">
                <SquareMinus className="w-5 h-5" />
                <span className="pr-2">
                  القسم {arabicOrdinalNames[currentSection]}
                </span>
              </div>
              <span className="text-base">
                ({sectionStats.unanswered} غير مرئي/غير مكتمل)
              </span>
            </div>
            <div className="grid grid-cols-3">
              {sectionQuestions.sort((a, b) => a.question_number - b.question_number).map((question, index) => {
                const isMarked = markedQuestions[question.question_number];
                const isUnanswered = userAnswers[question.question_number] === undefined;

                return (
                  <div
                    key={question.question_number}
                    className={`p-3 cursor-pointer ${(index + 1) % 3 !== 0 ? 'border-l-2 border-gray-400' : ''
                      } border-b-2 border-gray-400`}
                    onClick={() => handleQuestionClick(question.question_number)}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center">
                        <Flag className={`w-5 h-5 ml-2 -scale-x-100 -rotate-5 ${isMarked ? 'fill-[#0066a1ff] text-[#0066a1ff]' : 'text-[#0066a1ff]'}`} />
                        <span className={`text-sm ${nightMode ? 'text-slate-200' : 'text-gray-800'}`}>السؤال {(question.question_number - 1) % questionsPerSection + 1}</span>
                      </div>
                      {isUnanswered && (
                        <div className="text-red-500 text-base">
                          غير مكتمل
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="fixed bottom-0 left-0 right-0 z-10">
          <div className="backdrop-blur-sm border-t">
            <div className="absolute inset-0 bg-[#005085ff]"></div>
            <div className="relative mx-auto">
              {/* Mobile View */}
              <div className="flex md:hidden justify-between items-stretch w-full">
                <div>
                  <Button
                    onClick={handleNextSection}
                    className='text-base font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-4'
                    size="lg"
                  ><LogIn className="h-5 w-5 ml-2 -scale-x-100" />
                    <span>{isLastSection ? 'انهاء' : `انهاء`}</span>

                  </Button>
                </div>
                <div className="flex">
                  <Button
                    onClick={handleReturnToSection}
                    className="text-base font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-4"
                    size="lg"
                  >
                    <GalleryHorizontal className="h-7 w-7 ml-2" />
                    <span>الكل</span>
                  </Button>
                  <Button
                    onClick={handleReviewIncomplete}
                    className="text-base font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 px-2"
                    size="lg"
                  >
                    <X className="h-8 w-8 ml-2 stroke-[3]" />
                    <span>غير المكتمل</span>
                  </Button>
                  <Button
                    onClick={handleReviewMarked}
                    className="text-base font-bold rounded-none flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-4"
                    size="lg"
                  >
                    <Flag className="h-7 w-7 ml-2 -scale-x-100 -rotate-5 fill-white" />
                    <span>المميز</span>
                  </Button>
                </div>
              </div>

              {/* Desktop View */}
              <div className="hidden md:flex items-stretch justify-between">
                <div className="flex items-stretch">
                  <Button
                    onClick={handleNextSection}
                    className='text-lg font-bold rounded-l-lg flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-2'
                    size="sm" >
                    <LogIn className="h-5 w-5 ml-2 -scale-x-100" />
                    <span className="inline">{isLastSection ? 'انهاء الاختبار' : `انهاء المراجعة`}</span>
                  </Button>
                  <div className="w-[2px] self-stretch bg-white mx-2"></div>
                </div>
                <div className="flex items-stretch">
                  <div className="w-[2px] self-stretch bg-white mx-2"></div>
                  <Button
                    onClick={handleReturnToSection}
                    className="text-lg font-bold rounded-r-lg flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-2"
                    size="sm"
                  >
                    <GalleryHorizontal className="h-5 w-5 ml-2" />
                    <span className="inline">مراجعة الكل</span>
                  </Button>
                  <div className="w-[2px] self-stretch bg-white mx-2"></div>
                  <Button
                    onClick={handleReviewIncomplete}
                    className="text-lg font-bold flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-2"
                    size="sm"
                  >
                    <X className="h-6 w-6 ml-2 stroke-[3]" />
                    <span className="inline">مراجعة الغير مكتمل</span>
                  </Button>
                  <div className="w-[1px] self-stretch bg-white mx-2"></div>
                  <Button
                    onClick={handleReviewMarked}
                    className="text-lg font-bold flex-shrink-0 cursor-pointer bg-transparent no-hover border-0 p-2"
                    size="sm"
                  >
                    <Flag className="h-5 w-5 ml-2 -scale-x-100 -rotate-5 fill-white" />
                    <span className="inline">مراجعة المميز بعلامة</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" dir="rtl">
            {/* Main Modal Container with Classic Styling */}
            <div className="bg-[#005085ff] max-w-md w-full mx-4 shadow-md border border-white">

              {/* Title Bar */}
              <div className="bg-[#005085ff] p-2 flex justify-between items-center border-b border-white">
                <h3 className="text-white">
                  التأكد على إنهاء المراجعة
                </h3>
                <button
                  onClick={cancelNextSection}
                  className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer"
                >
                  <SquareX className="h-6 w-6 text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 text-right text-white space-y-4 text-base">
                <p className="leading-relaxed">
                  الرجاء التأكيد على رغبتك في إنهاء هذه المراجعة. إذا نقرت فوق 'نعم'، لن تكون هناك إمكانية للعودة إلى هذه المراجعة والإجابة على الأسئلة التي لم تكتمل.
                </p>
                <p className="">
                  هل أنت متأكد أنك تريد إنهاء هذه المراجعة؟
                </p>
              </div>

              {/* Action Buttons */}
              <div className="px-4 pb-4 flex justify-center gap-3">
                {/* Confirm Button (Primary Action) */}
                <Button
                  onClick={confirmNextSection}
                  className="cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
                >
                  <span>نعم</span>
                </Button>
                {/* Cancel Button (Secondary Action) */}
                <Button
                  onClick={cancelNextSection}
                  className="cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
                >
                  <span>لا</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Timer Modal */}
        {isTimerModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" dir="rtl">
            {/* Main Modal Container with Classic Styling */}
            <div className="bg-[#005085ff] max-w-md w-full mx-4 shadow-md">

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

        {/* Review Alert Modal */}
        {reviewAlertModal.isOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4" dir="rtl">
            {/* Main Modal Container with Classic Styling */}
            <div className="bg-[#005085ff] max-w-md w-full mx-4 shadow-md">

              {/* Title Bar */}
              <div className="bg-[#005085ff] p-2 flex justify-between items-center border-b border-white">
                <div className="flex items-center gap-2">
                  <TriangleAlert className="h-6 w-6 text-white" />
                  <h3 className="text-white">
                    تنبيه!
                  </h3>
                </div>
                <button
                  onClick={() => setReviewAlertModal({ isOpen: false, message: '' })}
                  className="p-0 h-auto bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 no-hover cursor-pointer"
                >
                  <SquareX className="h-6 w-6 text-white" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 text-right text-white space-y-4 text-base">
                <p className="leading-relaxed text-lg">
                  {reviewAlertModal.message}
                </p>
              </div>

              {/* Action Button */}
              <div className="px-4 pb-4 flex justify-center gap-3">
                {/* Confirm Button (Primary Action) */}
                <Button
                  onClick={() => setReviewAlertModal({ isOpen: false, message: '' })}
                  className="cursor-pointer text-white py-[1px] px-[8px] border-[0.5px] border-white bg-transparent rounded-none hover-yellow-text hover:bg-transparent hover:border-[#ffff00]"
                >
                  <span>حسنا</span>
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
};

export default SectionReview;
