# Node / JavaScript / TypeScript — stack profile

Baseline for Node projects. The repo's `CLAUDE.md` and `package.json` scripts win over this.

## Detect
`package.json`. TypeScript if `tsconfig.json` is present. Test runner from devDependencies (`jest`, `vitest`, `mocha`) or the `test` script.

## Commands
- Install: `npm ci` (or `pnpm i` / `yarn` — match the lockfile present).
- Build: `npm run build` if defined.
- Lint: `npm run lint` (usually ESLint); type-check: `npx tsc --noEmit`.
- Unit tests: `npm test`.
- Tests with coverage:
  - Jest: `npx jest --coverage`
  - Vitest: `npx vitest run --coverage`
  - Prefer a repo script if present: `npm run test:coverage`.

## Coverage
- Report: `coverage/lcov.info` (lcov) and/or `coverage/coverage-summary.json` (json-summary). Enable json-summary/lcov reporters if missing.
- Per-file line/branch/function metrics come straight from `coverage-summary.json` or the `lcov.info` records.

## E2E
- Playwright (`npx playwright test`) or Cypress (`npx cypress run`). Reuse the existing config and page objects; never introduce a second framework.

## Conventions & gotchas
- Never use `any` in tests; no `require()` in TS test files.
- Mock at boundaries (HTTP, db, clock), not between same-layer collaborators.
- Match the package manager to the lockfile (`package-lock.json` → npm, `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn).
- Monorepos: run tests per workspace/package and merge per-file coverage.
