# Python — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Python projects. The repo's `CLAUDE.md` and `pyproject.toml` win over this.

## Detect
`pyproject.toml`, `setup.py`/`setup.cfg`, or `requirements*.txt`. Test framework: `pytest` (default) or `unittest`. Env tool: venv / poetry / uv / pdm — use the project's.

## Commands
- Install: `pip install -e .[dev]` / `poetry install` / `uv sync` (match the project).
- Lint + format: `ruff check` and `ruff format --check` (or flake8/black); types: `mypy` if configured.
- Unit tests: `pytest`.
- Tests with coverage: `pytest --cov=<package> --cov-branch --cov-report=xml --cov-report=term-missing`

## Coverage
- `pytest-cov` wraps `coverage.py`. `--cov-report=xml` → `coverage.xml` (**Cobertura**), the default for the gate to parse; `--cov-branch` adds branch coverage; `--cov-report=term-missing` lists uncovered lines.
- Enforce inline with `--cov-fail-under=95`. Configure `[tool.coverage]` in `pyproject.toml`.
- Combining across parallel/CI-matrix runs needs `coverage combine` — watch for under-reporting if skipped.

## E2E
- Web UI: Playwright for Python or Selenium. API: `pytest` against a running app, or the framework's test client (FastAPI `TestClient`, Django test client).

## Conventions & gotchas
- Tests in `tests/`, files `test_*.py`, one behaviour per test; fixtures over module-level mutable state.
- Coverage needs the source importable — run from repo root with the package installed (`-e`).
- Don't install globally; respect the project's env manager.

## Docs
pytest-cov: <https://pytest-cov.readthedocs.io> · coverage.py: <https://coverage.readthedocs.io>
