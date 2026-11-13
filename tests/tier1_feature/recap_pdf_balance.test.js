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

// ─────────────────────────────────────────────────────────────────────────────
// TC-BAL — v4.1.4 full-page balance pass for the Recap PDF:
//  1. addImg gains an opt-in alignTop; default (centered) behavior unchanged.
//  2. Recap Overview covers top-align at all 7 cover call sites.
//  3. One 6.5mm spacing rhythm on the Recap flow, gated on isRecap.
//  4. Recap Watch Out grid: rows top-align, captions/chips hug each image.
//  5. QUALITY SUMMARY rows: bulleted main watch-outs, equal padding
//     (TC-BAL6; no table header / numbering since v4.6.4).
// ─────────────────────────────────────────────────────────────────────────────

// ─── TC-BAL1: addImg contain math — centered by default, top-aligned on opt-in
const addImgBody = extract(
  indexHtml,
  /const addImg = \(src, x, iy, iw, ih, opts\) => \{([\s\S]*?)\n      \};/,
  'addImg helper (with opts)'
);

function makeAddImg(getProps) {
  const calls = [];
  const doc = {
    getImageProperties: (src) => getProps(src),
    addImage: (...a) => calls.push(['addImage', ...a])
  };
  const fn = new Function(
    'doc', 'pdfImageMap', 'pdfFailedImages',
    `return ((src, x, iy, iw, ih, opts) => {${addImgBody}\n  });`
  )(doc, null, []);
  return { fn, calls };
}

describe('TC-BAL1: addImg — default centering unchanged, opt-in top-align', () => {
  it('TC-BAL1.1: without opts a wide image is still vertically CENTERED', () => {
    const { fn, calls } = makeAddImg(() => ({ width: 2000, height: 1000 })); // ratio 2
    const b = fn('data:image/png;base64,xx', 14, 100, 89, 80);
    // renderH = 89 / 2 = 44.5; offsetY = (80 - 44.5) / 2 = 17.75
    assert.deepEqual(b, { x: 14, y: 117.75, w: 89, h: 44.5 });
    assert.equal(calls[0][4], 117.75, 'addImage must be called at the centered y');
  });

  it('TC-BAL1.2: with { alignTop: true } bounds.y == iy and bounds.h == fitted height', () => {
    const { fn, calls } = makeAddImg(() => ({ width: 2000, height: 1000 }));
    const b = fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignTop: true });
    assert.equal(b.y, 100, 'top-aligned image starts exactly at the row top');
    assert.equal(b.h, 44.5, 'height is the contain-fitted height, not the box height');
    assert.equal(b.w, 89);
    assert.equal(calls[0][4], 100, 'addImage must be called at iy');
  });

  it('TC-BAL1.3: a tall image fills the box height either way (alignTop is a no-op there)', () => {
    const { fn } = makeAddImg(() => ({ width: 1000, height: 2000 })); // ratio 0.5
    const centered = fn('data:image/png;base64,xx', 14, 100, 89, 80);
    const topped = fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignTop: true });
    assert.deepEqual(topped, centered);
    assert.deepEqual(topped, { x: 38.5, y: 100, w: 40, h: 80 });
  });

  it('TC-BAL1.4: the no-properties fallback still draws the full box at the top', () => {
    const { fn } = makeAddImg(() => { throw new Error('no props'); });
    const b = fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignTop: true });
    assert.deepEqual(b, { x: 14, y: 100, w: 89, h: 80 });
  });

  it('TC-BAL1.5: non-cover addImg callers keep their exact old call shape (no opts)', () => {
    assert.ok(indexHtml.includes('addImg(displayImg, dx, dy, itemMainW, dimImgH);'), 'dimensions main image call unchanged');
    assert.ok(indexHtml.includes('addImg(displayImgSub, dx + itemMainW, dy, itemSubW, dimImgH);'), 'dimensions sub image call unchanged');
    assert.ok(indexHtml.includes('addImg(pageImg, posX, y, drawW, drawH);'), 'documents image call unchanged');
  });
});

