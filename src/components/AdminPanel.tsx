import React, { useState, useEffect } from 'react';
import {
  Users,
  Database,
  CheckSquare,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  BookOpen,
  HelpCircle,
  FileText,
  Clock,
  Layers,
  Save,
  X,
  CheckCircle2,
  AlertCircle,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Terminal,
  RefreshCw,
  AlertTriangle,
  CreditCard,
  ExternalLink,
  Wallet,
  Cpu,
  HardDrive,
  Activity,
  Gauge,
  UserCheck,
  UserX,
  Crown,
  Wrench,
  Download,
  Tag,
} from 'lucide-react';
import { FeaturesManagementTab } from './FeaturesManagementTab';
import { SiteMaintenanceTab } from './SiteMaintenanceTab';
import { PromoCodeGenerator } from './PromoCodeGenerator';
import { maintenanceService } from '../lib/maintenanceService';
import { UserWithRole } from '../types';
import { rolesService } from '../lib/rolesService';
import { downloadTrackingService } from '../lib/downloadTrackingService';
import { isOwnerEmail } from '../lib/securityUtils';
import { localScoreStorage } from '../lib/supabase';
import {
  getAntiHackSettings,
  saveAntiHackSettings,
  getSecurityViolations,
  clearSecurityViolations,
  logSecurityViolation,
  AntiHackSettings,
  SecurityViolation
} from '../lib/antiHack';
import { coursesStorage } from '../lib/subscriptionService';
import { courseCommerceService } from '../lib/courseCommerceService';
import {
  getKashierSettings,
  saveKashierSettings,
  getKashierTransactions,
  clearKashierTransactions,
  createKashierPaymentSession,
  KashierSettings,
  KashierTransaction
} from '../lib/kashierService';
import {
  dbCache,
  invalidateCacheByTag,
  invalidateCoursesCache,
  invalidateUsersCache,
  clearAllDatabaseCache,
  CacheMetrics
} from '../lib/dbCache';

export type AdminTab = 'security' | 'kashier' | 'dbCache' | 'features' | 'maintenance' | 'promo';

