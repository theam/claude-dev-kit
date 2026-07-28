# Changelog

All notable changes to claude-dev-kit are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); the project follows SemVer.

The `version` in `.claude-plugin/plugin.json` is what reaches installed clients —
a release is only "live" for users once that is bumped and published.

## [Unreleased]

## [0.15.0] - 2026-07-28
### Added
- **PR review loop** improvements (adapted from `theam/monkey-skills` · `tam-pr-review-loop`):
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
