/**
 * نظام النقاط ولوحة الأبطال (Tarqa Points & Leaderboard Service)
 * يدير نقاط الخبرة (XP)، مستويات ورتب الطلاب، وتصنيف المتصدرين.
 * النقاط مربوطة 100% بحساب الطالب في قاعدة البيانات (Supabase & Database Backend)
 * ومفصولة تماماً عن كوكيز الجهاز والتخزين المحلي العام.
 */

import { TarqaUser, supabase, isSupabaseConfigured, isValidUuid, authService } from './supabase';
import { rolesService } from './rolesService';
import { UserWithRole } from '../types';
import { invalidateUsersCache } from './dbCache';

export interface PointTransaction {
  id: string;
  amount: number;
  reason: string;
  timestamp: string;
  category: 'streak' | 'lesson' | 'file' | 'pomodoro' | 'task' | 'bonus';
}

export interface StudentRankLevel {
  level: number;
  title: string;
  badge: string;
  minPoints: number;
  maxPoints: number;
  color: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  email?: string;
  avatarIcon: string;
  avatarUrl?: string;
  points: number;
  streak: number;
  level: number;
  levelTitle: string;
  badge: string;
  completedLessons: number;
  city?: string;
  role?: string;
  isCurrentUser?: boolean;
}

export const RANK_LEVELS: StudentRankLevel[] = [
  { level: 1, title: 'المستوى الأول', badge: '🥉', minPoints: 0, maxPoints: 250, color: 'slate' },
  { level: 2, title: 'فارس التأسيس', badge: '🥈', minPoints: 250, maxPoints: 600, color: 'blue' },
  { level: 3, title: 'محترف الخرائط الذهنية', badge: '🥇', minPoints: 600, maxPoints: 1200, color: 'amber' },
  { level: 4, title: 'خبير تكنيكات طرقع', badge: '💎', minPoints: 1200, maxPoints: 2500, color: 'cyan' },
  { level: 5, title: 'أسطورة الـ 100 الذهبية', badge: '👑', minPoints: 2500, maxPoints: 100000, color: 'yellow' },
];

export function getRankLevel(points: number): StudentRankLevel {
  const safePoints = Math.max(0, Number(points) || 0);
  for (let i = RANK_LEVELS.length - 1; i >= 0; i--) {
    if (safePoints >= RANK_LEVELS[i].minPoints) {
      return RANK_LEVELS[i];
    }
  }
  return RANK_LEVELS[0];
}

class PointsService {
  // مفاتيح التخزين المؤقت المحلي المرتبطة فقط بحساب المستخدم (User-Scoped Cache)
  private readonly USER_POINTS_CACHE_PREFIX = 'tarqa_user_points_';
  private readonly USER_HISTORY_CACHE_PREFIX = 'tarqa_user_history_';

