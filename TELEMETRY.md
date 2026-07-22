# Telemetry

claude-dev-kit can share **anonymous, opt-in** usage telemetry so The Agile Monkeys can show aggregate impact (e.g. "teams using this kit drove *N* tokens of Claude usage"). This document is the complete, honest description. If anything here surprises you, telemetry is doing something it shouldn't — open an issue.

## The short version

- **OFF by default.** Nothing is sent unless you explicitly opt in.
- **Anonymous.** Identified only by a random `install_id`. No account, email, org-instance, or repo is attached.
- **Token counts only.** How *many* tokens a session used — never *what* was in them.
- **No key in the client, no direct PostHog call.** Clients POST to a relay that re-enforces the contract and strips your IP before forwarding.
- **Honest attribution.** Only sessions where a kit command/agent actually ran are reported.
- **Auditable.** Client: [`scripts/telemetry.mjs`](./scripts/telemetry.mjs). Contract: [`telemetry/contract.v1.json`](./telemetry/contract.v1.json). Relay: [`packages/telemetry-relay/`](./packages/telemetry-relay/).

## How to enable / disable it

The easy path is the setup wizard:

```bash
npm create @theam/dev-kit
```

It shows exactly what would be collected and asks yes/no, writing your choice to `~/.claude/dev-kit-telemetry/config.json` (per user). To change your mind, re-run it, or:

- **Disable:** `DEVKIT_TELEMETRY=0` (wins over everything), or set `"consent": "denied"` in that file.
- **Enable without the wizard:** set `"consent": "granted"` there, or the plugin's `telemetry_enabled` option.

## The relay boundary

Clients **never talk to PostHog directly and ship no PostHog key.** They send the sanitized event to the relay ([`packages/telemetry-relay/`](./packages/telemetry-relay/)), which:

1. Rejects anything that isn't the expected event.
2. **Re-enforces `contract.v1.json`** — drops every property not in the contract, validates enums and bounds.
3. **Never reads or stores your IP.**
4. Forwards to PostHog as an anonymous event, using a key held only in the relay's environment.

This mirrors the relay pattern used by [theam/limina](https://github.com/theam/limina).

## Exactly what is sent

One POST at `SessionEnd`, only for sessions where the kit ran, matching the contract:

```json
{
  "schema_version": 1,
  "event_name": "kit_session_completed",
  "install_id": "b1c3f0a2-…-random-uuid",
  "org": "acme-corp (only if self-declared — omitted otherwise)",
  "properties": {
    "kit_version": "0.6.0",
    "claude_code_version": "2.1.x",
    "os": "darwin",
    "entrypoint": "claude-vscode",
    "tracker_type": "jira",
    "duration_bucket": "5m_to_15m",
    "tokens_input": 48210,
    "tokens_output": 9134,
    "tokens_cache_read": 120400,
    "tokens_cache_creation": 3300,
    "tokens_total": 181044
  }
}
```

- `install_id` — random UUID stored at `~/.claude/dev-kit-telemetry/config.json`. Not derived from your machine, user, or repo. Delete the file to reset.
- `entrypoint` — which Claude Code surface ran the pipeline (`cli`, `claude-vscode`, `claude-desktop`, `intellij`, `sdk`, …), from `CLAUDE_CODE_ENTRYPOINT`. A short non-personal slug.
- `tracker_type` — the *category* (jira / linear / github / azure), never the site, project, or instance.
- `duration_bucket` — a coarse range, never a raw timestamp.
- `tokens_*` — sums parsed from the session transcript's `usage` fields.

## What is NEVER sent

Prompts, responses, code, diffs, file paths, file names, repo names or URLs, ticket keys or contents, commit messages, branch names, emails, usernames, organization-instance data, or your IP (stripped at the relay). The client reads the transcript **only** to sum token counts and to check whether a kit component ran.

## Company attribution (optional, organisation-level)

By default events carry only a random `install_id`. An organisation that wants its own usage attributed to it sets a self-declared label in the committed `.claude/dev-kit.json` (the wizard can do this):

```json
{ "telemetry": { "org": "acme-corp" } }
```

When present it is sent as `org` (and a PostHog `company` group). Off unless you add it.

Why this is GDPR-safe done this way:

- **It identifies a company, not a person.** GDPR protects natural persons; an organisation label is not personal data on its own.
- **It is self-declared by the organisation** — never derived from git author, email, username, or remote URL (doing so would turn it back into personal data).
- **Keep it a company name/code**, not a person. For very small / one-person orgs a company label can indirectly identify someone — use judgement, and if in doubt don't set it.

> This keeps you on the safe side of B2B usage analytics, but confirm your specific setup with counsel before relying on it.

## For maintainers (running the relay + PostHog)

- Deploy [`packages/telemetry-relay/`](./packages/telemetry-relay/) and set `POSTHOG_API_KEY` (+ optional `POSTHOG_HOST`, default EU) in its environment. Then point `default_relay_url` in [`telemetry/contract.v1.json`](./telemetry/contract.v1.json) at the deployment (keep the relay package's copy in sync).
- Disable IP capture in PostHog and access logs on the relay host — an IP plus `install_id` is re-identifiable.
- Report only **aggregates** externally (including to Anthropic). The data is anonymous by construction, so there is no per-user record to delete on request — state that in any privacy notice.
