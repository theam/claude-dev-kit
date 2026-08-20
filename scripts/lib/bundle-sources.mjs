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

/*
 * The manifest pair. Codex reads `.codex-plugin/plugin.json` from inside the bundle;
 * portable clients (Cursor, VS Code, Copilot, …) read the bundle-root `plugin.json`,
 * which is *generated* from it. Same rule as the trees above: the derivation lives here
 * so the builder and the validator cannot disagree about what it should contain. Without
 * this, editing the Codex manifest and skipping the build leaves the portable copy stale
 * and validation still passes — the exact bug class the tree guard exists to prevent.
 */
export const CODEX_MANIFEST = join(PLUGIN_DIR, '.codex-plugin', 'plugin.json');
export const PORTABLE_MANIFEST = join(PLUGIN_DIR, 'plugin.json');
export const PORTABLE_SCHEMA = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json';

/*
 * The portable Agent Plugins 1.0.0 manifest, derived from the Codex manifest. The
 * portable schema is closed, so it has no home for Codex's `skills` (dropped — portable
 * hosts auto-discover from skills/) or `interface` (rides under our reverse-DNS
 * extensions namespace).
 */
export function portableManifestFrom(codex) {
  return {
    $schema: PORTABLE_SCHEMA,
    name: codex.name,
    version: codex.version,
    description: codex.description,
    author: codex.author,
    homepage: codex.homepage,
    repository: codex.repository,
    license: codex.license,
    keywords: codex.keywords,
    extensions: { 'com.theagilemonkeys.dev-kit': { interface: codex.interface } },
  };
}

/** Serialised exactly as the builder writes it, so a byte comparison is meaningful. */
export function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/*
 * Cursor manifests. Cursor's marketplace wants either a root `plugin.json` (which our
 * monorepo can't have — the plugin lives in a subdir) or a root `.cursor-plugin/
 * marketplace.json` whose entry `source` points at a subdir carrying its own
 * `.cursor-plugin/plugin.json`. So we generate both from the same Codex manifest, exactly
 * like the portable one. Cursor's plugin manifest is its own (non-portable) format, so it
 * *may* carry a `skills` path; the skills auto-discover from the plugin dir anyway.
 */
export const CURSOR_MARKETPLACE = join('.cursor-plugin', 'marketplace.json'); // at repo root
export const CURSOR_PLUGIN_MANIFEST = join(PLUGIN_DIR, '.cursor-plugin', 'plugin.json');
const PLUGIN_DIR_POSIX = 'plugins/fullstack-dev-kit'; // forward-slash for the JSON `source`

export function cursorPluginManifestFrom(codex) {
  return {
    name: codex.name,
    version: codex.version,
    description: codex.description,
    // Cursor's author schema is {name, email?} — drop the portable {url}.
    author: codex.author?.name ? { name: codex.author.name } : codex.author,
    homepage: codex.homepage,
    repository: codex.repository,
    license: codex.license,
    keywords: codex.keywords,
    logo: codex.interface?.logo || './assets/logo.png',
    skills: './skills/',
  };
}

export function cursorMarketplaceFrom(codex) {
  return {
    name: 'claude-dev-kit',
    owner: { name: codex.author?.name || 'The Agile Monkeys' },
    metadata: { description: codex.description },
    plugins: [
      {
        name: codex.name,
        source: PLUGIN_DIR_POSIX,
        description: codex.interface?.shortDescription || codex.description,
        category: codex.interface?.category,
      },
    ],
  };
}

/*
 * Two skill collections deliberately share one destination (`skills/` and `codex/skills/`
 * both land in the bundle's `skills/`). A skill *name* in both would make the build
 * second-wins and the validator would then report drift with no way to fix it. Nothing
 * collides today; this makes a future one fail at its cause instead.
 */
export function skillNameCollisions(root) {
  const owner = new Map();
  const collisions = [];
  for (const { src, dst } of SKILL_SOURCES) {
    for (const name of skillDirs(root, src)) {
      const key = join(dst, name);
      const previous = owner.get(key);
      if (previous) collisions.push({ name, sources: [previous, src] });
      else owner.set(key, src);
    }
  }
  return collisions;
}

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
