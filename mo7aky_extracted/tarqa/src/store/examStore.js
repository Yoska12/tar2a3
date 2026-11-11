import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
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

import dataLoader, { initializeQuestionData, resetDataLoader } from '../utils/dataLoader';

export const useExamStore = create(
  persist(
    (set, get) => ({
      // Exam configuration with user settings persistence
      timerMode: 'none', // 'none', 'total', 'section'
      timerDuration: 11, // minutes
      shuffleChoices: false,

      // New configuration for category and exam selection
      selectedCategory: null, // category key
      selectedExam: null, // exam name

      // Exam state
      examStarted: false,
      examCompleted: false,
      viewingHistory: false,
      viewingQuestionsManager: false, // New state for history page
      currentQuestionIndex: 0,
      currentSection: 1, // Start from 1 instead of 0
      sectionReviewMode: false, // New: for section review
      hasSeenSectionReview: false, // Track if user has seen section review page
      returnedFromSectionReview: false, // Track if user returned from section review
      reviewedSection: null, // Track which section was reviewed
      hideDeferButton: false, // New: to hide defer button when section ends

      // Smart Exam Progress
      smartExamProgress: [], // Array of answered question IDs stringified

      // Questions and answers
      examQuestions: [],
      userAnswers: {}, // questionNumber -> choiceIndex
      deferredQuestions: {}, // questionNumber -> boolean
      markedQuestions: {}, // questionNumber -> boolean

      // Timer
      timerActive: false,
      timeRemaining: 0,
      timerInterval: null,

      // Review mode
      reviewMode: false,
      reviewFilter: 'all', // 'all', 'answered', 'unanswered', 'deferred'

      // Section review filter
      sectionReviewFilter: 'all', // 'all', 'marked', 'incomplete'
      filteredQuestionIndices: [],
      currentFilteredIndex: 0,

      // Results
      examResults: null,
      pastResultToReview: null, // New state for reviewing a past result
      resultHistory: [],
      fontSize: 20,
      user: null,
      folders: {}, // { [folderName]: { name: folderName, questions: [] } },
      examStartTime: null,
      nightMode: false, // Night mode for QuestionDisplay

      // --- ACTIONS ---

      toggleNightMode: () => {
        set((state) => ({ nightMode: !state.nightMode }));
      },

      setUser: (user) => {
        set({ user });
        if (user) {
          get().fetchFolders();
          get().fetchSmartExamProgress();
        } else {
          // Clear folders on logout
          set({ folders: {}, smartExamProgress: [] });
        }
      },

      setFontSize: (size) => set({ fontSize: size }),

      showHistory: () => set({ viewingHistory: true }),
      hideHistory: () => set({ viewingHistory: false }),
      showQuestionsManager: () => set({ viewingQuestionsManager: true, viewingHistory: false }),
      hideQuestionsManager: () => set({ viewingQuestionsManager: false }),
      reviewPastResult: (result) => set({ examCompleted: false, viewingHistory: false, pastResultToReview: result }),
      finishReviewingPastResult: () => set({ pastResultToReview: null, viewingHistory: true }),

      // Computed properties for correct/incorrect answers
      get correctAnswers() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => userAnswers[q.question_number] !== undefined && userAnswers[q.question_number] === q.answer)
          .map(q => q.question_number);
      },

      get incorrectAnswers() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => userAnswers[q.question_number] !== undefined && userAnswers[q.question_number] !== q.answer)
          .map(q => q.question_number);
      },

      get unansweredQuestions() {
        const { examQuestions, userAnswers } = get();
        return examQuestions
          .filter(q => userAnswers[q.question_number] === undefined)
          .map(q => q.question_number);
      },

      // Initialize exam with category and exam selection
      initializeExam: async (config = {}) => {
        get().resetExam(); // This will now call the correct reset function

        try {
          await initializeQuestionData(); // Re-load data after reset

          console.log('Initializing exam with config:', config);

          let generatedQuestions = [];

          // Handle multiple category selection (Multiple Whole Exams)
          if (config.categoryKeys && Array.isArray(config.categoryKeys) && config.categoryKeys.length > 0) {
            for (const key of config.categoryKeys) {
              const generationConfig = {
                shuffleChoices: config.shuffleChoices || false,
                categoryKey: key,
                examName: null // Null means all questions in this category (Whole Exam)
              };
              const { questions } = await dataLoader.generateExam(generationConfig);
              if (questions && questions.length > 0) {
                generatedQuestions = [...generatedQuestions, ...questions];
              }
            }
          }
          // Handle multiple sub-exam selection within a single category
          else if (config.examNames && Array.isArray(config.examNames) && config.examNames.length > 0) {
            const generationConfig = {
              shuffleChoices: config.shuffleChoices || false,
              categoryKey: config.categoryKey,
              examNames: config.examNames
            };
            const { questions } = await dataLoader.generateExam(generationConfig);
            if (questions && questions.length > 0) {
              generatedQuestions = questions;
            } else {
              for (const name of config.examNames) {
                const subConfig = {
                  shuffleChoices: config.shuffleChoices || false,
                  categoryKey: config.categoryKey,
                  examName: name
                };
                const subResult = await dataLoader.generateExam(subConfig);
                if (subResult.questions && subResult.questions.length > 0) {
                  generatedQuestions = [...generatedQuestions, ...subResult.questions];
                }
              }
            }
          }
          // Default single category/exam behavior
          else if (config.questions && config.questions.length > 0) {
            generatedQuestions = config.questions;
          } else {
            const generationConfig = {
              shuffleChoices: config.shuffleChoices || false,
              categoryKey: config.categoryKey || null,
              examName: config.examName || null,
            };
            const { questions } = await dataLoader.generateExam(generationConfig);
            generatedQuestions = questions;
          }

          const examConfig = {
            shuffleChoices: config.shuffleChoices || false,
            categoryKey: config.categoryKey || (config.categoryKeys ? 'multiple' : null),
            // Use 'اختبار مجمع' if multiple keys/names are provided, otherwise use provided name or default
            examName: ((config.categoryKeys && config.categoryKeys.length > 1) || (config.examNames && config.examNames.length > 1)) ? 'اختبار مجمع' : (config.examName || 'مراجعة الأخطاء'),
            examMode: config.examMode || 'sectioned' // 'sectioned' or 'combined'
          };

          if (!generatedQuestions || generatedQuestions.length === 0) {
            throw new Error('Failed to generate or provide exam questions');
          }

          let processedQuestions = generatedQuestions;

          // Re-number questions sequentially
          processedQuestions = processedQuestions.map((question, index) => ({
            ...question,
            question_number: index + 1,
            original_question_number: question.question_number, // Keep original for reference
          }));

          // Handle sectioned mode with review pages every 11 questions
          if (examConfig.examMode === 'sectioned') {
            const questionsPerSection = 11;
            let totalSections = 0;

            processedQuestions = processedQuestions.map((question, index) => {
              const sectionNumber = Math.floor(index / questionsPerSection) + 1;
              totalSections = Math.max(totalSections, sectionNumber);

              return {
                ...question,
                section: sectionNumber,
              };
            });

            const lastSectionQuestionCount = processedQuestions.length % questionsPerSection;
            const shouldSkipLastReview = lastSectionQuestionCount > 0 && lastSectionQuestionCount < questionsPerSection;

            console.log(`Exam divided into ${totalSections} sections of ${questionsPerSection} questions each`);
            console.log(`Last section has ${lastSectionQuestionCount || questionsPerSection} questions`);
            console.log(`Should skip last review: ${shouldSkipLastReview}`);

            set({
              totalSections,
              questionsPerSection,
              shouldSkipLastReview,
              examMode: 'sectioned'
            });
          } else {
            processedQuestions = processedQuestions.map((question, index) => ({
              ...question,
              section: 1,
            }));

            set({
              totalSections: 1,
              questionsPerSection: processedQuestions.length,
              shouldSkipLastReview: false,
              examMode: 'combined'
            });
          }

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

          const timerDuration = config.timerMode === 'none' ? 0 : (config.timerDuration || 11) * 60;

          const { timerInterval } = get();
          if (timerInterval) {
            clearInterval(timerInterval);
          }

          set({
            timerMode: config.timerMode || 'none',
            timerDuration: config.timerDuration || 11,
            shuffleChoices: examConfig.shuffleChoices,
            selectedCategory: examConfig.categoryKey,
            selectedExam: examConfig.examName,
            examQuestions: processedQuestions,
            examStarted: true,
            examCompleted: false,
            currentQuestionIndex: 0,
            currentSection: 1,
            sectionReviewMode: false,
            hasSeenSectionReview: false,
            returnedFromSectionReview: false,
            reviewedSection: null,
            hideDeferButton: false,
            userAnswers: {},
            deferredQuestions: {},
            timerActive: config.timerMode !== 'none',
            timeRemaining: timerDuration,
            reviewMode: false,
            examResults: null,
            timerInterval: null,
            examStartTime: new Date(),
          });

          if (config.timerMode !== 'none') {
            get().startTimer();
          }

          console.log('Exam initialized successfully');

        } catch (error) {
          console.error('Error initializing exam:', error);

          set({
            examStarted: false,
            examCompleted: false,
            currentQuestionIndex: 0,
            currentSection: 1,
            sectionReviewMode: false,
            hasSeenSectionReview: false,
            returnedFromSectionReview: false,
            reviewedSection: null,
            hideDeferButton: false,
            examQuestions: [],
            userAnswers: {},
            deferredQuestions: {},
            timerActive: false,
            timeRemaining: 0,
            timerInterval: null,
            reviewMode: false,
            examResults: null,
            totalSections: 1,
            questionsPerSection: 0,
            shouldSkipLastReview: false,
            examMode: 'combined'
          });

          throw error; // Re-throw to be handled by the UI
        }
      },

      // Get current exam info
      getCurrentExamInfo: () => {
        const state = get();
        return {
          category: state.selectedCategory,
          exam: state.selectedExam,
          totalQuestions: state.examQuestions.length,
          currentSection: state.currentSection
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
        const { userAnswers } = get();
        set({
          userAnswers: {
            ...userAnswers,
            [questionNumber]: choiceIndex
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

      toggleMarked: (questionNumber) => {
        const { markedQuestions } = get();
        const isCurrentlyMarked = markedQuestions[questionNumber];

        set({
          markedQuestions: {
            ...markedQuestions,
            [questionNumber]: !isCurrentlyMarked
          }
        });
      },

      // Navigation
      nextQuestion: () => {
        const {
          currentQuestionIndex,
          examQuestions,
          examMode,
          questionsPerSection,
          shouldSkipLastReview,
          totalSections,
          currentSection,
          userAnswers,
          deferredQuestions,
          sectionReviewFilter,
          filteredQuestionIndices,
          currentFilteredIndex,
          markedQuestions
        } = get();

        if (sectionReviewFilter !== 'all') {
          const nextFilteredIndex = currentFilteredIndex + 1;
          if (nextFilteredIndex < filteredQuestionIndices.length) {
            const nextQuestionIndex = filteredQuestionIndices[nextFilteredIndex];
            set({
              currentFilteredIndex: nextFilteredIndex,
              currentQuestionIndex: nextQuestionIndex,
            });
          } else {
            // End of filtered review, go back to section review screen
            get().exitSectionReviewMode();
            set({
              sectionReviewMode: true,
              reviewedSection: currentSection,
            });
          }
          return;
        }

        // Defer current question if unanswered
        const currentQuestion = examQuestions[currentQuestionIndex];
        if (currentQuestion && userAnswers[currentQuestion.question_number] === undefined) {
          set({
            deferredQuestions: {
              ...deferredQuestions,
              [currentQuestion.question_number]: true
            }
          });
        }

        const nextIndex = currentQuestionIndex + 1;

        if (nextIndex < examQuestions.length) {
          const nextQuestion = examQuestions[nextIndex];
          const nextSection = nextQuestion.section;

          // Check if we should show section review in sectioned mode
          if (examMode === 'sectioned' && questionsPerSection) {
            // Check if current question is the last question of the current section
            const currentQuestionNumber = currentQuestionIndex + 1;
            const isEndOfSection = currentQuestionNumber % questionsPerSection === 0;
            const isNotFinalSection = currentSection < totalSections;

            // Show review if:
            // 1. We're at the end of a section (every 11 questions)
            // 2. It's not the final section OR (it's the final section but we shouldn't skip it)
            const shouldShowReview = isEndOfSection && (isNotFinalSection || !shouldSkipLastReview);

            console.log('Section review check:', {
              currentQuestionIndex,
              currentQuestionNumber,
              isEndOfSection,
              isNotFinalSection,
              shouldSkipLastReview,
              shouldShowReview,
              currentSection,
              nextSection,
              totalSections
            });

            if (shouldShowReview) {
              // Show section review page
              set({
                sectionReviewMode: true,
                reviewedSection: currentSection,
                hasSeenSectionReview: true
              });
              return;
            }
          }

          // 🚀 Sliding Window: Preload upcoming questions (N+1, N+2) in cache
          preloadSlidingWindow(examQuestions, nextIndex, 2);

          set({
            currentQuestionIndex: nextIndex,
            currentSection: nextSection,
            sectionReviewMode: false
          });
        } else {
          // End of exam
          // Check for marked questions in the current section before completing
          const sectionQuestions = examQuestions.filter(q => q.section === currentSection);
          const hasMarkedQuestions = sectionQuestions.some(q => markedQuestions[q.question_number]);

          if (hasMarkedQuestions) {
            set({
              sectionReviewMode: true,
              reviewedSection: currentSection,
              hasSeenSectionReview: true
            });
            return;
          }

          get().completeExam();
        }
      },

      previousQuestion: () => {
        const {
          currentQuestionIndex,
          examQuestions,
          userAnswers,
          deferredQuestions,
          sectionReviewFilter,
          filteredQuestionIndices,
          currentFilteredIndex
        } = get();

        if (sectionReviewFilter !== 'all') {
          const prevFilteredIndex = currentFilteredIndex - 1;
          if (prevFilteredIndex >= 0) {
            const prevQuestionIndex = filteredQuestionIndices[prevFilteredIndex];
            set({
              currentFilteredIndex: prevFilteredIndex,
              currentQuestionIndex: prevQuestionIndex,
            });
          }
          return;
        }

        // Defer current question if unanswered
        const currentQuestion = examQuestions[currentQuestionIndex];
        if (currentQuestion && userAnswers[currentQuestion.question_number] === undefined) {
          set({
            deferredQuestions: {
              ...deferredQuestions,
              [currentQuestion.question_number]: true
            }
          });
        }

        const prevIndex = currentQuestionIndex - 1;

        if (prevIndex >= 0) {
          const prevQuestion = examQuestions[prevIndex];
          const prevSection = prevQuestion.section;

          set({
            currentQuestionIndex: prevIndex,
            currentSection: prevSection
          });

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, prevIndex, 2);
        }
      },

      // Jump to specific question
      goToQuestion: (questionIndex, keepFilter = false) => {
        if (!keepFilter) {
          get().exitSectionReviewMode();
        }
        const { examQuestions, currentQuestionIndex, userAnswers, deferredQuestions } = get();

        // Defer current question if unanswered
        const currentQuestion = examQuestions[currentQuestionIndex];
        if (currentQuestion && userAnswers[currentQuestion.question_number] === undefined) {
          set({
            deferredQuestions: {
              ...deferredQuestions,
              [currentQuestion.question_number]: true
            }
          });
        }

        if (questionIndex >= 0 && questionIndex < examQuestions.length) {
          const question = examQuestions[questionIndex];
          set({
            currentQuestionIndex: questionIndex,
            currentSection: question.section,
            reviewMode: false,
            sectionReviewMode: false
          });

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, questionIndex, 2);
        }
      },

      // Exit review mode
      exitReviewMode: () => {
        set({ reviewMode: false });
      },

      // Section review functions
      enterSectionReviewMode: (filter) => {
        const { examQuestions, currentSection, markedQuestions, userAnswers } = get();
        const sectionQuestions = examQuestions.filter(q => q.section === currentSection);

        let filteredQuestions;
        if (filter === 'marked') {
          filteredQuestions = sectionQuestions.filter(q => markedQuestions[q.question_number]);
        } else if (filter === 'incomplete') {
          filteredQuestions = sectionQuestions.filter(q => userAnswers[q.question_number] === undefined);
        } else {
          return false; // Invalid filter
        }

        if (filteredQuestions.length > 0) {
          const filteredIndices = filteredQuestions.map(q => examQuestions.findIndex(eq => eq.question_number === q.question_number));
          set({
            sectionReviewFilter: filter,
            filteredQuestionIndices: filteredIndices,
            currentFilteredIndex: 0,
          });
          get().goToQuestion(filteredIndices[0], true); // Pass a flag to avoid resetting the filter
          return true;
        }
        return false;
      },

      exitSectionReviewMode: () => {
        set({
          sectionReviewFilter: 'all',
          filteredQuestionIndices: [],
          currentFilteredIndex: 0
        });
      },

      exitSectionReview: () => {
        const {
          currentQuestionIndex,
          examQuestions,
          questionsPerSection,
          reviewedSection
        } = get();

        // Move to the first question of the next section
        const nextSectionStartIndex = reviewedSection * questionsPerSection;

        if (nextSectionStartIndex < examQuestions.length) {
          const nextQuestion = examQuestions[nextSectionStartIndex];
          set({
            sectionReviewMode: false,
            currentQuestionIndex: nextSectionStartIndex,
            currentSection: nextQuestion.section,
            returnedFromSectionReview: true,
            reviewedSection: null
          });

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, nextSectionStartIndex, 2);
        } else {
          // If no more questions, complete the exam
          get().completeExam();
        }
      },

      // Get questions for current section review
      getCurrentSectionQuestions: () => {
        const { examQuestions, reviewedSection, questionsPerSection } = get();

        if (!reviewedSection || !questionsPerSection) {
          return [];
        }

        const startIndex = (reviewedSection - 1) * questionsPerSection;
        const endIndex = Math.min(startIndex + questionsPerSection, examQuestions.length);

        return examQuestions.slice(startIndex, endIndex);
      },

      // Go to section review
      goToSectionReview: () => {
        const { currentSection } = get();
        set({
          sectionReviewMode: true,
          reviewedSection: currentSection,
          hasSeenSectionReview: true
        });
      },

      // Move to next section from review
      moveToNextSectionFromReview: () => {
        get().exitSectionReviewMode();
        const {
          examQuestions,
          questionsPerSection,
          currentSection,
          totalSections
        } = get();

        // Calculate the first question index of the next section
        const nextSectionStartIndex = currentSection * questionsPerSection;

        if (nextSectionStartIndex < examQuestions.length) {
          const nextQuestion = examQuestions[nextSectionStartIndex];
          set({
            sectionReviewMode: false,
            currentQuestionIndex: nextSectionStartIndex,
            currentSection: nextQuestion.section,
            returnedFromSectionReview: false,
            reviewedSection: null
          });

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, nextSectionStartIndex, 2);
        } else {
          // If no more questions, complete the exam
          get().completeExam();
        }
      },

      // Complete exam
      completeExam: () => {
        get().exitSectionReviewMode();
        const { examQuestions, userAnswers, deferredQuestions, timerInterval, resultHistory, examStartTime } = get();

        // Stop timer
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        let correctAnswers = 0;
        let incorrectAnswers = 0;
        let unansweredQuestions = 0;

        const detailedResults = examQuestions.map(question => {
          const userAnswer = userAnswers[question.question_number];
          const isDeferred = deferredQuestions[question.question_number];
          const isAnswered = userAnswer !== undefined;
          const isCorrect = isAnswered && (userAnswer === question.answer);

          if (isCorrect) {
            correctAnswers++;
          } else if (isAnswered) {
            incorrectAnswers++;
          } else {
            unansweredQuestions++;
          }

          return {
            questionId: question.id,
            questionNumber: question.question_number,
            questionType: question.type,
            userAnswer: userAnswer,
            correctAnswer: question.answer,
            isCorrect: isCorrect,
            isDeferred: isDeferred,
            isAnswered: isAnswered
          };
        });

        console.log('Calculated counts:', { correctAnswers, incorrectAnswers, unansweredQuestions });

        const timeTakenInSeconds = examStartTime ? Math.round((new Date() - examStartTime) / 1000) : 0;

        const results = {
          totalQuestions: examQuestions.length,
          correctAnswers,
          incorrectAnswers,
          unansweredQuestions,
          detailedResults,
          timestamp: new Date().toISOString(),
          timeTaken: timeTakenInSeconds,
        };

        set({
          examCompleted: true,
          examResults: results,
          timerActive: false,
          timerInterval: null,
          resultHistory: [...resultHistory, results]
        });

        console.log('Exam completed. Results:', results);

        // Update Smart Exam Progress
        // Save the whole exam as completed, with file/bank context
        const { smartExamProgress, selectedExam } = get();

        if (examQuestions.length > 0) {
          // Identify all unique exams involved in this session
          const uniqueExams = new Map();

          examQuestions.forEach(q => {
            if (q.type && q.exam) {
              const key = `${q.type}|${q.exam}`;
              if (!uniqueExams.has(key)) {
                uniqueExams.set(key, {
                  file: q.type, // bank name
                  exam: q.exam // exam name
                });
              }
            }
          });

          const { smartExamProgress } = get();

          // Create a set of existing progress strings for quick lookup
          const existingProgressStrings = new Set((smartExamProgress || []).map(item => JSON.stringify(item)));

          // Add new unique exams to the set
          uniqueExams.forEach(examObj => {
            existingProgressStrings.add(JSON.stringify(examObj));
          });

          // Convert back to array
          const updatedProgress = Array.from(existingProgressStrings).map(str => JSON.parse(str));

          set({
            smartExamProgress: updatedProgress
          });

          // Save to backend
          get().saveSmartExamProgress(updatedProgress);
        }
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
          viewingHistory: false, // Also reset history view
          pastResultToReview: null, // Also reset past result review
          currentQuestionIndex: 0,
          currentSection: 1,
          sectionReviewMode: false,
          hasSeenSectionReview: false,
          returnedFromSectionReview: false,
          reviewedSection: null,
          hideDeferButton: false,
          sectionReviewFilter: 'all',
          filteredQuestionIndices: [],
          currentFilteredIndex: 0,
          examQuestions: [],
          userAnswers: {},
          deferredQuestions: {},
          markedQuestions: {}, // Reset marked questions
          timerActive: false,
          timeRemaining: 0,
          timerInterval: null,
          reviewMode: false,
          examResults: null,
          selectedCategory: null,
          selectedExam: null,
          totalSections: 1,
          questionsPerSection: 0,
          shouldSkipLastReview: false,
          examMode: 'combined',
          examStartTime: null
        });
      },

      // Enter review mode
      enterReviewMode: (filter = 'all') => {
        set({
          reviewMode: true,
          reviewFilter: filter
        });
      },

      // Set review filter
      setReviewFilter: (filter) => {
        set({ reviewFilter: filter });
      },

      // Get filtered questions for review
      getFilteredQuestions: () => {
        const { examQuestions, userAnswers, deferredQuestions, reviewFilter } = get();

        return examQuestions.filter(question => {
          const isAnswered = userAnswers[question.question_number] !== undefined;
          const isDeferred = deferredQuestions[question.question_number];

          switch (reviewFilter) {
            case 'answered':
              return isAnswered;
            case 'unanswered':
              return !isAnswered;
            case 'deferred':
              return isDeferred;
            default:
              return true;
          }
        });
      },

      // Folder actions
      fetchFolders: async () => {
        try {
          const response = await fetch('Login/folders/get_folders.php', {
            credentials: 'include'
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch folders: ${response.status} ${errorText}`);
          }
          const data = await response.json();
          if (data.success) {
            set({ folders: data.folders || {} });
          } else {
            throw new Error(data.error || 'Failed to process folders');
          }
        } catch (error) {
          console.error('Error fetching folders:', error);
          // Do not reset folders on a failed fetch, just log the error.
        }
      },

      createFolder: async (folderName) => {
        const { folders } = get();
        if (folders[folderName]) {
          console.warn(`Folder "${folderName}" already exists.`);
          // Optionally, show a toast notification to the user
          return;
        }
        try {
          const response = await fetch('Login/folders/create_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
          });
          const data = await response.json();
          if (data.success) {
            set((state) => ({
              folders: {
                ...state.folders,
                [folderName]: data.folder,
              },
            }));
          } else {
            throw new Error(data.error || 'Failed to create folder');
          }
        } catch (error) {
          console.error('Error creating folder:', error);
          // Optionally, show a toast notification
        }
      },

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
            set((state) => ({
              folders: {
                ...state.folders,
                [folderName]: data.data,
              },
            }));
          } else {
            throw new Error(data.error || 'Failed to add question');
          }
        } catch (error) {
          console.error('Error adding question to folder:', error);
        }
      },

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
            set((state) => ({
              folders: {
                ...state.folders,
                [folderName]: data.data,
              },
            }));
          } else {
            throw new Error(data.error || 'Failed to remove question');
          }
        } catch (error) {
          console.error('Error removing question from folder:', error);
        }
      },

      deleteFolder: async (folderName) => {
        const { folders } = get();
        try {
          const response = await fetch('Login/folders/delete_folder.php', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
          });
          const data = await response.json();
          if (data.success) {
            const newFolders = { ...folders };
            delete newFolders[folderName];
            set({ folders: newFolders });
          } else {
            throw new Error(data.error || 'Failed to delete folder');
          }
        } catch (error) {
          console.error('Error deleting folder:', error);
          const newFolders = { ...folders };
          delete newFolders[folderName];
          set({ folders: newFolders });
        }
      },

      startExamFromFolder: (folderName) => {
        const { folders, timerMode, timerDuration, shuffleChoices } = get();
        const folder = folders[folderName];
        if (!folder || folder.questions.length === 0) {
          console.error(`Folder "${folderName}" is empty or not found.`);
          return;
        }

        get().initializeExam({
          questions: folder.questions,
          categoryKey: 'folder',
          examName: folderName,
          timerMode,
          timerDuration,
          shuffleChoices,
          examMode: 'combined', // Or whatever mode is appropriate
        });
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

      // Smart Exam Progress Actions
      fetchSmartExamProgress: async () => {
        try {
          const response = await fetch('Login/exam_progress.php', { credentials: 'include' });
          if (response.ok) {
            const data = await response.json();
            if (data.success && Array.isArray(data.answeredQuestions)) {
              set({ smartExamProgress: data.answeredQuestions });
              console.log('Smart exam progress loaded:', data.answeredQuestions.length);
            }
          }
        } catch (error) {
          console.error('Failed to fetch smart exam progress:', error);
        }
      },

      saveSmartExamProgress: async (progress) => {
        try {
          await fetch('Login/exam_progress.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ answeredQuestions: progress })
          });
          console.log('Smart exam progress saved to server');
        } catch (error) {
          console.error('Failed to save smart exam progress:', error);
        }
      },

      updateSmartExamProgress: (newProgress) => {
        set({ smartExamProgress: newProgress });
        get().saveSmartExamProgress(newProgress);
      },
    }),
    {
      name: 'exam-store',
      storage: createJSONStorage(() => storage),
      partialize: (state) => ({
        timerMode: state.timerMode,
        timerDuration: state.timerDuration,
        shuffleChoices: state.shuffleChoices,
        resultHistory: state.resultHistory,
        // Persist exam state to resume
        examStarted: state.examStarted,
        examCompleted: state.examCompleted,
        viewingHistory: state.viewingHistory,
        currentQuestionIndex: state.currentQuestionIndex,
        currentSection: state.currentSection,
        sectionReviewMode: state.sectionReviewMode,
        hasSeenSectionReview: state.hasSeenSectionReview,
        returnedFromSectionReview: state.returnedFromSectionReview,
        reviewedSection: state.reviewedSection,
        hideDeferButton: state.hideDeferButton,
        examQuestions: state.examQuestions,
        userAnswers: state.userAnswers,
        deferredQuestions: state.deferredQuestions,
        markedQuestions: state.markedQuestions,
        timerActive: state.timerActive,
        timeRemaining: state.timeRemaining,
        reviewMode: state.reviewMode,
        reviewFilter: state.reviewFilter,
        sectionReviewFilter: state.sectionReviewFilter,
        filteredQuestionIndices: state.filteredQuestionIndices,
        currentFilteredIndex: state.currentFilteredIndex,
        examResults: state.examResults,
        pastResultToReview: state.pastResultToReview,
        user: state.user,
        folders: state.folders,
        examStartTime: state.examStartTime,
        selectedCategory: state.selectedCategory,
        selectedExam: state.selectedExam,
        totalSections: state.totalSections,
        questionsPerSection: state.questionsPerSection,
        shouldSkipLastReview: state.shouldSkipLastReview,
        examMode: state.examMode,
        smartExamProgress: state.smartExamProgress
      }),
    }
  )
);