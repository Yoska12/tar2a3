import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Send,
  ExternalLink,
  GraduationCap,
  CreditCard
} from 'lucide-react';
import { TarqaUser, authService } from '../lib/supabase';
import { isOwnerEmail, canAccessAdmin as checkCanAccessAdmin, isSuperAdminRole } from '../lib/securityUtils';
import { UserRole } from '../types';
import { TELEGRAM_BOT_USERNAME, TELEGRAM_BOT_URL } from '../lib/telegram';

interface NavbarProps {
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onSelectTab: (tab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security') => void;
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

  const closeMenu = () => {
    if (onToggleMobileMenu && isMenuOpen) {
      onToggleMobileMenu();
    } else {
      setLocalMenuOpen(false);
    }
  };

  const toggleMenu = () => {
    if (onToggleMobileMenu) {
      onToggleMobileMenu();
    } else {
      setLocalMenuOpen(!localMenuOpen);
    }
  };

  const handleTabClick = (tab: any) => {
    onSelectTab(tab);
    closeMenu();
  };

  const isOwner = isOwnerEmail(currentUser?.email);
  const isAdmin = Boolean(currentUser && (currentUser.role === 'admin' || isSuperAdminRole(currentUser)));
  const currentRole: UserRole | null = currentUser 
    ? (isOwner ? 'super_admin' : currentUser.role) 
    : null;
  const roleBadge = currentRole ? authService.getRoleBadge(currentRole) : null;
  const canAccessAdmin = checkCanAccessAdmin(currentUser);

  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false);
  const adminDropdownRef = useRef<HTMLDivElement>(null);
  const [userPoints, setUserPoints] = useState(() => {
    try {
      const stored = localStorage.getItem('tarqa_student_points_v1');
      return stored ? parseInt(stored, 10) || 0 : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const handlePointsUpdate = (e: any) => {
      const newPts = e?.detail?.points !== undefined ? e.detail.points : 0;
      setUserPoints(newPts);
    };
    window.addEventListener('tarqa_points_updated', handlePointsUpdate);
    return () => window.removeEventListener('tarqa_points_updated', handlePointsUpdate);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(e.target as Node)) {
        setAdminDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-30 bg-transparent dark:bg-transparent transition-all font-cairo relative">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4 relative z-10">
          
          {/* الشعار واسم المنصة */}
          <div 
            onClick={() => handleTabClick('home')}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group shrink-0"
          >
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-transform flex items-center justify-center bg-gradient-to-b from-amber-400 to-amber-500 border border-amber-400/60 p-1 shrink-0 shadow-amber-500/20">
              <img 
                src="/frame_00012.png" 
                alt="شعار طرقع" 
                className="w-full h-full object-contain drop-shadow-sm"
              />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                  طرقع
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
                التأسيس الذهني من الصفر حتى 100
              </p>
            </div>
          </div>

          {/* روابط التنقل للشاشات الكبيرة والتابلت الواسع (Desktop & Tablet Links) */}
          {/* روابط التنقل للشاشات الكبيرة واللابتوب بشكل رايق ونظيف بدون أي تكدس */}
          <div className="hidden lg:flex items-center gap-1.5 bg-white/80 dark:bg-[#060913]/70 p-1.5 rounded-2xl border border-slate-200/80 dark:border-amber-500/25 text-xs shadow-sm flex-nowrap shrink-0 backdrop-blur-xl dark:shadow-[inset_0_0_15px_rgba(245,158,11,0.08)]">
            <button
              onClick={() => onSelectTab('home')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'home' || activeTab === 'roadmap'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'text-slate-600 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 dark:hover:bg-amber-500/10'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>الرئيسية</span>
            </button>

            <button
              onClick={() => onSelectTab('courses')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'courses'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-amber-500" />
              <span>الدورات 🎓</span>
            </button>

            <button
              onClick={() => onSelectTab('speed')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'speed'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-amber-500'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>تحدي 45ث ⚡</span>
            </button>

            <button
              onClick={() => onSelectTab('leaderboard')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'leaderboard'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25 font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>المتصدرون 🏆</span>
            </button>

            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>لوحة الطالب</span>
            </button>

            {/* قائمة أدوات الإدارة المنسدلة الأنيقة (تمنع تكدس الأزرار في النافبار) */}
            {canAccessAdmin && (
              <div className="relative shrink-0" ref={adminDropdownRef}>
                <button
                  type="button"
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'admin' || activeTab === 'admin-lectures' || activeTab === 'admin-roles' || activeTab === 'admin-kashier' || activeTab === 'admin-security' || activeTab === 'kashier' || activeTab === 'security'
                      ? 'bg-purple-600 text-white shadow-sm font-black'
                      : 'text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>لوحة الإدارة</span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${adminDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {adminDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-64 p-2 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150">
                    
                    {/* بوابة كاشير والمدفوعات */}
                    <button
                      type="button"
                      onClick={() => { onSelectTab('admin-kashier' as any); setAdminDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                        activeTab === 'admin-kashier' || activeTab === 'kashier' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span>بوابة كاشير والمدفوعات</span>
                        <span className="text-[10px] text-slate-400 font-normal">إعدادات الدفع والسجلات 💳</span>
                      </div>
                    </button>

                    {/* درع الأمان وسجل المخالفات */}
                    <button
                      type="button"
                      onClick={() => { onSelectTab('admin-security' as any); setAdminDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                        activeTab === 'admin-security' || activeTab === 'security' ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span>درع الأمان والمخالفات</span>
                        <span className="text-[10px] text-slate-400 font-normal">سجل محاولات الغش والقرصنة 🛡️</span>
                      </div>
                    </button>

                    {/* إدارة الرتب والمشتركين */}
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => { onSelectTab('admin-roles'); setAdminDropdownOpen(false); }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                          activeTab === 'admin-roles' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          <Crown className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col text-start">
                          <span>إدارة الأعضاء والاشتراكات</span>
                          <span className="text-[10px] text-slate-400 font-normal">الرتب وتصفير الحسابات 👑</span>
                        </div>
                      </button>
                    )}

                    {/* إدارة المحاضرات */}
                    <button
                      type="button"
                      onClick={() => { onSelectTab('admin-lectures'); setAdminDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                        activeTab === 'admin-lectures' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                        <Video className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span>إدارة المحاضرات (CMS)</span>
                        <span className="text-[10px] text-slate-400 font-normal">الفيديوهات والمذكرات 🎬</span>
                      </div>
                    </button>

                    {/* بنك الأسئلة والاختبارات */}
                    <button
                      type="button"
                      onClick={() => { onSelectTab('admin'); setAdminDropdownOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold transition text-right ${
                        activeTab === 'admin' ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 font-black' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
                        <Layers className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col text-start">
                        <span>بنك الأسئلة والاختبارات</span>
                        <span className="text-[10px] text-slate-400 font-normal">إضافة وحذف وتعديل الأسئلة 📝</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* الجزء الأيسر: زر المود الليلي، شارة المستخدم، وزر الموبايل */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            
            {/* زر التبديل الليلي/النهاري */}
            <button
              onClick={onToggleDarkMode}
              className="p-2 sm:p-2.5 rounded-xl text-slate-600 dark:text-amber-300 bg-white/80 dark:bg-transparent hover:bg-slate-100 dark:hover:bg-amber-500/15 border border-slate-200/80 dark:border-amber-500/30 dark:shadow-[0_0_12px_rgba(245,158,11,0.2)] transition-all hover:scale-105 active:scale-95 shadow-sm"
              title={darkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
              aria-label="تبديل الوضع الليلي"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>


            {/* زر رصيد النقاط ولوحة الأبطال السريع */}
            <div 
              onClick={() => handleTabClick('leaderboard')}
              className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-xs font-black text-amber-600 dark:text-amber-400 transition-all shadow-sm shrink-0"
              title="رصيدك من نقاط طرقع (XP) - اضغط لفتح لوحة الأبطال"
            >
              <Zap className="w-3.5 h-3.5 fill-current text-amber-500" />
              <span>{userPoints.toLocaleString()}</span>
              <span className="text-[10px] hidden xs:inline">XP</span>
            </div>

            {/* حالة تسجيل الدخول */}
            {currentUser && roleBadge ? (
              <div className="flex items-center gap-1.5">
                <div 
                  onClick={() => handleTabClick('dashboard')}
                  className="cursor-pointer flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#060913]/90 border border-slate-200/80 dark:border-amber-500/30 dark:shadow-[0_0_15px_rgba(245,158,11,0.15)] text-xs font-bold hover:border-amber-500/60 transition-all shadow-sm"
                >
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
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
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>الرئيسية</span>
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
                  onClick={() => handleTabClick('courses')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'courses'
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    <span>الدورات التأسيسية 🎓</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    متاح
                  </span>
                </button>

                <button
                  onClick={() => handleTabClick('leaderboard')}
                  className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                    activeTab === 'leaderboard'
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>لوحة المتصدرين والأبطال 🏆</span>
                  </div>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400">
                    {userPoints} XP
                  </span>
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
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    قريباً
                  </span>
                </button>
              </div>

              {/* قسم الإدارة والصلاحيات (إن وجد) */}
              {canAccessAdmin && (
                <div className="space-y-1 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                  <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider px-2 mb-1">
                    أدوات المشرف والإدارة
                  </p>

                  <button
                    onClick={() => handleTabClick('admin-kashier' as any)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                      activeTab === 'admin-kashier' || activeTab === 'kashier'
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <CreditCard className="w-4 h-4 text-emerald-500" />
                      <span>بوابة كاشير والمدفوعات 💳</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => handleTabClick('admin-security' as any)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                      activeTab === 'admin-security' || activeTab === 'security'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-rose-500" />
                      <span>درع الأمان وسجل المخالفات 🛡️</span>
                    </div>
                    <ChevronLeft className="w-4 h-4 opacity-50" />
                  </button>

                  <button
                    onClick={() => handleTabClick('admin-lectures')}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition ${
                      activeTab === 'admin-lectures'
                        ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 font-black'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Video className="w-4 h-4 text-blue-500" />
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
                      <Layers className="w-4 h-4 text-purple-500" />
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
                        <span>إدارة الأعضاء والاشتراكات 👑</span>
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
