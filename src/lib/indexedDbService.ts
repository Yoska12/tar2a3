import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TarqaUser } from './supabase';

export interface AppStateData {
  currentView: 'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles' | 'leaderboard';
  activeTab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles' | 'leaderboard' | 'admin-kashier' | 'admin-security' | 'kashier' | 'security';
  activeModuleId?: string;
  activeLessonId?: string;
  updatedAt: number;
}

export interface StoredQuizAttempt {
  id: string;
  userId?: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentageScore: number;
  totalTimeSeconds: number;
  createdAt: string;
  timestamp: number;
  answers?: any[];
}

interface TarqaDBSchema extends DBSchema {
  users: {
    key: string; // user id
    value: TarqaUser & { password?: string; updatedAt: number };
    indexes: { 'by-email': string };
  };
  current_session: {
    key: string; // 'active_user'
    value: {
      user: TarqaUser;
      token?: string;
      lastActive: number;
    };
  };
  app_state: {
    key: string; // 'navigation_state' or custom keys
    value: any;
  };
  quiz_attempts: {
    key: string; // attempt id
    value: StoredQuizAttempt;
    indexes: { 'by-user': string; 'by-timestamp': number };
  };
  lesson_progress: {
    key: string; // lesson id
    value: {
      lessonId: string;
      isCompleted: boolean;
      completedAt: number;
    };
  };
}

const DB_NAME = 'tarqa_indexeddb_vault';
const DB_VERSION = 1;

let isIdbDisabled = false;
let dbPromise: Promise<IDBPDatabase<TarqaDBSchema> | null> | null = null;

/**
 * فتح وتهيئة قاعدة بيانات IndexedDB مع دعم المعالجة الذاتية والتراجع التلقائي للتخزين المحلي
 */
export const getTarqaDB = async (): Promise<IDBPDatabase<TarqaDBSchema> | null> => {
  if (isIdbDisabled) return null;
  if (typeof window === 'undefined' || !window.indexedDB) {
    isIdbDisabled = true;
    return null;
  }

  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db) return db;
    } catch {
      dbPromise = null;
    }
  }

  const openDatabase = async (allowHealing = true): Promise<IDBPDatabase<TarqaDBSchema> | null> => {
    try {
      const db = await openDB<TarqaDBSchema>(DB_NAME, DB_VERSION, {
        upgrade(db) {
          // 1. متجر بيانات المستخدمين المسجلين
          if (!db.objectStoreNames.contains('users')) {
            const userStore = db.createObjectStore('users', { keyPath: 'id' });
            userStore.createIndex('by-email', 'email', { unique: false });
          }

          // 2. متجر الجلسة النشطة الحالية
          if (!db.objectStoreNames.contains('current_session')) {
            db.createObjectStore('current_session');
          }

          // 3. متجر حالة التطبيق والمسار الحالي (لمنع الرجوع للرئيسية عند الريفرش)
          if (!db.objectStoreNames.contains('app_state')) {
            db.createObjectStore('app_state');
          }

          // 4. متجر نتائج ومحاولات الاختبارات
          if (!db.objectStoreNames.contains('quiz_attempts')) {
            const attemptStore = db.createObjectStore('quiz_attempts', { keyPath: 'id' });
            attemptStore.createIndex('by-user', 'userId', { unique: false });
            attemptStore.createIndex('by-timestamp', 'timestamp', { unique: false });
          }

          // 5. متجر تقدم المحاضرات والدروس
          if (!db.objectStoreNames.contains('lesson_progress')) {
            db.createObjectStore('lesson_progress', { keyPath: 'lessonId' });
          }
        },
        blocked() {
          console.info('[IndexedDB] Upgrade blocked by active tab.');
        },
        blocking(_currentVersion, _blockedVersion, event) {
          try {
            (event?.target as any)?.result?.close?.();
          } catch {}
        },
        terminated() {
          dbPromise = null;
        },
      });

      return db;
    } catch (err: any) {
      console.info('[IndexedDB] Storage engine notification:', err?.name || err?.message || 'internal');

      // إذا واجه المتصفح خطأ قفل أو تلف بالقرص (UnknownError)، نحاول تنظيف المتجر وإعادة فتحه مرة واحدة
      if (allowHealing && typeof window !== 'undefined' && window.indexedDB?.deleteDatabase) {
        try {
          await new Promise<void>((resolve) => {
            try {
              const req = window.indexedDB.deleteDatabase(DB_NAME);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve();
              req.onblocked = () => resolve();
              setTimeout(resolve, 600);
            } catch {
              resolve();
            }
          });
          return await openDatabase(false);
        } catch {}
      }

      // إذا كان المتصفح يمنع IndexedDB (وضع التصفح الخاص الصارم أو منع ملفات التخزين)، التبديل للتخزين المحلي بنعومة
      isIdbDisabled = true;
      dbPromise = null;
      console.info('[IndexedDB] Running in resilient LocalStorage mode.');
      return null;
    }
  };

  dbPromise = openDatabase(true);
  return dbPromise;
};

