/*
 * guided-review is a skill plus a command. A host that loads only one of them must
 * still keep the guardrails: no approving or posting without an explicit request,
 * reuse of pr-review findings, and PR text treated as untrusted. The skill must also
 * keep the sections the guide promises. Phrase presence, not byte-identical prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

const SKILL = 'skills/guided-review/SKILL.md';
const COMMAND = 'commands/guided-review.md';

test('guided-review: the skill and the command keep the shared guardrails', () => {
  for (const rel of [SKILL, COMMAND]) {
    const text = read(rel).toLowerCase();
    for (const phrase of [
      'never approves',
      'without an explicit request',
      'no verdict',
      'pr-review',
      'untrusted',
    ]) {
      assert.ok(text.includes(phrase), `${rel} is missing ${JSON.stringify(phrase)}`);
    }
  }
});

test('guided-review: the skill keeps every section of the guide', () => {
  const skill = read(SKILL).toLowerCase();
  for (const section of [
    'reading order',
    'safe to skim',
    'how it works',
    'how to check it yourself',
    'where each acceptance criterion lives',
    'questions for the author',
  ]) {
    assert.ok(skill.includes(`### ${section}`), `guided-review skill is missing the "${section}" section`);
  }
});

test('guided-review: the skill names itself and the command follows it', () => {
  const frontmatter = read(SKILL).match(/^---\n([\s\S]*?)\n---/);
  assert.ok(frontmatter, `${SKILL} has no frontmatter block`);
  assert.match(frontmatter[1], /^name: guided-review$/m);
  assert.ok(read(COMMAND).includes('`guided-review` skill'), `${COMMAND} does not name the guided-review skill`);
  assert.ok(read(COMMAND).includes('$ARGUMENTS'), `${COMMAND} does not pass $ARGUMENTS`);
});
