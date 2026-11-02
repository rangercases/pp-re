import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadReportsHandlers,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture, createPreProdReportFixture } from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature 1 — Filter by ModuleType, Status & Search Text', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();

    // Seed 4 varied reports
    // 1. Prototype - Ricardo Table - APPROVED
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      body: createPrototypeReportFixture({
        id: 'rep_1',
        moduleType: 'prototype',
        productName: 'Ricardo Coffee Table D1000',
        modelNumber: 'MD 2756',
        poNumber: 'PO-9812',
        factory: 'Thinh Phu Co.',
        verdict: 'APPROVED',
      }),
      env,
    });

    // 2. Prototype - Hubert Table - REPAIR
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      body: createPrototypeReportFixture({
        id: 'rep_2',
        moduleType: 'prototype',
        productName: 'Hubert Dining Table 180',
        modelNumber: 'MD 2747',
        poNumber: 'PO-8821',
        factory: 'Vien Lam Co.',
        verdict: 'REPAIR',
      }),
      env,
    });

    // 3. Pre-production - Paula Sofa - APPROVED
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      body: createPreProdReportFixture({
        id: 'rep_3',
        moduleType: 'pre-production',
        productName: 'Paula 3-Seater Sofa',
        modelNumber: 'MD 2600',
        poNumber: 'PO-7711',
        factory: 'SOFACOMPANY VN',
        verdict: 'APPROVED',
      }),
      env,
    });

    // 4. Pre-production - Astha Chaise - IN PROGRESS
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      body: createPreProdReportFixture({
        id: 'rep_4',
        moduleType: 'pre-production',
        productName: 'Astha Chaise Lounge',
        modelNumber: 'MD 2550',
        poNumber: 'PO-6600',
        factory: 'Thinh Phu Co.',
        verdict: 'IN PROGRESS',
      }),
      env,
    });
  });

  it('TC-C1: Filter by moduleType=prototype returns only prototype reports', async () => {
    const res = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?moduleType=prototype',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.total, 2);
    for (const r of json.body.reports) {
      assert.equal(r.moduleType, 'prototype');
    }
  });

  it('TC-C2: Filter by status=APPROVED returns only approved reports across modules', async () => {
    const res = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?status=APPROVED',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.total, 2); // rep_1 and rep_3
    for (const r of json.body.reports) {
      assert.equal(r.verdict, 'APPROVED');
    }
  });

  it('TC-C3: Combined filter: moduleType=prototype AND search=Ricardo AND status=APPROVED', async () => {
    const res = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?moduleType=prototype&search=Ricardo&status=APPROVED',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.total, 1);
    assert.equal(json.body.reports[0].id, 'rep_1');
    assert.equal(json.body.reports[0].productName, 'Ricardo Coffee Table D1000');
  });

  it('TC-C4: Pagination limits results per page and calculates total matching', async () => {
    const res = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?page=2&limit=2',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 200);
    assert.equal(json.body.total, 4);
    assert.equal(json.body.page, 2);
    assert.equal(json.body.limit, 2);
    assert.equal(json.body.reports.length, 2);
  });

  it('TC-C5: Search term matches across factory, model number, and PO number', async () => {
    // Search by factory "Vien Lam"
    const resFactory = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?search=' + encodeURIComponent('Vien Lam'),
      env,
    });
    assert.equal((await readJson(resFactory)).body.total, 1);

    // Search by model number "MD 2756"
    const resModel = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?search=2756',
      env,
    });
    assert.equal((await readJson(resModel)).body.total, 1);

    // Search by PO number "PO-7711"
    const resPO = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?search=7711',
      env,
    });
    assert.equal((await readJson(resPO)).body.total, 1);
  });
});
