#!/usr/bin/env node
/*
 * release — the release job's tooling. Feature pull requests never set the
 * version (scripts/check-version-file.mjs fails them). This script derives it
 * on main from what landed since the latest v* tag.
 *
 *   node scripts/release.mjs plan [--bump auto|patch|minor|major]
 *       JSON: the current version, whether it is tagged, and the next release.
 *   node scripts/release.mjs prepare [--dry-run] [--bump auto|patch|minor|major] [--date YYYY-MM-DD]
 *       Write the version file, move CHANGELOG [Unreleased] under the new
 *       heading, rebuild the bundle. Prints the report the release PR uses as
 *       its body. --dry-run prints the same report and writes nothing.
 *   node scripts/release.mjs notes <X.Y.Z>
 *       That version's CHANGELOG section, used as the GitHub Release notes.
 *   node scripts/release.mjs verify <X.Y.Z>
 *       Before tagging (Guard #2): newer than every tag, not tagged yet, and
 *       every manifest carries it.
 *   node scripts/release.mjs verify-tag <X.Y.Z>
 *       After tagging (Guard #3): the tagged tree carries that version.
 *
 * The bump comes from the conventional-commit subjects since the latest tag:
 *   0.x:    feat!, a BREAKING CHANGE footer, or feat -> minor. Anything else -> patch.
 *   >= 1.0: breaking -> major, feat -> minor, anything else -> patch.
 * 1.0.0 is never reached on its own: from 0.x a major bump only comes from
 * --bump major. A subject that is not conventional counts as a patch and the
 * report flags it. Breaking commits are always listed, even when they share
 * the bump with a feat.
 *
 * The release commit carries the version file, the moved CHANGELOG section and
 * the rebuilt manifests together, so CI's rebuild-and-diff stays clean.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { versionFileFromBuildScript } from './check-version-file.mjs';
import { CODEX_MANIFEST, PORTABLE_MANIFEST, CURSOR_PLUGIN_MANIFEST } from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const LEVELS = ['patch', 'minor', 'major'];
const CONVENTIONAL = /^([a-z]+)(\([^)]*\))?(!)?: \S/i;
const BREAKING_FOOTER = /^BREAKING[ -]CHANGE: /m;
const RELEASE_SUBJECT = 'chore(release):';

/* The generated manifests that carry the version. The build rewrites them from
 * the version file; they are listed so the report and Guard #3 name them. */
const posix = (path) => path.replaceAll('\\', '/');
export const GENERATED_MANIFESTS = [CODEX_MANIFEST, PORTABLE_MANIFEST, CURSOR_PLUGIN_MANIFEST].map(posix);

// ---------------------------------------------------------------- versions

export function parseVersion(text) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text).trim());
  if (!match) throw new Error(`"${text}" is not a release version (X.Y.Z).`);
  return match.slice(1).map(Number);
}

