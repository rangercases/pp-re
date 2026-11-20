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

const MODULES_PREPROD = extractConstArray('DEFAULT_MODULES_PREPROD');
const MODULES_PROTOTYPE = extractConstArray('DEFAULT_MODULES_PROTOTYPE');
const MODULES_RECAP = extractConstArray('DEFAULT_MODULES_RECAP');

const MODULE_THEMES = {
  'pre-production': { defaultModules: MODULES_PREPROD },
  'prototype': { defaultModules: MODULES_PROTOTYPE },
  'sample-review-recap': { defaultModules: MODULES_RECAP }
};
const LEGACY_ID_MAP = (() => {
  const body = extract(indexHtml, /const LEGACY_ID_MAP = \{([\s\S]*?)\n    \};/, 'LEGACY_ID_MAP');
  return new Function(`return ({${body}});`)();
})();

function makeEnsureApi() {
  const body = extractFnBody(indexHtml, 'function ensureReportModules()', 'ensureReportModules');
  const factory = new Function(
    'D', 'MODULE_THEMES', 'LEGACY_ID_MAP', 'currentActiveModule',
    `function ensureReportModules() {${body}}\nreturn ensureReportModules;`
  );
  return (D) => { factory(D, MODULE_THEMES, LEGACY_ID_MAP, null)(); };
}

