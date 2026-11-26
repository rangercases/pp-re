// TC-R12 — PDF photo grids: rows are built from an array of up to
// GRID_COLS normal cards. v4.13.11 first set GRID_COLS=3 (Hung: 'tôi
// muốn 3 ảnh 1 hàng' on the Enzo export); v4.13.12 superseded it the
// same morning with Hung's correction '2 cột 3 hàng' — GRID_COLS back
// to 2 (88mm cards), and sections with >4 photos pack their card
// heights so 3 ROWS fit one page (see TC-R13). The array row builder
// and the R-06 shared-row-height behaviour stay. Full-width cards
// still take their own row. Applies to every section rendered through
// renderPhotoGrid (Watch Out, Testing, Assembly, photo sections).
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

describe('TC-R12: array-built rows in PDF photo grids', () => {
  it('TC-R12.1: the grid is 2 columns of 88mm (v4.13.12 correction)', () => {
    assert.ok(gridBody.includes('const GRID_COLS = 2;'), 'column count is 2');
    assert.ok(gridBody.includes('const gw = (fullW - gapX * (GRID_COLS - 1)) / GRID_COLS;'),
      'card width derives from the column count');
    const gw = (182 - 6 * (2 - 1)) / 2;
    assert.equal(gw, 88, 'cards are 88mm wide on A4 (182mm printable)');
  });

  it('TC-R12.2: a row collects up to GRID_COLS normal cards and stops before a full-width one', () => {
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
