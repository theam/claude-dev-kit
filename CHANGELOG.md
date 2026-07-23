# Changelog

All notable changes to claude-dev-kit are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/); the project follows SemVer.

The `version` in `.claude-plugin/plugin.json` is what reaches installed clients —
a release is only "live" for users once that is bumped and published.

## [Unreleased]

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
