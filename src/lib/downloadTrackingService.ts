import { authService, supabase, isSupabaseConfigured, isValidUuid, TarqaUser } from './supabase';
import { StudentDownloadedFile, UserWithRole } from '../types';

export interface UserDownloadRecord {
  userId: string;
  userEmail?: string;
  userName?: string;
  downloadCount: number;
  lastDownloadedAt: string;
  files: StudentDownloadedFile[];
}

const STORAGE_KEY = 'tarqa_user_downloads';

class DownloadTrackingService {
  /**
   * جلب كافة سجلات التحميلات من التخزين المحلي
   */
  getAllDownloads(): Record<string, UserDownloadRecord> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[downloadTrackingService] Failed to parse downloads:', err);
    }
    return {};
  }

  /**
   * حفظ السجلات في التخزين المحلي
   */
  private saveAllDownloads(records: Record<string, UserDownloadRecord>): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (err) {
      console.warn('[downloadTrackingService] Failed to save downloads:', err);
    }
  }

  /**
   * جلب سجل تحميلات مستخدم محدد بالـ ID أو البريد الإلكتروني
   */
  getUserDownloads(userIdOrEmail?: string): UserDownloadRecord | null {
    if (!userIdOrEmail) return null;
    const records = this.getAllDownloads();
    
    // البحث بالـ ID المباشر
    if (records[userIdOrEmail]) {
      return records[userIdOrEmail];
    }

    // البحث بالبريد الإلكتروني الموحد
    const queryLower = userIdOrEmail.toLowerCase().trim();
    for (const key of Object.keys(records)) {
      const rec = records[key];
      if (
        rec.userId === userIdOrEmail ||
        (rec.userEmail && rec.userEmail.toLowerCase().trim() === queryLower)
      ) {
        return rec;
      }
    }

    return null;
  }

  /**
   * تسجيل عملية تحميل ملف لطالب أو مستخدم
   */
  async trackDownload(
    fileInfo: {
      id?: string;
      title: string;
      fileUrl?: string;
      fileType?: string;
      fileSize?: string;
    },
    targetUser?: TarqaUser | UserWithRole | null
  ): Promise<{ success: boolean; record?: UserDownloadRecord }> {
    try {
      // تحديد المستخدم المستهدف (من المعامل أو الجلسة الحالية)
      let user = targetUser || authService.getCurrentUser();
      
      if (!user) {
        try {
          const raw = localStorage.getItem('tarqa_current_user');
          if (raw) user = JSON.parse(raw);
        } catch {}
      }

      const userId = user?.id || 'guest-student';
      const userEmail = user?.email || undefined;
      const userName = (user as any)?.fullName || (user as any)?.name || 'طالب طرقع';

      const records = this.getAllDownloads();
      const existing = this.getUserDownloads(userId) || (userEmail ? this.getUserDownloads(userEmail) : null);

      const now = new Date().toISOString();
      const newFileEntry: StudentDownloadedFile = {
        id: fileInfo.id || 'file-' + Date.now(),
        title: fileInfo.title || 'مذكرة دراسية',
        fileUrl: fileInfo.fileUrl,
        fileType: fileInfo.fileType || 'pdf',
        fileSize: fileInfo.fileSize || 'PDF',
        downloadedAt: now,
      };

      let updatedRecord: UserDownloadRecord;

      if (existing) {
        // تجنب تكرار التسجيل لنفس الملف إذا تم النقر عليه خلال 3 ثوانٍ
        const lastFile = existing.files[existing.files.length - 1];
        const isRecentDuplicate =
          lastFile &&
          lastFile.title === newFileEntry.title &&
          Date.now() - new Date(lastFile.downloadedAt).getTime() < 3000;

        if (isRecentDuplicate) {
          return { success: true, record: existing };
        }

        updatedRecord = {
          ...existing,
          userId: userId !== 'guest-student' ? userId : existing.userId,
          userEmail: userEmail || existing.userEmail,
          userName: userName || existing.userName,
          downloadCount: existing.downloadCount + 1,
          lastDownloadedAt: now,
          files: [...existing.files, newFileEntry],
        };
      } else {
        updatedRecord = {
          userId,
          userEmail,
          userName,
          downloadCount: 1,
          lastDownloadedAt: now,
          files: [newFileEntry],
        };
      }

      // حفظ السجل بمفتاح الـ ID والبريد الإلكتروني إن وجد
      records[userId] = updatedRecord;
      if (userEmail) {
        records[userEmail.toLowerCase().trim()] = updatedRecord;
      }
      this.saveAllDownloads(records);

      // محاولة مزامنة السجل مع قاعدة بيانات Supabase إن أمكن
      if (isSupabaseConfigured && supabase && isValidUuid(userId)) {
        try {
          await supabase
            .from('profiles')
            .update({
              has_downloaded_files: true,
              downloaded_files_count: updatedRecord.downloadCount,
              last_downloaded_at: now,
              downloaded_files: updatedRecord.files.slice(-25), // حفظ آخر 25 ملف
            })
            .eq('id', userId);
        } catch (supErr) {
          // تجاهل صامت في حال عدم إضافة الأعمدة بعد في Supabase
          console.debug('[downloadTrackingService] Supabase column sync optional notice:', supErr);
        }
      }

      // إطلاق حدث عام للمتصفح لتحديث واجهات الإدارة والرتب فوراً في الزمن الحقيقي
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('tarqa_download_tracked', {
            detail: { userId, file: newFileEntry, totalCount: updatedRecord.downloadCount },
          })
        );
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('storage'));
      }

      console.log(`[downloadTrackingService] Download tracked successfully for ${userName} (${newFileEntry.title})`);
      return { success: true, record: updatedRecord };
    } catch (err) {
      console.error('[downloadTrackingService] Error tracking download:', err);
      return { success: false };
    }
  }

  /**
   * مسح سجل تحميلات مستخدم (مخصص للمشرفين عند الحاجة لتصفير السجل)
   */
  async clearUserDownloads(userId: string, email?: string): Promise<boolean> {
    try {
      const records = this.getAllDownloads();
      delete records[userId];
      if (email) {
        delete records[email.toLowerCase().trim()];
      }
      this.saveAllDownloads(records);

      if (isSupabaseConfigured && supabase && isValidUuid(userId)) {
        try {
          await supabase
            .from('profiles')
            .update({
              has_downloaded_files: false,
              downloaded_files_count: 0,
              last_downloaded_at: null,
              downloaded_files: [],
            })
            .eq('id', userId);
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tarqa_roles_changed'));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * محاكاة إضافة تحميل تجريبي لمستخدم (لتمكين الأدمن من تجربة الميزة والتحقق منها فوراً)
   */
  async simulateUserDownload(
    user: UserWithRole,
    fileTitle: string = 'مذكرة التأسيس الشاملة 2025 (تجريبي)'
  ): Promise<boolean> {
    const res = await this.trackDownload(
      {
        id: 'mock-' + Date.now(),
        title: fileTitle,
        fileType: 'pdf',
        fileSize: '3.4 MB',
      },
      user
    );
    return res.success;
  }
}

export const downloadTrackingService = new DownloadTrackingService();
