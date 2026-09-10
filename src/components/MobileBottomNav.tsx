import React from 'react';
import { BookOpen, Layers, Zap, LayoutDashboard, Menu, ShieldCheck, GraduationCap } from 'lucide-react';
import { TarqaUser } from '../lib/supabase';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles') => void;
  onOpenMenu: () => void;
  currentUser?: TarqaUser | null;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  onOpenMenu,
  currentUser,
}) => {
  const isManager = currentUser && (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'teacher');

  return (
    <nav 
      aria-label="التنقل السفلي للموبايل"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-[#070b14]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl transition-all"
    >
      <div className="max-w-md mx-auto grid grid-cols-5 items-center gap-1 text-center font-cairo">
        
        {/* 1. الصفحة الرئيسية */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'home' || activeTab === 'roadmap'
              ? 'text-amber-500 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BookOpen className={`w-5 h-5 mb-0.5 ${activeTab === 'home' || activeTab === 'roadmap' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[10px] leading-tight">الرئيسية</span>
        </button>

        {/* 2. الدورات التأسيسية */}
        <button
          type="button"
          onClick={() => onSelectTab('courses')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'courses'
              ? 'text-amber-500 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <GraduationCap className={`w-5 h-5 mb-0.5 ${activeTab === 'courses' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[10px] leading-tight">الدورات</span>
        </button>

        {/* 3. تحدي طرقع (الزر الأوسط البارز) */}
        <button
          type="button"
          onClick={() => onSelectTab('speed')}
          className="flex flex-col items-center justify-center -mt-3.5 group relative"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 group-active:scale-95 transition-transform relative">
            <Zap className="w-5 h-5 fill-current" />
            <span className="absolute -top-1 -right-1 text-[8px] font-black bg-slate-900 text-amber-400 px-1 py-0.2 rounded-full border border-amber-400">
              قريباً
            </span>
          </div>
          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 mt-1">تحدي 45ث</span>
        </button>

        {/* 4. لوحة الطالب */}
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'dashboard'
              ? 'text-amber-500 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <LayoutDashboard className={`w-5 h-5 mb-0.5 ${activeTab === 'dashboard' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[10px] leading-tight">لوحتي</span>
        </button>

        {/* 5. القائمة / الإدارة */}
        <button
          type="button"
          onClick={onOpenMenu}
          className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all ${
            activeTab === 'admin' || activeTab === 'admin-lectures' || activeTab === 'admin-roles'
              ? 'text-purple-500 font-bold'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {isManager ? (
            <ShieldCheck className="w-5 h-5 mb-0.5 stroke-[2] text-purple-500" />
          ) : (
            <Menu className="w-5 h-5 mb-0.5 stroke-[1.75]" />
          )}
          <span className="text-[10px] leading-tight">
            {isManager ? 'الإدارة' : 'المزيد'}
          </span>
        </button>

      </div>
    </nav>
  );
};
