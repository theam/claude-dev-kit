/*
 * The release tooling. Unit tests pin the bump rule and the CHANGELOG cut;
 * the integration tests run the script against a disposable copy of the repo
 * with its own git history, so the real tree and its tags are never touched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, existsSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  planRelease,
  bumpVersion,
  compareVersions,
  cutChangelog,
  changelogSection,
  unreleasedEntries,
  lineDiff,
  GENERATED_MANIFESTS,
} from './release.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const commit = (subject, body = '') => ({ sha: 'abc1234', subject, body });
const plan = (subjects, { current = '0.19.18', latestTag = 'v0.19.18', override = null } = {}) =>
  planRelease({
    current,
    latestTag,
    override,
    commits: subjects.map((s) => (typeof s === 'string' ? commit(s) : s)),
  });

// ---------------------------------------------------------------- bump rule

test('feat bumps the minor', () => {
  const p = plan(['fix: a', 'feat: b', 'docs: c']);
  assert.equal(p.bump, 'minor');
  assert.equal(p.next, '0.20.0');
  assert.deepEqual(p.drivers.map((c) => c.subject), ['feat: b']);
  assert.equal(p.breaking.length, 0);
});

test('feat! bumps the minor before 1.0 and is flagged as breaking', () => {
  const p = plan(['fix: a', 'feat(api)!: drop the old flag']);
  assert.equal(p.next, '0.20.0');
  assert.deepEqual(p.breaking.map((c) => c.subject), ['feat(api)!: drop the old flag']);
});

test('a BREAKING CHANGE footer is breaking even on a fix', () => {
  const p = plan([commit('fix: rename the config key', 'Details.\n\nBREAKING CHANGE: the key is now `x`.')]);
  assert.equal(p.next, '0.20.0');
  assert.equal(p.breaking.length, 1);
});

test('patch-only history bumps the patch', () => {
  const p = plan(['fix: a', 'ci: b', 'chore(deps): c', 'docs: d', 'refactor: e']);
  assert.equal(p.bump, 'patch');
  assert.equal(p.next, '0.19.19');
  assert.equal(p.drivers.length, 5);
});

test('a breaking change that is the only bump since the tag is not shipped as a patch', () => {
  const p = plan(['refactor!: remove the legacy skill']);
  assert.equal(p.bump, 'minor');
  assert.equal(p.next, '0.20.0');
  assert.equal(p.breaking.length, 1);
});

test('after 1.0 a breaking change bumps the major', () => {
  assert.equal(plan(['fix!: a'], { current: '1.2.3', latestTag: 'v1.2.3' }).next, '2.0.0');
  assert.equal(plan(['feat: a'], { current: '1.2.3', latestTag: 'v1.2.3' }).next, '1.3.0');
});

test('1.0.0 is only reached by hand', () => {
  assert.equal(plan(['feat!: a', 'feat: b']).next, '0.20.0');
  const manual = plan(['fix: a'], { override: 'major' });
  assert.equal(manual.next, '1.0.0');
  assert.equal(manual.overridden, true);
  assert.equal(manual.derived, 'patch');
  assert.throws(() => plan(['fix: a'], { override: 'huge' }), /Unknown bump/);
});

test('an unconventional subject counts as a patch and is flagged', () => {
  const p = plan(['Update README']);
  assert.equal(p.bump, 'patch');
  assert.deepEqual(p.unconventional.map((c) => c.subject), ['Update README']);
});

test('nothing since the tag means no release, and release commits do not count', () => {
  assert.equal(plan([]).release, false);
  assert.equal(plan(['chore(release): 0.19.18']).release, false);
});

test('no prior tag: the version file is the base and every commit counts', () => {
  const p = plan(['fix: a', 'feat: b'], { current: '0.3.1', latestTag: null });
  assert.equal(p.base, '0.3.1');
  assert.equal(p.next, '0.4.0');
  assert.equal(p.commits.length, 2);
});

test('version arithmetic', () => {
  assert.equal(bumpVersion('0.19.18', 'patch'), '0.19.19');
  assert.equal(compareVersions('0.20.0', 'v0.19.18'), 1);
  assert.equal(compareVersions('0.9.0', '0.10.0'), -1);
  assert.throws(() => bumpVersion('0.19', 'patch'), /not a release version/);
});

// ---------------------------------------------------------------- changelog

const CHANGELOG = [
  '# Changelog',
  '',
  '## [Unreleased]',
  '',
  '### Added',
  '- New thing.',
  '',
  '## [0.19.18] - 2026-09-28',
  '### Fixed',
  '- Old thing.',
  '',
].join('\n');

test('the cut moves [Unreleased] under the new heading and leaves older sections alone', () => {
  const out = cutChangelog(CHANGELOG, '0.20.0', '2026-11-23');
  assert.match(out, /## \[Unreleased\]\n\n## \[0\.20\.0\] - 2026-11-23\n\n### Added\n- New thing\./);
  assert.ok(out.endsWith('## [0.19.18] - 2026-09-28\n### Fixed\n- Old thing.\n'));
  assert.equal(unreleasedEntries(out).length, 0);
  assert.equal(changelogSection(out, '0.20.0'), '### Added\n- New thing.');
  assert.equal(changelogSection(out, '0.19.18'), '### Fixed\n- Old thing.');
});

test('an empty [Unreleased] refuses to release', () => {
  const empty = CHANGELOG.replace('### Added\n- New thing.\n', '### Added\n');
  assert.equal(unreleasedEntries(empty).length, 0);
  assert.throws(() => cutChangelog(empty, '0.20.0', '2026-11-23'), /\[Unreleased\] is empty/);
});

test('the cut refuses a version that already has a section, or a missing heading', () => {
  assert.throws(() => cutChangelog(CHANGELOG, '0.19.18', '2026-11-23'), /already has a 0\.19\.18 section/);
  assert.throws(() => cutChangelog('# Changelog\n', '0.20.0', '2026-11-23'), /no "## \[Unreleased\]"/);
  assert.throws(() => cutChangelog(CHANGELOG, '0.20.0', '23/11/2026'), /YYYY-MM-DD/);
});

test('the diff shows only the inserted heading', () => {
  const diff = lineDiff(CHANGELOG, cutChangelog(CHANGELOG, '0.20.0', '2026-11-23'), 'CHANGELOG.md');
  const changed = diff.split('\n').filter((l) => /^[+-][^+-]/.test(l) || l === '+' || l === '-');
  assert.deepEqual(changed.filter((l) => l.startsWith('-')), []);
  assert.ok(changed.includes('+## [0.20.0] - 2026-11-23'));
  assert.equal(lineDiff('same\n', 'same\n', 'x'), '');
  assert.match(lineDiff('a\nb\n', 'a\nc\n', 'x'), /^@@ -1,2 \+1,2 @@$/m);
});

// ---------------------------------------------------------------- against a repo copy

const TREES = ['scripts', 'skills', 'codex', 'instructions', 'plugins', '.claude-plugin', '.agents', '.cursor-plugin'];

function git(cwd, args) {
  const result = spawnSync(
    'git',
    ['-c', 'user.name=Dev', '-c', 'user.email=dev@example.com', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
    { cwd, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

/* The sandbox's own copy of a script, run inside the sandbox. */
const node = (cwd, script, args = [], from = cwd) =>
  spawnSync(process.execPath, [join(from, 'scripts', script), ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_HEAD_REF: '' },
  });

