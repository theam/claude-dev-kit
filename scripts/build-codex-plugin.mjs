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
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { SKILL_SOURCES, TREE_SOURCES, skillDirs } from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(ROOT, 'plugins', 'fullstack-dev-kit');
const DST_SKILLS = join(PLUGIN, 'skills');
const DST_INSTR = join(PLUGIN, 'instructions');

// 1. Resync every mapped tree from lib/bundle-sources.mjs. The map is shared with the
// validator, so a source added here is a source the validator checks for staleness.
// `skills/` ships everywhere; `codex/skills/` is bundle-only (the work-story playbook
// for hosts with no orchestrator subagent). instructions/ has to travel too, or a
// native Codex install cannot run the kit's own security/testing/stack rules.
rmSync(DST_SKILLS, { recursive: true, force: true });
mkdirSync(DST_SKILLS, { recursive: true });
let n = 0;
for (const { src, dst } of SKILL_SOURCES) {
  for (const name of skillDirs(ROOT, src)) {
    cpSync(join(ROOT, src, name), join(ROOT, dst, name), { recursive: true });
    n++;
  }
}
for (const { src, dst } of TREE_SOURCES) {
  rmSync(join(ROOT, dst), { recursive: true, force: true });
  if (existsSync(join(ROOT, src))) cpSync(join(ROOT, src), join(ROOT, dst), { recursive: true });
}

// 2. Keep the Codex plugin version aligned with the kit version.
const kitVersion = JSON.parse(readFileSync(join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
const manifestPath = join(PLUGIN, '.codex-plugin', 'plugin.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.version !== kitVersion) {
  manifest.version = kitVersion;
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

// 3. Dual-emit the PORTABLE Agent Plugins 1.0.0 manifest at the plugin root.
// Codex reads .codex-plugin/plugin.json (required — verified: Codex 0.147 errors
// "missing plugin.json" without it); portable clients (Cursor, VS Code, Copilot, …)
// read this root plugin.json. Generated from the Codex manifest = one source of truth.
// The portable schema is closed and has no home for Codex's `interface`/`skills` keys,
// so `skills` is dropped (skills are auto-discovered from skills/) and `interface`
// rides under our reverse-DNS extensions namespace.
const cm = JSON.parse(readFileSync(manifestPath, 'utf8'));
const portable = {
  $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json',
  name: cm.name,
  version: cm.version,
  description: cm.description,
  author: cm.author,          // {name, url} object — valid under the portable schema
  homepage: cm.homepage,
  repository: cm.repository,
  license: cm.license,
  keywords: cm.keywords,
  extensions: { 'com.theagilemonkeys.dev-kit': { interface: cm.interface } },
};
writeFileSync(join(PLUGIN, 'plugin.json'), JSON.stringify(portable, null, 2) + '\n');

console.log(`Codex plugin built: ${n} skills + instructions/ synced, version ${kitVersion} (native + portable manifests).`);

// Validate the freshly-built bundle (structure, enums, self-contained instructions).
const v = spawnSync(process.execPath, [join(ROOT, 'scripts', 'validate-codex-plugin.mjs')], { stdio: 'inherit' });
if (v.status !== 0) process.exit(v.status || 1);
