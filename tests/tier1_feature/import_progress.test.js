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

function loadNormalize() {
  const body = extractFnBody(indexHtml, 'async function normalizeReportPhotos(rep, opts)', 'normalizeReportPhotos');
  return new Function('normalizeMasterPhoto', 'resizeImage',
    `return async function normalizeReportPhotos(rep, opts) {${body}};`)(
    async (s) => s, async (s) => s);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROG (v4.8.0) — import/restore progress card (Hung, 2026-11-18): like the
// big apps, importing a JSON shows the file name, the stage and a percent,
// with a cancel button. Reading = FileReader progress, processing =
// per-photo callbacks from normalizeReportPhotos, then saving.
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-PROG: import/restore progress card', () => {
  it('TC-PROG.1: the progress card markup exists with file, bar, stage, percent and cancel', () => {
    for (const id of ['importProgress', 'ipFileName', 'ipFill', 'ipStage', 'ipPct']) {
      assert.ok(indexHtml.includes(`id="${id}"`), `#${id} present`);
    }
    assert.ok(indexHtml.includes('onclick="ipRequestCancel()"'), 'cancel button wired');
    assert.ok(indexHtml.includes('.import-progress {'), 'card styled');
  });

  it('TC-PROG.2: normalizeReportPhotos reports progress for every collected item', async () => {
    const normalizeReportPhotos = loadNormalize();
    const rep = {
      coverPhotos: { FRONT_VIEW: { img: 'a' }, SIDE_VIEW: { img: 'b' } },
      prodPhotos: [{ img: 'c' }, { img: 'd' }],
      dimensions: [{ img: 'e' }],
      docAttachments: [{ name: 'spec.pdf' }]
    };
    const seen = [];
    await normalizeReportPhotos(rep, { onProgress: (d, t) => seen.push([d, t]) });
    assert.deepEqual(seen, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
  });

  it('TC-PROG.3: a cancelled token stops photo processing between items', async () => {
    const normalizeReportPhotos = loadNormalize();
    const rep = { prodPhotos: [{ img: '1' }, { img: '2' }, { img: '3' }, { img: '4' }] };
    const token = { cancelled: false };
    const seen = [];
    await normalizeReportPhotos(rep, {
      token,
      onProgress: (d) => { seen.push(d); if (d === 2) token.cancelled = true; }
    });
    assert.deepEqual(seen, [1, 2], 'no progress reported after cancel');
  });

  it('TC-PROG.4: both file readers drive the card (progress + abort)', () => {
    const imp = extractFnBody(indexHtml, 'function importReport(e)', 'importReport');
    assert.ok(imp.includes('reader.onprogress'), 'import reader reports read progress');
    assert.ok(imp.includes('reader.onabort'), 'import reader handles abort');
    assert.ok(imp.includes('ipShow(file.name, ipToken)'), 'import shows the card with the file name');
    const rst = extractFnBody(indexHtml, 'async function restoreDatabase(event)', 'restoreDatabase');
    assert.ok(rst.includes('reader.onprogress'), 'restore reader reports read progress');
    assert.ok(rst.includes('ipShow(file.name, ipToken)'), 'restore shows the card with the file name');
  });

  it('TC-PROG.5: restore maps per-report progress and keeps restored reports on cancel', () => {
    const rst = extractFnBody(indexHtml, 'async function restoreDatabase(event)', 'restoreDatabase');
    assert.ok(rst.includes('Report ${ri + 1}/${reportsToRestore.length}'), 'stage names the current report');
    assert.ok(rst.includes('restoreCancelled'), 'cancel path exists');
    assert.ok(rst.includes('report(s) kept'), 'partial restores are kept and reported');
  });

  it('TC-PROG.6: single import checks the cancel token before saving anything', () => {
    const body = extractFnBody(indexHtml, 'async function processJsonData(data, opts)', 'processJsonData');
    const normAt = body.indexOf('normalizeReportPhotos(data, {');
    const cancelAt = body.indexOf('ipToken.cancelled', normAt);
    const saveAt = body.indexOf('dbPut(normalizedData)', normAt);
    assert.ok(normAt !== -1 && cancelAt > normAt && saveAt > cancelAt,
      'cancel is checked after processing and before dbPut');
  });
});
