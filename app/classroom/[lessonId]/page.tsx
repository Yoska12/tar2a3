'use client';

import React, { useState } from 'react';
import { ClassroomView } from '@/components/ClassroomView';
import { mockFoundationModules } from '@/data/foundationModules';
import { CourseModule, Lesson } from '@/types';
const navigate = (url: string) => {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};

interface ClassroomPageProps {
  params: {
    lessonId: string;
  };
}

export default function ClassroomPage({ params }: ClassroomPageProps) {
  const [modules, setModules] = useState<CourseModule[]>(mockFoundationModules);

  // البحث عن الدرس والباب المطابق
  let foundModule = modules[0];
  let foundLesson = modules[0].lessons[0];

  for (const m of modules) {
    const l = m.lessons.find((item) => item.id === params.lessonId);
    if (l) {
      foundModule = m;
      foundLesson = l;
      break;
    }
  }

  const [currentModule, setCurrentModule] = useState<CourseModule>(foundModule);
  const [currentLesson, setCurrentLesson] = useState<Lesson>(foundLesson);

  const handleSelectLesson = (lesson: Lesson) => {
    setCurrentLesson(lesson);
    navigate(`/classroom/${lesson.id}`);
  };

  const handleCompleteLesson = (lessonId: string) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) =>
          l.id === lessonId ? { ...l, isCompleted: true } : l
        ),
      }))
    );
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-[#070b14]">
      <ClassroomView
        currentModule={currentModule}
        currentLesson={currentLesson}
        onSelectLesson={handleSelectLesson}
        onCompleteLesson={handleCompleteLesson}
        onBackToRoadmap={() => navigate('/')}
        onStartQuiz={() => navigate('/quiz')}
      />
    </main>
  );
}