// =========================================================================
// 1. إدارة جلسة المستخدم الحالي في IndexedDB و LocalStorage
// =========================================================================

/**
 * حفظ جلسة المستخدم الحالي
 */
export const saveCurrentUserToIDB = async (user: TarqaUser): Promise<void> => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tarqa_current_user', JSON.stringify(user));
    }

    const db = await getTarqaDB();
    if (!db) return;

    await db.put('current_session', {
      user,
      lastActive: Date.now(),
    }, 'active_user');

    if (user?.id) {
      await db.put('users', {
        ...user,
        updatedAt: Date.now(),
      });
    }
  } catch {}
};

/**
 * جلب جلسة المستخدم الحالي
 */
export const getCurrentUserFromIDB = async (): Promise<TarqaUser | null> => {
  try {
    const db = await getTarqaDB();
    if (db) {
      const session = await db.get('current_session', 'active_user');
      if (session?.user) return session.user;
    }
  } catch {}

  // استرجاع احتياطي من التخزين المحلي
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('tarqa_current_user');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return null;
};

/**
 * مسح جلسة المستخدم الحالي عند تسجيل الخروج
 */
export const clearCurrentUserFromIDB = async (): Promise<void> => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('tarqa_current_user');
    }
    const db = await getTarqaDB();
    if (db) {
      await db.delete('current_session', 'active_user');
    }
  } catch {}
};

// =========================================================================
// 2. إدارة المستخدمين المسجلين
// =========================================================================

/**
 * حفظ مستخدم مسجل
 */
export const saveRegisteredUserToIDB = async (user: TarqaUser & { password?: string }): Promise<void> => {
  try {
    // مزامنة التخزين المحلي
    if (typeof window !== 'undefined' && user?.id) {
      try {
        const raw = localStorage.getItem('tarqa_registered_users');
        const list: any[] = raw ? JSON.parse(raw) : [];
        const idx = list.findIndex((u: any) => u.id === user.id || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...user };
        } else {
          list.push(user);
        }
        localStorage.setItem('tarqa_registered_users', JSON.stringify(list));
      } catch {}
    }

    const db = await getTarqaDB();
    if (!db || !user?.id) return;

    await db.put('users', {
      ...user,
      updatedAt: Date.now(),
    });
  } catch {}
};

/**
 * استرجاع كافة المستخدمين المسجلين
 */
export const getAllRegisteredUsersFromIDB = async (): Promise<TarqaUser[]> => {
  try {
    const db = await getTarqaDB();
    if (db) {
      return await db.getAll('users');
    }
  } catch {}

  // استرجاع احتياطي من التخزين المحلي
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('tarqa_registered_users');
      if (raw) return JSON.parse(raw);
    } catch {}
  }
  return [];
};

// =========================================================================
// 3. إدارة حالة التنقل والمسار (منع الخروج من صفحة الدورات عند الريفرش)
// =========================================================================

const APP_STATE_KEY = 'navigation_state';

/**
 * حفظ حالة المسار والشاشة النشطة حالياً
 */
export const persistViewState = async (state: Partial<AppStateData>): Promise<void> => {
  try {
    // 1. تحديث التخزين المحلي الفوري لسرعة القراءة المتزامنة
    if (typeof window !== 'undefined') {
      if (state.currentView) {
        localStorage.setItem('tarqa_current_view', state.currentView);
      }
      if (state.activeTab) {
        localStorage.setItem('tarqa_active_tab', state.activeTab);
      }
      if (state.activeModuleId) {
        localStorage.setItem('tarqa_active_module_id', state.activeModuleId);
      }
      if (state.activeLessonId) {
        localStorage.setItem('tarqa_active_lesson_id', state.activeLessonId);
      }
    }

    // 2. الحفظ في IndexedDB إن توفر
    const db = await getTarqaDB();
    if (!db) return;

    const existing = (await db.get('app_state', APP_STATE_KEY)) || {};
    const merged: AppStateData = {
      currentView: state.currentView || existing.currentView || 'home',
      activeTab: state.activeTab || existing.activeTab || 'home',
      activeModuleId: state.activeModuleId ?? existing.activeModuleId,
      activeLessonId: state.activeLessonId ?? existing.activeLessonId,
      updatedAt: Date.now(),
    };
    await db.put('app_state', merged, APP_STATE_KEY);
  } catch {}
};

/**
 * استعادة حالة الشاشة المحفوظة
 */
export const getPersistedViewState = async (): Promise<AppStateData | null> => {
  try {
    const db = await getTarqaDB();
    if (db) {
      const state = await db.get('app_state', APP_STATE_KEY);
      if (state && state.currentView) {
        return state;
      }
    }
  } catch {}

  // Fallback إلى localStorage إذا لم تتوفر في IndexedDB
  if (typeof window !== 'undefined') {
    const view = localStorage.getItem('tarqa_current_view') as any;
    const tab = localStorage.getItem('tarqa_active_tab') as any;
    if (view) {
      return {
        currentView: view,
        activeTab: tab || view,
        activeModuleId: localStorage.getItem('tarqa_active_module_id') || undefined,
        activeLessonId: localStorage.getItem('tarqa_active_lesson_id') || undefined,
        updatedAt: Date.now(),
      };
    }
  }

  return null;
};

