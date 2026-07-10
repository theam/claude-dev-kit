# claude-dev-kit

Claude Code plugin for C# (.NET) + Angular teams: a **Jira-to-PR workflow** with enforced quality gates.

Give the `coding-agent` a user story ID and it orchestrates the whole flow:

```
/work-story PROJ-1234
   │
   ├─ jira-fetch          → ticket summary + acceptance criteria + comments
   ├─ figma-fetch         → design context (if the ticket links Figma)
   ├─ PLAN + user approval (mandatory gate)
   ├─ implement           → backend + frontend (project subagents)
   ├─ coverage-check      → every touched file ≥ 95% (line/branch/function)
   ├─ e2e-generate        → Playwright / Selenium tests incl. edge cases
   ├─ security-reviewer   → authorization / secrets / input / exposure pass (gate)
   ├─ pr-review → pr-fixer → self-review, then fix the blocking findings
   ├─ create-pr           → branch + commit + PR with verification evidence
   └─ jira-update         → comment PR link on the ticket + move it to review
```

## Install (each developer, once)

```
/plugin marketplace add <org>/claude-dev-kit
/plugin install fullstack-dev-kit
```

Then authorize the connectors (one-time, interactive):

- **Atlassian (Jira)** and **Figma** MCP servers are declared by the plugin. Run `/mcp` in Claude Code and complete the OAuth flow for each. No URLs or tokens to configure.

## Parallel stories — one worktree per story

`/work-story` runs each story in its **own git worktree** (isolated from your main checkout), so you can work several stories at once: open one Claude conversation per story and launch one `/work-story` in each. Or go one better with `/launch-story PROJ-1234`: it creates the worktree, opens a **new VS Code window on it, and the pipeline starts automatically there** (first time only, VS Code asks to trust the folder and allow automatic tasks). Your working directory never gets dirtied by agent work, and each PR branch is built in isolation.

> Caveat: stories whose e2e gates boot dev servers on fixed ports can collide if run at the exact same time — run e2e-heavy stories staggered, or parameterize ports in the consuming repo.

## Zero-config first use

There is nothing to configure by hand. On first use in a repo, the kit bootstraps itself (`dev-kit-setup`):

1. Discovers the accessible Jira site(s) via MCP — asks only if there are several.
2. Derives the project key from the first ticket you request.
3. Auto-detects the instance's custom field IDs (acceptance criteria, sprint, story points) by name.
4. Persists everything to `.claude/dev-kit.json` in the repo — **no secrets**, safe to commit, so one setup serves the whole team.

> Headless/CI runs can't do OAuth. If automated pipeline runs become a requirement, a REST + token fallback can be added to `jira-fetch`/`figma-fetch` later.

## What's inside

| Component | Type | Purpose |
|---|---|---|
| `coding-agent` | agent | Orchestrator: story ID → PR → updated ticket, with plan-approval gate |
| `pr-reviewer` | agent | High-signal diff review: correctness, contract drift, security, tests |
| `pr-fixer` | agent | Resolves review/CI findings, re-verifies gates, pushes |
| `security-reviewer` | agent | Focused security pass: auth, secrets, input, exposure (gate) |
| `coverage-guardian` | agent | Finds files under 95% and writes the missing tests |
| `e2e-author` | agent | Playwright/Selenium tests with realistic edge cases |
| `dev-kit-setup` | skill | First-use bootstrap: discovers site/project/fields, writes `.claude/dev-kit.json` |
| `jira-fetch` | skill | Ticket + acceptance criteria + comments via Atlassian MCP |
| `figma-fetch` | skill | Frame hierarchy + text content from a Figma URL |
| `coverage-check` | skill | Runs .NET + Angular coverage, enforces the 95% gate |
| `e2e-generate` | skill | Playbook for creating/updating e2e tests |
| `create-pr` | skill | Branch, commit, and PR — only after all gates pass |
| `pr-review` | skill | Review playbook: findings by dimension, verdict, AC check |
| `fix-pr` | skill | Playbook: findings → fixes → re-verified gates → push |
| `jira-update` | skill | Comment PR + evidence on the ticket, transition to review |
| `instructions/` | rules | Always-on Tier-1 rules: secure coding, testing standards |
| `/work-story` | command | Entry point: `/work-story PROJ-1234` |
| `/launch-story` | command | Opens a new VS Code window on a fresh worktree that starts the pipeline by itself |

## Quality gates (non-negotiable)

- No code before the plan is approved (unless `--auto-approve` for pipelines).
- Unit tests for touched files pass; coverage on touched files ≥ 95%.
- User-facing changes get e2e coverage (edge cases included) and the suites pass.
- Security pass (`security-reviewer`) with no blocking findings.
- Lint clean; no suppressions to dodge a gate.
- PR body carries the verification evidence; the Jira ticket gets the PR link and moves to review.

## Relationship to project repos

This kit is **project-agnostic and self-configuring**. Each consuming repo keeps its own `.claude/` with project-specific rules: build/test commands, architecture conventions, and stack subagents like `backend-implementer` / `frontend-implementer` (see the `dotnet-angular-claude-template` repo). The kit reads the consuming repo's `CLAUDE.md` for those conventions and its own `.claude/dev-kit.json` (auto-generated on first use) for Jira specifics.