const readVersion = (dir, file) => JSON.parse(readFileSync(join(dir, file), 'utf8')).version;

/*
 * A copy of the repo whose history is: base (tagged with the copy's version)
 * then one `feat:` commit that adds an [Unreleased] entry. The entry is written
 * here so the test does not depend on what the real [Unreleased] holds today.
 */
function sandbox({ tag = true } = {}) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'dev-kit-release-')));
  for (const tree of TREES) {
    if (existsSync(join(ROOT, tree))) cpSync(join(ROOT, tree), join(dir, tree), { recursive: true });
  }
  writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG.replace('### Added\n- New thing.\n', ''));
  const version = readVersion(dir, '.claude-plugin/plugin.json');
  git(dir, ['init', '-q', '-b', 'main', '--template=']);
  git(dir, ['add', '.']);
  git(dir, ['commit', '-q', '-m', 'chore: base']);
  if (tag) git(dir, ['tag', `v${version}`]);
  writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG);
  git(dir, ['commit', '-q', '-am', 'feat: a sandbox feature']);
  return { dir, version, next: bumpVersion(version, 'minor') };
}

function inSandbox(options, fn) {
  const box = sandbox(options);
  try {
    return fn(box);
  } finally {
    rmSync(box.dir, { recursive: true, force: true });
  }
}

