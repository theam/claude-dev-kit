---
name: follow-ups
description: Turn the loose ends a finished story leaves — out-of-scope notes, deferred review findings, deliberate TODOs — into tracked follow-up work items in the team's tracker, linked to the source story, after approval. Supports Jira, Linear, GitHub Issues, and Azure DevOps via adapters. Use at the end of a story, or when the user asks to track follow-ups.
---

# Follow-ups

Close the loop: when a story finishes, the loose ends it surfaced should be **tracked**, not just described in the PR body. This skill turns them into real work items in the configured tracker, **linked back to the source story** — created only after approval. It's the tracking counterpart to the "Out of scope / follow-ups" section `create-pr` already writes.

## Preconditions

- `.claude/dev-kit.json` exists with a `tracker` block (otherwise run `dev-kit-setup` first).
- The adapter's backend is authenticated (MCP connector authorized, or `gh`/`az` logged in) — otherwise tell the user how to authenticate and stop.
- The **source story key** (the item just delivered) is known, for linking. If unknown, ask once.

## 1. Gather the loose ends — only real ones

Collect follow-ups from the story just finished, from where they were already surfaced:
- the **"Out of scope / follow-ups"** list in the `create-pr` PR body,
- **deferred review findings** from `fix-pr` / `pr-review` (the "defer to a tracked issue" bucket),
- deliberate **TODOs / known gaps** the implementation left.

**Never invent follow-ups.** If there are none, say so and stop — don't pad a backlog to look thorough.

## 2. Propose — WAIT FOR APPROVAL

For each loose end, propose a work item:
- **Type**: default **Task**; use a **User Story** when it's a user-facing increment (ask if unsure).
- **Title** + a one-line description + **why** (the context from the story that produced it).
- **Link** to the source story (and its epic/parent when there is one) for traceability.
- A sizing hint or label when the team uses them (discover, don't assume).

Present the full list and **wait for explicit approval**; the user may edit or drop items. **Create nothing until approved.**

## 3. Create — via the tracker's write adapter

Create each approved item and link it to the source story. Verify writes by read-back where the CLI can silently no-op.

### Jira (`type: "jira"`) — Atlassian MCP
`createJiraIssue` for each item (project, type, summary, description, labels); link to the source with `createIssueLink` ("Relates to", or a sub-task under the story when appropriate).

### Linear (`type: "linear"`) — Linear MCP
Create the issue under the team; relate it to the source (relation or sub-issue); set labels/estimate.

### GitHub Issues (`type: "github"`) — `gh`
`gh issue create --repo <owner/name> --title <t> --body-file - --label <type>`, referencing the source in the body (`Follow-up of #<n>` / a task-list link). **Verify by read-back** (`gh issue view --json labels`) and apply labels via REST on a miss (classic-Projects orgs can silently no-op).

### Azure DevOps (`type: "azure"`) — `az boards` / MCP
`az boards work-item create --type "Task|User Story" ...`; link to the source with `az boards work-item relation add` (Related / Parent).

## 4. Report

List each created item with its key/URL, and record them where the story lives — add a **"Follow-ups tracked: `<keys>`"** line to the PR and/or the tracker comment so the trail is visible. On partial failure, report exactly what was created and what wasn't.

## Guardrails

- **Never create anything before approval.**
- **Only genuine loose ends** from the work — no fabricated backlog.
- **Always link** to the source story for traceability.
- Watch for secrets/PII in the source material; don't copy them into tickets.
