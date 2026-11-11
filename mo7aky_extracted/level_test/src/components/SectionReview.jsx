import React, { useState, useEffect } from "react";
import { useExamStore } from "../store/examStore";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Clock, ArrowLeft, ArrowRight, BookOpen, BarChart3, Target, GraduationCap, Award, Home, AlertTriangle } from 'lucide-react';

const SectionReview = () => {
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

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const {
    currentSection,
    examQuestions,
    userAnswers,
    deferredQuestions,
    exitSectionReview,
    goToQuestion,
    timerActive,
    timeRemaining,
    examMode,
    completeExam,
    moveToNextSectionFromReview,
    resetExam // Added resetExam
  } = useExamStore();

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
    deferred: 0
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
  });

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getQuestionTypeLabel = (type) => {
    const typeLabels = {
      analogy: 'التناظر اللفظي',
      completion: 'اكمال الجمل',
      error: 'الخطا السياقي',
      rc: 'استيعاب المقروء',
      odd: 'المفردة الشاذة'
    };
    return typeLabels[type] || type;
  };

  const handleQuestionClick = (questionNumber) => {
    const globalIndex = examQuestions.findIndex(q => q.question_number === questionNumber);
    if (globalIndex !== -1) {
      goToQuestion(globalIndex);
      window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelNextSection = () => {
    setShowConfirmModal(false);
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
      <div dir="rtl" className="text-slate-300">
        {/* Adjusted Header - Mobile Optimized */}
        <div className="relative overflow-hidden">
          <div className="relative max-w-7xl mx-auto px-6 pt-12 pb-0 text-center">
            <h1 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6 leading-tight">
              مراجعة القسم {currentSection}
            </h1>
            <p className="text-lg text-blue-100 mb-8 max-w-3xl mx-auto leading-relaxed">
              راجع اجاباتك قبل الانتقال للقسم التالي
            </p>

            {/* Enhanced Progress Indicator */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 sm:p-8 max-w-md mx-auto mb-8 border border-white/20 shadow-2xl">
              <div className="text-center mb-6">
                <div className="text-white text-xl sm:text-2xl font-bold mb-2">
                  القسم {currentSection} من {totalSections}
                </div>
              </div>

              {/* Circular Progress */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    stroke="url(#progressGradient)"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${(currentSection / totalSections) * 283} 283`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="50%" stopColor="#06D6A0" />
                      <stop offset="100%" stopColor="#00F5FF" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg sm:text-xl font-bold">
                    {Math.round((currentSection / totalSections) * 100)}%
                  </span>
                </div>
              </div>

              {/* Timer inside the same box */}
              {timerActive && (
                <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-md rounded-lg px-4 py-2 inline-flex items-center gap-2 border border-red-300/30">
                  <Clock className="w-4 h-4 text-red-200" />
                  <span className="text-white font-bold text-base tracking-wider">
                    {formatTime(timeRemaining)}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant=""
              className="absolute top-3 right-3 sm:top-6 sm:right-6 text-orange-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/30 px-2 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
              onClick={() => {
                resetExam();
              }}
            >
              <Home className="h-4 w-4 sm:h-6 sm:w-6 sm:ml-2" />
              <span className="font-bold text-xs sm:text-base hidden sm:inline">الصفحة الرئيسية</span>
            </Button>
          </div>
        </div>

        {/* Main Content - Mobile Optimized */}
        <div className="max-w-7xl mx-auto px-4 py-5 space-y-8 sm:px-6 lg:px-8">
          <div className="space-y-6 sm:space-y-8">
            {/* Enhanced Statistics Cards - Mobile Optimized */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <Card className="bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
                <CardContent className="p-4 sm:p-6 text-center">
                  <div className="flex items-center justify-center mb-0 sm:mb-2">
                    <div className="p-3 transition-transform duration-300 hover:scale-110">
                      <BarChart3 className="h-8 w-8 text-orange-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1 sm:mb-2 text-center -mt-1">{sectionStats.total}</div>
                  <div className="text-lg font-bold text-orange-400 mb-2">اجمالي الاسئلة</div>
                </CardContent>
              </Card>

              <Card className="bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
                <CardContent className="p-4 sm:p-6 text-center">
                  <div className="flex items-center justify-center mb-0 sm:mb-2">
                    <div className="p-3 transition-transform duration-300 hover:scale-110">
                      <CheckCircle className="h-8 w-8 text-orange-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1 sm:mb-2 text-center -mt-1">{sectionStats.answered}</div>
                  <div className="text-lg font-bold text-orange-400 mb-2">مُجابة</div>
                </CardContent>
              </Card>

              <Card className="bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
                <CardContent className="p-4 sm:p-6 text-center">
                  <div className="flex items-center justify-center mb-0 sm:mb-2">
                    <div className="p-3 transition-transform duration-300 hover:scale-110">
                      <XCircle className="h-8 w-8 text-orange-400" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-100 mb-1 sm:mb-2 text-center -mt-1">{sectionStats.unanswered}</div>
                  <div className="text-lg font-bold text-orange-400 mb-2">غير مُجاب</div>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Questions Grid - Mobile Optimized */}
            <Card className="border-0 shadow-xl bg-[#001625]/70 backdrop-blur-sm border border-orange-400/20">
              <CardHeader className="pb-4 sm:pb-6">
                <div className="flex items-center justify-center mb-2 sm:mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <Target className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-slate-100 text-center">
                  اسئلة القسم {currentSection}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
                  {sectionQuestions.sort((a, b) => a.question_number - b.question_number).map((question, index) => {
                    const isAnswered = userAnswers[question.question_number] !== undefined;
                    const isDeferred = deferredQuestions[question.question_number];

                    return (
                      <div
                        key={question.question_number}
                        className={`relative p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-300 hover:shadow-xl transform hover:scale-105 border-2 ${isAnswered
                          ? 'border-[#00d3f2]/80 bg-[#00d3f2]/10 hover:bg-[#00d3f2]/20 hover:border-[#00d3f2]'
                          : isDeferred
                            ? 'border-amber-500/80 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500'
                            : 'border-slate-700 bg-slate-900 hover:bg-slate-700/70 hover:border-slate-600'
                          }`}
                        onClick={() => handleQuestionClick(question.question_number)}
                      >
                        {/* Status Icon with custom hex color */}
                        <div className="absolute top-1 left-1 sm:top-2 sm:left-2">
                          {isAnswered ? (
                            <CheckCircle className="w-4 h-4 text-[#00d3f2]" />
                          ) : isDeferred ? (
                            <Clock className="w-4 h-4 text-amber-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-500" />
                          )}
                        </div>

                        {/* Question Number */}
                        <div className="text-center mb-2 sm:mb-4">
                          <div className="text-lg sm:text-2xl font-bold text-slate-100">
                            {question.question_number}
                          </div>
                          <div className="text-xs sm:text-sm text-slate-400 font-medium">
                            السؤال
                          </div>
                        </div>

                        {/* Question Preview */}
                        <div className="text-xs sm:text-sm text-slate-300 text-center line-clamp-2 sm:line-clamp-3 mb-2 sm:mb-4 leading-relaxed">
                          {question.question}
                        </div>

                        {/* Status Label (Text-Only) */}
                        <div className="text-center">
                          <span className={`text-xs font-bold ${isAnswered
                            ? 'text-[#00d3f2]'
                            : isDeferred
                              ? 'text-amber-400'  // Updated for better visibility
                              : 'text-slate-400'   // Updated for better visibility
                            }`}>
                            {isAnswered ? 'مُجابة' : isDeferred ? 'مؤجلة' : 'غير مُجاب'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Enhanced Action Buttons - Mobile Optimized */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 sm:pt-6">
              <Button
                onClick={() => {
                  exitSectionReview();
                  // Navigate to the first question of the current section
                  const firstQuestionOfSection = examQuestions.find(q => q.section === currentSection);
                  if (firstQuestionOfSection) {
                    const questionIndex = examQuestions.findIndex(q => q.question_number === firstQuestionOfSection.question_number);
                    if (questionIndex !== -1) {
                      goToQuestion(questionIndex);
                    }
                  }
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-12 py-6 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                size="sm"
              >
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-1 sm:ml-2" />
                العودة للقسم {currentSection}
              </Button>

              <Button
                onClick={handleNextSection}
                className="px-12 py-6 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                size="sm"
              >
                {isLastSection ? 'انهاء الاختبار' : `الانتقال للقسم ${currentSection + 1}`}
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
              </Button>
            </div>
          </div>
        </div>

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" dir="rtl">
            <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700">

              {/* Modal Header */}
              <div className="p-6 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 transition-transform duration-300 hover:scale-110">
                    <AlertTriangle className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  تاكيد الانهاء
                </h3>
              </div>

              {/* Modal Content */}
              <div className="p-6 pt-0">
                {/* Centered Text Container */}
                <div className="flex items-center justify-center text-center mb-8 h-24">
                  <p className="text-slate-300 text-base leading-relaxed">
                    هل انت متاكد من رغبتك في انهاء هذه المراجعة؟ بمجرد التاكيد، لن تتمكن من العودة للاجابة على الاسئلة.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row-reverse gap-3">
                  {/* Confirm Button (Primary Action) */}
                  <Button
                    onClick={confirmNextSection}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                  >
                    نعم
                  </Button>
                  {/* Cancel Button (Secondary Action) */}
                  <Button
                    onClick={cancelNextSection}
                    className="flex-1 bg-orange-500 hover:bg-orange-600 text-slate-900 transition-all duration-300 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl cursor-pointer"
                  >
                    الغاء
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SectionReview;

