import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  Sparkles,
  Zap,
  TrendingUp,
  Award,
  Star,
  CheckCircle2,
  Clock,
  Video,
  FileText,
  ChevronLeft,
  ArrowUpRight,
  Shield,
  Layers,
  RotateCcw,
  RefreshCw,
  Users,
  LogIn,
  UserCheck
} from 'lucide-react';
import { TarqaUser } from '../lib/supabase';
import { pointsService, getRankLevel, LeaderboardEntry, RANK_LEVELS } from '../lib/pointsService';

interface LeaderboardViewProps {
  currentUser: TarqaUser | null;
  onOpenAuth?: () => void;
  onNavigateCourses?: () => void;
  onNavigateDashboard?: () => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({
  currentUser,
  onOpenAuth,
  onNavigateCourses,
  onNavigateDashboard,
}) => {
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'all_time'>('weekly');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() =>
    pointsService.getLeaderboard(currentUser, 'weekly')
  );
  const [userPoints, setUserPoints] = useState(() => (currentUser ? pointsService.getUserPoints() : 0));
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // جلب وتحديث قائمة المتصدرين من قاعدة البيانات الحقيقية
  const loadLeaderboardData = async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setIsLoading(true);
    try {
      const realData = await pointsService.fetchLeaderboard(currentUser, period);
      setLeaderboard(realData);
      setUserPoints(currentUser ? pointsService.getUserPoints() : 0);
    } catch (err) {
      console.warn('Failed to load leaderboard from DB:', err);
    } finally {
      if (showLoadingSpinner) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboardData(false);
  }, [currentUser, period]);

  useEffect(() => {
    const handleDataChanged = () => {
      loadLeaderboardData(false);
    };

    window.addEventListener('tarqa_points_updated', handleDataChanged);
    window.addEventListener('tarqa_roles_changed', handleDataChanged);
    window.addEventListener('tarqa_user_changed', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    return () => {
      window.removeEventListener('tarqa_points_updated', handleDataChanged);
      window.removeEventListener('tarqa_roles_changed', handleDataChanged);
      window.removeEventListener('tarqa_user_changed', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
    };
  }, [currentUser, period]);

  const currentUserEntry = leaderboard.find((e) => e.isCurrentUser);
  const currentRank = currentUserEntry?.rank;
  const userRankLevel = getRankLevel(userPoints);
  const nextLevel = RANK_LEVELS.find((l) => l.level === userRankLevel.level + 1);

  // حساب النسبة المئوية للترقية
  const levelProgress = nextLevel
    ? Math.min(
        100,
        Math.round(
          ((userPoints - userRankLevel.minPoints) /
            (nextLevel.minPoints - userRankLevel.minPoints)) *
            100
        )
      )
    : 100;

  // المراكز الثلاثة الأولى (منصة التتويج)
  const firstPlace = leaderboard[0];
  const secondPlace = leaderboard[1];
  const thirdPlace = leaderboard[2];

  // المراكز العشرة التالية بعد منصة التتويج (المراكز من 4 إلى 13)
  const top10AfterPodium = leaderboard.slice(3, 13);

  // فحص ما إذا كان المستخدم مسجلاً وترتيبه خارج الـ 13 الأوائل
  const isCurrentUserInTop13 = currentUserEntry ? currentUserEntry.rank <= 13 : false;
  const showUserOutOfTop13Row = Boolean(currentUser && currentUserEntry && !isCurrentUserInTop13);

  const handleResetPoints = async () => {
    pointsService.resetPointsToZero(currentUser);
    setShowResetConfirm(false);
    setUserPoints(0);
    const fresh = pointsService.getLeaderboard(currentUser, period);
    setLeaderboard(fresh);
    await loadLeaderboardData(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300 font-cairo">
      
      {/* ======================================================================= */}
      {/* 1. الترويسة الرئيسية ولوحة الشرف */}
      {/* ======================================================================= */}
      <div className="relative overflow-hidden rounded-3xl tarqa-glass-card border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 backdrop-blur-2xl shadow-[0_8px_30px_rgba(245,158,11,0.08)]">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5" />
              <span>لوحة الشرف وتصنيف أبطال طرقع 🏆</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              لوحة المتصدرين ونقاط التميز (XP)
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              تصنيف مباشر متزامن مع الأعضاء المسجلين في المنصة. اجمع نقاط الخبرة (XP) عبر مشاهدة المحاضرات، حل الأسئلة، وتثبيت الستريك اليومي!
            </p>
          </div>

          {/* بطاقة المستخدم الحالي أو دعوة تسجيل الدخول */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {currentUser ? (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/20 via-amber-500/5 to-transparent border border-amber-500/30 shadow-lg flex items-center gap-4 min-w-[240px] w-full sm:w-auto">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex flex-col items-center justify-center font-black shadow-md shadow-amber-500/30 shrink-0">
                  <span className="text-[10px] uppercase font-bold opacity-80">ترتيبك</span>
                  <span className="text-xl font-black">#{currentRank || '-'}</span>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400">رصيدك الحالي:</div>
                  <div className="text-xl font-black text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span>{userPoints.toLocaleString()}</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">XP</span>
                    <span className="text-sm">{userRankLevel.badge}</span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                    {userRankLevel.title}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-slate-900/40 to-transparent border border-blue-500/20 shadow-lg flex flex-col sm:flex-row items-center gap-4 min-w-[260px] w-full sm:w-auto text-center sm:text-right">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black text-2xl shrink-0">
                  🚀
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">أنت تتصفح كزائر</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">سجل دخولك لتنافس وتكسب نقاط XP</p>
                  {onOpenAuth && (
                    <button
                      type="button"
                      onClick={onOpenAuth}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 transition shadow-sm"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>تسجيل الدخول / حساب جديد</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => loadLeaderboardData(true)}
                disabled={isLoading}
                title="تحديث القائمة من السحابة"
                className="flex-1 sm:flex-none p-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
                <span className="sm:hidden">تحديث</span>
              </button>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  title="تصفير نقاطك للبدء من جديد"
                  className="px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center gap-1.5 text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>تصفير نقاطي</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* نافذة تأكيد تصفير النقاط */}
      {showResetConfirm && (
        <div className="p-4 sm:p-6 rounded-2xl bg-rose-500/10 border-2 border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3 text-right">
            <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center font-black text-xl shrink-0">
              ⚠️
            </div>
            <div>
              <h4 className="text-sm font-black text-slate-900 dark:text-white">هل أنت متأكد من تصفير رصيد نقاطك إلى 0 XP؟</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">سيتم مسح سجل النقاط المتراكمة والبدء من جديد من الصفر.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleResetPoints}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-rose-600 text-white font-black text-xs hover:bg-rose-500 transition shadow-md shadow-rose-600/20"
            >
              نعم، صفر النقاط الآن
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 2. أزرار تبديل الفترة (أسبوعي / شهري / الترتيب العام) */}
      {/* ======================================================================= */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPeriod('weekly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              period === 'weekly'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الأسبوع الحالي 📅
          </button>

          <button
            type="button"
            onClick={() => setPeriod('monthly')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              period === 'monthly'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            هذا الشهر 🌙
          </button>

          <button
            type="button"
            onClick={() => setPeriod('all_time')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              period === 'all_time'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            الترتيب العام 🏆
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Users className="w-4 h-4 text-amber-500" />
          <span>الأعضاء المسجلون: <strong className="text-slate-900 dark:text-white">{leaderboard.length}</strong></span>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* 3. منصة التتويج للثلاثة الأوائل (Top 3 Podium) */}
      {/* ======================================================================= */}
      {leaderboard.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 items-end">
          {/* المركز الثاني 🥈 */}
          {secondPlace ? (
            <div className="order-2 md:order-1 p-6 rounded-3xl bg-gradient-to-b from-slate-200/40 via-white/80 to-white/40 dark:from-slate-700/20 dark:via-[#130f1e]/80 dark:to-[#0f0b18]/40 border-2 border-slate-300 dark:border-slate-700 backdrop-blur-xl shadow-lg flex flex-col items-center text-center relative space-y-3">
              <div className="absolute -top-6 w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 dark:from-slate-600 dark:to-slate-400 text-slate-950 dark:text-white flex items-center justify-center font-black text-xl shadow-lg shadow-slate-400/20 border-2 border-white dark:border-slate-800">
                🥈
              </div>

              <div className="w-16 h-16 rounded-2xl bg-slate-200/50 dark:bg-slate-800/80 flex items-center justify-center text-3xl shadow-inner mt-2 overflow-hidden border border-slate-300 dark:border-slate-700">
                {secondPlace.avatarUrl ? (
                  <img src={secondPlace.avatarUrl} alt={secondPlace.name} className="w-full h-full object-cover" />
                ) : (
                  secondPlace.avatarIcon || '🥈'
                )}
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                  <span>{secondPlace.name}</span>
                  {secondPlace.isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">أنت</span>}
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {secondPlace.levelTitle}
                </span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-slate-200/50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 font-black text-sm flex items-center gap-1.5 shadow-sm">
                <Zap className="w-4 h-4 text-amber-500 fill-current" />
                <span>{secondPlace.points.toLocaleString()} XP</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <span>🔥 {secondPlace.streak} يوم ستريك</span>
                <span>•</span>
                <span>🎬 {secondPlace.completedLessons} محاضرة</span>
              </div>
            </div>
          ) : (
            <div className="order-2 md:order-1 p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-400 text-xs py-12 flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">🥈</span>
              <span>في انتظار المركز الثاني</span>
            </div>
          )}

          {/* المركز الأول 🥇 (البطل الذهبي المتصدر) */}
          {firstPlace ? (
            <div className="order-1 md:order-2 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-500/25 via-amber-500/10 to-amber-500/5 border-2 border-amber-500 backdrop-blur-2xl shadow-[0_12px_40px_rgba(245,158,11,0.25)] flex flex-col items-center text-center relative space-y-3 sm:-translate-y-4">
              <div className="absolute -top-8 w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-300 text-slate-950 flex flex-col items-center justify-center font-black text-2xl shadow-xl shadow-amber-500/40 border-2 border-white dark:border-slate-900">
                <Crown className="w-5 h-5 fill-current" />
                <span className="text-xs font-black leading-none mt-0.5">#1</span>
              </div>

              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400/30 to-yellow-500/30 border border-amber-500/40 flex items-center justify-center text-4xl shadow-inner mt-4 overflow-hidden">
                {firstPlace.avatarUrl ? (
                  <img src={firstPlace.avatarUrl} alt={firstPlace.name} className="w-full h-full object-cover" />
                ) : (
                  firstPlace.avatarIcon || '👑'
                )}
              </div>

              <div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black mb-1">
                  <span>بطل المتصدرين 👑</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                  <span>{firstPlace.name}</span>
                  {firstPlace.isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">أنت</span>}
                </h3>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  {firstPlace.levelTitle}
                </span>
              </div>

              <div className="px-5 py-2 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-base flex items-center gap-1.5 shadow-md shadow-amber-500/30">
                <Zap className="w-4 h-4 fill-current" />
                <span>{firstPlace.points.toLocaleString()} XP</span>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-300">
                <span>🔥 {firstPlace.streak} يوم التزام</span>
                <span>•</span>
                <span>🎬 {firstPlace.completedLessons} محاضرة</span>
              </div>
            </div>
          ) : (
            <div className="order-1 md:order-2 p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-400 text-xs py-12 flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">🥇</span>
              <span>في انتظار بطل المركز الأول</span>
            </div>
          )}

          {/* المركز الثالث 🥉 */}
          {thirdPlace ? (
            <div className="order-3 md:order-3 p-6 rounded-3xl bg-gradient-to-b from-amber-700/10 via-white/80 to-white/40 dark:from-amber-900/20 dark:via-[#151022]/80 dark:to-[#120e1d]/40 border-2 border-amber-700/30 dark:border-amber-700/40 backdrop-blur-xl shadow-lg flex flex-col items-center text-center relative space-y-3">
              <div className="absolute -top-6 w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-700 to-amber-500 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-amber-700/20 border-2 border-white dark:border-slate-800">
                🥉
              </div>

              <div className="w-16 h-16 rounded-2xl bg-amber-700/15 dark:bg-amber-900/30 flex items-center justify-center text-3xl shadow-inner mt-2 overflow-hidden border border-amber-700/30">
                {thirdPlace.avatarUrl ? (
                  <img src={thirdPlace.avatarUrl} alt={thirdPlace.name} className="w-full h-full object-cover" />
                ) : (
                  thirdPlace.avatarIcon || '🥉'
                )}
              </div>

              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                  <span>{thirdPlace.name}</span>
                  {thirdPlace.isCurrentUser && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-black">أنت</span>}
                </h3>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {thirdPlace.levelTitle}
                </span>
              </div>

              <div className="px-3.5 py-1.5 rounded-xl bg-amber-700/10 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 font-black text-sm flex items-center gap-1.5 shadow-sm">
                <Zap className="w-4 h-4 text-amber-500 fill-current" />
                <span>{thirdPlace.points.toLocaleString()} XP</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <span>🔥 {thirdPlace.streak} يوم ستريك</span>
                <span>•</span>
                <span>🎬 {thirdPlace.completedLessons} محاضرة</span>
              </div>
            </div>
          ) : (
            <div className="order-3 md:order-3 p-6 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-400 text-xs py-12 flex flex-col items-center justify-center gap-2">
              <span className="text-2xl">🥉</span>
              <span>في انتظار المركز الثالث</span>
            </div>
          )}
        </div>
      ) : null}

      {/* ======================================================================= */}
      {/* 4. تفاصيل مستواك الحالي ونظام الترقية والرتب (إذا كان مسجلاً) */}
      {/* ======================================================================= */}
      {currentUser && (
        <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-black">
                {userRankLevel.badge}
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  مستواك الحالي: {userRankLevel.title} (المستوى {userRankLevel.level})
                </h3>
                <p className="text-[11px] text-slate-500">
                  {nextLevel
                    ? `تحتاج إلى ${(nextLevel.minPoints - userPoints).toLocaleString()} نقطة للترقية إلى رتبة [${nextLevel.title} ${nextLevel.badge}]`
                    : 'أنت في أعلى رتبة أسطورية في المنصة! 👑'}
                </p>
              </div>
            </div>

            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
              {levelProgress}% مكتمل
            </span>
          </div>

          {/* شريط التقدم للرتبة التالية */}
          <div className="space-y-1.5">
            <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-bold text-slate-400">
              <span>{userRankLevel.title} ({userRankLevel.minPoints} XP)</span>
              <span>{nextLevel ? `${nextLevel.title} (${nextLevel.minPoints} XP)` : 'الحد الأقصى 👑'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 5. جدول المراكز العشرة التالية (من المركز 4 إلى 13) + ترتيبك الشخصي */}
      {/* ======================================================================= */}
      <div className="p-6 rounded-3xl tarqa-glass-card border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>قائمة المتصدرين (المراكز من 4 إلى 13)</span>
          </h3>
          {currentUserEntry && (
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
              ترتيبك الحالي: <span className="font-black text-amber-500">#{currentUserEntry.rank}</span>
            </div>
          )}
        </div>

        {leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="text-3xl">👥</div>
            <div className="font-bold text-slate-700 dark:text-slate-300">لا يوجد أعضاء مسجلين في قاعدة البيانات بعد</div>
            <p className="text-[11px]">سجل حسابك لتكون أول المنضمين للوحة الشرف!</p>
          </div>
        ) : leaderboard.length <= 3 && top10AfterPodium.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 space-y-1.5">
            <div className="font-bold text-slate-700 dark:text-slate-300">المراكز الحالية محصورة في منصة التتويج الثلاثية أعلاه 🏆</div>
            <p className="text-[11px]">اجمع نقاط الخبرة من مشاهدة المحاضرات لتنضم للمراكز العشرة التالية!</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {top10AfterPodium.map((student) => {
              return (
                <div
                  key={student.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    student.isCurrentUser
                      ? 'bg-amber-500/15 border-amber-500 shadow-md ring-2 ring-amber-500/30'
                      : 'bg-white/60 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* رقم الترتيب */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      student.isCurrentUser
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}>
                      #{student.rank}
                    </div>

                    {/* الأيقونة والاسم */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                      {student.avatarUrl ? (
                        <img src={student.avatarUrl} alt={student.name} className="w-full h-full object-cover" />
                      ) : (
                        student.avatarIcon || '🎓'
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {student.name}
                        </h4>
                        {student.isCurrentUser && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950 shrink-0">
                            أنت ✨
                          </span>
                        )}
                        {student.role === 'super_admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                            مالك
                          </span>
                        )}
                        {student.role === 'teacher' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                            معلم
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate mt-0.5">
                        <span>{student.levelTitle}</span>
                        {student.email && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{student.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* النقاط والرتبة */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-end">
                        <span>{student.points.toLocaleString()}</span>
                        <span className="text-[10px]">XP</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block text-left">
                        {student.completedLessons} محاضرة
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* إذا كان ترتيب الطالب الحالي خارج الـ 13 الأوائل (مثلاً المركز 27)، يظهر صفه تحت الـ 13 مع رقم ترتيبه الفعلي */}
            {showUserOutOfTop13Row && currentUserEntry && (
              <div className="pt-2 space-y-2">
                <div className="py-2 flex items-center justify-center gap-3 text-slate-400 dark:text-slate-600 text-xs">
                  <span className="h-px w-20 bg-slate-200 dark:bg-slate-800" />
                  <span className="font-mono text-[11px] tracking-widest text-amber-500">• • •</span>
                  <span className="h-px w-20 bg-slate-200 dark:bg-slate-800" />
                </div>

                <div className="flex items-center justify-between text-[11px] font-bold text-amber-600 dark:text-amber-400 px-1">
                  <span>موقعك الحالي في الترتيب العام:</span>
                  <span className="font-black">المركز #{currentUserEntry.rank}</span>
                </div>

                <div
                  className="p-3.5 sm:p-4 rounded-2xl border bg-amber-500/15 border-amber-500 shadow-md ring-2 ring-amber-500/30 transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    {/* رقم الترتيب الفعلي للطالب */}
                    <div className="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 shadow-sm flex items-center justify-center font-black text-xs shrink-0">
                      #{currentUserEntry.rank}
                    </div>

                    {/* الأيقونة والاسم */}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xl shrink-0 overflow-hidden border border-slate-200 dark:border-slate-700">
                      {currentUserEntry.avatarUrl ? (
                        <img src={currentUserEntry.avatarUrl} alt={currentUserEntry.name} className="w-full h-full object-cover" />
                      ) : (
                        currentUserEntry.avatarIcon || '⚡'
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                          {currentUserEntry.name}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500 text-slate-950 shrink-0">
                          أنت ✨
                        </span>
                        {currentUserEntry.role === 'super_admin' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                            مالك
                          </span>
                        )}
                        {currentUserEntry.role === 'teacher' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 shrink-0">
                            معلم
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 truncate mt-0.5">
                        <span>{currentUserEntry.levelTitle}</span>
                        {currentUserEntry.email && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[120px]">{currentUserEntry.email}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* النقاط */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="text-xs sm:text-sm font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 justify-end">
                        <span>{currentUserEntry.points.toLocaleString()}</span>
                        <span className="text-[10px]">XP</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block text-left">
                        {currentUserEntry.completedLessons} محاضرة
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* 6. كيف تجمع النقاط وتتصدر؟ (How to Earn XP) */}
      {/* ======================================================================= */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500/10 via-slate-50 dark:via-slate-900/60 to-transparent border border-amber-500/20 space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
            كيف تجمع نقاط الخبرة (XP) وتصعد للمراكز الأولى؟
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-black text-sm">
              🔥
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">تثبيت شعلة الستريك اليومي</div>
            <div className="text-xs font-black text-amber-600 dark:text-amber-400">+50 XP يومياً</div>
            <p className="text-[10px] text-slate-400">حافظ على حضورك ومذاكرتك اليومية بانتظام.</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-500 flex items-center justify-center font-black text-sm">
              🎬
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">إكمال محاضرة تأسيسية</div>
            <div className="text-xs font-black text-blue-600 dark:text-blue-400">+100 XP لكل محاضرة</div>
            <p className="text-[10px] text-slate-400">شاهد محاضرات مدرس 1 ومدرس 2 التأسيسية.</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-black text-sm">
              ⏱️
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">جلسة تركيز بومودورو</div>
            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">+40 XP لكل 25 دقيقة</div>
            <p className="text-[10px] text-slate-400">أنهِ جلسة تركيز كاملة بدون تشتت.</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-1.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center font-black text-sm">
              📄
            </div>
            <div className="text-xs font-black text-slate-900 dark:text-white">قراءة مذكرة وملخص PDF</div>
            <div className="text-xs font-black text-purple-600 dark:text-purple-400">+30 XP لكل ملف</div>
            <p className="text-[10px] text-slate-400">راجع المذكرات والخرائط الذهنية المعتمدة.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
