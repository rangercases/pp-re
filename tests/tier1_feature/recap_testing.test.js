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

const MODULES_PROTOTYPE = extractConstArray('DEFAULT_MODULES_PROTOTYPE');
const MODULES_PREPROD = extractConstArray('DEFAULT_MODULES_PREPROD');
const MODULES_RECAP = extractConstArray('DEFAULT_MODULES_RECAP');

const LEGACY_ID_MAP = (() => {
  const body = extract(indexHtml, /const LEGACY_ID_MAP = \{([\s\S]*?)\n    \};/, 'LEGACY_ID_MAP');
  return new Function(`return {${body}};`)();
})();

const MODULE_THEMES = {
  'pre-production': { defaultModules: MODULES_PREPROD },
  'prototype': { defaultModules: MODULES_PROTOTYPE },
  'sample-review-recap': { defaultModules: MODULES_RECAP }
};

function makeEnsureApi() {
  const body = extractFnBody(indexHtml, 'function ensureReportModules()', 'ensureReportModules');
  const factory = new Function(
    'D', 'MODULE_THEMES', 'LEGACY_ID_MAP', 'currentActiveModule',
    `function ensureReportModules() {${body}}\nreturn ensureReportModules;`
  );
  return (D) => { factory(D, MODULE_THEMES, LEGACY_ID_MAP, null)(); };
}

const EXPECTED_TESTING_ENTRY = {
  id: 'sec_testing', type: 'testing', name: 'Testing',
  key: 'testingPhotos', notesKey: 'testingNotes', canDelete: true, canDuplicate: true
};

const CURRENT_RECAP_MODULES = [
  { id: 'sec_overall', type: 'overall', name: 'OVERVIEW', canDelete: false, canDuplicate: false },
  { id: 'sec_watchout', type: 'watchout', name: 'Quality Watch Out', key: 'watchoutPhotos', notesKey: 'watchoutNotes', canDelete: false, canDuplicate: true },
  { id: 'sec_checklist', type: 'checklist', name: 'Check List', canDelete: true, canDuplicate: false }
];

// ─────────────────────────────────────────────────────────────────────────────
// TC-RT — Recap gains a Testing tab like Prototype's, deletable (v4.13.0)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-RT.1: the Recap Testing entry mirrors Prototype exactly', () => {
  it('TC-RT.1.1: same declaration as Prototype — deletable, duplicable, not standby', () => {
    const recapEntry = MODULES_RECAP.find(m => m.id === 'sec_testing');
    const protoEntry = MODULES_PROTOTYPE.find(m => m.id === 'sec_testing');
    assert.deepEqual(recapEntry, EXPECTED_TESTING_ENTRY);
    assert.deepEqual(recapEntry, protoEntry);
    assert.equal(recapEntry.standby, undefined);
  });

  it('TC-RT.1.2: Testing sits between Watch Out and Check List (Prototype order)', () => {
    const ids = MODULES_RECAP.map(m => m.id);
    assert.equal(ids.indexOf('sec_testing'), ids.indexOf('sec_watchout') + 1);
    assert.equal(ids.indexOf('sec_checklist'), ids.indexOf('sec_testing') + 1);
  });
});

describe('TC-RT.2: stored Recap reports gain Testing once; a user deletion sticks', () => {
  const ensure = makeEnsureApi();

  it('TC-RT.2.1: a current Recap report (with Check List, no Testing) gains Testing after Watch Out; data untouched', () => {
    const D = {
      moduleType: 'sample-review-recap',
      reportTitle: 'SAMPLE REVIEW RECAP',
      modules: JSON.parse(JSON.stringify(CURRENT_RECAP_MODULES)),
      bvRows: [{ test: 'Load test', result: 'Pass', remark: '' }],
      testingPhotos: [{ img: 'data:image/x', caption: 'Rig' }],
      testingNotes: 'keep me'
    };
    const before = JSON.stringify({ b: D.bvRows, p: D.testingPhotos, n: D.testingNotes });
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_photos', 'sec_watchout', 'sec_testing', 'sec_checklist']);
    assert.deepEqual(D.modules[3], EXPECTED_TESTING_ENTRY);
    assert.equal(D.recapTestingBackfilled, true);
    assert.equal(JSON.stringify({ b: D.bvRows, p: D.testingPhotos, n: D.testingNotes }), before,
      'existing Testing data is preserved verbatim');
  });

  it('TC-RT.2.2: idempotent — repeated opens keep exactly one Testing tab', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(CURRENT_RECAP_MODULES))
    };
    ensure(D); ensure(D); ensure(D);
    assert.equal(D.modules.filter(m => m.type === 'testing').length, 1);
    assert.equal(D.modules.length, 5);
  });

  it('TC-RT.2.3: a deliberately deleted Testing tab is NOT resurrected', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(CURRENT_RECAP_MODULES))
    };
    ensure(D);
    assert.equal(D.modules.length, 5, 'first open backfills');
    D.modules = D.modules.filter(m => m.id !== 'sec_testing'); // user deletes the tab
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_photos', 'sec_watchout', 'sec_checklist']);
  });

  it('TC-RT.2.4: a report that already has Testing just gets the marker — no duplicate', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(MODULES_RECAP))
    };
    ensure(D);
    assert.equal(D.recapTestingBackfilled, true);
    assert.equal(D.modules.filter(m => m.type === 'testing').length, 1);
    assert.equal(D.modules.length, 5);
  });

  it('TC-RT.2.5: the backfill is Recap-scoped — a Prototype list without Testing is left alone', () => {
    const proto = {
      moduleType: 'prototype',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      modules: MODULES_PROTOTYPE.filter(m => m.id !== 'sec_testing').map(m => ({ ...m }))
    };
    const before = proto.modules.map(m => m.id);
    ensure(proto);
    assert.deepEqual(proto.modules.map(m => m.id), before);
    assert.equal(proto.recapTestingBackfilled, undefined);
  });
});

describe('TC-RT.3: editor + PDF wiring for Testing is type-driven (no Recap gate)', () => {
  it('TC-RT.3.1: the PDF exporter has a generic testing branch (BV table + photos)', () => {
    assert.ok(indexHtml.includes("if (modType === 'testing')"), 'PDF dispatches on the testing type');
    assert.ok(indexHtml.includes('validBV'), 'PDF renders the BV rows table for testing sections');
  });

  it('TC-RT.3.2: re-adding a testing module initializes its data fields', () => {
    assert.ok(indexHtml.includes("if (modType === 'testing') {\n        if (!D.bvRows) D.bvRows = [];"),
      'the add-module flow seeds bvRows/testingPhotos for the testing type');
  });

  it('TC-RT.3.3: the Testing section DOM block exists in the editor', () => {
    assert.ok(indexHtml.includes('<div id="sec_testing" class="sec-block"'));
  });
});
