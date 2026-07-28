// Telemetry relay for claude-dev-kit.
//
// Clients never talk to PostHog directly. They POST a sanitized event here; the
// relay RE-ENFORCES telemetry/contract.v1.json (drops any unknown property,
// validates enums/ranges), never stores the caller IP, and forwards the accepted
// event to PostHog using a key held only in this server's environment.
//
// Deploy on Vercel (or any Node serverless host). Required env:
//   POSTHOG_API_KEY   PostHog project API key (write-only/public is fine)
//   POSTHOG_HOST      e.g. https://eu.i.posthog.com   (default: EU cloud)
//
// This mirrors the relay pattern used by theam/limina, with its own contract.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load the contract from whichever location survives serverless bundling.
// (vercel.json `includeFiles` bundles contract.v1.json alongside the function.)
let contract = null;
for (const p of [
  join(__dirname, '..', 'contract.v1.json'),
  join(__dirname, 'contract.v1.json'),
  join(process.cwd(), 'contract.v1.json'),
]) {
  try { contract = JSON.parse(readFileSync(p, 'utf8')); break; } catch { /* try next */ }
}

const POSTHOG_HOST = (process.env.POSTHOG_HOST || 'https://eu.i.posthog.com').replace(/\/+$/, '');
const POSTHOG_API_KEY = process.env.POSTHOG_API_KEY || '';

function sanitize(properties = {}) {
  const spec = contract.allowed_properties;
  const out = {};
  for (const [key, def] of Object.entries(spec)) {
    const v = properties[key];
    if (v === undefined || v === null) continue;
    if (def.const !== undefined && v !== def.const) continue;
    if (def.type === 'integer') {
      if (!Number.isFinite(v)) continue;
      let n = Math.trunc(v);
      if (def.min !== undefined && n < def.min) continue;
      out[key] = n;
    } else if (def.type === 'enum') {
      if (def.values.includes(v)) out[key] = v;
    } else if (def.type === 'string') {
      if (typeof v === 'string') out[key] = v.slice(0, def.maxLength || 256);
    } else if (def.type === 'version') {
      if (typeof v === 'string' && /^[0-9][0-9A-Za-z.\-+]{0,31}$/.test(v)) out[key] = v;
    }
  }
  // Everything not in the contract is dropped by construction.
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!POSTHOG_API_KEY) return res.status(503).json({ error: 'relay_not_configured' });
  if (!contract) return res.status(503).json({ error: 'contract_unavailable' });

  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch { body = null; }
  if (!body || body.event_name !== contract.event_name) {
    return res.status(400).json({ error: 'bad_event' });
  }

  const installId = typeof body.install_id === 'string' ? body.install_id.slice(0, 64) : null;
  if (!installId) return res.status(400).json({ error: 'missing_install_id' });

  const properties = sanitize(body.properties);
  properties.$process_person_profile = false; // anonymous: no PostHog person profile
  properties.$geoip_disable = true;           // don't derive geolocation (the IP PostHog sees is this relay's, not the user's)
  const org = typeof body.org === 'string' && body.org.trim() ? body.org.trim().slice(0, 64) : undefined;
  if (org) properties.org = org;

  // Per-session dedup id from the client (random, not the real session id) → PostHog
  // deduplicates events sharing this uuid, so re-sends of one session count once.
  const eventUuid = typeof body.event_uuid === 'string' && /^[0-9a-fA-F-]{8,64}$/.test(body.event_uuid)
    ? body.event_uuid : undefined;

  const phEvent = {
    api_key: POSTHOG_API_KEY,
    event: contract.event_name,
    distinct_id: installId,
    // NOTE: the caller IP is never read, forwarded, or stored by this relay.
    properties,
    ...(eventUuid ? { uuid: eventUuid } : {}),
    ...(org ? { $groups: { company: org } } : {}),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const r = await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(phEvent),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status(r.ok ? 202 : 502).json({ accepted: r.ok });
  } catch {
    return res.status(502).json({ accepted: false });
  }
}
