/*
 * session-usage — token usage of an agent session, read locally from its transcript.
 *
 * Shared by telemetry.mjs (anonymous, opt-in counts) and session-cost.mjs (the PR Cost
 * section). It reads only `usage`, the model id, timestamps and the links between a
 * session and its subagents — never prompts, tool input or output, or file content.
 *
 * Claude Code writes one JSONL line per content block, and every line of one API message
 * repeats that message's `usage`. Summing every line over-counts, so usage is keyed by
 * message id and each message is counted once.
 *
 * Codex writes `token_count` events whose `total_token_usage` is cumulative. The usage of
 * a stretch is the difference between consecutive totals, attributed to the model of the
 * latest `turn_context`.
 */
import { readFileSync, readdirSync, statSync, existsSync, openSync, readSync, closeSync } from 'node:fs';
import { join, dirname, basename, resolve, sep } from 'node:path';
import { homedir } from 'node:os';

/* `cacheWrite` is a short-TTL write (Claude's 5-minute cache) or a write whose TTL the
 * transcript does not say (Codex). `cacheWrite1h` is Claude's 1-hour cache write. */
const FIELDS = ['input', 'output', 'cacheRead', 'cacheWrite', 'cacheWrite1h'];

export const emptyTokens = () => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheWrite1h: 0 });

export function addTokens(into, t) {
  for (const k of FIELDS) into[k] += t[k] || 0;
  return into;
}

export const totalTokens = (t) => FIELDS.reduce((n, k) => n + (t[k] || 0), 0);

/** An empty usage record: per-model token counts, plus the session's time span. */
export const emptyUsage = () => ({ models: {}, firstTs: undefined, lastTs: undefined });

/* Each model keeps its full totals; `variants` holds the subset billed at another rate
 * (fast mode, or a prompt over a long-context threshold), named by the caller. */
function addToModel(usage, model, t, variant) {
  const m = (usage.models[model] ||= { ...emptyTokens(), messages: 0, variants: {} });
  addTokens(m, t);
  m.messages += 1;
  if (variant) addTokens((m.variants[variant] ||= emptyTokens()), t);
}

function trackTime(usage, o) {
  const ts = Date.parse(o?.timestamp || '');
  if (Number.isNaN(ts)) return;
  if (usage.firstTs === undefined || ts < usage.firstTs) usage.firstTs = ts;
  if (usage.lastTs === undefined || ts > usage.lastTs) usage.lastTs = ts;
}

/** Merge `src` into `into` (both usage records). */
export function mergeUsage(into, src) {
  for (const [model, m] of Object.entries(src.models)) {
    const t = (into.models[model] ||= { ...emptyTokens(), messages: 0, variants: {} });
    addTokens(t, m);
    t.messages += m.messages;
    for (const [v, vt] of Object.entries(m.variants)) addTokens((t.variants[v] ||= emptyTokens()), vt);
  }
  for (const ts of [src.firstTs, src.lastTs]) {
    if (ts === undefined) continue;
    if (into.firstTs === undefined || ts < into.firstTs) into.firstTs = ts;
    if (into.lastTs === undefined || ts > into.lastTs) into.lastTs = ts;
  }
  return into;
}

/** Totals across every model of a usage record. */
export function usageTotals(usage) {
  const t = emptyTokens();
  for (const m of Object.values(usage.models)) addTokens(t, m);
  return t;
}

const toLines = (x) => (Array.isArray(x) ? x : String(x).split('\n'));

/* A token count from a transcript: a non-negative finite number, anything else is 0. */
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Claude Code usage from one or more transcripts. Pass every file of a session (main
 * first, then subagents) in one call, so a message that appears in two files is still
 * counted once. The time span comes from the first file: the session's own transcript.
 *
 * @param {string[][] | string[]} files  transcripts, each as an array of JSONL lines
 * @param {{variantOf?: (model: string, info: {promptTokens: number, speed?: string}) => string|undefined}} [opts]
 */
export function claudeUsage(files, { variantOf } = {}) {
  const list = files.length && !Array.isArray(files[0]) ? [files] : files;
  const usage = emptyUsage();
  const seen = new Map();
  let anon = 0;
  list.forEach((lines, fileIndex) => {
    for (const line of toLines(lines)) {
      if (!line) continue;
      let o; try { o = JSON.parse(line); } catch { continue; }
      if (fileIndex === 0) trackTime(usage, o);
      const msg = o?.message;
      const u = msg?.usage || o?.usage;
      if (!u || typeof u !== 'object') continue;
      const model = typeof msg?.model === 'string' ? msg.model : 'unknown';
      if (model === '<synthetic>') continue;
      const created = num(u.cache_creation_input_tokens);
      const w1h = Math.min(num(u.cache_creation?.ephemeral_1h_input_tokens), created);
      const t = {
        input: num(u.input_tokens),
        output: num(u.output_tokens),
        cacheRead: num(u.cache_read_input_tokens),
        cacheWrite: created - w1h, // 5-minute writes, and writes with no TTL breakdown
        cacheWrite1h: w1h,
      };
      if (totalTokens(t) === 0) continue;
      const key = msg?.id || o?.requestId || `anon:${anon++}`;
      seen.set(key, { model, t, speed: u.speed }); // the lines of one message repeat the same usage
    }
  });
  for (const { model, t, speed } of seen.values()) {
    const promptTokens = t.input + t.cacheRead + t.cacheWrite + t.cacheWrite1h;
    addToModel(usage, model, t, variantOf?.(model, { promptTokens, speed }));
  }
  return usage;
}

