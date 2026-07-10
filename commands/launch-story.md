---
description: Open a new VS Code window on a dedicated worktree where the story pipeline starts automatically. Usage - /launch-story PROJ-1234 [--auto-approve]
---

Launch a self-starting workspace for the Jira story given in the arguments: $ARGUMENTS

You are the launcher — you do NOT work the story yourself. Steps:

1. **Validate** the ticket key (`[A-Z][A-Z0-9]+-\d+`); if missing, ask — do not guess.

2. **Create the worktree** (from the repo root, using a short slug from the ticket key):
   ```bash
   git worktree add ../<repo-name>-<TICKET-KEY> -b feat/<TICKET-KEY>-story
   ```
   If the worktree or branch already exists, reuse it and say so.

3. **Plant the autostart task** inside the worktree at `.vscode/tasks.json`:
   ```json
   {
     "version": "2.0.0",
     "tasks": [
       {
         "label": "work-story <TICKET-KEY>",
         "type": "shell",
         "command": "claude \"/fullstack-dev-kit:work-story <TICKET-KEY> --in-place<extra-flags>\"",
         "runOptions": { "runOn": "folderOpen" },
         "presentation": { "focus": true, "panel": "dedicated" }
       }
     ]
   }
   ```
   - Pass through `--auto-approve` into `<extra-flags>` only if it was in the arguments.
   - Keep this file out of the story's commits: append `.vscode/` to the repo's local exclude file (`$(git rev-parse --path-format=absolute --git-common-dir)/info/exclude`) if not already there.

4. **Open the window**: `code <worktree-path>`. If the `code` CLI is unavailable, tell the user to open the folder manually.

5. **Report**: worktree path, branch, and what will happen next. Include this first-time note verbatim:
   > La primera vez, VS Code te pedirá (1) confiar en la carpeta y (2) "Allow Automatic Tasks" — acepta ambas y la tarea arrancará Claude con el pipeline. En esa ventana se te presentará el plan para aprobar (salvo --auto-approve). Cuando el PR esté mergeado: `git worktree remove <path>`.

Do not start the pipeline in THIS conversation — the new window owns the story end to end.
