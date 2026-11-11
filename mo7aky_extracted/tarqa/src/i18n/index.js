import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Arabic translations
const ar = {
  translation: {
    // Common
    start: 'بدء',
    next: 'التالي',
    previous: 'السابق',
    finish: 'إنهاء',
    continue: 'متابعة',
    cancel: 'إلغاء',
    save: 'حفظ',
    close: 'إغلاق',
    loading: 'جاري التحميل...',
    
    // Exam
    exam: {
      title: 'الاختبار الإلكتروني',
      subtitle: 'اختبار شامل يحتوي على 65 سؤالاً موزعة على 5 أقسام',
      startExam: 'بدء الاختبار',
      finishExam: 'إنهاء الاختبار',
      question: 'السؤال',
      of: 'من',
      section: 'القسم',
      timeRemaining: 'الوقت المتبقي',
      answered: 'مجاب',
      unanswered: 'غير مجاب',
      deferred: 'مؤجل',
      total: 'المجموع',
      instructions: 'التعليمات',
      passage: 'النص'
    },
    
    // Question Types
    questionTypes: {
      analogy: 'التناظر اللفظي',
      completion: 'إكمال الجمل',
      error: 'الخطأ السياقي',
      rc: 'استيعاب المقروء',
      odd: 'المفردة الشاذة'
    },
    
    // Exam Modes
    examModes: {
      sectioned: 'أقسام منفصلة',
      sectionedDesc: '5 أقسام، كل قسم 13 سؤال مع مراجعة',
      single: 'كتلة واحدة',
      singleDesc: 'جميع الأسئلة متتالية بدون توقف'
    },
    
    // Timer
    timer: {
      none: 'بدون مؤقت',
      total: 'مؤقت للاختبار كاملاً',
      section: 'مؤقت لكل قسم',
      duration: 'المدة (بالدقائق)',
      minutes: 'دقيقة',
      minutes_plural: 'دقائق'
    },
    
    // Settings
    settings: {
      examMode: 'نمط الاختبار',
      timerSettings: 'إعدادات المؤقت',
      advancedOptions: 'خيارات متقدمة',
      shuffleQuestions: 'ترتيب الأسئلة عشوائي',
      shuffleChoices: 'ترتيب الإجابات عشوائي',
      examInfo: 'معلومات الاختبار'
    },
    
    // Review
    review: {
      title: 'مراجعة الأسئلة',
      allQuestions: 'جميع الأسئلة',
      unansweredQuestions: 'الأسئلة غير المجابة',
      deferredQuestions: 'الأسئلة المؤجلة',
      answeredQuestions: 'الأسئلة المجابة',
      defer: 'تأجيل السؤال',
      undefer: 'إلغاء التأجيل',
      reviewAll: 'مراجعة جميع الأسئلة',
      reviewUnanswered: 'مراجعة غير المجاب',
      endReview: 'إنهاء المراجعة'
    },
    
    // Results
    results: {
      title: 'نتائج الاختبار',
      score: 'النتيجة',
      percentage: 'النسبة المئوية',
      grade: 'التقدير',
      excellent: 'ممتاز',
      veryGood: 'جيد جداً',
      good: 'جيد',
      acceptable: 'مقبول',
      weak: 'ضعيف',
      correctAnswers: 'الإجابات الصحيحة',
      incorrectAnswers: 'الإجابات الخاطئة',
      reviewErrors: 'مراجعة الأخطاء',
      yourAnswer: 'إجابتك',
      correctAnswer: 'الإجابة الصحيحة',
      notAnswered: 'لم يتم الإجابة',
      restart: 'إعادة الاختبار'
    },
    
    // History
    history: {
      title: 'سجل النتائج السابقة',
      date: 'التاريخ',
      mode: 'النمط',
      score: 'النتيجة',
      percentage: 'النسبة'
    },
    
    // Messages
    messages: {
      answerRequired: 'يجب اختيار إجابة للمتابعة',
      unansweredWarning: 'لديك {{count}} أسئلة غير مجابة. تأكد من مراجعتها قبل إنهاء الاختبار.',
      noQuestionsInCategory: 'لا توجد أسئلة في هذا التصنيف',
      allAnswered: 'تم الإجابة على جميع الأسئلة',
      noDeferred: 'لا توجد أسئلة مؤجلة',
      noneAnswered: 'لم يتم الإجابة على أي سؤال بعد',
      confirmSettings: 'تأكد من إعداداتك قبل البدء - لا يمكن تغييرها أثناء الاختبار'
    }
  }
};

