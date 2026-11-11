import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { get, set, del } from 'idb-keyval';
import dataLoader from '../utils/dataLoader';
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
      // Exam configuration with user settings persistence
      timerMode: 'none', // 'none', 'total', 'section'
      timerDuration: 24, // minutes
      shuffleChoices: false,

      // New configuration for category and exam selection
      selectedCategory: null, // category key
      selectedExam: null, // exam name

      // Exam state
      examStarted: false,
      examCompleted: false,
      currentQuestionIndex: 0,
      currentSection: 1, // Start from 1 instead of 0
      sectionReviewMode: false, // New: for section review
      hasSeenSectionReview: false, // Track if user has seen section review page
      returnedFromSectionReview: false, // Track if user returned from section review
      reviewedSection: null, // Track which section was reviewed

      // Smart Exam Progress
      smartExamProgress: [], // Array of answered question IDs stringified

      // User authentication
      user: null,
      setUser: (user) => {
        set({ user });
        if (user) {
          get().fetchFolders();
          get().fetchSmartExamProgress();
        } else {
          // Clear folders and progress on logout
          set({ folders: {}, smartExamProgress: [] });
        }
      },

      // UI State
      nightMode: false, // Night mode for QuestionDisplay
      toggleNightMode: () => set((state) => ({ nightMode: !state.nightMode })),
      viewingHistory: false,
      viewingQuestionsManager: false,
      pastResultToReview: null,
      showHistory: () => set({ viewingHistory: true }),
      hideHistory: () => set({ viewingHistory: false, pastResultToReview: null }),
      reviewPastResult: (result) => set({
        examCompleted: false,
        viewingHistory: false,
        pastResultToReview: result
      }),
      finishReviewingPastResult: () => set({ pastResultToReview: null, viewingHistory: true }),

      // Folders (Mock Implementation)
      // Folders Implementation
      folders: {},

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
          examMode: 'combined',
        });
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



      // Questions and answers
      examQuestions: [],
      userAnswers: {}, // questionNumber -> choiceIndex
      markedQuestions: {}, // questionNumber -> boolean
      visitedQuestions: {}, // questionNumber -> boolean

      // Timer
      timerActive: false,
      timeRemaining: 0,
      timerInterval: null,
      startTime: null,

      // Review mode
      reviewMode: false,
      reviewFilter: 'all', // 'all', 'answered', 'unanswered'
      highestVisitedQuestionIndex: {}, // { [section]: index }

      // Section review filter
      sectionReviewFilter: 'all', // 'all', 'marked', 'incomplete'
      filteredQuestionIndices: [],
      currentFilteredIndex: 0,

      // Results
      examResults: null,
      resultHistory: [],
      fontSize: 20,
      userId: '',
      userEmail: '',

      setFontSize: (size) => set({ fontSize: size }),

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
        try {
          console.log('Initializing exam with config:', config);

          const examConfig = {
            shuffleChoices: config.shuffleChoices || false,
            categoryKey: config.categoryKey || (config.categoryKeys ? 'multiple' : null),
            // Use 'اختبار مجمع' if multiple keys/names are provided, otherwise use provided name or default
            examName: (config.categoryKeys || config.examNames) ? 'اختبار مجمع' : (config.examName || null),
            examMode: config.examMode || 'sectioned' // 'sectioned' or 'combined'
          };

          // Generate exam questions or use provided ones
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
            console.log('Using provided questions:', config.questions.length);
            generatedQuestions = config.questions;
          } else {
            // Generate exam questions using the generateExam function from dataLoader
            const result = await dataLoader.generateExam(examConfig);
            generatedQuestions = result.questions;
            console.log('Generated exam questions:', generatedQuestions.length);
          }

          if (!generatedQuestions || generatedQuestions.length === 0) {
            throw new Error('Failed to generate exam questions');
          }

          let processedQuestions = generatedQuestions;

          // Re-number questions sequentially
          processedQuestions = processedQuestions.map((question, index) => ({
            ...question,
            question_number: index + 1,
            original_question_number: question.question_number, // Keep original for reference
          }));

          // Handle sectioned mode with review pages every 24 questions
          if (examConfig.examMode === 'sectioned') {
            const questionsPerSection = 24;
            let totalSections = 0;

            processedQuestions = processedQuestions.map((question, index) => {
              const sectionNumber = Math.floor(index / questionsPerSection) + 1;
              totalSections = Math.max(totalSections, sectionNumber);

              return {
                ...question,
                section: sectionNumber,
              };
            });

            // Calculate if we should skip the last review
            // Skip if the last section has fewer than 24 questions
            const lastSectionQuestionCount = processedQuestions.length % questionsPerSection;
            const shouldSkipLastReview = lastSectionQuestionCount > 0 && lastSectionQuestionCount < questionsPerSection;

            console.log(`Exam divided into ${totalSections} sections of ${questionsPerSection} questions each`);
            console.log(`Last section has ${lastSectionQuestionCount || questionsPerSection} questions`);
            console.log(`Should skip last review: ${shouldSkipLastReview}`);

            // Store section info for later use
            set({
              totalSections,
              questionsPerSection,
              shouldSkipLastReview,
              examMode: 'sectioned'
            });
          } else {
            // For combined mode, all questions are in one section
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
          // 1. Separate into High-Priority (Section 1) & Background (remaining questions)
          const section1Questions = processedQuestions.filter(q => q.section === 1);
          const initialImageUrls = extractImageUrls(section1Questions.length > 0 ? section1Questions : processedQuestions.slice(0, 24));
          
          const remainingQuestions = processedQuestions.filter(q => (q.section || 1) > 1);
          const remainingImageUrls = extractImageUrls(remainingQuestions.length > 0 ? remainingQuestions : processedQuestions.slice(24));

          // 2. High-priority preloading for Section 1 with safety timeout (max 2000ms)
          if (initialImageUrls.length > 0) {
            try {
              await preloadInitialBatch(initialImageUrls, 2000);
            } catch (err) {
              console.warn('Initial image preloading finished with warning (safe fallback):', err);
            }
          }

          // 3. Non-blocking background batch for remaining pool
          if (remainingImageUrls.length > 0) {
            preloadBackgroundBatch(remainingImageUrls, 3, 100);
          }

          // Set up timer
          const timerDuration = config.timerMode === 'none' ? 0 : (config.timerDuration || 24) * 60;

          // Clear any existing timer
          const { timerInterval } = get();
          if (timerInterval) {
            clearInterval(timerInterval);
          }

          // Determine User ID and Email
          let userId, userEmail, userObj;
          if (config.user) {
            userId = config.user.id || config.user.telegram_id || Math.floor(1000000000 + Math.random() * 9000000000).toString();
            userEmail = config.user.username ? `${config.user.username}@telegram` : `user_${userId}@telegram`;
            userObj = config.user;
          } else if (get().user) {
            const currentUser = get().user;
            userObj = currentUser;
            userId = currentUser.id || currentUser.telegram_id || get().userId;
            userEmail = currentUser.username ? `${currentUser.username}@telegram` : get().userEmail;
          } else {
            // Fallback if no user
            userId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
            userEmail = `user${Math.floor(1000 + Math.random() * 9000)}@example.com`;
            userObj = null;
          }

          const firstQuestionNumber = processedQuestions[0]?.question_number;

          set({
            timerMode: config.timerMode || 'none',
            timerDuration: config.timerDuration || 24,
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
            userAnswers: {},
            markedQuestions: {},
            visitedQuestions: firstQuestionNumber ? { [firstQuestionNumber]: true } : {},
            timerActive: config.timerMode !== 'none',
            timeRemaining: timerDuration,
            reviewMode: false,
            examResults: null,
            timerInterval: null,
            userId: userId,
            userEmail: userEmail,
            user: userObj, // Store full user object
            highestVisitedQuestionIndex: { 1: 0 },
            startTime: Date.now(),
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
            hasSeenSectionReview: false,
            returnedFromSectionReview: false,
            reviewedSection: null,
            examQuestions: [],
            userAnswers: {},
            markedQuestions: {},
            visitedQuestions: {},
            timerActive: false,
            timeRemaining: 0,
            timerInterval: null,
            startTime: null,
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
        const { examQuestions, userAnswers, correctAnswers, incorrectAnswers } = get();

        if (!examQuestions || examQuestions.length === 0) {
          return {
            total: 0,
            answered: 0,
            unanswered: 0,
            correct: 0,
            incorrect: 0,
            percentage: 0
          };
        }

        let answered = 0;

        examQuestions.forEach(question => {
          if (userAnswers[question.question_number] !== undefined) {
            answered++;
          }
        });

        const correct = correctAnswers.length;
        const incorrect = incorrectAnswers.length;
        const percentage = answered > 0 ? Math.round((correct / answered) * 100) : 0;

        return {
          total: examQuestions.length,
          answered,
          unanswered: examQuestions.length - answered,
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
          },
        });
      },

      toggleMarked: (questionNumber) => {
        const { markedQuestions } = get();
        const newMarkedQuestions = { ...markedQuestions };

        if (newMarkedQuestions[questionNumber]) {
          delete newMarkedQuestions[questionNumber];
        } else {
          newMarkedQuestions[questionNumber] = true;
        }

        set({ markedQuestions: newMarkedQuestions });
      },

      endSection: () => {
        const { currentSection, totalSections, completeExam, goToSection } = get();
        if (currentSection < totalSections) {
          goToSection(currentSection + 1);
        } else {
          completeExam();
        }
      },

      goToSection: (sectionNumber) => {
        const { examQuestions, questionsPerSection } = get();
        const newIndex = (sectionNumber - 1) * questionsPerSection;
        if (newIndex >= 0 && newIndex < examQuestions.length) {
          const question = examQuestions[newIndex];
          const questionNumber = question.question_number;

          // Preload upcoming questions in the new section
          preloadSlidingWindow(examQuestions, newIndex, 2);

          set(state => ({
            currentQuestionIndex: newIndex,
            currentSection: sectionNumber,
            visitedQuestions: { ...state.visitedQuestions, [questionNumber]: true }
          }));
        }
      },

      // Navigation
      nextQuestion: () => {
        const {
          currentQuestionIndex,
          examQuestions,
          userAnswers,
          sectionReviewFilter,
          filteredQuestionIndices,
          currentFilteredIndex
        } = get();

        if (sectionReviewFilter !== 'all') {
          const nextFilteredIndex = currentFilteredIndex + 1;
          if (nextFilteredIndex < filteredQuestionIndices.length) {
            const nextQuestionIndex = filteredQuestionIndices[nextFilteredIndex];
            const nextQuestionNumber = examQuestions[nextQuestionIndex].question_number;
            set(state => ({
              currentFilteredIndex: nextFilteredIndex,
              currentQuestionIndex: nextQuestionIndex,
              visitedQuestions: { ...state.visitedQuestions, [nextQuestionNumber]: true }
            }));
          } else {
            // End of filtered review, go back to section review screen
            get().exitSectionReviewMode();
            set({
              sectionReviewMode: true,
              reviewedSection: get().currentSection,
            });
          }
          return;
        }

        const nextIndex = currentQuestionIndex + 1;

        if (nextIndex < examQuestions.length) {
          const nextQuestion = examQuestions[nextIndex];
          const nextSection = nextQuestion.section;

          // 🚀 Sliding Window: Preload upcoming questions (N+1, N+2) in cache
          preloadSlidingWindow(examQuestions, nextIndex, 2);

          const nextQuestionNumber = nextQuestion.question_number;
          set(state => ({
            currentQuestionIndex: nextIndex,
            currentSection: nextSection,
            sectionReviewMode: false,
            visitedQuestions: { ...state.visitedQuestions, [nextQuestionNumber]: true },
            highestVisitedQuestionIndex: {
              ...state.highestVisitedQuestionIndex,
              [nextSection]: Math.max(state.highestVisitedQuestionIndex[nextSection] || 0, nextIndex),
            }
          }));
        } else {
          // End of exam
          get().completeExam();
        }
      },

      previousQuestion: () => {
        const {
          currentQuestionIndex,
          examQuestions,
          userAnswers,
          sectionReviewFilter,
          filteredQuestionIndices,
          currentFilteredIndex
        } = get();

        if (sectionReviewFilter !== 'all') {
          const prevFilteredIndex = currentFilteredIndex - 1;
          if (prevFilteredIndex >= 0) {
            const prevQuestionIndex = filteredQuestionIndices[prevFilteredIndex];
            const prevQuestionNumber = examQuestions[prevQuestionIndex].question_number;
            set(state => ({
              currentFilteredIndex: prevFilteredIndex,
              currentQuestionIndex: prevQuestionIndex,
              visitedQuestions: { ...state.visitedQuestions, [prevQuestionNumber]: true }
            }));
          }
          return;
        }

        const prevIndex = currentQuestionIndex - 1;

        if (prevIndex >= 0) {
          const prevQuestion = examQuestions[prevIndex];
          const prevSection = prevQuestion.section;
          const prevQuestionNumber = prevQuestion.question_number;

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, prevIndex, 2);

          set(state => ({
            currentQuestionIndex: prevIndex,
            currentSection: prevSection,
            visitedQuestions: { ...state.visitedQuestions, [prevQuestionNumber]: true }
          }));
        }
      },

      // Jump to specific question
      goToQuestion: (questionIndex) => {
        const { examQuestions } = get();

        if (questionIndex >= 0 && questionIndex < examQuestions.length) {
          const question = examQuestions[questionIndex];
          const questionNumber = question.question_number;

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, questionIndex, 2);

          set(state => ({
            currentQuestionIndex: questionIndex,
            currentSection: question.section,
            reviewMode: false,
            sectionReviewMode: false,
            visitedQuestions: { ...state.visitedQuestions, [questionNumber]: true },
            highestVisitedQuestionIndex: {
              ...state.highestVisitedQuestionIndex,
              [question.section]: Math.max(state.highestVisitedQuestionIndex[question.section] || 0, questionIndex),
            }
          }));
        }
      },

      // Exit review mode
      exitReviewMode: () => {
        set({ reviewMode: false });
      },

      // Section review functions
      enterSectionReviewMode: (filter) => {
        const { examQuestions, currentSection, userAnswers } = get();
        const sectionQuestions = examQuestions.filter(q => q.section === currentSection);

        let filteredQuestions;
        if (filter === 'incomplete') {
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

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, nextSectionStartIndex, 2);

          set({
            sectionReviewMode: false,
            currentQuestionIndex: nextSectionStartIndex,
            currentSection: nextQuestion.section,
            returnedFromSectionReview: true,
            reviewedSection: null
          });
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

          // Preload upcoming questions (sliding window)
          preloadSlidingWindow(examQuestions, nextSectionStartIndex, 2);

          set({
            sectionReviewMode: false,
            currentQuestionIndex: nextSectionStartIndex,
            currentSection: nextQuestion.section,
            returnedFromSectionReview: false,
            reviewedSection: null
          });
        } else {
          // If no more questions, complete the exam
          get().completeExam();
        }
      },

      // Complete exam
      completeExam: () => {
        get().exitSectionReviewMode();
        const { examQuestions, userAnswers, timerInterval, resultHistory, timerMode, timerDuration, timeRemaining, startTime } = get();

        // Stop timer
        if (timerInterval) {
          clearInterval(timerInterval);
        }

        let correctAnswers = 0;
        let incorrectAnswers = 0;
        let unansweredQuestions = 0;

        const detailedResults = examQuestions.map(question => {
          const userAnswer = userAnswers[question.question_number];
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
            isAnswered: isAnswered
          };
        });

        let timeTaken;
        if (timerMode !== 'none') {
          timeTaken = (timerDuration * 60) - timeRemaining;
        } else if (startTime) {
          timeTaken = Math.round((Date.now() - startTime) / 1000);
        } else {
          timeTaken = 0;
        }

        const results = {
          totalQuestions: examQuestions.length,
          correctAnswers,
          incorrectAnswers,
          unansweredQuestions,
          detailedResults,
          timeTaken,
          timestamp: new Date().toISOString()
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

        if (selectedExam && examQuestions.length > 0) {
          const currentBank = examQuestions[0].type || 'unknown'; // 'type' holds the bank name (e.g., bank1)

          const newProgressItem = {
            file: currentBank,
            exam: selectedExam
          };

          // Use stringified objects for uniqueness comparison
          const existingProgressStrings = new Set((smartExamProgress || []).map(item => JSON.stringify(item)));
          existingProgressStrings.add(JSON.stringify(newProgressItem));

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
          viewingHistory: false,
          pastResultToReview: null,
          currentQuestionIndex: 0,
          currentSection: 1,
          sectionReviewMode: false,
          hasSeenSectionReview: false,
          returnedFromSectionReview: false,
          reviewedSection: null,
          sectionReviewFilter: 'all',
          filteredQuestionIndices: [],
          currentFilteredIndex: 0,
          examQuestions: [],
          userAnswers: {},
          markedQuestions: {},
          visitedQuestions: {},
          timerActive: false,
          timeRemaining: 0,
          timerInterval: null,
          startTime: null,
          reviewMode: false,
          examResults: null,
          selectedCategory: null,
          selectedExam: null,
          totalSections: 1,
          questionsPerSection: 0,
          shouldSkipLastReview: false,
          examMode: 'combined'
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
        const { examQuestions, userAnswers, reviewFilter } = get();

        return examQuestions.filter(question => {
          const isAnswered = userAnswers[question.question_number] !== undefined;

          switch (reviewFilter) {
            case 'answered':
              return isAnswered;
            case 'unanswered':
              return !isAnswered;
            default:
              return true;
          }
        });
      }
    }),
    {
      name: 'exam-store',
      storage: storage,
      partialize: (state) => ({
        timerMode: state.timerMode,
        timerDuration: state.timerDuration,
        shuffleChoices: state.shuffleChoices,
        resultHistory: state.resultHistory,
        // Persist active exam state
        selectedCategory: state.selectedCategory,
        selectedExam: state.selectedExam,
        examStarted: state.examStarted,
        examCompleted: state.examCompleted,
        currentQuestionIndex: state.currentQuestionIndex,
        currentSection: state.currentSection,
        sectionReviewMode: state.sectionReviewMode,
        hasSeenSectionReview: state.hasSeenSectionReview,
        returnedFromSectionReview: state.returnedFromSectionReview,
        reviewedSection: state.reviewedSection,
        user: state.user,
        userId: state.userId,
        userEmail: state.userEmail,
        viewingHistory: state.viewingHistory,
        pastResultToReview: state.pastResultToReview,
        folders: state.folders, // Persist folders
        examQuestions: state.examQuestions,
        userAnswers: state.userAnswers,
        markedQuestions: state.markedQuestions,
        visitedQuestions: state.visitedQuestions,
        timerActive: state.timerActive,
        timeRemaining: state.timeRemaining,
        startTime: state.startTime,
        reviewMode: state.reviewMode,
        reviewFilter: state.reviewFilter,
        highestVisitedQuestionIndex: state.highestVisitedQuestionIndex,
        sectionReviewFilter: state.sectionReviewFilter,
        smartExamProgress: state.smartExamProgress
      })
    }
  )
);