  constructor() {
    // تنظيف ملفات الكوكيز والتخزين المحلي القديمة الخاصة بالجهاز (Device Cleanup)
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('tarqa_student_points_v1');
        localStorage.removeItem('tarqa_student_points_history_v1');
        // مسح أي كوكيز قديمة كانت تسمى tarqa_student_points
        if (typeof document !== 'undefined' && document.cookie) {
          document.cookie = 'tarqa_student_points=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0';
        }
      } catch {}
    }
  }

  /**
   * استخراج المعرف الفريد لحساب المستخدم (ID أو البريد الإلكتروني)
   */
  private getUserKey(user?: TarqaUser | { id?: string; email?: string } | null): string | null {
    if (!user) {
      const current = authService.getCurrentUser();
      if (!current) return null;
      user = current;
    }
    if (user.id && user.id.trim()) return user.id.trim();
    if (user.email && user.email.trim()) return user.email.toLowerCase().trim();
    return null;
  }

  /**
   * جلب رصيد نقاط الطالب الحالي بشكل فوري من ذاكرة الحساب المؤقتة (User-Scoped)
   * إذا لم يكن هناك مستخدم مسجل، الرصيد هو 0 دائماً (ممنوع مشاركة نقاط الجهاز).
   */
  public getUserPoints(currentUser?: TarqaUser | null): number {
    const user = currentUser || authService.getCurrentUser();
    if (!user) return 0;

    // 1. إذا كان كائن المستخدم يحمل النقاط بالفعل
    if (typeof user.points === 'number' && !isNaN(user.points)) {
      return Math.max(0, user.points);
    }

    // 2. البحث في التخزين المؤقت المربوط بهذا الحساب تحديداً
    const userKey = this.getUserKey(user);
    if (userKey && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`${this.USER_POINTS_CACHE_PREFIX}${userKey}`);
        if (cached !== null) {
          const val = parseInt(cached, 10);
          return isNaN(val) ? 0 : Math.max(0, val);
        }
      } catch {}
    }

    return 0;
  }

  /**
   * جلب ومزامنة رصيد النقاط الحقيقي من قاعدة البيانات المركزية (Supabase & Database Backend)
   * وتحديث حالة المستخدم في التطبيق فوراً.
   */
  public async fetchUserPoints(currentUser?: TarqaUser | null): Promise<number> {
    const user = currentUser || authService.getCurrentUser();
    if (!user) return 0;

    const userKey = this.getUserKey(user);
    if (!userKey) return 0;

    let dbPoints: number | null = null;
    let dbHistory: PointTransaction[] | null = null;

    // 1. محاولة الجلب من قاعدة بيانات Supabase (جدول profiles)
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('profiles').select('points, points_history');
        if (isValidUuid(user.id)) {
          query = query.eq('id', user.id);
        } else if (user.email) {
          query = query.ilike('email', user.email.toLowerCase().trim());
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          if (typeof data.points === 'number') {
            dbPoints = Math.max(0, data.points);
          } else if (data.points) {
            dbPoints = Math.max(0, parseInt(data.points, 10) || 0);
          }
          if (Array.isArray(data.points_history)) {
            dbHistory = data.points_history;
          }
        }
      } catch (err) {
        console.warn('[pointsService] Supabase points fetch notice:', err);
      }
    }

    // 2. محاولة الجلب من الباك إند المركزي (Vercel API / Hostinger PHP) إذا لم تتوفر في Supabase
    if (dbPoints === null && typeof window !== 'undefined') {
      const endpoints = [
        `/api/points?userId=${encodeURIComponent(user.id || '')}&email=${encodeURIComponent(user.email || '')}`,
        `/api/points.php?userId=${encodeURIComponent(user.id || '')}&email=${encodeURIComponent(user.email || '')}`,
      ];

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, { method: 'GET', headers: { 'Accept': 'application/json' } });
          if (res.ok) {
            const json = await res.json();
            if (json.success && typeof json.points === 'number') {
              dbPoints = Math.max(0, json.points);
              if (Array.isArray(json.history)) dbHistory = json.history;
              break;
            }
          }
        } catch {}
      }
    }

    // إذا تم جلب النقاط بنجاح من قاعدة البيانات، نحدث الذاكرة المربوطة بالحساب
    if (dbPoints !== null) {
      this.setUserCachedPoints(userKey, dbPoints);
      if (dbHistory) {
        this.setUserCachedHistory(userKey, dbHistory);
      }
      this.updateActiveUserSessionPoints(userKey, dbPoints);
      return dbPoints;
    }

    return this.getUserPoints(user);
  }

  /**
   * تحديث رصيد النقاط المؤقت لحساب المستخدم المحدد فقط
   */
  private setUserCachedPoints(userKey: string, points: number): void {
    if (!userKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${this.USER_POINTS_CACHE_PREFIX}${userKey}`, String(Math.max(0, points)));
    } catch {}
  }

  /**
   * تحديث سجل المعاملات المؤقت لحساب المستخدم المحدد فقط
   */
  private setUserCachedHistory(userKey: string, history: PointTransaction[]): void {
    if (!userKey || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${this.USER_HISTORY_CACHE_PREFIX}${userKey}`, JSON.stringify(history.slice(0, 50)));
    } catch {}
  }

  /**
   * تحديث كائن المستخدم النشط في الجلسة المحلية بالنقاط الجديدة
   */
  private updateActiveUserSessionPoints(userKey: string, newPoints: number): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('tarqa_current_user');
      if (raw) {
        const parsed: TarqaUser = JSON.parse(raw);
        const match =
          (parsed.id && parsed.id === userKey) ||
          (parsed.email && parsed.email.toLowerCase().trim() === userKey.toLowerCase().trim());
        if (match) {
          parsed.points = newPoints;
          localStorage.setItem('tarqa_current_user', JSON.stringify(parsed));
          window.dispatchEvent(new Event('tarqa_user_changed'));
        }
      }
    } catch {}
  }

  /**
   * جلب سجل معاملات النقاط لحساب المستخدم الحالي
   */
  public getPointsHistory(currentUser?: TarqaUser | null): PointTransaction[] {
    const user = currentUser || authService.getCurrentUser();
    if (!user) return [];

    const userKey = this.getUserKey(user);
    if (!userKey || typeof window === 'undefined') return [];

    try {
      const stored = localStorage.getItem(`${this.USER_HISTORY_CACHE_PREFIX}${userKey}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  }

  /**
   * إضافة نقاط لحساب الطالب وحفظها مباشرة في قاعدة البيانات المركزية
   */
  public addPoints(
    amount: number,
    reason: string,
    category: PointTransaction['category'] = 'bonus',
    currentUser?: TarqaUser | null
  ): number {
    if (amount <= 0) return this.getUserPoints(currentUser);

    const user = currentUser || authService.getCurrentUser();
    if (!user) {
      console.warn('[pointsService] Cannot add points: No user logged in.');
      return 0;
    }

    const userKey = this.getUserKey(user);
    if (!userKey) return 0;

    const currentPoints = this.getUserPoints(user);
    const newTotal = currentPoints + amount;

    // 1. تحديث الكاش المربوط بالحساب فوراً لسرعة استجابة الواجهة
    this.setUserCachedPoints(userKey, newTotal);
    this.updateActiveUserSessionPoints(userKey, newTotal);

    // 2. تسجيل المعاملة في سجل الحساب
    const history = this.getPointsHistory(user);
    const newTx: PointTransaction = {
      id: 'tx-' + Date.now(),
      amount,
      reason,
      timestamp: new Date().toISOString(),
      category,
    };
    const updatedHistory = [newTx, ...history].slice(0, 50);
    this.setUserCachedHistory(userKey, updatedHistory);

    // 3. إشعار الواجهة بتحديث النقاط للحساب الحالي
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tarqa_points_updated', {
          detail: { points: newTotal, added: amount, reason, userId: user.id, transaction: newTx },
        })
      );
    }

    // 4. الحفظ الدائم في قاعدة بيانات Supabase (جدول profiles)
    if (isSupabaseConfigured && supabase) {
      Promise.resolve().then(async () => {
        try {
          const updatePayload: any = {
            points: newTotal,
            points_history: updatedHistory,
            updated_at: new Date().toISOString(),
          };

          if (isValidUuid(user.id)) {
            const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
            if (error) {
              console.warn('[pointsService] Supabase update profiles.points notice:', error.message);
            }
          } else if (user.email) {
            await supabase
              .from('profiles')
              .update(updatePayload)
              .ilike('email', user.email.toLowerCase().trim());
          }
        } catch (e) {
          console.warn('[pointsService] Supabase points update failed:', e);
        }
      });
    }

    // 5. المزامنة مع خادم الباك إند (Vercel API / Hostinger PHP)
    if (typeof window !== 'undefined') {
      Promise.resolve().then(async () => {
        const payload = {
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName || 'طالب طرقع',
          action: 'add',
          amount,
          reason,
          category,
          points: newTotal,
        };

        try {
          const res = await fetch('/api/points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            await fetch('/api/points.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          }
        } catch {
          try {
            await fetch('/api/points.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
          } catch {}
        }
      });
    }

    invalidateUsersCache();
    return newTotal;
  }

  /**
   * تصفير نقاط الحساب الحالي في قاعدة البيانات
   */
  public async resetPointsToZero(currentUser?: TarqaUser | null): Promise<void> {
    const user = currentUser || authService.getCurrentUser();
    if (!user) return;

    const userKey = this.getUserKey(user);
    if (!userKey) return;

    this.setUserCachedPoints(userKey, 0);
    this.setUserCachedHistory(userKey, []);
    this.updateActiveUserSessionPoints(userKey, 0);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tarqa_points_updated', {
          detail: { points: 0, added: 0, reason: 'تصفير النقاط', userId: user.id },
        })
      );
      window.dispatchEvent(new Event('tarqa_roles_changed'));
    }

    // المزامنة مع Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: any = {
          points: 0,
          points_history: [],
          updated_at: new Date().toISOString(),
        };
        if (isValidUuid(user.id)) {
          await supabase.from('profiles').update(updatePayload).eq('id', user.id);
        } else if (user.email) {
          await supabase
            .from('profiles')
            .update(updatePayload)
            .ilike('email', user.email.toLowerCase().trim());
        }
      } catch (e) {
        console.warn('[pointsService] Reset points Supabase notice:', e);
      }
    }

    // المزامنة مع الباك إند
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, userEmail: user.email, action: 'reset' }),
        });
      } catch {
        try {
          await fetch('/api/points.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id, userEmail: user.email, action: 'reset' }),
          });
        } catch {}
      }
    }

    invalidateUsersCache();
  }

  /**
   * تصفير نقاط مستخدم محدد (مخصص للإدارة من لوحة التحكم) في قاعدة البيانات المركزية
   */
  public async resetUserPoints(userId: string, email?: string): Promise<void> {
    if (!userId && !email) return;

    const userKey = userId || (email ? email.toLowerCase().trim() : '');
    if (userKey) {
      this.setUserCachedPoints(userKey, 0);
      this.setUserCachedHistory(userKey, []);
      this.updateActiveUserSessionPoints(userKey, 0);
    }

    // إذا كان هو المستخدم المسجل حالياً في المتصفح
    const current = authService.getCurrentUser();
    if (
      current &&
      ((userId && current.id === userId) ||
        (email && current.email && current.email.toLowerCase().trim() === email.toLowerCase().trim()))
    ) {
      current.points = 0;
      authService.setCurrentUser(current);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tarqa_points_updated', {
            detail: { points: 0, added: 0, reason: 'تصفير نقاط الطالب' },
          })
        );
      }
    }

    // المزامنة مع Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const updatePayload: any = {
          points: 0,
          points_history: [],
          updated_at: new Date().toISOString(),
        };
        if (isValidUuid(userId)) {
          await supabase.from('profiles').update(updatePayload).eq('id', userId);
        }
        if (email) {
          await supabase
            .from('profiles')
            .update(updatePayload)
            .ilike('email', email.toLowerCase().trim());
        }
      } catch (e) {
        console.warn('[pointsService] resetUserPoints Supabase notice:', e);
      }
    }

    // المزامنة مع الباك إند
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/points', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, userEmail: email, action: 'reset' }),
        });
      } catch {
        try {
          await fetch('/api/points.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, userEmail: email, action: 'reset' }),
          });
        } catch {}
      }
    }

    invalidateUsersCache();
  }

  /**
   * تصفير شامل لجميع نقاط الطلاب في قاعدة البيانات (للسوبر أدمن فقط)
   */
  public async resetAllUsersPoints(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('profiles').update({
          points: 0,
          points_history: [],
          updated_at: new Date().toISOString(),
        } as any).neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (e) {
        console.warn('[pointsService] resetAllUsersPoints Supabase notice:', e);
      }
    }

    const current = authService.getCurrentUser();
    if (current) {
      current.points = 0;
      authService.setCurrentUser(current);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('tarqa_points_updated', {
          detail: { points: 0, added: 0, reason: 'تصفير شامل للنقاط' },
        })
      );
      window.dispatchEvent(new Event('tarqa_roles_changed'));
    }

    invalidateUsersCache();
  }

  /**
   * استخراج عدد الدروس المكتملة للطالب الحالي
   */
  private getCompletedLessonsCount(): number {
    try {
      const cur = localStorage.getItem('tarqa_courses_modules_v1');
      if (cur) {
        const mods = JSON.parse(cur);
        if (Array.isArray(mods)) {
          let count = 0;
          for (const m of mods) {
            if (Array.isArray(m?.lessons)) {
              for (const l of m.lessons) {
                if (l?.isCompleted) count++;
              }
            }
          }
          return count;
        }
      }
    } catch {}
    return 0;
  }

  /**
   * جلب قائمة المتصدرين الحقيقية والمزامنة مع قاعدة بيانات الأعضاء الحقيقيين (Supabase Profiles)
   */
  public async fetchLeaderboard(
    currentUser: TarqaUser | null,
    period: 'weekly' | 'monthly' | 'all_time' = 'all_time'
  ): Promise<LeaderboardEntry[]> {
    if (currentUser) {
      await this.fetchUserPoints(currentUser);
    }

    let rawUsers: UserWithRole[] = [];
    try {
      rawUsers = await rolesService.getUsers(true);
    } catch (err) {
      console.warn('Could not fetch users from rolesService:', err);
    }

    return this.buildLeaderboardFromUsers(rawUsers, currentUser, period);
  }

  /**
   * جلب قائمة المتصدرين بشكل متزامن فوري باستخدام الأعضاء المسجلين
   */
  public getLeaderboard(
    currentUser: TarqaUser | null,
    period: 'weekly' | 'monthly' | 'all_time' = 'all_time'
  ): LeaderboardEntry[] {
    let localUsers: UserWithRole[] = [];
    try {
      const stored = localStorage.getItem('tarqa_all_users_roles');
      if (stored) {
        localUsers = JSON.parse(stored);
      }
    } catch {}

    return this.buildLeaderboardFromUsers(localUsers, currentUser, period);
  }

  /**
   * بناء وتنسيق قائمة المتصدرين من الأعضاء الحقيقيين بناءً على نقاطهم في قاعدة البيانات
   */
  private buildLeaderboardFromUsers(
    usersList: UserWithRole[],
    currentUser: TarqaUser | null,
    period: 'weekly' | 'monthly' | 'all_time'
  ): LeaderboardEntry[] {
    const userPoints = currentUser ? this.getUserPoints(currentUser) : 0;
    const completedCount = currentUser ? this.getCompletedLessonsCount() : 0;

    // قراءة الستريك الحالي للطالب إذا كان مسجل دخول
    let userStreak = 0;
    if (currentUser) {
      try {
        const streakRaw = localStorage.getItem('tarqa_streak_data_v2');
        if (streakRaw) {
          const parsed = JSON.parse(streakRaw);
          userStreak = parsed.currentStreak || 0;
        }
      } catch {}
    }

    const entriesMap = new Map<string, LeaderboardEntry>();

    // 1. معالجة كافة الأعضاء المسجلين في قاعدة البيانات أولاً (مع استبعاد المحظورين)
    for (const u of usersList) {
      if (!u || !u.id || u.isBanned) continue;

      const isThisCurrentUser = Boolean(
        currentUser &&
          !currentUser.isBanned &&
          ((currentUser.id && u.id === currentUser.id) ||
            (currentUser.email && u.email && u.email.toLowerCase() === currentUser.email.toLowerCase()))
      );

      const memberPts = isThisCurrentUser
        ? userPoints
        : (typeof u.points === 'number' ? u.points : 0);

      const memberLevel = getRankLevel(memberPts);

      const entry: LeaderboardEntry = {
        id: u.id,
        rank: 0,
        name: u.fullName || (u.email ? u.email.split('@')[0] : 'طالب طرقع'),
        email: u.email,
        avatarIcon:
          u.role === 'super_admin' ? '👑' : u.role === 'admin' ? '🛡️' : u.role === 'teacher' ? '🎓' : '🌟',
        avatarUrl: u.avatarUrl,
        points: memberPts,
        streak: isThisCurrentUser ? userStreak : 0,
        level: memberLevel.level,
        levelTitle: memberLevel.title,
        badge: memberLevel.badge,
        completedLessons: isThisCurrentUser ? completedCount : Math.floor(memberPts / 100),
        city: 'السعودية',
        role: u.role || 'student',
        isCurrentUser: isThisCurrentUser,
      };

      entriesMap.set(u.id, entry);
    }

    // 2. إذا كان المستخدم مسجلاً وغير محظور ولم يكن موجوداً في القائمة المجلوبة بعد
    if (currentUser && currentUser.id && !currentUser.isBanned && !entriesMap.has(currentUser.id)) {
      const currentUserLevel = getRankLevel(userPoints);
      const currentUserEntry: LeaderboardEntry = {
        id: currentUser.id,
        rank: 0,
        name: currentUser.fullName || (currentUser.email ? currentUser.email.split('@')[0] : 'أنت'),
        email: currentUser.email,
        avatarIcon: '⚡',
        avatarUrl: currentUser.avatarUrl,
        points: userPoints,
        streak: userStreak,
        level: currentUserLevel.level,
        levelTitle: currentUserLevel.title,
        badge: currentUserLevel.badge,
        completedLessons: completedCount,
        city: 'السعودية',
        role: currentUser.role || 'student',
        isCurrentUser: true,
      };
      entriesMap.set(currentUser.id, currentUserEntry);
    }

    const list = Array.from(entriesMap.values());
    const multiplier = period === 'weekly' ? 1.0 : period === 'monthly' ? 1.0 : 1.0;

    const formatted = list.map((item) => {
      const adjustedPoints = Math.round(item.points * multiplier);
      const levelObj = getRankLevel(adjustedPoints);
      return {
        ...item,
        points: adjustedPoints,
        level: levelObj.level,
        levelTitle: levelObj.title,
        badge: levelObj.badge,
      };
    });

    // الترتيب تنازلياً حسب النقاط
    formatted.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name, 'ar');
    });

    return formatted.map((e, idx) => ({
      ...e,
      rank: idx + 1,
    }));
  }
}

export const pointsService = new PointsService();
