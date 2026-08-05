---
name: dev-kit-setup
description: First-use bootstrap for the dev kit. Detects the team's issue tracker, discovers what it can via MCP/CLI, asks only what cannot be discovered, and persists the result to .claude/dev-kit.json in the consuming repo. Use when that file is missing, when the user asks to set up or reconfigure the kit, or when issue-fetch cannot resolve its configuration.
---

# Dev Kit Setup

Make the kit self-sufficient: detect the tracker, discover everything possible automatically, ask the user only for genuine choices, and persist the result so **nobody on the team has to configure anything again**.

## When to run

- `.claude/dev-kit.json` does not exist (or lacks a `tracker` block) and a kit skill (e.g. `issue-fetch`) needs it.
- The user explicitly asks to set up or reconfigure the kit.
- A stored value turns out to be invalid (e.g. a field ID no longer exists) — re-discover just that value.

## 1. Determine the tracker

Pick `tracker.type` with the least friction:

1. If the triggering reference makes it obvious, use it (`PROJ-1234`/`ENG-42` → Jira/Linear key style; `#123` → GitHub/Azure).
2. Check which backends are actually available: is an Atlassian or Linear MCP authenticated? Is `gh` logged in for this repo? Is Azure DevOps configured?
3. If still ambiguous, **ask the user once** which tracker the team uses: Jira, Linear, GitHub Issues, or Azure DevOps.

