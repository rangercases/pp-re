// TC-R07 — Recap page 1: full-size cover photos enlarged + QUALITY SUMMARY
// hidden when it has no content (Hung, 2026-11-25). His Paula export had
// both covers flagged full-size, but the pair box was 125x68mm, so 4:3
// photos drew at only 90.7x68mm and the page looked unbalanced; his
// target format draws them 125x94mm. And the QS title printed
// unconditionally, leaving a bare title over half a blank page when no
// watch-out had a disposition (Paula: 3 watch-outs, none decided).
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
  return match[1];
}

const addImgBody = extract(
  indexHtml,
  /const addImg = \(src, x, iy, iw, ih, opts\) => \{([\s\S]*?)\n      \};/,
  'addImg helper (with opts)'
);

function makeAddImg(getProps) {
  const calls = [];
  const doc = {
    getImageProperties: (src) => getProps(src),
    addImage: (...a) => calls.push(['addImage', ...a])
  };
  const fn = new Function(
    'doc', 'pdfImageMap', 'pdfFailedImages',
    `return ((src, x, iy, iw, ih, opts) => {${addImgBody}\n  });`
  )(doc, null, []);
  return { fn, calls };
}


// ─── Cover pair sizing: Recap gets the tall box, other modules keep 68 ───
const pairBlock = extract(
  indexHtml,
  /(if \(numFull >= 2\) \{\s+largePw = 125;\s+largePh = pdfLayout\.coverFullPairH \|\| 68;\s+smallPw = \(totalContentW - gapX\) \/ 2;\s+smallPh = 56;\s+\})/,
  'numFull>=2 cover sizing block'
);
const sizePair = new Function(
  'pdfLayout', 'totalContentW', 'gapX',
  `let largePw, largePh, smallPw, smallPh; let numFull = 2; ${pairBlock}\nreturn { largePw, largePh };`
);

describe('TC-R07: Recap full-cover pair enlarged, QS hidden when empty', () => {
  it('TC-R07.1: only the Recap pdfLayout carries coverFullPairH: 96', () => {
    const occurrences = indexHtml.match(/coverFullPairH: 96/g) || [];
    assert.equal(occurrences.length, 1, 'exactly one module config sets the tall pair box');
    const recapLayout = extract(indexHtml, /(coverTitlesBlank: true, coverFullPairH: 96)/, 'Recap pdfLayout tail');
    assert.ok(recapLayout.includes('coverFullPairH: 96'));
  });

  it('TC-R07.2: pair box height resolves to 96 for Recap, 68 elsewhere', () => {
    assert.deepEqual(sizePair({ coverFullPairH: 96 }, 182, 4), { largePw: 125, largePh: 96 });
    assert.deepEqual(sizePair({}, 182, 4), { largePw: 125, largePh: 68 });
  });

  it('TC-R07.3: a 4:3 cover draws 125x93.75 in the new box vs 90.7x68 in the old', () => {
    const { fn } = makeAddImg(() => ({ width: 1100, height: 825 }));
    const big = fn('img', 0, 0, 125, 96);
    assert.ok(Math.abs(big.w - 125) < 1e-6 && Math.abs(big.h - 93.75) < 1e-6, `new box draws ${big.w}x${big.h}`);
    const old = fn('img', 0, 0, 125, 68);
    assert.ok(Math.abs(old.w - 90.6667) < 0.01 && Math.abs(old.h - 68) < 1e-6, `old box draws ${old.w}x${old.h}`);
  });

  it('TC-R07.4: tall Recap covers flow to a continuation page instead of clipping', () => {
    const guards = indexHtml.match(/if \(pdfLayout\.coverFullPairH && y \+ ph > BOTTOM_LIMIT\) addHeader\('OVERVIEW'\);/g) || [];
    assert.equal(guards.length, 2, 'guard before full covers and before normal rows inside the full branch');
  });

  it('TC-R07.5: qsHasContent truth table — the Paula case hides the block', () => {
    const expr = extract(
      indexHtml,
      /const qsHasContent = (recapSummary\.total === 0 \|\| !!mainText \|\| recapChecklist\.total > 0);/,
      'qsHasContent gate'
    );
    const gate = new Function('recapSummary', 'mainText', 'recapChecklist', `return (${expr});`);
    assert.equal(gate({ total: 3 }, '', { total: 0 }), false, 'Paula: watch-outs exist, none decided, no checklist -> hidden');
    assert.equal(gate({ total: 0 }, '', { total: 0 }), true, 'zero watch-outs still prints the check line');
    assert.equal(gate({ total: 3 }, '2 main watch-outs:', { total: 0 }), true, 'main watch-outs -> shown');
    assert.equal(gate({ total: 3 }, '', { total: 34 }), true, 'checklist tally alone -> shown');
  });

  it('TC-R07.6: the QS title prints only inside the gate', () => {
    const gateIdx = indexHtml.indexOf('if (qsHasContent) {');
    const titleIdx = indexHtml.indexOf('doc.text("QUALITY SUMMARY", M, y); y += 6.5;');
    assert.ok(gateIdx > -1 && titleIdx > gateIdx, 'title is downstream of the gate');
    assert.ok(titleIdx - gateIdx < 200, 'title immediately follows the gate opening');
  });
});
