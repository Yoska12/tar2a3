import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Trash2, CheckCircle2, AlertCircle, File, Download, Loader2 } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { LessonAttachment, AttachmentType } from '../types';
import { sanitizeUrl } from '../lib/securityUtils';

interface FileUploadZoneProps {
  lessonId: string;
  attachments: LessonAttachment[];
  onAddAttachment: (attachment: LessonAttachment) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  disabled?: boolean;
}

export const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  lessonId,
  attachments,
  onAddAttachment,
  onRemoveAttachment,
  disabled = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fileType, setFileType] = useState<AttachmentType>('pdf');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // تنسيق حجم الملف
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // معالجة رفع الملف
  const handleFileUpload = async (file: File) => {
    if (!file) return;

    // فحص نوع الملف (السماح بـ PDF والمستندات)
    if (!file.name.toLowerCase().endsWith('.pdf') && !file.type.includes('pdf')) {
      setErrorMsg('يرجى رفع ملفات بصيغة PDF فقط للمذكرات وأوراق العمل.');
      return;
    }

    // الحد الأقصى 25 ميجابايت
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('الحد الأقصى لحجم الملف هو 25 ميجابايت.');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);
    setUploadProgress(20);

    try {
      let fileUrl = '';
      const cleanFileName = `${lessonId}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      // 1. إذا كان Supabase مرتبطاً فعلياً
      if (isSupabaseConfigured) {
        setUploadProgress(50);
        const { data, error } = await supabase.storage
          .from('lecture-files')
          .upload(`attachments/${cleanFileName}`, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) throw error;

        // الحصول على الرابط العام
        const { data: publicUrlData } = supabase.storage
          .from('lecture-files')
          .getPublicUrl(data.path);

        fileUrl = publicUrlData.publicUrl;
      } else {
        // 2. وضع المعاينة المحلي (Local Demo Mode)
        setUploadProgress(70);
        await new Promise((res) => setTimeout(res, 600));
        fileUrl = `https://tarqa.app/storage/lecture-files/${cleanFileName}`;
      }

      setUploadProgress(100);

      const newAttachment: LessonAttachment = {
        id: 'att-' + Date.now(),
        lessonId,
        title: file.name,
        fileUrl,
        fileSize: formatFileSize(file.size),
        fileType,
        downloadCount: 0,
      };

      onAddAttachment(newAttachment);
    } catch (err: any) {
      console.error('Error uploading attachment:', err);
      setErrorMsg(err.message || 'فشل رفع الملف، يرجى إعادة المحاولة.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="space-y-4">
      {/* نوع المرفق المراد رفعه */}
      <div className="flex items-center justify-between text-xs">
        <label className="font-bold text-slate-700 dark:text-slate-300">
          نوع المرفق التأسيسي:
        </label>
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setFileType('pdf')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              fileType === 'pdf'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            مذكرة كاملة
          </button>
          <button
            type="button"
            onClick={() => setFileType('summary')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              fileType === 'summary'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            خريطة مفاهيم
          </button>
          <button
            type="button"
            onClick={() => setFileType('worksheet')}
            className={`px-2.5 py-1 rounded-lg font-medium transition ${
              fileType === 'worksheet'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            ورقة عمل
          </button>
        </div>
      </div>

      {/* منطقة السحب والإفلات */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-amber-500 bg-amber-500/10 scale-[0.99]'
            : 'border-slate-300 dark:border-slate-700 hover:border-amber-500/70 bg-slate-50/50 dark:bg-slate-900/30'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <div className="w-full max-w-xs space-y-1">
              <div className="flex justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400">
                <span>جاري الرفع إلى مستودع Supabase...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                اضغط هنا لاختيار مذكرة PDF أو اسحب وأفلت الملف
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                يدعم ملفات PDF، الملازم، وأوراق العمل (حتى 25 ميجابايت)
              </p>
            </div>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* قائمة المرفقات الحالية */}
      {attachments.length > 0 && (
        <div className="space-y-2 pt-2">
          <h5 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            المذكرات والمرفقات الحالية بالدرس ({attachments.length}):
          </h5>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center justify-between p-3 gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">
                      {att.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span>{att.fileSize}</span>
                      <span>•</span>
                      <span className="capitalize text-amber-500 font-semibold">
                        {att.fileType === 'pdf' ? 'مذكرة' : att.fileType === 'summary' ? 'خريطة مفاهيم' : 'ورقة عمل'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={sanitizeUrl(att.fileUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition"
                    title="تحميل المذكرة"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachment(att.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition"
                    title="حذف الملف"
                    disabled={disabled}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
