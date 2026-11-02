import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractPhotoCount,
  extractVerdict,
  formatReportMeta,
} from '../../functions/api/reports/index.js';

describe('Tier 1: Feature 5 — Report Metadata Extraction & Normalization', () => {
  it('TC-5.1: extractVerdict extracts verdict from string, rating, or checks.rating object', () => {
    // 1. Explicit string verdict
    assert.equal(extractVerdict({ verdict: 'APPROVED' }), 'APPROVED');
    assert.equal(extractVerdict({ verdict: '  REPAIR  ' }), 'REPAIR');

    // 2. Fallback to rating string
    assert.equal(extractVerdict({ rating: 'NEW SAMPLE' }), 'NEW SAMPLE');

    // 3. Extraction from checks.rating map (active key)
    assert.equal(
      extractVerdict({
        checks: {
          rating: {
            'Repair': false,
            'New Sample': true,
            'Approved': false,
          },
        },
      }),
      'New Sample'
    );

    // 4. Fallback empty string if no verdict specified
    assert.equal(extractVerdict({}), '');
  });

  it('TC-5.2: extractPhotoCount aggregates photos across coverPhotos and section photo arrays', () => {
    // If photoCount explicitly given as number
    assert.equal(extractPhotoCount({ photoCount: 15 }), 15);
    assert.equal(extractPhotoCount({ photo_count: 8 }), 8);

    // Aggregate from arrays and coverPhotos
    const body = {
      coverPhotos: {
        FRONT: 'data:...',
        SIDE: 'data:...',
        BACK: null,
      },
      prodPhotos: [{ id: 1 }, { id: 2 }, { id: 3 }],
      assemblyPhotos: [{ id: 4 }],
      watchoutPhotos: [{ id: 5 }, { id: 6 }],
      testingPhotos: [],
    };
    // 2 cover photos + 3 + 1 + 2 = 8
    assert.equal(extractPhotoCount(body), 8);
  });

  it('TC-5.3: formatReportMeta produces unified camelCase and snake_case metadata contract', () => {
    const dbRow = {
      id: '1730528400000',
      user_id: 'usr_42',
      module_type: 'prototype',
      report_title: 'PROTOTYPE SAMPLE REVIEW REPORT',
      product_name: 'Ricardo Coffee Table D1000',
      model_number: 'MD 2756',
      po_number: 'PO-9812',
      factory: 'SOFACOMPANY VN',
      verdict: 'APPROVED',
      photo_count: 12,
      thumb_small: 'data:image/jpeg;base64,mockthumb',
      revision: 2,
      created_at: '2026-11-02T06:00:00Z',
      updated_at: '2026-11-02T06:30:00Z',
    };

    const meta = formatReportMeta(dbRow);

    assert.equal(meta.id, '1730528400000');
    assert.equal(meta.userId, 'usr_42');
    assert.equal(meta.moduleType, 'prototype');
    assert.equal(meta.productName, 'Ricardo Coffee Table D1000');
    assert.equal(meta.modelNumber, 'MD 2756');
    assert.equal(meta.poNumber, 'PO-9812');
    assert.equal(meta.factory, 'SOFACOMPANY VN');
    assert.equal(meta.verdict, 'APPROVED');
    assert.equal(meta.photoCount, 12);
    assert.equal(meta.thumbSmall, 'data:image/jpeg;base64,mockthumb');
    assert.equal(meta.revision, 2);
  });

  it('TC-5.4: Fallback product name extraction from legacy "desc" property', async () => {
    const { createMockD1, createTestEnv, invokeFunction, readJson, loadReportsHandlers } = await import('../helpers/test-harness.js');
    const env = createTestEnv(createMockD1());
    const reports = await loadReportsHandlers();

    // Body with legacy "desc" instead of productName
    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: {
        id: 'legacy_desc_test',
        reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
        desc: 'Ricardo Side Table D1000 Legacy',
      },
      env,
    });
    const postJson = await readJson(res);
    assert.equal(postJson.status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/legacy_desc_test?meta=1',
      params: { id: 'legacy_desc_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.report.productName, 'Ricardo Side Table D1000 Legacy');
  });

  it('TC-5.5: Fallback model number extraction from legacy "model" property', async () => {
    const { createMockD1, createTestEnv, invokeFunction, readJson, loadReportsHandlers } = await import('../helpers/test-harness.js');
    const env = createTestEnv(createMockD1());
    const reports = await loadReportsHandlers();

    const res = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: {
        id: 'legacy_model_test',
        reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
        productName: 'Ricardo Side Table',
        model: 'MD 2756',
      },
      env,
    });
    assert.equal((await readJson(res)).status, 200);

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/legacy_model_test?meta=1',
      params: { id: 'legacy_model_test' },
      env,
    });
    const getJson = await readJson(getRes);
    assert.equal(getJson.body.report.modelNumber, 'MD 2756');
  });
});
