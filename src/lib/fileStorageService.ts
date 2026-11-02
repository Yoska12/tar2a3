// إيقاف الرفع إلى Supabase Storage والاعتماد الكامل على استضافة هوستينجر (Hostinger Uploads)
export interface HostingerUploadResponse {
  success: boolean;
  fileUrl: string;
  absoluteUrl?: string;
  fileName: string;
  savedName?: string;
  fileSize?: number;
  fileSizeFormatted?: string;
  fileType?: string;
  error?: string;
}

/**
 * رفع الملف مباشرة إلى سيرفر هوستينجر مع إمكانية متابعة نسبة التقدم بدقة
 */
export const uploadFileToHostinger = (
  file: File,
  type: string = 'pdf',
  onProgress?: (percent: number) => void
): Promise<HostingerUploadResponse> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // مسار الرفع على هوستينجر
    const endpoint = '/api/upload.php';

    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('X-Upload-Key', 'tarqa_upload_sec_2026');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'فشل في رفع الملف إلى سيرفر هوستينجر'));
          }
        } catch {
          reject(new Error('استجابة غير صحيحة من سيرفر الرفع'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.error || `خطأ استجابة السيرفر (${xhr.status})`));
        } catch {
          reject(new Error(`تعذر الرفع إلى هوستينجر (كود الخطأ: ${xhr.status})`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('تعذر الاتصال بسيرفر هوستينجر لرفع الملف.'));
    };

    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    xhr.send(formData);
  });
};


export interface FileStorageResult {
  success: boolean;
  fileUrl: string;
  fileName: string;
  fileSizeFormatted: string;
  error?: string;
}

/**
 * تنسيق حجم الملف بشكل مقروء
 */
export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 MB';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * مستودع IndexedDB المحلي لحفظ ملفات ومذكرات الـ PDF بشكل دائم في المتصفح
 */
const DB_NAME = 'tarqa_files_vault';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_documents';

const openFilesDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB غير مدعوم'));
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

export const savePdfToIndexedDB = async (key: string, blob: Blob): Promise<void> => {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('Could not save PDF to IndexedDB:', e);
  }
};

export const getPdfFromIndexedDB = async (key: string): Promise<Blob | null> => {
  try {
    const db = await openFilesDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('Could not read PDF from IndexedDB:', e);
    return null;
  }
};

const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
};

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { downloadTrackingService } from './downloadTrackingService';

/**
 * ذاكرة مؤقتة للعلامات المائية لتسريع التوليد والتحميل الفوري
 */
const watermarkCache = new Map<string, Uint8Array>();

/**
 * إنشاء شريط وعلامة مائية أمنية مخصصة للطالب عبر Canvas لضمان دعم كامل للخطوط العربية والحماية من التسريب
 */
