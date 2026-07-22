# Testing Standards — Always-On Rules

Language-agnostic testing rules for every change the kit delivers. Stack-specific commands and frameworks live in the consuming repo's `CLAUDE.md`.

## The gates (adaptive to the project)

The kit enforces the project's **own** testing standard — it never imposes tests on a project that doesn't have them, and never scaffolds a test or e2e framework unprompted. **Detect what the repo actually has on every run** (it can change over time) and apply accordingly:

- **Coverage** — *if the project has a test suite with coverage tooling:* files touched by the change must not regress coverage and must meet the project's bar (default **≥ 95%** line/branch/function when the project sets none), verified with `coverage-check`. *If it has no test/coverage setup:* do not block — write tests for the changed behavior when a framework exists; if none exists, flag the gap and offer to set one up. Never invent infrastructure silently.
- **Behavioral tests** — every behavioral change gets a test that fails without it, **when the project has a test framework**. If there is none and the user hasn't asked for one, recommend it — don't force it.
- **E2E** — user-facing changes get e2e coverage **when the project already does e2e** (`e2e-generate`), including edge cases: empty states, API failures/timeouts, validation errors, role differences, navigation/back-flow. No e2e setup → note the recommendation; don't scaffold a framework.
- **Suites pass** — every suite the project *does* have passes locally before a PR is created or updated.

**Never *silently* skip a gate.** When one doesn't apply (no test/e2e setup), report it plainly with a recommendation — a skipped gate is surfaced, not hidden. Teams that want a hard bar can set a `gates` policy in `.claude/dev-kit.json` (`coverage` / `e2e`: `auto` (default) · `required` · `off`); absent that, the kit auto-detects each run.

The **plan-approval gate** and the **security pass** are *not* adaptive — they always apply.

## Test quality

- Tests assert behavior, not implementation: a rename or refactor that preserves behavior should not break them.
- No assertion-free tests, no tests written only to move the coverage number — every test states a scenario a reviewer can read.
- Deterministic by construction: no real clocks, no unseeded randomness, no order dependence, no shared mutable fixtures across tests (clone or rebuild per test).
- One behavior per test; the name describes the scenario and expected outcome, not the method under test.
- Preserve existing test names when updating a file — history and review tooling depend on them.

## Test doubles

- Mock at architectural boundaries (HTTP, persistence, message bus, clock), not between collaborators of the same layer.
- Prefer real implementations in-memory over mocks when the framework provides them.
- A mock that mirrors the entire implementation is a smell — test one level higher instead.

## Forbidden shortcuts

Never, to make a gate pass: exclude files from coverage, add lint/coverage suppressions, weaken assertions, delete failing tests, or mark tests skipped. If a gate genuinely cannot be met (e.g. unreachable defensive code), remove the dead code or escalate the decision to the user — with the evidence.
