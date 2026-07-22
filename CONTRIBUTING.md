# Contributing to claude-dev-kit

Thanks for helping improve the kit. It is intentionally small — agents, skills, commands, and instructions written in Markdown, no build step — and intentionally generic: it ships as "iteration zero", carries **no assumptions about language or framework**, and each organization layers its own rules on top in its consuming repos. It is maintained by [The Agile Monkeys](https://www.theagilemonkeys.com) and open to community contributions.

## Reporting issues

Issues are the most valuable contribution: the kit improves through the friction real teams hit. Please include:

- What you ran (the exact command, e.g. `/fullstack-dev-kit:work-story PROJ-1234`) and where (CLI, VS Code panel, Claude Desktop Code tab).
- What happened vs. what you expected — paste the relevant part of the session output.
- Your environment: `claude --version`, OS, and the active kit version (check `~/.claude/plugins/cache/claude-dev-kit/fullstack-dev-kit/`).
- Your stack and tracker if relevant (the kit is stack-agnostic and supports Jira / Linear / GitHub Issues / Azure DevOps).

Check the troubleshooting table in the [README](README.md#troubleshooting) first — several common symptoms are covered there.

## Repo layout

| Path | What it holds |
|---|---|
| `agents/` | Subagent definitions (orchestrator, reviewers, fixers) |
| `skills/` | Skill playbooks — one folder per skill, each with a `SKILL.md` |
| `commands/` | Slash commands (`/work-story`, `/launch-story`) |
| `instructions/` | Always-on, language-agnostic rules (secure coding, testing standards) |
| `instructions/stacks/` | Per-stack baseline profiles (commands, coverage format, e2e, conventions) |
| `hooks/` + `scripts/` | Opt-in telemetry hook and its script (see [TELEMETRY.md](TELEMETRY.md)) |
| `.claude-plugin/` | Plugin + marketplace manifests |
| `.mcp.json` | Declared MCP servers (trackers, design tools) |

## Proposing changes

- **Keep the kit project-agnostic and stack-agnostic.** Nothing client-, company-, or project-specific may land here, and no skill or agent should hardcode a language, framework, or test runner. Build/test/coverage commands, architecture conventions, and stack subagents belong in the consuming repo's `.claude/`, not in the kit. (The one exception is the tracker/PR-host/design *adapters*, which are explicitly enumerated.)
- **Adapters are additive.** Adding a tracker (or PR host, or design tool) means adding an adapter section to the relevant skill and a detection branch to `dev-kit-setup` — not rewiring the workflow.
- **One concern per pull request.** Small, reviewable diffs.
- **Words are the code.** Agents and skills are prompts: keep instructions imperative and short, match the existing tone, and avoid adding rules that duplicate what another file already enforces.
- **Don't weaken the gates.** The quality gates (plan approval, coverage ≥ 95%, e2e, security pass) are the product. Changes that relax them need a strong case in the PR description.
- **Docs travel with behavior.** A change to a skill/agent updates the `README.md` "What's inside" table and any affected flow description in the same PR.

## Adding a tracker adapter (worked example)

1. Add a `### <Tracker> (\`type: "..."\`)` section to both `skills/issue-fetch/SKILL.md` and `skills/issue-update/SKILL.md`, describing exactly how to fetch/comment/transition via that tracker's MCP or CLI.
2. Add a detection branch and a config shape to `skills/dev-kit-setup/SKILL.md`.
3. If it uses an HTTP MCP, declare it in `.mcp.json`. If it uses a CLI (like `gh`), note the auth step instead.
4. Update the reference-shape table in `issue-fetch` and the `README.md`.

## Adding or improving a stack profile

The kit ships baseline "iteration zero" profiles for common stacks in [`instructions/stacks/`](instructions/stacks/) (node, python, dotnet, java, go, ruby, php, rust). **The most useful contribution is a corrected or new profile from someone who works in that stack daily.**

1. Add or edit `instructions/stacks/<id>.md` following the format in [`instructions/stacks/README.md`](instructions/stacks/README.md): detection signals, commands (incl. test-with-coverage → report path + format), e2e framework, conventions and prerequisites.
2. Add the detection signal to the table in `skills/dev-kit-setup/SKILL.md` if the stack is new.
3. That's it — skills pick the profile up automatically via `stacks` in `.claude/dev-kit.json`. No code to touch (the skills are prompts).

## Testing your changes locally

```bash
claude plugin marketplace add /path/to/your/clone
claude plugin install fullstack-dev-kit@claude-dev-kit
```

Restart your Claude session and exercise the changed component — for workflow changes, run `/fullstack-dev-kit:work-story` against a test ticket end to end.

## Releases (maintainers)

Users only receive changes when `version` in `.claude-plugin/plugin.json` is bumped — merging without a bump updates nobody. Release = merge → bump version → push to `main`. See the README's "Releasing" section.

## License

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
