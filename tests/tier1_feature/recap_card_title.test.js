import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// Slice one hub card out of index.html, bounded by its MODULE comment markers
// so assertions never leak into neighbouring cards or unrelated markup
// (same helper pattern as recap_logo.test.js).
function cardBlock(fromMarker, toMarker) {
  const start = indexHtml.indexOf(fromMarker);
  assert.ok(start !== -1, `${fromMarker} must be present in index.html`);
  const end = indexHtml.indexOf(toMarker, start);
  assert.ok(end !== -1, `${toMarker} must follow ${fromMarker} in index.html`);
  return indexHtml.slice(start, end);
}

const preProdBlock = cardBlock('<!-- MODULE 01', '<!-- MODULE 02');
const prototypeBlock = cardBlock('<!-- MODULE 02', '<!-- MODULE 03');
// Recap is the last hub card since v4.2.1 (module 04 placeholder removed),
// so its block runs to the LEVEL 2 workspace comment that follows the hub grid.
const recapBlock = cardBlock('<!-- MODULE 03', '<!-- LEVEL 2');

function cardText(block, cls, label) {
  const match = block.match(new RegExp(`<div class="${cls}">([^<]*)</div>`));
  assert.ok(match, `${label} card must contain a .${cls} text node`);
  return match[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-CARD1 — Module 03 hub card title/tagline match modules 01/02 (v4.1.9)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-CARD1: Recap hub card title is "Recap", tagline matches 01/02 (v4.1.9)', () => {
  it('TC-CARD1.1: the Recap card title is "Recap" and its tagline is "Sample Review Report"', () => {
    assert.ok(recapBlock.includes('id="cardModuleRecap"'), 'slice must be the Recap card');
    assert.equal(cardText(recapBlock, 'craft-card-title', 'Recap'), 'Recap');
    assert.equal(cardText(recapBlock, 'craft-card-tagline', 'Recap'), 'Sample Review Report');
    assert.ok(
      !recapBlock.includes('Overview &amp; Watch Out'),
      'the old "Overview & Watch Out" tagline must be gone from the Recap card'
    );
  });

  it('TC-CARD1.2: all three active cards share the same tagline; 01/02 titles unchanged', () => {
    const tagline01 = cardText(preProdBlock, 'craft-card-tagline', 'Pre-Production');
    const tagline02 = cardText(prototypeBlock, 'craft-card-tagline', 'Prototype');
    const tagline03 = cardText(recapBlock, 'craft-card-tagline', 'Recap');
    assert.equal(tagline01, 'Sample Review Report');
    assert.equal(tagline02, tagline01, 'module 02 tagline must match module 01');
    assert.equal(tagline03, tagline01, 'module 03 tagline must match modules 01/02');
    assert.equal(cardText(preProdBlock, 'craft-card-title', 'Pre-Production'), 'Pre-Production');
    assert.equal(cardText(prototypeBlock, 'craft-card-title', 'Prototype'), 'Prototype');
  });
});
