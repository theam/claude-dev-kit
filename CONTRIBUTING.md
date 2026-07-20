# Contributing to claude-dev-kit

Thanks for helping improve the kit. It is intentionally small — agents, skills, commands, and instructions written in Markdown, no build step — and intentionally generic: it ships as "iteration zero" and each organization layers its own rules on top in its consuming repos.

## Reporting issues

Issues are the most valuable contribution: the kit improves through the friction real teams hit. Please include:

- What you ran (the exact command, e.g. `/fullstack-dev-kit:work-story PROJ-1234`) and where (CLI, VS Code panel, Claude Desktop).
- What happened vs. what you expected — paste the relevant part of the session output.
- Your environment: `claude --version`, OS, and the active kit version (check `~/.claude/plugins/cache/claude-dev-kit/fullstack-dev-kit/`).
- Your stack if it is relevant (the kit targets C# (.NET) + Angular by default).

Check the troubleshooting table in the [README](README.md#troubleshooting) first — several common symptoms are covered there.

## Proposing changes

- **Keep the kit project-agnostic.** Nothing client-, company-, or project-specific may land here. Build/test commands, architecture conventions, and stack subagents belong in the consuming repo's `.claude/`, not in the kit.
- **One concern per pull request.** Small, reviewable diffs.
- **Words are the code.** Agents and skills are prompts: keep instructions imperative and short, match the existing tone, and avoid adding rules that duplicate what another file already enforces.
- **Don't weaken the gates.** The quality gates (plan approval, coverage ≥ 95%, e2e, security pass) are the product. Changes that relax them need a strong case in the PR description.

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
