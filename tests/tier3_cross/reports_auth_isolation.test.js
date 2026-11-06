import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadAuthHandlers,
  loadReportsHandlers,
  loadAdminAllowlistHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature 5 — Reports Session Lock, Owner Isolation & Signup Allowlist', () => {
  let db;
  let env;
  let auth;
  let reports;
  let allowlist;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    auth = await loadAuthHandlers();
    reports = await loadReportsHandlers();
    allowlist = await loadAdminAllowlistHandlers();
  });

  async function makeUser(email, role = 'user') {
    const user = await createDirectUser(env, { email, role });
    const { cookieValue } = await createDirectSession(env, user.id);
    return { user, cookie: cookieValue };
  }

  async function createReportAs(cookie, id) {
    const fixture = createPrototypeReportFixture({ id });
    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      headers: { cookie },
      body: fixture,
      env,
    });
    assert.equal((await readJson(res)).status, 200);
    return fixture;
  }

  it('TC-C20: Every /api/reports handler rejects requests without a session cookie (401)', async () => {
    const fixture = createPrototypeReportFixture({ id: 'no_auth_report' });

    const listRes = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports',
      env,
    });
    const listJson = await readJson(listRes);
    assert.equal(listJson.status, 401);
    assert.equal(listJson.body.error, 'AUTH_REQUIRED');

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 401);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/no_auth_report',
      params: { id: 'no_auth_report' },
      env,
    });
    assert.equal((await readJson(getRes)).status, 401);

    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/no_auth_report',
      params: { id: 'no_auth_report' },
      body: fixture,
      env,
    });
    assert.equal((await readJson(patchRes)).status, 401);

    const deleteRes = await invokeFunction(reports.reportDelete, {
      method: 'DELETE',
      url: 'http://localhost/api/reports/no_auth_report',
      params: { id: 'no_auth_report' },
      env,
    });
    assert.equal((await readJson(deleteRes)).status, 401);
  });

  it('TC-C21: User B gets 404 (not 403) on user A\'s report and lists only their own reports', async () => {
    const a = await makeUser('engineer.a@sofacompany.com');
    const b = await makeUser('engineer.b@sofacompany.com');
    const fixture = await createReportAs(a.cookie, 'a_private_report');
    await createReportAs(b.cookie, 'b_own_report');

    // GET by id and meta view
    for (const suffix of ['', '?meta=1']) {
      const res = await invokeFunction(reports.reportGet, {
        method: 'GET',
        url: `http://localhost/api/reports/a_private_report${suffix}`,
        params: { id: 'a_private_report' },
        headers: { cookie: b.cookie },
        env,
      });
      assert.equal((await readJson(res)).status, 404);
    }

    // PATCH attempt
    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/a_private_report',
      params: { id: 'a_private_report' },
      headers: { cookie: b.cookie },
      body: { ...fixture, verdict: 'APPROVED', expectedRevision: 1 },
      env,
    });
    assert.equal((await readJson(patchRes)).status, 404);

    // DELETE attempt
    const deleteRes = await invokeFunction(reports.reportDelete, {
      method: 'DELETE',
      url: 'http://localhost/api/reports/a_private_report',
      params: { id: 'a_private_report' },
      headers: { cookie: b.cookie },
      env,
    });
    assert.equal((await readJson(deleteRes)).status, 404);

    // Lists are scoped per user
    const listB = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports',
      headers: { cookie: b.cookie },
      env,
    });
    const listBJson = await readJson(listB);
    assert.equal(listBJson.body.total, 1);
    assert.equal(listBJson.body.reports[0].id, 'b_own_report');

    const listA = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports',
      headers: { cookie: a.cookie },
      env,
    });
    assert.equal((await readJson(listA)).body.total, 1);

    // A's report survived B's PATCH/DELETE attempts untouched
    const getA = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/a_private_report?meta=1',
      params: { id: 'a_private_report' },
      headers: { cookie: a.cookie },
      env,
    });
    const getAJson = await readJson(getA);
    assert.equal(getAJson.status, 200);
    assert.equal(getAJson.body.revision, 1);
  });

  it('TC-C22: Admin lists every report, can filter by ?userId=, and can read any report', async () => {
    const a = await makeUser('engineer.a@sofacompany.com');
    const b = await makeUser('engineer.b@sofacompany.com');
    const admin = await makeUser('admin@sofacompany.com', 'admin');
    await createReportAs(a.cookie, 'admin_list_a');
    await createReportAs(b.cookie, 'admin_list_b');

    const listAll = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports',
      headers: { cookie: admin.cookie },
      env,
    });
    const listAllJson = await readJson(listAll);
    assert.equal(listAllJson.body.total, 2);

    const listFiltered = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: `http://localhost/api/reports?userId=${b.user.id}`,
      headers: { cookie: admin.cookie },
      env,
    });
    const listFilteredJson = await readJson(listFiltered);
    assert.equal(listFilteredJson.body.total, 1);
    assert.equal(listFilteredJson.body.reports[0].id, 'admin_list_b');

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/admin_list_a?meta=1',
      params: { id: 'admin_list_a' },
      headers: { cookie: admin.cookie },
      env,
    });
    assert.equal((await readJson(getRes)).status, 200);
  });

  it('TC-C23: Empty allowlist keeps signup open — a code is issued', async () => {
    const res = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: { email: 'new.hire@sofacompany.com', password: 'Password123!', name: 'New Hire' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 200);
    assert.equal(json.body.ok, true);
    assert.ok(json.body.devCode, 'dev mail mode should expose the issued code');

    const row = await db.prepare(
      'SELECT email, consumed_at FROM signup_codes WHERE email = ? ORDER BY id DESC LIMIT 1'
    ).bind('new.hire@sofacompany.com').first();
    assert.ok(row);
    assert.equal(row.consumed_at, null);
  });

  it('TC-C24: Non-empty allowlist rejects an unlisted email with 403 EMAIL_NOT_ALLOWED and issues no code', async () => {
    const admin = await makeUser('admin@sofacompany.com', 'admin');
    const addRes = await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      headers: { cookie: admin.cookie },
      body: { email: 'invited@sofacompany.com', note: 'Team 1' },
      env,
    });
    assert.equal((await readJson(addRes)).status, 200);

    const res = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: { email: 'stranger@example.com', password: 'Password123!', name: 'Stranger' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 403);
    assert.equal(json.body.error, 'EMAIL_NOT_ALLOWED');

    // No code row was created (nothing sent, nothing consumed) for the stranger
    const row = await db.prepare(
      'SELECT COUNT(*) AS n FROM signup_codes WHERE email = ?'
    ).bind('stranger@example.com').first();
    assert.equal(row.n, 0);
  });

  it('TC-C25: A listed email still receives a signup code', async () => {
    const admin = await makeUser('admin@sofacompany.com', 'admin');
    await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      headers: { cookie: admin.cookie },
      body: { email: 'invited@sofacompany.com' },
      env,
    });

    const res = await invokeFunction(auth.signupRequest, {
      method: 'POST',
      body: { email: 'invited@sofacompany.com', password: 'Password123!', name: 'Invited' },
      env,
    });
    const json = await readJson(res);
    assert.equal(json.status, 200);
    assert.equal(json.body.ok, true);
    assert.ok(json.body.devCode);
  });

  it('TC-C26: Allowlist endpoints reject non-admins and anonymous callers', async () => {
    const plain = await makeUser('plain.user@sofacompany.com');
    const admin = await makeUser('admin@sofacompany.com', 'admin');

    // Anonymous
    const anonGet = await invokeFunction(allowlist.allowlistGet, { method: 'GET', env });
    assert.equal((await readJson(anonGet)).status, 401);
    const anonPost = await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      body: { email: 'x@sofacompany.com' },
      env,
    });
    assert.equal((await readJson(anonPost)).status, 401);

    // Signed-in non-admin
    const userGet = await invokeFunction(allowlist.allowlistGet, {
      method: 'GET',
      headers: { cookie: plain.cookie },
      env,
    });
    assert.equal((await readJson(userGet)).status, 403);
    const userPost = await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      headers: { cookie: plain.cookie },
      body: { email: 'x@sofacompany.com' },
      env,
    });
    assert.equal((await readJson(userPost)).status, 403);
    const userDelete = await invokeFunction(allowlist.allowlistDelete, {
      method: 'DELETE',
      params: { email: 'x@sofacompany.com' },
      headers: { cookie: plain.cookie },
      env,
    });
    assert.equal((await readJson(userDelete)).status, 403);

    // Admin happy path: add (with URL-encoded param on delete), list, delete
    const badAdd = await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      headers: { cookie: admin.cookie },
      body: { email: 'not-an-email' },
      env,
    });
    assert.equal((await readJson(badAdd)).status, 400);

    await invokeFunction(allowlist.allowlistPost, {
      method: 'POST',
      headers: { cookie: admin.cookie },
      body: { email: 'Keep.Me@Example.com', note: 'QA lead' },
      env,
    });
    const listRes = await invokeFunction(allowlist.allowlistGet, {
      method: 'GET',
      headers: { cookie: admin.cookie },
      env,
    });
    const listJson = await readJson(listRes);
    assert.equal(listJson.status, 200);
    assert.equal(listJson.body.allowlist.length, 1);
    assert.equal(listJson.body.allowlist[0].email, 'keep.me@example.com');
    assert.equal(listJson.body.allowlist[0].note, 'QA lead');

    const delRes = await invokeFunction(allowlist.allowlistDelete, {
      method: 'DELETE',
      params: { email: 'keep.me%40example.com' },
      headers: { cookie: admin.cookie },
      env,
    });
    assert.equal((await readJson(delRes)).status, 200);

    const listAfter = await invokeFunction(allowlist.allowlistGet, {
      method: 'GET',
      headers: { cookie: admin.cookie },
      env,
    });
    assert.equal((await readJson(listAfter)).body.allowlist.length, 0);
  });
});
