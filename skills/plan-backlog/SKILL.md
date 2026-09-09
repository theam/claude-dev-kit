---
name: plan-backlog
description: Turn an idea or description (in any format) into a well-formed backlog — epics, user stories with acceptance criteria, sub-tasks — and create it in the team's tracker after approval. Elaborates progressively (guided, the default) or in one shot (`--quick`). Supports Jira, Linear, GitHub Issues, and Azure DevOps via adapters. Use when a product owner wants to draft or create tickets from an idea, brief, or document.
---

# Plan Backlog

Turn a product idea into a structured, well-formed backlog in the team's tracker — the **upstream** half of the issue-to-PR workflow, for the product-owner persona. It closes the loop **idea → backlog → ticket → PR** (created stories feed straight into `work-story`).

This is the *write* counterpart to `issue-fetch` (which reads). **Nothing is created until you approve the draft.** You **facilitate** the PO's thinking — offer options and ask for decisions; never decide the product for them.

## Trigger

A request to turn an idea / brief / description / document into tickets, epics, or a backlog — e.g. *"draft stories for this feature"*, *"create Jira tickets from this doc"*, *"break this initiative into a backlog"*.

## Project configuration

Read `.claude/dev-kit.json` at the consuming repo root. The `tracker` block names the active adapter and its settings:

```json
{ "tracker": { "type": "jira" | "linear" | "github" | "azure", ... } }
```

**If the file does not exist (or has no `tracker` block), run `dev-kit-setup` first** — it detects the tracker and persists the config, then returns here. Don't ask for values setup can discover.

## 1. Intake — read the idea in whatever form it arrives

- **Pasted text / chat description** → use directly.
- **PDF** → read it (page range as needed).
- **Word (`.docx`)** → not natively readable; convert first (`textutil -convert txt file.docx -output -` on macOS, or `pandoc file.docx -t markdown`), then read. If neither tool is available, ask the user to paste the text or export a PDF.
- **Artifact / Confluence page / URL** → fetch it.
- **Figma link** (`figma.com/(design|file)/…`) → run `figma-fetch` for design context.

Work only from what the source says plus what the user confirms — **never invent scope or acceptance criteria.**

## 2. Discovery-first — learn the team's hierarchy and conventions

Don't impose a structure; **mirror the team's.** Using the adapter for `tracker.type`, discover:

- the **issue types available and their hierarchy** (Epic / Story / Task / Feature / Sub-task, …),
- the **fields that matter** (acceptance criteria, story points/estimate, epic/parent link, labels, components),
- a **sample of recent issues** to calibrate granularity and writing style.

Ask only what can't be discovered.

## 3. Choose the mode — guided by default

Two modes; **decide per invocation, never persist a mode** — a mature project can still hold a brand-new feature, so there are **two maturities: the project's and the feature's**. Judge each run.

- **Guided (default):** elaborate progressively, zoom-out → zoom-in, offering alternatives and asking for a decision at each level (§4). This is the right default; it keeps the PO doing the *definition* work instead of handing every decision to the agent.
- **Quick (`--quick`):** produce the whole backlog in one draft (§4, Quick). An explicit opt-in for when the PO just wants a fast draft.

**Signals for how much guidance a run needs** (discovery-first, never assumed):
- **Repo docs:** an empty/greenfield repo vs. one with a defined stack, conventions, and `CLAUDE.md` — the emptier it is, the more definition help the framing step should give.
- **Brief context:** how much useful context the idea/brief already carries.

Even on a mature project, still do a **light framing check** (§4a) — don't skip framing on the assumption it isn't needed. If the mode is genuinely ambiguous, **ask once**.

## 4. Draft the backlog

### Guided mode (default) — zoom-out → zoom-in

Move through **three levels**; at each, present **2–4 alternatives** (as many as the situation needs, no padding), recommend one with a reason, and **wait for the PO's decision** before going deeper. Ground every option in the intake + discovery — never fabricate.

**4a. Framing (zoom-out) — help *define*, not just structure.** Restate the goal and map the problem space (users, outcomes, constraints, unknowns). Offer 2–4 **framing alternatives** — e.g. MVP vs. full, different ways to slice the initiative, different sequencing — with the trade-offs of each. → PO chooses the framing.

**4b. Epics / themes.** For the chosen framing, propose the epics/themes with **alternatives** where the breakdown could reasonably differ. → PO adjusts.

