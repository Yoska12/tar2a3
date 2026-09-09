import React, { useState, useEffect } from 'react';
import {
  Zap,
  Layers,
  Play,
  Clock,
  Sparkles,
  ShieldCheck,
  BookOpen,
  Flame,
  ChevronLeft,
  ArrowRight,
  TrendingUp,
  Target,
  BrainCircuit,
  Shapes,
  Calculator,
  Scale,
  BarChart3,
  Lightbulb
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { QuizInterface } from './components/QuizInterface';
import { ResultView } from './components/ResultView';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminPanel } from './components/AdminPanel';
import { ClassroomView } from './components/ClassroomView';
import { FoundationRoadmap } from './components/FoundationRoadmap';
import { LecturesCMS } from './components/LecturesCMS';
import { SuperAdminRolesPanel } from './components/SuperAdminRolesPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { mockFoundationModules } from './data/foundationModules';
import { mockCategories, mockQuestions } from './data/mockQuestions';
import { QuizSettings, QuizResult, Category, Question, CourseModule, Lesson, UserRole } from './types';
import { localScoreStorage, authService, TarqaUser, supabase, isSupabaseConfigured, syncUserToMembersDashboard } from './lib/supabase';
import { sendQuizCompletedNotification, TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from './lib/telegram';

const isOwnerEmail = (email?: string | null) => {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === 'yassooooo27m@gmail.com';
};

export const App: React.FC = () => {
  // وضع الشاشة: home | quiz | result | dashboard | admin | classroom | admin-lectures | admin-roles
  const [currentView, setCurrentView] = useState<'home' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles'>('home');
  const [activeTab, setActiveTab] = useState<'home' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles'>('home');
  const [modules, setModules] = useState<CourseModule[]>(mockFoundationModules);
  const [activeModule, setActiveModule] = useState<CourseModule>(mockFoundationModules[0]);
  const [activeLesson, setActiveLesson] = useState<Lesson>(mockFoundationModules[0].lessons[0]);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'signin' | 'signup'>('signin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<TarqaUser | null>(() => {
    return authService.getCurrentUser();
  });

  // مزامنة فورية للجلسة الحقيقية من Supabase لضمان الصلاحيات وحماية الزوار
  useEffect(() => {
    if (isSupabaseConfigured) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          // استعلام جدول profiles للتأكد من الرتبة الحقيقية المعتمدة
          let role: UserRole = (session.user.app_metadata?.role as any) || (session.user.user_metadata?.role as any) || 'student';
          let fullName = session.user.user_metadata?.full_name || 'طالب طرقع';
          let targetScore = Number(session.user.user_metadata?.target_score) || 100;
          let telegramUsername = session.user.user_metadata?.telegram_username;
          let avatarUrl = session.user.user_metadata?.avatar_url;

          let isBanned = false;
          let banReason = '';

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role, full_name, target_score, telegram_username, avatar_url, is_banned, ban_reason')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile) {
              if (profile.role) role = profile.role as UserRole;
              if (profile.full_name) fullName = profile.full_name;
              if (profile.target_score) targetScore = profile.target_score;
              if (profile.telegram_username) telegramUsername = profile.telegram_username;
              if (profile.avatar_url) avatarUrl = profile.avatar_url;
              isBanned = Boolean(profile.is_banned);
              banReason = profile.ban_reason || '';
            }
          } catch (e) {
            console.warn('[App] Failed to fetch profile from DB:', e);
          }

          if (isBanned) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            localStorage.removeItem('tarqa_current_user');
            alert(`تم حظر هذا الحساب من قبل إدارة المنصة.${banReason ? `\nسبب الحظر: ${banReason}` : ''}`);
            return;
          }

          const isOwner = isOwnerEmail(session.user.email);
          const verifiedRole: UserRole = isOwner ? 'super_admin' : role;

          const user: TarqaUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: isOwner ? (fullName && fullName !== 'طالب طرقع' ? fullName : 'Yoska') : fullName,
            targetScore,
            role: verifiedRole,
            telegramUsername,
            avatarUrl,
            isBanned: false,
          };
          localStorage.setItem('tarqa_current_user', JSON.stringify(user));
          setCurrentUser(user);
          syncUserToMembersDashboard(user);
        } else {
          // إذا لم تكن هناك جلسة نشطة موثقة في Supabase -> المستخدم زائر تماماً
          setCurrentUser(null);
          localStorage.removeItem('tarqa_current_user');
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          let role: UserRole = (session.user.app_metadata?.role as any) || (session.user.user_metadata?.role as any) || 'student';
          let fullName = session.user.user_metadata?.full_name || 'طالب طرقع';
          let targetScore = Number(session.user.user_metadata?.target_score) || 100;
          let telegramUsername = session.user.user_metadata?.telegram_username;
          let avatarUrl = session.user.user_metadata?.avatar_url;
          let isBanned = false;
          let banReason = '';

          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role, full_name, target_score, telegram_username, avatar_url, is_banned, ban_reason')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profile) {
              if (profile.role) role = profile.role as UserRole;
              if (profile.full_name) fullName = profile.full_name;
              if (profile.target_score) targetScore = profile.target_score;
              if (profile.telegram_username) telegramUsername = profile.telegram_username;
              if (profile.avatar_url) avatarUrl = profile.avatar_url;
              isBanned = Boolean(profile.is_banned);
              banReason = profile.ban_reason || '';
            }
          } catch {}

          if (isBanned) {
            await supabase.auth.signOut();
            setCurrentUser(null);
            localStorage.removeItem('tarqa_current_user');
            alert(`تم حظر هذا الحساب من قبل إدارة المنصة.${banReason ? `\nسبب الحظر: ${banReason}` : ''}`);
            return;
          }

          const isOwner = isOwnerEmail(session.user.email);
          const verifiedRole: UserRole = isOwner ? 'super_admin' : role;

          const user: TarqaUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: isOwner ? (fullName && fullName !== 'طالب طرقع' ? fullName : 'Yoska') : fullName,
            targetScore,
            role: verifiedRole,
            telegramUsername,
            avatarUrl,
          };
          localStorage.setItem('tarqa_current_user', JSON.stringify(user));
          setCurrentUser(user);
          syncUserToMembersDashboard(user);
        } else if (event === 'SIGNED_OUT' || !session) {
          setCurrentUser(null);
          localStorage.removeItem('tarqa_current_user');
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // قائمة الأسئلة القابلة للإدارة والتحديث المباشر
  const [allQuestions, setAllQuestions] = useState<Question[]>(mockQuestions);

  // إعدادات الوضع الليلي
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('tarqa_theme') !== 'light';
  });

  // حالة الاختبار الحالي
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(mockQuestions);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    mode: 'Mock_Exam',
    timeLimitSeconds: 600,
    allowInstantExplanation: false,
  });
  const [quizTitle, setQuizTitle] = useState<string>('اختبار محاكي قياس للكمي');
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  // تحديث كلاس الوضع الليلي على وسم html
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tarqa_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tarqa_theme', 'light');
    }
  }, [darkMode]);

  // الاستماع لتغييرات المستخدم والأدوار (RBAC Updates)
  useEffect(() => {
    const handleUserChanged = () => {
      setCurrentUser(authService.getCurrentUser());
    };
    window.addEventListener('tarqa_user_changed', handleUserChanged);
    return () => window.removeEventListener('tarqa_user_changed', handleUserChanged);
  }, []);

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  // بدء اختبار محاكي قياس
  const startMockExam = () => {
    setActiveQuestions([...mockQuestions].sort(() => 0.5 - Math.random()));
    setQuizSettings({
      mode: 'Mock_Exam',
      timeLimitSeconds: mockQuestions.length * 60, // دقيقة لكل سؤال مثل قياس
      allowInstantExplanation: false,
    });
    setQuizTitle('محاكي اختبار قياس الفعلي - شامل كل الأقسام');
    setCurrentView('quiz');
  };

  // بدء وضع التدريب الفوري
  const startPracticeMode = (category?: Category) => {
    let filtered = mockQuestions;
    let title = 'وضع التدريب الفوري - حل مع الشرح المباشر';

    if (category && category.id !== 'all') {
      filtered = mockQuestions.filter((q) => q.categoryId === category.id);
      if (filtered.length === 0) filtered = mockQuestions;
      title = `تدريب مركز: ${category.title}`;
    }

    setActiveQuestions(filtered);
    setQuizSettings({
      mode: 'Practice_Mode',
      timeLimitSeconds: 0, // بدون مؤقت إجباري
      allowInstantExplanation: true,
      categoryFilter: category?.id,
    });
    setQuizTitle(title);
    setCurrentView('quiz');
  };

  // بدء تحدي السرعة
  const startSpeedChallenge = () => {
    setActiveQuestions([...mockQuestions].sort(() => 0.5 - Math.random()).slice(0, 5));
    setQuizSettings({
      mode: 'Speed_Challenge',
      timeLimitSeconds: 5 * 45, // 45 ثانية لكل سؤال فقط!
      allowInstantExplanation: false,
    });
    setQuizTitle('⚡ تحدي طرقع للسرعة الذهنية (45 ثانية للسؤال)');
    setCurrentView('quiz');
  };

  // إنهاء الاختبار واستقبال النتيجة
  const handleQuizFinish = (result: QuizResult) => {
    setLastResult(result);
    localScoreStorage.saveAttempt(result);

    // إرسال إشعار فوري عبر بوت تليجرام @Tarqa3bot إذا كان حساب الطالب مربوطاً
    if (currentUser?.telegramId) {
      sendQuizCompletedNotification(
        currentUser.telegramId,
        currentUser.fullName,
        quizTitle || 'اختبار كمي - منصة طرقع',
        result.percentageScore,
        result.totalQuestions,
        result.totalTimeSeconds
      ).catch(() => {});
    }

    setCurrentView('result');
  };

  // فتح غرفة المحاضرة
  const openLessonClassroom = (mod: CourseModule, lesson: Lesson) => {
    setActiveModule(mod);
    setActiveLesson(lesson);
    setCurrentView('classroom');
  };

  // إكمال المحاضرة
  const handleCompleteLesson = (lessonId: string) => {
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) =>
          l.id === lessonId ? { ...l, isCompleted: true } : l
        ),
      }))
    );
  };

  // دالة موحدة للتنقل بين التبويبات والشاشات
  const handleTabSelect = (tab: 'home' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles') => {
    setActiveTab(tab);
    if (tab === 'speed') {
      startSpeedChallenge();
    } else if (tab === 'dashboard') {
      if (!currentUser) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setCurrentView('dashboard');
      }
    } else if (tab === 'admin') {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher' && currentUser.role !== 'super_admin' && !isOwnerEmail(currentUser?.email))) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setCurrentView('admin');
      }
    } else if (tab === 'admin-lectures') {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'teacher' && currentUser.role !== 'super_admin' && !isOwnerEmail(currentUser?.email))) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setCurrentView('admin-lectures');
      }
    } else if (tab === 'admin-roles') {
      if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && !isOwnerEmail(currentUser?.email))) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setCurrentView('admin-roles');
      }
    } else {
      setCurrentView('home');
      if (tab === 'categories') {
        setTimeout(() => {
          const el = document.getElementById('categories');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col font-cairo">

      {/* الشريط العلوي */}
      <Navbar
        darkMode={darkMode}
        onToggleDarkMode={toggleDarkMode}
        onSelectTab={handleTabSelect}
        activeTab={activeTab}
        onOpenAuth={(tab = 'signin') => {
          setAuthInitialTab(tab);
          setIsAuthOpen(true);
        }}
        currentUser={currentUser}
        onLogout={async () => {
          await authService.signOut();
          setCurrentUser(null);
          setCurrentView('home');
          setActiveTab('home');
        }}
        isMobileMenuOpen={isMobileMenuOpen}
        onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
      />

      {/* نافذة تسجيل الدخول وحساب جديد */}
      <AuthModal
        isOpen={isAuthOpen}
        initialTab={authInitialTab}
        onClose={() => setIsAuthOpen(false)}
        onUserLoggedIn={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
        }}
      />

      {/* ======================================================================= */}
      {/* 1. عرض شاشة الاختبار النشطة */}
      {/* ======================================================================= */}
      {currentView === 'quiz' && (
        <QuizInterface
          questions={activeQuestions}
          settings={quizSettings}
          quizTitle={quizTitle}
          onFinish={handleQuizFinish}
          onExit={() => setCurrentView('home')}
        />
      )}

      {/* ======================================================================= */}
      {/* 2. عرض شاشة النتيجة والتحليل */}
      {/* ======================================================================= */}
      {currentView === 'result' && lastResult && (
        <ResultView
          result={lastResult}
          onRetake={() => setCurrentView('quiz')}
          onHome={() => setCurrentView('home')}
        />
      )}

      {/* ======================================================================= */}
      {/* 3. لوحة تحكم الطالب (Student Dashboard) */}
      {/* ======================================================================= */}
      {currentView === 'dashboard' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          <StudentDashboard
            currentUser={currentUser}
            onStartMock={startMockExam}
            onStartPractice={(cat) => startPracticeMode(cat)}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        </main>
      )}

      {/* ======================================================================= */}
      {/* 4. لوحة تحكم الإدارة وبنك الأسئلة (Admin & Content Management Panel) */}
      {/* ======================================================================= */}
      {currentView === 'admin' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          {currentUser?.role === 'admin' || currentUser?.role === 'teacher' || currentUser?.role === 'super_admin' || isOwnerEmail(currentUser?.email) ? (
            <AdminPanel
              questions={allQuestions}
              categories={mockCategories}
              onAddQuestion={(newQ) => setAllQuestions((prev) => [newQ, ...prev])}
              onUpdateQuestion={(updated) =>
                setAllQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
              }
              onDeleteQuestion={(id) =>
                setAllQuestions((prev) => prev.filter((q) => q.id !== id))
              }
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto text-3xl">
                🛡️
              </div>
              <div>
                <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold">
                  خطأ 403: منطقة محظورة (RBAC)
                </span>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-3 mb-2">
                  لوحة الإدارة مخصصة للمشرفين والمعلمين فقط
                </h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                  حسابك الحالي مسجل بدور <strong className="text-amber-500">[{currentUser?.role === 'student' ? 'طالب' : 'غير مسجل'}]</strong>، ولا يمتلك صلاحية الوصول لإدارة بنك الأسئلة أو قوالب الاختبارات.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-400 space-y-2 text-right">
                <div className="flex justify-between">
                  <span>الصلاحية المطلوبة:</span>
                  <span className="font-bold text-rose-400">مشرف (Admin) أو معلم (Teacher)</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-2">
                  <span>دور حسابك الحالي:</span>
                  <span className="font-bold text-amber-400">{currentUser?.role || 'زائر غير مسجل'}</span>
                </div>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setCurrentView('dashboard');
                    setActiveTab('dashboard');
                  }}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  العودة إلى لوحة الطالب
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================= */}
      {/* 5. لوحة تحكم المحاضرات والمذكرات المستقلة (Lectures CMS) */}
      {/* ======================================================================= */}
      {currentView === 'admin-lectures' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 pb-24 md:pb-8">
          {currentUser?.role === 'admin' || currentUser?.role === 'teacher' || currentUser?.role === 'super_admin' || isOwnerEmail(currentUser?.email) ? (
            <LecturesCMS
              modules={modules}
              onAddLesson={(modId, newLesson) => {
                setModules((prev) =>
                  prev.map((mod) =>
                    mod.id === modId ? { ...mod, lessons: [...mod.lessons, newLesson] } : mod
                  )
                );
              }}
              onUpdateLesson={(updated) => {
                setModules((prev) =>
                  prev.map((mod) => ({
                    ...mod,
                    lessons: mod.lessons.map((l) => (l.id === updated.id ? updated : l)),
                  }))
                );
              }}
              onDeleteLesson={(lessonId) => {
                setModules((prev) =>
                  prev.map((mod) => ({
                    ...mod,
                    lessons: mod.lessons.filter((l) => l.id !== lessonId),
                  }))
                );
              }}
              onTogglePublish={(lessonId) => {
                setModules((prev) =>
                  prev.map((mod) => ({
                    ...mod,
                    lessons: mod.lessons.map((l) =>
                      l.id === lessonId ? { ...l, isPublished: !l.isPublished } : l
                    ),
                  }))
                );
              }}
              onReorderLessons={(modId, lessonId, direction) => {
                setModules((prev) =>
                  prev.map((mod) => {
                    if (mod.id !== modId) return mod;
                    const index = mod.lessons.findIndex((l) => l.id === lessonId);
                    if (index === -1) return mod;
                    if (direction === 'up' && index === 0) return mod;
                    if (direction === 'down' && index === mod.lessons.length - 1) return mod;
                    const copy = [...mod.lessons];
                    const target = direction === 'up' ? index - 1 : index + 1;
                    const temp = copy[index];
                    copy[index] = copy[target];
                    copy[target] = temp;
                    return { ...mod, lessons: copy };
                  })
                );
              }}
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto text-3xl">
                🛡️
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                منطقة محظورة: إدارة المحاضرات
              </h3>
              <p className="text-xs text-slate-400">
                هذه اللوحة مخصصة فقط للمشرفين والمعلمين لإدارة الفيديوهات والمذكرات.
              </p>
              <button
                onClick={() => {
                  setCurrentView('home');
                  setActiveTab('home');
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
              >
                العودة للرئيسية
              </button>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================= */}
      {/* 5.5. لوحة إدارة الرتب والصلاحيات (Admin Roles Panel) */}
      {/* ======================================================================= */}
      {currentView === 'admin-roles' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          {currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || isOwnerEmail(currentUser?.email) ? (
            <SuperAdminRolesPanel
              currentUser={currentUser}
              onNavigateBack={() => {
                setCurrentView('home');
                setActiveTab('home');
              }}
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center mx-auto text-3xl">
                🛡️
              </div>
              <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-bold">
                خطأ 403: منطقة محظورة أمنياً
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                إدارة الرتب مخصصة لمسؤولي المنصة (Admins)
              </h3>
              <p className="text-xs text-slate-400">
                حسابك الحالي مسجل بدور [{currentUser ? authService.getRoleBadge(currentUser.role).label : 'غير مسجل'}]، ولا يمتلك صلاحية تعديل رتب المستخدمين.
              </p>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setCurrentView('home');
                    setActiveTab('home');
                  }}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  العودة للرئيسية
                </button>
              </div>
            </div>
          )}
        </main>
      )}

      {/* ======================================================================= */}
      {/* 6. غرفة المحاضرة ومشغل الفيديو والمذكرات (Classroom UI) */}
      {/* ======================================================================= */}
      {currentView === 'classroom' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          <ClassroomView
            currentModule={activeModule}
            currentLesson={activeLesson}
            onSelectLesson={(lesson) => setActiveLesson(lesson)}
            onCompleteLesson={handleCompleteLesson}
            onStartQuiz={() => startMockExam()}
            onBackToRoadmap={() => setCurrentView('home')}
          />
        </main>
      )}

      {/* ======================================================================= */}
      {/* 7. الصفحة الرئيسية ومسار التأسيس (Foundation Roadmap) */}
      {/* ======================================================================= */}
      {currentView === 'home' && (
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-12 pb-24 md:pb-8">

          {/* مسار التأسيس التفاعلي من الصفر حتى الاحتراف */}
          <FoundationRoadmap
            modules={modules}
            onSelectLesson={(mod, les) => openLessonClassroom(mod, les)}
            onStartModuleQuiz={() => startMockExam()}
          />

          {/* ترحيب بالمستخدم المسجل */}
          {currentUser && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-sm">
                  {currentUser.fullName ? currentUser.fullName.trim().charAt(0) : 'ط'}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    مرحباً بك مجدداً، {currentUser.fullName}!
                  </h4>
                  <p className="text-xs text-slate-500">
                    أنت مسجل الآن وجاهز لاختبارات قدرات كمي • درجتك المستهدفة: {currentUser.targetScore || 100} 🎯
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-amber-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>هدفنا 100 🎯</span>
              </div>
            </div>
          )}

          {/* قسم الهيرو (Hero Section) بهوية طرقع الذهبية */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent dark:from-[#11192e] dark:to-[#070b14] border border-amber-500/20 p-6 sm:p-12 shadow-sm">

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">

              <div className="lg:col-span-8 flex flex-col items-start gap-4">

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                  <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span>تجميعات النماذج الحديثة 1446 • القسم الكمي</span>
                </div>

                <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white leading-[1.25]">
                  طرقع مسائل الكمي.. <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-600 via-amber-500 to-yellow-500">
                    بأسرع الاستراتيجيات وأعلى دقة!
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                  منصة تفاعلية خفيفة وسريعة مصممة لطلاب القدرات، تجمع بين بيئة اختبارات قياس الواقعية، وحيل التدرج المنتظم والحل الذهني السريع بدون معادلات معقدة.
                </p>

                {/* أزرار الإجراءات الرئيسية */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 w-full sm:w-auto">
                  <button
                    onClick={startMockExam}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md hover:shadow-glow transition-all transform hover:-translate-y-0.5 active:scale-98"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>ابدأ محاكي قياس (شامل)</span>
                  </button>

                  <button
                    onClick={() => startPracticeMode()}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all active:scale-98"
                  >
                    <Lightbulb className="w-4 h-4 text-amber-500" />
                    <span>وضع التدريب وحيل طرقع</span>
                  </button>

                  <button
                    onClick={startSpeedChallenge}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-bold text-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30 transition-all active:scale-98"
                  >
                    <Zap className="w-4 h-4" />
                    <span>تحدي 45 ثانية</span>
                  </button>
                </div>

              </div>

              {/* بطاقة الهوية والشعار المرفق */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-500/40 bg-gradient-to-b from-amber-400 to-amber-600 flex items-center justify-center p-6 group">
                  <img
                    src="/frame_000012.png"
                    alt="شعار منصة طرقع"
                    className="w-full h-auto object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-4 inset-x-4 text-center">
                    <span className="text-xs font-bold text-white bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
                      طريقة طرقع: فك السؤال في ثوانٍ
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </section>

          {/* أوضاع الاختبار الثلاثة (بأسلوب Alaqsam التفاعلي) */}
          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  أوضاع التدريب والاختبار
                </h2>
                <p className="text-xs text-slate-500">اختر البيئة المناسبة لمستواك وهدفك التدريبي اليوم</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

              {/* الوضع 1: محاكي قياس الفعلي */}
              <div
                onClick={startMockExam}
                className="group p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-500 transition-colors">
                    محاكي قياس الفعلي
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    مؤقت زمني دقيق لكل سؤال، لوحة تنقل بين الأرقام، حجب الشروحات وتصحيح كامل مع نهاية الاختبار.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <span>دخول الاختبار التجريبي</span>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>

              {/* الوضع 2: التدريب الفوري مع الشروحات */}
              <div
                onClick={() => startPracticeMode()}
                className="group p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BrainCircuit className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-500 transition-colors">
                    التدريب الفوري الذكي
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    حل بدون ضغط الوقت، واكشف شرح "طرقع" السريع فور اختيار الإجابة لترسيخ القوانين الذهنية.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <span>بدء التدريب الفوري</span>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>

              {/* الوضع 3: تحدي السرعة */}
              <div
                onClick={startSpeedChallenge}
                className="group p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 group-hover:text-amber-500 transition-colors">
                    تحدي طرقع للسرعة
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    45 ثانية فقط لكل سؤال! صُمم لرفع سرعة بديهتك الحسابية والتخلص من عادة الخطوات الطويلة.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs font-bold text-purple-600 dark:text-purple-400">
                  <span>خوض التحدي السريع</span>
                  <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                </div>
              </div>

            </div>
          </section>

          {/* تصفح أقسام الكمي الستة (Categories Grid - Alaqsam style) */}
          <section id="categories" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                  أقسام اختبار القدرات (الكمي)
                </h2>
                <p className="text-xs text-slate-500">تدرب على كل قسم بمفرده لتقوية نقاط ضعفك</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mockCategories.filter(c => c.id !== 'all').map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => startPracticeMode(cat)}
                  className="p-5 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 shadow-sm hover:shadow-md transition-all cursor-pointer group flex items-start gap-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    {cat.slug === 'geometry' && <Shapes className="w-6 h-6" />}
                    {cat.slug === 'algebra' && <TrendingUp className="w-6 h-6" />}
                    {cat.slug === 'arithmetic' && <Calculator className="w-6 h-6" />}
                    {cat.slug === 'comparisons' && <Scale className="w-6 h-6" />}
                    {cat.slug === 'statistics' && <BarChart3 className="w-6 h-6" />}
                    {cat.slug === 'word-problems' && <Clock className="w-6 h-6" />}
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-base text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mt-1">
                      {cat.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <span>بدء التدريب</span>
                      <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* بطاقة ميزات "طريقة طرقع" */}
          <section className="p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-2xl shrink-0">
                ⚡
              </div>
              <div>
                <h3 className="text-lg font-bold">لماذا سميت المنصة بـ "طرقع"؟</h3>
                <p className="text-xs text-slate-400 max-w-xl mt-1 leading-relaxed">
                  لأن الهدف أن تـ "طرقع" السؤال في أقل من 30 ثانية بدون تضييع وقتك في المعادلات والخطوات الطويلة، عبر استراتيجيات التجريب الذكي، التدرج المنتظم، وثلاثيات فيثاغورس الذهبية.
                </p>
              </div>
            </div>
            <button
              onClick={startMockExam}
              className="px-6 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm shrink-0 transition"
            >
              جرب المحاكي الآن
            </button>
          </section>

        </main>
      )}

      {/* التذييل */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500">
        <p>منصة طرقع للكمي © {new Date().getFullYear()} • تجميعات وتدريبات تفاعلية لاختبار القدرات العامة</p>
        <div className="mt-2 flex items-center justify-center gap-3 text-[11px]">
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#24A1DE] hover:underline font-semibold flex items-center gap-1"
          >
            <span>بوت التدريب والإشعارات الرسمي: @{TELEGRAM_BOT_USERNAME}</span>
            <span>↗</span>
          </a>
        </div>
      </footer>

      {/* الشريط السفلي العائم للهواتف الذكية (Mobile Bottom Navigation) */}
      {currentView !== 'quiz' && (
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          currentUser={currentUser}
        />
      )}

    </div>
  );
};
