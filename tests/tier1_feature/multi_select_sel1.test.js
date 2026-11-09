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

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEL-1 pure helpers are evaluated for real; gesture wiring is pinned by
// source assertions (the gesture engine itself needs a DOM + pointer
// events, which the node harness does not simulate).
// ─────────────────────────────────────────────────────────────────────────────
function makeSelApi() {
  const rangeBody = extractFnBody(indexHtml, 'function selRangeList(a, b)', 'selRangeList');
  const strokeBody = extractFnBody(indexHtml, 'function applyStrokeToSet(set, values, mode)', 'applyStrokeToSet');
  const factory = new Function(
    `function selRangeList(a, b) {${rangeBody}}
     function applyStrokeToSet(set, values, mode) {${strokeBody}}
     return { selRangeList, applyStrokeToSet };`
  );
  return factory();
}

const sel = makeSelApi();

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL1 — selRangeList: inclusive integer ranges in DOM order
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL1: selRangeList — inclusive ranges (v4.5.0)', () => {
  it('TC-SEL1.1: forward range lists every index between a and b inclusive', () => {
    assert.deepEqual(sel.selRangeList(2, 5), [2, 3, 4, 5]);
    assert.deepEqual(sel.selRangeList(0, 3), [0, 1, 2, 3]);
  });

  it('TC-SEL1.2: backward range is normalised to ascending order', () => {
    assert.deepEqual(sel.selRangeList(5, 2), [2, 3, 4, 5]);
    assert.deepEqual(sel.selRangeList(9, 0), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('TC-SEL1.3: a single index yields a one-element list', () => {
    assert.deepEqual(sel.selRangeList(3, 3), [3]);
    assert.deepEqual(sel.selRangeList(0, 0), [0]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL2 — applyStrokeToSet: one mode applied to a whole run of values
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL2: applyStrokeToSet — stroke application semantics (v4.5.0)', () => {
  it('TC-SEL2.1: add-mode adds every value and returns the same set', () => {
    const s = new Set([1]);
    const out = sel.applyStrokeToSet(s, [2, 3, 4], true);
    assert.equal(out, s, 'must return the mutated set itself');
    assert.deepEqual([...s].sort((a, b) => a - b), [1, 2, 3, 4]);
  });

  it('TC-SEL2.2: remove-mode deletes every value, keeping the rest', () => {
    const s = new Set([1, 2, 3, 4, 5]);
    sel.applyStrokeToSet(s, [2, 4, 5], false);
    assert.deepEqual([...s].sort((a, b) => a - b), [1, 3]);
  });

  it('TC-SEL2.3: re-applying the same values is idempotent (stroke re-entry)', () => {
    const s = new Set(['a']);
    sel.applyStrokeToSet(s, ['a', 'b'], true);
    sel.applyStrokeToSet(s, ['a', 'b'], true);
    assert.deepEqual([...s].sort(), ['a', 'b']);
    sel.applyStrokeToSet(s, ['a'], false);
    sel.applyStrokeToSet(s, ['a'], false);
    assert.deepEqual([...s], ['b']);
  });

  it('TC-SEL2.4: works with string ids (report selection) as well as indexes', () => {
    const s = new Set(['r1']);
    sel.applyStrokeToSet(s, ['r2', 'r3'], true);
    assert.ok(s.has('r2') && s.has('r3') && s.size === 3);
    sel.applyStrokeToSet(s, ['r1', 'r2', 'r3'], false);
    assert.equal(s.size, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL3 — shared glide engine wiring on both surfaces
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL3: createGlideSelect — one engine, both surfaces (v4.5.0)', () => {
  it('TC-SEL3.1: the factory exists and is instantiated for the photo grids and the report list', () => {
    assert.ok(indexHtml.includes('function createGlideSelect(opts)'), 'glide factory must exist');
    assert.ok(countOccurrences(indexHtml, 'createGlideSelect({') >= 2, 'both surfaces must build a controller');
    assert.ok(indexHtml.includes('function selWirePhotoGrid(el, key)'), 'photo grid wiring must exist');
    assert.ok(indexHtml.includes('function selWireReportList(list)'), 'report list wiring must exist');
  });

  it('TC-SEL3.2: the engine suppresses the trailing click after a stroke', () => {
    const body = extractFnBody(indexHtml, 'function createGlideSelect(opts)', 'createGlideSelect');
    assert.ok(body.includes('glideSuppressClickUntil'), 'suppression timestamp must exist');
    assert.ok(body.includes("addEventListener('click'"), 'a click listener must be installed');
    assert.ok(body.includes('e.stopPropagation()') && body.includes('e.preventDefault()'), 'suppressed clicks must be stopped');
    assert.ok(body.includes('opts.isEnabled'), 'the engine must be gated per surface');
  });

  it('TC-SEL3.3: a stroke applies its first item mode once per item (visited set)', () => {
    const body = extractFnBody(indexHtml, 'function createGlideSelect(opts)', 'createGlideSelect');
    assert.ok(body.includes('visited'), 'per-stroke visited set must exist');
    assert.ok(body.includes('mode: !opts.isSelected(v)'), 'stroke mode must come from the first item');
    assert.ok(body.includes('document.elementFromPoint'), 'move hit-testing must use elementFromPoint');
    assert.ok(body.includes('if (e.shiftKey) return;'), 'Shift+pointerdown must not start a stroke (range is click-driven)');
  });

  it('TC-SEL3.4: both surfaces enter select mode via a 450ms long-press', () => {
    assert.ok(countOccurrences(indexHtml, '}, 450);') >= 2, 'photo grid and report list must both arm a 450ms long-press');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL4 — photo surface: state sync, Sortable gate, batch bar, bulk delete
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL4: photo grids — select mode lifecycle (v4.5.0)', () => {
  it('TC-SEL4.1: renderFreePhotos wires the grid and re-syncs selection UI after every render', () => {
    const body = extractFnBody(indexHtml, 'function renderFreePhotos(key)', 'renderFreePhotos');
    assert.ok(body.includes('selWirePhotoGrid(el, key);'), 'renderFreePhotos must wire SEL-1 once per container');
    assert.ok(body.includes('syncPhotoSelUI(key);'), 'renderFreePhotos must re-apply SEL-1 UI after rebuilding the grid');
  });

  it('TC-SEL4.2: the grid Sortable is disabled while selecting and re-enabled on exit', () => {
    assert.ok(indexHtml.includes("el._sortable.option('disabled', true)"), 'sortable must be disabled in select mode');
    assert.ok(indexHtml.includes("el._sortable.option('disabled', false)"), 'sortable must be re-enabled on teardown');
  });

  it('TC-SEL4.3: the photo batch bar markup exists with count, Select All, Delete and Done', () => {
    assert.ok(indexHtml.includes('id="photoBatchBar"'), '#photoBatchBar must exist');
    assert.ok(indexHtml.includes('id="photoSelCount"'), 'count span must exist');
    assert.ok(indexHtml.includes('onclick="selPhotosSelectAll()"'), 'Select All must call selPhotosSelectAll');
    assert.ok(indexHtml.includes('onclick="selPhotosDelete()"'), 'Delete must call selPhotosDelete');
    assert.ok(indexHtml.includes('onclick="exitPhotoSelectMode()"'), 'Done must call exitPhotoSelectMode');
  });

  it('TC-SEL4.4: bulk photo delete = one confirm, exactly ONE pushHistory, slots cleared in place', () => {
    const body = extractFnBody(indexHtml, 'async function selPhotosDelete()', 'selPhotosDelete');
    assert.equal(countOccurrences(body, 'pushHistory('), 1, 'the whole batch must be a single undo step');
    assert.ok(body.includes('appConfirm(`Delete ${n} selected photo(s)?`'), 'one confirm for the whole batch');
    assert.ok(body.includes("D[key][i] = { photoSize: size, fullWidth: (size === 'full'), caption: '' }"), 'slots must be cleared in place like delFreePhoto');
    assert.ok(body.includes('getPhotoSize(D[key][i])'), 'slot size must be preserved from the cleared photo');
    assert.ok(body.includes('renderFreePhotos(key);') && body.includes('savePhotoChangeNow();'), 'must re-render and save like delFreePhoto');
  });

  it('TC-SEL4.5: select-all only takes slots that actually hold a photo', () => {
    const body = extractFnBody(indexHtml, 'function selPhotosSelectAll()', 'selPhotosSelectAll');
    assert.ok(body.includes('if (p && p.img)'), 'empty slots must not be selectable');
    const hasImg = extractFnBody(indexHtml, 'function photoSlotHasImg(key, i)', 'photoSlotHasImg');
    assert.ok(hasImg.includes('!!(p && p.img)'), 'selectability predicate must be img-based');
  });

  it('TC-SEL4.6: the Select/Done toolbar is a sibling before the grid, never a Sortable child', () => {
    const body = extractFnBody(indexHtml, 'function syncPhotoSelToolbar(key)', 'syncPhotoSelToolbar');
    assert.ok(body.includes('el.parentNode.insertBefore(bar, el)'), 'toolbar must be inserted before the grid element');
    assert.ok(body.includes("active ? 'Done' : 'Select'"), 'toolbar toggles Select/Done');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL5 — reports surface: glide, Shift range, Ctrl+A guard, Esc
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL5: report list — gestures on the existing select mode (v4.5.0)', () => {
  it('TC-SEL5.1: the row onclick select-mode branch supports Shift+click ranges', () => {
    assert.ok(indexHtml.includes('e.shiftKey && lastReportIndex !== null'), 'shift-range guard must exist in the row click path');
    assert.ok(indexHtml.includes('selRangeList(lastReportIndex, domIdx)'), 'range must be built with selRangeList over DOM indexes');
    assert.ok(indexHtml.includes('lastReportIndex = domIdx'), 'every toggle must move the range anchor');
  });

  it('TC-SEL5.2: updateBatchUI keeps the list glide-active class in sync with select mode', () => {
    const body = extractFnBody(indexHtml, 'function updateBatchUI()', 'updateBatchUI');
    assert.ok(body.includes("classList.toggle('glide-active', isSelectMode)"), 'updateBatchUI must sync the glide scroll-lock');
  });

  it('TC-SEL5.3: Ctrl+A never hijacks editable targets (caption textarea, search input)', () => {
    assert.ok(indexHtml.includes('isContentEditable'), 'contentEditable targets must be guarded');
    assert.ok(indexHtml.includes("t.tagName === 'TEXTAREA'"), 'textarea targets must be guarded');
    assert.ok(indexHtml.includes("t.tagName === 'INPUT'"), 'input targets must be guarded');
    assert.ok(indexHtml.includes('if (editable) return;'), 'the handler must bail out for editable targets');
  });

  it('TC-SEL5.4: Ctrl+A on reports selects exactly the rendered cards (post-filter DOM truth)', () => {
    assert.ok(
      indexHtml.includes("document.querySelectorAll('#reportsList .report-card')"),
      'report select-all must read the rendered cards, not the full reports array'
    );
  });

  it('TC-SEL5.5: Esc exits photo selection first, then report select mode', () => {
    assert.ok(indexHtml.includes("if (photoSel) exitPhotoSelectMode();"), 'Esc must exit photo select mode');
    assert.ok(indexHtml.includes('else if (isSelectMode) toggleSelectMode();'), 'Esc must exit report select mode');
  });

  it('TC-SEL5.6: the existing report batch machinery is untouched (selectAllReports not redefined)', () => {
    assert.equal(countOccurrences(indexHtml, 'function selectAllReports()'), 1, 'selectAllReports must keep its single original definition');
    assert.equal(countOccurrences(indexHtml, 'function toggleSelectMode()'), 1, 'toggleSelectMode must keep its single original definition');
    assert.equal(countOccurrences(indexHtml, 'async function delFreePhoto(key, i)'), 1, 'delFreePhoto must keep its single original definition');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-SEL6 — CSS: glide scroll-lock and selected-photo presentation
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-SEL6: SEL-1 styles (v4.5.0)', () => {
  it('TC-SEL6.1: glide-active locks touch action on both surfaces', () => {
    assert.ok(indexHtml.includes('.free-photos.glide-active'), 'photo grid glide lock rule must exist');
    assert.ok(indexHtml.includes('#reportsList.glide-active'), 'report list glide lock rule must exist');
    assert.ok(indexHtml.includes('touch-action: none;'), 'glide must disable browser touch scrolling');
  });

  it('TC-SEL6.2: selected photos get the module-theme ring and check badge', () => {
    assert.ok(indexHtml.includes('.free-photo-item.sel-on'), 'sel-on rule must exist');
    assert.ok(indexHtml.includes('box-shadow: 0 0 0 2px var(--module-theme)'), 'ring must use the module theme colour');
    assert.ok(indexHtml.includes(".free-photo-item.sel-on::after"), 'check badge must be an ::after on the item');
  });

  it('TC-SEL6.3: the photo select button meets touch target sizes', () => {
    assert.ok(indexHtml.includes('.photo-sel-btn'), 'toolbar button style must exist');
    assert.ok(indexHtml.includes('@media (pointer: coarse)'), 'coarse pointers must get the 44px target');
  });
});
