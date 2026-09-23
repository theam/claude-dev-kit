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

`version` in `.claude-plugin/plugin.json` is what reaches installed clients — a change is only "live" once it's bumped, rebuilt, and released (see CONTRIBUTING.md → *Releases*). **A version bump reaches users only via a rebuild**, so bump and `build-codex-plugin.mjs` go together.

> ⚠️ **Heads-up:** setting the version inside a feature PR has caused collisions (two PRs claiming the same number). We're moving version management to a release job on `main` — see **#87**. Until that lands, if a change should reach users, bump the patch/minor and rebuild; once #87 lands, **stop editing the version file in PRs** and add a changeset instead. This file is updated as part of that migration.

Config that is **not** bundled into the plugin (this file, `.claude/dev-kit.json`, docs) needs **no** version bump.
