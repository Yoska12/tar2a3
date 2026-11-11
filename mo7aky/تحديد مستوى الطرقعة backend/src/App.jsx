import QuestionManager from './components/QuestionManager';
import React, { useState, useEffect } from 'react';
import { useExamStore } from './store/examStore';
import { initializeQuestionData } from './utils/dataLoader';

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
  const { 
    examStarted, 
    examCompleted, 
    sectionReviewMode,
    examResults,
    fontSize,
    historyVisible,
    hideHistory,
    initializeExam,
    pastResultToReview
  } = useExamStore();
  
  useEffect(() => {
    // Non-blocking background initialization
    const loadInitialData = async () => {
      try {
        await initializeQuestionData();
      } catch (err) {
        console.warn("Question data will load on demand:", err);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    document.body.style.fontSize = `${fontSize || 16}px`;
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
          if (historyVisible) {
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
            if (sectionReviewMode) {
              return <SectionReview />;
            }
            return <QuestionDisplay />;
          }
          // Default screen if no exam has started
          return <StartScreen />;
        })()}
      </div>
    </>
  );
}

export default App;