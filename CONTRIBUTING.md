# Contributing to claude-dev-kit

Thanks for wanting to improve the kit. It is maintained by [The Agile Monkeys](https://www.theagilemonkeys.com) and open to community contributions.

## What the kit is

A Claude Code plugin that runs a **stack-agnostic issue-to-PR workflow**: fetch a user story from the team's tracker, plan (with a mandatory human approval gate), implement, enforce quality gates (>95% coverage, e2e, security), open the PR, and move the ticket to review. It carries **no assumptions about language or framework** — everything stack-specific lives in the consuming repo's `CLAUDE.md` and `.claude/`.

## Repo layout

| Path | What it holds |
|---|---|
| `agents/` | Subagent definitions (orchestrator, reviewers, fixers) |
| `skills/` | Skill playbooks — one folder per skill, each with a `SKILL.md` |
| `commands/` | Slash commands (`/work-story`, `/launch-story`) |
| `instructions/` | Always-on, language-agnostic rules (secure coding, testing standards) |
| `.claude-plugin/` | Plugin + marketplace manifests |
| `.mcp.json` | Declared MCP servers (trackers, design tools) |

## Ground rules for changes

1. **Keep it stack-agnostic.** No skill or agent should hardcode a language, framework, or test runner. If a change needs stack detail, read it from the consuming repo's config or detect it — never bake it in. (The one exception is the tracker/VCS/design *adapters*, which are explicitly enumerated.)
2. **Adapters are additive.** Adding a tracker (or PR host, or design tool) means adding an adapter section to the relevant skill and a detection branch to `dev-kit-setup` — not rewiring the workflow.
3. **The gates are the product.** Don't add ways to bypass the plan-approval gate, the coverage gate, or the security pass. Guardrails against skipping them are welcome.
4. **Docs travel with behavior.** A change to a skill/agent updates the `README.md` "What's inside" table and any affected flow description in the same PR.

## Adding a tracker adapter (worked example)

1. Add a `### <Tracker> (\`type: "..."\`)` section to both `skills/issue-fetch/SKILL.md` and `skills/issue-update/SKILL.md`, describing exactly how to fetch/comment/transition via that tracker's MCP or CLI.
2. Add a detection branch and a config shape to `skills/dev-kit-setup/SKILL.md`.
3. If it uses an HTTP MCP, declare it in `.mcp.json`. If it uses a CLI (like `gh`), note the auth step instead.
4. Update the reference-shape table in `issue-fetch` and the `README.md`.

## Releasing (maintainers)

Users only receive changes when `version` in `.claude-plugin/plugin.json` is **bumped**. Release = edit files → bump version → commit → push to `main`.

## License

By contributing you agree that your contributions are licensed under the [MIT License](./LICENSE).