interface AdminPanelProps {
  initialTab?: AdminTab;
  onTabChange?: (tab: AdminTab) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  initialTab,
  onTabChange,
}) => {
  const [activeTab, setActiveTabState] = useState<AdminTab>(initialTab || 'security');

  const setActiveTab = (tab: AdminTab) => {
    setActiveTabState(tab);
    if (onTabChange) onTabChange(tab);
  };

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTabState(initialTab);
    }
  }, [initialTab]);

  // مقاييس وحالة الكاشينج الفوري لقواعد البيانات (Database Caching Metrics)
  const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics>(() => dbCache.getMetrics());
  const [benchmarkLatency, setBenchmarkLatency] = useState<number | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [isSiteUnderMaintenance, setIsSiteUnderMaintenance] = useState<boolean>(() => maintenanceService.getConfig().isEnabled);

  useEffect(() => {
    const handleMaint = () => {
      setIsSiteUnderMaintenance(maintenanceService.getConfig().isEnabled);
    };
    window.addEventListener('tarqa_maintenance_changed', handleMaint);
    return () => window.removeEventListener('tarqa_maintenance_changed', handleMaint);
  }, []);

  useEffect(() => {
    const handleCacheChange = () => {
      setCacheMetrics(dbCache.getMetrics());
    };
    window.addEventListener('tarqa_db_cache_changed', handleCacheChange);
    return () => window.removeEventListener('tarqa_db_cache_changed', handleCacheChange);
  }, []);

  const handlePurgeCoursesCache = () => {
    invalidateCoursesCache();
    setCacheMetrics(dbCache.getMetrics());
    showToast('تم تفريغ كاش الدورات والمحاضرات والملفات بنجاح ⚡', 'success');
  };

  const handlePurgeUsersCache = () => {
    invalidateUsersCache();
    setCacheMetrics(dbCache.getMetrics());
    showToast('تم تفريغ كاش المستخدمين والرتب والاشتراكات بنجاح ⚡', 'success');
  };

  const handlePurgeAllCache = () => {
    if (window.confirm('هل أنت متأكد من تفريغ كافة قواعد البيانات والكاش بالكامل؟ سيتم إعادة الجلب تلقائياً في الخلفية عند الحاجة.')) {
      clearAllDatabaseCache();
      setCacheMetrics(dbCache.getMetrics());
      showToast('تم تفريغ كامل الكاشينج لقواعد البيانات بنجاح 🧹', 'info');
    }
  };

  const handleRunBenchmark = () => {
    setIsBenchmarking(true);
    setTimeout(() => {
      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        dbCache.get('db_users_with_roles');
        dbCache.get('db_courses_modules');
      }
      const duration = performance.now() - start;
      const perRead = Number((duration / 1000).toFixed(4));
      setBenchmarkLatency(perRead);
      setIsBenchmarking(false);
      showToast(`اكتمل فحص السرعة! زمن القراءة من الكاش: ${perRead}ms لكل استعلام ⚡`, 'success');
    }, 100);
  };

  // إعدادات وسجلات درع الأمان (Anti-Hack Shield)
  const [securitySettings, setSecuritySettings] = useState<AntiHackSettings>(() => getAntiHackSettings());
  const [securityLogs, setSecurityLogs] = useState<SecurityViolation[]>(() => getSecurityViolations());

  // إعدادات وسجل معاملات بوابة كاشير (Kashier Gateway)
  const [kashierSettings, setKashierSettings] = useState<KashierSettings>(() => getKashierSettings());
  const [kashierTransactions, setKashierTransactions] = useState<KashierTransaction[]>(() => getKashierTransactions());
  const [showKashierSecret, setShowKashierSecret] = useState(false);
  const [isTestingKashier, setIsTestingKashier] = useState(false);
  const [kashierTestResult, setKashierTestResult] = useState<string | null>(null);

  useEffect(() => {
    const handleTxUpdate = () => {
      setKashierTransactions(getKashierTransactions());
    };
    window.addEventListener('tarqa_kashier_tx_logged', handleTxUpdate);
    return () => window.removeEventListener('tarqa_kashier_tx_logged', handleTxUpdate);
  }, []);

  const handleSaveKashierConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    saveKashierSettings(kashierSettings);

    // مزامنة السعر الجديد فوراً مع نظام الدورات والتجارة الإلكترونية
    try {
      const amt = Number(kashierSettings.amount) || 1100;
      const curr = kashierSettings.currency || 'EGP';
      const priceEg = curr === 'EGP' ? amt : 1100;
      const priceSar = curr === 'SAR' ? amt : 75;

      const allCourses = coursesStorage.getCourses();
      const updated = allCourses.map((c) => {
        if (c.id === 'course-foundation' || c.isDefault) {
          return { ...c, priceEg, priceSar };
        }
        return c;
      });
      coursesStorage.saveCourses(updated);
      await courseCommerceService.updateCoursePrice('course-foundation', 'دورة التأسيس الشاملة للقدرات 🎯', priceSar, priceEg);
    } catch (err) {
      console.warn('Failed to sync course price with Kashier settings:', err);
    }

    showToast('تم حفظ وتحديث إعدادات كاشير ومزامنة سعر الاشتراك بنجاح! 💳', 'success');
  };

  const handleTestKashierConnection = async () => {
    setIsTestingKashier(true);
    setKashierTestResult(null);
    try {
      const res = await createKashierPaymentSession(
        {
          id: 'admin_test',
          fullName: 'مدير المنصة (تجربة)',
          email: 'admin@tarqa.app',
          targetScore: 100,
          role: 'super_admin',
        },
        {
          amount: kashierSettings.amount,
          currency: kashierSettings.currency,
          description: 'جلسة فحص واختبار من لوحة الإدارة',
        }
      );
      if (res.success && res.sessionUrl) {
        setKashierTestResult(`نجح الاتصال! ✅ تم إنشاء جلسة كاشير رسمية بنجاح: ${res.sessionUrl}`);
        showToast('تم اختبار الاتصال وتوليد جلسة دفع بنجاح!', 'success');
        setKashierTransactions(getKashierTransactions());
      } else {
        setKashierTestResult(`فشل الاتصال: ${res.error || 'تعذر الوصول لخادم كاشير'}`);
        showToast('فشل اختبار الاتصال ببوابة كاشير', 'error');
      }
    } catch (err: any) {
      setKashierTestResult(`خطأ في الفحص: ${err?.message || 'خطأ غير معروف'}`);
      showToast('حدث خطأ أثناء فحص جلسة كاشير', 'error');
    } finally {
      setIsTestingKashier(false);
    }
  };

  const handleToggleSecuritySetting = (key: keyof AntiHackSettings) => {
    const nextVal = !securitySettings[key];
    const updated = saveAntiHackSettings({ [key]: nextVal });
    setSecuritySettings(updated);
    showToast(`تم ${nextVal ? 'تفعيل' : 'تعطيل'} الإعداد الأمني بنجاح! 🛡️`, 'info');
  };

  const handleUpdateMaxTabSwitches = (count: number) => {
    const updated = saveAntiHackSettings({ maxExamTabSwitches: count });
    setSecuritySettings(updated);
    showToast(`تم تحديث الحد الأقصى لمخالفات الاختبار إلى (${count}) مرات.`, 'info');
  };

  const handleClearLogs = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في تفريغ سجل المخالفات الأمنية؟')) {
      clearSecurityViolations();
      setSecurityLogs([]);
      showToast('تم تفريغ سجل المخالفات الأمنية بنجاح.', 'info');
    }
  };

  const handleSimulateAlert = () => {
    logSecurityViolation({
      type: 'devtools_attempt',
      details: 'محاكاة تجريبية من لوحة الإدارة لفحص درع الأمان والتنبيهات',
      userId: 'admin-preview',
      userName: 'مدير المنصة (تجربة)',
    });
    setSecurityLogs(getSecurityViolations());
    showToast('تم تسجيل مخالفة تجريبية وتفعيل التنبيه بنجاح! ⚠️', 'info');
  };

  // رسائل التنبيه التفاعلية
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };


  // إحصائيات المنصة الحقيقية 100%
  const [platformStats, setPlatformStats] = useState({
    totalUsers: 0,
    studentsCount: 0,
    subscribedCount: 0,
    totalAttempts: 0,
    todayAttempts: 0,
    averageScore: 0,
    hasScores: false,
  });

  const [allPlatformUsers, setAllPlatformUsers] = useState<UserWithRole[]>([]);
  const [subscribedUsers, setSubscribedUsers] = useState<UserWithRole[]>([]);
  const [subscribersTab, setSubscribersTab] = useState<'subscribed' | 'unsubscribed' | 'all' | 'downloaded'>('subscribed');
  const [subscribersSearch, setSubscribersSearch] = useState<string>('');
  const [selectedStudentForFiles, setSelectedStudentForFiles] = useState<UserWithRole | null>(null);
  const [selectedStudentToActivate, setSelectedStudentToActivate] = useState<string>('');
  const [customStudentEmail, setCustomStudentEmail] = useState<string>('');
  const [customStudentName, setCustomStudentName] = useState<string>('');
  const [isActivatingManualSub, setIsActivatingManualSub] = useState<boolean>(false);

  const loadRealStats = async () => {
    try {
      const users = await rolesService.getUsers(true);
      setAllPlatformUsers(users);
      const activeSubs = users.filter((u) => u.isSubscribed && u.role !== 'super_admin' && !isOwnerEmail(u.email));
      setSubscribedUsers(activeSubs);

      const storedAttempts = localScoreStorage.getAttempts();
      const realAttempts = Array.isArray(storedAttempts) 
        ? storedAttempts.filter((a: any) => !['att-1', 'att-2', 'att-3', 'att-4'].includes(a.id))
        : [];

      const todayStr = new Date().toISOString().split('T')[0];
      const todayAttempts = realAttempts.filter((a: any) => {
        const d = a.completed_at ? new Date(a.completed_at).toISOString().split('T')[0] : '';
        return d === todayStr;
      });

      const scores = realAttempts.map((a: any) => Number(a.score) || 0);
      const avg = scores.length > 0
        ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)
        : 0;

      setPlatformStats({
        totalUsers: users.length,
        studentsCount: users.filter((u) => u.role === 'student').length,
        subscribedCount: activeSubs.length,
        totalAttempts: realAttempts.length,
        todayAttempts: todayAttempts.length,
        averageScore: avg,
        hasScores: scores.length > 0,
      });
    } catch (err) {
      console.warn('Failed to load real stats in AdminPanel:', err);
    }
  };

  useEffect(() => {
    loadRealStats();

    const handleDataChanged = () => {
      loadRealStats();
      setKashierTransactions(getKashierTransactions());
    };

    window.addEventListener('tarqa_roles_changed', handleDataChanged);
    window.addEventListener('tarqa_user_changed', handleDataChanged);
    window.addEventListener('tarqa_subscription_changed', handleDataChanged);
    window.addEventListener('tarqa:subscription_updated', handleDataChanged);
    window.addEventListener('tarqa_kashier_tx_logged', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    return () => {
      window.removeEventListener('tarqa_roles_changed', handleDataChanged);
      window.removeEventListener('tarqa_user_changed', handleDataChanged);
      window.removeEventListener('tarqa_subscription_changed', handleDataChanged);
      window.removeEventListener('tarqa:subscription_updated', handleDataChanged);
      window.removeEventListener('tarqa_kashier_tx_logged', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
    };
  }, []);

  const handleManualActivateSubscription = async (targetUser?: UserWithRole) => {
    let userToActivate = targetUser;
    if (!userToActivate && selectedStudentToActivate) {
      userToActivate = allPlatformUsers.find(u => u.id === selectedStudentToActivate || u.email === selectedStudentToActivate);
    }
    if (!userToActivate && customStudentEmail.trim()) {
      userToActivate = {
        id: 'usr_' + Date.now(),
        email: customStudentEmail.trim(),
        fullName: customStudentName.trim() || 'طالب مشترك (إنستاباي)',
        role: 'student',
        targetScore: 100,
        createdAt: new Date().toISOString(),
      };
    }

    if (!userToActivate || (!userToActivate.id && !userToActivate.email)) {
      showToast('يرجى اختيار طالب من القائمة أو إدخال بريده لتفعيل الاشتراك', 'info');
      return;
    }

    setIsActivatingManualSub(true);
    try {
      await rolesService.grantSubscription(userToActivate, 365);
      showToast(`تم تفعيل الاشتراك السنوي بنجاح للطالب "${userToActivate.fullName || userToActivate.email}" لمدة 365 يوماً! 🎓✅`, 'success');
      setSelectedStudentToActivate('');
      setCustomStudentEmail('');
      setCustomStudentName('');
      await loadRealStats();
    } catch (e: any) {
      showToast('حدث خطأ أثناء التفعيل: ' + (e?.message || 'تعذر التفعيل'), 'error');
    } finally {
      setIsActivatingManualSub(false);
    }
  };

  const handleManualCancelSubscription = async (u: UserWithRole) => {
    if (window.confirm(`هل أنت متأكد من إلغاء اشتراك الطالب "${u.fullName || u.email}"؟`)) {
      // تحديث متفائل فوري للواجهة
      setSubscribedUsers(prev => prev.filter(item => item.id !== u.id && item.email !== u.email));
      setAllPlatformUsers(prev => prev.map(item => {
        if ((u.id && item.id === u.id) || (u.email && item.email && item.email.toLowerCase() === u.email.toLowerCase())) {
          return { ...item, isSubscribed: false, subscriptionExpiresAt: undefined };
        }
        return item;
      }));

      try {
        await rolesService.cancelSubscription(u.id, u.email, u.telegramUsername, u.telegramId);
        showToast(`تم إلغاء اشتراك ${u.fullName || u.email} بنجاح`, 'info');
        await loadRealStats();
      } catch {
        showToast('حدث خطأ أثناء إلغاء الاشتراك', 'error');
        await loadRealStats();
      }
    }
  };


  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8 animate-in fade-in duration-200 font-cairo">

      {/* تنبيه الإجراء الفوري (Toast Notification) */}
      {toast && (
        <div
          className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 shadow-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : toast.type === 'error'
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400'
              : 'bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* شريط التبويبات الرئيسي فائق الوضوح والبروز (High-Contrast Top Tab Bar) */}
      {/* ======================================================================= */}
      <div className="p-2.5 rounded-3xl bg-white/95 dark:bg-[#0c1222]/95 border-2 border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          
          {/* تبويب 1: بوابة كاشير والمدفوعات */}
          <button
            type="button"
            onClick={() => setActiveTab('kashier')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'kashier'
                ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white font-black shadow-lg shadow-emerald-500/30 border border-emerald-400/80 ring-2 ring-emerald-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-emerald-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'kashier' ? 'bg-white/20 text-white' : 'bg-emerald-500/15 text-emerald-500'}`}>
              <CreditCard className="w-3.5 h-3.5" />
            </div>
            <span>الاشتراكات والمدفوعات (Kashier & InstaPay)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              activeTab === 'kashier' ? 'bg-black/20 text-emerald-100' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            }`}>
              {subscribedUsers.length} مشترك 🎓
            </span>
          </button>

          {/* تبويب 2: درع الحماية والمخالفات */}
          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'security'
                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-red-600 text-white font-black shadow-lg shadow-rose-500/30 border border-rose-400/80 ring-2 ring-rose-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-rose-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'security' ? 'bg-white/20 text-white' : 'bg-rose-500/15 text-rose-500'}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span>درع الحماية والمخالفات (Anti-Hack)</span>
            {securityLogs.length > 0 && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                activeTab === 'security' ? 'bg-black/20 text-rose-100' : 'bg-rose-500/15 text-rose-500'
              }`}>
                {securityLogs.length}
              </span>
            )}
          </button>


          {/* تبويب: مولّد وإدارة أكواد الخصم والكوبونات */}
          <button
            type="button"
            data-admin-tab="promo"
            onClick={() => setActiveTab('promo')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'promo'
                ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 border border-amber-300/80 ring-2 ring-amber-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-amber-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'promo' ? 'bg-black/15 text-slate-950' : 'bg-amber-500/15 text-amber-500'}`}>
              <Tag className="w-3.5 h-3.5" />
            </div>
            <span>مولّد وإدارة الكوبونات (Promo Codes)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              activeTab === 'promo' ? 'bg-black/20 text-slate-950' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
            }`}>
              MySQL 🎟️
            </span>
          </button>

          {/* تبويب 6: إدارة المميزات والروابط */}
          <button
            type="button"
            data-admin-tab="features"
            onClick={() => setActiveTab('features')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'features'
                ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/30 border border-amber-300/80 ring-2 ring-amber-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-amber-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'features' ? 'bg-black/15 text-slate-950' : 'bg-amber-500/15 text-amber-500'}`}>
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <span>إدارة المميزات والروابط</span>
          </button>

          {/* تبويب 7: حالة الموقع ووضع الصيانة */}
          <button
            type="button"
            data-admin-tab="maintenance"
            onClick={() => setActiveTab('maintenance')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'maintenance'
                ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 text-white font-black shadow-lg shadow-amber-500/30 border border-amber-400/80 ring-2 ring-amber-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/30 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-amber-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'maintenance' ? 'bg-white/20 text-white' : 'bg-amber-500/15 text-amber-500'}`}>
              <Wrench className="w-3.5 h-3.5" />
            </div>
            <span>حالة الموقع والصيانة</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              isSiteUnderMaintenance ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}>
              {isSiteUnderMaintenance ? 'مفعّلة ⚠️' : 'طبيعي 🟢'}
            </span>
          </button>


          {/* تبويب 5: تسريع وكاشينج قواعد البيانات (Database Caching Engine) */}
          <button
            type="button"
            onClick={() => setActiveTab('dbCache')}
            className={`px-4 py-2.5 rounded-2xl text-xs transition-all duration-200 flex items-center gap-2 cursor-pointer ${
              activeTab === 'dbCache'
                ? 'bg-gradient-to-r from-sky-600 via-cyan-500 to-blue-600 text-white font-black shadow-lg shadow-sky-500/30 border border-sky-400/80 ring-2 ring-sky-400/40 scale-[1.02]'
                : 'bg-slate-100/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:text-sky-600 dark:hover:text-sky-400 border border-slate-200/90 dark:border-slate-700/90 font-bold hover:border-sky-500/40'
            }`}
          >
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activeTab === 'dbCache' ? 'bg-white/20 text-white' : 'bg-sky-500/15 text-sky-500'}`}>
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <span>تسريع وكاشينج الداتابيز (DB Caching)</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
              activeTab === 'dbCache' ? 'bg-black/20 text-sky-100' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'
            }`}>
              {cacheMetrics.hitRatio}% Hit
            </span>
          </button>
        </div>
      </div>



      {/* إحصائيات خاصة بتبويب كاشير (Kashier Specific Metrics) */}
      {activeTab === 'kashier' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">حالة البوابة</span>
              <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${kashierSettings.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span>{kashierSettings.enabled ? 'مفعلة ونشطة' : 'معطلة'}</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Kashier Sessions v3</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">بيئة العمل الحالية</span>
              <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
                {kashierSettings.mode === 'live' ? 'إنتاج حقيقي (Live)' : 'بيئة تجريبية (Test)'}
              </div>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                {kashierSettings.simulateMode ? 'محاكاة Sandbox مفعّلة' : 'اتصال سحابي مباشر'}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-lg">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">تسعيرة الاشتراك</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {kashierSettings.amount} <span className="text-sm font-bold text-blue-500">{kashierSettings.currency}</span>
              </div>
              <span className="text-[11px] text-blue-500 font-bold">اشتراك سنوي شامل 🎓</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">سجل المعاملات</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{kashierTransactions.length}</div>
              <span className="text-[11px] text-purple-500 font-bold">
                {kashierTransactions.filter(t => t.status === 'SUCCESS').length} معاملة ناجحة ومؤكدة
              </span>
            </div>
          </div>

        </section>
      )}

      {/* إحصائيات خاصة بتبويب درع الأمان (Security Specific Metrics) */}
      {activeTab === 'security' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">حالة درع الأمان</span>
              <div className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>مفعّل 100% ونشط</span>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">Anti-Hack Protection</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold text-lg">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">المخالفات المرصودة</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{securityLogs.length}</div>
              <span className="text-[11px] text-rose-500 font-bold">
                {securityLogs.length === 0 ? 'السجل نظيف تماماً ✅' : 'تم رصد وتسجيل المحاولات'}
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">سحب الاختبار آلياً</span>
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {securitySettings.autoSubmitOnCheat ? 'مفعّل تلقائياً ✅' : 'معطّل ⚠️'}
              </div>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">عند استنفاد الإنذارات</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">إنذارات مغادرة النافذة</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                {securitySettings.maxExamTabSwitches} <span className="text-xs font-normal">محاولات</span>
              </div>
              <span className="text-[11px] text-purple-500 font-bold">
                {securitySettings.maxExamTabSwitches === 1 ? 'وضع صارم جداً 🚨' : 'وضع قياسي'}
              </span>
            </div>
          </div>

        </section>
      )}

      {/* إحصائيات خاصة بتبويب تسريع وقواعد البيانات (Database Caching Specific Metrics) */}
      {activeTab === 'dbCache' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-200">
          
          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center font-bold text-lg">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">معدل إصابة الكاش (Hit Ratio)</span>
              <div className="text-2xl font-black text-sky-500 font-mono">{cacheMetrics.hitRatio}%</div>
              <span className="text-[11px] text-slate-500 font-bold">
                {cacheMetrics.hits} طلب ناجح من الذاكرة ⚡
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-lg">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">سرعة القراءة الفورية</span>
              <div className="text-2xl font-black text-emerald-500 font-mono">
                {benchmarkLatency !== null ? `${benchmarkLatency} ms` : '< 0.05 ms'}
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">L1 Map Cache (0ms Latency)</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">العناصر المخزنة مؤقتاً</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{cacheMetrics.itemCount}</div>
              <span className="text-[11px] text-purple-500 font-bold">
                جداول وموديولات متزامنة
              </span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-lg dark:shadow-slate-950/80 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-lg">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">حجم الكاش التقديري</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">{cacheMetrics.estimatedMemoryKb} KB</div>
              <span className="text-[11px] text-amber-500 font-bold">
                ذاكرة L1 RAM + مخزن L2
              </span>
            </div>
          </div>

        </section>
      )}


{/* 3. درع الحماية ومكافحة الاختراق (Anti-Hack Shield Management Section) */}
      {/* ======================================================================= */}
      {activeTab === 'security' && (
        <section className="space-y-6">
          
          {/* بطاقة الحالة الرئيسية لدرع الحماية */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#101b33] to-slate-950 border-2 border-emerald-500/40 shadow-2xl relative overflow-hidden text-white backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
                  <ShieldCheck className="w-8 h-8 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-black text-white">درع طرقع الأمني ومكافحة الاختراق</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      نشط ومراقب (Shield Core v3.0)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    نظام أمني متكامل لحماية بنك الأسئلة من التسريب، حظر أدوات المطورين والفحص (DevTools)، منع نسخ الأسئلة والمذكرات، كشف محاولات الغش بمغادرة شاشة الاختبار، وحماية جلسات المستخدمين من التلاعب.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleSimulateAlert}
                  className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border-2 border-amber-500/50 text-amber-300 font-black text-xs transition active:scale-95 flex items-center gap-2 cursor-pointer shadow-md"
                  title="إطلاق تنبيه تجريبي لفحص النظام"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>فحص الإنذار التجريبي 🚨</span>
                </button>
              </div>
            </div>

            {/* مؤشرات حية سريعة */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t-2 border-slate-700/80">
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border-2 border-slate-700 shadow-md">
                <span className="text-[11px] text-slate-300 block mb-1 font-bold">فحص العناصر (DevTools)</span>
                <span className={`text-xs font-bold ${securitySettings.blockDevTools ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {securitySettings.blockDevTools ? 'محظور تماماً ✅' : 'معطل ⚠️'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border-2 border-slate-700 shadow-md">
                <span className="text-[11px] text-slate-300 block mb-1 font-bold">نسخ الأسئلة وتحديدها</span>
                <span className={`text-xs font-bold ${securitySettings.blockCopyCut ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {securitySettings.blockCopyCut ? 'محمي من النسخ ✅' : 'متاح ⚠️'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border-2 border-slate-700 shadow-md">
                <span className="text-[11px] text-slate-300 block mb-1 font-bold">رصد مغادرة الاختبار</span>
                <span className={`text-xs font-bold ${securitySettings.detectTabSwitch ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {securitySettings.detectTabSwitch ? `نشط (${securitySettings.maxExamTabSwitches} مخالفات)` : 'معطل ⚠️'}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-900/90 border-2 border-slate-700 shadow-md">
                <span className="text-[11px] text-slate-300 block mb-1 font-bold">إجمالي المخالفات المرصودة</span>
                <span className="text-xs font-black text-amber-400 font-mono">
                  {securityLogs.length} مخالفة مسجلة
                </span>
              </div>
            </div>
          </div>

          {/* لوحة تحكم مفاتيح الحماية والتبديل (Security Modules Toggles) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-amber-300 mb-5 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              <span>إعدادات وحدات الأمان ومكافحة الاختراق</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 1. حظر DevTools والفحص */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">حظر أدوات المطورين (F12)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockDevTools')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockDevTools ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockDevTools ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يعطل مفاتيح F12 و Ctrl+Shift+I و Ctrl+Shift+J و Ctrl+U لمنع فحص العناصر وسرقة نصوص الأسئلة.
                  </p>
                </div>
              </div>

              {/* 2. حظر القائمة المنسدلة للزر الأيمن */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">تعطيل الزر الأيمن (Context Menu)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockContextMenu')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockContextMenu ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockContextMenu ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يمنع فتح قائمة الفحص وحفظ الصور بالفأرة في كافة صفحات المنصة مع استثناء حقول الإدخال.
                  </p>
                </div>
              </div>

              {/* 3. منع النسخ والقص */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">حظر نسخ وتحديد المحتوى</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockCopyCut')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockCopyCut ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockCopyCut ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يعطل اختصارات النسخ Ctrl+C وتحديد نصوص الأسئلة وخيارات الاختبار والمذكرات لحمايتها من السرقة.
                  </p>
                </div>
              </div>

              {/* 4. مكافحة لقطات الشاشة */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">إحباط لقطات الشاشة (PrintScreen)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('blockPrintScreen')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.blockPrintScreen ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.blockPrintScreen ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يمسح حافظة الجهاز فوراً عند ضغط زر تصوير الشاشة PrintScreen لمنع تسريب أسئلة قياس على تيليجرام.
                  </p>
                </div>
              </div>

              {/* 5. رصد مغادرة الاختبار */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">كشف مغادرة شاشة الاختبار (Tab-Switch)</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('detectTabSwitch')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.detectTabSwitch ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.detectTabSwitch ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يرصد خروج الطالب من صفحة الاختبار للبحث في جوجل أو استخدام روبوتات الذكاء الاصطناعي مع إنذار فوري.
                  </p>
                </div>
              </div>

              {/* 6. السحب التلقائي للاختبار عند الغش */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] hover:border-amber-500/50 transition-all flex flex-col justify-between gap-3 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">سحب الاختبار آلياً عند تكرار الغش</span>
                    <button
                      type="button"
                      onClick={() => handleToggleSecuritySetting('autoSubmitOnCheat')}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        securitySettings.autoSubmitOnCheat ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                        securitySettings.autoSubmitOnCheat ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                    يقوم بإنهاء وتسليم الاختبار تلقائياً بعد استنفاد الطالب للحد الأقصى من مخالفات مغادرة النافذة.
                  </p>
                </div>
              </div>

            </div>

            {/* إعدادات الصرامة للمخالفات */}
            <div className="mt-6 pt-6 border-t-2 border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="block text-xs font-bold text-slate-900 dark:text-white mb-0.5">
                  الحد الأقصى المسموح به لمغادرة شاشة الاختبار قبل الإلغاء:
                </span>
                <span className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300 font-medium">
                  عدد الإنذارات التي تظهر للطالب قبل سحب ورقة الإجابة التلقائي.
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#080d1a] border border-slate-300 dark:border-slate-700 p-1 rounded-xl">
                {[1, 2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => handleUpdateMaxTabSwitches(cnt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer select-none ${
                      securitySettings.maxExamTabSwitches === cnt
                        ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {cnt} {cnt === 1 ? 'محاولة (صارم)' : cnt === 3 ? 'محاولات (قياسي)' : 'محاولات'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* سجل المخالفات الأمنية الفعلي (Live Security Audit Log) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-amber-300">
                  سجل المخالفات الأمنية المرصودة لحظياً ({securityLogs.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSecurityLogs(getSecurityViolations())}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#121c32] hover:bg-slate-200 dark:hover:bg-[#1a2847] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث السجل</span>
                </button>

                {securityLogs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearLogs}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    تفريغ السجل
                  </button>
                )}
              </div>
            </div>

            {securityLogs.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#121c32]/50 rounded-2xl">
                <ShieldCheck className="w-12 h-12 text-emerald-500 mx-auto mb-2 opacity-90" />
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  سجل الأمان نظيف تماماً!
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  لم يتم رصد أي محاولات اختراق أو فحص لعناصر المنصة أو غش في الاختبارات حتى الآن.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="pb-3 font-bold">الوقت والتاريخ</th>
                      <th className="pb-3 font-bold">نوع المخالفة</th>
                      <th className="pb-3 font-bold">المستخدم</th>
                      <th className="pb-3 font-bold">تفاصيل المحاولة المرصودة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {securityLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(log.timestamp).toLocaleTimeString('ar-SA')} - {new Date(log.timestamp).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-block ${
                            log.type === 'devtools_attempt'
                              ? 'bg-rose-500/20 text-rose-500 dark:text-rose-300 border border-rose-500/40'
                              : log.type === 'tab_switch'
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40'
                              : log.type === 'storage_tamper'
                              ? 'bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/40'
                              : 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-500/40'
                          }`}>
                            {log.type === 'devtools_attempt' && 'محاولة فتح DevTools 🛠️'}
                            {log.type === 'tab_switch' && 'مغادرة الاختبار (Tab Switch) 🔄'}
                            {log.type === 'copy_attempt' && 'محاولة نسخ محتوى 📋'}
                            {log.type === 'screenshot_attempt' && 'لقطة شاشة PrintScreen 📸'}
                            {log.type === 'storage_tamper' && 'تلاعب ببيانات الحساب 🚨'}
                            {log.type === 'right_click' && 'زر أيمن محظور 🖱️'}
                          </span>
                        </td>
                        <td className="py-3 font-bold text-slate-900 dark:text-slate-200">
                          {log.userName}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            #{log.userId.slice(0, 10)}
                          </span>
                        </td>
                        <td className="py-3 text-slate-700 dark:text-slate-200 font-medium">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </section>
      )}

      {/* ======================================================================= */}
      {/* 4. بوابة دفع كاشير (Kashier Payment Sessions v3 Management Section) */}
      {/* ======================================================================= */}
      {activeTab === 'kashier' && (
        <section className="space-y-6">
          
          {/* بطاقة الحالة الرئيسية لبوابة كاشير */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#101b33] to-slate-950 border-2 border-amber-500/50 shadow-2xl relative overflow-hidden text-white backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/30 border-2 border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/20">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-black text-white">بوابة دفع كاشير (Kashier Gateway)</h2>
                    <span className={`px-2.5 py-0.5 rounded-full border text-xs font-bold font-mono flex items-center gap-1 ${
                      kashierSettings.enabled
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                        : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${kashierSettings.enabled ? 'bg-emerald-400 animate-ping' : 'bg-rose-400'}`} />
                      {kashierSettings.enabled ? 'البوابة مفعلة' : 'البوابة معطلة'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono">
                      {kashierSettings.mode === 'live' ? '🟢 بيئة حية (Live)' : '🧪 بيئة تجريبية (Test Mode)'}
                    </span>
                    {kashierSettings.simulateMode && (
                      <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-bold">
                        محاكاة ذكية (Sandbox Active)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    نظام الدفع الرسمي Kashier Payment Sessions v3. يتيح للطلاب الدفع الآمن للاشتراك السنوي عبر بطاقات مدى (Mada)، فيزا، ماستركارد، والمحافظ الإلكترونية من خلال نافذة دفع مدمجة بدون مغادرة المنصة.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <a
                  href="https://merchant.kashier.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-600 text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  <span>لوحة تحكم كاشير</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* إحصائيات الاشتراكات والمشتركين المفعلين حالياً (Active Subscribers Banner) */}
          {/* ======================================================================= */}
          {(() => {
            const allStudents = allPlatformUsers.filter((u) => u.role === 'student' && !isOwnerEmail(u.email));
            const subCount = allStudents.filter((u) => u.isSubscribed).length;
            const unsubCount = allStudents.filter((u) => !u.isSubscribed).length;
            const dlCount = allStudents.filter((u) => Boolean(u.hasDownloadedFiles || (u.downloadedFilesCount && u.downloadedFilesCount > 0))).length;
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div 
                  onClick={() => setSubscribersTab('subscribed')}
                  className={`p-5 rounded-3xl border-2 shadow-lg backdrop-blur-xl flex items-center justify-between cursor-pointer transition-all ${
                    subscribersTab === 'subscribed'
                      ? 'bg-emerald-500/15 border-emerald-500 ring-2 ring-emerald-500/30'
                      : 'bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-emerald-500/30 hover:border-emerald-500/60'
                  }`}
                >
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
                      الطلاب المشتركون 🎓
                    </span>
                    <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {subCount}
                    </div>
                    <span className="text-[11px] text-emerald-500 font-bold mt-1 inline-flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>اشتراك سنوي نشط ومفعل</span>
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold text-xl shadow-inner">
                    <Sparkles className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  onClick={() => setSubscribersTab('unsubscribed')}
                  className={`p-5 rounded-3xl border-2 shadow-lg backdrop-blur-xl flex items-center justify-between cursor-pointer transition-all ${
                    subscribersTab === 'unsubscribed'
                      ? 'bg-slate-500/15 border-slate-500 ring-2 ring-slate-500/30'
                      : 'bg-gradient-to-br from-slate-500/10 via-slate-600/5 to-transparent border-slate-300 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
                      الطلاب غير المشتركين ⚪
                    </span>
                    <div className="text-3xl font-black text-slate-700 dark:text-slate-300 font-mono">
                      {unsubCount}
                    </div>
                    <span className="text-[11px] text-slate-500 font-bold mt-1 inline-block">
                      طالب بانتظار التفعيل
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-slate-500/15 text-slate-500 flex items-center justify-center font-bold text-xl shadow-inner">
                    <UserX className="w-6 h-6" />
                  </div>
                </div>

                <div 
                  onClick={() => setSubscribersTab('downloaded')}
                  className={`p-5 rounded-3xl border-2 shadow-lg backdrop-blur-xl flex items-center justify-between cursor-pointer transition-all ${
                    subscribersTab === 'downloaded'
                      ? 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30'
                      : 'bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-transparent border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
                      قاموا بتحميل الملفات 📥
                    </span>
                    <div className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
                      {dlCount}
                    </div>
                    <span className="text-[11px] text-amber-500 font-bold mt-1 inline-block">
                      سجلات السيرفر المباشرة
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-xl shadow-inner">
                    <FileText className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border-2 border-purple-500/30 shadow-lg backdrop-blur-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">
                      كاشير والمدفوعات 💳
                    </span>
                    <div className="text-3xl font-black text-purple-600 dark:text-purple-400 font-mono">
                      {kashierTransactions.filter(t => t.status === 'SUCCESS').length}
                    </div>
                    <span className="text-[11px] text-purple-500 font-bold mt-1 inline-block">
                      {kashierSettings.amount} {kashierSettings.currency} (1100 ج.م / 75 ر.س)
                    </span>
                  </div>
                  <div className="w-13 h-13 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-xl shadow-inner">
                    <CreditCard className="w-6 h-6" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ======================================================================= */}
          {/* قسم تفعيل اشتراكات إنستاباي والتفعيل اليدوي السريع (InstaPay & Manual Activation) */}
          {/* ======================================================================= */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-purple-500/40 shadow-2xl backdrop-blur-xl space-y-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>تفعيل اشتراكات إنستاباي والتفعيل اليدوي السريع</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30">
                      InstaPay • Yoska
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    حساب الاستقبال: <strong className="text-purple-600 dark:text-purple-400 font-mono">yoska1@instapay</strong> (المستلم: <strong>YASSIEN</strong>) • واتساب الدعم: <strong className="font-mono">01104687320</strong>
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 bg-purple-500/5 dark:bg-purple-950/20 px-3.5 py-2 rounded-2xl border border-purple-500/20">
                💡 عند تأكيد الطالب للتحويل عبر واتساب، اختر حسابه أدناه واضغط <strong>تفعيل الاشتراك فوراً</strong>.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  1. اختر طالباً مسجلاً من المنصة:
                </label>
                <select
                  value={selectedStudentToActivate}
                  onChange={(e) => {
                    setSelectedStudentToActivate(e.target.value);
                    if (e.target.value) {
                      setCustomStudentEmail('');
                      setCustomStudentName('');
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="">-- اضغط للاختيار من الطلاب المسجلين ({allPlatformUsers.length}) --</option>
                  {allPlatformUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || 'طالب'} ({u.email || u.telegramUsername || u.id}) {u.isSubscribed ? '✅ مشترك حالياً' : '⚪ غير مشترك'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  أو اكتب بريد/اسم الطالب مباشرة:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    value={customStudentEmail}
                    onChange={(e) => {
                      setCustomStudentEmail(e.target.value);
                      if (e.target.value) setSelectedStudentToActivate('');
                    }}
                    placeholder="student@gmail.com"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] text-xs font-bold text-slate-900 dark:text-white"
                    dir="ltr"
                  />
                  <input
                    type="text"
                    value={customStudentName}
                    onChange={(e) => setCustomStudentName(e.target.value)}
                    placeholder="اسم الطالب"
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] text-xs font-bold text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={isActivatingManualSub || (!selectedStudentToActivate && !customStudentEmail.trim())}
                  onClick={() => handleManualActivateSubscription()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                >
                  {isActivatingManualSub ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جاري التفعيل...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>تفعيل الاشتراك للطالب فوراً (365 يوماً) 🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ======================================================================= */}
          {/* إدارة المشتركين وغير المشتركين وتحميلات الملفات (قاعدة البيانات والباك إند) */}
          {/* ======================================================================= */}
          {(() => {
            const allStudents = allPlatformUsers.filter((u) => u.role === 'student' && !isOwnerEmail(u.email));
            const activeSubscribedStudents = allStudents.filter((u) => u.isSubscribed);
            const unsubscribedStudents = allStudents.filter((u) => !u.isSubscribed);
            const downloadedStudents = allStudents.filter((u) => Boolean(u.hasDownloadedFiles || (u.downloadedFilesCount && u.downloadedFilesCount > 0)));

            let filteredStudents = allStudents;
            if (subscribersTab === 'subscribed') filteredStudents = activeSubscribedStudents;
            else if (subscribersTab === 'unsubscribed') filteredStudents = unsubscribedStudents;
            else if (subscribersTab === 'downloaded') filteredStudents = downloadedStudents;

            if (subscribersSearch.trim()) {
              const q = subscribersSearch.trim().toLowerCase();
              filteredStudents = filteredStudents.filter((u) =>
                (u.fullName && u.fullName.toLowerCase().includes(q)) ||
                (u.email && u.email.toLowerCase().includes(q)) ||
                (u.telegramUsername && u.telegramUsername.toLowerCase().includes(q))
              );
            }

            return (
              <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl space-y-5">
                {/* رأس الجدول وعنوانه مع زر التحديث */}
                <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100 dark:border-slate-800 flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                        <span>سجل المشتركين والطلاب (مربوط بالباك إند وقاعدة البيانات)</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-mono">
                          {activeSubscribedStudents.length} مشترك / {allStudents.length} طالب
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        مزامنة حية ومباشرة من قاعدة البيانات وسيرفر الاستضافة لتتبع من هو مشترك ومن غير مشترك وسجلات تحميل الملفات بدقة.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => loadRealStats()}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>تحديث السجلات من السيرفر</span>
                  </button>
                </div>

                {/* أزرار التبديل الفورية والبحث (Segmented Filter & Search) */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSubscribersTab('subscribed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        subscribersTab === 'subscribed'
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25 font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>🎓 المشتركون</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono font-bold">
                        {activeSubscribedStudents.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubscribersTab('unsubscribed')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        subscribersTab === 'unsubscribed'
                          ? 'bg-slate-700 text-white shadow-md font-black dark:bg-slate-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>⚪ غير المشتركين</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono font-bold">
                        {unsubscribedStudents.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubscribersTab('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        subscribersTab === 'all'
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>👥 جميع الطلاب</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono font-bold">
                        {allStudents.length}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSubscribersTab('downloaded')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        subscribersTab === 'downloaded'
                          ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/25 font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span>📥 قاموا بالتحميل</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 dark:bg-white/10 font-mono font-bold">
                        {downloadedStudents.length}
                      </span>
                    </button>
                  </div>

                  {/* حقل البحث بالاسم أو الإيميل */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={subscribersSearch}
                      onChange={(e) => setSubscribersSearch(e.target.value)}
                      placeholder="بحث باسم الطالب أو بريده..."
                      className="w-full pl-3 pr-8 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#121c32] text-xs font-medium text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* جدول العرض الشامل */}
                {filteredStudents.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#121c32]/50 rounded-2xl">
                    <Users className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-60" />
                    <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      {subscribersSearch.trim()
                        ? 'لم يتم العثور على أي طالب يطابق البحث'
                        : subscribersTab === 'subscribed'
                        ? 'لا يوجد أي طالب مشترك بالباقة حالياً'
                        : subscribersTab === 'unsubscribed'
                        ? 'لا يوجد طلاب غير مشتركين حالياً'
                        : subscribersTab === 'downloaded'
                        ? 'لم يقم أي طالب بتحميل ملفات بعد'
                        : 'لا يوجد طلاب مسجلون حالياً'}
                    </p>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                      يمكنك تفعيل الاشتراك يدوياً لأي طالب أو استخدام كاشير وإنستاباي لتفعيل الوصول.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[420px] rounded-xl border border-slate-100 dark:border-slate-800">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 sticky top-0 z-10">
                        <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                          <th className="py-3 px-3 font-bold">الطالب</th>
                          <th className="py-3 px-3 font-bold">البريد الإلكتروني</th>
                          <th className="py-3 px-3 font-bold">تليجرام</th>
                          <th className="py-3 px-3 font-bold text-center">حالة الاشتراك 🎓</th>
                          <th className="py-3 px-3 font-bold text-center">تحميل الملفات 📥</th>
                          <th className="py-3 px-3 font-bold">الصلاحية</th>
                          <th className="py-3 px-3 font-bold text-center">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredStudents.map((st) => (
                          <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                st.isSubscribed
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}>
                                {st.fullName ? st.fullName.charAt(0) : 'ط'}
                              </div>
                              <span className="truncate max-w-[140px]">{st.fullName || 'طالب طرقع'}</span>
                            </td>

                            <td className="py-3 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                              {st.email || 'غير مسجل'}
                            </td>

                            <td className="py-3 px-3 text-[11px] text-slate-600 dark:text-slate-300">
                              {st.telegramUsername ? (
                                <a
                                  href={`https://t.me/${st.telegramUsername.replace(/^@/, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-500 hover:underline font-mono"
                                >
                                  @{st.telegramUsername.replace(/^@/, '')}
                                </a>
                              ) : (
                                <span className="text-slate-400 italic">غير مربوط</span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {st.isSubscribed ? (
                                <span className="px-2.5 py-1 rounded-lg font-black text-[11px] bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>مشترك بالباقة ✅</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-lg font-bold text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                                  <span>⚪ غير مشترك</span>
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {st.hasDownloadedFiles || (st.downloadedFilesCount && st.downloadedFilesCount > 0) ? (
                                <button
                                  type="button"
                                  onClick={() => setSelectedStudentForFiles(st)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer inline-flex items-center gap-1"
                                  title="عرض تفاصيل الملفات المحملة"
                                >
                                  <Download className="w-3 h-3" />
                                  <span>{st.downloadedFilesCount || st.downloadedFiles?.length || 1} ملفات 📥</span>
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">لم يحمّل بعد</span>
                              )}
                            </td>

                            <td className="py-3 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {st.isSubscribed ? (
                                st.subscriptionExpiresAt ? (
                                  new Date(st.subscriptionExpiresAt).toLocaleDateString('ar-SA', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                ) : (
                                  '365 يوماً'
                                )
                              ) : (
                                '-'
                              )}
                            </td>

                            <td className="py-3 px-3 text-center">
                              {st.isSubscribed ? (
                                <button
                                  type="button"
                                  onClick={() => handleManualCancelSubscription(st)}
                                  className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[11px] font-bold transition cursor-pointer"
                                  title="إلغاء اشتراك الطالب"
                                >
                                  <UserX className="w-3 h-3 inline ml-1" />
                                  <span>إلغاء الاشتراك</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleManualActivateSubscription(st)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition cursor-pointer inline-flex items-center gap-1"
                                  title="تفعيل الاشتراك السنوي للطالب"
                                >
                                  <Sparkles className="w-3 h-3" />
                                  <span>تفعيل الاشتراك 🚀</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* نافذة منبثقة لعرض ملفات الطالب المحملة (Files Download Modal) */}
                {selectedStudentForFiles && (
                  <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700 shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold">
                            <Download className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                              سجل تحميلات الطالب: {selectedStudentForFiles.fullName || selectedStudentForFiles.email}
                            </h4>
                            <p className="text-[10px] text-slate-400">
                              إجمالي الملفات: {selectedStudentForFiles.downloadedFilesCount || selectedStudentForFiles.downloadedFiles?.length || 0} ملفاً مسجلاً في السيرفر
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedStudentForFiles(null)}
                          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {selectedStudentForFiles.downloadedFiles && selectedStudentForFiles.downloadedFiles.length > 0 ? (
                          selectedStudentForFiles.downloadedFiles.map((file, idx) => (
                            <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 truncate">
                                <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="font-bold text-slate-800 dark:text-slate-200 truncate">{file.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 text-[10px] text-slate-400 font-mono">
                                <span>{file.fileSize || 'PDF'}</span>
                                {file.downloadedAt && (
                                  <span>{new Date(file.downloadedAt).toLocaleDateString('ar-SA')}</span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-center text-xs text-slate-400 py-4">لا توجد تفاصيل للملفات الفردية مسجلة</p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={async () => {
                            if (window.confirm('هل أنت متأكد من تصفير سجل تحميلات هذا الطالب؟')) {
                              await downloadTrackingService.clearUserDownloads(selectedStudentForFiles.id, selectedStudentForFiles.email);
                              setSelectedStudentForFiles(null);
                              await loadRealStats();
                              showToast('تم تصفير سجل تحميلات الطالب بنجاح! 🗑️', 'info');
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 text-[11px] font-bold border border-rose-500/30 transition cursor-pointer"
                        >
                          تصفير سجل التحميلات 🗑️
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedStudentForFiles(null)}
                          className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition hover:bg-slate-200"
                        >
                          إغلاق
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* استمارة إعدادات ومفاتيح كاشير */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl space-y-6">
            <div className="flex items-center justify-between pb-3 border-b-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-amber-300">
                  بيانات الربط والمفاتيح البرمجية (Kashier API Credentials)
                </h3>
              </div>
              <span className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                يتم حفظ المفاتيح مشفرة ومحمية محلياً وسحابياً
              </span>
            </div>

            <form onSubmit={handleSaveKashierConfig} className="space-y-5">
              {/* المفاتيح والخيارات العلوية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* تفعيل / تعطيل البوابة */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#121c32] border-2 border-slate-200 dark:border-slate-700 flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">تفعيل بوابة كاشير</h4>
                    <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-300">إظهار نافذة كاشير عند الاشتراك</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setKashierSettings({ ...kashierSettings, enabled: !kashierSettings.enabled })}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                      kashierSettings.enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                        kashierSettings.enabled ? 'right-0.5' : 'right-6'
                      }`}
                    />
                  </button>
                </div>

                {/* بيئة العمل: تجريبية أم حية */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-[#121c32] border-2 border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
                  <label className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                    بيئة التشغيل (Environment)
                  </label>
                  <select
                    value={kashierSettings.mode}
                    onChange={(e) => setKashierSettings({ ...kashierSettings, mode: e.target.value as 'test' | 'live' })}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs text-slate-900 dark:text-white font-bold focus:border-amber-500"
                  >
                    <option value="test">🧪 بيئة الاختبار التجريبية (Test Mode)</option>
                    <option value="live">🟢 بيئة الإنتاج الحقيقية (Live Mode)</option>
                  </select>
                </div>
              </div>

              {/* حقول المفاتيح الرقمية */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Merchant ID */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-amber-300 mb-1">
                    معرف التاجر (Merchant ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={kashierSettings.merchantId}
                    onChange={(e) => setKashierSettings({ ...kashierSettings, merchantId: e.target.value.trim() })}
                    placeholder="MID-XXXX-XXXX"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs font-mono font-bold text-slate-900 dark:text-white text-left focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                {/* API Key */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-amber-300 mb-1">
                    مفتاح الـ API (api-key) *
                  </label>
                  <input
                    type="text"
                    value={kashierSettings.apiKey}
                    onChange={(e) => setKashierSettings({ ...kashierSettings, apiKey: e.target.value.trim() })}
                    placeholder="ضع مفتاح API من لوحة كاشير"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs font-mono font-bold text-slate-900 dark:text-white text-left focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>

                {/* Secret Key */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-800 dark:text-amber-300">
                      المفتاح السري (Secret Key / Authorization) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowKashierSecret(!showKashierSecret)}
                      className="text-[10px] text-amber-500 hover:underline flex items-center gap-1 cursor-pointer font-bold"
                    >
                      {showKashierSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      <span>{showKashierSecret ? 'إخفاء' : 'إظهار'}</span>
                    </button>
                  </div>
                  <input
                    type={showKashierSecret ? 'text' : 'password'}
                    value={kashierSettings.secretKey}
                    onChange={(e) => setKashierSettings({ ...kashierSettings, secretKey: e.target.value.trim() })}
                    placeholder="YOUR_SECRET_KEY"
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs font-mono font-bold text-slate-900 dark:text-white text-left focus:outline-none focus:border-amber-500"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* السعر والعملة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-amber-300 mb-1">
                    عملة الدفع الافتراضية (Default Currency)
                  </label>
                  <select
                    value={kashierSettings.currency}
                    onChange={(e) => {
                      const newCur = e.target.value as 'EGP' | 'SAR';
                      setKashierSettings({
                        ...kashierSettings,
                        currency: newCur,
                        amount: newCur === 'SAR' ? 75 : 1100,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="SAR">🇸🇦 SAR (75 ريال سعودي)</option>
                    <option value="EGP">🇪🇬 EGP (1100 جنيه مصري)</option>
                  </select>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setKashierSettings({ ...kashierSettings, currency: 'SAR', amount: 75 })}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#121c32] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-bold hover:text-amber-500 cursor-pointer shadow-sm"
                    >
                      تعيين 75 ريال 🇸🇦
                    </button>
                    <button
                      type="button"
                      onClick={() => setKashierSettings({ ...kashierSettings, currency: 'EGP', amount: 1100 })}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-[#121c32] text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-bold hover:text-amber-500 cursor-pointer shadow-sm"
                    >
                      تعيين 1100 جنيه 🇪🇬
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-amber-300 mb-1">
                    سعر الباقة السنوية المعتمد
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={kashierSettings.amount}
                    onChange={(e) => setKashierSettings({ ...kashierSettings, amount: parseFloat(e.target.value) || (kashierSettings.currency === 'SAR' ? 75 : 1100) })}
                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-[#080d1a] text-xs font-bold text-slate-900 dark:text-white font-mono"
                  />
                  <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    المبلغ الافتراضي: <strong>75 ريال سعودي</strong> للطلاب بالسعودية أو <strong>1100 جنيه مصري</strong> للطلاب بمصر.
                  </p>
                </div>
              </div>

              {/* رسالة نتيجة فحص الاتصال */}
              {kashierTestResult && (
                <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#121c32] border-2 border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-sm space-y-2">
                  <div className="break-all">{kashierTestResult}</div>
                  {kashierTestResult.includes('http') && (
                    <div className="pt-1">
                      <a
                        href={kashierTestResult.match(/https?:\/\/[^\s]+/)?.[0] || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow transition cursor-pointer"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>فتح واختبار رابط جلسة الدفع الآن في نافذة جديدة ↗️</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* أزرار الحفظ والفحص */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  disabled={isTestingKashier}
                  onClick={handleTestKashierConnection}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-[#121c32] hover:bg-slate-200 dark:hover:bg-[#1a2847] border-2 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 font-bold text-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {isTestingKashier ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري فحص الاتصال...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span>فحص الاتصال الفوري وتوليد جلسة</span>
                    </>
                  )}
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Save className="w-4 h-4" />
                  <span>حفظ إعدادات كاشير</span>
                </button>
              </div>

            </form>
          </div>

          {/* سجل المعاملات المالية الحية (Live Transactions Log) */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-700/80 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-amber-300">
                  سجل عمليات الدفع والاشتراكات عبر كاشير ({kashierTransactions.length})
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await rolesService.deepSyncAllStudentsData();
                    setKashierTransactions(getKashierTransactions());
                    showToast('تمت المزامنة والتحديث الشامل لبيانات العمليات والاشتراكات بنجاح! 🚀', 'success');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#121c32] hover:bg-slate-200 dark:hover:bg-[#1a2847] border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>تحديث ومزامنة شاملة للعمليات والاشتراكات 🔄</span>
                </button>

                {kashierTransactions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('هل تريد مسح سجل معاملات كاشير؟')) {
                        clearKashierTransactions();
                        setKashierTransactions([]);
                        showToast('تم مسح سجل المعاملات بنجاح.', 'info');
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                  >
                    تفريغ السجل
                  </button>
                )}
              </div>
            </div>

            {kashierTransactions.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-[#121c32]/50 rounded-2xl">
                <CreditCard className="w-12 h-12 text-slate-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  لا توجد معاملات مسجلة حتى الآن
                </p>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  عند قيام الطلاب بالدفع أو تجربة جلسة دفع تجريبية، ستظهر كافة العمليات هنا مباشرة.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                      <th className="pb-3 font-bold">الوقت والتاريخ</th>
                      <th className="pb-3 font-bold">رقم الطلب (Order ID)</th>
                      <th className="pb-3 font-bold">الطالب</th>
                      <th className="pb-3 font-bold">المبلغ والعملة</th>
                      <th className="pb-3 font-bold">الحالة</th>
                      <th className="pb-3 font-bold">التفاصيل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {kashierTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString('ar-SA')} - {new Date(tx.timestamp).toLocaleDateString('ar-SA')}
                        </td>
                        <td className="py-3 font-mono font-bold text-slate-800 dark:text-slate-200">
                          {tx.orderId}
                        </td>
                        <td className="py-3 font-bold text-slate-900 dark:text-slate-200">
                          {tx.userName}
                          <span className="block font-mono text-[10px] text-slate-400 font-normal">
                            {tx.userEmail}
                          </span>
                        </td>
                        <td className="py-3 font-mono font-black text-amber-600 dark:text-amber-400 text-sm">
                          {tx.amount} {tx.currency}
                        </td>
                        <td className="py-3">
                          <span className={`px-2.5 py-1 rounded-lg font-bold text-[11px] inline-block ${
                            tx.status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40'
                              : tx.status === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40'
                          }`}>
                            {tx.status === 'SUCCESS' && 'ناجح مكتمل ✅'}
                            {tx.status === 'FAILED' && 'ملغي أو مرفوض ❌'}
                            {tx.status === 'PENDING' && 'معلق (انتظار) ⏳'}
                          </span>
                        </td>
                        <td className="py-3 text-slate-700 dark:text-slate-200 font-medium text-[11px]">
                          {tx.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </section>
      )}

      {/* ======================================================================= */}
      {/* 5. محرك كاشينج وتسريع قواعد البيانات (Database Caching Engine Section) */}
      {/* ======================================================================= */}
      {activeTab === 'dbCache' && (
        <section className="space-y-6">
          
          {/* بطاقة الحالة الرئيسية لمحرك الكاشينج */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-[#0a192f] to-[#030712] border-2 border-sky-500/50 shadow-2xl relative overflow-hidden text-white backdrop-blur-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-600/30 border-2 border-sky-500/50 flex items-center justify-center text-sky-400 shrink-0 shadow-lg shadow-sky-500/20">
                  <Cpu className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h2 className="text-xl font-black text-white">محرك تسريع وكاشينج الداتابيز (Tarqa DB Caching Engine)</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold font-mono flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>نشط (L1 In-Memory + L2 Persistent)</span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 border border-sky-500/40 text-sky-300 text-xs font-bold font-mono">
                      Stale-While-Revalidate (SWR)
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                    نظام كاشينج متقدم متعدد الطبقات يقوم بحفظ نتائج الاستعلامات الثقيلة (الأسئلة، الدورات، المحاضرات، المستخدمين، والصلاحيات) في الذاكرة الحية (L1 Map) والتخزين الدائم (L2 Storage)، مما يقلل زمن التحميل إلى أقل من 0.05ms ويمنع الضغط المتكرر على قاعدة بيانات Supabase.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleRunBenchmark}
                  disabled={isBenchmarking}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center gap-2 transition active:scale-95 disabled:opacity-50"
                >
                  <Gauge className="w-4 h-4" />
                  <span>{isBenchmarking ? 'جاري الفحص...' : 'فحص سرعة القراءة (Benchmark)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* لوحة التحكم وإجراءات تفريغ الكاش الموجه (Targeted Cache Invalidation) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            
            {/* بطاقة كاش الدورات والمحاضرات */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold">
                    <Layers className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-bold">
                    Tag: courses
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  كاش الدورات والملفات والمحاضرات
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تسريع تصفح موديولات التأسيس، روابط الفيديوهات، وتراخيص ملفات PDF للطلاب المشتركين (TTL: 60 دقيقة).
                </p>
              </div>
              <button
                type="button"
                onClick={handlePurgeCoursesCache}
                className="w-full py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث كاش الدورات</span>
              </button>
            </div>

            {/* بطاقة كاش المستخدمين والصلاحيات */}
            <div className="p-5 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-800 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                    Tag: users
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                  كاش المستخدمين والاشتراكات
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  تخزين مجمع لبيانات الأعضاء وسجلات التحميل وحالة الرتب والاشتراكات السحابية (TTL: 3 دقائق).
                </p>
              </div>
              <button
                type="button"
                onClick={handlePurgeUsersCache}
                className="w-full py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>تحديث كاش المستخدمين</span>
              </button>
            </div>

            {/* بطاقة تفريغ الكاش بالكامل */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-500/5 to-red-500/10 dark:bg-[#180e18] border-2 border-rose-500/30 shadow-xl flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 flex items-center justify-center font-bold">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold">
                    Global Flush
                  </span>
                </div>
                <h3 className="text-sm font-bold text-rose-700 dark:text-rose-300 mb-1">
                  تفريغ كامل الكاشينج (Flush All)
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  مسح جميع الجداول والبيانات المؤقتة من الذاكرة الحية والمتصفح وإجبار النظام على إعادة المزامنة.
                </p>
              </div>
              <button
                type="button"
                onClick={handlePurgeAllCache}
                className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/20"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>تفريغ الذاكرة بالكامل 🧹</span>
              </button>
            </div>

          </div>

          {/* تفاصيل المعمارية البرمجية وآلية العمل الذكية */}
          <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c1324] border-2 border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Sparkles className="w-5 h-5 text-sky-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                المزايا التقنية لمحرك Tarqa Database Caching
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-sky-500 font-bold text-xs">
                  <Zap className="w-4 h-4" />
                  <span>Stale-While-Revalidate (SWR)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  يعرض البيانات القديمة للطالب فوراً في 0 ثانية بدون شاشة تحميل، بينما يتم جلب وتحديث التغييرات الجديدة بهدوء في الخلفية.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                  <Activity className="w-4 h-4" />
                  <span>Request Deduplication (دمج الطلبات)</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  إذا طلب 5 مكونات أو صفحات نفس السؤال أو الدورة في نفس اللحظة، يتم تنفيذ استعلام واحد فقط سحابياً ومشاركته للجميع.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2 text-purple-500 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Tag-Based Smart Invalidation</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  بمجرد إضافة سؤال جديد، تعديل رتبة مستخدم، أو منح اشتراك، يقوم النظام بإلغاء الكاش الخاص بتلك الفئة تلقائياً بدون تدخل يدوي.
                </p>
              </div>
            </div>
          </div>

        </section>
      )}

      {/* ======================================================================= */}
      {/* 6. تبويب إدارة المميزات وروابط مجتمع تليجرام */}
      {/* ======================================================================= */}
      {activeTab === 'features' && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <FeaturesManagementTab />
        </section>
      )}

      {/* ======================================================================= */}
      {/* 7. تبويب حالة الموقع ووضع الصيانة */}
      {/* ======================================================================= */}
      {activeTab === 'maintenance' && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <SiteMaintenanceTab />
        </section>
      )}

      {/* 8. تبويب مولّد وإدارة الكوبونات والخصومات (مربوط بقاعدة البيانات) */}
      {activeTab === 'promo' && (
        <section className="space-y-6 animate-in fade-in duration-300">
          <PromoCodeGenerator />
        </section>
      )}
    </div>
  );
};
