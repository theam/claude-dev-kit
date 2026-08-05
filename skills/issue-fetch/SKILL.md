---
name: issue-fetch
description: Fetch a work item (summary, status, description, acceptance criteria, comments) from the team's issue tracker and display a clean summary. Supports Jira, Linear, GitHub Issues, and Azure DevOps via adapters. Use whenever a prompt contains an issue reference (e.g. PROJ-1234, ENG-42, #123) or the user asks to work on a user story.
---

# Issue Fetch

Fetch full context for a work item before any planning or implementation begins. The tracker is configured once (see below); this skill speaks to whichever one the team uses.

## Trigger

Any prompt containing an issue reference, or an explicit request to fetch/work on a story. Reference shapes differ by tracker:

| Tracker | Key shape | Example |
|---|---|---|
| Jira | `[A-Z][A-Z0-9]+-\d+` | `PROJ-1234` |
| Linear | `[A-Z]+-\d+` | `ENG-42` |
| GitHub Issues | `#\d+` or `owner/repo#\d+` | `#123` |
| Azure DevOps | `#?\d+` (work item id) | `#4567` |

## Project configuration

Read `.claude/dev-kit.json` at the consuming repo root. The `tracker` block names the active adapter and its settings:

```json
{ "tracker": { "type": "jira" | "linear" | "github" | "azure", ... } }
```

**If the file does not exist (or has no `tracker` block), run the `dev-kit-setup` skill first** — it detects the tracker, gathers what it needs, persists the file, and returns here. Do not ask the user for values that setup can discover.

If the requested key's project/prefix does not match the configured one, confirm with the user before fetching (it may be a cross-project item — allowed, just not silently).

## Adapters — how to fetch

Use the adapter matching `tracker.type`. In every case request at minimum: **summary/title, type, status, priority, assignee, reporter, labels, description, acceptance criteria, and all comments** (plus story points and sprint/cycle when the tracker has them).

### Jira (`type: "jira"`)
Config: `site`, `cloudId`, `projectKey`, `fields` (custom field IDs for acceptance criteria / sprint / story points).
Use the **Atlassian MCP** tools against the configured site to get the issue and its comments, reading acceptance criteria via the configured field IDs.
- If a configured field ID turns out to be invalid, re-run `dev-kit-setup` discovery for that field and update the config.

### Linear (`type: "linear"`)
Config: `teamKey` (and optionally `workspace`).
Use the **Linear MCP** tools to fetch the issue by identifier, its description, labels, state, assignee, and comments. Acceptance criteria usually live in the description body or a checklist — extract them from there.

### GitHub Issues (`type: "github"`)
Config: `repo` (`owner/name`); defaults to the current repo's `origin` when omitted.
Fetch with the GitHub CLI (no MCP needed):
```bash
gh issue view <number> --repo <owner/name> --json number,title,state,labels,assignees,body,comments
```
Acceptance criteria are parsed from the issue body (task lists / a "Acceptance criteria" section).

### Azure DevOps (`type: "azure"`)
Config: `org`, `project`.
Fetch via the Azure DevOps MCP if configured, otherwise the REST API / `az boards work-item show --id <id>`. Map fields: `System.Title`, `System.State`, `System.Description`, `Microsoft.VSTS.Common.AcceptanceCriteria`, and the work-item comments.

## Authentication

If the adapter's backend is not authenticated (MCP connector not authorized, `gh`/`az` not logged in), tell the user exactly how to authenticate — MCP connectors via `/mcp` or claude.ai connector settings; CLIs via `gh auth login` / `az login` — and stop. **Never invent ticket content.**

## Output format

Display a concise summary before doing anything else:

```
===== KEY =====
Summary  : ...
Type     : ...
Status   : ...
Priority : ...
Assignee : ...
Points   : ...        (omit if the tracker has no such field)
Sprint   : ...        (omit if the tracker has no such field)
Labels   : ...

--- Description ---
...

--- Acceptance Criteria ---
...

--- Comments (N) ---
[date] author: ...
```

## After fetching

1. If the description or comments contain a **Figma URL** (`figma.com/(design|file)/...`), invoke the `figma-fetch` skill next.
2. Present an **implementation plan** and **wait for explicit user approval** before writing any code (see the issue-to-PR workflow). Never skip this gate unless the caller explicitly says the plan is pre-approved.
