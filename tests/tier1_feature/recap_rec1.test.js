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
// Shared REC-1 core: constants + builder + tally, evaluated with stubs
// ─────────────────────────────────────────────────────────────────────────────
function makeRec1Api(L, D) {
  const woActionsBody = extract(indexHtml, /const WO_ACTIONS = \[([\s\S]*?)\n    \];/, 'WO_ACTIONS');
  const woActionMapSrc = extract(indexHtml, /const WO_ACTION_MAP = \{\};[\s\S]*?WO_ACTION_MAP\[a\.id\] = a; \}\);/, 'WO_ACTION_MAP init');
  const woActionNoneSrc = extract(indexHtml, /const WO_ACTION_NONE = \{[^}]*\};/, 'WO_ACTION_NONE');
  const isRecapBody = extractFnBody(indexHtml, 'function isRecapReport(report)', 'isRecapReport');
  const woMetaBody = extractFnBody(indexHtml, 'function woActionMeta(action)', 'woActionMeta');
  const builderBody = extractFnBody(indexHtml, 'function buildRecapWatchoutSummary(report)', 'buildRecapWatchoutSummary');
  const tallyBody = extractFnBody(indexHtml, 'function recapSummaryTallyText(summary, lang)', 'recapSummaryTallyText');
  const factory = new Function(
    'L', 'D',
    `const WO_ACTIONS = [${woActionsBody}];
     ${woActionMapSrc}
     ${woActionNoneSrc}
     function isRecapReport(report) {${isRecapBody}}
     function woActionMeta(action) {${woMetaBody}}
     function buildRecapWatchoutSummary(report) {${builderBody}}
     function recapSummaryTallyText(summary, lang) {${tallyBody}}
     return { WO_ACTIONS, WO_ACTION_NONE, isRecapReport, woActionMeta, buildRecapWatchoutSummary, recapSummaryTallyText };`
  );
  return factory(L, D);
}

