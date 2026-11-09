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

// ─────────────────────────────────────────────────────────────────────────────
// The module-default title set must come from the app's own MODULE_THEMES
// config (the same source isModuleDefaultTitle derives from at runtime).
// Pull every title/pdfTitle value out of the config block and rebuild a stub
// whose configs carry exactly those values, so the suite tracks the real
// config instead of a hand-copied list.
// ─────────────────────────────────────────────────────────────────────────────
const themesBlock = extract(indexHtml, /const MODULE_THEMES = \{([\s\S]*?)\n    \};/, 'MODULE_THEMES');
const configTitleValues = [...themesBlock.matchAll(/(?:pdfTitle|title): '([^']*)'/g)].map(m => m[1]);
const MODULE_THEMES_STUB = {};
configTitleValues.forEach((value, i) => {
  MODULE_THEMES_STUB['stub' + i] = { title: value, pdfTitle: value };
});

function makeNameApi() {
  const isDefaultBody = extractFnBody(indexHtml, 'function isModuleDefaultTitle(title)', 'isModuleDefaultTitle');
  const displayBody = extractFnBody(indexHtml, 'function getReportDisplayName(r)', 'getReportDisplayName');
  const baseBody = extractFnBody(indexHtml, 'function getReportFileBaseName(rep)', 'getReportFileBaseName');
  const factory = new Function(
    'MODULE_THEMES', 'pdfConfig',
    `function isModuleDefaultTitle(title) {${isDefaultBody}}
     function getReportDisplayName(r) {${displayBody}}
     function getReportFileBaseName(rep) {${baseBody}}
     return { isModuleDefaultTitle, getReportDisplayName, getReportFileBaseName };`
  );
  return factory(MODULE_THEMES_STUB, undefined);
}

const api = makeNameApi();

const RECAP_DEFAULT = 'SAMPLE REVIEW RECAP';
const PREPROD_DEFAULT = 'PRE-PRODUCTION SAMPLE REVIEW REPORT';
const PROTOTYPE_DEFAULT = 'PROTOTYPE SAMPLE REVIEW REPORT';

