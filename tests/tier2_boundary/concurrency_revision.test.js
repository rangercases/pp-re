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

describe('Tier 2: Boundary 4 — Optimistic Concurrency & Revision Locking (F3)', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
  });

  it('TC-B4.1: Reject report update when provided revision does not match current server revision (HTTP 409)', async () => {
    const fixture = createPrototypeReportFixture({ id: 'revision_conflict_test' });

    // Create (revision 1)
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Attempt PATCH providing stale revision 99
    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/revision_conflict_test',
      params: { id: 'revision_conflict_test' },
      body: {
        ...fixture,
        expectedRevision: 99,
        verdict: 'REPAIR',
      },
      env,
    });
    const patchJson = await readJson(patchRes);

    assert.equal(patchJson.status, 409);
    assert.equal(patchJson.body.success, false);
    assert.match(patchJson.body.error, /Revision conflict/i);
    assert.match(patchJson.body.error, /Server has revision 1, provided 99/i);
  });

  it('TC-B4.2: Update succeeds when expectedRevision matches and increments revision counter', async () => {
    const fixture = createPrototypeReportFixture({ id: 'rev_match_test' });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/rev_match_test',
      params: { id: 'rev_match_test' },
      body: {
        ...fixture,
        expectedRevision: 1,
        verdict: 'APPROVED',
      },
      env,
    });
    const patchJson = await readJson(patchRes);

    assert.equal(patchJson.status, 200);
    assert.equal(patchJson.body.success, true);
    assert.equal(patchJson.body.revision, 2);
  });

  it('TC-B4.3: Sequential updates correctly increment revision (1 -> 2 -> 3)', async () => {
    const fixture = createPrototypeReportFixture({ id: 'sequential_rev_test' });

    // Rev 1
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Rev 1 -> 2
    const res2 = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/sequential_rev_test',
      params: { id: 'sequential_rev_test' },
      body: { ...fixture, expectedRevision: 1, reviewer: 'Reviewer A' },
      env,
    });
    assert.equal((await readJson(res2)).body.revision, 2);

    // Rev 2 -> 3
    const res3 = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/sequential_rev_test',
      params: { id: 'sequential_rev_test' },
      body: { ...fixture, expectedRevision: 2, reviewer: 'Reviewer B' },
      env,
    });
    const json3 = await readJson(res3);
    assert.equal(json3.body.revision, 3);

    // Verify GET returns revision 3
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/sequential_rev_test?meta=1',
      params: { id: 'sequential_rev_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.revision, 3);
  });

  it('TC-B4.4: Concurrent update conflict: second client with stale revision is rejected', async () => {
    const fixture = createPrototypeReportFixture({ id: 'concurrent_sim_test' });

    // Create report (rev 1)
    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Client A and Client B both read revision 1
    const clientA_revision = 1;
    const clientB_revision = 1;

    // Client A saves first -> revision becomes 2
    const resA = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/concurrent_sim_test',
      params: { id: 'concurrent_sim_test' },
      body: { ...fixture, expectedRevision: clientA_revision, verdict: 'APPROVED' },
      env,
    });
    assert.equal((await readJson(resA)).status, 200);

    // Client B tries to save with original revision 1 -> rejected with 409
    const resB = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/concurrent_sim_test',
      params: { id: 'concurrent_sim_test' },
      body: { ...fixture, expectedRevision: clientB_revision, verdict: 'REPAIR' },
      env,
    });
    const jsonB = await readJson(resB);
    assert.equal(jsonB.status, 409);
    assert.match(jsonB.body.error, /Revision conflict/i);
  });

  it('TC-B4.5: Updating non-existent report returns HTTP 404 Report not found', async () => {
    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: 'http://localhost/api/reports/non_existent_id',
      params: { id: 'non_existent_id' },
      body: { verdict: 'APPROVED' },
      env,
    });
    const patchJson = await readJson(patchRes);

    assert.equal(patchJson.status, 404);
    assert.equal(patchJson.body.success, false);
    assert.equal(patchJson.body.error, 'Report not found');
  });
});
