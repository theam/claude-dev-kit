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
- **Figma link** (`figma.com/(design|file)/…`) → run `figma-fetch` for design context. For a **FigJam** board, `figma-fetch` doesn't read `/board/` URLs yet — ask the PO to paste the board's content as text. v1 treats any whiteboard as **read-only context**; nothing is written back to it.

If the spark is thin, that's expected — the framing step (§2) is where you draw it out with questions, not where you fill it in for the PO. See **Grounding & provenance** next; it governs the whole flow.

## Grounding & provenance (the core rule — read before drafting)

A one-liner is a valid start, so most of what a definition could contain is **not** in the intake. That is fine — but it makes *how you introduce content* the thing that keeps this honest. Two moves that look identical on the page are completely different:

- **Generating options for the PO to choose** — proposing 2–4 framings, directions, or candidate answers and letting the PO pick — is **the point of this skill.** Do it freely.
- **Asserting facts about the world** the PO didn't give you — "no mainstream app does X", "this is why people churn", "the market for Y is underserved", a specific metric target — is **fabrication when stated as established.** You cannot verify market, prior-art, or novelty claims here; the skill has no research step. So:
  - Offer them as the PO's to confirm ("*is it true that…?*"), or
  - Mark them **unverified** in the definition, or
  - Leave them out.

**Every claim in the definition carries a provenance marker** so a proposal never renders identically to a decision:

- `[PO]` — the PO stated or explicitly confirmed it.
- `[spark]` — it came from the intake source.
- `[proposed]` — you generated it; the PO accepted the option but the *content* is yours.
- `[unverified]` — a factual claim about the world that nobody has checked (all market/novelty/prior-art claims are at least this).

The distinction to never blur: **a direction the PO selected from your options is a real decision; a fact you supplied to justify it is not, until it's checked.** When in doubt, mark it lower, not higher.

## 2. Frame the problem (zoom-out) — guided questions, proposed answers

Draw out the definition through a **Socratic** exchange: for each dimension, ask, **propose a candidate answer**, and let the PO confirm or adjust. Proposing candidates is exactly right (see **Grounding & provenance**) — just don't smuggle in unverifiable *facts* as if they were established (mark those `[unverified]` or ask). Offer options; don't assume. Move through:

- **Users / audience** — who is this for, and who is it *not* for?
- **Problem / outcome** — what problem, and what does success look like for the user?
- **Why now** — the trigger or opportunity.
- **Constraints** — technical, time, budget, compliance, existing systems.
- **Success metrics** — how we'll know it worked (leading + lagging where possible).
- **Risks / unknowns** — what could break the thesis; what we still don't know.
- **Non-goals** — explicitly out of scope, to keep the definition sharp.

Don't interrogate all seven in one dump — work them conversationally, a few at a time, folding the PO's answers back in. It's fine — often better — to leave an item **explicitly unresolved** rather than force an answer: any must-have section may carry *"not established"* with a note on what's needed to settle it (see §4). This applies especially to **Success metrics**, which POs frequently decline — record "not established (no baseline yet)", never a number you made up.

**No research step.** The skill fetches only PO-supplied sources (§1); it does not browse. So when a dimension turns on a fact you'd normally look up — *"which segment is underserved?"*, *"has anyone shipped this?"* — you **cannot answer it as fact.** Say so, offer it as a question for the PO or a later research task, and mark any market/novelty claim `[unverified]`. Confidently reciting a competitive map from memory is the failure mode this rule exists to prevent.

## 3. Directions & trade-offs (zoom-in)

Propose **2–4 solution directions** (as many as the situation needs, no padding). Note the object here is different from `plan-backlog`'s framing: this is **what the product is / which approach** (e.g. rehab-adherence vs. general fitness; a novel core mechanic vs. a known one), not *how to slice the work into a backlog* — that stays downstream. Give each its **trade-offs** (cost, risk, time-to-value, reversibility). Recommend one with a reason, and **wait for the PO to choose or refine.** Ground the trade-offs the same way as everything else: option-generation is fine, but any supporting *fact* is `[proposed]`/`[unverified]` until the PO confirms it.

