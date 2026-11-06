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

// Matches a *native* confirm( call — not the in-app appConfirm(.
const NATIVE_CONFIRM = /(^|[^A-Za-z])confirm\(/;

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP1 — checkAndPromptDraftRestore: silent restore (P1)
// ─────────────────────────────────────────────────────────────────────────────
const draftRestoreBody = extract(
  indexHtml,
  /async function checkAndPromptDraftRestore\(id, dbRecord\) \{([\s\S]*?)\n    \}/,
  'checkAndPromptDraftRestore'
);

function makeDraftRestore({ snap }) {
  const calls = { confirm: 0, clear: [], restore: [], save: [], toast: [] };
  const fn = new Function(
    'getDraftSnapshot', 'clearDraftSnapshot', 'restoreSnapshotIntoReport', 'saveReportSafe', 'showToast', 'L', 'confirm',
    `return (async function checkAndPromptDraftRestore(id, dbRecord) {${draftRestoreBody}\n  })`
  )(
    () => snap,
    (id) => { calls.clear.push(id); },
    (dbRecord, snapData) => {
      calls.restore.push({ dbRecord, snapData });
      return makeDraftRestore.nextRestore;
    },
    async (report) => { calls.save.push(report); },
    (msg) => { calls.toast.push(msg); },
    (vi, en) => en,
    () => { calls.confirm++; return true; }
  );
  return { fn, calls };
}

describe('TC-POP1: newer draft snapshots restore silently, with no native confirm (P1)', () => {
  it('TC-POP1.1: the function body has no native confirm( and still restores via restoreSnapshotIntoReport', () => {
    assert.ok(!NATIVE_CONFIRM.test(draftRestoreBody), 'checkAndPromptDraftRestore must not call native confirm()');
    assert.match(draftRestoreBody, /restoreSnapshotIntoReport\(dbRecord, snap\.data\)/);
    assert.match(draftRestoreBody, /saveReportSafe\(restored\)/);
  });

  it('TC-POP1.2: no snapshot → DB record returned untouched', async () => {
    const { fn, calls } = makeDraftRestore({ snap: null });
    const dbRecord = { id: 'r1', updatedAt: 1000 };
    const out = await fn('r1', dbRecord);
    assert.equal(out, dbRecord);
    assert.equal(calls.restore.length, 0);
    assert.equal(calls.confirm, 0);
  });

  it('TC-POP1.3: stale snapshot (older than the DB record) is cleared, DB record kept', async () => {
    const { fn, calls } = makeDraftRestore({ snap: { savedAt: 500, data: { model: 'old' } } });
    const dbRecord = { id: 'r1', updatedAt: 1000 };
    const out = await fn('r1', dbRecord);
    assert.equal(out, dbRecord);
    assert.deepEqual(calls.clear, ['r1']);
    assert.equal(calls.restore.length, 0);
    assert.equal(calls.confirm, 0);
  });

  it('TC-POP1.4: newer snapshot restores automatically, saves, and only toasts (with the draft time)', async () => {
    const savedAt = Date.now() - 5 * 60 * 1000;
    const restored = { id: 'r1', model: 'from-draft' };
    makeDraftRestore.nextRestore = { report: restored, hadMismatches: false };
    const { fn, calls } = makeDraftRestore({ snap: { savedAt, data: { model: 'from-draft' } } });
    const dbRecord = { id: 'r1', updatedAt: savedAt - 60000 };
    const out = await fn('r1', dbRecord);
    assert.equal(calls.confirm, 0, 'no dialog may fire');
    assert.equal(calls.restore.length, 1);
    assert.equal(calls.restore[0].dbRecord, dbRecord);
    assert.deepEqual(calls.save, [restored]);
    assert.equal(out, restored);
    assert.ok(restored.updatedAt >= savedAt, 'restored report is stamped fresh');
    const timeStr = new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    assert.deepEqual(calls.toast, ['✓ Draft from ' + timeStr + ' restored']);
  });

  it('TC-POP1.5: photo-list mismatch keeps the verbatim warning toast', async () => {
    const savedAt = Date.now();
    makeDraftRestore.nextRestore = { report: { id: 'r1' }, hadMismatches: true };
    const { fn, calls } = makeDraftRestore({ snap: { savedAt, data: {} } });
    await fn('r1', { id: 'r1', updatedAt: savedAt - 1000 });
    assert.deepEqual(calls.toast, ['⚠️ Text content restored. Some photo lists changed in length, so existing photos were kept.']);
    assert.equal(calls.confirm, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP2 — beforeunload gates on the real pending/in-flight save state (P2)
// ─────────────────────────────────────────────────────────────────────────────
const beforeUnloadSrc = extract(
  indexHtml,
  /(window\.addEventListener\('beforeunload', \(e\) => \{[\s\S]*?\n    \}\);)/,
  'beforeunload listener'
);

function makeBeforeUnload({ pending = null, inflight = null } = {}) {
  const calls = { sync: 0, flush: 0 };
  let handler = null;
  const windowStub = { addEventListener: (name, fn) => { if (name === 'beforeunload') handler = fn; } };
  const register = new Function(
    'window', 'pendingSavePayload', 'saveInFlightPromise', 'syncReportFieldsFromDOM', 'emergencyFlush',
    beforeUnloadSrc
  );
  register(windowStub, pending, inflight, () => { calls.sync++; }, () => { calls.flush++; });
  assert.ok(handler, 'beforeunload handler must be registered');
  const fire = () => {
    const e = { prevented: false, returnValue: undefined, preventDefault() { this.prevented = true; } };
    handler(e);
    return e;
  };
  return { fire, calls };
}

describe('TC-POP2: beforeunload only blocks on a genuinely unsaved state (P2)', () => {
  it('TC-POP2.1: the listener no longer references _fileDirty and uses the scheduler state', () => {
    assert.ok(!beforeUnloadSrc.includes('_fileDirty'), 'beforeunload must not gate on _fileDirty (export state, not save state)');
    assert.match(beforeUnloadSrc, /pendingSavePayload/);
    assert.match(beforeUnloadSrc, /saveInFlightPromise/);
    assert.match(beforeUnloadSrc, /emergencyFlush\(\)/);
  });

  it('TC-POP2.2: nothing pending → no prompt, but emergencyFlush still runs', () => {
    const { fire, calls } = makeBeforeUnload({});
    const e = fire();
    assert.equal(e.prevented, false);
    assert.equal(calls.sync, 0);
    assert.equal(calls.flush, 1, 'emergencyFlush stays unconditional');
  });

  it('TC-POP2.3: a queued payload blocks the unload (and syncs fields from the DOM first)', () => {
    const { fire, calls } = makeBeforeUnload({ pending: { id: 'r1' } });
    const e = fire();
    assert.equal(e.prevented, true);
    assert.equal(e.returnValue, '');
    assert.equal(calls.sync, 1);
    assert.equal(calls.flush, 1);
  });

  it('TC-POP2.4: an in-flight save blocks the unload', () => {
    const { fire, calls } = makeBeforeUnload({ inflight: Promise.resolve() });
    const e = fire();
    assert.equal(e.prevented, true);
    assert.equal(calls.flush, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP3 — goHome has no confirm; it just flushes and leaves (P3)
// ─────────────────────────────────────────────────────────────────────────────
const goHomeBody = extract(
  indexHtml,
  /async function goHome\(opts\) \{([\s\S]*?)\n    \}/,
  'goHome'
);

function makeEl() {
  return { classList: { add() {}, remove() {}, contains: () => false }, style: {} };
}

function makeGoHome({ flushReport }) {
  const calls = { confirm: 0, flush: 0, toast: [] };
  const documentStub = {
    body: makeEl(),
    getElementById: () => makeEl(),
  };
  const trackedFlush = async () => { calls.flush++; return flushReport(); };
  const fn = new Function(
    'document', 'flushReport', 'D', 'currentId', 'curSec', 'fileUpdateDot', 'MODULE_THEMES',
    'currentActiveModule', 'resetHistory', 'renderHome', 'showToast', 'confirm',
    `return (async function goHome(opts) {${goHomeBody}\n  })`
  )(
    documentStub,
    trackedFlush,
    { id: 'r1', _fileDirty: true },
    'r1',
    0,
    () => {},
    {},
    null,
    () => {},
    async () => {},
    (msg) => { calls.toast.push(msg); },
    () => { calls.confirm++; return false; }
  );
  return { fn, calls };
}

describe('TC-POP3: goHome never asks — the in-app copy is always kept (P3)', () => {
  it('TC-POP3.1: the function body has no native confirm( and still flushes', () => {
    assert.ok(!NATIVE_CONFIRM.test(goHomeBody), 'goHome must not call native confirm()');
    assert.ok(!goHomeBody.includes('Report not saved to file yet'), 'the old prompt copy is gone');
    assert.match(goHomeBody, /await flushReport\(\)/);
  });

  it('TC-POP3.2: leaving works even when the report was never exported to a file', async () => {
    const { fn, calls } = makeGoHome({ flushReport: async () => {} });
    const ok = await fn({});
    assert.equal(ok, true, 'goHome must proceed (its boolean contract is kept)');
    assert.equal(calls.confirm, 0, 'no dialog may fire — even though _fileDirty is set');
    assert.equal(calls.flush, 1, 'the pending save is flushed on the way out');
  });

  it('TC-POP3.3: a failed flush keeps the user in the editor with a toast', async () => {
    const { fn, calls } = makeGoHome({ flushReport: async () => { throw new Error('idb gone'); } });
    const ok = await fn({});
    assert.equal(ok, false);
    assert.equal(calls.toast.length, 1);
    assert.match(calls.toast[0], /Could not save report/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP4 — multi-tab conflict guard uses appConfirm (P4)
// ─────────────────────────────────────────────────────────────────────────────
const executeSaveBody = extract(
  indexHtml,
  /async function executeSave\(payload\) \{([\s\S]*?)\n    \}/,
  'executeSave'
);

// The guard only runs when payload === D, so the factory binds a real report
// object as D and keeps the C-05 state (knownDbUpdatedAt / conflictDeclinedFor)
// in scope so multi-call behaviour can be observed.
function makeGuardedSave({ knownDbUpdatedAt, stored, confirmAnswer }) {
  const calls = { appConfirm: [], dbGet: 0, dbPut: [], toast: [], unsaved: 0, saved: 0 };
  const D = { id: 'r1' };
  const factory = new Function(
    'D', 'dbGet', 'dbPut', 'appConfirm', 'L', 'showToast', 'saveStateUnsaved', 'saveStateSaved',
    'clearDraftSnapshot', 'hideQuotaErrorBanner', 'updateTopbar', 'showQuotaErrorBanner',
    `
    let knownDbUpdatedAt = ${knownDbUpdatedAt};
    let conflictDeclinedFor = 0;
    let lastSavedRevision = 0;
    let isDirty = true;
    const dataRevision = 0;
    async function executeSave(payload) {${executeSaveBody}}
    return {
      executeSave,
      D,
      getConflictDeclinedFor: () => conflictDeclinedFor,
      getKnownDbUpdatedAt: () => knownDbUpdatedAt
    };`
  );
  const api = factory(
    D,
    async () => { calls.dbGet++; return stored; },
    async (payload) => { calls.dbPut.push(payload); },
    async (message, opts) => { calls.appConfirm.push({ message, opts }); return confirmAnswer; },
    (vi, en) => en,
    (msg) => { calls.toast.push(msg); },
    () => { calls.unsaved++; },
    () => { calls.saved++; },
    () => {},
    () => {},
    () => {},
    async () => {}
  );
  return { api, calls };
}

describe('TC-POP4: multi-tab conflict asks via appConfirm, not native confirm (P4)', () => {
  it('TC-POP4.1: executeSave has no native confirm( in the conflict guard and calls appConfirm', () => {
    assert.ok(!NATIVE_CONFIRM.test(executeSaveBody), 'executeSave must not call native confirm()');
    assert.match(executeSaveBody, /await appConfirm\(/);
    assert.match(executeSaveBody, /title: 'Report changed in another tab'/);
    assert.match(executeSaveBody, /confirmLabel: 'Overwrite anyway'/);
    assert.match(executeSaveBody, /cancelLabel: "Don't save"/);
  });

  it('TC-POP4.2: decline → no dbPut, paused toast, decline remembered (not asked twice)', async () => {
    const stored = { id: 'r1', updatedAt: 5000 };
    const { api, calls } = makeGuardedSave({ knownDbUpdatedAt: 1000, stored, confirmAnswer: false });
    await api.executeSave(api.D);
    assert.equal(calls.appConfirm.length, 1);
    assert.equal(calls.appConfirm[0].opts.title, 'Report changed in another tab');
    assert.equal(calls.appConfirm[0].opts.confirmLabel, 'Overwrite anyway');
    assert.equal(calls.appConfirm[0].opts.cancelLabel, "Don't save");
    assert.match(calls.appConfirm[0].message, /OVERWRITE/);
    assert.equal(calls.dbPut.length, 0, 'declined save must not reach dbPut');
    assert.deepEqual(calls.toast, ['⚠ Save paused: this report was changed in another tab']);
    assert.equal(calls.unsaved, 1);
    assert.equal(api.getConflictDeclinedFor(), 5000);

    await api.executeSave(api.D);
    assert.equal(calls.appConfirm.length, 1, 'the same DB version is not asked about again');
    assert.equal(calls.dbPut.length, 0);
  });

  it('TC-POP4.3: accept → the save falls through to dbPut and knownDbUpdatedAt advances', async () => {
    const stored = { id: 'r1', updatedAt: 5000 };
    const { api, calls } = makeGuardedSave({ knownDbUpdatedAt: 1000, stored, confirmAnswer: true });
    await api.executeSave(api.D);
    assert.equal(calls.appConfirm.length, 1);
    assert.equal(calls.dbPut.length, 1);
    assert.equal(api.getKnownDbUpdatedAt(), api.D.updatedAt);
    assert.equal(calls.saved, 1);
  });

  it('TC-POP4.4: no conflict (DB not newer) → guard stays silent, save proceeds', async () => {
    const stored = { id: 'r1', updatedAt: 1000 };
    const { api, calls } = makeGuardedSave({ knownDbUpdatedAt: 1000, stored, confirmAnswer: false });
    await api.executeSave(api.D);
    assert.equal(calls.appConfirm.length, 0);
    assert.equal(calls.dbPut.length, 1);
  });

  it('TC-POP4.5: guard disabled when this tab never recorded a DB version (knownDbUpdatedAt = 0)', async () => {
    const stored = { id: 'r1', updatedAt: 9999 };
    const { api, calls } = makeGuardedSave({ knownDbUpdatedAt: 0, stored, confirmAnswer: false });
    await api.executeSave(api.D);
    assert.equal(calls.dbGet, 0, 'dbGet is not even consulted');
    assert.equal(calls.appConfirm.length, 0);
    assert.equal(calls.dbPut.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP5 — report-limit handler uses appConfirm (P5)
// ─────────────────────────────────────────────────────────────────────────────
const limitHandlerBody = extract(
  indexHtml,
  /async function handleReportLimitReached\(\) \{([\s\S]*?)\n    \}/,
  'handleReportLimitReached'
);

function makeLimitHandler({ confirmAnswer, homeActive = true, isSelectMode = false }) {
  const calls = { appConfirm: [], backup: 0, toast: [], toggleSelect: 0 };
  const documentStub = {
    getElementById: (id) => (id === 'homeScreen'
      ? { classList: { contains: (cls) => homeActive && cls === 'active' } }
      : null),
  };
  const fn = new Function(
    'appConfirm', 'L', 'MAX_LOCAL_REPORTS', 'backupDatabase', 'showToast', 'document', 'isSelectMode', 'toggleSelectMode',
    `return (async function handleReportLimitReached() {${limitHandlerBody}\n  })`
  )(
    async (message, opts) => { calls.appConfirm.push({ message, opts }); return confirmAnswer; },
    (vi, en) => en,
    10,
    async () => { calls.backup++; },
    (msg) => { calls.toast.push(msg); },
    documentStub,
    isSelectMode,
    () => { calls.toggleSelect++; }
  );
  return { fn, calls };
}

describe('TC-POP5: report-limit prompt is an appConfirm with named buttons (P5)', () => {
  it('TC-POP5.1: the handler has no native confirm( and calls appConfirm with named buttons', () => {
    assert.ok(!NATIVE_CONFIRM.test(limitHandlerBody), 'handleReportLimitReached must not call native confirm()');
    assert.match(limitHandlerBody, /await appConfirm\(/);
    assert.match(limitHandlerBody, /title: 'Report limit reached'/);
    assert.match(limitHandlerBody, /confirmLabel: 'Export backup now'/);
    assert.match(limitHandlerBody, /cancelLabel: 'Not now'/);
  });

  it('TC-POP5.2: accepting exports a backup; the follow-up toast and select-mode nudge still happen', async () => {
    const { fn, calls } = makeLimitHandler({ confirmAnswer: true });
    await fn();
    assert.equal(calls.appConfirm.length, 1);
    assert.match(calls.appConfirm[0].message, /maximum of 10 reports/);
    assert.equal(calls.backup, 1);
    assert.deepEqual(calls.toast, ['Limit reached: 10 reports — back up and delete some']);
    assert.equal(calls.toggleSelect, 1, 'home-screen select mode is nudged on as before');
  });

  it('TC-POP5.3: declining skips the backup but keeps the toast and the nudge', async () => {
    const { fn, calls } = makeLimitHandler({ confirmAnswer: false });
    await fn();
    assert.equal(calls.backup, 0);
    assert.equal(calls.toast.length, 1);
    assert.equal(calls.toggleSelect, 1);
  });

  it('TC-POP5.4: no select-mode nudge when select mode is already on', async () => {
    const { fn, calls } = makeLimitHandler({ confirmAnswer: false, isSelectMode: true });
    await fn();
    assert.equal(calls.toggleSelect, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-POP6 — the removed native copy is gone from the whole file
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-POP6: POP-1 removed copy no longer exists anywhere in index.html', () => {
  it('TC-POP6.1: old native-dialog strings are gone', () => {
    assert.ok(!indexHtml.includes('Found an unsaved draft'), 'draft prompt copy removed');
    assert.ok(!indexHtml.includes('Restore the text content from it?'), 'draft prompt copy removed');
    assert.ok(!indexHtml.includes('Report not saved to file yet'), 'goHome prompt copy removed');
    assert.ok(!indexHtml.includes('The app has reached its limit of'), 'limit prompt copy removed');
    assert.ok(!indexHtml.includes('OK = Overwrite anyway'), 'conflict prompt copy removed');
    assert.ok(!indexHtml.includes('OK = Export a JSON backup now'), 'limit prompt copy removed');
    assert.ok(!indexHtml.includes('OK = Go home (the in-app copy is kept)'), 'goHome prompt copy removed');
  });

  it('TC-POP6.2: new dialog titles and buttons have Vietnamese I18N pairs', () => {
    assert.match(indexHtml, /\['Báo cáo đã bị thay đổi ở tab khác', 'Report changed in another tab'\]/);
    assert.match(indexHtml, /\['Vẫn ghi đè', 'Overwrite anyway'\]/);
    assert.match(indexHtml, /\['Không lưu', "Don't save"\]/);
    assert.match(indexHtml, /\['Đã đạt giới hạn báo cáo', 'Report limit reached'\]/);
    assert.match(indexHtml, /\['Xuất bản sao lưu ngay', 'Export backup now'\]/);
    assert.match(indexHtml, /\['Để sau', 'Not now'\]/);
  });
});
