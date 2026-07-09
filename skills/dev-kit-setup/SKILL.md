---
name: dev-kit-setup
description: First-use bootstrap for the dev kit. Discovers the Jira site, project key, and custom field IDs via the Atlassian MCP, asks only what cannot be discovered, and persists the result to .claude/dev-kit.json in the consuming repo. Use when that file is missing, when the user asks to set up or reconfigure the kit, or when jira-fetch cannot resolve its configuration.
---

# Dev Kit Setup

Make the kit self-sufficient: discover everything possible through the Atlassian MCP, ask the user only for genuine choices, and persist the result so **nobody on the team has to configure anything again**.

## When to run

- `.claude/dev-kit.json` does not exist in the consuming repo, and a kit skill (e.g. `jira-fetch`) needs it.
- The user explicitly asks to set up or reconfigure the kit.
- A stored value turns out to be invalid (e.g. field ID no longer exists) — re-discover just that value.

## Discovery flow

1. **Check MCP auth.** If the Atlassian MCP is not authenticated, tell the user to run `/mcp` and complete the OAuth flow, then stop. Never continue with invented values.
2. **Jira site.** List the accessible sites/resources via the MCP.
   - Exactly one → use it silently.
   - Several → ask the user which one this repo belongs to.
3. **Project key.**
   - If setup was triggered by a ticket request (e.g. `PROJ-1234`), derive the key from the prefix and verify the project exists on the chosen site.
   - Otherwise list the site's projects and ask the user to pick.
4. **Custom fields (auto-detect, no questions).** Fetch the field metadata for the project and resolve IDs by matching field names, case-insensitively:
   - Acceptance criteria: a field named like "Acceptance Criteria" / "AC"
   - Sprint: the field named "Sprint"
   - Story points: "Story Points" / "Story point estimate"
   - If a name matches nothing, fetch one recent issue of the project and inspect which custom fields carry that kind of content; if still ambiguous, ask the user once, showing the candidates found.
5. **Figma.** Nothing to configure — file keys come from URLs and auth is the MCP OAuth. Only verify authentication lazily, when a Figma URL first appears.

## Persist

Write the result to `.claude/dev-kit.json` at the consuming repo root:

```json
{
  "jira": {
    "site": "https://<org>.atlassian.net",
    "cloudId": "<discovered-cloud-id>",
    "projectKey": "PROJ",
    "fields": {
      "acceptanceCriteria": "customfield_XXXXX",
      "sprint": "customfield_XXXXX",
      "storyPoints": "customfield_XXXXX"
    }
  }
}
```

- This file contains **no secrets** (auth lives in each developer's MCP OAuth grant) — it is safe and intended to be committed, so one setup serves the whole team.
- Tell the user the file was created and suggest committing it.

## After setup

Continue seamlessly with whatever task triggered the bootstrap (e.g. proceed with the `jira-fetch` that was interrupted). Setup must feel like a one-time speed bump, not a separate ceremony.