test('prepare --dry-run reports the release and writes nothing', () => {
  inSandbox({}, ({ dir, version, next }) => {
    const result = node(dir, 'release.mjs', ['prepare', '--dry-run', '--date', '2026-11-23']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /nothing written, committed or pushed/);
    assert.match(result.stdout, new RegExp(`Next version: \\*\\*${next.replaceAll('.', '\\.')}\\*\\* \\(minor bump\\)`));
    assert.match(result.stdout, /feat: a sandbox feature/);
    assert.match(result.stdout, /\+## \[\d+\.\d+\.0\] - 2026-11-23/);
    for (const file of ['.claude-plugin/plugin.json', 'CHANGELOG.md', ...GENERATED_MANIFESTS]) {
      assert.ok(result.stdout.includes(`\`${file}\``), `${file} is not listed`);
    }
    assert.equal(git(dir, ['status', '--porcelain']), '');
    assert.equal(readVersion(dir, '.claude-plugin/plugin.json'), version);
  });
});

test('a prepared release commit keeps CI green: clean rebuild, version-file exemption, both guards', () => {
  inSandbox({}, ({ dir, next }) => {
    git(dir, ['checkout', '-q', '-b', 'chore/release-next']);
    const prepared = node(dir, 'release.mjs', ['prepare', '--date', '2026-11-23']);
    assert.equal(prepared.status, 0, prepared.stderr);
    assert.match(prepared.stdout, new RegExp(`## Release ${next.replaceAll('.', '\\.')}`));
    for (const file of ['.claude-plugin/plugin.json', ...GENERATED_MANIFESTS]) {
      assert.equal(readVersion(dir, file), next, file);
    }
    assert.match(readFileSync(join(dir, 'CHANGELOG.md'), 'utf8'), new RegExp(`## \\[${next.replaceAll('.', '\\.')}\\] - 2026-11-23`));

    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', `chore(release): ${next}`]);

    // The publish job tags the commit that set the version, not a later tip of main.
    const releaseSha = git(dir, ['rev-parse', 'HEAD']).trim();
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'fix: landed after the release commit']);
    assert.equal(JSON.parse(node(dir, 'release.mjs', ['plan']).stdout).versionCommit, releaseSha);
    git(dir, ['reset', '-q', '--hard', releaseSha]);

    // CI's verify job: rebuild, then the tree must not move.
    const rebuild = node(dir, 'build-codex-plugin.mjs');
    assert.equal(rebuild.status, 0, rebuild.stderr);
    assert.equal(git(dir, ['status', '--porcelain']), '', 'the rebuild changed the release commit');

    // CI's forbid-version-file job: the release branch + subject are exempt. The check
    // reads the repo from its cwd; the same change on a feature branch still fails it.
    const check = node(dir, 'check-version-file.mjs', ['main'], ROOT);
    assert.equal(check.status, 0, check.stderr);
    git(dir, ['checkout', '-q', '-b', 'feat/sneaky-bump']);
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'feat: carry the bump along']);
    const feature = node(dir, 'check-version-file.mjs', ['main'], ROOT);
    assert.notEqual(feature.status, 0, 'a feature branch carrying the version passed the check');
    git(dir, ['checkout', '-q', 'chore/release-next']);

    // Guard #2 before tagging, Guard #3 after.
    const before = node(dir, 'release.mjs', ['verify', next]);
    assert.equal(before.status, 0, before.stderr);
    git(dir, ['tag', `v${next}`]);
    const after = node(dir, 'release.mjs', ['verify-tag', next]);
    assert.equal(after.status, 0, after.stderr);
    assert.equal(node(dir, 'release.mjs', ['notes', next]).stdout.trim(), '### Added\n- New thing.');

    // Tagged and nothing new: no release.
    const again = node(dir, 'release.mjs', ['prepare', '--dry-run']);
    assert.equal(again.status, 0, again.stderr);
    assert.match(again.stdout, /Nothing to release/);
  });
});

