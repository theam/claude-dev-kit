---
description: Turn an idea, brief, or document into a well-formed backlog and create it in your tracker after approval. Guided by default; --quick for a one-shot draft. Usage - /plan-backlog <idea text | path/to/brief.pdf | URL> [--quick]
---

Turn the idea/brief given in the arguments into a backlog: $ARGUMENTS

Follow the `plan-backlog` skill. It has two modes; pick per invocation (never persist a mode — a mature project can hold a brand-new feature):

Rules:

- If the arguments contain no idea or source, ask for one — do not invent scope. Accept pasted text, a path to a file (PDF / Word / Markdown), or a URL / artifact.
- The tracker is whatever `.claude/dev-kit.json` configures (Jira / Linear / GitHub Issues / Azure DevOps); if it is unconfigured, run `dev-kit-setup` first.

## Default — guided (run it in THIS conversation)

The guided flow is interactive, so conduct it in the main conversation (do not hand it to a context-isolated subagent — the user needs to make a decision at each level):

1. **Intake + discovery** — read the source; learn the tracker's conventions (issue types, fields, a sample of recent issues). You may delegate the tracker discovery to the `backlog-planner` subagent to keep this context clean.
2. **Three zoom levels**, per the skill — at each, present **2–4 alternatives**, recommend one with a reason, and **wait for the user's decision** before going deeper:
   - **Framing (zoom-out):** the goal, the problem space, and framing options (MVP vs full, ways to slice it).
   - **Epics / themes** for the chosen framing.
   - **Stories** (with Given/When/Then acceptance criteria) within each epic.
3. **Approval gate:** print a concise hierarchy summary in the conversation and ask the user to approve, adjust, or cancel. For a non-trivial backlog, also render the full draft as a **navigable artifact** (collapsible epics → stories, searchable) as the rich review surface — but the approval still happens in the chat (the artifact is not a substitute for the gate). See the `plan-backlog` skill's review step. (The per-level decisions do not replace this final gate.)
4. **Create** on approval, via the tracker adapter (you may delegate the creation writes to `backlog-planner`), then report each item's key/URL and the handoff note (each story ready for `/work-story <KEY>`).

## `--quick` — one-shot draft (delegate)

Delegate to the `backlog-planner` subagent in two phases:

**Phase 1 — context and draft.** Instruct it to read the source, learn the tracker's conventions, and build the whole backlog draft at once, and RETURN the full draft as its result — explicitly NOT asking for approval itself and NOT creating anything yet.

**Approval gate — two separate steps, in this exact order:**

1. **FIRST, print the draft**: write a normal assistant message containing the backlog-planner's FULL draft (hierarchy + each item's title, acceptance criteria, labels, links), verbatim. This message is a hard requirement — a selection dialog is not a substitute, and putting the draft only inside a dialog's option text does not count. For a non-trivial backlog you may *additionally* render it as a navigable artifact (see the skill's review step), but the in-chat draft + question remain the gate.
2. **THEN, and only after that message is visible**, ask the user to approve, adjust, or cancel.

Never collapse these two steps into one dialog. Only if the arguments contain `--auto-approve` (automated runs), skip the gate.

**Phase 2 — creation.** On approval (or auto-approve), resume the SAME backlog-planner with the approval and any adjustments, and let it create the items and report.
