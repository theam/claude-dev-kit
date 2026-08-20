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
  assert.ok(isPrCreate('az repos pr create --source-branch feat/x --target-branch main --title X'));
  assert.ok(isPrCreate('cd repo && gh pr create --fill'));                 // after a shell separator
  assert.ok(isPrCreate('GH_TOKEN=xxx gh pr create --fill'));               // behind an env assignment
  assert.ok(isPrCreate("curl -X POST https://api.bitbucket.org/2.0/repositories/w/r/pullrequests -d @body.json"));
  assert.ok(!isPrCreate('gh pr view 12'));
  assert.ok(!isPrCreate('gh pr edit 12 --add-label ai-generated'));
  assert.ok(!isPrCreate('gh pr list'));
  assert.ok(!isPrCreate('az repos pr list'));
  assert.ok(!isPrCreate('az repos pr show --id 7'));
  assert.ok(!isPrCreate('gh pr create --help'));                           // help, not a real create
  assert.ok(!isPrCreate("grep 'gh pr create' skills/create-pr/SKILL.md")); // the phrase quoted in a read
  assert.ok(!isPrCreate('echo "next: gh pr create"'));                     // narration echoed to the shell
  assert.ok(!isPrCreate('git commit -m "wire up gh pr create detection"')); // the phrase in a commit message
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
    codexExec("grep 'gh pr create' SKILL.md"),         // greps for the phrase → not counted (command position)
    codexExec('gh pr create --fill'),
    codexOutput('output mentions gh pr create'),        // output, not a command → not counted
  ];
  assert.equal(countPrCreated(lines, 'codex'), 1);
});

test('Codex: matches the real 0.147 rollout shape (response_item → function_call → exec_command)', () => {
  // Mirrors a captured codex-cli 0.147 line: outer type "response_item", payload
  // "function_call"/"exec_command", `arguments` a JSON STRING of {cmd, workdir, …}.
  // If a future Codex format drifts from this, this test fails instead of the metric
  // silently zeroing.
  const realShape = JSON.stringify({
    timestamp: '2026-08-05T13:42:42.626Z',
    type: 'response_item',
    payload: {
      type: 'function_call',
      id: 'fc_x',
      name: 'exec_command',
      arguments: JSON.stringify({ cmd: 'gh pr create --fill', workdir: '/w', yield_time_ms: 1000, max_output_tokens: 20000 }),
      call_id: 'call_x',
    },
  });
  assert.equal(countPrCreated([realShape], 'codex'), 1);
});

test('no PR-create commands → 0; malformed lines are skipped', () => {
  assert.equal(countPrCreated([claudeBash('npm test'), 'not json', ''], 'claude-code'), 0);
  assert.equal(countPrCreated([], 'codex'), 0);
});

test('multiple PRs in one session are each counted', () => {
  const lines = [claudeBash('gh pr create --fill'), claudeBash('glab mr create -t y')];
  assert.equal(countPrCreated(lines, 'claude-code'), 2);
});

test('retries over-count by design (best-effort upper bound)', () => {
  // A failed first attempt + a successful retry counts as 2. Documented in TELEMETRY.md;
  // acceptable for a coarse anonymous aggregate.
  const lines = [claudeBash('gh pr create --fill'), claudeBash('gh pr create --fill')];
  assert.equal(countPrCreated(lines, 'claude-code'), 2);
});
