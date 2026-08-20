# Changelog

All notable changes to claude-dev-kit are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); the project follows SemVer.

The `version` in `.claude-plugin/plugin.json` is what reaches installed clients —
a release is only "live" for users once that is bumped and published.

## [Unreleased]
### Added
- **Azure DevOps as a PR host.** `create-pr` can now open the PR on Azure DevOps via `az repos pr create` (Azure CLI + `azure-devops` extension), alongside GitHub / GitLab / Bitbucket. The `prs_created` telemetry detector counts it too. Closes the gap where the tracker supported `azure` but PR creation didn't. Kit → **0.19.7**.
- **CI (GitHub Actions).** `.github/workflows/ci.yml` runs on every push to `main` and every PR: validate the bundle, `node --test`, then rebuild and `git diff --exit-code` to assert the committed bundle/manifests are in sync. Catches skip-build drift, stale manifests, and contract divergence automatically — the failure modes we previously found by hand.
- **Contract-parity guard.** `scripts/contract-parity.test.mjs` asserts the two `contract.v1.json` copies (client + relay) are byte-identical, so a property added to one but not the other can't silently drift.
- **`prs_created` telemetry (opt-in, anonymous).** Each session event now carries a **count** of pull requests opened, so aggregate impact can be measured by outcome (PRs shipped), not just token usage. Derived by matching the *executed* PR-create command per host (`gh pr create` · `glab mr create` · Bitbucket create-PR API) — never the PR's URL, repo, title, or body, and never the skill text that mentions the command. Added to the contract (both copies) and documented in `TELEMETRY.md`. Kit → **0.19.6** (client `scripts/telemetry.mjs` ships to users; relay redeploys with the new contract).

### Fixed
- **Bundle drift is now caught by validation.** `plugins/fullstack-dev-kit/{skills,instructions}/`
  are generated copies, but `validate-codex-plugin.mjs` only checked that referenced files
  *existed* — editing a stack profile and skipping the build shipped the old text to Codex,
  Cursor and Copilot while validation still passed. The validator now compares every copy
  against its source (and reports bundle files no source produces); builder and validator
  share one mapping in `scripts/lib/bundle-sources.mjs` so they cannot disagree. Covered by
  `scripts/validate-codex-plugin.test.mjs` (`node --test`). Tooling only — no plugin version bump.
- **The generated manifests are under the same guard.** The portable root
  `plugins/fullstack-dev-kit/plugin.json` is dual-emitted from `.codex-plugin/plugin.json`, but the
  validator only checked it *structurally* — editing the Codex manifest and skipping the build left
  the portable copy stale and validation still passed, the same bug class the tree guard was added
  for. The derivation now lives in `scripts/lib/bundle-sources.mjs`, and the validator re-derives and
  byte-compares, so "builder and validator cannot disagree" holds for the manifests too.
- **A skill name in two collections fails loudly.** `skills/` and `codex/skills/` deliberately copy
  into the same bundle directory; the same skill *name* in both was second-wins at build time and
  then unfixable drift at validation. Both now report it and exit non-zero. No collision exists today.
### Changed
- Bundle-guard tests run against a disposable copy of the tree instead of editing
  `instructions/stacks/php.md` in place. A run killed between the edit and its `finally` restore used
  to leave the working tree dirty, which then failed both the in-sync test and CONTRIBUTING's
  `git diff --exit-code` step on the next run.
- Removed a dead `DST_INSTR` constant left by the `bundle-sources` refactor.

## [0.19.5] - 2026-08-17
### Fixed
- **Listing `interface.category`.** OpenAI's plugin uploader rejects `Engineering`; changed to **`Developer Tools`** (a valid category in the portal's enum). Mirrored to the portable manifest by the build. Unblocks the OpenAI directory submission.

## [0.19.4] - 2026-08-14
### Added
- **Listing screenshots.** Wired 3 workflow screenshots into the plugin `interface` (mirrored to the portable manifest): the GitHub PR (AI-generated badge + verification evidence), the Codex plan-approval gate, and the updated Jira ticket — in `plugins/fullstack-dev-kit/assets/screenshots/`. With this, the listing metadata is complete. (Raw captures for now; design can drop in cropped/anonymized versions under the same filenames.)

