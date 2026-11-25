/*
 * The video-evidence contract is shared by the skill, the agent, the command, and
 * the portable playbook. A host that loads only one of them must still know the
 * step exists, where its setting lives, and that it never blocks a PR.
 * Phrase presence, not byte-identical prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const CALLERS = [
  'skills/video-evidence/SKILL.md',
  'agents/coding-agent.md',
  'commands/work-story.md',
  'codex/skills/work-story/SKILL.md',
];

test('video-evidence: the skill and every caller name the step and its setting', () => {
  for (const rel of CALLERS) {
    const text = read(rel);
    assert.ok(text.includes('video-evidence'), `${rel} is missing "video-evidence"`);
    assert.ok(text.includes('evidence.video'), `${rel} is missing "evidence.video"`);
  }
});

test('video-evidence: the agent loads the skill', () => {
  const agent = read('agents/coding-agent.md');
  const frontmatter = agent.match(/^---\n([\s\S]*?)\n---/)[1];
  assert.match(frontmatter, /^\s+- video-evidence$/m);
});

test('video-evidence: the skill keeps its guardrails', () => {
  const skill = read('skills/video-evidence/SKILL.md').toLowerCase();
  for (const phrase of [
    'never a gate',
    'never a gif',
    'never claim an attachment',
    'never edit the committed tests',
    'never commit video files',
    '`ask`',
    '`always`',
    '`never`',
    'non-interactive',
    'libx264',
  ]) {
    assert.ok(skill.includes(phrase), `video-evidence skill is missing ${JSON.stringify(phrase)}`);
  }
});

test('video-evidence: create-pr carries the Video line and commits the setting on its own', () => {
  const createPr = read('skills/create-pr/SKILL.md');
  assert.match(createPr, /^- Video: /m);
  assert.match(createPr, /chore: <TICKET-KEY> set evidence\.video/);
});

test('video-evidence: the attached line is reachable after the hand-off', () => {
  const skill = read('skills/video-evidence/SKILL.md');
  assert.match(skill, /update the `Video:` line in the PR body to `attached`/);
});

test('video-evidence: setup documents the key and does not default it', () => {
  const setup = read('skills/dev-kit-setup/SKILL.md');
  const start = setup.indexOf('Optional top-level `evidence`');
  assert.ok(start >= 0, 'setup has no evidence section');
  const section = setup.slice(start);
  assert.match(section, /evidence\.video/);
  assert.match(section, /not ask this in setup/i);
  assert.match(section, /not write it by default/i);
  const firstJson = setup.indexOf('```json');
  const example = setup.slice(firstJson, setup.indexOf('```', firstJson + 3));
  assert.equal(example.includes('"evidence"'), false);
});
