import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

const indexHtml = fs.readFileSync(path.resolve(projectRoot, 'index.html'), 'utf8');

// ─────────────────────────────────────────────────────────────────────────────
// TC-LEGACY.1 — the "Local reports found" migration prompt is gone.
// One person = one machine = one account, so pre-sign-in local reports are
// never offered for copying into an account (Hung, 2026-11-18).
// ─────────────────────────────────────────────────────────────────────────────
describe('TC-LEGACY.1 legacy migration prompt removed', () => {
  it('maybeOfferLegacyMigration no longer exists', () => {
    assert.ok(!indexHtml.includes('maybeOfferLegacyMigration'));
  });

  it('countLegacyReports no longer exists', () => {
    assert.ok(!indexHtml.includes('countLegacyReports'));
  });

  it('the once-per-device prompt flag is gone', () => {
    assert.ok(!indexHtml.includes('AUTH_LEGACY_PROMPT_KEY'));
    assert.ok(!indexHtml.includes('fasrep.legacyPrompted'));
  });

  it('the dialog copy no longer exists', () => {
    assert.ok(!indexHtml.includes('saved before you signed in'));
    assert.ok(!indexHtml.includes('Copy to my account'));
  });

  it('startApp still prepares per-user storage and renders home', () => {
    assert.ok(indexHtml.includes('prepareUserStorage(currentUser)'));
    assert.ok(indexHtml.includes("const AUTH_LEGACY_DB_NAME = 'SofaCompanyPP_DB_Lite';"));
  });
});
