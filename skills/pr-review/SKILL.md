---
name: pr-review
description: Structured review of a pull request or the current diff - correctness, contract drift, security, missing tests, coverage gate - producing classified findings and a verdict. Use when the user asks to review a PR or diff, or as the self-review step of the story workflow.
---

# PR Review

Produce a high-signal review: findings a reviewer would act on, classified and ordered, ending in a clear verdict. The kit instructions (`instructions/secure-coding.md`, `instructions/testing-standards.md`) define what counts as blocking.

## Scope the diff

- Reviewing an existing PR: `gh pr diff <pr>` + `gh pr view <pr>` for description and context.
- Reviewing the working tree (self-review before PR): `git diff` against the base branch, including staged changes.
- Read the linked ticket's acceptance criteria — a diff can be flawless and still not do what the story asked.

## Review dimensions (in priority order)

1. **Acceptance criteria**: does the change actually satisfy each criterion? List any criterion not covered.
2. **Correctness**: behavioral regressions, broken edge cases, wrong logic. Read the code, don't skim the diff.
3. **API contract drift**: routes, payloads, enums, validation, status codes — both sides (backend/frontend) updated together.
4. **Security**: apply the checklist in `instructions/secure-coding.md` (auth on new endpoints, secrets, input validation, data exposure). Any automatic-blocker present is a blocking finding.
5. **Tests**: every behavioral change has a test that would fail without it; user-facing changes have e2e coverage with edge cases; touched files stay ≥ 95% (run `coverage-check` if evidence is missing). Test-quality violations from `instructions/testing-standards.md` (assertion-free tests, suppressions, deleted/renamed tests) are findings.
6. **Maintainability**: only issues that materially affect future changes — no style nitpicks a formatter or linter should catch.

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

- Every finding cites file and line. No finding without a concrete failure scenario or rule reference.
- Do not pad: if the diff is clean, say so and approve — a review's value is its signal ratio.
- Never approve with unresolved blocking findings, and never report a criterion as met without seeing the code that implements it.
- When invoked as the self-review step of the story workflow, hand the blocking findings to `fix-pr` (the pr-fixer agent) and re-review after the fixes.
