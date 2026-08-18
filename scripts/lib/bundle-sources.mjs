/*
 * bundle-sources — the one description of what the Codex/portable bundle is copied from.
 *
 * The builder copies these trees into plugins/fullstack-dev-kit/; the validator checks
 * the copies still match. Both import this module so they cannot disagree: a mapping
 * added for the builder is a mapping the validator enforces, with no second edit.
 */
import { readdirSync, existsSync, statSync } from 'node:fs';
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
