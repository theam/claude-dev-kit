/*
 * Each plan-* trio is a skill, a command, and an agent. The playbook lives in the
 * skill. The command and the agent still have to carry the same guardrail phrases,
 * or a host that loads only one of the files drops the rule.
 *
 * Byte-identical text is the wrong check for this prose. The phrases already differ
 * in capitalization, and the FigJam caveat is not one shared sentence. What fails
 * the build is a file that no longer contains the phrase. Phrases are pinned only
 * when they already occur in all three files of that trio.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const TRIOS = [
  {
    name: 'plan-definition',
    files: [
      'skills/plan-definition/SKILL.md',
      'commands/plan-definition.md',
      'agents/plan-definer.md',
    ],
    // "approval gate" is "Approval gate" in the skill. "FigJam" / "/board/" /
    // "board's content" are the caveat tokens all three files actually share.
    phrases: [
      'facilitate, never decide',
      'no tickets',
      'approval gate',
      'figjam',
      '/board/',
      "board's content",
      'navigable artifact',
    ],
  },
  {
    name: 'plan-backlog',
    files: [
      'skills/plan-backlog/SKILL.md',
      'commands/plan-backlog.md',
      'agents/backlog-planner.md',
    ],
    // The definition-only phrases (facilitate / never decide, no tickets, FigJam)
    // are not in this trio. The trigger phrases are the ones a dropped rule
    // would lose: the kit ships no workflow runner, and it does not scaffold one.
    phrases: [
      'approval gate',
      'navigable artifact',
      'ships no workflow runner',
      'no `/builder` comments, no `codex-builder.yml`',
    ],
  },
];

for (const trio of TRIOS) {
  test(`${trio.name}: shared guardrail phrases are in the skill, the command, and the agent`, () => {
    const bodies = trio.files.map((rel) => ({
      rel,
      text: readFileSync(join(ROOT, rel), 'utf8').toLowerCase(),
    }));
    for (const phrase of trio.phrases) {
      for (const { rel, text } of bodies) {
        assert.ok(
          text.includes(phrase),
          `${rel} is missing the shared guardrail phrase ${JSON.stringify(phrase)}`,
        );
      }
    }
  });
}
