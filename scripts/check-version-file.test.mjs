/*
 * The version-file guard. One case where the file changed (the script must
 * fail) and one where it did not (the script must pass). The temp repo is
 * the only place these commits exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { versionFileFromBuildScript } from './check-version-file.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(ROOT, 'scripts', 'check-version-file.mjs');

function git(cwd, args) {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=Dev', '-c', 'user.email=dev@example.com', '-c', 'commit.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
}

function repoWithVersionFile() {
  const dir = mkdtempSync(join(tmpdir(), 'version-file-'));
  const source = readFileSync(join(ROOT, 'scripts', 'build-codex-plugin.mjs'), 'utf8');
  const file = versionFileFromBuildScript(source);
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, dirname(file)), { recursive: true });
  writeFileSync(join(dir, 'scripts', 'build-codex-plugin.mjs'), source);
  writeFileSync(join(dir, file), '{"version":"0.0.1"}\n');
  writeFileSync(join(dir, 'README.md'), 'base\n');
  git(dir, ['init', '-b', 'main']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-m', 'base']);
  return { dir, file };
}

function run(dir) {
  return spawnSync(process.execPath, [SCRIPT, 'main'], { cwd: dir, encoding: 'utf8' });
}

test('fails when the version file changed', () => {
  const { dir, file } = repoWithVersionFile();
  try {
    git(dir, ['checkout', '-b', 'pr']);
    writeFileSync(join(dir, file), '{"version":"0.0.2"}\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'bump']);
    const result = run(dir);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /does not set the version/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('passes when the version file did not change', () => {
  const { dir } = repoWithVersionFile();
  try {
    git(dir, ['checkout', '-b', 'pr']);
    writeFileSync(join(dir, 'README.md'), 'other\n');
    git(dir, ['add', '.']);
    git(dir, ['commit', '-m', 'docs']);
    const result = run(dir);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
