// TC-R06 — Recap Watch Out rows: the smaller photo moves DOWN so both
// photos' bottoms align and the two captions always start on the same
// horizontal line (Hung, 2026-11-24). Before this, each card anchored its
// caption to its own image height (topAlign), so captions of a tall and a
// short photo in one row started at different heights.
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

describe('TC-R06.1: addImg gains an opt-in bottom-align; other modes unchanged', () => {
  it('TC-R06.1.1: with { alignBottom: true } a wide image sits on the box bottom', () => {
    const { fn, calls } = makeAddImg(() => ({ width: 2000, height: 1000 })); // ratio 2
    const b = fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignBottom: true });
    // renderH = 89 / 2 = 44.5; offsetY = 80 - 44.5 = 35.5 -> y = 135.5, bottom = 180 = box bottom
    assert.deepEqual(b, { x: 14, y: 135.5, w: 89, h: 44.5 });
    assert.equal(b.y + b.h, 180, 'image bottom must touch the box bottom');
    assert.equal(calls[0][4], 135.5, 'addImage must be called at the bottom-aligned y');
  });

  it('TC-R06.1.2: a height-bound image fills the box height — bottom-align is a no-op', () => {
    const { fn } = makeAddImg(() => ({ width: 1000, height: 2000 })); // ratio 0.5
    const b = fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignBottom: true });
    assert.deepEqual(b, { x: 38.5, y: 100, w: 40, h: 80 });
  });

  it('TC-R06.1.3: default (no opts) still centres; alignTop still pins to the top', () => {
    const { fn } = makeAddImg(() => ({ width: 2000, height: 1000 }));
    assert.deepEqual(fn('data:image/png;base64,xx', 14, 100, 89, 80), { x: 14, y: 117.75, w: 89, h: 44.5 });
    assert.deepEqual(fn('data:image/png;base64,xx', 14, 100, 89, 80, { alignTop: true }), { x: 14, y: 100, w: 89, h: 44.5 });
  });
});

describe('TC-R06.2: the Watch Out row shares one content height and bottom-aligns', () => {
  const gridRegion = extract(
    indexHtml,
    /(const renderPhotoGrid = \(photos, headerTitle, customCardH, customGapY, gridOpts\) => \{[\s\S]*?const renderPhotoSection)/,
    'renderPhotoGrid region'
  );

  it('TC-R06.2.1: rowContentH is the max of the two slot heights, Watch Out only', () => {
    assert.ok(gridRegion.includes('const rowContentH = showActions ? Math.max(estH0, estH1) : rowMaxCardH;'),
      'one shared content height per row for showActions; other sections keep rowMaxCardH');
  });

  it('TC-R06.2.2: Watch Out cards render bottom-aligned inside the shared height', () => {
    assert.ok(gridRegion.includes("renderCard(p0, px0, py, gw, showActions ? rowContentH : rowMaxCardH, showActions ? { bottomAlign: true } : undefined)"),
      'left card: shared box height + bottomAlign for Watch Out');
    assert.ok(gridRegion.includes("renderCard(p1, px1, py, gw, showActions ? rowContentH : rowMaxCardH, showActions ? { bottomAlign: true } : undefined)"),
      'right card: shared box height + bottomAlign for Watch Out');
    assert.ok(!gridRegion.includes('renderCard(p0, px0, py, gw, rowMaxCardH, showActions ? { topAlign: true }'),
      'the old per-slot topAlign rendering of the 2-col branch is gone');
    assert.ok(!gridRegion.includes('const anch0 = showActions ? drawnH0 : rowMaxCardH;'),
      'the old per-slot caption anchor of the 2-col branch is gone');
  });

  it('TC-R06.2.3: both captions and chips anchor to the SAME rowContentH', () => {
    assert.ok(gridRegion.includes('const anch0 = showActions ? rowContentH : rowMaxCardH;'), 'left anchor = shared height');
    assert.ok(gridRegion.includes('const anch1 = showActions ? rowContentH : rowMaxCardH;'), 'right anchor = shared height');
    assert.ok(gridRegion.includes('drawCaption(capLines0, px0, gw, py + anch0 + 3.8);'), 'left caption starts at the shared line');
    assert.ok(gridRegion.includes('drawCaption(capLines1, px1, gw, py + anch1 + 3.8);'), 'right caption starts at the shared line');
  });

  it('TC-R06.2.4: renderCard forwards bottomAlign down to addImg', () => {
    assert.ok(indexHtml.includes("const imgOpts = (opts && opts.topAlign) ? { alignTop: true } : (opts && opts.bottomAlign) ? { alignBottom: true } : undefined;"),
      'renderCard must translate opts.bottomAlign into addImg opts');
  });
});
