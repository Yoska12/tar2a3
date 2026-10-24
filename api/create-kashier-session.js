// Vercel Serverless Function: create-kashier-session
// Handles Kashier Payment Sessions API calls securely without exposing the secret key to the browser.

export default async function handler(req, res) {
  // CORS Headers compliant with W3C / Fetch standard & ALLOWED_ORIGINS
  const origin = req.headers.origin || req.headers.Origin;
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : [];

  if (origin) {
    const isAllowed = allowedOriginsEnv.length === 0 || allowedOriginsEnv.includes(origin) || allowedOriginsEnv.includes('*');
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', allowedOriginsEnv[0] || origin);
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, PATCH, DELETE, POST, PUT, HEAD');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, api-key, Range'
  );
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }
    body = body || {};

    const {
      settingsMode,
      customApiKey,
      customSecretKey,
      customMerchantId,
      ...kashierPayload
    } = body;

    const mode = settingsMode || process.env.KASHIER_MODE || 'test';
    const merchantId = customMerchantId || process.env.KASHIER_MERCHANT_ID || 'MID-50598-297';
    const apiKey = customApiKey || process.env.KASHIER_API_KEY || '980f3d9b-9782-40a0-ad47-f49ae98fdbb7';
    const secretKey = customSecretKey || process.env.KASHIER_SECRET_KEY || '6ec661c17fe95a9faae76df553f6ecb6$c02d309b502aa7a0f1eb27dbdb37f61f58e17df14f8a04b43ffa526a9e51b2f9281357acae5ca6412eb4ba540b919776';

    // Choose Kashier official endpoint based on mode
    const endpoint = mode === 'live'
      ? 'https://api.kashier.io/v3/payment/sessions'
      : 'https://test-api.kashier.io/v3/payment/sessions';

    // If no real secret key is configured, return simulated response for development
    if (!secretKey || !apiKey || merchantId.includes('TARQA-TEST')) {
      const order = kashierPayload.order || `tarqa_${Date.now()}`;
      return res.status(200).json({
        success: true,
        sessionUrl: `https://payments.kashier.io/session/simulated-${order}?mode=test`,
        isSimulated: true,
        message: 'Kashier simulated session (Add real keys in Admin Panel to go live)',
      });
    }

    const finalPayload = {
      ...kashierPayload,
      merchantId,
    };

    const kashierResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': secretKey,
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalPayload),
    });

    const data = await kashierResponse.json();

    if (!kashierResponse.ok) {
      return res.status(kashierResponse.status).json({
        error: 'Kashier API rejected request',
        details: data,
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Error creating Kashier session:', error);
    return res.status(500).json({
      error: 'Internal server error while connecting to Kashier',
      details: error.message,
    });
  }
}
