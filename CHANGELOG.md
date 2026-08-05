# Changelog

All notable changes to claude-dev-kit are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); the project follows SemVer.

The `version` in `.claude-plugin/plugin.json` is what reaches installed clients —
a release is only "live" for users once that is bumped and published.

## [Unreleased]

## [0.18.0] - 2026-07-31
### Added
- **Codex support (experimental).** The kit now targets OpenAI Codex (CLI + VS Code) alongside Claude Code.
  - **Telemetry differentiation:** new `agent` property in the contract (`claude-code` · `codex`), so aggregate usage in PostHog can be split by tool. One telemetry script serves both hosts — invoked with `--agent codex` on Codex, it reads token totals from Codex's session rollout JSONL and derives the surface (`cli` / `vscode`) from the Codex originator. Consent, install id, org, dedup and the outbox are shared across both hosts (`~/.claude/dev-kit-telemetry/`), set once per user.
  - **Codex hooks** (`codex/hooks.json`): wires `Stop` + `SessionStart` (not `SessionEnd`, which Codex caps at ~1s). Requires a one-time `/hooks` trust in Codex.
  - **Shared-source workflow:** skill bodies made host-neutral (no hard Claude-Code-only references); the same `SKILL.md` files serve both hosts. Mapping documented in [`codex/README.md`](./codex/README.md).
  - **Unified installer:** the `create-dev-kit` wizard detects Codex and, on opt-in, anchors a stable checkout at `~/.dev-kit`, merges the telemetry hooks into `~/.codex/hooks.json` (never clobbering existing hooks), copies skills into `~/.agents/skills/`, and prints the `/hooks` trust step.
  - **Validation status:** verified here — the `agent` property, both telemetry parsers (Claude + Codex), and the installer's render/merge/copy logic. **Not yet verified against a live Codex install** — skill loading, the `/hooks` trust flow, and the orchestrator's Codex-native form still need a real-Codex test before this is announced.
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
