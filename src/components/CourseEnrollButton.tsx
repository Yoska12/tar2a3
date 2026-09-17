import React from 'react';
import { Clock, Lock, Sparkles, CheckCircle2, PauseCircle, Calendar, AlertCircle } from 'lucide-react';
import { CourseEnrollmentStatus } from '../types';
import { getCourseEnrollmentInfo } from '../lib/subscriptionService';

interface CourseEnrollEnrollButtonProps {
  status?: CourseEnrollmentStatus;
  availableDate?: string;
  customStatusText?: string;
  isSubscribed?: boolean;
  isManager?: boolean;
  priceSAR?: number;
  onEnrollClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CourseEnrollButton: React.FC<CourseEnrollEnrollButtonProps> = ({
  status = 'active',
  availableDate,
  customStatusText,
  isSubscribed = false,
  isManager = false,
  priceSAR = 75,
  onEnrollClick,
  className = '',
  size = 'md',
}) => {
  const enrollmentInfo = getCourseEnrollmentInfo({
    status,
    availableDate,
    customStatusText,
  });

  const sizeClasses = {
    sm: 'py-2 px-3.5 text-xs',
    md: 'py-3 px-5 text-xs sm:text-sm',
    lg: 'py-3.5 px-6 text-sm sm:text-base',
  }[size];

  // إذا كان المستخدم مديراً أو مشرفاً
  if (isManager) {
    return (
      <div className={`w-full rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-600 dark:text-purple-300 font-bold flex items-center justify-center gap-2 ${sizeClasses} ${className}`}>
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span>وصول إداري غير محدود</span>
      </div>
    );
  }

  // إذا كان المستخدم مشتركاً بالفعل
  if (isSubscribed) {
    return (
      <div className={`w-full rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-black flex items-center justify-center gap-2 ${sizeClasses} ${className}`}>
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span>أنت مشترك بالفعل ومفعّل ✅</span>
      </div>
    );
  }

  // إذا كانت الدورة موقوفة مؤقتاً (Paused)
  if (status === 'paused') {
    return (
      <div className="w-full space-y-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={enrollmentInfo.notice || 'التسجيل مغلق مؤقتاً'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`w-full rounded-2xl font-black transition-all flex items-center justify-center gap-2 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 cursor-not-allowed opacity-90 select-none shadow-inner ${sizeClasses} ${className}`}
        >
          <Clock className="w-4 h-4 animate-pulse text-amber-500 shrink-0" />
          <span>{enrollmentInfo.buttonText || 'قريباً ⏳'}</span>
        </button>

        {availableDate && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/5 py-1 px-3 rounded-xl border border-amber-500/20 text-center">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>يُعاد فتح التسجيل: {availableDate}</span>
          </div>
        )}
      </div>
    );
  }

  // إذا كانت الدورة قادمة قريباً (Upcoming)
  if (status === 'upcoming') {
    return (
      <div className="w-full space-y-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={enrollmentInfo.notice || 'الدورة قادمة قريباً'}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className={`w-full rounded-2xl font-black transition-all flex items-center justify-center gap-2 border bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 cursor-not-allowed opacity-90 select-none shadow-inner ${sizeClasses} ${className}`}
        >
          <Clock className="w-4 h-4 animate-pulse text-blue-500 shrink-0" />
          <span>{enrollmentInfo.buttonText || 'قريباً ⏳'}</span>
        </button>

        {availableDate && (
          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/5 py-1 px-3 rounded-xl border border-blue-500/20 text-center">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>تاريخ الانطلاق: {availableDate}</span>
          </div>
        )}
      </div>
    );
  }

  // زر الحالة المعطلة: متاح قريباً
  return (
    <button
      type="button"
      disabled
      className={`w-full rounded-2xl font-black transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/25 cursor-not-allowed select-none opacity-95 ${sizeClasses} ${className}`}
    >
      <Clock className="w-4 h-4 animate-pulse shrink-0 text-slate-950" />
      <span>قريباً ⏳</span>
    </button>
  );
};
