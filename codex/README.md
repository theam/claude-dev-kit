# Codex integration

The dev kit runs on **OpenAI Codex** (CLI and the VS Code extension) as well as
Claude Code. This directory holds the Codex-specific wiring; the *content* of the
workflow (skills, instructions) is shared with the Claude side — see
[Shared source](#shared-source).

> **Status: early.** Codex hooks and skills are young and still moving. The paths
> and schemas below follow the current docs but should be validated against your
> installed Codex version before relying on them. Anything that can't be verified
> here is called out.

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

### Hooks (optional, where supported)

On Codex builds where session hooks are enabled and trusted, [`hooks.json`](./hooks.json)
wires `Stop` + `SessionStart` (not `SessionEnd` — Codex caps it at ~1s) to the same
emitter. It's **optional and deduplicated against the sweep** (same per-session id),
so running both is safe. It needs a one-time `/hooks` trust and is inert until then.

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
| Trackers / MCP | plugin + `.claude/` | `~/.codex/config.toml` `[mcp_servers.*]` |
| Session hooks | `hooks/hooks.json` | `~/.codex/hooks.json` |

Both platforms use the same `SKILL.md` front matter (`name` + `description`), so the
same skill file is valid in both. Playbook bodies are kept host-neutral; where a step
is genuinely host-specific it says so rather than assuming Claude Code.
