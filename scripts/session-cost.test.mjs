/*
 * Tests for the PR Cost section: the shared usage parser (also used by telemetry), the
 * price table, the estimate, the rendered section, and the CLI. Zero-dep (node:test).
 *
 * Fixtures are synthetic lines in the shapes Claude Code and Codex write — usage, model,
 * timestamps and session links only, no conversation content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, utimesSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  claudeUsage, codexUsage, usageTotals, sessionUsage, findClaudeSession, findCodexSession,
  otherClaudeSessions, otherCodexSessions, claudeProjectSlug,
} from './lib/session-usage.mjs';
import {
  loadPriceTable, priceFor, variantOfFor, estimate, partiality, formatCostSection, formatCount, displayModel, OTHER_MODELS,
} from './lib/pr-cost.mjs';
import { FILE_SOURCES } from './lib/bundle-sources.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TABLE = loadPriceTable();

/* Claude Code: one line per content block, each repeating its message's usage. */
const claudeLine = ({ id, model = 'claude-opus-5-5', ts = '2026-11-01T10:00:00.000Z', usage, branch }) =>
  JSON.stringify({
    type: 'assistant', timestamp: ts, ...(branch ? { gitBranch: branch } : {}),
    message: { id, model, usage },
  });
const u = (input, output, read = 0, write = 0, extra = {}) => ({
  input_tokens: input, output_tokens: output, cache_read_input_tokens: read, cache_creation_input_tokens: write, ...extra,
});

/* Codex: cumulative token_count events after a turn_context naming the model. */
const codexMeta = (meta) => JSON.stringify({ timestamp: '2026-11-01T10:00:00.000Z', type: 'session_meta', payload: meta });
const codexTurn = (model, ts = '2026-11-01T10:00:01.000Z') => JSON.stringify({ timestamp: ts, type: 'turn_context', payload: { model } });
const codexCount = (total, last = {}, ts = '2026-11-01T10:00:02.000Z') =>
  JSON.stringify({ timestamp: ts, type: 'event_msg', payload: { type: 'token_count', info: { total_token_usage: total, last_token_usage: last } } });

function tmp() { return mkdtempSync(join(tmpdir(), 'dev-kit-cost-')); }

/* ------------------------------------------------------------ Claude parser ---- */

test('Claude: a message repeated across content-block lines is counted once', () => {
  const lines = [
    claudeLine({ id: 'm1', usage: u(10, 100, 1000, 50) }),
    claudeLine({ id: 'm1', usage: u(10, 100, 1000, 50) }),
    claudeLine({ id: 'm1', usage: u(10, 100, 1000, 50) }),
    claudeLine({ id: 'm2', usage: u(5, 20, 2000, 0) }),
  ];
  const t = usageTotals(claudeUsage(lines));
  assert.deepEqual(t, { input: 15, output: 120, cacheRead: 3000, cacheWrite: 50, cacheWrite1h: 0 });
});

test('Claude: per-model split; 1-hour writes split out; synthetic, zero and malformed lines skipped', () => {
  const lines = [
    claudeLine({ id: 'a', usage: u(1, 10, 0, 300, { cache_creation: { ephemeral_5m_input_tokens: 100, ephemeral_1h_input_tokens: 200 } }) }),
    claudeLine({ id: 'b', model: 'claude-haiku-5-5', usage: u(2, 20) }),
    claudeLine({ id: 'c', model: '<synthetic>', usage: u(0, 0) }),
    claudeLine({ id: 'd', usage: u(0, 0) }),
    '{not json',
    JSON.stringify({ type: 'user', message: { content: 'x' } }),
  ];
  const usage = claudeUsage(lines);
  assert.deepEqual(Object.keys(usage.models).sort(), ['claude-haiku-5-5', 'claude-opus-5-5']);
  assert.equal(usage.models['claude-opus-5-5'].cacheWrite, 100);
  assert.equal(usage.models['claude-opus-5-5'].cacheWrite1h, 200);
});

test('Claude: subagent files are included, and a message in two files counts once', () => {
  const main = [claudeLine({ id: 'm1', ts: '2026-11-01T10:00:00Z', usage: u(1, 1) })];
  const sub = [
    claudeLine({ id: 's1', ts: '2026-10-01T00:00:00Z', usage: u(2, 2) }),
    claudeLine({ id: 'm1', usage: u(1, 1) }), // an inline sidechain copy of a main message
  ];
  const usage = claudeUsage([main, sub]);
  assert.equal(usageTotals(usage).input, 3);
  assert.equal(usage.firstTs, Date.parse('2026-11-01T10:00:00Z'), 'the time span comes from the main transcript');
});

