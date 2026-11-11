import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Sparkles,
  BookOpen,
  Filter,
  UserCheck,
  UserX,
  Crown,
  GraduationCap,
  ShieldCheck,
  ChevronDown,
  Layers,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Zap,
  Video
} from 'lucide-react';
import { CourseItem, UserWithRole } from '../types';
import { coursesStorage, courseSubscriptionsManager, CourseSubscriberRecord, DEFAULT_FOUNDATION_COURSE } from '../lib/subscriptionService';
import { rolesService } from '../lib/rolesService';
import { isOwnerEmail } from '../lib/securityUtils';

interface CourseSubscribersDashboardProps {
  initialCourseId?: string;
  onBack?: () => void;
}

export const CourseSubscribersDashboard: React.FC<CourseSubscribersDashboardProps> = ({
  initialCourseId,
  onBack
}) => {
  const [courses, setCourses] = useState<CourseItem[]>(() => {
    const list = coursesStorage.getCourses();
    return list.length > 0 ? list : [DEFAULT_FOUNDATION_COURSE];
  });

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    if (initialCourseId && courses.some((c) => c.id === initialCourseId)) {
      return initialCourseId;
    }
    return courses[0]?.id || 'course-foundation';
  });

  const [allUsers, setAllUsers] = useState<UserWithRole[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'subscribed' | 'not_subscribed'>('all');
  const [isProcessingUser, setIsProcessingUser] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // إعادة تحميل قائمة الدورات تلقائياً عند إضافة أو تعديل أي دورة
  useEffect(() => {
    const refreshCourses = () => {
      const list = coursesStorage.getCourses();
      const updated = list.length > 0 ? list : [DEFAULT_FOUNDATION_COURSE];
      setCourses(updated);
      if (!updated.some((c) => c.id === selectedCourseId)) {
        setSelectedCourseId(updated[0]?.id || 'course-foundation');
      }
    };

    window.addEventListener('tarqa_courses_updated', refreshCourses);
    window.addEventListener('storage', refreshCourses);
    return () => {
      window.removeEventListener('tarqa_courses_updated', refreshCourses);
      window.removeEventListener('storage', refreshCourses);
    };
  }, [selectedCourseId]);

  // جلب كافة المستخدمين المسجلين في المنصة
  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      await courseSubscriptionsManager.syncFromHostinger();
      const users = await rolesService.getUsers(true);
      setAllUsers(users);
    } catch (e) {
      console.warn('Failed to load users for course subscribers:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0] || DEFAULT_FOUNDATION_COURSE;
  }, [courses, selectedCourseId]);

  // خريطة سجلات الاشتراكات للدورة المحددة
  const [subscribersMap, setSubscribersMap] = useState<Record<string, CourseSubscriberRecord>>({});

  const refreshSubscribers = () => {
    const list = courseSubscriptionsManager.getSubscribersForCourse(selectedCourseId);
    const map: Record<string, CourseSubscriberRecord> = {};
    for (const item of list) {
      if (item.userId) map[item.userId] = item;
      if (item.userEmail) map[item.userEmail.toLowerCase().trim()] = item;
    }
    setSubscribersMap(map);
  };

  useEffect(() => {
    refreshSubscribers();
    const handleSubChanged = () => refreshSubscribers();
    window.addEventListener('tarqa_course_subscriptions_changed', handleSubChanged);
    window.addEventListener('tarqa:subscription_updated', handleSubChanged);
    return () => {
      window.removeEventListener('tarqa_course_subscriptions_changed', handleSubChanged);
      window.removeEventListener('tarqa:subscription_updated', handleSubChanged);
    };
  }, [selectedCourseId]);

  // فحص اشتراك المستخدم في الدورة النشطة
  const checkUserStatus = (user: UserWithRole): { isSubscribed: boolean; isVIP: boolean; record?: CourseSubscriberRecord } => {
    const isOwner = isOwnerEmail(user.email);
    const role = (user.role || '').toLowerCase();
    const isVIP = isOwner || role === 'super_admin' || role === 'admin' || role === 'teacher' || role === 'e_cms';

    if (isVIP) {
      return { isSubscribed: true, isVIP: true };
    }

    const cleanEmail = (user.email || '').toLowerCase().trim();
    const subRecord = subscribersMap[user.id] || (cleanEmail ? subscribersMap[cleanEmail] : undefined);

    if (subRecord && subRecord.isActive) {
      if (!subRecord.expiresAt) return { isSubscribed: true, isVIP: false, record: subRecord };
      const notExp = new Date(subRecord.expiresAt).getTime() > Date.now();
      if (notExp) return { isSubscribed: true, isVIP: false, record: subRecord };
    }

    // إذا كان للمستخدم اشتراك عام شامل في المنصة
    if (user.isSubscribed && selectedCourse.id === 'course-foundation') {
      return { isSubscribed: true, isVIP: false, record: subRecord };
    }

    return { isSubscribed: false, isVIP: false, record: subRecord };
  };

  // إحصائيات سريعة للدورة المحددة
  const courseStats = useMemo(() => {
    let activeCount = 0;
    for (const u of allUsers) {
      const { isSubscribed } = checkUserStatus(u);
      if (isSubscribed) activeCount++;
    }
    return {
      totalUsers: allUsers.length,
      activeSubscribers: activeCount,
      nonSubscribers: Math.max(0, allUsers.length - activeCount),
    };
  }, [allUsers, subscribersMap, selectedCourseId]);

  // تصفية وبحث المستخدمين
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allUsers.filter((u) => {
      const name = (u.fullName || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const tg = (u.telegramUsername || '').toLowerCase();

      const matchesSearch = !q || name.includes(q) || email.includes(q) || tg.includes(q);
      if (!matchesSearch) return false;

      const { isSubscribed } = checkUserStatus(u);
      if (filterType === 'subscribed') return isSubscribed;
      if (filterType === 'not_subscribed') return !isSubscribed;
      return true;
    });
  }, [allUsers, searchQuery, filterType, subscribersMap, selectedCourseId]);

  // تفعيل الاشتراك في الدورة لمستخدم
  const handleActivateSubscription = async (user: UserWithRole, days: number = 365) => {
    setIsProcessingUser(user.id);
    try {
      await courseSubscriptionsManager.setCourseSubscription(
        selectedCourseId,
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          telegramUsername: user.telegramUsername,
          telegramId: user.telegramId,
        },
        true,
        days,
        selectedCourse.title
      );
      refreshSubscribers();
      showToast(`تم تفعيل اشتراك (${user.fullName}) في ${selectedCourse.title} بنجاح! 🎉`);
    } catch (e) {
      showToast('حدث خطأ أثناء تفعيل اشتراك الدورة', 'error');
    } finally {
      setIsProcessingUser(null);
    }
  };

  // إلغاء الاشتراك من الدورة لمستخدم
  const handleCancelSubscription = async (user: UserWithRole) => {
    if (!window.confirm(`هل أنت متأكد من إلغاء اشتراك الطالب (${user.fullName}) في دورة: ${selectedCourse.title}؟`)) {
      return;
    }

    setIsProcessingUser(user.id);
    try {
      await courseSubscriptionsManager.setCourseSubscription(
        selectedCourseId,
        {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          telegramUsername: user.telegramUsername,
          telegramId: user.telegramId,
        },
        false,
        0,
        selectedCourse.title
      );
      refreshSubscribers();
      showToast(`تم إلغاء اشتراك (${user.fullName}) من الدورة بنجاح.`, 'success');
    } catch (e) {
      showToast('حدث خطأ أثناء إلغاء الاشتراك', 'error');
    } finally {
      setIsProcessingUser(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 py-6 font-cairo" dir="rtl">
      {/* التنبيهات المنبثقة */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-[99999] px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/30'
              : 'bg-rose-600 text-white shadow-rose-600/30'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* الرأس وشريط التنقل */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-white transition cursor-pointer"
              title="الرجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
                <Users className="w-5 h-5" />
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                لوحات مشتركي الدورات المستقلة 🎯
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              لكل دورة لوحة تحكم مستقلة ومخصصة لمتابعة وتفعيل وإلغاء اشتراكات الطلاب تلقائياً فور إضافتها.
            </p>
          </div>
        </div>

        <button
          onClick={loadUsers}
          disabled={isLoadingUsers}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
          <span>تحديث القائمة</span>
        </button>
      </div>

      {/* قائمة تبويبات اختيار الدورة التدريبية (تتولد تلقائياً لأي دورة جديدة) */}
      <div className="mb-6">
        <div className="text-xs font-black text-slate-500 dark:text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-amber-500" />
          <span>اختر الدورة لعرض لوحة مشتركيها:</span>
          <span className="text-amber-500 font-bold">({courses.length} دورات متاحة)</span>
        </div>

        <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
          {courses.map((c) => {
            const isSelected = c.id === selectedCourseId;
            const subsCount = courseSubscriptionsManager.getSubscribersForCourse(c.id).filter((s) => s.isActive).length;

            return (
              <button
                key={c.id}
                onClick={() => setSelectedCourseId(c.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black border-amber-400 shadow-lg shadow-amber-500/20 scale-102'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <BookOpen className={`w-4 h-4 ${isSelected ? 'text-slate-950' : 'text-amber-500'}`} />
                <span>{c.title}</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isSelected ? 'bg-slate-950/20 text-slate-950' : 'bg-amber-500/15 text-amber-500'
                  }`}
                >
                  {subsCount} مشترك
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* بطاقة معلومات الدورة المختارة والإحصائيات */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 rounded-3xl p-5 sm:p-6 mb-6 shadow-xl text-white relative overflow-hidden">
        <div className="absolute top-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-xl text-xs font-black bg-amber-500 text-slate-950">
                {selectedCourse.badge || 'دورة تدريبية'}
              </span>
              <span className="text-xs text-slate-400">معرف الدورة: {selectedCourse.id}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-amber-400">{selectedCourse.title}</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              {selectedCourse.description || 'لا يوجد وصف مضاف لهذه الدورة.'}
            </p>
          </div>

          {/* عدادات الإحصائيات */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4 shrink-0 text-center">
            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">المشتركون النشطون</div>
              <div className="text-xl sm:text-2xl font-black text-emerald-400">
                {courseStats.activeSubscribers}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">غير المشتركين</div>
              <div className="text-xl sm:text-2xl font-black text-slate-300">
                {courseStats.nonSubscribers}
              </div>
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <div className="text-xs text-slate-400 mb-1">إجمالي الأعضاء</div>
              <div className="text-xl sm:text-2xl font-black text-amber-400">
                {courseStats.totalUsers}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* شريط البحث وفلاتر العرض */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* حقل البحث */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، البريد، أو التليجرام..."
            className="w-full pr-10 pl-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          />
        </div>

        {/* فلاتر الحالة */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            الكل ({allUsers.length})
          </button>
          <button
            onClick={() => setFilterType('subscribed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterType === 'subscribed'
                ? 'bg-emerald-500 text-white font-black shadow-md shadow-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-emerald-500'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>المشتركون ({courseStats.activeSubscribers})</span>
          </button>
          <button
            onClick={() => setFilterType('not_subscribed')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
              filterType === 'not_subscribed'
                ? 'bg-rose-500 text-white font-black shadow-md shadow-rose-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-rose-500'
            }`}
          >
            <UserX className="w-3.5 h-3.5" />
            <span>غير المشتركين ({courseStats.nonSubscribers})</span>
          </button>
        </div>
      </div>

      {/* قائمة الطلاب وجدول الاشتراكات */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-lg overflow-hidden">
        {isLoadingUsers ? (
          <div className="py-20 text-center text-slate-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
            <p className="text-sm font-bold">جاري تحميل المشتركين ومزامنة حالة الدورة...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 text-center text-slate-400 space-y-2">
            <Users className="w-10 h-10 mx-auto text-slate-400/50" />
            <p className="text-sm font-bold">لا يوجد طلاب يطابقون خيارات البحث أو التصفية الحالية.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-black">
                <tr>
                  <th className="px-4 py-3.5">الطالب / العضو</th>
                  <th className="px-4 py-3.5">الرتبة في المنصة</th>
                  <th className="px-4 py-3.5">حالة الاشتراك في الدورة</th>
                  <th className="px-4 py-3.5">مدة وتاريخ الانتهاء</th>
                  <th className="px-4 py-3.5 text-center">الإجراء المباشر</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredUsers.map((user) => {
                  const { isSubscribed, isVIP, record } = checkUserStatus(user);
                  const isProcessing = isProcessingUser === user.id;

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* بيانات الطالب */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatarUrl || 'https://i.ibb.co/tMMyJj2y/icon.jpg'}
                            alt={user.fullName}
                            className="w-9 h-9 rounded-full object-cover border border-amber-500/30"
                          />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isVIP && (
                                <span title="صلاحية إدارية شاملة">
                                  <Crown className="w-3.5 h-3.5 text-amber-500" />
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>{user.email || 'بدون بريد'}</span>
                              {user.telegramUsername && (
                                <span className="text-sky-500 font-mono">@{user.telegramUsername}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* رتبة الطالب */}
                      <td className="px-4 py-3.5">
                        <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {user.role === 'super_admin'
                            ? '👑 سوبر أدمن'
                            : user.role === 'admin'
                            ? '🛡️ مسؤول'
                            : user.role === 'teacher'
                            ? '🎓 معلم'
                            : user.role === 'e_cms'
                            ? '🎬 محرر CMS'
                            : user.role === 'e_simulator'
                            ? '⚡ محرر المحاكي'
                            : '🎯 طالب'}
                        </span>
                      </td>

                      {/* حالة الاشتراك في هذه الدورة */}
                      <td className="px-4 py-3.5">
                        {isVIP ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                            <Crown className="w-3.5 h-3.5" />
                            <span>وصول إداري دائم 👑</span>
                          </span>
                        ) : isSubscribed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مشترك فعال في الدورة 🟢</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>غير مشترك ⚪</span>
                          </span>
                        )}
                      </td>

                      {/* تاريخ الانتهاء */}
                      <td className="px-4 py-3.5 text-slate-500 dark:text-slate-400 text-xs">
                        {isVIP ? (
                          <span className="text-amber-500 font-bold">مدى الحياة ✨</span>
                        ) : isSubscribed && record?.expiresAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{new Date(record.expiresAt).toLocaleDateString('ar-SA')}</span>
                          </div>
                        ) : isSubscribed ? (
                          <span>اشتراك سنوي نشط</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* زر الإجراء: تفعيل أو إلغاء */}
                      <td className="px-4 py-3.5 text-center">
                        {isVIP ? (
                          <span className="text-[11px] text-slate-400 font-bold">حساب إداري</span>
                        ) : isSubscribed ? (
                          <button
                            onClick={() => handleCancelSubscription(user)}
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500 text-rose-600 hover:text-white border border-rose-500/30 transition shadow-sm cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            title="إلغاء اشتراك الطالب في هذه الدورة"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>إلغاء الاشتراك 🔴</span>
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => handleActivateSubscription(user, 365)}
                              disabled={isProcessing}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                              title="تفعيل اشتراك سنوي (365 يوم) في هذه الدورة"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              <span>تفعيل الاشتراك (سنة) 🟢</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
