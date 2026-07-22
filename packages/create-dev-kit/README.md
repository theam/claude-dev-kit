# @theagilemonkeys/create-dev-kit

Interactive setup for the [**claude-dev-kit**](https://github.com/theam/claude-dev-kit) Claude Code plugin — an issue-to-PR workflow with enforced quality gates, for any tech stack.

```bash
npm create @theagilemonkeys/dev-kit
```

Zero dependencies (Node built-ins only), so it's trivial to audit before you run it.

## What it does

Walks you through setup and writes the config, then installs the plugin:

1. **Issue tracker** — Jira / Linear / GitHub Issues / Azure DevOps / none (with a hint on how to connect its MCP/CLI).
2. **Pull request host** — GitHub / Bitbucket / GitLab / other.
3. **Design** — whether you link Figma in tickets.
4. **Telemetry** — shows exactly what anonymous usage data would be collected and lets you **opt in or out** (off by default).
5. **Organisation** — an optional label to attribute your usage (company-level, never a person).

It writes:

- `.claude/dev-kit.json` in the repo (tracker, PR host, Figma, org) — commit it; shared by your team.
- `~/.claude/dev-kit-telemetry/config.json` (per user, private) — your telemetry choice.

Then it can run the `claude plugin` install commands for you.

## Requirements

- [Claude Code](https://code.claude.com) (`claude --version`).
- The relevant CLI/MCP for your tracker & PR host (the wizard tells you which).

## Privacy

Telemetry is **off by default** and, if enabled, sends only anonymous token counts via a relay — never prompts, code, file names, ticket content, emails, or your IP. Full details: [TELEMETRY.md](https://github.com/theam/claude-dev-kit/blob/main/TELEMETRY.md).

## License

[Apache 2.0](https://github.com/theam/claude-dev-kit/blob/main/LICENSE) © The Agile Monkeys.
