#!/usr/bin/env node
// The Cloudflare Vite plugin emits a Workers config (dist/wrangler.json plus a
// redirect in .wrangler/deploy). Pages rejects that config, so drop both
// generated artifacts before `wrangler pages deploy` reads root wrangler.json.
import { rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const rel of ['dist/wrangler.json', '.wrangler/deploy/config.json']) {
  rmSync(join(root, rel), { force: true });
}
