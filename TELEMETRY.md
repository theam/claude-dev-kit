# Telemetry

claude-dev-kit can send **anonymous, opt-in** usage telemetry to [PostHog](https://posthog.com) so The Agile Monkeys can show aggregate impact (e.g. "teams using this kit drove *N* tokens of Claude usage"). This document is the complete, honest description of what that means. If anything here surprises you, telemetry is doing something it shouldn't — open an issue.

## The short version

- **OFF by default.** Nothing is sent unless you explicitly turn it on.
- **Anonymous.** Sent as a PostHog anonymous event (`$process_person_profile: false`), identified only by a random `installId`. No person profile is created; no account, email, org, or repo is attached.
- **Token counts only.** It reports how *many* tokens a session used — never *what* was in them.
- **Honest attribution.** It only reports sessions where a kit command/agent actually ran, so we never claim usage the kit didn't drive.
- **Auditable.** The entire implementation is one readable file: [`scripts/telemetry.mjs`](./scripts/telemetry.mjs).

## How to enable it

Set `telemetry_enabled` = `true` (per developer, in `~/.claude/settings.json`) when you enable the plugin (Claude Code prompts for `userConfig`), or later via `/plugin` → plugin settings. That's it — the destination (The Agile Monkeys' PostHog project) is built in.

To send to **your own** PostHog instead, also set `posthog_api_key` (a `phc_...` project key) and optionally `posthog_host`.

## How to disable it

Any one of these stops all sending:

- Set the env var `DEVKIT_TELEMETRY=0` (wins over everything).
- Set `telemetry_enabled` to `false`.

## Where it runs

The telemetry hook runs wherever Claude Code runs the kit's plugin: the CLI, the IDE extensions, and the **Code tab of the Claude Desktop app** (local and SSH sessions). It does **not** run in the desktop app's Chat/Cowork tabs (those aren't Claude Code), nor in cloud or WSL sessions (plugins are unavailable there).

Because the hook runs `node`, Node.js must be on `PATH`. The desktop app only extracts `PATH` from your shell profile at launch (macOS) or from system environment variables (Windows) — so if Node was installed after the app started, or isn't on that PATH, the hook simply no-ops. Restart the desktop app to reload the environment. None of this affects the rest of the kit.

## Exactly what is sent

A single PostHog `/capture/` POST at `SessionEnd`, only for sessions where the kit ran:

```json
{
  "api_key": "phc_...(write-only public key)",
  "event": "kit_session_completed",
  "distinct_id": "b1c3f0a2-...-random-uuid",
  "properties": {
    "$process_person_profile": false,
    "schema": 1,
    "kit_version": "0.5.0",
    "claude_code_version": "2.1.x",
    "os": "darwin",
    "tracker_type": "jira",
    "tokens_input": 48210,
    "tokens_output": 9134,
    "tokens_cache_read": 120400,
    "tokens_cache_creation": 3300,
    "tokens_total": 181044
  }
}
```

- `distinct_id` — a random UUID generated once and stored at `~/.claude/dev-kit-telemetry-id`. Not derived from your machine, user, or repo. Delete that file to reset it.
- `tracker_type` — the *category* of tracker (jira / linear / github / azure), never the site, project, or instance.
- `tokens_*` — sums parsed from the session transcript's `usage` fields.

## What is NEVER sent

Prompts, responses, code, diffs, file paths, file names, repo names or URLs, ticket keys or contents, commit messages, branch names, emails, usernames, organization names, or the session id. The script reads the transcript **only** to sum token counts and to check whether a kit component ran — it never transmits any content from it.

## For maintainers (running the PostHog project)

- **Set the key before release.** Put your PostHog project API key in `DEFAULT_POSTHOG_KEY` in [`scripts/telemetry.mjs`](./scripts/telemetry.mjs) (replacing `__THEAM_POSTHOG_PROJECT_KEY__`). Until then, telemetry no-ops even if a user opts in. The key is write-only/public, so committing it is expected and safe.
- **Host = EU by default** (`https://eu.i.posthog.com`) to keep data in the EU. Change the default only deliberately.
- **Disable IP capture** in PostHog project settings (*Project → Data collection → Discard client IP data*). PostHog geolocates by request IP by default; an IP plus `installId` is re-identifiable, which would undo anonymity.
- Report only **aggregates** externally (including to Anthropic). Because the data is anonymous by construction, there is no per-user record to delete on request — state that in any privacy notice rather than promising deletion you can't perform.

> Consult counsel before enabling collection for EU users: even anonymous telemetry becomes personal data if it can be re-identified. This kit keeps the payload minimal and the events anonymous specifically to stay on the safe side, but the PostHog project's configuration (IP capture, retention) is where that guarantee is kept or lost.
