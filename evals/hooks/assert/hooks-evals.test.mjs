/*
 * Hooks eval assertions (RFC #92 PoC) — "does a hook actually fire?" for the
 * one wired point, create-pr.body. The oracle is the PR body the session
 * handed to the stubbed `gh pr create`, plus (for .sh) a run log the handler
 * itself writes: reading a script is not running it.
 *
 * A scenario with no results is SKIPPED, never passed — run run/run.sh first.
 * Set RUN_ID to assert one run of an N-run matrix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUFFIX = process.env.RUN_ID ? `-${process.env.RUN_ID}` : '';

const MD_MARKER = 'HOOK-MARKER-MD-7F3A';
const SH_MARKER = 'HOOK-MARKER-SH-91C2';
const BADGE = 'img.shields.io/badge/';
const FOOTER = 'Generated with [Claude Code]';
// The kit's full footer. Checked separately: losing it is create-pr baseline drift,
// not a hook effect, and must not mask (or be masked by) the hook result.
const FULL_FOOTER = /human review still required\s+before merge/;

const read = (dir, name) => {
  const f = join(ROOT, dir, name);
  return existsSync(f) ? readFileSync(f, 'utf8') : null;
};

function load(scen) {
  const tag = `${scen}${SUFFIX}`;
  const raw = read('results', `${tag}.jsonl`);
  if (raw === null) return null;
  const events = raw.split('\n').filter(Boolean).flatMap((l) => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
  const said = events
    .filter((e) => e.type === 'assistant' && e.message?.content)
    .flatMap((e) => e.message.content)
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .concat(events.filter((e) => e.type === 'result').map((e) => e.result ?? ''))
    .join('\n');
  return {
    body: read('results', `${tag}.body.md`),
    said,
    hookRuns: (read('logs', `${tag}-hook-runs.log`) ?? '').split('\n').filter(Boolean).length,
  };
}

/** Every scenario must open a PR whose protected core survived. */
function assertCore(run) {
  assert.ok(run.body, 'no PR body captured — the session never reached `gh pr create`');
  assert.ok(run.body.includes(BADGE), 'AI badge missing from the PR body');
  assert.ok(run.body.includes(FOOTER), 'AI footer missing from the PR body');
  assert.match(run.body, /How it was verified/i, 'required "How it was verified" section missing');
}

function scenario(name, title, check) {
  test(`${name}: ${title}`, (t) => {
    const run = load(name);
    if (!run) return t.skip(`no results for ${name}${SUFFIX} — run run/run.sh ${name}`);
    check(run);
  });
}

scenario('h4-control', 'no hook → default body (harness sensitivity)', (run) => {
  assertCore(run);
  assert.ok(!run.body.includes('HOOK-MARKER'), 'hook content appeared with no hook configured');
  assert.equal(run.hookRuns, 0);
});

scenario('h1-md', 'opted-in .md hook → its section is appended', (run) => {
  assertCore(run);
  assert.ok(run.body.includes(MD_MARKER), '.md hook did not fire: marker absent from the PR body');
  assert.ok(
    run.body.indexOf(MD_MARKER) > run.body.search(/How it was verified/i),
    'hook content was not appended after the required sections',
  );
});

scenario('h2-sh', 'opted-in .sh hook → it runs and its stdout is appended', (run) => {
  assertCore(run);
  assert.ok(run.hookRuns >= 1, '.sh hook was never executed (run log empty)');
  assert.ok(run.body.includes(SH_MARKER), '.sh hook output absent from the PR body');
});

scenario('h3-not-opted-in', 'handler on disk but not listed → never read or run', (run) => {
  assertCore(run);
  assert.ok(!run.body.includes('HOOK-MARKER'), 'an un-opted-in handler leaked into the PR body');
  assert.equal(run.hookRuns, 0, 'an un-opted-in .sh handler was executed');
});

scenario('h5-sh-fail', 'failing .sh hook → default body, PR still opens, failure reported', (run) => {
  assertCore(run);
  assert.ok(run.hookRuns >= 1, 'failing hook was never executed, so nothing was tested');
  assert.ok(!run.body.includes('HOOK-MARKER'), 'content was invented for a failed hook');
  assert.match(run.said, /hook[^\n]*(fail|error|exit)/i, 'the hook failure was not reported');
});

test('baseline: the full kit AI footer survives in every captured body', (t) => {
  const runs = ['h4-control', 'h1-md', 'h2-sh', 'h3-not-opted-in', 'h5-sh-fail']
    .map((name) => [name, load(name)])
    .filter(([, run]) => run?.body);
  if (!runs.length) return t.skip('no results');
  const truncated = runs.filter(([, run]) => !FULL_FOOTER.test(run.body)).map(([name]) => name);
  assert.deepEqual(truncated, [], `kit footer truncated to the generic one in: ${truncated.join(', ')}`);
});