test('Claude: fast-mode and long-prompt messages are tagged as variants', () => {
  const lines = [
    claudeLine({ id: 'f', usage: u(10, 10, 0, 0, { speed: 'fast' }) }),
    claudeLine({ id: 'h1', model: 'claude-haiku-5-5', usage: u(150000, 10) }),
    claudeLine({ id: 'h2', model: 'claude-haiku-5-5', usage: u(1000, 10) }),
  ];
  const usage = claudeUsage(lines, { variantOf: variantOfFor(TABLE) });
  assert.equal(usage.models['claude-opus-5-5'].variants.fast.input, 10);
  assert.equal(usage.models['claude-haiku-5-5'].variants.long_prompt.input, 150000);
  assert.equal(usage.models['claude-haiku-5-5'].input, 151000);
});

/* ------------------------------------------------------------- Codex parser ---- */

test('Codex: cumulative totals are differenced, attributed per model, cached split out, reasoning not added twice', () => {
  const lines = [
    codexTurn('gpt-6.2-sol'),
    codexCount({ input_tokens: 1000, cached_input_tokens: 600, output_tokens: 50, reasoning_output_tokens: 10 }),
    codexCount({ input_tokens: 3000, cached_input_tokens: 2000, output_tokens: 80, reasoning_output_tokens: 20 }),
    codexCount({ input_tokens: 3000, cached_input_tokens: 2000, output_tokens: 80, reasoning_output_tokens: 20 }), // repeated event
    codexTurn('gpt-6.1-terra'),
    codexCount({ input_tokens: 3500, cached_input_tokens: 2100, output_tokens: 90, reasoning_output_tokens: 20 }),
  ];
  const usage = codexUsage(lines);
  // output_tokens already includes reasoning_output_tokens (total_tokens = input + output)
  assert.deepEqual(usageTotals(usage), { input: 1400, output: 90, cacheRead: 2100, cacheWrite: 0, cacheWrite1h: 0 });
  assert.equal(usage.models['gpt-6.2-sol'].input, 1000);
  assert.equal(usage.models['gpt-6.1-terra'].input, 400);
  assert.equal(usage.models['gpt-6.1-terra'].output, 10);
});

test('Codex: a turn whose prompt is over the long-context threshold is tagged', () => {
  const usage = codexUsage([
    codexTurn('gpt-6.2-sol'),
    codexCount({ input_tokens: 300_000, cached_input_tokens: 0, output_tokens: 10 }, { input_tokens: 300_000 }),
    codexCount({ input_tokens: 301_000, cached_input_tokens: 0, output_tokens: 20 }, { input_tokens: 1_000 }),
  ], { variantOf: variantOfFor(TABLE) });
  assert.equal(usage.models['gpt-6.2-sol'].variants.long_prompt.input, 300_000);
  assert.equal(usage.models['gpt-6.2-sol'].input, 301_000);
  // 300K at $4 + 10 out at $15 (long), then 1K at $2 + 10 out at $10 (short)
  const want = (300_000 * 4 + 10 * 15 + 1_000 * 2 + 10 * 10) / 1e6;
  assert.ok(Math.abs(estimate(usage, TABLE).total - want) < 1e-12);
});

test('Codex: non-numeric counts are read as zero', () => {
  const usage = codexUsage([codexTurn('gpt-6.2-sol'), codexCount({ input_tokens: '12', cached_input_tokens: null, output_tokens: 5 })]);
  assert.deepEqual(usageTotals(usage), { input: 0, output: 5, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 });
});

