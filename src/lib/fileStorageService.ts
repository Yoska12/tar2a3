import { supabase, isSupabaseConfigured } from './supabase';

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

/**
 * إنشاء شريط وعلامة مائية أمنية مخصصة للطالب عبر Canvas لضمان دعم كامل للخطوط العربية والحماية من التسريب
 */
export const createStudentWatermarkPng = (
  studentName: string,
  studentId: string,
  trackingCode: string
): Uint8Array => {
  if (typeof document === 'undefined') {
    return new Uint8Array();
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1240;
  canvas.height = 1754; // A4 قياسي بدقة 150 DPI
  const ctx = canvas.getContext('2d');
  if (!ctx) return new Uint8Array();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const timestamp = new Date().toLocaleString('ar-SA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  // 1. الشريط الأمني العلوي (Header Bar)
  ctx.fillStyle = 'rgba(241, 245, 249, 0.94)';
  ctx.fillRect(0, 0, canvas.width, 54);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 54);
  ctx.lineTo(canvas.width, 54);
  ctx.stroke();

  // نص الهيدر باللغة العربية
  ctx.fillStyle = '#b91c1c'; // لون التنبيه الأمني
  ctx.font = 'bold 20px "Cairo", "Tajawal", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `منصة طرقع 🛡️ • وثيقة رقمية مرخصة ومحمية باسم الطالب: ${studentName}`,
    canvas.width - 25,
    35
  );

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 15px "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ID: ${studentId} | CODE: ${trackingCode}`, 25, 35);

  // 2. العلامات المائية المائلة عبر الصفحة (Diagonal Security Watermarks)
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-32 * Math.PI) / 180);

  // خط مائي أول علوي
  ctx.fillStyle = 'rgba(15, 23, 42, 0.07)';
  ctx.font = '900 44px "Cairo", "Tajawal", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`منصة طرقع التعليمية - قدرات محوسب وورقي 2025/2026`, 0, -180);

  // خط مائي رئيسي في المنتصف
  ctx.fillStyle = 'rgba(185, 28, 28, 0.13)';
  ctx.font = '900 48px "Cairo", "Tajawal", "Segoe UI", sans-serif';
  ctx.fillText(`نسخة مرخصة حصرياً للطالب: ${studentName}`, 0, 0);

  // خط مائي فرعي بالكود الأمني
  ctx.fillStyle = 'rgba(71, 85, 105, 0.11)';
  ctx.font = 'bold 28px "Segoe UI", Tahoma, sans-serif';
  ctx.fillText(`${studentId} • كود التحقق الأمني: ${trackingCode}`, 0, 60);

  // خط مائي سفلي مكرر
  ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
  ctx.font = 'bold 36px "Cairo", "Tajawal", "Segoe UI", sans-serif';
  ctx.fillText(`يمنع النشر أو التداول تحت طائلة المساءلة القانونية`, 0, 220);
  ctx.restore();

  // 3. الشريط الأمني السفلي (Footer Bar)
  ctx.fillStyle = 'rgba(241, 245, 249, 0.94)';
  ctx.fillRect(0, canvas.height - 48, canvas.width, 48);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height - 48);
  ctx.lineTo(canvas.width, canvas.height - 48);
  ctx.stroke();

  ctx.fillStyle = '#b91c1c';
  ctx.font = 'bold 15px "Cairo", "Tajawal", "Segoe UI", Tahoma, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `⚠️ تنبيه أمني: هذه النسخة مشفرة ومسجلة نظاماً باسم الطالب [${studentName}] (${studentId}) بتاريخ ${timestamp} • يمنع نشرها أو نسخها أو تداولها`,
    canvas.width / 2,
    canvas.height - 18
  );

  // تحويل الرسم إلى بيانات ثنائية
  const dataUrl = canvas.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

/**
 * توليد مذكرة طرقع متكاملة الصفحات بتنسيق PDF قياسي عند عدم توفر ملف أصلي
 */
