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
3. Run `node scripts/build-codex-plugin.mjs` and commit the result. `instructions/` and `skills/` are copied into `plugins/fullstack-dev-kit/` for Codex and the portable clients, so an edit that skips this ships the old text to them. `node scripts/validate-codex-plugin.mjs` fails if the copies are stale.
4. That's it — skills pick the profile up automatically via `stacks` in `.claude/dev-kit.json`. No prompt or agent rewiring needed (the skills are prompts).

## Testing your changes locally

Before pushing, rebuild the bundle and run the checks (no dependencies, no build step):

```bash
node scripts/build-codex-plugin.mjs   # refresh plugins/fullstack-dev-kit/ from the sources
node scripts/validate-codex-plugin.mjs
node --test                            # scripts/*.test.mjs
git diff --exit-code                   # a dirty tree here means the bundle was not committed
```

Then exercise it in a real session:

```bash
claude plugin marketplace add /path/to/your/clone
claude plugin install fullstack-dev-kit@claude-dev-kit
```

Restart your Claude session and exercise the changed component — for workflow changes, run `/fullstack-dev-kit:work-story` against a test ticket end to end.

## Releases (maintainers)

Users only receive a change once it ships in a release: a new `version` in `.claude-plugin/plugin.json`, tagged and published. There is no loud "update available" notification in Claude Code: with **auto-update** enabled the new version arrives silently at session start, otherwise users run `claude plugin marketplace update claude-dev-kit`. So we drive awareness via **GitHub Releases + CHANGELOG**.

**Feature PRs never set the version** (#87). Two branches can both claim the same number and both merge cleanly, so the number is derived on `main` instead. The required `forbid-version-file` check fails a PR that touches the version file. In your PR:

- Use a conventional title. Squash-merge makes it the commit subject the release reads. `feat:` bumps the minor, anything else the patch. `feat!:` or a `BREAKING CHANGE` footer also bumps the minor before 1.0 and is flagged as breaking in the release PR. 1.0.0 only happens by hand (`--bump major`).
- Add the user-facing entry under `CHANGELOG.md` `[Unreleased]`. That section becomes the release notes.

**How a release is cut** (`.github/workflows/release.yml`, running `scripts/release.mjs`):

1. On every push to `main` (and on manual dispatch, which can override the bump), the job computes the next version from the commits since the latest `v*` tag, writes it to `.claude-plugin/plugin.json`, moves `[Unreleased]` under `## [X.Y.Z] - <date>`, and rebuilds the bundle so every generated manifest matches.
2. It keeps one PR open: `chore(release): X.Y.Z` from `chore/release-next`. The commit subject and the branch are what let it through `forbid-version-file`. The PR body lists the commits that drove the bump and flags breaking ones.
3. **Merging that PR is the release decision.** The publish job checks the version is newer than every tag (Guard #2), tags `vX.Y.Z`, publishes the GitHub Release as Latest with that CHANGELOG section as notes, then checks the tag carries the version in every manifest (Guard #3).

Preview locally, without writing anything: `node scripts/release.mjs prepare --dry-run`. If commits landed but `[Unreleased]` is empty, the job opens no PR and leaves a warning on the run.

**One-time setup: the release GitHub App.** A PR opened with the workflow's `GITHUB_TOKEN` would not run the required checks, so the release PR is opened by a GitHub App:

1. Create a GitHub App owned by the organization (Settings → Developer settings → GitHub Apps → New). Webhook off. Repository permissions: **Contents: Read and write**, **Pull requests: Read and write** (Metadata: Read is implied). Nothing else.
2. Install it on `theam/claude-dev-kit` only.
3. Generate a private key. In this repo's Settings → Secrets and variables → Actions, add the variable `RELEASE_APP_CLIENT_ID` (the App's Client ID) and the secret `RELEASE_APP_PRIVATE_KEY` (the `.pem` contents).

Until both exist, the `release-pr` job fails and says what is missing. `publish` needs no App.

**Still manual:**

- The npm wizard, if it changed: `cd packages/create-dev-kit && npm version <bump> && npm publish` (see [its notes](packages/create-dev-kit/README.md); the plugin and the wizard version independently).
- The OpenAI Plugins Directory upload and the Cursor marketplace listing (see [SUBMISSION.md](SUBMISSION.md)).
- For internal teams, a note in your channel.

Encourage users to enable auto-update (`/plugin` → Marketplaces → `claude-dev-kit`) so a release reaches them automatically.

## License

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
