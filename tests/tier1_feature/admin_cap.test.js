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

// ─────────────────────────────────────────────────────────────────────────────
// TC-CAP — the local report cap does not bind admin (Hung, 2026-11-19).
// Admin's real store is the cloud; cloudPullAndMerge already fills a device
// past MAX_LOCAL_REPORTS, so the cap only guards regular users' storage.
// ─────────────────────────────────────────────────────────────────────────────
function makeCapacityApi({ disk, admin, metaCount }) {
  const body = extractFnBody(indexHtml, 'async function ensureLocalReportCapacity()', 'ensureLocalReportCapacity');
  const calls = { limitHandler: 0 };
  const factory = new Function(
    'diskK1Active', 'cloudSyncAllowed', 'dbGetAllMetadata', 'handleReportLimitReached', 'MAX_LOCAL_REPORTS', 'console',
    `async function ensureLocalReportCapacity() {${body}}\n     return ensureLocalReportCapacity;`
  );
  const fn = factory(
    () => disk,
    () => admin,
    async () => Array.from({ length: metaCount }, (_, i) => ({ id: 'r' + i })),
    async () => { calls.limitHandler++; },
    10,
    console
  );
  return { fn, calls };
}

describe('TC-CAP: admin is exempt from the local report cap', () => {
  it('TC-CAP.1: admin passes even at/over the cap, without the limit dialog', async () => {
    const { fn, calls } = makeCapacityApi({ disk: false, admin: true, metaCount: 11 });
    assert.equal(await fn(), true);
    assert.equal(calls.limitHandler, 0);
  });

  it('TC-CAP.2: disk-mode user still passes unconditionally', async () => {
    const { fn, calls } = makeCapacityApi({ disk: true, admin: false, metaCount: 11 });
    assert.equal(await fn(), true);
    assert.equal(calls.limitHandler, 0);
  });

  it('TC-CAP.3: regular user under the cap passes', async () => {
    const { fn, calls } = makeCapacityApi({ disk: false, admin: false, metaCount: 9 });
    assert.equal(await fn(), true);
    assert.equal(calls.limitHandler, 0);
  });

  it('TC-CAP.4: regular user at the cap is still blocked with the limit dialog', async () => {
    const { fn, calls } = makeCapacityApi({ disk: false, admin: false, metaCount: 10 });
    assert.equal(await fn(), false);
    assert.equal(calls.limitHandler, 1);
  });

  it('TC-CAP.5: the restore-path cap check also exempts admin', () => {
    const body = extractFnBody(indexHtml, 'async function restoreDatabase(event)', 'restoreDatabase');
    assert.ok(body.includes('if (!diskK1Active() && !cloudSyncAllowed() && existingMetas.length + newCount > MAX_LOCAL_REPORTS)'));
  });

  it('TC-CAP.6: the batch-duplicate room check also exempts admin', () => {
    const body = extractFnBody(indexHtml, 'async function duplicateSelectedReports()', 'duplicateSelectedReports');
    assert.ok(body.includes('if (!diskK1Active() && !cloudSyncAllowed()) {'));
  });

  it('TC-CAP.7: the home counter shows admin a plain count (no /10, no warning branch)', () => {
    assert.ok(indexHtml.includes('} else if (cloudSyncAllowed()) {'));
    assert.ok(indexHtml.includes('Admin has no local cap: plain count, no fraction, no warning.'));
  });
});
