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
// Same MODULE_THEMES stub approach as the TC-NAME suite: rebuild a config
// carrying the real title/pdfTitle values so isModuleDefaultTitle behaves
// exactly as it does in the app.
// ─────────────────────────────────────────────────────────────────────────────
const themesBlock = extract(indexHtml, /const MODULE_THEMES = \{([\s\S]*?)\n    \};/, 'MODULE_THEMES');
const configTitleValues = [...themesBlock.matchAll(/(?:pdfTitle|title): '([^']*)'/g)].map(m => m[1]);
const MODULE_THEMES_STUB = {};
configTitleValues.forEach((value, i) => {
  MODULE_THEMES_STUB['stub' + i] = { title: value, pdfTitle: value };
});

// The prefix mapping is a hardcoded constant in the app (moduleType keys are
// stable); extract its entries verbatim so the suite tracks the real map.
const prefixMapInner = extract(indexHtml, /const REPORT_FILE_PREFIXES = \{([\s\S]*?)\n    \};/, 'REPORT_FILE_PREFIXES');

function makePrefixApi() {
  const isDefaultBody = extractFnBody(indexHtml, 'function isModuleDefaultTitle(title)', 'isModuleDefaultTitle');
  const prefixBody = extractFnBody(indexHtml, 'function getReportFilePrefix(rep)', 'getReportFilePrefix');
  const baseBody = extractFnBody(indexHtml, 'function getReportFileBaseName(rep)', 'getReportFileBaseName');
  const suggestedBody = extractFnBody(indexHtml, 'function fileSuggestedName(rep)', 'fileSuggestedName');
  const factory = new Function(
    'MODULE_THEMES', 'pdfConfig',
    `const REPORT_FILE_PREFIXES = {${prefixMapInner}};
     function isModuleDefaultTitle(title) {${isDefaultBody}}
     function getReportFilePrefix(rep) {${prefixBody}}
     function getReportFileBaseName(rep) {${baseBody}}
     function fileSuggestedName(rep) {${suggestedBody}}
     return { getReportFilePrefix, getReportFileBaseName, fileSuggestedName };`
  );
  return factory(MODULE_THEMES_STUB, undefined);
}

const api = makePrefixApi();

const RECAP_DEFAULT = 'SAMPLE REVIEW RECAP';
const PREPROD_DEFAULT = 'PRE-PRODUCTION SAMPLE REVIEW REPORT';
const PROTOTYPE_DEFAULT = 'PROTOTYPE SAMPLE REVIEW REPORT';

