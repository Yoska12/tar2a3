import test from 'node:test';
import assert from 'node:assert/strict';
import downloadHandler from '../api/download.js';

// Test isOwnerEmail canonical rules
const OWNER_EMAILS = Object.freeze([
  'yassooooo27m@gmail.com',
  'iyoskalg@gmail.com',
]);

const isOwnerEmail = (email) => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return OWNER_EMAILS.includes(normalized);
};

test('Security: isOwnerEmail canonical verification', () => {
  assert.equal(isOwnerEmail('yassooooo27m@gmail.com'), true);
  assert.equal(isOwnerEmail('iyoskalg@gmail.com'), true);
  assert.equal(isOwnerEmail('  YASSOOOOO27M@GMAIL.COM  '), true);
  assert.equal(isOwnerEmail(' IYOSKALG@GMAIL.COM '), true);

  // Negative cases
  assert.equal(isOwnerEmail('attacker@evil.com'), false);
  assert.equal(isOwnerEmail('yassooooo27m@gmail.com.attacker.com'), false);
  assert.equal(isOwnerEmail(''), false);
  assert.equal(isOwnerEmail(null), false);
  assert.equal(isOwnerEmail(undefined), false);
});

test('Security: api/download.js rejects SSRF and internal IPs', async () => {
  const testCases = [
    { url: 'http://127.0.0.1/secrets', expectedStatus: 403 },
    { url: 'http://localhost/admin', expectedStatus: 403 },
    { url: 'http://169.254.169.254/latest/meta-data/', expectedStatus: 403 },
    { url: 'http://10.0.0.5/internal', expectedStatus: 403 },
    { url: 'http://192.168.1.100/router', expectedStatus: 403 },
    { url: 'http://172.20.0.1/private', expectedStatus: 403 },
    { url: 'file:///etc/passwd', expectedStatus: 400 },
    { url: 'ftp://ftp.server.com/data', expectedStatus: 400 },
    { url: 'http://attacker-controlled-site.com/exploit', expectedStatus: 403 },
  ];

  for (const tc of testCases) {
    let statusCode = 200;
    let jsonResponse = null;

    const req = {
      method: 'GET',
      headers: {},
      query: { url: tc.url, filename: 'test.pdf' },
    };

    const res = {
      setHeader: () => {},
      status: (code) => {
        statusCode = code;
        return {
          json: (data) => { jsonResponse = data; },
          end: () => {},
        };
      },
    };

    await downloadHandler(req, res);
    assert.equal(
      statusCode,
      tc.expectedStatus,
      `Expected status ${tc.expectedStatus} for ${tc.url}, got ${statusCode} (${JSON.stringify(jsonResponse)})`
    );
  }
});

test('Security: api/download.js allows legitimate whitelisted domains', async () => {
  // Test domain check logic on whitelisted host (will attempt fetch or return appropriate response)
  const req = {
    method: 'GET',
    headers: {},
    query: { url: 'https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css', filename: 'katex.css' },
  };

  let statusCode = 200;
  const headers = {};

  const res = {
    setHeader: (key, val) => { headers[key] = val; },
    status: (code) => {
      statusCode = code;
      return {
        json: () => {},
        end: () => {},
      };
    },
    pipe: () => {},
    send: () => {},
    write: () => true,
    end: () => {},
  };

  await downloadHandler(req, res);
  // Status should be 200 for a successful fetch from cdn.jsdelivr.net
  assert.equal(statusCode, 200);
});
