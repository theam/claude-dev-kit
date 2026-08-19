#!/usr/bin/env node
/*
 * validate-codex-plugin — structural checks on the Codex marketplace + plugin bundle.
 *
 * Zero-dep, no Codex required, so it runs anywhere (CI, pre-commit, or at the end of
 * build-codex-plugin.mjs). It encodes the constraints confirmed against the real
 * codex-cli 0.147 app-server schema (enum values, required fields) plus the kit's own
 * rule that the bundle must be self-contained — every instructions/… file a skill
 * references must exist in the plugin (this is the check that would have caught the
 * missing-instructions bug pr-review found on #28).
 *
 * Exits non-zero with a list of problems, or 0 if the bundle is valid.
 *
 *   node scripts/validate-codex-plugin.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncedFileDrift, orphanedBundleFiles, collidingSkillNames, portableManifestDrift } from './lib/bundle-sources.mjs';

// DEVKIT_ROOT lets the test suite validate a throwaway fixture tree; unset, it resolves
// to the repo root as before.
const ROOT = process.env.DEVKIT_ROOT ? resolve(process.env.DEVKIT_ROOT) : join(dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = join(ROOT, 'plugins', 'fullstack-dev-kit');
const errs = [];
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// 1. Marketplace manifest.
const mpPath = join(ROOT, '.agents', 'plugins', 'marketplace.json');
if (!existsSync(mpPath)) errs.push(`missing ${mpPath}`);
else {
  let mp; try { mp = readJson(mpPath); } catch (e) { errs.push(`marketplace.json is not valid JSON: ${e.message}`); }
  if (mp) {
    if (!mp.name) errs.push('marketplace.json: missing "name"');
    if (!Array.isArray(mp.plugins) || !mp.plugins.length) errs.push('marketplace.json: "plugins" must be a non-empty array');
    const INSTALL = ['NOT_AVAILABLE', 'AVAILABLE', 'INSTALLED_BY_DEFAULT'];
    const AUTH = ['ON_INSTALL', 'ON_USE'];
    for (const p of mp.plugins || []) {
      if (!p.name) errs.push('marketplace.json: a plugin entry has no "name"');
      if (!p.source?.source || !p.source?.path) errs.push(`marketplace.json: ${p.name}: source must be {source, path}`);
      if (p.policy?.installation && !INSTALL.includes(p.policy.installation)) errs.push(`marketplace.json: ${p.name}: policy.installation must be one of ${INSTALL.join('/')}`);
      if (p.policy?.authentication && !AUTH.includes(p.policy.authentication)) errs.push(`marketplace.json: ${p.name}: policy.authentication must be one of ${AUTH.join('/')}`);
    }
  }
}

// 2. Plugin manifest.
const manPath = join(PLUGIN, '.codex-plugin', 'plugin.json');
let man;
if (!existsSync(manPath)) errs.push(`missing ${manPath}`);
else {
  try { man = readJson(manPath); } catch (e) { errs.push(`plugin.json is not valid JSON: ${e.message}`); }
  if (man) {
    for (const k of ['name', 'version', 'description']) if (!man[k]) errs.push(`plugin.json: missing "${k}"`);
    const skillsRel = (man.skills || './skills/').replace(/^\.\//, '').replace(/\/$/, '');
    if (!existsSync(join(PLUGIN, skillsRel))) errs.push(`plugin.json: skills dir "${man.skills}" not found in the bundle`);
    // version must match the kit version (build-codex-plugin keeps them aligned)
    try {
      const kitV = readJson(join(ROOT, '.claude-plugin', 'plugin.json')).version;
      if (man.version !== kitV) errs.push(`plugin.json version (${man.version}) != kit version (${kitV}) — run build-codex-plugin.mjs`);
    } catch { /* ignore */ }
  }
}

// 3. Portable Agent Plugins 1.0.0 manifest (root plugin.json), for non-Codex clients.
const portPath = join(PLUGIN, 'plugin.json');
if (!existsSync(portPath)) errs.push(`missing portable ${portPath} — run build-codex-plugin.mjs`);
else {
  let pm; try { pm = readJson(portPath); } catch (e) { errs.push(`portable plugin.json is not valid JSON: ${e.message}`); }
  if (pm) {
    if (pm.$schema !== 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json') errs.push('portable plugin.json: $schema must be the Agent Plugins 1.0.0 const URI');
    if (!pm.name || !/^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(pm.name)) errs.push(`portable plugin.json: name "${pm.name}" fails the 1.0.0 pattern`);
    if (pm.author && typeof pm.author !== 'object') errs.push('portable plugin.json: author must be an object {name,email,url}');
    for (const bad of ['skills', 'interface']) if (bad in pm) errs.push(`portable plugin.json: "${bad}" is not allowed by the closed schema — put it under extensions instead`);
  }
}

// 4. Self-contained bundle + portable skill-name rules.
const skillsDir = join(PLUGIN, 'skills');
if (existsSync(skillsDir)) {
  const refs = new Set();
  for (const name of readdirSync(skillsDir)) {
    const sp = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(sp)) continue;
    const body = readFileSync(sp, 'utf8');
    for (const m of body.matchAll(/instructions\/[A-Za-z0-9/_-]+\.md/g)) refs.add(m[0]);
    for (const m of body.matchAll(/instructions\/stacks\//g)) refs.add('instructions/stacks');
    // Agent Skills: dir name hyphen-only, and frontmatter `name` must match the dir name.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) errs.push(`skill "${name}": dir name must be lowercase hyphen-only (Agent Skills spec)`);
    const fm = body.match(/^---\n([\s\S]*?)\n---/);
    const declared = fm && fm[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    if (declared && declared !== name) errs.push(`skill "${name}": frontmatter name "${declared}" must match the directory name`);
  }
  for (const ref of refs) {
    if (!existsSync(join(PLUGIN, ref))) errs.push(`bundle is not self-contained: a skill references "${ref}" but it's not in the plugin — run build-codex-plugin.mjs`);
  }
}

// 5. The bundle is a copy, so "present" is not the same as "current". Check 4 proves
// every referenced instructions file exists; this proves the copies still match their
// canonical sources — and that the generated portable manifest still matches the Codex
// manifest it is derived from — so editing a source (or the manifest) without rebuilding
// is a caught mistake rather than a silently shipped stale file.
// A name collision makes the "losing" copy read as drift, so the per-file drift/orphan
// lines would be derivative noise — lead with the cause and suppress them when a
// collision is present. Manifest drift is orthogonal, so it is always checked.
const collisions = collidingSkillNames(ROOT);
for (const name of collisions) errs.push(`skill "${name}" exists in more than one skill source — names must be unique across skills/ and codex/skills/`);
if (!collisions.length) {
  const { missing, drifted } = syncedFileDrift(ROOT);
  for (const label of missing) errs.push(`bundle is missing "${label}" — run build-codex-plugin.mjs`);
  for (const label of drifted) errs.push(`bundle copy of "${label}" differs from the source — run build-codex-plugin.mjs`);
  for (const orphan of orphanedBundleFiles(ROOT)) errs.push(`bundle still carries "${orphan}", which no source produces — run build-codex-plugin.mjs`);
}
const manifestDrift = portableManifestDrift(ROOT);
if (manifestDrift) errs.push(`${manifestDrift} — run build-codex-plugin.mjs`);

if (errs.length) {
  console.error('✗ Codex plugin validation failed:');
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ Codex plugin bundle is valid (marketplace + manifest + self-contained, in-sync instructions).');