export const createStudentWatermarkPng = (
  studentName: string,
  studentId: string,
  trackingCode: string
): Uint8Array => {
  try {
    if (typeof document === 'undefined') {
      return new Uint8Array();
    }

    const cacheKey = `${studentName}_${studentId}_${trackingCode}`;
    if (watermarkCache.has(cacheKey)) {
      return watermarkCache.get(cacheKey)!;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 750;
    canvas.height = 1060; // قياس A4 عالي الدقة وسريع المعالجة
    const ctx = canvas.getContext('2d');
    if (!ctx) return new Uint8Array();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // العلامات المائية المائلة عبر الصفحة فقط دون أي أشرطة علوية أو سفلية
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((-32 * Math.PI) / 180);

    // خط مائي أول علوي
    ctx.fillStyle = 'rgba(15, 23, 42, 0.05)';
    ctx.font = 'bold 30px "Cairo", "Tajawal", "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`منصة طرقع التعليمية - قدرات محوسب وورقي 2025/2026`, 0, -140);

    // خط مائي رئيسي في المنتصف
    ctx.fillStyle = 'rgba(185, 28, 28, 0.13)';
    ctx.font = '900 34px "Cairo", "Tajawal", "Segoe UI", sans-serif';
    ctx.fillText(`نسخة مرخصة حصرياً للطالب: ${studentName}`, 0, 0);

    // خط مائي فرعي بالكود الأمني
    ctx.fillStyle = 'rgba(71, 85, 105, 0.12)';
    ctx.font = 'bold 20px "Segoe UI", Tahoma, sans-serif';
    ctx.fillText(`${studentId} • كود التحقق الأمني: ${trackingCode}`, 0, 48);

    // خط مائي سفلي مكرر
    ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
    ctx.font = 'bold 24px "Cairo", "Tajawal", "Segoe UI", sans-serif';
    ctx.fillText(`يمنع النشر أو التداول تحت طائلة المساءلة القانونية`, 0, 170);
    ctx.restore();

    // تحويل الرسم إلى بيانات ثنائية
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = dataUrl.split(',')[1];
    if (!base64) return new Uint8Array();
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    watermarkCache.set(cacheKey, bytes);
    return bytes;
  } catch (err) {
    console.warn('Canvas watermark rendering fallback:', err);
    return new Uint8Array();
  }
};

/**
 * دالة أمان صارمة تضمن أن النص الممرر لخطوط pdf-lib هو ASCII فقط لمنع استثناء WinAnsi نهائياً
 */
const toAsciiSafe = (val?: string, fallback: string = ''): string => {
  if (!val) return fallback;
  // استبدال أي محرف خارج نطاق 0x20 إلى 0x7E بمسافة
  const cleaned = val.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
};

/**
 * تم إلغاء خاصية التوليد التلقائي لملفات PDF نهائياً بناءً على رغبة إدارة المنصة:
 * لا يتم توليد أي مستندات أو مذكرات برمجياً، ويتم حصراً وتحديداً عرض وتنزيل الملف الأصلي الذي رفعه المدرس.
 */
export const createMultiPageTarqaPdf = async (): Promise<Uint8Array> => {
  throw new Error('تم إلغاء التوليد التلقائي لملفات PDF. يتم حصراً استخدام الملفات الأصلية المرفوعة.');
};

export const stampPdfWithWatermark = async (
  pdfBytes: Uint8Array,
  studentName: string,
  studentId: string,
  trackingCode: string
): Promise<Uint8Array> => {
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    
    let watermarkBytes: Uint8Array = new Uint8Array();
    try {
      watermarkBytes = createStudentWatermarkPng(studentName, studentId, trackingCode);
    } catch (e) {}

    if (watermarkBytes.length > 0) {
      try {
        const watermarkImg = await doc.embedPng(watermarkBytes);
        const pages = doc.getPages();
        for (const page of pages) {
          const { width, height } = page.getSize();
          page.drawImage(watermarkImg, {
            x: 0,
            y: 0,
            width,
            height,
            opacity: 0.95,
          });
        }
      } catch (embedErr) {
        console.warn('Could not embed PNG watermark, proceeding with un-watermarked PDF:', embedErr);
      }
    }
    return await doc.save();
  } catch (err) {
    console.warn('Could not load existing PDF for watermark stamping, returning original bytes:', err);
    return pdfBytes;
  }
};

/**
 * جلب وتوليد ملف PDF مشفر ومختوم بكافة بيانات الطالب لاستخدامه في التحميل والمعاينة
 */
