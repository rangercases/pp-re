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
// Shared DISK K2 core: the pure naming / decision / dehydrate logic,
// evaluated with the app's real helpers (prefix + display name, the archive
// slot traversal, the photo hash) so the tests track production behavior.
// ─────────────────────────────────────────────────────────────────────────────
const prefixesSrc = extract(indexHtml, /const REPORT_FILE_PREFIXES = \{([\s\S]*?)\};/, 'REPORT_FILE_PREFIXES');
const displayNameBody = extractFnBody(indexHtml, 'function getReportDisplayName(r)', 'getReportDisplayName');
const filePrefixBody = extractFnBody(indexHtml, 'function getReportFilePrefix(rep)', 'getReportFilePrefix');
const photoKeysBody = extractFnBody(indexHtml, 'function fsPhotoKeys(rep)', 'fsPhotoKeys');
const collectSlotsBody = extractFnBody(indexHtml, 'function fsCollectSlots(rep)', 'fsCollectSlots');
const collectDocsBody = extractFnBody(indexHtml, 'function fsCollectDocRecords(rep)', 'fsCollectDocRecords');
const strongHashBody = extractFnBody(indexHtml, 'function photoStrongHash(value)', 'photoStrongHash');
const mimeBody = extractFnBody(indexHtml, 'function diskMimeOfDataUrl(dataUrl)', 'diskMimeOfDataUrl');
const extBody = extractFnBody(indexHtml, 'function diskExtForMime(mime)', 'diskExtForMime');
const photoNameBody = extractFnBody(indexHtml, 'function diskPhotoFileName(slotKey, fieldName, dataUrl)', 'diskPhotoFileName');
const sanitizeBody = extractFnBody(indexHtml, 'function diskSanitizeFolderName(name)', 'diskSanitizeFolderName');
const folderNameBody = extractFnBody(indexHtml, 'function diskFolderNameForReport(rep, dateObj)', 'diskFolderNameForReport');
const resolveNameBody = extractFnBody(indexHtml, 'function diskResolveFolderName(base, existingNames)', 'diskResolveFolderName');
const placeholderBody = extractFnBody(indexHtml, 'function diskFolderIsPlaceholder(folderName, prefix)', 'diskFolderIsPlaceholder');
const shouldRenameBody = extractFnBody(indexHtml, 'function diskShouldRenameFolder(folderName, rep)', 'diskShouldRenameFolder');
const mtimeBody = extractFnBody(indexHtml, 'function diskMtimeConflict(recorded, current)', 'diskMtimeConflict');
const dehydrateBody = extractFnBody(indexHtml, 'function diskDehydrateReport(report, prevFiles)', 'diskDehydrateReport');
const metaFromArchiveBody = extractFnBody(indexHtml, 'function diskMetaFromArchiveItem(item)', 'diskMetaFromArchiveItem');

function makeDisk2Api() {
  const factory = new Function(
    `const FREE_PHOTO_KEYS = ['prodPhotos', 'assemblyPhotos', 'watchoutPhotos', 'testingPhotos', 'checklistPhotos', 'comparisonPhotos', 'greenlabelPhotos'];
     const REPORT_FILE_PREFIXES = {${prefixesSrc}};
     function getReportDisplayName(r) {${displayNameBody}}
     function getReportFilePrefix(rep) {${filePrefixBody}}
     function fsPhotoKeys(rep) {${photoKeysBody}}
     function fsCollectSlots(rep) {${collectSlotsBody}}
     function fsCollectDocRecords(rep) {${collectDocsBody}}
     function photoStrongHash(value) {${strongHashBody}}
     function diskMimeOfDataUrl(dataUrl) {${mimeBody}}
     function diskExtForMime(mime) {${extBody}}
     function diskPhotoFileName(slotKey, fieldName, dataUrl) {${photoNameBody}}
     function diskSanitizeFolderName(name) {${sanitizeBody}}
     function diskFolderNameForReport(rep, dateObj) {${folderNameBody}}
     function diskResolveFolderName(base, existingNames) {${resolveNameBody}}
     function diskFolderIsPlaceholder(folderName, prefix) {${placeholderBody}}
     function diskShouldRenameFolder(folderName, rep) {${shouldRenameBody}}
     function diskMtimeConflict(recorded, current) {${mtimeBody}}
     function diskDehydrateReport(report, prevFiles) {${dehydrateBody}}
     function diskMetaFromArchiveItem(item) {${metaFromArchiveBody}}
     return { diskFolderNameForReport, diskResolveFolderName, diskFolderIsPlaceholder,
              diskShouldRenameFolder, diskMtimeConflict, diskDehydrateReport,
              diskMetaFromArchiveItem, photoStrongHash, fsCollectSlots, fsCollectDocRecords };`
  );
  return factory();
}

