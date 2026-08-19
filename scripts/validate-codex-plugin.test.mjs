/*
 * Tests for the bundle-sync guard. Zero-dep (node:test), so `node --test` runs them
 * anywhere the kit already runs.
 *
 * These assert the property the guard exists for: the validator must fail when a
 * canonical source and its generated copy disagree. Editing a source without rebuilding
 * is the documented contribution path for stack profiles, so it has to be caught here
 * rather than by a reviewer noticing a stale file in the diff.
 *
 * Every mutating test runs against a throwaway copy of the repo, never the working tree.
 * A test that edited a tracked file and restored it in `finally` would still leave the
 * tree dirty if the run were killed between the two — and a dirty tree then fails both
 * the in-sync test below and CONTRIBUTING's `git diff --exit-code` step on the next run.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync, mkdtempSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  syncedFilePairs,
  orphanedBundleFiles,
  skillNameCollisions,
  portableManifestFrom,
  serializeManifest,
  CODEX_MANIFEST,
  PORTABLE_MANIFEST,
} from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Everything the builder and validator read. Copied, so the real tree is never touched. */
const TREES = ['scripts', 'skills', 'codex', 'instructions', 'plugins', '.claude-plugin', '.agents'];

/** A disposable copy of the repo. Returns its path; the caller removes it. */
function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'dev-kit-drift-'));
  for (const tree of TREES) {
    const from = join(ROOT, tree);
    if (existsSync(from)) cpSync(from, join(dir, tree), { recursive: true });
  }
  return dir;
}

/* The sandbox carries its own scripts/, and each script self-locates via import.meta.url,
 * so invoking the copy is what targets the copy. No cwd or env override is involved. */
const run = (root, script) =>
  spawnSync(process.execPath, [join(root, 'scripts', script)], { encoding: 'utf8' });
const validate = (root) => run(root, 'validate-codex-plugin.mjs');
const build = (root) => run(root, 'build-codex-plugin.mjs');

/**
 * Run `fn(sandboxPath)` against a fresh copy, always cleaning up.
 *
 * The copy is asserted valid before the body runs. Without that, a tree missing from
 * TREES would make the sandbox invalid for an unrelated reason and every "expect exit 1"
 * assertion below would pass for the wrong one.
 */
