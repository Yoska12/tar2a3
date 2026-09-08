'use client';

import React, { useState } from 'react';
import { LecturesCMS } from '@/components/LecturesCMS';
import { mockFoundationModules } from '@/data/foundationModules';
import { CourseModule, Lesson } from '@/types';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function AdminLecturesPage() {
  const [modules, setModules] = useState<CourseModule[]>(mockFoundationModules);

  const handleAddLesson = (moduleId: string, newLesson: Lesson) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id === moduleId) {
          return {
            ...mod,
            lessons: [...mod.lessons, newLesson],
          };
        }
        return mod;
      })
    );
  };

  const handleUpdateLesson = (updatedLesson: Lesson) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) => (l.id === updatedLesson.id ? updatedLesson : l)),
      }))
    );
  };

  const handleDeleteLesson = (lessonId: string) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.filter((l) => l.id !== lessonId),
      }))
    );
  };

  const handleTogglePublish = (lessonId: string) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) =>
          l.id === lessonId ? { ...l, isPublished: !l.isPublished } : l
        ),
      }))
    );
  };

  const handleReorderLessons = (
    moduleId: string,
    lessonId: string,
    direction: 'up' | 'down'
  ) => {
    setModules((prev) =>
      prev.map((mod) => {
        if (mod.id !== moduleId) return mod;
        const index = mod.lessons.findIndex((l) => l.id === lessonId);
        if (index === -1) return mod;
        if (direction === 'up' && index === 0) return mod;
        if (direction === 'down' && index === mod.lessons.length - 1) return mod;

        const newLessons = [...mod.lessons];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const temp = newLessons[index];
        newLessons[index] = newLessons[targetIndex];
        newLessons[targetIndex] = temp;

        return { ...mod, lessons: newLessons };
      })
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-cairo p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-amber-500 transition"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للوحة الإدارة العامة</span>
          </Link>
        </div>

        <LecturesCMS
          modules={modules}
          onAddLesson={handleAddLesson}
          onUpdateLesson={handleUpdateLesson}
          onDeleteLesson={handleDeleteLesson}
          onTogglePublish={handleTogglePublish}
          onReorderLessons={handleReorderLessons}
        />
      </div>
    </div>
  );
}
