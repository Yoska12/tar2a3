import { supabase, isSupabaseConfigured, authService, syncUserToMembersDashboard, isValidUuid } from './supabase';
import { isOwnerEmail } from './securityUtils';
import { UserRole, UserWithRole, RoleChangeLog } from '../types';
import { cancelAnnualSubscription, grantAnnualSubscription, syncSubscriptionsFromCloud } from './subscriptionService';
import { downloadTrackingService } from './downloadTrackingService';
import { dbCache, invalidateUsersCache } from './dbCache';

// الحساب الإداري المعتمد لمالك المنصة (Yoska)
const INITIAL_DEMO_USERS: UserWithRole[] = [
  {
    id: 'usr-admin-01',
    email: 'yassooooo27m@gmail.com',
    fullName: 'Yoska',
    role: 'super_admin',
    targetScore: 100,
    telegramUsername: 'yassien_ahmed',
    telegramId: 987654321,
    createdAt: '2024-01-01T10:00:00Z',
    lastSignInAt: new Date().toISOString(),
  },
];

// سجل التدقيق المبدئي
const INITIAL_LOGS: RoleChangeLog[] = [];

// مفتاح القائمة السوداء للحسابات المحذوفة
const DELETED_USERS_STORAGE_KEY = 'tarqa_deleted_user_ids';

/**
 * جلب قائمة الحسابات المحذوفة نهائياً لضمان عدم ظهورها أبداً
 */