export function compareVersions(a, b) {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

export function bumpVersion(version, level) {
  const [major, minor, patch] = parseVersion(version);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error(`Unknown bump "${level}". Use patch, minor or major.`);
}

// ---------------------------------------------------------------- bump rule

export function classifyCommit({ subject, body = '' }) {
  const match = CONVENTIONAL.exec(subject);
  const type = match ? match[1].toLowerCase() : null;
  return {
    conventional: Boolean(match),
    breaking: Boolean(match?.[3]) || BREAKING_FOOTER.test(body),
    feature: type === 'feat',
  };
}

/* The level one commit asks for. Before 1.0 a breaking change bumps the minor. */
export function levelFor(commit, major) {
  const { breaking, feature } = classifyCommit(commit);
  if (breaking) return major === 0 ? 'minor' : 'major';
  if (feature) return 'minor';
  return 'patch';
}

/*
 * What a release would be. `latestTag` is "vX.Y.Z" or null. With no tag yet,
 * the version file is treated as the last release and every commit counts.
 */
export function planRelease({ current, latestTag, commits, override = null }) {
  const base = latestTag ? latestTag.replace(/^v/, '') : current;
  parseVersion(base);
  if (override !== null && !LEVELS.includes(override)) {
    throw new Error(`Unknown bump "${override}". Use patch, minor or major.`);
  }
  const rows = commits
    .filter((c) => !c.subject.startsWith(RELEASE_SUBJECT))
    .map((c) => ({ ...c, ...classifyCommit(c), level: levelFor(c, parseVersion(base)[0]) }));
  if (rows.length === 0) {
    return { release: false, reason: `No commits since ${latestTag ?? 'the first commit'}.`, base, latestTag };
  }
  const derived = rows.reduce((top, r) => (LEVELS.indexOf(r.level) > LEVELS.indexOf(top) ? r.level : top), 'patch');
  const bump = override ?? derived;
  return {
    release: true,
    base,
    latestTag,
    bump,
    derived,
    overridden: override !== null,
    next: bumpVersion(base, bump),
    commits: rows,
    drivers: rows.filter((r) => r.level === derived),
    breaking: rows.filter((r) => r.breaking),
    unconventional: rows.filter((r) => !r.conventional),
  };
}

// ---------------------------------------------------------------- changelog

function unreleasedBounds(lines) {
  const start = lines.findIndex((line) => /^## \[Unreleased\]\s*$/.test(line));
  if (start < 0) throw new Error('CHANGELOG.md has no "## [Unreleased]" heading.');
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  return { start, end };
}

/* Entry lines under [Unreleased]: not blank, not a "### Added"-style heading. */
export function unreleasedEntries(text) {
  const lines = text.split('\n');
  const { start, end } = unreleasedBounds(lines);
  return lines.slice(start + 1, end).filter((line) => line.trim() && !line.startsWith('### '));
}

export function cutChangelog(text, version, date) {
  parseVersion(version);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`"${date}" is not a YYYY-MM-DD date.`);
  const lines = text.split('\n');
  if (lines.some((line) => line.startsWith(`## [${version}]`))) {
    throw new Error(`CHANGELOG.md already has a ${version} section.`);
  }
  const { start } = unreleasedBounds(lines);
  if (unreleasedEntries(text).length === 0) {
    throw new Error(
      'CHANGELOG.md [Unreleased] is empty. A release needs notes: add the user-facing entries under [Unreleased] first.',
    );
  }
  lines.splice(start, 1, '## [Unreleased]', '', `## [${version}] - ${date}`);
  return lines.join('\n');
}

export function changelogSection(text, version) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) throw new Error(`CHANGELOG.md has no ${version} section.`);
  let end = lines.findIndex((line, i) => i > start && line.startsWith('## '));
  if (end < 0) end = lines.length;
  const body = lines.slice(start + 1, end).join('\n').trim();
  if (!body) throw new Error(`CHANGELOG.md ${version} section is empty.`);
  return body;
}

/* One-hunk unified diff. Enough for the release edit, which is a single insert. */
export function lineDiff(before, after, label, context = 2) {
  // A final newline is not a line of its own; counting it would skew the hunk header.
  const lines = (text) => (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n');
  const a = lines(before);
  const b = lines(after);
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) suffix++;
  if (prefix === a.length && prefix === b.length) return '';
  const from = Math.max(0, prefix - context);
  const tail = Math.min(suffix, context);
  const removed = a.slice(prefix, a.length - suffix);
  const added = b.slice(prefix, b.length - suffix);
  const lead = a.slice(from, prefix);
  const trail = a.slice(a.length - suffix, a.length - suffix + tail);
  const oldCount = lead.length + removed.length + trail.length;
  const newCount = lead.length + added.length + trail.length;
  return [
    `--- a/${label}`,
    `+++ b/${label}`,
    `@@ -${from + 1},${oldCount} +${from + 1},${newCount} @@`,
    ...lead.map((line) => ` ${line}`),
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
    ...trail.map((line) => ` ${line}`),
  ].join('\n');
}

// ---------------------------------------------------------------- git

function git(repo, args) {
  const result = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (result.status !== 0) throw new Error((result.stderr || `git ${args[0]} failed.`).trim());
  return result.stdout;
}

const isReleaseTag = (tag) => /^v\d+\.\d+\.\d+$/.test(tag);

/* Highest vX.Y.Z tag. merged: only tags in HEAD's history (what the bump counts from). */
export function latestTag(repo, { merged = true } = {}) {
  const args = ['tag', '--list', 'v*', ...(merged ? ['--merged', 'HEAD'] : [])];
  const tags = git(repo, args).split('\n').filter(isReleaseTag).sort(compareVersions);
  return tags.at(-1) ?? null;
}

