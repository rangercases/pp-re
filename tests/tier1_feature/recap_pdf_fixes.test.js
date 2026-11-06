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

// ─────────────────────────────────────────────────────────────────────────────
// TC-PDF1 — Info grid: fields with a blank label are skipped (any module)
// ─────────────────────────────────────────────────────────────────────────────
const filterLine = extract(
  indexHtml,
  /(const visibleInfoRows = infoRows\.filter\(row => row && row\[0\] && String\(row\[0\]\)\.trim\(\)\);)/,
  'visibleInfoRows blank-label filter'
);
const applyInfoFilter = new Function('infoRows', `${filterLine}\nreturn visibleInfoRows;`);

describe('TC-PDF1: PDF info grid skips blank-label fields', () => {
  it('TC-PDF1.1: Recap-style rows drop the trailing ["", ""] padding cell', () => {
    const rows = [
      ['Model No.', 'M1'], ['Description', 'Chair'],
      ['Date', '6-Nov-26'], ['Factory', 'F1'],
      ['Reviewed by', 'Hung'], ['', '']
    ];
    const out = applyInfoFilter(rows);
    assert.equal(out.length, 5);
    assert.deepEqual(out.map(r => r[0]), ['Model No.', 'Description', 'Date', 'Factory', 'Reviewed by']);
  });

  it('TC-PDF1.2: a field with a label but an empty value is kept (renders "—")', () => {
    const rows = [['Model No.', ''], ['Dimension', ''], ['Date', '6-Nov-26']];
    const out = applyInfoFilter(rows);
    assert.equal(out.length, 3);
    assert.deepEqual(out[1], ['Dimension', '']);
  });

  it('TC-PDF1.3: whitespace-only labels are dropped, order is preserved', () => {
    const rows = [['A', '1'], ['   ', 'x'], ['B', '2'], [null, 'y'], ['C', '3']];
    const out = applyInfoFilter(rows);
    assert.deepEqual(out.map(r => r[0]), ['A', 'B', 'C']);
  });

  it('TC-PDF1.4: the grid loop iterates visibleInfoRows and guards the second cell', () => {
    assert.match(indexHtml, /for \(let i = 0; i < visibleInfoRows\.length; i \+= 2\)/);
    assert.match(indexHtml, /const secondRow = visibleInfoRows\[i \+ 1\] \|\| null;/);
    assert.match(indexHtml, /if \(secondRow\) \{/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PDF2 — Summary strip: Recap renders ONLY the Watch-outs chip
// ─────────────────────────────────────────────────────────────────────────────
const badgeRegion = extract(
  indexHtml,
  /const pdfBadges = \[\];([\s\S]*?)\/\/ Tính toán trước chiều rộng/,
  'pdfBadges build region'
);

describe('TC-PDF2: PDF summary chips are module-aware', () => {
  it('TC-PDF2.1: Watch-outs chip is still built for Recap', () => {
    assert.match(badgeRegion, /if \(isRecap\) \{/);
    assert.ok(badgeRegion.includes('Watch-out'), 'watch-outs badge text present');
  });

  it('TC-PDF2.2: every Testing badge branch is gated on !isRecap', () => {
    assert.ok(badgeRegion.includes('if (!isRecap && qm.totalTests === 0)'), 'no-tests branch gated');
    assert.ok(badgeRegion.includes('else if (!isRecap && qm.failedTests > 0)'), 'failed branch gated');
    assert.ok(badgeRegion.includes('else if (!isRecap && qm.passedTests === qm.totalTests)'), 'all-passed branch gated');
    assert.ok(badgeRegion.includes('else if (!isRecap) {'), 'pending branch gated (no bare else)');
    assert.ok(!/^\s*if \(qm\.totalTests === 0\)/m.test(badgeRegion), 'no unguarded testing entry point');
  });

  it('TC-PDF2.3: Checklist and Dimension badges are gated on !isRecap', () => {
    assert.ok(badgeRegion.includes('if (!isRecap && qm.totalCriteria > 0)'), 'checklist gated');
    assert.ok(badgeRegion.includes('if (!isRecap && (qm.redDims > 0 || qm.orangeDims > 0))'), 'dimension gated');
    assert.ok(!/^\s*if \(qm\.totalCriteria > 0\)/m.test(badgeRegion), 'no unguarded checklist entry point');
  });

  it('TC-PDF2.4: Recap detection reuses the exportPdfCore isRecap flag', () => {
    assert.match(
      indexHtml,
      /const isRecap = \(D && D\.moduleType === 'sample-review-recap'\)/
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-PDF3 — Overview cover photos get the renderCard-style border
// ─────────────────────────────────────────────────────────────────────────────
const frameHelperBody = extract(
  indexHtml,
  /const frameCoverImg = \(b\) => \{([\s\S]*?)\n      \};/,
  'frameCoverImg helper'
);

function makeFrame(doc) {
  return new Function('doc', `return ((b) => {${frameHelperBody}\n  });`)(doc);
}

const coverRegion = extract(
  indexHtml,
  /const cp = D\.coverPhotos \|\| \{\};([\s\S]*?)\/\/ Đảm bảo toàn bộ tài liệu kỹ thuật/,
  'PDF cover renderer region'
);

describe('TC-PDF3: PDF Overview photos are framed like renderCard photos', () => {
  it('TC-PDF3.1: frameCoverImg strokes (220,217,210) / 0.25 around the given bounds', () => {
    const calls = [];
    const doc = {
      setDrawColor: (...a) => calls.push(['setDrawColor', ...a]),
      setLineWidth: (...a) => calls.push(['setLineWidth', ...a]),
      rect: (...a) => calls.push(['rect', ...a])
    };
    makeFrame(doc)({ x: 10, y: 20, w: 88, h: 56 });
    assert.deepEqual(calls, [
      ['setDrawColor', 220, 217, 210],
      ['setLineWidth', 0.25],
      ['rect', 10, 20, 88, 56, 'S']
    ]);
  });

  it('TC-PDF3.2: frameCoverImg draws nothing when bounds are null (failed image)', () => {
    const calls = [];
    const doc = {
      setDrawColor: (...a) => calls.push(['setDrawColor', ...a]),
      setLineWidth: (...a) => calls.push(['setLineWidth', ...a]),
      rect: (...a) => calls.push(['rect', ...a])
    };
    makeFrame(doc)(null);
    assert.deepEqual(calls, []);
  });

  it('TC-PDF3.3: every cover addImg call site is paired with a frameCoverImg call', () => {
    const lines = coverRegion.split('\n');
    const addIdx = [];
    lines.forEach((ln, i) => { if (/const bounds3? = addImg\(c/.test(ln)) addIdx.push(i); });
    assert.equal(addIdx.length, 7, `expected 7 cover addImg sites, found ${addIdx.length}`);
    for (const i of addIdx) {
      const window = lines.slice(i, i + 8).join('\n');
      assert.match(window, /frameCoverImg\(bounds3?\);/, `frame call must follow addImg at region line ${i}`);
    }
  });

  it('TC-PDF3.4: renderCard border behaviour is untouched', () => {
    assert.ok(indexHtml.includes("doc.rect(b.x, b.y, b.w, b.h, 'S');"), 'renderCard single-image border intact');
    assert.ok(indexHtml.includes("doc.rect(px, py, gw, cardH, 'S');"), 'renderCard card border intact');
  });
});
