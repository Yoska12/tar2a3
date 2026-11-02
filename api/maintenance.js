// Vercel Serverless Function: /api/maintenance
// Centralized Database & Backend-backed Site Maintenance Status
// Strictly removes cookies and client-only state reliance

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://djkwgwdlygxqcateivbc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_kC-Ok9GoiYyg3ffh0rpyXg_mS8fY8Gm';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
    });
  } catch (e) {
    console.warn('[maintenance API] Supabase client init note:', e);
  }
}

const DEFAULT_CONFIG = {
  isEnabled: false,
  title: 'المنصة تخضع حالياً لأعمال صيانة وتطوير دوري 🛠️',
  message: 'يقوم فريق طرقع الآن بإجراء تحديثات وتحسينات شاملة على خوادم المنصة وبنك الأسئلة لضمان تقديم أفضل تجربة تعليمية فائقة السرعة. سنعود للعمل بكامل طاقتنا في أقرب وقت ممكن!',
  estimatedReturnTime: 'اليوم خلال ساعتين',
  supportUrl: 'https://t.me/tr23km',
  supportButtonText: 'متابعة آخر التحديثات عبر تليجرام 💬',
  allowAdminBypass: true,
  reasonPreset: 'routine',
  updatedAt: new Date().toISOString()
};

function getLocalConfigFilePath() {
  return path.resolve(process.cwd(), 'public', 'api', 'maintenance_config.json');
}

function readLocalConfigFile() {
  try {
    const filePath = getLocalConfigFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function writeLocalConfigFile(config) {
  try {
    const filePath = getLocalConfigFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Fetch current maintenance status from database
  if (req.method === 'GET') {
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('platform_settings')
          .select('value, updated_at')
          .eq('key', 'maintenance')
          .maybeSingle();

        if (!error && data?.value && typeof data.value.isEnabled === 'boolean') {
          return res.status(200).json({
            ...DEFAULT_CONFIG,
            ...data.value,
            updatedAt: data.value.updatedAt || data.updated_at || new Date().toISOString()
          });
        }
      } catch (dbErr) {
        console.warn('[maintenance API] Database fetch note:', dbErr?.message);
      }
    }

    // Fallback: Read from persistent JSON file
    const fileConf = readLocalConfigFile();
    return res.status(200).json(fileConf);
  }

  // 2. POST: Update maintenance status and persist directly to database & backend file
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const current = readLocalConfigFile();

      const updated = {
        ...current,
        isEnabled: typeof body.isEnabled === 'boolean' ? body.isEnabled : current.isEnabled,
        title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.title,
        message: typeof body.message === 'string' && body.message.trim() ? body.message.trim() : current.message,
        estimatedReturnTime: typeof body.estimatedReturnTime === 'string' ? body.estimatedReturnTime.trim() : current.estimatedReturnTime,
        supportUrl: typeof body.supportUrl === 'string' ? body.supportUrl.trim() : current.supportUrl,
        supportButtonText: typeof body.supportButtonText === 'string' ? body.supportButtonText.trim() : current.supportButtonText,
        allowAdminBypass: true,
        reasonPreset: body.reasonPreset || current.reasonPreset || 'routine',
        updatedAt: new Date().toISOString()
      };

      // 1. Persist to Supabase platform_settings table
      if (supabase) {
        try {
          await supabase
            .from('platform_settings')
            .upsert({
              key: 'maintenance',
              value: updated,
              updated_at: updated.updatedAt,
              updated_by: body.userEmail || body.userId || 'admin'
            });
        } catch (dbSaveErr) {
          console.warn('[maintenance API] Supabase upsert note:', dbSaveErr?.message);
        }
      }

      // 2. Persist to local disk file
      writeLocalConfigFile(updated);

      return res.status(200).json({ success: true, config: updated });
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
