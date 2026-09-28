---
description: Delegate an approved backlog to GitHub Copilot coding agent (async, parallel), then review the resulting PRs with the kit. Trades the in-session gates for throughput; nothing auto-merges. Usage - /delegate-backlog <issue numbers | parent/epic issue>
---

Delegate the approved backlog referenced in the arguments to an async coding agent: $ARGUMENTS

Follow the `delegate-backlog` skill. This is the **async, throughput-first alternative** to `/work-story` — it fans an **already-approved** backlog out to **GitHub Copilot coding agent** (one branch/PR per issue) and then re-applies the kit's quality via `pr-review`/`fix-pr` on the PRs that come back.

Rules:

- **Approved backlog only.** Delegate the issues the user approved (usually `plan-backlog`'s output). If none is referenced, ask — don't invent scope.
- **GitHub only in v1** (Copilot coding agent). If the tracker isn't GitHub, say async delegation isn't available for it yet.
- **Be honest about the trade-off** up front: the kit's in-session gates (plan approval, coverage/security/e2e) **don't run** on the delegated path — they're re-applied on review. Never present a delegated PR as if the kit's gates produced it.

## Run it

1. **Approval gate** — show which issues go to which agent and the trade-off; delegate nothing until the user says yes.
2. **Enrich** each issue with a self-contained brief (AC, repo conventions, test commands, branch naming, provenance). You may delegate the discovery/enrichment groundwork to the `backlog-delegator` subagent.
3. **Verify** Copilot coding agent is enabled (query the repo's assignable actors) — never fabricate a trigger; if it isn't enabled, stop and say how to enable it.
4. **Delegate** each issue by assigning it to Copilot (verify the current mechanism), confirm by read-back, and capture the resulting draft PR from the issue's linked PRs — never invent a PR number.
5. **Track** issue → branch → PR in a run manifest (a comment on the parent/epic issue).
6. **Review loop** — as draft PRs appear, run `pr-review` then `fix-pr` on each (respecting fix-pr's open-PR guard); record verdicts in the manifest.
7. **Report** from the manifest with provenance, and **never auto-merge** — merging is the user's explicit per-PR call.
