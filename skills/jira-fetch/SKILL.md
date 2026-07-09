---
name: jira-fetch
description: Fetch a Jira issue (summary, status, description, acceptance criteria, comments) and display a clean summary. Use whenever a prompt contains a Jira ticket reference (e.g. PROJ-1234) or the user asks to work on a user story.
---

# Jira Fetch

Fetch full context for a Jira issue before any planning or implementation begins.

## Trigger

Any prompt containing a Jira ticket key matching `[A-Z][A-Z0-9]+-\d+` (e.g. `PROJ-1234`), or an explicit request to fetch/work on a story.

## Project configuration

Read `.claude/dev-kit.json` at the consuming repo root for the Jira site, project key, and custom field IDs (acceptance criteria, sprint, story points).

**If the file does not exist, run the `dev-kit-setup` skill first** — it discovers everything via the Atlassian MCP, persists the file, and returns here. Do not ask the user for values that setup can discover.

## How to fetch

Use the **Atlassian MCP** tools against the configured site to get the issue and its comments. Request at minimum: summary, issue type, status, priority, assignee, reporter, story points, sprint, labels, description, acceptance criteria (using the configured field IDs), and all comments.

- If the MCP server is not authenticated, tell the user to authorize the Atlassian connector (via `/mcp` or their claude.ai connector settings) and stop. Do not invent ticket content.
- If the requested key's prefix does not match the configured project key, confirm with the user before fetching (it may be a cross-project ticket — that is allowed, just not silently).
- If a configured field ID turns out to be invalid, re-run `dev-kit-setup` discovery for that field and update the config.

## Output format

Display a concise summary before doing anything else:

```
===== KEY =====
Summary  : ...
Type     : ...
Status   : ...
Priority : ...
Assignee : ...
Points   : ...
Sprint   : ...
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
2. Present an **implementation plan** and **wait for explicit user approval** before writing any code (see the coding-agent workflow). Never skip this gate unless the caller explicitly says the plan is pre-approved.