## [0.19.3] - 2026-08-11
### Added
- **Directory-listing metadata (brand + submission readiness).** The plugin `interface` now carries the TAM brand assets — `logo` / `logoDark` (positive/negative 1024² icons), `composerIcon` (the `t•` symbol), `brandColor` `#000000` — plus `termsOfServiceURL` (Apache `LICENSE`) and richer `defaultPrompt` examples; the build mirrors it all into the portable manifest. Assets live in `plugins/fullstack-dev-kit/assets/` (icons/symbol only — no licensed fonts).
- **`SUBMISSION.md` runbook** for listing in the OpenAI Plugins Directory (+ Cursor / VS Code), with the skills-only strategy and review test cases (5 positive + 3 negative). Package is submission-ready; only optional screenshots + OpenAI identity verification remain.

## [0.19.2] - 2026-08-10
### Changed
- **Wizard install step is now agent-aware.** It no longer assumes Claude Code: the "install for Claude Code" step only appears **when the `claude` CLI is detected** (was an unconditional "Install with the Claude CLI?"), and the closing hint shows the right entry point per host (Claude `/fullstack-dev-kit:work-story` vs Codex/Cursor `$work-story`). Sections renumbered (Claude 6 · Codex 7 · Cursor 8); intro reworded for the multi-client kit. Wizard package → 0.1.2 (republish to npm for users to get it).

## [0.19.1] - 2026-08-10
### Added
- **Wizard installs for Cursor too.** `create-dev-kit` now detects Cursor and, on opt-in, drops the portable plugin into `~/.cursor/plugins/local/fullstack-dev-kit` (skills auto-load on restart; MCP enabled from Cursor Settings → Tools & MCP). Additive and idempotent; no telemetry on Cursor (tracking stays Codex/Claude only). Copilot install remains manual (its "Install Plugin From Source" is a VS Code UI action, not scriptable). Wizard package bumped to 0.1.1 — republish to npm for users to get it.
### Changed
- Refactored the shared `~/.dev-kit` checkout into an `ensureKitCheckout()` helper used by both the Codex sweep and the Cursor install.

