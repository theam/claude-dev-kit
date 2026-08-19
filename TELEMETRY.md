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
npm create @theagilemonkeys/dev-kit
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

## Delivery (robust to sessions that never close)

One event per session. Normally it's sent at `SessionEnd`. To also cover sessions that never close cleanly (a crash, or a session left open indefinitely), the client keeps a tiny **outbox**: a `Stop` hook records a lightweight per-session marker (session id + transcript path + timestamp — no token parsing, no network), and the next `SessionStart` flushes markers of *prior* sessions that went stale (unrefreshed for 30 min). A still-open parallel session keeps refreshing its marker, so it's never sent early. State lives in `~/.claude/dev-kit-telemetry/pending.json`, is created **only if you opted in**, and self-cleans once an event is sent.

## Exactly what is sent

One POST (to the relay), only for sessions where the kit ran, matching the contract:

```json
{
  "schema_version": 1,
  "event_name": "kit_session_completed",
  "install_id": "b1c3f0a2-…-random-uuid",
  "org": "acme-corp (only if self-declared — omitted otherwise)",
  "properties": {
    "agent": "claude-code",
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
    "tokens_total": 181044,
    "prs_created": 1
  }
}
```

- `install_id` — random UUID stored at `~/.claude/dev-kit-telemetry/config.json`. Not derived from your machine, user, or repo. Delete the file to reset.
- `agent` — which agent host ran the kit: `claude-code` or `codex`. Lets aggregate usage be split by tool.
- `entrypoint` — which surface ran the pipeline. On Claude Code (`cli`, `claude-vscode`, `claude-desktop`, `intellij`, `sdk`, …) from `CLAUDE_CODE_ENTRYPOINT`; on Codex (`cli`, `vscode`) from the Codex originator. A short non-personal slug.
- `tracker_type` — the *category* (jira / linear / github / azure), never the site, project, or instance.
- `duration_bucket` — a coarse range, never a raw timestamp.
- `tokens_*` — sums parsed from the session transcript's `usage` fields.
- `prs_created` — a **count** of pull requests opened in the session. Derived by matching the *executed* command (e.g. `gh pr create`, `glab mr create`, a Bitbucket create-PR API call) — never the PR's URL, repo, title, or body, and never the skill text that merely mentions the command. Just the number.

## What is NEVER sent

Prompts, responses, code, diffs, file paths, file names, repo names or URLs (including PR URLs), ticket keys or contents, commit messages, branch names, emails, usernames, organization-instance data, or your IP (stripped at the relay). The client reads the transcript **only** to sum token counts, to check whether a kit component ran, and to count executed PR-create commands.

## Company attribution (optional, organisation-level)

By default events carry only a random `install_id`. An organisation that wants its own usage attributed to it sets a self-declared label in the committed `.claude/dev-kit.json` (the wizard can do this):

```json
{ "telemetry": { "org": "acme-corp" } }
```

When present it is sent as `org` (and a PostHog `company` group). Off unless you add it.

You can also set it **once at the user level** — the setup wizard stores your `org` in `~/.claude/dev-kit-telemetry/config.json`, which is used as a fallback when a repo (or a git worktree) has no `telemetry.org`. The repo value always wins if both are set.

Why this is GDPR-safe done this way:

- **It identifies a company, not a person.** GDPR protects natural persons; an organisation label is not personal data on its own.
- **It is self-declared by the organisation** — never derived from git author, email, username, or remote URL (doing so would turn it back into personal data).
- **Keep it a company name/code**, not a person. For very small / one-person orgs a company label can indirectly identify someone — use judgement, and if in doubt don't set it.

> This keeps you on the safe side of B2B usage analytics, but confirm your specific setup with counsel before relying on it.

## For maintainers (running the relay + PostHog)

- Deploy [`packages/telemetry-relay/`](./packages/telemetry-relay/) and set `POSTHOG_API_KEY` (+ optional `POSTHOG_HOST`, default EU) in its environment. Then point `default_relay_url` in [`telemetry/contract.v1.json`](./telemetry/contract.v1.json) at the deployment (keep the relay package's copy in sync).
- Disable IP capture in PostHog and access logs on the relay host — an IP plus `install_id` is re-identifiable.
- Report only **aggregates** externally (including to Anthropic). The data is anonymous by construction, so there is no per-user record to delete on request — state that in any privacy notice.
