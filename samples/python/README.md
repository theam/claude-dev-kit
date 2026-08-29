# Python sample — the stack matrix's second real row

A deliberately small Python project whose only job is to run the [Python stack
profile](../../instructions/stacks/python.md)'s documented commands **for real** in CI, so
a profile that goes stale fails loudly instead of silently degrading the kit for the stack
(issue #50, following the pattern the [PHP row](../php/README.md) established; the
completeness lint in `scripts/stack-profiles.test.mjs` is the other half).

What the CI job (`.github/workflows/stacks.yml`, job `python`) proves on every run:

| Gate | Command (from the profile) | Enforced how |
|---|---|---|
| Install | `pip install -e '.[dev]'` | job fails on error |
| Lint + format | `ruff check .` and `ruff format --check .` | job fails on findings |
| Unit tests + coverage ≥ 95% (line **and** branch) | `pytest --cov=dev_kit_sample --cov-branch --cov-report=xml --cov-report=term-missing --cov-fail-under=95` | `--cov-fail-under` inline, plus `fail_under` in `[tool.coverage.report]` — the profile's own documented enforcement |
| E2E | — | **not applicable** and reported as such: the sample has no user-facing surface, and the adaptive-gates doctrine forbids scaffolding a framework to fake one |

Notes:

- No lockfile is committed (pip has none by default; the dev extras use ranged
  minimums), so the sample exercises the profile against current dependencies — a
  breaking pytest, coverage.py, or ruff release surfaces here first. Same staleness-alarm
  intent as the PHP row's uncommitted `composer.lock`.
- `--cov-report=xml` emits **Cobertura**, not Clover, so the kit's per-file
  `check-clover.mjs` gate does not apply here; the bar is enforced inline exactly as the
  profile documents (`--cov-fail-under` / `fail_under`). That gate is repo-wide rather
  than per-file — a per-file Cobertura gate is a natural follow-up if the matrix wants
  parity with the PHP row.
- The class under test mirrors the kit's own coverage gate (and the PHP sample's class,
  keeping the rows comparable) and carries real branches; a branchless sample would prove
  nothing about branch-level metrics.

Run it locally:

```bash
cd samples/python
python -m venv .venv && . .venv/bin/activate
pip install -e '.[dev]'
ruff check . && ruff format --check .
pytest --cov=dev_kit_sample --cov-branch --cov-report=xml --cov-report=term-missing --cov-fail-under=95
```
