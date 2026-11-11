import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, BookOpen, Play, Filter, GraduationCap, Target, Settings, CheckCircle, ArrowRight, Home, X, LogOut, History, FileText, FolderPlus, Minus, Plus, Moon, Sun, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useExamStore } from '../store/examStore';
import { getAvailableCategories, getAvailableExams, initializeQuestionData, resetDataLoader, bankMapping, getAllQuestions, generateExam } from '../utils/dataLoader';
import {
  preloadInitialBatch,
  preloadBackgroundBatch,
  extractImageUrls
} from '../utils/imagePreloader';
import StatsModal from './StatsModal';
import ThemeDock from './ThemeDock';

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
      <div className="flex flex-col items-center gap-3 p-4 bg-slate-800/90 rounded-xl border border-cyan-500/30 max-w-sm text-center shadow-lg">
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-medium border border-cyan-500/30">
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
  const { user, setUser, initializeExam, showHistory, showQuestionsManager, nightMode, toggleNightMode } = useExamStore();
  const [loading, setLoading] = useState(true);

  // Safety timer to prevent infinite loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);
  const [isAuthorized, setIsAuthorized] = useState(false);

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

        // Skip login and automatically authenticate dev user only on strictly local dev loopback
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

      // Run session check first, then load metadata with user info
      const currentUser = await sessionCheck();
      if (currentUser) {
        // 🎯 Metadata Only on Mount: ONLY fetches exam names and question counts (ZERO questions downloaded!)
        const banks = await initializeQuestionData(currentUser);
        // Verify server authorized at least 1 bank and did not return 403 Forbidden
        if (!banks || !Array.isArray(banks) || banks.length === 0) {
          if (!canBypass) {
            console.warn('Server access denied to question banks. Disallowing unauthorized session.');
            setIsAuthorized(false);
            setUser(null);
            setLoading(false);
            return;
          }
          console.info('Dev Bypass active: Continuing despite unauthenticated remote question banks.');
        }
      }

      // After data is loaded, set categories
      const allCategories = getAvailableCategories();
      const filteredCategories = allCategories.filter(cat => {
        if (cat.key === 'unreleased') {
          const roleId = parseInt(currentUser?.role_id);
          return [1, 2, 3].includes(roleId);
        }
        return true;
      });
      setCategories(filteredCategories);
      setLoading(false);
    };

    initializeApp();
  }, [setUser]);

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

  // Add scrollbar stability on component mount
  useEffect(() => {
    // Ensure scrollbar is always visible to prevent layout shifts
    document.documentElement.style.overflowY = 'scroll';

    return () => {
      // Cleanup on unmount
      document.documentElement.style.overflowY = '';
    };
  }, []);

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
      // Ctrl +/-, and other zoom keys
      if (event.ctrlKey && ['=', '+', '-'].includes(event.key)) {
        event.preventDefault();
      }
    };

    const handleWheel = (event) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Load saved settings from localStorage
  const loadSavedSettings = () => {
    try {
      const saved = localStorage.getItem('examSettings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading saved settings:', error);
    }
    return {
      examMode: 'sectioned',
      timerMode: 'none',
      selectedTimerDuration: 11,
      questionTypeFilter: 'all',
      selectedQuestionType: 'analogy',
      rcQuestionOrder: 'sequential'
    };
  };

  // Local state for configuration with saved settings
  const [settings, setSettings] = useState(loadSavedSettings());

  // States for dynamic data and modals
  const [categories, setCategories] = useState([]);
  const [testsForCategory, setTestsForCategory] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isTestSelectionModalOpen, setIsTestSelectionModalOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null); // Keep for single selection if needed, or replace usage
  const [selectedTests, setSelectedTests] = useState([]); // New array for multiple selection
  const [isTimerDurationModalOpen, setIsTimerDurationModalOpen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [testSearchQuery, setTestSearchQuery] = useState(''); // Search query for test selection modal
  const [isSearchVisible, setIsSearchVisible] = useState(false); // Toggle search visibility
  const preloadedQuestionsRef = useRef(null);

  const {
    examMode,
    timerMode,
    selectedTimerDuration,
    selectedQuestionType,
    rcQuestionOrder
  } = settings;

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('examSettings', JSON.stringify(settings));
  }, [settings]);

  // Categories are now fetched in the main initializeApp useEffect

  // Fetch tests when a category is selected
  useEffect(() => {
    if (!loading && selectedQuestionType) {
      setTestsForCategory(getAvailableExams(selectedQuestionType));
      setSelectedTest(null);
      setSelectedTests([]); // Reset multiple selection
      preloadedQuestionsRef.current = null;
    } else if (!selectedQuestionType) {
      setTestsForCategory([]);
      preloadedQuestionsRef.current = null;
    }
  }, [selectedQuestionType, loading]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  // 🚀 Intelligent Early Preloader: starts pre-fetching and caching images in advance
  const startPreloadingSelectedTests = useCallback(async (testsToPreload, categoryKey) => {
    if (!testsToPreload || testsToPreload.length === 0) return;

    try {
      const config = {
        categoryKey: categoryKey || 'search',
        examName: testsToPreload.length > 1 ? 'اختبار مجمع' : testsToPreload[0],
        examNames: testsToPreload.length > 0 ? testsToPreload : null,
        shuffleChoices: false
      };

      console.log('🚀 [Early Preload] Generating exam for selected tests:', config);

      const result = await generateExam(config);
      if (result && result.questions && result.questions.length > 0) {
        const cacheKey = `${categoryKey || 'search'}_${[...testsToPreload].sort().join('___')}`;
        preloadedQuestionsRef.current = {
          key: cacheKey,
          questions: result.questions
        };

        const allImageUrls = extractImageUrls(result.questions);
        console.log(`🖼️ [Early Preload] Extracted ${allImageUrls.length} image URLs to preload early.`);

        if (allImageUrls.length > 0) {
          // Preload Section 1 (first 11) immediately with high priority
          const initialImageUrls = allImageUrls.slice(0, 11);
          const remainingImageUrls = allImageUrls.slice(11);

          preloadInitialBatch(initialImageUrls, 2500).catch(err => {
            console.warn('Early initial preload completed with warning:', err);
          });

          // Preload remaining in background
          if (remainingImageUrls.length > 0) {
            preloadBackgroundBatch(remainingImageUrls, 3, 100);
          }
        }
      }
    } catch (error) {
      console.warn('Early preloading encountered an error (will retry when starting exam):', error);
    }
  }, []);

  const handleStartExam = async () => {
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Check if questions and images are already preloaded
    const activeTests = selectedTests.length > 0 ? selectedTests : (selectedTest ? [selectedTest] : []);
    const currentKey = `${selectedQuestionType || 'search'}_${[...activeTests].sort().join('___')}`;
    const preloadedQuestions = (preloadedQuestionsRef.current && preloadedQuestionsRef.current.key === currentKey)
      ? preloadedQuestionsRef.current.questions
      : null;

    const config = {
      examMode,
      timerMode,
      timerDuration: timerMode === 'none' ? 0 : selectedTimerDuration,
      shuffleChoices: false, // Consistent with examStore
      rcQuestionOrder,
      categoryKey: selectedQuestionType,
      examName: selectedTests.length > 1 ? 'اختبار مجمع' : selectedTest, // Shows group name if multiple, otherwise singular
      examNames: selectedTests.length > 0 ? selectedTests : (selectedTest ? [selectedTest] : null), // Pass multiple if exists
      questions: preloadedQuestions || undefined // Pass preloaded questions for instant launch!
    };

    try {
      await initializeExam(config);

      const element = document.documentElement;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.mozRequestFullScreen) { // Firefox
        element.mozRequestFullScreen();
      } else if (element.webkitRequestFullscreen) { // Chrome, Safari and Opera
        element.webkitRequestFullscreen();
      } else if (element.msRequestFullscreen) { // IE/Edge
        element.msRequestFullscreen();
      }
    } catch (err) {
      console.error('Failed to start exam:', err);
      toast.error('❌ غير مصرح لك ببدء هذا الاختبار أو حدث خطأ في استلام الأسئلة من الخادم.');
    }
  };

  const handleTimerModeChange = (mode) => {
    updateSetting('timerMode', mode);
  };

  // Modal handlers
  const openCategoryModal = () => setIsCategoryModalOpen(true);
  const closeCategoryModal = () => setIsCategoryModalOpen(false);

  const handleCategorySelect = (categoryKey) => {
    updateSetting('selectedQuestionType', categoryKey);
    // التبديل المباشر بين النوافذ دون تاخير
    setIsCategoryModalOpen(false);

    // Reset selections for new category
    setSelectedTests([]);
    setSelectedTest(null);

    setIsTestSelectionModalOpen(true);
  };

  const openTestSelectionModal = () => {
    // Sync active selection to the modal state
    if (selectedTest && selectedTests.length === 0) {
      setSelectedTests([selectedTest]);
    }
    setIsTestSelectionModalOpen(true);
  };

  const closeTestSelectionModal = () => {
    setIsTestSelectionModalOpen(false);
    setIsSearchVisible(false);
    setTestSearchQuery('');
  };

  // Normalize Arabic text for search (treats أ إ آ ا as same character)
  const normalizeArabic = (text) => {
    return text
      .replace(/[أإآا]/g, 'ا')
      .replace(/[ىئ]/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/ؤ/g, 'و')
      .toLowerCase();
  };

  // Filter tests based on search query
  const getFilteredTests = () => {
    if (!testSearchQuery.trim()) return testsForCategory;
    const normalizedQuery = normalizeArabic(testSearchQuery);
    return testsForCategory.filter(test => {
      const displayName = bankMapping[test.name] || test.name;
      return normalizeArabic(displayName).includes(normalizedQuery) ||
        normalizeArabic(test.name).includes(normalizedQuery);
    });
  };

  // Handle select all / deselect all
  const handleSelectAllTests = () => {
    const filteredTests = getFilteredTests();
    const allFilteredSelected = filteredTests.every(test => selectedTests.includes(test.name));

    if (allFilteredSelected) {
      // Deselect all filtered tests
      setSelectedTests(prev => prev.filter(t => !filteredTests.some(ft => ft.name === t)));
    } else {
      // Select all filtered tests
      const filteredTestNames = filteredTests.map(t => t.name);
      setSelectedTests(prev => [...new Set([...prev, ...filteredTestNames])]);
    }
  };

  const handleTestToggle = (testName) => {
    setSelectedTests(prev => {
      if (prev.includes(testName)) {
        return prev.filter(t => t !== testName);
      } else {
        return [...prev, testName];
      }
    });
  };

  const handleConfirmTestSelection = () => {
    const currentSelected = [...selectedTests];
    // Update legacy single selection state for compatibility/display
    if (currentSelected.length === 1) {
      setSelectedTest(currentSelected[0]);
    } else {
      setSelectedTest(null);
    }
    setIsSearchVisible(false);
    setTestSearchQuery('');
    closeTestSelectionModal();

    // 🚀 Start preloading question data and images immediately upon confirming test selection!
    startPreloadingSelectedTests(currentSelected, selectedQuestionType);
  };

  const openTimerDurationModal = () => setIsTimerDurationModalOpen(true);
  const closeTimerDurationModal = () => setIsTimerDurationModalOpen(false);

  const handleTimerDurationSelect = (duration) => {
    updateSetting('selectedTimerDuration', parseInt(duration));
    closeTimerDurationModal();
  };



  const getQuestionTypeInfo = () => {
    return categories.find(cat => cat.key === selectedQuestionType);
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
              alt="محاكي الطرقعة"
              className="h-24 w-24 object-contain transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
            />
          </div>
          <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            مرحباً بك في محاكي الطرقعة
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
              alt="محاكي الطرقعة"
              className="h-24 w-24 object-contain transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
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

  return (
    <>
      <style>{`
        /* Custom blue scrollbar */
        ::-webkit-scrollbar {
          width: 12px;
          background: #001e3c;
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%);
          border-radius: 8px;
          border: 2px solid #001e3c;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(135deg, #38bdf8 0%, #0ea5e9 100%);
        }
        ::-webkit-scrollbar-corner {
          background: #001e3c;
        }
        /* Firefox */
        html {
          scrollbar-color: #38bdf8 #001e3c;
          scrollbar-width: thin;
        }
      `}</style>
      <div dir="rtl">
        {/* Category Selection Modal */}
        {isCategoryModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeCategoryModal}>
            <div className="aurora-dialog-content rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#112240] text-slate-100 p-6 flex justify-between items-center border-b-2 border-cyan-400/30">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <Filter className="h-6 w-6 text-cyan-400" />
                  اختر فئة الاسئلة
                </h3>
                <Button onClick={closeCategoryModal} variant="" className="text-slate-100 hover:bg-transparent p-2 rounded-full bg-transparent cursor-pointer">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid gap-4">
                  {categories.map(cat => (
                    <div
                      key={cat.key}
                      onClick={() => handleCategorySelect(cat.key)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${selectedQuestionType === cat.key
                        ? 'bg-slate-700 border-cyan-400 shadow-md'
                        : 'bg-slate-800 border-slate-600 hover:border-cyan-400/50 hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between text-right">
                        <div className="flex-1">
                          <div className="font-bold text-lg text-slate-100 mb-1">{cat.name}</div>
                          <div className="text-sm text-slate-400">عدد الاسئلة: {cat.questionCount}</div>
                        </div>
                        {selectedQuestionType === cat.key && (
                          <CheckCircle className="h-6 w-6 text-cyan-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Test Selection Modal */}
        {isTestSelectionModalOpen && selectedQuestionType && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeTestSelectionModal}>
            <div className="aurora-dialog-content rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#112240] text-slate-100 p-6 flex justify-between items-center border-b-2 border-cyan-400/30 flex-none">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Button
                    onClick={() => {
                      closeTestSelectionModal();
                      openCategoryModal();
                    }}
                    variant="ghost"
                    className="p-1 h-auto text-cyan-400 hover:bg-slate-700/50 hover:text-cyan-300 rounded-lg cursor-pointer transition-all duration-200"
                    title="العودة لاختيار الفئة"
                  >
                    <ArrowRight className="h-6 w-6" />
                  </Button>
                  <span>اختيار الاختبار</span>
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSelectAllTests}
                    variant="outline"
                    className={`h-9 px-2 sm:px-3 rounded-lg transition-all duration-300 cursor-pointer flex items-center gap-1 sm:gap-2 text-xs font-bold ${getFilteredTests().length > 0 && getFilteredTests().every(test => selectedTests.includes(test.name))
                      ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.05)] hover:text-white'
                      : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30 hover:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.05)] hover:text-white'
                      }`}
                  >
                    {getFilteredTests().length > 0 && getFilteredTests().every(test => selectedTests.includes(test.name))
                      ? (
                        <>
                          <X className="h-4 w-4" />
                          <span className="hidden sm:inline">إلغاء تحديد الكل</span>
                        </>
                      )
                      : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          <span className="hidden sm:inline">تحديد الكل</span>
                        </>
                      )
                    }
                    <span className="px-1 py-0.5 rounded text-[10px] opacity-80 sm:bg-transparent">({getFilteredTests().length})</span>
                  </Button>
                  <Button
                    onClick={() => {
                      setIsSearchVisible(!isSearchVisible);
                      if (isSearchVisible) setTestSearchQuery('');
                    }}
                    variant="ghost"
                    className={`cursor-pointer p-2 rounded-lg transition-all duration-300 ${isSearchVisible ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-100 hover:bg-slate-700 hover:text-slate-100'}`}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button onClick={closeTestSelectionModal} variant="ghost" className="cursor-pointer p-2 rounded-lg transition-all duration-300 text-slate-100 hover:bg-slate-700 hover:text-slate-100">
                    <X className="h-6 w-6" />
                  </Button>
                </div>
              </div>

              {/* Search Section */}
              <div className={`border-b border-cyan-400/20 flex-none bg-[#0d1b33]/50 transition-all duration-500 ease-in-out ${isSearchVisible ? 'p-4 max-h-24 opacity-100' : 'p-0 max-h-0 opacity-0 overflow-hidden'}`}>
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث عن اختبار..."
                    value={testSearchQuery}
                    onChange={(e) => setTestSearchQuery(e.target.value)}
                    className="w-full bg-slate-800 border-2 border-slate-600 rounded-xl py-3 pr-11 pl-4 text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition-all duration-300"
                  />
                </div>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                <div className="grid gap-4">
                  {getFilteredTests().map(test => {
                    const isSelected = selectedTests.includes(test.name);
                    return (
                      <div
                        key={test.name}
                        onClick={() => handleTestToggle(test.name)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${isSelected
                          ? 'bg-slate-700 border-cyan-400 shadow-md'
                          : 'bg-slate-800 border-slate-600 hover:border-cyan-400/50 hover:bg-slate-700'
                          }`}
                      >
                        <div className="flex items-center justify-between text-right">
                          <div className="flex-1">
                            <div className="font-bold text-lg text-slate-100 mb-1">{bankMapping[test.name] || test.name}</div>
                            <div className="text-sm text-slate-400">عدد الاسئلة: {test.questionCount}</div>
                          </div>
                          {isSelected ? (
                            <div className="flex items-center gap-2 text-cyan-400">
                              <CheckCircle className="h-6 w-6" />
                              <Minus className="h-5 w-5" />
                            </div>
                          ) : (
                            <Plus className="h-5 w-5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {getFilteredTests().length === 0 && (
                    <div className="text-center text-slate-400 py-8">
                      لا توجد نتائج للبحث
                    </div>
                  )}
                </div>
              </div>

              {/* Fixed Confirm Button at bottom (now outside scrollable area) */}
              <div className="p-4 bg-[#112240] border-t border-cyan-400/30 flex justify-center flex-none">
                <Button
                  onClick={handleConfirmTestSelection}
                  disabled={selectedTests.length === 0}
                  className="w-full max-w-sm py-6 text-lg font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  تأكيد الاختيار ({selectedTests.length})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Timer Duration Modal */}
        {isTimerDurationModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={closeTimerDurationModal}>
            <div className="aurora-dialog-content border-2 border-cyan-400/50 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#112240] text-slate-100 p-6 flex justify-between items-center border-b-2 border-cyan-400/30">
                <h3 className="text-xl font-bold flex items-center gap-3">
                  <Clock className="h-6 w-6 text-cyan-400" />
                  اختر مدة المؤقت
                </h3>
                <Button onClick={closeTimerDurationModal} variant="ghost" className="cursor-pointer p-2 rounded-lg transition-all duration-300 text-slate-100 hover:bg-slate-700 hover:text-slate-100">
                  <X className="h-6 w-6" />
                </Button>
              </div>
              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid gap-3">
                  {[5, 11, 13, 15, 20, 25, 30, 45, 60, 90, 120].map(duration => (
                    <div
                      key={duration}
                      onClick={() => handleTimerDurationSelect(duration)}
                      className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${selectedTimerDuration === duration
                        ? 'bg-slate-700 border-cyan-400 shadow-md'
                        : 'bg-slate-800 border-slate-600 hover:border-cyan-400/50 hover:bg-slate-700'
                        }`}
                    >
                      <div className="flex items-center justify-between text-right">
                        <div className="font-bold text-lg text-slate-100">
                          {duration} دقيقة
                        </div>
                        {selectedTimerDuration === duration && (
                          <CheckCircle className="h-6 w-6 text-cyan-400" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <StatsModal open={isStatsModalOpen} onOpenChange={setIsStatsModalOpen} />

        {/* Hero Header */}
        <div className="relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-center">
              {user && (
                <div className="absolute top-3 left-3 sm:top-6 sm:left-6 text-white flex flex-col sm:flex-row items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/30 p-2 rounded-xl shadow-lg transition-all duration-300 hover:bg-white/20">
                  <img src={user.photo_url || 'https://i.ibb.co/tMMyJj2y/icon.jpg'} alt={user.first_name} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-cyan-400" />
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
                      : 'bg-transparent text-cyan-400 hover:bg-white/20 hover:rounded-full'
                      }`}
                  >
                    {nightMode ? <Sun className="h-5 w-5 sm:h-5 sm:w-5" /> : <Moon className="h-5 w-5 sm:h-5 sm:w-5" />}
                  </Button>
                  <Button onClick={handleLogout} variant="ghost" className="text-slate-300 hover:bg-white/20 hover:text-white p-2 rounded-full cursor-pointer">
                    <LogOut className="h-5 w-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          <div className="relative max-w-7xl mx-auto px-6 py-10 text-center">

            {/* Home Button */}
            <Button
              variant=""
              className="absolute top-3 right-3 sm:top-6 sm:right-6 text-cyan-400 hover:bg-white/20 bg-white/10 backdrop-blur-sm border border-white/30 px-2 py-2 sm:px-6 sm:py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer"
              onClick={() => window.location.href = (['localhost', '127.0.0.1', '::1'].includes(window.location.hostname) || ['5173', '5174', '5175'].includes(window.location.port)) ? ('http://' + window.location.hostname + ':5173/') : '/'}
            >
              <Home className="h-4 w-4 sm:h-6 sm:w-6 sm:ml-2" />
              <span className="font-bold text-xs sm:text-base hidden sm:inline">الصفحة الرئيسية</span>
            </Button>

            <div className="absolute top-16 right-2.5 sm:top-20 sm:right-5">
              <ThemeDock />
            </div>


            <div className="flex justify-center mb-6 mt-10">
              <img
                src="/logo1.png"
                alt="محاكي الطرقعة"
                className="h-40 w-40 object-contain rounded transition-all duration-300 hover:scale-110 hover:rotate-[5deg]"
              />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-slate-100 mb-6 leading-relaxed">
              محاكي الطرقعة
            </h1>
            <p className="text-xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              تدريب تفاعلي يحاكي بيئة الاختبار الحقيقي، لمساعدة المتدرب على تحسين ادائه.
            </p>
            <div className="flex justify-center gap-8 text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-cyan-400" />
                <span>اكثر من 600+ سؤال</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-cyan-400" />
                <span>اقسام مخصصة</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-cyan-400" />
                <span>تقييم فوري</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          {/* Section Title */}
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-100 mb-4">اعدادات الاختبار</h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              اختر الاعدادات المناسبة لك لبدء تجربة اختبار مخصصة وفعالة
            </p>
          </div>

          {/* Configuration Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16 transition-all duration-500 justify-items-center max-w-6xl mx-auto">
            {/* Question Type Filter */}
            <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <Filter className="h-8 w-8 text-cyan-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">
                  اختيار الاختبار
                </CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">
                  اختر فئة ثم اختبار محدد
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 p-6">
                {/* زر اختيار الفئة الجديد */}
                <div
                  className="rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer bg-slate-800 border-slate-600 hover:border-cyan-400/50 hover:bg-slate-700 p-3"
                  onClick={openCategoryModal}
                >
                  <div className="flex items-center justify-between text-right">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-bold text-slate-100 text-sm mb-1">{categories.find(c => c.key === selectedQuestionType)?.name || 'اختيار الفئة'}</div>
                        {selectedQuestionType && <div className="text-xs text-slate-400">عدد الاسئلة: {categories.find(c => c.key === selectedQuestionType)?.questionCount || 0}</div>}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 rotate-180" />
                  </div>
                </div>

                {/* زر اختيار الاختبار الجديد */}
                <div
                  className={`rounded-lg border-2 transition-all duration-150 ease-out p-3 ${!selectedQuestionType ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer bg-slate-800 border-slate-600 hover:border-cyan-400/50 hover:bg-slate-700 hover:shadow-md hover:scale-[1.02]'}`}
                  onClick={() => selectedQuestionType && openTestSelectionModal()}
                >
                  <div className="flex items-center justify-between text-right">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="font-bold text-slate-100 text-sm mb-1">
                          {selectedTests.length > 1
                            ? `تم اختيار ${selectedTests.length} اختبارات`
                            : (bankMapping[selectedTest || selectedTests[0]] || selectedTest || selectedTests[0] || 'اختيار الاختبار')
                          }
                        </div>
                        {(selectedTest || selectedTests.length > 0)
                          ? <div className="text-xs text-slate-400">
                            {selectedTests.length > 1
                              ? 'اختبار مجمع'
                              : `عدد الاسئلة: ${testsForCategory.find(test => test.name === (selectedTest || selectedTests[0]))?.questionCount || 0}`
                            }
                          </div>
                          : <div className="text-xs text-slate-400">الرجاء اختيار اختبار</div>
                        }
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-400 rotate-180" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Exam Mode Configuration */}
            <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <BookOpen className="h-8 w-8 text-cyan-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">
                  نمط الاختبار
                </CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">
                  اختر طريقة عرض الاسئلة
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RadioGroup value={examMode} onValueChange={(value) => updateSetting('examMode', value)}>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${examMode === 'sectioned' ? 'bg-slate-700 border-cyan-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-cyan-400/50 hover:bg-slate-700'}`}
                    onClick={() => updateSetting('examMode', 'sectioned')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="sectioned" id="sectioned" className="border-white text-cyan-400" />
                      <Label htmlFor="sectioned" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">اقسام مع مراجعة</div>
                          <div className="text-xs text-slate-400">
                            اختبار مقسم مع امكانية المراجعة
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${examMode === 'single' ? 'bg-slate-700 border-cyan-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-cyan-400/50 hover:bg-slate-700'}`}
                    onClick={() => updateSetting('examMode', 'single')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="single" id="single" className="border-white text-cyan-400" />
                      <Label htmlFor="single" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">مجمع في قسم واحد</div>
                          <div className="text-xs text-slate-400">
                            جميع الاسئلة متتالية بدون توقف
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            {/* Timer Configuration */}
            <Card className="text-right aurora-card w-full max-w-md mx-auto">
              <CardHeader className="pb-6 p-6">
                <div className="flex items-center justify-center mb-4">
                  <div className="p-3 card-icon aurora-icon-glow">
                    <Clock className="h-8 w-8 text-cyan-400" />
                  </div>
                </div>
                <CardTitle className="text-center text-lg font-bold text-slate-100">
                  اعدادات المؤقت
                </CardTitle>
                <CardDescription className="text-center text-slate-400 text-sm">
                  اختر نمط المؤقت المناسب
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <RadioGroup value={timerMode} onValueChange={handleTimerModeChange}>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${timerMode === 'none' ? 'bg-slate-700 border-cyan-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-cyan-400/50 hover:bg-slate-700'}`}
                    onClick={() => handleTimerModeChange('none')}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="none" id="no-timer" className="border-white text-cyan-400" />
                      <Label htmlFor="no-timer" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">بدون مؤقت</div>
                          <div className="text-xs text-slate-400">
                            اختبار بدون مؤقت
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                  <div
                    className={`rounded-lg border-2 transition-all duration-150 ease-out hover:shadow-md hover:scale-[1.02] cursor-pointer ${timerMode === 'total' ? 'bg-slate-700 border-cyan-400 shadow-md p-3' : 'bg-slate-800 border-slate-600 p-3 hover:border-cyan-400/50 hover:bg-slate-700'}`}
                    onClick={() => {
                      handleTimerModeChange('total');
                      openTimerDurationModal();
                    }}
                  >
                    <div className="flex items-center space-x-2 space-x-reverse pointer-events-none">
                      <RadioGroupItem value="total" id="total-timer" className="border-white text-cyan-400" />
                      <Label htmlFor="total-timer" className="cursor-pointer flex-1 text-right">
                        <div>
                          <div className="font-bold text-slate-100 text-sm mb-1">
                            {timerMode === 'total' && selectedTimerDuration ?
                              `مؤقت ${selectedTimerDuration} دقيقة` :
                              'مع مؤقت'
                            }
                          </div>
                          <div className="text-xs text-slate-400">
                            اختبار مع مؤقت
                          </div>
                        </div>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>



          </div>
          {/* Start Button Section */}
          <div className="text-center">
            <div className="bg-[#001625]/70 backdrop-blur-sm rounded-2xl p-8 shadow-xl border border-cyan-400/20 hover:shadow-2xl transition-all duration-300 max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-100 mb-2">جاهز للبدء؟</h3>
                <p className="text-slate-400">
                  {(selectedTest || selectedTests.length > 0)
                    ? `اختبار ${selectedTests.length > 1
                      ? `مجمع (${selectedTests.length} اختبارات)`
                      : (bankMapping[selectedTest || selectedTests[0]] || selectedTest || selectedTests[0])} - ${examMode === 'sectioned' ? 'مع مراجعة' : 'متتالي'} - ${timerMode === 'none' ? 'بدون مؤقت' : `${selectedTimerDuration} دقيقة`}`
                    : `الرجاء اختيار فئة واختبار للبدء`
                  }
                </p>
              </div>

              <Button
                onClick={handleStartExam}
                disabled={!selectedTest && selectedTests.length === 0}
                size="lg"
                className="px-12 py-6 text-xl font-bold bg-cyan-500 hover:bg-cyan-600 text-slate-900 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-600"
              >
                <Play className="h-7 w-7 ml-3" />
                بدء الاختبار
              </Button>
            </div>
          </div>

          {/* Features Section */}
          <div className="mt-16 grid md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-cyan-400/20 hover:border-cyan-400/80 shadow-lg hover:shadow-cyan-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <Target className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">تدريب مخصص</h3>
              <p className="text-slate-400 text-sm">اختر نوع الاسئلة التي تريد التركيز عليها</p>
            </div>

            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-cyan-400/20 hover:border-cyan-400/80 shadow-lg hover:shadow-cyan-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <Settings className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">اعدادات مرنة</h3>
              <p className="text-slate-400 text-sm">تحكم كامل في وقت الاختبار ونمط العرض</p>
            </div>

            <div className="text-center p-6 bg-[#001625]/70 rounded-xl backdrop-blur-sm border border-cyan-400/20 hover:border-cyan-400/80 shadow-lg hover:shadow-cyan-400/10 transition-all duration-300 transform hover:scale-105 w-full max-w-md mx-auto">
              <div className="rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center card-icon aurora-icon-glow">
                <CheckCircle className="h-8 w-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-100 mb-2">تقييم فوري</h3>
              <p className="text-slate-400 text-sm">احصل على النتائج والتحليل فور انتهاء الاختبار</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StartScreen;
