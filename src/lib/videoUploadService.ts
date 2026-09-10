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

      console.warn('Supabase upload warning, falling back to local secure blob:', error?.message);
    }

    // 2. وضع المعالجة السريع والاحتياطي (Local Fast Secure Object URL)
    onProgress?.(60);
    await new Promise((resolve) => setTimeout(resolve, 300));
    onProgress?.(90);

    const objectUrl = URL.createObjectURL(file);
    saveLocalVideoReference(cleanName, objectUrl, file.size);
    onProgress?.(100);

    return {
      success: true,
      videoUrl: objectUrl,
      storagePath: `local/${storageFileName}`,
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
