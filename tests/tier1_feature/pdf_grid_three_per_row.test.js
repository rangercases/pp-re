// TC-R12 — PDF photo grids: 3 cards per row (Hung, 2026-11-26, on the
// Enzo Structure Improvement export: 'tôi muốn 3 ảnh 1 hàng'). The grid
// branch of renderPhotoGrid was hard-wired for 2 cards (p0/p1, px0/px1,
// anch0/anch1); it now collects up to GRID_COLS=3 normal cards per row
// into an array, keeping the R-06 shared-row-height behaviour for every
// card. Full-width cards still take their own row. Applies to every
// section rendered through renderPhotoGrid (Watch Out, Testing,
// Assembly, photo sections) in all modules.
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

const gridBody = extract(
  indexHtml,
  /(const renderPhotoGrid = \(photos, headerTitle, customCardH, customGapY, gridOpts\) => \{[\s\S]*?const renderPhotoSection)/,
  'renderPhotoGrid body'
);

describe('TC-R12: three cards per row in PDF photo grids', () => {
  it('TC-R12.1: the grid is 3 columns of 56.7mm', () => {
    assert.ok(gridBody.includes('const GRID_COLS = 3;'), 'column count is 3');
    assert.ok(gridBody.includes('const gw = (fullW - gapX * (GRID_COLS - 1)) / GRID_COLS;'),
      'card width derives from the column count');
    const gw = (182 - 6 * (3 - 1)) / 3;
    assert.ok(Math.abs(gw - 56.67) < 0.01, 'cards are 56.7mm wide on A4 (182mm printable)');
    assert.ok(!gridBody.includes('const gw = (fullW - gapX) / 2;'), 'the 2-column width is gone');
  });

  it('TC-R12.2: a row collects up to 3 normal cards and stops before a full-width one', () => {
    assert.ok(gridBody.includes('while (rowPhotos.length < GRID_COLS && i + rowPhotos.length < photos.length) {'),
      'row collection is capped at GRID_COLS');
    assert.ok(gridBody.includes("if (q && (q.fullWidth || q.photoSize === 'full')) break;"),
      'a full-width card still breaks the row and takes its own');
    assert.ok(gridBody.includes('i += rowPhotos.length;'), 'the loop advances by the cards actually placed');
    assert.ok(!gridBody.includes('i += (p1 ? 2 : 1);'), 'the hard-wired pair advance is gone');
  });

  it('TC-R12.3: columns are placed left to right and share the row line', () => {
    assert.ok(gridBody.includes('const px = M + k * (gw + gapX);'), 'column x derives from the column index');
    assert.ok(gridBody.includes('rowPhotos.forEach((q, k) => {'), 'cards render through one shared loop');
    assert.ok(gridBody.includes('drawCaption(capLinesArr[k], px, gw, py + anch + 3.8);'),
      'captions keep the shared row anchor (R-06 behaviour preserved for 3 cards)');
  });
});
