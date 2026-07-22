# Node / JavaScript / TypeScript — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Node projects. The repo's `CLAUDE.md` and `package.json` scripts win over this.

## Detect
`package.json` (+ `tsconfig.json` for TypeScript). Runner from devDependencies / the `test` script: `vitest`, `jest`, or `mocha`. Match the package manager to the lockfile (`package-lock.json`→npm, `pnpm-lock.yaml`→pnpm, `yarn.lock`→yarn).

## Commands
- Install: `npm ci` (or `pnpm i --frozen-lockfile` / `yarn --immutable`).
- Lint: `npm run lint` (ESLint); types: `npx tsc --noEmit`.
- Unit tests: `npm test`.
- Tests with coverage (prefer a `test:coverage` script if present):
  - Vitest: `npx vitest run --coverage`
  - Jest: `npx jest --coverage`

## Coverage
- Vitest provider: **`v8`** (default, fast, zero extra deps) or **`istanbul`** (most precise branch counts, widest reporters). Jest uses istanbul-style.
- Report: enable the **`lcov`** reporter → `coverage/lcov.info` (parse per-file line/branch/function), plus `text-summary` for CI logs. `json-summary` → `coverage/coverage-summary.json` is easiest to read programmatically.
- Set `coverage.all: true` + an `include` glob so untested files count as 0% — honest totals, not a misleading 100%.

## E2E
- Playwright (`npx playwright test`) or Cypress (`npx cypress run`). Reuse the existing config/page objects; never add a second framework.

## Conventions & gotchas
- No `any` in tests; no `require()` in TS test files.
- Mock at boundaries (HTTP, db, clock), not between same-layer collaborators.
- Monorepos: run per workspace and merge per-file coverage.

## Docs
Vitest coverage: <https://vitest.dev/guide/coverage> · Playwright: <https://playwright.dev>
