# claude-dev-kit

An open-source [Claude Code](https://code.claude.com) plugin by [The Agile Monkeys](https://www.theagilemonkeys.com): a **stack-agnostic issue-to-PR workflow** with enforced quality gates.

Give the `coding-agent` a user story ID from your tracker and it orchestrates the whole flow:

```
/work-story PROJ-1234
   │
   ├─ issue-fetch         → ticket summary + acceptance criteria + comments
   ├─ figma-fetch         → design context (if the ticket links Figma)
   ├─ PLAN + user approval (mandatory gate)
   ├─ implement           → follows the consuming repo's conventions & subagents
   ├─ coverage-check      → touched files meet the project's bar (default ≥ 95%)
   ├─ e2e-generate        → e2e tests (repo's framework) incl. edge cases
   ├─ security-reviewer   → authorization / secrets / input / exposure pass (gate)
   ├─ pr-review → pr-fixer → self-review, then fix the blocking findings
   ├─ create-pr           → branch + commit + PR with verification evidence
   └─ issue-update        → comment PR link on the ticket + move it to review
```

**Install in one command:**

```bash
npm create @theagilemonkeys/dev-kit
```

Interactive setup — tracker, Figma, telemetry consent, org — then it installs the plugin for you. Full options in [Installing in Claude Code](#installing-in-claude-code).

## Stack-agnostic by design

The kit carries **no assumptions about language, framework, or test runner**. It reads everything stack-specific — build/test/lint/coverage commands, architecture conventions, and any implementer subagents — from the **consuming repo's `CLAUDE.md` and `.claude/`**, and detects conventions from the project when they aren't declared.

It ships **baseline "iteration zero" profiles** for common stacks in [`instructions/stacks/`](instructions/stacks/) — **node, angular, react, vue, python, dotnet, java, go, ruby, php, rust** — giving each one usable coverage/e2e/lint commands out of the box. Your `CLAUDE.md` always overrides them, and adding a stack is one markdown file (see [CONTRIBUTING](CONTRIBUTING.md#adding-or-improving-a-stack-profile)). These profiles are early and community-refined — treat an unlisted or unverified stack as "should work, help us confirm" rather than guaranteed.

It integrates with your tools through **adapters**, not hardcoded dependencies:

| Concern | Supported | How it's chosen |
|---|---|---|
| Issue tracker | Jira, Linear, GitHub Issues, Azure DevOps | Detected/asked once by `dev-kit-setup`, stored in `.claude/dev-kit.json` |
| PR host | GitHub (`gh`), Bitbucket (REST), GitLab (`glab`) | Detected from the `origin` remote, stored as `prHost` |
| Design (optional) | Figma | Activated when a ticket links a Figma URL |

## Installing in Claude Code

The kit is a Claude Code **plugin**. Install it once per developer; it then loads in every session across every surface — the [CLI](https://code.claude.com), the desktop app, the VS Code / JetBrains extensions, and the web app (claude.ai/code).

**Prerequisites:** [Claude Code](https://code.claude.com) (`claude --version`) and the [GitHub CLI](https://cli.github.com) authenticated (`gh auth status`).

### Install with npm (recommended)

```bash
npm create @theagilemonkeys/dev-kit
```

The wizard picks your issue tracker and whether you use Figma, **shows exactly what anonymous telemetry would be collected and lets you opt in or out**, sets your organisation label, writes `.claude/dev-kit.json`, and runs the plugin install for you. Then authorize your connectors (below) and you're done.

### Manual install (what the wizard automates)

From a **terminal** — plugin management is CLI-only; the VS Code / JetBrains chat panels reject `/plugin` commands:

```bash
claude plugin marketplace add theam/claude-dev-kit
claude plugin install fullstack-dev-kit@claude-dev-kit
```

Installation is **user-level and permanent** — every future session (CLI or IDE extension) loads the kit automatically, no reinstall per session or project. Verify with `claude plugin list`, or type `/` in a session and search `fullstack-dev-kit:` (you should see `work-story`, `launch-story`, and the skills; agents show under `/agents`).

### Connect the tracker your team uses (one-time)

**The easiest way is to just ask the kit** — tell it, in plain language, what you want:

> *"Connect my Jira"* · *"Set up the Atlassian connector"* · *"Hook up Linear so you can read tickets"*

The kit knows the right connector for your tracker and runs the setup for you (installing/authorizing the MCP or connector), then walks you through the one browser sign-in. Get in the habit of delegating this kind of chore to it — that's the point of the kit.

If you'd rather do it by hand, here's what it runs under the covers:

**Claude Code** — the plugin **declares** the MCP servers (`atlassian`, `linear`, `figma`); you just authorize the ones you use:
- In a session: `/mcp` → pick the server → complete the browser OAuth. From the terminal: `claude mcp login atlassian`. Already in Claude Desktop? `claude mcp add-from-claude-desktop`.

**Codex** — install the matching **curated connector** (native OAuth), then sign in from the app:
- `codex plugin add atlassian-rovo@openai-curated` (Jira/Confluence) · `linear@openai-curated` · `figma@openai-curated`.

| Tool | Claude Code | Codex |
|---|---|---|
| Jira | `atlassian` MCP (`claude mcp login atlassian`) | `atlassian-rovo@openai-curated` |
| Linear | `linear` MCP (`claude mcp login linear`) | `linear@openai-curated` |
| GitHub Issues | — (uses `gh auth login`) | — (uses `gh`) |
| Azure DevOps | — (uses `az login`) | — (uses `az`) |
| Figma *(optional)* | `figma` MCP | `figma@openai-curated` |

Authorization is **per developer, one-time** — it persists across sessions. The kit then discovers the rest (Jira site, project key, field IDs) automatically on first use via `dev-kit-setup`.

> When authorizing an MCP via OAuth, complete the browser flow **immediately** — the link is tied to a live local callback and expires with it. Don't reuse old tabs or restart the session mid-flow.

### Enable auto-update

`/plugin` → **Marketplaces** tab → `claude-dev-kit` → **Enable auto-update**. New versions then arrive at session startup. To pull manually instead:

```bash
claude plugin marketplace update claude-dev-kit
```

> **Troubleshooting:** if `/work-story` is unknown, the session started before the install — restart it (VS Code: *Developer: Reload Window*) and remember the namespace `/fullstack-dev-kit:work-story`. More cases in [Troubleshooting](#troubleshooting) below.

### Team-wide install (optional — one config for everyone)

Instead of each developer running the two install commands, a consuming repo can commit the marketplace + plugin to its own `.claude/settings.json`. Teammates then get the kit when they open and **trust** the repo — in the CLI and the Desktop app's Code tab alike:

```json
{
  "extraKnownMarketplaces": {
    "claude-dev-kit": {
      "source": { "source": "github", "repo": "theam/claude-dev-kit" }
    }
  },
  "enabledPlugins": {
    "fullstack-dev-kit@claude-dev-kit": true
  }
}
```

Pin to a release by adding `"ref": "v0.5.0"` (or a `"sha"`) to `source`; omit it to always track the default branch. Requires the marketplace repo to be public (or teammates to have git access to it).

> Heads-up: auto-load on folder-trust is the intended behavior, but a known Claude Code issue ([#32606](https://github.com/anthropics/claude-code/issues/32606)) means some setups still need a one-time manual `claude plugin install fullstack-dev-kit@claude-dev-kit`. Test with one teammate before rolling out to everyone.

## First use — zero config

There is nothing to configure by hand. On first use in a repo, just ask for a ticket:

```
fetch PROJ-1234
```

The kit runs `dev-kit-setup`: it detects your tracker, discovers what it can (site/project/team/fields), asks only genuine choices, and persists the result to `.claude/dev-kit.json` — **no secrets, safe to commit**, so one setup serves the whole team. If that works, everything works.

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
- Reviews report in the conversation; nothing is approved or commented on the tracker/GitHub without your confirmation.

## Try it without a ticket

You don't need a tracker (or a ticket) to use the kit — the ticket integration is a convenience for auto-reading acceptance criteria and updating status, not a requirement. The fastest ways to try it in ~30 seconds, no tracker/MCP setup:

- **Review your current work:** `/fullstack-dev-kit:pr-review` on your working diff (or `pr-review #42` on a PR).
- **Drive the orchestrator from a description:** in plain language, e.g. *"use the coding-agent to add a `--dry-run` flag to the export command"* — it plans (you approve), implements, runs the applicable gates, and opens the PR, skipping the fetch/update-ticket steps.
- **Use a single skill:** `coverage-check`, `e2e-generate`, or the `security-reviewer` agent on the change you have in progress.

Full **`/work-story <TICKET>`** flow is ticket-first (it fetches the story and moves it to review); everything else works ticketless. Teams with no tracker can set `tracker: none` in `dev-kit-setup`.

## What's inside

| Component | Type | Purpose |
|---|---|---|
| `coding-agent` | agent | Orchestrator: story ID → PR → updated ticket, with plan-approval gate |
| `pr-reviewer` | agent | High-signal diff review: correctness, contract drift, security, tests |
| `pr-fixer` | agent | Resolves review/CI findings, re-verifies gates, pushes |
| `security-reviewer` | agent | Focused security pass: auth, secrets, input, exposure (gate) |
| `coverage-guardian` | agent | Finds files under 95% and writes the missing tests |
| `e2e-author` | agent | E2e tests in the repo's framework, with realistic edge cases |
| `dev-kit-setup` | skill | First-use bootstrap: detects the tracker, writes `.claude/dev-kit.json` |
| `issue-fetch` | skill | Ticket + acceptance criteria + comments (Jira/Linear/GitHub/Azure) |
| `issue-update` | skill | Comment PR + evidence on the ticket, transition to review |
| `figma-fetch` | skill | Frame hierarchy + text content from a Figma URL |
| `coverage-check` | skill | Runs the repo's coverage command, enforces the project's coverage bar (default 95%) when it has one |
| `e2e-generate` | skill | Playbook for creating/updating e2e tests |
| `create-pr` | skill | Branch, commit, and PR — only after all gates pass |
| `pr-review` | skill | Review playbook: findings by dimension, verdict, AC check |
| `fix-pr` | skill | Playbook: findings → fixes → re-verified gates → push |
| `instructions/` | rules | Always-on, language-agnostic: secure coding, testing standards |
| `/work-story` | command | Entry point: `/work-story PROJ-1234` |
| `/launch-story` | command | Creates a story worktree and opens a new VS Code window on it |

## Quality gates

**Always apply** (regardless of stack or test setup):

- No code before the plan is approved (unless `--auto-approve` for pipelines).
- Security pass (`security-reviewer`) with no blocking findings.
- PR body carries the verification evidence; the ticket gets the PR link and moves to review.

**Adaptive — enforce the project's *own* standard, detected each run** (the kit never imposes tests or scaffolds a framework on a project that doesn't use one):

- If the project has tests/coverage: touched files meet its bar (default ≥ 95%) and don't regress; suites pass; lint clean.
- User-facing changes get e2e **when the project already does e2e**.
- No test/e2e/lint setup → the kit **recommends** it and says so in the PR — it doesn't block. Teams wanting a hard bar set a `gates` policy (`auto` (default) · `required` · `off`) in `.claude/dev-kit.json`.
- **Accessibility (frontend only):** when a change touches user-facing UI in a frontend stack, the review automatically covers the a11y basics (alt text, labels, accessible names, keyboard/focus, contrast, correct ARIA) — using the repo's own a11y tooling if it has any, never scaffolding one. It's **automatic and non-blocking by default**, costs nothing on backend/non-UI changes, and needs no setup. To change it, set `"a11y"` in `.claude/dev-kit.json` to `auto` (default) · `required` (make it a blocking gate) · `off` (never run) — edit it by hand, or just **ask the kit to do it** (e.g. *"make accessibility a required gate"*) and it updates the file for you.

Either way, a skipped gate is **reported, never hidden**.

## Also runs on Codex (experimental)

The kit also targets **OpenAI Codex** (CLI + desktop app) as a **native Codex plugin**.
Codex has its own plugin system parallel to Claude Code's, so this repo doubles as a
Codex marketplace ([`.agents/plugins/marketplace.json`](./.agents/plugins/marketplace.json)
+ [`plugins/fullstack-dev-kit/`](./plugins/fullstack-dev-kit/), whose skills are
generated from the canonical top-level `skills/`). Install:

```bash
codex plugin marketplace add theam/claude-dev-kit
codex plugin add fullstack-dev-kit@claude-dev-kit
```

The setup wizard does this for whichever of Claude Code / Codex it finds, installs the
**Codex connector your tracker choice implies** (Jira → `atlassian-rovo`, Linear → `linear`,
Figma → `figma`, all curated with native OAuth; GitHub/Azure use their CLIs), and schedules
an anonymous **telemetry sweep** so Codex sessions
report usage tagged `agent: codex` (surface `cli` / `vscode`). *Validated against real
Codex 0.147: marketplace add, plugin install, and the telemetry parser/sweep. In-app
skill invocation and MCP auth are yours to confirm.* Details:
[`codex/README.md`](./codex/README.md).

## Relationship to project repos

Each consuming repo keeps its own `.claude/` with project-specific rules: build/test/lint/coverage commands, architecture conventions, and stack subagents (e.g. `backend-implementer` / `frontend-implementer`). The kit reads the consuming repo's `CLAUDE.md` for those conventions and its own `.claude/dev-kit.json` (auto-generated on first use) for tracker specifics.

## Parallel stories — one worktree per story

`/work-story` works **in the current directory**. To work several stories at once, use `/launch-story PROJ-1234` per story: it creates a dedicated git worktree, opens a **new VS Code window on it**, and hands you the `work-story` command to paste there.

> Caveat: stories whose e2e gates boot dev servers on fixed ports can collide if run at the exact same time — stagger them, or parameterize ports in the consuming repo.

## Extending the kit

Adding a tracker, PR host, or design tool is an **adapter**, not a rewrite — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the worked example.

## Telemetry (anonymous, opt-in, OFF by default)

The kit can share **anonymous token counts** so the maintainers can show aggregate impact. It is **off by default**; you opt in via the setup wizard (`npm create @theagilemonkeys/dev-kit`). Clients ship **no API key** and never call analytics directly — they POST to a [relay](./packages/telemetry-relay/) that re-enforces a [machine-readable contract](./telemetry/contract.v1.json) and strips your IP before forwarding to PostHog. Events are anonymous (a random `install_id`); never prompts, code, file names, ticket contents, emails, or org-instance data — and only sessions where the kit actually ran. Kill switch: `DEVKIT_TELEMETRY=0`. Runs in the CLI, IDE extensions, and the Desktop app's **Code tab** (needs Node on `PATH`). Full details and the exact payload: **[TELEMETRY.md](./TELEMETRY.md)**.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/plugin isn't available in this environment` | You're in the VS Code chat panel — run plugin commands from a terminal with `claude plugin …` |
| `Unknown command: /work-story` | Session started before the install/update — restart it (VS Code: *Developer: Reload Window*); remember the namespace `/fullstack-dev-kit:work-story` |
| OAuth callback lands on a dead `localhost:<port>` | The link expired (session restarted mid-flow) — run `/mcp` again and complete the fresh link immediately |
| Update pulled but behavior unchanged | `claude plugin install fullstack-dev-kit@claude-dev-kit` to force the new version, then restart the session |

## License

[Apache 2.0](./LICENSE) © The Agile Monkeys. See [NOTICE](./NOTICE).

> Headless/CI runs can't do MCP OAuth. If automated pipeline runs become a requirement, a REST + token fallback can be added to the tracker adapters.
