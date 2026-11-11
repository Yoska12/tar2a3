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
  Wrench,
  Lock,
  Target
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { StudentDashboard } from './components/StudentDashboard';
import { SimulatorHub } from './components/SimulatorHub';
import { StandaloneSimulatorView, SimulatorType } from './components/StandaloneSimulatorView';
import { LeaderboardView } from './components/LeaderboardView';
import { AdminPanel, AdminTab } from './components/AdminPanel';
import { ClassroomView } from './components/ClassroomView';
import { CoursesView } from './components/CoursesView';
import { LecturesCMS } from './components/LecturesCMS';
import { CourseSubscribersDashboard } from './components/CourseSubscribersDashboard';
import { SuperAdminRolesPanel } from './components/SuperAdminRolesPanel';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LegalPoliciesModal, PolicyTab } from './components/LegalPoliciesModal';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { ThemeTransitionOrb } from './components/ThemeTransitionOrb';
import { OrangeGalaxyBackground } from './components/OrangeGalaxyBackground';
import { mockFoundationModules } from './data/foundationModules';
import { CourseModule, Lesson, UserRole, CourseFileItem } from './types';
import { localScoreStorage, authService, TarqaUser, supabase, isSupabaseConfigured, syncUserToMembersDashboard, isValidUuid, isOwnerEmail, callHostingerApi } from './lib/supabase';
import { canAccessAdmin, isSuperAdminRole, canEditCMS, canEditSimulator } from './lib/securityUtils';
import { TELEGRAM_BOT_URL, TELEGRAM_BOT_USERNAME } from './lib/telegram';
import { coursesStorage, CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL, isUserSubscribed, activateAnnualSubscription } from './lib/subscriptionService';
import { courseCommerceService } from './lib/courseCommerceService';
import { initGlobalAntiHack, logSecurityViolation } from './lib/antiHack';
import { downloadTrackingService } from './lib/downloadTrackingService';
import { logKashierTransaction, verifyKashierPaymentSession } from './lib/kashierService';
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
  view: 'home' | 'courses' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'admin-subscribers' | 'leaderboard';
  tab: 'home' | 'courses' | 'categories' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'admin-subscribers' | 'leaderboard';
} => {
  if (typeof window === 'undefined') {
    return { view: 'home', tab: 'home' };
  }

  const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');

  if (hash === 'simulation') {
    if (typeof window !== 'undefined') window.location.href = '/simulation/';
    return { view: 'simulator' as any, tab: 'simulator' as any };
  }
  if (hash === 'exam' || hash === 'level-test') {
    if (typeof window !== 'undefined') window.location.href = '/exam/';
    return { view: 'simulator' as any, tab: 'simulator' as any };
  }
  if (hash === 'tiger') {
    if (typeof window !== 'undefined') window.location.href = '/tiger/';
    return { view: 'simulator' as any, tab: 'simulator' as any };
  }
  if (hash === 'simulator' || hash === 'mo7aky' || hash === 'quiz') return { view: 'simulator' as any, tab: 'simulator' as any };
  if (hash === 'courses') return { view: 'courses', tab: 'courses' };
  if (hash === 'dashboard') return { view: 'dashboard', tab: 'dashboard' };
  if (hash === 'leaderboard') return { view: 'leaderboard', tab: 'leaderboard' };
  if (hash === 'admin') return { view: 'admin', tab: 'admin' };
  if (hash === 'admin-lectures') return { view: 'admin-lectures', tab: 'admin-lectures' };
  if (hash === 'admin-subscribers' || hash === 'subscribers') return { view: 'admin-subscribers', tab: 'admin-subscribers' };
  if (hash === 'admin-roles') return { view: 'admin-roles', tab: 'admin-roles' };
  if (hash === 'classroom') return { view: 'classroom', tab: 'courses' };
  if (hash === 'categories') return { view: 'home', tab: 'categories' };
  if (hash === 'roadmap') return { view: 'home', tab: 'roadmap' };
  if (hash === 'home') return { view: 'home', tab: 'home' };

  // إذا لم يكن هناك hash في الرابط، نقرأ من التخزين المحفوظ في المتصفح لمنع الرجوع للرئيسية عند الريفرش (F5)
  try {
    const savedView = localStorage.getItem('tarqa_current_view') as any;
    const savedTab = localStorage.getItem('tarqa_active_tab') as any;
    if (savedView && ['home', 'courses', 'dashboard', 'admin', 'classroom', 'admin-lectures', 'admin-roles', 'admin-subscribers', 'leaderboard', 'simulator'].includes(savedView)) {
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
  const [currentView, setCurrentView] = useState<'home' | 'courses' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'admin-subscribers' | 'leaderboard' | 'simulator'>((initialNav.view as any) || 'home');
  const [activeTab, setActiveTab] = useState<any>(initialNav.tab);
  const [isTelegramCommunityModalOpen, setIsTelegramCommunityModalOpen] = useState<boolean>(false);
  const [showSimulatorLockedModal, setShowSimulatorLockedModal] = useState<boolean>(false);
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
  const [adminTab, setAdminTab] = useState<AdminTab>('security');

  // دالة مركزية للتنقل بين الشاشات والتبويبات مع حفظ الحالة في IndexedDB والتخزين ومزامنة الرابط
  const navigateToView = (
    view: 'home' | 'courses' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-subscribers' | 'admin-roles' | 'leaderboard',
    tab?: 'home' | 'courses' | 'categories' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-subscribers' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security',
    extra?: { moduleId?: string; lessonId?: string }
  ) => {

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
      if (persisted?.currentView && (persisted.currentView as string) !== 'home') {
        const validViews = ['courses', 'dashboard', 'admin', 'classroom', 'admin-lectures', 'admin-subscribers', 'admin-roles', 'leaderboard'] as const;
        const validTabs = ['home', 'courses', 'categories', 'history', 'dashboard', 'admin', 'roadmap', 'admin-lectures', 'admin-subscribers', 'admin-roles', 'leaderboard', 'admin-kashier', 'admin-security', 'kashier', 'security'] as const;

        if ((validViews as readonly string[]).includes(persisted.currentView)) {
          const hash = window.location.hash.toLowerCase().replace(/^#\/?/, '');
          if (!hash || hash === persisted.currentView) {
            setCurrentView(persisted.currentView as any);
            const targetTab = (persisted.activeTab && (validTabs as readonly string[]).includes(persisted.activeTab))
              ? persisted.activeTab
              : (persisted.currentView as any);
            setActiveTab(targetTab);
            if (!window.location.hash) {
              window.history.replaceState(null, '', `#${persisted.currentView}`);
            }
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
      } else if (hash === 'promo' || hash === 'admin-promo' || hash === 'coupons') {
        setCurrentView('admin');
        setActiveTab('admin-promo');
        setAdminTab('promo');
        persistViewState({ currentView: 'admin', activeTab: 'admin-promo' }).catch(() => {});
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
        setAdminTab('security');
        persistViewState({ currentView: 'admin', activeTab: 'admin' }).catch(() => {});
      } else if (hash === 'admin-lectures') {
        setCurrentView('admin-lectures');
        setActiveTab('admin-lectures');
        persistViewState({ currentView: 'admin-lectures', activeTab: 'admin-lectures' }).catch(() => {});
      } else if (hash === 'admin-subscribers' || hash === 'subscribers') {
        setCurrentView('admin-subscribers');
        setActiveTab('admin-subscribers');
        persistViewState({ currentView: 'admin-subscribers', activeTab: 'admin-subscribers' }).catch(() => {});
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
      } else if (hash === 'simulation') {
        window.location.href = '/simulation/';
      } else if (hash === 'exam' || hash === 'level-test') {
        window.location.href = '/exam/';
      } else if (hash === 'tiger') {
        window.location.href = '/tiger/';
      } else if (hash === 'simulator' || hash === 'mo7aky' || hash === 'quiz') {
        setCurrentView('simulator' as any);
        setActiveTab('simulator' as any);
        persistViewState({ currentView: 'simulator' as any, activeTab: 'simulator' as any }).catch(() => {});
      } else if (hash === 'mock') {
        setCurrentView('home');
        setActiveTab('home');
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
        const href = typeof window !== 'undefined' ? window.location.href : '';
        const search = typeof window !== 'undefined' ? window.location.search : '';

        // 1. استخراج المعاملات بمرونة من كل أجزاء الرابط
        const paymentParamMatch = href.match(/[?&]payment=([^&?#]+)/i);
        const paymentParam = paymentParamMatch ? decodeURIComponent(paymentParamMatch[1]) : null;

        const statusMatch = href.match(/[?&]paymentStatus=([^&?#]+)/i) || href.match(/[?&]status=([^&?#]+)/i);
        let rawStatus = statusMatch ? decodeURIComponent(statusMatch[1]).toUpperCase() : '';

        const orderMatch = href.match(/[?&]orderId=([^&?#]+)/i) || href.match(/[?&]order=([^&?#]+)/i) || href.match(/[?&]merchantOrderId=([^&?#]+)/i);
        const orderId = orderMatch ? decodeURIComponent(orderMatch[1]) : null;

        let pendingPayment: any = null;
        try {
          const rawPending = localStorage.getItem('tarqa_pending_kashier_payment');
          if (rawPending) pendingPayment = JSON.parse(rawPending);
        } catch {}

        let pendingCoursePayment: any = null;
        try {
          const rawCoursePending = localStorage.getItem('tarqa_pending_course_payment');
          if (rawCoursePending) pendingCoursePayment = JSON.parse(rawCoursePending);
        } catch {}

        const isFromKashier = Boolean(paymentParam && paymentParam.includes('kashier')) || Boolean(orderId) || Boolean(statusMatch);

        if (!isFromKashier && !rawStatus && !pendingCoursePayment && !pendingPayment) return;

        // حالة إلغاء أو فشل صريحة
        if (
          rawStatus === 'FAILED' ||
          rawStatus === 'FAILURE' ||
          rawStatus === 'CANCELLED' ||
          paymentParam === 'kashier_invalid' ||
          paymentParam === 'kashier_cancelled'
        ) {
          setPaymentNotice({
            type: 'error',
            title: 'لم تكتمل عملية الدفع',
            message: 'تم إلغاء عملية الدفع أو تعذر إتمامها عبر بوابة كاشير. لم يتم خصم أي مبالغ ولم يتم تفعيل أي اشتراك.',
          });
          localStorage.removeItem('tarqa_pending_kashier_payment');
          localStorage.removeItem('tarqa_pending_course_payment');
          window.history.replaceState(null, '', window.location.pathname + '#courses');
          return;
        }

        // فحص هل الحالة تدل على نجاح العملية
        let isReturnWithStatus =
          rawStatus === 'SUCCESS' ||
          rawStatus === 'CAPTURED' ||
          rawStatus === 'PAID';

        // التحقق الآلي من كاشير عبر معرف الجلسة للتأكد من نجاح الدفع
        const targetSessionId = pendingCoursePayment?.sessionId || pendingPayment?.sessionId;
        if (targetSessionId && !isReturnWithStatus) {
          try {
            const vRes = await verifyKashierPaymentSession(targetSessionId);
            if (vRes.success && (vRes.status === 'SUCCESS' || vRes.status === 'CAPTURED' || vRes.status === 'PAID')) {
              isReturnWithStatus = true;
              rawStatus = 'SUCCESS';
            }
          } catch (e) {
            console.warn('[Kashier] verifySession check notice:', e);
          }
        }

        // إذا عاد المستخدم من رابط إتمام كاشير الرسمي ولم تكن هناك حالة فشل
        if (paymentParam === 'kashier_done' && rawStatus !== 'FAILED' && rawStatus !== 'CANCELLED') {
          isReturnWithStatus = true;
        }

        if (isReturnWithStatus) {
          let userToActivate = currentUser || authService.getCurrentUser();

          if (!userToActivate) {
            const fallback = pendingCoursePayment || pendingPayment;
            if (fallback) {
              userToActivate = {
                id: fallback.userId || 'kashier_' + Date.now(),
                email: fallback.userEmail || '',
                fullName: fallback.userName || 'طالب طرقع',
                role: 'student',
              } as any;
            }
          }

          if (userToActivate) {
            // 1. تفعيل الدورة المستقلة وتوليد الإيصال بالسيرفر
            if (pendingCoursePayment) {
              await courseCommerceService.confirmCoursePayment({
                order_id: orderId || pendingCoursePayment.orderId,
                course_id: pendingCoursePayment.courseId,
                course_title: pendingCoursePayment.courseTitle,
                user_id: pendingCoursePayment.userId || userToActivate.id,
                user_name: pendingCoursePayment.userName || userToActivate.fullName,
                user_email: pendingCoursePayment.userEmail || userToActivate.email,
                user_phone: pendingCoursePayment.userPhone,
                currency: pendingCoursePayment.currency || 'EGP',
                promo_code: pendingCoursePayment.promoCode,
                payment_method: 'kashier',
              }).catch(() => {});

              // حفظ محلي فوري للاشتراك لفتح الدورة دون انتظار أي جلب إضافي
              try {
                const raw = localStorage.getItem('tarqa_course_subscriptions') || '{}';
                const subs = JSON.parse(raw);
                const uId = pendingCoursePayment.userId || userToActivate.id;
                const cId = pendingCoursePayment.courseId;
                const subObj = {
                  courseId: cId,
                  userId: uId,
                  isActive: true,
                  status: 'active',
                  expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                  enrolledAt: new Date().toISOString(),
                };
                subs[`${uId}_${cId}`] = subObj;
                subs[`${cId}_${uId}`] = subObj;
                if (userToActivate.email) {
                  subs[`${userToActivate.email.toLowerCase()}_${cId}`] = subObj;
                  subs[`${cId}_${userToActivate.email.toLowerCase()}`] = subObj;
                }
                localStorage.setItem('tarqa_course_subscriptions', JSON.stringify(subs));
              } catch {}

              localStorage.removeItem('tarqa_pending_course_payment');
            }

            // 2. تفعيل اشتراك الموقع العام للمستخدم لمدة سنة كاملة
            const res = await activateAnnualSubscription(userToActivate);

            const updatedUser: TarqaUser = {
              ...userToActivate,
              isSubscribed: true,
              subscriptionExpiresAt: res.expiresAt,
            };

            setCurrentUser(updatedUser);
            authService.setCurrentUser(updatedUser);

            // 3. تحديث قاعدة بيانات هوستينجر المركزية وملف الاشتراكات في السيرفر فوراً
            await callHostingerApi('update_subscription', {
              userId: userToActivate.id,
              target_user_id: userToActivate.id,
              email: userToActivate.email,
              user_email: userToActivate.email,
              is_subscribed: 1,
              period: 'annual',
              expires_at: res.expiresAt ? res.expiresAt.slice(0, 19).replace('T', ' ') : null,
            }).catch(() => {});

            try {
              await fetch('/api/subscriptions.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'grant',
                  userId: userToActivate.id,
                  userEmail: userToActivate.email,
                  userName: userToActivate.fullName,
                  days: 365,
                }),
              });
            } catch {}

            // توثيق إيصال الدفع العام في قاعدة البيانات إذا لم تكن دورة خاصة
            if (!pendingCoursePayment) {
              await courseCommerceService.confirmCoursePayment({
                order_id: orderId || pendingPayment?.orderId || `TARQA3_${Date.now()}`,
                course_id: 'annual_subscription',
                course_title: 'اشتراك طرقع السنوي الشامل',
                user_id: userToActivate.id,
                user_name: userToActivate.fullName || 'طالب طرقع',
                user_email: userToActivate.email,
                currency: pendingPayment?.currency || 'EGP',
                payment_method: 'kashier',
              }).catch(() => {});
            }

            // 4. تسجيل المعاملة في السجل المالي
            try {
              logKashierTransaction({
                orderId: orderId || pendingPayment?.orderId || `TARQA3_${Date.now()}`,
                userId: userToActivate.id,
                userName: userToActivate.fullName || 'طالب طرقع',
                userEmail: userToActivate.email,
                amount: pendingCoursePayment?.amount || pendingPayment?.amount || 1100,
                currency: pendingCoursePayment?.currency || pendingPayment?.currency || 'EGP',
                status: 'SUCCESS',
                details: 'تم تأكيد الدفع وتفعيل الاشتراك بنجاح عبر كاشير',
              });
            } catch (txErr) {
              console.warn('Failed to log transaction:', txErr);
            }

            // 5. إبطال الكاش وتحديث جميع اللوحات والواجهات
            dbCache.invalidate('db_users_with_roles');
            invalidateUsersCache();
            syncUserToMembersDashboard(updatedUser).catch(() => {});

            window.dispatchEvent(new CustomEvent('tarqa:subscription_updated'));
            window.dispatchEvent(new CustomEvent('tarqa_subscription_changed'));
            window.dispatchEvent(new CustomEvent('tarqa_course_subscription_updated', {
              detail: { courseId: pendingCoursePayment?.courseId || 'course-foundation', userId: userToActivate.id, isActive: true }
            }));
            window.dispatchEvent(new CustomEvent('tarqa_roles_changed'));
            window.dispatchEvent(new CustomEvent('tarqa_users_cache_invalidated'));

            // توجيه العميل فوراً إلى صفحة الدورات
            setCurrentView('courses');
            setActiveTab('courses');
            persistViewState({ currentView: 'courses', activeTab: 'courses' }).catch(() => {});

            setPaymentNotice({
              type: 'success',
              title: 'تم تفعيل اشتراكك بنجاح! 🎉',
              message: 'أهلاً بك في منصة طرقع! تم تأكيد الدفع بنجاح وتفعيل دورتك واشتراكك بالكامل. جميع المحاضرات والملفات مفتوحة لك الآن.',
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
      supabase.auth.getSession().then(async ({ data: { session } }: any) => {
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
          // فحص ما إذا كان هناك مستخدم مسجل محلياً والتحقق من رتبته في السيرفر وقاعدة البيانات
          const localCur = authService.getCurrentUser();
          if (localCur && (localCur.email || localCur.telegramUsername || localCur.id)) {
            try {
              let profile: any = null;
              const cleanTg = (localCur.telegramUsername || '').replace(/^@/, '').trim();

              // 1. التحقق أولاً من قاعدة بيانات هوستينجر المركزية (Hostinger MySQL Backend)
              try {
                const hostRes = await callHostingerApi('get_user_role', {
                  userId: localCur.id,
                  email: localCur.email,
                  telegram_id: localCur.telegramId,
                  telegram_username: cleanTg
                });

                // إذا كان الحساب محظوراً بشكل صريح في قاعدة البيانات
                if (
                  hostRes &&
                  hostRes.httpStatus === 403 &&
                  (hostRes.isBanned === true || hostRes.user?.isBanned === true)
                ) {
                  authService.clearCurrentUser();
                  setCurrentUser(null);
                  try {
                    localStorage.removeItem('tarqa_current_user');
                    localStorage.removeItem('tarqa_subscriptions');
                    localStorage.removeItem('tarqa_course_subscriptions');
                  } catch {}
                  alert(`تم حظر هذا الحساب من قبل إدارة المنصة.${hostRes.banReason || hostRes.user?.banReason ? `\nسبب الحظر: ${hostRes.banReason || hostRes.user?.banReason}` : ''}`);
                  return;
                }

                // إذا كان الحساب محذوفاً نهائياً بشكل صريح ومؤكد (httpStatus 404)
                if (
                  hostRes &&
                  hostRes.isDeleted === true &&
                  hostRes.httpStatus === 404
                ) {
                  authService.clearCurrentUser();
                  setCurrentUser(null);
                  try {
                    localStorage.removeItem('tarqa_current_user');
                    localStorage.removeItem('tarqa_subscriptions');
                    localStorage.removeItem('tarqa_course_subscriptions');
                  } catch {}
                  alert('تم حذف هذا الحساب نهائياً من قبل إدارة المنصة.');
                  return;
                }

                if (hostRes && hostRes.success && hostRes.user) {
                  profile = hostRes.user;
                }
              } catch (e) {
                console.warn('Hostinger role verification fallback:', e);
              }

              // 2. فحص Supabase كاحتياطي ثانوي فقط إذا كان مهيأ ولم نجد ملف هوستينجر
              if (!profile && isSupabaseConfigured) {
                if (localCur.id && isValidUuid(localCur.id)) {
                  const { data: pById } = await supabase.from('profiles').select('*').eq('id', localCur.id).maybeSingle();
                  if (pById) profile = pById;
                }

                if (!profile && localCur.email && !localCur.email.includes('@telegram.tarqa') && !localCur.email.includes('@user.tarqa')) {
                  const { data: pByEmail } = await supabase.from('profiles').select('*').eq('email', localCur.email.toLowerCase()).maybeSingle();
                  if (pByEmail) profile = pByEmail;
                }

                if (!profile && localCur.telegramId) {
                  const { data: pByTgId } = await supabase.from('profiles').select('*').eq('telegram_id', localCur.telegramId).maybeSingle();
                  if (pByTgId) profile = pByTgId;
                }

                if (!profile && cleanTg) {
                  const { data: pByTgName } = await supabase.from('profiles').select('*').or(`telegram_username.eq.${cleanTg},telegram_username.eq.@${cleanTg},telegram_username.ilike.%${cleanTg}%`).maybeSingle();
                  if (pByTgName) profile = pByTgName;
                }
              }

              if (profile) {
                const isOwner = isOwnerEmail(localCur.email) || (profile.email && isOwnerEmail(profile.email));
                const dbRole = (profile.role as UserRole) || 'student';
                const roleFromDb: UserRole = isOwner ? 'super_admin' : dbRole;

                const isSubscribedFromDb = isOwner ? true : (profile.isSubscribed === false ? false : Boolean(profile.isSubscribed || profile.is_subscribed));

                const updatedUser: TarqaUser = {
                  ...localCur,
                  id: profile.id || localCur.id,
                  role: roleFromDb,
                  fullName: isOwner ? 'Yoska' : (profile.fullName || profile.full_name || localCur.fullName),
                  email: (profile.email && !profile.email.includes('@telegram.tarqa')) ? profile.email : localCur.email,
                  isBanned: Boolean(profile.isBanned || profile.is_banned),
                  isSubscribed: isSubscribedFromDb,
                  subscriptionExpiresAt: isOwner ? undefined : (profile.subscriptionExpiresAt || profile.subscription_expires_at),
                };

                if (!isOwner) {
                  if (!isSubscribedFromDb) {
                    updatedUser.isSubscribed = false;
                    try {
                      const rawSubs = localStorage.getItem('tarqa_subscriptions');
                      if (rawSubs) {
                        const subs = JSON.parse(rawSubs);
                        if (localCur.id) delete subs[localCur.id];
                        if (localCur.email) delete subs[localCur.email.toLowerCase().trim()];
                        localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));
                      }
                      localStorage.removeItem('tarqa_course_subscriptions');
                    } catch {}
                  } else {
                    updatedUser.isSubscribed = isUserSubscribed(updatedUser);
                  }
                }

                if (profile.isBanned || profile.is_banned) {
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
            }
            authService.setCurrentUser(localCur);
            setCurrentUser(localCur);
          } else {
            setCurrentUser(null);
            localStorage.removeItem('tarqa_current_user');
          }
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
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
        if (u) {
          setCurrentUser({ ...u });
        } else if (authService.getCurrentUser() === null) {
          setCurrentUser(null);
        }
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

    // مزامنة دورية كل 20 ثانية لضمان رصد أي حظر أو حذف أو إلغاء اشتراك فوري
    const syncInterval = setInterval(() => {
      coursesStorage.syncFromCloud().catch(() => {});
      authService.refreshCurrentUser().then((u) => {
        if (!u && authService.getCurrentUser() === null) {
          setCurrentUser(null);
        }
      }).catch(() => {});
    }, 20000);

    return () => {
      window.removeEventListener('tarqa_user_changed', handleUserOrRoleChanged);
      window.removeEventListener('tarqa_subscription_changed', handleUserOrRoleChanged);
      window.removeEventListener('tarqa_roles_changed', handleUserOrRoleChanged);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(syncInterval);
    };
  }, []);

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

  // الاستماع لحدث فتح نافذة الدخول/التسجيل من أي مكان في التطبيق
  useEffect(() => {
    const handleOpenAuth = (e: any) => {
      setAuthInitialTab(e.detail === 'signup' ? 'signup' : 'signin');
      setIsAuthOpen(true);
    };
    window.addEventListener('tarqa_open_auth', handleOpenAuth);
    return () => window.removeEventListener('tarqa_open_auth', handleOpenAuth);
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
  const handleTabSelect = (tab: any) => {
    if (tab === 'courses') {
      navigateToView('courses', 'courses');
    } else if (tab === 'leaderboard') {
      navigateToView('leaderboard', 'leaderboard');
    } else if (tab === 'simulation') {
      window.location.href = '/simulation/';
    } else if (tab === 'exam') {
      window.location.href = '/exam/';
    } else if (tab === 'tiger') {
      window.location.href = '/tiger/';
    } else if (tab === ('simulator' as any) || (tab as any) === 'mo7aky') {
      setCurrentView('simulator' as any);
      setActiveTab('simulator' as any);
      window.history.replaceState(null, '', '#simulator');
      persistViewState({ currentView: 'simulator' as any, activeTab: 'simulator' as any }).catch(() => {});
    } else if (tab === 'dashboard') {
      if (!currentUser) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('dashboard', 'dashboard');
      }
    } else if (tab === 'admin-promo' || tab === 'promo') {
      if (!currentUser || !canAccessAdmin(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        setAdminTab('promo');
        navigateToView('admin', 'admin-promo' as any);
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
        setAdminTab('security');
        navigateToView('admin', 'admin');
      }
    } else if (tab === 'admin-lectures') {
      if (!currentUser || !canEditCMS(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('admin-lectures', 'admin-lectures');
      }
    } else if (tab === 'admin-subscribers') {
      if (!currentUser || !canEditCMS(currentUser)) {
        setAuthInitialTab('signin');
        setIsAuthOpen(true);
      } else {
        navigateToView('admin-subscribers', 'admin-subscribers');
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
      {/* 3. لوحة تحكم الطالب (Student Dashboard) */}
      {/* ======================================================================= */}
      {currentView === 'dashboard' && (
        <main className="flex-1 w-full pb-24 lg:pb-8">
          <StudentDashboard
            currentUser={currentUser}
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
        <main className="flex-1 w-full pb-24 lg:pb-8">
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
        <main className="flex-1 w-full pb-24 lg:pb-8">
          {canAccessAdmin(currentUser) ? (
            <AdminPanel
              initialTab={adminTab}
              onTabChange={(tab) => {
                setAdminTab(tab);
                const targetTab = tab === 'kashier' ? 'admin-kashier' : tab === 'security' ? 'admin-security' : tab === 'promo' ? 'admin-promo' : 'admin';
                setActiveTab(targetTab as any);
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
                  حسابك الحالي مسجل بدور <strong className="text-amber-500">[{currentUser?.role === 'student' ? 'طالب' : 'غير مسجل'}]</strong>، ولا يمتلك صلاحية الوصول للوحة الإدارة والتحكم.
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
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 pb-24 lg:pb-8">
          {(canAccessAdmin(currentUser) || canEditCMS(currentUser)) ? (
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
                await coursesStorage.syncToCloud(modules, courseFiles);
                const cloudData = await coursesStorage.syncFromCloud();
                if (cloudData?.modules && Array.isArray(cloudData.modules)) {
                  setModules([...cloudData.modules]);
                }
                if (cloudData?.files && Array.isArray(cloudData.files)) {
                  setCourseFiles([...cloudData.files]);
                }
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
                هذه اللوحة مخصصة فقط للمشرفين والمعلمين ومحرري المحتوى (E.CMS).
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
      {/* 5.2. لوحة مشتركي الدورات التدريبية المخصصة (Course Subscribers Dashboard) */}
      {/* ======================================================================= */}
      {currentView === 'admin-subscribers' && (
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 pb-24 lg:pb-8">
          {(canAccessAdmin(currentUser) || canEditCMS(currentUser)) ? (
            <CourseSubscribersDashboard
              onBack={() => navigateToView('admin-lectures', 'admin-lectures')}
            />
          ) : (
            <div className="max-w-2xl mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center mx-auto text-3xl">
                👥
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">
                منطقة محظورة: مشتركو الدورات
              </h3>
              <p className="text-xs text-slate-400">
                هذه اللوحة مخصصة فقط للمسؤولين والمعلمين ومحرري الدورات التدريبية (E.CMS).
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
        <main className="flex-1 w-full pb-24 lg:pb-8">
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
        <main className="flex-1 w-full pb-24 lg:pb-8">
          <ClassroomView
            currentModule={activeModule || modules[0] || mockFoundationModules[0]}
            currentLesson={activeLesson || activeModule?.lessons?.[0] || modules.flatMap((m) => m.lessons || [])[0] || mockFoundationModules[0]?.lessons?.[0]}
            currentUser={currentUser}
            onSelectLesson={(lesson) => setActiveLesson(lesson)}
            onCompleteLesson={handleCompleteLesson}
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
        <main className="flex-1 w-full pb-24 lg:pb-8">
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
            onOpenPolicies={handleOpenPolicies}
          />
        </main>
      )}

            {/* ======================================================================= */}
      {/* 6.6. مركز محاكي قياس وتحديد المستوى (Dedicated Simulator Hub Page) */}
      {/* ======================================================================= */}
      {currentView === 'simulator' && (
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-24 lg:pb-8 flex flex-col gap-4 font-cairo" dir="rtl">
          {/* عنوان الصفحة المدمج مع شارة الحالة */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
            <div className="text-right space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
                  <Lock className="w-3.5 h-3.5" />
                  <span>منظومة المحاكيات</span>
                </span>
                {canAccessAdmin(currentUser) ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black">
                    🛡️ متاح للمسؤولين فقط
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                    قريباً للطلاب ⏳
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">اختر المحاكي المطلوب</h2>
              <p className="text-xs text-slate-400">
                {canAccessAdmin(currentUser)
                  ? 'بصفتك مسؤولاً، يمكنك الدخول لأي محاكي وتجربته وتعديل بنك الأسئلة الخاص به بحرية.'
                  : 'المحاكيات تحت التحديث الشامل وإعادة الهيكلة وستتوفر قريباً لجميع الطلاب.'}
              </p>
            </div>

            {canAccessAdmin(currentUser) && (
              <a
                href="/simulation/?questions=true&admin=true"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20 shrink-0 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>إدارة وبنك أسئلة المحاكي 📝</span>
              </a>
            )}
          </div>

          {/* شبكة كروت المحاكيات الثلاثة بتصميم عصري فخم */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* 1. كرت تحديد المستوى (البرتقالي) */}
            <div className="relative group overflow-hidden rounded-3xl border-2 border-amber-500/30 hover:border-amber-400/80 bg-gradient-to-b from-[#1a150b] via-[#141008] to-[#080d1a] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:shadow-2xl hover:shadow-amber-500/15 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {canAccessAdmin(currentUser) ? '🛡️ مفتوح للمسؤول' : 'تشخيص ذكي • قريباً ⏳'}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shadow-amber-500/20">
                    <Target className="w-6 h-6 text-amber-400" />
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-lg text-white group-hover:text-amber-300 transition-colors">
                    تحديد المستوى
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    اختبار تشخيصي دقيق لتحديد مستواك الحقيقي في القدرات واكتشاف نقاط القوة والضعف.
                  </p>
                </div>

                {/* مميزات المحاكي */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">🧠 تشخيص فوري</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">⚡ مجاني 100%</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">📈 خطة مذاكرة</span>
                </div>
              </div>

              {/* أزرار الإجراء */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                {canAccessAdmin(currentUser) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="/exam/?admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition text-center flex items-center justify-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5" />
                      <span>دخول كمسؤول</span>
                    </a>
                    <a
                      href="/exam/?questions=true&admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 font-bold text-xs transition text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>تعديل الأسئلة</span>
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSimulatorLockedModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 text-amber-400 border border-amber-500/30 font-bold text-xs transition flex items-center justify-between cursor-pointer hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>مقفول للطلاب - قريباً ⏳</span>
                    </span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. كرت محاكي الطرقعة الشامل (الأزرق) */}
            <div className="relative group overflow-hidden rounded-3xl border-2 border-sky-500/30 hover:border-sky-400/80 bg-gradient-to-b from-[#101a2e] via-[#0c1424] to-[#080d1a] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:shadow-2xl hover:shadow-sky-500/15 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400 to-transparent pointer-events-none" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {canAccessAdmin(currentUser) ? '🛡️ مفتوح للمسؤول' : 'الأكثر طلباً • قريباً ⏳'}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shadow-sky-500/20">
                    <Zap className="w-6 h-6 text-sky-400 fill-sky-400/20" />
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-lg text-white group-hover:text-sky-300 transition-colors">
                    محاكي الطرقعة الشامل
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    واجهة قياس محوسب أصلية، تدريب كمي ولفظي موقوت، وحساب دقيق للنسبة المئوية مع حفظ النتائج.
                  </p>
                </div>

                {/* مميزات المحاكي */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">⏱️ توقيت حقيقي</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">📊 كمي ولفظي</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">💾 حفظ الدرجات</span>
                </div>
              </div>

              {/* أزرار الإجراء */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                {canAccessAdmin(currentUser) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="/simulation/?admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs transition text-center flex items-center justify-center gap-1 shadow-md shadow-sky-500/20 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      <span>دخول كمسؤول</span>
                    </a>
                    <a
                      href="/simulation/?questions=true&admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 border border-sky-500/30 font-bold text-xs transition text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>تعديل الأسئلة</span>
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSimulatorLockedModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 text-sky-400 border border-sky-500/30 font-bold text-xs transition flex items-center justify-between cursor-pointer hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>مقفول للطلاب - قريباً ⏳</span>
                    </span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. كرت محاكي وتجميعات نمر */}
            <div className="relative group overflow-hidden rounded-3xl border-2 border-emerald-500/30 hover:border-emerald-400/80 bg-gradient-to-b from-[#0f1f1d] via-[#0c1619] to-[#080d1a] p-5 sm:p-6 flex flex-col justify-between gap-5 transition-all duration-300 hover:shadow-2xl hover:shadow-emerald-500/15 hover:-translate-y-1">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent pointer-events-none" />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {canAccessAdmin(currentUser) ? '🛡️ مفتوح للمسؤول' : 'تجميعات نمر • قريباً ⏳'}
                  </span>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner shadow-emerald-500/20 text-2xl">
                    🐅
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-lg text-white group-hover:text-emerald-300 transition-colors">
                    محاكي واختبارات نمر
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    تدريب مكثف على أحدث صيغ النماذج المقفلة وأسئلة قياس الأكثر تكراراً لعام 1446-1447.
                  </p>
                </div>

                {/* مميزات المحاكي */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">🐅 نماذج نمر</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">🔥 الأكثر تكراراً</span>
                  <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">⭐ 1446-1447</span>
                </div>
              </div>

              {/* أزرار الإجراء */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                {canAccessAdmin(currentUser) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href="/tiger/?admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition text-center flex items-center justify-center gap-1 shadow-md shadow-emerald-500/20 cursor-pointer"
                    >
                      <span>دخول كمسؤول</span>
                      <span>🐅</span>
                    </a>
                    <a
                      href="/tiger/?questions=true&admin=true"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition text-center flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>تعديل الأسئلة</span>
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSimulatorLockedModal(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-800/90 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition flex items-center justify-between cursor-pointer hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>مقفول للطلاب - قريباً ⏳</span>
                    </span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </main>
      )}

      {/* مودال إشعار قفل المحاكي (Coming Soon Modal) */}
      {showSimulatorLockedModal && (
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-cairo" dir="rtl">
          <div className="bg-[#0b101e] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center flex flex-col items-center gap-5 shadow-2xl shadow-amber-500/20 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-3xl">
              ⏳
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black">
                <Lock className="w-3.5 h-3.5" />
                <span>المحاكي مقفول حالياً</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">سيتوفر قريباً جداً!</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                نقوم حالياً بتطوير منظومة المحاكيات الثلاثة ودمج أحدث بنوك الأسئلة والنماذج الرسمية لعام 1446-1447 لضمان تجربة قياس دقيقة وسلسة وسنعلن عن الإطلاق قريباً!
              </p>
            </div>
            <button
              onClick={() => setShowSimulatorLockedModal(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm transition shadow-lg shadow-amber-500/25 cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 7. الصفحة الرئيسية (Clean, Minimalist & Spacious) */}
      {/* ======================================================================= */}
      {currentView === 'home' && (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-12 sm:gap-16 pb-24 lg:pb-12">

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
                  منصة تأسيس وشروحات ذكية لقدرات الكمي مع استراتيجيات "طرقع" للحل الذهني السريع بدون معادلات معقدة.
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
                    onClick={() => handleTabSelect('simulator')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-black text-sm bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/25 transition-all transform hover:-translate-y-0.5 active:scale-98 cursor-pointer group"
                  >
                    <Zap className="w-4 h-4 fill-current text-amber-300 group-hover:scale-110 transition-transform" />
                    <span>محاكي قياس وتحديد المستوى ⚡</span>
                  </button>
                  <button
                    onClick={() => handleTabSelect('leaderboard')}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl font-bold text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm transition-all active:scale-98 cursor-pointer group relative"
                  >
                    <Users className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                    <span>لوحة الأبطال والمتصدرين 🏆</span>
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
          {/* قسم محاكي قياس التفاعلي والاختبارات (Interactive Simulator Section) */}
          {/* ======================================================================= */}
          <section className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-br from-slate-900/90 via-[#0b1220]/95 to-slate-950/90 border border-amber-500/30 shadow-2xl backdrop-blur-2xl">
            {/* زخرفة خلفية */}
            <div className="absolute top-0 right-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent pointer-events-none" />

            <div className="relative z-10 flex flex-col gap-6">
              
              {/* الرأس */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-black">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>محاكي قياس الذكي • مباشر وسريع</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    جرّب بيئة اختبار قياس الحقيقية قبل دخول الاختبار 🎯
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium">
                    واجهة مطابقة بنسبة 100% لاختبار قياس المحوسب، توقيت دقيق، أسئلة كمي ولفظي معتمدة، وحفظ مباشر لدرجاتك وسجل اختباراتك.
                  </p>
                </div>

                <button
                  onClick={() => {
                    if (!canAccessAdmin(currentUser)) {
                      setShowSimulatorLockedModal(true);
                    } else {
                      handleTabSelect('simulator');
                    }
                  }}
                  className="self-start sm:self-center flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 shrink-0 cursor-pointer"
                >
                  <span>{canAccessAdmin(currentUser) ? 'دخول إدارة المحاكي 🛡️' : 'المحاكي (قريباً ⏳)'}</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>

              {/* بطاقات المحاكي الثلاث */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                
                {/* 1. محاكي الطرقعة الشامل */}
                <div
                  onClick={() => {
                    if (!canAccessAdmin(currentUser)) {
                      setShowSimulatorLockedModal(true);
                    } else {
                      handleTabSelect('simulator');
                    }
                  }}
                  className="group relative cursor-pointer p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-sky-500/30 hover:border-sky-400/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                        ⚡
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        {canAccessAdmin(currentUser) ? 'الأكثر طلباً' : 'قريباً ⏳'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-base text-white group-hover:text-sky-300 transition-colors">
                        محاكي الطرقعة الشامل
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        نفس واجهة قياس المحوسب تماماً، أقسام موقوتة، وحساب تلقائي للنسبة المئوية مع حفظ النتائج.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-bold text-sky-400">
                    <span>{canAccessAdmin(currentUser) ? 'دخول كمسؤول 🛡️' : 'مقفول للطلاب - قريباً ⏳'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 2. اختبار تحديد المستوى */}
                <div
                  onClick={() => {
                    if (!canAccessAdmin(currentUser)) {
                      setShowSimulatorLockedModal(true);
                    } else {
                      handleTabSelect('simulator');
                    }
                  }}
                  className="group relative cursor-pointer p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-amber-500/30 hover:border-amber-400/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-amber-500/10 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                        🎯
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {canAccessAdmin(currentUser) ? 'مجاني 100%' : 'قريباً ⏳'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-base text-white group-hover:text-amber-300 transition-colors">
                        اختبار تحديد المستوى السريع
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        30 سؤالاً منتقاة بعناية لتقييم مستواك في الكمي واللفظي واقتراح خطة المذاكرة الأنسب لك.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-bold text-amber-400">
                    <span>{canAccessAdmin(currentUser) ? 'دخول كمسؤول 🛡️' : 'مقفول للطلاب - قريباً ⏳'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

                {/* 3. تجميعات نمر النموذجية */}
                <div
                  onClick={() => {
                    if (!canAccessAdmin(currentUser)) {
                      setShowSimulatorLockedModal(true);
                    } else {
                      handleTabSelect('simulator');
                    }
                  }}
                  className="group relative cursor-pointer p-5 rounded-2xl bg-white/5 hover:bg-white/10 border border-emerald-500/30 hover:border-emerald-400/80 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-500/10 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-black text-lg group-hover:scale-110 transition-transform">
                        🐅
                      </span>
                      <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {canAccessAdmin(currentUser) ? 'نماذج جديدة' : 'قريباً ⏳'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-base text-white group-hover:text-emerald-300 transition-colors">
                        تجميعات واختبارات نمر
                      </h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        تدريب مكثف على أحدث صيغ الأسئلة والنماذج المقفلة المتكررة في قياس مؤخراً.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs font-bold text-emerald-400">
                    <span>{canAccessAdmin(currentUser) ? 'دخول كمسؤول 🛡️' : 'مقفول للطلاب - قريباً ⏳'}</span>
                    <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>

              </div>

            </div>
          </section>

{/* ======================================================================= */}
          {/* مميزات وأقسام المنصة الأساسية (محاضرات تأسيس، مذكرات وملخصات، مجتمع تليجرام) */}
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

              <MobileBottomNav
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          onOpenMenu={() => setIsMobileMenuOpen(true)}
          currentUser={currentUser}
        />

      /* إشعار تفاعلي لميزات "قريباً" */
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