/**
 * Codex usage from one rollout (JSONL lines). `token_count` totals are cumulative, so
 * each event contributes its difference from the previous one.
 */
export function codexUsage(lines, { variantOf } = {}) {
  const usage = emptyUsage();
  let model = 'unknown';
  let prev = { input: 0, cached: 0, output: 0, write: 0 };
  for (const line of toLines(lines)) {
    if (!line) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    trackTime(usage, o);
    const p = o?.payload;
    if ((o?.type === 'turn_context' || p?.type === 'turn_context') && typeof p?.model === 'string') {
      model = p.model;
      continue;
    }
    const total = p?.type === 'token_count' ? p?.info?.total_token_usage : undefined;
    if (!total) continue;
    const cur = {
      input: num(total.input_tokens),
      cached: num(total.cached_input_tokens),
      output: num(total.output_tokens), // already includes reasoning_output_tokens
      write: num(total.cache_write_input_tokens),
    };
    const d = {};
    for (const k of Object.keys(cur)) d[k] = Math.max(0, cur[k] - prev[k]);
    prev = cur;
    const t = {
      input: Math.max(0, d.input - d.cached), // input_tokens includes the cached portion
      output: d.output,
      cacheRead: d.cached,
      cacheWrite: d.write,
      cacheWrite1h: 0,
    };
    if (totalTokens(t) === 0) continue;
    const promptTokens = num(p?.info?.last_token_usage?.input_tokens);
    addToModel(usage, model, t, variantOf?.(model, { promptTokens }));
  }
  return usage;
}

/* ---------------------------------------------------------------- discovery ---- */

const readLines = (p) => { try { return readFileSync(p, 'utf8').split('\n'); } catch { return []; } };

function walkFiles(dir, test, acc = []) {
  let names; try { names = readdirSync(dir); } catch { return acc; }
  for (const name of names) {
    const p = join(dir, name);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) walkFiles(p, test, acc);
    else if (test(name)) acc.push(p);
  }
  return acc;
}

/** Where Claude Code keeps transcripts (`CLAUDE_CONFIG_DIR` overrides `~/.claude`). */
export const claudeProjectsDir = (env = process.env) =>
  join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');

/** Claude Code's per-directory transcript folder name: every non-alphanumeric → `-`. */
export const claudeProjectSlug = (dir) => resolve(dir).replace(/[^A-Za-z0-9]/g, '-');

/** A Claude transcript's subagent transcripts (`<id>/subagents/**.jsonl`). */
export function claudeSubagentFiles(mainPath) {
  const dir = join(dirname(mainPath), basename(mainPath, '.jsonl'), 'subagents');
  return walkFiles(dir, (n) => n.endsWith('.jsonl')).sort();
}

const newest = (paths) =>
  paths
    .map((p) => { try { return [p, statSync(p).mtimeMs]; } catch { return [p, -1]; } })
    .sort((a, b) => b[1] - a[1])[0]?.[0];

/**
 * The current Claude Code session: by id (`CLAUDE_CODE_SESSION_ID`), else the most
 * recently written transcript of the working directory.
 * @returns {{ main: string, subagents: string[] } | null}
 */
export function findClaudeSession({ sessionId, cwd, projectsDir = claudeProjectsDir() }) {
  let main;
  if (sessionId && /^[A-Za-z0-9-]+$/.test(sessionId)) {
    let dirs = []; try { dirs = readdirSync(projectsDir); } catch { /* none */ }
    for (const d of dirs) {
      const p = join(projectsDir, d, `${sessionId}.jsonl`);
      if (existsSync(p)) { main = p; break; }
    }
  }
  if (!main && cwd) {
    const dir = join(projectsDir, claudeProjectSlug(cwd));
    let names = []; try { names = readdirSync(dir).filter((n) => n.endsWith('.jsonl')); } catch { /* none */ }
    main = newest(names.map((n) => join(dir, n)));
  }
  return main ? { main, subagents: claudeSubagentFiles(main) } : null;
}

/** Other Claude Code sessions, in the given working directories, that touched `branch`. */
export function otherClaudeSessions({ dirs, branch, exclude, projectsDir = claudeProjectsDir() }) {
  if (!branch) return 0;
  const needle = `"gitBranch":${JSON.stringify(branch)}`;
  const skip = exclude ? resolve(exclude) : '';
  let n = 0;
  for (const d of new Set(dirs.map(claudeProjectSlug))) {
    let names = []; try { names = readdirSync(join(projectsDir, d)); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith('.jsonl')) continue;
      const p = join(projectsDir, d, name);
      if (resolve(p) === skip) continue;
      try { if (readFileSync(p, 'utf8').includes(needle)) n++; } catch { /* unreadable */ }
    }
  }
  return n;
}

