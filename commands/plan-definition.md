---
description: Turn a spark (an idea, even a one-liner) into a clear product definition through a guided discovery phase, then hand it to plan-backlog. Facilitate, never decide. Usage - /plan-definition <idea text | path/to/brief.pdf | URL>
---

Turn the spark given in the arguments into a product definition: $ARGUMENTS

Follow the `plan-definition` skill. This is the **most upstream** step — it *defines* the problem before `plan-backlog` turns it into a backlog. It produces a **definition doc, never tickets.**

Rules:

- If the arguments contain no idea or source, ask for one — but a **one-liner is a valid start** (this step is for vague sparks; you draw the rest out with questions). Accept pasted text, a path to a file (PDF / Word / Markdown), or a URL / artifact / Figma design link.
- **Facilitate, never decide.** Ask, propose candidate answers, and let the PO confirm or adjust at each step.
- **Ground it.** Generating options for the PO to choose is the job; asserting unverifiable facts (market/novelty/prior-art claims, invented metrics) as established is not. The skill's **Grounding & provenance** rule governs — mark each claim `[PO]`/`[spark]`/`[proposed]`/`[unverified]`, and there's no research step, so market/novelty claims are `[unverified]` unless the PO supplies a source.

## Run it in THIS conversation (guided, interactive)

The definition flow is interactive, so conduct it in the main conversation — the PO makes a decision at each step (do not hand it to a context-isolated subagent, whose output the user can't see mid-run). You may delegate **intake reading** (e.g. a large PDF/Figma fetch) to the `plan-definer` subagent to keep this context clean.

1. **Intake** — read the spark in whatever form it arrives (§1 of the skill). If it references a Figma design, run `figma-fetch` for context (FigJam `/board/` URLs aren't fetched yet — take a board's content as pasted text).
2. **Frame the problem (zoom-out)** — draw out users, problem/outcome, why-now, constraints, success metrics, risks/unknowns, non-goals through guided questions with proposed answers. Work them conversationally, a few at a time — don't interrogate all seven at once. Leave genuinely-undecided items as open questions.
3. **Directions & trade-offs (zoom-in)** — propose **2–4 solution directions** with trade-offs, recommend one, and **wait for the PO to choose or refine.**
4. **Definition + approval gate:** assemble the definition (problem statement, users, goals & non-goals, success metrics **or "not established"**, chosen direction + alternatives, key decisions, risks/unknowns, open questions), each line carrying its provenance marker. Before the OK, walk the `[unverified]`/`[proposed]` claims — ask *"what in here rests on something nobody has verified?"* — then ask the PO to approve, adjust, or cancel. When the host supports artifacts, also render it as a **navigable artifact** (see the skill's review step) — but the approval still happens in the chat.
5. **Handoff:** on approval, tell the PO the definition is ready and hand it to `/plan-backlog` (whose framing is then lighter). Say plainly whether it's **backlog-ready** — if core must-haves are "not established" or it leans on `[unverified]` claims, flag that so `plan-backlog` re-derives rather than just confirming. If the backlog won't be built in the same sitting, offer to save it to `docs/definitions/<slug>.md` so `plan-backlog` can read it later. **Create no tickets here.**
