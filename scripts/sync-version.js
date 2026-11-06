#!/usr/bin/env node
// A-02: package.json is the SINGLE source of truth for the app version.
// This script propagates it to every place that used to be edited by hand:
//   - index.html            APP_VERSION = 'vX.Y.Z' and every [VX.Y.Z] badge
//   - service-worker.js     CACHE_NAME 'fasrep-vX.Y.Z'
//   - public/service-worker.js (mirror of the root service worker)
//   - package-lock.json     the root package version fields
// It runs automatically as the first step of `npm run build`, so a version
// bump is now exactly one edit: package.json -> "version".
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const version = pkg.version;
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error(`[sync-version] package.json version "${version}" is not semver X.Y.Z`);
  process.exit(1);
}

let changed = 0;
function syncFile(rel, transform) {
  const file = join(root, rel);
  const before = readFileSync(file, 'utf8');
  const after = transform(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
    console.log(`[sync-version] updated ${rel} -> ${version}`);
  }
}

syncFile('index.html', (text) => text
  .replace(/APP_VERSION = 'v\d+\.\d+\.\d+'/g, `APP_VERSION = 'v${version}'`)
  .replace(/\[V\d+\.\d+\.\d+\]/g, `[V${version}]`));

const syncSw = (text) => text.replace(/fasrep-v\d+\.\d+\.\d+/g, `fasrep-v${version}`);
syncFile('service-worker.js', syncSw);
syncFile('public/service-worker.js', syncSw);

syncFile('package-lock.json', (text) => text
  .replace(/(\{\s*\n\s*"name": "fasrep",\s*\n\s*"version": ")\d+\.\d+\.\d+(")/, `$1${version}$2`)
  .replace(/("": \{\s*\n\s*"name": "fasrep",\s*\n\s*"version": ")\d+\.\d+\.\d+(")/, `$1${version}$2`));

console.log(`[sync-version] version ${version} in sync (${changed} file(s) updated)`);
