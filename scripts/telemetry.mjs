#!/usr/bin/env node
/*
 * Anonymous, opt-in usage telemetry for claude-dev-kit.
 *
 * Ships OFF. Sends ONLY when ALL hold:
 *   1. The user granted consent (via the `create-dev-kit` wizard, stored in
 *      ~/.claude/dev-kit-telemetry/config.json), and
 *   2. A kit command/agent actually ran in the session (honest attribution).
 *
 * The client NEVER talks to PostHog directly and ships NO API key. It sends a
 * sanitized event to the relay, which re-enforces the contract
 * (telemetry/contract.v1.json), strips the IP, and forwards to PostHog.
 *
 * It sends token COUNTS + coarse metadata only. It NEVER reads or sends prompts,
 * code, paths, repo names, ticket content, emails, or org-instance data. It fails
 * silent and never blocks or slows the session.
 *
 * Opt out any time: DEVKIT_TELEMETRY=0, or set consent to "denied" in the config.
 * See TELEMETRY.md for the full schema.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

const done = () => process.exit(0); // fail-silent, always

try {
  if (process.env.DEVKIT_TELEMETRY === '0') done();

  // --- Consent (written by the create-dev-kit wizard) ----------------------
  const cfgPath = join(homedir(), '.claude', 'dev-kit-telemetry', 'config.json');
  let consentCfg = {};
  try { consentCfg = JSON.parse(readFileSync(cfgPath, 'utf8')); } catch { /* absent */ }

  const envEnabled = String(
    process.env.DEVKIT_TELEMETRY_ENABLED ||
    process.env.CLAUDE_PLUGIN_OPTION_TELEMETRY_ENABLED || '').toLowerCase();
  const granted =
    consentCfg.consent === 'granted' ||
    envEnabled === 'true' || envEnabled === '1' || envEnabled === 'yes';
  if (!granted) done();

  // --- Relay endpoint (no PostHog key lives in the client) -----------------
  let defaultRelay = 'https://claude-dev-kit-telemetry.vercel.app';
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT || '.';
    defaultRelay = JSON.parse(
      readFileSync(join(root, 'telemetry', 'contract.v1.json'), 'utf8')
    ).default_relay_url || defaultRelay;
  } catch { /* use fallback */ }
  const relay = (
    process.env.DEVKIT_TELEMETRY_RELAY_URL || consentCfg.relay_url || defaultRelay
  ).replace(/\/+$/, '');

  // --- Stable, anonymous install id ----------------------------------------
  let installId = consentCfg.install_id;
  if (!installId) {
    installId = randomUUID();
    try { mkdirSync(dirname(cfgPath), { recursive: true }); } catch { /* ignore */ }
    try {
      writeFileSync(cfgPath, JSON.stringify({ ...consentCfg, consent: 'granted', install_id: installId }, null, 2));
    } catch { /* ignore */ }
  }

  // --- Hook event payload from stdin ---------------------------------------
  const raw = readFileSync(0, 'utf8');
  const event = raw ? JSON.parse(raw) : {};
  const transcriptPath = event.transcript_path;
  if (!transcriptPath || !existsSync(transcriptPath)) done();

  const lines = readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);

  // --- Honesty gate: only attribute sessions where the kit actually ran ----
  const KIT_MARKERS = [
    'fullstack-dev-kit', 'work-story', 'launch-story', 'coding-agent',
    'coverage-check', 'coverage-guardian', 'issue-fetch', 'issue-update',
    'e2e-generate', 'e2e-author', 'pr-review', 'pr-reviewer', 'pr-fixer',
    'fix-pr', 'create-pr', 'security-reviewer', 'figma-fetch', 'dev-kit-setup',
  ];
  if (!lines.some((l) => KIT_MARKERS.some((m) => l.includes(m)))) done();

  // --- Sum token usage. Message CONTENT is never inspected. ----------------
  const tok = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  let firstTs, lastTs;
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const ts = Date.parse(obj?.timestamp || '');
    if (!Number.isNaN(ts)) { firstTs = firstTs ?? ts; lastTs = ts; }
    const u = obj?.message?.usage || obj?.usage;
    if (!u) continue;
    tok.input += u.input_tokens || 0;
    tok.output += u.output_tokens || 0;
    tok.cacheRead += u.cache_read_input_tokens || 0;
    tok.cacheCreation += u.cache_creation_input_tokens || 0;
  }
  if (tok.input + tok.output === 0) done();

  // --- Coarse duration bucket (never a raw timestamp) ----------------------
  let durationBucket;
  if (firstTs != null && lastTs != null && lastTs >= firstTs) {
    const mins = (lastTs - firstTs) / 60000;
    durationBucket =
      mins < 1 ? 'lt_1m' : mins < 5 ? '1m_to_5m' : mins < 15 ? '5m_to_15m'
      : mins < 60 ? '15m_to_1h' : 'gte_1h';
  }

  // --- Self-declared org label (never auto-derived) ------------------------
  let trackerType, org;
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.claude', 'dev-kit.json'), 'utf8'));
    trackerType = cfg?.tracker?.type;
    const rawOrg = cfg?.telemetry?.org;
    if (typeof rawOrg === 'string' && rawOrg.trim()) org = rawOrg.trim().slice(0, 64);
  } catch { /* ignore */ }

  let kitVersion;
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT || '.';
    kitVersion = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch { /* ignore */ }

  // --- Send the sanitized event to the relay (no API key here) -------------
  const payload = {
    schema_version: 1,
    event_name: 'kit_session_completed',
    install_id: installId,
    org, // undefined unless self-declared
    properties: {
      schema_version: 1,
      kit_version: kitVersion,
      claude_code_version: event.version || undefined,
      os: process.platform,
      tracker_type: trackerType,
      duration_bucket: durationBucket,
      tokens_input: tok.input,
      tokens_output: tok.output,
      tokens_cache_read: tok.cacheRead,
      tokens_cache_creation: tok.cacheCreation,
      tokens_total: tok.input + tok.output + tok.cacheRead + tok.cacheCreation,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  await fetch(`${relay}/api/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: controller.signal,
  }).catch(() => {});
  clearTimeout(timer);
} catch {
  /* fail-silent: telemetry must never disrupt a session */
}
process.exit(0);
