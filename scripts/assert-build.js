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
check('single-file bundle has APP_VERSION v3.3.0', html.includes("APP_VERSION = 'v3.3.0'"));
check('single-file bundle shows V3.3.0 badge', html.includes('[V3.3.0]') && !html.includes('[V3.2.0]'));
check('package.json version is 3.3.0', pkg.version === '3.3.0', pkg.version);
check('single-file bundle has auth boot gate', html.includes('function bootAuth'));
check('single-file bundle scopes storage per account', html.includes('prepareUserStorage'));
check('single-file bundle offers legacy migration', html.includes('maybeOfferLegacyMigration'));
check('manifest link is relative', html.includes('href="./manifest.json"'));
check('no absolute /manifest.json link', !html.includes('href="/manifest.json"'));
check('no unpinned CDN @latest', !html.includes('@latest'));
check('Vite assets are inlined', !/<script[^>]+src="\.\/assets\//.test(html) && !/<link[^>]+href="\.\/assets\//.test(html));

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
check('dist/service-worker.js has v3.3.0 cache', sw.includes("pp-review-v3.3.0"));
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