export function tagExists(repo, tag) {
  return spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: repo }).status === 0;
}

export function commitsSince(repo, tag) {
  const out = git(repo, ['log', '--format=%h%x1f%s%x1f%b%x1e', ...(tag ? [`${tag}..HEAD`] : ['HEAD'])]);
  return out
    .split('\x1e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha, subject, body = ''] = record.split('\x1f');
      return { sha, subject, body };
    });
}

// ---------------------------------------------------------------- repo state

export function versionFile(repo) {
  return versionFileFromBuildScript(readFileSync(join(repo, 'scripts', 'build-codex-plugin.mjs'), 'utf8'));
}

const readVersion = (repo, file) => JSON.parse(readFileSync(join(repo, file), 'utf8')).version;

/* Everything the workflow needs to decide between publish and release-pr. Never throws on a mismatch. */
export function repoPlan(repo, { override = null } = {}) {
  const file = versionFile(repo);
  const current = readVersion(repo, file);
  parseVersion(current); // a malformed version stops here, before it reaches the workflow's outputs
  const tag = latestTag(repo);
  const plan = planRelease({ current, latestTag: tag, commits: commitsSince(repo, tag), override });
  const changelog = readFileSync(join(repo, 'CHANGELOG.md'), 'utf8');
  return {
    ...plan,
    versionFile: file,
    current,
    currentTagged: tagExists(repo, `v${current}`),
    // The commit that set this version: the publish job tags it, not whatever is newest on main.
    versionCommit: git(repo, ['log', '-1', '--format=%H', '--', file]).trim() || null,
    unreleasedEntries: unreleasedEntries(changelog).length,
  };
}

// ---------------------------------------------------------------- report

const commitLine = (c) => `- \`${c.sha}\` ${c.subject}${c.breaking ? ' **(breaking)**' : ''}`;

