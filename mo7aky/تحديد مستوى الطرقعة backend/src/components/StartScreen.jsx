import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Clock, BookOpen, Play, Filter, GraduationCap, Target, Settings, CheckCircle, ArrowLeft, Home, X, Plus, Minus, LogOut, History, FileText, AlertTriangle, Sun, Moon } from 'lucide-react';
import { useExamStore } from '../store/examStore';
import { resetDataLoader, initializeQuestionData, bankMapping, categoryMapping, getAllQuestions } from '../utils/dataLoader';
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';

import StatsModal from './StatsModal';
import ThemeDock from './ThemeDock';
import { toast } from "sonner";

// Telegram Login Widget Component using data-auth-url for redirects
const TelegramLoginWidget = ({ onDevLogin }) => {
  const isDev = typeof window !== 'undefined' && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

  useEffect(() => {
    if (isDev) return;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js';
    script.async = true;
    script.setAttribute('data-telegram-login', 'TarqaBot');
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', 'Login/auth.php'); // Use redirect-based auth

    const container = document.getElementById('telegram-login-container');
    if (container) {
      container.appendChild(script);
    }

    return () => {
      if (container && container.firstChild) {
        container.removeChild(script);
      }
    }
  }, [isDev]);

  if (isDev) {
    return (
      <div className="flex flex-col items-center gap-3 p-4 bg-slate-800/90 rounded-xl border border-orange-500/30 max-w-sm text-center shadow-lg">
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-amber-300 font-medium border border-orange-500/30">
          وضع التطوير المحلي (Local Dev)
        </span>
        <p className="text-xs text-slate-300">
          تيليجرام لا يسمح بـ localhost في ودجت الدخول مباشرة. سجل الدخول التجريبي للمتابعة:
        </p>
        <button
          type="button"
          onClick={onDevLogin}
          className="w-full py-2 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold rounded-lg shadow-lg transition-all duration-200 cursor-pointer text-sm"
        >
          تسجيل دخول تجريبي (Dev Login)
        </button>
        <span className="text-[11px] text-slate-400">
          بوت تيليجرام الحقيقي يتطلب نفقاً (ngrok) مع /setdomain في BotFather.
        </span>
      </div>
    );
  }

  return <div id="telegram-login-container"></div>;
};

