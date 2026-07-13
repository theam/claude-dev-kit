---
name: demo-recording
description: Record a short video of the delivered user flow with Playwright, convert it to an embeddable GIF, commit it to the PR branch, and reference it from the PR body and the Jira comment. Use as the optional last delivery step for user-facing stories, or when the user asks for a demo recording of a flow.
---

# Demo Recording

A reviewer (or a product owner) should be able to SEE the delivered behavior without booting anything. Record the story's happy path, embed it in the PR.

## When to run

- After all gates pass and before/right after `create-pr`, for stories with a user-facing flow.
- Skip silently-NOT: if recording is not feasible (no UI change, no ffmpeg, flaky flow), say so in the PR notes instead of pretending.

## Steps

### 1. Record with Playwright

Re-run ONLY the story's happy-path e2e spec with video enabled. The consuming repo's Playwright config must support `PW_VIDEO=on` (see note below):

```bash
PW_VIDEO=on npx playwright test <the-story-spec> -g "<happy path test name>"
```

Videos land in `test-results/**/video.webm`. Pick the one for the happy-path scenario — a good demo is **5–20 seconds** and shows the acceptance criteria happening.

### 2. Convert to GIF (inline-embeddable on GitHub)

```bash
ffmpeg -y -i <video.webm> -vf "fps=8,scale=960:-1:flags=lanczos" -loop 0 docs/demos/<TICKET-KEY>.gif
```

- Target **< 8 MB** (GitHub renders it inline). If too big: lower fps to 6, scale to 800, or trim with `-ss`/`-t`.
- No ffmpeg available? Commit the raw `.webm` under `docs/demos/` and link it (it will download rather than play inline) — and note the limitation.

### 3. Commit to the PR branch and embed

1. Commit `docs/demos/<TICKET-KEY>.gif` to the story branch and push.
2. Add to the PR body, right under the Summary:
   ```markdown
   ### Demo
   ![<TICKET-KEY> demo](https://raw.githubusercontent.com/<org>/<repo>/<branch>/docs/demos/<TICKET-KEY>.gif)
   ```
3. In the Jira delivery comment (`jira-update`), add one line: `Demo recording: <link to the GIF on the PR branch>` (the Atlassian MCP cannot upload attachments — link, don't pretend to attach).

## Consuming-repo requirement

The repo's `playwright.config.ts` must map an env var to video recording:

```ts
use: {
  video: process.env.PW_VIDEO === 'on' ? 'on' : 'off',
  ...
}
```

If the config lacks it, add it as part of the story (one line, off by default — zero effect on normal runs).

## Rules

- The GIF shows the REAL flow from the e2e run — never a staged screen recording.
- One recording per story: the happy path. More scenarios only if the user asks.
- The demo never substitutes evidence: gates and their numbers stay in the PR as always.
