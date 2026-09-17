import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  BrainCircuit,
  Lightbulb,
  GraduationCap,
  FileText,
  X
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { QuizInterface } from './components/QuizInterface';
import { ResultView } from './components/ResultView';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminPanel } from './components/AdminPanel';
import { ClassroomView } from './components/ClassroomView';
import { CoursesView } from './components/CoursesView';
import { LecturesCMS } from './components/LecturesCMS';
import { SuperAdminRolesPanel } from './components/SuperAdminRolesPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LegalPoliciesModal, PolicyTab } from './components/LegalPoliciesModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { ThemeTransitionOrb } from './components/ThemeTransitionOrb';
import { OrangeGalaxyBackground } from './components/OrangeGalaxyBackground';
import { mockFoundationModules } from './data/foundationModules';
import { mockCategories, mockQuestions } from './data/mockQuestions';
import { QuizSettings, QuizResult, Category, Question, CourseModule, Lesson, UserRole, CourseFileItem } from './types';
import { localScoreStorage, authService, TarqaUser, supabase, isSupabaseConfigured, syncUserToMembersDashboard, isValidUuid, isOwnerEmail } from './lib/supabase';
import { sendQuizCompletedNotification, TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from './lib/telegram';
import { coursesStorage, CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL } from './lib/subscriptionService';
import { questionBankStorage, CLOUD_QUESTIONS_STORE_ID, CLOUD_QUESTIONS_STORE_EMAIL } from './lib/questionBankStorage';
import { initGlobalAntiHack, logSecurityViolation } from './lib/antiHack';

export const App: React.FC = () => {
  // وضع الشاشة: home | courses | quiz | result | dashboard | admin | classroom | admin-lectures | admin-roles
  const [currentView, setCurrentView] = useState<'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles'>('home');
  const [activeTab, setActiveTab] = useState<'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles'>('home');
  const [modules, setModules] = useState<CourseModule[]>(() => coursesStorage.getModules());
  const [courseFiles, setCourseFiles] = useState<CourseFileItem[]>(() => coursesStorage.getFiles());
  const [activeModule, setActiveModule] = useState<CourseModule>(() => coursesStorage.getModules()[0] || mockFoundationModules[0]);
  const [activeLesson, setActiveLesson] = useState<Lesson>(() => coursesStorage.getModules()[0]?.lessons?.[0] || mockFoundationModules[0].lessons[0]);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'signin' | 'signup'>('signin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<TarqaUser | null>(() => {
    return authService.getCurrentUser();
  });

  // تبويب الصفحة الرئيسية التفاعلي لتوزيع المحتوى وتخفيف الزحام
  const [homeTab, setHomeTab] = useState<'modes' | 'roadmap' | 'method'>('modes');

  // نافذة السياسات القانونية (شروط الاستخدام، الخصوصية، الكوكيز، الاسترجاع)
  const [policiesModalOpen, setPoliciesModalOpen] = useState<boolean>(false);
  const [policiesInitialTab, setPoliciesInitialTab] = useState<PolicyTab>('terms');

  const handleOpenPolicies = (tab: PolicyTab = 'terms') => {
    setPoliciesInitialTab(tab);
    setPoliciesModalOpen(true);
  };

  useEffect(() => {
    const handleGlobalOpenPolicies = (e: any) => {
      const tab = (e.detail as PolicyTab) || 'terms';
      handleOpenPolicies(tab);
    };
    window.addEventListener('tarqa_open_policies', handleGlobalOpenPolicies);
    return () => window.removeEventListener('tarqa_open_policies', handleGlobalOpenPolicies);
  }, []);

  // دعم الدخول المباشر لصفحة اللوجن التفاعلية عبر الرابط #login أو #signup
  useEffect(() => {
    const checkAuthRoute = () => {
      const hash = window.location.hash;
      if (hash === '#login' || hash === '#signin') {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else if (hash === '#signup' || hash === '#register') {
        setAuthInitialTab('signup');
        setIsAuthOpen(true);
      }
    };
    checkAuthRoute();
    window.addEventListener('hashchange', checkAuthRoute);
    return () => window.removeEventListener('hashchange', checkAuthRoute);
  }, []);

  // تفعيل درع طرقع الأمني ومكافحة الاختراق والفحص (Global Anti-Hack Shield Core)
  useEffect(() => {
    const cleanup = initGlobalAntiHack(
      () => currentUser,
      (msg) => {
        setSecurityToast(msg);
        setTimeout(() => setSecurityToast(null), 3500);
      }
    );
    return cleanup;
  }, [currentUser]);

  // مزامنة فورية للجلسة الحقيقية من Supabase لضمان الصلاحيات وحماية الزوار وتحديث الرتب لحظياً
  useEffect(() => {
    let profilesChannel: any = null;

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
          let profile: any = null;

          try {
            const { data: pById } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            profile = pById;

            if (!profile && session.user.email) {
              const { data: pByEmail } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', session.user.email.toLowerCase())
                .maybeSingle();
              profile = pByEmail;
            }

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
          let isSubscribed = isOwner ? true : Boolean(profile?.is_subscribed);
          let subscriptionExpiresAt = isOwner ? undefined : (profile?.subscription_expires_at || undefined);

          if (!isSubscribed) {
            try {
              const subsRaw = localStorage.getItem('tarqa_subscriptions');
              if (subsRaw) {
                const subs = JSON.parse(subsRaw);
                const sub = subs[session.user.id] || (session.user.email && subs[session.user.email.toLowerCase()]);
                if (sub && (sub.active === true || sub.isActive === true)) {
                  isSubscribed = true;
                  subscriptionExpiresAt = sub.expiresAt || sub.expiresDate;
                }
              }
            } catch {}
          }

          const user: TarqaUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: isOwner ? (fullName && fullName !== 'طالب طرقع' ? fullName : 'Yoska') : fullName,
            targetScore,
            role: verifiedRole,
            telegramUsername,
            avatarUrl,
            isBanned: false,
            isSubscribed,
            subscriptionExpiresAt,
          };
          localStorage.setItem('tarqa_current_user', JSON.stringify(user));
          setCurrentUser(user);
          syncUserToMembersDashboard(user);
        } else {
          // فحص ما إذا كان هناك مستخدم مسجل محلياً (مثل تليجرام أو دخول محلي) والتحقق من رتبته في السيرفر
          const localCur = authService.getCurrentUser();
          if (localCur && (localCur.email || localCur.telegramUsername || localCur.id)) {
            try {
              let profile: any = null;
              const cleanTg = (localCur.telegramUsername || '').replace(/^@/, '').trim();

              // 1. بالـ ID إذا كان UUID
              if (localCur.id && isValidUuid(localCur.id)) {
                const { data: pById } = await supabase.from('profiles').select('*').eq('id', localCur.id).maybeSingle();
                if (pById) profile = pById;
              }

              // 2. بالبريد الحقيقي إذا لم يكن بريد تليجرام وهمي
              if (!profile && localCur.email && !localCur.email.includes('@telegram.tarqa') && !localCur.email.includes('@user.tarqa')) {
                const { data: pByEmail } = await supabase.from('profiles').select('*').eq('email', localCur.email.toLowerCase()).maybeSingle();
                if (pByEmail) profile = pByEmail;
              }

              // 3. بمعرف تليجرام الرقمي
              if (!profile && localCur.telegramId) {
                const { data: pByTgId } = await supabase.from('profiles').select('*').eq('telegram_id', localCur.telegramId).maybeSingle();
                if (pByTgId) profile = pByTgId;
              }

              // 4. بيوزر تليجرام بكل الصيغ
              if (!profile && cleanTg) {
                const { data: pByTgName } = await supabase.from('profiles').select('*').or(`telegram_username.eq.${cleanTg},telegram_username.eq.@${cleanTg},telegram_username.ilike.%${cleanTg}%`).maybeSingle();
                if (pByTgName) profile = pByTgName;
              }

              if (profile) {
                const isOwner = isOwnerEmail(localCur.email) || (profile.email && isOwnerEmail(profile.email));
                const dbRole = (profile.role as UserRole) || 'student';
                const roleFromDb: UserRole = isOwner ? 'super_admin' : dbRole;

                if (!isOwner && (localCur.role === 'super_admin' || localCur.role === 'admin') && dbRole === 'student') {
                  logSecurityViolation('role_tampering', 'تم رصد محاولة تزييف رتبة مدير في المتصفح وإرجاع الحساب إلى رتبة طالب');
                }

                let localSubscribed = isOwner ? true : (Boolean(profile.is_subscribed) || Boolean(localCur.isSubscribed));
                let localExpires = isOwner ? undefined : (profile.subscription_expires_at || localCur.subscriptionExpiresAt);

                if (!localSubscribed) {
                  try {
                    const subsRaw = localStorage.getItem('tarqa_subscriptions');
                    if (subsRaw) {
                      const subs = JSON.parse(subsRaw);
                      const sub = subs[profile.id || localCur.id] || (localCur.email && subs[localCur.email.toLowerCase()]);
                      if (sub && (sub.active === true || sub.isActive === true)) {
                        localSubscribed = true;
                        localExpires = sub.expiresAt || sub.expiresDate;
                      }
                    }
                  } catch {}
                }

                const updatedUser: TarqaUser = {
                  ...localCur,
                  id: profile.id || localCur.id,
                  role: roleFromDb,
                  fullName: isOwner ? 'Yoska' : (profile.full_name || localCur.fullName),
                  email: (profile.email && !profile.email.includes('@telegram.tarqa')) ? profile.email : localCur.email,
                  isBanned: Boolean(profile.is_banned),
                  isSubscribed: localSubscribed,
                  subscriptionExpiresAt: localExpires,
                };
                if (profile.is_banned) {
                  localStorage.removeItem('tarqa_current_user');
                  setCurrentUser(null);
                  alert('تم حظر هذا الحساب من قبل إدارة المنصة.');
                  return;
                }
                localStorage.setItem('tarqa_current_user', JSON.stringify(updatedUser));
                setCurrentUser(updatedUser);
                syncUserToMembersDashboard(updatedUser);
                return;
              }
            } catch (e) {
              console.warn('Failed to verify local user with Supabase:', e);
            }
            
            // حماية ضد التلاعب المحلي: لا يُسمح بأي رتبة إدارية بدون توثيق بريد المالك أو السيرفر
            const isOwner = isOwnerEmail(localCur.email);
            if (!isOwner && (localCur.role === 'super_admin' || localCur.role === 'admin')) {
              localCur.role = 'student';
              localStorage.setItem('tarqa_current_user', JSON.stringify(localCur));
              logSecurityViolation('role_tampering', 'محاولة انتحال صلاحيات إدارية دون توثيق سحابي معتمد');
            }
            setCurrentUser(localCur);
          } else {
            setCurrentUser(null);
            localStorage.removeItem('tarqa_current_user');
          }
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
            let profile = null;
            const { data: pById } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();
            profile = pById;

            if (!profile && session.user.email) {
              const { data: pByEmail } = await supabase
                .from('profiles')
                .select('*')
                .eq('email', session.user.email.toLowerCase())
                .maybeSingle();
              profile = pByEmail;
            }

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
            isBanned: false,
          };
          localStorage.setItem('tarqa_current_user', JSON.stringify(user));
          setCurrentUser(user);
          syncUserToMembersDashboard(user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          localStorage.removeItem('tarqa_current_user');
        }
      });

      // اشتراك Realtime حي بجدول profiles في Supabase لتفعيل رتبة السوبر أدمن فورياً بدون إعادة تحميل الصفحة
      try {
        profilesChannel = supabase
          .channel('public:profiles:all')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            (payload: any) => {
              const updated = payload.new;
              if (!updated) return;

              // مزامنة فورية لمخزن بنك الأسئلة السحابي لجميع الطلاب فور حدوث أي تعديل أو حذف
              if (
                updated.id === CLOUD_QUESTIONS_STORE_ID ||
                (updated.email && updated.email.toLowerCase() === CLOUD_QUESTIONS_STORE_EMAIL)
              ) {
                if (updated.ban_reason) {
                  try {
                    const parsed = JSON.parse(updated.ban_reason);
                    if (Array.isArray(parsed)) {
                      localStorage.setItem('tarqa_custom_questions_v1', JSON.stringify(parsed));
                      setAllQuestions([...parsed]);
                    } else if (parsed && typeof parsed === 'object') {
                      if (Array.isArray(parsed.questions)) {
                        localStorage.setItem('tarqa_custom_questions_v1', JSON.stringify(parsed.questions));
                        setAllQuestions([...parsed.questions]);
                      }
                      if (Array.isArray(parsed.quizzes)) {
                        localStorage.setItem('tarqa_custom_quizzes_v1', JSON.stringify(parsed.quizzes));
                        setCustomQuizzes([...parsed.quizzes]);
                      }
                    }
                  } catch (e) {
                    console.warn('[App] Realtime parse cloud questions error:', e);
                  }
                }
                return;
              }

              // مزامنة فورية لمخزن المحاضرات السحابي لجميع الطلاب والزوار فور حدوث أي تعديل أو حذف
              if (
                updated.id === CLOUD_LECTURES_STORE_ID ||
                (updated.email && updated.email.toLowerCase() === CLOUD_LECTURES_STORE_EMAIL)
              ) {
                if (updated.ban_reason) {
                  try {
                    const parsed = JSON.parse(updated.ban_reason);
                    const newMods = Array.isArray(parsed) ? parsed : (parsed?.modules || []);
                    const hasRealLessons = Array.isArray(newMods) && newMods.some((m: any) => Array.isArray(m.lessons) && m.lessons.length > 0);
                    if (hasRealLessons) {
                      localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(newMods));
                      localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(newMods));
                      setModules([...newMods]);
                    }
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files) && parsed.files.length > 0) {
                      localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(parsed.files));
                      setCourseFiles([...parsed.files]);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: parsed.files }));
                      }
                    }
                    // في حال تضمنت النسخة الاحتياطية أسئلة
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.questions)) {
                      localStorage.setItem('tarqa_custom_questions_v1', JSON.stringify(parsed.questions));
                      setAllQuestions([...parsed.questions]);
                    }
                  } catch (e) {
                    console.warn('[App] Realtime parse cloud modules note:', e);
                  }
                }
                return;
              }

              const cur = authService.getCurrentUser();
              if (!cur) return;

              const curTg = (cur.telegramUsername || '').replace(/^@/, '').toLowerCase();
              const updTg = (updated.telegram_username || '').replace(/^@/, '').toLowerCase();
              const isMe =
                (cur.id && updated.id && cur.id === updated.id) ||
                (cur.email && updated.email && !cur.email.includes('@telegram.tarqa') && cur.email.toLowerCase() === updated.email.toLowerCase()) ||
                (cur.telegramId && updated.telegram_id && cur.telegramId === updated.telegram_id) ||
                (curTg && updTg && curTg === updTg);

              if (isMe) {
                const isOwner = isOwnerEmail(cur.email) || (updated.email && isOwnerEmail(updated.email));
                const newRole: UserRole = isOwner ? 'super_admin' : (updated.role as UserRole || cur.role);
                const newFullName = isOwner ? 'Yoska' : (updated.full_name || cur.fullName);

                const updatedUser: TarqaUser = {
                  ...cur,
                  id: updated.id || cur.id,
                  role: newRole,
                  fullName: newFullName,
                  email: (updated.email && !updated.email.includes('@telegram.tarqa')) ? updated.email : cur.email,
                  isBanned: Boolean(updated.is_banned),
                };

                localStorage.setItem('tarqa_current_user', JSON.stringify(updatedUser));
                setCurrentUser(updatedUser);
                syncUserToMembersDashboard(updatedUser);
                window.dispatchEvent(new Event('tarqa_user_changed'));
                window.dispatchEvent(new Event('tarqa_roles_changed'));
              }
            }
          )
          .subscribe();
      } catch (rtErr) {
        console.warn('Realtime subscription note:', rtErr);
      }

      return () => {
        subscription.unsubscribe();
        if (profilesChannel) supabase.removeChannel(profilesChannel);
      };
    }
  }, []);


  // الاستماع الفوري لتغييرات الرتب والمستخدمين عبر النوافذ والتبويبات
  useEffect(() => {
    const handleUserOrRoleChanged = () => {
      const cur = authService.getCurrentUser();
      setCurrentUser(cur ? { ...cur } : null);
    };

    window.addEventListener('tarqa_user_changed', handleUserOrRoleChanged);
    window.addEventListener('tarqa_roles_changed', handleUserOrRoleChanged);
    window.addEventListener('storage', handleUserOrRoleChanged);

    return () => {
      window.removeEventListener('tarqa_user_changed', handleUserOrRoleChanged);
      window.removeEventListener('tarqa_roles_changed', handleUserOrRoleChanged);
      window.removeEventListener('storage', handleUserOrRoleChanged);
    };
  }, []);

  // قائمة الأسئلة والاختبارات القابلة للإدارة والتحديث والمزامنة السحابية الفورية
  const [allQuestions, setAllQuestions] = useState<Question[]>(() => questionBankStorage.getQuestions());
  const [customQuizzes, setCustomQuizzes] = useState<any[]>(() => questionBankStorage.getQuizzes());

  // إعدادات الوضع الليلي / النهاري
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('tarqa_theme') !== 'light';
  });

  // مزامنة الوضع الليلي مع الـ HTML وتخزين تفضيل المستخدم
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('tarqa_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('tarqa_theme', 'light');
    }
  }, [darkMode]);

  // حالة الاختبار الحالي
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(mockQuestions);
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    mode: 'Mock_Exam',
    timeLimitSeconds: 600,
    allowInstantExplanation: false,
  });
  const [quizTitle, setQuizTitle] = useState<string>('اختبار محاكي قياس للكمي');
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  // الاستماع لتغييرات المستخدم والأدوار والاشتراكات (RBAC & Subscription Updates)
  useEffect(() => {
    const handleUserChanged = () => {
      setCurrentUser(authService.getCurrentUser());
    };
    window.addEventListener('tarqa_user_changed', handleUserChanged);
    window.addEventListener('tarqa_subscription_changed', handleUserChanged);
    return () => {
      window.removeEventListener('tarqa_user_changed', handleUserChanged);
      window.removeEventListener('tarqa_subscription_changed', handleUserChanged);
    };
  }, []);

  // الاستماع لتحديثات المحاضرات والدورات فورياً
  useEffect(() => {
    const handleModulesChanged = (e: any) => {
      const newModules = e.detail || coursesStorage.getModules();
      setModules([...newModules]);

      // مزامنة الدرس النشط والباب النشط لتجنب الإشارة لدروس محذوفة
      if (newModules.length > 0) {
        const allLessons = newModules.flatMap((m: any) => m.lessons || []);
        setActiveModule((prevMod) => {
          if (!prevMod || !newModules.some((m: any) => m.id === prevMod.id)) {
            return newModules[0];
          }
          return newModules.find((m: any) => m.id === prevMod.id) || newModules[0];
        });
        setActiveLesson((prevLes) => {
          if (!prevLes || !allLessons.some((l: any) => l.id === prevLes.id)) {
            return allLessons[0] || newModules[0]?.lessons?.[0];
          }
          return allLessons.find((l: any) => l.id === prevLes.id) || prevLes;
        });
      }
    };
    window.addEventListener('tarqa_courses_modules_changed', handleModulesChanged);
    return () => window.removeEventListener('tarqa_courses_modules_changed', handleModulesChanged);
  }, []);

  // الاستماع الفوري لتحديثات ملفات ومذكرات الدورة
  useEffect(() => {
    const handleFilesChanged = (e: any) => {
      const newFiles = e.detail !== undefined ? e.detail : coursesStorage.getFiles();
      setCourseFiles([...newFiles]);
    };
    window.addEventListener('tarqa_courses_files_changed', handleFilesChanged);
    return () => window.removeEventListener('tarqa_courses_files_changed', handleFilesChanged);
  }, []);

  // مزامنة فورية صامتة عند بدء تشغيل الموقع لجلب أحدث محاضرات تم تعديلها أو إضافتها سحابياً
  useEffect(() => {
    coursesStorage.syncFromCloud().then((cloudData) => {
      if (cloudData?.modules && Array.isArray(cloudData.modules)) {
        const hasLessons = cloudData.modules.some((m) => Array.isArray(m.lessons) && m.lessons.length > 0);
        if (hasLessons) {
          setModules([...cloudData.modules]);
        } else {
          setModules(coursesStorage.getModules());
        }
      }
      if (cloudData?.files && Array.isArray(cloudData.files) && cloudData.files.length > 0) {
        setCourseFiles([...cloudData.files]);
      } else {
        setCourseFiles(coursesStorage.getFiles());
      }
    });
  }, []);

  // الاستماع لتحديثات بنك الأسئلة والاختبارات فورياً
  useEffect(() => {
    const handleQuestionsChanged = (e: any) => {
      const newQuestions = e.detail || questionBankStorage.getQuestions();
      setAllQuestions([...newQuestions]);
    };
    const handleQuizzesChanged = (e: any) => {
      const newQuizzes = e.detail || questionBankStorage.getQuizzes();
      setCustomQuizzes([...newQuizzes]);
    };
    window.addEventListener('tarqa_questions_changed', handleQuestionsChanged);
    window.addEventListener('tarqa_quizzes_changed', handleQuizzesChanged);
    return () => {
      window.removeEventListener('tarqa_questions_changed', handleQuestionsChanged);
      window.removeEventListener('tarqa_quizzes_changed', handleQuizzesChanged);
    };
  }, []);

  // مزامنة فورية صامتة عند بدء تشغيل الموقع لجلب أحدث بنك أسئلة واختبارات تم تعديلها أو إضافتها سحابياً
  useEffect(() => {
    questionBankStorage.syncFromCloud().then((cloudData) => {
      if (cloudData?.questions && cloudData.questions.length > 0) {
        setAllQuestions([...cloudData.questions]);
      }
      if (cloudData?.quizzes && cloudData.quizzes.length > 0) {
        setCustomQuizzes([...cloudData.quizzes]);
      }
    });
  }, []);

  // حالة أنيميشن الدائرة عند تبديل الثيم
  const [orbTarget, setOrbTarget] = useState<boolean | null>(null);
  const [orbAnimationId, setOrbAnimationId] = useState<number>(0);

  const toggleDarkMode = () => {
    // منع الضغطات المتكررة أثناء عمل حركة الانتقال
    if (orbTarget !== null) return;
    setOrbTarget(!darkMode);
    setOrbAnimationId((prev) => prev + 1);
  };

  const handleOrbMidpoint = () => {
    // تفعيل فئة الانتقال الانسيابي لتبديل الألوان في الخلفية بنعومة فائقة
    document.documentElement.classList.add('theme-transitioning');
    if (orbTarget !== null) {
      setDarkMode(orbTarget);
    } else {
      setDarkMode((prev) => !prev);
    }
  };

  const handleOrbComplete = () => {
    // الأنيميشن انتهى - ازل الدائرة
    setOrbTarget(null);
    // إزالة كلاس الانتقال بعد اكتمال انسياب الألوان بثبات
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 250);
  };

  // حالة الإشعار التفاعلي لميزات "قريباً"
  const [comingSoonNotice, setComingSoonNotice] = useState<string | null>(null);

  const triggerComingSoon = (featureName: string) => {
    setComingSoonNotice(featureName);
    setTimeout(() => {
      setComingSoonNotice((prev) => (prev === featureName ? null : prev));
    }, 4000);
  };

  // بدء اختبار محاكي قياس (موقف ومتاح قريباً)
  const startMockExam = () => {
    triggerComingSoon('محاكي اختبار قياس الفعلي');
  };

  // بدء وضع التدريب الفوري (موقف ومتاح قريباً)
  const startPracticeMode = (_category?: Category) => {
    triggerComingSoon('وضع التدريب الفوري الذكي');
  };

  // بدء تحدي السرعة (موقف ومتاح قريباً)
  const startSpeedChallenge = () => {
    triggerComingSoon('تحدي طرقع للسرعة (45 ثانية)');
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
    const cur = coursesStorage.getModules();
    const updated = cur.map((mod) => ({
      ...mod,
      lessons: (mod.lessons || []).map((l) =>
        l.id === lessonId ? { ...l, isCompleted: true } : l
      ),
    }));
    coursesStorage.saveModules(updated);
    setModules([...updated]);
  };

  // دالة موحدة للتنقل بين التبويبات والشاشات
  const handleTabSelect = (tab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles') => {
    setActiveTab(tab);
    if (tab === 'courses') {
      setCurrentView('courses');
    } else if (tab === 'speed') {
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
    <div className="min-h-screen bg-white dark:bg-[#06070c] text-slate-900 dark:text-slate-100 flex flex-col font-cairo relative">
      {/* خلفية مجرة طرقع الكونية البرتقالية */}
      <OrangeGalaxyBackground />

      {/* دائرة انتقال الثيم */}
      {orbTarget !== null && (
          <ThemeTransitionOrb
            key={orbAnimationId}
            targetIsDark={orbTarget}
            onMidpoint={handleOrbMidpoint}
            onComplete={handleOrbComplete}
          />
        )}
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
        onOpenPolicies={handleOpenPolicies}
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
            onNavigateCourses={() => setCurrentView('courses')}
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
              quizzes={customQuizzes}
              onAddQuestion={(newQ) => {
                const updated = questionBankStorage.addQuestion(newQ);
                setAllQuestions([...updated]);
              }}
              onUpdateQuestion={(updated) => {
                const updatedList = questionBankStorage.updateQuestion(updated);
                setAllQuestions([...updatedList]);
              }}
              onDeleteQuestion={(id) => {
                const updated = questionBankStorage.deleteQuestion(id);
                setAllQuestions([...updated]);
              }}
              onResetDefaultQuestions={() => {
                const reset = questionBankStorage.resetToDefault();
                setAllQuestions([...reset]);
              }}
              onSyncCloud={async () => {
                await questionBankStorage.syncToCloud(allQuestions, customQuizzes);
              }}
              onCreateQuiz={(quizData) => {
                const updated = questionBankStorage.saveQuiz(quizData);
                setCustomQuizzes([...updated]);
              }}
              onDeleteQuiz={(quizId) => {
                const updated = questionBankStorage.deleteQuiz(quizId);
                setCustomQuizzes([...updated]);
              }}
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
              files={courseFiles}
              onAddLesson={(modId, newLesson) => {
                const updated = coursesStorage.addLesson(modId, newLesson);
                setModules([...updated]);
              }}
              onUpdateLesson={(updated) => {
                const updatedList = coursesStorage.updateLesson(updated);
                setModules([...updatedList]);
              }}
              onDeleteLesson={(lessonId) => {
                const updated = coursesStorage.deleteLesson(lessonId);
                setModules([...updated]);
              }}
              onTogglePublish={(lessonId) => {
                const updated = coursesStorage.togglePublish(lessonId);
                setModules([...updated]);
              }}
              onToggleFreePreview={(lessonId) => {
                const updated = coursesStorage.toggleFreePreview(lessonId);
                setModules([...updated]);
              }}
              onReorderLessons={(modId, lessonId, direction) => {
                const saved = coursesStorage.reorderLessons(modId, lessonId, direction);
                setModules([...saved]);
              }}
              onResetDefault={() => {
                const reset = coursesStorage.resetToDefault();
                setModules([...reset]);
                setCourseFiles([...coursesStorage.getFiles()]);
              }}
              onSyncCloud={async () => {
                coursesStorage.syncToCloud(modules, courseFiles);
              }}
              onAddFile={(newFile) => {
                const updated = coursesStorage.addFile(newFile);
                setCourseFiles([...updated]);
              }}
              onUpdateFile={(updatedFile) => {
                const updated = coursesStorage.updateFile(updatedFile);
                setCourseFiles([...updated]);
              }}
              onDeleteFile={(fileId) => {
                const updated = coursesStorage.deleteFile(fileId);
                setCourseFiles([...updated]);
              }}
              onToggleFilePreview={(fileId) => {
                const updated = coursesStorage.toggleFilePreview(fileId);
                setCourseFiles([...updated]);
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
            currentUser={currentUser}
            onSelectLesson={(lesson) => setActiveLesson(lesson)}
            onCompleteLesson={handleCompleteLesson}
            onStartQuiz={() => startMockExam()}
            onBackToRoadmap={() => {
              setCurrentView('courses');
              setActiveTab('courses');
            }}
          />
        </main>
      )}

      {/* ======================================================================= */}
      {/* 6.5. صفحة الدورات التدريبية المستقلة (Dedicated Courses Page) */}
      {/* ======================================================================= */}
      {currentView === 'courses' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          <CoursesView
            currentUser={currentUser}
            onOpenClassroom={(module, lesson) => {
              setActiveModule(module);
              setActiveLesson(lesson);
              setCurrentView('classroom');
            }}
            onBackToHome={() => {
              setCurrentView('home');
              setActiveTab('home');
            }}
            onOpenAuth={() => {
              setAuthInitialTab('signin');
              setIsAuthOpen(true);
            }}
          />
        </main>
      )}

      {/* ======================================================================= */}
      {/* 7. الصفحة الرئيسية (Clean, Minimalist & Spacious) */}
      {/* ======================================================================= */}
      {currentView === 'home' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12 sm:gap-16 pb-24 md:pb-12">

          {/* قسم الهيرو (Hero Section) حر بدون صندوق حابس مع بقاء العناصر في نفس مكانها */}
          <section className="relative py-2 sm:py-6 text-center sm:text-start">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-8 flex flex-col items-center sm:items-start gap-4">
                <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white leading-[1.25]">
                  تأسيس ذكي وسريع.. <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-l from-amber-600 via-amber-500 to-yellow-500">
                    طرقع مسائل الكمي بدقة 100%
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
                  بيئة تدريب تحاكي اختبارات قياس الواقعية، مع شروحات "طرقع" للحل الذهني السريع بدون معادلات معقدة.
                </p>

                {/* أزرار الإجراءات الرئيسية الواضحة */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleTabSelect('courses')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md hover:shadow-glow transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer"
                  >
                    <GraduationCap className="w-5 h-5" />
                    <span>تصفح الدورات والتأسيس 🎓</span>
                  </button>

                  <button
                    onClick={startMockExam}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-98 cursor-pointer"
                  >
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>محاكي قياس (قريباً ⏳)</span>
                  </button>
                </div>
              </div>

              {/* بطاقة الشعار البسيطة والأنيقة */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-400 to-amber-500 flex items-center justify-center p-6 shadow-xl relative overflow-hidden group">
                  <img
                    src="/frame_000012.png"
                    alt="شعار منصة طرقع"
                    className="w-full h-auto max-h-44 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const el = e.target as HTMLElement;
                      el.style.display = 'none';
                      const fallback = el.parentElement?.querySelector('.logo-fallback') as HTMLElement;
                      if (fallback) fallback.style.display = 'flex';
                    }}
                  />
                  <div className="logo-fallback hidden flex-col items-center justify-center gap-2 text-slate-950">
                    <span className="text-6xl font-black font-cairo">ط</span>
                    <span className="text-xl font-black">منصة طرقع</span>
                  </div>
                </div>
              </div>

            </div>
          </section>

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
            </div>
          )}

          {/* ======================================================================= */}
          {/* أقسام المنصة الأساسية (3 بطاقات واضحة، بسيطة ومباشرة) */}
          {/* ======================================================================= */}
          <section className="flex flex-col gap-5">
            <div className="text-center sm:text-start">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                ابدأ رحلتك نحو الـ 100 🎯
              </h2>
              <p className="text-xs text-slate-500 mt-1">اختر القسم المناسب لهدفك اليوم بدون تعقيد</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* البطاقة 1: دورة التأسيس الشاملة */}
              <div
                onClick={() => handleTabSelect('courses')}
                className="p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    دورة التأسيس الشاملة
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                    محاضرات فيديو متدرجة من الصفر لتغطية الحساب، الجبر، الهندسة والإحصاء باستراتيجيات طرقع للحل السريع.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                    <span>دخول المحاضرات</span>
                    <span>←</span>
                  </span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    متاح الآن 🎓
                  </span>
                </div>
              </div>

              {/* البطاقة 2: المذكرات وتجميعات PDF */}
              <div
                onClick={() => handleTabSelect('courses')}
                className="p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    المذكرات وبنك الملفات
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                    ملازم تأسيس شاملة وتجميعات كمي حديثة 1446 منسقة بصيغة PDF للتحميل والمذاكرة أوفلاين.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                    <span>استعراض المذكرات</span>
                    <span>←</span>
                  </span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    تحميل مباشر 📥
                  </span>
                </div>
              </div>

              {/* البطاقة 3: محاكي قياس الفعلي */}
              <div
                onClick={startMockExam}
                className="p-6 rounded-2xl bg-white dark:bg-[#0d1424] border border-slate-200/90 dark:border-slate-800 hover:border-purple-500/60 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    محاكي قياس الذكي
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                    بيئة اختبار تحاكي مركز قياس بمؤقت زمني وتصحيح تفصيلي، يجري تجهيزها وتدشينها قريباً لجميع الطلاب.
                  </p>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">متاح قريباً للطلاب</span>
                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    قريباً ⏳
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* بطاقة "منهجية طرقع" الهادئة والبسيطة (متوافقة تماماً مع اللايت والدارك) */}
          {/* ======================================================================= */}
          <section className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0d1424] text-slate-900 dark:text-white border border-slate-200/90 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0">
                ⚡
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold">لماذا سميت المنصة بـ "طرقع"؟</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl mt-1 leading-relaxed">
                  لأن الهدف أن تـ "طرقع" السؤال في أقل من 30 ثانية بدون تضييع وقتك في المعادلات والخطوات الطويلة، عبر استراتيجيات التجريب الذكي، التدرج المنتظم، وثلاثيات فيثاغورس.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTabSelect('courses')}
              className="px-6 py-3 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm shrink-0 transition flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
            >
              <GraduationCap className="w-4 h-4" />
              <span>تصفح دورة التأسيس 🎓</span>
            </button>
          </section>

        </main>
      )}

      {/* التذييل المؤسسي لمنصة طرقع */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#070b14]/50 py-8 px-4 text-center text-xs text-slate-500 space-y-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-start space-y-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-black text-sm text-slate-900 dark:text-white">منصة طرقع للقدرات</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold">
                تأسيس وتجميعات {new Date().getFullYear()}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              تجميعات وتدريبات تفاعلية ومحاضرات تأسيس متخصصة لاختبار القدرات العامة (القسم الكمي).
            </p>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-400 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => handleOpenPolicies('terms')}
              className="hover:text-amber-500 transition cursor-pointer"
            >
              شروط الاستخدام
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleOpenPolicies('privacy')}
              className="hover:text-amber-500 transition cursor-pointer"
            >
              سياسة الخصوصية
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleOpenPolicies('cookies')}
              className="hover:text-amber-500 transition cursor-pointer"
            >
              ملفات الكوكيز 🍪
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => handleOpenPolicies('refund')}
              className="hover:text-amber-500 transition cursor-pointer"
            >
              سياسة الاسترجاع
            </button>
          </div>
        </div>

        {/* شريط الأمان وحقوق النشر */}
        <div className="max-w-4xl mx-auto pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-3 justify-center">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>دفع مشفر وآمن (Kashier PCI-DSS)</span>
            </span>
            <span>•</span>
            <span>تشفير 256-Bit SSL</span>
          </div>

          <div className="flex items-center gap-3 justify-center">
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#24A1DE] hover:underline font-semibold flex items-center gap-1"
            >
              <span>بوت التيليجرام: @{TELEGRAM_BOT_USERNAME}</span>
              <span>↗</span>
            </a>
            <span>•</span>
            <span>جميع الحقوق محفوظة © {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {currentView !== 'quiz' && (
        <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          currentUser={currentUser}
        />
      )}

      {/* إشعار تفاعلي لميزات "قريباً" */}
      {comingSoonNotice && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 max-w-md w-[92%] sm:w-auto">
          <div className="flex items-center gap-3.5 p-4 rounded-2xl bg-slate-950/95 text-white border-2 border-amber-500/70 shadow-2xl shadow-amber-500/20 backdrop-blur-xl">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black text-xl shrink-0">
              ⏳
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h5 className="font-bold text-sm text-amber-400">ميزة قادمة قريباً!</h5>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  تحت التجهيز
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                <span className="font-bold text-white">{comingSoonNotice}</span> قيد التطوير والتجهيز حالياً، وسيتم إطلاقها قريباً جداً في التحديث القادم!
              </p>
            </div>
            <button
              onClick={() => setComingSoonNotice(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* درع الحماية العائم - تنبيهات فورية لمكافحة الاختراق والعبث */}
      {securityToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[999999] px-5 py-3 rounded-2xl bg-red-950/95 border-2 border-red-500/70 text-red-100 shadow-2xl shadow-red-950/80 backdrop-blur-xl flex items-center gap-3 text-xs sm:text-sm font-bold animate-bounce select-none pointer-events-none">
          <span className="text-xl">🛡️</span>
          <span className="font-cairo tracking-wide">{securityToast}</span>
        </div>
      )}

      {/* نافذة السياسات وشروط الاستخدام والخصوصية */}
      <LegalPoliciesModal
        isOpen={policiesModalOpen}
        onClose={() => setPoliciesModalOpen(false)}
        initialTab={policiesInitialTab}
      />

      {/* شريط الموافقة على ملفات تعريف الارتباط (Cookies Banner) */}
      <CookieConsentBanner onOpenPolicies={handleOpenPolicies} />

    </div>
  );
};
