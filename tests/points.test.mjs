import test from 'node:test';
import assert from 'node:assert/strict';
import pointsHandler from '../api/points.js';

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

test('Points API: rejects POST requests with missing userId and email', async () => {
  const { req, res } = createMockReqRes('POST', { amount: 50 });
  await pointsHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
});

test('Points API: adds points strictly bound to specific user account', async () => {
  const user1 = 'student-uuid-001';
  const user2 = 'student-uuid-002';

  // Add 100 points to user1
  const { req: req1, res: res1 } = createMockReqRes('POST', {
    userId: user1,
    userEmail: 'student1@tarqa.app',
    amount: 100,
    action: 'add',
    reason: 'إكمال اختبار تجريبي',
  });
  await pointsHandler(req1, res1);
  assert.equal(res1.statusCode, 200);
  assert.equal(res1.body.points, 100);

  // Add 50 points to user2
  const { req: req2, res: res2 } = createMockReqRes('POST', {
    userId: user2,
    userEmail: 'student2@tarqa.app',
    amount: 50,
    action: 'add',
    reason: 'جلسة بومودورو',
  });
  await pointsHandler(req2, res2);
  assert.equal(res2.statusCode, 200);
  assert.equal(res2.body.points, 50);

  // Verify user1 and user2 have separate, non-overlapping balances
  const { req: getReq1, res: getRes1 } = createMockReqRes('GET', {}, { userId: user1 });
  await pointsHandler(getReq1, getRes1);
  assert.equal(getRes1.body.points, 100);

  const { req: getReq2, res: getRes2 } = createMockReqRes('GET', {}, { userId: user2 });
  await pointsHandler(getReq2, getRes2);
  assert.equal(getRes2.body.points, 50);
});

test('Points API: resets points for a specific user without affecting others', async () => {
  const user1 = 'student-uuid-001';
  const user2 = 'student-uuid-002';

  // Reset user1 to 0
  const { req: resetReq, res: resetRes } = createMockReqRes('POST', {
    userId: user1,
    action: 'reset',
  });
  await pointsHandler(resetReq, resetRes);
  assert.equal(resetRes.statusCode, 200);
  assert.equal(resetRes.body.points, 0);

  // Verify user1 is 0 but user2 still retains 50 points
  const { req: check1, res: checkRes1 } = createMockReqRes('GET', {}, { userId: user1 });
  await pointsHandler(check1, checkRes1);
  assert.equal(checkRes1.body.points, 0);

  const { req: check2, res: checkRes2 } = createMockReqRes('GET', {}, { userId: user2 });
  await pointsHandler(check2, checkRes2);
  assert.equal(checkRes2.body.points, 50);
});
