// TC-R14 — Cover-fill for PDF grid cards (Hung, 2026-11-26, chose
// option A after 'UI tệ quá' on the 2x3 export): photos fill their
// frames completely — centred crop to the box ratio, no white bands,
// no floating inside oversized frames. Originals in the app are never
// touched; the crop exists only as a per-export variant. Row cards
// only: full-width cards, covers, dimensions and checklist images keep
// the contain behaviour. A photo that cannot be decoded falls back to
// contain for that photo alone.
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


const cropBody = extractFnBody(indexHtml, 'function coverCropRect(imgW, imgH, boxRatio)', 'coverCropRect');
const coverCropRect = new Function(`return (function coverCropRect(imgW, imgH, boxRatio) {${cropBody}});`)();

describe('TC-R14: cover-fill grid photos', () => {
  it('TC-R14.1: a wide photo into a squarer box crops the sides, centred', () => {
    const r = coverCropRect(1600, 900, 1.0); // ratio 1.78 into 1.0 box
    assert.deepEqual(r, { sx: 350, sy: 0, sw: 900, sh: 900 });
  });

  it('TC-R14.2: a tall photo into a wide box crops top and bottom, centred', () => {
    const r = coverCropRect(900, 1600, 88 / 46); // into a packed row box
    assert.equal(r.sx, 0);
    assert.equal(r.sw, 900);
    assert.ok(Math.abs(r.sh - 900 / (88 / 46)) < 0.001);
    assert.ok(Math.abs(r.sy - (1600 - r.sh) / 2) < 0.001, 'crop is vertically centred');
  });

  it('TC-R14.3: an exact-ratio photo keeps the full frame; bad input returns null', () => {
    assert.deepEqual(coverCropRect(880, 460, 88 / 46), { sx: 0, sy: 0, sw: 880, sh: 460 });
    assert.equal(coverCropRect(0, 100, 1), null);
    assert.equal(coverCropRect(100, 100, 0), null);
  });

  it('TC-R14.4: wiring — cover flows from the grid row loop to addImg only', () => {
    assert.ok(indexHtml.includes('async function preparePdfDecodedImages(report, pdfImageMap)'),
      'grid photos are pre-decoded per export');
    assert.ok(indexHtml.includes('const coverVariantFor = (imgSrc, boxRatio) => {'),
      'cropped variants are built and cached in the export scope');
    assert.ok(indexHtml.includes('if (opts && opts.cover) {') && indexHtml.includes('const cropped = coverVariantFor(imgSrc, iw / ih);'),
      'addImg cover-fills only when asked');
    assert.ok(indexHtml.includes('if (opts && opts.cover) imgOpts.cover = true;'),
      'renderCard forwards the cover flag');
    assert.ok(indexHtml.includes('showActions ? { cover: true, bottomAlign: true } : { cover: true }'),
      'grid row cards request cover-fill');
    assert.ok(indexHtml.includes('renderCard(p0, px0, py, fullW, rowCardH, showActions ? { topAlign: true } : undefined)'),
      'full-width cards keep contain (no cover flag)');
    assert.ok(indexHtml.includes('estContentH(q, gw, rowMaxCardH, true)'),
      'row height estimates know cover fills the box');
  });
});
