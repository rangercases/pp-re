import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function extractFnBody(source, signature, label) {
  const pattern = new RegExp(signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([\\s\\S]*?)\\n    \\}');
  const match = source.match(pattern);
  assert.ok(match, `${label} must be present in index.html`);
  return match[1];
}

// ─────────────────────────────────────────────────────────────────────────────
// DROP (v4.8.1) — drag a JSON file onto the home screen to import it
// (Hung, 2026-11-18). A bare drop handler already existed but was invisible
// (no overlay), raced multiple files in parallel and shared the envelope
// trap. Now: full-window drop overlay, sequential imports behind the
// progress card, batch stops at the conflict dialog, and processJsonData
// refuses backup envelopes on every single-report door.
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-DROP: drag-and-drop JSON import', () => {
  it('TC-DROP.1: the drop overlay markup and styling exist', () => {
    assert.ok(indexHtml.includes('id="dropOverlay"'), 'overlay element present');
    assert.ok(indexHtml.includes('Drop to import'), 'overlay label present');
    assert.ok(indexHtml.includes('.drop-overlay {'), 'overlay styled');
    assert.ok(indexHtml.includes('pointer-events: none'), 'overlay never blocks the drop itself');
  });

  it('TC-DROP.2: drag handling is window-level, home-screen only, with a depth counter', () => {
    const body = extractFnBody(indexHtml, 'function initHomeDragAndDrop()', 'initHomeDragAndDrop');
    for (const ev of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      assert.ok(body.includes(`window.addEventListener('${ev}'`), `${ev} handled on window`);
    }
    assert.ok(body.includes("home.classList.contains('active')"), 'only while the home screen is active');
    assert.ok(body.includes('dragDepth'), 'enter/leave depth counter prevents overlay flicker');
    assert.ok(body.includes("e.dataTransfer.dropEffect = 'copy'"), 'copy cursor while dragging');
  });

  it('TC-DROP.3: dropped files import sequentially behind the progress card and stop at the conflict dialog', () => {
    const body = extractFnBody(indexHtml, 'function initHomeDragAndDrop()', 'initHomeDragAndDrop');
    assert.ok(body.includes('await importFileWithProgress(file)'), 'files import one by one, awaited');
    assert.ok(body.includes("getElementById('importConflictModal')"), 'batch checks the conflict dialog');
    assert.ok(body.includes('remaining files were not imported'), 'user is told when the batch stops');
    const helper = extractFnBody(indexHtml, 'function importFileWithProgress(file)', 'importFileWithProgress');
    assert.ok(helper.includes('reader.onprogress'), 'read phase feeds the progress card');
    assert.ok(helper.includes("processJsonData(data, { ipToken: ipToken, ipFileName: file.name })"),
      'import goes through processJsonData with the progress token');
    const imp = extractFnBody(indexHtml, 'function importReport(e)', 'importReport');
    assert.ok(imp.includes('importFileWithProgress(file)'), 'the file picker shares the same reader');
  });

  it('TC-DROP.4: processJsonData refuses backup envelopes before any processing', () => {
    const body = extractFnBody(indexHtml, 'async function processJsonData(data, opts)', 'processJsonData');
    const guardAt = body.indexOf('Array.isArray(data.reports)');
    const normAt = body.indexOf('normalizeReportPhotos(data, {');
    assert.ok(guardAt !== -1 && normAt !== -1 && guardAt < normAt, 'envelope check runs before photo processing');
    assert.ok(body.includes('This is a backup file — use Restore (JSON) in the ⚙ menu'),
      'the refusal points at the Restore door');
  });
});
