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
// Shared DISK K1 core: gate + meta mapping, evaluated with stubs.
// fsPhotoKeys/fsCollectSlots are the app's real slot traversal (the mapping's
// fallback photo count walks the same slots the archive writer used).
// ─────────────────────────────────────────────────────────────────────────────
const gateBody = extractFnBody(indexHtml, 'function diskK1Active()', 'diskK1Active');
const mapBody = extractFnBody(indexHtml, 'function diskMetaFromArchiveItem(item)', 'diskMetaFromArchiveItem');
const photoKeysBody = extractFnBody(indexHtml, 'function fsPhotoKeys(rep)', 'fsPhotoKeys');
const collectSlotsBody = extractFnBody(indexHtml, 'function fsCollectSlots(rep)', 'fsCollectSlots');

function makeDiskApi(fsSupportedStub) {
  const factory = new Function(
    'fsSupported',
    `let currentUser = null;
     const FREE_PHOTO_KEYS = ['prodPhotos', 'assemblyPhotos', 'watchoutPhotos', 'testingPhotos', 'checklistPhotos', 'comparisonPhotos', 'greenlabelPhotos'];
     function fsPhotoKeys(rep) {${photoKeysBody}}
     function fsCollectSlots(rep) {${collectSlotsBody}}
     function diskK1Active() {${gateBody}}
     function diskMetaFromArchiveItem(item) {${mapBody}}
     return { diskK1Active, diskMetaFromArchiveItem, setUser(u) { currentUser = u; } };`
  );
  return factory(fsSupportedStub);
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK.1 — the role/support gate
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK.1: diskK1Active — non-admin + File System support only', () => {
  it('regular user on a capable browser activates disk mode', () => {
    const api = makeDiskApi(true);
    api.setUser({ id: 7, role: 'user' });
    assert.equal(api.diskK1Active(), true);
  });

  it('admin NEVER activates disk mode (admin flow stays identical)', () => {
    const api = makeDiskApi(true);
    api.setUser({ id: 1, role: 'admin' });
    assert.equal(api.diskK1Active(), false);
  });

  it('regular user on an unsupported browser stays on the old path', () => {
    const api = makeDiskApi(false);
    api.setUser({ id: 7, role: 'user' });
    assert.equal(api.diskK1Active(), false);
  });

  it('signed-out state does not activate disk mode', () => {
    const api = makeDiskApi(true);
    api.setUser(null);
    assert.equal(api.diskK1Active(), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK.2 — archive folder item → home-list meta mapping
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK.2: diskMetaFromArchiveItem — meta shape mirrors dbGetAllMetadata', () => {
  const api = makeDiskApi(true);

  const itemWithArchive = {
    name: 'PSR MD 2756 Ricardo · Side Table',
    meta: {
      id: 'r-100',
      moduleType: 'prototype',
      reportTitle: 'PROTOTYPE SAMPLE REVIEW REPORT',
      model: 'MD 2756 Ricardo',
      desc: 'Side Table',
      date: '12-Nov-26',
      factory: 'NH',
      reviewer: 'Han',
      updatedAt: 1732000000000,
      coverPhotos: { main: { img: { f: 'cover-main.jpg' } } },
      _archive: {
        savedAt: '2026-11-12T08:30:00.000Z',
        files: {
          'cover:main': { img: { f: 'cover-main.jpg' }, original: { f: 'cover-main-o.jpg' } },
          'free:watchoutPhotos:w1': { img: { f: 'wo-1.jpg' } },
          'free:watchoutPhotos:w2': { img: { f: 'wo-2.jpg' } },
          'dim:d1': { img: { f: 'dim-1.jpg' } },
          'free:testingPhotos:t1': {}
        }
      }
    }
  };

  it('carries the identity and display fields', () => {
    const meta = api.diskMetaFromArchiveItem(itemWithArchive);
    assert.equal(meta.id, 'r-100');
    assert.equal(meta.moduleType, 'prototype');
    assert.equal(meta.reportTitle, 'PROTOTYPE SAMPLE REVIEW REPORT');
    assert.equal(meta.model, 'MD 2756 Ricardo');
    assert.equal(meta.desc, 'Side Table');
    assert.equal(meta.date, '12-Nov-26');
    assert.equal(meta.factory, 'NH');
    assert.equal(meta.reviewer, 'Han');
    assert.equal(meta.updatedAt, 1732000000000);
    assert.equal(meta._fileDirty, false);
  });

  it('photoCount counts filled archive slots (a slot with img+original counts once; an empty slot entry does not count)', () => {
    const meta = api.diskMetaFromArchiveItem(itemWithArchive);
    assert.equal(meta.photoCount, 4);
  });

  it('carries _diskFolder from the folder name and no thumbnail in K1', () => {
    const meta = api.diskMetaFromArchiveItem(itemWithArchive);
    assert.equal(meta._diskFolder, 'PSR MD 2756 Ricardo · Side Table');
    assert.equal(meta.thumbSrc, '');
    assert.deepEqual(meta.coverPhotos, {});
  });

  it('updatedAt falls back to the archive save time, then the report date', () => {
    const noUpdated = {
      name: 'Folder A',
      meta: { id: 'r-101', date: '01-Nov-26', _archive: { savedAt: '2026-11-01T00:00:00.000Z', files: {} } }
    };
    assert.equal(api.diskMetaFromArchiveItem(noUpdated).updatedAt, '2026-11-01T00:00:00.000Z');
    const bare = { name: 'Folder B', meta: { id: 'r-102', date: '02-Nov-26' } };
    assert.equal(api.diskMetaFromArchiveItem(bare).updatedAt, '02-Nov-26');
  });

  it('without _archive, photoCount counts non-empty photo slots (refs or inline data)', () => {
    const item = {
      name: 'Folder C',
      meta: {
        id: 'r-103',
        reportTitle: 'X',
        coverPhotos: { main: { img: { f: 'a.jpg' } }, side: { img: null } },
        watchoutPhotos: [
          { id: 'w1', img: 'data:image/jpeg;base64,AAAA' },
          { id: 'w2', img: null, imgSub: null }
        ],
        dimensions: [{ id: 'd1', img: { f: 'd.jpg' }, imgSub: null }]
      }
    };
    const meta = api.diskMetaFromArchiveItem(item);
    assert.equal(meta.photoCount, 3);
  });

  it('legacy reports without moduleType keep the PROTOTYPE inference; others default to pre-production', () => {
    const legacy = { name: 'F', meta: { id: 'r-104', reportTitle: 'PROTOTYPE REPORT', model: '', desc: '' } };
    assert.equal(api.diskMetaFromArchiveItem(legacy).moduleType, 'prototype');
    const plain = { name: 'F', meta: { id: 'r-105', reportTitle: 'SAMPLE REVIEW', model: 'MD 1', desc: 'Chair' } };
    assert.equal(api.diskMetaFromArchiveItem(plain).moduleType, 'pre-production');
  });

  it('a null item maps to an empty meta instead of throwing', () => {
    const meta = api.diskMetaFromArchiveItem(null);
    assert.equal(meta._diskFolder, '');
    assert.equal(meta.photoCount, 0);
    assert.equal(meta.moduleType, 'pre-production');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-DISK.3 — wiring pins
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-DISK.3: disk K1 wiring in index.html', () => {
  it('the connect panel and reconnect strip markup exist in the workspace', () => {
    assert.ok(indexHtml.includes('id="diskConnectPanel"'), 'connect panel must exist');
    assert.ok(indexHtml.includes('id="diskReconnectStrip"'), 'reconnect strip must exist');
    assert.ok(indexHtml.includes('CHOOSE FOLDER'), 'connect panel has the primary button');
    assert.ok(indexHtml.includes('Folder needs reconnecting'), 'reconnect strip has its label');
    assert.ok(indexHtml.includes('onclick="diskChooseFolder()"'), 'panel button calls diskChooseFolder');
    assert.ok(indexHtml.includes('onclick="diskReconnectFolder()"'), 'strip button calls diskReconnectFolder');
  });

  it('renderHome consults the disk source under the gate, with the IDB path as the default', () => {
    const body = extractFnBody(indexHtml, 'async function renderHome()', 'renderHome');
    const gateAt = body.indexOf('diskK1Active()');
    const diskAt = body.indexOf('await diskListMetas()');
    const cacheAt = body.indexOf('diskReadCachedMetas()');
    const idbAt = body.indexOf('reports = await dbGetAllMetadata();');
    assert.ok(gateAt >= 0, 'renderHome must check diskK1Active()');
    assert.ok(diskAt > gateAt, 'the disk list must be consulted under the gate');
    assert.ok(cacheAt > gateAt, 'the cached list fallback must sit under the gate');
    assert.ok(idbAt > gateAt, 'dbGetAllMetadata remains, reached only off the disk path');
    assert.ok(body.includes('renderDiskFolderUi(diskConnected)'), 'renderHome refreshes the folder UI state');
    assert.ok(body.includes('on disk'), 'the counter switches to the on-disk wording in disk mode');
  });

  it('row clicks route disk metas to openDiskReport and ask for a reconnect when offline', () => {
    const body = extractFnBody(indexHtml, 'async function renderHome()', 'renderHome');
    assert.ok(body.includes('if (diskConnected) openDiskReport(r);'), 'connected disk rows open from disk');
    assert.ok(body.includes('Reconnect the folder to open reports'), 'disconnected disk rows ask for a reconnect');
  });

  it('openDiskReport hydrates from the folder, stamps the working copy and opens it', () => {
    const body = extractFnBody(indexHtml, 'async function openDiskReport(meta)', 'openDiskReport');
    assert.ok(body.includes('fsEnsurePermission(fsDirHandle, true)'), 'open asks for permission interactively');
    assert.ok(body.includes('fsReadReportJson(folder)'), 'open reads report.json from the folder');
    assert.ok(body.includes('fsHydratePayload(rawMeta, meta._diskFolder, photosDir'), 'open hydrates photos via the archive machinery');
    assert.ok(body.includes('payload._diskFolder = meta._diskFolder;'), 'working copy is stamped with _diskFolder');
    assert.ok(body.includes('payload._diskName ='), 'working copy is stamped with _diskName');
    assert.ok(body.includes('await dbPut(payload);'), 'working copy is stored in IndexedDB');
    assert.ok(body.includes('await openReport(payload.id);'), 'the editor opens the working copy');
    assert.ok(body.includes('ipShow(') && body.includes('ipHide()'), 'the import progress card frames the hydration');
  });

  it('the metas cache is keyed per user under fasrep.diskMetas.<userId>', () => {
    assert.ok(indexHtml.includes("'fasrep.diskMetas.'"), 'cache key prefix must be fasrep.diskMetas.');
    const body = extractFnBody(indexHtml, 'async function renderHome()', 'renderHome');
    assert.ok(body.includes('diskCacheMetas(reports)'), 'renderHome caches the freshly scanned disk metas');
  });

  it('the first folder pick explains where reports will live', () => {
    const body = extractFnBody(indexHtml, 'async function diskChooseFolder()', 'diskChooseFolder');
    assert.ok(body.includes('Your reports will live in this folder, on this computer only.'), 'first-pick toast text');
    assert.ok(body.includes('6000'), 'first-pick toast shows for 6s');
  });
});
