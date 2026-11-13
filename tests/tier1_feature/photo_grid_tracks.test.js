import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// ── CSS slicing helpers (same approach as shared_frame_s3.test.js) ───────────
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

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Bodies of EVERY rule whose selector starts a line and matches `selector`
// (line-anchored so scoped selectors like ".x .tab {" do not match ".tab").
function allRuleBodies(selector) {
  const re = new RegExp(`\\n\\s*${escapeRe(selector)}\\s*\\{`, 'g');
  const bodies = [];
  let m;
  while ((m = re.exec(indexHtml)) !== null) bodies.push(balancedBody(indexHtml, m.index));
  return bodies;
}

// ── v4.6.1: photo-grid track fix ─────────────────────────────────────────────
// Root cause (live-measured 2026-11-13): .free-photos used
// `grid-template-columns: 1fr 1fr`. A bare 1fr is minmax(auto, 1fr), and the
// .add-photo-btn tile's aspect-ratio: 4/3 inflates one track's automatic
// minimum, so the columns rendered 263px vs 441px and the dual-slot topbar
// pills clipped. The fix caps the track minimum at 0 (minmax(0, 1fr)) and
// gives every grid item min-width: 0 — the S3 form-grid precedent. These
// tests pin the stylesheet so the bare-1fr pattern cannot creep back.
describe('Photo grid tracks (v4.6.1)', () => {
  it('TC-GRID1: .free-photos uses minmax(0, 1fr) tracks, never a bare 1fr 1fr', () => {
    const bodies = allRuleBodies('.free-photos');
    assert.equal(bodies.length, 1, '.free-photos must have exactly one base rule');
    assert.ok(
      bodies[0].includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'),
      '.free-photos tracks must be minmax(0, 1fr) minmax(0, 1fr)'
    );
    assert.ok(
      !bodies[0].includes('grid-template-columns: 1fr 1fr'),
      '.free-photos must not use bare 1fr 1fr tracks'
    );
  });

  it('TC-GRID2: every photo-grid item base rule carries min-width: 0', () => {
    // The aspect-ratio-bearing layout rule of each item class must opt out
    // of the automatic minimum size, or its content re-inflates the track.
    for (const selector of ['.free-photo-item', '.photo-slot', '.add-photo-btn']) {
      const layout = allRuleBodies(selector).find((b) => b.includes('aspect-ratio: 4/3'));
      assert.ok(layout, `${selector} must have a layout rule with aspect-ratio: 4/3`);
      assert.ok(
        layout.includes('min-width: 0'),
        `${selector} layout rule must contain min-width: 0`
      );
    }
    // .dim-slot has a single base rule.
    const dimSlot = allRuleBodies('.dim-slot');
    assert.equal(dimSlot.length, 1, '.dim-slot must have exactly one base rule');
    assert.ok(dimSlot[0].includes('min-width: 0'), '.dim-slot must contain min-width: 0');
    // The dual-slot grids share one combined base rule.
    const dualAt = indexHtml.indexOf('\n    .assembly-slot,');
    assert.ok(dualAt !== -1, 'combined dual-slot rule must exist');
    const dual = balancedBody(indexHtml, dualAt);
    assert.ok(dual.includes('min-width: 0'), 'dual-slot base rule must contain min-width: 0');
  });

  it('TC-GRID3: .dim-grid two-column tracks are minmax(0, 1fr) everywhere they are declared', () => {
    const bodies = allRuleBodies('.dim-grid');
    assert.ok(bodies.length >= 2, '.dim-grid base + tablet rules must exist');
    for (const body of bodies) {
      assert.ok(
        !body.includes('grid-template-columns: 1fr 1fr'),
        'no .dim-grid rule may use bare 1fr 1fr tracks'
      );
    }
    assert.ok(
      bodies[0].includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'),
      '.dim-grid base rule must use minmax(0, 1fr) tracks'
    );
    const tablet = bodies.find((b) => b.includes('gap: 14px'));
    assert.ok(tablet, '.dim-grid tablet override must exist');
    assert.ok(
      tablet.includes('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)'),
      '.dim-grid tablet override must use minmax(0, 1fr) tracks'
    );
  });
});
