import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadReportsHandlers,
} from '../helpers/test-harness.js';
import { createPrototypeReportFixture, createLargePayloadFixture } from '../helpers/fixtures.js';

describe('Tier 1: Feature 3 — Report Schema Validation & Chunk Storage', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
  });

  it('TC-3.1: Rejects report creation when id is missing or empty (HTTP 400)', async () => {
    const fixture = createPrototypeReportFixture();
    delete fixture.id;

    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 400);
    assert.equal(json.body.success, false);
    assert.match(json.body.error, /id is required/i);
  });

  it('TC-3.2: Rejects report creation when neither reportTitle nor productName is present (HTTP 400)', async () => {
    const fixture = createPrototypeReportFixture({
      reportTitle: '',
      report_title: '',
      productName: '',
      product_name: '',
      desc: '',
    });

    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 400);
    assert.equal(json.body.success, false);
    assert.match(json.body.error, /reportTitle or productName is required/i);
  });

  it('TC-3.3: Rejects malformed JSON body with HTTP 400', async () => {
    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      headers: { 'content-type': 'application/json' },
      body: '{ malformed json: not valid }',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 400);
    assert.equal(json.body.ok, false);
    assert.match(json.body.error, /INVALID_JSON|INVALID_BODY/i);
  });

  it('TC-3.4: Rejects unsupported Content-Type header with HTTP 415', async () => {
    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      headers: { 'content-type': 'text/plain' },
      body: 'plain text content',
      env,
    });
    const json = await readJson(res);

    assert.equal(json.status, 415);
    assert.equal(json.body.ok, false);
    assert.equal(json.body.error, 'INVALID_CONTENT_TYPE');
  });

  it('TC-3.5: Rejects duplicate ID on creation when active report already exists (HTTP 409)', async () => {
    const fixture = createPrototypeReportFixture({ id: 'duplicate_test_100' });

    // First create succeeds
    const res1 = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    assert.equal((await readJson(res1)).status, 200);

    // Second create with same ID returns 409
    const res2 = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    const json2 = await readJson(res2);

    assert.equal(json2.status, 409);
    assert.equal(json2.body.success, false);
    assert.match(json2.body.error, /already exists/i);
  });

  it('TC-3.6: Splits large payload (>500KB) into multiple chunks and stores in report_payload_chunks', async () => {
    // Generate ~1.2MB payload
    const largeFixture = createLargePayloadFixture(1200000, { id: 'chunk_test_large' });

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: largeFixture,
      env,
    });
    const postJson = await readJson(postRes);
    assert.equal(postJson.status, 200);

    // Direct inspect D1 SQLite chunks table
    const chunkRows = await db.prepare(
      'SELECT chunk_index, total_chunks, length(data) AS chunk_len FROM report_payload_chunks WHERE id = ? ORDER BY chunk_index ASC'
    ).bind('chunk_test_large').all();

    assert.ok(chunkRows.results.length >= 3, `Expected at least 3 chunks for ~1.2MB, got ${chunkRows.results.length}`);
    for (const chunk of chunkRows.results) {
      assert.equal(chunk.total_chunks, chunkRows.results.length);
      assert.ok(chunk.chunk_len <= 500000, `Chunk length ${chunk.chunk_len} must not exceed 500KB`);
    }

    // Verify GET reassembles identical large payload
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/chunk_test_large',
      params: { id: 'chunk_test_large' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.id, 'chunk_test_large');
    assert.equal(getJson.body.report.prodPhotos.length, largeFixture.prodPhotos.length);
  });
});
