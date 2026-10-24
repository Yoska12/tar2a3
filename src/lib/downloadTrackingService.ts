import { authService, supabase, isSupabaseConfigured, isValidUuid, TarqaUser } from './supabase';
import { StudentDownloadedFile, UserWithRole } from '../types';
import { CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL } from './subscriptionService';

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
   * مزامنة السجلات مع السحابة المركزية (Supabase Cloud Store) لضمان ظهور كافة التحميلات في لوحة تحكم الأدمن فوراً
   */
  async syncDownloadsToCloud(newRecord?: UserDownloadRecord): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    try {
      const localRecords = this.getAllDownloads();

      // جلب السجلات السحابية الحالية لدمجها دون مسح أي تحميل سابق
      const { data } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      let currentPayload: any = {};
      if (data?.ban_reason) {
        try {
          currentPayload = JSON.parse(data.ban_reason);
        } catch {}
      }

      const existingCloudDownloads: Record<string, UserDownloadRecord> = currentPayload?.downloads || {};
      const merged: Record<string, UserDownloadRecord> = { ...existingCloudDownloads, ...localRecords };

      if (newRecord) {
        if (newRecord.userId) merged[newRecord.userId] = newRecord;
        if (newRecord.userEmail) merged[newRecord.userEmail.toLowerCase().trim()] = newRecord;
      }

      const updatedPayload = {
        ...currentPayload,
        downloads: merged,
        updatedAt: new Date().toISOString(),
      };

      await supabase
        .from('profiles')
        .update({
          ban_reason: JSON.stringify(updatedPayload),
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', CLOUD_LECTURES_STORE_ID);
    } catch (e) {
      console.warn('[downloadTrackingService] Cloud sync notice:', e);
    }
  }

  /**
   * جلب ومزامنة كافة التحميلات من السحابة (تستدعيها لوحة التحكم تلقائياً)
   */
  async syncDownloadsFromCloud(): Promise<Record<string, UserDownloadRecord>> {
    if (!isSupabaseConfigured || !supabase) return this.getAllDownloads();
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('ban_reason')
        .eq('id', CLOUD_LECTURES_STORE_ID)
        .maybeSingle();

      let targetData = data;
      if (error || !targetData?.ban_reason) {
        const { data: byEmail } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('email', CLOUD_LECTURES_STORE_EMAIL)
          .maybeSingle();
        targetData = byEmail;
      }

      if (targetData?.ban_reason) {
        try {
          const parsed = JSON.parse(targetData.ban_reason);
          if (parsed && typeof parsed === 'object' && parsed.downloads) {
            const cloudDownloads = parsed.downloads as Record<string, UserDownloadRecord>;
            const local = this.getAllDownloads();
            const merged = { ...local, ...cloudDownloads };
            this.saveAllDownloads(merged);
            return merged;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[downloadTrackingService] syncDownloadsFromCloud notice:', e);
    }
    return this.getAllDownloads();
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
        // تجنب تكرار التسجيل لنفس الملف إذا تم النقر عليه خلال ثانيتين
        const lastFile = existing.files[existing.files.length - 1];
        const isRecentDuplicate =
          lastFile &&
          lastFile.title === newFileEntry.title &&
          Date.now() - new Date(lastFile.downloadedAt).getTime() < 2000;

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

      // 1. مزامنة مباشرة مع صف جدول profiles للمستخدم في Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          if (isValidUuid(userId)) {
            await supabase
              .from('profiles')
              .update({
                has_downloaded_files: true,
                downloaded_files_count: updatedRecord.downloadCount,
                last_downloaded_at: now,
                downloaded_files: updatedRecord.files.slice(-25),
              })
              .eq('id', userId);
          }
          if (userEmail) {
            await supabase
              .from('profiles')
              .update({
                has_downloaded_files: true,
                downloaded_files_count: updatedRecord.downloadCount,
                last_downloaded_at: now,
                downloaded_files: updatedRecord.files.slice(-25),
              })
              .ilike('email', userEmail.trim());
          }
        } catch (supErr) {
          console.debug('[downloadTrackingService] Supabase profile update notice:', supErr);
        }

        // 2. مزامنة فورية في السحابة المركزية لضمان وصول التنبيه لكافة لوحات الأدمن
        this.syncDownloadsToCloud(updatedRecord).catch(() => {});
      }

      // 3. إطلاق حدث عام للمتصفح لتحديث واجهات الإدارة والرتب فوراً في الزمن الحقيقي
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
   * مسح وتصفير سجل تحميلات مستخدم بالكامل (محلياً وسحابياً)
   */
  async clearUserDownloads(userId: string, email?: string): Promise<boolean> {
    try {
      const emailClean = email ? email.toLowerCase().trim() : '';
      
      // 1. مسح من السجل المحلي
      const records = this.getAllDownloads();
      delete records[userId];
      if (emailClean) {
        delete records[emailClean];
      }
      this.saveAllDownloads(records);

      // 2. تحديث قوائم المستخدمين المحلية
      try {
        const rolesRaw = localStorage.getItem('tarqa_all_users_roles');
        if (rolesRaw) {
          const list = JSON.parse(rolesRaw);
          if (Array.isArray(list)) {
            const updated = list.map((u: any) => {
              if (u.id === userId || (emailClean && u.email?.toLowerCase().trim() === emailClean)) {
                return {
                  ...u,
                  hasDownloadedFiles: false,
                  downloadedFilesCount: 0,
                  lastDownloadedAt: undefined,
                  downloadedFiles: [],
                };
              }
              return u;
            });
            localStorage.setItem('tarqa_all_users_roles', JSON.stringify(updated));
          }
        }
      } catch {}

      // 3. مسح من السحابة المركزية (Cloud Store)
      if (isSupabaseConfigured && supabase) {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('ban_reason')
            .eq('id', CLOUD_LECTURES_STORE_ID)
            .maybeSingle();

          if (data?.ban_reason) {
            try {
              const parsed = JSON.parse(data.ban_reason);
              if (parsed?.downloads) {
                delete parsed.downloads[userId];
                if (emailClean) {
                  delete parsed.downloads[emailClean];
                }
                await supabase
                  .from('profiles')
                  .update({
                    ban_reason: JSON.stringify(parsed),
                    updated_at: new Date().toISOString(),
                  } as any)
                  .eq('id', CLOUD_LECTURES_STORE_ID);
              }
            } catch {}
          }
        } catch (e) {
          console.warn('[downloadTrackingService] Cloud delete notice:', e);
        }

        // 4. تصفير صف المستخدم في Supabase profiles
        try {
          if (isValidUuid(userId)) {
            await supabase
              .from('profiles')
              .update({
                has_downloaded_files: false,
                downloaded_files_count: 0,
                last_downloaded_at: null,
                downloaded_files: [],
              })
              .eq('id', userId);
          }
          if (emailClean) {
            await supabase
              .from('profiles')
              .update({
                has_downloaded_files: false,
                downloaded_files_count: 0,
                last_downloaded_at: null,
                downloaded_files: [],
              })
              .ilike('email', emailClean);
          }
        } catch {}
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('tarqa_roles_changed'));
        window.dispatchEvent(new Event('tarqa_user_changed'));
        window.dispatchEvent(new Event('storage'));
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