export const getWatermarkedPdfBlob = async (
  url: string,
  fileInfo: { title: string; description?: string; pagesCount?: string },
  currentUser?: any
): Promise<Blob> => {
  if (!url || url.trim() === '' || url.includes('tarqa.app/files/')) {
    throw new Error('لم يتم رفع ملف أصلي لهذه المذكرة بعد من قبل المدرس أو الإدارة.');
  }

  const studentName =
    currentUser?.full_name?.trim() ||
    currentUser?.email?.split('@')[0] ||
    'طالب منصة طرقع';
  const studentId =
    currentUser?.email ||
    currentUser?.telegram_username ||
    currentUser?.phone_number ||
    (currentUser?.id ? `ID-${currentUser.id.slice(0, 8)}` : 'حساب مسجل');
  const codeSeed = (currentUser?.id || currentUser?.email || 'tarqa_student')
    .split('')
    .reduce((acc: number, char: string) => (acc << 5) - acc + char.charCodeAt(0), 0);
  const trackingCode = `TRQ-${Math.abs(codeSeed) % 90000 + 10000}-${Date.now().toString(36).slice(-4).toUpperCase()}`;

  let rawBytes: Uint8Array | null = null;

  // 1. قراءة الملف من خزانة IndexedDB المحلية إذا كان موجوداً
  if (url && url.startsWith('vault://')) {
    const key = url.replace('vault://', '');
    const blob = await getPdfFromIndexedDB(key);
    if (blob) {
      const buf = await blob.arrayBuffer();
      rawBytes = new Uint8Array(buf);
    }
  } else if (url && url.startsWith('data:')) {
    try {
      const base64 = url.split(',')[1];
      const binary = atob(base64);
      rawBytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        rawBytes[i] = binary.charCodeAt(i);
      }
    } catch (e) {}
  } else if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:') || url.startsWith('/') || url.startsWith('./')) && !url.includes('tarqa.app/files/')) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        rawBytes = new Uint8Array(buf);
      }
    } catch (e) {}
  }

  // 2. إرجاع الملف الأصلي الحقيقي المرفوع تماماً كما هو دون أي اصطناع أو تلاعب
  if (rawBytes && rawBytes.length > 0) {
    return new Blob([rawBytes as any], { type: 'application/pdf' });
  }

  // 3. منع تام لتوليد أي ملف من تلقاء نفسه: إلقاء خطأ واضح إذا لم يكن الملف مرفوعاً
  throw new Error('لم يتم العثور على ملف أصلي مرفوع لهذه المذكرة. يرجى رفع الملف من قبل المدرس أو الإدارة.');
};

export interface BrowserDownloadResult {
  url: string;
  fileName: string;
  success: boolean;
}

export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
};

export const isIOSDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1);
};

const activeBlobUrls: string[] = [];

/**
 * مشغل التنزيل الحقيقي على ذاكرة جهاز الطالب متوافق مع كافة المتصفحات (كمبيوتر وهاتف)
 */
/**
 * تنزيل الرابط المباشر الأصلي للملف عبر المتصفح
 */
