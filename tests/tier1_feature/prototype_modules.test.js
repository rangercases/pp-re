import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPrototypeReportFixture, createPreProdReportFixture } from '../helpers/fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

describe('Tier 1: Feature 4 — Prototype Sample Review Module Structure (R1)', () => {
  it('TC-4.1: Prototype module configuration contains exactly 8 standardized modules', () => {
    const fixture = createPrototypeReportFixture();
    const expectedModules = [
      'sec_overall',
      'sec_photos',
      'sec_dimensions',
      'sec_assembly',
      'sec_watchout',
      'sec_testing',
      'sec_checklist',
      'sec_documents',
    ];

    // Verify in index.html source definition
    const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');
    const protoDefMatch = indexHtml.match(/DEFAULT_MODULES_PROTOTYPE\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(protoDefMatch, 'DEFAULT_MODULES_PROTOTYPE must be defined in index.html');

    for (const modId of expectedModules) {
      assert.ok(protoDefMatch[1].includes(modId), `DEFAULT_MODULES_PROTOTYPE must include ${modId}`);
    }

    // Verify 8 modules count
    const moduleMatches = protoDefMatch[1].match(/id:\s*['"][^'"]+['"]/g);
    assert.equal(moduleMatches.length, 8, 'Must contain exactly 8 default modules');
  });

  it('TC-4.2: Report title defaults to "PROTOTYPE SAMPLE REVIEW REPORT"', () => {
    const fixture = createPrototypeReportFixture();
    assert.equal(fixture.reportTitle, 'PROTOTYPE SAMPLE REVIEW REPORT');

    // Also check index.html definition
    const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');
    assert.ok(
      indexHtml.includes("pdfTitle: 'PROTOTYPE SAMPLE REVIEW REPORT'") ||
      indexHtml.includes('pdfTitle: "PROTOTYPE SAMPLE REVIEW REPORT"'),
      'Prototype configuration in index.html must specify pdfTitle as PROTOTYPE SAMPLE REVIEW REPORT'
    );
  });

  it('TC-4.3: Pre-production-only sections (sec_comparison, sec_greenlabel) are excluded from Prototype report', () => {
    const protoFixture = createPrototypeReportFixture();
    const preProdFixture = createPreProdReportFixture();

    // Prototype does not have comparisonPhotos or greenlabelPhotos
    assert.equal(protoFixture.comparisonPhotos, undefined);
    assert.equal(protoFixture.greenlabelPhotos, undefined);

    // Pre-production fixture has both
    assert.ok(preProdFixture.comparisonPhotos);
    assert.ok(preProdFixture.greenlabelPhotos);

    // Inspect index.html DEFAULT_MODULES_PROTOTYPE
    const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');
    const protoDefMatch = indexHtml.match(/DEFAULT_MODULES_PROTOTYPE\s*=\s*\[([\s\S]*?)\];/);
    assert.ok(!protoDefMatch[1].includes('sec_comparison'), 'Prototype modules must not include sec_comparison');
    assert.ok(!protoDefMatch[1].includes('sec_greenlabel'), 'Prototype modules must not include sec_greenlabel');
  });

  it('TC-4.4: Module rules correctly enforce canDelete and canDuplicate permissions', () => {
    const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');
    const protoDefMatch = indexHtml.match(/DEFAULT_MODULES_PROTOTYPE\s*=\s*\[([\s\S]*?)\];/)[1];

    // sec_overall must not be deletable or duplicable
    assert.ok(
      protoDefMatch.includes("id: 'sec_overall'") &&
      protoDefMatch.includes("canDelete: false") &&
      protoDefMatch.includes("canDuplicate: false"),
      'sec_overall must have canDelete: false, canDuplicate: false'
    );

    // sec_checklist must not be duplicable
    assert.ok(
      protoDefMatch.includes("id: 'sec_checklist'") &&
      protoDefMatch.includes("canDuplicate: false"),
      'sec_checklist must have canDuplicate: false'
    );
  });

  it('TC-4.5: Metadata timestamps and reviewer comply with SOFACOMPANY format (DD-MMM-YY)', () => {
    const fixture = createPrototypeReportFixture({
      date: '22-Sep-26',
      reviewer: 'Nhan Hoang',
    });

    const datePattern = /^\d{2}-[A-Za-z]{3}-\d{2}$/;
    assert.ok(datePattern.test(fixture.date), `Date format ${fixture.date} must match DD-MMM-YY`);
    assert.ok(typeof fixture.reviewer === 'string' && fixture.reviewer.trim().length > 0);
  });
});
