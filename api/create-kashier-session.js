// Vercel Serverless Function: create-kashier-session
// Handles Kashier Payment Sessions API calls securely without exposing the secret key to the browser.

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, api-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body || {};
    const {
      settingsMode,
      customApiKey,
      customSecretKey,
      customMerchantId,
      ...kashierPayload
    } = body;

    const mode = settingsMode || process.env.KASHIER_MODE || 'test';
    const merchantId = customMerchantId || process.env.KASHIER_MERCHANT_ID || 'MID-TARQA-TEST';
    const apiKey = customApiKey || process.env.KASHIER_API_KEY || '';
    const secretKey = customSecretKey || process.env.KASHIER_SECRET_KEY || '';

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
