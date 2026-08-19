/*
 * Tests for the PR-create detector used by the telemetry client. Zero-dep (node:test).
 *
 * The property that matters for privacy + accuracy: the count reflects PR-create
 * commands that were *executed*, and is NOT inflated by the skill text mentioning the
 * command, by a command that reads the skill file, or by non-create PR commands.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPrCreate, countPrCreated } from './lib/pr-detect.mjs';

const claudeBash = (command) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Bash', input: { command } }] } });
const claudeText = (text) => JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text }] } });
const claudeResult = (content) => JSON.stringify({ type: 'user', message: { content: [{ type: 'tool_result', content }] } });
const codexExec = (cmd) => JSON.stringify({ payload: { type: 'function_call', name: 'exec_command', arguments: JSON.stringify({ cmd }) } });
const codexOutput = (out) => JSON.stringify({ payload: { type: 'function_call_output', name: 'exec_command', arguments: out } });

test('isPrCreate matches create commands per host, not reads/views', () => {
  assert.ok(isPrCreate('gh pr create --fill'));
  assert.ok(isPrCreate('glab mr create -t x'));
  assert.ok(isPrCreate("curl -X POST https://api.bitbucket.org/2.0/repositories/w/r/pullrequests -d @body.json"));
  assert.ok(!isPrCreate('gh pr view 12'));
  assert.ok(!isPrCreate('gh pr edit 12 --add-label ai-generated'));
  assert.ok(!isPrCreate('gh pr list'));
  assert.ok(!isPrCreate('curl https://api.bitbucket.org/2.0/repositories/w/r/pullrequests')); // GET list, no POST
  assert.ok(!isPrCreate(undefined));
});

test('Claude: counts executed Bash create commands only', () => {
  const lines = [
    claudeBash('git push -u origin feat/x'),
    claudeBash('gh pr create --title X --body Y'),
    claudeText('I will now run gh pr create to open the PR'),   // narration → not counted
    claudeResult('the create-pr skill uses `gh pr create`'),    // doc/output → not counted
    claudeBash('gh pr view 12'),                                // view → not counted
  ];
  assert.equal(countPrCreated(lines, 'claude-code'), 1);
});

test('Codex: counts exec_command create cmds, ignores reads of the skill file and outputs', () => {
  const lines = [
    codexExec("sed -n '1,240p' create-pr/SKILL.md"),  // reads a file that mentions the command → not counted
    codexExec('gh pr create --fill'),
    codexOutput('output mentions gh pr create'),        // output, not a command → not counted
  ];
  assert.equal(countPrCreated(lines, 'codex'), 1);
});

test('no PR-create commands → 0; malformed lines are skipped', () => {
  assert.equal(countPrCreated([claudeBash('npm test'), 'not json', ''], 'claude-code'), 0);
  assert.equal(countPrCreated([], 'codex'), 0);
});

test('multiple PRs in one session are each counted', () => {
  const lines = [claudeBash('gh pr create --fill'), claudeBash('glab mr create -t y')];
  assert.equal(countPrCreated(lines, 'claude-code'), 2);
});