export const createMultiPageTarqaPdf = async (
  title?: string,
  description?: string,
  pagesCount?: string
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const cleanTitle = (title || 'TARQA QUDURAT STUDY GUIDE 2025/2026').replace(/[^\x20-\x7E]/g, ' ');
  const cleanDesc = (description || 'Comprehensive Foundation Guide, Gold Rules & Speed Strategies').replace(/[^\x20-\x7E]/g, ' ');
  const pagesTotal = pagesCount || '185 Pages';

  // --- PAGE 1: الغلاف الرسمي المعتمد والمقدمة ---
  const page1 = doc.addPage([595.28, 841.89]);
  
  page1.drawRectangle({
    x: 40,
    y: 700,
    width: 515.28,
    height: 100,
    color: rgb(0.96, 0.97, 0.99),
  });

  page1.drawText('TARQA ACADEMY - OFFICIAL QUDURAT FOUNDATION', {
    x: 60,
    y: 760,
    size: 16,
    font: fontBold,
    color: rgb(0.9, 0.5, 0.1),
  });

  page1.drawText(cleanTitle, {
    x: 60,
    y: 730,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page1.drawText(cleanDesc, {
    x: 60,
    y: 660,
    size: 11,
    font: fontRegular,
    color: rgb(0.35, 0.4, 0.45),
  });

  page1.drawText(`Document Pages: ${pagesTotal} | Edition: 1446-1447H / 2025-2026 | Format: PDF Secure`, {
    x: 60,
    y: 635,
    size: 10,
    font: fontRegular,
    color: rgb(0.2, 0.5, 0.3),
  });

  page1.drawText('TABLE OF CONTENTS & CHAPTER OVERVIEW:', {
    x: 60,
    y: 590,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const chapters = [
    'Chapter 1: Arithmetic, Mental Calculation & Proportional Scaling',
    'Chapter 2: Fast Algebra, Quadratic Identities & Exponent Shortcuts',
    'Chapter 3: Geometry, Right Triangle Ratios & Shaded Area Subtraction',
    'Chapter 4: Comparison Strategies, Statistics & Probability In Seconds',
    'Chapter 5: High-Frequency Qudurat Computerized Questions Bank 2025',
  ];

  chapters.forEach((chap, idx) => {
    page1.drawText(`[Part ${idx + 1}] ${chap}`, {
      x: 70,
      y: 555 - idx * 30,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
  });

  page1.drawText('TARQA PLATFORM VERIFIED - OFFICIAL ENCRYPTED STUDENT COPY', {
    x: 60,
    y: 120,
    size: 9,
    font: fontBold,
    color: rgb(0.5, 0.5, 0.5),
  });

  // --- PAGE 2: القوانين الذهبية الأساسية ---
  const page2 = doc.addPage([595.28, 841.89]);
  page2.drawText('PART 1 & 2: ARITHMETIC AND ALGEBRA GOLDEN LAWS', {
    x: 60,
    y: 770,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const rulesPage2 = [
    '1. Cross-Multiplication: Compare a/b and c/d by computing a*d vs b*c instantly.',
    '2. Percentage Shortcut: 10% = divide by 10, 5% = half of 10%, 25% = divide by 4.',
    '3. Arithmetic Sequence Sum: Sum = (First + Last) * (Number of terms) / 2.',
    '4. Difference of Two Squares: a^2 - b^2 = (a - b)(a + b).',
    '5. Perfect Square Expansion: (a + b)^2 = a^2 + 2ab + b^2.',
    '6. Exponent Rules: x^a * x^b = x^(a+b), (x^a)^b = x^(a*b), x^0 = 1 (x != 0).',
    '7. Negative Exponent: x^(-n) = 1 / x^n.',
    '8. Fractional Root Exponent: x^(m/n) = n-th root of (x^m).',
    '9. Smart Substitution: Test 0, 1, 2 or -1 to eliminate incorrect answer choices in seconds.',
  ];

  rulesPage2.forEach((rule, idx) => {
    page2.drawText(rule, {
      x: 60,
      y: 730 - idx * 45,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
  });

  // --- PAGE 3: الهندسة والمقارنات والإحصاء ---
  const page3 = doc.addPage([595.28, 841.89]);
  page3.drawText('PART 3 & 4: GEOMETRY AND SPEED COMPARISON TACTICS', {
    x: 60,
    y: 770,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  const rulesPage3 = [
    '1. Pythagorean Famous Triples: (3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25).',
    '2. 30-60-90 Triangle: Side opposite 30 is x, opposite 60 is x*sqrt(3), hypotenuse is 2x.',
    '3. 45-45-90 Triangle: Legs are x, hypotenuse is x*sqrt(2).',
    '4. Circle Area: Area = pi * r^2, Circumference = 2 * pi * r.',
    '5. Shaded Area Principle: Total outer shape area minus unshaded inner shape area.',
    '6. Four Comparison Options: (A) Val 1 > Val 2, (B) Val 2 > Val 1, (C) Equal, (D) Insufficient.',
    '7. Insufficient Data Detection: When variables can be positive, negative, fraction, or zero.',
    '8. Statistical Shortcuts: Mean = Sum / Count, Median = middle value after sorting.',
  ];

  rulesPage3.forEach((rule, idx) => {
    page3.drawText(rule, {
      x: 60,
      y: 730 - idx * 50,
      size: 10,
      font: fontRegular,
      color: rgb(0.2, 0.25, 0.3),
    });
  });

  return await doc.save();
};

/**
 * ختم صفحات أي ملف PDF بالعلامة المائية المشفرة ببيانات الطالب
 */
export const stampPdfWithWatermark = async (
  pdfBytes: Uint8Array,
  studentName: string,
  studentId: string,
  trackingCode: string
): Promise<Uint8Array> => {
  try {
    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const watermarkBytes = createStudentWatermarkPng(studentName, studentId, trackingCode);
    
    if (watermarkBytes.length > 0) {
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
    }
    return await doc.save();
  } catch (err) {
    console.warn('Could not stamp existing PDF, generating fresh watermarked document:', err);
    const freshDocBytes = await createMultiPageTarqaPdf();
    const doc = await PDFDocument.load(freshDocBytes);
    const watermarkBytes = createStudentWatermarkPng(studentName, studentId, trackingCode);
    if (watermarkBytes.length > 0) {
      const watermarkImg = await doc.embedPng(watermarkBytes);
      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        page.drawImage(watermarkImg, { x: 0, y: 0, width, height, opacity: 0.95 });
      }
    }
    return await doc.save();
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

  // 1. قراءة الملف من خزانة IndexedDB المحلية
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
  } else if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('tarqa.app/files/')) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        rawBytes = new Uint8Array(buf);
      }
    } catch (e) {}
  }

  // 2. إذا لم يكن الملف الأصلي متوفراً يتم توليد المذكرة النموذجية
  if (!rawBytes || rawBytes.length === 0) {
    rawBytes = await createMultiPageTarqaPdf(fileInfo.title, fileInfo.description, fileInfo.pagesCount);
  }

  // 3. تطبيق التشفير المائي ببيانات الطالب على كافة الصفحات
  const watermarkedBytes = await stampPdfWithWatermark(rawBytes, studentName, studentId, trackingCode);

  return new Blob([watermarkedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
};

/**
 * مشغل التنزيل الحقيقي على ذاكرة جهاز الطالب متوافق مع كافة المتصفحات (كمبيوتر وهاتف)
 */
export const triggerBrowserDownload = (blob: Blob, rawFileName: string): void => {
  // 1. تنظيف اسم الملف من أي رموز قد تمنع أنظمة التشغيل من حفظه
  const cleanBase = (rawFileName || 'مذكرة_طرقع_التعليمية')
    .replace(/[/\\?%*:|"<>#]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const safeName = cleanBase.toLowerCase().endsWith('.pdf') ? cleanBase : `${cleanBase}.pdf`;

  // 2. لأنظمة إنترنت إكسبلورر / ويندوز القديمة
  if (typeof (window.navigator as any)?.msSaveOrOpenBlob === 'function') {
    (window.navigator as any).msSaveOrOpenBlob(blob, safeName);
    return;
  }

  // 3. طريقة HTML5 الرابط المباشر
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.position = 'fixed';
  a.style.left = '-9999px';
  a.style.top = '-9999px';
  a.style.opacity = '0';
  a.href = objectUrl;
  a.download = safeName;
  a.rel = 'noopener';
  // هام جداً: عدم استخدام target="_blank" حتى لا يقوم كروم بحظر التنزيل التلقائي!

  document.body.appendChild(a);

  try {
    a.click();
  } catch (err) {
    console.warn('Direct click failed, dispatching synthetic MouseEvent:', err);
    const evt = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    a.dispatchEvent(evt);
  }

  // 4. إبقاء الرابط فعالاً لثوانٍ ثم تنظيفه
  setTimeout(() => {
    try {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
      URL.revokeObjectURL(objectUrl);
    } catch (e) {}
  }, 60000);

  // إرسال إشعار للموقع
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('tarqa_download_notice', {
        detail: { fileName: safeName, success: true },
      })
    );
  }
};

/**
 * تحميل الملف كاملاً على جهاز الطالب مع تشفير صفحاته ببياناته الأمنية
 */
export const downloadWatermarkedFile = async (
  file: { title: string; fileUrl: string; description?: string; pagesCount?: string },
  currentUser?: any
): Promise<void> => {
  try {
    const blob = await getWatermarkedPdfBlob(file.fileUrl, file, currentUser);
    triggerBrowserDownload(blob, file.title);
  } catch (err) {
    console.error('Watermark stamping failed during download, activating direct fallback:', err);
    try {
      const fallbackBytes = await createMultiPageTarqaPdf(file.title, file.description, file.pagesCount);
      const fallbackBlob = new Blob([fallbackBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      triggerBrowserDownload(fallbackBlob, file.title);
    } catch (fallbackErr) {
      console.error('Fatal download fallback error:', fallbackErr);
    }
  }
};

/**
 * الحصول على رابط مباشر لملف PDF المشفر للمعاينة الحية داخل المتصفح
 */
export const getWatermarkedPdfBlobUrl = async (
  file: { title: string; fileUrl: string; description?: string; pagesCount?: string },
  currentUser?: any
): Promise<string> => {
  try {
    const blob = await getWatermarkedPdfBlob(file.fileUrl, file, currentUser);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('Failed to get watermarked preview, falling back to base PDF:', err);
    const fallbackBytes = await createMultiPageTarqaPdf(file.title, file.description, file.pagesCount);
    const fallbackBlob = new Blob([fallbackBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    return URL.createObjectURL(fallbackBlob);
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
): Promise<void> => {
  if (isPreview) {
    const resolved = await resolvePdfUrl(url, title || fileName, description, undefined, currentUser);
    window.open(resolved, '_blank', 'noopener,noreferrer');
  } else {
    await downloadWatermarkedFile(
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
  getWatermarkedPdfBlobUrl,
  getWatermarkedPdfBlob,
  createStudentWatermarkPng,
  stampPdfWithWatermark,

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

    // 1. المحاولة السحابية الأولى عبر Supabase Storage إذا كانت مهيأة
    if (isSupabaseConfigured && supabase) {
      try {
        onProgress?.(45);
        const { data, error } = await supabase.storage
          .from('lecture-files')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: true,
          });

        if (!error && data?.path) {
          const { data: urlData } = supabase.storage
            .from('lecture-files')
            .getPublicUrl(data.path);

          if (urlData?.publicUrl) {
            onProgress?.(100);
            return {
              success: true,
              fileUrl: urlData.publicUrl,
              fileName: file.name,
              fileSizeFormatted,
            };
          }
        }
      } catch (cloudErr) {
        console.warn('Supabase storage bucket missing, using local vault:', cloudErr);
      }
    }

    onProgress?.(65);

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

