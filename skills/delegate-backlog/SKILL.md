---
name: delegate-backlog
description: Delegate an approved backlog to a real async coding agent (GitHub Copilot coding agent) so several stories are worked in parallel — one branch and PR per issue — then re-apply the kit's quality via pr-review/fix-pr on the resulting PRs. The async, throughput-first alternative to running work-story interactively per story. Verifies the async target exists (never fabricates a trigger) and never auto-merges. Use when a PO/dev wants to fan a backlog out to an async agent.
---

# Delegate Backlog

Fan an **already-approved** backlog out to a **real async coding agent** so several stories are built in parallel — one branch, one PR per issue — and then re-apply the kit's quality on the PRs that come back. This is the **async, throughput-first alternative** to `work-story` (which works one story at a time, interactively, in your session).

**Be honest about the trade-off.** On the delegated path the kit's **in-session gates do not run** — the plan-approval gate, coverage/security/e2e, and stack conventions are *your* session's guarantees; an external agent runs its own loop. What the kit re-adds is at the **end**: `pr-review` / `fix-pr` on each resulting PR. So `delegate-backlog` **trades the kit's gates for throughput, and buys the quality back on review.** Say this to the user; never present a delegated PR as if the kit's gates produced it.

## When to use vs. `work-story`

- **`work-story <KEY>`** — one story, **interactively**, with the full in-session gates. The default; highest assurance.
- **`delegate-backlog`** — many stories at once, **async**, gates re-applied on review. Use it for parallel throughput when the user explicitly wants to fan out a backlog and accepts the trade-off.

## 0. Preconditions (verify, don't assume)

1. **An approved backlog exists.** Delegate only stories the user has approved (typically the output of `plan-backlog`). If there's no approved backlog, run `plan-backlog` first — don't invent scope.
2. **The tracker is GitHub.** v1 targets **GitHub Copilot coding agent** only. If `tracker.type` isn't `github`, stop and say async delegation isn't available for this tracker yet (other targets are a later step).
3. **The async target is real and enabled** — see §3. Never fabricate a trigger (same doctrine as the "no fabricated automation" guard: the kit has no invented `/builder`-style mechanism).

## 1. Approval gate (mandatory — delegate nothing yet)

Show the user exactly **which issues** will be delegated, **to which agent**, and the **trade-off** (kit gates don't run async; re-applied via `pr-review`/`fix-pr`; nothing auto-merges). Wait for explicit approval. Only proceed on a yes. This is the same doctrine as `work-story`'s plan gate.

## 2. Enrich each issue with a self-contained brief

An async agent only has what's in the issue. Before delegating, make each issue carry everything it needs to build well — append (don't overwrite) a brief with:

- the **acceptance criteria** (from the story),
- the repo's **conventions** the agent should follow (point it at `CLAUDE.md` / `AGENTS.md` and `.github/copilot-instructions.md` if present — do **not** create those files here),
- the **build/test/lint commands** the repo uses (so its own CI can check the work),
- the **branch naming** convention (`<type>/<issue>-<slug>`),
- a **provenance line**: which plan/backlog this came from.

Push as much guidance into the issue as travels; don't rely on the async agent inheriting the kit's context (it won't). Don't mix in a *different* kit's instructions.

## 3. Verify the async target exists and is enabled (GitHub Copilot coding agent)

Copilot coding agent is triggered by **assigning the issue to Copilot**, but it must be **enabled for the repo/org** first (a GitHub Copilot feature). **Verify, don't assume** — and because this surface is young, confirm the mechanism against current GitHub docs rather than trusting a hardcoded command:

- **Availability check:** query the repo's assignable actors for the Copilot bot — GraphQL `repository.suggestedActors(capabilities: [CAN_BE_ASSIGNED], first: 100)`, looking for the Copilot coding-agent bot (login like `copilot-swe-agent` / `Copilot`). If it isn't there, **Copilot coding agent isn't enabled** — stop and tell the user how to enable it (repo/org Copilot settings). Don't fake a trigger.

## 4. Delegate each issue

For each approved issue (independent ones in parallel; for a dependency chain, delegate in dependency order or hold a dependent until its prerequisite PR merges):

- **Assign the issue to Copilot.** The current supported path is the GraphQL `replaceActorsForAssignable` mutation with the Copilot bot's actor id (or `gh` if your version supports assigning Copilot) — **verify it's current** before relying on it. On assignment, Copilot starts a session and opens a **draft PR**.
- **Confirm by read-back** (`gh issue view <n> --json assignees`) — never report an issue as delegated on the exit code alone.
- **Capture the resulting PR from the issue's timeline / linked PRs** — never invent a PR number (same guard as `create-pr`/`fix-pr`: only report a PR the API actually returned).

## 5. Track issue → branch → PR in a run manifest

Keep one **run manifest** so the fan-out is legible and resumable — a table posted as a comment on the parent/epic issue (or a `docs/` file if the user prefers):

| issue | assigned | branch | PR | PR state | reviewed |
|---|---|---|---|---|---|

Update it as PRs appear and as review runs. The manifest is the single place the user watches progress — don't scatter status across many comments.

## 6. Review loop — re-apply the kit's quality

This is where the kit earns its keep on the async path. As each delegated **draft PR** appears:

- Run **`pr-review`** on it (the kit's real review: scope, correctness, security, tests, coverage gate). Then **`fix-pr`** to drive the findings to done — respecting its own guard: verify the PR is **open** before acting, never post to a closed/stale one.
- Record the outcome in the manifest. A PR that fails review is **not** silently accepted — surface it.

## 7. Report and hand off

Report the run from the manifest: issues delegated, PRs opened, review verdicts, what's ready and what needs attention. **Provenance:** each delegated PR should make clear it was produced by the async agent (not the kit's in-session gates) and reviewed afterward by `pr-review`/`fix-pr`. **Never auto-merge** — merging is always the user's explicit call, per PR.

## Guardrails

- **Never fabricate a trigger or a workflow.** Delegate only via the async agent's real, verified mechanism; if it isn't enabled, stop and say so.
- **Honesty over appearance:** never present a delegated PR as if the kit's in-session gates ran. The kit's quality on this path comes from `pr-review`/`fix-pr` on the result — say that.
- **Approve first, never auto-merge.** Delegate only an approved backlog; merge only on the user's explicit per-PR call.
- **Read-back everything** (assignment, PR capture) — never trust an exit code or a remembered number.
- **Don't mix in another kit's instructions**, and don't create `CLAUDE.md`/`AGENTS.md`/`copilot-instructions.md` here — point the agent at what already exists.
- On partial failure, report exactly which issues were delegated, which PRs opened, and which didn't — never leave a half-delegated run unreported.
