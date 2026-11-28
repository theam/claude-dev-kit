/*
 * The PR size budget (#114) spans the plan gate and create-pr. Both orchestrators
 * (coding-agent on Claude Code, the portable work-story skill) must carry the
 * plan-gate rule, create-pr owns the counting rules, and setup documents the key
 * without writing it by default. Phrase presence, not byte-identical prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

test('pr size budget: both orchestrators carry the plan-gate rule', () => {
  const phrases = ['**size**', 'pr.maxchangedlines', 'before any code', 'stacked prs', 'separate stories', 'github only', 'part-<k>', 'pre-approved plan keeps one pr', 'listing every pr'];
  for (const rel of ['agents/coding-agent.md', 'codex/skills/work-story/SKILL.md']) {
    const text = read(rel).toLowerCase();
    for (const phrase of phrases) {
      assert.ok(text.includes(phrase), `${rel} is missing ${JSON.stringify(phrase)}`);
    }
  }
});

test('pr size budget: create-pr owns the counting rules, the report, and stacked PRs', () => {
  const skill = read('skills/create-pr/SKILL.md');
  const budget = skill.slice(skill.indexOf('## Size budget'), skill.indexOf('## Pull request'));
  assert.ok(budget.startsWith('## Size budget'), 'create-pr has no Size budget section before Pull request');
  for (const re of [
    /`pr\.maxChangedLines`/,
    /\*\*default 400\*\*/,
    /git diff --numstat origin\/<base>\.\.\.HEAD` after a `git fetch`/,
    /Test files count/,
    /lockfiles/,
    /linguist-generated/,
    /snapshots/,
    /\*\*Not a gate\*\*/,
  ]) {
    assert.match(budget, re);
  }
  assert.match(skill, /branches from the previous slice's branch and is named `<story-branch>-part-<k>`/);
  assert.match(skill, /--base <previous PR's branch>/);
  assert.match(skill, /git rebase --onto origin\/<default branch> <lower-branch> <upper-branch>/);
  assert.match(skill, /only with their explicit approval push with `--force-with-lease` \(never plain `--force`\)/);
  assert.match(skill, /any force-push needs its own explicit approval/);
  assert.match(skill, /gh pr edit <n> --base <default branch>/);
  assert.match(skill, /Stacked PRs are GitHub-only for now; on the other hosts they are \*\*later\*\*/);
  assert.match(skill, /### Size\n<N> changed lines/);
  assert.match(skill, /Over budget, offer the person a split/);
});

test('pr size budget: setup documents pr.maxChangedLines and does not write it by default', () => {
  const setup = read('skills/dev-kit-setup/SKILL.md');
  const start = setup.indexOf('**Optional top-level `pr` key**');
  assert.ok(start > 0, 'setup has no pr section');
  const section = setup.slice(start, setup.indexOf('**Optional top-level `delegation` key**'));
  assert.match(section, /"maxChangedLines": 400/);
  assert.match(section, /\*\*Default 400\*\*/);
  assert.match(section, /Do not write it by default/);
  const open = setup.indexOf('```json');
  const example = setup.slice(open, setup.indexOf('```', open + 3));
  assert.equal(example.includes('"pr"'), false, 'the main example config writes a pr block');
});
