---
name: create-pr
description: Create a branch, commit the work, and open a pull request for a completed user story, after all quality gates pass. Use when the user asks to open/create a PR or as the final step of the story workflow.
---

# Create PR

Final step of the story workflow. Runs when the **applicable** gates pass (gates are adaptive to the project — see `instructions/testing-standards.md`).

## Preconditions (verify, do not assume)

1. Unit tests for touched files pass — *when the project has a test framework*.
2. `coverage-check` passes — *when the project has coverage tooling* (project's bar, default ≥ 95%, no regression).
3. Related e2e tests pass — *when the project does e2e* (`e2e-generate` ran for user-facing changes).
4. Lint passes for touched files — *when the project lints*.
5. A `pr-review`-style self-review found no unresolved blocking findings.
6. Security pass has no blocking findings (**always applies**).

A gate that **does not apply** (no test/e2e/lint setup) is not a blocker — but it must be **called out in the PR "How it was verified" section** as *not applicable, recommend adding*, never omitted. A gate that applies and **fails** stops the PR: report what's missing instead of opening it. (A `gates` policy in `.claude/dev-kit.json` can force `required`/`off`.)

## Branch & commit

1. Branch from the repo's default integration branch. Naming: `<type>/<TICKET-KEY>-<short-slug>` (e.g. `feat/PROJ-1234-payment-status-filter`). Follow the repo's convention if one exists.
2. Stage only files related to the story. List anything intentionally left out.
3. Commit message: `<type>: <TICKET-KEY> <imperative summary>` plus a short body of key changes. Follow the repo's convention if one exists.

## Pull request

Open the PR on the configured host (`prHost` in `.claude/dev-kit.json`; default `github`). Branch/commit/push are the same everywhere (plain git); only the "open the PR" call differs:

- **github** — `gh pr create` (`gh` authenticated).
- **bitbucket** — push the branch, then create the PR via the REST API: `POST https://api.bitbucket.org/2.0/repositories/{workspace}/{repo_slug}/pullrequests` with `{title, source:{branch:{name}}, destination:{branch:{name}}}`, authenticated with a Bitbucket app password / access token from the environment (e.g. `BITBUCKET_TOKEN`). The `acli` CLI works too if the team uses it. Derive `{workspace}/{repo_slug}` from the `origin` remote.
- **gitlab** — `glab mr create` (`glab` authenticated).
- **other/none** — print the branch and the ready-to-paste PR title/body and let the user open it.

The body must include (adapt field names to the host — GitHub/GitLab render Markdown; Bitbucket PR descriptions accept Markdown too):

```
![AI-generated](https://img.shields.io/badge/%F0%9F%A4%96_AI--generated-Claude_Code_%C2%B7_fullstack--dev--kit-8A2BE2)

## <TICKET-KEY>: <story title>

### Summary
<the product-facing summary: what was delivered in user terms and the
decisions taken, plain language — same content as the tracker comment>

### What changed
- ...

### How it was verified
- Unit tests: <command + result>
- Coverage on touched files: <summary — meets the project's bar>
- E2E: <suites run + result>
- Security pass: <verdict>
- Lint: clean

### Notes for reviewers
- <risks, follow-ups, technical decisions>

### Delivery readiness
<Include only the lines that apply — skip this whole section for trivial/internal changes; don't pad.>
- Rollback: safe to revert this PR on its own? Flag anything that isn't.
- Migrations: reversible and safe on a live DB (no long locks; backfill plan)?
- Config/secrets: new keys have safe defaults; nothing required-but-undocumented.
- Docs/contract: user-facing or API changes reflected in the docs.
- Breaking change / behind a feature flag: called out explicitly.

Issue: <link to the tracker item>

---
🤖 Generated with [Claude Code](https://claude.com/claude-code) via the
fullstack-dev-kit plugin. Plan approved by a human before implementation;
human review still required before merge.
```

Use the repo's PR template instead if one exists (`.github/PULL_REQUEST_TEMPLATE.md`), adding the badge, summary, verification evidence, and AI footer into it.

**AI traceability metadata**, best effort after creation:

- Add an `ai-generated` label/tag to the PR when the host supports it — GitHub: `gh pr edit <url> --add-label ai-generated` (create it once with `gh label create ai-generated --color 8A2BE2` if missing); Bitbucket/GitLab: skip or use the host's equivalent. If not possible, skip silently — the badge and footer already carry the signal.

## After creation

Report the PR URL, the verification evidence, and any follow-up risks explicitly.
