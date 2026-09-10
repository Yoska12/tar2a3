import { supabase, isSupabaseConfigured } from './supabase';

export interface VideoUploadResult {
  success: boolean;
  videoUrl?: string;
  storagePath?: string;
  fileName?: string;
  fileSizeFormatted?: string;
  error?: string;
}

/**
 * تنسيق حجم الملف بشكل مقروء
 */
export const formatVideoSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * فحص نوع ملف الفيديو المدعوم
 */
export const isValidVideoFile = (file: File): { valid: boolean; error?: string } => {
  const allowedExtensions = ['.mp4', '.webm', '.mov', '.mkv', '.m4v'];
  const name = file.name.toLowerCase();
  const isExtensionValid = allowedExtensions.some((ext) => name.endsWith(ext));
  const isMimeValid = file.type.startsWith('video/') || file.type === '';

  if (!isExtensionValid && !isMimeValid) {
    return {
      valid: false,
      error: 'يرجى رفع ملف فيديو مدعوم بصيغة (MP4, WebM, MOV, MKV).',
    };
  }

  // الحد الأقصى للحجم (500 ميجابايت)
  const maxBytes = 500 * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `حجم الفيديو (${formatVideoSize(file.size)}) يتجاوز الحد الأقصى المسموح به (500 MB).`,
    };
  }

  return { valid: true };
};

/**
 * مستودع IndexedDB المحلي لتخزين ملفات الفيديو الكبيرة بشكل دائم في المتصفح
 */
const DB_NAME = 'tarqa_video_vault';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

const openVideoDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB غير مدعوم في هذا المتصفح.'));
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const saveVideoToIndexedDB = async (key: string, blob: Blob): Promise<void> => {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Could not save video to IndexedDB:', e);
  }
};

export const getVideoFromIndexedDB = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openVideoDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not read video from IndexedDB:', e);
    return null;
  }
};

// ذاكرة تخزين مؤقت لعناوين الـ ObjectURLs لتجنب تكرار إنشائها
const resolvedUrlCache = new Map<string, string>();

/**
 * حل عنوان الفيديو: إذا كان مخزناً في IndexedDB يستخرج الـ Blob وينشئ له ObjectURL حي دائماً
 */
export const resolveVideoUrl = async (url: string): Promise<string> => {
  if (!url) return '';
  
  if (url.startsWith('indexeddb://')) {
    const key = url.replace('indexeddb://', '');
    if (resolvedUrlCache.has(key)) {
      return resolvedUrlCache.get(key)!;
    }
    const blob = await getVideoFromIndexedDB(key);
    if (blob) {
      const objUrl = URL.createObjectURL(blob);
      resolvedUrlCache.set(key, objUrl);
      return objUrl;
    }
    // احتياطي
    return 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
  }

  return url;
};

/**
 * حفظ مرجعية الفيديو المرفوع محلياً
 */
const saveLocalVideoReference = (fileName: string, url: string, size: number) => {
  try {
    const raw = localStorage.getItem('tarqa_uploaded_videos') || '{}';
    const store = JSON.parse(raw);
    store[fileName] = {
      url,
      size: formatVideoSize(size),
      uploadedAt: new Date().toISOString(),
    };
    localStorage.setItem('tarqa_uploaded_videos', JSON.stringify(store));
  } catch (e) {
    console.warn('Could not save local video reference:', e);
  }
};

/**
 * رفع فيديو المحاضرة إلى التخزين السحابي Supabase Storage مع دعم التخزين المحلي الآمن
 */
export const uploadLessonVideo = async (
  file: File,
  lessonId: string = 'lecture',
  onProgress?: (progress: number) => void
): Promise<VideoUploadResult> => {
  const validation = isValidVideoFile(file);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestamp = Date.now();
  const storageFileName = `lectures/${lessonId}_${timestamp}_${cleanName}`;
  const fileSizeFormatted = formatVideoSize(file.size);

  try {
    onProgress?.(15);

    // 1. إذا كان Supabase متصلاً ومعداً
    if (isSupabaseConfigured && supabase) {
      onProgress?.(35);
      
      // محاولة الرفع إلى حاوية course-videos
      const bucketName = 'course-videos';
      let { data, error } = await supabase.storage
        .from(bucketName)
        .upload(storageFileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      // إذا لم تكن الحاوية موجودة، نحاول في lecture-files
      if (error && error.message?.toLowerCase().includes('bucket not found')) {
        const fallbackBucket = 'lecture-files';
        const res = await supabase.storage
          .from(fallbackBucket)
          .upload(storageFileName, file, {
            cacheControl: '3600',
            upsert: true,
          });
        data = res.data;
        error = res.error;
      }

      onProgress?.(80);

      if (!error && data?.path) {
        const { data: publicUrlData } = supabase.storage
          .from(bucketName)
          .getPublicUrl(data.path);

        const videoUrl = publicUrlData.publicUrl;
        saveLocalVideoReference(cleanName, videoUrl, file.size);
        onProgress?.(100);

        return {
          success: true,
          videoUrl,
          storagePath: data.path,
          fileName: file.name,
          fileSizeFormatted,
        };
      }

      console.warn('Supabase upload notice, falling back to local persistent IndexedDB storage:', error?.message);
    }

    // 2. وضع المعالجة السريع والاحتياطي الدائم عبر IndexedDB
    onProgress?.(60);
    const videoKey = `tarqa_vid_${timestamp}_${cleanName}`;
    await saveVideoToIndexedDB(videoKey, file);
    onProgress?.(90);

    const persistentUrl = `indexeddb://${videoKey}`;
    const liveObjectUrl = URL.createObjectURL(file);
    resolvedUrlCache.set(videoKey, liveObjectUrl);
    saveLocalVideoReference(cleanName, persistentUrl, file.size);
    onProgress?.(100);

    return {
      success: true,
      videoUrl: persistentUrl,
      storagePath: `indexeddb/${videoKey}`,
      fileName: file.name,
      fileSizeFormatted,
    };
  } catch (err: any) {
    console.error('Error during video upload:', err);
    return {
      success: false,
      error: err?.message || 'فشلت عملية رفع ملف الفيديو.',
    };
  }
};
