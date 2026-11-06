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

  it('TC-REC1.4.1: the Watch Out status chip renders only for Recap reports (Style B: one chip per slot)', () => {
    assert.ok(renderWatchoutBody.includes('const isRecap = isRecapReport();'));
    assert.ok(renderWatchoutBody.includes('${isRecap ? `'), 'status chip must be conditional on isRecap');
    assert.ok(renderWatchoutBody.includes('wo-action-bar'));
    assert.ok(renderWatchoutBody.includes('woStatusChipHtml(i, p)'), 'the slot delegates to the single-chip builder');
    assert.ok(!renderWatchoutBody.includes('wo-act-chip'), 'the old 4-chip row markup must be gone');
    assert.ok(!renderWatchoutBody.includes('wo-action-chips'), 'the old chip-row container must be gone');
  });

  it('TC-REC1.4.2: isRecapReport keys off moduleType sample-review-recap', () => {
    assert.equal(apiEn.isRecapReport({ moduleType: 'sample-review-recap' }), true);
    assert.equal(apiEn.isRecapReport({ moduleType: 'prototype' }), false);
    assert.equal(apiEn.isRecapReport({}), false);
    const recapD = makeRec1Api((vi, en) => en, { moduleType: 'sample-review-recap' });
    assert.equal(recapD.isRecapReport(), true, 'falls back to the open report D when none is passed');
  });

  it('TC-REC1.4.3: setWatchoutAction pushes history BEFORE mutating, sets the value explicitly, saves via as()', () => {
    const histIdx = setActionBody.indexOf('pushHistory(');
    const mutIdx = setActionBody.indexOf('.action = next');
    assert.ok(histIdx !== -1 && mutIdx !== -1 && histIdx < mutIdx, 'pushHistory must precede the mutation');
    assert.ok(!setActionBody.includes('? null : actionId'), 'the tap-to-toggle ternary must be gone (Style B sets explicitly)');
    assert.ok(setActionBody.includes('if (cur === next) return;'), 'a no-change call must be a no-op');
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
      "['✓ Không có watch-out nào được ghi nhận', '✓ No watch-outs recorded']",
      "['Bỏ chọn', 'Clear selection']"
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

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.6 — Style B (v4.1.2): single status chip + status picker
// Picker presentation changed in v4.1.3: anchored dropdown, not a modal sheet.
// The chip builder and the mutation are evaluated with stubs; the dropdown is
// DOM-building code, so it is covered by source assertions.
// ─────────────────────────────────────────────────────────────────────────────
function makePickerApi() {
  const woActionsBody = extract(indexHtml, /const WO_ACTIONS = \[([\s\S]*?)\n    \];/, 'WO_ACTIONS');
  const woActionMapSrc = extract(indexHtml, /const WO_ACTION_MAP = \{\};[\s\S]*?WO_ACTION_MAP\[a\.id\] = a; \}\);/, 'WO_ACTION_MAP init');
  const woActionNoneSrc = extract(indexHtml, /const WO_ACTION_NONE = \{[^}]*\};/, 'WO_ACTION_NONE');
  const woMetaBody = extractFnBody(indexHtml, 'function woActionMeta(action)', 'woActionMeta');
  const chipBody = extractFnBody(indexHtml, 'function woStatusChipHtml(index, slot)', 'woStatusChipHtml');
  const setActionBody = extractFnBody(indexHtml, 'function setWatchoutAction(index, actionId)', 'setWatchoutAction');
  const calls = [];
  const state = { D: { watchoutPhotos: [] } };
  const factory = new Function(
    'D', 'pushHistory', 'as', 'renderWatchoutPhotos',
    `const WO_ACTIONS = [${woActionsBody}];
     ${woActionMapSrc}
     ${woActionNoneSrc}
     function woActionMeta(action) {${woMetaBody}}
     function woStatusChipHtml(index, slot) {${chipBody}}
     function setWatchoutAction(index, actionId) {${setActionBody}}
     return { woStatusChipHtml, setWatchoutAction };`
  );
  const api = factory(
    state.D,
    () => calls.push('pushHistory'),
    () => calls.push('as'),
    () => calls.push('renderWatchoutPhotos')
  );
  return { api, calls, state };
}

