/**
 * نظام النقاط ولوحة الأبطال (Tarqa Points & Leaderboard Service)
 * يدير نقاط الخبرة (XP)، مستويات ورتب الطلاب، وتصنيف المتصدرين بدقة ومزامنة مع قاعدة البيانات الحقيقية.
 */

import { TarqaUser, supabase, isSupabaseConfigured } from './supabase';
import { rolesService } from './rolesService';
import { UserWithRole } from '../types';
import { CLOUD_LECTURES_STORE_ID } from './subscriptionService';

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

const STORAGE_POINTS_KEY = 'tarqa_student_points_v1';
const STORAGE_HISTORY_KEY = 'tarqa_student_points_history_v1';
const STORAGE_USERS_POINTS_MAP = 'tarqa_users_points_map_v1';

export const RANK_LEVELS: StudentRankLevel[] = [
  { level: 1, title: 'المستوى الأول', badge: '🥉', minPoints: 0, maxPoints: 250, color: 'slate' },
  { level: 2, title: 'فارس التأسيس', badge: '🥈', minPoints: 250, maxPoints: 600, color: 'blue' },
  { level: 3, title: 'محترف الخرائط الذهنية', badge: '🥇', minPoints: 600, maxPoints: 1200, color: 'amber' },
  { level: 4, title: 'خبير تكنيكات طرقع', badge: '💎', minPoints: 1200, maxPoints: 2500, color: 'cyan' },
  { level: 5, title: 'أسطورة الـ 100 الذهبية', badge: '👑', minPoints: 2500, maxPoints: 100000, color: 'yellow' },
];

export function getRankLevel(points: number): StudentRankLevel {
  for (let i = RANK_LEVELS.length - 1; i >= 0; i--) {
    if (points >= RANK_LEVELS[i].minPoints) {
      return RANK_LEVELS[i];
    }
  }
  return RANK_LEVELS[0];
}

