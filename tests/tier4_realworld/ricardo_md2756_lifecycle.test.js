import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMockD1,
  createTestEnv,
  invokeFunction,
  readJson,
  loadAuthHandlers,
  loadReportsHandlers,
  createDirectUser,
  createDirectSession,
} from '../helpers/test-harness.js';
import { UNICODE_VIETNAMESE_SAMPLES } from '../helpers/fixtures.js';

describe('Tier 4: Real-World Scenario — SOFACOMPANY MD 2756 Ricardo Coffee Table End-to-End Review', () => {
  it('Executes complete 11-step factory floor prototype review lifecycle for Ricardo Coffee Table D1000', async () => {
    const db = createMockD1();
    const env = createTestEnv(db);
    const auth = await loadAuthHandlers();
    const reports = await loadReportsHandlers();

    // ─────────────────────────────────────────────────────────────
    // STEP 1: Authentication of Senior QA Engineer at Factory Floor
    // ─────────────────────────────────────────────────────────────
    const engineer = await createDirectUser(env, {
      email: 'nhan.hoang@sofacompany.com',
      name: 'Nhan Hoang',
      role: 'user',
      password: 'FactoryQA2026!',
    });

    const loginRes = await invokeFunction(auth.login, {
      method: 'POST',
      body: { email: 'nhan.hoang@sofacompany.com', password: 'FactoryQA2026!' },
      env,
    });
    const loginJson = await readJson(loginRes);
    assert.equal(loginJson.status, 200);
    assert.equal(loginJson.body.ok, true);
    assert.equal(loginJson.body.user.name, 'Nhan Hoang');

    const cookieHeader = loginJson.headers['set-cookie'].split(';')[0];
    assert.ok(cookieHeader.includes('fasrep_session='));

    // ─────────────────────────────────────────────────────────────
    // STEP 2: Initialize Prototype Report with 8 Default Modules
    // ─────────────────────────────────────────────────────────────
    const reportId = '17305284002756';
    const initialReport = {
      id: reportId,
      userId: String(engineer.id),
      moduleType: 'prototype',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      productName: 'Ricardo Coffee Table D1000',
      modelNumber: 'MD 2756',
      poNumber: 'PO-VN-2026-9812',
      factory: 'SOFACOMPANY VN (Thinh Phu Co., Ltd - Binh Duong)',
      reviewer: 'Nhan Hoang',
      date: '22-Sep-26',
      verdict: 'IN PROGRESS',
      revision: 1,

      // ─────────────────────────────────────────────────────────────
      // STEP 3: Overview Card Metadata
      // ─────────────────────────────────────────────────────────────
      overview: {
        mdNumber: 'MD 2756',
        modelName: 'Ricardo Coffee Table D1000',
        factory: 'SOFACOMPANY VN (Thinh Phu Co., Ltd - Binh Duong)',
        reviewer: 'Nhan Hoang',
        reviewDate: '22-Sep-26',
        sampleStage: 'Initial Prototype',
        status: 'In Progress',
      },

      // ─────────────────────────────────────────────────────────────
      // STEP 4: Cover Photography (4 Macro Photos)
      // ─────────────────────────────────────────────────────────────
      coverPhotos: {
        FRONT_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRg_RICARDO_FRONT_45DEG...',
        SIDE_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRg_RICARDO_SIDE_PROFILE...',
        TOP_VIEW: 'data:image/jpeg;base64,/9j/4AAQSkZJRg_RICARDO_TOP_OAK_GRAIN...',
        DETAILS: 'data:image/jpeg;base64,/9j/4AAQSkZJRg_RICARDO_LEG_JOINERY...',
      },
      prodPhotos: [
        { id: 'p1', caption: 'Tabletop solid oak grain detail', url: 'data:image/jpeg;base64,oak_grain' },
        { id: 'p2', caption: 'Leg mortise-and-tenon underside joint', url: 'data:image/jpeg;base64,leg_joint' },
      ],

      // ─────────────────────────────────────────────────────────────
      // STEP 5: Dimensions Audit against Master Drawing (Tolerance Check)
      // ─────────────────────────────────────────────────────────────
      dimensions: [
        { item: 'Outer Diameter', unit: 'mm', drawing: '1000', actual: '998', tolerance: '±5', status: 'PASS' },
        { item: 'Table Height', unit: 'mm', drawing: '450', actual: '451', tolerance: '±3', status: 'PASS' },
        { item: 'Tabletop Thickness', unit: 'mm', drawing: '25', actual: '24.8', tolerance: '±1', status: 'PASS' },
        { item: 'Leg Width', unit: 'mm', drawing: '60', actual: '60.2', tolerance: '±1', status: 'PASS' },
        { item: 'Total Net Weight', unit: 'kg', drawing: '18.5', actual: '18.3', tolerance: '±0.5', status: 'PASS' },
      ],

      // ─────────────────────────────────────────────────────────────
      // STEP 6: Assembly Verification
      // ─────────────────────────────────────────────────────────────
      assembly: {
        hardwareCheck: 'PASS (4x M8 bolts + Allen key verified)',
        boltType: 'M8 x 40mm Grade 8.8 Hex Screws',
        toolSupplied: 'M8 Hex Allen Key with ball end',
        assemblyTime: '7 minutes (1 person assembly)',
        stabilityScore: 'Excellent — Solid oak joinery without wobble',
      },

      // ─────────────────────────────────────────────────────────────
      // STEP 7: Quality Watch Out (Defect Identification & Callout)
      // ─────────────────────────────────────────────────────────────
      watchout: [
        {
          defectId: 'W1',
          severity: 'Minor',
          component: 'Rear Leg #3',
          description: UNICODE_VIETNAMESE_SAMPLES.defectNote,
          correctiveAction: 'Thịnh Phú Co. to enforce strict timber color-sorting and grit 320 sanding before PU coating.',
          calloutBox: { x: 420, y: 310, width: 85, height: 60, color: '#DC2626' },
        },
      ],
      watchoutPhotos: [
        { id: 'w1', caption: 'Defect macro photo with red highlight boundary', url: 'data:image/jpeg;base64,defect_macro' },
      ],

      // ─────────────────────────────────────────────────────────────
      // STEP 8: Quality Inspection Checklist
      // ─────────────────────────────────────────────────────────────
      checklist: [
        { task: 'Master drawing dimension audit', status: 'OK' },
        { task: 'ISTA-1A carton drop test', status: 'OK' },
        { task: 'FSC-C181124 certification barcode label', status: 'OK' },
        { task: 'Outline IKEA-style manual included', status: 'OK' },
        { task: 'Hardware blister pouch sealed', status: 'OK' },
      ],
      testing: {
        moistureContent: '10.2% (Requirement: 8% - 12% PASS)',
        lacquerAdhesion: 'Grade 4B Cross-hatch tape test PASS',
      },

      // ─────────────────────────────────────────────────────────────
      // STEP 9: Final Verdict Assignment
      // ─────────────────────────────────────────────────────────────
      verdict: 'APPROVED',
      statusNote: 'Approved with Conditions: Pilot run authorized pending timber color sorting and sanding refinement.',
      checks: {
        rating: {
          'Approved': true,
          'Repair': false,
          'New Sample': false,
          'To send for final approval': false,
        },
      },
      thumbSmall: 'data:image/jpeg;base64,/9j/4AAQSkZJRg_96px_thumbnail...',
      photoCount: 7,
    };

    // ─────────────────────────────────────────────────────────────
    // STEP 10: Persist to D1 Storage via POST /api/reports
    // ─────────────────────────────────────────────────────────────
    const postRes = await invokeFunction(reports.reportsPost, {
      method: 'POST',
      url: 'http://localhost/api/reports',
      headers: { cookie: cookieHeader },
      body: initialReport,
      env,
    });
    const postJson = await readJson(postRes);

    assert.equal(postJson.status, 200);
    assert.equal(postJson.body.success, true);
    assert.equal(postJson.body.id, reportId);
    assert.equal(postJson.body.revision, 1);
    assert.equal(postJson.body.message, 'Report created');

    // ─────────────────────────────────────────────────────────────
    // STEP 11: End-to-End Verification & Audit Trail Inspection
    // ─────────────────────────────────────────────────────────────
    // A. Verify GET /api/reports list catalog
    const listRes = await invokeFunction(reports.reportsGet, {
      method: 'GET',
      url: 'http://localhost/api/reports?moduleType=prototype&search=Ricardo',
      headers: { cookie: cookieHeader },
      env,
    });
    const listJson = await readJson(listRes);

    assert.equal(listJson.status, 200);
    assert.equal(listJson.body.total, 1);
    const catalogItem = listJson.body.reports[0];
    assert.equal(catalogItem.id, reportId);
    assert.equal(catalogItem.modelNumber, 'MD 2756');
    assert.equal(catalogItem.productName, 'Ricardo Coffee Table D1000');
    assert.equal(catalogItem.verdict, 'APPROVED');
    assert.equal(catalogItem.photoCount, 7);

    // B. Verify GET /api/reports/:id full reassembly
    const getRes = await invokeFunction(reports.reportGet, {
      method: 'GET',
      url: `http://localhost/api/reports/${reportId}`,
      params: { id: reportId },
      headers: { cookie: cookieHeader },
      env,
    });
    const getJson = await readJson(getRes);

    assert.equal(getJson.status, 200);
    assert.equal(getJson.body.success, true);
    assert.equal(getJson.body.revision, 1);

    const fullReport = getJson.body.report;
    assert.equal(fullReport.id, reportId);
    assert.equal(fullReport.modelNumber, 'MD 2756');
    assert.equal(fullReport.dimensions.length, 5);
    assert.equal(fullReport.dimensions[0].actual, '998');
    assert.equal(fullReport.watchout[0].description, UNICODE_VIETNAMESE_SAMPLES.defectNote);
    assert.equal(fullReport.assembly.hardwareCheck, 'PASS (4x M8 bolts + Allen key verified)');
    assert.equal(fullReport.checklist.length, 5);

    // C. Concurrency test: Increment revision via patch sign-off
    const patchRes = await invokeFunction(reports.reportPatch, {
      method: 'PATCH',
      url: `http://localhost/api/reports/${reportId}`,
      params: { id: reportId },
      headers: { cookie: cookieHeader },
      body: {
        ...fullReport,
        expectedRevision: 1,
        statusNote: 'Approved with Conditions: Final Sign-off Completed by Nhan Hoang.',
      },
      env,
    });
    const patchJson = await readJson(patchRes);
    assert.equal(patchJson.status, 200);
    assert.equal(patchJson.body.revision, 2);
  });
});
