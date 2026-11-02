import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadReportsHandlers,
} from '../helpers/test-harness.js';
import { UNICODE_VIETNAMESE_SAMPLES, createPrototypeReportFixture } from '../helpers/fixtures.js';

describe('Tier 2: Boundary 3 — Vietnamese Unicode Typography & Special Character Fidelity', () => {
  let db;
  let env;
  let reports;

  beforeEach(async () => {
    db = createMockD1();
    env = createTestEnv(db);
    reports = await loadReportsHandlers();
  });

  it('TC-B3.1: Preserves full Vietnamese diacritics in title, product, factory, and notes without character loss', async () => {
    const fixture = createPrototypeReportFixture({
      id: 'vn_unicode_report_1',
      reportTitle: UNICODE_VIETNAMESE_SAMPLES.title,
      productName: UNICODE_VIETNAMESE_SAMPLES.productName,
      factory: UNICODE_VIETNAMESE_SAMPLES.factory,
      watchout: [
        {
          defectId: 'W_VN',
          title: 'Lỗi hoàn thiện bề mặt',
          description: UNICODE_VIETNAMESE_SAMPLES.defectNote,
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
      url: 'http://localhost/api/reports/vn_unicode_report_1',
      params: { id: 'vn_unicode_report_1' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.reportTitle, UNICODE_VIETNAMESE_SAMPLES.title);
    assert.equal(getJson.body.report.productName, UNICODE_VIETNAMESE_SAMPLES.productName);
    assert.equal(getJson.body.report.factory, UNICODE_VIETNAMESE_SAMPLES.factory);
    assert.equal(getJson.body.report.watchout[0].description, UNICODE_VIETNAMESE_SAMPLES.defectNote);
  });

  it('TC-B3.2: Special characters, HTML tags, and XSS vectors are preserved verbatim without alteration', async () => {
    const xssPayload = '<script>alert("xss")</script> & " \' < >';
    const fixture = createPrototypeReportFixture({
      id: 'xss_sanitization_report',
      productName: xssPayload,
      factory: 'Safe "Factory" & Co. <Vietnam>',
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
      url: 'http://localhost/api/reports/xss_sanitization_report',
      params: { id: 'xss_sanitization_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.productName, xssPayload);
    assert.equal(getJson.body.report.factory, 'Safe "Factory" & Co. <Vietnam>');
  });

  it('TC-B3.3: Emoji characters (🛋️ 🪵 📐 📏 ✅ ⚠️ ❌) round-trip through chunking and retrieval intact', async () => {
    const emojiText = 'Furniture emojis: 🛋️ Sofa, 🪵 Wood, 📐 Triangle, 📏 Ruler, ✅ Pass, ⚠️ Warn, ❌ Fail';
    const fixture = createPrototypeReportFixture({
      id: 'emoji_test_report',
      productName: emojiText,
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
      url: 'http://localhost/api/reports/emoji_test_report',
      params: { id: 'emoji_test_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.productName, emojiText);
  });

  it('TC-B3.4: Mixed Vietnamese Unicode text search query matches target records', async () => {
    const fixture = createPrototypeReportFixture({
      id: 'search_unicode_report',
      productName: 'Bàn Cà Phê Tròn Ricardo D1000',
      factory: 'Thịnh Phú Co., Ltd',
    });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    // Search by "Cà Phê"
    const searchRes = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?search=' + encodeURIComponent('Cà Phê'),
      env,
    });
    const searchJson = await readJson(searchRes);

    assert.equal(searchJson.status, 200);
    assert.equal(searchJson.body.total, 1);
    assert.equal(searchJson.body.reports[0].id, 'search_unicode_report');
    assert.equal(searchJson.body.reports[0].productName, 'Bàn Cà Phê Tròn Ricardo D1000');
  });

  it('TC-B3.5: Vietnamese combined tone marks preserve character lengths and formatting integrity', async () => {
    const textWithAccents = 'Kiểm Định Chất Lượng Sản Phẩm Xuất Khẩu Châu Âu';
    const fixture = createPrototypeReportFixture({
      id: 'accents_test_report',
      reportTitle: textWithAccents,
    });

    await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      body: fixture,
      env,
    });

    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: 'http://localhost/api/reports/accents_test_report?meta=1',
      params: { id: 'accents_test_report' },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.report.reportTitle, textWithAccents);
  });
});
