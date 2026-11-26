// TC-R08 — Export file names: no module-name duplication (Hung, 2026-11-26).
// His Recap export came out as 'SRR Sample Review Report- Structure
// Improvement MD 1801 Chair (Enzo) 25-Nov-26 (1)': the custom title itself
// started with the module's long name, and the old default-title check only
// matched whole titles against title/pdfTitle — the hub tagline 'Sample
// Review Report' was not even in the checked set, and a suffixed title
// could never match. Fix: strip a leading module long name (pdfTitle or
// hub tagline, own module first) when a separator follows; treat the
// tagline as a default title; JSON download shares the PDF base name;
// full-backup name drops its underscores.
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
  return match[1];
}

function extractFnBody(source, signature, label) {
  const pattern = new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([\\s\\S]*?)\\n    \\}');
  return extract(source, pattern, label);
}

// Real-shaped MODULE_THEMES stub: title/pdfTitle values are read from the
// real themes block; every module's hub tagline is 'Sample Review Report'
// (verified in the source), attached here so the tagline paths are live.
const themesBlock = extract(indexHtml, /const MODULE_THEMES = \{([\s\S]*?)\n    \};/, 'MODULE_THEMES');
const titleValues = [...themesBlock.matchAll(/(?:pdfTitle|title): '([^']*)'/g)].map(m => m[1]);
const MODULE_THEMES_STUB = {};
titleValues.forEach((value, i) => {
  MODULE_THEMES_STUB['stub' + i] = { title: value, pdfTitle: value, hub: { tagline: 'Sample Review Report' } };
});
// getReportFileBaseName resolves the report's OWN module config by
// moduleType — point the real keys at entries carrying the real pdfTitles.
const recapPdf = titleValues.find(v => v === 'SAMPLE REVIEW RECAP');
const protoPdf = titleValues.find(v => v === 'PROTOTYPE SAMPLE REVIEW REPORT');
const preprodPdf = titleValues.find(v => v === 'PRE-PRODUCTION SAMPLE REVIEW REPORT');
MODULE_THEMES_STUB['sample-review-recap'] = { title: 'Recap', pdfTitle: recapPdf, hub: { tagline: 'Sample Review Report' } };
MODULE_THEMES_STUB['prototype'] = { title: 'Prototype', pdfTitle: protoPdf, hub: { tagline: 'Sample Review Report' } };
MODULE_THEMES_STUB['pre-production'] = { title: 'Pre-Production', pdfTitle: preprodPdf, hub: { tagline: 'Sample Review Report' } };

const prefixMapInner = extract(indexHtml, /const REPORT_FILE_PREFIXES = \{([\s\S]*?)\n    \};/, 'REPORT_FILE_PREFIXES');
const isDefaultBody = extractFnBody(indexHtml, 'function isModuleDefaultTitle(title)', 'isModuleDefaultTitle');
const stripBody = extractFnBody(indexHtml, 'function stripModuleTitleLead(title, rep)', 'stripModuleTitleLead');
const prefixBody = extractFnBody(indexHtml, 'function getReportFilePrefix(rep)', 'getReportFilePrefix');
const baseBody = extractFnBody(indexHtml, 'function getReportFileBaseName(rep)', 'getReportFileBaseName');
const api = new Function(
  'MODULE_THEMES', 'pdfConfig',
  `const REPORT_FILE_PREFIXES = {${prefixMapInner}};
   function isModuleDefaultTitle(title) {${isDefaultBody}}
   function stripModuleTitleLead(title, rep) {${stripBody}}
   function getReportFilePrefix(rep) {${prefixBody}}
   function getReportFileBaseName(rep) {${baseBody}}
   return { getReportFileBaseName, stripModuleTitleLead };`
)(MODULE_THEMES_STUB, undefined);

const ENZO = { model: 'MD 1801', desc: 'Chair (Enzo)', date: '25-Nov-26' };

describe('TC-R08: export file names carry no duplicated module name', () => {
  it("TC-R08.1: Hung's case — 'Sample Review Report- Structure Improvement' loses its lead", () => {
    const base = api.getReportFileBaseName({ moduleType: 'sample-review-recap', reportTitle: 'Sample Review Report- Structure Improvement', ...ENZO });
    assert.equal(base, 'SRR Structure Improvement MD 1801 Chair (Enzo) 25-Nov-26');
    assert.ok(!base.includes('Sample Review Report'), 'the long module name must not survive next to SRR');
  });

  it('TC-R08.2: a title that is exactly the tagline is a default title and drops out', () => {
    const base = api.getReportFileBaseName({ moduleType: 'sample-review-recap', reportTitle: 'Sample Review Report', ...ENZO });
    assert.equal(base, 'SRR MD 1801 Chair (Enzo) 25-Nov-26');
  });

  it('TC-R08.3: pdfTitle lead with a colon separator is stripped too', () => {
    const base = api.getReportFileBaseName({ moduleType: 'sample-review-recap', reportTitle: 'Sample Review Recap: Q3 Check', ...ENZO });
    assert.equal(base, 'SRR Q3 Check MD 1801 Chair (Enzo) 25-Nov-26');
  });

  it('TC-R08.4: no separator after the module name — the title is kept whole', () => {
    const base = api.getReportFileBaseName({ moduleType: 'sample-review-recap', reportTitle: 'Sample Review Report Structure Notes', ...ENZO });
    assert.equal(base, 'SRR Sample Review Report Structure Notes MD 1801 Chair (Enzo) 25-Nov-26');
  });

  it("TC-R08.5: another module's pdfTitle is not stripped from this module's title", () => {
    const base = api.getReportFileBaseName({ moduleType: 'sample-review-recap', reportTitle: 'Prototype Sample Review Report- Comparison', ...ENZO });
    assert.equal(base, 'SRR Prototype Sample Review Report- Comparison MD 1801 Chair (Enzo) 25-Nov-26');
  });

  it('TC-R08.6: an unrelated custom title is untouched', () => {
    const base = api.getReportFileBaseName({ moduleType: 'prototype', reportTitle: 'Quarterly Audit', model: 'MD 1', date: '01-Jan-26' });
    assert.equal(base, 'PSR Quarterly Audit MD 1 01-Jan-26');
  });

  it('TC-R08.7: legacy report without moduleType still gets the strip (all-names fallback)', () => {
    const out = api.stripModuleTitleLead('Sample Review Report- Structure Improvement', {});
    assert.equal(out, 'Structure Improvement');
  });

  it('TC-R08.8: the full-backup file name uses spaces, no underscores', () => {
    assert.ok(indexHtml.includes('a.download = `PP Review Backup FullDB ${dateStr}.json`;'), 'backup name follows the space-joined convention');
    assert.ok(!indexHtml.includes('PP_Review_Backup_FullDB'), 'the old underscored backup name is gone');
  });
});