/** Where Codex keeps rollouts (`CODEX_HOME` overrides `~/.codex`). */
export const codexSessionsDir = (env = process.env) => join(env.CODEX_HOME || join(homedir(), '.codex'), 'sessions');

/* `session_meta` is a rollout's first line; it can carry long instructions, so read up to
 * the first newline in chunks rather than the whole (possibly large) file. */
export function codexMeta(path, maxBytes = 4 * 1024 * 1024) {
  let fd; try { fd = openSync(path, 'r'); } catch { return null; }
  try {
    const chunks = []; let size = 0;
    const buf = Buffer.alloc(64 * 1024);
    while (size < maxBytes) {
      const n = readSync(fd, buf, 0, buf.length, size);
      if (n <= 0) break;
      const nl = buf.subarray(0, n).indexOf(10);
      chunks.push(Buffer.from(buf.subarray(0, nl === -1 ? n : nl)));
      size += n;
      if (nl !== -1) break;
    }
    const o = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const p = o?.type === 'session_meta' || o?.payload?.type === 'session_meta' ? o.payload : o?.payload || o;
    if (!p || (!p.id && !p.session_id)) return null;
    return p;
  } catch { return null; } finally { closeSync(fd); }
}

const within = (dir, roots) => {
  if (!dir) return false;
  const d = resolve(dir);
  return roots.some((r) => { const root = resolve(r); return d === root || d.startsWith(root + sep); });
};

function codexRollouts(sessionsDir) {
  return walkFiles(sessionsDir, (n) => /^rollout-.*\.jsonl$/.test(n))
    .map((p) => { let m = 0; try { m = statSync(p).mtimeMs; } catch { /* gone */ } return { path: p, mtime: m }; })
    .sort((a, b) => b.mtime - a.mtime);
}

/**
 * The current Codex session and its subagent threads. By thread id when the host
 * exposes one, else the most recently written root rollout started in `cwd` — and only
 * then in another worktree of the repo (`roots`), so a story running in a sibling
 * worktree is not mistaken for this one.
 * @returns {{ main: string, subagents: string[], rootId: string, branch?: string } | null}
 */
export function findCodexSession({ threadId, cwd, roots = [], sessionsDir = codexSessionsDir(), mainPath }) {
  const all = codexRollouts(sessionsDir);
  const metas = new Map();
  const meta = (p) => { if (!metas.has(p)) metas.set(p, codexMeta(p)); return metas.get(p); };
  let main = mainPath;
  let rootId;
  if (main) {
    const m = meta(main);
    rootId = m?.session_id || m?.id;
  } else if (threadId) {
    for (const { path } of all) {
      const m = meta(path);
      if (m && (m.id === threadId || m.session_id === threadId)) { rootId = m.session_id || m.id; break; }
    }
    if (rootId) main = all.find(({ path }) => { const m = meta(path); return m && m.id === rootId; })?.path;
  }
  // A worktree nested inside this one (e.g. under .claude/worktrees/) is another story.
  const nested = cwd ? roots.filter((r) => resolve(r) !== resolve(cwd) && within(r, [cwd])) : [];
  const scopes = [cwd ? (d) => within(d, [cwd]) && !within(d, nested) : null, (d) => within(d, roots)];
  for (const inScope of scopes) {
    if (main || !inScope) continue;
    for (const { path } of all) {
      const m = meta(path);
      if (m && !m.parent_thread_id && inScope(m.cwd)) { main = path; rootId = m.session_id || m.id; break; }
    }
  }
  if (!main || !rootId) return null;
  const subagents = all
    .filter(({ path }) => path !== main)
    .filter(({ path }) => { const m = meta(path); return m && m.id !== rootId && (m.session_id === rootId || m.parent_thread_id === rootId); })
    .map(({ path }) => path)
    .sort();
  return { main, subagents, rootId, branch: meta(main)?.git?.branch };
}

/** Other Codex root sessions, under `roots`, whose rollout started on `branch`. */
export function otherCodexSessions({ roots, branch, excludeRootId, sessionsDir = codexSessionsDir() }) {
  if (!branch) return 0;
  let n = 0;
  for (const { path } of codexRollouts(sessionsDir)) {
    const m = codexMeta(path);
    if (!m || m.parent_thread_id) continue;
    if ((m.session_id || m.id) === excludeRootId) continue;
    if (m.git?.branch === branch && within(m.cwd, roots)) n++;
  }
  return n;
}

/** Usage of a found session (main transcript + subagents). */
export function sessionUsage(session, agent, opts = {}) {
  if (agent === 'codex') {
    const u = codexUsage(readLines(session.main), opts);
    for (const p of session.subagents) {
      const sub = codexUsage(readLines(p), opts);
      sub.firstTs = undefined; // the session starts when its main thread starts
      sub.lastTs = undefined;
      mergeUsage(u, sub);
    }
    return u;
  }
  return claudeUsage([readLines(session.main), ...session.subagents.map(readLines)], opts);
}