// ─────────────────────────────────────────────────────────────────────────────
// TC-NAME1 — module defaults are recognised from the real config (v4.4.0)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-NAME1: module default titles derive from MODULE_THEMES (v4.4.0)', () => {
  it('TC-NAME1.1: all three module pdfTitles exist in the config and count as defaults', () => {
    for (const t of [RECAP_DEFAULT, PREPROD_DEFAULT, PROTOTYPE_DEFAULT]) {
      assert.ok(configTitleValues.includes(t), `MODULE_THEMES must define pdfTitle "${t}"`);
      assert.equal(api.isModuleDefaultTitle(t), true, `"${t}" must be a module default`);
    }
  });

  it('TC-NAME1.2: the short module title fields count as defaults too; custom/empty do not', () => {
    assert.equal(api.isModuleDefaultTitle('PRE-PRODUCTION'), true);
    assert.equal(api.isModuleDefaultTitle('PROTOTYPE'), true);
    assert.equal(api.isModuleDefaultTitle('Quarterly Audit'), false);
    assert.equal(api.isModuleDefaultTitle(''), false);
    assert.equal(api.isModuleDefaultTitle(null), false);
  });

  it('TC-NAME1.3: matching is trimmed and case-insensitive', () => {
    assert.equal(api.isModuleDefaultTitle('  sample review recap  '), true);
    assert.equal(api.isModuleDefaultTitle('Sample Review Recap'), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-NAME2 — getReportDisplayName: list rows never show the module name
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-NAME2: getReportDisplayName — model · description, never the module name (v4.4.0)', () => {
  it('TC-NAME2.1: module-default title + model + desc → "MD 2741 · Swivel Chair (Skylar)"', () => {
    const name = api.getReportDisplayName({
      reportTitle: RECAP_DEFAULT,
      model: 'MD 2741',
      desc: 'Swivel Chair (Skylar)',
      date: '06-Nov-26',
    });
    assert.equal(name, 'MD 2741 · Swivel Chair (Skylar)');
    assert.ok(!name.includes('RECAP'), 'display name must not contain the module name');
  });

  it('TC-NAME2.2: the Pre-Production and Prototype defaults are dropped the same way', () => {
    assert.equal(
      api.getReportDisplayName({ reportTitle: PREPROD_DEFAULT, model: 'MD 0982', desc: 'Dining Table (Oak)' }),
      'MD 0982 · Dining Table (Oak)'
    );
    assert.equal(
      api.getReportDisplayName({ reportTitle: PROTOTYPE_DEFAULT, model: 'MD 3150', desc: 'Lounge Chair (Dane)' }),
      'MD 3150 · Lounge Chair (Dane)'
    );
  });

  it('TC-NAME2.3: a custom reportTitle is returned alone — model/desc are NOT appended', () => {
    const name = api.getReportDisplayName({
      reportTitle: 'Quarterly Audit — Line 3',
      model: 'MD 2741',
      desc: 'Swivel Chair (Skylar)',
    });
    assert.equal(name, 'Quarterly Audit — Line 3');
  });

  it('TC-NAME2.4: model only / desc only → single part, no stray separators', () => {
    assert.equal(
      api.getReportDisplayName({ reportTitle: RECAP_DEFAULT, model: ' MD 2741 ' }),
      'MD 2741'
    );
    assert.equal(
      api.getReportDisplayName({ reportTitle: RECAP_DEFAULT, desc: 'Swivel Chair (Skylar)' }),
      'Swivel Chair (Skylar)'
    );
  });

  it('TC-NAME2.5: no title/model/desc but a date → the date as stored', () => {
    assert.equal(
      api.getReportDisplayName({ reportTitle: RECAP_DEFAULT, date: '06-Nov-26' }),
      '06-Nov-26'
    );
    assert.equal(api.getReportDisplayName({ date: '02-Nov-26' }), '02-Nov-26');
  });

  it('TC-NAME2.6: a completely empty report → "Untitled report"', () => {
    assert.equal(api.getReportDisplayName({}), 'Untitled report');
    assert.equal(api.getReportDisplayName({ reportTitle: '   ', model: '', desc: '' }), 'Untitled report');
    assert.equal(api.getReportDisplayName(null), 'Untitled report');
    assert.equal(api.getReportDisplayName(undefined), 'Untitled report');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-NAME3 — getReportFileBaseName: export files drop the module name too
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-NAME3: getReportFileBaseName — module default omitted, custom title kept (v4.4.0)', () => {
  it('TC-NAME3.1: module-default title + model + desc + date → base starts with the model', () => {
    const base = api.getReportFileBaseName({
      reportTitle: RECAP_DEFAULT,
      model: 'MD 2741',
      desc: 'Swivel Chair (Skylar)',
      date: '06-Nov-26',
    });
    assert.equal(base, 'MD 2741_Swivel Chair (Skylar)_06-Nov-26');
    assert.ok(!base.startsWith(RECAP_DEFAULT), 'file base must not start with the module name');
    assert.ok(base.includes('MD 2741') && base.includes('06-Nov-26'), 'file base keeps model and date');
  });

  it('TC-NAME3.2: no reportTitle at all → the literal fallback default is omitted too', () => {
    const base = api.getReportFileBaseName({ model: 'MD 9', date: '02-Feb-26' });
    assert.equal(base, 'MD 9_02-Feb-26');
    assert.ok(!base.includes('PRE-PRODUCTION'), 'the fallback default title must not leak into file names');
  });

  it('TC-NAME3.3: a custom title still leads the file base (unchanged behaviour)', () => {
    const base = api.getReportFileBaseName({
      reportTitle: 'Quarterly Audit',
      model: 'MD 1',
      date: '01-Jan-26',
    });
    assert.equal(base, 'Quarterly Audit_MD 1_01-Jan-26');
    assert.ok(base.startsWith('Quarterly Audit'));
  });

  it('TC-NAME3.4: an empty report still falls back to "report"', () => {
    assert.equal(api.getReportFileBaseName({}), 'report');
    assert.equal(api.getReportFileBaseName(null), 'report');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-NAME4 — wiring: the list uses the display name; getReportTitle intact
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-NAME4: wiring — renderHome uses getReportDisplayName; getReportTitle untouched (v4.4.0)', () => {
  it('TC-NAME4.1: the renderHome row builder feeds the row title from getReportDisplayName', () => {
    assert.ok(
      indexHtml.includes('const reportTitle = getReportDisplayName(r);'),
      'renderHome must build the row title via getReportDisplayName(r)'
    );
    assert.ok(
      indexHtml.includes('<span class="rc-title-text" title="${safeTitle}">${safeTitle}</span>'),
      'the row .rc-title-text must keep rendering safeTitle (now the display name)'
    );
  });

  it('TC-NAME4.2: getReportTitle itself is unchanged (duplicate/import checks, toasts, footer)', () => {
    const body = extractFnBody(indexHtml, 'function getReportTitle(r)', 'getReportTitle');
    assert.ok(body.includes("`${r.reportTitle.trim()} - ${parts.join(' ')}`"), 'getReportTitle composition must stay');
    assert.ok(body.includes("'Untitled Report'"), 'getReportTitle fallback must stay');
    assert.ok(
      indexHtml.includes("const title = (getReportTitle(r) || '').toLowerCase();"),
      'the home search filter must keep matching on getReportTitle'
    );
  });

  it('TC-NAME4.3: getReportFileBaseName applies the module-default check to the resolved title', () => {
    const body = extractFnBody(indexHtml, 'function getReportFileBaseName(rep)', 'getReportFileBaseName');
    assert.ok(body.includes('isModuleDefaultTitle(repTitle)'), 'the default check must run on the resolved repTitle');
    assert.ok(body.includes("'PRE-PRODUCTION SAMPLE REVIEW REPORT'"), 'the literal fallback must stay in the chain');
    assert.ok(body.includes("|| 'report'"), 'the "report" fallback must stay');
  });
});
