#!/usr/bin/env node
/*
 * session-cost — print the "### Cost" section for the PR that create-pr is opening.
 *
 * Reads the current agent session's transcript, and its subagents', from this machine
 * (Claude Code or Codex), counts tokens per model, and prices them with the kit's dated
 * table. Nothing is sent anywhere, so it works with telemetry off.
 *
 *   node <kit>/scripts/session-cost.mjs [--agent claude-code|codex] [--cwd <dir>]
 *        [--base <ref>] [--mode full|tokens|off] [--transcript <file>]
 *
 * The mode comes from `cost` in the repo's .claude/dev-kit.json (default `full`); `off`
 * prints nothing. `--transcript` names the session's main transcript instead of finding it.
 * Always exits 0: a missing transcript prints a "not available" line, never an error.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  findClaudeSession, findCodexSession, claudeSubagentFiles, otherClaudeSessions,
  otherCodexSessions, sessionUsage,
} from './lib/session-usage.mjs';
import { MODES, DEFAULT_MODE, loadPriceTable, variantOfFor, partiality, formatCostSection } from './lib/pr-cost.mjs';

function arg(name) {
  const argv = process.argv.slice(2);
  const eq = argv.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', timeout: 10_000 });
  return r.status === 0 ? r.stdout.trim() : '';
};

const NOT_AVAILABLE = '### Cost\n\nNot available: no session transcript for this work was found on this machine.\n';

function main() {
  const cwd = arg('cwd') || process.cwd();
  const root = git(cwd, 'rev-parse', '--show-toplevel') || cwd;

  let configured;
  try { configured = JSON.parse(readFileSync(join(root, '.claude', 'dev-kit.json'), 'utf8'))?.cost; } catch { /* no config */ }
  const requested = arg('mode') ?? configured;
  // Unset means the default. Anything set but unrecognised fails closed: someone who wrote
  // "none" or false was most likely opting out, so print nothing rather than a full cost.
  let mode = requested === undefined ? DEFAULT_MODE : requested;
  if (!MODES.includes(mode)) {
    process.stderr.write(`session-cost: unknown cost mode ${JSON.stringify(mode)} (use ${MODES.join(', ')}); printing nothing\n`);
    mode = 'off';
  }
  if (mode === 'off') return '';

  const env = process.env;
  const agent = arg('agent') || (env.CLAUDE_CODE_SESSION_ID || env.CLAUDECODE ? 'claude-code'
    : Object.keys(env).some((k) => k.startsWith('CODEX_')) ? 'codex' : 'claude-code');

  const branch = git(root, 'rev-parse', '--abbrev-ref', 'HEAD');
  const worktrees = git(root, 'worktree', 'list', '--porcelain')
    .split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9));
  const roots = worktrees.length ? worktrees : [root];

  const transcript = arg('transcript');
  let session;
  let otherSessions = 0;
  if (agent === 'codex') {
    session = findCodexSession({ threadId: env.CODEX_THREAD_ID, cwd: root, roots, mainPath: transcript });
    if (session) otherSessions = otherCodexSessions({ roots, branch, excludeRootId: session.rootId });
  } else {
    session = transcript
      ? { main: transcript, subagents: claudeSubagentFiles(transcript) }
      : findClaudeSession({ sessionId: env.CLAUDE_CODE_SESSION_ID, cwd });
    if (session) otherSessions = otherClaudeSessions({ dirs: roots, branch, exclude: session.main });
  }
  if (!session) return NOT_AVAILABLE;

  const table = loadPriceTable();
  const usage = sessionUsage(session, agent, { variantOf: variantOfFor(table) });

  // Commits on this branch that predate the session were made in work this line can't see.
  let commitTimes = [];
  const base = arg('base') || git(root, 'symbolic-ref', '--quiet', '--short', 'refs/remotes/origin/HEAD') || 'origin/main';
  const mergeBase = base.startsWith('-') ? '' : git(root, 'merge-base', '--end-of-options', base, 'HEAD');
  if (mergeBase && mergeBase !== git(root, 'rev-parse', 'HEAD')) {
    commitTimes = git(root, 'log', '--format=%at', `${mergeBase}..HEAD`).split('\n').filter(Boolean).map(Number);
  }
  const partial = partiality({ sessionStart: usage.firstTs, commitTimes, otherSessions });

  return formatCostSection({ usage, mode, table, subagents: session.subagents.length, partial });
}

let out;
try { out = main(); } catch { out = NOT_AVAILABLE; }
process.stdout.write(out);
process.exitCode = 0; // never fail the PR step: let stdout drain, then exit cleanly
