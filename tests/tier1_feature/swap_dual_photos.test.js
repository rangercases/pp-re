// TC-R10 — Swap the two photos of a dual-photo card (Hung, 2026-11-26:
// 'tôi muốn có nút hoặc lệnh gì đó để đảo 2 ảnh qua lại', on a Watch Out
// card screenshot). A swap button (always visible, unlike the hover-only
// delete) joins the card topbar on every dual-slot section (Watch Out,
// Testing, Assembly) and on Dimensions rows. Only the photo pair changes
// sides: caption, layout, size and the Recap disposition stay with the card.
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


const swapBody = extractFnBody(indexHtml, 'function swapDualPhotoFields(p)', 'swapDualPhotoFields');
const swapDualPhotoFields = new Function(`return (function swapDualPhotoFields(p) {${swapBody}});`)();

describe('TC-R10: swap main/detail photos', () => {
  it('TC-R10.1: the photo pairs trade places, everything else stays', () => {
    const p = {
      img: 'A', original: 'AO', imgSub: 'B', originalSub: 'BO',
      markupBase: 'AM', markupBaseSub: 'BM',
      caption: 'keep me', photoLayout: '1:1', photoSize: 'half', action: 'fix-next'
    };
    swapDualPhotoFields(p);
    assert.equal(p.img, 'B'); assert.equal(p.original, 'BO'); assert.equal(p.markupBase, 'BM');
    assert.equal(p.imgSub, 'A'); assert.equal(p.originalSub, 'AO'); assert.equal(p.markupBaseSub, 'AM');
    assert.equal(p.caption, 'keep me', 'caption stays with the card');
    assert.equal(p.photoLayout, '1:1', 'layout stays');
    assert.equal(p.photoSize, 'half', 'size stays');
    assert.equal(p.action, 'fix-next', 'Recap disposition stays');
  });

  it('TC-R10.2: swapping with one empty side moves the photo across', () => {
    const p = { img: 'A', original: 'AO', imgSub: null, originalSub: null };
    swapDualPhotoFields(p);
    assert.equal(p.img, null); assert.equal(p.imgSub, 'A'); assert.equal(p.originalSub, 'AO');
    swapDualPhotoFields(p);
    assert.equal(p.img, 'A', 'a second swap restores the original arrangement');
  });

  it('TC-R10.3: wiring — button and handlers on dual cards and Dimensions', () => {
    assert.ok(indexHtml.includes("function dualSlotSwapBtnHtml(key, i)"), 'shared swap button builder exists');
    const btnBody = extractFnBody(indexHtml, 'function dualSlotSwapBtnHtml(key, i)', 'dualSlotSwapBtnHtml');
    assert.ok(btnBody.includes('swapDualPhotos(') && btnBody.includes('dim-swap-btn'),
      'the button calls swapDualPhotos for its section key');
    assert.ok(indexHtml.includes("(displayImg || displayImgSub) ? dualSlotSwapBtnHtml(key, i) : ''"),
      'dual-card topbar shows the button when the card holds any photo');
    assert.ok(indexHtml.includes('onclick="swapDimPhotos(${i});event.stopPropagation()"'),
      'Dimensions rows carry the same button');
    const dual = extractFnBody(indexHtml, 'function swapDualPhotos(key, index)', 'swapDualPhotos');
    assert.ok(dual.includes("pushHistory('Swap main/detail photos')"), 'dual swap is undoable');
    assert.ok(dual.includes('swapDualPhotoFields(p)') && dual.includes('savePhotoChangeNow()'),
      'dual swap exchanges the fields and persists immediately');
    const dim = extractFnBody(indexHtml, 'function swapDimPhotos(index)', 'swapDimPhotos');
    assert.ok(dim.includes('swapDualPhotoFields(d)') && dim.includes('buildDimGrid()'),
      'dimension swap reuses the same exchange and re-renders');
    assert.ok(indexHtml.includes('.dim-swap-btn {'), 'swap button has its own always-visible style');
  });
});
