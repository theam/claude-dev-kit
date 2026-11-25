# Definition: `create-pr.body` hook PoC (RFC #92)

Status: draft for PO approval · 2026-11-25 · branch `poc/92-hooks-extension-points` (local, not for sharing)

Provenance: `[PO]` decided by the PO · `[spark]` from RFC #92 · `[proposed]` suggested, not yet confirmed · `[unverified]` nobody has checked.

## Problem

- Consuming repos can't attach their own behaviour to kit workflow steps. The only hook today is telemetry, which is Claude-Code-only and fires on tool calls, not workflow steps. `[spark]`
- Nobody knows whether a prompt-level hook reliably fires. `[spark]`

## Users

- Teams consuming the kit who want to extend PR bodies. `[spark]`
- For this PoC: the PO, exploring privately. `[PO]`

## Goal

Answer one question: does a skill reliably find and follow a consuming-repo hook at a declared point? `[PO]`

## Chosen direction

- **Shared resolver.** One `instructions/hooks.md` holds the resolution protocol; `create-pr` carries a single line naming the point `create-pr.body`. `[PO]`
- **Opt-in.** Handlers are listed in a `hooks` block in `.claude/dev-kit.json`; a file existing is not enough to run it. `[PO]`
- **Both handler kinds.** `.md` (prompt fragment) and `.sh` (stdout injected). `[PO]`
- **Append only.** A hook adds sections; it never replaces or removes. The AI badge, AI footer and `ai-generated` label are untouchable by construction. `[PO]`
- **Failure: warn and continue.** Open the PR with the default body and report the hook failure in the summary. `[PO]`
- **One handler per point.** `[PO]`
- **Test handler:** a trivial one (e.g. adds a "Rollout notes" section). `[proposed]`

## Alternatives set aside

- File convention only: zero config, but file-exists-means-runs leaves trust open. `[proposed]`
- Config-declared with the rules inline in each skill: rules get copied per skill. `[proposed]`

## Success

- One eval per handler kind, following `evals/gate-drift` (stubbed `gh`, headless run, assertions on the recorded PR body). `[PO]`
- Bar: smoke run, N=1 per scenario. `[PO]` A pass rate at N≥5 on the production model is **not established** and is needed before the result is quoted on the RFC.
- Scenarios `[proposed]`:
  1. Hook opted in → appended section present, badge and footer intact.
  2. Hook file present but not opted in → section absent.
  3. No hook → default body unchanged (control).
  4. Failing `.sh` → default body plus a warning.

## Non-goals

- Any point or skill other than `create-pr.body`. `[PO]`
- Screenshot / image-upload handler. `[PO]`
- Multiple handlers and ordering. `[PO]`
- Replace semantics. `[PO]`
- README, CHANGELOG, version bump. `[PO]`
- Pushing the branch or opening a PR. `[PO]`

## Risks and unknowns

- `.md` hooks are advisory; the model may decline them. The eval measures this, it doesn't fix it. `[spark]`
- `.sh` hooks run repo code. Opt-in mitigates; trust is not designed here. `[spark]`
- Whether the resolver travels to the Codex/Cursor bundles: `[unverified]`. The evals run Claude Code only.
- Whether a shared instruction keeps per-skill prompt cost low: `[unverified]` with a single point wired.
- N=1 is a smoke result, not a measurement; a single pass can be luck. `[spark]` (gate-drift README)
- The bundle must still be rebuilt (`node scripts/build-codex-plugin.mjs`) or the validator fails on stale copies. `[spark]`

## What this PoC does not answer

- Append-only narrows the RFC's "does an override actually override?" to "does a hook fire?". Replace stays open.
- The governance rule (ship points, never handlers) is untouched: the test handler lives in an eval fixture, not in the kit.

## Open questions

- The PO flagged one more non-goal ("something else") without naming it.
- Pass-rate threshold for a real measurement.
- Ordering and precedence with several handlers.
- Per-hook configurable failure mode (block vs. warn).
- Feasibility of the screenshot case.
