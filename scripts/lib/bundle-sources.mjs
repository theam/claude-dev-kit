/*
 * bundle-sources — the one description of what the Codex/portable bundle is copied from.
 *
 * The builder copies these trees into plugins/fullstack-dev-kit/; the validator checks
 * the copies still match. Both import this module so they cannot disagree: a mapping
 * added for the builder is a mapping the validator enforces, with no second edit.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export const PLUGIN_DIR = join('plugins', 'fullstack-dev-kit');

/*
 * Skill collections. `skills/` ships to every host; `codex/skills/` is bundle-only
 * (hosts without an orchestrator subagent follow the playbook directly), which is why
 * a skill present in the bundle but absent from `skills/` is not automatically stale.
 */
export const SKILL_SOURCES = [
  { src: 'skills', dst: join(PLUGIN_DIR, 'skills'), bundleOnly: false },
  { src: join('codex', 'skills'), dst: join(PLUGIN_DIR, 'skills'), bundleOnly: true },
];

/* Whole trees copied verbatim. Skills reference these by relative path, so the bundle
 * is only self-contained if the copy is current, not merely present. */
export const TREE_SOURCES = [{ src: 'instructions', dst: join(PLUGIN_DIR, 'instructions') }];

/** Directories under `src` that are skills (have a SKILL.md). */
export function skillDirs(root, src) {
  const dir = join(root, src);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => existsSync(join(dir, name, 'SKILL.md')));
}

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Every file that must be byte-identical between a canonical source and the bundle,
 * as { src, dst, label } absolute-path pairs.
 */
export function syncedFilePairs(root) {
  const pairs = [];
  for (const { src, dst } of SKILL_SOURCES) {
    for (const name of skillDirs(root, src)) {
      const from = join(root, src, name);
      for (const file of walk(from)) {
        pairs.push({
          src: file,
          dst: join(root, dst, name, relative(from, file)),
          label: join(src, name, relative(from, file)),
        });
      }
    }
  }
  for (const { src, dst } of TREE_SOURCES) {
    const from = join(root, src);
    for (const file of walk(from)) {
      pairs.push({
        src: file,
        dst: join(root, dst, relative(from, file)),
        label: join(src, relative(from, file)),
      });
    }
  }
  return pairs;
}

/**
 * Files inside a mapped bundle tree that no canonical source produces — a skill or
 * instruction deleted upstream leaves its copy behind until the next build.
 */
export function orphanedBundleFiles(root) {
  const expected = new Set(syncedFilePairs(root).map((p) => p.dst));
  const orphans = [];
  for (const name of skillDirs(root, join(PLUGIN_DIR, 'skills'))) {
    for (const file of walk(join(root, PLUGIN_DIR, 'skills', name))) {
      if (!expected.has(file)) orphans.push(relative(root, file));
    }
  }
  for (const { dst } of TREE_SOURCES) {
    for (const file of walk(join(root, dst))) {
      if (!expected.has(file)) orphans.push(relative(root, file));
    }
  }
  return orphans;
}

/** Byte-level drift of every synced source→bundle file pair. */
export function syncedFileDrift(root) {
  const missing = [];
  const drifted = [];
  for (const { src, dst, label } of syncedFilePairs(root)) {
    if (!existsSync(dst)) { missing.push(label); continue; }
    if (readFileSync(src).equals(readFileSync(dst))) continue;
    drifted.push(label);
  }
  return { missing, drifted };
}

/**
 * Skill names that appear in more than one skill source. Both SKILL_SOURCES copy into
 * the same bundle `skills/` dir, so a shared name is a copy-into-same-dst collision:
 * the build is second-wins and the validator then reports drift no rebuild can fix.
 * There is none today (only `work-story` under codex/skills/), so this is a guardrail.
 */
export function collidingSkillNames(root) {
  const counts = new Map();
  for (const { src } of SKILL_SOURCES) {
    for (const name of skillDirs(root, src)) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

// The portable Agent Plugins 1.0.0 manifest is a pure transform of the Codex manifest.
// Keeping that transform here (not inline in the builder) lets the validator re-derive
// the expected portable manifest and byte-compare it to the committed one — closing the
// drift class the tree guard already closes, for the generated manifest pair.
export const PORTABLE_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';
export const PORTABLE_EXTENSION = 'com.theagilemonkeys.dev-kit';

/**
 * Derive the portable root plugin.json from the Codex `.codex-plugin/plugin.json`.
 * The portable schema is closed: `skills` has no home (skills are auto-discovered) and
 * `interface` rides under our reverse-DNS extensions namespace.
 */
export function derivePortableManifest(cm) {
  return {
    $schema: PORTABLE_SCHEMA,
    name: cm.name,
    version: cm.version,
    description: cm.description,
    author: cm.author,
    homepage: cm.homepage,
    repository: cm.repository,
    license: cm.license,
    keywords: cm.keywords,
    extensions: { [PORTABLE_EXTENSION]: { interface: cm.interface } },
  };
}

/** Exact on-disk serialization the builder writes (so byte-compare is meaningful). */
export function serializeManifest(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

/**
 * Whether the committed portable plugin.json still matches what the current Codex
 * manifest would generate. Returns null when in sync (or when either manifest is
 * absent — that is the structural checks' job), else a human-readable reason.
 */
export function portableManifestDrift(root) {
  const codexPath = join(root, PLUGIN_DIR, '.codex-plugin', 'plugin.json');
  const portPath = join(root, PLUGIN_DIR, 'plugin.json');
  if (!existsSync(codexPath) || !existsSync(portPath)) return null;
  let cm;
  try { cm = JSON.parse(readFileSync(codexPath, 'utf8')); } catch { return null; }
  const expected = serializeManifest(derivePortableManifest(cm));
  if (readFileSync(portPath, 'utf8') === expected) return null;
  return 'portable plugin.json differs from what .codex-plugin/plugin.json would generate';
}