// =========================================================================
// 4. حفظ محاولات الاختبارات وتقدم الدروس
// =========================================================================

/**
 * حفظ محاولة اختبار
 */
export const saveQuizAttemptToIDB = async (attempt: Omit<StoredQuizAttempt, 'id' | 'timestamp'> & { id?: string }): Promise<string> => {
  const attemptId = attempt.id || `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const record: StoredQuizAttempt = {
    ...attempt,
    id: attemptId,
    timestamp: Date.now(),
  };

  // مزامنة التخزين المحلي
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('tarqa_attempts');
      const list: any[] = raw ? JSON.parse(raw) : [];
      list.unshift(record);
      if (list.length > 50) list.pop();
      localStorage.setItem('tarqa_attempts', JSON.stringify(list));
    } catch {}
  }

  try {
    const db = await getTarqaDB();
    if (db) {
      await db.put('quiz_attempts', record);
    }
  } catch {}

  return attemptId;
};

/**
 * جلب جميع محاولات الاختبار للمستخدم
 */
export const getQuizAttemptsFromIDB = async (userId?: string): Promise<StoredQuizAttempt[]> => {
  try {
    const db = await getTarqaDB();
    if (db) {
      if (userId) {
        return await db.getAllFromIndex('quiz_attempts', 'by-user', userId);
      }
      const all = await db.getAll('quiz_attempts');
      return all.sort((a, b) => b.timestamp - a.timestamp);
    }
  } catch {}

  // استرجاع احتياطي من التخزين المحلي
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('tarqa_attempts');
      if (raw) {
        const attempts: StoredQuizAttempt[] = JSON.parse(raw);
        if (userId) {
          return attempts.filter((a) => a.userId === userId);
        }
        return attempts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
    } catch {}
  }

  return [];
};

/**
 * حفظ حالة إكمال درس
 */
export const saveLessonProgressToIDB = async (lessonId: string, isCompleted: boolean): Promise<void> => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`tarqa_lesson_${lessonId}`, isCompleted ? 'completed' : 'in_progress');
    } catch {}
  }

  try {
    const db = await getTarqaDB();
    if (db) {
      await db.put('lesson_progress', {
        lessonId,
        isCompleted,
        completedAt: Date.now(),
      });
    }
  } catch {}
};

// =========================================================================
// 5. المزامنة المزدوجة التلقائية بين localStorage و IndexedDB
// =========================================================================

/**
 * مزامنة تلقائية لبيانات المستخدمين والجلسة عند إقلاع التطبيق
 */
export const autoSyncLocalStorageToIndexedDB = async (): Promise<void> => {
  if (typeof window === 'undefined') return;

  try {
    const db = await getTarqaDB();
    if (!db) {
      // IndexedDB storage unavailable in this environment; localStorage is active and fully functional
      return;
    }

    // 1. مزامنة المستخدم الحالي
    const rawCurUser = localStorage.getItem('tarqa_current_user');
    if (rawCurUser) {
      try {
        const curUser = JSON.parse(rawCurUser);
        if (curUser && curUser.id) {
          await saveCurrentUserToIDB(curUser);
        }
      } catch {}
    } else {
      // إذا لم يكن موجوداً في localStorage، نحاول استعادته من IndexedDB
      const idbUser = await getCurrentUserFromIDB();
      if (idbUser) {
        localStorage.setItem('tarqa_current_user', JSON.stringify(idbUser));
        window.dispatchEvent(new Event('tarqa_user_changed'));
      }
    }

    // 2. مزامنة المستخدمين المسجلين محلياً
    const rawRegistered = localStorage.getItem('tarqa_registered_users');
    if (rawRegistered) {
      try {
        const registeredUsers: any[] = JSON.parse(rawRegistered);
        for (const u of registeredUsers) {
          if (u && u.id) {
            await db.put('users', { ...u, updatedAt: Date.now() });
          }
        }
      } catch {}
    }

    // 3. مزامنة سجل المحاولات القديمة
    const rawAttempts = localStorage.getItem('tarqa_attempts');
    if (rawAttempts) {
      try {
        const attempts: any[] = JSON.parse(rawAttempts);
        for (const a of attempts) {
          if (a && a.id) {
            await db.put('quiz_attempts', {
              id: a.id,
              userId: a.userId,
              quizTitle: a.quizTitle || 'اختبار كمي',
              score: a.score || 0,
              totalQuestions: a.totalQuestions || 0,
              percentageScore: a.percentageScore || 0,
              totalTimeSeconds: a.totalTimeSeconds || 0,
              createdAt: a.createdAt || new Date().toISOString(),
              timestamp: a.timestamp || Date.now(),
              answers: a.answers || [],
            });
          }
        }
      } catch {}
    }
  } catch (e: any) {
    console.info('[IndexedDB] Auto-sync bypassed gracefully:', e?.message || e);
  }
};
