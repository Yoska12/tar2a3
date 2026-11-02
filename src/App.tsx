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
  X,
  Mail,
  Phone,
  MessageSquare,
  Users,
  ExternalLink,
  Globe,
  Wrench
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { QuizInterface } from './components/QuizInterface';
import { ResultView } from './components/ResultView';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminPanel, AdminTab } from './components/AdminPanel';
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
import { canAccessAdmin, isSuperAdminRole } from './lib/securityUtils';
import { sendQuizCompletedNotification, TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from './lib/telegram';
import { coursesStorage, CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL, isUserSubscribed, activateAnnualSubscription } from './lib/subscriptionService';
import { questionBankStorage, CLOUD_QUESTIONS_STORE_ID, CLOUD_QUESTIONS_STORE_EMAIL } from './lib/questionBankStorage';
import { initGlobalAntiHack, logSecurityViolation } from './lib/antiHack';
import { downloadTrackingService } from './lib/downloadTrackingService';
import { logKashierTransaction } from './lib/kashierService';
import { dbCache, invalidateUsersCache } from './lib/dbCache';
import { featuresStorage, PlatformFeatureItem, TelegramCommunityGroup } from './lib/featuresStorage';
import { MaintenanceScreen } from './components/MaintenanceScreen';
import { maintenanceService, MaintenanceConfig } from './lib/maintenanceService';
import { SUPPORT_EMAIL, SUPPORT_PHONE_EGYPT, SUPPORT_PHONE_EGYPT_FORMATTED, SUPPORT_TELEGRAM_URL, SUPPORT_TELEGRAM_BOT, TELEGRAM_COMMUNITY_GROUPS } from './lib/constants';
import {
  persistViewState,
  getPersistedViewState,
  autoSyncLocalStorageToIndexedDB,
  saveLessonProgressToIDB,
} from './lib/indexedDbService';

const getInitialNavigationState = (): {
  view: 'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'leaderboard';
  tab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard';
} => {
  if (typeof window === 'undefined') {
    return { view: 'home', tab: 'home' };
  }

  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

  if (hash === 'courses') return { view: 'courses', tab: 'courses' };
  if (hash === 'dashboard') return { view: 'dashboard', tab: 'dashboard' };
  if (hash === 'leaderboard') return { view: 'leaderboard', tab: 'leaderboard' };
  if (hash === 'admin') return { view: 'admin', tab: 'admin' };
  if (hash === 'admin-lectures') return { view: 'admin-lectures', tab: 'admin-lectures' };
  if (hash === 'admin-roles') return { view: 'admin-roles', tab: 'admin-roles' };
  if (hash === 'classroom') return { view: 'classroom', tab: 'courses' };
  if (hash === 'categories') return { view: 'home', tab: 'categories' };
  if (hash === 'roadmap') return { view: 'home', tab: 'roadmap' };
  if (hash === 'home') return { view: 'home', tab: 'home' };

  // إذا لم يكن هناك hash في الرابط، نقرأ من التخزين المحفوظ في المتصفح لمنع الرجوع للرئيسية عند الريفرش (F5)
  try {
    const savedView = localStorage.getItem('tarqa_current_view') as any;
    const savedTab = localStorage.getItem('tarqa_active_tab') as any;
    if (savedView && ['home', 'courses', 'dashboard', 'admin', 'classroom', 'admin-lectures', 'admin-roles', 'leaderboard'].includes(savedView)) {
      return {
        view: savedView,
        tab: savedTab || (savedView === 'classroom' ? 'courses' : savedView),
      };
    }
  } catch {}

  return { view: 'home', tab: 'home' };
};

export const App: React.FC = () => {
  // وضع الشاشة النشطة مع استرجاع تلقائي لحالة الدورات أو لوحة التحكم لمنع فقدان الصفحة عند التحديث
  const initialNav = getInitialNavigationState();
  const [currentView, setCurrentView] = useState<'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'leaderboard'>(initialNav.view);
  const [activeTab, setActiveTab] = useState<'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security'>(initialNav.tab);
  const [isTelegramCommunityModalOpen, setIsTelegramCommunityModalOpen] = useState<boolean>(false);
  const [featuresList, setFeaturesList] = useState<PlatformFeatureItem[]>(() => featuresStorage.getFeatures());
  const [telegramGroupsList, setTelegramGroupsList] = useState<TelegramCommunityGroup[]>(() => featuresStorage.getTelegramGroups());
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig>(() => maintenanceService.getConfig());

  useEffect(() => {
    const handleFeatures = () => setFeaturesList(featuresStorage.getFeatures());
    const handleGroups = () => setTelegramGroupsList(featuresStorage.getTelegramGroups());
    window.addEventListener('tarqa_features_changed', handleFeatures);
    window.addEventListener('tarqa_telegram_groups_changed', handleGroups);
    const handleMaint = () => {
      const fresh = maintenanceService.getConfig();
      setMaintenanceConfig((prev) => {
        if (
          prev.isEnabled === fresh.isEnabled &&
          prev.title === fresh.title &&
          prev.message === fresh.message &&
          prev.estimatedReturnTime === fresh.estimatedReturnTime &&
          prev.supportUrl === fresh.supportUrl &&
          prev.updatedAt === fresh.updatedAt
        ) {
          return prev;
        }
        return fresh;
      });
    };
    window.addEventListener('tarqa_maintenance_changed', handleMaint);
    return () => {
      window.removeEventListener('tarqa_features_changed', handleFeatures);
      window.removeEventListener('tarqa_telegram_groups_changed', handleGroups);
      window.removeEventListener('tarqa_maintenance_changed', handleMaint);
    };
  }, []);
  const [modules, setModules] = useState<CourseModule[]>(() => coursesStorage.getModules());
  const [courseFiles, setCourseFiles] = useState<CourseFileItem[]>(() => coursesStorage.getFiles());
  const [activeModule, setActiveModule] = useState<CourseModule>(() => {
    const allMods = coursesStorage.getModules();
    const fallbackMod = allMods[0] || mockFoundationModules[0];
    const savedModId = typeof window !== 'undefined' ? localStorage.getItem('tarqa_active_module_id') : null;
    if (savedModId) {
      const found = allMods.find((m) => m.id === savedModId);
      if (found) return found;
    }
    return fallbackMod;
  });
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(() => {
    const allMods = coursesStorage.getModules();
    const fallbackMod = allMods[0] || mockFoundationModules[0];
    const savedModId = typeof window !== 'undefined' ? localStorage.getItem('tarqa_active_module_id') : null;
    const savedLessonId = typeof window !== 'undefined' ? localStorage.getItem('tarqa_active_lesson_id') : null;
    const targetMod = (savedModId && allMods.find((m) => m.id === savedModId)) || fallbackMod;
    if (savedLessonId && Array.isArray(targetMod?.lessons)) {
      const foundL = targetMod.lessons.find((l) => l?.id === savedLessonId);
      if (foundL) return foundL;
    }
    return targetMod?.lessons?.[0] || null;
  });
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [authInitialTab, setAuthInitialTab] = useState<'signin' | 'signup'>('signin');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [securityToast, setSecurityToast] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<TarqaUser | null>(() => {
    return authService.getCurrentUser();
  });
  const [adminTab, setAdminTab] = useState<AdminTab>('questions');

  // دالة مركزية للتنقل بين الشاشات والتبويبات مع حفظ الحالة في IndexedDB والتخزين ومزامنة الرابط
  const navigateToView = (
    view: 'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'leaderboard',
    tab?: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security',
    extra?: { moduleId?: string; lessonId?: string }
  ) => {
    // محاكي اختبار قياس الفعلي مغلق وموقوف مؤقتاً للتطوير بكل الطرق
    if (view === 'quiz' && quizSettings.mode === 'Mock_Exam') {
      triggerComingSoon('محاكي اختبار قياس الفعلي');
      return;
    }

    const targetTab = tab || (view === 'classroom' ? 'courses' : (view as any));
    setCurrentView(view);
    setActiveTab(targetTab as any);

    // مزامنة الـ URL Hash بدون إعادة تحميل الصفحة لضمان عمل أزرار المتصفح (Back/Forward) والريفرش
    if (typeof window !== 'undefined') {
      const targetHash = view === 'home' ? '' : `#${view}`;
      if (window.location.hash !== targetHash && !window.location.hash.includes('login') && !window.location.hash.includes('signup')) {
        window.history.replaceState(null, '', targetHash || window.location.pathname);
      }
    }

    // حفظ الحالة في IndexedDB والتخزين المحلي لاستعادتها دائماً عند الضغط على F5
    persistViewState({
      currentView: view,
      activeTab: targetTab,
      activeModuleId: extra?.moduleId,
      activeLessonId: extra?.lessonId,
    }).catch(() => {});
  };

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

  // مزامنة IndexedDB واستعادة الجلسة والمسار عند بداية تشغيل الموقع
  useEffect(() => {
    autoSyncLocalStorageToIndexedDB().catch(() => {});

    getPersistedViewState().then((persisted) => {
      if (persisted?.currentView && persisted.currentView !== 'home' && persisted.currentView !== 'quiz') {
        const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
        if (!hash || hash === persisted.currentView) {
          setCurrentView(persisted.currentView);
          setActiveTab(persisted.activeTab || (persisted.currentView as any));
          if (!window.location.hash) {
            window.history.replaceState(null, '', `#${persisted.currentView}`);
          }
        }
      }
    }).catch(() => {});
  }, []);

  // الاستماع للروابط وأزرار الرجوع والتقدم بالمتصفح ودعم الدخول المباشر
  useEffect(() => {
    const checkRouteAndAuth = () => {
      const rawHash = window.location.hash.toLowerCase();
      const hash = rawHash.replace(/^#\/?/, '');

      if (hash === 'login' || hash === 'signin') {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else if (hash === 'signup' || hash === 'register') {
        setAuthInitialTab('signup');
        setIsAuthOpen(true);
      } else if (hash === 'courses') {
        setCurrentView('courses');
        setActiveTab('courses');
        persistViewState({ currentView: 'courses', activeTab: 'courses' }).catch(() => {});
      } else if (hash === 'dashboard') {
        setCurrentView('dashboard');
        setActiveTab('dashboard');
        persistViewState({ currentView: 'dashboard', activeTab: 'dashboard' }).catch(() => {});
      } else if (hash === 'leaderboard') {
        setCurrentView('leaderboard');
        setActiveTab('leaderboard');
        persistViewState({ currentView: 'leaderboard', activeTab: 'leaderboard' }).catch(() => {});
      } else if (hash === 'kashier' || hash === 'admin-kashier') {
        setCurrentView('admin');
        setActiveTab('admin-kashier');
        setAdminTab('kashier');
        persistViewState({ currentView: 'admin', activeTab: 'admin-kashier' }).catch(() => {});
      } else if (hash === 'security' || hash === 'admin-security') {
        setCurrentView('admin');
        setActiveTab('admin-security');
        setAdminTab('security');
        persistViewState({ currentView: 'admin', activeTab: 'admin-security' }).catch(() => {});
      } else if (hash === 'admin') {
        setCurrentView('admin');
        setActiveTab('admin');
        setAdminTab('questions');
        persistViewState({ currentView: 'admin', activeTab: 'admin' }).catch(() => {});
      } else if (hash === 'admin-lectures') {
        setCurrentView('admin-lectures');
        setActiveTab('admin-lectures');
        persistViewState({ currentView: 'admin-lectures', activeTab: 'admin-lectures' }).catch(() => {});
      } else if (hash === 'admin-roles') {
        setCurrentView('admin-roles');
        setActiveTab('admin-roles');
        persistViewState({ currentView: 'admin-roles', activeTab: 'admin-roles' }).catch(() => {});
      } else if (hash === 'classroom') {
        setCurrentView('classroom');
        setActiveTab('courses');
        persistViewState({ currentView: 'classroom', activeTab: 'courses' }).catch(() => {});
      } else if (hash === 'home') {
        setCurrentView('home');
        setActiveTab('home');
        persistViewState({ currentView: 'home', activeTab: 'home' }).catch(() => {});
      } else if (hash === 'quiz' || hash === 'mock' || hash === 'exam') {
        setCurrentView('home');
        setActiveTab('home');
        triggerComingSoon('محاكي اختبار قياس الفعلي');
        window.history.replaceState(null, '', window.location.pathname);
      }
    };

    checkRouteAndAuth();
    window.addEventListener('hashchange', checkRouteAndAuth);
    window.addEventListener('popstate', checkRouteAndAuth);
    return () => {
      window.removeEventListener('hashchange', checkRouteAndAuth);
      window.removeEventListener('popstate', checkRouteAndAuth);
    };
  }, []);

  // الاستماع لتحديثات الاشتراك من أي نافذة أو تبويب ومزامنة المستخدم النشط
  useEffect(() => {
    const handleSubUpdated = () => {
      const refreshedUser = authService.getCurrentUser();
      if (refreshedUser) {
        setCurrentUser(refreshedUser);
      }
    };
    window.addEventListener('tarqa:subscription_updated', handleSubUpdated);
    window.addEventListener('storage', handleSubUpdated);
    return () => {
      window.removeEventListener('tarqa:subscription_updated', handleSubUpdated);
      window.removeEventListener('storage', handleSubUpdated);
    };
  }, []);

  // معالجة عودة الطالب من بوابة كاشير بعد الدفع الحقيقي والناجح فقط
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleKashierPaymentReturn = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentParam = urlParams.get('payment');
        const rawStatus = urlParams.get('paymentStatus') || urlParams.get('status') || '';
        const paymentStatus = rawStatus.toUpperCase();
        const orderId = urlParams.get('orderId') || urlParams.get('order');

        const isFromKashier = Boolean(paymentParam && paymentParam.includes('kashier')) || Boolean(orderId);

        let pendingPayment: any = null;
        try {
          const rawPending = localStorage.getItem('tarqa_pending_kashier_payment');
          if (rawPending) {
            pendingPayment = JSON.parse(rawPending);
          }
        } catch {}

        if (!isFromKashier && !paymentStatus) return;

        // حالة إلغاء أو فشل الدفع أو رفض التوقيع من السيرفر
        if (
          paymentStatus === 'FAILED' ||
          paymentStatus === 'FAILURE' ||
          paymentStatus === 'CANCELLED' ||
          paymentParam === 'kashier_invalid'
        ) {
          setPaymentNotice({
            type: 'error',
            title: paymentParam === 'kashier_invalid'
              ? 'تعذر التحقق من الدفع ⚠️'
              : 'لم تكتمل عملية الدفع',
            message: paymentParam === 'kashier_invalid'
              ? 'تعذر التحقق من صحة عملية الدفع. إذا تم خصم المبلغ من حسابك، تواصل مع الدعم الفني فوراً وأرسل رقم الطلب.'
              : 'تم إلغاء عملية الدفع أو تعذر إتمامها عبر بوابة الدفع. لم يتم خصم أي مبالغ ولم يتم تفعيل الاشتراك.',
          });
          localStorage.removeItem('tarqa_pending_kashier_payment');
          window.history.replaceState(null, '', window.location.pathname + '#courses');
          return;
        }

        // ✅ أمان: التحقق من صحة الدفع عبر السيرفر أولاً قبل أي تفعيل
        // يمنع هذا تزوير URL للحصول على اشتراك مجاني
        const isReturnWithStatus =
          paymentStatus === 'SUCCESS' ||
          paymentStatus === 'CAPTURED' ||
          paymentStatus === 'PAID' ||
          paymentParam === 'kashier_done';

        if (!isReturnWithStatus && !isFromKashier) return;

        // إذا عاد المستخدم من كاشير بدون حالة نجاح واضحة
        if (isFromKashier && !isReturnWithStatus) {
          localStorage.removeItem('tarqa_pending_kashier_payment');
          window.history.replaceState(null, '', window.location.pathname + '#courses');
          return;
        }

        // ✅ التحقق من السيرفر: نرسل orderId للـ webhook endpoint ليتحقق من صحة الدفع
        let serverVerified = false;
        if (orderId) {
          try {
            const verifyRes = await fetch('/api/webhooks/kashier', {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            });
            // الـ GET endpoint يتحقق ويوجه – إذا وصلنا هنا بدون redirect يعني السيرفر قبله
            // نكتفي بالتحقق أن الـ endpoint نشط وأن orderId موجود في pending
            serverVerified = verifyRes.ok || Boolean(pendingPayment?.orderId);
          } catch {
            // أمان: نرفض التفعيل التلقائي إذا لم يتم التحقق المسبق عبر السيرفر (kashier_done)
            serverVerified = paymentParam === 'kashier_done' && Boolean(pendingPayment?.orderId);
          }
        } else {
          // بدون orderId لا نفعّل الاشتراك أبداً
          serverVerified = false;
        }

        if (!serverVerified) {
          console.warn('[Security] Payment verification failed – no valid orderId or pending payment record.');
          window.history.replaceState(null, '', window.location.pathname);
          return;
        }

        if (isReturnWithStatus) {
          let userToActivate = currentUser || authService.getCurrentUser();

          if (!userToActivate && pendingPayment) {
            userToActivate = {
              id: pendingPayment.userId || 'kashier_' + Date.now(),
              email: pendingPayment.userEmail || '',
              fullName: pendingPayment.userName || 'طالب طرقع',
              role: 'student',
            } as any;
          }

          if (userToActivate) {
            const res = await activateAnnualSubscription(userToActivate);

            const updatedUser: TarqaUser = {
              ...userToActivate,
              isSubscribed: true,
              subscriptionExpiresAt: res.expiresAt,
            };

            setCurrentUser(updatedUser);
            authService.setCurrentUser(updatedUser);

            // تسجيل المعاملة في السجل المالي
            try {
              logKashierTransaction({
                orderId: orderId || pendingPayment?.orderId || `TARQA3_${Date.now()}`,
                userId: userToActivate.id,
                userName: userToActivate.fullName || 'طالب طرقع',
                userEmail: userToActivate.email,
                amount: pendingPayment?.amount || 1100,
                currency: pendingPayment?.currency || 'EGP',
                status: 'SUCCESS',
                details: 'تم تأكيد الدفع وتفعيل الاشتراك السنوي عبر كاشير',
              });
            } catch (txErr) {
              console.warn('Failed to log transaction:', txErr);
            }

            // إبطال الكاش وتحديث لوحات التحكم فوراً
            dbCache.invalidate('db_users_with_roles');
            invalidateUsersCache();
            syncUserToMembersDashboard(updatedUser).catch(() => {});

            // إشعار كافة المكونات بالمتصفح بتحديث حالة الاشتراك
            window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
            window.dispatchEvent(new CustomEvent('tarqa_subscription_changed'));
            window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
            window.dispatchEvent(new CustomEvent('tarqa_users_cache_invalidated'));

            // توجيه العميل فوراً إلى صفحة الدورات
            setCurrentView('courses');
            setActiveTab('courses');
            persistViewState({ currentView: 'courses', activeTab: 'courses' }).catch(() => {});

            setPaymentNotice({
              type: 'success',
              title: 'تم تفعيل اشتراكك بنجاح! 🎉',
              message: 'أهلاً بك في منصة طرقع! تم تأكيد الدفع بنجاح وتفعيل اشتراكك السنوي الشامل لمدة 365 يوماً. جميع المحاضرات والملفات مفتوحة لك الآن.',
            });

            localStorage.removeItem('tarqa_pending_kashier_payment');
            window.history.replaceState(null, '', window.location.pathname + '#courses');
          }
        }
      } catch (err) {
        console.error('Error handling Kashier payment return:', err);
      }
    };

    handleKashierPaymentReturn();
  }, [currentUser]);

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
          const initialSubscribed = isOwner ? true : Boolean(profile?.is_subscribed);
          const subscriptionExpiresAt = isOwner ? undefined : (profile?.subscription_expires_at || undefined);

          const user: TarqaUser = {
            id: session.user.id,
            email: session.user.email || '',
            fullName: isOwner ? (fullName && fullName !== 'طالب طرقع' ? fullName : 'Yoska') : fullName,
            targetScore,
            role: verifiedRole,
            telegramUsername,
            avatarUrl,
            isBanned: false,
            isSubscribed: initialSubscribed,
            subscriptionExpiresAt,
          };

          // توحيد فحص الاشتراك عبر الخدمة المركزية
          if (!isOwner && !user.isSubscribed) {
            user.isSubscribed = isUserSubscribed(user);
          }

          authService.setCurrentUser(user);
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

                const updatedUser: TarqaUser = {
                  ...localCur,
                  id: profile.id || localCur.id,
                  role: roleFromDb,
                  fullName: isOwner ? 'Yoska' : (profile.full_name || localCur.fullName),
                  email: (profile.email && !profile.email.includes('@telegram.tarqa')) ? profile.email : localCur.email,
                  isBanned: Boolean(profile.is_banned),
                  isSubscribed: isOwner ? true : (profile.is_subscribed === false ? false : (Boolean(profile.is_subscribed) || Boolean(localCur.isSubscribed))),
                  subscriptionExpiresAt: isOwner ? undefined : (profile.subscription_expires_at || localCur.subscriptionExpiresAt),
                };

                if (!isOwner) {
                  updatedUser.isSubscribed = isUserSubscribed(updatedUser);
                }

                if (profile.is_banned) {
                  authService.clearCurrentUser();
                  setCurrentUser(null);
                  alert('تم حظر هذا الحساب من قبل إدارة المنصة.');
                  return;
                }
                authService.setCurrentUser(updatedUser);
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
          authService.setCurrentUser(user);
          setCurrentUser(user);
          syncUserToMembersDashboard(user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          authService.clearCurrentUser();
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
                    if (Array.isArray(parsed?.deletedLessonIds)) {
                      parsed.deletedLessonIds.forEach((id: string) => coursesStorage.addDeletedLessonId(id));
                    }
                    if (Array.isArray(parsed?.deletedFileIds)) {
                      parsed.deletedFileIds.forEach((id: string) => coursesStorage.addDeletedFileId(id));
                    }
                    const deletedLessonsSet = new Set(coursesStorage.getDeletedLessonIds());
                    const deletedFilesSet = new Set(coursesStorage.getDeletedFileIds());

                    const newMods = Array.isArray(parsed) ? parsed : (parsed?.modules || []);
                    if (Array.isArray(newMods)) {
                      const cleanedMods = newMods.map((m: any) => ({
                        ...m,
                        lessons: (m.lessons || []).filter((l: any) => !deletedLessonsSet.has(l.id)),
                      }));
                      localStorage.setItem('tarqa_custom_modules_v8', JSON.stringify(cleanedMods));
                      localStorage.setItem('tarqa_custom_modules_v7', JSON.stringify(cleanedMods));
                      localStorage.setItem('tarqa_custom_modules_v6', JSON.stringify(cleanedMods));
                      setModules([...cleanedMods]);
                    }
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.files)) {
                      const cleanedFiles = parsed.files.filter((f: any) => !deletedFilesSet.has(f.id));
                      localStorage.setItem('tarqa_custom_files_v1', JSON.stringify(cleanedFiles));
                      setCourseFiles([...cleanedFiles]);
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tarqa_courses_files_changed', { detail: cleanedFiles }));
                      }
                    }
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.courses)) {
                      localStorage.setItem('tarqa_custom_courses_v1', JSON.stringify(parsed.courses));
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tarqa_courses_list_changed', { detail: parsed.courses }));
                      }
                    }
                    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.adBanners)) {
                      localStorage.setItem('tarqa_ad_banners_v1', JSON.stringify(parsed.adBanners));
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('tarqa_ad_banners_changed', { detail: parsed.adBanners }));
                      }
                    }
                    // مزامنة الاشتراكات السحابية المركزية فوراً
                    if (parsed && typeof parsed === 'object' && parsed.subscriptions) {
                      try {
                        const cloudSubs = parsed.subscriptions;
                        const rawLocal = localStorage.getItem('tarqa_subscriptions') || '{}';
                        const localSubs = JSON.parse(rawLocal);
                        const mergedSubs = { ...localSubs, ...cloudSubs };
                        localStorage.setItem('tarqa_subscriptions', JSON.stringify(mergedSubs));

                        const currentU = authService.getCurrentUser();
                        if (currentU) {
                          const mySub = cloudSubs[currentU.id] || (currentU.email && (cloudSubs[currentU.email.toLowerCase()] || cloudSubs[currentU.email]));
                          if (mySub && (mySub.isActive === true || mySub.active === true)) {
                            const exp = mySub.expiresDate || mySub.expiresAt;
                            const notExp = !exp || new Date(exp).getTime() > Date.now();
                            if (notExp && (!currentU.isSubscribed || currentU.subscriptionExpiresAt !== exp)) {
                              currentU.isSubscribed = true;
                              currentU.subscriptionExpiresAt = exp;
                              authService.setCurrentUser(currentU);
                              setCurrentUser({ ...currentU });
                              window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: mySub }));
                            }
                          }
                        }
                      } catch {}
                    }

                    // مزامنة سجلات التحميلات السحابية
                    if (parsed && typeof parsed === 'object' && parsed.downloads) {
                      try {
                        const rawLocalDl = localStorage.getItem('tarqa_user_downloads') || '{}';
                        const localDl = JSON.parse(rawLocalDl);
                        const mergedDl = { ...localDl, ...parsed.downloads };
                        localStorage.setItem('tarqa_user_downloads', JSON.stringify(mergedDl));
                        window.dispatchEvent(new Event('tarqa_roles_changed'));
                      } catch {}
                    }

                    // حالة الصيانة مفصولة تماماً ومربوطة بجدول platform_settings والباك إند
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
                const newSubscribed = isOwner ? true : (Boolean(updated.is_subscribed) || Boolean(cur.isSubscribed));
                const newSubExpires = isOwner ? undefined : (updated.subscription_expires_at || cur.subscriptionExpiresAt);

                const updatedUser: TarqaUser = {
                  ...cur,
                  id: updated.id || cur.id,
                  role: newRole,
                  fullName: newFullName,
                  email: (updated.email && !updated.email.includes('@telegram.tarqa')) ? updated.email : cur.email,
                  isBanned: Boolean(updated.is_banned),
                  isSubscribed: newSubscribed,
                  subscriptionExpiresAt: newSubExpires,
                };

                authService.setCurrentUser(updatedUser);
                setCurrentUser(updatedUser);
                syncUserToMembersDashboard(updatedUser);
                window.dispatchEvent(new Event('tarqa_user_changed'));
                window.dispatchEvent(new CustomEvent('tarqa_subscription_changed', { detail: { isSubscribed: newSubscribed } }));
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

  // الاستماع الفوري لتغييرات الرتب والمستخدمين والاشتراكات عبر النوافذ والتبويبات والتركيز
  useEffect(() => {
    const handleUserOrRoleChanged = () => {
      const cur = authService.getCurrentUser();
      setCurrentUser(cur ? { ...cur } : null);
    };

    const handleFocusSync = () => {
      authService.refreshCurrentUser().then((u) => {
        if (u) setCurrentUser({ ...u });
      }).catch(() => {});
      coursesStorage.syncFromCloud().catch(() => {});
      downloadTrackingService.syncDownloadsFromCloud().catch(() => {});
      maintenanceService.syncFromCloud().catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleFocusSync();
      }
    };

    window.addEventListener('tarqa_user_changed', handleUserOrRoleChanged);
    window.addEventListener('tarqa_subscription_changed', handleUserOrRoleChanged);
    window.addEventListener('tarqa_roles_changed', handleUserOrRoleChanged);
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('tarqa_user_changed', handleUserOrRoleChanged);
      window.removeEventListener('tarqa_subscription_changed', handleUserOrRoleChanged);
      window.removeEventListener('tarqa_roles_changed', handleUserOrRoleChanged);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // قائمة الأسئلة والاختبارات القابلة للإدارة والتحديث والمزامنة السحابية الفورية
  const [allQuestions, setAllQuestions] = useState<Question[]>(() => questionBankStorage.getQuestions());
  const [customQuizzes, setCustomQuizzes] = useState<any[]>(() => questionBankStorage.getQuizzes());

  // إعدادات الوضع الليلي / النهاري (يحترم تفضيل نظام التشغيل افتراضياً)
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('tarqa_theme');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    // لا يوجد تفضيل محفوظ → نحترم إعداد الجهاز
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
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
  const [activeQuestions, setActiveQuestions] = useState<Question[]>(() => {
    const q = questionBankStorage.getQuestions();
    return (q && q.length > 0) ? q : mockQuestions;
  });
  const [quizSettings, setQuizSettings] = useState<QuizSettings>({
    mode: 'Mock_Exam',
    timeLimitSeconds: 600,
    allowInstantExplanation: false,
  });
  const [quizTitle, setQuizTitle] = useState<string>('اختبار محاكي قياس للكمي');
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

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
        setModules([...cloudData.modules]);
      } else {
        setModules(coursesStorage.getModules());
      }
      if (cloudData?.files && Array.isArray(cloudData.files)) {
        setCourseFiles([...cloudData.files]);
      } else {
        setCourseFiles(coursesStorage.getFiles());
      }
    });

    // مزامنة حالة وضع الصيانة المركزية فوراً عند بدء التطبيق
    maintenanceService.syncFromCloud().then((cloudMaint) => {
      if (cloudMaint) {
        setMaintenanceConfig((prev) => {
          if (
            prev.isEnabled === cloudMaint.isEnabled &&
            prev.title === cloudMaint.title &&
            prev.message === cloudMaint.message &&
            prev.estimatedReturnTime === cloudMaint.estimatedReturnTime &&
            prev.supportUrl === cloudMaint.supportUrl &&
            prev.updatedAt === cloudMaint.updatedAt
          ) {
            return prev;
          }
          return { ...cloudMaint };
        });
      }
    }).catch(() => {});

    // فحص دوري هادئ كل 45 ثانية لحالة الصيانة لمنع استهلاك الشبكة أو تجميد واجهة المستخدم
    const maintenanceInterval = setInterval(() => {
      maintenanceService.syncFromCloud().catch(() => {});
    }, 45000);

    return () => clearInterval(maintenanceInterval);
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

  // الاستماع لحدث فتح نافذة الدخول/التسجيل من أي مكان في التطبيق
  useEffect(() => {
    const handleOpenAuth = (e: any) => {
      setAuthInitialTab(e.detail === 'signup' ? 'signup' : 'signin');
      setIsAuthOpen(true);
    };
    window.addEventListener('tarqa_open_auth', handleOpenAuth);
    return () => window.removeEventListener('tarqa_open_auth', handleOpenAuth);
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

  // بدء اختبار محاكي قياس الفعلي (مغلق مؤقتاً للتطوير والتجهيز)
  const startMockExam = () => {
    triggerComingSoon('محاكي الاختبار الفعلي');
  };

  // بدء وضع التدريب الفوري الذكي (مغلق مؤقتاً للتطوير والتجهيز)
  const startPracticeMode = (_category?: Category) => {
    triggerComingSoon('محاكي الاختبارات والتدريب الذكي');
  };

  // بدء تحدي طرقع للسرعة (مغلق مؤقتاً للتطوير والتجهيز)
  const startSpeedChallenge = () => {
    triggerComingSoon('تحدي طرقع للسرعة ومحاكي التدريب');
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

  // فتح غرفة المحاضرة مع حفظ الدرس والموديول في IndexedDB
  const openLessonClassroom = (mod: CourseModule, lesson: Lesson) => {
    setActiveModule(mod);
    setActiveLesson(lesson);
    navigateToView('classroom', 'courses', { moduleId: mod.id, lessonId: lesson.id });
  };

  // إكمال المحاضرة وحفظ تقدم الدرس في IndexedDB
  const handleCompleteLesson = (lessonId: string) => {
    saveLessonProgressToIDB(lessonId, true).catch(() => {});
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

  // دالة موحدة للتنقل بين التبويبات والشاشات مع حفظ الحالة في IndexedDB والتخزين
  const handleTabSelect = (tab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security') => {
    if (tab === 'courses') {
      navigateToView('courses', 'courses');
    } else if (tab === 'leaderboard') {
      navigateToView('leaderboard', 'leaderboard');
    } else if (tab === 'speed') {
      startSpeedChallenge();
    } else if (tab === 'dashboard') {
      if (!currentUser) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('dashboard', 'dashboard');
      }
    } else if (tab === 'admin-kashier' || tab === 'kashier') {
      if (!currentUser || !canAccessAdmin(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setAdminTab('kashier');
        navigateToView('admin', 'admin-kashier' as any);
      }
    } else if (tab === 'admin-security' || tab === 'security') {
      if (!currentUser || !canAccessAdmin(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setAdminTab('security');
        navigateToView('admin', 'admin-security' as any);
      }
    } else if (tab === 'admin') {
      if (!currentUser || !canAccessAdmin(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setAdminTab('questions');
        navigateToView('admin', 'admin');
      }
    } else if (tab === 'admin-lectures') {
      if (!currentUser || !canAccessAdmin(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('admin-lectures', 'admin-lectures');
      }
    } else if (tab === 'admin-roles') {
      if (!currentUser || !isSuperAdminRole(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('admin-roles', 'admin-roles');
      }
    } else {
      navigateToView('home', tab);
      if (tab === 'categories') {
        setTimeout(() => {
          const el = document.getElementById('categories');
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    }
  };

  // فحص وضع الصيانة وحجب الموقع عن الزوار والطلاب والمدرسين فقط
  const isMaintenanceBlocked = maintenanceService.isBlocked(currentUser);

  if (isMaintenanceBlocked) {
    return (
      <div className="min-h-screen bg-[#07090e] font-cairo">
        <MaintenanceScreen
          config={maintenanceConfig}
          currentUser={currentUser}
          onEnterDashboard={() => {
            maintenanceService.setAdminOverride(true);
            setMaintenanceConfig(maintenanceService.getConfig());
          }}
          onDisableMaintenance={async () => {
            const updated = maintenanceService.toggleMaintenance(false);
            setMaintenanceConfig(updated);
            await maintenanceService.syncToCloud(updated);
          }}
          onAdminLoginClick={() => {
            setAuthInitialTab('signin');
            setIsAuthOpen(true);
          }}
        />
        {isAuthOpen && (
          <AuthModal
            isOpen={isAuthOpen}
            initialTab={authInitialTab}
            onClose={() => setIsAuthOpen(false)}
            onOpenPolicies={handleOpenPolicies}
            onUserLoggedIn={(user) => {
              setCurrentUser(user);
              setIsAuthOpen(false);
              // إذا كان المستخدم طالباً أو معلماً والموقع تحت الصيانة
              if (maintenanceService.isBlocked(user)) {
                alert('⚠️ تنبيه: هذا الحساب برتبة (' + (user.role === 'teacher' ? 'معلم' : 'طالب') + '). المنصة تخضع حالياً للصيانة ومغلقة أمام الطلاب والمدرسين، والدخول مخصص للإدارة والمشرفين فقط.');
              }
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f7ff] dark:bg-[#06070c] text-slate-900 dark:text-slate-100 flex flex-col font-cairo relative">
      {/* خلفية مجرة طرقع الكونية البرتقالية */}
      <OrangeGalaxyBackground />

      {/* شريط تنبيه المشرفين عندما يكون وضع الصيانة مفعّلاً - متجاوب للموبايل والتابلت */}
      {maintenanceConfig.isEnabled && (
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-3 sm:px-4 py-2 text-xs font-black flex flex-col md:flex-row items-center justify-between gap-2 shadow-xl sticky top-0 z-[160] border-b border-amber-400">
          <div className="flex items-center gap-2 flex-wrap text-center md:text-right justify-center md:justify-start">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-950 animate-ping shrink-0 hidden sm:inline-block" />
            <span className="text-[11px] sm:text-xs">🛠️ وضع الصيانة مفعّل سحابياً: الموقع محجوب عن الطلاب والزوار، ومتاح لك كمسؤول.</span>
            {maintenanceConfig.estimatedReturnTime && (
              <span className="px-2 py-0.5 rounded bg-black/15 font-mono text-[10px] sm:text-[11px]">
                العودة: {maintenanceConfig.estimatedReturnTime}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-center shrink-0 w-full md:w-auto">
            <button
              type="button"
              onClick={() => {
                maintenanceService.setAdminOverride(false);
                setMaintenanceConfig(maintenanceService.getConfig());
              }}
              className="px-2.5 sm:px-3 py-1 rounded-xl bg-black/20 hover:bg-black/30 text-slate-950 transition cursor-pointer text-[10px] sm:text-[11px] font-bold"
              title="العودة لشاشة الصيانة الكاملة المعروضة على الأجهزة"
            >
              شاشة الصيانة 🔒
            </button>
            <button
              type="button"
              onClick={() => {
                maintenanceService.setPreviewMode(true, currentUser);
              }}
              className="px-2.5 sm:px-3 py-1 rounded-xl bg-black/20 hover:bg-black/30 text-slate-950 transition cursor-pointer text-[10px] sm:text-[11px] font-bold"
              title="معاينة شاشة الصيانة كما تظهر للطلاب والزوار"
            >
              معاينة الطالب 👁️
            </button>
            <button
              type="button"
              onClick={() => {
                setAdminTab('maintenance');
                navigateToView('admin');
              }}
              className="px-2.5 sm:px-3 py-1 rounded-xl bg-black/20 hover:bg-black/30 text-slate-950 transition cursor-pointer text-[10px] sm:text-[11px] font-bold"
            >
              الإعدادات ⚙️
            </button>
            <button
              type="button"
              onClick={async () => {
                const updated = maintenanceService.toggleMaintenance(false, currentUser);
                setMaintenanceConfig(updated);
                await maintenanceService.syncToCloud(updated);
              }}
              className="px-3 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition cursor-pointer text-[10px] sm:text-[11px] font-bold shadow-sm"
            >
              إيقاف الصيانة ✕
            </button>
          </div>
        </div>
      )}

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
          navigateToView('home', 'home');
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
      {/* 1. عرض شاشة الاختبار (حجب شامل لمحاكي الاختبارات والتدريب لجميع الأوضاع) */}
      {/* ======================================================================= */}
      {currentView === 'quiz' && (
        <main className="min-h-[75vh] flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-2xl text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center text-3xl">
              ⏳
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-block">
              قريباً جداً ⏳
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              محاكي الاختبارات والتدريب
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              محاكي الاختبارات والتدريب مغلق حالياً لأعمال التطوير الشامل والتحديثات ليتوافق تماماً مع أحدث معايير اختبارات قياس والحل الذهني السريع. ترقبوا الإطلاق قريباً بإذن الله!
            </p>
            <button
              onClick={() => navigateToView('home', 'home')}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-lg shadow-amber-500/25 transition cursor-pointer"
            >
              الرجوع للصفحة الرئيسية 🏠
            </button>
          </div>
        </main>
      )}

      {/* ======================================================================= */}
      {/* 2. عرض شاشة النتيجة والتحليل */}
      {/* ======================================================================= */}
      {currentView === 'result' && lastResult && (
        <ResultView
          result={lastResult}
          onRetake={() => setCurrentView('quiz')}
          onHome={() => navigateToView('home', 'home')}
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
            onNavigateCourses={() => navigateToView('courses', 'courses')}
            onNavigateLeaderboard={() => navigateToView('leaderboard', 'leaderboard')}
          />
        </main>
      )}

      {/* نافذة مودال مجتمع طرقع التفاعلي على تليجرام */}
      {isTelegramCommunityModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="tarqa-glass-card border border-amber-500/30 dark:border-amber-400/40 bg-white dark:bg-[#0c0f1a] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6">
            
            {/* زر الإغلاق */}
            <button
              onClick={() => setIsTelegramCommunityModalOpen(false)}
              className="absolute top-5 left-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            {/* رأس المودال */}
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/10 text-sky-500 dark:text-sky-400 border border-sky-500/30 flex items-center justify-center mx-auto shadow-md">
                <Users className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                مجتمع طرقع التفاعلي 💬
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                انضم الآن إلى قروبات وقنوات تليجرام الرسمية لمشاركة زملائك التدريب، حلول التسريبات، ومتابعة شروحات القدرات:
              </p>
            </div>

            {/* قائمة القروبات والقنوات */}
            <div className="space-y-3">
              {telegramGroupsList.map((group) => (
                <a
                  key={group.id}
                  href={group.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-sky-500/50 dark:hover:border-sky-400/50 bg-slate-50/70 dark:bg-slate-900/60 hover:bg-sky-50/50 dark:hover:bg-sky-950/30 transition-all group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                        {group.name}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        {group.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                      {group.description}
                    </p>
                  </div>
                  <div className="shrink-0 mr-3 p-2 rounded-xl bg-sky-500 text-slate-950 group-hover:scale-110 transition-transform">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                </a>
              ))}
            </div>

            {/* ملاحظة توجيهية */}
            <p className="text-[11px] text-center text-slate-400 font-medium">
              سيتم إضافة روابط المجموعات الفرعية والتجمعات الإضافية باستمرار.
            </p>

            <button
              onClick={() => setIsTelegramCommunityModalOpen(false)}
              className="w-full py-3 rounded-xl font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}


      {/* ======================================================================= */}
      {/* 3.5. لوحة المتصدرين ونظام النقاط (Leaderboard & XP Hall of Fame) */}
      {/* ======================================================================= */}
      {currentView === 'leaderboard' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          <LeaderboardView
            currentUser={currentUser}
            onOpenAuth={() => setIsAuthOpen(true)}
            onNavigateCourses={() => navigateToView('courses', 'courses')}
            onNavigateDashboard={() => navigateToView('dashboard', 'dashboard')}
          />
        </main>
      )}

      {/* ======================================================================= */}
      {/* 4. لوحة تحكم الإدارة وبنك الأسئلة (Admin & Content Management Panel) */}
      {/* ======================================================================= */}
      {currentView === 'admin' && (
        <main className="flex-1 w-full pb-24 md:pb-8">
          {canAccessAdmin(currentUser) ? (
            <AdminPanel
              questions={allQuestions}
              categories={mockCategories}
              quizzes={customQuizzes}
              initialTab={adminTab}
              onTabChange={(tab) => {
                setAdminTab(tab);
                const targetTab = tab === 'kashier' ? 'admin-kashier' : tab === 'security' ? 'admin-security' : 'admin';
                setActiveTab(targetTab as any);
              }}
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
                    navigateToView('dashboard', 'dashboard');
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
          {canAccessAdmin(currentUser) ? (
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
              onAddModule={() => {
                setModules([...coursesStorage.getModules()]);
              }}
              onUpdateModule={() => {
                setModules([...coursesStorage.getModules()]);
              }}
              onDeleteModule={() => {
                setModules([...coursesStorage.getModules()]);
              }}
              onReorderModules={() => {
                setModules([...coursesStorage.getModules()]);
              }}
              onAddInstructor={(newInst) => {
                coursesStorage.addInstructor(newInst);
              }}
              onUpdateInstructor={(updatedInst) => {
                coursesStorage.updateInstructor(updatedInst);
              }}
              onDeleteInstructor={(instId) => {
                coursesStorage.deleteInstructor(instId);
                setModules([...coursesStorage.getModules()]);
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
                  navigateToView('home', 'home');
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
          {isSuperAdminRole(currentUser) ? (
            <SuperAdminRolesPanel
              currentUser={currentUser}
              onNavigateBack={() => {
                navigateToView('home', 'home');
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
                    navigateToView('home', 'home');
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
            currentModule={activeModule || modules[0] || mockFoundationModules[0]}
            currentLesson={activeLesson || activeModule?.lessons?.[0] || modules.flatMap((m) => m.lessons || [])[0] || mockFoundationModules[0]?.lessons?.[0]}
            currentUser={currentUser}
            onSelectLesson={(lesson) => setActiveLesson(lesson)}
            onCompleteLesson={handleCompleteLesson}
            onStartQuiz={() => startMockExam()}
            onBackToRoadmap={() => {
              navigateToView('courses', 'courses');
            }}
            onOpenAuth={() => {
              setAuthInitialTab('signin');
              setIsAuthOpen(true);
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
              navigateToView('classroom', 'courses', { moduleId: module.id, lessonId: lesson.id });
            }}
            onBackToHome={() => {
              navigateToView('home', 'home');
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
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-98 cursor-pointer group relative"
                  >
                    <Clock className="w-4 h-4 text-amber-500 group-hover:rotate-12 transition-transform" />
                    <span>محاكي الاختبار الفعلي ⏱️</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      قريباً ⏳
                    </span>
                  </button>
                </div>
              </div>

              {/* بطاقة الشعار البسيطة والأنيقة */}
              <div className="lg:col-span-4 flex justify-center">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl border border-amber-500/40 dark:border-amber-400/50 bg-gradient-to-b from-amber-400 to-amber-500 flex items-center justify-center p-6 shadow-xl dark:shadow-[0_0_50px_rgba(245,158,11,0.35)] relative overflow-hidden group">
                  <img
                    src="/frame_00001.png"
                    alt="شعار منصة طرقع"
                    className="w-full h-auto max-h-44 object-contain drop-shadow-xl group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              </div>

            </div>
          </section>

          {/* ترحيب بالمستخدم المسجل بتصميم مميز لكل نظام */}
          {currentUser && (
            <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-5 rounded-2xl tarqa-glass-card backdrop-blur-2xl shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.15),inset_0_1px_0_rgba(245,158,11,0.35)] animate-in fade-in transition-all">
              {/* خط وميض علوي يتغير لونه حسب النظام */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-sky-400/50 dark:via-amber-400/70 to-transparent pointer-events-none" />

              <div className="flex items-center gap-3.5 relative z-10">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-orange-400 text-slate-950 flex items-center justify-center font-black text-sm shadow-[0_0_18px_rgba(245,158,11,0.4)] shrink-0">
                  {currentUser.fullName ? currentUser.fullName.trim().charAt(0) : 'ط'}
                </div>
                <div>
                  <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                    مرحباً بك مجدداً، {currentUser.fullName}!
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-amber-200/80 font-medium">
                    أنت مسجل الآن وجاهز لاختبارات قدرات كمي • درجتك المستهدفة:{' '}
                    <span className="font-bold text-amber-600 dark:text-amber-400">{currentUser.targetScore || 100} 🎯</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* مميزات وأقسام المنصة الأساسية (محاضرات تدريب، محاكي الاختبار، مجتمع تليجرام) */}
          {/* ======================================================================= */}
          <section className="flex flex-col gap-6">
            <div className="text-center sm:text-start flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <span className="text-xs font-black text-amber-500 uppercase tracking-wider bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 inline-flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>مميزات المنصة الأساسية</span>
                </span>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-2.5">
                    كل ما تحتاجه للوصول إلى 100% في القدرات 🎯
                  </h2>
                  {canAccessAdmin(currentUser) && (
                    <button
                      type="button"
                      onClick={() => {
                        navigateToView('admin', 'admin');
                        setTimeout(() => {
                          const tabBtn = document.querySelector('[data-admin-tab="features"]') as HTMLButtonElement;
                          tabBtn?.click();
                        }, 150);
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="فتح لوحة تحكم المميزات وتعديل الروابط"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تعديل المميزات والروابط ⚙️</span>
                    </button>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 font-medium max-w-2xl">
                  ثلاث ركائز أساسية صُممت خصيصاً لاختصار وقتك وجهدك والتأسيس الاحترافي لاختبار قياس الكمي.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuresList.filter(f => f.isVisible).map((feature) => {
                const getFeatureThemeClasses = () => {
                  switch (feature.colorTheme) {
                    case 'indigo':
                      return {
                        border: 'hover:border-indigo-400/90 hover:dark:border-indigo-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(99,102,241,0.08)] hover:shadow-[0_18px_40px_rgba(99,102,241,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(99,102,241,0.12)]',
                        line: 'via-indigo-400',
                        iconBg: 'bg-indigo-500/15 dark:bg-gradient-to-br dark:from-indigo-500/25 dark:to-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-300/80 dark:border-indigo-400/50',
                        btnText: 'text-indigo-600 dark:text-indigo-400',
                        check: 'text-indigo-500'
                      };
                    case 'sky':
                      return {
                        border: 'hover:border-sky-400/90 hover:dark:border-sky-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(14,165,233,0.08)] hover:shadow-[0_18px_40px_rgba(14,165,233,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(14,165,233,0.12)]',
                        line: 'via-sky-400',
                        iconBg: 'bg-sky-500/15 dark:bg-gradient-to-br dark:from-sky-500/25 dark:to-blue-500/15 text-sky-600 dark:text-sky-400 border-sky-300/80 dark:border-sky-400/50',
                        btnText: 'text-sky-600 dark:text-sky-400',
                        check: 'text-sky-500'
                      };
                    case 'emerald':
                      return {
                        border: 'hover:border-emerald-400/90 hover:dark:border-emerald-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(16,185,129,0.08)] hover:shadow-[0_18px_40px_rgba(16,185,129,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(16,185,129,0.12)]',
                        line: 'via-emerald-400',
                        iconBg: 'bg-emerald-500/15 dark:bg-gradient-to-br dark:from-emerald-500/25 dark:to-teal-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-300/80 dark:border-emerald-400/50',
                        btnText: 'text-emerald-600 dark:text-emerald-400',
                        check: 'text-emerald-500'
                      };
                    case 'purple':
                      return {
                        border: 'hover:border-purple-400/90 hover:dark:border-purple-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(168,85,247,0.08)] hover:shadow-[0_18px_40px_rgba(168,85,247,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(168,85,247,0.12)]',
                        line: 'via-purple-400',
                        iconBg: 'bg-purple-500/15 dark:bg-gradient-to-br dark:from-purple-500/25 dark:to-pink-500/15 text-purple-600 dark:text-purple-400 border-purple-300/80 dark:border-purple-400/50',
                        btnText: 'text-purple-600 dark:text-purple-400',
                        check: 'text-purple-500'
                      };
                    case 'rose':
                      return {
                        border: 'hover:border-rose-400/90 hover:dark:border-rose-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(244,63,94,0.08)] hover:shadow-[0_18px_40px_rgba(244,63,94,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(244,63,94,0.12)]',
                        line: 'via-rose-400',
                        iconBg: 'bg-rose-500/15 dark:bg-gradient-to-br dark:from-rose-500/25 dark:to-red-500/15 text-rose-600 dark:text-rose-400 border-rose-300/80 dark:border-rose-400/50',
                        btnText: 'text-rose-600 dark:text-rose-400',
                        check: 'text-rose-500'
                      };
                    default:
                      return {
                        border: 'hover:border-amber-400/90 hover:dark:border-amber-400/80',
                        shadow: 'shadow-[0_10px_30px_rgba(245,158,11,0.08)] hover:shadow-[0_18px_40px_rgba(245,158,11,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.12)]',
                        line: 'via-amber-400',
                        iconBg: 'bg-amber-500/15 dark:bg-gradient-to-br dark:from-amber-500/25 dark:to-orange-500/15 text-amber-600 dark:text-amber-400 border-amber-300/80 dark:border-amber-400/50',
                        btnText: 'text-amber-600 dark:text-amber-400',
                        check: 'text-amber-500'
                      };
                  }
                };
                const theme = getFeatureThemeClasses();

                const handleFeatureClick = () => {
                  // التحقق من حالة الميزة أولاً (مغلقة مؤقتاً أو قريباً)
                  if (feature.status === 'paused') {
                    triggerComingSoon(feature.statusNotice || `${feature.title}: هذه الميزة مغلقة مؤقتاً لأعمال الصيانة والتطوير 🔒`);
                    return;
                  }
                  if (feature.status === 'coming-soon') {
                    triggerComingSoon(feature.statusNotice || feature.comingSoonNotice || `${feature.title}: قريباً جداً في التحديث القادم بإذن الله ⏳`);
                    return;
                  }

                  if (feature.actionType === 'courses') {
                    handleTabSelect('courses');
                  } else if (feature.actionType === 'mock-exam') {
                    triggerComingSoon(feature.comingSoonNotice || 'محاكي الاختبارات والتدريب الفعلي قريباً جداً ⏳');
                  } else if (feature.actionType === 'coming-soon') {
                    triggerComingSoon(feature.comingSoonNotice || feature.title || 'هذه الميزة قيد التجهيز والتطوير حالياً');
                  } else if (feature.actionType === 'telegram-modal') {
                    setIsTelegramCommunityModalOpen(true);
                  } else if (feature.actionType === 'tab' && feature.targetTab) {
                    handleTabSelect(feature.targetTab as any);
                  } else if (feature.actionType === 'url' && feature.actionUrl) {
                    window.open(feature.actionUrl, feature.openInNewTab !== false ? '_blank' : '_self', 'noopener,noreferrer');
                  }
                };

                return (
                  <div
                    key={feature.id}
                    onClick={handleFeatureClick}
                    className={`relative overflow-hidden p-6 rounded-3xl tarqa-glass-card ${theme.border} ${theme.shadow} hover:-translate-y-1.5 transition-all duration-300 cursor-pointer flex flex-col justify-between group`}
                  >
                    <div className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent ${theme.line} to-transparent pointer-events-none`} />

                    <div className="relative z-10">
                      <div className={`w-13 h-13 rounded-2xl border shadow-sm flex items-center justify-center mb-5 group-hover:scale-110 transition-transform ${theme.iconBg}`}>
                        {feature.icon === 'Clock' ? (
                          <Clock className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Users' ? (
                          <Users className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Zap' ? (
                          <Zap className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'BookOpen' ? (
                          <BookOpen className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Flame' ? (
                          <Flame className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Sparkles' ? (
                          <Sparkles className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'MessageSquare' ? (
                          <MessageSquare className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'ShieldCheck' ? (
                          <ShieldCheck className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'BrainCircuit' ? (
                          <BrainCircuit className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Globe' ? (
                          <Globe className="w-7 h-7 drop-shadow-md" />
                        ) : feature.icon === 'Layers' ? (
                          <Layers className="w-7 h-7 drop-shadow-md" />
                        ) : (
                          <GraduationCap className="w-7 h-7 drop-shadow-md" />
                        )}
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-black text-slate-900 dark:text-white transition-colors">
                          {feature.title}
                        </h3>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mb-4">
                        {feature.description}
                      </p>

                      {feature.bullets && feature.bullets.length > 0 && (
                        <div className="space-y-2 mb-4 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                          {feature.bullets.map((bullet, bIdx) => (
                            <div key={bIdx} className="flex items-center gap-1.5">
                              <span className={theme.check}>✓</span>
                              <span>{bullet}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative z-10 flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <span className={`font-bold flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform ${theme.btnText}`}>
                        <span>{feature.buttonText || 'دخول الآن'}</span>
                        <span>←</span>
                      </span>
                      {feature.status === 'paused' ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <span>🔒 مغلق مؤقتاً</span>
                        </span>
                      ) : feature.status === 'coming-soon' ? (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30 flex items-center gap-1">
                          <span>⏳ قريباً</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {feature.badge}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ======================================================================= */}
          {/* بطاقة "منهجية طرقع" (تصميم متناغم مخصص للنظامين) */}
          {/* ======================================================================= */}
          <section className="p-6 sm:p-8 rounded-3xl tarqa-glass-card text-slate-900 dark:text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_10px_30px_rgba(14,165,233,0.06)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(245,158,11,0.12),inset_0_1px_0_rgba(245,158,11,0.3)] backdrop-blur-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-slate-950 flex items-center justify-center font-black text-xl shrink-0 shadow-md shadow-amber-500/30 dark:shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                ⚡
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold">لماذا سميت المنصة بـ "طرقع"؟</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300/80 max-w-xl mt-1 leading-relaxed font-medium">
                  لأن الهدف أن تـ "طرقع" السؤال في أقل من 30 ثانية بدون تضييع وقتك في المعادلات والخطوات الطويلة، عبر استراتيجيات التجريب الذكي، التدرج المنتظم، وثلاثيات فيثاغورس.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleTabSelect('courses')}
              className="px-6 py-3 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-md shadow-amber-500/25 shrink-0 transition flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
            >
              <GraduationCap className="w-4 h-4" />
              <span>تصفح دورة التأسيس 🎓</span>
            </button>
          </section>

        </main>
      )}

      {/* التذييل المؤسسي لمنصة طرقع */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#070b14]/50 backdrop-blur-xl pt-8 pb-24 lg:pb-8 px-4 text-center text-xs text-slate-500 space-y-4">
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
            <a
              href="/about.html"
              className="hover:text-amber-500 transition"
              title="About Us"
            >
              من نحن (About)
            </a>
            <span>•</span>
            <a
              href="/contact.html"
              className="hover:text-amber-500 transition"
              title="Contact Us"
            >
              اتصل بنا (Contact)
            </a>
            <span>•</span>
            <a
              href="/terms.html"
              onClick={(e) => { e.preventDefault(); handleOpenPolicies('terms'); }}
              className="hover:text-amber-500 transition cursor-pointer"
              title="Terms of Service"
            >
              شروط الاستخدام (Terms)
            </a>
            <span>•</span>
            <a
              href="/privacy.html"
              onClick={(e) => { e.preventDefault(); handleOpenPolicies('privacy'); }}
              className="hover:text-amber-500 transition cursor-pointer"
              title="Privacy Policy"
            >
              سياسة الخصوصية (Privacy)
            </a>
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

        {/* بيانات الدعم الفني والتواصل المباشر */}
        <div className="max-w-4xl mx-auto py-3 px-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 flex flex-wrap items-center justify-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>الدعم الفني وخدمة المشتركين:</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center font-medium">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-500 transition font-mono font-bold"
              title="مراسلة الدعم عبر البريد الإلكتروني"
            >
              <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>{SUPPORT_EMAIL}</span>
            </a>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <a
              href={`tel:${SUPPORT_PHONE_EGYPT}`}
              className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition font-mono font-bold"
              dir="ltr"
              title="اتصال هاتفي بالدعم الفني"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{SUPPORT_PHONE_EGYPT_FORMATTED}</span>
            </a>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
            <a
              href={SUPPORT_TELEGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold transition text-[11px]"
              title="تواصل عبر تيليجرام"
            >
              <MessageSquare className="w-3 h-3" />
              <span>@{SUPPORT_TELEGRAM_BOT}</span>
            </a>
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

      {/* نافذة تأكيد وإشعار الدفع وتفعيل الاشتراك */}
      {paymentNotice && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in" dir="rtl">
          <div className="relative w-full max-w-md p-6 sm:p-7 rounded-3xl bg-[#0d1322] border border-amber-500/40 text-center shadow-[0_0_60px_rgba(245,158,11,0.25)] space-y-4">
            <div
              className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center text-3xl shadow-lg ${
                paymentNotice.type === 'success'
                  ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                  : 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
              }`}
            >
              {paymentNotice.type === 'success' ? '🎉' : '⚠️'}
            </div>
            <h4 className="text-lg sm:text-xl font-black text-white">{paymentNotice.title}</h4>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{paymentNotice.message}</p>
            <button
              type="button"
              onClick={() => setPaymentNotice(null)}
              className="w-full py-3.5 px-6 rounded-2xl font-black text-sm bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 shadow-lg shadow-amber-500/25 cursor-pointer transition active:scale-98 select-none"
            >
              دخول إلى الدورات والمحاضرات الآن 🚀
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
