---
description: Create a dedicated worktree for a story and open a new VS Code window on it, ready to run the pipeline. Usage - /launch-story PROJ-1234
---

Prepare a dedicated workspace for the Jira story given in the arguments: $ARGUMENTS

You are the launcher — you do NOT work the story yourself. Steps:

1. **Validate** the ticket key (`[A-Z][A-Z0-9]+-\d+`); if missing, ask — do not guess.

2. **Create the worktree** (from the repo root, using a short slug from the ticket key):
   ```bash
   git worktree add ../<repo-name>-<TICKET-KEY> -b feat/<TICKET-KEY>-story
   ```
   If the worktree or branch already exists, reuse it and say so.

3. **Open the window**: `code <worktree-path>`. If the `code` CLI is unavailable, tell the user to open the folder manually.

4. **Report** the worktree path and branch, and give the user the exact next step to run in the NEW window's Claude session, ready to copy:
   ```
   /fullstack-dev-kit:work-story <TICKET-KEY>
   ```
   Also remind them: when the PR is merged, remove the worktree with `git worktree remove <path>`.

Do not start the pipeline in THIS conversation — the new window owns the story end to end.
