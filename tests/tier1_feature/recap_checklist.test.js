import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function extract(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} must be present in index.html`);
  return match[1] !== undefined ? match[1] : match[0];
}

function extractFnBody(source, signature, label) {
  const pattern = new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([\\s\\S]*?)\\n    \\}');
  return extract(source, pattern, label);
}

function extractConstArray(name) {
  const body = extract(indexHtml, new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n    \\];`), name);
  return new Function(`return [${body}];`)();
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared extractions: module templates + checklist config
// ─────────────────────────────────────────────────────────────────────────────
const MODULES_PREPROD = extractConstArray('DEFAULT_MODULES_PREPROD');
const MODULES_PROTOTYPE = extractConstArray('DEFAULT_MODULES_PROTOTYPE');
const MODULES_RECAP = extractConstArray('DEFAULT_MODULES_RECAP');
const CHECKLIST_CONFIG = extractConstArray('DEFAULT_CHECKLIST_CONFIG');
const LEGACY_ID_MAP = (() => {
  const body = extract(indexHtml, /const LEGACY_ID_MAP = \{([\s\S]*?)\n    \};/, 'LEGACY_ID_MAP');
  return new Function(`return ({${body}});`)();
})();

const MODULE_THEMES = {
  'pre-production': { defaultModules: MODULES_PREPROD },
  'prototype': { defaultModules: MODULES_PROTOTYPE },
  'sample-review-recap': { defaultModules: MODULES_RECAP }
};

