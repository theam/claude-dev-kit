---
name: plan-definition
description: Turn a spark (an idea, even a one-liner, in any format) into a clear product definition through a guided, Socratic discovery phase — frame the problem (users, outcome, metrics, constraints, non-goals), explore 2–4 directions with trade-offs, and produce an approved definition that then feeds plan-backlog. Facilitate, never decide. Use when a product owner wants to define a problem before breaking it into a backlog.
---

# Plan Definition

Turn a **spark** into a clear **product definition** through a guided discovery phase — the **most upstream** step of the workflow, for the product-owner persona. It runs *before* `plan-backlog` and closes the loop **define → backlog → ticket → PR**.

`plan-backlog` starts from a *defined* problem and turns it into a backlog; its framing step is deliberately light ("how do we slice this"). **`plan-definition` does the deep part: defining the problem itself** — who it's for, the outcome, why now, the constraints, the success metrics, the chosen direction. Its output is a **definition doc**, not a backlog and not tickets. You **facilitate** the PO's thinking — ask, offer options, and let them decide; never decide the product for them.

## Trigger

A request to *define*, *frame*, *scope*, or *think through* a product idea before there are stories — e.g. *"help me define this feature"*, *"I have a rough idea, let's shape it"*, *"what's the problem we're solving here"*. If the request is already a defined problem asking for tickets, that's `plan-backlog`, not this.

## Boundary with `plan-backlog` (important)

- **`plan-definition`** = define the problem & direction. **No backlog, no tickets.** Output: a product definition.
- **`plan-backlog`** = turn a *defined* problem into a backlog. When a definition from here is handed in, it consumes it and runs a **lighter framing** (confirm, don't re-derive) instead of framing from scratch.

## 1. Intake — read the spark in whatever form it arrives

The input is deliberately vaguer than `plan-backlog`'s — **a one-liner is a valid start.**

- **Pasted text / chat description** → use directly.
- **PDF** → read it (page range as needed).
- **Word (`.docx`)** → convert first (`textutil -convert txt file.docx -output -` on macOS, or `pandoc file.docx -t markdown`), then read. If neither tool is available, ask the user to paste the text or export a PDF.
- **Artifact / Confluence page / URL** → fetch it.
- **Figma / FigJam link** (`figma.com/(design|file|board)/…`) → run `figma-fetch` for design/whiteboard context. FigJam boards (`/board/`) are read as **context only** in v1 — the definition is not written back to the board.

Work only from what the source says plus what the user confirms — **never invent the problem, users, or metrics.** If the spark is thin, that's expected: the framing step (§2) is where you draw it out with questions.

## 2. Frame the problem (zoom-out) — guided questions, proposed answers

Draw out the definition through a **Socratic** exchange: for each dimension, ask, **propose a candidate answer grounded in the intake**, and let the PO confirm or adjust. Offer options; don't assume. Move through:

- **Users / audience** — who is this for, and who is it *not* for?
- **Problem / outcome** — what problem, and what does success look like for the user?
- **Why now** — the trigger or opportunity.
- **Constraints** — technical, time, budget, compliance, existing systems.
- **Success metrics** — how we'll know it worked (leading + lagging where possible).
- **Risks / unknowns** — what could break the thesis; what we still don't know.
- **Non-goals** — explicitly out of scope, to keep the definition sharp.

Don't interrogate all seven in one dump — work them conversationally, a few at a time, folding the PO's answers back in. It's fine to leave items in **open questions** rather than force an answer.

## 3. Directions & trade-offs (zoom-in)

Propose **2–4 solution directions** (as many as the situation needs, no padding) — e.g. MVP vs. full, different approaches, different sequencing — each with its **trade-offs** (cost, risk, time-to-value, reversibility). Recommend one with a reason, and **wait for the PO to choose or refine.** Ground every direction in the framing; never fabricate.

## 4. Produce the definition (approval-gated)

Assemble a structured **product definition / brief**. Canonical template — **must-have** sections:

- **Problem statement** — one or two sentences.
- **Target users** — and non-users.
- **Goals** and **Non-goals**.
- **Success metrics**.
- **Chosen direction** — plus the alternatives considered and why this one.
- **Key decisions** — the calls made during framing, with their rationale.
- **Open questions** — what's still undecided.

**Optional** sections when the material warrants: constraints, risks/unknowns, why-now, dependencies, a rough phasing sketch.

**Approval gate (mandatory).** Present the full definition and **wait for explicit approval**; the PO may edit anything. Nothing is finalized — and nothing downstream (no backlog, no tickets) happens here — until they approve.

**Rich review surface (when the host supports artifacts — e.g. Claude Code / claude.ai).** Render the definition as a **navigable artifact** (collapsible sections, a table of contents, easy to scan and drill into) as the review aid — reusing the same doctrine as `plan-backlog`'s review artifact. Load the `artifact-design` skill before building it. The artifact is a *review aid, not the gate*: still print a concise summary and ask for approval **in the conversation**. On hosts without artifacts (Codex / Cursor / Copilot), present the definition as Markdown.

**Where it lives (v1).** The definition lives in the conversation (and the artifact). If the PO wants it persisted, offer to save it as a Markdown file in the repo (e.g. `docs/definitions/<slug>.md`) — only on request. No Confluence/whiteboard write-back in v1.

## 5. Handoff to `plan-backlog`

On approval, hand the definition to `plan-backlog` as its input: *"the definition is ready — run `/plan-backlog` on it to turn it into a backlog."* Because the problem is now defined, `plan-backlog`'s framing step is lighter — it confirms the framing rather than re-deriving it. That completes the loop **define → backlog → ticket → PR**.

## Guardrails

- **Facilitate, never decide:** ask, offer alternatives, and let the PO make the call at each step — don't hand them a finished definition and call it done.
- **Never fabricate** the problem, users, metrics, or direction — ground everything in the intake plus the PO's answers. A thin spark is drawn out with questions, not invented.
- **No backlog, no tickets here** — that's `plan-backlog`. This step stops at an approved definition.
- **Approval gate** before the definition is finalized.
- Watch for **secrets/PII** in the source material; don't copy them into the definition.
