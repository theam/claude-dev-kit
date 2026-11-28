/*
 * replay-story runs work-story on a past ticket and must never ship it. Two sides
 * carry that contract: replay-story (skill + command) asks for a replay run, and the
 * work-story orchestrators (coding-agent on Claude Code, the portable playbook
 * elsewhere) honor it by stopping after self-review. A side that drops the phrase
 * drops the rule, so pin it in every file. Whitespace is collapsed because the
 * portable playbook wraps its lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8').toLowerCase().replace(/\s+/g, ' ');

const GROUPS = [
  {
    name: 'replay contract (requester and both orchestrators)',
    files: [
      'skills/replay-story/SKILL.md',
      'commands/replay-story.md',
      'agents/coding-agent.md',
      'codex/skills/work-story/SKILL.md',
    ],
    phrases: [
      'replay-story',
      'after self-review',
      'no `create-pr`, no `issue-update`, no `follow-ups`, no push',
      'never pre-approved',
      'against the base commit',
    ],
  },
  {
    name: 'replay-story skill and command',
    files: ['skills/replay-story/SKILL.md', 'commands/replay-story.md'],
    phrases: ['git worktree add --detach', 'never push, open a pr', 'blind', 'untrusted data'],
  },
  {
    // On Claude Code, pr-fixer resolves a PR from the current branch and pushes to it.
    name: 'replay run on Claude Code',
    files: ['agents/coding-agent.md'],
    phrases: ["don't delegate to `pr-fixer`", 'give every subagent you delegate to the worktree path'],
  },
];

for (const group of GROUPS) {
  test(`${group.name}: guardrail phrases are in every file`, () => {
    for (const rel of group.files) {
      const text = read(rel);
      for (const phrase of group.phrases) {
        assert.ok(text.includes(phrase), `${rel} is missing the guardrail phrase ${JSON.stringify(phrase)}`);
      }
    }
  });
}
