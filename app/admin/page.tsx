'use client';

import React, { useState, useEffect } from 'react';
import { AdminPanel } from '@/components/AdminPanel';
import { mockCategories, mockQuestions } from '@/data/mockQuestions';
import { Question } from '@/types';
import { authService, supabase, isSupabaseConfigured } from '@/lib/supabase';
const navigate = (url: string) => {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};

export default function AdminPage() {
  const [questions, setQuestions] = useState<Question[]>(mockQuestions);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (!user) {
          navigate('/login?redirect=/admin');
          return;
        }

        const isOwner = user.email?.trim().toLowerCase() === 'yassooooo27m@gmail.com';
        const rawRole = (user.app_metadata?.role as string) || (user.user_metadata?.role as string) || 'student';
        const role = (isOwner || rawRole === 'super_admin') ? 'admin' : rawRole;

        if (role !== 'admin' && role !== 'teacher') {
          navigate('/unauthorized?required=admin');
          return;
        }

        setIsAuthorized(true);
        setIsLoading(false);
      });
    } else {
      const u = authService.getCurrentUser();
      if (!u || (u.role !== 'admin' && u.role !== 'teacher')) {
        navigate('/login?redirect=/admin');
      } else {
        setIsAuthorized(true);
      }
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070b14]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-cairo">
      <AdminPanel
        questions={questions}
        categories={mockCategories}
        onAddQuestion={(newQ) => setQuestions((prev) => [newQ, ...prev])}
        onUpdateQuestion={(updated) =>
          setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
        }
        onDeleteQuestion={(id) =>
          setQuestions((prev) => prev.filter((q) => q.id !== id))
        }
      />
    </div>
  );
}
