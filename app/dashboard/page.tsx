'use client';

import React, { useState, useEffect } from 'react';
import { StudentDashboard } from '@/components/StudentDashboard';
import { authService, TarqaUser, supabase, isSupabaseConfigured } from '@/lib/supabase';
const navigate = (url: string) => {
  if (typeof window !== 'undefined') {
    window.location.href = url;
  }
};

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<TarqaUser | null>(() => authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
          setCurrentUser(null);
          localStorage.removeItem('tarqa_current_user');
          navigate('/login?redirect=/dashboard');
        } else {
          setCurrentUser(authService.getCurrentUser());
        }
        setIsLoading(false);
      });
    } else {
      const u = authService.getCurrentUser();
      if (!u) {
        navigate('/login?redirect=/dashboard');
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

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-cairo">
      <StudentDashboard
        currentUser={currentUser}
        onStartMock={() => {
          if (typeof window !== 'undefined') window.location.href = '/';
        }}
        onStartPractice={() => {
          if (typeof window !== 'undefined') window.location.href = '/';
        }}
      />
    </div>
  );
}
