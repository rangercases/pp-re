import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// ── CSS slicing helpers ──────────────────────────────────────────────────────
// Return the balanced { ... } body starting at the first '{' at/after `from`.
function balancedBody(text, from) {
  const open = text.indexOf('{', from);
  assert.ok(open !== -1, 'expected an opening brace');
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  assert.fail('unbalanced braces while slicing CSS');
}

// Concatenate every @media block whose prelude matches `prelude` (there are
// several max-width:640px blocks in the stylesheet; cascade-wise the S3 rules
// live in the main one and nothing else overrides these selectors).
function mediaBlocks(prelude) {
  const blocks = [];
  let idx = 0;
  for (;;) {
    const at = indexHtml.indexOf(prelude, idx);
    if (at === -1) break;
    blocks.push(balancedBody(indexHtml, at));
    idx = at + prelude.length;
  }
  return blocks.join('\n');
}

const css640 = mediaBlocks('@media (max-width: 640px)');
const cssStandalone = mediaBlocks('@media (display-mode: standalone)');

// Body of the LAST rule whose selector starts a line and matches `selector`
// (line-anchored so scoped selectors like ".x .tab {" do not match ".tab").
function ruleIn(css, selector) {
  const re = new RegExp(`\\n\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{`, 'g');
  let m;
  let last = null;
  while ((m = re.exec(css)) !== null) last = m;
  assert.ok(last, `rule "${selector}" must exist`);
  return balancedBody(css, last.index);
}

