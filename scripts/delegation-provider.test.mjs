/*
 * delegate-backlog's provider contract is shared by the skill, the command, and
 * the agent. A host that loads only one of them still has to stop, read back,
 * and refuse to invent a workflow. Phrase presence, not byte-identical prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'skills/delegate-backlog/SKILL.md',
  'commands/delegate-backlog.md',
  'agents/backlog-delegator.md',
];

const PHRASES = [
  'delegation.provider',
  'github-copilot',
  'self-hosted-action',
  'workflow_dispatch',
  'untrusted',
  'read-back',
  'do not fall through',
  'ships no workflow',
  'never auto-merge',
];

test('delegate-backlog: the provider contract is in the skill, the command, and the agent', () => {
  const bodies = FILES.map((rel) => ({
    rel,
    text: readFileSync(join(ROOT, rel), 'utf8').toLowerCase(),
  }));
  for (const phrase of PHRASES) {
    for (const { rel, text } of bodies) {
      assert.ok(text.includes(phrase), `${rel} is missing ${JSON.stringify(phrase)}`);
    }
  }
});

test('delegate-backlog: setup documents the provider and does not default it', () => {
  const setup = readFileSync(join(ROOT, 'skills/dev-kit-setup/SKILL.md'), 'utf8');
  const delegation = setup.slice(setup.indexOf('Optional top-level `delegation`'));
  assert.ok(delegation.startsWith('Optional top-level `delegation`'), 'setup has no delegation section');
  assert.match(delegation, /delegation\.provider/);
  assert.match(delegation, /github-copilot/);
  assert.match(delegation, /self-hosted-action/);
  assert.match(delegation, /Do not write it by default/);
  assert.match(delegation, /Do not write a workflow file/);
  const example = setup.slice(setup.indexOf('```json'), setup.indexOf('```', setup.indexOf('```json') + 3));
  assert.equal(example.includes('"delegation"'), false);
});

test('delegate-backlog: the kit does not ship a workflow for the provider', () => {
  const workflowDir = join(ROOT, '.github', 'workflows');
  const names = readdirSync(workflowDir);
  for (const name of names) {
    const text = readFileSync(join(workflowDir, name), 'utf8');
    assert.equal(
      text.includes('delegation.provider'),
      false,
      `${name} is a shipped workflow tied to the delegation provider`,
    );
  }
  const skill = readFileSync(join(ROOT, 'skills/delegate-backlog/SKILL.md'), 'utf8');
  const lower = skill.toLowerCase();
  assert.match(lower, /you must not write it/);
  assert.match(lower, /issue number/);
  assert.match(skill, /run-name: delegate #\$\{\{ inputs\.issue \}\}/);
  assert.match(skill, /displayTitle/);
  assert.match(skill, /whose `createdAt` is after this dispatch/);
  assert.match(skill, /Both are required/);
  assert.equal(skill.includes('Do not accept "a run created after the dispatch"'), false);
  assert.equal(skill.includes('headBranch'), false);
  assert.match(skill, /contents: write/);
  assert.match(skill, /pull-requests: write/);
  assert.match(skill, /issues: read/);
  assert.match(lower, /required reviewers/);
  const setup = readFileSync(join(ROOT, 'skills/dev-kit-setup/SKILL.md'), 'utf8');
  const delegation = setup.slice(setup.indexOf('Optional top-level `delegation`'));
  assert.match(delegation, /input named `issue`/);
});
