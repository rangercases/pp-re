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

function loadModuleThemes() {
  const tm = indexHtml.match(/const MODULE_THEMES = \{([\s\S]*?)\n    \};/);
  assert.ok(tm, 'MODULE_THEMES must be present in index.html');
  return new Function(
    'DEFAULT_MODULES_PREPROD', 'DEFAULT_MODULES_PROTOTYPE', 'DEFAULT_MODULES_RECAP',
    `return {${tm[1]}}`
  )([], [], []);
}

function generatedHubHtml() {
  const themes = loadModuleThemes();
  const hexBody = extractFnBody(indexHtml, 'function hexToRgba(hex, alpha)', 'hexToRgba');
  const hubBody = extractFnBody(indexHtml, 'function renderHubCards()', 'renderHubCards');
  const grid = { innerHTML: '' };
  const docStub = { getElementById: (id) => (id === 'hubModuleGrid' ? grid : null) };
  const hexToRgba = new Function('hex', 'alpha', hexBody);
  new Function('document', 'MODULE_THEMES', 'hexToRgba',
    `function renderHubCards() {${hubBody}}\nrenderHubCards();`)(docStub, themes, hexToRgba);
  return grid.innerHTML;
}

// ─────────────────────────────────────────────────────────────────────────────
// INH-2 (v4.6.0) — quick wins from the inheritance audit:
//   F3  checklistPhotos editor container, F9 dead PDF badge branch,
//   F6  hub cards generated from MODULE_THEMES.hub by renderHubCards().
// INH-1 / INH-3 groups are appended in their own sections below.
// ─────────────────────────────────────────────────────────────────────────────

describe('TC-INH2-F3: checklistPhotos mounts in the editor like every free grid', () => {
  it('TC-INH2-F3.1: #checklistPhotos exists inside the sec_checklist markup', () => {
    const start = indexHtml.indexOf('id="sec_checklist"');
    assert.ok(start !== -1, 'sec_checklist must exist');
    const end = indexHtml.indexOf('id="sec_comparison"', start);
    const block = indexHtml.slice(start, end === -1 ? undefined : end);
    assert.ok(block.includes('<div class="free-photos" id="checklistPhotos"></div>'),
      'the checklist section must carry the shared free-photos container');
  });

  it('TC-INH2-F3.2: the render-all wiring reaches checklistPhotos via FREE_PHOTO_KEYS', () => {
    assert.ok(indexHtml.includes("'checklistPhotos'"), 'checklistPhotos must be a known photo key');
    assert.ok(countOccurrences(indexHtml, 'FREE_PHOTO_KEYS.forEach(k => renderFreePhotos(k));') >= 1,
      'the render-all loop must drive renderFreePhotos for every free key');
    assert.ok(indexHtml.includes("document.getElementById('checklistPhotos'),"),
      'the drag-mode Sortable sweep must include the checklist grid');
  });

  it('TC-INH2-F3.3: the PDF still prints checklistPhotos (editor/PDF parity restored)', () => {
    assert.ok(indexHtml.includes('const validChecklistPhotos = (D.checklistPhotos || [])'),
      'PDF checklist photo filtering must stay');
  });
});

describe('TC-INH2-F9: the unreachable isRecap badge branch is gone from the PDF strip', () => {
  const badgeHead = extract(
    indexHtml,
    /const pdfBadges = \[\];([\s\S]*?)\/\/ 2-4\./,
    'pdfBadges head region'
  );

  it('TC-INH2-F9.1: the watch-out badge is built exactly once, with no isRecap fork', () => {
    assert.ok(!badgeHead.includes('isRecap'), 'no isRecap branch may remain in the badge head');
    assert.equal(countOccurrences(badgeHead, 'pdfBadges.push'), 2, 'watch badge: one alert push + one zero push');
    assert.ok(badgeHead.includes('Watch-out${qm.watchCount > 1'), 'alert badge text preserved');
    assert.ok(badgeHead.includes('"0 Watch-outs"'), 'zero badge text preserved');
  });
});

