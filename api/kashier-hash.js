import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    const { orderId, amount, currency, merchantId } = body;
    if (!orderId || amount === undefined) {
      return res.status(400).json({ error: 'Missing orderId or amount' });
    }

    const mid = (merchantId || process.env.KASHIER_MERCHANT_ID || 'MID-50598-297').trim();
    const curr = (currency || 'EGP').trim().toUpperCase();
    const secretKey = (process.env.KASHIER_IFRAME_KEY || process.env.KASHIER_SECRET_KEY || '91bdc6e4-423d-4bcb-91ef-a27485a465d1').trim();
    const numericAmount = typeof amount === 'number' ? amount : parseFloat(String(amount));
    const formattedAmount = isNaN(numericAmount) ? '1' : (numericAmount % 1 === 0 ? numericAmount.toString() : numericAmount.toFixed(2));

    const path = `/?payment=${mid}.${orderId}.${formattedAmount}.${curr}`;
    const hash = crypto.createHmac('sha256', secretKey).update(path).digest('hex');

    const queryPath = `?payment=mid=${mid}&orderId=${orderId}&amount=${formattedAmount}&currency=${curr}`;
    const queryHash = crypto.createHmac('sha256', secretKey).update(queryPath).digest('hex');

    const baseUrl = (process.env.KASHIER_BASE_URL || 'https://payments.kashier.io').replace(/\/+$/, '');
    const checkoutUrl = `${baseUrl}/?merchantId=${mid}&order=${orderId}&orderId=${orderId}&amount=${formattedAmount}&currency=${curr}&mode=live&hash=${hash}&merchantRedirect=${encodeURIComponent('https://tarqa3.net/?payment=kashier_done&order=' + orderId)}`;

    return res.status(200).json({
      success: true,
      hash,
      path,
      queryPath,
      queryHash,
      merchantId: mid,
      orderId,
      amount: formattedAmount,
      currency: curr,
      checkoutUrl,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error generating hash' });
  }
}
