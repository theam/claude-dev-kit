#!/usr/bin/env node
/*
 * Anonymous, opt-in usage telemetry for claude-dev-kit → PostHog.
 *
 * Ships OFF. It emits ONLY when BOTH are true:
 *   1. The user opted in (telemetry_enabled = true).
 *   2. A kit command/agent actually ran in the session (honest attribution).
 *
 * It sends token COUNTS and coarse metadata only. It NEVER reads or sends:
 * prompts, code, diffs, file paths, repo names, ticket contents, emails, org names,
 * or the session id. It fails silent and never blocks or slows the session.
 *
 * Destination: PostHog. The PostHog project API key is a WRITE-ONLY public key,
 * safe to ship in an open-source repo — set DEFAULT_POSTHOG_KEY below before release.
 * The event is sent as anonymous ($process_person_profile: false), so no person
 * profile is created; the only identifier is a random installId.
 *
 * Opt out any time with: DEVKIT_TELEMETRY=0  (env), or set telemetry_enabled=false.
 * See TELEMETRY.md for the full schema.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// The Agile Monkeys' PostHog project. The project API key is write-only/public.
// Fill these before publishing a release (or override per-user via plugin options / env).
const DEFAULT_POSTHOG_KEY = '__THEAM_POSTHOG_PROJECT_KEY__';
const DEFAULT_POSTHOG_HOST = 'https://eu.i.posthog.com';

const done = () => process.exit(0); // fail-silent, always

try {
  // --- Kill switch + opt-in gate -------------------------------------------
  if (process.env.DEVKIT_TELEMETRY === '0') done();

  const enabled = String(process.env.CLAUDE_PLUGIN_OPTION_TELEMETRY_ENABLED || '').toLowerCase();
  const isEnabled = enabled === 'true' || enabled === '1' || enabled === 'yes';
  if (!isEnabled) done();

  const apiKey =
    process.env.CLAUDE_PLUGIN_OPTION_POSTHOG_API_KEY ||
    process.env.POSTHOG_API_KEY ||
    DEFAULT_POSTHOG_KEY;
  const host = (
    process.env.CLAUDE_PLUGIN_OPTION_POSTHOG_HOST ||
    process.env.POSTHOG_HOST ||
    DEFAULT_POSTHOG_HOST
  ).replace(/\/+$/, '');
  if (!apiKey || apiKey === '__THEAM_POSTHOG_PROJECT_KEY__') done();

  // --- Read the hook event payload from stdin ------------------------------
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
  const kitRan = lines.some((l) => KIT_MARKERS.some((m) => l.includes(m)));
  if (!kitRan) done();

  // --- Sum token usage. Message CONTENT is never inspected. ----------------
  const tok = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  for (const line of lines) {
    let obj;
    try { obj = JSON.parse(line); } catch { continue; }
    const u = obj?.message?.usage || obj?.usage;
    if (!u) continue;
    tok.input += u.input_tokens || 0;
    tok.output += u.output_tokens || 0;
    tok.cacheRead += u.cache_read_input_tokens || 0;
    tok.cacheCreation += u.cache_creation_input_tokens || 0;
  }
  if (tok.input + tok.output === 0) done();

  // --- Stable, anonymous install id (random — not derived from anything) ---
  const idFile = join(homedir(), '.claude', 'dev-kit-telemetry-id');
  let installId;
  if (existsSync(idFile)) {
    installId = readFileSync(idFile, 'utf8').trim();
  } else {
    installId = randomUUID();
    try { writeFileSync(idFile, installId); } catch { /* ignore */ }
  }

  // --- Coarse category only: which tracker adapter (never the instance) ----
  let trackerType;
  try {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.claude', 'dev-kit.json'), 'utf8'));
    trackerType = cfg?.tracker?.type;
  } catch { /* ignore */ }

  let kitVersion;
  try {
    const root = process.env.CLAUDE_PLUGIN_ROOT || '.';
    kitVersion = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  } catch { /* ignore */ }

  // --- PostHog capture event (anonymous) -----------------------------------
  const payload = {
    api_key: apiKey,
    event: 'kit_session_completed',
    distinct_id: installId,
    properties: {
      $process_person_profile: false, // anonymous: no person profile created
      schema: 1,
      kit_version: kitVersion,
      claude_code_version: event.version || undefined,
      os: process.platform,
      tracker_type: trackerType,
      tokens_input: tok.input,
      tokens_output: tok.output,
      tokens_cache_read: tok.cacheRead,
      tokens_cache_creation: tok.cacheCreation,
      tokens_total: tok.input + tok.output + tok.cacheRead + tok.cacheCreation,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  await fetch(`${host}/capture/`, {
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
