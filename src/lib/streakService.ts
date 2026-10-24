/**
 * نظام تتبع الستريك والنشاط اليومي للطالب (Tarqa Daily Streak & Learning Activity)
 * يضمن تتبع أيام الالتزام المتتالية وشعلة الحماس والنشاط الأسبوعي بدقة 100%.
 */

export interface StreakDayItem {
  dayName: string;
  dayShort: string;
  dateStr: string;
  isActive: boolean;
  isToday: boolean;
  isPast: boolean;
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string;
  activeDates: string[];
  todayCompleted: boolean;
  streakFreeze: number;
  weeklyDays: StreakDayItem[];
}

const STORAGE_KEY = 'tarqa_streak_data_v2';

const ARABIC_DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const ARABIC_DAYS_SHORT = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// تحويل التاريخ لصيغة YYYY-MM-DD
function getLocalDateStr(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// حساب الفرق بالأيام بين تاريخين بصيغة YYYY-MM-DD
function getDaysDiff(date1Str: string, date2Str: string): number {
  const d1 = new Date(date1Str + 'T00:00:00');
  const d2 = new Date(date2Str + 'T00:00:00');
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

// بناء أيام الأسبوع الحالي (7 أيام)
function buildWeeklyDays(activeDatesSet: Set<string>): StreakDayItem[] {
  const today = new Date();
  const todayStr = getLocalDateStr(today);
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  
  // سنعرض الأسبوع من السبت إلى الجمعة (أو آخر 7 أيام)
  const days: StreakDayItem[] = [];
  
  // بناء آخر 7 أيام تنتهي باليوم أو تمتد للأسبوع الحالي
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = getLocalDateStr(d);
    const dayIdx = d.getDay();
    
    days.push({
      dayName: ARABIC_DAYS[dayIdx],
      dayShort: ARABIC_DAYS_SHORT[dayIdx],
      dateStr,
      isActive: activeDatesSet.has(dateStr),
      isToday: dateStr === todayStr,
      isPast: dateStr < todayStr,
    });
  }
  
  return days;
}

class StreakService {
  private getRawData(): {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    activeDates: string[];
    streakFreeze: number;
  } {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
      
      // التوافق مع أي سجلات سابقة للمستخدم
      const legacyAttempts = localStorage.getItem('tarqa_attempts');
      const activeDates: string[] = [];
      if (legacyAttempts) {
        try {
          const parsed = JSON.parse(legacyAttempts);
          if (Array.isArray(parsed)) {
            parsed.forEach((a: any) => {
              if (a.completed_at) {
                const dateStr = a.completed_at.split('T')[0];
                if (dateStr && !activeDates.includes(dateStr)) {
                  activeDates.push(dateStr);
                }
              }
            });
          }
        } catch {}
      }
      
      const todayStr = getLocalDateStr();
      if (!activeDates.includes(todayStr)) {
        activeDates.push(todayStr);
      }
      
      return {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: todayStr,
        activeDates,
        streakFreeze: 1,
      };
    } catch {
      const todayStr = getLocalDateStr();
      return {
        currentStreak: 1,
        longestStreak: 1,
        lastActiveDate: todayStr,
        activeDates: [todayStr],
        streakFreeze: 1,
      };
    }
  }

  private saveRawData(data: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    activeDates: string[];
    streakFreeze: number;
  }) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new CustomEvent('tarqa_streak_updated', { detail: this.getStreakData() }));
    } catch (e) {
      console.error('Failed to save streak data', e);
    }
  }

  /**
   * جلب بيانات الستريك الحالية بعد تدقيق فوارق الأيام
   */
  public getStreakData(): StreakData {
    const raw = this.getRawData();
    const todayStr = getLocalDateStr();
    const activeSet = new Set(raw.activeDates || []);

    let currentStreak = raw.currentStreak || 1;
    let longestStreak = raw.longestStreak || 1;
    const lastActive = raw.lastActiveDate || todayStr;
    const todayCompleted = activeSet.has(todayStr);

    if (lastActive) {
      const diff = getDaysDiff(lastActive, todayStr);
      if (diff > 1 && !todayCompleted) {
        // فات أكثر من يوم كامل دون نشاط
        if (raw.streakFreeze > 0) {
          // استخدام تجميد الستريك التلقائي
          // نحافظ على الستريك
        } else {
          // إعادة ضبط الستريك إلى 0 إذا لم يكن نشطاً اليوم
          currentStreak = 0;
        }
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    const weeklyDays = buildWeeklyDays(activeSet);

    return {
      currentStreak,
      longestStreak,
      totalActiveDays: activeSet.size,
      lastActiveDate: lastActive,
      activeDates: Array.from(activeSet),
      todayCompleted,
      streakFreeze: raw.streakFreeze ?? 1,
      weeklyDays,
    };
  }

  /**
   * تسجيل نشاط اليوم فورياً (دخول الموقع، مشاهدة محاضرة، فتح ملف، إنجاز هدف)
   */
  public recordDailyActivity(actionName: string = 'learning_session'): StreakData {
    const raw = this.getRawData();
    const todayStr = getLocalDateStr();
    const activeSet = new Set(raw.activeDates || []);
    
    const wasAlreadyActiveToday = activeSet.has(todayStr);
    activeSet.add(todayStr);

    let newStreak = raw.currentStreak || 0;
    const lastActive = raw.lastActiveDate;

    if (!wasAlreadyActiveToday) {
      if (!lastActive) {
        newStreak = 1;
      } else {
        const diff = getDaysDiff(lastActive, todayStr);
        if (diff === 1) {
          // يوم متتالي مباشر
          newStreak += 1;
        } else if (diff === 0) {
          newStreak = Math.max(1, newStreak);
        } else {
          // انقطاع أكثر من يوم
          newStreak = 1;
        }
      }
    } else {
      if (newStreak === 0) newStreak = 1;
    }

    const longestStreak = Math.max(raw.longestStreak || 1, newStreak);

    const updated = {
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: todayStr,
      activeDates: Array.from(activeSet),
      streakFreeze: raw.streakFreeze ?? 1,
    };

    this.saveRawData(updated);
    return this.getStreakData();
  }

  /**
   * تفعيل شعلة اليوم بضغطة زر
   */
  public checkInToday(): StreakData {
    return this.recordDailyActivity('manual_check_in');
  }
}

export const streakService = new StreakService();