describe('TC-REC1.6: Style B single chip + anchored dropdown (chip v4.1.2, dropdown v4.1.3)', () => {
  it('TC-REC1.6.1: an unselected slot renders ONE muted "+ Not decided" chip that toggles the dropdown', () => {
    const { api } = makePickerApi();
    for (const slot of [{}, { action: null }, { action: 'bogus-value' }, null]) {
      const html = api.woStatusChipHtml(2, slot);
      assert.equal((html.match(/<button/g) || []).length, 1, 'exactly one chip button per slot');
      assert.ok(html.includes('wo-status-chip none'), 'unselected chip uses the muted .none style');
      assert.ok(html.includes('<span class="wo-plus"'), 'the "+" is its own span (keeps the label translatable)');
      assert.ok(html.includes('Not decided'), 'chip shows the Not decided label');
      assert.ok(html.includes('toggleWatchoutActionMenu(2, this)'), 'chip toggles the anchored dropdown for its slot');
      assert.ok(!html.includes('data-wo-action'), 'unselected chip carries no status color hook');
    }
  });

  it('TC-REC1.6.2: a selected slot renders exactly ONE chip with the status label + color hook', () => {
    const { api } = makePickerApi();
    const html = api.woStatusChipHtml(0, { action: 'note' });
    assert.equal((html.match(/<button/g) || []).length, 1, 'exactly one chip button per slot');
    assert.ok(html.includes('wo-status-chip'));
    assert.ok(!html.includes('wo-status-chip none'), 'selected chip is not the muted variant');
    assert.ok(html.includes('data-wo-action="note"'), 'chip carries the status color hook (CSS vars)');
    assert.ok(html.includes('Take note'), 'chip shows the selected status label');
    assert.ok(html.includes('wo-chev'), 'chip shows the tappable affordance');
    assert.ok(html.includes('toggleWatchoutActionMenu(0, this)'), 'chip toggles the anchored dropdown for its slot');
  });

  it('TC-REC1.6.3: setWatchoutAction sets explicitly — no toggle, clear via null, no-change is a no-op', () => {
    const { api, calls, state } = makePickerApi();
    state.D.watchoutPhotos = [{ caption: 'x' }, { caption: 'y', action: 'note' }];

    api.setWatchoutAction(0, 'fix-now');
    assert.equal(state.D.watchoutPhotos[0].action, 'fix-now');
    assert.deepEqual(calls, ['pushHistory', 'as', 'renderWatchoutPhotos'],
      'mutation discipline: history BEFORE the change, then save, then re-render');

    // Picking the already-selected value must NOT clear it (no toggle) and
    // must not push a history entry either.
    calls.length = 0;
    api.setWatchoutAction(0, 'fix-now');
    assert.equal(state.D.watchoutPhotos[0].action, 'fix-now');
    assert.deepEqual(calls, [], 're-picking the current value is a no-op');

    // The dropdown's clear row passes null, which clears.
    api.setWatchoutAction(1, null);
    assert.equal(state.D.watchoutPhotos[1].action, null);

    // Unknown values normalize to null; out-of-range slots are ignored.
    api.setWatchoutAction(0, 'bogus-value');
    assert.equal(state.D.watchoutPhotos[0].action, null);
    api.setWatchoutAction(9, 'note');
    assert.equal(state.D.watchoutPhotos.length, 2);
  });

  it('TC-REC1.6.4: the picker is an anchored dropdown — no overlay, no scroll lock, single instance, outside-tap close, full teardown', () => {
    const toggleBody = extractFnBody(indexHtml, 'function toggleWatchoutActionMenu(index, anchorEl)', 'toggleWatchoutActionMenu');
    const openBody = extractFnBody(indexHtml, 'function openWatchoutActionMenu(index, anchorEl)', 'openWatchoutActionMenu');
    const closeBody = extractFnBody(indexHtml, 'function closeWatchoutActionMenu()', 'closeWatchoutActionMenu');
    const outsideBody = extractFnBody(indexHtml, 'function woMenuOutsideTap(e)', 'woMenuOutsideTap');
    const pickBody = extractFnBody(indexHtml, 'function pickWatchoutAction(actionId)', 'pickWatchoutAction');
    const menuCss = extract(indexHtml, /\.wo-menu \{([\s\S]*?)\}/, '.wo-menu CSS');

    // It is a menu, not a dialog: no modal overlay, no backdrop dim, no scroll lock.
    assert.ok(openBody.includes("menu.className = 'wo-menu'"), 'picker is a plain .wo-menu element');
    assert.ok(!openBody.includes('modal-overlay'), 'the dropdown must NOT use the modal overlay');
    assert.ok(!openBody.includes('lockBodyScroll'), 'the dropdown must NOT lock body scroll');
    assert.ok(!closeBody.includes('unlockBodyScroll'), 'closing has no scroll lock to release');
    assert.ok(!indexHtml.includes('wo-sheet'), 'the old sheet styles/markup are gone');
    assert.ok(!indexHtml.includes('openWatchoutActionSheet'), 'the old sheet opener is gone');

    // Anchored positioning: fixed menu placed from the chip's rect, flipped
    // above the chip when it would run off the bottom of the viewport.
    assert.ok(menuCss.includes('position: fixed'),
      'the menu is position:fixed (the slot card clips overflow, so an in-card absolute menu would be cut off)');
    assert.ok(openBody.includes('document.body.appendChild(menu)'), 'menu lives on <body>, outside the clipping card');
    assert.ok(openBody.includes('anchorEl.getBoundingClientRect()'), 'position comes from the chip rect');
    assert.ok(openBody.includes('menu.offsetHeight'), 'the flip decision measures the real menu height');
    assert.ok(openBody.includes('rect.bottom + 6') && openBody.includes('rect.top - 6 - menuH'),
      'menu opens directly below the chip, flipping above it when space runs out');

    // Single instance + toggle discipline.
    assert.ok(openBody.includes('closeWatchoutActionMenu();'),
      'opening first closes any existing menu — one instance at a time');
    assert.ok(toggleBody.includes('woMenuSlotIndex === index'),
      'tapping the chip of the already-open slot toggles its menu closed');
    assert.ok(toggleBody.includes('closeWatchoutActionMenu();'));
    assert.ok(toggleBody.includes('openWatchoutActionMenu(index, anchorEl)'));

    // Rows carry the same content as the old sheet: dot + label per status,
    // a check mark on the current value, a divider, and a clear row.
    assert.ok(openBody.includes('WO_ACTIONS.map('), 'one row per status');
    assert.ok(openBody.includes('wo-menu-row'));
    assert.ok(openBody.includes('wo-dot'), 'each row carries its status color dot');
    assert.ok(openBody.includes('cur === a.id') && openBody.includes('wo-check'),
      'the currently selected row carries the check mark');
    assert.ok(openBody.includes('wo-menu-divider'), 'a divider separates the clear row');
    assert.ok(openBody.includes('Clear selection'), 'the clear row exists');
    assert.ok(openBody.includes('pickWatchoutAction(null)'), 'the clear row sets the action to null');
    assert.ok(openBody.includes("pickWatchoutAction('${a.id}')"), 'status rows pick their value');

    // Outside-tap + scroll/resize close: listeners registered on open and
    // removed again on close, so nothing leaks past the menu's lifetime.
    assert.ok(openBody.includes("document.addEventListener('pointerdown', woMenuOutsideTap, true)"),
      'outside taps are watched while the menu is open');
    assert.ok(openBody.includes("document.addEventListener('scroll', closeWatchoutActionMenu, true)"),
      'any scroll closes the menu instead of leaving it floating detached from its chip');
    assert.ok(openBody.includes("window.addEventListener('resize', closeWatchoutActionMenu)"));
    assert.ok(outsideBody.includes('menu.contains(e.target)'), 'taps inside the menu are not "outside"');
    assert.ok(outsideBody.includes('woMenuAnchorEl.contains(e.target)'), 'taps on the anchor chip are not "outside"');
    assert.ok(outsideBody.includes('closeWatchoutActionMenu();'), 'a true outside tap closes with no change');
    assert.ok(closeBody.includes('menu.remove()'), 'closing removes the menu DOM');
    assert.ok(closeBody.includes("document.removeEventListener('pointerdown', woMenuOutsideTap, true)"),
      'closing unregisters the outside-tap listener');
    assert.ok(closeBody.includes("document.removeEventListener('scroll', closeWatchoutActionMenu, true)"));
    assert.ok(closeBody.includes("window.removeEventListener('resize', closeWatchoutActionMenu)"));

    // A re-render replaces the chips, so it must not leave a stale menu
    // floating over a chip that no longer exists.
    const rwIdx = indexHtml.indexOf('function renderWatchoutPhotos()');
    assert.ok(rwIdx !== -1 && indexHtml.slice(rwIdx, rwIdx + 220).includes('closeWatchoutActionMenu();'),
      'renderWatchoutPhotos closes the dropdown before replacing the chips');

    assert.ok(pickBody.includes('setWatchoutAction(index, actionId)'),
      'dropdown picks route through the shared setWatchoutAction mutation path');
    assert.ok(pickBody.includes('closeWatchoutActionMenu();'), 'picking closes the dropdown');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-REC1.7 — Recap editor Overview: the redundant summary strip is hidden
// (v4.1.5). The PDF lost its top strip in v4.1.1 because the QUALITY SUMMARY
// block carries the information; the editor strip (#overviewSummaryStrip)
// duplicated the same watch-out count next to #recapAutoSummary, so
// renderOverviewSummary now hides it completely for Recap while non-Recap
// modules keep their badges exactly as before.
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-REC1.7: renderOverviewSummary hides the strip for Recap only (v4.1.5)', () => {
  const summaryBody = extractFnBody(indexHtml, 'function renderOverviewSummary()', 'renderOverviewSummary');

  // Evaluate the real function against a stub element + metrics so the
  // element's end state (content AND display) is asserted, not just source.
  function runSummary(D, metrics, initial) {
    const el = { innerHTML: initial.innerHTML, style: { display: initial.display } };
    const documentStub = { getElementById: (id) => (id === 'overviewSummaryStrip' ? el : null) };
    const factory = new Function(
      'document', 'D', 'getReportQuickMetrics',
      `function renderOverviewSummary() {${summaryBody}}\nreturn renderOverviewSummary;`
    );
    factory(documentStub, D, () => metrics)();
    return el;
  }

  const baseMetrics = {
    watchCount: 0, totalTests: 0, failedTests: 0, passedTests: 0, pendingTests: 0,
    totalCriteria: 0, passCriteria: 0, pendingCriteria: 0, redDims: 0, orangeDims: 0
  };

  it('TC-REC1.7.1: the Recap branch empties + fully hides the strip and builds no badge', () => {
    const recapIf = summaryBody.indexOf("if (D.moduleType === 'sample-review-recap')");
    assert.ok(recapIf !== -1, 'the Recap branch must still exist');
    const branch = summaryBody.slice(recapIf, summaryBody.indexOf('return;', recapIf));
    assert.ok(branch.includes("el.innerHTML = '';"), 'Recap empties the strip content');
    assert.ok(branch.includes("el.style.display = 'none';"),
      'Recap hides the element itself — an emptied strip would still paint its background/border as an empty bar');
    assert.ok(!branch.includes('summary-badge'), 'Recap builds no badge markup at all');
    assert.ok(!branch.includes('watchBadge'), 'the old lone watch badge construction is gone');
    // The badge strings now exist exactly once each in the function: the
    // non-Recap watch badge. The Recap branch used to add a second copy.
    assert.equal(summaryBody.split('Quality Watch-out').length - 1, 1,
      'only the non-Recap watch badge keeps the Quality Watch-out label');
    assert.equal(summaryBody.split('0 Watch-outs (Clean)').length - 1, 1,
      'only the non-Recap path keeps the Clean badge');
  });

  it('TC-REC1.7.2: evaluated — a Recap report ends with an empty, display:none strip', () => {
    const withWatch = runSummary(
      { moduleType: 'sample-review-recap' },
      { ...baseMetrics, watchCount: 4 },
      { innerHTML: 'LEFTOVER BADGE', display: '' }
    );
    assert.equal(withWatch.innerHTML, '', 'no watch badge is rendered for Recap');
    assert.equal(withWatch.style.display, 'none', 'the strip element is fully hidden for Recap');

    const clean = runSummary(
      { moduleType: 'sample-review-recap' },
      { ...baseMetrics, watchCount: 0 },
      { innerHTML: 'LEFTOVER BADGE', display: '' }
    );
    assert.equal(clean.innerHTML, '', 'no "Clean" badge is rendered for Recap either');
    assert.equal(clean.style.display, 'none');
  });

  it('TC-REC1.7.3: the non-Recap path restores visibility before building its badges', () => {
    const recapIf = summaryBody.indexOf("if (D.moduleType === 'sample-review-recap')");
    const restoreIdx = summaryBody.indexOf("el.style.display = '';");
    assert.ok(restoreIdx > recapIf, 'display is restored on the non-Recap path, after the Recap branch');
    assert.ok(summaryBody.indexOf('summary-badge', restoreIdx) > restoreIdx,
      'badges are still built after the restore');

    // Start from the exact state a Recap render leaves behind (hidden +
    // empty) in the same session, then render a Prototype report.
    const proto = runSummary(
      { moduleType: 'prototype' },
      { ...baseMetrics, watchCount: 2 },
      { innerHTML: '', display: 'none' }
    );
    assert.equal(proto.style.display, '', 'switching to a non-Recap report brings the strip back');
    assert.ok(proto.innerHTML.includes('overview-summary-head'), 'the Quality Summary head is rendered');
    assert.ok(proto.innerHTML.includes('summary-badge'), 'badges are rendered for non-Recap');
    assert.ok(proto.innerHTML.includes('Quality Watch-out'), 'the watch badge is rendered for non-Recap');

    const protoClean = runSummary(
      { moduleType: 'pre-production' },
      { ...baseMetrics, watchCount: 0 },
      { innerHTML: '', display: 'none' }
    );
    assert.equal(protoClean.style.display, '');
    assert.ok(protoClean.innerHTML.includes('0 Watch-outs (Clean)'),
      'the non-Recap Clean badge is unchanged');
  });

  it('TC-REC1.7.4: the Recap QUALITY SUMMARY block and the metrics function are untouched', () => {
    const autoSummaryBody = extractFnBody(indexHtml, 'function renderRecapAutoSummary()', 'renderRecapAutoSummary');
    assert.ok(autoSummaryBody.includes("getElementById('recapAutoSummary')"),
      'the QUALITY SUMMARY block still renders into #recapAutoSummary');
    assert.ok(autoSummaryBody.includes('QUALITY SUMMARY'),
      'the QUALITY SUMMARY block heading is intact — it stays the single Recap summary');
    assert.ok(indexHtml.includes('id="recapAutoSummary"'), 'the summary container still exists');
    const metricsBody = extractFnBody(indexHtml, 'function getReportQuickMetrics(data)', 'getReportQuickMetrics');
    assert.ok(metricsBody.includes('watchCount'),
      'getReportQuickMetrics itself is unchanged (other consumers: list cards, PDF)');
    assert.ok(summaryBody.includes('getReportQuickMetrics(D)'),
      'renderOverviewSummary still reads the shared metrics');
  });
});
