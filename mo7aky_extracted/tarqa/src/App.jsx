import QuestionManager from './components/QuestionManager';
import React, { useState, useEffect } from 'react';
import { useExamStore } from './store/examStore';
import dataLoader from './utils/dataLoader';

// Import components
import StartScreen from './components/StartScreen';
import QuestionDisplay from './components/QuestionDisplay';
import SectionReview from './components/SectionReview';
import ResultsScreen from './components/ResultsScreen';
import ResultsHistory from './components/ResultsHistory';
import Background from './components/Background';
import { Toaster } from './components/ui/sonner';
import './App.css';

function App() {
  const store = useExamStore();
  const { 
    examStarted, 
    examCompleted, 
    sectionReviewMode,
    examResults,
    fontSize,
    viewingHistory,
    viewingQuestionsManager,
    showQuestionsManager,
    hideQuestionsManager,
    hideHistory,
    initializeExam,
    pastResultToReview
  } = store;

  // Listen to ?questions=true or hash #questions to open QuestionManager
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const checkQuestionManager = () => {
        const urlParams = new URLSearchParams(window.location.search);
        const hash = (window.location.hash || '').toLowerCase();
        if (
          urlParams.get('questions') === 'true' ||
          urlParams.get('manage_questions') === '1' ||
          urlParams.get('admin') === 'questions' ||
          (urlParams.get('admin') === 'true' && urlParams.get('edit') === 'true') ||
          hash === '#questions' ||
          hash === '#manage-questions' ||
          hash === '#admin-questions'
        ) {
          if (typeof showQuestionsManager === 'function') {
            showQuestionsManager();
          }
        }
      };
      checkQuestionManager();
      window.addEventListener('hashchange', checkQuestionManager);
      return () => window.removeEventListener('hashchange', checkQuestionManager);
    }
  }, [showQuestionsManager]);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        await dataLoader.initializeQuestionData();
      } catch (err) {
        console.warn("Question data will load on demand:", err);
      }
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    if (document && document.body) {
      document.body.style.fontSize = `${fontSize || 16}px`;
    }
  }, [fontSize]);

  return (
    <>
      <Background />
      <Toaster />
      <div className="App">
        {(() => {
          if (pastResultToReview) {
            return <ResultsScreen pastResult={pastResultToReview} />;
          }
          if (viewingQuestionsManager) {
            return <QuestionManager onBack={hideQuestionsManager} />;
          }
          if (viewingHistory) {
            return <ResultsHistory onStartMistakesExam={(questions) => {
              const examConfig = {
                questions: questions,
                examName: 'مراجعة الأخطاء',
                timerMode: 'none',
                examMode: 'sectioned'
              };
              initializeExam(examConfig);
              hideHistory();
            }} />;
          }
          if (examCompleted && examResults) {
            return <ResultsScreen />;
          }
          if (examStarted) {
            if (sectionReviewMode) return <SectionReview />;
            return <QuestionDisplay />;
          }
          return <StartScreen />;
        })()}
      </div>
    </>
  );
}

export default App;