Then run the matching discovery below. For any MCP/CLI that is not authenticated, **offer to set it up for them** (users are encouraged to just ask "connect my Jira" — do the work, don't only hand back a command):
- **Claude Code:** the tracker/design MCPs are plugin-declared (`atlassian`, `linear`, `figma`) — authorize with `claude mcp login <server>` (or tell them to run `/mcp` inside the session; the OAuth browser step is theirs to complete).
- **Codex:** install the curated connector and have them sign in from the app — `codex plugin add atlassian-rovo@openai-curated` (Jira/Confluence) · `linear@openai-curated` · `figma@openai-curated`.
- **GitHub / Azure:** `gh auth login` / `az login` (no MCP).

Run the command for them when you can; the OAuth/browser sign-in is always the user's step. Then stop — never continue with invented values until the backend is actually reachable.

## 2. Discover per tracker

### Jira
- **Site**: list accessible sites via the Atlassian MCP — one → use it; several → ask which.
- **Project key**: derive from the triggering ticket prefix and verify it exists; otherwise list projects and ask.
- **Custom fields (auto-detect, no questions)**: resolve field IDs by matching names case-insensitively — Acceptance Criteria ("Acceptance Criteria"/"AC"), Sprint ("Sprint"), Story Points ("Story Points"/"Story point estimate"). If a name matches nothing, inspect a recent issue's custom fields; if still ambiguous, ask once showing the candidates.

### Linear
- **Team**: list teams via the Linear MCP — one → use it; several → ask which. Store its `teamKey`.
- No custom-field discovery needed; acceptance criteria come from the issue body.

### GitHub Issues
- **Repo**: default to the current repo's `origin` (`gh repo view --json nameWithOwner`); confirm if the kit will track issues in a different repo.
- Nothing else to configure.

### Azure DevOps
- **Org and project**: read from the configured Azure DevOps connection or ask once. Store `org` and `project`.

## 3. Detect the stack(s)

Identify the tech stack from the project's files so the kit can load the right baseline commands. Match against the profiles in `instructions/stacks/` (each profile lists its detection signals), e.g.:

| Signal | Stack id |
|---|---|
| `package.json` | `node` |
| `angular.json` | `angular` |
| `react` / `react-dom` in `package.json` | `react` |
| `vue` in `package.json` | `vue` |
| `pyproject.toml` / `requirements*.txt` | `python` |
| `*.csproj` / `*.sln` | `dotnet` |
| `pom.xml` / `build.gradle` | `java` |
| `go.mod` | `go` |
| `Gemfile` | `ruby` |
| `composer.json` | `php` |
| `Cargo.toml` | `rust` |

A JS/TS frontend matches **both** `node` and its framework — prefer the **more specific** one (`angular`/`react`/`vue`); those profiles reference `node` for the shared toolchain. A monorepo may match several — record all of them (e.g. `["dotnet", "angular"]`). If nothing matches a shipped profile, record the closest label anyway and tell the user there is no stack profile yet (the kit still works from the repo's `CLAUDE.md` and generic rules — and contributing `instructions/stacks/<id>.md` is one small PR).

## 4. Persist

Write `.claude/dev-kit.json` at the consuming repo root. Only the active tracker's block is required:

```json
{
  "tracker": {
    "type": "jira",
    "site": "https://<org>.atlassian.net",
    "cloudId": "<discovered-cloud-id>",
    "projectKey": "PROJ",
    "fields": {
      "acceptanceCriteria": "customfield_XXXXX",
      "sprint": "customfield_XXXXX",
      "storyPoints": "customfield_XXXXX"
    },
    "reviewState": null
  },
  "stacks": ["node"],
  "prHost": "github",
  "gates": {
    "coverage": { "mode": "auto", "min": 95 },
    "e2e": { "mode": "auto" }
  },
  "test": {
    "coverageCommands": []
  }
}
```

Shape of `tracker` per type: **jira** → `site`, `cloudId`, `projectKey`, `fields`; **linear** → `teamKey`, optional `workspace`; **github** → `repo` (`owner/name`, optional if same as origin); **azure** → `org`, `project`. `stacks` is the detected stack id(s) — skills load `instructions/stacks/<id>.md` as their baseline. `prHost` is where PRs live — **detect it from the `origin` remote** (`github.com` → `github`, `bitbucket.org` → `bitbucket`, `gitlab.com` → `gitlab`; otherwise ask); `create-pr`/`pr-review`/`fix-pr` use it. For `bitbucket`/`gitlab`, remind the user that PR actions need a token/CLI authenticated (e.g. `BITBUCKET_TOKEN`, or `glab auth login`). `reviewState` is filled the first time `issue-update` transitions an item, then reused. `test.coverageCommands` is optional — `coverage-check` fills it in when it detects the repo's coverage command.

**Quality gates — mostly auto-detected, one preference optionally asked.** The full optional shape:

```json
"gates": {
  "coverage": { "mode": "auto", "min": 95 },
  "e2e":      { "mode": "auto" }
}
```

- `mode`: **`auto`** (default — detect each run whether the project has the setup and enforce only then) · `required` (hard-fail even if absent) · `off` (skip). **Never detect-and-store `mode`** — a project's test setup changes over time, so it's resolved at runtime (see `instructions/testing-standards.md`).
- `coverage.min`: the coverage bar for touched files (**default 95**). This is a *stable team preference*, not a moving property — so **ask it once here** and persist it: **only if you detected a test/coverage setup**, ask "Minimum coverage to hold touched files to? [95]" and store the answer under `gates.coverage.min`. If the repo has no tests, don't ask (nothing to gate). Do **not** ask `mode` — leave it auto. Teams can hand-edit `mode` to `required`/`off` later.

**Optional top-level `a11y` key** (accessibility review for frontend diffs — honored by `pr-review`):

```json
{ "a11y": "auto" }
```

`auto` (default, and the value when the key is **absent** — run the a11y basics only on user-facing frontend diffs) · `required` (make it a blocking gate) · `off` (never run). **Do not ask this in setup and do not write it by default** — leave it absent so the default `auto` applies. Only write it when the user explicitly asks (e.g. *"make accessibility a required gate"* / *"turn off the a11y checks"*): set the key to the requested value, preserving the rest of the file.

**If the repo has no `CLAUDE.md`:** say so, proceed using the stack profile(s) + detected commands as the baseline, and suggest the user run `/init` (or let the kit propose a minimal `CLAUDE.md`) so future runs are grounded in the repo's own conventions. Never silently assume conventions the repo hasn't stated.

- This file contains **no secrets** (auth lives in each developer's MCP OAuth grant or CLI login) — it is safe and intended to be committed, so one setup serves the whole team.
- Tell the user the file was created and suggest committing it.

## 5. Design tool (optional)

Figma needs no configuration — file keys come from URLs, auth is the MCP OAuth. Verify authentication lazily, only when a Figma URL first appears.

## 6. Telemetry (optional, opt-in, off by default)

Do not enable or configure telemetry here, and never turn it on silently. If the user asks about it, point them to `TELEMETRY.md` and the plugin's `telemetry_enabled` option (set per developer). Absent an explicit opt-in, it stays off.

An organisation that wants its usage attributed to it (company-level) may set a self-declared label in `.claude/dev-kit.json`:

```json
{ "telemetry": { "org": "acme-corp" } }
```

This is optional, organisation-level (not per-person), and only ever set deliberately by the team — never derive it from a git email, commit author, or remote URL. Only add it if the user explicitly asks for company attribution.

## After setup

Continue seamlessly with whatever task triggered the bootstrap (e.g. proceed with the `issue-fetch` that was interrupted). Setup must feel like a one-time speed bump, not a separate ceremony.
