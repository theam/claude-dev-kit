# CLAUDE.md — claude-dev-kit

Conventions for anyone (human or agent) working **in this repo**. This is the repo that *is* the kit, so we **dogfood it**: develop new work through the kit's own flow — file it as a GitHub issue, run `/fullstack-dev-kit:work-story <#>` (plan gate → implement → gates → PR → `pr-review`/`fix-pr`), and let the gates below apply to the kit's own PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide; this file is the short, imperative version the agent reads first.

## What this repo is

A Claude Code / Agent-Plugins plugin: **agents, skills, commands, and instructions written in Markdown**, plus a small zero-dependency Node build/validate/test harness. It is intentionally **project- and stack-agnostic** — nothing client-, company-, or project-specific belongs here, and no skill/agent hardcodes a language, framework, or test runner (that lives in *consuming* repos). The one exception is the enumerated tracker / PR-host / design **adapters**.

## Canonical sources vs. the generated bundle

- **Edit the sources:** `agents/`, `skills/`, `codex/skills/`, `commands/`, `instructions/`.
- **Never hand-edit `plugins/fullstack-dev-kit/`** — it is *generated*. Change the source, then run the build. `scripts/lib/bundle-sources.mjs` is the single source of truth for what is copied/derived; the three bundle manifests (`.codex-plugin` / portable / cursor) are derived from `.codex-plugin/plugin.json`, and the version is synced from `.claude-plugin/plugin.json`.
- The two `contract.v1.json` copies (`telemetry/` + `packages/telemetry-relay/`) must stay **byte-identical**.

## The gates (this repo's own standard — what `work-story`/`create-pr` must run here)

This is a Markdown+scripts repo, so the usual coverage-% / e2e gates **do not apply** — do **not** scaffold a coverage tool or an e2e framework here. The gate is the harness below; all of it must pass before a PR, and a rebuild must leave the tree clean:

```bash
node scripts/build-codex-plugin.mjs   # refresh plugins/fullstack-dev-kit/ from sources
node scripts/validate-codex-plugin.mjs
node --test scripts/*.test.mjs        # drift guard, contract parity, PR-detect, stack-profile completeness
git diff --exit-code                  # a dirty tree = the bundle wasn't rebuilt/committed
```

CI (`.github/workflows/ci.yml`, the `verify` job) runs exactly this. A gate that genuinely doesn't apply is **reported as N/A with a reason**, never silently skipped.

## Writing conventions

- **Words are the code.** Agents and skills are prompts: imperative, short, matching the existing tone. Don't add a rule that another file already enforces.
- **Frontmatter:** agents use `model: inherit` + a `skills:` list; skills use `name` + a trigger-worthy `description`; commands use `description` (a usage line) + `$ARGUMENTS`.
- **One concern per PR**, small reviewable diffs, conventional-commit titles (`fix:` / `feat:` / `docs:` / `feat!:`).
- **Don't weaken the gates** — plan approval, security pass, and the adaptive quality gates are the product; relaxing them needs a strong case in the PR.
- **Docs travel with behavior:** a change to a skill/agent updates the `README.md` "What's inside" table (and any affected flow) **and** adds a `CHANGELOG.md` `[Unreleased]` entry, in the same PR.
- **Telemetry privacy is non-negotiable:** never send prompts, code, file names, ticket contents, emails, or org data (see [TELEMETRY.md](TELEMETRY.md)).

## Versioning (read before touching the version)

`version` in `.claude-plugin/plugin.json` is what reaches installed clients. **The release job owns it, not your PR** (#87):

- **Never edit** `.claude-plugin/plugin.json`'s version, a `## [X.Y.Z]` CHANGELOG heading, or a tag. `forbid-version-file` (a required check) fails a feature PR that touches the version file.
- **Instead:** give the PR a conventional title **and** conventional commit subjects (`fix:` → patch, `feat:` → minor, `feat!:` or a `BREAKING CHANGE` footer → flagged breaking): the squash subject the release reads is the PR title, or the commit's subject when the PR has one commit. Add the user-facing entry under `CHANGELOG.md` `[Unreleased]`. That subject and entry are the release's input.
- **Asked to "release" or "bump"?** Stop and say so: `.github/workflows/release.yml` keeps a `chore(release): X.Y.Z` PR open from `chore/release-next`, and merging it tags and publishes. `node scripts/release.mjs prepare --dry-run` previews the next release without writing anything.

See CONTRIBUTING.md → *Releases*. A change with no `[Unreleased]` entry (tooling, docs, this file) rides the next release.