// ─── TC-BAL2: cover renderer passes the option at every call site, Recap-only
const coverRegion = extract(
  indexHtml,
  /const cp = D\.coverPhotos \|\| \{\};([\s\S]*?)\/\/ Đảm bảo toàn bộ tài liệu kỹ thuật/,
  'PDF cover renderer region'
);

describe('TC-BAL2: Recap Overview covers top-align (Recap-scoped)', () => {
  it('TC-BAL2.1: all 7 cover addImg call sites pass coverImgOpts', () => {
    const lines = coverRegion.split('\n');
    const sites = lines.filter(ln => /const bounds3? = addImg\(c/.test(ln));
    assert.equal(sites.length, 7, `expected 7 cover addImg sites, found ${sites.length}`);
    for (const s of sites) {
      assert.ok(s.includes(', coverImgOpts);'), `cover call site must pass coverImgOpts: ${s.trim()}`);
    }
  });

  it('TC-BAL2.2: coverImgOpts is config-gated so non-Recap covers render byte-identically', () => {
    // INH-3/F5: the gate is pdfLayout.coverAlignTop (Recap true, others false).
    assert.ok(indexHtml.includes('const coverImgOpts = pdfLayout.coverAlignTop ? { alignTop: true } : undefined;'));
  });

  it('TC-BAL2.3: the single-cover optical +10mm drop is skipped for Recap', () => {
    // INH-3/F5: the drop is pdfLayout.singleCoverDrop (Recap 0, others 10).
    assert.ok(indexHtml.includes('const py = y + pdfLayout.singleCoverDrop;'));
  });
});

// ─── TC-BAL3: one 6.5mm spacing rhythm on the Recap flow, gated on isRecap ───
describe('TC-BAL3: Recap spacing rhythm (6.5mm), non-Recap untouched', () => {
  it('TC-BAL3.1: info grid trailing gap is 6.5 for Recap, 4 otherwise', () => {
    // INH-3/F5: the gap is pdfLayout.afterInfoGap (Recap 6.5, others 4).
    assert.ok(indexHtml.includes('} y += pdfLayout.afterInfoGap;'));
  });

  it('TC-BAL3.2: cover block trailing gap goes through coverTrailGap (6.5 Recap / 6 else)', () => {
    // INH-3/F5: coverTrailGap comes straight from pdfLayout (6.5 / 6).
    assert.ok(indexHtml.includes('const coverTrailGap = pdfLayout.coverTrailGap;'));
    assert.ok(indexHtml.includes('y = barY + barH + coverTrailGap;'), '1-photo titled ending');
    assert.ok(indexHtml.includes('y = barY + coverTrailGap;'), '1-photo untitled ending');
    assert.ok(indexHtml.includes('y = maxY + coverTrailGap;'), '2-photo ending');
  });

  it('TC-BAL3.3: QUALITY SUMMARY block advances are on the 6.5 rhythm', () => {
    assert.ok(
      indexHtml.includes("doc.text('✓ No watch-outs recorded', M, y + 1);\n          y += 6.5;"),
      'empty-state advance 8 -> 6.5'
    );
    assert.ok(
      indexHtml.includes('doc.text(mainText, M, y + 1);\n            y += 6.5;'),
      'main-watch-outs line advance is on the 6.5 rhythm (v4.6.4: no table follows it)'
    );
    assert.ok(indexHtml.includes('doc.text("QUALITY SUMMARY", M, y); y += 6.5;'), 'QS heading advance stays 6.5');
    assert.ok(indexHtml.includes('doc.text("OVERVIEW", M, y); y += 6.5;'), 'OVERVIEW heading advance stays 6.5');
  });

  it('TC-BAL3.4: notes blocks use the rhythm for Recap only (addSafeTextBlock, pdfLayout)', () => {
    // INH-3/F5: both advances come from pdfLayout (Recap 6.5/6.5, others 5.2/4).
    assert.ok(indexHtml.includes('ty += pdfLayout.textTitleGap;'), 'title->body advance from config');
    assert.ok(indexHtml.includes('return ty + pdfLayout.textEndGap;'), 'trailing advance from config');
  });

  it('TC-BAL3.5: the non-Recap summary strip advance (8.5) is NOT pulled into the rhythm', () => {
    assert.ok(indexHtml.includes('y += sumBoxH + 8.5;'), 'strip advance unchanged (non-Recap only)');
  });
});

// ─── TC-BAL4: estContentH mirrors addImg's contain math ───
const estBody = extract(
  indexHtml,
  /const estContentH = \(p, boxW, boxH\) => \{([\s\S]*?)\n        \};/,
  'estContentH helper'
);

function makeEst() {
  const doc = {
    getImageProperties: (src) => {
      const m = /^img:(\d+)x(\d+)$/.exec(src);
      if (!m) throw new Error('unknown src');
      return { width: Number(m[1]), height: Number(m[2]) };
    }
  };
  return new Function('doc', `return ((p, boxW, boxH) => {${estBody}\n  });`)(doc);
}

describe('TC-BAL4: estContentH predicts the drawn content height', () => {
  const est = makeEst();

  it('TC-BAL4.1: a wide single image predicts boxW / ratio', () => {
    assert.equal(est({ img: 'img:2000x1000' }, 88, 60), 44);
  });

  it('TC-BAL4.2: a tall single image predicts the full box height', () => {
    assert.equal(est({ img: 'img:1000x2000' }, 88, 60), 60);
  });

  it('TC-BAL4.3: dual layouts (3:1 / 1:1) always occupy the full box height', () => {
    assert.equal(est({ img: 'img:2000x1000', photoLayout: '3:1' }, 88, 60), 60);
    assert.equal(est({ img: 'img:2000x1000', photoLayout: '1:1' }, 88, 60), 60);
    // layout inferred from imgSub, exactly like renderCard
    assert.equal(est({ img: 'img:2000x1000', imgSub: 'img:1000x1000' }, 88, 60), 60);
  });

  it('TC-BAL4.4: empty slots and unreadable images fall back to the box height', () => {
    assert.equal(est(null, 88, 60), 60);
    assert.equal(est({ imgSub: 'img:1000x1000', photoLayout: 'single' }, 88, 60), 60);
    assert.equal(est({ img: 'bogus' }, 88, 60), 60);
  });
});

// ─── TC-BAL5: grid + renderCard top-alignment hooks ───
const gridBody = extract(
  indexHtml,
  /const renderPhotoGrid = \(photos, headerTitle, customCardH, customGapY, gridOpts\) => \{([\s\S]*?)\n      \};/,
  'renderPhotoGrid'
);

describe('TC-BAL5: Watch Out grid top-alignment is gated on showActions', () => {
  it('TC-BAL5.1: renderCard forwards topAlign to addImg and returns the drawn height (single mode)', () => {
    assert.ok(indexHtml.includes('const renderCard = (p, px, py, gw, cardH, opts) => {'));
    assert.ok(indexHtml.includes("const imgOpts = (opts && opts.topAlign) ? { alignTop: true } : undefined;"));
    assert.ok(indexHtml.includes('return b.y + b.h - py;'), 'single-image cards report their real content height');
  });

  it('TC-BAL5.2: both grid branches render Recap cards with topAlign and anchor per-card', () => {
    assert.ok(gridBody.includes('renderCard(p0, px0, py, fullW, rowCardH, showActions ? { topAlign: true } : undefined)'), 'full-width branch');
    assert.ok(gridBody.includes('renderCard(p0, px0, py, gw, rowMaxCardH, showActions ? { topAlign: true } : undefined)'), '2-per-row branch, card 0');
    assert.ok(gridBody.includes('renderCard(p1, px1, py, gw, rowMaxCardH, showActions ? { topAlign: true } : undefined)'), '2-per-row branch, card 1');
    assert.ok(gridBody.includes('const anch0 = showActions ? drawnH0 : rowMaxCardH;'), 'anchor falls back to box height off-Recap');
    assert.ok(gridBody.includes('const anch1 = showActions ? drawnH1 : rowMaxCardH;'));
    assert.ok(gridBody.includes('actionChipTop(py, anch0, capLines.length)'), 'full-width chip hugs its own image');
    assert.ok(gridBody.includes('actionChipTop(py, anch0, capLines0.length)'), 'chip 0 hugs its own image');
    assert.ok(gridBody.includes('actionChipTop(py, anch1, capLines1.length)'), 'chip 1 hugs its own image');
    assert.ok(gridBody.includes('py + anch0 + 3.8'), 'caption 0 hugs its own image');
    assert.ok(gridBody.includes('py + anch1 + 3.8'), 'caption 1 hugs its own image');
  });

  it('TC-BAL5.3: the row total is the tallest card block + gapY (and reduces to the old formula off-Recap)', () => {
    assert.ok(gridBody.includes('const estH0 = showActions ? estContentH(p0, gw, rowMaxCardH) : rowMaxCardH;'));
    assert.ok(gridBody.includes('const estH1 = showActions && p1 ? estContentH(p1, gw, rowMaxCardH) : rowMaxCardH;'));
    assert.ok(gridBody.includes('const rowTotalH = Math.max(blockH0, blockH1) + gapY;'));
  });
});

// ─── TC-BAL6: QUALITY SUMMARY rows — bulleted main watch-outs ───
// Hung (2026-11-13): page 1 shows the "N main watch-outs:" headline plus a
// bulleted list (no numbering, no column header); row padding math is the
// v4.1.4 centering, unchanged.
const rowMath = extract(
  indexHtml,
  /(const rowZoneH = rowH - 0\.6;\s+const capBlockH = \(lines\.length - 1\) \* 3\.9 \+ 3\.7;\s+const rowBaseY = y \+ \(rowZoneH - capBlockH\) \/ 2 \+ 3\.0;)/,
  'QS row centering math'
);
const computeRow = new Function(
  'y', 'rowH', 'lines',
  `${rowMath}\nreturn { rowZoneH, capBlockH, rowBaseY };`
);
const rowHFor = (n) => Math.max(n * 3.9, 6.4) + 2.4;

describe('TC-BAL6: QUALITY SUMMARY bulleted rows have equal top/bottom padding', () => {
  it('TC-BAL6.1: row height formula, right-aligned chip column, bullet on the caption baseline, no table head', () => {
    assert.ok(indexHtml.includes('const rowH = Math.max(lines.length * 3.9, 6.4) + 2.4;'));
    assert.ok(indexHtml.includes('drawActionChip(W - M - actionChipWidth(meta), y + (rowZoneH - 4.8) / 2, meta);'),
      'chip stays right-aligned at W - M and is vertically centered in the row zone');
    assert.ok(indexHtml.includes("doc.text('\u2022', M, rowBaseY);"), 'bullet shares the caption baseline');
    assert.ok(!indexHtml.includes('drawTableHead'), 'no QS table header since v4.6.4');
    assert.ok(!indexHtml.includes("doc.text('WATCH OUT', M + idxW, y + 3);"), 'no QS column headers since v4.6.4');
    assert.ok(indexHtml.includes("const mainText = recapMainTallyText(recapSummary, 'en');"),
      'PDF QS builds the main-watch-outs headline from the shared builder');
  });

  it('TC-BAL6.2: top padding equals bottom padding for 1..4 caption lines', () => {
    for (const n of [1, 2, 3, 4]) {
      const rowH = rowHFor(n);
      const lines = Array.from({ length: n }, () => 'x');
      const { rowZoneH, capBlockH, rowBaseY } = computeRow(100, rowH, lines);
      const topPad = (rowBaseY - 100) - 3.0;
      const bottomPad = rowZoneH - ((rowBaseY - 100) - 3.0 + capBlockH);
      assert.ok(Math.abs(topPad - bottomPad) < 1e-9, `n=${n}: top ${topPad} vs bottom ${bottomPad}`);
    }
  });

  it('TC-BAL6.3: multi-line rows keep the exact pre-v4.1.4 baseline (y + 4)', () => {
    for (const n of [2, 3, 4]) {
      const { rowBaseY } = computeRow(100, rowHFor(n), Array.from({ length: n }, () => 'x'));
      assert.ok(Math.abs(rowBaseY - 104) < 1e-9, `n=${n}: baseline ${rowBaseY}`);
    }
    const one = computeRow(100, rowHFor(1), ['x']);
    assert.ok(Math.abs(one.rowBaseY - 105.25) < 1e-9, 'the 1-line row is the one that moves (down 1.25 to center it)');
  });
});