const api = makeDisk2Api();

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK2.1 — folder naming (v4.4.1 rules) + collision suffixing
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK2.1: diskFolderNameForReport + diskResolveFolderName', () => {
  it('names the folder prefix + Model · Description', () => {
    assert.equal(
      api.diskFolderNameForReport({ moduleType: 'prototype', model: 'MD 2756 Ricardo', desc: 'Side Table' }),
      'PSR MD 2756 Ricardo · Side Table'
    );
    assert.equal(
      api.diskFolderNameForReport({ moduleType: 'pre-production', model: 'MD 2754 Komo', desc: 'Coffee Table' }),
      'PPSR MD 2754 Komo · Coffee Table'
    );
    assert.equal(
      api.diskFolderNameForReport({ moduleType: 'prototype', model: 'MD 2756 Ricardo', desc: '' }),
      'PSR MD 2756 Ricardo'
    );
  });

  it('falls back to the Untitled placeholder (prefix + ISO date) while Model is empty', () => {
    const d = new Date(2026, 10, 18); // 2026-11-18 local
    assert.equal(
      api.diskFolderNameForReport({ moduleType: 'sample-review-recap', model: '', desc: '' }, d),
      'SRR Untitled · 2026-11-18'
    );
    assert.equal(
      api.diskFolderNameForReport({ moduleType: 'prototype', model: '   ' }, d),
      'PSR Untitled · 2026-11-18'
    );
  });

  it('strips characters that are illegal in folder names', () => {
    const name = api.diskFolderNameForReport({ moduleType: 'prototype', model: 'MD 2756: Ricardo?', desc: 'Side/Table' });
    assert.ok(!/[\\\/:*?"<>|]/.test(name), `folder name must be filesystem-safe, got: ${name}`);
    assert.ok(name.startsWith('PSR MD 2756- Ricardo-'), `unexpected sanitized name: ${name}`);
  });

  it('collision suffixing follows the OS convention', () => {
    assert.equal(api.diskResolveFolderName('A', new Set()), 'A');
    assert.equal(api.diskResolveFolderName('A', new Set(['A'])), 'A (2)');
    assert.equal(api.diskResolveFolderName('A', new Set(['A', 'A (2)'])), 'A (3)');
    assert.equal(api.diskResolveFolderName('A', ['A', 'A (2)', 'A (3)']), 'A (4)');
    assert.equal(api.diskResolveFolderName('B', new Set(['A'])), 'B');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK2.2 — rename-once decision (design C2)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK2.2: diskShouldRenameFolder — rename once, when Model first lands', () => {
  it('renames a placeholder folder once the report has a Model', () => {
    assert.equal(
      api.diskShouldRenameFolder('PSR Untitled · 2026-11-18', { moduleType: 'prototype', model: 'MD 1', desc: '' }),
      true
    );
  });

  it('does not rename while Model is still empty', () => {
    assert.equal(
      api.diskShouldRenameFolder('PSR Untitled · 2026-11-18', { moduleType: 'prototype', model: '', desc: 'Table' }),
      false
    );
  });

  it('never renames a folder that already carries a real name', () => {
    assert.equal(
      api.diskShouldRenameFolder('PSR MD 1', { moduleType: 'prototype', model: 'MD 2', desc: '' }),
      false
    );
  });

  it('a placeholder from another module does not match', () => {
    assert.equal(
      api.diskShouldRenameFolder('PPSR Untitled · 2026-11-18', { moduleType: 'prototype', model: 'MD 1', desc: '' }),
      false
    );
  });

  it('placeholder detection requires the exact Untitled · YYYY-MM-DD shape', () => {
    assert.equal(api.diskFolderIsPlaceholder('PSR Untitled · 2026-11-18', 'PSR'), true);
    assert.equal(api.diskFolderIsPlaceholder('PSR Untitled · 18-11-2026', 'PSR'), false);
    assert.equal(api.diskFolderIsPlaceholder('PSR Untitled report', 'PSR'), false);
    assert.equal(api.diskFolderIsPlaceholder('', 'PSR'), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK2.3 — mtime conflict decision
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK2.3: diskMtimeConflict — never overwrite an outside change silently', () => {
  it('same mtime is not a conflict', () => {
    assert.equal(api.diskMtimeConflict(100, 100), false);
  });

  it('any different mtime is a conflict (newer OR older — the file was replaced)', () => {
    assert.equal(api.diskMtimeConflict(100, 200), true);
    assert.equal(api.diskMtimeConflict(100, 50), true);
  });

  it('no baseline yet (first write after open) is not a conflict', () => {
    assert.equal(api.diskMtimeConflict(0, 200), false);
  });

  it('a vanished file is not a conflict (the write recreates it)', () => {
    assert.equal(api.diskMtimeConflict(100, 0), false);
    assert.equal(api.diskMtimeConflict(0, 0), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK2.4 — dehydrate: the write format is exactly what the readers eat
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK2.4: diskDehydrateReport — manifest shape + round-trip', () => {
  const rep = {
    id: 'r-200',
    moduleType: 'prototype',
    reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
    model: 'MD 2756 Ricardo',
    desc: 'Side Table',
    date: '18-Nov-26',
    _diskFolder: 'PSR MD 2756 Ricardo · Side Table',
    _diskName: 'FASREP',
    coverPhotos: { main: { img: 'data:image/jpeg;base64,AAAA', original: 'data:image/png;base64,BBBB' } },
    watchoutPhotos: [{ id: 'w1', img: 'data:image/webp;base64,CCCC', caption: 'Crack' }],
    dimensions: [{ id: 'd1', img: null, imgSub: 'data:image/jpeg;base64,DDDD' }],
    docAttachments: [{ id: 'doc1', data: 'data:application/pdf;base64,EEEE', name: 'spec.pdf' }]
  };
  const plan = api.diskDehydrateReport(rep, {});

  it('replaces photo fields with { f } refs and mirrors them in the manifest', () => {
    assert.deepEqual(plan.json.coverPhotos.main.img, { f: 'cover-main-img.jpg' });
    assert.deepEqual(plan.json.coverPhotos.main.original, { f: 'cover-main-original.png' });
    assert.deepEqual(plan.json.watchoutPhotos[0].img, { f: 'free-watchoutPhotos-w1-img.webp' });
    assert.deepEqual(plan.json.dimensions[0].imgSub, { f: 'dim-d1-imgSub.jpg' });
    assert.deepEqual(plan.json.docAttachments[0].data, { f: 'doc-doc1-data.pdf' });
    assert.equal(plan.json.dimensions[0].img, null, 'empty fields stay empty');
    assert.deepEqual(Object.keys(plan.files).sort(), ['cover:main', 'dim:d1', 'doc:doc1', 'free:watchoutPhotos:w1']);
    assert.equal(plan.files['cover:main'].img.h, api.photoStrongHash('data:image/jpeg;base64,AAAA'));
  });

  it('every manifest ref matches the ref stored in the JSON (the fsHydratePayload invariant)', () => {
    const slots = api.fsCollectSlots(plan.json).concat(api.fsCollectDocRecords(plan.json));
    for (const slot of slots) {
      const info = plan.files[slot.key];
      for (const name of slot.names) {
        const v = slot.rec[name];
        if (info && info[name]) {
          assert.deepEqual(v, { f: info[name].f }, `${slot.key}.${name} must carry its manifest ref`);
        } else {
          assert.ok(!(v && typeof v === 'object' && typeof v.f === 'string'), `${slot.key}.${name} must not carry a stray ref`);
        }
      }
    }
  });

  it('strips runtime stamps, keeps a savedAt, and plans one write per filled field', () => {
    assert.equal(plan.json._diskFolder, undefined);
    assert.equal(plan.json._diskName, undefined);
    assert.equal(typeof plan.json._archive.savedAt, 'string');
    assert.equal(plan.writes.length, 5);
    assert.deepEqual(plan.deletes, []);
  });

  it('does not mutate the live report', () => {
    assert.equal(rep.coverPhotos.main.img, 'data:image/jpeg;base64,AAAA');
    assert.equal(rep._diskFolder, 'PSR MD 2756 Ricardo · Side Table');
  });

  it('round-trip: re-dehydrating the hydrated form against the manifest is a no-op', () => {
    const again = api.diskDehydrateReport(rep, plan.files);
    assert.deepEqual(again.writes, []);
    assert.deepEqual(again.deletes, []);
    assert.deepEqual(again.files, plan.files);
  });

  it('one changed photo rewrites exactly that file', () => {
    const changed = JSON.parse(JSON.stringify(rep));
    changed.watchoutPhotos[0].img = 'data:image/webp;base64,ZZZZ';
    const p2 = api.diskDehydrateReport(changed, plan.files);
    assert.equal(p2.writes.length, 1);
    assert.equal(p2.writes[0].name, 'free-watchoutPhotos-w1-img.webp');
    assert.deepEqual(p2.deletes, []);
  });

  it('one removed photo deletes exactly its file and drops its manifest entry', () => {
    const removed = JSON.parse(JSON.stringify(rep));
    removed.dimensions[0].imgSub = null;
    const p3 = api.diskDehydrateReport(removed, plan.files);
    assert.deepEqual(p3.writes, []);
    assert.deepEqual(p3.deletes, ['dim-d1-imgSub.jpg']);
    assert.equal(p3.files['dim:d1'], undefined);
  });

  it('the K1 list mapping reads the dehydrated form back (photoCount survives)', () => {
    const meta = api.diskMetaFromArchiveItem({ name: 'PSR MD 2756 Ricardo · Side Table', meta: plan.json });
    assert.equal(meta.id, 'r-200');
    assert.equal(meta.photoCount, 4);
    assert.equal(meta._diskFolder, 'PSR MD 2756 Ricardo · Side Table');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK2.5 — wiring pins
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK2.5: disk K2 wiring in index.html', () => {
  it('the save-state element exists in the topbar next to the classic one', () => {
    assert.ok(indexHtml.includes('id="diskSaveState"'), 'disk save state element must exist');
    assert.ok(indexHtml.includes('onclick="diskSaveStateClicked()"'), 'the failed state retries on tap');
    assert.ok(indexHtml.includes('Save failed — tap to retry'), 'the failed state copy exists');
  });

  it('content changes schedule the 3s-debounced disk save from the snapshot change points', () => {
    const asBody = extractFnBody(indexHtml, 'function as()', 'as');
    assert.ok(asBody.includes('diskScheduleSave()'), 'as() schedules a disk save');
    const photoBody = extractFnBody(indexHtml, 'function savePhotoChangeNow()', 'savePhotoChangeNow');
    assert.ok(photoBody.includes('diskScheduleSave()'), 'photo changes schedule a disk save');
    const schedBody = extractFnBody(indexHtml, 'function diskScheduleSave()', 'diskScheduleSave');
    assert.ok(schedBody.includes('3000'), 'the debounce is 3 seconds');
    assert.ok(schedBody.includes('diskRunSave(false)'), 'the debounce runs a non-interactive save');
  });

  it('flush points flush the disk write (editor exit + Ctrl+S)', () => {
    const flushBody = extractFnBody(indexHtml, 'async function flushReport()', 'flushReport');
    assert.ok(flushBody.includes('await diskFlushSave(false)'), 'flushReport flushes pending disk writes');
    const shortcutBody = extractFnBody(indexHtml, 'function fileSaveShortcut()', 'fileSaveShortcut');
    assert.ok(shortcutBody.includes('diskEditStateForCurrent()'), 'Ctrl+S checks for a disk report first');
    assert.ok(shortcutBody.includes('diskFlushSave(true)'), 'Ctrl+S flushes the disk write interactively');
  });

  it('the autosave is gated on disk mode and the open report being a disk report', () => {
    const gateBody = extractFnBody(indexHtml, 'function diskEditStateForCurrent()', 'diskEditStateForCurrent');
    assert.ok(gateBody.includes('diskK1Active()'), 'disk writes stay behind the K1 gate');
    assert.ok(gateBody.includes('D._diskFolder'), 'only stamped disk reports write to disk');
  });

  it('the save path is mtime-guarded, keeps one .bak, and clears the covered draft snapshot', () => {
    const onceBody = extractFnBody(indexHtml, 'async function diskSaveOnce(interactive)', 'diskSaveOnce');
    assert.ok(onceBody.includes('diskMtimeConflict(st.mtime, cur)'), 'writes check the mtime guard first');
    assert.ok(onceBody.includes('Overwrite with my version'), 'conflict offers the overwrite choice');
    assert.ok(onceBody.includes('Reload from disk'), 'conflict offers the reload choice');
    assert.ok(onceBody.includes('clearDraftSnapshot(D.id, revAtStart)'), 'a landed save clears the covered snapshot (mirrors executeSave)');
    assert.ok(onceBody.includes('diskShouldRenameFolder(st.folderName, D)'), 'writes attempt the rename-once first');
    const writeBody = extractFnBody(indexHtml, 'async function diskWriteReport(report, folderHandle)', 'diskWriteReport');
    assert.ok(writeBody.includes('diskDehydrateReport(report, prevFiles)'), 'writes dehydrate against the previous manifest');
    assert.ok(writeBody.includes("'report.json.bak'"), 'the previous report.json is preserved as .bak');
    assert.ok(writeBody.includes("getDirectoryHandle('photos', { create: true })"), 'photos land in the photos/ subfolder');
  });

  it('opening a damaged report.json falls back to the .bak copy', () => {
    const openBody = extractFnBody(indexHtml, 'async function openDiskReport(meta)', 'openDiskReport');
    assert.ok(openBody.includes("diskReadJsonFile(folder, 'report.json.bak')"), 'open tries the .bak copy');
    assert.ok(openBody.includes('Recovered from the backup copy'), 'the recovery is announced');
    assert.ok(openBody.includes('diskInitEditState(payload, hadDraft)'), 'open initialises the K2 edit state');
  });

  it('NEW REPORT creates the folder on disk and never an IDB-only report', () => {
    const newBody = extractFnBody(indexHtml, 'async function newReport()', 'newReport');
    assert.ok(newBody.includes('diskCreateReportFolder(r)'), 'creation writes the folder first');
    assert.ok(newBody.includes('Connect a folder before creating a report'), 'no folder → no creation');
    const uiBody = extractFnBody(indexHtml, 'function renderDiskFolderUi(connected)', 'renderDiskFolderUi');
    assert.ok(uiBody.includes('newBtn.disabled = !connected'), 'NEW REPORT is disabled until the folder is connected');
  });

  it('delete moves the folder to _Trash and every list scan skips _Trash', () => {
    const trashBody = extractFnBody(indexHtml, 'async function diskTrashReport(meta)', 'diskTrashReport');
    assert.ok(trashBody.includes("getDirectoryHandle('_Trash', { create: true })"), 'delete targets the _Trash subfolder');
    assert.ok(trashBody.includes('diskCopyFolderTree(src, dest)'), 'the folder is moved, not removed');
    assert.ok(trashBody.includes('dbDelete(meta.id)'), 'the working copy is dropped too');
    const listBody = extractFnBody(indexHtml, 'async function fsListArchiveReports()', 'fsListArchiveReports');
    assert.ok(listBody.includes("name === '_Trash'"), 'list scans skip _Trash');
    const homeBody = extractFnBody(indexHtml, 'async function renderHome()', 'renderHome');
    assert.ok(homeBody.includes('diskTrashReport(r)'), 'row delete routes disk reports to _Trash');
    assert.ok(homeBody.includes('diskHydrateThen(r,'), 'row share/duplicate hydrate unopened disk reports first');
    const batchBody = extractFnBody(indexHtml, 'async function deleteSelectedReports()', 'deleteSelectedReports');
    assert.ok(batchBody.includes('diskTrashReport(diskMeta)'), 'batch delete routes disk reports to _Trash');
  });

  it('duplicates and loose-file exports never carry the disk stamps', () => {
    const dupBody = extractFnBody(indexHtml, 'async function doDuplicateReport(source)', 'doDuplicateReport');
    assert.ok(dupBody.includes('delete cloned._diskFolder;'), 'a duplicate must not point at the source folder');
    const blobBody = extractFnBody(indexHtml, 'function fileBuildBlob(rep)', 'fileBuildBlob');
    assert.ok(blobBody.includes('delete copy._diskFolder;'), 'exported JSON drops the runtime disk stamps');
  });
});
