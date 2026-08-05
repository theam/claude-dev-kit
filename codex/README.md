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

## Telemetry wiring (`hooks.json`)

Codex reads hooks from `~/.codex/hooks.json` (or inline `[[hooks.EventName]]` in
`~/.codex/config.toml`). [`hooks.json`](./hooks.json) is the template the installer
copies to `~/.codex/hooks.json`, replacing `{{DEVKIT_ROOT}}` with the absolute kit
path.

Two deliberate choices:

1. **We wire `Stop` + `SessionStart`, not `SessionEnd`.** Codex caps `SessionEnd`
   at ~1 second — too short for a network send. So `Stop` writes a cheap per-session
   marker (no network) and `SessionStart` flushes stale markers from prior sessions
   (the outbox pattern). Delivery happens on the next Codex start after the 10-minute
   stale window — identical to how the Claude Desktop path already behaves.
2. **Hooks require one-time trust.** Unlike Claude Code, Codex will not run a
   freshly-installed hook until the user reviews and trusts it with the `/hooks`
   command. The installer places the hook but **cannot** auto-trust it — the user
   must run `/hooks` once. (Enterprises can instead ship it as a managed hook via
   `requirements.toml`.)

### Manual install (equivalent to what the wizard does)

```bash
# 1. Point the hook at your kit checkout / install
mkdir -p ~/.codex
sed "s#{{DEVKIT_ROOT}}#/absolute/path/to/claude-dev-kit#g" \
  codex/hooks.json > ~/.codex/hooks.json

# 2. In a Codex session, trust the hook once
/hooks
```

Opt out any time with `DEVKIT_TELEMETRY=0`, or by setting `consent` to `denied` in
`~/.claude/dev-kit-telemetry/config.json`. Full details: [../TELEMETRY.md](../TELEMETRY.md).

## Shared source

The workflow playbooks are authored once and materialized into each host's expected
layout:

| Content | Claude Code | Codex |
| --- | --- | --- |
| Skills (`SKILL.md`) | `skills/<name>/` | `~/.agents/skills/<name>/` |
| Project instructions | `CLAUDE.md` | `AGENTS.md` (CLAUDE.md can `@import` it) |
| Trackers / MCP | plugin + `.claude/` | `~/.codex/config.toml` `[mcp_servers.*]` |
| Session hooks | `hooks/hooks.json` | `~/.codex/hooks.json` |

Both platforms use the same `SKILL.md` front matter (`name` + `description`), so the
same skill file is valid in both. Playbook bodies are kept host-neutral; where a step
is genuinely host-specific it says so rather than assuming Claude Code.