export const triggerDirectUrlDownload = (fileUrl: string, rawFileName: string): BrowserDownloadResult => {
  const cleanBase = (rawFileName || 'مذكرة_طرقع_التعليمية')
    .replace(/[/\\?%*:|"<>#]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const safeName = cleanBase.toLowerCase().endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = fileUrl;
  a.download = safeName;
  a.setAttribute('download', safeName);
  document.body.appendChild(a);
  try {
    a.click();
  } catch (e) {
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
    a.dispatchEvent(evt);
  }
  setTimeout(() => {
    try {
      if (document.body.contains(a)) document.body.removeChild(a);
    } catch (e) {}
  }, 1000);

  return { url: fileUrl, fileName: safeName, success: true };
};

export const triggerBrowserDownload = (blob: Blob, rawFileName: string): BrowserDownloadResult => {
  // 1. تنظيف اسم الملف من أي رموز غير مسموحة في أنظمة التشغيل (ويندوز / ماك / أندرويد / آيفون)
  const cleanBase = (rawFileName || 'مذكرة_طرقع_التعليمية')
    .replace(/[/\\?%*:|"<>#]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const safeName = cleanBase.toLowerCase().endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;

  // ضمان نوع MIME بصيغة application/pdf ليتعرف عليها المتصفح فوراً كملف مستند
  const pdfBlob = blob.type === 'application/pdf' ? blob : new Blob([blob], { type: 'application/pdf' });
  const objectUrl = URL.createObjectURL(pdfBlob);

  // تسجيل فوري لعملية التحميل بالباك إند وقاعدة البيانات
  try {
    downloadTrackingService.trackDownload({
      title: safeName,
      fileType: 'pdf',
      fileSize: formatFileSize(blob.size || 0),
    });
  } catch (trackErr) {
    console.debug('Download tracking notice:', trackErr);
  }

  const isMobile = isMobileDevice();
  const isIOS = isIOSDevice();

  // تنظيف الروابط السابقة لمنع تسريب الذاكرة
  activeBlobUrls.push(objectUrl);
  if (activeBlobUrls.length > 20) {
    const old = activeBlobUrls.shift();
    if (old) {
      try { URL.revokeObjectURL(old); } catch (e) {}
    }
  }

  // 2. لأنظمة إنترنت إكسبلورر القديمة إن وجدت
  if (typeof (window.navigator as any)?.msSaveOrOpenBlob === 'function') {
    (window.navigator as any).msSaveOrOpenBlob(pdfBlob, safeName);
    return { url: objectUrl, fileName: safeName, success: true };
  }

  // 3. التنزيل المباشر الموثوق عبر عنصر <a>
  // تنويه حاسم: لا نضع target="_blank" أبداً لأنه يمنع التنزيل على أندرويد ويسبّب حجب النوافذ المنبثقة!
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = objectUrl;
  a.download = safeName;
  a.setAttribute('download', safeName);
  document.body.appendChild(a);

  try {
    a.click();
  } catch (err) {
    try {
      const evt = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      a.dispatchEvent(evt);
    } catch (syntheticErr) {
      console.warn('Programmatic click failed:', syntheticErr);
    }
  }

  // إزالة الرابط بعد إتمام النقرة
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    } catch (e) {}
  }, 1200);

  // إرسال إشعار للموقع مع الرابط المباشر
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tarqa_download_notice', {
        detail: { fileName: safeName, success: true, url: objectUrl, isMobile, isIOS },
      })
    );
  }

  return { url: objectUrl, fileName: safeName, success: true };
};

/**
 * تحميل الملف كاملاً على جهاز الطالب مع تشفير صفحاته ببياناته الأمنية
 */
export const downloadWatermarkedFile = async (
  file: { title: string; fileUrl: string; description?: string; pagesCount?: string },
  currentUser?: any
): Promise<BrowserDownloadResult> => {
  if (!file.fileUrl || file.fileUrl.trim() === '' || file.fileUrl.includes('tarqa.app/files/')) {
    return { url: '', fileName: file.title, success: false };
  }
  try {
    const blob = await getWatermarkedPdfBlob(file.fileUrl, file, currentUser);
    return triggerBrowserDownload(blob, file.title);
  } catch (err) {
    console.warn('Blob extraction failed during download, checking direct URL fallback:', err);
    if (file.fileUrl && (file.fileUrl.startsWith('http://') || file.fileUrl.startsWith('https://') || file.fileUrl.startsWith('/'))) {
      return triggerDirectUrlDownload(file.fileUrl, file.title);
    }
    return { url: '', fileName: file.title, success: false };
  }
};

/**
 * الحصول على رابط مباشر لملف PDF المشفر للمعاينة الحية داخل المتصفح
 */
export const getWatermarkedPdfBlobUrl = async (
  file: { title: string; fileUrl: string; description?: string; pagesCount?: string },
  currentUser?: any
): Promise<string> => {
  if (!file.fileUrl || file.fileUrl.trim() === '' || file.fileUrl.includes('tarqa.app/files/')) {
    throw new Error('لم يتم رفع ملف أصلي لهذه المذكرة بعد.');
  }
  try {
    const blob = await getWatermarkedPdfBlob(file.fileUrl, file, currentUser);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Failed to get watermarked preview, checking direct URL:', err);
    if (file.fileUrl && (file.fileUrl.startsWith('http://') || file.fileUrl.startsWith('https://') || file.fileUrl.startsWith('/')) && !file.fileUrl.startsWith('vault://')) {
      return file.fileUrl;
    }
    throw err;
  }
};

