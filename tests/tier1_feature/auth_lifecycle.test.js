import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadAuthHandlers,
  loadAdminHandlers,
  createDirectSession,
} from '../helpers/test-harness.js';
import { TEST_USERS } from '../helpers/fixtures.js';

describe('Tier 1: Feature 1 — User Authentication & Role-Based Access Control', () => {
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

  it('TC-1.1: First user signup promotes user to admin role and sets session cookie', async () => {
    // Step 1: Request signup code
    const reqRes = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/request',
      body: {
        email: TEST_USERS.admin.email,
        name: TEST_USERS.admin.name,
        password: TEST_USERS.admin.password,
      },
      env,
    });
    const reqJson = await readJson(reqRes);
    assert.equal(reqJson.status, 200);
    assert.equal(reqJson.body.ok, true);
    assert.ok(reqJson.body.devCode, 'devCode should be returned in dev mail mode');

    // Step 2: Verify signup code
    const verifyRes = await invokeFunction(auth.signupVerify, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/verify',
      body: {
        email: TEST_USERS.admin.email,
        name: TEST_USERS.admin.name,
        password: TEST_USERS.admin.password,
        code: reqJson.body.devCode,
      },
      env,
    });
    const verifyJson = await readJson(verifyRes);
    assert.equal(verifyJson.status, 200);
    assert.equal(verifyJson.body.ok, true);
    assert.equal(verifyJson.body.user.email, TEST_USERS.admin.email.toLowerCase());
    assert.equal(verifyJson.body.user.role, 'admin', 'First user must be promoted to admin');

    const setCookie = verifyJson.headers['set-cookie'];
    assert.ok(setCookie && setCookie.includes('fasrep_session='), 'Must set session cookie');
  });

  it('TC-1.2: Subsequent user signup verification assigns default user role', async () => {
    // First user (admin)
    const req1 = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/request',
      body: TEST_USERS.admin,
      env,
    });
    const code1 = (await readJson(req1)).body.devCode;
    await invokeFunction(auth.signupVerify, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/verify',
      body: { ...TEST_USERS.admin, code: code1 },
      env,
    });

    // Second user (regular user)
    const req2 = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/request',
      body: TEST_USERS.engineer1,
      env,
    });
    const code2 = (await readJson(req2)).body.devCode;
    const verify2 = await invokeFunction(auth.signupVerify, {
      method: 'POST',
      url: 'http://localhost/api/auth/signup/verify',
      body: { ...TEST_USERS.engineer1, code: code2 },
      env,
    });
    const json2 = await readJson(verify2);

    assert.equal(json2.status, 200);
    assert.equal(json2.body.user.role, 'user', 'Subsequent user must receive default role "user"');
  });

  it('TC-1.3: Login with valid credentials returns HTTP 200, user metadata, and valid fasrep_session cookie', async () => {
    // Seed admin
    const req = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: TEST_USERS.admin,
      env,
    });
    const code = (await readJson(req)).body.devCode;
    await invokeFunction(auth.signupVerify, {
      method: 'POST',
      body: { ...TEST_USERS.admin, code },
      env,
    });

    // Login
    const loginRes = await invokeFunction(auth.login, {
      method: 'POST',
      url: 'http://localhost/api/auth/login',
      body: {
        email: TEST_USERS.admin.email,
        password: TEST_USERS.admin.password,
      },
      env,
    });
    const loginJson = await readJson(loginRes);

    assert.equal(loginJson.status, 200);
    assert.equal(loginJson.body.ok, true);
    assert.equal(loginJson.body.user.email, TEST_USERS.admin.email.toLowerCase());
    assert.ok(loginJson.headers['set-cookie']?.includes('fasrep_session='), 'Should issue fasrep_session cookie');
  });

  it('TC-1.4: GET /api/auth/state and GET /api/auth/me return authenticated profile and session state', async () => {
    // Seed and login
    const req = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.engineer1, env });
    const code = (await readJson(req)).body.devCode;
    const verifyRes = await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.engineer1, code }, env });
    const setCookie = (await readJson(verifyRes)).headers['set-cookie'];
    const cookieHeader = setCookie.split(';')[0];

    // Check /api/auth/me
    const meRes = await invokeFunction(auth.me, {
      method: 'GET',
      url: 'http://localhost/api/auth/me',
      headers: { cookie: cookieHeader },
      env,
    });
    const meJson = await readJson(meRes);
    assert.equal(meJson.status, 200);
    assert.equal(meJson.body.ok, true);
    assert.equal(meJson.body.user.name, TEST_USERS.engineer1.name);

    // Check /api/auth/state
    const stateRes = await invokeFunction(auth.state, {
      method: 'GET',
      url: 'http://localhost/api/auth/state',
      headers: { cookie: cookieHeader },
      env,
    });
    const stateJson = await readJson(stateRes);
    assert.equal(stateJson.status, 200);
    assert.equal(stateJson.body.ok, true);
    assert.equal(stateJson.body.hasUsers, true);
    assert.ok(stateJson.body.user);
    assert.equal(stateJson.body.user.name, TEST_USERS.engineer1.name);
  });

  it('TC-1.5: POST /api/auth/logout revokes session in database and clears session cookie', async () => {
    const req = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.engineer1, env });
    const code = (await readJson(req)).body.devCode;
    const verifyRes = await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.engineer1, code }, env });
    const cookieHeader = (await readJson(verifyRes)).headers['set-cookie'].split(';')[0];

    // Logout
    const logoutRes = await invokeFunction(auth.logout, {
      method: 'POST',
      url: 'http://localhost/api/auth/logout',
      headers: { cookie: cookieHeader },
      env,
    });
    const logoutJson = await readJson(logoutRes);
    assert.equal(logoutJson.status, 200);
    assert.equal(logoutJson.body.ok, true);
    assert.ok(logoutJson.headers['set-cookie']?.includes('Max-Age=0'), 'Cookie must be cleared with Max-Age=0');

    // Confirm session is terminated
    const meRes = await invokeFunction(auth.me, {
      method: 'GET',
      url: 'http://localhost/api/auth/me',
      headers: { cookie: cookieHeader },
      env,
    });
    const meJson = await readJson(meRes);
    assert.equal(meJson.status, 401, 'Subsequent request with revoked session must return 401');
  });

  it('TC-1.6: Admin user accesses GET /api/admin/users and receives full user directory', async () => {
    // Seed admin
    const req1 = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.admin, env });
    const code1 = (await readJson(req1)).body.devCode;
    const verify1 = await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.admin, code: code1 }, env });
    const adminCookie = (await readJson(verify1)).headers['set-cookie'].split(';')[0];

    // Seed engineer
    const req2 = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.engineer1, env });
    const code2 = (await readJson(req2)).body.devCode;
    await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.engineer1, code: code2 }, env });

    // Admin lists users
    const listRes = await invokeFunction(admin.usersGet, {
      method: 'GET',
      url: 'http://localhost/api/admin/users',
      headers: { cookie: adminCookie },
      env,
    });
    const listJson = await readJson(listRes);
    assert.equal(listJson.status, 200);
    assert.equal(listJson.body.ok, true);
    assert.equal(listJson.body.users.length, 2, 'Should list both registered users');
  });

  it('TC-1.7: Admin modifies user role or account status via PATCH /api/admin/users/:id', async () => {
    // Seed admin
    const req1 = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.admin, env });
    const code1 = (await readJson(req1)).body.devCode;
    const verify1 = await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.admin, code: code1 }, env });
    const adminCookie = (await readJson(verify1)).headers['set-cookie'].split(';')[0];

    // Seed engineer
    const req2 = await invokeFunction(auth.signupRequest, { method: 'POST', body: TEST_USERS.engineer1, env });
    const code2 = (await readJson(req2)).body.devCode;
    const verify2 = await invokeFunction(auth.signupVerify, { method: 'POST', body: { ...TEST_USERS.engineer1, code: code2 }, env });
    const engineerId = (await readJson(verify2)).body.user.id;

    // Promote engineer to admin
    const patchRes = await invokeFunction(admin.userPatch, {
      method: 'PATCH',
      url: `http://localhost/api/admin/users/${engineerId}`,
      headers: { cookie: adminCookie },
      params: { id: String(engineerId) },
      body: { role: 'admin' },
      env,
    });
    const patchJson = await readJson(patchRes);
    assert.equal(patchJson.status, 200);
    assert.equal(patchJson.body.ok, true);
    assert.equal(patchJson.body.user.role, 'admin');
  });
});
