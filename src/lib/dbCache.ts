/**
 * ============================================================================
 * منصة طرقع - نظام التخزين المؤقت المتقدم لقاعدة البيانات (Database Caching Engine)
 * ============================================================================
 * يوفر هذا النظام:
 * 1. L1 Memory Cache (ذاكرة وصول عشوائي سريعة جداً < 0.1ms).
 * 2. L2 Persistent Cache (تخزين مستمر في IndexedDB مع تراجع آمن لـ LocalStorage).
 * 3. نمط Stale-While-Revalidate (SWR) لتحميل فوري وتحديث سلس في الخلفية.
 * 4. إدارة انتهاء الصلاحية بـ TTL (Time-To-Live) مخصص لكل نوع بيانات.
 * 5. إبطال الكاش عبر الوسوم (Tag-Based Invalidation) للأسئلة، الدورات، والمستخدمين.
 * 6. إحصائيات ومؤشرات فورية لمعدل إصابة الكاش (Hit Ratio) واستهلاك الذاكرة.
 */

export type CacheTag = 
  | 'questions' 
  | 'courses' 
  | 'lectures' 
  | 'users' 
  | 'quizzes' 
  | 'subscriptions' 
  | 'points' 
  | 'analytics' 
  | 'system';

export interface CacheEntry<T = any> {
  key: string;
  data: T;
  tag: CacheTag;
  timestamp: number;
  expiresAt: number;
  version: number;
}

export interface CacheOptions {
  ttlMs?: number;           // مدة بقاء البيانات بالمللي ثانية (الافتراضي 15 دقيقة)
  tag?: CacheTag;           // تصنيف البيانات لتسهيل الإبطال الجماعي
  persist?: boolean;        // حفظ مستمر في L2 (الافتراضي true)
  forceRefresh?: boolean;   // تجاوز الكاش وجلب بيانات جديدة
  backgroundRevalidate?: boolean; // تفعيل SWR لجلب التحديث في الخلفية
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRatio: number;
  itemCount: number;
  estimatedMemoryKb: number;
  tagsCount: Record<string, number>;
}

export type CacheMetrics = CacheStats;

// أوقات الصلاحية الافتراضية لكل نوع بيانات
export const DEFAULT_TTL = {
  SHORT: 2 * 60 * 1000,          // دقيقتان (للمستخدمين والجلسات اللحظية)
  MEDIUM: 15 * 60 * 1000,        // 15 دقيقة (لبنك الأسئلة والاختبارات)
  LONG: 60 * 60 * 1000,          // ساعة واحدة (للدورات والمحاضرات الثابتة)
  EXTENDED: 24 * 60 * 60 * 1000, // 24 ساعة (للإعدادات والبيانات المرجعية)
};

const L2_STORAGE_PREFIX = 'tarqa_db_cache_';
const METRICS_STORAGE_KEY = 'tarqa_cache_metrics';

