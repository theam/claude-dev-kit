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
   ├─ coverage-check      → every touched file ≥ 95% (line/branch/function)
   ├─ e2e-generate        → e2e tests (repo's framework) incl. edge cases
   ├─ security-reviewer   → authorization / secrets / input / exposure pass (gate)
   ├─ pr-review → pr-fixer → self-review, then fix the blocking findings
   ├─ create-pr           → branch + commit + PR with verification evidence
   └─ issue-update        → comment PR link on the ticket + move it to review
```

## Stack-agnostic by design

The kit carries **no assumptions about language, framework, or test runner**. It reads everything stack-specific — build/test/lint/coverage commands, architecture conventions, and any implementer subagents — from the **consuming repo's `CLAUDE.md` and `.claude/`**, and detects conventions from the project when they aren't declared. Use it with .NET, Node, Python, Go, Rust, Java, or anything else.

It integrates with your tools through **adapters**, not hardcoded dependencies:

| Concern | Supported | How it's chosen |
|---|---|---|
| Issue tracker | Jira, Linear, GitHub Issues, Azure DevOps | Detected/asked once by `dev-kit-setup`, stored in `.claude/dev-kit.json` |
| PR host | GitHub (`gh` CLI) | Default; other hosts can be added as adapters |
| Design (optional) | Figma | Activated when a ticket links a Figma URL |

## Installing in Claude Code

The kit is a Claude Code **plugin**. Install it once per developer; it then loads in every session across every surface — the [CLI](https://code.claude.com), the desktop app, the VS Code / JetBrains extensions, and the web app (claude.ai/code).

**Prerequisites**

- [Claude Code](https://code.claude.com) installed and signed in — verify with `claude --version`.
- [GitHub CLI](https://cli.github.com) authenticated — verify with `gh auth status`.

### 1. Add the marketplace and install the plugin

Run these from a **terminal**. Plugin management is CLI-only — the VS Code / JetBrains chat panels reject `/plugin` commands.

```bash
claude plugin marketplace add theam/claude-dev-kit
claude plugin install fullstack-dev-kit@claude-dev-kit
```

This is **user-level and permanent**: every future session (CLI or IDE extension) loads the kit automatically — you never reinstall per session, per window, or per project.

### 2. Verify it loaded

Start a session (`claude` in a terminal, or the IDE panel — reload the window if it was open during the install) and confirm the plugin is active:

```bash
claude plugin list          # fullstack-dev-kit should appear as installed + enabled
```

In a session, type `/` and search for `fullstack-dev-kit:` — you should see `work-story`, `launch-story`, and the skills. (Agents don't appear in that list; `/agents` shows them.)

### 3. Authorize the connectors your team uses (one-time)

Run `/mcp` in a session, or use your claude.ai connector settings:

| Tool | Connector | Auth |
|---|---|---|
| Jira | `atlassian` MCP | `/mcp` → OAuth |
| Linear | `linear` MCP | `/mcp` → OAuth |
| GitHub Issues | — (uses `gh`) | `gh auth login` |
| Azure DevOps | — (uses `az`) | `az login` |
| Figma *(optional)* | `figma` MCP | `/mcp` → OAuth |

> When authorizing an MCP via OAuth, complete the browser flow **immediately** — the link is tied to a live local callback and expires with it. Don't reuse old tabs or restart the session mid-flow.

### 4. Enable auto-update

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
| `coverage-check` | skill | Runs the repo's coverage command, enforces the 95% gate |
| `e2e-generate` | skill | Playbook for creating/updating e2e tests |
| `create-pr` | skill | Branch, commit, and PR — only after all gates pass |
| `pr-review` | skill | Review playbook: findings by dimension, verdict, AC check |
| `fix-pr` | skill | Playbook: findings → fixes → re-verified gates → push |
| `instructions/` | rules | Always-on, language-agnostic: secure coding, testing standards |
| `/work-story` | command | Entry point: `/work-story PROJ-1234` |
| `/launch-story` | command | Creates a story worktree and opens a new VS Code window on it |

## Quality gates (non-negotiable)

- No code before the plan is approved (unless `--auto-approve` for pipelines).
- Unit tests for touched files pass; coverage on touched files ≥ 95%.
- User-facing changes get e2e coverage (edge cases included) and the suites pass.
- Security pass (`security-reviewer`) with no blocking findings.
- Lint clean; no suppressions to dodge a gate.
- PR body carries the verification evidence; the ticket gets the PR link and moves to review.

## Relationship to project repos

Each consuming repo keeps its own `.claude/` with project-specific rules: build/test/lint/coverage commands, architecture conventions, and stack subagents (e.g. `backend-implementer` / `frontend-implementer`). The kit reads the consuming repo's `CLAUDE.md` for those conventions and its own `.claude/dev-kit.json` (auto-generated on first use) for tracker specifics.

## Parallel stories — one worktree per story

`/work-story` works **in the current directory**. To work several stories at once, use `/launch-story PROJ-1234` per story: it creates a dedicated git worktree, opens a **new VS Code window on it**, and hands you the `work-story` command to paste there.

> Caveat: stories whose e2e gates boot dev servers on fixed ports can collide if run at the exact same time — stagger them, or parameterize ports in the consuming repo.

## Extending the kit

Adding a tracker, PR host, or design tool is an **adapter**, not a rewrite — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the worked example.

## Telemetry (anonymous, opt-in, OFF by default)

The kit can share **anonymous token counts** to [PostHog](https://posthog.com) so the maintainers can show aggregate impact. It is **off by default** and sends **only** when a developer enables it (`telemetry_enabled`). Events are anonymous (a random `installId`, no person profile); it never sends prompts, code, file names, ticket contents, emails, or org — and only counts sessions where the kit actually ran. The whole implementation is one auditable file, [`scripts/telemetry.mjs`](./scripts/telemetry.mjs). Kill switch: `DEVKIT_TELEMETRY=0`. It runs in the CLI, the IDE extensions, and the Desktop app's **Code tab** (local/SSH sessions), and needs Node on `PATH` (restart the desktop app if it can't find Node). Full details and the exact payload: **[TELEMETRY.md](./TELEMETRY.md)**.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `/plugin isn't available in this environment` | You're in the VS Code chat panel — run plugin commands from a terminal with `claude plugin …` |
| `Unknown command: /work-story` | Session started before the install/update — restart it (VS Code: *Developer: Reload Window*); remember the namespace `/fullstack-dev-kit:work-story` |
| OAuth callback lands on a dead `localhost:<port>` | The link expired (session restarted mid-flow) — run `/mcp` again and complete the fresh link immediately |
| Update pulled but behavior unchanged | `claude plugin install fullstack-dev-kit@claude-dev-kit` to force the new version, then restart the session |

## License

[MIT](./LICENSE) © The Agile Monkeys.

> Headless/CI runs can't do MCP OAuth. If automated pipeline runs become a requirement, a REST + token fallback can be added to the tracker adapters.
