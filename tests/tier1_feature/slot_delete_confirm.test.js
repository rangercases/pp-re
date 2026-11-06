import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

function extractFn(source, pattern, label) {
  const match = source.match(pattern);
  assert.ok(match, `${label} must be defined in index.html`);
  return match[1];
}

// ── freeSlotHasContent (S1 predicate shared by delFreeSlot) ──
const freeSlotHasContentBody = extractFn(
  indexHtml,
  /function freeSlotHasContent\(slot\) \{([\s\S]*?)\n    \}/,
  'freeSlotHasContent'
);
const freeSlotHasContent = new Function('slot', freeSlotHasContentBody);

// ── delFreeSlot, evaluated with stubbed collaborators ──
const delFreeSlotBody = extractFn(
  indexHtml,
  /async function delFreeSlot\(key, i\) \{([\s\S]*?)\n    \}/,
  'delFreeSlot'
);

function makeDelFreeSlot(D, confirmAnswer) {
  const calls = { confirm: [], pushHistory: 0, render: 0 };
  const appConfirm = async (message, opts) => {
    calls.confirm.push({ message, opts });
    return confirmAnswer;
  };
  const fn = new Function(
    'D', 'appConfirm', 'pushHistory', 'renderFreePhotos', 'as', 'savePhotoChangeNow', 'freeSlotHasContent',
    `return (async function delFreeSlot(key, i) {${delFreeSlotBody}\n  })`
  )(
    D,
    appConfirm,
    () => { calls.pushHistory++; },
    () => { calls.render++; },
    () => {},
    () => {},
    freeSlotHasContent
  );
  return { fn, calls };
}

// ── delCoverSlot, evaluated with stubbed collaborators ──
const delCoverSlotBody = extractFn(
  indexHtml,
  /async function delCoverSlot\(key\) \{([\s\S]*?)\n    \}/,
  'delCoverSlot'
);

function makeDelCoverSlot(D, confirmAnswer) {
  const calls = { confirm: [], pushHistory: 0, render: 0 };
  const appConfirm = async (message, opts) => {
    calls.confirm.push({ message, opts });
    return confirmAnswer;
  };
  const fn = new Function(
    'D', 'appConfirm', 'pushHistory', 'getCoverSlotKeys', 'renderCoverSlots', 'as', 'savePhotoChangeNow',
    `return (async function delCoverSlot(key) {${delCoverSlotBody}\n  })`
  )(
    D,
    appConfirm,
    () => { calls.pushHistory++; },
    () => D.coverSlots,
    () => { calls.render++; },
    () => {},
    () => {}
  );
  return { fn, calls };
}