const apiEn = makeRec1Api((vi, en) => en, {});
const apiVi = makeRec1Api((vi, en) => vi, {});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.1 — summary builder
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.1: buildRecapWatchoutSummary — issue list + tallies', () => {
  const mixed = {
    watchoutPhotos: [
      { img: 'data:image/x', caption: '  Crack on seat frame  ', action: 'fix-now' },
      { imgSub: 'data:image/y', caption: '', action: 'accepted' },
      { caption: 'Caption-only remark' },
      { img: 'data:image/z', caption: '', action: 'bogus-value' },
      {},
      null,
      { photoLayout: 'single' }
    ]
  };

  it('TC-REC1.1.1: an issue is a slot with a photo (img/imgSub) or a non-empty caption; empty slots are excluded', () => {
    const s = apiEn.buildRecapWatchoutSummary(mixed);
    assert.equal(s.total, 4);
    assert.deepEqual(s.issues.map(i => i.index), [1, 2, 3, 4]);
  });

  it('TC-REC1.1.2: captions are trimmed; empty caption becomes null', () => {
    const s = apiEn.buildRecapWatchoutSummary(mixed);
    assert.equal(s.issues[0].caption, 'Crack on seat frame');
    assert.equal(s.issues[1].caption, null);
    assert.equal(s.issues[2].caption, 'Caption-only remark');
    assert.equal(s.issues[3].caption, null);
  });

  it('TC-REC1.1.3: tallies count each status; unknown/absent actions fall into unselected', () => {
    const s = apiEn.buildRecapWatchoutSummary(mixed);
    assert.deepEqual(s.counts, { 'fix-now': 1, 'fix-next': 0, 'note': 0, 'accepted': 1 });
    assert.equal(s.unselected, 2); // caption-only slot + bogus action slot
    assert.equal(s.issues[0].action, 'fix-now');
    assert.equal(s.issues[2].action, null);
    assert.equal(s.issues[3].action, null);
  });

  it('TC-REC1.1.4: empty / missing watchout data yields an empty summary', () => {
    for (const report of [{}, { watchoutPhotos: [] }, { watchoutPhotos: null }, null, undefined]) {
      const s = apiEn.buildRecapWatchoutSummary(report);
      assert.equal(s.total, 0);
      assert.deepEqual(s.issues, []);
      assert.equal(s.unselected, 0);
      assert.deepEqual(s.counts, { 'fix-now': 0, 'fix-next': 0, 'note': 0, 'accepted': 0 });
    }
  });

  it('TC-REC1.1.5: whitespace-only captions do not create issues', () => {
    const s = apiEn.buildRecapWatchoutSummary({ watchoutPhotos: [{ caption: '   ' }, { caption: '\n\t' }] });
    assert.equal(s.total, 0);
  });

  it('TC-REC1.1.6: the four statuses are exactly the approved set, in order', () => {
    assert.deepEqual(apiEn.WO_ACTIONS.map(a => a.id), ['fix-now', 'fix-next', 'note', 'accepted']);
    assert.deepEqual(apiEn.WO_ACTIONS.map(a => a.en), ['Fix immediately', 'Fix next sample', 'Take note', 'Accepted']);
    assert.deepEqual(apiEn.WO_ACTIONS.map(a => a.vi), ['Sửa ngay', 'Sửa ở mẫu sau', 'Ghi nhận', 'Chấp nhận']);
    assert.equal(apiEn.WO_ACTION_NONE.en, 'Not decided');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.2 — tally line composition, both languages
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.2: recapSummaryTallyText', () => {
  const summary = { issues: [], counts: { 'fix-now': 2, 'fix-next': 1, 'note': 1, 'accepted': 0 }, unselected: 1, total: 5 };

  it('TC-REC1.2.1: English line lists only groups with count > 0, plus not-decided when unselected > 0', () => {
    assert.equal(
      apiEn.recapSummaryTallyText(summary, 'en'),
      '5 watch-outs: 2 fix immediately · 1 fix next sample · 1 take note · 1 not decided'
    );
  });

  it('TC-REC1.2.2: Vietnamese line mirrors the English structure', () => {
    assert.equal(
      apiVi.recapSummaryTallyText(summary, 'vi'),
      '5 watch-out: 2 sửa ngay · 1 sửa ở mẫu sau · 1 ghi nhận · 1 chưa xử lý'
    );
  });

  it('TC-REC1.2.3: without an explicit lang the line follows the UI language via L()', () => {
    assert.match(apiEn.recapSummaryTallyText(summary), /^5 watch-outs: /);
    assert.match(apiVi.recapSummaryTallyText(summary), /^5 watch-out: /);
  });

  it('TC-REC1.2.4: singular total reads "1 watch-out"; zero-unselected omits the not-decided part', () => {
    const one = { issues: [], counts: { 'fix-now': 1, 'fix-next': 0, 'note': 0, 'accepted': 0 }, unselected: 0, total: 1 };
    assert.equal(apiEn.recapSummaryTallyText(one, 'en'), '1 watch-out: 1 fix immediately');
    assert.equal(apiVi.recapSummaryTallyText(one, 'vi'), '1 watch-out: 1 sửa ngay');
  });

  it('TC-REC1.2.5: empty summary produces an empty line', () => {
    assert.equal(apiEn.recapSummaryTallyText({ issues: [], counts: { 'fix-now': 0, 'fix-next': 0, 'note': 0, 'accepted': 0 }, unselected: 0, total: 0 }, 'en'), '');
    assert.equal(apiEn.recapSummaryTallyText(null, 'en'), '');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.3 — the `action` field survives the draft-snapshot round-trip
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.3: action field round-trips through draft snapshots', () => {
  const hashBody = extractFnBody(indexHtml, 'function photoStrongHash(value)', 'photoStrongHash');
  const refBody = extractFnBody(indexHtml, 'function photoRefForValue(value)', 'photoRefForValue');
  const refStrongBody = extractFnBody(indexHtml, 'function photoRefForValueStrong(value)', 'photoRefForValueStrong');
  const stripBody = extractFnBody(indexHtml, 'function stripPhotosForSnapshot(report)', 'stripPhotosForSnapshot');
  const restoreBody = extractFnBody(indexHtml, 'function restoreSnapshotIntoReport(dbReport, snapData)', 'restoreSnapshotIntoReport');
  const snapApi = new Function(
    `function photoStrongHash(value) {${hashBody}}
     function photoRefForValue(value) {${refBody}}
     function photoRefForValueStrong(value) {${refStrongBody}}
     function stripPhotosForSnapshot(report) {${stripBody}}
     function restoreSnapshotIntoReport(dbReport, snapData) {${restoreBody}}
     return { stripPhotosForSnapshot, restoreSnapshotIntoReport };`
  )();

  const PHOTO = 'data:image/jpeg;base64,' + 'QUJD'.repeat(200); // > 200 chars → fingerprinted
  const dbReport = {
    id: 'r1',
    moduleType: 'sample-review-recap',
    watchoutPhotos: [{ img: PHOTO, caption: 'Old caption', action: 'accepted' }]
  };
  const draftReport = {
    id: 'r1',
    moduleType: 'sample-review-recap',
    watchoutPhotos: [{ img: PHOTO, caption: 'New caption', action: 'fix-now' }]
  };

  it('TC-REC1.3.1: stripPhotosForSnapshot keeps the action field (only photo payloads are fingerprinted)', () => {
    const stripped = snapApi.stripPhotosForSnapshot(draftReport);
    assert.equal(stripped.watchoutPhotos[0].action, 'fix-now');
    assert.ok(stripped.watchoutPhotos[0].img.startsWith('__photo_ref_'), 'photo payload must be replaced by a fingerprint');
  });

  it('TC-REC1.3.2: restoreSnapshotIntoReport brings back the draft action AND re-attaches the real photo', () => {
    const snapData = snapApi.stripPhotosForSnapshot(draftReport);
    const { report, hadMismatches } = snapApi.restoreSnapshotIntoReport(dbReport, snapData);
    assert.equal(hadMismatches, false);
    assert.equal(report.watchoutPhotos[0].action, 'fix-now');
    assert.equal(report.watchoutPhotos[0].caption, 'New caption');
    assert.equal(report.watchoutPhotos[0].img, PHOTO);
  });

  it('TC-REC1.3.3: an unselected action (null) round-trips as null', () => {
    const draft = { id: 'r1', watchoutPhotos: [{ img: PHOTO, caption: 'x', action: null }] };
    const snapData = snapApi.stripPhotosForSnapshot(draft);
    const { report } = snapApi.restoreSnapshotIntoReport(dbReport, snapData);
    assert.equal(report.watchoutPhotos[0].action, null);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.4 — Recap-only gating: editor chips, summary block, mutation path
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.4: editor gating and mutation discipline', () => {
  const renderWatchoutBody = extractFnBody(indexHtml, 'function renderWatchoutPhotos()', 'renderWatchoutPhotos');
  const setActionBody = extractFnBody(indexHtml, 'function setWatchoutAction(index, actionId)', 'setWatchoutAction');
  const autoSummaryBody = extractFnBody(indexHtml, 'function renderRecapAutoSummary()', 'renderRecapAutoSummary');

  it('TC-REC1.4.1: Watch Out chip row renders only for Recap reports', () => {
    assert.ok(renderWatchoutBody.includes('const isRecap = isRecapReport();'));
    assert.ok(renderWatchoutBody.includes('${isRecap ? `'), 'chip row must be conditional on isRecap');
    assert.ok(renderWatchoutBody.includes('wo-action-chips'));
    assert.ok(renderWatchoutBody.includes("setWatchoutAction(${i}, '${a.id}')"));
    assert.ok(renderWatchoutBody.includes('p.action === a.id'), 'selected chip must get the .on state');
  });

  it('TC-REC1.4.2: isRecapReport keys off moduleType sample-review-recap', () => {
    assert.equal(apiEn.isRecapReport({ moduleType: 'sample-review-recap' }), true);
    assert.equal(apiEn.isRecapReport({ moduleType: 'prototype' }), false);
    assert.equal(apiEn.isRecapReport({}), false);
    const recapD = makeRec1Api((vi, en) => en, { moduleType: 'sample-review-recap' });
    assert.equal(recapD.isRecapReport(), true, 'falls back to the open report D when none is passed');
  });

  it('TC-REC1.4.3: setWatchoutAction pushes history BEFORE mutating, toggles off on re-tap, saves via as()', () => {
    const histIdx = setActionBody.indexOf('pushHistory(');
    const mutIdx = setActionBody.indexOf('.action =');
    assert.ok(histIdx !== -1 && mutIdx !== -1 && histIdx < mutIdx, 'pushHistory must precede the mutation');
    assert.ok(setActionBody.includes('(cur === actionId) ? null : actionId'), 're-tapping the selected chip must clear the action');
    assert.ok(setActionBody.includes('as();'));
    assert.ok(setActionBody.includes('renderWatchoutPhotos();'));
  });

  it('TC-REC1.4.4: the Overview auto summary is Recap-gated, builder-driven, and has an empty state', () => {
    assert.ok(autoSummaryBody.includes('if (!isRecapReport())'));
    assert.ok(autoSummaryBody.includes('buildRecapWatchoutSummary(D)'));
    assert.ok(autoSummaryBody.includes('QUALITY SUMMARY'));
    assert.ok(autoSummaryBody.includes('✓ No watch-outs recorded'));
    assert.ok(autoSummaryBody.includes('No description yet'));
    assert.ok(autoSummaryBody.includes('recapSummaryTallyText(s)'));
    assert.ok(indexHtml.includes('id="recapAutoSummary"'), 'the summary container must exist in the Overview card');
  });

  it('TC-REC1.4.5: the summary refreshes from the Overview render cycle (renderCoverSlots + showSection)', () => {
    const coverBody = extractFnBody(indexHtml, 'function renderCoverSlots()', 'renderCoverSlots');
    const showSectionBody = extractFnBody(indexHtml, 'function showSection(i)', 'showSection');
    assert.ok(coverBody.includes('renderRecapAutoSummary();'));
    assert.ok(showSectionBody.includes('renderRecapAutoSummary();'));
  });

  it('TC-REC1.4.6: all new user-facing strings have [VI, EN] pairs', () => {
    const pairs = [
      "['Sửa ngay', 'Fix immediately']",
      "['Sửa ở mẫu sau', 'Fix next sample']",
      "['Ghi nhận', 'Take note']",
      "['Chấp nhận', 'Accepted']",
      "['Chưa xử lý', 'Not decided']",
      "['Tóm tắt chất lượng', 'QUALITY SUMMARY']",
      "['Chưa có mô tả', 'No description yet']",
      "['✓ Không có watch-out nào được ghi nhận', '✓ No watch-outs recorded']"
    ];
    for (const pair of pairs) {
      assert.ok(indexHtml.includes(pair), `missing i18n pair ${pair}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.5 — PDF gating: summary block + Watch Out caption chips
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.5: PDF gating (source assertions)', () => {
  it('TC-REC1.5.1: the page-1 QUALITY SUMMARY block is Recap-gated and uses the shared builder in English', () => {
    assert.ok(indexHtml.includes('REC-1: RECAP QUALITY SUMMARY'));
    assert.ok(indexHtml.includes('const recapSummary = buildRecapWatchoutSummary(D);'));
    assert.ok(indexHtml.includes("recapSummaryTallyText(recapSummary, 'en')"), 'PDF tally must be forced to English');
    assert.ok(indexHtml.includes("if (isRecap) {\n        const recapSummary = buildRecapWatchoutSummary(D);"));
    assert.ok(indexHtml.includes('✓ No watch-outs recorded'));
    assert.ok(indexHtml.includes("doc.text('WATCH OUT', M + idxW, y + 3);"), 'summary table column header must read WATCH OUT');
  });

  it('TC-REC1.5.2: Watch Out caption chips are enabled only for the Recap Watch Out section', () => {
    assert.ok(indexHtml.includes("(isRecap && photoKey === 'watchoutPhotos') ? { actionChips: true } : null"));
    assert.ok(indexHtml.includes('const renderPhotoSection = (sectionTitle, photoArray, notesText, notesTitle, gridOpts) => {'));
    assert.ok(indexHtml.includes('renderPhotoGrid(validPhotos, sectionTitle, undefined, undefined, gridOpts);'));
  });

  it('TC-REC1.5.3: the photo grid only draws action chips when gridOpts.actionChips is set', () => {
    const gridBody = extract(
      indexHtml,
      /const renderPhotoGrid = \(photos, headerTitle, customCardH, customGapY, gridOpts\) => \{([\s\S]*?)\n      \};/,
      'renderPhotoGrid'
    );
    assert.ok(gridBody.includes('const showActions = !!(gridOpts && gridOpts.actionChips);'));
    assert.ok(gridBody.includes('woActionMeta(p.action)'), 'grid must resolve the slot action before drawing a chip');
    assert.ok(gridBody.includes('drawActionChip('), 'grid must draw the status chip under the caption');
    // Caption height must grow when a chip is present, otherwise the chip
    // would overlap the next row.
    assert.ok(gridBody.includes('slotCapBlockH('), 'caption block height must account for the chip');
  });
});