// ─────────────────────────────────────────────────────────────────────────────
// TC-PFX1 — getReportFilePrefix: moduleType decides first (v4.4.1)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-PFX1: getReportFilePrefix — prefix from moduleType (v4.4.1)', () => {
  it('TC-PFX1.1: each of the three moduleType values maps to its prefix', () => {
    assert.equal(api.getReportFilePrefix({ moduleType: 'pre-production' }), 'PPSR');
    assert.equal(api.getReportFilePrefix({ moduleType: 'prototype' }), 'PSR');
    assert.equal(api.getReportFilePrefix({ moduleType: 'sample-review-recap' }), 'SRR');
  });

  it('TC-PFX1.2: a known moduleType wins over a contradictory reportTitle', () => {
    assert.equal(
      api.getReportFilePrefix({ moduleType: 'prototype', reportTitle: RECAP_DEFAULT }),
      'PSR'
    );
    assert.equal(
      api.getReportFilePrefix({ moduleType: 'sample-review-recap', reportTitle: PROTOTYPE_DEFAULT }),
      'SRR'
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PFX2 — legacy reports without moduleType: infer from reportTitle
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-PFX2: getReportFilePrefix — legacy inference from reportTitle (v4.4.1)', () => {
  it('TC-PFX2.1: the three module default titles infer their prefixes', () => {
    assert.equal(api.getReportFilePrefix({ reportTitle: RECAP_DEFAULT }), 'SRR');
    assert.equal(api.getReportFilePrefix({ reportTitle: PROTOTYPE_DEFAULT }), 'PSR');
    assert.equal(api.getReportFilePrefix({ reportTitle: PREPROD_DEFAULT }), 'PPSR');
    assert.equal(api.getReportFilePrefix({ reportTitle: 'Sample Review Recap' }), 'SRR');
  });

  it('TC-PFX2.2: unknown module and no usable title → empty prefix (never guess)', () => {
    assert.equal(api.getReportFilePrefix({ moduleType: 'mass-production' }), '');
    assert.equal(api.getReportFilePrefix({ reportTitle: 'Quarterly Audit — Line 3' }), '');
    assert.equal(api.getReportFilePrefix({}), '');
    assert.equal(api.getReportFilePrefix(null), '');
    assert.equal(api.getReportFilePrefix(undefined), '');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PFX3 — getReportFileBaseName: prefix leads the exported file name
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-PFX3: getReportFileBaseName — prefix first, module name gone, space-joined (v4.4.1)', () => {
  it('TC-PFX3.1: a Recap report → "SRR MD 2741 Swivel Chair (Skylar) 06-Nov-26"', () => {
    const base = api.getReportFileBaseName({
      moduleType: 'sample-review-recap',
      reportTitle: RECAP_DEFAULT,
      model: 'MD 2741',
      desc: 'Swivel Chair (Skylar)',
      date: '06-Nov-26',
    });
    assert.equal(base, 'SRR MD 2741 Swivel Chair (Skylar) 06-Nov-26');
    assert.ok(base.startsWith('SRR '), 'file base must open with the module prefix');
    assert.ok(base.includes('MD 2741') && base.includes('06-Nov-26'), 'file base keeps model and date');
    assert.ok(!base.includes(RECAP_DEFAULT), 'the full module name must not reappear');
    assert.ok(!base.includes('_'), 'file base must contain no underscores');
  });

  it('TC-PFX3.2: a Pre-Production report → base starts with "PPSR "', () => {
    const base = api.getReportFileBaseName({
      moduleType: 'pre-production',
      reportTitle: PREPROD_DEFAULT,
      model: 'MD 0982',
      desc: 'Dining Table (Oak)',
      date: '05-Nov-26',
    });
    assert.equal(base, 'PPSR MD 0982 Dining Table (Oak) 05-Nov-26');
    assert.ok(base.startsWith('PPSR '));
    assert.ok(!base.includes('_'), 'file base must contain no underscores');
  });

  it('TC-PFX3.3: legacy inference flows into the file base too (no moduleType)', () => {
    const base = api.getReportFileBaseName({
      reportTitle: PROTOTYPE_DEFAULT,
      model: 'MD 3150',
      date: '06-Nov-26',
    });
    assert.equal(base, 'PSR MD 3150 06-Nov-26');
    assert.ok(!base.includes('_'), 'file base must contain no underscores');
  });

  it('TC-PFX3.4: only a date and an unknown module → no prefix, just the date', () => {
    assert.equal(api.getReportFileBaseName({ date: '06-Nov-26' }), '06-Nov-26');
    assert.equal(api.getReportFileBaseName({}), 'report');
  });

  it('TC-PFX3.5: a custom title is still kept — after the prefix', () => {
    const base = api.getReportFileBaseName({
      moduleType: 'prototype',
      reportTitle: 'Quarterly Audit',
      model: 'MD 1',
      date: '01-Jan-26',
    });
    assert.equal(base, 'PSR Quarterly Audit MD 1 01-Jan-26');
    assert.ok(!base.includes('_'), 'file base must contain no underscores');
  });

  it('TC-PFX3.6: underscores inside the data itself are sanitised to spaces', () => {
    const base = api.getReportFileBaseName({
      moduleType: 'prototype',
      model: 'MD_3150',
      desc: 'Lounge_Chair (Dane)',
      date: '06-Nov-26',
    });
    assert.equal(base, 'PSR MD 3150 Lounge Chair (Dane) 06-Nov-26');
    assert.ok(!base.includes('_'), 'no underscore may survive sanitisation');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PFX4 — wiring: every exported file name is prefix-led; the list is not
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-PFX4: wiring — JSON export + archive name use the prefix; display name does not (v4.4.1)', () => {
  it('TC-PFX4.1: downloadReportJson builds its file name from getReportFilePrefix, space-joined', () => {
    const body = extractFnBody(indexHtml, 'function downloadReportJson(rep)', 'downloadReportJson');
    assert.ok(body.includes('getReportFilePrefix(rep)'), 'downloadReportJson must resolve the module prefix');
    assert.ok(body.includes("join(' ')"), 'the JSON file name parts must join with a single space');
    assert.ok(body.includes("prefix ? prefix + ' ' : ''"), 'a known prefix leads with a space; an unknown module gets NO leading token');
    assert.ok(!body.includes('PP_'), "the legacy 'PP_' prefix must be gone entirely");
    assert.ok(!body.includes("join('_')"), 'no underscore join may remain in the JSON file name');
  });

  it('TC-PFX4.2: fileSuggestedName (archive/save copy) is prefix-led too', () => {
    const body = extractFnBody(indexHtml, 'function fileSuggestedName(rep)', 'fileSuggestedName');
    assert.ok(body.includes('getReportFilePrefix(rep)'), 'fileSuggestedName must resolve the module prefix');
    assert.ok(body.includes('getReportFileBaseName(rep)'), 'the fallback to getReportFileBaseName must stay');
  });

  it('TC-PFX4.3: fileSuggestedName produces the prefixed, space-joined .json name', () => {
    assert.equal(
      api.fileSuggestedName({ moduleType: 'sample-review-recap', model: 'MD 2741', desc: 'Swivel Chair (Skylar)' }),
      'SRR MD 2741 Swivel Chair (Skylar).json'
    );
    assert.equal(
      api.fileSuggestedName({ reportTitle: 'Quarterly Audit', model: 'MD 1' }),
      'MD 1.json',
      'an unknown module gets no leading token'
    );
    const empty = api.fileSuggestedName({});
    assert.equal(empty, 'report.json');
    assert.ok(!empty.includes('_') && !api.fileSuggestedName({ moduleType: 'prototype', model: 'MD_9' }).includes('_'),
      'archive file names must contain no underscores');
  });

  it('TC-PFX4.4: getReportDisplayName stays prefix-free (rows live inside a module workspace)', () => {
    const body = extractFnBody(indexHtml, 'function getReportDisplayName(r)', 'getReportDisplayName');
    assert.ok(!body.includes('getReportFilePrefix'), 'the list display name must not gain a module prefix');
    assert.ok(!body.includes('REPORT_FILE_PREFIXES'), 'the list display name must not consult the prefix map');
  });
});
