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
// TC-DISK3.1 — cloudSyncAllowed: the pure role decision behind §5.9
// ─────────────────────────────────────────────────────────────────────────────
const cloudGateBody = extractFnBody(indexHtml, 'function cloudSyncAllowed()', 'cloudSyncAllowed');

function makeCloudGateApi() {
  const factory = new Function(
    `let currentUser = null;
     function cloudSyncAllowed() {${cloudGateBody}}
     return { cloudSyncAllowed, setUser(u) { currentUser = u; } };`
  );
  return factory();
}

describe('TC-DISK3.1: cloudSyncAllowed — cloud is admin-only', () => {
  const api = makeCloudGateApi();

  it('an admin may sync', () => {
    api.setUser({ id: 1, role: 'admin' });
    assert.equal(api.cloudSyncAllowed(), true);
  });

  it('a regular user may not sync', () => {
    api.setUser({ id: 2, role: 'user' });
    assert.equal(api.cloudSyncAllowed(), false);
  });

  it('any non-admin role may not sync', () => {
    api.setUser({ id: 3, role: 'editor' });
    assert.equal(api.cloudSyncAllowed(), false);
    api.setUser({ id: 4 });
    assert.equal(api.cloudSyncAllowed(), false);
  });

  it('a signed-out session may not sync', () => {
    api.setUser(null);
    assert.equal(api.cloudSyncAllowed(), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.2 — every cloud entry point checks the gate BEFORE any network
// call, and no /api/reports or /api/photos request exists outside the
// gated cloud block.
// ─────────────────────────────────────────────────────────────────────────────
function firstNetworkIndex(body) {
  const idx = ['apiFetch(', "fetch('"].map(t => body.indexOf(t)).filter(i => i >= 0);
  return idx.length ? Math.min(...idx) : -1;
}

describe('TC-DISK3.2: cloud entry points are gated before any request', () => {
  const entries = [
    ['async function cloudPushReport(report)', 'cloudPushReport'],
    ['async function cloudDeleteReport(id)', 'cloudDeleteReport'],
    ['async function cloudPullAndMerge()', 'cloudPullAndMerge'],
    ['async function cloudUploadPhoto(dataUrl)', 'cloudUploadPhoto'],
    ['async function cloudFetchPhotoDataUrl(hash)', 'cloudFetchPhotoDataUrl']
  ];

  for (const [sig, label] of entries) {
    it(`${label} checks cloudSyncAllowed() before its first request`, () => {
      const body = extractFnBody(indexHtml, sig, label);
      const gateAt = body.indexOf('cloudSyncAllowed()');
      const netAt = firstNetworkIndex(body);
      assert.ok(gateAt >= 0, `${label} must call cloudSyncAllowed()`);
      assert.ok(netAt === -1 || gateAt < netAt, `${label} must gate before any fetch (gate@${gateAt}, net@${netAt})`);
    });
  }

  it('cloudPatchReport (the only other /api/reports caller) is called solely from the gated cloudPushReport', () => {
    const all = indexHtml.match(/cloudPatchReport\(/g) || [];
    assert.equal(all.length, 4, 'one definition + three calls, all accounted for');
    const pushBody = extractFnBody(indexHtml, 'async function cloudPushReport(report)', 'cloudPushReport');
    const inPush = pushBody.match(/cloudPatchReport\(/g) || [];
    assert.equal(inPush.length, 3, 'all three cloudPatchReport calls live inside cloudPushReport');
  });

  it('every literal /api/reports and /api/photos request sits inside the cloud block', () => {
    const start = indexHtml.indexOf('CLOUD IS ADMIN-ONLY');
    const end = indexHtml.indexOf('function withTimeout');
    assert.ok(start >= 0 && end > start, 'cloud block bounds must exist');
    const reqRe = /apiFetch\('\/api\/reports|fetch\('\/api\/photos/g;
    let m;
    let count = 0;
    while ((m = reqRe.exec(indexHtml)) !== null) {
      count++;
      assert.ok(m.index > start && m.index < end, `request at ${m.index} must be inside the gated cloud block`);
    }
    assert.ok(count >= 9, `expected at least 9 literal cloud requests, found ${count}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.3 — the local report cap no longer binds disk-mode users
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.3: MAX_LOCAL_REPORTS exemptions for disk users', () => {
  it('ensureLocalReportCapacity returns true immediately in disk mode', () => {
    const body = extractFnBody(indexHtml, 'async function ensureLocalReportCapacity()', 'ensureLocalReportCapacity');
    const gateAt = body.indexOf('diskK1Active()');
    const capAt = body.indexOf('MAX_LOCAL_REPORTS');
    assert.ok(gateAt >= 0, 'capacity check must consult diskK1Active()');
    assert.ok(capAt > gateAt, 'the disk exemption must precede the cap comparison');
    assert.ok(body.includes('if (diskK1Active()) return true;'), 'disk users pass the capacity check unconditionally');
  });

  it('the restore-path cap check is skipped for disk users', () => {
    const body = extractFnBody(indexHtml, 'async function restoreDatabase(event)', 'restoreDatabase');
    assert.ok(
      body.includes('if (!diskK1Active() && existingMetas.length + newCount > MAX_LOCAL_REPORTS)'),
      'restore must not block a disk user at the local cap'
    );
  });

  it('the batch-duplicate room check is skipped for disk users', () => {
    const body = extractFnBody(indexHtml, 'async function duplicateSelectedReports()', 'duplicateSelectedReports');
    const guardAt = body.indexOf('if (!diskK1Active()) {');
    const roomAt = body.indexOf('MAX_LOCAL_REPORTS - metas.length');
    assert.ok(guardAt >= 0, 'batch duplicate must guard its room check');
    assert.ok(roomAt > guardAt, 'the room computation must sit inside the non-disk guard');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.4 — single-report import lands on disk for disk users
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.4: import routing (processJsonData + conflict resolution)', () => {
  it('the backup-envelope refusal still precedes the disk branch', () => {
    const body = extractFnBody(indexHtml, 'async function processJsonData(data, opts)', 'processJsonData');
    const guardAt = body.indexOf('Array.isArray(data.reports)');
    const diskAt = body.indexOf('Connect a folder before importing a report');
    assert.ok(guardAt >= 0, 'the v4.8.1 envelope guard must remain');
    assert.ok(body.includes('This is a backup file — use Restore (JSON)'), 'the envelope refusal message must remain');
    assert.ok(diskAt > guardAt, 'the disk branch must come after the envelope guard');
  });

  it('without a connected folder a disk import aborts; with one, conflicts check the disk list', () => {
    const body = extractFnBody(indexHtml, 'async function processJsonData(data, opts)', 'processJsonData');
    assert.ok(body.includes('if (!fsDirHandle) {'), 'the no-folder abort must exist');
    assert.ok(body.includes('existingReports = await diskListMetas();'), 'conflicts must be checked against disk metas');
  });

  it('a fresh import is written to a new disk folder before the IDB working copy', () => {
    const body = extractFnBody(indexHtml, 'async function processJsonData(data, opts)', 'processJsonData');
    const diskAt = body.indexOf('diskPersistImportedReport(normalizedData, null)');
    const putAt = body.indexOf('await dbPut(normalizedData);');
    assert.ok(diskAt >= 0, 'import must persist through the disk writer');
    assert.ok(putAt > diskAt, 'the disk write must precede the working-copy dbPut');
    assert.ok(body.includes('normalizedData._diskFolder = importFolder;'), 'the working copy is stamped with its folder');
  });

  it('conflict Replace overwrites the existing disk folder', () => {
    const body = extractFnBody(indexHtml, 'async function applyImportData(data, isReplace)', 'applyImportData');
    assert.ok(body.includes('diskPersistImportedReport(normalizedData, pendingExistingReport._diskFolder)'),
      'Replace must target the folder of the report being replaced');
    assert.ok(body.includes('normalizedData._diskFolder = replacedFolder;'), 'the replaced working copy keeps its folder stamp');
  });

  it('conflict Copy creates a new disk folder for the copy', () => {
    const body = extractFnBody(indexHtml, 'async function applyImportData(data, isReplace)', 'applyImportData');
    assert.ok(body.includes('diskPersistImportedReport(normalizedData, null)'), 'Copy must create a fresh folder');
    assert.ok(body.includes('normalizedData._diskFolder = copiedFolder;'), 'the copy working copy is stamped with the new folder');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.5 — restore lands on disk, per report, with merge-by-id
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.5: restore routing (restoreDatabase)', () => {
  const body = extractFnBody(indexHtml, 'async function restoreDatabase(event)', 'restoreDatabase');

  it('a disk restore without a connected folder aborts with instructions', () => {
    assert.ok(body.includes('if (diskK1Active() && !fsDirHandle)'), 'the restore folder guard must exist');
    assert.ok(body.includes('Connect a folder before restoring a backup.'), 'the abort must tell the user to connect a folder');
  });

  it('each restored report is written as its own disk folder, reusing an existing folder for the same id', () => {
    assert.ok(body.includes('diskFindFolderNameById(normalizedRep.id)'), 'restore must look up the folder already holding the id');
    assert.ok(body.includes('diskPersistImportedReport(normalizedRep, restoreFolder)'), 'restore must write through the disk writer');
  });

  it('the per-report progress line is preserved', () => {
    assert.ok(body.includes('Report ${ri + 1}/${reportsToRestore.length}'), 'the progress card still reports Report i/N');
  });

  it('the non-disk restore path still merges into IndexedDB', () => {
    assert.ok(body.includes('await dbPut(normalizedRep);'), 'the IDB merge remains for non-disk users');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.6 — duplicating a disk report creates a new disk folder
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.6: duplicate routing (doDuplicateReport)', () => {
  const body = extractFnBody(indexHtml, 'async function doDuplicateReport(source)', 'doDuplicateReport');

  it('only disk reports in disk mode take the disk path', () => {
    assert.ok(body.includes('if (diskK1Active() && source._diskFolder)'), 'the disk branch must be gated on mode + disk origin');
  });

  it('the copy is persisted to a new folder and its working copy is stamped with it', () => {
    const diskAt = body.indexOf('diskPersistImportedReport(cloned, null)');
    const putAt = body.indexOf('await dbPut(cloned);');
    assert.ok(diskAt >= 0, 'duplicate must persist through the disk writer');
    assert.ok(putAt > diskAt, 'the disk write must precede the working-copy dbPut');
    assert.ok(body.includes('cloned._diskFolder = dupFolder;'), 'the copy is stamped with the NEW folder');
  });

  it('the K2 safety strip still runs before the new stamp is applied', () => {
    const stripAt = body.indexOf('delete cloned._diskFolder;');
    const stampAt = body.indexOf('cloned._diskFolder = dupFolder;');
    assert.ok(stripAt >= 0, 'the source folder stamp must still be stripped from the clone');
    assert.ok(stampAt > stripAt, 'the new folder stamp is applied only after the strip');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.7 — the K3 disk writer helpers
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.7: diskPersistImportedReport + diskFindFolderNameById', () => {
  it('the writer ensures permission, resolves collisions and writes via the K2 machinery', () => {
    const body = extractFnBody(indexHtml, 'async function diskPersistImportedReport(report, replaceFolderName)', 'diskPersistImportedReport');
    assert.ok(body.includes('fsEnsurePermission(fsDirHandle, true)'), 'the writer asks for permission interactively');
    assert.ok(body.includes('diskFolderNameForReport(report)'), 'new folders use the standard display name');
    assert.ok(body.includes('diskResolveFolderName(base, taken)'), 'new folder names are collision-suffixed');
    assert.ok(body.includes('diskWriteReport(report, folder)'), 'the write goes through the K2 writer');
    assert.ok(body.includes('if (!fsDirHandle)'), 'a missing folder handle returns null instead of throwing');
  });

  it('the id lookup scans the disk list and matches ids as strings', () => {
    const body = extractFnBody(indexHtml, 'async function diskFindFolderNameById(id)', 'diskFindFolderNameById');
    assert.ok(body.includes('fsListArchiveReports()'), 'the lookup scans the connected folder');
    assert.ok(body.includes('String(it.meta.id) === String(id)'), 'ids are compared as strings');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK3.8 — draft recovery reaches disk reports through openReport
// (requirement 6 evidence: no new wiring was needed)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK3.8: draft snapshot restore on the disk open path', () => {
  it('openDiskReport opens the working copy through the shared openReport', () => {
    const body = extractFnBody(indexHtml, 'async function openDiskReport(meta)', 'openDiskReport');
    assert.ok(body.includes('await openReport(payload.id);'), 'disk opens must funnel into openReport');
  });

  it('openReport runs the silent draft restore for every report it opens', () => {
    const body = extractFnBody(indexHtml, 'async function openReport(id)', 'openReport');
    assert.ok(body.includes('checkAndPromptDraftRestore(id, repData)'), 'openReport must apply the draft restore');
  });

  it('the draft restore itself is the silent snapshot merge', () => {
    const body = extractFnBody(indexHtml, 'async function checkAndPromptDraftRestore(id, dbRecord)', 'checkAndPromptDraftRestore');
    assert.ok(body.includes('restoreSnapshotIntoReport(dbRecord, snap.data)'), 'a newer snapshot is merged silently');
  });

  it('openDiskReport flags a pre-existing draft so K2 writes the restored state back to disk', () => {
    const body = extractFnBody(indexHtml, 'async function openDiskReport(meta)', 'openDiskReport');
    assert.ok(body.includes('getDraftSnapshot(payload.id)'), 'openDiskReport must detect the draft');
    assert.ok(body.includes('diskInitEditState(payload, hadDraft)'), 'the draft flag must reach the disk edit state');
  });
});