export function renderReport({ plan, files, diff, dryRun }) {
  const since = plan.latestTag ?? 'the first commit';
  const out = [
    dryRun ? '## Release dry run: nothing written, committed or pushed' : `## Release ${plan.next}`,
    '',
    `- Latest tag: ${plan.latestTag ?? 'none (the version file counts as the last release)'}`,
    `- Next version: **${plan.next}** (${plan.bump} bump${plan.overridden ? `, set by --bump; the commits alone give ${plan.derived}` : ''})`,
    '',
    '### Why this bump',
    plan.overridden
      ? `Set by hand with \`--bump ${plan.bump}\`.`
      : `The ${plan.derived} bump comes from:`,
    ...(plan.overridden ? [] : plan.drivers.map(commitLine)),
    '',
    '### Breaking changes',
    ...(plan.breaking.length
      ? [
          ...plan.breaking.map(commitLine),
          '',
          plan.base.startsWith('0.')
            ? 'Before 1.0 a breaking change bumps the minor. 1.0.0 only comes from `--bump major`.'
            : 'A breaking change bumps the major.',
        ]
      : ['None.']),
    '',
  ];
  if (plan.unconventional.length) {
    out.push('### Not conventional (counted as a patch)', ...plan.unconventional.map(commitLine), '');
  }
  out.push(
    `### All commits since ${since} (${plan.commits.length})`,
    ...plan.commits.map((c) => `- \`${c.sha}\` [${c.level}] ${c.subject}`),
    '',
    dryRun ? '### Files it would touch' : '### Files in this release commit',
    ...files.map((f) => `- \`${f}\``),
    '',
    '### CHANGELOG diff',
    '```diff',
    diff,
    '```',
  );
  if (!dryRun) {
    out.push(
      '',
      `Merging this PR tags \`v${plan.next}\` and publishes the GitHub Release. ` +
        'Do not edit it by hand: every push to `main` recomputes this PR.',
    );
  }
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------- commands

const today = () => new Date().toISOString().slice(0, 10);

export function prepare({ repo = ROOT, dryRun = false, override = null, date = today() } = {}) {
  const plan = repoPlan(repo, { override });
  if (plan.latestTag && plan.latestTag !== `v${plan.current}`) {
    throw new Error(
      `${plan.versionFile} says ${plan.current}, but the latest tag is ${plan.latestTag}. ` +
        'The release job owns the version. If a release PR merged and is not tagged yet, ' +
        `let the publish job tag it first. Otherwise restore ${plan.latestTag.slice(1)}.`,
    );
  }
  if (!plan.release) return { plan, written: false, report: `${plan.reason} Nothing to release.\n` };

  const changelogPath = join(repo, 'CHANGELOG.md');
  const before = readFileSync(changelogPath, 'utf8');
  const after = cutChangelog(before, plan.next, date);
  const files = [plan.versionFile, 'CHANGELOG.md', ...GENERATED_MANIFESTS];
  const report = renderReport({ plan, files, diff: lineDiff(before, after, 'CHANGELOG.md'), dryRun });
  if (dryRun) return { plan, written: false, report };

  if (git(repo, ['status', '--porcelain']).trim()) {
    throw new Error('The working tree has uncommitted changes. prepare writes the release commit; start from a clean checkout.');
  }
  const manifestPath = join(repo, plan.versionFile);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.version = plan.next;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(changelogPath, after);

  const build = spawnSync(process.execPath, [join(repo, 'scripts', 'build-codex-plugin.mjs')], { encoding: 'utf8' });
  if (build.status !== 0) throw new Error(`The rebuild failed:\n${build.stderr || build.stdout}`);
  return { plan, written: true, report };
}

/* Guard #2, before tagging: the version is new, untagged, and every manifest carries it. */
export function verifyBeforeTag({ repo = ROOT, version }) {
  parseVersion(version);
  const errors = [];
  for (const file of [versionFile(repo), ...GENERATED_MANIFESTS]) {
    const found = readVersion(repo, file);
    if (found !== version) errors.push(`${file} carries ${found}, not ${version}.`);
  }
  if (tagExists(repo, `v${version}`)) errors.push(`v${version} is already tagged.`);
  const top = latestTag(repo, { merged: false });
  if (top && compareVersions(version, top) <= 0) errors.push(`${version} is not newer than the latest tag ${top}.`);
  const validate = spawnSync(process.execPath, [join(repo, 'scripts', 'validate-codex-plugin.mjs')], { encoding: 'utf8' });
  if (validate.status !== 0) errors.push(`The bundle does not validate:\n${validate.stderr || validate.stdout}`);
  return errors;
}

/* Guard #3, after tagging: what the tag points at carries the version in every manifest. */
export function verifyTag({ repo = ROOT, version }) {
  parseVersion(version);
  const tag = `v${version}`;
  if (!tagExists(repo, tag)) return [`${tag} does not exist.`];
  const errors = [];
  for (const file of [versionFile(repo), ...GENERATED_MANIFESTS]) {
    const found = JSON.parse(git(repo, ['show', `${tag}:${file}`])).version;
    if (found !== version) errors.push(`${tag}:${file} carries ${found}, not ${version}.`);
  }
  return errors;
}

function parseArgs(argv) {
  const args = { _: [], dryRun: false, override: null, date: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--bump') {
      const value = argv[++i] ?? '';
      args.override = value === 'auto' ? null : value;
    }
    else if (arg === '--date') args.date = argv[++i] ?? '';
    else args._.push(arg);
  }
  return args;
}

function fail(errors) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

function main(argv) {
  const args = parseArgs(argv);
  const [command, version] = args._;
  if (command === 'plan') {
    console.log(JSON.stringify(repoPlan(ROOT, { override: args.override }), null, 2));
  } else if (command === 'prepare') {
    process.stdout.write(prepare({ dryRun: args.dryRun, override: args.override, date: args.date }).report);
  } else if (command === 'notes') {
    console.log(changelogSection(readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8'), version));
  } else if (command === 'verify') {
    const errors = verifyBeforeTag({ version });
    if (errors.length) fail(errors);
    console.log(`${version} is ready to tag.`);
  } else if (command === 'verify-tag') {
    const errors = verifyTag({ version });
    if (errors.length) fail(errors);
    console.log(`v${version} carries ${version} in every manifest.`);
  } else {
    fail(['Usage: release.mjs plan | prepare [--dry-run] [--bump auto|patch|minor|major] [--date YYYY-MM-DD] | notes <X.Y.Z> | verify <X.Y.Z> | verify-tag <X.Y.Z>']);
  }
}

// realpath: a symlinked temp dir (macOS /var -> /private/var) must still count as run directly.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    fail([err.message]);
  }
}