// Body of the first rule in the whole file whose selector matches `regex`.
function firstRuleMatching(regex) {
  const m = regex.exec(indexHtml);
  assert.ok(m, `rule matching ${regex} must exist`);
  return balancedBody(indexHtml, m.index);
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-S3 — Shared layout frame (v4.3.0): one phone frame for all 3 modules.
// Colours/theme are intentionally per-module and out of scope here.
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-S3: shared phone layout frame (v4.3.0)', () => {
  it('TC-S3.1: topbar — natural-width tracks, 40px icon commands, compact save state (phone only)', () => {
    const topbar = ruleIn(css640, '.topbar');
    assert.ok(topbar.includes('grid-template-columns: auto 1fr auto'),
      'phone topbar must size brand/actions naturally and flex the centre');

    // Labelled commands collapse to the same 40px box as .icon-btn.
    const m = /#btnPreview,\s*#btnExport\s*\{/.exec(css640);
    assert.ok(m, 'a grouped #btnPreview/#btnExport rule must exist in the <=640 block');
    const grouped = balancedBody(css640, m.index);
    assert.ok(grouped.includes('width: 40px') && grouped.includes('height: 40px'),
      'Preview/PDF must be 40x40 icon buttons on phones');
    const exportBtn = ruleIn(css640, '#btnExport');
    assert.ok(exportBtn.includes('border-radius: 50%'),
      'PDF keeps its black round look on phones');

    // Labels are hidden on phones; the save line can ellipsise.
    const lbl = ruleIn(css640, '.topbar-btn .btn-lbl');
    assert.ok(lbl.includes('display: none'), '.btn-lbl must be hidden on phones');
    const save = ruleIn(css640, '.save-state-text');
    assert.ok(save.includes('text-overflow: ellipsis'),
      'save-state text must ellipsise inside the centre cell');

    // Compact save-state rendering exists in JS.
    assert.ok(indexHtml.includes('function renderSaveStateText()'),
      'renderSaveStateText must exist');
    assert.ok(indexHtml.includes("'✓ Saved'") || indexHtml.includes('"✓ Saved"'),
      'compact phone save text must be "✓ Saved"');
    assert.ok(indexHtml.includes("saveStatePhoneQuery"),
      'save-state rendering must be driven by the 640px media query');

    // Desktop topbar button size is untouched (base rule precedes all media).
    const baseBtn = firstRuleMatching(/\n\s*\.topbar-btn\s*\{/);
    assert.ok(baseBtn.includes('height: 32px'),
      'desktop .topbar-btn height must stay 32px');
  });

  it('TC-S3.2: tabs — 36px tall on phones, 12px wrap padding, right-edge scroll fade', () => {
    const tab = ruleIn(css640, '.tab');
    assert.ok(tab.includes('height: 36px'), 'phone tabs must be 36px tall');
    assert.ok(tab.includes('padding: 8px 14px'), 'phone tabs must use 8px 14px padding');
    const wrap = ruleIn(css640, '.tabs-wrap');
    assert.ok(wrap.includes('padding: 0 12px'), 'tabs wrap side padding must be 12px on phones');
    assert.ok(wrap.includes('mask-image') && wrap.includes('linear-gradient(to right'),
      'tabs wrap must fade its right edge to hint scrollability');
  });

  it('TC-S3.3: form grid — exactly one column on phones in ALL modules (Recap span root cause)', () => {
    const grid = ruleIn(css640, '.form-grid');
    assert.ok(grid.includes('grid-template-columns: 1fr !important'),
      'phone form grid must be a single !important column');
    // The root-cause fix: every cell span is neutralised, not just the
    // inline-styled ones the old attribute-selector rule could see.
    const cell = ruleIn(css640, '.form-grid > .fcell');
    assert.ok(cell.includes('grid-column: span 1 !important'),
      'all form cells must be span 1 on phones (kills the implicit 2nd track)');
    // Desktop keeps the Recap reviewer span (2-col layout unchanged >640px).
    // INH-3/F4: the span is configuration now — the SHARED .fcell-span2 rule,
    // switched by the Recap form config (span2Ids); no module-scoped CSS.
    const reviewer = firstRuleMatching(/\.form-grid > \.fcell\.fcell-span2\s*\{/);
    assert.ok(reviewer.includes('grid-column: span 2'),
      'desktop span-2 rule must be preserved (shared, config-driven)');
    assert.ok(indexHtml.includes("span2Ids: ['fcellReviewer']"),
      'the Recap form config must carry the reviewer span');
    assert.ok(!/body\.recap-mode\s+#/.test(indexHtml),
      'no module-scoped form CSS rules may remain');
    // Long values cannot force a cell wider than its track.
    const inputs = firstRuleMatching(/\.fcell input,\s*\.fcell textarea,\s*\.fcell select\s*\{/);
    assert.ok(inputs.includes('min-width: 0'), '.fcell inputs must have min-width: 0');
  });

  it('TC-S3.4: batch bar — one anchoring law, icon-only on phones, version mark hides in select mode', () => {
    const base = firstRuleMatching(/\n\s*\.batch-bar\s*\{/);
    assert.ok(base.includes('bottom: max(16px, env(safe-area-inset-bottom))'),
      'batch bar base rule must anchor with the safe-area inset');
    assert.ok(base.includes('max-width: calc(100vw - 24px)'),
      'batch bar must never be wider than the viewport');
    assert.ok(!/\n\s*\.batch-bar\s*\{/.test(cssStandalone),
      'the standalone block must no longer carry a .batch-bar rule overriding the bottom');

    const btn = ruleIn(css640, '.batch-btn');
    assert.ok(btn.includes('height: 40px'), 'batch buttons must be 40px on phones');
    const btnSpan = ruleIn(css640, '.batch-btn > span');
    assert.ok(btnSpan.includes('display: none'), 'batch button labels must hide on phones');
    const word = ruleIn(css640, '.batch-pill-count .batch-count-word');
    assert.ok(word.includes('display: none'), 'the count word must hide on phones (bare number pill)');

    // Count markup/JS split: number in #selectedCountText, word static.
    assert.ok(indexHtml.includes('<span id="selectedCountText">0</span> <span class="batch-count-word">selected</span>'),
      'count number and word must be separate spans');
    assert.ok(indexHtml.includes('countEl.textContent = String(selectedReportIds.size)'),
      'updateBatchUI must write only the number');

    // Version mark: select mode reuses the body-state hide mechanism.
    assert.ok(indexHtml.includes('body.select-mode #appVersionMark'),
      'the mark hide rule must cover body.select-mode');
    assert.ok(indexHtml.includes("document.body.classList.toggle('select-mode', isSelectMode)"),
      'toggleSelectMode must flag body.select-mode');
  });

  it('TC-S3.5: save bar — arrow-only at 44px on phones, labels kept for desktop, theme fill untouched', () => {
    assert.ok(indexHtml.includes('id="btnPrevSection" onclick="prevSection()" title="Previous section" aria-label="Previous section">← <span class="sbar-lbl">Back</span>'),
      'BACK button must keep its arrow, wrap its label, and carry title/aria-label');
    assert.ok(indexHtml.includes('id="btnNextSection" onclick="nextSection()" title="Next section" aria-label="Next section"><span class="sbar-lbl">Next</span> →'),
      'NEXT button must keep its arrow, wrap its label, and carry title/aria-label');
    const btn = ruleIn(css640, '.sbar-btn');
    assert.ok(btn.includes('min-height: 44px'), 'save-bar buttons must be at least 44px on phones');
    const lbl = ruleIn(css640, '.sbar-btn .sbar-lbl');
    assert.ok(lbl.includes('display: none'), 'save-bar labels must hide on phones');
    const pri = firstRuleMatching(/\n\s*\.sbar-btn\.pri\s*\{/);
    assert.ok(pri.includes('var(--module-theme'), 'NEXT must keep its module-theme fill');
  });

  it('TC-S3.6: workspace dropdown stays inside the viewport on phones', () => {
    const menu = ruleIn(css640, '.workspace-dropdown-menu');
    assert.ok(menu.includes('right: max(12px, env(safe-area-inset-right))'),
      'workspace dropdown must anchor clear of the right screen corner on phones');
  });
});
