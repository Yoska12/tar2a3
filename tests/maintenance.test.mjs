import test from 'node:test';
import assert from 'node:assert/strict';
import maintenanceHandler from '../api/maintenance.js';

function createMockReqRes(method, body = {}, query = {}) {
  const req = {
    method,
    body,
    query,
  };

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      this.headers[name] = val;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };

  return { req, res };
}

test('Maintenance API: GET returns valid maintenance config with default isEnabled: false', async () => {
  const { req, res } = createMockReqRes('GET');
  await maintenanceHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.ok(res.body);
  assert.equal(typeof res.body.isEnabled, 'boolean');
  assert.equal(typeof res.body.title, 'string');
  assert.equal(typeof res.body.message, 'string');
});

test('Maintenance API: POST updates maintenance config and persists state', async () => {
  const customTitle = 'صيانة تحديث دوري تجريبي';
  const { req: postReq, res: postRes } = createMockReqRes('POST', {
    isEnabled: true,
    title: customTitle,
    estimatedReturnTime: 'خلال 30 دقيقة',
  });
  await maintenanceHandler(postReq, postRes);
  assert.equal(postRes.statusCode, 200);
  assert.equal(postRes.body.success, true);
  assert.equal(postRes.body.config.isEnabled, true);
  assert.equal(postRes.body.config.title, customTitle);

  // Subsequent GET should return the updated config
  const { req: getReq, res: getRes } = createMockReqRes('GET');
  await maintenanceHandler(getReq, getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.isEnabled, true);
  assert.equal(getRes.body.title, customTitle);

  // Restore to false
  const { req: resetReq, res: resetRes } = createMockReqRes('POST', {
    isEnabled: false,
    title: 'المنصة تخضع حالياً لأعمال صيانة وتطوير دوري 🛠️',
  });
  await maintenanceHandler(resetReq, resetRes);
  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.body.config.isEnabled, false);

  const { req: finalGetReq, res: finalGetRes } = createMockReqRes('GET');
  await maintenanceHandler(finalGetReq, finalGetRes);
  assert.equal(finalGetRes.body.isEnabled, false);
});

test('Maintenance API: OPTIONS returns 200 for CORS preflight', async () => {
  const { req, res } = createMockReqRes('OPTIONS');
  await maintenanceHandler(req, res);
  assert.equal(res.statusCode, 200);
});
