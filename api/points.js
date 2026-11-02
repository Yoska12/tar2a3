// Vercel Serverless Function: /api/points
// Manages and persists student points (XP) directly to database & cloud store
// Removes any device/cookie dependency

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

// In-memory cache for serverless instances
let globalPointsStore = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. GET: Fetch user points or entire leaderboard
  if (req.method === 'GET') {
    const { userId, email, action } = req.query || {};

    if (action === 'leaderboard') {
      let usersList = [];
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, email, full_name, role, points, avatar_url, telegram_username')
            .order('points', { ascending: false })
            .limit(100);

          if (!error && data) {
            usersList = data.map((u, idx) => ({
              rank: idx + 1,
              id: u.id,
              email: u.email,
              name: u.full_name || 'طالب طرقع',
              role: u.role || 'student',
              points: typeof u.points === 'number' ? u.points : 0,
              avatarUrl: u.avatar_url,
              telegramUsername: u.telegram_username,
            }));
          }
        } catch (e) {
          console.warn('[points API] Supabase leaderboard fetch error:', e);
        }
      }
      return res.status(200).json({ success: true, leaderboard: usersList });
    }

    const cleanUser = (userId || '').trim();
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanUser && !cleanEmail) {
      return res.status(200).json({ success: true, pointsStore: globalPointsStore });
    }

    // Attempt to query Supabase directly for authoritative points
    if (supabase) {
      try {
        let query = supabase.from('profiles').select('id, email, full_name, points, points_history');
        if (cleanUser && cleanUser.length > 20) {
          query = query.eq('id', cleanUser);
        } else if (cleanEmail) {
          query = query.ilike('email', cleanEmail);
        }

        const { data, error } = await query.maybeSingle();
        if (!error && data) {
          const pts = typeof data.points === 'number' ? data.points : 0;
          return res.status(200).json({
            success: true,
            userId: data.id,
            email: data.email,
            points: pts,
            history: Array.isArray(data.points_history) ? data.points_history : [],
          });
        }
      } catch (err) {
        console.warn('[points API] Supabase fetch error:', err);
      }
    }

    // Fallback to in-memory store
    const stored = (cleanUser && globalPointsStore[cleanUser]) || (cleanEmail && globalPointsStore[cleanEmail]) || { points: 0, history: [] };
    return res.status(200).json({
      success: true,
      userId: cleanUser,
      email: cleanEmail,
      points: stored.points || 0,
      history: stored.history || [],
    });
  }

  // 2. POST: Add or Reset points for a user
  if (req.method === 'POST') {
    const payload = req.body || {};
    const {
      userId = '',
      userEmail = '',
      action = 'add', // 'add' | 'reset' | 'set'
      amount = 0,
      reason = 'إضافة نقاط',
      category = 'bonus',
      points: explicitPoints,
    } = payload;

    const cleanId = (userId || '').trim();
    const cleanEmail = (userEmail || '').toLowerCase().trim();
    const primaryKey = cleanId || cleanEmail;

    if (!primaryKey) {
      return res.status(400).json({ success: false, message: 'userId or userEmail required' });
    }

    const currentRecord = globalPointsStore[primaryKey] || (cleanEmail ? globalPointsStore[cleanEmail] : null) || { points: 0, history: [] };
    let newPoints = currentRecord.points || 0;

    if (action === 'reset') {
      newPoints = 0;
    } else if (action === 'set') {
      newPoints = Math.max(0, Number(explicitPoints) || 0);
    } else {
      // add
      const toAdd = Math.max(0, Number(amount) || 0);
      newPoints = (currentRecord.points || 0) + toAdd;
    }

    const newTx = {
      id: 'tx-' + Date.now(),
      amount: action === 'reset' ? 0 : (action === 'set' ? newPoints : Number(amount)),
      reason,
      category,
      timestamp: new Date().toISOString(),
    };

    const updatedHistory = action === 'reset' ? [] : [newTx, ...(currentRecord.history || [])].slice(0, 50);

    const record = {
      userId: cleanId,
      userEmail: cleanEmail,
      points: newPoints,
      history: updatedHistory,
      updatedAt: new Date().toISOString(),
    };

    if (cleanId) globalPointsStore[cleanId] = record;
    if (cleanEmail) globalPointsStore[cleanEmail] = record;

    // Update Supabase profiles table
    if (supabase) {
      try {
        const updatePayload = {
          points: newPoints,
          points_history: updatedHistory,
          updated_at: new Date().toISOString(),
        };

        if (cleanId && cleanId.length > 20) {
          await supabase.from('profiles').update(updatePayload).eq('id', cleanId);
        }
        if (cleanEmail) {
          await supabase.from('profiles').update(updatePayload).ilike('email', cleanEmail);
        }
      } catch (e) {
        console.warn('[points API] Supabase update notice:', e);
      }
    }

    return res.status(200).json({
      success: true,
      userId: cleanId,
      email: cleanEmail,
      points: newPoints,
      transaction: newTx,
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