test('Codex: a session is found with its subagent threads, and unrelated rollouts are left out', () => {
  const home = tmp();
  try {
    const repo = join(home, 'repo');
    const day = join(home, 'sessions', '2026', '11', '01');
    mkdirSync(day, { recursive: true });
    mkdirSync(repo);
    const w = (name, lines) => writeFileSync(join(day, name), `${lines.join('\n')}\n`);
    w('rollout-a-root.jsonl', [codexMeta({ id: 'root', session_id: 'root', cwd: repo, git: { branch: 'feat/x' } }), codexTurn('gpt-6.2-sol'), codexCount({ input_tokens: 100, cached_input_tokens: 0, output_tokens: 10 })]);
    w('rollout-b-child.jsonl', [codexMeta({ id: 'child', session_id: 'root', parent_thread_id: 'root', cwd: repo }), codexTurn('gpt-6.2-sol'), codexCount({ input_tokens: 50, cached_input_tokens: 0, output_tokens: 5 })]);
    w('rollout-c-other.jsonl', [codexMeta({ id: 'other', session_id: 'other', cwd: join(home, 'elsewhere') }), codexTurn('gpt-6.2-sol'), codexCount({ input_tokens: 9999, cached_input_tokens: 0, output_tokens: 9 })]);
    w('rollout-d-same-branch.jsonl', [codexMeta({ id: 'prior', session_id: 'prior', cwd: repo, git: { branch: 'feat/x' } })]);
    const sessionsDir = join(home, 'sessions');
    const s = findCodexSession({ threadId: 'child', roots: [repo], sessionsDir });
    assert.ok(s, 'session not found');
    assert.equal(findCodexSession({ cwd: repo, roots: [repo], sessionsDir })?.rootId !== undefined, true, 'no session found by cwd');
    assert.equal(s.rootId, 'root');
    assert.equal(s.subagents.length, 1);
    assert.equal(usageTotals(sessionUsage(s, 'codex')).input, 150);
    assert.equal(otherCodexSessions({ roots: [repo], branch: 'feat/x', excludeRootId: 'root', sessionsDir }), 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

/* ----------------------------------------------------------- Claude discovery ---- */

test('Codex: without a thread id, a session in this worktree wins over a newer one in a sibling worktree', () => {
  const home = tmp();
  try {
    const here = join(home, 'repo');
    const sibling = join(home, 'repo-other-story');
    const day = join(home, 'sessions', '2026', '11', '01');
    mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'rollout-1-here.jsonl'), `${codexMeta({ id: 'here', session_id: 'here', cwd: here })}\n`);
    const later = join(day, 'rollout-2-sibling.jsonl');
    writeFileSync(later, `${codexMeta({ id: 'sib', session_id: 'sib', cwd: sibling })}\n`);
    const future = new Date(Date.now() + 60_000);
    utimesSync(later, future, future); // the sibling's rollout is the most recent one
    const s = findCodexSession({ cwd: here, roots: [here, sibling], sessionsDir: join(home, 'sessions') });
    assert.equal(s?.rootId, 'here');
    // A worktree nested inside this checkout is another story too.
    const nested = join(here, '.claude', 'worktrees', 'other');
    writeFileSync(later, `${codexMeta({ id: 'sib', session_id: 'sib', cwd: nested })}\n`);
    utimesSync(later, future, future);
    assert.equal(findCodexSession({ cwd: here, roots: [here, nested], sessionsDir: join(home, 'sessions') })?.rootId, 'here');
  } finally { rmSync(home, { recursive: true, force: true }); }
});

test('Claude: the session is found by id with its subagents; other sessions on the branch are counted', () => {
  const home = tmp();
  try {
    const cwd = join(home, 'work', 'repo');
    const proj = join(home, 'projects', claudeProjectSlug(cwd));
    mkdirSync(join(proj, 'sess1', 'subagents', 'nested'), { recursive: true });
    writeFileSync(join(proj, 'sess1.jsonl'), claudeLine({ id: 'm', usage: u(1, 1), branch: 'feat/x' }));
    writeFileSync(join(proj, 'sess1', 'subagents', 'agent-a.jsonl'), claudeLine({ id: 's', usage: u(2, 2), branch: 'feat/x' }));
    writeFileSync(join(proj, 'sess1', 'subagents', 'nested', 'agent-b.jsonl'), claudeLine({ id: 't', usage: u(3, 3) }));
    writeFileSync(join(proj, 'sess1', 'subagents', 'agent-a.meta.json'), '{}');
    writeFileSync(join(proj, 'sess0.jsonl'), claudeLine({ id: 'p', usage: u(9, 9), branch: 'feat/x' }));
    writeFileSync(join(proj, 'sess2.jsonl'), claudeLine({ id: 'q', usage: u(9, 9), branch: 'main' }));
    const projectsDir = join(home, 'projects');
    const s = findClaudeSession({ sessionId: 'sess1', cwd, projectsDir });
    assert.equal(s.subagents.length, 2);
    assert.equal(usageTotals(sessionUsage(s, 'claude-code')).input, 6);
    // sess0 only: this session's own subagent transcripts are not "other sessions"
    assert.equal(otherClaudeSessions({ dirs: [cwd], branch: 'feat/x', exclude: s.main, projectsDir }), 1);
  } finally { rmSync(home, { recursive: true, force: true }); }
});

/* -------------------------------------------------------- price table + estimate ---- */

test('the price table is one dated file with numeric rates', () => {
  assert.match(TABLE.as_of, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(TABLE.sources) && TABLE.sources.length);
  for (const [id, e] of Object.entries(TABLE.models)) {
    for (const rates of [e, e.fast, e.long_prompt].filter(Boolean)) {
      for (const k of ['input', 'output', 'cache_read']) assert.equal(typeof rates[k], 'number', `${id}.${k}`);
    }
    if (e.long_prompt) assert.equal(typeof e.long_prompt.above, 'number', `${id}.long_prompt.above`);
  }
});

test('priceFor matches the id, a dated snapshot, or a bracketed variant — nothing looser', () => {
  assert.equal(priceFor('claude-opus-5-5', TABLE).input, 4);
  assert.equal(priceFor('claude-opus-4-5-20251101', TABLE).input, 5);
  assert.equal(priceFor('claude-opus-5-5[1m]', TABLE).input, 4);
  assert.equal(priceFor('claude-fable-5-1', TABLE).cache_read, 0.25, 'claude-fable-5 must not price claude-fable-5-1');
  assert.equal(priceFor('claude-fable-5-9', TABLE), undefined);
  assert.equal(priceFor('anthropic.claude-opus-5-5', TABLE), undefined, 'a cloud-platform id has its own prices');
  assert.equal(priceFor('codex-auto-review', TABLE), undefined);
});

test('estimate: exact arithmetic, variants at their own rates, unknown models left unpriced', () => {
  const usage = claudeUsage([
    claudeLine({ id: 'a', usage: u(1_000_000, 100_000, 2_000_000, 400_000) }),
    claudeLine({ id: 'b', usage: u(1_000_000, 0, 0, 0, { speed: 'fast' }) }),
    claudeLine({ id: 'c', model: 'mystery-model', usage: u(5, 5) }),
  ], { variantOf: variantOfFor(TABLE) });
  const est = estimate(usage, TABLE);
  // base: 1M*$4 + 0.1M*$20 + 2M*$0.20 + 0.4M*$5 = 4 + 2 + 0.4 + 2 = 8.4; fast: 1M*$8 = 8
  assert.ok(Math.abs(est.perModel['claude-opus-5-5'] - 16.4) < 1e-9, String(est.perModel['claude-opus-5-5']));
  assert.deepEqual(est.unpriced, ['mystery-model']);
  assert.ok(Math.abs(est.total - 16.4) < 1e-9);
});

test('estimate: fast mode on a model with no fast rate leaves the whole model unpriced', () => {
  const usage = claudeUsage([
    claudeLine({ id: 'a', model: 'claude-opus-4-7', usage: u(100, 10) }),
    claudeLine({ id: 'b', model: 'claude-opus-4-7', usage: u(100, 10, 0, 0, { speed: 'fast' }) }),
  ], { variantOf: variantOfFor(TABLE) });
  const est = estimate(usage, TABLE);
  assert.deepEqual(est.unpriced, ['claude-opus-4-7']);
  assert.equal(est.total, 0);
});

test('estimate: a token class with no listed rate makes the model unpriced, not part-priced', () => {
  const usage = codexUsage([codexTurn('gpt-6.2-sol'), codexCount({ input_tokens: 100, cached_input_tokens: 0, output_tokens: 1, cache_write_input_tokens: 50 })]);
  assert.deepEqual(estimate(usage, TABLE).unpriced, ['gpt-6.2-sol']);
});

/* ---------------------------------------------------------- partial + section ---- */

test('partiality: earlier commits or another session on the branch make it partial', () => {
  const start = Date.parse('2026-11-01T10:00:00Z');
  assert.equal(partiality({ sessionStart: start, commitTimes: [start / 1000 + 60] }).partial, false);
  assert.equal(partiality({ sessionStart: start, commitTimes: [start / 1000 - 60] }).earlierCommits, true);
  assert.equal(partiality({ sessionStart: start, otherSessions: 2 }).partial, true);
});

test('section: full mode prices, tokens mode does not, off prints nothing', () => {
  const usage = claudeUsage([claudeLine({ id: 'a', usage: u(1_500_000, 85_300, 14_300_000, 1_100_000) })]);
  const full = formatCostSection({ usage, mode: 'full', table: TABLE, subagents: 4 });
  assert.match(full, /^### Cost\n/);
  assert.match(full, /≈ \$\d+\.\d{2} estimated API-equivalent cost, at list prices as of \d{4}-\d{2}-\d{2}/);
  assert.match(full, /- claude-opus-5-5: 1\.5M input · 85\.3K output · 14\.3M cache read · 1\.1M cache write/);
  assert.match(full, /this session and 4 subagents/);
  const tokens = formatCostSection({ usage, mode: 'tokens', table: TABLE });
  assert.doesNotMatch(tokens, /\$/);
  assert.match(tokens, /claude-opus-5-5: /);
  assert.equal(formatCostSection({ usage, mode: 'off', table: TABLE }), '');
});

test('section: unknown models show tokens only and the partial note explains why', () => {
  const usage = claudeUsage([claudeLine({ id: 'a', model: 'mystery-model', usage: u(10, 10) })]);
  const out = formatCostSection({
    usage, mode: 'full', table: TABLE,
    partial: { partial: true, earlierCommits: true, otherSessions: 1 },
  });
  assert.match(out, /No cost estimate: the kit's price table/);
  assert.doesNotMatch(out, /\$/);
  assert.match(out, /- other models \(not in the kit's price table\): 10 input · 10 output — tokens only/);
  assert.doesNotMatch(out, /mystery-model/);
  assert.match(out, /Partial: 1 other local session also worked this branch, and the branch has commits from before this session/);
});

test('formatting helpers', () => {
  assert.equal(formatCount(999), '999');
  assert.equal(formatCount(1000), '1K');
  assert.equal(formatCount(85_300), '85.3K');
  assert.equal(formatCount(2_000_000), '2M');
});

test('section: only model ids the price table knows are printed; anything else is a generic row', () => {
  // A host lets people set any model string; none of these may reach a public PR body.
  const leaky = ['/home/someone/models/private-ft', 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/x',
    '@someone', 'acme-prod-gpt', 'claude-opus-5-5[/home/someone]', 'claude-opus-5-5-<b>'];
  assert.equal(displayModel('claude-opus-5-5[1m]', TABLE), 'claude-opus-5-5[1m]');
  assert.equal(displayModel('claude-opus-4-5-20251101', TABLE), 'claude-opus-4-5-20251101');
  for (const id of leaky) assert.equal(displayModel(id, TABLE), OTHER_MODELS, id);
  const usage = claudeUsage(leaky.map((model, i) => claudeLine({ id: `m${i}`, model, usage: u(1, 1) })));
  for (const mode of ['full', 'tokens']) {
    const out = formatCostSection({ usage, mode, table: TABLE });
    assert.match(out, /- other models \(not in the kit's price table\): 6 input · 6 output/);
    for (const bad of ['/home', 'arn:', '@someone', 'acme', '123456789012', '<b>']) assert.ok(!out.includes(bad), `${mode}: ${bad} leaked`);
  }
});

/* ---------------------------------------------------------------------- CLI ---- */

function cli(args, env = {}) {
  return spawnSync(process.execPath, [join(ROOT, 'scripts', 'session-cost.mjs'), ...args], {
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: env.HOME || tmpdir(), ...env },
  });
}

test('CLI: prints the section for a transcript, honours cost: off, never fails', () => {
  const dir = tmp();
  try {
    const t = join(dir, 'sess.jsonl');
    writeFileSync(t, `${claudeLine({ id: 'a', usage: u(100, 10) })}\n`);
    const r = cli(['--agent', 'claude-code', '--cwd', dir, '--transcript', t], { HOME: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /### Cost/);
    assert.match(r.stdout, /claude-opus-5-5: 100 input · 10 output/);
    assert.doesNotMatch(r.stdout, new RegExp(dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'a local path reached the output');

    mkdirSync(join(dir, '.claude'));
    writeFileSync(join(dir, '.claude', 'dev-kit.json'), JSON.stringify({ cost: 'off' }));
    const off = cli(['--agent', 'claude-code', '--cwd', dir, '--transcript', t], { HOME: dir });
    assert.equal(off.status, 0);
    assert.equal(off.stdout, '');

    const none = cli(['--agent', 'claude-code', '--cwd', join(dir, 'nowhere'), '--mode', 'full'], { HOME: dir, CLAUDE_CONFIG_DIR: join(dir, 'none') });
    assert.equal(none.status, 0);
    assert.match(none.stdout, /Not available/);

    // A set-but-unknown value fails closed: likely an opt-out, so print nothing.
    writeFileSync(join(dir, '.claude', 'dev-kit.json'), JSON.stringify({ cost: 'none' }));
    const typo = cli(['--agent', 'claude-code', '--cwd', dir, '--transcript', t], { HOME: dir });
    assert.equal(typo.status, 0);
    assert.equal(typo.stdout, '');
    assert.match(typo.stderr, /unknown cost mode/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('CLI: commits on the branch from before the session mark the result partial', () => {
  const dir = tmp();
  try {
    const g = (...a) => {
      const r = spawnSync('git', ['-C', dir, ...a], {
        encoding: 'utf8',
        env: { PATH: process.env.PATH, HOME: dir, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.invalid',
          GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.invalid', GIT_AUTHOR_DATE: '2026-10-01T00:00:00Z',
          GIT_COMMITTER_DATE: '2026-10-01T00:00:00Z' },
      });
      assert.equal(r.status, 0, r.stderr);
    };
    g('init', '-q', '-b', 'main');
    g('commit', '-q', '--allow-empty', '-m', 'base');
    g('checkout', '-q', '-b', 'feat/x');
    g('commit', '-q', '--allow-empty', '-m', 'earlier work'); // authored 2026-10-01, before the session
    const t = join(dir, 'sess.jsonl');
    writeFileSync(t, `${claudeLine({ id: 'a', ts: '2026-11-01T10:00:00Z', usage: u(1, 1) })}\n`);
    const r = cli(['--agent', 'claude-code', '--cwd', dir, '--base', 'main', '--transcript', t], { HOME: dir });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Partial: the branch has commits from before this session/);
    const fresh = cli(['--agent', 'claude-code', '--cwd', dir, '--base', 'feat/x', '--transcript', t], { HOME: dir });
    assert.doesNotMatch(fresh.stdout, /Partial/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ------------------------------------------------------------------ bundling ---- */

test('every file a bundled script imports is bundled too', () => {
  const bundled = new Set(FILE_SOURCES.map((f) => f.src.replaceAll('\\', '/')));
  for (const src of bundled) {
    if (!src.endsWith('.mjs')) continue;
    const body = readFileSync(join(ROOT, src), 'utf8');
    // Relative imports, plus data files a lib loads from its own directory. (A config such
    // as the consuming repo's .claude/dev-kit.json is read from that repo, not the kit.)
    const re = src.includes('/lib/') ? /from '(\.[^']+)'|'([\w-]+\.json)'/g : /from '(\.[^']+)'/g;
    for (const m of body.matchAll(re)) {
      const rel = join(dirname(src), m[1] || m[2]);
      assert.ok(bundled.has(rel.replaceAll('\\', '/')), `${src} needs ${rel}, which is not in FILE_SOURCES`);
    }
  }
});

/* ---------------------------------------------------------------- telemetry ---- */

test('telemetry sends each Claude API message once, through the shared parser', async () => {
  // A real run of the client against a local stand-in relay: HOME is a temp dir, so the
  // consent/state files it writes never touch the developer's own.
  const home = tmp();
  const bodies = [];
  const server = createServer((req, res) => {
    let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => { bodies.push(JSON.parse(b)); res.end('{}'); });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const t = join(home, 'sess.jsonl');
    writeFileSync(t, [
      JSON.stringify({ type: 'user', message: { content: 'run work-story' } }), // a kit marker, so the session counts
      claudeLine({ id: 'm1', usage: u(10, 100, 1000, 50) }),
      claudeLine({ id: 'm1', usage: u(10, 100, 1000, 50) }),
      claudeLine({ id: 'm2', usage: u(5, 20) }),
    ].join('\n'));
    const child = spawn(process.execPath, [join(ROOT, 'scripts', 'telemetry.mjs')], {
      env: {
        PATH: process.env.PATH, HOME: home, DEVKIT_TELEMETRY_ENABLED: 'true',
        DEVKIT_TELEMETRY_RELAY_URL: `http://127.0.0.1:${server.address().port}`,
      },
    });
    child.stdin.end(JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 's-1', transcript_path: t, cwd: home }));
    const code = await new Promise((r) => child.on('exit', r));
    assert.equal(code, 0);
    assert.equal(bodies.length, 1, 'no event reached the relay');
    const p = bodies[0].properties;
    assert.equal(p.tokens_input, 15);
    assert.equal(p.tokens_output, 120);
    assert.equal(p.tokens_cache_read, 1000);
    assert.equal(p.tokens_cache_creation, 50);
  } finally {
    server.close();
    rmSync(home, { recursive: true, force: true });
  }
});
