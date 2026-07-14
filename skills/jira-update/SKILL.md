---
name: jira-update
description: Update the Jira ticket after delivery work - comment the PR link and verification evidence, and transition the ticket to the team's review status. Use right after a PR is created for a story, or when the user asks to update/move a ticket.
---

# Jira Update

Close the loop: after the code ships, the ticket must reflect it without anyone touching Jira by hand.

## Preconditions

- `.claude/dev-kit.json` exists (otherwise run `dev-kit-setup` first).
- The Atlassian MCP is authenticated (otherwise tell the user to run `/mcp` and stop).
- A PR URL and a product-facing summary of the delivered work are available from the delivery flow.

## Steps

### 1. Comment the delivery summary on the ticket

**Audience: product owners and other non-technical readers.** The Jira comment explains what was delivered and why, in user terms — no test counts, coverage percentages, lint, or tooling jargon. All technical evidence lives in the PR, which is linked.

Add a comment via the Atlassian MCP containing:

```
Pull request: <PR URL>

What was delivered:
- <the new behavior, described as a user would experience it — one bullet per acceptance criterion addressed>

Decisions taken:
- <each meaningful decision or interpretation made during implementation, in plain language, with the reason — e.g. "The filters are kept in the page address, so a filtered view can be shared by copying the link">

Out of scope / follow-ups:
- <anything deliberately left out or worth a future ticket, or "Nothing pending.">
```

If a demo recording was attached to the ticket (`demo-recording` skill), add one line: `Demo recording attached: <TICKET-KEY>.gif`.

Keep it factual and grounded in what was actually built — never a template filled with assumptions. If an acceptance criterion was NOT met, say so here plainly.

### 2. Ensure the ticket has a named owner

Every issue carries a named owner: if the ticket has no assignee, assign it to the current user (look up their account via the MCP). Agents act on a person's behalf — the ticket must always show whose behalf that is.

### 3. Transition the ticket to review

1. Fetch the available transitions for the ticket via the MCP (transition IDs vary per tenant and workflow — **never hardcode them**).
2. Pick the transition whose target status matches, in order of preference: a status named like "In Review" / "Code Review" / "Review"; otherwise ask the user which transition to use and remember the choice by persisting it under `jira.transitions.review` in `.claude/dev-kit.json`.
3. Apply the transition.

### 4. Report

Tell the user, explicitly and always covering all three: comment posted (link), **owner ensured (who — or why it could not be assigned)**, and transition applied (from → to). Anything that could not be done gets a reason — no step is ever skipped silently.

## Failure handling

- No matching transition (workflow differs): list the available ones and ask once; persist the answer.
- No permission to transition: report it explicitly — do not silently skip.
- The comment must be posted even if the transition fails.
