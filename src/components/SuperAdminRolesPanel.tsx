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
  X
} from 'lucide-react';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';
import { rolesService } from '../lib/rolesService';
import { authService, TarqaUser } from '../lib/supabase';

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

    const handleRolesChanged = () => {
      loadData();
    };

    window.addEventListener('tarqa_roles_changed', handleRolesChanged);
    return () => window.removeEventListener('tarqa_roles_changed', handleRolesChanged);
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
        selectedRoleFilter === 'all' || user.role === selectedRoleFilter;

      return matchesSearch && matchesFilter;
    });
  }, [users, searchQuery, selectedRoleFilter]);

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

      {/* جدول البيانات الرئيسي (Interactive Data Table) */}
      <div className="rounded-2xl bg-white dark:bg-[#0c1222] border border-slate-200 dark:border-slate-800/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold">
                <th className="py-4 px-4 sm:px-6">المستخدم</th>
                <th className="py-4 px-4 sm:px-6">البريد الإلكتروني</th>
                <th className="py-4 px-4 sm:px-6">تليجرام</th>
                <th className="py-4 px-4 sm:px-6">الرتبة الحالية</th>
                <th className="py-4 px-4 sm:px-6">تاريخ الانضمام</th>
                <th className="py-4 px-4 sm:px-6 text-center">تغيير الرتبة (إجراء السوبر أدمن)</th>
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

                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      {/* الاسم و الأفاتار */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center font-black text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex-shrink-0">
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
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{user.fullName}</span>
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-normal">
                                  (أنت)
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

                      {/* إجراء تغيير الرتبة (Select Dropdown) */}
                      <td className="py-4 px-4 sm:px-6 text-center">
                        <div className="inline-block relative min-w-[150px]">
                          <select
                            value={user.role}
                            disabled={!isAuthorizedAdmin}
                            onChange={(e) => handleSelectRole(user, e.target.value as UserRole)}
                            className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold appearance-none transition-all cursor-pointer text-center ${
                              !isAuthorizedAdmin
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
                            <option value="student">🎯 طالب (Student)</option>
                            <option value="teacher">🎓 معلم (Teacher)</option>
                            <option value="admin">🛡️ مسؤول (Admin)</option>
                            <option value="super_admin">👑 سوبر أدمن (Super Admin)</option>
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