class DatabaseCacheEngine {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private hits: number = 0;
  private misses: number = 0;
  private pendingFetches: Map<string, Promise<any>> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.init();
  }

  getMetrics(): CacheMetrics {
    return this.getStats();
  }

  private init() {
    if (typeof window === 'undefined') return;
    try {
      const storedMetrics = localStorage.getItem(METRICS_STORAGE_KEY);
      if (storedMetrics) {
        const parsed = JSON.parse(storedMetrics);
        this.hits = parsed.hits || 0;
        this.misses = parsed.misses || 0;
      }
    } catch {}

    // تنظيف الكاش المنتهي الصلاحية دورياً كل 5 دقائق
    if (typeof window !== 'undefined' && typeof window.setInterval !== 'undefined') {
      window.setInterval(() => this.purgeExpired(), 5 * 60 * 1000);
    }
    this.isInitialized = true;
  }

  /**
   * حفظ بيانات في الكاش (L1 Memory + L2 Persistence)
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    if (!key) return;

    const ttl = options?.ttlMs ?? DEFAULT_TTL.MEDIUM;
    const tag = options?.tag ?? 'system';
    const persist = options?.persist ?? true;
    const now = Date.now();

    const entry: CacheEntry<T> = {
      key,
      data,
      tag,
      timestamp: now,
      expiresAt: now + ttl,
      version: 1,
    };

    // 1. حفظ في ذاكرة الوصول العشوائي (L1 Memory)
    this.memoryCache.set(key, entry);

    // 2. حفظ في التخزين المستمر (L2 LocalStorage / Cache Storage)
    if (persist && typeof window !== 'undefined') {
      try {
        localStorage.setItem(`${L2_STORAGE_PREFIX}${key}`, JSON.stringify(entry));
      } catch (e) {
        // إذا امتلأ التخزين، نقوم بتفريغ العناصر المنتهية ونعيد المحاولة
        this.purgeExpired();
        try {
          localStorage.setItem(`${L2_STORAGE_PREFIX}${key}`, JSON.stringify(entry));
        } catch {}
      }
    }

    this.notifySubscribers('set', key, tag);
  }

  /**
   * استرجاع بيانات من الكاش
   */
  get<T>(key: string): T | null {
    if (!key) return null;
    const now = Date.now();

    // 1. محاولة جلب البيانات من الذاكرة السريعة (L1)
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key)!;
      if (entry.expiresAt > now) {
        this.recordHit();
        return entry.data as T;
      } else {
        // انتهت صلاحية العنصر
        this.memoryCache.delete(key);
      }
    }

    // 2. محاولة جلب البيانات من التخزين المستمر (L2)
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(`${L2_STORAGE_PREFIX}${key}`);
        if (raw) {
          const entry: CacheEntry<T> = JSON.parse(raw);
          if (entry && entry.expiresAt > now) {
            // ترقية العنصر لذاكرة L1 لسرعة الوصول اللاحق
            this.memoryCache.set(key, entry);
            this.recordHit();
            return entry.data;
          } else {
            localStorage.removeItem(`${L2_STORAGE_PREFIX}${key}`);
          }
        }
      } catch {}
    }

    this.recordMiss();
    return null;
  }

  /**
   * جلب البيانات الذكي مع دعم Stale-While-Revalidate (SWR) والـ Deduplication
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    const forceRefresh = options?.forceRefresh ?? false;

    // 1. إذا كان الكاش متاحاً ولم نطلب إجباري التحديث
    if (!forceRefresh) {
      const cached = this.get<T>(key);
      if (cached !== null) {
        // إذا كان خيار إعادة التحقق في الخلفية مفعلاً
        if (options?.backgroundRevalidate) {
          this.revalidateInBackground(key, fetcher, options);
        }
        return cached;
      }
    }

    // 2. منع التكرار اللحظي لنفس الطلب (Request Deduplication)
    if (this.pendingFetches.has(key)) {
      return this.pendingFetches.get(key) as Promise<T>;
    }

    // 3. جلب البيانات الفعلية من المصدر
    const fetchPromise = (async () => {
      try {
        const freshData = await fetcher();
        if (freshData !== undefined && freshData !== null) {
          this.set(key, freshData, options);
        }
        return freshData;
      } finally {
        this.pendingFetches.delete(key);
      }
    })();

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * إعادة جلب البيانات في الخلفية وتحديث الكاش دون تعطيل المستخدم (SWR)
   */
  private async revalidateInBackground<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: CacheOptions
  ) {
    if (this.pendingFetches.has(key)) return;

    try {
      const freshData = await fetcher();
      if (freshData !== undefined && freshData !== null) {
        this.set(key, freshData, options);
      }
    } catch (e) {
      console.warn(`[DBCache] Background revalidation failed for [${key}]:`, e);
    }
  }

  /**
   * إبطال مفتاح معين
   */
  invalidate(key: string): void {
    this.memoryCache.delete(key);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`${L2_STORAGE_PREFIX}${key}`);
      } catch {}
    }
    this.notifySubscribers('invalidate', key);
  }

  /**
   * إبطال جميع البيانات التابعة لوسم معين (Tag-based Invalidation)
   */
  invalidateTag(tag: CacheTag): number {
    let count = 0;

    // 1. تنظيف L1
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.tag === tag) {
        this.memoryCache.delete(key);
        count++;
      }
    }

    // 2. تنظيف L2
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(L2_STORAGE_PREFIX)) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed: CacheEntry = JSON.parse(raw);
                if (parsed.tag === tag) {
                  keysToRemove.push(k);
                }
              } catch {}
            }
          }
        }

        keysToRemove.forEach((k) => {
          localStorage.removeItem(k);
          count++;
        });
      } catch {}
    }

    this.notifySubscribers('invalidate_tag', undefined, tag);
    return count;
  }

  /**
   * مسح وتفريغ كامل الكاش لقاعدة البيانات
   */
  clearAll(): void {
    this.memoryCache.clear();
    this.pendingFetches.clear();
    this.hits = 0;
    this.misses = 0;

    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(L2_STORAGE_PREFIX) || k === METRICS_STORAGE_KEY)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
    }

    this.notifySubscribers('clear');
  }

  clear(): void {
    this.clearAll();
  }

  /**
   * تنظيف السجلات المنتهية الصلاحية
   */
  purgeExpired(): number {
    const now = Date.now();
    let purged = 0;

    // 1. L1
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
        purged++;
      }
    }

    // 2. L2
    if (typeof window !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith(L2_STORAGE_PREFIX)) {
            const raw = localStorage.getItem(k);
            if (raw) {
              try {
                const parsed: CacheEntry = JSON.parse(raw);
                if (parsed && parsed.expiresAt <= now) {
                  keysToRemove.push(k);
                }
              } catch {
                keysToRemove.push(k);
              }
            }
          }
        }
        keysToRemove.forEach((k) => {
          localStorage.removeItem(k);
          purged++;
        });
      } catch {}
    }

    return purged;
  }

  /**
   * إحصائيات الأداء واستهلاك الكاش
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRatio = totalRequests > 0 ? Number(((this.hits / totalRequests) * 100).toFixed(1)) : 100;

    let totalChars = 0;
    const tagsCount: Record<string, number> = {};

    for (const entry of this.memoryCache.values()) {
      tagsCount[entry.tag] = (tagsCount[entry.tag] || 0) + 1;
      try {
        totalChars += JSON.stringify(entry.data).length;
      } catch {}
    }

    return {
      hits: this.hits,
      misses: this.misses,
      hitRatio,
      itemCount: this.memoryCache.size,
      estimatedMemoryKb: Math.round(totalChars / 1024),
      tagsCount,
    };
  }

  private recordHit() {
    this.hits++;
    this.persistMetrics();
  }

  private recordMiss() {
    this.misses++;
    this.persistMetrics();
  }

  private persistMetrics() {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(
        METRICS_STORAGE_KEY,
        JSON.stringify({ hits: this.hits, misses: this.misses })
      );
    } catch {}
  }

  private notifySubscribers(action: string, key?: string, tag?: CacheTag) {
    if (typeof window === 'undefined') return;
    try {
      window.dispatchEvent(
        new CustomEvent('tarqa_db_cache_changed', {
          detail: { action, key, tag, stats: this.getStats() },
        })
      );
    } catch {}
  }
}

// تصدير الكائن المفرد (Singleton) للنظام
export const dbCache = new DatabaseCacheEngine();

// دوال مساعدة سهلة الاستخدام ومباشرة
export const cacheDatabaseQuery = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions
): Promise<T> => {
  return dbCache.getOrFetch<T>(key, fetcher, options);
};

export const invalidateQuestionsCache = () => dbCache.invalidateTag('questions');
export const invalidateCoursesCache = () => {
  dbCache.invalidateTag('courses');
  dbCache.invalidateTag('lectures');
};
export const invalidateUsersCache = () => dbCache.invalidateTag('users');
export const invalidateSubscriptionsCache = () => dbCache.invalidateTag('subscriptions');
export const invalidateCacheByTag = (tag: CacheTag) => dbCache.invalidateTag(tag);
export const clearAllDatabaseCache = () => dbCache.clear();
