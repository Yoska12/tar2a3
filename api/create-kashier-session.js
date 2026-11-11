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

    const mode = settingsMode || process.env.KASHIER_MODE || 'live';
    const merchantId = customMerchantId || process.env.KASHIER_MERCHANT_ID || 'MID-50598-297';
    const apiKey = customApiKey || process.env.KASHIER_IFRAME_KEY || process.env.KASHIER_API_KEY || '91bdc6e4-423d-4bcb-91ef-a27485a465d1';
    const secretKey = customSecretKey || process.env.KASHIER_SECRET_KEY || 'b46424f4680afffc7f19ee0fcaa4ff68$fd7738111efb5531f2f08898775d3a3ebb735de9a628ff4acfda3cf098d91aea4a4100f86d1459c4cf06a590354d061b';

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

    const amountNum = parseFloat(kashierPayload.amount || 1100);
    const formattedAmount = isNaN(amountNum) ? '1100.00' : amountNum.toFixed(2);
    const orderId = kashierPayload.order || `TARQA3_${Date.now()}`;
    const customerEmail = (kashierPayload.customer && kashierPayload.customer.email) || 'student@tarqa.app';
    const customerRef = (kashierPayload.customer && kashierPayload.customer.reference) || `user_${Date.now()}`;

    const finalPayload = {
      ...kashierPayload,
      amount: formattedAmount,
      order: orderId,
      merchantId,
      customer: {
        email: customerEmail,
        reference: customerRef,
      },
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
      console.error('[Kashier] API error:', data);
      return res.status(kashierResponse.status || 400).json({
        success: false,
        error: data.message || 'Kashier session creation failed',
        data,
      });
    }

    return res.status(200).json({
      success: true,
      sessionUrl: data.sessionUrl,
      sessionId: data._id,
      orderId: orderId,
      data,
    });
  } catch (error) {
    console.error('Error creating Kashier session:', error);
    return res.status(500).json({
      error: 'Internal server error while connecting to Kashier',
      details: error.message,
    });
  }
}