test('a BREAKING CHANGE footer in a real commit body is read and flagged', () => {
  inSandbox({}, ({ dir }) => {
    git(dir, ['commit', '-q', '--allow-empty', '-m', 'fix: rename the key', '-m', 'BREAKING CHANGE: the key is now `x`.']);
    const p = JSON.parse(node(dir, 'release.mjs', ['plan']).stdout);
    assert.deepEqual(p.breaking.map((c) => c.subject), ['fix: rename the key']);
    const report = node(dir, 'release.mjs', ['prepare', '--dry-run']).stdout;
    assert.match(report, /fix: rename the key \*\*\(breaking\)\*\*/);
  });
});

test('Guard #2 rejects a version that is already tagged or not newer', () => {
  inSandbox({}, ({ dir, version }) => {
    const result = node(dir, 'release.mjs', ['verify', version]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already tagged/);
    assert.match(result.stderr, /not newer than the latest tag/);
  });
});

test('Guard #3 rejects a tag whose manifests carry another version', () => {
  inSandbox({}, ({ dir, version, next }) => {
    git(dir, ['tag', `v${next}`]);
    const result = node(dir, 'release.mjs', ['verify-tag', next]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, new RegExp(`carries ${version.replaceAll('.', '\\.')}`));
  });
});

test('prepare refuses a dirty tree and a version file that does not match the latest tag', () => {
  inSandbox({}, ({ dir }) => {
    writeFileSync(join(dir, 'stray.txt'), 'x\n');
    const dirty = node(dir, 'release.mjs', ['prepare']);
    assert.notEqual(dirty.status, 0);
    assert.match(dirty.stderr, /uncommitted changes/);
    rmSync(join(dir, 'stray.txt'));

    const file = join(dir, '.claude-plugin', 'plugin.json');
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"version": "[^"]+"/, '"version": "9.9.9"'));
    git(dir, ['commit', '-q', '-am', 'fix: hand-edited version']);
    const mismatch = node(dir, 'release.mjs', ['prepare', '--dry-run']);
    assert.notEqual(mismatch.status, 0);
    assert.match(mismatch.stderr, /release job owns the version/);

    // A malformed version never reaches the workflow's step outputs.
    writeFileSync(file, readFileSync(file, 'utf8').replace(/"version": "[^"]+"/, '"version": "1.0.0\\nx=1"'));
    const malformed = node(dir, 'release.mjs', ['plan']);
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /not a release version/);
  });
});

test('no prior tag: plan counts every commit and the version file is the base', () => {
  inSandbox({ tag: false }, ({ dir, version, next }) => {
    const result = node(dir, 'release.mjs', ['plan']);
    assert.equal(result.status, 0, result.stderr);
    const p = JSON.parse(result.stdout);
    assert.equal(p.latestTag, null);
    assert.equal(p.base, version);
    assert.equal(p.next, next);
    assert.equal(p.commits.length, 2);
    assert.equal(p.currentTagged, false);
  });
});

test('an empty [Unreleased] stops prepare with what to do', () => {
  inSandbox({}, ({ dir }) => {
    writeFileSync(join(dir, 'CHANGELOG.md'), CHANGELOG.replace('### Added\n- New thing.\n', '### Added\n'));
    git(dir, ['commit', '-q', '-am', 'fix: no notes']);
    const planned = JSON.parse(node(dir, 'release.mjs', ['plan']).stdout);
    assert.equal(planned.release, true);
    assert.equal(planned.unreleasedEntries, 0);
    const result = node(dir, 'release.mjs', ['prepare', '--dry-run']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /add the user-facing entries under \[Unreleased\]/);
  });
});
