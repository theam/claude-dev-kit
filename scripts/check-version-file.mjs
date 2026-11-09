#!/usr/bin/env node
/*
 * Feature pull requests must not change the kit version file. Two branches
 * can both claim the same number, and the merge still applies cleanly.
 * The release job on the default branch owns the file.
 *
 * Which file: the manifest the build script reads when it aligns bundle
 * versions. Derived manifests are rewritten from that file, so this check
 * does not watch them. The npm package versions on its own.
 *
 *   node scripts/check-version-file.mjs <base-revision>
 *
 * Exits 1 when that file is in the diff against the base revision.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function versionFileFromBuildScript(source) {
  const match = source.match(/join\(ROOT,\s*'([^']+)',\s*'plugin\.json'\)/);
  if (!match) {
    throw new Error('The build script does not name a version file. The check cannot tell which file the release job owns.');
  }
  return `${match[1]}/plugin.json`;
}

export function changedPaths(repo, base) {
  const result = spawnSync('git', ['diff', '--name-only', `${base}...HEAD`], {
    cwd: repo,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || 'Could not read the diff against the base revision.').trim());
  }
  return result.stdout.split('\n').filter(Boolean);
}

export function checkVersionFile({ repo, base }) {
  const source = readFileSync(join(repo, 'scripts', 'build-codex-plugin.mjs'), 'utf8');
  const file = versionFileFromBuildScript(source);
  const paths = changedPaths(repo, base);
  return { file, touched: paths.includes(file) };
}

function baseRevision() {
  if (process.argv[2]) return process.argv[2];
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return 'upstream/main';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { file, touched } = checkVersionFile({ repo: process.cwd(), base: baseRevision() });
    if (touched) {
      console.error(`${file} is in this pull request diff.`);
      console.error('Feature work does not set the version. Drop that file from the branch. The release job on the default branch writes it.');
      process.exit(1);
    }
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
