/*
 * Structural lint for the stack profiles in instructions/stacks/. Zero-dep (node:test).
 *
 * The profiles are the kit's "iteration zero" per stack — the commands a session falls
 * back to when the consuming repo is silent. A profile missing its coverage or e2e
 * section silently degrades the kit for that stack. This asserts every profile carries
 * the sections the format (instructions/stacks/README.md) documents, each with content,
 * so an incomplete or malformed profile fails CI instead of shipping.
 *
 * This is the completeness half of #50; real end-to-end per-stack validation (sample
 * repos exercising the gates) is a separate, larger step.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STACKS = join(ROOT, 'instructions', 'stacks');

// The sections documented in instructions/stacks/README.md → "Profile format".
const REQUIRED = ['Detect', 'Commands', 'Coverage', 'E2E', 'Conventions & gotchas'];

const profiles = readdirSync(STACKS).filter((f) => f.endsWith('.md') && f !== 'README.md');

test('there is at least one stack profile', () => {
  assert.ok(profiles.length > 0, 'no stack profiles found in instructions/stacks/');
});

for (const file of profiles) {
  test(`stack profile ${file} is well-formed`, () => {
    const body = readFileSync(join(STACKS, file), 'utf8');

    assert.match(body, /^# .+/m, `${file}: missing an H1 title (e.g. "# Node — stack profile")`);

    const headings = [...body.matchAll(/^## (.+)$/gm)].map((m) => ({ name: m[1].trim(), start: m.index }));
    const names = headings.map((h) => h.name);

    for (const req of REQUIRED) {
      const idx = names.indexOf(req);
      assert.ok(idx !== -1, `${file}: missing required section "## ${req}"`);
      const start = headings[idx].start;
      const end = idx + 1 < headings.length ? headings[idx + 1].start : body.length;
      const content = body.slice(start, end).replace(/^##[^\n]*\n?/, '').trim();
      assert.ok(content.length > 0, `${file}: section "## ${req}" has no content`);
    }
  });
}
