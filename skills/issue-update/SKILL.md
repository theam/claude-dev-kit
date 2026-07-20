---
name: issue-update
description: Update the work item after delivery - comment the PR link and a product-facing summary, and transition it to the team's review status. Supports Jira, Linear, GitHub Issues, and Azure DevOps via adapters. Use right after a PR is created for a story, or when the user asks to update/move a ticket.
---

# Issue Update

Close the loop: after the code ships, the tracker must reflect it without anyone updating it by hand. This skill speaks to whichever tracker is configured in `.claude/dev-kit.json` (`tracker.type`).

## Preconditions

- `.claude/dev-kit.json` exists with a `tracker` block (otherwise run `dev-kit-setup` first).
- The adapter's backend is authenticated (MCP connector authorized, or `gh`/`az` logged in) — otherwise tell the user how to authenticate and stop.
- A PR URL and a product-facing summary of the delivered work are available from the delivery flow.

## 1. Comment the delivery summary

**Audience: product owners and other non-technical readers.** The comment explains what was delivered and why, in user terms — no test counts, coverage percentages, lint, or tooling jargon. All technical evidence lives in the PR, which is linked.

Post a comment (via the adapter below) containing:

```
Pull request: <PR URL>

What was delivered:
- <the new behavior, described as a user would experience it — one bullet per acceptance criterion addressed>

Decisions taken:
- <each meaningful decision or interpretation made during implementation, in plain language, with the reason>

Out of scope / follow-ups:
- <anything deliberately left out or worth a future ticket, or "Nothing pending.">
```

Keep it factual and grounded in what was actually built — never a template filled with assumptions. If an acceptance criterion was NOT met, say so here plainly.

## 2. Ensure the item has a named owner

Every item carries a named owner: if it has no assignee, assign it to the current user. Agents act on a person's behalf — the item must always show whose behalf that is. (Skip only for trackers/flows where assignment is not applicable, and say so.)

## 3. Transition to review

Move the item to the team's review status. **Never hardcode transition/state IDs** — discover the available ones and pick the target named like "In Review" / "Code Review" / "Review"; if none matches, ask the user once and persist the choice under `tracker.reviewState` in `.claude/dev-kit.json`.

## Adapters

### Jira (`type: "jira"`)
- Comment and assign via the **Atlassian MCP**.
- Transition: fetch available transitions via the MCP (IDs vary per tenant), pick/persist the review transition under `tracker.reviewState`.

### Linear (`type: "linear"`)
- Comment and assign via the **Linear MCP**.
- Transition: set the issue's workflow state to the team's review state (discover states via the MCP; persist the chosen state id).

### GitHub Issues (`type: "github"`)
- Comment: `gh issue comment <number> --repo <owner/name> --body-file -`.
- Owner: `gh issue edit <number> --add-assignee @me` if unassigned.
- "Review status": GitHub issues have no workflow states — apply the label the team uses (e.g. `in-review`) via `gh issue edit --add-label`, and/or move it in the project board if one is configured. Persist the label under `tracker.reviewState`.

### Azure DevOps (`type: "azure"`)
- Comment and assign via the Azure DevOps MCP or REST / `az boards`.
- Transition: set `System.State` to the team's review state (discover valid states for the work-item type; persist under `tracker.reviewState`).

## 4. Report

Tell the user, explicitly and always covering all three: comment posted (link), **owner ensured (who — or why it could not be assigned)**, and transition applied (from → to). Anything that could not be done gets a reason — no step is ever skipped silently.

## Failure handling

- No matching review state (workflow differs): list the available ones and ask once; persist the answer.
- No permission to transition: report it explicitly — do not silently skip.
- The comment must be posted even if the transition fails.
