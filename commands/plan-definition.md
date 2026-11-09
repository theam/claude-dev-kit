---
description: Turn a spark (an idea, even a one-liner) into a clear product definition through a guided discovery phase, then hand it to plan-backlog. Facilitate, never decide. Usage - /plan-definition <idea text | path/to/brief.pdf | URL>
---

Turn the spark given in the arguments into a product definition: $ARGUMENTS

Follow the `plan-definition` skill. It holds the playbook.

Rules:

- If the arguments contain no idea or source, ask for one — but a **one-liner is a valid start** (this step is for vague sparks; you draw the rest out with questions). Accept pasted text, a path to a file (PDF / Word / Markdown), or a URL / artifact / Figma design link.
- Facilitate, never decide. Ask, propose candidate answers, and let the PO confirm or adjust.
- Create no tickets here.
- The approval gate is mandatory: wait for the PO to approve before anything is finalized.
- FigJam `/board/` URLs aren't fetched yet — take a board's content as pasted text.
- When the host supports artifacts, render the definition as a navigable artifact (see the skill). The approval still happens in the chat.

## Run it in THIS conversation (guided, interactive)

The definition flow is interactive, so conduct it in the main conversation — the PO makes a decision at each step (do not hand it to a context-isolated subagent, whose output the user can't see mid-run). You may delegate **intake reading** (e.g. a large PDF/Figma fetch) to the `plan-definer` subagent to keep this context clean.