// The module list every Pre-Production report carried before v4.12.0.
const LEGACY_PREPROD_MODULES = [
  { id: 'sec_overall', type: 'overall', name: 'OVERVIEW', canDelete: false, canDuplicate: false },
  { id: 'sec_photos', type: 'photos', name: 'Product Photos', key: 'prodPhotos', canDelete: true, canDuplicate: true },
  { id: 'sec_dimensions', type: 'dimensions', name: 'Product Dimension & Details', canDelete: true, canDuplicate: true },
  { id: 'sec_assembly', type: 'assembly', name: 'Product Assembly', key: 'assemblyPhotos', notesKey: 'assemblyNotes', canDelete: true, canDuplicate: true },
  { id: 'sec_watchout', type: 'watchout', name: 'Quality Watch Out', key: 'watchoutPhotos', notesKey: 'watchoutNotes', canDelete: true, canDuplicate: true },
  { id: 'sec_testing', type: 'testing', name: 'Testing', key: 'testingPhotos', notesKey: 'testingNotes', canDelete: true, canDuplicate: true },
  { id: 'sec_checklist', type: 'checklist', name: 'Check List', canDelete: true, canDuplicate: false },
  { id: 'sec_comparison', type: 'comparison', name: 'Product Comparison', key: 'comparisonPhotos', notesKey: 'comparisonNotes', canDelete: true, canDuplicate: true },
  { id: 'sec_documents', type: 'documents', name: 'Technical Documents', key: 'docAttachments', canDelete: true, canDuplicate: true },
  { id: 'sec_greenlabel', type: 'greenlabel', name: 'Final Approved / Green Label', key: 'greenlabelPhotos', notesKey: 'greenlabelNotes', canDelete: true, canDuplicate: true }
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.1 — template shape: BV Test takes Testing's slot; Testing standby
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.1: Pre-Production template — BV Test after Watch Out, Testing standby right after it', () => {
  it('TC-BVT.1.1: sec_bvtest sits immediately after sec_watchout with the exact BV Test def', () => {
    const ids = MODULES_PREPROD.map(m => m.id);
    const bv = MODULES_PREPROD.find(m => m.id === 'sec_bvtest');
    assert.deepEqual(bv, {
      id: 'sec_bvtest', type: 'bvtest', name: 'BV Test',
      key: 'bvAttachments', notesKey: 'bvNotes', canDelete: true, canDuplicate: true
    });
    assert.equal(ids.indexOf('sec_bvtest'), ids.indexOf('sec_watchout') + 1,
      'BV Test occupies the position Testing held before v4.12.0');
  });

  it('TC-BVT.1.2: sec_testing stays in the template, marked standby, immediately after sec_bvtest', () => {
    const ids = MODULES_PREPROD.map(m => m.id);
    const testing = MODULES_PREPROD.find(m => m.id === 'sec_testing');
    assert.equal(testing.standby, true, 'Testing is standby, not deleted from the template');
    assert.equal(ids.indexOf('sec_testing'), ids.indexOf('sec_bvtest') + 1);
    assert.equal(testing.key, 'testingPhotos', 'the standby def still points at the live data keys');
  });

  it('TC-BVT.1.3: Prototype and Recap templates are untouched (Testing stays a normal default)', () => {
    const protoTesting = MODULES_PROTOTYPE.find(m => m.id === 'sec_testing');
    assert.ok(protoTesting, 'Prototype keeps Testing');
    assert.equal(protoTesting.standby, undefined, 'Prototype Testing is NOT standby');
    assert.ok(!MODULES_PROTOTYPE.some(m => m.id === 'sec_bvtest'), 'no BV Test in Prototype');
    assert.ok(!MODULES_RECAP.some(m => m.id === 'sec_bvtest' || m.id === 'sec_testing'), 'Recap unchanged');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.2 — seeding: new reports never receive the standby tab
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.2: seeding from defaults skips standby entries', () => {
  const ensure = makeEnsureApi();

  it('TC-BVT.2.1: a Pre-Production report with no stored list seeds BV Test and NOT Testing', () => {
    const D = { moduleType: 'pre-production', reportTitle: 'PRE-PRODUCTION SAMPLE REVIEW REPORT' };
    ensure(D);
    const ids = D.modules.map(m => m.id);
    assert.ok(ids.includes('sec_bvtest'), 'BV Test is seeded');
    assert.ok(!ids.includes('sec_testing'), 'standby Testing is NOT seeded');
    assert.ok(D.modules.every(m => !m.standby), 'no standby flag leaks into a live module list');
    assert.equal(ids.indexOf('sec_bvtest'), ids.indexOf('sec_watchout') + 1);
    assert.equal(D.preprodBvTestMigrated, true, 'a freshly seeded report is already marked migrated');
  });

  it('TC-BVT.2.2: the new-report factory filters standby and seeds the BV data fields', () => {
    assert.ok(indexHtml.includes('modules: JSON.parse(JSON.stringify(modCfg.defaultModules)).filter(m => !m.standby)'),
      'newReport clones the theme defaults minus standby entries');
    assert.ok(indexHtml.includes('bvAttachments: [], bvNotes: \'\''),
      'newReport seeds empty bvAttachments / bvNotes alongside docAttachments');
  });

  it('TC-BVT.2.3: a Prototype report with no stored list still seeds Testing normally', () => {
    const D = { moduleType: 'prototype', reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT' };
    ensure(D);
    assert.ok(D.modules.some(m => m.id === 'sec_testing'), 'Prototype Testing seeded');
    assert.ok(!D.modules.some(m => m.id === 'sec_bvtest'), 'no BV Test seeded for Prototype');
    assert.equal(D.preprodBvTestMigrated, undefined, 'migration flag is Pre-Production only');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.3 — migration: existing Pre-Production reports swap Testing → BV Test
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.3: ensureReportModules migrates stored Pre-Production lists exactly once', () => {
  const ensure = makeEnsureApi();

  it('TC-BVT.3.1: Testing is replaced IN PLACE by BV Test; Testing data is preserved verbatim', () => {
    const D = {
      moduleType: 'pre-production',
      reportTitle: 'PRE-PRODUCTION SAMPLE REVIEW REPORT',
      modules: JSON.parse(JSON.stringify(LEGACY_PREPROD_MODULES)),
      bvRows: [{ test: 'Stability test', result: 'Pass', remark: 'BV lab' }],
      testingPhotos: [{ img: 'data:image/jpeg;base64,AAAA', caption: 'Lab' }],
      testingNotes: 'Sent to BV on 12-Nov'
    };
    const dataBefore = JSON.stringify({ b: D.bvRows, p: D.testingPhotos, n: D.testingNotes });
    ensure(D);
    const ids = D.modules.map(m => m.id);
    assert.equal(ids.length, LEGACY_PREPROD_MODULES.length, 'a swap, not an insert — same tab count');
    assert.equal(ids[5], 'sec_bvtest', 'BV Test lands exactly where Testing sat');
    assert.ok(!ids.includes('sec_testing'), 'Testing entry is gone from the active list');
    assert.deepEqual(D.modules[5], MODULES_PREPROD.find(m => m.id === 'sec_bvtest'),
      'the inserted entry is a clone of the template def');
    assert.equal(JSON.stringify({ b: D.bvRows, p: D.testingPhotos, n: D.testingNotes }), dataBefore,
      'bvRows / testingPhotos / testingNotes are never touched — re-adding Testing restores everything');
    assert.equal(D.preprodBvTestMigrated, true);
  });

  it('TC-BVT.3.2: the migration is one-time — a user-restored Testing tab and a deleted BV Test stay as the user left them', () => {
    const D = {
      moduleType: 'pre-production',
      modules: JSON.parse(JSON.stringify(LEGACY_PREPROD_MODULES))
    };
    ensure(D); // migrates, sets the flag
    // User re-adds Testing from Manage Modules and removes BV Test.
    D.modules.push({ id: 'sec_testing', type: 'testing', name: 'Testing', key: 'testingPhotos', notesKey: 'testingNotes', canDelete: true, canDuplicate: true });
    D.modules = D.modules.filter(m => m.id !== 'sec_bvtest');
    const before = JSON.stringify(D.modules.map(m => m.id));
    ensure(D);
    ensure(D);
    assert.equal(JSON.stringify(D.modules.map(m => m.id)), before,
      'with the flag set, ensureReportModules never swaps tabs again');
  });

  it('TC-BVT.3.3: a stored list with neither Testing nor BV Test gains BV Test right after Watch Out', () => {
    const D = {
      moduleType: 'pre-production',
      modules: LEGACY_PREPROD_MODULES.filter(m => m.id !== 'sec_testing').map(m => ({ ...m }))
    };
    ensure(D);
    const ids = D.modules.map(m => m.id);
    assert.equal(ids.indexOf('sec_bvtest'), ids.indexOf('sec_watchout') + 1);
    assert.equal(D.preprodBvTestMigrated, true);
  });

  it('TC-BVT.3.4: Prototype stored lists are never migrated', () => {
    const D = {
      moduleType: 'prototype',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      modules: MODULES_PROTOTYPE.map(m => ({ ...m }))
    };
    ensure(D);
    assert.ok(D.modules.some(m => m.id === 'sec_testing'), 'Prototype Testing stays active');
    assert.ok(!D.modules.some(m => m.id === 'sec_bvtest'), 'no BV Test appears');
    assert.equal(D.preprodBvTestMigrated, undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.4 — Manage Modules / Add view: the standby tab stays on offer
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.4: the Add view still offers standby Testing (and BV Test when removed)', () => {
  function makeAddViewApi() {
    const ensureBody = extractFnBody(indexHtml, 'function ensureReportModules()', 'ensureReportModules');
    const addBody = extractFnBody(indexHtml, 'function renderTabMgrAddView(body)', 'renderTabMgrAddView');
    const escBody = extractFnBody(indexHtml, 'function escapeHtml(str)', 'escapeHtml');
    const factory = new Function(
      'D', 'MODULE_THEMES', 'LEGACY_ID_MAP', 'currentActiveModule',
      `function ensureReportModules() {${ensureBody}}
       function escapeHtml(str) {${escBody}}
       function renderTabMgrAddView(body) {${addBody}}
       return renderTabMgrAddView;`
    );
    return (D) => factory(D, MODULE_THEMES, LEGACY_ID_MAP, null);
  }

  it('TC-BVT.4.1: a new-style Pre-Production report (BV Test active, Testing standby) is offered Testing', () => {
    const renderAdd = makeAddViewApi();
    const D = {
      moduleType: 'pre-production',
      preprodBvTestMigrated: true,
      modules: MODULES_PREPROD.filter(m => !m.standby).map(m => ({ ...m }))
    };
    const body = { innerHTML: '' };
    renderAdd(D)(body);
    assert.ok(body.innerHTML.includes("restoreStandardModuleFromMgr('testing', 'sec_testing')"),
      'Testing is listed in the Add view so it can be restored');
    assert.ok(!body.innerHTML.includes("restoreStandardModuleFromMgr('bvtest', 'sec_bvtest')"),
      'the already-active BV Test is not offered again');
  });

  it('TC-BVT.4.2: a report whose user removed BV Test is offered BV Test again', () => {
    const renderAdd = makeAddViewApi();
    const D = {
      moduleType: 'pre-production',
      preprodBvTestMigrated: true,
      modules: MODULES_PREPROD.filter(m => !m.standby && m.id !== 'sec_bvtest').map(m => ({ ...m }))
    };
    const body = { innerHTML: '' };
    renderAdd(D)(body);
    assert.ok(body.innerHTML.includes("restoreStandardModuleFromMgr('bvtest', 'sec_bvtest')"),
      'BV Test is listed in the Add view when inactive');
  });

  it('TC-BVT.4.3: restore wiring — bvtest data init + standby flag stripped on restore + type dedupe', () => {
    assert.ok(indexHtml.includes("if (modType === 'bvtest' && !D.bvAttachments) D.bvAttachments = [];"),
      'restoring BV Test initialises bvAttachments like documents does for docAttachments');
    assert.ok(indexHtml.includes('delete newMod.standby;'),
      'a restored module is active — the standby marker is stripped from the clone');
    const addBody = extractFnBody(indexHtml, 'function renderTabMgrAddView(body)', 'renderTabMgrAddView');
    assert.ok(addBody.includes("'documents', 'bvtest'"), 'the Add-view type-dedupe list covers bvtest');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.5 — the shared attachment engine covers both sections
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.5: ATTACH_SECTIONS generalizes the documents subsystem to BV Test', () => {
  const ATTACH_SECTIONS = (() => {
    const body = extract(indexHtml, /const ATTACH_SECTIONS = \{([\s\S]*?)\n    \};/, 'ATTACH_SECTIONS');
    return new Function(`return ({${body}});`)();
  })();

  it('TC-BVT.5.1: the config maps each section to its data key and element ids', () => {
    assert.equal(ATTACH_SECTIONS.documents.key, 'docAttachments');
    assert.equal(ATTACH_SECTIONS.documents.listId, 'docFilesList');
    assert.equal(ATTACH_SECTIONS.documents.inputId, 'docFileInput');
    assert.equal(ATTACH_SECTIONS.documents.boxId, 'docUploadBox');
    assert.equal(ATTACH_SECTIONS.bvtest.key, 'bvAttachments');
    assert.equal(ATTACH_SECTIONS.bvtest.listId, 'bvFilesList');
    assert.equal(ATTACH_SECTIONS.bvtest.inputId, 'bvFileInput');
    assert.equal(ATTACH_SECTIONS.bvtest.boxId, 'bvUploadBox');
    assert.notEqual(ATTACH_SECTIONS.bvtest.cardPrefix, ATTACH_SECTIONS.documents.cardPrefix,
      'card element ids are section-scoped so the two lists never collide in the DOM');
  });

  it('TC-BVT.5.2: every attachment function takes a section argument defaulting to documents', () => {
    assert.ok(indexHtml.includes("function renderDocAttachments(section = 'documents')"));
    assert.ok(indexHtml.includes("async function handleDocFilesSelected(e, section = 'documents')"));
    assert.ok(indexHtml.includes("async function processDocFiles(fileList, section = 'documents')"));
    assert.ok(indexHtml.includes("async function deleteDocAttachment(index, section = 'documents')"));
    assert.ok(indexHtml.includes("function openDocPreviewModal(docId, section = 'documents')"));
    assert.ok(indexHtml.includes("function initDocDropZone(section = 'documents')"));
    assert.ok(indexHtml.includes("renderDocAttachments('bvtest');"), 'the BV list is rendered wherever documents are');
    assert.ok(indexHtml.includes("initDocDropZone('bvtest');"), 'the BV drop zone is wired wherever documents are');
  });

  it('TC-BVT.5.3: the #sec_bvtest editor block mirrors #sec_documents (upload box, input, list, notes)', () => {
    const start = indexHtml.indexOf('id="sec_bvtest"');
    assert.ok(start !== -1, 'sec_bvtest block must exist');
    const block = indexHtml.slice(start, indexHtml.indexOf('id="sec_checklist"', start));
    assert.ok(block.includes('<span class="module-title-display" data-module-id="sec_bvtest">BV Test</span>'));
    assert.ok(block.includes('id="bvUploadBox"'));
    assert.ok(block.includes('id="bvFileInput"'));
    assert.ok(block.includes('accept=".pdf,image/png,image/jpeg,image/webp"'), 'same accepted types as documents');
    assert.ok(block.includes('onchange="handleDocFilesSelected(event, \'bvtest\')"'),
      'the BV input routes through the shared handler with its section');
    assert.ok(block.includes('id="bvFilesList"'));
    assert.ok(block.includes('<textarea id="bvNotes" placeholder="BV test report remarks..."'),
      'BV notes textarea mirrors the documents notes area');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.6 — disk mode: BV files dehydrate/hydrate under their own prefix
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.6: fsCollectDocRecords collects BV attachments with the bv: prefix', () => {
  function makeCollectApi() {
    const body = extractFnBody(indexHtml, 'function fsCollectDocRecords(rep)', 'fsCollectDocRecords');
    return new Function(`function fsCollectDocRecords(rep) {${body}}\nreturn fsCollectDocRecords;`)();
  }

  it('TC-BVT.6.1: doc and BV records are collected side by side with distinct keys', () => {
    const collect = makeCollectApi();
    const rep = {
      docAttachments: [{ id: 'doc1', data: 'data:application/pdf;base64,EEEE', name: 'drawing.pdf' }],
      bvAttachments: [{ id: 'bv1', data: 'data:application/pdf;base64,FFFF', name: 'bv-report.pdf' }]
    };
    const out = collect(rep);
    assert.deepEqual(out.map(r => r.key), ['doc:doc1', 'bv:bv1']);
    assert.equal(out[1].rec, rep.bvAttachments[0], 'the BV record points at the live attachment object');
    assert.deepEqual(out[1].names, ['img', 'data'], 'same dehydrated fields as documents');
  });

  it('TC-BVT.6.2: a report without BV attachments collects exactly as before', () => {
    const collect = makeCollectApi();
    const out = collect({ docAttachments: [{ id: 'd1', img: 'data:image/png;base64,AA' }] });
    assert.deepEqual(out.map(r => r.key), ['doc:d1']);
    assert.deepEqual(collect({}), [], 'missing arrays are tolerated');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-BVT.7 — PDF export + notes sync cover the BV Test section
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-BVT.7: PDF dispatcher, image prep and notes sync handle bvtest/bvAttachments/bvNotes', () => {
  it('TC-BVT.7.1: the module dispatcher renders bvtest through the documents branch', () => {
    assert.ok(indexHtml.includes("if (modType === 'documents' || modType === 'bvtest') {"),
      'one dispatcher branch serves both attachment sections');
    assert.ok(indexHtml.includes("isBvTest ? D.bvAttachments : D.docAttachments"),
      'the branch reads the section’s own attachment list');
    assert.ok(indexHtml.includes("isBvTest ? D.bvNotes : D.docNotes"),
      'the branch prints the section’s own remarks');
  });

  it('TC-BVT.7.2: PDF prep unpacks BV attachments and the image walker visits them', () => {
    assert.ok(indexHtml.includes('if (D.bvAttachments && D.bvAttachments.length > 0) {'),
      'the pre-dispatcher ensure-rendered loop covers bvAttachments');
    assert.ok(indexHtml.includes("['dimensions', 'docAttachments', 'bvAttachments']"),
      'the PDF image-source walker includes bvAttachments');
  });

  it('TC-BVT.7.3: bvNotes is wired into both notes sync maps', () => {
    assert.ok(indexHtml.includes("docNotes: 'docNotes', bvNotes: 'bvNotes'"),
      'FIELD_KEY_MAP syncs the BV notes textarea');
    const loadBody = extractFnBody(indexHtml, 'function loadData()', 'loadData');
    assert.ok(loadBody.includes("'docNotes', 'bvNotes'"), 'loadData loads bvNotes into its textarea');
  });

  it('TC-BVT.7.4: the import-progress collector needs no change — bvAttachments matches its Attachments sweep', () => {
    assert.ok(indexHtml.includes('/(Photos|Attachments)$/.test(k)'),
      'normalizeReportPhotos sweeps every *Attachments key, bvAttachments included');
  });
});