export const getDeletedUsersList = (): string[] => {
  try {
    const raw = localStorage.getItem(DELETED_USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

/**
 * إضافة مستخدم لقائمة الحسابات المحذوفة نهائياً
 */
export const markUserAsDeleted = (identifiers: (string | number | undefined | null)[]) => {
  try {
    const current = getDeletedUsersList();
    const cleanIds = identifiers
      .filter(Boolean)
      .map((id) => String(id).toLowerCase().trim());
    const set = new Set([...current, ...cleanIds]);
    localStorage.setItem(DELETED_USERS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
};

export const rolesService = {
  // مزامنة وتسجيل أي عضو جديد فوراً
  registerOrSyncUser: (user: Partial<UserWithRole>) => {
    syncUserToMembersDashboard(user as any);
    invalidateUsersCache();
  },

  // جلب كافة المستخدمين والأعضاء المسجلين مع تخزين مؤقت فائق السرعة
  getUsers: async (forceRefresh: boolean = false): Promise<UserWithRole[]> => {
    if (forceRefresh) {
      dbCache.invalidate('db_users_with_roles');
    }
    return dbCache.getOrFetch(
      'db_users_with_roles',
      async () => {
        const deletedList = getDeletedUsersList();
        const isDeletedUser = (id?: string, email?: string, tg?: string, tgId?: number) => {
          const idClean = id ? id.toLowerCase().trim() : '';
          const emailClean = email ? email.toLowerCase().trim() : '';
          const tgClean = tg ? tg.replace(/^@/, '').toLowerCase().trim() : '';
          const tgIdClean = tgId ? String(tgId) : '';

          return (
            (idClean && deletedList.includes(idClean)) ||
            (emailClean && deletedList.includes(emailClean)) ||
            (tgClean && deletedList.includes(tgClean)) ||
            (tgIdClean && deletedList.includes(tgIdClean))
          );
        };

        let supabaseUsers: UserWithRole[] = [];

    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*');

        if (error) {
          console.warn('[rolesService.getUsers] Supabase fetch notice:', error);
        }

        if (!error && data && data.length > 0) {
          const sorted = [...data].sort((a: any, b: any) => {
            const tA = new Date(a.created_at || a.updated_at || 0).getTime();
            const tB = new Date(b.created_at || b.updated_at || 0).getTime();
            return tB - tA;
          });

          const filtered = sorted.filter((d: any) => {
            const e = (d.email || '').toLowerCase().trim();
            const tg = (d.telegram_username || '').replace(/^@/, '').toLowerCase().trim();
            const isDel = Boolean(d.is_deleted) || (d.ban_reason && d.ban_reason.includes('تم مسح الحساب نهائياً'));
            
            return (
              !isDel &&
              !isDeletedUser(d.id, e, tg, d.telegram_id) &&
              e !== 'lectures_store@tarqa.app' &&
              e !== 'tarqa_test_1789048296799@gmail.com' &&
              d.id !== '32344334-a8b9-40c3-aeeb-9d55f4d160e4' &&
              d.id !== 'a0a2797a-5bcb-4987-b9bc-43b6a3d36876'
            );
          });

          supabaseUsers = filtered.map((d: any) => {
            const email = d.email || (d.telegram_username ? `@${d.telegram_username}` : `مستخدم_${d.id.substring(0, 6)}`);
            const isOwner = isOwnerEmail(d.email) || d.id === 'usr-admin-01';
            return {
              id: d.id,
              email: d.email || email,
              fullName: isOwner ? (d.full_name && d.full_name !== 'طالب طرقع' ? d.full_name : 'Yoska') : (d.full_name || 'طالب طرقع'),
              role: isOwner ? 'super_admin' : ((d.role as UserRole) || 'student'),
              targetScore: d.target_score || 100,
              telegramUsername: d.telegram_username,
              telegramId: d.telegram_id,
              avatarUrl: d.avatar_url,
              createdAt: d.created_at || d.updated_at || new Date().toISOString(),
              lastSignInAt: d.last_sign_in_at || d.updated_at || d.created_at,
              isBanned: Boolean(d.is_banned),
              banReason: d.ban_reason || undefined,
              bannedAt: d.banned_at || undefined,
              isSubscribed: Boolean(d.is_subscribed),
              subscriptionExpiresAt: d.subscription_expires_at || undefined,
              points: typeof d.points === 'number' ? d.points : (d.points ? parseInt(d.points, 10) || 0 : 0),
              hasDownloadedFiles: Boolean(d.has_downloaded_files || (d.downloaded_files_count && d.downloaded_files_count > 0)),
              downloadedFilesCount: d.downloaded_files_count || (d.has_downloaded_files ? 1 : 0),
              lastDownloadedAt: d.last_downloaded_at || undefined,
              downloadedFiles: d.downloaded_files || [],
            };
          });
        }
      } catch (err) {
        console.warn('Failed to fetch from Supabase, using local state:', err);
      }
    }

    // قراءة المستخدمين المسجلين محلياً
    let localUsers: UserWithRole[] = [];
    try {
      const stored = localStorage.getItem('tarqa_all_users_roles');
      if (stored) {
        localUsers = JSON.parse(stored);
      }
    } catch {}

    // استيراد أي مستخدم جديد تم تسجيله في tarqa_registered_users
    try {
      const registered = localStorage.getItem('tarqa_registered_users');
      if (registered) {
        const regList = JSON.parse(registered);
        if (Array.isArray(regList)) {
          for (const ru of regList) {
            if (
              !isDeletedUser(ru.id, ru.email, ru.telegramUsername, ru.telegramId) &&
              !localUsers.some(u => u.id === ru.id || (u.email && ru.email && u.email.toLowerCase() === ru.email.toLowerCase()))
            ) {
              localUsers.push({
                id: ru.id || 'usr-' + Date.now(),
                email: ru.email,
                fullName: ru.fullName || 'طالب طرقع',
                role: ru.role || 'student',
                targetScore: ru.targetScore || 100,
                telegramUsername: ru.telegramUsername,
                telegramId: ru.telegramId,
                avatarUrl: ru.avatarUrl,
                createdAt: ru.createdAt || new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch {}

    // استيراد المستخدم الحالي المخزن محلياً لضمان عدم سقوطه إن لم يكن محذوفاً
    try {
      const currentRaw = localStorage.getItem('tarqa_current_user');
      if (currentRaw) {
        const cu = JSON.parse(currentRaw);
        if (
          cu &&
          cu.id &&
          !isDeletedUser(cu.id, cu.email, cu.telegramUsername, cu.telegramId) &&
          !localUsers.some(u => u.id === cu.id || (u.email && cu.email && u.email.toLowerCase() === cu.email.toLowerCase()))
        ) {
          localUsers.push({
            id: cu.id,
            email: cu.email || 'user@tarqa.app',
            fullName: cu.fullName || 'طالب طرقع',
            role: cu.role || 'student',
            targetScore: cu.targetScore || 100,
            telegramUsername: cu.telegramUsername,
            telegramId: cu.telegramId,
            avatarUrl: cu.avatarUrl,
            createdAt: new Date().toISOString(),
          });
        }
      }
    } catch {}

    // دمج قوائم المستخدمين لضمان عدم ضياع أي مستخدم وعدم تكرار نفس الشخص
    const unifiedUsers: UserWithRole[] = [...supabaseUsers];

    for (const u of localUsers) {
      if (['usr-admin-02', 'usr-teacher-03', 'usr-teacher-04', 'usr-student-05', 'usr-student-06', 'usr-student-07'].includes(u.id)) continue;
      if (u.email?.endsWith('@student.com')) continue;
      if (isDeletedUser(u.id, u.email, u.telegramUsername, u.telegramId)) continue;

      const uEmail = (u.email || '').trim().toLowerCase();
      const uTg = (u.telegramUsername || '').replace(/^@/, '').trim().toLowerCase();

      const existingIndex = unifiedUsers.findIndex((ex) => {
        const exEmail = (ex.email || '').trim().toLowerCase();
        const exTg = (ex.telegramUsername || '').replace(/^@/, '').trim().toLowerCase();

        const idMatches = Boolean(u.id && ex.id && u.id === ex.id);
        const emailMatches = Boolean(
          uEmail &&
          exEmail &&
          !uEmail.includes('@telegram.tarqa') &&
          !exEmail.includes('@telegram.tarqa') &&
          uEmail === exEmail
        );
        const tgIdMatches = Boolean(u.telegramId && ex.telegramId && u.telegramId === ex.telegramId);
        const tgNameMatches = Boolean(uTg && exTg && uTg === exTg);

        return idMatches || emailMatches || tgIdMatches || tgNameMatches;
      });

      if (existingIndex >= 0) {
        const ex = unifiedUsers[existingIndex];
        const mergedRole = (ex.role === 'super_admin' || u.role === 'super_admin') 
          ? 'super_admin' 
          : (ex.role !== 'student' ? ex.role : (u.role || ex.role));

        unifiedUsers[existingIndex] = {
          ...ex,
          fullName: (ex.fullName && ex.fullName !== 'طالب طرقع') ? ex.fullName : (u.fullName || ex.fullName),
          role: mergedRole,
          telegramUsername: ex.telegramUsername || u.telegramUsername,
          telegramId: ex.telegramId || u.telegramId,
          targetScore: ex.targetScore || u.targetScore || 100,
        };
      } else {
        unifiedUsers.push(u);
      }
    }

    // تنقية نهائية من أي حساب محذوف
    let resultUsers = unifiedUsers.filter(u => !isDeletedUser(u.id, u.email, u.telegramUsername, u.telegramId));

    // ضمان وجود الحساب الإداري الرئيسي (Yoska) في رأس القائمة دائماً كسوبر أدمن
    const yoskaIndex = resultUsers.findIndex(u => isOwnerEmail(u.email));
    let yoskaUser: UserWithRole;
    if (yoskaIndex >= 0) {
      yoskaUser = {
        ...resultUsers[yoskaIndex],
        role: 'super_admin',
        fullName: resultUsers[yoskaIndex].fullName && resultUsers[yoskaIndex].fullName !== 'طالب طرقع' ? resultUsers[yoskaIndex].fullName : 'Yoska',
      };
      resultUsers.splice(yoskaIndex, 1);
    } else {
      yoskaUser = { ...INITIAL_DEMO_USERS[0], role: 'super_admin', fullName: 'Yoska' };
    }

    // ترتيب باقي الأعضاء بحيث يظهر الأحدث تسجيلاً أولاً
    resultUsers.sort((a, b) => {
      const tA = new Date(a.createdAt || a.lastSignInAt || 0).getTime();
      const tB = new Date(b.createdAt || b.lastSignInAt || 0).getTime();
      return tB - tA;
    });

    // وضع السوبر أدمن Yoska في رأس القائمة
    resultUsers.unshift(yoskaUser);

    // مزامنة حالة الاشتراك الحقيقية مع السحابة والتخزين المحلي وقاعدة البيانات
    let localSubs: Record<string, any> = {};
    try {
      localSubs = await syncSubscriptionsFromCloud();
    } catch {
      try {
        const rawSubs = localStorage.getItem('tarqa_subscriptions');
        if (rawSubs) localSubs = JSON.parse(rawSubs);
      } catch {}
    }

    // مزامنة سجلات تحميل الملفات من السحابة المركزية والتخزين
    let allDownloads: Record<string, any> = {};
    try {
      allDownloads = await downloadTrackingService.syncDownloadsFromCloud();
    } catch {
      allDownloads = downloadTrackingService.getAllDownloads();
    }

    for (const u of resultUsers) {
      const em = (u.email || '').toLowerCase().trim();
      const tg = (u.telegramUsername || '').replace(/^@/, '').toLowerCase().trim();
      const isOwner = isOwnerEmail(u.email) || u.id === 'usr-admin-01' || u.role === 'super_admin';
      
      if (isOwner) {
        u.isSubscribed = true;
      } else {
        // البحث عن سجل الاشتراك الدقيق للمستخدم بكافة المعرفات
        const sub =
          localSubs[u.id] ||
          (u.email ? localSubs[em] : null) ||
          (tg ? localSubs[tg] : null) ||
          (u.telegramId ? localSubs[String(u.telegramId)] : null);

        if (sub) {
          if (sub.active === true || sub.isActive === true || sub.status === 'active') {
            const exp = sub.expiresAt || sub.expiresDate;
            const isNotExpired = !exp || new Date(exp).getTime() > Date.now();
            if (isNotExpired) {
              u.isSubscribed = true;
              u.subscriptionExpiresAt = exp || u.subscriptionExpiresAt;
            } else {
              u.isSubscribed = false;
            }
          } else if (sub.active === false || sub.isActive === false || sub.status === 'cancelled') {
            // إلغاء صريح للاشتراك يلغي أي حالة سابقة في السيرفر أو المتصفح
            u.isSubscribed = false;
            u.subscriptionExpiresAt = undefined;
          }
        } else {
          // فحص الحالة المعتمدة من قاعدة البيانات أولاً لمنع مسح الاشتراكات الحقيقية
          const dbIsSub = Boolean((u as any).is_subscribed || u.isSubscribed);
          const dbExp = (u as any).subscription_expires_at || u.subscriptionExpiresAt;
          const dbNotExp = !dbExp || new Date(dbExp).getTime() > Date.now();

          if (dbIsSub && dbNotExp) {
            u.isSubscribed = true;
            u.subscriptionExpiresAt = dbExp || u.subscriptionExpiresAt;
          } else {
            const fromRoles = localUsers.find(lu => lu.id === u.id || (lu.email && lu.email.trim().toLowerCase() === em));
            if (fromRoles?.isSubscribed === true) {
              const exp = fromRoles.subscriptionExpiresAt;
              const isNotExpired = !exp || new Date(exp).getTime() > Date.now();
              if (isNotExpired) {
                u.isSubscribed = true;
                u.subscriptionExpiresAt = exp || u.subscriptionExpiresAt;
              } else {
                u.isSubscribed = false;
                u.subscriptionExpiresAt = undefined;
              }
            } else {
              u.isSubscribed = false;
              u.subscriptionExpiresAt = undefined;
            }
          }
        }
      }

      // دمج بيانات تحميلات الملفات سحابياً ومحلياً وقاعدة البيانات دون مسح أي تحميل حقيقي
      const dlRecord =
        allDownloads[u.id] ||
        (u.email ? allDownloads[em] : null) ||
        (tg ? allDownloads[tg] : null) ||
        (u.telegramId ? allDownloads[String(u.telegramId)] : null);

      const dbHasDownloaded = Boolean(u.hasDownloadedFiles || (u.downloadedFilesCount && u.downloadedFilesCount > 0));
      const dbDownloadCount = u.downloadedFilesCount || 0;
      const dbDownloadedFiles = u.downloadedFiles || [];

      if (dlRecord && dlRecord.downloadCount > 0) {
        u.hasDownloadedFiles = true;
        u.downloadedFilesCount = Math.max(dlRecord.downloadCount, dbDownloadCount);
        u.lastDownloadedAt = dlRecord.lastDownloadedAt || u.lastDownloadedAt;
        u.downloadedFiles = (dlRecord.files && dlRecord.files.length > 0) ? dlRecord.files : dbDownloadedFiles;
      } else if (dbHasDownloaded) {
        u.hasDownloadedFiles = true;
        u.downloadedFilesCount = Math.max(1, dbDownloadCount);
        u.downloadedFiles = dbDownloadedFiles;
      } else {
        u.hasDownloadedFiles = false;
        u.downloadedFilesCount = 0;
        u.downloadedFiles = [];
      }
    }

    // إدراج أي مشترك مسجل في اشتراكات المنصة ولم يظهر في قائمة المستخدمين
    const existingIds = new Set(resultUsers.map(u => (u.id || '').toLowerCase()));
    const existingEmails = new Set(resultUsers.map(u => (u.email || '').toLowerCase().trim()));

    for (const [key, rawSub] of Object.entries(localSubs)) {
      const sub = rawSub as any;
      if (!sub || typeof sub !== 'object') continue;
      const isActive = sub.active === true || sub.isActive === true || sub.status === 'active';
      if (!isActive) continue;

      const subId = (sub.user_id || sub.userId || sub.id || key || '').trim();
      const subEmail = (sub.user_email || sub.userEmail || sub.email || '').trim().toLowerCase();
      const subTg = (sub.telegramUsername || '').replace(/^@/, '').trim().toLowerCase();

      const alreadyExists =
        (subId && existingIds.has(subId.toLowerCase())) ||
        (subEmail && existingEmails.has(subEmail));

      if (!alreadyExists && !isDeletedUser(subId, subEmail, subTg, sub.telegramId)) {
        const newSubUser: UserWithRole = {
          id: subId || ('usr_' + Date.now()),
          email: subEmail || (sub.userName ? `${sub.userName}@student.tarqa` : 'student@tarqa.app'),
          fullName: sub.user_name || sub.userName || sub.fullName || 'طالب مشترك بالباقة',
          role: 'student',
          targetScore: 100,
          telegramUsername: sub.telegramUsername,
          telegramId: sub.telegramId,
          isSubscribed: true,
          subscriptionExpiresAt: sub.expiresDate || sub.expiresAt || new Date(Date.now() + 365*24*60*60*1000).toISOString(),
          createdAt: sub.createdAt || sub.created_at || new Date().toISOString(),
          lastSignInAt: new Date().toISOString(),
        };
        resultUsers.push(newSubUser);
        if (newSubUser.id) existingIds.add(newSubUser.id.toLowerCase());
        if (newSubUser.email) existingEmails.add(newSubUser.email.toLowerCase().trim());
      }
    }

    // فحص سجل معاملات كاشير الناجحة وضمان ظهور أصحابها كمشتركين
    try {
      const txRaw = localStorage.getItem('tarqa_kashier_transactions');
      if (txRaw) {
        const txList = JSON.parse(txRaw);
        if (Array.isArray(txList)) {
          for (const tx of txList) {
            if (tx.status === 'SUCCESS' && tx.userEmail) {
              const txEm = tx.userEmail.toLowerCase().trim();
              const existing = resultUsers.find(
                u => (u.email && u.email.toLowerCase().trim() === txEm) || (tx.userId && u.id === tx.userId)
              );

              // التحقق مما إذا كان الطالب قد ألغي اشتراكه صراحة من الإدارة
              const exSub = existing ? (
                localSubs[existing.id] ||
                (existing.email ? localSubs[existing.email.toLowerCase().trim()] : null) ||
                (existing.telegramUsername ? localSubs[existing.telegramUsername.replace(/^@/, '').toLowerCase().trim()] : null)
              ) : null;
              const isExplicitlyCancelled =
                (existing && existing.isSubscribed === false) ||
                (exSub && (exSub.isActive === false || exSub.active === false || exSub.status === 'cancelled'));

              if (existing) {
                if (!isExplicitlyCancelled) {
                  existing.isSubscribed = true;
                  if (!existing.subscriptionExpiresAt) {
                    existing.subscriptionExpiresAt = new Date(Date.now() + 365*24*60*60*1000).toISOString();
                  }
                }
              } else if (!isDeletedUser(tx.userId, txEm) && !isExplicitlyCancelled) {
                const newTxUser: UserWithRole = {
                  id: tx.userId || ('usr_' + Date.now()),
                  email: tx.userEmail,
                  fullName: tx.userName || 'طالب مشترك (كاشير)',
                  role: 'student',
                  targetScore: 100,
                  isSubscribed: true,
                  subscriptionExpiresAt: new Date(Date.now() + 365*24*60*60*1000).toISOString(),
                  createdAt: tx.timestamp || new Date().toISOString(),
                  lastSignInAt: tx.timestamp || new Date().toISOString(),
                };
                resultUsers.push(newTxUser);
                if (newTxUser.id) existingIds.add(newTxUser.id.toLowerCase());
                if (newTxUser.email) existingEmails.add(newTxUser.email.toLowerCase().trim());
              }
            }
          }
        }
      }
    } catch {}

    // ضمان إدراج أي طالب قام بتحميل ملفات من السيرفر ولم يظهر في قائمة المستخدمين
    for (const [key, rawDl] of Object.entries(allDownloads)) {
      const dl = rawDl as any;
      if (!dl || typeof dl !== 'object' || !dl.downloadCount || dl.downloadCount <= 0) continue;
      const dlId = (dl.userId || key || '').trim();
      const dlEmail = (dl.userEmail || '').trim().toLowerCase();
      if (!dlId && !dlEmail) continue;

      const alreadyExists =
        (dlId && existingIds.has(dlId.toLowerCase())) ||
        (dlEmail && existingEmails.has(dlEmail));

      if (!alreadyExists && !isDeletedUser(dlId, dlEmail, undefined, undefined)) {
        const newDlUser: UserWithRole = {
          id: dlId || ('usr_dl_' + Date.now()),
          email: dlEmail || 'student@tarqa.app',
          fullName: dl.userName && dl.userName !== 'طالب طرقع' ? dl.userName : 'طالب طرقع',
          role: 'student',
          targetScore: 100,
          isSubscribed: false,
          hasDownloadedFiles: true,
          downloadedFilesCount: dl.downloadCount || (dl.files?.length || 1),
          lastDownloadedAt: dl.lastDownloadedAt || new Date().toISOString(),
          downloadedFiles: dl.files || [],
          createdAt: dl.lastDownloadedAt || new Date().toISOString(),
          lastSignInAt: dl.lastDownloadedAt || new Date().toISOString(),
        };
        resultUsers.push(newDlUser);
        if (newDlUser.id) existingIds.add(newDlUser.id.toLowerCase());
        if (newDlUser.email) existingEmails.add(newDlUser.email.toLowerCase().trim());
      }
    }

    try {
      localStorage.setItem('tarqa_all_users_roles', JSON.stringify(resultUsers));
    } catch {}

        return resultUsers;
      },
      {
        tag: 'users',
        ttlMs: 3 * 60 * 1000,
        backgroundRevalidate: true,
        forceRefresh,
      }
    );
  },

  // جلب سجل التدقيق
  getAuditLogs: async (): Promise<RoleChangeLog[]> => {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('role_change_logs')
          .select('id, admin_id, target_user_id, old_role, new_role, reason, created_at')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((l: any) => ({
            id: l.id,
            adminId: l.admin_id,
            targetUserId: l.target_user_id,
            oldRole: l.old_role as UserRole,
            newRole: l.new_role as UserRole,
            reason: l.reason,
            createdAt: l.created_at,
          }));
        }
      } catch (err) {}
    }

    try {
      const stored = localStorage.getItem('tarqa_role_logs');
      if (stored) {
        const logs: RoleChangeLog[] = JSON.parse(stored);
        const realLogs = logs.filter(l => !['log-001', 'log-002'].includes(l.id));
        localStorage.setItem('tarqa_role_logs', JSON.stringify(realLogs));
        return realLogs;
      }
    } catch {}

    localStorage.setItem('tarqa_role_logs', JSON.stringify(INITIAL_LOGS));
    return INITIAL_LOGS;
  },

  // تعديل رتبة مستخدم (Update Role)
  updateUserRole: async (
    targetUserId: string,
    newRole: UserRole,
    reason?: string
  ): Promise<{ success: boolean; error?: string; updatedUser?: UserWithRole }> => {
    const currentUser = authService.getCurrentUser();
    const isOwner = isOwnerEmail(currentUser?.email);
    const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || isOwner;
    if (!isAdmin) {
      return {
        success: false,
        error: 'عملية مرفوضة: صلاحية تعديل الرتب محصورة فقط بمسؤولي المنصة (Admins).',
      };
    }

    const users = await rolesService.getUsers();
    const targetUser = users.find((u) => u.id === targetUserId);

    if (!targetUser) {
      return { success: false, error: 'لم يتم العثور على المستخدم المطلوب' };
    }

    if (targetUser.role === newRole) {
      return { success: true, updatedUser: targetUser };
    }

    if (newRole === 'super_admin' && !isOwner && currentUser?.role !== 'super_admin') {
      return {
        success: false,
        error: 'منح رتبة السوبر أدمن محصور بمالك المنصة والسوبر أدمن حصراً.',
      };
    }

    // 3. التحديث الفوري في Supabase
    if (isSupabaseConfigured) {
      try {
        let supabaseTargetId: string | null = isValidUuid(targetUserId) ? targetUserId : null;
        let matchedProfile: any = null;
        const cleanTg = (targetUser.telegramUsername || '').replace(/^@/, '').trim();

        if (supabaseTargetId) {
          const { data: p } = await supabase.from('profiles').select('id, email, telegram_username').eq('id', supabaseTargetId).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (!matchedProfile && targetUser.email && !targetUser.email.includes('@telegram.tarqa') && !targetUser.email.includes('@user.tarqa')) {
          const { data: p } = await supabase.from('profiles').select('id, email, telegram_username').eq('email', targetUser.email.toLowerCase()).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (!matchedProfile && targetUser.telegramId) {
          const { data: p } = await supabase.from('profiles').select('id, email, telegram_username').eq('telegram_id', targetUser.telegramId).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (!matchedProfile && cleanTg) {
          const { data: p } = await supabase.from('profiles').select('id, email, telegram_username').or(`telegram_username.eq.${cleanTg},telegram_username.eq.@${cleanTg},telegram_username.ilike.%${cleanTg}%`).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (matchedProfile?.id && isValidUuid(matchedProfile.id)) {
          supabaseTargetId = matchedProfile.id;
        }

        if (supabaseTargetId) {
          try {
            await supabase.rpc('admin_update_user_role', {
              target_user_id: supabaseTargetId,
              new_role: newRole,
              reason: reason || null,
            });
          } catch {}

          try {
            await supabase
              .from('profiles')
              .update({ role: newRole, updated_at: new Date().toISOString() })
              .eq('id', supabaseTargetId);
          } catch {}
        }

        const emailToUpdate = matchedProfile?.email || (targetUser.email && !targetUser.email.includes('@telegram.tarqa') ? targetUser.email : null);
        if (emailToUpdate) {
          try {
            await supabase
              .from('profiles')
              .update({ role: newRole, updated_at: new Date().toISOString() })
              .eq('email', emailToUpdate.toLowerCase());
          } catch {}
        }
      } catch (err: any) {
        console.warn('Supabase role update note:', err?.message || err);
      }
    }

    // 4. تحديث الحالة المحلية في كافة جداول ومخازن المتصفح
    const normalizedTargetEmail = targetUser.email?.toLowerCase().trim();

    const updatedUsers = users.map((u) => {
      if (u.id === targetUserId || (normalizedTargetEmail && u.email?.toLowerCase().trim() === normalizedTargetEmail)) {
        return { ...u, role: newRole };
      }
      return u;
    });
    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedUsers));

    try {
      const regRaw = localStorage.getItem('tarqa_registered_users');
      if (regRaw) {
        const regList = JSON.parse(regRaw);
        const updatedReg = regList.map((ru: any) => {
          if (ru.id === targetUserId || (normalizedTargetEmail && ru.email?.toLowerCase().trim() === normalizedTargetEmail)) {
            return { ...ru, role: newRole };
          }
          return ru;
        });
        localStorage.setItem('tarqa_registered_users', JSON.stringify(updatedReg));
      }
    } catch {}

    try {
      const curRaw = localStorage.getItem('tarqa_current_user');
      if (curRaw) {
        const cur = JSON.parse(curRaw);
        if (cur.id === targetUserId || (normalizedTargetEmail && cur.email?.toLowerCase().trim() === normalizedTargetEmail)) {
          cur.role = newRole;
          localStorage.setItem('tarqa_current_user', JSON.stringify(cur));
          window.dispatchEvent(new Event('tarqa_user_changed'));
        }
      }
    } catch {}

    if (currentUser && (currentUser.id === targetUserId || (normalizedTargetEmail && currentUser.email?.toLowerCase().trim() === normalizedTargetEmail))) {
      authService.switchRole(newRole);
    }

    // 5. تسجيل العملية في سجل التدقيق
    const newLog: RoleChangeLog = {
      id: 'log-' + Date.now(),
      adminId: currentUser?.id || 'usr-admin-01',
      adminName: currentUser?.fullName || 'مسؤول المنصة',
      targetUserId: targetUser.id,
      targetUserName: targetUser.fullName,
      oldRole: targetUser.role,
      newRole,
      reason: reason || 'تعديل الصلاحية عبر لوحة إدارة المنصة',
      createdAt: new Date().toISOString(),
    };

    const currentLogs = await rolesService.getAuditLogs();
    const updatedLogs = [newLog, ...currentLogs];
    localStorage.setItem('tarqa_role_logs', JSON.stringify(updatedLogs));

    invalidateUsersCache();
    window.dispatchEvent(new Event('tarqa_roles_changed'));
    window.dispatchEvent(new Event('tarqa_user_changed'));

    return {
      success: true,
      updatedUser: { ...targetUser, role: newRole },
    };
  },

  // حظر أو فك حظر حساب (Ban / Unban User)
  banUser: async (
    targetUserId: string,
    isBanned: boolean,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const currentUser = authService.getCurrentUser();
    const isOwner = isOwnerEmail(currentUser?.email);
    const isSuperAdmin = currentUser?.role === 'super_admin' || isOwner;

    if (!isSuperAdmin) {
      return { success: false, error: 'غير مصرح: صلاحية حظر الحسابات محصورة برتبة السوبر أدمن (Super Admin) فقط.' };
    }

    if (currentUser?.id === targetUserId) {
      return { success: false, error: 'لا يمكنك حظر حسابك الخاص!' };
    }

    const users = await rolesService.getUsers();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, error: 'لم يتم العثور على المستخدم المطلوب' };
    }

    if (isOwnerEmail(target.email) || target.role === 'super_admin') {
      return { success: false, error: 'خطأ أمني: لا يمكن حظر حساب السوبر أدمن الرئيسي للمنصة.' };
    }

    // 1. تحديث Supabase
    if (isSupabaseConfigured) {
      try {
        let supabaseTargetId: string | null = isValidUuid(targetUserId) ? targetUserId : null;
        let matchedProfile: any = null;
        const cleanTg = (target.telegramUsername || '').replace(/^@/, '').trim();

        if (supabaseTargetId) {
          const { data: p } = await supabase.from('profiles').select('id, email').eq('id', supabaseTargetId).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (!matchedProfile && target.email && !target.email.includes('@telegram.tarqa')) {
          const { data: p } = await supabase.from('profiles').select('id, email').eq('email', target.email.toLowerCase()).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (matchedProfile?.id && isValidUuid(matchedProfile.id)) {
          supabaseTargetId = matchedProfile.id;
        }

        if (supabaseTargetId) {
          try {
            await supabase
              .from('profiles')
              .update({
                is_banned: isBanned,
                ban_reason: isBanned ? (reason || 'مخالفة سياسة واستخدام المنصة') : null,
                banned_at: isBanned ? new Date().toISOString() : null,
              })
              .eq('id', supabaseTargetId);
          } catch {}
        }

        const emailToBan = matchedProfile?.email || (target.email && !target.email.includes('@telegram.tarqa') ? target.email : null);
        if (emailToBan) {
          try {
            await supabase
              .from('profiles')
              .update({
                is_banned: isBanned,
                ban_reason: isBanned ? (reason || 'مخالفة سياسة واستخدام المنصة') : null,
                banned_at: isBanned ? new Date().toISOString() : null,
              })
              .eq('email', emailToBan.toLowerCase());
          } catch {}
        }
      } catch (err) {
        console.warn('Supabase ban update note:', err);
      }
    }

    // 2. تحديث الحالة المحلية
    const updatedUsers = users.map((u) => {
      if (u.id === targetUserId) {
        return {
          ...u,
          isBanned,
          banReason: isBanned ? (reason || 'مخالفة سياسة واستخدام المنصة') : undefined,
          bannedAt: isBanned ? new Date().toISOString() : undefined,
        };
      }
      return u;
    });
    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedUsers));

    try {
      const reg = localStorage.getItem('tarqa_registered_users');
      if (reg) {
        const regList = JSON.parse(reg).map((u: any) => {
          if (u.id === targetUserId || (u.email && target.email && u.email.toLowerCase() === target.email.toLowerCase())) {
            return {
              ...u,
              isBanned,
              banReason: isBanned ? (reason || 'مخالفة سياسة واستخدام المنصة') : undefined,
            };
          }
          return u;
        });
        localStorage.setItem('tarqa_registered_users', JSON.stringify(regList));
      }
    } catch {}

    invalidateUsersCache();
    window.dispatchEvent(new Event('tarqa_roles_changed'));
    return { success: true };
  },

  // مسح حساب مستخدم نهائياً (Delete User)
  deleteUser: async (targetUserId: string): Promise<{ success: boolean; error?: string }> => {
    const currentUser = authService.getCurrentUser();
    const isOwner = isOwnerEmail(currentUser?.email);
    const isSuperAdmin = currentUser?.role === 'super_admin' || isOwner;

    if (!isSuperAdmin) {
      return { success: false, error: 'غير مصرح: صلاحية مسح الحسابات محصورة برتبة السوبر أدمن (Super Admin) فقط.' };
    }

    if (currentUser?.id === targetUserId) {
      return { success: false, error: 'لا يمكنك مسح حسابك وأنت مسجل دخول به!' };
    }

    const users = await rolesService.getUsers();
    const target = users.find((u) => u.id === targetUserId);
    if (!target) {
      return { success: false, error: 'لم يتم العثور على المستخدم' };
    }

    if (isOwnerEmail(target.email) || target.role === 'super_admin') {
      return { success: false, error: 'خطأ أمني: لا يمكن مسح حساب السوبر أدمن الرئيسي للمنصة.' };
    }

    // 1. تسجيل المستخدم في القائمة السوداء للحسابات المحذوفة لمنع ظهوره نهائياً
    markUserAsDeleted([
      target.id,
      target.email,
      target.telegramUsername,
      target.telegramId,
      targetUserId,
    ]);

    // 2. الحذف والتنظيف من Supabase
    if (isSupabaseConfigured) {
      try {
        let supabaseTargetId: string | null = isValidUuid(targetUserId) ? targetUserId : null;
        let matchedProfile: any = null;
        const cleanTg = (target.telegramUsername || '').replace(/^@/, '').trim();

        if (supabaseTargetId) {
          const { data: p } = await supabase.from('profiles').select('id, email').eq('id', supabaseTargetId).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (!matchedProfile && target.email && !target.email.includes('@telegram.tarqa')) {
          const { data: p } = await supabase.from('profiles').select('id, email').eq('email', target.email.toLowerCase()).maybeSingle();
          if (p) matchedProfile = p;
        }

        if (matchedProfile?.id && isValidUuid(matchedProfile.id)) {
          supabaseTargetId = matchedProfile.id;
        }

        if (supabaseTargetId) {
          try {
            await supabase.rpc('admin_delete_user', { target_user_id: supabaseTargetId });
          } catch {}

          try {
            await supabase.from('profiles').delete().eq('id', supabaseTargetId);
          } catch {}

          // إذا كان الحذف محجوباً بسياسات RLS، نقوم بوسم الحساب كحساب محذوف ومحظور
          try {
            await supabase
              .from('profiles')
              .update({
                is_deleted: true,
                is_banned: true,
                ban_reason: '[تم مسح الحساب نهائياً بواسطة الإدارة]',
                email: `deleted_${Date.now()}@tarqa.app`,
                full_name: '[حساب محذوف]',
              } as any)
              .eq('id', supabaseTargetId);
          } catch {}
        }

        const emailToDelete = matchedProfile?.email || (target.email && !target.email.includes('@telegram.tarqa') ? target.email : null);
        if (emailToDelete) {
          try {
            await supabase.from('profiles').delete().eq('email', emailToDelete.toLowerCase());
          } catch {}
        }

        if (cleanTg) {
          try {
            await supabase.from('profiles').delete().or(`telegram_username.eq.${cleanTg},telegram_username.eq.@${cleanTg}`);
          } catch {}
        }
      } catch (err) {
        console.warn('Supabase user delete note:', err);
      }
    }

    // 3. الحذف الصارم من التخزين المحلي في كافة المخازن
    const updatedUsers = users.filter(
      (u) =>
        u.id !== targetUserId &&
        (!target.email || u.email?.toLowerCase() !== target.email?.toLowerCase())
    );
    localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updatedUsers));

    try {
      const reg = localStorage.getItem('tarqa_registered_users');
      if (reg) {
        const regList = JSON.parse(reg).filter(
          (u: any) =>
            u.id !== targetUserId &&
            (!target.email || u.email?.toLowerCase() !== target.email?.toLowerCase())
        );
        localStorage.setItem('tarqa_registered_users', JSON.stringify(regList));
      }
    } catch {}

    // تنظيف اشتراكاته وسجلات تحميلاته
    try {
      const rawSubs = localStorage.getItem('tarqa_subscriptions');
      if (rawSubs) {
        const subs = JSON.parse(rawSubs);
        delete subs[targetUserId];
        delete subs[target.id];
        if (target.email) delete subs[target.email.toLowerCase().trim()];
        localStorage.setItem('tarqa_subscriptions', JSON.stringify(subs));
      }
    } catch {}

    try {
      await downloadTrackingService.clearUserDownloads(target.id, target.email);
    } catch {}

    // إطلاق أحداث التحديث الفوري
    invalidateUsersCache();
    window.dispatchEvent(new Event('tarqa_roles_changed'));
    window.dispatchEvent(new Event('tarqa_user_changed'));
    window.dispatchEvent(new Event('storage'));

    return { success: true };
  },

  // إلغاء اشتراك المستخدم
  cancelSubscription: async (
    userId: string,
    userEmail?: string,
    telegramUsername?: string,
    telegramId?: number
  ) => {
    const res = await cancelAnnualSubscription(userId, userEmail, telegramUsername, telegramId);
    dbCache.invalidate('db_users_with_roles');
    invalidateUsersCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_subscription_changed'));
      window.dispatchEvent(new Event('tarqa:subscription_updated'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      window.dispatchEvent(new Event('storage'));
    }
    return res;
  },

  // منح أو تفعيل اشتراك لمستخدم
  grantSubscription: async (
    targetUser: { id: string; email?: string; fullName?: string; telegramUsername?: string; telegramId?: number },
    days: number = 365
  ) => {
    const res = await grantAnnualSubscription(targetUser, days);
    dbCache.invalidate('db_users_with_roles');
    invalidateUsersCache();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_subscription_changed'));
      window.dispatchEvent(new Event('tarqa:subscription_updated'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      window.dispatchEvent(new Event('storage'));
    }
    return res;
  },

  // جلب كافة الطلاب المشتركين والمفعلين حالياً
  getActiveSubscribers: async (forceRefresh: boolean = false): Promise<UserWithRole[]> => {
    const allUsers = await rolesService.getUsers(forceRefresh);
    return allUsers.filter(u => u.isSubscribed && u.role !== 'super_admin' && !isOwnerEmail(u.email));
  },

  // مزامنة وتحديث شامل وفوري لكافة بيانات الطلاب والاشتراكات والتحميلات
  deepSyncAllStudentsData: async (): Promise<{ total: number; subscribed: number; downloaded: number }> => {
    // 1. تفريغ كاش المستخدمين لضمان عدم عودة أي بيانات قديمة
    dbCache.invalidate('db_users_with_roles');
    invalidateUsersCache();

    // 2. سحب أحدث بيانات الاشتراكات وتحميلات الملفات من السحابة المركزية و Supabase
    try {
      await Promise.allSettled([
        syncSubscriptionsFromCloud(),
        downloadTrackingService.syncDownloadsFromCloud(),
      ]);
    } catch (err) {
      console.warn('[rolesService.deepSyncAllStudentsData] Notice during cloud sync:', err);
    }

    // 3. إعادة بناء وتوحيد قائمة الطلاب بالكامل بناء على البيانات الطازجة
    const freshUsers = await rolesService.getUsers(true);

    // 4. إطلاق كافة أحداث التحديث للنظام والمتصفح
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('tarqa_roles_changed'));
      window.dispatchEvent(new Event('tarqa_subscription_changed'));
      window.dispatchEvent(new Event('tarqa:subscription_updated'));
      window.dispatchEvent(new Event('tarqa_download_tracked'));
      window.dispatchEvent(new Event('tarqa_user_changed'));
      window.dispatchEvent(new Event('storage'));
    }

    const subscribedCount = freshUsers.filter(u => u.isSubscribed && u.role !== 'super_admin' && !isOwnerEmail(u.email)).length;
    const downloadedCount = freshUsers.filter(u => Boolean(u.hasDownloadedFiles)).length;

    return {
      total: freshUsers.length,
      subscribed: subscribedCount,
      downloaded: downloadedCount,
    };
  },
};
