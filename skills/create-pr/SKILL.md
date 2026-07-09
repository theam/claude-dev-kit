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
## <TICKET-KEY>: <story title>

### What changed
- ...

### How it was verified
- Unit tests: <command + result>
- Coverage on touched files: <summary, all ≥ 95%>
- E2E: <suites run + result>
- Lint: clean

### Notes for reviewers
- <risks, follow-ups, decisions taken>

Jira: <link to ticket>
```

Use the repo's PR template instead if one exists (`.github/PULL_REQUEST_TEMPLATE.md`), adding the verification evidence into it.

## After creation

Report the PR URL, the verification evidence, and any follow-up risks explicitly.
