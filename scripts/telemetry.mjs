#!/usr/bin/env node
/*
 * Anonymous, opt-in usage telemetry for claude-dev-kit → relay → PostHog.
 *
 * Ships OFF. Runs only when the user granted consent (via the create-dev-kit
 * wizard → ~/.claude/dev-kit-telemetry/config.json). No consent → this script
 * does nothing and writes nothing.
 *
 * It sends token COUNTS + coarse metadata only — never prompts, code, paths,
 * repo names, ticket content, emails, org-instance data, or the caller IP
 * (stripped at the relay). One anonymous event per session.
 *
 * Delivery is robust to sessions that never close cleanly (outbox pattern):
 *   - Stop        → cheaply upsert a per-session marker (no transcript parse).
 *   - SessionEnd  → compute + send this session's event, drop its marker.
 *   - SessionStart→ flush markers of PRIOR sessions that went stale (ended
 *                   without a SessionEnd — crash, or a never-closed session).
 * A still-open parallel session keeps refreshing its marker, so it is never
 * flushed early. Everything lives in ~/.claude/dev-kit-telemetry/ and self-cleans.
 *
 * Opt out any time: DEVKIT_TELEMETRY=0, or set consent to "denied" in the config.
 * See TELEMETRY.md.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync, renameSync, rmSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const done = () => process.exit(0); // fail-silent, always

const STATE_DIR = join(homedir(), '.claude', 'dev-kit-telemetry');
const CONFIG = join(STATE_DIR, 'config.json');
const PENDING = join(STATE_DIR, 'pending.json');
const STALE_MS = 10 * 60 * 1000;             // marker unrefreshed for 10 min → session is done → safe to flush on next start
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // hard cap: never keep a marker longer than this

const KIT_MARKERS = [
  'fullstack-dev-kit', 'work-story', 'launch-story', 'coding-agent',
  'coverage-check', 'coverage-guardian', 'issue-fetch', 'issue-update',
  'e2e-generate', 'e2e-author', 'pr-review', 'pr-reviewer', 'pr-fixer',
  'fix-pr', 'create-pr', 'security-reviewer', 'figma-fetch', 'dev-kit-setup',
];

const readJson = (p, def) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return def; } };
function writeJsonAtomic(p, obj) {
  try {
    mkdirSync(dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    writeFileSync(tmp, JSON.stringify(obj, null, 2));
    renameSync(tmp, p);
  } catch { /* ignore */ }
}

