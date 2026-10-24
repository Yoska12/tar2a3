import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Zap,
  Target,
  Flame,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingUp,
  Bookmark,
  Sparkles,
  BookOpen,
  ChevronLeft,
  AlertTriangle,
  Play,
  RotateCcw,
  Video,
  FileText,
  Calendar,
  CheckSquare,
  Square,
  Crown,
  Download,
  Lightbulb,
  ExternalLink,
  Shield,
  Layers,
  Award,
  Pause,
  Timer,
  Edit,
  Save,
  Trash2,
  Share2,
  Lock
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';
import { TarqaUser } from '../lib/supabase';
import { Category, Question, CourseModule, CourseFileItem, InstructorInfo } from '../types';
import { mockCategories } from '../data/mockQuestions';
import { questionBankStorage } from '../lib/questionBankStorage';
import { getSubscriptionDetails, cancelAnnualSubscription, coursesStorage } from '../lib/subscriptionService';
import { streakService, StreakData } from '../lib/streakService';
import { downloadTrackingService } from '../lib/downloadTrackingService';
import { pointsService, getRankLevel, RANK_LEVELS } from '../lib/pointsService';

interface StudentDashboardProps {
  currentUser: TarqaUser | null;
  onStartMock: () => void;
  onStartPractice: (category?: Category) => void;
  onReviewAttempt?: (attemptId: string) => void;
  onOpenAuth?: () => void;
  onNavigateCourses?: () => void;
  onNavigateLeaderboard?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  currentUser,
  onStartMock,
  onStartPractice,
  onOpenAuth,
  onNavigateCourses,
  onNavigateLeaderboard,
}) => {
  // حالة الاشتراك والبيانات
  const [subscription, setSubscription] = useState(() => getSubscriptionDetails(currentUser));
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  // حالة النقاط والمستوى
  const [userPoints, setUserPoints] = useState(() => pointsService.getUserPoints());
  const userRankLevel = getRankLevel(userPoints);

  // حالة الستريك والشعلة اليومية
  const [streakData, setStreakData] = useState<StreakData>(() => streakService.getStreakData());
  const [streakToast, setStreakToast] = useState<string | null>(null);

  // حالة الدورات والمذكرات والمدرسين
  const [modules, setModules] = useState<CourseModule[]>(() => coursesStorage.getModules());
  const [files, setFiles] = useState<CourseFileItem[]>(() => coursesStorage.getFiles());
  const [instructors, setInstructors] = useState<InstructorInfo[]>(() => coursesStorage.getInstructors());

  // التبويب أو المدرس المفضل
  const [preferredTeacher, setPreferredTeacher] = useState<'teacher_1' | 'teacher_2'>('teacher_1');

  // الأسئلة المحفوظة في المفضلة
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('tarqa_bookmarked_questions');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedBookmarkedQuestion, setSelectedBookmarkedQuestion] = useState<Question | null>(null);

  // مهام المذاكرة اليومية (Daily Study Tasks)
  const defaultTasks = [
    { id: 'task-1', title: 'مشاهدة محاضرة التأسيس المقررة 🎬', completed: false, category: 'courses' },
    { id: 'task-3', title: 'مراجعة وتدوين ملاحظات المذاكرة اليومية 📄', completed: false, category: 'summary' },
    { id: 'task-4', title: 'جلسة تركيز بومودورو 25 دقيقة بدون تشتت ⏱️', completed: false, category: 'focus' },
  ];

  const [dailyTasks, setDailyTasks] = useState(() => {
    try {
      const todayKey = 'tarqa_tasks_' + new Date().toISOString().split('T')[0];
      const saved = localStorage.getItem(todayKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((t: any) => t.id !== 'task-2' && !t.title?.includes('10 أسئلة'));
          return filtered.length > 0 ? filtered : defaultTasks;
        }
      }
      return defaultTasks;
    } catch {
      return defaultTasks;
    }
  });

  // مؤقت بومودورو المدمج (Pomodoro Focus Timer)
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'focus' | 'break'>('focus');

  // كشكول الملاحظات والتدوينات الذاتية للطالب
  const [studentNotes, setStudentNotes] = useState(() => {
    const stored = localStorage.getItem('tarqa_student_notes_v1');
    if (stored && !stored.includes('قاعدة طرقع 1') && !stored.includes('قاعدة 2')) {
      return stored;
    }
    return '';
  });
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesSaveStatus, setNotesSaveStatus] = useState<string | null>(null);

  // تحديث الستريك والنشاط تلقائياً عند فتح اللوحة
  useEffect(() => {
    const updated = streakService.recordDailyActivity('open_dashboard');
    setStreakData(updated);

    const onStreakUpdate = (e: any) => {
      setStreakData(e.detail || streakService.getStreakData());
    };
    const onPointsUpdate = (e: any) => {
      setUserPoints(e?.detail?.points !== undefined ? e.detail.points : pointsService.getUserPoints());
    };
    window.addEventListener('tarqa_streak_updated', onStreakUpdate);
    window.addEventListener('tarqa_points_updated', onPointsUpdate);
    return () => {
      window.removeEventListener('tarqa_streak_updated', onStreakUpdate);
      window.removeEventListener('tarqa_points_updated', onPointsUpdate);
    };
  }, []);

  // تحديث حالة الاشتراك والمدرسين والملفات
  useEffect(() => {
    setSubscription(getSubscriptionDetails(currentUser));
    const onSubChange = () => setSubscription(getSubscriptionDetails(currentUser));
    const onModulesChange = (e: any) => setModules(e.detail || coursesStorage.getModules());
    const onFilesChange = (e: any) => setFiles(e.detail || coursesStorage.getFiles());
    const onInstructorsChange = (e: any) => setInstructors(e.detail || coursesStorage.getInstructors());

    window.addEventListener('tarqa_subscription_changed', onSubChange);
    window.addEventListener('tarqa_user_changed', onSubChange);
    window.addEventListener('tarqa_courses_modules_changed', onModulesChange);
    window.addEventListener('tarqa_courses_files_changed', onFilesChange);
    window.addEventListener('tarqa_instructors_changed', onInstructorsChange);

    return () => {
      window.removeEventListener('tarqa_subscription_changed', onSubChange);
      window.removeEventListener('tarqa_user_changed', onSubChange);
      window.removeEventListener('tarqa_courses_modules_changed', onModulesChange);
      window.removeEventListener('tarqa_courses_files_changed', onFilesChange);
      window.removeEventListener('tarqa_instructors_changed', onInstructorsChange);
    };
  }, [currentUser]);

  // تشغيل مؤقت البومودورو
  useEffect(() => {
    let interval: any = null;
    if (isPomodoroRunning && pomodoroSeconds > 0) {
      interval = setInterval(() => {
        setPomodoroSeconds((prev) => prev - 1);
      }, 1000);
    } else if (pomodoroSeconds === 0) {
      setIsPomodoroRunning(false);
      if (pomodoroMode === 'focus') {
        setPomodoroMode('break');
        setPomodoroSeconds(5 * 60);
        pointsService.addPoints(40, 'إكمال جلسة تركيز بومودورو 25 دقيقة ⏱️', 'pomodoro', currentUser);
        setStreakToast('كفو يا بطل! أنهيت جلسة تركيز 25 دقيقة (+40 XP) 👏 وقت استراحة 5 دقائق.');
      } else {
        setPomodoroMode('focus');
        setPomodoroSeconds(25 * 60);
        setStreakToast('انتهت الاستراحة! هل أنت جاهز لجلسة تركيز جديدة؟ 🚀');
      }
      setTimeout(() => setStreakToast(null), 4000);
    }
    return () => clearInterval(interval);
  }, [isPomodoroRunning, pomodoroSeconds, pomodoroMode, currentUser]);

  // حفظ مهام المذاكرة
  const toggleTask = (taskId: string) => {
    const taskObj = dailyTasks.find((t: any) => t.id === taskId);
    const willBeCompleted = taskObj ? !taskObj.completed : false;

    const updated = dailyTasks.map((t: any) => (t.id === taskId ? { ...t, completed: !t.completed } : t));
    setDailyTasks(updated);
    try {
      const todayKey = 'tarqa_tasks_' + new Date().toISOString().split('T')[0];
      localStorage.setItem(todayKey, JSON.stringify(updated));
    } catch {}

    // إذا أكمل مهمة، نمنح نقاط ونؤكد نشاط الستريك
    if (willBeCompleted) {
      pointsService.addPoints(25, 'إنجاز مهمة مذاكرة يومية ✅', 'task', currentUser);
      setStreakToast('تم إنجاز المهمة بنجاح (+25 XP)! 🎉');
      setTimeout(() => setStreakToast(null), 3000);
    }
    streakService.recordDailyActivity('complete_task');
  };

  // تفعيل شعلة اليوم يدوياً
  const handleCheckIn = () => {
    const updated = streakService.checkInToday();
    setStreakData(updated);
    pointsService.addPoints(50, 'تثبيت شعلة الستريك اليومية 🔥', 'streak', currentUser);
    setStreakToast('تم تثبيت وإشعال شعلة الالتزام لليوم بنجاح (+50 XP)! 🔥 كفو استمر!');
    setTimeout(() => setStreakToast(null), 4000);
  };

  // حفظ الملاحظات
  const handleSaveNotes = () => {
    localStorage.setItem('tarqa_student_notes_v1', studentNotes);
    setIsEditingNotes(false);
    setNotesSaveStatus('تم حفظ ملاحظاتك بنجاح ✅');
    setTimeout(() => setNotesSaveStatus(null), 3000);
  };

  // إلغاء الاشتراك
  const handleCancelMySub = async () => {
    if (!currentUser) return;
    if (window.confirm('هل أنت متأكد من رغبتك في إلغاء اشتراكك في باقة طرقع السنوية؟')) {
      setIsCancelling(true);
      try {
        const res = await cancelAnnualSubscription(currentUser.id, currentUser.email);
        setCancelMessage(res.message);
        setSubscription(getSubscriptionDetails(currentUser));
        setTimeout(() => setCancelMessage(null), 3000);
      } finally {
        setIsCancelling(false);
      }
    }
  };

  // بيانات المدرسين والدورات
  const currentModule = modules[0] || {
    id: 'mod-lectures',
    title: 'المحاضرات التأسيسية',
    lessons: [],
  };

  const allLessons = currentModule.lessons || [];
  const teacher1Info = instructors.find((i) => i.id === 'teacher_1') || {
    id: 'teacher_1',
    name: 'مدرس 1',
    fullName: 'مدرس 1',
    title: 'خبير التأسيس الذهني والخرائط المعرفية',
    tagline: 'شرح تأصيلي مبسط من الصفر يربط المفاهيم بالخرائط الذهنية.',
    avatarIcon: '👨‍🏫',
  };
  const teacher2Info = instructors.find((i) => i.id === 'teacher_2') || {
    id: 'teacher_2',
    name: 'مدرس 2',
    fullName: 'مدرس 2',
    title: 'خبير التكنيك السريع واستراتيجيات الـ 100',
    tagline: 'طرق طرقع السحرية للحل الخاطف بمجرد النظر واستبعاد الخيارات.',
    avatarIcon: '⚡',
  };

  const teacher1Lessons = allLessons.filter((l) => (l.teacherId || 'teacher_1') === 'teacher_1');
  const teacher2Lessons = allLessons.filter((l) => l.teacherId === 'teacher_2');

  const activeTeacherLessons = preferredTeacher === 'teacher_2' ? teacher2Lessons : teacher1Lessons;
  const activeTeacherInfo = preferredTeacher === 'teacher_2' ? teacher2Info : teacher1Info;

  // إحصائيات الوقت والمحاضرات
  const totalWatchHours = Math.round(allLessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60) || 12;
  const completedTasksCount = dailyTasks.filter((t: any) => t.completed).length;
  const tasksProgressPercent = Math.round((completedTasksCount / dailyTasks.length) * 100);

  // الأسئلة المحفوظة
  const bookmarkedQuestions = questionBankStorage.getQuestions().filter((q) => bookmarkedIds.includes(q.id));

  // تحية مخصصة للوقت
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الهمة والتفوق ☀️';
    if (hour < 17) return 'طاب يومك يا بطل 🌟';
    return 'مساء الإنجاز والتركيز 🌙';
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* إشعار عائم Toast */}
      {streakToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 text-white border border-amber-500/50 shadow-2xl backdrop-blur-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
          <span className="text-xs sm:text-sm font-bold">{streakToast}</span>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 1. ترويسة لوحة الطالب مع شعلة الستريك التفاعلية وبطاقة الاشتراك */}
      {/* ======================================================================= */}
      <div className="relative overflow-hidden rounded-3xl tarqa-glass-card border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_30px_rgba(245,158,11,0.08)]">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              <span>{getGreeting()}</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              أهلاً بك، {currentUser?.fullName || 'طالب طرقع المتميز'} 👋
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              مركزك التعليمي المتكامل لمتابعة دورات التأسيس، إدارة خطتك الدراسية اليومية، وتدوين ملاحظاتك للوصول للـ <strong>+100</strong> بإذن الله.
            </p>
          </div>

          {/* بطاقات الإحصاء السريع العلوية (الستريك + النقاط + الاشتراك) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto">
            {/* بطاقة النقاط والمستوى والمتصدرين */}
            <div 
              onClick={onNavigateLeaderboard}
              className="flex-1 sm:flex-initial p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 via-yellow-500/5 to-transparent border border-amber-500/30 shadow-md flex items-center gap-3.5 min-w-[190px] cursor-pointer hover:border-amber-500 transition group"
              title="اضغط لفتح لوحة المتصدرين والأبطال"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center text-2xl shadow-md shadow-amber-500/30 shrink-0 group-hover:scale-105 transition-transform">
                🏆
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {userPoints.toLocaleString()}
                  </span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">XP</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  <span>{userRankLevel.badge} {userRankLevel.title}</span>
                </div>
              </div>
            </div>

            {/* بطاقة الستريك التفاعلي والشعلة */}
            <div className="flex-1 sm:flex-initial p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/30 shadow-md flex items-center gap-3.5 min-w-[190px]">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-2xl shadow-md shadow-amber-500/30 shrink-0">
                🔥
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {streakData.currentStreak}
                  </span>
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">أيام التزام</span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  <span>أطول شعلة: {streakData.longestStreak} يوم</span>
                </div>
              </div>
            </div>

            {/* بطاقة حالة العضوية السنوية */}
            <div className={`flex-1 sm:flex-initial p-4 rounded-2xl border shadow-md flex items-center gap-3.5 min-w-[190px] ${
              subscription.isSubscribed
                ? 'bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent border-emerald-500/30'
                : 'bg-gradient-to-br from-slate-100 to-slate-200/50 dark:from-slate-800/80 dark:to-slate-900 border-slate-300 dark:border-slate-700'
            }`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shadow-md shrink-0 ${
                subscription.isSubscribed ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
              }`}>
                {subscription.isSubscribed ? '👑' : '🎓'}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">باقة الطالب:</div>
                <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1">
                  <span>{subscription.isSubscribed ? 'باقة طرقع السنوية VIP' : 'عضوية تجريبية'}</span>
                  {subscription.isSubscribed && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {subscription.isSubscribed ? `صالحة حتى: ${subscription.expiresDateFormatted}` : 'متاح معاينة المحاضرات المجانية'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 2. شريط الستريك الأسبوعي التفاعلي مع زر تثبيت النشاط */}
      {/* ======================================================================= */}
      <div className="p-4 sm:p-6 rounded-3xl bg-white/70 dark:bg-[#120e1d]/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-black">
              🔥
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>سجل التزامك اليومي والأسبوعي (Learning Streak)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  {streakData.todayCompleted ? 'شعلة اليوم مضاءة ✅' : 'في انتظار تثبيت اليوم 🔥'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                كل يوم تذاكر فيه أو تشاهد محاضرة يزيد شعلتك ويقربك من الـ 100%.
              </p>
            </div>
          </div>

          {!streakData.todayCompleted ? (
            <button
              onClick={handleCheckIn}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/25 active:scale-95 cursor-pointer"
            >
              <Flame className="w-4 h-4 fill-current" />
              <span>إشعال وتثبيت شعلة اليوم! 🔥</span>
            </button>
          ) : (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-black flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              <span>تم إثبات التزام اليوم بنجاح ✨</span>
            </div>
          )}
        </div>

        {/* عرض أيام الأسبوع الـ 7 */}
        <div className="grid grid-cols-7 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          {streakData.weeklyDays.map((day, idx) => (
            <div
              key={idx}
              className={`p-2 sm:p-3 rounded-2xl flex flex-col items-center justify-center text-center transition border ${
                day.isActive
                  ? 'bg-gradient-to-b from-amber-500/20 to-amber-500/5 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-sm'
                  : day.isToday
                  ? 'bg-slate-100 dark:bg-slate-800/80 border-amber-500/40 text-slate-700 dark:text-slate-300 ring-2 ring-amber-500/20'
                  : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-800/50 text-slate-400'
              }`}
            >
              <span className="text-[10px] sm:text-xs font-bold mb-1">
                {day.dayShort}
              </span>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold ${
                day.isActive
                  ? 'bg-amber-500 text-slate-950 shadow-inner'
                  : day.isToday
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  : 'bg-transparent text-slate-300 dark:text-slate-700'
              }`}>
                {day.isActive ? '🔥' : day.isToday ? '⏳' : '•'}
              </div>
              <span className="text-[9px] font-mono text-slate-400 mt-1 hidden sm:block">
                {day.dateStr.split('-').slice(1).join('/')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. شبكة المحتوى التعليمي الرئيسي: متابعة الدورة + المهام اليومية */}
      {/* ======================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* العمود الأيمن (2/3): استكمال الدورة واختيار مسار الشرح */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* بطاقة متابعة مسار التأسيس */}
          <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm">
                    🎬
                  </div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    مسار تأسيس القدرات بالفيديو
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  تابع محاضراتك التأسيسية خطوة بخطوة مع المعلم الأنسب لأسلوبك.
                </p>
              </div>

              {/* تبديل المسار بين مدرس 1 ومدرس 2 */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setPreferredTeacher('teacher_1')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    preferredTeacher === 'teacher_1'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{teacher1Info.avatarIcon || '👨‍🏫'} {teacher1Info.name}</span>
                </button>
                <button
                  onClick={() => setPreferredTeacher('teacher_2')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                    preferredTeacher === 'teacher_2'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{teacher2Info.avatarIcon || '⚡'} {teacher2Info.name}</span>
                </button>
              </div>
            </div>

            {/* بطاقة المعلم النشط والمحاضرات */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-50 dark:via-slate-900/60 to-transparent border border-amber-500/20 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shadow-inner">
                    {activeTeacherInfo.avatarIcon || '👨‍🏫'}
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                      {activeTeacherInfo.fullName || activeTeacherInfo.name}
                    </h3>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold">
                      {activeTeacherInfo.title}
                    </p>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  {activeTeacherLessons.length} محاضرات
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {activeTeacherInfo.tagline}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-3 text-slate-500 text-[11px] font-bold">
                  <span>⏱️ {Math.round(activeTeacherLessons.reduce((acc, l) => acc + (l.durationMinutes || 0), 0) / 60)} ساعة تدريب</span>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    🎁 {activeTeacherLessons.filter((l) => l.isFreePreview).length} محاضرات مجانية
                  </span>
                </div>

                {onNavigateCourses && (
                  <button
                    onClick={onNavigateCourses}
                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
                  >
                    <span>فتح قسم الدورات والمحاضرات</span>
                    <Play className="w-3 h-3 fill-current" />
                  </button>
                )}
              </div>
            </div>

            {/* قائمة سريعة بأول 3 محاضرات في المسار */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
                <span>المحاضرات المقترحة للدراسة الآن:</span>
                {onNavigateCourses && (
                  <button
                    onClick={onNavigateCourses}
                    className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    عرض كافة المحاضرات ({activeTeacherLessons.length}) ←
                  </button>
                )}
              </div>

              {activeTeacherLessons.slice(0, 3).map((lesson, idx) => (
                <div
                  key={lesson.id}
                  onClick={onNavigateCourses}
                  className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 hover:border-amber-500/40 hover:bg-amber-500/5 transition cursor-pointer flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-amber-500 group-hover:text-slate-950 flex items-center justify-center text-xs font-black transition shrink-0">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {lesson.title}
                        </h4>
                        {lesson.isFreePreview && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            مجاني 🎁
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {lesson.description || 'شرح تفاعلي مكثف مع تطبيقات قياس'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 group-hover:text-amber-500 text-xs font-bold shrink-0">
                    <span>{lesson.durationMinutes} د</span>
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* بنك المذكرات والملخصات المفضلة */}
          <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-sm">
                  📄
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  مذكراتي وملازم الـ PDF المعتمدة
                </h3>
              </div>
              <span className="text-xs font-bold text-slate-400">{files.length} ملف متاح</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {files.slice(0, 3).map((file) => (
                <div
                  key={file.id}
                  className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 hover:border-blue-500/40 transition"
                >
                  <div className="space-y-1">
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-blue-500/10 text-blue-600 dark:text-blue-400 inline-block">
                      {file.fileSize || 'PDF'}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {file.title}
                    </h4>
                  </div>

                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      downloadTrackingService.trackDownload(
                        {
                          id: file.id,
                          title: file.title,
                          fileUrl: file.fileUrl,
                          fileType: file.fileType,
                          fileSize: file.fileSize,
                        },
                        currentUser
                      );
                    }}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>تحميل المذكرة</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* العمود الأيسر (1/3): مهام اليوم + مؤقت بومودورو + كشكول الملاحظات */}
        <div className="space-y-6">
          
          {/* مؤقت بومودورو المدمج للمذاكرة */}
          <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4 text-center">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Timer className="w-4 h-4 text-amber-500" />
                <span>مؤقت تركيز بومودورو ⏱️</span>
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                pomodoroMode === 'focus' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}>
                {pomodoroMode === 'focus' ? 'جلسة تركيز' : 'وقت استراحة'}
              </span>
            </div>

            <div className="py-2">
              <div className="text-4xl sm:text-5xl font-mono font-black text-slate-900 dark:text-white tracking-widest">
                {formatTimer(pomodoroSeconds)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {pomodoroMode === 'focus' ? 'ركز تماماً في الشرح والتطبيق الذهني' : 'استرخِ قليلاً واستعد للجولة القادمة'}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                  isPomodoroRunning
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-amber-500/20'
                }`}
              >
                {isPomodoroRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPomodoroRunning ? 'إيقاف مؤقت' : 'ابدأ التركيز الآن 🚀'}</span>
              </button>

              <button
                onClick={() => {
                  setIsPomodoroRunning(false);
                  setPomodoroSeconds(pomodoroMode === 'focus' ? 25 * 60 : 5 * 60);
                }}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                title="إعادة ضبط المؤقت"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* خطة ومهام المذاكرة اليومية (Daily Tasks To-Do) */}
          <div id="daily-tasks" className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  مهام المذاكرة لليوم
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  +25 XP لكل مهمة
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {completedTasksCount} من {dailyTasks.length}
                </span>
              </div>
            </div>

            {/* شريط الإنجاز */}
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                  style={{ width: `${tasksProgressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>إنجاز اليوم</span>
                <span>{tasksProgressPercent}%</span>
              </div>
            </div>

            <div className="space-y-2">
              {dailyTasks.map((task: any) => (
                <div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2.5 ${
                    task.completed
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-slate-500 dark:text-slate-400 line-through'
                      : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-500/30 hover:bg-emerald-500/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${
                      task.completed ? 'bg-emerald-500 text-slate-950' : 'border border-slate-400'
                    }`}>
                      {task.completed && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="text-xs font-bold leading-tight select-none">
                      {task.title}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black shrink-0 ${task.completed ? 'text-emerald-500' : 'text-amber-500'}`}>
                    +25 XP
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* كشكول الملاحظات والتدوينات السريع */}
          <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  كشكول الملاحظات والتدوينات 📝
                </h3>
              </div>
              <button
                onClick={() => {
                  if (isEditingNotes) handleSaveNotes();
                  else setIsEditingNotes(true);
                }}
                className="text-xs font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                {isEditingNotes ? <Save className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                <span>{isEditingNotes ? 'حفظ' : 'تعديل'}</span>
              </button>
            </div>

            {notesSaveStatus && (
              <p className="text-[10px] font-bold text-emerald-500">{notesSaveStatus}</p>
            )}

            {isEditingNotes ? (
              <textarea
                rows={4}
                value={studentNotes}
                placeholder="اكتب هنا ملاحظاتك وتلخيصاتك الخاصة أثناء المذاكرة..."
                onChange={(e) => setStudentNotes(e.target.value)}
                className="w-full p-3 rounded-xl bg-white dark:bg-slate-900 border border-amber-500/40 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line font-medium">
                {studentNotes ? studentNotes : <span className="text-slate-400 dark:text-slate-500 italic">لا توجد ملاحظات مسجلة بعد. اضغط على "تعديل" لتدوين ملاحظاتك الخاصة 📝</span>}
              </div>
            )}
          </div>

          {/* قسم إدارة الاشتراك للمشتركين */}
          {subscription.isSubscribed && (
            <div className="p-4 rounded-2xl bg-slate-100/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold text-slate-600 dark:text-slate-400">
                <span>إدارة اشتراكك السنوي:</span>
                <span className="text-emerald-500">نشط ومفعل 🟢</span>
              </div>
              {cancelMessage && (
                <p className="text-[11px] font-bold text-emerald-500">{cancelMessage}</p>
              )}
              <button
                onClick={handleCancelMySub}
                disabled={isCancelling}
                className="text-[11px] text-rose-500 hover:text-rose-600 hover:underline font-bold cursor-pointer"
              >
                {isCancelling ? 'جاري الإلغاء...' : 'طلب إلغاء الاشتراك السنوي'}
              </button>
            </div>
          )}

        </div>
      </div>

      {/* ======================================================================= */}
      {/* 4. الأسئلة المحفوظة في المفضلة (إن وجدت) */}
      {/* ======================================================================= */}
      {bookmarkedQuestions.length > 0 && (
        <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500 fill-current" />
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                الأسئلة المحفوظة في المفضلة ({bookmarkedQuestions.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-bold">يمكنك مراجعتها وتثبيتها في أي وقت</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {bookmarkedQuestions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => setSelectedBookmarkedQuestion(q)}
                className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-amber-500/40 transition cursor-pointer flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    سؤال #{idx + 1}
                  </span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {q.questionText}
                  </p>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* نافذة تفاصيل السؤال المحفوظ */}
      {selectedBookmarkedQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-[#151022] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Bookmark className="w-4 h-4 text-amber-500 fill-current" />
                <span>مراجعة السؤال المحفوظ</span>
              </h3>
              <button
                onClick={() => setSelectedBookmarkedQuestion(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-bold leading-relaxed text-slate-900 dark:text-white">
              <MathRenderer content={selectedBookmarkedQuestion.questionText} />
            </div>

            <div className="space-y-2">
              {selectedBookmarkedQuestion.options.map((opt) => {
                const isCorrect = opt.id === selectedBookmarkedQuestion.correctOption;
                return (
                  <div
                    key={opt.id}
                    className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                      isCorrect
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <span>{opt.text}</span>
                    {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                  </div>
                );
              })}
            </div>

            {selectedBookmarkedQuestion.explanation && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                <span className="font-black block mb-1">طريقة الحل الذهني السريع:</span>
                <MathRenderer content={selectedBookmarkedQuestion.explanation} />
              </div>
            )}

            <button
              onClick={() => setSelectedBookmarkedQuestion(null)}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
