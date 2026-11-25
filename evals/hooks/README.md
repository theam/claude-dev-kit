# Hooks eval suite (RFC #92 PoC)

Behavioral evals for the one wired extension point, `create-pr.body`: does a
consuming-repo hook actually fire? Run against **this checkout's own**
`skills/create-pr/SKILL.md` and `instructions/` — `run/run.sh` stages them into
a throwaway consuming repo (outside this checkout) before each session.

## Design

- **Oracle**: the PR body the session hands to a stubbed `gh pr create`
  (`stubs/gh` captures `--body` / `--body-file`; nothing touches the network).
- **`.sh` handlers write a run log** — reading a script is not running it.
- **The prompt never mentions hooks**: the skill has to find the point itself.
- **h4-control proves sensitivity**: a default body is captured with no hook.
- The handlers live in `fixtures/handlers/` — the kit ships points, never handlers.

## Scenarios

| Scenario | Setup | Expects |
| --- | --- | --- |
| `h4-control` | no hook | default body; badge + footer; no marker |
| `h1-md` | `.md` handler, opted in | marker section appended after the required sections |
| `h2-sh` | `.sh` handler, opted in | handler ran (run log) and its stdout is in the body |
| `h3-not-opted-in` | both handlers on disk, no `hooks` entry | no marker; `.sh` never ran |
| `h5-sh-fail` | `.sh` exits 3 | PR still opens with the default body; failure reported; nothing invented |
| `baseline` | all captured bodies | the full kit AI footer is intact (create-pr drift, not a hook effect) |

## Run it

    bash run/run.sh h4-control        # sensitivity first
    bash run/run.sh h1-md             # … h2-sh, h3-not-opted-in, h5-sh-fail
    node --test assert/hooks-evals.test.mjs

`MODEL=<model>` overrides the default (haiku). `RUN_ID=r1` suffixes outputs for
N-run matrices (set it for the assertions too). A scenario with no results is
skipped, never passed.

`bash run/matrix.sh` runs every scenario N times (default `N=5`, `MODEL=sonnet`),
asserts each round, and prints the pass rate per test.

## Status 2026-11-25

**Matrix — sonnet, N=5 per scenario (25 sessions):** 5/5 on every test.

| Test | Pass rate |
| --- | --- |
| `h4-control` | 5/5 |
| `h1-md` | 5/5 |
| `h2-sh` | 5/5 (handler executed in all 5) |
| `h3-not-opted-in` | 5/5 (handler never executed) |
| `h5-sh-fail` | 5/5 (PR opened, failure reported) |
| `baseline` (full kit footer) | 5/5 |

**Smoke — haiku, N=1:** the five hook scenarios passed, but `baseline` failed:
2 of 5 bodies (`h2-sh`, `h3-not-opted-in`) kept only the generic "Generated
with Claude Code" line and dropped the kit's "plan approved by a human… human
review still required" text. One of the two had no active hook, so that is
create-pr drift on the smaller model, not a hook effect. It did not recur on
sonnet (0/25 bodies).

Limits: 5/5 at N=5 bounds nothing tightly — it rules out a hook that usually
misses, not one that misses 1 time in 10. One fixture story, one prompt, Claude
Code only. Not covered: replace semantics, several handlers, other points,
Codex/Cursor, and whether an un-opted-in handler is *read* (only that it is
not run and does not leak).