try {
  if (process.env.DEVKIT_TELEMETRY === '0') done();

  const cfg = readJson(CONFIG, {});
  const envEnabled = String(
    process.env.DEVKIT_TELEMETRY_ENABLED ||
    process.env.CLAUDE_PLUGIN_OPTION_TELEMETRY_ENABLED || '').toLowerCase();
  const granted = cfg.consent === 'granted' ||
    envEnabled === 'true' || envEnabled === '1' || envEnabled === 'yes';
  if (!granted) done(); // no consent → no markers, no send, nothing on disk

  const raw = readFileSync(0, 'utf8');
  const event = raw ? JSON.parse(raw) : {};
  const evName = event.hook_event_name || '';
  const sessionId = event.session_id;

  // Stable anonymous install id (shared across sessions).
  let installId = cfg.install_id;
  if (!installId) {
    installId = randomUUID();
    writeJsonAtomic(CONFIG, { ...cfg, consent: 'granted', install_id: installId });
  }

  // Deterministic per-session dedup id: the SAME value on every code path (Stop /
  // SessionEnd / SessionStart flush / fallback), so re-sends of one session share
  // a uuid and PostHog collapses them. Derived locally from install+session — the
  // real session id never leaves the machine. No session id → random (nothing to
  // dedup against).
  const sessionDedup = (sid) => {
    if (!sid) return randomUUID();
    const h = createHash('sha256').update(`${installId}|${sid}`).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  };

  // At-most-once claim: exclusively create a sentinel for this dedup id. Only the
  // first caller wins (O_EXCL), so concurrent hook runs — e.g. Desktop restoring
  // several sessions at once on reopen — never double-send the same marker. This
  // is a local guarantee, independent of PostHog's own dedup.
  const claim = (dedup) => {
    try { writeFileSync(join(STATE_DIR, `sent-${dedup}`), '', { flag: 'wx' }); return true; }
    catch { return false; }
  };

  // Relay endpoint (no PostHog key in the client).
  let defaultRelay = 'https://claude-dev-kit-telemetry-relay.vercel.app';
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT || '.';
    defaultRelay = JSON.parse(readFileSync(join(root, 'telemetry', 'contract.v1.json'), 'utf8')).default_relay_url || defaultRelay;
  } catch { /* fallback */ }
  const relay = (process.env.DEVKIT_TELEMETRY_RELAY_URL || cfg.relay_url || defaultRelay).replace(/\/+$/, '');

  let kitVersion;
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT || '.';
    kitVersion = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch { /* ignore */ }

  const entrypoint = (process.env.CLAUDE_CODE_ENTRYPOINT || '')
    .toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 32) || undefined;

  // Compute one session's event from its transcript and POST it. Content is
  // never inspected beyond summing `usage` and checking a kit component ran.
  async function flush(transcriptPath, cwd, ep, ccVersion, dedup) {
    if (!transcriptPath || !existsSync(transcriptPath)) return;
    const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
    if (!lines.some((l) => KIT_MARKERS.some((m) => l.includes(m)))) return; // kit didn't run this session

    const tok = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
    let firstTs, lastTs;
    for (const line of lines) {
      let o; try { o = JSON.parse(line); } catch { continue; }
      const ts = Date.parse(o?.timestamp || '');
      if (!Number.isNaN(ts)) { firstTs = firstTs ?? ts; lastTs = ts; }
      const u = o?.message?.usage || o?.usage;
      if (!u) continue;
      tok.input += u.input_tokens || 0;
      tok.output += u.output_tokens || 0;
      tok.cacheRead += u.cache_read_input_tokens || 0;
      tok.cacheCreation += u.cache_creation_input_tokens || 0;
    }
    if (tok.input + tok.output === 0) return;

    let durationBucket;
    if (firstTs != null && lastTs != null && lastTs >= firstTs) {
      const m = (lastTs - firstTs) / 60000;
      durationBucket = m < 1 ? 'lt_1m' : m < 5 ? '1m_to_5m' : m < 15 ? '5m_to_15m' : m < 60 ? '15m_to_1h' : 'gte_1h';
    }

    let trackerType, org;
    try {
      const c = JSON.parse(readFileSync(join(cwd || '.', '.claude', 'dev-kit.json'), 'utf8'));
      trackerType = c?.tracker?.type;
      const o = c?.telemetry?.org;
      if (typeof o === 'string' && o.trim()) org = o.trim().slice(0, 64);
    } catch { /* ignore */ }
    // Fallback to the user-level org (set once in the wizard). Robust to worktrees
    // and repos whose committed dev-kit.json lacks a telemetry.org block.
    if (!org && typeof cfg.org === 'string' && cfg.org.trim()) org = cfg.org.trim().slice(0, 64);

    const payload = {
      schema_version: 1,
      event_name: 'kit_session_completed',
      install_id: installId,
      org,
      event_uuid: dedup, // per-session id (random, NOT the real session id) so the relay/PostHog can dedup re-sends

      properties: {
        schema_version: 1,
        kit_version: kitVersion,
        claude_code_version: ccVersion || undefined,
        os: process.platform,
        entrypoint: ep,
        tracker_type: trackerType,
        duration_bucket: durationBucket,
        tokens_input: tok.input,
        tokens_output: tok.output,
        tokens_cache_read: tok.cacheRead,
        tokens_cache_creation: tok.cacheCreation,
        tokens_total: tok.input + tok.output + tok.cacheRead + tok.cacheCreation,
      },
    };
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 3000);
    await fetch(`${relay}/api/ingest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: ctl.signal,
    }).catch(() => {});
    clearTimeout(t);
  }

  if (evName === 'Stop') {
    // Cheap: record/refresh this session's marker. No transcript parse, no network.
    if (sessionId && event.transcript_path) {
      const pend = readJson(PENDING, {});
      pend[sessionId] = {
        transcript_path: event.transcript_path,
        cwd: event.cwd || process.cwd(),
        entrypoint,
        cc_version: event.version,
        dedup: pend[sessionId]?.dedup || sessionDedup(sessionId), // stable per session → one event even across re-sends
        updated: Date.now(),
      };
      writeJsonAtomic(PENDING, pend);
    }
    done();
  }

  if (evName === 'SessionEnd') {
    const pend = readJson(PENDING, {});
    const dedup = pend[sessionId]?.dedup || sessionDedup(sessionId);
    if (claim(dedup)) {
      await flush(event.transcript_path, event.cwd || process.cwd(), entrypoint, event.version, dedup);
    }
    if (sessionId && pend[sessionId]) { delete pend[sessionId]; writeJsonAtomic(PENDING, pend); }
    done();
  }

  if (evName === 'SessionStart') {
    // Flush prior sessions that never closed cleanly (stale markers).
    const pend = readJson(PENDING, {});
    const now = Date.now();
    let changed = false;
    for (const [sid, m] of Object.entries(pend)) {
      if (sid === sessionId) continue;                       // not the session just starting
      const age = now - (m?.updated || 0);
      if (age > MAX_AGE_MS) { delete pend[sid]; changed = true; continue; }
      if (age > STALE_MS) {                                  // abandoned session → send its event
        const dedup = m.dedup || sessionDedup(sid);
        if (claim(dedup)) {
          await flush(m.transcript_path, m.cwd, m.entrypoint, m.cc_version, dedup);
        }
        delete pend[sid]; changed = true;
      }
    }
    if (changed) writeJsonAtomic(PENDING, pend);
    // GC at-most-once sentinels so they never accumulate past the marker hard-cap.
    try {
      for (const f of readdirSync(STATE_DIR)) {
        if (!f.startsWith('sent-')) continue;
        try {
          if (now - statSync(join(STATE_DIR, f)).mtimeMs > MAX_AGE_MS) rmSync(join(STATE_DIR, f), { force: true });
        } catch { /* ignore one bad entry */ }
      }
    } catch { /* ignore */ }
    done();
  }

  // Fallback (unknown/absent event name): behave like SessionEnd — best-effort single send.
  {
    const dedup = sessionDedup(sessionId);
    if (claim(dedup)) {
      await flush(event.transcript_path, event.cwd || process.cwd(), entrypoint, event.version, dedup);
    }
  }
} catch {
  /* fail-silent: telemetry must never disrupt a session */
}
process.exit(0);
