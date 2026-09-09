import React from 'react';
import { Sun, Moon, Sparkles, BookOpen, Zap, Layers, Trophy, LogOut, User, LayoutDashboard, ShieldCheck, Video, Crown } from 'lucide-react';
import { TarqaUser, authService } from '../lib/supabase';
import { UserRole } from '../types';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTab: (tab: 'home' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles') => void;
  activeTab: string;
  onOpenAuth?: (initialTab?: 'signin' | 'signup') => void;
  currentUser?: TarqaUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleDarkMode,
  onSelectTab,
  activeTab,
  onOpenAuth,
  currentUser,
  onLogout,
}) => {
  const userEmailLower = currentUser?.email?.trim().toLowerCase();
  const isOwner = userEmailLower === 'yassooooo27m@gmail.com';
  const isAdmin = Boolean(currentUser && ((currentUser.role === 'admin') || (currentUser.role === 'super_admin') || isOwner));
  const currentRole: UserRole | null = currentUser 
    ? (isOwner ? 'super_admin' : currentUser.role) 
    : null;
  const roleBadge = currentRole ? authService.getRoleBadge(currentRole) : null;

  const canAccessAdmin = Boolean(currentUser && (currentRole === 'admin' || currentRole === 'teacher' || isAdmin));

  return (
    <nav className="sticky top-0 z-30 bg-white/90 dark:bg-[#070b14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* الشعار واسم المنصة */}
        <div 
          onClick={() => onSelectTab('home')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          {/* استخدام صورة الشعار المرفقة في المشروع */}
          <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-slate-900 border border-amber-500/40">
            <img 
              src="/frame_000011.png" 
              alt="شعار طرقع" 
              className="w-8 h-8 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <span className="font-black text-amber-500 text-xl font-cairo">ط</span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                طرقع
              </span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                تأسيس كمي
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              التأسيس الذهني من الصفر حتى 100
            </p>
          </div>
        </div>

        {/* روابط التنقل الرئيسية (حسب الصلاحيات RBAC والتأسيس) */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'home' || activeTab === 'roadmap'
                ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>مسار التأسيس 🛤️</span>
          </button>

          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>لوحة الطالب</span>
          </button>

          {/* لوحة إدارة المحاضرات تظهر للمشرف أو المعلم */}
          {canAccessAdmin && (
            <>
              <button
                onClick={() => onSelectTab('admin-lectures')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'admin-lectures'
                    ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-amber-500" />
                <span>إدارة المحاضرات (CMS)</span>
              </button>

              <button
                onClick={() => onSelectTab('admin')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                <span>بنك الأسئلة</span>
              </button>

              {/* زر إدارة الرتب يظهر لمسؤولي المنصة (Admins) */}
              {isAdmin && (
                <button
                  onClick={() => onSelectTab('admin-roles')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin-roles'
                      ? 'bg-purple-600 text-white shadow-sm font-black'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 dark:hover:bg-purple-500/20'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>إدارة الرتب 🛡️</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => onSelectTab('categories')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'categories'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>أقسام الكمي</span>
          </button>

          <button
            onClick={() => onSelectTab('speed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'speed'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-400 hover:text-amber-500'
            }`}
          >
            <Zap className="w-3.5 h-3.5 fill-current" />
            <span>تحدي طرقع</span>
          </button>
        </div>


        {/* زر التبديل الليلي/النهاري والشارة ومعلومات المستخدم */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleDarkMode}
            className="p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
            title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <Sparkles className="w-3.5 h-3.5" />
            <span>هدفنا 100 🎯</span>
          </div>

          {/* زر تسجيل الدخول وإنشاء حساب للزائر، أو معلومات المستخدم المسجل مع شارة الدور RBAC */}
          {currentUser && roleBadge ? (
            <div className="relative flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold">
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                  {currentUser.fullName ? currentUser.fullName.trim().charAt(0) : 'ط'}
                </div>
                <span className="max-w-[90px] truncate text-slate-900 dark:text-white">
                  {currentUser.fullName}
                </span>

                {/* شارة الصلاحية الرسمية للمستخدم */}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[10px] font-bold ${roleBadge.color}`}
                >
                  <span>{roleBadge.iconText}</span>
                  <span>{roleBadge.label}</span>
                </span>
              </div>

              <button
                onClick={onLogout}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200/60 dark:border-slate-800 hover:border-rose-500/20 transition"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAuth?.('signin')}
                className="px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition"
              >
                تسجيل الدخول
              </button>
              <button
                onClick={() => onOpenAuth?.('signup')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition"
              >
                <span>إنشاء حساب</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
};
