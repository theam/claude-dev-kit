---
name: coverage-check
description: Run the repo's unit tests with coverage and verify that every file touched in the current change keeps line, branch, and function coverage at or above 95%. Language- and framework-agnostic. Use before committing, before PR creation, or when the user asks about coverage.
---

# Coverage Check

Enforce the team's coverage gate: **every touched file must stay ≥ 95%** (line, branch, function). This skill is stack-agnostic — it runs whatever the consuming repo declares and parses whatever standard report the run produces.

## 1. Find the touched files

`git diff --name-only` against the base branch, plus staged and unstaged changes. Exclude, by convention: generated/vendored code, database migrations, and the test files themselves. Group the remaining files by the module/project they belong to so you can run the narrowest useful test set first.

## 2. Determine the coverage command(s)

In order of preference:

1. **Declared in config** — read `.claude/dev-kit.json` (`test.coverageCommands`) and the consuming repo's `CLAUDE.md`. If a command is declared, use it verbatim.
2. **Declared by the repo's tooling** — a `test:coverage` script in `package.json`, a `Makefile`/`Taskfile` target, a `coverage` task in the build file.
3. **Detected from the stack** — infer from the project files present, e.g.:

   | Stack signal | Typical coverage command | Report produced |
   |---|---|---|
   | `*.csproj` / `*.sln` | `dotnet test --collect:"XPlat Code Coverage"` | Cobertura XML |
   | `package.json` (jest/vitest) | `npm test -- --coverage` | lcov / json-summary |
   | `angular.json` | `ng test --watch=false --code-coverage` | lcov |
   | `pom.xml` / `build.gradle` | `mvn test` / `gradle test jacocoTestReport` | JaCoCo XML |
   | `pyproject.toml` / `setup.py` | `pytest --cov --cov-report=xml` | coverage.py XML |
   | `go.mod` | `go test ./... -coverprofile=cover.out` | Go coverprofile |
   | `Cargo.toml` | `cargo llvm-cov --lcov` | lcov |

   A monorepo may need several commands (one per language/area). Run each and merge the per-file results.

If you detect the command by inference (not from config), **offer to persist it** to `.claude/dev-kit.json` under `test.coverageCommands` so the next run is deterministic.

## 3. Run and parse

Run the command(s), then parse the produced report for per-file line/branch/function metrics. Handle the common formats: **Cobertura XML, lcov (`lcov.info`), JaCoCo XML, coverage.py XML, Go coverprofile, and json-summary**. Map each report path back to the touched source files from step 1.

## 4. Verdict

Report a table, worst offenders first:

```
| File | Lines | Branches | Functions | Verdict |
|------|-------|----------|-----------|---------|
| src/payments/payment_service.<ext>      | 97.2% | 95.0% | 100%  | PASS |
| src/payments/payment-list.component.<ext> | 88.4% | 71.0% | 90.0% | FAIL |
```

- **FAIL** if any touched file is below 95% on any metric. List the uncovered lines/branches and propose the specific missing test cases.
- Do not mark work as complete, commit, or open a PR while the gate fails.
- If tests themselves fail, report the failures verbatim — never report coverage from a failing run as authoritative.
- If the project is not scaffolded or the command cannot run, say so explicitly instead of inventing results.
- If a metric is genuinely unavailable for a stack (e.g. a runner reports no branch coverage), state that plainly rather than reporting a fabricated number.
