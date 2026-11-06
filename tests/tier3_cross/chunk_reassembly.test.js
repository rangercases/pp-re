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
import { createLargePayloadFixture, createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 3: Cross-Feature 2 — Multi-Chunk Storage & Reassembly Engine (F1/F2)', () => {
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

  it('TC-C6: Splits 2.5MB payload across 5+ chunks and reassembles exact original JSON object', async () => {
    const payloadSize = 2500000;
    const fixture = createLargePayloadFixture(payloadSize, {
      id: 'chunk_reassemble_2_5mb',
      productName: 'Ricardo Coffee Table Heavy Photos',
    });

    // Save
    const postRes = await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie },
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    // Verify chunk count in DB
    const chunkRows = await db.prepare(
      'SELECT chunk_index, total_chunks, length(data) as chunk_len FROM report_payload_chunks WHERE id = ? ORDER BY chunk_index ASC'
    ).bind('chunk_reassemble_2_5mb').all();

    assert.ok(chunkRows.results.length >= 5, `Expected >= 5 chunks, got ${chunkRows.results.length}`);

    // Reassemble via GET
    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      url: 'http://localhost/api/reports/chunk_reassemble_2_5mb',
      params: { id: 'chunk_reassemble_2_5mb' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.id, 'chunk_reassemble_2_5mb');
    assert.equal(getJson.body.report.productName, 'Ricardo Coffee Table Heavy Photos');
    assert.equal(getJson.body.report.prodPhotos.length, fixture.prodPhotos.length);
  });

  it('TC-C7: Updating report with larger payload replaces obsolete chunks and re-chunks correctly', async () => {
    // Stage 1: create with 1MB (approx 2 chunks)
    const initialFixture = createLargePayloadFixture(1000000, { id: 'rechunk_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: initialFixture, env });

    const initialChunks = await db.prepare(
      'SELECT COUNT(*) as c FROM report_payload_chunks WHERE id = ?'
    ).bind('rechunk_test').first();
    assert.ok(initialChunks.c <= 3);

    // Stage 2: update with 3MB (approx 6-7 chunks)
    const updatedFixture = createLargePayloadFixture(3000000, {
      id: 'rechunk_test',
      expectedRevision: 1,
      reviewer: 'Updated Reviewer Name',
    });

    const patchRes = await invokeFunction(reports.reportPatch, { headers: { cookie: ownerCookie },
      method: 'PATCH',
      url: 'http://localhost/api/reports/rechunk_test',
      params: { id: 'rechunk_test' },
      body: updatedFixture,
      env,
    });
    assert.equal((await readJson(patchRes)).status, 200);

    const updatedChunks = await db.prepare(
      'SELECT COUNT(*) as c FROM report_payload_chunks WHERE id = ?'
    ).bind('rechunk_test').first();
    assert.ok(updatedChunks.c >= 6, `Expected >= 6 chunks after expansion, got ${updatedChunks.c}`);

    // Verify GET reassembles updated data
    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      url: 'http://localhost/api/reports/rechunk_test',
      params: { id: 'rechunk_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.report.reviewer, 'Updated Reviewer Name');
    assert.equal(getJson.body.revision, 2);
  });

  it('TC-C8: Chunk ordering integrity: joined strictly by chunk_index ascending', async () => {
    const fixture = createLargePayloadFixture(1500000, { id: 'order_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });

    // Read chunks from SQLite
    const chunks = await db.prepare(
      'SELECT chunk_index, data FROM report_payload_chunks WHERE id = ? ORDER BY chunk_index ASC'
    ).bind('order_test').all();

    for (let i = 0; i < chunks.results.length; i++) {
      assert.equal(chunks.results[i].chunk_index, i, `Chunk index must be strictly sequential: expected ${i}`);
    }
  });

  it('TC-C9: Large payload reassembly benchmark: 2.5MB payload reassembles in under 250ms', async () => {
    const fixture = createLargePayloadFixture(2500000, { id: 'benchmark_reassembly' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });

    const startTime = performance.now();
    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      url: 'http://localhost/api/reports/benchmark_reassembly',
      params: { id: 'benchmark_reassembly' },
      env,
    });
    const elapsedMs = performance.now() - startTime;

    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 200);
    // Threshold raised 50ms -> 250ms (2026-11-06): the 50ms budget was
    // machine-dependent and flaked on slower CI/VM hardware (observed
    // 76-281ms for the same code that passes in ~40ms on a fast laptop).
    // 250ms still catches real reassembly regressions (O(n^2) blowups are
    // in the seconds range) without failing on hardware speed alone.
    assert.ok(elapsedMs < 250, `Expected reassembly in <250ms, took ${elapsedMs.toFixed(2)}ms`);
  });

  it('TC-C10: Corrupted chunk data returns HTTP 500 with descriptive error', async () => {
    const fixture = createPrototypeReportFixture({ id: 'corrupt_test' });
    await invokeFunction(reports.reportsPost, { headers: { cookie: ownerCookie }, method: 'POST', body: fixture, env });

    // Corrupt the chunk data directly in database
    await db.prepare('UPDATE report_payload_chunks SET data = ? WHERE id = ?').bind('INVALID_JSON_CORRUPT{', 'corrupt_test').run();

    const getRes = await invokeFunction(reports.reportGet, { headers: { cookie: ownerCookie },
      method: 'GET',
      url: 'http://localhost/api/reports/corrupt_test',
      params: { id: 'corrupt_test' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 500);
    assert.match(getJson.body.error, /Failed to deserialize report payload/i);
  });
});
