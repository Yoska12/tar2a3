'use client';

import React, { Suspense } from 'react';
import { ShieldAlert, ArrowRight, Home, LayoutDashboard, Lock } from 'lucide-react';

function UnauthorizedContent() {
  const searchParams = typeof window !== 'undefined' 
    ? new URLSearchParams(window.location.search) 
    : new URLSearchParams();
  const requiredRole = searchParams.get('required') || 'admin';
  const currentRole = searchParams.get('current') || 'student';

  const roleLabels: Record<string, string> = {
    admin: 'مشرف عام (Admin)',
    teacher: 'معلم / صانع محتوى (Teacher)',
    student: 'طالب (Student)',
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4 font-sans dir-rtl" dir="rtl">
      <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
        {/* خلفية جمالية */}
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-48 h-48 bg-rose-500/10 blur-3xl rounded-full pointer-events-none" />
        
        {/* أيقونة القفل والتنبيه */}
        <div className="relative mx-auto w-20 h-20 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-6 shadow-lg shadow-rose-950/50">
          <Lock className="w-10 h-10" />
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs font-bold">
            !
          </div>
        </div>

        {/* العناوين */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>خطأ 403: وصول غير مصرح</span>
        </div>

        <h1 className="text-2xl font-black text-neutral-50 mb-2">
          عفواً، لا تملك الصلاحية الكافية!
        </h1>
        
        <p className="text-neutral-400 text-sm leading-relaxed mb-6">
          الصفحة أو العملية التي تحاول الوصول إليها تتطلب امتيازات خاصة ومخصصة لإدارة منصة طرقع.
        </p>

        {/* بطاقة تفاصيل الصلاحيات */}
        <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-2xl p-4 text-xs text-right space-y-2 mb-8">
          <div className="flex items-center justify-between text-neutral-400">
            <span>الصلاحية المطلوبة:</span>
            <span className="font-bold text-amber-400">
              {roleLabels[requiredRole] || requiredRole}
            </span>
          </div>
          <div className="flex items-center justify-between text-neutral-400 pt-1 border-t border-neutral-800">
            <span>دور حسابك الحالي:</span>
            <span className="font-bold text-neutral-300">
              {roleLabels[currentRole] || currentRole}
            </span>
          </div>
        </div>

        {/* أزرار التوجيه */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="/dashboard"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 active:scale-95"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>لوحة الطالب</span>
          </a>

          <a
            href="/"
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm transition-all active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية</span>
          </a>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-800/80 text-center">
          <p className="text-[11px] text-neutral-500">
            إذا كنت تعتقد أن هذا خطأ بصلاحيات حسابك، يرجى التواصل مع إدارة منصة طرقع.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400">جاري التحميل...</div>}>
      <UnauthorizedContent />
    </Suspense>
  );
}
