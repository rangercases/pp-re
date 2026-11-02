#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const testPattern = process.argv[2] || 'tests/**/*.test.js';

console.log('================================================================');
console.log('  FASREP E2E AUTOMATED TEST SUITE (TIERS 1 - 4)');
console.log('  SOFACOMPANY Prototype & Pre-Production Review Standardization');
console.log('================================================================');
console.log(`Pattern: ${testPattern}`);
console.log(`Runtime: Node.js ${process.version}`);
console.log(`Driver : node:test + node:sqlite (DatabaseSync in-memory)`);
console.log('----------------------------------------------------------------\n');

const startTime = performance.now();

const child = spawn(
  process.execPath,
  ['--test', testPattern],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  }
);

child.on('close', (code) => {
  const duration = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log('\n----------------------------------------------------------------');
  if (code === 0) {
    console.log(`  RESULT : SUCCESS (All test suites passed cleanly)`);
  } else {
    console.log(`  RESULT : FAILED (Exit code: ${code})`);
  }
  console.log(`  ELAPSED: ${duration}s`);
  console.log('================================================================');
  process.exit(code || 0);
});
