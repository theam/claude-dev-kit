#!/usr/bin/env node
/*
 * build-codex-plugin — materialize the Codex plugin from the canonical sources.
 *
 * The Codex plugin at plugins/fullstack-dev-kit/ must carry its own copy of the
 * skills (Codex reads them from the plugin dir), but the single source of truth is
 * the top-level skills/. This copies skills/ into the plugin and keeps the plugin's
 * version aligned with .claude-plugin/plugin.json, so we maintain one set of files.
 *
 * Run on release (and commit the result, so the repo is directly installable as a
 * Codex marketplace via `codex plugin marketplace add theam/claude-dev-kit`).
 *
 *   node scripts/build-codex-plugin.mjs
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SKILLS = join(ROOT, 'skills');
const PLUGIN = join(ROOT, 'plugins', 'fullstack-dev-kit');
const DST_SKILLS = join(PLUGIN, 'skills');

// 1. Resync skills (canonical top-level skills/ → plugin/skills/).
rmSync(DST_SKILLS, { recursive: true, force: true });
mkdirSync(DST_SKILLS, { recursive: true });
let n = 0;
for (const name of readdirSync(SRC_SKILLS)) {
  if (!existsSync(join(SRC_SKILLS, name, 'SKILL.md'))) continue;
  cpSync(join(SRC_SKILLS, name), join(DST_SKILLS, name), { recursive: true });
  n++;
}

// 2. Keep the Codex plugin version aligned with the kit version.
const kitVersion = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const manifestPath = join(PLUGIN, '.codex-plugin', 'plugin.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== kitVersion) {
  manifest.version = kitVersion;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

console.log(`Codex plugin built: ${n} skills synced, version ${kitVersion}.`);
