// TC-RPP — Recap gains a Product Photos module before Watch Out (v4.13.4,
// Hung, 2026-11-23). Same declaration as Prototype / Pre-Production
// (type 'photos', key prodPhotos, deletable); stored Recap reports are
// backfilled ONCE in ensureReportModules (flag recapPhotosBackfilled) —
// a user-deleted module never regrows.
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
  return new Function(`return ({${body}});`)();
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

const EXPECTED_PHOTOS_ENTRY = {
  id: 'sec_photos', type: 'photos', name: 'Product Photos',
  key: 'prodPhotos', canDelete: true, canDuplicate: true
};

// A stored Recap report from the v4.13.0 era (Testing present, no Product Photos).
const STORED_RECAP_MODULES = [
  { id: 'sec_overall', type: 'overall', name: 'OVERVIEW', canDelete: false, canDuplicate: false },
  { id: 'sec_watchout', type: 'watchout', name: 'Quality Watch Out', key: 'watchoutPhotos', notesKey: 'watchoutNotes', canDelete: false, canDuplicate: true },
  { id: 'sec_testing', type: 'testing', name: 'Testing', key: 'testingPhotos', notesKey: 'testingNotes', canDelete: true, canDuplicate: true },
  { id: 'sec_checklist', type: 'checklist', name: 'Check List', canDelete: true, canDuplicate: false }
];

describe('TC-RPP.1: the Recap Product Photos entry mirrors the other modules', () => {
  it('TC-RPP.1.1: same declaration as Prototype and Pre-Production — deletable, duplicable', () => {
    const recapEntry = MODULES_RECAP.find(m => m.id === 'sec_photos');
    assert.deepEqual(recapEntry, EXPECTED_PHOTOS_ENTRY);
    assert.deepEqual(recapEntry, MODULES_PROTOTYPE.find(m => m.id === 'sec_photos'));
    assert.deepEqual(recapEntry, MODULES_PREPROD.find(m => m.id === 'sec_photos'));
  });

  it('TC-RPP.1.2: Product Photos sits after Overview, immediately before Watch Out', () => {
    const ids = MODULES_RECAP.map(m => m.id);
    assert.deepEqual(ids, ['sec_overall', 'sec_photos', 'sec_watchout', 'sec_testing', 'sec_checklist']);
  });

  it('TC-RPP.1.3: a fresh Recap report seeds all 5 modules including Product Photos', () => {
    const ensure = makeEnsureApi();
    const D = { moduleType: 'sample-review-recap', reportTitle: 'SAMPLE REVIEW RECAP', modules: null };
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_photos', 'sec_watchout', 'sec_testing', 'sec_checklist']);
    assert.deepEqual(D.modules[1], EXPECTED_PHOTOS_ENTRY);
  });
});

describe('TC-RPP.2: stored Recap reports gain Product Photos once, before Watch Out', () => {
  const ensure = makeEnsureApi();

  it('TC-RPP.2.1: backfill inserts the module before Watch Out; photos data untouched', () => {
    const D = {
      moduleType: 'sample-review-recap',
      modules: JSON.parse(JSON.stringify(STORED_RECAP_MODULES)),
      prodPhotos: [{ img: 'data:image/x', caption: 'Front' }]
    };
    const before = JSON.stringify(D.prodPhotos);
    ensure(D);
    assert.deepEqual(D.modules.map(m => m.id), ['sec_overall', 'sec_photos', 'sec_watchout', 'sec_testing', 'sec_checklist']);
    assert.deepEqual(D.modules[1], EXPECTED_PHOTOS_ENTRY);
    assert.equal(D.recapPhotosBackfilled, true);
    assert.equal(JSON.stringify(D.prodPhotos), before, 'existing prodPhotos data is preserved verbatim');
  });

  it('TC-RPP.2.2: idempotent — repeated opens keep exactly one Product Photos module', () => {
    const D = { moduleType: 'sample-review-recap', modules: JSON.parse(JSON.stringify(STORED_RECAP_MODULES)) };
    ensure(D); ensure(D); ensure(D);
    assert.equal(D.modules.filter(m => m.type === 'photos').length, 1);
  });

  it('TC-RPP.2.3: a user deletion sticks — the module never regrows', () => {
    const D = { moduleType: 'sample-review-recap', modules: JSON.parse(JSON.stringify(STORED_RECAP_MODULES)) };
    ensure(D);
    D.modules = D.modules.filter(m => m.id !== 'sec_photos');
    ensure(D); ensure(D);
    assert.equal(D.modules.some(m => m.id === 'sec_photos'), false);
    assert.equal(D.recapPhotosBackfilled, true);
  });

  it('TC-RPP.2.4: a report that already has Product Photos (added manually) is not duplicated', () => {
    const mods = JSON.parse(JSON.stringify(STORED_RECAP_MODULES));
    mods.splice(1, 0, JSON.parse(JSON.stringify(EXPECTED_PHOTOS_ENTRY)));
    const D = { moduleType: 'sample-review-recap', modules: mods };
    ensure(D);
    assert.equal(D.modules.filter(m => m.type === 'photos').length, 1);
    assert.equal(D.recapPhotosBackfilled, true);
  });

  it('TC-RPP.2.5: Prototype and Pre-Production reports are untouched by the Recap backfill', () => {
    const proto = { moduleType: 'prototype', modules: [{ id: 'sec_overall', type: 'overall' }] };
    ensure(proto);
    assert.equal(proto.recapPhotosBackfilled, undefined);
    assert.equal(proto.modules.length, 1);
  });
});
