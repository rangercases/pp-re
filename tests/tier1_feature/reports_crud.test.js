import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadReportsHandlers,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 1: Feature 2 — Standardized Reports CRUD API', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
  });

  it('TC-2.1: POST /api/reports creates a new report and returns HTTP 200 with id and revision 1', async () => {
    const fixture = createPrototypeReportFixture({ id: '1730528400001' });

    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.success, true);
    assert.equal(json.body.id, '1730528400001');
    assert.equal(json.body.revision, 1);
    assert.equal(json.body.message, 'Report created');
  });

  it('TC-2.2: GET /api/reports/:id reassembles chunked payload and returns full report JSON', async () => {
    const fixture = createPrototypeReportFixture({
      id: '1730528400002',
      productName: 'Ricardo Coffee Table D1000',
      reviewer: 'Nhan Hoang',
    });

    // Create report
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Get report
    const res = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/1730528400002',
      params: { id: '1730528400002' },
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.success, true);
    assert.equal(json.body.report.id, '1730528400002');
    assert.equal(json.body.report.productName, 'Ricardo Coffee Table D1000');
    assert.equal(json.body.report.reviewer, 'Nhan Hoang');
    assert.equal(json.body.report.dimensions.length, 5);
    assert.equal(json.body.revision, 1);
  });

  it('TC-2.3: GET /api/reports/:id?meta=1 returns metadata row only without heavy payload', async () => {
    const fixture = createPrototypeReportFixture({
      id: '1730528400003',
      productName: 'Ricardo Coffee Table D1000',
      verdict: 'APPROVED',
    });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    const res = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/1730528400003?meta=1',
      params: { id: '1730528400003' },
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.success, true);
    assert.equal(json.body.report.id, '1730528400003');
    assert.equal(json.body.report.productName, 'Ricardo Coffee Table D1000');
    assert.equal(json.body.report.verdict, 'APPROVED');
    // In metadata-only view, dimensions array is not present in meta
    assert.equal(json.body.report.dimensions, undefined);
  });

  it('TC-2.4: GET /api/reports returns list of active reports with pagination and total count', async () => {
    // Insert 3 reports
    for (let i = 1; i <= 3; i++) {
      const f = createPrototypeReportFixture({
        id: `list_test_${i}`,
        productName: `Item ${i}`,
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
      });
      await invokeFunction(reports.reportsPost, {
        method: 'POST',
        url: 'http://localhost/api/reports',
        body: f,
        env,
      });
    }

    const res = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?page=1&limit=2',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.success, true);
    assert.equal(json.body.total, 3);
    assert.equal(json.body.reports.length, 2);
    assert.equal(json.body.page, 1);
    assert.equal(json.body.limit, 2);
  });

  it('TC-2.5: PATCH /api/reports/:id updates report content and increments revision to 2', async () => {
    const fixture = createPrototypeReportFixture({
      id: '1730528400005',
      verdict: 'IN PROGRESS',
    });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Update verdict to APPROVED
    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/1730528400005',
      params: { id: '1730528400005' },
      body: {
        ...fixture,
        verdict: 'APPROVED',
        expectedRevision: 1,
      },
      env,
    });
    const patchJson = await readJson(patchRes);

    assert.equal(patchJson.status, 200);
    assert.equal(patchJson.body.success, true);
    assert.equal(patchJson.body.revision, 2);
    assert.equal(patchJson.body.message, 'Report updated');

    // Verify GET reflects revision 2 and updated verdict
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/1730528400005',
      params: { id: '1730528400005' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.revision, 2);
    assert.equal(getJson.body.report.verdict, 'APPROVED');
  });

  it('TC-2.6: DELETE /api/reports/:id soft deletes report and excludes it from subsequent GET list', async () => {
    const fixture = createPrototypeReportFixture({ id: '1730528400006' });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Delete report
    const delRes = await invokeFunction(reports.reportDelete, {
      method: 'DELETE',
      url: 'http://localhost/api/reports/1730528400006',
      params: { id: '1730528400006' },
      env,
    });
    const delJson = await readJson(delRes);
    assert.equal(delJson.status, 200);
    assert.equal(delJson.body.success, true);
    assert.equal(delJson.body.message, 'Report deleted');

    // Subsequent GET :id returns 404
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/1730528400006',
      params: { id: '1730528400006' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 404);

    // Excluded from GET list
    const listRes = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports',
      env,
    });
    const listJson = await readJson(listRes);
    assert.equal(listJson.body.total, 0);
  });
});
