import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; // Added createJSONStorage
import { generateExam, getAllQuestions, bankMapping, categoryMapping } from '../utils/dataLoader';
import { get, set, del } from 'idb-keyval'; // Import idb-keyval
import {
  preloadInitialBatch,
  preloadBackgroundBatch,
  preloadSlidingWindow,
  extractImageUrls
} from '../utils/imagePreloader';

// Custom storage object for idb-keyval
const storage = {
  getItem: async (name) => {
    const stored = await get(name);
    if (!stored) return null;

    const now = Date.now();
    const EXPIRATION_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds

    // Check if data has expired
    if (now - stored.timestamp > EXPIRATION_TIME) {
      await del(name); // Delete expired data
      return null; // Return null to trigger state reset
    }

    return stored.value;
  },
  setItem: async (name, value) => {
    // Save data with a timestamp
    const data = {
      timestamp: Date.now(),
      value: value,
    };
    await set(name, data);
  },
  removeItem: async (name) => {
    await del(name);
  },
};

export const useExamStore = create(
  persist(
    (set, get) => ({
      // User state
      user: null,
      setUser: (user) => set({ user }),
      historyVisible: false,
      showHistory: () => set({ historyVisible: true }),
      hideHistory: () => set({ historyVisible: false }),

      // Exam configuration with user settings persistence
      examMode: 'sectioned', // 'sectioned' or 'single'
      timerMode: 'none', // 'none', 'total', 'section'
      timerDuration: 13, // minutes
      shuffleQuestions: true, // Default to true for random questions
      shuffleChoices: false,
      rcQuestionOrder: 'sequential', // New: 'sequential' or 'random' for RC questions

      // NEW: Configuration for multiple question type filtering
      questionTypeFilter: 'all', // 'all', 'specific', or 'multiple'
      selectedQuestionType: null, // For single type: 'analogy', 'completion', 'error', 'rc', 'odd'
      selectedQuestionTypes: [], // NEW: For multiple types: array of type strings
      selectedBanks: Object.keys(bankMapping), // NEW: Default to all banks
      selectedExam: null,

      // Exam state
      examStarted: false,
      examCompleted: false,
      currentQuestionIndex: 0,
      currentSection: 1, // Start from 1 instead of 0
      sectionReviewMode: false, // New: for section review
      hasSeenSectionReview: false, // Track if user has seen section review page
      returnedFromSectionReview: false, // Track if user returned from section review
      reviewedSection: null, // Track which section was reviewed
      hideDeferButton: false, // New: to hide defer button when section ends

      // Questions and answers
      examQuestions: [],
      userAnswers: {}, // questionNumber -> choiceIndex
      deferredQuestions: {}, // questionNumber -> boolean

      // Timer
      timerActive: false,
      timeRemaining: 0,
      timerInterval: null,

      // Review mode
      reviewMode: false,
      reviewFilter: 'all', // 'all', 'answered', 'unanswered', 'deferred'

      // Results
      examResults: null,
      resultHistory: [],
      startTime: null, // Add startTime to the store
      pastResultToReview: null,
      reviewPastResult: (result) => set({ pastResultToReview: result, historyVisible: false }),
      finishReviewingPastResult: () => set({ pastResultToReview: null, historyVisible: true }),
      nightMode: false, // Night mode for QuestionDisplay

      // --- ACTIONS ---

      toggleNightMode: () => {
        set((state) => ({ nightMode: !state.nightMode }));
      },

      // Computed properties for correct/incorrect answers
      get correctAnswers() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => {
            const userAnswerIndex = userAnswers[q.question_number];
            const isAnswered = userAnswerIndex !== undefined;
            if (!isAnswered) return false;

            const correctAnswerValue = q.answer;
            if (typeof correctAnswerValue === 'number') {
              return userAnswerIndex === correctAnswerValue;
            }
            if (typeof correctAnswerValue === 'string' && q.choices) {
              return q.choices[userAnswerIndex] === correctAnswerValue;
            }
            return false;
          })
          .map(q => q.question_number);
      },

      get incorrectAnswers() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => {
            const userAnswerIndex = userAnswers[q.question_number];
            const isAnswered = userAnswerIndex !== undefined;
            if (!isAnswered) return false;

            const correctAnswerValue = q.answer;
            let isCorrect = false;
            if (typeof correctAnswerValue === 'number') {
              isCorrect = userAnswerIndex === correctAnswerValue;
            } else if (typeof correctAnswerValue === 'string' && q.choices) {
              isCorrect = q.choices[userAnswerIndex] === correctAnswerValue;
            }

            return !isCorrect;
          })
          .map(q => q.question_number);
      },

      get unansweredQuestions() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => userAnswers[q.question_number] === undefined)
          .map(q => q.question_number);
      },

      // Shuffle array utility
      shuffleArray: (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
      },

      /*
      // Group RC questions by passage for sequential ordering
      groupRCQuestionsByPassage: (rcQuestions) => {
        const passageGroups = new Map();

        rcQuestions.forEach(question => {
          const passageKey = question.passage || 'no-passage';
          if (!passageGroups.has(passageKey)) {
            passageGroups.set(passageKey, []);
          }
          passageGroups.get(passageKey).push(question);
        });

        return Array.from(passageGroups.values());
      },
      */

      // Initialize exam with configuration
      initializeExam: async (config = {}) => {
        try {
          console.log('Initializing exam with config:', config);

          let examData;
          if (config.questions) {
            examData = { questions: config.questions };
          } else {
            const { smartExamProgress } = get(); // Get smartExamProgress
            const examConfig = {
              shuffleQuestions: config.shuffleQuestions !== undefined ? config.shuffleQuestions : true,
              shuffleChoices: config.shuffleChoices || false,
              examMode: config.examMode || 'sectioned',
              rcQuestionOrder: config.rcQuestionOrder || 'sequential',
              questionTypeFilter: config.questionTypeFilter || 'all',
              selectedQuestionType: config.selectedQuestionType || null,
              // selectedQuestionTypes: config.selectedQuestionTypes || [], // NEW: Multiple types support
              selectedBanks: config.selectedBanks || get().selectedBanks, // NEW: Pass selected banks
              singleSectionType: config.selectedQuestionType || null,
              excludeQuestionIds: config.excludeQuestionIds !== undefined ? config.excludeQuestionIds : smartExamProgress
            };
            // Generate exam questions using the generateExam function from dataLoader
            examData = await generateExam(examConfig);
          }

          if (!examData || !examData.questions || examData.questions.length === 0) {
            throw new Error('Failed to generate exam questions or no questions available for the selected criteria.');
          }
          const generatedQuestions = examData.questions;
          console.log('Generated exam questions:', generatedQuestions.length);

          let processedQuestions = generatedQuestions;

          // Re-number questions sequentially
          processedQuestions = processedQuestions.map((question, index) => ({
            ...question,
            question_number: index + 1,
            original_question_number: question.question_number, // Keep original for reference
          }));

          // Assign sections based on question_number (11 questions per section)
          processedQuestions = processedQuestions.map((question, index) => ({
            ...question,
            section: Math.floor(index / 11) + 1,
          }));

          console.log('Final processed questions:', processedQuestions.length);

          // 🚀 Intelligent High-Speed Image Preloading
          // 1. Separate into High-Priority (Section 1: first 11 questions) & Background (remaining questions)
          const section1Questions = processedQuestions.filter(q => q.section === 1);
          const initialImageUrls = extractImageUrls(section1Questions.length > 0 ? section1Questions : processedQuestions.slice(0, 11));
          
          const remainingQuestions = processedQuestions.filter(q => (q.section || 1) > 1);
          const remainingImageUrls = extractImageUrls(remainingQuestions.length > 0 ? remainingQuestions : processedQuestions.slice(11));

          // 2. High-priority preloading for Section 1 with safety timeout (max 2000ms)
          if (initialImageUrls.length > 0) {
            try {
              await preloadInitialBatch(initialImageUrls, 2000);
            } catch (err) {
              console.warn('Initial image preloading finished with warning (safe fallback):', err);
            }
          }

          // 3. Non-blocking background batch for remaining pool (up to 55 questions)
          if (remainingImageUrls.length > 0) {
            preloadBackgroundBatch(remainingImageUrls, 3, 100);
          }

          // Set up timer
          const timerDuration = config.timerMode === 'none' ? 0 : (config.timerDuration || 13) * 60;

          // Clear any existing timer
          const { timerInterval } = get();
          if (timerInterval) {
            clearInterval(timerInterval);
          }

          set({
            examMode: config.examMode || 'sectioned',
            timerMode: config.timerMode || 'none',
            timerDuration: config.timerDuration || 13,
            shuffleQuestions: config.shuffleQuestions !== undefined ? config.shuffleQuestions : true,
            shuffleChoices: config.shuffleChoices || false,
            rcQuestionOrder: config.rcQuestionOrder || 'sequential',
            questionTypeFilter: config.questionTypeFilter || 'all',
            selectedQuestionType: config.selectedQuestionType || null,
            selectedQuestionTypes: config.selectedQuestionTypes || [], // NEW: Store multiple types
            selectedExam: config.examName,
            examQuestions: processedQuestions,
            examStarted: true,
            examCompleted: false,
            currentQuestionIndex: 0,
            currentSection: 1,
            sectionReviewMode: false,
            hideDeferButton: false,
            userAnswers: {},
            deferredQuestions: {},
            timerActive: config.timerMode !== 'none',
            timeRemaining: timerDuration,
            reviewMode: false,
            examResults: null,
            timerInterval: null,
            startTime: new Date().toISOString(), // Set start time
          });

          // Start timer if enabled
          if (config.timerMode !== 'none') {
            get().startTimer();
          }

          console.log('Exam initialized successfully');

        } catch (error) {
          console.error('Error initializing exam:', error);

          // Reset to safe state
          set({
            examStarted: false,
            examCompleted: false,
            currentQuestionIndex: 0,
            currentSection: 1,
            sectionReviewMode: false,
            hideDeferButton: false,
            examQuestions: [],
            userAnswers: {},
            deferredQuestions: {},
            timerActive: false,
            timeRemaining: 0,
            timerInterval: null,
            reviewMode: false,
            examResults: null
          });

          throw error; // Re-throw to be handled by the UI
        }
      },

      // Get current exam info
      getCurrentExamInfo: () => {
        const state = get();
        return {
          type: state.questionTypeFilter === 'specific'
            ? state.selectedQuestionType
            : state.questionTypeFilter === 'multiple'
              ? state.selectedQuestionTypes
              : 'all',
          mode: state.examMode,
          totalQuestions: state.examQuestions.length,
          currentSection: state.currentSection,
          rcQuestionOrder: state.rcQuestionOrder
        };
      },

      // Get question statistics
      getQuestionStats: () => {
        const { examQuestions, userAnswers, deferredQuestions, correctAnswers, incorrectAnswers } = get();

        if (!examQuestions || examQuestions.length === 0) {
          return {
            total: 0,
            answered: 0,
            unanswered: 0,
            deferred: 0,
            correct: 0,
            incorrect: 0,
            percentage: 0
          };
        }

        let answered = 0;
        let deferred = 0;

        examQuestions.forEach(question => {
          if (userAnswers[question.question_number] !== undefined) {
            answered++;
          }
          if (deferredQuestions[question.question_number]) {
            deferred++;
          }
        });

        const correct = correctAnswers.length;
        const incorrect = incorrectAnswers.length;
        const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;

        return {
          total: examQuestions.length,
          answered,
          unanswered: examQuestions.length - answered,
          deferred,
          correct,
          incorrect,
          percentage
        };
      },

      // Start timer
      startTimer: () => {
        const { timerInterval } = get();

        // Clear existing timer
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        const interval = setInterval(() => {
          const { timeRemaining } = get();

          if (timeRemaining <= 0) {
            get().completeExam();
            return;
          }

          set({ timeRemaining: timeRemaining - 1 });
        }, 1000);

        set({ timerInterval: interval });
      },

      // Stop timer
      stopTimer: () => {
        const { timerInterval } = get();
        if (timerInterval) {
          clearInterval(timerInterval);
          set({ timerInterval: null, timerActive: false });
        }
      },

      // Select answer
      selectAnswer: (questionNumber, choiceIndex) => {
        const { userAnswers, deferredQuestions } = get();
        set({
          userAnswers: {
            ...userAnswers,
            [questionNumber]: choiceIndex
          },
          deferredQuestions: {
            ...deferredQuestions,
            [questionNumber]: false // Remove deferred flag when answered
          }
        });
      },

      // Toggle deferred status
      toggleDeferred: (questionNumber) => {
        const { deferredQuestions } = get();
        const isCurrentlyDeferred = deferredQuestions[questionNumber];

        set({
          deferredQuestions: {
            ...deferredQuestions,
            [questionNumber]: !isCurrentlyDeferred
          }
        });
      },

      // Navigation
      nextQuestion: () => {
        const { currentQuestionIndex, examQuestions, examMode } = get();
        const nextIndex = currentQuestionIndex + 1;

        // Check if we're at the end of the current section in sectioned mode
        if (examMode === 'sectioned') {
          // Calculate which question number this is (1-based)
          const currentQuestionNumber = currentQuestionIndex + 1;

          // If this is the end of a section (questions 11, 22, 33, 44) and there are more questions
          if (currentQuestionNumber % 11 === 0 && nextIndex < examQuestions.length) {
            // Show section review before moving to next section
            set({
              sectionReviewMode: true
            });
            return;
          }
        }

        if (nextIndex < examQuestions.length) {
          const nextQuestion = examQuestions[nextIndex];
          const nextSection = nextQuestion.section;
          const currentSection = get().currentSection;

          // 🚀 Sliding Window: Preload upcoming questions (N+1, N+2) in cache
          preloadSlidingWindow(examQuestions, nextIndex, 2);

          set({
            currentQuestionIndex: nextIndex,
            currentSection: nextSection,
            // Reset returnedFromSectionReview and hasSeenSectionReview when moving to a new section
            returnedFromSectionReview: nextSection !== currentSection ? false : get().returnedFromSectionReview,
            hasSeenSectionReview: nextSection !== currentSection ? false : get().hasSeenSectionReview
          });
        } else {
          // End of exam
          get().completeExam();
        }
      },

      previousQuestion: () => {
        const { currentQuestionIndex, examQuestions } = get();
        const prevIndex = currentQuestionIndex - 1;

        if (prevIndex >= 0) {
          const prevQuestion = examQuestions[prevIndex];
          const prevSection = prevQuestion.section;

          // 🚀 Sliding Window: Preload previous/adjacent questions
          preloadSlidingWindow(examQuestions, prevIndex, 2);

          set({
            currentQuestionIndex: prevIndex,
            currentSection: prevSection
          });
        }
      },

      // Jump to specific question
      goToQuestion: (questionIndex) => {
        const { examQuestions, sectionReviewMode } = get();

        if (questionIndex >= 0 && questionIndex < examQuestions.length) {
          const question = examQuestions[questionIndex];

          // 🚀 Sliding Window: Warm up upcoming questions from the target
          preloadSlidingWindow(examQuestions, questionIndex, 2);

          set({
            currentQuestionIndex: questionIndex,
            currentSection: question.section,
            reviewMode: false,
            sectionReviewMode: false,
            // If coming from section review, mark as returned
            returnedFromSectionReview: sectionReviewMode ? true : get().returnedFromSectionReview
          });
        }
      },

      // New action: Move to next section from review
      moveToNextSectionFromReview: () => {
        const { currentSection, examQuestions } = get();
        const nextSection = currentSection + 1;
        const nextSectionFirstQuestion = examQuestions.find(q => q.section === nextSection);

        if (nextSectionFirstQuestion) {
          const questionIndex = examQuestions.findIndex(q => q.question_number === nextSectionFirstQuestion.question_number);
          if (questionIndex !== -1) {
            // 🚀 Sliding Window: Warm up upcoming questions in the new section
            preloadSlidingWindow(examQuestions, questionIndex, 3);

            set({
              currentQuestionIndex: questionIndex,
              currentSection: nextSection,
              sectionReviewMode: false,
              returnedFromSectionReview: false,
              hasSeenSectionReview: false, // <-- FIX: Reset this state for the new section
              reviewMode: false,
            });
          }
        } else {
          // If no next section, it means it's the last section, complete the exam
          get().completeExam();
        }
      },

      // Exit review mode
      exitReviewMode: () => {
        set({ reviewMode: false });
      },

      // Complete exam
      completeExam: () => {
        const { examQuestions, userAnswers, deferredQuestions, timerInterval, resultHistory } = get();

        // Stop timer
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        let correctAnswers = 0;
        let incorrectAnswers = 0;
        let unansweredQuestions = 0;

        const categoryStats = {
          search: { name: (bankMapping && bankMapping['search']) || 'بنك الأسئلة (القسم الكمي)', correct: 0, total: 0 }
        };
        Object.entries(categoryMapping || {}).forEach(([arName, key]) => {
          if (!categoryStats[key]) {
            categoryStats[key] = { name: (bankMapping && bankMapping[key]) || arName, correct: 0, total: 0 };
          }
        });

        const getCategoryKey = (type) => {
          return type || 'search';
        };

        const detailedResults = examQuestions.map(question => {
          const userAnswerIndex = userAnswers[question.question_number];
          const isAnswered = userAnswerIndex !== undefined;
          const correctAnswerValue = question.answer;
          let isCorrect = false;

          if (isAnswered) {
            if (typeof correctAnswerValue === 'number') {
              isCorrect = userAnswerIndex === correctAnswerValue;
            } else if (typeof correctAnswerValue === 'string' && question.choices) {
              isCorrect = question.choices[userAnswerIndex] === correctAnswerValue;
            }
          }

          if (isCorrect) {
            correctAnswers++;
          } else if (isAnswered) {
            incorrectAnswers++;
          } else {
            unansweredQuestions++;
          }

          const categoryKey = getCategoryKey(question.type);
          if (!categoryStats[categoryKey]) {
            categoryStats[categoryKey] = { name: (bankMapping && bankMapping[categoryKey]) || categoryKey, correct: 0, total: 0 };
          }
          categoryStats[categoryKey].total++;
          if (isCorrect) {
            categoryStats[categoryKey].correct++;
          }

          let correctAnswerIndex = -1;
          if (typeof correctAnswerValue === 'number') {
            correctAnswerIndex = correctAnswerValue;
          } else if (typeof correctAnswerValue === 'string' && question.choices) {
            correctAnswerIndex = question.choices.findIndex(c => c === correctAnswerValue);
          }

          return {
            questionId: question.id,
            questionNumber: question.question_number,
            questionType: question.type,
            userAnswer: userAnswerIndex,
            correctAnswer: correctAnswerIndex,
            isCorrect: isCorrect,
            isDeferred: !!deferredQuestions[question.question_number],
            isAnswered: isAnswered
          };
        });

        const categoryPerformanceArray = Object.values(categoryStats)
          .filter(c => c.total > 0)
          .map(c => ({
            ...c,
            percentage: c.total > 0 ? (c.correct / c.total) * 100 : 0
          }));
        const sortedCategoryPerformance = categoryPerformanceArray;

        const results = {
          totalQuestions: examQuestions.length,
          correctAnswers,
          incorrectAnswers,
          unansweredQuestions,
          answers: detailedResults,
          categoryPerformance: sortedCategoryPerformance,
          timestamp: new Date().toISOString(),
          timeTaken: get().startTime ? Math.round((new Date() - new Date(get().startTime)) / 1000) : 0, // Calculate time taken in seconds
        };

        set({
          examCompleted: true,
          examResults: results,
          timerActive: false,
          timerInterval: null,
          resultHistory: [...resultHistory, results]
        });

        // Save answered questions to smart exam progress, unless it's a "Mistakes Exam"
        if (get().selectedExam !== 'مراجعة الأخطاء') {
          const answeredQuestionIds = examQuestions.map(q => q.id);
          get().saveSmartExamProgress(answeredQuestionIds);
        }

        console.log('Exam completed. Results:', results);
      },

      // Reset exam state
      resetExam: () => {
        const { timerInterval } = get();
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        set({
          examStarted: false,
          examCompleted: false,
          historyVisible: false,
          pastResultToReview: null,
          currentQuestionIndex: 0,
          currentSection: 1,
          sectionReviewMode: false,
          hideDeferButton: false,
          examQuestions: [],
          userAnswers: {},
          deferredQuestions: {},
          timerActive: false,
          timeRemaining: 0,
          timerInterval: null,
          reviewMode: false,
          reviewFilter: 'all',
          examResults: null,
          startTime: null, // Reset start time
          selectedExam: null,
        });
        console.log('Exam state reset.');
      },

      // Set review mode
      setReviewMode: (mode) => set({ reviewMode: mode }),
      setReviewFilter: (filter) => set({ reviewFilter: filter }),

      // Navigate to next section in review mode
      nextSection: () => {
        const { currentSection, examQuestions } = get();
        const maxSection = Math.max(...examQuestions.map(q => q.section));
        if (currentSection < maxSection) {
          set({ currentSection: currentSection + 1 });
        }
      },

      // Navigate to previous section in review mode
      previousSection: () => {
        const { currentSection } = get();
        if (currentSection > 1) {
          set({ currentSection: currentSection - 1 });
        }
      },

      // Exit section review mode
      exitSectionReview: () => {
        const { currentSection, examQuestions } = get();
        const nextQuestionIndex = currentSection * 11; // Assuming 11 questions per section

        // If moving to next section, reset hasSeenSectionReview
        const isMovingToNextSection = nextQuestionIndex < examQuestions.length;
        const targetIndex = isMovingToNextSection ? nextQuestionIndex : examQuestions.length - 1;

        // 🚀 Sliding Window: Preload upcoming questions when exiting review
        preloadSlidingWindow(examQuestions, targetIndex, 3);

        set({
          sectionReviewMode: false,
          returnedFromSectionReview: true, // Mark that user returned from section review
          currentQuestionIndex: targetIndex,
          currentSection: nextQuestionIndex < examQuestions.length ? currentSection + 1 : currentSection,
          // Reset hasSeenSectionReview if moving to next section
          hasSeenSectionReview: isMovingToNextSection ? false : get().hasSeenSectionReview
        });
      },

      // Go to section review
      goToSectionReview: () => {
        const { currentSection } = get();
        set({
          sectionReviewMode: true,
          hasSeenSectionReview: true,
          reviewedSection: currentSection // Track which section is being reviewed
        });
      },

      // Set exam mode
      setExamMode: (mode) => set({ examMode: mode }),
      setTimerMode: (mode) => set({ timerMode: mode }),
      setTimerDuration: (duration) => set({ timerDuration: duration }),
      setShuffleQuestions: (shuffle) => set({ shuffleQuestions: shuffle }),
      setShuffleChoices: (shuffle) => set({ shuffleChoices: shuffle }),
      setRcQuestionOrder: (order) => set({ rcQuestionOrder: order }),
      setQuestionTypeFilter: (filter) => set({ questionTypeFilter: filter }),
      setSelectedQuestionType: (type) => set({ selectedQuestionType: type }),

      // NEW: Actions for multiple question types
      setSelectedQuestionTypes: (types) => set({ selectedQuestionTypes: types }),

      addQuestionType: (type) => {
        const { selectedQuestionTypes } = get();
        if (!selectedQuestionTypes.includes(type)) {
          set({ selectedQuestionTypes: [...selectedQuestionTypes, type] });
        }
      },

      removeQuestionType: (type) => {
        const { selectedQuestionTypes } = get();
        set({ selectedQuestionTypes: selectedQuestionTypes.filter(t => t !== type) });
      },

      toggleQuestionType: (type) => {
        const { selectedQuestionTypes } = get();
        if (selectedQuestionTypes.includes(type)) {
          get().removeQuestionType(type);
        } else {
          get().addQuestionType(type);
        }
      },

      // NEW: Bank Selection Actions
      setSelectedBanks: (banks) => set({ selectedBanks: banks }),

      toggleBankSelection: (bankKey) => {
        const { selectedBanks } = get();
        if (selectedBanks.includes(bankKey)) {
          set({ selectedBanks: selectedBanks.filter(b => b !== bankKey) });
        } else {
          set({ selectedBanks: [...selectedBanks, bankKey] });
        }
      },

      selectAllBanks: () => set({ selectedBanks: Object.keys(bankMapping) }),
      deselectAllBanks: () => set({ selectedBanks: [] }),

      // Folders state
      folders: {},

      // Smart Exam State
      isSmartExamEnabled: true,
      toggleSmartExam: () => set((state) => ({ isSmartExamEnabled: !state.isSmartExamEnabled })),
      smartExamProgress: [],
      totalQuestionsInPool: 0,

      // Fetch folders from the server
      fetchFolders: async () => {
        try {
          const response = await fetch('Login/folders/get_folders.php', { credentials: 'include' });
          const data = await response.json();
          if (data.success) {
            set({ folders: data.folders });
          } else {
            console.error('Failed to fetch folders:', data.error);
          }
        } catch (error) {
          console.error('Error fetching folders:', error);
        }
      },

      // Start an exam from a folder
      startExamFromFolder: (folderName) => {
        const { folders, initializeExam } = get();
        const folder = folders[folderName];
        if (folder && folder.questions.length > 0) {
          initializeExam({
            questions: folder.questions,
            examMode: 'single',
            timerMode: 'none',
            examName: folderName
          });
        }
      },

      // Create a new folder
      createFolder: async (folderName) => {
        try {
          const response = await fetch('Login/folders/create_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
          });
          const data = await response.json();
          if (data.success) {
            const { folders } = get();
            const newFolders = { ...folders, [folderName]: { name: folderName, questions: [] } };
            set({ folders: newFolders });
          } else {
            console.error('Failed to create folder:', data.error);
          }
        } catch (error) {
          console.error('Error creating folder:', error);
        }
      },

      // Add a question to a folder
      addQuestionToFolder: async (folderName, question) => {
        try {
          const response = await fetch('Login/folders/add_question_to_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName, question }),
          });
          const data = await response.json();
          if (data.success) {
            const { folders } = get();
            const newFolders = { ...folders };
            const folder = newFolders[folderName];
            if (folder) {
              folder.questions.push(question);
              set({ folders: newFolders });
            }
          } else {
            console.error('Failed to add question to folder:', data.error);
          }
        } catch (error) {
          console.error('Error adding question to folder:', error);
        }
      },

      // Delete a folder
      deleteFolder: async (folderName) => {
        try {
          const response = await fetch('Login/folders/delete_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
          });
          const data = await response.json();
          if (data.success) {
            const { folders } = get();
            const newFolders = { ...folders };
            delete newFolders[folderName];
            set({ folders: newFolders });
          } else {
            console.error('Failed to delete folder:', data.error);
          }
        } catch (error) {
          console.error('Error deleting folder:', error);
        }
      },

      // Rename a folder
      renameFolder: async (oldFolderName, newFolderName) => {
        try {
          const response = await fetch('Login/folders/rename_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldFolderName, newFolderName }),
          });
          const data = await response.json();
          if (data.success) {
            const { folders } = get();
            const newFolders = { ...folders };
            const folderData = newFolders[oldFolderName];
            delete newFolders[oldFolderName];
            newFolders[newFolderName] = { ...folderData, name: newFolderName };
            set({ folders: newFolders });
            return true;
          } else {
            console.error('Failed to rename folder:', data.error);
            return data.error;
          }
        } catch (error) {
          console.error('Error renaming folder:', error);
          return error.message;
        }
      },

      // Remove a question from a folder
      removeQuestionFromFolder: async (folderName, questionId, questionType) => {
        try {
          const response = await fetch('Login/folders/remove_question_from_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName, questionId, questionType }),
          });
          const data = await response.json();
          if (data.success) {
            const { folders } = get();
            const newFolders = { ...folders };
            const folder = newFolders[folderName];
            if (folder) {
              folder.questions = folder.questions.filter(q => q.id !== questionId || q.type !== questionType);
              set({ folders: newFolders });
            }
          } else {
            console.error('Failed to remove question from folder:', data.error);
          }
        } catch (error) {
          console.error('Error removing question from folder:', error);
        }
      },

      // Smart Exam Actions
      fetchSmartExamProgress: async () => {
        try {
          const response = await fetch('Login/smart_exam_progress.php', { credentials: 'include' });
          if (response.ok) {
            const text = await response.text();
            try {
              const data = JSON.parse(text);
              if (data && data.success && Array.isArray(data.answeredQuestions)) {
                set({ smartExamProgress: data.answeredQuestions });
                console.log('Smart exam progress loaded:', data.answeredQuestions.length);
              }
            } catch {
              // Ignore non-JSON response in development
            }
          }
          // NEW: Update totalQuestionsInPool
          const allQuestions = await getAllQuestions();
          set({ totalQuestionsInPool: allQuestions.length });
        } catch (error) {
          console.error('Error fetching smart exam progress:', error);
        }
      },

      saveSmartExamProgress: async (progress) => {
        try {
          const { smartExamProgress } = get();
          let newProgress;
          if (Array.isArray(progress)) {
            newProgress = [...new Set([...(smartExamProgress || []), ...progress])];
          } else {
            newProgress = smartExamProgress || [];
          }
          set({ smartExamProgress: newProgress });
          await fetch('Login/smart_exam_progress.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answeredQuestions: newProgress }),
          });
          console.log('Smart exam progress saved to server');
        } catch (error) {
          console.error('Error saving smart exam progress:', error);
        }
      },

      updateSmartExamProgress: async (newProgress) => {
        try {
          set({ smartExamProgress: newProgress });
          await fetch('Login/smart_exam_progress.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answeredQuestions: newProgress }),
          });
          console.log('Smart exam progress updated on server');
        } catch (error) {
          console.error('Failed to update smart exam progress:', error);
        }
      },

      resetSmartExamProgress: async () => {
        try {
          await fetch('Login/reset_smart_exam_progress.php', {
            method: 'POST',
            credentials: 'include',
          });
          set({ smartExamProgress: [] });
          console.log('Smart exam progress reset on server');
        } catch (error) {
          console.error('Error resetting smart exam progress:', error);
        }
      },

      resetBankProgress: async (bankKeys) => {
        const keys = Array.isArray(bankKeys) ? bankKeys : [bankKeys];
        const { smartExamProgress } = get();
        const updated = (smartExamProgress || []).filter(id => {
          if (typeof id === 'object' && id !== null) {
            return !keys.includes(id.file);
          }
          return !keys.some(k => String(id).startsWith(`${k}-`));
        });
        await get().updateSmartExamProgress(updated);
      },

      resetCategoryProgress: async (categoryKeys) => {
        const keys = Array.isArray(categoryKeys) ? categoryKeys : [categoryKeys];
        const { smartExamProgress } = get();
        const updated = (smartExamProgress || []).filter(id => {
          if (typeof id === 'object' && id !== null) {
            return !keys.includes(id.file);
          }
          const parts = String(id).split('-');
          return !keys.includes(parts[1]);
        });
        await get().updateSmartExamProgress(updated);
      },

      // New: Reset specific (Bank + Category) progress
      resetSpecificProgress: async (targetItems) => {
        const { smartExamProgress } = get();
        const updated = (smartExamProgress || []).filter(id => {
          if (typeof id === 'object' && id !== null) {
            return !targetItems.some(item => item.bank === id.file && item.category === id.exam);
          }
          const parts = String(id).split('-');
          const bank = parts[0];
          const category = parts[1];
          const matches = targetItems.some(item => item.bank === bank && item.category === category);
          return !matches;
        });
        await get().updateSmartExamProgress(updated);
      },

      // Clear history
      clearResultHistory: () => set({ resultHistory: [] }),

      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'exam-storage', // unique name
      storage: createJSONStorage(() => storage), // Use createJSONStorage with our custom async storage
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) =>
            !['timerInterval', '_hasHydrated', 'folders', 'smartExamProgress', 'totalQuestionsInPool'].includes(key)
          )
        ),
      onRehydrateStorage: () => (state) => {
        if (state) {
          console.log("Hydration finished");
          state.setHasHydrated(true);
        }
      },
    }
  )
);