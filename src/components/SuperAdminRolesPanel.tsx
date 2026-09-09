import React, { useState, useEffect, useMemo } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Search,
  Filter,
  AlertTriangle,
  History,
  CheckCircle2,
  XCircle,
  Crown,
  GraduationCap,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Send,
  Calendar,
  Mail,
  ExternalLink,
  Info,
  Lock,
  ArrowUpDown,
  X,
  Ban,
  Trash2,
  Unlock,
  UserX
} from 'lucide-react';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';
import { rolesService } from '../lib/rolesService';
import { authService, TarqaUser, supabase, isSupabaseConfigured } from '../lib/supabase';

interface SuperAdminRolesPanelProps {
  currentUser?: TarqaUser | null;
  onNavigateBack?: () => void;
}

export const SuperAdminRolesPanel: React.FC<SuperAdminRolesPanelProps> = ({
  currentUser,
  onNavigateBack,
}) => {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<RoleChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);

  // حالة نافذة تأكيد تغيير الرتبة
  const [pendingChange, setPendingChange] = useState<{
    user: UserWithRole;
    newRole: UserRole;
    reason: string;
  } | null>(null);

  // حالة نافذة تأكيد الحظر / فك الحظر
  const [pendingBan, setPendingBan] = useState<{
    user: UserWithRole;
    isBanning: boolean;
    reason: string;
  } | null>(null);

  // حالة نافذة تأكيد مسح الحساب
  const [pendingDelete, setPendingDelete] = useState<UserWithRole | null>(null);

  // مؤشر تحميل العمليات
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  // إشعار نجاح أو خطأ
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);

  // استدعاء البيانات
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allUsers, logs] = await Promise.all([
        rolesService.getUsers(),
        rolesService.getAuditLogs(),
      ]);
      setUsers(allUsers);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading roles data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleDataChanged = () => {
      loadData();
    };

    window.addEventListener('tarqa_roles_changed', handleDataChanged);
    window.addEventListener('tarqa_user_changed', handleDataChanged);

    // اشتراك في الوقت الحقيقي عبر Supabase Realtime لأي تسجيل جديد أو تعديل في جدول profiles
    let channel: any = null;
    if (isSupabaseConfigured && supabase) {
      try {
        channel = supabase
          .channel('superadmin-profiles-realtime')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            () => {
              loadData();
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription not supported or failed:', err);
      }
    }

    return () => {
      window.removeEventListener('tarqa_roles_changed', handleDataChanged);
      window.removeEventListener('tarqa_user_changed', handleDataChanged);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'warning') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // عدد السوبر أدمن المسجلين في النظام
  const superAdminCount = useMemo(() => {
    return users.filter((u) => u.role === 'super_admin').length;
  }, [users]);

  // إحصائيات سريعة
  const stats = useMemo(() => {
    return {
      total: users.length,
      superAdmin: users.filter((u) => u.role === 'super_admin').length,
      admin: users.filter((u) => u.role === 'admin').length,
      teacher: users.filter((u) => u.role === 'teacher').length,
      student: users.filter((u) => u.role === 'student').length,
      banned: users.filter((u) => u.isBanned).length,
    };
  }, [users]);

  // فلترة وبحث المستخدمين
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (user.telegramUsername &&
          user.telegramUsername.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesFilter =
        selectedRoleFilter === 'all'
          ? true
          : selectedRoleFilter === 'banned'
          ? Boolean(user.isBanned)
          : user.role === selectedRoleFilter;

      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, selectedRoleFilter]);

  // فتح نافذة تأكيد الحظر أو فك الحظر
  const handleToggleBan = (user: UserWithRole) => {
    if (user.role === 'super_admin' || user.email?.toLowerCase() === 'yassooooo27m@gmail.com') {
      showToast('لا يمكن حظر حساب السوبر أدمن الرئيسي للمنصة!', 'error');
      return;
    }
    if (currentUser?.id === user.id) {
      showToast('لا يمكنك حظر حسابك الخاص!', 'error');
      return;
    }

    setPendingBan({
      user,
      isBanning: !user.isBanned,
      reason: user.banReason || 'مخالفة سياسة وشروط استخدام منصة طرقع',
    });
  };

  // تنفيذ تأكيد الحظر / فك الحظر
  const executeToggleBan = async () => {
    if (!pendingBan) return;
    setIsProcessingAction(true);
    try {
      const { user, isBanning, reason } = pendingBan;
      const res = await rolesService.banUser(user.id, isBanning, reason);
      if (res.success) {
        showToast(
          isBanning
            ? `تم حظر حساب ${user.fullName} بنجاح`
            : `تم إلغاء حظر حساب ${user.fullName} وإعادته للعمل`,
          'success'
        );
        setPendingBan(null);
        await loadData();
      } else {
        showToast(res.error || 'فشلت عملية الحظر', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ أثناء تنفيذ الحظر', 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // فتح نافذة تأكيد مسح الحساب
  const handleDeleteUser = (user: UserWithRole) => {
    if (user.role === 'super_admin' || user.email?.toLowerCase() === 'yassooooo27m@gmail.com') {
      showToast('لا يمكن مسح حساب السوبر أدمن الرئيسي للمنصة!', 'error');
      return;
    }
    if (currentUser?.id === user.id) {
      showToast('لا يمكنك مسح حسابك وأنت مسجل دخول به!', 'error');
      return;
    }

    setPendingDelete(user);
  };

  // تنفيذ تأكيد مسح الحساب
  const executeDeleteUser = async () => {
    if (!pendingDelete) return;
    setIsProcessingAction(true);
    try {
      const res = await rolesService.deleteUser(pendingDelete.id);
      if (res.success) {
        showToast(`تم مسح حساب ${pendingDelete.fullName} نهائياً من النظام`, 'success');
        setPendingDelete(null);
        await loadData();
      } else {
        showToast(res.error || 'فشلت عملية مسح الحساب', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'حدث خطأ أثناء مسح الحساب', 'error');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // طلب تغيير الرتبة (يفتح نافذة التأكيد)
  const handleSelectRole = (user: UserWithRole, newRole: UserRole) => {
    if (user.role === newRole) return;

    setPendingChange({
      user,
      newRole,
      reason: '',
    });
  };

  // تنفيذ تأكيد تغيير الرتبة
  const executeRoleChange = async () => {
    if (!pendingChange) return;

    const { user, newRole, reason } = pendingChange;

    const result = await rolesService.updateUserRole(user.id, newRole, reason);

    if (result.success) {
      showToast(
        `تم تعديل رتبة ${user.fullName} بنجاح إلى ${authService.getRoleBadge(newRole).label}`,
        'success'
      );
      await loadData();
    } else {
      showToast(result.error || 'حدث خطأ أثناء تعديل الرتبة', 'error');
    }

    setPendingChange(null);
  };

  // وظيفة الحصول على شارة الرتبة بالألوان المطلوبة بالضبط
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-sm">
            <Crown className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span>سوبر أدمن (Super Admin)</span>
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/30">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>مسؤول (Admin)</span>
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
            <span>معلم (Teacher)</span>
          </span>
        );
      case 'student':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-500/10 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400 border border-slate-500/30">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>طالب (Student)</span>
          </span>
        );
    }
  };

  // التحقق من صلاحية العارض الحالي (مسؤول المنصة Admin)
  const currentEmailLower = currentUser?.email?.trim().toLowerCase();
  const isAuthorizedAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || currentEmailLower === 'yassooooo27m@gmail.com';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 font-cairo">
      {/* تنبيه إذا لم يكن المستخدم الحالي مسؤولاً */}
      {!isAuthorizedAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-900 dark:text-amber-200 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0" />
          <div className="text-sm">
            <span className="font-bold">تنبيه صلاحيات: </span>
            أنت تستعرض هذه اللوحة برتبة (<span className="font-bold underline">{authService.getRoleBadge(currentUser?.role).label}</span>). تعديل الرتب وسحب الصلاحيات محصور بمسؤولي المنصة (Admins) المعتمدين.
          </div>
        </div>
      )}

      {/* شريط الإشعارات العائم (Toast Notification) */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
              : 'bg-amber-950/90 text-amber-200 border-amber-500/50'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
          {toastMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          <span className="text-sm font-semibold">{toastMessage.text}</span>
        </div>
      )}

      {/* الهيدر والعنوان الرئيسي */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
              لوحة إدارة الرتب والصلاحيات
            </span>
            <span className="text-xs text-slate-400 font-medium">RBAC Security Engine</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>إدارة الرتب والصلاحيات</span>
            <span className="text-purple-500 text-lg">🛡️</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            التحكم المركزي في تعيين وسحب صلاحيات مسؤولي المنصة والمعلمين والطلاب مع توثيق كافة الحركات في سجل التدقيق.
          </p>
        </div>

        {/* أزرار الإجراءات العلوية */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogsModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <History className="w-4 h-4 text-amber-500" />
            <span>سجل التدقيق ({auditLogs.length})</span>
          </button>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-all shadow-sm"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* بطاقات الإحصائيات (Stats Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {/* إجمالي الحسابات */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800/80 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">إجمالي الحسابات</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">مستخدم مسجل في المنصة</div>
        </div>

        {/* سوبر أدمن */}
        <div className="p-4 rounded-2xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-500/20 shadow-sm">
          <div className="flex items-center justify-between text-rose-500 mb-2">
            <span className="text-xs font-black">سوبر أدمن</span>
            <Crown className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {stats.superAdmin}
          </div>
          <div className="text-[10px] text-rose-500/70 mt-1">كامل الصلاحيات والإشراف</div>
        </div>

        {/* المسؤولين Admins */}
        <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 shadow-sm">
          <div className="flex items-center justify-between text-purple-500 mb-2">
            <span className="text-xs font-bold">مسؤولو المنصة</span>
            <ShieldCheck className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {stats.admin}
          </div>
          <div className="text-[10px] text-purple-500/70 mt-1">إدارة المحتوى والأسئلة</div>
        </div>

        {/* المعلمين Teachers */}
        <div className="p-4 rounded-2xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-500/20 shadow-sm">
          <div className="flex items-center justify-between text-blue-500 mb-2">
            <span className="text-xs font-bold">المعلمون المعتمدون</span>
            <GraduationCap className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats.teacher}
          </div>
          <div className="text-[10px] text-blue-500/70 mt-1">المحاضرات والمذكرات</div>
        </div>

        {/* الطلاب Students */}
        <div className="p-4 rounded-2xl bg-slate-500/5 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold">الطلاب</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-slate-200">
            {stats.student}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">تأسيس واختبارات</div>
        </div>
      </div>

      {/* شريط البحث والفلترة (Search and Filter Bar) */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800/80 mb-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* حقل البحث الفوري */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم أو البريد الإلكتروني أو تليجرام..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* فلاتر الرتب الفورية */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'الكل', count: stats.total },
            { id: 'super_admin', label: '👑 سوبر أدمن', count: stats.superAdmin },
            { id: 'admin', label: '🛡️ مسؤول', count: stats.admin },
            { id: 'teacher', label: '🎓 معلم', count: stats.teacher },
            { id: 'student', label: '🎯 طالب', count: stats.student },
            { id: 'banned', label: '🚫 المحظورين', count: stats.banned },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedRoleFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                selectedRoleFilter === tab.id
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedRoleFilter === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* جدول البيانات الرئيسي (Interactive Data Table & Mobile Cards) */}
      <div className="rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
        {/* العرض المكتبي والتابلت (Desktop & Tablet Table View) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
                <th className="py-4 px-4 sm:px-6">المستخدم</th>
                <th className="py-4 px-4 sm:px-6">البريد الإلكتروني</th>
                <th className="py-4 px-4 sm:px-6">تليجرام</th>
                <th className="py-4 px-4 sm:px-6">الرتبة الحالية</th>
                <th className="py-4 px-4 sm:px-6">تاريخ الانضمام</th>
                <th className="py-4 px-4 sm:px-6 text-center">الإجراءات (الرتبة / الحظر / الحذف)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="font-bold">لم يتم العثور على أي مستخدمين مطابقين للبحث</p>
                    <p className="text-xs mt-1">جرب تغيير كلمات البحث أو إعادة ضبط الفلتر</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentLoggedUser = currentUser?.id === user.id;
                  const isOwner = user.email?.toLowerCase() === 'yassooooo27m@gmail.com' || user.role === 'super_admin';

                  return (
                    <tr
                      key={user.id}
                      className={`transition-colors ${
                        user.isBanned 
                          ? 'bg-rose-500/5 hover:bg-rose-500/10 dark:bg-rose-950/15' 
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-900/40'
                      }`}
                    >
                      {/* الاسم و الأفاتار */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center font-black border flex-shrink-0 ${
                            user.isBanned
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 border-rose-300 dark:border-rose-800'
                              : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                          }`}>
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.fullName}
                                className="w-full h-full object-cover rounded-xl"
                              />
                            ) : (
                              <span>{user.fullName.charAt(0) || 'م'}</span>
                            )}
                            {user.role === 'admin' && (
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white">
                                🛡️
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{user.fullName}</span>
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-normal">
                                  (أنت)
                                </span>
                              )}
                              {user.isBanned && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold flex items-center gap-0.5">
                                  <Ban className="w-2.5 h-2.5" />
                                  محظور
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                              {user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* البريد الإلكتروني */}
                      <td className="py-4 px-4 sm:px-6 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{user.email}</span>
                        </div>
                      </td>

                      {/* معرف تليجرام */}
                      <td className="py-4 px-4 sm:px-6 text-slate-600 dark:text-slate-300">
                        {user.telegramUsername ? (
                          <a
                            href={`https://t.me/${user.telegramUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sky-500 hover:underline font-mono text-xs"
                          >
                            <Send className="w-3 h-3 text-sky-400" />
                            <span>@{user.telegramUsername}</span>
                          </a>
                        ) : user.telegramId ? (
                          <span className="text-xs font-mono text-slate-400">
                            ID: {user.telegramId}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">غير مربوط</span>
                        )}
                      </td>

                      {/* الرتبة الحالية مع الشارة المميزة */}
                      <td className="py-4 px-4 sm:px-6">
                        {renderRoleBadge(user.role)}
                      </td>

                      {/* تاريخ الانضمام */}
                      <td className="py-4 px-4 sm:px-6 text-slate-500 dark:text-slate-400 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {new Date(user.createdAt).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* عمود الإجراءات: تغيير الرتبة + الحظر + المسح */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          {/* اختيار الرتبة */}
                          <div className="inline-block relative min-w-[130px]">
                            <select
                              value={user.role}
                              disabled={!isAuthorizedAdmin || user.isBanned}
                              onChange={(e) => handleSelectRole(user, e.target.value as UserRole)}
                              className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold appearance-none transition-all cursor-pointer text-center ${
                                !isAuthorizedAdmin || user.isBanned
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                                  : user.role === 'super_admin'
                                  ? 'bg-rose-500/10 text-rose-600 border border-rose-500/40 hover:border-rose-500 font-black'
                                  : user.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-600 border border-purple-500/40 hover:border-purple-500'
                                  : user.role === 'teacher'
                                  ? 'bg-blue-500/10 text-blue-600 border border-blue-500/40 hover:border-blue-500'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500'
                              }`}
                            >
                              <option value="student">🎯 طالب</option>
                              <option value="teacher">🎓 معلم</option>
                              <option value="admin">🛡️ مسؤول</option>
                              <option value="super_admin">👑 سوبر أدمن</option>
                            </select>
                          </div>

                          {/* زر حظر / فك حظر الحساب */}
                          <button
                            onClick={() => handleToggleBan(user)}
                            disabled={!isAuthorizedAdmin || isCurrentLoggedUser || isOwner}
                            title={user.isBanned ? 'إلغاء حظر الحساب' : 'حظر هذا الحساب'}
                            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                              user.isBanned
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
                            } disabled:opacity-25 disabled:cursor-not-allowed`}
                          >
                            {user.isBanned ? (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">فك الحظر</span>
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">حظر</span>
                              </>
                            )}
                          </button>

                          {/* زر مسح الحساب نهائياً */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={!isAuthorizedAdmin || isCurrentLoggedUser || isOwner}
                            title="مسح الحساب نهائياً"
                            className="p-2 rounded-xl text-xs font-bold transition-all bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">مسح</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* العرض المخصص للهواتف الذكية (Mobile Cards View) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800/80">
          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="font-bold text-sm">لم يتم العثور على أي مستخدمين مطابقين للبحث</p>
              <p className="text-xs mt-1">جرب تغيير كلمات البحث أو إعادة ضبط الفلتر</p>
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isCurrentLoggedUser = currentUser?.id === user.id;
              const isOwner = user.email?.toLowerCase() === 'yassooooo27m@gmail.com' || user.role === 'super_admin';

              return (
                <div key={user.id} className={`p-4 flex flex-col gap-3 ${user.isBanned ? 'bg-rose-500/5 dark:bg-rose-950/15' : ''}`}>
                  {/* رأس البطاقة: الأفاتار، الاسم، والبريد والشارة */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center font-black border flex-shrink-0 ${
                        user.isBanned
                          ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 border-rose-300 dark:border-rose-800'
                          : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                      }`}>
                        {user.avatarUrl ? (
                          <img
                            src={user.avatarUrl}
                            alt={user.fullName}
                            className="w-full h-full object-cover rounded-xl"
                          />
                        ) : (
                          <span>{user.fullName.charAt(0) || 'م'}</span>
                        )}
                        {user.role === 'admin' && (
                          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white">
                            🛡️
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                          <span className="truncate">{user.fullName}</span>
                          {isCurrentLoggedUser && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-normal">
                              (أنت)
                            </span>
                          )}
                          {user.isBanned && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold flex items-center gap-0.5">
                              <Ban className="w-2.5 h-2.5" />
                              محظور
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* الشارة ومعلومات تليجرام والتاريخ */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                    <div>{renderRoleBadge(user.role)}</div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {user.telegramUsername ? (
                        <a
                          href={`https://t.me/${user.telegramUsername}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sky-500 hover:underline font-mono text-xs"
                        >
                          <Send className="w-3 h-3 text-sky-400" />
                          <span>@{user.telegramUsername}</span>
                        </a>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">غير مربوط</span>
                      )}
                      <div className="flex items-center gap-1 text-[11px]">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          {new Date(user.createdAt).toLocaleDateString('ar-SA', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* تعديل الرتبة والإجراءات بلمسة مريحة للإبهام */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60 flex flex-col gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">
                        تعديل الرتبة والصلاحية:
                      </label>
                      <select
                        value={user.role}
                        disabled={!isAuthorizedAdmin || user.isBanned}
                        onChange={(e) => handleSelectRole(user, e.target.value as UserRole)}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-bold appearance-none transition-all cursor-pointer text-center ${
                          !isAuthorizedAdmin || user.isBanned
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                            : user.role === 'super_admin'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/40 font-black'
                            : user.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-600 border border-purple-500/40'
                            : user.role === 'teacher'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/40'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <option value="student">🎯 طالب (Student)</option>
                        <option value="teacher">🎓 معلم (Teacher)</option>
                        <option value="admin">🛡️ مسؤول (Admin)</option>
                        <option value="super_admin">👑 سوبر أدمن (Super Admin)</option>
                      </select>
                    </div>

                    {/* أزرار الحظر والمسح للموبايل */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => handleToggleBan(user)}
                        disabled={!isAuthorizedAdmin || isCurrentLoggedUser || isOwner}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                          user.isBanned
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                        } disabled:opacity-30 disabled:cursor-not-allowed`}
                      >
                        {user.isBanned ? (
                          <>
                            <Unlock className="w-3.5 h-3.5" />
                            <span>فك الحظر</span>
                          </>
                        ) : (
                          <>
                            <Ban className="w-3.5 h-3.5" />
                            <span>حظر الحساب</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeleteUser(user)}
                        disabled={!isAuthorizedAdmin || isCurrentLoggedUser || isOwner}
                        className="py-2 px-3 rounded-xl text-xs font-bold transition-all bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>مسح الحساب</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* نافذة تأكيد تغيير الرتبة الحساسة (Confirmation Modal) */}
      {/* ========================================================================= */}
      {pendingChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setPendingChange(null)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* أيقونة التحذير */}
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              تأكيد تغيير رتبة المستخدم
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              أنت على وشك تعديل الصلاحيات الإدارية للمستخدم في النظام:
            </p>

            {/* بطاقة مقارنة الرتبة */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 mb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">المستخدم:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {pendingChange.user.fullName}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">الرتبة السابقة:</span>
                <div>{renderRoleBadge(pendingChange.user.role)}</div>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                <span className="text-slate-400">الرتبة الجديدة:</span>
                <div>{renderRoleBadge(pendingChange.newRole)}</div>
              </div>
            </div>

            {/* تحذير عند الترقية لمسؤول منصة */}
            {pendingChange.newRole === 'admin' && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>تنبيه أمني:</strong> منح هذه الرتبة يتيح للمستخدم إدارة المحتوى والأسئلة والتحكم في قاعدة البيانات وفق صلاحيات الدور الممنوح.
                </span>
              </div>
            )}

            {/* سبب التعديل (اختياري لسجل التدقيق) */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                سبب التعديل (يُحفظ في سجل التدقيق Audit Log):
              </label>
              <input
                type="text"
                value={pendingChange.reason}
                onChange={(e) =>
                  setPendingChange({ ...pendingChange, reason: e.target.value })
                }
                placeholder="مثال: ترقية لتنسيق مسار التأسيس، أو تعيين مسؤول..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
              />
            </div>

            {/* أزرار الإجراء */}
            <div className="flex items-center gap-3">
              <button
                onClick={executeRoleChange}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>تأكيد التعديل الفوري</span>
              </button>
              <button
                onClick={() => setPendingChange(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* نافذة تأكيد الحظر أو فك الحظر (Ban / Unban Modal) */}
      {/* ========================================================================= */}
      {pendingBan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setPendingBan(null)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* أيقونة الحالة */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
              pendingBan.isBanning 
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500' 
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'
            }`}>
              {pendingBan.isBanning ? <Ban className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
            </div>

            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-1">
              {pendingBan.isBanning ? 'تأكيد حظر الحساب' : 'تأكيد فك الحظر'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {pendingBan.isBanning
                ? 'سيتم حظر المستخدم فوراً ومنعه من تسجيل الدخول واستخدام المنصة:'
                : 'سيتم فك الحظر وإعادة تمكين المستخدم من الدخول للمنصة:'}
            </p>

            {/* معلومات المستخدم */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">المستخدم:</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingBan.user.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">البريد:</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">{pendingBan.user.email}</span>
              </div>
            </div>

            {/* إدخال سبب الحظر (إذا كان حظراً) */}
            {pendingBan.isBanning && (
              <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  سبب الحظر (سيظهر للمستخدم عند محاولة تسجيل الدخول):
                </label>
                <textarea
                  rows={3}
                  value={pendingBan.reason}
                  onChange={(e) =>
                    setPendingBan({
                      ...pendingBan,
                      reason: e.target.value,
                    })
                  }
                  placeholder="اكتب سبب الحظر هنا (مثال: مخالفة شروط الاستخدام أو الإساءة)..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/50 resize-none"
                />
              </div>
            )}

            {/* أزرار التأكيد والإلغاء */}
            <div className="flex items-center gap-3">
              <button
                onClick={executeToggleBan}
                disabled={isProcessingAction}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black text-white shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                  pendingBan.isBanning
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/20'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20'
                } disabled:opacity-50`}
              >
                {pendingBan.isBanning ? <Ban className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>{pendingBan.isBanning ? 'تأكيد الحظر الفوري' : 'تأكيد فك الحظر'}</span>
              </button>
              <button
                onClick={() => setPendingBan(null)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* نافذة تأكيد مسح الحساب نهائياً (Delete User Modal) */}
      {/* ========================================================================= */}
      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#0d1322] border border-rose-500/30 dark:border-rose-500/30 p-6 shadow-2xl relative">
            <button
              onClick={() => setPendingDelete(null)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* أيقونة الحذف والتحذير */}
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-black text-rose-600 dark:text-rose-400 mb-1">
              مسح الحساب نهائياً
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              أنت على وشك مسح هذا الحساب بشكل نهائي من قاعدة البيانات:
            </p>

            {/* بطاقة معلومات الحساب */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 mb-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">الاسم:</span>
                <span className="font-bold text-slate-900 dark:text-white">{pendingDelete.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">البريد:</span>
                <span className="font-mono text-slate-600 dark:text-slate-300">{pendingDelete.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">الرتبة:</span>
                <div>{renderRoleBadge(pendingDelete.role)}</div>
              </div>
            </div>

            {/* تحذير خطورة العملية */}
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>تحذير نهائي:</strong> هذا الإجراء لا يمكن التراجع عنه. سيتم حذف المستخدم من قاعدة بيانات Supabase والتخزين المحلي، وسيتم سحب صلاحيات دخوله تماماً.
              </span>
            </div>

            {/* أزرار التأكيد والإلغاء */}
            <div className="flex items-center gap-3">
              <button
                onClick={executeDeleteUser}
                disabled={isProcessingAction}
                className="flex-1 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-600/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                <span>نعم، امسح الحساب نهائياً</span>
              </button>
              <button
                onClick={() => setPendingDelete(null)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* نافذة سجل تدقيق تغييرات الرتب (Audit Logs Modal) */}
      {/* ========================================================================= */}
      {showLogsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-500">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    سجل تدقيق تعديلات الرتب (Audit Logs)
                  </h3>
                  <p className="text-xs text-slate-400">
                    سجل تاريخي موثق لكافة حركات الترقية وسحب الصلاحيات
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogsModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* قائمة السجلات */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {auditLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  لا توجد أي سجلات تعديل رتب حتى الآن
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                        <span className="text-rose-500">المشرف: {log.adminName || log.adminId}</span>
                        <span className="text-slate-400">قام بتعديل رتبة</span>
                        <span className="text-slate-900 dark:text-slate-100 underline">
                          {log.targetUserName || log.targetUserId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>من</span>
                        <span className="font-bold text-slate-600 dark:text-slate-300">
                          {authService.getRoleBadge(log.oldRole).label}
                        </span>
                        <span>إلى</span>
                        <span className="font-bold text-rose-500">
                          {authService.getRoleBadge(log.newRole).label}
                        </span>
                      </div>
                      {log.reason && (
                        <p className="text-[11px] text-slate-400 italic bg-white dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          السبب: {log.reason}
                        </p>
                      )}
                    </div>

                    <div className="text-[10px] text-slate-400 whitespace-nowrap flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(log.createdAt).toLocaleString('ar-SA')}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setShowLogsModal(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
