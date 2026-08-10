---
name: work-story
description: Work a user story end to end — fetch the ticket, plan (with approval), implement, verify the applicable gates, self-review, open the PR, and update the tracker. Use when given an issue key like PROJ-1234, ENG-42, or #123. This is the orchestration playbook for hosts without a dedicated orchestrator subagent (Codex, and other Agent-Plugins clients); on Claude Code the `/work-story` command + `coding-agent` subagent do this instead.
---

# Work Story (orchestration)

You are the story orchestrator. Input: an issue key from the team's tracker. Output: a
pull request that satisfies the story's acceptance criteria with verified quality gates,
and a tracker ticket that reflects it. **You run every step yourself, in order** — invoke
the kit's other skills as the steps below call for them; there is no separate orchestrator
process here.

If no issue reference is given, ask for one — don't guess. Accept the shapes the configured
tracker uses (`PROJ-1234` Jira, `ENG-42` Linear, `#123` GitHub/Azure).

**Stack-agnostic.** Carry no assumptions about language, framework, or test runner. Read the
repo's `AGENTS.md` / `CLAUDE.md` and `.claude/` for build/test/lint/coverage commands and
conventions, and follow them exactly; when silent, detect conventions from the repo — never
impose a stack. The always-on rules in `instructions/secure-coding.md` and
`instructions/testing-standards.md` bind every step.

## 1. Context
- If `.claude/dev-kit.json` is missing, run **`dev-kit-setup`** first (one-time bootstrap:
  tracker, project/team, field IDs).
- Run **`issue-fetch`** for the ticket and show the summary.
- If the ticket references Figma, run **`figma-fetch`** and summarize the UI intent.
- Read the repo's project instructions and load the baseline stack profile
  (`instructions/stacks/<id>.md` for the `stacks` in `.claude/dev-kit.json`); the repo's own
  instructions always win, the profile fills gaps.

## 2. Plan — WAIT FOR APPROVAL
Validate assumptions against the running product when feasible (boot the app / exercise the
flow) before writing the plan. Then present, **in the chat**, the ticket summary and a full
plan — Understanding, Affected areas, numbered Implementation steps, Test plan, Open
questions — and **wait for the user's explicit approval**. Write no code until they approve
(unless the invocation says the plan is pre-approved, e.g. an automated run).

## 3. Implement
- Follow the repo's conventions and architecture. Keep the diff scoped to the story — no
  opportunistic refactors.
- Update every side of any changed contract (payload/route/enum/schema/validation) together.
- For user-facing frontend work, write accessible markup as you go (semantic HTML, labels,
  `alt`, keyboard/focus) — cheaper than fixing it at review.

## 4. Verify (gates — adaptive to the project)
Apply the gates that fit the project (detect its setup each run; see
`instructions/testing-standards.md`). Report each as passed, failed (with output), or **not
applicable** (reason + recommendation) — never silently skip. A `gates` policy in
`.claude/dev-kit.json` can force `required`/`off`; default is auto-detect.
- Unit tests for touched files pass — if the project has a test framework (don't scaffold one).
- **`coverage-check`** — if the project has coverage tooling (touched files meet the bar,
  default ≥ 95%, no regression). If none: recommend, don't fail.
- **`e2e-generate`** for user-facing changes — if the project already does e2e.
- Lint clean on touched files (when the project lints).
- **Security pass (always applies):** review the diff against `instructions/secure-coding.md`;
  any automatic-blocker is a gate — fix and re-check.

## 5. Self-review
Run **`pr-review`** on the full diff. Fix blocking findings (its counterpart playbook is
**`fix-pr`**) and re-verify; note the non-blocking ones.

## 6. Ship
Run **`create-pr`**. Report the PR URL, the verification evidence, and any follow-up risks.

## 7. Update the ticket
Run **`issue-update`**: comment a product-facing summary (plain language) plus the PR link,
and transition the ticket to the team's review status. The story isn't done until the
tracker reflects it.

## Reporting
At every step, state plainly what passed, what failed (with output), and what was skipped.
Never report a gate as passed without having run it.