describe('TC-INH2-F6: hub cards are generated from MODULE_THEMES.hub by one renderer', () => {
  it('TC-INH2-F6.1: no hand-written card markup remains — one container + one renderer', () => {
    assert.ok(indexHtml.includes('<div class="module-grid" id="hubModuleGrid">'), 'container must exist');
    assert.equal(countOccurrences(indexHtml, 'function renderHubCards()'), 1, 'exactly one hub renderer');
    assert.ok(!indexHtml.includes('<!-- MODULE 01'), 'the static card comments must be gone');
    const themes = loadModuleThemes();
    for (const key of ['pre-production', 'prototype', 'sample-review-recap']) {
      assert.ok(themes[key].hub, `${key} must carry a hub config`);
      assert.equal(themes[key].hub.tagline, 'Sample Review Report', `${key} tagline captured verbatim`);
    }
  });

  it('TC-INH2-F6.2: generated cards reproduce the captured texts, order and click wiring', () => {
    const hub = generatedHubHtml();
    const cards = [...hub.matchAll(/<div class="craft-module-card" id="(cardModule\w+)" onclick="openModule\('([^']+)'\)"/g)]
      .map(m => ({ id: m[1], mod: m[2] }));
    assert.deepEqual(cards, [
      { id: 'cardModulePreProd', mod: 'pre-production' },
      { id: 'cardModulePrototype', mod: 'prototype' },
      { id: 'cardModuleRecap', mod: 'sample-review-recap' }
    ]);
    const titles = [...hub.matchAll(/<div class="craft-card-title">([^<]*)<\/div>/g)].map(m => m[1]);
    assert.deepEqual(titles, ['Pre-Production', 'Prototype', 'Recap'], 'card titles captured verbatim');
    const nums = [...hub.matchAll(/craft-card-num-box"[^>]*>(\d{2})</g)].map(m => m[1]);
    assert.deepEqual(nums, ['01', '02', '03']);
    const opens = [...hub.matchAll(/onclick="event\.stopPropagation\(\); openModule\('([^']+)'\)">OPEN</g)].map(m => m[1]);
    assert.deepEqual(opens, ['pre-production', 'prototype', 'sample-review-recap'], 'OPEN buttons keep openModule wiring');
  });

  it('TC-INH2-F6.3: [NEW] strips and badges come from config, colours stay per-module', () => {
    const hub = generatedHubHtml();
    assert.equal(countOccurrences(hub, '[NEW]'), 2, 'only modules 02/03 carry the [NEW] strip');
    assert.ok(!hub.split('cardModulePrototype')[0].includes('[NEW]'), 'module 01 has no [NEW] strip');
    // Badge styles: 02/03 byte-identical to the old hand-written inline styles;
    // 01 now spells out the same colours its class defaults resolved to.
    assert.ok(hub.includes('style="background:#F7EFEA; color:#924D2C; border-color:rgba(146, 77, 44, 0.25);"'), 'prototype badge');
    assert.ok(hub.includes('style="background:#F4F4F5; color:#52525B; border-color:rgba(82, 82, 91, 0.25);"'), 'recap badge');
    assert.ok(hub.includes('style="background:#E8F6F0; color:#0A7E5C; border-color:rgba(10, 126, 92, 0.25);"'), 'pre-production badge');
    assert.ok(hub.includes('style="background-color: #0A7E5C;">01<'), 'num box 01 uses the module theme colour');
    assert.ok(hub.includes('style="background-color: #924D2C;">02<'), 'num box 02 uses the module theme colour');
    assert.ok(hub.includes('style="background-color: #52525B;">03<'), 'num box 03 uses the module theme colour');
  });

  it('TC-INH2-F6.4: renderHubCards runs once at startup so the hub is populated on load', () => {
    const body = extractFnBody(indexHtml, 'function renderHubCards()', 'renderHubCards');
    assert.ok(body.includes("document.getElementById('hubModuleGrid')"), 'renderer targets the container');
    assert.ok(body.includes('Object.values(MODULE_THEMES).map'), 'cards iterate the module config');
    const after = indexHtml.slice(indexHtml.indexOf('function renderHubCards()'));
    assert.ok(after.includes('\n    renderHubCards();'), 'the renderer must be invoked at startup');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-INH1 (F1 + F2): ONE dual-slot renderer for Watch Out / Testing /
// Assembly, parameterized by DUAL_SLOT_CONFIGS, with SEL-1 wired in.
// Rendered-output equivalence with the three deleted implementations was
// verified during development with a fake-DOM harness (old vs new slot HTML
// identical modulo handler names); these tests pin the structure and the
// per-section adapters so the unification cannot silently fork again.
// ─────────────────────────────────────────────────────────────────────────────
function loadDualConfigs(stubs = {}) {
  const marker = 'const DUAL_SLOT_CONFIGS = ';
  const start = indexHtml.indexOf(marker);
  assert.ok(start !== -1, 'DUAL_SLOT_CONFIGS must exist');
  const end = indexHtml.indexOf('\n    };', start);
  assert.ok(end !== -1, 'DUAL_SLOT_CONFIGS literal must terminate');
  const lit = indexHtml.slice(start + marker.length, end + '\n    }'.length);
  const escBody = extractFnBody(indexHtml, 'function escapeHtml(str)', 'escapeHtml');
  const factory = new Function('D', 'isRecapReport', 'woStatusChipHtml',
    `function escapeHtml(str) {${escBody}}\nconst DUAL_SLOT_CONFIGS = (${lit});\nreturn DUAL_SLOT_CONFIGS;`);
  return factory(stubs.D || { bvRows: [] }, stubs.isRecapReport || (() => false), stubs.woStatusChipHtml || (() => ''));
}

describe('TC-INH1: unified dual-slot renderer (v4.6.0)', () => {
  it('TC-INH1.1: one renderer, three thin wrappers, old implementations deleted', () => {
    assert.equal(countOccurrences(indexHtml, 'function renderDualSlotPhotos(cfg)'), 1);
    assert.ok(indexHtml.includes('function renderWatchoutPhotos() {\n      renderDualSlotPhotos(DUAL_SLOT_CONFIGS.watchoutPhotos);'));
    assert.ok(indexHtml.includes('function renderTestingPhotos() {\n      renderDualSlotPhotos(DUAL_SLOT_CONFIGS.testingPhotos);'));
    assert.ok(indexHtml.includes('function renderAssemblyPhotos() {\n      renderDualSlotPhotos(DUAL_SLOT_CONFIGS.assemblyPhotos);'));
    for (const gone of ['setWatchoutPhotoLayout', 'editWatchoutPhoto', 'delWatchoutPhoto',
      'setTestingPhotoLayout', 'editTestingPhoto', 'delTestingPhoto',
      'setAssemblyPhotoLayout', 'editAssemblyPhoto', 'delAssemblyPhoto', 'removeWatchoutSubPhoto', 'removeTestingSubPhoto', 'removeAssemblySubPhoto']) {
      assert.ok(!indexHtml.includes(gone), `${gone} must be gone (unified into the dual-slot helpers)`);
    }
    for (const unified of ['function setDualPhotoLayout(key, index, layout)', 'function removeDualSubPhoto(key, index)', "function editDualPhoto(key, index, subType = 'main')", "async function delDualPhoto(key, index, subType = 'main')"]) {
      assert.equal(countOccurrences(indexHtml, unified), 1, `${unified} must exist exactly once`);
    }
  });

  it('TC-INH1.2: per-section configs keep the three grids structurally distinct', () => {
    const cfgs = loadDualConfigs();
    assert.equal(cfgs.watchoutPhotos.slotClass, 'watchout-slot');
    assert.equal(cfgs.watchoutPhotos.idPrefix, 'wph');
    assert.equal(cfgs.watchoutPhotos.subEmptyVariant, 'adaptive');
    assert.equal(cfgs.testingPhotos.slotClass, 'testing-slot watchout-slot');
    assert.equal(cfgs.testingPhotos.idPrefix, 'tph');
    assert.equal(cfgs.testingPhotos.subEmptyVariant, 'column');
    assert.equal(cfgs.assemblyPhotos.slotClass, 'assembly-slot watchout-slot');
    assert.equal(cfgs.assemblyPhotos.idPrefix, 'asph');
    assert.equal(cfgs.assemblyPhotos.subEmptyVariant, 'adaptive');
    assert.ok(cfgs.assemblyPhotos.sortableFilter.includes('.assembly-caption-box'), 'assembly Sortable filter keeps its caption exclusions');
    assert.ok(!cfgs.watchoutPhotos.sortableFilter.includes('.assembly-caption-box'));
    assert.equal(typeof cfgs.watchoutPhotos.newItem, 'function');
    assert.deepEqual(cfgs.watchoutPhotos.newItem(0), { img: null, original: null, imgSub: null, originalSub: null, photoLayout: 'single', caption: '' });
  });

  it('TC-INH1.3: caption adapters — testing syncs from D.bvRows, others read the stored caption', () => {
    const cfgs = loadDualConfigs({ D: { bvRows: [{ test: '  Drop test 500mm  ' }] } });
    assert.equal(cfgs.testingPhotos.readCaption(0, { caption: '' }), 'Drop test 500mm');
    assert.equal(cfgs.testingPhotos.readCaption(0, { caption: ' explicit ' }), ' explicit ');
    // Pre-existing quirk, preserved on purpose: the original checked
    // caption !== '' (no trim), so a whitespace-only caption wins over the
    // bvRows fallback and renders verbatim.
    assert.equal(cfgs.testingPhotos.readCaption(0, { caption: '   ' }), '   ');
    assert.equal(cfgs.testingPhotos.readCaption(9, null), '');
    assert.equal(cfgs.watchoutPhotos.readCaption(0, { caption: 'note' }), 'note');
    assert.equal(cfgs.watchoutPhotos.readCaption(0, null), '');
    assert.equal(cfgs.assemblyPhotos.readCaption(0, { caption: 'step' }), 'step');
    const tHtml = cfgs.testingPhotos.captionHtml(cfgs.testingPhotos, 0, { caption: '' });
    assert.ok(tHtml.includes('syncTestingPhotoCaption(0)'), 'testing caption box must keep the Sync button');
    assert.ok(tHtml.includes('Default: Drop test 500mm'), 'testing placeholder must show the bvRows default');
    assert.ok(tHtml.includes('oninput="updateCaption(\'testingPhotos\', 0, this.value, this)"'));
    const wHtml = cfgs.watchoutPhotos.captionHtml(cfgs.watchoutPhotos, 2, { caption: 'edge chip' });
    assert.ok(wHtml.includes('Quality Watch Out notes'), 'watchout placeholder preserved');
    assert.ok(wHtml.includes('>edge chip</textarea>'));
    const aHtml = cfgs.assemblyPhotos.captionHtml(cfgs.assemblyPhotos, 1, { caption: '' });
    assert.ok(aHtml.includes('assembly-caption-box watchout-caption-box'), 'assembly caption box classes preserved');
    assert.ok(aHtml.includes('Assembly instructions'), 'assembly placeholder preserved');
  });

  it('TC-INH1.4: delete-button + assembly legacy-string adapters', () => {
    const delBtnBody = extractFnBody(indexHtml, 'function dualSlotDelBtnHtml(cfg, i)', 'dualSlotDelBtnHtml');
    const delBtn = new Function('cfg', 'i', `function dualSlotDelBtnHtml(cfg, i) {${delBtnBody}}\nreturn dualSlotDelBtnHtml;`)();
    const cfgs = loadDualConfigs();
    assert.ok(delBtn(cfgs.watchoutPhotos, 1).includes('dim-del-slot-btn'));
    assert.ok(delBtn(cfgs.watchoutPhotos, 1).includes("delFreeSlot('watchoutPhotos', 1)"));
    assert.ok(delBtn(cfgs.testingPhotos, 1).includes('pact del'), 'testing keeps its styled .pact del button');
    assert.ok(delBtn(cfgs.testingPhotos, 1).includes("delFreeSlot('testingPhotos', 1)"));
    assert.ok(delBtn(cfgs.assemblyPhotos, 1).includes('dim-del-slot-btn'));
    assert.ok(delBtn(cfgs.assemblyPhotos, 1).includes("delFreeSlot('assemblyPhotos', 1)"));
    assert.equal(cfgs.assemblyPhotos.mainImg('data:LEGACY'), 'data:LEGACY');
    assert.equal(cfgs.assemblyPhotos.mainImg({ img: 'data:X' }), 'data:X');
    assert.equal(cfgs.assemblyPhotos.mainImg(null), null);
    assert.equal(cfgs.watchoutPhotos.mainImg({ img: 'data:Y' }), 'data:Y');
  });

  it('TC-INH1.5: the Recap status-chip hook exists ONLY in the Watch Out config', () => {
    const recap = loadDualConfigs({ isRecapReport: () => true, woStatusChipHtml: (i) => `CHIP${i}` });
    const other = loadDualConfigs({ isRecapReport: () => false, woStatusChipHtml: (i) => `CHIP${i}` });
    const hook = recap.watchoutPhotos.extraSlotHtml(3, {});
    assert.ok(hook.includes('wo-action-bar') && hook.includes('CHIP3'), 'Recap watchout slots get the chip bar');
    assert.equal(other.watchoutPhotos.extraSlotHtml(3, {}), '', 'non-Recap watchout slots get no chip bar');
    assert.equal(recap.testingPhotos.extraSlotHtml(3, {}), '', 'testing has no chip hook');
    assert.equal(recap.assemblyPhotos.extraSlotHtml(3, {}), '', 'assembly has no chip hook');
    assert.equal(typeof recap.watchoutPhotos.beforeRender, 'function', 'watchout keeps its menu-close hook');
    assert.equal(recap.testingPhotos.beforeRender, null);
    assert.equal(recap.assemblyPhotos.beforeRender, null);
  });
});

describe('TC-INH1/F2: SEL-1 wired into the dual-slot grids (v4.6.0)', () => {
  it('TC-INH1.6: the unified renderer wires selection like the free grids', () => {
    const body = extractFnBody(indexHtml, 'function renderDualSlotPhotos(cfg)', 'renderDualSlotPhotos');
    assert.ok(body.includes('selWirePhotoGrid(el, key);'), 'dual grids must be SEL-1 wired');
    assert.ok(body.includes('syncPhotoSelUI(key);'), 'dual grids must restore selection UI after render');
    assert.ok(indexHtml.includes('.watchout-slot.sel-on'), 'dual slots need the selected ring style');
  });

  it('TC-INH1.7: item selectors + selectable predicate are per-grid', () => {
    assert.ok(indexHtml.includes("PHOTO_SEL_ITEM_SELECTORS = { watchoutPhotos: '.watchout-slot', testingPhotos: '.testing-slot', assemblyPhotos: '.assembly-slot' }"));
    const selBody = extractFnBody(indexHtml, 'function photoSelItemSelector(key)', 'photoSelItemSelector');
    const mapBody = indexHtml.match(/const PHOTO_SEL_ITEM_SELECTORS = \{[^}]*\};/);
    assert.ok(mapBody, 'selector map must be a plain literal');
    const selectorFor = new Function(`${mapBody[0]}\nfunction photoSelItemSelector(key) {${selBody}}\nreturn photoSelItemSelector;`)();
    assert.equal(selectorFor('watchoutPhotos'), '.watchout-slot');
    assert.equal(selectorFor('testingPhotos'), '.testing-slot');
    assert.equal(selectorFor('assemblyPhotos'), '.assembly-slot');
    assert.equal(selectorFor('prodPhotos'), '.free-photo-item', 'free grids keep their selector');
    const wireBody = extractFnBody(indexHtml, 'function selWirePhotoGrid(el, key)', 'selWirePhotoGrid');
    assert.ok(wireBody.includes('const itemSel = photoSelItemSelector(key);'));
    assert.ok(wireBody.includes('itemSelector: itemSel'), 'the glide engine must target the grid item class');
  });

  it('TC-INH1.8: bulk delete follows each grid\u2019s own delete semantics', () => {
    const body = extractFnBody(indexHtml, 'async function selPhotosDelete()', 'selPhotosDelete');
    assert.ok(body.includes('DUAL_SLOT_CONFIGS[key]'), 'dual grids must take their own delete branch');
    assert.ok(body.includes('D[key].splice(i, 1)'), 'dual slots are REMOVED from the array');
    assert.ok(body.includes('renderDualSlotPhotos(DUAL_SLOT_CONFIGS[key])'), 'dual grids re-render via the unified renderer');
    assert.ok(body.includes("D[key][i] = { photoSize: size, fullWidth: (size === 'full'), caption: '' }"), 'free grids keep clear-in-place');
    assert.ok(body.includes('renderFreePhotos(key);'), 'free grids re-render via renderFreePhotos');
  });
});
