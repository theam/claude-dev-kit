# Codex integration

The dev kit runs on **OpenAI Codex** (CLI + desktop app) as a **native Codex plugin**.
Codex's plugin system is parallel to Claude Code's, so this repo doubles as a Codex
marketplace — [`.agents/plugins/marketplace.json`](../.agents/plugins/marketplace.json)
lists [`plugins/fullstack-dev-kit/`](../plugins/fullstack-dev-kit/), whose `skills/` are
generated from the canonical top-level `skills/` by
[`scripts/build-codex-plugin.mjs`](../scripts/build-codex-plugin.mjs) (one source of truth).

## Install

```bash
codex plugin marketplace add theam/claude-dev-kit
codex plugin add fullstack-dev-kit@claude-dev-kit
```

The `create-dev-kit` wizard runs this for whichever of Claude Code / Codex it detects,
plus registers the MCP your tracker choice needs and schedules the telemetry sweep.
Then **restart Codex** and invoke a skill (e.g. `$pr-review`) — Codex has its own
built-in review, so invoke the kit's explicitly.

*Validated against real **codex-cli 0.147**: `marketplace add` + `plugin add` install and
enable the plugin; the telemetry parser + sweep are confirmed on a real rollout. In-app
skill invocation and MCP OAuth are still yours to confirm on your build.*

## Connectors / MCP (from your wizard choices)

`issue-fetch` reads tickets through Codex's connector for your tracker. **The easiest
way is to just ask the kit** — *"connect my Jira"* / *"set up the Atlassian connector"* —
and it installs the right one for you (you complete the one sign-in). Codex ships
**curated connectors** (native OAuth); the wizard installs the matching one and you
authenticate with a click **in the Codex app** (Plugins → the connector → sign in):

- **Jira → `atlassian-rovo@openai-curated`** (Jira + Confluence)
- **Linear → `linear@openai-curated`**
- **Figma → `figma@openai-curated`** (if you use design links)
- **GitHub Issues / Azure DevOps** use their CLIs (`gh` / `az`) — no connector.

Install by hand if you skip the wizard: `codex plugin add atlassian-rovo@openai-curated`,
then authenticate in the app. (A raw `codex mcp add <name> --url <url>` also works if you
prefer to point at an MCP endpoint directly.)

## What works the same as Claude Code

- **Telemetry** — one script (`scripts/telemetry.mjs`) serves both hosts. On Codex
  it is invoked with `--agent codex`; it reads token totals from Codex's session
  **rollout JSONL**, derives the surface (CLI vs VS Code) from
  `CODEX_INTERNAL_ORIGINATOR_OVERRIDE`, and sends the same anonymous, opt-in event
  to the same relay, tagged `agent: codex`. Consent, install id, org, dedup and the
  outbox all live in `~/.claude/dev-kit-telemetry/` and are **shared** across both
  hosts, so a user configures them once.
- **Shared workflow content** — the `SKILL.md` playbooks and instruction docs are
  the same files; only their location and invocation differ per host.

## Telemetry delivery — a background sweep (primary)

Codex session **hooks** are the obvious trigger, but on the **Codex desktop app**
(codex-cli ~0.147-alpha) they are behind a feature flag with no `/hooks` trust
command — so we don't rely on them. Instead the primary, deployment-robust delivery
is a **scheduled sweep** (`scripts/telemetry.mjs --sweep`):

- It scans `~/.codex/sessions/**/rollout-*.jsonl`, and for each **completed** session
  (idle ≥ 10 min) **where the kit ran**, it reads token totals from the last
  cumulative `token_count` and sends one anonymous event tagged `agent: codex`
  (surface from the rollout's `session_meta.source`).
- A **watermark** advances only past sessions old enough to be done, so active
  sessions are never sent early and finished ones are never re-scanned; a per-session
  dedup sentinel guarantees at-most-once.
- **No history backfill:** the first run just sets a baseline — telemetry starts when
  you opt in, not retroactively.
- It **no-ops without consent** (`~/.claude/dev-kit-telemetry/config.json`).

The installer registers it as a **launchd agent** on macOS
([`dev-kit-codex-sweep.plist`](./dev-kit-codex-sweep.plist), every 15 min). On other
OSes, schedule `node <kit>/scripts/telemetry.mjs --sweep` via cron/systemd.

### Why not session hooks?

Codex has a session-hooks system, but it's **feature-flagged on the current desktop app**
(no `/hooks` trust command surfaced) and its on-disk config format is version-specific and
still moving. Rather than ship an unverified hook config, the kit delivers telemetry via the
**sweep** above — it's hook-independent and works today. If a future Codex build exposes
stable, trustable hooks, they could emit the same event (deduplicated against the sweep by
the per-session id); until then we don't bundle a hooks file.

### Manual install (equivalent to what the wizard does)

```bash
# macOS: register the sweep agent (anonymous, opt-in, no-ops without consent)
sed -e "s#{{NODE}}#$(command -v node)#g" \
    -e "s#{{DEVKIT_ROOT}}#/absolute/path/to/claude-dev-kit#g" \
    codex/dev-kit-codex-sweep.plist > ~/Library/LaunchAgents/com.theagilemonkeys.dev-kit.codex-sweep.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.theagilemonkeys.dev-kit.codex-sweep.plist
```

Opt out any time with `DEVKIT_TELEMETRY=0`, or by setting `consent` to `denied` in
`~/.claude/dev-kit-telemetry/config.json`. Full details: [../TELEMETRY.md](../TELEMETRY.md).

## Shared source

The workflow playbooks are authored once and materialized into each host's expected
layout:

| Content | Claude Code | Codex |
| --- | --- | --- |
| Skills (`SKILL.md`) | `skills/<name>/` | `~/.codex/skills/<name>/` (desktop app; some CLI builds use `~/.agents/skills/`) |
| Project instructions | `CLAUDE.md` | `AGENTS.md` (CLAUDE.md can `@import` it) |
| Trackers / MCP | plugin + `.claude/` | curated connectors / `~/.codex/config.toml` `[mcp_servers.*]` |
| Telemetry | `hooks/hooks.json` (auto) | background sweep (launchd) — hooks feature-flagged on the app |

Both platforms use the same `SKILL.md` front matter (`name` + `description`), so the
same skill file is valid in both. Playbook bodies are kept host-neutral; where a step
is genuinely host-specific it says so rather than assuming Claude Code.
