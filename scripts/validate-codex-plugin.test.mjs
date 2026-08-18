/*
 * Tests for the bundle-sync guard. Zero-dep (node:test), so `node --test scripts/`
 * runs them anywhere the kit already runs.
 *
 * These assert the property the guard exists for: the validator must fail when a
 * canonical source and its bundled copy disagree. Editing a source without rebuilding
 * is the documented contribution path for stack profiles, so it has to be caught here
 * rather than by a reviewer noticing a stale file in the diff.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncedFilePairs, orphanedBundleFiles } from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const validate = () => spawnSync(process.execPath, [join(ROOT, 'scripts', 'validate-codex-plugin.mjs')], { encoding: 'utf8' });
const build = () => spawnSync(process.execPath, [join(ROOT, 'scripts', 'build-codex-plugin.mjs')], { encoding: 'utf8' });

const PROBE = join(ROOT, 'instructions', 'stacks', 'php.md');

test('the committed bundle is in sync', () => {
  const result = validate();
  assert.equal(result.status, 0, `validator failed on a clean tree:\n${result.stderr}`);
});

test('editing a source without rebuilding fails validation', () => {
  const original = readFileSync(PROBE, 'utf8');
  try {
    writeFileSync(PROBE, `${original}\n<!-- drift probe -->\n`);
    const result = validate();
    assert.equal(result.status, 1, 'validator passed while the bundle was stale');
    assert.match(result.stderr, /differs from the source/);
    assert.match(result.stderr, /instructions\/stacks\/php\.md/);
  } finally {
    writeFileSync(PROBE, original);
  }
  assert.equal(validate().status, 0, 'validator did not recover after restoring the source');
});

test('rebuilding after an edit clears the failure', () => {
  const original = readFileSync(PROBE, 'utf8');
  try {
    writeFileSync(PROBE, `${original}\n<!-- drift probe -->\n`);
    assert.equal(validate().status, 1);
    assert.equal(build().status, 0, 'builder failed');
    assert.equal(validate().status, 0, 'validator still failing after a rebuild');
  } finally {
    writeFileSync(PROBE, original);
    build();
  }
});

test('a file deleted upstream is reported instead of lingering in the bundle', () => {
  const dir = join(ROOT, 'instructions', 'stacks');
  const temp = join(dir, '__drift-probe.md');
  try {
    writeFileSync(temp, '# probe\n');
    assert.equal(build().status, 0);
    assert.equal(validate().status, 0, 'a newly built file should validate');
    rmSync(temp);
    const result = validate();
    assert.equal(result.status, 1, 'deleting a source left the bundle copy unreported');
    assert.match(result.stderr, /which no source produces/);
  } finally {
    if (existsSync(temp)) rmSync(temp);
    build();
  }
});

test('bundle-only skills are not treated as drift', () => {
  // codex/skills/work-story ships to the bundle and has no counterpart under skills/.
  const orphans = orphanedBundleFiles(ROOT);
  assert.deepEqual(orphans, [], `unexpected orphans: ${orphans.join(', ')}`);
  const pairs = syncedFilePairs(ROOT).map((p) => p.label);
  assert.ok(
    pairs.some((label) => label.startsWith(join('codex', 'skills', 'work-story'))),
    'the bundle-only skill is not covered by the sync map',
  );
});
