---
name: dev-kit-setup
description: First-use bootstrap for the dev kit. Detects the team's issue tracker, discovers what it can via MCP/CLI, asks only what cannot be discovered, and persists the result to .claude/dev-kit.json in the consuming repo. Use when that file is missing, when the user asks to set up or reconfigure the kit, or when issue-fetch cannot resolve its configuration.
---

# Dev Kit Setup

Make the kit self-sufficient: detect the tracker, discover everything possible automatically, ask the user only for genuine choices, and persist the result so **nobody on the team has to configure anything again**.

## When to run

- `.claude/dev-kit.json` does not exist (or lacks a `tracker` block) and a kit skill (e.g. `issue-fetch`) needs it.
- The user explicitly asks to set up or reconfigure the kit.
- A stored value turns out to be invalid (e.g. a field ID no longer exists) — re-discover just that value.

## 1. Determine the tracker

Pick `tracker.type` with the least friction:

1. If the triggering reference makes it obvious, use it (`PROJ-1234`/`ENG-42` → Jira/Linear key style; `#123` → GitHub/Azure).
2. Check which backends are actually available: is an Atlassian or Linear MCP authenticated? Is `gh` logged in for this repo? Is Azure DevOps configured?
3. If still ambiguous, **ask the user once** which tracker the team uses: Jira, Linear, GitHub Issues, or Azure DevOps.

Then run the matching discovery below. For any MCP/CLI that is not authenticated, tell the user how to authenticate (`/mcp`, `gh auth login`, `az login`) and stop — never continue with invented values.

## 2. Discover per tracker

### Jira
- **Site**: list accessible sites via the Atlassian MCP — one → use it; several → ask which.
- **Project key**: derive from the triggering ticket prefix and verify it exists; otherwise list projects and ask.
- **Custom fields (auto-detect, no questions)**: resolve field IDs by matching names case-insensitively — Acceptance Criteria ("Acceptance Criteria"/"AC"), Sprint ("Sprint"), Story Points ("Story Points"/"Story point estimate"). If a name matches nothing, inspect a recent issue's custom fields; if still ambiguous, ask once showing the candidates.

### Linear
- **Team**: list teams via the Linear MCP — one → use it; several → ask which. Store its `teamKey`.
- No custom-field discovery needed; acceptance criteria come from the issue body.

### GitHub Issues
- **Repo**: default to the current repo's `origin` (`gh repo view --json nameWithOwner`); confirm if the kit will track issues in a different repo.
- Nothing else to configure.

### Azure DevOps
- **Org and project**: read from the configured Azure DevOps connection or ask once. Store `org` and `project`.

## 3. Persist

Write `.claude/dev-kit.json` at the consuming repo root. Only the active tracker's block is required:

```json
{
  "tracker": {
    "type": "jira",
    "site": "https://<org>.atlassian.net",
    "cloudId": "<discovered-cloud-id>",
    "projectKey": "PROJ",
    "fields": {
      "acceptanceCriteria": "customfield_XXXXX",
      "sprint": "customfield_XXXXX",
      "storyPoints": "customfield_XXXXX"
    },
    "reviewState": null
  },
  "test": {
    "coverageCommands": []
  }
}
```

Shape of `tracker` per type: **jira** → `site`, `cloudId`, `projectKey`, `fields`; **linear** → `teamKey`, optional `workspace`; **github** → `repo` (`owner/name`, optional if same as origin); **azure** → `org`, `project`. `reviewState` is filled the first time `issue-update` transitions an item, then reused. `test.coverageCommands` is optional — `coverage-check` fills it in when it detects the repo's coverage command.

- This file contains **no secrets** (auth lives in each developer's MCP OAuth grant or CLI login) — it is safe and intended to be committed, so one setup serves the whole team.
- Tell the user the file was created and suggest committing it.

## 4. Design tool (optional)

Figma needs no configuration — file keys come from URLs, auth is the MCP OAuth. Verify authentication lazily, only when a Figma URL first appears.

## 5. Telemetry (optional, opt-in, off by default)

Do not enable or configure telemetry here, and never turn it on silently. If the user asks about it, point them to `TELEMETRY.md` and the plugin's `telemetry_enabled` option (set per developer). Absent an explicit opt-in, it stays off.

An organisation that wants its usage attributed to it (company-level) may set a self-declared label in `.claude/dev-kit.json`:

```json
{ "telemetry": { "org": "acme-corp" } }
```

This is optional, organisation-level (not per-person), and only ever set deliberately by the team — never derive it from a git email, commit author, or remote URL. Only add it if the user explicitly asks for company attribution.

## After setup

Continue seamlessly with whatever task triggered the bootstrap (e.g. proceed with the `issue-fetch` that was interrupted). Setup must feel like a one-time speed bump, not a separate ceremony.
