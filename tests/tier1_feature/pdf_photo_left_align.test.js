// TC-R11 — PDF grid cards: photos flush with the LEFT edge of their frame
// (Hung, 2026-11-26, on an Enzo Watch Out export: 'chữ và ảnh ko thẳng lề
// bên trái'). addImg used to CENTER a tall photo horizontally inside its
// box, so the photo's left edge floated inwards while the caption below
// started at the frame edge. renderCard now passes alignLeft: the photo
// hugs the frame's left edge, level with its caption. Other addImg callers
// (covers etc.) keep the centered behaviour — they pass no alignLeft.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function extractAddImg(source) {
  const start = source.indexOf('const addImg = (src, x, iy, iw, ih, opts) => {');
  assert.ok(start >= 0, 'addImg must be present in index.html');
  const end = source.indexOf('\n      };', start);
  assert.ok(end > start, 'addImg body must terminate');
  return source.slice(start, end + '\n      };'.length);
}

function makeAddImg(imgW, imgH) {
  const calls = [];
  const doc = {
    getImageProperties: () => ({ width: imgW, height: imgH }),
    addImage: (src, fmt, x, y, w, h) => { calls.push({ x, y, w, h }); }
  };
  const addImg = new Function('doc', 'pdfImageMap', extractAddImg(indexHtml) + '\nreturn addImg;')(doc, null);
  return { addImg, calls };
}

const SRC = 'data:image/jpeg;base64,AAAA';


describe('TC-R11: grid photos flush left with their captions', () => {
  it('TC-R11.1: a tall photo left-aligns inside its box with alignLeft', () => {
    const { addImg, calls } = makeAddImg(300, 400); // ratio 0.75, box 88x55
    const r = addImg(SRC, 14, 20, 88, 55, { alignLeft: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].x, 14, 'photo starts exactly at the box left edge');
    assert.equal(calls[0].w, 41.25, 'width still contain-fitted by height');
    assert.equal(r.x, 14, 'the returned rect (used for the frame) is flush left too');
  });

  it('TC-R11.2: without alignLeft the old centering is untouched (covers etc.)', () => {
    const { addImg, calls } = makeAddImg(300, 400);
    addImg(SRC, 14, 20, 88, 55, undefined);
    assert.equal(calls[0].x, 14 + (88 - 41.25) / 2, 'centered as before');
  });

  it('TC-R11.3: wide photos are unaffected, and alignBottom still composes', () => {
    const a = makeAddImg(800, 400); // ratio 2 > box 1.6 -> fills width
    a.addImg(SRC, 14, 20, 88, 55, { alignLeft: true });
    assert.equal(a.calls[0].x, 14);
    assert.equal(a.calls[0].y, 20 + (55 - 44) / 2, 'vertical centering kept');
    const b = makeAddImg(800, 400);
    b.addImg(SRC, 14, 20, 88, 55, { alignLeft: true, alignBottom: true });
    assert.equal(b.calls[0].y, 20 + (55 - 44), 'v4.13.5 bottom alignment still applies');
  });

  it('TC-R11.4: wiring — renderCard always passes alignLeft, addImg honours it', () => {
    assert.ok(indexHtml.includes('const imgOpts = { alignLeft: true };'),
      'renderCard builds imgOpts with alignLeft');
    assert.ok(indexHtml.includes('offsetX = (opts && opts.alignLeft) ? 0 : (iw - renderW) / 2;'),
      'addImg left-aligns tall photos only when asked');
  });
});
