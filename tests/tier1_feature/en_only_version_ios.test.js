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
// TC-EN1 — English only: the EN/VI language switch is gone (v4.1.7)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-EN1: language switch removed, UI locked to English (v4.1.7)', () => {
  it('TC-EN1.1: no language toggle remains — no buttons, no handlers, no dead CSS', () => {
    assert.ok(!indexHtml.includes('data-lang-toggle'), 'index.html must not contain data-lang-toggle');
    assert.ok(!indexHtml.includes('toggleAppLang'), 'index.html must not contain toggleAppLang');
    assert.ok(!indexHtml.includes('setAppLang'), 'index.html must not contain setAppLang');
    assert.ok(!indexHtml.includes('updateLangToggles'), 'index.html must not contain updateLangToggles');
    assert.ok(!indexHtml.includes('.lang-toggle'), 'index.html must not keep the dead .lang-toggle CSS');
  });

  it('TC-EN1.2: initI18n forces English, clears the saved key, and never reads it back', () => {
    const body = extract(indexHtml, /function initI18n\(\) \{([\s\S]*?)\n    \}/, 'initI18n');
    assert.match(body, /I18N_LANG = 'en'/, 'initI18n must force English');
    assert.match(body, /localStorage\.removeItem\(I18N_STORAGE_KEY\)/, 'initI18n must clear the saved language key');
    assert.ok(!body.includes('getItem'), 'initI18n must not read the saved language back');
    // The translation pass and the observer must survive: DOM source strings
    // are Vietnamese and the English UI is produced by translating them.
    assert.match(body, /translateI18nTree\(document\.body\)/);
    assert.match(body, /startI18nObserver\(\)/);
  });

  it('TC-EN1.3: behavioural — a stored "vi" choice no longer wins; init ends in English', () => {
    const body = extract(indexHtml, /function initI18n\(\) \{([\s\S]*?)\n    \}/, 'initI18n');
    const removed = [];
    let translated = 0;
    let observed = 0;
    const lang = new Function(
      'localStorage', 'translateI18nTree', 'startI18nObserver', 'document',
      `'use strict';
       let I18N_LANG = 'en';
       const I18N_STORAGE_KEY = 'fasrep.lang';
       function initI18n() {${body}
       }
       initI18n();
       return I18N_LANG;`
    )(
      {
        // Simulate a user who previously picked Vietnamese.
        getItem: () => 'vi',
        setItem: () => { throw new Error('initI18n must not persist a language'); },
        removeItem: (k) => { removed.push(k); },
      },
      () => { translated++; },
      () => { observed++; },
      { body: {} }
    );
    assert.equal(lang, 'en');
    assert.deepEqual(removed, ['fasrep.lang']);
    assert.equal(translated, 1);
    assert.equal(observed, 1);
  });

  it('TC-EN1.4: the translation engine itself is intact (English depends on it)', () => {
    assert.match(indexHtml, /let I18N_LANG = 'en';/);
    assert.match(indexHtml, /function L\(vi, en\) \{\s*return I18N_LANG === 'vi' \? vi : en;\s*\}/);
    assert.match(indexHtml, /function translateI18nTree\(root\)/);
    assert.match(indexHtml, /initI18n\(\);\s*bootAuth\(\);/);
  });

  it('TC-EN1.5: the EMAIL_NOT_ALLOWED client message is English now', () => {
    assert.match(
      indexHtml,
      /case 'EMAIL_NOT_ALLOWED': return 'This email has not been approved for signup by an administrator\.';/
    );
    assert.ok(!indexHtml.includes('Email này chưa được quản trị viên cấp phép đăng ký.'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TC-EN2 — iPhone: the corner version mark clears the safe area (v4.1.7)
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-EN2: version mark is safe-area aware and readable on iPhone (v4.1.7)', () => {
  const markTag = extract(indexHtml, /(<div id="appVersionMark"[^>]*>)/, '#appVersionMark');

  it('TC-EN2.1: bottom offset uses the iPhone safe-area inset', () => {
    assert.ok(
      markTag.includes('bottom:calc(8px + env(safe-area-inset-bottom, 0px))'),
      '#appVersionMark must sit above the home-indicator zone via env(safe-area-inset-bottom)'
    );
    assert.ok(!markTag.includes('bottom:8px'), 'the old flat bottom:8px offset must be gone');
  });

  it('TC-EN2.2: the mark is a subtle pill, readable over scrolling content', () => {
    assert.ok(markTag.includes('background:rgba(255,255,255,.85)'));
    assert.ok(markTag.includes('border-radius:999px'));
    assert.ok(markTag.includes('backdrop-filter:blur(6px)'));
  });

  it('TC-EN2.3: placement contract unchanged — corner, top layer, non-interactive', () => {
    assert.ok(markTag.includes('position:fixed'));
    assert.ok(markTag.includes('right:10px'));
    assert.ok(markTag.includes('z-index:900'));
    assert.ok(markTag.includes('pointer-events:none'));
  });

  it('TC-EN2.4: the editor/modal hiding rule for the mark is kept', () => {
    assert.match(indexHtml, /body\.in-editor #appVersionMark/);
    assert.match(indexHtml, /body:has\(\.modal-overlay:not\(\.hidden\)\) #appVersionMark/);
  });
});