// English translations
const en = {
  translation: {
    // Common
    start: 'Start',
    next: 'Next',
    previous: 'Previous',
    finish: 'Finish',
    continue: 'Continue',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    loading: 'Loading...',
    
    // Exam
    exam: {
      title: 'Electronic Exam',
      subtitle: 'Comprehensive exam containing 65 questions across 5 sections',
      startExam: 'Start Exam',
      finishExam: 'Finish Exam',
      question: 'Question',
      of: 'of',
      section: 'Section',
      timeRemaining: 'Time Remaining',
      answered: 'Answered',
      unanswered: 'Unanswered',
      deferred: 'Deferred',
      total: 'Total',
      instructions: 'Instructions',
      passage: 'Passage'
    },
    
    // Question Types
    questionTypes: {
      analogy: 'Verbal Analogy',
      completion: 'Sentence Completion',
      error: 'Contextual Error',
      rc: 'Reading Comprehension',
      odd: 'Odd One Out'
    },
    
    // Exam Modes
    examModes: {
      sectioned: 'Sectioned',
      sectionedDesc: '5 sections, 13 questions each with review',
      single: 'Single Block',
      singleDesc: 'All questions consecutively without breaks'
    },
    
    // Timer
    timer: {
      none: 'No Timer',
      total: 'Timer for Entire Exam',
      section: 'Timer per Section',
      duration: 'Duration (minutes)',
      minutes: 'minute',
      minutes_plural: 'minutes'
    },
    
    // Settings
    settings: {
      examMode: 'Exam Mode',
      timerSettings: 'Timer Settings',
      advancedOptions: 'Advanced Options',
      shuffleQuestions: 'Shuffle Questions',
      shuffleChoices: 'Shuffle Choices',
      examInfo: 'Exam Information'
    },
    
    // Review
    review: {
      title: 'Review Questions',
      allQuestions: 'All Questions',
      unansweredQuestions: 'Unanswered Questions',
      deferredQuestions: 'Deferred Questions',
      answeredQuestions: 'Answered Questions',
      defer: 'Defer Question',
      undefer: 'Remove Deferral',
      reviewAll: 'Review All Questions',
      reviewUnanswered: 'Review Unanswered',
      endReview: 'End Review'
    },
    
    // Results
    results: {
      title: 'Exam Results',
      score: 'Score',
      percentage: 'Percentage',
      grade: 'Grade',
      excellent: 'Excellent',
      veryGood: 'Very Good',
      good: 'Good',
      acceptable: 'Acceptable',
      weak: 'Weak',
      correctAnswers: 'Correct Answers',
      incorrectAnswers: 'Incorrect Answers',
      reviewErrors: 'Review Errors',
      yourAnswer: 'Your Answer',
      correctAnswer: 'Correct Answer',
      notAnswered: 'Not Answered',
      restart: 'Restart Exam'
    },
    
    // History
    history: {
      title: 'Previous Results History',
      date: 'Date',
      mode: 'Mode',
      score: 'Score',
      percentage: 'Percentage'
    },
    
    // Messages
    messages: {
      answerRequired: 'You must select an answer to continue',
      unansweredWarning: 'You have {{count}} unanswered questions. Make sure to review them before finishing the exam.',
      noQuestionsInCategory: 'No questions in this category',
      allAnswered: 'All questions have been answered',
      noDeferred: 'No deferred questions',
      noneAnswered: 'No questions answered yet',
      confirmSettings: 'Confirm your settings before starting - they cannot be changed during the exam'
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ar,
      en
    },
    lng: 'ar', // Default language
    fallbackLng: 'ar',
    
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage']
    },

    interpolation: {
      escapeValue: false
    }
  });

export default i18n;

