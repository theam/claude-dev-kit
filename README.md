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

**Prerequisites:** the [Claude Code CLI](https://code.claude.com) (`claude --version`), the [GitHub CLI](https://cli.github.com) authenticated (`gh auth status`), and read access to this repository.

From a terminal (plugin management is CLI-only — the VS Code chat panel will reject `/plugin` commands):

```bash
claude plugin marketplace add theam/claude-dev-kit
claude plugin install fullstack-dev-kit@claude-dev-kit
```

Installation is **user-level and permanent**: every future session (CLI or VS Code extension) loads the kit automatically — you never reinstall per session or per window.

Then authorize the connectors (one-time):

1. Open a Claude Code session in your project (`claude` in the terminal, or the VS Code panel — restart it if it was open during the install).
2. Run `/mcp` → select **`atlassian`** (the plain one declared by the plugin — not a "claude.ai Atlassian" account connector) → **Authenticate** → complete the browser OAuth **immediately**, picking your Jira site. Don't reuse old browser tabs and don't restart the session mid-flow: the OAuth link is tied to a live local callback and expires with it.
3. Optional: repeat for `figma`.

Finally, enable updates: `/plugin` → **Marketplaces** tab → `claude-dev-kit` → **Enable auto-update**. New kit versions will then arrive at session startup; without it, pull them manually with `claude plugin marketplace update claude-dev-kit`.

## First use — verify the setup

In a Claude session inside your project, just ask for a ticket:

```
fetch PROJ-1234
```

The kit will notice there is no configuration yet, discover your Jira site, project key, and custom fields via MCP, persist them to `.claude/dev-kit.json` (no secrets — commit it so teammates skip this step), and show the ticket summary. If that works, everything works.

## Day-to-day usage

| You want to… | Type |
|---|---|
| Work a story end to end (current window) | `/fullstack-dev-kit:work-story PROJ-1234` |
| Prepare a story worktree + new VS Code window | `/fullstack-dev-kit:launch-story PROJ-1234` |
| Unattended run (no plan gate — pipelines only) | append `--auto-approve` |
| Review a PR or your current diff | `/fullstack-dev-kit:pr-review #42` |
| Fix the findings on an existing PR | `/fullstack-dev-kit:fix-pr #42` |
| Anything else | plain language — e.g. *"use the pr-reviewer agent on PR #42"* |

Notes:

- Plugin **commands and skills** are namespaced under `/fullstack-dev-kit:` (type `/` and search). **Agents** never appear in that list — invoke them in plain language or let the orchestrator delegate to them (`/agents` shows them).
- `work-story` presents its implementation plan **in the chat** and waits for your explicit approval before writing any code.
- Reviews report in the conversation; nothing is approved or commented on GitHub without your confirmation.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/plugin isn't available in this environment` | You're in the VS Code chat panel — run plugin commands from a terminal with `claude plugin …` |
| `Unknown command: /work-story` | Session started before the install/update — restart the session (VS Code: *Developer: Reload Window*); remember the namespace `/fullstack-dev-kit:work-story` |
| OAuth callback lands on a dead `localhost:<port>` | The link expired (session restarted mid-flow) — run `/mcp` again and complete the fresh link immediately |
| Update pulled but behavior unchanged | `claude plugin install fullstack-dev-kit@claude-dev-kit` to force the new version, then restart the session; check `~/.claude/plugins/cache/claude-dev-kit/fullstack-dev-kit/` for the active version |

## Releasing (kit maintainers)

Users only receive changes when `version` in `.claude-plugin/plugin.json` is **bumped** — pushing commits without a bump updates nobody. Release = edit files → bump version → commit → push to `main`.

## Parallel stories — one worktree per story

`/work-story` runs each story in its **own git worktree** (isolated from your main checkout), so you can work several stories at once: open one Claude conversation per story and launch one `/work-story` in each. Or use `/launch-story PROJ-1234`: it creates the worktree, opens a **new VS Code window on it**, and hands you the exact command to paste there (`/fullstack-dev-kit:work-story PROJ-1234 --in-place`). Your working directory never gets dirtied by agent work, and each PR branch is built in isolation.

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
| `/launch-story` | command | Creates a story worktree and opens a new VS Code window on it, ready to run the pipeline |

## Quality gates (non-negotiable)

- No code before the plan is approved (unless `--auto-approve` for pipelines).
- Unit tests for touched files pass; coverage on touched files ≥ 95%.
- User-facing changes get e2e coverage (edge cases included) and the suites pass.
- Security pass (`security-reviewer`) with no blocking findings.
- Lint clean; no suppressions to dodge a gate.
- PR body carries the verification evidence; the Jira ticket gets the PR link and moves to review.

## Relationship to project repos

This kit is **project-agnostic and self-configuring**. Each consuming repo keeps its own `.claude/` with project-specific rules: build/test commands, architecture conventions, and stack subagents like `backend-implementer` / `frontend-implementer` (see the `dotnet-angular-claude-template` repo). The kit reads the consuming repo's `CLAUDE.md` for those conventions and its own `.claude/dev-kit.json` (auto-generated on first use) for Jira specifics.
