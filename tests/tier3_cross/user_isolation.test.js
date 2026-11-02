import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadAuthHandlers,
  loadAdminHandlers,
  loadReportsHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature 4 — User Isolation & Session Security', () => {
  let db;
  let env;
  let auth;
  let admin;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    auth = await loadAuthHandlers();
    admin = await loadAdminHandlers();
    reports = await loadReportsHandlers();
  });

  it('TC-C16: Report creation tracks creating userId from payload', async () => {
    const userA = await createDirectUser(env, { email: 'engineer.a@sofacompany.com', name: 'Engineer A' });
    const fixture = createPrototypeReportFixture({
      id: 'user_a_report',
      userId: String(userA.id),
    });

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      body: fixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/user_a_report?meta=1',
      params: { id: 'user_a_report' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.report.userId, String(userA.id));
  });

  it('TC-C17: Direct DB verification confirms report user_id association and index presence', async () => {
    const fixture = createPrototypeReportFixture({
      id: 'db_index_test',
      userId: '42',
    });
    await invokeFunction(reports.reportsPost, { method: 'POST', body: fixture, env });

    const row = await db.prepare('SELECT id, user_id FROM reports WHERE id = ?').bind('db_index_test').first();
    assert.equal(row.user_id, '42');

    // Verify index exists
    const idx = await db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_reports_user_id'").first();
    assert.ok(idx && idx.name === 'idx_reports_user_id');
  });

  it('TC-C18: Admin directory listing reflects correct roles, active states, and user count', async () => {
    const adminUser = await createDirectUser(env, { email: 'head.qa@sofacompany.com', role: 'admin' });
    await createDirectUser(env, { email: 'worker1@sofacompany.com', role: 'user', isActive: 1 });
    await createDirectUser(env, { email: 'worker2@sofacompany.com', role: 'user', isActive: 0 });

    const { cookieValue } = await createDirectSession(env, adminUser.id);
    const res = await invokeFunction(admin.usersGet, {
      method: 'GET',
      headers: { cookie: cookieValue },
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.users.length, 3);
    const worker2 = json.body.users.find(u => u.email === 'worker2@sofacompany.com');
    assert.equal(worker2.is_active, 0);
  });

  it('TC-C19: Deactivating a user immediately invalidates active sessions and rejects /api/auth/me', async () => {
    const adminUser = await createDirectUser(env, { email: 'admin.sec@sofacompany.com', role: 'admin' });
    const engineer = await createDirectUser(env, { email: 'engineer.deact@sofacompany.com', role: 'user' });

    const { cookieValue: adminCookie } = await createDirectSession(env, adminUser.id);
    const { cookieValue: engineerCookie } = await createDirectSession(env, engineer.id);

    // Engineer can access /api/auth/me before deactivation
    const meBefore = await invokeFunction(auth.me, {
      method: 'GET',
      headers: { cookie: engineerCookie },
      env,
    });
    assert.equal((await readJson(meBefore)).status, 200);

    // Admin deactivates engineer
    await invokeFunction(admin.userPatch, {
      method: 'PATCH',
      headers: { cookie: adminCookie },
      params: { id: String(engineer.id) },
      body: { is_active: false },
      env,
    });

    // Subsequent call with engineer's session is rejected with HTTP 401
    const meAfter = await invokeFunction(auth.me, {
      method: 'GET',
      headers: { cookie: engineerCookie },
      env,
    });
    assert.equal((await readJson(meAfter)).status, 401);
  });
});