const EXPECTED_CHECKLIST_ENTRY = { id: 'sec_checklist', type: 'checklist', name: 'Check List', canDelete: true, canDuplicate: false };

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.1 — module defaults: Recap gains Check List; 01/02 unchanged
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC2.1: DEFAULT_MODULES_RECAP includes sec_checklist; other templates unchanged', () => {
  it('TC-REC2.1.1: Recap has exactly 3 sections, Check List directly after Watch Out', () => {
    assert.deepEqual(MODULES_RECAP.map(m => m.id), ['sec_overall', 'sec_watchout', 'sec_checklist']);
  });

  it('TC-REC2.1.2: the Recap checklist entry mirrors the Prototype declaration exactly', () => {
    const recapEntry = MODULES_RECAP.find(m => m.id === 'sec_checklist');
    const protoEntry = MODULES_PROTOTYPE.find(m => m.id === 'sec_checklist');
    const preprodEntry = MODULES_PREPROD.find(m => m.id === 'sec_checklist');
    assert.deepEqual(recapEntry, EXPECTED_CHECKLIST_ENTRY);
    assert.deepEqual(recapEntry, protoEntry);
    assert.deepEqual(recapEntry, preprodEntry);
  });

  it('TC-REC2.1.3: Prototype and Pre-Production defaults are unchanged', () => {
    assert.deepEqual(MODULES_PROTOTYPE.map(m => m.id), [
      'sec_overall', 'sec_photos', 'sec_dimensions', 'sec_assembly',
      'sec_watchout', 'sec_testing', 'sec_checklist', 'sec_documents'
    ]);
    assert.deepEqual(MODULES_PREPROD.map(m => m.id), [
      'sec_overall', 'sec_photos', 'sec_dimensions', 'sec_assembly',
      'sec_watchout', 'sec_testing', 'sec_checklist', 'sec_comparison',
      'sec_documents', 'sec_greenlabel'
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.2 — seeding: 13 groups / 34 criteria, all statuses null
// ─────────────────────────────────────────────────────────────────────────────
function makeSeedApi(localStorageStub) {
  const getDefaultBody = extractFnBody(indexHtml, 'function getActiveDefaultChecklist()', 'getActiveDefaultChecklist');
  const ensureBody = extractFnBody(indexHtml, 'function ensureChecklistData()', 'ensureChecklistData');
  const factory = new Function(
    'D', 'localStorage', 'scopedStorageKey', 'DEFAULT_CHECKLIST_CONFIG',
    `function getActiveDefaultChecklist() {${getDefaultBody}}
     function ensureChecklistData() {${ensureBody}}
     return { getActiveDefaultChecklist, ensureChecklistData };`
  );
  return factory;
}

describe('TC-REC2.2: checklist seeding from the standard config', () => {
  it('TC-REC2.2.1: the standard config is 13 groups / 34 criteria, every status null', () => {
    assert.equal(CHECKLIST_CONFIG.length, 13);
    const items = CHECKLIST_CONFIG.flatMap(g => g.items);
    assert.equal(items.length, 34);
    assert.ok(items.every(i => i.status === null));
  });

  it('TC-REC2.2.2: ensureChecklistData seeds a report with no checklist to 13/34 null', () => {
    const D = {};
    const localStorageStub = { getItem: () => null };
    const api = makeSeedApi(localStorageStub)(D, localStorageStub, (k) => k, CHECKLIST_CONFIG);
    api.ensureChecklistData();
    assert.equal(D.checklist.length, 13);
    assert.equal(D.checklist.flatMap(g => g.items).length, 34);
    assert.ok(D.checklist.flatMap(g => g.items).every(i => i.status === null));
    // Seeding is a deep copy: mutating the report must not corrupt the config.
    D.checklist[0].items[0].status = 'yes';
    assert.equal(CHECKLIST_CONFIG[0].items[0].status, null);
  });

  it('TC-REC2.2.3: an existing checklist is never re-seeded or duplicated', () => {
    const existing = [{ id: 'cg_x', title: 'Mine', items: [{ id: 'ci_x', text: 'Keep me', status: 'yes' }] }];
    const D = { checklist: JSON.parse(JSON.stringify(existing)) };
    const localStorageStub = { getItem: () => null };
    const api = makeSeedApi(localStorageStub)(D, localStorageStub, (k) => k, CHECKLIST_CONFIG);
    api.ensureChecklistData();
    api.ensureChecklistData();
    assert.deepEqual(D.checklist, existing);
  });

  it('TC-REC2.2.4: new reports are created with the checklist pre-seeded from the active default', () => {
    assert.ok(indexHtml.includes('checklist: JSON.parse(JSON.stringify(getActiveDefaultChecklist()))'),
      'newReport seeds D.checklist for every module type, Recap included');
    assert.ok(indexHtml.includes('modules: JSON.parse(JSON.stringify(modCfg.defaultModules))'),
      'newReport takes its section list from the module theme (Recap now includes sec_checklist)');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.3 — backfill: stored Recap reports gain the section on load
// ─────────────────────────────────────────────────────────────────────────────
function makeEnsureApi() {
  const body = extractFnBody(indexHtml, 'function ensureReportModules()', 'ensureReportModules');
  const factory = new Function(
    'D', 'MODULE_THEMES', 'LEGACY_ID_MAP', 'currentActiveModule',
    `function ensureReportModules() {${body}}\nreturn ensureReportModules;`
  );
  return (D) => { factory(D, MODULE_THEMES, LEGACY_ID_MAP, null)(); };
}

const LEGACY_RECAP_MODULES = [
  { id: 'sec_overall', type: 'overall', name: 'OVERVIEW', canDelete: false, canDuplicate: false },
  { id: 'sec_watchout', type: 'watchout', name: 'Quality Watch Out', key: 'watchoutPhotos', notesKey: 'watchoutNotes', canDelete: false, canDuplicate: true }
];

describe('TC-REC2.3: ensureReportModules backfills Check List for Recap only, exactly once', () => {
  const ensure = makeEnsureApi();

  it('TC-REC2.3.1: a stored 2-section Recap report gains Check List after Watch Out; its data is untouched', () => {
    const D = {
      moduleType: 'sample-review-recap',
      reportTitle: 'SAMPLE REVIEW RECAP',
      modules: JSON.parse(JSON.stringify(LEGACY_RECAP_MODULES)),
      watchoutPhotos: [{ img: 'data:image/x', caption: 'Scratch', action: 'fix-now' }],
      watchoutNotes: 'keep me',
      checklist: [{ id: 'cg_old', title: 'Old', items: [{ id: 'ci_old', text: 'Old item', status: 'yes' }] }]
    };
    const before = JSON.stringify({ w: D.watchoutPhotos, n: D.watchoutNotes, c: D.checklist });
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_watchout', 'sec_checklist']);
    assert.deepEqual(D.modules[2], EXPECTED_CHECKLIST_ENTRY);
    assert.equal(JSON.stringify({ w: D.watchoutPhotos, n: D.watchoutNotes, c: D.checklist }), before,
      'Overview/Watch Out data and any stored checklist data are preserved verbatim');
  });

  it('TC-REC2.3.2: the backfill is idempotent — repeated calls keep exactly 3 sections', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(LEGACY_RECAP_MODULES))
    };
    ensure(D);
    ensure(D);
    ensure(D);
    assert.equal(D.modules.length, 3);
    assert.equal(D.modules.filter(m => m.type === 'checklist').length, 1);
  });

  it('TC-REC2.3.3: a deliberately deleted Check List is NOT resurrected (one-time marker)', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(LEGACY_RECAP_MODULES))
    };
    ensure(D);
    assert.equal(D.modules.length, 3, 'first open backfills');
    D.modules = D.modules.filter(m => m.id !== 'sec_checklist'); // user deletes the section
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_watchout'],
      'the marker left by the backfill keeps a user-deleted section deleted');
  });

  it('TC-REC2.3.4: a legacy Recap report without moduleType is recognised by title and backfilled', () => {
    const D = {
      reportTitle: 'SAMPLE REVIEW RECAP — Sofa X',
      modules: JSON.parse(JSON.stringify(LEGACY_RECAP_MODULES))
    };
    ensure(D);
    assert.equal(D.moduleType, 'sample-review-recap');
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_watchout', 'sec_checklist']);
  });

  it('TC-REC2.3.5: the backfill is Recap-scoped — Prototype/Pre-Production stored lists are left alone', () => {
    const proto = {
      moduleType: 'prototype',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      modules: MODULES_PROTOTYPE.filter(m => m.id !== 'sec_checklist').map(m => ({ ...m }))
    };
    ensure(proto);
    assert.ok(!proto.modules.some(m => m.type === 'checklist'),
      'a Prototype report whose user removed Check List keeps it removed (manual restore flow unchanged)');
  });

  it('TC-REC2.3.6: a Recap report with no stored module list gets the full 3-section defaults', () => {
    const D = { moduleType: 'sample-review-recap', reportTitle: 'SAMPLE REVIEW RECAP' };
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_watchout', 'sec_checklist']);
    assert.deepEqual(D.modules, MODULES_RECAP);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.4 — snapshot / undo round-trip of checklist data
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC2.4: checklist statuses survive draft-snapshot and history round-trips', () => {
  const PHOTO = 'data:image/jpeg;base64,' + 'QUJD'.repeat(200); // > 200 chars → fingerprinted / vaulted

  function makeSnapshotApi() {
    const hashBody = extractFnBody(indexHtml, 'function photoStrongHash(value)', 'photoStrongHash');
    const refBody = extractFnBody(indexHtml, 'function photoRefForValue(value)', 'photoRefForValue');
    const refStrongBody = extractFnBody(indexHtml, 'function photoRefForValueStrong(value)', 'photoRefForValueStrong');
    const stripBody = extractFnBody(indexHtml, 'function stripPhotosForSnapshot(report)', 'stripPhotosForSnapshot');
    const restoreBody = extractFnBody(indexHtml, 'function restoreSnapshotIntoReport(dbReport, snapData)', 'restoreSnapshotIntoReport');
    return new Function(
      `function photoStrongHash(value) {${hashBody}}
       function photoRefForValue(value) {${refBody}}
       function photoRefForValueStrong(value) {${refStrongBody}}
       function stripPhotosForSnapshot(report) {${stripBody}}
       function restoreSnapshotIntoReport(dbReport, snapData) {${restoreBody}}
       return { stripPhotosForSnapshot, restoreSnapshotIntoReport };`
    )();
  }

  function checklistWith(statusA, statusB) {
    return [
      { id: 'cg_1', title: 'Product Photos', items: [
        { id: 'ci_1_1', text: 'Four Views', status: statusA },
        { id: 'ci_1_2', text: 'Comparing Prototype Sample', status: statusB }
      ] }
    ];
  }

  it('TC-REC2.4.1: draft restore brings back edited checklist statuses AND re-attaches checklist photos', () => {
    const snapApi = makeSnapshotApi();
    const dbReport = {
      id: 'r1',
      moduleType: 'sample-review-recap',
      checklist: checklistWith(null, null),
      checklistPhotos: [{ img: PHOTO, caption: 'Label photo' }]
    };
    const draftReport = {
      id: 'r1',
      moduleType: 'sample-review-recap',
      checklist: checklistWith('yes', 'no'),
      checklistPhotos: [{ img: PHOTO, caption: 'Label photo' }]
    };
    const snapData = snapApi.stripPhotosForSnapshot(draftReport);
    assert.equal(snapData.checklist[0].items[0].status, 'yes', 'the snapshot keeps checklist statuses verbatim');
    const { report, hadMismatches } = snapApi.restoreSnapshotIntoReport(dbReport, snapData);
    assert.equal(hadMismatches, false);
    assert.equal(report.checklist[0].items[0].status, 'yes');
    assert.equal(report.checklist[0].items[1].status, 'no');
    assert.equal(report.checklistPhotos[0].img, PHOTO, 'checklist photo payload is re-attached from the DB copy');
  });

  it('TC-REC2.4.2: undo history (dehydrate/hydrate) restores the checklist as it was at snapshot time', () => {
    const hashBody = extractFnBody(indexHtml, 'function photoStrongHash(value)', 'photoStrongHash');
    const vaultKeyBody = extractFnBody(indexHtml, 'function getVaultKey(base64Str)', 'getVaultKey');
    const dehydrateBody = extractFnBody(indexHtml, 'function dehydrateReportForHistory(reportObj)', 'dehydrateReportForHistory');
    const hydrateBody = extractFnBody(indexHtml, 'function hydrateReportFromHistory(snapshotJson)', 'hydrateReportFromHistory');
    const photoVault = new Map();
    const snapshotPhotoRefs = new Map();
    const hist = new Function(
      'photoVault', 'snapshotPhotoRefs',
      `function photoStrongHash(value) {${hashBody}}
       function getVaultKey(base64Str) {${vaultKeyBody}}
       function dehydrateReportForHistory(reportObj) {${dehydrateBody}}
       function hydrateReportFromHistory(snapshotJson) {${hydrateBody}}
       return { dehydrateReportForHistory, hydrateReportFromHistory };`
    )(photoVault, snapshotPhotoRefs);

    const D = {
      moduleType: 'sample-review-recap',
      checklist: checklistWith('yes', null),
      checklistPhotos: [{ img: PHOTO, caption: 'Label photo' }]
    };
    const snap = hist.dehydrateReportForHistory(D);
    assert.ok(snap, 'snapshot produced');
    // Simulate later edits after the snapshot was taken.
    D.checklist[0].items[0].status = 'no';
    D.checklist[0].items[1].status = 'yes';
    const restored = hist.hydrateReportFromHistory(snap);
    assert.equal(restored.checklist[0].items[0].status, 'yes', 'undo restores the earlier status');
    assert.equal(restored.checklist[0].items[1].status, null);
    assert.equal(restored.checklistPhotos[0].img, PHOTO, 'photo payload comes back out of the vault');
  });

  it('TC-REC2.4.3: the checklist status mutator follows the shared mutation discipline', () => {
    const toggleBody = extractFnBody(indexHtml, 'function toggleChecklistStatus(gIdx, iIdx, targetStatus)', 'toggleChecklistStatus');
    const histIdx = toggleBody.indexOf('pushHistory(');
    const mutIdx = toggleBody.indexOf('.status = (cur === targetStatus)');
    assert.ok(histIdx !== -1 && mutIdx !== -1 && histIdx < mutIdx, 'history snapshot is taken BEFORE the status flips');
    assert.ok(toggleBody.includes('renderChecklist();'));
    assert.ok(toggleBody.includes('as();'), 'the change goes through the normal report save path');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.5 — QUALITY SUMMARY checklist tally (builder + editor + PDF)
// ─────────────────────────────────────────────────────────────────────────────
function makeQsApi(L) {
  const chkBuilderBody = extractFnBody(indexHtml, 'function buildRecapChecklistSummary(report)', 'buildRecapChecklistSummary');
  const chkTallyBody = extractFnBody(indexHtml, 'function recapChecklistTallyText(summary, lang)', 'recapChecklistTallyText');
  const factory = new Function(
    'L',
    `function buildRecapChecklistSummary(report) {${chkBuilderBody}}
     function recapChecklistTallyText(summary, lang) {${chkTallyBody}}
     return { buildRecapChecklistSummary, recapChecklistTallyText };`
  );
  return factory(L);
}

function fixtureChecklist(yes, no, pending) {
  const items = [];
  let n = 0;
  const push = (status, count) => { for (let i = 0; i < count; i++) items.push({ id: 'ci_' + (++n), text: 'Item ' + n, status }); };
  push('yes', yes); push('no', no); push(null, pending);
  return [{ id: 'cg_1', title: 'Group', items }];
}

describe('TC-REC2.5: QUALITY SUMMARY gains a checklist tally line', () => {
  const qs = makeQsApi((vi, en) => en);

  it('TC-REC2.5.1: the builder counts passed/failed/pending with the checklist UI semantics (they add up)', () => {
    const s = qs.buildRecapChecklistSummary({ checklist: fixtureChecklist(30, 2, 2) });
    assert.deepEqual(s, { total: 34, passed: 30, failed: 2, pending: 2 });
    assert.equal(s.passed + s.failed + s.pending, s.total);
  });

  it('TC-REC2.5.2: the tally line reads "Checklist: 30/34 passed · 2 failed · 2 pending"', () => {
    const s = qs.buildRecapChecklistSummary({ checklist: fixtureChecklist(30, 2, 2) });
    assert.equal(qs.recapChecklistTallyText(s, 'en'), 'Checklist: 30/34 passed · 2 failed · 2 pending');
  });

  it('TC-REC2.5.3: zero-count parts are omitted; an untouched checklist still reports its pending count', () => {
    assert.equal(
      qs.recapChecklistTallyText(qs.buildRecapChecklistSummary({ checklist: fixtureChecklist(0, 0, 34) }), 'en'),
      'Checklist: 0/34 passed · 34 pending'
    );
    assert.equal(
      qs.recapChecklistTallyText(qs.buildRecapChecklistSummary({ checklist: fixtureChecklist(34, 0, 0) }), 'en'),
      'Checklist: 34/34 passed'
    );
    assert.equal(
      qs.recapChecklistTallyText(qs.buildRecapChecklistSummary({ checklist: fixtureChecklist(33, 1, 0) }), 'en'),
      'Checklist: 33/34 passed · 1 failed'
    );
  });

  it('TC-REC2.5.4: no checklist data → empty summary and no line at all', () => {
    for (const report of [{}, { checklist: [] }, { checklist: null }, null, undefined]) {
      const s = qs.buildRecapChecklistSummary(report);
      assert.equal(s.total, 0);
      assert.equal(qs.recapChecklistTallyText(s, 'en'), '');
    }
    assert.equal(qs.recapChecklistTallyText(null, 'en'), '');
  });

  it('TC-REC2.5.5: the seeded standard config tallies as 0/34 passed · 34 pending', () => {
    const s = qs.buildRecapChecklistSummary({ checklist: JSON.parse(JSON.stringify(CHECKLIST_CONFIG)) });
    assert.equal(qs.recapChecklistTallyText(s, 'en'), 'Checklist: 0/34 passed · 34 pending');
  });

  it('TC-REC2.5.6: the editor QUALITY SUMMARY block renders the checklist line from the shared builder', () => {
    const body = extractFnBody(indexHtml, 'function renderRecapAutoSummary()', 'renderRecapAutoSummary');
    assert.ok(body.includes('buildRecapChecklistSummary(D)'), 'editor block reads the shared checklist builder');
    assert.ok(body.includes('recapChecklistTallyText(chk)'), 'editor block renders the shared tally text');
    assert.ok(body.includes('buildRecapWatchoutSummary(D)'), 'the REC-1 watch-out summary is still there');
    assert.ok(body.includes('recapMainTallyText(s)'), 'the REC-1 watch-out tally is still there');
    assert.ok(!body.includes('overviewSummaryStrip'), 'the v4.1.5-removed badge strip is NOT resurrected');
  });

  it('TC-REC2.5.7: the PDF page-1 QUALITY SUMMARY renders the same line, forced to English', () => {
    assert.ok(indexHtml.includes('const recapChecklist = buildRecapChecklistSummary(D);'));
    assert.ok(indexHtml.includes("recapChecklistTallyText(recapChecklist, 'en')"), 'PDF tally must be forced to English');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC2.6 — PDF path: the dispatcher renders Check List for Recap too
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC2.6: PDF checklist rendering is module-driven, not Recap-gated', () => {
  const dispatcherIdx = indexHtml.indexOf('DYNAMIC MODULES DISPATCHER');
  const checklistIdx = indexHtml.indexOf("if (modType === 'checklist')", dispatcherIdx);
  const documentsIdx = indexHtml.indexOf("if (modType === 'documents')", checklistIdx);

  it('TC-REC2.6.1: the PDF dispatcher walks the report\'s own module list', () => {
    assert.ok(dispatcherIdx !== -1, 'dispatcher present');
    const head = indexHtml.slice(dispatcherIdx, dispatcherIdx + 400);
    assert.ok(head.includes('ensureReportModules();'), 'stored module lists are normalised (incl. the REC-2 backfill) before dispatch');
    assert.ok(head.includes('activeModules.forEach(mod =>'), 'sections render in the report\'s module order');
  });

  it('TC-REC2.6.2: the checklist branch renders the same table as Prototype (no isRecap gate inside)', () => {
    assert.ok(checklistIdx !== -1 && documentsIdx > checklistIdx, 'checklist branch present before documents branch');
    const branch = indexHtml.slice(checklistIdx, documentsIdx);
    assert.ok(branch.includes('hasChecklistData'), 'renders when the report carries checklist data');
    assert.ok(branch.includes('drawChecklistTableHeader'), 'same table renderer as modules 01/02');
    assert.ok(branch.includes('renderPhotoSection'), 'checklist photos/remarks render too');
    assert.ok(!branch.includes('isRecap'), 'nothing in the checklist branch is gated on Recap — Recap flows through it like any module');
  });

  it('TC-REC2.6.3: the v4.0.2 header-strip badge stays non-Recap (that strip is not part of the Recap PDF)', () => {
    assert.ok(indexHtml.includes('if (!isRecap && qm.totalCriteria > 0) {'),
      'the checklist badge in the (non-Recap) summary strip is unchanged');
  });
});
