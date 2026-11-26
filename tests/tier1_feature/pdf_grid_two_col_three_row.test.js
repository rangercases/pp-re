// TC-R13 — '2 cột 3 hàng' (Hung, 2026-11-26, correcting the same
// morning's '3 ảnh 1 hàng'): PDF photo grids stay 2 columns (88mm
// cards), and when a section has MORE than 4 photos the card height is
// capped at 46mm and the row gap tightens to 4.5mm, so 3 rows fit one
// A4 page body (32..276mm = 244mm) — the same trick the Testing
// section already used (isThreeRows). Sections with <=4 photos keep
// the roomier sizing; callers passing customCardH (Testing) are
// untouched. Budget: worst typical row = 46 card + ~21 caption/chip +
// 4.5 gap = 71.5mm; 3 rows = 214.5mm < 244mm.
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

describe('TC-R13: two columns, three rows per page', () => {
  it('TC-R13.1: packing engages only for >4 photos and no custom card height', () => {
    assert.ok(gridBody.includes('const packThreeRows = !customCardH && photos.length > 4;'),
      'packing condition mirrors the Testing isThreeRows idiom');
    assert.ok(gridBody.includes('const gapY = customGapY !== undefined ? customGapY : (packThreeRows ? 4.5 : 6.5);'),
      'row gap tightens only when packing');
  });

  it('TC-R13.2: packed card heights clamp to [36, 46]; unpacked keep [40, 60]', () => {
    assert.ok(gridBody.includes('} else if (packThreeRows) {'), 'estimateCardH has a packing branch');
    assert.ok(gridBody.includes('if (h > 46) h = 46;') && gridBody.includes('if (h < 36) h = 36;'),
      'packed clamp is [36, 46]');
    assert.ok(gridBody.includes('if (h > 60) h = 60;') && gridBody.includes('if (h < 40) h = 40;'),
      'unpacked clamp stays [40, 60]');
  });

  it('TC-R13.3: the height budget fits 3 rows in the A4 page body', () => {
    const pageBody = 276 - 32; // BOTTOM_LIMIT - header content start
    const worstRow = 46 + 21 + 4.5; // card + 3-line caption & chip + gap
    assert.ok(3 * worstRow <= pageBody, `3 packed rows (${3 * worstRow}mm) fit the ${pageBody}mm page body`);
    const unpackedRow = 60 + 21 + 6.5;
    assert.ok(3 * unpackedRow > pageBody, 'the old sizing could never fit 3 rows — the cap is what buys the third row');
  });
});
