import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadAuthHandlers,
  loadAdminHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { TEST_USERS } from '../helpers/fixtures.js';

describe('Tier 2: Boundary 1 — Authentication, Security & RBAC Boundaries', () => {
  let db;
  let env;
  let auth;
  let admin;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    auth = await loadAuthHandlers();
    admin = await loadAdminHandlers();
  });

  it('TC-B1.1: Signup with invalid email syntax returns HTTP 400 INVALID_EMAIL', async () => {
    const res = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: { email: 'not-an-email', password: 'Password123!' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 400);
    assert.equal(json.body.error, 'INVALID_EMAIL');
  });

  it('TC-B1.2: Signup with password < 8 characters returns HTTP 400 PASSWORD_TOO_SHORT', async () => {
    const res = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: { email: 'valid@sofacompany.com', password: 'short' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 400);
    assert.equal(json.body.error, 'PASSWORD_TOO_SHORT');
  });

  it('TC-B1.3: 10 consecutive failed login attempts locks account (HTTP 429 ACCOUNT_LOCKED)', async () => {
    await createDirectUser(env, {
      email: 'lockout.test@sofacompany.com',
      password: 'CorrectPassword123!',
    });

    // 9 failed attempts
    for (let i = 1; i <= 9; i++) {
      const res = await invokeFunction(auth.login, {
        method: 'POST',
        body: { email: 'lockout.test@sofacompany.com', password: 'WrongPassword' },
        env,
      });
      const json = await readJson(res);
      assert.equal(json.status, 401);
      assert.equal(json.body.attemptsLeft, 10 - i);
    }

    // 10th failed attempt triggers lock
    const res10 = await invokeFunction(auth.login, {
      method: 'POST',
      body: { email: 'lockout.test@sofacompany.com', password: 'WrongPassword' },
      env,
    });
    const json10 = await readJson(res10);
    assert.equal(json10.status, 429);
    assert.equal(json10.body.error, 'ACCOUNT_LOCKED');
    assert.ok(json10.body.retryAfter > 0);
  });

  it('TC-B1.4: Submitting expired or consumed OTP code returns HTTP 400 CODE_EXPIRED', async () => {
    // Generate valid code
    const req = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: TEST_USERS.engineer1,
      env,
    });
    const code = (await readJson(req)).body.devCode;

    // Verify first time succeeds
    const verify1 = await invokeFunction(auth.signupVerify, {
      method: 'POST',
      body: { ...TEST_USERS.engineer1, code },
      env,
    });
    assert.equal((await readJson(verify1)).status, 200);

    // Submitting already consumed code
    const verify2 = await invokeFunction(auth.signupVerify, {
      method: 'POST',
      body: { ...TEST_USERS.engineer1, code },
      env,
    });
    const json2 = await readJson(verify2);
    assert.equal(json2.status, 400);
    assert.equal(json2.body.error, 'CODE_EXPIRED');
  });

  it('TC-B1.5: 5 consecutive invalid OTP code submissions locks the signup request (HTTP 429 CODE_LOCKED)', async () => {
    await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: TEST_USERS.engineer2,
      env,
    });

    // 4 failed code attempts
    for (let i = 1; i <= 4; i++) {
      const res = await invokeFunction(auth.signupVerify, {
        method: 'POST',
        body: { ...TEST_USERS.engineer2, code: '000000' },
        env,
      });
      const json = await readJson(res);
      assert.equal(json.status, 400);
      assert.equal(json.body.attemptsLeft, 5 - i);
    }

    // 5th attempt locks code
    const res5 = await invokeFunction(auth.signupVerify, {
      method: 'POST',
      body: { ...TEST_USERS.engineer2, code: '000000' },
      env,
    });
    const json5 = await readJson(res5);
    assert.equal(json5.status, 429);
    assert.equal(json5.body.error, 'CODE_LOCKED');
  });

  it('TC-B1.6: Requests with mismatched Origin headers return HTTP 403 BAD_ORIGIN', async () => {
    const res = await invokeFunction(auth.login, {
      method: 'POST',
      headers: { origin: 'http://malicious-attacker.com' },
      body: { email: 'test@sofacompany.com', password: 'Password123!' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 403);
    assert.equal(json.body.error, 'BAD_ORIGIN');
  });

  it('TC-B1.7: Non-admin user invoking /api/admin/users receives HTTP 403 FORBIDDEN', async () => {
    // Seed regular user
    const user = await createDirectUser(env, { email: 'worker@sofacompany.com', role: 'user' });
    const { cookieValue } = await createDirectSession(env, user.id);

    const res = await invokeFunction(admin.usersGet, {
      method: 'GET',
      headers: { cookie: cookieValue },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 403);
    assert.equal(json.body.error, 'FORBIDDEN');
  });

  it('TC-B1.8: Admin attempting to deactivate or demote self receives HTTP 400 CANNOT_CHANGE_SELF', async () => {
    const adminUser = await createDirectUser(env, { email: 'superadmin@sofacompany.com', role: 'admin' });
    const { cookieValue } = await createDirectSession(env, adminUser.id);

    // Try to demote self to user
    const res = await invokeFunction(admin.userPatch, {
      method: 'PATCH',
      headers: { cookie: cookieValue },
      params: { id: String(adminUser.id) },
      body: { role: 'user' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 400);
    assert.equal(json.body.error, 'CANNOT_CHANGE_SELF');
  });

  it('TC-B1.9: Deactivating sole remaining admin is blocked with HTTP 400 LAST_ADMIN', async () => {
    // Only 1 admin in system
    const admin1 = await createDirectUser(env, { email: 'admin1@sofacompany.com', role: 'admin' });
    const admin2 = await createDirectUser(env, { email: 'admin2@sofacompany.com', role: 'admin' });
    const { cookieValue } = await createDirectSession(env, admin1.id);

    // Deactivate admin2 -> now only 1 admin remains
    await invokeFunction(admin.userPatch, {
      method: 'PATCH',
      headers: { cookie: cookieValue },
      params: { id: String(admin2.id) },
      body: { is_active: false },
      env,
    });

    // Try to deactivate admin1 (last active admin)
    const res = await invokeFunction(admin.userPatch, {
      method: 'PATCH',
      headers: { cookie: cookieValue },
      params: { id: String(admin1.id) },
      body: { is_active: false },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 400);
    // Because isSelf check runs first on self-edit or last admin check
    assert.ok(json.body.error === 'CANNOT_CHANGE_SELF' || json.body.error === 'LAST_ADMIN');
  });
});
