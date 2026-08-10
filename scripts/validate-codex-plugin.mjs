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
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

// 3. Self-contained bundle: every instructions/… referenced by a bundled skill must exist here.
const skillsDir = join(PLUGIN, 'skills');
if (existsSync(skillsDir)) {
  const refs = new Set();
  for (const name of readdirSync(skillsDir)) {
    const sp = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(sp)) continue;
    const body = readFileSync(sp, 'utf8');
    for (const m of body.matchAll(/instructions\/[A-Za-z0-9/_-]+\.md/g)) refs.add(m[0]);
    for (const m of body.matchAll(/instructions\/stacks\//g)) refs.add('instructions/stacks');
  }
  for (const ref of refs) {
    if (!existsSync(join(PLUGIN, ref))) errs.push(`bundle is not self-contained: a skill references "${ref}" but it's not in the plugin — run build-codex-plugin.mjs`);
  }
}

if (errs.length) {
  console.error('✗ Codex plugin validation failed:');
  for (const e of errs) console.error('  - ' + e);
  process.exit(1);
}
console.log('✓ Codex plugin bundle is valid (marketplace + manifest + self-contained instructions).');
