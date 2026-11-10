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
