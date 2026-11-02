// Vercel Serverless Function: /api/track-download
// Tracks and records file downloads by students with full audit details

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

// In-memory fallback for serverless instances
let globalDownloadsStore = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Fetch all recorded downloads
  if (req.method === 'GET') {
    let cloudDownloads = { ...globalDownloadsStore };

    if (supabase) {
      try {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, telegram_username, telegram_id, has_downloaded_files, downloaded_files_count, last_downloaded_at, downloaded_files')
          .or('has_downloaded_files.eq.true,downloaded_files_count.gt.0');

        if (!error && profiles) {
          for (const p of profiles) {
            const key = p.id || (p.email ? p.email.toLowerCase().trim() : null);
            if (!key) continue;
            cloudDownloads[key] = {
              userId: p.id,
              userEmail: p.email,
              userName: p.full_name || 'طالب طرقع',
              telegramUsername: p.telegram_username,
              downloadCount: Number(p.downloaded_files_count) || (p.has_downloaded_files ? 1 : 0),
              lastDownloadedAt: p.last_downloaded_at || new Date().toISOString(),
              files: Array.isArray(p.downloaded_files) ? p.downloaded_files : [],
            };
            if (p.email) cloudDownloads[p.email.toLowerCase().trim()] = cloudDownloads[key];
          }
        }
      } catch (e) {
        console.warn('[track-download API] Supabase fetch error:', e);
      }
    }

    return res.status(200).json({
      success: true,
      totalUsersWithDownloads: Object.keys(cloudDownloads).length,
      users: cloudDownloads,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. POST: Record a new download
  if (req.method === 'POST') {
    const payload = req.body || {};
    const {
      fileId = `file-${Date.now()}`,
      fileTitle = 'مذكرة دراسية',
      fileUrl = '',
      fileType = 'pdf',
      fileSize = 'PDF',
      userId = 'guest-student',
      userEmail = '',
      userName = 'طالب طرقع',
      telegramUsername = '',
    } = payload;

    const now = new Date().toISOString();
    const newFileEntry = {
      id: fileId,
      title: fileTitle,
      fileUrl,
      fileType,
      fileSize,
      downloadedAt: now,
    };

    const primaryKey = (userId !== 'guest-student' && userId) ? userId : (userEmail ? userEmail.toLowerCase().trim() : `guest-${Date.now()}`);

    const existing = globalDownloadsStore[primaryKey] || (userEmail ? globalDownloadsStore[userEmail.toLowerCase().trim()] : null);
    let updatedRecord;

    if (existing) {
      updatedRecord = {
        ...existing,
        userId: (userId !== 'guest-student' && userId) ? userId : existing.userId,
        userEmail: userEmail || existing.userEmail,
        userName: (userName !== 'طالب طرقع' && userName) ? userName : existing.userName,
        downloadCount: (existing.downloadCount || 0) + 1,
        lastDownloadedAt: now,
        files: [...(existing.files || []), newFileEntry],
      };
    } else {
      updatedRecord = {
        userId,
        userEmail,
        userName,
        telegramUsername,
        downloadCount: 1,
        lastDownloadedAt: now,
        files: [newFileEntry],
      };
    }

    globalDownloadsStore[primaryKey] = updatedRecord;
    if (userEmail) {
      globalDownloadsStore[userEmail.toLowerCase().trim()] = updatedRecord;
    }

    // Update Supabase if configured (bypassing RLS with server service role)
    if (supabase) {
      try {
        const updatePayload = {
          has_downloaded_files: true,
          downloaded_files_count: updatedRecord.downloadCount,
          last_downloaded_at: now,
          downloaded_files: updatedRecord.files.slice(-25),
          updated_at: now,
        };

        if (userId && userId !== 'guest-student') {
          await supabase.from('profiles').update(updatePayload).eq('id', userId);
        }
        if (userEmail) {
          await supabase.from('profiles').update(updatePayload).ilike('email', userEmail.trim());
        }

        // Also update central store
        const { data: storeRow } = await supabase
          .from('profiles')
          .select('ban_reason')
          .eq('email', 'admin@tarqa.app')
          .maybeSingle();

        let currentStore = {};
        if (storeRow?.ban_reason) {
          try { currentStore = JSON.parse(storeRow.ban_reason); } catch {}
        }
        const existingDownloads = currentStore.downloads || {};
        existingDownloads[primaryKey] = updatedRecord;
        if (userEmail) existingDownloads[userEmail.toLowerCase().trim()] = updatedRecord;

        await supabase
          .from('profiles')
          .update({
            ban_reason: JSON.stringify({ ...currentStore, downloads: existingDownloads, updatedAt: now }),
            updated_at: now,
          })
          .eq('email', 'admin@tarqa.app');
      } catch (supErr) {
        console.warn('[track-download API] Supabase update notice:', supErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل التحميل بنجاح في السيرفر',
      record: updatedRecord,
    });
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
