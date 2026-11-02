import { authService, supabase, isSupabaseConfigured, isValidUuid, TarqaUser } from './supabase';
import { StudentDownloadedFile, UserWithRole } from '../types';
import { CLOUD_LECTURES_STORE_ID, CLOUD_LECTURES_STORE_EMAIL } from './subscriptionService';
import { dbCache, invalidateUsersCache } from './dbCache';

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
   * جلب ومزامنة كافة التحميلات من السحابة والباك إند (تستدعيها لوحة التحكم تلقائياً)
   */
  async syncDownloadsFromCloud(): Promise<Record<string, UserDownloadRecord>> {
    const local = this.getAllDownloads();

    // 0. مزامنة فورية ومؤكدة مع الباك إند (Hostinger PHP Backend & Vercel API)
    try {
      let backendData: any = null;
      try {
        const phpRes = await fetch('/api/track-download.php');
        if (phpRes.ok) {
          backendData = await phpRes.json();
        }
      } catch {}

      if (!backendData || !backendData.users) {
        try {
          const vercelRes = await fetch('/api/track-download');
          if (vercelRes.ok) {
            backendData = await vercelRes.json();
          }
        } catch {}
      }

      if (backendData?.users && typeof backendData.users === 'object') {
        for (const [k, bRec] of Object.entries(backendData.users as Record<string, any>)) {
          if (!bRec) continue;
          const existing = local[k];
          const count = Math.max(
            Number(bRec.downloadCount) || (bRec.files?.length || 1),
            Number(existing?.downloadCount) || 0
          );
          const files = (bRec.files && Array.isArray(bRec.files) && bRec.files.length > (existing?.files?.length || 0))
            ? bRec.files
            : (existing?.files || []);

          const rec: UserDownloadRecord = {
            userId: bRec.userId || existing?.userId || k,
            userEmail: bRec.userEmail || existing?.userEmail,
            userName: (bRec.userName && bRec.userName !== 'طالب طرقع') ? bRec.userName : (existing?.userName || bRec.userName || 'طالب طرقع'),
            downloadCount: count > 0 ? count : 1,
            lastDownloadedAt: bRec.lastDownloadedAt || existing?.lastDownloadedAt || new Date().toISOString(),
            files,
          };

          local[k] = rec;
          if (bRec.userId) local[bRec.userId] = rec;
          if (bRec.userEmail) local[bRec.userEmail.toLowerCase().trim()] = rec;
          if (bRec.telegramUsername) local[bRec.telegramUsername.replace(/^@/, '').toLowerCase().trim()] = rec;
        }
      }
    } catch (bErr) {
      console.warn('[downloadTrackingService] Backend sync notice:', bErr);
    }

    if (!isSupabaseConfigured || !supabase) {
      this.saveAllDownloads(local);
      return local;
    }

    try {
      // 1. جلب مباشر لكافة الطلاب الذين قاموا بالتحميل من جدول profiles في Supabase
      try {
        const { data: profilesWithDownloads, error: pErr } = await supabase
          .from('profiles')
          .select('id, email, full_name, telegram_username, telegram_id, has_downloaded_files, downloaded_files_count, last_downloaded_at, downloaded_files')
          .or('has_downloaded_files.eq.true,downloaded_files_count.gt.0');

        if (!pErr && profilesWithDownloads && profilesWithDownloads.length > 0) {
          for (const p of profilesWithDownloads) {
            const key = p.id || (p.email ? p.email.toLowerCase().trim() : null);
            if (!key) continue;

            const existing = local[key] || {};
            const count = Math.max(
              Number(p.downloaded_files_count) || (p.has_downloaded_files ? 1 : 0),
              Number(existing.downloadCount) || 0
            );

            let files = existing.files || [];
            if (p.downloaded_files && Array.isArray(p.downloaded_files) && p.downloaded_files.length > 0) {
              files = p.downloaded_files;
            }

            const rec: UserDownloadRecord = {
              userId: p.id,
              userEmail: p.email || existing.userEmail,
              userName: (p.full_name && p.full_name !== 'طالب طرقع') ? p.full_name : (existing.userName || p.full_name || 'طالب طرقع'),
              downloadCount: count > 0 ? count : 1,
              lastDownloadedAt: p.last_downloaded_at || existing.lastDownloadedAt || new Date().toISOString(),
              files,
            };

            local[p.id] = rec;
            if (p.email) local[p.email.toLowerCase().trim()] = rec;
            if (p.telegram_username) local[p.telegram_username.replace(/^@/, '').toLowerCase().trim()] = rec;
            if (p.telegram_id) local[String(p.telegram_id)] = rec;
          }
        }
      } catch (profErr) {
        console.warn('[downloadTrackingService] Fetch profiles downloads notice:', profErr);
      }

      // 2. دمج التحميلات المسجلة في السحابة المركزية (CLOUD_LECTURES_STORE_ID)
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
            for (const [k, cRec] of Object.entries(cloudDownloads)) {
              if (!cRec) continue;
              const existing = local[k];
              if (!existing) {
                local[k] = cRec;
              } else {
                local[k] = {
                  ...existing,
                  downloadCount: Math.max(existing.downloadCount || 0, cRec.downloadCount || 0),
                  files: (cRec.files && cRec.files.length > (existing.files?.length || 0)) ? cRec.files : existing.files,
                  lastDownloadedAt: cRec.lastDownloadedAt || existing.lastDownloadedAt,
                };
              }
            }
          }
        } catch {}
      }

      this.saveAllDownloads(local);
      return local;
    } catch (e) {
      console.warn('[downloadTrackingService] syncDownloadsFromCloud notice:', e);
      return local;
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

      // 0. تسجيل مباشر ومؤكد في الباك إند (Hostinger PHP & Vercel API) لضمان ظهور التحميل في لوحة الأدمن دائماً
      const backendPayload = {
        userId,
        userEmail,
        userName,
        telegramUsername: (user as any)?.telegram_username || (user as any)?.telegramUsername || '',
        fileId: newFileEntry.id,
        fileTitle: newFileEntry.title,
        fileUrl: newFileEntry.fileUrl,
        fileType: newFileEntry.fileType,
        fileSize: newFileEntry.fileSize,
      };

      try {
        fetch('/api/track-download.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendPayload),
          keepalive: true,
        }).catch(() => {
          return fetch('/api/track-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(backendPayload),
            keepalive: true,
          });
        }).catch(() => {});
      } catch (postErr) {
        console.debug('[downloadTrackingService] Backend post notice:', postErr);
      }

      // 1. مزامنة مباشرة مع صف جدول profiles للمستخدم في Supabase
      if (isSupabaseConfigured && supabase) {
        try {
          const updatePayload: any = {
            has_downloaded_files: true,
            downloaded_files_count: updatedRecord.downloadCount,
            last_downloaded_at: now,
            downloaded_files: updatedRecord.files.slice(-25),
            updated_at: now,
          };

          if (isValidUuid(userId)) {
            await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('id', userId);
          }
          if (userEmail) {
            await supabase
              .from('profiles')
              .update(updatePayload)
              .ilike('email', userEmail.trim());
          }
          if ((user as any)?.telegramId) {
            await supabase
              .from('profiles')
              .update(updatePayload)
              .eq('telegram_id', (user as any).telegramId);
          }

          // محاولة استدعاء الدالة المباشرة RPC (Security Definer) إن وُجدت
          try {
            await supabase.rpc('track_file_download', {
              p_file_title: fileInfo.title || 'مذكرة دراسية',
              p_file_id: fileInfo.id || null,
              p_file_url: fileInfo.fileUrl || null,
              p_user_id: userId,
              p_user_email: userEmail || null,
            });
          } catch {}
        } catch (supErr) {
          console.debug('[downloadTrackingService] Supabase profile update notice:', supErr);
        }

        // 2. مزامنة فورية في السحابة المركزية لضمان وصول التنبيه لكافة لوحات الأدمن
        this.syncDownloadsToCloud(updatedRecord).catch(() => {});
      }

      // تفريغ كاش بيانات الأعضاء لضمان ظهور التحديث فوراً في لوحة الأدمن
      dbCache.invalidate('db_users_with_roles');
      invalidateUsersCache();

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
      
      // 0. مسح السجل من خادم الباك إند (Hostinger PHP Backend)
      try {
        fetch('/api/track-download.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear', userId, userEmail: emailClean }),
          keepalive: true,
        }).catch(() => {});
      } catch {}

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
