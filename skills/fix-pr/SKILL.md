---
name: fix-pr
description: Resolve the findings on an existing pull request - review comments, CI failures, and self-review findings - then re-verify the quality gates and push. Use when a PR has unresolved review feedback or failing checks, or as the fix step after pr-review.
---

# Fix PR

Turn findings into commits: every blocking finding gets fixed or explicitly answered, gates go back to green, and the PR ends ready for re-review.

## Gather the findings

Collect, in this order:

1. **CI failures**: `gh pr checks <pr>` — read the failing job logs, not just the status.
2. **Review comments**: `gh pr view <pr> --comments` and unresolved review threads (`gh api` for review comments when needed).
3. **Self-review findings** handed over by the caller (e.g. the coding-agent's `pr-review` pass).

Deduplicate and classify each finding: **blocking** (correctness, security, contract drift, failing gate) vs **non-blocking** (style, suggestion, question).

## Resolve

For each blocking finding:

1. Fix it in code, following the repo's conventions and the kit instructions (`instructions/secure-coding.md`, `instructions/testing-standards.md`).
2. Add or update the tests that prove the fix; keep touched files at ≥ 95% coverage.
3. If you believe a finding is wrong, do not ignore it — reply on the thread with the reasoning and let the reviewer decide.

For non-blocking findings: apply the cheap ones, answer the rest on their threads. Never resolve someone else's thread without either a fix or a reply.

## Re-verify (same gates as create-pr)

- Unit tests for touched files pass.
- `coverage-check` still ≥ 95% on every touched file.
- Related e2e tests pass if user-facing behavior changed.
- Lint clean. No suppressions added to dodge a gate.

## Ship the fixes

1. Commit with a message referencing what was addressed (e.g. `fix: PROJ-1234 address review findings — <short list>`).
2. Push to the PR branch.
3. Comment a short summary on the PR: findings addressed (with commit refs), findings answered-not-fixed (with reasoning), verification evidence.

## Report

Findings fixed / answered / remaining, verification results, and the PR URL. If any blocking finding could not be resolved, say so explicitly with the reason — never report the PR as clean while threads remain open.
