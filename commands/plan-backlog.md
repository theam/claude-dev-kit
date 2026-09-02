---
description: Turn an idea, brief, or document into a well-formed backlog and create it in your tracker after approval. Usage - /plan-backlog <idea text | path/to/brief.pdf | URL>
---

Turn the idea/brief given in the arguments into a backlog: $ARGUMENTS

Delegate to the `backlog-planner` subagent in two phases, passing the source (the text, or the path/URL to the document) and any extra instructions from the arguments.

Rules:

- If the arguments contain no idea or source, ask for one — do not invent scope. Accept pasted text, a path to a file (PDF / Word / Markdown), or a URL / artifact.
- The tracker is whatever `.claude/dev-kit.json` configures (Jira / Linear / GitHub Issues / Azure DevOps); if it is unconfigured, the agent runs `dev-kit-setup` first.

**Phase 1 — context and draft.** Instruct the backlog-planner to read the source, learn the tracker's conventions, and build the backlog draft, and RETURN the full draft as its result — telling it explicitly NOT to ask for approval itself and NOT to create any tickets yet.

**Approval gate — two separate steps, in this exact order:**

1. **FIRST, print the draft**: write a normal assistant message to the conversation containing the backlog-planner's FULL draft (the hierarchy plus each item's title, acceptance criteria, labels, and links), verbatim. This message is a hard requirement — a selection dialog is NOT a substitute for it, and putting the draft only inside a dialog's option text does not count: the user must be able to read the complete draft in the chat before any question appears.
2. **THEN, and only after that message is visible**, ask the user to approve, adjust, or cancel.

Never collapse these two steps into one dialog. Only if the arguments contain `--auto-approve` (for automated runs), skip the gate and proceed directly.

**Phase 2 — creation.** On approval (or auto-approve), resume the SAME backlog-planner (so it keeps its context) with the approval and any user adjustments, and let it create the items in the tracker.

- Relay the agent's final report: each created item's key/URL, the hierarchy created, and the handoff note (each story is ready for `/work-story <KEY>`).
