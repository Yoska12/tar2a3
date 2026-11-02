/**
 * ==============================================================================
 * منصة طرقع - بوابة تليجرام الآمنة (Serverless Node.js Gateway)
 * ==============================================================================
 */

const crypto = require('crypto');

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8848350461:AAEcKW2rMOYlv3HD7YKpKgf1BVaCtRX-O4k';
const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME || 'Tarqa3bot';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'active',
      bot: '@' + TELEGRAM_BOT_USERNAME,
      secure_gateway: true,
      timestamp: new Date().toISOString(),
    });
  }

  const body = req.body || {};
  const action = req.query?.action || body.action || 'send_message';

  if (action === 'verify_auth' || action === 'verify') {
    const authData = { ...(body.authData || body) };
    const hash = authData.hash;

    if (!hash) {
      return res.status(400).json({ ok: false, isValid: false, error: 'Missing hash' });
    }

    const authDate = Number(authData.auth_date || 0);
    const now = Math.floor(Date.now() / 1000);
    if (authDate > 0 && now - authDate > 86400) {
      return res.status(200).json({ ok: false, isValid: false, error: 'Authentication data expired' });
    }

    delete authData.hash;
    delete authData.action;

    const dataCheckArr = Object.keys(authData)
      .filter((k) => authData[k] !== undefined && authData[k] !== null && authData[k] !== '')
      .sort()
      .map((k) => `${k}=${authData[k]}`);

    const dataCheckString = dataCheckArr.join('\n');
    const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    const isValid = calculatedHash.toLowerCase() === hash.toLowerCase();

    return res.status(200).json({
      ok: true,
      isValid,
      user: isValid
        ? {
            id: Number(authData.id),
            first_name: authData.first_name || '',
            last_name: authData.last_name || '',
            username: authData.username || '',
            photo_url: authData.photo_url || '',
            auth_date: authDate,
          }
        : null,
      error: isValid ? null : 'Invalid Telegram signature',
    });
  }

  if (action === 'send_message' || action === 'send') {
    const chatId = body.chat_id || body.chatId;
    const text = body.text;
    const parseMode = body.parse_mode || body.parseMode || 'HTML';

    if (!chatId || !text) {
      return res.status(400).json({ ok: false, error: 'chat_id and text are required' });
    }

    const resolvedChatId = chatId === 'admin' ? (process.env.TELEGRAM_ADMIN_CHAT_ID || '8848350461') : chatId;

    try {
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: resolvedChatId,
          text,
          parse_mode: parseMode,
          disable_web_page_preview: true,
        }),
      });

      const data = await tgRes.json().catch(() => ({}));
      return res.status(200).json({ ok: Boolean(data.ok), description: data.description });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unknown action' });
};
