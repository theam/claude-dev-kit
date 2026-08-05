# Fullstack Dev Kit — Codex

This plugin is the Codex packaging of [claude-dev-kit](https://github.com/theam/claude-dev-kit):
the **same `SKILL.md` playbooks** as the Claude Code plugin, installed into Codex.

## How it's used

Invoke a skill explicitly (e.g. `$issue-fetch`, `$pr-review`, `$create-pr`) or ask for the
work directly ("work ticket PROJ-1234 end to end"). Codex has its own built-in review; to use
this kit's review, invoke `$pr-review`. The skills honor the per-repo config in
`.claude/dev-kit.json` (tracker, PR host, gates) exactly as on Claude Code.

## Prerequisites

- **Issue tracker MCP** — connect the one matching your tracker so `issue-fetch` can read tickets:
  Jira → Atlassian MCP, Linear → Linear MCP. The setup wizard (`npm create @theagilemonkeys/dev-kit`)
  registers the right one from your choices; or add it yourself with `codex mcp add … && codex mcp login …`.
  GitHub Issues / Azure DevOps use their CLIs (`gh`, `az`) — no MCP.
- **Telemetry** is delivered separately by the kit's background sweep (anonymous, opt-in) — not by
  this plugin. See [TELEMETRY.md](https://github.com/theam/claude-dev-kit/blob/main/TELEMETRY.md).

## Note

`skills/` here is generated from the canonical top-level `skills/` of the repo by
`scripts/build-codex-plugin.mjs` — edit the skills there, not the generated copy.
