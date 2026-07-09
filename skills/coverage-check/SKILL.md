---
name: coverage-check
description: Run unit tests with coverage for the .NET backend and Angular frontend and verify that every file touched in the current change keeps line, branch, and function coverage at or above 95%. Use before committing, before PR creation, or when the user asks about coverage.
---

# Coverage Check

Enforce the team's coverage gate: **every touched file must stay ≥ 95%** (line, branch, function).

## Scope

1. Determine the touched files: `git diff --name-only` against the base branch (plus staged/unstaged changes).
2. Split them into backend (`*.cs`) and frontend (`*.ts` excluding specs) sets. Ignore generated files, migrations, and test files themselves.

## Backend (.NET)

1. Run the narrowest test set first, then broaden:
   ```bash
   dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults
   ```
2. Parse the produced Cobertura XML (`TestResults/**/coverage.cobertura.xml`) and extract per-file line/branch coverage for each touched `.cs` file.
3. If the repo defines its own coverage command or `coverlet` settings (check the consuming repo's CLAUDE.md and `*.csproj`), prefer those.

## Frontend (Angular)

1. Run the project's test command with coverage. Prefer what the repo defines; typical forms:
   ```bash
   ng test --watch=false --code-coverage
   # or
   npm run test:coverage
   ```
2. Parse `coverage/**/lcov.info` or the coverage summary JSON for per-file metrics of each touched `.ts` file.

## Verdict

Report a table, worst offenders first:

```
| File | Lines | Branches | Functions | Verdict |
|------|-------|----------|-----------|---------|
| backend/App.Api/Payments/PaymentService.cs | 97.2% | 95.0% | 100% | PASS |
| frontend/src/app/payments/payment-list.component.ts | 88.4% | 71.0% | 90.0% | FAIL |
```

- **FAIL** if any touched file is below 95% on any metric. List the uncovered lines/branches and propose the specific missing test cases.
- Do not mark work as complete, commit, or open a PR while the gate fails.
- If tests themselves fail, report the failures verbatim — never report coverage from a failing run as authoritative.
- If the project is not scaffolded or the command cannot run, say so explicitly instead of inventing results.