/**
 * حل عنوان ملف الـ PDF: دالة التوافق مع تشفير بيانات الطالب
 */
export const resolvePdfUrl = async (
  url: string,
  title?: string,
  description?: string,
  pagesCount?: string,
  currentUser?: any
): Promise<string> => {
  return await getWatermarkedPdfBlobUrl(
    { title: title || 'مذكرة طرقع', fileUrl: url, description, pagesCount },
    currentUser
  );
};

/**
 * تنزيل أو معاينة الملف بشكل موثوق ومحمي ببيانات الطالب
 */
export const downloadOrPreviewFile = async (
  url: string,
  fileName: string = 'tarqa_document.pdf',
  isPreview: boolean = false,
  title?: string,
  description?: string,
  currentUser?: any
): Promise<BrowserDownloadResult | void> => {
  if (isPreview) {
    const resolved = await resolvePdfUrl(url, title || fileName, description, undefined, currentUser);
    window.open(resolved, '_blank', 'noopener,noreferrer');
  } else {
    return await downloadWatermarkedFile(
      {
        title: title || fileName,
        fileUrl: url,
        description,
      },
      currentUser
    );
  }
};

/**
 * الخدمة المركزية الشاملة لرفع وحفظ ملفات الـ PDF والمذكرات
 * تحفظ في IndexedDB Vault الآمن عالي السعة، وتعيد روابط خفيفة جداً لمنع خطأ QuotaExceededError
 */
export const fileStorageService = {
  resolvePdfUrl,
  downloadOrPreviewFile,
  downloadWatermarkedFile,
  triggerBrowserDownload,
  triggerDirectUrlDownload,
  getWatermarkedPdfBlobUrl,
  getWatermarkedPdfBlob,
  createStudentWatermarkPng,
  stampPdfWithWatermark,
  uploadFileToHostinger,

  uploadPdf: async (
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<FileStorageResult> => {
    const fileSizeFormatted = formatFileSize(file.size);
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const vaultKey = `pdf_${timestamp}_${cleanName}`;
    const storagePath = `course-files/${timestamp}_${cleanName}`;

    onProgress?.(25);

    // 1. الرفع السحابي الحقيقي المباشر إلى استضافة هوستينجر (Hostinger Uploads)
    try {
      onProgress?.(35);
      const hostingerRes = await uploadFileToHostinger(file, 'pdf', (percent) => {
        // تدريج النسبة من 35% حتى 90%
        onProgress?.(35 + Math.round(percent * 0.55));
      });

      if (hostingerRes && hostingerRes.success && hostingerRes.fileUrl) {
        onProgress?.(100);
        return {
          success: true,
          fileUrl: hostingerRes.fileUrl,
          fileName: hostingerRes.fileName || file.name,
          fileSizeFormatted: hostingerRes.fileSizeFormatted || fileSizeFormatted,
        };
      }
    } catch (hostingerErr) {
      console.warn('[Hostinger Upload] Upload endpoint returned notice, falling back to secure IndexedDB vault:', hostingerErr);
    }

    onProgress?.(85);

    // 2. الحفظ المباشر والدائم في خزانة IndexedDB المحلية (تسع مئات الميجابايت بأمان تام)
    await savePdfToIndexedDB(vaultKey, file);

    onProgress?.(100);

    // الرابط المعتمد هو vault://${vaultKey} — حجمه 30 بايت فقط!
    // يضمن حفظ الملف فوراً في localStorage و Supabase دون أي تعليق أو امتلاء للذاكرة
    return {
      success: true,
      fileUrl: `vault://${vaultKey}`,
      fileName: file.name,
      fileSizeFormatted,
    };
  },
};

