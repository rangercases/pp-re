#!/usr/bin/env node
// Fails the build when the single-file PWA output loses critical pieces.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const failures = [];
const checks = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: !!condition, detail });
  if (!condition) failures.push(`${name}${detail ? ' — ' + detail : ''}`);
}

function read(relPath) {
  const file = join(dist, relPath);
  if (!existsSync(file)) {
    check(`dist/${relPath} exists`, false);
    return '';
  }
  return readFileSync(file, 'utf8');
}

const html = read('index.html');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

check('dist/index.html is not empty', html.length > 500000, `${html.length} bytes`);
check('single-file bundle contains app code', html.includes('renderTabManagerModal'));
check('single-file bundle contains metadata storage', html.includes('dbGetAllMetadata'));
check('single-file bundle contains escaping helper', html.includes('escapeHtml'));
check('single-file bundle contains autosave queue', html.includes('drainSaveQueue'));
check('single-file bundle contains small thumbnails', html.includes('thumbSmall'));
check('single-file bundle shows FASREP', html.includes('FASREP'));
check('single-file bundle has no DIGITAL REPORT', !html.includes('DIGITAL REPORT'));
check('single-file bundle has APP_VERSION v3.8.0', html.includes("APP_VERSION = 'v3.8.0'"));
check('single-file bundle shows V3.8.0 badge', html.includes('[V3.8.0]') && !html.includes('[V3.7.0]'));
check('package.json version is 3.8.0', pkg.version === '3.8.0', pkg.version);
check('dimension unit inputs default to mm with data-unit-for', html.includes('data-unit-for="actual"') && html.includes('data-unit-for="drawing"'));
check('single-file bundle has auth boot gate', html.includes('function bootAuth'));
check('single-file bundle scopes storage per account', html.includes('prepareUserStorage'));
check('single-file bundle offers legacy migration', html.includes('maybeOfferLegacyMigration'));
check('single-file bundle has two-step signup', html.includes('submitSignupVerify'));
check('single-file bundle calls signup request API', html.includes('/api/auth/signup/request'));
check('single-file bundle calls signup verify API', html.includes('/api/auth/signup/verify'));
check('single-file bundle has OTP code input', html.includes('authCodeInput'));
check('single-file bundle has resend countdown', html.includes('startSignupCountdown'));
check('single-file bundle points to fasrep.com', html.includes('https://fasrep.com/'));
check('single-file bundle has no closed-signup code', !html.includes('SIGNUP_CLOSED'));
check('manifest link is relative', html.includes('href="./manifest.json"'));
check('no absolute /manifest.json link', !html.includes('href="/manifest.json"'));
check('no unpinned CDN @latest', !html.includes('@latest'));
check('Vite assets are inlined', !/<script[^>]+src="\.\/assets\//.test(html) && !/<link[^>]+href="\.\/assets\//.test(html));

// Negative assertions for removed features (Audit Requirements: Features 1, 2, and 3)
check('no Feature 1 dim-manual-indicator', !html.includes('dim-manual-indicator'));
check('no Feature 1 reevaluateDimStatus', !html.includes('reevaluateDimStatus'));
check('no Feature 1 manualStatus', !html.includes('manualStatus'));
check('no Feature 2 dim-preset', !html.includes('dim-preset'));
check('no Feature 2 DIMENSION_PRESETS', !html.includes('DIMENSION_PRESETS'));
check('no Feature 2 detectFurniturePreset', !html.includes('detectFurniturePreset'));
check('no Feature 2 applyDimensionPreset', !html.includes('applyDimensionPreset'));
check('no Feature 3 badge-approved', !html.includes('badge-approved'));
check('no Feature 3 badge-new-sample', !html.includes('badge-new-sample'));
check('no Feature 3 badge-repair', !html.includes('badge-repair'));
check('no Feature 3 badge-in-progress', !html.includes('badge-in-progress'));
check('no Feature 3 getReportVerdict', !html.includes('getReportVerdict'));
check('filter tab displays DONE rather than APPROVED', html.includes('DONE <span id="countPillDone">') && !html.includes('APPROVED <span id="countPillDone">'));

let manifest = null;
try {
  manifest = JSON.parse(read('manifest.json'));
} catch (err) {
  check('dist/manifest.json is valid JSON', false, err.message);
}
if (manifest) {
  check('manifest name is FASREP', manifest.name === 'FASREP', manifest.name);
  check('manifest short_name is FASREP', manifest.short_name === 'FASREP', manifest.short_name);
  check('manifest start_url present', !!manifest.start_url, manifest.start_url);
}

const sw = read('service-worker.js');
check('dist/service-worker.js has v3.8.0 cache', sw.includes("fasrep-v3.8.0"));
check('dist/service-worker.js never caches /api/', sw.includes("url.pathname.startsWith('/api/')"));
check('dist/service-worker.js pins SortableJS 1.15.2', sw.includes('sortablejs@1.15.2'));
check('dist/service-worker.js has no @latest', !sw.includes('@latest'));
check('dist/service-worker.js handles SKIP_WAITING', sw.includes('SKIP_WAITING'));
check('dist/service-worker.js claims clients', sw.includes('clients.claim()'));
check('dist/service-worker.js ignores cross-origin non-CDN requests', sw.includes('url.origin !== self.location.origin'));
check('dist/service-worker.js bypasses HTTP cache on navigation', sw.includes("cache: 'no-store'"));

// GitHub Pages currently deploys the repo root, so these mirrors must stay in sync.
const normalize = (text) => text.replace(/\r\n/g, '\n');
const publicManifestText = readFileSync(join(root, 'public', 'manifest.json'), 'utf8');
const publicSwText = readFileSync(join(root, 'public', 'service-worker.js'), 'utf8');
check('root manifest mirrors public/manifest.json',
  normalize(readFileSync(join(root, 'manifest.json'), 'utf8')) === normalize(publicManifestText));
check('root service-worker mirrors public/service-worker.js',
  normalize(readFileSync(join(root, 'service-worker.js'), 'utf8')) === normalize(publicSwText));

const distFontFile = join(dist, 'font_roboto.js');
const distFontExists = existsSync(distFontFile);
const distFontSize = distFontExists ? statSync(distFontFile).size : 0;
check('dist/font_roboto.js exists and has size > 300000 bytes',
  distFontExists && distFontSize > 300000, `${distFontSize} bytes`);

const passCount = checks.filter(c => c.ok).length;
checks.forEach(c => {
  console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok || !c.detail ? '' : ' (' + c.detail + ')'}`);
});
console.log(`\n${passCount}/${checks.length} checks passed.`);

if (failures.length) {
  console.error('\nBuild assertions failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}

const size = statSync(join(dist, 'index.html')).size;
console.log(`dist/index.html: ${(size / (1024 * 1024)).toFixed(2)} MB`);
