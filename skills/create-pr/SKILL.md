---
name: create-pr
description: Create a branch, commit the work, and open a pull request for a completed user story, after all quality gates pass. Use when the user asks to open/create a PR or as the final step of the story workflow.
---

# Create PR

Final step of the story workflow. Only runs when the gates below pass.

## Preconditions (hard gates — verify, do not assume)

1. Unit tests for touched files pass.
2. `coverage-check` passes (≥ 95% on every touched file).
3. Related e2e tests pass (`e2e-generate` ran for user-facing changes).
4. Lint passes with zero warnings for touched files.
5. A `pr-review`-style self-review found no unresolved blocking findings.

If any gate fails, stop and report what is missing instead of opening the PR.

## Branch & commit

1. Branch from the repo's default integration branch. Naming: `<type>/<TICKET-KEY>-<short-slug>` (e.g. `feat/PROJ-1234-payment-status-filter`). Follow the repo's convention if one exists.
2. Stage only files related to the story. List anything intentionally left out.
3. Commit message: `<type>: <TICKET-KEY> <imperative summary>` plus a short body of key changes. Follow the repo's convention if one exists.

## Pull request

Open with `gh pr create` (or the repo's tooling). The body must include:

```
![AI-generated](https://img.shields.io/badge/%F0%9F%A4%96_AI--generated-Claude_Code_%C2%B7_fullstack--dev--kit-8A2BE2)

## <TICKET-KEY>: <story title>

### Summary
<the product-facing summary: what was delivered in user terms and the
decisions taken, plain language — same content as the Jira comment>

### What changed
- ...

### How it was verified
- Unit tests: <command + result>
- Coverage on touched files: <summary, all ≥ 95%>
- E2E: <suites run + result>
- Security pass: <verdict>
- Lint: clean

### Notes for reviewers
- <risks, follow-ups, technical decisions>

Jira: <link to ticket>

---
🤖 Generated with [Claude Code](https://claude.com/claude-code) via the
fullstack-dev-kit plugin. Plan approved by a human before implementation;
human review still required before merge.
```

Use the repo's PR template instead if one exists (`.github/PULL_REQUEST_TEMPLATE.md`), adding the badge, summary, verification evidence, and AI footer into it.

**AI traceability metadata**, best effort after creation:

- Add the label `ai-generated` to the PR (`gh pr edit <url> --add-label ai-generated`). If the label does not exist and you have permission, create it once (`gh label create ai-generated --color 8A2BE2 --description "Opened by an AI agent"`); if no permission, skip silently — the badge and footer already carry the signal.

## After creation

Report the PR URL, the verification evidence, and any follow-up risks explicitly.