const StartScreen = () => {
  const { user, setUser, initializeExam, showHistory, smartExamProgress, totalQuestionsInPool, fetchSmartExamProgress, resetSmartExamProgress, resetBankProgress, resetCategoryProgress, resetSpecificProgress, isSmartExamEnabled, toggleSmartExam, nightMode, toggleNightMode } = useExamStore();
  const [loading, setLoading] = useState(true);

  // Safety timer to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [showFinishedScreen, setShowFinishedScreen] = useState(false);

  // Initialize app: check session and load data
  useEffect(() => {
    const initializeApp = async () => {
      resetDataLoader(); // Clear cache on every app start
      if (typeof window !== 'undefined') {
        window.toggleDevBypass = (enable) => {
          if (enable === undefined) {
            const current = localStorage.getItem('dev_bypass') !== 'false';
            localStorage.setItem('dev_bypass', current ? 'false' : 'true');
            console.log(`Dev Bypass is now ${!current ? 'ENABLED' : 'DISABLED'}. Reloading...`);
          } else {
            localStorage.setItem('dev_bypass', enable ? 'true' : 'false');
            console.log(`Dev Bypass set to ${enable ? 'ENABLED' : 'DISABLED'}. Reloading...`);
          }
          window.location.reload();
        };
      }

            const devBypassEnv = import.meta.env?.VITE_DEV_BYPASS;
      const localBypassSetting = typeof window !== 'undefined' ? localStorage.getItem('dev_bypass') : null;
      const isBypassExplicitlyDisabled = devBypassEnv === 'false' || devBypassEnv === '0' || localBypassSetting === 'false' || localBypassSetting === '0';
      const allowedDevHosts = ['localhost', '127.0.0.1', '::1'];
      const isDev = typeof window !== 'undefined' && allowedDevHosts.includes(window.location.hostname);
      const canBypass = isDev && !isBypassExplicitlyDisabled;

      const sessionCheck = async () => {
        /* canBypass hoisted to initializeApp */

        try {
          const response = await fetch('Login/auth.php?check_session', { credentials: 'include' });
          if (response.ok) {
            const data = await response.json();
            if (data && data.success && data.logged_in && data.user) {
              const userRoleId = parseInt(data.user?.role_id ?? 6, 10);
              const rootRoleId = parseInt(data.role_id ?? 6, 10);

              // 🛡️ Anti-Tampering Check: Reject if root role_id is overridden to mismatch user.role_id
              if (userRoleId !== rootRoleId) {
                console.warn('Security alert: Role mismatch detected between user object and root session.');
                setUser(null);
                setIsAuthorized(false);
                return null;
              }

              const roleId = userRoleId;
              const isExpired = Boolean(data.is_expired || data.user?.is_expired);
              const permissions = Array.isArray(data.permissions) ? data.permissions : [];

              // Authorized roles: 1 (Owner), 2 (Super Admin), 3 (Admin), 4 (Editor), 5 (Member / Subscriber)
              // Role 6 (Guest / Normal User / Expired) is NOT authorized
              const hasAuthorizedRole = [1, 2, 3, 4, 5].includes(roleId);
              const hasAdminPermission = permissions.includes('admin') || permissions.includes('access_simulators') || permissions.includes('access_exams');
              const authorized = (hasAuthorizedRole && !isExpired) || hasAdminPermission;

              const enhancedUser = {
                ...data.user,
                role_id: roleId,
                is_expired: isExpired,
                permissions: permissions,
                role: data.user.role || (roleId <= 3 ? 'admin' : (roleId === 4 ? 'editor' : (roleId === 5 ? 'member' : 'user')))
              };

              setUser(enhancedUser);
              setIsAuthorized(authorized);
              return authorized ? enhancedUser : null;
            }
          }
        } catch (error) {
          console.warn('Session check warning:', error);
        }

        // Skip login and automatically authenticate dev user only on strictly local loopback
        if (canBypass) {
          const devUser = {
            first_name: 'Local',
            last_name: 'Developer',
            username: 'dev',
            photo_url: 'https://i.ibb.co/tMMyJj2y/icon.jpg',
            role: 'owner',
            role_id: 1,
            id: '123456789'
          };
          setUser(devUser);
          setIsAuthorized(true);
          return devUser;
        }

        setUser(null);
        setIsAuthorized(false);
        return null;
      };

      // Run session check and metadata loading
      try {
        const currentUser = await sessionCheck();
        if (currentUser) {
          // 🎯 Metadata Only on Mount: ONLY fetches exam names and question counts (ZERO questions downloaded!)
          const banks = await initializeQuestionData();
          // Verify server authorized at least 1 bank and did not return 403 Forbidden
          if (!banks || (Array.isArray(banks) && banks.length === 0) || (typeof banks === 'object' && Object.keys(banks).length === 0)) {
            if (!canBypass) {
              console.warn('Server access denied to question banks. Disallowing unauthorized session.');
              setIsAuthorized(false);
              setUser(null);
              setLoading(false);
              return;
            }
            console.info('Dev Bypass active: Continuing despite unauthenticated remote question banks.');
          }
          if (typeof fetchSmartExamProgress === 'function') {
            fetchSmartExamProgress();
          }
        }
      } catch (err) {
        console.warn('Initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [setUser, fetchSmartExamProgress]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('Login/logout.php', { credentials: 'include' });
    } catch (error) {
      console.error('Error logging out:', error);
    }
    setUser(null);
    setIsAuthorized(false);
    window.location.reload();
  }, [setUser]);

  const handleDevLogin = useCallback(() => {
    localStorage.setItem('dev_bypass', 'true');
    const devUser = {
      first_name: 'Local',
      last_name: 'Developer',
      username: 'dev',
      photo_url: 'https://i.ibb.co/tMMyJj2y/icon.jpg',
      role: 'owner',
      role_id: 1,
      id: '123456789'
    };
    setUser(devUser);
    setIsAuthorized(true);
    toast.success('تم تسجيل الدخول بوضع التطوير المحلي');
  }, [setUser]);

  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
    };

    const handleKeyDown = (event) => {
      // F12
      if (event.key === 'F12') {
        event.preventDefault();
      }
      // Ctrl+Shift+I
      if (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'i')) {
        event.preventDefault();
      }
      // Ctrl+C
      if (event.ctrlKey && (event.key === 'C' || event.key === 'c')) {
        event.preventDefault();
      }
      // Ctrl+V
      if (event.ctrlKey && (event.key === 'V' || event.key === 'v')) {
        event.preventDefault();
      }
      // Ctrl+P
      if (event.ctrlKey && (event.key === 'P' || event.key === 'p')) {
        event.preventDefault();
      }
      // Ctrl+S
      if (event.ctrlKey && (event.key === 'S' || event.key === 's')) {
        event.preventDefault();
      }

    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);


    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);

    };
  }, []);

  // Add scrollbar stability on component mount
  useEffect(() => {
    document.documentElement.style.overflowY = 'scroll';
    return () => {
      document.documentElement.style.overflowY = '';
    };
  }, []);

  // Load saved settings from localStorage
  const loadSavedSettings = () => {
    const defaultSettings = {
      examMode: 'sectioned',
      timerMode: 'none',
      selectedTimerDuration: 11,
      questionTypeFilter: 'all',
      selectedQuestionTypes: [],
      rcQuestionOrder: 'sequential'
    };

    try {
      const saved = localStorage.getItem('examSettings');
      if (saved) {
        const parsedSaved = JSON.parse(saved);
        return { ...defaultSettings, ...parsedSaved };
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
      return defaultSettings;
    }

    return defaultSettings;
  };

  const [settings, setSettings] = useState(loadSavedSettings());
  const [isLoading, setIsLoading] = useState(false);
  const [isMultipleTypeModalOpen, setIsMultipleTypeModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [isTimerDurationModalOpen, setIsTimerDurationModalOpen] = useState(false);
  const [isResetConfirmModalOpen, setIsResetConfirmModalOpen] = useState(false);
  const [resetScope, setResetScope] = useState('all'); // 'all', 'bank', 'category', 'specific'
  const [resetTarget, setResetTarget] = useState([]); // can contain "BANK:key" or "CAT:bank:cat"
  const [focusedBank, setFocusedBank] = useState(null);

  const {
    examMode,
    timerMode,
    selectedTimerDuration,
    questionTypeFilter,
    selectedQuestionTypes,
    rcQuestionOrder
  } = settings;

  useEffect(() => {
    localStorage.setItem('examSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const questionTypes = [
    { value: 'analogy', label: 'التناظر اللفظي', icon: '🔗', description: 'العلاقات بين الكلمات' },
    { value: 'completion', label: 'اكمال الجمل', icon: '📝', description: 'ملء الفراغات المناسبة' },
    { value: 'error', label: 'الخطا السياقي', icon: '🔍', description: 'تحديد الاخطاء اللغوية' },
    { value: 'rc', label: 'استيعاب المقروء', icon: '📖', description: 'فهم النصوص والمقاطع' },
    { value: 'odd', label: 'المفردة الشاذة', icon: '🎯', description: 'تحديد الكلمة المختلفة' }
  ];

  const handleStartExam = async () => {
    if (isLoading) return;

    setIsLoading(true);

    const config = {
      examMode: examMode,
      timerMode,
      timerDuration: timerMode === 'none' ? 0 : selectedTimerDuration,
      shuffleQuestions: false,
      shuffleAnswers: false,
      questionTypeFilter,
      selectedQuestionTypes: questionTypeFilter === 'multiple' ? selectedQuestionTypes : [],
      rcQuestionOrder,
      excludeQuestionIds: isSmartExamEnabled ? smartExamProgress : [],
    };

    try {
      // Request fullscreen
      if (document.documentElement.requestFullscreen) {
        try {
          await document.documentElement.requestFullscreen();
        } catch (err) {
          console.log("Fullscreen failed or not supported:", err);
        }
      }

      await initializeExam(config);
    } catch (error) {
      console.error("Failed to start exam:", error);
      if (error.message.includes('no questions available')) {
        setShowFinishedScreen(true);
      } else {
        alert(`فشل بدء الاختبار: ${error.message}`);
      }

      // If exam fails to start, exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAndRestart = async () => {
    await resetSmartExamProgress();
    setShowFinishedScreen(false);
  };

  const handleResetSmartExamFromSettings = () => {
    setIsResetConfirmModalOpen(true);
  };

  const handleConfirmResetSmartExam = async () => {
    if (resetScope === 'all') {
      await resetSmartExamProgress();
      toast.success("تم إعادة تعيين جميع التقدم بنجاح");
    } else if (resetScope === 'category' && resetTarget.length > 0) {
      await resetCategoryProgress(resetTarget);
      toast.success(`تم إعادة تعيين تقدم ${resetTarget.length} اقسام بنجاح`);
    } else if (resetScope === 'bank' && resetTarget.length > 0) {
      // Parse mixed selection (Whole banks + Specifics)
      const fullBanks = [];
      const specificItems = [];

      resetTarget.forEach(item => {
        if (item.startsWith('BANK:')) {
          fullBanks.push(item.split(':')[1]);
        } else if (item.startsWith('CAT:')) {
          const parts = item.split(':');
          specificItems.push({ bank: parts[1], category: parts[2] });
        }
      });

      if (fullBanks.length > 0) await resetBankProgress(fullBanks);
      if (specificItems.length > 0) await resetSpecificProgress(specificItems);

      toast.success("تم تحديث تقدم الملفات بنجاح");
    } else if (resetScope === 'specific' && resetTarget.length > 0) {
      await resetSpecificProgress(resetTarget);
      toast.success(`تم إعادة تعيين ${resetTarget.length} من الاختيارات المحددة بنجاح`);
    }

    setIsResetConfirmModalOpen(false);
    setResetScope('all');
    setResetTarget([]);
    setFocusedBank(null);
  };

  const handleTimerModeChange = (mode) => {
    updateSetting('timerMode', mode);
  };

  const openMultipleTypeModal = () => setIsMultipleTypeModalOpen(true);

  const handleCloseMultipleTypeModal = () => {
    if (selectedQuestionTypes.length === 5) {
      updateSetting('questionTypeFilter', 'all');
      updateSetting('selectedQuestionTypes', []);
    }
    setIsMultipleTypeModalOpen(false);
  };

  const openTimerDurationModal = () => setIsTimerDurationModalOpen(true);
  const closeTimerDurationModal = () => setIsTimerDurationModalOpen(false);

  const handleTimerDurationSelect = (duration) => {
    updateSetting('selectedTimerDuration', parseInt(duration));
    closeTimerDurationModal();
  };

  const handleMultipleTypeToggle = (type) => {
    const currentTypes = [...selectedQuestionTypes];
    const index = currentTypes.indexOf(type);

    if (index > -1) {
      currentTypes.splice(index, 1);
    } else {
      currentTypes.push(type);
    }

    updateSetting('selectedQuestionTypes', currentTypes);
  };

  const handleConfirmMultipleTypeSelection = () => {
    handleCloseMultipleTypeModal();
  };

  const getSelectedMultipleTypesDisplay = () => {
    // This check is now safe because selectedQuestionTypes is guaranteed to be an array
    const count = selectedQuestionTypes.length;

    if (count === 0) {
      return 'اختر الانواع المطلوبة';
    }

    switch (count) {
      case 1:
        return 'نوع واحد محدد';
      case 2:
        return 'نوعين محددين';
      case 3:
        return 'ثلاثة انواع محددة';
      case 4:
        return 'اربعة انواع محددة';
      case 5:
        return 'خمسة انواع محددة';
      default:
        return `${count} انواع محددة`;
    }
  };

  const getMultipleTypesDistribution = () => {
    if (selectedQuestionTypes.length === 0) return '';

    const numTypes = selectedQuestionTypes.length;
    const baseCount = Math.floor(55 / numTypes);
    const remainder = 55 % numTypes;

    let distributionText = '';
    selectedQuestionTypes.forEach((type, index) => {
      const typeInfo = questionTypes.find(t => t.value === type);
      const count = baseCount + (index < remainder ? 1 : 0);
      distributionText += `${typeInfo?.label}: ${count} سؤال${index < selectedQuestionTypes.length - 1 ? ' • ' : ''}`;
    });

    return distributionText;
  };

  const shouldShowRCOrderSection = () => {
    return questionTypeFilter === 'all' ||
      (questionTypeFilter === 'multiple' && selectedQuestionTypes.includes('rc'));
  };

  if (loading) {
    return (
      <div dir="rtl" className="fixed inset-0 w-full h-full flex items-center justify-center p-4 z-50">
        <div className="text-center text-white">
          <svg className="animate-spin h-10 w-10 text-white mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div dir="rtl" className="fixed inset-0 w-full h-full flex items-center justify-center p-4 z-50">
        <div className="text-center text-white p-8 aurora-dialog-content rounded-2xl max-w-md w-full">
          <div className="flex justify-center mb-6">
            <img
              src="/logo1.png"
              alt="تحديد المستوى - محاكي الطرقعة"
              className="h-24 w-24 transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
            />
          </div>
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
            مرحباً بك في تحديد المستوى - محاكي الطرقعة
          </h1>
          <p className="mb-8 text-slate-300">الرجاء تسجيل الدخول باستخدام تيليجرام للمتابعة</p>
          <div className="flex justify-center">
            <TelegramLoginWidget onDevLogin={handleDevLogin} />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div dir="rtl" className="fixed inset-0 w-full h-full flex items-center justify-center p-4 z-50 bg-[#001020]/90 backdrop-blur-md">
        <div className="text-center text-white p-8 aurora-dialog-content rounded-2xl max-w-md w-full border border-red-500/30 shadow-2xl bg-[#001628]/95">
          <div className="flex justify-center mb-6">
            <img
              src="/logo1.png"
              alt="تحديد المستوى - محاكي الطرقعة"
              className="h-24 w-24 transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
            />
          </div>
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent">
            غير مصرح لك بالدخول
          </h1>
          <p className="mb-6 text-slate-300">
            {user && user.is_expired
              ? 'انتهت فترة اشتراكك في المنصة. يرجى تجديد الاشتراك للمتابعة.'
              : user && user.role_id === 6
                ? 'حسابك مسجل كمستخدم عادي. يتطلب هذا المحاكي اشتراكاً نشطاً.'
                : 'ليس لديك الصلاحية أو الاشتراك النشط لعرض هذا المحاكي.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => window.location.href = '/'}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold cursor-pointer"
            >
              الاشتراك وتجديد الباقة
            </Button>
            <Button onClick={handleLogout} variant="destructive" className="cursor-pointer">
              تسجيل الخروج
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const SmartExamControls = ({ isSmartExamEnabled, toggleSmartExam, smartExamProgress, totalQuestionsInPool, handleResetSmartExamFromSettings }) => (
    <div className="bg-white/10 backdrop-blur-sm sm:mt-3 border border-white/30 p-2 rounded-xl shadow-lg w-full max-w-[150px] sm:w-[250px] sm:max-w-none mx-auto sm:mx-0 transition-all duration-300 hover:bg-white/20 text-center">
      <div className="flex items-center justify-center space-x-20 space-x-reverse ">

        <Label htmlFor="smart-exam-toggle" className="text-slate-100 font-bold text-sm">
          {isSmartExamEnabled ? 'الاختبار الذكي مفعل' : 'الاختبار الذكي معطل'}
        </Label>
      </div>

      <Button
        onClick={toggleSmartExam}
        variant=""
        className="p-2 h-auto rounded-full transition-all duration-300 transform hover:scale-110 hover:bg-tran bg-trans cursor-pointer"
      >
        <CheckCircle className={`h-6 w-6 ${isSmartExamEnabled ? 'text-orange-400' : 'text-slate-600'}`} />
      </Button>
      {isSmartExamEnabled && (
        <div className="mt-2">
          <div className="text-xs text-slate-300">تقدمك: {smartExamProgress.length} / {totalQuestionsInPool}</div>
          <Button
            onClick={handleResetSmartExamFromSettings}
            size="sm"
            variant=""
            className="text-xs mt-5 bg-red-500 font-bold cursor-pointer hover:bg-red-700"
          >
            إعادة تعيين
          </Button>
        </div>
      )}
    </div>
  );


  return (
    <>

      {/* showFinishedScreen */}
      {showFinishedScreen && (
        <div dir="rtl" className="fixed inset-0 w-full h-full bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowFinishedScreen(false)}>
          <div className="text-center text-white p-8 bg-[#112240] backdrop-blur-md rounded-2xl shadow-lg border border-orange-400/20 max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-center mb-6">
              <CheckCircle className="h-24 w-24 text-orange-400" />
            </div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              تهانينا!
            </h1>
            <p className="mb-8 text-slate-300 text-lg">لقد انهيت جميع الاسئلة. قم بحذف السجل لاعادة بدء رحلة جديدة.</p>
            <Button
              onClick={() => {
                setShowFinishedScreen(false);
                setIsResetConfirmModalOpen(true);
              }}
              size="lg"
              variant=""
              className="text-lg mt-3 bg-red-500 font-bold cursor-pointer hover:bg-red-700 px-8 py-4 rounded-xl"
            >
              إعادة تعيين
            </Button>
          </div>
        </div>
      )}
      <style>{`
        ::-webkit-scrollbar { width: 12px; background: #001e3c; }
        ::-webkit-scrollbar-thumb { background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%); border-radius: 8px; border: 2px solid #001e3c; }
        ::-webkit-scrollbar-thumb:hover { background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%); }
        ::-webkit-scrollbar-corner { background: #001e3c; }
        html { scrollbar-color: #38bdf8 #001e3c; scrollbar-width: thin; }
      `}</style>
      <div dir="rtl">
        {/* {isMultipleTypeModalOpen && (
          <div className="fixed inset-0 bg-black/60 md:backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleCloseMultipleTypeModal}>
            <div className="bg-[#112240] border-2 border-orange-400/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#112240] text-slate-100 p-6 flex justify-between items-center border-b-2 border-orange-400/30">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <Filter className="h-6 w-6 text-orange-400" />
                  اختر انواع الاسئلة المتعددة
                </h3>
                <Button onClick={handleCloseMultipleTypeModal} variant="" className="text-slate-100 p-2 rounded-full cursor-pointer bg-transparent hover:bg-transparent">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-orange-400/30">
                  <h4 className="text-orange-400 font-bold mb-2 flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    معلومات التوزيع
                  </h4>
                  <p className="text-slate-300 text-sm mb-2">
                    اجمالي الاسئلة: 55 سؤال • يتم توزيعها بالتساوي بين الانواع المختارة
                  </p>
                  {selectedQuestionTypes.length > 0 && (
                    <div className="text-slate-400 text-xs">
                      {getMultipleTypesDistribution()}
                    </div>
                  )}
                </div>
                <div className="grid gap-4">
                  {questionTypes.map(type => {
                    const isSelected = selectedQuestionTypes.includes(type.value);
                    return (
                      <div
                        key={type.value}
                        onClick={() => handleMultipleTypeToggle(type.value)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${isSelected ? 'bg-slate-700 border-orange-400 shadow-md' : 'bg-slate-800 border-slate-600 hover:border-orange-400/50 hover:bg-slate-700'
                          }`}
                      >
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-2xl">{type.icon}</span>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-slate-100 mb-1">{type.label}</div>
                            <div className="text-sm text-slate-400">{type.description}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <div className="flex items-center gap-2 text-orange-400">
                                <CheckCircle className="h-6 w-6" />
                                <Minus className="h-5 w-5" />
                              </div>
                            ) : (
                              <Plus className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 flex justify-center">
                  <Button onClick={handleConfirmMultipleTypeSelection} className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-slate-900 rounded-xl font-bold cursor-pointer">
                    تاكيد الاختيار
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )} */}

        {isTimerDurationModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeTimerDurationModal}>
            <div className="aurora-dialog-content border-2 border-orange-400/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#112240] text-slate-100 p-6 flex justify-between items-center border-b-2 border-orange-400/30">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <Clock className="h-6 w-6 text-orange-400" />
                  اختر مدة المؤقت
                </h3>
                <Button onClick={closeTimerDurationModal} variant="ghost" className="cursor-pointer p-2 rounded-lg transition-all duration-300 text-slate-100 hover:bg-slate-700 hover:text-slate-100">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid gap-3">
                  {[5, 10, 11, 15, 20, 25, 30, 45, 60, 90, 120].map(duration => (
                    <div
                      key={duration}
                      onClick={() => handleTimerDurationSelect(duration)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${selectedTimerDuration === duration ? 'bg-slate-700 border-orange-400 shadow-md' : 'bg-slate-800 border-slate-600 hover:border-orange-400/50 hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between text-right">
                        <div className="font-bold text-lg text-slate-100">
                          {duration} دقيقة
                        </div>
                        {selectedTimerDuration === duration && (
                          <CheckCircle className="h-6 w-6 text-orange-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              {user && (
                <div className="absolute top-3 left-3 sm:top-6 sm:left-6 text-white flex flex-col items-end gap-3">
                  <div className="flex flex-col sm:flex-row items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/30 p-2 rounded-xl shadow-lg transition-all duration-300 hover:bg-white/20">
                    <img src={user.photo_url || 'https://i.ibb.co/tMMyJj2y/icon.jpg'} alt={user.first_name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-orange-400" />
                    <div className="hidden sm:block text-center sm:text-left">
                      <p className="text-sm sm:text-base font-bold">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-slate-300" dir="rtl">{user.username}@</p>
                    </div>
                    
              <Button
                onClick={showQuestionsManager}
                variant="ghost"
                className="text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 flex items-center gap-1.5 cursor-pointer font-bold text-xs shadow-sm transition-all"
                title="إدارة أسئلة محاكي الطرقعة"
              >
                <FileText className="h-4 w-4" />
                <span>إدارة الأسئلة 📝</span>
              </Button>
<Button onClick={showHistory} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-full cursor-pointer">
                      <History className="h-5 w-5" />
                    </Button>
                    <Button onClick={() => setIsStatsModalOpen(true)} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-full cursor-pointer">
                      <Settings className="h-5 w-5" />
                    </Button>
                    <Button
                      variant=""
                      onClick={() => {
                        toggleNightMode();
                        if (!nightMode) {
                          toast.success('تم تفعيل الوضع الليلي', {
                            description: 'سيتم تطبيق الوضع الليلي على صفحة الاختبار',
                            duration: 3000,
                          });
                        } else {
                          toast.info('تم إلغاء الوضع الليلي', {
                            duration: 2000,
                          });
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 cursor-pointer ${nightMode
                        ? 'bg-transparent border-yellow-400/50 text-yellow-400 hover:bg-white/20 hover:rounded-full'
                        : 'bg-transparent text-orange-400 hover:bg-white/20 hover:rounded-full'
                        }`}
                    >
                      {nightMode ? <Sun className="h-5 w-5 sm:h-5 sm:w-5" /> : <Moon className="h-5 w-5 sm:h-5 sm:w-5" />}
                    </Button>
                    <Button onClick={handleLogout} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-full cursor-pointer">
                      <LogOut className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="hidden sm:block">
                    <SmartExamControls
                      isSmartExamEnabled={isSmartExamEnabled}
                      toggleSmartExam={toggleSmartExam}
                      smartExamProgress={smartExamProgress}
                      totalQuestionsInPool={totalQuestionsInPool}
                      handleResetSmartExamFromSettings={handleResetSmartExamFromSettings}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="relative max-w-7xl mx-auto px-6 py-10 text-center">
            <div className="flex justify-between items-start">
              <div className="sm:hidden"> {/* Spacer for mobile */} </div>
              <Button
                variant=""
                className="absolute top-3 right-3 sm:top-6 sm:right-6 text-orange-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/30 px-2 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                onClick={() => window.location.href = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || ['5173', '5174', '5175'].includes(window.location.port)) ? ('http://' + window.location.hostname + ':5173/') : '/'}
              >
                <Home className="h-4 w-4 sm:h-6 sm:w-6 sm:ml-2" />
                <span className="font-bold text-xs sm:text-base hidden sm:inline">الصفحة الرئيسية</span>
              </Button>
              <div className="absolute top-16 right-2.5 sm:top-20 sm:right-5">
                <ThemeDock />
              </div>
            </div>

            <div className="flex justify-center mb-6 mt-10">
              <img
                src="/logo1.png"
                alt="تحديد المستوى - محاكي الطرقعة"
                className="h-40 w-40 rounded transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6 leading-tight">
              تحديد المستوى - محاكي الطرقعة
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              اختبار لتحديد مستواك بدقة لمساعدتك على الوصول لهدفك
            </p>
            <div className="flex justify-center gap-8 text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-orange-400" />
                <span>اكثر من 600+ سؤال</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-orange-400" />
                <span>5 اقسام مخصصة</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-orange-400" />
                <span>تقييم فوري</span>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-100 mb-4">اعدادات الاختبار</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              اختر الاعدادات المناسبة لك لبدء تجربة اختبار مخصصة وفعالة
            </p>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 transition-all duration-500 ${shouldShowRCOrderSection() ? 'xl:grid-cols-2' : 'xl:grid-cols-2'
            } justify-items-center max-w-1xl mx-auto`}>

            {/* <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <Filter className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">نوع الاسئلة</CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">اختر نوع اسئلة الاختبار</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RadioGroup value={questionTypeFilter} onValueChange={(value) => updateSetting('questionTypeFilter', value)}>
                  <div
                    className={`rounded-lg border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer ${questionTypeFilter === 'all' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                    onClick={() => updateSetting('questionTypeFilter', 'all')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="all" id="all-types" className="border-white text-orange-400" />
                      <Label htmlFor="all-types" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">جميع الانواع</div>
                          <div className="text-xs text-slate-400">اختبار على جميع انواع الاسئلة</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer p-3 ${questionTypeFilter === 'multiple' ? 'bg-slate-700 border-orange-400 shadow-md' : 'bg-slate-800 border-slate-600 hover:border-orange-400/50 hover:bg-slate-700'
                      }`}
                    onClick={() => {
                      updateSetting('questionTypeFilter', 'multiple');
                      openMultipleTypeModal();
                    }}
                  >
                    <div className="flex items-center justify-between text-right">
                      <ArrowLeft className="h-5 w-5 text-slate-400" />
                      <div>
                        <div className="font-bold text-slate-100 text-sm mb-1">
                          {questionTypeFilter === 'multiple' && selectedQuestionTypes.length > 0 ?
                            getSelectedMultipleTypesDisplay() : 'انواع متعددة'
                          }
                        </div>
                        <div className="text-xs text-slate-400">
                          {questionTypeFilter === 'multiple' && selectedQuestionTypes.length > 0 ? 'توزيع متساوي بين الانواع المختارة' : 'اختر عدة انواع حسب رغبتك'}
                        </div>
                      </div>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card> */}

            <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <BookOpen className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">نمط الاختبار</CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">اختر طريقة عرض الاسئلة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RadioGroup value={examMode} onValueChange={(value) => updateSetting('examMode', value)}>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${examMode === 'sectioned' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                    onClick={() => updateSetting('examMode', 'sectioned')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="sectioned" id="sectioned" className="border-white text-orange-400" />
                      <Label htmlFor="sectioned" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">اقسام مع مراجعة</div>
                          <div className="text-xs text-slate-400">اختبار مقسم مع امكانية المراجعة</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${examMode === 'single' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                    onClick={() => updateSetting('examMode', 'single')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="single" id="single" className="border-white text-orange-400" />
                      <Label htmlFor="single" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">مجمع في قسم واحد</div>
                          <div className="text-xs text-slate-400">جميع الاسئلة متتالية بدون توقف</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <Clock className="h-8 w-8 text-orange-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">اعدادات المؤقت</CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">اختر نمط المؤقت المناسب</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RadioGroup value={timerMode} onValueChange={handleTimerModeChange}>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${timerMode === 'none' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                    onClick={() => handleTimerModeChange('none')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="none" id="no-timer" className="border-white text-orange-400" />
                      <Label htmlFor="no-timer" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">بدون مؤقت</div>
                          <div className="text-xs text-slate-400">اختبار بدون مؤقت</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${timerMode === 'total' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                    onClick={() => {
                      handleTimerModeChange('total');
                      openTimerDurationModal();
                    }}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="total" id="total-timer" className="border-white text-orange-400" />
                      <Label htmlFor="total-timer" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">
                            {timerMode === 'total' && selectedTimerDuration ? `مؤقت ${selectedTimerDuration} دقيقة` : 'مع مؤقت'}
                          </div>
                          <div className="text-xs text-slate-400">اختبار مع مؤقت</div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* {shouldShowRCOrderSection() && (
              <Card className="text-right aurora-card w-full max-w-md mx-auto">
                <CardHeader className="pb-6 p-6">
                  <div className="flex items-center justify-center mb-4">
                    <div className="p-3 card-icon aurora-icon-glow">
                      <Target className="h-8 w-8 text-orange-400" />
                    </div>
                  </div>
                  <CardTitle className="text-center text-lg font-bold text-slate-100">ترتيب استيعاب المقروء</CardTitle>
                  <CardDescription className="text-center text-slate-400 text-sm">اختر ترتيب اسئلة استيعاب المقروء</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-6">
                  <RadioGroup value={rcQuestionOrder} onValueChange={(value) => updateSetting('rcQuestionOrder', value)}>
                    <div
                      className={`rounded-lg border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer ${rcQuestionOrder === 'sequential' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                      onClick={() => updateSetting('rcQuestionOrder', 'sequential')}
                    >
                      <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                        <RadioGroupItem value="sequential" id="sequential" className="border-white text-orange-400" />
                        <Label htmlFor="sequential" className="cursor-pointer flex-1 text-right">
                          <div>
                            <div className="font-bold text-slate-100 text-sm mb-1">متتالية</div>
                            <div className="text-xs text-slate-400">اسئلة من نفس النص تاتي متتابعة</div>
                          </div>
                        </Label>
                      </div>
                    </div>
                    <div
                      className={`rounded-lg border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] cursor-pointer ${rcQuestionOrder === 'random' ? 'bg-slate-700 border-orange-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-orange-400/50 hover:bg-slate-700'}`}
                      onClick={() => updateSetting('rcQuestionOrder', 'random')}
                    >
                      <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                        <RadioGroupItem value="random" id="random" className="border-white text-orange-400" />
                        <Label htmlFor="random" className="cursor-pointer flex-1 text-right">
                          <div>
                            <div className="font-bold text-slate-100 text-sm mb-1">عشوائية</div>
                            <div className="text-xs text-slate-400">توزيع عشوائي كامل للاسئلة</div>
                          </div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            )} */}
          </div>

          <div className="text-center">
            <div className="bg-[#001625]/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-orange-400/20 hover:shadow-2xl transition-all duration-300 max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-100 mb-2">جاهز للبدء؟</h3>
                <p className="text-slate-400">
                  {questionTypeFilter === 'multiple'
                    ? `اختبار متعدد الانواع - ${examMode === 'sectioned' ? 'مع مراجعة' : 'متتالي'} - ${timerMode === 'none' ? 'بدون مؤقت' : `${selectedTimerDuration} دقيقة`}`
                    : `اختبار شامل - ${examMode === 'sectioned' ? 'مع مراجعة' : 'متتالي'} - ${timerMode === 'none' ? 'بدون مؤقت' : `${selectedTimerDuration} دقيقة`}`
                  }
                </p>
                {questionTypeFilter === 'multiple' && selectedQuestionTypes.length > 0 && (
                  <div className="mt-3 p-3">
                    <div className="text-orange-400 font-medium mb-1">توزيع الاسئلة:</div>
                    <div className="text-slate-400 text-sm">{getMultipleTypesDistribution()}</div>
                  </div>
                )}
              </div>

              <div className="sm:hidden mb-6">
                <SmartExamControls
                  isSmartExamEnabled={isSmartExamEnabled}
                  toggleSmartExam={toggleSmartExam}
                  smartExamProgress={smartExamProgress}
                  totalQuestionsInPool={totalQuestionsInPool}
                  handleResetSmartExamFromSettings={handleResetSmartExamFromSettings}
                />
              </div>

              <Button
                onClick={handleStartExam}
                size="lg"
                className="px-12 py-6 text-xl font-bold bg-orange-500 hover:bg-orange-600 text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                disabled={isLoading || (questionTypeFilter === 'multiple' && selectedQuestionTypes.length === 0)}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    جاري التحميل...
                  </>
                ) : (
                  <>
                    <Play className="h-7 w-7 ml-3" />
                    {isSmartExamEnabled ? 'بدء الاختبار الذكي' : 'بدء الأختبار'}
                  </>
                )}
              </Button>

              {questionTypeFilter === 'multiple' && selectedQuestionTypes.length > 0 && (
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {selectedQuestionTypes.map(type => {
                    const typeInfo = questionTypes.find(t => t.value === type);
                    return (
                      <div key={type} className="inline-flex items-center gap-2 bg-orange-400/10 text-orange-400 px-3 py-1 rounded-full text-xs font-medium">
                        <span>{typeInfo?.icon}</span>
                        <span>{typeInfo?.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <Target className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">تدريب مخصص</h3>
              <p className="text-slate-400 text-sm">اختر نوع الاسئلة التي تريد التركيز عليها</p>
            </div>

            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <Settings className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">اعدادات مرنة</h3>
              <p className="text-slate-400 text-sm">تحكم كامل في وقت الاختبار ونمط العرض</p>
            </div>

            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-orange-400/20 hover:border-orange-400/80 shadow-lg hover:shadow-orange-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <CheckCircle className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">تقييم فوري</h3>
              <p className="text-slate-400 text-sm">احصل على النتائج والتحليل فور انتهاء الاختبار</p>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Smart Exam Confirmation Modal */}
      {isResetConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-60 p-4" dir="rtl" onClick={() => setIsResetConfirmModalOpen(false)}>
          <div className="bg-[#112240] rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 transition-transform duration-300 hover:scale-110">
                  <AlertTriangle className="h-8 w-8 text-orange-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                إعادة تعيين التقدم
              </h3>
            </div>
            <div className="p-6 pt-0 space-y-4">
              <div className="flex items-center justify-center text-center">
                <p className="text-slate-300 text-base leading-relaxed">
                  اختر ماذا تريد أن تعيد تعيينه. لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>

              {/* Scope Selection */}
              <div className="space-y-3">
                <div className="flex rounded-lg bg-slate-900/50 p-1 border border-slate-700">
                  <button
                    onClick={() => { setResetScope('all'); setResetTarget([]); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'all' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => { setResetScope('bank'); setResetTarget([]); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'bank' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    حسب الملف
                  </button>
                  <button
                    onClick={() => { setResetScope('category'); setResetTarget([]); }}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all cursor-pointer ${resetScope === 'category' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                  >
                    حسب النوع
                  </button>
                </div>

                {/* Hierarchical Selection for Bank */}
                {resetScope === 'bank' && (
                  <ScrollArea dir="rtl" className="h-[315px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    {!focusedBank ? (
                      // Level 1: Bank List
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(bankMapping).map(([key, name]) => {
                          // Check if fully or partially selected
                          const isFullSelect = resetTarget.includes(`BANK:${key}`);
                          const partialCount = resetTarget.filter(t => t.startsWith(`CAT:${key}:`)).length;
                          const isSelected = isFullSelect || partialCount > 0;

                          return (
                            <div
                              key={key}
                              className={`flex items-center justify-between space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                                ${isSelected ? 'bg-orange-950/20 border-orange-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                              `}
                              onClick={() => setFocusedBank(key)}
                            >
                              <div className="flex items-center gap-3">
                                <div>
                                  <div className="font-bold text-slate-200 group-hover:text-white transition-colors">{name}</div>
                                  {isFullSelect && <div className="text-xs text-green-400 font-medium">سيتم حذف الملف كامل</div>}
                                  {!isFullSelect && partialCount > 0 && <div className="text-xs text-yellow-400 font-medium">{partialCount} اقسام محددة</div>}
                                </div>
                              </div>
                              <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:text-orange-400 transition-colors" />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // Level 2: Bank Details
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-800">
                          <Button
                            onClick={() => setFocusedBank(null)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <ArrowLeft className="h-5 w-5 rotate-180" />
                          </Button>
                          <span className="font-bold text-lg text-white">{bankMapping[focusedBank]}</span>
                        </div>

                        {/* Option 1: Delete Whole Bank */}
                        <div
                          className={`flex items-center space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer
                             ${resetTarget.includes(`BANK:${focusedBank}`) ? 'bg-red-500/10 border-red-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                           `}
                          onClick={() => {
                            const bankKey = focusedBank;
                            const fullKey = `BANK:${bankKey}`;
                            setResetTarget(prev => {
                              if (prev.includes(fullKey)) {
                                // Deselect whole bank
                                return prev.filter(t => t !== fullKey);
                              } else {
                                // Select whole bank AND remove any specific cat selections for this bank (cleanup)
                                const clean = prev.filter(t => !t.startsWith(`CAT:${bankKey}:`));
                                return [...clean, fullKey];
                              }
                            });
                          }}
                        >
                          <Checkbox
                            checked={resetTarget.includes(`BANK:${focusedBank}`)}
                            className="h-5 w-5 border-slate-500 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500 pointer-events-none"
                          />
                          <div className="mr-3">
                            <div className="font-bold text-slate-200">حذف الملف بالكامل</div>
                            <div className="text-xs text-slate-400">سيتم إعادة تعيين جميع أقسام الاختبار في هذا الملف</div>
                          </div>
                        </div>

                        <div className="relative flex py-2 items-center">
                          <div className="flex-grow border-t border-slate-800"></div>
                          <span className="flex-shrink-0 mx-4 text-slate-500 text-xs">أو اختر اقسام محددة</span>
                          <div className="flex-grow border-t border-slate-800"></div>
                        </div>

                        {/* Option 2: Specific Categories */}
                        <div className={`grid grid-cols-1 gap-2 ${resetTarget.includes(`BANK:${focusedBank}`) ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                          {Object.entries(categoryMapping).map(([catName, catKey]) => {
                            const itemKey = `CAT:${focusedBank}:${catKey}`;
                            const isSelected = resetTarget.includes(itemKey);

                            return (
                              <div
                                key={catKey}
                                className={`flex items-center space-x-3 space-x-reverse rounded-lg border p-3 transition-all duration-200 cursor-pointer
                                     ${isSelected ? 'bg-orange-500/10 border-orange-500/50' : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'}
                                  `}
                                onClick={() => {
                                  setResetTarget(prev => {
                                    if (prev.includes(itemKey)) {
                                      return prev.filter(t => t !== itemKey);
                                    } else {
                                      return [...prev, itemKey];
                                    }
                                  });
                                }}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  className="h-4 w-4 border-slate-500 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500 pointer-events-none"
                                />
                                <span className="mr-3 font-medium text-slate-300">{catName}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </ScrollArea>
                )}

                {/* Sub-Selection for Category */}
                {resetScope === 'category' && (
                  <ScrollArea dir="rtl" className="h-[315px] w-full rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.keys(categoryMapping).map((key) => {
                        const value = categoryMapping[key];
                        const isSelected = resetTarget.includes(value);
                        return (
                          <div
                            key={key}
                            className={`flex items-center space-x-3 space-x-reverse rounded-xl border p-4 transition-all duration-200 cursor-pointer group
                                                            ${isSelected
                                ? 'bg-yellow-500/10 border-yellow-500/50'
                                : 'bg-slate-900/50 border-slate-800 hover:bg-slate-800'
                              }`}
                            onClick={() => {
                              setResetTarget(prev =>
                                prev.includes(value) ? prev.filter(k => k !== value) : [...prev, value]
                              );
                            }}
                          >
                            <Checkbox
                              id={`cat-${value}`}
                              checked={isSelected}
                              className="h-5 w-5 border-slate-500 data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500 pointer-events-none"
                            />
                            <Label
                              htmlFor={`cat-${value}`}
                              className="text-base font-medium cursor-pointer flex-1 mr-3 text-slate-200 group-hover:text-white pointer-events-none"
                            >
                              {key}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>

              <div className="flex flex-col sm:flex-row-reverse gap-3 mt-6">
                <Button
                  onClick={handleConfirmResetSmartExam}
                  disabled={(resetScope !== 'all' && resetTarget.length === 0)}
                  className="flex-1 bg-red-600 hover:bg-red-700 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  إعادة تعيين
                </Button>

                <Button
                  onClick={() => setIsResetConfirmModalOpen(false)}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 hover:text-white text-black font-bold backdrop-blur-sm border border-white/30 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
                >
                  الغاء
                </Button>

              </div>
            </div>
          </div>
        </div>
      )}

      <StatsModal
        open={isStatsModalOpen}
        onOpenChange={setIsStatsModalOpen}
        handleResetSmartExamFromSettings={handleResetSmartExamFromSettings}
      />
    </>
  );
};

export default StartScreen;
