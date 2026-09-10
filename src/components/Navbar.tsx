import React, { useState } from 'react';
import { 
  Sun, 
  Moon, 
  Sparkles, 
  BookOpen, 
  Zap, 
  Layers, 
  Trophy, 
  LogOut, 
  User, 
  LayoutDashboard, 
  ShieldCheck, 
  Video, 
  Crown,
  Menu,
  X,
  ChevronLeft,
  Send,
  ExternalLink
} from 'lucide-react';
import { TarqaUser, authService } from '../lib/supabase';
import { UserRole } from '../types';
import { TELEGRAM_BOT_USERNAME, TELEGRAM_BOT_URL } from '../lib/telegram';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTab: (tab: 'home' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles') => void;
  activeTab: string;
  onOpenAuth?: (initialTab?: 'signin' | 'signup') => void;
  currentUser?: TarqaUser | null;
  onLogout?: () => void;
  isMobileMenuOpen?: boolean;
  onToggleMobileMenu?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  darkMode,
  onToggleDarkMode,
  onSelectTab,
  activeTab,
  onOpenAuth,
  currentUser,
  onLogout,
  isMobileMenuOpen: controlledMenuOpen,
  onToggleMobileMenu,
}) => {
  const [localMenuOpen, setLocalMenuOpen] = useState(false);
  const isMenuOpen = controlledMenuOpen !== undefined ? controlledMenuOpen : localMenuOpen;
  const toggleMenu = () => {
    if (onToggleMobileMenu) {
      onToggleMobileMenu();
    } else {
      setLocalMenuOpen(!localMenuOpen);
    }
  };

  const closeMenu = () => {
    if (onToggleMobileMenu && isMenuOpen) {
      onToggleMobileMenu();
    } else {
      setLocalMenuOpen(false);
    }
  };

  const handleTabClick = (tab: any) => {
    onSelectTab(tab);
    closeMenu();
  };

  const userEmailLower = currentUser?.email?.trim().toLowerCase();
  const isOwner = userEmailLower === 'yassooooo27m@gmail.com';
  const isAdmin = Boolean(currentUser && ((currentUser.role === 'admin') || (currentUser.role === 'super_admin') || isOwner));
  const currentRole: UserRole | null = currentUser 
    ? (isOwner ? 'super_admin' : currentUser.role) 
    : null;
  const roleBadge = currentRole ? authService.getRoleBadge(currentRole) : null;
  const canAccessAdmin = Boolean(currentUser && (currentRole === 'admin' || currentRole === 'teacher' || isAdmin));

  return (
    <>
      <nav className="sticky top-0 z-30 bg-white/90 dark:bg-[#070b14]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors font-cairo">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          
          {/* الشعار واسم المنصة */}
          <div 
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform flex items-center justify-center bg-slate-900 border border-amber-500/40">
              <img 
                src="/frame_000011.png" 
                alt="شعار طرقع" 
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <span className="font-black text-amber-500 text-lg sm:text-xl font-cairo">ط</span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  طرقع
                </span>
                <span className="text-[10px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  تأسيس كمي
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                التأسيس الذهني من الصفر حتى 100
              </p>
            </div>
          </div>

          {/* روابط التنقل للشاشات الكبيرة والتابلت الواسع (Desktop & Tablet Links) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-1 rounded-2xl border border-slate-200/60 dark:border-slate-800 text-xs">
            <button
              onClick={() => onSelectTab('home')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>لوحة الطالب</span>
            </button>

            <button
              onClick={() => onSelectTab('categories')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'speed'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-500'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>تحدي طرقع</span>
            </button>

            {/* أدوات الإدارة للمشرف أو المعلم */}
            {canAccessAdmin && (
              <>
                <button
                  onClick={() => onSelectTab('admin-lectures')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin-lectures'
                      ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Video className="w-3.5 h-3.5 text-amber-500" />
                  <span>إدارة المحاضرات</span>
                </button>

                <button
                  onClick={() => onSelectTab('admin')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin'
                      ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                  <span>بنك الأسئلة</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => onSelectTab('admin-roles')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                      activeTab === 'admin-roles'
                        ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 font-black scale-[1.02]'
                        : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                    <span>إدارة الرتب 👑</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* الجزء الأيسر: زر المود الليلي، شارة المستخدم، وزر الموبايل */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* زر التبديل الليلي/النهاري */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition"
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
              aria-label="تبديل الوضع الليلي"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>

            {/* شارة الهدف للشاشات المتوسطة والكبيرة */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
              <Sparkles className="w-3.5 h-3.5" />
              <span>100 🎯</span>
            </div>

            {/* حالة تسجيل الدخول */}
            {currentUser && roleBadge ? (
              <div className="flex items-center gap-1.5">
                <div 
                  onClick={() => handleTabClick('dashboard')}
                  className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold"
                >
                  <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                    {currentUser.fullName ? currentUser.fullName.trim().charAt(0) : 'ط'}
                  </div>
                  <span className="max-w-[70px] sm:max-w-[90px] truncate text-slate-900 dark:text-white hidden xs:inline-block">
                    {currentUser.fullName}
                  </span>
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${roleBadge.color}`}>
                    <span>{roleBadge.iconText}</span>
                    <span className="hidden sm:inline">{roleBadge.label}</span>
                  </span>
                </div>

                <button
                  onClick={onLogout}
                  className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 border border-slate-200/60 dark:border-slate-800 transition hidden sm:flex"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenAuth?.('signin')}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition"
                >
                  دخول
                </button>
                <button
                  onClick={() => onOpenAuth?.('signup')}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition"
                >
                  حساب جديد
                </button>
              </div>
            )}

            {/* زر القائمة للشاشات الصغيرة والمتوسطة (Hamburger Icon) */}
            <button
              onClick={toggleMenu}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition focus:outline-none"
              aria-label="القائمة الرئيسية"
            >
              {isMenuOpen ? <X className="w-5 h-5 text-amber-500" /> : <Menu className="w-5 h-5" />}
            </button>

          </div>

        </div>
      </nav>

      {/* ======================================================================= */}
      {/* القائمة المنزلقة للشاشات الصغيرة والتابلت (Responsive Mobile Drawer) */}
      {/* ======================================================================= */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex font-cairo">
          {/* الخلفية المعتمة */}
          <div 
            onClick={closeMenu}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity animate-in fade-in"
          />

          {/* لوحة القائمة الجانبية المنبثقة من اليمين */}
          <div className="relative w-4/5 max-w-sm mr-auto bg-white dark:bg-[#0a0f1d] h-full shadow-2xl flex flex-col justify-between p-5 border-l border-slate-200 dark:border-slate-800 animate-in slide-in-from-right duration-250 z-10 overflow-y-auto">
            
            <div className="space-y-5">
              
              {/* رأس القائمة */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 font-black text-sm">
                    ط
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base leading-tight">
                      منصة طرقع
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">التأسيس الذكي للقدرات</p>
                  </div>
                </div>

                <button
                  onClick={closeMenu}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  aria-label="إغلاق القائمة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* بطاقة المستخدم داخل القائمة */}
              {currentUser && roleBadge ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm">
                      {currentUser.fullName ? currentUser.fullName.charAt(0) : 'ط'}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-900 dark:text-white">
                        {currentUser.fullName}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate max-w-[130px] font-mono">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { onOpenAuth?.('signin'); closeMenu(); }}
                    className="py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-center"
                  >
                    تسجيل الدخول
                  </button>
                  <button
                    onClick={() => { onOpenAuth?.('signup'); closeMenu(); }}
                    className="py-2.5 px-3 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold transition text-center shadow-sm"
                  >
                    إنشاء حساب
                  </button>
                </div>
              )}

              {/* قائمة الروابط الرئيسية */}
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 mb-1">
                  التنقل الأساسي
                </p>

                <button
                  onClick={() => handleTabClick('home')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'home' || activeTab === 'roadmap'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-amber-500" />
                    <span>مسار التأسيس الكمي</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick('dashboard')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'dashboard'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutDashboard className="w-4 h-4 text-amber-500" />
                    <span>لوحة متابعة الطالب</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick('categories')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'categories'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>أقسام وفروع الكمي</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 opacity-50" />
                </button>

                <button
                  onClick={() => handleTabClick('speed')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'speed'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>تحدي طرقع للسرعة (45 ثانية)</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 opacity-50" />
                </button>
              </div>

              {/* قسم الإدارة والصلاحيات (إن وجد) */}
              {canAccessAdmin && (
                <div className="space-y-1 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider px-2 mb-1">
                    أدوات المشرف والمعلم
                  </p>

                  <button
                    onClick={() => handleTabClick('admin-lectures')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                      activeTab === 'admin-lectures'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Video className="w-4 h-4 text-purple-500" />
                      <span>إدارة المحاضرات (CMS)</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => handleTabClick('admin')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                      activeTab === 'admin'
                        ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-purple-500" />
                      <span>بنك الأسئلة والاختبارات</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 opacity-50" />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleTabClick('admin-roles')}
                      className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                        activeTab === 'admin-roles'
                          ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                          : 'text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 border border-amber-500/20'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Crown className="w-4 h-4 text-amber-500" />
                        <span>إدارة الرتب والصلاحيات 👑</span>
                      </div>
                      <ChevronLeft className="w-4 h-4 opacity-70" />
                    </button>
                  )}
                </div>
              )}

              {/* رابط بوت تليجرام الرسمي */}
              <div className="p-3 rounded-2xl bg-[#24A1DE]/10 border border-[#24A1DE]/20">
                <a
                  href={TELEGRAM_BOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between text-xs font-bold text-[#24A1DE]"
                >
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4" />
                    <span>بوت طرقع: @{TELEGRAM_BOT_USERNAME}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

            </div>

            {/* أسفل القائمة: تبديل الثيم وتسجيل الخروج */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between p-2">
                <span className="text-xs text-slate-500">المظهر:</span>
                <button
                  onClick={onToggleDarkMode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300"
                >
                  {darkMode ? <Sun className="w-3.5 h-3.5 text-amber-500" /> : <Moon className="w-3.5 h-3.5" />}
                  <span>{darkMode ? 'نهاري' : 'ليلي'}</span>
                </button>
              </div>

              {currentUser && (
                <button
                  onClick={() => { onLogout?.(); closeMenu(); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 transition"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  );
};
