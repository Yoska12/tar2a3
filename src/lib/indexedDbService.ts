import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { TarqaUser } from './supabase';
import { CourseModule, Lesson } from '../types';

export interface AppStateData {
  currentView: 'home' | 'courses' | 'quiz' | 'result' | 'dashboard' | 'admin' | 'classroom' | 'admin-lectures' | 'admin-roles';
  activeTab: 'home' | 'courses' | 'categories' | 'speed' | 'history' | 'dashboard' | 'admin' | 'roadmap' | 'admin-lectures' | 'admin-roles';
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

let dbPromise: Promise<IDBPDatabase<TarqaDBSchema>> | null = null;

/**
 * فتح وتهيئة قاعدة بيانات IndexedDB
 */
export const getTarqaDB = async (): Promise<IDBPDatabase<TarqaDBSchema>> => {
  if (typeof window === 'undefined' || !window.indexedDB) {
    throw new Error('IndexedDB غير مدعوم في هذه البيئة');
  }

  if (!dbPromise) {
    dbPromise = openDB<TarqaDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
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
    });
  }

  return dbPromise;
};

// =========================================================================
// 1. إدارة جلسة المستخدم الحالي في IndexedDB
// =========================================================================

/**
 * حفظ جلسة المستخدم الحالي في IndexedDB
 */
export const saveCurrentUserToIDB = async (user: TarqaUser): Promise<void> => {
  try {
    const db = await getTarqaDB();
    await db.put('current_session', {
      user,
      lastActive: Date.now(),
    }, 'active_user');

    // حفظ المستخدم أيضاً في متجر المستخدمين
    await db.put('users', {
      ...user,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[IndexedDB] Failed to save current user:', e);
  }
};

/**
 * جلب جلسة المستخدم الحالي من IndexedDB
 */
export const getCurrentUserFromIDB = async (): Promise<TarqaUser | null> => {
  try {
    const db = await getTarqaDB();
    const session = await db.get('current_session', 'active_user');
    return session?.user || null;
  } catch (e) {
    console.warn('[IndexedDB] Failed to get current user:', e);
    return null;
  }
};

/**
 * مسح جلسة المستخدم الحالي من IndexedDB عند تسجيل الخروج
 */
export const clearCurrentUserFromIDB = async (): Promise<void> => {
  try {
    const db = await getTarqaDB();
    await db.delete('current_session', 'active_user');
  } catch (e) {
    console.warn('[IndexedDB] Failed to clear current user session:', e);
  }
};

// =========================================================================
// 2. إدارة المستخدمين المسجلين في IndexedDB
// =========================================================================

/**
 * حفظ مستخدم مسجل في متجر users بـ IndexedDB
 */
export const saveRegisteredUserToIDB = async (user: TarqaUser & { password?: string }): Promise<void> => {
  try {
    const db = await getTarqaDB();
    await db.put('users', {
      ...user,
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[IndexedDB] Failed to save registered user:', e);
  }
};

/**
 * استرجاع كافة المستخدمين المسجلين من IndexedDB
 */
export const getAllRegisteredUsersFromIDB = async (): Promise<TarqaUser[]> => {
  try {
    const db = await getTarqaDB();
    return await db.getAll('users');
  } catch (e) {
    console.warn('[IndexedDB] Failed to get registered users:', e);
    return [];
  }
};

// =========================================================================
// 3. إدارة حالة التنقل والمسار (منع الخروج من صفحة الدورات عند الريفرش)
// =========================================================================

const APP_STATE_KEY = 'navigation_state';

/**
 * حفظ حالة المسار والشاشة النشطة حالياً في IndexedDB والتخزين المحلي
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

    // 2. الحفظ الدائم في IndexedDB
    const db = await getTarqaDB();
    const existing = (await db.get('app_state', APP_STATE_KEY)) || {};
    const merged: AppStateData = {
      currentView: state.currentView || existing.currentView || 'home',
      activeTab: state.activeTab || existing.activeTab || 'home',
      activeModuleId: state.activeModuleId ?? existing.activeModuleId,
      activeLessonId: state.activeLessonId ?? existing.activeLessonId,
      updatedAt: Date.now(),
    };
    await db.put('app_state', merged, APP_STATE_KEY);
  } catch (e) {
    console.warn('[IndexedDB] Failed to persist view state:', e);
  }
};

/**
 * استعادة حالة الشاشة المحفوظة من IndexedDB أو التخزين المحلي
 */
export const getPersistedViewState = async (): Promise<AppStateData | null> => {
  try {
    const db = await getTarqaDB();
    const state = await db.get('app_state', APP_STATE_KEY);
    if (state && state.currentView) {
      return state;
    }
  } catch (e) {
    console.warn('[IndexedDB] Error reading persisted view state from IDB:', e);
  }

  // Fallback إلى localStorage إذا لم تتوفر بعد في IndexedDB
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
// 4. حفظ محاولات الاختبارات وتقدم الدروس في IndexedDB
// =========================================================================

/**
 * حفظ محاولة اختبار كاملة في IndexedDB
 */
export const saveQuizAttemptToIDB = async (attempt: Omit<StoredQuizAttempt, 'id' | 'timestamp'> & { id?: string }): Promise<string> => {
  const attemptId = attempt.id || `attempt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const record: StoredQuizAttempt = {
    ...attempt,
    id: attemptId,
    timestamp: Date.now(),
  };

  try {
    const db = await getTarqaDB();
    await db.put('quiz_attempts', record);
  } catch (e) {
    console.warn('[IndexedDB] Failed to save quiz attempt:', e);
  }

  return attemptId;
};

/**
 * جلب جميع محاولات الاختبار للمستخدم من IndexedDB
 */
export const getQuizAttemptsFromIDB = async (userId?: string): Promise<StoredQuizAttempt[]> => {
  try {
    const db = await getTarqaDB();
    if (userId) {
      return await db.getAllFromIndex('quiz_attempts', 'by-user', userId);
    }
    const all = await db.getAll('quiz_attempts');
    return all.sort((a, b) => b.timestamp - a.timestamp);
  } catch (e) {
    console.warn('[IndexedDB] Failed to get quiz attempts:', e);
    return [];
  }
};

/**
 * حفظ حالة إكمال درس في IndexedDB
 */
export const saveLessonProgressToIDB = async (lessonId: string, isCompleted: boolean): Promise<void> => {
  try {
    const db = await getTarqaDB();
    await db.put('lesson_progress', {
      lessonId,
      isCompleted,
      completedAt: Date.now(),
    });
  } catch (e) {
    console.warn('[IndexedDB] Failed to save lesson progress:', e);
  }
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
  } catch (e) {
    console.warn('[IndexedDB] Auto-sync encountered an issue:', e);
  }
};
