// TC-R09 — Paste must deliver what was actually copied (Hung, 2026-11-26):
// 'copy ở bất cứ đâu trên laptop, paste được vào ô ảnh app — không phải
// paste ra cái ảnh cũ'. Before this fix, applyImageFileToTarget silently
// replaced ANY pasted image with the in-app copied photo for 15 minutes
// after an in-app copy, without ever checking the pasted content. Now the
// in-app original is reused only when the pasted file's fingerprint
// matches the blob that was written to the system clipboard at copy time.
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


const fpBody = extractFnBody(indexHtml, 'async function clipboardBlobFingerprint(blob)', 'clipboardBlobFingerprint');
const matchBody = extractFnBody(indexHtml, 'function isAppCopiedPaste(copied, fp, now)', 'isAppCopiedPaste');
const clipboardBlobFingerprint = new Function(`return (async function clipboardBlobFingerprint(blob) {${fpBody}});`)();
const isAppCopiedPaste = new Function(`return (function isAppCopiedPaste(copied, fp, now) {${matchBody}});`)();

const NOW = 1_000_000_000_000;
const fresh = { clipSize: 100, clipHash: 'a-b', timestamp: NOW - 60_000 };

describe('TC-R09: pasted content always wins unless it IS the in-app copy', () => {
  it('TC-R09.1: fingerprint is deterministic and content-sensitive', async () => {
    const b1 = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
    const b2 = new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/png' });
    const b3 = new Blob([new Uint8Array([1, 2, 3, 4, 6])], { type: 'image/png' });
    const f1 = await clipboardBlobFingerprint(b1);
    const f2 = await clipboardBlobFingerprint(b2);
    const f3 = await clipboardBlobFingerprint(b3);
    assert.deepEqual(f1, f2, 'same bytes -> same fingerprint');
    assert.equal(f1.size, 5);
    assert.notEqual(f1.hash, f3.hash, 'one byte different -> different hash');
    assert.equal(await clipboardBlobFingerprint(null), null);
  });

  it('TC-R09.2: the in-app copy is reused only on an exact fingerprint match', () => {
    assert.equal(isAppCopiedPaste(fresh, { size: 100, hash: 'a-b' }, NOW), true, 'exact match within 15 min');
    assert.equal(isAppCopiedPaste(fresh, { size: 101, hash: 'a-b' }, NOW), false, 'different size = another image');
    assert.equal(isAppCopiedPaste(fresh, { size: 100, hash: 'a-c' }, NOW), false, 'different hash = another image');
    assert.equal(isAppCopiedPaste(fresh, null, NOW), false, 'unreadable paste never matches');
  });

  it('TC-R09.3: no stored fingerprint (clipboard write failed) — paste is never hijacked', () => {
    const noFp = { timestamp: NOW - 60_000 };
    assert.equal(isAppCopiedPaste(noFp, { size: 100, hash: 'a-b' }, NOW), false);
    assert.equal(isAppCopiedPaste(null, { size: 100, hash: 'a-b' }, NOW), false);
  });

  it('TC-R09.4: an expired in-app copy (15 min) never matches', () => {
    const stale = { clipSize: 100, clipHash: 'a-b', timestamp: NOW - 16 * 60_000 };
    assert.equal(isAppCopiedPaste(stale, { size: 100, hash: 'a-b' }, NOW), false);
  });

  it('TC-R09.5: wiring — copy stores the fingerprint, paste gates on it', () => {
    assert.ok(indexHtml.includes('return await clipboardBlobFingerprint(pngBlob);'),
      'the clipboard writer returns the fingerprint of the written blob');
    assert.ok(indexHtml.includes('_appCopiedPhoto.clipSize = fp.size;') && indexHtml.includes('_appCopiedPhoto.clipHash = fp.hash;'),
      'copyPhotoFromTarget stores clipSize/clipHash on the in-app copy record');
    assert.ok(indexHtml.includes('_appCopiedPhoto.timestamp === copiedAt'),
      'the fingerprint attaches only if this copy is still the latest one');
    assert.ok(indexHtml.includes('const pasteFp = await clipboardBlobFingerprint(file);'),
      'the paste path fingerprints the incoming file');
    assert.ok(indexHtml.includes('isAppCopiedPaste(copied, pasteFp, Date.now())'),
      'the reuse decision goes through the fingerprint gate');
    assert.ok(!indexHtml.includes('if (copied && copied.original && (Date.now() - (copied.timestamp || 0) < 15 * 60 * 1000))'),
      'the old time-only hijack condition is gone');
  });
});
