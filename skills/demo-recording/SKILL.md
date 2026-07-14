---
name: demo-recording
description: Record a short video of the delivered user flow with Playwright, convert it to a GIF, attach it to the Jira ticket, and link it from the PR. Use as the optional last delivery step for user-facing stories, or when the user asks for a demo recording of a flow.
---

# Demo Recording

A reviewer (or a product owner) should be able to SEE the delivered behavior without booting anything. Record the story's happy path and put it where people will look: **attached to the Jira ticket**, linked from the PR.

## When to run

- After all gates pass and after `create-pr`, for stories with a user-facing flow.
- Never skip silently: if recording is not feasible (no UI change, no ffmpeg, flaky flow, no Jira token), say exactly why in the PR notes and the final report.

## Steps

### 1. Record with Playwright

Re-run ONLY the story's happy-path e2e spec with video enabled (the consuming repo's Playwright config must map `PW_VIDEO=on` to video recording — add that one line as part of the story if missing):

```bash
PW_VIDEO=on npx playwright test <the-story-spec> -g "<happy path test name>"
```

Videos land in `test-results/**/video.webm`. A good demo is **5–20 seconds** and shows the acceptance criteria happening.

### 2. Convert to GIF

```bash
ffmpeg -y -i <video.webm> -vf "fps=8,scale=960:-1:flags=lanczos" -loop 0 <TICKET-KEY>.gif
```

Target **< 8 MB** (lower fps/scale or trim with `-ss`/`-t` if bigger).

### 3. Hand the GIF to the user for a drag-and-drop attach (default)

The Atlassian MCP cannot upload attachments, and GitHub renders private-repo images only when uploaded through its UI — so the reliable, zero-credential path is a 5-second manual drag:

1. Save the GIF at a predictable place: `docs/demos/<TICKET-KEY>.gif` (also commit it to the PR branch so it travels with the code).
2. Reveal it for the user: `open -R docs/demos/<TICKET-KEY>.gif` (macOS Finder; on other platforms print the absolute path).
3. In the final report, give one explicit instruction:
   > **Demo GIF ready at `<absolute path>` — drag it into the Jira ticket (attaches it) and/or into a PR comment (renders inline even on private repos).**

The `jira-update` delivery comment says: `Demo recording: see attached <TICKET-KEY>.gif` only AFTER the user confirms they attached it — otherwise it links the committed file on the branch instead. Never claim an attachment that does not exist.

**Optional automation:** if the repo's git-ignored `.env` defines `JIRA_USERNAME` and `JIRA_API_TOKEN`, attach automatically via REST instead of asking for the drag:

```bash
curl -sS -X POST -u "$JIRA_USERNAME:$JIRA_API_TOKEN" \
  -H "X-Atlassian-Token: no-check" -F "file=@docs/demos/<TICKET-KEY>.gif" \
  "<site>/rest/api/3/issue/<TICKET-KEY>/attachments"
```

### 4. Link from the PR

Add under the PR Summary:

```markdown
### Demo
Demo recording: attached to [<TICKET-KEY>](<site>/browse/<TICKET-KEY>) (<TICKET-KEY>.gif)
```

Only embed an inline image in the PR body if the repo is **public** (`gh repo view --json isPrivate`): private-repo `raw.githubusercontent` images do not render for viewers. For private repos, link — never embed a broken image.

## Rules

- The GIF shows the REAL flow from the e2e run — never a staged screen recording.
- One recording per story: the happy path. More scenarios only if the user asks.
- The demo never substitutes evidence: gates and their numbers stay in the PR as always.
