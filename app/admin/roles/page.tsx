'use client';

import React, { useState, useEffect } from 'react';
import { SuperAdminRolesPanel } from '@/components/SuperAdminRolesPanel';
import { authService, TarqaUser, supabase, isSupabaseConfigured } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Crown } from 'lucide-react';

export default function AdminRolesPage() {
  const [currentUser, setCurrentUser] = useState<TarqaUser | null>(() => {
    return authService.getCurrentUser();
  });

  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          const email = session.user.email?.trim().toLowerCase() || '';
          const isYassien = email === 'yassooooo27m@gmail.com';
          const rawRole = (session.user.app_metadata?.role as any) || (session.user.user_metadata?.role as any) || 'student';
          const role = (isYassien || rawRole === 'super_admin') ? 'admin' : rawRole;

          if (role !== 'admin') {
            if (typeof window !== 'undefined') window.location.href = '/unauthorized?required=admin';
            return;
          }

          const user: TarqaUser = {
            id: session.user.id,
            email: session.user.email || email,
            fullName: isYassien ? 'Yassien Ahmed' : (session.user.user_metadata?.full_name || 'مسؤول المنصة'),
            targetScore: Number(session.user.user_metadata?.target_score) || 100,
            role,
            telegramUsername: session.user.user_metadata?.telegram_username,
            avatarUrl: session.user.user_metadata?.avatar_url,
          };
          localStorage.setItem('tarqa_current_user', JSON.stringify(user));
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
          localStorage.removeItem('tarqa_current_user');
          if (typeof window !== 'undefined') window.location.href = '/login?redirect=/admin/roles';
        }
      });
    } else {
      const u = authService.getCurrentUser();
      if (!u || u.role !== 'admin') {
        if (typeof window !== 'undefined') window.location.href = '/login?redirect=/admin/roles';
      }
    }

    const handleUserChanged = () => {
      setCurrentUser(authService.getCurrentUser());
    };
    window.addEventListener('tarqa_user_changed', handleUserChanged);
    return () => window.removeEventListener('tarqa_user_changed', handleUserChanged);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 font-cairo">
      {/* شريط التنقل العلوي السريع */}
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#070b14]/70 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link
              href="/"
              className="hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1"
            >
              <span>الرئيسية</span>
            </Link>
            <span>/</span>
            <Link
              href="/admin"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              لوحة الإدارة
            </Link>
            <span>/</span>
            <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
              <span>إدارة الرتب (Admin)</span>
            </span>
          </div>

          <Link
            href="/admin"
            className="text-xs font-bold text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 transition-colors"
          >
            <span>العودة للوحة الإدارة</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </Link>
        </div>
      </div>

      <SuperAdminRolesPanel currentUser={currentUser} />
    </div>
  );
}
