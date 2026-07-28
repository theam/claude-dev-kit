---
name: pr-review
description: Structured review of a pull request or the current diff - correctness, contract drift, security, missing tests, coverage gate - producing classified findings and a verdict. Use when the user asks to review a PR or diff, or as the self-review step of the story workflow.
---

# PR Review

Produce a high-signal review: findings a reviewer would act on, classified and ordered, ending in a clear verdict. The kit instructions (`instructions/secure-coding.md`, `instructions/testing-standards.md`) define what counts as blocking.

## Scope the diff

- Reviewing an existing PR: fetch the diff and description from the configured host (`prHost` in `.claude/dev-kit.json`). **github:** `gh pr diff <pr>` + `gh pr view <pr>`. **bitbucket:** `GET /2.0/repositories/{ws}/{repo}/pullrequests/{id}/diff` and `/pullrequests/{id}` (REST, token from env). **gitlab:** `glab mr diff <id>` + `glab mr view <id>`.
- Reviewing the working tree (self-review before PR): `git diff` against the base branch, including staged changes.
- Read the linked ticket's acceptance criteria — a diff can be flawless and still not do what the story asked.
- Write the **PR intent** — one line on what this PR is for and what it deliberately leaves alone. It's the ruler for scope: a real defect *inside* the intent blocks; a valid concern *outside* it is a note or a follow-up, not a reason to expand the PR.

## Review dimensions (in priority order)

1. **Acceptance criteria**: does the change actually satisfy each criterion? List any criterion not covered.
2. **Correctness**: behavioral regressions, broken edge cases, wrong logic. Read the code, don't skim the diff.
3. **Contract drift**: routes, payloads, enums, schemas, validation, status codes — every side that depends on the contract updated together.
4. **Security**: apply the checklist in `instructions/secure-coding.md` (auth on new endpoints, secrets, input validation, data exposure). Any automatic-blocker present is a blocking finding.
5. **Tests** (adaptive — judge against the project's own setup, see `instructions/testing-standards.md`): when the project has tests, every behavioral change has one that would fail without it and touched files stay at the project's bar (default ≥ 95%, no regression — run `coverage-check` if evidence is missing); when it does e2e, user-facing changes have e2e coverage with edge cases. A project with **no** test/e2e setup is not a blocking finding — flag it as a recommendation. Test-quality violations from `instructions/testing-standards.md` (assertion-free tests, suppressions, deleted/renamed tests) are findings.
6. **Performance regressions introduced here** (blocking): algorithmic blowups over collections that grow with usage; N+1 queries or per-item network calls on a request path; unbounded result sets / memory / missing pagination; blocking work on a hot path; a new query filtering/joining on an unindexed column. *Not* this: micro-optimizations or "could be faster" with no mechanism.
7. **Duplication introduced by this PR** (blocking): new code reimplementing logic already in the repo, or copy-paste between the files this PR adds — fix by reusing/extracting once. *Not* this: two blocks that merely look alike and are about to diverge; pre-existing duplication is a follow-up at most.
8. **Maintainability**: only issues that materially affect future changes — no style nitpicks a formatter or linter should catch.

## Adversarial check (proportional — do not double every review)

For **high-stakes diffs only** (auth/authorization, money, personal data, migrations, concurrency, anything hard to roll back), before the verdict take one targeted skeptical pass: pick the 1–2 conclusions most likely to be wrong and the 1–2 "looks fine" spots most likely to hide a defect, and actively try to break them (an edge input, a failure/timeout path, a race, a partial write). Routine or low-risk diffs get the normal single pass — this is a focused second look where being wrong is expensive, not a mandatory re-review.

## Output format

```
## Review: <PR/diff identifier>

### Blocking
- [file:line] <finding> — <why it blocks, one line>

### Non-blocking
- [file:line] <suggestion>

### Questions
- <anything ambiguous that needs the author's intent>

### Verdict
APPROVE | REQUEST CHANGES — <one-line rationale>
Acceptance criteria: <met / partially met (which ones missing)>
```

## Rules

- **Report first, publish only with consent.** Findings are delivered in the conversation. Never submit a GitHub review verdict (approve / request changes) and never post comments on the PR without the user's explicit confirmation — show exactly what would be posted and wait. This applies doubly to PRs authored by other people.
- Every finding cites file and line. No finding without a concrete failure scenario or rule reference.
- Do not pad: if the diff is clean, say so and approve — a review's value is its signal ratio.
- Never approve with unresolved blocking findings, and never report a criterion as met without seeing the code that implements it.
- When invoked as the self-review step of the story workflow, hand the blocking findings to `fix-pr` (the pr-fixer agent) and re-review after the fixes.