function inSandbox(fn) {
  const dir = sandbox();
  try {
    const clean = validate(dir);
    assert.equal(clean.status, 0, `the sandbox copy is not a valid tree:\n${clean.stderr}`);
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Validator output with separators normalised, so assertions hold on Windows too. */
const posix = (text) => text.replaceAll('\\', '/');

test('the committed bundle is in sync', () => {
  const result = validate(ROOT);
  assert.equal(result.status, 0, `validator failed on a clean tree:\n${result.stderr}`);
});

test('editing a source without rebuilding fails validation', () => {
  inSandbox((dir) => {
    const probe = join(dir, 'instructions', 'stacks', 'php.md');
    writeFileSync(probe, `${readFileSync(probe, 'utf8')}\n<!-- drift probe -->\n`);
    const result = validate(dir);
    assert.equal(result.status, 1, 'validator passed while the bundle was stale');
    assert.match(result.stderr, /differs from the source/);
    assert.match(posix(result.stderr), /instructions\/stacks\/php\.md/);
  });
});

test('rebuilding after an edit clears the failure', () => {
  inSandbox((dir) => {
    const probe = join(dir, 'instructions', 'stacks', 'php.md');
    writeFileSync(probe, `${readFileSync(probe, 'utf8')}\n<!-- drift probe -->\n`);
    assert.equal(validate(dir).status, 1);
    assert.equal(build(dir).status, 0, 'builder failed');
    assert.equal(validate(dir).status, 0, 'validator still failing after a rebuild');
  });
});

test('a file deleted upstream is reported instead of lingering in the bundle', () => {
  inSandbox((dir) => {
    const temp = join(dir, 'instructions', 'stacks', '__drift-probe.md');
    writeFileSync(temp, '# probe\n');
    assert.equal(build(dir).status, 0);
    assert.equal(validate(dir).status, 0, 'a newly built file should validate');
    rmSync(temp);
    const result = validate(dir);
    assert.equal(result.status, 1, 'deleting a source left the bundle copy unreported');
    assert.match(result.stderr, /which no source produces/);
  });
});

test('editing the Codex manifest without rebuilding fails validation', () => {
  // The portable root plugin.json is generated from the Codex one. Structural checks
  // cannot tell it is stale, so the validator re-derives and byte-compares.
  inSandbox((dir) => {
    const codex = join(dir, CODEX_MANIFEST);
    const manifest = JSON.parse(readFileSync(codex, 'utf8'));
    manifest.description = `${manifest.description} (drift probe)`;
    writeFileSync(codex, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = validate(dir);
    assert.equal(result.status, 1, 'validator passed while the portable manifest was stale');
    assert.match(result.stderr, /differs from the source it is generated from/);

    assert.equal(build(dir).status, 0, 'builder failed');
    assert.equal(validate(dir).status, 0, 'validator still failing after a rebuild');
    const portable = JSON.parse(readFileSync(join(dir, PORTABLE_MANIFEST), 'utf8'));
    assert.equal(portable.description, manifest.description, 'rebuild did not propagate the edit');
  });
});

test('the generated manifest is exactly what the shared derivation produces', () => {
  const codex = JSON.parse(readFileSync(join(ROOT, CODEX_MANIFEST), 'utf8'));
  assert.equal(
    readFileSync(join(ROOT, PORTABLE_MANIFEST), 'utf8'),
    serializeManifest(portableManifestFrom(codex)),
    'the committed portable manifest is not a byte-for-byte derivation of its source',
  );
});

test('a skill name in two collections is rejected rather than silently overwritten', () => {
  inSandbox((dir) => {
    // codex/skills/ and skills/ both copy into the bundle's skills/; the same name in
    // both is second-wins at build time and unfixable drift afterwards.
    cpSync(join(dir, 'codex', 'skills', 'work-story'), join(dir, 'skills', 'work-story'), {
      recursive: true,
    });
    assert.equal(skillNameCollisions(dir).length, 1, 'the collision was not detected');

    const built = build(dir);
    assert.equal(built.status, 1, 'builder proceeded despite a collision');
    assert.match(built.stderr, /defined in both/);

    const result = validate(dir);
    assert.equal(result.status, 1, 'validator ignored the collision');
    assert.match(result.stderr, /defined in both/);
  });
});

test('a collision leads, and does not drag the drift it causes along with it', () => {
  inSandbox((dir) => {
    // Give the two collections a same-named skill whose contents differ, so the losing
    // copy would otherwise also be reported as drift — the derivative noise this hides.
    const dup = join(dir, 'skills', 'work-story');
    cpSync(join(dir, 'codex', 'skills', 'work-story'), dup, { recursive: true });
    writeFileSync(join(dup, 'SKILL.md'), `${readFileSync(join(dup, 'SKILL.md'), 'utf8')}\n<!-- diverged -->\n`);

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /defined in both/, 'the cause is not reported');
    assert.doesNotMatch(
      result.stderr,
      /differs from the source|bundle is missing|which no source produces/,
      'per-file drift lines should be suppressed while a collision is present',
    );
  });
});

test('manifest drift is still reported while a collision is present', () => {
  // The manifest pair is orthogonal to skill-name collisions, so suppressing the
  // per-file lines must not suppress it too.
  inSandbox((dir) => {
    cpSync(join(dir, 'codex', 'skills', 'work-story'), join(dir, 'skills', 'work-story'), {
      recursive: true,
    });
    const codex = join(dir, CODEX_MANIFEST);
    const manifest = JSON.parse(readFileSync(codex, 'utf8'));
    manifest.description = `${manifest.description} (drift probe)`;
    writeFileSync(codex, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = validate(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /defined in both/);
    assert.match(result.stderr, /differs from the source it is generated from/);
  });
});

test('bundle-only skills are not treated as drift', () => {
  // codex/skills/work-story ships to the bundle and has no counterpart under skills/.
  const orphans = orphanedBundleFiles(ROOT);
  assert.deepEqual(orphans, [], `unexpected orphans: ${orphans.join(', ')}`);
  const pairs = syncedFilePairs(ROOT).map((p) => posix(p.label));
  assert.ok(
    pairs.some((label) => label.startsWith('codex/skills/work-story')),
    'the bundle-only skill is not covered by the sync map',
  );
  assert.deepEqual(skillNameCollisions(ROOT), [], 'the committed tree has a skill-name collision');
});
