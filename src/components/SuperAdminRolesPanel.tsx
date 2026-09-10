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
  UserX,
  Copy,
  Check
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
  // استنتاج المستخدم الحالي وصلاحياته الموثوقة (مع أخذ السوبر أدمن والمالك بعين الاعتبار)
  const currentLoggedUser = currentUser || authService.getCurrentUser();
  const currentEmailLower = currentLoggedUser?.email?.trim().toLowerCase();
  const isOwner = currentEmailLower === 'yassooooo27m@gmail.com';
  const isSuperAdmin = currentLoggedUser?.role === 'super_admin' || isOwner;
  const isAuthorizedAdmin = currentLoggedUser?.role === 'admin' || isSuperAdmin;

  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<RoleChangeLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [showLogsModal, setShowLogsModal] = useState<boolean>(false);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);

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

  // استدعاء البيانات (يدعم التحديث الصامت في الخلفية دون وميض مؤشر التحميل)
  const loadData = async (isBackground: boolean | any = false) => {
    const bg = isBackground === true;
    if (!bg) setIsLoading(true);
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
      if (!bg) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleDataChanged = () => {
      loadData(true);
    };

    window.addEventListener('tarqa_roles_changed', handleDataChanged);
    window.addEventListener('tarqa_user_changed', handleDataChanged);
    window.addEventListener('storage', handleDataChanged);

    // تحديث دوري تلقائي خفيف كل 3.5 ثوانٍ في الخلفية لضمان ظهور أي عضو يسجل جديداً فوراً
    const pollInterval = setInterval(() => {
      loadData(true);
    }, 3500);

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
              loadData(true);
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime subscription not supported or failed:', err);
      }
    }

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('tarqa_roles_changed', handleDataChanged);
      window.removeEventListener('tarqa_user_changed', handleDataChanged);
      window.removeEventListener('storage', handleDataChanged);
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
      subscribed: users.filter((u) => u.isSubscribed).length,
      unsubscribed: users.filter((u) => !u.isSubscribed && u.role !== 'super_admin' && u.email?.toLowerCase() !== 'yassooooo27m@gmail.com').length,
    };
  }, [users]);

  // فلترة وبحث وترتيب المستخدمين (حماية كاملة من قيم null وترتيب الأحدث أولاً)
  const filteredUsers = useMemo(() => {
    const list = users.filter((user) => {
      const q = searchQuery.toLowerCase().trim();
      const fullName = (user.fullName || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const tg = (user.telegramUsername || '').toLowerCase();
      const roleText = (user.role || '').toLowerCase();

      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        email.includes(q) ||
        tg.includes(q) ||
        roleText.includes(q);

      const matchesFilter =
        selectedRoleFilter === 'all'
          ? true
          : selectedRoleFilter === 'banned'
          ? Boolean(user.isBanned)
          : selectedRoleFilter === 'subscribed'
          ? Boolean(user.isSubscribed)
          : selectedRoleFilter === 'unsubscribed'
          ? !user.isSubscribed && user.role !== 'super_admin' && user.email?.toLowerCase() !== 'yassooooo27m@gmail.com'
          : user.role === selectedRoleFilter;

      return matchesSearch && matchesFilter;
    });

    // ترتيب القائمة: حساب السوبر أدمن Yoska في المقدمة دائماً، ثم الأعضاء الجدد أولاً
    return list.sort((a, b) => {
      const isSuperA = a.email?.toLowerCase() === 'yassooooo27m@gmail.com' || a.role === 'super_admin';
      const isSuperB = b.email?.toLowerCase() === 'yassooooo27m@gmail.com' || b.role === 'super_admin';
      if (isSuperA && !isSuperB) return -1;
      if (!isSuperA && isSuperB) return 1;

      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [users, searchQuery, selectedRoleFilter]);

  // فتح نافذة تأكيد الحظر أو فك الحظر (محصورة بالسوبر أدمن فقط)
  const handleToggleBan = (user: UserWithRole) => {
    if (!isSuperAdmin) {
      showToast('صلاحية الحظر وفك الحظر محصورة برتبة السوبر أدمن (Super Admin) فقط!', 'error');
      return;
    }
    if (user.role === 'super_admin' || user.email?.toLowerCase() === 'yassooooo27m@gmail.com') {
      showToast('لا يمكن حظر حساب السوبر أدمن الرئيسي للمنصة!', 'error');
      return;
    }
    if (currentLoggedUser?.id === user.id) {
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

  // فتح نافذة تأكيد مسح الحساب (محصورة بالسوبر أدمن فقط)
  const handleDeleteUser = (user: UserWithRole) => {
    if (!isSuperAdmin) {
      showToast('صلاحية مسح الحسابات محصورة برتبة السوبر أدمن (Super Admin) فقط!', 'error');
      return;
    }
    if (user.role === 'super_admin' || user.email?.toLowerCase() === 'yassooooo27m@gmail.com') {
      showToast('لا يمكن مسح حساب السوبر أدمن الرئيسي للمنصة!', 'error');
      return;
    }
    if (currentLoggedUser?.id === user.id) {
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

  // وظيفة الحصول على شارة الرتبة بالألوان الفخمة والـ Badges المميزة
  const renderRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/10">
            <Crown className="w-3.5 h-3.5 text-amber-500 animate-pulse fill-amber-500/20" />
            <span>سوبر أدمن 👑</span>
          </span>
        );
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/35 shadow-sm shadow-purple-500/10">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
            <span>مسؤول منصة 🛡️</span>
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/35 shadow-sm shadow-blue-500/10">
            <GraduationCap className="w-3.5 h-3.5 text-blue-500" />
            <span>معلم معتمد 🎓</span>
          </span>
        );
      case 'student':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-500/10 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>طالب طرقع 🎯</span>
          </span>
        );
    }
  };

  // شارة حالة الاشتراك
  const renderSubscriptionBadge = (user: UserWithRole) => {
    const isOwnerOrSuper = user.role === 'super_admin' || user.email?.toLowerCase() === 'yassooooo27m@gmail.com';
    if (isOwnerOrSuper) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30">
          <Crown className="w-3.5 h-3.5 text-amber-500" />
          <span>وصول إداري شامل 👑</span>
        </span>
      );
    }
    if (user.isSubscribed) {
      return (
        <div className="space-y-0.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مشترك بالباقة ✅</span>
          </span>
          {user.subscriptionExpiresAt && (
            <div className="text-[10px] text-slate-400 font-mono">
              ينتهي: {new Date(user.subscriptionExpiresAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700">
        <XCircle className="w-3.5 h-3.5 text-slate-400" />
        <span>غير مشترك ⚪</span>
      </span>
    );
  };

  // إلغاء اشتراك مستخدم
  const handleCancelSubscription = async (user: UserWithRole) => {
    if (!isAuthorizedAdmin) {
      showToast('صلاحية إدارة الاشتراكات محصورة بالإدارة فقط!', 'error');
      return;
    }
    if (window.confirm(`هل أنت متأكد من رغبتك في إلغاء اشتراك الطالب "${user.fullName}" في باقة طرقع السنوية؟`)) {
      setIsProcessingAction(true);
      try {
        const res = await rolesService.cancelSubscription(user.id, user.email);
        if (res.success) {
          showToast(`تم إلغاء اشتراك ${user.fullName} بنجاح`, 'success');
          await loadData(true);
        } else {
          showToast('تعذر إلغاء الاشتراك', 'error');
        }
      } catch (e: any) {
        showToast(e?.message || 'حدث خطأ أثناء إلغاء الاشتراك', 'error');
      } finally {
        setIsProcessingAction(false);
      }
    }
  };

  // تفعيل أو منح اشتراك سنوي لمستخدم
  const handleGrantSubscription = async (user: UserWithRole) => {
    if (!isAuthorizedAdmin) {
      showToast('صلاحية إدارة الاشتراكات محصورة بالإدارة فقط!', 'error');
      return;
    }
    if (window.confirm(`هل تريد تفعيل باقة طرقع السنوية الشاملة (365 يوماً) للطالب "${user.fullName}"؟`)) {
      setIsProcessingAction(true);
      try {
        const res = await rolesService.grantSubscription(user, 365);
        if (res.success) {
          showToast(`تم تفعيل الاشتراك السنوي لـ ${user.fullName} بنجاح لمدة 365 يوماً`, 'success');
          await loadData(true);
        } else {
          showToast('تعذر تفعيل الاشتراك', 'error');
        }
      } catch (e: any) {
        showToast(e?.message || 'حدث خطأ أثناء تفعيل الاشتراك', 'error');
      } finally {
        setIsProcessingAction(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen max-w-7xl mx-auto px-4 sm:px-6 py-8 font-cairo">
      {/* تأثيرات الإضاءة الجمالية في الخلفية (Ambient Background Glow) */}
      <div className="absolute top-12 right-1/4 w-96 h-96 bg-purple-500/10 dark:bg-purple-600/15 rounded-full blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-44 left-10 w-80 h-80 bg-amber-500/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-24 right-10 w-96 h-96 bg-rose-500/10 dark:bg-rose-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* تنبيه الصلاحيات وإشعار رتبة السوبر أدمن الفخم */}
      {!isAuthorizedAdmin ? (
        <div className="mb-6 p-4.5 rounded-3xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-center gap-3.5 backdrop-blur-md shadow-sm">
          <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-500 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm leading-relaxed">
            <span className="font-bold text-amber-600 dark:text-amber-400">تنبيه صلاحيات: </span>
            أنت تستعرض هذه اللوحة برتبة (<span className="font-bold underline">{authService.getRoleBadge(currentLoggedUser?.role).label}</span>). تعديل الرتب وسحب الصلاحيات محصور بمسؤولي المنصة (Admins) المعتمدين.
          </div>
        </div>
      ) : !isSuperAdmin ? (
        <div className="mb-6 p-4.5 rounded-3xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200 flex items-center gap-3.5 backdrop-blur-md shadow-sm">
          <div className="p-2 rounded-2xl bg-purple-500/20 text-purple-500 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs sm:text-sm leading-relaxed">
            <span className="font-bold text-purple-600 dark:text-purple-400">حساب مسؤول منصة (Admin): </span>
            يمكنك تعديل رتب الأعضاء. بينما صلاحيات <strong className="text-rose-600 dark:text-rose-400">حظر الحسابات والمسح النهائي</strong> محصورة برتبة <strong>السوبر أدمن (Super Admin)</strong> فقط لسلامة وأمان المنصة.
          </div>
        </div>
      ) : (
        <div className="mb-6 p-4 rounded-3xl bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-purple-500/15 border border-amber-500/30 text-slate-800 dark:text-slate-100 flex items-center justify-between gap-3 flex-wrap shadow-lg shadow-amber-500/5 backdrop-blur-md">
          <div className="flex items-center gap-3 text-xs sm:text-sm">
            <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black shadow-md shadow-amber-500/30">
              <Crown className="w-4 h-4 fill-slate-950" />
            </div>
            <span>
              <strong className="text-amber-600 dark:text-amber-400">صلاحيات السوبر أدمن مفعلة:</strong> لديك كامل الصلاحية للتحكم بالرتب، الحظر، الفك، والمسح النهائي للمستخدمين ومراقبة سجل التدقيق الحي.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Super Admin • Yoska</span>
            </span>
          </div>
        </div>
      )}

      {/* شريط الإشعارات العائم (Toast Notification) */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 transition-all animate-in fade-in slide-in-from-bottom-4 backdrop-blur-xl ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 shadow-emerald-500/20'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50 shadow-rose-500/20'
              : 'bg-amber-950/90 text-amber-200 border-amber-500/50 shadow-amber-500/20'
          }`}
        >
          {toastMessage.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toastMessage.type === 'error' && <XCircle className="w-5 h-5 text-rose-400" />}
          {toastMessage.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          <span className="text-sm font-bold">{toastMessage.text}</span>
        </div>
      )}

      {/* الهيدر والعنوان الرئيسي الفخم */}
      <div className="relative p-6 sm:p-8 rounded-3xl bg-white/80 dark:bg-[#0c1324]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-950/5 mb-8 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-500" />
                <span>لوحة إدارة الرتب والصلاحيات</span>
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
                RBAC Security Engine v2.0
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
              <span>إدارة الرتب وأعضاء المنصة</span>
              <span className="text-xl">🛡️</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
              التحكم المركزي في تعيين وسحب صلاحيات مسؤولي المنصة والمعلمين والطلاب مع توثيق كافة الحركات في سجل التدقيق ومزامنة الأعضاء فورياً.
            </p>
          </div>

          {/* أزرار الإجراءات العلوية */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setShowSqlModal(true)}
              className="group px-4 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition-all duration-300 flex items-center gap-2 shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 hover:-translate-y-0.5 active:translate-y-0"
              title="تفعيل ظهور كافة الحسابات والطلاب في الداشبورد"
            >
              <Sparkles className="w-4 h-4 fill-slate-950 group-hover:rotate-12 transition-transform" />
              <span>تفعيل ظهور المستخدمين (SQL Fix)</span>
            </button>

            <button
              onClick={() => setShowLogsModal(true)}
              className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-700 dark:text-slate-200 border border-slate-300/80 dark:border-slate-700/80 transition-all flex items-center gap-2 shadow-sm hover:-translate-y-0.5"
            >
              <History className="w-4 h-4 text-purple-500" />
              <span>سجل التدقيق</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-300 font-mono text-[10px] font-bold">
                {auditLogs.length}
              </span>
            </button>

            <button
              onClick={() => loadData()}
              disabled={isLoading}
              className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700/90 text-slate-600 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/80 transition-all shadow-sm hover:rotate-45"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* تنبيه إذا لم تظهر باقي الحسابات بسبب قيود RLS في سوبابيز */}
      {users.length <= 1 && (
        <div className="mb-6 p-5 rounded-3xl bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/35 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md shadow-amber-500/5 backdrop-blur-md animate-in fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-black text-sm text-slate-900 dark:text-white">
                هل قام طلاب أو أعضاء بالتسجيل ولا يظهرون في هذا الجدول؟
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                السبب هو أن سياسات الأمان الافتراضية (RLS) في Supabase تمنع قراءة الحسابات الأخرى تلقائياً. بضغطة زر واحدة يمكنك نسخ سكربت الحل وتشغيله في Supabase SQL Editor لتظهر جميع الحسابات فوراً!
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSqlModal(true)}
            className="w-full md:w-auto px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs shadow-md shadow-amber-500/25 transition-all flex items-center justify-center gap-2 shrink-0 hover:-translate-y-0.5"
          >
            <Sparkles className="w-4 h-4 fill-slate-950" />
            <span>عرض ونسخ كود الحل (SQL)</span>
          </button>
        </div>
      )}

      {/* بطاقات الإحصائيات الفخمة (7 Stats Cards) مع إمكانية الفلترة الفورية بالنقر عليها */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 sm:gap-4 mb-8">
        {/* 1. إجمالي الحسابات */}
        <div 
          onClick={() => setSelectedRoleFilter('all')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'all'
              ? 'bg-violet-500/15 border-violet-500/50 shadow-lg shadow-violet-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-violet-500 mb-2.5">
            <span className="text-xs font-bold">إجمالي الأعضاء</span>
            <div className="w-7 h-7 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Users className="w-4 h-4 text-violet-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
            <span>مسجل في المنصة</span>
          </div>
        </div>

        {/* 2. المشتركون بالدورات Subscribed */}
        <div 
          onClick={() => setSelectedRoleFilter('subscribed')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'subscribed'
              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-500 mb-2.5">
            <span className="text-xs font-bold">المشتركون بالباقة 🎓</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.subscribed}
          </div>
          <div className="text-[10px] text-emerald-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>75 ر.س / سنوياً</span>
          </div>
        </div>

        {/* 3. سوبر أدمن */}
        <div 
          onClick={() => setSelectedRoleFilter('super_admin')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'super_admin'
              ? 'bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-amber-500 mb-2.5">
            <span className="text-xs font-black">سوبر أدمن</span>
            <div className="w-7 h-7 rounded-xl bg-amber-500/15 flex items-center justify-center">
              <Crown className="w-4 h-4 text-amber-500 animate-pulse" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {stats.superAdmin}
          </div>
          <div className="text-[10px] text-amber-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span>تحكم وإشراف كامل</span>
          </div>
        </div>

        {/* 4. مسؤولو المنصة Admins */}
        <div 
          onClick={() => setSelectedRoleFilter('admin')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'admin'
              ? 'bg-purple-500/15 border-purple-500/50 shadow-lg shadow-purple-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-purple-500 mb-2.5">
            <span className="text-xs font-bold">مسؤولو المنصة</span>
            <div className="w-7 h-7 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400">
            {stats.admin}
          </div>
          <div className="text-[10px] text-purple-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            <span>إدارة المحتوى</span>
          </div>
        </div>

        {/* 5. المعلمين Teachers */}
        <div 
          onClick={() => setSelectedRoleFilter('teacher')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'teacher'
              ? 'bg-blue-500/15 border-blue-500/50 shadow-lg shadow-blue-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-blue-500 mb-2.5">
            <span className="text-xs font-bold">المعلمون</span>
            <div className="w-7 h-7 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400">
            {stats.teacher}
          </div>
          <div className="text-[10px] text-blue-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            <span>المحاضرات</span>
          </div>
        </div>

        {/* 6. الطلاب Students */}
        <div 
          onClick={() => setSelectedRoleFilter('student')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'student'
              ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-500 mb-2.5">
            <span className="text-xs font-bold">الطلاب</span>
            <div className="w-7 h-7 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.student}
          </div>
          <div className="text-[10px] text-emerald-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>تدريب وتأسيس</span>
          </div>
        </div>

        {/* 7. المحظورون Banned */}
        <div 
          onClick={() => setSelectedRoleFilter('banned')}
          className={`p-4 rounded-3xl transition-all duration-300 cursor-pointer backdrop-blur-md border ${
            selectedRoleFilter === 'banned'
              ? 'bg-rose-500/15 border-rose-500/50 shadow-lg shadow-rose-500/10 scale-[1.02]'
              : 'bg-white/80 dark:bg-[#0c1324]/80 border-slate-200/80 dark:border-slate-800/80 hover:-translate-y-1 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between text-rose-500 mb-2.5">
            <span className="text-xs font-bold">المحظورون</span>
            <div className="w-7 h-7 rounded-xl bg-rose-500/15 flex items-center justify-center">
              <Ban className="w-4 h-4 text-rose-500" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
            {stats.banned}
          </div>
          <div className="text-[10px] text-rose-500/80 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>حسابات موقوفة</span>
          </div>
        </div>
      </div>

      {/* شريط البحث والفلترة الفخم */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-[#0c1324]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 mb-6 shadow-xl shadow-slate-950/5 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* حقل البحث الفوري */}
        <div className="relative w-full lg:w-[420px]">
          <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="البحث بالاسم أو البريد الإلكتروني أو تليجرام..."
            className="w-full pl-10 pr-11 py-3 rounded-2xl bg-slate-50/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* فلاتر الرتب والاشتراكات كـ Segmented Control */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'الكل', count: stats.total, icon: '👥' },
            { id: 'subscribed', label: 'المشتركون 🎓', count: stats.subscribed, icon: '💎' },
            { id: 'unsubscribed', label: 'غير المشتركين', count: stats.unsubscribed, icon: '⚪' },
            { id: 'super_admin', label: 'سوبر أدمن', count: stats.superAdmin, icon: '👑' },
            { id: 'admin', label: 'مسؤول', count: stats.admin, icon: '🛡️' },
            { id: 'teacher', label: 'معلم', count: stats.teacher, icon: '🎓' },
            { id: 'student', label: 'طالب', count: stats.student, icon: '🎯' },
            { id: 'banned', label: 'محظور', count: stats.banned, icon: '🚫' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedRoleFilter(tab.id)}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap flex items-center gap-2 ${
                selectedRoleFilter === tab.id
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/25 scale-[1.02]'
                  : 'bg-slate-100/90 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/90 dark:hover:bg-slate-800/90 border border-slate-200/60 dark:border-slate-800'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                  selectedRoleFilter === tab.id
                    ? 'bg-slate-950/20 text-slate-950 font-black'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* جدول البيانات الرئيسي الفخم (Interactive Data Table & Mobile Cards) */}
      <div className="rounded-3xl bg-white/80 dark:bg-[#0c1324]/85 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 shadow-2xl overflow-hidden mb-12">
        {/* العرض المكتبي والتابلت (Desktop & Tablet Table View) */}
        <div className="overflow-x-auto hidden md:block">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-slate-50/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 text-slate-400 dark:text-slate-400 text-xs font-black uppercase tracking-wider">
                <th className="py-4.5 px-6">المستخدم</th>
                <th className="py-4.5 px-6">البريد الإلكتروني</th>
                <th className="py-4.5 px-6">تليجرام</th>
                <th className="py-4.5 px-6">الرتبة</th>
                <th className="py-4.5 px-6">حالة الاشتراك 🎓</th>
                <th className="py-4.5 px-6">تاريخ الانضمام</th>
                <th className="py-4.5 px-6 text-center">الإجراءات والصلاحيات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs sm:text-sm">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400">

                    <div className="w-16 h-16 mx-auto mb-3 rounded-3xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 shadow-inner">
                      <Users className="w-8 h-8 opacity-60" />
                    </div>
                    <p className="font-black text-base text-slate-800 dark:text-slate-200">لم يتم العثور على أي مستخدمين مطابقين للبحث</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">جرب تغيير كلمات البحث أو اختيار تبويب رتبة أخرى من الفلاتر العلوية</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrentLoggedUser = currentLoggedUser?.id === user.id;
                  const isTargetSuperAdminOrOwner = user.email?.toLowerCase() === 'yassooooo27m@gmail.com' || user.role === 'super_admin';

                  return (
                    <tr
                      key={user.id}
                      className={`transition-all duration-150 ${
                        isTargetSuperAdminOrOwner
                          ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.03] hover:bg-amber-500/[0.08]'
                          : user.isBanned 
                          ? 'bg-rose-500/[0.05] dark:bg-rose-950/20 hover:bg-rose-500/10' 
                          : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {/* الاسم والأفاتار */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3.5">
                          <div className={`relative w-10 h-10 rounded-2xl flex items-center justify-center font-black border flex-shrink-0 shadow-sm ${
                            isTargetSuperAdminOrOwner
                              ? 'bg-gradient-to-br from-amber-400/20 to-amber-600/30 text-amber-500 border-amber-500/40'
                              : user.isBanned
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-600 border-rose-300 dark:border-rose-800'
                              : 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 text-slate-700 dark:text-slate-200 border-slate-300/80 dark:border-slate-700'
                          }`}>
                            {user.avatarUrl ? (
                              <img
                                src={user.avatarUrl}
                                alt={user.fullName}
                                className="w-full h-full object-cover rounded-2xl"
                              />
                            ) : (
                              <span className="text-sm font-black">{user.fullName.charAt(0) || 'م'}</span>
                            )}
                            {isTargetSuperAdminOrOwner ? (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[9px] text-slate-950 shadow">
                                👑
                              </div>
                            ) : user.role === 'admin' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center text-[8px] text-white shadow">
                                🛡️
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold">{user.fullName}</span>
                              {isCurrentLoggedUser && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                                  (أنت)
                                </span>
                              )}
                              {user.isBanned && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold flex items-center gap-0.5">
                                  <Ban className="w-2.5 h-2.5" />
                                  محظور
                                </span>
                              )}
                              {user.createdAt && (Date.now() - new Date(user.createdAt).getTime() < 48 * 60 * 60 * 1000) && !isTargetSuperAdminOrOwner && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black flex items-center gap-0.5 animate-pulse shadow-sm">
                                  ⚡ جديد
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                              <span>ID:</span>
                              <span className="truncate max-w-[150px]">{user.id}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* البريد الإلكتروني */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300 font-mono text-xs">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                            <Mail className="w-3.5 h-3.5" />
                          </div>
                          <span className="truncate max-w-[200px]">{user.email}</span>
                        </div>
                      </td>

                      {/* معرف تليجرام */}
                      <td className="py-4 px-6 text-slate-600 dark:text-slate-300">
                        {user.telegramUsername ? (
                          <a
                            href={`https://t.me/${user.telegramUsername}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-500 hover:text-sky-400 border border-sky-500/30 transition-all font-mono text-xs font-bold"
                          >
                            <Send className="w-3 h-3 text-sky-400" />
                            <span>@{user.telegramUsername}</span>
                          </a>
                        ) : user.telegramId ? (
                          <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                            ID: {user.telegramId}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">غير مربوط</span>
                        )}
                      </td>

                      {/* الرتبة الحالية */}
                      <td className="py-4 px-6">
                        {renderRoleBadge(user.role)}
                      </td>

                      {/* حالة الاشتراك في الدورات */}
                      <td className="py-4 px-6">
                        {renderSubscriptionBadge(user)}
                      </td>

                      {/* تاريخ الانضمام */}
                      <td className="py-4 px-6 text-slate-500 dark:text-slate-400 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 shrink-0">
                            <Calendar className="w-3.5 h-3.5" />
                          </div>
                          <span>
                            {new Date(user.createdAt).toLocaleDateString('ar-SA', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </td>

                      {/* عمود الإجراءات */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2 flex-nowrap">
                          {/* اختيار الرتبة */}
                          <div className="inline-block relative min-w-[130px]">
                            <select
                              value={user.role}
                              disabled={!isAuthorizedAdmin || user.isBanned}
                              onChange={(e) => handleSelectRole(user, e.target.value as UserRole)}
                              className={`w-full px-3 py-1.5 rounded-xl text-xs font-bold appearance-none transition-all cursor-pointer text-center ${
                                !isAuthorizedAdmin || user.isBanned
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                                  : user.role === 'super_admin'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/40 hover:border-amber-500 font-black'
                                  : user.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/40 hover:border-purple-500'
                                  : user.role === 'teacher'
                                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/40 hover:border-blue-500'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-500'
                              }`}
                            >
                              <option value="student">🎯 طالب</option>
                              <option value="teacher">🎓 معلم</option>
                              <option value="admin">🛡️ مسؤول</option>
                              <option value="super_admin">👑 سوبر أدمن</option>
                            </select>
                          </div>

                          {/* زر إلغاء أو تفعيل الاشتراك */}
                          {!isTargetSuperAdminOrOwner && isAuthorizedAdmin && (
                            user.isSubscribed ? (
                              <button
                                onClick={() => handleCancelSubscription(user)}
                                disabled={isProcessingAction}
                                title="إلغاء اشتراك الطالب في باقة الدورات السنوية"
                                className="p-2 rounded-xl text-xs font-bold transition-all bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">إلغاء الاشتراك</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGrantSubscription(user)}
                                disabled={isProcessingAction}
                                title="تفعيل اشتراك سنوي للطالب (365 يوماً)"
                                className="p-2 rounded-xl text-xs font-bold transition-all bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm cursor-pointer"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span className="hidden xl:inline">تفعيل الاشتراك</span>
                              </button>
                            )
                          )}

                          {/* زر حظر / فك حظر */}
                          <button
                            onClick={() => handleToggleBan(user)}
                            disabled={!isSuperAdmin || isCurrentLoggedUser || isTargetSuperAdminOrOwner}
                            title={
                              !isSuperAdmin
                                ? 'صلاحية الحظر محصورة بالسوبر أدمن (Super Admin) فقط'
                                : isCurrentLoggedUser
                                ? 'لا يمكنك حظر حسابك الخاص'
                                : isTargetSuperAdminOrOwner
                                ? 'لا يمكن حظر السوبر أدمن'
                                : user.isBanned
                                ? 'إلغاء حظر الحساب'
                                : 'حظر هذا الحساب'
                            }
                            className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                              user.isBanned
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-sm'
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

                          {/* زر مسح الحساب */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            disabled={!isSuperAdmin || isCurrentLoggedUser || isTargetSuperAdminOrOwner}
                            title={
                              !isSuperAdmin
                                ? 'صلاحية مسح الحساب محصورة بالسوبر أدمن (Super Admin) فقط'
                                : isCurrentLoggedUser
                                ? 'لا يمكنك مسح حسابك وأنت مسجل دخول به'
                                : isTargetSuperAdminOrOwner
                                ? 'لا يمكن مسح السوبر أدمن'
                                : 'مسح الحساب نهائياً'
                            }
                            className="p-2 rounded-xl text-xs font-bold transition-all bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm"
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
              const isCurrentLoggedUser = currentLoggedUser?.id === user.id;
              const isTargetSuperAdminOrOwner = user.email?.toLowerCase() === 'yassooooo27m@gmail.com' || user.role === 'super_admin';

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
                          {user.createdAt && (Date.now() - new Date(user.createdAt).getTime() < 48 * 60 * 60 * 1000) && !isTargetSuperAdminOrOwner && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-black flex items-center gap-0.5 animate-pulse">
                              ⚡ جديد
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
                    {/* حالة الاشتراك وزر الإلغاء / التفعيل للموبايل */}
                    <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800/60">
                      <div>
                        {renderSubscriptionBadge(user)}
                      </div>

                      {!isTargetSuperAdminOrOwner && isAuthorizedAdmin && (
                        user.isSubscribed ? (
                          <button
                            onClick={() => handleCancelSubscription(user)}
                            disabled={isProcessingAction}
                            className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                          >
                            <UserX className="w-3 h-3" />
                            <span>إلغاء الاشتراك</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGrantSubscription(user)}
                            disabled={isProcessingAction}
                            className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>تفعيل الاشتراك</span>
                          </button>
                        )
                      )}
                    </div>

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
                        disabled={!isSuperAdmin || isCurrentLoggedUser || isTargetSuperAdminOrOwner}
                        title={
                          !isSuperAdmin
                            ? 'صلاحية الحظر محصورة بالسوبر أدمن (Super Admin) فقط'
                            : isCurrentLoggedUser
                            ? 'لا يمكنك حظر حسابك الخاص'
                            : isTargetSuperAdminOrOwner
                            ? 'لا يمكن حظر السوبر أدمن'
                            : undefined
                        }
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
                        disabled={!isSuperAdmin || isCurrentLoggedUser || isTargetSuperAdminOrOwner}
                        title={
                          !isSuperAdmin
                            ? 'صلاحية مسح الحساب محصورة بالسوبر أدمن (Super Admin) فقط'
                            : isCurrentLoggedUser
                            ? 'لا يمكنك مسح حسابك'
                            : isTargetSuperAdminOrOwner
                            ? 'لا يمكن مسح السوبر أدمن'
                            : undefined
                        }
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
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
              pendingBan.isBanning 
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-500' 
                : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-500'
            }`}>
              {pendingBan.isBanning ? <Ban className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-2">
              <Crown className="w-3 h-3 text-rose-500" />
              <span>صلاحية حصرية للسوبر أدمن (Super Admin)</span>
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
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-2">
              <Crown className="w-3 h-3 text-rose-500" />
              <span>صلاحية حصرية للسوبر أدمن (Super Admin)</span>
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

      {/* ========================================================================= */}
      {/* نافذة سكربت حل ظهور المستخدمين في الداشبورد (SQL Fix Modal) */}
      {/* ========================================================================= */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in font-cairo">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-white dark:bg-[#0d1322] border border-slate-200 dark:border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowSqlModal(false)}
              className="absolute top-4 left-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  تفعيل ظهور جميع المستخدمين في الداشبورد
                </h3>
                <p className="text-xs text-slate-400">
                  حل قيود الأمان (Row Level Security) في Supabase بخطوات بسيطة (أقل من 30 ثانية)
                </p>
              </div>
            </div>

            {/* الخطوات */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 mb-4 space-y-1.5 leading-relaxed">
              <p className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <span>📌 خطوات الحل الفوري:</span>
              </p>
              <p>1. اضغط على زر <strong>"نسخ كود SQL بالكامل"</strong> أدناه.</p>
              <p>2. افتح صفحة <strong>SQL Editor</strong> في لوحة تحكم Supabase عبر الزر المباشر بالأسفل.</p>
              <p>3. الصق الكود واضغط <strong>Run</strong>، ثم اضغط <strong>"تحديث اللوحة الآن"</strong> وستظهر كافة الحسابات فوراً!</p>
            </div>

            {/* صندوق الكود */}
            <div className="flex-1 overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-950 mb-4">
              <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
                <span className="font-mono">FIX_DASHBOARD_USERS_NOW.sql</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_FIX_SCRIPT);
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 3000);
                    showToast('تم نسخ كود SQL بالكامل إلى الحافظة بنجاح! الصقه في Supabase واضغط Run', 'success');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition text-[11px]"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedSql ? 'تم النسخ!' : 'نسخ الكود بالكامل'}</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 text-[11px] font-mono text-emerald-400/90 whitespace-pre leading-relaxed select-all">
                {SQL_FIX_SCRIPT}
              </div>
            </div>

            {/* الأزرار بالأسفل */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href="https://supabase.com/dashboard/project/djkwgwdlygxqcateivbc/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition flex items-center gap-2"
              >
                <span>فتح Supabase SQL Editor</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    loadData();
                    showToast('جاري تحديث بيانات المستخدمين...', 'info' as any);
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm transition flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>تحديث اللوحة الآن</span>
                </button>
                <button
                  onClick={() => setShowSqlModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SQL_FIX_SCRIPT = `-- ==============================================================================
-- 🚀 منصة طرقع للقدرات - السكربت النهائي الشامل لحل مشكلة ظهور المستخدمين في الداشبورد
-- ==============================================================================

-- 1. التأكد من نوع الرتب user_role
DO $$ BEGIN
    CREATE TYPE public.user_role AS ENUM ('student', 'teacher', 'admin', 'super_admin');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- 2. إضافة كافة الأعمدة المطلوبة في جدول public.profiles بأمان تام
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT DEFAULT 'طالب طرقع';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_score INT DEFAULT 100;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ban_reason TEXT DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- إضافة عمود role كـ user_role
DO $$ BEGIN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role DEFAULT 'student'::public.user_role;
EXCEPTION WHEN OTHERS THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'student';
END $$;

-- 3. استيراد كافة الحسابات المسجلة حالياً في auth.users إلى جدول profiles
INSERT INTO public.profiles (id, email, full_name, role, target_score, created_at, updated_at)
SELECT 
    u.id,
    u.email,
    COALESCE(
        CASE WHEN LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska' ELSE NULL END,
        u.raw_user_meta_data->>'full_name',
        split_part(u.email, '@', 1),
        'طالب طرقع'
    ),
    CASE 
        WHEN LOWER(TRIM(u.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
        ELSE COALESCE((u.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    END,
    COALESCE(
        CASE 
            WHEN (u.raw_user_meta_data->>'target_score') ~ '^[0-9]+$' 
            THEN (u.raw_user_meta_data->>'target_score')::int 
            ELSE 100 
        END, 
        100
    ),
    COALESCE(u.created_at, now()),
    now()
FROM auth.users u
ON CONFLICT (id) DO UPDATE
SET 
    email = COALESCE(EXCLUDED.email, profiles.email),
    full_name = CASE 
        WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska'
        ELSE COALESCE(profiles.full_name, EXCLUDED.full_name)
    END,
    role = CASE 
        WHEN LOWER(TRIM(EXCLUDED.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
        ELSE profiles.role
    END,
    updated_at = now();

-- نسخ البريد لجميع الصفوف التي كان فيها الإيميل فارغاً
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- إنشاء فهرس سريع للبحث بالبريد
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 4. تثبيت حساب السوبر أدمن الرئيسي Yoska في auth.users و profiles
UPDATE auth.users
SET 
  email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"role": "super_admin", "full_name": "Yoska"}'::jsonb,
  raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "super_admin"}'::jsonb
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

UPDATE public.profiles
SET 
  role = 'super_admin'::public.user_role,
  full_name = 'Yoska',
  is_banned = false
WHERE LOWER(TRIM(email)) = 'yassooooo27m@gmail.com';

-- 5. تحديث دالة وتريجر تسجيل المستخدمين الجدد (handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    email, 
    full_name, 
    role, 
    target_score, 
    telegram_username, 
    telegram_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      CASE WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'Yoska' ELSE NULL END,
      NEW.raw_user_meta_data->>'full_name', 
      split_part(NEW.email, '@', 1),
      'طالب طرقع'
    ),
    CASE 
      WHEN LOWER(TRIM(NEW.email)) = 'yassooooo27m@gmail.com' THEN 'super_admin'::public.user_role
      ELSE COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'student'::public.user_role)
    END,
    COALESCE(
      CASE 
        WHEN (NEW.raw_user_meta_data->>'target_score') ~ '^[0-9]+$' 
        THEN (NEW.raw_user_meta_data->>'target_score')::int 
        ELSE 100 
      END, 
      100
    ),
    NEW.raw_user_meta_data->>'telegram_username',
    CASE 
      WHEN (NEW.raw_user_meta_data->>'telegram_id') ~ '^[0-9]+$' 
      THEN (NEW.raw_user_meta_data->>'telegram_id')::bigint 
      ELSE NULL 
    END,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    telegram_username = COALESCE(EXCLUDED.telegram_username, profiles.telegram_username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. حل مشكلة RLS: فتح قراءة وتعديل جدول profiles لظهور جميع المستخدمين في الداشبورد
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Allow authenticated and admins to read profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow update profiles" ON public.profiles;

CREATE POLICY "Allow select profiles"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Allow insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update profiles"
  ON public.profiles FOR UPDATE
  USING (true);

-- 7. إنشاء دوال إدارة الرتب والحظر والحذف (RPCs)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
    RETURN (auth.jwt() ->> 'email' = 'yassooooo27m@gmail.com')
        OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND (role = 'super_admin' OR email = 'yassooooo27m@gmail.com')
        );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_update_user_role(
    target_user_id UUID,
    new_role public.user_role,
    reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    UPDATE public.profiles
    SET role = new_role, updated_at = now()
    WHERE id = target_user_id;

    BEGIN
        UPDATE auth.users
        SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', new_role::text)
        WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_toggle_ban_user(
    target_user_id UUID,
    p_is_banned BOOLEAN,
    p_reason TEXT DEFAULT NULL
)
RETURNS boolean AS $$
BEGIN
    UPDATE public.profiles
    SET 
        is_banned = p_is_banned,
        ban_reason = CASE WHEN p_is_banned THEN p_reason ELSE NULL END,
        banned_at = CASE WHEN p_is_banned THEN now() ELSE NULL END,
        updated_at = now()
    WHERE id = target_user_id;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
    target_user_id UUID
)
RETURNS boolean AS $$
BEGIN
    DELETE FROM public.profiles WHERE id = target_user_id;
    BEGIN
        DELETE FROM auth.users WHERE id = target_user_id;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.admin_update_user_role(UUID, public.user_role, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_toggle_ban_user(UUID, BOOLEAN, TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated, anon;

-- 8. تفعيل البث اللحظي (Realtime) لجدول profiles
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN OTHERS THEN null;
END $$;

-- 9. الاستعلام للتحقق
SELECT id, email, full_name, role, target_score, is_banned, created_at
FROM public.profiles
ORDER BY (role = 'super_admin') DESC, created_at DESC;
`;
