import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// Slice one hub card out of index.html, bounded by its MODULE comment markers
// so assertions never leak into neighbouring cards or unrelated markup.
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

function decodeIcon(block, label) {
  const match = block.match(/<img src="data:image\/png;base64,([A-Za-z0-9+/=]+)" alt="([^"]*)">/);
  assert.ok(match, `${label} card must render its icon as an <img> with a PNG data URI`);
  return { bytes: Buffer.from(match[1], 'base64'), alt: match[2] };
}

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

// ─────────────────────────────────────────────────────────────────────────────
// TC-LOGO1 — Module 03 Recap hub card uses the approved chair logo (v4.1.8)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-LOGO1: Recap hub card shows the new logo, matching modules 01/02 (v4.1.8)', () => {
  it('TC-LOGO1.1: the Recap icon is an <img> whose data URI is byte-identical to the approved logo', () => {
    assert.ok(recapBlock.includes('id="cardModuleRecap"'), 'slice must be the Recap card');
    const { bytes, alt } = decodeIcon(recapBlock, 'Recap');
    // recap_logo_160.png as approved by the owner: 160×160 PNG, 16,324 bytes.
    assert.equal(alt, 'Sample Review Recap');
    assert.equal(bytes.length, 16324, 'decoded Recap icon must be exactly 16,324 bytes');
    assert.equal(
      sha256(bytes),
      'f8f78115ee3f03a01500a6483cd73d6c9caf997cb8915cdf841e18971b417399',
      'decoded Recap icon must hash to the approved recap_logo_160.png'
    );
    // PNG signature + IHDR dimensions: the approved logo is 160×160.
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 160, 'logo width must be 160');
    assert.equal(bytes.readUInt32BE(20), 160, 'logo height must be 160');
  });

  it('TC-LOGO1.2: the generic clipboard-check SVG and its recap-only icon-box style are gone', () => {
    assert.ok(
      !recapBlock.includes('M16 4h2a2 2 0 0 1 2 2v14'),
      'the clipboard SVG path must no longer exist inside the Recap card'
    );
    assert.ok(!recapBlock.includes('<svg'), 'the Recap card must not keep any inline SVG icon');
    assert.ok(
      !recapBlock.includes('craft-app-icon" style='),
      'the Recap icon box must drop its inline style, like modules 01/02'
    );
    assert.match(recapBlock, /<div class="craft-app-icon">\s*<img /);
  });

  it('TC-LOGO1.3: modules 01 and 02 icon markup is unchanged', () => {
    const preProd = decodeIcon(preProdBlock, 'Pre-Production');
    assert.equal(preProd.alt, 'Pre-Production');
    assert.equal(preProd.bytes.length, 27143);
    assert.equal(sha256(preProd.bytes), '99c05274fda45c27dc56ba8f74a295c89ba901e5c6db9d722adef97e36bdaccd');

    const prototype = decodeIcon(prototypeBlock, 'Prototype');
    assert.equal(prototype.alt, 'Prototype');
    assert.equal(prototype.bytes.length, 20450);
    assert.equal(sha256(prototype.bytes), '62275ea989d9988d20bd75d43559df44f9f843754cece20a0a6ac528834f0a32');
  });
});
