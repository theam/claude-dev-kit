# claude-dev-kit telemetry relay

A tiny serverless relay between the kit's clients and PostHog. Clients never hold
a PostHog key and never call PostHog directly — they POST a sanitized event here,
and the relay:

1. Rejects anything that isn't the expected `kit_session_completed` event.
2. **Re-enforces `contract.v1.json`** — drops every property not in the contract, validates enums and integer bounds.
3. **Never reads or stores the caller IP.**
4. Forwards the accepted event to PostHog as an anonymous event, using a key held only in this server's environment.

This mirrors the relay pattern used by [theam/limina](https://github.com/theam/limina), with its own contract and its own PostHog project.

## Deploy (Vercel)

```bash
cd packages/telemetry-relay
vercel deploy --prod
```

Set the environment variables in the Vercel project:

| Var | Required | Default | Notes |
|---|---|---|---|
| `POSTHOG_API_KEY` | yes | — | PostHog project API key (write-only/public). Held only here, never shipped to clients. |
| `POSTHOG_HOST` | no | `https://eu.i.posthog.com` | Use EU cloud to keep data in the EU. |

Until `POSTHOG_API_KEY` is set the relay responds `503 relay_not_configured` and forwards nothing.

Then point the kit at it: set `default_relay_url` in `telemetry/contract.v1.json` (repo root) to this deployment's URL, and keep this package's `contract.v1.json` copy in sync.

## Privacy guarantees

- IP is never forwarded or logged (disable Vercel access logs / PostHog IP capture too).
- Only the contract's allowlisted properties survive; unknown fields are silently dropped.
- `distinct_id` is the client's random `install_id`; `org` is included only if the organisation self-declared it.

## Local check

```bash
POSTHOG_API_KEY=phc_test node -e "import('./api/ingest.js').then(m=>console.log('loaded', typeof m.default))"
```
