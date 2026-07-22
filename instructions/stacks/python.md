# Python — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Python projects. The repo's `CLAUDE.md`, `pyproject.toml`, or `tox.ini` win over this.

## Detect
`pyproject.toml`, `setup.py`, `setup.cfg`, or `requirements*.txt`. Test framework: `pytest` (default) or `unittest`.

## Commands
- Install: `pip install -e .[dev]` or `pip install -r requirements-dev.txt`; use `poetry install` / `uv sync` if that's the project's tool.
- Lint/format: `ruff check` (or `flake8`) and `ruff format` / `black`; type-check: `mypy` if configured.
- Unit tests: `pytest`.
- Tests with coverage: `pytest --cov --cov-report=xml --cov-report=term-missing`
  - `--cov=<package>` to scope to the source package.

## Coverage
- Report: `coverage.xml` (Cobertura format) — the default for `coverage-check` to parse. `.coverage` (SQLite) or `coverage json` are alternatives.
- `--cov-report=term-missing` lists uncovered lines inline, useful for closing gaps.

## E2E
- Web UI: Playwright for Python (`pytest` + `playwright`) or Selenium. API: `pytest` against a running app or `TestClient` (FastAPI) / Django test client.

## Conventions & gotchas
- Tests in `tests/`, files `test_*.py`, one behaviour per test.
- Use fixtures; avoid module-level mutable state shared across tests.
- Respect the project's env manager (venv / poetry / uv / conda) — don't install globally.
- Coverage needs the source importable; run from the repo root with the right `PYTHONPATH`/install.
