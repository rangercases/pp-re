import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// The whole launcher hub: from the first module card comment to the LEVEL 2
// workspace comment that follows the hub grid (same slicing pattern as
// recap_logo.test.js / recap_card_title.test.js).
function hubBlock() {
  const start = indexHtml.indexOf('<!-- MODULE 01');
  assert.ok(start !== -1, 'MODULE 01 marker must be present in index.html');
  const end = indexHtml.indexOf('<!-- LEVEL 2', start);
  assert.ok(end !== -1, 'LEVEL 2 marker must follow the hub grid in index.html');
  return indexHtml.slice(start, end);
}

// ─────────────────────────────────────────────────────────────────────────────
// TC-HUB1 — Hub shows exactly the 3 active modules; module 04 removed (v4.2.1)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-HUB1: hub has exactly 3 active cards, module 04 Mass Production is gone (v4.2.1)', () => {
  it('TC-HUB1.1: the hub grid contains exactly the 01/02/03 cards, in order, unrenumbered', () => {
    const hub = hubBlock();
    const cardIds = [...hub.matchAll(/<div class="craft-module-card" id="(cardModule\w+)"/g)].map(m => m[1]);
    assert.deepEqual(
      cardIds,
      ['cardModulePreProd', 'cardModulePrototype', 'cardModuleRecap'],
      'hub must contain exactly the 3 active module cards in order'
    );
    const numBoxes = [...hub.matchAll(/craft-card-num-box"[^>]*>(\d{2})</g)].map(m => m[1]);
    assert.deepEqual(numBoxes, ['01', '02', '03'], 'num boxes must stay 01/02/03 — no renumbering, no 04');
  });

  it('TC-HUB1.2: no module 04 placeholder markup remains anywhere in index.html', () => {
    for (const gone of ['Mass Production', 'Factory Inspection', '[UPCOMING]', 'MODULE 04', '🏭', "'mass-production'"]) {
      assert.ok(!indexHtml.includes(gone), `"${gone}" must no longer exist in index.html`);
    }
    assert.ok(!hubBlock().includes('PLANNED'), 'the PLANNED badge of the removed card must be gone from the hub');
  });
});
