import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadReportsHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature 3 — Soft Delete & Resurrection Lifecycle', () => {
  let db;
  let env;
  let reports;
  let ownerCookie;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
    const owner = await createDirectUser(env, { email: 'reports.owner@sofacompany.com' });
    ownerCookie = (await createDirectSession(env, owner.id)).cookieValue;
  });

  it('TC-C11: Soft-deleted report is excluded from GET /api/reports list', async () => {
    const fixture = createPrototypeReportFixture({ id: 'soft_del_list_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });

    // Confirm present in list
    const listBefore = await invokeFunction(reports.reportsGet, { headers: { cookie: ownerCookie }, method: 'GET', url: 'http://localhost/api/reports', env });
    assert.equal((await readJson(listBefore)).body.total, 1);

    // Soft delete
    const delRes = await invokeFunction(reports.reportDelete, { headers: { cookie: ownerCookie },
      method: 'DELETE',
      params: { id: 'soft_del_list_test' },
      env,
    });
    assert.equal((await readJson(delRes)).status, 200);

    // Excluded from list
    const listAfter = await invokeFunction(reports.reportsGet, { headers: { cookie: ownerCookie }, method: 'GET', url: 'http://localhost/api/reports', env });
    assert.equal((await readJson(listAfter)).body.total, 0);
  });

  it('TC-C12: GET /api/reports/:id on soft-deleted report returns HTTP 404', async () => {
    const fixture = createPrototypeReportFixture({ id: 'soft_del_get_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });
    await invokeFunction(reports.reportDelete, { headers: { cookie: ownerCookie }, method: 'DELETE', params: { id: 'soft_del_get_test' }, env });

    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      params: { id: 'soft_del_get_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 404);
    assert.equal(getJson.body.error, 'Report not found');
  });

  it('TC-C13: PATCH /api/reports/:id on soft-deleted report returns HTTP 404', async () => {
    const fixture = createPrototypeReportFixture({ id: 'soft_del_patch_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });
    await invokeFunction(reports.reportDelete, { headers: { cookie: ownerCookie }, method: 'DELETE', params: { id: 'soft_del_patch_test' }, env });

    const patchRes = await invokeFunction(reports.reportPatch, { headers: { cookie: ownerCookie },
      method: 'PATCH',
      params: { id: 'soft_del_patch_test' },
      body: { verdict: 'APPROVED' },
      env,
    });
    const patchJson = await readJson(patchRes);
    assert.equal(patchJson.status, 404);
    assert.equal(patchJson.body.error, 'Report not found');
  });

  it('TC-C14: Re-creating report with same ID as soft-deleted report resurrects it', async () => {
    const fixture = createPrototypeReportFixture({
      id: 'resurrect_test',
      productName: 'Initial Model',
    });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });
    await invokeFunction(reports.reportDelete, { headers: { cookie: ownerCookie }, method: 'DELETE', params: { id: 'resurrect_test' }, env });

    // Post again with same ID (resurrection)
    const resurrectFixture = createPrototypeReportFixture({
      id: 'resurrect_test',
      productName: 'Resurrected Model',
    });
    const postRes = await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie },
      method: 'POST',
      body: resurrectFixture,
      env,
    });
    const postJson = await readJson(postRes);
    assert.equal(postJson.status, 200);
    assert.equal(postJson.body.id, 'resurrect_test');

    // GET :id now succeeds and returns updated content
    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      params: { id: 'resurrect_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.productName, 'Resurrected Model');

    // Direct DB check: deleted_at is null
    const row = await db.prepare('SELECT deleted_at FROM reports WHERE id = ?').bind('resurrect_test').first();
    assert.equal(row.deleted_at, null);
  });

  it('TC-C15: Direct DB verification confirms soft delete sets deleted_at timestamp', async () => {
    const fixture = createPrototypeReportFixture({ id: 'timestamp_check_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });

    const beforeRow = await db.prepare('SELECT deleted_at FROM reports WHERE id = ?').bind('timestamp_check_test').first();
    assert.equal(beforeRow.deleted_at, null);

    await invokeFunction(reports.reportDelete, { headers: { cookie: ownerCookie }, method: 'DELETE', params: { id: 'timestamp_check_test' }, env });

    const afterRow = await db.prepare('SELECT deleted_at FROM reports WHERE id = ?').bind('timestamp_check_test').first();
    assert.ok(typeof afterRow.deleted_at === 'string' && afterRow.deleted_at.length > 0);
  });
});
