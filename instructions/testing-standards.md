# Testing Standards — Always-On Rules

Language-agnostic testing rules for every change the kit delivers. Stack-specific commands and frameworks live in the consuming repo's `CLAUDE.md`.

## The gates (non-negotiable)

- Every file touched by a change keeps **≥ 95% coverage** (line, branch, function) — verified with `coverage-check`, never assumed.
- Every behavioral change has a test that fails without the change.
- User-facing changes get e2e coverage (`e2e-generate`), including edge cases: empty states, API failures/timeouts, validation errors, role differences, navigation/back-flow.
- All relevant suites pass locally before a PR is created or updated.

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