The flow is **not forward-only**: if, while assembling §4, the PO wants to revisit or withdraw the direction chosen here, go back and re-open §3 rather than editing around a decision that no longer holds. A definition whose Chosen direction was silently un-decided is worse than one that loops back.

## 4. Produce the definition (approval-gated)

Assemble a structured **product definition / brief**. **Every line carries its provenance marker** (`[PO]` / `[spark]` / `[proposed]` / `[unverified]`, per **Grounding & provenance**) — this is what stops an approved doc from reading as sourced when it isn't. Any must-have section the PO didn't settle is recorded as **"not established"** with a note on what would settle it — never invented to avoid a gap.

Canonical template — **must-have** sections:

- **Problem statement** — one or two sentences.
- **Target users** — and non-users.
- **Goals** and **Non-goals**.
- **Success metrics** — or *"not established"* (POs often decline; that's a valid state, a fabricated number is not).
- **Chosen direction** — plus the alternatives considered and why this one.
- **Key decisions** — the calls made during framing, each with its rationale *and who made it* (a call the PO delegated to you is marked `[proposed]`, not rendered like one they made).
- **Risks / unknowns** — what the definition rests on that could be wrong, including every `[unverified]` claim that survived into the doc. **Must-have**: this is the section that qualifies the confident ones, so it can't be optional.
- **Open questions** — what's still undecided.

**Optional** sections when the material warrants: constraints, why-now, dependencies, a rough phasing sketch.

**Approval gate (mandatory).** Present the full definition and **wait for explicit approval**; the PO may edit anything. Before asking for the OK, ask one grounding question explicitly: **"what in here rests on something nobody has verified?"** — walk the `[unverified]`/`[proposed]` claims so the PO approves them knowing what's assumed, not just what's asserted. Nothing is finalized — and nothing downstream (no backlog, no tickets) happens here — until they approve.

**Rich review surface (when the host supports artifacts — e.g. Claude Code / claude.ai).** Render the definition as a **navigable artifact** (collapsible sections, a table of contents, easy to scan and drill into) as the review aid — reusing the same doctrine as `plan-backlog`'s review artifact. Load the `artifact-design` skill before building it. The artifact is a *review aid, not the gate*: still print a concise summary and ask for approval **in the conversation**. On hosts without artifacts (Codex / Cursor / Copilot), present the definition as Markdown.

**Where it lives (v1).** The definition lives in the conversation (and the artifact). If the PO wants it persisted, offer to save it as a Markdown file in the repo (e.g. `docs/definitions/<slug>.md`) — only on request. No Confluence/whiteboard write-back in v1.

## 5. Handoff to `plan-backlog`

On approval, hand the definition to `plan-backlog` as its input: *"the definition is ready — run `/plan-backlog` on it to turn it into a backlog."* Because the problem is now defined, `plan-backlog`'s framing step is lighter — it confirms the framing rather than re-deriving it. That completes the loop **define → backlog → ticket → PR**.

**Readiness — say it plainly.** A definition can be *approved* without being *backlog-ready*: if core must-haves are still "not established", or the doc leans on `[unverified]` claims, **tell the PO that** at handoff rather than passing it downstream as settled. `plan-backlog`'s lighter framing trusts a grounded definition; a thin one should either loop back here to firm up, or be handed on with the gaps flagged so `plan-backlog` re-derives instead of confirming. Don't let approval alone stand in for readiness.

**Persisting for a later session.** If the backlog won't be built in the same sitting, the definition needs a carrier — offer to save it to `docs/definitions/<slug>.md` so `plan-backlog` can read it as an input file later. Without that, an in-conversation-only definition can't reach a future `plan-backlog` run.

## Guardrails

- **Facilitate, never decide:** ask, offer alternatives, and let the PO make the call at each step — don't hand them a finished definition and call it done.
- **Grounding over fluency (see Grounding & provenance):** generating options is the job; asserting unverifiable facts as established is not. Mark every claim's provenance, keep `[unverified]` market/novelty claims out of the load-bearing prose (or clearly flagged), and prefer a marked gap to an invented answer. A thin spark is drawn out with questions, not filled in for the PO.
- **No backlog, no tickets here** — that's `plan-backlog`. This step stops at an approved definition.
- **Approval gate** before the definition is finalized.
- Watch for **secrets/PII** in the source material; don't copy them into the definition.