## [0.19.0] - 2026-08-10
### Added
- **Portable Agent Plugins 1.0.0 manifest (multi-client).** `build-codex-plugin.mjs` now **dual-emits** a root `plugins/fullstack-dev-kit/plugin.json` following the open [Agent Plugins 1.0.0](https://agent-plugins.org) standard (OpenAI · AWS · Cursor · GitHub · Microsoft · Vercel), alongside the Codex-native `.codex-plugin/plugin.json`. Generated from one source; the `interface` metadata rides under the `com.theagilemonkeys.dev-kit` extensions namespace; `skills/` is shared. The same plugin is now loadable by other Agent-Plugins-compatible clients (Cursor, VS Code, Copilot, …), not just Codex.
  - **Verified against real `codex-cli 0.147`:** Codex *requires* `.codex-plugin/plugin.json` (a portable-only layout errors `missing plugin.json`), and installs cleanly with **both** manifests present — confirming dual-emit is the correct approach.
  - Validator extended: checks the portable manifest (`$schema` const, `name` pattern, closed-schema fields) and Agent Skills naming (hyphen-only skill dirs, frontmatter `name` matches the dir).
  - Portable `mcp.json` intentionally omitted — the 1.0.0 MCP schema has no OAuth field and our trackers use Codex curated connectors; portable clients handle connector auth themselves.
- **Portable `work-story` orchestration skill.** The end-to-end "ticket → PR" flow now travels to hosts without an orchestrator subagent (Codex, and other Agent-Plugins clients): a `work-story` skill carries the full pipeline (fetch → plan+approval → implement → adaptive gates + security → self-review → PR → update ticket) as a playbook the **host agent runs itself**. Shipped in the plugin bundle only (via `codex/skills/`), **not** in the Claude Code plugin — Claude Code keeps its richer `/work-story` command + `coding-agent` subagent (context isolation, two-phase plan gate) unchanged. Nothing is removed from Claude Code; this is purely additive for the other clients.

## [0.18.1] - 2026-08-10
### Changed
- **Codex plugin packaging hardening** (Phase 1 of aligning with the new open *Agent Plugins* standard):
  - **Validator** (`scripts/validate-codex-plugin.mjs`, run at the end of `build-codex-plugin.mjs`, zero-dep): checks the marketplace + plugin manifests against the enums confirmed on **codex-cli 0.147** (`installation`, `authentication`, source shape) and enforces a **self-contained bundle** — every `instructions/…` a bundled skill references must ship in the plugin. This is the check that would have caught the packaging bug `pr-review` found on #28.
  - Enriched the plugin `interface` (added `privacyPolicyURL` → `TELEMETRY.md`) toward Plugins Directory listing readiness.
### Removed
- The unverified `codex/hooks.json` template. Codex session hooks are feature-flagged on the desktop app and their on-disk format is version-specific; the kit delivers Codex telemetry via the hook-independent **sweep**, so shipping a guessed hooks file was wrong. Docs updated.

## [0.18.0] - 2026-07-31
### Added
- **Codex support (experimental).** The kit now targets OpenAI Codex (CLI + VS Code) alongside Claude Code.
  - **Telemetry differentiation:** new `agent` property in the contract (`claude-code` · `codex`), so aggregate usage in PostHog can be split by tool. One telemetry script serves both hosts — invoked with `--agent codex` on Codex, it reads token totals from Codex's session rollout JSONL and derives the surface (`cli` / `vscode`) from the Codex originator. Consent, install id, org, dedup and the outbox are shared across both hosts (`~/.claude/dev-kit-telemetry/`), set once per user.
  - **Delivery via a background sweep** (`telemetry.mjs --sweep`): the reliable, hook-independent path — a scheduled scan of `~/.codex/sessions` that flushes completed kit sessions (watermark + dedup, no history backfill, no-op without consent). Registered as a **launchd agent** on macOS. Chosen because the Codex desktop app currently feature-flags session hooks. Where hooks *are* available, `codex/hooks.json` (`Stop` + `SessionStart`) can be wired too and is deduplicated against the sweep.
  - **Native Codex plugin:** the repo doubles as a **Codex marketplace** (`.agents/plugins/marketplace.json` + `plugins/fullstack-dev-kit/` with `.codex-plugin/plugin.json`), so Codex installs the kit the same way it installs any plugin: `codex plugin marketplace add theam/claude-dev-kit` → `codex plugin add fullstack-dev-kit@claude-dev-kit`. The plugin's `skills/` **and the `instructions/` they reference** (secure-coding, testing-standards, stack profiles) are generated from the canonical top-level copies by `scripts/build-codex-plugin.mjs` — **one source of truth**, and a **self-contained bundle** so a native Codex install can run the kit's own security/testing/stack rules.
  - **Unified installer:** the `create-dev-kit` wizard installs natively for **whichever of Claude Code / Codex it detects** (both if both). For Codex it runs the marketplace/plugin add, **installs the curated connector your tracker choice implies** (Jira → `atlassian-rovo`, Linear → `linear`, Figma → `figma` — native OAuth; GitHub/Azure use their CLIs), and schedules the telemetry sweep.
  - **Validation status:** **verified end-to-end against real `codex-cli 0.147`** — `marketplace add` + `plugin add` install and enable the plugin; skills load and run in-app (the kit's own `$pr-review` reviewed this PR and caught a real packaging bug); the Atlassian connector authenticates and `issue-fetch` reads a Jira ticket; and the telemetry parser + sweep are confirmed on a real `~/.codex/sessions` rollout (cumulative `token_count` → correct split incl. `cache_write_input_tokens`; baseline/no-backfill, stale-only, kit-gate, watermark, idempotent). Session hooks are feature-flagged on the desktop app, so the sweep is the telemetry path (`codex/hooks.json` remains for builds where hooks are enabled).
- Requires a **relay redeploy** for the `agent` property to reach PostHog (contract change), same as the v0.14.0 rollout.

## [0.17.0] - 2026-07-29
### Added
- **Accessibility review for frontend changes** — folded into `pr-review` as a **conditional dimension**, not a new agent or extra pass:
  - Runs **only** when a diff changes user-facing UI in a frontend stack (components/templates/JSX/HTML/CSS); **skipped entirely — zero token cost — on backend/non-UI changes**.
  - Covers the high-value basics (alt text, form labels, accessible names, keyboard/focus, contrast, correct ARIA) on the changed markup, using the repo's own a11y tooling (axe-core, `eslint-plugin-jsx-a11y`, Lighthouse) if present — **never scaffolds one**. Findings target **WCAG 2.2 AA** and cite the specific Success Criterion, so they're verifiable rather than vague (no bundled rules file — the standard is stable and the citation keeps it grounded).
  - **Automatic and non-blocking by default; no setup required.** An optional top-level `"a11y"` key in `.claude/dev-kit.json` overrides: `auto` (default) · `required` (blocking gate) · `off`. Not asked in the setup wizard and not written by default — hand-edit it, or just ask the kit to change it (e.g. *"make accessibility a required gate"*).
  - `coding-agent` also nudges the implement step to write accessible markup up front for user-facing frontend work, so it's covered proactively — not only caught at self-review.

## [0.16.1] - 2026-07-28
### Fixed
- **Telemetry duplicate events**: a session could be reported twice (seen when Claude Desktop fires `SessionStart` more than once on reopen). Two causes, both closed:
  - The outbox flush deleted a marker only *after* the network send, so concurrent hook runs could both flush the same marker. Sends are now guarded by an **at-most-once claim** (an exclusive `sent-<id>` sentinel in `~/.claude/dev-kit-telemetry/`, GC'd past the marker hard-cap) — only the first caller sends.
  - The per-session dedup id fell back to a fresh random value independently on each code path, so re-sends of one session could carry *different* ids and never dedup. It is now **derived deterministically** from `install_id + session_id` (hashed locally — the real session id never leaves the machine), so every path produces the same id and PostHog collapses re-sends.
- Client-only change; no relay redeploy needed.

## [0.16.0] - 2026-07-28
### Added
- `pr-review`: an **optional, proportional adversarial check** for high-stakes diffs only (auth, money, personal data, migrations, concurrency, hard-to-roll-back) — a targeted skeptical second look, never a mandatory re-review of routine changes.
- `create-pr`: an **optional "Delivery readiness"** section (rollback, migrations, config/secrets, docs, breaking change) — included only when it applies, skipped for trivial changes.

Folded in as lightweight facets of existing skills — no new agents, no extra passes by default — to keep token cost down.

## [0.15.0] - 2026-07-28
### Added
- **PR review loop** improvements (adapted from an internal The Agile Monkeys review tool):
  - **PR intent statement** as the scope ruler in `pr-review` and `fix-pr` — a defect inside the intent blocks; a valid concern outside it is a follow-up, not PR expansion.
  - `fix-pr` now builds a **ledger** (one row per distinct claim, deduped across CI / reviewers / bots / self-review) with one verdict each: **FIX_NOW / DEFER_TO_ISSUE / DISCARD**.
  - **DEFER_TO_ISSUE** files a tracked issue via the configured tracker adapter instead of losing out-of-scope findings.
  - **Late-feedback watcher** (`scripts/watch-pr-feedback.sh`): after a push, `fix-pr` waits out slow bot/CI reviews on a backoff schedule and loops back to triage on anything new (GitHub; single re-check on other hosts).
  - Consent-first: answer every reviewer with the decision and resolve the thread (shown before posting).
### Changed
- `pr-review` gains explicit **performance-regression** and **duplication-introduced-here** dimensions; `testing-standards` adds the "the suite must be able to catch a revert of this change" standard.

## [0.14.0] - 2026-07-28
### Changed
- Outbox stale threshold 30 min → **10 min**, so sessions that never fire `SessionEnd` (e.g. Claude Desktop "new chat" doesn't) are flushed sooner on the next session start.
### Added
- **Per-session dedup**: the client sends a stable random `event_uuid` per session (not the real session id); the relay forwards it as the PostHog event `uuid` so re-sends of one session count once.
- **Org attribution falls back to the user level**: `org` is read from the repo's `.claude/dev-kit.json` first, then from `~/.claude/dev-kit-telemetry/config.json`. The wizard now stores `org` there too — so attribution works in worktrees and repos without a committed `telemetry.org`.
### Fixed
- Relay sets `$geoip_disable` on forwarded events. PostHog was geolocating the **relay's** IP (not the user's — the user's IP never reaches PostHog), which was noise; now suppressed.

*(Relay redeploys with this release — `packages/telemetry-relay` changed. Client changes reach users via the plugin version bump.)*

## [0.13.0] - 2026-07-27
### Changed
- Telemetry delivery is now robust to sessions that never close cleanly (crash or a session left open forever). Added an **outbox**: a `Stop` hook writes a cheap per-session marker (no transcript parse, no network) and `SessionStart` flushes stale markers from prior sessions; `SessionEnd` still sends immediately. Still one anonymous event per session, opt-in only; state in `~/.claude/dev-kit-telemetry/pending.json`, self-cleaning. No relay changes.

## [0.12.3] - 2026-07-27
### Changed
- Point `default_relay_url` at the live telemetry relay (`https://claude-dev-kit-telemetry-relay.vercel.app`). With this, opted-in clients actually reach the relay → PostHog. Verified end to end (relay returns `202 accepted`, contract enforced, IP discarded in PostHog).

## [0.12.2] - 2026-07-23
### Fixed
- Plugin failed to load its hook (`Duplicate hooks file detected`) on every install — Claude Code auto-loads `hooks/hooks.json`, so the redundant `hooks` field in `plugin.json` was removed. The telemetry hook still auto-loads.

## [0.12.1] - 2026-07-23
### Fixed
- Scope the npm package to the real org: `@theam/create-dev-kit` → **`@theagilemonkeys/create-dev-kit`** (install command: `npm create @theagilemonkeys/dev-kit`).

## [0.12.0] - 2026-07-22
### Changed
- **Adaptive quality gates** — coverage / unit-test / e2e gates now enforce the *project's own* standard, detected each run; they never impose tests or scaffold a framework on a project that doesn't use one. Optional `gates` config (`auto` (default) / `required` / `off`, plus `coverage.min`). Plan-approval and security passes remain non-adaptive.

## [0.11.0] - 2026-07-22
### Added
- Telemetry `entrypoint` property — which Claude Code surface ran the pipeline (CLI, VS Code / JetBrains extension, Claude Desktop Code tab, SDK).

## [0.10.0] - 2026-07-22
### Added
- **Angular, React, Vue** stack profiles (the frontend frameworks build on `node`).

## [0.9.0] - 2026-07-22
### Changed
- Research-backed enrichment of all stack profiles (accurate, current tooling; precision over length).

## [0.8.0] - 2026-07-22
### Added
- **Pluggable PR host** — Bitbucket and GitLab adapters alongside GitHub, configurable via `prHost`.

## [0.7.0] - 2026-07-21
### Added
- **Per-stack baseline profiles** (`instructions/stacks/`): node, python, dotnet, java, go, ruby, php, rust — with runtime stack detection and a no-`CLAUDE.md` fallback.

## [0.6.0] - 2026-07-21
### Added
- **Relay-based telemetry** (contract + relay; no key in the client, IP stripped) and the **`@theagilemonkeys/create-dev-kit`** interactive setup wizard.

## [0.5.0] - 2026-07-20
### Added
- Open-sourced and made **stack-agnostic**; issue-tracker adapters (Jira / Linear / GitHub Issues / Azure DevOps); Apache 2.0 license; anonymous opt-in telemetry (initial version).
### Removed
- The Playwright/ffmpeg demo-GIF step (didn't fit a multi-stack, multi-surface kit).
