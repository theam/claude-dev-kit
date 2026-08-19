/*
 * Tests for the bundle-sync guard. Zero-dep (node:test), so `node --test` runs them
 * anywhere the kit already runs.
 *
 * These assert the property the guard exists for: the validator must fail when a
 * canonical source (a skill/instructions file OR the Codex manifest) and its generated
 * bundle copy disagree. Everything runs against a throwaway fixture tree under the OS
 * tmpdir via DEVKIT_ROOT — no tracked file is ever mutated, so a hard-killed run cannot
 * leave the repo dirty (the failure mode the previous in-place approach had).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { orphanedBundleFiles, collidingSkillNames, portableManifestDrift } from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = join(ROOT, 'scripts', 'build-codex-plugin.mjs');
const VALIDATE = join(ROOT, 'scripts', 'validate-codex-plugin.mjs');

const run = (script, root) =>
  spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env, DEVKIT_ROOT: root } });
const build = (root) => run(BUILD, root);
const validate = (root) => run(VALIDATE, root);

/** Write a minimal but fully-valid source tree; the caller then runs the builder on it. */
function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'devkit-bundle-'));
  const write = (rel, body) => {
    mkdirSync(dirname(join(root, rel)), { recursive: true });
    writeFileSync(join(root, rel), body);
  };
  write('.claude-plugin/plugin.json', JSON.stringify({ name: 'fullstack-dev-kit', version: '9.9.9' }, null, 2) + '\n');
  write('.agents/plugins/marketplace.json', JSON.stringify({
    name: 'claude-dev-kit',
    plugins: [{
      name: 'fullstack-dev-kit',
      source: { source: 'local', path: './plugins/fullstack-dev-kit' },
      policy: { installation: 'AVAILABLE', authentication: 'ON_USE' },
    }],
  }, null, 2) + '\n');
  write('skills/demo/SKILL.md', '---\nname: demo\ndescription: A demo skill.\n---\nBody.\n');
  write('codex/skills/play/SKILL.md', '---\nname: play\ndescription: A bundle-only skill.\n---\nPlaybook.\n');
  write('instructions/secure-coding.md', 'Secure coding rules.\n');
  write('instructions/stacks/node.md', 'Node profile.\n');
  write('plugins/fullstack-dev-kit/.codex-plugin/plugin.json', JSON.stringify({
    name: 'fullstack-dev-kit',
    version: '9.9.9',
    description: 'Fixture plugin.',
    author: { name: 'The Agile Monkeys', url: 'https://example.test' },
    homepage: 'https://example.test',
    repository: 'https://example.test',
    license: 'Apache-2.0',
    keywords: ['fixture'],
    skills: './skills/',
    interface: { displayName: 'Fixture', category: 'Developer Tools' },
  }, null, 2) + '\n');
  return root;
}

/** A fixture with its bundle freshly built — the in-sync starting point for drift tests. */
function builtFixture() {
  const root = makeFixture();
  const r = build(root);
  assert.equal(r.status, 0, `builder failed on a fresh fixture:\n${r.stderr}`);
  return root;
}

test('the committed bundle passes validation', () => {
  // Read-only: runs against the real repo, mutates nothing.
  const r = validate(ROOT);
  assert.equal(r.status, 0, `validator failed on the committed tree:\n${r.stderr}`);
});

test('a freshly built fixture is in sync', () => {
  const root = builtFixture();
  try {
    assert.equal(validate(root).status, 0);
    assert.deepEqual(orphanedBundleFiles(root), []);
    assert.deepEqual(collidingSkillNames(root), []);
    assert.equal(portableManifestDrift(root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('editing an instructions source without rebuilding fails validation', () => {
  const root = builtFixture();
  try {
    appendFileSync(join(root, 'instructions', 'stacks', 'node.md'), '\n<!-- drift -->\n');
    const r = validate(root);
    assert.equal(r.status, 1, 'validator passed while the bundle was stale');
    assert.match(r.stderr, /differs from the source/);
    assert.match(r.stderr, /instructions[/\\]stacks[/\\]node\.md/);
    assert.equal(build(root).status, 0);
    assert.equal(validate(root).status, 0, 'rebuild did not clear the drift');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('editing the Codex manifest without rebuilding fails validation (portable drift)', () => {
  const root = builtFixture();
  try {
    const cmPath = join(root, 'plugins', 'fullstack-dev-kit', '.codex-plugin', 'plugin.json');
    const cm = JSON.parse(readFileSync(cmPath, 'utf8'));
    cm.description = 'Edited without rebuilding.';
    writeFileSync(cmPath, JSON.stringify(cm, null, 2) + '\n');
    const r = validate(root);
    assert.equal(r.status, 1, 'validator passed while the portable manifest was stale');
    assert.match(r.stderr, /portable plugin\.json differs/);
    assert.equal(build(root).status, 0);
    assert.equal(validate(root).status, 0, 'rebuild did not clear the manifest drift');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a source deleted upstream is reported instead of lingering in the bundle', () => {
  const root = builtFixture();
  try {
    rmSync(join(root, 'instructions', 'stacks', 'node.md'));
    const r = validate(root);
    assert.equal(r.status, 1, 'deleting a source left the bundle copy unreported');
    assert.match(r.stderr, /which no source produces/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a skill name in two sources is reported as a collision', () => {
  const root = makeFixture();
  try {
    // `demo` now exists under both skills/ and codex/skills/ → copy-into-same-dst collision.
    mkdirSync(join(root, 'codex', 'skills', 'demo'), { recursive: true });
    writeFileSync(join(root, 'codex', 'skills', 'demo', 'SKILL.md'), '---\nname: demo\ndescription: Dupe.\n---\nDupe.\n');
    assert.deepEqual(collidingSkillNames(root), ['demo']);
    build(root);
    const r = validate(root);
    assert.equal(r.status, 1, 'a colliding skill name passed validation');
    assert.match(r.stderr, /exists in more than one skill source/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