class PointsService {
  constructor() {
    // تصفير النقاط التلقائي الشامل لجميع المستخدمين لتبدأ الحسابات من 0 XP
    if (typeof window !== 'undefined') {
      try {
        const resetKey = 'tarqa_points_clean_zero_v4';
        if (!localStorage.getItem(resetKey)) {
          localStorage.setItem(STORAGE_POINTS_KEY, '0');
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify([]));
          localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify({}));
          localStorage.setItem(resetKey, 'true');
        }
      } catch {}
    }
  }

  /**
   * مزامنة خريطة النقاط مع السحابة المركزية
   */
  public async syncPointsFromCloud(): Promise<Record<string, number>> {
    if (!isSupabaseConfigured || !supabase) {
      return this.getUsersPointsMap();
    }

    try {
      const { data: storeData } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      let cloudMap: Record<string, number> = {};
      if (storeData?.ban_reason) {
        try {
          const parsed = JSON.parse(storeData.ban_reason);
          if (parsed.pointsMap && typeof parsed.pointsMap === 'object') {
            cloudMap = parsed.pointsMap;
          }
        } catch {}
      }

      const localMap = this.getUsersPointsMap();
      const mergedMap: Record<string, number> = { ...cloudMap };
      for (const [k, v] of Object.entries(localMap)) {
        if (mergedMap[k] === undefined || (v !== undefined && v > (mergedMap[k] || 0))) {
          mergedMap[k] = v;
        }
      }

      localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify(mergedMap));
      return mergedMap;
    } catch {
      return this.getUsersPointsMap();
    }
  }

  /**
   * حفظ خريطة النقاط إلى السحابة المركزية
   */
  private async syncPointsToCloud(pointsMap: Record<string, number>): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;

    try {
      const { data: storeData } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      let currentPayload: any = {};
      if (storeData?.ban_reason) {
        try {
          currentPayload = JSON.parse(storeData.ban_reason);
        } catch {}
      }

      const newPayload = {
        ...currentPayload,
        pointsMap,
        updatedAt: new Date().toISOString(),
      };

      await supabase
        .from('profiles')
        .update({
          ban_reason: JSON.stringify(newPayload),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', CLOUD_LECTURES_STORE_ID);
    } catch (e) {
      console.warn('syncPointsToCloud failed:', e);
    }
  }

  /**
   * قراءة خريطة نقاط جميع الأعضاء المسجلين
   */
  public getUsersPointsMap(): Record<string, number> {
    try {
      const stored = localStorage.getItem(STORAGE_USERS_POINTS_MAP);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return {};
  }

  /**
   * حفظ نقطة مستخدم في الخريطة
   */
  private saveUserPointToMap(userId: string, points: number) {
    if (!userId) return;
    try {
      const map = this.getUsersPointsMap();
      map[userId] = points;
      localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify(map));
      this.syncPointsToCloud(map);
    } catch {}
  }

  /**
   * جلب رصيد نقاط الطالب الحالي (يبدأ من 0 دائماً)
   */
  public getUserPoints(): number {
    try {
      const stored = localStorage.getItem(STORAGE_POINTS_KEY);
      if (stored !== null) {
        const val = parseInt(stored, 10);
        return isNaN(val) ? 0 : Math.max(0, val);
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * تصفير النقاط للمستخدم الحالي والبدء من الصفر
   */
  public resetPointsToZero(currentUser?: TarqaUser | null): void {
    try {
      localStorage.setItem(STORAGE_POINTS_KEY, '0');
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify([]));
      
      const map = this.getUsersPointsMap();
      if (currentUser?.id) {
        map[currentUser.id] = 0;
      }
      if (currentUser?.email) {
        map[currentUser.email.toLowerCase().trim()] = 0;
      }
      localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify(map));
      this.syncPointsToCloud(map);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_points_updated', {
          detail: { points: 0, added: 0, reason: 'تصفير النقاط' }
        }));
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Failed to reset points:', e);
    }
  }

  /**
   * تصفير نقاط مستخدم محدد (مخصص للمشرفين من لوحة التحكم)
   */
  public resetUserPoints(userId: string, email?: string): void {
    try {
      const map = this.getUsersPointsMap();
      if (userId) {
        map[userId] = 0;
      }
      if (email) {
        const em = email.toLowerCase().trim();
        map[em] = 0;
      }
      localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify(map));
      this.syncPointsToCloud(map);

      // إذا كان المستخدم هو المستخدم المسجل حالياً في المتصفح
      const currentRaw = localStorage.getItem('tarqa_current_user');
      if (currentRaw) {
        const parsed = JSON.parse(currentRaw);
        if (parsed.id === userId || (email && parsed.email?.toLowerCase().trim() === email.toLowerCase().trim())) {
          localStorage.setItem(STORAGE_POINTS_KEY, '0');
          localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify([]));
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_points_updated', {
          detail: { points: 0, added: 0, reason: 'تصفير نقاط الطالب' }
        }));
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Failed to reset user points:', e);
    }
  }

  /**
   * تصفير شامل لجميع نقاط الطلاب في المنصة
   */
  public resetAllUsersPoints(): void {
    try {
      localStorage.setItem(STORAGE_POINTS_KEY, '0');
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify([]));
      localStorage.setItem(STORAGE_USERS_POINTS_MAP, JSON.stringify({}));
      this.syncPointsToCloud({});

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tarqa_points_updated', {
          detail: { points: 0, added: 0, reason: 'تصفير شامل للنقاط' }
        }));
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Failed to reset all points:', e);
    }
  }

  /**
   * جلب سجل معاملات النقاط
   */
  public getPointsHistory(): PointTransaction[] {
    try {
      const stored = localStorage.getItem(STORAGE_HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * إضافة نقاط للطالب وتسجيل المعاملة ومزامنتها محلياً وسحابياً
   */
  public addPoints(amount: number, reason: string, category: PointTransaction['category'] = 'bonus', currentUser?: TarqaUser | null): number {
    if (amount <= 0) return this.getUserPoints();

    const current = this.getUserPoints();
    const newTotal = current + amount;
    
    try {
      localStorage.setItem(STORAGE_POINTS_KEY, String(newTotal));
      
      if (currentUser?.id) {
        this.saveUserPointToMap(currentUser.id, newTotal);
      }
      if (currentUser?.email) {
        this.saveUserPointToMap(currentUser.email.toLowerCase(), newTotal);
      }

      const history = this.getPointsHistory();
      const newTx: PointTransaction = {
        id: 'tx-' + Date.now(),
        amount,
        reason,
        timestamp: new Date().toISOString(),
        category,
      };
      const updatedHistory = [newTx, ...history].slice(0, 50);
      localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(updatedHistory));

      // محاولة المزامنة مع Supabase إذا توفر حقل النقاط في جدول profiles
      if (isSupabaseConfigured && currentUser?.id) {
        Promise.resolve(
          supabase
            .from('profiles')
            .update({ target_score: currentUser.targetScore || 100 })
            .eq('id', currentUser.id)
        ).catch(() => {});
      }

      window.dispatchEvent(new CustomEvent('tarqa_points_updated', {
        detail: { points: newTotal, added: amount, reason, transaction: newTx }
      }));
    } catch (e) {
      console.error('Failed to add points', e);
    }

    return newTotal;
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
  public async fetchLeaderboard(currentUser: TarqaUser | null, period: 'weekly' | 'monthly' | 'all_time' = 'all_time'): Promise<LeaderboardEntry[]> {
    try {
      await this.syncPointsFromCloud();
    } catch {}

    let rawUsers: UserWithRole[] = [];
    try {
      rawUsers = await rolesService.getUsers();
    } catch (err) {
      console.warn('Could not fetch users from rolesService:', err);
    }

    return this.buildLeaderboardFromUsers(rawUsers, currentUser, period);
  }

  /**
   * جلب قائمة المتصدرين بشكل متزامن فوري باستخدام الأعضاء المخزنين محلياً
   */
  public getLeaderboard(currentUser: TarqaUser | null, period: 'weekly' | 'monthly' | 'all_time' = 'all_time'): LeaderboardEntry[] {
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
   * بناء وتنسيق قائمة المتصدرين من الأعضاء الحقيقيين فقط مع بدء الجميع من 0 نقاط
   */
  private buildLeaderboardFromUsers(usersList: UserWithRole[], currentUser: TarqaUser | null, period: 'weekly' | 'monthly' | 'all_time'): LeaderboardEntry[] {
    const userPoints = currentUser ? this.getUserPoints() : 0;
    const pointsMap = this.getUsersPointsMap();
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

    // 1. معالجة كافة الأعضاء الحقيقيين المسجلين في قاعدة البيانات أولاً (مع استبعاد المحظورين تماماً)
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
        : (pointsMap[u.id] || (u.email ? pointsMap[u.email.toLowerCase()] : 0) || 0);

      const memberLevel = getRankLevel(memberPts);

      const entry: LeaderboardEntry = {
        id: u.id,
        rank: 0,
        name: u.fullName || (u.email ? u.email.split('@')[0] : 'طالب طرقع'),
        email: u.email,
        avatarIcon: u.role === 'super_admin' ? '👑' : u.role === 'admin' ? '🛡️' : u.role === 'teacher' ? '🎓' : '🌟',
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

    // 2. إذا كان المستخدم مسجلاً وغير محظور ولم يكن موجوداً في القائمة المجلوبة بعد، نضيف حسابه الحقيقي فقط
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

    // استخراج القائمة الفريدة للأعضاء
    const list = Array.from(entriesMap.values());

    // تعديل النقاط بحسب الفترة إن تم تطبيق فلاتر
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

    // الترتيب تنازلياً حسب النقاط، ثم حسب الأقدمية/الاسم
    formatted.sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name, 'ar');
    });

    // تعيين الرتب والأرقام الترتيبية
    return formatted.map((e, idx) => ({
      ...e,
      rank: idx + 1,
    }));
  }
}

export const pointsService = new PointsService();
