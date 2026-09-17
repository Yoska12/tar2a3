// Vercel Serverless Function: /api/download
// Provides bulletproof HTTP headers for reliable mobile downloads (iOS Safari & Android Chrome)

export default async function handler(req, res) {
  // 1. CORS Headers to allow fetching from any frontend client
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Range, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, Content-Length, Content-Type, Accept-Ranges');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { url, filename, type } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing required parameter: url' });
  }

  try {
    // 2. Validate URL protocol and protect against SSRF
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Invalid URL protocol' });
    }

    const hostname = parsedUrl.hostname.toLowerCase();

    // Block private IP ranges, loopback, and cloud metadata addresses
    const isPrivateOrLoopback =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      hostname.endsWith('.internal') ||
      hostname.endsWith('.local') ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

    if (isPrivateOrLoopback) {
      return res.status(403).json({ error: 'Access to private network or metadata endpoints is forbidden' });
    }

    // Whitelist allowed storage and CDN domains
    const extraAllowed = (process.env.ALLOWED_DOWNLOAD_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    const isAllowedHost =
      hostname.endsWith('.supabase.co') ||
      hostname.endsWith('.supabase.in') ||
      hostname.endsWith('tarqa3.net') ||
      hostname.endsWith('.vercel-storage.com') ||
      hostname.endsWith('.blob.vercel-storage.com') ||
      hostname === 'cdn.jsdelivr.net' ||
      extraAllowed.some((d) => hostname === d || hostname.endsWith(`.${d}`));

    if (!isAllowedHost) {
      return res.status(403).json({ error: 'Forbidden download origin' });
    }

    // 3. Fetch the target file stream
    const upstreamResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Tarqa-Download-Service/1.0',
      },
    });

    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        error: `Failed to fetch file from source (${upstreamResponse.statusText})`,
      });
    }

    // 4. Resolve correct Content-Type
    const detectedType =
      type ||
      upstreamResponse.headers.get('content-type') ||
      'application/pdf';

    // 5. Sanitize and encode filename for RFC 6266 & RFC 5987 compliance (Supports Arabic & Unicode)
    const rawFileName = (typeof filename === 'string' && filename.trim())
      ? filename.trim()
      : 'tarqa_file.pdf';
    
    // ASCII fallback filename for legacy clients
    const asciiSafeName = rawFileName
      .replace(/[^\x20-\x7E]/g, '_')
      .replace(/["\\]/g, '') || 'download.pdf';

    // UTF-8 encoded filename for modern mobile browsers (Safari iOS & Android Chrome)
    const encodedUtf8Name = encodeURIComponent(rawFileName);

    // 6. Set Bulletproof HTTP Response Headers
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiSafeName}"; filename*=UTF-8''${encodedUtf8Name}`
    );
    res.setHeader('Content-Type', detectedType);

    const upstreamLength = upstreamResponse.headers.get('content-length');
    if (upstreamLength) {
      res.setHeader('Content-Length', upstreamLength);
    }

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'private, no-transform, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    // 7. Stream content directly to mobile client
    if (upstreamResponse.body) {
      const reader = upstreamResponse.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(Buffer.from(value));
        }
        res.end();
      };
      await pump();
    } else {
      const arrayBuffer = await upstreamResponse.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    }
  } catch (error) {
    console.error('[Download Handler Error]:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error during download proxy' });
    }
  }
}