describe('Tier 1: S1 — Slot delete confirm gating (v4.0.1)', () => {
  it('TC-S1.1: freeSlotHasContent matches the PDF-export content predicate', () => {
    assert.equal(freeSlotHasContent(null), false);
    assert.equal(freeSlotHasContent(undefined), false);
    assert.equal(freeSlotHasContent({}), false);
    assert.equal(freeSlotHasContent({ caption: '' }), false);
    assert.equal(freeSlotHasContent({ caption: '   ' }), false);
    assert.equal(freeSlotHasContent({ caption: 'Check the seam' }), true);
    assert.equal(freeSlotHasContent({ img: 'data:image/jpeg;base64,x' }), true);
    assert.equal(freeSlotHasContent({ imgSub: 'data:image/jpeg;base64,x' }), true);
    assert.equal(freeSlotHasContent({ img: null, imgSub: null, caption: 'note' }), true);
  });

  it('TC-S1.2: delFreeSlot asks before deleting a slot with a photo, and honours "no"', async () => {
    const D = { watchoutPhotos: [{ img: 'data:image/jpeg;base64,x', caption: '' }, null] };
    const { fn, calls } = makeDelFreeSlot(D, false);
    await fn('watchoutPhotos', 0);
    assert.equal(calls.confirm.length, 1, 'appConfirm must be shown for a non-empty slot');
    assert.equal(calls.confirm[0].message, 'Delete this photo slot and its contents?');
    assert.equal(calls.confirm[0].opts.title, 'Delete photo slot?');
    assert.equal(D.watchoutPhotos.length, 2, 'slot must stay when the user declines');
    assert.equal(calls.pushHistory, 0, 'no history entry when nothing was deleted');
  });

  it('TC-S1.3: delFreeSlot deletes a non-empty slot after confirmation (history first)', async () => {
    const D = { testingPhotos: [{ imgSub: 'data:image/jpeg;base64,x' }] };
    const { fn, calls } = makeDelFreeSlot(D, true);
    await fn('testingPhotos', 0);
    assert.equal(calls.confirm.length, 1);
    assert.equal(calls.pushHistory, 1, 'pushHistory must run so Undo can restore the slot');
    assert.equal(D.testingPhotos.length, 0, 'slot is removed after confirmation');
    assert.equal(calls.render, 1);
  });

  it('TC-S1.4: delFreeSlot treats a caption-only slot as content', async () => {
    const D = { assemblyPhotos: [{ caption: 'Step 3: tighten bolts' }] };
    const { fn, calls } = makeDelFreeSlot(D, false);
    await fn('assemblyPhotos', 0);
    assert.equal(calls.confirm.length, 1, 'caption-only slot must ask first');
    assert.equal(D.assemblyPhotos.length, 1, 'slot kept when declined');
  });

  it('TC-S1.5: delFreeSlot deletes an empty slot instantly, with no dialog', async () => {
    const D = { watchoutPhotos: [null, { photoSize: 'half', caption: '  ' }] };
    const first = makeDelFreeSlot(D, true);
    await first.fn('watchoutPhotos', 0);
    assert.equal(first.calls.confirm.length, 0, 'null slot must not prompt');
    assert.equal(D.watchoutPhotos.length, 1);

    const second = makeDelFreeSlot(D, true);
    await second.fn('watchoutPhotos', 0);
    assert.equal(second.calls.confirm.length, 0, 'whitespace-caption slot must not prompt');
    assert.equal(D.watchoutPhotos.length, 0);
    assert.equal(second.calls.pushHistory, 1);
  });

  it('TC-S1.6: delCoverSlot asks when a photoless slot carries a user-typed angle title', async () => {
    const D = {
      coverPhotos: {},
      coverTitles: { FRONT_VIEW: 'Corner detail' },
      coverSizes: {},
      coverSlots: ['FRONT_VIEW', 'SIDE_VIEW'],
    };
    const declined = makeDelCoverSlot(D, false);
    await declined.fn('FRONT_VIEW');
    assert.equal(declined.calls.confirm.length, 1, 'titled slot must ask first');
    assert.equal(declined.calls.confirm[0].message, 'Delete this photo slot and its contents?');
    assert.deepEqual(D.coverSlots, ['FRONT_VIEW', 'SIDE_VIEW'], 'slot kept when declined');
    assert.equal(D.coverTitles.FRONT_VIEW, 'Corner detail', 'title kept when declined');
    assert.equal(declined.calls.pushHistory, 0);

    const accepted = makeDelCoverSlot(D, true);
    await accepted.fn('FRONT_VIEW');
    assert.equal(accepted.calls.pushHistory, 1);
    assert.deepEqual(D.coverSlots, ['SIDE_VIEW'], 'slot removed after confirmation');
    assert.equal(D.coverTitles.FRONT_VIEW, undefined, 'title removed with the slot');
  });

  it('TC-S1.7: delCoverSlot deletes a truly empty slot instantly (incl. auto placeholder titles)', async () => {
    const D = {
      coverPhotos: {},
      coverTitles: { ANGLE_VIEW_1: 'PHOTO VIEW #2' },
      coverSizes: {},
      coverSlots: ['FRONT_VIEW', 'ANGLE_VIEW_1'],
    };
    const noTitle = makeDelCoverSlot(D, true);
    await noTitle.fn('FRONT_VIEW');
    assert.equal(noTitle.calls.confirm.length, 0, 'untitled empty slot must not prompt');
    assert.deepEqual(D.coverSlots, ['ANGLE_VIEW_1']);

    const placeholder = makeDelCoverSlot(D, true);
    await placeholder.fn('ANGLE_VIEW_1');
    assert.equal(placeholder.calls.confirm.length, 0, 'auto "PHOTO VIEW #n" title is not user content');
    assert.deepEqual(D.coverSlots, []);
  });

  it('TC-S1.8: delCoverSlot keeps the pre-existing photo confirm flow untouched', async () => {
    const D = {
      coverPhotos: { FRONT_VIEW: { img: 'data:image/jpeg;base64,x' } },
      coverTitles: {},
      coverSizes: {},
      coverSlots: ['FRONT_VIEW'],
    };
    const declined = makeDelCoverSlot(D, false);
    await declined.fn('FRONT_VIEW');
    assert.equal(declined.calls.confirm.length, 1);
    assert.equal(declined.calls.confirm[0].message, 'Are you sure you want to delete this photo?');
    assert.ok(D.coverPhotos.FRONT_VIEW, 'photo kept when declined');

    const accepted = makeDelCoverSlot(D, true);
    await accepted.fn('FRONT_VIEW');
    assert.equal(D.coverPhotos.FRONT_VIEW, undefined, 'photo removed after confirmation');
    assert.deepEqual(D.coverSlots, ['FRONT_VIEW'], 'deleting a photo keeps the slot itself');
  });
});