**4c. Stories.** Within each chosen epic, propose user stories (*"As a `<role>`, I want `<capability>`, so that `<value>`"*) with Given/When/Then **acceptance criteria**, INVEST-sized, offering **scoping alternatives** (split/merge, in/out) where it matters. → PO refines.

Then assemble the full draft and go to the approval gate (§5).

### Quick mode (`--quick`) — one-shot draft

Work with a neutral backlog model and produce the whole thing at once:

- **Initiative / Epic** → the outcome / theme.
- **User Story** → *"As a `<role>`, I want `<capability>`, so that `<value>`."* with Given/When/Then **acceptance criteria**, **INVEST**-sized.
- **Sub-tasks** → concrete steps, when they add clarity.
- **Dependencies**, sizing hints, labels/components, and explicit **out-of-scope** notes.

Recommend a shape based on discovery and **confirm it** with the user — don't force one. Then go to the approval gate (§5).

## 5. Approval gate (mandatory — create nothing yet)

Present the **full assembled draft**: the hierarchy plus each item's title, description, acceptance criteria, labels, and links. **Wait for explicit approval**; the user may edit anything. Only after approval proceed to create. (Same doctrine as `work-story`'s plan gate — never create tickets without a human OK. In guided mode the per-level decisions do not replace this final gate.)

## 6. Create — via the tracker's write adapter

Create **parents before children**, link children to parents, and set labels/components/points where discovered. Report each created item with its key/URL.

### Jira (`type: "jira"`) — Atlassian MCP
Config: `site`, `cloudId`, `projectKey`, `fields`.
- Discover types/fields with `getJiraProjectIssueTypesMetadata` / `getJiraIssueTypeMetaWithFields`.
- Create with `createJiraIssue` (project, issue type, summary, description, the acceptance-criteria field, labels, story points). Link stories to the epic via the epic-link field or `createIssueLink`; model dependencies with `createIssueLink` (Blocks / Relates).

### Linear (`type: "linear"`) — Linear MCP
Config: `teamKey` (and optionally `workspace`).
- Create issues under the team; use a **Project** (or a parent issue) as the epic, and **sub-issues** for sub-tasks; set labels/estimate/state. Put acceptance criteria in the description (a checklist).

### GitHub Issues (`type: "github"`) — `gh`
Config: `repo` (`owner/name`; defaults to `origin`).
- `gh issue create --repo <owner/name> --title <t> --body-file - --label <type>` (use `--milestone` as the epic/initiative). Acceptance criteria as a task list in the body; sub-tasks as sub-issues / task lists.
- **Verify writes by read-back — never trust the exit code.** `gh issue edit`/label can fail while applying nothing on repos whose org ever used classic Projects. After creating/labelling, run `gh issue view <number> --json labels,milestone` and, on a miss, apply via REST (`gh api repos/<owner>/<repo>/issues/<number>/labels -f "labels[]=<label>"`).

### Azure DevOps (`type: "azure"`) — Azure DevOps MCP / `az boards`
Config: `org`, `project`.
- `az boards work-item create --type "Epic|Feature|User Story|Task" --title <t> --fields ...`; link parent/child with `az boards work-item relation add`. Acceptance criteria → `Microsoft.VSTS.Common.AcceptanceCriteria`.

## Authentication

If the adapter's backend is not authenticated (MCP connector not authorized, `gh`/`az` not logged in), tell the user exactly how to authenticate — MCP connectors via `/mcp` or claude.ai connector settings; CLIs via `gh auth login` / `az login` — and stop. **Never create partial or placeholder items.**

## 7. Handoff

List the created items with their keys/URLs and hand off: each story is ready for **`work-story <KEY>` → PR**. That completes the loop **idea → backlog → ticket → PR**.

## Guardrails

- **Never create anything before explicit approval.**
- **Facilitate, don't decide:** offer alternatives and ask for the PO's decision at each level — don't hand them a finished product and call it done.
- **Discovery-first:** mirror the team's hierarchy and conventions; don't impose one.
- **Don't fabricate** scope or acceptance criteria — ground everything in the source plus user confirmation.
- Watch for **secrets/PII** in the source material; don't copy them into tickets.
- On partial failure, report exactly what was created and what wasn't — never leave a half-built backlog unreported.
