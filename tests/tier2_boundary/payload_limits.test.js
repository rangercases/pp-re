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

describe('Tier 2: Boundary 2 — Report Storage, Sizing & Payload Limits', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
  });

  it('TC-B2.1: Huge text inputs (15,000+ characters) in notes and descriptions process without truncation', async () => {
    const hugeText = 'SOFACOMPANY Factory Inspection Notes Paragraph. '.repeat(350); // ~16,800 chars
    assert.ok(hugeText.length > 15000);

    const fixture = createPrototypeReportFixture({
      id: 'huge_text_report',
      assembly: {
        notes: hugeText,
      },
      watchout: [
        {
          defectId: 'W_HUGE',
          description: hugeText,
        },
      ],
    });

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/huge_text_report',
      params: { id: 'huge_text_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.assembly.notes.length, hugeText.length);
    assert.equal(getJson.body.report.watchout[0].description.length, hugeText.length);
    assert.equal(getJson.body.report.assembly.notes, hugeText);
  });

  it('TC-B2.2: Reports with minimal fields (blank factory, no photos) render safely with fallbacks', async () => {
    const minimalFixture = {
      id: 'minimal_blank_report',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      productName: '',
      factory: '',
      modelNumber: '',
      poNumber: '',
    };

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: minimalFixture,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/minimal_blank_report?meta=1',
      params: { id: 'minimal_blank_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.id, 'minimal_blank_report');
    assert.equal(getJson.body.report.factory, '');
    assert.equal(getJson.body.report.photoCount, 0);
  });

  it('TC-B2.3: Oversized simulated photo payload (>3MB base64) splits across multiple chunks and reassembles intact', async () => {
    const oversizedFixture = createLargePayloadFixture(3500000, { id: 'oversized_3mb_report' });

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: oversizedFixture,
      env,
    });
    const postJson = await readJson(postRes);
    assert.equal(postJson.status, 200);

    // Verify chunk count in SQLite
    const chunkCount = await db.prepare(
      'SELECT COUNT(*) as c FROM report_payload_chunks WHERE id = ?'
    ).bind('oversized_3mb_report').first();
    assert.ok(chunkCount.c >= 7, `Expected at least 7 chunks for 3.5MB, got ${chunkCount.c}`);

    // Reassemble via GET
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/oversized_3mb_report',
      params: { id: 'oversized_3mb_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.id, 'oversized_3mb_report');
    assert.equal(getJson.body.report.prodPhotos.length, oversizedFixture.prodPhotos.length);
  });

  it('TC-B2.4: Empty chunk list or zero-byte text handled gracefully without exceptions', async () => {
    const emptyBody = {
      id: 'empty_payload_report',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      productName: 'Empty Payload Test',
    };

    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: emptyBody,
      env,
    });
    assert.equal((await readJson(postRes)).status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/empty_payload_report',
      params: { id: 'empty_payload_report' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.id, 'empty_payload_report');
  });

  it('TC-B2.5: Missing / non-existent report ID on GET returns HTTP 404 Report not found', async () => {
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/non_existent_id_99999',
      params: { id: 'non_existent_id_99999' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 404);
    assert.equal(getJson.body.success, false);
    assert.equal(getJson.body.error, 'Report not found');
  });
});
